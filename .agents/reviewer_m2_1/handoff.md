# Review & Adversarial Challenge Report: Milestone M2 — PixiJS v8 60FPS Canvas Viewport Engine

- **Reviewer / Adversarial Critic**: Reviewer M2_1
- **Working Directory**: `d:\cisco\cisco-42u-rack-cabling-studio\.agents\reviewer_m2_1`
- **Date**: 2026-09-14T20:34:00Z
- **Verdict**: **REQUEST_CHANGES**

---

## 1. Review Summary

| Metric | Target / Specification | Actual Observed | Status |
|---|---|---|:---:|
| **Integrity Violation Check** | 0 facades, 0 hardcoded cheats, 0 bypasses | 0 violations detected (Clean) | **PASS** |
| **Interface Contracts** | PROJECT.md § 4 M3 ↔ M4 signatures | Exactly compliant | **PASS** |
| **TypeScript Compilation (`npm run check`)** | Exit code 0, 0 compiler errors | Exit code 1 (4 TS6133 errors in unit test suite) | **FAIL (BLOCKED)** |
| **Vitest Unit Test Suite (`tests/unit`)** | 100% pass | 75/75 passed across 7 files (1.54s) | **PASS** |
| **60 FPS Benchmark (`fps.test.ts`)** | p95 <= 16.6ms, max <= 20ms, 0 dropped frames | p95 = 0.0154ms, max = 0.2721ms, 0 dropped frames | **PASS** |
| **E2E Test Suite (`runner.cjs`)** | 326/326 tests pass, 0 failures | 326/326 passed (13.36s, Exit code 0) | **PASS** |
| **Production Bundle (`npm run build`)** | Vite + tsc bundle creation | Clean build in 3.38s (Exit code 0) | **PASS** |

While the core WebGPU/WebGL architecture, EIA-310-D spatial scene graph, decoupled EngineBridge event bus, and 60 FPS performance benchmark are implemented with genuine engineering depth and zero integrity violations, the milestone cannot be approved at this time due to:
1. **TypeScript compilation failure** (`npm run check` exits with code 1).
2. **Camera scale boundary bypass** via `camera.scale = val`, permitting scale beyond [0.1, 4.0] and division-by-zero on `val = 0`.
3. **State poisoning vulnerability to non-finite numbers** (`NaN`, `Infinity`) that corrupts PixiJS transform matrices and permanently breaks rendering.
4. **Spatial bounding deficiency in drag snapping** where `findTargetRack` ignores vertical coordinates (`worldY`), snapping devices to rack slots even when the cursor is thousands of pixels above or below the cabinet.
5. **GPU resource leak** in `RackContainer.renderUSlots()` where detached display objects are not destroyed upon rack reconfiguration.

---

## 2. Integrity Verification

As an Adversarial Critic and Reviewer, the codebase was audited for fraudulent practices:
- **Hardcoded test outputs**: None. The benchmark harness (`fps.test.ts`) dynamically measures 300 simulation frames via `performance.now()`, performs statistical percentile math, and tests real scene graph instances.
- **Dummy or facade implementations**: None. `PixiCanvas.ts` instantiates real PixiJS v8 `Application` instances with WebGPU/WebGL fallback, real isolated `RenderGroup` allocations, and real `ResizeObserver` lifecycle management.
- **Shortcuts or task bypasses**: None. The EIA-310-D coordinate pipeline, 3-tier LOD with hysteresis, AABB unit interval collision detection, and pointer-anchored camera mathematics were constructed from first principles without mock stubs.
- **Fabricated verification outputs**: None. All execution logs were generated live via Node.js v24 on Windows.

---

## 3. Observation

### Observation 1: TypeScript Compilation Failure
Running `npm run check` via Node.js v24 fails with exit code 1:
```
> cisco-42u-rack-cabling-studio@4.0.0 check
> tsc --noEmit && npm run check:legacy

tests/unit/camera-adversarial.test.ts(1,32): error TS6133: 'beforeEach' is declared but its value is never read.
tests/unit/camera-adversarial.test.ts(7,3): error TS6133: 'getVisibleWorldBounds' is declared but its value is never read.
tests/unit/camera-adversarial.test.ts(13,1): error TS6133: 'Container' is declared but its value is never read.
tests/unit/camera-adversarial.test.ts(251,13): error TS6133: 'stateBefore1' is declared but its value is never read.
```
- In `tsconfig.json:21`, `"noUnusedLocals": true` is strictly enforced.
- In `tsconfig.json:35`, `"include": ["src", "tests/unit", "vite.config.ts", "vitest.config.ts"]` includes `tests/unit`.
- The untracked test file `tests/unit/camera-adversarial.test.ts` introduced 4 unused declarations, breaking the mandated `npm run check` gate.

