/**
 * Cisco Enterprise Rack & Cabling Studio - Main Application Bootstrap Coordinator
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;
  const ZOOM_STATE = RS.ZOOM_STATE;

  const initDomReferences = () => RS.initDomReferences && RS.initDomReferences();
  const getActiveRack = () => RS.getActiveRack();
  const renderRackRailsAndSlots = (cb) => RS.renderRackRailsAndSlots && RS.renderRackRailsAndSlots(cb);
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const switchActiveRack = (...args) => RS.switchActiveRack && RS.switchActiveRack(...args);
  const addNewRack = (...args) => RS.addNewRack && RS.addNewRack(...args);
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const mountDeviceAt = (...args) => RS.mountDeviceAt && RS.mountDeviceAt(...args);
  const removeDevice = (...args) => RS.removeDevice && RS.removeDevice(...args);
  const updateDeviceMetadata = (...args) => RS.updateDeviceMetadata && RS.updateDeviceMetadata(...args);
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const cancelPendingConnection = () => RS.cancelPendingConnection && RS.cancelPendingConnection();
  const addDirectCable = (...args) => RS.addDirectCable && RS.addDirectCable(...args);
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const disconnectCable = (...args) => RS.disconnectCable && RS.disconnectCable(...args);
  const showCableQuickHud = (...args) => RS.showCableQuickHud && RS.showCableQuickHud(...args);
  const hideCableQuickHud = (...args) => RS.hideCableQuickHud && RS.hideCableQuickHud(...args);
  const highlightDropSlots = (...args) => RS.highlightDropSlots && RS.highlightDropSlots(...args);
  const fitRackToScreen = (smooth) => RS.fitRackToScreen && RS.fitRackToScreen(smooth);
  const setZoom = (...args) => RS.setZoom && RS.setZoom(...args);
  const bindZoomAndPanEvents = () => RS.bindZoomAndPanEvents && RS.bindZoomAndPanEvents();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const setConnectionRole = (...args) => RS.setConnectionRole && RS.setConnectionRole(...args);
  const exportVisioSvg = () => RS.exportVisioSvg && RS.exportVisioSvg();
  const exportJson = () => RS.exportJson && RS.exportJson();
  const validateTopology = (d) => RS.validateTopology && RS.validateTopology(d);
  const refresh = () => RS.refresh && RS.refresh();
  const loadCustomTopology = (d) => RS.loadCustomTopology && RS.loadCustomTopology(d);
  const loadMdfPreset = () => RS.loadMdfPreset && RS.loadMdfPreset();
  const loadIdfPreset = () => RS.loadIdfPreset && RS.loadIdfPreset();
  const loadFullSitePreset = () => RS.loadFullSitePreset && RS.loadFullSitePreset();

  function init() {
    initDomReferences();
    const savedViewMode = (typeof localStorage !== 'undefined') ? localStorage.getItem('rack_studio_view_mode') : null;
    if (savedViewMode === 'multi' || savedViewMode === 'single') {
      STATE.viewMode = savedViewMode;
    }
    dom.btnViewModeSingle?.classList.toggle('active', STATE.viewMode === 'single');
    dom.btnViewModeMulti?.classList.toggle('active', STATE.viewMode === 'multi');
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
      requestAnimationFrame(() => {
        if (RS.invalidatePixiCableGeometry) RS.invalidatePixiCableGeometry();
        if (RS.renderAllCables) RS.renderAllCables();
      });
    });
  }

  function mountDeviceFromAction(arg1, arg2, arg3, arg4) {
    let catalogKey, targetU, e, targetRackId;

    // Handle swapped signatures e.g. (rackId, targetU, catalogKey) or (rackId, targetU, e, catalogKey)
    if (typeof arg1 === 'string' && STATE.racks?.some(r => r.id === arg1)) {
      targetRackId = arg1;
      targetU = Number(arg2);
      if (typeof arg3 === 'string') {
        catalogKey = arg3;
        e = arg4;
      } else {
        e = arg3;
        catalogKey = arg4;
      }
    } else {
      catalogKey = arg1;
      targetU = Number(arg2);
      e = (arg3 && typeof arg3 === 'object' && ('clientX' in arg3 || 'preventDefault' in arg3 || 'dataTransfer' in arg3)) ? arg3 : null;
      targetRackId = (typeof arg3 === 'string' ? arg3 : arg4);
    }

    if (!catalogKey) return false;
    const catalogItem = (RS.resolveCatalogItem ? RS.resolveCatalogItem(catalogKey) : null) || (
      HARDWARE_CATALOG[catalogKey] ||
      (RS.catalog && RS.catalog[catalogKey]) ||
      (STATE.customCatalog && STATE.customCatalog[catalogKey]) ||
      (Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m && m.id === catalogKey) : window.CISCO_MASTER_CATALOG?.[catalogKey]) ||
      (Array.isArray(RS.CISCO_MASTER_CATALOG) ? RS.CISCO_MASTER_CATALOG.find(m => m && m.id === catalogKey) : RS.CISCO_MASTER_CATALOG?.[catalogKey])
    );
    if (!catalogItem) return false;
    const requiredU = catalogItem.u || 1;
    const startU = targetU;
    const endU = targetU - requiredU + 1;

    if (endU < 1) {
      alert(`Bu cihaz ${requiredU}U yüksekliğinde. U${targetU} seviyesine sığmıyor.`);
      return false;
    }

    const targetRack = targetRackId ? (STATE.racks?.find(r => r.id === targetRackId) || getActiveRack()) : getActiveRack();
    if (!targetRack) return false;

    for (let u = endU; u <= startU; u++) {
      if (targetRack.units[u] !== null) {
        alert(`U${u} pozisyonu dolu! Lütfen boş bir slot seçin.`);
        return false;
      }
    }

    const mounted = mountDeviceAt(catalogItem.id || catalogKey, startU, targetRack.id);
    renderRackTabs();
    renderMountedDevices();
    renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
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
        // catalog-ui owns selection and its single reusable detail inspector once
        // a legacy card has been upgraded. Avoid toggling the same selection twice.
        if (card.dataset.catalogEnhanced === 'true') return;
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
        if (Array.isArray(STATE.cables)) {
          STATE.cables.forEach(c => {
            if (c.from && c.to && RS.calculateCableLengthMeters) {
              c.lengthMeters = RS.calculateCableLengthMeters(c.from.instanceId, c.to.instanceId, c.from.rackId !== c.to.rackId);
            }
          });
        }
        renderAllCables();
        if (RS.renderScheduleTable) RS.renderScheduleTable();
      });

      dom.btnRouteDirect.addEventListener('click', () => {
        dom.btnRouteDirect.classList.add('active');
        dom.btnRouteStructured.classList.remove('active');
        STATE.cableRoutingMode = 'direct';
        if (Array.isArray(STATE.cables)) {
          STATE.cables.forEach(c => {
            if (c.from && c.to && RS.calculateCableLengthMeters) {
              c.lengthMeters = RS.calculateCableLengthMeters(c.from.instanceId, c.to.instanceId, c.from.rackId !== c.to.rackId);
            }
          });
        }
        renderAllCables();
        if (RS.renderScheduleTable) RS.renderScheduleTable();
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

  function setViewMode(mode, skipSave = false) {
    STATE.viewMode = mode;
    if (!skipSave) {
      try {
        localStorage.setItem('rack_studio_view_mode', mode);
      } catch (_) {}
    }
    dom.btnViewModeSingle?.classList.toggle('active', mode === 'single');
    dom.btnViewModeMulti?.classList.toggle('active', mode === 'multi');
    renderRackRailsAndSlots(handleSlotClick);
    renderMountedDevices();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
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
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
        }
      });
    }

    if (dom.btnPresetIdf) {
      dom.btnPresetIdf.addEventListener('click', () => {
        if (confirm("IDF Kat Kenar Kabini şablonu yüklensin mi? (Mevcut topoloji sıfırlanır)")) {
          loadIdfPreset();
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
        }
      });
    }

    if (dom.btnPresetSite) {
      dom.btnPresetSite.addEventListener('click', () => {
        if (confirm("Tüm Saha Topolojisi (MDF + IDF-1 + IDF-2 Çoklu Kabin) yüklensin mi?")) {
          loadFullSitePreset();
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
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
          if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
          renderRackRailsAndSlots();
          renderRackTabs();
          renderMountedDevices();
          renderScheduleTable();
          renderAllCables();
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
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
      // Do NOT cancel a pending cable connection when the user is panning/zooming.
      // ZOOM_STATE.hasMoved is set true in zoom-manager whenever a mousedown→mousemove
      // drag occurs, so any synthetic "click" that fires after a pan is ignored here.
      const wasPanDrag = RS.ZOOM_STATE && RS.ZOOM_STATE.hasMoved;
      if (wasPanDrag) {
        // Reset hasMoved so the next genuine click works normally
        RS.ZOOM_STATE.hasMoved = false;
        return;
      }
      const isPixiPortHit = STATE.cableRenderMode === 'pixi' && (
        (typeof RS.hitPixiDevicePortAt === 'function' && !!RS.hitPixiDevicePortAt(e.clientX, e.clientY)) ||
        (RS.lastHandledPixiPortTime && Date.now() - RS.lastHandledPixiPortTime < 350)
      );
      if (!e.target.closest('.port') && !isPixiPortHit) {
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
    let dev = null;
    for (const r of (STATE.racks || [])) {
      const found = r.devices?.find(d => d.instanceId === instanceId);
      if (found) { dev = found; break; }
    }
    if (!dev) return false;
    if (!dev.portsConfig) dev.portsConfig = {};

    const pIdStr = String(portId || '');
    const pNumStr = pIdStr.replace(/\D+/g, '');
    const isNumericPort = Boolean(pNumStr);
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    const portObj = cat?.ports?.find(p => p.id === portId || p.name === portId || (isNumericPort && String(p.id).replace(/\D+/g, '') === pNumStr));
    const portName = portObj?.name;

    const isReset = !config || (
      config.role === 'access' &&
      !config.ciscoName &&
      !config.vlan &&
      !config.description &&
      (!config.color || config.color === '#38bdf8' || config.color === '#3b82f6') &&
      (!config.poeState || config.poeState === 'auto')
    );

    if (isReset) {
      const aliases = (RS.getPortAliases ? RS.getPortAliases(portId) : [pIdStr]);
      aliases.forEach(a => {
        delete dev.portsConfig[a];
      });
      delete dev.portsConfig['p' + pIdStr];
      if (portName) delete dev.portsConfig[portName];

      const connectedCable = STATE.cables.find(c =>
        (c.from.instanceId === instanceId && (c.from.portId === portId || (pNumStr && String(c.from.portId).replace(/\D+/g, '') === pNumStr))) ||
        (c.to.instanceId === instanceId && (c.to.portId === portId || (pNumStr && String(c.to.portId).replace(/\D+/g, '') === pNumStr)))
      );

      if (connectedCable) {
        connectedCable.role = null;
        connectedCable.color = STATE.selectedCableColor || '#2563eb';
        const cleanName = (connectedCable.name || connectedCable.id).replace(/^\[(TRUNK|UPLINK|POE|MGMT|MANAGEMENT|AP-TRUNK|ROUTED|FIBER)\]\s*/i, '');
        connectedCable.name = cleanName;

        const otherEndpoint = (connectedCable.from.instanceId === instanceId) ? connectedCable.to : connectedCable.from;
        let otherDev = null;
        for (const r of (STATE.racks || [])) {
          const found = r.devices?.find(d => d.instanceId === otherEndpoint.instanceId);
          if (found) { otherDev = found; break; }
        }
        if (otherDev && otherDev.portsConfig) {
          const oCat = HARDWARE_CATALOG[otherDev.catalogKey];
          const oNumStr = String(otherEndpoint.portId || '').replace(/\D+/g, '');
          const oPortObj = oCat?.ports?.find(p => p.id === otherEndpoint.portId || p.name === otherEndpoint.portId || (oNumStr && String(p.id).replace(/\D+/g, '') === oNumStr));
          const oAliases = (RS.getPortAliases ? RS.getPortAliases(otherEndpoint.portId) : [String(otherEndpoint.portId || '')]);
          oAliases.forEach(a => {
            delete otherDev.portsConfig[a];
          });
          delete otherDev.portsConfig['p' + otherEndpoint.portId];
          if (oPortObj?.name) delete otherDev.portsConfig[oPortObj.name];
        }

        if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
          try {
            const pIdxA = parseInt(pNumStr, 10) || 1;
            const pIdxB = parseInt(String(otherEndpoint.portId).replace(/\D+/g, ''), 10) || 1;
            window.__STUDIO3D__.updatePortConfig(dev.id || dev.instanceId, pIdxA, null);
            if (otherDev) window.__STUDIO3D__.updatePortConfig(otherDev.id || otherDev.instanceId, pIdxB, null);
          } catch (e) {}
        }
      }
    } else {
      const role = config.role || 'access';
      const defaultRoleColors = {
        trunk: '#7c3aed',
        uplink: '#00d2ff',
        'trunk-ap': '#ec4899',
        poe: '#f59e0b',
        mgmt: '#059669',
        management: '#059669',
        routed: '#b91c1c',
        access: '#38bdf8',
        fiber: '#facc15'
      };
      const resolvedColor = config.color || defaultRoleColors[role] || '#38bdf8';
      const isTrunk = role === 'trunk' || role === 'uplink' || role === 'trunk-ap' || config.isTrunk === true;
      const cleanCfg = {
        role: role,
        isTrunk: isTrunk,
        color: resolvedColor,
        ciscoName: config.ciscoName || '',
        vlan: config.vlan || '',
        description: config.description || '',
        autoCableColor: config.autoCableColor !== false,
        poeState: config.poeState || 'auto'
      };

      const aliases = (RS.getPortAliases ? RS.getPortAliases(portId) : [pIdStr]);
      aliases.forEach(a => {
        delete dev.portsConfig[a];
      });
      delete dev.portsConfig['p' + pIdStr];
      if (portName) delete dev.portsConfig[portName];

      dev.portsConfig[pIdStr] = cleanCfg;

      if (config.autoCableColor !== false) {
        const connectedCable = STATE.cables.find(c =>
          (c.from.instanceId === instanceId && (c.from.portId === portId || (pNumStr && String(c.from.portId).replace(/\D+/g, '') === pNumStr))) ||
          (c.to.instanceId === instanceId && (c.to.portId === portId || (pNumStr && String(c.to.portId).replace(/\D+/g, '') === pNumStr)))
        );
        if (connectedCable) {
          connectedCable.color = resolvedColor;
          connectedCable.role = role;
          const rolePrefixes = { trunk: '[TRUNK]', uplink: '[UPLINK]', 'trunk-ap': '[AP-TRUNK]', poe: '[POE]', mgmt: '[MGMT]', management: '[MGMT]', routed: '[ROUTED]', fiber: '[FIBER]', console: '[CONSOLE]' };
          const prefix = rolePrefixes[role] ? rolePrefixes[role] + ' ' : '';
          const cleanName = (connectedCable.name || connectedCable.id).replace(/^\[(TRUNK|UPLINK|POE|MGMT|MANAGEMENT|AP-TRUNK|ROUTED|FIBER|CONSOLE)\]\s*/i, '');
          connectedCable.name = prefix + cleanName;

          const otherEndpoint = (connectedCable.from.instanceId === instanceId) ? connectedCable.to : connectedCable.from;
          let otherDev = null;
          for (const r of (STATE.racks || [])) {
            const found = r.devices?.find(d => d.instanceId === otherEndpoint.instanceId);
            if (found) { otherDev = found; break; }
          }
          if (otherDev) {
            if (!otherDev.portsConfig) otherDev.portsConfig = {};
            const oIdStr = String(otherEndpoint.portId || '');
            const oNumStr = oIdStr.replace(/\D+/g, '');
            const oCat = HARDWARE_CATALOG[otherDev.catalogKey];
            const oPortObj = oCat?.ports?.find(p => p.id === otherEndpoint.portId || p.name === otherEndpoint.portId || (oNumStr && String(p.id).replace(/\D+/g, '') === oNumStr));

            delete otherDev.portsConfig['p' + oIdStr];
            if (oPortObj?.name) delete otherDev.portsConfig[oPortObj.name];

            otherDev.portsConfig[oIdStr] = cleanCfg;
            if (oNumStr) {
              otherDev.portsConfig[oNumStr] = cleanCfg;
              otherDev.portsConfig['p' + oNumStr] = cleanCfg;
              if (oIdStr.startsWith('pt')) otherDev.portsConfig['pt' + oNumStr] = cleanCfg;
              if (oIdStr.startsWith('lc')) otherDev.portsConfig['lc' + oNumStr] = cleanCfg;
              if (oIdStr.startsWith('sc')) otherDev.portsConfig['sc' + oNumStr] = cleanCfg;
            }
          }
        }
      }
    }

    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();

    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return true;
  }

  // Populate public API on window.RackStudio
  RS.mountDeviceFromAction = mountDeviceFromAction;
  RS.setViewMode = setViewMode;
  RS.updatePortConfig = updatePortConfig;

  // Automatic init on DOM ready or immediate if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
