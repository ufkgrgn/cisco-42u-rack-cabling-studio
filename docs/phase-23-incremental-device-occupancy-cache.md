# Phase 23: Incremental device occupancy cache

## Scope

Remove per-sync allocation, sorting, and string joining from the Pixi device occupancy check.

## Implementation

- Fingerprint cable endpoints in one pass using two independent 32-bit rolling hashes and endpoint/cable counts.
- Reuse the prior occupied-port `Set` when the fingerprint is unchanged.
- Rebuild the set only after the endpoint fingerprint changes; port sprite updates still compare endpoint occupancy and touch only changed ports.
- Add telemetry for fingerprint checks and occupancy-set rebuilds.
- Extend the browser regression probe to assert cache reuse on a no-op sync and one cache rebuild/two sprite updates for a new connection.

## Verification

Run `npm run check`, `npm run test:unit`, and `node --test tests/pixi-cabling-interaction.test.cjs`.

## Trade-off

This replaces an O(cables log endpoints) sort/string construction plus a `Set` allocation on each sync with a linear pass and only rebuilds the `Set` on change. The fingerprint is order-sensitive, so harmless cable reordering may trigger an extra set rebuild; the two independent hashes and counts make accidental collision extremely unlikely, but it is a probabilistic fingerprint rather than byte-for-byte equality.
