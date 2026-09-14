# Handoff Report: PixiJS v8 Canvas Setup & Lifecycle Investigation (Milestone M2)

- **Agent**: Explorer M2_1 (`teamwork_preview_explorer`)
- **Working Directory**: `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m2_1`
- **Date**: 2026-09-14T20:18:00Z
- **Status**: Complete (Hard Handoff)
- **Primary Deliverable**: Technical investigation & implementation blueprint for PixiJS v8 Application lifecycle, React 19 canvas mounting, and decoupled 60 FPS render loop.

---

## 1. Observation

1. **Current Codebase State & Dependencies**:
   - `package.json` specifies:
     - `"pixi.js": "^8.7.3"` (resolved to `8.20.1` in `node_modules/pixi.js/package.json`)
     - `"react": "^19.0.0"` and `"react-dom": "^19.0.0"`
     - `"zustand": "^5.0.3"`
     - `"typescript": "^5.7.3"`
     - `"vite": "^6.2.0"`, `"vitest": "^3.0.5"`
   - `src/app/components/Viewport.tsx` (lines 9-134) is currently a mock DOM table rendering rack slots using Tailwind HTML divs (`.bg-[#151c28]`, `.u-slot`, height `32px`). It has no canvas element and does not yet use PixiJS.
   - `src/engine/bridge/EngineBridge.ts` (lines 1-122) already exists and implements a singleton event bus with typed events (`'engine:ready'`, `'viewport:change'`, `'device:drag-*'`, `'selection:change'`), command dispatch via `useHistoryStore`, and fine-grained transient subscriptions (`connectEngine`) using `useProjectStore.subscribe`.
   - `tests/unit/state.test.ts` (lines 72-108) verifies that `engineBridge` successfully routes events and allows store updates without triggering React component re-renders.

2. **PixiJS v8 Architecture & Lifecycle Mechanics**:
   - In `node_modules/pixi.js/lib/app/Application.d.ts` (lines 200-222), constructor options are deprecated (`constructor(options?)` deprecated since 8.0.0). PixiJS v8 requires the asynchronous initialization pattern:
     ```typescript
     const app = new Application();
     await app.init(options?: Partial<ApplicationOptions>);
     ```
   - In `node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.js` (lines 8-57), `autoDetectRenderer` evaluates `preference: 'webgpu'`. It queries `isWebGPUSupported()`. If true, it instantiates `WebGPURenderer`; if false, it evaluates `isWebGLSupported()` and instantiates `WebGLRenderer`.
   - In `node_modules/pixi.js/lib/rendering/renderers/shared/view/ViewSystem.d.ts` (lines 14-45), `ViewSystemOptions` accepts:
     - `canvas?: ICanvas`: allows passing an existing HTML5 canvas element (`HTMLCanvasElement`).
     - `resolution?: number`: sets resolution / device pixel ratio.
     - `autoDensity?: boolean`: synchronizes CSS display dimensions with internal pixel backing store.
     - `destroy(options?: { removeView?: boolean })`: controls whether `app.destroy()` unmounts the canvas from the DOM.
   - In `node_modules/pixi.js/lib/app/ResizePlugin.js` (lines 18-28), PixiJS v8's built-in `resizeTo` only listens to `globalThis.addEventListener('resize')`. It does NOT use `ResizeObserver`. As a result, CSS layout mutations (such as collapsing a sidebar or opening a drawer) fail to resize the canvas unless `window.onresize` fires.
   - In `node_modules/pixi.js/lib/app/TickerPlugin.d.ts` (lines 38-81), `app.ticker` runs on native `requestAnimationFrame` independently from the DOM, providing frame time delta (`deltaTime`, `deltaMS`) and priority execution hooks.

3. **React 19 Concurrent & StrictMode Lifecycle Challenges**:
   - React 19 runs `useEffect` twice in development (mount $\to$ unmount $\to$ mount).
   - Because `await app.init(...)` is an asynchronous operation, the unmount cleanup function can execute while `app.init()` is still in flight.
   - If `app.destroy()` is called with `{ removeView: true }` or default `true`, Pixi attempts `parentElement.removeChild(canvas)`. When React subsequently attempts to unmount `<canvas ref={canvasRef} />`, React's reconciler throws a fatal DOM exception (`NotFoundError: Failed to execute 'removeChild' on 'Node'`).
   - Therefore, React must own the `<canvas>` DOM node, and Pixi must destroy resources with `removeView: false`.

---

## 2. Logic Chain

