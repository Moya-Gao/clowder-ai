---
feature_ids: [F021]
topics: [cloud]
doc_kind: bug-report
created: 2026-02-18
---

# Bug Report: F21 Cloud Review P1/P2 Follow-up

> Date: 2026-02-18  
> Reporter: online 大猫 (`chatgpt-codex-connector[bot]`) on PR #30  
> PR: <https://github.com/zts212653/cat-cafe/pull/30>

## 1. 报告人 / 发现来源

- P1 来源：PR review comment `discussion_r2823888998`  
  链接：<https://github.com/zts212653/cat-cafe/pull/30#discussion_r2823888998>
- P2 来源：PR review comment `discussion_r2823889004`  
  链接：<https://github.com/zts212653/cat-cafe/pull/30#discussion_r2823889004>

## 2. 复现步骤（期望 vs 实际）

### P1: RSS item `link` 为空白时未回退 `guid`

1. 构造 RSS item: `link: "   "`, `guid: "https://example.com/guid"`, `title: "x"`。
2. 调用 `RssFetcher.fetch()` 处理该 item。

期望：
- 该 item 应被接纳，`url` 使用 `guid`，结果 articles 数量为 1。

实际：
- 该 item 被丢弃，articles 数量为 0。

### P2: `SIGNALS_ROOT_DIR` 为空字符串时路径解析漂移到 CWD

1. 设置 `SIGNALS_ROOT_DIR=''`。
2. 调用 `resolveSignalPaths()`。

期望：
- 空字符串应视为未配置，回落到 `~/.cat-cafe/signals`。

实际：
- `resolve('')` 导致 `rootDir` 被解析为当前工作目录（CWD）。

## 3. 根因分析

### P1 根因

- `toRawArticle()` 使用 `??`：`item.link?.trim() ?? item.guid?.trim()`。
- 当 `link` 为仅空白时，`trim()` 结果为 `''`（不是 `null/undefined`），不会触发 `guid` 回退。

### P2 根因

- `resolveSignalPaths()` 直接使用：
  `resolve(rootOverride ?? process.env['SIGNALS_ROOT_DIR'] ?? DEFAULT_SIGNAL_ROOT_DIR)`。
- 当 env 为 `''` 时，`??` 不会回落默认值，`resolve('')` 指向 CWD。

## 4. 修复方案

### P1 修复

- 改为“非空字符串优先”语义：
  `item.link?.trim() || item.guid?.trim()`。
- 新增回归测试：`link` 为空白时必须 fallback 到 `guid`。

### P2 修复

- 增加“可选路径输入归一化”逻辑，将 `''` 与空白字符串视为未配置。
- `resolveSignalPaths()` 仅在值非空时使用 override/env，否则回落 `DEFAULT_SIGNAL_ROOT_DIR`。
- 新增回归测试：`SIGNALS_ROOT_DIR=''` 时 `rootDir` 不得等于 CWD，且应等于默认目录。

## 5. 验证方式

- Red:
  - `packages/api/test/rss-fetcher.test.js` 新增 fallback 用例先失败。
  - `packages/api/test/signal-sources-loader.test.js` 新增空 env 回退用例先失败。
- Green:
  - 修复后新增用例转绿。
  - 回归执行 signal 相关 4 组测试 + build，确认无回归。
