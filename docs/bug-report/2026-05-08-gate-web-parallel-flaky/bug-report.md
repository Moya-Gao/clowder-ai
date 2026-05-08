---
feature_ids: []
topics: [gate, test, flaky, web, vitest, parallel]
doc_kind: bug-report
created: 2026-05-08
---

# Bug Report: pnpm gate 全量 Web 测试并行 Flaky

> 日期：2026-05-08
> 报告人：布偶猫 + 缅因猫 (GPT-5.5)
> 发现场景：fix/antigravity-generating-terminal-v2 分支 merge-gate

## 1. 现象

`pnpm gate` 全量测试阶段，`packages/web` 的 vitest 并行跑 384 个测试文件时，每轮都有不同的 UI 组件测试失败（5s timeout 或 DOM 挂载竞争），但隔离跑同一批失败文件全绿。

15+ 轮 gate 运行，**每轮失败的文件都不同**，从未出现固定失败点。

## 2. 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| 全量 web 测试 | 384 文件全绿 | 每轮 4-11 个文件 5s timeout / assertion 失败 |
| 隔离复跑 | 同样失败 | 全绿（各 ~1.5s，远低于 5s limit） |
| 失败文件 | 固定 | 每轮随机不同 |

## 3. 高频失败文件（不完全列表）

| 文件 | 失败模式 |
|---|---|
| `chat-message-author-precedence.test.ts` | 5s timeout |
| `chat-message-layout-change.test.ts` | 5s timeout |
| `chat-message-lightbox.test.ts` | 5s timeout |
| `workspace-panel-copy-button.test.ts` | 5s timeout |
| `workspace-panel-md-add-to-chat.test.ts` | DOM null (挂载竞争) |
| `workspace-panel-reveal-in-tree.test.ts` | 5s timeout + assertion |
| `workspace-panel-search-feedback.test.ts` | 5s timeout + TypeError |
| `capabilities-route.test.js` (API) | probe 状态竞争 |
| `api-instance-lease.test.js` (API) | retry callback timing |

## 4. 根因分析

全量 384 文件并行时资源竞争导致 jsdom environment 初始化变慢，单测耗时从隔离时 ~1.5s 膨胀到 >5s 触发 timeout。这不是功能回归，是测试基建的并发容量问题。

加剧因素：
- 孤儿 test worker 进程（6h+ 残留）占用 CPU/内存
- monorepo 全量 build 后内存压力
- vitest 默认并发度可能过高

## 5. 影响

阻塞了正确的 PR 合入（fix/antigravity-generating-terminal-v2 因此被阻塞 15+ 轮）。

## 6. 建议修复方向

- 降低 web 测试并发度（vitest `--pool-options.threads.maxThreads`）
- 或将 web test timeout 从 5s 提高到 10s
- 定期清理孤儿 test worker（`node --test` 残留进程）
- 考虑将 `packages/web` 测试拆为 2 批串行
