/**
 * Cisco Enterprise Rack & Cabling Studio - Pan & Zoom Canvas Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  let stageTransitionBound = false;
  let lastTransitionValue = null;
  let lastTransformValue = null;
  let lastZoomBadgeValue = null;
  function ensureStageTransitionListener() {
    if (stageTransitionBound || !RS.dom?.rackStage) return;
    RS.dom.rackStage.addEventListener('transitionend', (e) => {
      // The cable SVG is a child of rackStage, so it follows the same CSS
      // transform. Rebuilding cable geometry here only duplicates browser work.
      if (e.propertyName === 'transform') RS.dom.rackStage.style.transition = 'none';
    });
    stageTransitionBound = true;
  }

  let lastDispatchedScale = null;
  function updateStageTransform(smooth = false) {
    if (!RS.dom?.rackStage) return;
    ensureStageTransitionListener();

    const transitionValue = smooth ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)' : 'none';
    if (transitionValue !== lastTransitionValue) {
      RS.dom.rackStage.style.transition = transitionValue;
      lastTransitionValue = transitionValue;
    }
    const transformValue = `translate3d(${RS.ZOOM_STATE.panX}px, ${RS.ZOOM_STATE.panY}px, 0) scale(${RS.ZOOM_STATE.scale})`;
    if (transformValue !== lastTransformValue) {
      RS.dom.rackStage.style.transform = transformValue;
      lastTransformValue = transformValue;
    }
    const zoomBadgeValue = `${Math.round(RS.ZOOM_STATE.scale * 100)}%`;
    if (RS.dom.zoomBadge && zoomBadgeValue !== lastZoomBadgeValue) {
      RS.dom.zoomBadge.textContent = zoomBadgeValue;
      lastZoomBadgeValue = zoomBadgeValue;
    }

    // Dynamic 2D Level of Detail (LOD) tiering
    const currentLod = RS.ZOOM_STATE.scale < 0.35 ? 'macro' : 'detail';
    if (RS.dom.rackStage.getAttribute('data-lod') !== currentLod) {
      RS.dom.rackStage.setAttribute('data-lod', currentLod);
    }
  }

  function fitRackToScreen(smooth = true) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    let rackW = 634; // 618px inner content + 16px border
    let rackH = (activeRack?.heightU || 42) * 32 + 84; // 1344px inner content + 84px header canopy/margin

    const isMulti = RS.STATE && RS.STATE.viewMode === 'multi' && RS.STATE.racks && RS.STATE.racks.length > 1;
    if (isMulti) {
      const numRacks = RS.STATE.racks.length;
      rackW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const maxU = Math.max(...RS.STATE.racks.map(r => r.heightU || 42));
      rackH = maxU * 32 + 84;
    }

    const paddingX = 48;
    const paddingY = 48;
    const scaleX = (cw - paddingX * 2) / rackW;
    const scaleY = (ch - paddingY * 2) / rackH;

    let targetScale = Math.min(scaleX, scaleY);
    targetScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));

    const targetPanX = (cw - rackW * targetScale) / 2;
    const targetPanY = (ch - rackH * targetScale) / 2 + (66 * targetScale);

    RS.ZOOM_STATE.scale = parseFloat(targetScale.toFixed(3));
    RS.ZOOM_STATE.panX = Math.round(targetPanX);
    RS.ZOOM_STATE.panY = Math.round(targetPanY);
    RS.ZOOM_STATE.isFit = true;

    updateStageTransform(smooth);
    scheduleViewportContentRefresh(smooth ? 300 : 0);
  }

  let cachedCanvasRect = null;
  function getCanvasRect(canvas) {
    if (!cachedCanvasRect) cachedCanvasRect = canvas.getBoundingClientRect();
    return cachedCanvasRect;
  }
  window.addEventListener('resize', () => { cachedCanvasRect = null; });

  function setZoom(targetScale, pivotX, pivotY, smooth = false) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;

    const prevScale = RS.ZOOM_STATE.scale;
    const nextScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));
    if (prevScale === nextScale) return;

    const rect = getCanvasRect(canvas);
    const cx = (pivotX !== undefined) ? (pivotX - rect.left) : (canvas.clientWidth / 2);
    const cy = (pivotY !== undefined) ? (pivotY - rect.top) : (canvas.clientHeight / 2);

    const worldX = (cx - RS.ZOOM_STATE.panX) / prevScale;
    const worldY = (cy - RS.ZOOM_STATE.panY) / prevScale;

    RS.ZOOM_STATE.panX = Math.round(cx - worldX * nextScale);
    RS.ZOOM_STATE.panY = Math.round(cy - worldY * nextScale);
    RS.ZOOM_STATE.scale = parseFloat(nextScale.toFixed(3));
    RS.ZOOM_STATE.isFit = false;

    updateStageTransform(smooth);
    scheduleViewportContentRefresh(smooth ? 300 : 120);
  }

  let cableRenderTimeout = null;
  let viewportContentRefreshTimeout = null;
  function scheduleCableRender(delay = 16) {
    if (cableRenderTimeout) clearTimeout(cableRenderTimeout);
    cableRenderTimeout = setTimeout(() => {
      if (RS.renderAllCables) RS.renderAllCables();
      cableRenderTimeout = null;
    }, delay);
  }

  function scheduleViewportContentRefresh(delay = 100) {
    if (viewportContentRefreshTimeout) clearTimeout(viewportContentRefreshTimeout);
    viewportContentRefreshTimeout = setTimeout(() => {
      RS.refreshVisibleRackContent?.();
      viewportContentRefreshTimeout = null;
    }, delay);
  }

  function jumpToSection(section) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    const heightU = activeRack?.heightU || 42;
    const rackH = heightU * 32 + 16;
    const ch = canvas.clientHeight;

    RS.ZOOM_STATE.scale = 1.0;
    RS.ZOOM_STATE.isFit = false;
    RS.ZOOM_STATE.panX = Math.round((canvas.clientWidth - 634) / 2);

    if (section === 'top') {
      RS.ZOOM_STATE.panY = 76;
    } else if (section === 'mid') {
      RS.ZOOM_STATE.panY = Math.round((ch - rackH) / 2);
    } else if (section === 'bot') {
      RS.ZOOM_STATE.panY = Math.round(ch - rackH - 24);
    }

    updateStageTransform(true);
    scheduleViewportContentRefresh(300);
  }

  function bindZoomAndPanEvents() {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;

    let panFrameId = 0;
    let pendingPanPoint = null;
    let panCleanupTimer = 0;

    function applyPendingPan() {
      if (!pendingPanPoint) return;
      const { clientX, clientY } = pendingPanPoint;
      pendingPanPoint = null;
      RS.ZOOM_STATE.panX = clientX - RS.ZOOM_STATE.startX;
      RS.ZOOM_STATE.panY = clientY - RS.ZOOM_STATE.startY;
      RS.ZOOM_STATE.isFit = false;
      updateStageTransform(false);
    }

    function schedulePan(clientX, clientY) {
      pendingPanPoint = { clientX, clientY };
      if (panFrameId) return;
      panFrameId = requestAnimationFrame(() => {
        panFrameId = 0;
        applyPendingPan();
      });
    }

    function beginPan(clientX, clientY) {
      if (panCleanupTimer) {
        clearTimeout(panCleanupTimer);
        panCleanupTimer = 0;
      }
      RS.ZOOM_STATE.isPanning = true;
      RS.ZOOM_STATE.startX = clientX - RS.ZOOM_STATE.panX;
      RS.ZOOM_STATE.startY = clientY - RS.ZOOM_STATE.panY;
      canvas.classList.add('panning');
      RS.dom?.rackStage?.classList.add('panning-active');
    }

    function endPan() {
      if (!RS.ZOOM_STATE.isPanning) return;
      if (panFrameId) {
        cancelAnimationFrame(panFrameId);
        panFrameId = 0;
        applyPendingPan();
      }
      RS.ZOOM_STATE.isPanning = false;
      canvas.classList.remove('panning');
      // Keep the compositor layer warm briefly so release/inertial frames do not
      // pay a layer teardown + rebuild cost.
      panCleanupTimer = setTimeout(() => {
        RS.dom?.rackStage?.classList.remove('panning-active');
        panCleanupTimer = 0;
      }, 180);
      scheduleViewportContentRefresh(0);
    }

    let wheelZoomFrameId = 0;
    let pendingZoomMultiplier = 1;
    let wheelPivotX = 0;
    let wheelPivotY = 0;
    let wheelCleanupTimer = 0;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (wheelCleanupTimer) {
        clearTimeout(wheelCleanupTimer);
        wheelCleanupTimer = 0;
      }
      RS.dom?.rackStage?.classList.add('zooming-active');
      canvas.classList.add('zooming');

      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      pendingZoomMultiplier *= zoomFactor;
      wheelPivotX = e.clientX;
      wheelPivotY = e.clientY;

      if (!wheelZoomFrameId) {
        wheelZoomFrameId = requestAnimationFrame(() => {
          wheelZoomFrameId = 0;
          const targetScale = RS.ZOOM_STATE.scale * pendingZoomMultiplier;
          pendingZoomMultiplier = 1;
          setZoom(targetScale, wheelPivotX, wheelPivotY, false);
        });
      }

      wheelCleanupTimer = setTimeout(() => {
        RS.dom?.rackStage?.classList.remove('zooming-active');
        canvas.classList.remove('zooming');
        cachedCanvasRect = null;
        wheelCleanupTimer = 0;
      }, 150);
    }, { passive: false });

    let panOriginClientX = 0;
    let panOriginClientY = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey || e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg))) {
        panOriginClientX = e.clientX;
        panOriginClientY = e.clientY;
        beginPan(e.clientX, e.clientY);
        RS.ZOOM_STATE.hasMoved = false;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!RS.ZOOM_STATE.isPanning) return;
      const dist = Math.hypot(e.clientX - panOriginClientX, e.clientY - panOriginClientY);
      if (dist > 4) {
        RS.ZOOM_STATE.hasMoved = true;
      }
      schedulePan(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (RS.ZOOM_STATE.isPanning) {
        endPan();
        if (RS.ZOOM_STATE.hasMoved) {
          setTimeout(() => {
            if (RS.ZOOM_STATE) RS.ZOOM_STATE.hasMoved = false;
          }, 250);
        }
      }
    });

    // Touch support (pinch to zoom and pan)
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        RS.dom?.rackStage?.classList.add('zooming-active');
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      } else if (e.touches.length === 1 && (e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg)) {
        beginPan(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          setZoom(RS.ZOOM_STATE.scale * factor, lastTouchCenter.x, lastTouchCenter.y, false);
        }
        lastTouchDist = dist;
      } else if (e.touches.length === 1 && RS.ZOOM_STATE.isPanning) {
        schedulePan(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      RS.dom?.rackStage?.classList.remove('zooming-active');
      endPan();
      lastTouchDist = 0;
    });

    // Toolbar buttons
    if (RS.dom?.btnZoomIn) {
      RS.dom.btnZoomIn.addEventListener('click', () => setZoom(RS.ZOOM_STATE.scale * 1.25, undefined, undefined, true));
    }
    if (RS.dom?.btnZoomOut) {
      RS.dom.btnZoomOut.addEventListener('click', () => setZoom(RS.ZOOM_STATE.scale / 1.25, undefined, undefined, true));
    }
    if (RS.dom?.btnZoomFit) {
      RS.dom.btnZoomFit.addEventListener('click', () => fitRackToScreen(true));
    }
    if (RS.dom?.btnZoomActual) {
      RS.dom.btnZoomActual.addEventListener('click', () => setZoom(1.0, undefined, undefined, true));
    }
    if (RS.dom?.zoomBadge) {
      RS.dom.zoomBadge.addEventListener('click', () => {
        if (RS.ZOOM_STATE.scale > 0.85) {
          fitRackToScreen(true);
        } else {
          setZoom(1.0, undefined, undefined, true);
        }
      });
    }

    if (RS.dom?.navJumpTop) RS.dom.navJumpTop.addEventListener('click', () => jumpToSection('top'));
    if (RS.dom?.navJumpMid) RS.dom.navJumpMid.addEventListener('click', () => jumpToSection('mid'));
    if (RS.dom?.navJumpBot) RS.dom.navJumpBot.addEventListener('click', () => jumpToSection('bot'));

    // Zoom and pan are compositor-only. Cable geometry is refreshed by layout
    // mutations and resize handlers, not by view transforms.
  }

  RS.ensureStageTransitionListener = ensureStageTransitionListener;
  RS.updateStageTransform = updateStageTransform;
  RS.fitRackToScreen = fitRackToScreen;
  RS.fit = fitRackToScreen;
  RS.setZoom = setZoom;
  RS.scheduleCableRender = scheduleCableRender;
  RS.jumpToSection = jumpToSection;
  RS.bindZoomAndPanEvents = bindZoomAndPanEvents;
})();
