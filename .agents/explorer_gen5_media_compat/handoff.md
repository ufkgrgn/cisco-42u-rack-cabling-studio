# Investigation Report: Requirement R1 (Port Connection & Physical Media Compatibility Verification)

**Author**: Explorer 1 (`explorer_gen5_media_compat`)  
**Timestamp**: 2026-09-18T06:58:00Z  
**Working Directory**: `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\explorer_gen5_media_compat`  
**Target Requirement**: R1 (Port Connection & Physical Media Compatibility Verification)

---

## 1. Observation

### 1.1 Tooltip Hover vs Click Handler Namespace Discrepancy
- In `js/2d/network-rules.js` line 373:
  ```javascript
  RS.NetworkRules = {
    isPassivePatchPanel,
    isUplinkPort,
    isFiberPort,
    isFiberConnection,
    detectFiberConnection,
    detectUplinkConnection,
    validateConnection
  };
  ```
  where line 11 defines `const RS = window.RackStudio = window.RackStudio || {};`. The rules engine is attached to `RackStudio.NetworkRules` (`RS.NetworkRules`). It is **never** assigned to `window.NetworkRules`.
- In `js/2d/rack-renderer.js` lines 1396–1398 (inside `handlePortHover`):
  ```javascript
  const validation = window.NetworkRules && typeof window.NetworkRules.validateConnection === 'function'
    ? window.NetworkRules.validateConnection(src, { instanceId, portId }, STATE, HARDWARE_CATALOG, false)
    : { allowed: true };
  ```
  Because `window.NetworkRules` is `undefined`, the condition is always `false`, evaluating unconditionally to `{ allowed: true }`.
- In `js/2d/rack-renderer.js` lines 1524–1526 (inside `handlePortClick`):
  ```javascript
  if (RS.NetworkRules && typeof RS.NetworkRules.validateConnection === 'function') {
    const validation = RS.NetworkRules.validateConnection(source, { rackId: devRack.id, instanceId, portId });
    if (!validation.allowed) {
      if (window.SoundFX && typeof window.SoundFX.playError === 'function') {
        window.SoundFX.playError();
      }
      if (dom.connectionStatusHint) {
        dom.connectionStatusHint.innerHTML = `<span style="color:#ef4444; font-weight:bold;">⛔ ${escapeHtml(validation.reason || 'Kural İhlali!')}</span>`;
      }
      const rect = portEl.getBoundingClientRect();
      showConnectionErrorToast(rect.left + rect.width / 2, rect.top, validation.reason || 'Bağlantı kuralı ihlali!');
      cancelPendingConnection();
      return;
    }
  ```
  Here `RS.NetworkRules` is defined and executed. When a user hovers over an illegal target (e.g. self-loop, copper RJ45 to optical SFP cage, or PDU AC power to Ethernet), the tooltip shows **GREEN** ("`🔗 Bağlantıyı Tamamla ... Bağlamak için tıklayın.`"). When the user clicks the port, `handlePortClick` executes `RS.NetworkRules.validateConnection`, detects the violation, triggers an error sound, shows a red toast error, and aborts the connection.

### 1.2 Inconsistent Strict Mode and Argument Signature
- In `js/2d/rack-renderer.js` line 1397, the hover call attempts to pass 5 arguments:
  `window.NetworkRules.validateConnection(src, { instanceId, portId }, STATE, HARDWARE_CATALOG, false)`
  with `maybeStrict = false` and missing `rackId: activeRack.id`.
- In `js/2d/rack-renderer.js` line 1525, the click handler passes:
  `RS.NetworkRules.validateConnection(source, { rackId: devRack.id, instanceId, portId })`
- In `js/2d/network-rules.js` lines 241–256:
  ```javascript
  function validateConnection(source, target, optionsOrState = {}, catalogMap = null, maybeStrict = null) {
    let strictMode = true;
    let stateRef = RS.STATE;
    let catalogRef = RS.HARDWARE_CATALOG;

    if (typeof optionsOrState === 'object' && optionsOrState !== null && optionsOrState.devices && Array.isArray(optionsOrState.devices)) {
      // Unit test signature: (source, target, state, catalogMap, strictMode)
      stateRef = optionsOrState;
      if (catalogMap) catalogRef = catalogMap;
      if (typeof maybeStrict === 'boolean') strictMode = maybeStrict;
    } else if (typeof optionsOrState === 'object' && optionsOrState !== null) {
      if (optionsOrState.strictMode !== undefined) strictMode = Boolean(optionsOrState.strictMode);
      else if (RS.STATE?.strictCompliance !== false) strictMode = true;
      else strictMode = false;
    }
  ```
  In runtime state (`RS.STATE`), devices are contained in `STATE.racks[i].devices`, so `optionsOrState.devices` does not exist. Even if `optionsOrState` is passed as `STATE`, the first `if` branch fails, falling into `else if` where `catalogMap` and `maybeStrict` are completely ignored. Furthermore, if `strictMode = false` was honored in the tooltip while being `true` on click, the tooltip would permit copper-to-fiber mismatches while click would reject them.

