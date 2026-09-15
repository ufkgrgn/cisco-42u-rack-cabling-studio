# Handoff Report: Explorer 2 (Milestone M3)
**Focus Areas:** F2.3 AABB Unit Interval Collision Detection & F2.4 Rack Height Shrinkage Guard  
**Date:** 2026-09-14T22:15:00Z  
**Author:** Explorer 2 (`explorer_m3_g3_2`)  
**Target Audience:** Orchestrator & Worker M3  

---

## 1. Observation

### Codebase Inspection & File Discoveries
1. **Absence of `src/core/placement/` Module**:
   - `PROJECT.md` line 54 specifies module boundary 4: `core/placement: EIA-310-D rack dimensional calculations (1U = 32px), front/rear viewpoints, 1-60U variable height logic, AABB unit interval collision detection, and occupied slot truncation guards.`
   - However, listing `src/core/` reveals only `catalog/`, `history/`, `persistence/`, `state/`, and `types/`. Directory `src/core/placement/` does not exist yet.
   - Searching for canonical interface methods `validatePlacement` and `canResizeRack` across the entire repository yielded 0 implementations.

2. **Duplicated Ad-Hoc Collision & Shrinkage Logic**:
   - **`src/core/history/commands/PlaceDeviceCommand.ts` (lines 54–76)**:
     ```typescript
     const endU = this._device.startU + this._device.uHeight - 1;
     if (this._device.startU < 1 || endU > rack.totalU) {
       return { success: false, error: `Placement out of bounds: U${this._device.startU}-U${endU} exceeds rack 1-U${rack.totalU}.` };
     }
     const collision = rack.devices.find((d: DeviceInstance) => {
       if (d.face !== this._device.face) return false;
       const dEndU = d.startU + d.uHeight - 1;
       return Math.max(this._device.startU, d.startU) <= Math.min(endU, dEndU);
     });
     ```
   - **`src/core/history/commands/MoveDeviceCommand.ts` (lines 59–74)**:
     ```typescript
     const endU = this._targetStartU + this._uHeight - 1;
     if (this._targetStartU < 1 || endU > targetRack.totalU) {
       return { success: false, error: `Target position U${this._targetStartU}-U${endU} out of bounds...` };
     }
     const collision = targetRack.devices.find((d: DeviceInstance) => {
       if (d.instanceId === this._instanceId) return false;
       if (d.face !== finalFace) return false;
       const dEndU = d.startU + d.uHeight - 1;
       return Math.max(this._targetStartU, d.startU) <= Math.min(endU, dEndU);
     });
     ```
   - **`src/core/history/commands/ResizeRackCommand.ts` (lines 28–40)**:
     ```typescript
     if (!Number.isInteger(this._newTotalU) || this._newTotalU < 1 || this._newTotalU > 60) {
       return { success: false, error: `Invalid rack height ${this._newTotalU}U. Must be an integer between 1 and 60.` };
     }
     const maxOccupiedU = rack.devices.reduce((max: number, d: DeviceInstance) => Math.max(max, d.startU + d.uHeight - 1), 0);
     if (this._newTotalU < maxOccupiedU) {
       return { success: false, error: `Cannot shrink rack to ${this._newTotalU}U: devices are mounted up to U${maxOccupiedU}. Move or remove them first.` };
     }
     ```
   - **`src/core/persistence/schemas.ts` (lines 118–137)**:
     ```typescript
     const faces = ['front', 'rear'] as const;
     for (const face of faces) {
       const faceDevices = rack.devices.filter(d => d.face === face);
       for (let i = 0; i < faceDevices.length; i++) {
         const a = faceDevices[i]!;
         const aTop = a.startU + a.uHeight - 1;
         for (let j = i + 1; j < faceDevices.length; j++) {
           const b = faceDevices[j]!;
           const bTop = b.startU + b.uHeight - 1;
           if (Math.max(a.startU, b.startU) <= Math.min(aTop, bTop)) return false;
         }
       }
     }
     ```
   - **`src/engine/interaction/DragManager.ts` (lines 205–228)**:
     ```typescript
     for (const dev of rack.deviceMap.values()) {
       if (dev.instance.instanceId === movingInstanceId) continue;
       if (dev.instance.face !== face) continue;
       const dStart = dev.instance.startU;
       const dEnd = dev.instance.startU + dev.instance.uHeight - 1;
       if (Math.max(startU, dStart) <= Math.min(candidateEndU, dEnd)) {
         return { hasCollision: true, reason: `COLLISION WITH ${dev.catalogItem.id} AT U${dStart}` };
       }
     }
     ```

