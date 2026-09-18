const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  
  const result = await page.evaluate(() => {
    const RS = window.RackStudio;
    RS.loadCustomTopology({ racks: [{ id: 'rack-1', name: 'MDF', heightU: 42, devices: [] }], cables: [] });
    const n = RS.mountDeviceAt('cisco-nexus-93180yc', 25, 'rack-1');
    const c = RS.mountDeviceAt('cisco-9500-24y4c', 20, 'rack-1');
    RS.refresh();

    const devA = RS.getActiveRack().devices.find(d => d.instanceId === n.instanceId);
    const devB = RS.getActiveRack().devices.find(d => d.instanceId === c.instanceId);

    return { devA, devB };
  });

  console.log('Result in browser:', JSON.stringify(result, null, 2));

  // Now click portA and portB
  const portA = page.locator(`.port[data-instance-id="${result.devA.instanceId}"][data-port-id="eth1_1"]`);
  await portA.click();
  const portB = page.locator(`.port[data-instance-id="${result.devB.instanceId}"][data-port-id="p1"]`);
  await portB.click();

  await page.waitForSelector('.uplink-modal-backdrop');
  console.log('Modal appeared successfully!');

  await page.locator('#btn-uplink-approve').click();
  await page.waitForSelector('.uplink-modal-backdrop', { state: 'detached' });

  const cables = await page.evaluate(() => window.RackStudio.STATE.cables);
  console.log('Cables in state:', JSON.stringify(cables, null, 2));

  await browser.close();
})();
