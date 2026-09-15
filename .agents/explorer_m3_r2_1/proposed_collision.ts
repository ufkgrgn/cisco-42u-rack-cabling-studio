// ============================================================================
// Proposed Remediation for src/core/placement/collision.ts
// Prepared by Explorer 1 (Iteration 2) for Worker M3
// ============================================================================

import { RackModel, DeviceInstance } from '../types';
import { PlacementValidationResult } from './types';

/**
 * Checks if two 1D discrete closed intervals [aStart, aEnd] and [bStart, bEnd] intersect.
 * Abutting intervals (e.g. [10, 10] and [11, 11]) do NOT intersect.
 */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
}

/**
 * Checks if two devices defined by (startU, uHeight) physically overlap on the same rail.
 */
export function checkAABBOverlap(
  startA: number,
  uHeightA: number,
  startB: number,
  uHeightB: number
): boolean {
  const endA = startA + uHeightA - 1;
  const endB = startB + uHeightB - 1;
  return intervalsOverlap(startA, endA, startB, endB);
}

/**
 * Validates candidate device placement in a rack according to EIA-310-D physical bounds
 * and AABB unit interval collision detection with face-isolation and self-exemption.
 *
 * @param rack Target rack model containing totalU and existing devices
 * @param device Candidate device instance or partial descriptor
 * @param targetU Optional target starting unit (defaults to device.startU)
 * @param targetFace Optional target face (defaults to device.face or 'front')
 */
export function validatePlacement(
  rack: RackModel,
  device: {
    startU?: number;
    uHeight: number;
    face?: 'front' | 'rear';
    instanceId?: string;
    catalogId?: string;
  },
  targetU?: number,
  targetFace?: 'front' | 'rear'
): PlacementValidationResult {
  // Use explicit undefined checks instead of falsy || or nullish ?? coercion to ensure
  // that 0, NaN, floats, negative numbers, and null are preserved for validation
  const startU = targetU !== undefined ? targetU : (device.startU !== undefined ? device.startU : 1);
  const uHeight = device.uHeight !== undefined ? device.uHeight : 1;
  const endU = startU + uHeight - 1;
  const face = targetFace !== undefined ? targetFace : (device.face ?? 'front');

  // 1. Boundary & Integer Validation
  if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS',
      message: `Invalid unit specifications: startU=${startU}, uHeight=${uHeight}.`,
    };
  }

  if (startU < 1 || endU > rack.totalU) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS',
      message: `Placement out of bounds: U${startU}-U${endU} exceeds rack capacity (1-U${rack.totalU}).`,
    };
  }

  // 2. AABB Unit Interval Collision with Face-Isolation & Self-Exemption
  for (const existing of rack.devices) {
    // Self-exemption when moving an existing device within the same rack
    if (device.instanceId && existing.instanceId === device.instanceId) {
      continue;
    }

    // Dual-sided isolation: front devices collide only with front; rear only with rear
    if (existing.face !== face) {
      continue;
    }

    const existStart = existing.startU;
    const existEnd = existing.startU + existing.uHeight - 1;

    if (intervalsOverlap(startU, endU, existStart, existEnd)) {
      return {
        valid: false,
        conflictingInstanceId: existing.instanceId,
        reason: 'COLLISION',
        message: `Collision at U${startU}-U${endU} with existing device '${existing.instanceId}' (${existing.catalogId} at U${existStart}-U${existEnd}).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Fast interval collision checker for interaction loops (e.g. DragManager pointer move).
 */
export function checkIntervalCollision(
  devices: DeviceInstance[],
  candidate: { startU: number; uHeight: number; face: 'front' | 'rear'; instanceId?: string },
  totalU: number
): { hasCollision: boolean; reason?: string; conflictingInstanceId?: string } {
  // Defense-in-depth: Guard against 0U, negative, non-integer or < 1 candidate specs
  if (
    !Number.isInteger(candidate.startU) ||
    !Number.isInteger(candidate.uHeight) ||
    candidate.startU < 1 ||
    candidate.uHeight < 1
  ) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }

  const candidateEnd = candidate.startU + candidate.uHeight - 1;

  if (candidateEnd > totalU) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }

  for (const d of devices) {
    if (candidate.instanceId && d.instanceId === candidate.instanceId) continue;
    if (d.face !== candidate.face) continue;

    const dStart = d.startU;
    const dEnd = d.startU + d.uHeight - 1;

    if (intervalsOverlap(candidate.startU, candidateEnd, dStart, dEnd)) {
      return {
        hasCollision: true,
        conflictingInstanceId: d.instanceId,
        reason: `COLLISION WITH ${d.catalogId} AT U${dStart}`,
      };
    }
  }

  return { hasCollision: false };
}
