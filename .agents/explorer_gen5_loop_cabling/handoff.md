# Explorer 2 Investigation Report: Requirements R2 & R3
**Date**: 2026-09-18
**Author**: Explorer 2 (`explorer_gen5_loop_cabling`)
**Mission**: Investigation of Requirement R2 (Loop Protection, Switch-to-Switch Access & Uplink Calibration) and Requirement R3 (Structured Cabling & Patch Panel - Switch Integration).

---

## 1. Observation

### 1.1 Requirement R2: Loop Detection & The Tooltip-Click Discrepancy
- In `js/2d/network-rules.js` (lines 293–307), `validateConnection` checks self-loops:
  ```javascript
  // 2. SELF-LOOP VALIDATION:
  // Passive Patch Panels / ODFs allow intra-panel cross-connects (pass-through / loopback test) with an advisory warning.
  // Active devices (Switches, Routers, Servers) strictly disallow same-device loops (STP / Broadcast Storm protection).
  let loopWarning = null;
  if (source.instanceId === target.instanceId) {
    if (isPatchA) {
      loopWarning = '⚠️ Patch Panel Çapraz Aktarma: Aynı panel üzerinde port köprüleme (cross-connect / loopback) yapıldı.';
    } else {
      return {
        allowed: false,
        type: 'loop',
        reason: 'Fiziksel Döngü Engellendi! Aynı aktif cihazın (Switch/Router) iki portu birbirine bağlanamaz (Loop / STP koruması).'
      };
    }
  }
  ```
- In `js/2d/network-rules.js` (lines 373–381), the module exports its API:
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
  **Direct Observation:** `network-rules.js` attaches `NetworkRules` exclusively to `RS.NetworkRules` (where `RS = window.RackStudio`). It NEVER attaches `window.NetworkRules = RS.NetworkRules`.
- In `js/2d/rack-renderer.js` (lines 1396–1428) inside `handlePortHover`:
  ```javascript
  const validation = window.NetworkRules && typeof window.NetworkRules.validateConnection === 'function'
    ? window.NetworkRules.validateConnection(src, { instanceId, portId }, STATE, HARDWARE_CATALOG, false)
    : { allowed: true };

  if (!validation.allowed) {
    dom.tooltip.innerHTML = `
      <div style="font-weight:800; font-size:0.75rem; color:#ef4444; border-bottom:1px solid #7f1d1d; padding-bottom:3px; margin-bottom:4px;">
        ⛔ Bağlantı Uyumsuz
      </div>
      <div style="color:#f87171; font-size:0.68rem; line-height:1.3;">${escapeHtml(validation.reason || 'Bu porta bağlanamaz')}</div>
    `;
    return;
  }
  ...
  dom.tooltip.innerHTML = `
    <div style="font-weight:800; font-size:0.75rem; color:#22c55e; border-bottom:1px solid #14532d; padding-bottom:3px; margin-bottom:4px;">
      🔗 Bağlantıyı Tamamla
    </div>
    <div style="color:#cbd5e1; font-size:0.68rem;"><b>Hedef:</b> ${escapeHtml(cat.modelTag || cat.name)} · <b>${escapeHtml(portName)}</b></div>
    <div style="color:#86efac; font-size:0.65rem; margin-top:2px;">Bağlamak için tıklayın.</div>
  `;
  ```
  Because `window.NetworkRules` is `undefined`, `validation` ALWAYS falls back to `{ allowed: true }`! Hovering over ANY invalid port (such as a physical self-loop on the same switch or copper-to-fiber mismatch) displays a green "🔗 Bağlantıyı Tamamla / Bağlamak için tıklayın" tooltip.
- But in `js/2d/rack-renderer.js` (lines 1524–1537) inside `handlePortClick`:
  ```javascript
  if (RS.NetworkRules && typeof RS.NetworkRules.validateConnection === 'function') {
    const validation = RS.NetworkRules.validateConnection(source, { rackId: devRack.id, instanceId, portId });
    if (!validation.allowed) {
      if (window.SoundFX && typeof window.SoundFX.playError === 'function') {
        window.SoundFX.playError();
      }
      ...
      showConnectionErrorToast(rect.left + rect.width / 2, rect.top, validation.reason || 'Bağlantı kuralı ihlali!');
      cancelPendingConnection();
      return;
    }
  }
  ```
  Here `RS.NetworkRules` is used, so the click fails, buzzes, and cancels! This creates a direct contradiction between the hover tooltip state and the click execution.

