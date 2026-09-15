# Handoff Report: Milestone M3 Explorer 3 (F2.5 Hardware Identity & Cable Endpoint Retention)

**Explorer**: Explorer 3 (M3 Focus Area F2.5)  
**Date**: 2026-09-15  
**Working Directory**: `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_g3_3`  
**Target Milestone**: M3 (Dynamic Variable U-Height & Conflict-Free Placement Engine)  

---

## 1. Observation

### 1.1 Invertible Command Architecture & State Updates
- **`src/core/history/commands/MoveDeviceCommand.ts`**:
  - In lines 30-38, the constructor accepts `MoveDevicePayload`:
    ```typescript
    export interface MoveDevicePayload {
      instanceId: string;
      targetRackId: string;
      targetStartU: number;
      targetFace?: 'front' | 'rear';
    }
    ```
  - In lines 44-54, it locates the source device by `instanceId` across all racks, capturing source state:
    ```typescript
    const sourceRack = project.racks.find((r: RackModel) => r.devices.some((d: DeviceInstance) => d.instanceId === this._instanceId));
    this._sourceRackId = sourceRack.id;
    this._sourceStartU = device.startU;
    this._sourceFace = device.face;
    this._uHeight = device.uHeight;
    ```
  - In lines 80-91, forward execution moves the device object without altering `devObj.instanceId`:
    ```typescript
    const devIdx = srcR.devices.findIndex((d: DeviceInstance) => d.instanceId === this._instanceId);
    const [devObj] = srcR.devices.splice(devIdx, 1);
    devObj.rackId = this._targetRackId;
    devObj.startU = this._targetStartU;
    devObj.face = finalFace;
    tgtR.devices.push(devObj);
    ```
  - **Defect Observation 1 (Intra-Rack Cable Tracking Gap)**:
    In lines 77-108:
    ```typescript
    const interRackMove = this._sourceRackId !== this._targetRackId;
    this._affectedCableIds = [];
    ...
    if (interRackMove && state.cables) {
      state.cables.forEach((c: CableRun) => {
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
    ```
    When `_sourceRackId === _targetRackId` (device moving between slots in the same rack, e.g. U10 to U25):
    1. `interRackMove` is `false`.
    2. `_affectedCableIds` remains `[]` (empty), even though all cables attached to `this._instanceId` had their physical endpoint coordinates moved in space.
    3. If `targetFace` is flipped on the same rack (e.g., from `'front'` to `'rear'`), `c.from.face` and `c.to.face` are NOT updated to `finalFace`.
    4. On `undo()`, lines 131 and 145 also guard cable reversion with `if (interRackMove && state.cables)`, so face reversals on the same rack are similarly not reverted.

- **`src/core/history/commands/RemoveDeviceCommand.ts`**:
  - In lines 33-49, it captures attached cables and cascades deletion:
    ```typescript
    this._detachedCables = (project.cables || []).filter((c: CableRun) =>
      c.from.deviceInstanceId === this._instanceId || c.to.deviceInstanceId === this._instanceId
    );
    ```
  - In lines 69-86, `undo()` restores both the device (with identical `instanceId`) and all detached cables (with identical cable IDs and endpoint structures), providing complete reversible cascade integrity.

- **`src/core/history/commands/ResizeRackCommand.ts`**:
  - In lines 33-40, it enforces the Shrinkage Prohibition Guard (AC4 / F2.4):
    ```typescript
    const maxOccupiedU = rack.devices.reduce((max: number, d: DeviceInstance) => Math.max(max, d.startU + d.uHeight - 1), 0);
    if (this._newTotalU < maxOccupiedU) {
      return {
        success: false,
        error: `Cannot shrink rack to ${this._newTotalU}U: devices are mounted up to U${maxOccupiedU}. Move or remove them first.`
      };
    }
    ```

- **`src/core/history/CommandManager.ts` & `src/core/state/historyStore.ts`**:
  - `CommandManager` maintains `undoStack: ICommand[]` and `redoStack: ICommand[]` with a default `maxDepth = 100`.
  - `useHistoryStore` provides `executeCommand`, `undo`, `redo`, `beginTransaction`, `commitTransaction`, `rollbackTransaction`, and keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z).
  - All command actions are invertible with full undo/redo fidelity.

### 1.2 Cable Model & Endpoint References
- **`src/core/types/index.ts`** (Lines 96-126) and **`src/core/persistence/schemas.ts`** (Lines 144-168):
  ```typescript
  export interface CableEndpoint {
    rackId: string;
    deviceInstanceId: string;
    portId: string;
    face: 'front' | 'rear';
  }

  export interface CableRun {
    id: string;
    from: CableEndpoint;
    to: CableEndpoint;
    color: string;
    category: CableCategory;
    routingStyle: CableRoutingStyle;
    lengthMeters?: number;
    notes?: string;
  }
  ```
