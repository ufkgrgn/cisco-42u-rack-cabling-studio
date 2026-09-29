/* Read-only project checks with direct navigation to affected objects. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  if (!RS) return;
  let dialog;

  function collect() {
    const state = RS.STATE;
    const catalog = RS.HARDWARE_CATALOG || RS.catalog || {};
    const issues = [];
    const hostnames = new Map();
    const serials = new Map();
    const devices = new Map();
    const add = (severity, text, target) => issues.push({ severity, text, target });
    for (const rack of state.racks || []) {
      for (const device of rack.devices || []) {
        devices.set(device.instanceId, { device, rack });
        for (const [value, registry, label] of [[device.hostname, hostnames, 'Cihaz adı'], [device.serialNumber, serials, 'Seri numarası']]) {
          const key = String(value || '').trim().toLocaleLowerCase('tr');
          if (!key) continue;
          if (registry.has(key)) add('warning', `${label} tekrar ediyor: ${value}`, { deviceId: device.instanceId });
          else registry.set(key, device.instanceId);
        }
        const observed = device.observed;
        if (observed) {
          for (const [key, label] of [['hostname', 'Ad'], ['ipAddress', 'IP'], ['catalogKey', 'Model']]) {
            if (observed[key] && observed[key] !== device[key]) add('difference', `${label} farklı: ${device[key] || '—'} → ${observed[key]}`, { deviceId: device.instanceId });
          }
        }
        const geometry = catalog[device.catalogKey]?.portGeometry;
        if (geometry && geometry.verification !== 'verified') add('info', `${device.hostname || device.name || device.catalogKey}: port yerleşimi ${geometry.verification === 'calibrated-local' ? 'yerel kalibrasyon' : 'yaklaşık'}`, { deviceId: device.instanceId });
      }
    }
    for (const cable of state.cables || []) {
      const from = devices.get(cable.from?.instanceId);
      const to = devices.get(cable.to?.instanceId);
      if (!from || !to) {
        add('error', `${cable.name || cable.id}: uç cihaz bulunamadı`, { cableId: cable.id });
        continue;
      }
      const sourcePort = catalog[from.device.catalogKey]?.ports?.find(port => port.id === cable.from.portId);
      const targetPort = catalog[to.device.catalogKey]?.ports?.find(port => port.id === cable.to.portId);
      if (!sourcePort || !targetPort) add('error', `${cable.name || cable.id}: port katalogda bulunamadı`, { cableId: cable.id });
      else {
        const result = RS.NetworkRules?.validateConnection?.(cable.from, cable.to, { ...state, strictCompliance: true }, catalog, true);
        if (result && !result.allowed) add('error', `${cable.name || cable.id}: ${result.reason}`, { cableId: cable.id });
      }
      if (!cable.medium) add('info', `${cable.name || cable.id}: kablo ortamı belirtilmedi`, { cableId: cable.id });
      if (!cable.role) add('info', `${cable.name || cable.id}: kablo rolü belirtilmedi`, { cableId: cable.id });
    }
    return issues;
  }

  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'project-checks-dialog';
    dialog.className = 'project-checks-dialog';
    dialog.setAttribute('aria-label', 'Proje denetimi');
    dialog.innerHTML = `<div class="project-checks-head"><h2>Proje denetimi</h2><button type="button" data-check-action="close">Kapat</button></div><p id="project-checks-summary" role="status"></p><div class="project-checks-list"></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-check-action="close"]')) dialog.close();
    });
  }

  function open() {
    ensure();
    const issues = collect();
    const list = dialog.querySelector('.project-checks-list');
    list.replaceChildren();
    const counts = ['error', 'warning', 'difference', 'info'].map(type => issues.filter(issue => issue.severity === type).length);
    dialog.querySelector('#project-checks-summary').textContent = `${counts[0]} hata · ${counts[1]} uyarı · ${counts[2]} gözlem farkı · ${counts[3]} bilgi`;
    if (!issues.length) list.textContent = 'Denetimde sorun bulunmadı.';
    for (const issue of issues.slice(0, 300)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `project-check-item ${issue.severity}`;
      button.textContent = `${issue.severity === 'error' ? 'Hata' : issue.severity === 'warning' ? 'Uyarı' : issue.severity === 'difference' ? 'Gözlem farkı' : 'Bilgi'} · ${issue.text}`;
      button.addEventListener('click', () => {
        dialog.close();
        if (issue.target.cableId) {
          RS.highlightCable?.(issue.target.cableId, true);
          if (window.is3DMode) window.__STUDIO3D__?.focusCable?.(issue.target.cableId);
          else RS.focusOnCable?.(issue.target.cableId);
        } else if (issue.target.deviceId) {
          if (window.is3DMode) window.__STUDIO3D__?.focusDevice?.(issue.target.deviceId);
          else RS.focusOnDevice?.(issue.target.deviceId);
        }
      });
      list.append(button);
    }
    dialog.showModal();
  }

  document.getElementById('btn-project-checks')?.addEventListener('click', open);
  RS.ProjectChecks = { collect, open };
})();