---

### 1.2 Requirement R2: Switch-to-Switch Disallow Standard Access & Deadlock Logic Trap
- In `js/2d/network-rules.js` (lines 66–108):
  ```javascript
  // CRITICAL: Switch-to-Switch Interconnection Rules (Loop / STP Protection)
  // Connecting two switches with standard access mode is strictly forbidden to prevent broadcast storms & loops.
  // ANY switch-to-switch link must require confirmation and only be provisioned as 802.1Q TRUNK / UPLINK.
  if (isSrcSwitch && isTgtSwitch) {
    if (isFiber) {
      return {
        isUplink: true,
        isTrunk: true,
        isFiber: true,
        isSwitchToSwitch: true,
        disallowStandard: true,
        role: 'trunk',
        color: FIBER_SINGLEMODE_YELLOW,
        prefix: '[TRUNK-FIBER]',
        reason: 'Switchler Arası Optik Fiber Trunk Hattı (Loop / STP Koruması). Standart Access moda izin verilmez!',
        requiresPrompt: true
      };
    }
    if (isSrcUplink && isTgtUplink) {
      return {
        isUplink: true,
        isTrunk: true,
        isSwitchToSwitch: true,
        disallowStandard: true,
        role: 'uplink',
        color: '#00d2ff',
        prefix: '[UPLINK]',
        reason: 'Switchler Arası Donanımsal Uplink Port Hattı (Loop / STP Koruması). Standart Access moda izin verilmez!',
        requiresPrompt: true
      };
    }
    return {
      isUplink: false,
      isTrunk: true,
      isSwitchToSwitch: true,
      disallowStandard: true,
      role: 'trunk',
      color: '#7c3aed',
      prefix: '[TRUNK]',
      reason: 'Switchler Arası 802.1Q Trunk Hattı (Loop / STP Koruması). Standart Access moda izin verilmez!',
      requiresPrompt: true
    };
  }
  ```
  Every single switch-to-switch link has `disallowStandard: true` and `requiresPrompt: true`.
- In `js/2d/rack-renderer.js` (lines 453–501) inside `showUplinkVisualConfirmModal`:
  ```javascript
  const isSwitchToSwitch = !!(options.isSwitchToSwitch || options.disallowStandard);
  ...
  const choiceCardsHtml = isSwitchToSwitch
    ? `
      <div class="uplink-choice-card recommended" id="opt-uplink-recommend" style="border-color: rgba(124, 58, 237, 0.65); background: linear-gradient(180deg, rgba(124, 58, 237, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%);">
        <span class="choice-tag" style="background: rgba(124, 58, 237, 0.25); color: #c084fc; border: 1px solid rgba(124, 58, 237, 0.5);">ZORUNLU AĞ STANDARDI</span>
        <div class="choice-title" style="color:#c084fc;">✨ 802.1Q TRUNK Olarak Yapılandır</div>
        <div class="choice-desc">
          Tüm VLAN trafiği güvenle taşınır, STP / Loop koruması aktif tutulur, omurga portu rozeti atanır ve mor/neon kablo rengi uygulanır.
        </div>
      </div>
    `
    : `
      <div class="uplink-choice-card recommended" id="opt-uplink-recommend">...</div>
      <div class="uplink-choice-card" id="opt-uplink-standard">
        <span class="choice-tag gray">MANUEL / ACCESS</span>
        <div class="choice-title">Standart Kablo Olarak Bağla</div>
        ...
      </div>
    `;

  const footerButtonsHtml = isSwitchToSwitch
    ? `
      <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
      <button type="button" class="btn-primary" id="btn-uplink-approve" ...>✨ 802.1Q TRUNK Olarak Yapılandır</button>
    `
    : `
      <button type="button" class="btn-secondary" id="btn-uplink-standard">Standart Kablo Olarak Bağla</button>
      <button type="button" class="btn-primary" id="btn-uplink-approve">✨ ${roleName} Olarak Yapılandır</button>
    `;
  ```
  When `isSwitchToSwitch` is true, the modal completely hides the Standard Access option and displays only "İptal" and "✨ 802.1Q TRUNK Olarak Yapılandır".
