import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { CableRun, RackModel, DeviceInstance } from '../../types';

export class AddCableCommand implements ICommand {
  readonly id: string;
  readonly name = 'Add Cable';
  readonly timestamp: number;
  readonly description: string;

  private _cable: CableRun;
  private _executed = false;

  constructor(cable: CableRun) {
    this.id = `cmd-add-cable-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._cable = { ...cable };
    this.description = `Add ${cable.category} cable ${cable.id} from ${cable.from.deviceInstanceId}:${cable.from.portId} to ${cable.to.deviceInstanceId}:${cable.to.portId}`;
  }

  get cable(): CableRun {
    return this._cable;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();

    // 0. Validate not connecting a port to itself
    if (
      this._cable.from.rackId === this._cable.to.rackId &&
      this._cable.from.deviceInstanceId === this._cable.to.deviceInstanceId &&
      this._cable.from.portId === this._cable.to.portId
    ) {
      return { success: false, error: 'A cable cannot connect a port to itself.' };
    }

    // 1. Validate endpoints exist
    const fromDev = project.racks.flatMap((r: RackModel) => r.devices).find((d: DeviceInstance) => d.instanceId === this._cable.from.deviceInstanceId);
    const toDev = project.racks.flatMap((r: RackModel) => r.devices).find((d: DeviceInstance) => d.instanceId === this._cable.to.deviceInstanceId);

    if (!fromDev || !toDev) {
      return { success: false, error: 'One or both endpoint devices do not exist.' };
    }

    // 2. Validate port vacancy (1-to-1 patch cabling)
    const isOccupied = (project.cables || []).some((c: CableRun) =>
      (c.from.deviceInstanceId === this._cable.from.deviceInstanceId && c.from.portId === this._cable.from.portId) ||
      (c.to.deviceInstanceId === this._cable.from.deviceInstanceId && c.to.portId === this._cable.from.portId) ||
      (c.from.deviceInstanceId === this._cable.to.deviceInstanceId && c.from.portId === this._cable.to.portId) ||
      (c.to.deviceInstanceId === this._cable.to.deviceInstanceId && c.to.portId === this._cable.to.portId)
    );

    if (isOccupied) {
      return { success: false, error: 'One or both ports already have an attached cable.' };
    }

    // Forward Delta: Append cable
    context.projectStore.setState((state: any) => {
      if (!state.cables) state.cables = [];
      state.cables.push({ ...this._cable });
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'cable';
        s.selectedId = this._cable.id;
        s.pendingConnection = null;
      });
    }

    this._executed = true;
    return {
      success: true,
      affectedRackIds: [this._cable.from.rackId, this._cable.to.rackId],
      affectedCableIds: [this._cable.id]
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    // Invert Delta: Remove cable
    context.projectStore.setState((state: any) => {
      if (state.cables) {
        state.cables = state.cables.filter((c: CableRun) => c.id !== this._cable.id);
      }
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        if (s.selectedId === this._cable.id) {
          s.selectedId = null;
          s.selectedType = null;
        }
      });
    }

    this._executed = false;
    return {
      success: true,
      affectedRackIds: [this._cable.from.rackId, this._cable.to.rackId],
      affectedCableIds: [this._cable.id]
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
