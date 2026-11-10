# EW-UX G1-M2 · Stage 02 (UX-G203): L-shaped roof valley

**Status: implementation candidate; NOT visually accepted.**

- Base: owner-accepted `G1-M1 v0.3` and `G1-M2 Stage 01` continuous straight RoofGroup.
- Scope: deterministic L-shaped footprint, two orthogonal roof ridges, exact no-overlap substrate partition, roof-tile cutting, SW hip, NE valley with geom. monotonic fall and an outlet into the courtyard, consistent G1 wall/eave materials.
- Site path: `/g1-m2/l-valley/`, separate from `/` and `/g1-m2/` accepted experiences.
- Not covered: actual R2.3 RoofGroup DTO, arbitrary angles, T/U or multilevel roof, full manifold/watertight mesh, rainwater dynamics, indoor collision, mobile GPU/real WebGL performance.

## Run locally

```bash
python -m http.server 8998 --directory site
# Open http://localhost:8998
npm test
```

The page uses ES modules from `site/src/` and keeps a static, mesh-derived image fallback for mobile/Safari. No external runtime dependency, API key or Authority link.

## Geometry contract

See [docs/L-Valley-Boundary-Contract-v0.1.md](docs/L-Valley-Boundary-Contract-v0.1.md).

## Test evidence

The Stage 02 `node --test tests/l-valley.test.js` suite has 16 tests. Baseline Stage 01 tests are independent; no accepted stage files have been changed. Numerical geometry tests are not a substitute for browser visual acceptance.

## Owner's next visual inspection

In the live page select **标准 L** and **阴角特写**; inspect the center ridge intersection and the diagonal descending to courtyard. Turn on **谷线标识** to compare intended geometry with the visible seam, then **移除瓦层** to inspect the underlying cut edge. Switch to **延长主翼** to ensure asymmetrical dimensions keep the same join rule. Report any tile fall-through, dark gap outside the flashing, floating gable cap, inverted slope, unsightly stone splice or obvious mesh z-fighting.

## Isolation

No changes to official `happygq/Expandable-Worlds` or WP1.1/Authority; no change to accepted `ew-ux-atlas` `/` or `/g1-m2/`. Geometry is a visual research fixture, not an authenticated world transaction.
