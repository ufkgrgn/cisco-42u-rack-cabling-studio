# Forensic Audit Report: Milestone M3 (Dynamic Variable U-Height & Conflict-Free Placement Engine)

**Work Product**: Milestone M3 Deliverables (`src/core/placement/*`, `MoveDeviceCommand.ts`, `PlaceDeviceCommand.ts`, `ResizeRackCommand.ts`, `RackContainer.ts`, `DeviceContainer.ts`, `SceneGraph.ts`, `Toolbar.tsx`, tests)  
**Auditor**: Forensic Auditor M3 (`auditor_m3_1`)  
**Profile**: General Project  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)  
**Date**: 2026-09-15T01:25:00+03:00  
**Parent Orchestrator**: `da7a4a3f-c9f5-49fe-aa8b-a0126ad7969a`  
**Workspace Root**: `d:\cisco\cisco-42u-rack-cabling-studio`  
**Verdict**: **INTEGRITY VIOLATION**

---

## Executive Verdict Summary

While Milestone M3 demonstrates authentic domain engineering across EIA-310-D physical dimensioning, dual-sided viewpoint switching, dynamic PixiJS rack resizing, and invertible cable endpoint tracking, the work product **FAILS Phase 2 Behavioral Verification (Check 4: Build and Test Execution)** under empirical audit.

Running the mandatory project test command:
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run
```
resulted in a **test failure with exit code 1** in `tests/unit/placement-adversarial.test.ts`.

Investigation traced the root cause directly to `src/core/placement/collision.ts:52`:
```typescript
const uHeight = device.uHeight || 1;
```
Because `0` and `NaN` are falsy in JavaScript, `device.uHeight || 1` silently coerces invalid zero and non-number unit heights into `1` **prior** to running boundary checks. As a result, candidate devices with `uHeight: 0` or `uHeight: NaN` are erroneously validated as valid 1U devices (`{ valid: true }`), directly violating the domain specification and failing adversarial unit test assertions.

In accordance with the Forensic Auditor protocol (**"Block on failure: If ANY check fails, the verdict is INTEGRITY VIOLATION and the work product must be rejected"**), Milestone M3 is **REJECTED**.

---

## Forensic Check Phase Results

| Check # | Forensic Inspection Item | Result | Detailed Evidence & Notes |
|:---:|---|:---:|---|
| **1** | Hardcoded Test Results Detection | **PASS** | Source code in `src/core/placement/` and commands compute all results dynamically. No hardcoded expected test strings or dummy branches found. |
| **2** | Facade Implementation Detection | **PASS** | All functions execute genuine business logic (AABB interval checks, coordinate mappings, dynamic container resizing, cable endpoint transformations). No empty or constant returns. |
| **3** | Pre-Populated Artifacts Detection | **PASS** | No pre-populated `.log` or test result files predating execution. |
| **4** | Build & Test Execution (Check 4) | **FAIL** | `vitest run` exited with **code 1**. 1 test failed in `tests/unit/placement-adversarial.test.ts:274`. `tsc --noEmit` exited with **code 1** due to type errors in adversarial test files. |
| **5** | Mathematical Interval Formulas | **PASS** | `intervalsOverlap` (`Math.max(a, b) <= Math.min(endA, endB)`) is mathematically sound and strictly handles discrete abutting vs overlapping intervals. |
| **6** | EIA-310-D Dimensional Math | **PASS** | EIA-310-D constants (1U = 32px, hole offsets `[4.57, 16.0, 27.43]`, cabinet 634px) and bottom-up coordinate mappings (`uToLocalY`, `localYToU`) are verified exact and fully reversible. |
| **7** | Cable Endpoint Updates in `MoveDeviceCommand` | **PASS** | Forward delta and `undo()` correctly update `rackId` and `face` for all attached cables across intra-rack moves, inter-rack moves, and face flips. |
| **8** | PixiJS Dynamic Rendering & Viewpoint | **PASS** | `RackContainer.setTotalU` dynamically rebuilds rails, frame, U-slots, badge, and realigns mounted devices; `DeviceContainer` renders rear metallic facia with PSU bays and exhaust grilles on rear face. |

---

## 1. Observation

### 1.1 Test Suite Failure Tool Output
Executing the test suite via Node.js v24.13.0 produced the following verbatim failure:

```
$ node node_modules/vitest/vitest.mjs run

 FAIL  tests/unit/placement-adversarial.test.ts > Adversarial Stress Harness: Milestone M3 Variable U-Height & Placement Engine > 5. Malformed, Non-Integer, and Out-of-Bounds Inputs > rejects non-integer, zero, negative, and invalid uHeight in validatePlacement
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/unit/placement-adversarial.test.ts:274:27
    272|       for (const spec of invalidSpecs) {
    273|         const res = validatePlacement(rack, { uHeight: spec.uHeight, face: 'front' }, spec.startU);
    274|         expect(res.valid).toBe(false);
       |                           ^
    275|         expect(res.reason).toBe('OUT_OF_BOUNDS');
    276|       }

 Test Files  1 failed | 11 passed (12)
      Tests  1 failed | 160 passed (161)
   Duration  2.32s
