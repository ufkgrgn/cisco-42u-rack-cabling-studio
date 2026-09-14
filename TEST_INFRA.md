# Digital Rack Cabin Studio — E2E Test Infrastructure Specification

**Document:** `TEST_INFRA.md`  
**Integrity Mode:** Requirement-Driven / Opaque-Box  
**Target Stack:** React 19 + TypeScript 5.x + PixiJS v8 + Tauri v2  
**Test Harness:** Node.js v24 Test Runner (`node:test`) + Playwright Browser Automation  

---

## 1. Test Philosophy & Principles

The End-to-End (E2E) Test Suite for Digital Rack Cabin Studio adheres to the following foundational tenets:

1. **Opaque-Box Verification:**  
   Tests treat the application as a black box through its external observable surfaces: DOM elements, user interactions (clicks, keyboard, drags), visual layout (EIA-310-D slot coordinates, SVG/Canvas rendering), public API contracts (`window.RackStudio`), and persistent data artifacts (JSON export/import, IndexedDB). Tests never rely on implementation trivia.

2. **Authoritative Expected Output Derivation:**  
   Every assertion originates from formal specifications in `PROJECT.md` and `ORIGINAL_REQUEST.md`:
   - EIA-310-D rack dimensional specifications (1U = 32px height, 19-inch standard rail width).
   - Interval arithmetic for physical unit placement: $[u_{\text{start}}, u_{\text{end}}]$ where $u_{\text{end}} = u_{\text{start}} - \text{height} + 1$.
   - Zod/JSON Schema V3 invariants for catalog items, ports, and project models.
   - Graph connectivity invariants: an active cable links exactly two valid, non-overlapping port endpoints $(R_1, D_1, P_1) \leftrightarrow (R_2, D_2, P_2)$.
   - Manhattan distance and catenary droop physical equations.

3. **Deterministic & Isolated Execution:**  
   Each test sets up its own state using self-contained fixtures, performs operations, verifies outcomes, and cleans up. Tests do not depend on test execution order.

4. **Adversarial & Edge Hardening:**  
   The suite includes rigorous boundary conditions: 1U minimum racks, 60U maximum racks, empty racks, full 42U racks, 96-port saturation, negative height shrinkage attempts, corrupted JSON recovery, rapid undo/redo cycles, and special character/XSS sanitization.

5. **High-Performance Architecture:**  
   A shared ephemeral Node HTTP server and reusable Playwright browser context execute test batches in milliseconds, allowing 276+ comprehensive tests to finish in under 30 seconds.

---

## 2. Feature Inventory Matrix (F1.1 – F5.4)

The test suite covers all 24 core features across Requirements R1–R5:

| Feature ID | Feature Name | Requirement | Target Milestone | Tier 1 (Happy) | Tier 2 (Boundary) | Tier 3 (Cross) | Tier 4 (Real-World) |
|---|---|---|---|:---:|:---:|:---:|:---:|
| **F1.1** | PixiJS v8 Canvas Setup | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.2** | Infinite Pan & Zoom Camera | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.3** | Decoupled 60 FPS Render Loop | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.4** | Multi-Rack Spatial Scene Graph | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.5** | Frustum Culling & 3-Tier LOD | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.6** | Interactive Drag Ghost & Snapping | R1 | M4 | 5 | 5 | Yes | Yes |
| **F1.7** | Sustained 60 FPS Performance | R1, AC1 | M4 | 5 | 5 | Yes | Yes |
| **F2.1** | Dynamic Variable U-Height Racks | R2 | M3 | 5 | 5 | Yes | Yes |
| **F2.2** | Front & Rear Viewpoints | R2 | M3 | 5 | 5 | Yes | Yes |
| **F2.3** | AABB Unit Interval Collision | R2 | M3 | 5 | 5 | Yes | Yes |
| **F2.4** | Rack Height Shrinkage Guard | R2, AC4 | M3 | 5 | 5 | Yes | Yes |
| **F2.5** | Identity & Cable Retention | R2, AC6 | M3 | 5 | 5 | Yes | Yes |
| **F3.1** | Authoritative Hardware Catalog | R3 | M2 | 5 | 5 | Yes | Yes |
| **F3.2** | Unified Catalog Schema | R3 | M2 | 5 | 5 | Yes | Yes |
| **F3.3** | Zero-Code Custom Device Wizard | R3, AC8 | M2 | 5 | 5 | Yes | Yes |
| **F3.4** | Portable Custom Device Import/Export | R3 | M2 | 5 | 5 | Yes | Yes |
| **F3.5** | Sub-100ms Fuzzy Search & Filter | R3, AC3 | M2 | 5 | 5 | Yes | Yes |
| **F4.1** | Port-to-Port Cabling Model | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.2** | Structured Side-Channel Routing | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.3** | Direct Catenary Sag Routing | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.4** | Inter-Rack Cross-Connect Routing | R4, AC9 | M5 | 5 | 5 | Yes | Yes |
| **F4.5** | Color Coding & Category Tagging | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.6** | Dynamic Zoom Auto-Bundling | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.7** | Cable Schedule & Metraj Engine | R4 | M5 | 5 | 5 | Yes | Yes |
| **F4.8** | Connector Validation Matrix | R4 | M5 | 5 | 5 | Yes | Yes |
| **F5.1** | Invertible Command Architecture | R5, AC10 | M1 | 5 | 5 | Yes | Yes |
| **F5.2** | IndexedDB Auto-Save & Recovery | R5 | M1 | 5 | 5 | Yes | Yes |
| **F5.3** | Lossless Project Schema V3 | R5, AC11 | M1 | 5 | 5 | Yes | Yes |
| **F5.4** | Tauri v2 Desktop Packaging | R5 | M1 | 5 | 5 | Yes | Yes |

