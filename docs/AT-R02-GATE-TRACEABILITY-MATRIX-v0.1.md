# AT-R02 · Twelve-Scenario Gate Traceability Matrix v0.1

> **PROPOSED VALIDATION CONTRACT / NOT RUN / NOT FROZEN** · 2026-11-10。基于 Typology Atlas DRAFT 中 T01–T12，保留 12 个 ID。不重命名现有 R2-V V01–V07，不宣称任何新场景已执行。G-V1=抽象语义，G-V2=后续实际几何。R1 单层已验收，不重开。

## 1. 场景及阶段映射

| 场景 | 原始关联 | G-V1 Semantic Witness（预期） | 必须有的反例/失败证据 | G-V2 Geometry Witness | 阶段 |
|---|---|---|---|---|---|
| **T01** 房间组合 | H01/H02/H05/H06 | 沿用 R1 已验收持久 OPEN/PARTITION；仅增量验证有独立 Passage 许可才能声明经门连通 | Recolor 不追溯改旧边；门候选不等于开洞 | 连续柱网、实际共享墙及真实门洞 | R1 复用；G-V1 增量 |
| **T02** 叠层错退 | V01/V02/S02 | 二层直叠→三层错退；分层身份证明、CONTACT_ONLY、支持链到合法根 | 无支撑上层 Add 拒绝；Remove 关键源失败原子性 | 高低屋面、楼板、真实承载接口 | **G-V1 P0** |
| **T03** 通高室内 | V04/V05/C09 | 二层→三层内部空气贯通；添加屋顶界面后仍为室内，不能望天空 | 仅因顶层空格未占就标记露天；楼板实墙被空气图穿越 | 真实中间无楼板、屋盖、立面及结构 | **G-V1 P0** |
| **T04** 多层天井 | C01/C02/C07 | 一层围院→二/三层围院，连通外部空气且 Room/Court 身份分离 | 被实体楼板封闭却宣称露天；空气可通误认为人可通 | 实际天井、围廊、排水、围护 | **G-V1 P0** |
| **T05** 开放/多院 | C03/C04/C05/C06 | 单墙弱围合→U 半院→双院，明确 CourtRegion 成立条件与出口身份 | 单墙被当作完整院落；死路谎称有效出口 | 非矩形院墙与多院实体门廊 | G-V1 P1 / G-V2 |
| **T06** 盖院中庭 | C08/C09/R05 | 露天→部分覆盖→完全封顶；directSky、airConnectedSky、daylightProxy 分离 | 有透明封顶仍被判为空气对天开放 | 真实屋面、天窗、集排水 | **G-V1 P0** |
| **T07** 楼梯 | P02/P03/P04 | 系统提案→必要时轻量确认→持久批准意图→抽象开孔与 Passage 意图；两端有效且许可 | 无端点/隐私不准/不合法支撑；候选未经批准不能穿楼板；撤销后不幽灵通行 | 楼梯实体、楼板真孔、净空、转角和螺旋 | **G-V1 P0**（形态后置） |
| **T08** 下穿与连桥 | P05/P06/P08/S09 | 空域、桥上双端 Passage、桥体 SupportGraph 独立；下方空域可存在 | 单端桥假可达；跨巷支持存在即推导通行；下方空气被误填满 | 实体桥梁、桥下净空、入口及柱梁 | **G-V1 P0** |
| **T09** 四柱/三柱 | S03/S07 | 支持源多节点图、柱脚与空域并存；对称/不对称源集合可表示 | 任一必需柱移除后错误保留合法承托 | 四柱/三柱实体尺寸、梁节点和撞击 | G-V1 P1 / G-V2 |
| **T10** 双柱混合支撑 | S04/S05/S06 | 分别表达落地双柱+房间、贯通落地双柱+房间、柱脚在房屋承载构件上的双柱；AND/OR 与根节点可追踪 | 屋顶柱误标落地；删掉必需源仍成功；候选跨接冒充认证 | 柱脚、贯通段、梁柱接口与净空 | **G-V1 P0** |
| **T11** 特殊支撑/漂浮 | S08/S09/S10/S11 | 当前仅证明常规无根支持失败和幻想许可隔离，不实现实际漂浮 | 普通 Add 无支持源自动被允许、隐式迁移成幻想模式 | 悬挑后锚、幻想锚及特殊物理后续专门 Gate | **G-V1 仅 P0 负例** |
| **T12** 组团动态重组 | H07/V07/P07/R02/R03/R06 | 跨层 Add→Recolor→Remove→Add：BuildingIdentity、Room/Void/Support/Passage 受影响闭包、ID/决策日志稳定、拒绝字节不变 | 不相关楼梯跳位、支持来源无理由变更、自动修改已存 OPEN、失败后半提交 | 实体共墙、屋盖、巷道、材料及排水更新 | **G-V1 P0** |

