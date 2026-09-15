import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { RackModel } from '../../types';
import { canResizeRack } from '../../placement';

export class ResizeRackCommand implements ICommand {
  readonly id: string;
  readonly name = 'Resize Rack';
  readonly timestamp: number;
  readonly description: string;

  private _rackId: string;
  private _newTotalU: number;
  private _oldTotalU!: number;
  private _executed = false;

  constructor(rackId: string, newTotalU: number) {
    this.id = `cmd-resize-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._rackId = rackId;
    this._newTotalU = newTotalU;
    this.description = `Resize rack ${rackId} to ${newTotalU}U`;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();
    const rack = project.racks.find((r: RackModel) => r.id === this._rackId);
    if (!rack) return { success: false, error: `Rack '${this._rackId}' not found.` };

    // Delegate validation to centralized placement domain
    const resizeCheck = canResizeRack(rack, this._newTotalU);
    if (!resizeCheck.allowed) {
      return {
        success: false,
        error: resizeCheck.message || resizeCheck.reason || `Cannot resize rack to ${this._newTotalU}U.`
      };
    }

    this._oldTotalU = rack.totalU;

    // Forward Delta: Update totalU
    context.projectStore.setState((state: any) => {
      const targetRack = state.racks.find((r: RackModel) => r.id === this._rackId);
      if (targetRack) {
        targetRack.totalU = this._newTotalU;
      }
    });

    this._executed = true;
    return {
      success: true,
      affectedRackIds: [this._rackId]
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    // Invert Delta: Restore old totalU
    context.projectStore.setState((state: any) => {
      const targetRack = state.racks.find((r: RackModel) => r.id === this._rackId);
      if (targetRack) {
        targetRack.totalU = this._oldTotalU;
      }
    });

    this._executed = false;
    return {
      success: true,
      affectedRackIds: [this._rackId]
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
