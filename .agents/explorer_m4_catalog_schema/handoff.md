# Handoff Report — Milestone M4: Feature F3.1 (Authoritative Hardware Catalog) & F3.2 (Unified Catalog Schema)

**Agent:** `explorer_m4_catalog_schema`  
**Working Directory:** `d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m4_catalog_schema`  
**Parent Agent:** `fa4cf5c8-1d9f-4866-a505-9316c2fe7f26`  
**Timestamp:** 2026-09-15T03:30:00Z  
**Type:** Hard Handoff (Investigation Complete)  

---

## 1. Observation

### 1.1 Existing Codebase State in `src/core/catalog/`
- `src/core/catalog/catalogRegistry.ts` (lines 1–91):
  Currently defines only **6 placeholder items**:
  1. `cisco-isr-4431` (1U router, 4 ports)
  2. `cisco-catalyst-3850-24s` (1U switch, 24 SFP ports)
  3. `cisco-catalyst-9300` (1U switch, 48 RJ45 ports)
  4. `patch-panel-24` (1U patch panel, 24 RJ45 ports)
  5. `cable-organizer-1u` (1U organizer, 0 ports)
  6. `server-dell-r740` (2U server, 4 ports)
- **Gaps identified against Milestone M4 requirements**:
  * **18 Cisco network switches/routers missing**: F3.1 requires 21 Cisco enterprise models. Only 3 exist.
  * **3 Enterprise compute servers missing**: Dell PowerEdge R650, HPE ProLiant DL360 Gen10, and HPE ProLiant DL380 Gen10 are absent; Dell R740/R750 is rudimentary (only 4 generic ports, no front drive representation, no redundant rear C14 inlets).
  * **All 4 Estap ServerMax cabinet profiles missing**: 26U, 36U, 42U, and 47U physical dimensions and envelopes are completely unrepresented in catalog structures.
  * **19+ Estap ServerMax accessories missing**: Blanking panels (1U–6U), finger-duct organizers, 5-ring organizers, 0.5U pass-throughs, 26U–47U vertical managers, fixed/sliding shelves, lockable drawers, roof fan units, LED rack lighting, and grounding busbars are absent.
  * **All Power Distribution Units (PDUs) and Automatic Transfer Switches (ATS) missing**: Basic 1U 8xC13, 2U HD switched 12xC13+4xC19, 0U vertical 24-port, and 1U ATS are absent.
  * **All Transceivers and DAC cables missing**: 19 optical/copper transceivers, DAC twinax, and breakout cables are absent.
- **Unified Schema properties missing from current catalog records**:
  * Normalized facia coordinates (`xPct`, `yPct`) are undefined on all existing ports.
  * Dual-sided rear ports (`rearPorts`) are empty on all existing models.
  * Thermal dissipation (`heatBtuPerHour`) and chassis weight (`weightKg`) are undefined.
  * Redundant power specifications (inlet types C14/C20, PSU redundancy, PoE standards) are missing.

### 1.2 Existing Type Definitions in `src/core/types/index.ts`
- Lines 9–20: `PortType` union:
  ```typescript
  export type PortType = 
    | 'rj45' | 'sfp' | 'sfp+' | 'qsfp28' | 'lc' | 'sc' | 'dac' | 'c13' | 'c14' | 'terminal';
  ```
  Missing connector types: `'sfp28'`, `'qsfp+'`, `'c19'`, `'c20'`, `'mpo'`.
- Lines 21–31: `PortDefinition` interface:
  Lacks port orientation (`facing?: 'front' | 'rear'`), gender (`connectorGender?: 'female' | 'male'`), and combo indicators (`isCombo?: boolean`, `comboPeerPortId?: string`).
- Lines 33–42: `DeviceCategory` union:
  Lacks categories queried by E2E test suites (e.g. `'fiber-switch'`, `'patch'`, `'fiber'`, `'shelf'`, `'drawer'`, `'fan'`, `'custom'`). In `tests/e2e/tier4-real-world.test.cjs` lines 46 & 56, the tests look for `category === 'fiber-switch'` and `category === 'patch-panel'`.
