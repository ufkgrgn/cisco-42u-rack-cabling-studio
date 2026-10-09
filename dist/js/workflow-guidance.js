/** Presentation only. Connection validity is decided by existing commands. */
(function () {
  'use strict';
  const RS = window.RackStudio;
  let panel, message, actions, previous = '', notice = null, projectId;
  const button = (text, fn) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.addEventListener('click', fn); return el; };
  function endpoint(ref) {
    const rack = RS.STATE.racks.find(r => r.id === ref?.rackId);
    const device = rack?.devices.find(d => d.instanceId === ref.instanceId);
    const item = RS.HARDWARE_CATALOG[device?.catalogKey] || RS.STATE.customCatalog?.[device?.catalogKey];
    const port = item?.ports?.find(p => String(p.id) === String(ref?.portId));
    return [rack?.name, device?.hostname || device?.name || item?.name, port?.name || ref?.portId].filter(Boolean).join(' · ');
  }
  function update() {
    if (!panel) return;
    const currentProject = RS.STATE.projectDocument?.projectId;
    if (projectId !== currentProject) { notice = null; projectId = currentProject; }
    const pending = RS.STATE.pendingConnection;
    const signature = JSON.stringify([pending && [pending.rackId, pending.instanceId, pending.portId], notice]);
    if (signature === previous) return;
    previous = signature; actions.replaceChildren(); panel.hidden = !pending && !notice;
    panel.dataset.tone = notice?.tone || 'info';
    if (notice) { message.textContent = notice.text; actions.append(button('Kapat', () => { notice = null; update(); })); }
    else if (pending) message.textContent = `Hedef portu seçin. Kaynak: ${endpoint(pending)}. Başka kabindeki boş bir portu da seçebilirsiniz.`;
    if (pending) actions.append(button('İptal', () => { RS.cancelPendingConnection?.(); notice = null; update(); }));
    if (pending || notice?.tone === 'error') actions.append(button('Bağlantı yardımı', () => RS.Help.open('cabling')));
  }
  function error(reason) { notice = { tone: 'error', text: `${reason} Port türlerini ve doluluk durumunu kontrol edip uygun boş portlarla yeniden deneyin.` }; update(); }
  function success(cable) { notice = { tone: 'success', text: `Bağlantı oluşturuldu: ${endpoint(cable.from)} → ${endpoint(cable.to)}. Bağlantılar listesinden kontrol edin; geri almak için Ctrl+Z kullanın.` }; update(); }
  function clear() { notice = null; update(); }
  function init() {
    panel = document.createElement('aside'); panel.className = 'guidance-panel'; panel.id = 'workflow-guidance'; panel.hidden = true; panel.setAttribute('aria-label', 'Bağlantı yönlendirmesi');
    message = document.createElement('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
    actions = document.createElement('div'); actions.className = 'guidance-actions'; panel.append(message, actions); (document.getElementById('rack-viewport') || document.body).append(panel);
    const footer=document.querySelector('.workspace-canvas-footer');if(footer)footer.before(panel);
    setInterval(update, 500);
    let mode = RS.STATE.studioWorkMode;
    document.addEventListener('rackstudio:studio-work-mode', () => {
      if (mode !== RS.STATE.studioWorkMode) clear();
      mode = RS.STATE.studioWorkMode;
    });
    document.addEventListener('rackstudio:change', update); update();
  }
  RS.Guidance = Object.freeze({ update, error, success, clear });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
