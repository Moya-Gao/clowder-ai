---
capsule_id: f086-overall-completion
context: "F086 Cat Orchestration — 全三里程碑完成反思"
feature_ids: [F086]
doc_kind: reflection
created: 2026-03-09
---

# F086 Cat Orchestration — 完成反思胶囊

## What Worked

1. **三段拆分策略精准**：M1(工具)→M2(意识)→M3(反思) 按依赖顺序实施，每段独立可验收、独立可合入。M1 给猫工具，M2 教猫什么时候用，M3 让猫从使用中学习——三层叠加的逻辑清晰，没有循环依赖。
2. **TDD 守护测试模式成熟**：每个里程碑先写 guard test（红），再实现（绿），避免了"改着改着忘了验收标准"。M1 的 92 个测试、M2 的 6 个、M3 的 5 个——量级与复杂度匹配。
3. **codex + gpt52 双猫设计评审**：三只猫从不同角度评审（codex 安全边界、gpt52 架构/元认知），在 Design Gate 阶段就收敛了 4 个 Open Questions，实施阶段零方向性返工。
4. **MCP 体系侦查前置**：铲屎官在 Design Gate 要求"先侦查再动手"，这让 M1 的 `cat_cafe_multi_mention` 实现直接复用了现有 callback bridge 和 WorklistRegistry，避免重复造轮子。

## What Failed

1. **M3 PR #325 云端 review 持续 8 轮**：doc-index 脚本是"简单"的工具代码，但 CRLF 处理、block-style YAML、fresh checkout 等边界场景一轮一轮暴露。教训：即使是"简单"工具脚本，也需要完善的跨平台测试矩阵。
2. **PR 合入后仍有 review 到达**：PR #325 在 R5 后自动 squash merge，但 R6-R8 仍在 review merge commit。这导致 confusion——以为在 review 分支代码，实际在 review 已合入的代码。需要更好的 PR lifecycle awareness。
3. **Vision guard 跨猫请求无回应**：向 codex 发送了 F086 完整愿景守护请求但未收到回复。可能原因：异步消息在不同 thread 容易被淹没。回退方案：codex 的 Design Gate 评审 + gpt52 的 M1 vision guard 已覆盖。

## Trigger Missed

- **M3 doc-index 的跨平台边界场景**：应在实现时就预判 CRLF/block-YAML/absent-file 三类边界，而不是等 cloud review 逐轮暴露。触发器 C（高不确定性）本应在写 YAML parser 时就触发"这有多少种格式？"的自检。

## Doc Links

- [F086 Spec](../features/F086-cat-orchestration-multi-mention.md)
- [M1 Capsule](./2026-03-09-f086-m1-multi-mention-capsule.md)
- [ADR-012 First Principles](../decisions/012-first-principles-map.md)
- [shared-rules §13](../../cat-cafe-skills/refs/shared-rules.md)
- [build-doc-index.mjs](../../scripts/build-doc-index.mjs)

## Rule Update Target

- **云端 review 后合入前的检查**：需要确认 review 针对的 commit 确实是当前 HEAD，而不是已 merge 的旧代码
- **YAML parser 实现 checklist**：遇到需要 parse YAML 的场景，先列出已知格式变种（inline array、block array、multiline string、CRLF）再实现
