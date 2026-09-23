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
    bar.innerHTML = `<label title="Kabin Toplam Yüksekliği (U)">U <input id="studio-height" type="number" min="1" max="60" value="42"></label><button data-command="resize">Uygula</button><span class="studio-divider"></span><span id="studio-selection">Cihaz seçin</span><label title="Cihaz Üst U Pozisyonu">Poz <input id="studio-position" type="number" min="1" max="60"></label><select id="studio-target" aria-label="Hedef kabin"></select><button data-command="move">Taşı</button><button data-command="duplicate">Çoğalt</button><button data-command="delete">Sil</button><span class="studio-divider"></span><button data-command="undo" title="Geri al (Ctrl+Z)">↩️</button><button data-command="redo" title="Yinele (Ctrl+Shift+Z)">↪️</button><span id="studio-save" role="status" aria-live="polite"></span>`;
    document.body.appendChild(bar);
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
    const snapshot = () => JSON.stringify({
      racks: state.racks,
      cables: state.cables,
      rackCounter: state.rackCounter,
      cableCounter: state.cableCounter,
      customCatalog: state.customCatalog || {},
      activeRackId: state.activeRackId,
      viewMode: state.viewMode || 'single',
      cableRoutingMode: state.cableRoutingMode || 'structured'
    });
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
      if (typeof renderMultiSelectPill === 'function') renderMultiSelectPill();
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
        try { localStorage.setItem('cisco-rack-studio-project', value); } catch (_) {}
        if (savedRevision === revision) status(db ? 'Yerel kayıt tamam' : 'Yerel kayıt tamam (sınırlı depolama)');
      }
      catch (_) { status('Yerel kayıt başarısız — JSON dışa aktarın', true); }
    }
    function record() {
      queued = false;
      if (restoring) return;
      const next = snapshot();
      if (last && next !== last) {
        undo.push(last);
        redo = [];
        capHistory();
        last = next;
        revision++;
        status('Kaydediliyor…');
        try { localStorage.setItem(KEY, next); localStorage.setItem('cisco-rack-studio-project', next); } catch (_) {}
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 350);
        sync();
      }
      else if (!last) { last = next; sync(); }
    }
    function scheduleRecord() { if (!queued && !restoring) { queued = true; queueMicrotask(record); } }
    function restore(value) {
      restoring = true;
      try {
        const data = JSON.parse(value);
        if (data.cableRoutingMode) state.cableRoutingMode = data.cableRoutingMode;
        if (data.viewMode && api.setViewMode) {
          api.setViewMode(data.viewMode, true);
        }
        api.loadCustomTopology(data);
        last = snapshot();
        selected = null;
        revision++;
      }
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
    let multiselectPill = document.getElementById('studio-multiselect-pill');
    if (!multiselectPill) {
      multiselectPill = document.createElement('div');
      multiselectPill.id = 'studio-multiselect-pill';
      multiselectPill.className = 'studio-multiselect-pill hidden';
      document.body.appendChild(multiselectPill);
      multiselectPill.addEventListener('click', e => {
        const btn = e.target.closest('[data-multi-action]');
        if (!btn) return;
        const action = btn.dataset.multiAction;
        if (action === 'up') moveMultiSelectedBlock(1, api.getActiveRack()?.id);
        else if (action === 'down') moveMultiSelectedBlock(-1, api.getActiveRack()?.id);
        else if (action === 'delete') deleteMultiSelectedBlock();
        else if (action === 'deselect') {
          if (state.multiSelectedDevices) state.multiSelectedDevices.clear();
          sync();
          status('Seçim temizlendi');
        } else if (action === 'clear') {
          clearMultiSelect();
          status('Çoklu seçim modu kapatıldı');
        }
      });
    }

    function renderMultiSelectPill() {
      if (!multiselectPill) return;
      const count = state.multiSelectedDevices ? state.multiSelectedDevices.size : 0;
      const isMultiActive = (count > 1) || (count > 0 && state.multiSelectMode) || !!state.multiSelectMode;
      document.body.classList.toggle('multi-select-active', isMultiActive);
      const stage = api.dom?.rackStage || document.getElementById('rack-stage');
      if (stage) stage.classList.toggle('multi-select-active', isMultiActive);

      if (count > 1 || (count > 0 && state.multiSelectMode)) {
        multiselectPill.classList.remove('hidden');
        multiselectPill.innerHTML = `
          <span class="pill-badge">🟣 Çoklu Seçim</span>
          <span class="pill-count"><strong>${count}</strong> cihaz seçildi</span>
          <button class="pill-btn" data-multi-action="up" title="Tümünü 1U Yukarı Taşı">⬆️ +1U</button>
          <button class="pill-btn" data-multi-action="down" title="Tümünü 1U Aşağı Taşı">⬇️ -1U</button>
          <button class="pill-btn pill-btn-danger" data-multi-action="delete" title="Seçilen Cihazları Sil">🗑️ Sil</button>
          <button class="pill-btn" data-multi-action="deselect" title="Seçimleri Temizle">⤹ Seçimi Temizle</button>
          <button class="pill-btn pill-btn-close" data-multi-action="clear" title="Çoklu Seçimden Çık">✕ Vazgeç / Kapat</button>
        `;
      } else if (count === 0 && state.multiSelectMode) {
        multiselectPill.classList.remove('hidden');
        multiselectPill.innerHTML = `
          <span class="pill-badge">🟣 Çoklu Seçim Modu</span>
          <span class="pill-count" style="color: #cbd5e1;">Seçmek için cihazlara dokunun</span>
          <button class="pill-btn pill-btn-close" data-multi-action="clear" title="Çoklu Seçimden Çık">✕ Vazgeç / Kapat</button>
        `;
      } else {
        multiselectPill.classList.add('hidden');
      }
      document.querySelectorAll('.mounted-device').forEach(el => {
        el.classList.toggle('studio-multi-selected', (state.multiSelectedDevices?.has(el.id) && (count > 1 || state.multiSelectMode)) || false);
      });
    }

    function toggleMultiSelect(instanceId) {
      if (!state.multiSelectedDevices) state.multiSelectedDevices = new Set();
      if (state.multiSelectedDevices.has(instanceId)) {
        state.multiSelectedDevices.delete(instanceId);
        if (selected === instanceId) {
          selected = state.multiSelectedDevices.size > 0 ? Array.from(state.multiSelectedDevices)[0] : null;
        }
      } else {
        state.multiSelectedDevices.add(instanceId);
        selected = instanceId;
      }
      sync();
    }

    function clearMultiSelect() {
      if (state.multiSelectedDevices) state.multiSelectedDevices.clear();
      state.multiSelectMode = false;
      document.body.classList.remove('multi-select-active');
      const stage = api.dom?.rackStage || document.getElementById('rack-stage');
      if (stage) stage.classList.remove('multi-select-active');
      sync();
    }

    function deleteMultiSelectedBlock() {
      if (!state.multiSelectedDevices || state.multiSelectedDevices.size === 0) return;
      const toDelete = new Set(state.multiSelectedDevices);
      const count = toDelete.size;
      state.racks.forEach(rack => {
        rack.devices = rack.devices.filter(d => !toDelete.has(d.instanceId));
        rebuild(rack);
      });
      state.cables = state.cables.filter(c => !toDelete.has(c.from.instanceId) && !toDelete.has(c.to.instanceId));
      clearMultiSelect();
      selected = null;
      state.pendingConnection = null;
      api.refresh();
      record();
      status(`${count} cihaz silindi`);
    }

    function moveMultiSelectedBlock(deltaU, rackId) {
      if (!deltaU || !state.multiSelectedDevices || state.multiSelectedDevices.size === 0) return;
      const targetRack = state.racks.find(r => r.id === rackId) || api.getActiveRack();
      if (!targetRack) return;

      const devices = targetRack.devices.filter(d => state.multiSelectedDevices.has(d.instanceId));
      if (devices.length === 0) return;

      const maxU = targetRack.heightU || 42;
      for (const d of devices) {
        const nextTop = d.topU + deltaU;
        const nextBot = nextTop - d.uHeight + 1;
        if (nextTop > maxU || nextBot < 1) {
          throw new Error('Cihaz bloğu kabin sınırlarını aşıyor (1–' + maxU + ' U).');
        }
      }

      const unselected = targetRack.devices.filter(d => !state.multiSelectedDevices.has(d.instanceId));
      const hasDirectCollision = devices.some(d => {
        const nextTop = d.topU + deltaU;
        const nextBot = nextTop - d.uHeight + 1;
        return unselected.some(u => nextTop >= (u.topU - u.uHeight + 1) && nextBot <= u.topU);
      });

      if (hasDirectCollision) {
        if (deltaU < 0) {
          const sorted = [...unselected].sort((a, b) => b.topU - a.topU);
          const lowestSelected = Math.min(...devices.map(d => d.topU + deltaU - d.uHeight + 1));
          const collidingUnselected = sorted.filter(u => u.topU >= lowestSelected);
          for (const u of collidingUnselected) {
            u.topU += deltaU;
            if (u.topU - u.uHeight + 1 < 1) throw new Error('Cihaz bloğu kaydırılamıyor: kabin altında boş yer yok.');
          }
        } else {
          const sorted = [...unselected].sort((a, b) => a.topU - b.topU);
          const highestSelected = Math.max(...devices.map(d => d.topU + deltaU));
          const collidingUnselected = sorted.filter(u => (u.topU - u.uHeight + 1) <= highestSelected);
          for (const u of collidingUnselected) {
            u.topU += deltaU;
            if (u.topU > maxU) throw new Error('Cihaz bloğu kaydırılamıyor: kabin üstünde boş yer yok.');
          }
        }
      }

      devices.forEach(d => { d.topU += deltaU; });
      rebuild(targetRack);
      api.refresh();
      record();
      sync();
      status(`${devices.length} cihaz ${deltaU > 0 ? '+' + deltaU : deltaU} U kaydırıldı`);
    }

    function insertUSpace(rackId, atU, count = 1) {
      const rack = state.racks.find(r => r.id === rackId) || api.getActiveRack();
      if (!rack) return false;
      const maxU = rack.heightU || 42;

      const devicesBelow = rack.devices.filter(d => d.topU <= atU);
      const devicesAbove = rack.devices.filter(d => d.topU > atU);

      const canShiftDown = devicesBelow.length > 0 && devicesBelow.every(d => (d.topU - count - d.uHeight + 1) >= 1);
      const canShiftUp = devicesAbove.length > 0 && devicesAbove.every(d => (d.topU + count) <= maxU);

      if (canShiftDown) {
        devicesBelow.forEach(d => { d.topU -= count; });
      } else if (canShiftUp) {
        devicesAbove.forEach(d => { d.topU += count; });
      } else {
        status('Kabin sınırları nedeniyle araya boşluk açılamıyor', true);
        return false;
      }

      rebuild(rack);
      api.refresh();
      record();
      status(`U ${atU} arasına ${count}U boşluk açıldı`);
      return true;
    }

    function collapseUSpace(rackId, atU, count = 1) {
      const rack = state.racks.find(r => r.id === rackId) || api.getActiveRack();
      if (!rack) return false;

      const occupied = rack.devices.some(d => atU <= d.topU && atU >= d.topU - d.uHeight + 1);
      if (occupied) {
        status(`U ${atU} dolu, önce boşaltın veya boş bir U seçin`, true);
        return false;
      }

      const devicesBelow = rack.devices.filter(d => d.topU < atU);
      if (devicesBelow.length === 0) {
        status(`U ${atU} altında kaydırılacak cihaz bulunamadı`, true);
        return false;
      }

      const maxU = rack.heightU || 42;
      const canShiftUp = devicesBelow.every(d => (d.topU + count) <= maxU);
      if (!canShiftUp) {
        status('Boşluk kapatılamıyor: cihazlar kabin sınırını aşıyor', true);
        return false;
      }

      devicesBelow.forEach(d => { d.topU += count; });
      rebuild(rack);
      api.refresh();
      record();
      status(`U ${atU} boşluğu kapatıldı`);
      return true;
    }

    function smartRippleMove(device, targetTopU, targetRack, duplicate = false) {
      if (!Number.isInteger(targetTopU)) throw new Error('Geçersiz U pozisyonu.');
      const maxU = targetRack.heightU || 42;
      const targetBotU = targetTopU - device.uHeight + 1;
      if (targetTopU > maxU || targetBotU < 1) {
        throw new Error('Yerleşim çakışıyor veya kabin sınırları dışında.');
      }

      if (canPlace(targetRack, device, targetTopU, duplicate ? null : device.instanceId)) {
        return [{ device, topU: targetTopU }];
      }

      const otherDevices = targetRack.devices.filter(d => duplicate || d.instanceId !== device.instanceId);
      const preferDown = device.topU ? (device.topU >= targetTopU) : true;

      function tryShiftDown() {
        const sorted = [...otherDevices].sort((a, b) => b.topU - a.topU);
        const moves = new Map();
        let currentBot = targetBotU;

        for (const d of sorted) {
          const curTop = moves.has(d.instanceId) ? moves.get(d.instanceId) : d.topU;
          const curBot = curTop - d.uHeight + 1;
          if (curTop >= currentBot && curBot <= targetTopU) {
            const newTop = currentBot - 1;
            const newBot = newTop - d.uHeight + 1;
            if (newBot < 1) return null;
            moves.set(d.instanceId, newTop);
            currentBot = newBot;
          } else if (moves.size > 0 && curTop >= currentBot) {
            const newTop = currentBot - 1;
            const newBot = newTop - d.uHeight + 1;
            if (newBot < 1) return null;
            moves.set(d.instanceId, newTop);
            currentBot = newBot;
          }
        }
        return moves;
      }

      function tryShiftUp() {
        const sorted = [...otherDevices].sort((a, b) => a.topU - b.topU);
        const moves = new Map();
        let currentTop = targetTopU;

        for (const d of sorted) {
          const curTop = moves.has(d.instanceId) ? moves.get(d.instanceId) : d.topU;
          const curBot = curTop - d.uHeight + 1;
          if (curTop >= targetBotU && curBot <= currentTop) {
            const newBot = currentTop + 1;
            const newTop = newBot + d.uHeight - 1;
            if (newTop > maxU) return null;
            moves.set(d.instanceId, newTop);
            currentTop = newTop;
          } else if (moves.size > 0 && curBot <= currentTop) {
            const newBot = currentTop + 1;
            const newTop = newBot + d.uHeight - 1;
            if (newTop > maxU) return null;
            moves.set(d.instanceId, newTop);
            currentTop = newTop;
          }
        }
        return moves;
      }

      let rippleMoves = preferDown ? (tryShiftDown() || tryShiftUp()) : (tryShiftUp() || tryShiftDown());
      if (!rippleMoves) {
        throw new Error('Yerleşim çakışıyor veya kabin sınırları dışında.');
      }

      const result = [{ device, topU: targetTopU }];
      rippleMoves.forEach((newTop, instanceId) => {
        const d = targetRack.devices.find(item => item.instanceId === instanceId);
        if (d) result.push({ device: d, topU: newTop });
      });
      return result;
    }

    function move(topU, rackId, duplicate = false) {
      const found = selection(), target = state.racks.find(r => r.id === rackId);
      if (!found || !target) return;
      const {rack, device} = found;
      const plannedMoves = smartRippleMove(device, topU, target, duplicate);

      if (duplicate) {
        const created = api.mountDeviceAt(device.catalogKey, topU, target.id);
        if (!created) throw new Error('Cihaz eklenemedi.');
        selected = created.instanceId;
        plannedMoves.forEach(m => {
          if (m.device.instanceId !== device.instanceId) m.device.topU = m.topU;
        });
      } else {
        if (rack.id !== target.id) {
          rack.devices = rack.devices.filter(d => d.instanceId !== device.instanceId);
          target.devices.push(device);
          for (const cable of state.cables) {
            for (const end of [cable.from, cable.to]) {
              if (end.instanceId === device.instanceId) end.rackId = target.id;
            }
          }
        }
        plannedMoves.forEach(m => {
          m.device.topU = m.topU;
        });
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
          if (state.multiSelectedDevices?.size > 1) {
            deleteMultiSelectedBlock();
          } else {
            const found = selection(); if (!found) return;
            found.rack.devices = found.rack.devices.filter(d => d.instanceId !== selected);
            state.cables = state.cables.filter(c => c.from.instanceId !== selected && c.to.instanceId !== selected);
            rebuild(found.rack); selected = null; state.pendingConnection = null; api.refresh(); record();
          }
        }
      } catch (error) { status(error.message, true); }
    }
    bar.addEventListener('click', e => { const button = e.target.closest('[data-command]'); if (button) command(button.dataset.command); });
    let justDragged = false;
    document.addEventListener('click', e => {
      if (justDragged) {
        justDragged = false;
        return;
      }
      if (e.target.closest('button,.port-icon,.port,[data-port-id],input,select,textarea,#studio-multiselect-pill,#rack-u-action-menu,.modal,.modal-card')) return;

      const device = e.target.closest('.mounted-device');
      if (device) {
        if (state.multiSelectMode || e.shiftKey) {
          toggleMultiSelect(device.id);
        } else if (selected === device.id) {
          selected = null;
          if (state.multiSelectedDevices) state.multiSelectedDevices.clear();
          sync();
        } else {
          selected = device.id;
          state.multiSelectedDevices = new Set([device.id]);
          field('target').value = api.getActiveRack().id;
          sync();
        }
        return;
      }

      // Check if clicked through canvas onto a port, button or device
      const hasCoords = (e.clientX != null && e.clientY != null && (e.clientX !== 0 || e.clientY !== 0));
      const elUnder = (hasCoords && typeof document !== 'undefined' && typeof document.elementFromPoint === 'function')
        ? document.elementFromPoint(e.clientX, e.clientY)
        : null;
      if (elUnder?.closest('button,.port-icon,.port,[data-port-id],input,select,textarea,#studio-multiselect-pill,#rack-u-action-menu,.modal,.modal-card')) return;
      if (hasCoords && (window.RackStudio?.hitDevicePortAt?.(e.clientX, e.clientY) || (window.RackStudio?.lastHandledPixiPortTime && Date.now() - window.RackStudio.lastHandledPixiPortTime < 350))) return;

      const deviceUnder = elUnder?.closest('.mounted-device');
      if (deviceUnder) {
        if (state.multiSelectMode || e.shiftKey) {
          toggleMultiSelect(deviceUnder.id);
        } else if (selected === deviceUnder.id) {
          selected = null;
          if (state.multiSelectedDevices) state.multiSelectedDevices.clear();
          sync();
        } else {
          selected = deviceUnder.id;
          state.multiSelectedDevices = new Set([deviceUnder.id]);
          field('target').value = api.getActiveRack().id;
          sync();
        }
        return;
      }

      // Clicked outside any device: clear selection & multi-select mode
      if (selected || (state.multiSelectedDevices && state.multiSelectedDevices.size > 0) || state.multiSelectMode) {
        clearMultiSelect();
        selected = null;
        sync();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'Escape') {
        if (selected || state.multiSelectMode || (state.multiSelectedDevices && state.multiSelectedDevices.size > 0)) {
          e.preventDefault();
          clearMultiSelect();
          selected = null;
          sync();
          status('Seçim iptal edildi');
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); command(e.shiftKey ? 'redo' : 'undo'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); command('redo'); }
      else if (selected && ['Delete','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Delete') {
          if (state.multiSelectedDevices?.size > 1) {
            deleteMultiSelectedBlock();
          } else {
            command('delete');
          }
        } else {
          const delta = e.key === 'ArrowUp' ? 1 : -1;
          if (state.multiSelectedDevices?.size > 1) {
            moveMultiSelectedBlock(delta, api.getActiveRack()?.id);
          } else {
            const found = selection();
            if (found) { field('position').value = found.device.topU + delta; field('target').value = found.rack.id; command('move'); }
          }
        }
      }
    });
    let drag = null, frame = 0, longPressTimer = null, pendingTouch = null;
    document.addEventListener('mousedown', e => {
      const dev = e.target.closest('.mounted-device');
      const isHandle = !!e.target.closest('[data-drag-handle="true"]');
      if (isHandle || (dev && state.multiSelectedDevices?.has(dev.id)) || api.isDraggingDevice) {
        e.stopPropagation();
      }
    }, true);
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest('.mounted-device');
      if (e.button !== 0 || !el || e.target.closest('button,.port-icon,.port,[data-port-id]')) return;
      const isDragHandle = !!e.target.closest('[data-drag-handle="true"]');
      const slot = el.closest('.rack-slot');
      if (!slot) return;

      // When dragging via ear handle, prioritize dragging over selection toggle
      if (isDragHandle) {
        let found = selection();
        if (!found || found.device.instanceId !== el.id) {
          for (const rack of state.racks) {
            const device = rack.devices.find(d => d.instanceId === el.id);
            if (device) { found = {rack, device}; break; }
          }
        }
        if (!found) return;
        drag = {el, y: e.clientY, x: e.clientX, delta: 0, top: found.device.topU, rackId: found.rack.id, step: slot.getBoundingClientRect().height, active: false, isHandle: true};
        e.stopPropagation();
        return;
      }

      // If in multiSelectMode or Shift key: toggle selection on faceplate
      if (state.multiSelectMode || e.shiftKey) {
        toggleMultiSelect(el.id);
        e.stopPropagation();
        return;
      }

      // If device is already part of a multi-selection block
      const isAlreadyMultiSelected = state.multiSelectedDevices?.has(el.id) && state.multiSelectedDevices.size > 1;
      let found = selection();
      if (!found || found.device.instanceId !== el.id) {
        for (const rack of state.racks) {
          const device = rack.devices.find(d => d.instanceId === el.id);
          if (device) { found = {rack, device}; break; }
        }
      }
      if (!found) return;

      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        pendingTouch = {el, x: e.clientX, y: e.clientY, top: found.device.topU, rackId: found.rack.id, step: slot.getBoundingClientRect().height};
        longPressTimer = setTimeout(() => {
          if (!pendingTouch) return;
          try { navigator.vibrate?.(45); } catch (_) {}
          pendingTouch.el.classList.add('studio-lifted');
          drag = {el: pendingTouch.el, y: pendingTouch.y, x: pendingTouch.x, delta: 0, top: pendingTouch.top, rackId: pendingTouch.rackId, step: pendingTouch.step, active: true, isLifted: true};
          pendingTouch = null;
          api.isDraggingDevice = true;
          api.dom?.rackStage?.classList.add('device-dragging-active');
          if (api.ZOOM_STATE) api.ZOOM_STATE.isPanning = false;
        }, 320);
      } else {
        drag = {el, y: e.clientY, x: e.clientX, delta: 0, top: found.device.topU, rackId: found.rack.id, step: slot.getBoundingClientRect().height, active: false};
        if (isAlreadyMultiSelected) {
          api.isDraggingDevice = true;
          api.dom?.rackStage?.classList.add('device-dragging-active');
          if (api.ZOOM_STATE) api.ZOOM_STATE.isPanning = false;
          e.stopPropagation();
        }
      }
    }, true);
    document.addEventListener('pointermove', e => {
      if (pendingTouch) {
        const dist = Math.hypot(e.clientX - pendingTouch.x, e.clientY - pendingTouch.y);
        if (dist > 8) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          pendingTouch = null;
        }
      }
      if (!drag) return;
      drag.delta = e.clientY - drag.y;
      if (Math.abs(drag.delta) > 4) {
        if (!drag.active) {
          selected = drag.el.id;
          if (!state.multiSelectedDevices?.has(drag.el.id)) {
            state.multiSelectedDevices = new Set([drag.el.id]);
          }
          sync();
        }
        drag.active = true;
        api.isDraggingDevice = true;
        api.dom?.rackStage?.classList.add('device-dragging-active');
        if (api.ZOOM_STATE) api.ZOOM_STATE.isPanning = false;
      }
      if (!drag.active) return;
      e.preventDefault();
      e.stopPropagation();
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag) {
          drag.el.classList.add('studio-dragging');
          const stepOffset = Math.round(drag.delta / drag.step) * 32;
          drag.el.style.transform = `translateY(${stepOffset}px)`;
          if (state.multiSelectedDevices?.has(drag.el.id) && state.multiSelectedDevices.size > 1) {
            state.multiSelectedDevices.forEach(id => {
              if (id !== drag.el.id) {
                const other = document.getElementById(id);
                if (other) {
                  other.classList.add('studio-dragging');
                  other.style.transform = `translateY(${stepOffset}px)`;
                }
              }
              api.movePixiDeviceByOffset?.(id, 0, stepOffset);
            });
          } else {
            api.movePixiDeviceByOffset?.(drag.el.id, 0, stepOffset);
          }
          if (api.STATE?.cableRenderMode === 'pixi' && typeof api.renderAllCablesPixi === 'function') {
            api.renderAllCablesPixi();
          }
        }
      });
    }, {passive: false});
    function endDrag(e) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      pendingTouch = null;
      api.isDraggingDevice = false;
      api.dom?.rackStage?.classList.remove('device-dragging-active');
      if (!drag) return;
      const finished = drag; drag = null; cancelAnimationFrame(frame); frame = 0;
      finished.el.style.transform = '';
      finished.el.classList.remove('studio-dragging', 'studio-lifted');
      if (typeof api.resetPixiDevicePositions === 'function') {
        api.resetPixiDevicePositions();
      }
      if (state.multiSelectedDevices?.size > 1) {
        state.multiSelectedDevices.forEach(id => {
          const other = document.getElementById(id);
          if (other) {
            other.style.transform = '';
            other.classList.remove('studio-dragging', 'studio-lifted');
          }
        });
      }
      if (finished.active) {
        justDragged = true;
        setTimeout(() => { justDragged = false; }, 80);
      }
      if (finished.active && e.type !== 'pointercancel') {
        const deltaU = -Math.round(finished.delta / finished.step);
        if (deltaU !== 0) {
          try {
            if (state.multiSelectedDevices?.has(finished.el.id) && state.multiSelectedDevices.size > 1) {
              moveMultiSelectedBlock(deltaU, finished.rackId);
            } else {
              move(finished.top + deltaU, finished.rackId);
            }
          }
          catch (error) { status(error.message, true); }
        }
      }
      if (api.PixiContext?.deviceSceneContainer && api.STATE?.cableRenderMode === 'pixi') {
        api.PixiContext.deviceSceneContainer.visible = true;
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

    api.insertUSpace = insertUSpace;
    api.collapseUSpace = collapseUSpace;
    api.smartRippleMove = smartRippleMove;
    api.moveMultiSelectedBlock = moveMultiSelectedBlock;
    api.deleteMultiSelectedBlock = deleteMultiSelectedBlock;
    api.setMultiSelectMode = (enabled) => {
      state.multiSelectMode = !!enabled;
      renderMultiSelectPill();
    };
    api.clearMultiSelect = clearMultiSelect;
    api.toggleMultiSelect = toggleMultiSelect;
    const handleImmediateChange = (e) => {
      if (e?.detail?.immediate) { record(); save(); }
      else scheduleRecord();
    };
    document.addEventListener('rackstudio:change', handleImmediateChange);
    document.addEventListener('rackstudio:refresh', () => { sync(); scheduleRecord(); });
    window.addEventListener('rackstudio:change', handleImmediateChange);
    window.addEventListener('rackstudio:refresh', () => { sync(); scheduleRecord(); });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', () => { if (last) { try { localStorage.setItem(KEY, last); } catch (_) {} save(); } });
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
        if (saved && revision === 0) {
          restore(saved);
          status('Son yerel proje geri yüklendi');
        }
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
