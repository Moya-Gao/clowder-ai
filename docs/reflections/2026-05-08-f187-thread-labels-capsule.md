---
capsule_id: "F187-2026-05-08"
context: "F187 Thread Labels 全三 Phase 完成：Label 基座 + Sidebar 筛选 + 猫猫辅助分类"
feature_ids: [F187]
doc_kind: capsule
created: 2026-05-08
---

## What Worked
- 三 Phase 从立项到 close 用 2 天完成，节奏快且质量稳
- TDD 先行：organize-flow 回归测试提前拦住了 fake timer 聚合干扰问题
- filterSuggestions 白名单设计有效隔离了 LLM 输出的无效 threadId/labelId
- 云端 review 发现了本地 review 漏掉的 trashed thread ghost label 问题（listDeleted 盲区）
- 功能 thread 架构复用现有消息路由，零新基础设施

## What Failed
- Phase C 第一轮愿景守护被 gpt52 退回两个 P1（✨ 按钮没连 modal、skill 入口拿不到标签），说明 quality-gate 自检时没充分测试端到端路径
- fake timer 在聚合测试环境下 beforeAll/afterAll 模式不稳定，浪费了调试时间；应该一开始就用 beforeEach/afterEach
- pnpm gate 的 workspace-file-watcher 测试套件 hang 12+ 分钟（pre-existing），影响了 gate 效率

## Trigger Missed
- 应该在 quality-gate 阶段就发现 ✨→modal 链路断裂——如果当时写了端到端集成测试而不是只测 filterSuggestions 工具函数，P1 不会到 vision guard 才暴露
- 应该更早意识到 label DELETE handler 需要扫 trashed threads——soft-delete 是 F095 引入的，label 清理应该在 Phase A 就考虑到

## Doc Links
- [F187 spec](../features/F187-thread-labels.md)
- [Phase A plan](../plans/2026-05-06-f187-phase-a.md)
- [Phase B plan](../plans/2026-05-06-f187-phase-b.md)
- [Phase C plan](../plans/2026-05-07-f187-phase-c.md)
- [Design Gate 反馈](../discussions/2026-05-06-f187-design/)

## Rule Update Target
- 无新规则需要回写。现有 TDD / quality-gate / vision-guard 流程已覆盖本次教训
