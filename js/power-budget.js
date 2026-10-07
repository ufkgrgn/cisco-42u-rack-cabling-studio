(function () {
  'use strict';
  const R = window.RackStudio, finite = R.EngineeringCompatibility.finite, sourceOK = R.CatalogSources.validSource;
  const status = (sum, capacity, unknown) => capacity !== null && sum > capacity ? 'blocked' : unknown || capacity === null ? 'unknown' : 'allowed';
  function build(doc) {
    const catalog = R.CatalogSources.map(doc), devices = doc.topology.racks.flatMap(r => r.devices), poe = [], loads = [], feeds = [], supplies = [], consumersSeen = new Set(), consumerCounts = new Map();
    for (const cable of doc.topology.cables) for (const [local,remote] of [[cable.from,cable.to],[cable.to,cable.from]]) {
      const device = devices.find(d => d.instanceId === local.instanceId), spec = catalog[device?.catalogKey]?.engineering?.poe;
      if (spec?.ports?.includes(local.portId)) consumerCounts.set(remote.instanceId,(consumerCounts.get(remote.instanceId) || 0) + 1);
    }
    for (const device of devices) {
      const model = catalog[device.catalogKey], spec = model?.engineering?.poe;
      if (spec) {
        const capacity = sourceOK(spec.source) && finite(spec.budgetWatts) ? spec.budgetWatts : null;
        const perPort = sourceOK(spec.source) && finite(spec.perPortWatts) ? spec.perPortWatts : null;
        const ports = [];
        for (const cable of doc.topology.cables) {
          const local = [cable.from,cable.to].find(e => e.instanceId === device.instanceId && spec.ports?.includes(e.portId));
          if (!local) continue;
          const remote = local === cable.from ? cable.to : cable.from;
          const demand = device.portsConfig?.[local.portId]?.poeDemand;
          const watts = sourceOK(demand?.source) && finite(demand?.watts) ? demand.watts : null;
          const duplicate = consumersSeen.has(remote.instanceId); consumersSeen.add(remote.instanceId);
          const ambiguous = consumerCounts.get(remote.instanceId) > 1;
          ports.push({ portId: local.portId, cableId: cable.id, consumerId: remote.instanceId, watts, source: demand?.source || null, duplicate, status: watts !== null && perPort !== null && watts > perPort ? 'blocked' : ambiguous || watts === null || perPort === null ? 'unknown' : 'allowed' });
        }
        const knownWatts = ports.filter(p => !p.duplicate).reduce((sum,p) => sum + (p.watts ?? 0),0), unknown = ports.filter(p => p.status === 'unknown').length;
        poe.push({ deviceId: device.instanceId, capacityWatts: capacity, perPortWatts: perPort, knownWatts, unknown, ports, source: spec.source, status: ports.some(p => p.status === 'blocked') ? 'blocked' : status(knownWatts,capacity,unknown) });
      }
      const plan = device.powerPlan || {}, consumption = plan.consumption;
      const slots = new Set(); for (const psu of device.psus || []) {
        if (slots.has(psu.slotId)) continue; slots.add(psu.slotId);
        const capacityWatts = sourceOK(psu.source) && finite(psu.capacityWatts) ? psu.capacityWatts : null;
        supplies.push({deviceId:device.instanceId,slotId:psu.slotId,model:psu.model,capacityWatts,source:psu.source || null,status:capacityWatts === null ? 'unknown':'declared'});
      }
      const kind = ['planned','typical','nameplate'].includes(consumption?.kind) ? consumption.kind : 'unknown';
      const watts = kind !== 'unknown' && sourceOK(consumption?.source) && finite(consumption?.watts) ? consumption.watts : null;
      loads.push({ deviceId: device.instanceId, kind, watts, source: consumption?.source || null });
      const seen = new Set();
      for (const feed of plan.feeds || []) {
        const key = feed.group + ':' + feed.pduDeviceId; if (seen.has(key)) continue; seen.add(key);
        const pdu = devices.find(d => d.instanceId === feed.pduDeviceId), power = catalog[pdu?.catalogKey]?.engineering?.power;
        const cable = doc.topology.cables.find(c => c.id === feed.cableId), isPower = end => catalog[devices.find(d => d.instanceId === end.instanceId)?.catalogKey]?.ports?.find(p => p.id === end.portId)?.type === 'power';
        const linked = !!cable && [cable.from,cable.to].every(isPower) && [cable.from,cable.to].some(e => e.instanceId === device.instanceId) && [cable.from,cable.to].some(e => e.instanceId === feed.pduDeviceId) && (!feed.psuSlotId || supplies.some(s => s.deviceId === device.instanceId && s.slotId === feed.psuSlotId && s.capacityWatts !== null));
        const capacityWatts = sourceOK(power?.source) && finite(power?.capacityWatts) ? power.capacityWatts : null;
        feeds.push({ deviceId: device.instanceId, pduDeviceId: feed.pduDeviceId, group: ['A','B'].includes(feed.group) ? feed.group : 'unknown', kind, watts, capacityWatts, linked, source: power?.source || null });
      }
    }
    const groups = [];
    for (const key of new Set(feeds.map(f => f.group + ':' + f.pduDeviceId + ':' + f.kind))) {
      const items = feeds.filter(f => f.group + ':' + f.pduDeviceId + ':' + f.kind === key), capacity = items[0].capacityWatts;
      const mixed = new Set(feeds.filter(f => f.group === items[0].group && f.pduDeviceId === items[0].pduDeviceId).map(f => f.kind)).size > 1;
      const knownWatts = items.reduce((sum,f) => sum + (f.watts ?? 0),0), unknown = items.filter(f => f.watts === null || !f.linked || f.group === 'unknown' || mixed).length;
      groups.push({ key, group: items[0].group, pduDeviceId: items[0].pduDeviceId, kind: items[0].kind, knownWatts, unknown, capacityWatts: capacity, status: status(knownWatts,capacity,unknown), source: items[0].source });
    }
    const totals = ['planned','typical','nameplate','unknown'].map(kind => ({ kind, knownWatts: loads.filter(l => l.kind === kind).reduce((n,l) => n + (l.watts ?? 0),0), unknown: loads.filter(l => l.kind === kind && l.watts === null).length }));
    return { poe, loads, feeds, supplies, groups, totals, notes: ['Eksik tüketim sıfır değildir.', 'Planlanan, tipik ve etiket güçleri ayrı toplamlanır; karışık PDU bütçesi bilinmiyor kalır.', 'A/B grupları tam yükle ayrı değerlendirilir; genel toplam cihaz başına bir kez sayılır.', 'PSU kapasitesi tüketim veya PoE bütçesine otomatik eklenmez.'] };
  }
  R.PowerBudget = Object.freeze({ build });
})();