1. **Premise 1**: The application requires sustained 60 FPS viewport rendering under 10+ populated 42U racks (420+ devices, 10,000+ ports).
2. **Premise 2**: React component re-renders trigger Virtual DOM reconciliation and DOM tree mutations. If pan/zoom or mouse dragging updates React component state (`useState`), React re-renders at 60Hz/120Hz, creating layout thrashing and garbage collection spikes ($>45\text{ms}$ frame times).
3. **Premise 3**: Decoupling the PixiJS v8 render loop from React ensures that pointer interactions (pan, zoom, ghost dragging) only mutate local PixiJS matrix transforms and GPU buffers. React state is only updated on transactional completion (e.g. `pointerup` dispatching a placement command).
4. **Premise 4**: In React 19, passing `<canvas ref={canvasRef} />` directly to `app.init({ canvas: canvasRef.current, ... })` keeps DOM node ownership firmly in React's tree while granting PixiJS exclusive rendering control.
5. **Premise 5**: Because WebGPU is not universally supported in virtual machines, headless CI runners, or older GPUs, a defensive two-tier fallback (PixiJS auto-detect + explicit try/catch retry to WebGL 2) guarantees zero startup crashes.
6. **Premise 6**: A dedicated `ResizeObserver` observing the canvas parent container (with `requestAnimationFrame` debouncing) guarantees accurate resizing during responsive UI layout changes, while `window.matchMedia('(resolution: ...)')` dynamically updates canvas resolution during multi-monitor movement or browser zoom changes.
7. **Conclusion**: Constructing `src/engine/canvas/PixiCanvas.ts`, integrating it into `src/app/components/Viewport.tsx`, connecting it to `src/engine/camera/Camera.ts`, and leveraging `src/engine/bridge/EngineBridge.ts` fulfills all requirements of F1.1 and F1.3 with zero React layout thrashing.

---

## 3. Caveats

1. **Headless / Node Environment (Vitest/jsdom)**:
   - In jsdom, WebGL and WebGPU contexts are not available (`HTMLCanvasElement.prototype.getContext('webgl2')` returns `null`). Unit tests for React mounting must mock `PixiCanvas` or provide a lightweight canvas mock; full GPU rendering is verified in Playwright E2E/benchmark tests.
2. **WebGPU Shader Compatibility**:
   - When custom WGSL shaders (e.g. instanced Bézier cabling shaders in M5) are introduced, WebGL 2 fallback requires equivalent GLSL shaders. PixiJS v8 handles standard materials automatically, but custom filters/shaders must provide dual pipelines or use PixiJS's unified shader system.
3. **High-DPI Performance vs Crispness**:
   - On 4K / 3x Retina displays, rendering at physical DPR can triple fill-rate load. Clamping DPR to `Math.min(window.devicePixelRatio || 1, 2.0)` is an optional optimization if lower-end GPUs struggle at 4K.

---

## 4. Conclusion & Complete Implementation Blueprint

### 4.1 Target File Architecture

The following file structure organizes the engine canvas and lifecycle layer:

```
src/
├── app/
│   └── components/
│       └── Viewport.tsx            # [MODIFY] React 19 Host Component for Pixi Canvas
├── engine/
│   ├── bridge/
│   │   └── EngineBridge.ts         # [MODIFY] Enhanced typed event bus & store connector
│   ├── camera/
│   │   └── Camera.ts               # [CREATE] 2D Affine camera math, pan/zoom & culling
│   └── canvas/
│       ├── types.ts                # [CREATE] Canvas engine interfaces & options
│       └── PixiCanvas.ts           # [CREATE] PixiJS v8 Application wrapper & lifecycle
```

---

### 4.2 File 1: `src/engine/canvas/types.ts`

```typescript
import { Application, Container } from 'pixi.js';

export type SupportedRendererType = 'webgpu' | 'webgl';

export type EngineStatus = 'uninitialized' | 'initializing' | 'ready' | 'destroyed' | 'error';

export interface CanvasEngineOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  preference?: SupportedRendererType;
  backgroundColor?: number;
  antialias?: boolean;
  resolution?: number;
  autoDensity?: boolean;
  onReady?: (info: { renderer: SupportedRendererType; fps: number }) => void;
  onError?: (error: Error) => void;
}

export interface EngineInitResult {
  renderer: SupportedRendererType;
  dpr: number;
  width: number;
  height: number;
}
```

---

### 4.3 File 2: `src/engine/camera/Camera.ts`

