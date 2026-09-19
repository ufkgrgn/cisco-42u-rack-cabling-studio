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
  let organizerOverlayContainer = null;
  let isInitializing = false;
  let initPromise = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let currentRenderResolution = 0;
  let hoveredCableId = null;
  let groupHoveredCableIds = new Set();
  let lastSceneSignature = null;
  const cableDisplays = new Map();
  const spatialGrid = new Map();
  const SPATIAL_CELL_SIZE = 32;
  const renderStats = {
    calls: 0,
    fastPathHits: 0,
    geometryPasses: 0,
    createdDisplays: 0,
    reusedDisplays: 0,
    destroyedDisplays: 0,
    domRectReads: 0,
    lastDurationMs: 0
  };

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

  function destroyCableDisplay(display) {
    if (!display) return;
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

  function buildRoundedOrthogonalPath(points, radius = 8) {
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
    for (const [cableId, display] of cableDisplays) {
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
          }
        }
      }
    }
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
    const events = pixiApp?.renderer?.events;
    if (events?.mapPositionToPoint) {
      events.mapPositionToPoint(point, clientX, clientY);
      return point;
    }
    const rect = pixiCanvas?.getBoundingClientRect();
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
      width: selected ? 3.2 : (hovered ? 3.0 : 2.6),
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
      const radius = selected ? 4.0 : (hovered ? 3.8 : 3.4);
      const pinRadius = selected ? 1.6 : (hovered ? 1.4 : 1.2);
      boot.clear();
      boot.circle(point.x, point.y, radius)
        .fill(0x090d16)
        .stroke({ width: selected || hovered ? 2.0 : 1.6, color: activeColor });
      boot.circle(point.x, point.y, pinRadius).fill(activeColor);
      boot.alpha = display.core.alpha;
    });
    if ((hovered || selected) && display.core.parent === cablesContainer) {
      cablesContainer.addChild(display.glow, display.casing, display.core);
      display.boots.forEach(boot => connectorsContainer.addChild(boot));
    }
  }

  function refreshCableFocus(fullyRedrawIds = new Set()) {
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
    pixiApp?.render();
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
    const candidates = new Set();
    for (let x = centerCellX - cellRadius; x <= centerCellX + cellRadius; x++) {
      for (let y = centerCellY - cellRadius; y <= centerCellY + cellRadius; y++) {
        (spatialGrid.get(`${x}:${y}`) || []).forEach(segment => candidates.add(segment));
      }
    }
    let bestCableId = null;
    let bestDistance = Infinity;
    let bestIsEndpoint = false;
    for (const segment of candidates) {
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
    pixiApp?.render();
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
      pixiApp?.render();
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
    const existingPlaceholder = document.getElementById('cables-pixi-canvas');
    if (pixiApp && pixiApp.canvas) {
      const realCanvas = pixiApp.canvas;
      realCanvas.id = 'cables-pixi-canvas';
      realCanvas.className = 'cables-pixi-layer';
      if (existingPlaceholder && existingPlaceholder !== realCanvas) {
        existingPlaceholder.replaceWith(realCanvas);
      } else if (!realCanvas.isConnected) {
        if (svgEl && svgEl.parentNode) {
          svgEl.parentNode.insertBefore(realCanvas, svgEl);
        } else if (parentContainer) {
          parentContainer.appendChild(realCanvas);
        }
      }
      pixiCanvas = realCanvas;
    } else {
      let canvas = existingPlaceholder;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'cables-pixi-canvas';
        canvas.className = 'cables-pixi-layer';
        if (svgEl && svgEl.parentNode) {
          svgEl.parentNode.insertBefore(canvas, svgEl);
        } else if (parentContainer) {
          parentContainer.appendChild(canvas);
        }
      }
      pixiCanvas = canvas;
    }

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

  function getOrCreatePixiCanvas(parentContainer, width, height) {
    const svgEl = document.getElementById('cables-svg');
    return ensurePixiCanvas(svgEl, parentContainer);
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
      const renderResolution = Math.min(3, Math.max(2, (window.devicePixelRatio || 1) * 1.5));
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
      organizerOverlayContainer = new window.PIXI.Container();
      app.stage.addChild(cablesContainer);
      app.stage.addChild(connectorsContainer);
      app.stage.addChild(organizerOverlayContainer);
      app.stage.eventMode = 'passive';

      pixiApp = app;
      currentRenderResolution = renderResolution;
      lastWidth = width;
      lastHeight = height;
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

    if (!pixiApp) {
      ensurePixiApp(parentContainer, stageW, stageH).then(app => {
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

    if (lastWidth !== stageW || lastHeight !== stageH) {
      pixiApp.renderer.resize(stageW, stageH);
      lastWidth = stageW;
      lastHeight = stageH;
    }
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    const sceneSignature = buildSceneSignature(stageW, stageH, isMulti, activeRack);
    const sceneChanged = sceneSignature !== lastSceneSignature;
    const visibleCables = (STATE.cables || []).filter(cable => {
      if (isMulti || !cable.from?.rackId || !cable.to?.rackId) return true;
      return cable.from.rackId === activeRack?.id || cable.to.rackId === activeRack?.id;
    });

    // Fast path: camera, schedule and repeated refresh calls do not change
    // cable geometry. Keep all Graphics objects and avoid every DOM layout read.
    if (!sceneChanged && visibleCables.length === cableDisplays.size) {
      let geometryChanged = false;
      const styleChangedIds = new Set();
      for (const cable of visibleCables) {
        const display = cableDisplays.get(cable.id);
        if (!display || display.geometrySignature !== cableGeometrySignature(cable)) {
          geometryChanged = true;
          break;
        }
        const colorNum = hexColorToNumber(cable.color || '#2563eb');
        if (display.colorNum !== colorNum) {
          display.colorNum = colorNum;
          styleChangedIds.add(cable.id);
        }
      }
      if (!geometryChanged) {
        styleChangedIds.forEach(redrawCableDisplay);
        renderStats.fastPathHits++;
        renderStats.lastDurationMs = performance.now() - renderStartedAt;
        if (styleChangedIds.size) pixiApp.render();
        return;
      }
    }

    renderStats.geometryPasses++;
    const seenCableIds = new Set();
    if (sceneChanged) {
      organizerOverlayContainer.removeChildren().forEach(child => child.destroy?.());
    }

    const rackCont = document.getElementById('rack-container') || parentContainer;
    const canvasRect = canvas.getBoundingClientRect();
    renderStats.domRectReads++;

    function clientToPixi(clientX, clientY) {
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return { x: 0, y: 0 };
      return { x: (clientX - canvasRect.left) * stageW / canvasRect.width, y: (clientY - canvasRect.top) * stageH / canvasRect.height };
    }

    const portRects = new Map();
    function getPortRect(el) {
      if (!el) return null;
      const key = el.id || el;
      let r = portRects.get(key);
      if (!r) {
        r = el.getBoundingClientRect();
        renderStats.domRectReads++;
        portRects.set(key, r);
      }
      return r;
    }

    const rackRailCache = new Map();
    function getRackRailBounds(rackId) {
      if (!rackId) return { left: 23, right: 595, top: 0 };
      if (rackRailCache.has(rackId)) return rackRailCache.get(rackId);
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
      rackRailCache.set(rackId, bounds);
      return bounds;
    }

    const orgYCache = new Map();
    function getCachedOrgY(org, fallbackY, otherY) {
      if (!org || !org.instanceId) return fallbackY + (otherY >= fallbackY ? 14 : -14);
      if (orgYCache.has(org.instanceId)) return orgYCache.get(org.instanceId);
      const orgEl = document.getElementById(org.instanceId);
      if (orgEl) {
        const r = orgEl.getBoundingClientRect();
        renderStats.domRectReads++;
        const y = clientToPixi(0, r.top + r.height / 2).y;
        orgYCache.set(org.instanceId, y);
        return y;
      }
      return fallbackY + (otherY >= fallbackY ? 14 : -14);
    }

    let leftChannelUsage = 0;
    let rightChannelUsage = 0;

    const MM_PER_U = 44.45;
    const SVG_PX_PER_U = 32;
    const MM_PER_SVG_Y = MM_PER_U / SVG_PX_PER_U;
    const SLACK_FACTOR = 1.05;

    const cables = visibleCables;

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

      if (!portFromEl || !portToEl) return;

      const rectA = getPortRect(portFromEl);
      const rectB = getPortRect(portToEl);
      if (!rectA || !rectB) return;
      seenCableIds.add(cable.id);

      const p1 = clientToPixi(rectA.left + rectA.width / 2, rectA.top + rectA.height / 2);
      const p2 = clientToPixi(rectB.left + rectB.width / 2, rectB.top + rectB.height / 2);
      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;

      let pathD = '';
      const isInterRack = cable.from.rackId !== cable.to.rackId;

      if (isInterRack && STATE.cableRoutingMode === 'direct') {
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
        const channelXA = (useRightA ? boundsA.right : boundsA.left) + ((bundleIdxA % 9) - 4) * 3.2;

        const bundleIdxB = useRightB ? rightChannelUsage++ : leftChannelUsage++;
        const channelXB = (useRightB ? boundsB.right : boundsB.left) + ((bundleIdxB % 9) - 4) * 3.2;

        const actualTrayYA = trayYA + ((bundleIdxA % 7) - 3) * 2.8;
        const actualTrayYB = trayYB + ((bundleIdxB % 7) - 3) * 2.8;
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
          const channelX = channelBase + ((bundleIdx % 9) - 4) * 3.2;

          const actualTrayYA = trayYA + ((bundleIdx % 7) - 3) * 2.8;
          const actualTrayYB = trayYB + ((bundleIdx % 7) - 3) * 2.8;

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
        cableDisplays.set(cable.id, display);
        renderStats.createdDisplays++;
      } else {
        renderStats.reusedDisplays++;
      }

      display.pathD = pathD;
      display.colorNum = colorNum;
      display.geometrySignature = geometrySignature;
      display.endpoints = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      redrawCableDisplay(cable.id);
      cablesContainer.addChild(display.glow, display.casing, display.core);
      display.boots.forEach(boot => connectorsContainer.addChild(boot));
    });

    for (const [id, display] of cableDisplays) {
      if (seenCableIds.has(id)) continue;
      destroyCableDisplay(display);
      cableDisplays.delete(id);
    }

    rebuildSpatialIndex();

    // One retained Graphics object batches all D-ring foreground hoops.
    if (sceneChanged) {
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
    }

    lastSceneSignature = sceneSignature;
    renderStats.lastDurationMs = performance.now() - renderStartedAt;
    pixiApp.render();
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

  RS.renderAllCablesPixi = renderAllCablesPixi;
  RS.setCableRenderMode = setCableRenderMode;
  RS.getOrCreatePixiCanvas = getOrCreatePixiCanvas;
  RS.setPixiCableHover = (cableId, isHovered) => {
    setPixiHover(isHovered ? cableId : null);
  };
  RS.setPixiCableGroupHover = cableIds => {
    const changed = new Set(groupHoveredCableIds);
    if (hoveredCableId) changed.add(hoveredCableId);
    hoveredCableId = null;
    groupHoveredCableIds = new Set(Array.isArray(cableIds) ? cableIds : []);
    groupHoveredCableIds.forEach(id => changed.add(id));
    refreshCableFocus(changed);
  };
  RS.syncPixiCableSelection = () => {
    for (const id of cableDisplays.keys()) redrawCableDisplay(id);
    pixiApp?.render();
  };
  RS.invalidatePixiCableGeometry = () => {
    lastSceneSignature = null;
  };
  RS.previewPixiCableColor = (cableId, color) => {
    const display = cableDisplays.get(cableId);
    if (!display) return;
    display.previewColorNum = color ? hexColorToNumber(color) : null;
    redrawCableDisplay(cableId);
    pixiApp?.render();
  };
  // Alias used by cable-hud.js for preview hover on color swatches
  RS.setPixiCablePreviewColor = RS.previewPixiCableColor;
  RS.hitTestPixiCable = (clientX, clientY) => hitCableAt(clientX, clientY);
  RS.updatePixiResolutionForZoom = scale => {
    if (!pixiApp || STATE.cableRenderMode !== 'pixi' || !lastWidth || !lastHeight) return currentRenderResolution;
    let target = scale < 0.5 ? 1.5 : (scale < 1 ? 2 : (scale < 1.6 ? 2.5 : 3));
    const megapixelCap = 16_000_000;
    target = Math.min(target, Math.sqrt(megapixelCap / Math.max(1, lastWidth * lastHeight)), 3);
    target = Math.max(1, Math.round(target * 4) / 4);
    if (Math.abs(target - currentRenderResolution) < 0.2) return currentRenderResolution;
    pixiApp.renderer.resolution = target;
    pixiApp.renderer.resize(lastWidth, lastHeight);
    pixiCanvas.style.width = '100%';
    pixiCanvas.style.height = '100%';
    currentRenderResolution = target;
    pixiApp.render();
    return currentRenderResolution;
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
    alphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.core.alpha])),
    glowAlphaByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.glow.alpha])),
    colorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.colorNum])),
    previewColorByCable: Object.fromEntries(Array.from(cableDisplays.entries(), ([id, display]) => [id, display.previewColorNum ?? null]))
  });
})();
