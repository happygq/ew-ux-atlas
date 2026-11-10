# UX-G204 — T/U junction boundary contract v0.1

## Scope and axes

Research geometry in metres: X is the continuous main eave/ridge direction, Y vertical, and positive Z is the branching direction. This is *not* an Authority or region/spatial-topology contract.

For every wing center `c`, the common seam at the junction has two diagonals, each descending as `z = abs(x - c)` within `0 ≤ z ≤ halfSpan`. The main roof owns the outside half of the seam; the wing roof owns the complementary wedge. A shared analytic height `Y(z) = eaveHeight + rise * (1 - z / halfSpan)` establishes identical physical seam vertex positions on both sides (allowing both roof parts to meet without overlapping full roof slabs).

The main ridge is continuous over the complete X extent; wing ridges run in positive Z. Ridge decoration can cover an intentionally defined joint but must not create missing eaves. The T model has one wing (2 valleys). The U model has two wings (4 valleys) and must retain a positive courtyard opening between the inner-facing eaves.

## Validation

- Shared seam stations: both roof skin meshes must contain equal world-space vertex sets along each diagonal; reject missing or shifted stations.
- Nonoverlap: main roof vertices must not enter branch-owned space, nor vice versa.
- Tiles: keep an explicit positive gap for metal/pan flashing at the seam, with tile cuts separately verified by real vertex coordinates.
- Drainage: valley centerline must strictly descend toward an exterior outlet with a lower outlet elevation; this is a geometric slope check, not hydrodynamics.
- Gable/foundation: all wall bodies end at common Y=0.025 finished floor; mirrored decoration points outdoors; corresponding stone and finish-floor bearing fully cover each gable foot.
- Determinism: same inputs reproduce identical geometry and normals; invalid wing proximity/clearance must fail before emitting bad geometry.

## Open issues

True boolean/closed manifold verification, rainwater system sizing, variable roof pitches, nonorthogonal junctions, R2.3 DTO adapter, GPU profiling and final interior-finish selection are beyond this v0.1 gate. The owner's observed dense interior piers are deferred to UX-F101 and UX-C101; see the Stage 03 README.
