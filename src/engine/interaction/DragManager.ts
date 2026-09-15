// ============================================================================
// DragManager: Drag Lifecycle, Snapping & AABB Collision Engine
// ============================================================================

import { DragGhost } from './DragGhost';
import { SceneGraph } from '../scene/SceneGraph';
import { RackContainer } from '../scene/RackContainer';
import { DeviceCatalogItem } from '../../core/types';
import { EngineBridge } from '../bridge/EngineBridge';
import { PlaceDeviceCommand } from '../../core/history/commands/PlaceDeviceCommand';
import { MoveDeviceCommand } from '../../core/history/commands/MoveDeviceCommand';
import { catalogRegistry } from '../../core/catalog/catalogRegistry';
import { checkAABBOverlap } from '../../core/placement';

export interface DragState {
  isActive: boolean;
  catalogItem: DeviceCatalogItem;
  instanceId?: string;
  sourceRackId?: string;
  face: 'front' | 'rear';
}

export class DragManager {
  private _ghost: DragGhost;
  private _sceneGraph: SceneGraph;
  private _bridge: EngineBridge;
  private _state: DragState | null = null;
  private _unsubBridge: (() => void)[] = [];

  constructor(sceneGraph: SceneGraph, bridge: EngineBridge) {
    this._sceneGraph = sceneGraph;
    this._bridge = bridge;
    this._ghost = new DragGhost();
    this._sceneGraph.interactionLayer.addChild(this._ghost);

    this._registerBridgeEvents();
  }

  public get ghost(): DragGhost {
    return this._ghost;
  }

  public get state(): Readonly<DragState> | null {
    return this._state;
  }

  public startDrag(params: {
    catalogItem: DeviceCatalogItem;
    instanceId?: string;
    sourceRackId?: string;
    face?: 'front' | 'rear';
  }): void {
    this._state = {
      isActive: true,
      catalogItem: params.catalogItem,
      instanceId: params.instanceId,
      sourceRackId: params.sourceRackId,
      face: params.face ?? 'front',
    };
    this._ghost.show();
  }

  public handlePointerMove(worldX: number, worldY: number): void {
    if (!this._state || !this._state.isActive) return;

    const uHeight = this._state.catalogItem.u || 1;
    const targetRack = this.findTargetRack(worldX, worldY);

    if (!targetRack) {
      // Free floating outside racks
      this._ghost.position.set(worldX - 264, worldY - (uHeight * 32) / 2);
      this._ghost.updateVisuals({
        catalogId: this._state.catalogItem.id,
        uHeight,
        isValid: false,
        reason: 'OUTSIDE RACK BOUNDS',
      });
      return;
    }

    // EIA-310-D Slot Snapping Math:
    // Rail starts at targetRack.y + 32px
    const railTopY = targetRack.y + 32;
    const cursorTopY = worldY - (uHeight * 32) / 2;
    const deltaY = cursorTopY - railTopY;
    const slotFromTop = Math.round(deltaY / 32);

    const endU = targetRack.totalU - slotFromTop;
    const startU = endU - uHeight + 1;
    const clampedStartU = Math.max(1, Math.min(targetRack.totalU - uHeight + 1, startU));

    // AABB Unit Interval Collision Detection
    const collision = this.checkCollision(targetRack, clampedStartU, uHeight, this._state.instanceId, this._state.face);

    // Snapped position
    const snappedWorldX = targetRack.x + 53;
    const topUnit = clampedStartU + uHeight - 1;
    const snappedWorldY = railTopY + (targetRack.totalU - topUnit) * 32;

    this._ghost.position.set(snappedWorldX, snappedWorldY);
    this._ghost.updateVisuals({
      catalogId: this._state.catalogItem.id,
      uHeight,
      isValid: !collision.hasCollision,
      snappedU: clampedStartU,
      reason: collision.reason,
    });

    this._bridge.emit('device:drag-move', {
      worldX,
      worldY,
      snappedU: clampedStartU,
      targetRackId: targetRack.rackId,
      isValid: !collision.hasCollision,
    });
  }

  public handlePointerUp(worldX: number, worldY: number): void {
    if (!this._state || !this._state.isActive) return;

    const targetRack = this.findTargetRack(worldX, worldY);
    const uHeight = this._state.catalogItem.u || 1;

    if (targetRack) {
      const railTopY = targetRack.y + 32;
      const cursorTopY = worldY - (uHeight * 32) / 2;
      const slotFromTop = Math.round((cursorTopY - railTopY) / 32);
      const clampedStartU = Math.max(1, Math.min(targetRack.totalU - uHeight + 1, targetRack.totalU - slotFromTop - uHeight + 1));

      const collision = this.checkCollision(targetRack, clampedStartU, uHeight, this._state.instanceId, this._state.face);

      if (!collision.hasCollision) {
        if (this._state.instanceId) {
          // Move existing device
          this._bridge.dispatchCommand(
            new MoveDeviceCommand({
              instanceId: this._state.instanceId,
              targetRackId: targetRack.rackId,
              targetStartU: clampedStartU,
              targetFace: this._state.face,
            })
          );
        } else {
          // Place new device from catalog
          const rawId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}`;
          this._bridge.dispatchCommand(
            new PlaceDeviceCommand({
              instanceId: rawId,
              catalogId: this._state.catalogItem.id,
              rackId: targetRack.rackId,
              startU: clampedStartU,
              face: this._state.face,
            })
          );
        }
      }
    }

    this._ghost.hide();
    this._state = null;
    this._bridge.emit('device:drag-end', {});
  }

  public cancelDrag(): void {
    if (this._ghost) this._ghost.hide();
    this._state = null;
    this._bridge.emit('device:drag-end', {});
  }

  public destroy(): void {
    this.cancelDrag();
    this._unsubBridge.forEach((unsub) => unsub());
    this._unsubBridge = [];
  }

  private _registerBridgeEvents(): void {
    const unsubStart = this._bridge.on('device:drag-start', (data) => {
      const catItem = catalogRegistry.get(data.catalogId) || {
        id: data.catalogId,
        name: data.catalogId,
        category: 'switch' as const,
        u: 1,
        manufacturer: 'Cisco',
        ports: [],
      };
      this.startDrag({
        catalogItem: catItem,
        instanceId: data.instanceId,
        sourceRackId: data.sourceRackId,
      });
    });

    this._unsubBridge.push(unsubStart);
  }

  public findTargetRack(worldX: number, worldY?: number): RackContainer | null {
    return this._sceneGraph.findRackAt(worldX, 40, worldY, 50);
  }

  public checkCollision(
    rack: RackContainer,
    startU: number,
    uHeight: number,
    movingInstanceId?: string,
    face: 'front' | 'rear' = 'front'
  ): { hasCollision: boolean; reason?: string } {
    const candidateEndU = startU + uHeight - 1;

    if (startU < 1 || candidateEndU > rack.totalU) {
      return { hasCollision: true, reason: 'OUT OF BOUNDS' };
    }

    for (const dev of rack.deviceMap.values()) {
      if (dev.instance.instanceId === movingInstanceId) continue;
      if (dev.instance.face !== face) continue;

      const dStart = dev.instance.startU;
      const dHeight = dev.instance.uHeight;

      // Interval overlap test using placement domain checkAABBOverlap
      if (checkAABBOverlap(startU, uHeight, dStart, dHeight)) {
        return {
          hasCollision: true,
          reason: `COLLISION WITH ${dev.catalogItem.id} AT U${dStart}`,
        };
      }
    }

    return { hasCollision: false };
  }
}
