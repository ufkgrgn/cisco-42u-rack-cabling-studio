import { describe, it, expect, beforeEach } from 'vitest';
import { SceneGraph } from '../../src/engine/scene/SceneGraph';
import { RackContainer } from '../../src/engine/scene/RackContainer';
import { FrustumCuller } from '../../src/engine/scene/FrustumCuller';
import { LODManager } from '../../src/engine/scene/LODManager';
import { LODTier } from '../../src/engine/scene/types';
import { DragManager } from '../../src/engine/interaction/DragManager';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';
import { RackModel, DeviceCatalogItem } from '../../src/core/types';

describe('Milestone M2: Scene Graph, RenderGroups, Frustum Culling & LOD (F1.4, F1.5, F1.6)', () => {
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
  ]);

  function createTestRack(id: string, name: string, totalU = 42, positionX = 0): RackModel {
    return {
      id,
      name,
      totalU,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX,
      devices: [
        {
          instanceId: `dev_${id}_1`,
          catalogId: 'cisco-catalyst-9300',
          rackId: id,
          startU: 10,
          uHeight: 1,
          face: 'front',
        },
        {
          instanceId: `dev_${id}_2`,
          catalogId: 'server-dell-r740',
          rackId: id,
          startU: 20,
          uHeight: 2,
          face: 'front',
        },
      ],
    };
  }

  describe('Multi-Rack Spatial Layout (F1.4)', () => {
    it('lays out multiple racks horizontally at stride 754px by default', () => {
      const sceneGraph = new SceneGraph();
      const racks: RackModel[] = [
        createTestRack('rack_0', 'Cabinet 1'),
        createTestRack('rack_1', 'Cabinet 2'),
        createTestRack('rack_2', 'Cabinet 3'),
      ];

      sceneGraph.syncRacks(racks, sampleCatalog);

      expect(sceneGraph.rackContainers.size).toBe(3);
      expect(sceneGraph.rackContainers.get('rack_0')?.x).toBe(0);
      expect(sceneGraph.rackContainers.get('rack_1')?.x).toBe(754);
      expect(sceneGraph.rackContainers.get('rack_2')?.x).toBe(1508);
    });

    it('respects custom positionX if specified on rack', () => {
      const sceneGraph = new SceneGraph();
      const racks: RackModel[] = [
        createTestRack('rack_a', 'Custom A', 42, 200),
        createTestRack('rack_b', 'Custom B', 42, 1200),
      ];

      sceneGraph.syncRacks(racks, sampleCatalog);
      expect(sceneGraph.rackContainers.get('rack_a')?.x).toBe(200);
      expect(sceneGraph.rackContainers.get('rack_b')?.x).toBe(1200);
    });
  });

  describe('RenderGroup Isolation (F1.4)', () => {
    it('configures worldContainer and all RackContainers with isRenderGroup = true', () => {
      const sceneGraph = new SceneGraph();
      expect(sceneGraph.worldContainer.isRenderGroup).toBe(true);

      const rack = new RackContainer(createTestRack('rack_0', 'Cabinet 1'));
      expect(rack.isRenderGroup).toBe(true);
      expect(rack.cullable).toBe(true);
      expect(rack.cullArea).toBeDefined();
      expect(rack.cullArea?.width).toBe(634);
      expect(rack.cullArea?.height).toBe(42 * 32 + 64);
    });
  });

  describe('EIA-310-D Coordinate Mapping (1U = 32px)', () => {
    it('computes correct rack dimensions and slot boundaries', () => {
      const rack = new RackContainer(createTestRack('rack_0', 'Cabinet 1', 42));
      expect(rack.rackWidth).toBe(634);
      expect(rack.rackHeight).toBe(42 * 32 + 64); // 1408px

      // U1 is at bottom: slotY = 32 + (42 - 1) * 32 = 1344px
      const u1Bounds = rack.getSlotBounds(1, 1);
      expect(u1Bounds.x).toBe(53);
      expect(u1Bounds.y).toBe(32 + (42 - 1) * 32);
      expect(u1Bounds.height).toBe(32);

      // U42 is at top: slotY = 32 + (42 - 42) * 32 = 32px
      const u42Bounds = rack.getSlotBounds(42, 1);
      expect(u42Bounds.x).toBe(53);
      expect(u42Bounds.y).toBe(32);
      expect(u42Bounds.height).toBe(32);

      // 2U device at U20: topUnit = 21, slotY = 32 + (42 - 21) * 32 = 704px, height = 64px
      const u20Bounds = rack.getSlotBounds(20, 2);
      expect(u20Bounds.y).toBe(32 + (42 - 21) * 32);
      expect(u20Bounds.height).toBe(64);
    });
  });

  describe('Frustum Culling (F1.5)', () => {
    it('culls off-screen racks while keeping on-screen racks visible', () => {
      const culler = new FrustumCuller(50); // 50px margin
      const racks = new Map<string, RackContainer>();

      for (let i = 0; i < 5; i++) {
        const r = new RackContainer(createTestRack(`rack_${i}`, `Cab ${i}`));
        r.x = i * 754;
        r.y = 0;
        r.visible = true;
        r.culled = false;
        racks.set(r.rackId, r);
      }

      // Viewport looking at X: 0 to 800 (Racks 0 and 1 are in view, Racks 2, 3, 4 are outside)
      const bounds = {
        left: -50,
        top: -50,
        right: 850,
        bottom: 1500,
      };

      const stats = culler.cullRacks(racks, bounds);

      expect(racks.get('rack_0')?.visible).toBe(true);
      expect(racks.get('rack_0')?.culled).toBe(false);

      expect(racks.get('rack_1')?.visible).toBe(true);
      expect(racks.get('rack_1')?.culled).toBe(false);

      expect(racks.get('rack_2')?.visible).toBe(false);
      expect(racks.get('rack_2')?.culled).toBe(true);

      expect(racks.get('rack_3')?.visible).toBe(false);
      expect(racks.get('rack_3')?.culled).toBe(true);

      expect(racks.get('rack_4')?.visible).toBe(false);
      expect(racks.get('rack_4')?.culled).toBe(true);

      expect(stats.totalRacks).toBe(5);
      expect(stats.visibleRacks).toBe(2);
      expect(stats.culledRacks).toBe(3);
      expect(stats.cullRatio).toBe(0.6);
    });
  });

  describe('3-Tier LOD with Hysteresis (F1.5)', () => {
    it('transitions between Overview, Standard, and Detailed tiers', () => {
      const lod = new LODManager();
      expect(lod.currentTier).toBe(LODTier.STANDARD);

      // Zoom out to 0.2x -> Overview
      const resOverview = lod.evaluateScale(0.2);
      expect(resOverview.changed).toBe(true);
      expect(resOverview.tier).toBe(LODTier.OVERVIEW);

      // Hysteresis: scaling to 0.34 stays in Overview (needs >= 0.35 to enter Standard)
      const resHyst = lod.evaluateScale(0.34);
      expect(resHyst.changed).toBe(false);
      expect(resHyst.tier).toBe(LODTier.OVERVIEW);

      // Scaling to 0.4x -> enters Standard
      const resStandard = lod.evaluateScale(0.4);
      expect(resStandard.changed).toBe(true);
      expect(resStandard.tier).toBe(LODTier.STANDARD);

      // Scaling to 1.5x -> enters Detailed
      const resDetailed = lod.evaluateScale(1.5);
      expect(resDetailed.changed).toBe(true);
      expect(resDetailed.tier).toBe(LODTier.DETAILED);

      // Hysteresis: scaling to 0.99 stays in Detailed (needs < 0.98 to enter Standard)
      const resDetailedHyst = lod.evaluateScale(0.99);
      expect(resDetailedHyst.changed).toBe(false);
      expect(resDetailedHyst.tier).toBe(LODTier.DETAILED);

      // Scaling down to 0.90 -> enters Standard
      const resBackStandard = lod.evaluateScale(0.90);
      expect(resBackStandard.changed).toBe(true);
      expect(resBackStandard.tier).toBe(LODTier.STANDARD);
    });

    it('toggles sub-container visibility in DeviceContainer and RackContainer', () => {
      const rack = new RackContainer(createTestRack('rack_0', 'Cab 1'));
      rack.syncDevices(createTestRack('rack_0', 'Cab 1').devices, sampleCatalog);

      // Set to OVERVIEW
      rack.setLOD(LODTier.OVERVIEW);
      expect(rack.badgeContainer.visible).toBe(true);
      expect(rack.railsGraphics.visible).toBe(false);
      for (const dev of rack.deviceMap.values()) {
        expect(dev.overviewView.visible).toBe(true);
        expect(dev.standardView.visible).toBe(false);
        expect(dev.detailedView.visible).toBe(false);
      }

      // Set to STANDARD
      rack.setLOD(LODTier.STANDARD);
      expect(rack.badgeContainer.visible).toBe(false);
      expect(rack.railsGraphics.visible).toBe(true);
      for (const dev of rack.deviceMap.values()) {
        expect(dev.overviewView.visible).toBe(false);
        expect(dev.standardView.visible).toBe(true);
        expect(dev.detailedView.visible).toBe(false);
      }

      // Set to DETAILED
      rack.setLOD(LODTier.DETAILED);
      for (const dev of rack.deviceMap.values()) {
        expect(dev.overviewView.visible).toBe(false);
        expect(dev.standardView.visible).toBe(true);
        expect(dev.detailedView.visible).toBe(true);
      }
    });
  });

  describe('Interactive Drag Snapping & AABB Collision (F1.6)', () => {
    let sceneGraph: SceneGraph;
    let dragManager: DragManager;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      const rack = createTestRack('rack_0', 'Cab 1', 42, 0);
      sceneGraph.syncRacks([rack], sampleCatalog);
      dragManager = new DragManager(sceneGraph, EngineBridge.getInstance());
    });

    it('detects collision when dragging over occupied units on same face', () => {
      const rackContainer = sceneGraph.rackContainers.get('rack_0')!;

      // Existing devices are at U10 (1U) and U20-U21 (2U)
      // Attempting placement at U10 should collide
      const collision10 = dragManager.checkCollision(rackContainer, 10, 1, undefined, 'front');
      expect(collision10.hasCollision).toBe(true);

      // Attempting placement of 2U device at U9 (occupies U9 and U10) should collide
      const collision9 = dragManager.checkCollision(rackContainer, 9, 2, undefined, 'front');
      expect(collision9.hasCollision).toBe(true);

      // Free slot at U15 should not collide
      const free15 = dragManager.checkCollision(rackContainer, 15, 2, undefined, 'front');
      expect(free15.hasCollision).toBe(false);

      // Rear face placement at U10 should not collide with front face device
      const rear10 = dragManager.checkCollision(rackContainer, 10, 1, undefined, 'rear');
      expect(rear10.hasCollision).toBe(false);
    });

    it('rejects out of bounds placement', () => {
      const rackContainer = sceneGraph.rackContainers.get('rack_0')!;

      // startU = 0
      const oobLow = dragManager.checkCollision(rackContainer, 0, 1);
      expect(oobLow.hasCollision).toBe(true);
      expect(oobLow.reason).toBe('OUT OF BOUNDS');

      // endU > 42 (e.g. startU = 42, height = 2 => endU = 43)
      const oobHigh = dragManager.checkCollision(rackContainer, 42, 2);
      expect(oobHigh.hasCollision).toBe(true);
      expect(oobHigh.reason).toBe('OUT OF BOUNDS');
    });
  });
});
