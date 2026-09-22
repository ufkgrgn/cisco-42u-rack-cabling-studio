# Phase 20: Atlas-backed Pixi device chassis

## Scope

Move the static macro-LOD device body shapes from repeated Pixi vector paths into a shared generated chassis atlas. Detail faceplates and their editable DOM controls remain unchanged.

## Implementation

- Generate six antialiased category chassis textures once per Pixi renderer.
- Render chassis bodies with nine-slice sprites so corners and borders retain their shape as rack devices vary in width.
- Keep category accent strips and inset bezel details in one retained overlay `Graphics` object.
- Retain the chassis sprite and overlay layers until device geometry changes; cable occupancy updates do not rebuild them.
- Add telemetry and browser regression assertions for atlas reuse and chassis rendering.

## Verification

Run `npm run check`, `npm run test:unit`, and `node --test tests/pixi-cabling-interaction.test.cjs`. The browser probe must confirm an atlas-backed macro scene and that cable occupancy updates do not rebuild the chassis atlas.

## Trade-off

The shared texture can batch bodies while avoiding repeated rounded-rectangle tessellation. This introduces one chassis sprite per rendered device in macro LOD. Detail LOD continues to use the existing DOM faceplates; this phase does not claim an across-the-board GPU improvement without hardware profiling.
