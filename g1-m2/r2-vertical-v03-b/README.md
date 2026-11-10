# EW-UX R2-V3-B · Unified SupportGraph

Stage B implements the semantic support rules from section B2 of the [AT-R02 contract](../../docs/AT-R02-SPATIAL-STRUCTURAL-ARCHITECTURE-CONTRACT-candidate-v0.1.md) on top of the Stage A world. Use `createWorld` and `replay` from `src/world.js`. The Stage B journal uses `ew-ux/r2-v3-b/1`. Existing Stage A journals still use the Stage A entry point and version.

## Stage B v1 policy

`Add` accepts a `supportRole` of `BEARING_ASSEMBLY` (default), `COLUMN`, or `MIXED_ROOM`. These are semantic roles on the existing grid. Recolor preserves role and unit ID. Ground-level bearing assemblies and columns resolve to a typed ground node. An elevated bearing assembly needs a bearing assembly directly below. An elevated column needs either a column or a bearing assembly directly below.

An elevated mixed room requires a bearing assembly directly below **and** two columns on opposite sides at the level below. The pair must satisfy one footing pattern:

- **S04** uses columns founded directly on ground.
- **S05** uses continuous column segments leading to ground columns.
- **S06** uses columns whose feet resolve to lower bearing assemblies before reaching ground.

EW and NS pairs are alternative AND sets. The v1 allowlist requires matching footings within a pair. Selection keeps the current eligible alternative. When it becomes ineligible, selection uses policy priority (EW before NS), pattern ID, then canonical source IDs. With no eligible alternative, Remove rejects atomically. A valid replacement retains the room's unit ID and records the previous and new source IDs and the reason in the same projected snapshot. The construction event identifies the transaction. Replay reconstructs the diagnostic from the authoritative packets without another event.

`snapshot.support` contains typed nodes, approved alternatives, foundation paths, vertical contacts and the latest selection changes. Dependencies only point to ground or a node on the next lower level. Every required source has a path to ground. An approved alternative carries semantic eligibility and unverified geometry evidence. `ONE_BAY_BRIDGE` can appear in a rejection diagnostic as an unapproved candidate. The diagnostic grants neither construction eligibility nor passage.

The positive part of T08 needs a separately approved bridge pattern and passage intent. Stage B exercises its rejection and air/passage separation cases. The grid, finite role catalog, synchronous publication and footing proxies bound this evidence. Real beams and columns, physical passage, the F2 stair lifecycle and durable transaction publication remain later work. **G-V1 remains OPEN. R2-A is not frozen.**

## Reproduce the tests

Run `npm test -- --test-reporter=tap` in this directory. On Node 24.14.0, all 7 tests passed. Coverage includes T02, T10, the Stage B portions of T08/T11, staging isolation across the Stage A/B interface, and byte compatibility with the reviewed Stage A witness.

The T10 replacement test injects a publication failure, checks unchanged world and journal bytes, then retries and replays from the journal. It prints journal SHA-256 `b2ef011d2b0f68ebdedd958b78580ad0349ead3c8d1163094cfd823067ec1e6e` and state SHA-256 `7be69a7184fd9e699ba7a7dc433545ad7aba15fc50a905864be4d9b9d644b537`.
