/** Placement inventory and legend, shared by single and multiple rack views. */
(function () {
  'use strict';
  const RS = window.RackStudio;
  let panel, legend, signature = '';
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function color(el, profile) {
    el.style.setProperty('--device-accent', profile.accent);
    el.style.setProperty('--device-surface', profile.surface);
    el.style.setProperty('--device-text', profile.text);
  }
  function syncVisibility() {
    if (!panel) return;
    const layout = RS.STATE.studioWorkMode === 'layout';
    const overview = RS.StudioView.isOverview();
    panel.hidden = !layout;
    legend.hidden = !overview;
    const title = document.querySelector('#sidebar-right .schedule-title');
    if (title) title.textContent = layout ? 'Kabin yerleşimi' : 'Bağlantı Listesi';
    const mobile = document.getElementById('btn-mobile-schedule');
    if (mobile) mobile.textContent = layout ? 'Cihazlar' : 'Bağlantılar';
    const note = document.getElementById('studio-view-note');
    if (note) note.textContent = layout ? 'Cihazları yerleştir · boş U alanına bırak' : overview ? 'Genel yerleşim · port ve kablolar için yakınlaş' : 'Port seç · bağlantıları düzenle';
  }
  function refresh() {
    if (!panel) return;
    const racks = RS.STATE.viewMode === 'multi' ? RS.STATE.racks : [RS.getActiveRack()].filter(Boolean);
    const next = JSON.stringify([document.documentElement.dataset.theme, racks.map(r => [r.id, r.name, r.heightU, r.devices.map(d => [d.instanceId, d.catalogKey, d.topU, d.uHeight, d.hostname, d.name])])]);
    syncVisibility();
    if (next === signature) return;
    signature = next;
    panel.replaceChildren();
    const devices = racks.flatMap(r => r.devices), used = devices.reduce((sum, d) => sum + d.uHeight, 0);
    const total = racks.reduce((sum, r) => sum + r.heightU, 0);
    const summary = node('div', undefined, 'layout-summary');
    [[devices.length, 'cihaz'], [used + 'U', 'dolu'], [(total - used) + 'U', 'boş']].forEach(([value, label]) => {
      const item = node('div'); item.append(node('strong', String(value)), node('span', label)); summary.append(item);
    });
    panel.append(summary, node('p', 'Yerleşimi kontrol edin. Bir cihazı seçerek kabindeki konumuna odaklanabilirsiniz.', 'layout-help'));
    const keys = new Set();
    racks.forEach(rack => {
      const heading = node('div', undefined, 'layout-rack-heading');
      heading.append(node('strong', rack.name), node('span', rack.heightU + 'U'));
      panel.append(heading);
      const list = node('ul', undefined, 'layout-device-list');
      [...rack.devices].sort((a, b) => b.topU - a.topU).forEach(device => {
        const info = RS.DeviceLayoutPresentation.describe(device, rack);
        keys.add(info.profile.key);
        const li = node('li'), button = node('button', undefined, 'layout-device-row');
        button.type = 'button'; button.dataset.icon = 'none'; button.dataset.instanceId = device.instanceId; color(button, info.profile);
        const name = node('span', undefined, 'layout-device-name');
        name.append(node('strong', info.model), node('small', [info.profile.label, info.hostname].filter(Boolean).join(' · ')));
        button.append(node('span', info.position, 'layout-device-u'), name);
        button.title = `${info.model} · ${info.position}`;
        button.addEventListener('click', () => {
          if (RS.STATE.activeRackId !== rack.id) RS.switchActiveRack(rack.id, { smoothFocus: false });
          document.querySelectorAll('.mounted-device.studio-selected').forEach(el => el.classList.remove('studio-selected'));
          document.getElementById(device.instanceId)?.classList.add('studio-selected');
          RS.STATE.selectedDeviceId = device.instanceId;
          RS.syncPixiDeviceSelection?.();
          document.dispatchEvent(new CustomEvent('rackstudio:selection', { detail: { kind: 'device', id: device.instanceId, source: '2d' } }));
          RS.focusOnDevice?.(device.instanceId);
        });
        li.append(button); list.append(li);
      });
      if (!rack.devices.length) panel.append(node('p', 'Kütüphaneden cihaz seçip boş bir U alanına bırakın.', 'layout-help'));
      panel.append(list);
    });
    legend.replaceChildren(node('span', 'Cihaz türleri', 'layout-legend-title'));
    for (const key of Object.keys(RS.DeviceLayoutPresentation.profiles)) {
      if (!keys.has(key)) continue;
      const profile = RS.DeviceLayoutPresentation.profile(key), item = node('span', profile.label, 'layout-legend-item');
      color(item, profile); legend.append(item);
    }
  }
  function init() {
    panel = node('section', undefined, 'layout-overview'); panel.id = 'layout-overview';
    panel.setAttribute('aria-label', 'Kabin cihaz yerleşimi');
    document.getElementById('sidebar-right')?.append(panel);
    legend = node('div', undefined, 'layout-legend'); legend.id = 'layout-legend';
    legend.setAttribute('aria-label', 'Yerleşim renk açıklamaları');
    const bar = node('div', undefined, 'studio-view-caption');
    const modeSwitch = document.getElementById('studio-work-mode-switch');
    const cableToggle = document.getElementById('btn-toggle-cables');
    const note = node('span', undefined, 'studio-view-note'); note.id = 'studio-view-note';
    if (modeSwitch) bar.append(modeSwitch);
    if (cableToggle) bar.append(cableToggle);
    bar.append(note);
    document.getElementById('rack-viewport')?.append(bar, legend);
    ['rackstudio:change', 'rackstudio:refresh', 'rackstudio:studio-work-mode'].forEach(type => document.addEventListener(type, refresh));
    window.addEventListener('rackstudio:refresh', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // View and active-rack switches can update only the rack tabs without a topology event.
    const tabs = document.getElementById('rack-selector-wrapper');
    if (tabs) new MutationObserver(refresh).observe(tabs, { childList: true, subtree: true, attributes: true });
    refresh();
  }
  RS.LayoutOverview = Object.freeze({ refresh, syncVisibility });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
