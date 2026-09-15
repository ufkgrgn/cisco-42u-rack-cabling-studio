# Milestone M3 Remediation Investigation Report (Explorer 1)

**Investigator**: Explorer 1 (`explorer_m3_r2_1`)  
**Target Subsystem**: `src/core/placement/collision.ts` & `validatePlacement`  
**Milestone**: M3 Iteration 2 (Dynamic Variable U-Height & Conflict-Free Placement Engine)  
**Parent Orchestrator**: `da7a4a3f-c9f5-49fe-aa8b-a0126ad7969a`  
**Workspace Root**: `d:\cisco\cisco-42u-rack-cabling-studio`  
**Date**: 2026-09-15T01:31:00+03:00  

---

## 1. Observation

### 1.1 Empirical Audit Failure & Defect Origin
In Milestone M3 Iteration 1, the Forensic Auditor (`auditor_m3_1`) issued an **INTEGRITY VIOLATION** verdict due to Check 4 (Build & Test Execution) failure. The test runner produced the following verbatim failure in `tests/unit/placement-adversarial.test.ts`:

```
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
```

### 1.2 Verbatim Code Inspection of `src/core/placement/collision.ts`
Inspection of `src/core/placement/collision.ts` lines 50–72 revealed:

```typescript
50: export function validatePlacement(
51:   rack: RackModel,
52:   device: {
53:     startU?: number;
54:     uHeight: number;
55:     face?: 'front' | 'rear';
56:     instanceId?: string;
57:     catalogId?: string;
58:   },
59:   targetU?: number,
60:   targetFace?: 'front' | 'rear'
61: ): PlacementValidationResult {
62:   const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
63:   const uHeight = device.uHeight || 1;
64:   const endU = startU + uHeight - 1;
65:   const face = targetFace !== undefined ? targetFace : (device.face ?? 'front');
66: 
67:   // 1. Boundary & Integer Validation
68:   if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1) {
69:     return {
70:       valid: false,
71:       reason: 'OUT_OF_BOUNDS',
72:       message: `Invalid unit specifications: startU=${startU}, uHeight=${uHeight}.`,
73:     };
74:   }
75: 
76:   if (startU < 1 || endU > rack.totalU) {
77:     return {
78:       valid: false,
79:       reason: 'OUT_OF_BOUNDS',
80:       message: `Placement out of bounds: U${startU}-U${endU} exceeds rack capacity (1-U${rack.totalU}).`,
81:     };
82:   }
```

### 1.3 State of Test Files (`tests/unit/placement-adversarial.test.ts`)
Inspection of `tests/unit/placement-adversarial.test.ts` lines 272–285 revealed:
```typescript
272:     it('documents empirical defect: uHeight: 0 and uHeight: NaN bypass validation due to line 52 (device.uHeight || 1)', () => {
273:       const rack = createRack('r', 42);
274:       // In src/core/placement/collision.ts:
275:       // Line 52: `const uHeight = device.uHeight || 1;`
276:       // Because `0` and `NaN` are falsy in JS, `0 || 1` evaluates to 1!
277:       // This bypasses line 57's check `|| uHeight < 1` and `!Number.isInteger(uHeight)`.
278:       const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
279:       // Demonstrating that uHeight: 0 is coerced to 1 and succeeds instead of being rejected
280:       expect(resZero.valid).toBe(true);
281: 
282:       const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
283:       // Demonstrating that uHeight: NaN is coerced to 1 and succeeds instead of being rejected
284:       expect(resNaN.valid).toBe(true);
285:     });
```
The test suite currently asserts `expect(resZero.valid).toBe(true)` to document the empirical defect. As a consequence, fixing `collision.ts:52` without updating this test block will cause Vitest to fail at line 280 because `resZero.valid` will become `false`.