3. **Drag & Visual Collision Feedback**:
   - `src/engine/interaction/DragGhost.ts` (lines 45–68):
     - Valid slot: renders cyan glow `.roundRect(...) .fill({ color: 0x0284c7, alpha: 0.45 }) .stroke({ color: 0x38bdf8, width: 2 })` with label `✓ SNAP U${snappedU} | ${catalogId}`.
     - Conflict: renders crimson red tint `.fill({ color: 0xef4444, alpha: 0.45 }) .stroke({ color: 0xf87171, width: 2 })` with label `✗ ${reason} | ${catalogId}`.
   - `src/engine/interaction/DragManager.ts` (lines 129–156):
     - In `handlePointerUp`, if `collision.hasCollision === true`, the drop is completely rejected: no command is dispatched to `EngineBridge`, and `this._ghost.hide()` clears the transient preview without mutating state.

4. **Dual-Sided Collision Verification**:
   - In `tests/unit/persistence.test.ts` (line 50):
     `face: 'rear' // Dual-sided rear mount shares same U without collision`
   - In `tests/unit/scene.test.ts` (lines 283–286):
     ```typescript
     // Rear face placement at U10 should not collide with front face device
     const rear10 = dragManager.checkCollision(rackContainer, 10, 1, undefined, 'rear');
     expect(rear10.hasCollision).toBe(false);
     ```
   - In `tests/e2e/tier3-cross-feature.test.cjs` (test `X3.6`, lines 233–260): front switch at U30 and rear PDU at U10 maintain independent face attributes and separate cabling endpoints.

5. **Test Suite Ground Truth**:
   - Unified CLI runner (`& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs`) executed all 326 tests across 4 tiers with 100% pass rate in 10.82s.
   - Unit test suite (`vitest run`) passed all 106 tests across 10 test files in 2.13s.

---

## 2. Logic Chain

1. **Premise 1 (Decoupling & Single Source of Truth)**:
   - Observation 1 and 2 prove that boundary checking, AABB interval collision, and shrinkage guard logic are scattered and copy-pasted across `PlaceDeviceCommand`, `MoveDeviceCommand`, `ResizeRackCommand`, `DragManager`, and `schemas.ts`.
   - Creating a central, dedicated module `src/core/placement/` containing pure, framework-agnostic mathematical functions (`validatePlacement`, `canResizeRack`, `intervalsOverlap`) fulfills `PROJECT.md` § 1.4 & § 4, eliminates logic duplication, and ensures identical validation guarantees across commands, schemas, and drag interactions.

2. **Premise 2 (Strict AABB 1D Closed Unit Interval Collision)**:
   - In EIA-310-D rack cabinets, unit slots are discrete 1-indexed integers $U \in [1, \text{totalU}]$.
   - Any device with bottom-most unit `startU` and height `uHeight` occupies the discrete closed interval:
     $$I_{\text{dev}} = [\text{startU},\, \text{startU} + \text{uHeight} - 1]$$
   - Two intervals $I_A = [a_{\text{start}}, a_{\text{end}}]$ and $I_B = [b_{\text{start}}, b_{\text{end}}]$ physically intersect if and only if:
     $$\max(a_{\text{start}}, b_{\text{start}}) \le \min(a_{\text{end}}, b_{\text{end}})$$
   - When $\max(a_{\text{start}}, b_{\text{start}}) > \min(a_{\text{end}}, b_{\text{end}})$, the devices are either disjoint or strictly **abutting** (e.g. $I_A = [10, 10]$ and $I_B = [11, 11]$ yields $\max(10, 11) = 11 > \min(10, 11) = 10$). Abutting devices must NOT collide; this matches Tier 1 test `F2.3.5`.

3. **Premise 3 (Dual-Sided Collision Rules)**:
   - Based on Observation 4, the 2D rack elevation studio separates front and rear mounting planes (`face: 'front' | 'rear'`).
   - Devices on the front face only occupy front rack rails; devices on the rear face only occupy rear rack rails.
   - A front switch at $[40, 40]$ and a rear PDU at $[40, 40]$ do not physically occupy the same rail holes and thus do not collide.
   - Therefore, interval collision testing is strictly scoped per face:
     $$\text{Collision}(A, B) \iff A.\text{face} == B.\text{face} \land \text{Overlap}(I_A, I_B) \land A.\text{instanceId} \neq B.\text{instanceId}$$
   - Depth sharing: While devices have `depthMm` in their catalog metadata, depth collision across faces is not enforced in the 2D EIA-310-D specification. However, our placement engine can provide an optional `checkDepthExhaustion` utility for advanced telemetry without breaking existing 2D placement tests.

