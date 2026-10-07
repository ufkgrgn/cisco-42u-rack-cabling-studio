const { test, expect } = require('playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const themes = ['light', 'dark', 'blueprint', 'high-contrast'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
let server;
let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, content) => {
      if (error) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(content);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

for (const theme of themes) {
  test(`${theme} theme keeps 2D and 3D chrome readable`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('rack-studio-theme', value), theme);
    await page.goto(baseUrl);
    await page.locator('#rack-viewport').waitFor();
    expect(await page.evaluate(async () => {
      await Promise.all([document.fonts.load('500 14px Inter', 'Türkçe'), document.fonts.load('500 14px "JetBrains Mono"', 'Bağlantı')]);
      return document.fonts.check('500 14px Inter', 'Türkçe') && document.fonts.check('500 14px "JetBrains Mono"', 'Bağlantı');
    })).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveScreenshot(`${theme}-2d.png`, {
      animations: 'disabled',
      mask: [page.locator('#rack-viewport')],
      maxDiffPixelRatio: 0.015
    });

    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
    await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#cable-palette-options')).toBeHidden();
    await expect(page).toHaveScreenshot(`${theme}-3d.png`, {
      animations: 'disabled',
      mask: [page.locator('#studio3d-container'), page.locator('#fps-counter')],
      maxDiffPixelRatio: 0.015
    });
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('3D rails and camera fit real one- and three-rack scenes', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  const inspect = async () => page.evaluate(() => {
    const studio = window.__STUDIO3D__;
    studio.scene.updateMatrixWorld(true);
    studio.camera.updateMatrixWorld(true);
    const boxes = studio.rackGroup.children.filter(child => child.name.startsWith('rack_enclosure_'));
    const rails = boxes.flatMap(box => box.children.filter(child => child.geometry?.type === 'BoxGeometry' && child.geometry.parameters.height > 18 && child.geometry.parameters.width === 0.16));
    const corners = boxes.flatMap(box => {
      const bounds = new THREE.Box3().setFromObject(box);
      return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x,y,z).project(studio.camera))));
    });
    return {
      rackCount: boxes.length,
      railCount: rails.length,
      ghostCount: studio.ghostRacksGroup.children.length,
      maxX: Math.max(...corners.map(v => Math.abs(v.x))),
      maxY: Math.max(...corners.map(v => Math.abs(v.y)))
    };
  });

  const one = await inspect();
  expect(one.rackCount).toBe(1);
  expect(one.railCount).toBe(4);
  expect(one.ghostCount).toBe(0);
  expect(one.maxX).toBeLessThan(0.95);
  expect(one.maxY).toBeLessThan(0.95);

  await page.evaluate(() => {
    const studio = window.__STUDIO3D__;
    const seed = studio.state.devices.slice(0, 2);
    studio.state.racks = ['MDF', 'IDF 1', 'IDF 2'].map((name, index) => ({ id: `visual-${index}`, name, heightU: 42 }));
    studio.state.devices = studio.state.racks.flatMap((rack, index) => seed.map((device, offset) => ({ ...device, id: `visual-device-${index}-${offset}`, rackId: rack.id, startU: 35 - offset * 3 })));
    studio.state.cables = [];
    studio.buildRack(42);
    studio.rebuildAllDevices();
    studio.fitCameraToRacks('iso');
  });
  const three = await inspect();
  expect(three.rackCount).toBe(3);
  expect(three.railCount).toBe(12);
  expect(three.maxX).toBeLessThan(0.95);
  expect(three.maxY).toBeLessThan(0.95);
  fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', 'three-racks.png') });
  await page.close();
});

test('device focus centers the front face in 2D and 3D', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseUrl);
  await page.waitForFunction(() => Boolean(window.RackStudio?.focusOnDevice && document.querySelector('#rack-stage .mounted-device')));
  const deviceId = await page.evaluate(() => {
    const device = document.querySelector('#rack-stage .mounted-device');
    const duplicate = document.createElement('div');
    duplicate.dataset.instanceId = device.dataset.instanceId;
    document.body.prepend(duplicate);
    window.RackStudio.focusOnDevice(device.dataset.instanceId, { duration: 80 });
    return device.dataset.instanceId;
  });
  await page.waitForFunction(() => !window.RackStudio.ZOOM_STATE.isFocusing);
  const centered2D = await page.evaluate(id => {
    const canvas = document.getElementById('viewport-canvas').getBoundingClientRect();
    const device = Array.from(document.querySelectorAll('#rack-stage .mounted-device'))
      .find(element => element.dataset.instanceId === id).getBoundingClientRect();
    return { dx: (device.left + device.right - canvas.left - canvas.right) / 2,
      dy: (device.top + device.bottom - canvas.top - canvas.bottom) / 2 };
  }, deviceId);
  expect(Math.abs(centered2D.dx)).toBeLessThan(3);
  expect(Math.abs(centered2D.dy)).toBeLessThan(3);

  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  const centered3D = await page.evaluate(() => {
    const studio = window.__STUDIO3D__;
    const device = studio.state.devices[0];
    studio.selectDevice(device.id);
    document.getElementById('btn-hud-focus').click();
    studio.camera.updateMatrixWorld(true);
    const face = studio.devicesGroup.getObjectByName(device.id).getWorldPosition(new THREE.Vector3()).project(studio.camera);
    return { dx: studio.camera.position.x - studio.controls.target.x,
      dy: studio.camera.position.y - studio.controls.target.y, projectedX: face.x, projectedY: face.y };
  });
  expect(Math.abs(centered3D.dx)).toBeLessThan(0.001);
  expect(Math.abs(centered3D.dy)).toBeLessThan(0.001);
  expect(Math.abs(centered3D.projectedX)).toBeLessThan(0.02);
  expect(Math.abs(centered3D.projectedY)).toBeLessThan(0.02);
  await page.close();
});

