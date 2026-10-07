const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

test('two real tabs retain the losing draft and never overwrite the durable project', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext();
    const first = await context.newPage();
    await first.goto(url); await first.waitForSelector('.studio-editor[data-ready="true"]');
    const id = await first.evaluate(async () => {
      const api = window.RackStudio;
      const doc = api.ProjectDocument.normalize({ racks: [{ id: 'rack-1', name: 'Tabs', heightU: 18, devices: [] }], cables: [] });
      doc.metadata.name = 'durable-first'; api.loadCustomTopology(doc);
      await api.saveProjectNow(); return doc.projectId;
    });
    const second = await context.newPage(); await second.goto(url);
    await second.waitForSelector('.studio-editor[data-ready="true"]');
    const rejected = await second.evaluate(async projectId => {
      const api = window.RackStudio;
      api.STATE.projectDocument.metadata.name = 'losing-draft';
      let message = '';
      try { await api.saveProjectNow(); } catch (error) { message = error.message; }
      const row = await api.ProjectRepository.get(projectId);
      return { message, durable: row.document.metadata.name, draft: api.STATE.projectDocument.metadata.name, storedDrafts: Object.keys(localStorage).filter(k => k.startsWith('rack-studio-draft:')).map(k => localStorage.getItem(k)) };
    }, id);
    assert.match(rejected.message, /başka sekmede/);
    assert.equal(rejected.durable, 'durable-first');
    assert.equal(rejected.draft, 'losing-draft');
    assert.ok(rejected.storedDrafts.some(raw => JSON.parse(raw).metadata.name === 'losing-draft'));
    assert.match(await second.locator('#studio-save').textContent(), /Taslak korunuyor/);
    await first.evaluate(async () => {
      const api = window.RackStudio; api.STATE.projectDocument.metadata.name = 'newer-first'; await api.saveProjectNow();
    });
    const stale = await second.evaluate(async projectId => {
      const api = window.RackStudio, db = await api.ProjectRepository.database;
      await api.ProjectStorageIDB.transaction(db, ['leases'], 'readwrite', tx => tx.objectStore('leases').put({ owner: 'expired-owner', expiresAt: 0 }, projectId));
      let error = '';
      try { await api.saveProjectNow(); } catch (failure) { error = failure.message; }
      const row = await api.ProjectStorageIDB.read(db, 'projects', projectId);
      return { error, durable: row.document.metadata.name };
    }, id);
    assert.match(stale.error, /Dayanıklı kayıt değişti/);
    assert.equal(stale.durable, 'newer-first');
    const reopened = await second.evaluate(async id => {
      const api = window.RackStudio;
      await api.openStoredProject(id, { preserveDraft: true });
      return { name: api.STATE.projectDocument.metadata.name, originals: (await api.ProjectRepository.listRecovery()).map(row => row.value.raw) };
    }, id);
    assert.equal(reopened.name, 'newer-first');
    assert.ok(reopened.originals.some(raw => JSON.parse(raw).metadata.name === 'losing-draft'));
  } finally { await browser.close(); }
});

test('conflicting legacy recovery exposes sources, preserves originals and does not silently choose', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('rack-studio-project-v2', JSON.stringify({ racks: [{ id: 'rack-1', name: 'Alpha', heightU: 18, devices: [] }], cables: [] }));
      localStorage.setItem('cisco-rack-studio-project', JSON.stringify({ racks: [{ id: 'rack-1', name: 'Beta', heightU: 24, devices: [] }], cables: [] }));
    });
    await page.goto(url);
    const dialog = page.locator('.project-recovery-dialog');
    await dialog.waitFor();
    assert.equal(await dialog.locator('section').count(), 2);
    await dialog.locator('section').filter({ hasText: 'rack-studio-project-v2' }).getByRole('button', { name: 'Bu kaydı aç' }).click();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().name), 'Alpha');
    const raw = await page.evaluate(async () => {
      const api = window.RackStudio, db = await api.ProjectRepository.database;
      return (await api.ProjectStorageIDB.entries(db, 'recovery')).map(row => row.value.raw);
    });
    assert.equal(raw.length, 2);
    assert.ok(raw.some(text => text.includes('Beta')));
  } finally { await browser.close(); }
});

test('project switching saves work, isolates history and reopens archived projects', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage(); await page.goto(url);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const result = await page.evaluate(async () => {
      const api = window.RackStudio;
      const make = name => { const doc = api.ProjectDocument.normalize({ racks: [{ id: 'rack-1', name, heightU: 18, devices: [] }], cables: [] }); doc.metadata.name = name; return doc; };
      const a = make('Alpha'), b = make('Beta');
      api.loadCustomTopology(a); await api.saveProjectNow();
      api.loadCustomTopology(b); await api.saveProjectNow();
      api.STATE.projectDocument.metadata.name = 'Beta-edit';
      await api.setStudioMode(true);
      await api.openStoredProject(a.projectId);
      if (window.is3DMode) throw new Error('Project switching must leave the previous 3D scene.');
      const cleared = document.querySelector('.studio-editor [data-command="undo"]').disabled;
      await api.ProjectRepository.archive(b.projectId);
      await api.openStoredProject(b.projectId);
      const bRow = await api.ProjectRepository.get(b.projectId), aRow = await api.ProjectRepository.get(a.projectId);
      return { cleared, b: bRow.document.metadata.name, a: aRow.document.metadata.name, archived: bRow.archived, active: api.STATE.projectDocument.projectId, bId: b.projectId };
    });
    assert.equal(result.cleared, true);
    assert.equal(result.b, 'Beta-edit'); assert.equal(result.a, 'Alpha');
    assert.equal(result.archived, false); assert.equal(result.active, result.bId);
  } finally { await browser.close(); }
});

test('an edit while the database opens is preserved instead of replaced by recovery', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('rack-studio-project-v2', JSON.stringify({ racks: [{ id: 'rack-1', name: 'Old', heightU: 18, devices: [] }], cables: [] }));
      const original = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        const request = original(...args); let success;
        Object.defineProperty(request, 'onsuccess', { set: fn => { success = fn; } });
        request.addEventListener('success', event => setTimeout(() => success?.call(request, event), 120));
        return request;
      };
      window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        const api = window.RackStudio;
        api.STATE.projectDocument.metadata.name = 'Edit while opening';
        document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
      }, 0));
    });
    await page.goto(url); await page.waitForSelector('.studio-editor[data-ready="true"]');
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.metadata.name), 'Edit while opening');
    assert.ok(await page.evaluate(async () => (await window.RackStudio.ProjectStorageIDB.entries(await window.RackStudio.ProjectRepository.database, 'recovery')).length > 0));
  } finally { await browser.close(); }
});