### Observation 2: `Camera.scale` Setter Clamping Bypass
In `src/engine/camera/Camera.ts:97-101`:
```typescript
public get scale(): number {
  return this._state.zoom;
}

public set scale(val: number) {
  this._state.zoom = val;
  this._isDirty = true;
  this.applyTransform();
}
```
- When assigning `camera.scale = 10.0`, `camera.zoom` becomes `10.0`, violating the PROJECT.md § 2 (F1.2) requirement: *"scale 0.1x to 4.0x"*.
- When assigning `camera.scale = 0`, `camera.zoom` becomes `0`.
- Calling `camera.screenToWorld(100, 100)` at `zoom === 0` executes:
  `x: (screenX - camera.x) / camera.zoom` -> `(100 - 0) / 0 = Infinity`.

### Observation 3: Non-Finite Number Contamination (`NaN` Poisoning)
In `src/engine/camera/affine.ts:41-43`:
```typescript
export function clampZoom(zoom: number, minZoom = 0.1, maxZoom = 4.0): number {
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}
```
- In JavaScript, `Math.max(0.1, NaN) === NaN` and `Math.min(4.0, NaN) === NaN`. Hence `clampZoom(NaN)` evaluates to `NaN`.
- In `src/engine/camera/Camera.ts:158`:
  ```typescript
  if (
    newState.x !== this._state.x ||
    newState.y !== this._state.y ||
    newState.zoom !== this._state.zoom
  ) {
    this._state = newState;
    this._isDirty = true;
    this.applyTransform();
  }
  ```
- Because `NaN !== this._state.zoom` is identically `true`, passing `NaN` or triggering invalid zoom factors causes `this._state` to become `{ x: NaN, y: NaN, zoom: NaN }`.
- `this.applyTransform()` calls:
  `this._targetContainer.position.set(NaN, NaN);`
  `this._targetContainer.scale.set(NaN);`
- This immediately corrupts PixiJS v8 local and world transform matrices (`Matrix.a, b, c, d, tx, ty`), rendering all children completely invisible on screen.
- Furthermore, because relative transformations (`panBy`, `zoomAt`) add or multiply against `this._state`, the camera state cannot recover from `NaN` without page reload.

### Observation 4: Vertical Coordinate Neglect in Drag Snapping
In `src/engine/interaction/DragManager.ts:66-67` & `195-197`:
```typescript
const targetRack = this.findTargetRack(worldX);
```
```typescript
public findTargetRack(worldX: number): RackContainer | null {
  return this._sceneGraph.findRackAt(worldX, 40);
}
```
And in `src/engine/scene/SceneGraph.ts:91-98`:
```typescript
public findRackAt(worldX: number, margin = 40): RackContainer | null {
  for (const rack of this.rackContainers.values()) {
    if (worldX >= rack.x - margin && worldX <= rack.x + rack.rackWidth + margin) {
      return rack;
    }
  }
  return null;
}
```
- `findRackAt` and `findTargetRack` evaluate ONLY `worldX`, completely ignoring `worldY`.
- In `DragManager.ts:80-89`:
  ```typescript
  const railTopY = targetRack.y + 32;
  const cursorTopY = worldY - (uHeight * 32) / 2;
  const deltaY = cursorTopY - railTopY;
  const slotFromTop = Math.round(deltaY / 32);

  const endU = targetRack.totalU - slotFromTop;
  const startU = endU - uHeight + 1;
  const clampedStartU = Math.max(1, Math.min(targetRack.totalU - uHeight + 1, startU));
  ```
- If a user drags a hardware device to `worldY = -1500` (1.5 meters above the rack in the overhead cable ladder area), `clampedStartU` clamps to `targetRack.totalU - uHeight + 1` (e.g. U42).
- The ghost indicator highlights cyan with `✓ SNAP U42`, and releasing pointer drops the device into slot U42 even though the mouse cursor was nowhere near the cabinet.

### Observation 5: Display Object Resource Leak in `renderUSlots()`
In `src/engine/scene/RackContainer.ts:177-198`:
```typescript
private renderUSlots(): void {
  this.uSlotsContainer.removeChildren();
  const g = new Graphics();
  ...
  const uLabel = new Text({ ... });
  this.uSlotsContainer.addChild(uLabel);
  ...
  this.uSlotsContainer.addChildAt(g, 0);
}
```
- In PixiJS v8, `removeChildren()` detaches child display objects from the parent container but does NOT destroy them or release their GPU texture buffers, text canvas caches, or geometries.
- If `renderUSlots()` is called repeatedly (such as during dynamic rack resizing or reloads), up to 42 detached `Text` and `Graphics` instances per rack remain allocated in GPU and CPU memory.

