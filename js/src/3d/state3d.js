/**
 * 3D Studio State Store (Auto-Save, Undo/Redo & Topology Sync)
 */
// --- STATE STORE (With Auto-Save & Cable Tagging) ---
  class StudioState {
    constructor() {
      this.rackHeightU = 42;
      this.devices = [];
      this.cables = []; // { id, name, note, from: { devId, portIdx }, to: { devId, portIdx }, color, lengthM }
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
      try {
        const payload = {
          version: '3.1.0',
          updatedAt: Date.now(),
          rackHeightU: this.rackHeightU,
          devices: this.devices,
          cables: this.cables,
          doorOpen: this.doorOpen,
          cableRoutingMode: this.cableRoutingMode,
          lightingMode: this.lightingMode,
          deviceLabelMode: this.deviceLabelMode
          ,performanceMode: this.performanceMode
        };
        localStorage.setItem('cisco_rack_studio_3d_state', JSON.stringify(payload));

        // Bidirectional live cache for 2D mode & external tabs
        const canonicalProj = {
          version: '3.0.0',
          doorOpen: this.doorOpen,
          activeRackId: 'rack-1',
          racks: [{
            id: 'rack-1',
            name: 'MDF - Dağıtım Kabini',
            heightU: this.rackHeightU,
            devices: this.devices.map(d => ({
              instanceId: d.id,
              catalogKey: d.catalogId,
              topU: d.startU + (d.uHeight || 1) - 1,
              uHeight: d.uHeight || 1,
              name: d.name,
              ipAddress: d.ipAddress || '',
              macAddress: d.macAddress || '',
              serialNumber: d.serialNumber || '',
              panelLabel: d.panelLabel || '',
              portsConfig: d.portsConfig || {}
            }))
          }],
          cables: this.cables.map(c => ({
            id: c.id,
            name: c.name || 'Kablo',
            color: typeof c.color === 'number' ? '#' + c.color.toString(16).padStart(6, '0') : (c.color || '#00d2ff'),
            lengthMeters: c.lengthM || 1.5,
            from: {
              rackId: 'rack-1',
              instanceId: c.from.devId,
              portId: c.from.portId || (((window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[(this.devices.find(d => d.id === c.from.devId) || {}).catalogId] || {}).ports || [])[c.from.portIdx - 1] || {}).id || ('p' + (c.from.portIdx || 1))
            },
            to: {
              rackId: 'rack-1',
              instanceId: c.to.devId,
              portId: c.to.portId || (((window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[(this.devices.find(d => d.id === c.to.devId) || {}).catalogId] || {}).ports || [])[c.to.portIdx - 1] || {}).id || ('p' + (c.to.portIdx || 1))
            }
          }))
        };
        localStorage.setItem('cisco-rack-studio-project', JSON.stringify(canonicalProj));
      } catch (e) {}
    }

    loadAutoSave() {
      try {
        const raw = localStorage.getItem('cisco_rack_studio_3d_state');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.devices) && data.devices.length > 0) {
          this.rackHeightU = data.rackHeightU || 42;
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
      const snap = JSON.stringify({
        rackHeightU: this.rackHeightU,
        devices: this.devices,
        cables: this.cables
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
      if (this.historyIdx > 0) {
        this.historyIdx--;
        const state = JSON.parse(this.history[this.historyIdx]);
        this.rackHeightU = state.rackHeightU;
        this.devices = state.devices;
        this.cables = state.cables;
        this.autoSave();
        return true;
      }
      return false;
    }

    redo() {
      if (this.historyIdx < this.history.length - 1) {
        this.historyIdx++;
        const state = JSON.parse(this.history[this.historyIdx]);
        this.rackHeightU = state.rackHeightU;
        this.devices = state.devices;
        this.cables = state.cables;
        this.autoSave();
        return true;
      }
      return false;
    }
  }

export { StudioState };
