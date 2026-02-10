# Bug Report: file_change 事件后前端失联 / 会话超时

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-10  
> **严重程度**: P1  
> **状态**: 待修复（先立案，进入最小复现与链路定位）

---

## 1. 报告来源

- 来源消息（用户）：
  - `0001770754667696-000010-262860c2`
  - 现象：前端授权同意卡多次点击后不消失，挂住多条请求。
- 来源消息（用户）：
  - `0001770763917359-000003-a75220b4`
  - 现象：会话超时，怀疑与在 `main` 修改触发热更新相关。
- 来源消息（用户）：
  - `0001770765065818-000000-97bd41ce`
  - 现象：在独立 worktree 中继续执行也出现超时中断，用户追问“到底哪里又断了”。
- 补充观察（用户）：
  - 最后可见事件为 `codex -> file_change {"status":"completed","changes":1}`；
  - 在该事件之前，`command_execution` 持续正常返回。

---

## 2. 复现步骤（期望 vs 实际）

1. 在独立 worktree 会话中触发 Codex 连续执行（命令 + 文档编辑）。
2. 执行到首次文件编辑完成，后端产生 `file_change` 事件。
3. 观察前端会话连接状态和消息流是否继续。

**期望行为**
- `file_change` 仅作为普通工具事件展示；
- 前端连接保持稳定；
- 本轮调用继续收到后续事件（含最终 `done` / 文本输出）。

**实际行为**
- `file_change completed` 后前端失联或进入超时；
- 用户侧看到“⏱ Response timed out...”，且中间状态卡住；
- 该时间窗内无正常收尾信号可见。

---

## 3. 日志证据

### 3.1 CLI 原始归档（关键锚点）

文件：`packages/api/data/cli-raw-archive/2026-02-10/6f71fb62-c8e0-4069-8544-4719de9b71ef.ndjson`

- `59` 行：`item.completed`, `type=file_change`, `status=completed`, `changes=1`
- `60` 行：进入下一条 reasoning 后流停止，未见本轮正常收尾事件

### 3.2 审计日志（同时间窗）

文件：`packages/api/data/audit-logs/audit-2026-02-10.ndjson`

- `13264` 行：`cat_invoked`, `invocationId=6f71fb62-c8e0-4069-8544-4719de9b71ef`
- `13265~13300` 行：`cli_tool_started/completed`（command_execution）持续正常
- `13301` 行：`server_shutdown`
- `13302` 行：`server_started`

### 3.3 补充最小复现（2026-02-10）

线程：`thread_mlh8mx59zqng8tn7`  
InvocationRecord：`417675a8-9e2a-4f30-9c1a-f8fd02937e7b`  
Cat invocation：`c188a120-b89d-4e7d-b685-f5d9bc757504`

文件：`packages/api/data/cli-raw-archive/2026-02-10/c188a120-b89d-4e7d-b685-f5d9bc757504.ndjson`

- `4` 行：`item.completed`, `type=file_change`, `status=completed`
- `6` 行：`agent_message: done`
- `7` 行：`turn.completed`

同时间窗审计未出现新的 `server_shutdown`。

**结论（复现实验）**
- “出现 `file_change`”本身**不是**断链充分条件；
- 断链更可能与特定运行上下文（例如热更新/重启窗口）相关，而非所有 `file_change` 都必现。

---

## 4. 根因分析（当前结论）

### 4.1 已确认事实

1. 原始故障窗口与 `file_change completed` 时间高度重合（raw 证据）。
2. 原始故障窗口内出现服务端重启（audit 证据）。
3. 补充复现实验显示 `file_change` 可在无重启场景下正常收尾（`done + turn.completed`）。
4. 目前前端对该链路缺少关键诊断日志：
   - `useSocket` 仅打印 `Disconnected`，没有 `reason/close code`；
   - `useAgentMessages` 未记录 `tool_use(file_change)` 前后状态。

### 4.2 当前最可信方向

- **更高概率**：后端在特定时段发生重启导致 WS 连接中断，前端表现为失联/超时。
- **待证伪方向**：前端在处理 `tool_use(file_change)` 时触发状态机异常，导致 UI 侧“看起来断链”。

> 说明：最小复现已验证“并非 file_change 必现”。下一步关键是拿到断链当次 `disconnect reason / close code`。

---

## 5. 修复方案（先定位再收敛）

### 方案 A（先做，低风险定位）

1. 在前端 `useAgentMessages` 对 `tool_use(file_change)` 增加前后日志（消息 ID、catId、active ref 状态）。
2. 在 `useSocket` 增加断线诊断（`disconnect reason` + `transport` + `connect_error`）。
3. 做最小复现：只编辑一个小文件触发 1 次 `file_change`，记录是否必现。

### 方案 B（隔离验证）

1. 临时跳过 `file_change` 的 UI 更新（仅日志，不 append 事件）。
2. 再跑同样最小复现：
   - 若仍断：前端 UI 渲染不是主因，优先追后端重启链路；
   - 若不再断：聚焦前端 `tool_use/file_change` 处理逻辑。

### 取舍

- 先不直接改业务功能，先把链路证据打全，避免“拍脑袋修复”掩盖真正根因。

---

## 6. 验证方式（Red -> Green）

1. **Red**：按最小复现触发一次 `file_change`，记录失联或超时（含日志）。
2. **定位验证**：应用方案 A 埋点后复现，拿到断线 reason 与 file_change 前后状态。
3. **隔离验证**：应用方案 B 临时旁路后复现，确认是否仍断。
4. **Green 判定**：
   - 3 轮连续复现不再断链；
   - 前端能稳定收到后续事件并正常收尾；
   - 无新的 pending/卡死副作用。

---

*签名: 缅因猫 🐾*
