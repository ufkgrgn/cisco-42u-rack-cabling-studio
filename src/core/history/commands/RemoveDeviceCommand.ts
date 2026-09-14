import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance, RackModel, CableRun } from '../../types';

export class RemoveDeviceCommand implements ICommand {
  readonly id: string;
  readonly name = 'Remove Device';
  readonly timestamp: number;
  readonly description: string;

  private _instanceId: string;
  private _removedDevice!: DeviceInstance;
  private _sourceRackId!: string;
  private _detachedCables: CableRun[] = [];
  private _executed = false;

  constructor(instanceId: string) {
    this.id = `cmd-remove-dev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._instanceId = instanceId;
    this.description = `Remove device ${instanceId}`;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();

    const foundRack = project.racks.find((r: RackModel) => r.devices.some((d: DeviceInstance) => d.instanceId === this._instanceId));
    if (!foundRack) return { success: false, error: `Device '${this._instanceId}' not found.` };
    const device = foundRack.devices.find((d: DeviceInstance) => d.instanceId === this._instanceId)!;

    this._sourceRackId = foundRack.id;
    this._removedDevice = { ...device };

    // Capture attached cables for lossless undo
    this._detachedCables = (project.cables || []).filter((c: CableRun) =>
      c.from.deviceInstanceId === this._instanceId || c.to.deviceInstanceId === this._instanceId
    );

    // Forward Delta: Remove device and detach cables
    context.projectStore.setState((state: any) => {
      const rack = state.racks.find((r: RackModel) => r.id === this._sourceRackId);
      if (rack) {
        rack.devices = rack.devices.filter((d: DeviceInstance) => d.instanceId !== this._instanceId);
      }
      if (state.cables) {
        state.cables = state.cables.filter((c: CableRun) =>
          c.from.deviceInstanceId !== this._instanceId && c.to.deviceInstanceId !== this._instanceId
        );
      }
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        if (s.selectedId === this._instanceId) {
          s.selectedId = null;
          s.selectedType = null;
        }
      });
    }

    this._executed = true;
    return {
      success: true,
      affectedRackIds: [this._sourceRackId],
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._detachedCables.map(c => c.id)
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    // Invert Delta: Re-insert device and re-insert all detached cables
    context.projectStore.setState((state: any) => {
      const rack = state.racks.find((r: RackModel) => r.id === this._sourceRackId);
      if (rack) {
        rack.devices.push({ ...this._removedDevice });
      }
      if (!state.cables) {
        state.cables = [];
      }
      this._detachedCables.forEach(cable => {
        if (!state.cables.some((c: CableRun) => c.id === cable.id)) {
          state.cables.push({ ...cable });
        }
      });
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'device';
        s.selectedId = this._instanceId;
        s.activeRackId = this._sourceRackId;
      });
    }

    this._executed = false;
    return {
      success: true,
      affectedRackIds: [this._sourceRackId],
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._detachedCables.map(c => c.id)
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