4. **Premise 4 (Rack Height Shrinkage Guard Invariant)**:
   - Based on Observation 2 (`ResizeRackCommand.ts`), `tests/e2e/tier1-feature-coverage.test.cjs` (tests `F2.4.1`–`F2.4.5`), and Tier 2 boundary tests (`B2.4.1`–`B2.4.4`):
   - A rack cannot be resized such that any mounted device is clipped or left out of bounds.
   - Because physical cabinet enclosure height affects both front and rear mounting rails, `maxOccupiedU` must consider devices on **both** faces:
     $$\text{maxOccupiedU} = \max\left(\{0\} \cup \{d.\text{startU} + d.\text{uHeight} - 1 \mid d \in \text{rack.devices}\}\right)$$
   - Rules for `canResizeRack(rack, newTotalU)`:
     1. $\text{newTotalU} \notin \mathbb{Z} \lor \text{newTotalU} < 1 \lor \text{newTotalU} > 60 \implies \text{allowed: false}$ (Reason: invalid boundary).
     2. $\text{newTotalU} < \text{maxOccupiedU} \implies \text{allowed: false}$ (Reason: `SHRINKAGE_OCCUPIED`).
     3. $\text{newTotalU} \ge \text{maxOccupiedU} \land 1 \le \text{newTotalU} \le 60 \implies \text{allowed: true}$.
     - When an empty rack has $\text{maxOccupiedU} = 0$, shrinking to 1U is permitted (`B2.4.3`).
     - When the top device is at U20, shrinking to exact U20 is permitted (`B2.4.1`), while shrinking to U19 is blocked (`B2.4.2`).

5. **Premise 5 (Self-Collision Exemption on Move)**:
   - When moving device `dev-1` from $[10, 11]$ to $[11, 12]$ in the same rack, interval $[11, 12]$ intersects its own prior position $[10, 11]$ at U11.
   - Without an explicit self-exemption check (`d.instanceId !== movingDevice.instanceId`), intra-rack shifts would trigger a false-positive collision with the device itself.
   - `validatePlacement` must accept an optional `movingInstanceId` (or read `device.instanceId`) and filter it out of conflict checks.

---

## 3. Caveats

1. **Legacy DOM Prototype vs Modern React+PixiJS**:
   - The E2E tests in `tests/e2e/` run against the browser harness interacting with `window.RackStudio` and legacy DOM.
   - All modern state and history logic lives in `src/core/`. Worker M3 must ensure that all modern unit tests (`tests/unit/placement.test.ts`, `command.test.ts`, etc.) pass cleanly, while maintaining complete contract parity with `PROJECT.md` § 4.
2. **Rack Depth Collision**:
   - Standard EIA-310-D specification models front and rear rails as independent 2D planes. Real-world full-depth servers (>700mm) and rear PDUs would physically conflict in shallow cabinets (<800mm). This is not currently part of the automated E2E test assertions (which explicitly allow front and rear at the same U), so Worker M3 should keep face-isolation as default, with depth collision strictly as an optional parameter.
3. **Ghost Snapping Clamping in DragManager**:
   - In `DragManager.ts` line 89, `clampedStartU` clamps the candidate position to $[1, \text{totalU} - \text{uHeight} + 1]$. When dragging near the top/bottom boundary, this prevents false `OUT_OF_BOUNDS` errors and snaps cleanly to the highest or lowest valid unit. However, if a user drags outside the horizontal bounds of the rack, `findTargetRack` returns null and DragGhost indicates `OUTSIDE RACK BOUNDS`.

---

## 4. Conclusion & Recommended Architecture

Worker M3 should create `src/core/placement/` and refactor existing commands and interaction handlers according to the following concrete design:

### A. Module Structure to Create
```
src/core/placement/
├── types.ts          # Placement & sizing types conforming to PROJECT.md § 4
├── collision.ts      # AABB interval intersection & validatePlacement
├── rackMath.ts       # EIA-310-D dimension formulas & canResizeRack
└── index.ts          # Barrel re-export
```

### B. Core Placement Algorithms & Functions