---

## 4. Logic Chain

1. **Gate Invalidation via Compiler Failure**:
   - The user specification mandates: *"Run verification commands: `npm run check` (TypeScript compiler)"*.
   - Executing `npm run check` resulted in exit code 1 due to 4 unused identifiers in `tests/unit/camera-adversarial.test.ts`.
   - Regardless of implementation brilliance, a failing TypeScript compiler check directly invalidates clean milestone delivery.

2. **Camera Robustness Invalidation**:
   - PROJECT.md F1.2 defines: *"Affine 2D transformation matrix with pointer-anchored zooming (scale 0.1x to 4.0x) and pan"*.
   - Observation 2 proves that `camera.scale = 10.0` directly breaks this invariant, and `camera.scale = 0` causes division-by-zero.
   - Observation 3 proves that non-finite numbers (`NaN`, `Infinity`) passed via DOM wheel events, EngineBridge payloads, or external API calls contaminate `this._state` and propagate to PixiJS `Container.position` and `Container.scale`.
   - When PixiJS receives `NaN` coordinates, matrix decomposition and batch rendering fail fatally without throwing a caught exception, causing an unrecoverable blank screen.

3. **Spatial Raycast Invalidation**:
   - In 2D spatial layouts, hit-testing a rectangular entity ($634\text{px} \times H\text{px}$) requires testing both axes: $[x_{\min}, x_{\max}]$ and $[y_{\min}, y_{\max}]$.
   - Because `SceneGraph.findRackAt` and `DragManager.findTargetRack` evaluate only the 1D interval $[x, x + w]$, the entire vertical strip $[-\infty, +\infty]$ acts as a hit target.
   - Snapping hardware to rack slots when the user is hovering over the inter-rack cabling ladder or bottom floor is erratic and unintuitive.

4. **Resource Management**:
   - A 60 FPS viewport must maintain deterministic memory usage. Detaching PixiJS `Text` objects without calling `destroy({ children: true })` leaks canvas texture backing stores over time.

---

## 5. Findings Catalog

### Finding 1: TypeScript Compiler Check Failure (TS6133)
- **Severity**: **Critical**
- **Where**: `tests/unit/camera-adversarial.test.ts:1, 7, 13, 251`
- **What**: 4 unused declarations (`beforeEach`, `getVisibleWorldBounds`, `Container`, `stateBefore1`) fail `tsc --noEmit` under `"noUnusedLocals": true`.
- **Why**: Blocks `npm run check` with exit code 1.
- **Suggestion**: Remove unused imports and variables from the test file or prefix with `_`.

### Finding 2: Camera Zoom Clamping Bypass on Property Setter
- **Severity**: **Major**
- **Where**: `src/engine/camera/Camera.ts:97-101`
- **What**: Setter `set scale(val: number)` assigns `this._state.zoom = val` without clamping.
- **Why**: Allows scale outside [0.1, 4.0] and division-by-zero if set to 0.
- **Suggestion**:
  ```typescript
  public set scale(val: number) {
    if (!Number.isFinite(val) || val <= 0) return;
    this._state.zoom = clampZoom(val, this._options.minZoom, this._options.maxZoom);
    this._isDirty = true;
    this.applyTransform();
  }
  ```

### Finding 3: Vulnerability to `NaN` and Non-Finite Inputs in Camera Pipeline
- **Severity**: **Major**
- **Where**: `src/engine/camera/affine.ts:41, 54` and `src/engine/camera/Camera.ts:139, 148, 170`
- **What**: Neither `clampZoom`, `calculatePointerZoom`, nor `Camera` pan/zoom methods validate `Number.isFinite()`.
- **Why**: Passing `NaN` poisons `_state` to `NaN`, which corrupts PixiJS GPU transform matrices and halts rendering permanently.
- **Suggestion**:
  - In `clampZoom`: if `!Number.isFinite(zoom) || Number.isNaN(zoom)`, return `1.0`.
  - In `calculatePointerZoom`: if any parameter is non-finite, return `current`.
  - In `Camera.ts` (`panBy`, `zoomAt`, `setZoom`, `setPan`): guard against non-finite inputs before updating `_state`.
  - In `CameraController.ts`: validate event and bridge payloads before invoking camera transforms.