```typescript
import { Container } from 'pixi.js';

export interface ScreenBounds {
  width: number;
  height: number;
}

export interface VisibleWorldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 2D Affine Camera providing continuous pointer-anchored zoom and pan.
 * Decoupled from DOM; transforms are applied directly to Pixi Container.
 */
export class Camera {
  public scale: number = 1.0;
  public panX: number = 0;
  public panY: number = 0;

  public readonly minScale: number = 0.08;
  public readonly maxScale: number = 4.0;

  // Kinetic inertia velocity
  private vx: number = 0;
  private vy: number = 0;
  private friction: number = 0.90;

  constructor(
    private targetContainer: Container,
    private screenBounds: ScreenBounds
  ) {}

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.scale,
      y: (sy - this.panY) / this.scale,
    };
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * this.scale + this.panX,
      y: wy * this.scale + this.panY,
    };
  }

  /**
   * Pointer-anchored zoom: ensures the world coordinate under the cursor
   * remains stationary on screen after zoom scaling.
   */
  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const nextScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    if (nextScale === this.scale) return;

    // World coordinate under pointer before zoom
    const wx = (screenX - this.panX) / this.scale;
    const wy = (screenY - this.panY) / this.scale;

    this.scale = nextScale;
    this.panX = screenX - wx * this.scale;
    this.panY = screenY - wy * this.scale;

    this.applyTransform();
  }

  public panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.applyTransform();
  }

  public setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  public update(dt: number): boolean {
    if (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01) {
      this.panX += this.vx * dt;
      this.panY += this.vy * dt;
      this.vx *= Math.pow(this.friction, dt);
      this.vy *= Math.pow(this.friction, dt);
      this.applyTransform();
      return true;
    }
    this.vx = 0;
    this.vy = 0;
    return false;
  }

  public updateScreenBounds(width: number, height: number): void {
    this.screenBounds.width = width;
    this.screenBounds.height = height;
  }

  public applyTransform(): void {
    this.targetContainer.position.set(this.panX, this.panY);
    this.targetContainer.scale.set(this.scale);
  }

  public getVisibleWorldBounds(): VisibleWorldBounds {
    const p1 = this.screenToWorld(0, 0);
    const p2 = this.screenToWorld(this.screenBounds.width, this.screenBounds.height);
    return {
      left: Math.min(p1.x, p2.x),
      top: Math.min(p1.y, p2.y),
      right: Math.max(p1.x, p2.x),
      bottom: Math.max(p1.y, p2.y),
    };
  }

  /**
   * Fit target world bounding box to screen with margin
   */
  public fitToBounds(
    worldLeft: number,
    worldTop: number,
    worldWidth: number,
    worldHeight: number,
    padding: number = 48
  ): void {
    if (worldWidth <= 0 || worldHeight <= 0) return;

    const availW = Math.max(100, this.screenBounds.width - padding * 2);
    const availH = Math.max(100, this.screenBounds.height - padding * 2);

    const scaleX = availW / worldWidth;
    const scaleY = availH / worldHeight;
    this.scale = Math.min(Math.max(Math.min(scaleX, scaleY), this.minScale), 1.5);

    this.panX = (this.screenBounds.width - worldWidth * this.scale) / 2 - worldLeft * this.scale;
    this.panY = (this.screenBounds.height - worldHeight * this.scale) / 2 - worldTop * this.scale;

    this.applyTransform();
  }
}
```

---

### 4.4 File 3: `src/engine/canvas/PixiCanvas.ts`

