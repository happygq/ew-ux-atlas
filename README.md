# EW-UX · Current status / 项目最新进度

**2026-11-10 R1 收口**：当前工作状态见 [PROJECT-STATUS](./docs/PROJECT-STATUS.md)，逐项关口见 [ACCEPTANCE-GATES](./docs/ACCEPTANCE-GATES.md)，当前进度表归档见 [progress CSV](./docs/progress/EW-UX-Progress-2026-11-10-R1.csv)。[CS–CY–IW–DW R1 预览](./g1-m2/cs-cy-iw-dw-r1/) 是独立研究候选，尚未完成手机视觉与真实孔洞/屋面验收。

> 以下为原 G1-M1 图鉴的历史 README，保留其原有验收记录与技术边界；新状态不通过覆盖冻结设计文件维护。

---

# EW-UX · G1-M1 Parametric Architectural Module Atlas

**Independent Expandable Worlds UX research** · Huizhou Fantasy Architecture · v0.3

Interactive study of 12 deterministic architectural modules (stepped gable / curved tile roof / timber eave) with 3D orbit, editable geometry parameters, screenshots, static fallbacks, and same-family parallel assembly previews.

**Site (after Pages activation):** https://happygq.github.io/ew-ux-atlas/

## Owner acceptance · 2026-11-10

**G1-M1 v0.3 — first-round visual / mobile delivery accepted.** The project owner confirmed the GitHub Pages site is visible on a phone and explicitly stated “验收通过”. The accepted baseline covers the first-round MH/RF/EV module atlas presentation and corrected parallel assembly demonstrations. Public preview: https://happygq.github.io/ew-ux-atlas/

**Scope boundary:** This acceptance does not assert full G1-M1 technical completion or close unimplemented mixed wall/roof/eave joins, L/T/U junctions, real GPU performance, or Authority integration. These remain separately tracked research/technical checks. The existing Node 17/17 test evidence remains attributed to the v0.3 research bundle.

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
