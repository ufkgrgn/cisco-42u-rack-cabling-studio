const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const output = path.resolve(__dirname, '../docs/product-plan/results/studio-lod');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.locator('#onboarding-invite').evaluateAll(nodes => nodes.forEach(n => n.remove()));
    await page.evaluate(() => {
      RackStudio.setStudioWorkMode('cabling');
      window.__lodTopology = JSON.stringify({ racks: RackStudio.STATE.racks, cables: RackStudio.STATE.cables });
    });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => RackStudio.WorkspaceUI.closePanel());
      for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
        await page.evaluate(theme => RackStudioTheme.apply(theme), theme);
        for (const [scale, expected] of [[.5, 'macro'], [.85, 'medium'], [1.3, 'ports'], [2, 'ports'], [2.2, 'detail']]) {
          const state = await page.evaluate(scale => {
            const R = RackStudio, ctx = R.PixiContext;
            R.setZoom(scale);
            const entries = [...ctx.deviceContainers.values()];
            const entry = entries.find(e => e.device.category === 'switch');
            R.ZOOM_STATE.panX = 30 - entry.device.x * scale;
            R.ZOOM_STATE.panY = 150 - entry.device.y * scale;
            R.updateStageTransform(false);
            const port = R.DeviceSceneRegistry.getSnapshot().ports.find(p => p.instanceId === entry.device.instanceId);
            const rect = R.dom.viewportCanvas.getBoundingClientRect();
            return {
              lod: R.StudioView.getCameraLod(), flat: entry.flatChassis.visible,
              ports: entry.ports.visible, labels: entry.portLabels.visible, macro: entry.macroLabel.visible,
              detail: !!(entry.chassis?.visible || entry.overlays?.visible),
              organizers: ctx.organizerOverlayContainer?.visible || false,
              hit: !!R.hitPixiDevicePortAt(rect.left + R.ZOOM_STATE.panX + port.x * scale, rect.top + R.ZOOM_STATE.panY + port.y * scale),
              unchanged: window.__lodTopology === JSON.stringify({ racks: R.STATE.racks, cables: R.STATE.cables })
            };
          }, scale);
          const label = `${theme}/${width}/${scale}`;
          assert.equal(state.lod, expected, label);
          assert.equal(state.ports, scale >= 1.3, label);
          assert.equal(state.hit, scale >= 1.3, label);
          assert.equal(state.labels, scale > 2, label);
          assert.equal(state.detail, scale > 2, label);
          assert.equal(state.flat, scale > .5 && scale <= 2, label);
          assert.equal(state.macro, scale === .5, label);
          assert.equal(state.organizers, scale > 2, label);
          assert.ok(state.unchanged, label);
          await page.screenshot({ path: path.join(output, `${theme}-${width}-${scale}.png`) });
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('80 theme, viewport and LOD combinations passed; topology and picking verified.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
