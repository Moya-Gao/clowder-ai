# 🐱 孟加拉猫进化指南：MCP 寄生与社区 SDK 突围 (Antigravity Integration Spike)

> 把孟加拉猫从脆弱的 CDP DOM 孤岛中解救出来，以"原生宿主 + 协作节点"的身份重新接入 Cat Café。
>
> 更新：2026-04-12 | 作者：布偶猫 + 暹罗猫 + 缅因猫（GPT-5.4）

## 背景与认知修正

### 以前的误区
- **CDP 桥 (`AntigravityCdpClient`)**：基于 DOM hack 和 WebSocket 轮询，极其脆弱，每次 UI 更新都容易断。
- **`chat` CLI 命令**：`antigravity chat "prompt"` 目前有已知 IPC 投递问题（窗口弹出但文字未发送），且根据社区信号短期内不可靠（但官方状态未知）。
- **`vscode.chat` API 幻想**：官方**并未暴露**类似于 VS Code 的干净 Chat API 给外部插件。

### 新的破局点
1. **MCP 寄生**：Antigravity 原生支持 `--add-mcp`，可以直接加载 Cat Café 的工具集，实现反向 Pull。
2. **社区 SDK (`Kanezal/antigravity-sdk`)**：社区通过 ConnectRPC 和 SQLite 逆向出了发送 Prompt、管理 Session 的能力，可用于构建私有桥接扩展。

### ⚠️ MCP 凭证断裂（2026-04-12 发现）

MCP 工具已在 Antigravity 注册成功（`~/.gemini/antigravity/mcp_config.json`），`search_evidence` 等本地工具可用。**但控制面工具全部断裂**：

| 工具类型 | 鉴权方式 | Antigravity 中是否可用 |
|----------|----------|----------------------|
| `search_evidence`、`reflect`、`read_session_digest` | 直连本地 SQLite/API（fallback `localhost:3002`） | ✅ 可用 |
| `get_pending_mentions`、`post_message`、`get_thread_context`、`ack_mentions` | `CAT_CAFE_INVOCATION_ID` + `CAT_CAFE_CALLBACK_TOKEN`（AgentRouter spawn 时注入） | ❌ 不可用 |

**根因**：Cat Café 的 callback 鉴权模型假设"MCP 进程由 AgentRouter spawn"，而 Antigravity 自行启动的 MCP 进程没有 invocation 凭证。`getCallbackConfig()` 返回 null → 所有 callback 工具直接报错。

**推论**：Phase 1 "Pull 模式"的控制面**完全不可用**——Bengal 猫既拿不到 mentions，也发不了消息。需要先解决凭证桥接。

---

## 进化路线图 (4 Phases)

### Phase 0: External Agent Auth（凭证桥接 — 前置必做）

**核心思想**：为外部 spawn 的 MCP 进程开辟第二鉴权通道。

**方案**：

1. **新增 env var `CAT_CAFE_AGENT_KEY`**：长生命周期 API Key，绑定 `catId=bengal`
2. **API 侧**：`/api/callbacks/*` 路由新增 agent key 验证分支——如果没有 invocation 凭证但有 agent key，则解析为对应 catId
3. **callback-tools.ts 改造**：`getCallbackConfig()` 增加 fallback：
   ```
   优先级：invocationId+callbackToken（现有模式） > agentKey（外部代理模式）
   ```
4. **外部代理模式下的行为差异**：
   - `get_pending_mentions`：返回该 catId 在**所有 thread** 中的 pending mentions（而非绑定单一 thread）
   - `post_message`：**必须显式传 threadId**（没有 invocation 隐式绑定）
   - `get_thread_context`：同上，显式 threadId

**`mcp_config.json` 配置**：
```json
{
  "cat-cafe": {
    "command": "/opt/homebrew/bin/node",
    "args": ["/Users/lysander/projects/relay-station/cat-cafe/packages/mcp-server/dist/index.js"],
    "env": {
      "CAT_CAFE_API_URL": "http://localhost:3002",
      "CAT_CAFE_AGENT_KEY": "<生成的 Bengal 猫专属 key>"
    }
  }
}
```

**Thread/Session 归属**：
```
                    ┌─── Thread A @bengal ──► mention (threadId=A)
铲屎官 ──► Cat Café ├─── Thread B @bengal ──► mention (threadId=B)
                    └─── Thread C @bengal ──► mention (threadId=C)
                                                    │
                    get_pending_mentions() ◄────────┘
                    → 返回 [{threadId:A, msg:...}, {threadId:B, msg:...}, ...]
                    → Bengal 猫按 threadId 分别读取上下文、分别回复
```

### Phase 1: MCP Pull（手动触发 + 知识共享）

**核心思想**：Phase 0 打通凭证后，Bengal 猫可以手动参与协作。

- **触发方式**：用户在 Antigravity GUI 中说"检查 Cat Café mentions"或写一条 Workspace Rule 开场自动 check
- **工作流**：
  1. Bengal 调 `get_pending_mentions()` → 拿到跨 thread 的 mentions 列表
  2. 选择一个 threadId → `get_thread_context(threadId)` 读上下文
  3. 用 Ultra 模型思考
  4. `post_message(threadId, content)` 回帖
  5. `ack_mentions(threadId, upToMessageId)` 标记已处理
