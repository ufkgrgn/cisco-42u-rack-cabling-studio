// @ts-check
(function () {
  'use strict';
  /** @typedef {import('./types/product').ProjectDocument} ProjectDocument */
  /** @typedef {import('./types/product').ProjectCommand} ProjectCommand */
  // The classic-script host remains an explicit compatibility boundary.
  const RS = /** @type {any} */ (window).RackStudio;
  const LEDGER = 'rackStudioCommandReceipts';
  let applying = false;
  /** @param {unknown} value @returns {string} */
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') {
      const object = /** @type {Record<string, unknown>} */ (value);
      return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + stable(object[key])).join(',') + '}';
    }
    return JSON.stringify(value) ?? 'null';
  }
  /** @param {ProjectDocument} doc */
  function semanticDocument(doc) {
    const copy = RS.ProjectDocument.normalize(doc);
    delete copy.revision;
    delete copy.topology.activeRackId;
    delete copy.topology.viewMode;
    delete copy.topology.doorOpen;
    copy.topology.customCatalog ??= {};
    copy.topology.portGeometryOverrides ??= {};
    copy.topology.cableRoutingMode ??= 'structured';
    for (const rack of copy.topology.racks) {
      delete rack.units;
      for (const device of rack.devices) {
        delete device.rackId;
        device.hostname ??= device.name ?? '';
        for (const key of ['ipAddress', 'macAddress', 'serialNumber', 'panelLabel', 'assetTag']) device[key] ??= '';
        device.observed ??= null;
        device.passThroughPairs ??= [];
        device.portsConfig ??= {};
      }
    }
    for (const rack of copy.topology.racks) for (const device of rack.devices) device.face ??= 'front';
    for (const cable of copy.topology.cables) {
      cable.ductSide ??= 'auto';
      for (const key of ['name', 'note', 'role', 'medium']) cable[key] ??= '';
      cable.from.face ??= 'front'; cable.to.face ??= 'front';
    }
    // Receipt retention belongs to the command infrastructure, not undoable content.
    delete copy.extensions[LEDGER];
    return copy;
  }
  /** @param {ProjectDocument} doc */
  function domainKey(doc) { return stable(semanticDocument(doc)); }
  function begin() {
    RS.flushProjectChanges?.();
    const doc = RS.ProjectDocument.capture(RS.STATE);
    return { commandId: window.crypto.randomUUID(), projectId: doc.projectId, expectedRevision: doc.revision, expectedContent: domainKey(doc) };
  }
  /** @param {ProjectDocument} doc @returns {import('./types/product').CommandReceipt[]} */
  function receipts(doc) {
    const value = doc.extensions[LEDGER];
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 10000 || new Set(value.map(r => r?.commandId)).size !== value.length || value.some(r => !r || typeof r.commandId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(r.commandId) || typeof r.fingerprint !== 'string' || !Number.isSafeInteger(r.revision) || r.revision < 0 || r.revision > doc.revision)) {
      throw new Error('Komut kayıt alanı geçersiz; proje değiştirilmedi.');
    }
    return value;
  }
  /** @param {ProjectCommand} input */
  function execute(input) {
    if (applying) throw new Error('Başka bir komut uygulanıyor.');
    // Normalize first: bounds, cycles, unsafe keys and non-finite numbers are checked before mutation.
    const current = /** @type {ProjectDocument} */ (RS.ProjectDocument.capture(RS.STATE));
    const envelope = RS.ProjectDocument.normalize({ ...current, extensions: { command: input } }).extensions.command;
    const command = /** @type {ProjectCommand} */ (envelope);
    if (!command || typeof command.commandId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(command.commandId) || command.projectId !== current.projectId) throw new Error('Geçersiz komut veya proje kimliği.');
    const fingerprint = stable({ commandId: command.commandId, projectId: command.projectId, expectedRevision: command.expectedRevision, type: command.type, payload: command.payload });
    const ledger = receipts(current);
    const previous = ledger.find(r => r.commandId === command.commandId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('Komut kimliği farklı içerikle tekrar kullanılamaz.');
      const committed = RS.saveProjectNow?.();
      committed?.catch(() => {});
      return { commandId: command.commandId, revision: previous.revision, duplicate: true, status: 'localDraft', committed };
    }
    // Rejecting a command must not itself flush, mutate or save a legacy draft.
    if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== current.revision) throw new Error('Proje revizyonu değişti; işlemi güncel proje üzerinden tekrarlayın.');
    if (typeof command.expectedContent !== 'string' || command.expectedContent !== domainKey(current)) throw new Error('Proje içeriği değişti; işlemi güncel proje üzerinden tekrarlayın.');
    if (ledger.length === 10000) throw new Error('Komut kayıt sınırı doldu; proje arşivlenmeli.');
    if (!Number.isSafeInteger(current.revision + 1)) throw new Error('Proje revizyon sınırı aşıldı.');
    let draft = /** @type {ProjectDocument} */ (RS.ProjectDocument.normalize(current));
    const topology = draft.topology;
    if (command.type === 'MoveDevice') {
      const { deviceId, targetRackId, moves } = command.payload;
      const source = topology.racks.find(r => r.devices.some(d => d.instanceId === deviceId));
      const target = topology.racks.find(r => r.id === targetRackId);
      const device = source?.devices.find(d => d.instanceId === deviceId);
      if (!source || !target || !device || !Array.isArray(moves) || !moves.length || new Set(moves.map(m => m.deviceId)).size !== moves.length || !moves.some(m => m.deviceId === deviceId)) throw new Error('Geçersiz cihaz taşıma planı.');
      source.devices = source.devices.filter(d => d.instanceId !== deviceId);
      target.devices.push(device);
      for (const move of moves) {
        const item = target.devices.find(d => d.instanceId === move.deviceId);
        if (!item || !Number.isInteger(move.topU)) throw new Error('Geçersiz ardışık taşıma planı.');
        item.topU = move.topU;
      }
      for (const cable of topology.cables) for (const end of [cable.from, cable.to]) if (end.instanceId === deviceId) end.rackId = targetRackId;
      topology.activeRackId = targetRackId;
    } else if (command.type === 'ConnectCable') {
      const { cable, portConfigs = [] } = command.payload;
      if (!cable || topology.cables.some(c => c.id === cable.id)) throw new Error('Kablo kimliği zaten kullanılıyor.');
      const rules = RS.NetworkRules.validateConnection(cable.from, cable.to, topology, { ...RS.catalog, ...topology.customCatalog }, RS.STATE.strictCompliance !== false);
      if (!rules.allowed) throw new Error(rules.reason || 'Bağlantı kurallara uygun değil.');
      const endpoints = new Set([cable.from.instanceId, cable.to.instanceId]);
      if (!Array.isArray(portConfigs) || new Set(portConfigs.map(p => p.deviceId)).size !== portConfigs.length) throw new Error('Geçersiz port ayar planı.');
      for (const config of portConfigs) {
        const device = topology.racks.flatMap(r => r.devices).find(d => d.instanceId === config.deviceId);
        if (!device || !endpoints.has(config.deviceId) || !config.portsConfig || Array.isArray(config.portsConfig) || typeof config.portsConfig !== 'object') throw new Error('Geçersiz port ayar planı.');
        device.portsConfig = config.portsConfig;
      }
      topology.cables.push(cable);
    } else if(command.type==='ImportObservations'){
      RS.FieldObservations.appendToDocument(draft,command.payload.observations);
    } else if(command.type==='ApplyObservationDifferences'){
      RS.FieldObservations.applyToDocument(draft,command.payload.observationId,command.payload.fields,command.payload.allowStale);
    } else if (command.type === 'UpdateProjectDetails') {
      draft.metadata = command.payload.metadata;
      draft.locations = command.payload.locations;
      const links = command.payload.rackLocations;
      if (!Array.isArray(links) || links.length !== topology.racks.length || new Set(links.map(link => link.rackId)).size !== links.length) throw new Error('Geçersiz kabin konum planı.');
      for (const link of links) {
        const rack = topology.racks.find(item => item.id === link.rackId);
        if (!rack) throw new Error('Kabin bulunamadı.');
        rack.locationId = link.locationId;
      }
    } else if (command.type === 'RestoreProjectDocument') {
      draft = RS.ProjectDocument.normalize(command.payload.document);
      if (draft.projectId !== current.projectId) throw new Error('Başka projenin revizyonu geri yüklenemez.');
      RS.FieldEvents?.preserveHistory(draft, current);
      RS.HandoverRepository?.preserveHistory(draft, current);
      draft.revision = current.revision;
    } else if (command.type === 'ApplyEngineeringChange') {
      RS.EngineeringChanges.assertEditable();
      draft.topology = command.payload.topology;
      draft.catalogContext = command.payload.catalogContext;
      RS.EngineeringChanges.validate(current,draft,command.payload.ackUnknown);
    } else if (command.type === 'ApplyTopology') {
      const next = command.payload.topology;
      for (const cable of next.cables) {
        const old = topology.cables.find(c => c.id === cable.id);
        if (old && stable({ ...old.from, face: old.from.face ?? 'front' }) === stable({ ...cable.from, face: cable.from.face ?? 'front' })
          && stable({ ...old.to, face: old.to.face ?? 'front' }) === stable({ ...cable.to, face: cable.to.face ?? 'front' })) continue;
        const rules = RS.NetworkRules.validateConnection(cable.from, cable.to, { ...next, cables: next.cables.filter(c => c.id !== cable.id) }, { ...RS.catalog, ...next.customCatalog }, RS.STATE.strictCompliance !== false);
        if (!rules.allowed) throw new Error(rules.reason || 'Bağlantı kurallara uygun değil.');
      }
      draft.topology = next;
    } else throw new Error('Desteklenmeyen proje komutu.');
    // Whole-layout validation catches overlap, missing endpoints and occupied ports together.
    RS.validateTopology(draft);
    RS.ProjectDocument.normalize(draft);
    draft.revision++;
    draft.extensions[LEDGER] = [...ledger, { commandId: command.commandId, fingerprint, revision: draft.revision }];
    const validated = RS.ProjectDocument.normalize(draft);
    let renderingWarning = '';
    applying = true;
    try {
      RS.invalidateLayoutGeometryCache?.();
      RS.loadCustomTopology(validated, { render: false });
      // An accepted domain change must still be recorded if its visual refresh fails.
      // If 3D mode is active, the 2D view is hidden, so avoid running 2D DOM visual refresh now.
      if (!window.is3DMode) {
        try { RS.refresh(); }
        catch (error) {
          renderingWarning = error instanceof Error ? error.message : 'Görünüm yenilenemedi.';
          console.warn('Proje komutu uygulandı; görünüm yenilenemedi.', renderingWarning);
        }
      }
      document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
    } finally { applying = false; }
    const committed = RS.saveProjectNow?.();
    committed?.catch(() => {});
    return { commandId: command.commandId, revision: draft.revision, duplicate: false, status: 'localDraft', renderingWarning, committed };
  }
  RS.ProjectCommands = Object.freeze({ begin, execute, domainKey, semanticDocument, receipts, LEDGER });
})();
