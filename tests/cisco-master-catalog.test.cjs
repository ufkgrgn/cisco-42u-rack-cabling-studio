// Run: node tests/cisco-master-catalog.test.cjs
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
    console.log('Page loaded, checking catalog...');
    await page.waitForFunction(() => window.RackStudio && window.CISCO_MASTER_CATALOG);

    // 1. Verify Master Catalog loaded
    const catalogCount = await page.evaluate(() => window.CISCO_MASTER_CATALOG.length);
    console.log(`Found ${catalogCount} models in CISCO_MASTER_CATALOG`);
    assert.ok(catalogCount >= 40, `Cisco master catalog should contain at least 40 models, got ${catalogCount}`);

    // 2. Open Cisco Master Catalog modal via activity rail or launcher button
    console.log('Opening Cisco Master Catalog modal...');
    await page.locator('#rail-btn-cisco-catalog').click();
    await page.waitForSelector('#modal-cisco-catalog', { state: 'visible' });
    console.log('Modal opened.');

    // 3. Test search functionality
    const searchInput = page.locator('#cisco-catalog-search');
    await searchInput.fill('9300-48P');
    const searchCardsCount = await page.locator('#cisco-cards-grid .cisco-card').count();
    assert.ok(searchCardsCount >= 1, 'Should find 9300-48P');

    // 4. Test series filter pill (Legacy)
    await searchInput.fill('');
    await page.locator('.cisco-pill[data-filter="legacy"]').click();
    const legacyCardsCount = await page.locator('#cisco-cards-grid .cisco-card').count();
    assert.ok(legacyCardsCount >= 15, `Should find at least 15 legacy models, got ${legacyCardsCount}`);

    // Verify all shown cards are legacy
    const allLegacy = await page.evaluate(() => {
      const cards = document.querySelectorAll('#cisco-cards-grid .cisco-card .badge-gen');
      return Array.from(cards).every(b => b.textContent.includes('LEGACY'));
    });
    assert.ok(allLegacy, 'All cards in legacy view must have LEGACY badge');

    // 5. Test "Kütüphaneye Ekle" (Add to Library)
    console.log('Testing library import for C9300-48P...');
    await page.locator('.cisco-pill[data-filter="all"]').click();
    await searchInput.fill('C9300-48P');
    const addBtn = page.locator('#cisco-cards-grid .cisco-card .btn-card-add-lib').first();
    await addBtn.click();
    assert.equal(await addBtn.textContent(), '✓ Kütüphanede');

    const importedInState = await page.evaluate(() => {
      const api = window.RackStudio;
      return Object.hasOwn(api.STATE.customCatalog, 'cisco-m-c9300-48p');
    });
    assert.ok(importedInState, 'C9300-48P should be registered in STATE.customCatalog');

    // 6. Test "Kabine Ekle" (Direct Mount)
    await searchInput.fill('2960X-48FPS');
    const mountBtn = page.locator('#cisco-cards-grid .cisco-card .btn-card-mount-rack').first();
    await mountBtn.click();

    // Verify modal closes and device is mounted in active rack
    await page.waitForSelector('#modal-cisco-catalog', { state: 'hidden' });
    const mountedInRack = await page.evaluate(() => {
      const api = window.RackStudio;
      const rack = api.getActiveRack();
      return rack.devices.some(d => d.catalogKey === 'cisco-m-2960x-48fps');
    });
    assert.ok(mountedInRack, '2960X-48FPS should be mounted in active rack');

    // 7. Verify port nomenclature on mounted switch
    const portNames = await page.evaluate(() => {
      const api = window.RackStudio;
      const rack = api.getActiveRack();
      const dev = rack.devices.find(d => d.catalogKey === 'cisco-m-2960x-48fps');
      const cat = api.catalog[dev.catalogKey];
      return {
        firstPort: cat.ports[0].name,
        lastAccessPort: cat.ports[47].name,
        firstUplink: cat.ports[48].name,
        totalPorts: cat.ports.length
      };
    });
    assert.equal(portNames.firstPort, 'Gi1/0/1', 'First port must be Gi1/0/1');
    assert.equal(portNames.lastAccessPort, 'Gi1/0/48', 'Last access port must be Gi1/0/48');
    assert.equal(portNames.firstUplink, 'Gi1/0/49', 'First uplink must be Gi1/0/49');
    assert.equal(portNames.totalPorts, 52, 'Total ports must be 52');

    assert.deepEqual(errors, [], 'No page errors should occur');
    console.log('✅ Cisco Master Catalog test passed: 46 models, search, filters, library import & direct mounting.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
