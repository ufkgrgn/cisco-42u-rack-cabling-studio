# Phase 18 — Incremental Pixi Device Batches

## Goal

Stop rebuilding static faceplate geometry when only cable occupancy changes.

## Delivered

- Split the macro device scene into independently retained chassis and port
  state Graphics batches.
- Rack layout and registry generation now control the chassis signature.
- A normalized occupied-endpoint set controls the port-state signature.
- Cable add/remove operations redraw the port-state batch without recreating
  chassis geometry.
- Unchanged device scenes skip both batch rebuilds.
- Explicit layout invalidation still rebuilds both batches safely.
- Added telemetry for chassis rebuilds, port rebuilds, and occupancy-only
  updates.

## Performance effect

Cable mutations no longer repeat chassis round-rectangle, border, accent, and
bezel command generation for every visible device. Only the much smaller port
state batch is replaced, while the existing DOM-suspension and accessibility
handoff behavior remains unchanged.

## Validation

Browser regression coverage injects an occupancy-only cable mutation in macro
LOD and verifies that the chassis rebuild count is stable while exactly one
port batch rebuild is recorded.
