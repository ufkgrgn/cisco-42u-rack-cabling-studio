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
    assert.equal(hoverState.pixi.blurredGlowCount, 0, 'focused Pixi cable must avoid expensive blur filters');
    assert.equal(hoverState.pixi.organizerOverlayCount, 1, 'D-ring foreground hoops must share one batched Pixi graphic');
    assert.ok(hoverState.pixi.resolution <= 1.5, 'balanced profile must bound backing-buffer resolution');
    assert.ok(hoverState.pixi.performance.framebufferPixels <= hoverState.pixi.performance.pixelBudget, 'Pixi framebuffer must respect the active pixel budget');
    assert.equal(hoverState.pixi.viewportRendererV2, true, 'Pixi must use the viewport-sized V2 renderer');
    assert.ok(hoverState.pixi.rendererSize.width <= 1600 && hoverState.pixi.rendererSize.height <= 1000, 'Pixi backing surface must be bounded by the viewport');
    assert.ok(hoverState.pixi.renderStats.batchDisplayCount < 32, 'batched rendering must not create per-cable display objects');

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
    await page.evaluate(() => {
      window.RackStudio.showCableContextMenu(
        'pixi-regression-cable',
        window.innerWidth - 1,
        window.innerHeight - 1
      );
    });
    const menuRectBefore = await page.locator('#cable-context-menu').boundingBox();
    await page.waitForTimeout(180);
    const menuRectAfter = await page.locator('#cable-context-menu').boundingBox();
    assert.ok(menuRectBefore && menuRectAfter);
    assert.ok(Math.abs(menuRectBefore.x - menuRectAfter.x) < 1 && Math.abs(menuRectBefore.y - menuRectAfter.y) < 1, 'context menu must not jump after opening');
    assert.ok(menuRectBefore.x >= 0 && menuRectBefore.y >= 0, 'context menu must stay inside the top/left viewport bounds');
    assert.ok(menuRectBefore.x + menuRectBefore.width <= 1600 && menuRectBefore.y + menuRectBefore.height <= 1000, 'context menu must stay inside the bottom/right viewport bounds');

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
      window.__cableChangeEvents = 0;
      document.addEventListener('rackstudio:change', () => { window.__cableChangeEvents++; }, { once: true });
      window.RackStudio.showCableContextMenu('pixi-regression-cable', 400, 300);
    });
    await page.locator('#ctx-change-color').click();
    assert.equal(await page.evaluate(() => window.__cableChangeEvents), 1, 'context-menu color cycling must notify persistence');

    await page.evaluate(() => window.RackStudio.showCableContextMenu('pixi-regression-cable', 400, 300));
    await page.locator('.context-color-swatch[data-color="#10b981"]').hover();
    assert.equal(await page.evaluate(() => window.RackStudio.getPixiCableInteractionState().previewColorByCable['pixi-regression-cable']), 0x10b981);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.RackStudio.getPixiCableInteractionState().previewColorByCable['pixi-regression-cable']), null, 'closing the menu must roll back a transient color preview');

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

    await page.evaluate(() => {
      const original = window.RackStudio.updatePixiResolutionForZoom;
      window.__pixiResolutionRefreshCalls = 0;
      window.RackStudio.updatePixiResolutionForZoom = scale => {
        window.__pixiResolutionRefreshCalls++;
        return original(scale);
      };
      document.getElementById('viewport-canvas').dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -120,
        clientX: 500,
        clientY: 500
      }));
    });
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate(() => window.__pixiResolutionRefreshCalls > 0), 'settled zoom must refresh the adaptive Pixi resolution');
    const zoomAlignment = await page.evaluate(() => {
      const RS = window.RackStudio;
      const ref = window.__pixiTestEndpoint;
      const port = document.getElementById(`port-${ref.instanceId}-${ref.portId}`);
      const portRect = port.getBoundingClientRect();
      const canvas = document.getElementById('cables-pixi-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      const viewportRect = document.getElementById('viewport-canvas').getBoundingClientRect();
      const x = portRect.left + portRect.width / 2;
      const y = portRect.top + portRect.height / 2;
      return {
        hit: RS.hitTestPixiCable(x, y),
        transform: canvas.style.transform,
        canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
        viewportRect: { left: viewportRect.left, top: viewportRect.top, width: viewportRect.width, height: viewportRect.height }
      };
    });
    assert.equal(zoomAlignment.hit, 'pixi-regression-cable', 'cable endpoint picking must stay aligned with its DOM port after zoom');
    assert.equal(zoomAlignment.transform, 'none', 'viewport Pixi canvas must not retain a second CSS camera transform');
    assert.ok(Math.abs(zoomAlignment.canvasRect.left - zoomAlignment.viewportRect.left) <= 1);
    assert.ok(Math.abs(zoomAlignment.canvasRect.top - zoomAlignment.viewportRect.top) <= 1);
    assert.ok(Math.abs(zoomAlignment.canvasRect.width - zoomAlignment.viewportRect.width) <= 1);
    assert.ok(Math.abs(zoomAlignment.canvasRect.height - zoomAlignment.viewportRect.height) <= 1);

    const collapseSamples = await page.evaluate(async () => {
      const RS = window.RackStudio;
      const ref = window.__pixiTestEndpoint;
      window.setLeftSidebarCollapsed(true);
      const samples = [];
      for (let i = 0; i < 18; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const port = document.getElementById(`port-${ref.instanceId}-${ref.portId}`);
        const rect = port.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        samples.push(RS.hitTestPixiCable(x, y));
      }
      return samples;
    });
    assert.ok(collapseSamples.every(id => id === 'pixi-regression-cable'), 'sidebar transition must keep cable hit geometry aligned on every sampled frame');

    await page.setViewportSize({ width: 1420, height: 880 });
    await page.waitForTimeout(100);
    const resizeState = await page.evaluate(() => {
      const RS = window.RackStudio;
      const ref = window.__pixiTestEndpoint;
      const portRect = document.getElementById(`port-${ref.instanceId}-${ref.portId}`).getBoundingClientRect();
      const viewport = document.getElementById('viewport-canvas');
      const pixi = RS.getPixiCableInteractionState();
      return {
        hit: RS.hitTestPixiCable(portRect.left + portRect.width / 2, portRect.top + portRect.height / 2),
        rendererSize: pixi.rendererSize,
        viewportSize: { width: viewport.clientWidth, height: viewport.clientHeight },
        displayCount: pixi.displayCount
      };
    });
    assert.equal(resizeState.hit, 'pixi-regression-cable', 'browser resize must preserve cable alignment and picking');
    assert.equal(resizeState.rendererSize.width, resizeState.viewportSize.width, 'Pixi width must track the viewport without a delayed stretch');
    assert.equal(resizeState.rendererSize.height, resizeState.viewportSize.height, 'Pixi height must track the viewport without a delayed stretch');
    assert.equal(resizeState.displayCount, 2, 'browser resize must retain cable display objects');

    const multiRackState = await page.evaluate(async () => {
      const RS = window.RackStudio;
      const originalRackId = RS.STATE.racks[0].id;
      RS.addNewRack('Regression Rack 2');
      RS.addNewRack('Regression Rack 3');
      RS.setViewMode('multi');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.getElementById('cables-pixi-canvas');
      return {
        originalRackId,
        extraRackIds: RS.STATE.racks.filter(rack => rack.id !== originalRackId).map(rack => rack.id),
        canvasCount: document.querySelectorAll('#cables-pixi-canvas').length,
        canvasParentId: canvas?.parentElement?.id,
        rackCount: document.querySelectorAll('.multi-rack-stage .rack-container').length,
        headers: Array.from(document.querySelectorAll('.multi-rack-stage .rack-header-plate')).map(header => {
          const headerRect = header.getBoundingClientRect();
          const buttons = Array.from(header.querySelectorAll('.rack-action-btn'));
          return {
            buttonCount: buttons.length,
            allVisible: buttons.every(button => {
              const rect = button.getBoundingClientRect();
              const style = getComputedStyle(button);
              return style.display !== 'none' && rect.width > 0 && rect.left >= headerRect.left && rect.right <= headerRect.right + 1;
            })
          };
        })
      };
    });
    assert.equal(multiRackState.canvasCount, 1, 'multi-rack render must keep exactly one Pixi canvas');
    assert.equal(multiRackState.canvasParentId, 'viewport-canvas', 'persistent Pixi canvas must remain owned by the viewport');
    assert.equal(multiRackState.rackCount, 3);
    assert.ok(multiRackState.headers.every(header => header.buttonCount === 6 && header.allVisible), 'all multi-rack header actions must remain visible inside each rack');

    const deleteRegression = await page.evaluate(async ({ originalRackId, extraRackIds }) => {
      const RS = window.RackStudio;
      const canvasBefore = document.getElementById('cables-pixi-canvas');
      window.confirm = () => true;
      RS.deleteRack(extraRackIds[0]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const afterMultiDelete = {
        rackCount: RS.STATE.racks.length,
        viewMode: RS.STATE.viewMode,
        sameCanvas: document.getElementById('cables-pixi-canvas') === canvasBefore,
        canvasCount: document.querySelectorAll('#cables-pixi-canvas').length,
        canvasParentId: document.getElementById('cables-pixi-canvas')?.parentElement?.id
      };
      RS.deleteRack(extraRackIds[1]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const ref = window.__pixiTestEndpoint;
      const portRect = document.getElementById(`port-${ref.instanceId}-${ref.portId}`).getBoundingClientRect();
      return {
        afterMultiDelete,
        finalRackId: RS.STATE.racks[0].id,
        originalRackId,
        finalRackCount: RS.STATE.racks.length,
        finalViewMode: RS.STATE.viewMode,
        sameCanvas: document.getElementById('cables-pixi-canvas') === canvasBefore,
        canvasCount: document.querySelectorAll('#cables-pixi-canvas').length,
        canvasParentId: document.getElementById('cables-pixi-canvas')?.parentElement?.id,
        hit: RS.hitTestPixiCable(portRect.left + portRect.width / 2, portRect.top + portRect.height / 2),
        cloneVisible: document.querySelector('.rack-header-plate .rack-hdr-duplicate')?.getBoundingClientRect().width > 0,
        telemetryVisible: document.querySelector('.rack-header-telemetry-group')?.getBoundingClientRect().width > 0
      };
    }, multiRackState);
    assert.deepEqual(deleteRegression.afterMultiDelete, {
      rackCount: 2,
      viewMode: 'multi',
      sameCanvas: true,
      canvasCount: 1,
      canvasParentId: 'viewport-canvas'
    });
    assert.equal(deleteRegression.finalRackId, deleteRegression.originalRackId);
    assert.equal(deleteRegression.finalRackCount, 1);
    assert.equal(deleteRegression.finalViewMode, 'single');
    assert.equal(deleteRegression.sameCanvas, true, 'multi-to-single deletion must preserve the GPU canvas instance');
    assert.equal(deleteRegression.canvasCount, 1);
    assert.equal(deleteRegression.canvasParentId, 'viewport-canvas');
    assert.equal(deleteRegression.hit, 'pixi-regression-cable', 'remaining rack cables must stay aligned after rack deletion');
    assert.equal(deleteRegression.cloneVisible, true, 'single-rack clone control must remain visible');
    assert.equal(deleteRegression.telemetryVisible, true, 'single-rack telemetry must remain visible');

    const disconnectState = await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.disconnectCable('pixi-regression-cable-2');
      return {
        stateHasCable: RS.STATE.cables.some(cable => cable.id === 'pixi-regression-cable-2'),
        displayCount: RS.getPixiCableInteractionState().displayCount,
        spatialCellCount: RS.getPixiCableInteractionState().spatialCellCount
      };
    });
    assert.equal(disconnectState.stateHasCable, false, 'disconnect must remove the cable from state immediately');
    assert.equal(disconnectState.displayCount, 1, 'disconnect must remove the retained Pixi display immediately');

    const bulkDisconnectState = await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.clearDeviceCables(window.__pixiTestEndpoint.instanceId);
      return {
        cableCount: RS.STATE.cables.length,
        displayCount: RS.getPixiCableInteractionState().displayCount,
        spatialCellCount: RS.getPixiCableInteractionState().spatialCellCount
      };
    });
    assert.equal(bulkDisconnectState.cableCount, 0, 'device cable clear must remove all matching state entries immediately');
    assert.equal(bulkDisconnectState.displayCount, 0, 'device cable clear must empty retained Pixi displays immediately');
    assert.equal(bulkDisconnectState.spatialCellCount, 0, 'device cable clear must empty the Pixi spatial index immediately');

    // Test: Port role badge color preservation on switch & patch panel when connected vs disconnected
    const portRoleState = await page.evaluate(() => {
      const RS = window.RackStudio;
      const rack = RS.getActiveRack();
      const swDev = rack.devices.find(d => d.catalogKey === 'cisco-2960x-24ps');
      const patchDev = rack.devices.find(d => d.catalogKey === 'patch-cat6-24');
      if (!swDev.portsConfig) swDev.portsConfig = {};
      // Configure port p1 with role: 'routed' (Red 'R')
      swDev.portsConfig['p1'] = { role: 'routed', color: '#b91c1c' };
      RS.renderMountedDevices();

      const swPort1 = document.querySelector(`.port[data-instance-id="${swDev.instanceId}"][data-port-id="p1"]`);
      const swPort1Before = {
        hasSpecial: swPort1.classList.contains('port-special'),
        hasRouted: swPort1.classList.contains('port-routed'),
        hasConnected: swPort1.classList.contains('connected'),
        borderColor: getComputedStyle(swPort1).borderColor,
        beforeBg: getComputedStyle(swPort1, '::before').backgroundColor,
        beforeContent: getComputedStyle(swPort1, '::before').content
      };

      // Connect cable to port p1 -> pt1
      RS.STATE.cables.push({
        id: 'cable-role-test',
        from: { rackId: rack.id, instanceId: swDev.instanceId, portId: 'p1' },
        to: { rackId: rack.id, instanceId: patchDev.instanceId, portId: 'pt1' },
        color: '#b91c1c',
        role: 'routed'
      });
      RS.renderMountedDevices();
      RS.renderAllCables();

      const swPort1Connected = document.querySelector(`.port[data-instance-id="${swDev.instanceId}"][data-port-id="p1"]`);
      const swPort1After = {
        hasSpecial: swPort1Connected.classList.contains('port-special'),
        hasRouted: swPort1Connected.classList.contains('port-routed'),
        hasConnected: swPort1Connected.classList.contains('connected'),
        borderColor: getComputedStyle(swPort1Connected).borderColor,
        beforeBg: getComputedStyle(swPort1Connected, '::before').backgroundColor,
        beforeContent: getComputedStyle(swPort1Connected, '::before').content
      };

      // Also check standard unconfigured port (port p2 -> pt2) when connected gets green link LED
      RS.STATE.cables.push({
        id: 'cable-std-test',
        from: { rackId: rack.id, instanceId: swDev.instanceId, portId: 'p2' },
        to: { rackId: rack.id, instanceId: patchDev.instanceId, portId: 'pt2' },
        color: '#0070d2'
      });
      RS.renderMountedDevices();
      RS.renderAllCables();

      const swPort2Connected = document.querySelector(`.port[data-instance-id="${swDev.instanceId}"][data-port-id="p2"]`);
      const swPort2After = {
        hasSpecial: swPort2Connected.classList.contains('port-special'),
        hasConnected: swPort2Connected.classList.contains('connected'),
        beforeBg: getComputedStyle(swPort2Connected, '::before').backgroundColor
      };

      return { swPort1Before, swPort1After, swPort2After };
    });

    // Routed port 1 must keep its red 'R' badge and red border when connected (NOT green)
    assert.ok(portRoleState.swPort1Before.hasSpecial, 'routed port must have port-special class');
    assert.equal(portRoleState.swPort1Before.beforeBg, 'rgb(185, 28, 28)', 'routed port ::before must be red before connect');
    assert.ok(portRoleState.swPort1Before.beforeContent.includes('R'), 'routed port ::before content must be R before connect');

    assert.ok(portRoleState.swPort1After.hasConnected, 'routed port must have connected class');
    assert.equal(portRoleState.swPort1After.beforeBg, 'rgb(185, 28, 28)', 'routed port ::before must RETAIN red background when connected (not turn green)');
    assert.ok(portRoleState.swPort1After.beforeContent.includes('R'), 'routed port ::before content must RETAIN R badge when connected');
    assert.equal(portRoleState.swPort1After.borderColor, 'rgb(185, 28, 28)', 'routed port border must remain red');

    // Standard unconfigured port 2 must show green link LED when connected
    assert.equal(portRoleState.swPort2After.hasSpecial, false, 'unconfigured port must not have port-special class');
    assert.equal(portRoleState.swPort2After.hasConnected, true, 'unconfigured port must have connected class');
    assert.equal(portRoleState.swPort2After.beforeBg, 'rgb(34, 197, 94)', 'unconfigured port ::before must be green LED when connected');

    // Test: Incremental Pixi dispatch via RS.appendSingleCable
    const incrementalPixiState = await page.evaluate(async () => {
      const RS = window.RackStudio;
      RS.setCableRenderMode('pixi');
      await new Promise(resolve => setTimeout(resolve, 50));
      const countBefore = RS.getPixiCableInteractionState().displayCount;

      const rack = RS.getActiveRack();
      const swDev = rack.devices.find(d => d.catalogKey === 'cisco-2960x-24ps');
      const patchDev = rack.devices.find(d => d.catalogKey === 'patch-cat6-24');
      const newCable = {
        id: 'cable-incremental-pixi',
        from: { rackId: rack.id, instanceId: swDev.instanceId, portId: 'p3' },
        to: { rackId: rack.id, instanceId: patchDev.instanceId, portId: 'pt3' },
        color: '#7c3aed'
      };
      RS.STATE.cables.push(newCable);
      RS.appendSingleCable(newCable);
      const countAfter = RS.getPixiCableInteractionState().displayCount;

      return { countBefore, countAfter };
    });
    assert.equal(incrementalPixiState.countAfter, incrementalPixiState.countBefore + 1, 'RS.appendSingleCable in Pixi mode must incrementally update displayCount immediately');

    const resolutionProfile = await page.evaluate(() => {
      const RS = window.RackStudio;
      RS.setPixiPerformanceMode('balanced');
      const settled = RS.getPixiPerformanceTelemetry();
      RS.setPixiInteractionMode(true);
      const interacting = RS.getPixiPerformanceTelemetry();
      RS.setPixiInteractionMode(false);
      const restored = RS.getPixiPerformanceTelemetry();
      return { settled, interacting, restored };
    });
    assert.ok(resolutionProfile.interacting.resolution <= resolutionProfile.settled.resolution, 'interaction mode must not increase Pixi resolution');
    assert.equal(resolutionProfile.restored.profile, 'balanced');
    assert.ok(resolutionProfile.restored.framebufferPixels <= resolutionProfile.restored.pixelBudget, 'restored framebuffer must remain inside its pixel budget');

    await page.waitForTimeout(1100);
    const idleStart = await page.evaluate(() => window.RackStudio.getPixiPerformanceTelemetry());
    await page.waitForTimeout(250);
    const idleEnd = await page.evaluate(() => window.RackStudio.getPixiPerformanceTelemetry());
    assert.equal(idleEnd.totalRenders, idleStart.totalRenders, 'a static Pixi scene must not continuously render');
    assert.equal(idleEnd.rendersPerSecond, 0, 'static Pixi scene must report zero renders per second');
    assert.equal(idleEnd.staticIdle, true, 'telemetry must identify a settled static scene');

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
