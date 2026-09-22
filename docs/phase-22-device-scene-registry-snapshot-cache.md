# Phase 22: Device scene registry snapshot caching

## Scope

Reduce repeated allocations and redundant DOM scans while the retained Pixi device scene is active.

## Implementation

- Cache the immutable device/port snapshot and its frozen arrays for the current registry generation.
- Invalidate the cached snapshot only when a capture or explicit invalidation changes registry state.
- Track mounted device element references from the geometry capture rather than rebuilding a DOM-wide id map during every faceplate suspension.
- Make faceplate suspension idempotent within a geometry generation; newly captured layouts still scan once to detach newly mounted faceplates.
- Expose cache-build/hit and suspension scan/skip counters; assert stable snapshot identity and idempotence in unit tests.

## Verification

Run `npm run check`, `npm run test:unit`, and the Pixi cable interaction regression suite. Existing macro-LOD, occupancy, and detail-LOD restoration checks must remain green.

## Trade-off

This avoids allocating O(device + port) arrays during repeated retained-scene syncs and avoids repeated DOM maps for occupancy-only changes. Capture itself remains DOM-backed and still measures geometry when the mounted-device layout signature changes; replacing that source is a later architecture step.
