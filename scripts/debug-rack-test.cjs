const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
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
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.RackStudio);
    
    // Wait a bit longer for DOMContentLoaded to fire
    await page.waitForFunction(() => window.RackStudio && typeof window.RackStudio.renderRackRailsAndSlots === 'function');
    
    const result = await page.evaluate(() => {
      const api = window.RackStudio;
      return {
        hasRenderFn: typeof api.renderRackRailsAndSlots === 'function',
        hasFnSource: api.renderRackRailsAndSlots?.toString().slice(0, 100),
        hasRefresh: typeof api.refresh === 'function',
        hasInvalidate: typeof api.invalidate === 'function',
        hasFlushSync: typeof api.flushSync === 'function',
      };
    });
    console.log('Debug result:', JSON.stringify(result, null, 2));
    console.log('Page errors:', errors);
  } finally {
    await browser.close();
    server.close();
  }
})();