#### 1. `src/core/placement/types.ts`
```typescript
import { RackModel, DeviceInstance } from '../types';

export interface PlacementValidationResult {
  valid: boolean;
  conflictingInstanceId?: string;
  reason?: 'COLLISION' | 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED';
  message?: string;
}

export interface CanResizeRackResult {
  allowed: boolean;
  maxOccupiedU: number;
  reason?: string;
}
```

#### 2. `src/core/placement/collision.ts`
```typescript
import { RackModel, DeviceInstance } from '../types';
import { PlacementValidationResult } from './types';

/**
 * Checks if two 1D discrete closed intervals [startA, endA] and [startB, endB] intersect.
 * Abutting intervals (e.g. [10, 10] and [11, 11]) do NOT intersect.
 */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
}

/**
 * Validates candidate device placement in a rack cabin according to EIA-310-D physical bounds
 * and AABB unit interval collision detection.
 *
 * @param rack Target rack model containing totalU and existing devices
 * @param device Candidate device instance (contains uHeight, face, instanceId)
 * @param targetU Target starting unit (1-indexed bottom unit). Defaults to device.startU.
 */
export function validatePlacement(
  rack: RackModel,
  device: Pick<DeviceInstance, 'uHeight' | 'face'> & { instanceId?: string; startU?: number; catalogId?: string },
  targetU?: number
): PlacementValidationResult {
  const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
  const uHeight = device.uHeight || 1;
  const endU = startU + uHeight - 1;
  const face = device.face || 'front';

  // 1. Boundary Check
  if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS',
      message: `Invalid unit specifications: startU=${startU}, uHeight=${uHeight}.`
    };
  }

  if (startU < 1 || endU > rack.totalU) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS',
      message: `Placement out of bounds: U${startU}-U${endU} exceeds rack capacity (1-U${rack.totalU}).`
    };
  }

  // 2. AABB Unit Interval Collision (Per-Face Isolation)
  for (const existing of rack.devices) {
    // Self-exemption for moving an existing device within the same rack
    if (device.instanceId && existing.instanceId === device.instanceId) {
      continue;
    }

    // Dual-sided isolation: front devices collide only with front; rear only with rear
    if (existing.face !== face) {
      continue;
    }

    const existStart = existing.startU;
    const existEnd = existing.startU + existing.uHeight - 1;

    if (intervalsOverlap(startU, endU, existStart, existEnd)) {
      return {
        valid: false,
        conflictingInstanceId: existing.instanceId,
        reason: 'COLLISION',
        message: `Collision at U${startU}-U${endU} with existing device '${existing.instanceId}' (${existing.catalogId} at U${existStart}-U${existEnd}).`
      };
    }
  }

  return { valid: true };
}

/**
 * Fast interval collision checker for interaction loops (e.g. DragManager pointer move)
 */
export function checkIntervalCollision(
  devices: DeviceInstance[],
  candidate: { startU: number; uHeight: number; face: 'front' | 'rear'; instanceId?: string },
  totalU: number
): { hasCollision: boolean; reason?: string; conflictingInstanceId?: string } {
  const candidateEnd = candidate.startU + candidate.uHeight - 1;

  if (candidate.startU < 1 || candidateEnd > totalU) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }

  for (const d of devices) {
    if (candidate.instanceId && d.instanceId === candidate.instanceId) continue;
    if (d.face !== candidate.face) continue;

    const dStart = d.startU;
    const dEnd = d.startU + d.uHeight - 1;

    if (intervalsOverlap(candidate.startU, candidateEnd, dStart, dEnd)) {
      return {
        hasCollision: true,
        conflictingInstanceId: d.instanceId,
        reason: `COLLISION WITH ${d.catalogId} AT U${dStart}`
      };
    }
  }

  return { hasCollision: false };
}
```

