# AT-R02 · Typology Coverage Matrix v0.1

> **RESEARCH / NOT ACCEPTANCE** · 2026-11-10。保留原始六类 48 个 ID；此文是功能级证据范围判断，不是完整建筑完成率，不启动或重跑测试。

## 标记定义

- **Existing**：现有实现与已有定向测试可证明**限缩的语义事实**；不等于完成实体建造或工程安全。
- **Partial**：有部分语义、代理或提案，但相应类型的核心联合不变量尚未通过。
- **Missing**：当前相关语义能力尚无充分实现/证据。
- **Deferred**：明确不属于该阶段或留给后续 Gate；不是完成。
- R1 已验收的单层部分只作证据基线；R2-V Stage2 历史 26/26 仅证明有限定向用例。

## 全部类型覆盖矩阵

| ID | 对象/主要差距 | R1 | R2-V Stage2 | 当前可核对证据或缺口 | 责任阶段 |
|---|---|---|---|---|---|
| H01 | 单间 | Partial | Partial | 已有房间节点，真实围护/入口未证 | G-V2 |
| H02 | 同层大房间 | Existing | Existing | 历史 OPEN 可形成 RoomRegion；大跨实体另证 | G-V2 |
| H03 | L/T/U 室内 | Partial | Partial | 正交边连通可表达；构造交汇未证 | G-V2 |
| H04 | 异形斜角房 | Deferred | Deferred | 正交网格没有非正交界面几何 | 后续专项 |
| H05 | 贴邻不通 | Existing | Existing | 持久 PARTITION；不等于人员不可/可通行证据 | G-V1 增量 |
| H06 | 多房间走廊 | Partial | Missing | R1 仅有门意图，缺 PassageGraph | G-V1/G-V2 |
| H07 | 连体组团 | Partial | Missing | 共墙研究存在，BuildingIdentity 缺失 | G-V1/G-V2 |
| V01 | 二三层直叠 | Deferred | Existing | V01 垂直接触且不可通行，非实体楼板 | G-V1 |
| V02 | 逐层错退 | Deferred | Partial | V03 支持链与合法/非法 Add，屋面未证 | G-V1/G-V2 |
| V03 | 半层/夹层 | Deferred | Deferred | 整数 level，不能表达任意标高 | 后续专项 |
| V04 | 两层通高室内 | Deferred | Missing | 无室内空气片/楼板缺失的统一表达 | G-V1 |
| V05 | 三层通高室内 | Deferred | Missing | 多楼层室内 Void 尚未建模 | G-V1 |
| V06 | 局部高度混合 | Deferred | Partial | 分层占用已存在，实体顶盖仍缺 | G-V1/G-V2 |
| V07 | 上下分区不同 | Deferred | Partial | 各层 RoomRegion 可不同，大跨/通行未证 | G-V1/G-V2 |
| C01 | 围合庭院 | Existing | Partial | R1 单层已验收；多层封顶不完整 | G-V1/G-V2 |
| C02 | 窄天井 | Partial | Partial | 面积/形态候选，采光和排水未证 | G-V1/G-V2 |
| C03 | 异形多边院 | Partial | Partial | 正交空格可拼形，非正交尚无 | 后续专项 |
| C04 | 单墙弱围合 | Partial | Missing | 单墙不能自动成为正式庭院 | G-V1 |
| C05 | U 形半院 | Partial | Partial | 单层 OPEN_COURT 候选，出口图缺 | G-V1/G-V2 |
| C06 | 双院/多进院 | Existing | Partial | R1 双院拓扑；院巷交通未证 | G-V1/G-V2 |
| C07 | 多层贯通天井 | Deferred | Partial | V02 3D vacant-graph 但无 RoofBoundary | G-V1/G-V2 |
| C08 | 局部盖院 | Deferred | Partial | V07 directSky 与 connectedSky 分开，尚无实体顶盖 | G-V1/G-V2 |
| C09 | 封顶室内中庭 | Deferred | Missing | top-grid sky-source 无法代表屋内封顶 | G-V1/G-V2 |
| P01 | 室外-房-院链 | Partial | Missing | R1 只有 COURT_ENTRY_INTENT | G-V1/G-V2 |
| P02 | 外墙楼梯 | Deferred | Missing | 无有效两端和批准意图 | G-V1/G-V2 |
| P03 | 室内楼梯 | Deferred | Partial | V06 2x2 ELIGIBLE_UNREALIZED；actualPassages=0 | G-V1/G-V2 |
| P04 | 折返转角螺旋 | Deferred | Deferred | 抽象 StairConnection 先行，梯级实体后置 | G-V2 |
| P05 | 下穿通道 | Deferred | Missing | 有空域不等于实体可行人通道 | G-V1/G-V2 |
| P06 | 高层连桥 | Deferred | Missing | 桥接支持不代表双端 Passage | G-V1/G-V2 |
| P07 | 阳台回廊 | Deferred | Missing | 缺楼面、栏杆及连续通行角色 | G-V1/G-V2 |
| P08 | 袋形/多层巷 | Deferred | Missing | 无跨层出口/死路 PassageGraph | G-V1/G-V2 |
| S01 | 地面支撑 | Deferred | Existing | GROUND 模式，仅语义来源 | G-V1 |
| S02 | 下层房屋承托 | Deferred | Partial | DIRECT 支持链未经过几何承载认证 | G-V1/G-V2 |
| S03 | 四柱架空 | Deferred | Missing | 无柱节点/柱脚/下部空气片 | G-V1/G-V2 |
| S04 | 落地双柱+房间 | Deferred | Missing | 缺 AND 必需混合支持源 | G-V1/G-V2 |
| S05 | 三层贯通落地柱 | Deferred | Missing | 跨楼层柱身与落地源尚未分离 | G-V1/G-V2 |
| S06 | 柱脚在下层房屋 | Deferred | Missing | 房屋梁/屋面承载源不同于地面 | G-V1/G-V2 |
| S07 | 非对称三柱 | Deferred | Missing | 多源/方向性未建模 | G-V1/G-V2 |
| S08 | 单柱+核心 | Deferred | Missing | 联合必需源集合未表达 | G-V1/G-V2 |
| S09 | 跨巷跨院支持 | Deferred | Partial | V05 ONE_BAY_BRIDGE 是未验算候选 | G-V1/G-V2 |
| S10 | 悬挑 | Deferred | Missing | 无后锚和悬挑合同 | G-V1/G-V2 |
| S11 | 幻想漂浮 | Deferred | Deferred | 独立例外域；当前只拒绝无支持源普通 Add | G-V1负例/后续 |
| R01 | 单双多坡屋面 | Deferred | Deferred | G1 几何研究不等于 R2-V 集成 | G-V2 |
| R02 | L/T/U 屋面 | Deferred | Deferred | G203/G204 局部证据，完整系统 Gate 未关 | G-V2 |
| R03 | 错层屋盖马头墙 | Deferred | Deferred | 原 UX-G205 技术项开放 | G-V2 |
| R04 | 平顶露台加建 | Deferred | Deferred | 缺实体楼面承载与可达路径 | G-V2 |
| R05 | 屋顶庭院花园采光井 | Deferred | Deferred | 使用/防水/开孔/排水未验证 | G-V2 |
| R06 | 屋盖组团 | Deferred | Deferred | G205-A 街巷仍有残余狭缝 | G-V2 |

