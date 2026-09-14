# Original User Request

## 2026-09-14T19:12:21Z

Build a production-grade, 60 FPS Digital Rack Cabin Studio on a modern React + TypeScript + PixiJS v8 + Tauri stack, featuring dynamic variable U-height racks (1-60U), silky smooth drag-and-drop hardware placement, port-to-port cable routing, and an extensible legacy & modern hardware catalog.

Working directory: d:\cisco\cisco-42u-rack-cabling-studio
Integrity mode: development

## Requirements

### R1. Ultra-Fluid GPU Canvas & 60 FPS Viewport Engine
- Implement a 2D rendering canvas powered by PixiJS v8 (WebGL/WebGPU) with an intuitive React + TypeScript UI layer.
- Ensure butter-smooth multi-rack navigation, infinite canvas pan/zoom, and real-time device dragging with ghost previews and slot snapping at a sustained 60 FPS.
- Keep the render loop decoupled from heavy business logic and DOM manipulations so that viewport transformations incur zero layout thrashing.

### R2. Dynamic Variable U-Height & Conflict-Free Placement Engine
- Support arbitrary rack dimensions from 1U up to 60U (and beyond) with front/rear mount viewpoints.
- Enforce strict placement validation: prevent physical device collisions, prohibit rack height shrinkages that clip occupied units, and provide instant visual feedback.
- Guarantee that hardware moves and rearrangements preserve hardware identity, attached port endpoints, and cabling topologies.

### R3. Extensible Legacy & Modern Hardware Catalog with Custom Device Wizard
- Provide a structured catalog schema supporting both modern and legacy equipment (switches, patch panels, servers, PDUs, cable organizers) with physical dimensions, port matrices, transceivers, and power specifications.
- Include a zero-code wizard and import format (JSON/YAML) enabling users and enterprises to add custom hardware definitions without modifying the core codebase.
- Provide sub-100ms fuzzy search and filtering across manufacturers, port types, PoE capability, and unit heights.

### R4. Intelligent Cabling & Inter-Rack Connectivity
- Support port-to-port connections with realistic cable tracing, color coding, category tagging (fiber, copper, DAC, power), and auto-bundling at zoomed-out scales.
- Fully support inter-rack cross-connects and patch panel links with persistent endpoint references.
- Display cable schedules, connection summaries, and connection validation warnings (e.g. connector mismatch or capacity exhaustion).

### R5. Project State, Command History & Cross-Platform Packaging
- Comprehensive undo/redo command architecture (Ctrl+Z / Ctrl+Y) covering all placement, deletion, rack resize, and cabling operations.
- Local offline auto-save via IndexedDB with crash recovery and reliable JSON project export/import with schema migration for legacy files.
- Packageable as a high-performance desktop app via Tauri alongside modern web/PWA browser support.

## Acceptance Criteria

### Performance & Responsiveness
- [ ] Pan, zoom, and hardware drag interactions sustain 60 FPS (p95 frame time <= 16.6ms) on standard desktop hardware with at least 10 fully populated 42U racks visible.
- [ ] Viewport navigation and dragging produce zero frame freezes exceeding 20ms.
- [ ] Hardware catalog search across 1,000+ devices updates results in under 50ms.

### Placement & Rack Flexibility
- [ ] Rack U-height can be adjusted dynamically between 1U and 60U; resizing down is blocked or alerted if occupied slots would be truncated.
- [ ] Device drag-and-drop snaps accurately to rack unit boundaries with clear collision highlighting.
- [ ] Moving a device retains its unique IDs and all connected cables seamlessly update their coordinates.

### Catalog & Custom Hardware
- [ ] Legacy and modern network devices from existing catalog and templates are completely migrated and accessible.
- [ ] User can define a new custom device through the UI with custom U-size and port layout, and immediately place it into any rack.

### Cabling & Data Integrity
- [ ] Both intra-rack and inter-rack cables render accurately and update dynamically during rack or device repositioning.
- [ ] Full undo and redo correctly reverses and reapplies any sequence of modifications.
- [ ] Exported project files can be re-imported with 100% data fidelity, and invalid or corrupted files are caught cleanly without corrupting active workspace.
- [ ] Automated end-to-end and unit tests pass cleanly for core placement rules, state history, and catalog searches.
