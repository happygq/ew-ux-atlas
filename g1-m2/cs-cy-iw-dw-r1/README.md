# EW-UX · CS–CY–IW–DW / R1 · Construction & Courtyard Semantics

**Owner acceptance update · 2026-11-10:** User inspected the interactive R1 page and explicitly confirmed acceptance. **ACCEPTED ONLY for the single-story research interaction and schematic visualization**; historic 18/18 semantic tests do not verify two/three stories, real wall holes, full roofs/drainage, load paths, true passage or phone GPU performance. This is not Authority integration. The initial deliverable was a candidate before this acceptance; prior test record below remains unchanged. See [current gates](../../docs/ACCEPTANCE-GATES.md).

The user operates only **Add / Recolor / Remove**. Same-identity Add at an occupied neighbor persists an `OPEN` connection; otherwise it creates a `PARTITION`. Recolor never retroactively rewrites stored boundary facts. Remove clears orphan edges. Connected rooms are computed from these persisted facts, not from final color alone.

**Courtyard formation** is recognized from the true empty-space flood fill, not a pre-placed courtyard object. A 16-Add ring produces a 9-grid-square enclosed courtyard; Remove of one mouth converts it to an open courtyard *candidate*. Two rings produce two independent courtyards through operations alone.

**Inner-facing facades** are derived from the courtyard and wall segment roles: timber screen, timber+stone plinth, timber/plaster hybrid, and restrained white plaster wall. The open-roof isometric view is a **schematic structural cutaway**. R1 *does not* implement real pierced door/window holes, complete roof geometry or drainage, structural spans, a route through doors, multistory changes or production Authority.

**Run tests:** `npm test`; baseline **18/18** pure semantic topology tests passed, covering persistent connection history, Remove/regrowth, enclosed and candidate courts, dual courts, unique shared walls, courtyard-facing facade types, operation prefix validity and replay determinism.

**Static fallback:** `preview-courtyard-plan.svg` and `preview-r1-courtyard.png` are generated from the same topology, so browsers unable to render interactive JavaScript still display a meaningful structural reference.

**Upstream design:** `../../docs/EW-UX-Architectural-Construction-Baseline-v0.2.md`. Future R2/R3 must replace opening intentions with true wall holes, rebuild wall-grid/roof structural geometry, and validate live iPhone behavior.
