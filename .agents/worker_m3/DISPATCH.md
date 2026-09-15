## 2026-09-14T22:14:17Z
You are Worker M3 for the Digital Rack Cabin Studio project.

Working directory: d:\cisco\cisco-42u-rack-cabling-studio\.agents\worker_m3
Workspace root: d:\cisco\cisco-42u-rack-cabling-studio
Original request path: d:\cisco\cisco-42u-rack-cabling-studio\.agents\ORIGINAL_REQUEST.md
Master Project Plan: d:\cisco\cisco-42u-rack-cabling-studio\.agents\PROJECT.md
Test Verification Guide: d:\cisco\cisco-42u-rack-cabling-studio\TEST_READY.md
Node v24 is available at: C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read ORIGINAL_REQUEST.md, PROJECT.md, and the three Explorer reports before starting work:
- Explorer 1 Report: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_g3_1\handoff.md
- Explorer 2 Report: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_g3_2\handoff.md
- Explorer 3 Report: d:\cisco\cisco-42u-rack-cabling-studio\.agents\explorer_m3_g3_3\handoff.md

Your Mission for Milestone M3 (Dynamic Variable U-Height 1-60U & Conflict-Free Placement Engine):
Implement features F2.1 through F2.5:
1. Create `src/core/placement/` domain module implementing the architecture contracts in PROJECT.md § 4:
   - `src/core/placement/types.ts`: PlacementValidationResult, CanResizeRackResult, IntervalOverlap.
   - `src/core/placement/dimensions.ts`: EIA-310-D standard dimensions (1U = 32px, hole offsets [4.57, 16.0, 27.43]px, 1-60U bounds), uToLocalY, localYToU.
   - `src/core/placement/collision.ts`: checkAABBOverlap, validatePlacement(rack, device, targetU, targetFace?), self-collision exemption, face-isolated collision checks.
   - `src/core/placement/rackMath.ts`: canResizeRack(rack, newTotalU), maxOccupiedU across both faces, shrinkage prohibition below maxOccupiedU, 1-60U integer validation.
   - `src/core/placement/cableRetention.ts`: recalculateCableEndpoints, validateCableTopologyIntegrity.
   - `src/core/placement/index.ts`: barrel re-export.
2. Fix MoveDeviceCommand and refactor commands:
   - In `src/core/history/commands/MoveDeviceCommand.ts`:
     - Intra-rack moves and face flips must iterate through state.cables, update c.from.face/c.to.face and c.from.rackId/c.to.rackId, and always populate _affectedCableIds with all connected cable IDs.
     - Invertible undo() must cleanly revert face and rackId for all attached cables.
     - Delegate collision & bounds check to validatePlacement.
   - In `src/core/history/commands/PlaceDeviceCommand.ts`: Delegate validation to validatePlacement.
   - In `src/core/history/commands/ResizeRackCommand.ts`: Delegate validation to canResizeRack.
3. PixiJS Scene Graph & Viewport Engine updates:
   - `src/engine/scene/RackContainer.ts`:
     - Support dynamic totalU updates via `setTotalU(newTotalU: number)`.
     - Recompute rackHeight, frame graphics, dynamic unit rails, EIA-310-D hole patterns, and U-number labels.
     - Support viewpoint switching via `setActiveFace(face: 'front' | 'rear')` with visual badge [FRONT] / [REAR].
   - `src/engine/scene/SceneGraph.ts`:
     - In syncRacks(), detect if container.totalU !== rackModel.totalU and update container accordingly.
     - Propagate activeFace to all RackContainers and DeviceContainers.
   - `src/engine/scene/DeviceContainer.ts`:
     - Render normalized xPct / yPct port coordinates.
     - Render front facia and ports when face is 'front'; render rear facia / rearPorts when face is 'rear'.
   - `src/engine/interaction/DragManager.ts`:
     - Use checkAABBOverlap from `src/core/placement` for collision checking.
   - `src/engine/bridge/EngineBridge.ts` & `src/engine/canvas/PixiCanvas.ts`:
     - Wire 'view:toggle-face' event so React toolbar can toggle viewpoint across canvas racks.
4. React Toolbar UI updates:
   - `src/app/components/Toolbar.tsx`:
     - Add Front / Rear viewpoint toggle with active state indicator.
     - Dynamic rack height selector (presets + custom 1-60U input with validation / shrinkage rejection warning).
     - Wire Zoom In, Zoom Out, and Fit View buttons to EngineBridge.
5. Unit Testing & Verification:
   - Create `tests/unit/placement.test.ts` covering all 21 edge cases:
     - 1U to 60U boundaries, non-integer/0U/61U rejection.
     - Abutting devices (valid, no collision).
     - Overlapping intervals (invalid, collision).
     - Dual-sided collision isolation (front and rear do not collide).
     - Self-collision exemption when moving within same rack.
     - Shrinkage below max occupied unit blocked.
     - Shrinkage to exact top unit allowed.
     - Empty rack shrinkage to 1U allowed.
     - Intra-rack move populates affectedCableIds.
     - Face flip updates cable endpoint face.
   - Run verification commands using Node v24:
     - `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" tests/e2e/runner.cjs` (must pass 326/326, 100%)
     - `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vitest/vitest.mjs run` (all tests pass)
     - `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/typescript/bin/tsc --noEmit` (clean)
     - `& "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe" node_modules/vite/bin/vite.js build` (clean)
6. Write full handoff report to `d:\cisco\cisco-42u-rack-cabling-studio\.agents\worker_m3\handoff.md` and send completion message to parent.
