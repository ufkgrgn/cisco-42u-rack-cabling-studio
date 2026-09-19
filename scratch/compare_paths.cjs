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

  const comp = await page.evaluate(() => {
    const RS = window.RackStudio;
    // Get SVG cable paths
    RS.setCableRenderMode('svg');
    const svgPaths = Array.from(document.querySelectorAll('#cables-group path.cable-path, #cables-group path')).map(p => ({
      id: p.id,
      d: p.getAttribute('d')
    }));

    // Now switch to Pixi
    RS.setCableRenderMode('pixi');
    
    // Check Pixi path in cablesContainer
    // We can also see how cables-pixi-renderer calculated pathD
    return {
      svgSampleD: svgPaths[0]?.d,
      cables: RS.STATE.cables.slice(0, 3)
    };
  });
  console.log('COMPARISON:', JSON.stringify(comp, null, 2));
  await browser.close();
  server.close();
});