- In `js/2d/rack-renderer.js` (lines 1792–1798):
  ```javascript
  showUplinkVisualConfirmModal({ ... }, (approved) => {
    if (isSwitchToSwitch && !approved) {
      cancelPendingConnection();
      return;
    }
    commitConnection(approved);
  });
  ```
  If `approved` is false (e.g. user canceled or pressed Escape), `cancelPendingConnection()` is called.
- In `js/2d/rack-renderer.js` (lines 1683–1691) inside `commitConnection`:
  ```javascript
  } else {
    if (detectedUplink.disallowStandard || detectedUplink.isSwitchToSwitch) {
      cancelPendingConnection();
      return;
    }
    effectiveRole = 'standard';
    effectiveColor = STATE.selectedCableColor;
    isTrunk = false;
  }
  ```
  Even if `commitConnection(false)` were called, line 1684 forcibly cancels the connection!
  It is mathematically and logically impossible for a user to create a Standard Access connection between two switches.

---

### 1.3 Requirement R3: Patch Panel & Fiber ODF Catalog Modeling
- In `js/2d/catalog.js`:
  - `patch-cat6-24` (lines 496–513): `name: 'Cat6A 24-Port Patch Panel'`, `category: 'patch'`, `modelTag: 'CAT6A 24P-UTP'`, ports: `pt1..pt24`, type: `'rj45'`.
  - `patch-cat6-48` (lines 514–531): `name: 'Cat6 48-Port Yüksek Yoğunluk Panel'`, `category: 'patch'`, `modelTag: 'CAT6-48P-HD'`, ports: `pt1..pt48`, type: `'rj45'`.
  - `fiber-odf-24` (lines 532–549): `name: '24-Port OM4 Fiber Dağıtım Paneli (ODF)'`, `category: 'fiber'`, `modelTag: 'OM4 LC-DUPLEX'`, ports: `lc1..lc24`, type: `'lc'`.
  - `fiber-odf-24-os2` (lines 550–567): `name: '24-Port OS2 Singlemode Fiber Paneli (ODF)'`, `category: 'fiber'`, `modelTag: 'OS2 LC-DUPLEX'`, ports: `lc1..lc24`, type: `'lc'`.
  - `fiber-odf-24-sc` (lines 568–585): `name: '24-Port OS2 SC Duplex Fiber Paneli (ODF)'`, `category: 'fiber'`, `modelTag: 'OS2 SC-DUPLEX'`, ports: `sc1..sc24`, type: `'sc'`.
  - `hcs-datalight-24` (lines 586–603): `name: 'HCS DataLight Fiber Patch Panel'`, `category: 'fiber'`, `modelTag: 'HCS-DATALIGHT-24'`, ports: `f1..f24`, type: `'lc'`.
- In `js/2d/rack-renderer.js` (lines 842–964):
  - `renderSwitchOrPatchFaceplate`:
    - Differentiates `isPatchPanel` (`cat.category === 'patch' || isFiberPanel`).
    - Renders integrated compact bezel (~74px) with model tag and type badges (`Cat6A`, `Cat6`, `SC Duplex`, `LC Duplex`, `OS2`, `OM4`).
    - Displays `patch-id-strip` for port ranges (e.g. `Port 1 - Port 6`, `LC-01 - LC-04`).
  - `renderPortIcon` (lines 1017–1031):
    - Renders `.port-rj45`, `.port-lc` (with dual ferrule elements), `.port-sc` (with dual ferrule elements).
    - In `css/rack.css` (lines 980–1074), connected fiber ferrules glow yellow (`#facc15`).

---

