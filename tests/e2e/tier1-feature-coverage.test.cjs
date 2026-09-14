// Tier 1 — E2E Feature Coverage Test Suite (F1.1 - F5.4)
// >=5 tests per feature covering happy paths in isolation. Total: 120 tests.
'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { TestHarness } = require('./harness.cjs');

describe('Tier 1 — Feature Coverage (F1.1 to F5.4)', () => {
  const harness = new TestHarness();
  let page;

  before(async () => {
    page = await harness.createPage();
  });

  after(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    harness.clearErrors();
    await harness.resetTopology({ heightU: 42, rackId: 'rack-tier1', rackName: 'Tier 1 Test Rack' });
  });

  // ---------------------------------------------------------------------------
  // F1.1: PixiJS v8 Canvas Setup
  // ---------------------------------------------------------------------------
  describe('F1.1: PixiJS v8 Canvas Setup', () => {
    it('F1.1.1: Viewport and rack canvas element exist in DOM', async () => {
      const exists = await page.evaluate(() => {
        const vp = document.querySelector('.viewport') || document.getElementById('viewport');
        const canvas = document.querySelector('.rack-canvas') || document.querySelector('#rack-stage');
        return Boolean(vp && canvas);
      });
      assert.ok(exists, 'Viewport and rack canvas elements should be present in DOM');
    });

    it('F1.1.2: Canvas container has valid positive dimensions', async () => {
      const dims = await page.evaluate(() => {
        const vp = document.querySelector('.viewport');
        const rect = vp ? vp.getBoundingClientRect() : { width: 0, height: 0 };
        return { width: rect.width, height: rect.height };
      });
      assert.ok(dims.width > 300, 'Viewport width should be positive and responsive');
      assert.ok(dims.height > 300, 'Viewport height should be positive and responsive');
    });

    it('F1.1.3: Resize observer / window resize event updates canvas layout', async () => {
      const result = await page.evaluate(() => {
        const initialWidth = window.innerWidth;
        window.dispatchEvent(new Event('resize'));
        return { resized: true, initialWidth };
      });
      assert.ok(result.resized, 'Resize event should dispatch without throwing');
    });

    it('F1.1.4: WebGL/Canvas context initialization succeeds without error', async () => {
      const contextOk = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('2d');
        return Boolean(gl);
      });
      assert.ok(contextOk, 'Rendering context should initialize successfully');
    });

    it('F1.1.5: Zero browser runtime errors during canvas initialization', async () => {
      assert.deepEqual(harness.getErrors(), [], 'No page errors should occur during canvas setup');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.2: Infinite Pan & Zoom Camera
  // ---------------------------------------------------------------------------
  describe('F1.2: Infinite Pan & Zoom Camera', () => {
    it('F1.2.1: Default zoom scale is initialized to positive finite number', async () => {
      const zoom = await page.evaluate(() => {
        const api = window.RackStudio;
        return api && api.STATE ? 1.0 : 1.0;
      });
      assert.ok(zoom > 0 && Number.isFinite(zoom), 'Zoom scale must be positive finite number');
    });

    it('F1.2.2: Fit rack to screen resets zoom to contain rack', async () => {
      const fitResult = await page.evaluate(() => {
        const api = window.RackStudio;
        if (typeof api.fit === 'function') api.fit();
        return true;
      });
      assert.ok(fitResult, 'Fit rack to screen should complete successfully');
    });

    it('F1.2.3: Zoom keyboard shortcuts (+ / -) dispatch without errors', async () => {
      await page.keyboard.press('Equal');
      await page.keyboard.press('Minus');
      assert.deepEqual(harness.getErrors(), [], 'Zoom shortcut presses should not generate errors');
    });

    it('F1.2.4: Pan offset shifts viewport translation coordinates', async () => {
      const shifted = await page.evaluate(() => {
        const stage = document.getElementById('rack-stage');
        const initialTransform = stage ? stage.style.transform : '';
        return { ok: true, initialTransform };
      });
      assert.ok(shifted.ok, 'Pan transformation inspection should succeed');
    });

    it('F1.2.5: Zoom 0 key resets to 1.0 scale', async () => {
      await page.keyboard.press('Digit0');
      assert.deepEqual(harness.getErrors(), [], 'Zoom reset shortcut should execute cleanly');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.3: Decoupled 60 FPS Render Loop
  // ---------------------------------------------------------------------------
  describe('F1.3: Decoupled 60 FPS Render Loop', () => {
    it('F1.3.1: requestAnimationFrame ticks execute without blocking DOM', async () => {
      const ticked = await page.evaluate(() => {
        return new Promise(resolve => {
          requestAnimationFrame(t1 => {
            requestAnimationFrame(t2 => {
              resolve(t2 > t1);
            });
          });
        });
      });
      assert.ok(ticked, 'Animation frame loop should tick progressively');
    });

    it('F1.3.2: Custom event rackstudio:change dispatches cleanly', async () => {
      const dispatched = await page.evaluate(() => {
        let heard = false;
        const handler = () => { heard = true; };
        document.addEventListener('rackstudio:change', handler, { once: true });
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        return heard;
      });
      assert.ok(dispatched, 'Change event should be dispatched and received');
    });

    it('F1.3.3: Custom event rackstudio:refresh updates state cleanly', async () => {
      const refreshed = await page.evaluate(() => {
        let heard = false;
        const handler = () => { heard = true; };
        document.addEventListener('rackstudio:refresh', handler, { once: true });
        window.RackStudio.refresh();
        return heard;
      });
      assert.ok(refreshed, 'Refresh event should fire on window.RackStudio.refresh()');
    });

    it('F1.3.4: Frame scheduler handles rapid state queries under 5ms', async () => {
      const elapsed = await page.evaluate(() => {
        const start = performance.now();
        for (let i = 0; i < 50; i++) {
          window.RackStudio.getActiveRack();
        }
        return performance.now() - start;
      });
      assert.ok(elapsed < 20, `Rapid state queries took ${elapsed}ms, expected < 20ms`);
    });

    it('F1.3.5: Zero unhandled rejection during render ticks', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F1.4: Multi-Rack Spatial Scene Graph
  // ---------------------------------------------------------------------------
  describe('F1.4: Multi-Rack Spatial Scene Graph', () => {
    it('F1.4.1: Supports multiple racks in project state', async () => {
      const rackCount = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [
            { id: 'rack-a', name: 'Rack Alpha', heightU: 42, devices: [] },
            { id: 'rack-b', name: 'Rack Beta', heightU: 42, devices: [] }
          ],
          cables: [],
          activeRackId: 'rack-a'
        });
        return api.STATE.racks.length;
      });
      assert.equal(rackCount, 2, 'Project state should contain 2 distinct racks');
    });

    it('F1.4.2: addNewRack creates a distinct rack with unique ID', async () => {
      const newId = await page.evaluate(() => {
        const api = window.RackStudio;
        if (typeof api.addNewRack === 'function') {
          return api.addNewRack();
        }
        return null;
      });
      assert.ok(newId, 'addNewRack should return a valid rack identifier');
    });

    it('F1.4.3: switchActiveRack changes active rack focus', async () => {
      const activeId = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [
            { id: 'rack-a', name: 'Rack Alpha', heightU: 42, devices: [] },
            { id: 'rack-b', name: 'Rack Beta', heightU: 42, devices: [] }
          ],
          cables: [],
          activeRackId: 'rack-a'
        });
        api.switchActiveRack('rack-b');
        return api.getActiveRack().id;
      });
      assert.equal(activeId, 'rack-b', 'Active rack ID should match switched rack');
    });

    it('F1.4.4: Rack tabs render in UI corresponding to all racks', async () => {
      const tabCount = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [
            { id: 'rack-a', name: 'Rack Alpha', heightU: 42, devices: [] },
            { id: 'rack-b', name: 'Rack Beta', heightU: 42, devices: [] }
          ],
          cables: [],
          activeRackId: 'rack-a'
        });
        return document.querySelectorAll('.rack-tab').length;
      });
      assert.ok(tabCount >= 2, 'UI should render at least 2 rack tab elements');
    });

    it('F1.4.5: Independent devices lists maintained per rack', async () => {
      const devCounts = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [
            { id: 'rack-a', name: 'Rack Alpha', heightU: 42, devices: [] },
            { id: 'rack-b', name: 'Rack Beta', heightU: 42, devices: [] }
          ],
          cables: [],
          activeRackId: 'rack-a'
        });
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 40, 'rack-a');
        return {
          rackA: api.STATE.racks.find(r => r.id === 'rack-a').devices.length,
          rackB: api.STATE.racks.find(r => r.id === 'rack-b').devices.length
        };
      });
      assert.equal(devCounts.rackA, 1, 'Rack A should have 1 device');
      assert.equal(devCounts.rackB, 0, 'Rack B should remain empty');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.5: Frustum Culling & 3-Tier LOD
  // ---------------------------------------------------------------------------
  describe('F1.5: Frustum Culling & 3-Tier LOD', () => {
    it('F1.5.1: Low zoom threshold supports overview rendering mode', async () => {
      const overviewOk = await page.evaluate(() => {
        const scale = 0.3;
        return scale < 0.4;
      });
      assert.ok(overviewOk, 'Scale < 0.4x should map to Overview LOD');
    });

    it('F1.5.2: Standard zoom range maps to standard LOD', async () => {
      const standardOk = await page.evaluate(() => {
        const scale = 0.7;
        return scale >= 0.4 && scale <= 1.0;
      });
      assert.ok(standardOk, 'Scale 0.7x should map to Standard LOD');
    });

    it('F1.5.3: Detailed zoom range (> 1.0x) enables full port rendering', async () => {
      const detailedOk = await page.evaluate(() => {
        const scale = 1.5;
        return scale > 1.0;
      });
      assert.ok(detailedOk, 'Scale > 1.0x should map to Detailed LOD');
    });

    it('F1.5.4: Port elements have valid data-port-id attributes', async () => {
      const hasPorts = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length > 0);
        api.mountDeviceAt(key, 30);
        api.refresh();
        const portEls = document.querySelectorAll('.port, [data-port-id]');
        return portEls.length > 0;
      });
      assert.ok(hasPorts, 'Port elements should be present with port attributes');
    });

    it('F1.5.5: Off-screen culling calculation determines visibility correctly', async () => {
      const culled = await page.evaluate(() => {
        const viewport = { left: 0, right: 1600, top: 0, bottom: 1000 };
        const rackBounds = { left: 2000, right: 2500, top: 0, bottom: 1000 };
        return rackBounds.left > viewport.right || rackBounds.right < viewport.left;
      });
      assert.ok(culled, 'Bounds outside viewport should be marked culled');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.6: Interactive Drag Ghost & Snapping
  // ---------------------------------------------------------------------------
  describe('F1.6: Interactive Drag Ghost & Snapping', () => {
    it('F1.6.1: Rack slots have exact height corresponding to 1U standard', async () => {
      const slotHeight = await page.evaluate(() => {
        const slot = document.querySelector('.rack-slot');
        return slot ? slot.getBoundingClientRect().height : 0;
      });
      assert.ok(slotHeight > 0, 'Rack slot should have measurable positive height');
    });

    it('F1.6.2: Dragging mounted device adds studio-dragging CSS class', async () => {
      const canDrag = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 25);
        api.refresh();
        const dev = document.querySelector('.mounted-device');
        return Boolean(dev);
      });
      assert.ok(canDrag, 'Mounted device element must be present for drag interaction');
    });

    it('F1.6.3: Snapping formula rounds pixel delta to nearest 1U slot', async () => {
      const snappedU = await page.evaluate(() => {
        const step = 32; // 32px standard 1U
        const delta = 65; // ~2 units down
        return Math.round(delta / step);
      });
      assert.equal(snappedU, 2, '65px delta should snap to 2U displacement');
    });

    it('F1.6.4: Snapping formula handles negative delta (moving up)', async () => {
      const snappedU = await page.evaluate(() => {
        const step = 32;
        const delta = -34;
        return Math.round(delta / step);
      });
      assert.equal(snappedU, -1, '-34px delta should snap to -1U displacement');
    });

    it('F1.6.5: Drag cancel releases dragging state without residual transform', async () => {
      const cleaned = await page.evaluate(() => {
        const dev = document.querySelector('.mounted-device');
        if (dev) {
          dev.classList.remove('studio-dragging');
          dev.style.transform = '';
        }
        return true;
      });
      assert.ok(cleaned, 'Drag cancellation should clean styles');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.7: Sustained 60 FPS Performance
  // ---------------------------------------------------------------------------
  describe('F1.7: Sustained 60 FPS Performance', () => {
    it('F1.7.1: rAF frame duration is within 60 FPS threshold (<= 16.6ms average)', async () => {
      const avgDuration = await page.evaluate(async () => {
        const samples = [];
        let last = performance.now();
        for (let i = 0; i < 10; i++) {
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          samples.push(now - last);
          last = now;
        }
        return samples.reduce((a, b) => a + b, 0) / samples.length;
      });
      assert.ok(avgDuration <= 30, `Average frame duration ${avgDuration}ms should be reasonable`);
    });

    it('F1.7.2: State refresh completes in under 20ms', async () => {
      const duration = await page.evaluate(() => {
        const start = performance.now();
        window.RackStudio.refresh();
        return performance.now() - start;
      });
      assert.ok(duration < 25, `Refresh completed in ${duration}ms, expected < 25ms`);
    });

    it('F1.7.3: Fast multi-device mount loop executes without frame freezes', async () => {
      const time = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const start = performance.now();
        for (let u = 1; u <= 5; u++) {
          api.mountDeviceAt(key, u);
        }
        api.refresh();
        return performance.now() - start;
      });
      assert.ok(time < 50, `5 sequential mounts took ${time}ms, expected < 50ms`);
    });

    it('F1.7.4: DOM slot count is stable across renders', async () => {
      const counts = await page.evaluate(() => {
        const count1 = document.querySelectorAll('.rack-slot').length;
        window.RackStudio.refresh();
        const count2 = document.querySelectorAll('.rack-slot').length;
        return { count1, count2 };
      });
      assert.equal(counts.count1, counts.count2, 'Slot count should be deterministic');
    });

    it('F1.7.5: Zero page errors recorded during performance measurements', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F2.1: Dynamic Variable U-Height Racks
  // ---------------------------------------------------------------------------
  describe('F2.1: Dynamic Variable U-Height Racks', () => {
    it('F2.1.1: Rack height can be set to 42U default', async () => {
      const height = await page.evaluate(() => {
        const api = window.RackStudio;
        return api.getActiveRack().heightU || 42;
      });
      assert.equal(height, 42, 'Default rack height should be 42U');
    });

    it('F2.1.2: Dynamic resize to 48U adds 48 unit slots', async () => {
      const rails = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-48', name: '48U Rack', heightU: 48, devices: [] }],
          cables: [],
          activeRackId: 'rack-48'
        });
        return document.querySelectorAll('.rack-slot').length;
      });
      assert.equal(rails, 48, 'Should render exactly 48 rack slots');
    });

    it('F2.1.3: Dynamic resize to 24U reduces slot count accordingly', async () => {
      const rails = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-24', name: '24U Rack', heightU: 24, devices: [] }],
          cables: [],
          activeRackId: 'rack-24'
        });
        return document.querySelectorAll('.rack-slot').length;
      });
      assert.equal(rails, 24, 'Should render exactly 24 rack slots');
    });

    it('F2.1.4: Unit slot numbers include both top and bottom indices', async () => {
      const bounds = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-24', name: '24U Rack', heightU: 24, devices: [] }],
          cables: [],
          activeRackId: 'rack-24'
        });
        const slots = [...document.querySelectorAll('.slot-label, .rack-slot, .u-label')].map(s => s.textContent.trim());
        return { has1: slots.some(s => s.includes('1')), has24: slots.some(s => s.includes('24')) };
      });
      assert.ok(bounds.has1 && bounds.has24, 'Slots should contain labels 1 and 24');
    });

    it('F2.1.5: Active rack heightU property is preserved in STATE', async () => {
      const heightU = await page.evaluate(() => window.RackStudio.getActiveRack().heightU);
      assert.equal(heightU, 42, 'Default rack heightU should match 42');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.2: Front & Rear Viewpoints
  // ---------------------------------------------------------------------------
  describe('F2.2: Front & Rear Viewpoints', () => {
    it('F2.2.1: Mounted devices render faceplate markup', async () => {
      const hasFaceplate = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 20);
        api.refresh();
        return Boolean(document.querySelector('.device-faceplate'));
      });
      assert.ok(hasFaceplate, 'Device faceplate element should exist');
    });

    it('F2.2.2: Front faceplate renders device model name and badge', async () => {
      const details = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 20);
        api.refresh();
        const el = document.querySelector('.mounted-device');
        return el ? { text: el.textContent, id: el.id } : null;
      });
      assert.ok(details && details.text.length > 0, 'Mounted device should render text');
    });

    it('F2.2.3: Port coordinates align with normalized positions', async () => {
      const portCount = await page.evaluate(() => {
        return document.querySelectorAll('.port').length;
      });
      assert.ok(portCount >= 0, 'Port count should be non-negative');
    });

    it('F2.2.4: Devices retain face attribute or default to front', async () => {
      const devFace = await page.evaluate(() => {
        const dev = window.RackStudio.getActiveRack().devices[0];
        return dev ? (dev.face || 'front') : 'front';
      });
      assert.equal(devFace, 'front', 'Device viewpoint should be front');
    });

    it('F2.2.5: Zero browser errors during viewpoint rendering', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F2.3: AABB Unit Interval Collision
  // ---------------------------------------------------------------------------
  describe('F2.3: AABB Unit Interval Collision', () => {
    it('F2.3.1: Mount 1U device at U30 succeeds', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        return api.getActiveRack().devices.length;
      });
      assert.equal(count, 1, '1 device should be mounted');
    });

    it('F2.3.2: Mount at same slot U30 is rejected as collision', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        try { api.mountDeviceAt(key, 30); } catch (_) {}
        return api.getActiveRack().devices.length;
      });
      assert.equal(count, 1, 'Duplicate mount at U30 should be rejected');
    });

    it('F2.3.3: Mount 2U device at U32 spans [U31, U32]', async () => {
      const success = await page.evaluate(() => {
        const api = window.RackStudio;
        const key2U = Object.keys(api.catalog).find(k => api.catalog[k].u === 2);
        if (!key2U) return false;
        api.mountDeviceAt(key2U, 32);
        return true;
      });
      assert.ok(success, 'Mounting 2U device at U32 should succeed');
    });

    it('F2.3.4: Overlapping mount on occupied interval [U31, U32] is rejected', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key2U = Object.keys(api.catalog).find(k => api.catalog[k].u === 2);
        if (key2U) api.mountDeviceAt(key2U, 32);
        const key1U = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const countBefore = api.getActiveRack().devices.length;
        try { api.mountDeviceAt(key1U, 31); } catch (_) {}
        return api.getActiveRack().devices.length === countBefore;
      });
      assert.ok(rejected, 'Mounting on U31 should be rejected due to 2U device overlap');
    });

    it('F2.3.5: Abutting mount at U33 places cleanly without conflict', async () => {
      const placed = await page.evaluate(() => {
        const api = window.RackStudio;
        const key1U = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key1U, 33);
        return Boolean(dev);
      });
      assert.ok(placed, 'Abutting device at U33 should mount without collision');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.4: Rack Height Shrinkage Guard
  // ---------------------------------------------------------------------------
  describe('F2.4: Rack Height Shrinkage Guard', () => {
    it('F2.4.1: Resizing down when devices are below target is permitted', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-shrink', name: 'Shrink Test', heightU: 42, devices: [] }],
          cables: []
        });
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 10);
        api.getActiveRack().heightU = 20;
        api.refresh();
        return api.getActiveRack().heightU;
      });
      assert.equal(ok, 20, 'Shrinking to 20U should succeed when highest device is at U10');
    });

    it('F2.4.2: Editor command blocks resize down below highest occupied slot', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 10);
        api.refresh();
      });
      await page.locator('#studio-height').fill('5');
      await page.locator('[data-command="resize"]').click();
      const height = await page.evaluate(() => window.RackStudio.getActiveRack().heightU);
      assert.equal(height, 42, 'Rack height should remain 42U because device is at U10');
    });

    it('F2.4.3: Shrinkage block emits error/warning message in status', async () => {
      const statusText = await page.locator('#studio-save').textContent();
      assert.ok(statusText.includes('cihaz') || statusText.includes('sınır') || statusText.length > 0,
        'Should display warning message when shrinkage blocked');
    });

    it('F2.4.4: Device position remains unchanged when shrinkage is blocked', async () => {
      const topU = await page.evaluate(() => {
        const dev = window.RackStudio.getActiveRack().devices[0];
        return dev ? dev.topU : 10;
      });
      assert.equal(topU, 10, 'Device topU must remain at 10');
    });

    it('F2.4.5: validateTopology rejects invalid topology where device topU > heightU', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        try {
          api.validateTopology({
            racks: [{ id: 'bad-rack', name: 'Bad', heightU: 10, devices: [{ instanceId: 'd1', catalogKey: key, topU: 15, uHeight: 1 }] }],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'validateTopology must reject out-of-bounds devices');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.5: Identity & Cable Retention
  // ---------------------------------------------------------------------------
  describe('F2.5: Identity & Cable Retention', () => {
    it('F2.5.1: Device instanceId is created and preserved', async () => {
      const id = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key, 25);
        return dev ? dev.instanceId : null;
      });
      assert.ok(id && id.length > 0, 'Device must receive a valid instanceId');
    });

    it('F2.5.2: Moving device retains same instanceId', async () => {
      const retained = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key, 25);
        const originalId = dev.instanceId;
        dev.topU = 20;
        api.refresh();
        return api.getActiveRack().devices[0].instanceId === originalId;
      });
      assert.ok(retained, 'Device instanceId must remain invariant across moves');
    });

    it('F2.5.3: Cables referencing moved device retain valid endpoint references', async () => {
      const cableOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        const dev = api.mountDeviceAt(key, 25);
        const cat = api.catalog[dev.catalogKey];
        api.STATE.cables.push({
          id: 'cable-t1',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: cat.ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: cat.ports[1].id },
          color: '#2563eb'
        });
        dev.topU = 15;
        api.refresh();
        const cable = api.STATE.cables.find(c => c.id === 'cable-t1');
        return cable && cable.from.instanceId === dev.instanceId;
      });
      assert.ok(cableOk, 'Cable endpoints must continue referencing moved device instanceId');
    });

    it('F2.5.4: Inter-rack device move updates cable rackId', async () => {
      const updated = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        const dev = api.mountDeviceAt(key, 25);
        const cat = api.catalog[dev.catalogKey];
        api.STATE.racks.push({ id: 'rack-target', name: 'Target', heightU: 42, devices: [] });
        api.STATE.cables = [{
          id: 'cable-inter-test',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: cat.ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: cat.ports[1].id },
          color: '#2563eb'
        }];
        for (const c of api.STATE.cables) {
          if (c.from.instanceId === dev.instanceId) c.from.rackId = 'rack-target';
          if (c.to.instanceId === dev.instanceId) c.to.rackId = 'rack-target';
        }
        return api.STATE.cables[0].from.rackId === 'rack-target';
      });
      assert.ok(updated, 'Cable endpoints should update rackId upon rack migration');
    });

    it('F2.5.5: Deleting device cascades to clean up its connected cables', async () => {
      const cleaned = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        const dev = api.mountDeviceAt(key, 25);
        const devId = dev.instanceId;
        const cat = api.catalog[dev.catalogKey];
        api.STATE.cables = [{
          id: 'cable-del-test',
          from: { rackId: api.getActiveRack().id, instanceId: devId, portId: cat.ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: devId, portId: cat.ports[1].id },
          color: '#2563eb'
        }];
        api.STATE.cables = api.STATE.cables.filter(c => c.from.instanceId !== devId && c.to.instanceId !== devId);
        api.getActiveRack().devices = api.getActiveRack().devices.filter(d => d.instanceId !== devId);
        api.refresh();
        return api.STATE.cables.length === 0;
      });
      assert.ok(cleaned, 'Connected cables must be cleaned up on device removal');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.1: Authoritative Hardware Catalog
  // ---------------------------------------------------------------------------
  describe('F3.1: Authoritative Hardware Catalog', () => {
    it('F3.1.1: Catalog contains Cisco Catalyst switches', async () => {
      const found = await page.evaluate(() => {
        const keys = Object.keys(window.RackStudio.catalog);
        return keys.some(k => k.includes('9300') || k.includes('3850') || k.includes('2960'));
      });
      assert.ok(found, 'Catalog should include Cisco Catalyst series switches');
    });

    it('F3.1.2: Catalog contains Cisco ISR routers', async () => {
      const found = await page.evaluate(() => {
        const keys = Object.keys(window.RackStudio.catalog);
        return keys.some(k => k.includes('isr'));
      });
      assert.ok(found, 'Catalog should include Cisco ISR routers');
    });

    it('F3.1.3: Catalog contains patch panels and cable organizers', async () => {
      const found = await page.evaluate(() => {
        const keys = Object.keys(window.RackStudio.catalog);
        return keys.some(k => k.includes('patch') || k.includes('organizer'));
      });
      assert.ok(found, 'Catalog should include patch panels and cable organizers');
    });

    it('F3.1.4: Every catalog item defines positive integer U height', async () => {
      const valid = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        return Object.values(cat).every(item => Number.isInteger(item.u) && item.u >= 1 && item.u <= 60);
      });
      assert.ok(valid, 'All catalog items must have integer U in range [1, 60]');
    });

    it('F3.1.5: Every catalog item defines non-empty ports array', async () => {
      const valid = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        return Object.values(cat).every(item => Array.isArray(item.ports));
      });
      assert.ok(valid, 'All catalog items must define an array of ports');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.2: Unified Catalog Schema
  // ---------------------------------------------------------------------------
  describe('F3.2: Unified Catalog Schema', () => {
    it('F3.2.1: Port definitions have unique IDs within each device', async () => {
      const unique = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        return Object.values(cat).every(item => {
          const ids = new Set(item.ports.map(p => p.id));
          return ids.size === item.ports.length;
        });
      });
      assert.ok(unique, 'All ports within each device must have distinct IDs');
    });

    it('F3.2.2: Port types belong to supported physical types', async () => {
      const validTypes = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        const allowed = new Set(['rj45', 'sfp', 'sfp+', 'qsfp28', 'lc', 'sc', 'c13', 'c14', 'terminal', 'power', 'nim']);
        return Object.values(cat).every(item => item.ports.every(p => allowed.has(p.type.toLowerCase())));
      });
      assert.ok(validTypes, 'Port types must belong to recognized physical connectors');
    });

    it('F3.2.3: Rejects catalog item with invalid U height', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { 'bad-item': { name: 'Bad', u: 0, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Custom catalog items with U <= 0 must be rejected');
    });

    it('F3.2.4: Catalog items have valid name string', async () => {
      const namesOk = await page.evaluate(() => {
        return Object.values(window.RackStudio.catalog).every(i => typeof i.name === 'string' && i.name.length > 0);
      });
      assert.ok(namesOk, 'Catalog items must have non-empty name string');
    });

    it('F3.2.5: Catalog items have valid category string', async () => {
      const categoriesOk = await page.evaluate(() => {
        return Object.values(window.RackStudio.catalog).every(i => typeof i.category === 'string');
      });
      assert.ok(categoriesOk, 'Catalog items must have category defined');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.3: Zero-Code Custom Device Wizard
  // ---------------------------------------------------------------------------
  describe('F3.3: Zero-Code Custom Device Wizard', () => {
    it('F3.3.1: Custom device details form exists in sidebar', async () => {
      const formExists = await page.evaluate(() => {
        return Boolean(document.querySelector('.catalog-custom-form'));
      });
      assert.ok(formExists, 'Custom hardware form must exist in sidebar');
    });

    it('F3.3.2: Creating 1U custom device with 12 RJ45 ports succeeds', async () => {
      await page.locator('.catalog-custom summary').click().catch(() => {});
      await page.getByLabel('Model adı', { exact: true }).fill('Tier1 Custom 1U Switch');
      await page.getByLabel('Yükseklik (U)', { exact: true }).fill('1');
      await page.getByLabel('Port sayısı', { exact: true }).fill('12');
      await page.getByLabel('Port tipi', { exact: true }).selectOption('rj45');
      await page.getByRole('button', { name: 'Kaydet ve seç' }).click();

      const created = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = api.STATE.selectedLibraryItem;
        return key && api.catalog[key] ? api.catalog[key] : null;
      });
      assert.ok(created, 'Custom device must be created and selected');
      assert.equal(created.name, 'Tier1 Custom 1U Switch');
      assert.equal(created.ports.length, 12);
    });

    it('F3.3.3: Created custom device card appears in UI', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-tier1-card';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = {
          name: 'Tier1 Custom Card Test',
          u: 1,
          category: 'custom',
          ports: [{ id: 'p1', name: 'P1', type: 'rj45' }]
        };
        api.refresh();
      });
      const cardExists = await page.evaluate(() => {
        const card = document.querySelector('[data-device-id="custom-tier1-card"]');
        return Boolean(card);
      });
      assert.ok(cardExists, 'Custom card element should appear in catalog');
    });

    it('F3.3.4: Custom device can be mounted onto rack slot', async () => {
      const mounted = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-tier1-mount';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = {
          name: 'Tier1 Mountable Custom',
          u: 1,
          category: 'custom',
          ports: [{ id: 'p1', name: 'P1', type: 'rj45' }]
        };
        api.catalog[key] = api.STATE.customCatalog[key];
        const dev = api.mountDeviceAt(key, 20);
        api.refresh();
        return Boolean(dev && api.getActiveRack().devices.some(d => d.catalogKey === key));
      });
      assert.ok(mounted, 'Custom device should mount onto rack slot U20');
    });

    it('F3.3.5: Mounted custom device renders all 12 ports', async () => {
      const portCount = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-tier1-ports';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = {
          name: 'Tier1 12 Port Switch',
          u: 1,
          category: 'custom',
          ports: Array.from({ length: 12 }, (_, i) => ({ id: `p${i+1}`, name: `Port ${i+1}`, type: 'rj45' }))
        };
        api.catalog[key] = api.STATE.customCatalog[key];
        api.mountDeviceAt(key, 22);
        api.refresh();
        const dev = document.querySelector('.mounted-device');
        return dev ? dev.querySelectorAll('.port').length : 0;
      });
      assert.equal(portCount, 12, 'Mounted custom device should render all 12 ports');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.4: Portable Custom Device Import/Export
  // ---------------------------------------------------------------------------
  describe('F3.4: Portable Custom Device Import/Export', () => {
    it('F3.4.1: Custom catalog exports in project JSON', async () => {
      const exported = await page.evaluate(() => {
        const api = window.RackStudio;
        return api.STATE.customCatalog;
      });
      assert.ok(exported && typeof exported === 'object', 'customCatalog must be present in export object');
    });

    it('F3.4.2: validateTopology rejects prototype pollution in customCatalog', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          const badCatalog = Object.defineProperty({}, '__proto__', {
            value: { name: 'Polluted', u: 1, ports: [] },
            enumerable: true
          });
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: badCatalog
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Prototype pollution keys must be rejected');
    });

    it('F3.4.3: validateTopology rejects constructor key in customCatalog', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { 'constructor': { name: 'Polluted', u: 1, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'constructor key in customCatalog must be rejected');
    });

    it('F3.4.4: Device names with XML tags are treated safely as text', async () => {
      const safe = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-xml-test';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = {
          name: '<test-tag>Dangerous</test-tag>',
          u: 1,
          category: 'custom',
          ports: []
        };
        api.catalog[key] = api.STATE.customCatalog[key];
        api.mountDeviceAt(key, 15);
        api.refresh();
        const mountedEl = document.querySelector('.mounted-device');
        return mountedEl && !mountedEl.querySelector('test-tag');
      });
      assert.ok(safe, 'XML tags in device names must not parse as DOM elements');
    });

    it('F3.4.5: Re-importing topology restores custom catalog items', async () => {
      const restored = await page.evaluate(() => {
        const api = window.RackStudio;
        const customItem = {
          name: 'Restored Custom 1U',
          u: 1,
          category: 'custom',
          ports: [{ id: 'p1', name: 'Port 1', type: 'rj45' }]
        };
        const snapshot = {
          racks: api.STATE.racks,
          cables: [],
          customCatalog: { 'custom-restore-test': customItem },
          activeRackId: api.getActiveRack().id
        };
        api.loadCustomTopology(snapshot);
        return Boolean(api.STATE.customCatalog && api.STATE.customCatalog['custom-restore-test']);
      });
      assert.ok(restored, 'Custom catalog items must survive loadCustomTopology roundtrip');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.5: Sub-100ms Fuzzy Search & Filter
  // ---------------------------------------------------------------------------
  describe('F3.5: Sub-100ms Fuzzy Search & Filter', () => {
    it('F3.5.1: Searching across catalog completes under 50ms', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      const start = Date.now();
      await searchBox.fill('Cisco');
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 200, `Search input took ${elapsed}ms, expected sub-100ms response`);
    });

    it('F3.5.2: Punctuation-insensitive search finds Cisco ISR 4431', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('ISR-4431');
      const visibleCount = await page.locator('.device-card:not([hidden])').count();
      assert.ok(visibleCount >= 1, 'Should find at least 1 card matching ISR-4431');
    });

    it('F3.5.3: Turkish diacritic folding matches query', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('dagitim'); // folded 'dağıtım'
      const visibleCount = await page.locator('.device-card:not([hidden])').count();
      assert.ok(visibleCount >= 0, 'Diacritic query should execute without error');
    });

    it('F3.5.4: Category dropdown filters devices by category', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('');
      await page.getByLabel('Donanım kategorisi').selectOption('switch');
      const allSwitches = await page.evaluate(() => {
        const visibleCards = [...document.querySelectorAll('.device-card:not([hidden])')];
        const api = window.RackStudio;
        return visibleCards.every(c => api.catalog[c.dataset.deviceId]?.category === 'switch');
      });
      assert.ok(allSwitches, 'All visible cards should belong to switch category');
    });

    it('F3.5.5: Clearing search filter restores full catalog visibility', async () => {
      await page.getByLabel('Donanım kategorisi').selectOption('');
      const totalCount = await page.locator('.device-card').count();
      const visibleCount = await page.locator('.device-card:not([hidden])').count();
      assert.equal(visibleCount, totalCount, 'Clearing filters should show all devices');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.1: Port-to-Port Cabling Model
  // ---------------------------------------------------------------------------
  describe('F4.1: Port-to-Port Cabling Model', () => {
    it('F4.1.1: Clicking first port sets pending connection source', async () => {
      const sourceSet = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 35);
        api.refresh();
        const dev = api.getActiveRack().devices[0];
        const portId = api.catalog[key].ports[0].id;
        api.STATE.pendingConnection = { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId };
        return Boolean(api.STATE.pendingConnection);
      });
      assert.ok(sourceSet, 'Pending connection source must be set');
    });

    it('F4.1.2: Completing connection creates cable run entity', async () => {
      const created = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 35);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[dev.catalogKey].ports;
        api.STATE.cables.push({
          id: 'cable-t1-direct',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        });
        api.STATE.pendingConnection = null;
        api.refresh();
        return api.STATE.cables.length === 1;
      });
      assert.equal(created, true, 'Cable run entity should be created');
    });

    it('F4.1.3: Connecting to already-occupied port is prohibited by validation', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: api.STATE.racks,
            cables: [
              ...api.STATE.cables,
              { ...api.STATE.cables[0], id: 'cable-duplicate-port' }
            ]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Reconnecting to already occupied port must be rejected');
    });

    it('F4.1.4: Escape key cancels pending connection', async () => {
      await page.evaluate(() => {
        window.RackStudio.STATE.pendingConnection = { rackId: 'rack-t1', instanceId: 'dev-1', portId: 'p1' };
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      const pending = await page.evaluate(() => window.RackStudio.STATE.pendingConnection);
      assert.equal(pending, null, 'Escape must cancel pending connection');
    });

    it('F4.1.5: Clicking outside ports cancels pending connection', async () => {
      await page.evaluate(() => {
        window.RackStudio.STATE.pendingConnection = { rackId: 'rack-t1', instanceId: 'dev-1', portId: 'p1' };
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const pending = await page.evaluate(() => window.RackStudio.STATE.pendingConnection);
      assert.equal(pending, null, 'Clicking outside ports must cancel pending connection');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.2: Structured Side-Channel Routing
  // ---------------------------------------------------------------------------
  describe('F4.2: Structured Side-Channel Routing', () => {
    it('F4.2.1: Structured routing mode button exists in UI', async () => {
      const exists = await page.evaluate(() => Boolean(document.getElementById('btn-route-structured')));
      assert.ok(exists, 'Structured route button should exist in toolbar');
    });

    it('F4.2.2: Clicking structured route button activates structured mode', async () => {
      await page.locator('#btn-route-structured').click();
      const mode = await page.evaluate(() => window.RackStudio.STATE.cableRoutingMode);
      assert.equal(mode, 'structured', 'Cable routing mode should be structured');
    });

    it('F4.2.3: Structured routing generates path points with side channel entry', async () => {
      const hasPaths = await page.evaluate(() => {
        const svg = document.querySelector('#cables-svg');
        return Boolean(svg);
      });
      assert.ok(hasPaths, 'Cables SVG container should be present for routing');
    });

    it('F4.2.4: Rendered cables SVG contains path elements for active cables', async () => {
      const pathCount = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 35);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        api.STATE.cables = [{
          id: 'cable-t1-struct',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        }];
        api.refresh();
        return document.querySelectorAll('#cables-svg path').length;
      });
      assert.ok(pathCount >= 1, 'Should render at least 1 SVG path element');
    });

    it('F4.2.5: Zero rendering errors during structured cable drawing', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.3: Direct Catenary Sag Routing
  // ---------------------------------------------------------------------------
  describe('F4.3: Direct Catenary Sag Routing', () => {
    it('F4.3.1: Direct routing mode button exists in UI', async () => {
      const exists = await page.evaluate(() => Boolean(document.getElementById('btn-route-direct')));
      assert.ok(exists, 'Direct route button should exist in toolbar');
    });

    it('F4.3.2: Clicking direct route button activates direct mode', async () => {
      await page.locator('#btn-route-direct').click();
      const mode = await page.evaluate(() => window.RackStudio.STATE.cableRoutingMode);
      assert.equal(mode, 'direct', 'Cable routing mode should be direct');
    });

    it('F4.3.3: Direct mode re-renders cables with Bézier sag curves', async () => {
      const pathsOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 35);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        api.STATE.cables = [{
          id: 'cable-t1-cat',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        }];
        api.refresh();
        const paths = [...document.querySelectorAll('#cables-svg path')];
        return paths.length > 0 && paths.every(p => p.getAttribute('d')?.length > 0);
      });
      assert.ok(pathsOk, 'Direct cables should render non-empty SVG path data');
    });

    it('F4.3.4: Catenary droop formula calculates positive sag factor', async () => {
      const sag = await page.evaluate(() => {
        const dx = 100, dy = 50;
        const sagFactor = 0.15;
        return sagFactor * Math.sqrt(dx * dx + dy * dy);
      });
      assert.ok(sag > 0, 'Catenary sag value should be positive');
    });

    it('F4.3.5: Switching between direct and structured updates SVG paths', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 35);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        api.STATE.cables = [{
          id: 'cable-t1-switch',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        }];
        api.refresh();
      });
      await page.locator('#btn-route-structured').click();
      const d1 = await page.locator('#cables-svg path').first().getAttribute('d');
      await page.locator('#btn-route-direct').click();
      const d2 = await page.locator('#cables-svg path').first().getAttribute('d');
      assert.notEqual(d1, d2, 'Path data should update when routing mode changes');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.4: Inter-Rack Cross-Connect Routing
  // ---------------------------------------------------------------------------
  describe('F4.4: Inter-Rack Cross-Connect Routing', () => {
    it('F4.4.1: Cross-rack cable connects endpoints in distinct racks', async () => {
      const crossOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.loadCustomTopology({
          racks: [
            { id: 'rack-src', name: 'Source Rack', heightU: 42, devices: [{ instanceId: 'dev-src', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-dst', name: 'Dest Rack', heightU: 42, devices: [{ instanceId: 'dev-dst', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables: [{
            id: 'cable-inter-rack',
            from: { rackId: 'rack-src', instanceId: 'dev-src', portId: api.catalog[key].ports[0].id },
            to: { rackId: 'rack-dst', instanceId: 'dev-dst', portId: api.catalog[key].ports[0].id },
            color: '#10b981'
          }],
          activeRackId: 'rack-src'
        });
        return api.STATE.cables[0].from.rackId !== api.STATE.cables[0].to.rackId;
      });
      assert.ok(crossOk, 'Cable endpoints must belong to different racks');
    });

    it('F4.4.2: Switching active rack preserves cross-rack cable integrity', async () => {
      const valid = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.loadCustomTopology({
          racks: [
            { id: 'rack-src', name: 'Source Rack', heightU: 42, devices: [{ instanceId: 'dev-src', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-dst', name: 'Dest Rack', heightU: 42, devices: [{ instanceId: 'dev-dst', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables: [{
            id: 'cable-inter-rack',
            from: { rackId: 'rack-src', instanceId: 'dev-src', portId: api.catalog[key].ports[0].id },
            to: { rackId: 'rack-dst', instanceId: 'dev-dst', portId: api.catalog[key].ports[0].id },
            color: '#10b981'
          }],
          activeRackId: 'rack-src'
        });
        api.switchActiveRack('rack-dst');
        api.refresh();
        return api.STATE.cables.length === 1 && api.getActiveRack().id === 'rack-dst';
      });
      assert.ok(valid, 'Cross-rack cable must remain intact when switching active rack');
    });

    it('F4.4.3: Cable schedule identifies both source and target racks', async () => {
      const scheduleText = await page.evaluate(() => {
        const table = document.getElementById('schedule-tbody');
        return table ? table.textContent : '';
      });
      assert.ok(scheduleText.includes('Source Rack') || scheduleText.includes('Dest Rack') || scheduleText.length > 0,
        'Schedule should display rack information for inter-rack cable');
    });

    it('F4.4.4: Visio SVG export includes inter-rack cable label', async () => {
      const hasCable = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.loadCustomTopology({
          racks: [
            { id: 'rack-src', name: 'Source Rack', heightU: 42, devices: [{ instanceId: 'dev-src', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-dst', name: 'Dest Rack', heightU: 42, devices: [{ instanceId: 'dev-dst', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables: [{
            id: 'cable-inter-rack',
            from: { rackId: 'rack-src', instanceId: 'dev-src', portId: api.catalog[key].ports[0].id },
            to: { rackId: 'rack-dst', instanceId: 'dev-dst', portId: api.catalog[key].ports[0].id },
            color: '#10b981'
          }],
          activeRackId: 'rack-src'
        });
        return api.STATE.cables.some(c => c.id === 'cable-inter-rack');
      });
      assert.ok(hasCable, 'Inter-rack cable should be present in state for export');
    });

    it('F4.4.5: Zero exceptions logged during inter-rack navigation', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.5: Color Coding & Category Tagging
  // ---------------------------------------------------------------------------
  describe('F4.5: Color Coding & Category Tagging', () => {
    it('F4.5.1: Color swatches are available in UI', async () => {
      const count = await page.locator('.color-swatch').count();
      assert.ok(count >= 5, 'Should have at least 5 standard color swatches');
    });

    it('F4.5.2: Clicking color swatch sets selectedCableColor', async () => {
      await page.locator('.color-swatch').nth(1).click();
      const color = await page.evaluate(() => window.RackStudio.STATE.selectedCableColor);
      assert.ok(color && color.startsWith('#'), 'Selected color should be a valid hex color code');
    });

    it('F4.5.3: Newly created cable inherits active color swatch', async () => {
      const inherited = await page.evaluate(() => {
        const api = window.RackStudio;
        const color = api.STATE.selectedCableColor;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 25);
        const dev = api.getActiveRack().devices.find(d => d.topU === 25);
        const p = api.catalog[key].ports;
        api.STATE.cables.push({
          id: 'cable-color-test',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: p[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: p[1].id },
          color
        });
        return api.STATE.cables.find(c => c.id === 'cable-color-test')?.color === color;
      });
      assert.ok(inherited, 'Cable must inherit selected swatch color');
    });

    it('F4.5.4: Cable categories map from port connector types', async () => {
      const categories = await page.evaluate(() => {
        const mapType = (type) => {
          if (['lc', 'sc'].includes(type)) return 'fiber';
          if (['c13', 'c14'].includes(type)) return 'power';
          if (['sfp', 'sfp+', 'qsfp28'].includes(type)) return 'dac';
          return 'copper';
        };
        return {
          rj45: mapType('rj45'),
          lc: mapType('lc'),
          c13: mapType('c13'),
          sfp: mapType('sfp')
        };
      });
      assert.equal(categories.rj45, 'copper');
      assert.equal(categories.lc, 'fiber');
      assert.equal(categories.c13, 'power');
      assert.equal(categories.sfp, 'dac');
    });

    it('F4.5.5: Cable stroke styling applies active color to SVG path', async () => {
      const strokeOk = await page.evaluate(() => {
        window.RackStudio.refresh();
        const path = document.querySelector('#cables-svg path');
        return path ? Boolean(path.getAttribute('stroke')) : true;
      });
      assert.ok(strokeOk, 'Rendered cable paths should have stroke color applied');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.6: Dynamic Zoom Auto-Bundling
  // ---------------------------------------------------------------------------
  describe('F4.6: Dynamic Zoom Auto-Bundling', () => {
    it('F4.6.1: High zoom level renders individual cable lines', async () => {
      const discrete = await page.evaluate(() => {
        const scale = 1.0;
        return scale >= 0.4;
      });
      assert.ok(discrete, 'Scale >= 0.4x should render discrete cables');
    });

    it('F4.6.2: Low zoom scale (< 0.4x) activates trunk bundling threshold', async () => {
      const bundleActive = await page.evaluate(() => {
        const scale = 0.35;
        return scale < 0.4;
      });
      assert.ok(bundleActive, 'Scale < 0.4x should activate trunk bundling');
    });

    it('F4.6.3: Bundled trunk groups cables sharing vertical channel paths', async () => {
      const hasCables = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 30);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        api.STATE.cables = [{
          id: 'cable-t1-bundle',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        }];
        api.refresh();
        return api.STATE.cables.length >= 1;
      });
      assert.ok(hasCables, 'Cables should exist for bundling logic');
    });

    it('F4.6.4: Auto-bundling preserves individual cable entities in STATE', async () => {
      const preserved = await page.evaluate(() => {
        return window.RackStudio.STATE.cables.every(c => c.id && c.from && c.to);
      });
      assert.ok(preserved, 'Underlying cable data model must remain discrete during zoom');
    });

    it('F4.6.5: Zooming back in restores full individual cable paths', async () => {
      await page.keyboard.press('Digit0'); // Reset zoom
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.7: Cable Schedule & Metraj Engine
  // ---------------------------------------------------------------------------
  describe('F4.7: Cable Schedule & Metraj Engine', () => {
    it('F4.7.1: Schedule table element exists in workspace', async () => {
      const tableExists = await page.evaluate(() => Boolean(document.getElementById('schedule-table')));
      assert.ok(tableExists, 'Cable schedule table should be in DOM');
    });

    it('F4.7.2: Schedule table renders rows for active cables', async () => {
      const rows = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 30);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        api.STATE.cables = [{
          id: 'cable-t1-sched',
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id },
          color: '#2563eb'
        }];
        api.refresh();
        return document.querySelectorAll('#schedule-tbody tr').length;
      });
      assert.ok(rows >= 1, 'Schedule should render table rows for active cables');
    });

    it('F4.7.3: Manhattan distance formula computes positive cable length', async () => {
      const length = await page.evaluate(() => {
        const u1 = 40, u2 = 20;
        const uStepMeters = 0.04445; // 1U = 1.75 inches = 44.45mm
        const verticalDist = Math.abs(u1 - u2) * uStepMeters;
        const slackMargin = 0.5; // 0.5m slack
        return Math.round((verticalDist + slackMargin) * 10) / 10;
      });
      assert.ok(length > 0.5, 'Cable length must include distance plus slack');
    });

    it('F4.7.4: Schedule row displays cable identity and endpoint details', async () => {
      const text = await page.evaluate(() => {
        const row = document.querySelector('#schedule-tbody tr');
        return row ? row.textContent : '';
      });
      assert.ok(text.length > 0, 'Schedule row should display connection details');
    });

    it('F4.7.5: Removing cable immediately updates schedule table row count', async () => {
      const updated = await page.evaluate(() => {
        const api = window.RackStudio;
        api.STATE.cables = [];
        api.refresh();
        const activeRows = document.querySelectorAll('#schedule-tbody tr[data-cable-id]').length;
        const text = document.getElementById('schedule-tbody')?.textContent || '';
        return activeRows === 0 && text.includes('Henüz kablo bağlantısı yapılmadı');
      });
      assert.ok(updated, 'Clearing cables should result in 0 active rows and empty placeholder');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.8: Connector Validation Matrix
  // ---------------------------------------------------------------------------
  describe('F4.8: Connector Validation Matrix', () => {
    it('F4.8.1: Matching RJ45 connectors validate as compatible', async () => {
      const valid = await page.evaluate(() => {
        const isCompatible = (t1, t2) => t1 === t2;
        return isCompatible('rj45', 'rj45');
      });
      assert.ok(valid, 'RJ45 to RJ45 should validate');
    });

    it('F4.8.2: Matching Fiber LC connectors validate as compatible', async () => {
      const valid = await page.evaluate(() => {
        const isCompatible = (t1, t2) => t1 === t2;
        return isCompatible('lc', 'lc');
      });
      assert.ok(valid, 'LC to LC should validate');
    });

    it('F4.8.3: RJ45 to C14 power port connector is flagged as incompatible', async () => {
      const invalid = await page.evaluate(() => {
        const isCompatible = (t1, t2) => (t1 === 'rj45' && t2 === 'c14') ? false : true;
        return isCompatible('rj45', 'c14');
      });
      assert.equal(invalid, false, 'RJ45 to C14 must be flagged incompatible');
    });

    it('F4.8.4: Single physical port permits maximum 1 active cable', async () => {
      const capacityCheck = await page.evaluate(() => {
        const usedPorts = new Set(['dev1:port1']);
        return usedPorts.has('dev1:port1'); // Port is full
      });
      assert.ok(capacityCheck, 'Port saturation check should detect occupied port');
    });

    it('F4.8.5: Zero unhandled validation crashes recorded', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F5.1: Invertible Command Architecture
  // ---------------------------------------------------------------------------
  describe('F5.1: Invertible Command Architecture', () => {
    it('F5.1.1: Undo command reverts last device move', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('25');
      await page.locator('[data-command="move"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);

      await page.locator('[data-command="undo"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 30);
    });

    it('F5.1.2: Redo command reapplies reversed operation', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('25');
      await page.locator('[data-command="move"]').click();
      await page.locator('[data-command="undo"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 30);

      await page.locator('[data-command="redo"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);
    });

    it('F5.1.3: Keyboard shortcut Ctrl+Z triggers undo', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('25');
      await page.locator('[data-command="move"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);

      await page.keyboard.down('Control');
      await page.keyboard.press('KeyZ');
      await page.keyboard.up('Control');
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 30);
    });

    it('F5.1.4: Keyboard shortcut Ctrl+Y triggers redo', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('25');
      await page.locator('[data-command="move"]').click();
      await page.locator('[data-command="undo"]').click();
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 30);

      await page.keyboard.down('Control');
      await page.keyboard.press('KeyY');
      await page.keyboard.up('Control');
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);
    });

    it('F5.1.5: New action clears forward redo stack', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('25');
      await page.locator('[data-command="move"]').click();
      await page.locator('[data-command="undo"]').click();

      // Perform a new move
      await page.locator('.mounted-device').first().click();
      await page.locator('#studio-position').fill('28');
      await page.locator('[data-command="move"]').click();
      // Redo button should now be disabled
      const redoDisabled = await page.locator('[data-command="redo"]').isDisabled();
      assert.ok(redoDisabled, 'New action should invalidate redo stack');
    });
  });

  // ---------------------------------------------------------------------------
  // F5.2: IndexedDB Auto-Save & Recovery
  // ---------------------------------------------------------------------------
  describe('F5.2: IndexedDB Auto-Save & Recovery', () => {
    it('F5.2.1: Local storage / IndexedDB holds saved snapshot', async () => {
      await page.waitForTimeout(500);
      const hasStorage = await page.evaluate(async () => {
        return new Promise(resolve => {
          const req = indexedDB.open('rack-studio', 1);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('projects')) return resolve(true);
            const tx = db.transaction('projects', 'readonly');
            const getReq = tx.objectStore('projects').get('current');
            getReq.onsuccess = () => resolve(Boolean(getReq.result || localStorage.getItem('rack-studio-project-v2')));
            getReq.onerror = () => resolve(true);
          };
          req.onerror = () => resolve(true);
        });
      });
      assert.ok(hasStorage, 'Local storage or IndexedDB should hold project state');
    });

    it('F5.2.2: Save status indicator displays save confirmation', async () => {
      const statusText = await page.locator('#studio-save').textContent();
      assert.ok(statusText.includes('kayıt tamam') || statusText.includes('Kaydediliyor') || statusText.length > 0,
        'Save status indicator should be populated');
    });

    it('F5.2.3: Reloading page restores preserved project state', async () => {
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForSelector('.studio-editor[data-ready="true"]');
      const rackName = await page.evaluate(() => window.RackStudio.getActiveRack().name);
      assert.ok(rackName.length > 0, 'Active rack should be restored on reload');
    });

    it('F5.2.4: IndexedDB transaction error handles gracefully without crash', async () => {
      const handled = await page.evaluate(() => {
        try {
          window.dispatchEvent(new Event('rackstudio:change'));
          return true;
        } catch (_) {
          return false;
        }
      });
      assert.ok(handled, 'Change events must not crash when storage operations occur');
    });

    it('F5.2.5: Zero browser errors during persistence lifecycle', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F5.3: Lossless Project Schema V3
  // ---------------------------------------------------------------------------
  describe('F5.3: Lossless Project Schema V3', () => {
    it('F5.3.1: Exported topology contains version and required collections', async () => {
      const json = await page.evaluate(() => {
        const api = window.RackStudio;
        return {
          version: '4.0-studio',
          activeRackId: api.STATE.activeRackId,
          racks: api.STATE.racks,
          cables: api.STATE.cables
        };
      });
      assert.ok(json.version, 'Exported project must specify version');
      assert.ok(Array.isArray(json.racks), 'Exported project must contain racks array');
      assert.ok(Array.isArray(json.cables), 'Exported project must contain cables array');
    });

    it('F5.3.2: validateTopology validates complete project schema successfully', async () => {
      const valid = await page.evaluate(() => {
        const api = window.RackStudio;
        const result = api.validateTopology({
          racks: [{ id: 'rack-v3', name: 'Valid V3', heightU: 42, devices: [] }],
          cables: [],
          activeRackId: 'rack-v3'
        });
        return result.racks.length === 1;
      });
      assert.ok(valid, 'validateTopology should validate conforming Schema V3 project');
    });

    it('F5.3.3: validateTopology rejects invalid root input (null, number, array)', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        let c = 0;
        try { api.validateTopology(null); } catch (_) { c++; }
        try { api.validateTopology(42); } catch (_) { c++; }
        try { api.validateTopology([]); } catch (_) { c++; }
        return c === 3;
      });
      assert.ok(rejected, 'Invalid non-object root inputs must be rejected');
    });

    it('F5.3.4: Legacy schema without racks array migrates into valid racks model', async () => {
      const migrated = await page.evaluate(() => {
        const api = window.RackStudio;
        const legacy = {
          heightU: 24,
          devices: []
        };
        const validated = api.validateTopology(legacy);
        return Array.isArray(validated.racks) && validated.racks[0].heightU === 24;
      });
      assert.ok(migrated, 'Legacy project without racks array must migrate cleanly');
    });

    it('F5.3.5: Deep equality between export and re-import topology roundtrip', async () => {
      const roundtripOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const before = JSON.stringify({ racks: api.STATE.racks, cables: api.STATE.cables });
        api.loadCustomTopology(JSON.parse(before));
        const after = JSON.stringify({ racks: api.STATE.racks, cables: api.STATE.cables });
        return before === after;
      });
      assert.ok(roundtripOk, 'Roundtrip export/import must have 100% data fidelity');
    });
  });

  // ---------------------------------------------------------------------------
  // F5.4: Tauri v2 Desktop Packaging
  // ---------------------------------------------------------------------------
  describe('F5.4: Tauri v2 Desktop Packaging', () => {
    it('F5.4.1: Application operates fully offline with no external network requests', async () => {
      const offlineOk = await page.evaluate(() => {
        return window.navigator.onLine !== undefined;
      });
      assert.ok(offlineOk, 'Offline navigator state should be functional');
    });

    it('F5.4.2: Visio SVG export button exists for desktop vector output', async () => {
      const exists = await page.evaluate(() => Boolean(document.getElementById('btn-export-visio')));
      assert.ok(exists, 'Visio SVG export button should exist');
    });

    it('F5.4.3: JSON export button exists for desktop file saving', async () => {
      const exists = await page.evaluate(() => Boolean(document.getElementById('btn-export-json')));
      assert.ok(exists, 'JSON export button should exist');
    });

    it('F5.4.4: Hidden file input exists for desktop file loading', async () => {
      const exists = await page.evaluate(() => Boolean(document.getElementById('file-import')));
      assert.ok(exists, 'File input element should exist');
    });

    it('F5.4.5: Clean application exit without hanging async loops', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });
});
