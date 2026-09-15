# Project: Digital Rack Cabin Studio

**Enterprise Cisco 42U Rack & Cabling Studio (React 19 + TypeScript 5.x + PixiJS v8 + Tauri v2)**

---

## 1. Architecture

### System Architecture Overview

The system decouples high-frequency GPU rendering (PixiJS v8) from application state and DOM interactions (React 19) through a zero-cost unidirectional event bridge (`EngineBridge`).

```
+---------------------------------------------------------------------------------+
|                             TAURI v2 DESKTOP SHELL                              |
|  +-----------------------------+  IPC Bridge   +-----------------------------+  |
|  |        RUST BACKEND         |<=============>|        WEBVIEW CORE         |  |
|  | - Native File I/O (JSON)    |               | - React 19 + TypeScript     |  |
|  | - Native Dialogs            |               | - IndexedDB Storage Engine  |  |
|  +-----------------------------+               +-----------------------------+  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                        REACT APPLICATION LAYER                            |  |
|  |  +------------------+  +--------------------+  +-----------------------+  |  |
|  |  | App Shell & Menu |  | Hardware Catalog   |  | Cable Schedule View   |  |  |
|  |  | & Toolbars       |  | & Device Wizard    |  | & Export Modals       |  |  |
|  |  +------------------+  +--------------------+  +-----------------------+  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | State Stores (Zustand): ProjectStore, SelectionStore, HistoryStore  |  |  |
|  |  | Command Architecture (ICommand: execute, undo, redo)                |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  +--------------------------------------|------------------------------------+  |
|                                         | Unidirectional Dispatch / Sync        |
|                                         v (EngineBridge - Zero React Thrashing) |
|  +---------------------------------------------------------------------------+  |
|  |                         PIXIJS v8 2D CANVAS ENGINE                        |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | Viewport & Camera (Affine World <-> Screen, Infinite Pan & Zoom)    |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | Spatial Scene Graph (Multi-Rack RenderGroups, Frustum Culling, LOD) |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | Rack & Hardware Placement (Slot Snapping, AABB Collision, Ghost)    |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | Cabling Pipeline (Instanced Bézier Shaders, Catenary Sag, Trunks)   |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

### Module Boundaries
1. **`core/state`**: Immutable project state, Zustand stores, IndexedDB persistence with WAL, Schema V3 serialization and legacy migration.
2. **`core/history`**: Invertible delta command pattern (`ICommand`, `CommandManager`) managing undo/redo for all operations.
3. **`core/catalog`**: Built-in hardware database (Cisco, Dell, HPE, Estap ServerMax, accessories, transceivers), Zod schema validation, sub-100ms fuzzy search with Turkish diacritic folding, and Custom Device Wizard.
4. **`core/placement`**: EIA-310-D rack dimensional calculations (1U = 32px), front/rear viewpoints, 1-60U variable height logic, AABB unit interval collision detection, and occupied slot truncation guards.
5. **`engine`**: PixiJS v8 2D canvas, WebGPU/WebGL 2 fallback, camera affine mathematics, isolated `RenderGroup` per rack, viewport frustum culling, 3-tier LOD, ghost preview rendering, and zero-DOM-measurement coordinate pipeline.
6. **`engine/cabling`**: Port-to-port connections, structured side-channel 90° arc routing, direct catenary sag physics, inter-rack overhead ladder routing, 8 standard colors, zoom-dependent auto-bundling into trunk ribbons, Manhattan cable schedule generation, and connector compatibility matrix.
7. **`desktop`**: Tauri v2 configuration, window lifecycle, and native OS integrations.

---

## 2. Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1.1 | PixiJS v8 Canvas Setup | Asynchronous WebGPU setup with automatic WebGL 2 fallback and canvas resize observer | M4 | R1, Survey |
| F1.2 | Infinite Pan & Zoom Camera | Affine 2D transformation matrix with pointer-anchored zooming (scale 0.1x to 4.0x) and pan | M4 | R1, Survey |
| F1.3 | Decoupled 60 FPS Render Loop | Zero-cost EngineBridge isolating PixiJS ticker from React state/DOM updates | M4 | R1, Survey |
| F1.4 | Multi-Rack Spatial Scene Graph | Simultaneous multi-rack spatial layout in world space with isolated RenderGroups | M4 | R1, Survey |
| F1.5 | Frustum Culling & 3-Tier LOD | Spatial culling of off-screen racks and 3-tier LOD (Overview, Standard, Detailed) | M4 | R1, Survey |
| F1.6 | Interactive Drag Ghost & Snapping | Butter-smooth hardware dragging with ghost preview, slot snapping, and conflict tinting | M4 | R1, Survey |
| F1.7 | Sustained 60 FPS Performance | p95 frame time <= 16.6ms with 0 frames > 20ms under 10+ populated 42U racks (420+ devices) | M4 | AC1, AC2 |
| F2.1 | Dynamic Variable U-Height Racks | Flexible rack sizing from 1U up to 60U with dynamic unit rail rendering | M3 | R2, Survey |
| F2.2 | Front & Rear Viewpoints | Dual-sided rack rendering with front/rear facia flipping and normalized port coordinate alignment | M3 | R2, Survey |
| F2.3 | AABB Unit Interval Collision | Strict physical collision detection ([uStart, uEnd]) preventing device overlaps with instant feedback | M3 | R2, Survey |
| F2.4 | Rack Height Shrinkage Guard | Prohibit shrinking rack height below the highest occupied unit with clear warning | M3 | R2, AC4 |
| F2.5 | Identity & Cable Retention | Moving/rearranging devices preserves unique instance IDs and automatically recalculates cable endpoints | M3 | R2, AC6 |
| F3.1 | Authoritative Hardware Catalog | 21 Cisco switches/routers + 4 Dell/HPE servers + Estap ServerMax 26U-47U cabinets & 20+ accessories + PDUs + transceivers | M2 | R3, Survey |
| F3.2 | Unified Catalog Schema | Zod / JSON Schema compatible dual-sided schema with port matrices, transceivers, and power specs | M2 | R3, Survey |
| F3.3 | Zero-Code Custom Device Wizard | 6-step guided visual builder (1-60U, 0-96 ports, front/rear facia, power draw) | M2 | R3, AC8 |
| F3.4 | Portable Custom Device Import/Export | Safe JSON/YAML import/export with bounds checking, prototype pollution guards, and XSS sanitization | M2 | R3, Survey |
| F3.5 | Sub-100ms Fuzzy Search & Filter | Inverted token index with Turkish diacritic folding and bitmask filtering (<50ms across 1,000+ devices) | M2 | R3, AC3 |
| F4.1 | Port-to-Port Cabling Model | Persistent endpoint references with interactive port selection, highlighting, and connection endpoints | M5 | R4, Survey |
| F4.2 | Structured Side-Channel Routing | 90° circular arcs (radius 12px) with vertical cable duct lane offsets and parallel bundling | M5 | R4, Survey |
| F4.3 | Direct Catenary Sag Routing | Realistic droop physics using catenary sag formula (sagFactor * Math.sqrt(dx^2 + dy^2)) | M5 | R4, Survey |
| F4.4 | Inter-Rack Cross-Connect Routing | Overhead ladder tray and underfloor pathways for inter-rack cabling | M5 | R4, AC9 |
| F4.5 | Color Coding & Category Tagging | 8 standard colors (Blue, Green, Yellow, Red, Orange, Purple, Black, White) and categories (copper, fiber, DAC, power) | M5 | R4, Survey |
| F4.6 | Dynamic Zoom Auto-Bundling | Automatic aggregation of dense cable runs into trunk ribbons at distant zoom scales (scale < 0.4x) | M5 | R4, Survey |
| F4.7 | Cable Schedule & Metraj Engine | Manhattan distance length formula with slack calculation, connection table, and CSV export | M5 | R4, Survey |
| F4.8 | Connector Validation Matrix | Physical connector matching (RJ45, LC, SC, DAC, C13/C14) and capacity/power exhaustion warnings | M5 | R4, Survey |
| F5.1 | Invertible Command Architecture | Full Undo/Redo (Ctrl+Z / Ctrl+Y) for all placement, deletion, resize, and cabling actions | M1 | R5, AC10 |
| F5.2 | IndexedDB Auto-Save & Recovery | Debounced offline persistence with write-ahead log (WAL) and crash recovery | M1 | R5, Survey |
| F5.3 | Lossless Project Schema V3 | JSON project export/import with 100% data fidelity, corrupted file rejection, and legacy file migration | M1 | R5, AC11 |
| F5.4 | Tauri v2 Desktop Packaging | High-performance desktop packaging configuration with native file I/O hooks alongside web/PWA | M1 | R5, Survey |
| F6.1 | E2E Test Suite Pass (100%) | Complete pass of Tiers 1-4 test suite designed by E2E Testing Track | M6 | AC12 |
| F6.2 | Adversarial Hardening (Tier 5) | White-box adversarial testing, edge-case coverage hardening, and zero test gaps | M6 | Project Pattern |

---

## 3. Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Shell, Command Architecture & Persistence | React 19 + TS + Vite setup, Tauri v2 config, Zustand project store, ICommand undo/redo engine, IndexedDB auto-save & WAL crash recovery, Zod Schema V3 & legacy migration | none | DONE |
| M2 | PixiJS v8 60 FPS Viewport & Spatial Canvas Engine | PixiJS v8 canvas setup (WebGPU/WebGL 2 fallback), infinite pan/zoom camera math, EngineBridge event bus, multi-rack spatial layout, isolated RenderGroups, frustum culling, 3-tier LOD, ghost preview & slot snapping, 60 FPS benchmarks | M1 | DONE |
| M3 | Dynamic Variable Rack & Conflict-Free Placement Engine | EIA-310-D rack model (1-60U), front & rear viewpoints, AABB unit interval collision detection, strict height shrinkage prohibition guard, hardware identity & cable endpoint preservation | M1, M2 | DONE |
| M4 | Hardware Catalog Engine, Device Wizard & Search | Full built-in catalog (Cisco, Dell, HPE, Estap ServerMax, accessories, transceivers), Zod catalog schema, Zero-Code Custom Device Wizard (1-60U, 0-96 ports), sub-100ms fuzzy search with Turkish diacritic folding | M1 | PLANNED |
| M5 | Intelligent Cabling, Inter-Rack Connectivity & Validation Engine | Port-to-port connection pipeline, structured side-channel 90° arc routing, catenary sag physics, inter-rack overhead ladder routing, 8 standard colors, category tagging, zoom auto-bundling, cable schedule metraj & CSV export, connector validation matrix | M2, M3, M4 | PLANNED |
| M6 | Final Milestone: E2E Integration & Adversarial Coverage Hardening | Phase 1: 100% pass of E2E Test Suite (Tiers 1-4 from E2E Testing Track). Phase 2: Tier 5 adversarial stress testing and coverage hardening | M1, M2, M3, M4, M5, TEST_READY.md | PLANNED |

---

## 4. Interface Contracts

### M1 ↔ M2 (State & History ↔ Catalog Engine)
```typescript
export interface PortDefinition {
  id: string;
  name: string;
  type: 'rj45' | 'sfp' | 'sfp+' | 'qsfp28' | 'c13' | 'c14' | 'terminal';
  group?: string;
  row?: number;
  speed?: string;
  poe?: boolean;
  xPct?: number; // Normalized 0..1 coordinate on facia
  yPct?: number;
}

