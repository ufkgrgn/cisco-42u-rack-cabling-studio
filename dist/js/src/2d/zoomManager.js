/**
 * Pan & Zoom Module
 */
import { STATE, ZOOM_STATE, dom, getActiveRack } from './state.js';
import { renderAllCables } from './cablingEngine.js';

// --- PAN & ZOOM MODULE ---
  let stageTransitionBound = false;
  function ensureStageTransitionListener() {
    if (stageTransitionBound || !dom.rackStage) return;
    dom.rackStage.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform') {
        renderAllCables();
      }
    });
    stageTransitionBound = true;
  }

  function updateStageTransform(smooth = false) {
    if (!dom.rackStage) return;
    ensureStageTransitionListener();

    if (smooth) {
      dom.rackStage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)';
    } else {
      dom.rackStage.style.transition = 'none';
    }
    dom.rackStage.style.transform = `translate(${ZOOM_STATE.panX}px, ${ZOOM_STATE.panY}px) scale(${ZOOM_STATE.scale})`;
    if (dom.zoomBadge) {
      dom.zoomBadge.textContent = `${Math.round(ZOOM_STATE.scale * 100)}%`;
    }

    // Dynamic 2D Level of Detail (LOD) tiering
    const currentLod = ZOOM_STATE.scale < 0.42 ? 'macro' : (ZOOM_STATE.scale < 0.78 ? 'medium' : 'detail');
    if (dom.rackStage && dom.rackStage.getAttribute('data-lod') !== currentLod) {
      dom.rackStage.setAttribute('data-lod', currentLod);
    }

    // Dispatch custom zoom event for high-DPI re-rendering
    window.dispatchEvent(new CustomEvent('rack-zoom-changed', {
      detail: { scale: ZOOM_STATE.scale, panX: ZOOM_STATE.panX, panY: ZOOM_STATE.panY }
    }));
  }

  function fitRackToScreen(smooth = true) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const activeRack = getActiveRack ? getActiveRack() : null;
    let rackW = 634; // 618px inner content + 16px border
    let rackH = (activeRack?.heightU || 42) * 32 + 16; // 1344px inner content + 16px border

    const isMulti = STATE && STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      rackW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      rackH = maxU * 32 + 16 + 140;
    }

    const padX = 24;
    const padY = 20;

    const scaleX = (cw - padX * 2) / rackW;
    const scaleY = (ch - padY * 2) / rackH;
    const fitScale = parseFloat(Math.max(ZOOM_STATE.minScale, Math.min(scaleX, scaleY, 1.25)).toFixed(4));

    ZOOM_STATE.scale = fitScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * fitScale) / 2);
    ZOOM_STATE.panY = Math.max(8, Math.round((ch - rackH * fitScale) / 2));
    ZOOM_STATE.isFit = true;

    updateStageTransform(smooth);
    scheduleCableRender(smooth ? 260 : 20);
  }

  function setZoom(newScale, screenX, screenY, smooth = false) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clampedScale = parseFloat(Math.max(ZOOM_STATE.minScale, Math.min(ZOOM_STATE.maxScale, newScale)).toFixed(4));

    const cx = (screenX !== undefined) ? screenX - rect.left : canvas.clientWidth / 2;
    const cy = (screenY !== undefined) ? screenY - rect.top : canvas.clientHeight / 2;

    const stageX = (cx - ZOOM_STATE.panX) / ZOOM_STATE.scale;
    const stageY = (cy - ZOOM_STATE.panY) / ZOOM_STATE.scale;

    ZOOM_STATE.scale = clampedScale;
    ZOOM_STATE.panX = Math.round(cx - stageX * clampedScale);
    ZOOM_STATE.panY = Math.round(cy - stageY * clampedScale);
    ZOOM_STATE.isFit = false;

    updateStageTransform(smooth);
    scheduleCableRender(smooth ? 260 : 30);
  }

  let cableRenderTimer = null;
  function scheduleCableRender(delay = 40) {
    if (cableRenderTimer) clearTimeout(cableRenderTimer);
    cableRenderTimer = setTimeout(() => {
      cableRenderTimer = null;
      requestAnimationFrame(renderAllCables);
    }, delay);
  }

  function jumpToSection(section) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const rackW = 634;

    const targetScale = parseFloat(Math.min(1.3, Math.max(0.9, (cw - 40) / rackW)).toFixed(4));
    ZOOM_STATE.scale = targetScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * targetScale) / 2);
    ZOOM_STATE.isFit = false;

    if (section === 'top') {
      ZOOM_STATE.panY = 16;
    } else if (section === 'mid') {
      ZOOM_STATE.panY = Math.round(ch / 2 - (((getActiveRack()?.heightU || 42) * 16) * targetScale));
    } else if (section === 'bot') {
      ZOOM_STATE.panY = Math.round(ch - (((getActiveRack()?.heightU || 42) * 32 + 16) * targetScale) - 24);
    }

    updateStageTransform(true);
    scheduleCableRender(260);
  }

  let panFrame = 0;
  function bindZoomAndPanEvents() {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(ZOOM_STATE.scale * factor, e.clientX, e.clientY, false);
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => {
      if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.del-device-btn')) {
        return;
      }
      ZOOM_STATE.isPanning = true;
      ZOOM_STATE.startX = e.clientX - ZOOM_STATE.panX;
      ZOOM_STATE.startY = e.clientY - ZOOM_STATE.panY;
      ZOOM_STATE.hasMoved = false;
      canvas.classList.add('panning');
      if (dom.rackStage) dom.rackStage.classList.add('panning-active');
    });

    window.addEventListener('mousemove', (e) => {
      if (!ZOOM_STATE.isPanning) return;
      const newPanX = e.clientX - ZOOM_STATE.startX;
      const newPanY = e.clientY - ZOOM_STATE.startY;
      if (Math.abs(newPanX - ZOOM_STATE.panX) > 3 || Math.abs(newPanY - ZOOM_STATE.panY) > 3) {
        ZOOM_STATE.hasMoved = true;
      }
      ZOOM_STATE.panX = newPanX;
      ZOOM_STATE.panY = newPanY;
      ZOOM_STATE.isFit = false;
      if (!panFrame) panFrame = requestAnimationFrame(() => { panFrame = 0; updateStageTransform(false); });
    });

    window.addEventListener('mouseup', () => {
      if (ZOOM_STATE.isPanning) {
        ZOOM_STATE.isPanning = false;
        canvas.classList.remove('panning');
        if (dom.rackStage) dom.rackStage.classList.remove('panning-active');
        setTimeout(() => { ZOOM_STATE.hasMoved = false; }, 120);
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.rack-slot') || e.target.closest('.mounted-device')) return;
      if (ZOOM_STATE.scale > 0.85) {
        fitRackToScreen(true);
      } else {
        setZoom(1.25, e.clientX, e.clientY, true);
      }
    });

    if (dom.btnZoomIn) {
      dom.btnZoomIn.addEventListener('click', () => setZoom(ZOOM_STATE.scale * 1.25, undefined, undefined, true));
    }
    if (dom.btnZoomOut) {
      dom.btnZoomOut.addEventListener('click', () => setZoom(ZOOM_STATE.scale / 1.25, undefined, undefined, true));
    }
    if (dom.btnZoomFit) {
      dom.btnZoomFit.addEventListener('click', () => fitRackToScreen(true));
    }
    if (dom.btnZoomActual) {
      dom.btnZoomActual.addEventListener('click', () => setZoom(1.0, undefined, undefined, true));
    }
    if (dom.zoomBadge) {
      dom.zoomBadge.addEventListener('click', () => {
        if (ZOOM_STATE.scale > 0.85) {
          fitRackToScreen(true);
        } else {
          setZoom(1.0, undefined, undefined, true);
        }
      });
    }

    if (dom.navJumpTop) dom.navJumpTop.addEventListener('click', () => jumpToSection('top'));
    if (dom.navJumpMid) dom.navJumpMid.addEventListener('click', () => jumpToSection('mid'));
    if (dom.navJumpBot) dom.navJumpBot.addEventListener('click', () => jumpToSection('bot'));

    window.addEventListener('rack-zoom-changed', () => scheduleCableRender(30));
  }

export {
  ensureStageTransitionListener,
  updateStageTransform,
  fitRackToScreen,
  setZoom,
  scheduleCableRender,
  jumpToSection,
  bindZoomAndPanEvents
};
