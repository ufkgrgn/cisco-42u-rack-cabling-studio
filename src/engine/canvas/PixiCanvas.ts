import { Application, Container } from 'pixi.js';
import { Camera } from '../camera/Camera';
import { CameraController } from '../camera/CameraController';
import { SceneGraph } from '../scene/SceneGraph';
import { DragManager } from '../interaction/DragManager';
import { engineBridge } from '../bridge/EngineBridge';
import { CanvasEngineOptions, EngineStatus, SupportedRendererType } from './types';
import { RackModel, CableRun } from '../../core/types';
import { SelectionType } from '../../core/state/selectionStore';
import { catalogRegistry } from '../../core/catalog/catalogRegistry';

/**
 * Core PixiJS v8 Canvas Host & Lifecycle Manager.
 * Handles WebGPU / WebGL fallback, ResizeObserver, DevicePixelRatio updates,
 * decoupled 60 FPS ticker loop, and isolated RenderGroups for multi-rack rendering.
 */
export class PixiCanvas {
  public app: Application | null = null;
  public status: EngineStatus = 'uninitialized';
  public camera: Camera | null = null;
  public cameraController: CameraController | null = null;
  public sceneGraph: SceneGraph | null = null;
  public dragManager: DragManager | null = null;

  // Scene graph container hierarchy
  public stage: Container | null = null;
  public worldContainer: Container | null = null;
  public uiContainer: Container | null = null;

  private _options: CanvasEngineOptions;
  private _resizeObserver: ResizeObserver | null = null;
  private _dprMediaQuery: MediaQueryList | null = null;
  private _dprListener: (() => void) | null = null;
  private _disconnectBridge: (() => void) | null = null;
  private _unsubEvents: Array<() => void> = [];

  private _isDirty = true;
  private _rafResizeId: number | null = null;
  private _destroyed = false;

  constructor(options: CanvasEngineOptions) {
    this._options = options;
  }

  public async init(): Promise<void> {
    if (this._destroyed) return;
    this.status = 'initializing';

    const container = this._options.container;
    const initialWidth = Math.max(container.clientWidth || 800, 100);
    const initialHeight = Math.max(container.clientHeight || 600, 100);
    const dpr = this._options.resolution ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    let app = new Application();
    let detectedRenderer: SupportedRendererType = 'webgl';

    // Tier 1: Asynchronous WebGPU initialization with auto-detect WebGL fallback
    try {
      await app.init({
        preference: this._options.preference ?? 'webgpu',
        powerPreference: 'high-performance',
        canvas: this._options.canvas,
        width: initialWidth,
        height: initialHeight,
        resolution: dpr,
        autoDensity: this._options.autoDensity ?? true,
        antialias: this._options.antialias ?? true,
        backgroundColor: this._options.backgroundColor ?? 0x070a10,
        sharedTicker: false,
        autoStart: true,
        resizeTo: undefined, // Managed explicitly via ResizeObserver
      });

      detectedRenderer = app.renderer.name === 'webgpu' ? 'webgpu' : 'webgl';
    } catch (primaryErr) {
      console.warn('[PixiCanvas] WebGPU initialization failed, retrying with WebGL fallback:', primaryErr);
      if (this._destroyed) return;

      // Tier 2: Hard fallback retry with a clean Application instance
      app = new Application();
      await app.init({
        preference: 'webgl',
        canvas: this._options.canvas,
        width: initialWidth,
        height: initialHeight,
        resolution: dpr,
        autoDensity: this._options.autoDensity ?? true,
        antialias: this._options.antialias ?? true,
        backgroundColor: this._options.backgroundColor ?? 0x070a10,
        sharedTicker: false,
        autoStart: true,
        resizeTo: undefined,
      });
      detectedRenderer = 'webgl';
    }

    // Cancellation guard: if component unmounted while awaiting init
    if (this._destroyed) {
      app.destroy(false, { children: true, texture: false });
      return;
    }

    this.app = app;
    this.stage = app.stage;
    this.stage.eventMode = 'static';

    // Initialize SceneGraph with isolated RenderGroup
    this.sceneGraph = new SceneGraph();
    this.worldContainer = this.sceneGraph.worldContainer;
    this.stage.addChild(this.worldContainer);

    this.uiContainer = new Container();
    this.stage.addChild(this.uiContainer);

    // Initialize Camera
    this.camera = new Camera(this.worldContainer, {
      width: initialWidth,
      height: initialHeight,
    });

    // Initialize CameraController on canvas
    this.cameraController = new CameraController(this.camera, engineBridge);
    this.cameraController.attach(this._options.canvas);

    // Initialize DragManager
    this.dragManager = new DragManager(this.sceneGraph, engineBridge);

    // Synchronize current project state
    const currentProject = engineBridge.getProjectState().project;
    if (currentProject?.racks) {
      this.sceneGraph.syncRacks(currentProject.racks, catalogRegistry);
    }

    // Setup ResizeObserver for responsive layout changes
    this.setupResizeObserver();

    // Setup DevicePixelRatio watcher
    this.setupDprWatcher();

    // Connect EngineBridge transient subscriptions (Zero-React renders)
    this.setupBridge();

    // Setup Decoupled Ticker Loop
    this.setupTicker();

    this.status = 'ready';
    this.markDirty();

    // Initial fit if racks exist
    if (currentProject?.racks?.length) {
      this.fitAllRacks();
    }

    // Emit readiness
    engineBridge.emit('engine:ready', { renderer: detectedRenderer, fps: 60 });
    this._options.onReady?.({ renderer: detectedRenderer, fps: 60 });
  }

