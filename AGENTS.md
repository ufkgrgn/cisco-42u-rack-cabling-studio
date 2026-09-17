# AI Agent Architecture & Development Guidelines

This document provides definitive instructions for all AI coding agents working on this codebase.

## 1. Absolute Rule: `app.bundle.js` is DELETED and FORBIDDEN
- **DO NOT** create, bundle, or reference `js/app.bundle.js` or `dist/js/app.bundle.js`.
- The monolithic 3,000+ line bundle has been completely decomposed and removed from the project.
- `index.html` and `dist/index.html` load individual, modular scripts directly via standard `<script>` tags.

## 2. Canonical 2D Architecture (`js/2d/`)
All 2D Rack & Cabling Studio features are organized into modular, single-responsibility files inside `js/2d/`:
- `js/2d/utils.js`: HTML escaping, `portKey`, tooltips
- `js/2d/catalog.js`: Cisco & generic hardware catalog specifications (`HARDWARE_CATALOG`)
- `js/2d/state.js`: Multi-rack application state, zoom state, DOM cache (`STATE`, `dom`, `getActiveRack`)
- `js/2d/zoom-manager.js`: Viewport pan, zoom, fit-to-screen (`fitRackToScreen`), jump navigation
- `js/2d/rack-manager.js`: Multi-rack tabs, add/rename/delete racks, switch active rack
- `js/2d/rack-renderer.js`: Rail slots (1–60U), device mounting (`mountDeviceAt`), faceplates
- `js/2d/cabling-engine.js`: SVG cable rendering (`renderAllCables`), dynamic D-ring channel routing
- `js/2d/schedule-table.js`: Cable schedule spreadsheet, pagination, connection role popovers
- `js/2d/topology-io.js`: JSON schema import/export (`loadCustomTopology`), Visio SVG export
- `js/2d/presets.js`: MDF, IDF, Full Site topology presets
- `js/2d/app.js`: Application lifecycle, event listeners, drag-and-drop, `window.RackStudio` export

## 3. UI Modals & Extracted Controllers (`js/`)
Extracted standalone controllers loaded directly in `index.html`:
- `js/port-config-editor.js`: Port configuration modal
- `js/device-metadata-editor.js`: Hostname, IP, MAC, asset tag editor
- `js/topbar-controller.js`: Fixed header actions & toolbar triggers
- `js/sidebar-controller.js`: Left library drawer & search
- `js/studio-bridge.js`: 2D Canvas $\leftrightarrow$ 3D WebGL synchronization bridge

## 4. 3D WebGL Studio (`js/src/3d/` & `js/src/3d-ui/`)
- 3D engine sources live in `js/src/3d/` and UI controls in `js/src/3d-ui/`.
- Compiled bundles `js/studio3d.js` and `js/studio3d-ui.js` are built via `npm run bundle`.

## 5. Development & Testing Workflow
- **Zero-Build 2D Editing:** Edits to `js/2d/*.js` take effect immediately upon refreshing `index.html` in the browser.
- **Verification Commands:**
  - `npm run check`: Runs bundle build for 3D and syntax check on `js/2d/app.js`.
  - `npm run test:legacy`: Runs Playwright headless tests against `index.html`.
  - `npm run test:unit`: Runs Vitest test suites.
  - `npm run test:performance`: Runs synthetic 100-rack smoke benchmark.