---

## 3. Test Architecture & Tier Structure

The test suite is structured into four progressive tiers conforming to the formula:
$$\text{Total Tests} \ge 11 \times N + \max(5, \lfloor N / 2 \rfloor) = 11 \times 24 + 12 = 276 \text{ test cases}$$

```
tests/e2e/
├── harness.cjs                    # Shared HTTP server, Playwright launcher, lifecycle hooks
├── runner.cjs                     # Unified CLI runner with formatted reports & exit codes
├── tier1-feature-coverage.test.cjs # Tier 1: 120 tests (24 features × 5 happy path tests)
├── tier2-boundary-corner.test.cjs # Tier 2: 120 tests (24 features × 5 boundary tests)
├── tier3-cross-feature.test.cjs   # Tier 3: 24 tests (Pairwise cross-feature workflows)
└── tier4-real-world.test.cjs      # Tier 4: 12 tests (Realistic end-to-end data center scenarios)
```

### Tier 1 — Feature Coverage (120 Tests)
- **Scope:** Isolated verification of every feature F1.1 through F5.4.
- **Criteria:** $\ge 5$ tests per feature exercising nominal primary behaviors.
- **Channel:** Direct UI interaction + API state confirmation via Playwright.

### Tier 2 — Boundary & Corner Cases (120 Tests)
- **Scope:** Stress-testing edge limits for every feature F1.1 through F5.4.
- **Criteria:** $\ge 5$ tests per feature covering extreme inputs:
  - 1U rack minimum, 60U rack maximum.
  - Empty racks, full 42U populated racks.
  - Unit collision boundaries: exact abutting vs 1-slot overlap.
  - Port count saturation (0 to 96 ports).
  - Negative shrinkage rejection (attempting to shrink rack below highest device).
  - Corrupted JSON structure, malformed UUIDs, prototype pollution keys (`__proto__`).
  - Rapid undo/redo burst execution and history truncation limits.

### Tier 3 — Cross-Feature Combinations (24 Tests)
- **Scope:** Multi-module interactions verifying state consistency across subsystem boundaries.
- **Key Pairwise Workflows:**
  - Device Move + Attached Cable Recalculation (F2.5 + F4.1).
  - Custom Device Wizard + Rack Placement + Cable Connect + Undo/Redo (F3.3 + F2.3 + F4.1 + F5.1).
  - Dynamic Rack Resize + Side-Channel Cable Geometry Update (F2.1 + F4.2).
  - Multi-Rack Topology + Inter-Rack Cross-Connect + Visio SVG Export (F1.4 + F4.4 + F4.7).
  - IndexedDB Persistence + Crash Reload + Lossless JSON Export (F5.2 + F5.3).
  - Turkish Fuzzy Search + Device Selection + Quick Slot Mount (F3.5 + F1.6).

### Tier 4 — Real-World Application Scenarios (12 Tests)
- **Scope:** Complete end-to-end realistic network infrastructure scenarios.
- **Scenarios:**
  1. *Enterprise MDF Core Switch to IDF Patch Panel Multi-Rack Cabling*: Core routing, fiber backbone, edge distribution.
  2. *High-Density Top-of-Rack (ToR) Server Max Cabling*: 40U compute density with 2x ToR switches and dual-homed servers.
  3. *Full Multi-Rack Campus Distribution*: MDF + IDF-1 + IDF-2 cross-rack interconnect with color-coded VLAN trunks.
  4. *Project Export & Re-Import Roundtrip with 100% Fidelity*: Full site topology exported to JSON, verified, and re-imported cleanly.
  5. *Disaster Recovery / Crash Simulation*: Unsaved state recovery from IndexedDB following abrupt reload.
  6. *Custom Vendor Catalog Integration*: Zero-code custom hardware import, deployment, and schedule validation.
  7. *Overhead Ladder Tray Cross-Connect Topology*: Inter-rack routing across 4 racks with Manhattan metraj calculations.
  8. *Patch Panel 24-Port Saturation*: 1-to-1 patch cord mapping between patch panel and access switch.
  9. *Dynamic Rack Expansion*: Live migration and rack resizing from 42U to 48U with cable preservation.
  10. *Full Site Deletion & Atomic Reset*: Resetting enterprise site topology and validating memory cleanup.
  11. *Multi-Category Cabling Schedule Audit*: Cable schedule generation with mixed copper, fiber, and DAC links.
  12. *Visio SVG Vector Export Verification*: High-resolution vector output audit with XML parser validation.

---

## 4. Execution & Coverage Thresholds

| Metric | Target | Enforcement |
|---|---|---|
| **E2E Test Pass Rate** | **100%** (276/276 tests) | Hard failure on any assertion error |
| **Browser Exceptions** | **0** `pageerror` events | Any uncaught error fails the test suite |
| **Catalog Search Latency** | **< 50ms** | Monitored in performance benchmarks |
| **Render Frame Time** | **$\le$ 16.6ms** (60 FPS p95) | Tested under 10+ populated 42U racks |
| **Data Integrity Roundtrip** | **100%** equality | Deep assertion on re-imported JSON projects |

---

## 5. Test Runner Command

All tests are executed via Node.js test runner using the helper script:

```bash
# Run complete E2E test suite across all 4 tiers
node tests/e2e/runner.cjs

# Or run individual tiers
node --test tests/e2e/tier1-feature-coverage.test.cjs
node --test tests/e2e/tier2-boundary-corner.test.cjs
node --test tests/e2e/tier3-cross-feature.test.cjs
node --test tests/e2e/tier4-real-world.test.cjs
```
