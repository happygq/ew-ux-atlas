## G203 v0.3 owner visual acceptance — 2026-11-10

**Owner confirmed “视觉复核通过。继续”** after reviewing the corrected handedness and grounding/foundation build. The previously accepted hip/valley/drainage geometry and the subsequently repaired two-ended decorative façade orientation, gable bearing and house wall/floor datum form the **G203 visual baseline**. Automated evidence: 38/38 G203 v0.3 tests. Acceptance does not claim full watertightness, measured device GPU performance, arbitrary topologies, or G204 T/U completion. Further work proceeds in a new `/g1-m2/t-u/` preview without modifying this accepted G203 page.

# G203 v0.3 — End-gable handedness, datum and physical bearing correction

**Status: code/tests complete; mobile visual review PENDING.** 2026-11-10. Owner previously accepted roof valley/drainage. v0.2 corrected the gable wall-seat Y only; it did not fix the adjacent house wall bottoms or foundation coverage. v0.3 addresses both issues and the newly reported inverted grey-brick exterior.

## What was wrong

1. The G1-M1 wall module is asymmetric: decorative grey masonry exists only on its local **+Z** surface. v0.2 mapped that surface to the *inner*, roof-facing world plane. Same module on opposite ends consequently presented the decorated face inside on one end. A mere `scale(-1)` would also invert triangle normals.
2. A local `wallSeat=0.280 m` was correctly transformed to the finished-floor Y=0.025 m, but the L-house perimeter plaster and piers still ended at Y=0.150 m (gap 0.125 m above the floor).
3. End gables occupy the world interval `[end,end+0.38 m]` outside the existing slab and are 3.6 m wide, while the regular roof slab is only 3.10 m across. Hence equal-height wall/floor datums **did not mean the wall was supported by the platform**.

## Fix

- Explicit `buildGablePlacement(arm,end,direction)` for main/wing and positive/negative world ends. Local +Z is the façade **exterior**, with translated/flipped world coordinates and triangle-winding correction for negative-determinant transforms. `GABLE_ASSEMBLY_CONTRACT=ew/ux/gable-facing-and-bearing-v0.3`.
- Preserve all accepted roof/eave geometry. Lower only the exterior walls and piers to the finished floor, keeping their upper elevations 1.63 / 1.57 / 1.67 m unchanged.
- Add two independent complete `stone + finished surface` terminal gable foundations, each Y=[-0.355,0.025] m, spanning the wall's full width and 0.38 m depth. This fixes structural support in X/Z as well as Y; no ground-plane trick is used.
- Explicit checks reject inward masonry, mis-seated gable / house perimeter, missing or floating per-gable foundations, and incorrect exterior face plane.

## Tests and invariance

- `node --test tests/l-valley.test.js`: **38/38 passing** (was 19 in v0.2).
- Exact original owner-accepted roof/hip/valley/eave vertex AND normal SHA-256 snapshots retained for standard and extended L: `e75e94ca...` and `55550cb3...`. No changes to those 26 meshes.
- Positive/negative main- and wing-axis gables produce reflected vertex multisets and outward-facing exterior normals, never inward normals.
- CPU triangle-mesh stills (overall + close-to-grade) are **previews**, not GPU screenshots. The owner must still approve actual mobile Safari visualization of the corrected base and outward-facing decorative brickwork.
- Work is isolated under `g1-m2/l-valley/`. No G1-M1, Stage 01, WP1.1, Authority or other research packages are changed.

**Review URL:** https://happygq.github.io/ew-ux-atlas/g1-m2/l-valley/?v=03 — select **墙脚近景** and inspect each end wall.


---

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
