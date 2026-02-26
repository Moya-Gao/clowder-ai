---
feature_ids: []
topics: [timeout, message, persistence]
doc_kind: plan
created: 2026-02-17
---

# 超时假阳性 & 消息丢失复盘

> 日期：2026-02-17
> 报告人：铲屎官（用户实测）
> 定位：布偶猫 + 缅因猫联合
> Phase A 修复：`fix/timeout-and-persistence-stopgap` → commit `8057aac`
> Phase B BACKLOG：[#80](#80-流式草稿持久化streaming-draft-persistence)

---

## 现象

重构完成（F23+F25，PR #21）后出现：

1. 频繁出现 `⏱ Response timed out. The operation may still be running in the background.`
2. 刷新页面后，猫猫正在进行中的消息（含工具调用记录）消失

---

## 根因分析（两个独立问题）

### 问题 A：超时假阳性（5 分钟空转）

前端有 5 分钟 done-reachability 超时（`useAgentMessages.ts`）：
- 每收到 socket 消息（text/tool_use/heartbeat）就重置计时器
- 后端每 30s 发 heartbeat 续命
- **根因**：当后端出现以下异常时，前端收不到终态信号（无 `isFinal`），loading 状态不清，最终等满 5 分钟

**具体漏洞（定位链）**：

| 位置 | 问题 |
|------|------|
| `messages.ts:343` 全局 catch | 发 `error` 不带 `isFinal: true` |
| `ClaudeAgentService.ts` catch | yield `error` 但不 yield `done` |
| `CodexAgentService.ts` catch | 同上 |
| `GeminiAgentService.ts` invokeGeminiCLI catch | 同上 |
| `GeminiAgentService.ts` invokeAntigravity | 3 处 early return：callbackEnv 缺失、sync spawn 失败、async spawn 失败，均只 error 不 done |
| `ChatContainer.tsx:145` heartbeat | `onHeartbeat` 不按 threadId 过滤，其他 thread 心跳会误续命 |

**注意**：`invoke-single-cat.ts` 的外层 catch（line 522）已经有 `error + done` 兜底，但只捕获 throw；provider 层 catch 是 yield error + 正常 return，不会 throw，所以无法被外层 catch 兜住。

### 问题 B：刷新后消息消失

**根因**：消息持久化只发生在猫猫完成时（`route-serial.ts:232` / `route-parallel.ts:201`），streaming 阶段只存在前端 Zustand store 内存中。

- 刷新 → 前端重建 → 重新拉 `GET /api/messages` → Redis 里没有进行中的消息 → 消失
- 更糟场景：`hadError && textContent === ''` → 整个消息（含工具调用记录）skip persistence，刷新后彻底消失

---

## Phase A 修复（止血，已合入 commit `8057aac`）

| Fix | 文件 | 改动 |
|-----|------|------|
| Fix 1 | `messages.ts` | 全局 catch 发 error 时补 `isFinal: true` |
| Fix 2 | Claude/Codex/GeminiAgentService | catch 块 yield error 后补 yield done（isFinal 由 invoke-single-cat processMessage 按 isLastCat 设置） |
| Fix 3 | `GeminiAgentService` invokeAntigravity | 3 个 early return 路径各补 yield done |
| Fix 4 | `route-serial.ts` + `route-parallel.ts` | `hadError && textContent === ''` 但有 toolEvents 时仍持久化，保留工具调用记录 |
| Fix 5 | `ChatContainer.tsx` + `useSocket.ts` | heartbeat 带 threadId 数据，onHeartbeat 只在 `data.threadId === threadId` 时续命 |

测试结果：1327/1328 pass（1 skipped），0 fail。

---

## Phase B：流式草稿持久化（待做）

见 [BACKLOG #80](../BACKLOG.md)。

**核心思路**：在 streaming 阶段就增量写入"草稿消息"，刷新后能从 Redis 恢复进行中的内容，不只是看到最终结果。

**难点**：
1. 草稿写入时机：每个 token？每次工具调用？定时间隔？
2. 草稿与最终消息合并：避免重复（草稿 → 正式消息的 upsert 语义）
3. 草稿 TTL 和清理：猫猫正常完成后清理草稿；进程崩溃后的孤儿草稿处理
4. Redis 写入频率：streaming 高频写对 Redis 压力，可能需要 buffer + 间隔写

**为什么 A 不能替代 B**：Phase A 解决了"卡住不动 5 分钟"，但不解决"刷新后消息消失"。这两个是独立问题。

---

## 系统级教训

1. **Provider 层必须保证每条调用路径都有 done**：error 只是内容，done 才是协议边界。调用方（invoke-single-cat）依赖 done 来决定何时结束。
2. **heartbeat 是 thread 维度的信号，不是全局信号**：多 thread 并发时，非当前 thread 的心跳不应该续命当前 thread 的超时计时器。
3. **streaming 态数据的持久化时机**：当前架构是"完成后持久化"，对长时间工具调用场景不友好。Phase B 需要从架构层面解决。
4. **终态信号缺失是协议级漏洞**：任何一条路径（provider catch、global catch、early return）没有终态信号，前端就会卡住。需要系统性保证，不能靠人肉检查。
