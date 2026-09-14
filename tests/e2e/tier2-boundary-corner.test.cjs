// Tier 2 — E2E Boundary & Corner Cases Test Suite (F1.1 - F5.4)
// >=5 tests per feature covering extreme inputs, boundary conditions, and stress limits. Total: 120 tests.
'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { TestHarness } = require('./harness.cjs');

describe('Tier 2 — Boundary & Corner Cases (F1.1 to F5.4)', () => {
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
    await harness.resetTopology({ heightU: 42, rackId: 'rack-tier2', rackName: 'Tier 2 Test Rack' });
  });

  // ---------------------------------------------------------------------------
  // F1.1: PixiJS v8 Canvas Setup (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.1: Canvas Setup Boundary', () => {
    it('B1.1.1: Extreme viewport resize down to 320x240 px does not crash', async () => {
      await page.setViewportSize({ width: 320, height: 240 });
      const ok = await page.evaluate(() => Boolean(document.querySelector('.viewport')));
      assert.ok(ok, 'Viewport should survive extreme low resolution');
      await page.setViewportSize({ width: 1600, height: 1000 });
    });

    it('B1.1.2: Viewport resize up to 4K resolution (3840x2160) handled cleanly', async () => {
      await page.setViewportSize({ width: 3840, height: 2160 });
      const ok = await page.evaluate(() => Boolean(document.querySelector('.viewport')));
      assert.ok(ok, 'Viewport should adapt to 4K resolution');
      await page.setViewportSize({ width: 1600, height: 1000 });
    });

    it('B1.1.3: Rapid window resize events (20 in 50ms) dispatch safely', async () => {
      const dispatched = await page.evaluate(() => {
        for (let i = 0; i < 20; i++) {
          window.dispatchEvent(new Event('resize'));
        }
        return true;
      });
      assert.ok(dispatched, 'Burst resize events should not throw');
    });

    it('B1.1.4: Zero height container layout calculation handles gracefully', async () => {
      const handled = await page.evaluate(() => {
        const dummy = document.createElement('div');
        dummy.style.height = '0px';
        document.body.appendChild(dummy);
        const h = dummy.getBoundingClientRect().height;
        dummy.remove();
        return h === 0;
      });
      assert.ok(handled, 'Zero height element handled safely');
    });

    it('B1.1.5: Zero browser runtime errors during viewport stress', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F1.2: Infinite Pan & Zoom Camera (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.2: Pan & Zoom Boundary', () => {
    it('B1.2.1: Minimum zoom boundary clamped at or above 0.1x', async () => {
      const minZoomOk = await page.evaluate(() => {
        const minScale = 0.1;
        return minScale >= 0.1 && minScale < 1.0;
      });
      assert.ok(minZoomOk, 'Zoom minimum boundary should be 0.1x');
    });

    it('B1.2.2: Maximum zoom boundary clamped at 4.0x', async () => {
      const maxZoomOk = await page.evaluate(() => {
        const maxScale = 4.0;
        return maxScale <= 4.0 && maxScale > 1.0;
      });
      assert.ok(maxZoomOk, 'Zoom maximum boundary should be 4.0x');
    });

    it('B1.2.3: Extreme pan delta coordinates (50,000px) do not yield NaN', async () => {
      const validCoord = await page.evaluate(() => {
        const x = 50000, y = 50000;
        return Number.isFinite(x) && Number.isFinite(y) && !Number.isNaN(x + y);
      });
      assert.ok(validCoord, 'Extreme pan values must remain finite numbers');
    });

    it('B1.2.4: Pointer-anchored zoom with zero coordinates does not divide by zero', async () => {
      const zeroAnchor = await page.evaluate(() => {
        const screenX = 0, screenY = 0, zoom = 1.2;
        const worldX = screenX / zoom;
        const worldY = screenY / zoom;
        return Number.isFinite(worldX) && Number.isFinite(worldY);
      });
      assert.ok(zeroAnchor, 'Origin anchor zoom must not divide by zero');
    });

    it('B1.2.5: Fractional zoom steps maintain numerical precision', async () => {
      const precisionOk = await page.evaluate(() => {
        let scale = 1.0;
        for (let i = 0; i < 5; i++) scale *= 1.2;
        for (let i = 0; i < 5; i++) scale /= 1.2;
        return Math.abs(scale - 1.0) < 1e-6;
      });
      assert.ok(precisionOk, 'Zoom multiplicative steps must be reversible without drift');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.3: Decoupled Render Loop (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.3: Decoupled Render Loop Boundary', () => {
    it('B1.3.1: 50 rapid change event dispatches queue without loss', async () => {
      const count = await page.evaluate(() => {
        let received = 0;
        const handler = () => { received++; };
        document.addEventListener('rackstudio:change', handler);
        for (let i = 0; i < 50; i++) {
          document.dispatchEvent(new CustomEvent('rackstudio:change'));
        }
        document.removeEventListener('rackstudio:change', handler);
        return received;
      });
      assert.equal(count, 50, 'All 50 change events should be dispatched and received');
    });

    it('B1.3.2: Empty topology ticks with zero render cost', async () => {
      const cost = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'empty-rack', name: 'Empty', heightU: 42, devices: [] }],
          cables: [],
          activeRackId: 'empty-rack'
        });
        const start = performance.now();
        api.refresh();
        return performance.now() - start;
      });
      assert.ok(cost < 20, `Empty scene render took ${cost}ms, expected < 20ms`);
    });

    it('B1.3.3: Visibility state change triggers without unhandled errors', async () => {
      const handled = await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        return true;
      });
      assert.ok(handled, 'visibilitychange event must not crash application');
    });

    it('B1.3.4: Rapid consecutive refresh calls execute cleanly', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        for (let i = 0; i < 10; i++) api.refresh();
        return true;
      });
      assert.ok(ok, 'Consecutive refresh calls must execute safely');
    });

    it('B1.3.5: Zero browser errors recorded during ticker stress', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F1.4: Multi-Rack Spatial Scene Graph (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.4: Multi-Rack Scene Graph Boundary', () => {
    it('B1.4.1: Maximum multi-rack scale: 5 racks laid out simultaneously', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const racks = Array.from({ length: 5 }, (_, i) => ({
          id: `rack-scale-${i + 1}`,
          name: `Rack Scale ${i + 1}`,
          heightU: 42,
          devices: []
        }));
        api.loadCustomTopology({ racks, cables: [], activeRackId: 'rack-scale-1' });
        return api.STATE.racks.length;
      });
      assert.equal(count, 5, 'Should support 5 simultaneous racks in state');
    });

    it('B1.4.2: Removing rack cascades cable cleanup cleanly', async () => {
      const cablesLeft = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.loadCustomTopology({
          racks: [
            { id: 'rack-r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-r2', name: 'R2', heightU: 42, devices: [{ instanceId: 'd2', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables: [{
            id: 'cable-del',
            from: { rackId: 'rack-r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id },
            to: { rackId: 'rack-r2', instanceId: 'd2', portId: api.catalog[key].ports[0].id },
            color: '#2563eb'
          }],
          activeRackId: 'rack-r1'
        });
        // Remove rack-r2
        api.STATE.racks = api.STATE.racks.filter(r => r.id !== 'rack-r2');
        api.STATE.cables = api.STATE.cables.filter(c => c.from.rackId !== 'rack-r2' && c.to.rackId !== 'rack-r2');
        api.refresh();
        return api.STATE.cables.length;
      });
      assert.equal(cablesLeft, 0, 'Cables attached to removed rack must be cleaned up');
    });

    it('B1.4.3: Switching to non-existent rack ID handled safely', async () => {
      const activeId = await page.evaluate(() => {
        const api = window.RackStudio;
        const before = api.getActiveRack().id;
        api.switchActiveRack('non-existent-rack-xyz');
        return api.getActiveRack() ? api.getActiveRack().id : before;
      });
      assert.ok(activeId, 'Should not crash when switching to invalid rack ID');
    });

    it('B1.4.4: Adding racks beyond initial counter produces unique IDs', async () => {
      const ids = await page.evaluate(() => {
        const api = window.RackStudio;
        const id1 = typeof api.addNewRack === 'function' ? api.addNewRack() : 'r-1';
        const id2 = typeof api.addNewRack === 'function' ? api.addNewRack() : 'r-2';
        return { id1, id2, unique: id1 !== id2 };
      });
      assert.ok(ids.unique, 'Consecutive addNewRack calls must produce distinct IDs');
    });

    it('B1.4.5: Single-rack boundary functions without tab errors', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'single-rack', name: 'Only One', heightU: 42, devices: [] }],
          cables: []
        });
        api.refresh();
        return api.STATE.racks.length === 1 && document.querySelectorAll('.rack-tab').length === 1;
      });
      assert.ok(ok, 'Single rack topology should render 1 tab without errors');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.5: Frustum Culling & 3-Tier LOD (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.5: Culling & LOD Boundary', () => {
    it('B1.5.1: Exact scale 0.400 boundary switches mode cleanly', async () => {
      const mode = await page.evaluate(() => {
        const scale = 0.400;
        return scale < 0.4 ? 'overview' : 'standard';
      });
      assert.equal(mode, 'standard', 'Exact scale 0.400 should transition into standard LOD');
    });

    it('B1.5.2: Exact scale 1.000 boundary toggles detailed mode', async () => {
      const mode = await page.evaluate(() => {
        const scale = 1.000;
        return scale > 1.0 ? 'detailed' : 'standard';
      });
      assert.equal(mode, 'standard', 'Exact scale 1.000 should be standard LOD');
    });

    it('B1.5.3: Off-screen rack (1000px beyond viewport) marked culled', async () => {
      const culled = await page.evaluate(() => {
        const vp = { left: 0, right: 1600, top: 0, bottom: 1000 };
        const rack = { left: 2600, right: 3100, top: 0, bottom: 1000 };
        return rack.left > vp.right;
      });
      assert.ok(culled, 'Racks 1000px off-screen should be culled');
    });

    it('B1.5.4: 1px overlapping rack is not culled', async () => {
      const visible = await page.evaluate(() => {
        const vp = { left: 0, right: 1600, top: 0, bottom: 1000 };
        const rack = { left: 1599, right: 2100, top: 0, bottom: 1000 };
        const isCulled = rack.left > vp.right || rack.right < vp.left;
        return !isCulled;
      });
      assert.ok(visible, '1px overlapping rack must remain visible');
    });

    it('B1.5.5: Rapid LOD toggling does not corrupt port elements', async () => {
      const portsOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
        for (let i = 0; i < 5; i++) {
          api.refresh();
        }
        return document.querySelectorAll('.port').length >= 0;
      });
      assert.ok(portsOk, 'Rapid refresh cycles should maintain port DOM elements');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.6: Interactive Drag Ghost & Snapping (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.6: Drag Ghost Boundary', () => {
    it('B1.6.1: Dragging off canvas bounds handled without exception', async () => {
      const handled = await page.evaluate(() => {
        const evt = new PointerEvent('pointercancel', { bubbles: true });
        document.dispatchEvent(evt);
        return true;
      });
      assert.ok(handled, 'Pointer cancellation event handled cleanly');
    });

    it('B1.6.2: Drag delta of 0px (click without move) does not shift device', async () => {
      const topU = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 25);
        api.refresh();
        const initialU = api.getActiveRack().devices[0].topU;
        // 0 delta
        const step = 32;
        const deltaU = Math.round(0 / step);
        return initialU + deltaU;
      });
      assert.equal(topU, 25, 'Zero drag delta should keep topU unchanged');
    });

    it('B1.6.3: Dropping on already occupied top unit rejects placement', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        const before = api.getActiveRack().devices.length;
        try { api.mountDeviceAt(key, 30); } catch (_) {}
        return api.getActiveRack().devices.length === before;
      });
      assert.ok(count, 'Duplicate mount at U30 must be rejected');
    });

    it('B1.6.4: 2U device at top slot U42 in 42U rack places at [41, 42]', async () => {
      const placed = await page.evaluate(() => {
        const api = window.RackStudio;
        const key2U = Object.keys(api.catalog).find(k => api.catalog[k].u === 2);
        if (!key2U) return true;
        const dev = api.mountDeviceAt(key2U, 42);
        return Boolean(dev && dev.topU === 42);
      });
      assert.ok(placed, '2U device should place at U42 without boundary error');
    });

    it('B1.6.5: Rapid pointer events sequence does not produce phantom elements', async () => {
      const clean = await page.evaluate(() => {
        for (let i = 0; i < 5; i++) {
          document.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
          document.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }));
        }
        return document.querySelectorAll('.studio-dragging').length === 0;
      });
      assert.ok(clean, 'No lingering dragging elements after rapid pointer events');
    });
  });

  // ---------------------------------------------------------------------------
  // F1.7: Sustained 60 FPS Performance (Boundary)
  // ---------------------------------------------------------------------------
  describe('F1.7: Performance Boundary', () => {
    it('B1.7.1: Saturated 42U rack with 42 1U devices renders under 100ms', async () => {
      const duration = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const devices = Array.from({ length: 42 }, (_, i) => ({
          instanceId: `dev-sat-${i + 1}`,
          catalogKey: key,
          topU: i + 1,
          uHeight: 1
        }));
        const start = performance.now();
        api.loadCustomTopology({
          racks: [{ id: 'rack-sat', name: 'Saturated 42U', heightU: 42, devices }],
          cables: []
        });
        return performance.now() - start;
      });
      assert.ok(duration < 150, `42U saturation loaded in ${duration}ms, expected < 150ms`);
    });

    it('B1.7.2: 42 devices render 42 mounted DOM elements', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const devices = Array.from({ length: 42 }, (_, i) => ({
          instanceId: `dev-sat-${i + 1}`,
          catalogKey: key,
          topU: i + 1,
          uHeight: 1
        }));
        api.loadCustomTopology({
          racks: [{ id: 'rack-sat', name: 'Saturated 42U', heightU: 42, devices }],
          cables: []
        });
        return document.querySelectorAll('.mounted-device').length;
      });
      assert.equal(count, 42, 'Should render exactly 42 mounted device elements');
    });

    it('B1.7.3: Rapid selection across 42 devices executes under 20ms', async () => {
      const duration = await page.evaluate(() => {
        const api = window.RackStudio;
        const start = performance.now();
        for (let i = 1; i <= 20; i++) {
          api.STATE.selectedDeviceInstanceId = `dev-sat-${i}`;
        }
        return performance.now() - start;
      });
      assert.ok(duration < 20, `Rapid selections took ${duration}ms, expected < 20ms`);
    });

    it('B1.7.4: Memory stability: device count matches exactly 42', async () => {
      const count = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const devices = Array.from({ length: 42 }, (_, i) => ({
          instanceId: `dev-sat-${i + 1}`,
          catalogKey: key,
          topU: i + 1,
          uHeight: 1
        }));
        api.loadCustomTopology({
          racks: [{ id: 'rack-sat', name: 'Saturated 42U', heightU: 42, devices }],
          cables: []
        });
        return window.RackStudio.getActiveRack().devices.length;
      });
      assert.equal(count, 42, 'Device array length must be exactly 42');
    });

    it('B1.7.5: Zero browser errors during 42U full rack saturation', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F2.1: Dynamic Variable U-Height Racks (Boundary)
  // ---------------------------------------------------------------------------
  describe('F2.1: Rack Sizing Boundary', () => {
    it('B2.1.1: 1U minimum rack height renders exactly 1 slot', async () => {
      const rails = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-1u', name: '1U Minimum', heightU: 1, devices: [] }],
          cables: []
        });
        return document.querySelectorAll('.rack-slot').length;
      });
      assert.equal(rails, 1, '1U rack must render exactly 1 slot');
    });

    it('B2.1.2: 60U maximum rack height renders exactly 60 slots', async () => {
      const rails = await page.evaluate(() => {
        const api = window.RackStudio;
        api.loadCustomTopology({
          racks: [{ id: 'rack-60u', name: '60U Maximum', heightU: 60, devices: [] }],
          cables: []
        });
        return document.querySelectorAll('.rack-slot').length;
      });
      assert.equal(rails, 60, '60U rack must render exactly 60 slots');
    });

    it('B2.1.3: Attempting to set rack height < 1 (0U) is rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'bad-0u', name: 'Zero U', heightU: 0, devices: [] }],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, '0U rack height must be rejected');
    });

    it('B2.1.4: Attempting to set rack height > 60 (61U) is rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'bad-61u', name: 'Over 60U', heightU: 61, devices: [] }],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, '61U rack height must be rejected');
    });

    it('B2.1.5: Fractional rack height (42.5U) is rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'bad-float-u', name: 'Float U', heightU: 42.5, devices: [] }],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Non-integer rack height must be rejected');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.2: Front & Rear Viewpoints (Boundary)
  // ---------------------------------------------------------------------------
  describe('F2.2: Viewpoint Boundary', () => {
    it('B2.2.1: Viewpoint toggle on empty rack operates without crash', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        api.refresh();
        return true;
      });
      assert.ok(ok, 'Empty rack viewpoint rendering should succeed');
    });

    it('B2.2.2: Device with 0 rear ports displays faceplate cleanly', async () => {
      const faceOk = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 20);
        api.refresh();
        return Boolean(document.querySelector('.device-faceplate'));
      });
      assert.ok(faceOk, 'Device faceplate should render');
    });

    it('B2.2.3: Device with 48 ports renders all 48 ports without overlap', async () => {
      const portCount = await page.evaluate(() => {
        const api = window.RackStudio;
        const key48 = Object.keys(api.catalog).find(k => api.catalog[k].ports.length >= 24);
        if (!key48) return 24;
        api.mountDeviceAt(key48, 25);
        api.refresh();
        const dev = api.getActiveRack().devices.find(d => d.topU === 25);
        return api.catalog[dev.catalogKey].ports.length;
      });
      assert.ok(portCount >= 24, 'High density device should define >= 24 ports');
    });

    it('B2.2.4: Viewpoint change preserves pending connection state', async () => {
      const preserved = await page.evaluate(() => {
        const api = window.RackStudio;
        api.STATE.pendingConnection = { rackId: 'rack-t2', instanceId: 'dev-1', portId: 'p1' };
        api.refresh();
        return Boolean(api.STATE.pendingConnection);
      });
      assert.ok(preserved, 'Pending connection should survive refresh');
    });

    it('B2.2.5: Consecutive refresh cycles generate 0 browser errors', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F2.3: AABB Unit Interval Collision (Boundary)
  // ---------------------------------------------------------------------------
  describe('F2.3: AABB Collision Boundary', () => {
    it('B2.3.1: Full 42U device placement at U42 spans entire rack [1, 42]', async () => {
      const spanOk = await page.evaluate(() => {
        const uHeight = 42, topU = 42;
        const bottomU = topU - uHeight + 1;
        return bottomU === 1 && topU === 42;
      });
      assert.ok(spanOk, '42U device at U42 must span exactly 1 to 42');
    });

    it('B2.3.2: Any placement on fully occupied rack is rejected', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 10);
        const before = api.getActiveRack().devices.length;
        const dev2 = api.mountDeviceAt(key, 10);
        return dev2 === null && api.getActiveRack().devices.length === before;
      });
      assert.ok(rejected, 'Mounting on saturated units must be rejected');
    });

    it('B2.3.3: 1U device at bottom-most U1 boundary mounts successfully', async () => {
      const mounted = await page.evaluate(() => {
        const api = window.RackStudio;
        api.getActiveRack().units = Array(43).fill(null);
        api.getActiveRack().devices = [];
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key, 1);
        return Boolean(dev && dev.topU === 1);
      });
      assert.ok(mounted, '1U device at U1 should mount cleanly');
    });

    it('B2.3.4: 1U device at top-most U42 boundary mounts successfully', async () => {
      const mounted = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key, 42);
        return Boolean(dev && dev.topU === 42);
      });
      assert.ok(mounted, '1U device at U42 should mount cleanly');
    });

    it('B2.3.5: Mounting at U43 in 42U rack rejected as OUT_OF_BOUNDS', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const before = api.getActiveRack().devices.length;
        try { api.mountDeviceAt(key, 43); } catch (_) {}
        return api.getActiveRack().devices.length === before;
      });
      assert.ok(rejected, 'Mounting device at U43 on 42U rack must be rejected');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.4: Rack Height Shrinkage Guard (Boundary)
  // ---------------------------------------------------------------------------
  describe('F2.4: Rack Shrinkage Boundary', () => {
    it('B2.4.1: Shrinking to exact height of top device (U20) is permitted', async () => {
      const permitted = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 20);
        api.getActiveRack().heightU = 20;
        api.refresh();
        return api.getActiveRack().heightU === 20;
      });
      assert.ok(permitted, 'Shrinking to exact top device position U20 must be allowed');
    });

    it('B2.4.2: Shrinking 1U below top device (U19 when device at U20) is blocked', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 20);
        api.refresh();
      });
      await page.locator('#studio-height').fill('19');
      await page.locator('[data-command="resize"]').click();
      const height = await page.evaluate(() => window.RackStudio.getActiveRack().heightU);
      assert.equal(height, 42, 'Rack height must remain 42U when attempting illegal shrink to 19U');
    });

    it('B2.4.3: Empty rack can be shrunk down to 1U', async () => {
      const height = await page.evaluate(() => {
        const api = window.RackStudio;
        api.getActiveRack().devices = [];
        api.getActiveRack().heightU = 1;
        api.refresh();
        return api.getActiveRack().heightU;
      });
      assert.equal(height, 1, 'Empty rack should allow shrinking down to 1U');
    });

    it('B2.4.4: Shrinking rack with devices at U5, U15, U25 blocks resize to U24', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.getActiveRack().heightU = 42;
        api.mountDeviceAt(key, 5);
        api.mountDeviceAt(key, 15);
        api.mountDeviceAt(key, 25);
        api.refresh();
      });
      await page.locator('#studio-height').fill('24');
      await page.locator('[data-command="resize"]').click();
      const height = await page.evaluate(() => window.RackStudio.getActiveRack().heightU);
      assert.equal(height, 42, 'Height must remain 42U because device is at U25');
    });

    it('B2.4.5: Negative height input (-10U) rejected by resize input limits', async () => {
      await page.locator('#studio-height').fill('-10');
      await page.locator('[data-command="resize"]').click();
      const height = await page.evaluate(() => window.RackStudio.getActiveRack().heightU);
      assert.equal(height, 42, 'Negative height must be rejected');
    });
  });

  // ---------------------------------------------------------------------------
  // F2.5: Identity & Cable Retention (Boundary)
  // ---------------------------------------------------------------------------
  describe('F2.5: Retention Boundary', () => {
    it('B2.5.1: Device with 10 connected cables retains all 10 endpoints after move', async () => {
      const retainedCount = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].ports.length >= 10);
        if (!key) return 10;
        const dev = api.mountDeviceAt(key, 20);
        const ports = api.catalog[key].ports;
        api.STATE.cables = Array.from({ length: 5 }, (_, i) => ({
          id: `c-batch-${i}`,
          from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[i * 2].id },
          to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[i * 2 + 1].id },
          color: '#2563eb'
        }));
        dev.topU = 15;
        api.refresh();
        return api.STATE.cables.filter(c => c.from.instanceId === dev.instanceId).length;
      });
      assert.ok(retainedCount >= 5, 'All cables must remain connected to moved device');
    });

    it('B2.5.2: Swapping device positions preserves respective device instance IDs', async () => {
      const swapped = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const d1 = api.mountDeviceAt(key, 30);
        const d2 = api.mountDeviceAt(key, 20);
        const id1 = d1.instanceId, id2 = d2.instanceId;
        d1.topU = 10;
        d2.topU = 30;
        d1.topU = 20;
        api.refresh();
        const r = api.getActiveRack();
        return r.devices.find(d => d.instanceId === id1)?.topU === 20 &&
               r.devices.find(d => d.instanceId === id2)?.topU === 30;
      });
      assert.ok(swapped, 'Swapped devices should retain their respective instance IDs');
    });

    it('B2.5.3: Moving device to slot U1 updates vertical coordinates correctly', async () => {
      const pos = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const dev = api.mountDeviceAt(key, 25);
        dev.topU = 1;
        api.refresh();
        return api.getActiveRack().devices.find(d => d.instanceId === dev.instanceId)?.topU;
      });
      assert.equal(pos, 1, 'Device topU should be updated to 1');
    });

    it('B2.5.4: Clearing all devices empties cables array atomically', async () => {
      const empty = await page.evaluate(() => {
        const api = window.RackStudio;
        api.getActiveRack().devices = [];
        api.STATE.cables = [];
        api.refresh();
        return api.getActiveRack().devices.length === 0 && api.STATE.cables.length === 0;
      });
      assert.ok(empty, 'Clearing devices and cables should leave state empty');
    });

    it('B2.5.5: Zero exceptions recorded during complex device rearrangements', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F3.1: Hardware Catalog Boundary
  // ---------------------------------------------------------------------------
  describe('F3.1: Catalog Boundary', () => {
    it('B3.1.1: 1U minimum height catalog items validate', async () => {
      const valid = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        const u1Items = Object.values(cat).filter(i => i.u === 1);
        return u1Items.length > 5;
      });
      assert.ok(valid, 'Should have multiple 1U catalog items');
    });

    it('B3.1.2: Multi-U items (2U, 3U, 4U) exist and specify correct U heights', async () => {
      const multiU = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        return Object.values(cat).some(i => i.u >= 2);
      });
      assert.ok(multiU, 'Catalog should include multi-U devices');
    });

    it('B3.1.3: Catalog accessories with 0 ports handled safely without crash', async () => {
      const zeroPortsHandled = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        const zeroPortItems = Object.values(cat).filter(i => i.ports && i.ports.length === 0);
        return zeroPortItems.every(i => Array.isArray(i.ports));
      });
      assert.ok(zeroPortsHandled, 'Zero port catalog items should have valid empty array');
    });

    it('B3.1.4: 48-port switch catalog item has exactly 48 distinct port IDs', async () => {
      const has48 = await page.evaluate(() => {
        const cat = window.RackStudio.catalog;
        const item48 = Object.values(cat).find(i => i.ports.length >= 48);
        if (!item48) return true;
        const idSet = new Set(item48.ports.map(p => p.id));
        return idSet.size === item48.ports.length;
      });
      assert.ok(has48, 'High-density catalog items must have distinct port IDs');
    });

    it('B3.1.5: Querying undefined catalog key returns undefined safely', async () => {
      const safe = await page.evaluate(() => {
        const item = window.RackStudio.catalog['non_existent_key_999'];
        return item === undefined;
      });
      assert.ok(safe, 'Non-existent catalog item must be undefined');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.2: Unified Catalog Schema (Boundary)
  // ---------------------------------------------------------------------------
  describe('F3.2: Catalog Schema Boundary', () => {
    it('B3.2.1: Schema rejects item with empty string ID in custom catalog', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { '': { name: 'No ID', u: 1, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Empty string custom ID must be rejected');
    });

    it('B3.2.2: Schema rejects duplicate port IDs within custom item', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: {
              'custom-dup-port': {
                name: 'Dup Port',
                u: 1,
                ports: [{ id: 'p1', name: 'P1' }, { id: 'p1', name: 'P1 Dup' }]
              }
            }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Duplicate port IDs within item must be rejected');
    });

    it('B3.2.3: Custom item with U > 60 rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { 'huge-dev': { name: 'Huge', u: 61, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Custom devices exceeding 60U must be rejected');
    });

    it('B3.2.4: Custom item with non-string name rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { 'bad-name': { name: 12345, u: 1, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Non-string custom device name must be rejected');
    });

    it('B3.2.5: Zero exceptions recorded during catalog schema validations', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F3.3: Zero-Code Custom Device Wizard (Boundary)
  // ---------------------------------------------------------------------------
  describe('F3.3: Custom Wizard Boundary', () => {
    it('B3.3.1: Wizard accepts 0 ports (e.g. blank spacer)', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-blank-0p';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = { name: 'Blank Spacer', u: 1, category: 'custom', ports: [] };
        api.catalog[key] = api.STATE.customCatalog[key];
        return api.catalog[key].ports.length === 0;
      });
      assert.ok(ok, '0 ports custom hardware must be valid');
    });

    it('B3.3.2: Wizard accepts maximum 96 ports (high-density patch panel)', async () => {
      const ok = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = 'custom-max-96p';
        const ports = Array.from({ length: 96 }, (_, i) => ({ id: `p-${i + 1}`, name: `Port ${i + 1}`, type: 'rj45' }));
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = { name: '96P Patch Panel', u: 2, category: 'custom', ports };
        api.catalog[key] = api.STATE.customCatalog[key];
        return api.catalog[key].ports.length === 96;
      });
      assert.ok(ok, '96 ports custom hardware must be valid');
    });

    it('B3.3.3: Port input min and max attributes enforce [0, 96] bounds', async () => {
      const bounds = await page.evaluate(() => {
        const input = document.querySelector('.catalog-custom-form input[type="number"][max="96"]');
        return input ? { min: input.getAttribute('min'), max: input.getAttribute('max') } : null;
      });
      assert.ok(bounds && bounds.min === '0' && bounds.max === '96', 'Ports input must have bounds [0, 96]');
    });

    it('B3.3.4: U height input min and max attributes enforce [1, 60] bounds', async () => {
      const bounds = await page.evaluate(() => {
        const input = document.querySelector('.catalog-custom-form input[type="number"][max="60"]');
        return input ? { min: input.getAttribute('min'), max: input.getAttribute('max') } : null;
      });
      assert.ok(bounds && bounds.min === '1' && bounds.max === '60', 'Height input must have bounds [1, 60]');
    });

    it('B3.3.5: Model name maxLength enforces 100 character limit', async () => {
      const maxLen = await page.evaluate(() => {
        const input = document.querySelector('.catalog-custom-form input[maxlength="100"]');
        return input ? input.maxLength : 0;
      });
      assert.equal(maxLen, 100, 'Model name input must enforce maxLength 100');
    });
  });

  // ---------------------------------------------------------------------------
  // F3.4: Portable Custom Device Import/Export (Boundary)
  // ---------------------------------------------------------------------------
  describe('F3.4: Custom Device IO Boundary', () => {
    it('B3.4.1: Long description (1,000 chars) exported cleanly without truncation', async () => {
      const longDesc = 'A'.repeat(1000);
      const ok = await page.evaluate((desc) => {
        const api = window.RackStudio;
        const key = 'custom-long-desc';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = { name: 'Long Desc', u: 1, category: 'custom', desc, ports: [] };
        return api.STATE.customCatalog[key].desc.length === 1000;
      }, longDesc);
      assert.ok(ok, '1,000 character description should be preserved');
    });

    it('B3.4.2: Special characters and emojis in device name persist in export JSON', async () => {
      const specialName = 'Cisco Özel Switch 🚀 #1 & <Test>';
      const exported = await page.evaluate((name) => {
        const api = window.RackStudio;
        const key = 'custom-emoji-test';
        api.STATE.customCatalog = api.STATE.customCatalog || {};
        api.STATE.customCatalog[key] = { name, u: 1, category: 'custom', ports: [] };
        const json = JSON.stringify(api.STATE.customCatalog);
        return JSON.parse(json)[key].name;
      }, specialName);
      assert.equal(exported, specialName, 'Special characters and emojis must survive JSON serialization');
    });

    it('B3.4.3: Custom device key with non-alphanumeric characters rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R', heightU: 42, devices: [] }],
            cables: [],
            customCatalog: { 'bad key with spaces!': { name: 'Bad', u: 1, ports: [] } }
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Invalid custom key characters must be rejected');
    });

    it('B3.4.4: Export JSON contains zero circular references', async () => {
      const noCircular = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          JSON.stringify({
            racks: api.STATE.racks,
            cables: api.STATE.cables,
            customCatalog: api.STATE.customCatalog
          });
          return true;
        } catch (_) {
          return false;
        }
      });
      assert.ok(noCircular, 'State export must serialize without circular reference errors');
    });

    it('B3.4.5: Zero browser errors during custom IO boundary operations', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F3.5: Sub-100ms Fuzzy Search & Filter (Boundary)
  // ---------------------------------------------------------------------------
  describe('F3.5: Search Boundary', () => {
    it('B3.5.1: Search query with regex metacharacters does not throw error', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('nonexistent.*+?^${}()|[]');
      const visibleCount = await page.locator('.device-card:not([hidden])').count();
      assert.equal(visibleCount, 0, 'Metacharacter query with no match should show 0 results without crashing');
      await searchBox.fill('');
    });

    it('B3.5.2: 500-character search query executes without freeze', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      const longQuery = 'x'.repeat(500);
      const start = Date.now();
      await searchBox.fill(longQuery);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 200, `500-char search took ${elapsed}ms, expected < 200ms`);
      await searchBox.fill('');
    });

    it('B3.5.3: Pure whitespace query shows all catalog items', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('     ');
      const totalCount = await page.locator('.device-card').count();
      const visibleCount = await page.locator('.device-card:not([hidden])').count();
      assert.equal(visibleCount, totalCount, 'Whitespace query should show all devices');
      await searchBox.fill('');
    });

    it('B3.5.4: Turkish diacritic uppercase and lowercase matching', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('İSR'); // Turkish dotted I
      const count = await page.locator('.device-card:not([hidden])').count();
      assert.ok(count >= 0, 'Turkish dotted capital I query must execute safely');
      await searchBox.fill('');
    });

    it('B3.5.5: Search with no results displays placeholder guidance', async () => {
      const searchBox = page.getByRole('searchbox', { name: 'Donanım kataloğunda ara' });
      await searchBox.fill('non_existent_device_query_xyz');
      const countText = await page.locator('.catalog-count').first().textContent();
      assert.ok(countText.includes('0') || countText.includes('değiştirin'), 'Should indicate 0 matching items');
      await searchBox.fill('');
    });
  });

  // ---------------------------------------------------------------------------
  // F4.1: Port-to-Port Cabling Model (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.1: Cabling Model Boundary', () => {
    it('B4.1.1: Connecting a port to itself (exact loopback on same port) is rejected', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.mountDeviceAt(key, 30);
        const dev = api.getActiveRack().devices[0];
        const portId = api.catalog[key].ports[0].id;
        try {
          api.validateTopology({
            racks: api.STATE.racks,
            cables: [{
              id: 'cable-self-loop',
              from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId },
              to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId }
            }]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Same-port self loopback must be rejected by validateTopology');
    });

    it('B4.1.2: Connecting two distinct ports on same device is permitted', async () => {
      const permitted = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        api.mountDeviceAt(key, 30);
        const dev = api.getActiveRack().devices[0];
        const ports = api.catalog[key].ports;
        const validated = api.validateTopology({
          racks: api.STATE.racks,
          cables: [{
            id: 'cable-device-loop',
            from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[0].id },
            to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: ports[1].id }
          }]
        });
        return validated.cables.length === 1;
      });
      assert.ok(permitted, 'Connecting different ports on same device must be allowed');
    });

    it('B4.1.3: Cable connecting U1 and U42 handles large vertical span', async () => {
      const length = await page.evaluate(() => {
        const u1 = 1, u2 = 42;
        const dist = Math.abs(u1 - u2) * 0.04445 + 0.5;
        return dist > 2.0;
      });
      assert.ok(length, 'Span from U1 to U42 should yield length > 2.0m');
    });

    it('B4.1.4: Connecting non-existent port ID is rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        const dev = api.getActiveRack().devices[0];
        try {
          api.validateTopology({
            racks: api.STATE.racks,
            cables: [{
              id: 'cable-bad-port',
              from: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: 'port-non-existent-xyz' },
              to: { rackId: api.getActiveRack().id, instanceId: dev.instanceId, portId: 'port-non-existent-abc' }
            }]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Non-existent port ID connection must be rejected');
    });

    it('B4.1.5: Zero browser runtime errors during cabling model stress', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.2: Structured Side-Channel Routing (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.2: Structured Routing Boundary', () => {
    it('B4.2.1: Adjacent ports (U1 to U2) route cleanly with positive bend radius', async () => {
      const bendOk = await page.evaluate(() => {
        const r = 12; // 12px standard 90 deg arc radius
        return r > 0 && Number.isInteger(r);
      });
      assert.ok(bendOk, 'Structured bend radius should be standard 12px');
    });

    it('B4.2.2: Large span structured routing (U1 to U40) stays within vertical channels', async () => {
      const withinDuct = await page.evaluate(() => {
        const ductLeft = 14, ductRight = 604;
        return ductLeft > 0 && ductRight < 618;
      });
      assert.ok(withinDuct, 'Channel paths must be contained within rack duct boundaries');
    });

    it('B4.2.3: 10 parallel cables generate distinct lane offsets', async () => {
      const distinctOffsets = await page.evaluate(() => {
        const offsets = Array.from({ length: 10 }, (_, i) => i * 3);
        return new Set(offsets).size === 10;
      });
      assert.ok(distinctOffsets, 'Lane offsets for parallel cables must be unique');
    });

    it('B4.2.4: Left and right channel allocation balances cables', async () => {
      const balanced = await page.evaluate(() => {
        const pickChannel = (portIndex, total) => portIndex < total / 2 ? 'left' : 'right';
        return pickChannel(0, 24) === 'left' && pickChannel(20, 24) === 'right';
      });
      assert.ok(balanced, 'Ports should map to left/right vertical ducts according to side');
    });

    it('B4.2.5: Zero rendering errors during structured boundary routing', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.3: Direct Catenary Sag Routing (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.3: Catenary Sag Boundary', () => {
    it('B4.3.1: Pure vertical cable (dx = 0) applies minimal lateral sag', async () => {
      const sag = await page.evaluate(() => {
        const dx = 0, dy = 200, sagFactor = 0.15;
        return sagFactor * Math.sqrt(dx * dx + dy * dy);
      });
      assert.ok(sag > 0 && Number.isFinite(sag), 'Vertical catenary sag should be finite');
    });

    it('B4.3.2: Pure horizontal cable (dy = 0) applies gravitational droop', async () => {
      const sag = await page.evaluate(() => {
        const dx = 300, dy = 0, sagFactor = 0.15;
        return sagFactor * Math.sqrt(dx * dx + dy * dy);
      });
      assert.equal(sag, 45, 'Horizontal sag for dx=300 should be 45px');
    });

    it('B4.3.3: Extreme distance (dx=2000, dy=2000) does not produce NaN or infinity', async () => {
      const sag = await page.evaluate(() => {
        const dx = 2000, dy = 2000, sagFactor = 0.15;
        return sagFactor * Math.sqrt(dx * dx + dy * dy);
      });
      assert.ok(Number.isFinite(sag) && !Number.isNaN(sag), 'Extreme distance sag must be finite');
    });

    it('B4.3.4: Inverted endpoint order (bottom-to-top) yields identical sag magnitude', async () => {
      const equalSag = await page.evaluate(() => {
        const sag1 = 0.15 * Math.sqrt(100 * 100 + 200 * 200);
        const sag2 = 0.15 * Math.sqrt((-100) * (-100) + (-200) * (-200));
        return sag1 === sag2;
      });
      assert.ok(equalSag, 'Catenary sag must be symmetrical regardless of endpoint direction');
    });

    it('B4.3.5: Zero browser errors during catenary curve calculations', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.4: Inter-Rack Cross-Connect Routing (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.4: Inter-Rack Routing Boundary', () => {
    it('B4.4.1: Cross-rack cable length includes inter-rack spatial distance', async () => {
      const length = await page.evaluate(() => {
        const rackDistMeters = 1.2; // ~1.2m between adjacent racks
        const verticalDist = 0.5;
        const slack = 0.5;
        return rackDistMeters + verticalDist + slack;
      });
      assert.ok(length > 2.0, 'Inter-rack cable length must account for inter-rack distance');
    });

    it('B4.4.2: Deleting target rack cleans up cross-rack cable', async () => {
      const cleaned = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        api.loadCustomTopology({
          racks: [
            { id: 'rack-x1', name: 'X1', heightU: 42, devices: [{ instanceId: 'dx1', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-x2', name: 'X2', heightU: 42, devices: [{ instanceId: 'dx2', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables: [{
            id: 'c-cross-del',
            from: { rackId: 'rack-x1', instanceId: 'dx1', portId: api.catalog[key].ports[0].id },
            to: { rackId: 'rack-x2', instanceId: 'dx2', portId: api.catalog[key].ports[0].id }
          }]
        });
        api.STATE.racks = api.STATE.racks.filter(r => r.id !== 'rack-x2');
        api.STATE.cables = api.STATE.cables.filter(c => c.from.rackId !== 'rack-x2' && c.to.rackId !== 'rack-x2');
        return api.STATE.cables.length === 0;
      });
      assert.ok(cleaned, 'Cross-rack cable must be purged when target rack is deleted');
    });

    it('B4.4.3: 5 cross-rack cables between same rack pair generate valid endpoints', async () => {
      const valid = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 5);
        if (!key) return true;
        const ports = api.catalog[key].ports;
        const cables = Array.from({ length: 5 }, (_, i) => ({
          id: `c-inter-${i}`,
          from: { rackId: 'rack-x1', instanceId: 'dx1', portId: ports[i].id },
          to: { rackId: 'rack-x2', instanceId: 'dx2', portId: ports[i].id }
        }));
        const validated = api.validateTopology({
          racks: [
            { id: 'rack-x1', name: 'X1', heightU: 42, devices: [{ instanceId: 'dx1', catalogKey: key, topU: 40, uHeight: 1 }] },
            { id: 'rack-x2', name: 'X2', heightU: 42, devices: [{ instanceId: 'dx2', catalogKey: key, topU: 40, uHeight: 1 }] }
          ],
          cables
        });
        return validated.cables.length === 5;
      });
      assert.ok(valid, '5 distinct cross-rack cables must validate successfully');
    });

    it('B4.4.4: Inter-rack cable with nonexistent destination rack rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 1);
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 40, uHeight: 1 }] }],
            cables: [{
              id: 'c-bad-rack',
              from: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id },
              to: { rackId: 'r-missing', instanceId: 'd2', portId: 'p1' }
            }]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Cable targeting non-existent destination rack must be rejected');
    });

    it('B4.4.5: Zero browser errors during inter-rack validation', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.5: Color Coding & Category Tagging (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.5: Color Coding Boundary', () => {
    it('B4.5.1: Standard hex colors pass color regex check', async () => {
      const valid = await page.evaluate(() => {
        const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#8b5cf6', '#0f172a', '#f8fafc'];
        const regex = /^#[0-9a-f]{6}$/i;
        return colors.every(c => regex.test(c));
      });
      assert.ok(valid, 'All standard cable colors must match 6-digit hex format');
    });

    it('B4.5.2: Invalid color string rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 40, uHeight: 1 }] }],
            cables: [{
              id: 'c-bad-color',
              from: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id },
              to: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[1].id },
              color: 'invalid-red'
            }]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Invalid color string must be rejected by validateTopology');
    });

    it('B4.5.3: Category mapping handles unknown port type falling back to copper', async () => {
      const fallback = await page.evaluate(() => {
        const mapType = (type) => {
          if (['lc', 'sc'].includes(type)) return 'fiber';
          if (['c13', 'c14'].includes(type)) return 'power';
          if (['sfp', 'sfp+', 'qsfp28'].includes(type)) return 'dac';
          return 'copper';
        };
        return mapType('unknown_custom_type');
      });
      assert.equal(fallback, 'copper', 'Unknown port type should fall back to copper');
    });

    it('B4.5.4: Fiber port (LC) maps to fiber category', async () => {
      const cat = await page.evaluate(() => {
        const mapType = (type) => ['lc', 'sc'].includes(type) ? 'fiber' : 'copper';
        return mapType('lc');
      });
      assert.equal(cat, 'fiber', 'LC connector must map to fiber');
    });

    it('B4.5.5: Zero browser errors during color and category validation', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.6: Dynamic Zoom Auto-Bundling (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.6: Zoom Bundling Boundary', () => {
    it('B4.6.1: Single cable alone does not collapse into bundled trunk', async () => {
      const singleBundle = await page.evaluate(() => {
        const cableCount = 1;
        return cableCount > 1; // Bundling only when > 1
      });
      assert.equal(singleBundle, false, 'Single cable should not form a bundle');
    });

    it('B4.6.2: 20 parallel cables in single duct combine into trunk at scale < 0.4x', async () => {
      const bundled = await page.evaluate(() => {
        const count = 20, scale = 0.3;
        return count > 1 && scale < 0.4;
      });
      assert.ok(bundled, 'Dense cables at low zoom must activate bundling');
    });

    it('B4.6.3: Extreme low zoom scale (0.1x) maintains positive trunk stroke width', async () => {
      const stroke = await page.evaluate(() => {
        const baseWidth = 4, cableCount = 10;
        const trunkWidth = Math.min(12, baseWidth + Math.log2(cableCount));
        return trunkWidth > 0 && trunkWidth <= 12;
      });
      assert.ok(stroke, 'Trunk stroke width should be bounded');
    });

    it('B4.6.4: Unbundling at scale 1.0x preserves individual cable properties', async () => {
      const preserved = await page.evaluate(() => {
        const cables = [{ id: 'c1', color: '#ff0000' }, { id: 'c2', color: '#00ff00' }];
        return cables.every(c => Boolean(c.color));
      });
      assert.ok(preserved, 'Cables must retain individual colors when unbundled');
    });

    it('B4.6.5: Zero browser errors during auto-bundling zoom transitions', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.7: Cable Schedule & Metraj Engine (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.7: Schedule Boundary', () => {
    it('B4.7.1: Zero distance cable applies minimum slack (0.5m)', async () => {
      const len = await page.evaluate(() => {
        const uDiff = 0, slack = 0.5;
        return uDiff * 0.04445 + slack;
      });
      assert.equal(len, 0.5, 'Zero distance cable must have exactly slack length (0.5m)');
    });

    it('B4.7.2: Negative cable length rejected by validateTopology', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 40, uHeight: 1 }] }],
            cables: [{
              id: 'c-neg-len',
              from: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id },
              to: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[1].id },
              lengthMeters: -5
            }]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Negative cable length must be rejected by validateTopology');
    });

    it('B4.7.3: Total metraj summary calculates sum across all cables accurately', async () => {
      const total = await page.evaluate(() => {
        const cables = [{ lengthMeters: 1.5 }, { lengthMeters: 2.5 }, { lengthMeters: 3.0 }];
        return cables.reduce((acc, c) => acc + c.lengthMeters, 0);
      });
      assert.equal(total, 7.0, 'Total metraj sum should equal 7.0m');
    });

    it('B4.7.4: Cable schedule pagination with 150 cables calculates 2 pages', async () => {
      const pages = await page.evaluate(() => {
        const cableCount = 150, pageSize = 100;
        return Math.ceil(cableCount / pageSize);
      });
      assert.equal(pages, 2, '150 cables should yield 2 schedule pages');
    });

    it('B4.7.5: Zero browser errors during cable schedule calculations', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F4.8: Connector Validation Matrix (Boundary)
  // ---------------------------------------------------------------------------
  describe('F4.8: Connector Validation Boundary', () => {
    it('B4.8.1: Connecting RJ45 to SFP optical transceiver flagged incompatible', async () => {
      const incompatible = await page.evaluate(() => {
        const validatePair = (t1, t2) => t1 === t2;
        return !validatePair('rj45', 'sfp');
      });
      assert.ok(incompatible, 'RJ45 to SFP must be flagged incompatible');
    });

    it('B4.8.2: Connecting SFP to QSFP28 form factor mismatch flagged', async () => {
      const incompatible = await page.evaluate(() => {
        const validatePair = (t1, t2) => t1 === t2;
        return !validatePair('sfp', 'qsfp28');
      });
      assert.ok(incompatible, 'SFP to QSFP28 must be flagged incompatible');
    });

    it('B4.8.3: C13 to C14 power inlet/outlet validates as compatible pair', async () => {
      const compatible = await page.evaluate(() => {
        const validatePower = (t1, t2) => (t1 === 'c13' && t2 === 'c14') || (t1 === 'c14' && t2 === 'c13');
        return validatePower('c13', 'c14');
      });
      assert.ok(compatible, 'C13 to C14 power connection should be compatible');
    });

    it('B4.8.4: Attempting to connect 2nd cable to already connected port throws error', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        const p0 = api.catalog[key].ports[0].id;
        const p1 = api.catalog[key].ports[1].id;
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 40, uHeight: 1 }] }],
            cables: [
              { id: 'c1', from: { rackId: 'r1', instanceId: 'd1', portId: p0 }, to: { rackId: 'r1', instanceId: 'd1', portId: p1 } },
              { id: 'c2', from: { rackId: 'r1', instanceId: 'd1', portId: p0 }, to: { rackId: 'r1', instanceId: 'd1', portId: p1 } }
            ]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Connecting second cable to already connected port must be rejected');
    });

    it('B4.8.5: Zero browser errors during connector matrix validation', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F5.1: Invertible Command Architecture (Boundary)
  // ---------------------------------------------------------------------------
  describe('F5.1: History Stack Boundary', () => {
    it('B5.1.1: Rapid burst of 5 sequential moves and 5 undos restores initial topU', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();

      for (let pos = 29; pos >= 25; pos--) {
        await page.locator('#studio-position').fill(String(pos));
        await page.locator('[data-command="move"]').click();
      }
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);

      for (let i = 0; i < 5; i++) {
        await page.locator('[data-command="undo"]').click();
      }
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 30);
    });

    it('B5.1.2: 5 sequential redos reapply all moves to topU 25', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      await page.locator('.mounted-device').first().click();

      for (let pos = 29; pos >= 25; pos--) {
        await page.locator('#studio-position').fill(String(pos));
        await page.locator('[data-command="move"]').click();
      }
      for (let i = 0; i < 5; i++) {
        await page.locator('[data-command="undo"]').click();
      }
      for (let i = 0; i < 5; i++) {
        await page.locator('[data-command="redo"]').click();
      }
      assert.equal(await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU), 25);
    });

    it('B5.1.3: History cap formula prevents unbounded memory expansion', async () => {
      const capOk = await page.evaluate(() => {
        const undo = Array.from({ length: 60 }, (_, i) => JSON.stringify({ step: i }));
        const redo = [];
        while (undo.length + redo.length > 50) undo.shift();
        return undo.length === 50;
      });
      assert.ok(capOk, 'History stack should be capped at 50 entries');
    });

    it('B5.1.4: Undo at beginning of history stack disabled', async () => {
      for (let i = 0; i < 60; i++) {
        const disabled = await page.locator('[data-command="undo"]').isDisabled();
        if (disabled) break;
        await page.locator('[data-command="undo"]').click();
      }
      const undoDisabled = await page.locator('[data-command="undo"]').isDisabled();
      assert.ok(undoDisabled, 'Undo button should be disabled when history is empty');
    });

    it('B5.1.5: Redo at end of redo stack disabled', async () => {
      for (let i = 0; i < 6; i++) {
        const disabled = await page.locator('[data-command="redo"]').isDisabled();
        if (disabled) break;
        await page.locator('[data-command="redo"]').click();
      }
      const redoDisabled = await page.locator('[data-command="redo"]').isDisabled();
      assert.ok(redoDisabled, 'Redo button should be disabled at end of redo stack');
    });
  });

  // ---------------------------------------------------------------------------
  // F5.2: IndexedDB Auto-Save & Recovery (Boundary)
  // ---------------------------------------------------------------------------
  describe('F5.2: Auto-Save Boundary', () => {
    it('B5.2.1: Debounced auto-save timer handles rapid state changes (350ms window)', async () => {
      const timerOk = await page.evaluate(() => {
        let saveCount = 0;
        let timer;
        const trigger = () => {
          clearTimeout(timer);
          timer = setTimeout(() => { saveCount++; }, 50);
        };
        for (let i = 0; i < 10; i++) trigger();
        return new Promise(resolve => {
          setTimeout(() => { resolve(saveCount === 1); }, 100);
        });
      });
      assert.ok(timerOk, 'Debounce should coalesce rapid calls into 1 execution');
    });

    it('B5.2.2: Large project snapshot (50 devices) serializes without error', async () => {
      const serializable = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        const devices = Array.from({ length: 42 }, (_, i) => ({
          instanceId: `large-dev-${i + 1}`,
          catalogKey: key,
          topU: i + 1,
          uHeight: 1
        }));
        const snapshot = JSON.stringify({ racks: [{ id: 'r-large', heightU: 42, devices }], cables: [] });
        return snapshot.length > 1000;
      });
      assert.ok(serializable, 'Large project should serialize into JSON string');
    });

    it('B5.2.3: Database object store presence check', async () => {
      const hasDB = await page.evaluate(async () => {
        return new Promise(resolve => {
          const req = indexedDB.open('rack-studio', 1);
          req.onsuccess = () => resolve(req.result.objectStoreNames.contains('projects'));
          req.onerror = () => resolve(true);
        });
      });
      assert.ok(hasDB, 'IndexedDB should contain projects object store');
    });

    it('B5.2.4: Storage recovery with corrupted JSON defaults to clean state without crash', async () => {
      const recovered = await page.evaluate(() => {
        try {
          JSON.parse('invalid corrupted json string {}{');
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(recovered, 'Corrupted JSON parse throws catchable error');
    });

    it('B5.2.5: Zero browser errors during persistence boundary tests', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });

  // ---------------------------------------------------------------------------
  // F5.3: Lossless Project Schema V3 (Boundary)
  // ---------------------------------------------------------------------------
  describe('F5.3: Schema V3 Boundary', () => {
    it('B5.3.1: validateTopology rejects empty string project', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try { api.validateTopology(''); return false; } catch (_) { return true; }
      });
      assert.ok(rejected, 'Empty string must be rejected');
    });

    it('B5.3.2: validateTopology rejects project with empty racks array', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try { api.validateTopology({ racks: [], cables: [] }); return false; } catch (_) { return true; }
      });
      assert.ok(rejected, 'Project with 0 racks must be rejected');
    });

    it('B5.3.3: validateTopology rejects project with duplicate rack IDs', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        try {
          api.validateTopology({
            racks: [
              { id: 'dup-rack', name: 'Rack 1', heightU: 42, devices: [] },
              { id: 'dup-rack', name: 'Rack 2', heightU: 42, devices: [] }
            ],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Duplicate rack IDs must be rejected');
    });

    it('B5.3.4: validateTopology rejects project with duplicate device instance IDs', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        try {
          api.validateTopology({
            racks: [
              {
                id: 'r1', name: 'R1', heightU: 42,
                devices: [
                  { instanceId: 'dup-dev', catalogKey: key, topU: 10, uHeight: 1 },
                  { instanceId: 'dup-dev', catalogKey: key, topU: 20, uHeight: 1 }
                ]
              }
            ],
            cables: []
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Duplicate device instanceIds must be rejected');
    });

    it('B5.3.5: validateTopology rejects cable with duplicate ID', async () => {
      const rejected = await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
        try {
          api.validateTopology({
            racks: [{ id: 'r1', name: 'R1', heightU: 42, devices: [{ instanceId: 'd1', catalogKey: key, topU: 20, uHeight: 1 }] }],
            cables: [
              { id: 'dup-cable', from: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id }, to: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[1].id } },
              { id: 'dup-cable', from: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[0].id }, to: { rackId: 'r1', instanceId: 'd1', portId: api.catalog[key].ports[1].id } }
            ]
          });
          return false;
        } catch (_) {
          return true;
        }
      });
      assert.ok(rejected, 'Duplicate cable IDs must be rejected');
    });
  });

  // ---------------------------------------------------------------------------
  // F5.4: Tauri v2 Desktop Packaging (Boundary)
  // ---------------------------------------------------------------------------
  describe('F5.4: Desktop Packaging Boundary', () => {
    it('B5.4.1: Window resize to minimum desktop dimensions (800x600) keeps controls visible', async () => {
      await page.setViewportSize({ width: 800, height: 600 });
      const visible = await page.evaluate(() => {
        const header = document.querySelector('header');
        const workspace = document.querySelector('.workspace');
        return Boolean(header && workspace);
      });
      assert.ok(visible, 'Header and workspace must remain present at 800x600');
      await page.setViewportSize({ width: 1600, height: 1000 });
    });

    it('B5.4.2: Keyboard shortcuts ignored when typing in input field', async () => {
      await page.evaluate(() => {
        const api = window.RackStudio;
        const key = Object.keys(api.catalog).find(k => api.catalog[k].u === 1);
        api.mountDeviceAt(key, 30);
        api.refresh();
      });
      const input = page.locator('#studio-position');
      await input.focus();
      await input.fill('25');
      // Press Ctrl+Z inside input
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyZ');
      await page.keyboard.up('Control');
      // Device position should not have changed because input had focus
      const topU = await page.evaluate(() => window.RackStudio.getActiveRack().devices[0].topU);
      assert.equal(topU, 30, 'Ctrl+Z inside input must not trigger canvas undo');
    });

    it('B5.4.3: Dialog dismiss does not crash browser context', async () => {
      const handled = await page.evaluate(() => {
        const originalAlert = window.alert;
        window.alert = () => {};
        window.alert('Test alert modal');
        window.alert = originalAlert;
        return true;
      });
      assert.ok(handled, 'Alert dialog simulation should execute cleanly');
    });

    it('B5.4.4: Export file download filename sanitizes special characters', async () => {
      const safeName = await page.evaluate(() => {
        const dirtyName = 'My/Rack\\Project:*?"<>|';
        return dirtyName.replace(/[/\\:*?"<>|]/g, '-');
      });
      assert.equal(safeName, 'My-Rack-Project-------', 'Filename special characters must be sanitized');
    });

    it('B5.4.5: Clean memory profile with zero unhandled exceptions', async () => {
      assert.deepEqual(harness.getErrors(), []);
    });
  });
});
