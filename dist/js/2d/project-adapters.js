(function () {
  'use strict';
  const RS = window.RackStudio = window.RackStudio || {};
  const deviceFields = ['name', 'hostname', 'ipAddress', 'macAddress', 'serialNumber', 'assetTag', 'observed', 'passThroughPairs', 'panelLabel', 'portsConfig', 'face'];
  const cableFields = ['name', 'note', 'role', 'medium', 'ductSide'];
  const pick = (value, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));

  function from3D(scene, base) {
    const document = RS.ProjectDocument.normalize(base || RS.ProjectDocument.capture(RS.STATE));
    const live = RS.STATE?.projectDocument;
    if (live?.projectId === document.projectId && live.revision >= document.revision) {
      document.revision = live.revision;
      const key = RS.ProjectCommands?.LEDGER;
      if (key && live.extensions[key] !== undefined) document.extensions[key] = live.extensions[key];
    }
    const topology = document.topology;
    const previousRacks = new Map((topology.racks || []).map(r => [r.id, r]));
    const previousDevices = new Map((topology.racks || []).flatMap(r => (r.devices || []).map(d => [d.instanceId, d])));
    const previousCables = new Map((topology.cables || []).map(c => [c.id, c]));
    const racks = scene.racks?.length ? scene.racks : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: scene.rackHeightU || 42 }];
    const defaultRack = racks[0].id;
    const devices = new Map((scene.devices || []).map(d => [d.id, d]));
    const usedPorts = new Set();
    function endpoint(value) {
      const device = devices.get(value?.devId);
      if (!device) throw new Error('3D kablo ucu çözümlenemedi.');
      const cat = topology.customCatalog?.[device.catalogId] || RS.resolveCatalogItem?.(device.catalogId) || RS.catalog?.[device.catalogId];
      const ports = cat?.ports || device.portDefinitions || [];
      const portId = value.portId !== undefined ? value.portId : (Number.isInteger(value.portIdx) && value.portIdx >= 1 ? ports[value.portIdx - 1]?.id : undefined);
      const key = device.id + ':' + portId;
      if (!portId || !ports.some(port => port.id === portId) || usedPorts.has(key)) throw new Error('3D port eşlemesi geçersiz veya dolu; proje değiştirilmedi.');
      usedPorts.add(key);
      return { rackId: value.rackId || device.rackId || defaultRack, instanceId: device.id, portId, face: value.face || device.face || 'front' };
    }
    document.topology = {
      ...topology,
      doorOpen: scene.doorOpen === true,
      activeRackId: scene.activeRackId || defaultRack,
      racks: racks.map(r => ({
        ...previousRacks.get(r.id), id: r.id, name: r.name, heightU: r.heightU || scene.rackHeightU || 42,
        devices: (scene.devices || []).filter(d => (d.rackId || defaultRack) === r.id).map(d => ({
          ...previousDevices.get(d.id), ...pick(d, deviceFields),
          instanceId: d.id, catalogKey: d.catalogId, uHeight: d.uHeight || 1,
          topU: d.startU + (d.uHeight || 1) - 1
        }))
      })),
      cables: (scene.cables || []).map(c => {
        const old = previousCables.get(c.id);
        const from = endpoint(c.from), to = endpoint(c.to);
        return {
          ...old, ...pick(c, cableFields), id: c.id,
          color: typeof c.color === 'number' ? '#' + c.color.toString(16).padStart(6, '0') : (c.color || '#00d2ff'),
          lengthMeters: c.lengthM ?? old?.lengthMeters ?? 1.5,
          from: { ...old?.from, ...from }, to: { ...old?.to, ...to }
        };
      })
    };
    const validated = RS.validateTopology(document);
    document.topology = { ...document.topology, ...validated };
    return RS.ProjectDocument.normalize(document);
  }
  RS.ProjectAdapters = Object.freeze({ from3D });
})();
