# Review Request: F149 Capacity Realtime Warning

## What
新增 `provider_signal` AgentMessage 类型，当 Gemini CLI stderr 出现 429/capacity 重试信号时，实时 yield warning 到前端。用户看到 "⚠️ Gemini 服务端容量不足，正在重试" 而不是干等 120s timeout。

核心变更（4 文件）：
- `types.ts`: 新增 `provider_signal` 到 AgentMessageType union
- `invoke-single-cat.ts`: `provider_signal` 跳过 `resetInvocationTimeout` + `attemptHasContentOutput`，delivery 时映射为 `system_info`
- `GeminiAcpAdapter.ts`: `onCapacity` 触发时 yield deduped warning（stream path + catch path）
- `gemini-acp-adapter.test.js`: 4 个新测试

## Why
铲屎官反馈：并发 @ 时暹罗超时概率高，但用户无法区分"ACP 没做好"和"Gemini 服务端在重试"。现有 capacity signal 只用于事后分类（PR #930/#931），没有实时传到前端。

约束（opus + gpt52 联合分析）：
1. 不能重置 invocation timeout（防"续命"）
2. 不能设置 `attemptHasContentOutput`（保护 self-heal retry）
3. 只吃 fresh stderr signal，不 replay `recentCapacitySignal`
4. 每次 invoke 最多一条 warning（dedup）

## Original Requirements（必填）
> "gemini 体验不好的点只剩下他超时我不能提前感知到 是因为429什么他在等待...这个我们能 他在重试的时候就感知吗？不然老觉得是自己的acp没做好"
- 来源：thread_mnb0em5zthyw0snl, 铲屎官 2026-04-03 01:37
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 不做泛化 `RETRY_RE`（只做 429/capacity，有生产证据的匹配模式）
- 不做 `Promise.race` 实时注入（零 event stall 时 warning 延迟到 timeout+grace 后才显示，但仍在 error 之前）
- 不做 liveness 状态型提示（长期 UX，不是本次 scope）

## Open Questions
1. `invoke-single-cat` 里 `provider_signal` → `system_info` 的映射放在 yield 前。请确认 `streamProcessedOutputs` / `processMessage` 对 `system_info` 的处理不会产生意外副作用
2. catch path 的 warning yield 在 grace window sleep 之后——这意味着 late stderr 场景下 warning 和 error 几乎同时出现。这对 UX 可接受吗？

## Next Action
请 review 代码正确性，特别关注 `invoke-single-cat` 状态机的三个 guard point。

Review-Target-ID: f149-capacity-warning
Branch: feat/f149-capacity-realtime-warning

## 自检证据

### Spec 合规
AC-1~AC-6 全部 ✅（见 quality gate report）

### 测试结果
```
node --test packages/api/test/acp/*.test.js → 62/62 pass, 0 failed
pnpm lint → 0 errors in changed files
pnpm check → 0 errors (biome)
pnpm exec tsc --noEmit false → 0 errors
```

### 相关文档
- Plan: `docs/plans/2026-04-03-f149-capacity-realtime-warning.md`
- Feature: `docs/features/F149-acp-runtime-operations.md`
