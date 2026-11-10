# EW-UX · Acceptance Gates

> 更新：2026-11-10（R1 用户明确验收 + 多层验证计划决议）。**只将明确获用户确认的 R1 单层研究范围标为 ACCEPTED**；其余原测试数字来自仓库既有记录，本次不重复跑完整仓库。详见 [项目状态](./PROJECT-STATUS.md)、[二/三层验证计划](./MULTISTORY-VALIDATION-PLAN-v0.1.md)。

| Gate | 范围与通过标准 | 当前结论 | 证据 / 下一动作 |
| --- | --- | --- | --- |
| G-01 · G1-M1 首轮 Atlas | 实际手机可查看并认可首轮模块视觉 | **ACCEPTED（限定范围）** | [Atlas](https://happygq.github.io/ew-ux-atlas/)；异类接缝、GPU/水密不在本次通过范围 |
| G-02 · G1-M2 直列与 G203 | 对应 2/6 直列、L 谷线/墙脚的人工视觉复核 | **ACCEPTED（限定范围）** | [直列](https://happygq.github.io/ew-ux-atlas/g1-m2/) / [G203](https://happygq.github.io/ew-ux-atlas/g1-m2/l-valley/)；历史 29/29、38/38 |
| G-03 · G204 比例/方向 | T 两端按世界轴镜像，U 开口翼为次要层级；真实墙屋配合 | **OPEN / CANDIDATE** | [G204 v0.3](https://happygq.github.io/ew-ux-atlas/g1-m2/t-u-v03/)；v0.3 63/63、G205-A README 记录的 v0.3.1 78/78 不能替代手机视觉签收 |
| G-04 · G205-A 街巷层叠 | 三排以上有效纵深、真实共墙/巷道/庭院，无不可用残余窄缝 | **OPEN / 用户发现缺陷** | [街巷实验](https://happygq.github.io/ew-ux-atlas/g1-m2/layered-streetscape/)；修复空间关系并做操作回放 |
| G-05 · CS R1 单层交互 | Add/Recolor/Remove 与持久邻接边的**单层研究级**回放 | **ACCEPTED（用户确认；仅单层）** | [R1 预览](https://happygq.github.io/ew-ux-atlas/g1-m2/cs-cy-iw-dw-r1/)；[README](../g1-m2/cs-cy-iw-dw-r1/README.md) 记载历史 18/18；多层与实体几何未验证 |
| G-06 · CY R1 单层庭院 | 16-Add/9-cell、Remove 开环、双院的**单层拓扑与示意视觉** | **ACCEPTED（用户确认；仅单层语义示意）** | 天空的三维贯通、真实门洞、跨层庭院和实体通行仍未证明 |
| G-V1 · R2-V 多层语义（**新增强制 Gate**） | V01 二层住宅、V02 二层贯通天井、V03 三层错退、V04 跨层 Add/Recolor/Remove；支持链、三维庭院、独立竖向通行、重播确定性与负例 | **OPEN / CANDIDATE（局部语义测试已跑）** | [R2-V 原型](../g1-m2/r2-vertical-v01/README.md) 本地 Node 22.16.0 12/12；四组回放。**三维真实空域、正向竖向通行和独立审查仍缺失；合同不可冻结** |
| G-07 · IW–DW R2 | 院向真实连续柱网、木石/白墙合理分配、**实际门窗孔洞**与墙体几何一致 | **NOT STARTED** | 按 [DW Gate](./EW-UX-Adaptive-Doors-Windows-Research-Gate-v0.1.md) 和 v0.2 基线实现；真实窗洞/槛/过梁不能只靠贴面 |
| G-08 · R3 空间几何 | 庭院排水、院—室—巷真实可达性、连续屋盖/墙脚、L/T/U/高低差几何合法 | **NOT STARTED** | R2 通过后开展联合几何验证 |
| G-V2 · R3-V 多层真实几何（**新增强制 Gate**） | 二/三层楼板、楼梯、承托、真实门窗与天井、屋盖、谷线、排水、路径与碰撞检查 | **NOT STARTED** | R2-V 与 R2-B/C 通过相关准入后实施；几何/路径测试**不等于**建筑工程结构安全认证 |
| G-09 · R4 手机视觉 | 单层、二层、三层各自的街巷/院内/剖开屋顶三视角，四色与材质比例、真机交互与性能 | **NOT STARTED** | 需要用户真机视觉确认；不得从 R1 单层验收外推二/三层 |
| G-10 · R2.3 DTO / Authority | 正式接口与数据证据的独立架构评审 | **OUT OF SCOPE** | 本研究仓库不改动 WP1.1 Authority，不能由原型自动确认兼容性 |

**闭合原则：** 每个 Gate 记录场景、可复现的操作步骤、实际几何或语义证据、测试范围及人工视觉结论；只对通过部分标记 ACCEPTED。设计冻结、代码发布、测试成功和人工验收必须分别记录。
