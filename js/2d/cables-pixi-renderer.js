/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS v8 GPU Cabling Layer
 * High-performance WebGL/WebGPU cable rendering with sub-pixel Retina sharpness,
 * zero DOM overhead, and interactive hit-testing.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const computeCableLength = (...args) => (RS.computeCableLength ? RS.computeCableLength(...args) : 1.5);
  const findDeviceOrganizer = (...args) => (RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : null);
  const resolveCableDuctSide = (...args) => (RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : false);
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const setCableHover = (...args) => RS.setCableHover && RS.setCableHover(...args);
  const showCableQuickHud = (...args) => RS.showCableQuickHud && RS.showCableQuickHud(...args);
  const showCableContextMenu = (...args) => RS.showCableContextMenu && RS.showCableContextMenu(...args);
  const showCableTooltip = (...args) => RS.showCableTooltip && RS.showCableTooltip(...args);
  const renameCable2D = (...args) => RS.renameCable2D && RS.renameCable2D(...args);

  let pixiApp = null;
  let pixiCanvas = null;
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
  let currentRenderResolution = 0;
  let interactionResolutionActive = false;
  let lastCameraSignature = null;
  let lastSelectionCableId = null;
  let hoveredCableId = null;
  let groupHoveredCableIds = new Set();
  let lastSceneSignature = null;
  let lastLayoutSignature = null;
  let layoutCacheWasExplicitlyInvalidated = false;
  let lastVisibleCableOrder = [];
  let lastChannelUsage = { left: 0, right: 0 };
  let cableTransactionDepth = 0;
  const queuedTransactionCableIds = new Set();
  const cableDisplays = new Map();
  const batchedRackGroups = new Map();
  const spatialGrid = new Map();
  const spatialMembership = new Map();
  const endpointWorldCache = new Map();
  const rackRailWorldCache = new Map();
  const organizerWorldYCache = new Map();
  // Reused for every pointer sample. Allocating a Set at pointer frequency
  // creates avoidable young-generation GC pressure on dense cable scenes.
  const hitCandidates = new Set();
  const SPATIAL_CELL_SIZE = 32;
  const CABLE_VISUAL_STYLE = Object.freeze({
    casingWidth: 4.8,
    coreWidth: 2.6,
    railSpacing: 3.2,
    traySpacing: 2.8
  });
  const renderStats = {
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
  document.documentElement.setAttribute('data-2d-performance', pixiPerformanceMode);
  const performanceTelemetry = {
    renderEvents: [],
    geometryEvents: [],
    hoverEvents: [],
    resizeEvents: [],
    renderReasons: Object.create(null),
    totalRenders: 0,
    resolutionChanges: 0,
    avoidedFocusRenders: 0,
    duplicateCameraSkips: 0,
    duplicateFocusSkips: 0,
    duplicateSelectionSkips: 0,
    duplicatePreviewSkips: 0,
    layoutCacheInvalidations: 0,
    endpointCacheHits: 0,
    endpointCacheMisses: 0,
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
    batchTransactions: 0,
    transactionFlushes: 0,
    transactionCables: 0,
    transactionRendersAvoided: 0,
    maxTransactionSize: 0
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !pixiApp || STATE.cableRenderMode !== 'pixi') return;
    lastCameraSignature = null;
    syncPixiViewportCamera(RS.ZOOM_STATE, true, 'visibility-resume');
  });

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
    if (!pixiApp || document.hidden) return false;
    performanceTelemetry.totalRenders++;
    performanceTelemetry.renderReasons[reason] = (performanceTelemetry.renderReasons[reason] || 0) + 1;
    recordTimedEvent(performanceTelemetry.renderEvents);
    pixiApp.render();
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

  const usesBatchedViewportRenderer = () => STATE.pixiViewportRendererV2 !== false;

  function endpointSignature(endpoint = {}) {
    return [endpoint.rackId || '', endpoint.instanceId || endpoint.deviceId || '', endpoint.portId || endpoint.portIdx || ''].join(':');
  }

  function cableGeometrySignature(cable) {
    return [
      endpointSignature(cable.from), endpointSignature(cable.to),
      cable.ductSide || 'auto', STATE.cableRoutingMode || 'structured'
    ].join('|');
  }

  function buildSceneSignature(stageW, stageH, isMulti, activeRack) {
    const racks = (STATE.racks || []).map(rack => [
      rack.id, rack.heightU || 42,
      (rack.devices || []).map(device => [
        device.instanceId, device.catalogKey, device.topU, device.uHeight || 1
      ].join(':')).join(',')
    ].join('/')).join(';');
    const cableOrder = (STATE.cables || []).map(cable => cable.id).join(',');
    return [stageW, stageH, isMulti ? 'multi' : 'single', activeRack?.id || '', STATE.cableRoutingMode || 'structured', racks, cableOrder].join('||');
  }

  function buildLayoutSignature(stageW, stageH, isMulti, activeRack) {
    const racks = (STATE.racks || []).map((rack, rackIndex) => [
      rackIndex, rack.id, rack.heightU || 42,
      (rack.devices || []).map(device => [
        device.instanceId, device.catalogKey || device.catalogId,
        device.topU, device.uHeight || 1, device.face || 'front'
      ].join(':')).join(',')
    ].join('/')).join(';');
    return [stageW, stageH, isMulti ? 'multi' : 'single', activeRack?.id || '', racks].join('||');
  }

  function invalidateLayoutGeometryCache() {
    endpointWorldCache.clear();
    rackRailWorldCache.clear();
    organizerWorldYCache.clear();
    lastLayoutSignature = null;
    lastSceneSignature = null;
    lastVisibleCableOrder = [];
    lastChannelUsage = { left: 0, right: 0 };
    layoutCacheWasExplicitlyInvalidated = true;
    performanceTelemetry.layoutCacheInvalidations++;
  }

  function destroyCableDisplay(display) {
    if (!display) return;
    if (usesBatchedViewportRenderer()) {
      renderStats.destroyedDisplays++;
      return;
    }
    [display.glow, display.casing, display.core, ...(display.boots || [])].forEach(graphic => {
      if (!graphic) return;
      graphic.parent?.removeChild(graphic);
      graphic.destroy?.();
    });
    renderStats.destroyedDisplays++;
  }

  function hexColorToNumber(hex) {
    if (!hex) return 0x2563eb;
    const clean = String(hex).replace('#', '').trim();
    if (clean.length === 3) {
      const r = clean[0] + clean[0];
      const g = clean[1] + clean[1];
      const b = clean[2] + clean[2];
      const parsed = parseInt(r + g + b, 16);
      return Number.isNaN(parsed) ? 0x2563eb : parsed;
    }
    const parsed = parseInt(clean, 16);
    return Number.isNaN(parsed) ? 0x2563eb : parsed;
  }

  // Keep GPU and SVG routing visually identical. The tier phase is used for
  // same-rack bundles exactly as in cables-svg-renderer.js.
  function svgRailOffset(index, tiered = true) {
    const lane = (index % 9) - 4;
    const tier = tiered ? (Math.floor(index / 9) % 2) : 0;
    return lane * CABLE_VISUAL_STYLE.railSpacing + tier;
  }

  function svgTrayOffset(index, tiered = true) {
    const lane = (index % 7) - 3;
    const tier = tiered ? (Math.floor(index / 7) % 2) * 0.9 : 0;
    return lane * CABLE_VISUAL_STYLE.traySpacing + tier;
  }

  function parseSvgPathD(graphics, pathD) {
    if (!pathD) return;
    const commands = pathD.match(/[MLCQZ][^MLCQZ]*/gi) || [];
    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
      if (type === 'M' || type === 'm') {
        graphics.moveTo(args[0], args[1]);
      } else if (type === 'L' || type === 'l') {
        graphics.lineTo(args[0], args[1]);
      } else if (type === 'Q' || type === 'q') {
        graphics.quadraticCurveTo(args[0], args[1], args[2], args[3]);
      } else if (type === 'C' || type === 'c') {
        graphics.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
      } else if (type === 'Z' || type === 'z') {
        graphics.closePath();
      }
    }
  }

  function destroyContainerChildren(container) {
    if (!container) return;
    container.removeChildren().forEach(child => {
      child.filters?.forEach(filter => filter.destroy?.());
      child.destroy?.();
    });
  }

  function appendConnector(graphics, point, color, focused = false) {
    if (!point) return;
    const radius = focused ? 3.8 : 3.4;
    const pinRadius = focused ? 1.4 : 1.2;
    graphics.circle(point.x, point.y, radius)
      .fill(0x090d16)
      .stroke({ width: focused ? 1.8 : 1.6, color, alignment: 0.5 });
    graphics.circle(point.x, point.y, pinRadius).fill(color);
  }

  function rebuildBatchedBase() {
    if (!usesBatchedViewportRenderer() || !cablesContainer || !connectorsContainer) return;
    destroyContainerChildren(cablesContainer);
    destroyContainerChildren(connectorsContainer);
    batchedRackGroups.clear();
    const byRack = new Map();
    for (const display of cableDisplays.values()) {
      const rackKey = display.rackKey || '__cross__';
      let rackGroup = byRack.get(rackKey);
      if (!rackGroup) {
        rackGroup = { displays: [], byColor: new Map() };
        byRack.set(rackKey, rackGroup);
      }
      rackGroup.displays.push(display);
      const color = display.colorNum;
      let group = rackGroup.byColor.get(color);
      if (!group) {
        group = { core: new window.PIXI.Graphics(), connectors: new window.PIXI.Graphics(), badges: [] };
        group.core.eventMode = 'none';
        group.connectors.eventMode = 'none';
        rackGroup.byColor.set(color, group);
      }
      parseSvgPathD(group.core, display.pathD);
      display.endpoints.forEach(point => appendConnector(group.connectors, point, color, false));
      if (display.isStub && display.stubPoint && display.stubBadgeText) {
        const destX = display.stubPoint.x;
        const destY = display.stubPoint.y;
        const badgeW = Math.max(76, display.stubBadgeText.length * 6.5 + 16);
        const badgeH = 18;
        const bx = display.isRightExit ? destX + 4 : destX - badgeW - 4;
        const by = destY - badgeH / 2;
        group.connectors.roundRect(bx, by, badgeW, badgeH, 4)
          .fill(0x0f172a)
          .stroke({ width: 1.2, color });
        if (window.PIXI && window.PIXI.Text) {
          try {
            const textObj = new window.PIXI.Text({
              text: display.stubBadgeText,
              style: {
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: 9,
                fontWeight: '600',
                fill: 0xe2e8f0
              }
            });
            textObj.x = bx + badgeW / 2;
            textObj.y = by + 2;
            textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
            group.badges.push(textObj);
          } catch (_) {
            try {
              const textObj = new window.PIXI.Text(display.stubBadgeText, {
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: 9,
                fontWeight: '600',
                fill: 0xe2e8f0
              });
              textObj.x = bx + badgeW / 2;
              textObj.y = by + 2;
              textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
              group.badges.push(textObj);
            } catch (_) {}
          }
        }
      }
    }
    byRack.forEach((rackGroup, rackKey) => {
      const cableBatch = new window.PIXI.Container();
      const connectorBatch = new window.PIXI.Container();
      cableBatch.__rackId = connectorBatch.__rackId = rackKey;
      const points = rackGroup.displays.flatMap(display => display.endpoints || []);
      const bounds = points.length ? {
        minX: Math.min(...points.map(point => point.x)) - 180,
        minY: Math.min(...points.map(point => point.y)) - 180,
        maxX: Math.max(...points.map(point => point.x)) + 180,
        maxY: Math.max(...points.map(point => point.y)) + 180
      } : null;
      cableBatch.__worldBounds = connectorBatch.__worldBounds = bounds;
      const casing = new window.PIXI.Graphics();
      casing.eventMode = 'none';
      rackGroup.displays.forEach(display => parseSvgPathD(casing, display.pathD));
      casing.stroke({ width: CABLE_VISUAL_STYLE.casingWidth, color: 0x060913, alpha: 1, cap: 'round', join: 'round' });
      cableBatch.addChild(casing);
      rackGroup.byColor.forEach((group, color) => {
        group.core.stroke({ width: CABLE_VISUAL_STYLE.coreWidth, color, alpha: 1, cap: 'round', join: 'round' });
        cableBatch.addChild(group.core);
        connectorBatch.addChild(group.connectors);
        if (group.badges && group.badges.length) {
          group.badges.forEach(b => connectorBatch.addChild(b));
        }
      });
      cablesContainer.addChild(cableBatch);
      connectorsContainer.addChild(connectorBatch);
      rackGroup.cableBatch = cableBatch;
      rackGroup.connectorBatch = connectorBatch;
      rackGroup.casing = casing;
      batchedRackGroups.set(rackKey, rackGroup);
    });
    renderStats.batchRebuilds++;
    performanceTelemetry.fullBatchRebuilds++;
    renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
  }

  function appendBatchedDisplays(cableIds) {
    if (!usesBatchedViewportRenderer() || !cableIds.size) return false;
    const pending = [];
    for (const cableId of cableIds) {
      const display = cableDisplays.get(cableId);
      const rackGroup = display && batchedRackGroups.get(display.rackKey || '__cross__');
      if (!display || display.isStub || !rackGroup?.casing || !rackGroup.cableBatch || !rackGroup.connectorBatch) return false;
      pending.push({ display, rackGroup });
    }
    for (const { display, rackGroup } of pending) {
      parseSvgPathD(rackGroup.casing, display.pathD);
      rackGroup.casing.stroke({ width: CABLE_VISUAL_STYLE.casingWidth, color: 0x060913, alpha: 1, cap: 'round', join: 'round' });
      let group = rackGroup.byColor.get(display.colorNum);
      if (!group) {
        group = { core: new window.PIXI.Graphics(), connectors: new window.PIXI.Graphics(), badges: [] };
        group.core.eventMode = 'none';
        group.connectors.eventMode = 'none';
        rackGroup.byColor.set(display.colorNum, group);
        rackGroup.cableBatch.addChild(group.core);
        rackGroup.connectorBatch.addChild(group.connectors);
      }
      parseSvgPathD(group.core, display.pathD);
      group.core.stroke({ width: CABLE_VISUAL_STYLE.coreWidth, color: display.colorNum, alpha: 1, cap: 'round', join: 'round' });
      display.endpoints.forEach(point => appendConnector(group.connectors, point, display.colorNum, false));
      rackGroup.displays.push(display);
      const bounds = rackGroup.cableBatch.__worldBounds;
      if (bounds) {
        display.endpoints.forEach(point => {
          bounds.minX = Math.min(bounds.minX, point.x - 180);
          bounds.minY = Math.min(bounds.minY, point.y - 180);
          bounds.maxX = Math.max(bounds.maxX, point.x + 180);
          bounds.maxY = Math.max(bounds.maxY, point.y + 180);
        });
      }
    }
    performanceTelemetry.incrementalBatchUpdates += pending.length;
    renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
    return true;
  }

  function createStubBadge(display, group, color) {
    if (!display.isStub || !display.stubPoint || !display.stubBadgeText) return;
    const destX = display.stubPoint.x;
    const destY = display.stubPoint.y;
    const badgeW = Math.max(76, display.stubBadgeText.length * 6.5 + 16);
    const badgeH = 18;
    const bx = display.isRightExit ? destX + 4 : destX - badgeW - 4;
    const by = destY - badgeH / 2;
    group.connectors.roundRect(bx, by, badgeW, badgeH, 4)
      .fill(0x0f172a)
      .stroke({ width: 1.2, color });
    if (!window.PIXI?.Text) return;
    try {
      const textObj = new window.PIXI.Text({
        text: display.stubBadgeText,
        style: { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 9, fontWeight: '600', fill: 0xe2e8f0 }
      });
      textObj.x = bx + badgeW / 2;
      textObj.y = by + 2;
      textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
      group.badges.push(textObj);
    } catch (_) {
      try {
        const textObj = new window.PIXI.Text(display.stubBadgeText, {
          fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 9, fontWeight: '600', fill: 0xe2e8f0
        });
        textObj.x = bx + badgeW / 2;
        textObj.y = by + 2;
        textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
        group.badges.push(textObj);
      } catch (_) {}
    }
  }

  function rebuildBatchedStyleGroups(previousColorsByCableId) {
    if (!usesBatchedViewportRenderer() || !previousColorsByCableId.size) return false;
    const affectedByRack = new Map();
    for (const [cableId, previousColor] of previousColorsByCableId) {
      const display = cableDisplays.get(cableId);
      const rackKey = display?.rackKey || '__cross__';
      const rackGroup = batchedRackGroups.get(rackKey);
      if (!display || !rackGroup?.cableBatch || !rackGroup.connectorBatch) return false;
      if (!affectedByRack.has(rackKey)) affectedByRack.set(rackKey, new Set());
      affectedByRack.get(rackKey).add(previousColor);
      affectedByRack.get(rackKey).add(display.colorNum);
    }

    let processedDisplays = 0;
    for (const [rackKey, colors] of affectedByRack) {
      const rackGroup = batchedRackGroups.get(rackKey);
      for (const color of colors) {
        const previousGroup = rackGroup.byColor.get(color);
        if (previousGroup) {
          previousGroup.core?.parent?.removeChild(previousGroup.core);
          previousGroup.connectors?.parent?.removeChild(previousGroup.connectors);
          previousGroup.badges?.forEach(badge => {
            badge.parent?.removeChild(badge);
            badge.destroy?.();
          });
          previousGroup.core?.destroy?.();
          previousGroup.connectors?.destroy?.();
          rackGroup.byColor.delete(color);
        }
        const displays = rackGroup.displays.filter(display => display.colorNum === color);
        if (!displays.length) continue;
        const group = { core: new window.PIXI.Graphics(), connectors: new window.PIXI.Graphics(), badges: [] };
        group.core.eventMode = 'none';
        group.connectors.eventMode = 'none';
        displays.forEach(display => {
          parseSvgPathD(group.core, display.pathD);
          display.endpoints.forEach(point => appendConnector(group.connectors, point, color, false));
          createStubBadge(display, group, color);
        });
        group.core.stroke({ width: CABLE_VISUAL_STYLE.coreWidth, color, alpha: 1, cap: 'round', join: 'round' });
        rackGroup.cableBatch.addChild(group.core);
        rackGroup.connectorBatch.addChild(group.connectors);
        group.badges.forEach(badge => rackGroup.connectorBatch.addChild(badge));
        rackGroup.byColor.set(color, group);
        processedDisplays += displays.length;
      }
    }
    performanceTelemetry.partialColorBatchRebuilds += Array.from(affectedByRack.values()).reduce((sum, colors) => sum + colors.size, 0);
    performanceTelemetry.partialColorBatchCablesProcessed += processedDisplays;
    performanceTelemetry.avoidedFullStyleBatchRebuilds++;
    renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
    return true;
  }

  function rebuildBatchedFocus() {
    if (!usesBatchedViewportRenderer() || !focusContainer) return;
    destroyContainerChildren(focusContainer);
    const hasHoverFocus = hoveredCableId !== null || groupHoveredCableIds.size > 0;
    cablesContainer.alpha = hasHoverFocus ? 0.14 : 1;
    connectorsContainer.alpha = hasHoverFocus ? 0.14 : 1;
    const focusIds = new Set(groupHoveredCableIds);
    if (hoveredCableId) focusIds.add(hoveredCableId);
    if (!hasHoverFocus && STATE.highlightedCableId) focusIds.add(STATE.highlightedCableId);
    if (!focusIds.size) {
      renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length;
      return;
    }
    const casing = new window.PIXI.Graphics();
    const glowByColor = new Map();
    const coreByColor = new Map();
    const bootsByColor = new Map();
    casing.eventMode = 'none';
    for (const id of focusIds) {
      const display = cableDisplays.get(id);
      if (!display) continue;
      const color = display.previewColorNum ?? display.colorNum;
      let glow = glowByColor.get(color);
      if (!glow) {
        glow = new window.PIXI.Graphics();
        glow.eventMode = 'none';
        glowByColor.set(color, glow);
      }
      parseSvgPathD(glow, display.pathD);
      parseSvgPathD(casing, display.pathD);
      let core = coreByColor.get(color);
      if (!core) {
        core = new window.PIXI.Graphics();
        core.eventMode = 'none';
        coreByColor.set(color, core);
      }
      parseSvgPathD(core, display.pathD);
      let boots = bootsByColor.get(color);
      if (!boots) {
        boots = new window.PIXI.Graphics();
        boots.eventMode = 'none';
        bootsByColor.set(color, boots);
      }
      display.endpoints.forEach(point => appendConnector(boots, point, color, true));
    }
    const selectedOnly = !hasHoverFocus && !!STATE.highlightedCableId;
    casing.stroke({ width: selectedOnly ? 5.8 : 5.4, color: 0x060913, alpha: 1, cap: 'round', join: 'round' });
    glowByColor.forEach((glow, color) => {
      glow.stroke({ width: selectedOnly ? 9 : 8, color, alpha: selectedOnly ? 0.72 : 0.62, cap: 'round', join: 'round' });
      glow.blendMode = 'add';
      focusContainer.addChild(glow);
    });
    focusContainer.addChild(casing);
    coreByColor.forEach((core, color) => {
      core.stroke({ width: selectedOnly ? 3.5 : 3.2, color, alpha: 1, cap: 'round', join: 'round' });
      focusContainer.addChild(core);
    });
    bootsByColor.forEach(boots => focusContainer.addChild(boots));
    renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + focusContainer.children.length;
  }

  function buildRoundedOrthogonalPath(points, radius = 12) {
    if (!Array.isArray(points) || points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const next = points[i + 1];
      const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
      const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
      if (!Number.isFinite(cornerRadius) || cornerRadius <= 0) {
        path += ` L ${current.x} ${current.y}`;
        continue;
      }
      const inX = current.x - ((current.x - previous.x) / incomingLength) * cornerRadius;
      const inY = current.y - ((current.y - previous.y) / incomingLength) * cornerRadius;
      const outX = current.x + ((next.x - current.x) / outgoingLength) * cornerRadius;
      const outY = current.y + ((next.y - current.y) / outgoingLength) * cornerRadius;
      path += ` L ${inX} ${inY} Q ${current.x} ${current.y} ${outX} ${outY}`;
    }
    const last = points[points.length - 1];
    return `${path} L ${last.x} ${last.y}`;
  }

  function samplePathSegments(pathD, cableId) {
    const segments = [];
    const commands = pathD?.match(/[MLCQZ][^MLCQZ]*/gi) || [];
    let current = null;
    const addSegment = (next) => {
      if (current) segments.push({ cableId, x1: current.x, y1: current.y, x2: next.x, y2: next.y });
      current = next;
    };
    for (const command of commands) {
      const type = command[0].toUpperCase();
      const args = command.slice(1).trim().split(/[\s,]+/).map(Number);
      if (type === 'M') {
        current = { x: args[0], y: args[1] };
      } else if (type === 'L') {
        addSegment({ x: args[0], y: args[1] });
      } else if (type === 'Q' && current) {
        const start = current;
        for (let step = 1; step <= 6; step++) {
          const t = step / 6;
          const mt = 1 - t;
          addSegment({
            x: mt * mt * start.x + 2 * mt * t * args[0] + t * t * args[2],
            y: mt * mt * start.y + 2 * mt * t * args[1] + t * t * args[3]
          });
        }
      } else if (type === 'C' && current) {
        const start = current;
        for (let step = 1; step <= 10; step++) {
          const t = step / 10;
          const mt = 1 - t;
          addSegment({
            x: mt ** 3 * start.x + 3 * mt * mt * t * args[0] + 3 * mt * t * t * args[2] + t ** 3 * args[4],
            y: mt ** 3 * start.y + 3 * mt * mt * t * args[1] + 3 * mt * t * t * args[3] + t ** 3 * args[5]
          });
        }
      }
    }
    return segments;
  }

  function rebuildSpatialIndex() {
    spatialGrid.clear();
    spatialMembership.clear();
    for (const [cableId, display] of cableDisplays) {
      indexCableDisplay(cableId, display);
    }
  }

  function removeCableFromSpatialIndex(cableId) {
    const memberships = spatialMembership.get(cableId) || [];
    memberships.forEach(({ key, segment }) => {
      const bucket = spatialGrid.get(key);
      if (!bucket) return;
      const index = bucket.indexOf(segment);
      if (index >= 0) bucket.splice(index, 1);
      if (!bucket.length) spatialGrid.delete(key);
    });
    spatialMembership.delete(cableId);
  }

  function indexCableDisplay(cableId, display) {
      removeCableFromSpatialIndex(cableId);
      const memberships = [];
      const endpointSegments = (display.endpoints || []).map(point => ({ cableId, x1: point.x, y1: point.y, x2: point.x, y2: point.y, endpoint: true }));
      for (const segment of [...samplePathSegments(display.pathD, cableId), ...endpointSegments]) {
        const minCellX = Math.floor(Math.min(segment.x1, segment.x2) / SPATIAL_CELL_SIZE);
        const maxCellX = Math.floor(Math.max(segment.x1, segment.x2) / SPATIAL_CELL_SIZE);
        const minCellY = Math.floor(Math.min(segment.y1, segment.y2) / SPATIAL_CELL_SIZE);
        const maxCellY = Math.floor(Math.max(segment.y1, segment.y2) / SPATIAL_CELL_SIZE);
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
          for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
            const key = `${cellX}:${cellY}`;
            if (!spatialGrid.has(key)) spatialGrid.set(key, []);
            spatialGrid.get(key).push(segment);
            memberships.push({ key, segment });
          }
        }
      }
      spatialMembership.set(cableId, memberships);
  }

  function pointSegmentDistanceSquared(point, segment) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return (point.x - segment.x1) ** 2 + (point.y - segment.y1) ** 2;
    const t = Math.max(0, Math.min(1, ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / lengthSquared));
    const x = segment.x1 + t * dx;
    const y = segment.y1 + t * dy;
    return (point.x - x) ** 2 + (point.y - y) ** 2;
  }

  let isPointerOverCable = false;
  let moveListenerAttached = false;
  let pointerMoveFrame = 0;
  let latestPointerMove = null;

  function eventClientPosition(e) {
    const original = e?.nativeEvent || e?.originalEvent;
    return {
      x: Number.isFinite(e?.clientX) ? e.clientX : (Number.isFinite(original?.clientX) ? original.clientX : 0),
      y: Number.isFinite(e?.clientY) ? e.clientY : (Number.isFinite(original?.clientY) ? original.clientY : 0)
    };
  }

  function clientToRenderer(clientX, clientY) {
    const point = { x: 0, y: 0 };
    const rect = pixiCanvas?.getBoundingClientRect();
    if (STATE.pixiViewportRendererV2 !== false && rect?.width > 0 && rect?.height > 0) {
      const scale = RS.ZOOM_STATE?.scale || 1;
      // V2 uses CSS pixels as its world-to-screen camera unit. Reading the
      // viewport-local point directly keeps picking stable while a sidebar is
      // animating and before ResizeObserver updates the backing buffer.
      point.x = (clientX - rect.left - (RS.ZOOM_STATE?.panX || 0)) / scale;
      point.y = (clientY - rect.top - (RS.ZOOM_STATE?.panY || 0)) / scale;
      return point;
    }
    const events = pixiApp?.renderer?.events;
    if (events?.mapPositionToPoint) {
      events.mapPositionToPoint(point, clientX, clientY);
      return point;
    }
    const screen = pixiApp?.renderer?.screen;
    if (!rect || rect.width <= 0 || rect.height <= 0) return point;
    point.x = (clientX - rect.left) * ((screen?.width || lastWidth || rect.width) / rect.width);
    point.y = (clientY - rect.top) * ((screen?.height || lastHeight || rect.height) / rect.height);
    return point;
  }

  function redrawCableDisplay(cableId) {
    const display = cableDisplays.get(cableId);
    if (!display) return;
    const selected = STATE.highlightedCableId === cableId;
    const hovered = hoveredCableId === cableId || groupHoveredCableIds.has(cableId);
    const hasHoverFocus = hoveredCableId !== null || groupHoveredCableIds.size > 0;
    const visuallyFocused = hovered || (selected && !hasHoverFocus);
    const activeColor = display.previewColorNum ?? display.colorNum;
    display.visualAlpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
    display.glowAlpha = visuallyFocused ? 1 : 0;
    if (usesBatchedViewportRenderer()) {
      rebuildBatchedFocus();
      return;
    }
    display.glow.clear();
    if (visuallyFocused) {
      parseSvgPathD(display.glow, display.pathD);
      display.glow.stroke({
        width: selected ? 12 : 10,
        color: activeColor,
        alpha: selected ? 0.58 : 0.48,
        cap: 'round',
        join: 'round'
      });
      display.glow.blendMode = 'add';
    }
    display.casing.clear();
    parseSvgPathD(display.casing, display.pathD);
    display.casing.stroke({
      width: selected ? 5.8 : (hovered ? 5.4 : 4.8),
      color: 0x060913,
      alpha: selected || hovered ? 1 : 0.95,
      cap: 'round',
      join: 'round'
    });
    display.core.clear();
    parseSvgPathD(display.core, display.pathD);
    display.core.stroke({
      width: selected ? 3.5 : (hovered ? 3.2 : 2.6),
      color: activeColor,
      alpha: 1,
      cap: 'round',
      join: 'round'
    });
    display.core.alpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
    display.casing.alpha = display.core.alpha;
    display.glow.alpha = visuallyFocused ? 1 : 0;
    display.boots.forEach((boot, index) => {
      const point = display.endpoints[index];
      if (point) {
        const radius = selected ? 4.0 : (hovered ? 3.8 : 3.4);
        const pinRadius = selected ? 1.6 : (hovered ? 1.4 : 1.2);
        boot.clear();
        boot.circle(point.x, point.y, radius)
          .fill(0x090d16)
          .stroke({ width: selected || hovered ? 2.0 : 1.6, color: activeColor });
        boot.circle(point.x, point.y, pinRadius).fill(activeColor);
        boot.alpha = display.core.alpha;
      } else if (display.isStub && index === 1 && display.stubPoint) {
        const destX = display.stubPoint.x;
        const destY = display.stubPoint.y;
        const badgeW = Math.max(76, (display.stubBadgeText || '').length * 6.5 + 16);
        const badgeH = 18;
        const bx = display.isRightExit ? destX + 4 : destX - badgeW - 4;
        const by = destY - badgeH / 2;
        boot.clear();
        boot.roundRect(bx, by, badgeW, badgeH, 4)
          .fill(0x0f172a)
          .stroke({ width: 1.2, color: activeColor });
        boot.alpha = display.core.alpha;
      } else {
        boot.clear();
      }
    });
    if ((hovered || selected) && display.core.parent === cablesContainer) {
      cablesContainer.addChild(display.glow, display.casing, display.core);
      display.boots.forEach(boot => connectorsContainer.addChild(boot));
    }
  }

  function refreshCableFocus(fullyRedrawIds = new Set(), shouldRender = true) {
    if (usesBatchedViewportRenderer()) {
      const hasHoverFocus = hoveredCableId !== null || groupHoveredCableIds.size > 0;
      for (const [id, display] of cableDisplays) {
        const hovered = hoveredCableId === id || groupHoveredCableIds.has(id);
        display.visualAlpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
        display.glowAlpha = (hovered || (!hasHoverFocus && id === STATE.highlightedCableId)) ? 1 : 0;
      }
      rebuildBatchedFocus();
      if (shouldRender) renderPixi('focus');
      else performanceTelemetry.avoidedFocusRenders++;
      return;
    }
    const hasHoverFocus = hoveredCableId !== null || groupHoveredCableIds.size > 0;
    for (const [id, display] of cableDisplays) {
      if (fullyRedrawIds.has(id) || id === STATE.highlightedCableId) {
        redrawCableDisplay(id);
        continue;
      }
      const hovered = hoveredCableId === id || groupHoveredCableIds.has(id);
      const alpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
      display.core.alpha = alpha;
      display.casing.alpha = alpha;
      display.glow.alpha = 0;
      display.boots.forEach(boot => { boot.alpha = alpha; });
    }
    if (shouldRender) renderPixi('focus');
    else performanceTelemetry.avoidedFocusRenders++;
  }

  function schedulePixiTooltip(e, cableId) {
    if (!e || !cableId) return;
    const pointer = { clientX: e.clientX, clientY: e.clientY };
    requestAnimationFrame(() => {
      if (hoveredCableId === cableId && STATE.cableRenderMode === 'pixi') {
        showCableTooltip(pointer, cableId);
      }
    });
  }

  function setPixiHover(cableId, e) {
    if (hoveredCableId === cableId) {
      schedulePixiTooltip(e, cableId);
      return;
    }
    const previous = hoveredCableId;
    recordTimedEvent(performanceTelemetry.hoverEvents);
    const previousGroup = new Set(groupHoveredCableIds);
    groupHoveredCableIds.clear();
    hoveredCableId = cableId || null;
    if (previous) setCableHover(previous, false, 'pixi');
    if (hoveredCableId) {
      setCableHover(hoveredCableId, true, 'pixi');
      schedulePixiTooltip(e, hoveredCableId);
    } else if (dom?.tooltip) {
      dom.tooltip.style.display = 'none';
    }
    const changed = new Set(previousGroup);
    if (previous) changed.add(previous);
    if (hoveredCableId) changed.add(hoveredCableId);
    refreshCableFocus(changed);
  }

  function hitCableAt(clientX, clientY) {
    const point = clientToRenderer(clientX, clientY);
    const rect = pixiCanvas?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    const worldPerScreenPixel = (pixiApp?.renderer?.screen?.width || lastWidth || rect.width) / rect.width;
    const baseRadius = 6 * worldPerScreenPixel;
    const cellRadius = Math.ceil((baseRadius + 2 * worldPerScreenPixel) / SPATIAL_CELL_SIZE);
    const centerCellX = Math.floor(point.x / SPATIAL_CELL_SIZE);
    const centerCellY = Math.floor(point.y / SPATIAL_CELL_SIZE);
    hitCandidates.clear();
    for (let x = centerCellX - cellRadius; x <= centerCellX + cellRadius; x++) {
      for (let y = centerCellY - cellRadius; y <= centerCellY + cellRadius; y++) {
        (spatialGrid.get(`${x}:${y}`) || []).forEach(segment => hitCandidates.add(segment));
      }
    }
    let bestCableId = null;
    let bestDistance = Infinity;
    let bestIsEndpoint = false;
    for (const segment of hitCandidates) {
      const distance = pointSegmentDistanceSquared(point, segment);
      const hysteresis = segment.cableId === hoveredCableId ? 2 * worldPerScreenPixel : 0;
      const allowed = baseRadius + hysteresis;
      if (distance > allowed * allowed) continue;
      const isEndpoint = !!segment.endpoint;
      const EPSILON = 0.75;
      const isCloser = distance < bestDistance - EPSILON;
      const isRoughlyEqual = Math.abs(distance - bestDistance) <= EPSILON;
      const isBetterEndpoint = isEndpoint && !bestIsEndpoint && distance <= allowed * allowed;

      if (
        isBetterEndpoint ||
        (isEndpoint === bestIsEndpoint && isCloser) ||
        (!bestIsEndpoint && isCloser) ||
        (isRoughlyEqual && isEndpoint && !bestIsEndpoint) ||
        (isRoughlyEqual && isEndpoint === bestIsEndpoint && segment.cableId === hoveredCableId)
      ) {
        bestDistance = distance;
        bestCableId = segment.cableId;
        bestIsEndpoint = isEndpoint;
      }
    }
    return bestCableId;
  }

  function handleCablePointerDown(cableId, e) {
    if (e?.button != null && e.button !== 0) return;
    e?.stopPropagation?.();
    const pos = eventClientPosition(e);
    if (STATE.highlightedCableId !== cableId) highlightCable(cableId);
    redrawCableDisplay(cableId);
    showCableQuickHud(cableId, pos.x, pos.y);
    renderPixi('selection');
  }

  function attachHitDetection() {
    if (moveListenerAttached || !pixiCanvas) return;
    moveListenerAttached = true;

    window.addEventListener('pointermove', (e) => {
      if (!pixiApp || !pixiCanvas || STATE?.cableRenderMode !== 'pixi') return;
      latestPointerMove = e;
      if (pointerMoveFrame) return;
      pointerMoveFrame = requestAnimationFrame(() => {
        pointerMoveFrame = 0;
        const e = latestPointerMove;
        if (!e || !pixiApp || !pixiCanvas || STATE?.cableRenderMode !== 'pixi') return;

      const target = e.target instanceof Element ? e.target : null;

      // Suspend nearest cable hit-testing and hover changes while HUD, context menu or modal is active
      const isHudOrMenuOpen = !!document.getElementById('cable-quick-hud') || !!document.getElementById('cable-context-menu') || !!document.querySelector('.modal.show, .modal.active');
      const inHudOrMenu = !!target?.closest('#cable-quick-hud, #cable-context-menu, .cable-quick-hud, .cable-context-menu, .modal');
      if (isHudOrMenuOpen || inHudOrMenu) {
        if (isPointerOverCable) {
          pixiCanvas.style.pointerEvents = 'none';
          isPointerOverCable = false;
        }
        if (dom?.tooltip) dom.tooltip.style.display = 'none';
        return;
      }

      // Schedule rows own their hover state. A window-level Pixi hit-test used
      // to immediately overwrite their mouseenter result with `null` because
      // the pointer is outside the canvas. Scrolling appeared to fix it only
      // because scrolling moves DOM rows without emitting pointermove.
      const inScheduleSidebar = !!target?.closest('#sidebar-right');
      if (inScheduleSidebar) {
        if (isPointerOverCable) {
          pixiCanvas.style.pointerEvents = 'none';
          isPointerOverCable = false;
        }
        const domOwnsCableHover = !!target.closest(
          '#schedule-tbody [data-cable-id], #schedule-tbody .tree-switch-header'
        );
        if (!domOwnsCableHover) setPixiHover(null);
        return;
      }

      const rect = pixiCanvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        if (isPointerOverCable) {
          pixiCanvas.style.pointerEvents = 'none';
          isPointerOverCable = false;
        }
        setPixiHover(null);
        return;
      }

      const cableId = STATE.pendingConnection ? null : hitCableAt(e.clientX, e.clientY);
      const hitInteractive = !!cableId;
      setPixiHover(cableId, e);

      if (hitInteractive && !isPointerOverCable) {
        pixiCanvas.style.pointerEvents = 'auto';
        isPointerOverCable = true;
      } else if (!hitInteractive && isPointerOverCable) {
        pixiCanvas.style.pointerEvents = 'none';
        isPointerOverCable = false;
      }
      });
    }, { passive: true });

    pixiCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const cableId = hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
      handleCablePointerDown(cableId, e);
    });

    pixiCanvas.addEventListener('click', (e) => {
      const cableId = hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
    });

    // Use window-level capture for contextmenu so it fires even when the canvas
    // has pointerEvents:none (which happens while a cable is hovered/selected).
    window.addEventListener('contextmenu', (e) => {
      if (STATE?.cableRenderMode !== 'pixi' || !pixiApp || !pixiCanvas) return;
      const cableId = hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
      highlightCable(cableId, true);
      redrawCableDisplay(cableId);
      showCableContextMenu(cableId, e.clientX, e.clientY);
      renderPixi('context-menu');
    }, { capture: true });

    const onDblClick = (e) => {
      if (STATE?.cableRenderMode !== 'pixi') return;
      if (e.target?.closest?.('#cable-quick-hud, #cable-context-menu, .modal, input, button')) return;
      const cableId = hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
      renameCable2D(cableId);
    };
    pixiCanvas.addEventListener('dblclick', onDblClick);
    window.addEventListener('dblclick', onDblClick, { capture: true });
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

    // Structural rack renders used to leave duplicate placeholder canvases.
    // A single persistent GPU surface must remain owned by the viewport.
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

    attachHitDetection();
    return pixiCanvas;
  }

  function syncPixiViewportCamera(camera = RS.ZOOM_STATE || {}, force = false, reason = 'camera') {
    if (!pixiApp || STATE.pixiViewportRendererV2 === false) return;
    const scale = Number.isFinite(camera.scale) ? camera.scale : 1;
    const cameraSignature = `${camera.panX || 0}:${camera.panY || 0}:${scale}:${pixiApp.renderer.screen.width}:${pixiApp.renderer.screen.height}`;
    if (!force && cameraSignature === lastCameraSignature) {
      performanceTelemetry.duplicateCameraSkips++;
      return false;
    }
    lastCameraSignature = cameraSignature;
    // The canvas is viewport-sized and must remain anchored to that viewport.
    // Applying a second CSS camera here changes getBoundingClientRect(), while
    // ports and rack content use rackStage's camera. Geometry refreshes during
    // a gesture would then bake that temporary offset into cables/organizers.
    if (pixiCanvas) pixiCanvas.style.transform = 'none';
    pixiApp.stage.position.set(camera.panX || 0, camera.panY || 0);
    pixiApp.stage.scale.set(scale);
    const viewportW = pixiApp.renderer.screen.width;
    const viewportH = pixiApp.renderer.screen.height;
    const minX = -(camera.panX || 0) / scale - 160;
    const minY = -(camera.panY || 0) / scale - 160;
    const maxX = minX + viewportW / scale + 320;
    const maxY = minY + viewportH / scale + 320;
    const updateVisibility = container => {
      container?.children?.forEach(batch => {
        if (!batch.__rackId || batch.__rackId === '__cross__') {
          batch.visible = true;
          return;
        }
        const bounds = batch.__worldBounds;
        if (!bounds) return;
        batch.visible = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
      });
    };
    updateVisibility(cablesContainer);
    updateVisibility(connectorsContainer);
    return renderPixi(reason);
  }

  function getOrCreatePixiCanvas(parentContainer, width, height) {
    const svgEl = document.getElementById('cables-svg');
    return ensurePixiCanvas(svgEl, parentContainer);
  }

  function observePixiViewport() {
    if (viewportResizeObserver || typeof ResizeObserver === 'undefined') return;
    const viewport = document.getElementById('viewport-canvas');
    if (!viewport) return;
    viewportResizeObserver = new ResizeObserver(() => {
      if (!pixiApp || STATE.cableRenderMode !== 'pixi') return;
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
      // ResizeObserver runs after layout and before paint. Repaint here rather
      // than one rAF later, otherwise the browser can show one stretched frame.
      syncPixiViewportCamera(RS.ZOOM_STATE, true, 'resize');
    });
    viewportResizeObserver.observe(viewport);
  }

  async function ensurePixiApp(parentContainer, width, height) {
    if (pixiApp) return pixiApp;
    if (initPromise) return initPromise;
    if (typeof window.PIXI === 'undefined' || !window.PIXI.Application) {
      return null;
    }

    isInitializing = true;
    initPromise = (async () => {
      try {
      const svgEl = document.getElementById('cables-svg');
      const canvas = ensurePixiCanvas(svgEl, parentContainer);
      const app = new window.PIXI.Application();
      const renderResolution = calculatePixiResolution(width, height, false);
      await app.init({
        canvas: canvas,
        width: width,
        height: height,
        resolution: renderResolution,
        autoDensity: true,
        antialias: true,
        backgroundAlpha: 0,
        preference: 'webgl',
        autoStart: false
      });

      cablesContainer = new window.PIXI.Container();
      connectorsContainer = new window.PIXI.Container();
      focusContainer = new window.PIXI.Container();
      organizerOverlayContainer = new window.PIXI.Container();
      app.stage.addChild(cablesContainer);
      app.stage.addChild(connectorsContainer);
      app.stage.addChild(focusContainer);
      app.stage.addChild(organizerOverlayContainer);
      app.stage.eventMode = 'passive';

      pixiApp = app;
      currentRenderResolution = renderResolution;
      lastWidth = width;
      lastHeight = height;
      observePixiViewport();
      return pixiApp;
      } catch (err) {
        console.warn('[PixiRenderer] WebGL init fallback:', err);
        return null;
      } finally {
        isInitializing = false;
        initPromise = null;
      }
    })();
    return initPromise;
  }

  function activateSvgFallback() {
    STATE.cableRenderMode = 'svg';
    try { localStorage.setItem('rackstudio_cable_mode', 'svg'); } catch (_) {}
    if (pixiCanvas) {
      pixiCanvas.style.display = 'none';
      pixiCanvas.style.pointerEvents = 'none';
    }
    const svgEl = document.getElementById('cables-svg');
    if (svgEl) svgEl.style.display = 'block';
    const indicator = document.getElementById('cable-engine-indicator');
    if (indicator) {
      indicator.textContent = '🎨 SVG';
      indicator.style.color = '#94a3b8';
    }
    RS.renderAllCablesSVG?.();
  }

  function renderAllCablesPixi() {
    const renderStartedAt = performance.now();
    renderStats.calls++;
    const svgEl = document.getElementById('cables-svg');
    const parentContainer = svgEl?.parentNode || document.getElementById('rack-container') || document.getElementById('rack-stage');
    if (!parentContainer) return;

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const activeRack = getActiveRack();

    let stageW = 618;
    let stageH = (activeRack?.heightU || 42) * 32;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      stageW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      stageH = maxU * 32 + 156;
    }

    const canvas = ensurePixiCanvas(svgEl, parentContainer);
    const viewportHost = document.getElementById('viewport-canvas') || parentContainer;
    const viewportW = Math.max(1, viewportHost?.clientWidth || stageW);
    const viewportH = Math.max(1, viewportHost?.clientHeight || stageH);
    const rendererW = STATE.pixiViewportRendererV2 !== false ? viewportW : stageW;
    const rendererH = STATE.pixiViewportRendererV2 !== false ? viewportH : stageH;

    if (!pixiApp) {
      ensurePixiApp(parentContainer, rendererW, rendererH).then(app => {
        if (app) renderAllCablesPixi();
        else activateSvgFallback();
      });
      return;
    }

    if (svgEl) {
      svgEl.style.display = 'none';
    }
    if (canvas) {
      canvas.style.display = 'block';
    }

    let rendererResized = false;
    if (lastWidth !== rendererW || lastHeight !== rendererH) {
      pixiApp.renderer.resize(rendererW, rendererH);
      lastWidth = rendererW;
      lastHeight = rendererH;
      rendererResized = true;
    }
    lastWorldWidth = stageW;
    lastWorldHeight = stageH;
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    const sceneSignature = buildSceneSignature(stageW, stageH, isMulti, activeRack);
    const sceneChanged = sceneSignature !== lastSceneSignature;
    const layoutSignature = buildLayoutSignature(stageW, stageH, isMulti, activeRack);
    const layoutChanged = layoutSignature !== lastLayoutSignature;
    if (layoutChanged) {
      if (!layoutCacheWasExplicitlyInvalidated) {
        endpointWorldCache.clear();
        rackRailWorldCache.clear();
        organizerWorldYCache.clear();
        performanceTelemetry.layoutCacheInvalidations++;
      }
      layoutCacheWasExplicitlyInvalidated = false;
    }
    const visibleCables = (STATE.cables || []).filter(cable => {
      if (isMulti || !cable.from?.rackId || !cable.to?.rackId) return true;
      return cable.from.rackId === activeRack?.id || cable.to.rackId === activeRack?.id;
    });
    const appendOnlyGeometry = !layoutChanged &&
      lastVisibleCableOrder.length > 0 &&
      visibleCables.length > lastVisibleCableOrder.length &&
      lastVisibleCableOrder.every((id, index) => {
        const cable = visibleCables[index];
        const display = cableDisplays.get(id);
        return cable?.id === id && display &&
          display.geometrySignature === cableGeometrySignature(cable) &&
          display.colorNum === hexColorToNumber(cable.color || '#2563eb');
      }) &&
      visibleCables.slice(lastVisibleCableOrder.length).every(cable => !cableDisplays.has(cable.id));

    const visibleCableIds = new Set(visibleCables.map(cable => cable.id));
    const removedCableIds = new Set(lastVisibleCableOrder.filter(id => !visibleCableIds.has(id)));
    const retainedVisibleOrder = lastVisibleCableOrder.filter(id => visibleCableIds.has(id));
    const removalOnlyMutation = !layoutChanged &&
      removedCableIds.size > 0 &&
      retainedVisibleOrder.length === visibleCables.length &&
      retainedVisibleOrder.every((id, index) => id === visibleCables[index]?.id) &&
      visibleCables.every(cable => {
        const display = cableDisplays.get(cable.id);
        return display &&
          display.geometrySignature === cableGeometrySignature(cable) &&
          display.colorNum === hexColorToNumber(cable.color || '#2563eb');
      });

    // Removing cables does not invalidate any surviving route. Drop only the
    // removed retained displays and spatial memberships; do not remeasure DOM
    // endpoints or rebuild the geometry of every remaining cable.
    if (removalOnlyMutation) {
      for (const cableId of removedCableIds) {
        const display = cableDisplays.get(cableId);
        if (display) destroyCableDisplay(display);
        removeCableFromSpatialIndex(cableId);
        cableDisplays.delete(cableId);
        groupHoveredCableIds.delete(cableId);
        if (hoveredCableId === cableId) hoveredCableId = null;
      }
      if (usesBatchedViewportRenderer()) {
        rebuildBatchedBase();
        rebuildBatchedFocus();
      }
      performanceTelemetry.incrementalRemovalPasses++;
      performanceTelemetry.incrementalCablesRemoved += removedCableIds.size;
      performanceTelemetry.avoidedRemovalGeometryPasses++;
      performanceTelemetry.spatialIncrementalRemovals += removedCableIds.size;
      lastSceneSignature = sceneSignature;
      lastLayoutSignature = layoutSignature;
      lastVisibleCableOrder = visibleCables.map(cable => cable.id);
      renderStats.lastDurationMs = performance.now() - renderStartedAt;
      if (rendererResized) syncPixiViewportCamera(RS.ZOOM_STATE, true, 'resize');
      else renderPixi('remove');
      return;
    }

    // Fast path: camera, schedule and repeated refresh calls do not change
    // cable geometry. Keep all Graphics objects and avoid every DOM layout read.
    if (!sceneChanged && visibleCables.length === cableDisplays.size) {
      let geometryChanged = false;
      const styleChangedIds = new Set();
      const previousColorsByCableId = new Map();
      for (const cable of visibleCables) {
        const display = cableDisplays.get(cable.id);
        if (!display || display.geometrySignature !== cableGeometrySignature(cable)) {
          geometryChanged = true;
          break;
        }
        const colorNum = hexColorToNumber(cable.color || '#2563eb');
        if (display.colorNum !== colorNum) {
          previousColorsByCableId.set(cable.id, display.colorNum);
          display.colorNum = colorNum;
          styleChangedIds.add(cable.id);
        }
      }
      if (!geometryChanged) {
        if (usesBatchedViewportRenderer() && styleChangedIds.size) {
          if (!rebuildBatchedStyleGroups(previousColorsByCableId)) rebuildBatchedBase();
          rebuildBatchedFocus();
        } else {
          styleChangedIds.forEach(redrawCableDisplay);
        }
        renderStats.fastPathHits++;
        if (styleChangedIds.size) {
          performanceTelemetry.incrementalStylePasses++;
          performanceTelemetry.incrementalStyleCables += styleChangedIds.size;
        }
        renderStats.lastDurationMs = performance.now() - renderStartedAt;
        if (rendererResized) syncPixiViewportCamera(RS.ZOOM_STATE, true, 'resize');
        else if (styleChangedIds.size) renderPixi('style');
        return;
      }
    }

    renderStats.geometryPasses++;
    recordTimedEvent(performanceTelemetry.geometryEvents);
    if (appendOnlyGeometry) performanceTelemetry.incrementalGeometryPasses++;
    else performanceTelemetry.fullGeometryPasses++;
    const seenCableIds = appendOnlyGeometry ? new Set(lastVisibleCableOrder) : new Set();
    const geometryChangedIds = new Set();
    if (layoutChanged) {
      organizerOverlayContainer.removeChildren().forEach(child => child.destroy?.());
    }

    const rackCont = document.getElementById('rack-container') || parentContainer;
    const canvasRect = canvas.getBoundingClientRect();
    renderStats.domRectReads++;

    function clientToPixi(clientX, clientY) {
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return { x: 0, y: 0 };
      if (STATE.pixiViewportRendererV2 !== false) {
        const scale = RS.ZOOM_STATE?.scale || 1;
        return {
          x: (clientX - canvasRect.left - (RS.ZOOM_STATE?.panX || 0)) / scale,
          y: (clientY - canvasRect.top - (RS.ZOOM_STATE?.panY || 0)) / scale
        };
      }
      return { x: (clientX - canvasRect.left) * stageW / canvasRect.width, y: (clientY - canvasRect.top) * stageH / canvasRect.height };
    }

    function getPortPoint(el) {
      if (!el) return null;
      const key = el.id || `${el.dataset?.instanceId || ''}:${el.dataset?.portId || ''}`;
      const cached = endpointWorldCache.get(key);
      if (cached) {
        performanceTelemetry.endpointCacheHits++;
        return cached;
      }
      const rect = el.getBoundingClientRect();
      renderStats.domRectReads++;
      performanceTelemetry.endpointCacheMisses++;
      if (rect.width === 0 && rect.height === 0) return null;
      const point = clientToPixi(rect.left + rect.width / 2, rect.top + rect.height / 2);
      endpointWorldCache.set(key, point);
      return point;
    }

    function getRackRailBounds(rackId) {
      if (!rackId) return { left: 23, right: 595, top: 0 };
      if (rackRailWorldCache.has(rackId)) {
        performanceTelemetry.rackCacheHits++;
        return rackRailWorldCache.get(rackId);
      }
      performanceTelemetry.rackCacheMisses++;
      let left = 23;
      let right = 595;
      let top = 0;
      const rackCont = document.querySelector(`.rack-container[data-rack-id="${rackId}"]`) ||
                       document.getElementById(`rack-container-${rackId}`) ||
                       document.getElementById('rack-container');
      if (rackCont) {
        const rc = rackCont.getBoundingClientRect();
        renderStats.domRectReads++;
        top = clientToPixi(0, rc.top).y;
        const railL = rackCont.querySelector('.rack-rail.left');
        const railR = rackCont.querySelector('.rack-rail.right');
        if (railL && railR) {
          const lRect = railL.getBoundingClientRect();
          const rRect = railR.getBoundingClientRect();
          renderStats.domRectReads += 2;
          left = clientToPixi(lRect.left + lRect.width / 2, 0).x;
          right = clientToPixi(rRect.left + rRect.width / 2, 0).x;
        }
      }
      const bounds = { left, right, top };
      rackRailWorldCache.set(rackId, bounds);
      return bounds;
    }

    function getCachedOrgY(org, fallbackY, otherY) {
      if (!org || !org.instanceId) return fallbackY + (otherY >= fallbackY ? 14 : -14);
      if (organizerWorldYCache.has(org.instanceId)) {
        performanceTelemetry.organizerCacheHits++;
        return organizerWorldYCache.get(org.instanceId);
      }
      performanceTelemetry.organizerCacheMisses++;
      const orgEl = document.getElementById(org.instanceId);
      if (orgEl) {
        const r = orgEl.getBoundingClientRect();
        renderStats.domRectReads++;
        const y = clientToPixi(0, r.top + r.height / 2).y;
        organizerWorldYCache.set(org.instanceId, y);
        return y;
      }
      return fallbackY + (otherY >= fallbackY ? 14 : -14);
    }

    let leftChannelUsage = appendOnlyGeometry ? lastChannelUsage.left : 0;
    let rightChannelUsage = appendOnlyGeometry ? lastChannelUsage.right : 0;

    const MM_PER_U = 44.45;
    const SVG_PX_PER_U = 32;
    const MM_PER_SVG_Y = MM_PER_U / SVG_PX_PER_U;
    const SLACK_FACTOR = 1.05;

    const cables = appendOnlyGeometry ? visibleCables.slice(lastVisibleCableOrder.length) : visibleCables;
    if (appendOnlyGeometry) performanceTelemetry.incrementalCablesProcessed += cables.length;

    cables.forEach(cable => {
      const instA = cable.from.instanceId || cable.from.deviceId;
      const instB = cable.to.instanceId || cable.to.deviceId;
      const portIdA = cable.from.portId || ('p' + cable.from.portIdx);
      const portIdB = cable.to.portId || ('p' + cable.to.portIdx);

      let portFromEl = document.getElementById(`port-${instA}-${portIdA}`);
      let portToEl = document.getElementById(`port-${instB}-${portIdB}`);

      if (!portFromEl) {
        portFromEl = document.querySelector(`.port[data-instance-id="${instA}"][data-port-id="${portIdA}"]`) ||
                     document.querySelector(`.port[data-instance-id="${instA}"]`);
      }
      if (!portToEl) {
        portToEl = document.querySelector(`.port[data-instance-id="${instB}"][data-port-id="${portIdB}"]`) ||
                    document.querySelector(`.port[data-instance-id="${instB}"]`);
      }

      const isInterRack = cable.from?.rackId !== cable.to?.rackId;
      if (!portFromEl && !portToEl) return;

      let isStub = false;
      let isFromMounted = true;
      let stubBadgeText = '';
      let isRightExit = true;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

      if (isInterRack && (!portFromEl || !portToEl)) {
        isStub = true;
        isFromMounted = !!portFromEl;
        const localPortEl = isFromMounted ? portFromEl : portToEl;
        const remoteEndpoint = isFromMounted ? cable.to : cable.from;
        const pLocal = getPortPoint(localPortEl);
        if (!pLocal) return;

        seenCableIds.add(cable.id);
        const boundsLocal = getRackRailBounds(activeRack?.id);
        const activeIdx = (STATE.racks || []).findIndex(r => r && r.id === activeRack?.id);
        const remoteIdx = (STATE.racks || []).findIndex(r => r && r.id === remoteEndpoint.rackId);
        isRightExit = remoteIdx >= activeIdx;

        const remoteRack = (RS.getRackById ? RS.getRackById(remoteEndpoint.rackId) : null) || (STATE.racks || []).find(r => r && r.id === remoteEndpoint.rackId);
        const remoteDev = (RS.getDeviceById ? RS.getDeviceById(remoteEndpoint.instanceId) : null) || remoteRack?.devices?.find(d => d && d.instanceId === remoteEndpoint.instanceId);
        const remoteU = remoteDev?.topU ? `U${remoteDev.topU}` : '';
        const remoteName = remoteRack ? (remoteRack.name.length > 12 ? remoteRack.name.substring(0, 10) + '..' : remoteRack.name) : (remoteEndpoint.rackId || 'Kabin');
        stubBadgeText = `➔ ${remoteName} ${remoteU}`.trim();

        const stubX = isRightExit ? boundsLocal.right + 24 : boundsLocal.left - 24;
        const stubY = pLocal.y;

        x1 = isFromMounted ? pLocal.x : stubX;
        y1 = isFromMounted ? pLocal.y : stubY;
        x2 = isFromMounted ? stubX : pLocal.x;
        y2 = isFromMounted ? stubY : pLocal.y;
      } else {
        if (!portFromEl || !portToEl) return;
        const p1 = getPortPoint(portFromEl);
        const p2 = getPortPoint(portToEl);
        if (!p1 || !p2) return;
        seenCableIds.add(cable.id);
        x1 = p1.x;
        y1 = p1.y;
        x2 = p2.x;
        y2 = p2.y;
      }

      let pathD = '';

      if (isStub) {
        const ctrlX1 = isRightExit ? Math.max(x1, x2) - 10 : Math.min(x1, x2) + 10;
        pathD = `M ${x1} ${y1} C ${ctrlX1} ${y1}, ${x2} ${y2}, ${x2} ${y2}`;
      } else if (isInterRack && STATE.cableRoutingMode === 'direct') {
        const overheadY = Math.min(y1, y2) - 80 - (leftChannelUsage++ % 6) * 8;
        pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
      } else if (isInterRack && STATE.cableRoutingMode === 'structured') {
        const devA = RS.getDeviceById ? RS.getDeviceById(instA) : STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA);
        const devB = RS.getDeviceById ? RS.getDeviceById(instB) : STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB);
        const rackA = RS.getRackById ? RS.getRackById(cable.from.rackId) : STATE.racks.find(r => r.id === cable.from.rackId);
        const rackB = RS.getRackById ? RS.getRackById(cable.to.rackId) : STATE.racks.find(r => r.id === cable.to.rackId);

        const orgA = findDeviceOrganizer(rackA, devA);
        const orgB = findDeviceOrganizer(rackB, devB);

        let trayYA = getCachedOrgY(orgA, y1, y2);
        let trayYB = getCachedOrgY(orgB, y2, y1);

        const boundsA = getRackRailBounds(rackA?.id);
        const boundsB = getRackRailBounds(rackB?.id);
        const topYA = boundsA.top || (y1 - 40);
        const topYB = boundsB.top || topYA;

        const rackACenter = (boundsA.left + boundsA.right) / 2;
        const rackBCenter = (boundsB.left + boundsB.right) / 2;
        const goingRight = rackBCenter >= rackACenter;

        const useRightA = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x1 >= rackACenter - 40) : (x1 >= rackACenter + 40)));
        const useRightB = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x2 >= rackBCenter + 40) : (x2 >= rackBCenter - 40)));

        const bundleIdxA = useRightA ? rightChannelUsage++ : leftChannelUsage++;
        const channelXA = (useRightA ? boundsA.right : boundsA.left) + svgRailOffset(bundleIdxA, false);

        const bundleIdxB = useRightB ? rightChannelUsage++ : leftChannelUsage++;
        const channelXB = (useRightB ? boundsB.right : boundsB.left) + svgRailOffset(bundleIdxB, false);

        const actualTrayYA = trayYA + svgTrayOffset(bundleIdxA, false);
        const actualTrayYB = trayYB + svgTrayOffset(bundleIdxB, false);
        const overheadTrayY = Math.min(topYA, topYB) - 18 - (bundleIdxA % 8) * 4;

        const dirY1 = actualTrayYA >= y1 ? 1 : -1;
        const dirX1 = channelXA >= x1 ? 1 : -1;
        const r1 = Math.min(8, Math.abs(channelXA - x1) / 2, Math.abs(actualTrayYA - y1) / 2 || 4);

        const distRailYA = Math.abs(actualTrayYA - overheadTrayY);
        const rRailA = Math.min(10, Math.abs(channelXA - x1) / 2, distRailYA / 2 || 6);

        const dirX_top = channelXB >= channelXA ? 1 : -1;
        const distTopX = Math.abs(channelXB - channelXA);
        const rTopA = Math.min(10, distTopX / 2 || 6, distRailYA / 2 || 6);

        const distRailYB = Math.abs(actualTrayYB - overheadTrayY);
        const rTopB = Math.min(10, distTopX / 2 || 6, distRailYB / 2 || 6);

        const dirX2 = x2 >= channelXB ? 1 : -1;
        const rRailB = Math.min(10, Math.abs(x2 - channelXB) / 2, distRailYB / 2 || 6);

        const dirY2 = y2 >= actualTrayYB ? 1 : -1;
        const r2 = Math.min(8, Math.abs(x2 - channelXB) / 2, Math.abs(y2 - actualTrayYB) / 2 || 4);

        pathD = `M ${x1} ${y1} ` +
                `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                `L ${channelXA - dirX1 * rRailA} ${actualTrayYA} ` +
                `Q ${channelXA} ${actualTrayYA} ${channelXA} ${actualTrayYA - rRailA} ` +
                `L ${channelXA} ${overheadTrayY + rTopA} ` +
                `Q ${channelXA} ${overheadTrayY} ${channelXA + dirX_top * rTopA} ${overheadTrayY} ` +
                `L ${channelXB - dirX_top * rTopB} ${overheadTrayY} ` +
                `Q ${channelXB} ${overheadTrayY} ${channelXB} ${overheadTrayY + rTopB} ` +
                `L ${channelXB} ${actualTrayYB - rRailB} ` +
                `Q ${channelXB} ${actualTrayYB} ${channelXB + dirX2 * rRailB} ${actualTrayYB} ` +
                `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                `L ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = computeCableLength('interrack-structured', {
            x1, y1, x2, y2, channelXA, channelXB,
            trayYA: actualTrayYA, trayYB: actualTrayYB, overheadTrayY
          });
        }
      } else if (STATE.cableRoutingMode === 'direct') {
        const dy = Math.abs(y2 - y1);
        const sag = Math.min(180, Math.max(28, dy * 0.45));
        const midY = (y1 + y2) / 2 + sag;
        const cp1x = x1 + (x2 - x1) * 0.25;
        const cp2x = x1 + (x2 - x1) * 0.75;
        pathD = `M ${x1} ${y1} C ${cp1x} ${midY}, ${cp2x} ${midY}, ${x2} ${y2}`;
      } else {
        const devA = RS.getDeviceById ? RS.getDeviceById(instA) : STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA);
        const devB = RS.getDeviceById ? RS.getDeviceById(instB) : STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB);
        const rackA = RS.getRackById ? RS.getRackById(cable.from.rackId) : activeRack;

        if (instA === instB) {
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        } else {
          const orgA = findDeviceOrganizer(rackA, devA);
          const orgB = findDeviceOrganizer(rackA, devB);
          let trayYA = getCachedOrgY(orgA, y1, y2);
          let trayYB = getCachedOrgY(orgB, y2, y1);

          if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
            const organizerY = trayYA;
            const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
            trayYA = organizerY + (isATop ? -6 : 6);
            trayYB = organizerY + (isATop ? 6 : -6);
          }

          const boundsA = getRackRailBounds(rackA?.id);
          const rackCenterLine = (boundsA.left + boundsA.right) / 2;
          const useRight = resolveCableDuctSide(cable, x1, x2, rackCenterLine, leftChannelUsage, rightChannelUsage);
          const channelBase = useRight ? boundsA.right : boundsA.left;
          const bundleIdx = useRight ? rightChannelUsage++ : leftChannelUsage++;
          const channelX = channelBase + svgRailOffset(bundleIdx);

          const actualTrayYA = trayYA + svgTrayOffset(bundleIdx);
          const actualTrayYB = trayYB + svgTrayOffset(bundleIdx);

          const dirY1 = actualTrayYA >= y1 ? 1 : -1;
          const dirX1 = channelX >= x1 ? 1 : -1;
          const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(actualTrayYA - y1) / 2);

          const dirY_rail = actualTrayYB >= actualTrayYA ? 1 : -1;
          const distRailY = Math.abs(actualTrayYB - actualTrayYA);
          const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);

          const dirX2 = x2 >= channelX ? 1 : -1;
          const rRail2 = Math.min(10, Math.abs(x2 - channelX) / 2, distRailY / 2 || 6);

          const dirY2 = y2 >= actualTrayYB ? 1 : -1;
          const r2 = Math.min(8, Math.abs(x2 - channelX) / 2, Math.abs(y2 - actualTrayYB) / 2);

          pathD = `M ${x1} ${y1} ` +
                  `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                  `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                  `L ${channelX - dirX1 * rRail1} ${actualTrayYA} ` +
                  `Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA + dirY_rail * rRail1} ` +
                  `L ${channelX} ${actualTrayYB - dirY_rail * rRail2} ` +
                  `Q ${channelX} ${actualTrayYB} ${channelX + dirX2 * rRail2} ${actualTrayYB} ` +
                  `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                  `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                  `L ${x2} ${y2}`;
          if (cable.lengthMeters == null) {
            cable.lengthMeters = computeCableLength('structured', {
              x1, y1, x2, y2, channelX,
              trayYA: actualTrayYA, trayYB: actualTrayYB,
              hasOrganizer: !!(orgA || orgB)
            });
          }
        }
      }

      const colorHex = cable.color || '#2563eb';
      const colorNum = hexColorToNumber(colorHex);
      const geometrySignature = cableGeometrySignature(cable);
      let display = cableDisplays.get(cable.id);

      if (!display) {
        if (usesBatchedViewportRenderer()) {
          display = { visualAlpha: 1, glowAlpha: 0, previewColorNum: null };
        } else {
          const glow = new window.PIXI.Graphics();
          glow.eventMode = 'none';
          const casing = new window.PIXI.Graphics();
          const core = new window.PIXI.Graphics();
          const bootA = new window.PIXI.Graphics();
          bootA.eventMode = 'static';
          bootA.cursor = 'pointer';
          bootA.__cableId = cable.id;
          bootA.on('pointerdown', (e) => handleCablePointerDown(cable.id, e));
          const bootB = new window.PIXI.Graphics();
          bootB.eventMode = 'static';
          bootB.cursor = 'pointer';
          bootB.__cableId = cable.id;
          bootB.on('pointerdown', (e) => handleCablePointerDown(cable.id, e));
          cablesContainer.addChild(glow, casing, core);
          connectorsContainer.addChild(bootA, bootB);
          display = { glow, casing, core, boots: [bootA, bootB] };
        }
        cableDisplays.set(cable.id, display);
        renderStats.createdDisplays++;
      } else {
        renderStats.reusedDisplays++;
      }

      display.pathD = pathD;
      display.colorNum = colorNum;
      display.geometrySignature = geometrySignature;
      display.rackKey = cable.from?.rackId && cable.from.rackId === cable.to?.rackId ? cable.from.rackId : '__cross__';
      display.isStub = isStub;
      display.stubBadgeText = stubBadgeText;
      display.stubPoint = isStub ? { x: isFromMounted ? x2 : x1, y: isFromMounted ? y2 : y1 } : null;
      display.isRightExit = isRightExit;
      display.endpoints = isStub ? [{ x: isFromMounted ? x1 : x2, y: isFromMounted ? y1 : y2 }] : [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      geometryChangedIds.add(cable.id);
      if (!usesBatchedViewportRenderer()) {
        redrawCableDisplay(cable.id);
        cablesContainer.addChild(display.glow, display.casing, display.core);
        display.boots.forEach(boot => connectorsContainer.addChild(boot));
      }
    });

    for (const [id, display] of cableDisplays) {
      if (seenCableIds.has(id)) continue;
      destroyCableDisplay(display);
      removeCableFromSpatialIndex(id);
      cableDisplays.delete(id);
    }

    if (appendOnlyGeometry) {
      geometryChangedIds.forEach(cableId => indexCableDisplay(cableId, cableDisplays.get(cableId)));
      performanceTelemetry.spatialIncrementalUpdates += geometryChangedIds.size;
    } else {
      rebuildSpatialIndex();
      performanceTelemetry.spatialFullRebuilds++;
    }
    if (usesBatchedViewportRenderer()) {
      if (!appendOnlyGeometry || !appendBatchedDisplays(geometryChangedIds)) rebuildBatchedBase();
      refreshCableFocus(new Set(), false);
    }

    // One retained Graphics object batches all D-ring foreground hoops.
    if (layoutChanged) {
      const hoops = new window.PIXI.Graphics();
      hoops.eventMode = 'none';
      document.querySelectorAll('.dring-loop').forEach(loop => {
        const rect = loop.getBoundingClientRect();
        renderStats.domRectReads++;
        if (rect.width <= 0 || rect.height <= 0) return;
        const topLeft = clientToPixi(rect.left, rect.top);
        const bottomRight = clientToPixi(rect.right, rect.bottom);
        const x = topLeft.x;
        const y = topLeft.y;
        const w = bottomRight.x - topLeft.x;
        const h = bottomRight.y - topLeft.y;
        if (w <= 0 || h <= 0) return;
        const padX = w * (6 / 38);
        const padY = h * (5 / 22);
        hoops.rect(x, y, w, padY).fill(0x141b26);
        hoops.rect(x, y + h - padY, w, padY).fill(0x141b26);
        hoops.rect(x, y + padY, padX, h - padY * 2).fill(0x141b26);
        hoops.rect(x + w - padX, y + padY, padX, h - padY * 2).fill(0x141b26);
        hoops.roundRect(x, y, w, h, Math.max(2, w * 0.1))
          .stroke({ width: Math.max(1.2, w * 0.048), color: 0x56687e, alpha: 1 });
        hoops.roundRect(x + padX, y + padY, w - padX * 2, h - padY * 2, Math.max(1, w * 0.05))
          .stroke({ width: Math.max(0.8, w * 0.026), color: 0x1a2332, alpha: 1 });
      });
      organizerOverlayContainer.addChild(hoops);
      performanceTelemetry.organizerOverlayRebuilds++;
    }

    lastSceneSignature = sceneSignature;
    lastLayoutSignature = layoutSignature;
    lastVisibleCableOrder = visibleCables.map(cable => cable.id);
    lastChannelUsage = { left: leftChannelUsage, right: rightChannelUsage };
    renderStats.lastDurationMs = performance.now() - renderStartedAt;
    if (STATE.pixiViewportRendererV2 !== false) {
      lastCameraSignature = null;
      syncPixiViewportCamera(RS.ZOOM_STATE, true, 'scene');
    } else {
      renderPixi('scene');
    }
  }

  function setCableRenderMode(mode) {
    if (mode !== 'pixi' && mode !== 'svg') mode = 'svg';
    STATE.cableRenderMode = mode;
    try {
      localStorage.setItem('rackstudio_cable_mode', mode);
    } catch (_) {}

    const svgEl = document.getElementById('cables-svg');
    const parentContainer = svgEl?.parentNode || document.getElementById('rack-container') || document.getElementById('rack-stage');
    const canvas = ensurePixiCanvas(svgEl, parentContainer);

    if (mode === 'pixi') {
      if (canvas) canvas.style.display = 'block';
      if (svgEl) svgEl.style.display = 'none';
    } else {
      if (canvas) canvas.style.display = 'none';
      if (canvas) canvas.style.pointerEvents = 'none';
      if (svgEl) svgEl.style.display = 'block';
      setPixiHover(null);
    }

    if (RS.renderAllCables) {
      RS.renderAllCables();
    }

    const btnIndicator = document.getElementById('cable-engine-indicator');
    if (btnIndicator) {
      btnIndicator.textContent = mode === 'pixi' ? '⚡ GPU (Pixi)' : '🎨 SVG';
      btnIndicator.style.color = mode === 'pixi' ? '#00e5ff' : '#94a3b8';
    }
  }

  function appendSingleCablePixi(cable) {
    if (!cable) return;
    if (cableTransactionDepth > 0) {
      queuedTransactionCableIds.add(cable.id);
      performanceTelemetry.transactionCables++;
      performanceTelemetry.transactionRendersAvoided++;
      return { queued: true, cableId: cable.id };
    }
    renderAllCablesPixi();
  }

  function beginPixiCableTransaction() {
    if (cableTransactionDepth === 0) {
      queuedTransactionCableIds.clear();
      performanceTelemetry.batchTransactions++;
    }
    cableTransactionDepth++;
    return cableTransactionDepth;
  }

  function flushPixiCableTransaction() {
    if (queuedTransactionCableIds.size === 0) return 0;
    const cableCount = queuedTransactionCableIds.size;
    queuedTransactionCableIds.clear();
    performanceTelemetry.transactionFlushes++;
    performanceTelemetry.maxTransactionSize = Math.max(performanceTelemetry.maxTransactionSize, cableCount);
    renderAllCablesPixi();
    return cableCount;
  }

  function endPixiCableTransaction() {
    if (cableTransactionDepth === 0) return 0;
    cableTransactionDepth--;
    if (cableTransactionDepth > 0) return 0;
    return flushPixiCableTransaction();
  }

  RS.appendSingleCablePixi = appendSingleCablePixi;
  RS.beginPixiCableTransaction = beginPixiCableTransaction;
  RS.flushPixiCableTransaction = flushPixiCableTransaction;
  RS.endPixiCableTransaction = endPixiCableTransaction;
  RS.renderAllCablesPixi = renderAllCablesPixi;
  RS.setCableRenderMode = setCableRenderMode;
  RS.setPixiViewportRendererV2 = enabled => {
    try { localStorage.setItem('rackstudio_pixi_viewport_v2', enabled ? '1' : '0'); } catch (_) {}
    STATE.pixiViewportRendererV2 = !!enabled;
    return { enabled: !!enabled, reloadRequired: !!pixiApp };
  };
  RS.getOrCreatePixiCanvas = getOrCreatePixiCanvas;
  RS.setPixiCableHover = (cableId, isHovered) => {
    setPixiHover(isHovered ? cableId : null);
  };
  RS.setPixiCableGroupHover = cableIds => {
    const nextGroup = new Set(Array.isArray(cableIds) ? cableIds : []);
    if (!hoveredCableId && nextGroup.size === groupHoveredCableIds.size && Array.from(nextGroup).every(id => groupHoveredCableIds.has(id))) {
      performanceTelemetry.duplicateFocusSkips++;
      return false;
    }
    const changed = new Set(groupHoveredCableIds);
    if (hoveredCableId) changed.add(hoveredCableId);
    hoveredCableId = null;
    groupHoveredCableIds = nextGroup;
    groupHoveredCableIds.forEach(id => changed.add(id));
    refreshCableFocus(changed);
    return true;
  };
  RS.syncPixiCableSelection = () => {
    if (lastSelectionCableId === STATE.highlightedCableId) {
      performanceTelemetry.duplicateSelectionSkips++;
      return false;
    }
    lastSelectionCableId = STATE.highlightedCableId || null;
    if (usesBatchedViewportRenderer()) rebuildBatchedFocus();
    else for (const id of cableDisplays.keys()) redrawCableDisplay(id);
    renderPixi('selection-sync');
    return true;
  };
  RS.invalidatePixiCableGeometry = cableIds => {
    if (Array.isArray(cableIds)) cableIds.forEach(id => removeCableFromSpatialIndex(id));
    lastSceneSignature = null;
  };
  RS.invalidatePixiLayoutGeometry = invalidateLayoutGeometryCache;
  RS.previewPixiCableColor = (cableId, color) => {
    const display = cableDisplays.get(cableId);
    if (!display) return;
    const nextPreviewColor = color ? hexColorToNumber(color) : null;
    if ((display.previewColorNum ?? null) === nextPreviewColor) {
      performanceTelemetry.duplicatePreviewSkips++;
      return false;
    }
    display.previewColorNum = nextPreviewColor;
    redrawCableDisplay(cableId);
    renderPixi('color-preview');
    return true;
  };
  // Alias used by cable-hud.js for preview hover on color swatches
  RS.setPixiCablePreviewColor = RS.previewPixiCableColor;
  RS.hitTestPixiCable = (clientX, clientY) => hitCableAt(clientX, clientY);
  RS.syncPixiViewportCamera = syncPixiViewportCamera;
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
    return {
      profile: pixiPerformanceMode,
      interactionMode: interactionResolutionActive,
      rendersPerSecond: eventsPerSecond(performanceTelemetry.renderEvents),
      geometryPassesPerSecond: eventsPerSecond(performanceTelemetry.geometryEvents),
      hoverChangesPerSecond: eventsPerSecond(performanceTelemetry.hoverEvents),
      resizeEventsPerSecond: eventsPerSecond(performanceTelemetry.resizeEvents),
      totalRenders: performanceTelemetry.totalRenders,
      resolutionChanges: performanceTelemetry.resolutionChanges,
      avoidedFocusRenders: performanceTelemetry.avoidedFocusRenders,
      duplicateCameraSkips: performanceTelemetry.duplicateCameraSkips,
      duplicateFocusSkips: performanceTelemetry.duplicateFocusSkips,
      duplicateSelectionSkips: performanceTelemetry.duplicateSelectionSkips,
      duplicatePreviewSkips: performanceTelemetry.duplicatePreviewSkips,
      layoutCacheInvalidations: performanceTelemetry.layoutCacheInvalidations,
      endpointCacheHits: performanceTelemetry.endpointCacheHits,
      endpointCacheMisses: performanceTelemetry.endpointCacheMisses,
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
      batchTransactions: performanceTelemetry.batchTransactions,
      transactionFlushes: performanceTelemetry.transactionFlushes,
      transactionCables: performanceTelemetry.transactionCables,
      transactionRendersAvoided: performanceTelemetry.transactionRendersAvoided,
      maxTransactionSize: performanceTelemetry.maxTransactionSize,
      pendingTransactionCables: queuedTransactionCableIds.size,
      cableTransactionDepth,
      retainedEndpointCount: endpointWorldCache.size,
      retainedRackGeometryCount: rackRailWorldCache.size,
      retainedOrganizerCount: organizerWorldYCache.size,
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
  RS.getPixiCableInteractionState = () => ({
    hoveredCableId,
    groupHoveredCableIds: Array.from(groupHoveredCableIds),
    selectedCableId: STATE.highlightedCableId,
    displayCount: cableDisplays.size,
    organizerOverlayCount: organizerOverlayContainer?.children?.length || 0,
    renderStats: { ...renderStats },
    resolution: pixiApp?.renderer?.resolution || 0,
    adaptiveResolution: currentRenderResolution,
    viewportRendererV2: STATE.pixiViewportRendererV2 !== false,
    rendererSize: { width: lastWidth, height: lastHeight },
    worldSize: { width: lastWorldWidth, height: lastWorldHeight },
    spatialCellCount: spatialGrid.size,
    blurredGlowCount: focusContainer?.children?.filter(child => child.filters?.length).length || 0,
    performance: RS.getPixiPerformanceTelemetry(),
    alphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, usesBatchedViewportRenderer() ? (display.visualAlpha ?? 1) : display.core.alpha])),
    glowAlphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, usesBatchedViewportRenderer() ? (display.glowAlpha ?? 0) : display.glow.alpha])),
    colorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.colorNum])),
    previewColorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.previewColorNum ?? null]))
  });
})();
