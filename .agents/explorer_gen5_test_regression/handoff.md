# Handoff Report: Requirement R4 — Comprehensive Test Suite Regression Repair & Stabilization

## 1. Observation

### 1.1 Test Suite Execution Baseline
The following commands were run from the project root (`c:\Users\ufuk_\Documents\antigravity\fearless-einstein`):

1. **`npm run check`** (`npm run bundle && tsc --noEmit && npm run check:legacy`):
   - **Result**: PASSED (Exit Code: 0).
   - Bundles compiled: `js/studio3d.js` (126,003 bytes) and `js/studio3d-ui.js` (40,954 bytes).
   - TypeScript checks passed with 0 errors.
   - Syntax validation on `js/2d/app.js`, `js/editor.js`, and `js/catalog-ui.js` passed.

2. **`npm run test:unit`** (`vitest run`):
   - **Result**: PASSED (Exit Code: 0).
   - 25 test files passed (100%), 319 tests passed (100%), duration 3.99s.

3. **`npm run test:legacy`** (`node tests/studio.test.cjs && node --test tests/editor.test.cjs tests/catalog.test.cjs`):
   - **Result**: FAILED (Exit Code: 1) on `tests/studio.test.cjs:75:12`.
   - **Verbatim Error**:
     ```
     AssertionError [ERR_ASSERTION]: SVG uses active cable identity
         at C:\Users\ufuk_\Documents\antigravity\fearless-einstein\tests\studio.test.cjs:75:12
         at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
       generatedMessage: false,
       code: 'ERR_ASSERTION',
       actual: false,
       expected: true,
       operator: '==',
       diff: 'simple'
     }
     ```
   - Running the second part independently (`node --test tests/editor.test.cjs tests/catalog.test.cjs`) PASSED completely (3 tests passed, 0 failures, duration 4.93s).

4. **`npm test`** (`npm run test:unit && npm run test:legacy`):
   - **Result**: FAILED due to `npm run test:legacy`.

5. **`node tests/e2e/runner.cjs`** (E2E Test Suite Tiers 1–4):
   - **Result**: 325/327 tests passed (99.4%). Two failures in Tier 4 (`tests/e2e/tier4-real-world.test.cjs`):
     - Line 462: `R4.6: Custom vendor hardware defined, mounted, wired, and validated in schedule`:
       `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 1 !== 0.5`
     - Line 774: `R4.11: Multi-Category Cabling Schedule Audit computes metraj and generates CSV export format`:
       `AssertionError [ERR_ASSERTION]: Total cable length should be 45.5 meters: 4 !== 45.5`

### 1.2 Inspection of `tests/studio.test.cjs` (Lines 56–82)
```javascript
56:     await page.evaluate(() => {
57:       const api = window.RackStudio;
58:       const catalogKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
59:       const ports = api.catalog[catalogKey].ports;
60:       const racks = ['a','b'].map(id => ({id,name:'Rack -- <test> '+id,heightU:60,devices:[{instanceId:'dev-'+id,catalogKey,topU:60,uHeight:1}]}));
61:       const cables = ['a','b'].map(id => ({id:'cable-'+id,from:{rackId:id,instanceId:'dev-'+id,portId:ports[0].id},to:{rackId:id,instanceId:'dev-'+id,portId:ports[1].id},color:'#2563eb',lengthMeters:1}));
62:       api.loadCustomTopology({racks,cables,activeRackId:'b'});
63:       api.fit();
64:       const before = JSON.stringify(api.STATE.racks);
65:       try { api.loadCustomTopology({racks,cables:[...cables,{...cables[0],id:'duplicate-port'}]}); throw new Error('Accepted occupied port'); }
66:       catch (error) { if (error.message === 'Accepted occupied port') throw error; }
67:       if (before !== JSON.stringify(api.STATE.racks)) throw new Error('Bad cable import mutated project');
68:     });
69:     const downloadWait = page.waitForEvent('download');
70:     await page.locator('#btn-export-visio').click();
71:     const download = await downloadWait;
72:     const stream = await download.createReadStream();
73:     const chunks = []; for await (const chunk of stream) chunks.push(chunk);
74:     const svg = Buffer.concat(chunks).toString('utf8');
75:     assert.ok(svg.includes('cable-b (1m)'), 'SVG uses active cable identity');
76:     const validSvg = await page.evaluate(svg => !new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror'), svg);
77:     assert.ok(validSvg, 'SVG is valid XML with user punctuation');
78:     assert.ok(svg.includes('height="2000"'), '60U export height');
```

