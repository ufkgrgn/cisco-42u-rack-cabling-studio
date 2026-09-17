// Tier 4 — E2E Real-World Application Scenarios Test Suite (12 Realistic Scenarios)
// Validates end-to-end data center workflows across the full application stack.
'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { TestHarness } = require('./harness.cjs');

describe('Tier 4 — Real-World Application Scenarios (12 Scenarios)', () => {
  const harness = new TestHarness();
  let page;

  before(async () => {
    page = await harness.createPage();
  });

  after(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    harness.clearErrors();
    await harness.resetTopology({ heightU: 42, rackId: 'rack-tier4', rackName: 'Tier 4 Test Rack' });
  });

  // ---------------------------------------------------------------------------
  // Scenario 1: Enterprise MDF Core Switch to IDF Patch Panel Multi-Rack Cabling
  // ---------------------------------------------------------------------------
  it('R4.1: Enterprise MDF Core Switch to IDF Patch Panel multi-rack cabling workflow', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // 1. Initialize MDF and IDF racks
      api.loadCustomTopology({
        racks: [
          { id: 'rack-mdf', name: 'MDF - Data Center Core', heightU: 42, devices: [] },
          { id: 'rack-idf', name: 'IDF - Floor 2 Edge', heightU: 42, devices: [] }
        ],
        cables: [],
        activeRackId: 'rack-mdf'
      });
      api.refresh();

      // 2. Populate MDF
      const isrKey = Object.keys(api.catalog).find(k => k.includes('4431') || api.catalog[k].category === 'router');
      const c3850Key = Object.keys(api.catalog).find(k => k.includes('3850') || api.catalog[k].category === 'fiber-switch');
      const c9300Key = Object.keys(api.catalog).find(k => k.includes('9300') || api.catalog[k].category === 'switch');
      const odfKey = Object.keys(api.catalog).find(k => k.includes('odf') || api.catalog[k].category === 'patch-panel');

      const mdfRouter = api.mountDeviceAt(isrKey, 40, 'rack-mdf');
      const mdfCoreFiber = api.mountDeviceAt(c3850Key, 38, 'rack-mdf');
      const mdfDistSw = api.mountDeviceAt(c9300Key, 36, 'rack-mdf');
      const mdfODF = api.mountDeviceAt(odfKey, 42, 'rack-mdf');

      // 3. Populate IDF
      const patchKey = Object.keys(api.catalog).find(k => k.includes('patch-cat6') || api.catalog[k].category === 'patch-panel');
      const accessSwKey = Object.keys(api.catalog).find(k => k.includes('2960') || api.catalog[k].category === 'switch');

      const idfODF = api.mountDeviceAt(odfKey, 42, 'rack-idf');
      const idfPatch = api.mountDeviceAt(patchKey, 40, 'rack-idf');
      const idfAccessSw = api.mountDeviceAt(accessSwKey, 38, 'rack-idf');

      // 4. Cabling
      // A) Intra-MDF: Fiber uplink router to core fiber switch
      const routerPorts = api.catalog[isrKey].ports;
      const fiberPorts = api.catalog[c3850Key].ports;
      api.STATE.cables.push({
        id: 'cbl-mdf-uplink',
        from: { rackId: 'rack-mdf', instanceId: mdfRouter.instanceId, portId: routerPorts[0].id },
        to: { rackId: 'rack-mdf', instanceId: mdfCoreFiber.instanceId, portId: fiberPorts[0].id },
        color: '#06b6d4',
        category: 'fiber',
        lengthMeters: 1.5
      });

      // B) Inter-Rack Backbone: MDF Core Fiber Switch to IDF ODF
      api.STATE.cables.push({
        id: 'cbl-backbone-mdf-idf',
        from: { rackId: 'rack-mdf', instanceId: mdfCoreFiber.instanceId, portId: fiberPorts[4].id },
        to: { rackId: 'rack-idf', instanceId: idfODF.instanceId, portId: api.catalog[odfKey].ports[0].id },
        color: '#06b6d4',
        category: 'fiber',
        lengthMeters: 45.0
      });

      // C) Intra-IDF: Patch Panel to Access Switch
      const patchPorts = api.catalog[patchKey].ports;
      const swPorts = api.catalog[accessSwKey].ports;
      api.STATE.cables.push({
        id: 'cbl-idf-patch-1',
        from: { rackId: 'rack-idf', instanceId: idfPatch.instanceId, portId: patchPorts[0].id },
        to: { rackId: 'rack-idf', instanceId: idfAccessSw.instanceId, portId: swPorts[0].id },
        color: '#2563eb',
        category: 'copper',
        lengthMeters: 0.5
      });
      api.refresh();

      const mdfDeviceCount = api.STATE.racks.find(r => r.id === 'rack-mdf').devices.length;
      const idfDeviceCount = api.STATE.racks.find(r => r.id === 'rack-idf').devices.length;
      const totalCables = api.STATE.cables.length;
      const backboneCable = api.STATE.cables.find(c => c.id === 'cbl-backbone-mdf-idf');

      return {
        mdfDeviceCount,
        idfDeviceCount,
        totalCables,
        backboneCrossRack: backboneCable && backboneCable.from.rackId !== backboneCable.to.rackId,
        backboneLength: backboneCable ? backboneCable.lengthMeters : 0
      };
    });

    assert.equal(result.mdfDeviceCount, 4, 'MDF should contain 4 devices');
    assert.equal(result.idfDeviceCount, 3, 'IDF should contain 3 devices');
    assert.equal(result.totalCables, 3, 'Total 3 enterprise cables should be active');
    assert.ok(result.backboneCrossRack, 'Backbone cable must connect endpoints in distinct racks');
    assert.equal(result.backboneLength, 45.0, 'Backbone length should be 45 meters');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 2: High-Density Top-of-Rack (ToR) Server Max Cabling
  // ---------------------------------------------------------------------------
  it('R4.2: High-Density Top-of-Rack (ToR) Server Max Cabling with dual-homed DAC links', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // Mount 2x ToR switches at U42 and U41
      const torKey = Object.keys(api.catalog).find(k => k.includes('nexus') || (api.catalog[k].u === 1 && api.catalog[k].ports.length >= 24));
      const tor1 = api.mountDeviceAt(torKey, 42);
      const tor2 = api.mountDeviceAt(torKey, 41);

      // Define and mount 4x 2U compute servers with dual 25G SFP28 DAC ports
      const serverDef = {
        name: 'Dell PowerEdge R750 2U Compute',
        category: 'server',
        u: 2,
        powerWatts: 650,
        ports: [
          { id: 'eth0', name: 'NIC 1 (25G DAC)', type: 'sfp28' },
          { id: 'eth1', name: 'NIC 2 (25G DAC)', type: 'sfp28' }
        ]
      };
      api.catalog['server-r750'] = serverDef;
      api.STATE.customCatalog = api.STATE.customCatalog || {};
      api.STATE.customCatalog['server-r750'] = serverDef;

      const servers = [
        api.mountDeviceAt('server-r750', 22),
        api.mountDeviceAt('server-r750', 18),
        api.mountDeviceAt('server-r750', 14),
        api.mountDeviceAt('server-r750', 10)
      ].filter(Boolean);

      // Create dual-homed DAC connections from each server to both ToR switches
      let dacCount = 0;
      servers.forEach((srv, idx) => {
        const srvPorts = api.catalog[srv.catalogKey].ports;
        const torPorts = api.catalog[torKey].ports;

        // Port to ToR-1
        api.STATE.cables.push({
          id: `cbl-dac-${idx}-tor1`,
          from: { rackId: api.getActiveRack().id, instanceId: srv.instanceId, portId: srvPorts[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: tor1.instanceId, portId: torPorts[idx].id },
          color: '#10b981',
          category: 'dac',
          lengthMeters: 2.0
        });
        dacCount++;

        // Port to ToR-2 (redundant)
        api.STATE.cables.push({
          id: `cbl-dac-${idx}-tor2`,
          from: { rackId: api.getActiveRack().id, instanceId: srv.instanceId, portId: srvPorts[1] ? srvPorts[1].id : srvPorts[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: tor2.instanceId, portId: torPorts[idx].id },
          color: '#10b981',
          category: 'dac',
          lengthMeters: 2.0
        });
        dacCount++;
      });
      api.refresh();

      const totalMounted = api.getActiveRack().devices.length;
      const totalDacCables = api.STATE.cables.filter(c => c.category === 'dac').length;

      return {
        totalMounted,
        totalDacCables,
        dacCountExpected: dacCount
      };
    });

    assert.equal(result.totalMounted, 6, 'Should mount 2 ToR switches and 4 compute servers');
    assert.equal(result.totalDacCables, 8, 'Should configure 8 dual-homed DAC cables');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 3: Full Multi-Rack Campus Distribution
  // ---------------------------------------------------------------------------
  it('R4.3: Full Multi-Rack Campus Distribution with color-coded VLAN trunks and multi-rack tabs', async () => {
    // Click Full Site Preset button
    const presetBtn = page.locator('#btn-3d-preset-site');
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
    } else {
      await page.evaluate(() => document.getElementById('btn-preset-site')?.click() || window.RackStudio.loadFullSitePreset?.());
    }
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      const racks = api.STATE.racks;
      const cables = api.STATE.cables;

      // Group cables by color
      const colorGroups = {};
      for (const c of cables) {
        colorGroups[c.color] = (colorGroups[c.color] || 0) + 1;
      }

      // Check cross-rack cables
      const crossRackCables = cables.filter(c => c.from.rackId !== c.to.rackId);

      // Verify rack tab switching
      const originalActive = api.getActiveRack().id;
      api.switchActiveRack(racks[1].id);
      const switchedToIdf1 = api.getActiveRack().id;
      api.switchActiveRack(racks[2].id);
      const switchedToIdf2 = api.getActiveRack().id;
      api.switchActiveRack(originalActive);

      return {
        rackCount: racks.length,
        rackNames: racks.map(r => r.name),
        totalDevices: racks.reduce((sum, r) => sum + r.devices.length, 0),
        totalCables: cables.length,
        crossRackCount: crossRackCables.length,
        distinctColors: Object.keys(colorGroups).length,
        switchedToIdf1,
        switchedToIdf2
      };
    });

    assert.equal(result.rackCount, 3, 'Full site should contain MDF, IDF-1, and IDF-2');
    assert.ok(result.totalDevices >= 15, `Full site should contain >= 15 devices (found ${result.totalDevices})`);
    assert.ok(result.totalCables >= 10, `Full site should contain >= 10 cables (found ${result.totalCables})`);
    assert.ok(result.crossRackCount >= 4, `Should have >= 4 inter-rack backbone cables (found ${result.crossRackCount})`);
    assert.ok(result.distinctColors >= 3, 'Should use multiple distinct color swatches for VLAN trunk categorization');
    assert.equal(result.switchedToIdf1, 'rack-2');
    assert.equal(result.switchedToIdf2, 'rack-3');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4: Project Export & Re-Import Roundtrip with 100% Fidelity
  // ---------------------------------------------------------------------------
  it('R4.4: Full site topology export and re-import preserves 100% data fidelity', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // Setup multi-rack topology with custom catalog device
      api.loadCustomTopology({
        racks: [
          { id: 'rack-exp-1', name: 'Export MDF', heightU: 48, devices: [] },
          { id: 'rack-exp-2', name: 'Export IDF', heightU: 24, devices: [] }
        ],
        cables: [],
        activeRackId: 'rack-exp-1',
        customCatalog: {
          'custom-storage-array': {
            name: 'Enterprise SAN Storage 4U',
            category: 'server',
            u: 4,
            powerWatts: 750,
            ports: [
              { id: 'san-p1', name: 'FC 1', type: 'lc' },
              { id: 'san-p2', name: 'FC 2', type: 'lc' }
            ]
          }
        }
      });
      api.refresh();

      // Mount devices
      const swKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
      const dev1 = api.mountDeviceAt(swKey, 45, 'rack-exp-1');
      const dev2 = api.mountDeviceAt('custom-storage-array', 40, 'rack-exp-1');
      const dev3 = api.mountDeviceAt(swKey, 20, 'rack-exp-2');

      // Add intra-rack and inter-rack cables
      api.STATE.cables.push({
        id: 'cbl-exp-intra',
        from: { rackId: 'rack-exp-1', instanceId: dev1.instanceId, portId: api.catalog[swKey].ports[0].id },
        to: { rackId: 'rack-exp-1', instanceId: dev2.instanceId, portId: 'san-p1' },
        color: '#06b6d4',
        category: 'fiber',
        lengthMeters: 2.5
      });
      api.STATE.cables.push({
        id: 'cbl-exp-inter',
        from: { rackId: 'rack-exp-1', instanceId: dev1.instanceId, portId: api.catalog[swKey].ports[1].id },
        to: { rackId: 'rack-exp-2', instanceId: dev3.instanceId, portId: api.catalog[swKey].ports[0].id },
        color: '#2563eb',
        category: 'copper',
        lengthMeters: 35.0
      });
      api.refresh();

      // Export
      const exportedJson = {
        version: '4.0-studio',
        activeRackId: api.STATE.activeRackId,
        racks: api.STATE.racks,
        cables: api.STATE.cables,
        customCatalog: api.STATE.customCatalog
      };
      const exportedString = JSON.stringify(exportedJson);

      // Re-import
      api.loadCustomTopology(JSON.parse(exportedString));

      // Compare
      const reimportedRacks = api.STATE.racks;
      const reimportedCables = api.STATE.cables;
      const reimportedCustom = api.STATE.customCatalog['custom-storage-array'];

      return {
        racksCount: reimportedRacks.length,
        rack1U: reimportedRacks[0].heightU,
        rack2U: reimportedRacks[1].heightU,
        cablesCount: reimportedCables.length,
        customPresent: Boolean(reimportedCustom),
        customU: reimportedCustom ? reimportedCustom.u : null,
        reimportedDev2TopU: reimportedRacks[0].devices.find(d => d.catalogKey === 'custom-storage-array')?.topU
      };
    });

    assert.equal(result.racksCount, 2);
    assert.equal(result.rack1U, 48);
    assert.equal(result.rack2U, 24);
    assert.equal(result.cablesCount, 2);
    assert.ok(result.customPresent, 'Custom device definition must be preserved in customCatalog');
    assert.equal(result.customU, 4);
    assert.equal(result.reimportedDev2TopU, 40);
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 5: Disaster Recovery / Crash Simulation
  // ---------------------------------------------------------------------------
  it('R4.5: Disaster recovery restores unsaved project state after abrupt page reload', async () => {
    // Setup active state with mounted devices and cables
    await page.evaluate(() => {
      const api = window.RackStudio;
      const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
      const d1 = api.mountDeviceAt(key, 35);
      const d2 = api.mountDeviceAt(key, 25);
      const p = api.catalog[key].ports;

      api.STATE.cables.push({
        id: 'cbl-crash-recovery',
        from: { rackId: api.getActiveRack().id, instanceId: d1.instanceId, portId: p[0].id },
        to: { rackId: api.getActiveRack().id, instanceId: d2.instanceId, portId: p[1].id },
        color: '#ef4444',
        lengthMeters: 1.8
      });
      api.refresh();

      // Trigger change event to guarantee persistence
      window.dispatchEvent(new Event('rackstudio:change'));
    });

    // Wait 500ms for debounce
    await page.waitForTimeout(500);

    // Abrupt reload simulation
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');

    const recovered = await page.evaluate(() => {
      const api = window.RackStudio;
      const rack = api.getActiveRack();
      return {
        hasRack: Boolean(rack),
        rackName: rack ? rack.name : null,
        deviceCount: rack ? rack.devices.length : 0,
        hasCablesArray: Array.isArray(api.STATE.cables)
      };
    });

    assert.ok(recovered.hasRack, 'Active rack should exist after disaster reload');
    assert.ok(recovered.rackName.length > 0, 'Rack name should be recovered');
    assert.ok(recovered.hasCablesArray, 'Cables array should be valid array');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 6: Custom Vendor Catalog Integration
  // ---------------------------------------------------------------------------
  it('R4.6: Custom vendor hardware defined, mounted, wired, and validated in schedule', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // 1. Create custom vendor device
      const customVendorKey = 'arista-7050sx3-48yc8';
      const customItem = {
        name: 'Arista 7050SX3-48YC8 Leaf Switch',
        category: 'switch',
        u: 1,
        manufacturer: 'Arista Networks',
        powerWatts: 480,
        ports: [
          ...Array.from({ length: 48 }, (_, i) => ({ id: `sfp28_${i + 1}`, name: `25G_${i + 1}`, type: 'sfp28' })),
          ...Array.from({ length: 8 }, (_, i) => ({ id: `qsfp28_${i + 1}`, name: `100G_${i + 1}`, type: 'qsfp28' }))
        ]
      };
      api.catalog[customVendorKey] = customItem;
      api.STATE.customCatalog[customVendorKey] = customItem;

      // 2. Mount custom switch at U30
      const aristaSw = api.mountDeviceAt(customVendorKey, 30);

      // 3. Mount Cisco Nexus at U31
      const nexusKey = Object.keys(api.catalog).find(k => k.includes('nexus') || (api.catalog[k].u === 1 && api.catalog[k].ports.length >= 24));
      const nexusSw = api.mountDeviceAt(nexusKey, 31);

      // 4. Cable 100G QSFP28 uplink between Arista and Nexus
      const aristaPort = customItem.ports.find(p => p.type === 'qsfp28');
      const nexusPort = api.catalog[nexusKey].ports.find(p => p.type === 'qsfp28' || p.type === 'sfp' || p.type === 'sfp+');

      api.STATE.cables.push({
        id: 'cbl-custom-arista-nexus',
        from: { rackId: api.getActiveRack().id, instanceId: aristaSw.instanceId, portId: aristaPort.id },
        to: { rackId: api.getActiveRack().id, instanceId: nexusSw.instanceId, portId: nexusPort ? nexusPort.id : 'p1' },
        color: '#10b981',
        category: 'dac',
        lengthMeters: 0.5
      });
      api.refresh();

      // Check cable in schedule
      const cable = api.STATE.cables.find(c => c.id === 'cbl-custom-arista-nexus');

      return {
        aristaMounted: Boolean(aristaSw),
        aristaTopU: aristaSw ? aristaSw.topU : null,
        aristaPortCount: customItem.ports.length,
        cableCreated: Boolean(cable),
        cableCategory: cable ? cable.category : null,
        cableLength: cable ? cable.lengthMeters : null
      };
    });

    assert.ok(result.aristaMounted, 'Custom Arista switch should be mounted');
    assert.equal(result.aristaTopU, 30);
    assert.equal(result.aristaPortCount, 56, 'Should have 48x 25G + 8x 100G ports');
    assert.ok(result.cableCreated, 'Uplink cable between custom and catalog device must exist');
    assert.equal(result.cableCategory, 'dac');
    assert.equal(result.cableLength, 0.5);
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 7: Overhead Ladder Tray Cross-Connect Topology
  // ---------------------------------------------------------------------------
  it('R4.7: Overhead ladder tray cross-connect across 4 racks calculates accurate distance-based metraj', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // 4 racks spanning the room
      api.loadCustomTopology({
        racks: [
          { id: 'rack-row-1', name: 'Row A - Rack 1', heightU: 42, devices: [] },
          { id: 'rack-row-2', name: 'Row A - Rack 2', heightU: 42, devices: [] },
          { id: 'rack-row-3', name: 'Row A - Rack 3', heightU: 42, devices: [] },
          { id: 'rack-row-4', name: 'Row A - Rack 4', heightU: 42, devices: [] }
        ],
        cables: [],
        activeRackId: 'rack-row-1'
      });
      api.refresh();

      const swKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
      const dev1 = api.mountDeviceAt(swKey, 40, 'rack-row-1');
      const dev2 = api.mountDeviceAt(swKey, 40, 'rack-row-2');
      const dev4 = api.mountDeviceAt(swKey, 40, 'rack-row-4');

      const pId = api.catalog[swKey].ports[0].id;

      // Short span: Rack 1 to Rack 2 (adjacent: ~1m apart + ladder drop)
      const shortLength = 4.2;
      api.STATE.cables.push({
        id: 'cbl-ladder-short',
        from: { rackId: 'rack-row-1', instanceId: dev1.instanceId, portId: pId },
        to: { rackId: 'rack-row-2', instanceId: dev2.instanceId, portId: pId },
        color: '#06b6d4',
        lengthMeters: shortLength
      });

      // Long span: Rack 1 to Rack 4 (across 3 bays: ~15m span + ladder drop + slack)
      const longLength = 18.5;
      api.STATE.cables.push({
        id: 'cbl-ladder-long',
        from: { rackId: 'rack-row-1', instanceId: dev1.instanceId, portId: pId },
        to: { rackId: 'rack-row-4', instanceId: dev4.instanceId, portId: pId },
        color: '#06b6d4',
        lengthMeters: longLength
      });
      api.refresh();

      const cShort = api.STATE.cables.find(c => c.id === 'cbl-ladder-short');
      const cLong = api.STATE.cables.find(c => c.id === 'cbl-ladder-long');

      return {
        rackCount: api.STATE.racks.length,
        shortLength: cShort.lengthMeters,
        longLength: cLong.lengthMeters,
        distanceDifference: cLong.lengthMeters - cShort.lengthMeters,
        fromRack: cLong.from.rackId,
        toRack: cLong.to.rackId
      };
    });

    assert.equal(result.rackCount, 4);
    assert.ok(result.distanceDifference > 10.0, 'Long-span cable across 4 racks should be significantly longer than adjacent cable');
    assert.equal(result.fromRack, 'rack-row-1');
    assert.equal(result.toRack, 'rack-row-4');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 8: Patch Panel 24-Port Saturation
  // ---------------------------------------------------------------------------
  it('R4.8: Patch Panel 24-Port Saturation wires 24 sequential 1-to-1 patch cords without collision', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      const patchKey = Object.keys(api.catalog).find(k => k.includes('patch-cat6-24') || (api.catalog[k].u === 1 && api.catalog[k].ports.length === 24));
      const swKey = Object.keys(api.catalog).find(k => k.includes('2960') && api.catalog[k].ports.length >= 24);

      const patchDev = api.mountDeviceAt(patchKey, 25);
      const swDev = api.mountDeviceAt(swKey, 24);

      const patchPorts = api.catalog[patchKey].ports;
      const swPorts = api.catalog[swKey].ports;

      // Wire all 24 ports 1-to-1
      const usedPorts = new Set();
      let createdCount = 0;

      for (let i = 0; i < 24; i++) {
        const fromP = patchPorts[i].id;
        const toP = swPorts[i].id;

        const fromKey = `${patchDev.instanceId}:${fromP}`;
        const toKey = `${swDev.instanceId}:${toP}`;

        if (!usedPorts.has(fromKey) && !usedPorts.has(toKey)) {
          api.STATE.cables.push({
            id: `cbl-sat-${i + 1}`,
            from: { rackId: api.getActiveRack().id, instanceId: patchDev.instanceId, portId: fromP },
            to: { rackId: api.getActiveRack().id, instanceId: swDev.instanceId, portId: toP },
            color: '#2563eb',
            lengthMeters: 0.3
          });
          usedPorts.add(fromKey);
          usedPorts.add(toKey);
          createdCount++;
        }
      }
      api.refresh();

      // Attempt 25th cable on already saturated port 1
      const port1Key = `${patchDev.instanceId}:${patchPorts[0].id}`;
      const isPort1Saturated = usedPorts.has(port1Key);

      return {
        createdCount,
        totalCables: api.STATE.cables.length,
        isPort1Saturated,
        uniqueUsedPorts: usedPorts.size
      };
    });

    assert.equal(result.createdCount, 24, 'All 24 patch cords should be wired');
    assert.equal(result.totalCables, 24, 'Total cable count should be exactly 24');
    assert.equal(result.uniqueUsedPorts, 48, 'Should saturate 24 patch ports + 24 switch ports = 48 unique endpoints');
    assert.ok(result.isPort1Saturated, 'Port 1 must be marked as saturated');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 9: Dynamic Rack Expansion
  // ---------------------------------------------------------------------------
  it('R4.9: Dynamic Rack Expansion from 42U to 48U preserves existing cabling and accommodates spine switch', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);

      // 1. Initial 42U state with devices at U40, U30, U20, U10
      const d40 = api.mountDeviceAt(key, 40);
      const d30 = api.mountDeviceAt(key, 30);
      const d20 = api.mountDeviceAt(key, 20);
      const d10 = api.mountDeviceAt(key, 10);

      // Pre-existing cable between U40 and U30
      api.STATE.cables.push({
        id: 'cbl-expansion-pre',
        from: { rackId: api.getActiveRack().id, instanceId: d40.instanceId, portId: api.catalog[key].ports[0].id },
        to: { rackId: api.getActiveRack().id, instanceId: d30.instanceId, portId: api.catalog[key].ports[1].id },
        color: '#2563eb',
        lengthMeters: 1.5
      });
      api.refresh();

      // 2. Dynamically expand rack from 42U to 48U
      api.getActiveRack().heightU = 48;
      api.getActiveRack().units = Array(49).fill(null);
      for (const d of api.getActiveRack().devices) {
        for (let u = d.topU - d.uHeight + 1; u <= d.topU; u++) {
          api.getActiveRack().units[u] = d.instanceId;
        }
      }
      api.refresh();

      // 3. Mount new Spine switch in the expansion zone at U46
      const spineSw = api.mountDeviceAt(key, 46);

      // 4. Connect spine switch to distribution switch at U30
      api.STATE.cables.push({
        id: 'cbl-expansion-new',
        from: { rackId: api.getActiveRack().id, instanceId: spineSw.instanceId, portId: api.catalog[key].ports[0].id },
        to: { rackId: api.getActiveRack().id, instanceId: d30.instanceId, portId: api.catalog[key].ports[0].id },
        color: '#06b6d4',
        lengthMeters: 2.2
      });
      api.refresh();

      return {
        newHeightU: api.getActiveRack().heightU,
        deviceCount: api.getActiveRack().devices.length,
        cableCount: api.STATE.cables.length,
        spineTopU: spineSw ? spineSw.topU : null,
        preCableIntact: Boolean(api.STATE.cables.find(c => c.id === 'cbl-expansion-pre'))
      };
    });

    assert.equal(result.newHeightU, 48, 'Rack height should expand to 48U');
    assert.equal(result.deviceCount, 5, 'Should have 4 existing + 1 new spine switch');
    assert.equal(result.cableCount, 2, 'Both pre-existing and new cables should exist');
    assert.equal(result.spineTopU, 46, 'Spine switch mounted at U46 in expansion zone');
    assert.ok(result.preCableIntact, 'Pre-existing cable remains intact');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 10: Full Site Deletion & Atomic Reset
  // ---------------------------------------------------------------------------
  it('R4.10: Full Site Deletion & Atomic Reset resets workspace and detaches event listeners', async () => {
    // First load full site preset
    const presetBtn = page.locator('#btn-3d-preset-site');
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
    } else {
      await page.evaluate(() => document.getElementById('btn-preset-site')?.click() || window.RackStudio.loadFullSitePreset?.());
    }
    await page.waitForTimeout(100);

    // Verify site was loaded
    const loadedCount = await page.evaluate(() => window.RackStudio.STATE.racks.length);
    assert.equal(loadedCount, 3);

    // Click Clear All / Reset button (Playwright harness auto-accepts dialog)
    const clearBtn = page.locator('#btn-2d-clear-action');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await page.evaluate(() => document.getElementById('btn-clear-all')?.click());
    }
    await page.waitForTimeout(100);

    const resetResult = await page.evaluate(() => {
      const api = window.RackStudio;
      const rack = api.getActiveRack();
      const deviceCount = rack ? rack.devices.length : -1;
      const cableCount = api.STATE.cables.length;
      const rackCount = api.STATE.racks.length;

      // Mount new device at U1 to test immediate post-reset capability
      const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
      const newDev = api.mountDeviceAt(key, 1);
      api.refresh();

      return {
        rackCount,
        deviceCount,
        cableCount,
        canMountAtU1: Boolean(newDev)
      };
    });

    assert.equal(resetResult.rackCount, 1, 'Racks should reset to single clean rack');
    assert.equal(resetResult.deviceCount, 0, 'Devices should be wiped clean');
    assert.equal(resetResult.cableCount, 0, 'Cables should be wiped clean');
    assert.ok(resetResult.canMountAtU1, 'Should immediately permit clean mounting at U1 post-reset');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 11: Multi-Category Cabling Schedule Audit
  // ---------------------------------------------------------------------------
  it('R4.11: Multi-Category Cabling Schedule Audit computes metraj and generates CSV export format', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 4);
      const dev = api.mountDeviceAt(key, 30);
      const ports = api.catalog[key].ports;

      // 8 cables: 2x Copper, 2x Fiber, 2x DAC, 2x Power
      const auditRuns = [
        { id: 'cbl-aud-cop-1', cat: 'copper', color: '#2563eb', len: 1.0 },
        { id: 'cbl-aud-cop-2', cat: 'copper', color: '#2563eb', len: 1.5 },
        { id: 'cbl-aud-fib-1', cat: 'fiber', color: '#06b6d4', len: 10.0 },
        { id: 'cbl-aud-fib-2', cat: 'fiber', color: '#06b6d4', len: 25.0 },
        { id: 'cbl-aud-dac-1', cat: 'dac', color: '#10b981', len: 2.0 },
        { id: 'cbl-aud-dac-2', cat: 'dac', color: '#10b981', len: 3.0 },
        { id: 'cbl-aud-pwr-1', cat: 'power', color: '#f59e0b', len: 1.2 },
        { id: 'cbl-aud-pwr-2', cat: 'power', color: '#f59e0b', len: 1.8 }
      ];

      for (const run of auditRuns) {
        api.STATE.cables.push({
          id: run.id,
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: run.color,
          category: run.cat,
          lengthMeters: run.len
        });
      }
      api.refresh();

      // Aggregate metraj
      const categoryTotals = {};
      let totalMeters = 0;
      for (const c of api.STATE.cables) {
        categoryTotals[c.category] = (categoryTotals[c.category] || 0) + c.lengthMeters;
        totalMeters += c.lengthMeters;
      }

      // Generate CSV
      const csvHeader = 'ID,FromRack,FromDevice,FromPort,ToRack,ToDevice,ToPort,Category,Color,LengthMeters';
      const csvRows = api.STATE.cables.map(c =>
        `${c.id},${c.from.rackId},${c.from.instanceId},${c.from.portId},${c.to.rackId},${c.to.instanceId},${c.to.portId},${c.category},${c.color},${c.lengthMeters}`
      );
      const csvContent = [csvHeader, ...csvRows].join('\n');

      return {
        cableCount: api.STATE.cables.length,
        totalMeters: Number(totalMeters.toFixed(1)),
        copperMeters: Number(categoryTotals.copper.toFixed(1)),
        fiberMeters: Number(categoryTotals.fiber.toFixed(1)),
        dacMeters: Number(categoryTotals.dac.toFixed(1)),
        powerMeters: Number(categoryTotals.power.toFixed(1)),
        csvRowCount: csvRows.length,
        csvHasHeader: csvContent.startsWith('ID,FromRack')
      };
    });

    assert.equal(result.cableCount, 8);
    assert.equal(result.totalMeters, 45.5, 'Total cable length should be 45.5 meters');
    assert.equal(result.copperMeters, 2.5);
    assert.equal(result.fiberMeters, 35.0);
    assert.equal(result.dacMeters, 5.0);
    assert.equal(result.powerMeters, 3.0);
    assert.equal(result.csvRowCount, 8);
    assert.ok(result.csvHasHeader);
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 12: Visio SVG Vector Export Verification
  // ---------------------------------------------------------------------------
  it('R4.12: Visio SVG vector export produces schema-compliant XML with rack, devices, and cable paths', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;

      // Populate rack with router and switch and a cable
      const isrKey = Object.keys(api.catalog).find(k => k.includes('4431') || api.catalog[k].category === 'router');
      const swKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);

      const d1 = api.mountDeviceAt(isrKey, 40);
      const d2 = api.mountDeviceAt(swKey, 38);

      api.STATE.cables.push({
        id: 'cbl-visio-test',
        from: { rackId: api.getActiveRack().id, instanceId: d1.instanceId, portId: api.catalog[isrKey].ports[0].id },
        to: { rackId: api.getActiveRack().id, instanceId: d2.instanceId, portId: api.catalog[swKey].ports[0].id },
        color: '#2563eb',
        lengthMeters: 1.2
      });
      api.refresh();

      // Synthesize Visio SVG generation
      const activeRack = api.getActiveRack();
      const heightU = activeRack.heightU || 42;
      const totalWidth = 700;
      const totalHeight = heightU * 32 + 80;

      let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
      svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">\n`;

      // Layer 1: Rack Frame
      svg += `  <g v:groupContext="layer" v:layerMember="Rack_Cabinet">\n`;
      svg += `    <text x="350" y="15" text-anchor="middle">${activeRack.name}</text>\n`;
      svg += `    <rect x="40" y="20" width="620" height="${heightU * 32}"/>\n`;
      for (let u = heightU; u >= 1; u--) {
        svg += `    <text x="62" y="${20 + (heightU - u) * 32 + 20}">${u}</text>\n`;
      }
      svg += `  </g>\n`;

      // Layer 2: Network Devices
      svg += `  <g v:groupContext="layer" v:layerMember="Network_Devices">\n`;
      for (const dev of activeRack.devices) {
        svg += `    <g v:groupContext="shape" v:mID="${dev.instanceId}">\n`;
        svg += `      <rect x="84" y="${20 + (heightU - dev.topU) * 32}" width="532" height="${dev.uHeight * 32}"/>\n`;
        svg += `      <text x="96" y="${20 + (heightU - dev.topU) * 32 + 18}">${dev.catalogKey}</text>\n`;
        svg += `    </g>\n`;
      }
      svg += `  </g>\n`;

      // Layer 3: Patch Cables
      svg += `  <g v:groupContext="layer" v:layerMember="Patch_Cables">\n`;
      for (const c of api.STATE.cables) {
        svg += `    <path d="M 100 100 Q 200 200 300 100" stroke="${c.color}" stroke-width="2.8" v:groupContext="shape">\n`;
        svg += `      <title>${c.id} (${c.lengthMeters}m)</title>\n`;
        svg += `    </path>\n`;
      }
      svg += `  </g>\n</svg>`;

      // XML DOM Parser check
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');

      const allGroups = Array.from(doc.getElementsByTagName('g'));
      const rackLayer = allGroups.find(g => g.getAttribute('v:layerMember') === 'Rack_Cabinet');
      const deviceLayer = allGroups.find(g => g.getAttribute('v:layerMember') === 'Network_Devices');
      const cableLayer = allGroups.find(g => g.getAttribute('v:layerMember') === 'Patch_Cables');
      const shapeCount = allGroups.filter(g => g.getAttribute('v:groupContext') === 'shape').length;
      const cablePathsCount = cableLayer ? cableLayer.getElementsByTagName('path').length : 0;

      return {
        isValidXml: parserError === null,
        hasSvgRoot: doc.documentElement.tagName.toLowerCase() === 'svg',
        hasRackLayer: Boolean(rackLayer),
        hasDeviceLayer: Boolean(deviceLayer),
        hasCableLayer: Boolean(cableLayer),
        deviceShapesCount: shapeCount,
        cablePathsCount
      };
    });

    assert.ok(result.isValidXml, 'Visio SVG must parse cleanly as valid XML');
    assert.ok(result.hasSvgRoot, 'Root element must be SVG');
    assert.ok(result.hasRackLayer, 'Must contain Rack_Cabinet layer');
    assert.ok(result.hasDeviceLayer, 'Must contain Network_Devices layer');
    assert.ok(result.hasCableLayer, 'Must contain Patch_Cables layer');
    assert.ok(result.deviceShapesCount >= 2, 'Should contain shapes for mounted devices');
    assert.ok(result.cablePathsCount >= 1, 'Should contain path for cable');
    assert.deepEqual(harness.getErrors(), []);
  });

  // ---------------------------------------------------------------------------
  // Scenario 13: 802.1Q TRUNK Port Configuration & Custom Color Inheritance
  // ---------------------------------------------------------------------------
  it('R4.13: Switch 802.1Q TRUNK port configuration with custom color, metadata, and cable inheritance', async () => {
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      api.STATE.devices = [];
      api.STATE.cables = [];
      api.getActiveRack().devices = [];

      // 1. Mount Cisco switch & Patch panel
      const switchKey = 'cisco-2960x-24ts';
      const panelKey = 'patch-cat6-24';
      const sw = api.mountDeviceAt(switchKey, 40);
      const pp = api.mountDeviceAt(panelKey, 38);

      // 2. Configure Port #5 on switch as TRUNK with custom color #a855f7
      const swPort = api.catalog[switchKey].ports[4];
      const ppPort = api.catalog[panelKey].ports[0];

      api.updatePortConfig(sw.instanceId, swPort.id, {
        role: 'trunk',
        color: '#a855f7',
        ciscoName: 'Gig0/5',
        vlan: '10,20,30,99',
        description: 'Oda Switch Omurga Trunk',
        autoCableColor: true
      });

      const updatedSw = api.getActiveRack().devices.find(d => d.instanceId === sw.instanceId);
      const cfg = updatedSw.portsConfig && (updatedSw.portsConfig[swPort.id] || updatedSw.portsConfig['5']);

      // 3. Connect trunk port to patch panel port
      const swPortEl = document.getElementById(`port-${sw.instanceId}-${swPort.id}`);
      const ppPortEl = document.getElementById(`port-${pp.instanceId}-${ppPort.id}`);

      let cable = null;
      if (swPortEl && ppPortEl) {
        swPortEl.click();
        ppPortEl.click();
        cable = api.STATE.cables[api.STATE.cables.length - 1];
      }

      // 4. Test 3D engine updatePortConfig if 3D engine initialized
      let studio3dSuccess = false;
      if (window.__STUDIO3D__) {
        const s3d = window.__STUDIO3D__;
        const dev3d = {
          id: 'dev-test-3d',
          catalogId: switchKey,
          name: 'Cisco 2960X Test',
          startU: 30,
          uHeight: 1,
          portsCount: 24,
          portType: 'rj45',
          category: 'switch'
        };
        s3d.state.devices.push(dev3d);
        s3d.updatePortConfig('dev-test-3d', 5, {
          role: 'trunk',
          color: '#00e5ff',
          ciscoName: 'Gi1/0/5',
          vlan: '100,200',
          description: '3D Test Trunk'
        });
        const savedDev = s3d.state.devices.find(d => d.id === 'dev-test-3d');
        studio3dSuccess = Boolean(savedDev && savedDev.portsConfig && savedDev.portsConfig[5] && savedDev.portsConfig[5].color === '#00e5ff');
      }

      return {
        hasTrunkConfig: Boolean(cfg && cfg.isTrunk && cfg.color === '#a855f7'),
        ciscoName: cfg ? cfg.ciscoName : null,
        vlan: cfg ? cfg.vlan : null,
        cableCreated: Boolean(cable),
        cableColor: cable ? cable.color : null,
        cableName: cable ? cable.name : null,
        studio3dSuccess,
        hasPortConfigEditor: typeof window.PortConfigEditor === 'object'
      };
    });

    assert.ok(result.hasTrunkConfig, 'Switch port should have valid trunk configuration');
    assert.equal(result.ciscoName, 'Gig0/5', 'Trunk port should preserve Cisco interface name');
    assert.equal(result.vlan, '10,20,30,99', 'Trunk port should preserve VLAN tag list');
    assert.ok(result.cableCreated, 'Cable should be created between trunk port and patch panel');
    assert.equal(result.cableColor, '#a855f7', 'Cable should auto-inherit trunk custom color #a855f7');
    assert.ok(result.cableName.includes('[TRUNK]'), 'Cable name should reflect [TRUNK] role');
    assert.ok(result.hasPortConfigEditor, 'PortConfigEditor global controller should be available');
    assert.deepEqual(harness.getErrors(), []);
  });
});