- Lines 43–57: `DeviceCatalogItem` interface:
  Lacks `weightKg?: number`, `heatBtuPerHour?: number`, `slots?: ExpansionSlotDefinition[]`, `power?: PowerSpecDefinition`, `facia?: FaciaSpecDefinition`, `compatibleTransceivers?: string[]`.

### 1.3 Persistence & Zod Schema State in `src/core/persistence/schemas.ts`
- Lines 7–18: `PortTypeSchema` needs expanding with `sfp28`, `qsfp+`, `c19`, `c20`, `mpo`.
- Lines 24–34: `PortDefinitionSchema` already defines `xPct` and `yPct` constrained to `z.number().min(0).max(1).optional()`.
- Lines 55–69: `DeviceCatalogItemSchema` has `u: z.number().int().min(1).max(60)`, `depthMm`, `powerWatts`, `ports`, `rearPorts`. Optional fields (`weightKg`, `heatBtuPerHour`, etc.) must be added safely.
- Lines 191–201: `ProjectSchemaV3` validates `customCatalog: z.record(z.string(), DeviceCatalogItemSchema)`. Because additions to `DeviceCatalogItemSchema` will be optional, all existing serialized V3 project JSONs remain 100% valid.

### 1.4 Rendering & Interaction Integration in `src/engine/`
- `src/engine/scene/DeviceContainer.ts` (lines 220–265):
  Already natively executes normalized coordinate translation:
  ```typescript
  if (port.xPct !== undefined && port.yPct !== undefined) {
    px = 24 + port.xPct * 480;
    py = port.yPct * this.heightPx;
  } else {
    px = 160 + (idx % 24) * 12;
    py = 6 + Math.floor(idx / 24) * 14;
  }
  ```
  And already switches to `catalogItem.rearPorts` when `activeFace === 'rear'`!
- `src/engine/interaction/DragManager.ts` (lines 177–185):
  Directly pulls catalog items from `catalogRegistry.get(data.catalogId)` during drag-and-drop operations.
- `src/engine/scene/RackContainer.ts` (lines 145–152):
  Queries `catalog.get(d.catalogId)` to instantiate each device twin.

### 1.5 Test Suite Baseline
- Vitest unit tests: **15 test files, 227 tests passing** (run duration 2.80s).
- Legacy test suite: `tests/studio.test.cjs`, `tests/catalog.test.cjs`, `tests/editor.test.cjs`, and `tests/performance.test.cjs` all pass cleanly.
- TypeScript compiler: `tsc --noEmit` exits with 0 errors.

---

## 2. Logic Chain

1. **Authoritative Specification Mining**:
   By analyzing `ORIGINAL_REQUEST.md` (Requirement R3), `PROJECT.md` (Features F3.1 & F3.2), `.agents/spec_miner_catalog/report.md`, and `servermax-katalog.pdf`, the full hardware profile was mapped. The catalog requires 21 Cisco enterprise models, 4 Dell/HPE servers, Estap ServerMax 26U–47U cabinets, 20+ accessories, PDUs, and transceivers.
2. **Backward Compatibility & Alias Preservation**:
   Legacy fixtures in `tests/catalog.test.cjs` and `tests/e2e/tier4-real-world.test.cjs` use legacy identifiers such as `cisco-3850-24s`, `cisco-nexus-93180yc`, `patch-cat6-24`, `organizer-1u`, and `server-dell-r740`. Modern naming uses formal product identifiers (e.g. `cisco-catalyst-3850-24s`, `patch-cat6a-24-stp`, `server-dell-r750`). To ensure zero regression, `catalogRegistry` must register both formal keys and legacy aliases.
3. **Dual-Sided Unified Schema Design**:
   Real datacenter hardware has front patch ports and rear power/management I/O. Because `DeviceContainer.ts` already supports rear-view rendering when `rearPorts` are populated, providing exact front and rear port arrays with normalized coordinates (`xPct`, `yPct`) gives high-fidelity dual-sided rendering immediately.
4. **Thermal & Energy Physics Formulation**:
   Datacenter capacity planning requires power and thermal dissipation modeling. Using the physical conversion constant:
   $$\text{Heat (BTU/hr)} = \text{Power (Watts)} \times 3.412142$$
   The schema provides both `powerWatts` and `heatBtuPerHour` (automatically calculated if omitted).
