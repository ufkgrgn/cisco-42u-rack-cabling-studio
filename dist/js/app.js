import { STATE, ZOOM_STATE, dom, initDomReferences } from './state.js';
import { HARDWARE_CATALOG } from './catalog.js';
import { renderRackRailsAndSlots, renderMountedDevices, mountDeviceAt } from './rack.js';
import { renderAllCables, cancelPendingConnection, addDirectCable } from './cabling.js';
import { fitRackToScreen, setZoom, bindZoomAndPanEvents } from './zoom.js';
import { renderScheduleTable } from './schedule.js';
import { exportVisioSvg, exportJson, loadCustomTopology } from './export.js';

function init() {
  initDomReferences();
  renderRackRailsAndSlots(handleSlotClick);
  bindCatalogEvents();
  bindColorSwatchEvents();
  bindHeaderActionEvents();
  bindRoutingSelectorEvents();
  bindGlobalEvents();
  bindZoomAndPanEvents();
  loadEnterprisePreset();

  // Auto-fit 42U rack vertically without page scrollbars
  requestAnimationFrame(() => {
    fitRackToScreen(false);
  });
}

function handleSlotClick(targetU, e) {
  if (!STATE.selectedLibraryItem) {
    showTemporaryTooltip(e.clientX, e.clientY, "Lütfen önce sol menüden monte edilecek bir donanım seçin!");
    return;
  }

  const catalogItem = HARDWARE_CATALOG[STATE.selectedLibraryItem];
  const requiredU = catalogItem.u;
  const startU = targetU;
  const endU = targetU - requiredU + 1;

  if (endU < 1) {
    alert(`Bu cihaz ${requiredU}U yüksekliğinde. U${targetU} seviyesine sığmıyor.`);
    return;
  }

  for (let u = endU; u <= startU; u++) {
    if (STATE.rackUnits[u] !== null) {
      alert(`U${u} pozisyonu dolu! Lütfen boş bir slot seçin.`);
      return;
    }
  }

  mountDeviceAt(STATE.selectedLibraryItem, startU);
  renderMountedDevices();
  renderAllCables();
}

function bindCatalogEvents() {
  const cards = document.querySelectorAll('.device-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
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
        if (dom.statusSelectionText) {
          dom.statusSelectionText.textContent = `Seçili: [${item.name}] (${item.u}U). Yerleştirmek için kabin üzerinde boş bir U yuvasına tıklayın.`;
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

function bindHeaderActionEvents() {
  if (dom.btnClearAll) {
    dom.btnClearAll.addEventListener('click', () => {
      if (confirm("Kabin içindeki tüm cihazlar ve kablolar silinecektir. Onaylıyor musunuz?")) {
        STATE.rackUnits = Array(43).fill(null);
        STATE.devices = [];
        STATE.cables = [];
        STATE.highlightedCableId = null;
        cancelPendingConnection();
        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();
      }
    });
  }

  if (dom.btnClearCables) {
    dom.btnClearCables.addEventListener('click', () => {
      if (confirm("Yalnızca çekilmiş tüm kabloları silmek istiyor musunuz?")) {
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
    dom.btnExportJson.addEventListener('click', () => {
      exportJson();
    });
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
          if (!parsed.devices || !parsed.cables) throw new Error("Geçersiz topoloji JSON yapısı!");
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
    dom.btnExportVisio.addEventListener('click', () => {
      exportVisioSvg();
    });
  }

  if (dom.btnLoadPreset) {
    dom.btnLoadPreset.addEventListener('click', () => {
      loadEnterprisePreset();
    });
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

export function loadEnterprisePreset() {
  STATE.rackUnits = Array(43).fill(null);
  STATE.devices = [];
  STATE.cables = [];
  STATE.highlightedCableId = null;

  mountDeviceAt('fiber-odf-24', 42);
  mountDeviceAt('organizer-1u', 41);
  mountDeviceAt('cisco-nexus-93180yc', 40);
  mountDeviceAt('organizer-2u', 38);
  mountDeviceAt('cisco-9300-48u', 36);
  mountDeviceAt('patch-cat6-24', 35);
  mountDeviceAt('organizer-1u', 34);
  mountDeviceAt('cisco-3850-48p', 33);
  mountDeviceAt('patch-cat6-48', 32);
  mountDeviceAt('cisco-2960x-24', 20);
  mountDeviceAt('patch-cat6-24', 19);

  renderMountedDevices();

  const devODF = STATE.devices.find(d => d.topU === 42);
  const devNexus = STATE.devices.find(d => d.topU === 40);
  const devCat9300 = STATE.devices.find(d => d.topU === 36);
  const devPatch35 = STATE.devices.find(d => d.topU === 35);
  const devCat3850 = STATE.devices.find(d => d.topU === 33);
  const devPatch32 = STATE.devices.find(d => d.topU === 32);

  if (devODF && devNexus) {
    addDirectCable(devODF.instanceId, 'lc1', devNexus.instanceId, 'eth1_49', '#06b6d4', 1.2);
    addDirectCable(devODF.instanceId, 'lc2', devNexus.instanceId, 'eth1_50', '#06b6d4', 1.2);
  }

  if (devNexus && devCat9300) {
    addDirectCable(devNexus.instanceId, 'eth1_1', devCat9300.instanceId, 'up1', '#ef4444', 2.4);
    addDirectCable(devNexus.instanceId, 'eth1_2', devCat9300.instanceId, 'up2', '#ef4444', 2.4);
  }

  if (devPatch35 && devCat9300) {
    addDirectCable(devPatch35.instanceId, 'pt1', devCat9300.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(devPatch35.instanceId, 'pt2', devCat9300.instanceId, 'p2', '#2563eb', 0.3);
    addDirectCable(devPatch35.instanceId, 'pt3', devCat9300.instanceId, 'p3', '#eab308', 0.3);
    addDirectCable(devPatch35.instanceId, 'pt4', devCat9300.instanceId, 'p4', '#22c55e', 0.3);
  }

  if (devPatch32 && devCat3850) {
    addDirectCable(devPatch32.instanceId, 'pt1', devCat3850.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(devPatch32.instanceId, 'pt2', devCat3850.instanceId, 'p2', '#2563eb', 0.3);
    addDirectCable(devPatch32.instanceId, 'pt3', devCat3850.instanceId, 'p3', '#eab308', 0.3);
  }

  renderScheduleTable();
  setTimeout(renderAllCables, 50);
}

function showTemporaryTooltip(x, y, msg) {
  if (!dom.tooltip) return;
  dom.tooltip.style.display = 'block';
  dom.tooltip.style.left = `${x + 10}px`;
  dom.tooltip.style.top = `${y + 10}px`;
  dom.tooltip.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
  setTimeout(() => { dom.tooltip.style.display = 'none'; }, 2500);
}

window.addEventListener('DOMContentLoaded', init);
