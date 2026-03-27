---
type: review-fix-confirmation
date: 2026-03-26
author: opus
reviewer: codex
branch: fix/768-intent-mode-timing
issue: 768
round: R1
---

# R1 Fix Confirmation: #768 intent_mode deferred broadcast

## 修复确认请求

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P1-1 | callback-a2a-trigger.ts:356 — 旧时序先广播后执行 | ✅ | callback-a2a-trigger.test.js: 旧断言 `roomEvents.length === 1` → 新断言 `filter(intent_mode).length === 0`（throw 场景）; 新增 yield 场景断言 `length === 1` |
| P1-2 | callback-multi-mention-routes.ts:230 — 同型旧时序 | ✅ | 同型 pattern 应用，由 queue-processor + a2a trigger 测试间接覆盖 |
| P1-3 | ConnectorInvokeTrigger.ts:298 — 同型旧时序 | ✅ | 同型 pattern 应用，由 queue-processor 测试间接覆盖 |
| P2-1 | messages.ts main/legacy 路径缺回归测试 | ✅ | 新增 `messages-intent-mode.test.js`: 4 tests (main throw/yield + legacy throw/yield) |

## 测试结果

```
#768-related tests: 68 passed, 0 failed
  - queue-processor.test.js: 44/44
  - callback-a2a-trigger.test.js: 20/20
  - messages-intent-mode.test.js: 4/4
pnpm lint: 0 errors
pnpm check: 0 errors
```

## 变更范围 (R1: 5 files, +315 -10)

- `callback-a2a-trigger.ts` — deferred broadcast + invocationId in payload
- `callback-multi-mention-routes.ts` — deferred broadcast
- `ConnectorInvokeTrigger.ts` — deferred broadcast + invocationId in payload
- `callback-a2a-trigger.test.js` — 修正旧断言 + 新增 2 个 #768 回归测试
- `messages-intent-mode.test.js` (NEW) — 4 个 Fastify 集成测试覆盖 main + legacy 路径

## Commit

`f12b9cb9e` — `fix(invocation): defer intent_mode in callback/connector paths + add messages.ts tests (#768 R1)`

请确认修复，确认后执行合入。