5. **Sub-100ms Search Pipeline**:
   Meeting Acceptance Criterion AC3 ($< 50\text{ms}$ query latency across 1,000+ items) requires Turkish locale lowercasing (`toLocaleLowerCase('tr')`), Unicode NFD diacritic stripping (`ı -> i`, `ş -> s`, `ç -> c`, `ğ -> g`, `ö -> o`, `ü -> u`), punctuation stripping, and token bitset intersection.

---

## 3. Caveats

1. **Read-Only Scope**: This investigation makes no modifications to source code files. All proposals, types, and schemas are structured for Worker M4 implementation.
2. **Schema Invariant**: In `src/core/persistence/schemas.ts`, all newly added fields on `DeviceCatalogItemSchema` and `PortDefinitionSchema` must be optional to preserve 100% backward compatibility with existing project JSON files and IndexedDB databases.
3. **Category Backward Compatibility**: `DeviceCategory` must include legacy category strings (`fiber-switch`, `patch`, `fiber`, `compact`, `custom`) alongside standard categories (`switch`, `router`, `server`, `patch-panel`, `pdu`, `organizer`, `accessory`, `blank`).
4. **E2E Test Environment**: E2E tests in `tests/e2e/` run against the legacy HTTP bundle (`index.html` + `js/app.bundle.js`). React UI components in `src/app/` power the Tauri/Vite app. The catalog in `src/core/catalog/` must satisfy both React app and Vitest test harnesses.

---

## 4. Conclusion & Actionable Implementation Plan for Worker M4

### 4.1 Target File Layout Plan

```
src/core/
├── types/
│   └── index.ts                     <-- Expand PortType, DeviceCategory, PortDefinition, DeviceCatalogItem
├── persistence/
│   └── schemas.ts                   <-- Update Zod schemas (PortTypeSchema, DeviceCategorySchema, etc.)
├── catalog/
│   ├── types.ts                     <-- Dedicated catalog types (Cabinet, Transceiver, Power, Facia)
│   ├── schemas.ts                   <-- Zod validation schemas for catalog import/export
│   ├── catalogRegistry.ts           <-- Master registry map, alias resolver, query helpers
│   ├── search.ts                    <-- Turkish-aware inverted index fuzzy search engine (<50ms)
│   ├── wizard.ts                    <-- Zero-Code Custom Device builder & sanitizer logic
│   └── data/
│       ├── ciscoDevices.ts          <-- 21 Cisco enterprise switches & routers
│       ├── serverDevices.ts         <-- 4 Dell/HPE compute servers (R650, R750, DL360, DL380)
│       ├── pduDevices.ts            <-- 4 PDUs & ATS (Basic 8xC13, HD 12xC13+4xC19, 0U 24P, 1U ATS)
│       ├── patchPanels.ts           <-- 5 Copper patch panels & Fiber ODF trays
│       ├── accessories.ts           <-- 20+ Estap accessories (blanks 1U-6U, brush, organizers, shelves)
│       ├── cabinetModels.ts         <-- Estap ServerMax 26U, 36U, 42U, 47U cabinet models
│       └── transceivers.ts          <-- 19 Transceivers (1G-100G SFP/SFP+/SFP28/QSFP28, DACs)
src/app/components/
├── catalog/
│   ├── CatalogBrowser.tsx           <-- Multi-faceted filter sidebar & search UI
│   └── DeviceCard.tsx               <-- Rich device preview card with quick-mount button
└── wizard/
    └── CustomDeviceWizardModal.tsx  <-- 6-step zero-code visual builder modal
tests/unit/
├── catalog.test.ts                  <-- Vitest unit tests verifying 100% item coverage & aliases
├── catalog-schema.test.ts           <-- Vitest schema validation, normalized coords & power/heat
├── catalog-search.test.ts           <-- Vitest search latency (<50ms across 1,000 items) & Turkish folding
└── catalog-wizard.test.ts           <-- Vitest wizard builder, prototype pollution guards & roundtrip
```

