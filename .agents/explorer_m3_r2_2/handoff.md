# Type Safety & Test Harness Investigation: Milestone M3 Iteration 2

**Agent**: Explorer 2 (`explorer_m3_r2_2`)  
**Role**: Investigation & Synthesis (Read-Only)  
**Milestone**: M3 — Dynamic Variable U-Height & Conflict-Free Placement Engine (Iteration 2)  
**Date**: 2026-09-14T22:30:00Z  
**Workspace Root**: `d:\cisco\cisco-42u-rack-cabling-studio`  
**Parent Orchestrator**: `da7a4a3f-c9f5-49fe-aa8b-a0126ad7969a`  

---

## Executive Summary

Milestone M3 Iteration 1 was rejected by Forensic Auditor M3 due to:
1. `vitest run` failing on `tests/unit/placement-adversarial.test.ts:274` because `src/core/placement/collision.ts:52` used `device.uHeight || 1`, coercing `uHeight: 0` and `uHeight: NaN` to `1` and allowing invalid devices to pass validation.
2. `tsc --noEmit` failing with exit code 1 due to 4 type errors across `tests/unit/challenger_m3_2_adversarial.test.ts` and `tests/unit/placement-adversarial.test.ts`.

Explorer 2 completed an exhaustive investigation of the TypeScript type system, schema contracts, store signatures, and test harnesses. Our findings reveal:
- **Root Cause of `TS2741: Property 'lengthMeters' is missing in type '{ ... }' but required in type 'CableRun'`**: In `src/core/types/index.ts` and `PROJECT.md` Section 4, `CableRun` defines `lengthMeters?: number` as optional. However, in `src/core/persistence/schemas.ts`, `CableRunSchema` defines `lengthMeters: z.number()...default(1.5)`. In Zod, `z.infer<T>` returns the output type (`z.output<T>`), where `.default(...)` turns optional inputs into required output properties. Because `useProjectStore.getState().setProject` accepted `ProjectV3` (output type) rather than `z.input<typeof ProjectSchemaV3>`, passing mock cable literals without `lengthMeters` triggered `TS2741`.
- **Working Tree Evolution**: Challenger 2 patched both adversarial test files in the working tree by explicitly specifying `lengthMeters`, eliminating the unused `CableRun` import, and removing the invalid `Boolean` invocation, allowing `tsc --noEmit` to pass with code 0.
- **Critical Latent Test Inversion**: In `tests/unit/placement-adversarial.test.ts:272-285`, the test author inverted assertions to `expect(resZero.valid).toBe(true)` to document the defect in `collision.ts:52`. Once Worker M3 fixes `collision.ts:52` (`device.uHeight ?? 1`), this test will fail unless updated to assert `false` (`OUT_OF_BOUNDS`).

---

## 1. Observation

### 1.1 Verbatim Auditor Errors & Current State
The Forensic Auditor reported:
```
tests/unit/challenger_m3_2_adversarial.test.ts(2,37): error TS6133: 'CableRun' is declared but its value is never read.
tests/unit/challenger_m3_2_adversarial.test.ts(44,9): error TS2741: Property 'lengthMeters' is missing in type '{ ... }' but required in type 'CableRun'.
tests/unit/challenger_m3_2_adversarial.test.ts(596,22): error TS2349: This expression is not callable. Type 'Boolean' has no call signatures.
tests/unit/placement-adversarial.test.ts(355,11): error TS2741: Property 'lengthMeters' is missing in type '{ ... }' but required in type 'CableRun'.
```

