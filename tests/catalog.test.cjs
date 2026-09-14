// Run: node tests/catalog.test.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.RackStudio && document.querySelector('.catalog-tools'));
    const missingCategories = await page.evaluate(() => {
      const available = new Set([...document.querySelector('[aria-label="Donanım kategorisi"]').options].map(option => option.value));
      return [...new Set(Object.values(window.RackStudio.catalog).map(item => item.category))].filter(category => !available.has(category));
    });
    assert.deepEqual(missingCategories, [], 'every catalog category has a filter');
    const search = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
    await search.fill('Cisco ISR-4431');
    assert.equal(await page.locator('.device-card:not([hidden])').count(), 1, 'punctuation-insensitive model search');
    assert.equal(await page.locator('.device-card:not([hidden])').getAttribute('data-device-id'), 'cisco-isr-4431');
    await page.locator('.device-card:not([hidden]) .catalog-star').click();
    await search.fill('');
    await page.getByLabel('Yalnızca favoriler').check();
    assert.equal(await page.locator('.device-card:not([hidden])').count(), 1, 'favorites filter');
    await page.getByLabel('Yalnızca favoriler').uncheck();
    await page.locator('.catalog-custom summary').click();
    const modelName = 'Legacy <test> 2U';
    await page.getByLabel('Model adı', { exact: true }).fill(modelName);
    await page.getByLabel('Yükseklik (U)', { exact: true }).fill('2');
    await page.getByLabel('Port sayısı', { exact: true }).fill('8');
    await page.getByLabel('Port tipi', { exact: true }).selectOption('lc');
    await page.getByRole('button', { name: 'Kaydet ve seç' }).click();
    const custom = await page.evaluate(() => {
      const api = window.RackStudio;
      return { key: api.STATE.selectedLibraryItem, item: api.STATE.customCatalog[api.STATE.selectedLibraryItem] };
    });
    assert.ok(custom.key.startsWith('custom-'));
    assert.equal(custom.item.name, modelName);
    assert.equal(custom.item.u, 2);
    assert.equal(custom.item.ports.length, 8);
    assert.ok(custom.item.ports.every(port => port.type === 'lc'));
    assert.equal(await page.locator('.catalog-custom .device-name').textContent(), modelName, 'custom labels are rendered as text');
    await page.getByLabel('Donanım kategorisi').selectOption('custom');
    assert.equal(await page.locator('.device-card:not([hidden])').count(), 1);
    await page.waitForFunction(() => document.getElementById('studio-save')?.textContent === 'Yerel kayıt tamam');
    await page.reload();
    await page.waitForFunction(() => window.RackStudio && document.querySelector('.catalog-custom .device-card'));
    assert.equal(await page.locator('.catalog-custom .device-name').textContent(), modelName, 'custom catalog survives project reload');
    assert.deepEqual(errors, []);
    console.log('Catalog browser checks passed: search, favorites, custom hardware, persistence.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
