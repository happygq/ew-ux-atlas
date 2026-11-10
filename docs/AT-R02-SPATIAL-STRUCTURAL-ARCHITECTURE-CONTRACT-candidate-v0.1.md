# AT-R02 · Spatial & Structural Architecture Contract — Candidate v0.1

> **REVIEW CANDIDATE / NOT FROZEN / NOT IMPLEMENTED** · 2026-11-10  
> 适用范围：独立 EW-UX 建筑生成研究。不得更改 WP1.1 Authority、已冻结建筑设计基线 v0.1/v0.2、已验收 R1 研究原型。不得据此宣布 G-V1 关闭、R2-A 冻结、工程结构安全或实体楼梯可通行。  
> 来源：Spatial & Structural Typology Atlas v0.1 DRAFT、Typology Atlas Handoff、PROJECT-STATUS、R2-V Stage2 Findings；决议 D1–D5 由用户明确批准。本文件是其候选数据合同实现化，不意味着具体字段已批准。

## 0. 决策与约束

- **D1**：H01–H07、V01–V07、C01–C09、P01–P08、S01–S11、R01–R06 的 48 个追踪 ID **不改名、不删除**。实现采用共享原型、横向变化维度和跨类型组合关系；一个实际实例可满足多个类型。
- **D2**：规则网格保留为构造、索引与操作坐标；体积和边界使用分层语义模型，不再把一格“已建单元”自动等同于充满实心材料的体积。支持室内空气、楼板、顶盖、开孔和柱件独立表示。
- **D3**：自动产生楼梯候选；在策略要求时轻量确认，持久记录已授权意图。候选、授权意图与实体通行三者严格区分。
- **D4**：统一 SupportGraph；多源和多层柱脚可追踪。几何验证及工程安全不得从拓扑合格推导。
- **D5**：幻想漂浮仅作为显式、隔离的例外机制；当前常规路径对无可解释支持源的 Add/Remove **fail closed**。
- 唯一基础建造动作仍是 **Add / Recolor / Remove**（可包含 level 选择）。确认楼梯候选属于独立且必须被重放记录的意图决策，不伪装成第四种建造动作，也不因当前状态可重新推导而省略持久记录。
- 只对设计增量开展评审。保留 R1 单层验收、R2-V Stage1/2 既有场景 V01–V07 和历史测试记录。此合同不要求重新执行它们。

## 1. 语义模型：标识、体积与界面

### 1.1 最小对象与标识（研究 DTO 候选，字段名未冻结）

| 对象 | 必备信息 / 与其他对象的区分 |
|---|---|
| ConstructionCell | stable unitId, gridIndex(x,z,level), buildColor, operation provenance；是一条用户授权建造事实，**不是**单一实心体积 |
| BuildingIdentity | buildingId, ownership/scope, access policy（至少有不可跨越的边界），**不同于** BuildColor / RoomRegionId |
| SpaceUse | 空间使用角色（room/court/circulation/service/unknown）和适用限制；未知不得被自动推定为允许通行 |
| VolumeFragment | 空间索引内有界体积片，kind = SOLID / INTERIOR_AIR / EXTERIOR_AIR / RESERVED_VOID；同一体积位置不得有相冲突归属 |
| BoundaryPatch | 两体积间有向或规范化界面，kind = WALL / SLAB / ROOF / OPEN_INTERFACE / GROUND / SPECIAL；含两侧 volume IDs 和可穿透/允许传输的抽象条件 |
| HorizontalEdgeFact | 同层建造时持久 OPEN/PARTITION；R1 历史事实不由最新颜色覆盖 |
| RoomRegion | 建造意义上的水平连接及空间服务身份；不直接等于自由空气连通，更不等于门洞可通行 |
| VoidRegion3D | 同域连通的空气/空洞片及其外界、天空、室内/室外分类；使用 BoundaryPatch 而不是只靠空格邻接 |
| SupportGraph | 有类型的支持节点、要求、可选支持方案、源 ID、证明阶段和向下依赖 |
| PassageGraph | 起终空间、授权与实际通行状态；不得用上下接触或空气可达性自动填边 |
| Envelope/Roof | 对合法空间界面/构件组生成的实体几何及其实际验证证据；几何所有权唯一 |

