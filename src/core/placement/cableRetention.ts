// ============================================================================
// Cable Retention & Endpoint Synchronization
// Guarantees F2.5 (Hardware Identity & Cable Endpoint Retention)
// ============================================================================

import { CableRun, RackModel } from '../types';

export interface CableRecalculationResult {
  updatedCables: CableRun[];
  affectedCableIds: string[];
}

export interface CableTopologyValidationResult {
  valid: boolean;
  danglingCables: string[];
  issues: string[];
}

/**
 * Recalculates and updates cable endpoints when a device is moved (intra-rack or inter-rack)
 * or when its mounting face is flipped.
 * Returns both the updated cables and an array of all affected cable IDs.
 */
export function recalculateCableEndpoints(
  cables: CableRun[],
  movedInstanceId: string,
  targetRackId: string,
  targetFace?: 'front' | 'rear'
): CableRecalculationResult {
  const affectedCableIds: string[] = [];

  const updatedCables = (cables || []).map((cable) => {
    let touched = false;
    const c: CableRun = {
      ...cable,
      from: { ...cable.from },
      to: { ...cable.to },
    };

    if (c.from.deviceInstanceId === movedInstanceId) {
      c.from.rackId = targetRackId;
      if (targetFace !== undefined) {
        c.from.face = targetFace;
      }
      touched = true;
    }

    if (c.to.deviceInstanceId === movedInstanceId) {
      c.to.rackId = targetRackId;
      if (targetFace !== undefined) {
        c.to.face = targetFace;
      }
      touched = true;
    }

    if (touched) {
      affectedCableIds.push(c.id);
    }

    return c;
  });

  return {
    updatedCables,
    affectedCableIds: Array.from(new Set(affectedCableIds)),
  };
}

/**
 * Validates that all cable endpoints in a topology reference valid, existing racks and devices.
 */
export function validateCableTopologyIntegrity(
  cables: CableRun[],
  racks: RackModel[]
): CableTopologyValidationResult {
  const rackMap = new Map<string, Set<string>>();
  for (const r of racks) {
    const devSet = new Set<string>();
    for (const d of r.devices) {
      devSet.add(d.instanceId);
    }
    rackMap.set(r.id, devSet);
  }

  const danglingCables: string[] = [];
  const issues: string[] = [];

  for (const c of cables || []) {
    const fromRack = rackMap.get(c.from.rackId);
    if (!fromRack) {
      danglingCables.push(c.id);
      issues.push(`Cable ${c.id}: 'from' rack '${c.from.rackId}' not found.`);
      continue;
    }
    if (!fromRack.has(c.from.deviceInstanceId)) {
      danglingCables.push(c.id);
      issues.push(`Cable ${c.id}: 'from' device '${c.from.deviceInstanceId}' not found in rack '${c.from.rackId}'.`);
      continue;
    }

    const toRack = rackMap.get(c.to.rackId);
    if (!toRack) {
      danglingCables.push(c.id);
      issues.push(`Cable ${c.id}: 'to' rack '${c.to.rackId}' not found.`);
      continue;
    }
    if (!toRack.has(c.to.deviceInstanceId)) {
      danglingCables.push(c.id);
      issues.push(`Cable ${c.id}: 'to' device '${c.to.deviceInstanceId}' not found in rack '${c.to.rackId}'.`);
      continue;
    }
  }

  return {
    valid: danglingCables.length === 0,
    danglingCables: Array.from(new Set(danglingCables)),
    issues,
  };
}
