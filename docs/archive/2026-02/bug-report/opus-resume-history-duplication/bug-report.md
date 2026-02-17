# Bug Report: Resume 后旧内容重复发送（跨猫复查版）

> **报告人**: 铲屎官
> **定位猫猫**: 缅因猫 🐾
> **复查范围**: 布偶猫 / 缅因猫 / 暹罗猫
> **报告日期**: 2026-02-09
> **严重程度**: P1（功能异常 + token 膨胀 + 对话质量下降）
> **状态**: 已修复（待 Opus 4.6 复核）

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：恢复布偶猫 CLI 会话（resume）后，观察到“以前内容被多次重复发送”

---

## 2. 复现步骤（期望 vs 实际）

### 复现步骤

1. 恢复同一只猫的 CLI 会话（resume）。
2. 在同一 thread 连续发送 3~4 条消息。
3. 观察 prompt 中的历史块（尤其是 `[对话历史 - 最近 N 条]`）。

### 期望行为

- 每轮只注入必要增量历史，不重复回放旧包。
- 历史上下文增长应近似线性。

### 实际行为

- 旧历史在后续轮次反复出现。
- 历史块可出现“包中包”式重复，导致膨胀。
- 用户体感为“以前内容在重复发送”。

---

## 3. 根因分析（含三猫复查）

### 3.1 代码链路复查结论

| 猫猫 | 是否使用 resume | 是否使用 Context prepend | 结论 |
|---|---|---|---|
| 布偶猫（Opus / Claude） | 是（`--resume`） | 是 | **高风险，已出现用户报告现象** |
| 缅因猫（Codex） | 是（`exec resume`） | 是 | **同机制高风险（未见本次用户直接报案，但链路一致）** |
| 暹罗猫（Gemini） | 否（当前默认不走 `--resume`） | 是 | **不属于同一主因路径，风险低于前两者** |

证据点：
- Opus resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/ClaudeAgentService.ts:162`
- Codex resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/CodexAgentService.ts:115`
- Gemini 不走 resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/GeminiAgentService.ts:153`
- 三猫统一 prepend 历史：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/route-strategies.ts:137`

### 3.2 根因结论

本问题的主因不是“单一猫异常”，而是**架构层双通道上下文叠加且缺少去重边界**：

- 通道 A：Agent CLI resume 带入会话历史（Opus/Codex）。
- 通道 B：服务端每轮再 prepend 最近历史（三猫统一）。
- 当历史文本中已含历史包装结构时，下一轮又被当普通消息拼回去，形成重复放大。

补充：
- 该行为在设计文档里曾被视作“可接受重复”（依赖模型自去重），见：
  `/Users/lysander/projects/relay-station/cat-cafe/docs/phases/phase-3.6-debt-cleanup.md:372`
- 现网表现说明这个假设对 Opus/Codex 不成立或不稳定。

---

## 4. 修复方案（已实施，非止血）

### 4.1 核心方案：全猫统一“增量投递游标”

在路由层引入按 `userId + catId + threadId` 维度的 `delivery cursor`，每轮只给当前猫注入“上次已确认边界之后”的新消息：

- 新增 `DeliveryCursorStore`（Redis + 内存降级）。
- 新增 `MessageStore.getByThreadAfter(...)`（内存/Redis 都支持）。
- `routeSerial` / `routeParallel` 使用增量上下文组装，不再拼接会递归膨胀的旧历史块。

### 4.2 防重复：消息级别去重而不是文本猜测

- 增量上下文由消息 ID 边界驱动，天然避免“同一包历史再次重放”。
- 写回猫回复前先做 `sanitizeInjectedContent`，剥离历史注入包装，避免“包中包”被再次持久化。

### 4.3 防丢失：仅在成功响应后推进游标

- 仅当该猫本轮 `done` 且无错误时才 `ack cursor`。
- 若中途失败或中断，游标不前移，下一轮会重新看到尚未确认的增量消息，避免丢失。
- 每只猫独立游标，保证“同一条跨猫消息被每只需要看到的猫各看一次”，且不会反复回放。

### 4.4 适用范围

不是只修 Opus：该机制在统一 `route-strategies` 层生效，覆盖 **Opus / Codex / Gemini**。

### 放弃方案（本次未采用）

- “resume 时禁用历史注入”的止血方案：会牺牲跨猫可见性，且不能从根上解决重复包递归问题。
- “全局禁用 resume”：损失会话连续性和效率，不符合产品目标。

---

## 5. 验证方式

### 已完成复查与修复验证（本次）

- 三猫链路复查：完成（见上方证据路径）。
- 核心回归（增量投递）：执行

```bash
pnpm -C packages/api build && cd packages/api && node --test test/route-strategies.test.js test/agent-router.test.js test/integration/cross-cat-context.test.js test/integration/incremental-delivery.test.js
```

结果：70/70 通过。

- 全量 API 回归：执行

```bash
pnpm -C packages/api test && pnpm -C packages/api test:integration
```

结果：命令退出码为 0，全部通过。

### 新增关键回归断言

1. 同一只猫跨多轮：已投递消息 ID 不重叠（防重复）。
2. 跨猫场景：Codex 只接收“未见过”的用户/同伴消息，且下一轮不重放（防重复）。
3. 失败场景游标不推进（由成功后 ack 机制保证可重试，防丢失）。

---

## 6. 结论

你说得对，问题不该只按“布偶猫异常”描述。最终结论是：

- **根因在共享路由层的上下文投递策略，不是单猫行为。**
- **修复已提升为统一的“消息增量投递 + 成功确认游标”机制，三猫同策略。**
- **目标达成：不重放、不漏投，并保留跨猫协作可见性。**

---

*签名: 缅因猫 🐾*
