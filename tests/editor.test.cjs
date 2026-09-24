const {test} = require('node:test');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('rack editor resize, placement guards, move, history and recovery', async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:1100}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(() => {
      localStorage.removeItem('rack-studio-project-v2');
      window.RackStudio.loadCustomTopology({racks:[{id:'rack-1',name:'Test',heightU:42,devices:[]}],cables:[]});
      const key = Object.keys(window.RackStudio.catalog).find(key => window.RackStudio.catalog[key].u === 1);
      window.RackStudio.mountDeviceAt(key, 30);
      window.RackStudio.refresh();
    });
    await page.locator('#studio-height').fill('48');
    await page.locator('[data-command="resize"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().heightU), 48);
    await page.locator('#studio-height').fill('20');
    await page.locator('[data-command="resize"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().heightU), 48);
    await page.locator('.mounted-device').first().dispatchEvent('click');
    await page.locator('#studio-position').fill('25');
    await page.locator('[data-command="move"]').click();
    const top = () => page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU);
    assert.equal(await top(), 25);
    await page.locator('[data-command="undo"]').click();
    assert.equal(await top(), 30);
    await page.locator('[data-command="redo"]').click();
    assert.equal(await top(), 25);
    await page.waitForTimeout(500);
    await page.waitForFunction(() => document.querySelector('#studio-save').textContent === 'Yerel kayıt tamam');
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.waitForTimeout(100);
    assert.equal(await top(), 25);
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().heightU), 48);
    const bounds = await page.locator('.mounted-device').first().boundingBox();
    const step = await page.locator('.rack-slot').first().evaluate(el => el.getBoundingClientRect().height);
    await page.mouse.move(bounds.x + 2, bounds.y + 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 2, bounds.y + 2 + step * 2, {steps:4});
    await page.mouse.up();
    assert.equal(await top(), 23);

    const catalogCard = page.locator('.device-card[data-device-id]:not([hidden])').first();
    const catalogKey = await catalogCard.getAttribute('data-device-id');
    const targetSlot = page.locator('.rack-slot[data-u="40"]').first();
    await catalogCard.dragTo(targetSlot);
    await page.waitForFunction(
      ({key, topU}) => window.RackStudio.getActiveRack().devices.some(device => device.catalogKey === key && device.topU === topU),
      {key: catalogKey, topU: 40}
    );
    assert.equal(
      await page.locator('.rack-slot.drag-valid, .rack-slot.drag-invalid').count(),
      0,
      'catalog drag/drop must clear all slot highlights'
    );

    await page.locator('[data-command="duplicate"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices.length), 3);
    await page.locator('[data-command="delete"]').click();
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices.length), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('legacy localStorage project migrates into IndexedDB', async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('migration-seeded')) {
        localStorage.setItem('rack-studio-project-v2', JSON.stringify({racks:[{id:'rack-1',name:'Legacy',heightU:18,devices:[]}],cables:[]}));
        sessionStorage.setItem('migration-seeded', 'true');
      }
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().heightU), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('rack-studio-project-v2')), null);
    await page.reload();
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().name), 'Legacy');
  } finally { await browser.close(); }
});

test('tablet catalog is an overlay and supports tap-to-place', async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:820,height:1100}, hasTouch:true});
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(() => {
      localStorage.removeItem('rack-studio-project-v2');
      window.RackStudio.loadCustomTopology({racks:[{id:'rack-1',name:'Tablet',heightU:42,devices:[]}],cables:[]});
      window.setLeftSidebarCollapsed(false);
    });
    const viewportWidthBefore = await page.locator('#rack-viewport').evaluate(el => el.getBoundingClientRect().width);
    const card = page.locator('.sidebar-left .device-card[data-device-id]:not([hidden])').first();
    const key = await card.getAttribute('data-device-id');
    await card.click();
    await page.waitForFunction(() => document.getElementById('sidebar-left').classList.contains('collapsed'));
    const viewportWidthAfter = await page.locator('#rack-viewport').evaluate(el => el.getBoundingClientRect().width);
    assert.equal(Math.round(viewportWidthAfter), Math.round(viewportWidthBefore), 'overlay sidebar must not resize the rack viewport');
    await page.locator('.rack-slot[data-u="35"]').first().evaluate(slot => slot.click());
    await page.waitForFunction(
      ({key, topU}) => window.RackStudio.getActiveRack().devices.some(device => device.catalogKey === key && device.topU === topU),
      {key, topU:35}
    );
  } finally { await browser.close(); }
});
