---
capsule_id: "F108-2026-03-28"
context: "F108 Side-Dispatch: 同一 Thread 多猫并发执行（Phase A runtime + Phase B UX + cancel hotfix）"
feature_ids: [F108]
doc_kind: capsule
created: 2026-03-28
---

## What Worked
- Phase A/B 分层清晰：先做 runtime 多槽基座，再做 UX 层，解耦干净
- GPT-5.4 两轮 review 质量极高：第一轮确认 root cause 并定级 P1，第二轮精准命中 error(isFinal) 漏修的 clearCatStatuses()
- 红绿测试策略有效：4 条 regression test 覆盖 done/error × 单猫/末猫，精确复现并防回归
- v2 WhisperCatSelector（mention 风格浮动弹窗）在铲屎官 UX 反馈后快速迭代，从 v1 到 v2 一天内完成
- cancel bug 从铲屎官报告到 hotfix merge 仅 2 小时闭环

## What Failed
- error(isFinal) handler 初次修复时遗漏 clearCatStatuses()：done 和 error 两个 terminal path 的清理逻辑应该对称，但写代码时只关注了 done 路径
- 测试最初只写了 3 条（缺少 last-cat-error 场景），导致遗漏未被测试捕获——review 才发现
- CSS class 匹配用 `.toContain()` 导致 substring 误匹配（`bg-cafe-surface-elevated` vs `hover:bg-cafe-surface-elevated`），应一开始就用 `.split(/\s+/)` 精确匹配

## Trigger Missed
- 写 error(isFinal) 修复时应该主动和 done(isFinal) 做对称性检查（"两个 terminal path 清理一样吗？"），这是一个可标准化的 checklist item
- vi.mock 替换整个模块时遗漏 formatCatName 导出——mock 策略应在写测试前先审查被 mock 模块的 export list

## Doc Links
- Feature spec: `docs/features/F108-side-dispatch-concurrent-invocation.md`
- Phase A plan: `docs/plans/2026-03-12-f108-phase-a-slot-aware-runtime.md`
- Phase B plan: `docs/plans/2026-03-15-f122b-f108b-unified-dispatch.md`
- PR #438 (Phase A), #834 (Phase B), #842/#846 (Scene 2 v1/v2), #848 (cancel hotfix)

## Rule Update Target
- `shared-rules.md` 或 TDD skill: 补充"terminal path 对称性检查"——当修复一个 terminal path (done/error/timeout) 时，必须检查其他 terminal paths 是否需要同样的修改
- Test writing practice: vi.mock 替换模块时，先 `grep "export"` 被 mock 文件确认所有 named exports 都在 mock 中
