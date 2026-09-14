/* Editing commands, bounded history and local recovery. No render loop. */
(() => {
  'use strict';
  function init() {
    const api = window.RackStudio;
    if (!api) return;
    const state = api.STATE, KEY = 'rack-studio-project-v2';
    const bar = document.createElement('section');
    bar.className = 'studio-editor';
    bar.setAttribute('aria-label', 'Kabin düzenleme araçları');
    bar.innerHTML = `<label>Kabin U <input id="studio-height" type="number" min="1" max="60" value="42"></label><button data-command="resize">Uygula</button><span class="studio-divider"></span><span id="studio-selection">Cihaz seçin</span><label>Üst U <input id="studio-position" type="number" min="1" max="60"></label><select id="studio-target" aria-label="Hedef kabin"></select><button data-command="move">Taşı</button><button data-command="duplicate">Çoğalt</button><button data-command="delete">Sil</button><span class="studio-divider"></span><button data-command="undo" title="Ctrl+Z">Geri al</button><button data-command="redo" title="Ctrl+Shift+Z">Yinele</button><span id="studio-save" role="status" aria-live="polite"></span>`;
    const tabs = document.getElementById('rack-tabs-bar');
    if (!tabs) return;
    tabs.after(bar);
    const field = id => bar.querySelector('#studio-' + id);
    let selected = null, restoring = false, queued = false, saveTimer, revision = 0, recoveryPending = true;
    let undo = [], redo = [], last = '';
    const database = new Promise(resolve => {
      try {
        const request = indexedDB.open('rack-studio', 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects'); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => { status('Yerel veritabanı başka sekmede bekliyor', true); };
      } catch (_) { resolve(null); }
    });
    const databaseAction = (db, mode, value) => new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', mode);
      const store = transaction.objectStore('projects');
      const request = mode === 'readonly' ? store.get('current') : store.put(value, 'current');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error || new Error('Veritabanı işlemi başarısız'));
      transaction.onabort = () => reject(transaction.error || new Error('Veritabanı işlemi iptal edildi'));
    });
    function capHistory() {
      let bytes = [...undo, ...redo].reduce((size, entry) => size + entry.length * 2, 0);
      while (undo.length + redo.length > 50 || bytes > 20 * 1024 * 1024) {
        const entry = undo.length ? undo.shift() : redo.shift();
        if (!entry) break;
        bytes -= entry.length * 2;
      }
    }
    const snapshot = () => JSON.stringify({racks: state.racks, cables: state.cables, rackCounter: state.rackCounter, cableCounter: state.cableCounter, customCatalog: state.customCatalog || {}, activeRackId: state.activeRackId});
    const status = (message, error = false) => { field('save').textContent = message; field('save').classList.toggle('error', error); };
    const selection = () => {
      for (const rack of state.racks) {
        const device = rack.devices.find(d => d.instanceId === selected);
        if (device) return {rack, device};
      }
      return null;
    };
    function sync() {
      const rack = api.getActiveRack(), found = selection();
      field('height').value = rack.heightU || 42;
      const previousTarget = field('target').value;
      field('target').replaceChildren(...state.racks.map(r => { const option = document.createElement('option'); option.value = r.id; option.textContent = r.name; return option; }));
      field('target').value = state.racks.some(r => r.id === previousTarget) ? previousTarget : rack.id;
      field('selection').textContent = found ? (api.catalog[found.device.catalogKey]?.name || found.device.catalogKey) : 'Cihaz seçin';
      field('position').value = found ? found.device.topU : '';
      for (const name of ['move','duplicate','delete']) bar.querySelector(`[data-command="${name}"]`).disabled = !found;
      bar.querySelector('[data-command="undo"]').disabled = !undo.length;
      bar.querySelector('[data-command="redo"]').disabled = !redo.length;
      document.querySelectorAll('.mounted-device').forEach(el => el.classList.toggle('studio-selected', el.id === selected));
    }
    async function save() {
      clearTimeout(saveTimer);
      if (recoveryPending || !last) return;
      const value = last, savedRevision = revision;
      try {
        const db = await database;
        if (db) {
          await databaseAction(db, 'readwrite', value);
          try { localStorage.removeItem(KEY); } catch (_) { /* IndexedDB already committed. */ }
        } else localStorage.setItem(KEY, value);
        if (savedRevision === revision) status(db ? 'Yerel kayıt tamam' : 'Yerel kayıt tamam (sınırlı depolama)');
      }
      catch (_) { status('Yerel kayıt başarısız — JSON dışa aktarın', true); }
    }
    function record() {
      queued = false;
      if (restoring) return;
      const next = snapshot();
      if (last && next !== last) { undo.push(last); redo = []; capHistory(); last = next; revision++; status('Kaydediliyor…'); clearTimeout(saveTimer); saveTimer = setTimeout(save, 350); sync(); }
      else if (!last) { last = next; sync(); }
    }
    function scheduleRecord() { if (!queued && !restoring) { queued = true; queueMicrotask(record); } }
    function restore(value) {
      restoring = true;
      try { api.loadCustomTopology(JSON.parse(value)); last = snapshot(); selected = null; revision++; }
      finally { restoring = false; }
      sync(); save();
    }
    function history(back) {
      record();
      const source = back ? undo : redo, destination = back ? redo : undo;
      if (!source.length) return;
      const value = source[source.length - 1], current = last;
      restore(value); source.pop(); destination.push(current); capHistory(); sync();
    }
    const canPlace = (rack, device, topU, ignore = null) => Number.isInteger(topU) && topU <= (rack.heightU || 42) && topU - device.uHeight + 1 >= 1 && !rack.devices.some(d => d.instanceId !== ignore && topU >= d.topU - d.uHeight + 1 && topU - device.uHeight + 1 <= d.topU);
    function rebuild(rack) {
      rack.units = Array((rack.heightU || 42) + 1).fill(null);
      rack.devices.forEach(d => { for (let u = d.topU - d.uHeight + 1; u <= d.topU; u++) rack.units[u] = d.instanceId; });
    }
    function move(topU, rackId, duplicate = false) {
      const found = selection(), target = state.racks.find(r => r.id === rackId);
      if (!found || !target) return;
      const {rack, device} = found;
      if (!canPlace(target, device, topU, duplicate ? null : device.instanceId)) throw new Error('Yerleşim çakışıyor veya kabin sınırları dışında.');
      if (duplicate) {
        const created = api.mountDeviceAt(device.catalogKey, topU, target.id);
        if (!created) throw new Error('Cihaz eklenemedi.');
        selected = created.instanceId;
      } else {
        rack.devices = rack.devices.filter(d => d.instanceId !== device.instanceId);
        target.devices.push(device); device.topU = topU;
        for (const cable of state.cables) for (const end of [cable.from, cable.to]) if (end.instanceId === device.instanceId) end.rackId = target.id;
      }
      rebuild(rack); rebuild(target); state.activeRackId = target.id;
      state.pendingConnection = null; api.refresh(); record();
    }
    function command(name) {
      try {
        if (name === 'undo' || name === 'redo') return history(name === 'undo');
        if (name === 'resize') {
          const rack = api.getActiveRack(), height = Number(field('height').value);
          if (!Number.isInteger(height) || height < 1 || height > 60) throw new Error('Kabin yüksekliği 1–60 U olmalı.');
          if (rack.devices.some(d => d.topU > height)) throw new Error('Önce üst sınırın dışındaki cihazları taşıyın.');
          rack.heightU = height; rebuild(rack); api.refresh(); api.fit(); record();
        } else if (name === 'move') move(Number(field('position').value), field('target').value);
        else if (name === 'duplicate') {
          const found = selection(), target = state.racks.find(r => r.id === field('target').value);
          if (!found || !target) return;
          let top = target.heightU || 42;
          while (top >= found.device.uHeight && !canPlace(target, found.device, top)) top--;
          move(top, target.id, true);
        } else if (name === 'delete') {
          const found = selection(); if (!found) return;
          found.rack.devices = found.rack.devices.filter(d => d.instanceId !== selected);
          state.cables = state.cables.filter(c => c.from.instanceId !== selected && c.to.instanceId !== selected);
          rebuild(found.rack); selected = null; state.pendingConnection = null; api.refresh(); record();
        }
      } catch (error) { status(error.message, true); }
    }
    bar.addEventListener('click', e => { const button = e.target.closest('[data-command]'); if (button) command(button.dataset.command); });
    document.addEventListener('click', e => {
      if (e.target.closest('button,.port-icon,.port,[data-port-id],input,select,textarea')) return;
      const device = e.target.closest('.mounted-device');
      if (device) { selected = device.id; field('target').value = api.getActiveRack().id; sync(); }
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); command(e.shiftKey ? 'redo' : 'undo'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); command('redo'); }
      else if (selected && ['Delete','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Delete') command('delete');
        else { const found = selection(); if (found) { field('position').value = found.device.topU + (e.key === 'ArrowUp' ? 1 : -1); field('target').value = found.rack.id; command('move'); } }
      }
    });
    let drag = null, frame = 0;
    document.addEventListener('mousedown', e => { if (e.target.closest('.mounted-device') && !e.target.closest('button,.port')) e.stopPropagation(); }, true);
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest('.mounted-device');
      if (e.button !== 0 || !el || e.target.closest('button,.port-icon,.port,[data-port-id]')) return;
      selected = el.id; sync();
      const found = selection(), slot = el.closest('.rack-slot');
      if (!found || !slot) return;
      drag = {el, y: e.clientY, delta: 0, top: found.device.topU, rackId: found.rack.id, step: slot.getBoundingClientRect().height, active: false};
      e.stopPropagation();
    }, true);
    document.addEventListener('pointermove', e => {
      if (!drag) return;
      drag.delta = e.clientY - drag.y;
      if (Math.abs(drag.delta) > 5) drag.active = true;
      if (!drag.active) return;
      e.preventDefault();
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (drag) { drag.el.classList.add('studio-dragging'); drag.el.style.transform = `translateY(${Math.round(drag.delta / drag.step) * 32}px)`; } });
    }, {passive: false});
    function endDrag(e) {
      if (!drag) return;
      const finished = drag; drag = null; cancelAnimationFrame(frame); frame = 0;
      finished.el.style.transform = ''; finished.el.classList.remove('studio-dragging');
      if (finished.active && e.type !== 'pointercancel') {
        try { move(finished.top - Math.round(finished.delta / finished.step), finished.rackId); }
        catch (error) { status(error.message, true); }
      }
    }
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    document.addEventListener('click', e => {
      if (e.target.closest('.studio-editor')) return;
      if (e.target.closest('button,.port,.rack-tab') || (e.target.closest('.rack-slot') && !e.target.closest('.mounted-device'))) scheduleRecord();
    }, true);
    document.addEventListener('change', e => { if (!e.target.closest('.studio-editor')) scheduleRecord(); }, true);
    document.addEventListener('drop', scheduleRecord, true);
    document.addEventListener('rackstudio:change', scheduleRecord);
    document.addEventListener('rackstudio:refresh', () => { sync(); scheduleRecord(); });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { record(); save(); } });
    last = snapshot(); sync();
    (async () => {
      try {
        const db = await database;
        const stored = db ? await databaseAction(db, 'readonly') : null;
        let legacy = null;
        if (!stored) { try { legacy = localStorage.getItem(KEY); } catch (_) { /* May be disabled while IDB is available. */ } }
        const saved = stored || legacy;
        // Never replace edits made while the database was opening.
        if (saved && revision === 0) { restore(saved); status('Son yerel proje geri yüklendi'); }
        recoveryPending = false;
        if (legacy || revision > 0) await save();
        bar.dataset.ready = 'true';
      } catch (error) {
        recoveryPending = false; bar.dataset.ready = 'true';
        status('Yerel proje yüklenemedi: ' + error.message, true);
      }
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
