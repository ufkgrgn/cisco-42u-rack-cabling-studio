import { ICommand, CommandExecutionResult } from '../../core/history/types';
import { useHistoryStore } from '../../core/state/historyStore';
import { useProjectStore, ProjectState } from '../../core/state/projectStore';
import { useSelectionStore, SelectionState, SelectionType } from '../../core/state/selectionStore';
import { RackModel, CableRun, CableEndpoint } from '../../core/types';

export interface EngineBridgeEventMap {
  // Engine -> App events
  'engine:ready': { renderer: 'webgpu' | 'webgl'; fps: number };
  'engine:error': { message: string; fatal: boolean };
  'viewport:change': { zoom: number; panX: number; panY: number };
  'viewport:resize': { width: number; height: number; dpr: number };
  'device:drag-start': { catalogId: string; sourceRackId?: string; instanceId?: string };
  'device:drag-move': { screenX?: number; screenY?: number; worldX?: number; worldY?: number; snappedU?: number; targetRackId?: string; isValid?: boolean };
  'device:drag-end': { screenX?: number; screenY?: number; instanceId?: string; targetRackId?: string; targetU?: number };
  'port:hover': { endpoint: CableEndpoint | null };
  'selection:change': { type: SelectionType; id: string | null };

  // App -> Engine events
  'camera:pan': { dx: number; dy: number };
  'camera:zoom': { factor: number; screenAnchorX: number; screenAnchorY: number };
  'camera:pan-to': { worldX: number; worldY: number; durationMs?: number };
  'camera:zoom-to': { factor: number; screenX: number; screenY: number };
  'camera:fit-all': void;
  'view:toggle-face': { rackId: string; face: 'front' | 'rear' };
}

type EventCallback<T> = (data: T) => void;

export class EngineBridge {
  private static _instance: EngineBridge;
  private _listeners: Map<keyof EngineBridgeEventMap, Set<EventCallback<any>>> = new Map();
  private _unsubscribeStore: (() => void) | null = null;

  private constructor() {}

  static getInstance(): EngineBridge {
    if (!EngineBridge._instance) {
      EngineBridge._instance = new EngineBridge();
    }
    return EngineBridge._instance;
  }

  // --- Event Emitter Pattern ---

  on<K extends keyof EngineBridgeEventMap>(event: K, callback: EventCallback<EngineBridgeEventMap[K]>): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof EngineBridgeEventMap>(event: K, callback: EventCallback<EngineBridgeEventMap[K]>): void {
    this._listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof EngineBridgeEventMap>(event: K, data: EngineBridgeEventMap[K]): void {
    const set = this._listeners.get(event);
    if (set) {
      set.forEach(cb => cb(data));
    }
  }

  // --- Decoupled Command Dispatch ---

  dispatchCommand(command: ICommand): CommandExecutionResult {
    return useHistoryStore.getState().executeCommand(command);
  }

  // --- Direct Store Access for Canvas Engine ---

  getProjectState(): ProjectState {
    return useProjectStore.getState();
  }

  getSelectionState(): SelectionState {
    return useSelectionStore.getState();
  }

  // --- Transient Subscriptions (Zero-React Updates) ---

  connectEngine(handlers: {
    onRacksChanged: (racks: RackModel[]) => void;
    onCablesChanged: (cables: CableRun[]) => void;
    onSelectionChanged: (type: SelectionType, id: string | null) => void;
  }): () => void {
    const unsubRacks = useProjectStore.subscribe(
      (state) => state.project.racks,
      (racks) => handlers.onRacksChanged(racks)
    );

    const unsubCables = useProjectStore.subscribe(
      (state) => state.project.cables,
      (cables) => handlers.onCablesChanged(cables)
    );

    const unsubSelection = useSelectionStore.subscribe(
      (state) => ({ type: state.selectedType, id: state.selectedId }),
      (sel) => handlers.onSelectionChanged(sel.type, sel.id)
    );

    this._unsubscribeStore = () => {
      unsubRacks();
      unsubCables();
      unsubSelection();
    };

    return this._unsubscribeStore;
  }

  destroy(): void {
    if (this._unsubscribeStore) {
      this._unsubscribeStore();
      this._unsubscribeStore = null;
    }
    this._listeners.clear();
  }

  clear(): void {
    this.destroy();
  }
}

export const engineBridge = EngineBridge.getInstance();
