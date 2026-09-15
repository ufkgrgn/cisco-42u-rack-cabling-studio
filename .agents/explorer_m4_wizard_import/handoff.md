# Handoff Report: Milestone M4 — Feature F3.3 (Zero-Code Custom Device Wizard) & Feature F3.4 (Portable Custom Device Import/Export)

**Agent**: `explorer_m4_wizard_import`  
**Date**: 2026-09-15  
**Mission**: Read-only technical investigation and implementation blueprint for Milestone M4 (F3.3 & F3.4)  
**Target Recipient**: Orchestrator / Worker M4  

---

## 1. Observation

### 1.1 Existing Component Inventory & Codebase Structure
Direct inspection of the repository revealed the current state of catalog, wizard, and persistence modules:

1. **`src/app/components/`**:
   - Contains: `Header.tsx`, `Sidebar.tsx`, `StatusBar.tsx`, `Toolbar.tsx`, `Viewport.tsx`.
   - **`src/app/components/wizard/` does NOT exist**.
   - `Sidebar.tsx` (lines 8–11) declares:
     ```typescript
     interface SidebarProps {
       activeTab: 'catalog' | 'wizard' | 'schedule' | 'inspector';
       onSelectTab: (tab: 'catalog' | 'wizard' | 'schedule' | 'inspector') => void;
     }
     ```
     However, lines 60–95 only provide navigation buttons for `'catalog'`, `'schedule'`, and `'inspector'`. There is no tab button or trigger for `'wizard'`.
   - In `Sidebar.tsx` (line 20):
     ```typescript
     const filteredCatalog = BUILT_IN_CATALOG.filter(item =>
       item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
       item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
     );
     ```
     `Sidebar.tsx` exclusively renders items from `BUILT_IN_CATALOG`. Devices residing in `project.customCatalog` are completely ignored and omitted from the sidebar view.

2. **`src/core/catalog/`**:
   - Contains only `catalogRegistry.ts` (91 lines).
   - `BUILT_IN_CATALOG` defines 6 baseline items (`cisco-isr-4431`, `cisco-catalyst-3850-24s`, `cisco-catalyst-9300`, `patch-panel-24`, `cable-organizer-1u`, `server-dell-r740`).
   - `catalogRegistry` is a singleton `Map<string, DeviceCatalogItem>` populated once with `BUILT_IN_CATALOG`. There are no synchronization functions (`syncCustomCatalog`, `registerCustomDevice`, etc.) to register runtime custom hardware definitions into this registry.

3. **`src/core/types/index.ts` & `src/core/persistence/schemas.ts`**:
   - In `src/core/types/index.ts` (lines 43–58):
     ```typescript
     export interface DeviceCatalogItem {
       id: string;
       name: string;
       category: DeviceCategory;
       u: number;
       manufacturer: string;
       depthMm?: number;
       powerWatts?: number;
       ports: PortDefinition[];
       rearPorts?: PortDefinition[];
       isCustom?: boolean;
       logo?: string;
       modelTag?: string;
       desc?: string;
     }
     ```
   - In `src/core/persistence/schemas.ts` (lines 55–70):
     ```typescript
     export const DeviceCatalogItemSchema = z.object({
       id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
       name: z.string().min(1).max(150),
       category: DeviceCategorySchema,
       u: z.number().int().min(1).max(60),
       manufacturer: z.string().min(1).default('Cisco'),
       depthMm: z.number().positive().optional().default(400),
       powerWatts: z.number().nonnegative().optional().default(0),
       ports: z.array(PortDefinitionSchema).default([]),
       rearPorts: z.array(PortDefinitionSchema).optional().default([]),
       isCustom: z.boolean().optional().default(false),
       logo: z.string().optional(),
       modelTag: z.string().optional(),
       desc: z.string().optional()
     });
     ```
   - Observed omission: Neither `DeviceCatalogItem` nor `DeviceCatalogItemSchema` include physical fields required for Wizard Steps 2 & 3: `weightKg`, `dualPsu`, and `heatBtu`.