test('rack resize consumes gaps and previews before pointer release with one undo', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  const baseline = await page.evaluate(() => {
    const RS = window.RackStudio;
    const planned = RS.planRackResize([{ topU: 42, uHeight: 2 }, { topU: 20, uHeight: 4 }], 42, 6);
    if (JSON.stringify(planned.map(d => d.topU)) !== '[6,4]') throw new Error('Multi-U compaction failed');
    if (RS.planRackResize([{ topU: 42, uHeight: 2 }, { topU: 20, uHeight: 4 }], 42, 5) !== null) throw new Error('Overflow accepted');
    RS.fitRackToScreen();
    return { positions: RS.getActiveRack().devices.map(d => d.topU), cables: JSON.stringify(RS.STATE.cables) };
  });
  await page.waitForTimeout(350);
  const box = await page.locator('.rack-resize-handle').first().boundingBox();
  const scale = await page.evaluate(() => window.RackStudio.ZOOM_STATE.scale);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  expect(await page.evaluate(({x,y}) => Boolean(document.elementFromPoint(x,y)?.closest('.rack-resize-handle')), {x,y})).toBe(true);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 4 * 32 * scale);
  await expect.poll(() => page.evaluate(() => window.RackStudio.getActiveRack().heightU)).toBe(38);
  await page.mouse.move(x, y);
  await expect.poll(() => page.evaluate(() => window.RackStudio.getActiveRack().heightU)).toBe(42);
  expect(await page.evaluate(() => window.RackStudio.getActiveRack().devices.map(d => d.topU))).toEqual(baseline.positions);
  await page.mouse.move(x, y - 4 * 32 * scale);
  await expect.poll(() => page.evaluate(() => window.RackStudio.getActiveRack().heightU)).toBe(38);
  await page.mouse.up();
  await page.locator('[data-command="undo"]').click();
  expect(await page.evaluate(() => window.RackStudio.getActiveRack().heightU)).toBe(42);
  expect(await page.evaluate(() => window.RackStudio.getActiveRack().devices.map(d => d.topU))).toEqual(baseline.positions);
  expect(await page.evaluate(() => JSON.stringify(window.RackStudio.STATE.cables))).toBe(baseline.cables);
  await page.close();
});

test('3D height slider previews only the active rack and preserves other racks', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  await page.evaluate(() => {
    const s = window.__STUDIO3D__;
    const rack = s.state.racks[0];
    s.state.activeRackId = rack.id;
    const other = { ...rack, id: 'resize-other', name: 'Other' };
    s.state.racks.push(other);
    s.state.devices.push({ ...s.state.devices[0], id: 'resize-other-device', rackId: other.id, startU: 42, uHeight: 1 });
    s.buildRack(42); s.rebuildAllDevices();
    const slider = document.getElementById('rack-u-slider');
    slider.value = '30'; slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__STUDIO3D__.state.racks[0].heightU)).toBe(30);
  const result = await page.evaluate(() => {
    const s = window.__STUDIO3D__;
    return { otherHeight: s.state.racks[1].heightU,
      otherU: s.state.devices.find(d => d.id === 'resize-other-device').startU,
      maxU: Math.max(...s.state.devices.filter(d => d.rackId === s.state.activeRackId).map(d => d.startU + d.uHeight - 1)) };
  });
  expect(result.otherHeight).toBe(42);
  expect(result.otherU).toBe(42);
  expect(result.maxU).toBeLessThanOrEqual(30);
  await page.locator('#rack-u-slider').dispatchEvent('change');
  expect(await page.evaluate(() => window.RackStudio.getActiveRack().heightU)).toBe(30);
  await page.close();
});