**非目标**：本阶段不确定真实厘米尺寸、材料截面、受力能力、规范合规、非规则格网精确布尔运算、屋面水力计算或正式 Authority DTO。

### 1.2 体积模型的必要分离

1. 网格定位的是候选建造单元和局部空间范围，不是强制填满的实体。允许一个单元内同时存在柱件实体和可使用空气体积，也允许跨多个网格单元的同一 RoomRegion / VoidRegion3D。
2. 建造单元到 VolumeFragment / BoundaryPatch 的映射应确定、可解释、可重放；映射变化不得重写既有 unitId/历史边事实。
3. 室内通高大厅、天井、桥下空气和封顶中庭都可以出现空气片。**空域标签不得由“这个格子没有建造单元”独自推断。**
4. 空气可达天空必须通过明确允许空气连接的界面：directSky 与 skyConnected 分开。封顶室内即使位于计算网格最顶层，也不得因为“上面没有占用格”就被标成露天。
5. 有采光的透明顶盖 ≠ 空气通天；可通空气 ≠ 行人可通过。实际开口、可通行许可和净空必须另证。
6. 边界接口与开孔均具有独立身份，Remove 后不能留下幽灵楼板、幽灵楼梯或孤立洞口。尚未证实的抽象开孔不得把实体 SLAB 标记为已穿透。

## 2. 强制不变量

### O · Occupancy & identity

- **O-01**：构造状态由合法 Add/Recolor/Remove 序列形成；Recolor 保持 unitId 和已存 OPEN/PARTITION，Remove→Add 分配新 unitId。
- **O-02**：同层水平贴邻、上下实体接触、建筑身份、RoomRegion 和实际可通行关系互不替代。
- **O-03**：相同实体体积不允许重叠的互斥所有者；结构柱与室内空气以几何/体积子片方式共存，不得两次占满同一子片。
- **O-04**：无关范围建造不应重排已存在的受影响范围外身份或持久事实；所有失败操作原子拒绝，状态字节不变。

### VD · Void and envelope interface

- **VD-01**：室内 / 室外、直接望天 / 仅经相邻空域通天 / 封闭于屋顶之下、是否有可行人路径均是独立性质。
- **VD-02**：连通只能穿过被授权为空气连通的 BoundaryPatch；不得沿密闭楼板、墙或屋盖的视觉穿插错误连通。
- **VD-03**：楼板孔洞作为独立 Interface Intent 表达；实体开孔缺失时必须明确标注 unrealized、不可通行。
- **VD-04**：区域合并/拆分后可再现同样分区；未改变区域的稳定身份与语义不因重建顺序任意漂移。

### SG · SupportGraph

- **SG-01**：每个非地面承托构件给出明确依赖源（地基、墙、柱、梁、楼板、承载体、或显式幻想锚）；不能以“另一格存在”替代实际支撑源的语义类型。
- **SG-02**：表达 **AND 必需源集合** 与 **OR 备选承托方案集合**。例如双柱+承载体可能三者共同必需；替代一跨方案只有在规则允许时可选。选用方案必须确定且可解释，不得把“存在多源”自动视为“任一源即可”。
- **SG-03**：普通支持链终止于允许的基础/地基节点，禁止循环和孤立根。每条边记录来源身份、条件和证据状态。
- **SG-04**：区分 CANDIDATE、SEMANTIC_ADMISSIBLE、GEOMETRY_VERIFIED、SEMANTIC_COMMIT_ELIGIBLE、PHYSICAL_USE_ELIGIBLE 等独立证据；幻想授权不属于普通规则域。当前 ONE_BAY_BRIDGE 仅是未验算候选，不自动获得几何通过。
- **SG-05**：Remove 之后仅在同一原子事务内选择被版本化策略批准、满足 AND/OR 源依赖与语义准入条件的确定性替代方案；否则拒绝 Remove，禁止隐式坍塌、自动搬移或无授权浮空。不得以支持链更换改写未删除的上层 unitId。
- **SG-06**：S04 直接落地柱、S05 贯通落地柱、S06 柱脚位于下层房屋的承载构件必须有不同源节点及支持链；相似二维投影不等于同源。