  public markDirty(): void {
    this._isDirty = true;
  }

  private setupTicker(): void {
    if (!this.app) return;

    // Detach PixiJS v8 default ticker render callback to prevent redundant 60fps rendering & double rendering
    this.app.ticker.remove(this.app.render, this.app);

    this.app.ticker.add((ticker) => {
      if (this._destroyed) return;

      const dt = ticker.deltaTime;
      const cameraMoving = this.camera?.update(dt) ?? false;

      if (cameraMoving || this._isDirty) {
        if (this.sceneGraph && this.camera && this.app) {
          const w = this.app.renderer.width / this.app.renderer.resolution;
          const h = this.app.renderer.height / this.app.renderer.resolution;
          this.sceneGraph.updateViewport(w, h, this.camera.scale, (sx, sy) =>
            this.camera!.screenToWorld(sx, sy)
          );
        }
        this.app?.render();
        this._isDirty = false;
      }
    });
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (this._rafResizeId && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafResizeId);
          }
          if (typeof requestAnimationFrame !== 'undefined') {
            this._rafResizeId = requestAnimationFrame(() => {
              this.handleResize(width, height);
            });
          } else {
            this.handleResize(width, height);
          }
        }
      }
    });

    this._resizeObserver.observe(this._options.container);
  }

  private handleResize(width: number, height: number): void {
    if (!this.app || this._destroyed) return;

    this.app.renderer.resize(width, height);
    this.camera?.updateScreenBounds(width, height);
    this.markDirty();

    engineBridge.emit('viewport:resize', {
      width,
      height,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    });
  }

  private setupDprWatcher(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const updateDpr = () => {
      if (!this.app || this._destroyed) return;
      const newDpr = window.devicePixelRatio || 1;
      this.app.renderer.resolution = newDpr;
      const { clientWidth, clientHeight } = this._options.container;
      this.app.renderer.resize(clientWidth, clientHeight);
      this.markDirty();

      // Re-arm media query listener for next DPR change
      if (this._dprMediaQuery && this._dprListener) {
        this._dprMediaQuery.removeEventListener('change', this._dprListener);
        this._dprMediaQuery = window.matchMedia(`(resolution: ${newDpr}dppx)`);
        this._dprMediaQuery.addEventListener('change', this._dprListener);
      }
    };

    this._dprListener = updateDpr;
    this._dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this._dprMediaQuery.addEventListener('change', this._dprListener);
  }

  private setupBridge(): void {
    // 1. Transient store subscriptions (Zero-React re-renders)
    this._disconnectBridge = engineBridge.connectEngine({
      onRacksChanged: (racks: RackModel[]) => {
        this.syncRacks(racks);
        this.markDirty();
      },
      onCablesChanged: (cables: CableRun[]) => {
        this.syncCables(cables);
        this.markDirty();
      },
      onSelectionChanged: (type: SelectionType, id: string | null) => {
        this.syncSelection(type, id);
        this.markDirty();
      },
    });

    // 2. App -> Engine camera events
    const unsubFit = engineBridge.on('camera:fit-all', () => {
      this.fitAllRacks();
    });

    // 3. View face toggling event
    const unsubToggleFace = engineBridge.on('view:toggle-face', ({ rackId, face }) => {
      if (this.sceneGraph) {
        if (rackId) {
          const rackContainer = this.sceneGraph.rackContainers.get(rackId);
          if (rackContainer) {
            rackContainer.setActiveFace(face);
          }
        } else {
          this.sceneGraph.setActiveFace(face);
        }
        this.markDirty();
      }
    });

    // 4. App -> Engine device drag events
    const unsubDragMove = engineBridge.on('device:drag-move', (data) => {
      if (this.dragManager && this.camera && data.screenX !== undefined && data.screenY !== undefined) {
        const world = this.camera.screenToWorld(data.screenX, data.screenY);
        this.dragManager.handlePointerMove(world.x, world.y);
        this.markDirty();
      }
    });

    const unsubDragEnd = engineBridge.on('device:drag-end', (data) => {
      if (this.dragManager && this.camera && data.screenX !== undefined && data.screenY !== undefined) {
        const world = this.camera.screenToWorld(data.screenX, data.screenY);
        this.dragManager.handlePointerUp(world.x, world.y);
        this.markDirty();
      }
    });

    // 5. Viewport transform changes (Camera pan/zoom triggers re-render)
    const unsubViewportChange = engineBridge.on('viewport:change', () => {
      this.markDirty();
    });

    this._unsubEvents.push(unsubFit, unsubToggleFace, unsubDragMove, unsubDragEnd, unsubViewportChange);
  }

  private syncRacks(racks: RackModel[]): void {
    if (!this.sceneGraph) return;
    this.sceneGraph.syncRacks(racks, catalogRegistry);
    this.markDirty();
  }

  private syncCables(_cables: CableRun[]): void {
    // Cabling pipeline synchronization (integrated in M5)
    this.markDirty();
  }

  private syncSelection(type: SelectionType, id: string | null): void {
    if (!this.sceneGraph) return;
    for (const rack of this.sceneGraph.rackContainers.values()) {
      for (const dev of rack.deviceMap.values()) {
        dev.setSelected(type === 'device' && dev.instance.instanceId === id);
      }
    }
    this.markDirty();
  }

  public fitAllRacks(): void {
    const state = engineBridge.getProjectState();
    const racks = state.project?.racks || [];
    if (racks.length === 0 || !this.camera) return;

    const RACK_WIDTH = 634;
    const RACK_GAP = 120;
    const totalW = racks.length * (RACK_WIDTH + RACK_GAP) - RACK_GAP;
    const maxU = Math.max(...racks.map((r) => r.totalU), 42);
    const totalH = maxU * 32 + 64;

    this.camera.fitToBounds(0, 0, totalW, totalH, 60);
    this.markDirty();
  }

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.status = 'destroyed';

    // Cancel pending animation frames
    if (this._rafResizeId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafResizeId);
      this._rafResizeId = null;
    }

    // Disconnect observers & listeners
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    if (this._dprMediaQuery && this._dprListener) {
      this._dprMediaQuery.removeEventListener('change', this._dprListener);
      this._dprMediaQuery = null;
      this._dprListener = null;
    }

    this._unsubEvents.forEach((unsub) => unsub());
    this._unsubEvents = [];

    this._disconnectBridge?.();
    this._disconnectBridge = null;

    this.cameraController?.detach();
    this.cameraController = null;

    this.dragManager?.destroy();
    this.dragManager = null;

    // Destroy Pixi Application without removing canvas from DOM (React owns canvas node)
    if (this.app) {
      try {
        this.app.destroy(false, { children: true, texture: false });
      } catch (err) {
        console.warn('[PixiCanvas] Error during app.destroy:', err);
      }
      this.app = null;
    }

    this.stage = null;
    this.worldContainer = null;
    this.uiContainer = null;
    this.sceneGraph = null;
    this.camera = null;
  }
}