## 维度去重（不删除追踪编号）

- H02/H03：连续 RoomRegion；L/T/U 是几何变化。H04/C03 共享非正交界面底层能力，但 Room 和 Court 语义不同。
- V04/V05/C09：通高室内 Void 共享；层数及是否封顶分别表达。C07/C08/R05：共享天空、盖檐和 RoofBoundary 关系，但屋顶使用/排水分开。
- P02/P03/P04：StairConnection 共享，内部/外部与直/折返/螺旋分属规划、体积和实体约束。P06/S09：可共存，交通图和承托图不可合并。
- **S04/S05/S06 必须保留不同支持源**：落地柱、跨层贯通落地柱、柱脚位于下层房屋承载构件上。
- H07/R06：BuildingIdentity/共墙与 RoofGroup 不同。R04/R05 中屋面可使用性、花园/院落及采光井属于多轴组合。

## 阶段优先级

- **G-V1 P0**：V04/V05/C09 封顶与室内空气；C07/C08 屋面界面抽象；P03/P06 提案/批准/抽象通行；S04–S06 支持链；T12 状态及回放。S11 仅负例。
- **G-V1 P1**：C04/C05 弱围合及院门、S03/S07/S08 多源模型泛化、P08 出口图、BuildingIdentity。
- **G-V2**：实体楼板/柱梁/楼梯/门窗/屋面/排水/几何碰撞及手机视觉专项。
- **后续专项**：非正交复杂网格、半层、坡地/水面基础、完整幻想漂浮机制。

## 核对来源

docs/EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md；docs/PROJECT-STATUS.md；docs/ACCEPTANCE-GATES.md；docs/R2-V-STAGE2-FINDINGS-v0.1.md；g1-m2/cs-cy-iw-dw-r1/src/semantics.js；g1-m2/r2-vertical-v02/src/vertical.js、src/void-and-circulation.js、tests/void-and-circulation.test.js。G1 屋面研究不能自动推定为 R2-V 已集成。
