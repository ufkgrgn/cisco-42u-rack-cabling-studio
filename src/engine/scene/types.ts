// ============================================================================
// Scene Graph & LOD Domain Types
// ============================================================================

export enum LODTier {
  OVERVIEW = 'overview', // scale < 0.35x: silhouettes, total badges, trunk ribbons
  STANDARD = 'standard', // 0.35x <= scale < 1.0x: U slots, faceplates, major port outlines
  DETAILED = 'detailed', // scale >= 1.0x: connector pins, LEDs, labels, port IDs
}

export interface RackLayoutOptions {
  rackSpacing?: number;    // default: 120px
  startPositionX?: number; // default: 0px
  positionY?: number;      // default: 0px
}

export interface CullingStats {
  totalRacks: number;
  visibleRacks: number;
  culledRacks: number;
  cullRatio: number;
}

export interface SnapTarget {
  rackId: string;
  snappedU: number;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  isValid: boolean;
  reason?: 'COLLISION' | 'OUT_OF_BOUNDS';
  conflictingInstanceId?: string;
}

export interface ViewportWorldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