### 1.4 Requirement R3: Port Synchronization Deficiencies
- **Port ID prefix mismatches and corrupted 3D port indices:**
  In `js/2d/rack-renderer.js` (lines 1621 & 1740–1741):
  ```javascript
  targetDev.portsConfig[String(portId).replace(/^p/i, '')] = inheritedCfg;
  ```
  ```javascript
  const pIdxSrc = parseInt(String(source.portId).replace(/^p/i, ''), 10) || 1;
  const pIdxTgt = parseInt(String(portId).replace(/^p/i, ''), 10) || 1;
  ```
  When `portId` is a patch panel or fiber port (`pt5`, `lc5`, `sc5`, `fa5`, `sfp5`):
  `String('pt5').replace(/^p/i, '')` returns `'t5'`.
  `parseInt('t5', 10)` returns `NaN`, which defaults to `1`!
  As a result:
  1) `targetDev.portsConfig` is polluted with invalid keys like `'t5'`.
  2) When syncing to 3D via `window.__STUDIO3D__.updatePortConfig(dev3DTgt, pIdxTgt, ...)`, every single patch panel or ODF port is passed as port index `1`!
- **Orphaned configuration on port reset:**
  In `js/2d/app.js` (lines 388–411):
  ```javascript
  const pIdStr = String(portId || '');
  const isNumericPort = /^p\d+$/i.test(pIdStr) || /^\d+$/.test(pIdStr);
  ...
  if (isReset) {
    delete dev.portsConfig[pIdStr];
    if (isNumericPort) {
      delete dev.portsConfig[pNumStr];
      delete dev.portsConfig['p' + pNumStr];
    }
  ```
  For patch panel port `pt1`, `isNumericPort` is `false`. Therefore `dev.portsConfig['t1']` (created on connection) is NEVER deleted on reset. In `renderPortIcon` (lines 1037–1040), `dev.portsConfig['t1']` is still found, leaving the port badge and color permanently stuck!
- **Cable search failure when using numeric port ID:**
  In `js/2d/app.js` (lines 490–493):
  ```javascript
  const connectedCable = STATE.cables.find(c =>
    (c.from.instanceId === instanceId && (c.from.portId === portId || (isNumericPort && String(c.from.portId).replace(/^p/i, '') === pNumStr))) ||
    (c.to.instanceId === instanceId && (c.to.portId === portId || (isNumericPort && String(c.to.portId).replace(/^p/i, '') === pNumStr)))
  );
  ```
  If `portId` is passed as `1` or `'1'`, `isNumericPort` is true, but `String('pt1').replace(/^p/i, '')` is `'t1'` (`'t1' !== '1'`). The cable is not found!
- **VLAN loss in Schedule Table role changer:**
  In `js/2d/schedule-table.js` (lines 95 & 118):
  ```javascript
  const cfg = { role: roleKey, isTrunk: isTrunkRole, color: resolvedColor, autoCableColor: true };
  delete devA.portsConfig['p' + pIdA];
  devA.portsConfig[pIdA] = cfg;
  ```
  Changing a connection role in the schedule table overwrites `portsConfig` without preserving existing `vlan`, `ciscoName`, or `description`.
- **Remote endpoint fallback in `renderPortIcon`:**
  In `js/2d/rack-renderer.js` (lines 1046–1062):
  If `portCfg` is not found on a passive patch panel port, the fallback derives role only from `connCable.role` or `connCable.color`. It never inspects the connected remote device's `portsConfig` to inherit the remote switch's `vlan` or `description`.

---

## 2. Logic Chain

### 2.1 Logic Chain for Requirement R2 (Loop Protection & Switch-to-Switch Calibration)
1. **Fact (Observation 1.1):** `network-rules.js` defines `validateConnection` on `RS.NetworkRules`. `window.NetworkRules` is undefined.
2. **Inference:** In `rack-renderer.js` line 1396, the check `window.NetworkRules && typeof window.NetworkRules.validateConnection === 'function'` evaluates to false.
3. **Consequence:** During mouse hover, all port connections (even self-loops and media mismatches) are reported as valid (`{ allowed: true }`), displaying a green tooltip. When clicked, line 1525 executes `RS.NetworkRules.validateConnection` which rejects the loop and triggers an error toast. This produces the defect: *"Tooltip yeşil gösteriyor ama tıklayınca hata veriyor"*.
4. **Fact (Observation 1.2):** In `network-rules.js` (lines 69–108), switch-to-switch links set `disallowStandard: true`.
5. **Fact (Observation 1.2):** In `rack-renderer.js` (lines 453–501), `isSwitchToSwitch` hides `opt-uplink-standard` and `btn-uplink-standard`, showing only Trunk or Cancel.
6. **Fact (Observation 1.2):** In `rack-renderer.js` (line 1793 and line 1684), any decision other than Trunk approval aborts and cancels the connection.
7. **Consequence:** Users cannot provision a standard access cable between switches. The modal acts as a logic deadlock/trap.
8. **Conclusion for R2:** To satisfy Requirement R2, switch-to-switch handling must allow user selection of Standard Access in the confirmation modal, and hover validation must properly invoke `RS.NetworkRules.validateConnection` using the active strictness settings.

