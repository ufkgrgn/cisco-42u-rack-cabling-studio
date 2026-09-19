/**
 * Cisco Enterprise Rack & Cabling Studio - Cisco Master Hardware Catalog (Aggregator)
 * Aggregates Catalyst models (js/2d/cisco-catalyst-catalog.js) and Core/Nexus models (js/2d/cisco-nexus-routers-catalog.js).
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const RAW_MODELS = [
    ...(RS.CISCO_CATALYST_MODELS || []),
    ...(RS.CISCO_NEXUS_ROUTER_MODELS || [])
  ];

  // Attach master catalog to global namespace
  window.CISCO_MASTER_CATALOG = RAW_MODELS;
  RS.CISCO_MASTER_CATALOG = RAW_MODELS;

  // Register master models into authoritative hardware catalogs & builtin keys
  const hwCat = RS.HARDWARE_CATALOG || window.HARDWARE_CATALOG;
  const builtinKeys = RS.BUILTIN_KEYS;
  if (hwCat) {
    RAW_MODELS.forEach(m => {
      if (!hwCat[m.id]) {
        hwCat[m.id] = m;
      }
      if (builtinKeys && typeof builtinKeys.add === 'function') {
        builtinKeys.add(m.id);
      }
    });
  }
})();

