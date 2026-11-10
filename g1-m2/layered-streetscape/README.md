# EW-UX · G205-A — Layered Gable Streetscape Study v0.1

**Independent visual experiment · NOT visually accepted** · 2026-11-10

Proposed public preview: `https://happygq.github.io/ew-ux-atlas/g1-m2/layered-streetscape/`

## What this actually builds

A/B/C compose **6–10 real parametric roofed buildings**, grouped in three depth rows. Every building has two real stepped-gable end walls, roof shell, a curved tile-course layer, eaves, side-wall surfaces and continuous ground-bearing foundation. Each gable is a semantic part of its own building; there are **no free-floating disconnected wall-card props**. The photographed Huizhou streetscape is a *visual study reference*, not re-uploaded to the public demo.

- **A Balanced:** 3 rows, 7 buildings, midrow slightly dominant; bilateral and single-sided fan forms mixed.
- **B Hero:** 3 rows, 6 buildings, two higher midrow hero gables, modest supporting foreground/background.
- **C Dense:** 3 rows, 10 buildings, denser alignment with overlapping silhouettes.

The controls change bounded row gaps, stagger and relative heights; each setting deterministically rebuilds the full triangle mesh and rejects footprint collisions. Camera presets are street-oblique, low-street, elevated. A row isolation control makes apparent overlaps inspectable. Each preset has an actual-mesh offline PNG fallback (no generic stock/AI image).

## Independent G204 orientation proof included

A local **G204 v0.3.1 candidate** corrects T-model terminal gables in **world-X reflection**. Both terminal cap profiles remain in the same Z frame because world-X reflection does not negate Z; the previous code incorrectly inverted one side's local Z silhouette. The isolated `t-u-roof.js` validates the two actual end profiles and their matching cap levels, and tests the reflected wall vertices.

For U, both courtyard wing end walls retain reflected half-fan pairs but use a **smaller tier rise (.31 m versus .40 m)** to subordinate them visually to the main bilateral gables. This is an experimental aesthetic hierarchy, not a claim about mandatory historical construction.

## Verification

Run from the source root:

```bash
node --test tests/*.test.js
node export-previews.mjs
node export-tu.mjs
python render.py
```

**78/78 Node tests passed**: original 63 plus 15 new. Includes deterministic rebuild, plan-collision rejection, ground datum, normal/position finiteness, T terminal reflection, U wing hierarchy, and G203/G204 candidate regression. Browser UI was syntax-checked, but **actual browser WebGL automation was blocked by local browser policy**; mobile visual confirmation remains the owner's responsibility.

### Known limits before acceptance

- Despite three visible depth bands, the first candidate reads as *small detached compounds* more than a compact historical Huizhou village streetscape. The owner should decide whether packing/density/hierarchy is convincing before expanding it.
- True building shared-wall semantics, village plot street width, fire separation, realistic terrain, gutters and historical construction are not yet modeled.
- Building-scale vertical shape variation currently transforms roof and wall meshes together around a common floor level; detailed structural loads / manifold watertightness not verified.
- Up to ~119,064 triangles for C; target phone GPU frame rate and memory not measured. Static PNG is a fallback, not evidence of real-time WebGL performance.
- The separate R2.3 sandbox input and WP1.1 / Authority projects are untouched. Existing G203 and G204 v0.2/v0.3 publication remain unchanged.

**Scope naming note:** `G205-A` here is an isolated scenic layering trial authorized in the research conversation. It does **not** close the originally tracked UX-G205 high/low roof junction milestone.
