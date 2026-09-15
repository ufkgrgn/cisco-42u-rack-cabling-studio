// ============================================================================
// Challenger M3 Recheck 2: Empirical Adversarial Stress & Invertibility Suite
// ============================================================================
// Focus:
// 1. Device unique instanceId invariance under complex & boundary movements
// 2. Cable endpoint rackId and face synchronization across intra-rack, inter-rack,
//    and dual-face operations
// 3. Intra-rack moves strictly return non-empty _affectedCableIds containing all attached cables
// 4. Complete bitwise invertibility under 50-step undo/redo burst testing and oracle
// 5. Heterogeneous variable U-height racks (1U to 60U) and multi-U devices
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { RackModel, DeviceInstance } from '../../src/core/types';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';
import { RemoveDeviceCommand } from '../../src/core/history/commands/RemoveDeviceCommand';
import { AddCableCommand } from '../../src/core/history/commands/AddCableCommand';
import { validateCableTopologyIntegrity } from '../../src/core/placement';

function buildRack(id: string, totalU = 42, devices: DeviceInstance[] = []): RackModel {
  return {
    id,
    name: `Rack ${id}`,
    totalU,
    widthMm: 600,
    depthMm: 1000,
    maxLoadKg: 1000,
    positionX: 0,
    devices: [...devices],
  };
}

// Canonical topology serializer for oracle comparison (deterministic sorting)
function serializeTopology() {
  const p = useProjectStore.getState().project;
  return JSON.stringify({
    racks: p.racks.map(r => ({
      id: r.id,
      totalU: r.totalU,
      devices: [...r.devices]
        .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
        .map(d => ({
          instanceId: d.instanceId,
          catalogId: d.catalogId,
          rackId: d.rackId,
          startU: d.startU,
          uHeight: d.uHeight,
          face: d.face,
          customLabel: d.customLabel,
          serialNumber: d.serialNumber,
          powerWatts: d.powerWatts,
        })),
    })),
    cables: [...p.cables]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(c => ({
        id: c.id,
        from: { ...c.from },
        to: { ...c.to },
        color: c.color,
        category: c.category,
        routingStyle: c.routingStyle,
        lengthMeters: c.lengthMeters,
      })),
  });
}