### 2.2 Logic Chain for Requirement R3 (Structured Cabling & Port Synchronization)
1. **Fact (Observation 1.3):** Patch panels use IDs `pt1..pt48`, and fiber ODFs use `lc1..lc24` and `sc1..sc24`.
2. **Fact (Observation 1.4):** Throughout `rack-renderer.js` and `app.js`, port number extraction uses `replace(/^p/i, '')` and regex `/^p\d+$/i`.
3. **Inference:** For `pt1`, `replace(/^p/i, '')` produces `'t1'`. For `lc1` and `sc1`, it produces `'lc1'` and `'sc1'`.
4. **Consequence A (3D sync corruption):** `parseInt('t1', 10)` evaluates to `NaN` and defaults to `1`. In 3D, all patch panel ports sync as port 1.
5. **Consequence B (Stuck port config):** When resetting a port, `isNumericPort` is false for `'pt1'`, so the key `'t1'` in `portsConfig` is never deleted, leaving the UI badge stuck.
6. **Consequence C (Cable lookup failure):** Passing port index `1` to `updatePortConfig` fails to match `'pt1'`.
7. **Fact (Observation 1.4):** `schedule-table.js` replaces `portsConfig` without preserving `vlan`.
8. **Conclusion for R3:** Bidirectional synchronization requires robust digit extraction (`replace(/\D+/g, '')`) across all port ID prefixes (`pt`, `lc`, `sc`, `fa`, `sfp`, `p`), preserving VLAN and description during schedule updates, and allowing fallback inspection of the remote endpoint's `portsConfig`.

---

## 3. Caveats
- No caveats regarding code locations: all relevant files (`network-rules.js`, `rack-renderer.js`, `cabling-engine.js`, `app.js`, `schedule-table.js`, `catalog.js`, `presets.js`, `css/rack.css`) were directly inspected and verified.
- Note on testing: `tests/unit/network-compliance.test.ts` contains an internal mock implementation of `validateConnection` where lines 286, 315, and 479 currently assert `expect(disallowStandard).toBe(true)`. When implementing the fix for R2 to allow standard access, this unit test file will need its assertions updated to reflect that standard access is selectable.

---

## 4. Conclusion & Recommended Fix Strategy

### 4.1 Root Causes Identified

