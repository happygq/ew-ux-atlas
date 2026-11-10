# G203 Stage 02 — Gable Floor Datum Registration v0.2

**Issue:** owner visual inspection observed bottom-edge misregistration between MH-01 gable walls and connected L-house (2026-11-10).

**Root cause:** independent MH-01 has `wallSeat.y=0.280 m`; L-house top platform surface is `Y=0.025 m`. Previously `addGables()` rotated the module into place but did not translate the Y-axis (0.255 m error).

**Change:** define the L-house finished-floor datum from `FLOOR_SURFACE.centerY+thickness/2`; transform each wall vertex with `y + (finishedFloorY - g.metadata.anchors.wallSeat.y)`. Derived cap elevations are translated consistently. Reuse the same floor constants in `addShell()`.

**Boundary contract:** `checkCornerContract()` now rejects `gable_floor_datum_mismatch`, `gable_socle_not_seated`, `missing_gable_seat`, and `floor_datum_mismatch`. The actual transformed wall-body mesh lower Y, not only an anchor label, must match floor finish.

**Evidence:** 19/19 Stage 02 tests pass (previous 16 + 3). Both standard and extended L layouts checked; deliberately shifted wall rejected. Independent comparison of all non-gable mesh positions/normals before/after returns exact SHA-256 equality for both input variants. Total triangle count unchanged (43,206 standard; 45,722 extended).

**Acceptance boundary:** owner accepted hip, valley and drainage before this fix; this correction is pending only wall-base visual recheck. T/U and height-transition structures remain out of scope. Does not modify WP1.1/Authority/G1-M1/Stage01.