#### 3. `src/core/placement/rackMath.ts`
```typescript
import { RackModel } from '../types';
import { CanResizeRackResult } from './types';

export const EIA_DIMENSIONS = {
  UNIT_HEIGHT_PX: 32,
  HEADER_HEIGHT_PX: 32,
  PLINTH_HEIGHT_PX: 32,
  LEFT_CHANNEL_WIDTH_PX: 53,
  RIGHT_CHANNEL_WIDTH_PX: 53,
  RAIL_WIDTH_PX: 24,
  INTERNAL_MOUNT_WIDTH_PX: 480,
  TOTAL_RACK_WIDTH_PX: 634, // 53 + 24 + 480 + 24 + 53
  MIN_TOTAL_U: 1,
  MAX_TOTAL_U: 60,
} as const;

/**
 * Computes the maximum occupied unit across all mounted devices in a rack (both front & rear).
 * Returns 0 if rack has no devices.
 */
export function getMaxOccupiedUnit(rack: RackModel): number {
  if (!rack.devices || rack.devices.length === 0) return 0;
  return rack.devices.reduce((max, d) => Math.max(max, d.startU + d.uHeight - 1), 0);
}

/**
 * Enforces the Rack Height Shrinkage Guard (F2.4 / AC4).
 * Prohibits shrinking rack height below the highest occupied unit on either face.
 */
export function canResizeRack(rack: RackModel, newTotalU: number): CanResizeRackResult {
  const maxOccupiedU = getMaxOccupiedUnit(rack);

  // 1. Boundary & Integer Validation
  if (!Number.isInteger(newTotalU) || newTotalU < EIA_DIMENSIONS.MIN_TOTAL_U || newTotalU > EIA_DIMENSIONS.MAX_TOTAL_U) {
    return {
      allowed: false,
      maxOccupiedU,
      reason: `Invalid rack height ${newTotalU}U. Must be an integer between ${EIA_DIMENSIONS.MIN_TOTAL_U} and ${EIA_DIMENSIONS.MAX_TOTAL_U}.`
    };
  }

  // 2. Shrinkage Prohibition Guard
  if (newTotalU < maxOccupiedU) {
    return {
      allowed: false,
      maxOccupiedU,
      reason: `Cannot shrink rack to ${newTotalU}U: devices are mounted up to U${maxOccupiedU}. Move or remove them first.`
    };
  }

  return {
    allowed: true,
    maxOccupiedU
  };
}

/**
 * Converts unit position to PixiJS local Y coordinate within RackContainer
 */
export function unitToLocalY(startU: number, uHeight: number, totalU: number): number {
  const topUnit = startU + uHeight - 1;
  return EIA_DIMENSIONS.HEADER_HEIGHT_PX + (totalU - topUnit) * EIA_DIMENSIONS.UNIT_HEIGHT_PX;
}

/**
 * Total pixel height of cabinet including top header and bottom plinth
 */
export function calculateRackHeightPx(totalU: number): number {
  return totalU * EIA_DIMENSIONS.UNIT_HEIGHT_PX + EIA_DIMENSIONS.HEADER_HEIGHT_PX + EIA_DIMENSIONS.PLINTH_HEIGHT_PX;
}
```

---

### C. Concrete File Modifications for Worker M3

| File | Modification Required | Rationale |
|---|---|---|
| `src/core/placement/types.ts` | **Create** interface definitions | Interface contract matching `PROJECT.md` § 4 |
| `src/core/placement/collision.ts` | **Create** interval math & `validatePlacement` | Single source of truth for collision detection |
| `src/core/placement/rackMath.ts` | **Create** EIA constants & `canResizeRack` | Single source of truth for shrinkage guard & coordinates |
| `src/core/placement/index.ts` | **Create** barrel re-export | Clean module exports |
| `src/core/history/commands/PlaceDeviceCommand.ts` | **Edit** `execute()`: replace ad-hoc checks with `validatePlacement(rack, this._device, this._device.startU)` | Guarantees placement rules compliance via central placement engine |
| `src/core/history/commands/MoveDeviceCommand.ts` | **Edit** `execute()`: replace ad-hoc checks with `validatePlacement(targetRack, { ...device, face: finalFace }, this._targetStartU)` | Reuses central validation; provides self-collision exemption |
| `src/core/history/commands/ResizeRackCommand.ts` | **Edit** `execute()`: replace ad-hoc checks with `canResizeRack(rack, this._newTotalU)` | Guarantees shrinkage guard compliance via central placement engine |
| `src/engine/interaction/DragManager.ts` | **Edit** `checkCollision`: delegate to `checkIntervalCollision` or `validatePlacement` | Ensures drag collision matches command execution rules 100% |
| `src/app/components/Toolbar.tsx` | **Edit** dropdown handling to inspect `canResizeRack` | Disables or warns against shrinkage options `< maxOccupiedU` |
| `tests/unit/placement.test.ts` | **Create** unit test suite for F2.3 & F2.4 | Complete regression suite for all boundary and corner cases |

---

## 5. Edge Case Matrix & Verification Plan

### Edge Case Matrix

