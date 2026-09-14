# Handoff Report: Adversarial Stress Testing on Multi-Rack SceneGraph, LOD & Drag Ghost Snapping

**Agent**: Challenger M2_2  
**Working Directory**: `d:\cisco\cisco-42u-rack-cabling-studio\.agents\challenger_m2_2`  
**Target Scope**: `src/engine/scene/` and `src/engine/interaction/`  
**Test Suite**: `tests/benchmarks/adversarial_m2_2.test.ts`  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Observation

### 1.1 Test Execution Commands & Environment
- **Runtime**: Node.js v24.13.0 (`C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64`)
- **Command**:
  ```powershell
  $env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;$env:PATH"
  npx vitest run tests/benchmarks/adversarial_m2_2.test.ts
  ```
- **Result**:
  - Test Files: `1 passed (1)`
  - Tests: `14 passed (14)`
  - Duration: `1.98s`
  - Integrated Unit Test Run (`npm run test:unit`): `9 test files passed (9)`, `90 tests passed (90)`.

### 1.2 Quantitative Empirical Metrics

#### A. EIA-310-D Slot Snapping Boundaries & Out-of-Bounds
- **Bottom Slot 1 (`startU = 1`)**:
  - 1U Device: `clampedStartU = 1`, `ghost.y = 1344px`, `height = 32px`. Spans `y = 1344..1376px`, terminating flush with bottom plinth (`y = 1376px`). Exact match with `rack.getSlotBounds(1, 1)`.
  - 2U Device: `clampedStartU = 1`, `ghost.y = 1312px`, `height = 64px`. Spans `y = 1312..1376px`. Exact match with `rack.getSlotBounds(1, 2)`.
  - 4U Device: `clampedStartU = 1`, `ghost.y = 1248px`, `height = 128px`. Spans `y = 1248..1376px`. Exact match with `rack.getSlotBounds(1, 4)`.
- **Top Slot 42 (`startU = 42`)**:
  - 1U Device: `clampedStartU = 42`, `ghost.y = 32px`, `height = 32px`. Spans `y = 32..64px`, starting flush below top header (`y = 32px`). Exact match with `rack.getSlotBounds(42, 1)`.
  - 2U Device: Highest valid slot is `startU = 41` (occupies U41-U42). `topUnit = 42`, `ghost.y = 32px`, `height = 64px`. Exact match with `rack.getSlotBounds(41, 2)`.
  - 4U Device: Highest valid slot is `startU = 39` (occupies U39-U42). `topUnit = 42`, `ghost.y = 32px`, `height = 128px`. Exact match with `rack.getSlotBounds(39, 4)`.
- **Out-of-Bounds Rejection (`checkCollision`)**:
  - `startU = 0, u = 1`: `hasCollision = true`, `reason = 'OUT OF BOUNDS'`.
  - `startU = -5, u = 1`: `hasCollision = true`, `reason = 'OUT OF BOUNDS'`.
  - `startU = 43, u = 1`: `hasCollision = true`, `reason = 'OUT OF BOUNDS'`.
  - `startU = 42, u = 2`: `hasCollision = true`, `reason = 'OUT OF BOUNDS'`.
  - `startU = 40, u = 4`: `hasCollision = true`, `reason = 'OUT OF BOUNDS'`.
- **Extreme Cursor Coordinates**:
  - `worldY = -10,000px` (far above): clamped cleanly to `startU = 42` (for 1U), `ghost.y = 32px`.
  - `worldY = +50,000px` (far below): clamped cleanly to `startU = 1`, `ghost.y = 1344px`.
  - `worldX = -500px` (outside canvas): `targetRack = null`, `ghost.isValid = false`, `reason = 'OUTSIDE RACK BOUNDS'`.
- **Fractional Coordinates (500 randomized sub-pixel samples)**:
  - Non-integer coordinate inputs (e.g. `X = 53.0001 + 0.9876`, `Y = 32.123456 + 2.71828`):
  - Snapped U: 100% integer values (`Number.isInteger(snappedU) === true`, range `[1, 42]`).
  - Snapped X: discrete at `rack.x + 53px`.
  - Snapped Y: discrete grid multiples `((ghostY - 32) % 32 === 0)`.
  - Discrepancies / NaNs / Invalids: **0 / 500**.