### 1.3 Optical SFP/QSFP Port Type Incomplete Normalization
- In `js/2d/network-rules.js` line 39:
  ```javascript
  if (cat && (pType === 'sfp' || pType === 'qsfp')) {
  ```
- In `js/2d/network-rules.js` line 149:
  ```javascript
  if (type === 'sfp') {
    const speed = String(port.speed || '').toLowerCase();
    if (speed.includes('fiber') || cat?.category === 'fiber-switch') return true;
    return true; // SFP optical cage default
  }
  ```
- In `js/2d/network-rules.js` lines 330–331:
  ```javascript
  const isSfpA = typeA === 'sfp' || typeA === 'qsfp' || typeA === 'qsfp28';
  const isSfpB = typeB === 'sfp' || typeB === 'qsfp' || typeB === 'qsfp28';
  ```
  In modern catalog devices and custom devices conforming to Schema V3 (defined in `PROJECT.md` line 119: `type: 'rj45' | 'sfp' | 'sfp+' | 'qsfp28' | 'c13' | 'c14' | 'terminal'`), port types can be `'sfp+'`, `'sfp28'`, or `'qsfp28'`. Lines 39 and 149 do not match `'sfp+'` or `'sfp28'`. When a port has `type: 'sfp+'`, `isFiberPort` returns `false`, causing `isFiberConnection` and `detectFiberConnection` to fail detection.

### 1.4 Switch-to-Switch Interconnections & Modal Lock
- In `js/2d/network-rules.js` lines 69–108:
  Any link between two switches sets `disallowStandard: true` and `requiresPrompt: true`.
- In `js/2d/rack-renderer.js` lines 453, 493–497:
  ```javascript
  const isSwitchToSwitch = !!(options.isSwitchToSwitch || options.disallowStandard);
  ...
  const footerButtonsHtml = isSwitchToSwitch
    ? `
      <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
      <button type="button" class="btn-primary" id="btn-uplink-approve" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border-color: #a855f7; box-shadow: 0 2px 14px rgba(124, 58, 237, 0.5);">✨ 802.1Q TRUNK Olarak Yapılandır</button>
    `
  ```
- In `js/2d/rack-renderer.js` lines 1684–1687:
  ```javascript
  if (detectedUplink.disallowStandard || detectedUplink.isSwitchToSwitch) {
    cancelPendingConnection();
    return;
  }
  ```
  When two switches are connected, the modal removes the "Standart Kablo Olarak Bağla" button, offering only "İptal" and "802.1Q TRUNK Olarak Yapılandır". Clicking "İptal" cancels the connection entirely. This contradicts Requirements R1 & R2 which state that standard access connections must be selectable without deadlock.

### 1.5 Cross-Connection Compatibility Across Switch Models and Patch Panels
- **Cisco Nexus 93180YC-FX** (`cisco-nexus-93180yc`): 48x SFP28 (`type: 'sfp'`), 6x QSFP28 (`type: 'sfp'`)
- **Cisco Catalyst 9500-24Y4C** (`cisco-9500-24y4c`): 24x SFP28 (`type: 'sfp'`), 4x QSFP28 (`type: 'sfp'`)
- **Cisco Catalyst 3850-24S-S** (`cisco-3850-24s`): 24x SFP (`type: 'sfp'`), 4x SFP+ (`type: 'sfp'`)
- **Cisco Catalyst 2960X-24PS-L** (`cisco-2960x-24ps`): 24x RJ45 (`type: 'rj45'`), 4x SFP (`type: 'sfp'`)
- **Cat6 RJ45 Patch Panels** (`patch-cat6-24`, `patch-cat6-48`): `type: 'rj45'`, `category: 'patch'`
- **OS2 LC Fiber ODF** (`fiber-odf-24-os2`), **OM4 LC Fiber ODF** (`fiber-odf-24`), **HCS DataLight** (`hcs-datalight-24`): `type: 'lc'`, `category: 'fiber'`
- **OS2 SC Fiber ODF** (`fiber-odf-24-sc`): `type: 'sc'`, `category: 'fiber'`

