// ============================================================================
// Viewport Frustum Culler
// Pure mathematical viewport AABB culling with margin padding
// ============================================================================

import { RackContainer } from './RackContainer';
import { CullingStats, ViewportWorldBounds } from './types';

export class FrustumCuller {
  private _margin = 100; // 100px padding prevents edge pop-in during fast pans

  constructor(margin = 100) {
    this._margin = margin;
  }

  public get margin(): number {
    return this._margin;
  }

  public set margin(val: number) {
    this._margin = Math.max(0, val);
  }

  /**
   * Computes world AABB bounds from camera projection
   */
  public computeViewportBounds(
    screenWidth: number,
    screenHeight: number,
    screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  ): ViewportWorldBounds {
    const pTL = screenToWorld(0, 0);
    const pBR = screenToWorld(screenWidth, screenHeight);

    return {
      left: Math.min(pTL.x, pBR.x) - this._margin,
      top: Math.min(pTL.y, pBR.y) - this._margin,
      right: Math.max(pTL.x, pBR.x) + this._margin,
      bottom: Math.max(pTL.y, pBR.y) + this._margin,
    };
  }

  /**
   * Evaluates rack bounds against viewport and toggles visibility
   */
  public cullRacks(
    racks: Map<string, RackContainer>,
    bounds: ViewportWorldBounds
  ): CullingStats {
    let visibleCount = 0;
    let culledCount = 0;

    for (const rack of racks.values()) {
      const rackLeft = rack.x;
      const rackRight = rack.x + rack.rackWidth;
      const rackTop = rack.y;
      const rackBottom = rack.y + rack.rackHeight;

      const isOffscreen =
        rackRight < bounds.left ||
        rackLeft > bounds.right ||
        rackBottom < bounds.top ||
        rackTop > bounds.bottom;

      if (isOffscreen) {
        if (rack.visible) {
          rack.visible = false;
          rack.culled = true;
        }
        culledCount++;
      } else {
        if (!rack.visible) {
          rack.visible = true;
          rack.culled = false;
        }
        visibleCount++;
      }
    }

    const total = racks.size;
    return {
      totalRacks: total,
      visibleRacks: visibleCount,
      culledRacks: culledCount,
      cullRatio: total > 0 ? culledCount / total : 0,
    };
  }
}
