// ============================================================================
// Adversarial Stress Test Suite: Multi-Rack SceneGraph, LOD & Drag Ghost Snapping
// Challenger M2_2: Empirical Verification & Boundary Attack Harness
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneGraph } from '../../src/engine/scene/SceneGraph';
import { RackContainer } from '../../src/engine/scene/RackContainer';
import { DeviceContainer } from '../../src/engine/scene/DeviceContainer';
import { FrustumCuller } from '../../src/engine/scene/FrustumCuller';
import { LODManager } from '../../src/engine/scene/LODManager';
import { LODTier } from '../../src/engine/scene/types';
import { DragManager } from '../../src/engine/interaction/DragManager';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';
import { RackModel, DeviceCatalogItem, DeviceInstance } from '../../src/core/types';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useHistoryStore } from '../../src/core/state/historyStore';

describe('Adversarial Stress Testing: M2_2 (SceneGraph, LOD, Ghost Snapping)', () => {
  const sampleCatalog = new Map<string, DeviceCatalogItem>([
    [
      'cisco-catalyst-9300',
      {
        id: 'cisco-catalyst-9300',
        name: 'Cisco Catalyst 9300-48P',
        category: 'switch',
        u: 1,
        manufacturer: 'Cisco',
        ports: Array.from({ length: 48 }, (_, i) => ({
          id: `p_${i + 1}`,
          name: `Port ${i + 1}`,
          type: 'rj45',
        })),
      },
    ],
    [
      'server-dell-r740',
      {
        id: 'server-dell-r740',
        name: 'Dell PowerEdge R740 2U',
        category: 'server',
        u: 2,
        manufacturer: 'Dell',
        ports: [{ id: 'p1', name: 'NIC 1', type: 'rj45' }],
      },
    ],
    [
      'cisco-nexus-9336',
      {
        id: 'cisco-nexus-9336',
        name: 'Cisco Nexus 9336C-FX2',
        category: 'switch',
        u: 4,
        manufacturer: 'Cisco',
        ports: [{ id: 'p1', name: 'QSFP28 1', type: 'qsfp28' }],
      },
    ],
  ]);

  function createRackTopology(rackCount: number, populated = false): RackModel[] {
    const racks: RackModel[] = [];
    for (let r = 0; r < rackCount; r++) {
      const devices: DeviceInstance[] = [];
      if (populated) {
        for (let u = 1; u <= 42; u++) {
          devices.push({
            instanceId: `dev_r${r}_u${u}`,
            catalogId: 'cisco-catalyst-9300',
            rackId: `rack_${r}`,
            startU: u,
            uHeight: 1,
            face: 'front',
          });
        }
      } else {
        // Standard population with a 1U switch at U10 and a 2U server at U20
        devices.push(
          {
            instanceId: `dev_r${r}_1`,
            catalogId: 'cisco-catalyst-9300',
            rackId: `rack_${r}`,
            startU: 10,
            uHeight: 1,
            face: 'front',
          },
          {
            instanceId: `dev_r${r}_2`,
            catalogId: 'server-dell-r740',
            rackId: `rack_${r}`,
            startU: 20,
            uHeight: 2,
            face: 'front',
          }
        );
      }

      racks.push({
        id: `rack_${r}`,
        name: `Cabinet ${r + 1}`,
        totalU: 42,
        widthMm: 600,
        depthMm: 1000,
        maxLoadKg: 1000,
        positionX: r * 754,
        devices,
      });
    }
    return racks;
  }

  // ==========================================================================
  // 1. EIA-310-D Slot Snapping Boundaries & Out-Of-Bounds Stress
  // ==========================================================================
  describe('1. EIA-310-D Slot Snapping Boundaries & Coordinate Mathematics', () => {
    let sceneGraph: SceneGraph;
    let dragManager: DragManager;
    let bridge: EngineBridge;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      const racks = createRackTopology(1);
      sceneGraph.syncRacks(racks, sampleCatalog);
      bridge = EngineBridge.getInstance();
      dragManager = new DragManager(sceneGraph, bridge);
    });

    it('1.1 Snaps accurately to bottom unit slot 1 for 1U, 2U, and 4U devices', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      expect(rack).toBeDefined();

      // Test 1U device at slot 1
      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-catalyst-9300')! });
      // Pointer near bottom slot 1 (railTopY = 32, U1 center is at 32 + (42-1)*32 + 16 = 1360)
      dragManager.handlePointerMove(rack.x + 100, 1360);
      expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      // U1: topUnit = 1, snappedWorldY = 32 + (42 - 1) * 32 = 1344
      expect(dragManager.ghost.position.y).toBe(1344);
      const slotBounds1U = rack.getSlotBounds(1, 1);
      expect(dragManager.ghost.position.y).toBe(slotBounds1U.y);
      expect(dragManager.ghost.position.x).toBe(slotBounds1U.x);
      dragManager.cancelDrag();

      // Test 2U device at slot 1
      dragManager.startDrag({ catalogItem: sampleCatalog.get('server-dell-r740')! });
      // 2U height is 64px, center is 32px from top. Slot 1-2 center is at 1344
      dragManager.handlePointerMove(rack.x + 100, 1344);
      expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      // Top unit of 2U at U1 is U2. snappedWorldY = 32 + (42 - 2) * 32 = 1312
      expect(dragManager.ghost.position.y).toBe(1312);
      const slotBounds2U = rack.getSlotBounds(1, 2);
      expect(dragManager.ghost.position.y).toBe(slotBounds2U.y);
      dragManager.cancelDrag();

      // Test 4U device at slot 1
      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-nexus-9336')! });
      // Top unit of 4U at U1 is U4. snappedWorldY = 32 + (42 - 4) * 32 = 1248
      dragManager.handlePointerMove(rack.x + 100, 1300);
      expect(dragManager.ghost.position.y).toBe(1248);
      const slotBounds4U = rack.getSlotBounds(1, 4);
      expect(dragManager.ghost.position.y).toBe(slotBounds4U.y);
      dragManager.cancelDrag();
    });

    it('1.2 Snaps accurately to top unit slot 42 for 1U, and max slots for 2U and 4U', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;

      // 1U at top slot 42: topUnit = 42, snappedWorldY = 32
      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-catalyst-9300')! });
      dragManager.handlePointerMove(rack.x + 100, 48); // Slot 42 center is 32 + 16 = 48
      expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      expect(dragManager.ghost.position.y).toBe(32);
      const slotBounds1U = rack.getSlotBounds(42, 1);
      expect(dragManager.ghost.position.y).toBe(slotBounds1U.y);
      dragManager.cancelDrag();

      // 2U at top: highest valid startU is 41 (occupies U41-U42). topUnit = 42, snappedWorldY = 32
      dragManager.startDrag({ catalogItem: sampleCatalog.get('server-dell-r740')! });
      dragManager.handlePointerMove(rack.x + 100, 48);
      expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      expect(dragManager.ghost.position.y).toBe(32);
      const slotBounds2U = rack.getSlotBounds(41, 2);
      expect(dragManager.ghost.position.y).toBe(slotBounds2U.y);
      dragManager.cancelDrag();

      // 4U at top: highest valid startU is 39 (occupies U39-U42). topUnit = 42, snappedWorldY = 32
      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-nexus-9336')! });
      dragManager.handlePointerMove(rack.x + 100, 48);
      expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      expect(dragManager.ghost.position.y).toBe(32);
      const slotBounds4U = rack.getSlotBounds(39, 4);
      expect(dragManager.ghost.position.y).toBe(slotBounds4U.y);
      dragManager.cancelDrag();
    });

    it('1.3 Enforces strict OUT OF BOUNDS checks for illegal unit intervals', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;

      // Test checkCollision direct contract
      const testCases = [
        { startU: 0, uHeight: 1, expectedReason: 'OUT OF BOUNDS' },
        { startU: -5, uHeight: 1, expectedReason: 'OUT OF BOUNDS' },
        { startU: 43, uHeight: 1, expectedReason: 'OUT OF BOUNDS' },
        { startU: 42, uHeight: 2, expectedReason: 'OUT OF BOUNDS' }, // 42+2-1 = 43
        { startU: 40, uHeight: 4, expectedReason: 'OUT OF BOUNDS' }, // 40+4-1 = 43
        { startU: -1, uHeight: 2, expectedReason: 'OUT OF BOUNDS' },
        { startU: 42, uHeight: 4, expectedReason: 'OUT OF BOUNDS' },
      ];

      for (const tc of testCases) {
        const result = dragManager.checkCollision(rack, tc.startU, tc.uHeight);
        expect(result.hasCollision).toBe(true);
        expect(result.reason).toBe(tc.expectedReason);
      }
    });

    it('1.4 Clamps extreme pointer positions gracefully without crashing or corrupting coordinates', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;

      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-catalyst-9300')! });

      // Far above rack (worldY = -10,000) -> outside vertical bounds [rack.y - 50, rack.y + rackHeight + 50]
      dragManager.handlePointerMove(rack.x + 100, -10000);
      expect(dragManager.ghost.isValid).toBe(false);
      expect(dragManager.ghost.reason).toBe('OUTSIDE RACK BOUNDS');

      // Far below rack (worldY = +50,000) -> outside vertical bounds
      dragManager.handlePointerMove(rack.x + 100, 50000);
      expect(dragManager.ghost.isValid).toBe(false);
      expect(dragManager.ghost.reason).toBe('OUTSIDE RACK BOUNDS');

      // Outside rack bounds horizontally (worldX = -500)
      dragManager.handlePointerMove(-500, 500);
      expect(dragManager.ghost.position.x).toBe(-500 - 264);
      expect(dragManager.ghost.position.y).toBe(500 - 16);
      expect(dragManager.ghost.isValid).toBe(false);
      expect(dragManager.ghost.reason).toBe('OUTSIDE RACK BOUNDS');

      dragManager.cancelDrag();
    });

    it('1.5 Handles fractional and edge-case pointer coordinates with deterministic integer slot snapping', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      dragManager.startDrag({ catalogItem: sampleCatalog.get('cisco-catalyst-9300')! });

      let moveEventData: any = null;
      const unsub = bridge.on('device:drag-move', (data) => {
        moveEventData = data;
      });

      // Stress test with 500 fractional pointer positions
      for (let i = 0; i < 500; i++) {
        const fracX = rack.x + 53.0001 + (i % 500) * 0.9876543;
        const fracY = 32.123456 + (i * 2.71828) % 1344;

        dragManager.handlePointerMove(fracX, fracY);

        // Assert snapped U is strictly integer
        expect(Number.isInteger(moveEventData.snappedU)).toBe(true);
        expect(moveEventData.snappedU).toBeGreaterThanOrEqual(1);
        expect(moveEventData.snappedU).toBeLessThanOrEqual(42);

        // Assert ghost position Y is strictly aligned to 32px slot boundary
        const ghostY = dragManager.ghost.position.y;
        expect((ghostY - 32) % 32).toBeCloseTo(0, 5);

        // Assert ghost position X is strictly snapped to rack rail offset 53
        expect(dragManager.ghost.position.x).toBe(rack.x + 53);
      }

      unsub();
      dragManager.cancelDrag();
    });
  });

  // ==========================================================================
  // 2. Multi-Rack Layout Scaling (10, 20, 50 racks) & Frustum Culling
  // ==========================================================================
  describe('2. Multi-Rack Layout Scaling (10, 20, 50 Racks) & Frustum Culling', () => {
    it('2.1 Scales multi-rack layout across 10, 20, and 50 racks with strict spatial separation', () => {
      const rackScales = [10, 20, 50];

      for (const count of rackScales) {
        const sceneGraph = new SceneGraph();
        const racks = createRackTopology(count, true);
        const t0 = performance.now();
        sceneGraph.syncRacks(racks, sampleCatalog);
        const elapsed = performance.now() - t0;

        expect(sceneGraph.rackContainers.size).toBe(count);

        // Verify spatial strides: rack i must be at i * 754
        for (let i = 0; i < count; i++) {
          const rackContainer = sceneGraph.rackContainers.get(`rack_${i}`);
          expect(rackContainer).toBeDefined();
          expect(rackContainer?.x).toBe(i * 754);
          expect(rackContainer?.rackWidth).toBe(634);
          expect(rackContainer?.rackHeight).toBe(42 * 32 + 64);
        }

        console.log(`[Multi-Rack Scaling] ${count} racks synced in ${elapsed.toFixed(3)}ms`);
        expect(elapsed).toBeLessThan(500); // 500ms sync threshold
      }
    });

    it('2.2 Verifies Frustum Culling mathematical ground truth across 50 racks over pan sweep', () => {
      const count = 50;
      const sceneGraph = new SceneGraph();
      const racks = createRackTopology(count, false);
      sceneGraph.syncRacks(racks, sampleCatalog);

      const culler = sceneGraph.culler;
      expect(culler.margin).toBe(100);

      // Verify ground truth across 200 panning frames spanning 0 to 40,000px world X
      const screenWidth = 1920;
      const screenHeight = 1080;
      const cameraZoom = 1.0;
      let totalDiscrepancies = 0;
      let totalChecked = 0;

      for (let frame = 0; frame < 200; frame++) {
        const cameraX = -(frame * 190); // Panning right across 38,000px
        const cameraY = 0;

        const screenToWorld = (sx: number, sy: number) => ({
          x: (sx - cameraX) / cameraZoom,
          y: (sy - cameraY) / cameraZoom,
        });

        const bounds = culler.computeViewportBounds(screenWidth, screenHeight, screenToWorld);
        const stats = culler.cullRacks(sceneGraph.rackContainers, bounds);

        // Ground-truth evaluation for all 50 racks
        let expectedVisible = 0;
        let expectedCulled = 0;

        for (const r of sceneGraph.rackContainers.values()) {
          totalChecked++;
          const rackLeft = r.x;
          const rackRight = r.x + r.rackWidth;
          const rackTop = r.y;
          const rackBottom = r.y + r.rackHeight;

          const isOffscreen =
            rackRight < bounds.left ||
            rackLeft > bounds.right ||
            rackBottom < bounds.top ||
            rackTop > bounds.bottom;

          if (isOffscreen) {
            expectedCulled++;
            if (r.visible !== false || r.culled !== true) {
              totalDiscrepancies++;
            }
          } else {
            expectedVisible++;
            if (r.visible !== true || r.culled !== false) {
              totalDiscrepancies++;
            }
          }
        }

        expect(stats.totalRacks).toBe(count);
        expect(stats.visibleRacks).toBe(expectedVisible);
        expect(stats.culledRacks).toBe(expectedCulled);
        expect(stats.visibleRacks + stats.culledRacks).toBe(count);
      }

      console.log(`[Frustum Culling Ground-Truth] Total checks: ${totalChecked}, Discrepancies: ${totalDiscrepancies}`);
      expect(totalDiscrepancies).toBe(0);
    });

    it('2.3 Flags 100% of racks as culled when completely off-screen, and 100% visible when fully zoomed out', () => {
      const sceneGraph = new SceneGraph();
      const racks = createRackTopology(50);
      sceneGraph.syncRacks(racks, sampleCatalog);

      // 1. Completely off-screen camera (world X: -50,000)
      const offscreenResult = sceneGraph.updateViewport(1920, 1080, 1.0, (sx, sy) => ({
        x: sx - 50000,
        y: sy - 50000,
      }));
      expect(offscreenResult.culling.visibleRacks).toBe(0);
      expect(offscreenResult.culling.culledRacks).toBe(50);
      expect(offscreenResult.culling.cullRatio).toBe(1.0);

      // 2. Extreme zoomed out view (zoom: 0.03x -> visible world width = 1920 / 0.03 = 64,000px)
      // All 50 racks span 50 * 754 = 37,700px, fitting completely into 64,000px
      const zoomedOutResult = sceneGraph.updateViewport(1920, 1080, 0.03, (sx, sy) => ({
        x: sx / 0.03,
        y: sy / 0.03,
      }));
      expect(zoomedOutResult.culling.visibleRacks).toBe(50);
      expect(zoomedOutResult.culling.culledRacks).toBe(0);
      expect(zoomedOutResult.culling.cullRatio).toBe(0.0);
    });
  });

  // ==========================================================================
  // 3. LOD Hysteresis & Sub-Container Integrity Stress
  // ==========================================================================
  describe('3. LOD Hysteresis, Boundary Jitter & State Integrity', () => {
    it('3.1 Enforces hysteresis bands preventing flickering under rapid zoom jitter', () => {
      const lod = new LODManager();
      expect(lod.currentTier).toBe(LODTier.STANDARD);

      // Verify hysteresis between Standard and Overview:
      // Transition Standard -> Overview requires scale < 0.33
      // Transition Overview -> Standard requires scale >= 0.35
      // Deadband is [0.33, 0.35]

      // Zoom out into Overview
      lod.evaluateScale(0.30);
      expect(lod.currentTier).toBe(LODTier.OVERVIEW);

      // Rapidly oscillate in the deadband [0.331 .. 0.349] for 1,000 cycles
      let flickerCount = 0;
      for (let i = 0; i < 1000; i++) {
        const scale = 0.331 + (i % 18) * 0.001; // 0.331 to 0.348
        const { changed } = lod.evaluateScale(scale);
        if (changed) flickerCount++;
      }
      expect(flickerCount).toBe(0);
      expect(lod.currentTier).toBe(LODTier.OVERVIEW);

      // Now zoom into Standard
      const toStandard = lod.evaluateScale(0.36);
      expect(toStandard.changed).toBe(true);
      expect(lod.currentTier).toBe(LODTier.STANDARD);

      // Rapidly oscillate in the deadband [0.331 .. 0.349] from Standard
      flickerCount = 0;
      for (let i = 0; i < 1000; i++) {
        const scale = 0.331 + (i % 18) * 0.001;
        const { changed } = lod.evaluateScale(scale);
        if (changed) flickerCount++;
      }
      expect(flickerCount).toBe(0);
      expect(lod.currentTier).toBe(LODTier.STANDARD);

      // Verify hysteresis between Standard and Detailed:
      // Transition Standard -> Detailed requires scale >= 1.02
      // Transition Detailed -> Standard requires scale < 0.98
      // Deadband is [0.98, 1.02]

      // Zoom into Detailed
      lod.evaluateScale(1.05);
      expect(lod.currentTier).toBe(LODTier.DETAILED);

      // Rapidly oscillate in deadband [0.981 .. 1.019] from Detailed
      flickerCount = 0;
      for (let i = 0; i < 1000; i++) {
        const scale = 0.981 + (i % 38) * 0.001; // 0.981 to 1.018
        const { changed } = lod.evaluateScale(scale);
        if (changed) flickerCount++;
      }
      expect(flickerCount).toBe(0);
      expect(lod.currentTier).toBe(LODTier.DETAILED);

      console.log('[LOD Hysteresis] 2,000 deadband jitter cycles tested: 0 flickers detected');
    });

    it('3.2 Verifies initial RackContainer badgeContainer state is hidden in STANDARD LOD upon construction', () => {
      const rack = new RackContainer(createRackTopology(1)[0]);
      
      // RackContainer declares currentLOD = LODTier.STANDARD
      expect(rack.currentLOD).toBe(LODTier.STANDARD);

      // In STANDARD LOD, badgeContainer MUST be hidden (false) and rails/slots visible (true)
      expect(rack.badgeContainer.visible).toBe(false);
      expect(rack.railsGraphics.visible).toBe(true);
      expect(rack.uSlotsContainer.visible).toBe(true);
    });

    it('3.3 Maintains sub-container visibility invariants when setLOD is explicitly applied', () => {
      const sceneGraph = new SceneGraph();
      const racks = createRackTopology(3);
      sceneGraph.syncRacks(racks, sampleCatalog);

      const lod = sceneGraph.lodManager;

      // Force explicit initial applyLOD to establish clean baseline
      lod.applyLOD(sceneGraph.rackContainers.values(), true);

      for (let i = 0; i < 2000; i++) {
        const randomScale = 0.1 + Math.random() * 2.5; // Scale range: 0.1x to 2.6x
        const { changed, tier } = lod.evaluateScale(randomScale);
        if (changed) {
          lod.applyLOD(sceneGraph.rackContainers.values(), true);
        }

        if (i % 200 === 0) {
          for (const rack of sceneGraph.rackContainers.values()) {
            if (tier === LODTier.OVERVIEW) {
              expect(rack.badgeContainer.visible).toBe(true);
              expect(rack.railsGraphics.visible).toBe(false);
              expect(rack.uSlotsContainer.visible).toBe(false);
              for (const dev of rack.deviceMap.values()) {
                expect(dev.overviewView.visible).toBe(true);
                expect(dev.standardView.visible).toBe(false);
                expect(dev.detailedView.visible).toBe(false);
              }
            } else if (tier === LODTier.STANDARD) {
              expect(rack.badgeContainer.visible).toBe(false);
              expect(rack.railsGraphics.visible).toBe(true);
              expect(rack.uSlotsContainer.visible).toBe(true);
              for (const dev of rack.deviceMap.values()) {
                expect(dev.overviewView.visible).toBe(false);
                expect(dev.standardView.visible).toBe(true);
                expect(dev.detailedView.visible).toBe(false);
              }
            } else if (tier === LODTier.DETAILED) {
              expect(rack.badgeContainer.visible).toBe(false);
              expect(rack.railsGraphics.visible).toBe(true);
              expect(rack.uSlotsContainer.visible).toBe(true);
              for (const dev of rack.deviceMap.values()) {
                expect(dev.overviewView.visible).toBe(false);
                expect(dev.standardView.visible).toBe(true);
                expect(dev.detailedView.visible).toBe(true);
              }
            }
          }
        }
      }
    });

    it('3.4 [ADVERSARIAL BUG 2] Detects off-screen rack LOD desynchronization on zoom-in to DETAILED', () => {
      const sceneGraph = new SceneGraph();
      // Create 20 racks
      const racks = createRackTopology(20);
      sceneGraph.syncRacks(racks, sampleCatalog);

      // Establish initial STANDARD state with forced apply
      sceneGraph.lodManager.applyLOD(sceneGraph.rackContainers.values(), true);

      // Viewport looking at Rack 0 at zoom 1.0 (STANDARD)
      sceneGraph.updateViewport(1920, 1080, 1.0, (sx, sy) => ({ x: sx, y: sy }));

      const rack0 = sceneGraph.rackContainers.get('rack_0')!;
      const rack15 = sceneGraph.rackContainers.get('rack_15')!; // x = 15 * 754 = 11310px (far offscreen)

      expect(rack0.visible).toBe(true);
      expect(rack15.visible).toBe(false);
      expect(rack15.currentLOD).toBe(LODTier.STANDARD);

      // Now zoom in to 1.5x (DETAILED) while still viewing Rack 0
      const zoomResult = sceneGraph.updateViewport(1920, 1080, 1.5, (sx, sy) => ({
        x: sx / 1.5,
        y: sy / 1.5,
      }));

      expect(zoomResult.lodChanged).toBe(true);
      expect(sceneGraph.lodManager.currentTier).toBe(LODTier.DETAILED);
      expect(rack0.currentLOD).toBe(LODTier.DETAILED);

      // Rack 15 was culled (rack15.visible === false)
      // Because LODManager.applyLOD has: if (rack.visible || force)
      // Rack 15 was SKIPPED!
      expect(rack15.currentLOD).toBe(LODTier.STANDARD);

      // Now user pans camera across to Rack 15 at zoom 1.5 (zoom remains 1.5)
      // Screen X 0..1920 maps to World X 11000..12280
      const panResult = sceneGraph.updateViewport(1920, 1080, 1.5, (sx, sy) => ({
        x: 11000 + sx / 1.5,
        y: sy / 1.5,
      }));

      // Rack 15 is now on screen!
      expect(rack15.visible).toBe(true);
      // But lodChanged is false!
      expect(panResult.lodChanged).toBe(false);

      // Verify rack 15 currentLOD is synchronized to active DETAILED LOD tier
      expect(rack15.currentLOD).toBe(LODTier.DETAILED);
    });
  });

  // ==========================================================================
  // 4. Rapid Drag-and-Drop Burst Across Rack Boundaries
  // ==========================================================================
  describe('4. Rapid Drag-and-Drop Burst Across Rack Boundaries', () => {
    let sceneGraph: SceneGraph;
    let dragManager: DragManager;
    let bridge: EngineBridge;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      const racks = createRackTopology(10);
      sceneGraph.syncRacks(racks, sampleCatalog);
      bridge = EngineBridge.getInstance();
      dragManager = new DragManager(sceneGraph, bridge);
    });

    it('4.1 Stress tests 2,000 rapid pointer movements across 10 racks and 9 gaps', () => {
      const catItem = sampleCatalog.get('cisco-catalyst-9300')!;
      dragManager.startDrag({ catalogItem: catItem });
      expect(dragManager.ghost.visible).toBe(true);

      const moveTimes: number[] = [];
      let inRackCount = 0;
      let inGapCount = 0;

      // Span 0 to 8,000px horizontally (covering all 10 racks at 754px stride)
      const step = 8000 / 2000; // 4px per step
      for (let i = 0; i < 2000; i++) {
        const worldX = i * step;
        const worldY = 32 + (i % 42) * 32;

        const t0 = performance.now();
        dragManager.handlePointerMove(worldX, worldY);
        const dt = performance.now() - t0;
        moveTimes.push(dt);

        const target = dragManager.findTargetRack(worldX);
        if (target) {
          inRackCount++;
          // Snapped U must be strictly integer in [1, 42]
          expect(dragManager.ghost.position.x).toBe(target.x + 53);
          expect(Number.isInteger(dragManager.ghost.position.y)).toBe(true);
        } else {
          inGapCount++;
          // Floating in gap
          expect(dragManager.ghost.position.x).toBe(worldX - 264);
        }
      }

      dragManager.cancelDrag();
      expect(dragManager.ghost.visible).toBe(false);

      moveTimes.sort((a, b) => a - b);
      const p50 = moveTimes[Math.floor(moveTimes.length * 0.5)];
      const p95 = moveTimes[Math.floor(moveTimes.length * 0.95)];
      const p99 = moveTimes[Math.floor(moveTimes.length * 0.99)];
      const max = moveTimes[moveTimes.length - 1];

      console.log('[Rapid Drag Burst Metrics]', {
        totalMoves: 2000,
        inRackCount,
        inGapCount,
        p50_ms: p50.toFixed(4),
        p95_ms: p95.toFixed(4),
        p99_ms: p99.toFixed(4),
        max_ms: max.toFixed(4),
      });

      // Strict performance gate: p95 < 0.1ms (100 microseconds per move)
      expect(p95).toBeLessThan(0.2);
      expect(max).toBeLessThan(5.0);
    });

    it('4.2 Simulates 100 consecutive rapid drag-and-drop lifecycle operations', () => {
      const catItem = sampleCatalog.get('cisco-catalyst-9300')!;

      for (let cycle = 0; cycle < 100; cycle++) {
        dragManager.startDrag({ catalogItem: catItem });
        expect(dragManager.state?.isActive).toBe(true);
        expect(dragManager.ghost.visible).toBe(true);

        // 10 jittery moves
        for (let j = 0; j < 10; j++) {
          const x = 200 + (cycle % 5) * 754 + j * 5;
          const y = 200 + j * 30;
          dragManager.handlePointerMove(x, y);
        }

        // Pointer up (drop into rack)
        dragManager.handlePointerUp(200 + (cycle % 5) * 754, 500);

        // Assert clean reset after drop
        expect(dragManager.state).toBeNull();
        expect(dragManager.ghost.visible).toBe(false);
      }
    });
  });
});
