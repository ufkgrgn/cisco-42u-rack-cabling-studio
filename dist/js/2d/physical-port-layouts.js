/* Physical port anchors shared by the active 2D and 3D renderers.
 * Coordinates are normalized to the device face. Approximate records must be
 * calibrated against an exact SKU before being marked verified. */
(() => {
  'use strict';
  const RS = window.RackStudio = window.RackStudio || {};
  const catalog = RS.HARDWARE_CATALOG || window.HARDWARE_CATALOG || {};

  function twoRowPorts(ports, primaryCount, startX, endX, uplinkStart, uplinkEnd) {
    const columns = Math.ceil(primaryCount / 2);
    const uplinks = ports.length - primaryCount;
    const uplinkColumns = Math.ceil(uplinks / 2);
    return ports.map((port, index) => {
      const isUplink = index >= primaryCount;
      const slot = isUplink ? index - primaryCount : index;
      const count = isUplink ? uplinkColumns : columns;
      const left = isUplink ? uplinkStart : startX;
      const right = isUplink ? uplinkEnd : endX;
      const stride = count > 1 ? (right - left) / (count - 1) : 0;
      return Object.freeze({
        id: port.id,
        x: left + Math.floor(slot / 2) * stride,
        y: slot % 2 ? 0.64 : 0.36,
        width: Math.min(isUplink ? 0.016 : 0.016, stride * 0.72 || 0.016),
        height: 0.22,
        face: 'front'
      });
    });
  }

  const pilots = [
    ['cisco-m-c9200l-24p-4x', 24, 0.39, 0.81, 0.87, 0.94],
    ['cisco-m-c9200l-48p-4x', 48, 0.32, 0.82, 0.87, 0.94],
    ['cisco-m-c9300-24p', 24, 0.38, 0.80, 0.87, 0.94]
  ];
  for (const [id, primaryCount, startX, endX, uplinkStart, uplinkEnd] of pilots) {
    const model = catalog[id];
    if (!model || !Array.isArray(model.ports) || model.ports.length !== primaryCount + 4) continue;
    model.portGeometry = Object.freeze({
      version: 1,
      sku: model.modelTag,
      face: 'front',
      verification: 'approximate',
      source: model.faceplate?.stencil || '',
      ports: Object.freeze(twoRowPorts(model.ports, primaryCount, startX, endX, uplinkStart, uplinkEnd))
    });
  }
  const patch = catalog['patch-cat6-24'];
  if (patch?.ports?.length === 24) {
    patch.portGeometry = Object.freeze({
      version: 1,
      sku: patch.modelTag || 'PATCH-24',
      face: 'front',
      verification: 'approximate',
      source: '',
      ports: Object.freeze(patch.ports.map((port, index) => Object.freeze({
        id: port.id,
        x: 0.25 + index * (0.68 / 23),
        y: 0.5,
        width: 0.018,
        height: 0.28,
        face: 'front'
      })))
    });
  }
  const patch48 = catalog['patch-cat6-48'];
  if (patch48?.ports?.length === 48 && !patch48.portGeometry) {
    const stride = (0.92 - 0.22) / 23;
    patch48.portGeometry = Object.freeze({
      version: 1,
      sku: patch48.modelTag || 'PATCH-48',
      face: 'front',
      verification: 'approximate',
      source: '',
      ports: Object.freeze(patch48.ports.map((port, index) => {
        const row = Math.floor(index / 24);
        const col = index % 24;
        return Object.freeze({
          id: port.id,
          x: 0.22 + col * stride,
          y: row === 0 ? 0.36 : 0.64,
          width: 0.018,
          height: 0.28,
          face: 'front'
        });
      }))
    });
  }

  const STENCIL_MAP = {
    'cisco-m-c9200l-24p-4g': 'C9200L-24P-4G Front.svg',
    'cisco-m-c9200l-24p-4x': 'C9200L-24P-4X_Front.svg',
    'cisco-m-c9200l-48p-4g': 'C9200L-48P-4G Front.svg',
    'cisco-m-c9200l-48p-4x': 'C9200L-48P-4X_Front.svg',
    'cisco-m-c9200-24p': 'C9200-24P Front.svg',
    'cisco-m-c9200-48p': 'C9200-48P Front.svg',
    'cisco-m-c9200-24t': 'C9200-24T_Front.svg',
    'cisco-m-c9200-48t': 'C9200-48T Front.svg',
    'cisco-m-c9300l-24p-4x': 'C9300L-24P-4X_Front.svg',
    'cisco-m-c9300l-48p-4x': 'C9300L-48P-4X_Front.svg',
    'cisco-m-c9300-24p': 'C9300-24P Front.svg',
    'cisco-m-c9300-48p': 'C9300-48P Front.svg',
    'cisco-m-c9300-24u': 'C9300-24U Front.svg',
    'cisco-m-c9300-48u': 'C9300-48U Front.svg',
    'cisco-m-c9300x-48hx': 'C9300X-48HX Front.svg',
    'cisco-m-c9300x-24y': 'C9300X-24Y Front.svg',
    'cisco-m-c9500-16x': 'C9500-16X Front.svg',
    'cisco-m-c9500-40x': 'C9500-16X Front.svg',
    'cisco-m-c9500-24y4c': 'C9500-24Y4C Front.svg',
    'cisco-m-c9500-48y4c': 'C9500-48Y4C_Front.svg',
    'cisco-m-2960s-24ps': 'WS-C2960S-24PS-L_Front.svg',
    'cisco-m-2960s-48fps': 'WS-C2960S-48FPS-L_Front.svg',
    'cisco-m-nexus-3064pq': 'N3K-C3064PQ_Front.svg'
  };

  // Auto-calibrate all Cisco switches according to real front-panel stencil proportions
  for (const [id, model] of Object.entries(catalog)) {
    if (!model || model.portGeometry || !Array.isArray(model.ports) || model.ports.length === 0) continue;
    if (model.category !== 'switch') continue;

    const total = model.ports.length;
    let geom = null;

    if (total === 28 || total === 26) {
      // 24 access ports + 4 or 2 uplinks (e.g. C9200, C9300, 2960-X, 3850)
      const primary = 24;
      const upStart = total === 28 ? 0.87 : 0.89;
      geom = twoRowPorts(model.ports, primary, 0.38, 0.80, upStart, 0.94);
    } else if (total === 52 || total === 50) {
      // 48 access ports + 4 or 2 uplinks
      const primary = 48;
      const upStart = total === 52 ? 0.87 : 0.89;
      geom = twoRowPorts(model.ports, primary, 0.30, 0.82, upStart, 0.94);
    } else if (total === 54) {
      // Nexus 93180YC (48 SFP+ access + 6 QSFP28 spine uplinks)
      geom = twoRowPorts(model.ports, 48, 0.24, 0.76, 0.80, 0.94);
    } else if (total === 32 || total === 36) {
      // High-density spine/core (e.g. Catalyst 9500-32QC, Nexus 9336C)
      geom = twoRowPorts(model.ports, total, 0.24, 0.94, 0.88, 0.94);
    } else if (total === 12 || total === 16 || total === 18) {
      // Compact enterprise switches (e.g. C1000-8P, C1000-16P, 3560CX-8, 2960CX-8)
      const primary = total >= 16 ? 12 : 8;
      geom = twoRowPorts(model.ports, primary, 0.40, 0.74, 0.82, 0.92);
    }

    if (geom) {
      const stencil = model.faceplate?.stencil || STENCIL_MAP[id] || '';
      if (!model.faceplate && stencil) {
        model.faceplate = { stencil };
      }
      model.portGeometry = Object.freeze({
        version: 1,
        sku: model.modelTag || id,
        face: 'front',
        verification: 'approximate',
        source: stencil,
        ports: Object.freeze(geom)
      });
    }
  }
  try {
    const overrides = JSON.parse(localStorage.getItem('rack-studio-port-geometry-v1') || '{}');
    for (const [id, saved] of Object.entries(overrides)) {
      const model = catalog[id];
      if (!model || !Array.isArray(model.ports) || !Array.isArray(saved?.ports)) continue;
      const ids = new Set(model.ports.map(port => port.id));
      if (saved.ports.length !== ids.size || saved.ports.some(port => !ids.has(port.id) || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(port[key]) && port[key] >= 0 && port[key] <= 1))) continue;
      model.portGeometry = Object.freeze({ version: 1, sku: model.modelTag || id, face: 'front', verification: 'calibrated-local', source: saved.source || '', ports: Object.freeze(saved.ports.map(port => Object.freeze({ ...port }))) });
    }
  } catch (_) { /* A malformed local override must not hide the built-in catalog. */ }
  RS.getPhysicalPortGeometry = catalogKey => catalog[catalogKey]?.portGeometry || null;
  RS.exportPortGeometryOverrides = () => Object.fromEntries(Object.entries(catalog)
    .filter(([, model]) => model?.portGeometry?.verification === 'calibrated-local')
    .map(([id, model]) => [id, structuredClone(model.portGeometry)]));
  RS.validatePortGeometryOverrides = raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Geçersiz port kalibrasyonu.');
    const entries = Object.entries(raw);
    if (entries.length > 200) throw new Error('Çok fazla port kalibrasyonu.');
    return Object.fromEntries(entries.map(([id, saved]) => {
      const model = Object.hasOwn(catalog, id) ? catalog[id] : null;
      const ids = new Set(model?.ports?.map(port => port.id) || []);
      if (!model || !Array.isArray(saved?.ports) || saved.ports.length !== ids.size || saved.ports.length > 512) throw new Error('Port kalibrasyonu modelle eşleşmiyor: ' + id);
      const seen = new Set();
      const ports = saved.ports.map(port => {
        if (!ids.has(port.id) || seen.has(port.id) || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(port[key]) && port[key] >= 0 && port[key] <= 1)) throw new Error('Geçersiz port kalibrasyonu: ' + id);
        seen.add(port.id);
        return { id: port.id, x: port.x, y: port.y, width: port.width, height: port.height, face: 'front' };
      });
      return [id, { version: 1, sku: model.modelTag || id, face: 'front', verification: 'calibrated-local', source: String(saved.source || '').slice(0, 200), ports }];
    }));
  };
  RS.applyPortGeometryOverrides = raw => {
    const valid = RS.validatePortGeometryOverrides(raw);
    for (const [id, geometry] of Object.entries(valid)) catalog[id].portGeometry = geometry;
    if (Object.keys(valid).length) {
      try {
        const old = JSON.parse(localStorage.getItem('rack-studio-port-geometry-v1') || '{}');
        localStorage.setItem('rack-studio-port-geometry-v1', JSON.stringify({ ...old, ...valid }));
      } catch (_) { /* The imported project still uses the geometry for this session. */ }
      RS.DeviceSceneRegistry?.invalidate({ templates: true });
    }
  };
})();
