// Repeatable sidebar/catalog open-close smoke measurement; not a low-end GPU certification.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const stencilRequests = [];
    page.on('request', request => { if (/assets\/stencils\//i.test(request.url())) stencilRequests.push(request.url()); });
    await page.addInitScript(() => {
      window.__catalogLongTasks = [];
      if ('PerformanceObserver' in window) {
        try { new PerformanceObserver(list => window.__catalogLongTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask' }); } catch (_) {}
      }
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.RackStudio && typeof window.setLeftSidebarCollapsed === 'function' && document.querySelector('.catalog-tools'));
    await page.waitForTimeout(350);
    await page.evaluate(() => { window.__catalogLongTasks.length = 0; });

    async function cycle() {
      const start = await page.evaluate(() => performance.now());
      for (const collapsed of [true, false]) {
        await page.evaluate(value => new Promise(resolve => {
          const panel = document.querySelector('.sidebar-left');
          const done = event => { if (event.target === panel && event.propertyName === 'width') { panel.removeEventListener('transitionend', done); resolve(); } };
          panel.addEventListener('transitionend', done);
          window.setLeftSidebarCollapsed(value);
          setTimeout(() => { panel.removeEventListener('transitionend', done); resolve(); }, 400);
        }), collapsed);
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return (await page.evaluate(() => performance.now())) - start;
    }

    for (let i = 0; i < 2; i++) await cycle();
    const samples = [];
    for (let i = 0; i < 8; i++) samples.push(await cycle());
    const sorted = [...samples].sort((a, b) => a - b);
    const result = {
      browser: 'Microsoft Edge headless', viewport: '1600x1000', cycles: samples.length,
      openCloseCycleMs: samples.map(value => Number(value.toFixed(1))),
      p50Ms: Number(sorted[Math.floor(sorted.length * .5)].toFixed(1)),
      p95Ms: Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))].toFixed(1)),
      stencilSvgRequestsOnLoadAndPanelToggle: stencilRequests.length,
      generatedCardPreviews: await page.locator('.sidebar-left img.hw-generated-stencil').count(),
      longTaskCount: await page.evaluate(() => window.__catalogLongTasks.length),
      maxLongTaskMs: await page.evaluate(() => Math.max(0, ...window.__catalogLongTasks).toFixed(1))
    };
    assert.equal(result.stencilSvgRequestsOnLoadAndPanelToggle, 0, 'opening/closing catalog must not download original Cisco SVGs');
    assert.ok(result.generatedCardPreviews > 0, 'catalog renders compact vector previews');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
