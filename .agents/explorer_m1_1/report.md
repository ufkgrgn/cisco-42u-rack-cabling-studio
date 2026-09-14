# Milestone M1 Tooling & Setup: Technical Implementation Strategy & Blueprints

## 1. Executive Summary

This report establishes the technical implementation strategy and complete file skeletons for **Milestone M1: Foundation, Shell, Command Architecture & Persistence** of the Cisco 42U Digital Rack Cabin Studio.

The objective is to establish a modern, scalable, and ultra-performant engineering foundation:
- **Frontend Stack**: React 19 + TypeScript 5.7+ + Vite 6 + Tailwind CSS v4 (`@tailwindcss/vite`) + CSS Modules.
- **Desktop Shell**: Tauri v2 integration (`src-tauri/tauri.conf.json`, `Cargo.toml`, Rust entrypoint, and v2 security capabilities).
- **Core Architecture**: Zustand state stores, Invertible Command Architecture (`ICommand` undo/redo), Lossless Schema V3 with Zod, and debounced IndexedDB persistence with Write-Ahead Log (WAL) crash recovery.
- **Zero-Regression Guarantee**: Full backward compatibility with the existing legacy prototype, preserving all existing files (`js/app.bundle.js`, `js/editor.js`, `js/catalog-ui.js`, `css/*`) and guaranteeing that existing Playwright tests (`tests/studio.test.cjs`, `tests/editor.test.cjs`, `tests/catalog.test.cjs`) continue to pass without modifications.

---

## 2. Workspace & Environment Discovery

### 2.1 System Runtimes Found on Host
Investigation revealed that Node.js and npm are installed in a JetBrains runtime directory on this Windows machine:
- **Node.js binary**: `C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe` (Node v24.13.0)
- **npm binary**: `C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\npm.cmd` (npm v11.6.2)
- **PowerShell Execution Note**: Because this directory is not in the system `$env:PATH` by default, any PowerShell task must prepend this directory:
  ```powershell
  $env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH
  ```

### 2.2 Existing Legacy Files & Test Analysis
The workspace currently contains:
1. `index.html`: A standalone HTML file containing legacy DOM elements (`.studio-editor`, `.catalog-tools`, `#studio-height`, `#btn-export-visio`, etc.) and loading `js/app.bundle.js`, `js/editor.js`, `js/catalog-ui.js`.
2. `tests/studio.test.cjs`: Spawns a local HTTP server serving root, verifies variable rails, device overlap rejection, and Visio SVG export.
3. `tests/editor.test.cjs`: Launches Edge/Chromium via Playwright, opens `file:///.../index.html`, tests rack resize, position movement, undo/redo, drag-and-drop, and legacy localStorage migration.
4. `tests/catalog.test.cjs`: Launches Edge/Chromium via Playwright, opens `file:///.../index.html`, tests search, category filters, custom device wizard, and reload persistence.
5. `package.json`: Contains scripts:
   - `"start": "node scripts/serve.cjs"`
   - `"test": "node tests/studio.test.cjs && node --test tests/editor.test.cjs tests/catalog.test.cjs"`
   - `"test:performance": "node tests/performance.test.cjs"`
   - `"check": "node --check js/app.bundle.js && node --check js/editor.js && node --check js/catalog-ui.js"`

---

## 3. Non-Breaking Polyglot Architecture

A critical challenge identified is that `tests/editor.test.cjs` and `tests/catalog.test.cjs` load `index.html` directly via the `file:///` protocol and assert zero page errors (`assert.deepEqual(errors, [])`). If `index.html` were wiped and replaced with a bare `<script type="module" src="/src/main.tsx"></script>`, two breaking failures would occur:
1. Chromium blocks ES module loading over `file:///` due to CORS/origin rules, triggering `pageerror`.
2. The legacy selectors (`.studio-editor[data-ready="true"]`, `.catalog-tools`, etc.) and `window.RackStudio` would be missing.