Validation outcome verification:
1. Switch SFP to OS2/OM4 LC ODF: Allowed (`isFiberConnection` = true, color `#facc15` SingleMode Yellow). Seamless, no blocking modal.
2. Switch SFP to OS2 SC ODF: Allowed (`isFiberConnection` = true, color `#facc15` SingleMode Yellow). Seamless, no blocking modal.
3. SC ODF to LC ODF cross-connect: Allowed (`allowed: true` with advisory pass-through notice).
4. Cat6 Patch Panel to Switch RJ45 access port: Allowed (`allowed: true`, standard cable color).
5. Switch RJ45 to Optical SFP cage or Optical LC/SC ODF: Blocked in strict mode (`type: 'media-mismatch'`).
6. Same-device switch/router loop: Blocked (`type: 'loop'`).
7. Same-panel patch pass-through / loopback: Allowed with advisory warning (`warning: 'Patch Panel Çapraz Aktarma'`).

---

## 2. Logic Chain

1. **Step 1 — Disconnect between hover and click**:
   - `network-rules.js` (line 373) assigns its exports exclusively to `RS.NetworkRules`.
   - `rack-renderer.js` (line 1396) checks `window.NetworkRules`.
   - Result: In the browser runtime, `window.NetworkRules` is `undefined`. Tooltip hover validation falls back to `{ allowed: true }` on line 1398.
   - Therefore, hover tooltip always renders lines 1422–1428 (green "Bağlantıyı Tamamla / Bağlamak için tıklayın.").
   - Meanwhile, line 1524 inside `handlePortClick` queries `RS.NetworkRules`, which is defined.
   - When the user clicks on an invalid port (such as a self-loop, copper-to-optical mismatch, or power port), `validateConnection` returns `allowed: false`.
   - Line 1526–1536 aborts the connection with error audio and toast.
   - This directly produces the defect reported in Requirement R1: green tooltip shown on hover, but error raised on click.

2. **Step 2 — Strict Mode Desynchronization**:
   - In line 1397, the hover call passed `false` as the 5th argument.
   - If `window.NetworkRules` had been resolved and honored this argument, hover would run in non-strict mode (ignoring media mismatches), while click runs in strict mode (enforcing media mismatches via `RS.STATE?.strictCompliance !== false`).
   - This guarantees that even with the namespace fixed, passing mismatched strictness flags causes tooltip and click behavior to diverge.
   - Both hover and click must evaluate the exact same state and strictness (`RS.STATE?.strictCompliance !== false`).

3. **Step 3 — Target Endpoint Structure**:
   - Line 1397 passed `{ instanceId, portId }` without `rackId: activeRack.id`.
   - Line 1525 passed `{ rackId: devRack.id, instanceId, portId }`.
   - Passing `rackId` ensures complete multi-rack resolution and consistency.

4. **Step 4 — SFP/QSFP Optical Recognition**:
   - `isFiberPort` in line 149 explicitly tests `if (type === 'sfp')`.
   - `PROJECT.md` PortDefinition interface specifies `'sfp' | 'sfp+' | 'qsfp28'`.
   - Any port definitions with `sfp+`, `sfp28`, `qsfp`, or `qsfp28` fail `type === 'sfp'`, resulting in missed fiber identification and misconfigured cable metadata.
   - Normalizing with an `isSfpCageType` helper solves this cleanly across all catalog definitions.

5. **Step 5 — Inter-switch Access Mode deadlock**:
   - `detectUplinkConnection` sets `disallowStandard: true` for all switch-to-switch links.
   - `showUplinkVisualConfirmModal` hides the standard connection button and cancels connection on modal dismiss.
   - Requirement R2 explicitly commands allowing users to choose standard access mode without deadlock.

---

## 3. Caveats

1. **Test Mock vs Runtime Implementation**:
   `tests/unit/network-compliance.test.ts` contains an embedded mock copy of `network-rules.js` with its own `validateConnection` implementation designed for `{ devices: [...] }`. Modifications in `js/2d/network-rules.js` must maintain backward compatibility with both the runtime `{ racks: [...] }` schema and unit test mock `{ devices: [...] }` schema.
