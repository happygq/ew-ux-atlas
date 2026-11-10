# EW-UX · Typology Atlas 新 Chat 交接指令

> 用途：新对话跨窗口的**确定性入口**。主文档为 [Spatial & Structural Typology Atlas v0.1（Working Draft）](./EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md)。以下状态仅截至 2026-11-10，不得替代实时 GitHub 核对。

## 研究边界
- 仓库 `https://github.com/happygq/ew-ux-atlas`；本工作仅限 EW-UX 独立 UX 建筑生成研究，不修改 WP1.1 Authority。
- 用户已明确验收 **R1 单层建筑的研究交互与示意视觉**，不能外推至多层或真实结构工程。
- R2-V Stage 1/2 完成候选原型与定向测试（Stage 2 本地 26/26）；**G-V1 仍 OPEN**，R2-A 多层合同未冻结。见 [Stage2 技术发现](./R2-V-STAGE2-FINDINGS-v0.1.md) 与 [验收关口](./ACCEPTANCE-GATES.md)。
- 已冻结的 [设计基线 v0.1](./EW-UX-Architectural-Construction-Baseline-v0.1.md)、[v0.2](./EW-UX-Architectural-Construction-Baseline-v0.2.md) 和 R1 交互不重复审查或修改。

## 第一阶段必读（避免全仓重复读取）
1. **[48 类 / 12 场景图谱草案](./EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md)** — 本次用户要延续的主要研究材料。
2. [项目状态](./PROJECT-STATUS.md) — 当前里程碑与通过范围。
3. [多层计划](./MULTISTORY-VALIDATION-PLAN-v0.1.md) — G-V1/G-V2 阶段边界。
4. [Stage2 技术发现](./R2-V-STAGE2-FINDINGS-v0.1.md) — 若需做覆盖判断，再点查相关源码，不要重新测试冻结 R1。

## 工作目标
建立系统化的 EW-UX Spatial & Structural Typology Atlas：
- 逐项检查六类 48 候选类型的遗漏、重复、混合维度、可能的建筑构造组合与极端负例；
- 为 Occupancy3D、VoidRegion3D、SupportGraph、PassageGraph、Envelope/Roof 建立不变量及跨类型依赖；
- 区分 Townscaper 的视觉程序化能力和 EW 需自行实现的可追溯空间/支撑/交通语义；
- 将已有 R1、R2-V Stage2 逐项标记 Existing / Partial / Missing / Deferred，不臆造验证结果；
- 审核 12 个组合场景是否构成足够小而有代表性的测试集，排列 G-V1 与 R3-V/G-V2 的验证优先级；
- 列出需要用户决策的核心规则选项，然后提出下一轮实现包。

**当前阶段仅开展设计/架构研究和文档评审，不直接扩大编码、改已验收原型或关闭 G-V1。**