4. **`src/core/persistence/export-import.ts`**:
   - Provides full project JSON export (`exportProjectToJson`) and import (`importProjectFromJson`) with prototype pollution guards (`assertNoPrototypePollution`) and SHA-256 / FNV-1a checksums.
   - Does NOT provide standalone custom device import or export functionality (neither JSON nor YAML).

5. **`src/core/state/projectStore.ts`**:
   - `DEFAULT_INITIAL_PROJECT` initializes `customCatalog: {}`.
   - `ProjectState` provides `setProject`, `loadProjectFromData`, `setActiveRack`, `updateMetadata`, `mutate`, `markSaved`, and `reset`.
   - Lacks dedicated, high-level helper actions for custom hardware management: `addCustomDevice`, `updateCustomDevice`, `removeCustomDevice`, and `importCustomDevices`.

6. **`src/engine/interaction/DragManager.ts` & `src/engine/scene/DeviceContainer.ts`**:
   - `DragManager.ts` (lines 177–186) listens to `device:drag-start` events:
     ```typescript
     const catItem = catalogRegistry.get(data.catalogId) || {
       id: data.catalogId,
       name: data.catalogId,
       category: 'switch' as const,
       u: 1,
       manufacturer: 'Cisco',
       ports: [],
     };
     ```
     Because `catalogRegistry` currently contains only built-in hardware, dragging an unregistered custom device falls back to a 1U dummy switch with 0 ports.
   - `DeviceContainer.ts` (lines 220–265) already possesses multi-LOD rendering capability for custom port layouts, including normalized coordinates (`xPct`, `yPct`), link LEDs, connector rendering (`rj45`, `sfp`, `sfp+`, `qsfp28`, `c13`, `c14`), and rear port support. Once a custom device is in `catalogRegistry`, `DeviceContainer` renders it with full visual fidelity.
   - `PlaceDeviceCommand.ts` (line 50) already resolves catalog items using:
     ```typescript
     const catItem = context.catalogRegistry.get(this._device.catalogId) || project.customCatalog?.[this._device.catalogId];
     ```
     This confirms that placement and history commands already support custom devices.

### 1.2 E2E Test Suite & Testing Invariants
1. Executing `tests/e2e/runner.cjs` via Node.js v24 yielded **100.0% pass rate** across all 4 tiers (326/326 tests passed):
   - Tier 1 (Feature Coverage): 145/145 pass
   - Tier 2 (Boundary & Corner Cases): 145/145 pass
   - Tier 3 (Cross-Feature Combinations): 24/24 pass
   - Tier 4 (Real-World Application Scenarios): 12/12 pass
2. Inspection of `tests/e2e/tier1-feature-coverage.test.cjs` (lines 840–1020) and `tier2-boundary-corner.test.cjs` (lines 905–1010) identified the exact contracts tested for F3.3 and F3.4:
   - `F3.3.1`: `document.querySelector('.catalog-custom-form')` must exist in DOM.
   - `F3.3.2`: Form fields with exact labels: `'Model adı'` (`input[maxlength="100"]`), `'Yükseklik (U)'` (`input[min="1"][max="60"]`), `'Port sayısı'` (`input[min="0"][max="96"]`), `'Port tipi'` (`select` with options `rj45`, `sfp`, `lc`), button `'Kaydet ve seç'`.
   - `F3.3.3`: Rendered card element with `[data-device-id="..."]` in catalog.
   - `F3.3.4`: Mountable to rack slot via `api.mountDeviceAt(key, u)`.
   - `F3.3.5`: Mounted custom device renders all configured ports in DOM.
   - `F3.4.1`: `api.STATE.customCatalog` serialized into project JSON.
   - `F3.4.2`: Prototype pollution (`__proto__`) rejected by `validateTopology`.
   - `F3.4.3`: `constructor` key in `customCatalog` rejected by `validateTopology`.
   - `F3.4.4`: XML/HTML tags in device names treated safely as text without DOM element injection.
   - `F3.4.5`: Re-importing topology restores custom catalog items.
   - `B3.3.1`: Wizard accepts 0 ports (e.g. blank spacer).
   - `B3.3.2`: Wizard accepts maximum 96 ports (high-density patch panel).
   - `B3.3.3` / `B3.3.4`: Min/max HTML attributes enforce `[0, 96]` ports and `[1, 60]` U.
   - `B3.4.1`: 1,000-character descriptions preserved without truncation.
   - `B3.4.2`: Special characters and emojis (e.g. `'Cisco Özel Switch 🚀 #1 & <Test>'`) preserved across JSON roundtrips.
   - `B3.4.3`: Custom keys with non-alphanumeric characters (spaces, exclamation marks) rejected by validation regex `/^[a-zA-Z0-9_-]+$/`.
   - `X3.11`: Custom device definitions persist losslessly across project export and re-import with powerWatts and U height intact.