test('pilot device keeps the same port anchors through 2D and 3D', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const twoD = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('cisco-m-c9200l-24p-4x', 40);
    RS.refresh();
    RS.DeviceSceneRegistry.captureFromDom('pilot-check');
    const device = RS.STATE.racks[0].devices[0];
    const geometry = RS.getPhysicalPortGeometry(device.catalogKey);
    const snapshot = RS.DeviceSceneRegistry.getSnapshot();
    const sceneDevice = snapshot.devices.find(item => item.instanceId === device.instanceId);
    const first = snapshot.ports.find(item => item.instanceId === device.instanceId && item.portId === 'p1');
    return { instanceId: device.instanceId, status: geometry?.verification, normalizedX: (first.x - sceneDevice.x) / sceneDevice.width, normalizedY: (first.y - sceneDevice.y) / sceneDevice.height };
  });
  expect(twoD.status).toBe('approximate');
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.devicesGroup));
  const threeD = await page.evaluate(instanceId => {
    const group = window.__STUDIO3D__.devicesGroup.getObjectByName(instanceId);
    const face = group.children.find(child => child.geometry?.type === 'BoxGeometry' && child.geometry.parameters.depth === 0.03);
    let port;
    group.traverse(child => { if (child.userData?.isPort && child.userData.portIdx === 1) port = child; });
    return { normalizedX: port.position.x / face.geometry.parameters.width + 0.5, normalizedY: 0.5 - port.position.y / face.geometry.parameters.height };
  }, twoD.instanceId);
  expect(Math.abs(twoD.normalizedX - threeD.normalizedX)).toBeLessThan(0.01);
  expect(Math.abs(twoD.normalizedY - threeD.normalizedY)).toBeLessThan(0.01);
  await page.close();
});

test('project search finds hardware and field sheet keeps cable meaning separate from color', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('cisco-m-c9200l-24p-4x', 40);
    RS.mountDeviceAt('patch-cat6-24', 38);
    const [source, target] = RS.STATE.racks[0].devices;
    source.hostname = 'EDGE-42';
    source.serialNumber = 'SERIAL-42';
    RS.STATE.cables.push({ id: 'TRACE-42', name: 'TRACE-42', from: { rackId: 'rack-1', instanceId: source.instanceId, portId: 'p1' }, to: { rackId: 'rack-1', instanceId: target.instanceId, portId: 'p1' }, color: '#ef4444', medium: 'Cat6A', role: 'management', lengthMeters: 2 });
    RS.refresh();
  });
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Komut ara' }).fill('SERIAL-42');
  await expect(page.locator('.command-item')).toContainText(['Cihaz: EDGE-42 · Pilot']);
  await page.getByRole('combobox', { name: 'Komut ara' }).fill('TRACE-42');
  await expect(page.locator('.command-item')).toContainText(['Kablo: TRACE-42']);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.RackStudioFieldSheet.open());
  await expect(page.locator('#field-sheet-body')).toContainText('Cat6A / management');
  await expect(page.locator('#field-sheet-body')).toContainText('#ef4444');
  await page.close();
});

test('local port calibration persists without claiming vendor verification', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.evaluate(() => window.RackStudio.PortCalibrator.open());
  await expect(page.locator('#port-calibrator-dialog')).toBeVisible();
  await page.locator('#cal-model').selectOption('cisco-m-c9200l-24p-4x');
  await page.locator('#cal-port').selectOption('p1');
  await page.locator('.port-calibrator-stage').click({ position: { x: 120, y: 70 } });
  const coordinate = await page.locator('.port-calibrator-values input').first().inputValue();
  await page.getByRole('button', { name: 'Yerel kalibrasyonu kaydet' }).click();
  await expect(page.locator('#port-calibrator-dialog')).toBeHidden();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rack-studio-port-geometry-v1'))['cisco-m-c9200l-24p-4x']);
  expect(stored.verification).toBe('calibrated-local');
  expect(stored.ports.find(port => port.id === 'p1').x).toBe(Number(coordinate));
  await page.reload();
  expect(await page.evaluate(() => window.RackStudio.getPhysicalPortGeometry('cisco-m-c9200l-24p-4x').verification)).toBe('calibrated-local');
  await page.close();
});

test('project geometry calibration survives a 2D and 3D round trip', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const result = await page.evaluate(() => {
    const RS = window.RackStudio;
    const id = 'cisco-m-c9200l-24p-4x';
    const calibrated = structuredClone(RS.getPhysicalPortGeometry(id));
    calibrated.ports[0].x = 0.412;
    RS.applyPortGeometryOverrides({ [id]: calibrated });
    const portable = RS.exportPortGeometryOverrides();
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [], portGeometryOverrides: portable });
    let json = null;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { json = JSON.parse(decodeURIComponent(this.href.split(',')[1])); };
    RS.exportJson();
    HTMLAnchorElement.prototype.click = originalClick;
    RS.loadCustomTopology(json);
    return {
      exportedX: portable[id].ports[0].x,
      activeX: RS.getPhysicalPortGeometry(id).ports[0].x,
      savedX: json.topology.portGeometryOverrides[id].ports[0].x
    };
  });
  expect(result).toEqual({ exportedX: 0.412, activeX: 0.412, savedX: 0.412 });
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.state));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cisco_rack_studio_3d_state'))?.portGeometryOverrides?.['cisco-m-c9200l-24p-4x']?.ports[0].x)).toBe(0.412);
  await page.locator('#btn-view-2d').click();
  expect(await page.evaluate(() => window.RackStudio.getPhysicalPortGeometry('cisco-m-c9200l-24p-4x').ports[0].x)).toBe(0.412);
  await page.close();
});

