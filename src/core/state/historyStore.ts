import { create } from 'zustand';
import { ICommand, CommandContext, CommandExecutionResult } from '../history/types';
import { MacroCommand } from '../history/MacroCommand';
import { useProjectStore } from './projectStore';
import { useSelectionStore } from './selectionStore';
import { catalogRegistry } from '../catalog/catalogRegistry';

export interface HistoryState {
  undoStack: ICommand[];
  redoStack: ICommand[];
  maxHistorySize: number;
  activeTransaction: MacroCommand | null;
  canUndo: boolean;
  canRedo: boolean;
  lastAction?: string;

  // Actions
  executeCommand: (command: ICommand) => CommandExecutionResult;
  undo: () => CommandExecutionResult;
  redo: () => CommandExecutionResult;
  beginTransaction: (name: string, description?: string) => void;
  commitTransaction: () => CommandExecutionResult;
  rollbackTransaction: () => void;
  clearHistory: () => void;
}

export function getCommandContext(): CommandContext {
  return {
    projectStore: {
      getState: () => useProjectStore.getState().project,
      setState: (fn) => useProjectStore.getState().mutate(fn)
    },
    selectionStore: {
      getState: () => useSelectionStore.getState(),
      setState: (fn) => useSelectionStore.getState().mutate(fn)
    },
    catalogRegistry
  };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistorySize: 100,
  activeTransaction: null,
  canUndo: false,
  canRedo: false,
  lastAction: undefined,

  executeCommand: (command: ICommand) => {
    const { activeTransaction, undoStack, maxHistorySize } = get();
    const context = getCommandContext();

    // If an active transaction exists, buffer the command into the transaction
    if (activeTransaction) {
      const res = command.execute(context);
      if (res.success) {
        activeTransaction.add(command);
      }
      return res;
    }

    // Standalone execution
    const res = command.execute(context);
    if (!res.success) return res;

    // Check if mergeable with top of undo stack
    const newUndo = [...undoStack];
    const top = newUndo[newUndo.length - 1];
    if (top && top.mergeWith && top.mergeWith(command)) {
      // Merged into top command
    } else {
      newUndo.push(command);
      if (newUndo.length > maxHistorySize) {
        newUndo.shift();
      }
    }

    const lastAction = command.description || command.name;

    set({
      undoStack: newUndo,
      redoStack: [], // New command clears redo branch
      canUndo: true,
      canRedo: false,
      lastAction
    });

    return res;
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) {
      return { success: false, error: 'Undo stack is empty.' };
    }

    const context = getCommandContext();
    const command = undoStack[undoStack.length - 1]!;
    const res = command.undo(context);

    if (!res.success) return res;

    const newUndo = undoStack.slice(0, -1);
    const newRedo = [...redoStack, command];
    const lastAction = newUndo[newUndo.length - 1]?.description || newUndo[newUndo.length - 1]?.name;

    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: newUndo.length > 0,
      canRedo: true,
      lastAction
    });

    return res;
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) {
      return { success: false, error: 'Redo stack is empty.' };
    }

    const context = getCommandContext();
    const command = redoStack[redoStack.length - 1]!;
    const res = command.redo ? command.redo(context) : command.execute(context);

    if (!res.success) return res;

    const newRedo = redoStack.slice(0, -1);
    const newUndo = [...undoStack, command];
    const lastAction = command.description || command.name;

    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: true,
      canRedo: newRedo.length > 0,
      lastAction
    });

    return res;
  },

  beginTransaction: (name: string, description?: string) => {
    const { activeTransaction } = get();
    if (activeTransaction) {
      console.warn(`Nested transactions not supported. Committing active transaction '${activeTransaction.name}' first.`);
      get().commitTransaction();
    }
    set({ activeTransaction: new MacroCommand(name, description) });
  },

  commitTransaction: () => {
    const { activeTransaction, undoStack, maxHistorySize } = get();
    if (!activeTransaction) {
      return { success: false, error: 'No active transaction to commit.' };
    }

    set({ activeTransaction: null });

    if (activeTransaction.length === 0) {
      return { success: true }; // No operations performed
    }

    const newUndo = [...undoStack, activeTransaction];
    if (newUndo.length > maxHistorySize) newUndo.shift();

    set({
      undoStack: newUndo,
      redoStack: [],
      canUndo: true,
      canRedo: false,
      lastAction: activeTransaction.description || activeTransaction.name
    });

    return { success: true };
  },

  rollbackTransaction: () => {
    const { activeTransaction } = get();
    if (!activeTransaction) return;

    const context = getCommandContext();
    activeTransaction.undo(context);
    set({ activeTransaction: null });
  },

  clearHistory: () => {
    set({
      undoStack: [],
      redoStack: [],
      activeTransaction: null,
      canUndo: false,
      canRedo: false,
      lastAction: undefined
    });
  }
}));

/**
 * Global Keyboard Shortcut Handler for Undo / Redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
 */
export function setupKeyboardShortcuts(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Ctrl+Z (without Shift) -> Undo
    if (isCtrlOrMeta && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      useHistoryStore.getState().undo();
    }
    // Ctrl+Shift+Z or Ctrl+Y -> Redo
    else if (isCtrlOrMeta && (key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault();
      useHistoryStore.getState().redo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
