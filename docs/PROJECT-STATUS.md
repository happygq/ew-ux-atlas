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
| CS–CY–IW–DW / R1（**单层**） | **ACCEPTED（用户确认；仅单层交互与研究示意）** | [R1 README](../g1-m2/cs-cy-iw-dw-r1/README.md)；记载 18/18 语义拓扑测试；[交互预览](https://happygq.github.io/ew-ux-atlas/g1-m2/cs-cy-iw-dw-r1/) | **二/三层未验证**；真实墙洞、柱网、楼盖/排水和实体通行均未验收 |
| CS–CY–IW–DW / R2-A | **CANDIDATE / 合同尚未冻结** | [多层验证计划](./MULTISTORY-VALIDATION-PLAN-v0.1.md)；与 R2-V 联合定义结构及开口合同 | 多层合同须先通过 G-V1 才能冻结 | 
| CS–CY–IW–DW / R2-V（**新增**） | **CANDIDATE · G-V1 仍开放** | [隔离原型](../g1-m2/r2-vertical-v01/README.md)：V01–V04 + Node 22 本地 12/12；持久边、基本承托与上层遮盖代理 | 真正三维 VoidRegion、正向竖向通行、独立技术审查未完成；不得外推 R1 |
| CS–CY–IW–DW / R2-B/C | **NOT STARTED** | v0.2 设计基线；R2-A 合同草案 | 真实柱网、木石/白墙连续内立面、门窗孔洞及动态重组 |
| CS–CY–IW–DW / R3 | **NOT STARTED** | v0.2 设计基线 | 庭院排水、开口通行、巷道网络、屋顶与组团几何 |
| CS–CY–IW–DW / R3-V（**新增**） | **NOT STARTED · 强制实体 Gate** | 二/三层楼板、楼梯、承托、真实开口、天井、屋面排水的联合验证 | G-V2 未通过；R2-V 语义不能代替实体证据 |
| CS–CY–IW–DW / R4 | **NOT STARTED** | v0.2 设计基线与新增 R3-V Gate | 单层、二层、三层各自的材料/性能/三视角真机视觉验收 |
| 原 UX-G205 高低错层 / G206 / 正式接口 | **OPEN** | 原项目任务表与 v0.2 设计基线 | G205-A 风景试验绝不替代原技术里程碑；需独立集成与性能验证 |

## R1 真实边界

**2026-11-10 验收更新：** 用户已查看 CS–CY–IW–DW / R1 可交互页面并明确确认“通过验收”。该验收**只覆盖单层建筑的空间语义与研究示意交互**；没有对二层/三层、多层承托、垂直交通、真实门窗孔洞或实体屋顶作任何验证。用户检查的设备类型与设备性能未单独登记，不将本次确认夸大成特定设备的性能测试。单层历史 18/18 语义测试是已有证据，此次仅更新验收记录，没有重复跑测试。

R1 中用户操作为 Add / Recolor / Remove：同一建造身份的邻居之间形成持久 `OPEN` 关系，不同身份形成 `PARTITION`；Recolor 不追溯修改已建边界；Remove 清理无主边。CourtyardRegion 是由真实空单元泛洪与围合关系推导，而非手工放置的庭院物件。已有 16 次 Add 围合九格院落、Remove 转为开放庭院候选、双院等语义回放证据。

**R1 不是**真实门窗洞口模型、完整屋面和排水、可通行的实体门槛、实际大跨承重或生产级 Authority。18/18 是仓库文档中的先前测试结果；本次文档收口**未重新执行**代码测试。

## 本次收口与下一 Gate

1. 已冻结 v0.1/v0.2、既有历史预览与验收记录保持原样；只新增状态/关口/进度索引及 README 入口。
2. 以 [Acceptance Gates](./ACCEPTANCE-GATES.md) 为唯一当前验收状态清单，以 [进度归档](./progress/README.md) 的 CSV 快照记录当期工作项；保持可审计、可差异比较。
3. **R1 单层研究范围已经用户验收。** 不以此推断二/三层；R1 原始语义和既有页面不重开。
4. **先 R2-A 合同草案 + R2-V（G-V1）二/三层语义回放；通过 G-V1 后才冻结多层适用的 R2-A 合同**，再做 R2-B/C 的真实门窗、木构、石脚与动态重组。
5. **R3 加入 R3-V（G-V2）**，验收二/三层真实楼板、楼梯、支撑、天井、门窗、屋盖与排水；R4 对三种楼层高度分别做视觉 Gate。详细计划见 [MULTISTORY-VALIDATION-PLAN](./MULTISTORY-VALIDATION-PLAN-v0.1.md)。

## R2-A / R2-V 最新候选（不改变已验收 R1）

[多层合同草案](./R2-A-GEOMETRY-OPENING-CONTRACT-candidate-v0.1.md)和[独立测试/三层语义预览](../g1-m2/r2-vertical-v01/README.md)已建立。初步 Node 22.16.0 定向测试 12/12 通过；**G-V1 不关闭**，下一步补真实三维空域、楼梯/楼板开口的正反例和独立审查。视觉展示只为楼层占用网格，不代表任何建筑实体或工程安全。原 R2-V 决议 CSV 保持历史快照不变；最新状态见 [新的进度归档](./progress/README.md)。

## R2-V Stage2 · 三维空域/承托/楼梯候选（G-V1 仍开放）

[独立 Stage2 预览](../g1-m2/r2-vertical-v02/) 与 [技术发现](./R2-V-STAGE2-FINDINGS-v0.1.md) 已建立。新增 V05 支撑候选从 DIRECT 切换为 ONE_BAY_BRIDGE_EW、V06 2×2 未实现楼梯候选、V07 部分遮盖内院仍经相邻空域连接天空；V02 露天→封闭→恢复。原 V01–V04 回归保留。Node22 本地 26/26 通过，源文件逐字节核对。**不代表建筑梁架受力安全、真实开孔、楼梯可通行、屋面建造或正式 Authority 集成。** G-V1 保持 OPEN，R2-A 多层合同未冻结；Stage2 页面尚待用户手机视觉检查。
