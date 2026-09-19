const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
  const target = path.resolve(root, `.${urlPath}`);
  if (!target.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.RackStudio?.mountDeviceAt);

    const endpoint = await page.evaluate(async () => {
      const RS = window.RackStudio;
      const rack = RS.getActiveRack();
      rack.devices = [];
      RS.STATE.cables = [];
      RS.mountDeviceAt('cisco-2960x-24ps', 31);
      RS.mountDeviceAt('organizer-dring-1u', 30);
      RS.mountDeviceAt('patch-cat6-24', 29);
      RS.renderMountedDevices();

      const from = rack.devices.find(device => device.topU === 31);
      const to = rack.devices.find(device => device.topU === 29);
      const fromPort = RS.HARDWARE_CATALOG[from.catalogKey].ports[0].id;
      const toPort = RS.HARDWARE_CATALOG[to.catalogKey].ports[0].id;
      const fromPort2 = RS.HARDWARE_CATALOG[from.catalogKey].ports[1].id;
      const toPort2 = RS.HARDWARE_CATALOG[to.catalogKey].ports[1].id;
      window.__pixiTestEndpoint = { instanceId: from.instanceId, portId: fromPort };
      RS.STATE.cables.push({
        id: 'pixi-regression-cable',
        from: { rackId: rack.id, instanceId: from.instanceId, portId: fromPort },
        to: { rackId: rack.id, instanceId: to.instanceId, portId: toPort },
        color: '#0070d2',
        lengthMeters: 0.5
      });
      RS.STATE.cables.push({
        id: 'pixi-regression-cable-2',
        from: { rackId: rack.id, instanceId: from.instanceId, portId: fromPort2 },
        to: { rackId: rack.id, instanceId: to.instanceId, portId: toPort2 },
        color: '#10b981',
        lengthMeters: 0.5
      });
      RS.renderScheduleTable();
      RS.STATE.highlightedCableId = null;
      RS.setCableRenderMode('pixi');
      await new Promise(resolve => setTimeout(resolve, 250));
      RS.renderAllCables();
      await new Promise(resolve => setTimeout(resolve, 50));
      const port = document.getElementById(`port-${from.instanceId}-${fromPort}`);
      const rect = port.getBoundingClientRect();
      const port2 = document.getElementById(`port-${from.instanceId}-${fromPort2}`);
      const rect2 = port2.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        x2: rect2.left + rect2.width / 2,
        y2: rect2.top + rect2.height / 2
      };
    });

    const retainedRender = await page.evaluate(() => {
      const before = window.RackStudio.getPixiCableInteractionState().renderStats;
      window.RackStudio.renderAllCables();
      const after = window.RackStudio.getPixiCableInteractionState().renderStats;
      return { before, after };
    });
    assert.equal(retainedRender.after.fastPathHits, retainedRender.before.fastPathHits + 1, 'unchanged scene must use retained fast path');
    assert.equal(retainedRender.after.domRectReads, retainedRender.before.domRectReads, 'retained render must not read DOM geometry');
    assert.equal(retainedRender.after.createdDisplays, retainedRender.before.createdDisplays, 'retained render must not allocate cable displays');

    await page.mouse.move(endpoint.x, endpoint.y);
    await page.waitForTimeout(80);
    const hoverState = await page.evaluate(() => ({
      pointerEvents: document.getElementById('cables-pixi-canvas').style.pointerEvents,
      tooltipVisible: window.RackStudio.dom.tooltip?.style.display !== 'none',
      selected: window.RackStudio.STATE.highlightedCableId,
      hoveredRows: Array.from(document.querySelectorAll('#schedule-tbody .hovered-row, #schedule-tbody .tree-cable-row.hovered')).map(row => row.dataset.cableId),
      pixi: window.RackStudio.getPixiCableInteractionState()
    }));
    assert.equal(hoverState.pointerEvents, 'auto');
    assert.equal(hoverState.tooltipVisible, true);
    assert.equal(hoverState.selected, null, 'hover must not mutate cable selection');
    assert.deepEqual(hoverState.hoveredRows, ['pixi-regression-cable']);
    assert.equal(hoverState.pixi.hoveredCableId, 'pixi-regression-cable');
    assert.equal(hoverState.pixi.alphaByCable['pixi-regression-cable'], 1);
    assert.equal(hoverState.pixi.alphaByCable['pixi-regression-cable-2'], 0.14, 'non-hovered cables must dim strongly');
    assert.equal(hoverState.pixi.glowAlphaByCable['pixi-regression-cable'], 1, 'hovered cable must have a visible glow layer');
    assert.equal(hoverState.pixi.glowAlphaByCable['pixi-regression-cable-2'], 0, 'non-hovered cable glow must stay hidden');
    assert.equal(hoverState.pixi.organizerOverlayCount, 1, 'D-ring foreground hoops must share one batched Pixi graphic');
    assert.ok(hoverState.pixi.resolution >= 2, 'Pixi backing buffer must use high-resolution rendering');

    const secondDirectHit = await page.evaluate(({ x, y }) => window.RackStudio.hitTestPixiCable(x, y), { x: endpoint.x2, y: endpoint.y2 });
    assert.equal(secondDirectHit, 'pixi-regression-cable-2', 'nearest-segment picking must select the exact cable endpoint');
    await page.mouse.move(endpoint.x2, endpoint.y2);
    await page.waitForTimeout(80);
    const secondHover = await page.evaluate(() => ({
      hoveredRows: Array.from(document.querySelectorAll('#schedule-tbody .hovered-row, #schedule-tbody .tree-cable-row.hovered')).map(row => row.dataset.cableId),
      pixiHovered: window.RackStudio.getPixiCableInteractionState().hoveredCableId
    }));
    assert.deepEqual(secondHover.hoveredRows, ['pixi-regression-cable-2'], 'only the matching schedule row may be highlighted');
    assert.equal(secondHover.pixiHovered, 'pixi-regression-cable-2');

    const scheduleRow = page.locator('#schedule-tbody [data-cable-id="pixi-regression-cable"]').first();
    await scheduleRow.scrollIntoViewIfNeeded();
    const scheduleRowBox = await scheduleRow.boundingBox();
    assert.ok(scheduleRowBox, 'schedule row must be visible');
    await page.mouse.move(scheduleRowBox.x + scheduleRowBox.width / 2, scheduleRowBox.y + scheduleRowBox.height / 2);
    await page.waitForTimeout(50);
    const scheduleHover = await page.evaluate(() => ({
      rows: Array.from(document.querySelectorAll('#schedule-tbody .hovered-row')).map(row => row.dataset.cableId),
      pixiHovered: window.RackStudio.getPixiCableInteractionState().hoveredCableId,
      alpha: window.RackStudio.getPixiCableInteractionState().alphaByCable,
      glow: window.RackStudio.getPixiCableInteractionState().glowAlphaByCable
    }));
    assert.deepEqual(scheduleHover.rows, ['pixi-regression-cable']);
    assert.equal(scheduleHover.pixiHovered, 'pixi-regression-cable', 'schedule hover must update the Pixi cable');
    assert.equal(scheduleHover.alpha['pixi-regression-cable'], 1);
    assert.equal(scheduleHover.alpha['pixi-regression-cable-2'], 0.14);
    assert.equal(scheduleHover.glow['pixi-regression-cable'], 1);

    await page.evaluate(() => {
      window.RackStudio.focusOnCable = () => {};
      const row = document.querySelector('#schedule-tbody tr[data-cable-id="pixi-regression-cable"]');
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const scheduleSelection = await page.evaluate(() => ({
      selected: window.RackStudio.STATE.highlightedCableId,
      activeRows: Array.from(document.querySelectorAll('#schedule-tbody tr.active, #schedule-tbody .tree-cable-row.active')).map(row => row.dataset.cableId),
      pixiSelected: window.RackStudio.getPixiCableInteractionState().selectedCableId
    }));
    assert.equal(scheduleSelection.selected, 'pixi-regression-cable');
    assert.deepEqual(scheduleSelection.activeRows, ['pixi-regression-cable']);
    assert.equal(scheduleSelection.pixiSelected, 'pixi-regression-cable', 'schedule selection must update Pixi display state');

    await page.locator('.sort-tab-btn[data-sort="tree"]').click();
    const treeRow = page.locator('.tree-cable-row[data-cable-id="pixi-regression-cable-2"]');
    await treeRow.scrollIntoViewIfNeeded();
    const treeRowBox = await treeRow.boundingBox();
    assert.ok(treeRowBox, 'switch tree cable row must be visible');
    await page.mouse.move(treeRowBox.x + treeRowBox.width / 2, treeRowBox.y + treeRowBox.height / 2);
    await page.waitForTimeout(50);
    const treeHover = await page.evaluate(() => ({
      hovered: document.querySelector('.tree-cable-row[data-cable-id="pixi-regression-cable-2"]')?.classList.contains('hovered'),
      pixi: window.RackStudio.getPixiCableInteractionState()
    }));
    assert.equal(treeHover.hovered, true);
    assert.equal(treeHover.pixi.hoveredCableId, 'pixi-regression-cable-2');
    assert.equal(treeHover.pixi.alphaByCable['pixi-regression-cable'], 0.14);
    assert.equal(treeHover.pixi.glowAlphaByCable['pixi-regression-cable-2'], 1);

    await page.waitForTimeout(500);
    const focusedEndpoint = await page.evaluate(() => {
      const ref = window.__pixiTestEndpoint;
      const rect = document.getElementById(`port-${ref.instanceId}-${ref.portId}`).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(focusedEndpoint.x, focusedEndpoint.y);
    await page.waitForTimeout(50);

    await page.mouse.click(focusedEndpoint.x, focusedEndpoint.y);
    await page.waitForTimeout(50);
    const clickState = await page.evaluate(() => ({
      selected: window.RackStudio.STATE.highlightedCableId,
      hudVisible: !!document.getElementById('cable-quick-hud')
    }));
    assert.equal(clickState.selected, 'pixi-regression-cable');
    assert.equal(clickState.hudVisible, true);

    await page.mouse.click(focusedEndpoint.x, focusedEndpoint.y, { button: 'right' });
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#cable-context-menu').count(), 1);
    const menuRectBefore = await page.locator('#cable-context-menu').boundingBox();
    await page.waitForTimeout(180);
    const menuRectAfter = await page.locator('#cable-context-menu').boundingBox();
    assert.ok(menuRectBefore && menuRectAfter);
    assert.ok(Math.abs(menuRectBefore.x - menuRectAfter.x) < 1 && Math.abs(menuRectBefore.y - menuRectAfter.y) < 1, 'context menu must not jump after opening');

    const redSwatch = page.locator('.context-color-swatch[data-color="#ef4444"]');
    await redSwatch.hover();
    assert.equal(await page.evaluate(() => window.RackStudio.getPixiCableInteractionState().previewColorByCable['pixi-regression-cable']), 0xef4444);
    await redSwatch.click();
    const committedColor = await page.evaluate(() => ({
      model: window.RackStudio.STATE.cables.find(c => c.id === 'pixi-regression-cable').color,
      pixi: window.RackStudio.getPixiCableInteractionState().colorByCable['pixi-regression-cable'],
      selected: window.RackStudio.STATE.highlightedCableId
    }));
    assert.equal(committedColor.model, '#ef4444');
    assert.equal(committedColor.pixi, 0xef4444);
    assert.equal(committedColor.selected, 'pixi-regression-cable', 'color changes must preserve selection');

    await page.evaluate(() => {
      document.getElementById('cable-context-menu')?.remove();
      window.__pixiRenameCableId = null;
      window.RackStudio.renameCable2D = cableId => { window.__pixiRenameCableId = cableId; };
    });
    await page.mouse.dblclick(focusedEndpoint.x, focusedEndpoint.y);
    assert.equal(await page.evaluate(() => window.__pixiRenameCableId), 'pixi-regression-cable');

    const emptyPoint = await page.evaluate(() => {
      const rect = document.getElementById('cables-pixi-canvas').getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.bottom - 20 };
    });
    await page.mouse.move(emptyPoint.x, emptyPoint.y);
    await page.waitForTimeout(50);
    const leaveState = await page.evaluate(() => ({
      pointerEvents: document.getElementById('cables-pixi-canvas').style.pointerEvents,
      tooltipVisible: window.RackStudio.dom.tooltip?.style.display !== 'none'
    }));
    assert.equal(leaveState.pointerEvents, 'none', 'empty canvas area must click through to ports and racks');
    assert.equal(leaveState.tooltipVisible, false);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    server.close();
  }
}

run().then(() => console.log('Pixi cable interaction regression checks passed.')).catch(error => {
  console.error(error);
  process.exitCode = 1;
  server.close();
});
