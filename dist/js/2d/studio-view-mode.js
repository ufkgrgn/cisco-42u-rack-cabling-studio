/** Placement/cabling presentation and camera LOD; never mutates topology. */
(function () {
  'use strict';
  const RS = window.RackStudio, STATE = RS.STATE;
  let cameraLod = null;
  function getCameraLod() {
    const scale = RS.ZOOM_STATE?.scale || 1;
    // Hysteresis prevents rapid layer switches at the two zoom boundaries.
    if (!cameraLod) cameraLod = scale < 0.48 ? 'macro' : scale < 0.72 ? 'medium' : 'detail';
    else if (cameraLod === 'macro') cameraLod = scale < 0.52 ? 'macro' : scale < 0.76 ? 'medium' : 'detail';
    else if (cameraLod === 'detail') cameraLod = scale >= 0.68 ? 'detail' : scale < 0.44 ? 'macro' : 'medium';
    else cameraLod = scale < 0.44 ? 'macro' : scale >= 0.76 ? 'detail' : 'medium';
    return cameraLod;
  }
  function isOverview() { return STATE.studioWorkMode === 'layout' || getCameraLod() === 'macro'; }
  function areCablesShown() { return STATE.cablesVisible !== false && !isOverview(); }
  function flushDeferredCables() {
    if (areCablesShown() && RS.PixiContext?.cablesDeferred) RS.renderAllCablesPixi?.();
  }
  function syncCableVisibility() {
    const ctx = RS.PixiContext, show = areCablesShown(), detail = getCameraLod() === 'detail';
    const layers = [ctx?.getCablesContainer?.(), ctx?.getFocusContainer?.(), ctx?.organizerOverlayContainer];
    layers.forEach(layer => { if (layer) layer.visible = show; });
    const connectors = ctx?.getConnectorsContainer?.();
    if (connectors) connectors.visible = show && detail;
    const button = document.getElementById('btn-toggle-cables');
    const reason = STATE.studioWorkMode === 'layout' ? 'Yerleşimde kablolar gizli' : getCameraLod() === 'macro' ? 'Yakınlaşınca kablolar görünür' : '';
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
    if (changed && isOverview()) clearCableInteraction();
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
  RS.StudioView = Object.freeze({ getCameraLod, isOverview, areCablesShown, syncCableVisibility, syncPresentation });
  Object.assign(RS, { setStudioWorkMode, setCablesVisible, toggleCablesVisibility });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setStudioWorkMode(STATE.studioWorkMode));
  else setStudioWorkMode(STATE.studioWorkMode);
})();
