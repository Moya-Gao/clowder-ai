---
feature_ids: [F123]
doc_kind: note
created: 2026-03-16
topics: [bubble, replay, fixture, truth-model]
---

# F123 Symptom → Fixture Matrix

## Purpose

把进入 F123 的历史症状、现有 fixture、以及缺口统一落在一处，避免继续靠截图和口头描述传递。

## Matrix

| Symptom | Requirement | Current Fixture / Test | Status | Notes |
|---------|-------------|------------------------|--------|-------|
| active late-bind 双影 | R1, R3 | `packages/web/src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts` | covered | `invocation_created` 晚于首条 text/tool，验证 bubble identity 回填 |
| background ref-lost 停更 | R1, R3 | `packages/web/src/hooks/__tests__/useSocket-background.test.ts` | covered | active→background 后 ref 丢失导致 stream 中途停更 |
| callback / stream 同 invocation 双影 | R5, R6 | `packages/web/src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts` | covered | callback 替换 stream，而不是新增第二条 bubble |
| hydrate 时 callback 输给 richer local stream | R2, R5 | `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts` | covered | server callback 必须赢本地 richer stream |
| thread switch 裂成两个，F5 后归一 | R2, R7 | `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts` + `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts` | covered | cached duplicate invocation pair → switch 时强制 replace hydration |
| callback replacement 后 late stream ghost bubble | R2, R5 | `packages/web/src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts` + `packages/web/src/hooks/__tests__/useSocket-background.test.ts` | covered | unlabeled late chunk 必须持续被 suppression 挡住，直到观察到不同 invocationId |
| draft / hydration 身份断层 | R1, R5 | `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts` | covered | 真实 draft payload（含 `origin:'stream'`、`extra.stream.invocationId`、`thinking`、`toolEvents`）在 hydration 后会收成单一 formal message，不再停留在 duplicate-only 的旧世界 fixture |
| rich block 落错 bubble | R1, R5 | `packages/web/src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts` | covered | rich_block 无 `messageId` 时必须附着到 formal callback，而不是误绑到 streaming bubble |
| queue / hydration 乱序 | R2, R5 | `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts` + `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts` | covered | secondary queue hydrate 先于 `setCurrentThread()` 回来时，server 确认的 processing 状态必须写回目标 thread，而不是停在预填的 `pending` |
| F5 / thread switch 后单调可见性全链路 | R2, R7 | — | gap | 需要 Alpha 手测 + replay/golden 双证据 |

## Gap Summary

- 目前已经落地的是高频双影与 thread switch / hydration 主路径。
- 还没系统封口的是 Alpha 场景下的 F5 / thread switch 单调可见性。
- 这份矩阵是 F123 `AC-A3` 的真相源；新增现场症状时，先补这一页，再补 fixture。
