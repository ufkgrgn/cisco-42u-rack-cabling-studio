# Phase 19: Atlas-backed Pixi device ports

## Scope

Replace repeated per-port Pixi `Graphics` commands with retained sprites that share one generated texture atlas. Port geometry is created when the macro device scene geometry changes; cable occupancy changes update only the affected endpoint sprites.

## Implementation

- Generate one antialiased atlas for free copper, free optic, and occupied ports.
- Reuse atlas-backed textures across every port sprite.
- Keep the chassis and port sprite container retained between occupancy changes.
- Track each port sprite and its previous occupancy by `instanceId::portId`.
- Expose port rebuild, occupancy update, and changed-port counts in Pixi telemetry.
- Preserve DOM faceplates at detail LOD and leave cable interaction/rendering paths untouched.

## Verification

The Pixi interaction regression probe asserts a cable connection reuses the port sprites and changes exactly its two endpoint states. Run the repository's Pixi interaction suite and normal project checks before release.

## Trade-off

This reduces repeated vector path construction and redraw work while adding lightweight Pixi sprite objects. Sprites share a single atlas source to permit renderer batching. The change is limited to macro LOD; detail faceplates remain DOM-rendered.
