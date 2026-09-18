/**
 * Cisco Enterprise Rack & Cabling Studio - Topology Export & Import Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;
  const BUILTIN_KEYS = RS.BUILTIN_KEYS;
  const ZOOM_STATE = RS.ZOOM_STATE;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const portKey = (inst, port) => RS.portKey ? RS.portKey(inst, port) : JSON.stringify([inst, port]);
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderRackRailsAndSlots = () => RS.renderRackRailsAndSlots && RS.renderRackRailsAndSlots();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const cancelPendingConnection = () => RS.cancelPendingConnection && RS.cancelPendingConnection();
  const fitRackToScreen = (smooth) => RS.fitRackToScreen && RS.fitRackToScreen(smooth);

  function exportVisioSvg() {
    const totalWidth = 700;
    const activeRack = getActiveRack();
    const heightU = activeRack?.heightU || 42;
    const totalHeight = heightU * 32 + 80;

    let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/" 
     width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  
  <style>
    .v-rack-post { fill: #1c202a; stroke: #333a47; stroke-width: 1; }
    .v-u-label { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; fill: #64748b; font-weight: bold; }
    .v-hole { fill: #0d1117; stroke: #3b4252; stroke-width: 0.5; }
    .v-device-body { fill: #1e2430; stroke: #475569; stroke-width: 1; }
    .v-device-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: #38bdf8; font-weight: bold; }
    .v-cable { fill: none; stroke-linecap: round; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5)); }
  </style>

  <!-- LAYER 1: RACK CABINET FRAME AND RAILS -->
  <g v:groupContext="layer" v:layerMember="Rack_Cabinet">
    <text x="350" y="15" text-anchor="middle" font-family="'Segoe UI', Arial" font-size="12" fill="#38bdf8" font-weight="bold">${escapeHtml(activeRack ? activeRack.name : '42U Rack')}</text>
    <rect x="40" y="20" width="620" height="${heightU * 32}" fill="#11141c" stroke="#2d3340" stroke-width="4"/>
    <rect x="40" y="20" width="44" height="${heightU * 32}" class="v-rack-post"/>
    <rect x="616" y="20" width="44" height="${heightU * 32}" class="v-rack-post"/>
`;

    for (let u = heightU; u >= 1; u--) {
      const y = 20 + (heightU - u) * 32;
      svgContent += `
        <line x1="40" y1="${y}" x2="660" y2="${y}" stroke="#1f2430" stroke-width="0.5" stroke-dasharray="2,2"/>
        <text x="62" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
        <text x="638" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
        <rect x="48" y="${y + 6}" width="4" height="4" class="v-hole"/>
        <rect x="48" y="${y + 14}" width="4" height="4" class="v-hole"/>
        <rect x="48" y="${y + 22}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 6}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 14}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 22}" width="4" height="4" class="v-hole"/>
      `;
    }
    svgContent += `  </g>\n`;

    svgContent += `  <!-- LAYER 2: CISCO & NETWORK HARDWARE -->\n  <g v:groupContext="layer" v:layerMember="Network_Devices">\n`;
    if (activeRack) {
      activeRack.devices.forEach(dev => {
        const cat = HARDWARE_CATALOG[dev.catalogKey];
        if (!cat) return;
        const y = 20 + (heightU - dev.topU) * 32;
        const height = dev.uHeight * 32;

        svgContent += `
          <g v:groupContext="shape" v:mID="${dev.instanceId}">
            <rect x="84" y="${y}" width="532" height="${height}" class="v-device-body"/>
            <text x="96" y="${y + 18}" class="v-device-text">${escapeHtml(cat.name)} (U${dev.topU})</text>
            <rect x="96" y="${y + 22}" width="6" height="4" fill="#22c55e"/>
            <rect x="104" y="${y + 22}" width="6" height="4" fill="#38bdf8"/>
          </g>
        `;
      });
    }
    svgContent += `  </g>\n`;

    svgContent += `  <!-- LAYER 3: CABLING RUN SCHEDULE & CONNECTIONS -->\n  <g v:groupContext="layer" v:layerMember="Patch_Cables" transform="translate(40, 20)">\n`;
    const svgLayer = document.getElementById('cables-svg');
    if (svgLayer) {
      const paths = svgLayer.querySelectorAll('.cable-path');
      paths.forEach((p, idx) => {
        const d = p.getAttribute('d');
        const stroke = p.getAttribute('stroke');
        const cable = STATE.cables.find(c => 'svg-cable-' + c.id === p.id) || { id: 'CBL' };
        svgContent += `
          <path d="${d}" stroke="${stroke}" stroke-width="2.8" class="v-cable" v:groupContext="shape">
            <title>${cable.id} (${cable.lengthMeters}m)</title>
          </path>
        `;
      });
    }
    svgContent += `  </g>\n</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dlLink = document.createElement('a');
    dlLink.href = url;
    const safeName = activeRack ? activeRack.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'rack';
    dlLink.download = `cisco-${heightU}u-visio-${safeName}-${new Date().toISOString().slice(0,10)}.svg`;
    document.body.appendChild(dlLink);
    dlLink.click();
    dlLink.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const exportData = {
      version: '4.0-studio',
      customCatalog: STATE.customCatalog,
      timestamp: new Date().toISOString(),
      activeRackId: STATE.activeRackId,
      viewMode: STATE.viewMode || 'single',
      cableRoutingMode: STATE.cableRoutingMode || 'structured',
      racks: STATE.racks,
      cables: STATE.cables
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `cisco-site-topology-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  function validateTopology(data) {
    if (!data || typeof data !== 'object') throw new Error('Geçersiz proje.');
    const customCatalog = JSON.parse(JSON.stringify(data.customCatalog || {}));
    if (Array.isArray(customCatalog) || typeof customCatalog !== 'object') throw new Error('Geçersiz katalog.');
    const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
    for (const [key, cat] of Object.entries(customCatalog)) {
      if (!validId(key) || ['__proto__','constructor','prototype'].includes(key) || BUILTIN_KEYS.has(key) || !cat || !Number.isInteger(cat.u) || cat.u < 1 || cat.u > 60 || !Array.isArray(cat.ports) || typeof cat.name !== 'string') throw new Error('Geçersiz özel cihaz: ' + key);
      const ids = new Set();
      for (const port of cat.ports) { if (!validId(port.id) || ids.has(port.id)) throw new Error('Geçersiz port.'); ids.add(port.id); }
    }
    const catalog = Object.fromEntries([...BUILTIN_KEYS].map(key => [key, HARDWARE_CATALOG[key]]));
    Object.assign(catalog, customCatalog);
    const legacy = !Array.isArray(data.racks);
    const sourceRacks = legacy ? [{id:'rack-1', name:'MDF - Dağıtım Kabini', heightU:data.heightU || 42, devices:data.devices}] : data.racks;
    if (!sourceRacks.length || sourceRacks.length > 1000) throw new Error('Proje en az bir kabin içermeli.');
    const rackIds = new Set(), deviceIds = new Set(), deviceMap = new Map();
    const racks = sourceRacks.map(source => {
      const heightU = source.heightU ?? 42;
      if (!validId(source.id) || rackIds.has(source.id) || typeof source.name !== 'string' || !Number.isInteger(heightU) || heightU < 1 || heightU > 60 || !Array.isArray(source.devices)) throw new Error('Geçersiz kabin.');
      rackIds.add(source.id);
      const units = Array(heightU + 1).fill(null);
      const devices = source.devices.map(dev => {
        const cat = Object.hasOwn(catalog, dev.catalogKey) ? catalog[dev.catalogKey] : null;
        if (!cat || !validId(dev.instanceId) || deviceIds.has(dev.instanceId) || !Number.isInteger(dev.topU) || dev.topU > heightU || dev.topU - cat.u < 0 || (dev.uHeight !== undefined && dev.uHeight !== cat.u)) throw new Error('Geçersiz cihaz veya U konumu.');
        for(let u = dev.topU - cat.u + 1; u <= dev.topU; u++) { if(units[u]) throw new Error('Cihaz yerleşimleri çakışıyor.'); units[u] = dev.instanceId; }
        deviceIds.add(dev.instanceId); deviceMap.set(dev.instanceId, {rackId:source.id, cat});
        return {...dev, uHeight:cat.u};
      });
      return {...source, heightU, units, devices};
    });
    if (data.cables !== undefined && !Array.isArray(data.cables)) throw new Error('Geçersiz kablolar.');
    const cableIds = new Set(), usedPorts = new Set();
    const cables = (data.cables || []).map(c => {
      if(!validId(c.id) || cableIds.has(c.id)) throw new Error('Tekrarlanan/geçersiz kablo kimliği.');
      cableIds.add(c.id);
      const endpoints = ['from','to'].map(side => {
        const endpoint = {...c[side]}; if(legacy && !endpoint.rackId) endpoint.rackId = 'rack-1';
        const device = deviceMap.get(endpoint.instanceId);
        const key = portKey(endpoint.instanceId, endpoint.portId);
        if(!device || endpoint.rackId !== device.rackId || !device.cat.ports.some(p => p.id === endpoint.portId) || usedPorts.has(key)) throw new Error('Geçersiz veya dolu kablo portu.');
        usedPorts.add(key); return endpoint;
      });
      if(c.color && !/^#[0-9a-f]{6}$/i.test(c.color)) throw new Error('Geçersiz kablo rengi.');
      if(c.lengthMeters !== undefined && (!Number.isFinite(c.lengthMeters) || c.lengthMeters < 0)) throw new Error('Geçersiz kablo uzunluğu.');
      return {...c, from:endpoints[0], to:endpoints[1]};
    });
    return {
      racks,
      cables,
      customCatalog,
      activeRackId: rackIds.has(data.activeRackId) ? data.activeRackId : racks[0].id,
      viewMode: (data.viewMode === 'multi' || data.viewMode === 'single') ? data.viewMode : (STATE.viewMode || 'single'),
      cableRoutingMode: data.cableRoutingMode || 'structured'
    };
  }

  function refresh() {
    if (RS.invalidate && RS.flushSync) {
      if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
      RS.invalidate({ all: true });
      RS.flushSync();
    } else {
      renderRackRailsAndSlots();
      renderRackTabs(); renderMountedDevices(); renderScheduleTable(); renderAllCables();
    }
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', {bubbles:true}));
    document.dispatchEvent(new CustomEvent('rackstudio:change', {bubbles:true}));
  }

  function loadCustomTopology(data) {
    const next = validateTopology(data);
    for (const key of Object.keys(HARDWARE_CATALOG)) if (!BUILTIN_KEYS.has(key)) delete HARDWARE_CATALOG[key];
    Object.assign(HARDWARE_CATALOG, next.customCatalog);
    Object.assign(STATE, next);
    if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
    if (next.viewMode && RS.setViewMode) {
      RS.setViewMode(next.viewMode, true);
    }
    STATE.rackCounter = Math.max(0, ...STATE.racks.map(r => Number(r.id.match(/\d+$/)?.[0]) || 0));
    STATE.cableCounter = Math.max(0, ...STATE.cables.map(c => Number(c.id.match(/\d+$/)?.[0]) || 0));
    cancelPendingConnection(); STATE.highlightedCableId = null;
    refresh();
    return true;
  }

  RS.exportVisioSvg = exportVisioSvg;
  RS.exportJson = exportJson;
  RS.validateTopology = validateTopology;
  RS.refresh = refresh;
  RS.loadCustomTopology = loadCustomTopology;
})();
