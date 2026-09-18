/**
 * Cisco Enterprise Rack & Cabling Studio - Pan & Zoom Canvas Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  let stageTransitionBound = false;
  function ensureStageTransitionListener() {
    if (stageTransitionBound || !RS.dom?.rackStage) return;
    RS.dom.rackStage.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform') {
        if (RS.renderAllCables) RS.renderAllCables();
      }
    });
    stageTransitionBound = true;
  }

  function updateStageTransform(smooth = false) {
    if (!RS.dom?.rackStage) return;
    ensureStageTransitionListener();

    if (smooth) {
      RS.dom.rackStage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)';
    } else {
      RS.dom.rackStage.style.transition = 'none';
    }
    RS.dom.rackStage.style.transform = `translate(${RS.ZOOM_STATE.panX}px, ${RS.ZOOM_STATE.panY}px) scale(${RS.ZOOM_STATE.scale})`;
    if (RS.dom.zoomBadge) {
      RS.dom.zoomBadge.textContent = `${Math.round(RS.ZOOM_STATE.scale * 100)}%`;
    }

    // Dynamic 2D Level of Detail (LOD) tiering
    const currentLod = RS.ZOOM_STATE.scale < 0.42 ? 'macro' : (RS.ZOOM_STATE.scale < 0.78 ? 'medium' : 'detail');
    if (RS.dom.rackStage && RS.dom.rackStage.getAttribute('data-lod') !== currentLod) {
      RS.dom.rackStage.setAttribute('data-lod', currentLod);
    }

    // Dispatch custom zoom event for high-DPI re-rendering
    window.dispatchEvent(new CustomEvent('rack-zoom-changed', {
      detail: { scale: RS.ZOOM_STATE.scale, panX: RS.ZOOM_STATE.panX, panY: RS.ZOOM_STATE.panY }
    }));
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
    if (RS.renderAllCables) RS.renderAllCables();
  }

  function setZoom(targetScale, pivotX, pivotY, smooth = false) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;

    const prevScale = RS.ZOOM_STATE.scale;
    const nextScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));
    if (prevScale === nextScale) return;

    const rect = canvas.getBoundingClientRect();
    const cx = (pivotX !== undefined) ? (pivotX - rect.left) : (canvas.clientWidth / 2);
    const cy = (pivotY !== undefined) ? (pivotY - rect.top) : (canvas.clientHeight / 2);

    const worldX = (cx - RS.ZOOM_STATE.panX) / prevScale;
    const worldY = (cy - RS.ZOOM_STATE.panY) / prevScale;

    RS.ZOOM_STATE.panX = Math.round(cx - worldX * nextScale);
    RS.ZOOM_STATE.panY = Math.round(cy - worldY * nextScale);
    RS.ZOOM_STATE.scale = parseFloat(nextScale.toFixed(3));
    RS.ZOOM_STATE.isFit = false;

    updateStageTransform(smooth);
    if (RS.renderAllCables) RS.renderAllCables();
  }

  let cableRenderTimeout = null;
  function scheduleCableRender(delay = 16) {
    if (cableRenderTimeout) clearTimeout(cableRenderTimeout);
    cableRenderTimeout = setTimeout(() => {
      if (RS.renderAllCables) RS.renderAllCables();
      cableRenderTimeout = null;
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
    if (RS.renderAllCables) RS.renderAllCables();
  }

  function bindZoomAndPanEvents() {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      setZoom(RS.ZOOM_STATE.scale * zoomFactor, e.clientX, e.clientY, false);
    }, { passive: false });

    let panOriginClientX = 0;
    let panOriginClientY = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey || e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg))) {
        RS.ZOOM_STATE.isPanning = true;
        panOriginClientX = e.clientX;
        panOriginClientY = e.clientY;
        RS.ZOOM_STATE.startX = e.clientX - RS.ZOOM_STATE.panX;
        RS.ZOOM_STATE.startY = e.clientY - RS.ZOOM_STATE.panY;
        RS.ZOOM_STATE.hasMoved = false;
        canvas.classList.add('panning');
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!RS.ZOOM_STATE.isPanning) return;
      const dist = Math.hypot(e.clientX - panOriginClientX, e.clientY - panOriginClientY);
      if (dist > 4) {
        RS.ZOOM_STATE.hasMoved = true;
      }
      RS.ZOOM_STATE.panX = e.clientX - RS.ZOOM_STATE.startX;
      RS.ZOOM_STATE.panY = e.clientY - RS.ZOOM_STATE.startY;
      RS.ZOOM_STATE.isFit = false;
      updateStageTransform(false);
      scheduleCableRender(40);
    });

    window.addEventListener('mouseup', () => {
      if (RS.ZOOM_STATE.isPanning) {
        RS.ZOOM_STATE.isPanning = false;
        canvas.classList.remove('panning');
        if (RS.renderAllCables) RS.renderAllCables();
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
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      } else if (e.touches.length === 1 && (e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg)) {
        RS.ZOOM_STATE.isPanning = true;
        RS.ZOOM_STATE.startX = e.touches[0].clientX - RS.ZOOM_STATE.panX;
        RS.ZOOM_STATE.startY = e.touches[0].clientY - RS.ZOOM_STATE.panY;
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
        RS.ZOOM_STATE.panX = e.touches[0].clientX - RS.ZOOM_STATE.startX;
        RS.ZOOM_STATE.panY = e.touches[0].clientY - RS.ZOOM_STATE.startY;
        RS.ZOOM_STATE.isFit = false;
        updateStageTransform(false);
        scheduleCableRender(50);
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      RS.ZOOM_STATE.isPanning = false;
      lastTouchDist = 0;
      if (RS.renderAllCables) RS.renderAllCables();
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

    window.addEventListener('rack-zoom-changed', () => scheduleCableRender(30));
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