test('saved views restore the working camera without changing topology', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const original = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Saved view pilot', heightU: 42, devices: [] }], cables: [] });
    const topology = JSON.stringify({ racks: RS.STATE.racks, cables: RS.STATE.cables });
    RS.ZOOM_STATE.scale = 0.75;
    RS.ZOOM_STATE.panX = 83;
    RS.ZOOM_STATE.panY = -42;
    RS.updateStageTransform(false);
    RS.SavedViews.capture('MDF test');
    RS.ZOOM_STATE.scale = 1.2;
    RS.ZOOM_STATE.panX = 0;
    RS.ZOOM_STATE.panY = 0;
    RS.updateStageTransform(false);
    return topology;
  });
  await page.evaluate(() => window.RackStudio.SavedViews.open());
  await expect(page.locator('#saved-view-list')).toContainText('MDF test');
  await page.locator('#saved-view-list button[data-action="open"]').click();
  await expect.poll(() => page.evaluate(() => window.RackStudio.ZOOM_STATE.panX)).toBe(83);
  expect(await page.evaluate(() => {
    const RS = window.RackStudio;
    return { scale: RS.ZOOM_STATE.scale, panY: RS.ZOOM_STATE.panY, topology: JSON.stringify({ racks: RS.STATE.racks, cables: RS.STATE.cables }) };
  })).toEqual({ scale: 0.75, panY: -42, topology: original });
  await page.close();
});

test('offline inventory import reviews observations without changing planned device data', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const deviceId = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('cisco-m-c9200l-24p-4x', 40);
    return RS.STATE.racks[0].devices[0].instanceId;
  });
  await page.evaluate(() => window.RackStudio.InventoryImport.open());
  const csv = `instanceId,hostname,ipAddress,portId,interfaceName,status\n${deviceId},OBSERVED-42,10.1.2.3,p1,Gi1/0/1,up\n`;
  await page.locator('#inventory-import-file').setInputFiles({ name: 'inventory.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('#inventory-import-status')).toContainText('1 eşleşme');
  await page.getByRole('button', { name: 'Seçili gözlemleri kaydet' }).click();
  const result = await page.evaluate(() => {
    const device = window.RackStudio.STATE.racks[0].devices[0];
    return { planned: device.hostname, observed: device.observed };
  });
  expect(result.planned).not.toBe('OBSERVED-42');
  expect(result.observed.hostname).toBe('OBSERVED-42');
  expect(result.observed.interfaces.p1.status).toBe('up');
  await page.evaluate(() => window.RackStudio.ProjectChecks.open());
  await expect(page.locator('#project-checks-summary')).toContainText('3 gözlem farkı');
  await expect(page.locator('.project-check-item.difference').first()).toContainText('OBSERVED-42');
  await page.locator('#project-checks-dialog [data-check-action="close"]').click();
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.state));
  expect(await page.evaluate(id => window.__STUDIO3D__.state.devices.find(device => device.id === id)?.observed?.hostname, deviceId)).toBe('OBSERVED-42');
  await page.locator('#btn-view-2d').click();
  expect(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices[0].observed.hostname)).toBe('OBSERVED-42');
  await page.close();
});

test('circuit trace stops at unknown panel wiring and continues after explicit mapping', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('cisco-m-c9200l-24p-4x', 40);
    RS.mountDeviceAt('patch-cat6-24', 38);
    RS.mountDeviceAt('cisco-m-c9200l-24p-4x', 36);
    const [left, panel, right] = RS.STATE.racks[0].devices;
    RS.STATE.cables.push(
      { id: 'A', name: 'A', from: { rackId: 'rack-1', instanceId: left.instanceId, portId: 'p1' }, to: { rackId: 'rack-1', instanceId: panel.instanceId, portId: 'pt1' }, color: '#2563eb', lengthMeters: 1 },
      { id: 'B', name: 'B', from: { rackId: 'rack-1', instanceId: panel.instanceId, portId: 'pt2' }, to: { rackId: 'rack-1', instanceId: right.instanceId, portId: 'p1' }, color: '#2563eb', lengthMeters: 1 }
    );
    RS.refresh();
  });
  const before = await page.evaluate(() => window.RackStudio.CircuitTrace.trace('A'));
  expect(before.hops.filter(hop => hop.type === 'cable')).toHaveLength(1);
  expect(before.stops.join(' ')).toContain('tanımlı değil');
  await page.evaluate(() => window.RackStudio.CircuitTrace.open('A'));
  await page.locator('.circuit-trace-editor summary').click();
  await page.locator('#trace-port-a').selectOption('pt1');
  await page.locator('#trace-port-b').selectOption('pt2');
  await page.getByRole('button', { name: 'Eşle' }).click();
  const after = await page.evaluate(() => window.RackStudio.CircuitTrace.trace('A'));
  expect(after.hops.map(hop => hop.type)).toEqual(['cable', 'panel', 'cable']);
  expect(after.stops).toEqual([]);
  await page.close();
});

