/**
 * Cisco Enterprise Rack & Cabling Studio - Port & 802.1Q Trunk Configuration Editor
 */
(function () {
  'use strict';

  const ROLE_DEFAULT_COLORS = {
    trunk: '#7c3aed',
    uplink: '#00d2ff',
    'trunk-ap': '#ec4899',
    routed: '#b91c1c',
    mgmt: '#059669',
    management: '#059669',
    console: '#00bceb',
    access: '#38bdf8',
    poe: '#f59e0b'
  };

  window.PortConfigEditor = {
    activeDevId: null,
    activePortIdx: 1,
    activePortId: null,
    activeSource: '3d',

    open(devId, portIdxOrId, source = '3d') {
      const modal = document.getElementById('modal-port-edit');
      if (!modal) return;
      this.activeDevId = devId;
      this.activeSource = source;

      let dev = null;
      let portIdx = 1;
      let portName = '';
      let portType = 'rj45';
      let portCfg = null;

      if (source === '3d' && window.__STUDIO3D__) {
        dev = window.__STUDIO3D__.state.devices.find(d => d.id === devId);
        portIdx = typeof portIdxOrId === 'number' ? portIdxOrId : (parseInt(portIdxOrId, 10) || 1);
        this.activePortIdx = portIdx;
        this.activePortId = 'p' + portIdx;
        if (dev) {
          portCfg = (dev.portsConfig && dev.portsConfig[portIdx]) || null;
          portName = `Port #${portIdx}`;
          if (dev.portDefinitions && dev.portDefinitions[portIdx - 1]) {
            portType = dev.portDefinitions[portIdx - 1].type || dev.portType || 'rj45';
          } else {
            portType = dev.portType || 'rj45';
          }
        }
      } else if (window.RackStudio && window.RackStudio.STATE) {
        const racks = window.RackStudio.STATE.racks || [];
        const rack = racks.find(item => item.devices && item.devices.some(d => d.instanceId === devId || d.id === devId));
        if (rack) {
          dev = rack.devices.find(d => d.instanceId === devId || d.id === devId);
        }
        if (!dev && window.RackStudio.getDeviceById) {
          dev = window.RackStudio.getDeviceById(devId);
        }
        const RS = window.RackStudio;
        const cat = dev && (
          (RS?.resolveCatalogItem && RS.resolveCatalogItem(dev.catalogKey)) ||
          RS?.catalog?.[dev.catalogKey] ||
          window.HARDWARE_CATALOG?.[dev.catalogKey] ||
          (window.CATALOG_3D || []).find(c => c.id === dev.catalogKey)
        );

        let pObj = null;
        if (cat && Array.isArray(cat.ports)) {
          pObj = cat.ports.find(p => p.id === portIdxOrId || p.name === portIdxOrId);
          if (!pObj && portIdxOrId) {
            const aliases = RS?.getPortAliases ? RS.getPortAliases(portIdxOrId) : [String(portIdxOrId)];
            pObj = cat.ports.find(p => aliases.includes(String(p.id)) || (p.name && aliases.includes(String(p.name))));
          }
          if (!pObj && typeof portIdxOrId === 'number' && cat.ports[portIdxOrId - 1]) {
            pObj = cat.ports[portIdxOrId - 1];
          }
        }

        portIdx = pObj ? (cat.ports.indexOf(pObj) + 1) : (parseInt(portIdxOrId, 10) || 1);
        this.activePortIdx = portIdx;
        this.activePortId = (pObj && pObj.id) || (typeof portIdxOrId === 'string' ? portIdxOrId : 'p' + portIdx);
        if (dev) {
          const portAliases = RS?.getPortAliases ? RS.getPortAliases(this.activePortId) : [String(this.activePortId)];
          if (dev.portsConfig) {
            for (const a of portAliases) {
              if (dev.portsConfig[a] !== undefined) {
                portCfg = dev.portsConfig[a];
                break;
              }
            }
            if (!portCfg && pObj?.name && dev.portsConfig[pObj.name] !== undefined) {
              portCfg = dev.portsConfig[pObj.name];
            }
          }

          if (!portCfg && window.RackStudio && window.RackStudio.STATE) {
            const connectedCable = (window.RackStudio.STATE.cables || []).find(c =>
              (c.from?.instanceId === devId && (portAliases.includes(String(c.from?.portId)) || c.from?.portId === this.activePortId)) ||
              (c.to?.instanceId === devId && (portAliases.includes(String(c.to?.portId)) || c.to?.portId === this.activePortId))
            );
            if (connectedCable && connectedCable.role) {
              portCfg = {
                role: connectedCable.role,
                isTrunk: connectedCable.role === 'trunk' || connectedCable.role === 'uplink' || connectedCable.role === 'trunk-ap',
                color: connectedCable.color,
                autoCableColor: true
              };
            }
          }
          portName = pObj ? (pObj.name || `Port #${portIdx}`) : `Port #${portIdx}`;
          portType = (pObj && pObj.type) || 'rj45';
        }
      }

      if (!dev) return;

      const devTitle = dev.hostname || dev.name || 'Donanım';
      const devNameEl = document.getElementById('port-edit-dev-name');
      const portLabelEl = document.getElementById('port-edit-port-label');
      if (devNameEl) devNameEl.textContent = devTitle;
      if (portLabelEl) portLabelEl.textContent = `${portName} (${portType.toUpperCase()})`;

      const role = (portCfg && portCfg.role) || 'access';
      const color = (portCfg && portCfg.color) || ROLE_DEFAULT_COLORS[role] || '#7c3aed';
      const poeState = (portCfg && portCfg.poeState) || 'auto';
      const ciscoName = (portCfg && portCfg.ciscoName) || '';
      const vlan = (portCfg && portCfg.vlan) || '';
      const desc = (portCfg && (portCfg.description || portCfg.note)) || '';
      const autoCable = portCfg ? (portCfg.autoCableColor !== false) : true;

      const roleEl = document.getElementById('port-edit-role');
      const poeEl = document.getElementById('port-edit-poe');
      const colorEl = document.getElementById('port-edit-color');
      const colorHexEl = document.getElementById('port-edit-color-hex');
      const ciscoNameEl = document.getElementById('port-edit-cisco-name');
      const vlanEl = document.getElementById('port-edit-vlan');
      const descEl = document.getElementById('port-edit-desc');
      const autoCableEl = document.getElementById('port-edit-auto-cable-color');

      if (roleEl) roleEl.value = role;
      if (poeEl) poeEl.value = poeState;
      if (colorEl) colorEl.value = color;
      if (colorHexEl) colorHexEl.value = color.toUpperCase();
      if (ciscoNameEl) ciscoNameEl.value = ciscoName;
      if (vlanEl) vlanEl.value = vlan;
      if (descEl) descEl.value = desc;
      if (autoCableEl) autoCableEl.checked = autoCable;

      const badge = document.getElementById('port-edit-badge');
      if (badge) {
        badge.textContent = role.toUpperCase();
        badge.style.background = color || ROLE_DEFAULT_COLORS[role] || '#334155';
        badge.style.color = '#ffffff';
      }

      modal.dataset.deviceId = devId;
      modal.dataset.portIdx = String(portIdx);
      modal.dataset.portId = String(this.activePortId || ('p' + portIdx));
      modal.dataset.source = source;
      modal.style.display = 'flex';
    },

    close() {
      const modal = document.getElementById('modal-port-edit');
      if (!modal) return;
      modal.style.display = 'none';
    },

    save() {
      const modal = document.getElementById('modal-port-edit');
      const devId = this.activeDevId || modal?.dataset?.deviceId;
      if (!devId) {
        this.close();
        return;
      }
      this.activeDevId = devId;
      const targetPortId = this.activePortId || modal?.dataset?.portId || this.activePortIdx;
      try {
        const role = document.getElementById('port-edit-role')?.value || 'access';
        const poeState = document.getElementById('port-edit-poe')?.value || 'auto';
        const color = document.getElementById('port-edit-color')?.value || ROLE_DEFAULT_COLORS[role] || '#7c3aed';
        const ciscoName = (document.getElementById('port-edit-cisco-name')?.value || '').trim();
        const vlan = (document.getElementById('port-edit-vlan')?.value || '').trim();
        const desc = (document.getElementById('port-edit-desc')?.value || '').trim();
        const autoCableColor = document.getElementById('port-edit-auto-cable-color')?.checked ?? true;

        const isTrunk = role === 'trunk' || role === 'uplink' || role === 'trunk-ap';

        const config = {
          role,
          isTrunk,
          poeState,
          color,
          ciscoName,
          vlan,
          description: desc,
          autoCableColor
        };

        // 2D Engine update first
        if (window.RackStudio && window.RackStudio.updatePortConfig) {
          window.RackStudio.updatePortConfig(devId, targetPortId, config);
        }

        // 3D Engine update (guarded)
        if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
          try {
            window.__STUDIO3D__.updatePortConfig(devId, this.activePortIdx, config);
          } catch (e) {
            console.warn('[PortConfigEditor] 3D port config update skipped:', e);
          }
        }

        // Instant Pixi port tint and canvas refresh
        if (window.RackStudio?.updateDevicePortTints) {
          window.RackStudio.updateDevicePortTints(devId);
        }
        if (window.PixiContext?.renderPixi) {
          window.PixiContext.renderPixi('port-modal-saved');
        }

        // Dispatch global change events to persist state and update undo stack
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

        try {
          if (window.is3DMode) {
            if (typeof window.sync3Dto2D === 'function') window.sync3Dto2D();
          } else {
            if (typeof window.sync2Dto3D === 'function') window.sync2Dto3D();
          }
        } catch (e) {}
      } finally {
        this.close();
      }
    },

    reset() {
      const modal = document.getElementById('modal-port-edit');
      const devId = this.activeDevId || modal?.dataset?.deviceId;
      if (!devId) {
        this.close();
        return;
      }
      this.activeDevId = devId;
      const targetPortId = this.activePortId || modal?.dataset?.portId || this.activePortIdx;
      try {
        if (window.RackStudio && window.RackStudio.updatePortConfig) {
          window.RackStudio.updatePortConfig(devId, targetPortId, null);
        }
        if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
          try {
            window.__STUDIO3D__.updatePortConfig(devId, this.activePortIdx, null);
          } catch (e) {}
        }

        if (window.RackStudio?.updateDevicePortTints) {
          window.RackStudio.updateDevicePortTints(devId);
        }
        if (window.PixiContext?.renderPixi) {
          window.PixiContext.renderPixi('port-modal-reset');
        }

        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

        try {
          if (window.is3DMode) {
            if (typeof window.sync3Dto2D === 'function') window.sync3Dto2D();
          } else {
            if (typeof window.sync2Dto3D === 'function') window.sync2Dto3D();
          }
        } catch (e) {}
      } finally {
        this.close();
      }
    }
  };

  // Bind color chips, inputs and action buttons
  function bindPortConfigEvents() {
    document.querySelectorAll('.port-color-chips .color-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.color;
        const colorInput = document.getElementById('port-edit-color');
        const hexInput = document.getElementById('port-edit-color-hex');
        if (colorInput) colorInput.value = hex;
        if (hexInput) hexInput.value = hex.toUpperCase();
        const badge = document.getElementById('port-edit-badge');
        if (badge) {
          badge.style.background = hex;
        }
      });
    });

    document.getElementById('port-edit-color')?.addEventListener('input', (e) => {
      const hexInput = document.getElementById('port-edit-color-hex');
      if (hexInput) hexInput.value = e.target.value.toUpperCase();
      const badge = document.getElementById('port-edit-badge');
      if (badge) {
        badge.style.background = e.target.value;
      }
    });

    document.getElementById('port-edit-color-hex')?.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        const colorInput = document.getElementById('port-edit-color');
        if (colorInput) colorInput.value = val;
        const badge = document.getElementById('port-edit-badge');
        if (badge) {
          badge.style.background = val;
        }
      }
    });

    document.getElementById('port-edit-role')?.addEventListener('change', (e) => {
      const role = e.target.value;
      const defColor = ROLE_DEFAULT_COLORS[role] || '#38bdf8';
      const colorInput = document.getElementById('port-edit-color');
      const hexInput = document.getElementById('port-edit-color-hex');
      if (colorInput) colorInput.value = defColor;
      if (hexInput) hexInput.value = defColor.toUpperCase();
      const badge = document.getElementById('port-edit-badge');
      if (badge) {
        badge.textContent = role.toUpperCase();
        badge.style.background = defColor;
      }
    });

    document.getElementById('btn-close-port-edit')?.addEventListener('click', () => window.PortConfigEditor.close());
    document.getElementById('btn-cancel-port-edit')?.addEventListener('click', () => window.PortConfigEditor.close());
    document.getElementById('btn-save-port-edit')?.addEventListener('click', () => window.PortConfigEditor.save());
    document.getElementById('btn-reset-port-edit')?.addEventListener('click', () => window.PortConfigEditor.reset());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPortConfigEvents);
  } else {
    bindPortConfigEvents();
  }
})();
