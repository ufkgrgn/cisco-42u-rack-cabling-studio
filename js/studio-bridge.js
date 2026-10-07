/**
 * Cisco Enterprise Rack & Cabling Studio - 2D/3D Bidirectional Bridge & Lazy Loader
 */
(function () {
  'use strict';

  let is3DLoading = false;
  let is3DLoaded = false;
  let hibernate3DTimer = null;
  const HIBERNATE_3D_DELAY_MS = 45_000;
  window.is3DMode = false;

  function getWrapper3D() {
    return document.getElementById('studio3d-wrapper');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = (err) => reject(new Error(`Script yüklenemedi: ${src}`));
      document.body.appendChild(s);
    });
  }

  function loadStylesheet(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = () => resolve();
      l.onerror = () => resolve();
      document.head.appendChild(l);
    });
  }

  async function ensure3DStudioLoaded() {
    if (is3DLoaded) return true;
    if (is3DLoading) return false;
    is3DLoading = true;

    // Modern loading overlay
    let loader = document.getElementById('studio3d-loader-overlay');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'studio3d-loader-overlay';
      loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-app);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-main);font-family:var(--font-sans);';
      loader.innerHTML = `
        <div style="width:48px;height:48px;border:3px solid var(--border);border-top-color:var(--accent-strong);border-radius:50%;animation:spin3d 0.8s linear infinite;margin-bottom:16px;"></div>
        <div style="font-size:1.1rem;font-weight:700;letter-spacing:0.5px;color:var(--text-main);margin-bottom:6px;">3D kabin görünümü yükleniyor...</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">Sahne hazırlanıyor</div>
        <style>@keyframes spin3d { to { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(loader);
    } else {
      loader.style.display = 'flex';
    }

    try {
      // 1. Inject 3D stylesheet modules
      await loadStylesheet('css/studio3d-chrome.css');
      await loadStylesheet('css/studio3d-overlays.css');

      // 2. Clone & Mount 3D DOM template into document
      if (!document.getElementById('studio3d-wrapper')) {
        const template = document.getElementById('studio3d-template');
        if (template) {
          const clone = template.content.cloneNode(true);
          const legacyWrap = document.getElementById('legacy-wrapper');
          if (legacyWrap) {
            document.body.insertBefore(clone, legacyWrap);
          } else {
            document.body.appendChild(clone);
          }
        }
      }

      // 3. Sequentially load Three.js and 3D Studio scripts
      await loadScript('js/three-bundle.min.js');
      await loadScript('js/studio3d.js');
      await loadScript('js/studio3d-ui.js');

      // Ensure Studio3D engine instance is bound
      if (!window.__STUDIO3D__ && window.Studio3D) {
        const container = document.getElementById('studio3d-container');
        if (container) {
          window.__STUDIO3D__ = new window.Studio3D(container);
        }
      }

      is3DLoaded = true;
      return true;
    } catch (err) {
      console.error('3D Stüdyo yüklenirken hata oluştu:', err);
      alert('3D Stüdyo motoru yüklenemedi: ' + err.message);
      return false;
    } finally {
      is3DLoading = false;
      if (loader) loader.style.display = 'none';
    }
  }

  function sync3Dto2D() {
    if (!window.__STUDIO3D__) return false;
    try {
      const api = window.RackStudio;
      const scene = window.__STUDIO3D__.state;
      if (scene.projectProjection || scene.projectBatchDepth > 0 || !window.is3DMode) return true;
      return scene.autoSave();
    } catch (error) {
      window.RackStudio?.showTemporaryTooltip?.(window.innerWidth / 2, 80, error.message);
      console.error('sync3Dto2D error:', error);
      return false;
    }
  }
  window.sync3Dto2D = sync3Dto2D;

  function sync2Dto3D() {
    if (!window.__STUDIO3D__) return false;
    try {
      let proj = null;
      if (window.RackStudio && window.RackStudio.STATE && window.RackStudio.STATE.racks) {
        proj = window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE);
      } else {
        const raw = localStorage.getItem('cisco-rack-studio-project') || localStorage.getItem('rack-studio-project-v2');
        if (raw) {
          proj = JSON.parse(raw);
        }
      }
      if (proj) {
        window.__STUDIO3D__.loadTopologyFromProject(proj);
        const rMode2d = window.RackStudio?.STATE?.cableRoutingMode;
        if (rMode2d && window.__STUDIO3D__.state) {
          window.__STUDIO3D__.state.cableRoutingMode = (rMode2d === 'direct') ? 'catenary' : 'structured';
          window.sync3dRoutingButtons?.(window.__STUDIO3D__.state.cableRoutingMode);
        }
        return true;
      }
    } catch (e) {
      console.error('sync2Dto3D error:', e);
      window.RackStudio?.showTemporaryTooltip?.(window.innerWidth / 2, 80, e.message);
    }
    return false;
  }
  window.sync2Dto3D = sync2Dto3D;

  function applyMode() {
    document.body.classList.toggle('studio-3d-mode', window.is3DMode);
    if (window.is3DMode && window.matchMedia('(max-width: 1023px)').matches) {
      window.setLeftSidebarCollapsed?.(true);
      window.setRightSidebarCollapsed?.(true, false);
    }
    const wrapper3D = getWrapper3D();
    const legacyWrapper = document.getElementById('legacy-wrapper');
    const btnView2D = document.getElementById('btn-view-2d');
    const btnView3D = document.getElementById('btn-view-3d');
    const controls3D = document.getElementById('controls-3d-group');
    const controls2D = document.getElementById('controls-2d-group');
    const perfControl = document.querySelector('label[for="performance-mode"]');
    const btnWizard = document.getElementById('btn-3d-wizard-modal');
    const fpsCounter = document.getElementById('fps-counter');
    const deviceLabelControl = document.getElementById('device-label-control');
    const tools3d = document.getElementById('tools-3d-only');
    const tools2d = document.getElementById('tools-2d-only');
    const compact2d = document.getElementById('compact-view-2d');
    const compact3d = document.getElementById('compact-view-3d');
    if (tools3d) tools3d.hidden = !window.is3DMode;
    if (tools2d) tools2d.hidden = window.is3DMode;
    if (compact2d) compact2d.hidden = window.is3DMode;
    if (compact3d) compact3d.hidden = !window.is3DMode;
    document.getElementById('compact-view-panel')?.setAttribute('hidden', '');
    document.getElementById('btn-compact-view')?.setAttribute('aria-expanded', 'false');

    if (window.is3DMode) {
      if (hibernate3DTimer) {
        clearTimeout(hibernate3DTimer);
        hibernate3DTimer = null;
      }
      if (wrapper3D) wrapper3D.style.display = 'block';
      if (legacyWrapper) legacyWrapper.style.display = 'none';
      if (btnView2D) btnView2D.classList.remove('active');
      if (btnView3D) btnView3D.classList.add('active');
      if (controls3D) controls3D.style.display = 'flex';
      if (controls2D) controls2D.style.display = 'none';
      if (perfControl) perfControl.style.display = 'inline-flex';
      if (btnWizard) btnWizard.style.display = 'inline-flex';
      if (fpsCounter) fpsCounter.style.display = 'inline-block';
      if (deviceLabelControl) deviceLabelControl.style.display = 'inline-flex';
      window.sync3dRoutingButtons?.(window.__STUDIO3D__?.state?.cableRoutingMode || 'structured');
      if (window.__STUDIO3D__) {
        const container = document.getElementById('studio3d-container');
        if (container && window.__STUDIO3D__.camera && window.__STUDIO3D__.renderer) {
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || (window.innerHeight - 56);
          window.__STUDIO3D__.camera.aspect = w / h;
          window.__STUDIO3D__.camera.updateProjectionMatrix();
          window.__STUDIO3D__.renderer.setSize(w, h);
        }
        if (window.__STUDIO3D__.wake) window.__STUDIO3D__.wake();
        else window.__STUDIO3D__.resume();
      }
    } else {
      if (wrapper3D) wrapper3D.style.display = 'none';
      if (legacyWrapper) legacyWrapper.style.display = 'flex';
      if (btnView2D) btnView2D.classList.add('active');
      if (btnView3D) btnView3D.classList.remove('active');
      if (controls3D) controls3D.style.display = 'none';
      if (controls2D) controls2D.style.display = 'flex';
      if (perfControl) perfControl.style.display = 'none';
      if (btnWizard) btnWizard.style.display = 'none';
      if (fpsCounter) fpsCounter.style.display = 'none';
      if (deviceLabelControl) deviceLabelControl.style.display = 'none';
      if (window.__STUDIO3D__) {
        window.__STUDIO3D__.pause();
        if (hibernate3DTimer) clearTimeout(hibernate3DTimer);
        hibernate3DTimer = setTimeout(() => {
          hibernate3DTimer = null;
          if (!window.is3DMode) window.__STUDIO3D__?.hibernate?.();
        }, HIBERNATE_3D_DELAY_MS);
      }
    }
    if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
  }

  window.getStudioRenderTelemetry = () => ({
    is3DMode: window.is3DMode,
    is3DLoaded,
    is3DPaused: window.__STUDIO3D__?.isPaused ?? true,
    is3DHibernated: window.__STUDIO3D__?.isHibernated ?? false,
    hibernateDelayMs: HIBERNATE_3D_DELAY_MS,
    pixi: window.RackStudio?.getPixiPerformanceTelemetry?.() || null
  });

  function captureStudioSelection() {
    const RS = window.RackStudio;
    const fromDom = document.querySelector('.mounted-device.studio-selected')?.id || null;
    const from2d = RS?.STATE?.selectedDeviceId || fromDom;
    const from3d = window.__STUDIO3D__?.selectedDeviceId || null;
    return {
      deviceId: window.is3DMode ? (from3d || from2d) : (from2d || from3d),
      cableId: (window.is3DMode ? window.__STUDIO3D__?.state?.selectedCableId : null) || RS?.STATE?.highlightedCableId || null
    };
  }

  function restoreStudioSelection(selection) {
    if (!selection) return;
    const RS = window.RackStudio;
    if (selection.deviceId && RS?.STATE) {
      RS.STATE.selectedDeviceId = selection.deviceId;
    }
    if (window.is3DMode && window.__STUDIO3D__) {
      if (selection.cableId) {
        window.__STUDIO3D__.selectCable?.(selection.cableId);
        window.__STUDIO3D__.focusCable?.(selection.cableId);
        return;
      }
      if (!selection.deviceId) return;
      if (typeof window.__STUDIO3D__.focusDevice === 'function') {
        window.__STUDIO3D__.focusDevice(selection.deviceId);
      } else if (typeof window.__STUDIO3D__.selectDevice === 'function') {
        window.__STUDIO3D__.selectDevice(selection.deviceId);
      }
      return;
    }
    document.querySelectorAll('.mounted-device.studio-selected').forEach(el => el.classList.remove('studio-selected'));
    if (selection.deviceId) {
      document.getElementById(selection.deviceId)?.classList.add('studio-selected');
      RS?.syncPixiDeviceSelection?.();
    }
    if (selection.cableId && RS?.highlightCable) {
      RS.highlightCable(selection.cableId, true);
    }
  }

  async function setMode(to3D) {
    if (window.is3DMode === to3D) return;
    const selection = captureStudioSelection();
    const projectId = window.RackStudio?.STATE?.projectDocument?.projectId;
    if (to3D) {
      const loaded = await ensure3DStudioLoaded();
      if (!loaded) return;
      if (!sync2Dto3D()) return;
      window.__STUDIO3D__?.fitCameraToRacks?.('iso');
      window.is3DMode = true;
      applyMode();
      requestAnimationFrame(() => restoreStudioSelection(selection));
    } else {
      if (!sync3Dto2D()) return;
      window.is3DMode = false;
      applyMode();
      if (window.RackStudioTheme) {
        window.RackStudioTheme.apply(window.RackStudioTheme.get());
      }
      if (window.RackStudio) {
        window.RackStudio.invalidateLayoutGeometryCache?.();
        window.RackStudio.PixiCableGeometry?.invalidateLayoutGeometryCache?.();
        window.RackStudio.PixiCabinScene?.invalidatePixiCabinScenes?.();
      }
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (window.RackStudio?.STATE?.projectDocument?.projectId !== projectId) return;
          if (window.RackStudio) {
            window.RackStudio.invalidateLayoutGeometryCache?.();
            window.RackStudio.PixiCableGeometry?.invalidateLayoutGeometryCache?.();
            window.RackStudio.DeviceSceneRegistry?.captureFromDom?.('return-from-3d');
            if (typeof window.RackStudio.refresh === 'function') {
              window.RackStudio.refresh();
            }
            if (typeof window.RackStudio.renderAllCablesPixi === 'function') {
              window.RackStudio.renderAllCablesPixi();
            }
          }
          const uSlider = document.getElementById('rack-u-slider');
          const uDisplay = document.getElementById('rack-u-val');
          const activeRack = window.RackStudio?.getActiveRack ? window.RackStudio.getActiveRack() : window.RackStudio?.STATE?.racks?.[0];
          if (uSlider && activeRack) {
            uSlider.value = activeRack.heightU || 42;
            if (uDisplay) uDisplay.textContent = (activeRack.heightU || 42) + 'U';
          }
          restoreStudioSelection(selection);
        }, 60);
      });
    }
    if (window.RackStudioTheme) {
      window.RackStudioTheme.apply(window.RackStudioTheme.get());
    }
    if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
  }

  window.RackStudio.setStudioMode = setMode;

  function initBridge() {
    const btnView2D = document.getElementById('btn-view-2d');
    const btnView3D = document.getElementById('btn-view-3d');
    const btnToggleHeader = document.getElementById('btn-toggle-view-mode');
    const btnSwitchTo3D = document.getElementById('btn-switch-to-3d');

    if (btnView2D) btnView2D.addEventListener('click', () => setMode(false));
    if (btnView3D) btnView3D.addEventListener('click', () => setMode(true));
    if (btnToggleHeader) btnToggleHeader.addEventListener('click', () => setMode(!window.is3DMode));
    if (btnSwitchTo3D) btnSwitchTo3D.addEventListener('click', () => setMode(true));

    applyMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
  } else {
    initBridge();
  }
})();