### The Solution: Hybrid Polyglot `index.html`
We configure `index.html` to serve both worlds:
1. **React 19 Mount Target**: `<div id="root"></div>` at the top of the body.
2. **Legacy Prototype Retained**: The existing DOM structure is kept inside `<div id="legacy-root">`, ensuring all existing CSS classes, element IDs, and event handlers remain fully active.
3. **Smart Module Bootloader**:
   ```html
   <script type="module">
     // Only load modern Vite / React bundle if running over HTTP/HTTPS or Tauri webview
     if (window.location.protocol.startsWith('http') || window.location.protocol.startsWith('tauri')) {
       import('/src/main.tsx').then(() => {
         const legacy = document.getElementById('legacy-root');
         if (legacy && !window.__FORCE_LEGACY__) {
           legacy.style.display = 'none';
         }
       }).catch(console.error);
     }
   </script>
   ```
4. **Vite Build Entrypoint**: In `vite.config.ts`, Vite parses the entry module or `src/main.tsx`. During `npm run build`, Vite generates a production bundle in `dist/` where `dist/index.html` cleanly boots React 19.
5. **Legacy Tests Pass 100%**: When `tests/editor.test.cjs` or `tests/catalog.test.cjs` opens `index.html` via `file:///`, the dynamic import is safely skipped, the legacy DOM remains 100% visible, `window.RackStudio` initializes normally, and the assertions succeed with zero errors.

---

## 4. Modern Frontend Toolchain Specification

### 4.1 Dependency Matrix

| Category | Package | Version | Rationale |
|---|---|---|---|
| **UI Framework** | `react` | `^19.0.0` | Latest React 19 concurrent features, Actions, Asset Loading |
| | `react-dom` | `^19.0.0` | Modern React 19 DOM renderer |
| | `@types/react` | `^19.0.10` | React 19 TypeScript definitions |
| | `@types/react-dom` | `^19.0.4` | React DOM TypeScript definitions |
| **Tooling & Build** | `vite` | `^6.2.0` | Vite 6 sub-50ms HMR, lightning fast builds |
| | `@vitejs/plugin-react` | `^4.3.4` | Official React Fast Refresh plugin for Vite |
| | `typescript` | `^5.7.3` | TypeScript 5.x strict mode |
| **Styling** | `tailwindcss` | `^4.0.9` | Tailwind CSS v4 engine |
| | `@tailwindcss/vite` | `^4.0.9` | Native Vite integration (zero PostCSS config required) |
| | `clsx` | `^2.1.1` | Conditional class name helper |
| | `tailwind-merge` | `^3.0.1` | Conflict-free Tailwind class merging |
| | `lucide-react` | `^0.475.0` | Iconography for studio shell and toolbars |
| **Core State & Persistence**| `zustand` | `^5.0.3` | Decoupled lightweight state management |
| | `zod` | `^3.24.2` | Schema V3 validation, hardware catalog typing |
| | `idb` | `^8.0.2` | IndexedDB async engine with transaction safety |
| **GPU Rendering** | `pixi.js` | `^8.7.3` | PixiJS v8 2D canvas WebGPU/WebGL2 render pipeline |
| **Desktop Shell** | `@tauri-apps/api` | `^2.2.0` | Tauri v2 client API |
| | `@tauri-apps/plugin-dialog`| `^2.2.0` | Native OS file picker dialogs |
| | `@tauri-apps/plugin-fs` | `^2.2.0` | Native OS file system I/O |
| | `@tauri-apps/cli` | `^2.2.7` | Tauri v2 CLI (devDependencies) |
| **Testing** | `vitest` | `^3.0.5` | Blazing fast unit testing co-located with Vite |
| | `@testing-library/react` | `^16.2.0` | React 19 component testing |
| | `@testing-library/jest-dom`| `^6.6.3` | DOM matchers |
| | `jsdom` | `^26.0.0` | Headless DOM environment for Vitest |
| | `playwright` | `1.62.1` | Existing end-to-end testing |

