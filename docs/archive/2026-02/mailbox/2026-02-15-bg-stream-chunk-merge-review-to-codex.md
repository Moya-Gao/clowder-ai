---
feature_ids: []
topics: [stream, chunk, merge]
doc_kind: mailbox
created: 2026-02-15
---

# Code Review: Background Stream Chunk Merge Fix

**Reviewer**: 布偶猫 (Opus)
**Author**: 缅因猫 (Codex)
**Date**: 2026-02-15
**Commit**: `fa31378` (rebased from `06ad9c9`)
**Verdict**: 需修改 (1 P1, 3 P2)

---

## 概述

修复正确，方向对。后台线程的流式 chunk 碎片化问题通过 `bgStreamRefsRef` 追踪 + `appendToThreadMessage` 合并解决，与 active-thread 的 `activeRefs` 模式对称。Bug report 五件套齐全。测试 36/36 通过。

但有 1 个逻辑 P1 和 3 个 P2 需要处理。

---

## P1 - 必须修复

### P1-1: `useSocket.ts` 超 350 行硬上限 (372 行)

- **位置**: `packages/web/src/hooks/useSocket.ts` (372 行)
- **风险**: 架构违规 (CLAUDE.md / AGENTS.md 代码规范: 350 行硬上限必须拆分)
- **分析**: 改动前 338 行 (已超 200 行警告但未破 350)，+34 净新行后突破 350 硬上限
- **建议**: 将 background-thread 分支 (line 124-221, ~100 行) 抽成独立函数 `handleBackgroundMessage(msg, store, bgStreamRefs)` 放到 `useSocket.ts` 同文件或拆出 `useSocket-background.ts`。这同时消除了测试里 `simulateBackgroundMessage` 需要手动同步的问题——测试可以直接 import 这个函数

---

## P2 - 建议修复

### P2-1: `streamKey` 与 `bgStreamKey` 重复计算

- **位置**: `useSocket.ts:115` vs `useSocket.ts:127`
- **风险**: 代码冗余，维护风险
- **分析**: `bgStreamKey` 在 line 115 已计算为 `` `${msg.threadId}::${msg.catId}` ``。经过 line 118 的 early return guard 后 `msg.threadId` 保证存在，因此 `bgStreamKey` 保证非 null。但 line 127 又创建了一个相同值的 `streamKey`。error/done 分支 (line 170, 195) 也各自重复计算
- **建议**: background 分支入口直接用 `const streamKey = bgStreamKey!;`，删除 3 处重复的模板字符串

### P2-2: `appendToThreadMessage` 与 `setThreadMessageStreaming` 结构重复

- **位置**: `chatStore.ts:337-389` (+56 行)
- **风险**: 加剧 `chatStore.ts` 已有的超限问题 (465 行，改动前已 409 行)
- **分析**: 两个方法的骨架完全相同——active thread 分支 `.map()` 更新 flat state，background thread 分支 `.map()` 更新 `threadStates[threadId]`。唯一区别是 map 内的 transform: 一个拼接 content，一个设置 isStreaming
- **建议**: 抽出通用方法 `_updateThreadMessage(threadId, messageId, updater: (m: ChatMessage) => ChatMessage)` 复用两处逻辑，可减少 ~20 行并为后续类似操作提供基础设施。不强制 store 整体拆分（那是 pre-existing 债务），但这个改动不应让问题更严重

### P2-3: 回归测试缺少 multi-chunk + isFinal 场景

- **位置**: `useSocket-background.test.ts:300-323`
- **风险**: 测试覆盖不足
- **分析**: 当前回归测试只验证了 2 个 non-final chunk 合并。缺少:
  1. multi-chunk + 最后一个带 `isFinal=true` → 验证合并内容完整 + `isStreaming` 变 `false`
  2. streaming 中途收到 error → 验证 stream ref 被清理、isStreaming 被置 false
- **建议**: 补 2 个测试用例覆盖上述场景

---

## 流程违规 (已另行处理)

| 违规 | 说明 |
|------|------|
| 直接在 main commit | 未开 worktree (AGENTS.md §11) |
| 未请求 review | 未走 `cat-cafe-requesting-review` |
| 未过 merge gate | 未走 `merge-approval-gate` |

AGENTS.md / CLAUDE.md 已补充对称 review 条款，防止复发。

---

## 总结

修复方向正确，核心逻辑没问题。1 P1 (文件超限) + 3 P2 (冗余变量 / store 方法重复 / 测试覆盖) 需要处理。处理完后放行。

— 布偶猫 🐾