| Issue ID | File & Lines | Root Cause | Impact |
|---|---|---|---|
| **BUG-R2-1** | `js/2d/rack-renderer.js:1396–1398` | Uses `window.NetworkRules` which is `undefined` (actual object is `RS.NetworkRules`). Also passes hardcoded `false` for strictMode. | Tooltip shows green "Bağlamak için tıklayın" on loops and invalid media, but clicking fails and shows error toast. |
| **BUG-R2-2** | `js/2d/network-rules.js:69–108` | Hardcoded `disallowStandard: true` on all switch-to-switch links. | Forbids standard access cables between switches. |
| **BUG-R2-3** | `js/2d/rack-renderer.js:466–501` | Modal hides `opt-uplink-standard` and `btn-uplink-standard` when `isSwitchToSwitch` is true. | User is denied choice; only Trunk or Cancel is offered. |
| **BUG-R2-4** | `js/2d/rack-renderer.js:1684–1687, 1793` | Hard abort `if (isSwitchToSwitch && !approved) { cancelPendingConnection(); return; }` and in `commitConnection`. | Logic trap: selecting cancel or anything non-trunk aborts the connection. |
| **BUG-R3-1** | `js/2d/rack-renderer.js:1740–1741` | `parseInt(String(portId).replace(/^p/i, ''), 10)` returns `NaN` for `pt`, `lc`, `sc`, `fa`, `sfp` ports, defaulting to 1. | 3D engine receives port index 1 for all patch panel and ODF ports. |
| **BUG-R3-2** | `js/2d/rack-renderer.js:1621` & `js/2d/app.js:388–411, 489–525` | Use of `replace(/^p/i, '')` creates garbage key `'t1'` on patch panels (`pt1`), which is not cleaned up on reset (`isNumericPort` is false). | Port badges and colors get permanently stuck on patch panels after reset. |
| **BUG-R3-3** | `js/2d/schedule-table.js:95, 118` | Overwrites `portsConfig` without preserving existing `vlan` or `description`. | Changing cable role from schedule table wipes VLAN metadata. |
| **BUG-R3-4** | `js/2d/rack-renderer.js:1046–1062` | Fallback port config only checks cable role/color; ignores remote device's `portsConfig`. | Passive patch panel ports connected to configured switch ports don't display remote VLAN badge if config was not directly copied. |

---

### 4.2 Step-by-Step Fix Recommendations for Implementation Track

#### Fix for R2:
1. **Export `window.NetworkRules = RS.NetworkRules` in `js/2d/network-rules.js`:**
   At line 381, add `window.NetworkRules = RS.NetworkRules;` so both `RS.NetworkRules` and `window.NetworkRules` are defined.
2. **Fix tooltip validation in `js/2d/rack-renderer.js`:**
   In `handlePortHover` (lines 1396–1398), replace:
   ```javascript
   const rules = RS.NetworkRules || window.NetworkRules;
   const strict = STATE.strictCompliance !== false;
   const validation = rules && typeof rules.validateConnection === 'function'
     ? rules.validateConnection(src, { instanceId, portId }, STATE, HARDWARE_CATALOG, strict)
     : { allowed: true };
   ```
3. **Enable Standard Access in `network-rules.js` for Switch-to-Switch:**
   Change `disallowStandard: false` (or remove `disallowStandard: true`).
   Update `reason` string to: `'Switchler Arası Bağlantı (802.1Q Trunk önerilir, Standart Access seçilebilir)'`.
4. **Enable Standard Access choice in `showUplinkVisualConfirmModal`:**
   In `rack-renderer.js` lines 466–501:
   Display BOTH choice cards (`opt-uplink-recommend` and `opt-uplink-standard`) even when `isSwitchToSwitch` is true.
   Include a clear warning badge on standard card (e.g. `⚠️ DİKKAT: ACCESS MOD`).
   In the footer, render:
   - "İptal" (`btn-uplink-cancel` -> `onDecision('cancel')`)
   - "Standart Access Olarak Bağla" (`btn-uplink-standard` -> `onDecision('standard')`)
   - "✨ 802.1Q TRUNK Olarak Yapılandır" (`btn-uplink-approve` -> `onDecision('trunk')`)
5. **Update modal callback signature in `rack-renderer.js`:**
   Change `onDecision(approved)` to `onDecision(action)`:
   - If `action === 'cancel'`: call `cancelPendingConnection(); return;`
   - If `action === 'standard'`: call `commitConnection(false);`
   - If `action === 'trunk'`: call `commitConnection(true);`
6. **Remove deadlock in `commitConnection`:**
   Delete lines 1684–1687:
   ```javascript
   // REMOVE:
   if (detectedUplink.disallowStandard || detectedUplink.isSwitchToSwitch) {
     cancelPendingConnection();
     return;
   }
   ```

#### Fix for R3:
1. **Fix Port Index Parsing in `rack-renderer.js` (lines 1740–1741):**
   ```javascript
   const pIdxSrc = parseInt(String(source.portId).replace(/\D+/g, ''), 10) || 1;
   const pIdxTgt = parseInt(String(portId).replace(/\D+/g, ''), 10) || 1;
   ```