3. In the existing test runner environment, these DOM selectors and APIs are currently serviced by the dual-track legacy layer (`index.html` + `js/app.bundle.js` + `js/catalog-ui.js`). In `src/` (the modern React 19 application), none of these visual components or portable IO utilities have been built yet.

---

## 2. Logic Chain

1. **Premise 1 (Requirements Alignment)**:
   Feature F3.3 requires a 6-step guided visual builder covering:
   - Step 1: General metadata (Manufacturer, Model name, Category, Description, Model Tag)
   - Step 2: Physical dimensions (1–60U variable height, depthMm, weightKg)
   - Step 3: Power specifications (powerWatts, dual PSU, heat/BTU calculation)
   - Step 4: Front Port layout & matrix (0–96 ports, connector type, speed, PoE, numbering schema, layout grid)
   - Step 5: Rear Port & PSU layout (management ports, console, C13/C14 power inlets, dual PSU positioning)
   - Step 6: Visual preview & validation check, with instant mountability into any rack upon completion.
   Feature F3.4 requires portable custom device import/export supporting both JSON and YAML, strict Zod validation, prototype pollution guards, XSS sanitization, and graceful error handling.

2. **Premise 2 (Schema Extensibility)**:
   Because Steps 2 and 3 require `weightKg`, `dualPsu`, and `heatBtu`, these fields must be added to `DeviceCatalogItem` (`src/core/types/index.ts`) and `DeviceCatalogItemSchema` (`src/core/persistence/schemas.ts`). Adding them as optional fields (`.optional()`) with safe defaults guarantees 100% backward compatibility with existing project files, Schema V3 serialization, and existing test suites.

3. **Premise 3 (Catalog Synchronization Necessity)**:
   `DragManager.ts` queries `catalogRegistry.get(catalogId)`. If `catalogRegistry` only stores built-in hardware, custom devices dragged onto the canvas fail to snap or display their true geometry. By introducing `syncCustomCatalog(customCatalog)` into `catalogRegistry.ts` and calling it on project state updates, custom devices become first-class citizens across the entire engine: DragManager, SceneGraph, LODManager, and DeviceContainer.

4. **Premise 4 (Portable IO Architecture)**:
   Importing and exporting custom devices must be decoupled from full-project persistence. Users must be able to export a single hardware definition or a bundle of definitions as `.json` or `.yaml`, share it across workstations, and import it into any project workspace. A zero-dependency YAML utility avoids bundle bloat and third-party vulnerabilities, while an explicit recursive prototype pollution check ensures absolute immunity against `__proto__`, `constructor`, and `prototype` tampering.

5. **Premise 5 (User Interface & Visual Builder Architecture)**:
   The 6-step wizard must be structured into modular React components under `src/app/components/wizard/`. An SVG/Canvas faceplate previewer (`FaceplatePreview.tsx`) renders the 19" chassis with rack ears, screw holes, and port matrices in real time. Step 6 provides an interactive preview with Front/Rear flip toggle and a real-time validation checklist. Completing the wizard calls `addCustomDevice` on the project store and offers an immediate "Mount into Rack" action that computes the next collision-free slot in the active rack and dispatches `PlaceDeviceCommand`.

