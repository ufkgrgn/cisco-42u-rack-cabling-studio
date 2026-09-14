# Adversarial Verification Report: Camera Affine Math & Coordinate Projections (M2_1)

**Verdict**: **REQUEST_CHANGES**  
**Agent**: Challenger M2_1 (Empirical Challenger: Critic, Specialist)  
**Date**: 2026-09-14T20:32:00Z  
**Target Files**:
- `src/engine/camera/affine.ts`
- `src/engine/camera/Camera.ts`
- `src/engine/camera/CameraController.ts`

---

## 1. Observation

Adversarial stress harness was authored and executed in `tests/unit/camera-adversarial.test.ts` via Vitest (`npx vitest run tests/unit/camera-adversarial.test.ts`) and TypeScript compiler (`npx tsc --noEmit`).

### A. Scale Boundary Clamping
1. **`affine.ts:41-43` (`clampZoom`)**:
   ```typescript
   export function clampZoom(zoom: number, minZoom = 0.1, maxZoom = 4.0): number {
     return Math.min(maxZoom, Math.max(minZoom, zoom));
   }
   ```
   - `clampZoom(0)` -> `0.1` (Passed)
   - `clampZoom(-1000)` -> `0.1` (Passed)
   - `clampZoom(-Infinity)` -> `0.1` (Passed)
   - `clampZoom(Infinity)` -> `4.0` (Passed)
   - `clampZoom(1e12)` -> `4.0` (Passed)
   - `clampZoom(NaN)` -> `NaN` (**Vulnerability observed**)
2. **`Camera.ts:147-167` (`zoomAt`)**:
   - 1,000 consecutive zoom-in operations (`zoomAt(500, 500, 1.5)` starting at 1.0) strictly clamped at `4.000000`.
   - 1,000 consecutive zoom-out operations (`zoomAt(500, 500, 0.5)` starting at 1.0) strictly clamped at `0.100000`.
3. **`Camera.ts:97-101` (`set scale`)**:
   ```typescript
   public set scale(val: number) {
     this._state.zoom = val;
     this._isDirty = true;
     this.applyTransform();
   }
   ```
   - Executing `camera.scale = 10.0` directly resulted in `camera.zoom === 10` (**Vulnerability observed: bypasses [0.1, 4.0] clamping contract**).
   - Executing `camera.scale = 0` sets `zoom === 0`, causing subsequent `screenToWorld` calls to perform division by zero:
     `screenToWorld(100, 100, { x: 0, y: 0, zoom: 0 }) => { x: Infinity, y: Infinity }`.

### B. Pointer-Anchored Zoom Stationarity
1. Tested across 7 boundary and arbitrary coordinate configurations:
   - Initial `(0, 0, zoom=1.0)` at anchor `(960, 540)` with factor `1.25`: error = `0.000000 px`.
   - Clamping boundary transition `(50, 50, zoom=3.8)` at anchor `(400, 300)` with factor `2.0` (target 7.6, clamped to 4.0): error = `0.000000 px`.
   - Clamping boundary transition `(50, 50, zoom=0.15)` at anchor `(400, 300)` with factor `0.2` (target 0.03, clamped to 0.1): error = `0.000000 px`.
2. Tested continuous 500-step randomized multi-point zoom sequence:
   - Max stationarity drift observed: **`1.8189894035458565e-12 px`** (well within required `1e-6` tolerance).

### C. Non-Finite Number Handling (NaN, Infinity)
1. **`affine.ts:54-81` (`calculatePointerZoom`)**:
   - `calculatePointerZoom(current, 500, 500, NaN)` => `{ x: NaN, y: NaN, zoom: NaN }`.
   - `calculatePointerZoom(current, NaN, 500, 1.5)` => `{ x: NaN, y: -100, zoom: 1.5 }`.
   - `calculatePointerZoom(current, Infinity, 500, 1.5)` => `{ x: NaN, y: -100, zoom: 1.5 }` (due to `Infinity - Infinity * 1.5 = NaN`).
