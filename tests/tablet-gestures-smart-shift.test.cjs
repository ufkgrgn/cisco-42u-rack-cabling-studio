const {test} = require('node:test');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Tablet gestures, ear handles, smart ripple push, multi-select and U-space actions', async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1400, height: 950}, hasTouch: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForSelector('.studio-editor[data-ready="true"]');

    // 1. Setup clean rack with two devices
    await page.evaluate(() => {
      localStorage.removeItem('rack-studio-project-v2');
      window.RackStudio.loadCustomTopology({
        racks: [{id: 'rack-1', name: 'GestureRack', heightU: 42, devices: []}],
        cables: []
      });
      const keys = Object.keys(window.RackStudio.catalog).filter(k => window.RackStudio.catalog[k].u === 1);
      window.RackStudio.mountDeviceAt(keys[0], 25);
      window.RackStudio.mountDeviceAt(keys[1] || keys[0], 24);
      window.RackStudio.refresh();
    });

    // 2. Ear Handles exist
    const earCount = await page.locator('.device-ear-handle[data-drag-handle="true"]').count();
    assert.ok(earCount >= 4, 'Must have at least 2 ear handles (left & right) per device');

    // 3. Smart Ripple Push test
    // Devices currently at U25 and U24. Mount a new device or move a device to U25.
    // Moving a device to U25 should ripple the device at U25 to U24, and U24 to U23!
    const rippleResult = await page.evaluate(() => {
      const rack = window.RackStudio.getActiveRack();
      const keys = Object.keys(window.RackStudio.catalog).filter(k => window.RackStudio.catalog[k].u === 1);
      // Mount a third device at U30
      const dev3 = window.RackStudio.mountDeviceAt(keys[0], 30);
      window.RackStudio.refresh();
      // Click dev3 to select it in the editor
      const el = document.getElementById(dev3.instanceId);
      if (el) el.click();
      // Use editor move
      const editorPos = document.getElementById('studio-position');
      const editorTarget = document.getElementById('studio-target');
      editorPos.value = '25';
      editorTarget.value = rack.id;
      // Trigger move command
      document.querySelector('[data-command="move"]').click();
      return window.RackStudio.getActiveRack().devices.map(d => ({id: d.instanceId, topU: d.topU}));
    });

    // One device must be at 25, one at 24, one at 23
    const tops = rippleResult.map(d => d.topU).sort((a, b) => b - a);
    assert.deepEqual(tops, [25, 24, 23], 'Smart ripple push must shift colliding devices downwards into 24 and 23');

    // 4. Excel-Style Insert U-Space test
    const insertSuccess = await page.evaluate(() => {
      return window.RackStudio.insertUSpace('rack-1', 25, 1);
    });
    assert.equal(insertSuccess, true, 'insertUSpace at U25 must succeed');
    const topsAfterInsert = await page.evaluate(() => {
      return window.RackStudio.getActiveRack().devices.map(d => d.topU).sort((a, b) => b - a);
    });
    // Devices at 25, 24, 23 were at or below 25, so they shifted down to 24, 23, 22!
    assert.deepEqual(topsAfterInsert, [24, 23, 22], 'insertUSpace at U25 must shift devices down by 1U opening U25');

    // 5. Excel-Style Collapse U-Space test
    // U25 is now empty, collapse it:
    const collapseSuccess = await page.evaluate(() => {
      return window.RackStudio.collapseUSpace('rack-1', 25, 1);
    });
    assert.equal(collapseSuccess, true, 'collapseUSpace at U25 must succeed');
    const topsAfterCollapse = await page.evaluate(() => {
      return window.RackStudio.getActiveRack().devices.map(d => d.topU).sort((a, b) => b - a);
    });
    assert.deepEqual(topsAfterCollapse, [25, 24, 23], 'collapseUSpace at U25 must pull devices back up to 25, 24, 23');

    // 6. Multi-Select & Block Move test
    await page.evaluate(() => {
      const rack = window.RackStudio.getActiveRack();
      window.RackStudio.clearMultiSelect();
      rack.devices.forEach(d => window.RackStudio.toggleMultiSelect(d.instanceId));
    });

    const pillVisible = await page.locator('#studio-multiselect-pill:not(.hidden)').isVisible();
    assert.equal(pillVisible, true, 'Multi-select pill must be visible when multiple devices are selected');
    const pillText = await page.locator('#studio-multiselect-pill .pill-count').textContent();
    assert.ok(pillText.includes('3'), 'Pill text must report 3 devices selected');

    // Click +1U on pill
    await page.locator('#studio-multiselect-pill [data-multi-action="up"]').click();
    const topsAfterBlockUp = await page.evaluate(() => {
      return window.RackStudio.getActiveRack().devices.map(d => d.topU).sort((a, b) => b - a);
    });
    assert.deepEqual(topsAfterBlockUp, [26, 25, 24], 'Multi-select block move +1U must shift all 3 devices together');

    // Click -1U on pill
    await page.locator('#studio-multiselect-pill [data-multi-action="down"]').click();
    const topsAfterBlockDown = await page.evaluate(() => {
      return window.RackStudio.getActiveRack().devices.map(d => d.topU).sort((a, b) => b - a);
    });
    assert.deepEqual(topsAfterBlockDown, [25, 24, 23], 'Multi-select block move -1U must shift all 3 devices back');

    // 7. U-Rail Action Menu Popover
    await page.locator('.u-label[data-u="20"]').first().click();
    const menuVisible = await page.locator('#rack-u-action-menu').isVisible();
    assert.equal(menuVisible, true, 'Clicking U-label must open #rack-u-action-menu popover');

    // Click on canvas closes popover
    await page.locator('#viewport-canvas').click({position: {x: 200, y: 200}});
    const menuHidden = await page.locator('#rack-u-action-menu').count();
    assert.equal(menuHidden, 0, 'Clicking outside must close #rack-u-action-menu popover');

    // 8. Multi-select Cable Dimming & Pointer Lock
    const multiSelectActive = await page.evaluate(() => {
      window.RackStudio.clearMultiSelect();
      const rack = window.RackStudio.getActiveRack();
      rack.devices.forEach(d => window.RackStudio.toggleMultiSelect(d.instanceId));
      return {
        bodyClass: document.body.classList.contains('multi-select-active'),
        stageClass: document.getElementById('rack-stage').classList.contains('multi-select-active'),
        cablesPointerEvents: window.getComputedStyle(document.getElementById('cables-svg')).pointerEvents
      };
    });
    assert.equal(multiSelectActive.bodyClass, true, 'body must receive multi-select-active class');
    assert.equal(multiSelectActive.stageClass, true, 'rack-stage must receive multi-select-active class');
    assert.equal(multiSelectActive.cablesPointerEvents, 'none', 'cables must have pointer-events: none during multi-select');

    // 9. Lock Pan During Device Dragging (Canvas MUST NOT Pan while dragging devices)
    const panBeforeDrag = await page.evaluate(() => window.RackStudio.ZOOM_STATE.panY);
    const earHandle = page.locator('.mounted-device.studio-multi-selected .device-ear-left').first();
    const handleBox = await earHandle.boundingBox();
    assert.ok(handleBox, 'Must find ear handle bounding box');
    const slotStep = await page.locator('.rack-slot').first().evaluate(el => el.getBoundingClientRect().height);
    // Drag handle 1 step down
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + slotStep, {steps: 5});
    await page.mouse.up();
    const panAfterDrag = await page.evaluate(() => window.RackStudio.ZOOM_STATE.panY);
    assert.equal(panAfterDrag, panBeforeDrag, 'Canvas pan MUST remain locked and unchanged during device drag');

    // 10. Escape Key / Deselect / Clear Multi-Select
    await page.keyboard.press('Escape');
    const multiAfterEsc = await page.evaluate(() => ({
      selectedCount: window.RackStudio.STATE.multiSelectedDevices?.size || 0,
      bodyClass: document.body.classList.contains('multi-select-active')
    }));
    assert.equal(multiAfterEsc.selectedCount, 0, 'Escape key must clear all multi-selected devices');
    assert.equal(multiAfterEsc.bodyClass, false, 'Escape key must remove multi-select-active class');

    // 11. U-Rail Interactive Affordance
    const uLabelInfo = await page.evaluate(() => {
      const label = document.querySelector('.u-label');
      const dot = label?.querySelector('.u-dot');
      const style = label ? window.getComputedStyle(label) : null;
      return {
        hasDot: !!dot,
        cursor: style?.cursor
      };
    });
    assert.equal(uLabelInfo.hasDot, true, 'U-label must have visual action dot affordance');
    assert.equal(uLabelInfo.cursor, 'pointer', 'U-label must have pointer cursor');

    // 12. Safe 1-Finger Pan over Rack Canvas (when not dragging devices)
    const initialPanY = await page.evaluate(() => window.RackStudio.ZOOM_STATE.panY);
    await page.evaluate(() => {
      const c = document.getElementById('viewport-canvas');
      const t1 = new Touch({ identifier: 0, target: c, clientX: 300, clientY: 300 });
      const t2 = new Touch({ identifier: 0, target: c, clientX: 300, clientY: 380 });
      c.dispatchEvent(new TouchEvent('touchstart', { touches: [t1], bubbles: true, cancelable: true }));
      c.dispatchEvent(new TouchEvent('touchmove', { touches: [t2], bubbles: true, cancelable: true }));
      c.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true, cancelable: true }));
    });
    const afterPanY = await page.evaluate(() => window.RackStudio.ZOOM_STATE.panY);
    assert.notEqual(initialPanY, afterPanY, '1-finger touch drag on empty canvas must smoothly update viewport pan');

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