- In line 61, `cables` are constructed with `lengthMeters: 1`:
  `{ id: 'cable-b', from: { rackId: 'b', instanceId: 'dev-b', portId: ports[0].id }, to: { rackId: 'b', instanceId: 'dev-b', portId: ports[1].id }, color: '#2563eb', lengthMeters: 1 }`
- In line 75, the assertion requires `svg.includes('cable-b (1m)')`.
- Inspecting the generated SVG output reveals verbatim:
  ```xml
  <path d="M 211.50009155273438 15.99999713897705 C 199.50009155273438 15.99999713897705, 210.9999237060547 15.99999713897705, 222.9999237060547 15.99999713897705" stroke="#2563eb" stroke-width="2.8" class="v-cable" v:groupContext="shape">
    <title>cable-b (0.5m)</title>
  </path>
  ```
- The SVG contains `<title>cable-b (0.5m)</title>`, causing `svg.includes('cable-b (1m)')` to evaluate to `false`.

### 1.3 Inspection of `js/2d/topology-io.js` (Lines 91–106)
```javascript
91:     svgContent += `  <!-- LAYER 3: CABLING RUN SCHEDULE & CONNECTIONS -->\n  <g v:groupContext="layer" v:layerMember="Patch_Cables" transform="translate(40, 20)">\n`;
92:     const svgLayer = document.getElementById('cables-svg');
93:     if (svgLayer) {
94:       const paths = svgLayer.querySelectorAll('.cable-path');
95:       paths.forEach((p, idx) => {
96:         const d = p.getAttribute('d');
97:         const stroke = p.getAttribute('stroke');
98:         const cable = STATE.cables.find(c => 'svg-cable-' + c.id === p.id) || { id: 'CBL' };
99:         svgContent += `
100:           <path d="${d}" stroke="${stroke}" stroke-width="2.8" class="v-cable" v:groupContext="shape">
101:             <title>${cable.id} (${cable.lengthMeters}m)</title>
102:           </path>
103:         `;
104:       });
105:     }
106:     svgContent += `  </g>\n</svg>`;
```
- Line 101 formats the title as `<title>${cable.id} (${cable.lengthMeters}m)</title>`.
- `STATE.cables.find(c => 'svg-cable-' + c.id === p.id)` correctly matches `cable-b`.
- However, `cable.lengthMeters` in `STATE.cables` is `0.5`, not `1`.

### 1.4 Trace of `loadCustomTopology` and `renderAllCables` in `js/2d/cabling-engine.js`
In git commit `546f73de9073d90f1ddda63aa3e090e6a9820eb5` ("feat(cables): dynamic physical length calculation per routing path"), dynamic cable length assignment was introduced inside `renderAllCables()`:
- `cabling-engine.js:887`: `cable.lengthMeters = computeCableLength('interrack-direct', ...)`
- `cabling-engine.js:1025`: `cable.lengthMeters = computeCableLength('interrack-structured', ...)`
- `cabling-engine.js:1042`: `cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);`
- `cabling-engine.js:1135`: `cable.lengthMeters = computeCableLength('structured', ...)`
- `cabling-engine.js:1150`: `cable.lengthMeters = computeCableLength('direct', ...)`

When `loadCustomTopology({ racks, cables, activeRackId: 'b' })` runs:
1. `validateTopology(data)` in `topology-io.js:183-184` verifies that `c.lengthMeters` is finite and >= 0, and preserves `lengthMeters: 1` on the object.
2. `Object.assign(STATE, next)` assigns the cables to `STATE.cables` with `lengthMeters: 1`.
3. `loadCustomTopology` calls `refresh()` (`topology-io.js:214`).
4. `refresh()` invokes `renderAllCables()` (`topology-io.js:198`).
5. In `renderAllCables()` (`cabling-engine.js:1037-1043`):
   Because both endpoints of `cable-b` are on `dev-b` (`instA === instB`), the code executes:
   ```javascript
   if (instA === instB) {
     const loopSide = x1 > 300 ? 12 : -12;
     pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
     cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);
   }
   ```
   Both ports `ge0_0_0` and `ge0_0_1` are located on the same 1U router faceplate. Hence, `y1 === y2`, so `Math.abs(y2 - y1) === 0`.
   `Math.max(0.5, 0)` evaluates to `0.5`.
   `cable.lengthMeters` is unconditionally overwritten from `1` to `0.5`.
