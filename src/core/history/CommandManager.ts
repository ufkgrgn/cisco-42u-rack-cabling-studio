import { ICommand, CommandContext, CommandExecutionResult } from './types';

export type HistoryListener = (canUndo: boolean, canRedo: boolean, lastAction?: string) => void;

export class CommandManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxDepth: number;
  private listeners: Set<HistoryListener> = new Set();

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  public execute(command: ICommand, context: CommandContext): CommandExecutionResult {
    const res = command.execute(context);
    if (!res.success) return res;

    // Check if mergeable with top of undo stack
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top.mergeWith && top.mergeWith(command)) {
      // Merged
    } else {
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }
    }
    this.redoStack = [];
    this.notify();
    return res;
  }

  public undo(context: CommandContext): CommandExecutionResult {
    const command = this.undoStack.pop();
    if (!command) {
      return { success: false, error: 'Undo stack is empty' };
    }
    const res = command.undo(context);
    if (!res.success) {
      this.undoStack.push(command); // Revert pop if failed
      return res;
    }
    this.redoStack.push(command);
    this.notify();
    return res;
  }

  public redo(context: CommandContext): CommandExecutionResult {
    const command = this.redoStack.pop();
    if (!command) {
      return { success: false, error: 'Redo stack is empty' };
    }
    const res = command.redo ? command.redo(context) : command.execute(context);
    if (!res.success) {
      this.redoStack.push(command); // Revert pop if failed
      return res;
    }
    this.undoStack.push(command);
    this.notify();
    return res;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  public subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const last = this.undoStack[this.undoStack.length - 1]?.description || this.undoStack[this.undoStack.length - 1]?.name;
    for (const listener of this.listeners) {
      listener(this.canUndo(), this.canRedo(), last);
    }
  }
}

export const commandManager = new CommandManager(100);
