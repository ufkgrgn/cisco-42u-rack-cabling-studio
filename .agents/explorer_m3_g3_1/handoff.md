# Milestone M3 Technical Investigation Report
**Subsystem Focus:** F2.1 (Dynamic Variable U-Height Racks: 1U-60U) & F2.2 (Front & Rear Viewpoints)  
**Agent:** Explorer 1 (`explorer_m3_g3_1`)  
**Target Milestone:** Milestone M3 (Dynamic Variable Rack & Conflict-Free Placement Engine)  
**Date:** 2026-09-15  

---

## 1. Observation

### 1.1 Existing Domain Models & State Management
- **`src/core/types/index.ts` (lines 62-85):**
  ```typescript
  export interface DeviceInstance {
    instanceId: string;
    catalogId: string;
    rackId: string;
    startU: number; // 1-indexed bottom unit (EIA-310-D standard)
    uHeight: number;
    face: 'front' | 'rear';
    customLabel?: string;
    ...
  }

  export interface RackModel {
    id: string;
    name: string;
    totalU: number; // 1..60
    widthMm: number;
    depthMm: number;
    maxLoadKg: number;
    positionX: number; // World spatial coordinate
    devices: DeviceInstance[];
  }
  ```
  `DeviceInstance` explicitly models `face: 'front' | 'rear'`, but `RackModel` does not specify an `activeViewFace` or `viewpoint` property.
- **`src/core/types/index.ts` (lines 21-31, 51-52):**
  `PortDefinition` defines optional normalized coordinates: `xPct?: number; yPct?: number;` (0..1 range). `DeviceCatalogItem` has `ports: PortDefinition[];` and `rearPorts?: PortDefinition[];`.
- **`src/core/types/index.ts` (lines 87-91):**
  `PlacementValidationResult` is defined with `valid: boolean; conflictingInstanceId?: string; reason?: 'COLLISION' | 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED';`. However, the module `src/core/placement/` promised in `PROJECT.md § 4` does not yet exist on disk.
- **`src/core/state/projectStore.ts` (lines 33-47):**
  Initial state provides a default 42U rack. Mutations go through `mutate((draft) => void)`. There is no dedicated placement validation helper inside the store; validation is performed imperatively inside commands.

### 1.2 Placement Logic & Commands
- **Placement Logic Duplication:**
  Validation logic is currently fragmented across multiple files:
  1. `src/core/history/commands/PlaceDeviceCommand.ts` (lines 57-76): Direct AABB check `Math.max(this._device.startU, d.startU) <= Math.min(endU, dEndU)` and boundary check `startU < 1 || endU > rack.totalU`.
  2. `src/core/history/commands/MoveDeviceCommand.ts` (lines 59-74): Re-implements AABB check and boundary check, filtering by target face and ignoring `movingInstanceId`.
  3. `src/core/history/commands/ResizeRackCommand.ts` (lines 29-40): Implements boundary check `1 <= newTotalU <= 60` and shrinkage guard `maxOccupiedU = max(d.startU + d.uHeight - 1)`.
  4. `src/engine/interaction/DragManager.ts` (lines 200-229): Re-implements `checkCollision(rack, startU, uHeight, movingInstanceId, face)` with identical interval overlap formulas.
  5. `src/core/persistence/schemas.ts` (lines 105-138): Zod refinement repeats the boundary check and pairwise interval collision check.
- **Missing Module:** `src/core/placement/` does not exist. Neither `validatePlacement` nor `canResizeRack` are exported as reusable functions.

