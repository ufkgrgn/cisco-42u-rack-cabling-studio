/* Cable circuit tracing through explicitly documented passive-panel links. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  if (!RS) return;
  let dialog;
  let selectedCableId = '';

  const endpointKey = endpoint => `${endpoint?.instanceId || ''}:${endpoint?.portId || ''}`;
  function devices() {
    return new Map((RS.STATE.racks || []).flatMap(rack => (rack.devices || []).map(device => [device.instanceId, { device, rack }])));
  }
  function isPassive(device) {
    const cat = RS.HARDWARE_CATALOG?.[device?.catalogKey] || RS.catalog?.[device?.catalogKey];
    return ['patch', 'patch-panel', 'fiber'].includes(cat?.category) || RS.NetworkRules?.isPassivePatchPanel?.(cat, device?.catalogKey) === true;
  }
  function trace(cableId) {
    const cables = RS.STATE.cables || [];
    const selected = cables.find(cable => cable.id === cableId);
    if (!selected) return { hops: [], stops: ['Kablo bulunamadı.'] };
    const deviceMap = devices();
    const byEndpoint = new Map();
    cables.forEach(cable => [cable.from, cable.to].forEach(endpoint => byEndpoint.set(endpointKey(endpoint), cable)));
    const visited = new Set([selected.id]);
    function extend(endpoint) {
      const hops = [];
      const stops = [];
      let current = endpoint;
      while (current) {
        const entry = deviceMap.get(current.instanceId);
        if (!entry) { stops.push('Uç cihaz bulunamadı.'); break; }
        if (!isPassive(entry.device)) break;
        const pair = (entry.device.passThroughPairs || []).find(link => link.a === current.portId || link.b === current.portId);
        if (!pair) { stops.push(`${entry.device.name || entry.device.catalogKey} / ${current.portId}: panel iç geçişi tanımlı değil.`); break; }
        const otherPort = pair.a === current.portId ? pair.b : pair.a;
        hops.push({ type: 'panel', device: entry.device, a: current.portId, b: otherPort });
        const nextCable = byEndpoint.get(`${current.instanceId}:${otherPort}`);
        if (!nextCable) { stops.push(`${entry.device.name || entry.device.catalogKey} / ${otherPort}: devam eden kablo yok.`); break; }
        if (visited.has(nextCable.id)) { stops.push('Devre döngüsü algılandı.'); break; }
        visited.add(nextCable.id);
        hops.push({ type: 'cable', cable: nextCable });
        current = endpointKey(nextCable.from) === `${current.instanceId}:${otherPort}` ? nextCable.to : nextCable.from;
      }
      return { hops, stops };
    }
    const left = extend(selected.from);
    const right = extend(selected.to);
    return { hops: [...left.hops.reverse(), { type: 'cable', cable: selected }, ...right.hops], stops: [...left.stops, ...right.stops] };
  }

  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'circuit-trace-dialog';
    dialog.className = 'circuit-trace-dialog';
    dialog.setAttribute('aria-label', 'Devre izi');
    dialog.innerHTML = `<div class="circuit-trace-head"><h2>Devre izi</h2><button type="button" data-trace-action="close">Kapat</button></div>
      <label>Kablo <select id="trace-cable"></select></label><div class="circuit-trace-hops"></div>
      <h3>Panel iç geçişi</h3><p>İki farklı port arasındaki fiziksel çapraz bağlantıyı yalnızca doğruladığınızda kaydedin.</p>
      <label>Panel <select id="trace-panel"></select></label><div class="circuit-trace-pair"><label>Port A <select id="trace-port-a"></select></label><label>Port B <select id="trace-port-b"></select></label><button type="button" data-trace-action="add">Eşle</button></div><div class="circuit-trace-pairs"></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      const action = event.target.closest('[data-trace-action]')?.dataset.traceAction;
      if (action === 'close') dialog.close();
      if (action === 'add') addPair();
      if (action === 'remove') removePair(event.target.closest('[data-trace-action]').dataset.index);
    });
    dialog.querySelector('#trace-cable').addEventListener('change', event => { selectedCableId = event.target.value; renderHops(); });
    dialog.querySelector('#trace-panel').addEventListener('change', renderPairs);
  }

  function option(value, label) {
    const item = document.createElement('option');
    item.value = value;
    item.textContent = label;
    return item;
  }
  function selectedPanel() {
    return devices().get(dialog.querySelector('#trace-panel').value)?.device;
  }
  function renderHops() {
    const result = trace(selectedCableId);
    const host = dialog.querySelector('.circuit-trace-hops');
    host.replaceChildren();
    const map = devices();
    for (const hop of result.hops) {
      const row = document.createElement('div');
      row.className = 'circuit-trace-hop';
      if (hop.type === 'cable') {
        const from = map.get(hop.cable.from.instanceId)?.device;
        const to = map.get(hop.cable.to.instanceId)?.device;
        row.textContent = `${hop.cable.name || hop.cable.id}: ${from?.hostname || from?.name || '?'} / ${hop.cable.from.portId} → ${to?.hostname || to?.name || '?'} / ${hop.cable.to.portId}`;
      } else row.textContent = `${hop.device.name || hop.device.catalogKey}: ${hop.a} ↔ ${hop.b} (panel iç geçiş)`;
      host.append(row);
    }
    for (const stop of result.stops) {
      const note = document.createElement('p');
      note.className = 'circuit-trace-stop'; note.textContent = stop; host.append(note);
    }
  }
  function renderPairs() {
    const panel = selectedPanel();
    const cat = panel && (RS.HARDWARE_CATALOG?.[panel.catalogKey] || RS.catalog?.[panel.catalogKey]);
    const ports = cat?.ports || [];
    for (const id of ['trace-port-a', 'trace-port-b']) dialog.querySelector(`#${id}`).replaceChildren(...ports.map(port => option(port.id, port.name || port.id)));
    if (ports.length > 1) dialog.querySelector('#trace-port-b').value = ports[1].id;
    const list = dialog.querySelector('.circuit-trace-pairs');
    list.replaceChildren();
    (panel?.passThroughPairs || []).forEach((pair, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.traceAction = 'remove'; button.dataset.index = String(index);
      button.textContent = `${pair.a} ↔ ${pair.b} · Kaldır`;
      list.append(button);
    });
  }
  function addPair() {
    const panel = selectedPanel();
    if (!panel) return;
    const a = dialog.querySelector('#trace-port-a').value;
    const b = dialog.querySelector('#trace-port-b').value;
    const used = (panel.passThroughPairs || []).some(pair => [pair.a, pair.b].includes(a) || [pair.a, pair.b].includes(b));
    if (!a || !b || a === b || used) return;
    panel.passThroughPairs ||= [];
    panel.passThroughPairs.push({ a, b });
    RS.refresh?.();
    renderPairs(); renderHops();
  }
  function removePair(index) {
    const panel = selectedPanel();
    if (!panel || !Number.isInteger(Number(index))) return;
    panel.passThroughPairs?.splice(Number(index), 1);
    RS.refresh?.();
    renderPairs(); renderHops();
  }
  function open(cableId) {
    if (window.is3DMode) {
      document.getElementById('btn-view-2d')?.click();
      requestAnimationFrame(() => open(cableId));
      return;
    }
    ensure();
    const cables = RS.STATE.cables || [];
    selectedCableId = cableId || RS.STATE.highlightedCableId || cables[0]?.id || '';
    dialog.querySelector('#trace-cable').replaceChildren(...cables.map(cable => option(cable.id, cable.name || cable.id)));
    dialog.querySelector('#trace-cable').value = selectedCableId;
    const panels = [...devices().values()].filter(entry => isPassive(entry.device));
    dialog.querySelector('#trace-panel').replaceChildren(...panels.map(entry => option(entry.device.instanceId, entry.device.name || entry.device.catalogKey)));
    renderPairs(); renderHops();
    dialog.showModal();
  }
  document.getElementById('btn-circuit-trace')?.addEventListener('click', () => open());
  RS.CircuitTrace = { trace, open };
})();
