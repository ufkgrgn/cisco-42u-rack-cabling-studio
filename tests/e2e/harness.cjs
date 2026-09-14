// E2E Test Harness for Digital Rack Cabin Studio
// Provides ephemeral HTTP server, Playwright browser management, and test utilities.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Resolve Playwright module
const playwrightPath = process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/ufuk_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
let chromium;
try {
  ({ chromium } = require(playwrightPath));
} catch (_) {
  ({ chromium } = require('playwright'));
}

const rootDir = path.resolve(__dirname, '../..');

class TestHarness {
  constructor() {
    this.server = null;
    this.browser = null;
    this.page = null;
    this.port = 0;
    this.pageErrors = [];
  }

  async startServer() {
    if (this.server) return this.port;
    this.server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      let reqPath = decodeURIComponent(parsedUrl.pathname);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const target = path.resolve(rootDir, '.' + reqPath);
      if (!target.startsWith(rootDir + path.sep) && target !== rootDir) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      fs.readFile(target, (err, data) => {
        if (err) {
          res.writeHead(404).end('Not found');
          return;
        }
        const ext = path.extname(target).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.cjs': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.end(data);
      });
    });

    await new Promise(resolve => this.server.listen(0, '127.0.0.1', resolve));
    this.port = this.server.address().port;
    return this.port;
  }

  async launchBrowser() {
    if (this.browser) return this.browser;
    await this.startServer();
    const channel = process.env.BROWSER_CHANNEL || 'msedge';
    this.browser = await chromium.launch({
      headless: true,
      channel
    });
    return this.browser;
  }

  async createPage() {
    await this.launchBrowser();
    this.page = await this.browser.newPage({ viewport: { width: 1600, height: 1000 } });
    this.pageErrors = [];
    this.page.on('pageerror', err => this.pageErrors.push(err.message));
    this.page.on('dialog', dialog => dialog.accept());
    await this.page.goto(`http://127.0.0.1:${this.port}/index.html`);
    await this.page.waitForFunction(() => window.RackStudio && window.RackStudio.STATE);
    await this.page.waitForSelector('.studio-editor[data-ready="true"]', { timeout: 10000 }).catch(() => {});
    return this.page;
  }

  async resetTopology(options = {}) {
    if (!this.page) throw new Error('Page not initialized');
    return this.page.evaluate((opts) => {
      const api = window.RackStudio;
      if (!api) throw new Error('RackStudio not loaded');
      const heightU = opts.heightU || 42;
      const rackId = opts.rackId || 'rack-test';
      const rackName = opts.rackName || 'Test Rack';
      api.loadCustomTopology({
        racks: [{
          id: rackId,
          name: rackName,
          heightU,
          devices: []
        }],
        cables: [],
        activeRackId: rackId,
        customCatalog: {}
      });
      api.refresh();
      return true;
    }, options);
  }

  async evaluate(fn, ...args) {
    if (!this.page) throw new Error('Page not initialized');
    return this.page.evaluate(fn, ...args);
  }

  getErrors() {
    return [...this.pageErrors];
  }

  clearErrors() {
    this.pageErrors = [];
  }

  async close() {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve)).catch(() => {});
      this.server = null;
    }
  }
}

module.exports = { TestHarness };
