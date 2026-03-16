---
feature_ids: [F115]
topics: [review-request, proxy, resilience, community]
doc_kind: mailbox
created: 2026-03-16
---

# Review Request: F115 Phase E — Proxy Upstream Hardening

## What

在不回退 F115 Phase C 既有设计的前提下，我把社区 `clowder-ai#52` / PR `#107` 暴露的两个缺口补上了：

1. `scripts/anthropic-proxy.mjs`
   - request body 被 `stripThinkingFromRequest()` 改写后，不再转发错误的 `content-length` / `transfer-encoding`
   - 网络级 upstream 错误进入现有 retry loop（`ECONNRESET` / `ECONNREFUSED` / `UND_ERR_*` 等）
   - 错误响应增加 `causeCode` / `retryable`
2. `packages/api/test/anthropic-proxy-timeout.test.js`
   - 新增 3 个回归场景：transient network retry、terminal causeCode、content-length mismatch
   - 保留原有 hung-upstream / slow-streaming 保护

## Why

社区 PR `clowder-ai#107` 方向对，但实现会把整个 `fetch()` 生命周期都绑到 `AbortSignal.timeout(...)` 上，直接回退我们 Phase C 的 connect-only timeout / slow-SSE 保证，所以这轮按 manual-port 做。

## Original Requirements

> `clowder-ai#52`: “proxy 到上游的 fetch() 发生了网络级失败/长时间悬挂。”  
> `clowder-ai#52`: “用户最终只看到笼统的 fetch failed。”  
> 铲屎官（2026-03-16）：“这个来作为一个幺幺五的增量 phase……你负责这个 issue。”

- 来源：`docs/features/F115-runtime-startup-optimization.md`
- 社区上下文：<https://github.com/zts212653/clowder-ai/issues/52>

## Tradeoff

- **保留 connect-only timeout**：不接受把 timeout 绑满整个 `fetch()` 生命周期，否则长流式 SSE 会被中途截断
- **只在 proxy 层补 retry**：不扩 scope 到 `invoke-single-cat.ts`
- **timeout 只做结构化诊断，不自动重试**：避免重新把一次调用拖回多轮长等待

## Open Questions

1. `causeCode` / `retryable` 现在只进 proxy error envelope，是否还要进一步让上层 orchestrator基于它做自愈？
2. 是否需要把 `content-length mismatch` 这个教训沉淀到 F115 / lessons-learned？

## Next Action

请重点 review：
- `scripts/anthropic-proxy.mjs`
- `packages/api/test/anthropic-proxy-timeout.test.js`
- `docs/features/F115-runtime-startup-optimization.md`

## 自检证据

### 愿景覆盖
| 需求 | 覆盖 | 结果 |
|------|------|------|
| 上游网络失败时不要只剩 `fetch failed` | `causeCode` / `retryable` | ✅ |
| request sanitization 不能把 proxy 自己搞炸 | header forwarding fix | ✅ |
| 不能回退 slow-SSE 保护 | 继续保留 connect-only timeout + 原测试回归 | ✅ |

### 验证命令
```bash
node --test packages/api/test/anthropic-proxy-timeout.test.js packages/api/test/proxy-fallback.test.js
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/api lint
pnpm exec biome check --diagnostic-level=error scripts/anthropic-proxy.mjs packages/api/test/anthropic-proxy-timeout.test.js docs/features/F115-runtime-startup-optimization.md docs/plans/2026-03-16-f115-phase-e-proxy-upstream-hardening.md docs/bug-report/2026-03-16-f115-phase-e-proxy-upstream-hardening/bug-report.md
```

### 结果摘要
- proxy tests + fallback regression: 7/7 pass
- `pnpm --filter @cat-cafe/api build`: ✅
- `pnpm --filter @cat-cafe/api lint`: ✅
- targeted `biome check --diagnostic-level=error` on changed files: ✅
- full `pnpm lint`: ⚠️ blocked by pre-existing unrelated `packages/web/src/components/game/__tests__/GameLobby-detective-bind.test.tsx:20` (`no-explicit-any`)
- full `pnpm check`: ⚠️ blocked by pre-existing repo-wide format/import debt in unrelated files (`docs/features/F124-voice-comfort-audio-manifest.json`, `packages/api/src/...`, `packages/web/...`)

### 社区留痕
- Issue claim comment: <https://github.com/zts212653/clowder-ai/issues/52#issuecomment-4065835946>
- PR note: <https://github.com/zts212653/clowder-ai/pull/107#issuecomment-4065835958>