```typescript
import { Application, Container } from 'pixi.js';
import { Camera } from '../camera/Camera';
import { engineBridge } from '../bridge/EngineBridge';
import { CanvasEngineOptions, EngineStatus, SupportedRendererType } from './types';
import { RackModel, CableRun } from '../../core/types';
import { SelectionType } from '../../core/state/selectionStore';

/**
 * Core PixiJS v8 Canvas Host & Lifecycle Manager.
 * Handles WebGPU / WebGL 2 fallback, ResizeObserver, DevicePixelRatio updates,
 * and isolated RenderGroups for 60 FPS multi-rack rendering.
 */
export class PixiCanvas {
  public app: Application | null = null;
  public status: EngineStatus = 'uninitialized';
  public camera: Camera | null = null;

  // Scene graph container hierarchy
  public stage: Container | null = null;
  public worldContainer: Container | null = null;
  public rackContainer: Container | null = null;
  public cableContainer: Container | null = null;
  public ghostContainer: Container | null = null;
  public uiContainer: Container | null = null;

  private _options: CanvasEngineOptions;
  private _resizeObserver: ResizeObserver | null = null;
  private _dprMediaQuery: MediaQueryList | null = null;
  private _dprListener: (() => void) | null = null;
  private _disconnectBridge: (() => void) | null = null;
  private _unsubEvents: Array<() => void> = [];

  private _isDirty: boolean = true;
  private _rafResizeId: number | null = null;
  private _destroyed: boolean = false;
  private _isDragging: boolean = false;
  private _lastPointerX: number = 0;
  private _lastPointerY: number = 0;

  constructor(options: CanvasEngineOptions) {
    this._options = options;
  }

  public async init(): Promise<void> {
    if (this._destroyed) return;
    this.status = 'initializing';

    const container = this._options.container;
    const initialWidth = Math.max(container.clientWidth || 800, 100);
    const initialHeight = Math.max(container.clientHeight || 600, 100);
    const dpr = this._options.resolution ?? (window.devicePixelRatio || 1);

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
        resizeTo: null, // Managed explicitly via ResizeObserver
      });

      detectedRenderer = app.renderer.name === 'webgpu' ? 'webgpu' : 'webgl';
    } catch (primaryErr) {
      console.warn('[PixiCanvas] WebGPU initialization failed, retrying with WebGL 2 fallback:', primaryErr);
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
        resizeTo: null,
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

    // Scene Graph Hierarchy with PixiJS v8 RenderGroup Isolation
    this.worldContainer = new Container({ isRenderGroup: true });
    this.stage.addChild(this.worldContainer);

    this.rackContainer = new Container();
    this.cableContainer = new Container();
    this.ghostContainer = new Container();
    this.uiContainer = new Container(); // Screen-space HUD / indicators

    this.worldContainer.addChild(this.rackContainer);
    this.worldContainer.addChild(this.cableContainer);
    this.worldContainer.addChild(this.ghostContainer);
    this.stage.addChild(this.uiContainer);

    // Initialize Camera
    this.camera = new Camera(this.worldContainer, {
      width: initialWidth,
      height: initialHeight,
    });

    // Attach interaction listeners (Wheel zoom, Pan drag)
    this.setupInteractions();

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

    // Emit readiness
    engineBridge.emit('engine:ready', { renderer: detectedRenderer, fps: 60 });
    this._options.onReady?.({ renderer: detectedRenderer, fps: 60 });
  }

  public markDirty(): void {
    this._isDirty = true;
  }

  private setupTicker(): void {
    if (!this.app) return;

    this.app.ticker.add((ticker) => {
      const dt = ticker.deltaTime;
      const cameraMoving = this.camera?.update(dt) ?? false;

      if (cameraMoving || this._isDirty) {
        this.app?.render();
        this._isDirty = false;
      }
    });
  }

  private setupInteractions(): void {
    const canvas = this._options.canvas;

    // Wheel zoom (anchored at cursor)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!this.camera) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.camera.zoomAt(screenX, screenY, zoomFactor);
      this.markDirty();

      // Emit throttled viewport change for HUD
      engineBridge.emit('viewport:change', {
        zoom: this.camera.scale,
        panX: this.camera.panX,
        panY: this.camera.panY,
      });
    };

    // Pointer panning (Middle click, Space+Drag, or background click)
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        this._isDragging = true;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this._isDragging && this.camera) {
        const dx = e.clientX - this._lastPointerX;
        const dy = e.clientY - this._lastPointerY;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;

        this.camera.panBy(dx, dy);
        this.markDirty();

        engineBridge.emit('viewport:change', {
          zoom: this.camera.scale,
          panX: this.camera.panX,
          panY: this.camera.panY,
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this._isDragging) {
        this._isDragging = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    this._unsubEvents.push(() => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    });
  }

  private setupResizeObserver(): void {
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (this._rafResizeId) cancelAnimationFrame(this._rafResizeId);
          this._rafResizeId = requestAnimationFrame(() => {
            this.handleResize(width, height);
          });
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
      dpr: window.devicePixelRatio || 1,
    });
  }

  private setupDprWatcher(): void {
    const updateDpr = () => {
      if (!this.app || this._destroyed) return;
      const newDpr = window.devicePixelRatio || 1;
      this.app.renderer.resolution = newDpr;
      const { clientWidth, clientHeight } = this._options.container;
      this.app.renderer.resize(clientWidth, clientHeight);
      this.markDirty();

      // Re-arm media query listener for next DPR change
      this._dprMediaQuery?.removeEventListener('change', this._dprListener!);
      this._dprMediaQuery = window.matchMedia(`(resolution: ${newDpr}dppx)`);
      this._dprMediaQuery.addEventListener('change', this._dprListener!);
    };

    this._dprListener = updateDpr;
    this._dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this._dprMediaQuery.addEventListener('change', this._dprListener);
  }

  private setupBridge(): void {
    // 1. Transient store subscriptions
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

    // 2. App -> Engine events
    const unsubZoom = engineBridge.on('camera:zoom-to', ({ factor, screenX, screenY }) => {
      this.camera?.zoomAt(screenX, screenY, factor);
      this.markDirty();
    });

    const unsubPan = engineBridge.on('camera:pan-to', ({ worldX, worldY }) => {
      if (!this.camera) return;
      const screenTarget = this.camera.worldToScreen(worldX, worldY);
      this.camera.panBy(screenTarget.x, screenTarget.y);
      this.markDirty();
    });

    const unsubFit = engineBridge.on('camera:fit-all', () => {
      this.fitAllRacks();
    });

    this._unsubEvents.push(unsubZoom, unsubPan, unsubFit);
  }

  private syncRacks(racks: RackModel[]): void {
    // Spatial rack scene synchronization (populated in M3/M4)
    this.markDirty();
  }

  private syncCables(cables: CableRun[]): void {
    // Cabling pipeline synchronization (populated in M5)
    this.markDirty();
  }

  private syncSelection(type: SelectionType, id: string | null): void {
    // Selection ring & highlighting synchronization
    this.markDirty();
  }

  public fitAllRacks(): void {
    const state = engineBridge.getProjectState();
    const racks = state.project.racks;
    if (racks.length === 0 || !this.camera) return;

    const RACK_WIDTH = 634;
    const RACK_GAP = 120;
    const totalW = racks.length * (RACK_WIDTH + RACK_GAP) - RACK_GAP;
    const maxU = Math.max(...racks.map(r => r.totalU), 42);
    const totalH = maxU * 32 + 64;

    this.camera.fitToBounds(0, 0, totalW, totalH, 60);
    this.markDirty();
  }

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.status = 'destroyed';

    // Cancel pending animation frames
    if (this._rafResizeId) {
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

    this._unsubEvents.forEach(unsub => unsub());
    this._unsubEvents = [];

    this._disconnectBridge?.();
    this._disconnectBridge = null;

    // Destroy Pixi Application without removing canvas from DOM (React owns canvas node)
    if (this.app) {
      this.app.destroy(false, { children: true, texture: false });
      this.app = null;
    }

    this.stage = null;
    this.worldContainer = null;
    this.rackContainer = null;
    this.cableContainer = null;
    this.ghostContainer = null;
    this.uiContainer = null;
    this.camera = null;
  }
}
```

