const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const output = path.resolve(__dirname, '../docs/product-plan/results/workspace-shell');
async function open(browser, width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(10000);
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.locator('#onboarding-invite').evaluateAll(nodes => nodes.forEach(n => n.remove()));
  return { page, errors };
}
test('workspace fits all themes, breakpoints and renderer modes; panels and focus have one owner', async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const { page, errors } = await open(browser);
    const widths = [320, 390, 540, 767, 768, 1024, 1199, 1200, 1440];
    for (const mode of ['2d', '3d']) {
      await page.evaluate(async mode => { RackStudio.WorkspaceUI.closePanel(); await RackStudio.setStudioMode(mode === '3d'); }, mode);
      await page.waitForTimeout(300);
      for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
        await page.evaluate(theme => { RackStudioTheme.apply(theme); RackStudio.refresh(); }, theme);
        for (const width of widths) {
          const frameBeforeResize = mode === '3d' ? await page.evaluate(() => __STUDIO3D__.renderer.info.render.frame) : null;
          await page.setViewportSize({ width, height: 900 });
          if (mode === '3d') await page.waitForFunction(frame => {
            const s = __STUDIO3D__, c = s.renderer.domElement;
            return s.renderer.info.render.frame > frame && c.clientWidth === s.container.clientWidth && c.clientHeight === s.container.clientHeight;
          }, frameBeforeResize);
          await page.waitForTimeout(70);
          const result = await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('.workspace-header button, .workspace-toolbar button, .workspace-mobile-nav button')].filter(e => e.getClientRects().length && !e.closest('#hud-tools-panel,#compact-view-panel,#rack-selector-dropdown'));
            const bounds = buttons.map(e => ({ id: e.id, r: e.getBoundingClientRect() }));
            const outside = bounds.filter(({ r }) => r.x < -1 || r.right > innerWidth + 1 || r.height < 43);
            const overlap = bounds.flatMap((a, i) => bounds.slice(i + 1).filter(b => Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1).map(b => [a.id, b.id]));
            return { outside: outside.map(x => x.id), overlap, scroll: document.documentElement.scrollWidth, width: innerWidth };
          });
          assert.deepEqual(result.outside, [], `${mode}/${theme}/${width} controls fit and meet touch size`);
          assert.deepEqual(result.overlap, [], `${mode}/${theme}/${width} controls do not overlap`);
          assert.ok(result.scroll <= width + 1, JSON.stringify(result));
          if ([320, 390, 540, 768, 1024, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${mode}-${theme}-${width}.png`), animations: 'disabled' });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [id, panel] of [['btn-mobile-catalog', 'hardware'], ['btn-mobile-view', 'view'], ['btn-mobile-selection', 'selection']]) {
      await page.locator('#' + id).click();
      assert.equal(await page.evaluate(() => RackStudio.WorkspaceUI.getState().activePanel), panel);
      assert.equal(await page.locator('.workspace-overlay:visible').count(), 1);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), id);
      assert.equal(await page.evaluate(() => RackStudio.WorkspaceUI.getState().activePanel), null);
    }
    await page.setViewportSize({ width: 540, height: 320 });
    await page.locator('#btn-mobile-selection').click(); await page.waitForTimeout(250);
    const bounds = await page.locator('#sidebar-right').boundingBox(); assert.equal(bounds.y, 0);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { for (let i = 0; i < 21; i++) document.getElementById('btn-compact-view').click(); });
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#btn-compact-view').getAttribute('aria-expanded'), 'true');
    const motion = await page.locator('.workspace-chevron').evaluate(e => ({ transform: getComputedStyle(e).transform, duration: getComputedStyle(e).transitionDuration, decoration: getComputedStyle(e.parentElement).textDecorationLine }));
    assert.notEqual(motion.transform, 'none'); assert.equal(motion.decoration, 'none');
    await page.waitForTimeout(150); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#btn-compact-view').getAttribute('aria-expanded'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.workspace-chevron').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    const domainBeforeGuide = await page.evaluate(() => RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE)));
    await page.evaluate(() => RackStudio.Onboarding.open());
    const guide = page.getByRole('complementary', { name: 'İlk kullanım', exact: true });
    assert.ok(await guide.getByRole('button', { name: 'Kapat', exact: true }).isVisible(), 'guide controls stay visible in 3D');
    const guideBounds = await guide.boundingBox(), canvasBounds = await page.locator('#studio3d-container').boundingBox();
    assert.ok(guideBounds.y + guideBounds.height <= canvasBounds.y, 'guide reserves its own space above the 3D canvas');
    await guide.getByRole('button', { name: 'Kapat', exact: true }).click();
    assert.equal(await page.evaluate(() => RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE))), domainBeforeGuide);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('phone mounting and port picker mutate the real project; validation, undo, save and view restoration survive the shell', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const { page, errors } = await open(browser);
    await page.evaluate(() => {
      RackStudio.loadCustomTopology({ racks: [{ id: 'phone-rack', name: 'Telefon', heightU: 12, devices: [] }, { id: 'second-rack', name: 'İkinci', heightU: 12, devices: [] }], cables: [] });
      RackStudio.setViewMode('multi'); RackStudio.flushProjectChanges();
    });
    const before = await page.evaluate(() => RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE)));
    await page.setViewportSize({ width: 320, height: 844 });
    await page.waitForFunction(() => RackStudio.STATE.viewMode === 'single');
    assert.equal(await page.evaluate(() => RackStudio.STATE.viewMode), 'single');
    assert.equal(await page.evaluate(() => RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE))), before);
    for (const [model, slot] of [['cisco-2960x-24ps', '11'], ['patch-cat6-24', '9']]) {
      await page.locator('#btn-mobile-catalog').click();
      await page.evaluate(model => window.openMobileMountFlow(model), model);
      await page.selectOption('#mobile-mount-slot', slot);
      await page.locator('#mobile-workflow-dialog').getByRole('button', { name: 'Yerleştir', exact: true }).click();
    }
    assert.equal(await page.evaluate(() => RackStudio.getActiveRack().devices.length), 2);
    await page.locator('#btn-mode-cabling').click();
    await page.locator('#btn-mobile-selection').click();
    await page.locator('#sidebar-right').getByRole('button', { name: 'Port seçerek bağla', exact: true }).click();
    const ids = await page.evaluate(() => RackStudio.getActiveRack().devices.map(d => d.instanceId));
    await page.selectOption('#mobile-port-device', ids[0]);
    await page.locator('.mobile-port-option').first().click();
    assert.ok(await page.evaluate(() => RackStudio.STATE.pendingConnection));
    await page.selectOption('#mobile-port-device', ids[1]);
    await page.locator('.mobile-port-option').first().click();
    assert.equal(await page.evaluate(() => RackStudio.STATE.cables.length), 1);
    await page.waitForFunction(() => document.getElementById('workflow-guidance')?.textContent.includes('Bağlantı oluşturuldu'));
    assert.match(await page.locator('#workflow-guidance').textContent(), /Bağlantı oluşturuldu/);
    await page.evaluate(() => { RackStudio.WorkspaceUI.closePanel(); RackStudio.flushProjectChanges(); });
    await page.locator('#btn-3d-undo').click();
    await page.waitForFunction(() => RackStudio.STATE.cables.length === 0);
    await page.locator('#btn-tools-menu-toggle').click();
    await page.locator('#workspace-menu-btn-3d-redo').click();
    await page.waitForFunction(() => RackStudio.STATE.cables.length === 1);
    await page.evaluate(() => RackStudio.saveProjectNow());
    assert.equal(await page.evaluate(() => RackStudio.STATE.cables.length), 1);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => RackStudio.STATE.viewMode === 'multi');
    assert.equal(await page.evaluate(() => RackStudio.STATE.viewMode), 'multi');
    await page.locator('#workspace-project').click();
    assert.ok(await page.locator('.project-manager').isVisible()); await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