### 1.4 Defense-in-Depth Inspection of `checkIntervalCollision`
Inspection of `src/core/placement/collision.ts` lines 104–114 revealed:
```typescript
104: export function checkIntervalCollision(
105:   devices: DeviceInstance[],
106:   candidate: { startU: number; uHeight: number; face: 'front' | 'rear'; instanceId?: string },
107:   totalU: number
108: ): { hasCollision: boolean; reason?: string; conflictingInstanceId?: string } {
109:   const candidateEnd = candidate.startU + candidate.uHeight - 1;
110: 
111:   if (candidate.startU < 1 || candidateEnd > totalU) {
112:     return { hasCollision: true, reason: 'OUT OF BOUNDS' };
113:   }
```
If `candidate.startU = 1` and `candidate.uHeight = 0`:
- `candidateEnd = 1 + 0 - 1 = 0`.
- `candidate.startU < 1` (`1 < 1`) evaluates to `false`.
- `candidateEnd > totalU` (`0 > totalU`) evaluates to `false`.
- If `devices` is empty or does not intersect $[1, 0]$, `checkIntervalCollision` returns `{ hasCollision: false }`, allowing non-physical candidate previews to be rendered as conflict-free.

### 1.5 Passing System Verifications
1. **Playwright E2E Suite (Tiers 1-4)**:
   - Command: `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs`
   - Result: **326 / 326 PASSED (100%)** in 11.16s (exit code 0).
2. **TypeScript Compilation Check**:
   - Command: `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit`
   - Result: **Exit code 0** (0 errors).
3. **Core Unit Suite**:
   - `tests/unit/placement.test.ts`: **32 / 32 PASSED** (exit code 0).
   - `tests/unit/challenger_m3_2_adversarial.test.ts`: **21 / 21 PASSED** (exit code 0).

---

## 2. Logic Chain

1. **Step 1: The Falsy Coercion Defect in `validatePlacement`**:
   - At `src/core/placement/collision.ts:52`, `const uHeight = device.uHeight || 1;` was used.
   - In ECMAScript specifications, logical OR (`||`) evaluates the left operand and returns the right operand whenever the left operand is falsy (`0`, `-0`, `NaN`, `null`, `undefined`, `""`, `false`).
   - When a caller calls `validatePlacement(rack, { uHeight: 0, face: 'front' }, 1)`, `0 || 1` evaluates to `1`.
   - On line 57, the validation guard `if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1)` evaluates `uHeight` as `1`.
   - `Number.isInteger(1)` is `true`, and `1 < 1` is `false`.
   - The validation guard is completely bypassed. The 0U non-physical device is validated as `{ valid: true }`, violating physical EIA-310-D constraints and failing the adversarial unit test specification.

2. **Step 2: Comparison of Resolution Strategies (`??` vs `!== undefined`)**:
   - If nullish coalescing is used (`const uHeight = device.uHeight ?? 1;`):
     - `0 ?? 1` evaluates to `0` (caught by `uHeight < 1`).
     - `NaN ?? 1` evaluates to `NaN` (caught by `!Number.isInteger`).
     - BUT `null ?? 1` evaluates to `1` because `null` is a nullish primitive. Passing `{ uHeight: null as any }` would be coerced to `1` and treated as a valid 1U device.
   - If explicit undefined checking is used (`const uHeight = device.uHeight !== undefined ? device.uHeight : 1;`):
     - `0` is preserved $\rightarrow$ caught by `uHeight < 1`.
     - `NaN` is preserved $\rightarrow$ caught by `!Number.isInteger(NaN)`.
     - `null` is preserved $\rightarrow$ caught by `!Number.isInteger(null)` (`Number.isInteger(null) === false`).
     - `1.5` is preserved $\rightarrow$ caught by `!Number.isInteger(1.5)`.
     - `-2` is preserved $\rightarrow$ caught by `uHeight < 1`.
     - `undefined` (omitted) defaults to `1`.
   - Therefore, `const uHeight = device.uHeight !== undefined ? device.uHeight : 1;` is strictly superior and prevents all edge-case leaks.

