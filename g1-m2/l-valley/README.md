# EW-UX G1-M2 · Stage 02 (UX-G203): L-shaped roof valley

**Status: roof valley and drainage owner-accepted; gable floor-datum correction v0.2 pending visual recheck.**

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

## Owner review and floor-datum correction (2026-11-10)

- Owner accepted G203 roof corner, concave valley and drainage design, but observed gable / building bottom misalignment.
- Confirmed root cause from actual mesh positions: `MH-01` local wall seat `Y=0.280 m` versus L-floor finish `Y=0.025 m` (0.255 m floating gap). This is a **datum registration error**, not evidence of insufficient wall height.
- Correction: translate entire gable mesh by `finishedFloorY - module.wallSeat.y`, for both X-end and Z-end gables. Keep approved G1-M1 module master and all non-gable roof/eave/floor vertices byte-identical.
- Added 3 regression tests including deliberate height-corruption detection; 19/19 passes. The v0.1 archive's test/export import paths were also repaired to point to `site/src`, so extracted archive is runnable.
- The accepted hip/valley geometry retains the owner's approval. **Only the corrected wall-base visual check remains open.**