test('theme choice persists without changing rack data and 3D drawer remains operable', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('#rack-viewport').waitFor();
  await expect(page.locator('#rack-empty-state')).toHaveCount(0);
  const before = await page.evaluate(() => JSON.stringify(window.RackStudio?.STATE?.racks ?? window.RackStudio?.state?.racks));
  await page.locator('#btn-tools-menu-toggle').click();
  await page.locator('#btn-theme-toggle').selectOption('high-contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  expect(await page.evaluate(() => localStorage.getItem('rack-studio-theme'))).toBe('high-contrast');
  expect(await page.evaluate(() => JSON.stringify(window.RackStudio?.STATE?.racks ?? window.RackStudio?.state?.racks))).toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  await expect(page.locator('#btn-theme-toggle')).toHaveValue('high-contrast');

  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  const trigger = page.locator('#btn-3d-catalog');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#catalog-search-input')).toBeVisible();
  await trigger.click();
  await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'true');
  await page.close();
});

for (const width of [390, 820]) {
  test(`${width}px 2D panels and 3D catalog are reachable without network fonts`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const externalRequests = [];
    page.on('request', request => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) externalRequests.push(request.url());
    });
    await page.goto(baseUrl);
    await page.locator('#rack-viewport').waitFor();
    await expect(page.locator('#sidebar-right')).toHaveClass(/collapsed/);
    await expect(page.locator('#sidebar-left')).toHaveAttribute('inert', '');
    await expect(page.locator('#sidebar-right')).toHaveAttribute('inert', '');
    if (width > 520) {
      await page.locator('#btn-compact-view').click();
      await expect(page.locator('#compact-view-2d')).toBeVisible();
      await expect(page.locator('#compact-view-3d')).toBeHidden();
      await page.locator('#btn-compact-view').click();
    } else await expect(page.locator('#btn-compact-view')).toBeHidden();
    fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-2d.png`) });
    await page.locator('#btn-mobile-catalog').click();
    await expect(page.locator('#sidebar-left')).not.toHaveAttribute('inert');
    await expect(page.locator('#btn-mobile-catalog')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => (await page.locator('#sidebar-left').boundingBox()).x).toBeGreaterThanOrEqual(-1);
    const catalogBox = await page.locator('#sidebar-left').boundingBox();
    expect(catalogBox.x).toBeGreaterThanOrEqual(-1);
    expect(catalogBox.width).toBeLessThanOrEqual(width + 1);
    await expect(page.locator('#sidebar-drawer')).toBeVisible();
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-catalog.png`) });
    if (width <= 520) await page.locator('#btn-toggle-left-sidebar').click();
    await page.locator('#btn-mobile-schedule').click();
    await expect(page.locator('#sidebar-left')).toHaveAttribute('inert', '');
    await expect(page.locator('#sidebar-right')).not.toHaveAttribute('inert');
    await expect(page.locator('#btn-mobile-catalog')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#btn-mobile-schedule')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar-right')).not.toHaveClass(/collapsed/);
    if (width <= 520) await page.locator('#btn-mobile-schedule-close').click();
    else await page.locator('.sidebar-right-scrim').click({ position: { x: 10, y: 300 } });
    await expect(page.locator('#sidebar-right')).toHaveClass(/collapsed/);
    await expect(page.locator('#sidebar-right')).toHaveAttribute('inert', '');
    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
    await expect(page.locator('.compact-panel-actions')).toBeHidden();
    if (width > 520) {
      await page.locator('#btn-compact-view').click();
      await expect(page.locator('#compact-view-3d')).toBeVisible();
      await expect(page.locator('#compact-view-2d')).toBeHidden();
      await page.locator('#btn-compact-view').click();
    } else await expect(page.locator('.mobile-3d-controls')).toBeVisible();
    await page.locator('#btn-3d-catalog').click();
    await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'false');
    await expect.poll(async () => (await page.locator('#catalog-drawer').boundingBox()).x).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-3d-catalog.png`) });
    expect(externalRequests).toEqual([]);
    await page.close();
  });
}

test('2D pan preserves Pixi backing resolution and port presentation', async ({ page }) => {
  await page.goto(baseUrl);
  await page.waitForFunction(() => Boolean(window.RackStudio?.getPixiPerformanceTelemetry?.().resolution));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const studio = window.RackStudio;
    return { resolution: studio.getPixiPerformanceTelemetry().resolution, changes: studio.getPixiPerformanceTelemetry().resolutionChanges, lod: document.getElementById('rack-stage').dataset.lod };
  });
  const after = await page.evaluate(() => {
    const studio = window.RackStudio;
    for (let step = 0; step < 30; step++) {
      studio.ZOOM_STATE.panX += 2;
      studio.updateStageTransform(false);
    }
    return { resolution: studio.getPixiPerformanceTelemetry().resolution, changes: studio.getPixiPerformanceTelemetry().resolutionChanges, lod: document.getElementById('rack-stage').dataset.lod };
  });
  expect(after).toEqual(before);
  const zoom = await page.evaluate(() => {
    const studio = window.RackStudio;
    const beforeZoom = studio.getPixiPerformanceTelemetry().resolutionChanges;
    studio.setPixiInteractionMode(true);
    studio.updatePixiResolutionForZoom();
    studio.setPixiInteractionMode(false);
    return { beforeZoom, afterZoom: studio.getPixiPerformanceTelemetry().resolutionChanges };
  });
  expect(zoom.afterZoom).toBe(zoom.beforeZoom);
});

test('phone mounting and two-port connection work without dragging', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.goto(baseUrl);
  await page.locator('#rack-viewport').waitFor();
  await page.locator('#btn-mobile-catalog').click();
  await page.locator('.device-card .btn-card-quick-mount').first().click();
  await expect(page.locator('#mobile-workflow-dialog')).toBeVisible();
  await expect(page.locator('#mobile-mount-slot option:disabled').first()).toBeAttached();
  const beforeMount = await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length);
  await page.getByRole('button', { name: 'Yerleştir' }).click();
  expect(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length)).toBe(beforeMount + 1);
  await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Telefon', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('cisco-2960x-24ps', 40);
    RS.mountDeviceAt('patch-cat6-24', 38);
    RS.refresh();
  });
  const devices = await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.map(d => d.instanceId));
  await page.locator('#btn-mobile-selection').click();
  await page.getByRole('button', { name: 'Port seçerek bağla' }).click();
  await page.locator('#mobile-port-device').selectOption(devices[0]);
  await page.locator('.mobile-port-option').first().click();
  await page.locator('#mobile-port-device').selectOption(devices[1]);
  await page.locator('.mobile-port-option').first().click();
  await expect(page.locator('#mobile-workflow-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.RackStudio.STATE.cables.length)).toBe(1);
  await page.close();
});

test('phone schedule scroll area isolates cable picking and opens readable detail', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(baseUrl);
  await page.locator('#btn-mobile-schedule').click();
  await expect(page.locator('#sidebar-right')).not.toHaveClass(/collapsed/);
  expect(await page.evaluate(() => document.getElementById('rack-viewport').inert)).toBe(true);
  const bounds = await page.locator('#sidebar-right').boundingBox();
  expect(bounds.width).toBeGreaterThan(390);
  await expect.poll(async () => (await page.locator('#sidebar-right').boundingBox()).x).toBeLessThanOrEqual(1);
  fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', 'phone-schedule.png') });
  const state = await page.evaluate(() => {
    const target = document.querySelector('.schedule-table-wrapper');
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 11, isPrimary: true, clientX: 180, clientY: 440 }));
    }
    return { hover: window.RackStudio.PixiContext.getHoveredCableId(), selected: window.RackStudio.STATE.highlightedCableId };
  });
  expect(state.hover).toBeNull();
  expect(state.selected).toBeNull();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 720 }] });
  for (let y = 670; y >= 370; y -= 50) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.locator('.schedule-table-wrapper').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.RackStudio.STATE.highlightedCableId)).toBeNull();
  await page.locator('#schedule-tbody tr[data-cable-id]').first().click();
  await expect(page.locator('#sidebar-right')).toHaveClass(/mobile-detail-open/);
  await expect(page.locator('.schedule-inspector-footer')).toBeVisible();
  await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', 'phone-detail.png') });
  await page.locator('#btn-mobile-schedule-close').click();
  expect(await page.evaluate(() => document.getElementById('rack-viewport').inert)).toBe(false);
  const panBefore = await page.evaluate(() => window.RackStudio.ZOOM_STATE.panY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 570 }] });
  for (let y = 540; y >= 390; y -= 30) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.RackStudio.ZOOM_STATE.panY)).not.toBe(panBefore);
  expect(await page.evaluate(() => ({ selected: window.RackStudio.STATE.highlightedCableId, hover: window.RackStudio.PixiContext.getHoveredCableId() }))).toEqual({ selected: null, hover: null });
  await page.close();
});

test('phone 3D view exposes camera presets and zoom', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(baseUrl);
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.camera));
  await expect(page.locator('.mobile-3d-controls')).toBeVisible();
  fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', 'phone-3d.png') });
  await page.locator('.mobile-3d-controls [data-camera-view="front"]').click();
  await expect(page.locator('.mobile-3d-controls [data-camera-view="front"]')).toHaveAttribute('aria-pressed', 'true');
  const before = await page.evaluate(() => window.__STUDIO3D__.camera.position.z);
  await page.locator('.mobile-3d-controls [data-camera-action="zoom-in"]').click();
  expect(await page.evaluate(() => window.__STUDIO3D__.camera.position.z)).toBeLessThan(before);
  await page.close();
});

test('2D panels clear the header and menus block rack pointer targets', async ({ browser }) => {
  for (const width of [1200, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.RackStudio?.toggleActiveFace && window.setToolsOpen);
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.waitForTimeout(250);
    const initial = await page.evaluate(() => {
      const header = document.querySelector('.unified-header').getBoundingClientRect();
      const left = document.querySelector('.sidebar-left').getBoundingClientRect();
      const right = document.querySelector('.sidebar-right').getBoundingClientRect();
      const card = document.querySelector('.sidebar-left .device-card');
      return {
        headerBottom: header.bottom, leftTop: left.top, rightTop: right.top,
        leftWidth: left.width, viewportWidth: document.querySelector('#rack-viewport').clientWidth,
        cardBackground: getComputedStyle(card).backgroundColor,
        panelBackground: getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim(),
        railUsesLucide: !!document.querySelector('.rail-btn .rail-icon svg.ui-icon')
      };
    });
    expect(initial.leftTop).toBe(initial.headerBottom);
    expect(initial.rightTop).toBe(initial.headerBottom);
    expect(initial.railUsesLucide).toBe(true);
    expect(initial.cardBackground).toBe('rgb(28, 27, 25)');
    if (width === 1200) {
      expect(initial.leftWidth).toBe(44);
      expect(initial.viewportWidth).toBeGreaterThan(700);
      await page.evaluate(() => window.setLeftSidebarCollapsed(false));
      await expect.poll(() => page.locator('.sidebar-left').evaluate(el => el.getBoundingClientRect().left)).toBe(0);
      await page.evaluate(() => window.setLeftSidebarCollapsed(true));
    }
    await page.evaluate(() => document.querySelector('#btn-2d-face-toggle').click());
    await expect(page.locator('#btn-2d-face-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.RackStudio.STATE.activeFace)).toBe('rear');
    await page.evaluate(() => window.setToolsOpen(true));
    expect(await page.locator('#rack-viewport').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
    const beforeWheel = await page.evaluate(() => window.RackStudio.ZOOM_STATE.scale);
    await page.mouse.move(Math.min(width / 2, 700), 400);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => page.evaluate(() => window.RackStudio.ZOOM_STATE.scale)).toBeGreaterThan(beforeWheel);
    await page.evaluate(() => window.setToolsOpen(false));
    const openCanvasZoom = await page.evaluate(() => window.RackStudio.ZOOM_STATE.scale);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.RackStudio.ZOOM_STATE.scale)).toBeLessThan(openCanvasZoom);
    await page.close();
  }
});
test('2D device actions keep fixed screen size and ports retain readable proportions', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const deviceId = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('patch-cat6-24', 38);
    RS.refresh();
    const id = RS.STATE.racks[0].devices[0].instanceId;
    document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return id;
  });
  const toolbar = page.locator('#device-floating-controls');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('button[aria-label]')).toHaveCount(3);
  const initial = await toolbar.boundingBox();
  await page.evaluate(() => {
    window.RackStudio.ZOOM_STATE.scale = 0.2;
    window.RackStudio.updateDeviceFloatingControlsPosition(window.RackStudio.getActiveFloatingDeviceId());
  });
  const zoomed = await toolbar.boundingBox();
  expect(Math.abs(initial.width - zoomed.width)).toBeLessThan(1);
  expect(Math.abs(initial.height - zoomed.height)).toBeLessThan(1);
  expect(await toolbar.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  const port = await page.evaluate(() => window.RackStudio.HARDWARE_CATALOG['patch-cat6-24'].portGeometry.ports[0]);
  expect(port.height).toBeGreaterThanOrEqual(0.25);
  await page.close();
});

test('2D action popovers and toolbar menus manage focus and rack hover', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('patch-cat6-24', 38);
    RS.refresh();
    document.getElementById(RS.STATE.racks[0].devices[0].instanceId).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const action = page.locator('#device-floating-controls .autofill-device-btn');
  await expect(page.locator('#device-floating-controls')).toHaveAttribute('role', 'group');
  await action.click();
  const popover = page.locator('.switch-autofill-popover');
  await expect(popover).toBeVisible();
  await expect(action).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('#rack-viewport').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(action).toHaveAttribute('aria-expanded', 'false');
  expect(await action.evaluate(el => el === document.activeElement)).toBe(true);
  await page.locator('#btn-tools-menu-toggle').click();
  await expect(page.locator('#btn-tools-menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('btn-close-tools');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('btn-tools-menu-toggle');
  await page.close();
});

test('2D device actions belong to the selected device, never hover alone', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  const id = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'Pilot', heightU: 42, devices: [] }], cables: [] });
    RS.mountDeviceAt('patch-cat6-24', 38);
    RS.refresh();
    return RS.STATE.racks[0].devices[0].instanceId;
  });
  const deviceBox = await page.locator(`#${id}`).boundingBox();
  await page.mouse.move(deviceBox.x + deviceBox.width / 2, deviceBox.y + deviceBox.height / 2);
  await expect(page.locator('#device-floating-controls')).toBeHidden();
  await expect(page.locator(`#${id} > .device-controls`)).toHaveCount(0);
  await expect(page.locator(`#${id} .device-controls:visible`)).toHaveCount(0);
  await page.evaluate(id => window.RackStudio.setPixiDeviceHover(id), id);
  await expect(page.locator('#device-floating-controls')).toBeHidden();
  await expect(page.locator(`#${id} .device-controls:visible`)).toHaveCount(0);
  await page.evaluate(id => document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
  const toolbar = page.locator('#device-floating-controls');
  await expect(toolbar).toBeVisible();
  await expect(page.locator(`#${id} .device-controls:visible`)).toHaveCount(0);
  await expect(toolbar).toContainText('U38');
  const bounds = await page.evaluate(id => {
    const device = document.getElementById(id).getBoundingClientRect();
    const actions = document.getElementById('device-floating-controls');
    const bar = actions.getBoundingClientRect();
    const side = actions.dataset.side;
    const anchor = side === 'left' || side === 'right'
      ? bar.top + parseFloat(actions.style.getPropertyValue('--device-anchor-y'))
      : bar.left + parseFloat(actions.style.getPropertyValue('--device-anchor-x'));
    const deviceCenter = side === 'left' || side === 'right'
      ? device.top + device.height / 2 : device.left + device.width / 2;
    return { deviceCenter, anchor, side, barBottom: bar.bottom, barTop: bar.top, barLeft: bar.left, barRight: bar.right, deviceTop: device.top, deviceBottom: device.bottom, deviceLeft: device.left, deviceRight: device.right };
  }, id);
  expect(Math.abs(bounds.anchor - bounds.deviceCenter)).toBeLessThan(3);
  expect(bounds.side === 'left' ? bounds.barRight <= bounds.deviceLeft
    : bounds.side === 'right' ? bounds.barLeft >= bounds.deviceRight
      : bounds.side === 'above' ? bounds.barBottom <= bounds.deviceTop
        : bounds.barTop >= bounds.deviceBottom).toBe(true);
  await page.evaluate(id => document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
  await expect(toolbar).toBeHidden();
  await page.close();
});