## 2. 与历史 V01–V07 的最小证据复用

| 既有场景 | 已经记录的有限证据 | 可支持的新 T 场景；仍需补的增量 |
|---|---|---|
| V01 | 2×2 两层 Contact-only、不自动垂直通行 | T02/T07；尚无批准楼梯及真实 Passage |
| V02 | 16-Add 围院、覆盖/移除使空格通天→封闭→恢复 | T04/T06；无显式实体 RoofBoundary |
| V03 | 三层错退、无支持上层 Add 拒绝 | T02；不证明复杂柱脚和屋盖 |
| V04 | 历史边保留，失支持 Remove 拒绝 | T12；不证明复杂组合的全部事务 |
| V05 | DIRECT→ONE_BAY_BRIDGE_EW→DIRECT，来源 ID 稳定 | T08/T10；不证明梁跨的真实承载 |
| V06 | 2×2 楼梯提案创建、Recolor 保留、Remove 消失 | T07；不证明审批、真实开孔或 Passage |
| V07 | 局部盖院 directSky PARTIAL，但侧方仍接天空 | T04/T06；不证明真实屋面或采光物理 |

既有 Node 22.16.0 本地 **26/26** 是文档既有记录，**本轮未重测，也不把它转计为新 T01–T12 的测试通过**。

## 3. G-V1 退出证据协议（候选）

每个 G-V1 P0 场景提交以下可审计资料，不以截图代替状态证据：

1. 从空状态或经明确版本化 fixture 恢复的 **Add/Recolor/Remove 前缀序列**；若有轻量确认，保存并严格排序 **DecisionLog**（不新增基本建造命令）。
2. 每步 ConstructionCell、Room/Building/SpaceUse、Volume/Boundary、VoidRegion3D、SupportGraph、OpeningProposal/ApprovedIntent、PassageGraph 的**仅覆盖实际存在对象的快照**；未实现证据明示 unrealized。
3. 正例至少一项；非法 Add、错误楼梯端点、未授权跨空间、破坏支持的 Remove、遮盖误判等负例覆盖所承担的不变量。
4. 失败前后状态字节一致；重放同一输入和规则版本确定性相同；未受影响区域的 ID/事实稳定。
5. 每条自动生成的意图及依赖源可以追溯到具体原始单元 ID 与决策来源；策略变化需说明旧回放影响。
6. 独立技术审查明确接受范围、尚缺的 G-V2 实体证据及未解决的 Q 项。**用户或审查负责人明确批准后**才能请求关闭 G-V1 / 冻结 R2-A。

## 3A. G-V1 P0 · 可执行语义 Witness 规格（B1/B2/B3/B4/B6）

> **NOT RUN / TEST SPECIFICATION ONLY**。以下是必须在 R2-V3-A/B/C/D 中实现的**新**定向回放；并非已经通过的 26/26。候选错误码与字段名不是现有 API。任何“拒绝”必须保证世界可见状态、ID 计数及有效意图不变；“有效降级/暂停”是合法编辑引起的状态变化，不能混称为操作拒绝。

