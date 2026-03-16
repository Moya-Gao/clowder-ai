# F115 Phase E: Proxy Upstream Hardening Implementation Plan

**Feature:** F115 — `docs/features/F115-runtime-startup-optimization.md`
**Goal:** 在不回退 Phase C connect-only timeout 设计的前提下，补齐 proxy 对上游网络失败的重试/诊断，并修复请求体清洗后的 `content-length` 错配。
**Community source:** `clowder-ai#52`, `clowder-ai#107`
**Acceptance Criteria:**
- [ ] AC-E1: request body 经 `stripThinkingFromRequest()` 改写后，forwarding 不再透传错误的 `content-length` / `transfer-encoding`
- [ ] AC-E2: 网络级瞬时错误（如 `ECONNRESET` / `ECONNREFUSED` / `UND_ERR_CONNECT_TIMEOUT`）会在 proxy 内做有限重试，并保持现有 429/529 retry 逻辑
- [ ] AC-E3: proxy 错误响应返回结构化 `causeCode` / `retryable`，但保留 connect-only timeout，不截断正常 SSE 长流
**Architecture:** 继续沿用 Phase C 的 `connectController + clearTimeout` 模式，只在现有 retry 循环内扩展 network-error 分支；不引入包裹整个 `fetch()` 生命周期的 `AbortSignal.timeout(...)`。
**前端验证:** No

---

## 现状

### 已有保护（必须保留）
- `scripts/anthropic-proxy.mjs` 已经把 timeout 限定在“拿到 headers 之前”，headers 到了就 `clearTimeout`，防止长 SSE 被中途截断。
- `packages/api/test/anthropic-proxy-timeout.test.js` 已覆盖“hung upstream 返回 504”和“slow streaming 不截断”。

### 缺口 1：request body 改写后仍转发原始 `content-length`
- 当前 `stripThinkingFromRequest()` 会缩短 body。
- `forwardHeaders` 仍把客户端原始 `content-length` 透传给 upstream。
- 结果：undici 在 proxy→upstream 这一跳抛 `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH`，用户只看到笼统 `fetch failed`。

### 缺口 2：网络级错误没有 retry / 诊断
- 当前 retry 只覆盖 429/529。
- 对 `ECONNRESET` / `ECONNREFUSED` / `ETIMEDOUT` / `UND_ERR_CONNECT_TIMEOUT` 等网络错误，proxy 直接 502。
- 错误响应没有 `causeCode`，上层无法区分 timeout / reset / refused / dns。

---

## TDD 顺序

### Task 1: 先写失败测试

修改 `packages/api/test/anthropic-proxy-timeout.test.js`，新增 3 个 red cases：

1. `retries transient upstream socket failures and succeeds on retry`
2. `includes causeCode for terminal network failures`
3. `preserves request forwarding when sanitization changes body length`

预期：
- 当前代码下，第 1 条会直接 502；
- 第 2 条没有 `causeCode`；
- 第 3 条会触发 `Request body length does not match content-length header`。

### Task 2: 最小实现

只改 `scripts/anthropic-proxy.mjs`：

1. 扩展 request header 过滤：
   - `content-length`
   - `transfer-encoding`
2. 在现有 retry 循环里加 network-error 分支：
   - 识别 `ECONNREFUSED` / `ECONNRESET` / `ENOTFOUND` / `ETIMEDOUT` / `UND_ERR_*`
   - 短退避后重试
3. 统一错误 envelope：
   - `error.type` 保持 `proxy_timeout` / `proxy_error`
   - 新增 `causeCode`
   - 新增 `retryable`

### Task 3: 回归验证

必须保证原 Phase C 保护不回退：

- `node --test packages/api/test/anthropic-proxy-timeout.test.js`
- `node --test packages/api/test/proxy-fallback.test.js`

必要时补一轮 targeted lint / typecheck。
