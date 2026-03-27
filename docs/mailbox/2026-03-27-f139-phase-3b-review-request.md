---
doc_kind: review-request
feature_ids: [F139]
created: 2026-03-27
---

# Review Request: F139 Phase 3B — Governance + Pack

Review-Target-ID: f139-phase-3b
Branch: feat/f139-phase-3b

## What

Three ACs for F139 Phase 3B:
- **AC-D1 (Governance)**: Two-layer scheduler control — global kill switch + per-task overrides. Pipeline checks, API endpoints, SchedulePanel toggle UI. Manual triggers bypass both layers.
- **AC-D2 (Anti-feedback-loop)**: EmissionStore tracks task outputs per thread with TTL-based suppression. Pipeline filters workItems with active emissions → SKIP_SELF_ECHO.
- **AC-D3 (Pack templates)**: PackTemplateStore with namespace isolation (`pack:{packId}:{name}`). Install validates builtinTemplateRef exists. Uninstall blocked when active instances exist.

12 commits, 193 tests (all green), ~1200 new lines across 13 files.

## Why

Scheduler needs governance before production activation. Without D1, no way to pause automation without killing the process. Without D2, scheduler reacts to its own messages (feedback loop). D3 enables packs to declare reusable task templates.

## Original Requirements（必填）

> "你的d1 这里涉及到了写cat config 那写到这里这全局的配置你其实也得展示的？不能让我去找文件然后修改吧？...我建议就在调度里面？不要写在传统的config hub里面"

- 来源：铲屎官 2026-03-27 对话（Design Gate 讨论）
- **请对照上面的摘录判断：全局控制在 SchedulePanel 里，不在 cat-config.json**

砚砚 Design Gate 钉子（2026-03-27）：
> "triggerNow 在 global paused 时仍然要能跑——停调度 ≠ 停诊断"
> "D2 Phase 3B 只做 self-echo，不做 cross-task causal graph"
> "Pack 模板声明式 only，NO custom JS execute"

## Tradeoff

- D2 只做 self-echo（同一 task 产出的 message 不被同一 task 重新消费），不做跨 task 因果图——复杂度不值得
- Pack 模板声明式 + builtinTemplateRef，不支持自定义 execute——安全边界
- 无级联卸载：有活跃实例时 409 阻止，不自动删除实例

## Open Questions

1. **EmissionStore.record 调用点**：当前 record() 只在 store 里暴露，但还没在实际的 execute 回调中调用（需要 connector/message-sender 在发消息时调用）。Phase 3B 完成基础设施，实际的 record 调用在 task 的 execute 里做。这个 gap 是否需要在本轮补齐？
2. **Pack 模板的 paramSchema 校验**：当前 install 时只做 namespace + builtinRef 校验，param 值的 runtime 校验留给了 builtin template 的 createSpec。够不够？
3. **SchedulePanel 前端**：global toggle 已实现，per-task override UI 尚未做——是否留到 Phase 4？

## Next Action

请 @gpt52 做架构 review。重点关注：
- D1 pipeline 层级（global → task override → enabled → overlap → gate → echo → execute）顺序是否正确
- D2 self-echo 的 subjectKey 匹配逻辑（thread- prefix strip）
- D3 namespace 隔离的安全性

## 自检证据

### Spec 合规

| AC | 实现 | 测试 |
|----|------|------|
| D1: global kill switch | GlobalControlStore + execute-pipeline governance checks + API + UI | 10 store tests + 5 pipeline tests + 8 route tests |
| D1: manual bypass | triggerNow({ manual: true }) bypasses both layers | 2 dedicated tests |
| D2: self-echo suppression | EmissionStore + pipeline thread-scoped filter | 7 store tests + 3 pipeline tests |
| D3: pack template install/uninstall | PackTemplateStore + namespace validation + API | 8 store tests + 7 route tests |
| File size budget | TaskRunnerV2: 254 lines, schedule.ts: 300 lines | Under 350 limit |

### 测试结果

```
node --test packages/api/test/scheduler/*.test.js
# 177 passed, 0 failed

node --test packages/api/test/pack-knowledge-scope.test.js packages/api/test/memory/schema-v2.test.js
# 16 passed, 0 failed

pnpm --filter @cat-cafe/api build   # 成功
pnpm --filter @cat-cafe/web build   # 成功
pnpm biome check . --diagnostic-level=error  # 0 errors
```

### 相关文档

- Plan: `docs/plans/2026-03-27-f139-phase-3b-governance-pack.md`
- Feature: `docs/features/F139-unified-schedule-abstraction.md`