---

## 5. File Blueprints & Skeletons

### 5.1 `package.json`
```json
{
  "name": "cisco-42u-rack-cabling-studio",
  "version": "4.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:legacy": "node tests/studio.test.cjs && node --test tests/editor.test.cjs tests/catalog.test.cjs",
    "test:performance": "node tests/performance.test.cjs",
    "test": "npm run test:unit && npm run test:legacy",
    "check:legacy": "node --check js/app.bundle.js && node --check js/editor.js && node --check js/catalog-ui.js",
    "check": "tsc --noEmit && npm run check:legacy",
    "start": "node scripts/serve.cjs"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.2.0",
    "@tauri-apps/plugin-dialog": "^2.2.0",
    "@tauri-apps/plugin-fs": "^2.2.0",
    "clsx": "^2.1.1",
    "idb": "^8.0.2",
    "lucide-react": "^0.475.0",
    "pixi.js": "^8.7.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1",
    "zod": "^3.24.2",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.9",
    "@tauri-apps/cli": "^2.2.7",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "playwright": "1.62.1",
    "tailwindcss": "^4.0.9",
    "typescript": "^5.7.3",
    "vite": "^6.2.0",
    "vitest": "^3.0.5"
  }
}
```

---

### 5.2 `tsconfig.json` & `tsconfig.node.json`

**`tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting / Strictness */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@app/*": ["src/app/*"],
      "@core/*": ["src/core/*"],
      "@engine/*": ["src/engine/*"]
    }
  },
  "include": ["src", "tests/unit", "vite.config.ts", "vitest.config.ts"]
}
```

**`tsconfig.node.json`**:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

---

