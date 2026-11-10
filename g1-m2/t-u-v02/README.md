# EW-UX · G204 v0.2 — Symmetry-aware Gables & Clean White Walls

**Independent research candidate · NOT owner-visually accepted · 2026-11-10**

Preview: `https://happygq.github.io/ew-ux-atlas/g1-m2/t-u-v02/` (when deployed).

G204 v0.2 retains the approved G203 L-valley build unchanged. It introduces **two independent gable contracts**: (1) silhouette profile (`AUTO`/`BILATERAL`/`ASYMMETRIC`) and (2) surface detail (`PLAIN`/`LEGACY_DECORATED`). `PLAIN` is the **default**. `LEGACY_DECORATED` remains an explicit comparison variant for the Atlas and is not selected automatically.

## New visual design decision

The primary Huizhou Fantasy Architecture language is a *continuous pale-plaster wall*, stepped parapet silhouette, curved dark-tile coping, a small number of functional horizontal construction lines, and a continuous stone footing. Applied gray-brick patches, repeated decorative vertical pilasters, simulated narrow corner coves and related joint strips are **not part of the default generated mesh**. This is a mesh-level removal, not a renderer-only visibility toggle. The eaves, roof skin, rafters, courtyard, water valleys and outlets remain independent.

The T form uses a *single* physically continuous bilateral center gable, not two coincident half-walls. The U form uses a mirrored pair of outward-facing wing profiles. Silhouette handedness and exterior-facing direction remain separate parameters.

## Quality evidence / limits

- Baseline before surface adjustment: 35/35 focused Node tests passing in this separate working copy.
- G204 v0.2 default/legacy comparisons: **42/42** focused Node tests passing, covering physically mirrored profiles, non-gable mesh hashes for T/U, default absence of applied ornaments, optional legacy support, invalid mode rejection and injected-ornament detection.
- Example default model counts: T 79,297 triangles vs decorated 81,169; U 101,090 vs 103,058. The optimization is geometric and deterministic; numbers vary with inputs.
- Four pairs of visual reference PNGs were rendered from actual model triangle meshes; interactive preview uses WebGL2 with mobile static-image fallback. Local Playwright browser access to loopback was denied by the runtime administrator, so a real Safari/WebGL visual review **remains open**.

## Deferred separate issues

Dense `facade-bearing-piers` along room-side boundaries are an existing G2/G3 issue (`UX-F101`, `UX-C101`). The present G204 change removes only applied *gable ornaments*, not actual room/interior support semantics. Full manifold/watertight geometry, R2.3 DTO adapter, arbitrary asymmetric massing, real device GPU budget, and final T/U visual acceptance remain open.

## Reproduce

`node --test tests/*.test.js`

`node export-previews.mjs && python render-tu.py`

No WP1.1, Authority, G203, or previously accepted EW-UX entry page is edited in this deliverable.
