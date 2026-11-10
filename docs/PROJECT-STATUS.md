# EW-UX · 当前项目状态 / Project Status

> 截止：2026-11-10；锚点提交：`af7963a6b8e44bec457e5ff22a1b1a28f3fa5363`（CS–CY–IW–DW R1）。这是**增量状态记录**，不改写或替换已冻结的 [建筑生成设计基线 v0.1](./EW-UX-Architectural-Construction-Baseline-v0.1.md) 和 [v0.2](./EW-UX-Architectural-Construction-Baseline-v0.2.md)。

## 范围与证据界限

本仓库只跟踪 **Expandable Worlds 独立 EW-UX 建筑与建造体验研究**；不修改、不声称完成生产仓库 WP1.1/Authority，不自动闭合 R2.3 DTO 集成，也不将“程序发布”“单元测试通过”等同于用户手机视觉或真实建筑几何验收。

状态术语：**ACCEPTED** = 用户仅在明确范围内完成视觉验收；**CANDIDATE** = 技术/设计研究候选，不宣称最终通过；**OPEN** = 验收关口未关闭；**NOT STARTED** = 未开始实现；**DESIGN BASELINE** = 设计规则已记录而非功能已完成。

## 已确认的阶段快照

| 工作流 | 当前状态 | 已有证据 | 仍然开放 |
| --- | --- | --- | --- |
| G1-M1 参数化构件 Atlas | **ACCEPTED（首轮视觉）** | [Atlas](https://happygq.github.io/ew-ux-atlas/)；用户手机验收 | 异类墙屋檐接缝、全流形和 GPU |
| G1-M2 直列 2/6 间 | **ACCEPTED（对应视觉）** | [Stage01](https://happygq.github.io/ew-ux-atlas/g1-m2/)；既有 29/29 定向测试 | 真实 R2.3 RoofGroup/构造输入及扩展几何 |
| G203 L 形 v0.3 | **ACCEPTED（对应视觉）** | [G203](https://happygq.github.io/ew-ux-atlas/g1-m2/l-valley/)；既有 38/38 测试 | 全域几何闭合及性能 |
| G204 T/U v0.3—v0.3.1 | **CANDIDATE** | [v0.3 页面](https://happygq.github.io/ew-ux-atlas/g1-m2/t-u-v03/)；v0.3 既有 63/63；[G205-A README](../g1-m2/layered-streetscape/README.md) 记录 v0.3.1 方向性及 78/78 试验 | T 两端镜像与 U 两翼等级需手机视觉 Gate；v0.3 旧页面不等于 v0.3.1 验收 |
| G205-A 鳞次栉比街巷 | **CANDIDATE / 视觉问题未解** | [Layered Streetscape](https://happygq.github.io/ew-ux-atlas/g1-m2/layered-streetscape/) 的 A/B/C；用户已指出残余狭缝 | ATTACHED/ALLEY/COURTYARD_GAP 与真实组团可达性 |
| 世界指南针 / 软性坐北朝南 | **CANDIDATE** | G205-A 独立页面及 compass 测试 | 与真实入口语义的关联、手机视觉 |
| CS–CY–IW–DW / R1 | **CANDIDATE（已提交）** | [R1 README](../g1-m2/cs-cy-iw-dw-r1/README.md)；记载 18/18 语义拓扑测试；[交互预览](https://happygq.github.io/ew-ux-atlas/g1-m2/cs-cy-iw-dw-r1/) | 手机交互与审美；真实墙洞、连续柱网、完整屋盖/排水和院—室—巷可达 |
| CS–CY–IW–DW / R2 | **NOT STARTED** | v0.2 设计基线提出联合验证路径 | 真实柱网、木石/白墙连续内立面与实际门窗孔洞 |
| CS–CY–IW–DW / R3 | **NOT STARTED** | v0.2 设计基线 | 庭院排水、开口通行、巷道网络、屋顶与组团几何 |
| CS–CY–IW–DW / R4 | **NOT STARTED** | v0.2 设计基线 | 宣纸四色/材质与真机三视角视觉 Gate |
| 原 UX-G205 高低错层 / G206 / 正式接口 | **OPEN** | 原项目任务表与 v0.2 设计基线 | G205-A 风景试验绝不替代原技术里程碑；需独立集成与性能验证 |

## R1 真实边界

R1 中用户操作为 Add / Recolor / Remove：同一建造身份的邻居之间形成持久 `OPEN` 关系，不同身份形成 `PARTITION`；Recolor 不追溯修改已建边界；Remove 清理无主边。CourtyardRegion 是由真实空单元泛洪与围合关系推导，而非手工放置的庭院物件。已有 16 次 Add 围合九格院落、Remove 转为开放庭院候选、双院等语义回放证据。

**R1 不是**真实门窗洞口模型、完整屋面和排水、可通行的实体门槛、实际大跨承重或生产级 Authority。18/18 是仓库文档中的先前测试结果；本次文档收口**未重新执行**代码测试。

## 本次收口与下一 Gate

1. 已冻结 v0.1/v0.2、既有历史预览与验收记录保持原样；只新增状态/关口/进度索引及 README 入口。
2. 以 [Acceptance Gates](./ACCEPTANCE-GATES.md) 为唯一当前验收状态清单，以 [进度归档](./progress/README.md) 的 CSV 快照记录当期工作项；保持可审计、可差异比较。
3. 下一技术阶段应首先定义并实现 **R2：连续院内木构/石基/局部白墙 + 真实可穿透门窗洞口的共同几何**。禁止以材料贴片、假窗、平面拓扑测试代替真实空间几何验收。
4. 在 R2 开发前，先查看 R1 真机交互/美学效果；若发现问题，按最小影响范围补丁修复，而非重审冻结设计。
