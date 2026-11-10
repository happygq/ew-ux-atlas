# EW-UX R2-V · Stage 2 — Spatial Void, Support Lineage and Stair Proposals

> **Research candidate · 2026-11-10 · G-V1 OPEN · NOT FROZEN.** Independent from accepted single-floor R1 and R2-V v0.1. No production Authority changes.

This is a separate test and interactive viewer located at `g1-m2/r2-vertical-v02/`. It uses the same **Add/Recolor/Remove** operation logs and imports a verbatim copy of the originally tested v0.1 `src/vertical.js` and `src/scenarios.js`. No command was added to user operations. `ExpectReject` remains a test-only wrapper.

## Delta over v0.1

- `src/void-and-circulation.js`: builds an explicit 6-connected three-dimensional **vacant-air graph**. Courtyard visibility-to-sky and 3D reachable-to-sky are separate results; a partially covered courtyard can remain connected via adjacent vacant air cells, while a sealed room can have no exit. A vertical free-space shaft is not a traversable stair and does not imply real roof or slab meshes.
- Floor interfaces between stacked occupied units are **`SOLID_UNOPENED`**; passable=false, slab opening unrealized. The output never invents stairs.
- Automatic `ELIGIBLE_UNREALIZED` stair *proposals* require matching 2×2 OPEN-connected patches on both levels. The proposals are read-only, not the user's intent, are never applied to the building, and cannot certify stairwell geometry/structure. Additional policies about circulation, privacy, fire separation and load paths remain to be decided.
- `supportLineages` follows the **full chain of source unit IDs** to the ground (not only geometric coordinates). Supports can move from direct to one-bay bridge after a legal Remove, without changing the upper unit's ID. A one-bay bridge is semantic and **not a structural capacity guarantee**.
- V05: support transition; V06: stair proposal survives recolor, disappears after footprint removal; V07: partially covered courtyard remains sky connected. Original V01–V04 preserved.

## Check

Run `npm test` in this directory on Node 22. This package records the original 12 regression checks plus 12 stage-2 spatial checks and 2 narrative checks, **26/26 targeted tests passed locally**, including repeated deterministic fixture replay. These results do not substitute for independent G-V1 review or Safari visual acceptance. Verify with GitHub Actions after deployment.

The viewer initially opens V05. On mobile choose V05/V06/V07 and step back from the final state. Yellow cells mark direct overhead obstruction, blue-green mark sky-connected voids, and purple outlines indicate an *unrealized* stair proposal.

## Known blockers for G-V1 closure

1. Room/circulation identity between floor regions is **not defined** by Add/Recolor/Remove alone; it must be inferred by an accepted spatial planner policy, not by assuming stacked rooms are connected. The 2×2 proposal only tests eligibility, not permission or actual access.
2. Stair geometry, slab apertures, landings, headroom, circulation safety, structural offsets and actual load transfers are **not validated**. Thus every candidate remains passable=false.
3. The six-neighbor grid is a **bounded occupied-cell approximation**, not an arbitrary complex mesh, and rooftop boundaries/real drainage are not modeled.
4. One-bay bridge support is a planning hint with no proven beam section; a compliant structural verification or explicit fail-closed alternative is mandatory before geometry approval.
5. Independent technical review and user live-phone visual check still needed.

See `docs/R2-V-STAGE2-FINDINGS-v0.1.md` for actionable review and next gate.