---

## 3. Caveats

1. **No External YAML Library**: The project currently does not have `yaml` or `js-yaml` in `package.json`. A dependency-free, dedicated YAML parser/serializer tailored for the `DeviceCatalogItem` schema must be implemented in `src/core/catalog/yamlUtils.ts`. It must handle key-value mappings, scalar types (strings, numbers, booleans), and list items (`- `), with explicit line error reporting and prototype pollution guards.
2. **Dual-Track Testing Preservation**: The 326 E2E tests in `tests/e2e/runner.cjs` run against `index.html`. The Worker must NOT delete or break `js/catalog-ui.js` or `js/app.bundle.js`. The modern React components must expose matching accessibility labels and data attributes (`.catalog-custom-form`, `data-device-id`, `[maxlength="100"]`, etc.) so that tests succeed in both legacy and modern rendering modes.
3. **XSS Sanitization vs Unicode**: Sanitization must strip executable markup (`<script>`, `<iframe>`, `on*=`, `javascript:`) while preserving valid international characters, Turkish diacritics (`ş, ğ, ç, ı, ö, ü`), and UTF-8 emojis (`🚀`), which are explicitly asserted by test `B3.4.2`.
4. **Port Count Range**: While the wizard UI supports 0 to 96 ports, 0 ports is a valid configuration for blank panels, brush plates, and cable organizers (per test `B3.3.1`). The validator must strictly enforce $0 \le \text{ports} \le 96$.

---

## 4. Conclusion & Implementation Plan for Worker M4

### 4.1 Architecture Overview

```
+-----------------------------------------------------------------------------------------------------+
|                                    REACT APPLICATION LAYER                                          |
|                                                                                                     |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/app/components/Sidebar.tsx                                                              |   |
|   | - Unified Catalog Browser: BUILT_IN_CATALOG + project.customCatalog                         |   |
|   | - Search & Category Filter ('custom', 'switch', etc.)                                       |   |
|   | - "+ Custom Device" & "Import Device (.json, .yaml)" Buttons                                |   |
|   | - Custom Device Card: [CUSTOM] Badge, Quick Mount, Export JSON/YAML, Delete                 |   |
|   +---------------------------------------------------------------------------------------------+   |
|                                                  | Launches                                         |
|                                                  v                                                  |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/app/components/wizard/CustomDeviceWizard.tsx (6-Step Visual Builder)                    |   |
|   |  Step 1: WizardStepGeneral.tsx     (Manufacturer, Model Name, Category, Desc, Tag)         |   |
|   |  Step 2: WizardStepDimensions.tsx  (1-60U, Depth mm, Weight kg, Rack Ear Layout)            |   |
|   |  Step 3: WizardStepPower.tsx       (Watts, Dual PSU, BTU Auto-Calc & Override)              |   |
|   |  Step 4: WizardStepFrontPorts.tsx  (0-96 Ports, Connector, Speed, PoE, Grid Generator)     |   |
|   |  Step 5: WizardStepRearPorts.tsx   (Console, MGMT, C13/C14 Inlets, Dual PSU Alignment)      |   |
|   |  Step 6: WizardStepPreview.tsx     (Front/Rear Interactive Preview, Validation Checklist)   |   |
|   |          FaceplatePreview.tsx      (Dynamic SVG/HTML5 Canvas Faceplate Renderer)            |   |
|   +---------------------------------------------------------------------------------------------+   |
|                                                  |                                                  |
+--------------------------------------------------|--------------------------------------------------+
                                                   | Saves / Exports
                                                   v
+-----------------------------------------------------------------------------------------------------+
|                                     CORE CATALOG & STATE DOMAIN                                     |
|                                                                                                     |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/core/catalog/customDeviceIO.ts                                                          |   |
|   | - PortableCustomDeviceSchema (Strict Zod bounds: U 1-60, Ports 0-96)                         |   |
|   | - assertNoCustomDevicePollution (__proto__, constructor, prototype)                         |   |
|   | - sanitizeDeviceMetadata (XSS strip script/iframe, keep unicode/emojis)                     |   |
|   | - exportCustomDeviceToJson / exportCustomDeviceToYaml                                       |   |
|   | - importCustomDeviceFromJson / importCustomDeviceFromYaml                                   |   |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/core/catalog/yamlUtils.ts                                                               |   |
|   | - Safe zero-dependency YAML stringifier & parser with prototype guards                      |   |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/core/catalog/catalogRegistry.ts                                                         |   |
|   | - syncCustomCatalog, registerCustomDevice, getCatalogItem, getAllCatalogItems               |   |
|   +---------------------------------------------------------------------------------------------+   |
|   | src/core/state/projectStore.ts                                                              |   |
|   | - addCustomDevice, updateCustomDevice, removeCustomDevice, importCustomDevices              |   |
|   +---------------------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------------------+
```