### PG · PassageGraph and stair policy

- **PG-01**：上下 CONTACT_ONLY 不授权任何竖向通行；门/楼梯/连桥须有两个有效服务端点、空间/建筑身份政策、抽象开口要求和路径条件。
- **PG-02**：OpeningProposal → ApprovedOpeningIntent → RealizedOpening 三类证据事件分别追加、不可覆盖（其当前有效性可能改变）；未取得且未保持有效的实体几何证据前**不得标记 physicalPassable=true**。提案只能作为只读建议。
- **PG-03**：提案来源、算法版本、候选空间身份、被服务端点、批准来源和对应操作历史前缀必须可追溯。自动推导候选不等于用户已批准该意图。
- **PG-04**：多候选或空间身份/私密性有歧义时必须轻量确认；即使只有一个几何候选，未明确批准的通用自动许可策略也不得静默批准。
- **PG-05**：如删除、分区或支持变更使已批准意图的前提失效，意图记录继续可审计，当前有效性改为 SUSPENDED/INVALIDATED；恢复须重新审批并记录，不能自动改绑或凭旧已批准证据复活。
- **PG-06**：所有楼梯候选、审批、撤回、接口状态及失败原因可在相同输入历史和意图决策日志下确定性重现。

### ER · Envelope/Roof and evidence

- **ER-01**：共享墙、屋面交界、梁柱、楼板、开口拥有唯一几何责任方；不允许几何重叠、悬空构件或假开孔被当作通过。
- **ER-02**：屋盖和天窗改变空气/天空语义必须经过明确 BoundaryPatch；仅外观覆盖不自动改变通行语义。
- **ER-03**：真正门窗与楼梯须具真实开孔、净空、与柱梁及排水兼容的几何证据；属于 G-V2 或相应 R2-B/C 实体 Gate。
- **ER-04**：屋脊、谷线、排水、连续墙屋檐、G205 高低屋面和正式接口的验收属于独立后续工作，不用本语义 Gate 替代。
- **ER-05**：审美、GPU、手机视觉和工程力学安全是不同的验收类别，不得从任一语义测试通过外推。

## 3. 组合与拒绝边界

| 类型组合 | 语义正例 | 必须拒绝或保持未实现的反例 |
|---|---|---|
| H02 + V07 | 每层独立 RoomRegion，上一层可有不同分区 | 因下层分割将上层大空间错误拆分 |
| V04/V05 + C09 | 室内通高空域与顶盖围护并存 | 顶盖封闭却宣称直通天空 |
| C07 + C08 | 部分盖檐且经相邻空域连通天空 | 局部遮盖直接导致整座庭院误封闭 |
| P03 + V01 | 端点、身份、抽象开孔意图与承托均受控 | 叠置房间直接生成已实现楼梯 |
| P05/P06 + S09 | 桥下保留自由空域，通行与支撑分别可证 | 有承托便假设桥能行人通行 |
| S04/S05/S06 | 柱脚来源正确，多源依赖链可区分 | 柱悬在屋顶之上却被标记为落地 |
| S10/S11 | 悬挑保留受控后锚，幻想需显式授权 | 普通支撑失败时默认允许漂浮 |
| H07 + R06 | BuildingIdentity、共墙及屋盖边界一致 | 建筑贴邻必然合室内、无出口窄缝当作巷道 |

组合结果须区分 SEMANTIC_VALID、PENDING_GEOMETRY、INVALID；是否满足实际工程结构安全另列为无认证状态，不融入上述语义判断。

## 4. 状态变化和确定性