2. **Fix Port ID Key Normalization in `app.js` and `rack-renderer.js`:**
   Replace the simplistic `.replace(/^p/i, '')` with proper normalization:
   ```javascript
   const pNumStr = String(portId).replace(/\D+/g, '');
   ```
   Ensure `updatePortConfig` sets both `portId` and (if numeric) the canonical numeric keys, and on reset deletes all aliases (`portId`, `pNumStr`, `'p' + pNumStr`, `'pt' + pNumStr`, `'lc' + pNumStr`, `'sc' + pNumStr`, `portName`).
3. **Preserve VLAN and Metadata in `schedule-table.js` (lines 95 & 118):**
   When updating role in schedule table, merge with existing config:
   ```javascript
   const existingA = devA.portsConfig[pIdA] || {};
   const cfgA = {
     ...existingA,
     role: roleKey,
     isTrunk: isTrunkRole,
     color: resolvedColor,
     autoCableColor: true
   };
   ```
4. **Bidirectional Fallback in `renderPortIcon` (lines 1046–1062):**
   If `portCfg` is missing on a connected port, locate the other endpoint of `connCable`. If the remote device has a `portsConfig` on its connected port, inherit its `role`, `vlan`, `color`, and `description` so passive patch panel ports automatically reflect the switch port's identity.

---

## 5. Verification Method

### 5.1 Automated Command Checks
Run the following test commands from project root (`c:\Users\ufuk_\Documents\antigravity\fearless-einstein`):
1. `npm run check`
   - Syntax validation on modular scripts. Must exit with code 0.
2. `npm run test:unit`
   - Runs Vitest unit tests (319+ tests). Must all pass.
3. `npm run test:legacy`
   - Runs legacy node tests and Playwright headless tests.

### 5.2 Manual Browser Interactive Verification
1. Open `index.html` in browser.
2. **Loop Protection (R2):**
   - Click port `Gi1/0/1` on a Cisco switch to begin cabling.
   - Hover over `Gi1/0/2` on the SAME switch.
   - **Verify:** Tooltip displays red "⛔ Bağlantı Uyumsuz: Fiziksel Döngü Engellendi! Aynı aktif cihazın iki portu birbirine bağlanamaz". Tooltip must NOT show green.
   - Click `Gi1/0/2`. Connection is blocked with error sound and toast.
3. **Switch-to-Switch Connection (R2):**
   - Mount two switches in Rack 1 (e.g. Catalyst 2960X and Catalyst 9200L).
   - Click `Gi1/0/1` on Switch 1, then click `Gi1/0/1` on Switch 2.
   - **Verify:** The confirmation modal appears with THREE choices: "✨ 802.1Q TRUNK Olarak Yapılandır", "Standart Access Olarak Bağla", and "İptal".
   - Test clicking "Standart Access Olarak Bağla": Cable is successfully created with standard color, connection is NOT canceled.
   - Repeat and test clicking "802.1Q TRUNK": Cable is created with purple trunk styling (`[TRUNK]` prefix).
   - Repeat and test clicking "İptal" or pressing Escape: Connection is cleanly canceled.
4. **Patch Panel - Switch Integration (R3):**
   - Mount a `patch-cat6-24` and a `cisco-2960x-24ps`.
   - Configure Switch port `Gi1/0/1` with VLAN 10 (via Shift+Click). Verify blue `V10` badge.
   - Cable `Gi1/0/1` to Patch Panel `Port 1`.
   - **Verify:** Patch Panel `Port 1` displays the blue `V10` badge.
   - Edit Patch Panel `Port 1` to VLAN 20.
   - **Verify:** Switch port `Gi1/0/1` immediately updates to `V20` (bidirectional sync).
   - Mount `fiber-odf-24` and `cisco-3850-24s`.
   - Cable `sfp1` to `lc1`.
   - **Verify:** Fiber singlemode yellow `#facc15` color and ferrule glow are applied to both endpoints.

### 5.3 Invalidation Conditions
- If hovering over a self-loop port still displays green "Bağlamak için tıklayın", the tooltip hover fix is invalid.
- If connecting two switches still aborts when clicking standard access, the modal logic trap has not been resolved.
- If patch panel port 5 syncs to 3D as port 1, the port ID prefix parsing fix is invalid.