### 1.3 Canvas Engine & Scene Graph
- **`src/engine/scene/RackContainer.ts`:**
  - Line 12: `public readonly totalU: number;` is marked `readonly`.
  - Line 14: `public readonly rackHeight: number;` (computed once as `totalU * 32 + 64`).
  - Lines 168-175: Rail hole pattern renders static offsets `[7, 16, 25]` per 1U instead of the standard EIA-310-D spacing (0.5" - 0.625" - 0.625" repeat).
  - Lines 195-203: U-number labels are rendered only if `u === 1 || u === this.totalU || u % 5 === 0`.
  - Lines 81-124: `syncDevices` positions devices using `localY = 32 + (this.totalU - topUnit) * 32`. It mounts all devices regardless of `face: 'front' | 'rear'`.
  - `RackContainer` does not have a `setViewFace(face)` method or `setTotalU(newTotalU)` method.
- **`src/engine/scene/SceneGraph.ts` (lines 53-70):**
  - In `syncRacks()`, if `container` already exists for `rackModel.id`, it only executes `container.x = targetX; container.syncDevices(...)`. It never detects if `rackModel.totalU` changed.
- **`src/engine/scene/DeviceContainer.ts`:**
  - Lines 137-153: In `buildDetailed()`, port positions are hardcoded: `const px = 160 + (idx % 24) * 12; const py = 6 + Math.floor(idx / 24) * 14;`. It ignores `port.xPct` and `port.yPct`.
  - Does not render `catalogItem.rearPorts` or support flipping to rear facia view when viewpoint changes.
- **`src/engine/bridge/EngineBridge.ts` (line 25):**
  - Defines event `'view:toggle-face': { rackId: string; face: 'front' | 'rear' };` in `EngineBridgeEventMap`, but no code currently emits or listens to this event.
- **`src/engine/canvas/PixiCanvas.ts` (lines 266-271):**
  - Listens to `camera:fit-all` and implements `fitAllRacks()`, but does not listen to `view:toggle-face`.

### 1.4 React UI Controls
- **`src/app/components/Toolbar.tsx`:**
  - Lines 26-36: Rack height dropdown provides hardcoded preset options `[12, 18, 24, 36, 42, 45, 48, 52, 60]`. It does not support arbitrary 1U-60U sizing, nor does it display validation errors when resizing fails (e.g. shrinkage prohibition).
  - Lines 50-69: Zoom In, Zoom Out, and Fit View buttons have empty click handlers (no `onClick` wired to `EngineBridge`).
  - Contains no viewpoint switcher (`Front` vs `Rear`) or active viewpoint badge.

### 1.5 Test Verification Status
- Executed `node tests/e2e/runner.cjs`: 326 / 326 tests pass cleanly across Tiers 1-4.
- Executed `vitest run`: 106 / 106 tests pass across 10 test files.
- Current tests verify:
  - F2.1: 1U-60U rack bounds, non-integer/0U/61U rejection, dynamic slot count, slot indices 1 and N.
  - F2.2: Faceplate rendering, normalized port coordinates, default face 'front', dual-sided cable tags.
  - F2.3: AABB interval collisions on the same face, collision freedom on opposite faces, abutting slots.
  - F2.4: Prohibited rack shrinkage when units are occupied, unblocked resize when unoccupied.
  - F2.5: Device ID preservation, cable endpoint retention on move.

---

## 2. Logic Chain

```
[Observation: Fragmented Placement Logic in Commands & DragManager]
                              │
                              ▼
[Need: Centralized Placement Module in src/core/placement/]
- validatePlacement(rack, device, targetU?)
- canResizeRack(rack, newTotalU)
- EIA-310-D physical dimension constants & coordinate math
                              │
                              ▼
[Observation: RackContainer.totalU is readonly; SceneGraph does not detect totalU changes]
                              │
                              ▼
[Need: Dynamic RackContainer Resizing]
- RackContainer.setTotalU(newTotalU, name) re-renders frame, rails, slots, badge
- SceneGraph.syncRacks checks if container.totalU !== rackModel.totalU
- Devices dynamically reposition according to new totalU (EIA-310-D bottom-up math)
                              │
                              ▼
[Observation: EIA hole pattern static [7,16,25]; spec calls for 0.5"-0.625"-0.625" repeat]
                              │
                              ▼
[Need: Accurate EIA-310-D Rail Hole Spacing]
- 1U = 1.75 in = 44.45 mm = 32 px
- Centers at 0.25", 0.875", 1.50" relative to U top
- Normalized pixel offsets: [4.6px, 16.0px, 27.4px] per U
                              │
                              ▼
[Observation: DeviceContainer ignores xPct/yPct & rearPorts; view:toggle-face unused]
                              │
                              ▼
[Need: Dual-Sided Rack & Facia Rendering Engine]
- DeviceContainer.setViewFace('front' | 'rear'):
  * Front view: render catalogItem.ports using xPct/yPct
  * Rear view: render catalogItem.rearPorts (or rear PDU outlets / chassis PSU fans)
- RackContainer.setViewFace('front' | 'rear'):
  * Header displays [FRONT] or [REAR]
  * Propagates viewFace to all DeviceContainers
- EngineBridge wires 'view:toggle-face' to PixiCanvas & SceneGraph
                              │
                              ▼
[Observation: Toolbar lacks Viewpoint toggle, arbitrary 1-60U height input, and camera click handlers]
                              │
                              ▼
[Need: Toolbar UI Enhancements]
- Front/Rear viewpoint segmented toggle with active visual badge
- Dynamic Rack Height selector (presets + custom 1-60U input + shrinkage error tooltip/toast)
- Wired Zoom In, Zoom Out, and Fit View / Center Rack buttons
```

---

## 3. Recommended Interface & Architecture Changes

### 3.1 New Module: `src/core/placement/`
Create two core files under `src/core/placement/`:

#### A. `src/core/placement/dimensions.ts`
Centralizes EIA-310-D physical dimensions and coordinate math:
```typescript
export const EIA_RACK_DIMENSIONS = {
  U_HEIGHT_PX: 32,                 // 1U = 1.75" (44.45 mm) = 32px
  CHASSIS_WIDTH_PX: 480,           // 17.72" (450 mm)
  EAR_WIDTH_PX: 24,                // 1.25" (31.75 mm) ear flange on each side
  TOTAL_MOUNT_WIDTH_PX: 528,       // 480 + 2 * 24 = 528px (19" opening)
  CABLE_CHANNEL_WIDTH_PX: 53,      // Side cable management ducts
  CABINET_WIDTH_PX: 634,           // 53 + 24 + 480 + 24 + 53 = 634px
  HEADER_HEIGHT_PX: 32,            // Top cabinet frame
  PLINTH_HEIGHT_PX: 32,            // Bottom cabinet plinth
  MIN_U: 1,
  MAX_U: 60,
  DEFAULT_U: 42,

  // EIA-310-D hole offsets within 1U (0.25", 0.875", 1.50" from top of U)
  // Repeating pattern: 0.500" - 0.625" - 0.625"
  RAIL_HOLE_OFFSETS_PX: [4.57, 16.0, 27.43] as const,
  RAIL_HOLE_WIDTH_PX: 4,
  RAIL_HOLE_HEIGHT_PX: 3,
};

export function getRackHeightPx(totalU: number): number {
  return totalU * EIA_RACK_DIMENSIONS.U_HEIGHT_PX + EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX + EIA_RACK_DIMENSIONS.PLINTH_HEIGHT_PX;
}

export function uToLocalY(startU: number, uHeight: number, totalU: number): number {
  const topU = startU + uHeight - 1;
  return EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX + (totalU - topU) * EIA_RACK_DIMENSIONS.U_HEIGHT_PX;
}

export function localYToU(localY: number, uHeight: number, totalU: number): number {
  const deltaY = localY - EIA_RACK_DIMENSIONS.HEADER_HEIGHT_PX;
  const slotFromTop = Math.round(deltaY / EIA_RACK_DIMENSIONS.U_HEIGHT_PX);
  const endU = totalU - slotFromTop;
  return endU - uHeight + 1;
}
```

#### B. `src/core/placement/placementValidation.ts`
Implements the exact interface contract defined in `PROJECT.md § 4`:
```typescript
import { RackModel, DeviceInstance, PlacementValidationResult } from '../types';

export function checkAABBOverlap(
  startA: number,
  uHeightA: number,
  startB: number,
  uHeightB: number
): boolean {
  const endA = startA + uHeightA - 1;
  const endB = startB + uHeightB - 1;
  return Math.max(startA, startB) <= Math.min(endA, endB);
}

export function validatePlacement(
  rack: RackModel,
  device: { startU: number; uHeight: number; face: 'front' | 'rear'; instanceId?: string },
  targetU?: number
): PlacementValidationResult {
  const startU = targetU !== undefined ? targetU : device.startU;
  const endU = startU + device.uHeight - 1;

  // 1. Boundary check
  if (!Number.isInteger(startU) || startU < 1 || endU > rack.totalU) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS'
    };
  }

  // 2. AABB Interval collision check (on the same mounting face)
  for (const existing of rack.devices) {
    if (device.instanceId && existing.instanceId === device.instanceId) continue;
    if (existing.face !== device.face) continue;

    if (checkAABBOverlap(startU, device.uHeight, existing.startU, existing.uHeight)) {
      return {
        valid: false,
        conflictingInstanceId: existing.instanceId,
        reason: 'COLLISION'
      };
    }
  }

  return { valid: true };
}

export function canResizeRack(
  rack: RackModel,
  newTotalU: number
): { allowed: boolean; maxOccupiedU: number; reason?: 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED' } {
  if (!Number.isInteger(newTotalU) || newTotalU < 1 || newTotalU > 60) {
    return { allowed: false, maxOccupiedU: 0, reason: 'OUT_OF_BOUNDS' };
  }

  const maxOccupiedU = rack.devices.reduce(
    (max, d) => Math.max(max, d.startU + d.uHeight - 1),
    0
  );

  if (newTotalU < maxOccupiedU) {
    return { allowed: false, maxOccupiedU, reason: 'SHRINKAGE_OCCUPIED' };
  }

  return { allowed: true, maxOccupiedU };
}
```

### 3.2 Dynamic Variable Rack Height Updates in `RackContainer` & `SceneGraph`
- **`RackContainer`:**
  - Make `totalU` mutable internally (`private _totalU: number; get totalU(): number`).
  - Add method `public setTotalU(newTotalU: number, name?: string): void`:
    1. Updates `_totalU = newTotalU`.
    2. Recalculates `rackHeight = newTotalU * 32 + 64`.
    3. Updates `cullArea.height = this.rackHeight`.
    4. Clears and re-renders `frameGraphics`, `railsGraphics`, `uSlotsContainer`, `badgeContainer`.
    5. Re-positions all mounted `deviceMap` containers to align with the new `_totalU`.
- **`SceneGraph`:**
  - In `syncRacks()`:
    ```typescript
    if (!container) {
      container = new RackContainer(rackModel);
      container.x = targetX;
      this.rackContainers.set(rackModel.id, container);
      this.rackLayer.addChild(container);
    } else {
      container.x = targetX;
      if (container.totalU !== rackModel.totalU) {
        container.setTotalU(rackModel.totalU, rackModel.name);
      }
    }
    container.syncDevices(rackModel.devices, catalog);
    ```

### 3.3 Dual-Sided Rack & Facia Flipping (`face: 'front' | 'rear'`)
- **`RackContainer`:**
  - Add `public activeFace: 'front' | 'rear' = 'front';`
  - Add `public setViewFace(face: 'front' | 'rear'): void`:
    1. Sets `this.activeFace = face`.
    2. Updates outer cabinet header title: `${name.toUpperCase()} (${this.totalU}U EIA-310-D) [${face.toUpperCase()}]`.
    3. Calls `devContainer.setViewFace(face)` on all children in `deviceMap`.
- **`DeviceContainer`:**
  - Add `public viewFace: 'front' | 'rear' = 'front';`
  - Add `public setViewFace(face: 'front' | 'rear'): void`.
  - In `buildDetailed()` and `buildStandard()`:
    - If `viewFace === 'front'`:
      - For devices with `instance.face === 'front'`: render front faceplate, brand/model badge, LEDs, and `catalogItem.ports`.
      - For devices with `instance.face === 'rear'`: render rear-mounted outline/indicator or hide if shallow.
    - If `viewFace === 'rear'`:
      - For devices with `instance.face === 'front'`:
        * Render rear chassis facia!
        * If `catalogItem.rearPorts && catalogItem.rearPorts.length > 0`: render rear ports using normalized coordinates (`xPct`, `yPct`).
        * If `rearPorts` is empty (e.g. 0 rear ports): render clean rear metal chassis with fan exhaust grilles / PSU bay outlines (satisfies B2.2.2).
      - For devices with `instance.face === 'rear'`:
        * Render primary rear faceplate with `catalogItem.ports` (e.g. rear PDU power sockets).
- **Normalized Port Coordinate Alignment:**
  In `DeviceContainer.buildDetailed()`:
  ```typescript
  const ports = this.viewFace === 'rear' && this.instance.face === 'front'
    ? (this.catalogItem.rearPorts || [])
    : (this.catalogItem.ports || []);

  ports.forEach((port, idx) => {
    let px: number;
    let py: number;

    if (port.xPct !== undefined && port.yPct !== undefined) {
      px = 24 + port.xPct * 480;
      py = port.yPct * this.heightPx;
    } else {
      // Standard fallback grid
      px = 160 + (idx % 24) * 12;
      py = 6 + Math.floor(idx / 24) * 14;
    }

    this.renderPort(g, port, px, py);
  });
  ```
- **`EngineBridge` & `PixiCanvas` Wireup:**
  In `PixiCanvas.setupBridge()`:
  ```typescript
  const unsubToggleFace = engineBridge.on('view:toggle-face', ({ rackId, face }) => {
    const rackContainer = this.sceneGraph?.rackContainers.get(rackId);
    if (rackContainer) {
      rackContainer.setViewFace(face);
      this.markDirty();
    }
  });
  this._unsubEvents.push(unsubToggleFace);
  ```

### 3.4 UI Controls in `Toolbar.tsx`
Enhance `Toolbar.tsx` with:
1. **Viewpoint Toggle (Front / Rear):**
   - Segmented buttons: `[ Front | Rear ]` with eye icon (`Eye`, `FlipHorizontal`).
   - Active viewpoint indicator badge (e.g. cyan for Front, amber/purple for Rear).
   - On change: emits `engineBridge.emit('view:toggle-face', { rackId: activeRack.id, face: newFace })`.
2. **Dynamic Rack Height Adjustment:**
   - Add support for custom 1U-60U sizing (preset select + number input or full range).
   - Trap command execution failure from `ResizeRackCommand`: if shrinkage is blocked due to occupied units, display an inline warning badge or tooltip (`Cannot shrink below U${maxOccupiedU}`).
3. **Camera Actions:**
   - Wire `Zoom In`: `engineBridge.emit('camera:zoom', { factor: 1.25, screenAnchorX: window.innerWidth / 2, screenAnchorY: window.innerHeight / 2 })`.
   - Wire `Zoom Out`: `engineBridge.emit('camera:zoom', { factor: 0.8, screenAnchorX: window.innerWidth / 2, screenAnchorY: window.innerHeight / 2 })`.
   - Wire `Fit View`: `engineBridge.emit('camera:fit-all', undefined)`.

---

## 4. Concrete File Modifications Needed for Worker M3

| File Path | Action | Scope of Change |
|---|---|---|
| `src/core/placement/dimensions.ts` | **CREATE** | Define `EIA_RACK_DIMENSIONS`, rail hole offsets (`[4.57, 16.0, 27.43]`), `uToLocalY`, `localYToU`, `getRackHeightPx`. |
| `src/core/placement/placementValidation.ts` | **CREATE** | Implement `validatePlacement()`, `canResizeRack()`, `checkAABBOverlap()`. |
| `src/core/placement/index.ts` | **CREATE** | Re-export all placement types, constants, and validation functions. |
| `src/core/history/commands/PlaceDeviceCommand.ts` | **MODIFY** | Refactor to use `validatePlacement()` from `src/core/placement/`. |
| `src/core/history/commands/MoveDeviceCommand.ts` | **MODIFY** | Refactor to use `validatePlacement()` from `src/core/placement/`. |
| `src/core/history/commands/ResizeRackCommand.ts` | **MODIFY** | Refactor to use `canResizeRack()` from `src/core/placement/`. |
| `src/engine/scene/RackContainer.ts` | **MODIFY** | Add `setTotalU()`, `setViewFace()`, update EIA hole spacing to standard offsets, dynamic U labels (1 to N). |
| `src/engine/scene/SceneGraph.ts` | **MODIFY** | Detect `rackModel.totalU` change in `syncRacks()` and call `container.setTotalU()`. |
| `src/engine/scene/DeviceContainer.ts` | **MODIFY** | Add `setViewFace()`, support dual-sided facia flipping, normalized `xPct`/`yPct` port alignment, render `rearPorts` in rear view. |
| `src/engine/canvas/PixiCanvas.ts` | **MODIFY** | Subscribe to `view:toggle-face` on `engineBridge` and forward to `RackContainer`. |
| `src/engine/interaction/DragManager.ts` | **MODIFY** | Use target rack's `activeFace` for dragging; use `validatePlacement` for collision checking. |
| `src/app/components/Toolbar.tsx` | **MODIFY** | Add Front/Rear viewpoint toggle buttons with indicator; wire Zoom In/Out and Fit View; add shrinkage error notification. |
| `tests/unit/placement.test.ts` | **CREATE** | Unit tests for 1U-60U sizing, EIA-310-D hole spacing, AABB collisions on front/rear, shrinkage guards, normalized port alignment. |

---

## 5. Potential Risks and Edge Cases

1. **Coordinate Desynchronization during Rack Resize:**
   - *Risk:* In EIA-310-D, U1 is at the bottom of the rack. When a rack is resized from 42U to 48U, `localY` for U1 changes from `32 + 41 * 32 = 1344px` to `32 + 47 * 32 = 1536px`. If mounted device positions are not recalculated, devices will appear to jump to wrong U slots.
   - *Mitigation:* Ensure `RackContainer.setTotalU()` loops through all `deviceMap` entries and recomputes `devContainer.position.set(53, localY)` immediately.
2. **Dual-Sided Cable Endpoint Alignment:**
   - *Risk:* In M5, cabling connects port-to-port across front and rear faces (`CableEndpoint.face`). If port coordinate calculation does not account for `xPct` and facia width (480px + 24px ear offset), cable vertices will detach when switching viewpoints.
   - *Mitigation:* The normalized coordinate contract (`x = 24 + xPct * 480`) must be strictly maintained across both `DeviceContainer` rendering and cable geometry calculation.
3. **Empty / Missing Rear Ports on Front-Mounted Devices:**
   - *Risk:* Devices like patch panels or blank fillers have 0 rear ports. In rear view, attempting to read `catalogItem.rearPorts[0]` would throw a TypeError.
   - *Mitigation:* Explicitly handle empty `rearPorts` arrays by falling back to clean rear blank/chassis visuals without errors (matches test `B2.2.2`).
4. **Shrinkage Guard Bypass via Undo/Redo:**
   - *Risk:* If a rack is resized down to 24U when empty, and an earlier undo re-places a device at U30, an invalid state could be created.
   - *Mitigation:* `ResizeRackCommand.canUndo()` and `PlaceDeviceCommand.canUndo()` should validate state pre-conditions or operate via invertible state snapshots.
5. **Zero-React Rendering Integrity:**
   - *Risk:* Firing React state updates on every viewpoint flip or rack hover could cause viewport FPS drops.
   - *Mitigation:* Viewpoint toggling in the canvas must flow through `EngineBridge` directly to `RackContainer.setViewFace()` without triggering React full-tree re-renders.

---

## 6. Verification Method

### 6.1 Automated Unit Tests
Run the Vitest unit test suite (including the new `tests/unit/placement.test.ts`):
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" ./node_modules/vitest/vitest.mjs run tests/unit/placement.test.ts
```
Expected result: All unit placement tests pass with 0 failures.

### 6.2 Full End-to-End Suite Regression
Run the full 326-test E2E suite via Playwright:
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
```
Expected result: 326 / 326 tests pass (100% pass rate) with 0 uncaught browser page errors.

### 6.3 Invalidation Conditions
The investigation findings or implementation will be considered invalidated if:
1. Resizing a rack from 42U to 48U breaks existing device slot alignment or connected cable endpoints.
2. A device mounted at U40 is clipped when resizing rack height down.
3. Front and rear devices placed at the same U number produce a collision error.
4. Toggling viewpoint from Front to Rear produces any PixiJS runtime exception or drops frame rates below 60 FPS.