1. 用户建造日志与**意图决策日志**是两个明确的输入流。意图决策记录与被决策的建筑状态前缀绑定；二者共同决定回放结果。视角、材质和指南针不得改写任一流。
2. Add/Remove 的应用、受影响范围的拓扑重算、承托替代选择、意图有效性检查及拒绝结果应具有事务一致性；任何中途失败均不发布半成品语义。
3. 派生的 Room/Building/Void/Wall/Opening 身份必须明确 ID 分配及合并/拆分策略；不能仅声称“排序后确定性”就满足局部稳定性。
4. 为保持回放，版本化规划策略、候选生成和 tie-break；更改规划策略必须说明旧历史重放影响，不能静默生成不同楼梯/承托路径。
5. 必须保留每步可观察的正例和至少一个拒绝/取消反例，验证失败原子性、非相关区域稳定和源 ID 可追溯。

## 5. 阶段边界

### G-V1 必须完成的研究级语义证据

- T02：二/三层占用、明确接触和支持拒绝。
- T03：室内通高与露天/封顶的区别。
- T04/T06：三维天井空域、部分/完全遮盖与显式屋顶界面。
- T07：抽象开孔、自动候选、必要时确认、授权意图、无端点与冲突反例；不要求实体梯级。
- T08：桥上通行与桥下空气、桥体支撑三者分开。
- T10：S04/S05/S06 的支持源、AND/OR、删除/替代的边界。
- T11（限定负例）：普通模式无支持源时拒绝；不开发幻想漂浮。
- T12：完整编辑前缀、状态字节、稳定 ID、无关区域不变、确定性重放与独立技术审查。

### 明确留给 R2-B/C 与 R3-V/G-V2

实际楼板孔洞、门窗洞、楼梯踏步/平台/净空、真实柱梁跨度与实体碰撞、完整屋面/谷线/排水、可用的屋顶露台、巷道实际净宽、二/三层空间几何、全流形/GPU及真机视觉。**这些不通过 G-V1 获得默认通过**。非正交复杂网格和半层精确几何应单独立项，不得隐含当前 Gate 已支持。

## 6. 尚待独立技术审查的合同问题

- **Q-01 体积最小分片与 BoundaryPatch 所有权**：在一个格子内如何表示柱、室内空气、楼板和封顶，以及跨格界面稳定编号。
- **Q-02 室内 RoomRegion 与空气连通图的关系**：何时容许“建造时 OPEN 但尚未实现通行口”的中间状态，以及是否存在必须明确关闭的空间边界。
- **Q-03 AND/OR 支持方案的确定性优先级**：如何在保持上层 ID 的同时避免不必要的支持源跳变及伪合法替代。
- **Q-04 楼梯单一候选的自动批准政策**：默认仍只提案；何时允许政策级自动授权、必须由谁明确确认及如何回放。
- **Q-05 派生 Region ID 稳定性**：合并/分裂时哪个 Region 继承旧 ID、哪些需创建新 ID。
- **Q-06 建造历史和意图决策历史的排序与原子发布**：只做研究级协议，不能越界修改正式 Authority。

## 7. 交付 / 验收

本合同需与 [48 类型覆盖矩阵](./AT-R02-TYPOLOGY-COVERAGE-MATRIX-v0.1.md) 和 [12 场景 Gate 追踪](./AT-R02-GATE-TRACEABILITY-MATRIX-v0.1.md) 一同独立评审。评审必须核对 R2-V Stage2 的已知限制，给出至少 Q-01 至 Q-06 的可执行决策或明确延期理由；范围含必需正反例、重放边界和未实现实体事实。**只有评审结果被用户确认后，才可将具体 AT-R02 候选字段作为 R2-V3-A 的实现输入**。绝不因本 PR 合入而自动关闭 G-V1 或冻结 R2-A。

## 7A. AT-R02 Delta Revision · B1–B6 的候选修订合同

> **优先适用说明：** 本节细化 §1–§6 中尚未量化的语义；具体实现字段仍是候选，未获独立审查或用户冻结。本节不修改 R1 已验收行为、不追溯修改 Stage2 V05 桥接展示；所有新测试均尚未运行。

### B1 / Q-01、Q-02：三维体积、屋顶与空间意图的可创作来源

