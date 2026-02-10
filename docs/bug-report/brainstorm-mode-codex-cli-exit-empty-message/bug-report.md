# Bug Report: Brainstorm 第二轮出现 Codex 空消息 + CLI 异常退出

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-10  
> **严重程度**: P1  
> **状态**: 待修复（按铲屎官要求先立案，不在本次会话修）

---

## 1. 报告来源

- 来源消息（用户）：
  - `0001770754080552-000002-506589b4`
  - 内容要点：头脑风暴模式第二轮独立排队发言时，布偶猫发完后，缅因猫侧出现 CLI 报错并退出；不是单纯空返回。
- 补充消息（用户）：
  - `0001770753677005-000000-6368a8f5`
  - 内容要点：确认“布偶发言完然后你报错退出”。

---

## 2. 复现步骤（期望 vs 实际）

1. 在同一线程进行“头脑风暴第二轮独立发言”场景，@布偶 和 @缅因 排队回复。
2. 布偶猫先返回一条完整长消息。
3. 紧接着触发缅因猫调用。

**期望行为**
- 缅因猫正常返回可见正文，或至少返回可见错误信息；
- 线程历史不应出现“空 assistant 消息”；
- 审计应能反映该次调用是异常而非正常响应。

**实际行为**
- 线程内出现一条空的 Codex 消息（`content=""`）；
- 原始 CLI 归档显示同一 invocation 发生 `exitCode=1`；
- 审计记录为 `cat_responded`（95ms）而非 `cat_error`。

---

## 3. 相关对话证据

### 3.1 关键消息时间线

1. `0001770736056268-000000-c01e5fec`（2026-02-10T15:07:36.268Z）
   - 用户发起“@布偶 @缅因”并要求独立回应。
2. `0001770736691036-000004-739aab30`（2026-02-10T15:18:11.036Z）
   - 布偶猫第二轮完整回复。
3. `0001770736691133-000005-f163b135`（2026-02-10T15:18:11.133Z）
   - Codex 空消息（`content: ""`）。
4. `0001770753677005-000000-6368a8f5`（2026-02-10T20:01:17.005Z）
   - 用户确认“你报错退出”。
5. `0001770754080552-000002-506589b4`（2026-02-10T20:08:00.552Z）
   - 用户要求按 P1 立 bug report，先不修复。

---

## 4. 日志证据

### 4.1 审计日志（线程级）

文件：`packages/api/data/audit-logs/audit-2026-02-10.ndjson`

- `5191` 行：Codex 被调用  
  - `type=cat_invoked`
  - `invocationId=291c76be-2f63-4b4f-afc8-07a07751cc9b`
  - `timestamp=1770736691038`
- `5192` 行：Codex 被记为已响应  
  - `type=cat_responded`
  - `invocationId=291c76be-2f63-4b4f-afc8-07a07751cc9b`
  - `durationMs=95`
  - `timestamp=1770736691133`

### 4.2 CLI 原始归档

文件：`packages/api/data/cli-raw-archive/2026-02-10/291c76be-2f63-4b4f-afc8-07a07751cc9b.ndjson`

- `1` 行：
  - `{"__cliError":true,"exitCode":1,"signal":null,"message":"CLI 异常退出 (code: 1, signal: none)","command":"codex"}`
  - `timestamp=1770736691132`

### 4.3 空消息记录

通过 callback `thread-context` 可查询到：

- `id=0001770736691133-000005-f163b135`
- `catId=codex`
- `content=""`

---

## 5. 根因分析

## 5.1 已确认事实

1. `CodexAgentService` 在收到 `__cliError` 时会产出 `type: 'error'` 消息：
   - `packages/api/src/domains/cats/services/CodexAgentService.ts:163`
2. 同一 `invoke()` 末尾无条件继续产出 `done`：
   - `packages/api/src/domains/cats/services/CodexAgentService.ts:212`
3. `routeSerial` 在“无文本内容”分支会持久化空消息（`content: ''`）：
   - `packages/api/src/domains/cats/services/route-strategies.ts:406`
   - `packages/api/src/domains/cats/services/route-strategies.ts:412`
4. `routeSerial` 记录了 `hadError`，但“无文本分支”未用它阻止空消息持久化：
   - `packages/api/src/domains/cats/services/route-strategies.ts:311`
   - `packages/api/src/domains/cats/services/route-strategies.ts:329`

## 5.2 结论（当前最可信）

- 本次现象不是“只有空消息没有异常”，而是“CLI 异常 + 空消息同时发生”。
- 造成用户感知为“半退出/空返回”的关键是：
  - 错误路径没有阻止空 assistant 消息落库；
  - 调用链仍以 `done` 收尾，审计被记录为 `cat_responded`，降低了异常可见性。

## 5.3 关于“是不是布偶猫 bug”

- 目前证据**不能**把根因归到布偶猫回复内容本身。
- 直接故障点位于缅因猫调用链与共享路由的错误落库语义（Codex service + routeSerial）。
- 布偶消息是触发时序上的前一条，不是已证实根因。

---

## 6. 修复方案（提案，未执行）

### 方案 A（推荐）

1. 当 `hadError === true` 且 `textContent === ''` 时，禁止写入空 assistant 消息。
2. 统一写入一条可见错误事件（或 system_info 错误摘要）替代空消息。
3. 审计上将该回合标识为 `cat_error`（或新增“responded_with_error”状态）而不是纯 `cat_responded`。

**Why**
- 直接修复用户最痛的“空消息”与“审计误判成功”两处问题。

**Tradeoff**
- 会改变当前错误事件在前端/历史中的呈现语义，需要补回归测试与可能的 UI 文案调整。

### 方案 B（备选）

1. `CodexAgentService` 在出现 `__cliError` 后不再 yield `done`，改为抛错退出。

**Tradeoff**
- 改动面更大，可能影响其它 cat service 的 done/cleanup 约定，回归风险更高。

---

## 7. 验证方式（Red -> Green 计划）

1. **Red 用例 1**：模拟 `spawnCli` 仅产出 `__cliError`，断言不会持久化空 assistant 消息。
2. **Red 用例 2**：同场景断言审计存在异常标记（`cat_error` 或新状态），而非仅 `cat_responded`。
3. **Green**：应用修复后，上述失败用例转绿。
4. **回归**：正常 `text -> done` 链路保持不变，不新增误报。

---

## 8. 当前处理结论

- 已按 P1 立案，证据链完整（对话 + 审计 + CLI raw）。
- 本报告遵循“先立 bug report，再修复”规则。
- 本次会话不修代码，等待铲屎官下一步指令（直接修复 / 指派 / 合并其他流程优化一起做）。

---

*签名: 缅因猫 🐾*
