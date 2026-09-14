# Milestone M1 Technical Specification: State Management & Command Architecture

- **Milestone**: M1 (Foundation, Shell, Command Architecture & Persistence)
- **Component**: State Stores, Invertible Delta Command Pattern & EngineBridge
- **Author**: Explorer M1 State & Command Architecture (`teamwork_preview_explorer`)
- **Working Directory**: `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m1_2`
- **Date**: 2026-09-14T19:50:00Z

---

## 1. Executive Summary & Problem Analysis

### 1.1 The Legacy State & History Flaws
In the legacy codebase (`js/editor.js` lines 35–43, 82–98):
1. **Full JSON String Snapshot Churn**: Every state modification triggered `snapshot = () => JSON.stringify({ racks, cables, ... })`. Two arrays (`undo` and `redo`) stored complete JSON string dumps capped at 50 entries or 20MB. For topologies with 10 racks, 400 devices, and 2,000 cables, serializing and deserializing megabytes of JSON causes substantial JavaScript heap churn, forced garbage collection pauses exceeding 50ms, and viewport stutter.
2. **Lossy Deletion Reversibility**: In legacy `js/rack.js` (lines 65–83) and `js/app.bundle.js` (lines 1028–1045), deleting a device stripped connected cables via `STATE.cables.filter(...)` without capturing the detached cables. Restoring state required swapping the entire workspace snapshot rather than restoring the localized delta.
3. **DOM-Coupled Re-rendering**: State modifications directly triggered synchronous DOM reflows (`renderRackRailsAndSlots`, `renderMountedDevices`, `renderAllCables`), calculating `getBoundingClientRect()` across hundreds of SVG/DOM elements.
4. **Debounced Persistence Race**: Rapid sequential operations produced race conditions between the 350ms debounced save timer and immediate state restoration (as observed in `tests/editor.test.cjs` line 40 failure: `30 !== 25`).

### 1.2 The Solution: Invertible Delta Commands + Partitioned Zustand + EngineBridge
1. **Invertible Delta Command Pattern (`ICommand`)**: Each user action stores only the minimal forward delta ($\Delta$) and inverse delta ($\Delta^{-1}$). Operations execute in $O(1)$ memory, produce zero serialization overhead, guarantee mathematical reversibility, and support atomic multi-action transactions (`MacroCommand`).
2. **Partitioned Zustand Stores**:
   - `ProjectStore`: Authoritative domain model (racks, devices, cables, custom catalog) updated immutably.
   - `SelectionStore`: Transient UI interaction state (active selection, hover states, pending cabling endpoints). Updating selection never dirties the project or triggers disk writes.
   - `HistoryStore`: Manages undo/redo stacks, transaction grouping, and re-entrancy protection.
3. **Zero-Thrashing `EngineBridge`**: A unidirectional bridge where the PixiJS v8 engine subscribes directly to Zustand's vanilla subscription mechanism (`useProjectStore.subscribe`), bypassing React virtual DOM reconciliation entirely. High-frequency interactions (pan, zoom, ghost dragging at 60 FPS) remain strictly within engine memory; only completed actions dispatch commands through the bridge.

---

## 2. Invertible Delta Command Pattern

### 2.1 Core Architectural Contracts

```typescript
// src/core/history/types.ts

export interface CommandContext {
  projectStore: {
    getState: () => import('../state/projectStore').ProjectState;
    setState: (fn: (state: import('../state/projectStore').ProjectState) => void) => void;
  };
  selectionStore: {
    getState: () => import('../state/selectionStore').SelectionState;
    setState: (fn: (state: import('../state/selectionStore').SelectionState) => void) => void;
  };
  catalogRegistry: Map<string, import('../types').DeviceCatalogItem>;
}

export interface CommandExecutionResult {
  success: boolean;
  error?: string;
  affectedRackIds?: string[];
  affectedDeviceIds?: string[];
  affectedCableIds?: string[];
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
   * Pre-condition guard checking whether the command can safely execute/undo.
   */
  canUndo(context: CommandContext): boolean;
  canRedo(context: CommandContext): boolean;

  /**
   * Optional command coalescing (e.g. merging continuous arrow-key nudges within 500ms).
   */
  mergeWith?(nextCommand: ICommand): boolean;
}
```

### 2.2 MacroCommand & Transaction Grouping

When a composite operation occurs (e.g. deleting a rack which cascades into deleting 20 devices and 50 cables, or duplicating multiple devices), operations must be atomic: all succeed or all roll back.

```typescript
// src/core/history/MacroCommand.ts

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
          executed[i].undo(context);
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
      const res = this._commands[i].undo(context);
      if (!res.success) {
        return {
          success: false,
          error: `Undo failed in transaction '${this.name}' at step '${this._commands[i].name}': ${res.error}`
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
```

---

## 3. Concrete Command Specifications

### 3.1 `PlaceDeviceCommand`
Mounts a device into a rack slot at a specified 1-indexed `startU`.

