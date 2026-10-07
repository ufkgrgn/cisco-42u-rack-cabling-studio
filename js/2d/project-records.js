(function () {
  'use strict';
  const RS = window.RackStudio = window.RackStudio || {};
  const collections = ['locations', 'observations', 'fieldEvents', 'evidenceRefs', 'handoverRecords', 'integrationMappings'];
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function fail(message) { throw new Error('Geçersiz proje kaydı: ' + message); }
  function text(value, name, limit = 2000) {
    if (value !== undefined && (typeof value !== 'string' || value.length > limit)) fail(name);
  }
  function timestamp(value, name) {
    if (value !== undefined && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) fail(name);
  }
  function reference(value, name) {
    if (value !== undefined && (!object(value) || !['device', 'cable', 'rack', 'location', 'project'].includes(value.kind) || !id(value.id))) fail(name);
  }
  function validate(document) {
    const metadata = document.metadata;
    for (const key of ['name', 'customer', 'owner', 'status']) text(metadata[key], 'metadata.' + key);
    for (const key of ['createdAt', 'updatedAt']) timestamp(metadata[key], 'metadata.' + key);
    const idsByCollection = new Map();
    for (const name of collections) {
      const rows = document[name];
      if (!Array.isArray(rows) || rows.length > 50000) fail(name + ' koleksiyon sınırı');
      const ids = new Set();
      for (const row of rows) {
        if (!object(row) || !id(row.id) || ids.has(row.id)) fail(name + ' kimliği');
        ids.add(row.id);
        if (row.projectId !== undefined && row.projectId !== document.projectId) fail(name + ' proje sınırı');
        text(row.note, name + '.note', 64000);
        text(row.name, name + '.name');
        for (const key of ['recordedAt', 'collectedAt', 'createdAt']) timestamp(row[key], name + '.' + key);
        reference(row.entityRef, name + '.entityRef');
      }
      idsByCollection.set(name, ids);
    }
    const locations = new Map(document.locations.map(row => [row.id, row]));
    if (metadata.targetDate !== undefined && metadata.targetDate !== '' && (typeof metadata.targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.targetDate) || !Number.isFinite(Date.parse(metadata.targetDate)) || new Date(metadata.targetDate).toISOString().slice(0, 10) !== metadata.targetDate)) fail('metadata.targetDate');
    const kinds = ['site', 'building', 'floor', 'room'];
    for (const row of document.locations) {
      if (row.kind !== undefined && !kinds.includes(row.kind)) fail('location.kind');
      if (row.parentId !== undefined && row.parentId !== null) {
        const parent = locations.get(row.parentId);
        if (!parent || parent.id === row.id) fail('location.parentId');
        if (row.kind && parent.kind && kinds.indexOf(parent.kind) >= kinds.indexOf(row.kind)) fail('location hiyerarşisi');
      }
      const seen = new Set([row.id]);
      let parent = locations.get(row.parentId);
      while (parent) {
        if (seen.has(parent.id) || seen.size > 64) fail('location döngüsü veya derinlik sınırı');
        seen.add(parent.id);
        parent = locations.get(parent.parentId);
      }
    }
    const evidenceIds = idsByCollection.get('evidenceRefs');
    for (const rack of document.topology.racks || []) {
      if (rack.locationId !== undefined && rack.locationId !== null) {
        const room = locations.get(rack.locationId);
        if (!room || (room.kind !== undefined && room.kind !== 'room')) fail('rack.locationId');
      }
    }
    for (const row of document.fieldEvents) {
      text(row.kind, 'fieldEvent.kind');
      if(row.fieldEventVersion!==undefined){
        if(row.fieldEventVersion!==1||!['installed','labeled','test'].includes(row.kind)||!['unknown','pass','fail','partial','not-tested'].includes(row.result)||!row.entityRef||!['device','cable'].includes(row.entityRef.kind)||!row.recordedAt||!row.receivedAt||!object(row.scope)||typeof row.technician!=='string'||!row.technician.trim()||row.technician.length>200||!Array.isArray(row.evidenceIds))fail('fieldEvent version/scope/technician');
        timestamp(row.receivedAt,'fieldEvent.receivedAt');
        text(row.technician,'fieldEvent.technician',200);text(row.reason,'fieldEvent.reason',2000);
        if(row.parentEventId){const parent=document.fieldEvents.find(e=>e.id===row.parentEventId);if(!parent||parent===row||document.fieldEvents.indexOf(parent)>=document.fieldEvents.indexOf(row)||parent.kind!==row.kind||parent.entityRef?.id!==row.entityRef.id||parent.entityRef?.kind!==row.entityRef.kind||!row.reason?.trim())fail('fieldEvent correction');}
        if(row.kind==='test'&&row.result==='pass'&&!row.evidenceIds.length)fail('fieldEvent successful test evidence');
      }
      if (row.result !== undefined && !['unknown', 'pass', 'fail', 'partial', 'not-tested'].includes(row.result)) fail('fieldEvent.result');
      if (row.expectedRevision !== undefined && (!Number.isSafeInteger(row.expectedRevision) || row.expectedRevision < 0 || row.expectedRevision > document.revision)) fail('fieldEvent.expectedRevision');
      if (row.evidenceIds !== undefined && (!Array.isArray(row.evidenceIds) || new Set(row.evidenceIds).size !== row.evidenceIds.length || row.evidenceIds.some(key => !evidenceIds.has(key)))) fail('fieldEvent.evidenceIds');
    }
    for (const row of document.observations) {
      timestamp(row.receivedAt,'observation.receivedAt');
      if(row.observationVersion!==undefined){
        if(row.observationVersion!==1 || typeof row.contentHash!=='string' || !/^[a-f0-9]{64}$/.test(row.contentHash) || !row.receivedAt)fail('observation version/hash/time');
        if(!object(row.raw)||!object(row.normalized)||!object(row.source)||typeof row.source.system!=='string')fail('observation raw/normalized/source');
        if(row.source.system==='file'&&(typeof row.source.filename!=='string'||typeof row.source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.source.sha256)))fail('observation file provenance');
        if(!object(row.subject)||!['device','port','cable'].includes(row.subject.kind)||(row.subject.kind==='port'&&(typeof row.subject.portId!=='string'||!row.subject.portId||row.subject.portId.length>200)))fail('observation.subject');
        if(!object(row.mapping)||!['matched','ambiguous','unmatched'].includes(row.mapping.status)||!Array.isArray(row.mapping.candidateIds)||row.mapping.candidateIds.length>50000||row.mapping.candidateIds.some(key=>!id(key)))fail('observation.mapping');
        if((row.mapping.status==='matched')!==!!row.entityRef || (row.entityRef&&row.entityRef.kind!==(row.subject.kind==='cable'?'cable':'device')))fail('observation entity/mapping');
        if(row.parentObservationId!==undefined&&!id(row.parentObservationId))fail('observation.parent');
      }
      if (row.source !== undefined && typeof row.source !== 'string' && !object(row.source)) fail('observation.source');
      if (row.raw !== undefined && !object(row.raw)) fail('observation.raw');
      if (row.normalized !== undefined && !object(row.normalized)) fail('observation.normalized');
    }
    for (const row of document.evidenceRefs) {
      text(row.filename, 'evidence.filename');
      if (row.blobId !== undefined && !id(row.blobId)) fail('evidence.blobId');
      if (row.bytes !== undefined && (!Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > 20 * 1024 * 1024)) fail('evidence.bytes');
      if (row.mime !== undefined && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json'].includes(row.mime)) fail('evidence.mime');
      if (row.sha256 !== undefined && (typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(row.sha256))) fail('evidence.sha256');
    }
    for (const row of document.handoverRecords) {
      if (row.revision !== undefined && (!Number.isSafeInteger(row.revision) || row.revision < 0 || row.revision > document.revision)) fail('handover.revision');
      text(row.status, 'handover.status');
    }
    const externalKeys = new Set();
    for (const row of document.integrationMappings) {
      for (const key of ['sourceSystem', 'sourceInstance', 'externalId']) text(row[key], 'integration.' + key);
      reference(row.entityRef, 'integration.entityRef');
      if (row.sourceSystem && row.sourceInstance && row.externalId) {
        const key = JSON.stringify([row.sourceSystem, row.sourceInstance, row.externalId]);
        if (externalKeys.has(key)) fail('integration tekrar eden dış kimlik');
        externalKeys.add(key);
      }
    }
    return document;
  }
  RS.ProjectRecords = Object.freeze({ validate, collections });
})();
