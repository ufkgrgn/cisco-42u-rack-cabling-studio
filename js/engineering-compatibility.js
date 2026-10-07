(function () {
  'use strict';
  const R = window.RackStudio, finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const normalizeMedium = value => { const s = String(value || '').toUpperCase().replace(/[ -]/g, ''); return ({ CAT5E: 'Cat5e', CAT6: 'Cat6', CAT6A: 'Cat6A', OS1: 'OS1', OS2: 'OS2', OM1: 'OM1', OM2: 'OM2', OM3: 'OM3', OM4: 'OM4' })[s] || value; };
  function endpoint(doc, end, catalog = R.CatalogSources.map(doc)) {
    const rack = doc.topology.racks.find(r => r.id === end.rackId), device = rack?.devices.find(d => d.instanceId === end.instanceId), model = catalog[device?.catalogKey], port = model?.ports?.find(p => p.id === end.portId), config = device?.portsConfig?.[end.portId] || {};
    const declared = port?.engineering, source = declared?.source || model?.engineering?.source, known = R.CatalogSources.validSource(source);
    let profile = declared && known ? { ...declared } : null, module = null;
    const transceiver = config.transceiver;
    if (transceiver) module = typeof transceiver === 'string' ? doc.catalogContext?.transceivers?.[transceiver] || R.CatalogSourcePack.transceivers[transceiver] : transceiver.specification || doc.catalogContext?.transceivers?.[transceiver.model] || R.CatalogSourcePack.transceivers[transceiver.model];
    const unknown = [], errors = [];
    if (!device || !port) errors.push('Uç cihaz veya port tanımı bulunamadı.');
    if (!known || !profile) unknown.push('Kaynaklı port yetenek bilgisi yok.');
    if (transceiver && profile && !profile.cage) errors.push('Bu port takılabilir transceiver kafesi içermiyor.');
    if (profile?.cage) {
      if (!module || !R.CatalogSources.validSource(module.source)) { unknown.push('Kaynaklı transceiver seçilmemiş.'); profile = { ...profile, connector: null, media: null }; }
      else {
        if (!module.cage) unknown.push('Transceiver kafes bilgisi eksik.');
        else if (!(profile.supportedCages || [profile.cage]).includes(module.cage)) errors.push('Transceiver kafesi portla uyuşmuyor.');
        if (!Array.isArray(profile.speedsMbps) || !profile.speedsMbps.length || !Array.isArray(module.speedsMbps) || !module.speedsMbps.length) unknown.push('Port/transceiver hız bilgisi eksik.');
        else if (!profile.speedsMbps.some(v => module.speedsMbps.includes(v))) errors.push('Port/transceiver hızları uyuşmuyor.');
        const supported = model.engineering?.supportedTransceivers;
        const manufacturers = model.engineering?.supportedTransceiverManufacturers;
        if (Array.isArray(manufacturers) && module.manufacturer && !manufacturers.includes(module.manufacturer)) errors.push('Transceiver üreticisi host destek politikasıyla uyuşmuyor.');
        if (Array.isArray(manufacturers) && !module.manufacturer && !supported?.includes(module.model)) unknown.push('Transceiver üreticisi/destek politikası doğrulanmadı.');
        if (!Array.isArray(supported)) unknown.push('Üretici/host transceiver desteği doğrulanmadı.');
        else if (!supported.includes(module.model)) errors.push('Transceiver host destek listesinde yok.');
        profile = { ...profile, ...module };
      }
    }
    if (profile?.moduleSlot) {
      const slot = model.engineering?.moduleSlots?.find(s => s.id === profile.moduleSlot), installed = device.modules?.find(m => m.slotId === profile.moduleSlot);
      if (!slot || !installed) unknown.push('Modül yuvası/takılı modül belirtilmedi.');
      else if (!Array.isArray(slot.allowedModels) || !R.CatalogSources.validSource(slot.source)) unknown.push('Kaynaklı modül destek listesi eksik.');
      else if (!slot.allowedModels.includes(installed.model)) errors.push('Modül bu yuvayla uyumlu değil.');
    }
    if (profile?.comboGroup) {
      const group = model.ports.filter(p => p.engineering?.comboGroup === profile.comboGroup).map(p => p.id);
      const used = new Set(doc.topology.cables.flatMap(c => [c.from,c.to]).filter(e => e.instanceId === end.instanceId && group.includes(e.portId)).map(e => e.portId));
      if (used.size > 1) errors.push('Combo port grubunda birden fazla fiziksel arayüz kullanılıyor.');
    }
    return { device, model, port, profile, source, module, unknown, errors, known };
  }
  function assess(doc, cable, catalog) {
    const ends = [endpoint(doc,cable.from,catalog),endpoint(doc,cable.to,catalog)], errors = ends.flatMap(e => e.errors), unknown = ends.flatMap(e => e.unknown), profiles = ends.map(e => e.profile), medium = normalizeMedium(cable.medium);
    if (!medium) unknown.push('Kablo ortamı belirtilmedi.');
    if (profiles.every(Boolean)) {
      if (profiles.every(p => p.connector) && profiles[0].connector !== profiles[1].connector) errors.push('Konnektörler uyuşmuyor.');
      if (!profiles.every(p => p.connector)) unknown.push('Konnektör bilgisi eksik.');
      if (!profiles.every(p => Array.isArray(p.speedsMbps) && p.speedsMbps.length)) unknown.push('Hız bilgisi eksik.');
      else if (!profiles[0].speedsMbps.some(s => profiles[1].speedsMbps.includes(s))) errors.push('Ortak port hızı yok.');
      for (const p of profiles) if (medium && Array.isArray(p.media) && !p.media.includes(medium)) errors.push('Kablo ortamı uç profilinde desteklenmiyor.');
      if (!profiles.every(p => Array.isArray(p.media))) unknown.push('Ortam bilgisi eksik.');
      const length = cable.measuredLengthMeters ?? cable.estimatedLengthMeters;
      for (const end of ends) if (end.module?.maxDistanceMeters) {
        const limit = end.module.maxDistanceMeters[medium];
        if (!finite(limit) || !finite(length)) unknown.push('Kaynaklı mesafe sınırı veya tahmin/ölçüm eksik.');
        else if (length > limit) errors.push('Fiber mesafesi transceiver sınırını aşıyor: ' + length + ' > ' + limit + ' m.');
      }
    }
    return { status: errors.length ? 'blocked' : unknown.length ? 'unknown' : 'allowed', cableId: cable.id, errors: [...new Set(errors)], unknown: [...new Set(unknown)], sources: ends.map(e => e.module?.source || e.source).filter(Boolean), ends: ends.map(e => ({ connector: e.known ? e.profile?.connector : null, cage: e.profile?.cage, portId: e.port?.id })) };
  }
  R.EngineeringCompatibility = Object.freeze({ endpoint, assess, normalizeMedium, finite });
})();
