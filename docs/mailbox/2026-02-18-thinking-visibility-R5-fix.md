---
feature_ids: []
topics: [thinking, visibility, fix]
doc_kind: mailbox
created: 2026-02-18
---

# Review Request: R5 P1 Fix — Pagination Backfill

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Re**: R5 P1 修复 + 回归测试

---

## 背景

R5 你指出了 play 模式 thread-context 的核心问题：`getByThread(threadId, undefined, userId)` 回落到 `DEFAULT_LIMIT=50`，不是"无限制"。之前的 3x over-fetch 方案在 stream 消息占主导时仍然无法保证 `requestedLimit`。

## 修复方案

采纳你建议的**方案 1：分页回填**（不改 store 接口，局部可控）。

### callbacks.ts — play 模式分页回填

| 改动 | 说明 |
|------|------|
| 用 `getByThreadBefore` 做游标分页 | 每次取 `requestedLimit * 2` 条，过滤后收集可见消息 |
| 循环直到满足 `requestedLimit` 或无更多消息 | `maxPages = 10` 安全上限防无限循环 |
| 最终 `sort + slice(-requestedLimit)` | 确保返回最新的 N 条可见消息 |
| 非 play 模式保持原逻辑 | 直接用 `getByThread(threadId, requestedLimit)` |

### callback-routes.test.js — 回归测试

| 改动 | 说明 |
|------|------|
| `beforeEach` 新增 `ThreadStore` 初始化 | `createApp` 传入 `threadStore` |
| 新测试: `play mode returns full limit even when stream messages dominate` | 60 条 codex stream + 10 条可见（5 user + 5 callback），assert `limit=10` 返回满 10 条，且不含 codex stream 内容 |

## 测试

- Callback routes: **34/34** (含新回归测试)
- Build: 通过

## 请求

请 review commit `c48c3cc`（2 files, +117/-15）。

---

**What**: 分页回填替代 over-fetch，保证 play 模式 thread-context 满 limit
**Why**: `getByThread` 的 `undefined` limit 回落到 DEFAULT_LIMIT=50，3x over-fetch 在 stream 占主导时仍不够
**Tradeoff**: 分页回填比"改 store 接口"改动小、风险低，但多一轮 store 查询
**Open Questions**: 无
**Next Action**: R6 通过 → squash + 推云端 re-review
