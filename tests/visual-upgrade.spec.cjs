const { test, expect } = require('playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const themes = ['light', 'dark', 'blueprint', 'high-contrast'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
let server;
let baseUrl;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, content) => {
      if (error) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(content);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

for (const theme of themes) {
  test(`${theme} theme keeps 2D and 3D chrome readable`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('rack-studio-theme', value), theme);
    await page.goto(baseUrl);
    await page.locator('#rack-viewport').waitFor();
    expect(await page.evaluate(async () => {
      await Promise.all([document.fonts.load('500 14px Inter', 'Türkçe'), document.fonts.load('500 14px "JetBrains Mono"', 'Bağlantı')]);
      return document.fonts.check('500 14px Inter', 'Türkçe') && document.fonts.check('500 14px "JetBrains Mono"', 'Bağlantı');
    })).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveScreenshot(`${theme}-2d.png`, {
      animations: 'disabled',
      mask: [page.locator('#rack-viewport')],
      maxDiffPixelRatio: 0.015
    });

    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
    await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#cable-palette-options')).toBeHidden();
    await expect(page).toHaveScreenshot(`${theme}-3d.png`, {
      animations: 'disabled',
      mask: [page.locator('#studio3d-container'), page.locator('#fps-counter')],
      maxDiffPixelRatio: 0.015
    });
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('3D rails and camera fit real one- and three-rack scenes', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  const inspect = async () => page.evaluate(() => {
    const studio = window.__STUDIO3D__;
    studio.scene.updateMatrixWorld(true);
    studio.camera.updateMatrixWorld(true);
    const boxes = studio.rackGroup.children.filter(child => child.name.startsWith('rack_enclosure_'));
    const rails = boxes.flatMap(box => box.children.filter(child => child.geometry?.type === 'BoxGeometry' && child.geometry.parameters.height > 18 && child.geometry.parameters.width === 0.16));
    const corners = boxes.flatMap(box => {
      const bounds = new THREE.Box3().setFromObject(box);
      return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x,y,z).project(studio.camera))));
    });
    return {
      rackCount: boxes.length,
      railCount: rails.length,
      ghostCount: studio.ghostRacksGroup.children.length,
      maxX: Math.max(...corners.map(v => Math.abs(v.x))),
      maxY: Math.max(...corners.map(v => Math.abs(v.y)))
    };
  });

  const one = await inspect();
  expect(one.rackCount).toBe(1);
  expect(one.railCount).toBe(4);
  expect(one.ghostCount).toBe(0);
  expect(one.maxX).toBeLessThan(0.95);
  expect(one.maxY).toBeLessThan(0.95);

  await page.evaluate(() => {
    const studio = window.__STUDIO3D__;
    const seed = studio.state.devices.slice(0, 2);
    studio.state.racks = ['MDF', 'IDF 1', 'IDF 2'].map((name, index) => ({ id: `visual-${index}`, name, heightU: 42 }));
    studio.state.devices = studio.state.racks.flatMap((rack, index) => seed.map((device, offset) => ({ ...device, id: `visual-device-${index}-${offset}`, rackId: rack.id, startU: 35 - offset * 3 })));
    studio.state.cables = [];
    studio.buildRack(42);
    studio.rebuildAllDevices();
    studio.fitCameraToRacks('iso');
  });
  const three = await inspect();
  expect(three.rackCount).toBe(3);
  expect(three.railCount).toBe(12);
  expect(three.maxX).toBeLessThan(0.95);
  expect(three.maxY).toBeLessThan(0.95);
  fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', 'three-racks.png') });
  await page.close();
});