**不可忽略的歧义：** 相同的 Add/Recolor/Remove 操作日志及 ConstructionCell 占用，可以解释为两层独立房间、两层通高室内或露天天井。不能在测试中直接手工注入 RoofBoundary/SpaceUse 后，就声称已经证明三种建造动作能自动产生该空间。

| 语义 | 决策来源优先级 | 歧义处理 |
|---|---|---|
| 同层 OPEN/PARTITION | R1 建造时确定的持久 EdgeFact | Recolor 不追溯改变 |
| BuildingIdentity / SpaceUse | 已持久分组/用途、已批准版本化推导政策 | 跨不同建筑或未知用途时，轻量确认并记录；UNKNOWN 不能授权跨建筑通行 |
| DOUBLE_HEIGHT / SEPARATE_FLOORS / OPEN_COURT | 占用与持久空间意图、或唯一合法的明确版本化策略 | 同占用有多解时输出 PENDING_CHOICE，必须确认 SpaceIntentDecision |
| OPEN_TO_SKY / COVERED_OPAQUE / COVERED_TRANSLUCENT / PARTIAL_COVER | 已批准的 RoofClosureIntent 或唯一合法的自动投影政策 | 通过上下文候选确认而非新增 AddRoof 建造命令 |
| 楼梯/门洞 | 系统按建筑身份/用途/许可与抽象界面提出 OpeningProposal | 默认只有候选；审批决策独立持久化 |
| 跨院/跨巷承托 | 已批准的抽象 SupportPattern | 没有已准入模式则普通提交拒绝；仅候选不能冒充支持 |

轻量确认是附属于现有动作结果的**意图决策事件**（非第四种基础建造动作），记录 decisionId、proposalId、scope、inputPrefix、policyVersion、authorizer、choice。未解决歧义时可保留清楚标注的可回退研究中间态，但**不发布为完成的合法多层建筑**。

**强制反例 T03/T06**：使用**完全相同的 ConstructionLog 和最终格子占用**。A 的已记录决策为 DOUBLE_HEIGHT + COVERED_OPAQUE，结果是封顶的室内跨层 SpaceRegion；B 的已记录决策为 OPEN_COURT + OPEN_TO_SKY，结果是露天庭院空域。两者都可有条件合法，必须经不同有效 DecisionLog 重现。第三份没有决策的日志必须保持 PENDING_CHOICE，不得任意猜测。RoofBoundary 只能由已记录的策略/决策派生，禁止直接合成后宣称操作可达。

**最小体积与界面（Q-01）**：网格是索引，不是实心材料；单格可以有互不重叠的 SOLID 柱分片与 INTERIOR_AIR、EXTERIOR_AIR 或 RESERVED_VOID 分片。VolumeFragment 使用有限、有界、规范排序的空间子片，真实布尔网格属于 G-V2。BoundaryPatch 必须有规范界面坐标、两侧 fragment ID、唯一 owner、kind、airOpen、humanOpeningIntent、realizationEvidence。相邻两格同一真实面仅能有一个逻辑主人；局部开孔拆为互不重叠子片，未变化子片 ID 保留。天空与世界外界使用显式 SKY_EXTERIOR / OUTSIDE_WORLD 端点，而非“最高层空格”代理。透明天窗可以 daylightProxy=POTENTIAL，但 airOpen=false；采光代理不等于实际照度。

**空间关系（Q-02）**：RoomRegion 保留 R1 已验收的**水平建造 OPEN 连通**；SpaceRegion3D 聚合跨层房间/空域的授权室内关系；VoidRegion3D 依 BoundaryPatch.airOpen 计算空气连通；PassageGraph 只由获授权的通行边决定。四者不相互自动推定。密闭楼板、封顶中庭与室外天空不能仅靠空格六邻接打通。

### B2 / Q-03：SupportGraph 方案、准入与替代

