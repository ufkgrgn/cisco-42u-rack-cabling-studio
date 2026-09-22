# Pixi faceplate migration baseline

## Scope

Captured before expanding the retained Pixi device scene beyond its existing macro LOD. This is a diagnostic baseline for the next rendering phase, not a GPU-utilization or low-end-device certification.

- Date: 2026-09-22 UTC
- Harness: `npm run test:performance:compare`
- Browser: headless Microsoft Edge, 1600×1000
- Synthetic workload: 10 racks, 30 1U devices per rack, 200 cables per rack; 120 camera-pan frames and 30 cable-render requests per scenario
- Report: `tests/performance-results-pixi-faceplate-phase0.json` (local ignored output)

## Results

| Layout / LOD | Renderer | DOM elements | Live port nodes | Pan frame p95 | Cable render p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Single / detail | SVG | 7,057 | 840 | 10.4 ms | 42.5 ms |
| Single / detail | Pixi cables, DOM devices | 7,057 | 840 | 10.4 ms | 0.4 ms |
| Single / macro | SVG | 7,057 | 840 | 10.5 ms | 27.8 ms |
| Single / macro | Pixi cables + device LOD | 5,509 | 0 | 10.3 ms | 0.9 ms |
| Multi / detail | SVG | 37,401 | 8,400 | 20.1 ms | 824.4 ms |
| Multi / detail | Pixi cables, DOM devices | 37,401 | 8,400 | 10.7 ms | 2.0 ms |
| Multi / macro | SVG | 37,401 | 8,400 | 29.2 ms | 814.6 ms |
| Multi / macro | Pixi cables + device LOD | 21,921 | 0 | 10.5 ms | 2.6 ms |

The macro Pixi device LOD detaches the faceplate and port subtrees but keeps mounted-device wrappers and rack/slot DOM. Detail LOD still uses the full DOM faceplate and port tree in both cable modes. Consequently, Pixi cable rendering is already substantially cheaper in this synthetic workload, but the full device DOM migration has not happened.

After the connector-atlas update, the same harness was rerun (`tests/performance-results-pixi-faceplate-phase1.json`, local ignored output). DOM counts and live port-node counts were unchanged, as expected for a texture-only change. Multi-rack Pixi macro pan p95 was 10.3 ms versus 10.5 ms in the baseline run; Pixi render average was 3.63 ms versus 3.83 ms. These are single-run diagnostic values and the small differences are within run-to-run noise; no performance gain is claimed for the atlas work.

## Interpretation and next gate

The clearest remaining faceplate opportunity is repeated port/faceplate DOM in detail and multi-rack views. The current retained Pixi scene is intentionally coarse at macro zoom. The first implementation slice adds connector-specific shared atlas cells (RJ45, SFP, LC duplex, SC duplex, and power) while keeping the existing macro-only activation boundary. This is a visual-parity step; it is not yet evidence that detail faceplates or interaction hit-testing can safely move to Pixi.

Before widening Pixi device rendering to detail LOD, require matched visual checks for device categories, connected/role-colored ports, organizers and labels; canvas hover/click/context-menu tests; and repeated SVG/Pixi runs on real project data and a lower-end device. Headless timings do not expose GPU utilization and do not certify physical presentation cadence.

## Phase 3: selective detail-LOD port migration

At detail zoom, the rack faceplate and its DOM controls remain in place, while ordinary switch/router-family port areas are replaced with layout-preserving placeholders and rendered as Pixi connector sprites. Device categories not in this migration slice (patch panels, fiber panels and other hardware), plus devices with special/trunk/PoE-disabled role classes, keep their original port DOM. The existing device-scene spatial index handles hover, click, and connection workflow on Pixi ports. Macro LOD still uses the existing whole-faceplate Pixi treatment. Switching render modes or LOD restores detached DOM nodes; returning from macro to detail re-applies only the eligible port-area detachment.

The Playwright interaction suite now resolves endpoint test points from the device-scene registry instead of querying `.port` nodes that are intentionally absent. It verifies detail/macro transitions, retained cable picking after zoom/resize and rack deletion, macro connector interaction, and that detail mode leaves non-migrated port DOM present. `npm test` and `npm run check` passed on 2026-09-23.

A reduced matched comparison was also run once with 2 synthetic racks, 60 devices, 400 cables, and 30 animation-frame samples per scenario. In multi-rack detail, Pixi reduced live port nodes from 1,680 to 896 (-46.7%) and total DOM elements from 10,385 to 9,349 (-10.0%); repeated cable-render p95 fell from 68.0 ms to 0.3 ms. However, the pan-frame p95 was 24.4 ms in Pixi versus 28.5 ms in SVG (small improvement in this short sample), while reported JS heap was 53.5 MB versus 10 MB. In the single-rack detail sample, p95 pan interval was 20.1 ms in Pixi versus 19.6 ms in SVG, and heap was 33.1 MB versus 10 MB. All pages had zero JS errors, but the harness cannot observe GPU utilization or physical frame presentation. These are mixed, single-run diagnostic results—not evidence that detail port migration makes the whole application smoother. They indicate cable update CPU work and DOM count improve, while renderer memory/scene cost and frame pacing still need investigation.

Before expanding scope, run repeated matched comparisons at the full 10-rack workload, isolate the additional Pixi memory and multi-rack camera-commit cost, and perform a low-end physical-device visual/interaction check—especially port role, PoE, connected-state parity, and right-click behavior. Do not treat cable-render p95 alone as an overall performance win.

## Phase 2: macro Pixi port interaction bridge

The macro Pixi LOD previously removed the faceplate DOM (including `.port` nodes) but exposed no replacement port hit testing. The renderer now builds a world-space spatial grid alongside the retained port sprites. Pointer movement examines only nearby grid cells, highlights the resolved port, and opens the existing port tooltip; primary click is routed into the existing connection workflow, while right-click opens the existing port configuration editor. The DOM faceplate remains the interaction path at detail LOD.

The bridge uses a small DOM-like adapter rather than creating hidden nodes. Rack lookup now resolves the device's actual rack (important in multi-rack mode), and catalog lookup falls back to custom/catalog items. A Playwright regression probe verifies exact port identity for hover and starting a connection while macro LOD has detached all port nodes.

This phase restores basic macro port interaction; it does not yet migrate detail faceplates, labels, port-role styling, or device controls into Pixi. The spatial lookup is bounded by nearby 32-world-unit cells, but no dedicated physical-device or pointer-latency benchmark was run for this change. Do not infer GPU or overall performance gains from the interaction test.
