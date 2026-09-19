/**
 * Cisco Enterprise Rack & Cabling Studio - Unified Topbar, Telemetry & Action Routing
 */
(function () {
  'use strict';

  let _lastOverloadAlerted = false;

  function updateTelemetry() {
    let totalWatts = 0;
    let activeWatts = 0;
    const is3D = window.is3DMode;

    if (is3D && window.__STUDIO3D__) {
      const devs = window.__STUDIO3D__.state.devices || [];
      const activeRackId = window.__STUDIO3D__.state.activeRackId || 'rack-1';
      devs.forEach(d => {
        const cat3D = (window.CATALOG_3D || []).find(c => c.id === d.catalogId) || {};
        const cat2D = window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[d.catalogId];
        const cat = cat3D.powerWatts !== undefined ? cat3D : (cat2D || {});
        const w = (typeof d.powerWatts === 'number' && d.powerWatts > 0) ? d.powerWatts : (typeof cat.powerWatts === 'number' ? cat.powerWatts : (['organizer', 'blank', 'patch', 'passive', 'fiber'].includes(cat.category) ? 0 : 150));
        totalWatts += w;
        if ((d.rackId || 'rack-1') === activeRackId) {
          activeWatts += w;
        }
      });
    } else if (window.RackStudio && window.RackStudio.STATE) {
      const RS = window.RackStudio;
      const allRacks = RS.STATE.racks || [];
      const activeRack = RS.getActiveRack ? RS.getActiveRack() : allRacks[0];

      allRacks.forEach(rack => {
        (rack.devices || []).forEach(d => {
          const cat = (RS.catalog && RS.catalog[d.catalogId || d.catalogKey]) || (RS.HARDWARE_CATALOG && RS.HARDWARE_CATALOG[d.catalogKey]) || {};
          let w = 150;
          if (typeof cat.powerWatts === 'number') {
            w = cat.powerWatts;
          } else if (['organizer', 'blank', 'patch', 'passive', 'fiber'].includes(cat.category)) {
            w = 0;
          }
          totalWatts += w;
          if (activeRack && rack.id === activeRack.id) {
            activeWatts += w;
          }
        });
      });
    }

    const totalBtu = Math.round(totalWatts * 3.412142);
    const totalAmps = Number((totalWatts / (230 * 0.95)).toFixed(1));
    const totalKw = (totalWatts / 1000).toFixed(2);
    const isOverload = totalWatts > 3680 || totalAmps > 16.0;

    const powerValEl = document.getElementById('telemetry-power-val');
    const ampValEl = document.getElementById('telemetry-amp-val');
    const heatValEl = document.getElementById('telemetry-heat-val');
    const powerBadgeEl = document.querySelector('.telemetry-badge.power');
    const heatBadgeEl = document.querySelector('.telemetry-badge.heat');

    if (powerValEl) powerValEl.textContent = String(totalWatts);
    if (ampValEl) ampValEl.textContent = `(${totalAmps}A)`;
    if (heatValEl) heatValEl.textContent = String(totalBtu);

    if (powerBadgeEl) {
      powerBadgeEl.classList.toggle('overload', isOverload);
      if (isOverload) {
        powerBadgeEl.title = `⚠️ AŞIRI YÜK ALARMI! Toplam Güç: ${totalWatts}W (${totalAmps}A / ${totalKw}kW) - 16A PDU Sigorta Kapasitesi Aşıldı!`;
        if (window.SoundFX && !_lastOverloadAlerted) {
          window.SoundFX.playOverloadAlarm();
          _lastOverloadAlerted = true;
        }
      } else {
        _lastOverloadAlerted = false;
        const pduPercent = Math.min(100, Math.round((totalWatts / 3680) * 100));
        powerBadgeEl.title = `Veri Merkezi / Kabin Güç Tüketimi: ${totalWatts}W (${totalAmps}A / ${totalKw}kW) · PDU Yükü: %${pduPercent}`;
      }
    }

    if (heatBadgeEl) {
      heatBadgeEl.title = `Termal Isı Yayılımı: ${totalBtu} BTU/h (~${(totalWatts * 0.000293).toFixed(2)} Ton Soğutma) · Hot Aisle Yükü`;
    }

    if (window.RackStudio && typeof window.RackStudio.updateRackHeaderTelemetry === 'function') {
      window.RackStudio.updateRackHeaderTelemetry();
    }
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
        if (window.RackStudio?.loadMdfPreset) {
          window.RackStudio.loadMdfPreset();
        } else {
          document.getElementById('btn-preset-mdf')?.click();
        }
        updateTelemetry();
      }
    }, true);

    document.getElementById('btn-3d-preset-idf')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        if (window.RackStudio?.loadIdfPreset) {
          window.RackStudio.loadIdfPreset();
        } else {
          document.getElementById('btn-preset-idf')?.click();
        }
        updateTelemetry();
      }
    }, true);

    document.getElementById('btn-3d-preset-site')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        if (window.RackStudio?.loadFullSitePreset) {
          window.RackStudio.loadFullSitePreset();
        } else {
          document.getElementById('btn-preset-site')?.click();
        }
        updateTelemetry();
      }
    }, true);

    // 2D Reset / Clear Action
    document.getElementById('btn-2d-clear-action')?.addEventListener('click', (e) => {
      if (!window.is3DMode) {
        e.stopImmediatePropagation();
        document.getElementById('btn-clear-all')?.click();
      }
    }, true);

    // Snapshot Modal Action
    document.getElementById('btn-snapshot-modal')?.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      if (window.RackStudio?.openSnapshotModal) {
        window.RackStudio.openSnapshotModal();
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

    // Network Compliance Toggle (Loop Prevention & Standards)
    const btnCompliance = document.getElementById('btn-network-compliance');
    if (btnCompliance) {
      const updateComplianceBtn = () => {
        const active = window.RackStudio?.STATE ? (window.RackStudio.STATE.strictCompliance !== false) : true;
        btnCompliance.classList.toggle('active', active);
        btnCompliance.style.color = active ? '#38bdf8' : '#64748b';
        btnCompliance.title = active 
          ? 'Ağ Standartları & Döngü Koruması: AKTİF (Kural denetimi devrede)' 
          : 'Ağ Standartları & Döngü Koruması: PASİF (Serbest bağlantı modu)';
      };

      if (window.RackStudio?.STATE) {
        const saved = localStorage.getItem('rack-studio-strict-compliance');
        window.RackStudio.STATE.strictCompliance = saved === null ? true : (saved === 'true');
      }
      updateComplianceBtn();

      btnCompliance.addEventListener('click', () => {
        if (!window.RackStudio?.STATE) return;
        const current = window.RackStudio.STATE.strictCompliance !== false;
        window.RackStudio.STATE.strictCompliance = !current;
        localStorage.setItem('rack-studio-strict-compliance', String(!current));
        updateComplianceBtn();
        if (window.RackStudio.showTemporaryTooltip) {
          const rect = btnCompliance.getBoundingClientRect();
          window.RackStudio.showTemporaryTooltip(
            rect.left, 
            rect.bottom + 10, 
            !current ? 'Ağ Kural Denetimi: AÇIK' : 'Ağ Kural Denetimi: KAPALI (Serbest Mod)'
          );
        }
      });
    }

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
