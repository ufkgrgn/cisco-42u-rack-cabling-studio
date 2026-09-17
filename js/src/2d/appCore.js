/**
 * Cisco Enterprise 42U Rack & Cabling Studio - Application Main Coordinator
 */
import { HARDWARE_CATALOG } from './catalogData.js';
import { STATE, ZOOM_STATE, dom, initDomReferences } from './state.js';
import { renderRackTabs, switchActiveRack, addNewRack } from './rackManager.js';
import { 
  renderAllCables, cancelPendingConnection, addDirectCable, 
  highlightCable, disconnectCable, showCableQuickHud, hideCableQuickHud,
  highlightDropSlots 
} from './cablingEngine.js';
import { 
  getActiveRack, renderRackRailsAndSlots, renderMountedDevices, 
  mountDeviceAt, removeDevice, updateDeviceMetadata 
} from './rackRenderer.js';
import { fitRackToScreen, setZoom, bindZoomAndPanEvents } from './zoomManager.js';
import { renderScheduleTable, setConnectionRole } from './scheduleTable.js';
import { exportVisioSvg, exportJson, validateTopology, refresh, loadCustomTopology } from './topologyIO.js';
import { loadMdfPreset, loadIdfPreset, loadFullSitePreset } from './presets.js';

// --- APPLICATION MAIN WORKFLOW ---
  function init() {
    initDomReferences();
    renderRackRailsAndSlots(handleSlotClick);
    bindCatalogEvents();
    bindColorSwatchEvents();
    bindHeaderActionEvents();
    bindRoutingSelectorEvents();
    bindGlobalEvents();
    bindZoomAndPanEvents();
    loadMdfPreset();

    requestAnimationFrame(() => {
      fitRackToScreen(false);
    });
  }

  function mountDeviceFromAction(catalogKey, targetU, e, targetRackId) {
    if (!catalogKey) return false;
    const catalogItem = HARDWARE_CATALOG[catalogKey];
    if (!catalogItem) return false;
    const requiredU = catalogItem.u;
    const startU = targetU;
    const endU = targetU - requiredU + 1;

    if (endU < 1) {
      alert(`Bu cihaz ${requiredU}U yüksekliğinde. U${targetU} seviyesine sığmıyor.`);
      return false;
    }

    const targetRack = targetRackId ? STATE.racks.find(r => r.id === targetRackId) : getActiveRack();
    if (!targetRack) return false;

    for (let u = endU; u <= startU; u++) {
      if (targetRack.units[u] !== null) {
        alert(`U${u} pozisyonu dolu! Lütfen boş bir slot seçin.`);
        return false;
      }
    }

    const mounted = mountDeviceAt(catalogKey, startU, targetRackId);
    renderRackTabs();
    renderMountedDevices();
    renderAllCables();
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    }
    return !!mounted;
  }
  // Expose for drop handlers in renderRackRailsAndSlots
  window.mountDeviceFromAction = mountDeviceFromAction;

  function handleSlotDoubleClick(targetU, e, targetRackId) {
    if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
    if (!STATE.selectedLibraryItem) {
      showTemporaryTooltip(e.clientX, e.clientY, "Lütfen önce sol menüden monte edilecek bir donanım seçin veya sürükleyin!");
      return;
    }
    mountDeviceFromAction(STATE.selectedLibraryItem, targetU, e, targetRackId);
  }
  const handleSlotClick = handleSlotDoubleClick;

  function bindCatalogEvents() {
    const cards = document.querySelectorAll('.device-card');
    cards.forEach(card => {
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', (e) => {
        const devId = card.dataset.deviceId;
        if (!devId) return;
        window.__RACK_DRAGGED_DEVICE__ = devId;
        e.dataTransfer.setData('text/plain', devId);
        e.dataTransfer.setData('application/x-rack-device', devId);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        window.__RACK_DRAGGED_DEVICE__ = null;
        highlightDropSlots(null, null, false);
      });
      card.addEventListener('click', () => {
        document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active')); 
        const devId = card.dataset.deviceId;
        if (STATE.selectedLibraryItem === devId) {
          STATE.selectedLibraryItem = null;
          if (dom.statusSelectionText) {
            dom.statusSelectionText.textContent = 'Kütüphaneden bir donanım seçin veya kablolama yapın.';
          }
        } else {
          card.classList.add('active');
          STATE.selectedLibraryItem = devId;
          const item = HARDWARE_CATALOG[devId];
          if (dom.statusSelectionText && item) {
            dom.statusSelectionText.textContent = `Seçili: [${item.name}] (${item.u}U). Yerleştirmek için boş bir U yuvasına ÇİFT TIKLAYIN veya sürükleyip bırakın.`;
          }
        }
      });
    });
  }

  function bindColorSwatchEvents() {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        STATE.selectedCableColor = swatch.dataset.color;
      });
    });
  }

  function bindRoutingSelectorEvents() {
    if (dom.btnRouteStructured && dom.btnRouteDirect) {
      dom.btnRouteStructured.addEventListener('click', () => {
        dom.btnRouteStructured.classList.add('active');
        dom.btnRouteDirect.classList.remove('active');
        STATE.cableRoutingMode = 'structured';
        renderAllCables();
      });

      dom.btnRouteDirect.addEventListener('click', () => {
        dom.btnRouteDirect.classList.add('active');
        dom.btnRouteStructured.classList.remove('active');
        STATE.cableRoutingMode = 'direct';
        renderAllCables();
      });
    }

    if (dom.btnTidyCables) {
      dom.btnTidyCables.addEventListener('click', () => {
        renderAllCables();
        const orig = dom.btnTidyCables.textContent;
        dom.btnTidyCables.textContent = '✓ Düzenlendi';
        dom.btnTidyCables.style.color = '#22c55e';
        setTimeout(() => {
          dom.btnTidyCables.textContent = orig;
          dom.btnTidyCables.style.color = '';
        }, 1200);
      });
    }
  }

  function setViewMode(mode) {
    STATE.viewMode = mode;
    dom.btnViewModeSingle?.classList.toggle('active', mode === 'single');
    dom.btnViewModeMulti?.classList.toggle('active', mode === 'multi');
    renderRackRailsAndSlots(handleSlotClick);
    renderMountedDevices();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
  }

  function bindHeaderActionEvents() {
    if (dom.btnAddRack) {
      dom.btnAddRack.addEventListener('click', () => {
        const name = prompt("Yeni Kabin Adı (Örn: IDF-2 Kat 2):");
        if (name && name.trim()) {
          addNewRack(name.trim());
        }
      });
    }

    if (dom.btnRenameRack) {
      dom.btnRenameRack.addEventListener('click', () => renameActiveRack());
    }

    if (dom.btnViewModeSingle) {
      dom.btnViewModeSingle.addEventListener('click', () => setViewMode('single'));
    }
    if (dom.btnViewModeMulti) {
      dom.btnViewModeMulti.addEventListener('click', () => setViewMode('multi'));
    }

    if (dom.btnPresetMdf) {
      dom.btnPresetMdf.addEventListener('click', () => {
        if (confirm("MDF Ana Dağıtım Kabini şablonu yüklensin mi? (Mevcut topoloji sıfırlanır)")) {
          loadMdfPreset();
        }
      });
    }

    if (dom.btnPresetIdf) {
      dom.btnPresetIdf.addEventListener('click', () => {
        if (confirm("IDF Kat Kenar Kabini şablonu yüklensin mi? (Mevcut topoloji sıfırlanır)")) {
          loadIdfPreset();
        }
      });
    }

    if (dom.btnPresetSite) {
      dom.btnPresetSite.addEventListener('click', () => {
        if (confirm("Tüm Saha Topolojisi (MDF + IDF-1 + IDF-2 Çoklu Kabin) yüklensin mi?")) {
          loadFullSitePreset();
        }
      });
    }

    if (dom.btnClearAll) {
      dom.btnClearAll.addEventListener('click', () => {
        if (confirm("Tüm kabinler, cihazlar ve kablolar sıfırlanacaktır. Onaylıyor musunuz?")) {
          STATE.racks = [
            { id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] }
          ];
          STATE.activeRackId = 'rack-1';
          STATE.cables = [];
          STATE.cableCounter = 0;
          STATE.rackCounter = 1;
          STATE.highlightedCableId = null;
          cancelPendingConnection();
          renderRackTabs();
          renderMountedDevices();
          renderScheduleTable();
          renderAllCables();
        }
      });
    }

    if (dom.btnClearCables) {
      dom.btnClearCables.addEventListener('click', () => {
        if (confirm("Tüm kabloları silmek istiyor musunuz?")) {
          STATE.cables = [];
          STATE.highlightedCableId = null;
          cancelPendingConnection();
          renderMountedDevices();
          renderScheduleTable();
          renderAllCables();
        }
      });
    }

    if (dom.btnExportJson) {
      dom.btnExportJson.addEventListener('click', () => exportJson());
    }

    if (dom.btnImportJson) {
      dom.btnImportJson.addEventListener('click', () => {
        if (dom.fileImport) dom.fileImport.click();
      });
    }

    if (dom.fileImport) {
      dom.fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            loadCustomTopology(parsed);
          } catch (err) {
            alert("JSON dosyası okunurken hata oluştu: " + err.message);
          }
        };
        reader.readAsText(file);
        dom.fileImport.value = '';
      });
    }

    if (dom.btnExportVisio) {
      dom.btnExportVisio.addEventListener('click', () => exportVisioSvg());
    }
  }

  function bindGlobalEvents() {
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.port')) {
        cancelPendingConnection();
      }
    });

    window.addEventListener('resize', () => {
      if (ZOOM_STATE.isFit) {
        fitRackToScreen(false);
      }
      renderAllCables();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') {
        setZoom(ZOOM_STATE.scale * 1.2, undefined, undefined, true);
      } else if (e.key === '-' || e.key === '_') {
        setZoom(ZOOM_STATE.scale / 1.2, undefined, undefined, true);
      } else if (e.key === '0') {
        setZoom(1.0, undefined, undefined, true);
      } else if (e.key === 'f' || e.key === 'F') {
        fitRackToScreen(true);
      } else if (e.key === 'Escape') {
        cancelPendingConnection();
      }
    });
  }

  function showTemporaryTooltip(x, y, msg) {
    if (!dom.tooltip) return;
    dom.tooltip.style.display = 'block';
    dom.tooltip.style.left = `${x + 10}px`;
    dom.tooltip.style.top = `${y + 10}px`;
    dom.tooltip.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
    setTimeout(() => { if (dom.tooltip) dom.tooltip.style.display = 'none'; }, 2500);
  }

  function updatePortConfig(instanceId, portId, config) {
    const activeRack = getActiveRack();
    if (!activeRack) return false;
    const dev = activeRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return false;
    if (!dev.portsConfig) dev.portsConfig = {};
    if (!config || (config.role === 'access' && !config.ciscoName && !config.vlan && !config.description && !config.color)) {
      delete dev.portsConfig[portId];
      delete dev.portsConfig[String(portId).replace('p', '')];
    } else {
      const role = config.role || 'trunk';
      const defaultRoleColors = {
        trunk: '#a855f7',
        uplink: '#00d2ff',
        poe: '#f59e0b',
        mgmt: '#10b981',
        management: '#10b981',
        access: '#3b82f6'
      };
      const resolvedColor = config.color || defaultRoleColors[role] || '#a855f7';
      dev.portsConfig[portId] = {
        role: role,
        isTrunk: role === 'trunk' || config.isTrunk === true,
        color: resolvedColor,
        ciscoName: config.ciscoName || '',
        vlan: config.vlan || '',
        description: config.description || '',
        autoCableColor: config.autoCableColor !== false
      };
      dev.portsConfig[String(portId).replace('p', '')] = dev.portsConfig[portId];

      if (config.autoCableColor !== false) {
        const connectedCable = STATE.cables.find(c =>
          (c.from.instanceId === instanceId && (c.from.portId === portId || String(c.from.portId).replace('p','') === String(portId).replace('p',''))) ||
          (c.to.instanceId === instanceId && (c.to.portId === portId || String(c.to.portId).replace('p','') === String(portId).replace('p','')))
        );
        if (connectedCable) {
          connectedCable.color = resolvedColor;
          connectedCable.role = role;
          if (role === 'trunk' && !connectedCable.name.startsWith('[TRUNK]')) {
            connectedCable.name = `[TRUNK] ${connectedCable.id}`;
          } else if (role !== 'trunk') {
            connectedCable.name = (connectedCable.name || '').replace(/^\[TRUNK\]\s*/i, '');
          }
          const otherEndpoint = (connectedCable.from.instanceId === instanceId) ? connectedCable.to : connectedCable.from;
          let otherDev = null;
          (STATE.racks || []).forEach(r => {
            if (!otherDev) otherDev = r.devices?.find(d => d.instanceId === otherEndpoint.instanceId);
          });
          if (otherDev) {
            if (!otherDev.portsConfig) otherDev.portsConfig = {};
            otherDev.portsConfig[otherEndpoint.portId] = {
              role: role,
              isTrunk: role === 'trunk' || config.isTrunk === true,
              color: resolvedColor,
              autoCableColor: true
            };
            otherDev.portsConfig[String(otherEndpoint.portId).replace('p','')] = otherDev.portsConfig[otherEndpoint.portId];
          }
        }
      }
    }
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return true;
  }

  window.RackStudio = {
    STATE,
    catalog: HARDWARE_CATALOG,
    getActiveRack,
    refresh,
    renderAllCables,
    renderMountedDevices,
    renderScheduleTable,
    setConnectionRole,
    fit: fitRackToScreen,
    mountDeviceAt,
    mountDeviceFromAction,
    setViewMode,
    loadCustomTopology,
    validateTopology,
    exportJson,
    exportVisioSvg,
    switchActiveRack,
    addNewRack,
    removeDevice,
    updateDeviceMetadata,
    updatePortConfig,
    highlightCable,
    disconnectCable,
    showCableQuickHud,
    hideCableQuickHud
  };

  // Automatic init on DOM ready or immediate if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