**统一记录封套**：每份 Witness 必须记录 (a) 初始世界版本/fixture 的明确 provenance；(b) 完整 ConstructionLog 的有序 Add/Recolor/Remove 前缀；(c) 通过 proposalId 与 inputPrefix 绑定的 DecisionLog（若存在）；(d) 使用的规则/策略版本和规范排序；(e) 每步 Occupancy3D、VolumeFragment/BoundaryPatch、Space/VoidRegion、SupportGraph、PassageGraph 的实际存在对象快照；(f) 结果/拒绝码及前后字节比较、未受影响 ID 稳定性；(g) 可独立重放的规范记录。fixture 直接注入的语义对象只能作为**单独标注的模型级单元验证**，不可冒充三操作与确认流程的可达性证明。

| G-V1 P0 场景 | 最小正例与来源 | 必须有的负例或失效过程 | 应断言的核心结果 |
|---|---|---|---|
| **T02** | 同一 ConstructionLog 建直叠/错退；已获准的 Direct/Ground 来源链和版本化规则 | 无支持上层 Add；删除唯一必需根而没有获准 OR 方案 | 拒绝时 `REJECT_SUPPORT_UNRESOLVED`（候选码），状态字节不变；Room/Floor 身份与 CONTACT_ONLY 不被转为通行 |
| **T03** | 固定 Add 历史 + 经确认 `DOUBLE_HEIGHT + COVERED_OPAQUE`，生成封闭跨层 SpaceRegion3D | 相同占用但无空间/屋盖决策；或封顶却被标为 directSky | 无决策只产生 staging-only `PENDING_CHOICE`，不进入 canonical ConstructionLog/已准入世界、不能作为后续 Add 承托；确认后建造+决策原子提交，`directSky=false, airConnectedSky=false` |
| **T04** | 围合 Add + 被确认的竖向 OPEN_COURT / OPEN_TO_SKY 选择，产生多层 VoidRegion | 同址上层楼板界面封闭，却把空气连接至 SKY_EXTERIOR；或把空气通风误当人流 | closedPatch.airOpen=false 时无空域边；人员 Passage 不从空气图自动生效 |
| **T06** | 使用与 T03 **相同 ConstructionLog/占用**，不同的已存 `OPEN_COURT + OPEN_TO_SKY` 决策；再由被确认的 COVERED_TRANSLUCENT 意图衍生屋盖 | 同占用无决策任意判定封顶；透明封顶时 airConnectedSky=true；局部盖檐就认定全院密闭 | 区分 directSky、airConnectedSky、roofClosed、daylightProxy（后者仅候选）；同一操作请求在未确认时不占用正式格子或消耗正式 ID；确认后建造+屋盖决策必须同事务发布 |
| **T07** | 同层操作 + 系统楼梯 Proposal→权限/身份确认→ApprovedIntent，抽象开口与两端一致；另测取消/重新确认 | 单一 2×2 提案静默批准；端点失效/跨私密域；过期前缀确认；Remove 后幽灵楼梯 | 正例 `abstractRouteAuthorized=true, physicalPassable=false`；合法 Remove 自动派生 SUSPENDED/INVALIDATED、无第二 eventSeq；用户 WITHDRAW/REAPPROVE 才产生新的 DecisionLog eventSeq；失效不能自动复活，拒绝原子回滚 |
| **T08** | Add 建上层跨巷体量 + 已批准两端 Passage 意图 + SupportGraph AND 源；下方 Void 存在 | 单端桥、未批准承托候选或把下方空气填实；“桥有承托所以可通行” | 支持图/人员通行图/空气图三图独立；几何净空和实体桥后置 |
| **T10** | S04/S05/S06 分别有不同柱脚源，AND 必需源与获准 OR 备选；记录替换来源 ID | 删除一项必需柱且无合法备选；屋顶柱脚误记为 GROUND；用 Stage2 ONE_BAY_BRIDGE 候选冒充获批方案 | 无备选拒绝且状态不变；有备选更新支持来源且上层 unitId 不变；全部普通路径根节点有效 |
| **T11（限定）** | 普通下层支持明确缺失时执行无根上层 Add | 企图自动改成 S11 幻想漂浮或仅凭普通候选允许提交 | `REJECT_SUPPORT_UNRESOLVED`，fantasyGranted=false，拒绝不修改世界 |
| **T12** | Add→Recolor→Remove→Add + SpaceIntent/StairDecision 全序；Region 拆分、合并、再拆分，检查已批准意图的依附关系 | 相同 eventId 不同 payload、旧前缀、乱序重放；删除后旧 Room/Boundary ID 被错误复活；无关楼梯跳位 | 幂等同载荷；合法 Remove+自动失效同事务且仅 Remove 消耗 eventSeq；冲突及非法世界操作原子拒绝；已失效意图不复活；无关 IDs/事实稳定；版本化重放字节一致 |

