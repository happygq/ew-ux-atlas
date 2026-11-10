# EW-UX R2-V3-A · Spatial and admission witness

This isolated Node prototype implements the Stage A scope of [Issue #2](https://github.com/happygq/ew-ux-atlas/issues/2) and the [AT-R02 contract](../../docs/AT-R02-SPATIAL-STRUCTURAL-ARCHITECTURE-CONTRACT-candidate-v0.1.md). It has no dependency on R1, Stage 1/2, or WP1.1.

## Data and policy

- A versioned world starts empty on a finite 3–12 × 3–12 grid, 2 or 3 levels. Each cell has four half-open prisms in integer lattice units. An admitted build can contain solid, air and reserved void. Shared faces have one canonical axis/plane/rectangle, negative and positive endpoints, and one owner. Partial roofs cover all but one bounded face tile. Unchanged tiles keep their patch IDs; replaced or retired tiles cannot regain an old ID.
- V1 proposes choices for an identical enclosed vacant footprint on levels 0 and 1. It supports double height, separate floors, and an open court, with opaque, translucent, partial or open roof choices as applicable. The committed choice determines the interface. Horizontal construction OPEN/PARTITION facts are separate from air links. Side air and sky have explicit `OUTSIDE_WORLD` and `SKY_EXTERIOR` endpoints. Only open interfaces conduct air; translucent roof tiles convey daylight potential. Direct sky is evaluated per vertical line, independent of side or indirect sky connections.
- Void regions follow air connectivity. Interior space regions additionally respect the local authorized space grouping. A split gives the anchored child the old ID (or greatest overlap, then coordinate order); a merge keeps the earliest created nominated ID. IDs are allocated in the isolated projection. The implementation recomputes the small grid; locality is about unchanged output and identity, not incremental runtime.
- Only grounded or same-column bearing proxies can admit construction. Recolor keeps unit identity and construction edge facts. Removing a sole source fails closed. The support records are semantic evidence only; lateral one-bay candidates do not qualify. An abstract slab opening can be inspected as a bounded read-only probe. It leaves its slab closed and records `abstractRouteAuthorized=false` and `physicalPassable=false`.

## Transaction and replay contract

`createWorld(config)` exposes `submit(requestId, action)`, `approve(proposalId, { authorizer, choices })`, and `cancel(proposalId)`. The three action types are `Add`, `Recolor`, and `Remove`. Approval must name the configured local operator and supply one offered pair of space/roof choices per pending scope. The caller is responsible for authenticating that operator. Staging is session-local: its ghost has no canonical occupancy or support, and approval compares against the exact immutable committed prefix. Use a new request ID to reissue a cancelled proposal on the same prefix.

A published packet contains one construction event and any required decisions in canonical scope order, with a shared transaction ID, contiguous event sequence, and version and prefix fields. `journal()` returns ordered packets; `replay(journal)` reconstructs and checks complete canonical event bytes before applying each packet. `world.bytes()` includes the two logs, snapshot and ID counters. The prefix digest is a reproducible label, not authentication. `interfaceChanges` supplies retired hosts and region lineage with the construction event as cause; it introduces no second authoritative event or stair transition.

This is an in-memory, synchronous prototype. Publication failure tests inject failure before swapping the committed state; they do not certify external storage durability. The v1 policy is specific to the finite two-level footprint above. It does not cover general building identity, support alternatives, stair approval or lifecycle, a complete passage graph, realized openings, mesh, drainage, or engineering certification. **G-V1 remains OPEN; R2-A is not frozen.**

## Reproduce the evidence

Run `npm test` from this directory (tested with Node 24.14.0). The nine tests cover T03/T04/T06, F1-01 through F1-04, multi-scope admission, region and patch lineage, and incomplete/reordered/conflicting replay. No previous fixtures or results are used. To run just the dual interpretation witness:

```sh
node --test --test-name-pattern="T03/T06" tests/stage-a.test.js
```

The witness admits the same 12 ordered actions with two different decisions. Both final packets place the action and decision at event sequence 12 and 13. F1-02 compares canonical JSON of `type/x/z/level/color/order` (color is absent for Remove) and compares admitted occupancy separately. It excludes request, event and transaction IDs, sequence numbers and prefix digests from the semantic action comparison. The third request remains staged and the committed bytes stay identical to its 11-action prefix.

The normalized construction SHA-256 is `033ca1b1e54d4dea9d628003c6617b16a226d603b2abd52b49194f09a5fa62e8`. Repeated replay compares full bytes and prints the independent journal and state hashes. The covered state hash is `23769301d08479a502cdc1f9cf48543191affdead550711cd0d354518c24b273`; the open court state hash is `edd4a2f12e5e2db526c55b7e48247a30698a6575b6315e9d5237d89f1f32f066`.
