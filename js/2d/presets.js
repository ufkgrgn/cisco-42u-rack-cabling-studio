/**
 * Cisco Enterprise Rack & Cabling Studio - Topology Presets (MDF, IDF, Full Site)
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderRackRailsAndSlots = () => RS.renderRackRailsAndSlots && RS.renderRackRailsAndSlots();
  const mountDeviceAt = (...args) => RS.mountDeviceAt && RS.mountDeviceAt(...args);
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const addDirectCable = (...args) => RS.addDirectCable && RS.addDirectCable(...args);

  function loadMdfPreset() {
    STATE.racks = [
      {
        id: 'rack-1',
        name: 'MDF - Ana Dağıtım & WAN Omurga Kabini',
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;
    if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
    renderRackRailsAndSlots();

    const r = STATE.racks[0];

    const dODF = mountDeviceAt('fiber-odf-24', 42, r.id);
    mountDeviceAt('organizer-1u', 41, r.id);
    const dRouter1 = mountDeviceAt('cisco-isr-4431', 40, r.id);
    const dRouter2 = mountDeviceAt('cisco-isr-4431', 39, r.id);
    mountDeviceAt('organizer-1u', 38, r.id);
    const dCoreFiber1 = mountDeviceAt('cisco-3850-24s', 37, r.id);
    const dCoreFiber2 = mountDeviceAt('cisco-3850-24s', 36, r.id);
    mountDeviceAt('organizer-2u', 35, r.id);
    const dCore9300 = mountDeviceAt('cisco-9300l-24p', 33, r.id);
    const dPatch32 = mountDeviceAt('patch-cat6-24', 32, r.id);
    mountDeviceAt('organizer-1u', 31, r.id);
    const dSwitch9200 = mountDeviceAt('cisco-9200l-24p', 30, r.id);
    const dPatch29 = mountDeviceAt('patch-cat6-24', 29, r.id);
    mountDeviceAt('blank-panel-1u', 28, r.id);

    // WAN Router -> Fiber ODF connections
    if (dODF && dRouter1) {
      addDirectCable(r.id, dODF.instanceId, 'lc1', r.id, dRouter1.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
      addDirectCable(r.id, dODF.instanceId, 'lc2', r.id, dRouter2.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    }
    // Routers -> Core Switch 3850 Fiber
    if (dRouter1 && dCoreFiber1) {
      addDirectCable(r.id, dRouter1.instanceId, 'ge0_0_0', r.id, dCoreFiber1.instanceId, 'sfp1', '#ef4444', 1.5);
      addDirectCable(r.id, dRouter2.instanceId, 'ge0_0_0', r.id, dCoreFiber2.instanceId, 'sfp1', '#ef4444', 1.5);
    }
    // Core Fiber Switch 1 <-> Core Fiber Switch 2 (Stack/Interconnect)
    if (dCoreFiber1 && dCoreFiber2) {
      addDirectCable(r.id, dCoreFiber1.instanceId, 'up1', r.id, dCoreFiber2.instanceId, 'up1', '#a855f7', 0.4);
      addDirectCable(r.id, dCoreFiber1.instanceId, 'up2', r.id, dCoreFiber2.instanceId, 'up2', '#a855f7', 0.4);
    }
    // Core 9300L -> Patch Panel
    if (dCore9300 && dPatch32) {
      addDirectCable(r.id, dPatch32.instanceId, 'pt1', r.id, dCore9300.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt2', r.id, dCore9300.instanceId, 'p2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt3', r.id, dCore9300.instanceId, 'p3', '#eab308', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt4', r.id, dCore9300.instanceId, 'p4', '#22c55e', 0.3);
    }
    // 9200L -> Patch Panel 29
    if (dSwitch9200 && dPatch29) {
      addDirectCable(r.id, dPatch29.instanceId, 'pt1', r.id, dSwitch9200.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch29.instanceId, 'pt2', r.id, dSwitch9200.instanceId, 'p2', '#2563eb', 0.3);
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
  }

  function loadIdfPreset() {
    STATE.racks = [
      {
        id: 'rack-1',
        name: 'IDF-1 - Kat 1 Kenar Erişim Kabini',
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;
    if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
    renderRackRailsAndSlots();

    const r = STATE.racks[0];

    const dODF = mountDeviceAt('fiber-odf-24', 42, r.id);
    mountDeviceAt('organizer-1u', 41, r.id);
    const dPatch1 = mountDeviceAt('patch-cat6-24', 40, r.id);
    const dSwitchX1 = mountDeviceAt('cisco-2960x-24ps', 39, r.id);
    mountDeviceAt('organizer-1u', 38, r.id);
    const dPatch2 = mountDeviceAt('patch-cat6-24', 37, r.id);
    const dSwitchPC1 = mountDeviceAt('cisco-2960-24pc', 36, r.id);
    mountDeviceAt('organizer-2u', 35, r.id);
    const dPatch3 = mountDeviceAt('patch-cat6-48', 33, r.id);
    const dSwitchPC2 = mountDeviceAt('cisco-2960-24pc', 32, r.id);
    mountDeviceAt('organizer-1u', 31, r.id);
    const dSwitchTC = mountDeviceAt('cisco-2960-24tc', 30, r.id);
    mountDeviceAt('blank-panel-1u', 29, r.id);

    // ODF Uplink to 2960X SFP
    if (dODF && dSwitchX1) {
      addDirectCable(r.id, dODF.instanceId, 'lc1', r.id, dSwitchX1.instanceId, 'up1', '#06b6d4', 1.2);
    }
    // Patch 1 -> SwitchX1
    if (dPatch1 && dSwitchX1) {
      addDirectCable(r.id, dPatch1.instanceId, 'pt1', r.id, dSwitchX1.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt2', r.id, dSwitchX1.instanceId, 'p2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt3', r.id, dSwitchX1.instanceId, 'p3', '#eab308', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt4', r.id, dSwitchX1.instanceId, 'p4', '#22c55e', 0.3);
    }
    // Patch 2 -> SwitchPC1
    if (dPatch2 && dSwitchPC1) {
      addDirectCable(r.id, dPatch2.instanceId, 'pt1', r.id, dSwitchPC1.instanceId, 'fa1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch2.instanceId, 'pt2', r.id, dSwitchPC1.instanceId, 'fa2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch2.instanceId, 'pt3', r.id, dSwitchPC1.instanceId, 'fa3', '#eab308', 0.3);
    }
    // Patch 3 -> SwitchPC2
    if (dPatch3 && dSwitchPC2) {
      addDirectCable(r.id, dPatch3.instanceId, 'pt1', r.id, dSwitchPC2.instanceId, 'fa1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch3.instanceId, 'pt2', r.id, dSwitchPC2.instanceId, 'fa2', '#2563eb', 0.3);
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
  }

  function loadFullSitePreset() {
    STATE.racks = [
      { id: 'rack-1', name: 'MDF - Ana Dağıtım & Omurga', heightU: 42,
        units: Array(43).fill(null), devices: [] },
      { id: 'rack-2', name: 'IDF-1 - Kat 1 Kenar Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] },
      { id: 'rack-3', name: 'IDF-2 - Kat 2 Kenar Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.rackCounter = 3;
    if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
    renderRackRailsAndSlots();

    const r1 = STATE.racks[0];
    const r2 = STATE.racks[1];
    const r3 = STATE.racks[2];

    // --- POPULATE MDF (Rack 1) ---
    const mdfODF = mountDeviceAt('fiber-odf-24', 42, r1.id);
    mountDeviceAt('organizer-1u', 41, r1.id);
    const mdfRouter1 = mountDeviceAt('cisco-isr-4431', 40, r1.id);
    const mdfRouter2 = mountDeviceAt('cisco-isr-4431', 39, r1.id);
    mountDeviceAt('organizer-1u', 38, r1.id);
    const mdfFiber1 = mountDeviceAt('cisco-3850-24s', 37, r1.id);
    const mdfFiber2 = mountDeviceAt('cisco-3850-24s', 36, r1.id);
    mountDeviceAt('organizer-2u', 35, r1.id);
    const mdfCore9300 = mountDeviceAt('cisco-9300l-24p', 33, r1.id);
    const mdfPatch = mountDeviceAt('patch-cat6-24', 32, r1.id);

    // --- POPULATE IDF-1 (Rack 2) ---
    const idf1ODF = mountDeviceAt('fiber-odf-24', 42, r2.id);
    mountDeviceAt('organizer-1u', 41, r2.id);
    const idf1Patch1 = mountDeviceAt('patch-cat6-24', 40, r2.id);
    const idf1SwX = mountDeviceAt('cisco-2960x-24ps', 39, r2.id);
    mountDeviceAt('organizer-1u', 38, r2.id);
    const idf1Patch2 = mountDeviceAt('patch-cat6-24', 37, r2.id);
    const idf1SwPC = mountDeviceAt('cisco-2960-24pc', 36, r2.id);

    // --- POPULATE IDF-2 (Rack 3) ---
    const idf2ODF = mountDeviceAt('fiber-odf-24', 42, r3.id);
    mountDeviceAt('organizer-1u', 41, r3.id);
    const idf2Patch1 = mountDeviceAt('patch-cat6-24', 40, r3.id);
    const idf2SwXR = mountDeviceAt('cisco-2960xr-24ps', 39, r3.id);
    mountDeviceAt('organizer-1u', 38, r3.id);
    const idf2Patch2 = mountDeviceAt('patch-cat6-24', 37, r3.id);
    const idf2SwPC = mountDeviceAt('cisco-2960-24pc', 36, r3.id);

    // Intra-MDF Cabling
    addDirectCable(r1.id, mdfODF.instanceId, 'lc1', r1.id, mdfRouter1.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    addDirectCable(r1.id, mdfODF.instanceId, 'lc2', r1.id, mdfRouter2.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    addDirectCable(r1.id, mdfRouter1.instanceId, 'ge0_0_0', r1.id, mdfFiber1.instanceId, 'sfp1', '#ef4444', 1.5);
    addDirectCable(r1.id, mdfRouter2.instanceId, 'ge0_0_0', r1.id, mdfFiber2.instanceId, 'sfp1', '#ef4444', 1.5);
    addDirectCable(r1.id, mdfPatch.instanceId, 'pt1', r1.id, mdfCore9300.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r1.id, mdfPatch.instanceId, 'pt2', r1.id, mdfCore9300.instanceId, 'p2', '#2563eb', 0.3);

    // Intra-IDF1 Cabling
    addDirectCable(r2.id, idf1Patch1.instanceId, 'pt1', r2.id, idf1SwX.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r2.id, idf1Patch1.instanceId, 'pt2', r2.id, idf1SwX.instanceId, 'p2', '#2563eb', 0.3);
    addDirectCable(r2.id, idf1Patch2.instanceId, 'pt1', r2.id, idf1SwPC.instanceId, 'fa1', '#2563eb', 0.3);

    // Intra-IDF2 Cabling
    addDirectCable(r3.id, idf2Patch1.instanceId, 'pt1', r3.id, idf2SwXR.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r3.id, idf2Patch2.instanceId, 'pt1', r3.id, idf2SwPC.instanceId, 'fa1', '#2563eb', 0.3);

    // INTER-RACK FIBER BACKBONE CABLES (MDF C3850-24S -> IDF-1 & IDF-2 ODF)
    addDirectCable(r1.id, mdfFiber1.instanceId, 'sfp5', r2.id, idf1ODF.instanceId, 'lc1', '#06b6d4', 45.0);
    addDirectCable(r1.id, mdfFiber2.instanceId, 'sfp5', r2.id, idf1ODF.instanceId, 'lc2', '#06b6d4', 45.0);
    addDirectCable(r1.id, mdfFiber1.instanceId, 'sfp6', r3.id, idf2ODF.instanceId, 'lc1', '#06b6d4', 75.0);
    addDirectCable(r1.id, mdfFiber2.instanceId, 'sfp6', r3.id, idf2ODF.instanceId, 'lc2', '#06b6d4', 75.0);

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
  }

  RS.loadMdfPreset = loadMdfPreset;
  RS.loadIdfPreset = loadIdfPreset;
  RS.loadFullSitePreset = loadFullSitePreset;
})();
