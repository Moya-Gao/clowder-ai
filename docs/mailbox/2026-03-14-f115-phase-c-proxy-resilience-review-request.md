---
feature_ids: [F115]
topics: [review-request, proxy, resilience]
doc_kind: mailbox
created: 2026-03-14
---

# Review Request: F115 Phase C — Proxy 弹性

## What

两处改动让 proxy 不再是猫猫调用链的单点故障：

1. **AC-C4 fetch timeout** (`scripts/anthropic-proxy.mjs`)
   - upstream fetch 增加 `AbortSignal.timeout(60s)`，超时返回 504 `proxy_timeout`
   - 超时可配置：`ANTHROPIC_PROXY_UPSTREAM_TIMEOUT_MS`

2. **AC-C3 proxy fallback** (`invoke-single-cat.ts` + `tcp-probe.ts`)
   - 新增 `tcpProbe` 工具：TCP 端口探活，1s 超时
   - invoke-single-cat 在设置 proxy baseUrl 前先探活，不可达则 fallback 直连 upstream

## Why

社区用户通过 api_key profile 配了反代，但 proxy 进程没起来时，
CLI 直接报 ECONNREFUSED 卡死（clowder-ai#46）；upstream 不响应时
proxy 无限等待，3 分钟后返回 502（clowder-ai#52）。

## Original Requirements（必填）
> "Anthropic api_key profile依赖本地proxy，proxy不可达时@opus会报ECONNREFUSED且无直连回退"
> "Anthropic proxy 对上游网络级 fetch 失败无超时/重试，导致 @opus 第二轮卡 3 分钟后返回 502"
- 来源：clowder-ai#46、clowder-ai#52（社区 issue）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **没做客户端侧 retry**：CLI 自己有 retry 逻辑，API 层不再加
- **没做 proxy 自动重启**：进程管理是 start-dev.sh 的事，这里只做优雅降级
- **tcpProbe 默认 1s 超时**：localhost 探活 1s 已充裕，不加更长

## Open Questions

1. `tcpProbe` 的 1s 超时是否太长？每次调用都会多 ≤1s 延迟（proxy 不可达时）。正常情况下 localhost TCP connect 毫秒级
2. fallback 时 `console.warn` 够用吗？需要走结构化 audit event 吗？

## Next Action

请 review 以下文件，重点关注 fallback 逻辑的正确性和边界情况：
- `scripts/anthropic-proxy.mjs` — fetch timeout 改动
- `packages/api/src/utils/tcp-probe.ts` — TCP 探活工具
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:462-485` — fallback 逻辑

## 自检证据

### Spec 合规
| AC | 状态 | 验证 |
|-----|------|------|
| C1 (529/503 retry) | ✅ 已有 | L321-344 |
| C2 (thinking 保护) | ✅ 已有 | L64-140 |
| C3 (proxy fallback) | ✅ 新增 | proxy-fallback.test.js |
| C4 (fetch timeout) | ✅ 新增 | anthropic-proxy-timeout.test.js |

### 测试结果
```
F115 tests → 5/5 pass ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors in changed files ✅
tsc --noEmit → 0 errors ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-14-f115-phase-c-proxy-resilience.md`
- Feature: `docs/features/F115-runtime-startup-optimization.md`
- ADR: `docs/decisions/016-sync-runtime-negation-decisions.md`

### Commits (5)
```
262933dc style: biome format fixes for F115 Phase C files
f6a24d2b docs(F115): mark Phase C complete + add implementation plan
71692310 feat(F115): AC-C3 — proxy 不可达时 fallback 直连 upstream
f5b9fc9c feat(F115): add tcpProbe utility for proxy health check
db99ddf8 feat(F115): AC-C4 — upstream fetch 60s 超时，避免无限等待
```