---

### 4.5 File 4: `src/engine/bridge/EngineBridge.ts` (Enhancements)

Add the missing viewport and error events to `EngineBridgeEventMap`:

```typescript
export interface EngineBridgeEventMap {
  // Engine -> App events
  'engine:ready': { renderer: 'webgpu' | 'webgl'; fps: number };
  'engine:error': { message: string; fatal: boolean };
  'viewport:change': { zoom: number; panX: number; panY: number };
  'viewport:resize': { width: number; height: number; dpr: number };
  'device:drag-start': { catalogId: string; sourceRackId?: string; instanceId?: string };
  'device:drag-move': { screenX?: number; screenY?: number; worldX?: number; worldY?: number; snappedU?: number; targetRackId?: string; isValid?: boolean };
  'device:drag-end': { screenX?: number; screenY?: number; instanceId?: string; targetRackId?: string; targetU?: number };
  'port:hover': { endpoint: CableEndpoint | null };
  'selection:change': { type: SelectionType; id: string | null };

  // App -> Engine events
  'camera:pan-to': { worldX: number; worldY: number; durationMs?: number };
  'camera:zoom-to': { factor: number; screenX: number; screenY: number };
  'camera:fit-all': void;
  'view:toggle-face': { rackId: string; face: 'front' | 'rear' };
}
```

---

### 4.6 File 5: `src/app/components/Viewport.tsx` (React 19 Canvas Host)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { PixiCanvas } from '../../engine/canvas/PixiCanvas';
import { engineBridge } from '../../engine/bridge/EngineBridge';
import { EngineStatus, SupportedRendererType } from '../../engine/canvas/types';
import { Loader2, AlertCircle } from 'lucide-react';

