(function () {
  'use strict';
  const R = window.RackStudio;
  const source = (title, url) => ({ kind: 'manufacturer', title, url, checkedAt: '2026-10-07' });
  const cisco = source('Cisco Catalyst 9200 datasheet', 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html');
  const aruba = source('Aruba 6000/6100 Installation Guide', 'https://www.arubanetworks.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf');
  const optics = source('Cisco 10GBASE SFP+ Modules datasheet', 'https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html');
  const local = { kind: 'user', title: 'Generic pilot definition', reference: 'Yerel şablon; üretici doğrulaması yok', checkedAt: '2026-10-07' };
  const ports = (type, speed, count, prefix) => Array.from({ length: count }, (_, i) => ({ id: prefix + (i + 1), name: prefix.toUpperCase() + (i + 1), type, speed: speed + 'M', engineering: { connector: type === 'rj45' ? 'rj45' : null, cage: type === 'rj45' ? null : type, speedsMbps: [speed], media: type === 'rj45' ? ['Cat5e', 'Cat6', 'Cat6A'] : null } }));
  function switchModel(id, manufacturer, sku, cage, uplinkSpeed, src) {
    return { id, name: manufacturer + ' ' + sku, manufacturer, sku, modelVersion: '2026.10-pilot-1', category: 'switch', u: 1, ports: [...ports('rj45', 1000, 24, 'p'), ...ports(cage, uplinkSpeed, 4, 'up')], provenance: { source: src, physicalVerification: 'approximate', technicalVerification: 'documented-fields', unknownFields: ['portGeometry', 'inputConsumption', 'hostTransceiverSupport'] }, engineering: { source: src, poe: { budgetWatts: 370, perPortWatts: 30, ports: Array.from({ length: 24 }, (_, i) => 'p' + (i + 1)), standards: ['802.3af', '802.3at'], source: src }, moduleSlots: [], power: { typicalWatts: null, nameplateWatts: null } } };
  }
  const models = {
    'eng-cisco-c9200l-24p-4g': switchModel('eng-cisco-c9200l-24p-4g', 'Cisco', 'C9200L-24P-4G', 'sfp', 1000, cisco),
    'eng-aruba-jl677a': switchModel('eng-aruba-jl677a', 'HPE Aruba', 'JL677A', 'sfp+', 10000, aruba),
    'eng-generic-panel-24': { id: 'eng-generic-panel-24', name: 'Generic 24-port patch panel', manufacturer: 'Generic', sku: 'LOCAL-PANEL-24', modelVersion: '2026.10-pilot-1', u: 1, category: 'patch', ports: ports('rj45', 1000, 24, 'p'), provenance: { source: local, physicalVerification: 'approximate', technicalVerification: 'declared-local', unknownFields: ['portGeometry', 'certifiedBandwidth'] }, engineering: { source: local, passive: true } }
  };
  const transceivers = {
    'SFP-10G-SR': { model: 'SFP-10G-SR', cage: 'sfp+', connector: 'lc', speedsMbps: [10000], media: ['OM3', 'OM4'], wavelengthNm: 850, maxDistanceMeters: { OM3: 300, OM4: 400 }, source: optics },
    'SFP-10G-LR': { model: 'SFP-10G-LR', cage: 'sfp+', connector: 'lc', speedsMbps: [10000], media: ['OS2'], wavelengthNm: 1310, maxDistanceMeters: { OS2: 10000 }, source: optics }
  };
  for (const port of models['eng-aruba-jl677a'].ports.filter(p => p.engineering.cage)) {
    port.engineering.speedsMbps = [1000,10000]; port.engineering.supportedCages = ['sfp','sfp+'];
  }
  models['eng-aruba-jl677a'].engineering.supportedTransceiverManufacturers = ['HPE Aruba'];
  for (const transceiver of Object.values(transceivers)) transceiver.manufacturer = 'Cisco';
  R.CatalogSourcePack = Object.freeze({ version: 1, models, transceivers, modules: {} });
})();
