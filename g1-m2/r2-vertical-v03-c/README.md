# EW-UX R2-V3-C · Opening intents and abstract passage

Stage C implements T07 and the T01 opening increment of the [AT-R02 contract](../../docs/AT-R02-SPATIAL-STRUCTURAL-ARCHITECTURE-CONTRACT-candidate-v0.1.md). The world uses the Stage A spatial projection and Stage B support policy. It uses the separate journal version `ew-ux/r2-v3-c/1`. Earlier journals keep their existing entry points and versions.

`Add` can declare a local `buildingId`, `spaceUse` and `access`. The defaults are `local-building`, `ROOM` and `LOCAL`. The policy permits rooms and circulation with local access in the same building. Unknown use, private access, unadmitted support, and mismatched building IDs exclude a candidate. This is a local research policy with the configured world operator as authorizer.

A stair candidate requires overlapping 2×2 footprints connected by persisted construction OPEN edges on both levels. A door candidate requires a closed wall tile between two eligible interior fragments. Each proposal binds a bounded rectangle to one host patch and two endpoints by volume, region and unit IDs. An active or suspended stair reserves its footprint against overlapping stairs.

`openingContext()` returns read-only proposals and a token for the current committed prefix. `decideOpening(requestId, { type, targetId, authorizer, inputPrefixDigest })` accepts `APPROVE_USER` and `DECLINE` for a proposed ID, or `WITHDRAW` and `REAPPROVE` for an intent ID. Use a fresh context after each successful transaction. The user decision occupies one sequence number in the shared journal. Its record captures the offered proposal on approval or decline and retains the original approval evidence after later changes.

An approved intent yields an abstract passage while active. Its host remains closed and `physicalPassable` is false. Construction retires the intent when a bound identity disappears and suspends it when a route prerequisite disappears while identities remain. Those changes occur in the construction transaction with a derived cause. Restoring a prerequisite leaves the intent suspended until explicit reapproval. Withdrawn and invalidated intents are terminal.

Run `npm test` in this directory. The T07/F2 witness checks byte-identical replay and prints journal SHA-256 `c82ac89d5621e2d0b58d486f33757a293553b75b4336421163cca4b1f812a8ad` and state SHA-256 `87f3dd1ba9ddaef464f5416d06648eaf2d815770e64aa3bb255fc0d9c3cb54de`. The directly affected Stage A and B suites verify the earlier journal versions and projections.

T08 covers the rejected bridge candidate and independent air and passage state. Its positive case needs an approved bridge pattern. Building identity and access are fixed per admitted unit, and the door probe is limited to the air-to-air wall tiles that the Stage A lattice exposes. T12 cross-model validation, physical openings and stairs, and durable storage remain later work. **G-V1 is OPEN. R2-A is NOT FROZEN.**
