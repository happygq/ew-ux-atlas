# EW-UX · G1-M1 Parametric Architectural Module Atlas

**Independent Expandable Worlds UX research** · Huizhou Fantasy Architecture · v0.3

Interactive study of 12 deterministic architectural modules (stepped gable / curved tile roof / timber eave) with 3D orbit, editable geometry parameters, screenshots, static fallbacks, and same-family parallel assembly previews.

**Site (after Pages activation):** https://happygq.github.io/ew-ux-atlas/

## Research status

- Parallel alignment corrections: shared world-X sampling for tile courses, rafters and ridge details; gable stepped wall/cap profiles registered to the same stations.
- The separate v0.3 research bundle recorded 17/17 Node contract tests passing. **Not visually accepted.** Real mobile WebGL, mixed-family joins, full watertightness and larger junctions remain open.
- This preview does not implement or modify WP1.1 / Authority.

## Usage

On mobile Safari use the module selector, drag to orbit, pinch to zoom, and **≋ 拼接验证** to inspect parallel roof/eave joins. Click **视觉参考** to load the approved original board (on-demand chunk assembly due to upload size limits). If real WebGL2 is blocked, Canvas2D or static-image fallbacks apply.

Code for the deployment is in `src/atlas.js`, with original module-name boundaries preserved in its comments. This file is the unbundled standalone JavaScript concatenation; the research ZIP holds the separately maintained ES modules and regression tests.

## Enable GitHub Pages

Repo **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.

No API keys or external runtime dependencies.