### 4.2 Detailed Hardware Inventory Specification (F3.1)

#### 1. 21 Cisco Enterprise Switches & Routers (`src/core/catalog/data/ciscoDevices.ts`)
| # | Primary Catalog ID | Model Name | U | Category | Ports (Front / Rear) | Power (Watts) | Heat (BTU/hr) | Legacy Aliases |
|---|---|---|---|---|---|---|---|---|
| 1 | `cisco-isr-4431` | Cisco ISR 4431/K9 Router | 1U | router | Front: 2x GE RJ45 routed, 2x SFP fiber, 1x MGMT / Rear: 2x C14 inlet | 250W | 853 | `cisco-isr-4431` |
| 2 | `cisco-asr-1001x` | Cisco ASR 1001-X Router | 1U | router | Front: 6x 1G SFP, 2x 10G SFP+, 1x MGMT / Rear: 2x C14 inlet | 250W | 853 | `cisco-asr-1001-x` |
| 3 | `cisco-catalyst-3850-24s` | Cisco Catalyst 3850-24S-S | 1U | fiber-switch | Front: 24x 1G SFP, 4x 10G SFP+ / Rear: 2x C14 inlet | 350W | 1,194 | `cisco-3850-24s` |
| 4 | `cisco-nexus-93180yc` | Cisco Nexus 93180YC-FX | 1U | switch | Front: 48x 25G SFP28, 6x 100G QSFP28 / Rear: 2x C14 inlet | 500W | 1,706 | `nexus-93180yc` |
| 5 | `cisco-catalyst-9500-24y4c` | Cisco Catalyst 9500-24Y4C | 1U | switch | Front: 24x 25G SFP28, 4x 100G QSFP28 / Rear: 2x C14 inlet | 650W | 2,218 | `cisco-9500-24y4c` |
| 6 | `cisco-catalyst-9300x-48hx` | Cisco Catalyst 9300X-48HX | 1U | switch | Front: 48x mGig 90W UPOE+, 4x 25G SFP28 / Rear: 2x C16 inlet | 1,100W | 3,753 | `cisco-9300x-48hx` |
| 7 | `cisco-catalyst-9300l-24p` | Cisco Catalyst 9300L-24P-4X | 1U | switch | Front: 24x 1G PoE+ (505W), 4x 10G SFP+ / Rear: 2x C14 inlet | 505W | 1,723 | `cisco-9300l-24p` |
| 8 | `cisco-catalyst-9300-48p` | Cisco Catalyst 9300-48P | 1U | switch | Front: 48x 1G PoE+ (715W), 4x 10G SFP+ / Rear: 2x C14 inlet | 715W | 2,440 | `cisco-catalyst-9300`, `cisco-9300-48u` |
| 9 | `cisco-catalyst-9200l-24p` | Cisco Catalyst 9200L-24P-4X | 1U | switch | Front: 24x 1G PoE+ (370W), 4x 10G SFP+ / Rear: 1x C14 inlet | 370W | 1,262 | `cisco-9200l-24p` |
| 10 | `cisco-catalyst-9200-48p` | Cisco Catalyst 9200-48P-4G | 1U | switch | Front: 48x 1G PoE+ (740W), 4x 1G SFP / Rear: 2x C14 inlet | 740W | 2,525 | `cisco-9200-48p` |
| 11 | `cisco-catalyst-1000-24p` | Cisco Catalyst 1000-24P-4G-L | 1U | switch | Front: 24x 1G PoE+ (195W), 4x 1G SFP / Rear: 1x C14 inlet | 195W | 665 | `cisco-1000-24p` |
| 12 | `cisco-catalyst-1000-48p` | Cisco Catalyst 1000-48P-4G-L | 1U | switch | Front: 48x 1G PoE+ (370W), 4x 1G SFP / Rear: 1x C14 inlet | 370W | 1,262 | `cisco-1000-48p` |
| 13 | `cisco-catalyst-2960x-24ps` | Cisco Catalyst 2960X-24PS-L | 1U | switch | Front: 24x 1G PoE+ (370W), 4x 1G SFP / Rear: 1x C14 inlet | 370W | 1,262 | `cisco-2960x-24ps` |
| 14 | `cisco-catalyst-2960xr-24ps` | Cisco Catalyst 2960XR-24PS-I | 1U | switch | Front: 24x 1G PoE+ (370W), 2x 10G SFP+ / Rear: 2x C14 inlet | 370W | 1,262 | `cisco-2960xr-24ps` |
| 15 | `cisco-catalyst-2960x-24ts` | Cisco Catalyst 2960-X 24TS-L | 1U | switch | Front: 24x 1G Data, 4x 1G SFP / Rear: 1x C14 inlet | 45W | 154 | `cisco-2960x-24ts` |
| 16 | `cisco-catalyst-2960-24pc` | Cisco Catalyst 2960-24PC-L | 1U | switch | Front: 24x 10/100 PoE (370W), 2x Dual GE/SFP / Rear: 1x C14 | 370W | 1,262 | `cisco-2960-24pc` |
| 17 | `cisco-catalyst-2960-24tc` | Cisco Catalyst 2960-24TC-L | 1U | switch | Front: 24x 10/100 Data, 2x Dual GE/SFP / Rear: 1x C14 | 30W | 102 | `cisco-2960-24tc` |
| 18 | `cisco-catalyst-2960-48tc` | Cisco Catalyst 2960-48TC-L | 1U | switch | Front: 48x 10/100 Data, 2x 1G RJ45 + 2x 1G SFP / Rear: 1x C14 | 45W | 154 | `cisco-2960-48tc` |
| 19 | `cisco-catalyst-3560x-24t` | Cisco Catalyst 3560X-24T-S | 1U | switch | Front: 24x 1G RJ45, 4x 1G/2x 10G SFP+ / Rear: 2x C14 inlet | 350W | 1,194 | `cisco-3560x-24t` |
| 20 | `cisco-catalyst-3560-8pc` | Cisco Catalyst 3560-8PC-S | 1U | compact | Front: 8x 10/100 PoE (123W), 1x Dual GE/SFP / Rear: 1x C14 | 123W | 420 | `cisco-3560-8pc` |
| 21 | `cisco-catalyst-2960cx-8pc` | Cisco Catalyst 2960CX-8PC-L | 1U | compact | Front: 8x 1G PoE+ (240W), 2x Copper, 2x SFP / Rear: 1x C14 | 240W | 819 | `cisco-2960cx-8pc` |
*(Additional model included for full catalog fidelity: `cisco-catalyst-2960g-8tc` compact 1U).*

