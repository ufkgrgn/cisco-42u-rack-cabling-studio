/**
 * Printable single-rack field sheet built from the live cable schedule.
 */
(function () {
  'use strict';

  const COLOR_NAMES = {
    '#2563eb': 'Cat6 mavi',
    '#eab308': 'VoIP sarı',
    '#22c55e': 'Yönetim yeşil',
    '#ef4444': 'Uplink kırmızı',
    '#06b6d4': 'OM4 aqua',
    '#f97316': 'OS2 turuncu',
    '#a855f7': 'SAN mor',
    '#94a3b8': 'Konsol gri'
  };

  let overlay = null;

  function escapeHtml(value) {
    const fn = window.RackStudio?.escapeHtml;
    if (fn) return fn(value);
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function colorName(hex) {
    const key = String(hex || '').toLowerCase();
    return COLOR_NAMES[key] || key || '—';
  }

  function rackOf(instanceId) {
    const racks = window.RackStudio?.STATE?.racks || [];
    for (const rack of racks) {
      if ((rack.devices || []).some(d => d.instanceId === instanceId)) return rack;
    }
    return null;
  }

  function buildRows(rack) {
    const cables = window.RackStudio?.STATE?.cables || [];
    const info = window.RackStudio?.SvgCablePathway?.getCableEndpointInfo;
    return cables.filter(cable => {
      const fromId = cable.from?.instanceId || cable.from?.deviceId;
      const toId = cable.to?.instanceId || cable.to?.deviceId;
      return rackOf(fromId)?.id === rack.id || rackOf(toId)?.id === rack.id;
    }).map(cable => {
      const from = info ? info(rack, cable.from) : { deviceName: 'Kaynak', portName: cable.from?.portId || '' };
      const to = info ? info(rack, cable.to) : { deviceName: 'Hedef', portName: cable.to?.portId || '' };
      return { cable, from, to };
    });
  }

  function ensure() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'field-sheet';
    overlay.className = 'instrument-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="field-sheet" role="dialog" aria-modal="true" aria-label="Saha kartı">
        <div class="field-sheet-card">
          <h2>Saha kartı</h2>
          <div class="field-meta" id="field-sheet-meta"></div>
          <table class="field-table">
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Hedef</th>
                <th>Renk</th>
                <th>Metraj</th>
              </tr>
            </thead>
            <tbody id="field-sheet-body"></tbody>
          </table>
          <div class="overlay-actions">
            <button type="button" id="btn-field-sheet-close">Kapat</button>
            <button type="button" id="btn-field-sheet-print">Yazdır</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#btn-field-sheet-close')?.addEventListener('click', close);
    overlay.querySelector('#btn-field-sheet-print')?.addEventListener('click', () => window.print());
  }

  function open() {
    ensure();
    const rack = window.RackStudio?.getActiveRack?.() || window.RackStudio?.STATE?.racks?.[0];
    const meta = overlay.querySelector('#field-sheet-meta');
    const body = overlay.querySelector('#field-sheet-body');
    if (!rack || !body) return;
    if (meta) {
      meta.textContent = `${rack.name} · ${rack.heightU || 42}U`;
    }
    const rows = buildRows(rack);
    body.innerHTML = rows.length ? rows.map(({ cable, from, to }) => {
      const color = cable.color || '#2563eb';
      const meters = cable.lengthMeters != null ? `${cable.lengthMeters} m` : '—';
      return `<tr>
        <td>${escapeHtml(from.deviceName)}<br><span class="field-meta">${escapeHtml(from.portName)}</span></td>
        <td>${escapeHtml(to.deviceName)}<br><span class="field-meta">${escapeHtml(to.portName)}</span></td>
        <td><span class="field-swatch" style="background:${escapeHtml(color)}"></span>${escapeHtml(colorName(color))}</td>
        <td class="field-meta">${escapeHtml(meters)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4">Bu kabinde kablo yok.</td></tr>';
    overlay.hidden = false;
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  function init() {
    document.getElementById('btn-field-sheet')?.addEventListener('click', () => open());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RackStudioFieldSheet = { open, close };
})();
