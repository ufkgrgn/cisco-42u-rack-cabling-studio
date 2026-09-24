/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS Viewport & Application Manager
 * Manages PixiJS v8 Application lifecycle, Retina adaptive resolution, viewport camera syncing,
 * frustum culling, canvas rect measurement caching, and performance telemetry.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;

  let pixiApp = null;
  let pixiCanvas = null;
  let cabinSceneContainer = null;
  let deviceSceneContainer = null;
  let cablesContainer = null;
  let connectorsContainer = null;
  let focusContainer = null;
  let organizerOverlayContainer = null;

  let isInitializing = false;
  let initPromise = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastWorldWidth = 0;
  let lastWorldHeight = 0;
  let viewportResizeObserver = null;
  let cachedCanvasRect = null;
  let canvasRectRefreshFrame = 0;
  const activeViewportTransitions = new Set();
  let currentRenderResolution = 0;
  let interactionResolutionActive = false;
  let lastCameraSignature = null;

  const renderStats = PixiContext.renderStats = PixiContext.renderStats || {
    calls: 0,
    fastPathHits: 0,
    geometryPasses: 0,
    createdDisplays: 0,
    reusedDisplays: 0,
    destroyedDisplays: 0,
    domRectReads: 0,
    lastDurationMs: 0,
    batchRebuilds: 0,
    batchDisplayCount: 0
  };

  const PIXI_PERFORMANCE_PROFILES = Object.freeze({
    eco: Object.freeze({ resolution: 1, interactionResolution: 0.75, pixelBudget: 4_000_000 }),
    balanced: Object.freeze({ resolution: 1.5, interactionResolution: 1, pixelBudget: 8_000_000 }),
    quality: Object.freeze({ resolution: 2, interactionResolution: 1.25, pixelBudget: 12_000_000 })
  });

  let pixiPerformanceMode = 'balanced';
  try {
    const savedMode = localStorage.getItem('rackstudio_2d_performance_mode');
    if (Object.hasOwn(PIXI_PERFORMANCE_PROFILES, savedMode)) pixiPerformanceMode = savedMode;
  } catch (_) {}
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-2d-performance', pixiPerformanceMode);
  }

  const performanceTelemetry = PixiContext.performanceTelemetry = PixiContext.performanceTelemetry || {
    renderEvents: [],
    geometryEvents: [],
    hoverEvents: [],
    resizeEvents: [],
    renderReasons: Object.create(null),
    totalRenders: 0,
    totalRenderDurationMs: 0,
    maxRenderDurationMs: 0,
    rendersOverFrameBudget: 0,
    longTaskCount: 0,
    longTaskDurationMs: 0,
    maxLongTaskDurationMs: 0,
    resolutionChanges: 0,
    avoidedFocusRenders: 0,
    duplicateCameraSkips: 0,
    duplicateFocusSkips: 0,
    duplicateSelectionSkips: 0,
    duplicatePreviewSkips: 0,
    layoutCacheInvalidations: 0,
    endpointCacheHits: 0,
    endpointCacheMisses: 0,
    deviceSceneEndpointHits: 0,
    deviceSceneRebuilds: 0,
    deviceSceneSkippedRebuilds: 0,
    deviceChassisRebuilds: 0,
    deviceChassisAtlasBuilds: 0,
    deviceChassisSpriteCount: 0,
    deviceCullingPasses: 0,
    deviceCullingVisibilityChanges: 0,
    deviceCullingUnchangedSkips: 0,
    visibleDeviceRacks: 0,
    culledDeviceRacks: 0,
    devicePortRebuilds: 0,
    devicePortAtlasBuilds: 0,
    devicePortVariants: Object.create(null),
    deviceOccupancyFingerprintChecks: 0,
    deviceOccupancySetRebuilds: 0,
    deviceOccupancyOnlyUpdates: 0,
    devicePortStateChanges: 0,
    rackCacheHits: 0,
    rackCacheMisses: 0,
    organizerCacheHits: 0,
    organizerCacheMisses: 0,
    organizerOverlayRebuilds: 0,
    incrementalGeometryPasses: 0,
    incrementalCablesProcessed: 0,
    fullGeometryPasses: 0,
    incrementalRemovalPasses: 0,
    incrementalCablesRemoved: 0,
    avoidedRemovalGeometryPasses: 0,
    spatialIncrementalUpdates: 0,
    spatialIncrementalRemovals: 0,
    spatialFullRebuilds: 0,
    incrementalBatchUpdates: 0,
    fullBatchRebuilds: 0,
    incrementalStylePasses: 0,
    incrementalStyleCables: 0,
    partialColorBatchRebuilds: 0,
    partialColorBatchCablesProcessed: 0,
    avoidedFullStyleBatchRebuilds: 0,
    partialRackBatchRebuilds: 0,
    partialRemovalBatchCablesProcessed: 0,
    avoidedFullRemovalBatchRebuilds: 0,
    cullingPasses: 0,
    cullingBatchesTested: 0,
    cullingVisibilityChanges: 0,
    cullingUnchangedSkips: 0,
    visibleRackBatches: 0,
    culledRackBatches: 0,
    pointerHitTests: 0,
    pointerRectReads: 0,
    pointerRectCacheHits: 0,
    pointerRectInvalidations: 0,
    incrementalFocusPasses: 0,
    incrementalFocusCablesProcessed: 0,
    focusVariantCacheHits: 0,
    focusVariantCacheMisses: 0,
    focusFullDisplayScansAvoided: 0,
    batchTransactions: 0,
    transactionFlushes: 0,
    transactionCables: 0,
    transactionRendersAvoided: 0,
    maxTransactionSize: 0
  };

  // Wire getters/setters on PixiContext
  Object.defineProperty(PixiContext, 'pixiApp', { get: () => pixiApp, set: v => { pixiApp = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'pixiCanvas', { get: () => pixiCanvas, set: v => { pixiCanvas = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'cabinSceneContainer', { get: () => cabinSceneContainer, set: v => { cabinSceneContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'deviceSceneContainer', { get: () => deviceSceneContainer, set: v => { deviceSceneContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'cablesContainer', { get: () => cablesContainer, set: v => { cablesContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'connectorsContainer', { get: () => connectorsContainer, set: v => { connectorsContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'focusContainer', { get: () => focusContainer, set: v => { focusContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'organizerOverlayContainer', { get: () => organizerOverlayContainer, set: v => { organizerOverlayContainer = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'currentRenderResolution', { get: () => currentRenderResolution, set: v => { currentRenderResolution = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'interactionResolutionActive', { get: () => interactionResolutionActive, set: v => { interactionResolutionActive = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'lastWidth', { get: () => lastWidth, set: v => { lastWidth = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'lastHeight', { get: () => lastHeight, set: v => { lastHeight = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'lastWorldWidth', { get: () => lastWorldWidth, set: v => { lastWorldWidth = v; }, configurable: true });
  Object.defineProperty(PixiContext, 'lastWorldHeight', { get: () => lastWorldHeight, set: v => { lastWorldHeight = v; }, configurable: true });

  PixiContext.getCablesContainer = () => cablesContainer;
  PixiContext.getConnectorsContainer = () => connectorsContainer;
  PixiContext.getFocusContainer = () => focusContainer;
  PixiContext.getCabinSceneContainer = () => cabinSceneContainer;
  PixiContext.getDeviceSceneContainer = () => deviceSceneContainer;
  PixiContext.getPixiApp = () => pixiApp;
  PixiContext.getPixiCanvas = () => pixiCanvas;
  PixiContext.getPixiWorldViewportBounds = camera => getPixiWorldViewportBounds(camera);
  PixiContext.usesBatchedViewportRenderer = () => STATE.pixiViewportRendererV2 !== false;
  PixiContext.renderPixi = reason => renderPixi(reason);
  PixiContext.getPixiCanvasRect = () => getPixiCanvasRect();
  PixiContext.invalidatePixiCanvasRect = force => invalidatePixiCanvasRect(force);
  PixiContext.ensurePixiCanvas = (svgEl, parentContainer) => ensurePixiCanvas(svgEl, parentContainer);
  PixiContext.ensurePixiApp = (parentContainer, width, height) => ensurePixiApp(parentContainer, width, height);
  PixiContext.syncPixiViewportCamera = (camera, force, reason) => syncPixiViewportCamera(camera, force, reason);
  PixiContext.activateSvgFallback = () => showCanvasUnavailable();
  PixiContext.showCanvasUnavailable = () => showCanvasUnavailable();
  PixiContext.resetCameraSignature = () => { lastCameraSignature = null; };

  // Long task observer
  if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    try {
      const longTaskObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          performanceTelemetry.longTaskCount++;
          performanceTelemetry.longTaskDurationMs += entry.duration;
          performanceTelemetry.maxLongTaskDurationMs = Math.max(performanceTelemetry.maxLongTaskDurationMs, entry.duration);
        });
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (_) {}
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !pixiApp || STATE.cableRenderMode !== 'pixi') return;
      lastCameraSignature = null;
      syncPixiViewportCamera(RS.ZOOM_STATE, true, 'visibility-resume');
    });
  }

  function recordTimedEvent(events) {
    const now = performance.now();
    events.push(now);
    while (events.length && events[0] < now - 1000) events.shift();
  }

  function eventsPerSecond(events) {
    const now = performance.now();
    while (events.length && events[0] < now - 1000) events.shift();
    return events.length;
  }

  function calculatePixiResolution(width, height, interaction = interactionResolutionActive) {
    const profile = PIXI_PERFORMANCE_PROFILES[pixiPerformanceMode] || PIXI_PERFORMANCE_PROFILES.balanced;
    const requested = interaction ? profile.interactionResolution : profile.resolution;
    const pixelCap = Math.sqrt(profile.pixelBudget / Math.max(1, width * height));
    return Math.max(0.75, Math.round(Math.min(requested, pixelCap) * 4) / 4);
  }

  function renderPixi(reason = 'unspecified') {
    if (!pixiApp || (typeof document !== 'undefined' && document.hidden)) return false;
    const started = performance.now();
    performanceTelemetry.totalRenders++;
    performanceTelemetry.renderReasons[reason] = (performanceTelemetry.renderReasons[reason] || 0) + 1;
    recordTimedEvent(performanceTelemetry.renderEvents);
    pixiApp.render();
    const duration = performance.now() - started;
    performanceTelemetry.totalRenderDurationMs += duration;
    performanceTelemetry.maxRenderDurationMs = Math.max(performanceTelemetry.maxRenderDurationMs, duration);
    if (duration > 16.7) performanceTelemetry.rendersOverFrameBudget++;
    return true;
  }

  function applyPixiResolution(interaction = interactionResolutionActive, reason = 'resolution') {
    if (!pixiApp || !lastWidth || !lastHeight) return currentRenderResolution;
    const target = calculatePixiResolution(lastWidth, lastHeight, interaction);
    if (Math.abs(target - currentRenderResolution) < 0.1) return currentRenderResolution;
    pixiApp.renderer.resolution = target;
    pixiApp.renderer.resize(lastWidth, lastHeight);
    if (pixiCanvas) {
      pixiCanvas.style.width = '100%';
      pixiCanvas.style.height = '100%';
    }
    currentRenderResolution = target;
    performanceTelemetry.resolutionChanges++;
    renderPixi(reason);
    return currentRenderResolution;
  }

  function refreshPixiCanvasRect() {
    if (!pixiCanvas?.isConnected) {
      cachedCanvasRect = null;
      return null;
    }
    const rect = pixiCanvas.getBoundingClientRect();
    performanceTelemetry.pointerRectReads++;
    cachedCanvasRect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
    return cachedCanvasRect;
  }

  function getPixiCanvasRect() {
    if (activeViewportTransitions.size > 0) return refreshPixiCanvasRect();
    if (cachedCanvasRect?.width > 0 && cachedCanvasRect?.height > 0) {
      performanceTelemetry.pointerRectCacheHits++;
      return cachedCanvasRect;
    }
    return refreshPixiCanvasRect();
  }

  function invalidatePixiCanvasRect(force = false) {
    performanceTelemetry.pointerRectInvalidations++;
    cachedCanvasRect = null;
    if (force || activeViewportTransitions.size === 0) {
      if (canvasRectRefreshFrame) cancelAnimationFrame(canvasRectRefreshFrame);
      canvasRectRefreshFrame = requestAnimationFrame(() => {
        canvasRectRefreshFrame = 0;
        refreshPixiCanvasRect();
      });
    }
  }

  if (typeof document !== 'undefined') {
    window.addEventListener('resize', () => invalidatePixiCanvasRect(), { passive: true });
    window.addEventListener('scroll', () => invalidatePixiCanvasRect(), { passive: true, capture: true });
    const trackViewportTransition = (e, active) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target?.matches('#sidebar-left, #sidebar-right')) return;
      const key = `${target.id}:${e.propertyName || 'layout'}`;
      if (active) {
        activeViewportTransitions.add(key);
        invalidatePixiCanvasRect(false);
        return;
      }
      activeViewportTransitions.delete(key);
      if (activeViewportTransitions.size === 0) refreshPixiCanvasRect();
    };
    document.addEventListener('transitionrun', e => trackViewportTransition(e, true), { capture: true });
    document.addEventListener('transitionend', e => trackViewportTransition(e, false), { capture: true });
    document.addEventListener('transitioncancel', e => trackViewportTransition(e, false), { capture: true });
  }

  function ensurePixiCanvas(svgEl, parentContainer) {
    const viewportHost = document.getElementById('viewport-canvas') || parentContainer;
    const existingPlaceholder = document.getElementById('cables-pixi-canvas');
    if (pixiApp && pixiApp.canvas) {
      const realCanvas = pixiApp.canvas;
      realCanvas.id = 'cables-pixi-canvas';
      realCanvas.className = 'cables-pixi-layer';
      if (existingPlaceholder && existingPlaceholder !== realCanvas) {
        existingPlaceholder.remove();
      }
      if (STATE.pixiViewportRendererV2 !== false && viewportHost && realCanvas.parentNode !== viewportHost) {
        viewportHost.appendChild(realCanvas);
      } else if (STATE.pixiViewportRendererV2 === false && !realCanvas.isConnected) {
        if (svgEl && svgEl.parentNode) svgEl.parentNode.insertBefore(realCanvas, svgEl);
        else if (parentContainer) parentContainer.appendChild(realCanvas);
      }
      pixiCanvas = realCanvas;
    } else {
      let canvas = existingPlaceholder;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'cables-pixi-canvas';
        canvas.className = 'cables-pixi-layer';
        if (STATE.pixiViewportRendererV2 !== false && viewportHost) {
          viewportHost.appendChild(canvas);
        } else if (svgEl && svgEl.parentNode) {
          svgEl.parentNode.insertBefore(canvas, svgEl);
        } else if (parentContainer) {
          parentContainer.appendChild(canvas);
        }
      }
      pixiCanvas = canvas;
    }

    document.querySelectorAll('#cables-pixi-canvas').forEach(canvas => {
      if (canvas !== pixiCanvas) canvas.remove();
    });

    pixiCanvas.style.position = 'absolute';
    pixiCanvas.style.top = '0';
    pixiCanvas.style.left = '0';
    pixiCanvas.style.width = '100%';
    pixiCanvas.style.height = '100%';
    pixiCanvas.style.pointerEvents = 'none';
    pixiCanvas.style.zIndex = '10';
    pixiCanvas.style.imageRendering = 'auto';

    refreshPixiCanvasRect();
    RS.attachHitDetection?.(pixiCanvas);
    return pixiCanvas;
  }

  function getPixiWorldViewportBounds(camera = RS.ZOOM_STATE || {}) {
    const scale = Math.max(0.001, Number(camera.scale) || 1);
    const minX = -(camera.panX || 0) / scale - 160;
    const minY = -(camera.panY || 0) / scale - 160;
    const screenWidth = pixiApp?.renderer?.screen?.width || window.innerWidth || 1920;
    const screenHeight = pixiApp?.renderer?.screen?.height || window.innerHeight || 1080;
    return {
      minX,
      minY,
      maxX: minX + screenWidth / scale + 320,
      maxY: minY + screenHeight / scale + 320
    };
  }

  function syncPixiViewportCamera(camera = RS.ZOOM_STATE || {}, force = false, reason = 'camera') {
    if (!pixiApp || STATE.pixiViewportRendererV2 === false) return;
    const scale = Number.isFinite(camera.scale) ? camera.scale : 1;
    const screenW = pixiApp.renderer?.screen?.width || 0;
    const screenH = pixiApp.renderer?.screen?.height || 0;
    const cameraSignature = `${camera.panX || 0}:${camera.panY || 0}:${scale}:${screenW}:${screenH}`;
    if (!force && cameraSignature === lastCameraSignature) {
      performanceTelemetry.duplicateCameraSkips++;
      return false;
    }
    lastCameraSignature = cameraSignature;
    if (pixiCanvas) pixiCanvas.style.transform = 'none';
    pixiApp.stage.position.set(camera.panX || 0, camera.panY || 0);
    pixiApp.stage.scale.set(scale);

    const viewportBounds = getPixiWorldViewportBounds(camera);
    const { minX, minY, maxX, maxY } = viewportBounds;
    RS.applyDeviceViewportCulling?.(minX, minY, maxX, maxY);
    RS.PixiCabinScene?.applyCabinViewportCulling?.(minX, minY, maxX, maxY);

    let visibleBatches = 0;
    let culledBatches = 0;
    performanceTelemetry.cullingPasses++;
    const batchedRackGroups = PixiContext.batchedRackGroups || new Map();
    for (const rackGroup of batchedRackGroups.values()) {
      const cableBatch = rackGroup.cableBatch;
      const connectorBatch = rackGroup.connectorBatch;
      const bounds = cableBatch?.__worldBounds || connectorBatch?.__worldBounds;
      const visible = !bounds || (bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY);
      performanceTelemetry.cullingBatchesTested++;
      if (visible) visibleBatches++;
      else culledBatches++;
      [cableBatch, connectorBatch].forEach(batch => {
        if (!batch) return;
        if (batch.visible === visible) {
          performanceTelemetry.cullingUnchangedSkips++;
          return;
        }
        batch.visible = visible;
        performanceTelemetry.cullingVisibilityChanges++;
      });
    }
    performanceTelemetry.visibleRackBatches = visibleBatches;
    performanceTelemetry.culledRackBatches = culledBatches;
    return renderPixi(reason);
  }

  function observePixiViewport() {
    if (viewportResizeObserver || typeof ResizeObserver === 'undefined') return;
    const viewport = document.getElementById('viewport-canvas');
    if (!viewport) return;
    viewportResizeObserver = new ResizeObserver(() => {
      if (!pixiApp || STATE.cableRenderMode !== 'pixi') return;
      refreshPixiCanvasRect();
      const width = Math.max(1, Math.round(viewport.clientWidth));
      const height = Math.max(1, Math.round(viewport.clientHeight));
      if (width === lastWidth && height === lastHeight) return;
      recordTimedEvent(performanceTelemetry.resizeEvents);
      lastWidth = width;
      lastHeight = height;
      const targetResolution = calculatePixiResolution(width, height, interactionResolutionActive);
      if (Math.abs(targetResolution - currentRenderResolution) >= 0.1) {
        pixiApp.renderer.resolution = targetResolution;
        currentRenderResolution = targetResolution;
        performanceTelemetry.resolutionChanges++;
      }
      pixiApp.renderer.resize(width, height);
      if (pixiCanvas) {
        pixiCanvas.style.width = '100%';
        pixiCanvas.style.height = '100%';
      }
      syncPixiViewportCamera(RS.ZOOM_STATE, true, 'resize');
    });
    viewportResizeObserver.observe(viewport);
  }

  async function ensurePixiApp(parentContainer, width, height) {
    if (pixiApp) return pixiApp;
    if (initPromise) return initPromise;
    if (typeof window.PIXI === 'undefined' || !window.PIXI.Application) return null;

    isInitializing = true;
    initPromise = (async () => {
      try {
        const app = new window.PIXI.Application();
        const initialResolution = calculatePixiResolution(width, height, false);
        currentRenderResolution = initialResolution;
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          resolution: initialResolution,
          autoDensity: true,
          antialias: true,
          autoStart: false,
          sharedTicker: false,
          eventMode: 'none',
          eventFeatures: { move: false, globalMove: false, click: true, wheel: false }
        });

        pixiApp = app;
        isInitializing = false;
        lastWidth = width;
        lastHeight = height;

        cabinSceneContainer = new window.PIXI.Container();
        cabinSceneContainer.label = 'cabin-scenes';
        cabinSceneContainer.eventMode = 'none';

        deviceSceneContainer = new window.PIXI.Container();
        deviceSceneContainer.label = 'device-scenes';
        deviceSceneContainer.eventMode = 'none';

        cablesContainer = new window.PIXI.Container();
        cablesContainer.label = 'cables';
        cablesContainer.eventMode = 'none';

        connectorsContainer = new window.PIXI.Container();
        connectorsContainer.label = 'connectors';
        connectorsContainer.eventMode = 'none';

        focusContainer = new window.PIXI.Container();
        focusContainer.label = 'focus-layer';
        focusContainer.eventMode = 'none';

        organizerOverlayContainer = new window.PIXI.Container();
        organizerOverlayContainer.label = 'organizer-overlays';
        organizerOverlayContainer.eventMode = 'none';

        app.stage.eventMode = 'none';
        app.stage.addChild(cabinSceneContainer);
        app.stage.addChild(deviceSceneContainer);
        app.stage.addChild(cablesContainer);
        app.stage.addChild(connectorsContainer);
        app.stage.addChild(focusContainer);
        app.stage.addChild(organizerOverlayContainer);

        const svgEl = document.getElementById('cables-svg');
        ensurePixiCanvas(svgEl, parentContainer);
        observePixiViewport();
        return pixiApp;
      } catch (err) {
        console.warn('RackStudio: PixiJS canvas is unavailable', err);
        isInitializing = false;
        initPromise = null;
        pixiApp = null;
        showCanvasUnavailable();
        return null;
      }
    })();
    return initPromise;
  }

  function showCanvasUnavailable() {
    STATE.cableRenderMode = 'pixi';
    try { localStorage.removeItem('rackstudio_cable_mode'); } catch (_) {}
    document.documentElement.setAttribute('data-device-renderer', 'pixi');
    document.documentElement.setAttribute('data-canvas-state', 'unavailable');
    if (pixiCanvas) {
      pixiCanvas.style.display = 'none';
      pixiCanvas.style.pointerEvents = 'none';
    }
    const svgEl = document.getElementById('cables-svg');
    if (svgEl) svgEl.style.display = 'none';
    const host = document.getElementById('viewport-canvas') || document.body;
    let banner = document.getElementById('canvas-unavailable');
    if (!banner && host) {
      banner = document.createElement('div');
      banner.id = 'canvas-unavailable';
      banner.className = 'canvas-unavailable-banner';
      banner.textContent = 'Canvas unavailable';
      host.appendChild(banner);
    }
    if (banner) banner.hidden = false;
  }

  // Exports
  RS.PixiViewport = {
    renderPixi,
    applyPixiResolution,
    calculatePixiResolution,
    refreshPixiCanvasRect,
    getPixiCanvasRect,
    invalidatePixiCanvasRect,
    ensurePixiCanvas,
    ensurePixiApp,
    syncPixiViewportCamera,
    getPixiWorldViewportBounds,
    showCanvasUnavailable,
    activateSvgFallback: showCanvasUnavailable,
    recordTimedEvent,
    eventsPerSecond
  };

  RS.syncPixiViewportCamera = syncPixiViewportCamera;
  RS.getOrCreatePixiCanvas = (parentContainer, width, height) => {
    const svgEl = document.getElementById('cables-svg');
    return ensurePixiCanvas(svgEl, parentContainer);
  };
  RS.invalidatePixiPointerBounds = () => invalidatePixiCanvasRect();
  RS.updatePixiResolutionForZoom = () => applyPixiResolution(false, 'zoom-settled');
  RS.setPixiInteractionMode = (active, deferRender = false) => {
    interactionResolutionActive = !!active;
    if (!deferRender) return applyPixiResolution(interactionResolutionActive, active ? 'interaction-start' : 'interaction-end');
    if (!pixiApp || !lastWidth || !lastHeight) return currentRenderResolution;
    const target = calculatePixiResolution(lastWidth, lastHeight, interactionResolutionActive);
    if (Math.abs(target - currentRenderResolution) < 0.1) return currentRenderResolution;
    pixiApp.renderer.resolution = target;
    pixiApp.renderer.resize(lastWidth, lastHeight);
    currentRenderResolution = target;
    performanceTelemetry.resolutionChanges++;
    return currentRenderResolution;
  };
  RS.setPixiPerformanceMode = mode => {
    if (!Object.hasOwn(PIXI_PERFORMANCE_PROFILES, mode)) return false;
    pixiPerformanceMode = mode;
    document.documentElement.setAttribute('data-2d-performance', mode);
    try { localStorage.setItem('rackstudio_2d_performance_mode', mode); } catch (_) {}
    applyPixiResolution(interactionResolutionActive, 'profile-change');
    return true;
  };
  RS.getPixiPerformanceTelemetry = () => {
    const resolution = pixiApp?.renderer?.resolution || currentRenderResolution || 0;
    const framebufferWidth = Math.round(lastWidth * resolution);
    const framebufferHeight = Math.round(lastHeight * resolution);
    const deviceVariantCounts = PixiContext.getDevicePortVariantCounts ? Object.fromEntries(PixiContext.getDevicePortVariantCounts()) : {};
    return {
      profile: pixiPerformanceMode,
      interactionMode: interactionResolutionActive,
      rendersPerSecond: eventsPerSecond(performanceTelemetry.renderEvents),
      geometryPassesPerSecond: eventsPerSecond(performanceTelemetry.geometryEvents),
      hoverChangesPerSecond: eventsPerSecond(performanceTelemetry.hoverEvents),
      resizeEventsPerSecond: eventsPerSecond(performanceTelemetry.resizeEvents),
      totalRenders: performanceTelemetry.totalRenders,
      averageRenderDurationMs: performanceTelemetry.totalRenders
        ? performanceTelemetry.totalRenderDurationMs / performanceTelemetry.totalRenders
        : 0,
      maxRenderDurationMs: performanceTelemetry.maxRenderDurationMs,
      rendersOverFrameBudget: performanceTelemetry.rendersOverFrameBudget,
      longTaskCount: performanceTelemetry.longTaskCount,
      longTaskDurationMs: performanceTelemetry.longTaskDurationMs,
      maxLongTaskDurationMs: performanceTelemetry.maxLongTaskDurationMs,
      resolutionChanges: performanceTelemetry.resolutionChanges,
      avoidedFocusRenders: performanceTelemetry.avoidedFocusRenders,
      duplicateCameraSkips: performanceTelemetry.duplicateCameraSkips,
      duplicateFocusSkips: performanceTelemetry.duplicateFocusSkips,
      duplicateSelectionSkips: performanceTelemetry.duplicateSelectionSkips,
      duplicatePreviewSkips: performanceTelemetry.duplicatePreviewSkips,
      layoutCacheInvalidations: performanceTelemetry.layoutCacheInvalidations,
      endpointCacheHits: performanceTelemetry.endpointCacheHits,
      endpointCacheMisses: performanceTelemetry.endpointCacheMisses,
      deviceSceneEndpointHits: performanceTelemetry.deviceSceneEndpointHits,
      deviceSceneRebuilds: performanceTelemetry.deviceSceneRebuilds,
      deviceSceneSkippedRebuilds: performanceTelemetry.deviceSceneSkippedRebuilds,
      deviceChassisRebuilds: performanceTelemetry.deviceChassisRebuilds,
      deviceChassisAtlasBuilds: performanceTelemetry.deviceChassisAtlasBuilds,
      deviceChassisSpriteCount: performanceTelemetry.deviceChassisSpriteCount,
      deviceCullingPasses: performanceTelemetry.deviceCullingPasses,
      deviceCullingVisibilityChanges: performanceTelemetry.deviceCullingVisibilityChanges,
      deviceCullingUnchangedSkips: performanceTelemetry.deviceCullingUnchangedSkips,
      visibleDeviceRacks: performanceTelemetry.visibleDeviceRacks,
      culledDeviceRacks: performanceTelemetry.culledDeviceRacks,
      devicePortRebuilds: performanceTelemetry.devicePortRebuilds,
      devicePortAtlasBuilds: performanceTelemetry.devicePortAtlasBuilds,
      devicePortVariants: deviceVariantCounts,
      deviceOccupancyFingerprintChecks: performanceTelemetry.deviceOccupancyFingerprintChecks,
      deviceOccupancySetRebuilds: performanceTelemetry.deviceOccupancySetRebuilds,
      deviceOccupancyOnlyUpdates: performanceTelemetry.deviceOccupancyOnlyUpdates,
      devicePortStateChanges: performanceTelemetry.devicePortStateChanges,
      rackCacheHits: performanceTelemetry.rackCacheHits,
      rackCacheMisses: performanceTelemetry.rackCacheMisses,
      organizerCacheHits: performanceTelemetry.organizerCacheHits,
      organizerCacheMisses: performanceTelemetry.organizerCacheMisses,
      organizerOverlayRebuilds: performanceTelemetry.organizerOverlayRebuilds,
      incrementalGeometryPasses: performanceTelemetry.incrementalGeometryPasses,
      incrementalCablesProcessed: performanceTelemetry.incrementalCablesProcessed,
      fullGeometryPasses: performanceTelemetry.fullGeometryPasses,
      incrementalRemovalPasses: performanceTelemetry.incrementalRemovalPasses,
      incrementalCablesRemoved: performanceTelemetry.incrementalCablesRemoved,
      avoidedRemovalGeometryPasses: performanceTelemetry.avoidedRemovalGeometryPasses,
      spatialIncrementalUpdates: performanceTelemetry.spatialIncrementalUpdates,
      spatialIncrementalRemovals: performanceTelemetry.spatialIncrementalRemovals,
      spatialFullRebuilds: performanceTelemetry.spatialFullRebuilds,
      incrementalBatchUpdates: performanceTelemetry.incrementalBatchUpdates,
      fullBatchRebuilds: performanceTelemetry.fullBatchRebuilds,
      incrementalStylePasses: performanceTelemetry.incrementalStylePasses,
      incrementalStyleCables: performanceTelemetry.incrementalStyleCables,
      partialColorBatchRebuilds: performanceTelemetry.partialColorBatchRebuilds,
      partialColorBatchCablesProcessed: performanceTelemetry.partialColorBatchCablesProcessed,
      avoidedFullStyleBatchRebuilds: performanceTelemetry.avoidedFullStyleBatchRebuilds,
      partialRackBatchRebuilds: performanceTelemetry.partialRackBatchRebuilds,
      partialRemovalBatchCablesProcessed: performanceTelemetry.partialRemovalBatchCablesProcessed,
      avoidedFullRemovalBatchRebuilds: performanceTelemetry.avoidedFullRemovalBatchRebuilds,
      cullingPasses: performanceTelemetry.cullingPasses,
      cullingBatchesTested: performanceTelemetry.cullingBatchesTested,
      cullingVisibilityChanges: performanceTelemetry.cullingVisibilityChanges,
      cullingUnchangedSkips: performanceTelemetry.cullingUnchangedSkips,
      visibleRackBatches: performanceTelemetry.visibleRackBatches,
      culledRackBatches: performanceTelemetry.culledRackBatches,
      pointerHitTests: performanceTelemetry.pointerHitTests,
      pointerRectReads: performanceTelemetry.pointerRectReads,
      pointerRectCacheHits: performanceTelemetry.pointerRectCacheHits,
      pointerRectInvalidations: performanceTelemetry.pointerRectInvalidations,
      incrementalFocusPasses: performanceTelemetry.incrementalFocusPasses,
      incrementalFocusCablesProcessed: performanceTelemetry.incrementalFocusCablesProcessed,
      focusVariantCacheHits: performanceTelemetry.focusVariantCacheHits,
      focusVariantCacheMisses: performanceTelemetry.focusVariantCacheMisses,
      focusFullDisplayScansAvoided: performanceTelemetry.focusFullDisplayScansAvoided,
      batchTransactions: performanceTelemetry.batchTransactions,
      transactionFlushes: performanceTelemetry.transactionFlushes,
      transactionCables: performanceTelemetry.transactionCables,
      transactionRendersAvoided: performanceTelemetry.transactionRendersAvoided,
      maxTransactionSize: performanceTelemetry.maxTransactionSize,
      pendingTransactionCables: PixiContext.queuedTransactionCableIds?.size || 0,
      cableTransactionDepth: PixiContext.cableTransactionDepth || 0,
      retainedEndpointCount: RS.PixiCableGeometry?.endpointWorldCache?.size || 0,
      retainedRackGeometryCount: RS.PixiCableGeometry?.rackRailWorldCache?.size || 0,
      retainedOrganizerCount: RS.PixiCableGeometry?.organizerWorldYCache?.size || 0,
      renderReasons: { ...performanceTelemetry.renderReasons },
      resolution,
      framebufferWidth,
      framebufferHeight,
      framebufferPixels: framebufferWidth * framebufferHeight,
      framebufferMegapixels: Number(((framebufferWidth * framebufferHeight) / 1_000_000).toFixed(2)),
      pixelBudget: PIXI_PERFORMANCE_PROFILES[pixiPerformanceMode].pixelBudget,
      staticIdle: eventsPerSecond(performanceTelemetry.renderEvents) === 0
    };
  };
})();