### 4.2 File-by-File Blueprint

#### 1. `src/core/types/index.ts` (Modify)
Extend `DeviceCatalogItem` with optional physical and power attributes:
```typescript
export interface DeviceCatalogItem {
  id: string;
  name: string;
  category: DeviceCategory;
  u: number;
  manufacturer: string;
  depthMm?: number;
  weightKg?: number;         // Added: Physical weight in kg
  powerWatts?: number;
  dualPsu?: boolean;          // Added: Redundant power supply flag
  heatBtu?: number;           // Added: Heat dissipation in BTU/hr
  ports: PortDefinition[];
  rearPorts?: PortDefinition[];
  isCustom?: boolean;
  logo?: string;
  modelTag?: string;
  desc?: string;
}
```

#### 2. `src/core/persistence/schemas.ts` (Modify)
Update `DeviceCatalogItemSchema` to include optional Zod validations:
```typescript
export const DeviceCatalogItemSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'ID must contain only letters, numbers, hyphens, and underscores'),
  name: z.string().min(1).max(150),
  category: DeviceCategorySchema,
  u: z.number().int().min(1).max(60),
  manufacturer: z.string().min(1).default('Cisco'),
  depthMm: z.number().positive().optional().default(400),
  weightKg: z.number().positive().optional(),
  powerWatts: z.number().nonnegative().optional().default(0),
  dualPsu: z.boolean().optional().default(false),
  heatBtu: z.number().nonnegative().optional(),
  ports: z.array(PortDefinitionSchema).default([]),
  rearPorts: z.array(PortDefinitionSchema).optional().default([]),
  isCustom: z.boolean().optional().default(false),
  logo: z.string().optional(),
  modelTag: z.string().optional(),
  desc: z.string().optional()
});
```

#### 3. `src/core/catalog/catalogRegistry.ts` (Modify)
Add registry helper methods to dynamically synchronize custom devices with runtime lookups:
```typescript
export function syncCustomCatalog(customCatalog: Record<string, DeviceCatalogItem>): void {
  // Clear non-built-in items
  for (const key of catalogRegistry.keys()) {
    if (!BUILT_IN_CATALOG.some(item => item.id === key)) {
      catalogRegistry.delete(key);
    }
  }
  // Register active custom items
  if (customCatalog) {
    for (const item of Object.values(customCatalog)) {
      catalogRegistry.set(item.id, { ...item, isCustom: true });
    }
  }
}

export function registerCustomDevice(device: DeviceCatalogItem): void {
  catalogRegistry.set(device.id, { ...device, isCustom: true });
}

export function getCatalogItem(id: string): DeviceCatalogItem | undefined {
  return catalogRegistry.get(id);
}

export function getAllCatalogItems(): DeviceCatalogItem[] {
  return Array.from(catalogRegistry.values());
}
```