test('cable inspector actions focus endpoints and open circuit trace', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.RackStudio?.STATE?.cables?.length > 0);
  const cableId = await page.evaluate(() => {
    const RS = window.RackStudio;
    const calls = [];
    const focusDevice = RS.focusOnDevice;
    const focusCable = RS.focusOnCable;
    RS.focusOnDevice = id => { calls.push(['device', id]); return focusDevice(id); };
    RS.focusOnCable = id => { calls.push(['cable', id]); return focusCable(id); };
    window.__inspectorFocusCalls = calls;
    const id = RS.STATE.cables[0].id;
    RS.highlightCable(id, true);
    return id;
  });
  const cable = await page.evaluate(id => window.RackStudio.STATE.cables.find(item => item.id === id), cableId);
  await page.locator('[data-cable-focus="from"]').click();
  await expect.poll(() => page.evaluate(() => window.__inspectorFocusCalls.at(-1))).toEqual(['device', cable.from.instanceId]);
  await page.locator('[data-cable-focus="to"]').click();
  await expect.poll(() => page.evaluate(() => window.__inspectorFocusCalls.at(-1))).toEqual(['device', cable.to.instanceId]);
  await page.locator('[data-cable-focus="both"]').click();
  await expect.poll(() => page.evaluate(() => window.__inspectorFocusCalls.at(-1))).toEqual(['cable', cableId]);
  await page.locator('[data-cable-focus="trace"]').click();
  await expect(page.locator('#circuit-trace-dialog')).toBeVisible();
  await expect(page.locator('#trace-cable')).toHaveValue(cableId);
  await page.close();
});

