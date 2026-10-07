const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
test('canonical project survives actual import, undo and IndexedDB recovery', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const id = await page.evaluate(() => {
      const api = window.RackStudio;
      const doc = api.ProjectDocument.capture(api.STATE);
      doc.metadata.name = 'Kurtarma testi';
      doc.fieldEvents = [{ id: 'field-test', note: 'Kablo ölçümü henüz bilinmiyor' }];
      doc.extensions.vendor = { value: 42 };
      api.loadCustomTopology(doc);
      return doc.projectId;
    });
    await page.waitForTimeout(900);
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    const restored = await page.evaluate(() => window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
    assert.equal(restored.projectId, id);
    assert.equal(restored.metadata.name, 'Kurtarma testi');
    assert.equal(restored.fieldEvents[0].id, 'field-test');
    assert.equal(restored.extensions.vendor.value, 42);
    await page.evaluate(() => {
      window.RackStudio.STATE.projectDocument.metadata.name = 'Geçici değişiklik';
      document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
    });
    await page.locator('.studio-editor [data-command="undo"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.metadata.name), 'Kurtarma testi');
    const unchanged = await page.evaluate(() => {
      const api = window.RackStudio;
      const before = JSON.stringify(api.ProjectDocument.capture(api.STATE));
      try { api.loadCustomTopology({ schemaVersion: 99 }); } catch (_) {}
      return before === JSON.stringify(api.ProjectDocument.capture(api.STATE));
    });
    assert.equal(unchanged, true);
  } finally { await browser.close(); }
});