export const Viewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<EngineStatus>('initializing');
  const [rendererType, setRendererType] = useState<SupportedRendererType>('webgl');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;
    let engine: PixiCanvas | null = null;

    const initEngine = async () => {
      if (!canvasRef.current || !containerRef.current) return;

      try {
        setStatus('initializing');
        engine = new PixiCanvas({
          canvas: canvasRef.current,
          container: containerRef.current,
          preference: 'webgpu',
          backgroundColor: 0x070a10,
        });

        await engine.init();

        if (isCancelled) {
          engine.destroy();
          return;
        }

        setStatus('ready');
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[Viewport] Graphics engine failed to initialize:', err);
        setErrorMessage(err?.message || 'WebGL / WebGPU context creation failed.');
        setStatus('error');
      }
    };

    initEngine();

    // Listen to engine ready event for active renderer badge
    const unsubReady = engineBridge.on('engine:ready', ({ renderer }) => {
      if (!isCancelled) setRendererType(renderer);
    });

    // Listen to camera viewport updates for HUD display
    const unsubViewport = engineBridge.on('viewport:change', ({ zoom }) => {
      if (!isCancelled) setZoomPercent(Math.round(zoom * 100));
    });

    return () => {
      isCancelled = true;
      unsubReady();
      unsubViewport();
      if (engine) {
        engine.destroy();
        engine = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative w-full h-full overflow-hidden bg-[#070a10] select-none"
    >
      {/* React 19 Owned Canvas Node */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none"
      />

      {/* Initializing Spinner Overlay */}
      {status === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/80 backdrop-blur-xs z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#38bdf8]" />
            <span className="text-xs font-mono">Initializing GPU Viewport...</span>
          </div>
        </div>
      )}

      {/* Context Error Overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/95 z-20 p-6">
          <div className="max-w-md bg-[#161f2f] border border-rose-500/50 rounded-lg p-5 text-center shadow-2xl">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">Renderer Initialization Failed</h3>
            <p className="text-xs text-gray-300 mt-2 mb-4 leading-relaxed font-mono">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 bg-[#049fd9] hover:bg-[#0385b5] text-white text-xs rounded font-medium transition"
            >
              Reload Studio
            </button>
          </div>
        </div>
      )}

      {/* Floating HUD (Non-interactive overlay with zero React canvas overhead) */}
      {status === 'ready' && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none z-10 font-mono text-[10px]">
          <span className="px-2 py-0.5 rounded bg-[#111827]/80 text-gray-400 border border-[#374151]">
            {rendererType.toUpperCase()}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#111827]/80 text-[#38bdf8] border border-[#374151]">
            {zoomPercent}%
          </span>
        </div>
      )}
    </div>
  );
};
```

---

## 5. Verification Method

1. **Static Type Checking**:
   Ensure all imports, interfaces, and options conform to TypeScript 5.7 and PixiJS v8.20 typings:
   ```powershell
   $env:Path = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:Path
   npx tsc --noEmit
   ```

2. **Unit Test Suite**:
   Run the full Vitest suite to guarantee that existing stores, migration schemas, and command engines remain 100% passing:
   ```powershell
   $env:Path = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:Path
   npm run test:unit
   ```

3. **Camera Affine Math Unit Verification**:
   Write a dedicated unit test in `tests/unit/camera.test.ts` verifying:
   - Screen-to-world unprojection: $\mathbf{P}_{\text{world}} = (\mathbf{P}_{\text{screen}} - \mathbf{T}) / S$.
   - Pointer-anchored zoom invariance: verify that the world coordinate at cursor $(x_s, y_s)$ does not change after `zoomAt`.
   - Bounding box calculation for frustum culling.

4. **React 19 Double-Mount / StrictMode Verification**:
   Test `<Viewport />` mounting and unmounting in a simulated StrictMode container:
   - Verify that `engine.destroy()` runs without throwing `NotFoundError` on canvas removal.
   - Verify that `ResizeObserver` disconnects cleanly.
   - Verify that zero memory leaks or dangling animation frames occur.

5. **Invalidation Conditions**:
   - If calling `app.destroy()` removes the canvas from the DOM, causing React unmount to fail.
   - If canvas pan/zoom triggers React component re-renders of `<Viewport />` (detectable via `React.useRef` render counters).
   - If `ResizeObserver` does not update screen dimensions when sidebar is toggled.
