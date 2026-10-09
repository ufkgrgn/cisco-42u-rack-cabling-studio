/** Compact, click-based mounting and port selection over the active 2D model. */
(function () {
  'use strict';

  const RS = window.RackStudio;
  if (!RS) return;
  let dialog;
  let opener;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'mobile-workflow-dialog';
    dialog.className = 'mobile-workflow-dialog';
    dialog.setAttribute('aria-labelledby', 'mobile-workflow-title');
    dialog.innerHTML = '<div class="mobile-workflow-head"><h2 id="mobile-workflow-title"></h2><button type="button" data-close aria-label="Kapat">✕</button></div><div id="mobile-workflow-body"></div>';
    document.body.append(dialog);
    dialog.addEventListener('click', event => event.stopPropagation());
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus());
    return dialog;
  }

  function open(title, trigger) {
    ensureDialog();
    opener = trigger || document.activeElement;
    dialog.querySelector('#mobile-workflow-title').textContent = title;
    if (!dialog.open) dialog.showModal();
    return dialog.querySelector('#mobile-workflow-body');
  }

  function rackFor(instanceId) {
    return RS.STATE.racks.find(rack => rack.devices.some(device => device.instanceId === instanceId));
  }

  function openMount(catalogKey, trigger) {
    const item = RS.resolveCatalogItem?.(catalogKey) || RS.catalog?.[catalogKey];
    if (!item) return;
    const body = open('Donanım yerleştir', trigger);
    body.replaceChildren();
    const model = document.createElement('p');
    model.textContent = `${item.name || catalogKey} · ${item.u}U`;
    const rackLabel = document.createElement('label');
    rackLabel.textContent = 'Kabin';
    const rackSelect = document.createElement('select');
    rackSelect.id = 'mobile-mount-rack';
    RS.STATE.racks.forEach(rack => rackSelect.add(new Option(rack.name, rack.id)));
    rackSelect.value = RS.STATE.activeRackId || RS.STATE.racks[0]?.id;
    rackLabel.append(rackSelect);
    const slotLabel = document.createElement('label');
    slotLabel.textContent = 'U konumu';
    const slotSelect = document.createElement('select');
    slotSelect.id = 'mobile-mount-slot';
    slotLabel.append(slotSelect);
    const hint = document.createElement('p');
    hint.className = 'mobile-workflow-hint';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Yerleştir';
    function updateSlots() {
      slotSelect.replaceChildren();
      const rack = RS.STATE.racks.find(r => r.id === rackSelect.value);
      if (!rack) return;
      const height = Number(item.u) || 1;
      for (let topU = rack.heightU || 42; topU >= height; topU--) {
        const low = topU - height + 1;
        const occupied = rack.devices.some(device => topU >= device.topU - device.uHeight + 1 && low <= device.topU);
        const option = new Option(`U${topU}${height > 1 ? `–U${low}` : ''}${occupied ? ' · Dolu' : ''}`, String(topU));
        option.disabled = occupied;
        slotSelect.add(option);
      }
      const firstFree = [...slotSelect.options].find(option => !option.disabled);
      if (firstFree) slotSelect.value = firstFree.value;
      confirm.disabled = !firstFree;
      hint.textContent = firstFree ? 'Uygun konumu seçip yerleştirin.' : 'Bu kabinde uygun boş U konumu yok.';
    }
    rackSelect.addEventListener('change', updateSlots);
    confirm.addEventListener('click', () => {
      const rack = RS.STATE.racks.find(r => r.id === rackSelect.value);
      const topU = Number(slotSelect.value);
      if (!rack || !Number.isInteger(topU)) return;
      const mounted = window.mountDeviceFromAction?.(catalogKey, topU, null, rack.id);
      if (!mounted) { hint.textContent = 'Konum artık uygun değil; başka bir U seçin.'; updateSlots(); return; }
      dialog.close();
      window.setLeftSidebarCollapsed?.(true);
      RS.focusOnDevice?.(rack.devices.at(-1)?.instanceId);
    });
    body.append(model, rackLabel, slotLabel, hint, confirm);
    updateSlots();
    rackSelect.focus();
  }

  function openPorts(trigger, preferredDeviceId) {
    RS.setStudioWorkMode?.('cabling');
    const devices = RS.STATE.racks.flatMap(rack => rack.devices.map(device => ({ rack, device })));
    const body = open('Port seç', trigger);
    body.replaceChildren();
    const deviceLabel = document.createElement('label');
    deviceLabel.textContent = 'Cihaz';
    const deviceSelect = document.createElement('select');
    deviceSelect.id = 'mobile-port-device';
    devices.forEach(({ rack, device }) => {
      const catalog = RS.resolveCatalogItem?.(device.catalogKey) || RS.catalog?.[device.catalogKey];
      deviceSelect.add(new Option(`${rack.name} · U${device.topU} · ${device.hostname || device.name || catalog?.name || device.catalogKey}`, device.instanceId));
    });
    deviceSelect.value = preferredDeviceId || RS.STATE.selectedDeviceId || devices[0]?.device.instanceId || '';
    deviceLabel.append(deviceSelect);
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Port ara';
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'mobile-port-search';
    searchLabel.append(search);
    const hint = document.createElement('p');
    hint.className = 'mobile-workflow-hint';
    const portList = document.createElement('div');
    portList.className = 'mobile-port-list';
    function renderPorts() {
      portList.replaceChildren();
      const entry = devices.find(row => row.device.instanceId === deviceSelect.value);
      const catalog = entry && (RS.resolveCatalogItem?.(entry.device.catalogKey) || RS.catalog?.[entry.device.catalogKey]);
      const query = search.value.trim().toLocaleLowerCase('tr');
      const ports = (catalog?.ports || []).filter(port => `${port.name || ''} ${port.id || ''} ${port.type || ''}`.toLocaleLowerCase('tr').includes(query));
      hint.textContent = RS.STATE.pendingConnection ? 'İlk uç seçildi. İkinci cihazı ve portu seçin.' : 'Bağlantının ilk portunu seçin.';
      if (!ports.length) hint.textContent = 'Eşleşen port bulunamadı.';
      ports.forEach(port => {
        const occupied = RS.STATE.cables.some(cable => [cable.from, cable.to].some(end => end.instanceId === entry.device.instanceId && end.portId === port.id));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mobile-port-option';
        button.textContent = `${port.name || port.id} · ${(port.type || 'Port').toUpperCase()} · ${occupied ? 'Bağlı' : 'Boş'}`;
        button.addEventListener('click', () => {
          if (occupied) {
            const existing = RS.STATE.cables.find(cable => [cable.from, cable.to].some(end => end.instanceId === entry.device.instanceId && end.portId === port.id));
            dialog.close();
            RS.highlightCable?.(existing?.id, true);
            return;
          }
          const beforeCount = RS.STATE.cables.length;
          RS.dispatchPixiPortInteraction?.('click', {
            instanceId: entry.device.instanceId, portId: port.id, name: port.name, type: port.type, speed: port.speed
          }, button.getBoundingClientRect());
          if (RS.STATE.pendingConnection) { renderPorts(); deviceSelect.focus(); }
          else if (RS.STATE.cables.length > beforeCount) { dialog.close(); RS.highlightCable?.(RS.STATE.cables.at(-1)?.id, true); }
          else hint.textContent = 'Bağlantı kurulamadı. Port türlerini ve doluluk durumunu kontrol edin.';
        });
        portList.append(button);
      });
    }
    deviceSelect.addEventListener('change', renderPorts);
    search.addEventListener('input', renderPorts);
    body.append(deviceLabel, searchLabel, hint, portList);
    renderPorts();
    deviceSelect.focus();
  }

  function openSelection(trigger) {
    if(RS.WorkspaceUI){RS.WorkspaceUI.openPanel('selection',trigger);return;}
    const body = open('Seçim', trigger);
    if(RS.WorkflowSelection){RS.WorkflowSelection.render(body);return;}
    body.replaceChildren();
    const cable = RS.STATE.cables.find(item => item.id === RS.STATE.highlightedCableId);
    const device = RS.STATE.racks.flatMap(rack => rack.devices).find(item => item.instanceId === RS.STATE.selectedDeviceId);
    const summary = document.createElement('p');
    summary.textContent = cable ? `Kablo: ${cable.name || cable.id}` : device ? `Cihaz: ${device.hostname || device.name || device.catalogKey}` : 'Bir cihaz veya kablo seçin.';
    body.append(summary);
    if (cable) {
      const focusBoth = () => {
        if (cable.from?.rackId && cable.to?.rackId && cable.from.rackId !== cable.to.rackId && RS.STATE.viewMode !== 'multi') {
          RS.setViewMode?.('multi', true);
          requestAnimationFrame(() => RS.focusOnCable?.(cable.id));
        } else RS.focusOnCable?.(cable.id);
      };
      for (const [label, action] of [['Kaynağa git', () => RS.focusOnDevice?.(cable.from.instanceId)], ['Hedefe git', () => RS.focusOnDevice?.(cable.to.instanceId)], ['İki ucu göster', focusBoth]]) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.addEventListener('click', () => { dialog.close(); action(); });
        body.append(button);
      }
    }
    const ports = document.createElement('button');
    ports.type = 'button';
    ports.textContent = 'Port seçerek bağla';
    ports.addEventListener('click', () => openPorts(trigger, device?.instanceId));
    body.append(ports);
  }


  window.openMobileMountFlow = openMount;
  RS.openMobilePortPicker = openPorts;
  RS.openMobileSelection = openSelection;
})();
