(function () {
  'use strict';
  const R = window.RackStudio, clone = value => JSON.parse(JSON.stringify(value));
  const available = { ...clone(R.HARDWARE_CATALOG), ...clone(R.CatalogSourcePack.models) };
  for (const model of window.CISCO_MASTER_CATALOG || []) if (!available[model.id]) available[model.id] = clone(model);
  for (const [key, model] of Object.entries(R.CatalogSourcePack.models)) { R.HARDWARE_CATALOG[key] = clone(model); R.BUILTIN_KEYS.add(key); }
  function validSource(value) { return !!(value && typeof value.title === 'string' && value.title.trim() && typeof value.checkedAt === 'string' && Number.isFinite(Date.parse(value.checkedAt)) && (value.kind === 'manufacturer' ? /^https:\/\//.test(value.url || '') : ['user', 'measurement'].includes(value.kind) && typeof value.reference === 'string' && value.reference.trim())); }
  function validate(model) {
    if (!model || !Number.isInteger(model.u) || model.u < 1 || model.u > 60 || typeof model.name !== 'string' || !Array.isArray(model.ports)) throw new Error('Katalog modeli geçersiz.');
    if (model.ports.length > 4096) throw new Error('Katalog port sınırı aşıldı.');
    const ids = new Set(); for (const p of model.ports) {
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(p.id || '') || ids.has(p.id)) throw new Error('Katalog port kimliği geçersiz.'); ids.add(p.id);
      const e = p.engineering;
      if (e?.speedsMbps != null && (!Array.isArray(e.speedsMbps) || e.speedsMbps.some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0))) throw new Error('Port hız profili geçersiz.');
      if (e?.media != null && (!Array.isArray(e.media) || e.media.some(v => typeof v !== 'string'))) throw new Error('Port ortam profili geçersiz.');
    }
    return clone(model);
  }
  function definitions(doc) {
    for (const rack of doc.topology.racks || []) for (const device of rack.devices || []) {
      if (device.portsConfig != null && (Array.isArray(device.portsConfig) || typeof device.portsConfig !== 'object')) throw new Error('Port ayarları nesne olmalı.');
      if (device.modules != null && (!Array.isArray(device.modules) || device.modules.some(m => !m || typeof m.slotId !== 'string' || typeof m.model !== 'string'))) throw new Error('Takılı modül listesi geçersiz.');
      if (device.psus != null && (!Array.isArray(device.psus) || device.psus.some(m => !m || typeof m.slotId !== 'string' || typeof m.model !== 'string' || m.capacityWatts != null && (typeof m.capacityWatts !== 'number' || !Number.isFinite(m.capacityWatts) || m.capacityWatts < 0)))) throw new Error('PSU listesi geçersiz.');
      const power = device.powerPlan;
      if (power != null && (Array.isArray(power) || typeof power !== 'object')) throw new Error('Güç planı nesne olmalı.');
      if (power?.feeds != null && (!Array.isArray(power.feeds) || power.feeds.some(f => !f || !['A','B'].includes(f.group) || typeof f.pduDeviceId !== 'string'))) throw new Error('Güç besleme listesi geçersiz.');
      for (const demand of [power?.consumption,...Object.values(device.portsConfig || {}).map(p => p?.poeDemand)]) if (demand?.watts != null && (typeof demand.watts !== 'number' || !Number.isFinite(demand.watts) || demand.watts < 0)) throw new Error('Güç talebi negatif veya geçersiz.');
    }
    const rows = doc.catalogContext?.models || {}, result = {};
    for (const [key, row] of Object.entries(rows)) if (row?.definition) {
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(key) || ['constructor','prototype','__proto__'].includes(key)) throw new Error('Sabit model anahtarı geçersiz.');
      result[key] = validate(row.definition);
    }
    return result;
  }
  function map(doc) {
    const catalog = { ...available, ...doc.topology.customCatalog, ...definitions(doc) };
    for (const [alias,key] of Object.entries(R.CATALOG_ALIAS_MAP || {})) if (!catalog[alias] && catalog[key]) catalog[alias] = catalog[key];
    return catalog;
  }
  function pin(doc, sourcedOnly = false) {
    const copy = R.ProjectDocument.normalize(doc), catalog = map(copy);
    for (const key of new Set(copy.topology.racks.flatMap(r => r.devices.map(d => d.catalogKey)))) {
      if (copy.catalogContext.models?.[key]?.definition) continue;
      const item = catalog[key];
      if (sourcedOnly && !validSource(item?.provenance?.source)) continue;
      const model = validate(item);
      copy.catalogContext.models ||= {};
      copy.catalogContext.models[key] = { ...copy.catalogContext.models[key], modelVersion: model.modelVersion || 'legacy-unverified', source: model.provenance?.source || null, definition: model };
    }
    return copy;
  }
  function restoreBase() { for (const [key, model] of Object.entries(available)) if (R.BUILTIN_KEYS.has(key)) R.HARDWARE_CATALOG[key] = clone(model); }
  function preview(doc, key, candidate) {
    const next = pin(doc); if (!next.catalogContext.models[key]) throw new Error('Model projede kullanılmıyor.');
    next.catalogContext.models[key] = { modelVersion: candidate.modelVersion || 'unverified', source: candidate.provenance?.source || null, definition: validate(candidate) };
    return next;
  }
  function register(key, model) { if (!/^[a-zA-Z0-9_-]{1,160}$/.test(key) || ['constructor','prototype','__proto__'].includes(key)) throw new Error('Model anahtarı geçersiz.'); available[key] = validate(model); R.BUILTIN_KEYS.add(key); document.dispatchEvent(new CustomEvent('rackstudio:catalog-source-change')); }
  R.CatalogSources = Object.freeze({ get available() { return clone(available); }, validSource, validate, definitions, map, pin, preview, register, restoreBase });
})();
