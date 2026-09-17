/**
 * Cisco Enterprise Rack & Cabling Studio - Device Metadata Editor (Hostname, IP, MAC, Serial, Panel Label)
 */
(function () {
  'use strict';

  window.DeviceMetadataEditor = {
    prepare(modal, dev, category, source, instanceId) {
      const isPanel = ['patch', 'patch-panel', 'fiber'].includes(category);
      const titleEl = document.getElementById('modal-dev-edit-title');
      const nameLabelEl = document.getElementById('dev-edit-name-label');
      const panelGroupEl = document.getElementById('dev-edit-panel-label-group');
      const ipGroupEl = document.getElementById('dev-edit-ip-group');
      const macGroupEl = document.getElementById('dev-edit-mac-group');
      const serialGroupEl = document.getElementById('dev-edit-serial-group');

      if (titleEl) {
        titleEl.textContent = isPanel
          ? `🏷️ ${dev.name || 'Patch Panel'} - PANEL YAPILANDIRMASI`
          : `⚙️ ${dev.name || 'Switch'} - CİHAZ YAPILANDIRMASI`;
      }
      if (nameLabelEl) nameLabelEl.textContent = isPanel ? 'Panel Adı' : 'Hostname / Cihaz Adı';
      if (panelGroupEl) panelGroupEl.style.display = isPanel ? 'block' : 'none';
      if (ipGroupEl) ipGroupEl.style.display = isPanel ? 'none' : 'block';
      if (macGroupEl) macGroupEl.style.display = isPanel ? 'none' : 'block';
      if (serialGroupEl) serialGroupEl.style.display = isPanel ? 'none' : 'block';

      const hostnameInput = document.getElementById('dev-edit-hostname');
      const panelInput = document.getElementById('dev-edit-panel-label');
      const ipInput = document.getElementById('dev-edit-ip');
      const macInput = document.getElementById('dev-edit-mac');
      const serialInput = document.getElementById('dev-edit-serial');

      if (hostnameInput) hostnameInput.value = dev.hostname || dev.name || '';
      if (panelInput) panelInput.value = dev.panelLabel || '';
      if (ipInput) ipInput.value = dev.ipAddress || '';
      if (macInput) macInput.value = dev.macAddress || '';
      if (serialInput) serialInput.value = dev.serialNumber || '';

      // Populate configured trunk ports list
      const trunkListEl = document.getElementById('dev-edit-trunk-list');
      if (trunkListEl) {
        trunkListEl.innerHTML = '';
        const portsConfig = dev.portsConfig || {};
        const configuredKeys = Object.keys(portsConfig);
        if (configuredKeys.length === 0) {
          trunkListEl.innerHTML = '<div style="color:#64748b; font-style:italic;">Henüz özel/trunk port yapılandırılmadı.</div>';
        } else {
          configuredKeys.forEach(pKey => {
            const cfg = portsConfig[pKey];
            if (!cfg) return;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(30,41,59,0.85); border-radius:4px; padding:4px 8px; border-left:3px solid ' + (cfg.color || '#a855f7');
            const ciscoNamePart = cfg.ciscoName ? ` (${cfg.ciscoName})` : '';
            const vlanPart = cfg.vlan ? ` · VLAN: ${cfg.vlan}` : '';
            row.innerHTML = `
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;">
                <span style="font-weight:700; color:${cfg.color || '#a855f7'};">Port #${pKey}${ciscoNamePart}</span>
                <span style="color:#94a3b8; font-size:11px;">[${(cfg.role || 'trunk').toUpperCase()}]${vlanPart}</span>
              </div>
              <button type="button" class="hud-btn" style="padding:2px 8px; font-size:10px; white-space:nowrap;" data-port="${pKey}">Düzenle</button>
            `;
            row.querySelector('button')?.addEventListener('click', (e) => {
              e.stopPropagation();
              window.PortConfigEditor?.open(instanceId, pKey, source);
            });
            trunkListEl.appendChild(row);
          });
        }
      }

      modal.dataset.source = source;
      modal.dataset.deviceId = instanceId;
      modal.dataset.deviceCategory = category || '';
      modal.style.display = 'flex';
    },

    open2D(instanceId) {
      const racks = (window.RackStudio && window.RackStudio.STATE.racks) || [];
      const rack = racks.find(item => item.devices.some(dev => dev.instanceId === instanceId));
      const dev = rack && rack.devices.find(item => item.instanceId === instanceId);
      if (!dev) return;
      const modal = document.getElementById('modal-device-edit');
      if (!modal) return;
      const cat = (window.RackStudio.catalog && window.RackStudio.catalog[dev.catalogKey]) || {};
      this.prepare(modal, { ...dev, name: dev.name || cat.name }, cat.category, '2d', instanceId);
    },

    open3D(instanceId) {
      if (!window.__STUDIO3D__) return;
      const dev = window.__STUDIO3D__.state.devices.find(d => d.id === instanceId);
      if (!dev) return;
      const modal = document.getElementById('modal-device-edit');
      if (!modal) return;
      this.prepare(modal, dev, dev.category, '3d', instanceId);
    },

    close() {
      const modal = document.getElementById('modal-device-edit');
      if (modal) {
        modal.dataset.source = '';
        modal.style.display = 'none';
      }
    }
  };

  function bindDeviceMetadataEvents() {
    document.getElementById('btn-save-device-edit')?.addEventListener('click', event => {
      const modal = document.getElementById('modal-device-edit');
      if (!modal) return;
      const devId = modal.dataset.deviceId;
      const hostnameInput = document.getElementById('dev-edit-hostname');
      const ipInput = document.getElementById('dev-edit-ip');
      const macInput = document.getElementById('dev-edit-mac');
      const serialInput = document.getElementById('dev-edit-serial');
      const panelInput = document.getElementById('dev-edit-panel-label');

      const meta = {
        name: hostnameInput ? hostnameInput.value.trim() : '',
        ipAddress: ipInput ? ipInput.value.trim() : '',
        macAddress: macInput ? macInput.value.trim() : '',
        serialNumber: serialInput ? serialInput.value.trim() : '',
        panelLabel: panelInput ? panelInput.value.trim() : ''
      };

      if (modal.dataset.source === '2d') {
        event.stopImmediatePropagation();
        if (window.RackStudio && window.RackStudio.updateDeviceMetadata) {
          window.RackStudio.updateDeviceMetadata(devId, meta);
        }
      } else if (modal.dataset.source === '3d') {
        if (window.__STUDIO3D__ && window.__STUDIO3D__.updateDeviceMetadata) {
          window.__STUDIO3D__.updateDeviceMetadata(devId, meta);
          if (typeof window.renderInstalledDevicesList === 'function') window.renderInstalledDevicesList();
        }
      }
      modal.dataset.source = '';
      modal.style.display = 'none';
      if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
    }, true);

    document.getElementById('btn-close-device-edit')?.addEventListener('click', () => window.DeviceMetadataEditor.close());
    document.getElementById('btn-cancel-device-edit')?.addEventListener('click', () => window.DeviceMetadataEditor.close());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDeviceMetadataEvents);
  } else {
    bindDeviceMetadataEvents();
  }
})();