### 5.3 `vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@app': resolve(__dirname, './src/app'),
      '@core': resolve(__dirname, './src/core'),
      '@engine': resolve(__dirname, './src/engine'),
    },
  },
  // Vite options tailored for Tauri development and web dev
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: ['es2022', 'chrome105', 'safari15'],
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
```

---

### 5.4 `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@app': resolve(__dirname, './src/app'),
      '@core': resolve(__dirname, './src/core'),
      '@engine': resolve(__dirname, './src/engine'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

---

### 5.5 `src/index.css`
```css
@import "tailwindcss";

@layer base {
  :root {
    --bg-primary: #0b0f19;
    --bg-surface: #111827;
    --bg-surface-hover: #1f2937;
    --border-color: #374151;
    --cisco-blue: #049fd9;
    --cisco-blue-hover: #0380b0;
    --accent-emerald: #10b981;
    --accent-amber: #f59e0b;
    --accent-rose: #ef4444;
  }

  body {
    background-color: var(--bg-primary);
    color: #f3f4f6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
  }
}

/* Custom scrollbar for catalogs and tables */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.6);
}
::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
```

---

### 5.6 `src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Hide legacy prototype DOM if modern React app is active
  const legacyContainer = document.getElementById('legacy-root');
  if (legacyContainer && !window.__FORCE_LEGACY__) {
    legacyContainer.style.display = 'none';
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Global typing declaration
declare global {
  interface Window {
    __FORCE_LEGACY__?: boolean;
    RackStudio?: any;
  }
}
```

---

### 5.7 `src/core/types/index.ts` (Interface Contracts as per PROJECT.md)

```typescript
// ---------------------------------------------------------------------------
// M1 <-> M2 Catalog Contracts
// ---------------------------------------------------------------------------
export type PortType = 'rj45' | 'sfp' | 'sfp+' | 'qsfp28' | 'c13' | 'c14' | 'terminal';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  group?: string;
  row?: number;
  speed?: string;
  poe?: boolean;
  xPct?: number; // Normalized 0..1 coordinate on facia
  yPct?: number;
}

export type DeviceCategory = 
  | 'router' 
  | 'switch' 
  | 'server' 
  | 'patch-panel' 
  | 'pdu' 
  | 'organizer' 
  | 'accessory';

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

// ---------------------------------------------------------------------------
// M1 / M2 <-> M3 Placement Contracts
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// M3 / M4 <-> M5 Cabling Contracts
// ---------------------------------------------------------------------------
export interface CableEndpoint {
  rackId: string;
  deviceInstanceId: string;
  portId: string;
  face: 'front' | 'rear';
}

export type CableColor = 
  | 'Blue' 
  | 'Green' 
  | 'Yellow' 
  | 'Red' 
  | 'Orange' 
  | 'Purple' 
  | 'Black' 
  | 'White';

export type CableCategory = 'copper' | 'fiber' | 'dac' | 'power';
export type CableRoutingStyle = 'structured' | 'direct';

export interface CableRun {
  id: string;
  from: CableEndpoint;
  to: CableEndpoint;
  color: string;
  category: CableCategory;
  routingStyle: CableRoutingStyle;
  lengthMeters?: number;
  notes?: string;
}

export interface CableGeometry {
  pathPoints: { x: number; y: number }[];
  bezierControlPoints?: { cp1x: number; cp1y: number; cp2x: number; cp2y: number };
  lengthMeters: number;
  isInterRack: boolean;
}

// ---------------------------------------------------------------------------
// M3 <-> M4 Engine Bridge Contracts
// ---------------------------------------------------------------------------
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
```

---

### 5.8 `src/core/history/ICommand.ts` & `CommandManager.ts`

**`src/core/history/ICommand.ts`**:
```typescript
export interface ICommand {
  description: string;
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  redo(): Promise<void> | void;
}
```

**`src/core/history/CommandManager.ts`**:
```typescript
import { ICommand } from './ICommand';

export type HistoryListener = (canUndo: boolean, canRedo: boolean, lastAction?: string) => void;

export class CommandManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxDepth: number;
  private listeners: Set<HistoryListener> = new Set();

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  public async execute(command: ICommand): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  public async undo(): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) return false;
    await command.undo();
    this.redoStack.push(command);
    this.notify();
    return true;
  }

  public async redo(): Promise<boolean> {
    const command = this.redoStack.pop();
    if (!command) return false;
    await command.redo();
    this.undoStack.push(command);
    this.notify();
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  public subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const last = this.undoStack[this.undoStack.length - 1]?.description;
    for (const listener of this.listeners) {
      listener(this.canUndo(), this.canRedo(), last);
    }
  }
}

export const commandManager = new CommandManager(100);
```

---

### 5.9 `src/core/persistence/schemaV3.ts` & `legacyMigration.ts`

**`src/core/persistence/schemaV3.ts`**:
```typescript
import { z } from 'zod';

export const PortDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['rj45', 'sfp', 'sfp+', 'qsfp28', 'c13', 'c14', 'terminal']),
  group: z.string().optional(),
  row: z.number().optional(),
  speed: z.string().optional(),
  poe: z.boolean().optional(),
  xPct: z.number().min(0).max(1).optional(),
  yPct: z.number().min(0).max(1).optional(),
});

export const DeviceCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['router', 'switch', 'server', 'patch-panel', 'pdu', 'organizer', 'accessory']),
  u: z.number().int().min(1).max(60),
  manufacturer: z.string(),
  depthMm: z.number().optional(),
  powerWatts: z.number().optional(),
  ports: z.array(PortDefinitionSchema).default([]),
  rearPorts: z.array(PortDefinitionSchema).optional(),
  isCustom: z.boolean().optional(),
});

export const DeviceInstanceSchema = z.object({
  instanceId: z.string(),
  catalogId: z.string(),
  rackId: z.string(),
  startU: z.number().int().min(1).max(60),
  uHeight: z.number().int().min(1).max(60),
  face: z.enum(['front', 'rear']),
  customLabel: z.string().optional(),
});