| ID | Category | Scenario | Expected Outcome | Verification Rule |
|---|---|---|---|---|
| **E1** | Boundary | 1U device placed at `startU = 1` in 42U rack | **Success** (`valid: true`) | Spans $[1, 1]$, within bounds $[1, 42]$ |
| **E2** | Boundary | Device placed at `startU = 0` or negative | **Rejected** (`OUT_OF_BOUNDS`) | `startU < 1` |
| **E3** | Boundary | 1U device placed at `startU = 42` in 42U rack | **Success** (`valid: true`) | Spans $[42, 42]$, top unit $= 42$ |
| **E4** | Boundary | 1U device placed at `startU = 43` in 42U rack | **Rejected** (`OUT_OF_BOUNDS`) | `endU = 43 > 42` |
| **E5** | Boundary | 2U device placed at `startU = 42` in 42U rack | **Rejected** (`OUT_OF_BOUNDS`) | Spans $[42, 43]$, `endU = 43 > 42` |
| **E6** | Boundary | 2U device placed at `startU = 41` in 42U rack | **Success** (`valid: true`) | Spans $[41, 42]$, top unit $= 42$ |
| **E7** | Multi-U | 7U device (chassis) at `startU = 10` | **Success** (`valid: true`) | Spans $[10, 16]$, requires 7 contiguous units |
| **E8** | Collision | Device placed at exact same slot as existing device | **Rejected** (`COLLISION`) | Interval overlap on same face |
| **E9** | Collision | 1U candidate at U10 against existing 2U at $[9, 10]$ | **Rejected** (`COLLISION`) | Partial overlap at U10 |
| **E10** | Collision | Candidate at U11 against existing 2U at $[9, 10]$ | **Success** (`valid: true`) | Strictly abutting $[11, 11]$ vs $[9, 10]$, no overlap |
| **E11** | Collision | Candidate at U8 against existing 2U at $[9, 10]$ | **Success** (`valid: true`) | Strictly abutting $[8, 8]$ vs $[9, 10]$, no overlap |
| **E12** | Dual-Sided | Front switch at U20 and rear PDU at U20 | **Success** (`valid: true`) | Different faces (`front` vs `rear`) share U without collision |
| **E13** | Dual-Sided | Rear candidate at U20 against existing rear PDU at U20 | **Rejected** (`COLLISION`) | Same face (`rear` vs `rear`) collision |
| **E14** | Self-Exempt | Moving 2U device from $[10, 11]$ to $[11, 12]$ in same rack | **Success** (`valid: true`) | Self-instance ignored; target U12 is free |
| **E15** | Shrinkage | Empty rack resized down to 1U | **Success** (`allowed: true`) | `maxOccupiedU = 0 <= 1` |
| **E16** | Shrinkage | Devices at U5 and U20; shrink to 20U | **Success** (`allowed: true`) | `newTotalU = 20 >= maxOccupiedU = 20` |
| **E17** | Shrinkage | Devices at U5 and U20; shrink to 19U | **Rejected** (`SHRINKAGE_OCCUPIED`) | `newTotalU = 19 < maxOccupiedU = 20` |
| **E18** | Shrinkage | 4U device at `startU = 38` (spans $[38, 41]$); shrink to 40U | **Rejected** (`SHRINKAGE_OCCUPIED`) | `maxOccupiedU = 41 > 40` |
| **E19** | Shrinkage | Front at U10, rear PDU at U35; shrink to 30U | **Rejected** (`SHRINKAGE_OCCUPIED`) | Rear device sets `maxOccupiedU = 35 > 30` |
| **E20** | Shrinkage | Rack resized to 0U, -5U, or 61U | **Rejected** (`OUT_OF_BOUNDS`) | Exceeds EIA-310-D limits $[1, 60]$ |
| **E21** | Shrinkage | Rack resized to non-integer (e.g. 42.5U) | **Rejected** (`INVALID`) | Discrete U-heights only |

---

## 6. Verification Method

To independently verify Worker M3's implementation:

1. **Unit Test Verification**:
   Execute the dedicated unit tests via vitest:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run tests/unit/placement.test.ts tests/unit/command.test.ts
   ```
   - Must pass all tests with 0 failures.

2. **Full Unit Suite Regression**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run
   ```
   - Must maintain 100% pass rate across all 10 test suites (106+ tests).

3. **E2E Test Suite Regression (Tiers 1–4)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
   ```
   - Verifies all 326 E2E tests pass cleanly with exit code 0 in < 15 seconds.

4. **TypeScript Typecheck**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit
   ```
   - Must exit with code 0 and zero type errors.
