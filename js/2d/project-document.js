(function () {
  'use strict';
  const RS = window.RackStudio = window.RackStudio || {};
  const collections = ['locations', 'observations', 'fieldEvents', 'evidenceRefs', 'handoverRecords', 'integrationMappings'];
  const legacyKeys = new Set(['version', 'timestamp', 'racks', 'devices', 'cables', 'customCatalog', 'portGeometryOverrides', 'activeRackId', 'viewMode', 'cableRoutingMode', 'rackCounter', 'cableCounter', 'heightU']);
  const MAX_BYTES = 32 * 1024 * 1024;
  function byteLength(text) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length * 3; }
  function copy(value) {
    let nodes = 0;
    const seen = new WeakSet();
    function inspect(item, depth) {
      if (++nodes > 1000000 || depth > 64) throw new Error('Proje veri derinliği veya alan sınırı aşıldı.');
      if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Geçersiz sayısal proje değeri.');
      if (!item || typeof item !== 'object') return;
      if (seen.has(item)) throw new Error('Döngülü proje verisi.');
      seen.add(item);
      for (const [key, child] of Object.entries(item)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Güvensiz proje alanı.');
        inspect(child, depth + 1);
      }
      seen.delete(item);
    }
    inspect(value, 0);
    const json = JSON.stringify(value);
    if (!json || byteLength(json) > MAX_BYTES) throw new Error('Proje verisi çok büyük veya geçersiz.');
    return JSON.parse(json, (key, item) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Güvensiz proje alanı.');
      return item;
    });
  }
  function normalize(input) {
    const data = copy(input);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Geçersiz proje.');
    if (data.schemaVersion !== undefined) {
      if (data.schemaVersion !== 1) throw new Error('Desteklenmeyen proje sürümü. Orijinal dosyayı saklayın.');
      if (typeof data.projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(data.projectId)) throw new Error('Geçersiz proje kimliği.');
      if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('Geçersiz proje revizyonu.');
      if (!data.topology || typeof data.topology !== 'object' || Array.isArray(data.topology)) throw new Error('Geçersiz proje topolojisi.');
      for (const key of collections) if (!Array.isArray(data[key])) throw new Error('Geçersiz proje koleksiyonu: ' + key);
      for (const key of ['metadata', 'catalogContext', 'extensions']) if (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key])) throw new Error('Geçersiz proje alanı: ' + key);
      return RS.ProjectRecords.validate(data);
    }
    if (data.version !== undefined && !['3.0.0', '4.0-studio'].includes(data.version)) throw new Error('Desteklenmeyen eski proje sürümü. Orijinal dosyayı saklayın.');
    const extensions = {};
    for (const [key, value] of Object.entries(data)) if (!legacyKeys.has(key)) extensions[key] = value;
    const document = {
      schemaVersion: 1,
      projectId: window.crypto?.randomUUID?.() || 'project-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      revision: 0,
      metadata: { name: 'Adsız proje', migratedFrom: data.version || 'legacy' },
      topology: !Array.isArray(data.racks) && Array.isArray(data.devices)
        ? { ...data, racks: [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: data.heightU || 42, devices: data.devices }] }
        : data,
      catalogContext: {},
      extensions
    };
    for (const key of collections) document[key] = [];
    for (const rack of document.topology.racks || []) for (const device of rack.devices || []) {
      if (device.observed && typeof device.observed === 'object') document.observations.push({
        id: 'legacy-observation-' + (document.observations.length + 1),
        entityRef: { kind: 'device', id: device.instanceId },
        source: { system: 'legacy', label: device.observed.source || 'legacy' },
        raw: copy(device.observed)
      });
    }
    return RS.ProjectRecords.validate(document);
  }
  function capture(state) {
    if (!state.projectDocument) state.projectDocument = normalize({ racks: state.racks, cables: state.cables });
    const document = copy(state.projectDocument);
    document.topology = {
      ...document.topology,
      racks: copy(state.racks), cables: copy(state.cables),
      customCatalog: copy(state.customCatalog || {}),
      portGeometryOverrides: copy(RS.exportPortGeometryOverrides?.() || {}),
      activeRackId: state.activeRackId,
      viewMode: state.viewMode || 'single',
      cableRoutingMode: state.cableRoutingMode || 'structured'
    };
    return normalize(document);
  }
  function parse(text) {
    if (typeof text !== 'string' || byteLength(text) > MAX_BYTES) throw new Error('Proje JSON dosyası 32 MB sınırını aşıyor.');
    return normalize(JSON.parse(text));
  }
  RS.ProjectDocument = Object.freeze({ normalize, capture, parse, MAX_BYTES });
})();
