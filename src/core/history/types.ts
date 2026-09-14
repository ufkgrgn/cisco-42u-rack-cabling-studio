import { DeviceCatalogItem } from '../types';

export interface CommandExecutionResult {
  success: boolean;
  error?: string;
  affectedRackIds?: string[];
  affectedDeviceIds?: string[];
  affectedCableIds?: string[];
}

export interface CommandContext {
  projectStore: {
    getState: () => any;
    setState: (fn: (state: any) => void) => void;
  };
  selectionStore: {
    getState: () => any;
    setState: (fn: (state: any) => void) => void;
  };
  catalogRegistry: Map<string, DeviceCatalogItem>;
}

export interface ICommand {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;
  readonly description?: string;

  /**
   * Executes the command forward, applying the delta to project state.
   */
  execute(context: CommandContext): CommandExecutionResult;

  /**
   * Reverses the command, restoring the exact previous state.
   */
  undo(context: CommandContext): CommandExecutionResult;

  /**
   * Reapplies the command forward after an undo.
   */
  redo(context: CommandContext): CommandExecutionResult;

  /**
   * Pre-condition guards checking whether the command can safely execute/undo.
   */
  canUndo(context: CommandContext): boolean;
  canRedo(context: CommandContext): boolean;

  /**
   * Optional command coalescing (e.g. merging continuous arrow-key nudges within 500ms).
   */
  mergeWith?(nextCommand: ICommand): boolean;
}