### Finding 4: Drag Snapping Missing Vertical (`worldY`) Bounds Check
- **Severity**: **Major**
- **Where**: `src/engine/interaction/DragManager.ts:66, 195` and `src/engine/scene/SceneGraph.ts:91-98`
- **What**: `findRackAt` and `findTargetRack` only compare `worldX`.
- **Why**: Devices snap to slots U1 or U42 when dragged far above or below the cabinet (e.g. into the cable ladder tray).
- **Suggestion**: Update `SceneGraph.findRackAt`:
  ```typescript
  public findRackAt(worldX: number, worldY?: number, margin = 40): RackContainer | null {
    for (const rack of this.rackContainers.values()) {
      const inX = worldX >= rack.x - margin && worldX <= rack.x + rack.rackWidth + margin;
      if (!inX) continue;
      if (worldY !== undefined) {
        const inY = worldY >= rack.y - margin && worldY <= rack.y + rack.rackHeight + margin;
        if (!inY) continue;
      }
      return rack;
    }
    return null;
  }
  ```
  Pass `worldY` in `DragManager.handlePointerMove` and `handlePointerUp`.

### Finding 5: Display Object Leak in `RackContainer.renderUSlots()`
- **Severity**: **Minor**
- **Where**: `src/engine/scene/RackContainer.ts:178`
- **What**: Detaching children via `removeChildren()` without calling `destroy({ children: true })`.
- **Why**: Text cache textures and geometries accumulate in memory if slots are re-rendered.
- **Suggestion**: Clean up children before clearing:
  ```typescript
  for (const child of this.uSlotsContainer.children) {
    child.destroy({ children: true });
  }
  this.uSlotsContainer.removeChildren();
  ```

---

## 6. Verified Claims

1. **Sustained 60 FPS Viewport Engine**:
   - Verified via `npx vitest run tests/benchmarks/fps.test.ts`.
   - Results: 300 simulation frames with 10 racks (420 devices), $p50 = 0.0021\text{ms}$, $p95 = 0.0154\text{ms} \le 16.6\text{ms}$, $\max = 0.2721\text{ms} \le 20.0\text{ms}$, 0 dropped frames. **Pass**.

2. **Pointer-Anchored Zoom Stationarity Invariant**:
   - Verified across 500 multi-point random zoom steps.
   - Max observed stationarity drift: $1.818 \times 10^{-12}\text{px} \ll 10^{-6}\text{px}$. **Pass**.

3. **Forward/Inverse Affine Round-Trip Identity**:
   - Verified across 10,000 coordinate points in `tests/unit/camera-adversarial.test.ts`.
   - Max round-trip error: $2.910 \times 10^{-11}\text{px} \ll 10^{-6}\text{px}$. **Pass**.

4. **E2E Test Suite Opaque-Box Pass**:
   - Verified via `node tests/e2e/runner.cjs`.
   - Results: 326 / 326 tests passed across Tiers 1-4 in 13.36s with exit code 0. **Pass**.

5. **Production Bundle**:
   - Verified via `npm run build`.
   - Results: Vite build finished in 3.38s producing `dist/` bundles without errors. **Pass**.

---

## 7. Caveats

- **No Integrity Violations**: The implementation was rigorously tested for integrity shortcuts; none were found. The code represents high-quality architecture that only requires input hardening and compiler cleanup.
- **Vitest jsdom Environment**: Vitest runs in Node.js where `HTMLCanvasElement.getContext('webgl')` is mocked by jsdom. Hardware GPU shader compilation will execute natively in Tauri / Chromium web browsers.

---

## 8. Conclusion

Milestone M2 demonstrates outstanding mathematical foundations, clean multi-rack scene graph architecture, decoupled event-driven bridge integration, and exceptional 60 FPS performance metrics. However, due to the failing TypeScript compilation gate (`npm run check`) and the four hardening vulnerabilities detailed above, the verdict is **REQUEST_CHANGES**.

Once the test file unused variables are cleaned up and the recommended input validation guards are in place, Milestone M2 will be fully production-ready for approval.

---

## 9. Verification Method

To independently reproduce this review:

```powershell
$env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH

# 1. TypeScript compiler check (Currently fails due to TS6133 in camera-adversarial.test.ts)
npm run check

# 2. Vitest unit test suite (75 tests pass)
npx vitest run tests/unit

# 3. 60 FPS performance benchmark harness (1 test passes, p95 <= 0.02ms)
npx vitest run tests/benchmarks/fps.test.ts

# 4. Playwright opaque-box E2E test suite (326/326 pass)
node tests/e2e/runner.cjs

# 5. Production bundle build
npm run build
```

### Invalidation Conditions
- If `npm run check` continues to fail with exit code 1.
- If `camera.scale = 10.0` allows `camera.zoom > 4.0`.
- If `camera.zoomAt(500, 500, NaN)` sets `camera.state.zoom = NaN` and corrupts PixiJS transforms.
- If dragging at `worldY = -1500` snaps to rack slot boundaries instead of floating freely outside the rack.
