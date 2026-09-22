# Phase 17 — Faceplate DOM Suspension

## Goal

Turn the macro Pixi renderer into a real DOM-count reduction instead of only a
paint substitution.

## Delivered

- After the retained Pixi device batches are ready, switch, router, patch,
  fiber, and PDU faceplate subtrees are detached from the live document.
- Detached nodes are retained by instance identity, so detail zoom restores the
  exact same elements and their accessibility attributes rather than rebuilding
  equivalent markup.
- SVG mode restores all suspended faceplates before hiding the Pixi canvas.
- D-ring organizers and blanking panels remain live because their DOM geometry
  is part of the current physical routing model.
- Stale detached entries are pruned when a device is removed or replaced.
- Port world geometry stays available through `DeviceSceneRegistry` while the
  port elements are absent from the document.

## Result

At macro zoom, repetitive port, bezel, label, LED, badge, and control nodes no
longer participate in selector matching, style recalculation, layout, paint, or
hit testing. At detail zoom the existing accessible interaction layer returns.

## Validation

- Unit coverage proves geometry remains queryable while nodes are detached and
  that restoration reuses the same node identities.
- Browser coverage counts live port nodes across macro/detail transitions and
  continues through the full Pixi cable regression suite.