```

### 1.2 Code Inspection of the Defect
In `src/core/placement/collision.ts`, lines 51-64:
```typescript
51:   const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
52:   const uHeight = device.uHeight || 1;
53:   const endU = startU + uHeight - 1;
54:   const face = targetFace !== undefined ? targetFace : (device.face ?? 'front');
55: 
56:   // 1. Boundary & Integer Validation
57:   if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1) {
58:     return {
59:       valid: false,
60:       reason: 'OUT_OF_BOUNDS',
61:       message: `Invalid unit specifications: startU=${startU}, uHeight=${uHeight}.`,
62:     };
63:   }
```

When `device.uHeight` is `0`:
- `device.uHeight || 1` evaluates to `0 || 1` $\rightarrow$ `1`.
- `Number.isInteger(1)` is `true`.
- `uHeight < 1` (`1 < 1`) is `false`.
- The subsequent boundary check evaluates `startU = 1`, `endU = 1`, which is within `1 <= 42`.
- `validatePlacement` returns `{ valid: true }`.

When `device.uHeight` is `NaN`:
- `NaN || 1` evaluates to `1`.
- It returns `{ valid: true }`.

### 1.3 TypeScript Compiler (`tsc --noEmit`) Failure
Running `node_modules/typescript/bin/tsc --noEmit` produced:
```
tests/unit/challenger_m3_2_adversarial.test.ts(2,37): error TS6133: 'CableRun' is declared but its value is never read.
tests/unit/challenger_m3_2_adversarial.test.ts(44,9): error TS2741: Property 'lengthMeters' is missing in type '{ ... }' but required in type 'CableRun'.
tests/unit/challenger_m3_2_adversarial.test.ts(596,22): error TS2349: This expression is not callable. Type 'Boolean' has no call signatures.
tests/unit/placement-adversarial.test.ts(355,11): error TS2741: Property 'lengthMeters' is missing in type '{ ... }' but required in type 'CableRun'.
```
Production code in `src/` is type-safe, but the newly committed adversarial unit tests fail strict `tsc --noEmit`.

### 1.4 Passing Verifications
1. **Playwright End-to-End Suite (`tests/e2e/runner.cjs`)**:
   - 326 / 326 tests PASSED in 11.15s (100% pass, exit code 0).
   - All 4 tiers (Tier 1: 145, Tier 2: 145, Tier 3: 24, Tier 4: 12) passed cleanly.
2. **Vite Production Build**:
   - Built cleanly in 2.83s, exit code 0.
3. **Core Unit Test File (`tests/unit/placement.test.ts`)**:
   - 32 / 32 tests PASSED in 7ms.

---

## 2. Logic Chain

1. **Step 1: Protocol Mandate**:
   - Under the Forensic Auditor Charter, Check 4 explicitly requires that the project builds and its test suite executes cleanly without failures:
     *"The build must succeed and tests must execute — a project that doesn't build or whose tests don't run is automatically flagged."*
     *"Block on failure: If ANY check fails, the verdict is INTEGRITY VIOLATION and the work product must be rejected."*
2. **Step 2: Verification of Claims**:
   - Worker M3 claimed 100% test pass rate across 11 test files (138/138 tests) prior to Challenger review.
   - However, when the full test suite was executed during this audit, 1 test in `tests/unit/placement-adversarial.test.ts` failed due to an unhandled edge case in `validatePlacement`.
3. **Step 3: Root Cause Analysis**:
   - In `src/core/placement/collision.ts:52`, using `device.uHeight || 1` instead of nullish coalescing (`device.uHeight ?? 1`) causes `uHeight: 0` and `uHeight: NaN` to be converted to `1`.
   - This bypasses the guard at line 57 (`if (!Number.isInteger(uHeight) || uHeight < 1)`), allowing non-physical 0U and NaN-U devices to be placed successfully.
4. **Step 4: Non-Intervention Principle**:
   - As a Forensic Auditor, I am strictly prohibited from modifying implementation code (`"Audit-only — do NOT modify implementation code"`).
   - Therefore, this failure must be reported directly as a finding, and the deliverable cannot be certified as CLEAN until remediated by a worker agent.

---

## 3. Caveats

- The defect is an algorithmic input validation flaw (`||` vs `??`) rather than deliberate malicious tampering or facade construction.
- All core EIA-310-D physical formulas, PixiJS GPU rendering pipelines, and undo/redo cable retention mechanics are genuinely implemented and robust.
- The 326-test E2E Playwright test harness continues to pass 100% because valid catalog items specify integer heights ($u \ge 1$).

---

## 4. Conclusion

Milestone M3 cannot be certified due to the empirical failure of `vitest run` on boundary input validation in `validatePlacement`.

**Required Remediation Actions for Worker**:
1. In `src/core/placement/collision.ts` line 52, replace:
   ```typescript
   // Flawed:
   const uHeight = device.uHeight || 1;
   
   // Required Fix:
   const uHeight = device.uHeight !== undefined ? device.uHeight : 1;
   // or: const uHeight = device.uHeight ?? 1;
   ```
   Ensure that if `device.uHeight` is explicitly provided as `0`, `NaN`, or negative, it retains its value so line 57 can catch it and return `{ valid: false, reason: 'OUT_OF_BOUNDS' }`.
2. Fix TypeScript type errors in `tests/unit/placement-adversarial.test.ts` and `tests/unit/challenger_m3_2_adversarial.test.ts` (supply `lengthMeters: 1.0` in mock `CableRun`s, remove unused imports, and fix `Boolean` call syntax).
3. Re-run `tsc --noEmit` and `vitest run` to ensure 100% pass rate across all 13 test files (177+ tests).

---

## 5. Verification Method

To independently reproduce this finding:

1. **Run Vitest Test Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run tests/unit/placement-adversarial.test.ts
   ```
   Observe failure at line 274: `rejects non-integer, zero, negative, and invalid uHeight in validatePlacement`.

2. **Inspect Code**:
   Inspect `src/core/placement/collision.ts` line 52 to observe `const uHeight = device.uHeight || 1;`.

3. **Run TypeScript Check**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit
   ```
   Observe exit code 1 with type errors in the adversarial test files.
