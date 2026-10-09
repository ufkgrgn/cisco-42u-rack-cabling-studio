const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const output = path.resolve(__dirname, '../docs/product-plan/results/ui-guidance');
async function setup(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(() => localStorage.setItem('rackstudio-intro-invite', 'dismissed'));
  return { page, errors };
}
test('help works across four themes, four widths and both views; keyboard and nested dialog focus are preserved', async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const { page, errors } = await setup(browser);
    for (const mode of ['2d', '3d']) {
      await page.evaluate(async value => window.RackStudio.setStudioMode(value === '3d'), mode);
      for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
        await page.locator('#btn-tools-menu-toggle').click();
        await page.selectOption('#btn-theme-toggle', theme);
        await page.locator('#btn-tools-menu-toggle').click();
        for (const width of [1440, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 950 });
          await page.locator('#btn-help').click();
          const dialog = page.getByRole('dialog', { name: 'Yardım', exact: true });
          await dialog.getByRole('button', { name: 'İşlevler', exact: true }).click();
          await dialog.getByLabel('İşlev seçin').selectOption('cabling');
          await page.screenshot({ path: path.join(output, `${mode}-${theme}-${width}.png`), animations: 'disabled' });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          assert.equal(await dialog.getByRole('button', { name: 'İşlevler', exact: true }).getAttribute('aria-pressed'), 'true');
          await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
          assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-help');
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.evaluate(() => window.RackStudio.setStudioMode(false));
    await page.locator('#btn-mode-cabling').focus();
    await page.waitForSelector('#studio-help-tooltip');
    assert.ok((await page.locator('#btn-mode-cabling').getAttribute('aria-describedby')).includes('studio-help-tooltip'));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#studio-help-tooltip').count(), 0);
    await page.locator('#btn-mode-layout').focus();
    await page.waitForSelector('#studio-help-tooltip');
    await page.evaluate(() => { const d = document.createElement('dialog'); d.id = 'escape-host'; d.append(document.createElement('button')); document.body.append(d); d.showModal(); });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#escape-host').evaluate(el => el.open), false, 'a tooltip behind a modal must not consume its Escape key');
    await page.locator('#escape-host').evaluate(el => el.remove());
    await page.evaluate(() => { const d = document.createElement('dialog'); d.id = 'test-host'; const b = document.createElement('button'); b.textContent = 'Port yardımı'; b.dataset.helpOpen = 'ports'; d.append(b); document.body.append(d); d.showModal(); });
    await page.getByRole('button', { name: 'Port yardımı' }).click();
    await page.getByRole('dialog', { name: 'Yardım', exact: true }).getByRole('button', { name: 'Kapat', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Port yardımı');
    assert.equal(await page.locator('#test-host').evaluate(el => el.open), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('manual sample actions advance the non-modal guide and preserve the original project on return', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const { page, errors } = await setup(browser);
    const before = await page.evaluate(() => window.RackStudio.ProjectCommands.domainKey(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE)));
    await page.evaluate(() => window.RackStudio.Onboarding.open());
    const guide = page.getByRole('complementary', { name: 'İlk kullanım', exact: true });
    await guide.getByRole('button', { name: 'Ayrı örnek projeyi başlat' }).click();
    await page.waitForFunction(() => !document.getElementById('onboarding-panel').hasAttribute('aria-busy'));
    await page.evaluate(() => { const R = window.RackStudio; R.mountDeviceAt('intro-switch', 12); document.dispatchEvent(new CustomEvent('rackstudio:change')); });
    await guide.getByRole('heading', { name: 'Portları bağla' }).waitFor();
    await guide.getByRole('button', { name: 'Kablolama görünümüne geç' }).click();
    const selectPort = index => page.evaluate(i => { const R = window.RackStudio, d = R.STATE.racks[0].devices[i]; R.dispatchPixiPortInteraction('click', { instanceId: d.instanceId, portId: 'p1', name: 'GE1', type: 'rj45' }); }, index);
    await selectPort(0);
    await page.getByRole('complementary', { name: 'Bağlantı yönlendirmesi' }).getByText(/Hedef portu seçin/).waitFor();
    await page.getByRole('button', { name: 'İptal', exact: true }).click();
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.pendingConnection), null);
    await selectPort(0); await selectPort(1);
    await page.locator('.uplink-modal-backdrop').getByRole('button', { name: /802.1Q TRUNK Olarak Yapılandır/ }).click();
    await guide.getByRole('heading', { name: 'Bağlantıyı kontrol et' }).waitFor();
    await page.getByText(/Bağlantı oluşturuldu:/).waitFor();
    await guide.getByRole('button', { name: 'Bağlantıyı kontrol ettim' }).click();
    await guide.getByRole('heading', { name: 'Örnek tamamlandı' }).waitFor();
    await guide.getByRole('button', { name: 'Kendi projeme dön' }).click();
    await guide.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.RackStudio.ProjectCommands.domainKey(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE))), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('connection rejection explains actual media rules without creating a cable; empty search offers recovery', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const { page, errors } = await setup(browser);
    await page.evaluate(() => {
      const R = window.RackStudio;
      R.loadCustomTopology({ racks: [{ id: 'help-rack', name: 'Yardım kabini', heightU: 18, devices: [
        { instanceId: 'copper-device', catalogKey: 'copper-model', uHeight: 1, topU: 12 },
        { instanceId: 'fiber-device', catalogKey: 'fiber-model', uHeight: 1, topU: 10 }
      ] }], activeRackId: 'help-rack', cables: [], customCatalog: {
        'copper-model': { name: 'Bakır panel', category: 'patch', u: 1, ports: [{ id: 'p1', name: 'RJ45 1', type: 'rj45' }] },
        'fiber-model': { name: 'Fiber panel', category: 'fiber', u: 1, ports: [{ id: 'p1', name: 'LC 1', type: 'lc' }] }
      } });
      R.setStudioWorkMode('cabling');
      for (const id of ['copper-device', 'fiber-device']) R.dispatchPixiPortInteraction('click', { instanceId: id, portId: 'p1', name: 'Port 1', type: id === 'copper-device' ? 'rj45' : 'lc' });
    });
    const notice = page.locator('#workflow-guidance');
    await notice.waitFor({ state: 'visible' });
    assert.equal(await notice.getAttribute('data-tone'), 'error');
    assert.match(await notice.textContent(), /kontrol|uyum|fiber|bakır/i);
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.cables.length), 0);
    for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
      await page.evaluate(value => window.RackStudioTheme.apply(value), theme);
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(() => {
        const R = window.RackStudio;
        R.handlePortHover({ currentTarget: { dataset: { instanceId: 'copper-device', portId: 'p1', portName: 'RJ45 1', portSpeed: '1G', portType: 'rj45' }, getBoundingClientRect: () => ({ right: innerWidth, top: innerHeight - 10 }) } });
      });
      await page.locator('#tooltip').waitFor({ state: 'visible' });
      const bounds = await page.locator('#tooltip').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320 && bounds.y + bounds.height <= 844);
      assert.ok(bounds.width >= 150, 'edge positioning must not squeeze the explanation into a narrow strip');
      await page.screenshot({ path: path.join(output, `port-${theme}-320.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.evaluate(() => window.setLeftSidebarCollapsed(false));
    await page.getByLabel('Donanım kataloğunda ara').fill('no-such-device-991122');
    await page.locator('.catalog-empty-search').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Filtreleri temizle', exact: true }).click();
    assert.equal(await page.getByLabel('Donanım kataloğunda ara').inputValue(), '');
    await page.locator('.catalog-empty-search').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