#### 4. `src/core/state/projectStore.ts` (Modify)
Expose custom hardware management actions in `ProjectState`:
```typescript
export interface ProjectState {
  // ... existing fields ...
  addCustomDevice: (device: DeviceCatalogItem) => void;
  updateCustomDevice: (id: string, updates: Partial<DeviceCatalogItem>) => void;
  removeCustomDevice: (id: string) => void;
  importCustomDevices: (devices: DeviceCatalogItem[]) => void;
}
```
Implementation in `create<ProjectState>`:
```typescript
addCustomDevice: (device) =>
  set((state) => {
    const updatedCustom = {
      ...state.project.customCatalog,
      [device.id]: { ...device, isCustom: true }
    };
    syncCustomCatalog(updatedCustom);
    return {
      project: {
        ...state.project,
        customCatalog: updatedCustom,
        metadata: { ...state.project.metadata, updatedAt: new Date().toISOString() }
      },
      isDirty: true,
      revision: state.revision + 1
    };
  }),

removeCustomDevice: (id) =>
  set((state) => {
    const updatedCustom = { ...state.project.customCatalog };
    delete updatedCustom[id];
    syncCustomCatalog(updatedCustom);
    return {
      project: {
        ...state.project,
        customCatalog: updatedCustom,
        metadata: { ...state.project.metadata, updatedAt: new Date().toISOString() }
      },
      isDirty: true,
      revision: state.revision + 1
    };
  }),

importCustomDevices: (devices) =>
  set((state) => {
    const updatedCustom = { ...state.project.customCatalog };
    for (const d of devices) {
      updatedCustom[d.id] = { ...d, isCustom: true };
    }
    syncCustomCatalog(updatedCustom);
    return {
      project: {
        ...state.project,
        customCatalog: updatedCustom,
        metadata: { ...state.project.metadata, updatedAt: new Date().toISOString() }
      },
      isDirty: true,
      revision: state.revision + 1
    };
  }),
```
Additionally, inside `setProject` and `loadProjectFromData`, invoke `syncCustomCatalog(project.customCatalog)`.

#### 5. `src/core/catalog/yamlUtils.ts` (New File)
Implement zero-dependency YAML serialization and parsing:
- `safeYamlStringify(data: any, indent = 0): string`
  Recursively serializes primitives, arrays, and objects into YAML formatted strings. Strings with special characters (`:`, `#`, `[`, `]`, `{`, `}`, `\n`, quotes) are properly escaped.
- `safeYamlParse(yamlStr: string): any`
  Parses key-value pairs, indentations, and list items (`- `).
  Directly validates keys against prototype pollution (`__proto__`, `constructor`, `prototype`) during parsing.
  Throws descriptive syntax errors with line numbers.

#### 6. `src/core/catalog/customDeviceIO.ts` (New File)
Implement the portable custom device import/export engine:
```typescript
export interface CustomDeviceIssue {
  path: string;
  message: string;
}

export interface CustomDeviceImportResult {
  success: boolean;
  devices: DeviceCatalogItem[];
  errors?: CustomDeviceIssue[];
}

// 1. Prototype Pollution Assert
export function assertNoCustomDevicePollution(obj: any): void;

// 2. XSS Text Sanitizer
export function sanitizeCustomDeviceText(text: string): string;

// 3. Zod Portable Device Schema
export const PortableDeviceSchema = DeviceCatalogItemSchema.extend({
  ports: z.array(PortDefinitionSchema).min(0).max(96),
  rearPorts: z.array(PortDefinitionSchema).min(0).max(96).optional().default([])
});

// 4. Export methods
export function exportCustomDeviceToJson(device: DeviceCatalogItem): string;
export function exportCustomDeviceToYaml(device: DeviceCatalogItem): string;
export function exportCustomCatalogToJson(customCatalog: Record<string, DeviceCatalogItem>): string;
export function exportCustomCatalogToYaml(customCatalog: Record<string, DeviceCatalogItem>): string;

// 5. Import methods
export function importCustomDeviceFromJson(jsonStr: string): CustomDeviceImportResult;
export function importCustomDeviceFromYaml(yamlStr: string): CustomDeviceImportResult;
export function importCustomDeviceAuto(content: string): CustomDeviceImportResult;
```

