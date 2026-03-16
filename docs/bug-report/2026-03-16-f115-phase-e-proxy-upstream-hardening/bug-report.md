---
feature_ids: [F115]
related_features: [F059]
topics: [runtime, proxy, upstream, resilience]
doc_kind: bug-report
created: 2026-03-16
status: fixed-awaiting-review
---

# Bug Report: F115 Phase E — Proxy Upstream Hardening

## Bug 诊断胶囊

| 栏位 | 内容 |
|------|------|
| **1. 现象** | `anthropic-proxy` 在两类场景下表现不完整：一是 upstream 出现瞬时网络错误时直接 502，用户只看到 `fetch failed`；二是 request body 被 `stripThinkingFromRequest()` 缩短后仍透传原始 `content-length`，直接触发 `Request body length does not match content-length header`。 |
| **2. 证据** | 社区 issue `clowder-ai#52` + PR `clowder-ai#107` 给出了复现方向。家里 2026-03-16 手工复现确认：当前 `scripts/anthropic-proxy.mjs` 在 thinking-strip 后返回 `502 {"type":"error","error":{"type":"proxy_error","message":"fetch failed"}}`，stderr 明确是 `Request body length does not match content-length header`。 |
| **3. 问题假设或根因** | 根因有两处：`forwardHeaders` 没有滤掉 `content-length` / `transfer-encoding`；retry 循环只处理 429/529，没有把网络级异常分类、标记 retryable，也没有把 `cause.code` 暴露给上层。 |
| **4. 诊断策略** | 先补失败测试把 3 个缺口钉住：瞬时 socket reset 应自动恢复、终态网络错误应返回 `causeCode`、body 改写后 forwarding 仍应成功。然后在现有 connect-only timeout 架构上做最小改动。 |
| **5. 超时策略** | 如果实现过程中需要改动 `connectController + clearTimeout` 的 timeout 模式，立即停下重审；这轮修复的边界是不回退 Phase C 的 slow-SSE 保护。 |
| **6. 预警策略** | 如果修复要求改动 `invoke-single-cat.ts` 或把 `AbortSignal.timeout(...)` 重新包回整个 `fetch()`，说明方向跑偏；本轮 scope 应收敛在 `scripts/anthropic-proxy.mjs` 和代理测试。 |
| **7. 用户可见交互修正** | 用户在上游抖动时要么被 proxy 内部快速重试并恢复，要么在失败时看到明确的 failure class（如 timeout / connection refused）；request body 改写不再因为 header 错配直接炸成 502。 |
| **8. 验收** | 失败测试：`packages/api/test/anthropic-proxy-timeout.test.js` 新增 3 个 case。回归：原有 hung-upstream / slow-streaming / proxy-fallback 全绿。必要时补 `pnpm lint` / targeted typecheck。 |

## 背景

- Feature: `docs/features/F115-runtime-startup-optimization.md`
- Phase E plan: `docs/plans/2026-03-16-f115-phase-e-proxy-upstream-hardening.md`
- Community issue: <https://github.com/zts212653/clowder-ai/issues/52>
- Community PR: <https://github.com/zts212653/clowder-ai/pull/107>
