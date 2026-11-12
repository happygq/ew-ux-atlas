# R2-V3-VIS-01 · T12 Playback and practice (M1)

This buildless browser viewer plays the actual T12 history from the accepted Stage D witness at `80478c802ffd3cf6c37fda2f1d3cd6c2cb956990`. It starts at the sealed courtyard so the first view shows a populated two-level world. Step 0 shows the empty grid. The five jump buttons cover courtyard sealing, support replacement, reopening, stair invalidation, and approval of a new stair.

## Open locally

From the repository root, serve the static folder with Python 3:

```sh
python -m http.server 8048 --bind 127.0.0.1 --directory g1-m2/r2-vertical-v03-visual
```

Open [the local preview](http://127.0.0.1:8048/). Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, use one finger to orbit and two to pinch or pan. The address includes the selected step and accepts a direct link such as `/#step=37`. If WebGL is unavailable, the two floor plans still follow the timeline.

The main timeline skips internal retries, ID conflicts, stale prefixes and injected publication failures. Use **显示全部 49 步** for the complete record. The original step numbers and `frames.json` are preserved.

Open **亲自操作** or [the practice page](http://127.0.0.1:8048/practice.html) to perform three guided scenarios. Choose the active level and color below the 3D view. Left-click to add an ordinary unit, right-click to remove, and Shift+left-click an occupied cell to recolor. Dragging controls the camera. The orange tile indicates the current guide target. Focus the canvas to use arrow keys, Enter, Delete and Shift+Enter as keyboard equivalents. Roof and stair approvals remain explicit user decisions. The local practice world resets on reload or when switching exercises.

**承托 · 先搭建再拆除** starts from an empty three-level grid. Stack ordinary units, then remove a lower one. If the normal removal would break direct support and the same location can still provide a grounded support path, the practice policy replaces the removed unit with a new pillar in the same Remove transaction. The upper unit keeps its identity. A required pillar cannot be removed. Once it has no dependents, it can be removed normally.

Three.js and OrbitControls are vendored from the official `three@0.160.1` npm package with its MIT license. The practice bundle compiles the versioned automatic-column policy on the Stage C engine for the browser with a synchronous SHA-256 adapter from `@noble/hashes`. All runtime assets load from the same static directory. The GitHub Pages path is `/g1-m2/r2-vertical-v03-visual/`.

## Data and checks

Run these commands from this folder with Node 24 to regenerate assets and run the focused checks:

```sh
npm ci
npm run export
npm run build:practice
npm test
```

The exporter calls Stage D `runT12()` and projects its committed states to the facts the viewer uses. The checked-in payload is 142,983 bytes. The focused check regenerates and verifies the payload, checks 49 steps, 39 published transactions and 41 authoritative events, and independently replays the journal to the final state hash. The ten nonpublishing steps reuse their preceding committed scene.

The practice build verifies the two historical T12 checkpoints for the stair and courtyard exercises, then checks their starting projections under the new practice policy. The original T12 history still replays under its recorded policy. Its scripted column additions are historical evidence. In the current support exercise, pillars arise from the user's Remove action, and the rejected final Remove leaves the scene intact.

The viewer shows schematic occupied cells, semantic roof tiles, selected support sources, and abstract stair approval. Physical passage stays closed. **G-V1 is OPEN. R2-A is NOT FROZEN.**