describe('Challenger M3 Recheck 2: Empirical Adversarial Testing', () => {
  beforeEach(() => {
    useProjectStore.getState().setProject({
      schemaVersion: 3,
      id: 'proj-recheck-2',
      name: 'M3 Recheck 2 Empirical Validation',
      metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01', author: 'Challenger Recheck 2', generator: 'Test' },
      activeRackId: 'rack-A',
      racks: [
        buildRack('rack-A', 42, [
          {
            instanceId: 'dev-sw-core-01',
            catalogId: 'cisco-catalyst-9300',
            rackId: 'rack-A',
            startU: 10,
            uHeight: 1,
            face: 'front',
            customLabel: 'Core-Switch-01',
            serialNumber: 'FOC2411A001',
            powerWatts: 350,
          },
          {
            instanceId: 'dev-sw-dist-01',
            catalogId: 'cisco-catalyst-9300',
            rackId: 'rack-A',
            startU: 20,
            uHeight: 1,
            face: 'front',
            customLabel: 'Dist-Switch-01',
            serialNumber: 'FOC2411A002',
            powerWatts: 350,
          },
          {
            instanceId: 'dev-srv-storage-01',
            catalogId: 'dell-poweredge-r740',
            rackId: 'rack-A',
            startU: 30,
            uHeight: 2,
            face: 'rear',
            customLabel: 'Storage-Server-01',
            serialNumber: 'DELL-740-001',
            powerWatts: 750,
          },
        ]),
        buildRack('rack-B', 48, [
          {
            instanceId: 'dev-sw-leaf-01',
            catalogId: 'cisco-nexus-93180yc-fx',
            rackId: 'rack-B',
            startU: 40,
            uHeight: 1,
            face: 'front',
            customLabel: 'Leaf-Switch-01',
            serialNumber: 'NEX93180-01',
            powerWatts: 450,
          },
        ]),
        buildRack('rack-C', 60, []),
        buildRack('rack-edge', 1, [
          {
            instanceId: 'dev-edge-iot-01',
            catalogId: 'cisco-catalyst-9300',
            rackId: 'rack-edge',
            startU: 1,
            uHeight: 1,
            face: 'front',
            customLabel: '1U-Edge-Device',
            serialNumber: 'EDGE-1U-001',
            powerWatts: 50,
          },
        ]),
      ],
      cables: [
        // C1: Intra-rack cable in rack-A (dev-sw-core-01 to dev-sw-dist-01)
        {
          id: 'cable-core-dist',
          from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p1', face: 'front' },
          to: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-dist-01', portId: 'p1', face: 'front' },
          color: 'Blue',
          category: 'copper',
          routingStyle: 'structured',
          lengthMeters: 1.2,
        },
        // C2: Inter-rack cable (dev-sw-core-01 in rack-A to dev-sw-leaf-01 in rack-B)
        {
          id: 'cable-core-leaf',
          from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p2', face: 'front' },
          to: { rackId: 'rack-B', deviceInstanceId: 'dev-sw-leaf-01', portId: 'p1', face: 'front' },
          color: 'Green',
          category: 'fiber',
          routingStyle: 'structured',
          lengthMeters: 5.0,
        },
        // C3: Loopback on dev-sw-core-01
        {
          id: 'cable-core-loopback',
          from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p23', face: 'front' },
          to: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p24', face: 'front' },
          color: 'Yellow',
          category: 'copper',
          routingStyle: 'direct',
          lengthMeters: 0.3,
        },
        // C4: Cross-face intra-rack cable (dev-sw-dist-01 front to dev-srv-storage-01 rear)
        {
          id: 'cable-dist-storage',
          from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-dist-01', portId: 'p2', face: 'front' },
          to: { rackId: 'rack-A', deviceInstanceId: 'dev-srv-storage-01', portId: 'nic1', face: 'rear' },
          color: 'Orange',
          category: 'copper',
          routingStyle: 'structured',
          lengthMeters: 2.1,
        },
      ],
      customCatalog: {},
    });
    useHistoryStore.getState().clearHistory();
  });

  // ===========================================================================
  // Focus 1: Device Identity Strict Invariance
  // ===========================================================================
  describe('Focus 1: Device Unique instanceId Strict Preservation', () => {
    it('1.1 Preserves unique instanceId, customLabel, serialNumber, and powerWatts across multi-hop 4-rack migration', () => {
      const history = useHistoryStore.getState();

      // Migrate dev-sw-core-01: rack-A (U10) -> rack-B (U1) -> rack-C (U55) -> rack-A (U40)
      const hops = [
        { targetRackId: 'rack-B', targetStartU: 1, expectedRack: 'rack-B', expectedU: 1 },
        { targetRackId: 'rack-C', targetStartU: 55, expectedRack: 'rack-C', expectedU: 55 },
        { targetRackId: 'rack-A', targetStartU: 40, expectedRack: 'rack-A', expectedU: 40 },
      ];

      for (const hop of hops) {
        const cmd = new MoveDeviceCommand({
          instanceId: 'dev-sw-core-01',
          targetRackId: hop.targetRackId,
          targetStartU: hop.targetStartU,
        });
        const res = history.executeCommand(cmd);
        expect(res.success).toBe(true);

        const project = useProjectStore.getState().project;
        const targetRack = project.racks.find(r => r.id === hop.expectedRack)!;
        const dev = targetRack.devices.find(d => d.instanceId === 'dev-sw-core-01');

        expect(dev).toBeDefined();
        expect(dev!.instanceId).toBe('dev-sw-core-01');
        expect(dev!.customLabel).toBe('Core-Switch-01');
        expect(dev!.serialNumber).toBe('FOC2411A001');
        expect(dev!.powerWatts).toBe(350);
        expect(dev!.catalogId).toBe('cisco-catalyst-9300');
        expect(dev!.startU).toBe(hop.expectedU);

        // Ensure device is in NO other rack
        for (const r of project.racks) {
          if (r.id !== hop.expectedRack) {
            expect(r.devices.some(d => d.instanceId === 'dev-sw-core-01')).toBe(false);
          }
        }
      }

      // Undo all 3 hops and verify perfect step-by-step restoration
      history.undo(); // back to rack-C U55
      let devNow = useProjectStore.getState().project.racks.find(r => r.id === 'rack-C')!.devices.find(d => d.instanceId === 'dev-sw-core-01');
      expect(devNow?.startU).toBe(55);
      expect(devNow?.instanceId).toBe('dev-sw-core-01');

      history.undo(); // back to rack-B U1
      devNow = useProjectStore.getState().project.racks.find(r => r.id === 'rack-B')!.devices.find(d => d.instanceId === 'dev-sw-core-01');
      expect(devNow?.startU).toBe(1);
      expect(devNow?.instanceId).toBe('dev-sw-core-01');

      history.undo(); // back to rack-A U10
      devNow = useProjectStore.getState().project.racks.find(r => r.id === 'rack-A')!.devices.find(d => d.instanceId === 'dev-sw-core-01');
      expect(devNow?.startU).toBe(10);
      expect(devNow?.instanceId).toBe('dev-sw-core-01');
      expect(devNow?.customLabel).toBe('Core-Switch-01');
    });

    it('1.2 Moving one device never mutates or shifts sibling devices in source or target racks', () => {
      const history = useHistoryStore.getState();

      const initialDist = { ...useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-sw-dist-01')! };
      const initialStorage = { ...useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-srv-storage-01')! };
      const initialLeaf = { ...useProjectStore.getState().project.racks[1]!.devices.find(d => d.instanceId === 'dev-sw-leaf-01')! };

      // Move dev-sw-core-01 to rack-B U25
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-B',
        targetStartU: 25,
      });
      expect(history.executeCommand(cmd).success).toBe(true);

      const pAfter = useProjectStore.getState().project;
      const afterDist = pAfter.racks[0]!.devices.find(d => d.instanceId === 'dev-sw-dist-01')!;
      const afterStorage = pAfter.racks[0]!.devices.find(d => d.instanceId === 'dev-srv-storage-01')!;
      const afterLeaf = pAfter.racks[1]!.devices.find(d => d.instanceId === 'dev-sw-leaf-01')!;

      expect(afterDist).toEqual(initialDist);
      expect(afterStorage).toEqual(initialStorage);
      expect(afterLeaf).toEqual(initialLeaf);
    });

    it('1.3 Multi-U device partial self-overlap move maintains identity and respects self-exemption', () => {
      const history = useHistoryStore.getState();

      // dev-srv-storage-01 is 2U (occupies U30-U31 rear in rack-A)
      // Shift up by 1U to U31 (occupies U31-U32 rear, overlaps U31 with self)
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-srv-storage-01',
        targetRackId: 'rack-A',
        targetStartU: 31,
        targetFace: 'rear',
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-srv-storage-01')!;
      expect(dev.instanceId).toBe('dev-srv-storage-01');
      expect(dev.startU).toBe(31);
      expect(dev.uHeight).toBe(2);
      expect(dev.face).toBe('rear');
    });

    it('1.4 Collision rejection leaves device identity, slot, and history completely uncommitted', () => {
      const history = useHistoryStore.getState();
      const initialDev = { ...useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-sw-core-01')! };

      // Try to move dev-sw-core-01 to U20 (occupied by dev-sw-dist-01 on front)
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 20,
        targetFace: 'front',
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Collision');

      const devAfter = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-sw-core-01')!;
      expect(devAfter).toEqual(initialDev);
      expect(history.canUndo).toBe(false);
    });
  });

  // ===========================================================================
  // Focus 2: Cable Endpoint Synchronization Matrix (Intra-Rack, Inter-Rack, Flips)
  // ===========================================================================
  describe('Focus 2: Cable Endpoint Synchronization Matrix', () => {
    it('2.1 Intra-rack move updates endpoint rackId and face for all attached cables', () => {
      const history = useHistoryStore.getState();

      // Move dev-sw-core-01 from U10 front to U1 front in rack-A
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 1,
        targetFace: 'front',
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const cables = useProjectStore.getState().project.cables;
      const cCoreDist = cables.find(c => c.id === 'cable-core-dist')!;
      const cCoreLeaf = cables.find(c => c.id === 'cable-core-leaf')!;
      const cLoopback = cables.find(c => c.id === 'cable-core-loopback')!;
      const cDistStorage = cables.find(c => c.id === 'cable-dist-storage')!;

      // Intra-rack cable (dev-sw-core-01 <-> dev-sw-dist-01)
      expect(cCoreDist.from.rackId).toBe('rack-A');
      expect(cCoreDist.from.deviceInstanceId).toBe('dev-sw-core-01');
      expect(cCoreDist.from.face).toBe('front');
      expect(cCoreDist.to.rackId).toBe('rack-A');
      expect(cCoreDist.to.deviceInstanceId).toBe('dev-sw-dist-01');

      // Inter-rack cable (dev-sw-core-01 in rack-A <-> dev-sw-leaf-01 in rack-B)
      expect(cCoreLeaf.from.rackId).toBe('rack-A');
      expect(cCoreLeaf.to.rackId).toBe('rack-B');

      // Loopback cable
      expect(cLoopback.from.rackId).toBe('rack-A');
      expect(cLoopback.to.rackId).toBe('rack-A');

      // Unrelated cable untouched
      expect(cDistStorage.from.rackId).toBe('rack-A');
      expect(cDistStorage.to.rackId).toBe('rack-A');
      expect(cDistStorage.to.face).toBe('rear');

      // Topology check
      expect(validateCableTopologyIntegrity(cables, useProjectStore.getState().project.racks).valid).toBe(true);
    });

    it('2.2 Inter-rack move updates only the moved device endpoint rackId, keeping remote endpoint intact', () => {
      const history = useHistoryStore.getState();

      // Move dev-sw-core-01 to rack-C U10
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-C',
        targetStartU: 10,
      });
      expect(history.executeCommand(cmd).success).toBe(true);

      const cables = useProjectStore.getState().project.cables;
      const cCoreDist = cables.find(c => c.id === 'cable-core-dist')!;
      const cCoreLeaf = cables.find(c => c.id === 'cable-core-leaf')!;
      const cLoopback = cables.find(c => c.id === 'cable-core-loopback')!;

      // cCoreDist was intra-rack (rack-A <-> rack-A), now inter-rack (rack-C <-> rack-A)
      expect(cCoreDist.from.rackId).toBe('rack-C');
      expect(cCoreDist.to.rackId).toBe('rack-A');

      // cCoreLeaf was inter-rack (rack-A <-> rack-B), now inter-rack (rack-C <-> rack-B)
      expect(cCoreLeaf.from.rackId).toBe('rack-C');
      expect(cCoreLeaf.to.rackId).toBe('rack-B');

      // cLoopback moved entirely to rack-C
      expect(cLoopback.from.rackId).toBe('rack-C');
      expect(cLoopback.to.rackId).toBe('rack-C');

      expect(validateCableTopologyIntegrity(cables, useProjectStore.getState().project.racks).valid).toBe(true);
    });

    it('2.3 Multi-device migration: moving both ends of a cable sequentially updates topology dynamically', () => {
      const history = useHistoryStore.getState();

      // cable-core-dist connects dev-sw-core-01 (rack-A) and dev-sw-dist-01 (rack-A)
      // Step 1: Move dev-sw-core-01 to rack-B U1 -> Cable becomes inter-rack (rack-B <-> rack-A)
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-sw-core-01', targetRackId: 'rack-B', targetStartU: 1 })).success).toBe(true);
      let c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-B');
      expect(c.to.rackId).toBe('rack-A');

      // Step 2: Move dev-sw-dist-01 to rack-B U15 -> Cable becomes intra-rack again (rack-B <-> rack-B)
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-sw-dist-01', targetRackId: 'rack-B', targetStartU: 15 })).success).toBe(true);
      c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-B');
      expect(c.to.rackId).toBe('rack-B');

      // Step 3: Move dev-sw-dist-01 to rack-C U10 -> Cable becomes inter-rack (rack-B <-> rack-C)
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-sw-dist-01', targetRackId: 'rack-C', targetStartU: 10 })).success).toBe(true);
      c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-B');
      expect(c.to.rackId).toBe('rack-C');

      expect(validateCableTopologyIntegrity(useProjectStore.getState().project.cables, useProjectStore.getState().project.racks).valid).toBe(true);

      // Undo Step 3
      history.undo();
      c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-B');
      expect(c.to.rackId).toBe('rack-B');

      // Undo Step 2
      history.undo();
      c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-B');
      expect(c.to.rackId).toBe('rack-A');

      // Undo Step 1
      history.undo();
      c = useProjectStore.getState().project.cables.find(c => c.id === 'cable-core-dist')!;
      expect(c.from.rackId).toBe('rack-A');
      expect(c.to.rackId).toBe('rack-A');
    });

    it('2.4 Dual-face flips: front->rear and rear->front flips accurately update cable endpoint face tags', () => {
      const history = useHistoryStore.getState();

      // Flip dev-sw-core-01 to rear face at U12 in rack-A
      const cmd1 = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 12,
        targetFace: 'rear',
      });
      expect(history.executeCommand(cmd1).success).toBe(true);

      let cables = useProjectStore.getState().project.cables;
      expect(cables.find(c => c.id === 'cable-core-dist')!.from.face).toBe('rear');
      expect(cables.find(c => c.id === 'cable-core-leaf')!.from.face).toBe('rear');
      expect(cables.find(c => c.id === 'cable-core-loopback')!.from.face).toBe('rear');
      expect(cables.find(c => c.id === 'cable-core-loopback')!.to.face).toBe('rear');

      // Flip dev-srv-storage-01 from rear face to front face at U5 in rack-A
      const cmd2 = new MoveDeviceCommand({
        instanceId: 'dev-srv-storage-01',
        targetRackId: 'rack-A',
        targetStartU: 5,
        targetFace: 'front',
      });
      expect(history.executeCommand(cmd2).success).toBe(true);

      cables = useProjectStore.getState().project.cables;
      // cable-dist-storage connected to dev-srv-storage-01 at to endpoint
      expect(cables.find(c => c.id === 'cable-dist-storage')!.to.face).toBe('front');

      // Undo cmd2
      history.undo();
      cables = useProjectStore.getState().project.cables;
      expect(cables.find(c => c.id === 'cable-dist-storage')!.to.face).toBe('rear');

      // Undo cmd1
      history.undo();
      cables = useProjectStore.getState().project.cables;
      expect(cables.find(c => c.id === 'cable-core-dist')!.from.face).toBe('front');
      expect(cables.find(c => c.id === 'cable-core-loopback')!.from.face).toBe('front');
      expect(cables.find(c => c.id === 'cable-core-loopback')!.to.face).toBe('front');
    });

    it('2.5 Saturated 24-cable port density retains all 24 cable endpoints across moves and flips', () => {
      const history = useHistoryStore.getState();

      // Place 24 dummy target devices in rack-C and wire 24 cables from dev-sw-core-01
      useProjectStore.getState().mutate((draft) => {
        const rackC = draft.racks.find(r => r.id === 'rack-C')!;
        for (let i = 1; i <= 24; i++) {
          rackC.devices.push({
            instanceId: `dev-target-${i}`,
            catalogId: 'cisco-catalyst-9300',
            rackId: 'rack-C',
            startU: i * 2,
            uHeight: 1,
            face: 'front',
          });
          draft.cables.push({
            id: `cable-dense-${i}`,
            from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: `p${i}`, face: 'front' },
            to: { rackId: 'rack-C', deviceInstanceId: `dev-target-${i}`, portId: 'p1', face: 'front' },
            color: 'Blue',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.0,
          });
        }
      });

      // Move dev-sw-core-01 to rack-B U30 on rear face
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-B',
        targetStartU: 30,
        targetFace: 'rear',
      });
      const res = history.executeCommand(moveCmd);
      expect(res.success).toBe(true);

      // Verify all 24 cables + 3 pre-existing cables attached to dev-sw-core-01 were updated
      const cables = useProjectStore.getState().project.cables;
      for (let i = 1; i <= 24; i++) {
        const c = cables.find(c => c.id === `cable-dense-${i}`)!;
        expect(c.from.rackId).toBe('rack-B');
        expect(c.from.face).toBe('rear');
        expect(c.to.rackId).toBe('rack-C');
      }

      expect(res.affectedCableIds!.length).toBe(27); // 24 dense cables + 3 initial core cables
      expect(validateCableTopologyIntegrity(cables, useProjectStore.getState().project.racks).valid).toBe(true);

      // Undo and verify all 24 cables reverted to rack-A front
      history.undo();
      const revertedCables = useProjectStore.getState().project.cables;
      for (let i = 1; i <= 24; i++) {
        const c = revertedCables.find(c => c.id === `cable-dense-${i}`)!;
        expect(c.from.rackId).toBe('rack-A');
        expect(c.from.face).toBe('front');
      }
    });

    it('2.6 Parallel cables and loopback cables deduplicate correctly in affectedCableIds', () => {
      const history = useHistoryStore.getState();

      // Add 3 parallel cables between dev-sw-core-01 and dev-sw-dist-01
      useProjectStore.getState().mutate((draft) => {
        draft.cables.push(
          {
            id: 'parallel-1',
            from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p10', face: 'front' },
            to: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-dist-01', portId: 'p10', face: 'front' },
            color: 'Yellow',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.0,
          },
          {
            id: 'parallel-2',
            from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p11', face: 'front' },
            to: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-dist-01', portId: 'p11', face: 'front' },
            color: 'Yellow',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.0,
          }
        );
      });

      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-C',
        targetStartU: 1,
      });
      const res = history.executeCommand(moveCmd);
      expect(res.success).toBe(true);

      // Ensure no duplicate IDs in affectedCableIds
      const uniqueIds = new Set(res.affectedCableIds);
      expect(uniqueIds.size).toBe(res.affectedCableIds!.length);
      expect(res.affectedCableIds).toContain('parallel-1');
      expect(res.affectedCableIds).toContain('parallel-2');
      expect(res.affectedCableIds).toContain('cable-core-loopback');
    });
  });

  // ===========================================================================
  // Focus 3: Intra-Rack Moves Return Non-Empty _affectedCableIds
  // ===========================================================================
  describe('Focus 3: Intra-Rack Moves Return Non-Empty _affectedCableIds', () => {
    it('3.1 Intra-rack move returns non-empty _affectedCableIds with all attached cables', () => {
      const history = useHistoryStore.getState();

      // dev-sw-core-01 has 3 attached cables: cable-core-dist, cable-core-leaf, cable-core-loopback
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 1, // slot 1 in rack-A is free
      });
      const res = history.executeCommand(cmd);

      expect(res.success).toBe(true);
      expect(res.affectedCableIds).toBeDefined();
      expect(res.affectedCableIds!.length).toBe(3);
      expect(res.affectedCableIds).toContain('cable-core-dist');
      expect(res.affectedCableIds).toContain('cable-core-leaf');
      expect(res.affectedCableIds).toContain('cable-core-loopback');
      // Unattached cable-dist-storage must NOT be present
      expect(res.affectedCableIds).not.toContain('cable-dist-storage');
    });

    it('3.2 Undo of intra-rack move returns non-empty _affectedCableIds with all attached cables', () => {
      const history = useHistoryStore.getState();

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 1,
      });
      history.executeCommand(cmd);

      const undoRes = history.undo();
      expect(undoRes.success).toBe(true);
      expect(undoRes.affectedCableIds).toBeDefined();
      expect(undoRes.affectedCableIds!.length).toBe(3);
      expect(undoRes.affectedCableIds).toContain('cable-core-dist');
      expect(undoRes.affectedCableIds).toContain('cable-core-leaf');
      expect(undoRes.affectedCableIds).toContain('cable-core-loopback');
    });

    it('3.3 Redo of intra-rack move returns non-empty _affectedCableIds with all attached cables', () => {
      const history = useHistoryStore.getState();

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 1,
      });
      history.executeCommand(cmd);
      history.undo();

      const redoRes = history.redo();
      expect(redoRes.success).toBe(true);
      expect(redoRes.affectedCableIds).toBeDefined();
      expect(redoRes.affectedCableIds!.length).toBe(3);
      expect(redoRes.affectedCableIds).toContain('cable-core-dist');
    });

    it('3.4 Device with zero cables returns empty array [] for _affectedCableIds on intra-rack move', () => {
      const history = useHistoryStore.getState();

      // Place a device with zero cables
      const placeCmd = new PlaceDeviceCommand({
        rackId: 'rack-A',
        catalogId: 'cisco-catalyst-9300',
        startU: 35,
        instanceId: 'dev-uncabled-01',
      });
      expect(history.executeCommand(placeCmd).success).toBe(true);

      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-uncabled-01',
        targetRackId: 'rack-A',
        targetStartU: 38,
      });
      const moveRes = history.executeCommand(moveCmd);
      expect(moveRes.success).toBe(true);
      expect(moveRes.affectedCableIds).toEqual([]);

      const undoRes = history.undo();
      expect(undoRes.affectedCableIds).toEqual([]);
    });
  });

  // ===========================================================================
  // Focus 4: Undo/Redo Inversion Burst Testing & State Oracle
  // ===========================================================================
  describe('Focus 4: Complete Invertibility on Undo/Redo Burst Testing', () => {
    it('4.1 50-Step Undo/Redo Burst Oracle: Perfect bitwise state parity across forward, backward, and replay passes', () => {
      const history = useHistoryStore.getState();
      const racks = ['rack-A', 'rack-B', 'rack-C'];
      const faces: ('front' | 'rear')[] = ['front', 'rear'];
      const snapshots: string[] = [];

      snapshots.push(serializeTopology());

      // Perform 50 operations with diverse targets
      for (let step = 1; step <= 50; step++) {
        const targetRackId = racks[step % racks.length]!;
        const targetFace = faces[(step + (step % 2)) % 2]!;
        // Generate valid slot: rack-A has devices at 20, 30; rack-B has leaf at 40; rack-C is 60U empty
        const slotCandidates = targetRackId === 'rack-C'
          ? [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
          : targetRackId === 'rack-B'
            ? [2, 6, 12, 18, 24, 30, 36, 45]
            : [1, 3, 5, 7, 12, 14, 16, 25, 27, 35, 37, 40];

        const targetStartU = slotCandidates[step % slotCandidates.length]!;

        const cmd = new MoveDeviceCommand({
          instanceId: 'dev-sw-core-01',
          targetRackId,
          targetStartU,
          targetFace,
        });

        const res = history.executeCommand(cmd);
        if (!res.success) {
          // If candidate hit an existing slot on same face, choose a guaranteed free slot in rack-C
          const fallback = new MoveDeviceCommand({
            instanceId: 'dev-sw-core-01',
            targetRackId: 'rack-C',
            targetStartU: 1 + (step % 50),
            targetFace,
          });
          const fbRes = history.executeCommand(fallback);
          expect(fbRes.success).toBe(true);
        }

        // Validate topology at every step
        const p = useProjectStore.getState().project;
        const check = validateCableTopologyIntegrity(p.cables, p.racks);
        expect(check.valid).toBe(true);
        expect(check.danglingCables).toEqual([]);

        snapshots.push(serializeTopology());
      }

      expect(snapshots.length).toBe(51);

      // Deep Undo Burst: unwind all 50 operations step-by-step
      for (let step = 50; step >= 1; step--) {
        const undoRes = history.undo();
        expect(undoRes.success).toBe(true);
        const currentSnapshot = serializeTopology();
        expect(currentSnapshot).toBe(snapshots[step - 1]);
      }

      // Deep Redo Burst: replay all 50 operations step-by-step
      for (let step = 1; step <= 50; step++) {
        const redoRes = history.redo();
        expect(redoRes.success).toBe(true);
        const currentSnapshot = serializeTopology();
        expect(currentSnapshot).toBe(snapshots[step]);
      }

      // Final unwind back to initial pristine state
      for (let step = 50; step >= 1; step--) {
        history.undo();
      }
      expect(serializeTopology()).toBe(snapshots[0]);
    });

    it('4.2 Interleaved Composite Lifecycle (Place -> Wire -> Move -> Remove -> Undo all -> Redo all)', () => {
      const history = useHistoryStore.getState();
      const initialSnapshot = serializeTopology();

      // Step 1: Place a new switch in rack-C
      const placeCmd = new PlaceDeviceCommand({
        rackId: 'rack-C',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        face: 'front',
        instanceId: 'dev-sw-new-01',
      });
      expect(history.executeCommand(placeCmd).success).toBe(true);

      // Step 2: Wire a cable between dev-sw-core-01 and dev-sw-new-01
      const wireCmd = new AddCableCommand({
        id: 'cable-test-01',
        from: { rackId: 'rack-A', deviceInstanceId: 'dev-sw-core-01', portId: 'p12', face: 'front' },
        to: { rackId: 'rack-C', deviceInstanceId: 'dev-sw-new-01', portId: 'p1', face: 'front' },
        color: 'Purple',
        category: 'fiber',
        routingStyle: 'structured',
        lengthMeters: 1.0,
      });
      expect(history.executeCommand(wireCmd).success).toBe(true);

      // Step 3: Move dev-sw-new-01 from rack-C U10 to rack-B U20
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-new-01',
        targetRackId: 'rack-B',
        targetStartU: 20,
        targetFace: 'rear',
      });
      expect(history.executeCommand(moveCmd).success).toBe(true);

      // Cable should now point to rack-B U20 rear
      const cableAfterMove = useProjectStore.getState().project.cables.find(c => c.color === 'Purple')!;
      expect(cableAfterMove.to.rackId).toBe('rack-B');
      expect(cableAfterMove.to.face).toBe('rear');

      // Step 4: Remove dev-sw-new-01 (detaches the purple cable)
      const removeCmd = new RemoveDeviceCommand('dev-sw-new-01');
      expect(history.executeCommand(removeCmd).success).toBe(true);
      expect(useProjectStore.getState().project.cables.some(c => c.color === 'Purple')).toBe(false);

      // Undo Step 4 (Remove) -> restores device in rack-B U20 rear and restores purple cable
      history.undo();
      const restoredCable1 = useProjectStore.getState().project.cables.find(c => c.color === 'Purple')!;
      expect(restoredCable1).toBeDefined();
      expect(restoredCable1.to.rackId).toBe('rack-B');
      expect(restoredCable1.to.face).toBe('rear');

      // Undo Step 3 (Move) -> restores device in rack-C U10 front and cable to rack-C front
      history.undo();
      const restoredCable2 = useProjectStore.getState().project.cables.find(c => c.color === 'Purple')!;
      expect(restoredCable2.to.rackId).toBe('rack-C');
      expect(restoredCable2.to.face).toBe('front');

      // Undo Step 2 (Wire) -> cable removed
      history.undo();
      expect(useProjectStore.getState().project.cables.some(c => c.color === 'Purple')).toBe(false);

      // Undo Step 1 (Place) -> device removed
      history.undo();
      expect(useProjectStore.getState().project.racks.find(r => r.id === 'rack-C')!.devices.some(d => d.instanceId === 'dev-sw-new-01')).toBe(false);

      // Verify exact equivalence with initial snapshot
      expect(serializeTopology()).toBe(initialSnapshot);
    });

    it('4.3 Rapid Jitter Inversion: 30 rapid back-and-forth moves between U1 and U2 produce zero state drift', () => {
      const history = useHistoryStore.getState();
      const initialSnapshot = serializeTopology();

      for (let i = 0; i < 30; i++) {
        const targetStartU = i % 2 === 0 ? 1 : 2;
        const cmd = new MoveDeviceCommand({
          instanceId: 'dev-sw-core-01',
          targetRackId: 'rack-C',
          targetStartU,
        });
        expect(history.executeCommand(cmd).success).toBe(true);
      }

      // Undo all 30 jitter steps
      for (let i = 0; i < 30; i++) {
        history.undo();
      }

      expect(serializeTopology()).toBe(initialSnapshot);
    });
  });

  // ===========================================================================
  // Focus 5: Heterogeneous Variable U-Height (1U to 60U) Bounds
  // ===========================================================================
  describe('Focus 5: Variable U-Height Racks and Boundary Moving', () => {
    it('5.1 Moving device into 1U rack succeeds at U1 and fails at U2', () => {
      const history = useHistoryStore.getState();

      // Empty rack-edge by moving dev-edge-iot-01 to rack-C U1
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-edge-iot-01', targetRackId: 'rack-C', targetStartU: 1 })).success).toBe(true);

      // Move 1U dev-sw-core-01 into rack-edge at U1 (should succeed)
      const validMove = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-edge',
        targetStartU: 1,
      });
      expect(history.executeCommand(validMove).success).toBe(true);

      const dev = useProjectStore.getState().project.racks.find(r => r.id === 'rack-edge')!.devices[0]!;
      expect(dev.instanceId).toBe('dev-sw-core-01');
      expect(dev.startU).toBe(1);

      // Try moving 2U dev-srv-storage-01 into 1U rack-edge at U1 (should fail: 1+2-1=2 > 1)
      const invalidMultiUMove = new MoveDeviceCommand({
        instanceId: 'dev-srv-storage-01',
        targetRackId: 'rack-edge',
        targetStartU: 1,
      });
      const res = history.executeCommand(invalidMultiUMove);
      expect(res.success).toBe(false);
      expect(res.error).toContain('out of bounds');

      // Undo valid move
      history.undo();
      expect(useProjectStore.getState().project.racks.find(r => r.id === 'rack-A')!.devices.some(d => d.instanceId === 'dev-sw-core-01')).toBe(true);
    });

    it('5.2 Moving device to U60 in 60U rack succeeds, but fails at U61', () => {
      const history = useHistoryStore.getState();

      // Move dev-sw-core-01 to U60 in 60U rack-C
      const move60 = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-C',
        targetStartU: 60,
      });
      expect(history.executeCommand(move60).success).toBe(true);

      // Move 2U dev-srv-storage-01 to U60 in 60U rack-C (should fail: 60+2-1 = 61 > 60)
      const move60MultiU = new MoveDeviceCommand({
        instanceId: 'dev-srv-storage-01',
        targetRackId: 'rack-C',
        targetStartU: 60,
      });
      const resMultiU = history.executeCommand(move60MultiU);
      expect(resMultiU.success).toBe(false);
      expect(resMultiU.error).toContain('out of bounds');

      // Move dev-sw-core-01 to U61 in rack-C (should fail)
      const move61 = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-C',
        targetStartU: 61,
      });
      const res61 = history.executeCommand(move61);
      expect(res61.success).toBe(false);
      expect(res61.error).toContain('out of bounds');
    });
  });

  // ===========================================================================
  // Focus 6: Adversarial Boundary Payloads, Fault-Injection & Utility Stress
  // ===========================================================================
  describe('Focus 6: Boundary Payloads, Fault-Injection & Direct Utility Stress', () => {
    it('6.1 Idempotent move to exact same slot and face succeeds, preserves identity and cables', () => {
      const history = useHistoryStore.getState();

      // dev-sw-core-01 is currently at rack-A U10 front
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-A',
        targetStartU: 10,
        targetFace: 'front',
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-sw-core-01')!;
      expect(dev.instanceId).toBe('dev-sw-core-01');
      expect(dev.startU).toBe(10);
      expect(dev.face).toBe('front');

      // Still returns all 3 attached cables in affectedCableIds
      expect(res.affectedCableIds!.length).toBe(3);
      expect(res.affectedCableIds).toContain('cable-core-dist');
      expect(res.affectedCableIds).toContain('cable-core-leaf');
      expect(res.affectedCableIds).toContain('cable-core-loopback');

      // Undo is idempotent
      expect(history.undo().success).toBe(true);
      expect(dev.startU).toBe(10);
    });

    it('6.2 Rejects non-integer, zero, negative, and NaN targetStartU specs without mutating state', () => {
      const history = useHistoryStore.getState();
      const initialSnapshot = serializeTopology();

      const invalidStartUs = [0, -1, -42, 1.5, 10.2, NaN, Infinity, -Infinity];

      for (const invalidU of invalidStartUs) {
        const cmd = new MoveDeviceCommand({
          instanceId: 'dev-sw-core-01',
          targetRackId: 'rack-A',
          targetStartU: invalidU,
        });
        const res = history.executeCommand(cmd);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/out of bounds/i);
        expect(serializeTopology()).toBe(initialSnapshot);
        expect(history.canUndo).toBe(false);
      }
    });

    it('6.3 Fault-injection: non-existent instanceId and targetRackId fail cleanly', () => {
      const history = useHistoryStore.getState();

      // Non-existent device
      const ghostDevCmd = new MoveDeviceCommand({
        instanceId: 'dev-nonexistent-999',
        targetRackId: 'rack-A',
        targetStartU: 1,
      });
      const res1 = history.executeCommand(ghostDevCmd);
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('not found in any rack');

      // Non-existent target rack
      const ghostRackCmd = new MoveDeviceCommand({
        instanceId: 'dev-sw-core-01',
        targetRackId: 'rack-phantom-999',
        targetStartU: 1,
      });
      const res2 = history.executeCommand(ghostRackCmd);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Target rack');
    });

    it('6.4 Direct recalculateCableEndpoints tests with edge cases', async () => {
      const { recalculateCableEndpoints } = await import('../../src/core/placement/cableRetention');

      // Test with empty/null cables array
      const emptyRes = recalculateCableEndpoints([] as any, 'dev-test', 'rack-2');
      expect(emptyRes.updatedCables).toEqual([]);
      expect(emptyRes.affectedCableIds).toEqual([]);

      // Test loopback cable deduplication
      const loopCable = {
        id: 'c-loop',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-x', portId: 'p1', face: 'front' as const },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-x', portId: 'p2', face: 'front' as const },
        color: 'Blue',
        category: 'copper' as const,
        routingStyle: 'direct' as const,
      };
      const loopRes = recalculateCableEndpoints([loopCable], 'dev-x', 'rack-5', 'rear');
      expect(loopRes.affectedCableIds).toEqual(['c-loop']);
      expect(loopRes.updatedCables[0]!.from.rackId).toBe('rack-5');
      expect(loopRes.updatedCables[0]!.from.face).toBe('rear');
      expect(loopRes.updatedCables[0]!.to.rackId).toBe('rack-5');
      expect(loopRes.updatedCables[0]!.to.face).toBe('rear');
    });

    it('6.5 Direct validateCableTopologyIntegrity detects orphaned endpoints', async () => {
      const { validateCableTopologyIntegrity } = await import('../../src/core/placement/cableRetention');

      const racks = [
        buildRack('rack-1', 42, [
          { instanceId: 'dev-1', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 1, uHeight: 1, face: 'front' }
        ])
      ];

      // Missing fromRack
      const badFromRack = [{
        id: 'c-bad-1',
        from: { rackId: 'rack-missing', deviceInstanceId: 'dev-1', portId: 'p1', face: 'front' as const },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'p2', face: 'front' as const },
        color: 'Blue', category: 'copper' as const, routingStyle: 'structured' as const,
      }];
      expect(validateCableTopologyIntegrity(badFromRack, racks).valid).toBe(false);

      // Missing fromDevice
      const badFromDev = [{
        id: 'c-bad-2',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-ghost', portId: 'p1', face: 'front' as const },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'p2', face: 'front' as const },
        color: 'Blue', category: 'copper' as const, routingStyle: 'structured' as const,
      }];
      expect(validateCableTopologyIntegrity(badFromDev, racks).valid).toBe(false);

      // Missing toRack
      const badToRack = [{
        id: 'c-bad-3',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'p1', face: 'front' as const },
        to: { rackId: 'rack-missing', deviceInstanceId: 'dev-1', portId: 'p2', face: 'front' as const },
        color: 'Blue', category: 'copper' as const, routingStyle: 'structured' as const,
      }];
      expect(validateCableTopologyIntegrity(badToRack, racks).valid).toBe(false);

      // Missing toDevice
      const badToDev = [{
        id: 'c-bad-4',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'p1', face: 'front' as const },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-ghost', portId: 'p2', face: 'front' as const },
        color: 'Blue', category: 'copper' as const, routingStyle: 'structured' as const,
      }];
      expect(validateCableTopologyIntegrity(badToDev, racks).valid).toBe(false);
    });

    it('6.6 Circular 3-device triangle shift across 3 racks preserves topology and inverts cleanly', () => {
      const history = useHistoryStore.getState();

      // Place 3 interconnected switches in 3 separate racks
      useProjectStore.getState().mutate((draft) => {
        draft.racks = [
          buildRack('rack-1', 42, [
            { instanceId: 'dev-node-A', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 10, uHeight: 1, face: 'front' }
          ]),
          buildRack('rack-2', 42, [
            { instanceId: 'dev-node-B', catalogId: 'cisco-catalyst-9300', rackId: 'rack-2', startU: 10, uHeight: 1, face: 'front' }
          ]),
          buildRack('rack-3', 42, [
            { instanceId: 'dev-node-C', catalogId: 'cisco-catalyst-9300', rackId: 'rack-3', startU: 10, uHeight: 1, face: 'front' }
          ]),
        ];
        draft.cables = [
          {
            id: 'c-AB',
            from: { rackId: 'rack-1', deviceInstanceId: 'dev-node-A', portId: 'p1', face: 'front' },
            to: { rackId: 'rack-2', deviceInstanceId: 'dev-node-B', portId: 'p1', face: 'front' },
            color: 'Blue', category: 'copper', routingStyle: 'structured', lengthMeters: 1.0,
          },
          {
            id: 'c-BC',
            from: { rackId: 'rack-2', deviceInstanceId: 'dev-node-B', portId: 'p2', face: 'front' },
            to: { rackId: 'rack-3', deviceInstanceId: 'dev-node-C', portId: 'p2', face: 'front' },
            color: 'Green', category: 'copper', routingStyle: 'structured', lengthMeters: 1.0,
          },
          {
            id: 'c-CA',
            from: { rackId: 'rack-3', deviceInstanceId: 'dev-node-C', portId: 'p3', face: 'front' },
            to: { rackId: 'rack-1', deviceInstanceId: 'dev-node-A', portId: 'p3', face: 'front' },
            color: 'Yellow', category: 'copper', routingStyle: 'structured', lengthMeters: 1.0,
          },
        ];
      });

      const initialSnapshot = serializeTopology();

      // Shift A -> rack-2 U20
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-node-A', targetRackId: 'rack-2', targetStartU: 20 })).success).toBe(true);
      // Shift B -> rack-3 U20
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-node-B', targetRackId: 'rack-3', targetStartU: 20 })).success).toBe(true);
      // Shift C -> rack-1 U20
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-node-C', targetRackId: 'rack-1', targetStartU: 20 })).success).toBe(true);

      const pMoved = useProjectStore.getState().project;
      const cAB = pMoved.cables.find(c => c.id === 'c-AB')!;
      const cBC = pMoved.cables.find(c => c.id === 'c-BC')!;
      const cCA = pMoved.cables.find(c => c.id === 'c-CA')!;

      // c-AB was rack-1 <-> rack-2, now rack-2 <-> rack-3
      expect(cAB.from.rackId).toBe('rack-2');
      expect(cAB.to.rackId).toBe('rack-3');

      // c-BC was rack-2 <-> rack-3, now rack-3 <-> rack-1
      expect(cBC.from.rackId).toBe('rack-3');
      expect(cBC.to.rackId).toBe('rack-1');

      // c-CA was rack-3 <-> rack-1, now rack-1 <-> rack-2
      expect(cCA.from.rackId).toBe('rack-1');
      expect(cCA.to.rackId).toBe('rack-2');

      expect(validateCableTopologyIntegrity(pMoved.cables, pMoved.racks).valid).toBe(true);

      // Undo 3 moves in reverse order
      history.undo();
      history.undo();
      history.undo();

      expect(serializeTopology()).toBe(initialSnapshot);
    });
  });
});
