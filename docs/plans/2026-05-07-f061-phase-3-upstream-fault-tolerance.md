---
feature_ids: [F061]
related_features: [F115, F088]
topics: [antigravity, error-handling, retry, fault-tolerance, plan]
doc_kind: plan
created: 2026-05-07
---

# F061 Phase 3: Unified Upstream Fault Tolerance

**Feature:** F061 — `docs/features/F061-antigravity-bengal-cat.md`
**Goal:** 把 Antigravity 集成层对上游瞬态错误的放大收敛成可恢复的软失败——统一错误分类、分错误种类的 recovery 路径、人话用户文案，终结"retry 1 次就报错 + 用户看到 STOP_REASON 常量"的体验。
**Design discussion:** thread_mov90t7nn4qq1c36（布偶猫 + 缅因猫 GPT-5.5 两轮收敛）

## Acceptance Criteria

- AC-1: Transformer 输出的 error 消息携带 `UpstreamErrorInfo` 元数据（kind/transient/rawReason），`msg.error` 为中文人话
- AC-2: 用户消息永远不包含 `STOP_REASON_CLIENT_STREAM_ERROR`、原始英文错误、或内部 errorCode
- AC-3: `/try again/i` 从 `CAPACITY_PATTERNS` 移除；network 类错误（`connection error / network issue / ECONNREFUSED / timeout`）归 `network` 而非 `capacity`
- AC-4: `stream_interrupted` → grace window first（同 cascade recovery tail，4.5s）；`capacity/network` → skip grace，same-batch dedupe 后直接 backoff retry
- AC-5: retry safety 沿用现有完整安全集（resolved tool / native dispatch / tool_use / tool_result / resolved toolish step / finished toolish step / mixed waiting tool），`hasText` 单独不再抑制 retry，但需同时满足"无不可逆 side effect"
- AC-6: capacity/network retry 成功后 fresh cascade 首条非空 text 带 `textMode: 'replace'`，聚合层自动替换旧 partial text，不双写
- AC-7: `pendingTextReplace` flag 只在"上一轮已 yield 非空 text 且无 side effect"时设置；跨过 session_init/provider_signal/system_info，首条非空 text 触发后立即清除
- AC-8: partial text 含 `@xxx` → retry replace 后最终文本无 `@xxx` → 不触发 handoff（A2A routing 安全）
- AC-9: `invalid_tool_call` / `upstream_error` 保持现有"可自我纠正"语义，不改成硬 terminal
- AC-10: 回归测试覆盖以下 5+1 条路径：
  1. network 文案不归 capacity
  2. `STOP_REASON_CLIENT_STREAM_ERROR` 不出现在用户消息
  3. partial text + capacity + no tool → retry 成功后 `textMode='replace'`，不双写
  4. partial text + tool/native dispatch → 不 retry，surface with context
  5. retry budget exhausted → 明确 diagnostics
  6. partial text `@xxx` + retry replace → 无 `@xxx` → 不 handoff

## Architecture

### Layer 1: Error Taxonomy（Transformer 层）

`antigravity-event-transformer.ts` 保持纯映射，但给每个 error 附上结构化元数据：

```typescript
type UpstreamErrorKind =
  | 'capacity'           // rate limit, quota, overloaded (429-like)
  | 'network'            // connection error, timeout, "please try again"
  | 'stream_interrupted' // STOP_REASON_CLIENT_STREAM_ERROR
  | 'invalid_tool_call'  // model called nonexistent tool
  | 'unknown';           // fallback

interface UpstreamErrorInfo {
  kind: UpstreamErrorKind;
  transient: boolean; // capacity/network/stream_interrupted = true
  rawReason: string;  // 原始上游字符串，只用于日志和 metadata
}
```

分类逻辑变更：
- `isCapacityError`: 移除 `/try again/i`，保留 `rate limit / too many requests / overloaded / exhausted capacity / quota`
- 新增 `isNetworkError`: `/network.*issue|connection.*error|ECONNREFUSED|ETIMEDOUT|try again/i`（从 capacity 迁出）
- `STOP_REASON_CLIENT_STREAM_ERROR` → `stream_interrupted`
- `invalid tool call` → `invalid_tool_call`（non-transient）
- 其余 → `unknown`（non-transient）

用户文案映射：
- `capacity` → "上游模型服务繁忙"
- `network` → "网络连接异常"
- `stream_interrupted` → "连接中断"
- `invalid_tool_call` → "工具调用失败"
- `unknown` → "上游服务异常"

