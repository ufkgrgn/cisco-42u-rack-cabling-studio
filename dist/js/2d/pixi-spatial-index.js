/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS 2D Spatial Index & Hit Detector
 * Provides 2D spatial grid hashing for sub-millisecond picking of cables and ports,
 * pointer move throttling, and interactive tooltips and context menus.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;
  const dom = RS.dom;

  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const setCableHover = (...args) => RS.setCableHover && RS.setCableHover(...args);
  const showCableQuickHud = (...args) => RS.showCableQuickHud && RS.showCableQuickHud(...args);
  const showCableContextMenu = (...args) => RS.showCableContextMenu && RS.showCableContextMenu(...args);
  const showCableTooltip = (...args) => RS.showCableTooltip && RS.showCableTooltip(...args);
  const renameCable2D = (...args) => RS.renameCable2D && RS.renameCable2D(...args);

  const SPATIAL_CELL_SIZE = 32;
  const spatialGrid = new Map();
  const spatialMembership = new Map();
  const hitCandidates = new Set();
  const hitTestPoint = { x: 0, y: 0 };

  let isPointerOverCable = false;
  let moveListenerAttached = false;
  let pointerMoveFrame = 0;
  let latestPointerMove = null;

  let hoveredCableId = null;
  const groupHoveredCableIds = new Set();

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

  function rebuildSpatialIndex() {
    spatialGrid.clear();
    spatialMembership.clear();
    const cableDisplays = PixiContext.cableDisplays || new Map();
    for (const [cableId, display] of cableDisplays) {
      indexCableDisplay(cableId, display);
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

  function eventClientPosition(e) {
    const original = e?.nativeEvent || e?.originalEvent;
    return {
      x: Number.isFinite(e?.clientX) ? e.clientX : (Number.isFinite(original?.clientX) ? original.clientX : 0),
      y: Number.isFinite(e?.clientY) ? e.clientY : (Number.isFinite(original?.clientY) ? original.clientY : 0)
    };
  }

  function clientToRenderer(clientX, clientY, rect = PixiContext.getPixiCanvasRect?.(), point = { x: 0, y: 0 }) {
    point.x = 0;
    point.y = 0;
    if (STATE.pixiViewportRendererV2 !== false && rect?.width > 0 && rect?.height > 0) {
      const scale = RS.ZOOM_STATE?.scale || 1;
      point.x = (clientX - rect.left - (RS.ZOOM_STATE?.panX || 0)) / scale;
      point.y = (clientY - rect.top - (RS.ZOOM_STATE?.panY || 0)) / scale;
      return point;
    }
    const pixiApp = PixiContext.pixiApp;
    const events = pixiApp?.renderer?.events;
    if (events?.mapPositionToPoint) {
      events.mapPositionToPoint(point, clientX, clientY);
      return point;
    }
    const screen = pixiApp?.renderer?.screen;
    if (!rect || rect.width <= 0 || rect.height <= 0) return point;
    point.x = (clientX - rect.left) * ((screen?.width || rect.width) / rect.width);
    point.y = (clientY - rect.top) * ((screen?.height || rect.height) / rect.height);
    return point;
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
    if (PixiContext.performanceTelemetry?.hoverEvents) {
      PixiContext.recordTimedEvent?.(PixiContext.performanceTelemetry.hoverEvents);
    }
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
    (RS.refreshCableFocus || RS.PixiCableBatch?.refreshCableFocus || PixiContext.refreshCableFocus)?.(changed);
  }

  function hitCableAt(clientX, clientY) {
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.pointerHitTests++;
    const rect = PixiContext.getPixiCanvasRect?.();
    if (!rect?.width || !rect?.height) return null;
    const point = clientToRenderer(clientX, clientY, rect, hitTestPoint);
    const pixiApp = PixiContext.pixiApp;
    const worldPerScreenPixel = (pixiApp?.renderer?.screen?.width || rect.width) / rect.width;
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
    RS.redrawCableDisplay?.(cableId);
    showCableQuickHud(cableId, pos.x, pos.y);
    PixiContext.renderPixi?.('selection');
  }

  function pointerOnDomChrome(e) {
    const target = e.target instanceof Element ? e.target : null;
    return !!target?.closest?.('.device-ear-handle, .u-label, .slot-label, #rack-u-action-menu');
  }

  function attachHitDetection(canvasArg) {
    const pixiCanvas = canvasArg || PixiContext.pixiCanvas;
    if (!pixiCanvas) return;

    const onDblClick = (e) => {
      if (STATE?.cableRenderMode !== 'pixi') return;
      if (pointerOnDomChrome(e)) return;
      if (e.target?.closest?.('#cable-quick-hud, #cable-context-menu, .modal, input, button')) return;
      const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
      if (port) {
        e.preventDefault();
        e.stopImmediatePropagation();
        RS.dispatchDevicePortInteraction?.('dblclick', port);
        return;
      }
      const body = RS.hitDeviceBodyAt?.(e.clientX, e.clientY);
      if (body && RS.FaceplateTextures?.isFingerOrganizer?.(body)) {
        e.preventDefault();
        RS.toggleOrganizerCover?.(body.instanceId);
        return;
      }
      const cableId = hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
      renameCable2D(cableId);
    };

    if (!moveListenerAttached) {
      moveListenerAttached = true;

      window.addEventListener('pointermove', (e) => {
        const pixiApp = PixiContext.pixiApp;
        const canvas = PixiContext.pixiCanvas || pixiCanvas;
        if (!pixiApp || !canvas || STATE?.cableRenderMode !== 'pixi') return;
        latestPointerMove = e;
        if (pointerMoveFrame) return;
        pointerMoveFrame = requestAnimationFrame(() => {
          pointerMoveFrame = 0;
          const e = latestPointerMove;
          if (!e || !PixiContext.pixiApp || !PixiContext.pixiCanvas || STATE?.cableRenderMode !== 'pixi') return;

          const target = e.target instanceof Element ? e.target : null;
          const isHudOrMenuOpen = !!document.getElementById('cable-quick-hud') || !!document.getElementById('cable-context-menu') || !!document.querySelector('.modal.show, .modal.active');
          const inHudOrMenu = !!target?.closest('#cable-quick-hud, #cable-context-menu, .cable-quick-hud, .cable-context-menu, .modal');
          if (isHudOrMenuOpen || inHudOrMenu) {
            if (isPointerOverCable) {
              canvas.style.pointerEvents = 'none';
              isPointerOverCable = false;
            }
            if (dom?.tooltip) dom.tooltip.style.display = 'none';
            return;
          }

          const inScheduleSidebar = !!target?.closest('#sidebar-right');
          if (inScheduleSidebar) {
            if (isPointerOverCable) {
              canvas.style.pointerEvents = 'none';
              isPointerOverCable = false;
            }
            const domOwnsCableHover = !!target.closest('#schedule-tbody [data-cable-id], #schedule-tbody .tree-switch-header');
            const currentPortKey = RS.getHoveredDevicePortKey?.();
            if (currentPortKey) {
              RS.setHoveredDevicePortKey?.(null);
              RS.restoreDevicePortTint?.(currentPortKey);
              RS.dispatchDevicePortInteraction?.('leave');
            }
            if (!domOwnsCableHover) setPixiHover(null);
            return;
          }

          if (target?.closest?.('.device-ear-handle, .u-label, .slot-label')) {
            const currentPortKey = RS.getHoveredDevicePortKey?.();
            if (currentPortKey) {
              RS.setHoveredDevicePortKey?.(null);
              RS.restoreDevicePortTint?.(currentPortKey);
              RS.dispatchDevicePortInteraction?.('leave');
            }
            RS.setPixiDeviceHover?.(null);
            if (isPointerOverCable) {
              canvas.style.pointerEvents = 'none';
              isPointerOverCable = false;
            }
            return;
          }

          if (RS.ZOOM_STATE?.isPanning || RS.ZOOM_STATE?.isFocusing || RS.isDraggingDevice) {
            if (isPointerOverCable) {
              canvas.style.pointerEvents = 'none';
              isPointerOverCable = false;
            }
            const currentPortKey = RS.getHoveredDevicePortKey?.();
            if (currentPortKey) {
              RS.setHoveredDevicePortKey?.(null);
              RS.restoreDevicePortTint?.(currentPortKey);
              RS.dispatchDevicePortInteraction?.('leave');
            }
            if (hoveredCableId) setPixiHover(null);
            if (dom?.tooltip) dom.tooltip.style.display = 'none';
            return;
          }

          const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
          RS.setPixiDeviceHover?.(port ? null : (RS.hitDeviceBodyAt?.(e.clientX, e.clientY)?.instanceId || null));
          const portKey = port ? `${port.instanceId}::${port.portId}` : null;
          const previousPortKey = RS.getHoveredDevicePortKey?.();
          if (portKey !== previousPortKey) {
            if (previousPortKey) {
              RS.setHoveredDevicePortKey?.(null);
              RS.restoreDevicePortTint?.(previousPortKey);
              RS.dispatchDevicePortInteraction?.('leave');
            }
            if (port) {
              RS.setHoveredDevicePortKey?.(portKey);
              RS.restoreDevicePortTint?.(portKey);
              RS.dispatchDevicePortInteraction?.('hover', port);
            }
          }

          const cableId = STATE.pendingConnection ? null : hitCableAt(e.clientX, e.clientY);
          const hitInteractive = !!cableId;
          setPixiHover(cableId, e);

          if (hitInteractive && !isPointerOverCable) {
            canvas.style.pointerEvents = 'auto';
            isPointerOverCable = true;
          } else if (!hitInteractive && isPointerOverCable) {
            canvas.style.pointerEvents = 'none';
            isPointerOverCable = false;
          }
        });
      }, { passive: true });

      window.addEventListener('pointerdown', (e) => {
        if (STATE?.cableRenderMode !== 'pixi' || e.button !== 0) return;
        if (pointerOnDomChrome(e)) return;
        const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
        if (!port) return;
        if (STATE.multiSelectMode || e.shiftKey) return;
        RS.lastHandledPixiPortTime = Date.now();
        RS.dispatchDevicePortInteraction?.('click', port);
      });

      window.addEventListener('click', (e) => {
        if (STATE?.cableRenderMode !== 'pixi') return;
        if (pointerOnDomChrome(e)) return;
        if (RS.isDraggingDevice) return;
        if (STATE.multiSelectMode || e.shiftKey) return;
        const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
        if (port) {
          e.stopPropagation();
        }
      }, { capture: true });

      window.addEventListener('contextmenu', (e) => {
        if (STATE?.cableRenderMode !== 'pixi' || !PixiContext.pixiApp || !PixiContext.pixiCanvas) return;
        if (pointerOnDomChrome(e)) return;
        const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
        if (port) {
          e.preventDefault();
          e.stopImmediatePropagation();
          RS.dispatchDevicePortInteraction?.('contextmenu', port);
          return;
        }
        const cableId = hitCableAt(e.clientX, e.clientY);
        if (cableId) {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cableId, true);
          RS.redrawCableDisplay?.(cableId);
          showCableContextMenu(cableId, e.clientX, e.clientY);
          PixiContext.renderPixi?.('context-menu');
          return;
        }
        const hitDevice = RS.hitDeviceBodyAt?.(e.clientX, e.clientY) || (e.target?.closest?.('.mounted-device') ? { instanceId: e.target.closest('.mounted-device').id } : null);
        if (hitDevice && RS.showDeviceContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          RS.showDeviceContextMenu(hitDevice.instanceId, e.clientX, e.clientY);
          return;
        }
      }, { capture: true });

      window.addEventListener('dblclick', onDblClick, { capture: true });
    }

    if (pixiCanvas._rsHitAttached) return;
    pixiCanvas._rsHitAttached = true;

    pixiCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pixiCanvas.style.pointerEvents = 'none';
      isPointerOverCable = false;
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const domPort = elUnder?.closest?.('.port');
      if (domPort) {
        RS.lastHandledPixiPortTime = Date.now();
        domPort.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
        return;
      }
      const cableId = STATE.pendingConnection ? null : hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      pixiCanvas.style.pointerEvents = 'auto';
      isPointerOverCable = true;
      e.preventDefault();
      e.stopPropagation();
      handleCablePointerDown(cableId, e);
    });

    pixiCanvas.addEventListener('click', (e) => {
      if (RS.isDraggingDevice) return;
      if (STATE.multiSelectMode || e.shiftKey) return;
      const port = RS.hitDevicePortAt?.(e.clientX, e.clientY);
      if (port) {
        e.preventDefault();
        e.stopPropagation();
        RS.lastHandledPixiPortTime = Date.now();
        RS.dispatchDevicePortInteraction?.('click', port);
        return;
      }
      pixiCanvas.style.pointerEvents = 'none';
      isPointerOverCable = false;
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const domPort = elUnder?.closest?.('.port');
      if (domPort) {
        e.stopPropagation();
        return;
      }
      const cableId = STATE.pendingConnection ? null : hitCableAt(e.clientX, e.clientY);
      if (!cableId) return;
      e.preventDefault();
      e.stopPropagation();
    });

    pixiCanvas.addEventListener('dblclick', onDblClick);
  }

  // Exports
  RS.hitCableAt = hitCableAt;
  RS.setPixiHover = setPixiHover;
  RS.attachHitDetection = attachHitDetection;
  RS.handleCablePointerDown = handleCablePointerDown;
  RS.rebuildSpatialIndex = rebuildSpatialIndex;
  RS.indexCableDisplay = indexCableDisplay;
  RS.removeCableFromSpatialIndex = removeCableFromSpatialIndex;
  RS.samplePathSegments = samplePathSegments;

  RS.PixiSpatialIndex = {
    hitCableAt,
    setPixiHover,
    attachHitDetection,
    handleCablePointerDown,
    rebuildSpatialIndex,
    indexCableDisplay,
    removeCableFromSpatialIndex,
    samplePathSegments
  };

  PixiContext.clientToRenderer = clientToRenderer;
  PixiContext.hitCableAt = hitCableAt;
  PixiContext.setPixiHover = setPixiHover;
  PixiContext.rebuildSpatialIndex = rebuildSpatialIndex;
  PixiContext.indexCableDisplay = indexCableDisplay;
  PixiContext.removeCableFromSpatialIndex = removeCableFromSpatialIndex;
  PixiContext.attachHitDetection = attachHitDetection;
  PixiContext.spatialGrid = spatialGrid;
  PixiContext.spatialMembership = spatialMembership;
  PixiContext.getHoveredCableId = () => hoveredCableId;
  PixiContext.setHoveredCableId = (id) => { hoveredCableId = id; };
  PixiContext.getGroupHoveredCableIds = () => groupHoveredCableIds;
})();
