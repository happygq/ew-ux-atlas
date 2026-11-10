# EW-UX · Current status / 项目最新进度

**新研究入口（2026-11-10）：** [Spatial & Structural Typology Atlas v0.1（6 大类 / 48 候选类型 / 12 组场景，Working Draft）](./docs/EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md) · [新 Chat 交接指令](./docs/TYPOLOGY-ATLAS-HANDOFF.md)。此项为类型研究**输入快照**，不是已审查冻结或已实现的建筑生成能力。

**最新独立研究候选：** [R2-V Stage 2：三维空域、承托路径与楼梯候选](./g1-m2/r2-vertical-v02/)（本地 26/26 定向测试；[技术发现](./docs/R2-V-STAGE2-FINDINGS-v0.1.md)）。**G-V1 仍开放、R2-A 未冻结**。第一轮 [R2-V v0.1](./g1-m2/r2-vertical-v01/) 与已验收单层 R1 保持原状。

**2026-11-10 R1 收口**：当前工作状态见 [PROJECT-STATUS](./docs/PROJECT-STATUS.md)，逐项关口见 [ACCEPTANCE-GATES](./docs/ACCEPTANCE-GATES.md)，当前进度表归档见 [progress CSV](./docs/progress/EW-UX-Progress-2026-11-10-R1.csv)。[CS–CY–IW–DW R1 预览](./g1-m2/cs-cy-iw-dw-r1/) 已获用户对**单层研究交互与示意视觉**的确认；**二/三层尚未验证**，真实孔洞/屋面和结构承托也未验收。新增 [R2-V / R3-V 多层验证计划](./docs/MULTISTORY-VALIDATION-PLAN-v0.1.md)。

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