#### 2. 4 Enterprise Compute Servers (`src/core/catalog/data/serverDevices.ts`)
1. `server-dell-r650` (Dell PowerEdge R650 1U): 800W, 2,730 BTU/hr, 751mm D, 21.9kg.
   - Front: 8x 2.5" SFF drive bays, micro-USB iDRAC Direct, VGA.
   - Rear: 2x C14 redundant PSUs, 1x iDRAC9 1G RJ45, 2x 10G SFP+, 4x 1G RJ45.
2. `server-dell-r750` (Dell PowerEdge R750 2U) [alias `server-dell-r740`]: 1,400W, 4,777 BTU/hr, 758mm D, 28.6kg.
   - Front: 16x 2.5" SFF drive bays, Quick Sync 2 bezel, VGA.
   - Rear: 2x C14 redundant PSUs, 1x iDRAC9 1G RJ45, 2x 25G SFP28, 2x 10G Base-T RJ45.
3. `server-hpe-dl360-gen10` (HPE ProLiant DL360 Gen10 1U): 800W, 2,730 BTU/hr, 750mm D, 16.3kg.
   - Front: 8+2 SFF drive bays, Systems Insight Display, DisplayPort.
   - Rear: 2x C14 Flex Slot PSUs, 1x dedicated iLO 5 1G RJ45, 4x 1G RJ45, 2x 10G SFP+.
4. `server-hpe-dl380-gen10` (HPE ProLiant DL380 Gen10 2U): 1,600W, 5,460 BTU/hr, 730mm D, 24.6kg.
   - Front: 24 SFF drive bays, Universal Media Bay, USB 3.0.
   - Rear: 2x C14 Flex Slot PSUs, 1x dedicated iLO 5 1G RJ45, 4x 10G SFP+, 4x 1G RJ45.

