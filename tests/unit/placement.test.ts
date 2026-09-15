import { describe, it, expect, beforeEach } from 'vitest';
import {
  EIA_RACK_DIMENSIONS,
  getRackHeightPx,
  uToLocalY,
  localYToU,
  checkAABBOverlap,
  intervalsOverlap,
  validatePlacement,
  checkIntervalCollision,
  canResizeRack,
  getMaxOccupiedU,
  recalculateCableEndpoints,
  validateCableTopologyIntegrity,
} from '../../src/core/placement';
import { RackModel, DeviceInstance, CableRun } from '../../src/core/types';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';
import { ResizeRackCommand } from '../../src/core/history/commands/ResizeRackCommand';

function createRack(id: string, totalU = 42, devices: DeviceInstance[] = []): RackModel {
  return {
    id,
    name: `Rack ${id}`,
    totalU,
    widthMm: 600,
    depthMm: 1000,
    maxLoadKg: 1000,
    positionX: 0,
    devices,
  };
}

describe('Milestone M3: Dynamic Variable U-Height & Conflict-Free Placement Engine', () => {
  // ===========================================================================
  // 1. EIA-310-D Standard Dimensions & Coordinate Math
  // ===========================================================================
  describe('EIA-310-D Dimensions & Coordinate Calculations', () => {
    it('verifies standard EIA-310-D dimensions and constants', () => {
      expect(EIA_RACK_DIMENSIONS.U_HEIGHT_PX).toBe(32);
      expect(EIA_RACK_DIMENSIONS.CHASSIS_WIDTH_PX).toBe(480);
      expect(EIA_RACK_DIMENSIONS.EAR_WIDTH_PX).toBe(24);
      expect(EIA_RACK_DIMENSIONS.TOTAL_MOUNT_WIDTH_PX).toBe(528);
      expect(EIA_RACK_DIMENSIONS.CABLE_CHANNEL_WIDTH_PX).toBe(53);
      expect(EIA_RACK_DIMENSIONS.CABINET_WIDTH_PX).toBe(634);
      expect(EIA_RACK_DIMENSIONS.MIN_U).toBe(1);
      expect(EIA_RACK_DIMENSIONS.MAX_U).toBe(60);
      expect(EIA_RACK_DIMENSIONS.DEFAULT_U).toBe(42);
      expect(EIA_RACK_DIMENSIONS.RAIL_HOLE_OFFSETS_PX).toEqual([4.57, 16.0, 27.43]);
    });

    it('calculates cabinet pixel height including header and plinth', () => {
      expect(getRackHeightPx(42)).toBe(42 * 32 + 64);
      expect(getRackHeightPx(1)).toBe(1 * 32 + 64);
      expect(getRackHeightPx(60)).toBe(60 * 32 + 64);
    });

    it('performs reversible bottom-up EIA unit to local Y coordinate mapping', () => {
      const totalU = 42;
      // Bottom unit U1 of a 1U device should be at the bottom: 32 + (42 - 1) * 32 = 1344
      expect(uToLocalY(1, 1, totalU)).toBe(32 + 41 * 32);
      expect(localYToU(32 + 41 * 32, 1, totalU)).toBe(1);

      // Top unit U42 of a 1U device should be at the top: 32 + (42 - 42) * 32 = 32
      expect(uToLocalY(42, 1, totalU)).toBe(32);
      expect(localYToU(32, 1, totalU)).toBe(42);

      // 2U device starting at U10 occupies U10 and U11; top unit is U11
      const localY2U = uToLocalY(10, 2, totalU);
      expect(localY2U).toBe(32 + (42 - 11) * 32);
      expect(localYToU(localY2U, 2, totalU)).toBe(10);
    });
  });

  // ===========================================================================
  // 2. 21 Edge Cases: Boundaries, Collisions, Dual-Face & Shrinkage Guard
  // ===========================================================================
  describe('Placement Engine 21 Edge Cases Matrix (E1 - E21)', () => {
    // E1: 1U device placed at startU = 1 in 42U rack -> Success
    it('E1: allows 1U device placed at bottom unit U1', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front' }, 1);
      expect(res.valid).toBe(true);
    });

    // E2: Device placed at startU = 0 or negative -> Rejected OUT_OF_BOUNDS
    it('E2: rejects device placed at startU = 0 or negative', () => {
      const rack = createRack('r1', 42);
      const resZero = validatePlacement(rack, { uHeight: 1, face: 'front' }, 0);
      expect(resZero.valid).toBe(false);
      expect(resZero.reason).toBe('OUT_OF_BOUNDS');

      const resNeg = validatePlacement(rack, { uHeight: 1, face: 'front' }, -3);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.reason).toBe('OUT_OF_BOUNDS');
    });

    // E3: 1U device placed at startU = 42 in 42U rack -> Success
    it('E3: allows 1U device placed at exact top unit U42', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front' }, 42);
      expect(res.valid).toBe(true);
    });

    // E4: 1U device placed at startU = 43 in 42U rack -> Rejected OUT_OF_BOUNDS
    it('E4: rejects 1U device placed beyond top unit (U43 in 42U rack)', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front' }, 43);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('OUT_OF_BOUNDS');
    });

    // E5: 2U device placed at startU = 42 in 42U rack -> Rejected OUT_OF_BOUNDS (exceeds to U43)
    it('E5: rejects 2U device placed at U42 because top unit U43 exceeds capacity', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 2, face: 'front' }, 42);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('OUT_OF_BOUNDS');
    });

    // E6: 2U device placed at startU = 41 in 42U rack -> Success (spans U41-U42)
    it('E6: allows 2U device placed at U41 spanning exactly to top unit U42', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 2, face: 'front' }, 41);
      expect(res.valid).toBe(true);
    });

    // E7: Multi-U 7U chassis device placed at startU = 10 -> Success (spans U10-U16)
    it('E7: allows large 7U chassis device spanning U10-U16', () => {
      const rack = createRack('r1', 42);
      const res = validatePlacement(rack, { uHeight: 7, face: 'front' }, 10);
      expect(res.valid).toBe(true);
    });

    // E8: Device placed at exact same slot as existing device -> Rejected COLLISION
    it('E8: rejects placement at exact same slot as existing device', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'sw1', catalogId: 'cisco-9300', rackId: 'r1', startU: 10, uHeight: 1, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front', instanceId: 'sw2' }, 10);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
      expect(res.conflictingInstanceId).toBe('sw1');
    });

    // E9: Partial overlap: candidate 1U at U10 against existing 2U at [9, 10] -> Rejected COLLISION
    it('E9: rejects candidate when partially overlapping an existing multi-U device', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'srv1', catalogId: 'dell-r740', rackId: 'r1', startU: 9, uHeight: 2, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front', instanceId: 'sw2' }, 10);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
      expect(res.conflictingInstanceId).toBe('srv1');
    });

    // E10: Strictly abutting above: candidate at U11 against existing 2U at [9, 10] -> Success
    it('E10: allows candidate strictly abutting above an existing device (U11 above [9, 10])', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'srv1', catalogId: 'dell-r740', rackId: 'r1', startU: 9, uHeight: 2, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front' }, 11);
      expect(res.valid).toBe(true);
    });

    // E11: Strictly abutting below: candidate at U8 against existing 2U at [9, 10] -> Success
    it('E11: allows candidate strictly abutting below an existing device (U8 below [9, 10])', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'srv1', catalogId: 'dell-r740', rackId: 'r1', startU: 9, uHeight: 2, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'front' }, 8);
      expect(res.valid).toBe(true);
    });

    // E12: Dual-sided isolation: Front switch at U20 and rear PDU at U20 -> Success (no collision)
    it('E12: permits front and rear devices to share the same U slot without collision', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'sw1', catalogId: 'cisco-9300', rackId: 'r1', startU: 20, uHeight: 1, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'rear', instanceId: 'pdu1' }, 20);
      expect(res.valid).toBe(true);
    });

    // E13: Same-face collision: Rear candidate at U20 against existing rear PDU at U20 -> Rejected COLLISION
    it('E13: rejects rear device colliding with existing rear device at U20', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'pdu1', catalogId: 'apc-pdu', rackId: 'r1', startU: 20, uHeight: 1, face: 'rear' },
      ]);
      const res = validatePlacement(rack, { uHeight: 1, face: 'rear', instanceId: 'pdu2' }, 20);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
      expect(res.conflictingInstanceId).toBe('pdu1');
    });

    // E14: Self-collision exemption: Moving 2U device from [10, 11] to [11, 12] in same rack -> Success
    it('E14: exempts device from colliding with itself when moving within same rack', () => {
      const dev = { instanceId: 'srv1', catalogId: 'dell-r740', rackId: 'r1', startU: 10, uHeight: 2, face: 'front' as const };
      const rack = createRack('r1', 42, [dev]);

      // Candidate overlaps with previous slot at U11, but instanceId matches -> valid
      const res = validatePlacement(rack, dev, 11);
      expect(res.valid).toBe(true);
    });

    // E15: Empty rack shrinkage to 1U allowed -> Success
    it('E15: allows empty rack to be resized down to 1U', () => {
      const rack = createRack('r1', 42, []);
      const res = canResizeRack(rack, 1);
      expect(res.allowed).toBe(true);
      expect(res.maxOccupiedU).toBe(0);
    });

    // E16: Devices at U5 and U20; shrink to 20U -> Success (exact top unit)
    it('E16: allows shrinking rack down to the exact top occupied unit', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'd1', catalogId: 'sw', rackId: 'r1', startU: 5, uHeight: 1, face: 'front' },
        { instanceId: 'd2', catalogId: 'sw', rackId: 'r1', startU: 20, uHeight: 1, face: 'front' },
      ]);
      const res = canResizeRack(rack, 20);
      expect(res.allowed).toBe(true);
      expect(res.maxOccupiedU).toBe(20);
    });

    // E17: Devices at U5 and U20; shrink to 19U -> Rejected SHRINKAGE_OCCUPIED
    it('E17: blocks shrinking rack below the highest occupied unit (U19 < U20)', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'd1', catalogId: 'sw', rackId: 'r1', startU: 5, uHeight: 1, face: 'front' },
        { instanceId: 'd2', catalogId: 'sw', rackId: 'r1', startU: 20, uHeight: 1, face: 'front' },
      ]);
      const res = canResizeRack(rack, 19);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('SHRINKAGE_OCCUPIED');
      expect(res.maxOccupiedU).toBe(20);
    });

    // E18: 4U device at startU = 38 (spans [38, 41]); shrink to 40U -> Rejected SHRINKAGE_OCCUPIED
    it('E18: blocks shrinking rack below top unit of multi-U device (spans to U41, shrink to 40)', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'd1', catalogId: 'server-4u', rackId: 'r1', startU: 38, uHeight: 4, face: 'front' },
      ]);
      const res = canResizeRack(rack, 40);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('SHRINKAGE_OCCUPIED');
      expect(res.maxOccupiedU).toBe(41);
    });

    // E19: Front at U10, rear PDU at U35; shrink to 30U -> Rejected SHRINKAGE_OCCUPIED
    it('E19: guards shrinkage considering devices on BOTH front and rear faces', () => {
      const rack = createRack('r1', 42, [
        { instanceId: 'sw1', catalogId: 'cisco-9300', rackId: 'r1', startU: 10, uHeight: 1, face: 'front' },
        { instanceId: 'pdu1', catalogId: 'pdu', rackId: 'r1', startU: 35, uHeight: 1, face: 'rear' },
      ]);
      const res = canResizeRack(rack, 30);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('SHRINKAGE_OCCUPIED');
      expect(res.maxOccupiedU).toBe(35);
    });

    // E20: Rack resized to 0U, -5U, or 61U -> Rejected OUT_OF_BOUNDS
    it('E20: rejects rack resizing out of EIA-310-D bounds (0U, -5U, 61U)', () => {
      const rack = createRack('r1', 42, []);
      expect(canResizeRack(rack, 0).allowed).toBe(false);
      expect(canResizeRack(rack, 0).reason).toBe('OUT_OF_BOUNDS');

      expect(canResizeRack(rack, -5).allowed).toBe(false);
      expect(canResizeRack(rack, -5).reason).toBe('OUT_OF_BOUNDS');

      expect(canResizeRack(rack, 61).allowed).toBe(false);
      expect(canResizeRack(rack, 61).reason).toBe('OUT_OF_BOUNDS');
    });

    // E21: Rack resized to non-integer (e.g. 42.5U) -> Rejected OUT_OF_BOUNDS
    it('E21: rejects non-integer rack heights (e.g. 42.5U)', () => {
      const rack = createRack('r1', 42, []);
      const res = canResizeRack(rack, 42.5);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('OUT_OF_BOUNDS');
    });
  });

  // ===========================================================================
  // 3. Fast Interval Collision & Abutting Checks (Drag interaction)
  // ===========================================================================
  describe('checkIntervalCollision & checkAABBOverlap helpers', () => {
    it('computes max occupied unit across both faces', () => {
      const emptyRack = createRack('r0', 42, []);
      expect(getMaxOccupiedU(emptyRack)).toBe(0);

      const populatedRack = createRack('r1', 42, [
        { instanceId: 'sw1', catalogId: 'cisco-9300', rackId: 'r1', startU: 10, uHeight: 1, face: 'front' },
        { instanceId: 'pdu1', catalogId: 'pdu', rackId: 'r1', startU: 35, uHeight: 2, face: 'rear' },
      ]);
      expect(getMaxOccupiedU(populatedRack)).toBe(36);
    });

    it('checks discrete 1D AABB overlaps correctly', () => {
      expect(intervalsOverlap(10, 11, 11, 12)).toBe(true);
      expect(intervalsOverlap(10, 10, 11, 11)).toBe(false);
      expect(checkAABBOverlap(10, 2, 11, 2)).toBe(true);
      expect(checkAABBOverlap(10, 1, 11, 1)).toBe(false);
    });

    it('checkIntervalCollision fast-checks candidates for drag preview', () => {
      const devices: DeviceInstance[] = [
        { instanceId: 'sw1', catalogId: 'cisco-9300', rackId: 'r1', startU: 10, uHeight: 1, face: 'front' },
      ];
      expect(checkIntervalCollision(devices, { startU: 10, uHeight: 1, face: 'front' }, 42).hasCollision).toBe(true);
      expect(checkIntervalCollision(devices, { startU: 11, uHeight: 1, face: 'front' }, 42).hasCollision).toBe(false);
      expect(checkIntervalCollision(devices, { startU: 10, uHeight: 1, face: 'rear' }, 42).hasCollision).toBe(false);
      expect(checkIntervalCollision(devices, { startU: 42, uHeight: 2, face: 'front' }, 42).hasCollision).toBe(true);
    });
  });

  // ===========================================================================
  // 4. Cable Retention & Endpoint Synchronization (F2.5)
  // ===========================================================================
  describe('Cable Retention & Topology Integrity', () => {
    it('recalculates cable endpoints on intra-rack move and face flip', () => {
      const cables: CableRun[] = [
        {
          id: 'cable-1',
          from: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'p1', face: 'front' },
          to: { rackId: 'rack-1', deviceInstanceId: 'dev-2', portId: 'p1', face: 'front' },
          color: 'Blue',
          category: 'copper',
          routingStyle: 'structured',
        },
      ];

      // Move dev-1 to rear face
      const result = recalculateCableEndpoints(cables, 'dev-1', 'rack-1', 'rear');
      expect(result.affectedCableIds).toEqual(['cable-1']);
      expect(result.updatedCables[0]?.from.face).toBe('rear');
      expect(result.updatedCables[0]?.from.rackId).toBe('rack-1');
      // dev-2 should remain untouched
      expect(result.updatedCables[0]?.to.face).toBe('front');
    });

    it('validates topology integrity and detects dangling cables', () => {
      const racks = [createRack('r1', 42, [{ instanceId: 'd1', catalogId: 'sw', rackId: 'r1', startU: 1, uHeight: 1, face: 'front' }])];
      const validCables: CableRun[] = [
        {
          id: 'c1',
          from: { rackId: 'r1', deviceInstanceId: 'd1', portId: 'p1', face: 'front' },
          to: { rackId: 'r1', deviceInstanceId: 'd1', portId: 'p2', face: 'front' },
          color: 'Blue',
          category: 'copper',
          routingStyle: 'structured',
        },
      ];
      expect(validateCableTopologyIntegrity(validCables, racks).valid).toBe(true);

      const invalidCables: CableRun[] = [
        {
          id: 'c-dangling',
          from: { rackId: 'r1', deviceInstanceId: 'nonexistent', portId: 'p1', face: 'front' },
          to: { rackId: 'r1', deviceInstanceId: 'd1', portId: 'p2', face: 'front' },
          color: 'Blue',
          category: 'copper',
          routingStyle: 'structured',
        },
      ];
      const check = validateCableTopologyIntegrity(invalidCables, racks);
      expect(check.valid).toBe(false);
      expect(check.danglingCables).toContain('c-dangling');
    });
  });

  // ===========================================================================
  // 5. Invertible Command Integration & Cable Endpoint Retention
  // ===========================================================================
  describe('Command Integration with Placement Domain & Cable Retention', () => {
    beforeEach(() => {
      useProjectStore.getState().setProject({
        schemaVersion: 3,
        id: 'proj-placement-test',
        name: 'Placement Test Studio',
        metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01', author: 'Test', generator: 'Test' },
        activeRackId: 'rack-1',
        racks: [
          createRack('rack-1', 42, [
            { instanceId: 'dev-sw1', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 10, uHeight: 1, face: 'front' },
            { instanceId: 'dev-sw2', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 20, uHeight: 1, face: 'front' },
          ]),
        ],
        cables: [
          {
            id: 'cable-10-to-20',
            from: { rackId: 'rack-1', deviceInstanceId: 'dev-sw1', portId: 'p1', face: 'front' },
            to: { rackId: 'rack-1', deviceInstanceId: 'dev-sw2', portId: 'p1', face: 'front' },
            color: 'Blue',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.5,
          },
        ],
        customCatalog: {},
      });
      useHistoryStore.getState().clearHistory();
    });

    it('populates affectedCableIds on intra-rack move and updates endpoints', () => {
      const history = useHistoryStore.getState();

      // Move dev-sw1 from U10 to U30 within rack-1
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-sw1',
        targetRackId: 'rack-1',
        targetStartU: 30,
        targetFace: 'rear',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);
      expect(res.affectedCableIds).toContain('cable-10-to-20');

      const project = useProjectStore.getState().project;
      const cable = project.cables[0]!;
      expect(cable.from.face).toBe('rear');
      expect(cable.from.rackId).toBe('rack-1');

      // Undo cleanly reverts face and position
      history.undo();
      const revertedProject = useProjectStore.getState().project;
      const revertedCable = revertedProject.cables[0]!;
      expect(revertedCable.from.face).toBe('front');

      const dev = revertedProject.racks[0]!.devices.find(d => d.instanceId === 'dev-sw1')!;
      expect(dev.startU).toBe(10);
      expect(dev.face).toBe('front');
    });

    it('enforces shrinkage guard in ResizeRackCommand via placement domain', () => {
      const history = useHistoryStore.getState();

      // Highest occupied device is at U20 (uHeight 1 => top unit U20)
      // Shrinking to U19 should be rejected
      const failCmd = new ResizeRackCommand('rack-1', 19);
      const failRes = history.executeCommand(failCmd);
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain('Cannot shrink rack to 19U');

      // Shrinking to exact top unit U20 should succeed
      const okCmd = new ResizeRackCommand('rack-1', 20);
      const okRes = history.executeCommand(okCmd);
      expect(okRes.success).toBe(true);
      expect(useProjectStore.getState().project.racks[0]!.totalU).toBe(20);
    });

    it('enforces AABB collisions in PlaceDeviceCommand via placement domain', () => {
      const history = useHistoryStore.getState();

      // Slot U10 is occupied on front face
      const cmdCol = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        face: 'front',
      });
      const resCol = history.executeCommand(cmdCol);
      expect(resCol.success).toBe(false);
      expect(resCol.error).toContain('Collision');

      // Slot U10 is free on rear face (dual-face isolation)
      const cmdRear = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        face: 'rear',
      });
      const resRear = history.executeCommand(cmdRear);
      expect(resRear.success).toBe(true);
    });
  });
});
