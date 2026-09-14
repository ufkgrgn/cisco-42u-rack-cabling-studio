// ============================================================================
// SceneGraph: Root Spatial Multi-Rack Coordinator
// ============================================================================

import { Container } from 'pixi.js';
import { RackContainer } from './RackContainer';
import { FrustumCuller } from './FrustumCuller';
import { LODManager } from './LODManager';
import { RackModel, DeviceCatalogItem } from '../../core/types';
import { CullingStats } from './types';

export class SceneGraph {
  public worldContainer: Container;
  public backgroundLayer: Container;
  public rackLayer: Container;
  public cablingLayer: Container;
  public interactionLayer: Container;

  public rackContainers = new Map<string, RackContainer>();
  public culler: FrustumCuller;
  public lodManager: LODManager;

  constructor() {
    this.worldContainer = new Container({ isRenderGroup: true });

    this.backgroundLayer = new Container();
    this.rackLayer = new Container();
    this.cablingLayer = new Container();
    this.interactionLayer = new Container();

    this.worldContainer.addChild(this.backgroundLayer);
    this.worldContainer.addChild(this.rackLayer);
    this.worldContainer.addChild(this.cablingLayer);
    this.worldContainer.addChild(this.interactionLayer);

    this.culler = new FrustumCuller(100);
    this.lodManager = new LODManager();
  }

  public syncRacks(racks: RackModel[], catalog: Map<string, DeviceCatalogItem>): void {
    const activeRackIds = new Set(racks.map((r) => r.id));

    // Remove deleted racks
    for (const [id, container] of this.rackContainers.entries()) {
      if (!activeRackIds.has(id)) {
        this.rackLayer.removeChild(container);
        container.destroy({ children: true });
        this.rackContainers.delete(id);
      }
    }

    // Add or update racks
    racks.forEach((rackModel, idx) => {
      let container = this.rackContainers.get(rackModel.id);
      const targetX =
        rackModel.positionX !== undefined && rackModel.positionX !== 0
          ? rackModel.positionX
          : idx * 754;

      if (!container) {
        container = new RackContainer(rackModel);
        container.x = targetX;
        this.rackContainers.set(rackModel.id, container);
        this.rackLayer.addChild(container);
      } else {
        container.x = targetX;
      }
      container.syncDevices(rackModel.devices, catalog);
    });
  }

  public updateViewport(
    screenWidth: number,
    screenHeight: number,
    cameraZoom: number,
    screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  ): { culling: CullingStats; lodChanged: boolean } {
    // 1. Frustum Culling
    const bounds = this.culler.computeViewportBounds(screenWidth, screenHeight, screenToWorld);
    const culling = this.culler.cullRacks(this.rackContainers, bounds);

    // 2. 3-Tier LOD evaluation
    const { changed } = this.lodManager.evaluateScale(cameraZoom);
    if (changed) {
      this.lodManager.applyLOD(this.rackContainers.values(), false);
    }
    this.lodManager.syncVisibleRacks(this.rackContainers.values());

    return { culling, lodChanged: changed };
  }

  public findRackAt(
    worldX: number,
    margin = 40,
    worldY?: number,
    marginY = 50
  ): RackContainer | null {
    for (const rack of this.rackContainers.values()) {
      const inX = worldX >= rack.x - margin && worldX <= rack.x + rack.rackWidth + margin;
      if (!inX) continue;
      if (worldY !== undefined) {
        const inY = worldY >= rack.y - marginY && worldY <= rack.y + rack.rackHeight + marginY;
        if (!inY) continue;
      }
      return rack;
    }
    return null;
  }
}
