# Phase 15 — Pixi Device Scene Foundation

## Goal

Prepare the rack faceplate and port layer for a retained Pixi renderer without
breaking the existing DOM interactions, accessibility controls, cable routing,
or SVG fallback.

## Delivered

- Added `DeviceSceneRegistry` as the shared geometry contract between DOM
  faceplates, Pixi device primitives, and Pixi cable endpoints.
- Port geometry is measured once per catalog model and stored as normalized
  coordinates. Additional instances of the same model reuse that template.
- Device instances publish lightweight world-space bounds and port records.
- The Pixi cable renderer resolves endpoints from the registry before falling
  back to live DOM measurement.
- Cable-only state changes do not recapture device geometry. The capture key is
  limited to rack layout, device placement, model, height, and view mode.
- Explicit layout invalidation clears instance geometry while retaining catalog
  templates, so resize and layout recovery remain correct.

## Why this phase comes first

Removing port DOM before endpoint geometry has another source would make cables
disappear or shift. This phase establishes that source and keeps the current UI
fully operational. The next phase can render the same snapshot as Pixi
primitives and progressively remove inactive faceplate and port DOM nodes.

## Validation

- Registry unit tests verify one-template/multi-instance projection and safe
  instance invalidation.
- Existing Pixi interaction regression tests verify incremental append, layout
  invalidation, hover, selection, and retained geometry behavior.
- The full unit, legacy, syntax/build, and synthetic performance suites remain
  the release gate.