#### 7. `src/app/components/wizard/FaceplatePreview.tsx` (New File)
Visual component rendering the physical device faceplate in SVG/Canvas:
- Height dynamically computed as $U \times 32\text{px}$ (minimum 32px for 1U up to 1920px for 60U).
- Standard 528px width (480px front panel + $2 \times 24\text{px}$ left/right ears with mounting screws).
- Left accent bar color corresponding to device category (Router: Blue, Switch: Cyan, Server: Emerald, Patch-Panel: Purple, PDU: Amber, Organizer: Slate).
- Front view: Renders all front ports with realistic connector shapes (RJ45 with link LEDs, SFP optical cages, LC duplex ports, C13/C14 power).
- Rear view: Renders redundant power inlets (C13/C14), console port, management port, and cooling exhaust fans.
- Tooltip on hover displaying port name, speed, PoE status, and coordinate position.

#### 8. `src/app/components/wizard/WizardStep*.tsx` (6 Steps, New Files)
- `WizardStepGeneral.tsx` (Step 1):
  - Model Name (`maxLength={100}`, required).
  - Manufacturer selection (Cisco, Dell, HPE, Juniper, Arista, Fortinet, Estap, Generic).
  - Category dropdown (`switch`, `router`, `server`, `patch-panel`, `pdu`, `organizer`, `accessory`, `blank`).
  - Description textarea (`maxLength={1000}`).
  - Auto-generated slug ID (`cust-[manufacturer]-[model]`).
- `WizardStepDimensions.tsx` (Step 2):
  - Height (U): Numeric input & range slider bounded to $1 \le U \le 60$.
  - Depth (mm): 50–1200 mm.
  - Weight (kg): 0.5–200 kg.
  - EIA-310-D standard info card displaying total rack height consumption ($U \times 44.45\text{mm}$).
- `WizardStepPower.tsx` (Step 3):
  - Typical power consumption in Watts ($0 \le \text{Watts} \le 10000$).
  - Dual / Redundant PSU toggle.
  - Heat Dissipation (BTU/hr) with "Auto-Calculate" button ($\text{BTU} = \text{Watts} \times 3.412142$) and manual override.
- `WizardStepFrontPorts.tsx` (Step 4):
  - Port count: Number input bounded to $0 \le \text{ports} \le 96$. Presets: 0, 8, 12, 16, 24, 48, 96.
  - Connector type (`rj45`, `sfp`, `sfp+`, `qsfp28`, `lc`, `sc`, `dac`, `terminal`).
  - Speed (`100M`, `1G`, `10G`, `25G`, `40G`, `100G`).
  - PoE capability toggle.
  - Numbering schema: Prefix ("GE ", "Port ", "Gi1/0/", "P "), start index (1 or 0).
  - Grid arrangement: 1-row or 2-row layout with automatic normalized coordinate calculation (`xPct`, `yPct`).
  - Individual port editor list for custom naming or mixed media configurations.
- `WizardStepRearPorts.tsx` (Step 5):
  - Out-of-band management port checkbox ("MGMT", RJ45).
  - Serial console port checkbox ("Console", RJ45 / Terminal).
  - AC Power Inlets: Primary PSU (C13/C14) and Secondary Redundant PSU (C13/C14) with rear faceplate positioning.
  - Optional rear punchdown / breakout ports.
- `WizardStepPreview.tsx` (Step 6):
  - Interactive Front / Rear Faceplate preview.
  - Validation checklist badge indicating schema compliance.
  - Action buttons: "Save to Catalog", "Save & Mount to Active Rack", "Export JSON", "Export YAML".

#### 9. `src/app/components/wizard/CustomDeviceWizard.tsx` (New File)
Master wizard dialog component managing:
- Current step (1–6) state and step progress bar.
- Draft device state adhering to `DeviceCatalogItem`.
- Next / Back / Cancel button handlers with validation gates per step.
- On save: invokes `addCustomDevice(draftDevice)`, closes dialog, and triggers notification.
- On save & mount: invokes `addCustomDevice(draftDevice)`, finds first available U slot in `activeRack`, dispatches `PlaceDeviceCommand`, and switches to canvas.

