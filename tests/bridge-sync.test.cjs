const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('2D <-> 3D Bidirectional Topology & Cable Synchronization', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href;
  await page.goto(fileUrl);
  await page.waitForLoadState('domcontentloaded');

  const result = await page.evaluate(async () => {
    const RS = window.RackStudio;
    if (!RS) throw new Error('RackStudio not loaded');

    // 1. Clear to clean baseline
    RS.STATE.racks = [{
      id: 'rack-1',
      name: 'Test Rack 1',
      heightU: 42,
      units: Array(43).fill(null),
      devices: []
    }];
    RS.STATE.cables = [];
    RS.refresh();

    // 2. Mount 2 devices in 2D
    const dev1 = RS.mountDeviceAt('cisco-2960x-24ps', 40);
    const dev2 = RS.mountDeviceAt('patch-cat6-24', 38);

    // 3. Connect cable between dev1:p1 and dev2:p1 in 2D
    const cable1 = {
      id: 'cable-test-1',
      name: 'Cat6 Test Cable',
      from: { rackId: 'rack-1', instanceId: dev1.instanceId, portId: 'p1' },
      to: { rackId: 'rack-1', instanceId: dev2.instanceId, portId: 'p1' },
      color: '#2563eb',
      lengthMeters: 1.5
    };
    RS.STATE.cables.push(cable1);
    RS.refresh();

    // 4. Switch to 3D mode via UI trigger
    const btn3D = document.getElementById('btn-view-3d');
    if (btn3D) btn3D.click();

    // Wait a brief moment for 3D bridge to load and sync
    await new Promise(r => setTimeout(r, 600));

    const s3d = window.__STUDIO3D__;
    if (!s3d) throw new Error('Studio3D failed to initialize');

    const devicesIn3D = s3d.state.devices.length;
    const cablesIn3D = s3d.state.cables.length;

    // 5. Mount a new device in 3D (e.g. Dell server at U20)
    const mountedIn3D = s3d.mountDevice('dell-r750', 20);

    // 6. Connect a cable in 3D from dell-r750 port 1 to patch-cat6-24 port 2
    const cableIn3D = s3d.connectPorts(
      { devId: mountedIn3D.id, portIdx: 1, rackId: 'rack-1' },
      { devId: dev2.instanceId, portIdx: 2, rackId: 'rack-1' },
      '#22c55e',
      'Server-to-Patch Uplink'
    );

    // 7. Switch back to 2D
    const btn2D = document.getElementById('btn-view-2d');
    if (btn2D) btn2D.click();

    await new Promise(r => setTimeout(r, 400));

    // Verify 2D received the 3D-mounted server and the 3D cable
    const activeRack = RS.getActiveRack();
    const serverIn2D = activeRack.devices.find(d => d.instanceId === mountedIn3D.id || d.catalogKey === 'dell-r750');
    const cableCountIn2D = RS.STATE.cables.length;
    const serverCableIn2D = RS.STATE.cables.find(c => c.name === 'Server-to-Patch Uplink' || (c.from.instanceId === mountedIn3D.id || c.to.instanceId === mountedIn3D.id));

    return {
      devicesIn3D,
      cablesIn3D,
      hasServerIn2D: !!serverIn2D,
      serverTopU: serverIn2D ? serverIn2D.topU : null,
      cableCountIn2D,
      hasServerCableIn2D: !!serverCableIn2D
    };
  });

  await browser.close();

  assert.equal(result.devicesIn3D, 2, '2D devices successfully synced to 3D');
  assert.equal(result.cablesIn3D, 1, '2D cable successfully synced to 3D');
  assert.ok(result.hasServerIn2D, 'Device mounted in 3D seamlessly synced to 2D');
  assert.equal(result.cableCountIn2D, 2, 'Cable created in 3D seamlessly synced to 2D');
  assert.ok(result.hasServerCableIn2D, 'Cable endpoints and metadata preserved across 2D/3D');
  console.log('✔ 2D <-> 3D Bidirectional Sync verified successfully:', result);
});
