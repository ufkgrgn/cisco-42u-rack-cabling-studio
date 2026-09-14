import { ZOOM_STATE, dom } from './state.js';
import { renderAllCables } from './cabling.js';

export function updateStageTransform(smooth = false) {
  if (!dom.rackStage) return;
  if (smooth) {
    dom.rackStage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)';
  } else {
    dom.rackStage.style.transition = 'none';
  }
  dom.rackStage.style.transform = `translate3d(${ZOOM_STATE.panX}px, ${ZOOM_STATE.panY}px, 0) scale(${ZOOM_STATE.scale})`;
  if (dom.zoomBadge) {
    dom.zoomBadge.textContent = `${Math.round(ZOOM_STATE.scale * 100)}%`;
  }
}

export function fitRackToScreen(smooth = true) {
  const canvas = dom.viewportCanvas;
  if (!canvas) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (cw <= 0 || ch <= 0) return;

  const rackW = 634; // 618px content + 16px border
  const rackH = 1360; // 1344px content + 16px border

  const padX = 24;
  const padY = 20;

  const scaleX = (cw - padX * 2) / rackW;
  const scaleY = (ch - padY * 2) / rackH;
  const fitScale = Math.max(ZOOM_STATE.minScale, Math.min(scaleX, scaleY, 1.25));

  ZOOM_STATE.scale = fitScale;
  ZOOM_STATE.panX = Math.round((cw - rackW * fitScale) / 2);
  ZOOM_STATE.panY = Math.max(8, Math.round((ch - rackH * fitScale) / 2));
  ZOOM_STATE.isFit = true;

  updateStageTransform(smooth);
  setTimeout(renderAllCables, 30);
}

export function setZoom(newScale, screenX, screenY, smooth = false) {
  const canvas = dom.viewportCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const clampedScale = Math.max(ZOOM_STATE.minScale, Math.min(ZOOM_STATE.maxScale, newScale));

  const cx = (screenX !== undefined) ? screenX - rect.left : canvas.clientWidth / 2;
  const cy = (screenY !== undefined) ? screenY - rect.top : canvas.clientHeight / 2;

  // Preserve point under cursor
  const stageX = (cx - ZOOM_STATE.panX) / ZOOM_STATE.scale;
  const stageY = (cy - ZOOM_STATE.panY) / ZOOM_STATE.scale;

  ZOOM_STATE.scale = clampedScale;
  ZOOM_STATE.panX = Math.round(cx - stageX * clampedScale);
  ZOOM_STATE.panY = Math.round(cy - stageY * clampedScale);
  ZOOM_STATE.isFit = false;

  updateStageTransform(smooth);
}

export function jumpToSection(section) {
  const canvas = dom.viewportCanvas;
  if (!canvas) return;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const rackW = 634;

  const targetScale = Math.min(1.3, Math.max(0.9, (cw - 40) / rackW));
  ZOOM_STATE.scale = targetScale;
  ZOOM_STATE.panX = Math.round((cw - rackW * targetScale) / 2);
  ZOOM_STATE.isFit = false;

  if (section === 'top') {
    // Focus on U42 to U29
    ZOOM_STATE.panY = 16;
  } else if (section === 'mid') {
    // Focus on U28 to U15
    ZOOM_STATE.panY = Math.round(ch / 2 - (650 * targetScale));
  } else if (section === 'bot') {
    // Focus on U14 to U1
    ZOOM_STATE.panY = Math.round(ch - (1360 * targetScale) - 24);
  }

  updateStageTransform(true);
}

export function bindZoomAndPanEvents() {
  const canvas = dom.viewportCanvas;
  if (!canvas) return;

  // Mouse Wheel Zoom (centered at pointer, absolutely no page scrolling)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(ZOOM_STATE.scale * factor, e.clientX, e.clientY, false);
  }, { passive: false });

  // Click & Drag Panning
  canvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.del-device-btn')) {
      return;
    }
    ZOOM_STATE.isPanning = true;
    ZOOM_STATE.startX = e.clientX - ZOOM_STATE.panX;
    ZOOM_STATE.startY = e.clientY - ZOOM_STATE.panY;
    ZOOM_STATE.hasMoved = false;
    canvas.classList.add('panning');
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
    updateStageTransform(false);
  });

  window.addEventListener('mouseup', () => {
    if (ZOOM_STATE.isPanning) {
      ZOOM_STATE.isPanning = false;
      canvas.classList.remove('panning');
    }
  });

  // Double-click canvas toggles between Fit and 125% zoom
  canvas.addEventListener('dblclick', (e) => {
    if (e.target.closest('.port') || e.target.closest('.dev-btn')) return;
    if (ZOOM_STATE.scale > 0.85) {
      fitRackToScreen(true);
    } else {
      setZoom(1.25, e.clientX, e.clientY, true);
    }
  });

  // Zoom Buttons
  if (dom.btnZoomIn) {
    dom.btnZoomIn.addEventListener('click', () => {
      setZoom(ZOOM_STATE.scale * 1.25, undefined, undefined, true);
    });
  }
  if (dom.btnZoomOut) {
    dom.btnZoomOut.addEventListener('click', () => {
      setZoom(ZOOM_STATE.scale / 1.25, undefined, undefined, true);
    });
  }
  if (dom.btnZoomFit) {
    dom.btnZoomFit.addEventListener('click', () => {
      fitRackToScreen(true);
    });
  }
  if (dom.btnZoomActual) {
    dom.btnZoomActual.addEventListener('click', () => {
      setZoom(1.0, undefined, undefined, true);
    });
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

  // Quick Section Navigation
  if (dom.navJumpTop) dom.navJumpTop.addEventListener('click', () => jumpToSection('top'));
  if (dom.navJumpMid) dom.navJumpMid.addEventListener('click', () => jumpToSection('mid'));
  if (dom.navJumpBot) dom.navJumpBot.addEventListener('click', () => jumpToSection('bot'));
}