export interface DeviceCatalogItem {
  id: string;
  name: string;
  category: 'router' | 'switch' | 'server' | 'patch-panel' | 'pdu' | 'organizer' | 'accessory';
  u: number;
  manufacturer: string;
  depthMm?: number;
  powerWatts?: number;
  ports: PortDefinition[];
  rearPorts?: PortDefinition[];
  isCustom?: boolean;
}
```

### M1 / M2 ↔ M3 (Catalog & State ↔ Placement Engine)
```typescript
export interface DeviceInstance {
  instanceId: string;
  catalogId: string;
  rackId: string;
  startU: number; // 1-indexed bottom unit
  uHeight: number;
  face: 'front' | 'rear';
  customLabel?: string;
}

export interface RackModel {
  id: string;
  name: string;
  totalU: number; // 1..60
  widthMm: number;
  depthMm: number;
  maxLoadKg: number;
  positionX: number; // World spatial coordinate
  devices: DeviceInstance[];
}

export interface PlacementValidationResult {
  valid: boolean;
  conflictingInstanceId?: string;
  reason?: 'COLLISION' | 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED';
}

export function validatePlacement(rack: RackModel, device: DeviceInstance, targetU: number): PlacementValidationResult;
export function canResizeRack(rack: RackModel, newTotalU: number): { allowed: boolean; maxOccupiedU: number };
```

### M3 ↔ M4 (Placement Engine ↔ PixiJS Canvas Engine)
```typescript
export interface EngineBridgeEvents {
  'camera:pan': { dx: number; dy: number };
  'camera:zoom': { factor: number; screenAnchorX: number; screenAnchorY: number };
  'device:drag-start': { catalogId: string; sourceRackId?: string; instanceId?: string };
  'device:drag-move': { screenX: number; screenY: number };
  'device:drag-end': { screenX: number; screenY: number };
  'selection:change': { selectedId?: string; type?: 'rack' | 'device' | 'cable' | 'port' };
}