#### B. Multi-Rack Layout Scaling & Frustum Culling
- **Scaling Latency**:
  - 10 Racks (420 devices populated): **84.43ms**
  - 20 Racks (840 devices populated): **167.57ms**
  - 50 Racks (2,100 devices populated): **360.29ms**
  - Linear scaling $O(N)$ with per-rack isolated GPU batches (`isRenderGroup: true`).
- **Frustum Culling Ground-Truth Accuracy**:
  - Stress test across 200 panning frames across 50 racks (world X span: `0..38,000px`).
  - Total rack visibility checks evaluated: **10,000**.
  - False positives (culled rack flagged as visible): **0**.
  - False negatives (on-screen rack flagged as culled): **0**.
  - Accuracy: **100.00%** (0 discrepancies).
  - Extreme conditions: 100% culled (`visible = 0, culled = 50, cullRatio = 1.0`) when off-screen; 100% visible (`visible = 50, culled = 0, cullRatio = 0.0`) at zoom `0.03x`.

#### C. LOD Hysteresis & Sub-Container Invariants
- **Deadband Jitter Stress**:
  - Standard <-> Overview deadband: `[0.33, 0.35]`.
  - Standard <-> Detailed deadband: `[0.98, 1.02]`.
  - 2,000 rapid oscillation cycles across deadbands: **0 flickers / 0 spurious tier switches**.
- **State Invariants**:
  - 2,000 random scale transitions: when `setLOD` is explicitly executed, sub-containers strictly follow tier visibility rules.

#### D. Rapid Drag-and-Drop Burst
- **2,000 Pointer Move Events Across 10 Racks & 9 Inter-Rack Gaps**:
  - In-rack events: **1,780**; in-gap events: **220**.
  - Latency p50: **0.0031ms** (3.1 microseconds)
  - Latency p95: **0.0055ms** (5.5 microseconds)
  - Latency p99: **0.0221ms** (22.1 microseconds)
  - Max latency: **0.1278ms** (127.8 microseconds)
  - 100 consecutive rapid drag lifecycles: **100% clean teardown**, zero stuck ghost visibility.

---

### 1.3 Direct Defects Observed

#### Defect 1 (CRITICAL): `RackContainer` initial construction state has Overview `badgeContainer` visible in STANDARD LOD
- **File**: `src/engine/scene/RackContainer.ts`, lines 25–57
```typescript
24:   public deviceMap = new Map<string, DeviceContainer>();
25:   public currentLOD = LODTier.STANDARD;
26: 
27:   constructor(rack: RackModel) {
...
43:     this.badgeContainer = new Container();
...
45:     this.addChild(this.badgeContainer);
...
56:     this.renderOverviewBadge(rack);
57:   }
```
- **Observed Behavior**:
  `RackContainer` creates `badgeContainer` and populates it via `renderOverviewBadge(rack)`. Newly instantiated Pixi `Container` instances have `visible = true` by default.
  `constructor` does NOT call `this.setLOD(LODTier.STANDARD)`.
  As a consequence, on rack creation (and app launch at 1.0x standard zoom), `rack.badgeContainer.visible === true` while `railsGraphics.visible === true` and `uSlotsContainer.visible === true`.
  Because `LODManager.evaluateScale(1.0)` starts at `STANDARD` and evaluates `1.0 -> STANDARD` with `changed = false`, `applyLOD` is never triggered on startup.
  The Overview Badge (`434x160px`) remains visible directly on top of the cabinet in Standard view.

#### Defect 2 (HIGH): Off-screen Rack LOD Desynchronization on Viewport Navigation
- **File**: `src/engine/scene/LODManager.ts`, line 67; `src/engine/scene/SceneGraph.ts`, lines 82–86
```typescript
// LODManager.ts:67
65:   public applyLOD(racks: Iterable<RackContainer>, force = false): void {
66:     for (const rack of racks) {
67:       if (rack.visible || force) {
68:         rack.setLOD(this._currentTier);
69:       }
70:     }
71:   }

// SceneGraph.ts:82
82:     // 2. 3-Tier LOD evaluation
83:     const { changed } = this.lodManager.evaluateScale(cameraZoom);
84:     if (changed) {
85:       this.lodManager.applyLOD(this.rackContainers.values());
86:     }
```
- **Observed Behavior**:
  When camera zoom changes (e.g. from 1.0 Standard to 1.5 Detailed), `lodManager.applyLOD` skips all racks where `rack.visible === false` (i.e. culled racks).
  When the user subsequently pans the camera to bring those off-screen racks into view (while maintaining 1.5x zoom), `culler.cullRacks` un-culls them (`rack.visible = true`), but `changed` in `evaluateScale` is `false`.
  Consequently, `setLOD` is never called on the newly visible rack.
  The newly visible rack enters the viewport with a stale LOD tier (e.g. `STANDARD` instead of `DETAILED`).
  Empirically proven in test `3.4`: `rack15.currentLOD` remained `STANDARD` after entering the viewport at 1.5x zoom.

