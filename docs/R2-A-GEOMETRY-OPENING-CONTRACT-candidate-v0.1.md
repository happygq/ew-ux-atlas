# EW-UX · R2-A Geometry & Openings Contract · Candidate v0.1

> **NOT FROZEN** · 2026-11-10 · 独立 EW-UX 研究，不改写已冻结 v0.1/v0.2 基线、用户已验收的单层 R1，也不涉及 WP1.1 Authority。此文的研究范围与 [批准的多层计划](./MULTISTORY-VALIDATION-PLAN-v0.1.md) 一致。

## 1. 核心原则

保留用户唯一的基本建造操作 **Add / Recolor / Remove**，增加目标位置的显式 `level` 坐标。单层 `(x,z)` 邻接不能自动升级为二/三层空间连接；把“同层持久边”、“上下几何接触”、“承托依赖”和“实际可通行开口”分成四类独立语义。真实楼梯/门窗须在后续建立实际洞口、路径与尺寸验证，不能单凭颜色或上下叠置推定。

## 2. 对象与边界合同

| 数据对象 | 候选字段 / 约束 |
|---|---|
| `OccupiedCell3D` | 稳定 `id,x,z,level,color`；Remove→Add 分配新 ID；Recolor 保留旧 ID |
| `HorizontalEdgeFact` | **同层**两单元的唯一规范化无向边，持久 `OPEN/PARTITION`；Recolor 不追溯重写 |
| `VerticalContact` | `upper,lower,relation:CONTACT_ONLY,passable:false`；叠放不生成楼梯 |
| `SupportCandidate` | `cell,mode,sources,verifiedGeometry:false`；承托证据不是通行证据 |
| `RoomRegion` | `id,level,unitIds`；仅按同层持久 OPEN 边求连通 |
| `CourtyardVoidCandidate` | `id,level,cells,skyProxy,openColumns,blockedColumns`；仅为空域/上层占用代理 |
| `WallSegment`（尚未实现） | `ownerFloor,hostBoundary,room/court role,span,materialRole`；独占共享墙 |
| `ColumnBay/Slab`（尚未实现） | 楼层标高、柱跨、支撑路径、楼板真实洞口和梁柱接口 |
| `OpeningIntent`（尚未实现） | `hostWallId,kind,servedRoom/void,passageRole,clearance`；意图≠墙孔 |
| `RealizedOpening`（R2-B/C） | 实体墙孔、门框/窗棂/过梁/窗台/门槛以及相应通行图边 |

独立实验合同名：`ew/ux/r2-vertical-semantics/candidate-v0.1`。坐标 `+X` 东、`+Z` 北、`level 0..2`；真实层高、高差、楼板荷载和屋顶系统尚未冻结。

## 3. 候选支撑与事务

上层 Add 在研究原型中必须有下层直接占用，或者两侧相对下层单元夹持的 **ONE_BAY_BRIDGE_EW/NS** 语义候选。桥接只用于反证“下层庭院上方不一定敞开”，**不是已验证的梁跨或工程安全模型**；所有支持记录均标注 `verifiedGeometry:false`。

不可支持的 Add、移除必需承托的 Remove、越界、重复 Add、非法操作/颜色明确拒绝且不得改写既有状态。移除承托当前采取**保守拒绝**，不隐含倒塌、重定位或连锁拆除策略。该策略属于研究候选，后续必须评审支持路径身份稳定与合法重组。

## 4. 庭院与垂直通行的已知缺口

原型先按每层自由单元泛洪推导围合空间，再检查同坐标上层占用，形成 `OPEN/PARTIAL/BLOCKED` 的 **skyProxy**。这不等于真正三维 VoidRegion 连通、屋盖遮阳、采光、排水和庭院可达；目前尚无实体屋顶。所有叠置单元在垂直方向仍是 `CONTACT_ONLY`，`verticalPassages=[]`；**没有真正可通行的楼梯、楼板孔洞或连通图**。

## 5. V01–V04 固定场景

- **V01** 二层紧凑 2×2：上下两组房间，叠置接触但不自动贯通。
- **V02** 一层和二层各自 3×3 围合环：上层中心候选跨接遮住下层院，Remove 后重新露天；只验证占用代理。
- **V03** 3×3 首层、2×2 二层、单单元三层错退：承托链及无支撑 Add 拒绝。
- **V04** 跨层 Add/Recolor/Remove：持久 OPEN 保持，失去承托的 Remove 拒绝；撤掉上层后合法 Remove→Add。
- `ExpectReject` 仅为**测试描述符**，不属于新增的用户操作。

## 6. 证据与后续评审

[隔离 R2-V 研究原型](../g1-m2/r2-vertical-v01/README.md) 使用 Node 22.16.0 跑过 **12/12 定向测试**，四组操作日志各自重复 9 次的完整结果字节一致；拒绝操作前后状态一致。FNV 指纹仅是比较标签，**不具备密码学保证**。

**G-V1 仍为 OPEN，合同不得冻结。** 要补齐真正三维 VoidRegion、正向与负向 Stairwell/SlabOpening/PassageGraph、支撑路径替换、迁移对齐与更强性质测试；之后需独立技术审查。R2-B/C 的实体孔洞、R3-V 的完整楼板与结构、R4 多层真机视觉均另行验收。