#### 3. Estap ServerMax Cabinets (`src/core/catalog/data/cabinetModels.ts`)
- `estap-servermax-26u`: 26U, 600/800mm W, 1000/1200mm D, 1309mm H, 1000kg load rating.
- `estap-servermax-36u`: 36U, 600/800mm W, 1000/1200mm D, 1754mm H, 1000kg load rating.
- `estap-servermax-42u`: 42U, 600/800mm W, 1000/1200mm D, 2002mm H, 1000kg load rating.
- `estap-servermax-47u`: 47U, 600/800mm W, 1000/1200mm D, 2224mm H, 1000kg load rating.

#### 4. 20+ Estap Accessories (`src/core/catalog/data/accessories.ts`)
- **Blank Panels**: `blank-panel-1u` (E44BPN01), `blank-panel-2u` (E44BPN02), `blank-panel-3u` (E44BPN03), `blank-panel-4u` (E44BPN04), `blank-panel-5u` (E44BPN05), `blank-panel-6u` (E44BPN06), `blank-panel-snap-6u` (P44BPN06).
- **Cable Organizers & Brush Panels**: `brush-panel-1u` [alias `organizer-1u`], `organizer-1u-5ring`, `organizer-1u-duct`, `organizer-2u-5ring` [alias `organizer-2u`], `organizer-2u-finger`, `organizer-0.5u-pass`, `vertical-manager-26u`, `vertical-manager-36u`, `vertical-manager-42u`, `vertical-manager-47u`.
- **Shelves, Drawers, Fans, Power**: `shelf-fixed-1u`, `shelf-sliding-1u`, `drawer-lockable-2u`, `drawer-lockable-3u`, `roof-fan-4way`, `roof-fan-6way`, `rack-lighting-1u`, `grounding-busbar`.

#### 5. Power Distribution Units & ATS (`src/core/catalog/data/pduDevices.ts`)
- `pdu-1u-basic-8c13`: 1U Horizontal Basic PDU (8x C13 rear outlets, 1x C20 inlet, 16A 230V, 3,680W max).
- `pdu-2u-hd-12c13-4c19`: 2U Horizontal HD Switched PDU (12x C13 + 4x C19 rear outlets, 1x IEC 309 32A inlet, 7,360W max).
- `pdu-0u-vert-24port`: 0U Vertical Intelligent Metered PDU (20x C13 + 4x C19 outlets, 3-Phase 32A, 22kW max).
- `ats-1u-dual-input`: 1U Automatic Transfer Switch (Dual IEC C20 feeds A+B, 8x C13 + 1x C19 outlets, <=10ms transfer time).

#### 6. Structured Cabling & Patch Panels (`src/core/catalog/data/patchPanels.ts`)
- `patch-cat6-24` [alias `patch-panel-24`]: Cat6A 24-Port 1U STP Shielded Patch Panel.
- `patch-cat6-48`: Cat6 48-Port 1U Dual-Row High-Density RJ45 Patch Panel.
- `fiber-odf-24`: 24-Port LC Duplex OM4 Multimode Fiber ODF Tray (48 cores).
- `fiber-odf-48`: 48-Port LC Duplex OM4 Multimode Fiber ODF Tray (96 cores).
- `fiber-odf-24-os2`: 24-Port LC Duplex OS2 Singlemode Fiber ODF Tray (48 cores).