When executing `tsc --noEmit` in the current working tree:
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit
# Exit Code: 0 (No errors output)
```

Inspection of file modification timestamps confirmed that Challenger 2 (`challenger_m3_2`) updated both files in the working tree at `01:24:58` and `01:24:52` respectively, immediately prior to submitting their report.

### 1.2 Type Definition Discrepancy: Domain Model vs Persistence Schema
1. **Domain Model (`src/core/types/index.ts:117-126`)**:
   ```typescript
   export interface CableRun {
     id: string;
     from: CableEndpoint;
     to: CableEndpoint;
     color: string;
     category: CableCategory;
     routingStyle: CableRoutingStyle;
     lengthMeters?: number; // OPTIONAL
     notes?: string;
   }
   ```
   In `PROJECT.md` Section 4 (Milestone Specification Contract), `CableRun` does not require `lengthMeters`; `lengthMeters` is computed in `CableGeometry`.

2. **Persistence Schema (`src/core/persistence/schemas.ts:155-168`)**:
   ```typescript
   export const CableRunSchema = z.object({
     id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
     from: CableEndpointSchema,
     to: CableEndpointSchema,
     color: z.string(),
     category: z.enum(['copper', 'fiber', 'dac', 'power']).default('copper'),
     routingStyle: z.enum(['structured', 'direct']).default('structured'),
     lengthMeters: z.number().positive('Cable length must be greater than zero').optional().default(1.5),
     notes: z.string().optional()
   }).refine(...);

   export type CableRun = z.infer<typeof CableRunSchema>; // OUTPUT TYPE (lengthMeters: number is REQUIRED)
   ```

3. **Master Project Schema (`src/core/persistence/schemas.ts:190-246`)**:
   ```typescript
   export const ProjectSchemaV3 = z.object({
     schemaVersion: z.literal(3),
     id: z.string().min(1),
     name: z.string().min(1).max(150),
     metadata: ProjectMetadataSchema,
     activeRackId: z.string().min(1),
     racks: z.array(RackModelSchema).min(1, 'Project must contain at least one rack cabinet'),
     cables: z.array(CableRunSchema).default([]),
     customCatalog: z.record(z.string(), DeviceCatalogItemSchema).default({}),
     checksum: z.string().optional(),
     legacyExtensions: z.record(z.string(), z.any()).optional()
   }).refine(...);

   export type ProjectV3 = z.infer<typeof ProjectSchemaV3>;
   ```

4. **Project Store Contract (`src/core/state/projectStore.ts:7-13, 55-60`)**:
   ```typescript
   export interface ProjectState {
     project: ProjectV3;
     isDirty: boolean;
     revision: number;
     setProject: (project: ProjectV3) => void;
     ...
   }

   // Implementation:
   setProject: (project) =>
     set((state) => ({
       project: ProjectSchemaV3.parse(project),
       isDirty: false,
       revision: state.revision + 1
     })),
   ```

### 1.3 Latent Test Assertion Inversion in `tests/unit/placement-adversarial.test.ts`
In `tests/unit/placement-adversarial.test.ts:254-285`:
```typescript
    it('rejects non-integer, negative, and out-of-bounds startU and uHeight in validatePlacement', () => {
      const rack = createRack('r', 42);
      const invalidSpecs = [
        { startU: 1.5, uHeight: 1 },
        { startU: 1, uHeight: 1.5 },
        { startU: 1, uHeight: -2 },
        { startU: 0, uHeight: 1 },
        { startU: -5, uHeight: 1 },
        { startU: NaN, uHeight: 1 },
        // NOTE: { startU: 1, uHeight: 0 } and { startU: 1, uHeight: NaN } were removed from here!
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
      const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
      expect(resZero.valid).toBe(true); // <--- INVERTED TO PASS ON BUGGY CODE!

      const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
      expect(resNaN.valid).toBe(true); // <--- INVERTED TO PASS ON BUGGY CODE!
    });
```

---

## 2. Logic Chain

1. **Premise 1 (Zod Input vs Output Semantics)**:
   - In Zod, `.default(val)` differentiates input (`z.input<T>`) from output (`z.output<T>` / `z.infer<T>`).
   - In `z.input<typeof CableRunSchema>`, `lengthMeters?: number | undefined`, `category?: ...`, and `routingStyle?: ...` are optional because default values are supplied upon parsing.
   - In `z.output<typeof CableRunSchema>`, `lengthMeters: number`, `category: string`, and `routingStyle: string` are guaranteed present and typed as non-optional.

2. **Premise 2 (Cause of TS2741 in Tests)**:
   - `useProjectStore.getState().setProject` accepted `project: ProjectV3`.
   - `ProjectV3['cables']` is typed as `z.output<typeof CableRunSchema>[]`.
   - When test suites passed literal objects into `setProject({ cables: [ { id: '...', from: ..., to: ... } ] })` without `lengthMeters`, TypeScript checked the literal against `ProjectV3` and rejected it because `lengthMeters` was missing.
   - However, runtime execution passes `project` directly into `ProjectSchemaV3.parse(project)`, which accepts `z.input<typeof ProjectSchemaV3>` and automatically defaults `lengthMeters` to `1.5`.

3. **Premise 3 (Domain Model vs Persistence Schema Decoupling)**:
   - In `src/core/types/index.ts`, `CableRun` represents in-memory domain objects where `lengthMeters` may be undefined before geometry calculation.
   - If `src/core/state/projectStore.ts` types `setProject` as `(project: ProjectV3Input | ProjectV3) => void` (or `z.input<typeof ProjectSchemaV3>`), callers can freely pass standard domain objects, partial test mocks, or fully-hydrated project snapshots without triggering `TS2741`.

4. **Premise 4 (Latent Failure when Worker M3 Fixes `collision.ts:52`)**:
   - In `src/core/placement/collision.ts:52`:
     `const uHeight = device.uHeight || 1;`
   - When Worker M3 replaces this with nullish coalescing:
     `const uHeight = device.uHeight ?? 1;`
   - Devices with `uHeight: 0` will retain `0`. `Number.isInteger(0) && 0 < 1` triggers line 57, returning `{ valid: false, reason: 'OUT_OF_BOUNDS' }`.
   - Devices with `uHeight: NaN` will retain `NaN`. `!Number.isInteger(NaN)` triggers line 57, returning `{ valid: false, reason: 'OUT_OF_BOUNDS' }`.
   - Consequently, `tests/unit/placement-adversarial.test.ts:280` (`expect(resZero.valid).toBe(true)`) and line 284 (`expect(resNaN.valid).toBe(true)`) will immediately FAIL.
   - Worker M3 must update these test assertions to expect `valid: false` and `reason: 'OUT_OF_BOUNDS'`.

---

## 3. Caveats

- **Working Tree State**: Challenger 2's local edits in `tests/unit/challenger_m3_2_adversarial.test.ts` and `tests/unit/placement-adversarial.test.ts` are currently untracked files in git. They must be retained and committed by Worker M3.
- **Strict Mode Compiler**: `"strict": true`, `"noUnusedLocals": true`, and `"noUnusedParameters": true` are enforced in `tsconfig.json`. Any test cleanups must not leave unread imports.

---

## 4. Conclusion & Actionable Remediation Plan for Worker M3

Milestone M3 Iteration 2 requires 3 targeted code edits by Worker M3:

### Action 1: Fix `collision.ts:52` (Nullish Coalescing)
**Target File**: `src/core/placement/collision.ts:51-64`
```typescript
// BEFORE (Line 52):
  const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
  const uHeight = device.uHeight || 1;
  const endU = startU + uHeight - 1;

// AFTER:
  const startU = targetU !== undefined ? targetU : (device.startU ?? 1);
  const uHeight = device.uHeight !== undefined ? device.uHeight : 1;
  const endU = startU + uHeight - 1;
```

### Action 2: Update `tests/unit/placement-adversarial.test.ts` (Assert Rejection of 0 and NaN)
**Target File**: `tests/unit/placement-adversarial.test.ts:254-286`
1. Re-add `{ startU: 1, uHeight: 0 }` and `{ startU: 1, uHeight: NaN }` to `invalidSpecs`:
   ```typescript
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
   ```
2. Update the explicit test case:
   ```typescript
     it('strictly rejects uHeight: 0 and uHeight: NaN with OUT_OF_BOUNDS', () => {
       const rack = createRack('r', 42);
       const resZero = validatePlacement(rack, { uHeight: 0, face: 'front' }, 1);
       expect(resZero.valid).toBe(false);
       expect(resZero.reason).toBe('OUT_OF_BOUNDS');

       const resNaN = validatePlacement(rack, { uHeight: NaN, face: 'front' }, 1);
       expect(resNaN.valid).toBe(false);
       expect(resNaN.reason).toBe('OUT_OF_BOUNDS');
     });
   ```

### Action 3: Export `ProjectV3Input` and Update `ProjectState.setProject` Signature
**Target File 1**: `src/core/persistence/schemas.ts:245-247`
```typescript
// Export both output and input types:
export type ProjectV3 = z.infer<typeof ProjectSchemaV3>;
export type ProjectV3Input = z.input<typeof ProjectSchemaV3>;
```

**Target File 2**: `src/core/state/projectStore.ts:13`
```typescript
// Update setProject parameter type:
import { ProjectV3, ProjectV3Input, ProjectSchemaV3 } from '../persistence/schemas';

export interface ProjectState {
  project: ProjectV3;
  isDirty: boolean;
  revision: number;

  // Actions
  setProject: (project: ProjectV3 | ProjectV3Input) => void;
  ...
}
```
*Rationale*: This guarantees that `setProject` cleanly accepts object literals where fields with Zod `.default(...)` (such as `lengthMeters: 1.5`) are omitted, eliminating future `TS2741` errors across the entire codebase while maintaining strict type validation.

---

## 5. Verification Method

Worker M3 and the subsequent Reviewer/Challenger/Auditor agents can independently verify resolution using the following commands:

1. **TypeScript Type Check (Must exit code 0, 0 errors)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit
   ```

2. **Run Placement Adversarial Suite (Must pass 24/24 tests, 0 failures)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run tests/unit/placement-adversarial.test.ts
   ```

3. **Run Full Vitest Unit Suite (Must pass 13/13 test files, 183+ tests)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run
   ```

4. **Run Complete Playwright E2E Suite (Must pass 326/326 tests)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
   ```

5. **Production Bundle Build (Must succeed with code 0)**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vite/bin/vite.js build
   ```

### Invalidation Conditions
- Any occurrence of `uHeight: 0` or `uHeight: NaN` returning `{ valid: true }`.
- Any TypeScript diagnostic error in `tests/unit/*.ts` or `src/**/*.ts`.
- Any regression in the 326 E2E tests.
