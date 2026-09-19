const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Track document clicks and highlights
  await page.exposeFunction('logClick', (msg) => console.log('[PAGE LOG]', msg));

  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/'));
  await page.waitForFunction(() => window.RackStudio && window.RackStudio.renderAllCables);

  // Setup test environment exactly as in pixi-cabling-interaction.test.cjs
  await page.evaluate(() => {
    window.RackStudio.STATE.cableRenderMode = 'pixi';
    const rack = window.RackStudio.getActiveRack();
    rack.devices = [
      { id: 'sw1', model: 'cisco-c2960x-24ps-l', u: 10, name: 'Core Switch 1', slot: 10 },
      { id: 'sw2', model: 'cisco-c2960x-24ps-l', u: 20, name: 'Distribution Switch 2', slot: 20 }
    ];
    window.RackStudio.renderMountedDevices();
    window.RackStudio.STATE.cables = [
      {
        id: 'pixi-regression-cable',
        name: 'Gi1/0/1 -> Gi1/0/1',
        color: '#0070d2',
        from: { instanceId: 'sw1', portId: '1' },
        to: { instanceId: 'sw2', portId: '1' }
      },
      {
        id: 'pixi-regression-cable-2',
        name: 'Gi1/0/2 -> Gi1/0/2',
        color: '#10b981',
        from: { instanceId: 'sw1', portId: '2' },
        to: { instanceId: 'sw2', portId: '2' }
      }
    ];
    window.RackStudio.renderAllCables();
    window.RackStudio.renderScheduleTable();

    window.__pixiTestEndpoint = { instanceId: 'sw1', portId: '1' };

    document.addEventListener('click', (e) => {
      window.logClick(`Document click target: <${e.target.tagName} class="${e.target.className}" id="${e.target.id}">, highlightedCableId was: ${window.RackStudio.STATE.highlightedCableId}`);
    }, true);
  });

  await page.waitForTimeout(300);

  // Run steps up to 174
  await page.locator('.sort-tab-btn[data-sort="tree"]').click();
  const treeRow = page.locator('.tree-cable-row[data-cable-id="pixi-regression-cable-2"]');
  await treeRow.scrollIntoViewIfNeeded();
  const treeRowBox = await treeRow.boundingBox();
  await page.mouse.move(treeRowBox.x + treeRowBox.width / 2, treeRowBox.y + treeRowBox.height / 2);
  await page.waitForTimeout(50);

  console.log('Now waiting 500ms...');
  await page.waitForTimeout(500);

  const focusedEndpoint = await page.evaluate(() => {
    const ref = window.__pixiTestEndpoint;
    const rect = document.getElementById(`port-${ref.instanceId}-${ref.portId}`).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  console.log('focusedEndpoint:', focusedEndpoint);

  await page.mouse.move(focusedEndpoint.x, focusedEndpoint.y);
  await page.waitForTimeout(100);

  const beforeClick = await page.evaluate(({ x, y }) => ({
    pointerEvents: document.getElementById('cables-pixi-canvas')?.style.pointerEvents,
    hitCable: window.RackStudio.hitTestPixiCable ? window.RackStudio.hitTestPixiCable(x, y) : null,
    highlighted: window.RackStudio.STATE.highlightedCableId
  }), focusedEndpoint);
  console.log('Before click:', beforeClick);

  await page.mouse.click(focusedEndpoint.x, focusedEndpoint.y);
  await page.waitForTimeout(50);

  const afterClick = await page.evaluate(() => ({
    selected: window.RackStudio.STATE.highlightedCableId,
    hudVisible: !!document.getElementById('cable-quick-hud')
  }));
  console.log('After click:', afterClick);

  await browser.close();
})();
