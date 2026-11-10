# EW-UX · G204 v0.3 — Proportional Gable Family

**Isolated research candidate · not yet owner-visually accepted.**

Preview (after publishing): https://happygq.github.io/ew-ux-atlas/g1-m2/t-u-v03/

This is a **new preview directory**, leaving the previously accepted G203 L-valley, G1-M2 Stage 01 and G1-M1 home page, and the existing G204 v0.2 pages unchanged.

## What's new

- Width-dependent stepped gable silhouettes (not a fixed seven-section bilateral wall).
- More generous horizontal coping segments, with explicit minimum tread and broad crest.
- One continuous bilateral main-wall body, optional single-sided half-fan, controlled mirrored pairs and an explicit asymmetric mode.
- `AUTO` selects a consistent family across an architectural cluster: a T's primary terminal wall is bilateral, its secondary ends are mirrored half-fans; U's pair of main-run ends are bilateral, both courtyard wings are mirrored half-fans.
- White plaster is the default. Applied decorative gray bricks and repetitive vertical ridges only occur under explicit `LEGACY_DECORATED` comparison mode.
- Interactive page: T/U switch, profile-family selection, width choices 3.04 / 3.54 / 3.84m, two render views, tile hide/show and valley guide. Static fallback files represent the **default** `AUTO` 3.54m scene only, and the UI labels them as such for custom configurations.

## Verification

- `node --test tests/*.test.js` — **63/63 pass** in the G204 v0.3 source package.
- New tests include width- and proportion-based tier choice, genuine physical mirror, family diversity by role, forgery/rejection, deterministic output and existing non-gable geometry retention.
- `node export-previews.mjs && python render-tu.py` — renders the 8 standard T/U × white/legacy × overall/valley actual-mesh previews. Python preview dependencies are NumPy, OpenCV and Pillow.
- This does **not** establish full geometric manifoldness or real-mobile-GPU performance. User visual acceptance is still required.

## Research boundary

G203 accepted L-valley and existing G204 v0.2 pages remain unchanged. No WP1.1 or Authority modifications. Dense interior support posts and interior wall skin are deferred to UX-F101 / UX-C101.

See [the research contract](docs/G204-v0.3-Proportional-Gable-Family-Contract.md) for exact width thresholds, geometry invariants, and still-open gates.
