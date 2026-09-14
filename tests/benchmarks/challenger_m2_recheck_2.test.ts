// ============================================================================
// Challenger M2 Recheck 2: Empirical Stress Test Harness
// Rigorous adversarial validation of:
// 1. RackContainer startup LOD badge visibility (Defect 1)
// 2. Off-screen rack synchronization via LODManager.syncVisibleRacks (Defect 2)
// 3. DragManager vertical raycast bounding (Defect 4)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SceneGraph } from '../../src/engine/scene/SceneGraph';
import { RackContainer } from '../../src/engine/scene/RackContainer';
import { LODManager } from '../../src/engine/scene/LODManager';
import { LODTier } from '../../src/engine/scene/types';
import { DragManager } from '../../src/engine/interaction/DragManager';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';
import { RackModel, DeviceCatalogItem, DeviceInstance } from '../../src/core/types';

describe('Challenger M2 Recheck 2 Empirical Stress Tests', () => {
  const catalog = new Map<string, DeviceCatalogItem>([
    [
      'cisco-9300',
      {
        id: 'cisco-9300',
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
      'server-2u',
      {
        id: 'server-2u',
        name: 'Dell PowerEdge R740 2U',
        category: 'server',
        u: 2,
        manufacturer: 'Dell',
        ports: [{ id: 'p1', name: 'NIC 1', type: 'rj45' }],
      },
    ],
    [
      'cisco-nexus-4u',
      {
        id: 'cisco-nexus-4u',
        name: 'Cisco Nexus 9336C-FX2',
        category: 'switch',
        u: 4,
        manufacturer: 'Cisco',
        ports: [{ id: 'p1', name: 'QSFP28 1', type: 'qsfp28' }],
      },
    ],
  ]);

  function makeRack(id: string, totalU = 42, posX = 0, posY = 0, populated = false): RackModel {
    const devices: DeviceInstance[] = [];
    if (populated) {
      for (let u = 1; u <= totalU; u += 2) {
        devices.push({
          instanceId: `dev_${id}_u${u}`,
          catalogId: 'cisco-9300',
          rackId: id,
          startU: u,
          uHeight: 1,
          face: 'front',
        });
      }
    }
    return {
      id,
      name: `Cabinet ${id}`,
      totalU,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: posX,
      devices,
    };
  }

  // ==========================================================================
  // Scope 2: Defect 1 - RackContainer Startup LOD Badge Visibility
  // ==========================================================================
  describe('Scope 2: Defect 1 - RackContainer Initialization Invariants', () => {
    it('2.1 Ensures badgeContainer.visible is strictly false for 1U, 12U, 24U, 42U, 48U, and 60U racks', () => {
      const uHeights = [1, 12, 24, 42, 48, 60];

      for (const u of uHeights) {
        const rackModel = makeRack(`rack_${u}u`, u, 0, 0, false);
        const rack = new RackContainer(rackModel);

        // Core assertions on initialization
        expect(rack.currentLOD).toBe(LODTier.STANDARD);
        expect(rack.badgeContainer.visible).toBe(false);
        expect(rack.railsGraphics.visible).toBe(true);
        expect(rack.uSlotsContainer.visible).toBe(true);
        expect(rack.frameGraphics.visible).toBe(true);
        expect(rack.highlightGraphics.visible).toBe(true);

        rack.destroy({ children: true });
      }
    });

    it('2.2 Ensures populated racks initialize with standard device view and hidden overview badge', () => {
      const rackModel = makeRack('rack_pop', 42, 100, 0, true);
      const rack = new RackContainer(rackModel);
      rack.syncDevices(rackModel.devices, catalog);

      expect(rack.currentLOD).toBe(LODTier.STANDARD);
      expect(rack.badgeContainer.visible).toBe(false);

      for (const dev of rack.deviceMap.values()) {
        expect(dev.overviewView.visible).toBe(false);
        expect(dev.standardView.visible).toBe(true);
        expect(dev.detailedView.visible).toBe(false);
      }

      rack.destroy({ children: true });
    });

    it('2.3 Validates bidirectional LOD transitions preserve badge visibility invariants', () => {
      const rackModel = makeRack('rack_trans', 42, 0, 0, true);
      const rack = new RackContainer(rackModel);
      rack.syncDevices(rackModel.devices, catalog);

      // Start: STANDARD
      expect(rack.badgeContainer.visible).toBe(false);

      // Transition to OVERVIEW
      rack.setLOD(LODTier.OVERVIEW);
      expect(rack.currentLOD).toBe(LODTier.OVERVIEW);
      expect(rack.badgeContainer.visible).toBe(true);
      expect(rack.railsGraphics.visible).toBe(false);
      expect(rack.uSlotsContainer.visible).toBe(false);

      // Transition back to STANDARD
      rack.setLOD(LODTier.STANDARD);
      expect(rack.currentLOD).toBe(LODTier.STANDARD);
      expect(rack.badgeContainer.visible).toBe(false);
      expect(rack.railsGraphics.visible).toBe(true);
      expect(rack.uSlotsContainer.visible).toBe(true);

      // Transition to DETAILED
      rack.setLOD(LODTier.DETAILED);
      expect(rack.currentLOD).toBe(LODTier.DETAILED);
      expect(rack.badgeContainer.visible).toBe(false);
      expect(rack.railsGraphics.visible).toBe(true);
      expect(rack.uSlotsContainer.visible).toBe(true);

      // Transition DETAILED -> OVERVIEW directly
      rack.setLOD(LODTier.OVERVIEW);
      expect(rack.badgeContainer.visible).toBe(true);
      expect(rack.railsGraphics.visible).toBe(false);

      // Transition OVERVIEW -> DETAILED directly
      rack.setLOD(LODTier.DETAILED);
      expect(rack.badgeContainer.visible).toBe(false);
      expect(rack.railsGraphics.visible).toBe(true);

      rack.destroy({ children: true });
    });
  });

  // ==========================================================================
  // Scope 3: Defect 2 - Off-Screen Rack Synchronization via syncVisibleRacks
  // ==========================================================================
  describe('Scope 3: Defect 2 - Off-Screen Rack Synchronization via syncVisibleRacks', () => {
    it('3.1 Synchronizes off-screen racks to DETAILED tier upon entering viewport after zoom-in', () => {
      const sceneGraph = new SceneGraph();
      const racks: RackModel[] = [];
      for (let i = 0; i < 20; i++) {
        racks.push(makeRack(`rack_${i}`, 42, i * 754, 0, true));
      }
      sceneGraph.syncRacks(racks, catalog);

      // Start at standard zoom 1.0 viewing Rack 0
      sceneGraph.updateViewport(1920, 1080, 1.0, (sx, sy) => ({ x: sx, y: sy }));

      const rack0 = sceneGraph.rackContainers.get('rack_0')!;
      const rack18 = sceneGraph.rackContainers.get('rack_18')!; // 18 * 754 = 13572px (culled)

      expect(rack0.visible).toBe(true);
      expect(rack18.visible).toBe(false);
      expect(rack18.currentLOD).toBe(LODTier.STANDARD);

      // Zoom to 1.8x (DETAILED) while viewing Rack 0
      const zoomResult = sceneGraph.updateViewport(1920, 1080, 1.8, (sx, sy) => ({
        x: sx / 1.8,
        y: sy / 1.8,
      }));

      expect(zoomResult.lodChanged).toBe(true);
      expect(sceneGraph.lodManager.currentTier).toBe(LODTier.DETAILED);
      expect(rack0.currentLOD).toBe(LODTier.DETAILED);
      expect(rack18.visible).toBe(false);
      expect(rack18.currentLOD).toBe(LODTier.STANDARD); // Was culled, so skipped by applyLOD

      // Pan camera directly to Rack 18 at zoom 1.8 (lodChanged remains false)
      const panResult = sceneGraph.updateViewport(1920, 1080, 1.8, (sx, sy) => ({
        x: 13300 + sx / 1.8,
        y: sy / 1.8,
      }));

      expect(panResult.lodChanged).toBe(false);
      expect(rack18.visible).toBe(true);
      // DEFECT 2 VERIFICATION: rack18 must be synchronized to DETAILED
      expect(rack18.currentLOD).toBe(LODTier.DETAILED);
      expect(rack18.badgeContainer.visible).toBe(false);
      expect(rack18.railsGraphics.visible).toBe(true);
      expect(rack18.uSlotsContainer.visible).toBe(true);

      // Verify all devices in rack 18 have detailed view visible
      for (const dev of rack18.deviceMap.values()) {
        expect(dev.detailedView.visible).toBe(true);
        expect(dev.overviewView.visible).toBe(false);
      }
    });

    it('3.2 Synchronizes off-screen racks to OVERVIEW tier upon entering viewport after zoom-out', () => {
      const sceneGraph = new SceneGraph();
      const racks: RackModel[] = [];
      for (let i = 0; i < 30; i++) {
        racks.push(makeRack(`rack_${i}`, 42, i * 754, 0, true));
      }
      sceneGraph.syncRacks(racks, catalog);

      // Focus closely on rack 0 at zoom 1.0 (STANDARD)
      sceneGraph.updateViewport(1920, 1080, 1.0, (sx, sy) => ({ x: sx, y: sy }));

      const rack25 = sceneGraph.rackContainers.get('rack_25')!; // 25 * 754 = 18850px
      expect(rack25.visible).toBe(false);
      expect(rack25.currentLOD).toBe(LODTier.STANDARD);

      // Zoom out to 0.2x (OVERVIEW) while focused on rack 0 with narrow viewport
      sceneGraph.updateViewport(500, 500, 0.2, (sx, sy) => ({
        x: sx / 0.2,
        y: sy / 0.2,
      }));

      expect(sceneGraph.lodManager.currentTier).toBe(LODTier.OVERVIEW);
      // Rack 25 at 18850px is still outside 500/0.2 = 2500px viewport
      expect(rack25.visible).toBe(false);
      expect(rack25.currentLOD).toBe(LODTier.STANDARD);

      // Pan to Rack 25 at zoom 0.2x
      sceneGraph.updateViewport(500, 500, 0.2, (sx, sy) => ({
        x: 18500 + sx / 0.2,
        y: sy / 0.2,
      }));

      expect(rack25.visible).toBe(true);
      // DEFECT 2 VERIFICATION: rack25 must be synchronized to OVERVIEW
      expect(rack25.currentLOD).toBe(LODTier.OVERVIEW);
      expect(rack25.badgeContainer.visible).toBe(true);
      expect(rack25.railsGraphics.visible).toBe(false);
      expect(rack25.uSlotsContainer.visible).toBe(false);

      for (const dev of rack25.deviceMap.values()) {
        expect(dev.overviewView.visible).toBe(true);
        expect(dev.standardView.visible).toBe(false);
        expect(dev.detailedView.visible).toBe(false);
      }
    });

    it('3.3 Invariant Oracle: 1,000 random viewport movements maintain 100% LOD consistency across all visible racks', () => {
      const sceneGraph = new SceneGraph();
      const racks: RackModel[] = [];
      for (let i = 0; i < 25; i++) {
        racks.push(makeRack(`rack_${i}`, 42, i * 754, 0, true));
      }
      sceneGraph.syncRacks(racks, catalog);

      let totalVisibleChecks = 0;

      for (let step = 0; step < 1000; step++) {
        // Random zoom between 0.1x and 3.0x
        const zoom = 0.1 + Math.random() * 2.9;
        // Random pan across world X (0 to 20,000px)
        const panX = Math.random() * 20000;

        sceneGraph.updateViewport(1920, 1080, zoom, (sx, sy) => ({
          x: panX + sx / zoom,
          y: sy / zoom,
        }));

        const activeTier = sceneGraph.lodManager.currentTier;

        // Verify INVARIANT: EVERY visible rack MUST have currentLOD === activeTier
        for (const rack of sceneGraph.rackContainers.values()) {
          if (rack.visible) {
            totalVisibleChecks++;
            expect(rack.currentLOD).toBe(activeTier);

            if (activeTier === LODTier.OVERVIEW) {
              expect(rack.badgeContainer.visible).toBe(true);
              expect(rack.railsGraphics.visible).toBe(false);
            } else {
              expect(rack.badgeContainer.visible).toBe(false);
              expect(rack.railsGraphics.visible).toBe(true);
            }
          }
        }
      }

      console.log(`[LOD Oracle] Verified ${totalVisibleChecks} visible rack states across 1,000 viewport transforms.`);
      expect(totalVisibleChecks).toBeGreaterThan(1000);
    });
  });

  // ==========================================================================
  // Scope 4: Defect 4 - DragManager Vertical Raycasting Bounds
  // ==========================================================================
  describe('Scope 4: Defect 4 - DragManager Vertical Raycasting Bounds', () => {
    let sceneGraph: SceneGraph;
    let dragManager: DragManager;
    let bridge: EngineBridge;

    beforeEach(() => {
      sceneGraph = new SceneGraph();
      const racks = [makeRack('rack_0', 42, 0, 0, false)];
      sceneGraph.syncRacks(racks, catalog);
      bridge = EngineBridge.getInstance();
      dragManager = new DragManager(sceneGraph, bridge);
    });

    it('4.1 Ensures dragging far above rack (y < rack.y - 100) returns null target rack', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      const rackHeight = rack.rackHeight; // 42 * 32 + 64 = 1408px

      // Test discrete points strictly less than rack.y - 100 (i.e. y < -100)
      const aboveYCoords = [-101, -150, -200, -500, -1000, -5000, -10000, -50000];

      for (const y of aboveYCoords) {
        const target = dragManager.findTargetRack(rack.x + 200, y);
        expect(target).toBeNull();
      }

      // Drag lifecycle check: start drag and move to y < -100
      dragManager.startDrag({ catalogItem: catalog.get('cisco-9300')! });

      for (const y of aboveYCoords) {
        dragManager.handlePointerMove(rack.x + 200, y);
        expect(dragManager.ghost.isValid).toBe(false);
        expect(dragManager.ghost.reason).toBe('OUTSIDE RACK BOUNDS');
      }

      // Attempt drop at y < -100: must not place or move device
      let commandDispatched = false;
      const unsub = bridge.on('command:executed', () => {
        commandDispatched = true;
      });

      dragManager.handlePointerUp(rack.x + 200, -200);
      expect(commandDispatched).toBe(false);
      expect(dragManager.state).toBeNull();
      expect(dragManager.ghost.visible).toBe(false);

      unsub();
    });

    it('4.2 Ensures dragging far below rack (y > rack.y + rackHeight + 100) returns null target rack', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      const rackHeight = rack.rackHeight; // 1408px
      const thresholdY = rack.y + rackHeight + 100; // 1508px

      // Test discrete points strictly greater than rack.y + rackHeight + 100
      const belowYCoords = [
        thresholdY + 1,
        thresholdY + 50,
        thresholdY + 200,
        thresholdY + 1000,
        5000,
        10000,
        50000,
      ];

      for (const y of belowYCoords) {
        const target = dragManager.findTargetRack(rack.x + 200, y);
        expect(target).toBeNull();
      }

      // Drag lifecycle check
      dragManager.startDrag({ catalogItem: catalog.get('cisco-9300')! });

      for (const y of belowYCoords) {
        dragManager.handlePointerMove(rack.x + 200, y);
        expect(dragManager.ghost.isValid).toBe(false);
        expect(dragManager.ghost.reason).toBe('OUTSIDE RACK BOUNDS');
      }

      let commandDispatched = false;
      const unsub = bridge.on('command:executed', () => {
        commandDispatched = true;
      });

      dragManager.handlePointerUp(rack.x + 200, thresholdY + 200);
      expect(commandDispatched).toBe(false);
      expect(dragManager.state).toBeNull();
      expect(dragManager.ghost.visible).toBe(false);

      unsub();
    });

    it('4.3 Verifies exact margin threshold boundaries (marginY = 50) around rack vertical bounds', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      const rackHeight = rack.rackHeight; // 1408px

      // Top boundary (rack.y = 0, marginY = 50):
      // y = -50 -> in bounds (margin inclusive)
      // y = -51 -> out of bounds
      expect(dragManager.findTargetRack(rack.x + 100, -50)).not.toBeNull();
      expect(dragManager.findTargetRack(rack.x + 100, -50.1)).toBeNull();
      expect(dragManager.findTargetRack(rack.x + 100, -51)).toBeNull();

      // Bottom boundary (rack.y + rackHeight = 1408, marginY = 50):
      // y = 1408 + 50 = 1458 -> in bounds
      // y = 1458.1 -> out of bounds
      // y = 1459 -> out of bounds
      expect(dragManager.findTargetRack(rack.x + 100, 1458)).not.toBeNull();
      expect(dragManager.findTargetRack(rack.x + 100, 1458.1)).toBeNull();
      expect(dragManager.findTargetRack(rack.x + 100, 1459)).toBeNull();
    });

    it('4.4 Fuzzes 2,000 random vertical coordinates far outside bounds (y < -100 or y > rackHeight + 100)', () => {
      const rack = sceneGraph.rackContainers.get('rack_0')!;
      const rackHeight = rack.rackHeight;
      let nullHits = 0;

      for (let i = 0; i < 2000; i++) {
        // Half far above [-50000, -101], half far below [rackHeight + 101, 50000]
        const y =
          i % 2 === 0
            ? -101 - Math.random() * 49899
            : rackHeight + 101 + Math.random() * 49899;

        // Inside rack horizontally: 0 to 634
        const x = rack.x + Math.random() * rack.rackWidth;

        const target = dragManager.findTargetRack(x, y);
        if (target === null) {
          nullHits++;
        }
      }

      expect(nullHits).toBe(2000);
      console.log(`[Vertical Raycast Fuzzing] 2,000/2,000 extreme vertical coordinates correctly returned null.`);
    });
  });
});
