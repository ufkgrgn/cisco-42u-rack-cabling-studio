/** Placement/cabling presentation and camera LOD; never mutates topology. */
(function () {
  'use strict';
  const RS = window.RackStudio, STATE = RS.STATE;
  let cameraLod = null;
  function getCameraLod() {
    const scale = RS.ZOOM_STATE?.scale || 1;
    // Keep fine details strictly above 200%; separate thresholds avoid flicker.
    const previous = cameraLod;
    const macroBoundary = previous === 'macro' ? 0.70 : 0.65;
    const portBoundary = previous === 'ports' || previous === 'detail' ? 1.10 : 1.15;
    const detailBoundary = previous === 'detail' ? 2.00 : 2.05;
    cameraLod = scale <= macroBoundary ? 'macro' : scale < portBoundary ? 'medium'
      : scale <= detailBoundary ? 'ports' : 'detail';
    return cameraLod;
  }
  function isOverview() { return STATE.studioWorkMode === 'layout' || getCameraLod() === 'macro'; }
  function areCablesShown() { return STATE.cablesVisible !== false && !isOverview() && ['ports', 'detail'].includes(getCameraLod()); }
  function flushDeferredCables() {
    if (areCablesShown() && RS.PixiContext?.cablesDeferred) RS.renderAllCablesPixi?.();
  }
  function syncCableVisibility() {
    const ctx = RS.PixiContext, show = areCablesShown(), detail = getCameraLod() === 'detail';
    const layers = [ctx?.getCablesContainer?.(), ctx?.getFocusContainer?.()];
    layers.forEach(layer => { if (layer) layer.visible = show; });
    if (ctx?.organizerOverlayContainer) ctx.organizerOverlayContainer.visible = show && detail;
    const connectors = ctx?.getConnectorsContainer?.();
    if (connectors) connectors.visible = show && detail;
    const button = document.getElementById('btn-toggle-cables');
    const reason = STATE.studioWorkMode === 'layout' ? 'Yerleşimde kablolar gizli' : !['ports', 'detail'].includes(getCameraLod()) ? 'Port ve kablolar için %115 üzerine yakınlaşın' : '';
    if (button) {
      button.disabled = STATE.studioWorkMode === 'layout';
      button.classList.toggle('active', show);
      button.setAttribute('aria-pressed', String(show));
      button.title = reason || (show ? 'Kabloları gizle (C)' : 'Kabloları göster (C)');
      const label = button.querySelector('.btn-text');
      if (label) label.textContent = show ? 'Kablolar açık' : 'Kablolar gizli';
    }
    document.querySelectorAll('[data-shortcut-for="btn-toggle-cables"]').forEach(btn => {
      btn.disabled = STATE.studioWorkMode === 'layout';
      btn.setAttribute('aria-pressed', String(show));
      btn.textContent = (show ? 'Kabloları gizle' : 'Kabloları göster') + ' (C)';
    });
    return show;
  }
  function clearCableInteraction() {
    RS.cancelPendingConnection?.();
    RS.hideCableQuickHud?.();
    RS.hideCableContextMenu?.();
    RS.setHoveredDevicePortKey?.(null);
    RS.setCableHover?.(null);
    ['tooltip', 'port-tooltip', 'cable-tooltip'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  }
  function syncPresentation() {
    const lod = getCameraLod();
    const changed = RS.dom?.rackStage?.getAttribute('data-lod') !== lod;
    RS.dom?.rackStage?.setAttribute('data-lod', lod);
    document.documentElement.dataset.studioOverview = String(isOverview());
    if (changed && !['ports', 'detail'].includes(lod)) clearCableInteraction();
    syncCableVisibility();
    RS.syncPixiDeviceSceneLOD?.();
    flushDeferredCables();
    RS.LayoutOverview?.syncVisibility();
    RS.PixiContext?.renderPixi?.('studio-presentation');
  }
  function setStudioWorkMode(mode) {
    if (!['layout', 'cabling'].includes(mode)) return STATE.studioWorkMode;
    STATE.studioWorkMode = mode;
    document.documentElement.dataset.studioMode = mode;
    ['layout', 'cabling'].forEach(value => {
      const button = document.getElementById(`btn-mode-${value}`);
      button?.classList.toggle('active', value === mode);
      button?.setAttribute('aria-pressed', String(value === mode));
      document.querySelectorAll(`[data-shortcut-for="btn-mode-${value}"]`).forEach(btn => btn.setAttribute('aria-pressed', String(value === mode)));
    });
    if (mode === 'layout') clearCableInteraction();
    syncPresentation();
    document.dispatchEvent(new CustomEvent('rackstudio:studio-work-mode', { detail: { mode } }));
    return mode;
  }
  function setCablesVisible(visible) {
    STATE.cablesVisible = Boolean(visible);
    if (!visible) clearCableInteraction();
    syncCableVisibility();
    flushDeferredCables();
    RS.PixiContext?.renderPixi?.('cable-visibility');
    return STATE.cablesVisible;
  }

  function toggleCablesVisibility() {
    if (STATE.studioWorkMode === 'layout') return STATE.cablesVisible;
    return setCablesVisible(STATE.cablesVisible === false);
  }

  function syncPortNumbersButton() {
    const show = STATE.portNumbersVisible !== false;
    const button = document.getElementById('btn-toggle-port-numbers');
    if (button) {
      button.classList.toggle('active', show);
      button.setAttribute('aria-pressed', String(show));
      button.title = show ? 'Port numaralarını gizle (N)' : 'Port numaralarını göster (N)';
      const label = button.querySelector('.btn-text');
      if (label) label.textContent = show ? 'Port No (N)' : 'Port No Gizli (N)';
    }
    document.querySelectorAll('[data-shortcut-for="btn-toggle-port-numbers"]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(show));
      btn.textContent = (show ? 'Port No açık' : 'Port No gizli') + ' (N)';
    });
  }

  function setPortNumbersVisible(visible) {
    STATE.portNumbersVisible = Boolean(visible);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('rackstudio_port_numbers_visible', STATE.portNumbersVisible ? '1' : '0');
      }
    } catch (_) {}
    syncPortNumbersButton();
    RS.syncPortLabelsVisibility?.();
    RS.PixiContext?.renderPixi?.('port-numbers-toggle');
    return STATE.portNumbersVisible;
  }

  function togglePortNumbersVisibility() {
    return setPortNumbersVisible(STATE.portNumbersVisible === false);
  }

  function initPortNumbersToggleUI() {
    syncPortNumbersButton();
    const btn = document.getElementById('btn-toggle-port-numbers');
    if (btn && !btn.__wired) {
      btn.__wired = true;
      btn.addEventListener('click', () => togglePortNumbersVisibility());
    }
    document.querySelectorAll('[data-shortcut-for="btn-toggle-port-numbers"]').forEach(el => {
      if (!el.__wired) {
        el.__wired = true;
        el.addEventListener('click', () => togglePortNumbersVisibility());
      }
    });
  }

  RS.StudioView = Object.freeze({ getCameraLod, isOverview, areCablesShown, syncCableVisibility, syncPresentation });
  Object.assign(RS, {
    setStudioWorkMode,
    setCablesVisible,
    toggleCablesVisibility,
    setPortNumbersVisible,
    togglePortNumbersVisibility,
    syncPortNumbersButton
  });

  const initAllViews = () => {
    setStudioWorkMode(STATE.studioWorkMode);
    initPortNumbersToggleUI();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAllViews);
  else initAllViews();
})();