2. **Read-Only Investigation Role**:
   As an exploration agent, no changes have been written to `js/` source files. All findings, exact line references, and remediation diffs are documented here for the implementation worker.
3. **Requirement R4 Dependency**:
   The failure in `tests/studio.test.cjs` line 75 (`assert.ok(svg.includes('cable-b (1m)'))`) is related to SVG export cable naming and is scoped to Requirement R4.

---

## 4. Conclusion

The core root cause of the media compatibility defect in Requirement R1 is a **dual-fault mismatch**:
1. **Namespace Bug**: Hover tooltip looks for `window.NetworkRules`, which is `undefined` (actual object is `window.RackStudio.NetworkRules`). As a result, tooltip validation is completely non-functional and always displays green ("Bağlamak için tıklayın"), while click handler queries `RS.NetworkRules` and triggers a rejection error.
2. **Parameter & Signature Asymmetry**: Tooltip passes `{ instanceId, portId }` with `false` for strict mode, while click handler passes `{ rackId, instanceId, portId }` and defaults to strict mode.
3. **Port Type Support Gaps**: `isFiberPort` and `isUplinkPort` only match literal `'sfp'` rather than all SFP variants (`sfp+`, `sfp28`, `qsfp`, `qsfp28`).

### Recommended Fix Strategy:
1. In `js/2d/network-rules.js`:
   - Add global alias: `window.NetworkRules = RS.NetworkRules;` alongside `RS.NetworkRules = { ... };`.
   - Add cage normalizer `isSfpCageType(type)` to match `sfp`, `sfp+`, `sfp28`, `qsfp`, `qsfp+`, `qsfp28`.
   - Use `isSfpCageType` in `isUplinkPort`, `isFiberPort`, and `validateConnection`.
   - Normalize parameter handling in `validateConnection` to accept both runtime `STATE` and unit-test mock states seamlessly.
2. In `js/2d/rack-renderer.js`:
   - Update line 1396 to use `(RS.NetworkRules || window.NetworkRules).validateConnection(src, { rackId: activeRack.id, instanceId, portId })`.
   - Do NOT pass `false` as strict mode parameter; let it follow `RS.STATE?.strictCompliance !== false` identically to the click handler.
   - For Requirement R2, restore the "Standart Kablo Olarak Bağla" option in `showUplinkVisualConfirmModal` so switch-to-switch links can be established as standard access if approved by the user.

---

## 5. Verification Method

### 5.1 Automated Test Verification
Run existing test suites:
- `npm run check`: Verifies syntax and TypeScript types across 2D/3D codebase.
- `npm run test:unit`: Runs Vitest test suites (ensures 319+ tests pass without regression).
- `npm run test:legacy`: Runs Playwright browser integration suite.

### 5.2 Independent Browser E2E Scenario Verification
In a headless or interactive browser session against `index.html`:
1. **Self-Loop Tooltip Check**:
   - Mount a `cisco-2960x-24ps` switch.
   - Click port `p1` (source selected).
   - Hover over port `p2` on the same switch.
   - **Verification**: Tooltip MUST show red `⛔ Bağlantı Uyumsuz: Fiziksel Döngü Engellendi!`. Must NOT show green `Bağlamak için tıklayın`.
2. **Media Mismatch Tooltip Check**:
   - Mount a `cisco-2960x-24ps` and a `fiber-odf-24-os2`.
   - Click copper port `p1` on the switch.
   - Hover over optical LC port `lc1` on the ODF.
   - **Verification**: Tooltip MUST show red `⛔ Bağlantı Uyumsuz: Fiziksel Konnektör Uyuşmazlığı! Bakır RJ45 portu ile Optik LC portu doğrudan bağlanamaz`. Must NOT show green `Bağlamak için tıklayın`.
3. **Valid Optical SFP to LC Connection**:
   - Click SFP uplink port `up1` on `cisco-2960x-24ps`.
   - Hover over optical LC port `lc1` on `fiber-odf-24-os2`.
   - **Verification**: Tooltip MUST show green `🔗 Bağlantıyı Tamamla`. Clicking port `lc1` MUST create a yellow SingleMode OS2 fiber cable (`#facc15`) without any console error or alert.
4. **Valid Copper Patch Connection**:
   - Click port `pt1` on `patch-cat6-24`.
   - Hover over port `p1` on `cisco-2960x-24ps`.
   - **Verification**: Tooltip MUST show green `🔗 Bağlantıyı Tamamla`. Clicking port `p1` MUST create a standard patch cable without error.
