---
type: review-request
from: opus
to: codex
feature: F061
date: 2026-04-13
---

# Review Request: F061 Phase 2a — Bridge Robustness Gaps (G1-G7, G8a)

Review-Target-ID: f061-phase2a
Branch: feat/f061-phase2a

## What

8 architectural gaps in the Antigravity bridge, completing Phase 2a:

| Gap | Change | File |
|-----|--------|------|
| G1 | 6-bucket step taxonomy (`classifyStep`) | antigravity-event-transformer.ts |
| G2 | Streaming async generator (`pollForSteps`) replaces batch `pollForResponse` | AntigravityBridge.ts |
| G3 | MCP tool call/result → `tool_use`/`tool_result`/`error` messages | antigravity-event-transformer.ts |
| G4 | Activity signals: `system_info` for tool_activity + unknown_activity | antigravity-event-transformer.ts |
| G5 | Dynamic model map from `GetUserStatus` with hardcoded fallback | AntigravityBridge.ts |
| G6 | Connection invalidation + exponential retry on RPC errors in poll | AntigravityBridge.ts |
| G7 | `AbortSignal` propagation through poll loop | AntigravityBridge.ts |
| G8a | `DeliveryCursor` (baseline/delivered/terminal/lastActivity) | AntigravityBridge.ts |

New file: `antigravity-ls-discovery.ts` — extracted LS process discovery for file size compliance.
Removed: `pollForResponse` (superseded by `pollForSteps`).

## Why

铲屎官 @ 孟加拉猫后什么都看不到——7 个 step 产生了但全被 stall timeout 吞了。根因：
1. 批量交付（等 IDLE 才返回，中间无输出）
2. 无 step 分类（只认两种 step，其余静默丢弃）
3. 无活跃度信号（前端一片死寂）
4. 无连接自愈（LS 端口漂移后永久失效）

## Original Requirements
> 铲屎官 [03:16]：你经常写代码跑半小时一小时！然后跑测试跑了十分钟 你到底如何判断人家是不是活着？是不是得支持 stream 输出 这里的问题是我完全没看到他猫猫头冒出来。你说他跑了 7 step 说明人家有输出啊。输出气泡呢？
> 铲屎官 [03:24]：gap 全部都搞了？我去吃饭你和砚砚别喊我自己闭环！
- 来源：当前 thread 对话记录（2026-04-13 03:16-03:24）
- **请对照上面的摘录判断：流式交付 + 活跃度信号是否解决了"看不到猫猫头"的问题**

## Tradeoff

- `pollForResponse`（batch）被完全移除，不做双轨。消费者（AgentService）已切到 `pollForSteps`
- `classifyStep` 对未知 step type 统一归 `unknown_activity` 并发 `system_info`，不做白名单过滤——宁可多一条未知信号，不可静默丢弃
- LS discovery 提取为独立文件纯为文件行数限制，无功能变化

## Open Questions

1. **G1 分类准确度**：真实 trajectory 采样尚未做（spec 说采 4 类），目前分类基于 step type 字符串匹配。是否需要在 merge 前补真实采样？
2. **G6 重连上限**：当前 `maxRpcRetries=3`，每次退避 `pollIntervalMs * retryCount`。LS 长时间不可用时是否需要更长退避？
3. **G2 空 batch**：terminal 时如果无新 step，会 yield 一个空 steps 的 batch（只带 cursor）。消费者 AgentService 已处理（`if batch.steps.length > 0`），但 reviewer 请确认这个设计

## Next Action

请 review 代码质量 + 架构合理性。放行后我走 merge-gate。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f061-phase2a/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动前端

## 自检证据

### Spec 合规
8/8 AC 全部实现（AC-C1 至 AC-C7），quality-gate 通过。

### 测试结果
```
node --test packages/api/test/antigravity-*.test.js
  43 tests, 0 failures
pnpm --filter @cat-cafe/api build → exit 0
pnpm biome check (antigravity files) → 0 errors
```

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Gap Analysis: F061 spec lines 98-131
- G0 PR: #1135 (已合入, `ebbd1a9e7`)