3. **Step 3: Verification of `targetU` and `device.startU`**:
   - Line 51 declares: `const startU = targetU !== undefined ? targetU : (device.startU ?? 1);`.
   - If `targetU` is provided:
     - `targetU = 0` $\rightarrow$ `startU = 0` $\rightarrow$ caught by line 65 `startU < 1`.
     - `targetU = -5` $\rightarrow$ `startU = -5` $\rightarrow$ caught by line 65 `startU < 1`.
     - `targetU = NaN` $\rightarrow$ `startU = NaN` $\rightarrow$ caught by line 57 `!Number.isInteger(NaN)`.
     - `targetU = 1.5` $\rightarrow$ `startU = 1.5` $\rightarrow$ caught by line 57 `!Number.isInteger(1.5)`.
     - `targetU = null` $\rightarrow$ `startU = null` $\rightarrow$ caught by line 57 `!Number.isInteger(null)`.
   - If `targetU` is `undefined`:
     - If `device.startU ?? 1` is replaced with `device.startU !== undefined ? device.startU : 1`, then `device.startU = null` is also strictly preserved and caught by `!Number.isInteger(null)`.
     - If `device.startU = 0`, it is preserved and caught by `startU < 1`.

4. **Step 4: Interval Overlap Mathematical Soundness**:
   - `intervalsOverlap(aStart, aEnd, bStart, bEnd)` computes `Math.max(aStart, bStart) <= Math.min(aEnd, bEnd)`.
   - For any two non-empty closed 1D intervals $A = [a_1, a_2]$ and $B = [b_1, b_2]$ with $a_1 \le a_2$ and $b_1 \le b_2$, the intersection is $[\max(a_1, b_1), \min(a_2, b_2)]$.
   - The intersection is non-empty if and only if $\max(a_1, b_1) \le \min(a_2, b_2)$.
   - Abutting intervals (e.g. $[10, 10]$ and $[11, 14]$) evaluate $\max(10, 11) = 11 \le \min(10, 14) = 10 \rightarrow 11 \le 10 \rightarrow \text{false}$ (no collision).
   - Overlapping intervals (e.g. $[10, 12]$ and $[11, 13]$) evaluate $\max(10, 11) = 11 \le \min(12, 13) = 12 \rightarrow 11 \le 12 \rightarrow \text{true}$ (collision detected).
   - If an inverted/empty interval is supplied ($a_1 > a_2$), $\max(a_1, b_1) \ge a_1 > a_2 \ge \min(a_2, b_2)$, so $\max > \min$ is guaranteed to be false.
   - The 5,000-iteration Monte Carlo property oracle test in `tests/unit/placement-adversarial.test.ts` proved 100% concordance between this formula and a discrete Set intersection oracle.

5. **Step 5: Defense-in-Depth in `checkIntervalCollision`**:
   - In `checkIntervalCollision(devices, candidate, totalU)`, candidate devices must be guarded before computing `candidateEnd`:
     ```typescript
     if (
       !Number.isInteger(candidate.startU) ||
       !Number.isInteger(candidate.uHeight) ||
       candidate.startU < 1 ||
       candidate.uHeight < 1
     ) {
       return { hasCollision: true, reason: 'OUT OF BOUNDS' };
     }
     ```
   - This prevents candidate previews with `uHeight: 0`, negative numbers, or non-integers from escaping collision detection.

6. **Step 6: Test Suite Alignment**:
   - Because `tests/unit/placement-adversarial.test.ts:280` expects `resZero.valid` to be `true` (documenting the defect), fixing `collision.ts` will invert this assertion.
   - `tests/unit/placement-adversarial.test.ts` must be updated to expect `valid: false` and `reason: 'OUT_OF_BOUNDS'` for `uHeight: 0` and `uHeight: NaN`.

---

## 3. Caveats