test('cable detail and circuit trace fit desktop tablet and phone', async ({ browser }) => {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.RackStudio?.STATE?.cables?.length > 0);
    await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.highlightCable(RS.STATE.cables[0].id, true);
      RS.CircuitTrace.open(RS.STATE.cables[0].id);
    });
    const dialog = page.locator('#circuit-trace-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.circuit-trace-editor')).not.toHaveAttribute('open');
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.height).toBeLessThanOrEqual(800 * 0.83);
    if (width === 390) expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(799);
    await dialog.locator('.circuit-trace-editor summary').click();
    await expect(dialog.locator('.circuit-trace-editor')).toHaveAttribute('open');
    await dialog.locator('[data-trace-action="close"]').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#inspector-info .inspector-route')).toHaveCount(1);
    await expect(page.locator('#inspector-info .inspector-actions button')).toHaveCount(4);
    await page.close();
  }
});

test('2D context menus stay compact and usable across viewport sizes', async ({ browser }) => {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.RackStudio?.STATE?.cables?.length > 0);
    await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.showCableContextMenu(RS.STATE.cables[0].id, innerWidth - 2, innerHeight - 2);
    });
    const menu = page.locator('#cable-context-menu');
    await expect(menu).toBeVisible();
    const rect = await menu.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(-1);
    expect(rect.y).toBeGreaterThanOrEqual(-1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(801);
    expect(rect.width).toBeLessThanOrEqual(width <= 600 ? width : 291);
    await expect(menu.locator('.context-color-swatch')).toHaveCount(8);
    await menu.locator('#ctx-duct-left').click();
    await expect(menu).toHaveCount(0);
    const duct = await page.evaluate(() => window.RackStudio.STATE.cables[0].ductSide);
    expect(duct).toBe('left');
    await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.showDeviceContextMenu(RS.STATE.cables[0].from.instanceId, innerWidth - 2, innerHeight - 2);
    });
    const deviceMenu = page.locator('.device-context-menu.cable-context-menu');
    await expect(deviceMenu).toBeVisible();
    const deviceRect = await deviceMenu.boundingBox();
    expect(deviceRect.x).toBeGreaterThanOrEqual(-1);
    expect(deviceRect.y + deviceRect.height).toBeLessThanOrEqual(801);
    await deviceMenu.locator('#ctx-dev-cancel').click();
    await expect(deviceMenu).toHaveCount(0);
    await page.close();
  }
});
