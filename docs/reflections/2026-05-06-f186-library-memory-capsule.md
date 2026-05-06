---
capsule_id: "F186-2026-05-06"
context: "F186 图书馆记忆架构全量交付（6 Phase, A-F）"
feature_ids: [F186]
doc_kind: capsule
created: 2026-05-06
---

## What Worked
- 架构归一策略成功：没有新增平行 memory stack，复用 search_evidence / IKnowledgeResolver / scope-dimension 分离，减少了概念膨胀
- 三层安全门控（build-time classify + query-time filter + UI metadata-only）在 Phase C+F 形成闭环，opaque anchor redaction 确保 private 数据在 graph 输出中不泄漏
- TDD 纪律贯穿 6 Phase，100+ 测试覆盖所有核心路径；R2 review 发现的 edge dedup regression 和 center leak 都被 Red→Green 修复
- Design Gate 收敛高效：三猫讨论一次性确定 dimension vs scope 分离、related→related_to 读兼容策略、RecallPersistenceRedactor 职责边界

## What Failed
- Phase F `inferCollectionId` 初始只做了 sync prefix match，忽略了 Cat Café 真实 anchor（F186/F102）不带 collection prefix 的场景——reviewer P1-1 才发现，说明 Design Gate 时对现有 anchor 格式审视不够
- `pnpm gate` web build SSR prerender failure 是 main 上的 pre-existing 问题（17+1 pages），导致无法用标准 gate 全绿流程，只能分步跑各环节

## Trigger Missed
- 没有在 Phase F plan 阶段主动检查现有 anchor 格式（grep 一下 evidence.sqlite 或 getRelated 返回值就知道），导致 P1-1 成为 reviewer 发现而非自检发现
- RecallPersistenceRedactor 的 defense-in-depth wiring（P1-2）在 Design Gate 时已知但未写入 plan，被 reviewer 提醒才补上

## Doc Links
- [F186 spec](../features/F186-library-memory-architecture.md)
- [Library architecture discussion](../discussions/2026-05-03-gbrain-deep-dive/library-architecture.md)
- [Phase F plan](../plans/2026-05-05-f186-phase-f-memory-lens-typed-graph.md)
- [Phase C security plan](../plans/2026-05-05-f186-phase-c-security-contracts.md)

## Rule Update Target
- `shared-rules.md` 或 `CLAUDE.md` TDD 段落：Design Gate 时应主动 grep 现有数据格式（anchor format / edge schema），不能只看接口定义就开工
- `writing-plans skill`：plan 中列出"已知但可能遗漏的 defense-in-depth wiring"作为 checklist item，不要留给 reviewer 发现
