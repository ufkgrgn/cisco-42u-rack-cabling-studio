(function () {
  'use strict';
  const RS = window.RackStudio;
  const groups = { locations: 'location', observations: 'observation', fieldEvents: 'fieldEvent', evidenceRefs: 'evidence', handoverRecords: 'handover', integrationMappings: 'integration' };
  const uuid = () => crypto.randomUUID();
  function duplicateDocument(input, name) {
    const doc = RS.ProjectDocument.normalize(input), sourceId = doc.projectId;
    const maps = Object.fromEntries(['project','location','rack','device','cable','observation','fieldEvent','evidence','handover','integration','blob'].map(kind => [kind, new Map()]));
    const add = (kind, id) => { if (!maps[kind].has(id)) maps[kind].set(id, uuid()); return maps[kind].get(id); };
    add('project', doc.projectId);
    for (const [key, kind] of Object.entries(groups)) for (const row of doc[key]) add(kind, row.id);
    for (const rack of doc.topology.racks) { add('rack', rack.id); for (const device of rack.devices) add('device', device.instanceId); }
    for (const cable of doc.topology.cables) add('cable', cable.id);
    for (const ref of doc.evidenceRefs) if (ref.blobId) add('blob', ref.blobId);
    const fields = { projectId: 'project', locationId: 'location', parentId: 'location', rackId: 'rack', activeRackId: 'rack', instanceId: 'device', deviceId: 'device', devId: 'device', cableId: 'cable', observationId: 'observation', fieldEventId: 'fieldEvent', evidenceId: 'evidence', blobId: 'blob', handoverId: 'handover', parentHandoverId: 'handover', integrationId: 'integration' };
    const arrays = { rackIds: 'rack', deviceIds: 'device', cableIds: 'cable', evidenceIds: 'evidence', observationIds: 'observation', fieldEventIds: 'fieldEvent' };
    function remap(value) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(remap); return; }
      if (value.entityRef && maps[value.entityRef.kind]) value.entityRef.id = maps[value.entityRef.kind].get(value.entityRef.id) || value.entityRef.id;
      for (const [key, child] of Object.entries(value)) {
        // Observation/provenance payloads remain the original external evidence.
        if (['raw', 'observed', 'native3DImport', 'handoverManifest'].includes(key)) continue;
        if (fields[key] && typeof child === 'string') value[key] = maps[fields[key]].get(child) || child;
        else if (arrays[key] && Array.isArray(child)) value[key] = child.map(id => maps[arrays[key]].get(id) || id);
        else remap(child);
      }
    }
    remap(doc);
    for(const row of doc.fieldEvents)if(row.parentEventId)row.parentEventId=maps.fieldEvent.get(row.parentEventId)||row.parentEventId;
    for(const row of doc.observations){
      if(row.parentObservationId)row.parentObservationId=maps.observation.get(row.parentObservationId)||row.parentObservationId;
      if(row.mapping?.candidateIds){const targets=row.subject?.kind==='cable'?maps.cable:maps.device;row.mapping.candidateIds=row.mapping.candidateIds.map(id=>targets.get(id)||id);}
    }
    for (const [key, kind] of Object.entries(groups)) for (const row of doc[key]) row.id = maps[kind].get(row.id);
    for (const rack of doc.topology.racks) rack.id = maps.rack.get(rack.id);
    for (const cable of doc.topology.cables) cable.id = maps.cable.get(cable.id);
    for (const record of doc.handoverRecords) if (record.namedRevisionId || record.parentHandoverId) record.sourceProjectId = sourceId;
    delete doc.extensions[RS.ProjectCommands.LEDGER];
    doc.metadata = { ...doc.metadata, name: name?.trim() || (doc.metadata.name || 'Adsız proje') + ' — kopya', sourceProjectId: sourceId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return { document: RS.ProjectRepository.validate(doc), maps };
  }
  function prepare() {
    if (window.is3DMode && !window.__STUDIO3D__.state.autoSave()) throw new Error(window.__STUDIO3D__.state.lastSaveError);
    return RS.ProjectCommands.begin();
  }
  async function create(name, customer = '') {
    if (!name?.trim()) throw new Error('Proje adı gerekli.');
    const expected = prepare(), now = new Date().toISOString();
    const doc = RS.ProjectDocument.normalize({ racks: [{ id: uuid(), name: 'Kabin 1', heightU: 42, devices: [] }], cables: [] });
    doc.metadata = { name: name.trim(), customer: customer.trim(), status: 'draft', createdAt: now, updatedAt: now };
    const result = await RS.importProjectDocument(doc, expected);
    if (window.is3DMode) window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    return result;
  }
  async function duplicate(projectId, name) {
    const expected = prepare();
    await RS.saveProjectNow();
    const source = await RS.ProjectRepository.snapshotProject(projectId);
    const copy = duplicateDocument(source.document, name);
    const evidence = [];
    for (const [oldId, newId] of copy.maps.blob) {
      const item = source.evidence.find(row => row.id === oldId);
      if (!item) throw new Error('Proje eki yerel depoda eksik; eksik kopya oluşturulmadı.');
      evidence.push({ id: newId, blob: item.blob });
    }
    const result = await RS.importProjectDocument(copy.document, expected, { evidence });
    if (window.is3DMode) window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    return result;
  }
  function updateDetails(expected, metadata, locations, rackLocations) {
    const result = RS.ProjectCommands.execute({ ...expected, type: 'UpdateProjectDetails', payload: {
      metadata: { ...metadata, updatedAt: new Date().toISOString() }, locations, rackLocations
    } });
    if (window.is3DMode) window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    return result;
  }
  RS.ProjectManagement = Object.freeze({ create, duplicate, duplicateDocument, prepare, updateDetails });
})();