#### 10. `src/app/components/Sidebar.tsx` (Modify)
- Merge `project.customCatalog` with `BUILT_IN_CATALOG` in the catalog listing.
- Add "+ Custom Device" button that opens `CustomDeviceWizard`.
- Add "Import" file upload button supporting `.json`, `.yaml`, `.yml`.
- Display a dedicated `[CUSTOM]` badge on user-defined cards.
- Add "Export" (JSON/YAML) and "Delete" actions on custom device cards.
- Support filtering by `category === 'custom'` or text query across custom items.
- Maintain DOM classes and labels (`.catalog-custom-form`, `.catalog-custom`, etc.) to guarantee seamless compatibility with E2E tests.

#### 11. `tests/unit/custom-device-wizard.test.ts` & `tests/unit/custom-device-io.test.ts` (New Test Files)
Comprehensive Vitest unit test suites covering:
- Port matrix generation for 0, 12, 24, 48, and 96 ports.
- U height clamping ($1 \le U \le 60$).
- BTU calculations ($\text{BTU} = \text{Watts} \times 3.412142$).
- JSON & YAML serialization and parsing roundtrips with 100% data fidelity.
- Prototype pollution rejection (`__proto__`, `constructor`, `prototype`).
- XSS script tag stripping and Unicode/emoji preservation.
- Error handling on corrupted JSON/YAML strings or out-of-bounds parameters.

---

## 5. Verification Method

To independently verify the implementation after Worker M4 completes the changes, execute the following commands in sequence:

### 5.1 Static Type Check
```powershell
$env:PATH = "C:\Users\ufuk_\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;d:\cisco\cisco-42u-rack-cabling-studio\node_modules\.bin;$env:PATH"
tsc --noEmit
```
**Expected Result**: Exits with code 0 and 0 errors across all source and test files.

### 5.2 Unit Test Execution
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run tests/unit
```
**Expected Result**: All unit test files (including `custom-device-wizard.test.ts` and `custom-device-io.test.ts`) pass 100%.

### 5.3 E2E Test Suite Execution
```powershell
& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs
```
**Expected Result**: All 4 tiers (326+ tests) pass 100% with exit code 0.
Specifically verify tests:
- `F3.3.1` – `F3.3.5` (Custom Device Wizard nominal paths)
- `F3.4.1` – `F3.4.5` (Custom Device Import/Export & security guards)
- `B3.3.1` – `B3.3.5` (Custom Device Wizard boundary conditions: 0–96 ports, 1–60U, 100-char name)
- `B3.4.1` – `B3.4.4` (Custom Device IO boundary conditions: 1000-char desc, emojis, non-alphanumeric keys)
- `X3.8` (Custom 3U device collision check)
- `X3.9` (Custom device undo/redo)
- `X3.11` (Custom device lossless export/import)
- `R4.6` (Custom vendor hardware defined, mounted, wired, and validated in schedule)

### 5.4 Production Build Verification
```powershell
$env:PATH = "C:\Users\ufuk_\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;d:\cisco\cisco-42u-rack-cabling-studio\node_modules\.bin;$env:PATH"
vite build
```
**Expected Result**: Vite builds bundle cleanly without syntax or bundling errors.

### 5.5 Invalidation Conditions
The verification fails if any of the following occur:
1. `tsc --noEmit` produces type errors on `DeviceCatalogItem` or `ProjectState`.
2. Any test in `tests/e2e/runner.cjs` fails or drops below 326 passing tests.
3. Prototype pollution input (`__proto__`, `constructor`, `prototype`) is accepted without throwing an error.
4. Custom devices created in the wizard fail to appear in `Sidebar.tsx` or cannot be mounted onto an active rack.
5. JSON or YAML export produces truncated data or drops custom port definitions.
