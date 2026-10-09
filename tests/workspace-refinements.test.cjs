const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const output = path.resolve(__dirname, '../docs/product-plan/results/workspace-refinements');
test('compact catalog, connections and help fit without widening panels; actions remain usable', async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.locator('#onboarding-invite').evaluateAll(nodes => nodes.forEach(n => n.remove()));
    await page.evaluate(() => RackStudioTheme.apply('light'));
    assert.ok(await page.locator('.catalog-tree-header').evaluateAll(nodes => nodes.every(e => e.getAttribute('aria-expanded') === 'false')));
    assert.ok(await page.locator('.catalog-group-icon').evaluateAll(nodes => nodes.every(e => e.querySelector('svg'))));
    await page.locator('.catalog-tree-header').first().click();
    const card = page.locator('#sidebar-left .device-card:visible').first();
    const collapsedHeight = (await card.boundingBox()).height;
    assert.ok(collapsedHeight < 80);
    await card.hover();
    await page.waitForTimeout(180);
    assert.equal(await card.locator('.btn-card-quick-mount').isVisible(), false);
    assert.equal(await card.locator('.hw-card-header .device-u-badge').count(), 1);
    assert.equal(await card.locator('.hw-card-footer').count(), 0);
    assert.equal(await card.locator('.hw-visual-container .btn-card-quick-mount').count(), 0);
    const imageBounds = await card.locator('.hw-visual-container').boundingBox();
    assert.ok(imageBounds.width >= (await card.boundingBox()).width - 3, 'preview uses the full card width');
    assert.equal(await card.locator('.hw-visual-container').evaluate(e => getComputedStyle(e).borderWidth), '0px');
    const unitBounds = await card.locator('.device-u-badge').boundingBox();
    const modelBounds = await card.locator('.hw-sku-tag').boundingBox();
    assert.ok(Math.abs(unitBounds.y + unitBounds.height / 2 - modelBounds.y - modelBounds.height / 2) < 2, 'unit and model share one row');
    assert.ok((await card.boundingBox()).height > collapsedHeight);
    assert.equal(await card.locator(".hw-card-header").getAttribute("aria-expanded"), "true");
    assert.equal(await card.locator(".hw-card-header .hw-sku-tag").count(), 1);
    await page.locator('.catalog-quick-chips').hover();
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);
    assert.ok(await page.locator('.catalog-quick-chips').evaluate(e => e.scrollLeft > 0));
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => RackStudio.WorkspaceUI.openPanel('hardware'));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(output, `catalog-${width}.png`) });
      if(width === 320) {
        await card.locator('.btn-card-quick-mount').click();
        assert.ok(await page.locator('#mobile-workflow-dialog').isVisible());
        await page.keyboard.press('Escape');
        await page.locator('#mobile-workflow-dialog').waitFor({ state: 'hidden' });
      }
      if (width < 1200) {
        assert.ok(await card.locator('.btn-card-quick-mount').isVisible());
        const floating = await card.locator('.catalog-corner-label').boundingBox();
        const bounds = await card.boundingBox();
        assert.ok(floating.x >= bounds.x + bounds.width - 1, 'visible add label is outside the card');
        assert.ok(floating.x + floating.width <= width, 'floating action stays on screen');
      }
      await page.evaluate(() => { RackStudio.WorkspaceUI.closePanel(); RackStudio.WorkspaceUI.openPanel('connections'); });
      for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
      await page.evaluate(theme => RackStudioTheme.apply(theme), theme);
      for (const sort of ['u', 'panel', 'tree']) {
        await page.locator(`[data-sort="${sort}"]`).click();
        await page.waitForTimeout(100);
        const bounds = await page.locator('.schedule-table-wrapper').evaluate(e => ({ client: e.clientWidth, scroll: e.scrollWidth }));
        assert.ok(bounds.scroll <= bounds.client + 1, `${width}/${sort} ${JSON.stringify(bounds)}`);
        assert.equal(await page.locator(`[data-sort="${sort}"]`).getAttribute('aria-pressed'), 'true');
        const cableRow = page.locator(sort === 'tree' ? '.tree-cable-row' : '.schedule-cable-card').first();
        await cableRow.hover();
        await page.waitForTimeout(250);
        const cableId = await cableRow.getAttribute('data-cable-id');
        const expectedColors = await cableRow.locator(sort === 'tree' ? '.tree-src-port, .tree-dest-label' : '.schedule-endpoint strong').evaluateAll(nodes => nodes.map(e => getComputedStyle(e).color));
        await page.evaluate(id => RackStudio.setCableHover(id, true, 'pixi'), cableId);
        const hoveredStyle = await cableRow.evaluate(e => ({ filter: getComputedStyle(e).filter, opacity: getComputedStyle(e).opacity }));
        assert.equal(hoveredStyle.filter, 'none', `${theme}/${sort} highlighting must not brighten text`);
        assert.equal(hoveredStyle.opacity, '1');
        assert.deepEqual(await cableRow.locator(sort === 'tree' ? '.tree-src-port, .tree-dest-label' : '.schedule-endpoint strong').evaluateAll(nodes => nodes.map(e => getComputedStyle(e).color)), expectedColors);
        if (width === 1440) await page.screenshot({ path: path.join(output, `connections-hover-${theme}-${sort}.png`) });
        await page.evaluate(id => RackStudio.setCableHover(id, false, 'pixi'), cableId);

        if (sort === 'u') {
          assert.ok(await page.locator('.schedule-endpoint').count() > 0);
          assert.ok(await page.locator('.schedule-endpoint strong').evaluateAll(nodes => nodes.every(e => e.scrollWidth <= e.clientWidth + 1)));
          await page.screenshot({ path: path.join(output, `connections-u-${theme}-${width}.png`) });
        }
      }
      await page.screenshot({ path: path.join(output, `connections-${theme}-${width}.png`) });
      }
      await page.evaluate(() => RackStudio.WorkspaceUI.closePanel());
      for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
        await page.evaluate(theme => { RackStudioTheme.apply(theme); RackStudio.Help.open('devices'); }, theme);
        assert.ok(await page.locator('#help-dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
        await page.screenshot({ path: path.join(output, `help-${theme}-${width}.png`) });
        await page.keyboard.press('Escape');
        await page.locator('#help-dialog').waitFor({ state: 'detached' });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { RackStudioTheme.apply('light'); const d=RackStudio.getActiveRack().devices.find(d => RackStudio.resolveCatalogItem(d.catalogKey)?.ports?.length); RackStudio.WorkflowSelection.choose('device', d.instanceId, '2d'); });
    assert.ok(await page.locator('#workspace-content-selection .selection-actions').isVisible());
    const selectedId = await page.evaluate(() => RackStudio.WorkflowSelection.current().device.instanceId);
    const selectedBox = await page.locator('#'+selectedId).boundingBox();
    await page.mouse.click(selectedBox.x + selectedBox.width / 2, selectedBox.y + selectedBox.height / 2);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(output, 'device-actions.png') });
    assert.ok(await page.locator('#device-floating-controls .autofill-device-btn').isVisible());
    await page.locator('#device-floating-controls .autofill-device-btn').click();
    assert.ok(await page.locator('.switch-autofill-popover').isVisible());
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#device-floating-controls').isVisible(), false);
    await page.setViewportSize({ width: 1440, height: 900 });
    const action = page.locator('#workspace-content-selection').getByRole('button', { name: 'Port ayarları', exact: true });
    await action.click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('#modal-port-edit').isVisible());
    for (const id of ['btn-zoom-in', 'btn-zoom-out']) assert.equal((await page.locator('#'+id).textContent()).trim(), '');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('catalog details expand inline for keyboard and touch; rack totals name their real scope', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.locator('#onboarding-invite').evaluateAll(nodes => nodes.forEach(n => n.remove()));
    assert.ok(await page.locator('.catalog-tree-header').evaluateAll(nodes => nodes.every(e => e.getAttribute('aria-expanded') === 'false')));
    assert.ok(await page.locator('.catalog-group-icon').evaluateAll(nodes => nodes.every(e => e.querySelector('svg'))));
    await page.locator('.catalog-tree-header').first().click();
    const card = page.locator('#sidebar-left .device-card:visible').first();
    const button = card.locator('.hw-card-header');
    await page.keyboard.press('Tab');
    await button.focus();
    assert.equal(await button.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Enter');
    assert.ok(await card.locator('.catalog-detail-stencil').isVisible());
    await page.screenshot({ path: path.join(output, 'catalog-expanded-desktop.png'), animations: 'disabled' });
    await page.evaluate(() => {
      RackStudio.loadCustomTopology({ racks: [{ id: 'a', name: 'Ana kabin', heightU: 42, devices: [] }, { id: 'b', name: 'İkinci kabin', heightU: 42, devices: [] }], cables: [] });
      RackStudio.mountDeviceAt('patch-cat6-24', 42, 'a'); RackStudio.mountDeviceAt('patch-cat6-24', 42, 'b'); RackStudio.refresh();
      RackStudio.setViewMode('multi'); RackStudio.LayoutOverview.refresh(); RackStudio.WorkspaceUI.openPanel('devices');
    });
    assert.match(await page.locator('.layout-summary-scope').textContent(), /2 kabin · toplam 84U/);
    assert.deepEqual(await page.locator('.layout-summary > div strong').allTextContents(), ['2', '2U', '82U']);
    await page.screenshot({ path: path.join(output, 'occupancy-multiple-racks.png') });
    await page.evaluate(() => { RackStudio.setViewMode('single'); RackStudio.LayoutOverview.refresh(); });
    assert.match(await page.locator('.layout-summary-scope').textContent(), /1 kabin · toplam 42U/);
    assert.match(await page.locator('.layout-summary-scope').textContent(), /Ana kabin/);
    assert.deepEqual(await page.locator('.layout-summary > div strong').allTextContents(), ['1', '1U', '41U']);
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const phone = await touch.newPage();
    await phone.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await phone.waitForSelector('.studio-editor[data-ready="true"]');
    await phone.locator('#btn-mobile-catalog').tap();
    await phone.locator('.catalog-tree-header').first().tap();
    const model = phone.locator('#sidebar-left .device-card:visible').first();
    await model.locator('.hw-card-header').tap();
    assert.equal(await model.locator('.hw-card-header').getAttribute('aria-expanded'), 'true');
    assert.ok(await model.locator('.device-name').isVisible());
    await phone.waitForFunction(() => { const body = document.querySelector('#sidebar-left .device-card.details-expanded .hw-card-detail-body'); return body && body.clientHeight > 0 && body.clientHeight >= body.scrollHeight - 1; });
    await phone.waitForTimeout(350);
    await phone.screenshot({ path: path.join(output, 'catalog-expanded-touch.png'), animations: 'disabled' });
    await model.locator('.hw-card-header').tap();
    assert.equal(await model.locator('.hw-card-header').getAttribute('aria-expanded'), 'false');
    await touch.close();
  } finally { await browser.close(); }
});
