// Touch and keyboard lifecycle for explicit full-size catalog stencils.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const stencilRequests = [];
    page.on('request', request => { if (/assets\/stencils\//i.test(request.url())) stencilRequests.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.RackStudio && document.querySelector('.catalog-tools'));
    await page.evaluate(() => window.setLeftSidebarCollapsed(false));
    const card = page.locator('.sidebar-left .device-card[data-device-id="cisco-9200l-24p"]');
    await card.click();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.setLeftSidebarCollapsed(false));
    const previewButton = page.getByRole('button', { name: 'Gerçek stencil’i göster' });
    await previewButton.waitFor({ state: 'visible' });
    assert.equal(stencilRequests.length, 0, 'opening the mobile catalog and selecting a device does not fetch the original stencil');
    await page.locator('.catalog-detail-stencil').tap();
    const preview = page.locator('.catalog-stencil-hover-preview');
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('.catalog-stencil-hover-preview')?.dataset.state), null, { timeout: 10000 });
    assert.ok(await preview.evaluate(element => element.classList.contains('visible')), 'touch opens the full stencil preview');
    assert.equal(stencilRequests.length, 1, 'the original stencil is fetched only after explicit touch');
    assert.ok((await preview.locator('img').getAttribute('src')).includes('C9200L-24P-4X_Front.svg'), 'touch preview shows the authentic Cisco stencil');
    await page.keyboard.press('Escape');
    assert.equal(await preview.evaluate(element => element.classList.contains('visible')), false, 'Escape closes the preview');
    assert.equal(await previewButton.textContent(), 'Gerçek stencil’i göster', 'closing restores the preview action label');
    await page.locator('.catalog-detail-stencil').tap();
    await page.waitForFunction(() => document.querySelector('.catalog-stencil-hover-preview')?.classList.contains('visible'));
    await page.locator('.catalog-detail-stencil').tap();
    assert.equal(await preview.evaluate(element => element.classList.contains('visible')), false, 'the action button toggles the preview closed on touch');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
