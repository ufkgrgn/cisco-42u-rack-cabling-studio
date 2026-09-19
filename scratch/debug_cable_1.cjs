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

  const debugInfo = await page.evaluate(() => {
    const RS = window.RackStudio;
    const r = RS.getActiveRack();
    r.devices = [];
    RS.STATE.cables = [];

    RS.mountDeviceAt('cisco-2960x-24ps', 31);
    RS.mountDeviceAt('patch-cat6-24', 29);
    RS.renderMountedDevices();

    const sw = r.devices.find(d => d.topU === 31);
    const patch = r.devices.find(d => d.topU === 29);
    const catSw = RS.HARDWARE_CATALOG[sw.catalogKey];
    const catPatch = RS.HARDWARE_CATALOG[patch.catalogKey];

    RS.STATE.cables.push({
      id: 'cable-1',
      from: { rackId: r.id, instanceId: sw.instanceId, portId: catSw.ports[0].id },
      to: { rackId: r.id, instanceId: patch.instanceId, portId: catPatch.ports[0].id },
      color: '#0070d2',
      lengthMeters: 0.5
    });

    RS.setCableRenderMode('svg');
    RS.renderAllCables();
    const svgD = document.getElementById('svg-cable-cable-1')?.getAttribute('d');
    const svgBootA = document.getElementById('svg-cable-boot-a-cable-1');

    // Switch to Pixi
    RS.setCableRenderMode('pixi');
    RS.renderAllCables();

    // Check what is in cables-pixi-renderer
    // Let's hook into parseSvgPathD or read cablesContainer
    const canvas = document.getElementById('cables-pixi-canvas');
    return {
      canvasRect: canvas.getBoundingClientRect(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      styleDisplay: canvas.style.display,
      styleZIndex: canvas.style.zIndex
    };

    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();

    const canvas = document.getElementById('cables-pixi-canvas');
    const cRect = canvas.getBoundingClientRect();

    const curScale = RS.ZOOM_STATE.scale;
    const borderOffset = 8 * curScale;
    const rackCont = document.getElementById('rack-container');
    const rackRect = rackCont.getBoundingClientRect();

    const pixiP1 = {
      x: (r1.left + r1.width / 2 - (rackRect.left + borderOffset)) / curScale,
      y: (r1.top + r1.height / 2 - (rackRect.top + borderOffset)) / curScale
    };
    const pixiP2 = {
      x: (r2.left + r2.width / 2 - (rackRect.left + borderOffset)) / curScale,
      y: (r2.top + r2.height / 2 - (rackRect.top + borderOffset)) / curScale
    };

    return {
      svgD,
      svgBoot: svgBootA ? { cx: svgBootA.getAttribute('cx'), cy: svgBootA.getAttribute('cy') } : null,
      pixiP1,
      pixiP2
    };
  });
  console.log('DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
  await browser.close();
  server.close();
});
