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
        width: Math.min(isUplink ? 0.025 : 0.027, stride * 0.72 || 0.025),
        height: 0.24,
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
        width: 0.021,
        height: 0.27,
        face: 'front'
      })))
    });
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
