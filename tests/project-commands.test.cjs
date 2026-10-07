const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'), 'utf8'));

test('commands reject stale/conflicting drafts, retain receipts across undo and real reload', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(doc => {
      const api = window.RackStudio;
      doc.topology.cables = [];
      api.loadCustomTopology(doc);
      api.flushProjectChanges();
    }, fixture);
    const applied = await page.evaluate(async () => {
      const api = window.RackStudio, commands = api.ProjectCommands;
      const doc = api.ProjectDocument.capture(api.STATE), rack = doc.topology.racks[0];
      const move = { ...commands.begin(), type: 'MoveDevice', payload: {
        deviceId: rack.devices[0].instanceId, targetRackId: rack.id,
        moves: [{ deviceId: rack.devices[0].instanceId, topU: 15 }, { deviceId: rack.devices[1].instanceId, topU: 13 }]
      } };
      window.testMoveCommand = move;
      window.testStaleCommand = { ...move, commandId: crypto.randomUUID() };
      const result = commands.execute(move);
      const durable = await result.committed;
      const after = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const repeated = commands.execute(move);
      const replayDurable = await repeated.committed;
      return { result, repeated, durable, replayDurable, unchanged: after === JSON.stringify(api.ProjectDocument.capture(api.STATE)), beforeRevision: doc.revision };
    });
    assert.equal(applied.result.revision, applied.beforeRevision + 1);
    assert.equal(applied.durable.status, "durable");
    assert.equal(applied.replayDurable.storageVersion, applied.durable.storageVersion);
    assert.equal(applied.repeated.duplicate, true);
    assert.equal(applied.unchanged, true);
    const rejected = await page.evaluate(() => {
      const api = window.RackStudio;
      const before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const failures = [];
      const overlap = { ...api.ProjectCommands.begin(), type: 'MoveDevice', payload: { ...window.testMoveCommand.payload,
        moves: window.testMoveCommand.payload.moves.map(m => ({ ...m, topU: 10 })) } };
      const wrongProject = { ...overlap, projectId: 'another-project' };
      for (const cmd of [overlap, wrongProject, window.testStaleCommand, { ...window.testMoveCommand, payload: { ...window.testMoveCommand.payload, moves: [{ deviceId: window.testMoveCommand.payload.deviceId, topU: 10 }] } }]) {
        try { api.ProjectCommands.execute(cmd); } catch (error) { failures.push(error.message); }
      }
      return { failures, unchanged: before === JSON.stringify(api.ProjectDocument.capture(api.STATE)) };
    });
    assert.equal(rejected.failures.length, 4);
    assert.equal(rejected.unchanged, true);
    await page.locator('.studio-editor [data-command="undo"]').click();
    const undo = await page.evaluate(() => {
      const api = window.RackStudio;
      const before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const duplicate = api.ProjectCommands.execute(window.testMoveCommand);
      return { doc: api.ProjectDocument.capture(api.STATE), duplicate, unchanged: before === JSON.stringify(api.ProjectDocument.capture(api.STATE)) };
    });
    assert.equal(undo.doc.topology.racks[0].devices[0].topU, fixture.topology.racks[0].devices[0].topU);
    assert.equal(undo.doc.topology.racks[0].devices[1].topU, fixture.topology.racks[0].devices[1].topU);
    assert.equal(undo.doc.revision, applied.result.revision + 1);
    assert.equal(undo.duplicate.duplicate, true);
    assert.equal(undo.unchanged, true);
    await page.locator('.studio-editor [data-command="redo"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.revision), undo.doc.revision + 1);
    const command = await page.evaluate(() => window.testMoveCommand);
    await page.waitForFunction(() => document.querySelector('#studio-save').textContent === 'Yerel kayıt tamam');
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const reloaded = await page.evaluate(cmd => {
      const api = window.RackStudio, before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const result = api.ProjectCommands.execute(cmd);
      return { result, unchanged: before === JSON.stringify(api.ProjectDocument.capture(api.STATE)) };
    }, command);
    assert.equal(reloaded.result.duplicate, true);
    assert.equal(reloaded.unchanged, true);

    const revisionBeforeViews = await page.evaluate(() => window.RackStudio.STATE.projectDocument.revision);
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.locator('#btn-view-3d').click();
      await page.waitForFunction(() => window.is3DMode);
      await page.locator('#btn-view-2d').click();
      await page.waitForFunction(() => !window.is3DMode);
    }
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.revision), revisionBeforeViews);
    assert.equal(await page.evaluate(cmd => window.RackStudio.ProjectCommands.execute(cmd).duplicate, command), true);
    const connection = await page.evaluate(() => {
      const api = window.RackStudio, commands = api.ProjectCommands;
      const doc = api.ProjectDocument.capture(api.STATE), rack = doc.topology.racks[0];
      const endpoint = device => ({ rackId: rack.id, instanceId: device.instanceId, portId: 'p1' });
      const make = id => ({ ...commands.begin(), type: 'ConnectCable', payload: {
        cable: { id, color: '#000000', from: endpoint(rack.devices[0]), to: endpoint(rack.devices[1]), lengthMeters: 0 },
        portConfigs: [{ deviceId: rack.devices[0].instanceId, portsConfig: { p1: { role: 'uplink', color: '#000000' } } }]
      } });
      const valid = make('command-cable');
      const result = commands.execute(valid);
      const occupied = make('occupied-cable');
      occupied.payload.portConfigs[0].portsConfig.p1.color = '#ffffff';
      const before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      let rejected = false;
      try { commands.execute(occupied); } catch (_) { rejected = true; }
      const unchanged = before === JSON.stringify(api.ProjectDocument.capture(api.STATE));
      const pending = { ...commands.begin(), type: 'MoveDevice', payload: window.testMoveCommand?.payload || { deviceId: rack.devices[0].instanceId, targetRackId: rack.id, moves: [{ deviceId: rack.devices[0].instanceId, topU: 12 }] } };
      // A legacy edit before its microtask is recorded must also invalidate the pending intent.
      api.STATE.projectDocument.metadata.name = 'concurrent legacy edit';
      const changed = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      let contentRejected = false;
      try { commands.execute(pending); } catch (_) { contentRejected = true; }
      return { result, rejected, unchanged, contentRejected, contentUnchanged: changed === JSON.stringify(api.ProjectDocument.capture(api.STATE)), length: api.STATE.cables[0].lengthMeters };
    });
    assert.equal(connection.rejected, true);
    assert.equal(connection.unchanged, true);
    assert.equal(connection.contentRejected, true);
    assert.equal(connection.contentUnchanged, true);
    assert.equal(connection.length, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
