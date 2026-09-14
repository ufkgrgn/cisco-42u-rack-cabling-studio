// Run: node tests/studio.test.cjs (PLAYWRIGHT_MODULE may point to an installed playwright package).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.RackStudio);
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      const original = JSON.parse(JSON.stringify({ racks: api.STATE.racks, cables: api.STATE.cables, activeRackId: api.STATE.activeRackId, customCatalog: api.STATE.customCatalog || {} }));
      const rack = api.getActiveRack();
      const initialDevices = rack.devices.length;
      api.loadCustomTopology({ racks: [{id:'test-rack',name:'Test',heightU:48,devices:[],units:[]}], cables:[], activeRackId:'test-rack' });
      api.refresh();
      const rails = document.querySelectorAll('.rack-slot').length;
      const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
      api.mountDeviceAt(key,48);
      const mounted = api.getActiveRack().devices.length;
      try { api.mountDeviceAt(key,48); } catch {}
      const afterOverlap = api.getActiveRack().devices.length;
      try { api.mountDeviceAt(key,49); } catch {}
      const afterBounds = api.getActiveRack().devices.length;
      const beforeBad = JSON.stringify(api.STATE.racks);
      let invalidRejected = false;
      try { api.loadCustomTopology({ racks:[{id:'bad',heightU:2,devices:[{instanceId:'x',catalogKey:key,topU:9,uHeight:1}]}],cables:[] }); } catch { invalidRejected = true; }
      const unchanged = beforeBad === JSON.stringify(api.STATE.racks);
      api.loadCustomTopology(original);
      api.refresh();
      return {initialDevices, rails,mounted,afterOverlap,afterBounds,invalidRejected,unchanged};
    });
    assert.ok(result.initialDevices > 0, 'preset loads');
    assert.equal(result.rails, 48, 'variable rack rails');
    assert.equal(result.mounted, 1);
    assert.equal(result.afterOverlap, 1, 'overlap rejected');
    assert.equal(result.afterBounds, 1, 'out of bounds rejected');
    assert.ok(result.invalidRejected && result.unchanged, 'invalid import is atomic');
    await page.evaluate(() => {
      const api = window.RackStudio;
      const catalogKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
      const ports = api.catalog[catalogKey].ports;
      const racks = ['a','b'].map(id => ({id,name:'Rack -- <test> '+id,heightU:60,devices:[{instanceId:'dev-'+id,catalogKey,topU:60,uHeight:1}]}));
      const cables = ['a','b'].map(id => ({id:'cable-'+id,from:{rackId:id,instanceId:'dev-'+id,portId:ports[0].id},to:{rackId:id,instanceId:'dev-'+id,portId:ports[1].id},color:'#2563eb',lengthMeters:1}));
      api.loadCustomTopology({racks,cables,activeRackId:'b'});
      api.fit();
      const before = JSON.stringify(api.STATE.racks);
      try { api.loadCustomTopology({racks,cables:[...cables,{...cables[0],id:'duplicate-port'}]}); throw new Error('Accepted occupied port'); }
      catch (error) { if (error.message === 'Accepted occupied port') throw error; }
      if (before !== JSON.stringify(api.STATE.racks)) throw new Error('Bad cable import mutated project');
    });
    const downloadWait = page.waitForEvent('download');
    await page.locator('#btn-export-visio').click();
    const download = await downloadWait;
    const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const svg = Buffer.concat(chunks).toString('utf8');
    assert.ok(svg.includes('cable-b (1m)'), 'SVG uses active cable identity');
    const validSvg = await page.evaluate(svg => !new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror'), svg);
    assert.ok(validSvg, 'SVG is valid XML with user punctuation');
    assert.ok(svg.includes('height="2000"'), '60U export height');
    await page.waitForTimeout(700);
    await page.screenshot({path:path.join(root,'tests','studio.png'),fullPage:true});
    assert.deepEqual(errors, [], 'no browser exceptions');
    console.log(JSON.stringify({passed:true,core:result},null,2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });
