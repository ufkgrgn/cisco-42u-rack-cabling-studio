const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'), 'utf8'));
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
async function setup(browser) {
  const page = await browser.newPage();
  await page.goto(url); await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(doc => window.RackStudio.loadCustomTopology(doc), fixture);
  await page.locator('#btn-view-3d').click(); await page.waitForFunction(() => window.is3DMode);
  return page;
}
const payload = doc => ({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
test('3D full JSON download, import, duplicate copy, native migration and rejected files preserve projects', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.locator('#btn-tools-menu-toggle').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-json-3d').click();
    const downloaded = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await downloaded.path(), 'utf8'));
    for (const key of ['projectId','revision','metadata','locations','catalogContext','observations','fieldEvents','evidenceRefs','handoverRecords','integrationMappings','extensions','futureV1Hint']) assert.deepEqual(exported[key], fixture[key], key);
    const input = page.locator('#file-import-3d');
    const imported = structuredClone(fixture); imported.projectId = 'external-project'; imported.evidenceRefs[0].projectId = imported.projectId;
    await input.setInputFiles(payload(imported));
    await page.waitForFunction(() => window.__STUDIO3D__.state.projectDocument.projectId === 'external-project');
    let current = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.deepEqual(current.fieldEvents, fixture.fieldEvents); assert.deepEqual(current.extensions, fixture.extensions);
    await input.setInputFiles(payload(imported));
    await page.waitForFunction(() => window.RackStudio.STATE.projectDocument.projectId !== 'external-project');
    current = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(current.metadata.sourceProjectId, 'external-project'); assert.equal(current.evidenceRefs[0].projectId, current.projectId);
    assert.equal(await page.evaluate(async () => (await window.RackStudio.ProjectRepository.get('external-project')).document.revision), 7);
    await page.waitForFunction(() => !document.querySelector('#btn-import-json-3d').disabled);
    const before = JSON.stringify(current);
    for (const invalid of [{ ...imported, schemaVersion: 999 }, { ...imported, topology: { ...imported.topology, cables: [{ ...imported.topology.cables[0], from: { ...imported.topology.cables[0].from, portId: 'missing' } }] } }]) {
      await input.setInputFiles(payload(invalid));
      await page.waitForFunction(() => !document.querySelector('#btn-import-json-3d').disabled);
      assert.equal(await page.evaluate(() => JSON.stringify(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE))), before);
    }
    const native = await page.evaluate(() => ({ version: '3.1.0-3D', rackHeightU: 18,
      customCatalog: window.RackStudio.STATE.customCatalog, devices: window.__STUDIO3D__.state.devices,
      cables: window.__STUDIO3D__.state.cables, legacyHint: 'retained' }));
    await input.setInputFiles(payload(native));
    await page.waitForFunction(() => window.RackStudio.STATE.projectDocument.metadata.migratedFrom === '3.1.0-3D');
    const legacy = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(legacy.topology.racks[0].devices.length, 2); assert.equal(legacy.topology.cables[0].from.portId, 'p1');
    assert.equal(legacy.extensions.native3DImport.legacyHint, 'retained'); assert.deepEqual(errors, []);
    await input.setInputFiles(payload({ version: '3.1.0-3D', rackHeightU: 42,
      devices: [{ id: 'legacy-panel', catalogId: 'patch-cat6-48p', name: 'Old 2U panel', startU: 38, uHeight: 2, portsCount: 48, portType: 'rj45' }], cables: [] }));
    await page.waitForFunction(() => window.RackStudio.STATE.racks[0].devices[0]?.instanceId === 'legacy-panel');
    const oldPanel = await page.evaluate(() => ({ device: window.RackStudio.STATE.racks[0].devices[0], catalog: window.RackStudio.STATE.customCatalog }));
    assert.equal(oldPanel.device.uHeight, 2); assert.equal(oldPanel.device.topU, 39);
    assert.equal(oldPanel.catalog[oldPanel.device.catalogKey].ports.length, 48);
  } finally { await browser.close(); }
});

