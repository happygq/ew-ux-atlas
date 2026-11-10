# EW-UX · Acceptance Gates

> 更新：2026-11-10。**本表只记录已知证据的边界，不新增验收签字。** 既有历史测试数字摘自已提交 README，文档收口时不重复跑完整仓库。完整阶段上下文见 [PROJECT-STATUS](./PROJECT-STATUS.md)。

| Gate | 范围与通过标准 | 当前结论 | 证据 / 下一动作 |
| --- | --- | --- | --- |
| G-01 · G1-M1 首轮 Atlas | 实际手机可查看并认可首轮模块视觉 | **ACCEPTED（限定范围）** | [Atlas](https://happygq.github.io/ew-ux-atlas/)；异类接缝、GPU/水密不在本次通过范围 |
| G-02 · G1-M2 直列与 G203 | 对应 2/6 直列、L 谷线/墙脚的人工视觉复核 | **ACCEPTED（限定范围）** | [直列](https://happygq.github.io/ew-ux-atlas/g1-m2/) / [G203](https://happygq.github.io/ew-ux-atlas/g1-m2/l-valley/)；历史 29/29、38/38 |
| G-03 · G204 比例/方向 | T 两端按世界轴镜像，U 开口翼为次要层级；真实墙屋配合 | **OPEN / CANDIDATE** | [G204 v0.3](https://happygq.github.io/ew-ux-atlas/g1-m2/t-u-v03/)；v0.3 63/63、G205-A README 记录的 v0.3.1 78/78 不能替代手机视觉签收 |
| G-04 · G205-A 街巷层叠 | 三排以上有效纵深、真实共墙/巷道/庭院，无不可用残余窄缝 | **OPEN / 用户发现缺陷** | [街巷实验](https://happygq.github.io/ew-ux-atlas/g1-m2/layered-streetscape/)；修复空间关系并做操作回放 |
| G-05 · CS R1 持久边 | Add/Recolor/Remove 的邻接边界、撤除与重播确定性 | **CANDIDATE** | [R1 README](../g1-m2/cs-cy-iw-dw-r1/README.md) 记载 18/18 测试；真实触屏操作 Gate 开放 |
| G-06 · CY R1 自生成庭院 | 至少封闭庭院、Remove 半开院、双院由操作产生 | **CANDIDATE（语义）** | 16-Add/9-cell 院、双院和 Remove 的语义记录；天空开放、实体门洞及通行未证明 |
| G-07 · IW–DW R2 | 院向真实连续柱网、木石/白墙合理分配、**实际门窗孔洞**与墙体几何一致 | **NOT STARTED** | 按 [DW Gate](./EW-UX-Adaptive-Doors-Windows-Research-Gate-v0.1.md) 和 v0.2 基线实现；真实窗洞/槛/过梁不能只靠贴面 |
| G-08 · R3 空间几何 | 庭院排水、院—室—巷真实可达性、连续屋盖/墙脚、L/T/U/高低差几何合法 | **NOT STARTED** | R2 通过后开展联合几何验证 |
| G-09 · R4 手机视觉 | 街巷/庭院/去屋顶室内三视角，四色与材质比例，Safari 交互与性能 | **NOT STARTED** | 需要用户真机视觉确认；静态截图不可代替 |
| G-10 · R2.3 DTO / Authority | 正式接口与数据证据的独立架构评审 | **OUT OF SCOPE** | 本研究仓库不改动 WP1.1 Authority，不能由原型自动确认兼容性 |

**闭合原则：** 每个 Gate 记录场景、可复现的操作步骤、实际几何或语义证据、测试范围及人工视觉结论；只对通过部分标记 ACCEPTED。设计冻结、代码发布、测试成功和人工验收必须分别记录。
