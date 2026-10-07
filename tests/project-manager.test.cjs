const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'),'utf8'));
const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href;
async function pageFor(browser, width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  await page.goto(url); await page.waitForSelector('.studio-editor[data-ready="true"]'); return page;
}
async function manager(page) {
  await page.locator('#btn-tools-menu-toggle').click();
  await page.locator('#btn-project-records').click();
  await page.waitForFunction(() => document.querySelector('.project-manager') && !document.querySelector('.project-manager').hasAttribute('aria-busy'));
  return page.getByRole('dialog',{name:'Yerel proje kayıtları',exact:true});
}
test('project UI creates hierarchy and rack binding, rejects invalid references, reloads and searches', async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await pageFor(browser); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    let dialog = await manager(page);
    await dialog.getByLabel('Yeni proje adı',{exact:true}).fill('Campus Alpha');
    await dialog.getByLabel('Yeni proje müşterisi').fill('Müşteri A');
    await dialog.getByRole('button',{name:'Yeni proje oluştur',exact:true}).click();
    await page.waitForFunction(() => window.RackStudio.STATE.projectDocument.metadata.name === 'Campus Alpha');
    await page.waitForFunction(() => !document.querySelector('.project-manager').hasAttribute('aria-busy'));
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.racks[0].name),'Kabin 1');
    await dialog.getByLabel('Sorumlu',{exact:true}).fill('Teknisyen');
    await dialog.getByLabel('Proje durumu').selectOption('field');
    await dialog.getByLabel('Hedef tarih').fill('2026-11-01');
    for (const name of ['Merkez Saha','A Binası','Birinci Kat','Sistem Odası']) {
      await dialog.getByRole('button',{name:'Konum ekle',exact:true}).click();
      await dialog.locator('.pm-location').last().getByLabel('Konum adı').fill(name);
    }
    const room = await page.evaluate(() => document.querySelectorAll('.pm-location')[3].dataset.locationId);
    await dialog.getByLabel('Kabin 1 — oda',{exact:true}).selectOption(room);
    const activeId = await page.evaluate(() => window.RackStudio.STATE.projectDocument.projectId);
    await dialog.locator(`.pm-card:not([data-project-id="${activeId}"])`).first().getByRole('button',{name:'Aç',exact:true}).click();
    assert.match(await dialog.getByRole('status').textContent(),/Kaydedilmemiş/);
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.projectId),activeId);
    await dialog.getByRole('button',{name:'Proje bilgilerini kaydet',exact:true}).click();
    await page.waitForFunction(() => window.RackStudio.STATE.projectDocument.locations.length === 4);
    await page.waitForFunction(() => !document.querySelector('.project-manager').hasAttribute('aria-busy'));
    const saved = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(saved.metadata.customer,'Müşteri A'); assert.equal(saved.metadata.status,'field'); assert.equal(saved.metadata.targetDate,'2026-11-01');
    assert.equal(saved.topology.racks[0].locationId,room); assert.equal(saved.locations[3].parentId,saved.locations[2].id);
    // Removing an assigned room must fail atomically while the editable form remains available.
    await dialog.locator('.pm-location').last().getByRole('button',{name:'Sil',exact:true}).click();
    await dialog.getByRole('button',{name:'Proje bilgilerini kaydet',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('.pm-status').dataset.error === 'true');
    assert.match(await dialog.getByRole('status').textContent(),/rack.locationId/);
    assert.deepEqual(await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE)),saved);
    await dialog.getByRole('button',{name:'Kapat',exact:true}).click(); await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const restored = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(restored.projectId,saved.projectId); assert.equal(restored.topology.racks[0].locationId,room);
    dialog = await manager(page);
    const inactive = dialog.locator(`.pm-card:not([data-project-id="${activeId}"])`).first();
    await inactive.getByRole('button',{name:'Arşivle',exact:true}).click();
    await page.waitForFunction(() => !document.querySelector('.project-manager').hasAttribute('aria-busy'));
    await inactive.getByRole('button',{name:'Arşivden çıkar',exact:true}).click();
    await page.waitForFunction(() => !document.querySelector('.project-manager').hasAttribute('aria-busy'));
    await dialog.getByLabel('Proje ara').fill('Müşteri A');
    assert.equal(await dialog.locator('.pm-card').count(),1); await dialog.getByLabel('Proje ara').fill('not-present');
    assert.equal(await dialog.locator('.pm-card').count(),0); assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});

