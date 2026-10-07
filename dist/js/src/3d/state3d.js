/**
 * 3D Studio State Store (Auto-Save, Undo/Redo & Topology Sync)
 */
// --- STATE STORE (With Auto-Save & Cable Tagging) ---
  class StudioState {
    constructor() {
      this.rackHeightU = 42;
      this.racks = [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: 42 }];
      this.activeRackId = 'rack-1';
      this.devices = [];
      this.cables = []; // { id, name, note, from: { devId, portIdx, rackId, portId }, to: { devId, portIdx, rackId, portId }, color, lengthM }
      this.history = [];
      this.historyIdx = -1;
      this.doorOpen = false;
      this.selectedDeviceId = null;
      this.selectedCableId = null;
      this.activePort = null;
      this.cableColorIdx = 0;
      this.cableRoutingMode = 'catenary';
      this.lightingMode = 'studio';
      this.deviceLabelMode = localStorage.getItem('rack-studio-device-label-mode') || 'name';
      this.performanceMode = localStorage.getItem('rack-studio-3d-performance-mode') || 'balanced';
    }

    autoSave() {
      if (this.projectProjection || this.projectBatchDepth > 0) return true;
      try {
        const payload = {
          version: '3.2.0',
          portGeometryOverrides: window.RackStudio?.exportPortGeometryOverrides?.() || {},
          updatedAt: Date.now(),
          rackHeightU: this.rackHeightU,
          racks: this.racks,
          activeRackId: this.activeRackId,
          devices: this.devices,
          cables: this.cables,
          doorOpen: this.doorOpen,
          cableRoutingMode: this.cableRoutingMode,
          lightingMode: this.lightingMode,
          deviceLabelMode: this.deviceLabelMode,
          performanceMode: this.performanceMode
        };

        const api = window.RackStudio;
        if (!api?.ProjectAdapters) throw new Error('Ortak proje adaptörü yüklenmedi.');
        const base = this.projectDocument || api.ProjectDocument.capture(api.STATE);
        let canonicalProj = api.ProjectAdapters.from3D(this, base);
        if (window.is3DMode) {
          const candidate = { ...base, topology: canonicalProj.topology };
          if (api.ProjectCommands.domainKey(candidate) !== api.ProjectCommands.domainKey(base)) {
            api.ProjectCommands.execute({ commandId: crypto.randomUUID(), projectId: base.projectId,
              expectedRevision: base.revision, expectedContent: api.ProjectCommands.domainKey(base),
              type: 'ApplyTopology', payload: { topology: canonicalProj.topology } });
          }
          canonicalProj = api.ProjectDocument.capture(api.STATE);
          if (api.ProjectCommands.domainKey(candidate) === api.ProjectCommands.domainKey(base)
              && api.ProjectCommands.domainKey(base) !== api.ProjectCommands.domainKey(canonicalProj)) {
            this.restoreProjectScene?.(canonicalProj);
          }
        }
        this.projectDocument = canonicalProj;
        payload.projectDocument = canonicalProj;
        // Compatibility cache failure cannot undo an already accepted domain command.
        try {
          localStorage.setItem('cisco_rack_studio_3d_state', JSON.stringify(payload));
          localStorage.setItem('cisco-rack-studio-project', JSON.stringify(canonicalProj));
          this.lastCacheError = null;
        } catch (error) { this.lastCacheError = error.message; }
        this.lastSaveError = null;
        return true;
      } catch (error) {
        this.lastSaveError = error.message;
        if (window.is3DMode) this.restoreProjectScene?.(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
        console.error('3D proje kaydedilemedi:', error);
        return false;
      }
    }
    loadAutoSave() {
      try {
        const raw = localStorage.getItem('cisco_rack_studio_3d_state');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.devices) && Array.isArray(data.racks) && data.racks.length > 0) {
          if (data.version !== undefined && data.version !== '3.2.0') throw new Error('Desteklenmeyen 3D kayıt sürümü.');
          const api = window.RackStudio;
          const base = data.projectDocument || api.ProjectDocument.normalize({
            racks: data.racks.map(rack => ({ ...rack, devices: [] })), cables: [], customCatalog: api.STATE.customCatalog || {}
          });
          const project = api.ProjectAdapters.from3D(data, base);
          this.projectDocument = project;
          this.rackHeightU = data.rackHeightU || 42;
          this.racks = Array.isArray(data.racks) && data.racks.length > 0 ? data.racks : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: this.rackHeightU }];
          this.activeRackId = data.activeRackId || (this.racks[0] && this.racks[0].id) || 'rack-1';
          this.devices = data.devices;
          this.cables = data.cables || [];
          this.doorOpen = data.doorOpen === true;
          this.cableRoutingMode = data.cableRoutingMode || 'catenary';
          this.lightingMode = data.lightingMode || 'studio';
          this.performanceMode = data.performanceMode || localStorage.getItem('rack-studio-3d-performance-mode') || 'balanced';
          return true;
        }
      } catch (e) {}
      return false;
    }

    pushSnapshot() {
      if (this.projectProjection || this.projectBatchDepth > 0) return true;
      if (window.is3DMode) return this.autoSave();
      const snap = JSON.stringify({
        rackHeightU: this.rackHeightU,
        racks: this.racks,
        activeRackId: this.activeRackId,
        devices: this.devices,
        cables: this.cables,
        projectDocument: this.projectDocument
      });
      this.history = this.history.slice(0, this.historyIdx + 1);
      this.history.push(snap);
      this.historyIdx++;
      if (this.history.length > 50) {
        this.history.shift();
        this.historyIdx--;
      }
      this.autoSave();
    }

    undo() {
      if (window.is3DMode) {
        const changed = window.RackStudio.undoProject?.() === true;
        if (changed) this.restoreProjectScene?.(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
        return changed;
      }
      if (this.historyIdx > 0) {
        this.historyIdx--;
        const state = JSON.parse(this.history[this.historyIdx]);
        this.rackHeightU = state.rackHeightU;
        if (Array.isArray(state.racks)) this.racks = state.racks;
        if (state.activeRackId) this.activeRackId = state.activeRackId;
        this.devices = state.devices;
        this.cables = state.cables;
        if (state.projectDocument) this.projectDocument = state.projectDocument;
        this.autoSave();
        return true;
      }
      return false;
    }

    redo() {
      if (window.is3DMode) {
        const changed = window.RackStudio.redoProject?.() === true;
        if (changed) this.restoreProjectScene?.(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
        return changed;
      }
      if (this.historyIdx < this.history.length - 1) {
        this.historyIdx++;
        const state = JSON.parse(this.history[this.historyIdx]);
        this.rackHeightU = state.rackHeightU;
        if (Array.isArray(state.racks)) this.racks = state.racks;
        if (state.activeRackId) this.activeRackId = state.activeRackId;
        this.devices = state.devices;
        this.cables = state.cables;
        if (state.projectDocument) this.projectDocument = state.projectDocument;
        this.autoSave();
        return true;
      }
      return false;
    }
  }

export { StudioState };
