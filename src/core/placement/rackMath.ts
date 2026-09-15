// ============================================================================
// Rack Mathematical Calculations & Dynamic Sizing Constraints
// ============================================================================

import { RackModel, DeviceInstance } from '../types';
import { CanResizeRackResult } from './types';
import { EIA_RACK_DIMENSIONS } from './dimensions';

/**
 * Computes the maximum occupied unit across all mounted devices in a rack (both front & rear faces).
 * Returns 0 if rack has no devices.
 */
export function getMaxOccupiedU(rack: RackModel): number {
  if (!rack.devices || rack.devices.length === 0) return 0;
  return rack.devices.reduce(
    (max: number, d: DeviceInstance) => Math.max(max, d.startU + d.uHeight - 1),
    0
  );
}

// Alias for naming flexibility
export const getMaxOccupiedUnit = getMaxOccupiedU;

/**
 * Enforces the Rack Height Shrinkage Guard (F2.4 / AC4).
 * Prohibits shrinking rack height below the highest occupied unit on either face.
 * Also validates that newTotalU is an integer within EIA-310-D limits (1..60).
 */
export function canResizeRack(rack: RackModel, newTotalU: number): CanResizeRackResult {
  const maxOccupiedU = getMaxOccupiedU(rack);

  // 1. Integer and Range Bounds (1U - 60U)
  if (
    !Number.isInteger(newTotalU) ||
    newTotalU < EIA_RACK_DIMENSIONS.MIN_U ||
    newTotalU > EIA_RACK_DIMENSIONS.MAX_U
  ) {
    return {
      allowed: false,
      maxOccupiedU,
      reason: 'OUT_OF_BOUNDS',
      message: `Invalid rack height ${newTotalU}U. Must be an integer between ${EIA_RACK_DIMENSIONS.MIN_U} and ${EIA_RACK_DIMENSIONS.MAX_U}.`,
    };
  }

  // 2. Shrinkage Prohibition Guard
  if (newTotalU < maxOccupiedU) {
    return {
      allowed: false,
      maxOccupiedU,
      reason: 'SHRINKAGE_OCCUPIED',
      message: `Cannot shrink rack to ${newTotalU}U: devices are mounted up to U${maxOccupiedU}. Move or remove them first.`,
    };
  }

  return {
    allowed: true,
    maxOccupiedU,
  };
}