test('theme choice persists without changing rack data and 3D drawer remains operable', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl);
  await page.locator('#rack-viewport').waitFor();
  const before = await page.evaluate(() => JSON.stringify(window.RackStudio?.STATE?.racks ?? window.RackStudio?.state?.racks));
  await page.locator('#btn-tools-menu-toggle').click();
  await page.locator('#btn-theme-toggle').selectOption('high-contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  expect(await page.evaluate(() => localStorage.getItem('rack-studio-theme'))).toBe('high-contrast');
  expect(await page.evaluate(() => JSON.stringify(window.RackStudio?.STATE?.racks ?? window.RackStudio?.state?.racks))).toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  await expect(page.locator('#btn-theme-toggle')).toHaveValue('high-contrast');

  await page.locator('#btn-view-3d').click();
  await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
  const trigger = page.locator('#btn-3d-catalog');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#catalog-search-input')).toBeVisible();
  await trigger.click();
  await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'true');
  await page.close();
});

for (const width of [390, 820]) {
  test(`${width}px 2D panels and 3D catalog are reachable without network fonts`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const externalRequests = [];
    page.on('request', request => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) externalRequests.push(request.url());
    });
    await page.goto(baseUrl);
    await page.locator('#rack-viewport').waitFor();
    await expect(page.locator('#sidebar-right')).toHaveClass(/collapsed/);
    await page.locator('#btn-compact-view').click();
    await expect(page.locator('#compact-view-2d')).toBeVisible();
    await expect(page.locator('#compact-view-3d')).toBeHidden();
    await page.locator('#btn-compact-view').click();
    fs.mkdirSync(path.join(root, 'tmp', 'visual-upgrade'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-2d.png`) });
    await page.locator('#btn-mobile-catalog').click();
    await expect(page.locator('#btn-mobile-catalog')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => (await page.locator('#sidebar-left').boundingBox()).x).toBeGreaterThanOrEqual(-1);
    const catalogBox = await page.locator('#sidebar-left').boundingBox();
    expect(catalogBox.x).toBeGreaterThanOrEqual(-1);
    expect(catalogBox.width).toBeLessThanOrEqual(width + 1);
    await expect(page.locator('#sidebar-drawer')).toBeVisible();
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-catalog.png`) });
    await page.locator('#btn-mobile-schedule').click();
    await expect(page.locator('#btn-mobile-catalog')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#btn-mobile-schedule')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar-right')).not.toHaveClass(/collapsed/);
    await page.locator('.sidebar-right-scrim').click({ position: { x: 10, y: 300 } });
    await expect(page.locator('#sidebar-right')).toHaveClass(/collapsed/);
    await page.locator('#btn-view-3d').click();
    await page.waitForFunction(() => Boolean(window.__STUDIO3D__?.rackGroup));
    await expect(page.locator('.compact-panel-actions')).toBeHidden();
    await page.locator('#btn-compact-view').click();
    await expect(page.locator('#compact-view-3d')).toBeVisible();
    await expect(page.locator('#compact-view-2d')).toBeHidden();
    await page.locator('#btn-compact-view').click();
    await page.locator('#btn-3d-catalog').click();
    await expect(page.locator('#catalog-drawer')).toHaveAttribute('aria-hidden', 'false');
    await expect.poll(async () => (await page.locator('#catalog-drawer').boundingBox()).x).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: path.join(root, 'tmp', 'visual-upgrade', `${width}-3d-catalog.png`) });
    expect(externalRequests).toEqual([]);
    await page.close();
  });
}

test('2D pan preserves Pixi backing resolution and port presentation', async ({ page }) => {
  await page.goto(baseUrl);
  await page.waitForFunction(() => Boolean(window.RackStudio?.getPixiPerformanceTelemetry?.().resolution));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const studio = window.RackStudio;
    return { resolution: studio.getPixiPerformanceTelemetry().resolution, changes: studio.getPixiPerformanceTelemetry().resolutionChanges, lod: document.getElementById('rack-stage').dataset.lod };
  });
  const after = await page.evaluate(() => {
    const studio = window.RackStudio;
    for (let step = 0; step < 30; step++) {
      studio.ZOOM_STATE.panX += 2;
      studio.updateStageTransform(false);
    }
    return { resolution: studio.getPixiPerformanceTelemetry().resolution, changes: studio.getPixiPerformanceTelemetry().resolutionChanges, lod: document.getElementById('rack-stage').dataset.lod };
  });
  expect(after).toEqual(before);
});