- **Port Mutual Exclusion**: In `schemas.ts` lines 230-244, `ProjectSchemaV3` validates that every unique `rackId:deviceInstanceId:face:portId` key is connected to at most ONE cable endpoint.
- **Migration Normalization**: In `src/core/persistence/migration.ts` lines 272-303, older Schema V1/V2 files that used `c.from.instanceId` are automatically migrated to `c.from.deviceInstanceId`.

### 1.3 UI & Canvas Integration
- **`src/engine/interaction/DragManager.ts`**:
  - In lines 132-155:
    When moving an existing device, `DragManager` dispatches `new MoveDeviceCommand` passing the existing `_state.instanceId`, preserving the exact hardware identity.
  - In lines 199-229, `checkCollision` validates the AABB interval `[startU, startU + uHeight - 1]` against existing devices on the same mounting face.
- **`src/engine/scene/RackContainer.ts`**:
  - In lines 81-120 (`syncDevices`), `RackContainer` indexes `deviceMap` by `d.instanceId`. When a device moves, its existing `DeviceContainer` is retained and repositioned:
    ```typescript
    const localX = 53;
    const topUnit = d.startU + d.uHeight - 1;
    const localY = 32 + (this.totalU - topUnit) * 32;
    devContainer.position.set(localX, localY);
    ```

### 1.4 Test Suite Baseline Execution
- **E2E Test Runner (`node tests/e2e/runner.cjs`)**:
  - Result: **326 / 326 PASSED (100%)**, 0 failures, 0 page errors, duration: 11.01s.
  - Features F2.1 - F2.5:
    - Tier 1: 25 / 25 tests passed (F2.1.1–F2.1.5, F2.2.1–F2.2.5, F2.3.1–F2.3.5, F2.4.1–F2.4.5, F2.5.1–F2.5.5).
    - Tier 2: 25 / 25 tests passed (B2.1.1–B2.1.5, B2.2.1–B2.2.5, B2.3.1–B2.3.5, B2.4.1–B2.4.5, B2.5.1–B2.5.5).
    - Tier 3 Cross-Feature tests covering F2.5: X3.4, X3.5, X3.6, X3.7, X3.18, X3.22 all PASSED.
- **Vitest Unit Test Suite (`vitest run`)**:
  - Result: **10 test files, 106 tests PASSED (100%)**, duration: 2.22s.
  - `tests/unit/command.test.ts`: 7 suites covering PlaceDeviceCommand, MoveDeviceCommand, RemoveDeviceCommand, ResizeRackCommand, AddCableCommand, RemoveCableCommand, MacroCommand.

---

## 2. Logic Chain

1. **Premise**: In F2.5, moving or rearranging devices must preserve unique instance IDs (`instanceId`), and attached cable endpoints must maintain validity and update dynamically whether devices are moved between slots or between racks.
2. **From Observation 1.1**: `MoveDeviceCommand` maintains `instanceId` when moving devices in both intra-rack and inter-rack scenarios. Furthermore, `RackContainer.syncDevices` identifies containers by `instanceId`, ensuring zero DOM/Pixi re-allocation thrashing.
3. **From Observation 1.1 (Defect 1)**: `MoveDeviceCommand` restricts cable updates and `affectedCableIds` population exclusively to `if (interRackMove && state.cables)`.
   - In an intra-rack move (e.g. device moved from U10 to U25 within rack-1), the device's physical coordinate changes. Any cables connected to that device must be flagged as affected (`affectedCableIds: [cableId1, ...]`) so that geometry, path rendering, and cable schedule metraj are recomputed.
   - If a device's mounting face is changed within the same rack (`targetFace !== sourceFace`), the cable endpoint's `face` attribute fails to update because `interRackMove` is `false`.
4. **From Observation 1.2**: In Schema V3, `CableEndpoint` references `rackId`, `deviceInstanceId`, `portId`, and `face`. Because cable endpoints reference `deviceInstanceId`, any move preserves endpoint referential integrity by design as long as `deviceInstanceId` is never mutated.
5. **From Observation 1.3 & `PROJECT.md` Section 4**: The placement validation logic (`validatePlacement` and `canResizeRack`) defined in the architecture specification is currently fragmented across commands (`MoveDeviceCommand`, `PlaceDeviceCommand`, `ResizeRackCommand`) and engine interaction (`DragManager.ts`). Consolidating this into a dedicated `src/core/placement` domain module will provide a single source of truth for conflict detection, shrinkage guards, and cable retention.

---

## 3. Caveats

1. **Cabling Rendering Pipeline (M5 Dependency)**:
   - While the state model (`projectStore`, `schemas.ts`, commands) completely stores and updates `CableRun` endpoints, the PixiJS GPU rendering pipeline for cables (`src/engine/cabling/`) is scheduled for Milestone M5. Currently, `PixiCanvas.syncCables` stubs GPU rendering (`markDirty()`), while legacy SVG rendering in `js/cabling.js` handles DOM-based drawing.