2. **`Camera.ts:147-167` (`zoomAt`) and `169-185` (`setZoom`)**:
   - `camera.zoomAt(500, 500, NaN)` => `camera.state` becomes `{ x: NaN, y: NaN, zoom: NaN }`.
   - `camera.zoomAt(NaN, 500, 1.5)` => `camera.state` becomes `{ x: NaN, y: -250, zoom: 1.5 }`.
   - `camera.setZoom(NaN)` => `camera.state` becomes `{ x: NaN, y: NaN, zoom: NaN }`.
   - `camera.panBy(NaN, 0)` => `camera.state` becomes `{ x: NaN, y: 0, zoom: 1 }`.
   - **PixiJS transform contamination**: Because `NaN !== this._state.x` evaluates to `true`, `applyTransform()` executes:
     `this._targetContainer.position.set(NaN, NaN)` and `this._targetContainer.scale.set(NaN)`.
     This breaks PixiJS transform matrices and wipes the entire canvas render tree.
   - **Irrecoverability**: Once in NaN state, subsequent operations (`panBy`, `zoomAt`, `screenToWorld`) permanently produce `NaN`.
3. **`CameraController.ts:121-139` (EngineBridge Listeners)**:
   - Event `camera:zoom` with `{ factor: NaN, screenAnchorX: 100, screenAnchorY: 100 }` => poisons camera to `{ x: NaN, y: NaN, zoom: NaN }`.
   - Event `camera:zoom-to` with `{ factor: NaN, screenX: 100, screenY: 100 }` => poisons camera to `{ x: NaN, y: NaN, zoom: NaN }`.
   - Event `camera:pan` with `{ dx: NaN, dy: 10 }` => poisons camera pan to `{ x: NaN, y: 10, zoom: 1 }`.
4. **`CameraController.ts:220-245` (`_onWheel`)**:
   - Mode A condition: `if (e.ctrlKey || (!e.shiftKey && Math.abs(e.deltaY) > 0 && Math.abs(e.deltaX) === 0))`.
   - If `e.deltaY` is `NaN`, `Math.abs(NaN) > 0` evaluates to `false`, causing the handler to fall through to Mode C:
     `this._camera.panBy(-e.deltaX, -e.deltaY)` where `-e.deltaY` is `NaN`, corrupting camera pan.
   - If `e.ctrlKey` is `true` with `e.deltaY = NaN`, `clampedDelta = Math.min(100, Math.max(-100, NaN)) = NaN`, `factor = Math.exp(NaN) = NaN`, calling `zoomAt(screenAnchorX, screenAnchorY, NaN)`.

### D. Inverse Roundtrip Identity
1. Tested 10,000 coordinate points across 5 distinct camera states (covering `zoom` from 0.1 to 4.0 and pan translations from `-100,000` to `+100,000` with fractional sub-pixels):
   - **Max Screen -> World -> Screen error**: **`1.4551915228366852e-11 px`**
   - **Max World -> Screen -> World error**: **`2.9103830456733704e-11 px`**
   - Both are well within the required `1e-6` tolerance.

---

## 2. Logic Chain

1. **Premise 1**: The user requirements demand scale boundary clamping strictly between 0.1x and 4.0x, pointer-anchored zoom stationarity, graceful handling of non-finite numbers (NaN and Infinity), and inverse roundtrip precision within 1e-6.
2. **Observation 1 & 2**: While `calculatePointerZoom` and `zoomAt` clamp finite values and +/- Infinity to [0.1, 4.0], the property setter `scale` in `Camera.ts:97-101` bypasses all clamping, allowing external callers or UI components to set `camera.scale = 10.0` or `camera.scale = 0`.
3. **Observation 3**: In JavaScript, `Math.max(0.1, NaN) === NaN` and `Math.min(4.0, NaN) === NaN`. Hence `clampZoom(NaN)` returns `NaN`. None of the projection or camera methods check `Number.isFinite(...)`.
4. **Observation 4**: When `NaN` or `Infinity` is passed into `Camera.zoomAt`, `Camera.setZoom`, `Camera.panBy`, or via EngineBridge events (`camera:zoom`, `camera:zoom-to`, `camera:pan`), the camera state transitions to `{ x: NaN, y: NaN, zoom: NaN }`.
5. **Observation 5**: In `Camera.ts:158`, the check `newState.x !== this._state.x` evaluates to `true` when `newState.x` is `NaN` because `NaN !== NaN` is always `true`. This causes `this.applyTransform()` to pass `NaN` coordinates to PixiJS `Container.position` and `Container.scale`.
6. **Observation 6**: In PixiJS v8, non-finite transform parameters corrupt the local and world transformation matrices (`Matrix.a, b, c, d, tx, ty`), halting GPU rendering for all attached rack containers and device graphics.
7. **Observation 7**: Furthermore, once the state is contaminated with `NaN`, all subsequent calls to `panBy`, `zoomAt`, and `screenToWorld` remain locked in `NaN` state, requiring an application restart.
8. **Deduction**: Because the camera math and controllers fail to gracefully handle non-finite numbers and allow scale clamp bypass via `scale`, the implementation does not meet the production robustness criteria.