export const RackModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalU: z.number().int().min(1).max(60),
  widthMm: z.number().default(600),
  depthMm: z.number().default(1000),
  maxLoadKg: z.number().default(1000),
  positionX: z.number().default(0),
  devices: z.array(DeviceInstanceSchema).default([]),
});

export const CableEndpointSchema = z.object({
  rackId: z.string(),
  deviceInstanceId: z.string(),
  portId: z.string(),
  face: z.enum(['front', 'rear']),
});

export const CableRunSchema = z.object({
  id: z.string(),
  from: CableEndpointSchema,
  to: CableEndpointSchema,
  color: z.string(),
  category: z.enum(['copper', 'fiber', 'dac', 'power']),
  routingStyle: z.enum(['structured', 'direct']),
  lengthMeters: z.number().optional(),
  notes: z.string().optional(),
});

export const ProjectSchemaV3 = z.object({
  schemaVersion: z.literal(3),
  meta: z.object({
    projectName: z.string().default('Untitled Rack Project'),
    createdAt: z.string(),
    updatedAt: z.string(),
    author: z.string().optional(),
  }),
  activeRackId: z.string(),
  racks: z.array(RackModelSchema),
  cables: z.array(CableRunSchema).default([]),
  customCatalog: z.record(z.string(), DeviceCatalogItemSchema).default({}),
});

export type ProjectSchemaV3Type = z.infer<typeof ProjectSchemaV3>;
```

**`src/core/persistence/legacyMigration.ts`**:
```typescript
import { ProjectSchemaV3Type } from './schemaV3';

