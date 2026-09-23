/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS v8 GPU Cabling Layer
 * High-performance WebGL/WebGPU cable rendering with sub-pixel Retina sharpness,
 * zero DOM overhead, and interactive hit-testing.
 * Modular orchestrator coordinating device scene, spatial indexing, and cable batching.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);

  let lastSelectionCableId = null;
  let lastSceneSignature = null;
  let lastLayoutSignature = null;
  let layoutCacheWasExplicitlyInvalidated = false;
  let lastVisibleCableOrder = [];
  let lastChannelUsage = { left: 0, right: 0 };
  let lastWorldWidth = 0;
  let lastWorldHeight = 0;
  let cableTransactionDepth = 0;
  const queuedTransactionCableIds = new Set();

  const cableDisplays = new Map();
  const batchedRackGroups = new Map();

  PixiContext.cableDisplays = cableDisplays;
  PixiContext.batchedRackGroups = batchedRackGroups;
  PixiContext.queuedTransactionCableIds = queuedTransactionCableIds;
  Object.defineProperty(PixiContext, 'cableTransactionDepth', {
    get: () => cableTransactionDepth,
    set: v => { cableTransactionDepth = v; },
    configurable: true
  });

  const renderStats = PixiContext.renderStats;
  const performanceTelemetry = PixiContext.performanceTelemetry;

  const usesBatchedViewportRenderer = () => STATE.pixiViewportRendererV2 !== false;

  const cableGeometrySignature = cable => (RS.PixiCableGeometry ? RS.PixiCableGeometry.cableGeometrySignature(cable) : '');
  const cableRackBatchKey = cable => (RS.PixiCableGeometry ? RS.PixiCableGeometry.cableRackBatchKey(cable) : 'unknown');
  const hexColorToNumber = hex => (RS.PixiCableGeometry ? RS.PixiCableGeometry.hexColorToNumber(hex) : 0x2563eb);

  function buildSceneSignature(stageW, stageH, isMulti, activeRack) {
    const rackSignature = isMulti
      ? (STATE.racks || []).map(r => `${r.id}:${r.heightU || 42}:${r.devices.length}`).join('|')
      : `${activeRack?.id || 'r1'}:${activeRack?.heightU || 42}:${activeRack?.devices?.length || 0}`;
    return `${stageW}x${stageH}|${STATE.viewMode}|${STATE.cableRoutingMode}|${STATE.pixiViewportRendererV2 !== false ? 'v2' : 'v1'}|${rackSignature}`;
  }

  function buildLayoutSignature(stageW, stageH, isMulti, activeRack) {
    const deviceSignature = isMulti
      ? (STATE.racks || []).map(r => `${r.id}:${(r.devices || []).map(d => `${d.instanceId}:${d.topU || ''}`).join(',')}`).join('|')
      : `${activeRack?.id || 'r1'}:${(activeRack?.devices || []).map(d => `${d.instanceId}:${d.topU || ''}`).join(',')}`;
    return `${stageW}x${stageH}|${STATE.viewMode}|${STATE.cableRoutingMode}|${deviceSignature}`;
  }

  function invalidateLayoutGeometryCache() {
    RS.PixiCableGeometry?.invalidateLayoutGeometryCache?.();
    lastLayoutSignature = null;
    lastSceneSignature = null;
    lastVisibleCableOrder = [];
    lastChannelUsage = { left: 0, right: 0 };
    layoutCacheWasExplicitlyInvalidated = true;
    if (performanceTelemetry) performanceTelemetry.layoutCacheInvalidations++;
  }

  function renderAllCablesPixi() {
    const renderStartedAt = performance.now();
    if (renderStats) renderStats.calls++;
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

    const canvas = PixiContext.ensurePixiCanvas ? PixiContext.ensurePixiCanvas(svgEl, parentContainer) : null;
    const viewportHost = document.getElementById('viewport-canvas') || parentContainer;
    const viewportW = Math.max(1, viewportHost?.clientWidth || stageW);
    const viewportH = Math.max(1, viewportHost?.clientHeight || stageH);
    const rendererW = STATE.pixiViewportRendererV2 !== false ? viewportW : stageW;
    const rendererH = STATE.pixiViewportRendererV2 !== false ? viewportH : stageH;

    let pixiApp = PixiContext.pixiApp;
    if (!pixiApp) {
      if (PixiContext.ensurePixiApp) {
        PixiContext.ensurePixiApp(parentContainer, rendererW, rendererH).then(app => {
          if (app) renderAllCablesPixi();
          else PixiContext.activateSvgFallback?.();
        });
      }
      return;
    }

    if (svgEl) svgEl.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    RS.PixiDeviceScene?.syncPixiDeviceSceneLOD();

    let rendererResized = false;
    if (PixiContext.lastWidth !== rendererW || PixiContext.lastHeight !== rendererH) {
      pixiApp.renderer.resize(rendererW, rendererH);
      PixiContext.lastWidth = rendererW;
      PixiContext.lastHeight = rendererH;
      rendererResized = true;
    }
    lastWorldWidth = stageW;
    lastWorldHeight = stageH;
    PixiContext.lastWorldWidth = stageW;
    PixiContext.lastWorldHeight = stageH;
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
        RS.PixiCableGeometry?.invalidateLayoutGeometryCache?.();
        if (performanceTelemetry) performanceTelemetry.layoutCacheInvalidations++;
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

    // Incremental Removal Pass
    if (removalOnlyMutation) {
      const affectedRackKeys = new Set();
      for (const cableId of removedCableIds) {
        const display = cableDisplays.get(cableId);
        if (display) affectedRackKeys.add(display.rackKey || '__cross__:unknown:unknown');
        if (display) RS.PixiCableBatch?.destroyCableDisplay(display);
        RS.removeCableFromSpatialIndex?.(cableId);
        cableDisplays.delete(cableId);
        PixiContext.getGroupHoveredCableIds?.()?.delete(cableId);
        if (PixiContext.getHoveredCableId?.() === cableId) PixiContext.setHoveredCableId?.(null);
      }
      if (usesBatchedViewportRenderer()) {
        if (!RS.PixiCableBatch?.rebuildBatchedRackGroups(affectedRackKeys)) RS.PixiCableBatch?.rebuildBatchedBase();
        RS.PixiCableBatch?.rebuildBatchedFocus();
      }
      if (performanceTelemetry) {
        performanceTelemetry.incrementalRemovalPasses++;
        performanceTelemetry.incrementalCablesRemoved += removedCableIds.size;
        performanceTelemetry.avoidedRemovalGeometryPasses++;
        performanceTelemetry.spatialIncrementalRemovals += removedCableIds.size;
      }
      lastSceneSignature = sceneSignature;
      lastLayoutSignature = layoutSignature;
      lastVisibleCableOrder = visibleCables.map(cable => cable.id);
      if (renderStats) renderStats.lastDurationMs = performance.now() - renderStartedAt;
      if (rendererResized) PixiContext.syncPixiViewportCamera?.(RS.ZOOM_STATE, true, 'resize');
      else PixiContext.renderPixi?.('remove');
      return;
    }

    // Fast Path (unchanged geometry)
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
        if (renderStats) renderStats.fastPathHits++;
        if (styleChangedIds.size > 0) {
          if (performanceTelemetry) {
            performanceTelemetry.incrementalStylePasses++;
            performanceTelemetry.incrementalStyleCables += styleChangedIds.size;
          }
          if (usesBatchedViewportRenderer()) {
            if (!RS.PixiCableBatch?.rebuildBatchedStyleGroups(previousColorsByCableId)) {
              RS.PixiCableBatch?.rebuildBatchedBase();
            }
            RS.PixiCableBatch?.rebuildBatchedFocus();
          } else {
            for (const id of styleChangedIds) RS.PixiCableBatch?.redrawCableDisplay(id);
          }
        }
        if (renderStats) renderStats.lastDurationMs = performance.now() - renderStartedAt;
        if (rendererResized) PixiContext.syncPixiViewportCamera?.(RS.ZOOM_STATE, true, 'resize');
        else if (styleChangedIds.size > 0) PixiContext.renderPixi?.('style');
        return;
      }
    }

    // Geometry Generation Pass
    if (renderStats) renderStats.geometryPasses++;
    if (performanceTelemetry) {
      if (appendOnlyGeometry) performanceTelemetry.incrementalGeometryPasses++;
      else performanceTelemetry.fullGeometryPasses++;
    }

    const seenCableIds = appendOnlyGeometry ? new Set(lastVisibleCableOrder) : new Set();
    const geometryChangedIds = new Set();
    const organizerOverlayContainer = PixiContext.organizerOverlayContainer;
    if (layoutChanged && organizerOverlayContainer) {
      organizerOverlayContainer.removeChildren().forEach(child => child.destroy?.());
    }

    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
    if (renderStats) renderStats.domRectReads++;

    let leftChannelUsage = appendOnlyGeometry ? lastChannelUsage.left : 0;
    let rightChannelUsage = appendOnlyGeometry ? lastChannelUsage.right : 0;

    const routeCtx = {
      activeRack,
      canvasRect,
      stageW,
      stageH,
      seenCableIds,
      leftChannelUsage,
      rightChannelUsage
    };

    const cables = appendOnlyGeometry ? visibleCables.slice(lastVisibleCableOrder.length) : visibleCables;
    if (appendOnlyGeometry && performanceTelemetry) performanceTelemetry.incrementalCablesProcessed += cables.length;

    const cablesContainer = PixiContext.cablesContainer;
    const connectorsContainer = PixiContext.connectorsContainer;

    cables.forEach(cable => {
      const route = RS.PixiCableGeometry?.calculateCableRoute(cable, routeCtx);
      if (!route) return;

      const { pathD, colorNum, geometrySignature, rackKey, isStub, stubBadgeText, stubPoint, isRightExit, endpoints } = route;
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
          bootA.on('pointerdown', e => RS.handleCablePointerDown?.(cable.id, e));
          const bootB = new window.PIXI.Graphics();
          bootB.eventMode = 'static';
          bootB.cursor = 'pointer';
          bootB.__cableId = cable.id;
          bootB.on('pointerdown', e => RS.handleCablePointerDown?.(cable.id, e));
          if (cablesContainer) cablesContainer.addChild(glow, casing, core);
          if (connectorsContainer) connectorsContainer.addChild(bootA, bootB);
          display = { glow, casing, core, boots: [bootA, bootB] };
        }
        cableDisplays.set(cable.id, display);
        if (renderStats) renderStats.createdDisplays++;
      } else {
        if (renderStats) renderStats.reusedDisplays++;
      }

      if (usesBatchedViewportRenderer() && (display.pathD !== pathD || display.colorNum !== colorNum)) {
        RS.PixiCableBatch?.destroyFocusVariants(display);
      }
      display.pathD = pathD;
      display.colorNum = colorNum;
      display.geometrySignature = geometrySignature;
      display.rackKey = rackKey;
      display.isStub = isStub;
      display.stubBadgeText = stubBadgeText;
      display.stubPoint = stubPoint;
      display.isRightExit = isRightExit;
      display.endpoints = endpoints;
      geometryChangedIds.add(cable.id);
      if (!usesBatchedViewportRenderer()) {
        RS.PixiCableBatch?.redrawCableDisplay(cable.id);
        if (cablesContainer) cablesContainer.addChild(display.glow, display.casing, display.core);
        display.boots?.forEach(boot => connectorsContainer && connectorsContainer.addChild(boot));
      }
    });

    leftChannelUsage = routeCtx.leftChannelUsage;
    rightChannelUsage = routeCtx.rightChannelUsage;

    for (const [id, display] of cableDisplays) {
      if (seenCableIds.has(id)) continue;
      RS.PixiCableBatch?.destroyCableDisplay(display);
      RS.removeCableFromSpatialIndex?.(id);
      cableDisplays.delete(id);
    }

    if (appendOnlyGeometry) {
      geometryChangedIds.forEach(cableId => RS.indexCableDisplay?.(cableId, cableDisplays.get(cableId)));
      if (performanceTelemetry) performanceTelemetry.spatialIncrementalUpdates += geometryChangedIds.size;
    } else {
      RS.rebuildSpatialIndex?.();
      if (performanceTelemetry) performanceTelemetry.spatialFullRebuilds++;
    }

    if (usesBatchedViewportRenderer()) {
      if (!appendOnlyGeometry || !RS.PixiCableBatch?.appendBatchedDisplays(geometryChangedIds)) RS.PixiCableBatch?.rebuildBatchedBase();
      RS.PixiCableBatch?.refreshCableFocus(new Set(), false);
    }

    // D-ring foreground hoops overlay
    if (layoutChanged && organizerOverlayContainer) {
      const hoops = new window.PIXI.Graphics();
      hoops.eventMode = 'none';
      document.querySelectorAll('.dring-loop').forEach(loop => {
        const rect = loop.getBoundingClientRect();
        if (renderStats) renderStats.domRectReads++;
        if (rect.width <= 0 || rect.height <= 0) return;
        const topLeft = RS.PixiCableGeometry?.clientToPixi(rect.left, rect.top, canvasRect, stageW, stageH) || { x: 0, y: 0 };
        const bottomRight = RS.PixiCableGeometry?.clientToPixi(rect.right, rect.bottom, canvasRect, stageW, stageH) || { x: 0, y: 0 };
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
      if (performanceTelemetry) performanceTelemetry.organizerOverlayRebuilds++;
    }

    lastSceneSignature = sceneSignature;
    lastLayoutSignature = layoutSignature;
    lastVisibleCableOrder = visibleCables.map(cable => cable.id);
    lastChannelUsage = { left: leftChannelUsage, right: rightChannelUsage };
    if (renderStats) renderStats.lastDurationMs = performance.now() - renderStartedAt;
    if (STATE.pixiViewportRendererV2 !== false) {
      PixiContext.resetCameraSignature?.();
      PixiContext.syncPixiViewportCamera?.(RS.ZOOM_STATE, true, 'scene');
    } else {
      PixiContext.renderPixi?.('scene');
    }
  }

  function setCableRenderMode(mode) {
    if (mode !== 'pixi' && mode !== 'svg') mode = 'svg';
    STATE.cableRenderMode = mode;
    if (mode === 'svg') document.documentElement.setAttribute('data-device-renderer', 'dom');
    try {
      localStorage.setItem('rackstudio_cable_mode', mode);
    } catch (_) {}

    const svgEl = document.getElementById('cables-svg');
    const parentContainer = svgEl?.parentNode || document.getElementById('rack-container') || document.getElementById('rack-stage');
    const canvas = PixiContext.ensurePixiCanvas ? PixiContext.ensurePixiCanvas(svgEl, parentContainer) : null;

    if (mode === 'pixi') {
      if (canvas) canvas.style.display = 'block';
      if (svgEl) svgEl.style.display = 'none';
    } else {
      RS.DeviceSceneRegistry?.restoreDomFaceplates();
      RS.DeviceSceneRegistry?.restoreDomPortAreas();
      if (canvas) {
        canvas.style.display = 'none';
        canvas.style.pointerEvents = 'none';
      }
      if (svgEl) svgEl.style.display = 'block';
      RS.setPixiHover?.(null);
      const devScene = PixiContext.deviceSceneContainer;
      if (devScene) devScene.visible = false;
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
      if (performanceTelemetry) {
        performanceTelemetry.transactionCables++;
        performanceTelemetry.transactionRendersAvoided++;
      }
      return { queued: true, cableId: cable.id };
    }
    renderAllCablesPixi();
  }

  function beginPixiCableTransaction() {
    if (cableTransactionDepth === 0) {
      queuedTransactionCableIds.clear();
      if (performanceTelemetry) performanceTelemetry.batchTransactions++;
    }
    cableTransactionDepth++;
    return cableTransactionDepth;
  }

  function flushPixiCableTransaction() {
    if (queuedTransactionCableIds.size === 0) return 0;
    const cableCount = queuedTransactionCableIds.size;
    queuedTransactionCableIds.clear();
    if (performanceTelemetry) {
      performanceTelemetry.transactionFlushes++;
      performanceTelemetry.maxTransactionSize = Math.max(performanceTelemetry.maxTransactionSize, cableCount);
    }
    renderAllCablesPixi();
    return cableCount;
  }

  function endPixiCableTransaction() {
    if (cableTransactionDepth === 0) return 0;
    cableTransactionDepth--;
    if (cableTransactionDepth > 0) return 0;
    return flushPixiCableTransaction();
  }

  // Exports on window.RackStudio
  RS.appendSingleCablePixi = appendSingleCablePixi;
  RS.beginPixiCableTransaction = beginPixiCableTransaction;
  RS.flushPixiCableTransaction = flushPixiCableTransaction;
  RS.endPixiCableTransaction = endPixiCableTransaction;
  RS.renderAllCablesPixi = renderAllCablesPixi;
  RS.syncPixiDeviceSceneLOD = lod => {
    const changed = RS.PixiDeviceScene?.syncPixiDeviceSceneLOD(lod);
    if (changed) PixiContext.renderPixi?.('device-scene-lod');
    return changed;
  };
  RS.hitPixiDevicePortAt = (x, y) => RS.PixiDeviceScene?.hitDevicePortAt(x, y);
  RS.getPixiPortRoleColor = (...args) => RS.PixiDeviceScene?.getDevicePortRoleColor(...args);
  RS.setCableRenderMode = setCableRenderMode;
  RS.setPixiViewportRendererV2 = enabled => {
    try { localStorage.setItem('rackstudio_pixi_viewport_v2', enabled ? '1' : '0'); } catch (_) {}
    STATE.pixiViewportRendererV2 = !!enabled;
    return { enabled: !!enabled, reloadRequired: !!PixiContext.pixiApp };
  };
  RS.setPixiCableHover = (cableId, isHovered) => {
    RS.setPixiHover?.(isHovered ? cableId : null);
  };
  RS.setPixiCableGroupHover = cableIds => {
    const groupHoveredCableIds = PixiContext.getGroupHoveredCableIds?.() || new Set();
    const hoveredCableId = PixiContext.getHoveredCableId?.();
    const nextGroup = new Set(Array.isArray(cableIds) ? cableIds : []);
    if (!hoveredCableId && nextGroup.size === groupHoveredCableIds.size && Array.from(nextGroup).every(id => groupHoveredCableIds.has(id))) {
      if (performanceTelemetry) performanceTelemetry.duplicateFocusSkips++;
      return false;
    }
    const changed = new Set(groupHoveredCableIds);
    if (hoveredCableId) changed.add(hoveredCableId);
    PixiContext.setHoveredCableId?.(null);
    groupHoveredCableIds.clear();
    nextGroup.forEach(id => {
      groupHoveredCableIds.add(id);
      changed.add(id);
    });
    RS.PixiCableBatch?.refreshCableFocus(changed);
    return true;
  };
  RS.syncPixiCableSelection = () => {
    if (lastSelectionCableId === STATE.highlightedCableId) {
      if (performanceTelemetry) performanceTelemetry.duplicateSelectionSkips++;
      return false;
    }
    lastSelectionCableId = STATE.highlightedCableId || null;
    if (usesBatchedViewportRenderer()) RS.PixiCableBatch?.rebuildBatchedFocus();
    else for (const id of cableDisplays.keys()) RS.PixiCableBatch?.redrawCableDisplay(id);
    PixiContext.renderPixi?.('selection-sync');
    return true;
  };
  RS.invalidatePixiCableGeometry = cableIds => {
    if (Array.isArray(cableIds)) cableIds.forEach(id => RS.removeCableFromSpatialIndex?.(id));
    lastSceneSignature = null;
  };
  RS.invalidatePixiLayoutGeometry = invalidateLayoutGeometryCache;
  RS.previewPixiCableColor = (cableId, color) => {
    const display = cableDisplays.get(cableId);
    if (!display) return;
    const nextPreviewColor = color ? hexColorToNumber(color) : null;
    if ((display.previewColorNum ?? null) === nextPreviewColor) {
      if (performanceTelemetry) performanceTelemetry.duplicatePreviewSkips++;
      return false;
    }
    display.previewColorNum = nextPreviewColor;
    RS.PixiCableBatch?.redrawCableDisplay(cableId);
    PixiContext.renderPixi?.('color-preview');
    return true;
  };
  RS.setPixiCablePreviewColor = RS.previewPixiCableColor;
  RS.hitTestPixiCable = (clientX, clientY) => RS.hitCableAt?.(clientX, clientY);

  RS.getPixiCableInteractionState = () => {
    const hoveredCableId = PixiContext.getHoveredCableId?.();
    const groupHoveredCableIds = Array.from(PixiContext.getGroupHoveredCableIds?.() || []);
    const pixiApp = PixiContext.pixiApp;
    const focusContainer = PixiContext.focusContainer;
    const organizerOverlayContainer = PixiContext.organizerOverlayContainer;
    return {
      hoveredCableId,
      groupHoveredCableIds,
      selectedCableId: STATE.highlightedCableId,
      displayCount: cableDisplays.size,
      organizerOverlayCount: organizerOverlayContainer?.children?.length || 0,
      renderStats: { ...renderStats },
      resolution: pixiApp?.renderer?.resolution || 0,
      adaptiveResolution: PixiContext.currentRenderResolution || 0,
      viewportRendererV2: STATE.pixiViewportRendererV2 !== false,
      rendererSize: { width: PixiContext.lastWidth || 0, height: PixiContext.lastHeight || 0 },
      worldSize: { width: lastWorldWidth, height: lastWorldHeight },
      spatialCellCount: PixiContext.spatialGrid?.size || 0,
      blurredGlowCount: focusContainer?.children?.filter(child => child.filters?.length).length || 0,
      performance: RS.getPixiPerformanceTelemetry ? RS.getPixiPerformanceTelemetry() : {},
      alphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => {
        if (!usesBatchedViewportRenderer()) return [id, display.core?.alpha || 1];
        const hasHoverFocus = hoveredCableId !== null && hoveredCableId !== undefined || groupHoveredCableIds.length > 0;
        const focused = hoveredCableId === id || groupHoveredCableIds.includes(id);
        return [id, focused ? 1 : (hasHoverFocus ? 0.14 : 1)];
      })),
      glowAlphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => {
        if (!usesBatchedViewportRenderer()) return [id, display.glow?.alpha || 0];
        const hasHoverFocus = hoveredCableId !== null && hoveredCableId !== undefined || groupHoveredCableIds.length > 0;
        const focused = hoveredCableId === id || groupHoveredCableIds.includes(id) || (!hasHoverFocus && id === STATE.highlightedCableId);
        return [id, focused ? 1 : 0];
      })),
      colorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.colorNum])),
      previewColorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.previewColorNum ?? null]))
    };
  };
})();