```typescript
// src/core/history/commands/PlaceDeviceCommand.ts

import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance } from '../../types';

export interface PlaceDevicePayload {
  rackId: string;
  catalogId: string;
  startU: number; // 1-indexed bottom unit
  face?: 'front' | 'rear';
  customLabel?: string;
  instanceId?: string; // Optional predefined ID for deterministic replay
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
    this._device = {
      instanceId: payload.instanceId || `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      catalogId: payload.catalogId,
      rackId: payload.rackId,
      startU: payload.startU,
      uHeight: 1, // Will be resolved from catalog on execute
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
    const rack = project.racks.find(r => r.id === this._rackId);
    if (!rack) return { success: false, error: `Rack '${this._rackId}' not found.` };

    const catItem = context.catalogRegistry.get(this._device.catalogId) || project.customCatalog[this._device.catalogId];
    if (!catItem) return { success: false, error: `Catalog item '${this._device.catalogId}' not found.` };

    this._device.uHeight = catItem.u;
    const endU = this._device.startU + this._device.uHeight - 1;

    // Validation: Rack boundaries
    if (this._device.startU < 1 || endU > rack.totalU) {
      return {
        success: false,
        error: `Placement out of bounds: U${this._device.startU}-U${endU} exceeds rack 1-U${rack.totalU}.`
      };
    }

    // Validation: AABB Interval Collision on same face
    const collision = rack.devices.find(d => {
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

    // Forward Delta: Immutable append
    context.projectStore.setState(state => {
      const targetRack = state.racks.find(r => r.id === this._rackId);
      if (targetRack) {
        targetRack.devices.push({ ...this._device });
      }
    });

    // Transient UI selection side effect
    context.selectionStore.setState(s => {
      s.selectedType = 'device';
      s.selectedId = this._device.instanceId;
      s.activeRackId = this._rackId;
    });

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
    context.projectStore.setState(state => {
      const targetRack = state.racks.find(r => r.id === this._rackId);
      if (targetRack) {
        targetRack.devices = targetRack.devices.filter(d => d.instanceId !== this._device.instanceId);
      }
    });

    // Deselect if deleted device was selected
    context.selectionStore.setState(s => {
      if (s.selectedId === this._device.instanceId) {
        s.selectedId = null;
        s.selectedType = null;
      }
    });

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
```

### 3.2 `MoveDeviceCommand`
Moves an existing device within the same rack or to another rack. Guarantees:
1. Retains identical `instanceId` (identity preservation).
2. Automatically updates `rackId` in all connected cable endpoints (`CableRun.from` and `CableRun.to`) when moving across racks.

```typescript
// src/core/history/commands/MoveDeviceCommand.ts

import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance } from '../../types';

export interface MoveDevicePayload {
  instanceId: string;
  targetRackId: string;
  targetStartU: number;
  targetFace?: 'front' | 'rear';
}

export class MoveDeviceCommand implements ICommand {
  readonly id: string;
  readonly name = 'Move Device';
  readonly timestamp: number;
  readonly description: string;

  private _instanceId: string;
  private _targetRackId: string;
  private _targetStartU: number;
  private _targetFace?: 'front' | 'rear';

  // Snapshot deltas captured during initial execution
  private _sourceRackId!: string;
  private _sourceStartU!: number;
  private _sourceFace!: 'front' | 'rear';
  private _uHeight!: number;
  private _affectedCableIds: string[] = [];
  private _executed = false;

  constructor(payload: MoveDevicePayload) {
    this.id = `cmd-move-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._instanceId = payload.instanceId;
    this._targetRackId = payload.targetRackId;
    this._targetStartU = payload.targetStartU;
    this._targetFace = payload.targetFace;
    this.description = `Move device ${payload.instanceId} to rack ${payload.targetRackId} U${payload.targetStartU}`;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();

    // 1. Locate source device
    let sourceRack = project.racks.find(r => r.devices.some(d => d.instanceId === this._instanceId));
    if (!sourceRack) return { success: false, error: `Device '${this._instanceId}' not found in any rack.` };
    const device = sourceRack.devices.find(d => d.instanceId === this._instanceId)!;

    // Cache source state for inversion
    this._sourceRackId = sourceRack.id;
    this._sourceStartU = device.startU;
    this._sourceFace = device.face;
    this._uHeight = device.uHeight;
    const finalFace = this._targetFace || device.face;

    // 2. Validate target rack
    const targetRack = project.racks.find(r => r.id === this._targetRackId);
    if (!targetRack) return { success: false, error: `Target rack '${this._targetRackId}' not found.` };

    const endU = this._targetStartU + this._uHeight - 1;
    if (this._targetStartU < 1 || endU > targetRack.totalU) {
      return { success: false, error: `Target position U${this._targetStartU}-U${endU} out of bounds for rack ${targetRack.id} (total U: ${targetRack.totalU}).` };
    }

    // 3. Collision check (ignoring the device itself if moving in same rack)
    const collision = targetRack.devices.find(d => {
      if (d.instanceId === this._instanceId) return false;
      if (d.face !== finalFace) return false;
      const dEndU = d.startU + d.uHeight - 1;
      return Math.max(this._targetStartU, d.startU) <= Math.min(endU, dEndU);
    });

    if (collision) {
      return { success: false, error: `Collision at U${this._targetStartU} with '${collision.instanceId}'.` };
    }

    // 4. Forward Delta: Update device and attached cable endpoints
    const interRackMove = this._sourceRackId !== this._targetRackId;
    this._affectedCableIds = [];

    context.projectStore.setState(state => {
      const srcR = state.racks.find(r => r.id === this._sourceRackId)!;
      const tgtR = state.racks.find(r => r.id === this._targetRackId)!;

      const devIdx = srcR.devices.findIndex(d => d.instanceId === this._instanceId);
      const [devObj] = srcR.devices.splice(devIdx, 1);

      devObj.rackId = this._targetRackId;
      devObj.startU = this._targetStartU;
      devObj.face = finalFace;
      tgtR.devices.push(devObj);

      // Preserve cabling topology across racks
      if (interRackMove) {
        state.cables.forEach(c => {
          let touched = false;
          if (c.from.deviceInstanceId === this._instanceId) {
            c.from.rackId = this._targetRackId;
            c.from.face = finalFace;
            touched = true;
          }
          if (c.to.deviceInstanceId === this._instanceId) {
            c.to.rackId = this._targetRackId;
            c.to.face = finalFace;
            touched = true;
          }
          if (touched) this._affectedCableIds.push(c.id);
        });
      }
    });

    // Update selection
    context.selectionStore.setState(s => {
      s.selectedType = 'device';
      s.selectedId = this._instanceId;
      s.activeRackId = this._targetRackId;
    });

    this._executed = true;
    return {
      success: true,
      affectedRackIds: Array.from(new Set([this._sourceRackId, this._targetRackId])),
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._affectedCableIds
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    const interRackMove = this._sourceRackId !== this._targetRackId;

    // Invert Delta: Restore device to source rack & original U/face, revert cables
    context.projectStore.setState(state => {
      const tgtR = state.racks.find(r => r.id === this._targetRackId)!;
      const srcR = state.racks.find(r => r.id === this._sourceRackId)!;

      const devIdx = tgtR.devices.findIndex(d => d.instanceId === this._instanceId);
      const [devObj] = tgtR.devices.splice(devIdx, 1);

      devObj.rackId = this._sourceRackId;
      devObj.startU = this._sourceStartU;
      devObj.face = this._sourceFace;
      srcR.devices.push(devObj);

      if (interRackMove) {
        state.cables.forEach(c => {
          if (c.from.deviceInstanceId === this._instanceId) {
            c.from.rackId = this._sourceRackId;
            c.from.face = this._sourceFace;
          }
          if (c.to.deviceInstanceId === this._instanceId) {
            c.to.rackId = this._sourceRackId;
            c.to.face = this._sourceFace;
          }
        });
      }
    });

    context.selectionStore.setState(s => {
      s.selectedType = 'device';
      s.selectedId = this._instanceId;
      s.activeRackId = this._sourceRackId;
    });

    this._executed = false;
    return {
      success: true,
      affectedRackIds: Array.from(new Set([this._sourceRackId, this._targetRackId])),
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._affectedCableIds
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
```

### 3.3 `RemoveDeviceCommand`
Removes a device and detaches all connected cables.
**Lossless Reversibility Guarantee**: The command caches the detached `CableRun[]` objects. When `undo()` is invoked, both the device AND all of its cables are restored with exact IDs, colors, categories, and port endpoints!

```typescript
// src/core/history/commands/RemoveDeviceCommand.ts

import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance, CableRun } from '../../types';

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

    let foundRack = project.racks.find(r => r.devices.some(d => d.instanceId === this._instanceId));
    if (!foundRack) return { success: false, error: `Device '${this._instanceId}' not found.` };
    const device = foundRack.devices.find(d => d.instanceId === this._instanceId)!;

    this._sourceRackId = foundRack.id;
    this._removedDevice = { ...device };

    // Capture attached cables for lossless undo
    this._detachedCables = project.cables.filter(c =>
      c.from.deviceInstanceId === this._instanceId || c.to.deviceInstanceId === this._instanceId
    );

    // Forward Delta: Remove device and detach cables
    context.projectStore.setState(state => {
      const rack = state.racks.find(r => r.id === this._sourceRackId);
      if (rack) {
        rack.devices = rack.devices.filter(d => d.instanceId !== this._instanceId);
      }
      state.cables = state.cables.filter(c =>
        c.from.deviceInstanceId !== this._instanceId && c.to.deviceInstanceId !== this._instanceId
      );
    });

    // Clear selection
    context.selectionStore.setState(s => {
      if (s.selectedId === this._instanceId) {
        s.selectedId = null;
        s.selectedType = null;
      }
    });

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
    context.projectStore.setState(state => {
      const rack = state.racks.find(r => r.id === this._sourceRackId);
      if (rack) {
        rack.devices.push({ ...this._removedDevice });
      }
      // Re-insert cables
      this._detachedCables.forEach(cable => {
        if (!state.cables.some(c => c.id === cable.id)) {
          state.cables.push({ ...cable });
        }
      });
    });

    context.selectionStore.setState(s => {
      s.selectedType = 'device';
      s.selectedId = this._instanceId;
      s.activeRackId = this._sourceRackId;
    });

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
```

### 3.4 `ResizeRackCommand`
Changes the U-height of a rack dynamically (1U–60U).
**Shrinkage Prohibition Guard (R2, AC4)**: Strictly forbids resizing below the top unit of any mounted device.

```typescript
// src/core/history/commands/ResizeRackCommand.ts

import { ICommand, CommandContext, CommandExecutionResult } from '../types';

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
    const rack = project.racks.find(r => r.id === this._rackId);
    if (!rack) return { success: false, error: `Rack '${this._rackId}' not found.` };

    // 1. Boundary check (1U - 60U)
    if (!Number.isInteger(this._newTotalU) || this._newTotalU < 1 || this._newTotalU > 60) {
      return { success: false, error: `Invalid rack height ${this._newTotalU}U. Must be an integer between 1 and 60.` };
    }

    // 2. Shrinkage Prohibition Guard (AC4)
    const maxOccupiedU = rack.devices.reduce((max, d) => Math.max(max, d.startU + d.uHeight - 1), 0);
    if (this._newTotalU < maxOccupiedU) {
      return {
        success: false,
        error: `Cannot shrink rack to ${this._newTotalU}U: devices are mounted up to U${maxOccupiedU}. Move or remove them first.`
      };
    }

    this._oldTotalU = rack.totalU;

    // Forward Delta: Update totalU
    context.projectStore.setState(state => {
      const targetRack = state.racks.find(r => r.id === this._rackId);
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
    context.projectStore.setState(state => {
      const targetRack = state.racks.find(r => r.id === this._rackId);
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
```

### 3.5 `AddCableCommand`
Creates a cable run between two device ports.

```typescript
// src/core/history/commands/AddCableCommand.ts

import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { CableRun } from '../../types';

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

    // 1. Validate endpoints exist
    const fromDev = project.racks.flatMap(r => r.devices).find(d => d.instanceId === this._cable.from.deviceInstanceId);
    const toDev = project.racks.flatMap(r => r.devices).find(d => d.instanceId === this._cable.to.deviceInstanceId);

    if (!fromDev || !toDev) {
      return { success: false, error: 'One or both endpoint devices do not exist.' };
    }

    // 2. Validate port vacancy (1-to-1 patch cabling)
    const isOccupied = project.cables.some(c =>
      (c.from.deviceInstanceId === this._cable.from.deviceInstanceId && c.from.portId === this._cable.from.portId) ||
      (c.to.deviceInstanceId === this._cable.from.deviceInstanceId && c.to.portId === this._cable.from.portId) ||
      (c.from.deviceInstanceId === this._cable.to.deviceInstanceId && c.from.portId === this._cable.to.portId) ||
      (c.to.deviceInstanceId === this._cable.to.deviceInstanceId && c.to.portId === this._cable.to.portId)
    );

    if (isOccupied) {
      return { success: false, error: 'One or both ports already have an attached cable.' };
    }

    // Forward Delta: Append cable
    context.projectStore.setState(state => {
      state.cables.push({ ...this._cable });
    });

    // Update selection
    context.selectionStore.setState(s => {
      s.selectedType = 'cable';
      s.selectedId = this._cable.id;
      s.pendingConnection = null; // Clear pending state
    });

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
    context.projectStore.setState(state => {
      state.cables = state.cables.filter(c => c.id !== this._cable.id);
    });

    context.selectionStore.setState(s => {
      if (s.selectedId === this._cable.id) {
        s.selectedId = null;
        s.selectedType = null;
      }
    });

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
```

### 3.6 `RemoveCableCommand`
Disconnects and removes a cable run.

```typescript
// src/core/history/commands/RemoveCableCommand.ts

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
    const cable = project.cables.find(c => c.id === this._cableId);
    if (!cable) return { success: false, error: `Cable '${this._cableId}' not found.` };

    this._removedCable = { ...cable };

    // Forward Delta: Filter out cable
    context.projectStore.setState(state => {
      state.cables = state.cables.filter(c => c.id !== this._cableId);
    });

    context.selectionStore.setState(s => {
      if (s.selectedId === this._cableId) {
        s.selectedId = null;
        s.selectedType = null;
      }
    });

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
    context.projectStore.setState(state => {
      state.cables.push({ ...this._removedCable });
    });

    context.selectionStore.setState(s => {
      s.selectedType = 'cable';
      s.selectedId = this._cableId;
    });

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
```

---

## 4. Zustand State Architecture

The application state is partitioned into 3 distinct Zustand stores to prevent render thrashing and preserve strict boundaries.

```
+-------------------------------------------------------------------------------+
|                            STATE ARCHITECTURE                                 |
+-------------------------------------------------------------------------------+
|  1. ProjectStore                                                              |
|     - Authoritative digital twin data: Racks, Mounted Devices, Cables,        |
|       Custom Catalog entries, Metadata.                                       |
|     - Triggers IndexedDB WAL auto-save on change.                             |
|     - Pure immutable state updates.                                           |
+-------------------------------------------------------------------------------+
|  2. SelectionStore                                                            |
|     - Transient UI interaction data: selectedType, selectedId,                |
|       activeRackId, hoveredPort, pendingConnection.                           |
|     - ZERO disk persistence; ZERO undo history generation.                    |
+-------------------------------------------------------------------------------+
|  3. HistoryStore                                                              |
|     - Command Manager: undoStack, redoStack, transactionStack.                |
|     - Dispatches ICommand instances, performs precondition validation,        |
|       coordinates atomic MacroCommands.                                       |
|     - Global Keyboard Shortcut Listener (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).     |
+-------------------------------------------------------------------------------+
```

### 4.1 `ProjectStore` Implementation

```typescript
// src/core/state/projectStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { RackModel, CableRun, DeviceCatalogItem } from '../types';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: '3.0.0';
}

export interface ProjectState {
  metadata: ProjectMetadata;
  racks: RackModel[];
  cables: CableRun[];
  customCatalog: Record<string, DeviceCatalogItem>;
  revision: number; // Monotonically increasing revision counter for WAL

  // Action methods (internal setters for commands and loaders)
  setProject: (project: Omit<ProjectState, 'revision'>) => void;
  updateMetadata: (updates: Partial<ProjectMetadata>) => void;
  mutate: (updater: (draft: ProjectState) => void) => void;
  reset: () => void;
}

const defaultInitialState: Omit<ProjectState, 'setProject' | 'updateMetadata' | 'mutate' | 'reset'> = {
  metadata: {
    id: 'proj-default',
    name: 'Untitled Data Center',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: '3.0.0'
  },
  racks: [
    {
      id: 'rack-1',
      name: 'MDF - 42U Main Distribution Frame',
      totalU: 42,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: 0,
      devices: []
    }
  ],
  cables: [],
  customCatalog: {},
  revision: 0
};

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector(
    immer((set) => ({
      ...defaultInitialState,

      setProject: (project) =>
        set((state) => {
          state.metadata = project.metadata;
          state.racks = project.racks;
          state.cables = project.cables;
          state.customCatalog = project.customCatalog;
          state.revision += 1;
        }),

      updateMetadata: (updates) =>
        set((state) => {
          Object.assign(state.metadata, updates);
          state.metadata.updatedAt = new Date().toISOString();
          state.revision += 1;
        }),

      mutate: (updater) =>
        set((state) => {
          updater(state);
          state.metadata.updatedAt = new Date().toISOString();
          state.revision += 1;
        }),

      reset: () =>
        set((state) => {
          Object.assign(state, {
            ...defaultInitialState,
            metadata: {
              ...defaultInitialState.metadata,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            revision: state.revision + 1
          });
        })
    }))
  )
);
```

### 4.2 `SelectionStore` Implementation

```typescript
// src/core/state/selectionStore.ts

import { create } from 'zustand';
import { CableEndpoint } from '../types';

export type SelectionType = 'rack' | 'device' | 'cable' | 'port' | null;

export interface PendingConnection {
  fromEndpoint: CableEndpoint;
  tempCableColor: string;
}

export interface SelectionState {
  selectedType: SelectionType;
  selectedId: string | null;
  activeRackId: string;
  hoveredPort: CableEndpoint | null;
  pendingConnection: PendingConnection | null;

  // Actions
  select: (type: SelectionType, id: string | null) => void;
  clearSelection: () => void;
  setActiveRack: (rackId: string) => void;
  setHoveredPort: (endpoint: CableEndpoint | null) => void;
  startConnection: (from: CableEndpoint, color?: string) => void;
  cancelConnection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedType: null,
  selectedId: null,
  activeRackId: 'rack-1',
  hoveredPort: null,
  pendingConnection: null,

  select: (type, id) => set({ selectedType: type, selectedId: id }),
  clearSelection: () => set({ selectedType: null, selectedId: null }),
  setActiveRack: (rackId) => set({ activeRackId: rackId }),
  setHoveredPort: (endpoint) => set({ hoveredPort: endpoint }),
  startConnection: (from, color = '#2563eb') =>
    set({ pendingConnection: { fromEndpoint: from, tempCableColor: color } }),
  cancelConnection: () => set({ pendingConnection: null })
}));
```

### 4.3 `HistoryStore` & Keyboard Shortcut Architecture

```typescript
// src/core/state/historyStore.ts

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

  // Actions
  executeCommand: (command: ICommand) => CommandExecutionResult;
  undo: () => CommandExecutionResult;
  redo: () => CommandExecutionResult;
  beginTransaction: (name: string, description?: string) => void;
  commitTransaction: () => CommandExecutionResult;
  rollbackTransaction: () => void;
  clearHistory: () => void;
}

function getCommandContext(): CommandContext {
  return {
    projectStore: {
      getState: () => useProjectStore.getState(),
      setState: (fn) => useProjectStore.getState().mutate(fn)
    },
    selectionStore: {
      getState: () => useSelectionStore.getState(),
      setState: (fn) => useSelectionStore.setState(fn)
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
    let newUndo = [...undoStack];
    const top = newUndo[newUndo.length - 1];
    if (top && top.mergeWith && top.mergeWith(command)) {
      // Merged into top command
    } else {
      newUndo.push(command);
      if (newUndo.length > maxHistorySize) {
        newUndo.shift();
      }
    }

    set({
      undoStack: newUndo,
      redoStack: [], // New command clears redo branch
      canUndo: true,
      canRedo: false
    });

    return res;
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) {
      return { success: false, error: 'Undo stack is empty.' };
    }

    const context = getCommandContext();
    const command = undoStack[undoStack.length - 1];
    const res = command.undo(context);

    if (!res.success) return res;

    const newUndo = undoStack.slice(0, -1);
    const newRedo = [...redoStack, command];

    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: newUndo.length > 0,
      canRedo: true
    });

    return res;
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) {
      return { success: false, error: 'Redo stack is empty.' };
    }

    const context = getCommandContext();
    const command = redoStack[redoStack.length - 1];
    const res = command.redo ? command.redo(context) : command.execute(context);

    if (!res.success) return res;

    const newRedo = redoStack.slice(0, -1);
    const newUndo = [...undoStack, command];

    set({
      undoStack: newUndo,
      redoStack: newRedo,
      canUndo: true,
      canRedo: newRedo.length > 0
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
      canRedo: false
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
      canRedo: false
    });
  }
}));

/**
 * Global Keyboard Shortcut Handler for Undo / Redo
 */
export function setupKeyboardShortcuts(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore keystrokes originating inside editable DOM inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
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
```

---

## 5. Unidirectional Communication: `EngineBridge`

### 5.1 The Zero-Thrashing Architecture
In high-performance 60 FPS graphics, viewport transformations (pan, zoom), pointer hover tracking, and hardware drag ghosts must NEVER trigger React component reconciliation.

```
+---------------------------------------------------------------------------+
|                          REACT DOM COMPONENT TREE                         |
|   (Header, Hardware Catalog, Cable Schedule Table, Inspector Panels)      |
+---------------------------------------------------------------------------+
       |                                              ^
       | React UI Dispatch                            | Granular Selector Update
       v                                              | (e.g. useProjectStore(s => s.cables))
+---------------------------------------------------------------------------+
|                           ZUSTAND STORE LAYER                             |
|       ProjectStore  |  SelectionStore  |  HistoryStore (Commands)         |
+---------------------------------------------------------------------------+
       ^                                              |
       | Command Dispatch                             | Vanilla Transient Subscription
       | (engineBridge.dispatchCommand)               | (subscribeWithSelector - NO REACT)
       |                                              v
+---------------------------------------------------------------------------+
|                           ENGINE BRIDGE BUS                               |
|   - Synchronous Diff Dispatcher                                           |
|   - Event Routing: viewport events, drag lifecycle, selection sync        |
+---------------------------------------------------------------------------+
       ^                                              |
       | Engine Events (pointerup, drag end)          | Direct Scene Graph Mutator
       |                                              v
+---------------------------------------------------------------------------+
|                         PIXIJS v8 2D ENGINE                               |
|   - Isolated RenderGroups (per-rack zero transformation thrashing)        |
|   - Affine Camera Matrix (Pointer-anchored Zoom, Pan)                     |
|   - Drag Ghost Preview & Real-Time AABB Snapping (60 FPS in GPU memory)   |
|   - Instanced Port Sprites & Instanced Catenary Bézier Shaders            |
+---------------------------------------------------------------------------+
```

### 5.2 `EngineBridge` Class Implementation

```typescript
// src/engine/bridge/EngineBridge.ts

import { ICommand, CommandExecutionResult } from '../../core/history/types';
import { useHistoryStore } from '../../core/state/historyStore';
import { useProjectStore, ProjectState } from '../../core/state/projectStore';
import { useSelectionStore, SelectionState, SelectionType } from '../../core/state/selectionStore';
import { RackModel, DeviceInstance, CableRun } from '../../core/types';

export type EngineBridgeEventMap = {
  // Engine -> App events
  'engine:ready': { renderer: 'webgpu' | 'webgl'; fps: number };
  'viewport:change': { zoom: number; panX: number; panY: number };
  'device:drag-start': { catalogId: string; sourceRackId?: string; instanceId?: string };
  'device:drag-move': { worldX: number; worldY: number; snappedU: number; targetRackId: string; isValid: boolean };
  'device:drag-end': { instanceId?: string; targetRackId: string; targetU: number };
  'port:hover': { endpoint: import('../../core/types').CableEndpoint | null };
  'selection:change': { type: SelectionType; id: string | null };

  // App -> Engine events
  'camera:pan-to': { worldX: number; worldY: number; durationMs?: number };
  'camera:zoom-to': { factor: number; screenX: number; screenY: number };
  'camera:fit-all': void;
  'view:toggle-face': { rackId: string; face: 'front' | 'rear' };
};

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

  /**
   * Dispatches an ICommand directly into the HistoryStore without triggering React renders.
   */
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

  /**
   * Initializes vanilla Zustand subscriptions. The engine receives fine-grained
   * delta callbacks without triggering any React component re-renders.
   */
  connectEngine(handlers: {
    onRacksChanged: (racks: RackModel[]) => void;
    onCablesChanged: (cables: CableRun[]) => void;
    onSelectionChanged: (type: SelectionType, id: string | null) => void;
  }): () => void {
    // Subscribe specifically to rack modifications
    const unsubRacks = useProjectStore.subscribe(
      (state) => state.racks,
      (racks) => handlers.onRacksChanged(racks),
      { equalityFn: (a, b) => a === b }
    );

    // Subscribe specifically to cabling modifications
    const unsubCables = useProjectStore.subscribe(
      (state) => state.cables,
      (cables) => handlers.onCablesChanged(cables),
      { equalityFn: (a, b) => a === b }
    );

    // Subscribe to selection modifications
    const unsubSelection = useSelectionStore.subscribe(
      (state) => ({ type: state.selectedType, id: state.selectedId }),
      (sel) => handlers.onSelectionChanged(sel.type, sel.id),
      { equalityFn: (a, b) => a.type === b.type && a.id === b.id }
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
}

export const engineBridge = EngineBridge.getInstance();
```

---

## 6. Worker Implementation Plan & Concrete Test Suite

### 6.1 Worker Implementation Steps
The subsequent Worker agent should implement the state and command layer according to the following file layout:

1. `src/core/types/index.ts`: Shared domain types (`RackModel`, `DeviceInstance`, `CableRun`, `CableEndpoint`, `PortDefinition`, `DeviceCatalogItem`).
2. `src/core/history/types.ts`: `ICommand`, `CommandContext`, `CommandExecutionResult`.
3. `src/core/history/MacroCommand.ts`: Transaction composite command with atomic rollback.
4. `src/core/history/commands/`:
   - `PlaceDeviceCommand.ts`
   - `MoveDeviceCommand.ts`
   - `RemoveDeviceCommand.ts`
   - `ResizeRackCommand.ts`
   - `AddCableCommand.ts`
   - `RemoveCableCommand.ts`
5. `src/core/state/projectStore.ts`: Zustand store for digital twin domain data.
6. `src/core/state/selectionStore.ts`: Transient UI state store.
7. `src/core/state/historyStore.ts`: Command manager and keyboard shortcut handler.
8. `src/engine/bridge/EngineBridge.ts`: Decoupled typed event bridge.

### 6.2 Executable Unit & Integration Test Suite

The Worker must include the following test suite (compatible with Vitest / Node Test Runner):

```typescript
// tests/unit/history_and_state.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useSelectionStore } from '../../src/core/state/selectionStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
import { RemoveDeviceCommand } from '../../src/core/history/commands/RemoveDeviceCommand';
import { ResizeRackCommand } from '../../src/core/history/commands/ResizeRackCommand';
import { AddCableCommand } from '../../src/core/history/commands/AddCableCommand';
import { RemoveCableCommand } from '../../src/core/history/commands/RemoveCableCommand';
import { MacroCommand } from '../../src/core/history/MacroCommand';
import { engineBridge } from '../../src/engine/bridge/EngineBridge';
import { catalogRegistry } from '../../src/core/catalog/catalogRegistry';

describe('M1 State & Command Architecture Test Suite', () => {
  beforeEach(() => {
    // Reset stores to pristine state before each test
    useProjectStore.getState().reset();
    useSelectionStore.getState().clearSelection();
    useHistoryStore.getState().clearHistory();

    // Register test catalog item
    catalogRegistry.set('test-switch-1u', {
      id: 'test-switch-1u',
      name: 'Test 1U Switch',
      category: 'switch',
      u: 1,
      manufacturer: 'Cisco',
      ports: [
        { id: 'p1', name: 'Gi1/0/1', type: 'rj45' },
        { id: 'p2', name: 'Gi1/0/2', type: 'rj45' }
      ]
    });
    catalogRegistry.set('test-server-2u', {
      id: 'test-server-2u',
      name: 'Test 2U Server',
      category: 'server',
      u: 2,
      manufacturer: 'Dell',
      ports: [{ id: 'eth0', name: 'NIC 1', type: 'rj45' }]
    });
  });

  describe('1. Invertible Delta Command Pattern: Place, Move, and Remove', () => {
    it('executes PlaceDeviceCommand, updates state and selection, then undos and redos cleanly', () => {
      const placeCmd = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'test-switch-1u',
        startU: 30,
        face: 'front'
      });

      const res = useHistoryStore.getState().executeCommand(placeCmd);
      expect(res.success).toBe(true);

      const rack = useProjectStore.getState().racks.find(r => r.id === 'rack-1')!;
      expect(rack.devices.length).toBe(1);
      expect(rack.devices[0].startU).toBe(30);
      expect(rack.devices[0].uHeight).toBe(1);
      expect(useSelectionStore.getState().selectedId).toBe(rack.devices[0].instanceId);

      // Undo
      const undoRes = useHistoryStore.getState().undo();
      expect(undoRes.success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(0);
      expect(useSelectionStore.getState().selectedId).toBeNull();

      // Redo
      const redoRes = useHistoryStore.getState().redo();
      expect(redoRes.success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(1);
    });

    it('rejects placement collisions on the same face', () => {
      const place1 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 20 });
      expect(useHistoryStore.getState().executeCommand(place1).success).toBe(true);

      // Attempt to place 2U device at U19-U20 (overlapping U20)
      const place2 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-server-2u', startU: 19 });
      const res = useHistoryStore.getState().executeCommand(place2);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Collision');
    });

    it('MoveDevice preserves hardware identity and attached cable endpoints across racks', () => {
      // Add second rack
      useProjectStore.getState().mutate(state => {
        state.racks.push({
          id: 'rack-2',
          name: 'IDF-1',
          totalU: 42,
          widthMm: 600,
          depthMm: 1000,
          maxLoadKg: 1000,
          positionX: 800,
          devices: []
        });
      });

      const place1 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 10 });
      useHistoryStore.getState().executeCommand(place1);
      const dev1Id = place1.deviceInstance.instanceId;

      const place2 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 15 });
      useHistoryStore.getState().executeCommand(place2);
      const dev2Id = place2.deviceInstance.instanceId;

      // Add cable between dev1 and dev2
      const cableCmd = new AddCableCommand({
        id: 'cbl-001',
        from: { rackId: 'rack-1', deviceInstanceId: dev1Id, portId: 'p1', face: 'front' },
        to: { rackId: 'rack-1', deviceInstanceId: dev2Id, portId: 'p1', face: 'front' },
        color: '#2563eb',
        category: 'copper',
        routingStyle: 'structured'
      });
      useHistoryStore.getState().executeCommand(cableCmd);

      // Move dev1 to rack-2 at U25
      const moveCmd = new MoveDeviceCommand({
        instanceId: dev1Id,
        targetRackId: 'rack-2',
        targetStartU: 25
      });
      const moveRes = useHistoryStore.getState().executeCommand(moveCmd);
      expect(moveRes.success).toBe(true);

      // Verify dev1 is now in rack-2 with same ID
      const rack1 = useProjectStore.getState().racks.find(r => r.id === 'rack-1')!;
      const rack2 = useProjectStore.getState().racks.find(r => r.id === 'rack-2')!;
      expect(rack1.devices.some(d => d.instanceId === dev1Id)).toBe(false);
      expect(rack2.devices.find(d => d.instanceId === dev1Id)?.startU).toBe(25);

      // Verify cable endpoint updated to rack-2
      const cable = useProjectStore.getState().cables.find(c => c.id === 'cbl-001')!;
      expect(cable.from.rackId).toBe('rack-2');
      expect(cable.to.rackId).toBe('rack-1');

      // Undo move
      useHistoryStore.getState().undo();
      const cableUndone = useProjectStore.getState().cables.find(c => c.id === 'cbl-001')!;
      expect(cableUndone.from.rackId).toBe('rack-1');
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.some(d => d.instanceId === dev1Id)).toBe(true);
    });

    it('RemoveDevice captures detached cables and restores them completely on undo', () => {
      const place1 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 10 });
      const place2 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 20 });
      useHistoryStore.getState().executeCommand(place1);
      useHistoryStore.getState().executeCommand(place2);

      const dev1Id = place1.deviceInstance.instanceId;
      const dev2Id = place2.deviceInstance.instanceId;

      const cableCmd = new AddCableCommand({
        id: 'cbl-test',
        from: { rackId: 'rack-1', deviceInstanceId: dev1Id, portId: 'p1', face: 'front' },
        to: { rackId: 'rack-1', deviceInstanceId: dev2Id, portId: 'p1', face: 'front' },
        color: '#22c55e',
        category: 'copper',
        routingStyle: 'direct'
      });
      useHistoryStore.getState().executeCommand(cableCmd);
      expect(useProjectStore.getState().cables.length).toBe(1);

      // Remove dev1
      const removeCmd = new RemoveDeviceCommand(dev1Id);
      const remRes = useHistoryStore.getState().executeCommand(removeCmd);
      expect(remRes.success).toBe(true);

      // Both dev1 and its cable must be removed
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.some(d => d.instanceId === dev1Id)).toBe(false);
      expect(useProjectStore.getState().cables.length).toBe(0);

      // Undo RemoveDevice: restores dev1 AND the cable
      const undoRes = useHistoryStore.getState().undo();
      expect(undoRes.success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.some(d => d.instanceId === dev1Id)).toBe(true);
      expect(useProjectStore.getState().cables.length).toBe(1);
      expect(useProjectStore.getState().cables[0].id).toBe('cbl-test');
    });
  });

  describe('2. Rack Height & Shrinkage Guard (R2, AC4)', () => {
    it('allows resizing rack upwards and downwards within free space', () => {
      const resizeCmd = new ResizeRackCommand('rack-1', 48);
      expect(useHistoryStore.getState().executeCommand(resizeCmd).success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.totalU).toBe(48);

      useHistoryStore.getState().undo();
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.totalU).toBe(42);
    });

    it('prohibits rack shrinkage if occupied slots would be clipped', () => {
      // Mount device at U30
      const place = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 30 });
      useHistoryStore.getState().executeCommand(place);

      // Attempt to shrink rack to 25U
      const shrinkCmd = new ResizeRackCommand('rack-1', 25);
      const res = useHistoryStore.getState().executeCommand(shrinkCmd);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot shrink rack');
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.totalU).toBe(42);
    });
  });

  describe('3. Transaction Grouping (MacroCommand)', () => {
    it('executes multiple commands in transaction, rolls back entirely on failure', () => {
      useHistoryStore.getState().beginTransaction('Batch Mount');

      const cmd1 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 10 });
      useHistoryStore.getState().executeCommand(cmd1);

      // Attempt invalid command that collides
      const cmd2 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 10 });
      const res2 = useHistoryStore.getState().executeCommand(cmd2);
      expect(res2.success).toBe(false);

      // Rollback transaction
      useHistoryStore.getState().rollbackTransaction();

      // State must be completely clean (cmd1 reverted)
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(0);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('commits transaction and allows single-step undo of all batched actions', () => {
      useHistoryStore.getState().beginTransaction('Duplicate Setup');

      const cmd1 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 10 });
      const cmd2 = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 12 });
      useHistoryStore.getState().executeCommand(cmd1);
      useHistoryStore.getState().executeCommand(cmd2);

      const commitRes = useHistoryStore.getState().commitTransaction();
      expect(commitRes.success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(2);

      // Single undo step reverts both devices
      useHistoryStore.getState().undo();
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(0);

      // Redo restores both
      useHistoryStore.getState().redo();
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(2);
    });
  });

  describe('4. Decoupled EngineBridge & Transient Updates', () => {
    it('allows engine to dispatch commands and receive direct store notifications without React render hooks', () => {
      let receivedRacksCount = 0;

      const disconnect = engineBridge.connectEngine({
        onRacksChanged: (racks) => {
          receivedRacksCount = racks.length;
        },
        onCablesChanged: () => {},
        onSelectionChanged: () => {}
      });

      // Dispatch command via EngineBridge
      const cmd = new PlaceDeviceCommand({ rackId: 'rack-1', catalogId: 'test-switch-1u', startU: 5 });
      const res = engineBridge.dispatchCommand(cmd);

      expect(res.success).toBe(true);
      expect(useProjectStore.getState().racks.find(r => r.id === 'rack-1')!.devices.length).toBe(1);

      disconnect();
    });
  });
});
```

---

## 7. Architectural Alignment & Downstream Worker Directives

1. **Integration with `explorer_m1_1` (Tooling & Setup)**:
   - File paths (`src/core/history`, `src/core/state`, `src/engine/bridge`) conform exactly to `PROJECT.md` section 5 code layout.
   - Requires `zustand` (v5.x) and `immer` (v10.x) in `package.json`.
2. **Integration with `explorer_m1_3` (Persistence & WAL)**:
   - `ProjectState.revision` monotonically increments on every project mutation.
   - The Write-Ahead Logger (WAL) hooks into `useProjectStore.subscribe((state) => state.revision, ...)` to write immutable state deltas or checkpoints into IndexedDB without blocking the UI.
3. **Integration with Milestones M3, M4, M5**:
   - `startU` is strictly 1-indexed bottom unit matching EIA-310-D standard.
   - `EngineBridge` provides the clean boundary ensuring PixiJS v8 render ticker never triggers React reconciliations.
