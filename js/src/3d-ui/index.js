/**
 * Cisco Enterprise 3D Rack Cabling Studio UI Binder - Main Coordinator
 */
import { initCameraControls } from './cameraControls.js';
import { initCatalogDrawer } from './catalogDrawer.js';
import { initDeviceHud } from './deviceHud.js';
import { initCableModals } from './cableModals.js';
import { initWizardModal } from './wizardModal.js';
import { initProjectFileControls } from './project-file-controls.js';
import { initWorkflowSelection } from './workflow-selection.js';

(function () {
  'use strict';

  function initStudio3DUI() {
    const container = document.getElementById('studio3d-container');
    if (!container || !window.Studio3D) return;
    if (window.__STUDIO3D__) return;

    // Instantiate 3D Studio Engine
    const studio = new window.Studio3D(container);
    window.__STUDIO3D__ = studio;
    initWorkflowSelection(studio);

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
          try { if (studio.loadPresetMDF() === false) return; }
          catch (error) { studio.showToast(error.message); return; }
          studio.showToast('MDF Dağıtım Şablonu Yüklendi.');
          window.renderCatalog?.();
        }
      });
    }

    const btnPresetIdf = document.getElementById('btn-3d-preset-idf');
    if (btnPresetIdf) {
      btnPresetIdf.addEventListener('click', () => {
        if (confirm('IDF Kat Kenar Şablonunu yüklemek istiyor musunuz?')) {
          try {
            if (studio.runProjectEdit(() => {
              studio.state.devices = [];
              studio.state.cables = [];
              if (!studio.mountDevice('patch-cat6-48p', 38)) throw new Error('Şablon için yeterli kabin alanı yok.');
              if (!studio.mountDevice('cisco-c9300-48p', 36)) throw new Error('Şablon için yeterli kabin alanı yok.');
              if (!studio.mountDevice('cable-manager-1u', 35)) throw new Error('Şablon için yeterli kabin alanı yok.');
              if (!studio.mountDevice('patch-cat6-48p', 33)) throw new Error('Şablon için yeterli kabin alanı yok.');
              if (!studio.mountDevice('cisco-c9300-48p', 31)) throw new Error('Şablon için yeterli kabin alanı yok.');
              if (!studio.mountDevice('pdu-1u-8c13', 2)) throw new Error('Şablon için yeterli kabin alanı yok.');
              return true;
            }) === false) return;
          } catch (error) { studio.showToast(error.message); return; }
          studio.showToast('IDF Kat Kabini Şablonu Yüklendi.');
          window.renderCatalog?.();
        }
      });
    }

    const btnPresetSite = document.getElementById('btn-3d-preset-site');
    if (btnPresetSite) {
      btnPresetSite.addEventListener('click', () => {
        if (confirm('Tüm Saha Topolojisini yüklemek istiyor musunuz? (3D kabinde MDF şablonu yüklenecektir)')) {
          try { if (studio.loadPresetMDF() === false) return; }
          catch (error) { studio.showToast(error.message); return; }
          studio.showToast('Saha Topolojisi Yüklendi. Çoklu kabin için 2D moduna geçebilirsiniz.');
          window.renderCatalog?.();
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
          window.renderCatalog?.();
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
          window.renderCatalog?.();
        }
      });
    }

    initProjectFileControls(studio);

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
        document.getElementById('btn-door-toggle')?.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio3DUI);
  } else {
    initStudio3DUI();
  }
})();
