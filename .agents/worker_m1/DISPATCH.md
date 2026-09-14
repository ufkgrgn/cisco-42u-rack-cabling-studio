## 2026-09-14T19:51:30Z
You are Worker M1 (archetype: teamwork_preview_worker).
Your working directory is: d:\cisco\cisco-42u-rack-cabling-studio\.agents\worker_m1
The original request is at: d:\cisco\cisco-42u-rack-cabling-studio\.agents\ORIGINAL_REQUEST.md
The project master plan is at: d:\cisco\cisco-42u-rack-cabling-studio\.agents\PROJECT.md
YOU MUST READ d:\cisco\cisco-42u-rack-cabling-studio\.agents\ORIGINAL_REQUEST.md and d:\cisco\cisco-42u-rack-cabling-studio\.agents\PROJECT.md FIRST before starting any work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Input Information & Specifications:
Read the 3 detailed Explorer reports and blueprints:
1. Tooling & Polyglot Setup: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m1_1\report.md (and handoff.md)
2. State & Command Architecture: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m1_2\report.md (and handoff.md)
3. Persistence & Migration Pipeline: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m1_3\report.md (and handoff.md)

Host Environment & Node Path:
Node.js v24.13.0 and npm 11.6.2 are located at:
`C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64`
Before running any Node/npm commands in PowerShell, you MUST prepend this to `$env:PATH`:
`$env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH`

Write Ownership:
You exclusively own and will implement:
- `package.json` (update with React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Zod, Vitest, Pixi.js, etc. while preserving legacy test scripts)
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- `index.html` (apply the polyglot strategy: preserve #legacy-root so tests/editor.test.cjs and tests/catalog.test.cjs continue passing, and add #root for React)
- `src/` directory tree:
  - `src/core/types/` (domain models from PROJECT.md)
  - `src/core/history/` (ICommand, PlaceDeviceCommand, MoveDeviceCommand, RemoveDeviceCommand, ResizeRackCommand, AddCableCommand, RemoveCableCommand, MacroCommand)
  - `src/core/persistence/` (Zod ProjectSchemaV3, IndexedDB with WAL & crash recovery, lossless legacy migration pipeline, export/import service with checksum)
  - `src/core/state/` (ProjectStore, SelectionStore, HistoryStore, keyboard shortcuts listener)
  - `src/engine/bridge/` (EngineBridge decoupled event bus)
  - `src/app/` (App.tsx, main.tsx, index.css)
- `src-tauri/` (tauri.conf.json, Cargo.toml, src/main.rs, capabilities/default.json)
- `tests/unit/` (comprehensive unit tests: command.test.ts, persistence.test.ts, migration.test.ts, state.test.ts)

Execution Instructions:
1. Update `package.json` and install dependencies via `npm install`.
2. Implement the TypeScript domain models, command pattern, persistence layer, Zustand stores, EngineBridge, and application shell per the explorer blueprints.
3. Scaffold the Tauri v2 files.
4. Implement unit tests in `tests/unit/`.
5. Run the verification suite:
   - `npm run check` (TypeScript compilation + legacy checks)
   - `npm run test:unit` (Vitest unit tests)
   - `npm run test:legacy` (Legacy Playwright tests)
   - `npm run build` (Production Vite build)
6. Write your detailed handoff report to:
   `d:\cisco\cisco-42u-rack-cabling-studio\.agents\worker_m1\handoff.md`
   Document exact commands executed, build and test outputs, and layout compliance.
7. Notify parent (ID: 28ba35b6-b49b-4459-9a9a-e3dbad6f7bac) via send_message when done.
