# EW-UX R2-V3-D · T12 cross-model integration

This package implements the T12 evidence protocol from the [AT-R02 Gate Traceability Matrix](../../docs/AT-R02-GATE-TRACEABILITY-MATRIX-v0.1.md). The witness starts from an empty 10×7×2 world using `ew-ux/r2-v3-c/1` at the Stage C merge, `2fa876cba2857f46becbfe602d7fbbcb2aeac9ca`. It uses the public Add, Recolor, Remove and decision APIs throughout. Stage D adds evidence tooling and tests. The existing world and journal policies apply.

## T12 witness

- A single history admits two stairs, constructs a mixed room with two approved support sets, and seals a courtyard with an atomic Add and SpaceIntent decision. Recolor keeps the original construction edge facts, unit identity and stair binding. The unrelated east building keeps its occupancy, fragments, boundary patches, space and void regions, support roots and abstract passage throughout subsequent edits.
- The mixed room retains its NS support when an EW alternative first becomes available. A pre-publication failure leaves world bytes and the sequence unchanged. Retrying the same Remove switches the room to EW with its original unit ID. Removing another required column then fails closed.
- The courtyard splits, merges into the anchored exterior region, and splits again with a fresh region ID and roof decision. Both unapproved closure requests remain staged. Deleting the south landing retires its region and slab identity and invalidates the stair in one ConstructionLog event. Rebuilding the landing requires a new proposal and intent. Its new abstract passage has `physicalPassable=false`.
- Stale prefixes and conflicting event IDs fail without publishing. Exact retries are idempotent. Replay checks event order and rejects reordered packets and partial transactions. The complete canonical world bytes match after replay.

## D1 approval scope from the Stage C review

Approval binds the route's host, endpoints and footprint. The current support graph must still supply an eligible selected alternative for each required cell. The original proposal's support IDs are immutable evidence of what the operator approved. They are distinct from the current graph's selected alternative IDs. A valid alternative change by itself keeps a matching binding active. Lost support eligibility suspends a retained binding.

The public T12 history proves a real NS-to-EW switch and stability of the unrelated stair bindings. It cannot put that switching mixed room on a current route. A mixed room in an upper stair footprint requires a column in the lower 2×2 footprint, and the stair rule excludes column cells. A mixed room in the lower footprint cannot support the cell directly above. An east–west door endpoint next to the mixed room needs the bearing location required by the EW column pair, and the current lattice exposes no north–south air-to-air door tile. A **separate model-level test** substitutes support selection evidence at the opening-policy interface to check the same-binding rule. It is distinct from the public-operation witness.

## Reproduce and review

Run these commands from this directory with Node 24.14.0:

```sh
npm test
node t12-evidence.js > t12-report.json
node t12-evidence.js --verify t12-report.json
```

Add `--snapshots` when generating the report to include the model projections after each step, approximately 42 MB. The verifier reruns the versioned witness and compares all 49 steps in order, including rejection codes, staged and idempotent results, before/after digests, and event sequence counters. It checks each included snapshot against the corresponding rerun projection and independently replays the supplied journal. The report requires 39 published transactions and 41 authoritative events. The E-D1 tests confirm that deleting nonpublishing steps or changing a rejection code fails verification even with the original journal and hashes.

- Journal SHA-256 `3297822d202808bf49486b4d39b4634387fd774d838ae4270f6c455875241bbe`
- Final state SHA-256 `1b7f3fef48f340e9200f0650f84f551a738f2b594b0b6936feb42d6c1584ab3e`

## Gate status

The [Stage A](https://github.com/happygq/ew-ux-atlas/pull/3), [Stage B](https://github.com/happygq/ew-ux-atlas/pull/4), and [Stage C](https://github.com/happygq/ew-ux-atlas/pull/5) PRs record their scoped reviews and targeted evidence. T12 adds a cross-model witness for independent review. Positive T08 still needs an approved bridge pattern and passage evidence. Building grouping is limited to existing per-cell building and access metadata. Physical openings, structural geometry and durable transaction storage remain outside this witness.

**G-V1 is OPEN. R2-A is NOT FROZEN.** Gate disposition requires separate acceptance under the AT-R02 matrix.
