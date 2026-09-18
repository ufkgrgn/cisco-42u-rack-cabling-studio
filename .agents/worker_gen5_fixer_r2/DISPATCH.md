## 2026-09-18T07:24:34Z

You are Worker Gen 5 Replacement (worker_gen5_fixer_r2).

Working Directory: c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\worker_gen5_fixer_r2
Project Root: c:\Users\ufuk_\Documents\antigravity\fearless-einstein

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL INSTRUCTIONS:
- Update your `progress.md` frequently (after each file edited, and before/after running commands) with current timestamp.
- app.bundle.js is DELETED and FORBIDDEN (AGENTS.md). Work only in `js/2d/` modular files, `dist/js/2d/`, and test files.
- Read ORIGINAL_REQUEST.md: `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\ORIGINAL_REQUEST.md` (Entry 2026-09-18T06:50:08Z).
- Read AGENTS.md: `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\AGENTS.md`.
- Read Explorer reports:
  * `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\explorer_gen5_media_compat\handoff.md`
  * `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\explorer_gen5_loop_cabling\handoff.md`
  * `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\explorer_gen5_test_regression\handoff.md`

Your Assigned Tasks & Files:

Task 1: Cable Length Preservation (Requirement R4)
In `js/2d/cabling-engine.js` (and mirror to `dist/js/2d/cabling-engine.js`):
- Lines ~887, 1025, 1042, 1135, 1150: Only compute length if `cable.lengthMeters == null`:
  `if (cable.lengthMeters == null) { cable.lengthMeters = ...; }`
- In `toggleCableDuctSide` (line ~152): add `delete cable.lengthMeters;` so deliberate rerouting recomputes length.

Task 2: Media Compatibility & SFP Cage Normalization (Requirement R1)
In `js/2d/network-rules.js` (and mirror to `dist/js/2d/network-rules.js`):
- Export `window.NetworkRules = RS.NetworkRules;` at bottom.
- Add helper `isSfpCageType(type)` to match `'sfp'`, `'sfp+'`, `'sfp28'`, `'qsfp'`, `'qsfp+'`, `'qsfp28'`. Use it in `isFiberPort`, `isUplinkPort`, and `validateConnection`.

Task 3: Tooltip Hover Synchronization (Requirement R1 & R2)
In `js/2d/rack-renderer.js` (and mirror to `dist/js/2d/rack-renderer.js`):
- In `handlePortHover` (lines ~1396-1398):
  `const rules = RS.NetworkRules || window.NetworkRules;`
  `const strict = STATE.strictCompliance !== false;`
  `const validation = rules && typeof rules.validateConnection === 'function' ? rules.validateConnection(src, { rackId: activeRack.id, instanceId, portId }, STATE, HARDWARE_CATALOG, strict) : { allowed: true };`
- Ensure tooltip display matches click handler (identical validation, identical parameters).

Task 4: Switch-to-Switch Uplink & Access Calibration (Requirement R2)
In `js/2d/network-rules.js` and `js/2d/rack-renderer.js`:
- For switch-to-switch links, set `disallowStandard: false`. Suggest Trunk, but allow user selection of Standard Access.
- In `showUplinkVisualConfirmModal` (`rack-renderer.js`), render both Trunk and Standard Access choice cards even when `isSwitchToSwitch` is true.
- Provide 3 footer buttons: "İptal" -> cancel connection, "Standart Access Olarak Bağla" -> `commitConnection(false)`, and "✨ 802.1Q TRUNK Olarak Yapılandır" -> `commitConnection(true)`.
- Remove lines ~1684-1687 in `commitConnection` that forcibly aborted switch-to-switch standard connections.
- In `tests/unit/network-compliance.test.ts`, update any mock assertions that tested `disallowStandard: true` if needed.

Task 5: Structured Cabling & Patch Panel Integration (Requirement R3)
In `js/2d/rack-renderer.js`, `js/2d/app.js`, and `js/2d/schedule-table.js`:
- Fix port index parsing using `replace(/\D+/g, '')` in `rack-renderer.js` lines ~1740-1741:
  `const pIdxSrc = parseInt(String(source.portId).replace(/\D+/g, ''), 10) || 1;`
  `const pIdxTgt = parseInt(String(portId).replace(/\D+/g, ''), 10) || 1;`
- In `app.js` port reset (lines ~388-411), delete all alias keys (`portId`, `pNumStr`, `'p'+pNumStr`, `'pt'+pNumStr`, `'lc'+pNumStr`, `'sc'+pNumStr`, etc.) so badges don't stick.
- In `schedule-table.js` lines ~95 & 118, merge existing `portsConfig` without wiping `vlan` or `description`.
- In `rack-renderer.js:1046-1062`, when rendering a passive patch panel port without direct `portCfg`, inspect the remote connected switch port's `portsConfig` to inherit VLAN/role badges bidirectionally.

Task 6: Verification & Test Execution
Execute the verification commands:
- `npm run check`
- `npm run test:legacy`
- `npm run test:unit`
- `npm test`
Verify that 100% of tests pass with exit code 0.

Write your report to `c:\Users\ufuk_\Documents\antigravity\fearless-einstein\.agents\worker_gen5_fixer_r2\handoff.md` and `progress.md`.
When complete, notify parent via send_message.
