import { ICommand, CommandContext, CommandExecutionResult } from './types';

export class MacroCommand implements ICommand {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;
  readonly description?: string;
  private _commands: ICommand[] = [];

  constructor(name: string, description?: string, id?: string) {
    this.id = id || `macro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.name = name;
    this.timestamp = Date.now();
    this.description = description;
  }

  get commands(): readonly ICommand[] {
    return this._commands;
  }

  add(command: ICommand): void {
    this._commands.push(command);
  }

  get length(): number {
    return this._commands.length;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const executed: ICommand[] = [];
    const affectedRacks = new Set<string>();
    const affectedDevices = new Set<string>();
    const affectedCables = new Set<string>();

    for (const cmd of this._commands) {
      const res = cmd.execute(context);
      if (!res.success) {
        // Rollback all previously executed commands in reverse order
        for (let i = executed.length - 1; i >= 0; i--) {
          executed[i]!.undo(context);
        }
        return {
          success: false,
          error: `Transaction '${this.name}' failed during '${cmd.name}': ${res.error}`
        };
      }
      executed.push(cmd);
      res.affectedRackIds?.forEach(id => affectedRacks.add(id));
      res.affectedDeviceIds?.forEach(id => affectedDevices.add(id));
      res.affectedCableIds?.forEach(id => affectedCables.add(id));
    }

    return {
      success: true,
      affectedRackIds: Array.from(affectedRacks),
      affectedDeviceIds: Array.from(affectedDevices),
      affectedCableIds: Array.from(affectedCables)
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    const affectedRacks = new Set<string>();
    const affectedDevices = new Set<string>();
    const affectedCables = new Set<string>();

    // Undo sub-commands in reverse execution order
    for (let i = this._commands.length - 1; i >= 0; i--) {
      const res = this._commands[i]!.undo(context);
      if (!res.success) {
        return {
          success: false,
          error: `Undo failed in transaction '${this.name}' at step '${this._commands[i]!.name}': ${res.error}`
        };
      }
      res.affectedRackIds?.forEach(id => affectedRacks.add(id));
      res.affectedDeviceIds?.forEach(id => affectedDevices.add(id));
      res.affectedCableIds?.forEach(id => affectedCables.add(id));
    }

    return {
      success: true,
      affectedRackIds: Array.from(affectedRacks),
      affectedDeviceIds: Array.from(affectedDevices),
      affectedCableIds: Array.from(affectedCables)
    };
  }

  redo(context: CommandContext): CommandExecutionResult {
    const affectedRacks = new Set<string>();
    const affectedDevices = new Set<string>();
    const affectedCables = new Set<string>();

    // Redo sub-commands in forward order
    for (const cmd of this._commands) {
      const res = cmd.redo ? cmd.redo(context) : cmd.execute(context);
      if (!res.success) {
        return {
          success: false,
          error: `Redo failed in transaction '${this.name}' at step '${cmd.name}': ${res.error}`
        };
      }
      res.affectedRackIds?.forEach(id => affectedRacks.add(id));
      res.affectedDeviceIds?.forEach(id => affectedDevices.add(id));
      res.affectedCableIds?.forEach(id => affectedCables.add(id));
    }

    return {
      success: true,
      affectedRackIds: Array.from(affectedRacks),
      affectedDeviceIds: Array.from(affectedDevices),
      affectedCableIds: Array.from(affectedCables)
    };
  }

  canUndo(context: CommandContext): boolean {
    return this._commands.length > 0 && this._commands.every(c => c.canUndo(context));
  }

  canRedo(context: CommandContext): boolean {
    return this._commands.length > 0 && this._commands.every(c => c.canRedo(context));
  }
}
