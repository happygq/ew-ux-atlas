# G1-M2 · Architectural Assembly and Seam Validation — Stage 01

**Research build v0.1 · STAGE 01 OWNER VISUAL ACCEPTED / G1-M2 OVERALL IN PROGRESS**

This is a new **independent, read-only RoofGroup research page** under `/g1-m2/`, separate from the owner-accepted G1-M1 v0.3 root site. No modifications to WP1.1, Authority, R2.3 input handlers, or the accepted G1-M1 viewer.

## Owner visual acceptance · 2026-11-10

**Stage 01 — accepted by the project owner.** The owner inspected the live G1-M2 browser preview and confirmed “检查完毕，验证通过。” This approval applies to the two-room and six-room **straight-line continuous RoofGroup** layouts and their presented wall/roof/eave composition.

**Not a full G1-M2 completion claim.** UX-G201 (real R2.3 RoofGroup DTO binding), UX-G203 (L-shaped valley and drainage), UX-G204 (T/U), UX-G205 (height transitions), complete mixed-family watertightness and actual GPU-performance checks remain open. The 29/29 Node test result belongs to Stage 01. The next work is G203's valley/corner boundary contract and deterministic renderable geometry.

## Covered now (candidate implementation)

- UX-G201: Straight-line common RoofGroup profile for **two** and **six** contiguous room units; a common pitch, height, ridge axis and tile phase. The roof may be segmented for geometry budget but is **not** recreated as one miniature roof per room.
- UX-G202: Two piecewise roof spans checked at shared X=0 for boundary profile, tangent, normals, tile phase and actual tile-edge vertex equality; shared world-X stations for repeat eave details.
- UX-G109 continuation (cross-family): transforms original G1-M1 horse-head walls from local gable profile to physical X-end planes, checks end seating against actual `capSpans`, and composes separate timber eave details without duplicating eave roof sheets or dummy walls.
- UX-G206 subset: Actual joint assertions, misregistration rejection, deterministic full-scene vertices, finite normals, triangle budget and bad-input tests.

## Limits / outstanding Gates

**Stage 01 straight-line layouts are owner-accepted; this is not acceptance of G1-M2 overall.** Currently absent: real R2.3 RoofGroup import, curved/non-axis-aligned outlines, L-shaped valleylines, T/U roofs, stepped height junctions, arbitrary-angle wall junctions, manifold watertightness and actual mobile-GPU performance evidence. In particular, no naive overlapping slab roof is presented as an accepted valley solution.

CPU triangle previews included in this folder are generated from the exact parameterized meshes, not concept images, and do **not** establish WebGL visual gate success. The owner has accepted the presented Stage 01 visual result; broader seam topologies and objective close-up/GPU verification remain open.

## Reproducibility

Run from local source root:

`node --test tests/atlas.test.js tests/roofgroup.test.js`

The parent `src/` directory holds baseline G1-M1 modules, `src/roofgroup.js` adds Stage 01 assembly. `/g1-m2/src/` is the self-contained browser mirror. Static screenshots come from `render-preview.py`, using `tools-export.mjs` for geometry evidence. This is deliberately independent from formal world authority.