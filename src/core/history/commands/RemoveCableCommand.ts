import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { CableRun } from '../../types';

export class RemoveCableCommand implements ICommand {
  readonly id: string;
  readonly name = 'Remove Cable';
  readonly timestamp: number;
  readonly description: string;

  private _cableId: string;
  private _removedCable!: CableRun;
  private _executed = false;

  constructor(cableId: string) {
    this.id = `cmd-rem-cable-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._cableId = cableId;
    this.description = `Remove cable ${cableId}`;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();
    const cable = (project.cables || []).find((c: CableRun) => c.id === this._cableId);
    if (!cable) return { success: false, error: `Cable '${this._cableId}' not found.` };

    this._removedCable = { ...cable };

    // Forward Delta: Filter out cable
    context.projectStore.setState((state: any) => {
      if (state.cables) {
        state.cables = state.cables.filter((c: CableRun) => c.id !== this._cableId);
      }
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        if (s.selectedId === this._cableId) {
          s.selectedId = null;
          s.selectedType = null;
        }
      });
    }

    this._executed = true;
    return {
      success: true,
      affectedRackIds: [this._removedCable.from.rackId, this._removedCable.to.rackId],
      affectedCableIds: [this._cableId]
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    // Invert Delta: Re-insert cable
    context.projectStore.setState((state: any) => {
      if (!state.cables) state.cables = [];
      state.cables.push({ ...this._removedCable });
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'cable';
        s.selectedId = this._cableId;
      });
    }

    this._executed = false;
    return {
      success: true,
      affectedRackIds: [this._removedCable.from.rackId, this._removedCable.to.rackId],
      affectedCableIds: [this._cableId]
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
