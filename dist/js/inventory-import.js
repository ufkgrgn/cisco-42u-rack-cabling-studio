/* Offline observed-inventory import. Planned rack data is never overwritten. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  if (!RS) return;
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 5000;
  const FIELDS = ['instanceId', 'serialNumber', 'hostname', 'ipAddress', 'catalogKey', 'portId', 'interfaceName', 'description', 'vlan', 'status', 'collectedAt'];
  let dialog;
  let candidates = [];
  let sourceName = '';

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',' || char === '\n' || char === '\r') {
        if (char === ',') { row.push(field); field = ''; }
        else {
          if (char === '\r' && text[index + 1] === '\n') index++;
          row.push(field); field = '';
          if (row.some(value => value.trim())) rows.push(row);
          row = [];
          if (rows.length > MAX_ROWS + 1) throw new Error('Dosyada çok fazla satır var.');
        }
      } else field += char;
    }
    if (quoted) throw new Error('CSV alıntı işareti kapanmamış.');
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, '').trim()) || [];
    if (new Set(headers).size !== headers.length || !headers.some(key => ['instanceId', 'serialNumber', 'hostname'].includes(key))) throw new Error('CSV başlıkları geçersiz. Cihaz kimliği, seri numarası veya ad gerekir.');
    return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
  }

  function sanitize(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Geçersiz envanter satırı.');
    return Object.fromEntries(FIELDS.map(key => [key, String(row[key] ?? '').trim().slice(0, 200)]));
  }

  function findDevice(row) {
    const devices = (RS.STATE.racks || []).flatMap(rack => rack.devices || []);
    for (const key of ['instanceId', 'serialNumber', 'hostname']) {
      if (!row[key]) continue;
      const hits = devices.filter(device => String(device[key] || '').toLocaleLowerCase('tr') === row[key].toLocaleLowerCase('tr'));
      if (hits.length === 1) return { device: hits[0] };
      if (hits.length > 1) return { error: `${key} birden çok cihazla eşleşiyor` };
    }
    return { error: 'Cihaz bulunamadı' };
  }

  function prepare(rows) {
    if (rows.length > MAX_ROWS) throw new Error('Dosyada çok fazla satır var.');
    const seen = new Set();
    return rows.map((source, index) => {
      const row = sanitize(source);
      const match = findDevice(row);
      let error = match.error || '';
      if (match.device && row.portId) {
        const model = RS.HARDWARE_CATALOG?.[match.device.catalogKey] || RS.catalog?.[match.device.catalogKey];
        if (!model?.ports?.some(port => port.id === row.portId)) error = 'Port bu modelde bulunamadı';
      }
      const key = match.device ? `${match.device.instanceId}:${row.portId}` : `unmatched:${index}`;
      if (seen.has(key)) error = 'Dosyada yinelenen cihaz/port satırı';
      seen.add(key);
      return { row, device: match.device || null, error };
    });
  }

  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'inventory-import-dialog';
    dialog.className = 'inventory-import-dialog';
    dialog.setAttribute('aria-label', 'Envanter karşılaştır');
    dialog.innerHTML = `<div class="inventory-import-head"><h2>Envanter karşılaştır</h2><button type="button" data-inventory-action="close">Kapat</button></div>
      <p>Yerel CSV veya JSON dosyası seçin. Gözlemler planlanan cihaz ve bağlantıları değiştirmez.</p>
      <p class="inventory-import-hint">Başlıklar: instanceId veya serialNumber veya hostname; isteğe bağlı ipAddress, catalogKey, portId, interfaceName, description, vlan, status, collectedAt.</p>
      <input id="inventory-import-file" type="file" accept=".csv,.json,text/csv,application/json" aria-label="Envanter dosyası">
      <div id="inventory-import-status" role="status" aria-live="polite"></div>
      <div class="inventory-import-list"></div>
      <div class="inventory-import-actions"><button type="button" data-inventory-action="apply" disabled>Seçili gözlemleri kaydet</button></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      const action = event.target.closest('[data-inventory-action]')?.dataset.inventoryAction;
      if (action === 'close') dialog.close();
      if (action === 'apply') apply();
    });
    dialog.querySelector('#inventory-import-file').addEventListener('change', loadFile);
  }

  function render() {
    const list = dialog.querySelector('.inventory-import-list');
    list.replaceChildren();
    candidates.forEach((candidate, index) => {
      const label = document.createElement('label');
      label.className = 'inventory-import-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.dataset.index = String(index);
      checkbox.checked = !candidate.error; checkbox.disabled = Boolean(candidate.error);
      const text = document.createElement('span');
      const { row, device, error } = candidate;
      const changes = device ? [
        row.hostname && row.hostname !== (device.hostname || '') ? `ad: ${device.hostname || '—'} → ${row.hostname}` : '',
        row.ipAddress && row.ipAddress !== (device.ipAddress || '') ? `IP: ${device.ipAddress || '—'} → ${row.ipAddress}` : '',
        row.catalogKey && row.catalogKey !== device.catalogKey ? `model: ${device.catalogKey} → ${row.catalogKey}` : '',
        row.portId ? `port ${row.portId}: ${row.status || 'durum belirtilmedi'}` : ''
      ].filter(Boolean) : [];
      text.textContent = `${row.instanceId || row.serialNumber || row.hostname || 'Satır'} · ${device?.catalogKey || ''} · ${error || changes.join('; ') || 'Kimlik eşleşiyor'}`;
      label.append(checkbox, text); list.append(label);
    });
    const valid = candidates.filter(item => !item.error).length;
    dialog.querySelector('#inventory-import-status').textContent = `${candidates.length} satır; ${valid} eşleşme, ${candidates.length - valid} incelenecek satır.`;
    dialog.querySelector('[data-inventory-action="apply"]').disabled = valid === 0;
  }

  async function loadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    candidates = [];
    const status = dialog.querySelector('#inventory-import-status');
    try {
      if (file.size > MAX_BYTES) throw new Error('Dosya 5 MB sınırını aşıyor.');
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
      const rows = Array.isArray(parsed) ? parsed : parsed?.records;
      if (!Array.isArray(rows)) throw new Error('JSON bir dizi veya records dizisi içermeli.');
      candidates = prepare(rows);
      sourceName = file.name;
      render();
    } catch (error) {
      status.textContent = error.message || 'Dosya okunamadı.';
      dialog.querySelector('.inventory-import-list').replaceChildren();
      dialog.querySelector('[data-inventory-action="apply"]').disabled = true;
    }
  }

  function apply() {
    const checked = [...dialog.querySelectorAll('.inventory-import-row input:checked')];
    if (!checked.length) return;
    const receivedAt = new Date().toISOString();
    for (const checkbox of checked) {
      const { row, device, error } = candidates[Number(checkbox.dataset.index)];
      if (error || !device) continue;
      const observed = device.observed && typeof device.observed === 'object' ? structuredClone(device.observed) : { interfaces: {} };
      observed.source = sourceName;
      observed.collectedAt = row.collectedAt || receivedAt;
      for (const key of ['hostname', 'ipAddress', 'serialNumber', 'catalogKey']) if (row[key]) observed[key] = row[key];
      if (row.portId) {
        observed.interfaces ||= {};
        observed.interfaces[row.portId] = {
          interfaceName: row.interfaceName || '',
          description: row.description || '',
          vlan: row.vlan || '',
          status: row.status || ''
        };
      }
      device.observed = observed;
    }
    RS.refresh?.();
    dialog.close();
  }

  function open() { ensure(); candidates = []; sourceName = ''; dialog.querySelector('#inventory-import-file').value = ''; dialog.querySelector('.inventory-import-list').replaceChildren(); dialog.querySelector('#inventory-import-status').textContent = ''; dialog.querySelector('[data-inventory-action="apply"]').disabled = true; dialog.showModal(); }
  document.getElementById('btn-inventory-import')?.addEventListener('click', open);
  RS.InventoryImport = { open };
})();