test('duplicate remaps all entities and blob keys atomically and isolates source, archive and view', async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await pageFor(browser);
    const result = await page.evaluate(async input => {
      const api = window.RackStudio, blob = new Blob(['photo'],{type:'text/plain'});
      input.evidenceRefs[0].mime = blob.type; input.evidenceRefs[0].bytes = blob.size;
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      input.evidenceRefs[0].sha256 = [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
      api.loadCustomTopology(input); await api.saveProjectNow();
      await api.ProjectRepository.commit(api.ProjectDocument.capture(api.STATE), { evidence:[{id:'blob-1',blob}] });
      const before = await api.ProjectRepository.snapshotProject(input.projectId);
      await api.ProjectManagement.duplicate(input.projectId);
      const copy = api.ProjectDocument.capture(api.STATE), duplicate = await api.ProjectRepository.snapshotProject(copy.projectId);
      const deviceId = copy.topology.racks[0].devices[0].instanceId, cableId = copy.topology.cables[0].id;
      const checks = { project: copy.projectId !== input.projectId, rack: copy.topology.racks[0].id !== 'rack-1',
        device: deviceId !== 'device-1', cable: cableId !== 'cable-1', location: copy.topology.racks[0].locationId === copy.locations[1].id,
        parent: copy.locations[1].parentId === copy.locations[0].id,
        endpoint: copy.topology.cables[0].from.instanceId === deviceId && copy.topology.cables[0].from.rackId === copy.topology.racks[0].id,
        observation: copy.observations[0].entityRef.id === deviceId,
        event: copy.fieldEvents[0].entityRef.id === cableId && copy.fieldEvents[0].evidenceIds[0] === copy.evidenceRefs[0].id,
        evidence: copy.evidenceRefs[0].projectId === copy.projectId && copy.evidenceRefs[0].blobId !== 'blob-1',
        integration: copy.integrationMappings[0].entityRef.id === deviceId,
        raw: JSON.stringify(copy.observations[0].raw) === JSON.stringify(input.observations[0].raw),
        bytes: await duplicate.evidence[0].blob.text() === 'photo', custom: JSON.stringify(copy.topology.customCatalog) === JSON.stringify(input.topology.customCatalog) };
      api.ProjectManagement.updateDetails(api.ProjectManagement.prepare(),{...copy.metadata,name:'Copy changed'},copy.locations,copy.topology.racks.map(r=>({rackId:r.id,locationId:r.locationId})));
      await api.saveProjectNow(); await api.ProjectRepository.archive(input.projectId);
      const source = await api.ProjectRepository.snapshotProject(input.projectId);
      const unchanged = JSON.stringify(source.document) === JSON.stringify(before.document);
      const invalid = [];
      const beforeReject = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      for (const type of ['cycle','room','date']) {
        const draft = api.ProjectDocument.capture(api.STATE), expected = api.ProjectManagement.prepare();
        if (type === 'cycle') draft.locations[0].parentId = draft.locations[1].id;
        if (type === 'date') draft.metadata.targetDate = '2026-02-30';
        const links = draft.topology.racks.map(r => ({rackId:r.id,locationId:type === 'room' ? draft.locations[0].id : r.locationId}));
        try { api.ProjectManagement.updateDetails(expected,draft.metadata,draft.locations,links); invalid.push(false); }
        catch (_) { invalid.push(JSON.stringify(api.ProjectDocument.capture(api.STATE)) === beforeReject); }
      }
      await api.openStoredProject(input.projectId); const opened = api.ProjectDocument.capture(api.STATE);
      return { checks, invalid, unchanged, sourceName:opened.metadata.name,
        sourceBlob:await source.evidence[0].blob.text(), copyName:(await api.ProjectRepository.get(copy.projectId)).document.metadata.name,
        unarchived:!(await api.ProjectRepository.get(input.projectId)).archived,
        historyCleared:document.querySelector('.studio-editor [data-command="undo"]').disabled };
    },fixture);
    for (const [key,value] of Object.entries(result.checks)) assert.equal(value,true,key);
    assert.deepEqual(result.invalid,[true,true,true]);
    assert.equal(result.unchanged,true); assert.equal(result.sourceName,fixture.metadata.name); assert.equal(result.sourceBlob,'photo');
    assert.equal(result.copyName,'Copy changed'); assert.equal(result.unarchived,true); assert.equal(result.historyCleared,true);
  } finally { await browser.close(); }
});

test('project switch preserves edits made while reading and mobile dialog fits 320 and 390 pixels',async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await pageFor(browser,320);
    const retained = await page.evaluate(async () => {
      const api = window.RackStudio;
      await api.ProjectManagement.create('First'); const first = api.STATE.projectDocument.projectId;
      await api.ProjectManagement.create('Second');
      const get = api.ProjectRepository.get.bind(api.ProjectRepository);
      api.ProjectRepository.get = async (...args) => { const row = await get(...args); api.STATE.projectDocument.metadata.name = 'Edit during switch'; api.flushProjectChanges(); return row; };
      let error = ''; try { await api.openStoredProject(first); } catch (e) { error = e.message; }
      api.ProjectRepository.get = get;
      return { error,name:api.STATE.projectDocument.metadata.name };
    });
    assert.match(retained.error,/çalışma değişti/); assert.equal(retained.name,'Edit during switch');
    for (const width of [320,390]) {
      await page.setViewportSize({width,height:950}); const dialog = await manager(page);
      const bounds = await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
      assert.ok(bounds.scroll <= bounds.width + 1); assert.ok(bounds.left >= 0 && bounds.right <= width);
      await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/project-manager-${width}.png`),fullPage:true});
      await dialog.getByRole('heading',{name:'Açık proje bilgileri',exact:true}).scrollIntoViewIfNeeded();
      const detailBounds = await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
      assert.ok(detailBounds.scroll <= detailBounds.width + 1);
      await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/project-manager-${width}-details.png`),fullPage:true});
      await page.keyboard.press('Escape'); assert.equal(await dialog.count(),0);
    }
  } finally { await browser.close(); }
});