export function migrateV2ToV3(raw: any): ProjectSchemaV3Type {
  const timestamp = new Date().toISOString();

  // If already Schema V3, return validated copy
  if (raw && raw.schemaVersion === 3) {
    return raw as ProjectSchemaV3Type;
  }

  const racks = Array.isArray(raw?.racks) ? raw.racks.map((r: any, idx: number) => {
    const totalU = Number(r.heightU || r.totalU || 42);
    const devices = Array.isArray(r.devices) ? r.devices.map((d: any) => {
      // In legacy V2: topU was 1-indexed top of device, uHeight is height
      // Convert to bottom startU: startU = topU - uHeight + 1
      const uHeight = Number(d.uHeight || d.u || 1);
      const topU = Number(d.topU || d.startU || uHeight);
      const startU = d.startU !== undefined ? Number(d.startU) : Math.max(1, topU - uHeight + 1);

      return {
        instanceId: d.instanceId || `dev-${Math.random().toString(36).substring(2, 9)}`,
        catalogId: d.catalogKey || d.catalogId || 'unknown',
        rackId: r.id || `rack-${idx + 1}`,
        startU,
        uHeight,
        face: (d.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear',
        customLabel: d.customLabel || d.label || undefined,
      };
    }) : [];

    return {
      id: r.id || `rack-${idx + 1}`,
      name: r.name || `Rack ${idx + 1}`,
      totalU: Math.min(60, Math.max(1, totalU)),
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: r.positionX !== undefined ? Number(r.positionX) : idx * 700,
      devices,
    };
  }) : [
    {
      id: 'rack-1',
      name: 'Rack 1 (42U)',
      totalU: 42,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: 0,
      devices: [],
    }
  ];

  const cables = Array.isArray(raw?.cables) ? raw.cables.map((c: any, idx: number) => ({
    id: c.id || `cable-${idx + 1}`,
    from: {
      rackId: c.from?.rackId || racks[0]?.id || 'rack-1',
      deviceInstanceId: c.from?.instanceId || c.from?.deviceInstanceId || '',
      portId: c.from?.portId || '',
      face: (c.from?.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear',
    },
    to: {
      rackId: c.to?.rackId || racks[0]?.id || 'rack-1',
      deviceInstanceId: c.to?.instanceId || c.to?.deviceInstanceId || '',
      portId: c.to?.portId || '',
      face: (c.to?.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear',
    },
    color: c.color || '#2563eb',
    category: (c.category || 'copper') as 'copper' | 'fiber' | 'dac' | 'power',
    routingStyle: (c.routingStyle || 'structured') as 'structured' | 'direct',
    lengthMeters: c.lengthMeters ? Number(c.lengthMeters) : 2.5,
    notes: c.notes || undefined,
  })) : [];

  const customCatalog = (typeof raw?.customCatalog === 'object' && raw.customCatalog !== null) 
    ? raw.customCatalog 
    : {};

  const activeRackId = raw?.activeRackId || racks[0]?.id || 'rack-1';

  return {
    schemaVersion: 3,
    meta: {
      projectName: raw?.meta?.projectName || 'Migrated Rack Project',
      createdAt: raw?.meta?.createdAt || timestamp,
      updatedAt: timestamp,
    },
    activeRackId,
    racks,
    cables,
    customCatalog,
  };
}
```

---

### 5.10 `src/core/state/projectStore.ts` (Zustand Store)
```typescript
import { create } from 'zustand';
import { ProjectSchemaV3Type } from '../persistence/schemaV3';
import { migrateV2ToV3 } from '../persistence/legacyMigration';
import { commandManager } from '../history/CommandManager';
import { RackModel, DeviceInstance, CableRun, DeviceCatalogItem } from '../types';

interface ProjectStoreState {
  project: ProjectSchemaV3Type;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastAction?: string;
  selectedId: string | null;
  selectedType: 'rack' | 'device' | 'cable' | 'port' | null;

  // Actions
  setProject: (project: ProjectSchemaV3Type) => void;
  loadProjectFromData: (data: any) => void;
  setActiveRack: (rackId: string) => void;
  selectItem: (id: string | null, type: 'rack' | 'device' | 'cable' | 'port' | null) => void;
  markSaved: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const DEFAULT_PROJECT: ProjectSchemaV3Type = migrateV2ToV3({
  racks: [
    { id: 'rack-mdf', name: 'MDF Main Cabling (42U)', heightU: 42, devices: [] }
  ],
  cables: [],
});

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  // Subscribe to command manager for history status updates
  commandManager.subscribe((canUndo, canRedo, lastAction) => {
    set({ canUndo, canRedo, lastAction, isDirty: true });
  });

  return {
    project: DEFAULT_PROJECT,
    isDirty: false,
    canUndo: false,
    canRedo: false,
    selectedId: null,
    selectedType: null,

    setProject: (project) => set({ project, isDirty: false }),

    loadProjectFromData: (data) => {
      const migrated = migrateV2ToV3(data);
      commandManager.clear();
      set({ project: migrated, isDirty: false, selectedId: null, selectedType: null });
    },

    setActiveRack: (rackId) => set((state) => ({
      project: { ...state.project, activeRackId: rackId }
    })),

    selectItem: (id, type) => set({ selectedId: id, selectedType: type }),

    markSaved: () => set({ isDirty: false }),

    undo: async () => {
      await commandManager.undo();
    },

    redo: async () => {
      await commandManager.redo();
    },
  };
});
```

---

### 5.11 `src/engine/bridge/EngineBridge.ts` (Zero-Thrashing Event Bus)
```typescript
import { EngineBridgeEvents } from '../types';

type EventHandler<T> = (event: T) => void;

export class EngineBridge {
  private handlers: { [K in keyof EngineBridgeEvents]?: Set<EventHandler<EngineBridgeEvents[K]>> } = {};

  public on<K extends keyof EngineBridgeEvents>(event: K, handler: EventHandler<EngineBridgeEvents[K]>): () => void {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set() as any;
    }
    (this.handlers[event] as Set<EventHandler<EngineBridgeEvents[K]>>).add(handler);
    return () => this.off(event, handler);
  }

  public off<K extends keyof EngineBridgeEvents>(event: K, handler: EventHandler<EngineBridgeEvents[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  public emit<K extends keyof EngineBridgeEvents>(event: K, payload: EngineBridgeEvents[K]): void {
    const set = this.handlers[event];
    if (set) {
      for (const handler of set) {
        handler(payload);
      }
    }
  }

  public clear(): void {
    this.handlers = {};
  }
}

export const engineBridge = new EngineBridge();
```

---

### 5.12 `src/app/App.tsx` (React 19 Shell)
```tsx
import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Viewport } from './components/Viewport';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { useProjectStore } from '../core/state/projectStore';

export const App: React.FC = () => {
  const { project, undo, redo, canUndo, canRedo } = useProjectStore();
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'wizard' | 'schedule' | 'inspector'>('catalog');

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-gray-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header />

      {/* Main Studio Body: Sidebar + Viewport + Toolbars */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Side: Hardware Catalog & Wizards */}
        <Sidebar activeTab={sidebarTab} onSelectTab={setSidebarTab} />

        {/* Center: Canvas Viewport & Floating Toolbars */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#070a10]">
          <Toolbar />
          <Viewport />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />
    </div>
  );
};
```

---

### 5.13 Tauri v2 Desktop Packaging Files

#### `src-tauri/Cargo.toml`:
```toml
[package]
name = "cisco-rack-cabling-studio"
version = "1.0.0"
description = "Enterprise Cisco 42U Rack & Cabling Studio"
authors = ["Cisco Studio Team"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-dialog = "2.0"
tauri-plugin-fs = "2.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

#### `src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

#### `src-tauri/src/main.rs`:
```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Cisco 42U Rack & Cabling Studio",
  "version": "1.0.0",
  "identifier": "com.cisco.rackcablingstudio",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Cisco 42U Rack & Cabling Studio",
        "width": 1600,
        "height": 1000,
        "minWidth": 1280,
        "minHeight": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "dialog": {},
    "fs": {}
  }
}
```

#### `src-tauri/capabilities/default.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "description": "Default permissions for desktop app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file"
  ]
}
```

---

## 6. Worker Execution & Verification Protocol

The subsequent Worker should follow this strict step-by-step procedure to execute Milestone M1:

### Step 1: Set PowerShell Environment PATH
```powershell
$env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH
node -v   # Must report v24.13.0
npm -v    # Must report 11.6.2
```

### Step 2: Write Configuration & Skeleton Files
Create the following files matching the blueprints:
- `package.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `vitest.config.ts`
- `index.html` (adapted with `#root` and smart module bootloader)
- `src/index.css`
- `src/main.tsx`
- `src/app/App.tsx` and components
- `src/core/types/index.ts`
- `src/core/history/ICommand.ts` and `CommandManager.ts`
- `src/core/persistence/schemaV3.ts`, `legacyMigration.ts`, `indexedDb.ts`, `wal.ts`
- `src/core/state/projectStore.ts`
- `src/engine/bridge/EngineBridge.ts`
- `src-tauri/*`
- `tests/unit/history.test.ts`
- `tests/unit/schemaV3.test.ts`

### Step 3: Install Dependencies
```powershell
npm install
```

### Step 4: Verify Compilation & Type Safety
```powershell
npm run check
# Runs: tsc --noEmit && npm run check:legacy
```

### Step 5: Verify Unit Tests
```powershell
npm run test:unit
# Runs: vitest run
```

### Step 6: Verify Legacy Playwright Tests (Zero Regression)
```powershell
npm run test:legacy
# Runs: node tests/studio.test.cjs && node --test tests/editor.test.cjs tests/catalog.test.cjs
```

### Step 7: Verify Production Vite Build
```powershell
npm run build
# Must output clean assets to dist/
```
