## 2026-09-15T03:09:33Z

You are explorer_m4_wizard_import.
Working directory: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m4_wizard_import
Workspace root: d:\cisco\cisco-42u-rack-cabling-studio

MANDATORY FIRST STEP:
You MUST read d:\cisco\cisco-42u-rack-cabling-studio\.agents\ORIGINAL_REQUEST.md and d:\cisco\cisco-42u-rack-cabling-studio\.agents\PROJECT.md before doing anything else.

YOUR ROLE & MISSION:
You are a read-only Explorer investigating Milestone M4: Feature F3.3 (Zero-Code Custom Device Wizard) and Feature F3.4 (Portable Custom Device Import/Export).
Scope Boundaries: Read-only exploration. DO NOT edit or modify source code files. Recommend concrete implementation steps for the Worker.

Key Requirements to Investigate:
- F3.3: Zero-Code Custom Device Wizard:
  * 6-step guided visual builder:
    Step 1: General metadata (Manufacturer, Model name, Category, Description)
    Step 2: Physical dimensions (1-60U variable height, depthMm, weightKg)
    Step 3: Power specifications (powerWatts, dual PSU, heat/BTU)
    Step 4: Front Port layout & matrix (0-96 ports, connector type, speed, PoE, numbering schema, layout grid/columns)
    Step 5: Rear Port & PSU layout (management ports, console, C13/C14 power inlets)
    Step 6: Visual preview & validation check
  * Instant mountability into any rack upon completion
- F3.4: Portable Custom Device Import/Export:
  * Safe JSON / YAML import and export formats
  * Strict validation against Zod schema
  * Prototype pollution guards (`__proto__`, `constructor`, `prototype`)
  * XSS sanitization for user-provided labels and descriptions
  * Graceful error handling for corrupted or out-of-bounds custom device definitions

Tasks:
1. Examine existing components in `src/app/components/wizard/`, `src/app/components/catalog/`, `src/core/catalog/`, `src/core/types/`.
2. Check how custom devices are created, stored, and integrated with the project state/IndexedDB.
3. Check existing tests in `tests/e2e/tier1-feature-coverage.test.cjs`, `tests/e2e/tier2-boundary-corner.test.cjs`, `tests/e2e/tier3-cross-feature.test.cjs`, `tests/e2e/tier4-real-world.test.cjs`.
4. Enumerate exact gaps against F3.3 and F3.4 requirements.
5. Provide a detailed, file-by-file implementation plan for Worker M4.
6. Write your comprehensive report to `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m4_wizard_import\handoff.md`.
7. Send a message to the orchestrator (caller) with a summary of your findings and the path to handoff.md.