2. **Dual-Face Multi-Port Disambiguation**:
   - For devices with ports on both front and rear facias, when a device is flipped from front mount to rear mount, endpoints should reflect the physical face on which the port resides relative to the rack enclosure.

---

## 4. Conclusion & Concrete Recommendations for Worker M3

### Current State Analysis Summary
- The core Invertible Command Architecture (`ICommand`, `CommandManager`, `MacroCommand`, `useHistoryStore`) is robust, well-tested, and fully functional.
- Device identity (`instanceId`) is cleanly preserved across placements, moves, deletions, and burst undo/redo stacks.
- All existing 326 E2E tests and 106 unit tests currently pass 100%.

### Recommended Updates & Architecture Improvements

#### 1. Fix `MoveDeviceCommand.ts` Cable Tracking & Face Update
- Modify `execute()` in `src/core/history/commands/MoveDeviceCommand.ts`:
  - Always iterate through `state.cables` to identify any cable connected to `this._instanceId`.
  - Always push attached cable IDs into `this._affectedCableIds` (for both intra-rack and inter-rack moves).
  - Update `c.from.rackId = this._targetRackId` and `c.to.rackId = this._targetRackId`.
  - If `finalFace !== this._sourceFace`, update `c.from.face = finalFace` and `c.to.face = finalFace`.
  - In `undo()`, revert `rackId` to `this._sourceRackId` and `face` to `this._sourceFace` for all attached cables, regardless of whether it was an inter-rack move.

#### 2. Create `src/core/placement/` Domain Module
Implement the interface contracts declared in `PROJECT.md` § 4:
- **`src/core/placement/types.ts`**:
  Export `PlacementValidationResult`, `RackResizeResult`, `IntervalOverlap`.
- **`src/core/placement/placementEngine.ts`**:
  - `validatePlacement(rack: RackModel, device: DeviceInstance, targetU: number, targetFace?: 'front' | 'rear'): PlacementValidationResult`
  - `canResizeRack(rack: RackModel, newTotalU: number): { allowed: boolean; maxOccupiedU: number; conflictingDevices?: DeviceInstance[] }`
  - `checkAABBCollision(startU1: number, heightU1: number, startU2: number, heightU2: number): boolean`
- **`src/core/placement/cableRetention.ts`**:
  - `recalculateCableEndpoints(cables: CableRun[], movedInstanceId: string, targetRackId: string, targetFace?: 'front' | 'rear'): { updatedCables: CableRun[]; affectedCableIds: string[] }`
  - `validateCableTopologyIntegrity(cables: CableRun[], racks: RackModel[]): { valid: boolean; danglingCables: string[] }`
- **`src/core/placement/index.ts`**:
  Re-export all placement and retention utilities.

#### 3. Refactor Commands to Use Centralized Placement Engine
- Refactor `PlaceDeviceCommand.ts`, `MoveDeviceCommand.ts`, and `ResizeRackCommand.ts` to delegate their validation checks to `validatePlacement` and `canResizeRack`.
- Refactor `DragManager.ts` (`checkCollision`) to share the same AABB collision logic from `src/core/placement/placementEngine.ts`.

---

## 5. Verification Method

### 5.1 Test Suites to Execute
1. **Full E2E Test Suite (326 Tests)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
   ```
   **Expected Outcome**: 326 / 326 PASSED, exit code 0.

2. **Targeted E2E Tier 1 & Tier 2 F2.1–F2.5 Tests**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" --test tests/e2e/tier1-feature-coverage.test.cjs
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" --test tests/e2e/tier2-boundary-corner.test.cjs
   ```

3. **Targeted Cross-Feature Tests (Tier 3)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" --test tests/e2e/tier3-cross-feature.test.cjs
   ```
   Specifically verifies X3.4, X3.5, X3.6, X3.7, X3.18, X3.22.

4. **Vitest Unit Test Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run
   ```
   **Expected Outcome**: 10 passed test files, 106+ passed tests.

### 5.2 Unit Test Expansion for Worker M3
Worker M3 should add targeted unit test cases in `tests/unit/command.test.ts` or a new `tests/unit/placement.test.ts`:
- Moving device within same rack returns `affectedCableIds` containing all attached cables.
- Flipping device face from `'front'` to `'rear'` within same rack updates cable endpoint `face` and reverts cleanly on undo.
- `validatePlacement` correctly rejects AABB collision, out of bounds, and allows abutting devices.
- `canResizeRack` prohibits shrinkage below max occupied U and allows valid expansion/shrinkage.

### 5.3 Invalidation Conditions
- Any change that mutates or regenerates `instanceId` during device moves, rack resizes, or undo/redo.
- Any change that leaves cable endpoints referencing an outdated `rackId` or nonexistent `deviceInstanceId`.
- Failure of any of the 326 E2E tests or 106 unit tests.