6. Furthermore, the same overwrite occurs in `dist/js/2d/cabling-engine.js:1042`.

### 1.5 Console Errors Investigation
Headless Playwright execution across all studio actions:
- Preset loading (`loadMdfPreset`, `loadIdfPreset`)
- Device mounting & unmounting
- Cable creation (`addDirectCable`) and deletion
- Rack switching (`switchActiveRack`), rack adding (`addRack`), rack resizing
- JSON project export (`exportJson`) and import (`loadCustomTopology`)
- Visio SVG export (`exportVisioSvg`)
Result: `pageerror` count = 0. No unhandled exceptions or console errors were generated by application logic. (Only standard Web Audio warning before user interaction).

---

## 2. Logic Chain

1. **Step 1 (Test Expectation)**: `tests/studio.test.cjs:61` imports a topology with two cables, each with `lengthMeters: 1`. Line 75 asserts that the Visio SVG contains `'cable-b (1m)'`.
2. **Step 2 (Data Integrity Contract)**: Acceptance criteria in `ORIGINAL_REQUEST.md` (line 56) and `PROJECT.md` (line 92) mandate that exported and imported topology files retain 100% data fidelity. An imported cable with an explicit `lengthMeters: 1` must preserve its `lengthMeters`.
3. **Step 3 (The Overwrite Defect)**: Commit `546f73d` added automatic length calculation to `renderAllCables()`. Because `renderAllCables()` runs on every `api.refresh()`, it unconditionally recomputes `cable.lengthMeters` for every rendered cable, wiping out any pre-existing or imported `lengthMeters`.
4. **Step 4 (The Loopback Calculation Delta)**: For `cable-b`, `instA === instB` on device `dev-b`. Line 1042 computes `Math.max(0.5, Math.round(Math.abs(y2 - y1) * ...))`. Because `y1 === y2` for ports on the same 1U device, `Math.abs(y2 - y1) === 0`, and the minimum bound `0.5` is assigned.
5. **Step 5 (Visio SVG Title Formulation)**: When `exportVisioSvg()` queries the DOM `.cable-path` elements and finds `cable-b` in `STATE.cables`, it reads `cable.lengthMeters` (which was mutated to `0.5`), producing `<title>cable-b (0.5m)</title>`.
6. **Step 6 (Failure Propagation)**:
   - In `tests/studio.test.cjs:75`: `svg.includes('cable-b (1m)')` fails because `'cable-b (0.5m)'` is present instead of `'cable-b (1m)'`.
   - In `tests/e2e/tier4-real-world.test.cjs:462`: Pre-set `lengthMeters: 0.5` between non-adjacent switches is overwritten with `1.0`, failing `1 !== 0.5`.
   - In `tests/e2e/tier4-real-world.test.cjs:774`: 8 audit cables with total length `45.5m` on the same device are all overwritten to `0.5m` (total = `4.0m`), failing `4 !== 45.5`.
7. **Step 7 (Simulation Verification)**: When `renderAllCables()` is prevented from overwriting pre-existing `cable.lengthMeters` if already defined, `studio.test.cjs` passes 100% of its assertions immediately.

---

## 3. Caveats

1. **Dynamic Length Recalculation on User Route Edits**:
   While imported and explicitly set cable lengths must not be clobbered during routine rendering, user-initiated route modifications (such as clicking `toggleCableDuctSide` or dragging a connected device to a different rack unit) SHOULD update the cable's physical length.
   - For device moves, `js/2d/app.js:174 & 189` already calls `RS.calculateCableLengthMeters` explicitly.
   - For duct toggling, `toggleCableDuctSide` in `js/2d/cabling-engine.js:152` should clear or recalculate the cable length prior to calling `renderAllCables()`.
2. **Synchronizing `js/2d/` and `dist/js/2d/`**:
   The project has dual files in `js/2d/` and `dist/js/2d/`. `package.json` includes `scripts/copy-dist-assets.cjs` which copies `js/` to `dist/js/` during `npm run build`. However, during zero-build development (`index.html`), edits must be applied to `js/2d/` (and copied or mirrored to `dist/js/2d/` if tested against `dist`).

---

## 4. Conclusion