SupportAlternative 为一个 **AND 必需源集合**，同一被承载对象的多个 alternative 构成 **OR 备选方案**。每个方案必须记录 patternId、policyVersion、sourceRoles/sourceUnitIds、基础终止路径、geometryEvidence 与批准状态。源角色可为 Ground、Foundation、Wall、Column、Beam、Slab、BearingAssembly；所有被选普通方案须有无环的基础根链。S04 地面双柱+房间、S05 贯通落地柱+房间、S06 柱脚落在下层房屋承载节点，必须是三种不同来源图。

资格分离：
1. **CANDIDATE**：表达了某个形态与来源，仅是提案；
2. **SEMANTIC_ADMISSIBLE**：版本化抽象支撑规则明确批准该模式，AND 源齐全，链无环且终止于允许基础根；
3. **SEMANTIC_COMMIT_ELIGIBLE**：明确标注“研究级语义提交”且满足全部语义准入，不表示可实际承载；
4. **GEOMETRY_VERIFIED / PHYSICAL_USE_ELIGIBLE**：仅后续 R3-V 实际实体及约束验证后可授予，仍**不是工程安全认证**。

Stage2 V05 的 ONE_BAY_BRIDGE_EW 与其 verifiedGeometry:false 保持**旧研究候选**证据，不能凭旧测试给新合同自动赋予 SEMANTIC_ADMISSIBLE。新 R2-V3 的普通语义提交若找不到已批准的准入方案必须 fail-closed（候选错误 `REJECT_SUPPORT_UNRESOLVED`），不能静默跨入幻想漂浮。

**替代选择规则**：优先保持先前已准入且仍有效的方案；确需替代时，仅从被批准、满足全部来源条件的 alternative 中按版本化策略优先级、patternId、规范 sourceUnitId 顺序选取，记录 before/after 源身份、政策版本和原因。不许将一个方案的 geometryEvidence 借给另一方案。T10 必须验证删一项 AND 必需源且无 OR 备选会原子拒绝；有合法 OR 备选才可替换，同时保持未删除上层 unitId。

### B3 / Q-04、Q-06：楼梯证据、当前状态与事件全序

**不可将三阶段写成单一线性状态机**。证据事件 Proposal/Approval/Realization 只追加、不覆盖；当前有效性另行维护：

| 事件 | 必备前提 | 当前结果 | G-V1 的可用性 |
|---|---|---|---|
| PROPOSE | 固定算法版本、有效候选端点及状态前缀 | PROPOSED | 不产生已授权通行 |
| APPROVE_USER 或 APPROVE_POLICY | 端点、BuildingIdentity、SpaceUse、私密性通过；自动批准须显式获准 policyVersion | ACTIVE | 仅可置 abstractRouteAuthorized=true |
| DECLINE | 有对应未批准提案 | DECLINED | 不创建通行 |
| SUSPEND | 删除/支持/权限变化使条件临时不满足 | SUSPENDED | abstractRouteAuthorized=false |
| INVALIDATE / WITHDRAW | 端点变更、用户撤销或换位 | INVALIDATED / WITHDRAWN | 不自动恢复 |
| REAPPROVE | 原意图身份仍有效、全部前提重验且新增确认事件 | ACTIVE | 抽象路线可重新获授权 |
| REALIZE | 真实开孔、梯级、平台、净空和当前许可均通过后续实体 Gate | ACTIVE + 已实现证据 | 才**可能** physicalPassable=true |

即使只有一个几何候选，**默认仍仅提案**；没有已明确批准的自动授权策略，不能自动 APPROVE_POLICY。抽象路线须具双端、授权空间身份、开孔意图和准入支持链。G-V1 要证明**正向** `abstractRouteAuthorized=true, physicalPassable=false`，而非永远只有提案；SUSPENDED/INVALIDATED 时两者均不可通。

**Q-06 事件重放**：ConstructionLog 与 DecisionLog 为两个语义流，但**共用唯一的 eventSeq 全序**；每条有 eventId、transactionId、规范 eventBytes、policyVersion、inputPrefixDigest 和前缀完整状态等价校验。先在隔离投影中完成建造、支持、空间、意图及拒绝检查，再原子发布事件和派生快照。重复相同 eventId/载荷幂等，重复 ID 不同载荷、前缀过期、乱序或部分写入应拒绝且世界可见状态字节不变；审计拒绝事件与世界提交分离。事件摘要仅是对照标签，不能替代状态全量比较或安全凭据。升级策略须说明旧历史的回放兼容性，不得静默改变楼梯或屋盖。

