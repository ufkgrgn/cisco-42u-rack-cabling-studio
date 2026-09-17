/**
 * Cisco Enterprise Rack & Cabling Studio - Unified Topbar, Telemetry & Action Routing
 */
(function () {
  'use strict';

  function updateTelemetry() {
    let totalWatts = 0;
    const is3D = window.is3DMode;

    if (is3D && window.__STUDIO3D__) {
      const devs = window.__STUDIO3D__.state.devices || [];
      devs.forEach(d => {
        const cat = (window.CATALOG_3D || []).find(c => c.id === d.catalogId) || {};
        totalWatts += d.powerWatts || cat.powerWatts || 150;
      });
    } else if (window.RackStudio && window.RackStudio.STATE) {
      const rack = window.RackStudio.STATE.racks && window.RackStudio.STATE.racks[0];
      if (rack && rack.devices) {
        rack.devices.forEach(d => {
          const cat = window.RackStudio.catalog && window.RackStudio.catalog[d.catalogId || d.catalogKey];
          totalWatts += (cat && cat.powerWatts) || 150;
        });
      }
    }

    const totalBtu = Math.round(totalWatts * 3.412142);
    const powerValEl = document.getElementById('telemetry-power-val');
    const heatValEl = document.getElementById('telemetry-heat-val');
    if (powerValEl) powerValEl.textContent = String(totalWatts);
    if (heatValEl) heatValEl.textContent = String(totalBtu);
  }
  window.updateTelemetry = updateTelemetry;

  window.handleUnifiedVisioExport = () => {
    if (window.is3DMode && typeof window.sync3Dto2D === 'function') {
      window.sync3Dto2D();
    }
    window.RackStudio?.exportVisioSvg();
  };

  function initTopbar() {
    const deviceLabelModeEl = document.getElementById('device-label-mode');
    if (deviceLabelModeEl) {
      deviceLabelModeEl.value = localStorage.getItem('rack-studio-device-label-mode') || 'name';
      deviceLabelModeEl.addEventListener('change', () => {
        const mode = deviceLabelModeEl.value;
        if (window.__STUDIO3D__) window.__STUDIO3D__.setDeviceLabelMode(mode);
        if (window.RackStudio) window.RackStudio.setDeviceLabelMode(mode);
      });
    }

    const performanceModeEl = document.getElementById('performance-mode');
    if (performanceModeEl) {
      performanceModeEl.value = localStorage.getItem('rack-studio-3d-performance-mode') || 'balanced';
      performanceModeEl.addEventListener('change', () => {
        if (window.__STUDIO3D__) window.__STUDIO3D__.setPerformanceMode(performanceModeEl.value);
      });
    }

    // Unified Presets in 2D Mode
    document.getElementById('btn-3d-preset-mdf')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('btn-preset-mdf')?.click();
        updateTelemetry();
      }
    }, true);

    document.getElementById('btn-3d-preset-idf')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('btn-preset-idf')?.click();
        updateTelemetry();
      }
    }, true);

    document.getElementById('btn-3d-preset-site')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('btn-preset-site')?.click();
        updateTelemetry();
      }
    }, true);

    // Unified Storage Actions in 2D Mode
    document.getElementById('btn-export-json-3d')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('btn-export-json')?.click();
      }
    }, true);

    document.getElementById('btn-import-json-3d')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('file-import')?.click();
      }
    }, true);

    // Unified History (Undo/Redo) in 2D Mode
    document.getElementById('btn-3d-undo')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.querySelector('[data-command="undo"]')?.click();
      }
    }, true);

    document.getElementById('btn-3d-redo')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.querySelector('[data-command="redo"]')?.click();
      }
    }, true);

    // Periodically refresh telemetry
    setInterval(updateTelemetry, 1500);
    updateTelemetry();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTopbar);
  } else {
    initTopbar();
  }
})();
