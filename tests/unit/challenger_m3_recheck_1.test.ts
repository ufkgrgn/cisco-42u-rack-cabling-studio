import { describe, it, expect } from 'vitest';
import {
  intervalsOverlap,
  checkAABBOverlap,
  validatePlacement,
  checkIntervalCollision,
  canResizeRack,
  getMaxOccupiedU,
} from '../../src/core/placement';
import { RackModel, DeviceInstance } from '../../src/core/types';

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

describe('Adversarial Challenger Recheck: Milestone M3 Collision & Placement Engine', () => {
  // ===========================================================================
  // Focus 1: Strict OUT_OF_BOUNDS for 0, NaN, negative, float, out-of-bounds startU/uHeight
  // ===========================================================================
  describe('Focus 1: Strict Boundary & Non-Integer / Falsy Validation in validatePlacement', () => {
    const rack42 = createRack('rack-42', 42);

    it('1.1 Strictly rejects startU = 0, negative, float, NaN, Infinity with OUT_OF_BOUNDS', () => {
      const invalidStartUs = [
        0,
        -1,
        -42,
        0.5,
        1.0001,
        1.5,
        2.9,
        NaN,
        Infinity,
        -Infinity,
        Number.MAX_SAFE_INTEGER + 0.5,
      ];

      for (const startU of invalidStartUs) {
        const res = validatePlacement(rack42, { uHeight: 1, face: 'front' }, startU);
        expect(res.valid, `Expected startU=${startU} to be invalid`).toBe(false);
        expect(res.reason, `Expected startU=${startU} reason to be OUT_OF_BOUNDS`).toBe('OUT_OF_BOUNDS');
      }
    });

    it('1.2 Strictly rejects uHeight = 0, negative, float, NaN, Infinity with OUT_OF_BOUNDS (no falsy fallback to 1)', () => {
      const invalidHeights = [
        0,
        -0,
        -1,
        -5,
        0.1,
        0.99,
        1.5,
        2.00001,
        NaN,
        Infinity,
        -Infinity,
      ];

      for (const uHeight of invalidHeights) {
        const res = validatePlacement(rack42, { uHeight, face: 'front' }, 1);
        expect(res.valid, `Expected uHeight=${uHeight} to be invalid`).toBe(false);
        expect(res.reason, `Expected uHeight=${uHeight} reason to be OUT_OF_BOUNDS`).toBe('OUT_OF_BOUNDS');
      }
    });

    it('1.3 Strictly rejects exotic types: null, string, object, array in uHeight / startU', () => {
      const exoticPayloads: any[] = [
        { startU: 1, uHeight: null },
        { startU: null, uHeight: 1 },
        { startU: 1, uHeight: '1' },
        { startU: '1', uHeight: 1 },
        { startU: 1, uHeight: {} },
        { startU: 1, uHeight: [] },
        { startU: 1, uHeight: true },
        { startU: 1, uHeight: false },
        { startU: undefined, uHeight: 0 },
      ];

      for (const payload of exoticPayloads) {
        const res = validatePlacement(rack42, { uHeight: payload.uHeight, face: 'front' }, payload.startU);
        expect(res.valid, `Expected payload ${JSON.stringify(payload)} to be invalid`).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('1.4 Strictly rejects startU beyond rack capacity and candidate overflowing ceiling', () => {
      // 1U device at U43 in 42U rack
      const res43 = validatePlacement(rack42, { uHeight: 1, face: 'front' }, 43);
      expect(res43.valid).toBe(false);
      expect(res43.reason).toBe('OUT_OF_BOUNDS');

      // 2U device at U42 in 42U rack (spans to U43)
      const res42_2U = validatePlacement(rack42, { uHeight: 2, face: 'front' }, 42);
      expect(res42_2U.valid).toBe(false);
      expect(res42_2U.reason).toBe('OUT_OF_BOUNDS');

      // 5U device at U39 in 42U rack (spans 39,40,41,42,43 -> 43 > 42)
      const res39_5U = validatePlacement(rack42, { uHeight: 5, face: 'front' }, 39);
      expect(res39_5U.valid).toBe(false);
      expect(res39_5U.reason).toBe('OUT_OF_BOUNDS');

      // 5U device at U38 in 42U rack (spans 38,39,40,41,42 -> 42 <= 42) -> VALID
      const res38_5U = validatePlacement(rack42, { uHeight: 5, face: 'front' }, 38);
      expect(res38_5U.valid).toBe(true);
    });

    it('1.5 Supports startU provided inside device descriptor when targetU is omitted', () => {
      const resValid = validatePlacement(rack42, { startU: 5, uHeight: 2, face: 'front' });
      expect(resValid.valid).toBe(true);

      const resZeroU = validatePlacement(rack42, { startU: 5, uHeight: 0, face: 'front' });
      expect(resZeroU.valid).toBe(false);
      expect(resZeroU.reason).toBe('OUT_OF_BOUNDS');

      const resNaNU = validatePlacement(rack42, { startU: 5, uHeight: NaN, face: 'front' });
      expect(resNaNU.valid).toBe(false);
      expect(resNaNU.reason).toBe('OUT_OF_BOUNDS');
    });
  });

  // ===========================================================================
  // Focus 2: Discrete Interval Collision (Abutting vs Overlapping)
  // ===========================================================================
  describe('Focus 2: Discrete Interval Collision (Abutting Allowed, Overlapping Rejected)', () => {
    it('2.1 Strictly allows abutting intervals [10, 10] and [11, 11] across all collision helpers', () => {
      // Direct interval check: [10, 10] and [11, 11]
      expect(intervalsOverlap(10, 10, 11, 11)).toBe(false);
      expect(intervalsOverlap(11, 11, 10, 10)).toBe(false);

      // AABB overlap check: start=10, h=1 vs start=11, h=1
      expect(checkAABBOverlap(10, 1, 11, 1)).toBe(false);
      expect(checkAABBOverlap(11, 1, 10, 1)).toBe(false);

      // validatePlacement with existing device
      const rack = createRack('rack-abut', 42, [
        { instanceId: 'd1', catalogId: 'sw', rackId: 'rack-abut', startU: 10, uHeight: 1, face: 'front' },
      ]);
      const resAbove = validatePlacement(rack, { uHeight: 1, face: 'front' }, 11);
      expect(resAbove.valid).toBe(true);

      const resBelow = validatePlacement(rack, { uHeight: 1, face: 'front' }, 9);
      expect(resBelow.valid).toBe(true);
    });

    it('2.2 Strictly rejects overlapping intervals [10, 11] and [11, 12] sharing unit 11', () => {
      // Direct interval check: [10, 11] and [11, 12]
      expect(intervalsOverlap(10, 11, 11, 12)).toBe(true);
      expect(intervalsOverlap(11, 12, 10, 11)).toBe(true);

      // AABB overlap check: start=10, h=2 vs start=11, h=2
      expect(checkAABBOverlap(10, 2, 11, 2)).toBe(true);
      expect(checkAABBOverlap(11, 2, 10, 2)).toBe(true);

      // validatePlacement with existing device
      const rack = createRack('rack-overlap', 42, [
        { instanceId: 'd-exist', catalogId: 'sw', rackId: 'rack-overlap', startU: 10, uHeight: 2, face: 'front' }, // spans [10, 11]
      ]);
      const resOverlap = validatePlacement(rack, { uHeight: 2, face: 'front', instanceId: 'd-cand' }, 11); // spans [11, 12]
      expect(resOverlap.valid).toBe(false);
      expect(resOverlap.reason).toBe('COLLISION');
      expect(resOverlap.conflictingInstanceId).toBe('d-exist');
    });

    it('2.3 Multi-U abutting boundaries: [1, 5] and [6, 10] do NOT collide', () => {
      expect(intervalsOverlap(1, 5, 6, 10)).toBe(false);
      expect(intervalsOverlap(6, 10, 1, 5)).toBe(false);
      expect(checkAABBOverlap(1, 5, 6, 5)).toBe(false);

      const rack = createRack('r', 42, [
        { instanceId: 'd5', catalogId: 'chassis', rackId: 'r', startU: 1, uHeight: 5, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 5, face: 'front' }, 6);
      expect(res.valid).toBe(true);
    });

    it('2.4 Multi-U partial overlap: [1, 5] and [5, 9] share U5 and MUST collide', () => {
      expect(intervalsOverlap(1, 5, 5, 9)).toBe(true);
      expect(intervalsOverlap(5, 9, 1, 5)).toBe(true);
      expect(checkAABBOverlap(1, 5, 5, 5)).toBe(true);

      const rack = createRack('r', 42, [
        { instanceId: 'd5', catalogId: 'chassis', rackId: 'r', startU: 1, uHeight: 5, face: 'front' },
      ]);
      const res = validatePlacement(rack, { uHeight: 5, face: 'front', instanceId: 'cand5' }, 5);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('COLLISION');
      expect(res.conflictingInstanceId).toBe('d5');
    });

    it('2.5 Mathematical Set Intersection Oracle over 10,000 randomized pairs', () => {
      function oracleIntervalOverlap(aStart: number, aLen: number, bStart: number, bLen: number): boolean {
        const setA = new Set<number>();
        for (let i = aStart; i < aStart + aLen; i++) setA.add(i);
        for (let j = bStart; j < bLen + bStart; j++) {
          if (setA.has(j)) return true;
        }
        return false;
      }

      for (let i = 0; i < 10000; i++) {
        const startA = Math.floor(Math.random() * 55) + 1;
        const lenA = Math.floor(Math.random() * 6) + 1;
        const startB = Math.floor(Math.random() * 55) + 1;
        const lenB = Math.floor(Math.random() * 6) + 1;

        const expected = oracleIntervalOverlap(startA, lenA, startB, lenB);
        const aabbActual = checkAABBOverlap(startA, lenA, startB, lenB);
        const intervalActual = intervalsOverlap(startA, startA + lenA - 1, startB, startB + lenB - 1);

        expect(aabbActual).toBe(expected);
        expect(intervalActual).toBe(expected);
      }
    });
  });

  // ===========================================================================
  // Focus 3: checkIntervalCollision Defense-in-Depth
  // ===========================================================================
  describe('Focus 3: Defense-in-Depth in checkIntervalCollision', () => {
    const devices: DeviceInstance[] = [
      { instanceId: 'dev-1', catalogId: 'sw1', rackId: 'r1', startU: 10, uHeight: 2, face: 'front' }, // U10, U11
      { instanceId: 'dev-2', catalogId: 'pdu1', rackId: 'r1', startU: 20, uHeight: 1, face: 'rear' },
    ];

    it('3.1 Rejects candidate specs with uHeight = 0, negative, NaN, float', () => {
      const invalidHeights = [0, -0, -1, -10, NaN, 0.5, 1.5, Infinity, -Infinity];

      for (const uHeight of invalidHeights) {
        const res = checkIntervalCollision(
          devices,
          { startU: 1, uHeight: uHeight as number, face: 'front' },
          42
        );
        expect(res.hasCollision, `Expected uHeight=${uHeight} to report collision/rejection`).toBe(true);
        expect(res.reason).toBe('OUT OF BOUNDS');
      }
    });

    it('3.2 Rejects candidate specs with startU = 0, negative, NaN, float', () => {
      const invalidStartUs = [0, -1, -50, NaN, 1.2, 0.99, Infinity, -Infinity];

      for (const startU of invalidStartUs) {
        const res = checkIntervalCollision(
          devices,
          { startU: startU as number, uHeight: 1, face: 'front' },
          42
        );
        expect(res.hasCollision, `Expected startU=${startU} to report collision/rejection`).toBe(true);
        expect(res.reason).toBe('OUT OF BOUNDS');
      }
    });

    it('3.3 Rejects candidate specs where candidateEnd > totalU', () => {
      // 1U at U43 in 42U rack
      const res43 = checkIntervalCollision(devices, { startU: 43, uHeight: 1, face: 'front' }, 42);
      expect(res43.hasCollision).toBe(true);
      expect(res43.reason).toBe('OUT OF BOUNDS');

      // 2U at U42 in 42U rack (end is 43)
      const res42 = checkIntervalCollision(devices, { startU: 42, uHeight: 2, face: 'front' }, 42);
      expect(res42.hasCollision).toBe(true);
      expect(res42.reason).toBe('OUT OF BOUNDS');
    });

    it('3.4 Allows valid non-colliding and abutting candidates', () => {
      // Abutting dev-1 below at U9
      const resAbutBelow = checkIntervalCollision(devices, { startU: 9, uHeight: 1, face: 'front' }, 42);
      expect(resAbutBelow.hasCollision).toBe(false);

      // Abutting dev-1 above at U12
      const resAbutAbove = checkIntervalCollision(devices, { startU: 12, uHeight: 1, face: 'front' }, 42);
      expect(resAbutAbove.hasCollision).toBe(false);

      // Rear slot U10 (front occupied, rear is empty)
      const resRearEmpty = checkIntervalCollision(devices, { startU: 10, uHeight: 2, face: 'rear' }, 42);
      expect(resRearEmpty.hasCollision).toBe(false);
    });

    it('3.5 Correctly detects collision when candidate overlaps existing device on same face', () => {
      // Candidate at U11 front overlaps dev-1 ([10, 11])
      const resCol = checkIntervalCollision(devices, { startU: 11, uHeight: 1, face: 'front' }, 42);
      expect(resCol.hasCollision).toBe(true);
      expect(resCol.conflictingInstanceId).toBe('dev-1');
      expect(resCol.reason).toContain('COLLISION WITH sw1 AT U10');
    });

    it('3.6 Self-exemption during dragging: does not collide with self', () => {
      // dev-1 moving from [10, 11] to [11, 12]
      const resSelf = checkIntervalCollision(
        devices,
        { startU: 11, uHeight: 2, face: 'front', instanceId: 'dev-1' },
        42
      );
      expect(resSelf.hasCollision).toBe(false);
    });
  });

  // ===========================================================================
  // Focus 4: canResizeRack and getMaxOccupiedU Stress
  // ===========================================================================
  describe('Focus 4: Rack Sizing and Shrinkage Guard Invariants', () => {
    it('4.1 Rejects resizing to non-integer, negative, zero, and > 60U', () => {
      const rack = createRack('r', 42);
      const invalid = [0, -1, 42.5, 60.1, 61, 100, NaN, Infinity];
      for (const val of invalid) {
        const res = canResizeRack(rack, val);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('4.2 Correctly determines max occupied unit across both faces', () => {
      const rack = createRack('r', 42, [
        { instanceId: 'f1', catalogId: 'sw', rackId: 'r', startU: 15, uHeight: 3, face: 'front' }, // spans 15, 16, 17 -> top is 17
        { instanceId: 'r1', catalogId: 'pdu', rackId: 'r', startU: 25, uHeight: 4, face: 'rear' }, // spans 25, 26, 27, 28 -> top is 28
      ]);

      expect(getMaxOccupiedU(rack)).toBe(28);

      // Resizing to 27 should be blocked
      const res27 = canResizeRack(rack, 27);
      expect(res27.allowed).toBe(false);
      expect(res27.reason).toBe('SHRINKAGE_OCCUPIED');
      expect(res27.maxOccupiedU).toBe(28);

      // Resizing to 28 should be allowed
      const res28 = canResizeRack(rack, 28);
      expect(res28.allowed).toBe(true);
      expect(res28.maxOccupiedU).toBe(28);

      // Resizing to 60 should be allowed
      const res60 = canResizeRack(rack, 60);
      expect(res60.allowed).toBe(true);
    });
  });
});
