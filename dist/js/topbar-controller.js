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
    updateInstrumentStatus();
  }

  function updateInstrumentStatus() {
    const RS = window.RackStudio;
    const rack = RS?.getActiveRack ? RS.getActiveRack() : RS?.STATE?.racks?.[0];
    const height = rack?.heightU || 42;
    let used = 0;
    (rack?.devices || []).forEach(d => {
      const span = Number(d.uHeight) || 1;
      if (span > 0) used += span;
    });
    const free = Math.max(0, height - used);
    const cables = (RS?.STATE?.cables || []).length;
    const name = rack?.name || 'Kabin';
    const shortName = name.split(' - ')[0] || name;

    const uUsed = document.getElementById('header-u-used');
    const rackName = document.getElementById('status-rack-name');
    const freeU = document.getElementById('status-free-u');
    const cableCount = document.getElementById('status-cable-count');
    const zoomEl = document.getElementById('status-zoom');
    const modeLabel = document.getElementById('status-mode-label');
    const modeDot = document.getElementById('status-mode-dot');
    const zoomBadge = document.getElementById('zoom-badge');

    if (uUsed) uUsed.textContent = `${used} / ${height}U`;
    if (rackName) rackName.textContent = shortName;
    if (freeU) freeU.textContent = `${free}U boş`;
    if (cableCount) cableCount.textContent = `${cables} kablo`;
    if (zoomEl && zoomBadge) zoomEl.textContent = zoomBadge.textContent || '100%';

    const pending = RS?.STATE?.pendingConnection;
    if (modeLabel && modeDot) {
      modeDot.classList.remove('is-ready', 'is-connect', 'is-blocked');
      if (pending) {
        modeLabel.textContent = 'Hedef port';
        modeDot.classList.add('is-connect');
      } else {
        modeLabel.textContent = 'Hazır';
        modeDot.classList.add('is-ready');
      }
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
    document.getElementById('btn-export-visio')?.addEventListener('click', window.handleUnifiedVisioExport);
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
      e.stopImmediatePropagation();
      document.getElementById('btn-clear-all')?.click();
      if (window.is3DMode && typeof window.sync2Dto3D === 'function') {
        window.sync2Dto3D();
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
        btnCompliance.classList.toggle('compliance-on', active);
        btnCompliance.classList.toggle('compliance-off', !active);
        btnCompliance.textContent = active ? 'Kurallar: Açık' : 'Kurallar: Kapalı';
        btnCompliance.title = active 
          ? 'Ağ Standartları & Döngü Koruması: AKTİF (Trunk zorunluluğu, STP döngü engelleme, medya denetimi devrede)' 
          : 'Ağ Standartları: KAPALI (Serbest Mod - Switch trunk/uplink dayatması ve döngü engeli yok, serbest kablolama)';
      };

      if (window.RackStudio?.STATE) {
        const saved = localStorage.getItem('rack-studio-strict-compliance');
        window.RackStudio.STATE.strictCompliance = saved === null ? true : (saved === 'true');
      }
      updateComplianceBtn();

      btnCompliance.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.RackStudio?.STATE) return;
        const current = window.RackStudio.STATE.strictCompliance !== false;
        const nextState = !current;
        window.RackStudio.STATE.strictCompliance = nextState;
        try {
          localStorage.setItem('rack-studio-strict-compliance', String(nextState));
        } catch (_) {}
        updateComplianceBtn();

        const toast = document.getElementById('studio-toast');
        if (toast) {
          toast.textContent = nextState 
            ? '🛡️ Ağ Kuralları ve Standartları AÇILDI (Trunk & Döngü Koruması devrede)' 
            : '🛡️ Ağ Kuralları KAPATILDI (Serbest Mod: Standart dayatması yok)';
          toast.className = 'show';
          setTimeout(() => { toast.className = ''; }, 3000);
        }
      });
    }

    // Rack U Height Slider & Display (12U - 60U)
    const uSlider = document.getElementById('rack-u-slider');
    const uDisplay = document.getElementById('rack-u-val');
    if (uSlider) {
      const syncUSliderFromRack = () => {
        const activeRack = window.RackStudio?.getActiveRack ? window.RackStudio.getActiveRack() : window.RackStudio?.STATE?.racks?.[0];
        const h = (window.is3DMode && window.__STUDIO3D__?.state?.rackHeightU) 
          ? window.__STUDIO3D__.state.rackHeightU 
          : (activeRack?.heightU || 42);
        uSlider.value = h;
        if (uDisplay) uDisplay.textContent = h + 'U';
      };

      uSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (Number.isNaN(val)) return;
        if (uDisplay) uDisplay.textContent = val + 'U';
        if (window.is3DMode && window.__STUDIO3D__) {
          window.__STUDIO3D__.setRackHeight(val);
        } else if (window.RackStudio?.resizeRackHeight) {
          const activeRack = window.RackStudio.getActiveRack ? window.RackStudio.getActiveRack() : window.RackStudio.STATE?.racks?.[0];
          if (activeRack) {
            const ok = window.RackStudio.resizeRackHeight(activeRack.id, val);
            if (!ok) {
              uSlider.value = activeRack.heightU || 42;
              if (uDisplay) uDisplay.textContent = (activeRack.heightU || 42) + 'U';
            } else if (window.__STUDIO3D__) {
              window.__STUDIO3D__.state.rackHeightU = val;
              if (Array.isArray(window.__STUDIO3D__.state.racks)) {
                const r3d = window.__STUDIO3D__.state.racks.find(r => r.id === activeRack.id);
                if (r3d) r3d.heightU = val;
              }
              window.__STUDIO3D__.buildRack(val);
              window.__STUDIO3D__.rebuildAllDevices();
              window.__STUDIO3D__.rebuildAllCables();
            }
          }
        }
      });

      document.addEventListener('rackstudio:change', syncUSliderFromRack);
      document.addEventListener('rackstudio:rackswitched', syncUSliderFromRack);
      syncUSliderFromRack();
    }

    // Tools overflow menu
    const toolsMenu = document.getElementById('hud-tools-menu');
    const toolsToggle = document.getElementById('btn-tools-menu-toggle');
    const toolsPanel = document.getElementById('hud-tools-panel');
    function setToolsOpen(open) {
      if (!toolsMenu || !toolsToggle || !toolsPanel) return;
      toolsMenu.classList.toggle('is-open', open);
      toolsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toolsPanel.hidden = !open;
    }
    toolsToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      setToolsOpen(toolsPanel?.hidden !== false);
    });
    document.addEventListener('click', (e) => {
      if (!toolsMenu?.contains(e.target)) setToolsOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setToolsOpen(false);
    });
    toolsPanel?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn && btn.id !== 'btn-tools-menu-toggle') {
        // Keep menu open for file import; close for other actions shortly after
        if (btn.id !== 'btn-import-json-3d') {
          setTimeout(() => setToolsOpen(false), 80);
        }
      }
    });

    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('rackstudio_cable_mode');
    } catch (_) { /* storage may be blocked */ }
    if (window.RackStudio?.STATE) window.RackStudio.STATE.cableRenderMode = 'pixi';
    document.documentElement.setAttribute('data-device-renderer', 'pixi');

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