The regression in `tests/studio.test.cjs` (and the two Tier 4 E2E failures) is caused by `renderAllCables()` in `js/2d/cabling-engine.js` (lines 887, 1025, 1042, 1135, 1150) unconditionally overwriting `cable.lengthMeters` with dynamically computed geometry values on every render cycle, clobbering pre-existing / imported cable lengths.

### Proposed Code Changes for Implementer

#### Target File 1: `js/2d/cabling-engine.js` (and `dist/js/2d/cabling-engine.js`)

**Lines 887, 1025, 1042, 1135, 1150**: Only assign auto-computed length if `cable.lengthMeters` is not already defined (`cable.lengthMeters == null`):

```javascript
// Before (Line 887):
cable.lengthMeters = computeCableLength('interrack-direct', { x1, y1, x2, y2, overheadY });

// After:
if (cable.lengthMeters == null) {
  cable.lengthMeters = computeCableLength('interrack-direct', { x1, y1, x2, y2, overheadY });
}
```

```javascript
// Before (Line 1025):
cable.lengthMeters = computeCableLength('interrack-structured', {
  x1, y1, x2, y2,
  channelXA, channelXB,
  trayYA: actualTrayYA, trayYB: actualTrayYB,
  overheadTrayY
});

// After:
if (cable.lengthMeters == null) {
  cable.lengthMeters = computeCableLength('interrack-structured', {
    x1, y1, x2, y2,
    channelXA, channelXB,
    trayYA: actualTrayYA, trayYB: actualTrayYB,
    overheadTrayY
  });
}
```

```javascript
// Before (Line 1042):
cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);

// After:
if (cable.lengthMeters == null) {
  cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);
}
```

```javascript
// Before (Line 1135):
cable.lengthMeters = computeCableLength('structured', {
  x1, y1, x2, y2,
  channelX,
  trayYA: actualTrayYA, trayYB: actualTrayYB,
  hasOrganizer: !!(orgA || orgB)
});

// After:
if (cable.lengthMeters == null) {
  cable.lengthMeters = computeCableLength('structured', {
    x1, y1, x2, y2,
    channelX,
    trayYA: actualTrayYA, trayYB: actualTrayYB,
    hasOrganizer: !!(orgA || orgB)
  });
}
```

```javascript
// Before (Line 1150):
cable.lengthMeters = computeCableLength('direct', { x1, y1, x2, y2, sag: tightSag });

// After:
if (cable.lengthMeters == null) {
  cable.lengthMeters = computeCableLength('direct', { x1, y1, x2, y2, sag: tightSag });
}
```

#### Target File 2: `toggleCableDuctSide` in `js/2d/cabling-engine.js` (Line 152–163)
To maintain live length updates when a user deliberately toggles duct routing:
```javascript
  function toggleCableDuctSide(cableId) {
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;
    const current = cable.ductSide || 'auto';
    const next = current === 'auto' ? 'left' : (current === 'left' ? 'right' : 'auto');
    cable.ductSide = next;
    // Clear lengthMeters so renderAllCables recomputes it for the new duct side
    delete cable.lengthMeters;

    STATE.highlightedCableId = cableId;
    renderAllCables();
    ...
```

---

## 5. Verification Method

Once the changes are implemented, run the following verification suite in order:

1. **Validate Syntax & Bundles**:
   ```bash
   npm run check
   ```
   *Expected*: Exit code 0, 0 TypeScript errors, 0 syntax check errors.

2. **Verify Legacy E2E Test Suite (Fix Verification for R4)**:
   ```bash
   npm run test:legacy
   ```
   *Expected*: `tests/studio.test.cjs`, `tests/editor.test.cjs`, and `tests/catalog.test.cjs` all pass with exit code 0.

3. **Verify Unit & Performance Benchmarks**:
   ```bash
   npm run test:unit
   ```
   *Expected*: 25/25 test files passed, 319/319 tests passed.

4. **Verify Complete E2E Tier Suite**:
   ```bash
   node tests/e2e/runner.cjs
   ```
   *Expected*: All 4 tiers pass (327/327 tests passed), exit code 0.

5. **Verify Top-Level Test Script**:
   ```bash
   npm test
   ```
   *Expected*: Exit code 0.

6. **Invalidation Conditions**:
   If `tests/studio.test.cjs` still fails on line 75 with `AssertionError: SVG uses active cable identity`, verify whether `dist/js/2d/cabling-engine.js` is also updated or if browser caching is serving an unmodified copy.
