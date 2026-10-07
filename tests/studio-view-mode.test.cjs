const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
  if (!target.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(target, (error, body) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(body);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.RackStudio?.PixiContext?.deviceContainers?.size > 0);
    assert.equal(await page.evaluate(() => RackStudio.STATE.studioWorkMode), 'layout');
    assert.equal(await page.locator('#btn-mode-layout').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#btn-mode-cabling').getAttribute('aria-pressed'), 'false');
    assert.ok(await page.locator('#layout-overview').isVisible());
    assert.ok(await page.locator('#layout-legend').isVisible());
    assert.equal(await page.locator('#btn-toggle-cables').isEnabled(), false);
    assert.equal(await page.locator('#schedule-toolbar').isVisible(), false);
    assert.equal(await page.locator('#status-zoom').textContent(), await page.locator('#zoom-badge').textContent());
    assert.equal(await page.evaluate(() => RackStudio.PixiContext.cableDisplays.size), 0, 'placement does not build hidden cable paths');
    const initial = await page.evaluate(() => {
      const RS = RackStudio, entries = [...RS.PixiContext.deviceContainers.values()];
      window.__topologyBefore = JSON.stringify({ racks: RS.STATE.racks, cables: RS.STATE.cables });
      return {
        cards: entries.every(e => e.macroLabel.visible && !e.ports.visible && (!e.chassis || !e.chassis.visible) && (!e.overlays || !e.overlays.visible)),
        colors: new Set(entries.map(e => RS.DeviceLayoutPresentation.profile(e.device.category).accent)).size,
        maxFont: Math.max(...entries.flatMap(e => e.macroLabel.children.map(t => t.style?.fontSize || 0)))
      };
    });
    assert.ok(initial.cards && initial.colors >= 4 && initial.maxFont >= 20, 'large replacement cards with distinct category colors');
    // First entry into cabling creates the retained port sprites once.
    await page.evaluate(() => { RackStudio.setZoom(0.9); });
    await page.locator('#btn-mode-cabling').click();
    assert.ok(await page.locator('#schedule-toolbar').isVisible());
    await page.waitForFunction(() => RackStudio.PixiContext.devicePortSprites.size > 0);
    const transitions = await page.evaluate(() => {
      const RS = RackStudio, ctx = RS.PixiContext, first = ctx.deviceContainers.values().next().value;
      const container = first.container, ports = ctx.devicePortSprites.size;
      const rebuilds = ctx.performanceTelemetry.deviceChassisRebuilds;
      RS.setCablesVisible(false);
      RS.setStudioWorkMode('layout'); RS.setStudioWorkMode('cabling');
      const preference = !ctx.getCablesContainer().visible && RS.STATE.cablesVisible === false;
      RS.setCablesVisible(true);
      RS.setZoom(0.4);
      const far = first.macroLabel.visible && !first.ports.visible && !ctx.getCablesContainer().visible && !ctx.getConnectorsContainer().visible;
      const port = RS.DeviceSceneRegistry.getSnapshot().ports[0];
      const viewport = document.getElementById('viewport-canvas').getBoundingClientRect();
      const x = viewport.left + RS.ZOOM_STATE.panX + port.x * RS.ZOOM_STATE.scale;
      const y = viewport.top + RS.ZOOM_STATE.panY + port.y * RS.ZOOM_STATE.scale;
      const hiddenPort = RS.hitPixiDevicePortAt(x, y) === null;
      RS.setZoom(0.49); const stillFar = RS.StudioView.getCameraLod() === 'macro';
      RS.setZoom(0.55); const medium = RS.StudioView.getCameraLod() === 'medium' && ctx.getCablesContainer().visible && !ctx.getConnectorsContainer().visible;
      RS.setZoom(0.8); const near = first.ports.visible && !first.macroLabel.visible && ctx.getCablesContainer().visible && ctx.getConnectorsContainer().visible;
      return { preference, far, hiddenPort, stillFar, medium, near,
        retained: first.container === container && ports === ctx.devicePortSprites.size,
        rebuilds: ctx.performanceTelemetry.deviceChassisRebuilds - rebuilds,
        unchanged: window.__topologyBefore === JSON.stringify({ racks: RS.STATE.racks, cables: RS.STATE.cables }) };
    });
    for (const key of ['preference', 'far', 'hiddenPort', 'stillFar', 'medium', 'near', 'retained', 'unchanged']) assert.ok(transitions[key], key);
    assert.equal(transitions.rebuilds, 0, 'mode and zoom switches retain chassis geometry');
    // A real port click must still start a connection after returning from layout.
    await page.evaluate(() => {
      const RS = RackStudio;
      RS.loadCustomTopology({ racks: [{ id: 'lod-test', name: 'Yerleşim testi', heightU: 12, devices: [] }], cables: [] });
      RS.mountDeviceAt('cisco-2960x-24ps', 11); RS.mountDeviceAt('organizer-1u', 10); RS.mountDeviceAt('patch-cat6-24', 9);
      RS.refresh(); RS.fitRackToScreen(false); RS.setZoom(1);
    });
    await page.waitForFunction(() => RackStudio.PixiContext.devicePortSprites.size > 0);
    const point = await page.evaluate(() => {
      const RS = RackStudio, device = RS.getActiveRack().devices[0];
      const port = RS.DeviceSceneRegistry.getPortPoint(device.instanceId, RS.catalog[device.catalogKey].ports[0].id);
      const rect = document.getElementById('viewport-canvas').getBoundingClientRect();
      return { x: rect.left + RS.ZOOM_STATE.panX + port.x * RS.ZOOM_STATE.scale, y: rect.top + RS.ZOOM_STATE.panY + port.y * RS.ZOOM_STATE.scale };
    });
    await page.mouse.click(point.x, point.y);
    assert.ok(await page.evaluate(() => RackStudio.STATE.pendingConnection), 'port click starts a connection');
    await page.locator('#btn-mode-layout').click();
    assert.equal(await page.evaluate(() => RackStudio.STATE.pendingConnection), null);
    const layoutCablePreference = await page.evaluate(() => RackStudio.STATE.cablesVisible);
    await page.keyboard.press('c');
    assert.equal(await page.evaluate(() => RackStudio.STATE.cablesVisible), layoutCablePreference, 'C in layout preserves cabling preference');
    await page.locator('.layout-device-row').first().click();
    assert.ok(await page.evaluate(() => RackStudio.STATE.selectedDeviceId), 'inventory selects device');
    // A new mount and metadata edit must update placement information immediately.
    await page.evaluate(() => {
      const RS = RackStudio;
      const mounted = RS.mountDeviceAt('organizer-2u', 7);
      RS.refresh();
      if (mounted) RS.updateDeviceMetadata(mounted.instanceId, { name: 'MDF KABLO KANALI' });
      RS.LayoutOverview.refresh();
    });
    assert.equal(await page.locator('.layout-device-row').count(), 4);
    assert.ok(await page.locator('.layout-device-name').filter({ hasText: 'MDF KABLO KANALI' }).count());
    const deferred = await page.evaluate(() => {
      const RS = RackStudio, rack = RS.getActiveRack(), from = rack.devices[0], to = rack.devices[2];
      RS.STATE.cables = [{ id: 'deferred-connection', from: { rackId: rack.id, instanceId: from.instanceId, portId: RS.catalog[from.catalogKey].ports[0].id },
        to: { rackId: rack.id, instanceId: to.instanceId, portId: RS.catalog[to.catalogKey].ports[0].id }, color: '#3577bb' }];
      RS.renderAllCables();
      const delayed = RS.PixiContext.cablesDeferred && RS.PixiContext.cableDisplays.size === 0;
      RS.setStudioWorkMode('cabling');
      return { delayed, reconciled: !RS.PixiContext.cablesDeferred && RS.PixiContext.cableDisplays.has('deferred-connection') };
    });
    assert.ok(deferred.delayed && deferred.reconciled, 'hidden changes reconcile before cable display');
    await page.evaluate(() => { RackStudio.setStudioWorkMode('cabling'); RackStudio.setZoom(1); });
    await page.keyboard.press('c');
    assert.equal(await page.locator('#btn-toggle-cables').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('c');
    assert.equal(await page.locator('#btn-toggle-cables').getAttribute('aria-pressed'), 'true');
    // Screenshots and bounds checks at desktop/tablet/phone sizes.
    fs.mkdirSync(path.join(root, 'scratch', 'studio-view'), { recursive: true });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; RackStudio.setStudioWorkMode('layout'); RackStudio.renderAllCables(); }, theme);
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        if (width <= 1023) await page.evaluate(() => { window.setLeftSidebarCollapsed?.(true); window.setRightSidebarCollapsed?.(true, false); });
        await page.evaluate(() => RackStudio.fitRackToScreen(false));
        await page.waitForTimeout(350);
        const bounds = await page.locator('#studio-work-mode-switch').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 48, `mode controls fit ${theme}/${width}`);
        const legend = await page.locator('#layout-legend').boundingBox();
        assert.ok(legend.x >= 0 && legend.x + legend.width <= width, `legend fits ${theme}/${width}`);
        await page.screenshot({ path: path.join(root, 'scratch', 'studio-view', `${theme}-${width}.png`) });
      }
    }
    await page.locator('#btn-mode-cabling').click();
    assert.ok(await page.locator('#btn-toggle-cables').isVisible(), 'phone exposes cable visibility control');
    await page.evaluate(() => RackStudio.setStudioWorkMode('layout'));
    assert.equal(await page.locator('#layout-overview').isVisible(), false, 'collapsed placement panel hides its content');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(JSON.stringify({ passed: true, transitions, screenshots: 6 }));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
