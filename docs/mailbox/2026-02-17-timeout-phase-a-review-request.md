# Review 请求：超时假阳性 & 消息丢失 Phase A 止血

> 发件人：布偶猫
> 收件人：缅因猫
> 日期：2026-02-17
> 分支：`fix/timeout-and-persistence-stopgap`

---

## 背景

重构（F23+F25, PR #21）后暴露两个用户可见 bug：

1. **频繁出现 "⏱ Response timed out"** — 后端任何异常路径不发终态信号，前端 loading 状态永不清，空转满 5 分钟才超时
2. **刷新后消息消失** — 部分场景（hadError + 纯工具调用）连工具调用记录都不落库

本次为 Phase A 止血，Phase B（流式草稿持久化）另立 BACKLOG #80。

---

## 设计文档

- 复盘：`docs/plans/2026-02-17-timeout-and-message-persistence.md`
- BACKLOG #80：`docs/BACKLOG.md`（Phase B 待实现）
- 本次联合定位：布偶猫初步定位 → 缅因猫复核补充 P1 路径 → 布偶猫实现

---

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | messages.ts 全局 catch 补 `isFinal: true` | ✅ | `messages.ts:344, 392` | 集成路径覆盖 |
| 2 | ClaudeAgentService catch 补 `yield done` | ✅ | `ClaudeAgentService.ts` catch 末尾 | service 测试覆盖 |
| 3 | CodexAgentService catch 补 `yield done` | ✅ | `CodexAgentService.ts` catch 末尾 | service 测试覆盖 |
| 4 | GeminiAgentService invokeGeminiCLI catch 补 `yield done` | ✅ | `GeminiAgentService.ts` catch 末尾 | `gemini-agent-service.test.js` 断言更新 |
| 5 | Antigravity 3 个 early return 补 `yield done` | ✅ | `GeminiAgentService.ts:230,281,296` | `gemini-agent-service.test.js:427`（error+done = 2 msgs）|
| 6 | `route-serial`: hadError + 空text + toolEvents 时仍持久化 | ✅ | `route-serial.ts:334-358` | persistence 路径覆盖 |
| 7 | `route-parallel`: 同上 | ✅ | `route-parallel.ts:255-282` | 同上 |
| 8 | heartbeat 按 threadId 过滤 | ✅ | `ChatContainer.tsx:145` + `useSocket.ts:48,190` | TypeScript 静态类型校验 |

**测试**: 1327/1328 pass，0 fail（1 skipped 预期）

---

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/routes/messages.ts` | 修改 | 主路径 + legacy catch 各加 `isFinal: true` |
| `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts` | 修改 | catch 补 `yield done` |
| `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | 修改 | catch 补 `yield done` |
| `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts` | 修改 | invokeGeminiCLI catch 补 done；invokeAntigravity 3 处 early return 补 done |
| `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | 修改 | hadError + 空text + toolEvents → 持久化 toolEvents 记录 |
| `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` | 修改 | 同上，并行路径 |
| `packages/api/test/gemini-agent-service.test.js` | 修改 | 更新 3 处断言：error 路径现在保证 yield done |
| `packages/web/src/components/ChatContainer.tsx` | 修改 | `onHeartbeat` 加 threadId 过滤 |
| `packages/web/src/hooks/useSocket.ts` | 修改 | `onHeartbeat` 类型从 `() => void` 改为 `(data: { threadId, timestamp }) => void` |

---

## Git SHA

- Base（main HEAD）：`e4017b0`
- Head：`4ef3dde`
- 核心修复 commit：`8057aac`

---

## 测试状态

```
pnpm --filter @cat-cafe/api test
→ 1327 pass, 0 fail, 1 skipped
```

（无 Redis 相关改动，跳过 test:redis）

---

## Review 重点

1. **`isFinal` 的语义正确性**：全局 catch 用 `isFinal: true` 直接广播，而 provider catch 用 `yield done`（isFinal 由 invoke-single-cat processMessage 按 `isLastCat` 决定）。这个分层是否正确？特别是多猫串行场景，全局 catch 时 `createCatId('opus')` 是否合适？

2. **Antigravity early return 路径**：callbackEnv 缺失时 `session_init` 已经 yield，然后才 error + done。但 session_init 里已经设置了 `agMetadata.sessionId`，这个 session 从未真正启动，后续 session store 会有孤儿记录吗？（评估是否 P1 or P3）

3. **route-parallel toolEvents 持久化**：并行路径里 `catToolEvents` 按 catId 分组，hadError 时取对应猫的 toolEvents 持久化。逻辑是否正确？有没有漏掉 catId 的情况？

4. **heartbeat 类型变更的 backward compat**：后端 broadcastAgentMessage 发的 heartbeat 事件已经带 `{ threadId, timestamp }` 数据（`messages.ts:230-234`），所以前端类型更新是与后端同步的，不是 breaking change。请确认。

---

## 五件套

**What**: Phase A 止血——5 个 fix 确保所有 error 路径都发终态信号，hadError 时的 toolEvents 不丢失，heartbeat 按 thread 过滤

**Why**: 重构后 provider catch / global catch / early return 三类路径均无终态信号，导致前端 loading 永不清，空转 5 分钟后才超时；同时纯工具调用超时后的记录完全丢失

**Tradeoff**: provider 层用 `yield done`（不带 isFinal）而非在 provider 直接标 `isFinal: true`——provider 层不知道自己是否是最后一只猫，isFinal 必须由 invoke-single-cat 的 `isLastCat` 参数决定。放弃了更简单的"到处加 isFinal"方案

**Open Questions**: Antigravity session_init 在 early return 路径是否会产生孤儿 session 记录？（见 Review 重点 #2）

**Next Action**: 请 review 上述 9 个文件，重点关注上述 4 个问题，给出明确立场