- **Scope of Modification**: The bug is confined to `src/core/placement/collision.ts` lines 51–54 and lines 109–114.
- **Production UI / Catalog Isolation**: UI catalog items and wizard-created devices specify strictly positive integer U-heights ($u \ge 1$), which is why the 326 E2E Playwright tests and 32 core placement tests continue to pass with 100% success.
- **Read-Only Explorer Protocol**: As an Explorer agent, I did not modify any source files. The exact proposed replacements and git patches are saved in `.agents/explorer_m3_r2_1/` for Worker M3 Remediation.

---

## 4. Conclusion & Remediation Plan for Worker M3

### Exact Recommended Code Changes

#### File 1: `src/core/placement/collision.ts`

**Edit A (Lines 51–54)**:
```typescript
<<<< BEFORE
  const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
  const uHeight = device.uHeight || 1;
  const endU = startU + uHeight - 1;
  const face = targetFace !== undefined ? targetFace : (device.face ?? 'front');
====
  const startU = targetU !== undefined ? targetU : (device.startU !== undefined ? device.startU : 1);
  const uHeight = device.uHeight !== undefined ? device.uHeight : 1;
  const endU = startU + uHeight - 1;
  const face = targetFace !== undefined ? targetFace : (device.face ?? 'front');
>>>> AFTER
```

**Edit B (Lines 109–114)**:
```typescript
<<<< BEFORE
  const candidateEnd = candidate.startU + candidate.uHeight - 1;

  if (candidate.startU < 1 || candidateEnd > totalU) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }
====
  if (
    !Number.isInteger(candidate.startU) ||
    !Number.isInteger(candidate.uHeight) ||
    candidate.startU < 1 ||
    candidate.uHeight < 1
  ) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }

  const candidateEnd = candidate.startU + candidate.uHeight - 1;

  if (candidateEnd > totalU) {
    return { hasCollision: true, reason: 'OUT OF BOUNDS' };
  }
>>>> AFTER
```

#### File 2: `tests/unit/placement-adversarial.test.ts`

**Edit C (Lines 256–285)**:
```typescript
<<<< BEFORE
    it('rejects non-integer, negative, and out-of-bounds startU and uHeight in validatePlacement', () => {
      const rack = createRack('r', 42);
      const invalidSpecs = [
        { startU: 1.5, uHeight: 1 },
        { startU: 1, uHeight: 1.5 },
        { startU: 1, uHeight: -2 },
        { startU: 0, uHeight: 1 },
        { startU: -5, uHeight: 1 },
        { startU: NaN, uHeight: 1 },
      ];

      for (const spec of invalidSpecs) {
        const res = validatePlacement(rack, { uHeight: spec.uHeight, face: 'front' }, spec.startU);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('documents empirical defect: uHeight: 0 and uHeight: NaN bypass validation due to line 52 (device.uHeight || 1)', () => {
      const rack = createRack('r', 42);
      // In src/core/placement/collision.ts:
      // Line 52: `const uHeight = device.uHeight || 1;`
      // Because `0` and `NaN` are falsy in JS, `0 || 1` evaluates to 1!
      // This bypasses line 57's check `|| uHeight < 1` and `!Number.isInteger(uHeight)`.
      const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
      // Demonstrating that uHeight: 0 is coerced to 1 and succeeds instead of being rejected
      expect(resZero.valid).toBe(true);

      const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
      // Demonstrating that uHeight: NaN is coerced to 1 and succeeds instead of being rejected
      expect(resNaN.valid).toBe(true);
    });
====
    it('rejects non-integer, zero, negative, and invalid uHeight in validatePlacement', () => {
      const rack = createRack('r', 42);
      const invalidSpecs = [
        { startU: 1.5, uHeight: 1 },
        { startU: 1, uHeight: 1.5 },
        { startU: 1, uHeight: -2 },
        { startU: 0, uHeight: 1 },
        { startU: -5, uHeight: 1 },
        { startU: NaN, uHeight: 1 },
        { startU: 1, uHeight: 0 },
        { startU: 1, uHeight: NaN },
      ];

      for (const spec of invalidSpecs) {
        const res = validatePlacement(rack, { uHeight: spec.uHeight, face: 'front' }, spec.startU);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('OUT_OF_BOUNDS');
      }
    });

    it('strictly rejects uHeight: 0 and uHeight: NaN without falsy coercion', () => {
      const rack = createRack('r', 42);
      const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
      expect(resZero.valid).toBe(false);
      expect(resZero.reason).toBe('OUT_OF_BOUNDS');

      const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
      expect(resNaN.valid).toBe(false);
      expect(resNaN.reason).toBe('OUT_OF_BOUNDS');
    });
>>>> AFTER
```

