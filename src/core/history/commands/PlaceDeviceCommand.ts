import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance, RackModel } from '../../types';

export interface PlaceDevicePayload {
  rackId: string;
  catalogId: string;
  startU: number; // 1-indexed bottom unit
  face?: 'front' | 'rear';
  customLabel?: string;
  instanceId?: string;
}

export class PlaceDeviceCommand implements ICommand {
  readonly id: string;
  readonly name = 'Place Device';
  readonly timestamp: number;
  readonly description: string;

  private _device: DeviceInstance;
  private _rackId: string;
  private _executed = false;

  constructor(payload: PlaceDevicePayload) {
    this.id = `cmd-place-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._rackId = payload.rackId;
    const rawId = payload.instanceId || `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    this._device = {
      instanceId: rawId.startsWith('dev-') ? rawId : `dev-${rawId}`,
      catalogId: payload.catalogId,
      rackId: payload.rackId,
      startU: payload.startU,
      uHeight: 1, // Will be updated from catalog on execute
      face: payload.face || 'front',
      customLabel: payload.customLabel
    };
    this.description = `Place ${payload.catalogId} at U${payload.startU} in rack ${payload.rackId}`;
  }

  get deviceInstance(): DeviceInstance {
    return this._device;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();
    const rack = project.racks.find((r: RackModel) => r.id === this._rackId);
    if (!rack) return { success: false, error: `Rack '${this._rackId}' not found.` };

    const catItem = context.catalogRegistry.get(this._device.catalogId) || project.customCatalog?.[this._device.catalogId];
    if (catItem) {
      this._device.uHeight = catItem.u;
    }

    const endU = this._device.startU + this._device.uHeight - 1;

    // Validation: Rack boundaries
    if (this._device.startU < 1 || endU > rack.totalU) {
      return {
        success: false,
        error: `Placement out of bounds: U${this._device.startU}-U${endU} exceeds rack 1-U${rack.totalU}.`
      };
    }

    // Validation: AABB Interval Collision on same face
    const collision = rack.devices.find((d: DeviceInstance) => {
      if (d.face !== this._device.face) return false;
      const dEndU = d.startU + d.uHeight - 1;
      return Math.max(this._device.startU, d.startU) <= Math.min(endU, dEndU);
    });

    if (collision) {
      return {
        success: false,
        error: `Collision at U${this._device.startU} with existing device '${collision.instanceId}' (${collision.catalogId}).`
      };
    }

    // Forward Delta: Append device
    context.projectStore.setState((state: any) => {
      const targetRack = state.racks.find((r: RackModel) => r.id === this._rackId);
      if (targetRack) {
        targetRack.devices.push({ ...this._device });
      }
    });

    // Transient UI selection
    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'device';
        s.selectedId = this._device.instanceId;
        s.activeRackId = this._rackId;
      });
    }

    this._executed = true;
    return {
      success: true,
      affectedRackIds: [this._rackId],
      affectedDeviceIds: [this._device.instanceId]
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    // Invert Delta: Remove device
    context.projectStore.setState((state: any) => {
      const targetRack = state.racks.find((r: RackModel) => r.id === this._rackId);
      if (targetRack) {
        targetRack.devices = targetRack.devices.filter((d: DeviceInstance) => d.instanceId !== this._device.instanceId);
      }
    });

    // Deselect if deleted device was selected
    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        if (s.selectedId === this._device.instanceId) {
          s.selectedId = null;
          s.selectedType = null;
        }
      });
    }

    this._executed = false;
    return {
      success: true,
      affectedRackIds: [this._rackId],
      affectedDeviceIds: [this._device.instanceId]
    };
  }

  redo(context: CommandContext): CommandExecutionResult {
    return this.execute(context);
  }

  canUndo(): boolean {
    return this._executed;
  }

  canRedo(): boolean {
    return !this._executed;
  }
}
