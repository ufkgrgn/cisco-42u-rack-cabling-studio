// ============================================================================
// 3-Tier LOD Manager with Hysteresis
// Overview (<0.35x) <-> Standard (0.35x..1.0x) <-> Detailed (>=1.0x)
// ============================================================================

import { LODTier } from './types';
import { RackContainer } from './RackContainer';

export interface LODThresholds {
  overviewToStandard: number; // 0.35
  standardToOverview: number; // 0.33
  standardToDetailed: number; // 1.02
  detailedToStandard: number; // 0.98
}

export class LODManager {
  private _currentTier: LODTier = LODTier.STANDARD;
  private _thresholds: LODThresholds = {
    overviewToStandard: 0.35,
    standardToOverview: 0.33,
    standardToDetailed: 1.02,
    detailedToStandard: 0.98,
  };

  public get currentTier(): LODTier {
    return this._currentTier;
  }

  /**
   * Evaluates scale with hysteresis to prevent rapid flickering
   */
  public evaluateScale(scale: number): { changed: boolean; tier: LODTier } {
    let nextTier = this._currentTier;

    switch (this._currentTier) {
      case LODTier.OVERVIEW:
        if (scale >= this._thresholds.overviewToStandard) {
          nextTier = scale >= this._thresholds.standardToDetailed ? LODTier.DETAILED : LODTier.STANDARD;
        }
        break;

      case LODTier.STANDARD:
        if (scale < this._thresholds.standardToOverview) {
          nextTier = LODTier.OVERVIEW;
        } else if (scale >= this._thresholds.standardToDetailed) {
          nextTier = LODTier.DETAILED;
        }
        break;

      case LODTier.DETAILED:
        if (scale < this._thresholds.detailedToStandard) {
          nextTier = scale < this._thresholds.standardToOverview ? LODTier.OVERVIEW : LODTier.STANDARD;
        }
        break;
    }

    const changed = nextTier !== this._currentTier;
    this._currentTier = nextTier;
    return { changed, tier: nextTier };
  }

  /**
   * Propagates LOD changes to all visible rack containers (or all racks if force=true)
   */
  public applyLOD(racks: Iterable<RackContainer>, force = false): void {
    for (const rack of racks) {
      if (rack.visible || force) {
        rack.setLOD(this._currentTier);
      }
    }
  }

  /**
   * Synchronizes culled racks that become visible to the active LOD tier
   */
  public syncVisibleRacks(racks: Iterable<RackContainer>): void {
    for (const rack of racks) {
      if (rack.visible && rack.currentLOD !== this._currentTier) {
        rack.setLOD(this._currentTier);
      }
    }
  }
}