### Artifacts Prepared in Explorer 1 Folder
- Complete replacement implementation:  
  `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_r2_1\proposed_collision.ts`
- Unified Git diff patch for `collision.ts`:  
  `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_r2_1\collision.patch`
- Unified Git diff patch for `placement-adversarial.test.ts`:  
  `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_r2_1\placement-adversarial.patch`

---

## 5. Verification Method

To independently verify the proposed remediation:

1. **Verify Exact Behavior under Node.js**:
   Execute the following one-liner to confirm that all invalid inputs are rejected and valid inputs pass:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" -e "
   function validatePlacement(rack, device, targetU, targetFace) {
     const startU = targetU !== undefined ? targetU : (device.startU !== undefined ? device.startU : 1);
     const uHeight = device.uHeight !== undefined ? device.uHeight : 1;
     const endU = startU + uHeight - 1;
     if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || uHeight < 1) return { valid: false, reason: 'OUT_OF_BOUNDS' };
     if (startU < 1 || endU > rack.totalU) return { valid: false, reason: 'OUT_OF_BOUNDS' };
     return { valid: true };
   }
   const rack = { totalU: 42, devices: [] };
   console.assert(!validatePlacement(rack, { uHeight: 0 }, 1).valid, '0U must fail');
   console.assert(!validatePlacement(rack, { uHeight: NaN }, 1).valid, 'NaN-U must fail');
   console.assert(!validatePlacement(rack, { uHeight: -1 }, 1).valid, '-1U must fail');
   console.assert(!validatePlacement(rack, { uHeight: 1.5 }, 1).valid, '1.5U must fail');
   console.assert(!validatePlacement(rack, { uHeight: null }, 1).valid, 'null-U must fail');
   console.assert(validatePlacement(rack, { uHeight: 1 }, 1).valid, '1U must pass');
   console.assert(validatePlacement(rack, { uHeight: 2 }, 41).valid, '2U at 41 must pass');
   console.assert(!validatePlacement(rack, { uHeight: 2 }, 42).valid, '2U at 42 must fail');
   console.log('All placement assertions verified successfully.');
   "
   ```

2. **Run Vitest Unit Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run tests/unit/placement-adversarial.test.ts
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run
   ```
   - Expectation: 13 / 13 test files pass, 183+ tests pass (100% pass, exit code 0).

3. **Run TypeScript Static Analysis**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit
   ```
   - Expectation: 0 errors, exit code 0.

4. **Run Production Build**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vite/bin/vite.js build
   ```
   - Expectation: 0 errors, exit code 0.

5. **Run Playwright End-to-End Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
   ```
   - Expectation: 326 / 326 tests pass across all 4 tiers (100% pass, exit code 0).

6. **Invalidation Conditions**:
   - `validatePlacement(rack, { uHeight: 0 }, 1)` returning `{ valid: true }`.
   - `validatePlacement(rack, { uHeight: NaN }, 1)` returning `{ valid: true }`.
   - Abutting devices (e.g. $[10, 10]$ and $[11, 14]$) reporting collision.
   - Any failure across Vitest, TypeScript, Vite build, or Playwright E2E suites.
