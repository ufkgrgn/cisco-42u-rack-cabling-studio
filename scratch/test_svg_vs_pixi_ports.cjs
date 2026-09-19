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

  const res = await page.evaluate(() => {
    const RS = window.RackStudio;
    const cat = RS.HARDWARE_CATALOG;
    const swCatKey = Object.keys(cat).find(k => k.includes('2960x') || k.includes('2960'));
    const patchCatKey = Object.keys(cat).find(k => k.includes('patch') && cat[k].ports?.length === 24);

    // Clear devices and cables
    const r = RS.getActiveRack();
    r.devices = [];
    RS.STATE.cables = [];

    // Mount switch at 31 and patch at 29
    RS.mountDeviceAt(swCatKey, 31);
    RS.mountDeviceAt(patchCatKey, 29);

    const devSw = r.devices.find(d => d.topU === 31);
    const devPatch = r.devices.find(d => d.topU === 29);

    // Add cable between port 1 of switch and port 1 of patch
    const swPortId = cat[swCatKey].ports[0].id;
    const patchPortId = cat[patchCatKey].ports[0].id;

    RS.addDirectCable(r.id, devSw.instanceId, swPortId, r.id, devPatch.instanceId, patchPortId, '#2563eb', 1.0);

    // SVG render
    RS.setCableRenderMode('svg');
    const svgPath = document.getElementById('svg-cable-' + RS.STATE.cables[0].id)?.getAttribute('d');
    const svgBootA = document.getElementById('svg-cable-boot-a-' + RS.STATE.cables[0].id);
    const svgBootCoords = {
      cx: svgBootA?.getAttribute('cx'),
      cy: svgBootA?.getAttribute('cy')
    };

    // Pixi render
    RS.setCableRenderMode('pixi');
    
    // Check port elements in DOM
    const elSw = document.getElementById(`port-${devSw.instanceId}-${swPortId}`);
    const elPatch = document.getElementById(`port-${devPatch.instanceId}-${patchPortId}`);

    const rectSw = elSw?.getBoundingClientRect();
    const rectPatch = elPatch?.getBoundingClientRect();

    const canvas = document.getElementById('cables-pixi-canvas');
    const canvasRect = canvas?.getBoundingClientRect();

    return {
      swCatKey,
      patchCatKey,
      swPortId,
      patchPortId,
      svgPath,
      svgBootCoords,
      rectSw: rectSw ? { top: rectSw.top, left: rectSw.left } : null,
      rectPatch: rectPatch ? { top: rectPatch.top, left: rectPatch.left } : null,
      canvasRect: canvasRect ? { top: canvasRect.top, left: canvasRect.left } : null,
      curScale: RS.ZOOM_STATE.scale
    };
  });
  console.log('TEST RESULT:', JSON.stringify(res, null, 2));

  // Take screenshot in SVG mode
  await page.evaluate(() => window.RackStudio.setCableRenderMode('svg'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/single_rack_svg.png' });

  // Take screenshot in Pixi mode
  await page.evaluate(() => window.RackStudio.setCableRenderMode('pixi'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/single_rack_pixi.png' });

  await browser.close();
  server.close();
});
