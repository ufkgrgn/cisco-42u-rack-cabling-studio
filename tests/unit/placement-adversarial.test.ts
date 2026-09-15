import { describe, it, expect, beforeEach } from 'vitest';
import {
  uToLocalY,
  localYToU,
  checkAABBOverlap,
  intervalsOverlap,
  validatePlacement,
  canResizeRack,
  getMaxOccupiedU,
  validateCableTopologyIntegrity,
  checkIntervalCollision,
} from '../../src/core/placement';
import { RackModel, DeviceInstance } from '../../src/core/types';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
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
    devices: [...devices],
  };
}

describe('Adversarial Stress Harness: Milestone M3 Variable U-Height & Placement Engine', () => {
  // ===========================================================================
  // 1. Extreme Boundary Cases: 1U Cabinets
  // ===========================================================================
  describe('1. Extreme Boundary: 1U Rack Cabinets', () => {
    it('allows 1U device placed in 1U rack at U1', () => {
      const rack1U = createRack('rack-1u', 1);
      const res = validatePlacement(rack1U, { uHeight: 1, face: 'front' }, 1);
      expect(res.valid).toBe(true);
    });

    it('rejects 1U device placed at out-of-bounds U0, U2, U-1 in 1U rack', () => {
      const rack1U = createRack('rack-1u', 1);
      expect(validatePlacement(rack1U, { uHeight: 1, face: 'front' }, 0).valid).toBe(false);
      expect(validatePlacement(rack1U, { uHeight: 1, face: 'front' }, 2).valid).toBe(false);
      expect(validatePlacement(rack1U, { uHeight: 1, face: 'front' }, -1).valid).toBe(false);
    });

    it('rejects multi-U devices (2U, 3U, 4U) placed in 1U rack', () => {
      const rack1U = createRack('rack-1u', 1);
      const res2U = validatePlacement(rack1U, { uHeight: 2, face: 'front' }, 1);
      expect(res2U.valid).toBe(false);
      expect(res2U.reason).toBe('OUT_OF_BOUNDS');

      const res4U = validatePlacement(rack1U, { uHeight: 4, face: 'front' }, 1);
      expect(res4U.valid).toBe(false);
      expect(res4U.reason).toBe('OUT_OF_BOUNDS');
    });

    it('allows empty 1U rack shrinkage/resize to 1U', () => {
      const rack1U = createRack('rack-1u', 1);
      const res = canResizeRack(rack1U, 1);
      expect(res.allowed).toBe(true);
      expect(res.maxOccupiedU).toBe(0);
    });

    it('allows populated 1U rack resize to 1U (exact max occupied slot)', () => {
      const rack1U = createRack('rack-1u', 1, [
        { instanceId: 'd1', catalogId: 'sw1', rackId: 'rack-1u', startU: 1, uHeight: 1, face: 'front' },
      ]);
      const res = canResizeRack(rack1U, 1);
      expect(res.allowed).toBe(true);
      expect(res.maxOccupiedU).toBe(1);
    });

    it('rejects resizing 1U rack to 0U or negative', () => {
      const rack1U = createRack('rack-1u', 1);
      expect(canResizeRack(rack1U, 0).allowed).toBe(false);
      expect(canResizeRack(rack1U, -1).allowed).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Extreme Boundary Cases: 60U Cabinets & Multi-U Saturation
  // ===========================================================================
  describe('2. Extreme Boundary: 60U Rack Cabinets with Multi-U Devices', () => {
    it('accommodates full 60U saturation with heterogeneous multi-U devices (42U + 7U + 4U + 3U + 2U + 2U = 60U)', () => {
      const devices: DeviceInstance[] = [
        { instanceId: 'dev-42u', catalogId: 'huge-chassis', rackId: 'r60', startU: 1, uHeight: 42, face: 'front' },
        { instanceId: 'dev-7u', catalogId: 'nexus-7706', rackId: 'r60', startU: 43, uHeight: 7, face: 'front' },
        { instanceId: 'dev-4u', catalogId: 'server-4u', rackId: 'r60', startU: 50, uHeight: 4, face: 'front' },
        { instanceId: 'dev-3u', catalogId: 'storage-3u', rackId: 'r60', startU: 54, uHeight: 3, face: 'front' },
        { instanceId: 'dev-2u', catalogId: 'ucs-2u', rackId: 'r60', startU: 57, uHeight: 2, face: 'front' },
        { instanceId: 'dev-top2u', catalogId: 'tor-2u', rackId: 'r60', startU: 59, uHeight: 2, face: 'front' },
      ];

      const rack60 = createRack('r60', 60, devices);
      expect(getMaxOccupiedU(rack60)).toBe(60);

      // Verify each device does not collide with its abutting neighbors
      for (let i = 0; i < devices.length; i++) {
        const d = devices[i]!;
        // Validates with self-exemption
        const check = validatePlacement(rack60, d, d.startU, d.face);
        expect(check.valid).toBe(true);
      }

      // Trying to place a 1U device anywhere from U1 to U60 must collide
      for (let u = 1; u <= 60; u++) {
        const check = validatePlacement(rack60, { uHeight: 1, face: 'front', instanceId: `cand-${u}` }, u);
        expect(check.valid).toBe(false);
        expect(check.reason).toBe('COLLISION');
      }

      // Shrinkage below 60U must be blocked
      for (let targetU = 1; targetU < 60; targetU++) {
        const resizeCheck = canResizeRack(rack60, targetU);
        expect(resizeCheck.allowed).toBe(false);
        expect(resizeCheck.reason).toBe('SHRINKAGE_OCCUPIED');
      }

      // Resizing to exact 60U must be allowed
      expect(canResizeRack(rack60, 60).allowed).toBe(true);
    });

    it('rejects placement exceeding 60U ceiling (e.g. 2U at U60 or 1U at U61)', () => {
      const rack60 = createRack('r60', 60);
      expect(validatePlacement(rack60, { uHeight: 2, face: 'front' }, 60).valid).toBe(false);
      expect(validatePlacement(rack60, { uHeight: 1, face: 'front' }, 61).valid).toBe(false);
      expect(validatePlacement(rack60, { uHeight: 7, face: 'front' }, 55).valid).toBe(false); // 55+7-1 = 61 > 60
      expect(validatePlacement(rack60, { uHeight: 7, face: 'front' }, 54).valid).toBe(true);  // 54+7-1 = 60 <= 60
    });

    it('rejects resizing rack to 61U (beyond maximum 60U)', () => {
      const rack = createRack('r', 42);
      const res = canResizeRack(rack, 61);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('OUT_OF_BOUNDS');
    });
  });

  // ===========================================================================
  // 3. Abutting vs Overlapping Edge Cases
  // ===========================================================================
  describe('3. Abutting vs Overlapping Devices Analysis', () => {
    it('U10 (1U: [10, 10]) vs U11-U14 (4U: [11, 14]) are abutting and do NOT collide', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'd-abut-1', catalogId: 'sw', rackId: 'r', startU: 10, uHeight: 1, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 4, face: 'front', instanceId: 'd-abut-2' }, 11);
      expect(res.valid).toBe(true);
      expect(intervalsOverlap(10, 10, 11, 14)).toBe(false);
      expect(checkAABBOverlap(10, 1, 11, 4)).toBe(false);
    });

    it('U10-U12 (3U: [10, 12]) vs U11-U13 (3U: [11, 13]) are overlapping and MUST collide', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'd-ovl-1', catalogId: 'sw', rackId: 'r', startU: 10, uHeight: 3, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 3, face: 'front', instanceId: 'd-ovl-2' }, 11);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
      expect(res.conflictingInstanceId).toBe('d-ovl-1');
      expect(intervalsOverlap(10, 12, 11, 13)).toBe(true);
      expect(checkAABBOverlap(10, 3, 11, 3)).toBe(true);
    });

    it('U10-U14 enclosing U11-U12 completely MUST collide', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'd-outer', catalogId: 'chassis', rackId: 'r', startU: 10, uHeight: 5, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 2, face: 'front', instanceId: 'd-inner' }, 11);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
    });

    it('Single-unit boundary collision: [10, 12] vs [12, 14] sharing U12 MUST collide', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'd-share', catalogId: 'chassis', rackId: 'r', startU: 10, uHeight: 3, face: 'front' }, // 10, 11, 12
      ]);
      const res = validatePlacement(rack, { uHeight: 3, face: 'front', instanceId: 'd-target' }, 12); // 12, 13, 14
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
    });

    it('Adjacent unit separation: [10, 12] vs [13, 15] MUST NOT collide', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'd-sep', catalogId: 'chassis', rackId: 'r', startU: 10, uHeight: 3, face: 'front' }, // 10, 11, 12
      ]);
      const res = validatePlacement(rack, { uHeight: 3, face: 'front', instanceId: 'd-target' }, 13); // 13, 14, 15
      expect(res.valid).toBe(true);
    });
  });

  // ===========================================================================
  // 4. Shrinkage Guards Across Front and Rear Faces
  // ===========================================================================
  describe('4. Shrinkage Guard Robustness Across Dual Faces', () => {
    it('blocks shrinkage when rear device is higher than front device', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'f1', catalogId: 'sw', rackId: 'r', startU: 1, uHeight: 1, face: 'front' },
        { instanceId: 'r1', catalogId: 'pdu', rackId: 'r', startU: 38, uHeight: 2, face: 'rear' }, // top is 39
      ]);
      expect(getMaxOccupiedU(rack)).toBe(39);

      // Resizing to 38U must be blocked even though front is only at U1
      const res38 = canResizeRack(rack, 38);
      expect(res38.allowed).toBe(false);
      expect(res38.reason).toBe('SHRINKAGE_OCCUPIED');
      expect(res38.maxOccupiedU).toBe(39);

      // Resizing to 39U (exact top) must be allowed
      const res39 = canResizeRack(rack, 39);
      expect(res39.allowed).toBe(true);
      expect(res39.maxOccupiedU).toBe(39);
    });

    it('blocks shrinkage when front device is higher than rear device', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'f1', catalogId: 'sw', rackId: 'r', startU: 35, uHeight: 4, face: 'front' }, // top is 38
        { instanceId: 'r1', catalogId: 'pdu', rackId: 'r', startU: 10, uHeight: 1, face: 'rear' },
      ]);
      expect(getMaxOccupiedU(rack)).toBe(38);

      expect(canResizeRack(rack, 37).allowed).toBe(false);
      expect(canResizeRack(rack, 38).allowed).toBe(true);
    });

    it('allows empty rack shrinkage to any valid U height from 1U to 60U', () => {
      const emptyRack = createRack('empty-r', 42, []);
      for (let u = 1; u <= 60; u++) {
        const check = canResizeRack(emptyRack, u);
        expect(check.allowed).toBe(true);
        expect(check.maxOccupiedU).toBe(0);
      }
    });
  });

  // ===========================================================================
  // 5. Malformed, Non-Integer, and Out-of-Bounds Inputs
  // ===========================================================================
  describe('5. Malformed, Non-Integer, and Out-of-Bounds Inputs', () => {
    it('rejects non-integer, zero, negative, and extreme values for totalU in canResizeRack', () => {
      const rack = createRack('r', 42);
      const invalidHeights = [0, -1, -50, 42.5, 1.1, 0.99, 60.1, 61, 100, NaN, Infinity, -Infinity];

      for (const invalidU of invalidHeights) {
        const res = canResizeRack(rack, invalidU);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('rejects non-integer, zero, negative, and invalid uHeight in validatePlacement', () => {
      const rack = createRack('r', 42);
      const invalidSpecs = [
        { startU: 1.5, uHeight: 1 },
        { startU: 1, uHeight: 1.5 },
        { startU: 1, uHeight: -2 },
        { startU: 0, uHeight: 1 },
        { startU: -5, uHeight: 1 },
        { startU: NaN, uHeight: 1 },
        { startU: 1, uHeight: 0 },
        { startU: 1, uHeight: NaN },
      ];

      for (const spec of invalidSpecs) {
        const res = validatePlacement(rack, { uHeight: spec.uHeight, face: 'front' }, spec.startU);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('strictly rejects uHeight: 0 and uHeight: NaN without falsy coercion', () => {
      const rack = createRack('r', 42);
      const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
      expect(resZero.valid).toBe(false);
      expect(resZero.reason).toBe('OUT_OF_BOUNDS');

      const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
      expect(resNaN.valid).toBe(false);
      expect(resNaN.reason).toBe('OUT_OF_BOUNDS');
    });

    it('defense-in-depth: rejects non-integer, zero, negative, and out-of-bounds candidate specs in checkIntervalCollision', () => {
      const devices: DeviceInstance[] = [];
      const invalidCandidates = [
        { startU: 1, uHeight: 0, face: 'front' as const },
        { startU: 1, uHeight: -1, face: 'front' as const },
        { startU: 1, uHeight: NaN, face: 'front' as const },
        { startU: 1, uHeight: 1.5, face: 'front' as const },
        { startU: 0, uHeight: 1, face: 'front' as const },
        { startU: -2, uHeight: 1, face: 'front' as const },
        { startU: 1.2, uHeight: 1, face: 'front' as const },
        { startU: NaN, uHeight: 1, face: 'front' as const },
        { startU: 42, uHeight: 2, face: 'front' as const }, // candidateEnd = 43 > 42
      ];

      for (const candidate of invalidCandidates) {
        const res = checkIntervalCollision(devices, candidate, 42);
        expect(res.hasCollision).toBe(true);
        expect(res.reason).toBe('OUT OF BOUNDS');
      }

      // Valid candidate passes
      const validRes = checkIntervalCollision(devices, { startU: 1, uHeight: 1, face: 'front' }, 42);
      expect(validRes.hasCollision).toBe(false);
    });
  });

  // ===========================================================================
  // 6. Mathematical Discrete Interval Oracle Fuzzing (5,000 randomized pairs)
  // ===========================================================================
  describe('6. Mathematical Discrete Interval Oracle Fuzzing', () => {
    it('guarantees 100% agreement between checkAABBOverlap and discrete Set Intersection Oracle over 5,000 random pairs', () => {
      function discreteSetOverlap(startA: number, hA: number, startB: number, hB: number): boolean {
        const setA = new Set<number>();
        for (let i = startA; i < startA + hA; i++) setA.add(i);

        for (let j = startB; j < startB + hB; j++) {
          if (setA.has(j)) return true;
        }
        return false;
      }

      let matchCount = 0;
      for (let i = 0; i < 5000; i++) {
        // Random intervals within 1..60
        const startA = Math.floor(Math.random() * 59) + 1;
        const hA = Math.floor(Math.random() * 10) + 1;
        const startB = Math.floor(Math.random() * 59) + 1;
        const hB = Math.floor(Math.random() * 10) + 1;

        const oracleResult = discreteSetOverlap(startA, hA, startB, hB);
        const aabbResult = checkAABBOverlap(startA, hA, startB, hB);
        const intervalResult = intervalsOverlap(startA, startA + hA - 1, startB, startB + hB - 1);

        expect(aabbResult).toBe(oracleResult);
        expect(intervalResult).toBe(oracleResult);
        matchCount++;
      }

      expect(matchCount).toBe(5000);
    });
  });

  // ===========================================================================
  // 7. Coordinate Transform Round-Trip Fuzzing
  // ===========================================================================
  describe('7. Coordinate Transform Reversible Invariance', () => {
    it('preserves exact startU through uToLocalY -> localYToU round-trip across all totalU (1-60) and heights (1-10)', () => {
      for (let totalU = 1; totalU <= 60; totalU++) {
        for (let uHeight = 1; uHeight <= Math.min(10, totalU); uHeight++) {
          const maxStartU = totalU - uHeight + 1;
          for (let startU = 1; startU <= maxStartU; startU++) {
            const localY = uToLocalY(startU, uHeight, totalU);
            const recoveredU = localYToU(localY, uHeight, totalU);
            expect(recoveredU).toBe(startU);
          }
        }
      }
    });
  });

  // ===========================================================================
  // 8. Invertible Command Stack Integration Stress
  // ===========================================================================
  describe('8. Invertible Command Stack Integration & Cable Retention Stress', () => {
    beforeEach(() => {
      useProjectStore.getState().setProject({
        schemaVersion: 3,
        id: 'proj-stress-test',
        name: 'Stress Test Project',
        metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01', author: 'Challenger', generator: 'Test' },
        activeRackId: 'rack-src',
        racks: [
          createRack('rack-src', 42, [
            { instanceId: 'dev-srv1', catalogId: 'dell-r740', rackId: 'rack-src', startU: 10, uHeight: 2, face: 'front' },
            { instanceId: 'dev-sw1', catalogId: 'cisco-catalyst-9300', rackId: 'rack-src', startU: 20, uHeight: 1, face: 'front' },
          ]),
          createRack('rack-dst', 42, [
            { instanceId: 'dev-dst-pdu', catalogId: 'pdu', rackId: 'rack-dst', startU: 1, uHeight: 1, face: 'rear' },
          ]),
        ],
        cables: [
          {
            id: 'cable-server-to-switch',
            from: { rackId: 'rack-src', deviceInstanceId: 'dev-srv1', portId: 'eth0', face: 'front' },
            to: { rackId: 'rack-src', deviceInstanceId: 'dev-sw1', portId: 'g1/0/1', face: 'front' },
            color: 'Green',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 2.0,
          },
        ],
        customCatalog: {},
      });
      useHistoryStore.getState().clearHistory();
    });

    it('stress tests consecutive inter-rack moves and face flips with cable topology preservation', () => {
      const history = useHistoryStore.getState();

      // Step 1: Move dev-srv1 from rack-src U10 front to rack-dst U15 rear
      const moveCmd1 = new MoveDeviceCommand({
        instanceId: 'dev-srv1',
        targetRackId: 'rack-dst',
        targetStartU: 15,
        targetFace: 'rear',
      });
      const res1 = history.executeCommand(moveCmd1);
      expect(res1.success).toBe(true);

      const state1 = useProjectStore.getState().project;
      const cable1 = state1.cables[0]!;
      expect(cable1.from.rackId).toBe('rack-dst');
      expect(cable1.from.face).toBe('rear');
      expect(cable1.to.rackId).toBe('rack-src');
      expect(cable1.to.face).toBe('front');

      const topologyCheck1 = validateCableTopologyIntegrity(state1.cables, state1.racks);
      expect(topologyCheck1.valid).toBe(true);

      // Step 2: dev-srv1 is 2U [15, 16] on rear.
      // Trying to move dev-sw1 from rack-src U20 to rack-dst U16 rear MUST COLLIDE!
      const moveColliding = new MoveDeviceCommand({
        instanceId: 'dev-sw1',
        targetRackId: 'rack-dst',
        targetStartU: 16,
        targetFace: 'rear',
      });
      const collRes = history.executeCommand(moveColliding);
      expect(collRes.success).toBe(false);
      expect(collRes.error).toContain('Collision');

      // dev-sw1 to U17 (strictly abutting above U15-U16) MUST SUCCEED
      const moveAbutting = new MoveDeviceCommand({
        instanceId: 'dev-sw1',
        targetRackId: 'rack-dst',
        targetStartU: 17,
        targetFace: 'rear',
      });
      const resAbut = history.executeCommand(moveAbutting);
      expect(resAbut.success).toBe(true);

      const state2 = useProjectStore.getState().project;
      const cable2 = state2.cables[0]!;
      expect(cable2.from.rackId).toBe('rack-dst');
      expect(cable2.from.face).toBe('rear');
      expect(cable2.to.rackId).toBe('rack-dst');
      expect(cable2.to.face).toBe('rear');

      const topologyCheck2 = validateCableTopologyIntegrity(state2.cables, state2.racks);
      expect(topologyCheck2.valid).toBe(true);

      // Step 3: Undo step 2
      history.undo();
      const stateUndo1 = useProjectStore.getState().project;
      expect(stateUndo1.cables[0]!.to.rackId).toBe('rack-src');
      expect(stateUndo1.cables[0]!.to.face).toBe('front');

      // Step 4: Undo step 1
      history.undo();
      const stateUndo2 = useProjectStore.getState().project;
      expect(stateUndo2.cables[0]!.from.rackId).toBe('rack-src');
      expect(stateUndo2.cables[0]!.from.face).toBe('front');

      // Step 5: Redo both
      history.redo();
      history.redo();
      const stateRedo = useProjectStore.getState().project;
      expect(stateRedo.cables[0]!.from.rackId).toBe('rack-dst');
      expect(stateRedo.cables[0]!.to.rackId).toBe('rack-dst');
      expect(stateRedo.cables[0]!.from.face).toBe('rear');
      expect(stateRedo.cables[0]!.to.face).toBe('rear');
    });

    it('prevents shrinkage of rack-dst when devices are moved into it', () => {
      const history = useHistoryStore.getState();

      // Move dev-srv1 (2U) to rack-dst U30 (spans 30-31)
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-srv1',
        targetRackId: 'rack-dst',
        targetStartU: 30,
        targetFace: 'front',
      });
      history.executeCommand(moveCmd);

      // Now rack-dst highest occupied unit is 31
      const resizeCmdFail = new ResizeRackCommand('rack-dst', 30);
      const resFail = history.executeCommand(resizeCmdFail);
      expect(resFail.success).toBe(false);
      expect(resFail.error).toContain('Cannot shrink rack to 30U');

      const resizeCmdOk = new ResizeRackCommand('rack-dst', 31);
      const resOk = history.executeCommand(resizeCmdOk);
      expect(resOk.success).toBe(true);
      expect(useProjectStore.getState().project.racks.find(r => r.id === 'rack-dst')!.totalU).toBe(31);
    });
  });
});