**跨场景强制组合 W-00（B1）**：T03 与 T06 提供完全相同的 Occupancy3D 与 ConstructionLog 字节，但两个不同且明确记录的 DecisionLog，结果合法而不同；第三份缺失必需决策时仅保留独立 staging 草稿 `PENDING_CHOICE`，**没有已提交 ConstructionLog 或已准入 ConstructionCell**；不得靠当前颜色自动选空间类型。此要求用于证明差异**可由用户授权过程创作**，而不是靠研究者手工伪造世界状态。

**验证层级**：

- **Semantic Witness**：合法构造历史 + 必要轻量确认 + 确定性策略 → `SEMANTIC_VALID` / `PENDING_CHOICE` / `REJECTED` 等，附当前有效的 `abstractRouteAuthorized` 和 `physicalPassable=false`。不得把 Stage2 的 `SOLID_UNOPENED` 视为真实开孔。
- **Geometry Witness**：后续 R2-B/C、R3-V/G-V2 对墙、楼板、楼梯实体、柱梁源位置、交汇和排水产生独立证据；即使具几何验证也不能宣称建筑工程法规认证。
- **Owner Visual Witness**：R4 不同楼层与三视角真实设备体验，不能由上述两级代签。

## 3A-F · F1/F2 仅增量验收契约（未执行）

| ID | 起始条件及操作 | 强制断言 |
|---|---|---|
| **F1-01** | 对尚需 Roof/Space 决策的 Add 提交后不确认；尝试在其上方再 Add | ghost 可见，但 canonical ConstructionLog / WorldSnapshot / RegionId / SupportGraph / PassageGraph 均不变；后续依赖 Add 不得借用 provisional 支撑 |
| **F1-02** | 同一建造请求分别确认 `DOUBLE_HEIGHT+COVERED_OPAQUE` 和 `OPEN_COURT+OPEN_TO_SKY`；另设不确认副本 | 前两者经各自原子建造+Decision 事务后 ConstructionLog 相同而 DecisionLog 不同、空间解释不同；未确认副本无已提交建造日志，不是第三个合法世界 |
| **F1-03** | 草稿 PENDING_CHOICE 后，世界 HEAD 被另一合法操作推进；对旧草稿确认或取消 | 旧前缀确认 fail-closed，世界字节不变、不消耗正式 unitId/eventSeq；取消只丢弃 staging；须重新候选/批准 |
| **F1-04** | 已确认决策但最终支持、空间/权限或事务发布检查失败 | 建造与决策全部回滚，不得留半发布 Space/Void/Support/Passage，也不得消耗正式 ID |
| **F2-01** | T07 有效批准楼梯，合法 Remove 使端点身份消失 | 一个有 eventSeq 的 Remove，同事务派生 INVALIDATED 并断开抽象 Passage；**没有**新的 DecisionLog/eventSeq；不可因新 Add 复活旧 intentId |
| **F2-02** | 由暂时性支持/权限变化触发合法 Remove 或 Recolor、原端点仍有效 | 同事务派生 SUSPENDED，回放同一个权威操作恢复一致失效原因；`abstractRouteAuthorized=false` |
| **F2-03** | 一条 ACTIVE 意图被用户主动 WITHDRAW；另有一条因临时前提失效而 SUSPENDED 的意图待 REAPPROVE | 主动 WITHDRAW 与 SUSPENDED 意图的 REAPPROVE 分别属于 DecisionLog 事件，各获自己的 eventSeq；只有绑定身份未退役、前提重验通过者才能重新 ACTIVE；已 WITHDRAWN 或 INVALIDATED 的旧意图不得直接复活，须新 proposal/intentId |
| **F2-04** | 同事件重投、冲突 ID、旧前缀、拒绝式 Remove，以及丢失派生诊断后从全序重放 | 重投幂等无新 seq；冲突/拒绝世界字节不变；删除派生诊断不影响重放的状态和 PassageGraph；没有双写造成失效事件漂移 |