---

## 3. Caveats

- **WebGL/WebGPU Hardware Shader Precision**: The adversarial tests were executed in Node.js (V8) with jsdom simulating canvas elements. Hardware shader precision on low-end GPUs (e.g. mediump float precision) was not tested directly in a browser canvas, though the 64-bit CPU math guarantees double precision (`~1e-12` px).
- **DOM Event Construction**: In jsdom, native `new WheelEvent` constructors throw a WebIDL error if `deltaY` is `NaN`. In real web browsers or custom synthetic event emitters, events with non-finite values or missing properties can still reach handlers.

---

## 4. Conclusion & Required Changes

**Verdict**: **REQUEST_CHANGES**

The core affine geometry, inverse roundtrip precision (`< 3e-11 px`), and pointer-anchored zoom stationarity (`< 2e-12 px`) are mathematically exceptional and far exceed requirements. However, critical hardening against non-finite inputs and property bypass is mandatory.

### Actionable Remediation Items:
1. **`src/engine/camera/affine.ts`**:
   - In `clampZoom(zoom, minZoom = 0.1, maxZoom = 4.0)`: Guard against non-finite inputs:
     ```typescript
     export function clampZoom(zoom: number, minZoom = 0.1, maxZoom = 4.0): number {
       if (!Number.isFinite(zoom) || Number.isNaN(zoom)) return 1.0;
       return Math.min(maxZoom, Math.max(minZoom, zoom));
     }
     ```
   - In `calculatePointerZoom`: Guard against non-finite anchors and target zoom:
     ```typescript
     if (!Number.isFinite(screenAnchorX) || !Number.isFinite(screenAnchorY) || !Number.isFinite(targetZoom)) {
       return current;
     }
     ```
2. **`src/engine/camera/Camera.ts`**:
   - In `set scale(val: number)`: Enforce clamping and finite check:
     ```typescript
     public set scale(val: number) {
       if (!Number.isFinite(val)) return;
       this._state.zoom = clampZoom(val, this._options.minZoom, this._options.maxZoom);
       this._isDirty = true;
       this.applyTransform();
     }
     ```
   - In `panBy(dx: number, dy: number)`: Guard against `NaN` / `Infinity`:
     ```typescript
     if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
     ```
   - In `setPan(x: number, y: number)`: Guard `if (!Number.isFinite(x) || !Number.isFinite(y)) return;`
   - In `zoomAt(screenAnchorX, screenAnchorY, factor)`: Guard `if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(screenAnchorX) || !Number.isFinite(screenAnchorY)) return;`
   - In `setZoom(zoom, screenAnchorX?, screenAnchorY?)`: Guard `if (!Number.isFinite(zoom) || zoom <= 0) return;`
3. **`src/engine/camera/CameraController.ts`**:
   - In `_onWheel`: Guard `if (!Number.isFinite(e.deltaY) || !Number.isFinite(e.deltaX) || !Number.isFinite(screenAnchorX) || !Number.isFinite(screenAnchorY)) return;`
   - In EngineBridge listeners (`camera:pan`, `camera:zoom`, `camera:zoom-to`, `camera:pan-to`): Validate input data before forwarding to `this._camera`.

---

## 5. Verification Method

1. **Run TypeScript type checker**:
   ```powershell
   $env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH; npx tsc --noEmit
   ```
   *Expected*: Exits with code 0.
2. **Run Vitest Camera Suite & Adversarial Suite**:
   ```powershell
   $env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH; npx vitest run tests/unit/camera.test.ts tests/unit/camera-adversarial.test.ts
   ```
   *Expected*: All 41 tests pass.
3. **Invalidation Conditions**:
   - Any test where `camera.zoomAt(NaN, 500, 1.5)` or `camera.setZoom(NaN)` produces `state.x = NaN` or `state.zoom = NaN`.
   - Any test where `camera.scale = 10.0` results in `camera.zoom > 4.0`.
   - Any test where roundtrip error exceeds `1e-6` or pointer stationarity drift exceeds `1e-6`.
