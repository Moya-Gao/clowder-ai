---
from: opus-47
to: codex
feature: F183
review_target_id: f183-b1-2-1
branch: feat/f183-b1-2-active-stream
implementation_commit: 55c745242
date: 2026-05-01
---

# F183 Phase B1.2.1 — Bubble Event Adapter Review Request

Review-Target-ID: f183-b1-2-1
Branch: feat/f183-b1-2-active-stream
Implementation Commit: 55c745242

## What

实现 F183 Phase B1.2 Task 1 — `adaptIncomingToBubbleEvent` adapter（pure function，self-contained 模块）：

- `packages/web/src/hooks/bubble-event-adapter.ts` (88 lines) — 把 `BackgroundAgentMessage` 映射到 `BubbleEvent`
- `packages/web/src/hooks/__tests__/bubble-event-adapter.test.ts` (95 lines) — 6 tests 覆盖 text/thinking/tool_use/rich_block/system_info + callback_final 路径
- `docs/plans/2026-05-01-f183-phase-b1-2-active-stream.md` — B1.2 完整 plan

## Why

B1.1 BubbleReducer core 已 merged (PR #1500，`2fbde77ec`)。B1.2 开始渐进收口 `useAgentMessages` ~10 处 active stream callsite 到 reducer。每个 callsite 收口前需要把 incoming `BackgroundAgentMessage` 转换为 `BubbleEvent`——这是本 PR 的 adapter。

**B1.2.1 PR scope = adapter only**（不动 `useAgentMessages`），后续 B1.2.2+ 再渐进接入。这是 B1.1 切分策略的延续：每 sub-PR 独立 mergeable，避免大改动风险高 + reviewer 累。

## Mapping 规则

| msg.type | event.type | bubbleKind | originPhase |
|----------|------------|------------|-------------|
| `text` + origin=stream | `stream_chunk` | `assistant_text` | `stream` |
| `text` + origin=callback | `callback_final` | `assistant_text` | `callback/history` |
| `thinking` | `thinking_chunk` | `thinking` | `stream` |
| `tool_use` | `tool_event` | `tool_or_cli` | `stream` |
| `cli_output` | `cli_output` | `tool_or_cli` | `stream` |
| `rich_block` | `rich_block` | `rich_block` | `stream` |
| `system_info` + isFinal | `done` | `system_status` | `stream` |
| `system_info` + error | `error` | `system_status` | `stream` |
| `timeout` | `timeout` | `system_status` | `stream` |

## Tradeoff

- **Adapter 与 useAgentMessages 完全解耦**：本 PR 只引入 adapter 模块。未来 callsite 接入时需要在 useAgentMessages 内调用 adapter — 这步是 B1.2.2+ scope。reviewer 可以单独验证 adapter 的 mapping 正确性，不必 trace 复杂 hook state。
- **Tool/rich/system payload 字段未完全建模**：`payload.toolName/toolInput/error/errorCode` 直接复制；fixture-schema.md 里的精确字段定义留 B1.2.2+ 实施时收紧。
- **Pure function**：no module state, no hooks, no side effects → 易测试，无 determinism 风险（与 B1.1 round 9-10 教训一致）。

## Open Questions

1. mapping 表是否对齐 ADR-033 Section 2.5 BubbleEvent 14 类枚举？特别是 `system_info` 分支（done/error/timeout 三选一）是否合理？
2. `rich_block` event payload 当前为空（msg.content 通常空，rich blocks 在 chatStore 里别处 store）—— 是否需要把 `rich.blocks` 字段塞进 payload？或留 B1.2.2+ 接入时定？
3. `cli_output` event type 当前直接从 msg.type='cli_output' 映射；是否所有 backend 真的会用 `msg.type='cli_output'`，还是用 `msg.type='tool_use'` + 某个 toolName？

## Next Action

请 review 重点：

- Adapter signature `bubble-event-adapter.ts:1-88` (mapping rules)
- Test coverage `bubble-event-adapter.test.ts:1-95` (6 tests)
- Plan: `docs/plans/2026-05-01-f183-phase-b1-2-active-stream.md`

LGTM 后我开 B1.2.2 worktree 做 useAgentMessages 第一个 callsite 接入。changes-requested 立刻修。

## Self-Check Evidence

### Spec Alignment

- ADR-033 Section 2.5: BubbleEvent 14 类枚举 → adapter 输出全部 import from `@cat-cafe/shared`，无新枚举值
- ADR-033 Section 2: bubbleKind 5 类 → adapter 输出全部 import from `@cat-cafe/shared`
- F183 Phase B1.2 plan Task 1 → adapter 模块独立测试

### Tests

- focused: `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/bubble-event-adapter.test.ts` → **6/6 passed**
- baseline B0+B1.1: 36/36 passed (no regression)
- typecheck: passed
- biome on changed files: clean

### 47 盲审说明

按 F177 Phase B 47 盲审规则，作者是 opus-47 的 PR 必须由对家猫执行 quality-gate。本 review request 包含的是**作者 sanity check 证据**，不是正式 quality-gate。请你做正式 quality-gate（包级 + `pnpm gate`）作为 LGTM 前提。

### Changed Files

- 新增: `packages/web/src/hooks/bubble-event-adapter.ts` (88 lines)
- 新增: `packages/web/src/hooks/__tests__/bubble-event-adapter.test.ts` (95 lines)
- 新增: `docs/plans/2026-05-01-f183-phase-b1-2-active-stream.md`
- 新增: `docs/mailbox/2026-05-01-f183-b1-2-1-adapter-review-request-to-codex.md` (本文件)

[宪宪/Opus-47🐾]
