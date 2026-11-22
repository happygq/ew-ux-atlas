# Huizhou · Courtyard Builder

**EW-PLAY-01 v2.1 / P2 IMPLEMENTED — PLAYABILITY NOT YET ACCEPTED**

## Open the build

From the repository root, run `node play/01/serve.mjs` with Node 22 or later and open [the local valley](http://127.0.0.1:8080/play/01/). To make a self-contained offline copy, run `node play/01/pack-preview.mjs Huizhou-Courtyard-Builder.html` and open the resulting file in a modern WebGL 2 browser. The current GitHub Pages source is `main`.

## Play

Click or tap open ground with **Add**, then build a row and extend both ends into wings around an empty space. Close the fourth side and rotate to look for the covered entrance. Choose **Remove** or **Recolor** and select a building, or use **Undo** to reverse the last change. Drag to orbit, right-drag to pan, and scroll to zoom on desktop, or drag with two fingers and pinch on touchscreens. Use the valley map to jump to a distant site and the overview button to see the whole landscape.

## Coverage

- **R1** — A 120 m × 120 m buildable plane has 900 selectable 4 m × 4 m plots and 14,400 m² of net building land.
- **R2** — A room has about 14 m² of clear floor area and a 3.1 m eave clearance. Shared partitions, physical openings, roof junctions, open and enclosed courts, and 1.68 m passage apertures resolve from occupancy. Paved approaches are about 2.66 m wide.
- **R3** — Plaster, timber reveals, stone paving, stepped horse-head gables and textured tiles are generated with coordinated finishes and directional shadowing.
- **R4** — Add, Remove, Recolor and Undo use the same edit entry point as deterministic replays. Hover feedback, construction animation, orbit, pan and touch zoom are available on the playable surface.
- **R5** — The world opens empty, with independently editable plots and compounds. Roof ridges and wall openings adapt at every position. The court and passage rules apply to player-created layouts.

## Reproduce the checks

```sh
node --test play/01/settlement.test.mjs
node play/01/browser.test.mjs
```

The first command checks area, occupancy and undo, open and enclosed courts, multiple compounds, roof seams, accessibility, mesh openings and deterministic replays. The browser check uses Chrome DevTools for desktop input and touch emulation and optionally takes an output directory for screenshots. Set `EW_CHROME` if Chromium is installed outside the usual paths. Both checks reuse the repository's pinned Three.js build.

## P2 limits

Construction is single-story and uses a fixed 4 m grid. Sessions start fresh on reload. Broad roof masses use simplified ridge and valley geometry. The courtyard heuristic recognizes a three-sided court when the flanking and rear buildings are in the same group and close enough to read as a court. Enclosed courts use a shortest available route, so placing new surrounding buildings can move the gateway. Touch validation uses browser emulation. Owner evaluation of appearance and playability is pending.
