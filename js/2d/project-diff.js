(function () {
  'use strict';
  const RS = window.RackStudio;
  const stable = value => {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  };
  function entities(input) {
    const doc = RS.ProjectCommands.semanticDocument(input), rows = new Map();
    const add = (kind, id, value, rackId = null, deviceId = null) => rows.set(JSON.stringify([kind,id]), { kind, id, value, rackId, deviceId });
    delete doc.metadata.updatedAt;
    add('project',doc.projectId,doc.metadata);
    for (const rack of doc.topology.racks) {
      const { devices, ...data } = rack; add('rack',rack.id,data,rack.id);
      for (const device of devices) {
        const { portsConfig, ...data } = device;
        add('device',device.instanceId,{ ...data, rackId: rack.id },rack.id,device.instanceId);
        for (const [portId, config] of Object.entries(portsConfig || {})) {
          add('port',JSON.stringify([device.instanceId,portId]),config,rack.id,device.instanceId);
          rows.get(JSON.stringify(['port',JSON.stringify([device.instanceId,portId])])).label = `${device.hostname || device.name || device.instanceId} / ${portId}`;
        }
      }
    }
    for (const cable of doc.topology.cables) add('cable',cable.id,cable,cable.from.rackId,cable.from.instanceId);
    for (const key of ['locations','observations','fieldEvents','evidenceRefs','handoverRecords','integrationMappings']) for (const row of doc[key]) add(key,row.id,row);
    const { racks, cables, ...settings } = doc.topology;
    add('settings','topology',settings); add('catalog','context',doc.catalogContext); add('extensions','extensions',doc.extensions);
    // Retain unknown top-level fields as meaningful extension data.
    for (const key of ['schemaVersion','projectId','revision','metadata','topology','catalogContext','extensions','locations','observations','fieldEvents','evidenceRefs','handoverRecords','integrationMappings']) delete doc[key];
    add('extensions','document',doc);
    return rows;
  }
  function fields(before, after, path = '', result = []) {
    if (stable(before) === stable(after)) return result;
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
      for (const key of [...new Set([...Object.keys(before),...Object.keys(after)])].sort()) fields(before[key],after[key],path ? path + '.' + key : key,result);
    } else result.push({ path: path || 'value', before, after });
    return result;
  }
  function compare(before, after) {
    if (before.projectId !== after.projectId) throw new Error('Fark karşılaştırması aynı proje için yapılmalı.');
    const left = entities(before), right = entities(after), changes = [];
    for (const key of [...new Set([...left.keys(),...right.keys()])].sort()) {
      const a = left.get(key), b = right.get(key), delta = fields(a?.value,b?.value);
      if (delta.length) changes.push({ ...(b || a), before: a?.value, after: b?.value, status: !a ? 'added' : !b ? 'removed' : 'changed', fields: delta });
    }
    return { changes, added: changes.filter(c => c.status === 'added').length, removed: changes.filter(c => c.status === 'removed').length, changed: changes.filter(c => c.status === 'changed').length };
  }
  RS.ProjectDiff = Object.freeze({ compare });
})();