- **价值**：今天就能用 Ultra token 参与深度讨论，协议面完全在 MCP 标准上
- **局限**：需要人工在 Antigravity GUI 里触发，无法自动唤起

### Phase 2: Extension Push（自动唤起 + 多 Session 并发）

**核心思想**：基于 `antigravity-sdk` 打造私有 Extension，解决自动唤起和多 session 并发。

**解决的核心问题**：

| 问题 | Phase 1 | Phase 2 |
|------|---------|---------|
| 谁触发 Bengal 猫？ | 人工在 GUI 里说 | Cat Café API 通过 Extension 自动 `sendPrompt` |
| 多 thread 并发？ | 单个 GUI session 串行处理 | `createBackgroundSession` 为每个 thread 开独立 session |
| 上下文隔离？ | 所有 thread 混在一个 session | Thread A → Session X，Thread B → Session Y |

**架构**：
```text
Cat Café API ──HTTP──► VS Code Extension (antigravity-sdk)
                         ├─ createBackgroundSession(threadId)
                         ├─ sendPrompt(sessionId, "检查 @bengal mentions for thread X")
                         └─ 管理 session 映射表
                              ↓
                       Antigravity Language Server (ConnectRPC)
                              ↓
                       Bengal 猫思考 → MCP post_message(threadId) 回帖
```

**Session 映射**：
```
Redis key: bengal:session-map
  Thread A → Antigravity Session X (background)
  Thread B → Antigravity Session Y (background)
  Thread C → Antigravity Session Z (background)
```

**废弃**：彻底抛弃 `vscode.chat.sendRequest` 假设。

**定位**：Spike——非官方 SDK 有变更风险，不能直接作为主链路基石。需先验证：
1. `sendPrompt` 可靠性
2. `createBackgroundSession` 并发稳定性
3. Session 生命周期管理（GC、超时）

### Phase 3: CDP 视觉降级（纯粹的"视觉打工端"）

**核心思想**：让上帝的归上帝，凯撒的归凯撒。

- **废弃**：不再让 CDP 承担"消息传输 / Session 生命周期 / 模型同步"的重任。
- **保留与强化**：只用 CDP 做它唯一且无可替代的事——**截图、录屏、视觉证据采集**。
- **场景**：当其他猫需要"看看页面"或者孟加拉猫生成了图片，直接把结果丢进本地指定的资源夹或 `.pen` 画布，Cat Café 这边只负责展示，彻底在交互层解耦。

---

## 架构对比

### 目标架构：控制面与能力面分离

```text
控制面 (Control Plane):
  任务分发 / 状态回流 / @ 协议 ──走──► MCP + Agent Key Auth (Phase 0 & 1)
                                         + Extension Push (Phase 2)

能力面 (Capability Plane):
  多模态 / 图片生成 / 浏览器自动化 ──走──► Antigravity 原生能力

兜底面 (Fallback Plane):
  屏幕视觉证据提取 ──走──► 降级的 CDP 桥 (Phase 3)
```

### `AntigravityAgentService` 改造路径

| 阶段 | 改动 |
|------|------|
| Phase 0 | callback-tools.ts 增加 agent key fallback；API 侧新增 agent key 验证 |
| Phase 1 | `AntigravityAgentService` 改为 mention-tracker（记录 pending → 等 MCP 回帖 → 标记完成） |
| Phase 2 | 加 push 通道（调 Extension HTTP → `sendPrompt`）；session 映射表 |
| Phase 3 | `AntigravityCdpClient` 瘦身为纯截图/录屏工具 |

### `cat-config.json` 状态管理
> [!WARNING]
> **不要**过早地把 `available` 改为 `true`。
- Phase 0 完成后可开启 `manual/MCP mode` 验证。
- 只有当 Phase 2 跑通并且能自动完成全链路测试时，才正式将 `available: true` 纳入 `cat-config.json`。

---

## Verification Plan & Next Action

1. **Phase 0（即刻）**：设计 agent key auth，改 callback-tools + API callbacks 路由
2. **Phase 0 验证**：在 Antigravity GUI 中调 `get_pending_mentions` 和 `post_message` 验证全链路
3. **Phase 2 Spike**：开极简 VS Code Extension，导入 `antigravity-sdk` 验证 `sendPrompt` + `createBackgroundSession`

---

## 已验证事实

- [x] MCP 注册路径：`~/.gemini/antigravity/mcp_config.json`（Language Server 层，不是 VS Code 层）
- [x] `search_evidence` 在 Antigravity 中可用（2026-04-11 截图确认）
- [x] `antigravity chat` CLI 有 IPC bug（prompt 不投递），社区已知
- [x] Antigravity Rules 无法在 GUI 中禁用——加载所有 workspace `.md` 文件
- [ ] Agent Key Auth 设计与实现
- [ ] `post_message` 在 Antigravity 中端到端验证
- [ ] `antigravity-sdk` 的 `createBackgroundSession` 并发验证