export interface WorldCoordinate {
  x: number;
  y: number;
}

export function screenToWorld(screenX: number, screenY: number, camera: { x: number; y: number; zoom: number }): WorldCoordinate;
export function worldToScreen(worldX: number, worldY: number, camera: { x: number; y: number; zoom: number }): { x: number; y: number };
```

### M3 / M4 ↔ M5 (Placement & Canvas ↔ Cabling Engine)
```typescript
export interface CableEndpoint {
  rackId: string;
  deviceInstanceId: string;
  portId: string;
  face: 'front' | 'rear';
}

export interface CableRun {
  id: string;
  from: CableEndpoint;
  to: CableEndpoint;
  color: string; // Blue, Green, Yellow, Red, Orange, Purple, Black, White
  category: 'copper' | 'fiber' | 'dac' | 'power';
  routingStyle: 'structured' | 'direct';
  notes?: string;
}

export interface CableGeometry {
  pathPoints: { x: number; y: number }[];
  bezierControlPoints?: { cp1x: number; cp1y: number; cp2x: number; cp2y: number };
  lengthMeters: number;
  isInterRack: boolean;
}

export function calculateCableGeometry(cable: CableRun, racks: Map<string, RackModel>): CableGeometry;
export function validateConnection(fromPort: PortDefinition, toPort: PortDefinition): { valid: boolean; warning?: string };
```

---

## 5. Code Layout

```
d:\cisco\cisco-42u-rack-cabling-studio\
├── .agents/                        # Agent metadata, plans, reports
├── src/                            # Modern React + TypeScript + PixiJS source
│   ├── app/                        # Main React application & shell components
│   │   ├── components/             # UI components (Header, Toolbar, Sidebar, Modals)
│   │   │   ├── catalog/            # Catalog browser, device cards, filters
│   │   │   ├── wizard/             # Zero-Code Custom Device Wizard
│   │   │   ├── schedule/           # Cable run schedule table & CSV export
│   │   │   └── inspector/          # Device & cable properties inspector
│   │   └── App.tsx
│   ├── core/                       # Core domain models and business logic
│   │   ├── catalog/                # Device catalog registry, Zod schemas, search index
│   │   ├── history/                # ICommand implementation & CommandManager (undo/redo)
│   │   ├── persistence/            # IndexedDB engine, WAL, Schema V3 & legacy migration
│   │   ├── placement/              # EIA-310-D rack model, collision detection, unit math
│   │   ├── state/                  # Zustand stores (project, selection, history)
│   │   └── types/                  # Shared TypeScript interfaces & models
│   ├── engine/                     # PixiJS v8 2D canvas engine
│   │   ├── bridge/                 # EngineBridge (decoupled React <-> Pixi event bus)
│   │   ├── camera/                 # Affine camera math, zoom/pan controllers
│   │   ├── scene/                  # SceneGraph, RackContainer (RenderGroups), LOD
│   │   ├── cabling/                # Bézier shaders, structured 90° arcs, catenary sag
│   │   └── interaction/            # Ghost preview, slot snapping, hit testing
│   ├── main.tsx                    # React web entry point
│   └── index.css                   # Tailwind / global styles
├── src-tauri/                      # Tauri v2 desktop integration
│   ├── tauri.conf.json             # Tauri configuration
│   ├── Cargo.toml                  # Rust dependencies
│   └── src/main.rs                 # Rust desktop entrypoint & IPC hooks
├── tests/                          # Test suites (Unit, Integration, E2E)
│   ├── e2e/                        # Opaque-box E2E test suite (Tiers 1-4)
│   ├── unit/                       # Core logic unit tests (placement, catalog, history)
│   └── benchmarks/                 # 60 FPS performance benchmark harness
├── index.html                      # HTML entrypoint
├── package.json                    # Project dependencies & npm scripts
├── tsconfig.json                   # TypeScript configuration
└── vite.config.ts                  # Vite build & bundle configuration
```
