/**
 * Cisco Enterprise 3D Rack Cabling Studio UI Binder - Main Coordinator
 */
import { initCameraControls } from './cameraControls.js';
import { initCatalogDrawer } from './catalogDrawer.js';
import { initDeviceHud } from './deviceHud.js';
import { initCableModals } from './cableModals.js';
import { initWizardModal } from './wizardModal.js';

(function () {
  'use strict';

  function initStudio3DUI() {
    const container = document.getElementById('studio3d-container');
    if (!container || !window.Studio3D) return;
    if (window.__STUDIO3D__) return;

    // Instantiate 3D Studio Engine
    const studio = new window.Studio3D(container);
    window.__STUDIO3D__ = studio;

    // Wire component controllers
    initCameraControls(studio);
    initCatalogDrawer(studio);
    initDeviceHud(studio);
    initCableModals(studio);
    initWizardModal(studio);

    // Presets
    // 11. Presets (MDF & IDF)
    const btnPresetMdf = document.getElementById('btn-3d-preset-mdf');
    if (btnPresetMdf) {
      btnPresetMdf.addEventListener('click', () => {
        if (confirm('MDF Omurga Şablonunu yüklemek istiyor musunuz? Mevcut tasarım sıfırlanacaktır.')) {
          studio.loadPresetMDF();
          studio.showToast('MDF Dağıtım Şablonu Yüklendi.');
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }

    const btnPresetIdf = document.getElementById('btn-3d-preset-idf');
    if (btnPresetIdf) {
      btnPresetIdf.addEventListener('click', () => {
        if (confirm('IDF Kat Kenar Şablonunu yüklemek istiyor musunuz?')) {
          studio.state.devices = [];
          studio.state.cables = [];
          studio.mountDevice('patch-cat6-48p', 38);
          studio.mountDevice('cisco-c9300-48p', 36);
          studio.mountDevice('cable-manager-1u', 35);
          studio.mountDevice('patch-cat6-48p', 33);
          studio.mountDevice('cisco-c9300-48p', 31);
          studio.mountDevice('pdu-1u-8c13', 2);
          studio.showToast('IDF Kat Kabini Şablonu Yüklendi.');
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }

    const btnPresetSite = document.getElementById('btn-3d-preset-site');
    if (btnPresetSite) {
      btnPresetSite.addEventListener('click', () => {
        if (confirm('Tüm Saha Topolojisini yüklemek istiyor musunuz? (3D kabinde MDF şablonu yüklenecektir)')) {
          studio.loadPresetMDF();
          studio.showToast('Saha Topolojisi Yüklendi. Çoklu kabin için 2D moduna geçebilirsiniz.');
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }


    // Undo / Redo, Storage & Shortcuts
    // 13. Undo / Redo
    const btnUndo = document.getElementById('btn-3d-undo');
    const btnRedo = document.getElementById('btn-3d-redo');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => {
        if (studio.state.undo()) {
          studio.buildRack(studio.state.rackHeightU);
          studio.rebuildAllDevices();
          studio.rebuildAllCables();
          studio.showToast('Geri Alındı (Undo)');
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }
    if (btnRedo) {
      btnRedo.addEventListener('click', () => {
        if (studio.state.redo()) {
          studio.buildRack(studio.state.rackHeightU);
          studio.rebuildAllDevices();
          studio.rebuildAllCables();
          studio.showToast('Yinelendi (Redo)');
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }

    // 14. JSON Export & Import
    const btnExportJson = document.getElementById('btn-export-json-3d');
    const btnImportJson = document.getElementById('btn-import-json-3d');
    const fileImport = document.getElementById('file-import-3d');

    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        const payload = {
          version: '3.1.0-3D',
          timestamp: new Date().toISOString(),
          rackHeightU: studio.state.rackHeightU,
          devices: studio.state.devices,
          cables: studio.state.cables
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cisco-rack-studio-3d-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        studio.showToast('3D Topoloji JSON Olarak Kaydedildi.');
      });
    }

    if (btnImportJson && fileImport) {
      btnImportJson.addEventListener('click', () => fileImport.click());
      fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data.devices) {
              studio.state.rackHeightU = data.rackHeightU || 42;
              studio.state.devices = data.devices || [];
              studio.state.cables = data.cables || [];
              studio.buildRack(studio.state.rackHeightU);
              studio.rebuildAllDevices();
              studio.rebuildAllCables();
              studio.state.pushSnapshot();
              renderCatalog(searchInput ? searchInput.value : '');
              studio.showToast('3D Topoloji Başarıyla Yüklendi!');
            }
          } catch (err) {
            alert('Geçersiz JSON Dosyası!');
          }
        };
        reader.readAsText(file);
      });
    }

    // 15. Keyboard Shortcuts (Only active when in 3D Mode to avoid duplicate events with 2D editor)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const wrapper3D = document.getElementById('studio3d-wrapper');
      const is3DActive = wrapper3D && wrapper3D.style.display !== 'none';
      if (!is3DActive) return;

      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) btnRedo && btnRedo.click();
        else btnUndo && btnUndo.click();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        btnRedo && btnRedo.click();
      } else if (e.key === '1') {
        document.getElementById('cam-iso')?.click();
      } else if (e.key === '2') {
        document.getElementById('cam-front')?.click();
      } else if (e.key === '3') {
        document.getElementById('cam-rear')?.click();
      } else if (e.key === '4') {
        document.getElementById('cam-top')?.click();
      } else if (e.key === '5') {
        document.getElementById('cam-focus')?.click();
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        btnDoor && btnDoor.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio3DUI);
  } else {
    initStudio3DUI();
  }
})();
