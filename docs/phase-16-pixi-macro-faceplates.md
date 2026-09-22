# Phase 16 — Retained Pixi Macro Faceplates

## Goal

Move the first production faceplate workload from repeated DOM descendants to
Pixi primitives while retaining the detailed, accessible DOM overlay where it
is useful.

## Delivered

- Added a device scene container behind the cable layers in the existing Pixi
  application. No second GPU context or animation loop is created.
- At macro zoom, visible switch, router, patch, fiber, and PDU chassis are
  rendered as one batched `Graphics` object and their ports as a second batch.
- Connected ports retain a distinct cyan state; category-specific chassis and
  accent colors preserve rack readability at fit-to-screen scale.
- Repetitive DOM faceplate descendants use `display: none` only after the Pixi
  replacement scene is ready. This removes their layout and paint workload.
- D-ring organizers and blanking panels remain DOM-rendered because their
  physical shapes participate in cable routing and rack structure.
- Returning to detail zoom restores the existing DOM faceplates, port
  interactions, tooltips, context menus, forms, and accessibility semantics.
- The device scene is retained across camera frames and rebuilt only when its
  geometry generation or cable occupancy signature changes.

## Safety and regression coverage

- SVG cable mode never suppresses DOM faceplates.
- Pixi initialization failure leaves DOM faceplates visible.
- Explicit geometry invalidation can repopulate the device registry from the
  mounted-device wrapper bounds even while macro LOD is active.
- Browser regression coverage verifies macro suppression, Pixi batch creation,
  and detail-mode restoration before continuing with cable hover tests.
