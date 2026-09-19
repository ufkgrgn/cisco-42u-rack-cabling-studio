const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});
server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.RackStudio);
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const RS = window.RackStudio;
    const r = RS.getActiveRack();
    r.devices = [];
    RS.STATE.cables = [];

    // Mount devices like in user screenshot:
    // U37: CISCO C2960 (24 port)
    // U35: CISCO C2960XR
    // U33: 24 Port Cat6A Patch Panel
    // U31: CISCO C2960X (24 port)
    // U29: 24 Port Cat6A Patch Panel
    // U27: 24 Port Cat6A Patch Panel
    RS.mountDeviceAt('cisco-2960-24pc', 37);
    RS.mountDeviceAt('cisco-2960xr-24ps', 35);
    RS.mountDeviceAt('patch-cat6-24', 33);
    RS.mountDeviceAt('cisco-2960x-24ps', 31);
    RS.mountDeviceAt('patch-cat6-24', 29);
    RS.mountDeviceAt('patch-cat6-24', 27);

    RS.renderMountedDevices();
  });
  await page.waitForTimeout(400);

  // Trigger autofill on U31 switch (cisco-2960x-24ps)
  await page.evaluate(async () => {
    const RS = window.RackStudio;
    const r = RS.getActiveRack();
    const sw = r.devices.find(d => d.topU === 31);
    const patch = r.devices.find(d => d.topU === 29);
    
    // Connect all 24 ports sequentially
    const catSw = RS.HARDWARE_CATALOG[sw.catalogKey];
    const catPatch = RS.HARDWARE_CATALOG[patch.catalogKey];

    for (let i = 0; i < 24; i++) {
      RS.STATE.cables.push({
        id: 'cable-test-' + (i + 1),
        from: { rackId: r.id, instanceId: sw.instanceId, portId: catSw.ports[i].id },
        to: { rackId: r.id, instanceId: patch.instanceId, portId: catPatch.ports[i].id },
        color: '#0070d2',
        lengthMeters: 0.5
      });
    }

    RS.setCableRenderMode('svg');
    RS.renderAllCables();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/reproduce_svg.png' });

  // Switch to Pixi
  await page.evaluate(() => {
    window.RackStudio.setCableRenderMode('pixi');
    window.RackStudio.renderAllCables();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/reproduce_pixi.png' });

  await browser.close();
  server.close();
});
