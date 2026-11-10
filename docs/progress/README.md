# EW-UX · 进度表归档

本目录是**独立 UX 研究分支**的可版本化进度表归档，不包含正式 WP1.1 任务。

- **最新候选：** [R2-V Stage2 进度快照 CSV](./EW-UX-Progress-2026-11-10-R2V-Stage2.csv)：26/26 本地定向测试，三维空域、支撑源和未实现楼梯候选；G-V1 仍开放。
- **前一轮：** [R2-A/R2-V v0.1 语义进度](./EW-UX-Progress-2026-11-10-R2V-Candidate.csv)：12/12 历史快照不修改。
- **此前决议：** [2026-11-10 · R1 单层验收 + R2-V/R3-V 决议进度快照 CSV](./EW-UX-Progress-2026-11-10-R2V-Decision.csv)：保留旧快照不变，新增强制多层工作包与验收范围。
- [2026-11-10 · R1 初始收口历史 CSV](./EW-UX-Progress-2026-11-10-R1.csv)：16 项历史条目，**不是最新验收状态**，只供差异追溯。
- [项目当前状态](../PROJECT-STATUS.md)：以语义范围和验收证据说明整体里程碑。
- [当前验收关口](../ACCEPTANCE-GATES.md)：逐项声明 ACCEPTED / CANDIDATE / OPEN / NOT STARTED。
- 原 Excel v1.2 为 G204 时点的历史工作簿，当前进度以此 CSV **增量快照**为准；Excel v1.3 在原 9 个工作表之外追加 R1 收口和 Gate 两张表。旧工作表按当时的历史结论保留，不应误读为最新状态。原 Excel v1.3 单独作为历史交付物保存；新 Excel v1.4 在其 11 个历史工作表之外追加 2 张最新验收与多层计划工作表。本仓库以上述**新版 CSV**作为可 diff 的进度归档；Excel v1.4 作为本轮对话交付附件，若未见对应 .xlsx 文件，不应认定它已上传 GitHub。

维护原则：新增进度快照或局部修改本表，不通过重写已冻结设计文档更新进度。状态变化必须附证据链接；测试与人工视觉 Gate 分开。CSV 采用 UTF-8，列名固定，便于 Excel 导入；核心字段为 Task ID、Workstream、Deliverable / Scope、Current status、Evidence、Verification、Open acceptance gate、Next action、Source URL。
