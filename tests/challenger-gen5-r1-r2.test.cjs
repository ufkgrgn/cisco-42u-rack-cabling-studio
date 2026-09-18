const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Adversarial R1 & R2 Stress Test Harness', async (t) => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');

    // Helper to reset and initialize topology
    async function resetTopology() {
      await page.evaluate(() => {
        const RS = window.RackStudio;
        if (typeof RS.cancelPendingConnection === 'function') {
          RS.cancelPendingConnection();
        }
        document.querySelectorAll('.uplink-modal-backdrop').forEach(el => el.remove());

        RS.loadCustomTopology({
          racks: [
            {
              id: 'rack-1',
              name: 'MDF Rack',
              heightU: 42,
              devices: []
            }
          ],
          cables: []
        });

        // Mount all critical test devices
        RS.mountDeviceAt('cisco-nexus-93180yc', 40, 'rack-1'); // Nexus ToR
        RS.mountDeviceAt('cisco-9500-24y4c', 38, 'rack-1');    // Cat9500 Core
        RS.mountDeviceAt('cisco-3850-24s', 36, 'rack-1');      // Cat3850 Fiber Switch
        RS.mountDeviceAt('cisco-2960x-24ps', 34, 'rack-1');    // Cat2960 Access Switch
        RS.mountDeviceAt('patch-cat6-24', 32, 'rack-1');       // Cat6 RJ45 Patch Panel
        RS.mountDeviceAt('fiber-odf-24', 30, 'rack-1');        // LC OM4 Fiber Panel
        RS.mountDeviceAt('fiber-odf-24-sc', 28, 'rack-1');     // SC OS2 Fiber Panel
        RS.mountDeviceAt('pdu-8port-1u', 26, 'rack-1');        // 230V AC PDU
        RS.mountDeviceAt('cisco-isr-4431', 24, 'rack-1');      // Router (RJ45 + SFP)
        RS.mountDeviceAt('cisco-2960x-24ts', 22, 'rack-1');    // Cat2960 TS (Switch 2)
        RS.refresh();
      });

      await page.waitForSelector('.mounted-device');
    }

    await resetTopology();

    // Helper to get device instance IDs
    async function getDeviceMap() {
      return page.evaluate(() => {
        const rack = window.RackStudio.getActiveRack();
        const map = {};
        for (const d of rack.devices) {
          map[d.catalogKey] = d.instanceId;
        }
        return map;
      });
    }

    let devMap = await getDeviceMap();

    // Helper to get tooltip state
    async function getTooltipState() {
      return page.evaluate(() => {
        const tip = document.getElementById('tooltip');
        if (!tip) return { display: 'none', html: '', text: '' };
        return {
          display: tip.style.display,
          html: tip.innerHTML,
          text: tip.textContent || ''
        };
      });
    }

    // -------------------------------------------------------------
    // SCOPE 1: EMPIRICAL TEST OF REQUIREMENT R1 (Media Compatibility & Tooltip Hover Sync)
    // -------------------------------------------------------------

    await t.test('R1.1: Hover and Click Reject RJ45 to 230V PDU AC Socket (Never Green)', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Step 1: Start connection on 2960 RJ45 port p1
      const portRJ45 = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p1"]`);
      await portRJ45.click();

      // Step 2: Hover over PDU power socket pwr1
      const portPDU = page.locator(`.port[data-instance-id="${devMap['pdu-8port-1u']}"][data-port-id="pwr1"]`);
      await portPDU.hover();

      // Verify tooltip
      const tooltipInfo = await getTooltipState();

      // ASSERT: Tooltip must NEVER be green
      assert.ok(!tooltipInfo.html.includes('#22c55e'), 'Tooltip must NOT have green completion color');
      assert.ok(!tooltipInfo.text.includes('Bağlantıyı Tamamla'), 'Tooltip must NOT say Bağlantıyı Tamamla');
      assert.ok(!tooltipInfo.text.includes('Bağlamak için tıklayın'), 'Tooltip must NOT say Bağlamak için tıklayın');
      assert.ok(tooltipInfo.html.includes('#ef4444'), 'Tooltip must have error red color');
      assert.ok(tooltipInfo.text.includes('Bağlantı Uyumsuz'), 'Tooltip must say Bağlantı Uyumsuz');
      assert.ok(tooltipInfo.text.includes('PDU 230V'), 'Tooltip must mention PDU 230V isolation');

      // Step 3: Attempt to click invalid target port
      await portPDU.click();

      // ASSERT: No cable must be created, pending connection must be canceled
      const cablesCount = await page.evaluate(() => window.RackStudio.STATE.cables.length);
      assert.equal(cablesCount, 0, 'No cable created on invalid connection');
      const isPending = await page.evaluate(() => Boolean(window.RackStudio.STATE.pendingConnection));
      assert.equal(isPending, false, 'Pending connection cleared');
    });

    await t.test('R1.2: Hover and Click Reject Copper RJ45 directly into Optical LC ODF in strict mode', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Start connection on Cat6 patch panel RJ45 port pt1
      const portPatch = page.locator(`.port[data-instance-id="${devMap['patch-cat6-24']}"][data-port-id="pt1"]`);
      await portPatch.click();

      // Hover over LC ODF port lc1
      const portLC = page.locator(`.port[data-instance-id="${devMap['fiber-odf-24']}"][data-port-id="lc1"]`);
      await portLC.hover();

      const tooltipInfo = await getTooltipState();

      assert.ok(!tooltipInfo.html.includes('#22c55e'), 'Tooltip must NOT have green color');
      assert.ok(tooltipInfo.text.includes('Bağlantı Uyumsuz'), 'Tooltip must display Bağlantı Uyumsuz');
      assert.ok(tooltipInfo.text.includes('Konnektör Uyuşmazlığı'), 'Tooltip must explain connector mismatch');

      // Click portLC -> must reject
      await portLC.click();
      const cablesCount = await page.evaluate(() => window.RackStudio.STATE.cables.length);
      assert.equal(cablesCount, 0, 'No cable created');
    });

    await t.test('R1.3: Hover and Click Reject Copper RJ45 directly into SFP Cage in strict mode', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Start connection on 2960 RJ45 port p1
      const portRJ45 = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p1"]`);
      await portRJ45.click();

      // Hover over Cat3850 SFP port sfp1
      const portSFP = page.locator(`.port[data-instance-id="${devMap['cisco-3850-24s']}"][data-port-id="sfp1"]`);
      await portSFP.hover();

      const tooltipInfo = await getTooltipState();

      assert.ok(!tooltipInfo.html.includes('#22c55e'), 'Tooltip must NOT have green color');
      assert.ok(tooltipInfo.text.includes('Bağlantı Uyumsuz'), 'Tooltip must state Bağlantı Uyumsuz');
      assert.ok(tooltipInfo.text.includes('SFP yuvasına takılamaz'), 'Tooltip must mention SFP cage mismatch');

      // Click to attempt connection
      await portSFP.click();
      const cablesCount = await page.evaluate(() => window.RackStudio.STATE.cables.length);
      assert.equal(cablesCount, 0, 'No cable created');
    });

    await t.test('R1.4: Cross-connection LC Optical to SC Optical (Fiber Patch) is Valid & Green', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Start connection on LC ODF port lc1
      const portLC = page.locator(`.port[data-instance-id="${devMap['fiber-odf-24']}"][data-port-id="lc1"]`);
      await portLC.click();

      // Hover over SC ODF port sc1
      const portSC = page.locator(`.port[data-instance-id="${devMap['fiber-odf-24-sc']}"][data-port-id="sc1"]`);
      await portSC.hover();

      const tooltipInfo = await getTooltipState();

      assert.ok(tooltipInfo.html.includes('#22c55e'), 'Tooltip MUST have green success color');
      assert.ok(tooltipInfo.text.includes('Bağlantıyı Tamamla'), 'Tooltip must say Bağlantıyı Tamamla');

      // Click to complete connection
      await portSC.click();

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable must be created');
      assert.equal(lastCable.role, 'fiber', 'Role must be fiber');
      assert.equal(lastCable.color, '#facc15', 'Color must be single-mode yellow #facc15');
    });

    await t.test('R1.5: Cross-connection Cat6 Patch Panel to Switch RJ45 is Valid & Green', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect patch panel pt2 to 2960 p2
      const portPatch = page.locator(`.port[data-instance-id="${devMap['patch-cat6-24']}"][data-port-id="pt2"]`);
      await portPatch.click();

      const portRJ45 = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p2"]`);
      await portRJ45.hover();

      const tooltipInfo = await getTooltipState();

      assert.ok(tooltipInfo.html.includes('#22c55e'), 'Tooltip MUST have green success color');

      await portRJ45.click();

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable must be created');
      assert.equal(lastCable.role, 'standard', 'Role must be standard');
    });

    await t.test('R1.6: Cross-connection Nexus 93180 SFP to Cat9500 SFP is Valid & Recognized', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect Nexus Eth1/1 to Cat9500 25GE1/0/1
      const portNexus = page.locator(`.port[data-instance-id="${devMap['cisco-nexus-93180yc']}"][data-port-id="eth1_1"]`);
      await portNexus.click();

      const portCat9500 = page.locator(`.port[data-instance-id="${devMap['cisco-9500-24y4c']}"][data-port-id="p1"]`);
      await portCat9500.hover();

      const tooltipInfo = await getTooltipState();

      assert.ok(tooltipInfo.html.includes('#22c55e'), 'Tooltip MUST have green success color');

      // Click triggers Switch-to-Switch modal
      await portCat9500.click();

      await page.waitForSelector('.uplink-modal-backdrop');
      // Confirm Trunk
      await page.locator('#btn-uplink-approve').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable must be created');
      assert.equal(lastCable.role, 'trunk', 'Role must be trunk');
    });

    // -------------------------------------------------------------
    // SCOPE 2: EMPIRICAL TEST OF REQUIREMENT R2 (Loop Protection & Switch-to-Switch Calibration)
    // -------------------------------------------------------------

    await t.test('R2.1: Strictly Prevent Self-Loops on Active Switches (Nexus, Catalyst, Router)', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Test 1: Nexus 93180 self loop (Eth1/2 -> Eth1/3)
      const nexusPort2 = page.locator(`.port[data-instance-id="${devMap['cisco-nexus-93180yc']}"][data-port-id="eth1_2"]`);
      await nexusPort2.click();

      const nexusPort3 = page.locator(`.port[data-instance-id="${devMap['cisco-nexus-93180yc']}"][data-port-id="eth1_3"]`);
      await nexusPort3.hover();

      const tipNexus = await getTooltipState();
      assert.ok(tipNexus.text.includes('Bağlantı Uyumsuz'), 'Tooltip shows error for self loop');
      assert.ok(tipNexus.text.includes('Döngü Engellendi'), 'Tooltip explicitly explains loop prevention');

      await nexusPort3.click();
      assert.equal(await page.evaluate(() => Boolean(window.RackStudio.STATE.pendingConnection)), false);

      // Test 2: Router self loop (GE0/0/0 -> GE0/0/1)
      const rtrPort0 = page.locator(`.port[data-instance-id="${devMap['cisco-isr-4431']}"][data-port-id="ge0_0_0"]`);
      await rtrPort0.click();

      const rtrPort1 = page.locator(`.port[data-instance-id="${devMap['cisco-isr-4431']}"][data-port-id="ge0_0_1"]`);
      await rtrPort1.hover();

      const tipRouter = await getTooltipState();
      assert.ok(tipRouter.text.includes('Bağlantı Uyumsuz') && tipRouter.text.includes('Döngü Engellendi'), 'Router self loop blocked');

      await rtrPort1.click();
      assert.equal(await page.evaluate(() => Boolean(window.RackStudio.STATE.pendingConnection)), false);
    });

    await t.test('R2.2: Passive Patch Panels / ODFs Allow Cross-Connect Loopback with Advisory Warning', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect patch panel pt3 to pt4 (loopback test)
      const patchPt3 = page.locator(`.port[data-instance-id="${devMap['patch-cat6-24']}"][data-port-id="pt3"]`);
      await patchPt3.click();

      const patchPt4 = page.locator(`.port[data-instance-id="${devMap['patch-cat6-24']}"][data-port-id="pt4"]`);
      await patchPt4.hover();

      const tipPatch = await getTooltipState();

      assert.ok(tipPatch.html.includes('#f59e0b'), 'Tooltip has advisory warning color #f59e0b');
      assert.ok(tipPatch.text.includes('Patch Panel Çapraz Aktarma'), 'Advisory text present');
      assert.ok(tipPatch.text.includes('Bağlamak için tıklayın'), 'User is allowed to connect');

      await patchPt4.click();

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Loopback cable successfully created');
      assert.equal(lastCable.from.instanceId, devMap['patch-cat6-24']);
      assert.equal(lastCable.to.instanceId, devMap['patch-cat6-24']);
    });

    await t.test('R2.3: Switch-to-Switch Calibration: 802.1Q Trunk Mode Approval', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect 2960 p10 to 2960-TS p10
      const portA = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p10"]`);
      await portA.click();

      const portB = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ts']}"][data-port-id="p10"]`);
      await portB.click();

      // Verify modal is displayed with Trunk and Standard Access options
      await page.waitForSelector('.uplink-modal-backdrop');

      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.uplink-modal-backdrop');
        const btnCancel = modal.querySelector('#btn-uplink-cancel');
        const btnStandard = modal.querySelector('#btn-uplink-standard');
        const btnApprove = modal.querySelector('#btn-uplink-approve');
        return {
          hasCancel: Boolean(btnCancel),
          hasStandard: Boolean(btnStandard),
          hasApprove: Boolean(btnApprove),
          standardText: btnStandard ? btnStandard.textContent : '',
          approveText: btnApprove ? btnApprove.textContent : ''
        };
      });

      assert.ok(modalInfo.hasCancel, 'Modal has cancel button');
      assert.ok(modalInfo.hasStandard, 'Modal has standard access button');
      assert.ok(modalInfo.hasApprove, 'Modal has trunk approve button');
      assert.ok(modalInfo.standardText.includes('Standart Access'), 'Button label is Standart Access');

      // Click Trunk button
      await page.locator('#btn-uplink-approve').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable created');
      assert.equal(lastCable.role, 'trunk', 'Role is trunk');
      assert.equal(lastCable.color, '#7c3aed', 'Color is trunk purple #7c3aed');

      // Verify port configs
      const portsConfig = await page.evaluate((devId) => {
        const d = window.RackStudio.getActiveRack().devices.find(x => x.instanceId === devId);
        return d ? d.portsConfig['p10'] : null;
      }, devMap['cisco-2960x-24ps']);

      assert.ok(portsConfig, 'Port config saved');
      assert.equal(portsConfig.role, 'trunk', 'Port role is trunk');
      assert.equal(portsConfig.isTrunk, true, 'isTrunk is true');
    });

    await t.test('R2.4: Switch-to-Switch Calibration: Standard Access Mode Selection', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect 2960 p11 to 2960-TS p11
      const portA = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p11"]`);
      await portA.click();

      const portB = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ts']}"][data-port-id="p11"]`);
      await portB.click();

      await page.waitForSelector('.uplink-modal-backdrop');

      // Click Standard Access button
      await page.locator('#btn-uplink-standard').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable created');
      assert.equal(lastCable.role, 'standard', 'Role is standard access');
    });

    await t.test('R2.5: Switch-to-Switch Calibration: Choice Card Selection (Recommend Card)', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect 2960 p12 to 2960-TS p12
      const portA = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p12"]`);
      await portA.click();

      const portB = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ts']}"][data-port-id="p12"]`);
      await portB.click();

      await page.waitForSelector('.uplink-modal-backdrop');

      // Click the recommended card directly
      await page.locator('#opt-uplink-recommend').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable created');
      assert.equal(lastCable.role, 'trunk', 'Role is trunk');
    });

    await t.test('R2.6: Switch-to-Switch Calibration: Choice Card Selection (Standard Card)', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      // Connect 2960 p13 to 2960-TS p13
      const portA = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p13"]`);
      await portA.click();

      const portB = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ts']}"][data-port-id="p13"]`);
      await portB.click();

      await page.waitForSelector('.uplink-modal-backdrop');

      // Click the standard card directly
      await page.locator('#opt-uplink-standard').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const lastCable = await page.evaluate(() => {
        const cables = window.RackStudio.STATE.cables;
        return cables[cables.length - 1];
      });

      assert.ok(lastCable, 'Cable created');
      assert.equal(lastCable.role, 'standard', 'Role is standard');
    });

    await t.test('R2.7: Switch-to-Switch Calibration: Modal Cancellation Cleans State Without Errors', async () => {
      await resetTopology();
      devMap = await getDeviceMap();

      const prevCablesCount = await page.evaluate(() => window.RackStudio.STATE.cables.length);

      // Connect 2960 p14 to 2960-TS p14
      const portA = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ps']}"][data-port-id="p14"]`);
      await portA.click();

      const portB = page.locator(`.port[data-instance-id="${devMap['cisco-2960x-24ts']}"][data-port-id="p14"]`);
      await portB.click();

      await page.waitForSelector('.uplink-modal-backdrop');

      // Click Cancel button
      await page.locator('#btn-uplink-cancel').click();
      await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

      const postCablesCount = await page.evaluate(() => window.RackStudio.STATE.cables.length);
      assert.equal(postCablesCount, prevCablesCount, 'No cable added on cancellation');

      const isPending = await page.evaluate(() => Boolean(window.RackStudio.STATE.pendingConnection));
      assert.equal(isPending, false, 'Pending connection reset');
    });

    // Verify no uncaught browser page errors occurred
    assert.deepEqual(pageErrors, [], 'No browser runtime errors occurred during test suite');

  } finally {
    await browser.close();
  }
});
