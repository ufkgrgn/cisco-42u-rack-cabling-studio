# Phase 21: Macro device rack viewport culling

## Scope

Partition the retained Pixi macro device scene by rack and skip rendering complete rack subtrees outside the current camera viewport.

## Implementation

- Group each rack's chassis sprites, detail overlays, and port sprites under one Pixi container.
- Compute each rack group's world bounds from its device records during geometry rebuilds.
- Reuse the viewport camera's world-space culling rectangle and update rack-container visibility on camera/resize synchronization.
- Keep occupancy updates endpoint-local and preserve groups across cable changes.
- Add culling telemetry and a browser regression probe that pans outside the scene and restores the camera.

## Verification

Run `npm run check`, `npm run test:unit`, and `node --test tests/pixi-cabling-interaction.test.cjs`. The browser probe must verify visible rack retention, offscreen rack culling, restoration, and the existing two-port occupancy update contract.

## Trade-off

This reduces display-tree traversal and submitted content for offscreen racks, especially in multi-rack views. Bounds are rack-level rather than per-device, so a partially visible rack still renders all of its devices; this avoids an O(port-count) visibility walk on every camera update.
