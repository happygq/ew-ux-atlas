# EW-UX · 进度表归档

本目录是**独立 UX 研究分支**的可版本化进度表归档，不包含正式 WP1.1 任务。

- [2026-11-10 · R1 工作进度快照 CSV](./EW-UX-Progress-2026-11-10-R1.csv)：16 项当前工作条目，GitHub 可直接预览和比较版本差异。
- [项目当前状态](../PROJECT-STATUS.md)：以语义范围和验收证据说明整体里程碑。
- [当前验收关口](../ACCEPTANCE-GATES.md)：逐项声明 ACCEPTED / CANDIDATE / OPEN / NOT STARTED。
- 原 Excel v1.2 为 G204 时点的历史工作簿，当前进度以此 CSV **增量快照**为准；Excel v1.3 在原 9 个工作表之外追加 R1 收口和 Gate 两张表。旧工作表按当时的历史结论保留，不应误读为最新状态。该 Excel 文件单独作为研究交付物保存。

维护原则：新增进度快照或局部修改本表，不通过重写已冻结设计文档更新进度。状态变化必须附证据链接；测试与人工视觉 Gate 分开。CSV 采用 UTF-8，列名固定，便于 Excel 导入；核心字段为 Task ID、Workstream、Deliverable / Scope、Current status、Evidence、Verification、Open acceptance gate、Next action、Source URL。
