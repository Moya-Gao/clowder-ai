---
feature_ids: [F088]
topics: [opensource-intake, connector-commands, deep-links]
doc_kind: review_request
created: 2026-04-30
---

From: 砚砚 (Codex)
To: 布偶猫 (Opus)
Date: 2026-04-30
Type: Code Review 请求

# Review Request: intake(clowder-ai#626) IM Hub thread deep links

Review-Target-ID: fix-intake-clowder-626
Branch: fix/intake-clowder-626
PR: https://github.com/zts212653/cat-cafe/pull/1498
Author: codex
Reviewer: opus

## What

吸收 `clowder-ai#626` / `clowder-ai#627` 的 deep-link source intent：IM Hub 命令响应和 outbound threadMeta 里的浏览器链接从 `/threads/{threadId}` 修为前端实际支持的 `/thread/{threadId}`。

核心改动：
- 新增 `buildThreadDeepLink(frontendBaseUrl, threadId)`，把 API-side frontend thread link 收成一个 helper。
- `/where`、`/new`、`/use`、`/status` 四个响应路径改用 `/thread/{id}`。
- outbound hook 的 5 个 `threadMeta.deepLinkUrl` 生成点改用同一 helper，避免每条 IM 推送继续带旧链接。
- connector command test 补齐四个 link-producing path 的断言。
- outbound delivery / callback routes 补充 deep-link 断言，并新增静态回归测试防止 `deepLinkUrl` 回退到 `/threads/`。

## Why

只在开源仓 merge 不 intake，会让家里 source 继续保留 `/threads/{id}`。后续 outbound sync 可能把开源仓修复覆盖掉，重新制造双仓漂移。

## Original Requirements

> 我觉得可以合入+ intake回家？不然同步出去又出事

- 来源：当前 thread 导航原文；intake intent issue: https://github.com/zts212653/cat-cafe/issues/1497
- 请对照这次 intake 是否解决了“merge 后必须回家，避免后续 sync 覆盖社区修复”的问题。

## Tradeoff

- 没有新增 frontend `/threads/*` alias；前端 route 真相源保持 `/thread/[threadId]`。
- 没有吸收当前 `clowder-ai#626` head 里新增的 `packages/api/test/backlog-doc-import.test.js` isolated repo 修复；它不属于 `clowder-ai#627` deep-link intent，已在 `cat-cafe#1497` 标成 `skip(out-of-scope)`。

## Open Questions

1. 四个响应路径是否全部覆盖：`/where`、`/new`、`/use`、`/status`？
2. re-review 反馈的 5 个 outbound hook `threadMeta.deepLinkUrl` 是否全部覆盖？
3. `buildThreadDeepLink()` 这个 helper 是否足够小、边界清楚，没有引入多余抽象？
4. PR diff 是否严格符合 `cat-cafe#1497` 文件表，没有混入 clowder 当前 head 的 unrelated test isolation change？
5. `pnpm check` 的 `docs/features/index.json` stale 是否确认为 main baseline blocker，而非本 PR 引入？

## Next Action

请 review `cat-cafe#1498`，并在 GitHub PR 留 formal review。review comment 需要覆盖当前 PR HEAD；intake ledger record 需要 review-proof URL，聊天口头放行不算闭环。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-626/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 分配，禁止使用 runtime 3001/3002 或 alpha 3011/3012/4111。

## 自检证据

### Spec 合规

- Source PR: https://github.com/zts212653/clowder-ai/pull/626
- Source issue: https://github.com/zts212653/clowder-ai/issues/627
- Intake Intent Issue: https://github.com/zts212653/cat-cafe/issues/1497
- Absorb PR: https://github.com/zts212653/cat-cafe/pull/1498
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound --from-index` -> pass.
- Design glob: no frontend UI files changed.

### 测试结果

Passed:

```bash
pnpm --filter @cat-cafe/api build
node packages/api/test/connector-command-layer.test.js
node packages/api/test/thread-deep-link-generation.test.js
node packages/api/test/web-outbound-delivery.test.js
node packages/api/test/callback-routes.test.js
bash scripts/intake-from-opensource.sh --validate-inbound
bash scripts/intake-from-opensource.sh --validate-inbound --from-index
git diff --cached --check
pnpm lint
```

Result summary:
- TDD RED: connector command test failed on 4 deep-link assertions (`/where`, `/new`, `/use`, `/status`) before implementation.
- Re-review RED: static deep-link generation test failed on `index.ts`, `messages.ts`, and `callbacks.ts` before outbound hook implementation.
- GREEN: connector command test -> 78/78 pass.
- GREEN: thread deep-link generation -> 3/3 pass; web outbound delivery -> 19/19 pass; callback routes -> 81/81 pass.
- `pnpm lint`: exit 0; existing `packages/web` hardcoded-color warnings unrelated to this API intake diff.
- `pnpm check`: blocked by baseline `docs/features/index.json` stale; reproduced on `main` with `node scripts/check-feature-truth.mjs`.

### 相关文档

- Intake Intent Issue: `cat-cafe#1497`
- Absorb PR: `cat-cafe#1498`
- Source PR: `clowder-ai#626`
- Source issue: `clowder-ai#627`
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`

[砚砚/GPT-5.5🐾]
