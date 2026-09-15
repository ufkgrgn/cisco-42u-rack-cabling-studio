// ============================================================================
// EIA-310-D Dimensional Standards & Coordinate Calculations
// ============================================================================

export const EIA_RACK_DIMENSIONS = {
  U_HEIGHT_PX: 32,                 // 1U = 1.75" (44.45 mm) = 32px
  CHASSIS_WIDTH_PX: 480,           // 17.72" (450 mm)
  EAR_WIDTH_PX: 24,                // 1.25" (31.75 mm) ear flange on each side
  TOTAL_MOUNT_WIDTH_PX: 528,       // 480 + 2 * 24 = 528px (19" opening)
  CABLE_CHANNEL_WIDTH_PX: 53,      // Side cable management ducts
  CABINET_WIDTH_PX: 634,           // 53 + 24 + 480 + 24 + 53 = 634px
  HEADER_HEIGHT_PX: 32,            // Top cabinet frame
  PLINTH_HEIGHT_PX: 32,            // Bottom cabinet plinth
  MIN_U: 1,
  MAX_U: 60,
  DEFAULT_U: 42,

  // EIA-310-D hole offsets within 1U (0.25", 0.875", 1.50" relative to top of U)
  // Repeating pattern: 0.500" - 0.625" - 0.625"
  RAIL_HOLE_OFFSETS_PX: [4.57, 16.0, 27.43] as const,
  RAIL_HOLE_WIDTH_PX: 4,
  RAIL_HOLE_HEIGHT_PX: 3,
} as const;

/**
 * Total pixel height of cabinet including top header and bottom plinth.
 */
export function getRackHeightPx(totalU: number): number {
  return (
    totalU * EIA_RACK_DIMENSIONS.U_HEIGHT_PX +
    EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX +
    EIA_RACK_DIMENSIONS.PLINTH_HEIGHT_PX
  );
}

/**
 * Converts 1-indexed bottom unit position and U-height to PixiJS local Y coordinate
 * within RackContainer (EIA-310-D bottom-to-top convention).
 */
export function uToLocalY(startU: number, uHeight: number, totalU: number): number {
  const topU = startU + uHeight - 1;
  return EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX + (totalU - topU) * EIA_RACK_DIMENSIONS.U_HEIGHT_PX;
}

/**
 * Converts PixiJS local Y coordinate to 1-indexed bottom startU.
 */
export function localYToU(localY: number, uHeight: number, totalU: number): number {
  const deltaY = localY - EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX;
  const slotFromTop = Math.round(deltaY / EIA_RACK_DIMENSIONS.U_HEIGHT_PX);
  const endU = totalU - slotFromTop;
  return endU - uHeight + 1;
}