test('actual metadata and stable-port forms write once; clear and IDF preset share atomic undo', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser); page.on('dialog', dialog => dialog.accept());
    await page.evaluate(() => window.DeviceMetadataEditor.open3D('device-1'));
    await page.locator('#dev-edit-hostname').fill('new-host'); await page.locator('#dev-edit-serial').fill('new-serial');
    await page.evaluate(() => { document.querySelector('#dev-edit-panel-label').value = 'panel-A'; });
    const revision = await page.evaluate(() => window.RackStudio.STATE.projectDocument.revision);
    await page.locator('#btn-save-device-edit').click();
    let result = await page.evaluate(() => ({ doc: window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE), error: window.__STUDIO3D__.state.lastSaveError }));
    assert.equal(result.doc.revision, revision + 1); assert.equal(result.doc.topology.racks[0].devices[0].serialNumber, 'new-serial');
    assert.equal(result.doc.topology.racks[0].devices[0].panelLabel, 'panel-A'); assert.equal(result.error, null);
    await page.evaluate(() => window.PortConfigEditor.open('device-1', 'p2', '3d'));
    await page.locator('#port-edit-role').selectOption('trunk'); await page.locator('#port-edit-vlan').fill('42');
    await page.locator('#btn-save-port-edit').click();
    result = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(result.revision, revision + 2); assert.equal(result.topology.racks[0].devices[0].portsConfig.p2.vlan, '42');
    await page.evaluate(() => { window.PortConfigEditor.open('device-1', 'p2', '3d'); window.PortConfigEditor.reset(); });
    assert.equal(await page.evaluate(() => !!window.RackStudio.STATE.racks[0].devices[0].portsConfig.p2), false);
    await page.locator('#btn-compact-view').click();await page.locator('#btn-3d-catalog').click();
    await page.locator('#tab-btn-installed').click();
    await page.locator('#btn-dismount-all').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length), 0);
    await page.locator('#btn-3d-undo').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length), 2);
    const beforePreset = await page.evaluate(() => window.RackStudio.STATE.projectDocument.revision);
    await page.locator('#btn-tools-menu-toggle').click();
    await page.locator('#btn-3d-preset-idf').click();
    result = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(result.revision, beforePreset + 1, await page.evaluate(() => document.querySelector('#studio-toast')?.textContent)); assert.equal(result.topology.racks[0].devices.length, 6);
    await page.locator('#btn-3d-undo').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length), 2);
    assert.deepEqual(result.fieldEvents, fixture.fieldEvents);
    await page.locator('#btn-tools-menu-toggle').click();
    await page.locator('#btn-3d-preset-mdf').click();
    const mdf = await page.evaluate(() => ({ doc: window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE), toast: document.querySelector('#studio-toast')?.textContent }));
    assert.equal(mdf.doc.topology.cables.length, 8, mdf.toast);
    assert.equal(mdf.doc.topology.racks[0].devices.length, 11); assert.equal(mdf.doc.topology.racks[0].heightU, 42);
    await page.locator('#btn-3d-undo').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.racks[0].devices.length), 2);
  } finally { await browser.close(); }
});

test('slow or oversized files cannot replace edits; custom catalog and non-numeric ports survive reload', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    await page.evaluate(() => {
      const original = File.prototype.text;
      File.prototype.text = async function () {
        await new Promise(resolve => { window.finishProjectRead = resolve; });
        return original.call(this);
      };
    });
    await page.locator('#file-import-3d').setInputFiles(payload(fixture));
    await page.waitForFunction(() => !!window.finishProjectRead);
    await page.evaluate(() => {
      window.RackStudio.STATE.projectDocument.metadata.name = 'Edit made during file read';
      window.RackStudio.flushProjectChanges(); window.finishProjectRead();
    });
    await page.waitForFunction(() => !document.querySelector('#btn-import-json-3d').disabled);
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.metadata.name), 'Edit made during file read');
    const oversized = await page.evaluate(() => {
      const input = document.querySelector('#file-import-3d'), transfer = new DataTransfer();
      const file = new File(['{}'], 'large.json');
      Object.defineProperty(file, 'size', { value: 33 * 1024 * 1024 });
      transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change'));
      return { disabled: document.querySelector('#btn-import-json-3d').disabled,
        name: window.RackStudio.STATE.projectDocument.metadata.name, toast: document.querySelector('#studio-toast')?.textContent };
    });
    assert.equal(oversized.name, 'Edit made during file read'); assert.equal(oversized.disabled, false); assert.match(oversized.toast, /32 MB/);
    // Test the existing wizard handler, whose launch button remains hidden in the current UI.
    const added = await page.evaluate(() => {
      const api = window.RackStudio;
      window.__STUDIO3D__.loadTopologyFromProject(api.ProjectDocument.capture(api.STATE));
      document.querySelector('#wiz-name').value = 'Persistent custom';
      document.querySelector('#wiz-ports').value = '2';
      document.querySelector('#btn-create-custom-device').click();
      const item = Object.values(api.STATE.customCatalog).find(c => c.name === 'Persistent custom');
      return { id: item?.id, ports: item?.ports };
    });
    assert.ok(added.id); assert.equal(added.ports.length, 2);
    await page.evaluate(async () => {
      const api = window.RackStudio, doc = api.ProjectDocument.capture(api.STATE);
      doc.topology.customCatalog['pilot-switch'].ports[1].id = 'ge-2';
      doc.topology.cables[0].to.portId = 'ge-2';
      api.loadCustomTopology(doc); api.flushProjectChanges();
      window.__STUDIO3D__.loadTopologyFromProject(api.ProjectDocument.capture(api.STATE));
      window.PortConfigEditor.open('device-1', 'ge-2', '3d');
    });
    await page.locator('#port-edit-role').selectOption('trunk'); await page.locator('#port-edit-vlan').fill('77');
    await page.locator('#btn-save-port-edit').click();
    await page.evaluate(() => window.RackStudio.saveProjectNow());
    await page.reload(); await page.waitForSelector('.studio-editor[data-ready="true"]');
    const restored = await page.evaluate(id => ({ item: window.RackStudio.STATE.customCatalog[id],
      config: window.RackStudio.STATE.racks[0].devices[0].portsConfig['ge-2'] }), added.id);
    assert.equal(restored.item.name, 'Persistent custom'); assert.equal(restored.config.vlan, '77');
  } finally { await browser.close(); }
});
