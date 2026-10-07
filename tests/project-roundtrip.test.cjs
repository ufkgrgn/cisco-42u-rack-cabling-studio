const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'), 'utf8'));
test('3D edits share receipts and undo, reject stale scenes and commit nested cable settings once', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(doc => {
      doc.topology.racks[0].devices[0].portsConfig.p2 = { role: 'trunk', vlan: '20', autoCableColor: false };
      window.RackStudio.loadCustomTopology(doc);
    }, fixture);
    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => window.is3DMode);
    const result = await page.evaluate(async () => {
      const api = window.RackStudio, engine = window.__STUDIO3D__, scene = engine.state;
      const capture = () => api.ProjectDocument.capture(api.STATE);
      const initial = capture();
      const moved = engine.moveDevice('device-1', -1);
      const afterMove = capture();
      const undone = scene.undo(), afterUndo = capture();
      const redone = scene.redo(), afterRedo = capture();
      api.STATE.racks[0].devices[0].hostname = 'newer-2d-value';
      api.flushProjectChanges();
      const live = JSON.stringify(capture());
      scene.devices[0].hostname = 'stale-3d-value';
      const staleAccepted = scene.autoSave();
      const stalePreserved = live === JSON.stringify(capture());
      const sceneRestored = scene.devices[0].hostname === 'newer-2d-value';
      const beforeCable = capture();
      const cable = engine.connectPorts({ devId: 'device-1', portIdx: 2 }, { devId: 'device-2', portIdx: 1 }, '#000000');
      const afterCable = capture();
      const undoCable = scene.undo();
      const afterCableUndo = capture();
      await api.saveProjectNow();
      return { moved, movedU: afterMove.topology.racks[0].devices[0].topU,
        delta: afterMove.revision - initial.revision, receipts: api.ProjectCommands.receipts(afterMove).length,
        undone, undoU: afterUndo.topology.racks[0].devices[0].topU, redone,
        redoU: afterRedo.topology.racks[0].devices[0].topU, staleAccepted, stalePreserved, sceneRestored,
        cableAccepted: !!cable, cableDelta: afterCable.revision - beforeCable.revision,
        cableCount: afterCable.topology.cables.length, undoCable, undoCableCount: afterCableUndo.topology.cables.length,
        inheritedVlan: afterCable.topology.racks[0].devices[1].portsConfig?.[1]?.vlan,
        configsRestored: JSON.stringify(afterCableUndo.topology.racks[0].devices.map(d => d.portsConfig || {})) === JSON.stringify(beforeCable.topology.racks[0].devices.map(d => d.portsConfig || {})),
        records: afterCable.fieldEvents, black: afterCable.topology.cables.at(-1).color };
    });
    assert.equal(result.moved, true); assert.equal(result.movedU, 15);
    assert.equal(result.delta, 1); assert.equal(result.receipts, 1);
    assert.equal(result.undone, true); assert.equal(result.undoU, 16);
    assert.equal(result.redone, true); assert.equal(result.redoU, 15);
    assert.equal(result.staleAccepted, false); assert.equal(result.stalePreserved, true); assert.equal(result.sceneRestored, true);
    assert.equal(result.cableAccepted, true); assert.equal(result.cableDelta, 1); assert.equal(result.cableCount, 2);
    assert.equal(result.inheritedVlan, '20');
    assert.equal(result.undoCable, true); assert.equal(result.undoCableCount, 1); assert.equal(result.configsRestored, true);
    assert.deepEqual(result.records, fixture.fieldEvents); assert.equal(result.black, '#000000');
  } finally { await browser.close(); }
});
test('full project survives ten 2D/3D cycles, 3D edits, snapshots and reload', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(doc => window.RackStudio.loadCustomTopology(doc), fixture);
    for (let index = 0; index < 10; index++) {
      await page.locator('#btn-view-3d').click();
      await page.waitForFunction(() => window.is3DMode === true && window.__STUDIO3D__.state.devices.length === 2);
      assert.equal(await page.evaluate(() => window.__STUDIO3D__.state.autoSave()), true);
      await page.locator('#btn-view-2d').click();
      await page.waitForFunction(() => window.is3DMode === false);
    }
    const saved = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    for (const key of ['projectId', 'revision', 'metadata', 'locations', 'catalogContext', 'observations', 'fieldEvents', 'evidenceRefs', 'handoverRecords', 'integrationMappings', 'extensions', 'futureV1Hint']) assert.deepEqual(saved[key], fixture[key], key);
    assert.deepEqual(saved.topology.customCatalog, fixture.topology.customCatalog);
    assert.equal(saved.topology.racks[0].locationId, 'room-1');
    assert.deepEqual(saved.topology.racks[0].devices[0].vendorNote, { original: true });
    assert.equal(saved.topology.racks[0].devices[0].assetTag, 'ASSET-1');
    assert.deepEqual(saved.topology.racks[0].devices[0].portsConfig, fixture.topology.racks[0].devices[0].portsConfig);
    const cable = saved.topology.cables[0];
    for (const key of ['lengthMeters', 'estimatedLengthMeters', 'measuredLengthMeters', 'purchaseLengthMeters', 'vendorNote']) assert.deepEqual(cable[key], fixture.topology.cables[0][key], key);
    assert.equal(cable.from.label, 'A');
    assert.equal(cable.from.face, 'rear');
    assert.equal(cable.to.portId, 'p2');
    await page.evaluate(() => { window.RackStudio.STATE.cables[0].color = '#000000'; });

    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => window.is3DMode);
    await page.waitForFunction(() => document.querySelector('#studio-save').textContent === 'Yerel kayıt tamam');
    const cameraBefore = await page.evaluate(() => ({ project: JSON.stringify(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE)), writes: window.RackStudio.getPersistenceTelemetry().writes }));
    await page.evaluate(() => window.__STUDIO3D__.fitCameraToRacks('front'));
    await page.waitForTimeout(450);
    const cameraAfter = await page.evaluate(() => ({ project: JSON.stringify(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE)), writes: window.RackStudio.getPersistenceTelemetry().writes }));
    assert.deepEqual(cameraAfter, cameraBefore, 'camera movement must not change or save domain data');
    assert.equal(await page.evaluate(() => window.__STUDIO3D__.state.cables[0].color), 0, 'black must remain numeric zero');
    await page.evaluate(() => {
      const scene = window.__STUDIO3D__.state;
      scene.devices[0].hostname = 'edited-in-3d';
      scene.devices[0].startU = 15;
      scene.autoSave();
    });
    await page.waitForFunction(() => document.querySelector('#studio-save').textContent === 'Yerel kayıt tamam');
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const restored = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(restored.projectId, fixture.projectId);
    assert.equal(restored.topology.racks[0].devices[0].hostname, 'edited-in-3d');
    assert.equal(restored.topology.racks[0].devices[0].topU, 15);
    assert.deepEqual(restored.fieldEvents, fixture.fieldEvents);
    await page.evaluate(() => window.RackStudio.captureSnapshot('Tam belge testi'));
    const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('rack_studio_snapshots_v1'))[0]);
    assert.equal(snapshot.projectDocument.projectId, fixture.projectId);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('unresolved 3D ports reject the entire conversion and preserve the original project', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(doc => window.RackStudio.loadCustomTopology(doc), fixture);
    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => window.is3DMode);
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      window.__STUDIO3D__.state.autoSave();
      const before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const raw = localStorage.getItem('cisco-rack-studio-project');
      const scene = window.__STUDIO3D__.state;
      scene.cables[0].from.portId = 'missing-port';
      const saved = scene.autoSave();
      const error = scene.lastSaveError;
      const restoredPort = scene.cables[0].from.portId;
      const sync = window.sync3Dto2D();
      return { saved, sync, restoredPort, same: before === JSON.stringify(api.ProjectDocument.capture(api.STATE)), rawSame: raw === localStorage.getItem('cisco-rack-studio-project'), error };
    });
    assert.equal(result.saved, false);
    assert.equal(result.sync, true, 'a rejected edit restores a valid scene');
    assert.equal(result.restoredPort, 'p1');
    assert.equal(result.same, true);
    assert.equal(result.rawSame, true);
    assert.match(result.error, /port/i);
  } finally { await browser.close(); }
});
test('native 3D recovery accepts empty projects and rejects corrupted scene payloads atomically', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(doc => window.RackStudio.loadCustomTopology(doc), fixture);
    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => window.is3DMode);
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      const scene = window.__STUDIO3D__.state;
      scene.autoSave();
      const payload = JSON.parse(localStorage.getItem('cisco_rack_studio_3d_state'));
      payload.devices = []; payload.cables = [];
      payload.projectDocument = api.ProjectAdapters.from3D(payload, scene.projectDocument);
      localStorage.setItem('cisco_rack_studio_3d_state', JSON.stringify(payload));
      const empty = new scene.constructor();
      const loadedEmpty = empty.loadAutoSave();
      const before = JSON.stringify({ devices: empty.devices, racks: empty.racks, project: empty.projectDocument });
      payload.devices = [{ id: 'bad-device', catalogId: 'pilot-switch', rackId: 'rack-1', startU: 999, uHeight: 1 }];
      const invalidRaw = JSON.stringify(payload);
      localStorage.setItem('cisco_rack_studio_3d_state', invalidRaw);
      const loadedCorrupt = empty.loadAutoSave();
      return { loadedEmpty, emptyCount: empty.devices.length, loadedCorrupt, unchanged: before === JSON.stringify({ devices: empty.devices, racks: empty.racks, project: empty.projectDocument }), retainedRaw: localStorage.getItem('cisco_rack_studio_3d_state') === invalidRaw };
    });
    assert.deepEqual(result, { loadedEmpty: true, emptyCount: 0, loadedCorrupt: false, unchanged: true, retainedRaw: true });
  } finally { await browser.close(); }
});
