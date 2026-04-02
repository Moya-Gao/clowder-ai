---
type: review-request
date: 2026-04-01
author: opus
reviewer: codex
feature: F102
branch: feat/f102-batch2-phase-g
review-target-id: f102-batch2
---

# Review Request: F102 Batch 2 — Phase G 运行时验收闭环

## What

Phase G (Abstractive Summary + Durable Memory Lifecycle) 基础设施已在 PR #604 合入。本批次补全运行时验证测试 + 注册遗漏的 feature flags：

- `env-registry.ts`: 注册 `F102_DURABLE_CANDIDATES` + `F102_TOPIC_SEGMENTS`
- `summary-compaction-e2e.test.js`: 6 个集成测试（e2e 全流程、carry-over backlog、3 个 fail-open 路径、gate→execute 全链路）
- `abstractive-client-parser.test.js`: 5 个解析器边界测试（title+candidates、fallback title、cap、noise filter、empty input）
- `AbstractiveSummaryClient.ts`: export `parseNaturalLanguageOutput` for testing

## Why

Batch 2 验收原则："真实 thread / candidate / approve 全链路跑通"。Phase G 基础设施代码已完整（schema V4、TaskSpec、eligibility rules、Opus client），但缺乏集成测试覆盖，无法确信运行时行为正确。本批次补全测试后，Phase G 的代码信任度从"看过代码"提升到"跑过验证"。

## Original Requirements（必填）

> "IMaterializationService 还不是终态" — 铲屎官
> "先补真相源闭环，再验运行时，再打磨人类入口" — 砚砚 (GPT-5.4)
> Batch 2: "thread 摘要 / dirty thread 调度 / candidate extraction → 真实运行质量确认"

- 来源：F102 三方收敛讨论 (2026-04-01)，记录在 `docs/features/F102-memory-adapter-refactor.md` 收尾三批次章节
- **请对照上面的摘录判断：测试是否覆盖了全链路关键路径？**

## Tradeoff

- 不引入真实 Opus API 调用测试（需要 API key + 网络），用 mock 验证管道正确性
- `parseNaturalLanguageOutput` 新增 export（@internal 标记），为了可测性牺牲封装性

## Open Questions

1. carry-over 测试中 `getMessagesAfterWatermark` 的 mock 分支逻辑是否充分模拟了真实场景？
2. `F102_DURABLE_CANDIDATES` / `F102_TOPIC_SEGMENTS` 是否需要在 `index.ts` 中添加实际条件判断（当前只注册了 flag）？

## Next Action

请审查代码质量 + 测试覆盖充分性，P1/P2 标准。

## 自检证据

### Spec 合规

| AC | 状态 |
|----|------|
| AC-B2-1: e2e processThread | ✅ 6 tests |
| AC-B2-2: env flags 注册 | ✅ 2 flags |
| AC-B2-3: carry-over backlog | ✅ 1 test |
| AC-B2-4: failure paths | ✅ 3 tests |
| AC-B2-5: parser edge cases | ✅ 5 tests |

### 测试结果

```
pnpm test (memory suite) → 221/221 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-01-f102-batch2-phase-g-runtime-verification.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md`

Review-Target-ID: f102-batch2
Branch: feat/f102-batch2-phase-g
