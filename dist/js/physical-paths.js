(function () {
  'use strict';
  const R = window.RackStudio, key = e => [e.rackId,e.instanceId,e.portId].join('/');
  function trace(doc, cableId) {
    const catalog = R.CatalogSources.map(doc), visited = new Set(), cables = new Set(), terminals = new Set(), unknown = [];
    const initial = doc.topology.cables.find(c => c.id === cableId);
    if (!initial) return { cableIds: [], terminalIds: [], status:'unknown', unknown:['Başlangıç kablosu bulunamadı.'] };
    const queue = [initial.from,initial.to]; cables.add(initial.id);
    while (queue.length) {
      const end = queue.shift(), identity = key(end); if (visited.has(identity)) continue; visited.add(identity);
      const device = doc.topology.racks.find(r => r.id === end.rackId)?.devices.find(d => d.instanceId === end.instanceId), model = catalog[device?.catalogKey];
      if (!device || !model) { unknown.push('Uç tanımı eksik: ' + identity); continue; }
      const passive = model.engineering?.passive === true || ['patch','patch-panel','fiber'].includes(model.category);
      if (!passive) { terminals.add(device.instanceId); continue; }
      const pairs = (device.passThroughPairs || []).filter(p => [p.a ?? p.from,p.b ?? p.to].includes(end.portId));
      if (pairs.length !== 1) { unknown.push('Pasif iç eşleme eksik veya belirsiz: ' + identity); continue; }
      const pair = pairs[0], a = pair.a ?? pair.from, b = pair.b ?? pair.to, peer = a === end.portId ? b : a;
      if (!model.ports.some(p => p.id === peer)) { unknown.push('Pasif iç eşleme portu eksik: ' + peer); continue; }
      const next = doc.topology.cables.filter(c => [c.from,c.to].some(e => e.instanceId === device.instanceId && e.portId === peer));
      if (next.length !== 1) { unknown.push('Pasif çıkış bağlantısı eksik veya belirsiz: ' + peer); continue; }
      const cable = next[0]; if (cables.has(cable.id)) { unknown.push('Pasif yolda döngü algılandı.'); continue; } cables.add(cable.id);
      queue.push(cable.from.instanceId === device.instanceId && cable.from.portId === peer ? cable.to : cable.from);
    }
    return { cableIds:[...cables].sort(), terminalIds:[...terminals].sort(), status: unknown.length ? 'unknown' : 'known', unknown:[...new Set(unknown)] };
  }
  function impact(before,after) {
    const changed = [];
    for (const cable of before.topology.cables) {
      const prior = trace(before,cable.id), next = trace(after,cable.id);
      if (JSON.stringify(prior) !== JSON.stringify(next)) changed.push({ cableId:cable.id, before:prior, after:next });
    }
    return { paths:changed, scope:'Yalnızca belgelenmiş fiziksel bağlantılar ve pasif iç eşlemeler; canlı servis/iletişim etkisi ölçülmedi.' };
  }
  R.PhysicalPaths = Object.freeze({ trace,impact });
})();
