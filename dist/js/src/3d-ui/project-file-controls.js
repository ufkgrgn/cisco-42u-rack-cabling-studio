/** Full project JSON and bounded migration of the old native 3D export. */
export function parseStudioProject(text) {
  const api = window.RackStudio;
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > api.ProjectDocument.MAX_BYTES) throw new Error('Proje JSON dosyası 32 MB sınırını aşıyor.');
  const data = JSON.parse(text);
  if (data?.version === '3.1.0-3D' && data.schemaVersion === undefined) {
    // Apply the same unsafe-key/depth/size inspection before reading native fields.
    api.ProjectDocument.normalize({ racks: [], cables: [], nativeImport: data });
    if (!Array.isArray(data.devices) || !Array.isArray(data.cables)) throw new Error('Geçersiz eski 3D proje.');
    const racks = data.racks || [{ id: 'rack-1', name: 'İçe aktarılan 3D kabin', heightU: data.rackHeightU || 42 }];
    const base = api.ProjectDocument.normalize({ racks: racks.map(r => ({ ...r, devices: [] })), cables: [], customCatalog: data.customCatalog || {} });
    base.metadata.migratedFrom = data.version;
    base.extensions.native3DImport = data;
    const devices = data.devices.map((device, index) => {
      if (base.topology.customCatalog[device.catalogId]) return device;
      const canonical = api.resolveCatalogItem(device.catalogId);
      const source = window.CATALOG_3D?.find(item => item.id === device.catalogId) || canonical;
      if (!source) throw new Error('Eski 3D katalog modeli çözümlenemedi: ' + device.catalogId);
      const knownPorts = device.portDefinitions?.length ? device.portDefinitions : canonical?.ports;
      if (canonical && canonical.u === device.uHeight && knownPorts?.every(port => canonical.ports.some(p => p.id === port.id))) return device;
      // Preserve the old model's actual dimensions and port identities as a local model.
      const id = 'legacy3d-model-' + index;
      const count = device.portsCount ?? source.portsCount ?? 0;
      if (!Number.isInteger(count) || count < 0 || count > 256) throw new Error('Eski 3D port sayısı geçersiz.');
      const ports = device.portDefinitions?.length ? device.portDefinitions : (source.ports || Array.from({ length: count }, (_, i) => ({ id: 'p' + (i + 1), name: 'Port ' + (i + 1), type: device.portType || source.portType || 'rj45' })));
      base.topology.customCatalog[id] = { ...source, id, u: device.uHeight ?? source.u, ports,
        name: source.name || device.name || id, legacyCatalogId: device.catalogId };
      return { ...device, catalogId: id };
    });
    return api.ProjectAdapters.from3D({ ...data, devices, racks }, base);
  }
  return api.ProjectDocument.parse(text);
}

export function initProjectFileControls(studio) {
  const api = window.RackStudio;
  document.getElementById('btn-export-json-3d')?.addEventListener('click', () => {
    try {
      if (!studio.state.autoSave()) throw new Error(studio.state.lastSaveError);
      api.flushProjectChanges();
      const doc = api.ProjectDocument.capture(api.STATE);
      const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `rack-studio-project-${doc.projectId}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      studio.showToast('Tam proje JSON dosyası dışa aktarıldı.');
    } catch (error) { studio.showToast(error.message); }
  });
  const input = document.getElementById('file-import-3d');
  const trigger = document.getElementById('btn-import-json-3d');
  trigger?.addEventListener('click', () => input?.click());
  let reading = false;
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file || reading) return;
    reading = true; if (trigger) trigger.disabled = true;
    try {
      if (file.size > api.ProjectDocument.MAX_BYTES) throw new Error('Proje JSON dosyası 32 MB sınırını aşıyor.');
      if (!studio.state.autoSave()) throw new Error(studio.state.lastSaveError);
      const expected = api.ProjectCommands.begin();
      const doc = parseStudioProject(await file.text());
      api.validateTopology(doc);
      const result = await api.importProjectDocument(doc, expected);
      studio.loadTopologyFromProject(api.ProjectDocument.capture(api.STATE));
      window.renderCatalog?.(); window.renderInstalledDevicesList?.();
      studio.showToast(result.copied ? 'Dosya ayrı proje kopyası olarak açıldı; mevcut kayıt korundu.' : 'Tam proje açıldı.');
    } catch (error) { studio.showToast('Proje açılamadı: ' + error.message); }
    finally { reading = false; input.value = ''; if (trigger) trigger.disabled = false; }
  });
}
