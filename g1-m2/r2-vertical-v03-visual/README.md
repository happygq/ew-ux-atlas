# R2-V3-VIS-01 · T12 Playback (M0)

This buildless browser viewer plays the actual T12 history from the accepted Stage D witness at `80478c802ffd3cf6c37fda2f1d3cd6c2cb956990`. It starts at the sealed courtyard so the first view shows a populated two-level world. Step 0 shows the empty grid. The five jump buttons cover courtyard sealing, support replacement, reopening, stair invalidation, and approval of a new stair.

## Open locally

From the repository root, serve the static folder with Python 3:

```sh
python -m http.server 8048 --bind 127.0.0.1 --directory g1-m2/r2-vertical-v03-visual
```

Open [the local preview](http://127.0.0.1:8048/). Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, use one finger to orbit and two to pinch or pan. The address includes the selected step and accepts a direct link such as `/#step=37`. If WebGL is unavailable, the two floor plans still follow the timeline.

Three.js and OrbitControls are vendored from the official `three@0.160.1` npm package with its MIT license. All runtime assets load from the same static directory. The GitHub Pages target is `/g1-m2/r2-vertical-v03-visual/` after deployment. M0 is for local visual review before merge.

## Data and checks

Run these commands from this folder with Node 24:

```sh
npm run export
npm test
```

The exporter calls Stage D `runT12()` and projects its committed states to the facts the viewer uses. The checked-in payload is 142,983 bytes. The focused check regenerates and verifies the payload, checks 49 steps, 39 published transactions and 41 authoritative events, and independently replays the journal to the final state hash. The ten nonpublishing steps reuse their preceding committed scene.

For the visual review, open steps 33 and 40 to compare the sealed and reopened courtyard. Step 37 changes the selected support from NS to EW while retaining `unit:20`. Step 43 removes the south abstract route, while step 49 adds the newly approved one. Steps 32, 35 and 36 show pending, rejected and publication-failed outcomes with their preceding scene intact.

The viewer shows schematic occupied cells, semantic roof tiles, selected support sources, and abstract stair approval. Physical passage stays closed. **G-V1 is OPEN. R2-A is NOT FROZEN.**
