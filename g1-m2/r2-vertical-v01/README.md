# EW-UX · R2-A / R2-V · Multistory Semantic Candidate v0.1

**G-V1 OPEN · NOT FROZEN.** 本研究原型独立于单层 R1、G203/G204 和 WP1.1 Authority，不覆盖任何历史验收页面。

从空状态用用户已有的 Add / Recolor / Remove（增加楼层目标 `level`）重放四组场景：V01 二层堆叠但无自动楼梯，V02 二层院落的露天/遮盖代理变化，V03 三层错退及无支撑拒绝，V04 跨层改色/增删与保护承托。失败预期 `ExpectReject` 仅属于测试描述，不是新的建造命令。

运行：Node 22 的 `npm test`。首次本地测试 **12/12 通过**，四组固定操作序列各重复 9 次结果字节一致；测试脚本见 `tests/vertical.test.js`。可通过本目录 `index.html` 打开三层网格示意预览，无需 WebGL。

**未证明：** 真正三维 VoidRegion、真实楼梯/跨层可通行图、墙体实际洞口、梁跨和楼板承载、屋盖、排水、多层结构安全或 Safari 手机性能。 `ONE_BAY_BRIDGE` 只是候选承托语义，不能作为真实建筑安全依据。

上游：[R2-A 合同候选](../../docs/R2-A-GEOMETRY-OPENING-CONTRACT-candidate-v0.1.md) · [多层验证计划](../../docs/MULTISTORY-VALIDATION-PLAN-v0.1.md)。Gate G-V1 需补齐空域连通、竖向交通正反例、独立技术审查后才有资格关闭。
