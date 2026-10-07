(function () {
  'use strict';
  const R = window.RackStudio;
  function basis(doc) {
    const catalog = R.CatalogSources.map(doc), used = [...new Set(doc.topology.racks.flatMap(r => r.devices.map(d => d.catalogKey)))].sort();
    return R.ProjectCommands.domainKey(doc) + JSON.stringify(used.map(k => [k,catalog[k]])) + JSON.stringify([doc.catalogContext.transceivers || {},R.CatalogSourcePack.transceivers]);
  }
  function collect(doc) {
    const analysisBasis = basis(doc), result = [], catalog = R.CatalogSources.map(doc);
    function add(code, id, status, text, source, fixCandidates = []) {
      const kind = code.startsWith('cable') ? 'cable' : 'device';
      result.push({ issueId: code + ':' + id, code, severity: status === 'blocked' ? 'error' : 'unknown', status, text, affectedEntity: { kind, id }, target: kind === 'cable' ? { cableId: id } : { deviceId: id }, source: source || null, basis:analysisBasis, fixCandidates });
    }
    for (const rack of doc.topology.racks) for (const d of rack.devices) {
      const model = catalog[d.catalogKey];
      if (!doc.catalogContext.models?.[d.catalogKey]?.definition) add('catalog-unpinned',d.instanceId,'unknown','Model sürümü proje içine sabitlenmedi.',model?.provenance?.source,[{ type:'pinCatalog',label:'Kullanılan modelleri sabitle' }]);
      if (!R.CatalogSources.validSource(model?.provenance?.source)) add('catalog-source',d.instanceId,'unknown','Modelin teknik kaynağı bilinmiyor.',null);
      if (model?.provenance?.physicalVerification !== 'verified') add('catalog-geometry',d.instanceId,'unknown','Fiziksel port yerleşimi üretici doğrulaması bekliyor; yerel kalibrasyon ayrı tutulur.',model?.provenance?.source);
      for (const [portId, config] of Object.entries(d.portsConfig || {})) if (config.transceiver) {
        const assessment = R.EngineeringCompatibility.endpoint(doc,{rackId:rack.id,instanceId:d.instanceId,portId},catalog);
        if (assessment.errors.length || assessment.unknown.length) add('port-module-' + portId,d.instanceId,assessment.errors.length ? 'blocked' : 'unknown',[...assessment.errors,...assessment.unknown].join(' '),assessment.module?.source || assessment.source);
      }
    }
    for (const cable of doc.topology.cables) {
      const assessment = R.EngineeringCompatibility.assess(doc,cable,catalog);
      if (assessment.status !== 'allowed') add('cable-compatibility',cable.id,assessment.status,[...assessment.errors,...assessment.unknown].join(' '),assessment.sources,assessment.status === 'blocked' ? [{ type:'removeCable',id:cable.id,label:'Bağlantıyı kaldır' }] : []);
    }
    const power = R.PowerBudget.build(doc);
    for (const item of power.loads) if (item.watts === null) add('power-consumption',item.deviceId,'unknown','Kaynaklı cihaz tüketimi bilinmiyor; sıfır sayılmadı.',item.source);
    for (const item of power.supplies) if (item.capacityWatts === null) add('power-psu-' + item.slotId,item.deviceId,'unknown','PSU kapasitesi veya kaynağı bilinmiyor.',item.source);
    for (const item of power.poe) if (item.status !== 'allowed') add('poe-budget',item.deviceId,item.status,'PoE: ' + item.knownWatts + ' W bilinen talep; ' + item.unknown + ' bilinmeyen/tekrarlı talep; kapasite ' + (item.capacityWatts ?? 'bilinmiyor') + ' W.',item.source);
    for (const item of power.groups) if (item.status !== 'allowed') add('power-feed-' + item.key,item.pduDeviceId,item.status,'Güç ' + item.group + ' / ' + item.kind + ': ' + item.knownWatts + ' W; kablolama veya kapasite belirsizliği ' + item.unknown + '.',item.source);
    return result;
  }
  R.EngineeringIssues = Object.freeze({ collect,basis });
})();