### Layer 2: Recovery — 两层分离（Service 层）

#### 短层：Grace Window（仅 `stream_interrupted`，同 cascade）

维持现有 `pendingStreamError` + `streamErrorGraceDeadline` 机制，但只对 `stream_interrupted` 生效。

- `stream_interrupted` 且 hasText → buffer 4.5s，等 recovery tail
- Grace 期间到达 text → drop error，恢复
- Grace 期间到达更具体 error → supersede
- Grace 到期 → 按"有 text 无 tool"走 retry 或 surface

`capacity` / `network` 不进 grace（ERROR_MESSAGE 型意味着 provider 已明确 terminal），直接进 retry decision。

#### 长层：Backoff Retry（fresh cascade）

`shouldRetryModelCapacity` 重构为 `shouldRetryTransient`，核心变更：

**放宽**：`hasText` / `batchHasText` 不再单独抑制 retry。文本是幂等的，retry 创建 fresh cascade + `textMode: 'replace'` 替换。

**保持**：完整 side effect 安全集不动，只做命名整理：
```
shouldRetryTransient =
  error.transient &&                          // 错误可重试
  !batchHasUpstreamError &&                   // 没有更具体的 fatal
  !attemptHasResolvedToolishStep &&           // 没有已解决的 tool step
  !attemptHasNativeDispatch &&                // 没有本地原生执行
  !attemptHasToolActivity &&                  // 没有 tool 活动
  !batchHasToolActivity &&                    //
  (!batchHasToolishStep || toolishRetryEligible) && // toolish 安全
  retryBudgetRemaining                        // 预算未耗尽
  // 注意：hasText / batchHasText 不再出现！
```

**`pendingTextReplace` 协议**：
- 在 retry 决定点：如果 `hasText && shouldRetryTransient` → 设 `pendingTextReplace = true`
- Fresh cascade 的 message 迭代中：遇到 `msg.type === 'text'` 且 content 非空 → 注入 `textMode: 'replace'`，清除 flag
- Flag 跨过 `session_init` / `provider_signal` / `system_info` 存活，不被这些消息类型清除
- 多次 retry 连续无 text → flag 保留

**retry 信号文案**（`buildCapacityRetrySignal` → `buildRetrySignal`）：
- capacity: "上游模型繁忙，正在自动重试（{n}/{total}）"
- network: "网络连接异常，正在自动重试（{n}/{total}）"

**最终失败文案**：
- 有 text 无 tool: "⚡ 回复可能不完整"（追加到已有文本后）
- 无 text: "上游模型暂时不可用，请稍后重试" / "网络连接失败，请重新发送"
- 有 tool side effect: "模型中断但部分操作已执行，请检查结果后重试"

### Layer 3: 不改的部分

- `AntigravityBridge.ts` — 传输层不动
- `text-aggregation.ts` — 已支持 `replace`，不改
- 前端 — 消息渲染层不改
- 其他 provider — Antigravity 专属
- A2A routing — `parseA2AMentions` 在完整 `textContent` 聚合后执行，`replace` 自然生效，不需要额外协议

## File Change Map

| 文件 | 改动 |
|------|------|
| `antigravity-event-transformer.ts` | 加 `UpstreamErrorInfo` type + 分类函数，替换硬编码字符串，中文文案 |
| `AntigravityAgentService.ts` | `shouldRetryTransient` 重构，`pendingTextReplace` 协议，`buildRetrySignal` 文案 |
| `antigravity-event-transformer.test.js` | 更新分类测试 + 新增 network/stream_interrupted 分类 |
| `antigravity-agent-service-fatal-errors.test.js` | 更新 retry 路径测试 |
| 新增测试文件 | AC-10 的 6 条回归测试 |

## 教训记录

- `/try again/i` 宽匹配把 network error 误归 capacity，导致用户看到"容量不足"但实际是网络问题 → 错误分类 regex 要窄不要宽，宁可 unknown 也不要错归
- `hasText` 一刀切抑制 retry 的原始意图是"避免重放已有输出"，但在有 `textMode: 'replace'` 协议的前提下是过度保守 → 安全判断应该基于"是否有不可逆 side effect"而非"是否有任何输出"

---

[宪宪/Opus-46🐾] + [砚砚/GPT-5.5🐾] 联合设计
