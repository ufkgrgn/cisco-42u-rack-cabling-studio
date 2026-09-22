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
    await page.waitForFunction(() => window.RACK_STENCIL_COVERAGE?.matched?.length > 0);
    assert.ok(await page.evaluate(() => Array.isArray(window.RACK_STENCIL_MANIFEST) && window.RACK_STENCIL_MANIFEST.length >= 250), 'generated stencil manifest is loaded');
    assert.ok(await page.evaluate(() => window.RACK_STENCIL_COVERAGE.matched.length > 0 && window.RACK_STENCIL_COVERAGE.missing.length > 0), 'runtime stencil coverage report is populated');
    assert.equal(await page.locator('.catalog-selection-detail').count(), 1, 'catalog has a single reusable detail inspector');
    assert.equal(await page.locator('.catalog-view-segmented').isHidden(), true, 'redundant catalog view band is hidden');
    assert.ok(await page.locator('.sidebar-left .hw-visual-container').first().evaluate(el => el.getBoundingClientRect().width >= 200), 'stencil preview owns the full first row');
    assert.equal(await page.locator('.sidebar-left .hw-visual-container').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'stencil preview background is transparent');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="cisco-3850-24s"] .hw-generated-stencil').getAttribute('data-preview-kind'), 'fiber-switch', 'fiber switch uses an active optical faceplate preview');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="patch-cat6-24"] .hw-generated-stencil').getAttribute('data-preview-kind'), 'patch', 'copper patch uses a passive keystone preview');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="fiber-odf-24"] .hw-generated-stencil').getAttribute('data-preview-kind'), 'fiber', 'fiber ODF uses a distinct duplex connector preview');
    assert.ok(await page.locator('.sidebar-left .device-card[data-device-id="patch-cat6-24"] .hw-spec-chips').textContent().then(text => text.includes('RJ45 Cat6')), 'patch panel metadata does not report active switch speed');
    assert.ok(await page.locator('.sidebar-left .device-card[data-device-id="fiber-odf-24"] .hw-spec-chips').textContent().then(text => text.includes('LC fiber')), 'ODF metadata reports passive fiber connectors');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="cisco-3850-24s"] img.hw-stencil-preview:not(.hw-generated-stencil)').count(), 0, 'catalog cards do not embed original heavy Cisco SVG files');
    await page.evaluate(() => document.querySelector('.catalog-mode-btn[data-mode="category"]').click());
    assert.ok(await page.locator('.catalog-tree-card[data-group-key="grp-odf"]').count(), 'category view separates fiber ODFs');
    assert.ok(await page.locator('.catalog-tree-card[data-group-key="grp-patch"]').count(), 'category view separates copper patch panels');
    await page.evaluate(() => document.querySelector('.catalog-mode-btn[data-mode="series"]').click());
    const firstStencil = page.locator('.sidebar-left .hw-stencil-preview').first();
    await firstStencil.locator('..').hover();
    await page.waitForTimeout(380);
    const hoverPreview = page.locator('.catalog-stencil-hover-preview');
    assert.ok(await hoverPreview.evaluate(el => el.classList.contains('visible') && Number(getComputedStyle(el).opacity) > .9), 'stencil expands in the body-level hover preview');
    assert.ok(await hoverPreview.evaluate(el => el.parentElement === document.body && getComputedStyle(el).position === 'fixed'), 'expanded stencil cannot be clipped by the sidebar');
    assert.ok((await hoverPreview.locator('img').getAttribute('src')).startsWith('data:image/svg+xml'), 'hover expands the lightweight generated preview without decoding the original SVG');
    await page.locator('.sidebar-left .device-card[data-device-id="cisco-9200l-24p"]').click();
    const realStencilButton = page.getByRole('button', { name: 'Gerçek stencil’i göster' });
    assert.equal(await realStencilButton.count(), 1, 'selected model exposes an explicit real-stencil preview for mouse and touch');
    await page.locator('.quick-filter-chip[data-filter="48p"]').click();
    const cat9kFilterState = await page.locator('.catalog-tree-card[data-group-key="cat9k"]').evaluate(group => ({
      badge: group.querySelector('.catalog-tree-count')?.textContent,
      visibleCards: [...group.querySelectorAll('.device-card')].filter(card => getComputedStyle(card).display !== 'none').length
    }));
    assert.equal(cat9kFilterState.visibleCards, Number.parseInt(cat9kFilterState.badge, 10), 'CAT 9000 badge and rendered cards stay synchronized');
    await page.locator('.quick-filter-chip[data-filter="24p"]').click();
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="cisco-9200l-24p"]:not([hidden])').count(), 1, '24-port filter includes 24 access ports plus uplinks');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="cisco-9300-48u"]:not([hidden])').count(), 0, '24-port filter excludes 48-port models');
    await page.locator('.quick-filter-chip[data-filter="all"]').click();
    await page.getByLabel('Donanım kategorisi').selectOption('switch');
    assert.equal(await page.locator('.sidebar-left .device-card[data-device-id="cisco-3850-24s"]:not([hidden])').count(), 1, 'switch filter includes fiber switches');
    await page.getByLabel('Donanım kategorisi').selectOption('');
    await page.evaluate(() => {
      window.RackStudio.loadCustomTopology({racks:[{id:'rack-1',name:'Stencil Pilot',heightU:42,devices:[]}],cables:[]});
      window.RackStudio.mountDeviceAt('cisco-m-c9200l-24p-4x', 40, 'rack-1');
      window.RackStudio.refresh();
    });
    await page.waitForSelector('.mounted-device .stencil-faceplate');
    assert.equal(await page.locator('.mounted-device .stencil-faceplate').count(), 1, 'pilot model uses a hybrid stencil faceplate');
    assert.ok(await page.locator('.stencil-faceplate .rack-faceplate-stencil').getAttribute('src').then(src => src.includes('C9200L-24P-4X_Front.svg')));
    assert.equal(await page.locator('.stencil-faceplate .port').count(), 28, 'hybrid faceplate keeps every live port');
    const missingCategories = await page.evaluate(() => {
      const available = new Set([...document.querySelector('[aria-label="Donanım kategorisi"]').options].map(option => option.value));
      return [...new Set(Object.values(window.RackStudio.catalog).map(item => item.category))].filter(category => !available.has(category));
    });
    assert.deepEqual(missingCategories, [], 'every catalog category has a filter');
    const search = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
    await search.fill('Cisco ISR-4431');
    assert.equal(await page.locator('.device-card:not([hidden])').count(), 1, 'punctuation-insensitive model search');
    assert.equal(await page.locator('.device-card:not([hidden])').getAttribute('data-device-id'), 'cisco-isr-4431');
    assert.equal(await page.locator('.device-card:not([hidden]) .hw-generated-stencil').count(), 1, 'missing Cisco source art gets a model-aware vector fallback');
    await page.locator('.device-card:not([hidden]) .catalog-star').click();
    await search.fill('');
    await page.getByLabel('Yalnızca favoriler').check();
    assert.equal(await page.locator('.device-card:not([hidden])').count(), 1, 'favorites filter');
    await page.getByLabel('Yalnızca favoriler').uncheck();
    await page.locator('.sidebar-left .device-card:not([hidden])').first().click();
    assert.equal(await page.locator('.catalog-selection-detail:not([hidden])').count(), 1, 'selection opens the detail inspector');
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
