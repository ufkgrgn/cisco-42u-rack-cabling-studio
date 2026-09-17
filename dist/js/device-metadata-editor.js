/**
 * Cisco Enterprise Rack & Cabling Studio - Device Metadata Editor (Hostname, IP, MAC, Serial, Panel Label)
 */
(function () {
  'use strict';

  window.DeviceMetadataEditor = {
    prepare(modal, dev, category, source, instanceId, cat) {
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

      if (!cat) {
        cat = (window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[dev.catalogKey]) ||
              (window.CATALOG_3D && window.CATALOG_3D.find(c => c.id === dev.catalogKey)) || {};
      }

      // Populate configured trunk/special ports list cleanly without duplicates
      this.activeDev = dev;
      this.activeCat = cat;
      this.activeSource = source;
      this.activeInstanceId = instanceId;
      this.renderConfiguredPortsList(dev, cat, source, instanceId);

      modal.dataset.source = source;
      modal.dataset.deviceId = instanceId;
      modal.dataset.deviceCategory = category || '';
      modal.style.display = 'flex';
    },

    renderConfiguredPortsList(dev, cat, source, instanceId) {
      const trunkListEl = document.getElementById('dev-edit-trunk-list');
      if (!trunkListEl) return;
      trunkListEl.innerHTML = '';

      const portsConfig = dev.portsConfig || {};
      // Proactively clean legacy bogus keys (e.g., 'pup_...')
      Object.keys(portsConfig).forEach(k => {
        if (k.startsWith('pup_')) delete portsConfig[k];
      });

      const configuredList = [];
      const seenKeys = new Set();
      const catalogPorts = (cat && Array.isArray(cat.ports)) ? cat.ports : (dev.portDefinitions || []);

      if (catalogPorts.length > 0) {
        catalogPorts.forEach((port, idx) => {
          const portId = port.id || `p${idx + 1}`;
          const isNumeric = /^p\d+$/i.test(String(portId)) || /^\d+$/.test(String(portId));
          const portNum = isNumeric ? String(portId).replace(/^p/i, '') : String(portId);
          const portIndex = idx + 1;
          const portName = port.name || `Port ${portIndex}`;

          const cfg = portsConfig[portId] ||
                      (port.name && portsConfig[port.name]) ||
                      portsConfig[portNum] ||
                      portsConfig[portIndex] ||
                      portsConfig['p' + portIndex];

          if (cfg) {
            const isConfigured = (cfg.role && cfg.role !== 'access') ||
              cfg.isTrunk || cfg.vlan || cfg.ciscoName || cfg.description ||
              (cfg.color && cfg.color !== '#38bdf8' && cfg.color !== '#3b82f6') ||
              (cfg.poeState && cfg.poeState !== 'auto');

            if (isConfigured) {
              seenKeys.add(String(portId).toLowerCase());
              if (port.name) seenKeys.add(String(port.name).toLowerCase());
              if (isNumeric) {
                seenKeys.add(String(portNum).toLowerCase());
                seenKeys.add(String(portIndex));
                seenKeys.add('p' + portIndex);
              }

              const speedInfo = port.speed ? port.speed : (port.type === 'sfp' ? '1G SFP' : '');
              configuredList.push({
                portId: portId,
                displayName: portName,
                portType: port.type || 'rj45',
                speedInfo: speedInfo,
                config: cfg
              });
            }
          }
        });
      }

      // Fallback for custom devices or non-catalog ports
      Object.keys(portsConfig).forEach(pKey => {
        const normKey = String(pKey).toLowerCase();
        if (seenKeys.has(normKey) || normKey.startsWith('pup_')) return;
        const cfg = portsConfig[pKey];
        if (!cfg) return;

        const isConfigured = (cfg.role && cfg.role !== 'access') ||
          cfg.isTrunk || cfg.vlan || cfg.ciscoName || cfg.description ||
          (cfg.color && cfg.color !== '#38bdf8' && cfg.color !== '#3b82f6') ||
          (cfg.poeState && cfg.poeState !== 'auto');
        if (!isConfigured) return;

        seenKeys.add(normKey);
        const isNum = /^p\d+$/i.test(normKey) || /^\d+$/.test(normKey);
        if (isNum) {
          const n = normKey.replace(/^p/i, '');
          seenKeys.add(n);
          seenKeys.add('p' + n);
        }
        if (cfg.ciscoName) seenKeys.add(String(cfg.ciscoName).toLowerCase());

        configuredList.push({
          portId: pKey,
          displayName: cfg.ciscoName || `Port #${pKey}`,
          portType: 'rj45',
          speedInfo: '',
          config: cfg
        });
      });

      if (configuredList.length === 0) {
        trunkListEl.innerHTML = '<div style="color:#64748b; font-style:italic;">Henüz özel/trunk port yapılandırılmadı.</div>';
      } else {
        configuredList.forEach(item => {
          const cfg = item.config;
          const role = (cfg.role || (cfg.isTrunk ? 'trunk' : 'custom')).toUpperCase();
          const vlanPart = cfg.vlan ? ` · VLAN: ${cfg.vlan}` : '';
          const speedPart = item.speedInfo ? ` · ${item.speedInfo}` : '';
          const ciscoCustom = (cfg.ciscoName && cfg.ciscoName !== item.displayName) ? ` (${cfg.ciscoName})` : '';

          const row = document.createElement('div');
          row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(30,41,59,0.85); border-radius:4px; padding:4px 8px; border-left:3px solid ' + (cfg.color || '#a855f7');
          row.innerHTML = `
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;">
              <span style="font-weight:700; color:${cfg.color || '#a855f7'};">${item.displayName}${ciscoCustom}</span>
              <span style="color:#94a3b8; font-size:11px;">[${role}]${vlanPart}${speedPart}</span>
            </div>
            <button type="button" class="hud-btn" style="padding:2px 8px; font-size:10px; white-space:nowrap;" data-port="${item.portId}">Düzenle</button>
          `;
          row.querySelector('button')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.PortConfigEditor?.open(instanceId, item.portId, source);
          });
          trunkListEl.appendChild(row);
        });
      }
    },

    open2D(instanceId) {
      const racks = (window.RackStudio && window.RackStudio.STATE.racks) || [];
      const rack = racks.find(item => item.devices.some(dev => dev.instanceId === instanceId));
      const dev = rack && rack.devices.find(item => item.instanceId === instanceId);
      if (!dev) return;
      const modal = document.getElementById('modal-device-edit');
      if (!modal) return;
      const cat = (window.RackStudio.catalog && window.RackStudio.catalog[dev.catalogKey]) || {};
      this.prepare(modal, { ...dev, name: dev.name || cat.name }, cat.category, '2d', instanceId, cat);
    },

    open3D(instanceId) {
      if (!window.__STUDIO3D__) return;
      const dev = window.__STUDIO3D__.state.devices.find(d => d.id === instanceId);
      if (!dev) return;
      const modal = document.getElementById('modal-device-edit');
      if (!modal) return;
      const cat = (window.CATALOG_3D || []).find(c => c.id === dev.catalogKey) ||
                  (window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[dev.catalogKey]) || {};
      this.prepare(modal, dev, dev.category, '3d', instanceId, cat);
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

    function handleStudioRefresh() {
      const modal = document.getElementById('modal-device-edit');
      if (!modal || modal.style.display === 'none' || !modal.dataset.deviceId) return;
      const devId = modal.dataset.deviceId;
      const source = modal.dataset.source || '2d';
      if (source === '2d' && window.RackStudio?.STATE?.racks) {
        let dev = null;
        for (const r of window.RackStudio.STATE.racks) {
          const d = r.devices?.find(x => x.instanceId === devId);
          if (d) { dev = d; break; }
        }
        if (dev) {
          const cat = (window.RackStudio.catalog && window.RackStudio.catalog[dev.catalogKey]) || {};
          window.DeviceMetadataEditor.renderConfiguredPortsList(dev, cat, source, devId);
        }
      } else if (source === '3d' && window.__STUDIO3D__) {
        const dev = window.__STUDIO3D__.state.devices.find(d => d.id === devId);
        if (dev) {
          const cat = (window.CATALOG_3D || []).find(c => c.id === dev.catalogKey) || {};
          window.DeviceMetadataEditor.renderConfiguredPortsList(dev, cat, source, devId);
        }
      }
    }

    document.addEventListener('rackstudio:change', handleStudioRefresh);
    document.addEventListener('rackstudio:refresh', handleStudioRefresh);
    window.addEventListener('rackstudio:refresh', handleStudioRefresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDeviceMetadataEvents);
  } else {
    bindDeviceMetadataEvents();
  }
})();
