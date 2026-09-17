/**
 * Cisco Enterprise Rack & Cabling Studio - 2D/3D Bidirectional Bridge & Lazy Loader
 */
(function () {
  'use strict';

  let is3DLoading = false;
  let is3DLoaded = false;
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
      loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(5,8,17,0.92);backdrop-filter:blur(8px);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#38bdf8;font-family:system-ui,-apple-system,sans-serif;';
      loader.innerHTML = `
        <div style="width:48px;height:48px;border:3px solid rgba(56,189,248,0.2);border-top-color:#38bdf8;border-radius:50%;animation:spin3d 0.8s linear infinite;margin-bottom:16px;"></div>
        <div style="font-size:1.1rem;font-weight:700;letter-spacing:0.5px;color:#f8fafc;margin-bottom:6px;">🎮 3D Datacenter Stüdyosu Yükleniyor...</div>
        <div style="font-size:0.8rem;color:#94a3b8;">WebGL & Three.js motoru başlatılıyor</div>
        <style>@keyframes spin3d { to { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(loader);
    } else {
      loader.style.display = 'flex';
    }

    try {
      // 1. Inject 3D stylesheet
      await loadStylesheet('css/studio3d.css');

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
    if (!window.__STUDIO3D__) return;
    try {
      const s = window.__STUDIO3D__.state;
      const catalog = (window.RackStudio && window.RackStudio.catalog) || {};
      const devMap = new Map();
      (s.devices || []).forEach(d => devMap.set(d.id, d));
      const usedPorts = new Set();

      function resolvePortId(devId, portIdx, savedPortId) {
        const d = devMap.get(devId);
        if (!d) return savedPortId || ('p' + (portIdx || 1));
        const catKey = d.catalogId;
        let cat = catalog[catKey];
        if (!cat && window.CATALOG_3D) {
          cat = window.CATALOG_3D.find(c => c.id === catKey);
        }
        const ports = (cat && cat.ports) || [];
        if (!ports.length) {
          const pid = savedPortId || ('p' + (portIdx || 1));
          usedPorts.add(`${devId}:${pid}`);
          return pid;
        }
        // 1. If savedPortId is valid on this device and not already used
        if (savedPortId && ports.some(p => p.id === savedPortId) && !usedPorts.has(`${devId}:${savedPortId}`)) {
          usedPorts.add(`${devId}:${savedPortId}`);
          return savedPortId;
        }
        // 2. Map 1-based portIdx to port
        const targetIdx = (typeof portIdx === 'number' && portIdx >= 1 && portIdx <= ports.length) ? portIdx - 1 : 0;
        const candidate = ports[targetIdx];
        if (candidate && !usedPorts.has(`${devId}:${candidate.id}`)) {
          usedPorts.add(`${devId}:${candidate.id}`);
          return candidate.id;
        }
        // 3. Find any unused port
        const available = ports.find(p => !usedPorts.has(`${devId}:${p.id}`));
        if (available) {
          usedPorts.add(`${devId}:${available.id}`);
          return available.id;
        }
        // 4. Fallback to candidate or first port
        return candidate ? candidate.id : ports[0].id;
      }

      const defaultRackId = (s.racks && s.racks[0] && s.racks[0].id) || 'rack-1';

      const validCables = [];
      (s.cables || []).forEach(c => {
        if (!c.from || !c.to) return;
        const pFrom = resolvePortId(c.from.devId, c.from.portIdx, c.from.portId);
        const pTo = resolvePortId(c.to.devId, c.to.portIdx, c.to.portId);
        if (!pFrom || !pTo) return;
        const devFrom = s.devices.find(d => d.id === c.from.devId);
        const devTo = s.devices.find(d => d.id === c.to.devId);
        const rackFrom = c.from.rackId || (devFrom && devFrom.rackId) || defaultRackId;
        const rackTo = c.to.rackId || (devTo && devTo.rackId) || defaultRackId;
        const hex = typeof c.color === 'number' ? '#' + c.color.toString(16).padStart(6, '0') : (c.color || '#00d2ff');
        validCables.push({
          id: c.id,
          name: c.name || 'Kablo',
          role: c.role || '',
          ductSide: c.ductSide || 'auto',
          color: hex,
          lengthMeters: c.lengthM || 1.5,
          from: {
            rackId: rackFrom,
            instanceId: c.from.devId,
            portId: pFrom,
            face: 'front'
          },
          to: {
            rackId: rackTo,
            instanceId: c.to.devId,
            portId: pTo,
            face: 'front'
          }
        });
      });

      const racksData = (Array.isArray(s.racks) && s.racks.length > 0)
        ? s.racks.map(r => ({
            id: r.id,
            name: r.name,
            heightU: r.heightU || s.rackHeightU || 42,
            devices: s.devices.filter(d => (d.rackId || defaultRackId) === r.id).map(d => ({
              instanceId: d.id,
              catalogKey: d.catalogId,
              topU: d.startU + (d.uHeight || 1) - 1,
              uHeight: d.uHeight || 1,
              name: d.name,
              hostname: d.hostname || d.name,
              ipAddress: d.ipAddress || '',
              macAddress: d.macAddress || '',
              serialNumber: d.serialNumber || '',
              panelLabel: d.panelLabel || '',
              portsConfig: d.portsConfig || {},
              face: 'front'
            }))
          }))
        : [{
            id: 'rack-1',
            name: 'MDF - Dağıtım Kabini',
            heightU: s.rackHeightU || 42,
            devices: s.devices.map(d => ({
              instanceId: d.id,
              catalogKey: d.catalogId,
              topU: d.startU + (d.uHeight || 1) - 1,
              uHeight: d.uHeight || 1,
              name: d.name,
              hostname: d.hostname || d.name,
              ipAddress: d.ipAddress || '',
              macAddress: d.macAddress || '',
              serialNumber: d.serialNumber || '',
              panelLabel: d.panelLabel || '',
              portsConfig: d.portsConfig || {},
              face: 'front'
            }))
          }];

      const legacyProj = {
        version: '3.0.0',
        doorOpen: s.doorOpen === true,
        activeRackId: s.activeRackId || defaultRackId,
        racks: racksData,
        cables: validCables
      };
      localStorage.setItem('cisco-rack-studio-project', JSON.stringify(legacyProj));
      if (window.RackStudio && window.RackStudio.loadCustomTopology) {
        window.RackStudio.loadCustomTopology(legacyProj);
      }
    } catch (e) {
      console.error('sync3Dto2D error:', e);
    }
  }
  window.sync3Dto2D = sync3Dto2D;

  function sync2Dto3D() {
    if (!window.__STUDIO3D__) return;
    try {
      let proj = null;
      if (window.RackStudio && window.RackStudio.STATE && window.RackStudio.STATE.racks) {
        proj = {
          activeRackId: window.RackStudio.STATE.activeRackId,
          doorOpen: window.RackStudio.STATE.doorOpen === true,
          racks: window.RackStudio.STATE.racks,
          cables: window.RackStudio.STATE.cables || []
        };
      } else {
        const raw = localStorage.getItem('cisco-rack-studio-project') || localStorage.getItem('rack-studio-project-v2');
        if (raw) proj = JSON.parse(raw);
      }
      if (proj) {
        window.__STUDIO3D__.loadTopologyFromProject(proj);
      }
    } catch (e) {
      console.error('sync2Dto3D error:', e);
    }
  }
  window.sync2Dto3D = sync2Dto3D;

  function applyMode() {
    const wrapper3D = getWrapper3D();
    const legacyWrapper = document.getElementById('legacy-wrapper');
    const btnView2D = document.getElementById('btn-view-2d');
    const btnView3D = document.getElementById('btn-view-3d');
    const controls3D = document.getElementById('controls-3d-group');
    const controls2D = document.getElementById('controls-2d-group');
    const perfControl = document.querySelector('label[for="performance-mode"]');
    const btnWizard = document.getElementById('btn-3d-wizard-modal');
    const fpsCounter = document.getElementById('fps-counter');

    if (window.is3DMode) {
      if (wrapper3D) wrapper3D.style.display = 'block';
      if (legacyWrapper) legacyWrapper.style.display = 'none';
      if (btnView2D) btnView2D.classList.remove('active');
      if (btnView3D) btnView3D.classList.add('active');
      if (controls3D) controls3D.style.display = 'flex';
      if (controls2D) controls2D.style.display = 'none';
      if (perfControl) perfControl.style.display = 'inline-flex';
      if (btnWizard) btnWizard.style.display = 'inline-flex';
      if (fpsCounter) fpsCounter.style.display = 'inline-block';
      if (window.__STUDIO3D__) {
        window.__STUDIO3D__.resume();
        const container = document.getElementById('studio3d-container');
        if (container && window.__STUDIO3D__.camera && window.__STUDIO3D__.renderer) {
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || (window.innerHeight - 56);
          window.__STUDIO3D__.camera.aspect = w / h;
          window.__STUDIO3D__.camera.updateProjectionMatrix();
          window.__STUDIO3D__.renderer.setSize(w, h);
        }
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
      if (window.__STUDIO3D__) window.__STUDIO3D__.pause();
    }
    if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
  }

  async function setMode(to3D) {
    if (window.is3DMode === to3D) return;
    if (to3D) {
      const loaded = await ensure3DStudioLoaded();
      if (!loaded) return;
      sync2Dto3D();
      window.is3DMode = true;
      applyMode();
    } else {
      window.is3DMode = false;
      applyMode();
      sync3Dto2D();
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (window.RackStudio && typeof window.RackStudio.refresh === 'function') {
            window.RackStudio.refresh();
          }
        }, 60);
      });
    }
    if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
  }

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