**Gate 解释**：这些都是 R2-V3 后续测试规范，不是本轮实际运行。F1 未准入草稿禁止被作为支撑或通行来源；F2 由建造引起的自动失效是派生事实，不是权威 DecisionLog。其余 B1–B6 验收与 48 ID 追踪均不重开。

## 3B. 八项原始场景未显式映射类型的追踪处置（B5）

原始 T01–T12 的类型关联不改写，最初明确覆盖 **40 / 48** 个追踪 ID。下表八项作为**二级关联或明确延期项**补全 48/48 的规划追踪，不代表新增场景已通过；Coverage Matrix 的 48 项新列给出完整逆向映射。

| 类型 ID | 二级场景引用 | 验证边界 |
|---|---|---|
| H03 | T01/T12 | 同层复杂 RoomRegion 组合可复用既有语义；L/T/U 真实墙屋顶 G-V2 |
| H04 | T05 | 非正交边界专门延期，T05 不要求 G-V1 实现斜角 |
| V03 | T02 | 半层及不等层高延期至标高专项，非 G-V1 必证 |
| V06 | T02/T12 | 多层占用/身份 G-V1 增量；真实高低接缝 G-V2 |
| P01 | T01/T05 | 入口链需 G-V1 授权语义增量；真门洞 G-V2 |
| S01 | T02/T10 | Ground/Foundation 作为支持图基础根的正反例 |
| R01 | T06 | 屋盖封闭为 G-V1 抽象边界，实际屋坡形态 G-V2 |
| R04 | T06/T12 | 屋顶露台的使用/支撑/通行/防水属于 G-V2，不可从 RoofClosure 推导 |

**B5 接受阈值**：48 个 ID 均有原始 T 关联或上表明确归属；Deferred 有技术理由和未来 Gate，未新增“未审查即接受”项。独立评审仅核对增量，不重复冻结 R1。

## 4. G-V2 明确保留的独立验收

- 二/三层真实楼板、已批准开孔与梯级、踏步/转角/平台/净空、门洞门槛与柱梁互不穿透。
- S03–S10 柱脚、连接梁、跨接、外廊、桥体下穿及悬挑后锚的具体几何及研究级容量/尺寸限制；不得表述为真实工程结构安全认证。
- 室内/露天/透明顶盖以及连续屋盖的网格符合 Envelope/Roof；屋脊谷线、排水方向和院落出水可解释。
- 多建筑真实共享墙、巷道宽度、残余窄缝、T/U/L 交汇、屋盖高低层差、Remove 后重组。
- 三视角手机视觉与性能属于 R4；不能由 G-V2 的网格检查自动推定。

## 5. 最小推进计划（不得提前编程）

- **AT-R02**：研究文档和矩阵独立审查；确认 Q-01 至 Q-06 或附延期及不变量影响。
- **R2-V3-A**：体积/接口语义与 T03/T04/T06 的最小正反例。
- **R2-V3-B**：SupportGraph 与 T02/T08/T10/T11 限定负例（T09 只需必要泛化）。
- **R2-V3-C**：意图记录/抽象开孔/PassageGraph 与 T07，另 T01/T08 增量。
- **R2-V3-D**：跨模型 T12 联合重放、原子拒绝、身份稳定、独立 Gate 评审。
- **之后**：R2-B/C、R3-V/G-V2、R4，保持其已有独立验收范围。

## 6. 构建限制与资料来源

本文件仅是项目研究合同草案：没有执行 T01–T12，没有修改已冻结基线、R1、Stage2 源码或 WP1.1 Authority，也没有改写已有 26/26 测试记录。来源：docs/EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md；docs/R2-V-STAGE2-FINDINGS-v0.1.md；docs/MULTISTORY-VALIDATION-PLAN-v0.1.md；docs/ACCEPTANCE-GATES.md；g1-m2/r2-vertical-v02/src/{vertical,void-and-circulation,extended-scenarios}.js 与既有 tests。
