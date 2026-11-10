# EW-UX · G1-M2 Stage 03 · G204 T/U roof assembly

**Research candidate v0.1, 2026-11-10 · NOT owner-visually accepted**

Standalone study at `/g1-m2/t-u/`; the owner-accepted G203 v0.3 and G1-M1/G1-M2 Stage 01 are not modified. This model does not connect to WP1.1/Authority or the R2.3 build interaction layer.

## Implemented research scope

- One continuous main roof ridge in X, plus one positive-Z wing (T) or two positive-Z wings (U), each with its own ridge and genuine ridge junction.
- Deterministic roof ownership regions: main roof and wing geometry are clipped to their respective domains; no full-roof slab intersections.
- Two valley channels per wing (T = 2, U = 4), with a lowered pan, edge trims, exterior outlet and a mathematically downhill path.
- Local gray tiles clipped back from the valley pan by a positive clearance; eave rafters, fascia, drip line, floor and gables generated along actual visible boundaries.
- Reuse of G203 left/right gable handedness and wall/floor datum (0.025 m). Only the T/U research code is new.
- T/U roof static previews generated from actual source triangular meshes, with a mobile-accessible static-image fallback.

## Test evidence

`node --test tests/t-u-roof.test.js` — **23/23 PASS** on this Stage 03 candidate; includes real roof edge vertex coincidence, clipped tile domain exclusion, drainage descent, gable orientation/floor-bearing, determinism, deliberate mutation rejection and previously accepted G203 reproducibility.

These are focused G204 tests. They do not prove global manifold watertightness, full R2.3 semantic integration, physical hydrodynamics, broad parameter/configuration coverage, mobile GPU frame rate or a visually accepted T/U composition.

## Deferred interior-surface issue (owner finding)

During roof-layer removal the owner observed **too many visible vertical piers on interior walls**, compromising a clean interior-design surface. The current `facade-bearing-piers` is an evenly repeated geometry study placeholder; it is **not** a final structural layout. No G204 roof-junction change should be blocked by this.

Carry the finding into **UX-F101 / G2** and **UX-C101 / G3**: keep interior wall finishes spatially continuous by default; introduce only intentional structural frames, visible columns or pilasters; separate `supportGeometry` from `finishSurface`, and suppress redundant modular-bay posts on shared interior boundaries. In G2/G3 verification include a roof-hidden interior view and a room-side seam/pillar count. This does not authorize weakening support or occupancy rules.

## Validation checklist before owner acceptance

- In mobile Safari switch T ↔ U and orbit the model.
- Confirm one continuous main ridge, distinct wing ridge joints, T two valleys and U four valleys.
- Inspect valley close-ups, clipped tiles and courtyard-facing eaves; ensure no visible floating wall bases or inverted gable decoration.
- Record any visible roof perforation, floating eave, thin sliver, or unwanted overlap as an issue. Do not mark G204 complete merely because tests pass.