### B4 / Q-05：Region 与 Boundary 身份继承

unitId 仅 Remove→Add 更新，BuildingIdentity 只能按已批准的分组意图修改。同层 RoomRegion、SpaceRegion3D、VoidRegion3D、BoundaryPatch、OpeningIntent 分别拥有独立身份及不同失效边界。

- **无变化的连通分量**保留原 Region ID；拆分时，包含已持久稳定 originAnchor（最初 unitId 或 volume anchor）的子分量优先继承原 ID。若锚点已不存在，则选与原成员重叠最多的子分量，平局用规范空间坐标排序；其余子分量获新 ID 并记录 splitFrom。
- 合并时由仍存活的输入 Region 中最早创建的 ID 作为继承者，其他旧 ID 记录 mergedInto 并退役。退役 ID 不可静默复活，避免失效旧 OpeningIntent 错误重绑定。
- 对 BoundaryPatch，宿主面及子片无变化时保持 ID；局部改变只更新受影响 patch 子片，不能使无关墙段编号漂移。若所依附 Room/Space/Boundary/Support 身份失效，已批准开口须 SUSPENDED/INVALIDATED，不能留下幽灵门洞或悬空楼梯。
- T12 须覆盖 split→merge→split、无关区域稳定、拒绝原子性、旧意图不得自动复活。具体 anchor 选择和 tie-break 需经独立复核，当前仅候选。

### B5/B6：矩阵追踪与验收来源

48 个类型 ID 保留；覆盖矩阵必须对每个 ID 显式追踪到 T 场景或有理由的延期 Gate。原 T01–T12 核心关联仅显式覆盖 40 个 ID；补充 H03/H04/V03/V06/P01/S01/R01/R04 的从属或延期映射，不能将“出现在表内”冒充对应案例已经运行。G-V1 P0 每项提供可复现**正例和负例**、初始状态/操作/DecisionLog 来源、目标状态、拒绝结果、受影响闭包、身份稳定、回放证据和 `physicalPassable=false` 标记；G-V2 的真实几何/力学/视觉证据另外验收。

### B1–B6 Delta 审查索引

| 项 | 本轮候选修订 | 需独立审查的最小证据 |
|---|---|---|
| B1 | §7A 体积界面与意图来源 | T03/T06 同占用不同决策 |
| B2 | §7A 支持 AND/OR 准入 | T10 源删除、合法替代、桥接不得假认证 |
| B3 | §7A 双轴状态、全序日志 | T07 抽象正例、T12 幂等/乱序/原子性 |
| B4 | §7A ID 继承与 Patch 所有权 | T12 split/merge、旧意图不复活 |
| B5 | Coverage/Gate Matrix 的补充交叉映射 | 48 ID 均有追踪或显式后置 |
| B6 | Gate Matrix 逐能力正反例 | G-V1 证据清单与 G-V2 边界 |

**Q-01～Q-06 至此均有候选处置，但尚未完成独立技术复核与冻结。**

## 8. 核对依据

- docs/EW-UX-Spatial-Structural-Typology-Atlas-v0.1-DRAFT.md
- docs/TYPOLOGY-ATLAS-HANDOFF.md
- docs/PROJECT-STATUS.md
- docs/ACCEPTANCE-GATES.md
- docs/MULTISTORY-VALIDATION-PLAN-v0.1.md
- docs/R2-V-STAGE2-FINDINGS-v0.1.md
- g1-m2/cs-cy-iw-dw-r1/src/semantics.js（已验收单层基线，仅引用）
- g1-m2/r2-vertical-v02/src/vertical.js
- g1-m2/r2-vertical-v02/src/void-and-circulation.js
- g1-m2/r2-vertical-v02/tests/void-and-circulation.test.js

> 变更范围：仅新增研究文档；既有源文件、测试和冻结设计全部保持原样。