---

## 2. Logic Chain

1. **Premise 1**: The Digital Rack Studio canvas initializes at `1.0x` zoom, representing `LODTier.STANDARD`.
2. **Observation from 1.3 (Defect 1)**: `RackContainer` initializes `currentLOD = LODTier.STANDARD`, but fails to execute `setLOD(LODTier.STANDARD)`. Pixi Containers default to `visible = true`. Therefore, `badgeContainer.visible` is `true`.
3. **Logic Step**: At `1.0x` zoom, `LODManager.evaluateScale(1.0)` yields `changed = false`. `applyLOD` is skipped. Thus, the Overview badge is displayed simultaneously with standard slots, obscuring user hardware.
4. **Premise 2**: In a multi-rack layout (e.g. 10 to 50 racks), off-screen racks are culled (`visible = false`) by `FrustumCuller`.
5. **Observation from 1.3 (Defect 2)**: `LODManager.applyLOD` has an early return condition `if (rack.visible || force)`. Racks that are off-screen during a zoom change are skipped.
6. **Logic Step**: When an off-screen rack is panned into view, `FrustumCuller.cullRacks` toggles `rack.visible = true`. However, neither `FrustumCuller` nor `SceneGraph.updateViewport` synchronizes the rack's LOD tier to `LODManager.currentTier` upon un-culling.
7. **Conclusion of Logic Chain**: The multi-rack rendering pipeline suffers from visual corruption upon startup (Defect 1) and visual state desynchronization upon panning after zoom transitions (Defect 2).

---

## 3. Caveats

- Tests were run under the Node v24 environment with Vitest and JSDOM / PixiJS headless mode. Full GPU driver rasterization and WebGPU shader compilation were simulated mathematically; actual GPU rendering artifacts (e.g. texture atlas re-binding) were not benchmarked on physical display hardware.
- No source code modifications were made to implementation files (`src/engine/scene/` and `src/engine/interaction/`), in adherence to the review-only constraint.

---

## 4. Conclusion

### Explicit Verdict: **REQUEST_CHANGES**

While core EIA-310-D slot snapping mathematics (bottom U1, top U42, multi-U height, fractional coordinate stability) and multi-rack frustum culling accuracy (100% over 10,000 checks) are robust and extremely performant (p95 drag latency = 5.5µs), two defects require fixes:

1. **Fix Defect 1 (`RackContainer.ts`)**:
   Add `this.setLOD(LODTier.STANDARD);` at the end of `RackContainer.constructor` to ensure `badgeContainer.visible` is initialized to `false` in Standard view.
2. **Fix Defect 2 (`SceneGraph.ts` / `LODManager.ts`)**:
   In `SceneGraph.updateViewport`, whenever `cullRacks` sets a rack to `visible = true` (or simply by passing `force = true` into `applyLOD`, or syncing newly visible racks to `this.lodManager.currentTier`), ensure un-culled racks immediately receive the active LOD tier.

---

## 5. Verification Method

To independently reproduce and verify the empirical results and defects:

1. **Run the Adversarial Stress Suite**:
   ```powershell
   $env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;$env:PATH"
   npx vitest run tests/benchmarks/adversarial_m2_2.test.ts
   ```
2. **Inspect Specific Defect Tests**:
   - `tests/benchmarks/adversarial_m2_2.test.ts:3.2` — Verifies `rack.badgeContainer.visible === true` upon construction.
   - `tests/benchmarks/adversarial_m2_2.test.ts:3.4` — Verifies `rack15.currentLOD === 'standard'` when entering the viewport at 1.5x zoom (`detailed`).
3. **Invalidation Conditions**:
   - Defect 1 is resolved when `new RackContainer(rack).badgeContainer.visible === false`.
   - Defect 2 is resolved when `rack15.currentLOD === LODTier.DETAILED` after entering the viewport at 1.5x zoom.
