// ============================================================================
// Placement Domain Types
// Interface contracts matching PROJECT.md § 4
// ============================================================================

export type PlacementFailureReason = 'COLLISION' | 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED';

export interface PlacementValidationResult {
  valid: boolean;
  conflictingInstanceId?: string;
  reason?: PlacementFailureReason;
  message?: string;
}

export interface CanResizeRackResult {
  allowed: boolean;
  maxOccupiedU: number;
  reason?: PlacementFailureReason | string;
  message?: string;
}

export interface IntervalOverlap {
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  overlaps: boolean;
}