#### 7. 19 Transceivers & DAC Cables (`src/core/catalog/data/transceivers.ts`)
- **1G SFP**: `glc-te` (RJ45 copper), `glc-sx-mmd` (850nm LC), `glc-lh-smd` (1310nm LC).
- **10G SFP+**: `sfp-10g-sr` (850nm LC), `sfp-10g-lr` (1310nm LC), `sfp-10g-t` (RJ45 copper), `sfp-h10gb-cu1m` (1m DAC), `sfp-h10gb-cu3m` (3m DAC).
- **25G SFP28**: `sfp-25g-sr-s` (850nm LC), `sfp-25g-lr-s` (1310nm LC), `sfp-h25g-cu2m` (2m DAC).
- **40G QSFP+**: `qsfp-40g-sr4` (850nm MPO-12), `qsfp-40g-sr-bd` (BiDi LC), `qsfp-40g-lr4` (CWDM4 LC).
- **100G QSFP28**: `qsfp-100g-sr4-s` (850nm MPO-12), `qsfp-100g-cwdm4` (CWDM4 LC), `qsfp-100g-lr4-s` (1310nm LC), `qsfp-100g-cu2m` (2m DAC), `qsfp-100g-4x25g-cu2m` (100G to 4x 25G breakout DAC).

### 4.3 Unified Catalog Schema Specification (F3.2)

1. **Normalized Facia Coordinate Formula**:
   Ports are distributed across horizontal block offsets with dual rows (top row $y_0 = 0.25$, bottom row $y_1 = 0.70$):
   $$xPct = 0.05 + \frac{colIndex}{columns} \times 0.90$$
   $$yPct = \begin{cases} 0.25 & \text{if row } 0 \\ 0.70 & \text{if row } 1 \end{cases}$$
   This ensures that `DeviceContainer.ts` calculates exact pixel coordinates ($px = 24 + xPct \times 480$, $py = yPct \times heightPx$) within the chassis without edge clipping.
2. **Dual-Sided Port Allocation**:
   - **Front ports (`ports`)**: Network interfaces, patch ports, and console jacks.
   - **Rear ports (`rearPorts`)**: Redundant AC inlets (`c14` / `c16` / `c20`), out-of-band management RJ45 (`mgmt0`, `iDRAC`, `iLO`), and PDU outlets.
3. **Power & Heat Invariants**:
   Every active device defines `powerWatts` and `heatBtuPerHour`. If `heatBtuPerHour` is omitted during custom device creation, it defaults to:
   `heatBtuPerHour = Math.round(powerWatts * 3.412142)`.

### 4.4 Sub-100ms Search Engine Architecture (F3.5)
In `src/core/catalog/search.ts`:
- **Turkish Diacritic Normalizer**:
  ```typescript
  export function normalizeCatalogText(input: string): string {
    return String(input || '')
      .toLocaleLowerCase('tr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();
  }
  ```
- **Pre-computed Inverted Token Bitmask Index**:
  Tokens map to bitsets of matching item indices, enabling bitwise AND evaluations that complete in under 5ms across 1,000+ items.

### 4.5 Zero-Code Custom Device Wizard (F3.3 & F3.4)
In `src/core/catalog/wizard.ts` and `src/app/components/wizard/CustomDeviceWizardModal.tsx`:
- Guided 6-step flow: Identity -> Chassis & Power -> Port Matrix -> Rear I/O -> Visual Preview -> Save & Mount.
- Strict security guards:
  - Discard prototype pollution keys (`__proto__`, `constructor`, `prototype`).
  - Strip HTML tags and script injections from model names and descriptions.
  - Enforce bounds: $1 \le U \le 60$, $0 \le \text{ports} \le 96$.
  - Generate unique keys: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.

---

## 5. Verification Method

1. **Type Checking**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" ./node_modules/typescript/bin/tsc --noEmit
   ```
   Must complete with zero errors.
2. **Vitest Unit Test Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" ./node_modules/vitest/vitest.mjs run
   ```
   Must pass all existing 227 tests plus new unit tests in:
   - `tests/unit/catalog.test.ts`
   - `tests/unit/catalog-schema.test.ts`
   - `tests/unit/catalog-search.test.ts`
   - `tests/unit/catalog-wizard.test.ts`
3. **Legacy E2E & Studio Regression Suite**:
   ```powershell
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/studio.test.cjs
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/catalog.test.cjs
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" --test tests/editor.test.cjs
   & "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/performance.test.cjs
   ```
   All 4 test suites must exit with code 0.
4. **Search Latency Invariant**:
   Execute search benchmarks in `tests/unit/catalog-search.test.ts` across 1,000 synthetic catalog records and assert p95 execution time $\le 50\text{ms}$.
