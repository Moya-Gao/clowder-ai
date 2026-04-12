---
feature_ids: [F061]
related_features: [F143, F149, F050]
topics: [antigravity, bengal-cat, mcp, acp, agent-key, connectrpc, architecture]
doc_kind: discussion
created: 2026-04-12
---

# F061 Phase 2 设计讨论：Antigravity 从 CDP 桥到最终形态

> **发起**：布偶猫 | **讨论方**：砚砚 (GPT-5.4) | **日期**：2026-04-12
>
> 铲屎官要求：**不要脚手架，一步到位设计最终最优雅的方案。**

## 背景

F061 Phase 1（CDP 桥接入）已 COMPLETE，但 CDP 桥极其脆弱——DOM hack + WebSocket 轮询，Antigravity 每次更新都可能断。铲屎官确认"基本用不起来"。

同时确认了新的可能性：
- Antigravity 原生支持 MCP，已成功注册 Cat Café MCP Server（`~/.gemini/antigravity/mcp_config.json`）
- `search_evidence` 等本地工具在 Antigravity 中可正常调用（截图确认）
- 社区 `antigravity-sdk`（ConnectRPC + SQLite）提供 `sendPrompt`、`createBackgroundSession` 等能力

## 核心约束

1. **必须使用 Ultra 订阅 token** — 铲屎官开了 Ultra 会员，每月不用血亏。API key 走不了订阅额度，必须走 Antigravity Language Server
2. **最终体验 = 跟 @opus 完全对称** — 在 thread 里 @antigravity，自动出活、自动回帖，不需要手动操作 GUI
3. **多 thread 并发** — Thread A 和 Thread B 同时 @antigravity，能并行处理
4. **不能有 Phase/脚手架** — 直接设计最终形态

## 关键发现：凭证断裂

Cat Café callback 工具（`get_pending_mentions`、`post_message`、`get_thread_context`）依赖 `CAT_CAFE_INVOCATION_ID` + `CAT_CAFE_CALLBACK_TOKEN`——由 AgentRouter spawn 时注入 env。

Antigravity 的 MCP 进程由 Language Server 启动，是**持久进程**（不是 per-invocation spawn）。没有这些 env var → 所有 callback 工具报 `not configured`。

**推论**：无论选哪种集成架构，都需要一个新的鉴权通道来解决持久 MCP 进程的 callback 凭证问题。

## 为什么 ACP 不能直接用

F149 的 ACP 基建（AcpProcessPool + GeminiAcpAdapter）非常成熟，如果能复用就太好了。但：

| ACP 假设 | Antigravity 现实 |
|----------|-----------------|
| CLI spawn（`gemini --acp`） | Antigravity 没有 `--acp` flag |
| stdin/stdout NDJSON | Antigravity 是 Electron IDE + WebSocket |
| Per-invocation spawn | Language Server 是持久进程 |
| MCP 注入 via session/new | MCP 已持久注册在 mcp_config.json |

直接用 ACP 不可行。但 ACP 的**模式**（process pool、session lease、event streaming）值得借鉴。

## 三种架构方案

### 方案 A：ACP 代理桥（最优雅复用）

写一个约 200 行的 Node.js 代理进程，**对内说 ACP、对外说 ConnectRPC**：

```
Cat Café AgentRouter
  → AcpProcessPool（复用 F149）
    → ACP Proxy（stdin/stdout JSON-RPC）
      → ConnectRPC → Antigravity Language Server
        → Ultra 模型思考
        → 通过已注册的 Cat Café MCP tools 回帖
```

**cat-config.json 配置**：
```json
"acp": {
  "command": "node",
  "startupArgs": ["dist/acp-antigravity-proxy.js"],
  "mcpWhitelist": ["cat-cafe", "cat-cafe-memory", "cat-cafe-collab"],
  "supportsMultiplexing": true
}
```

**优点**：
- Cat Café 核心零改动——Antigravity 看起来就是"又一个 ACP CLI"
- 完全复用 AcpProcessPool（进程管理、健康检查、idle 回收）
- 完全复用 GeminiAcpAdapter 模式（event transform、error classify、abort coverage）
- 多 session 并发通过 pool multiplexing 实现

**缺点**：
- 代理层增加一跳延迟
- 依赖 ConnectRPC 协议（社区逆向，非官方）
- 需要 agent key auth 解决持久 MCP 的凭证问题（ACP 的 per-invocation callbackEnv 注入对持久 MCP 进程无效）

### 方案 B：ConnectRPC 直连 Provider（最直接）

新写一个 `AntigravityConnectService` 直接实现 `AgentService` 接口：

```
Cat Café AgentRouter
  → AntigravityConnectService（新 provider）
    → ConnectRPC → Antigravity Language Server
      → Ultra 模型思考
      → 通过 MCP tools 回帖
```

**优点**：
- 最短路径，无代理层
- 简单直接

**缺点**：
- 不复用 F149 ACP 基建（进程管理、健康检查自己写）
- 又多一个 provider pattern（已经有 7 个了，F143 的初衷就是减少这种增长）
- 同样需要 agent key auth

### 方案 C：MCP Pull + Agent Key（最简单）

不写新 provider，只加 agent key 鉴权。Antigravity 通过已注册的 MCP tools 主动拉取任务：

```
Cat Café thread @antigravity
  → mention 入库
  → Antigravity 通过 MCP get_pending_mentions() 主动检查
  → 读上下文 → 思考 → post_message() 回帖
```

**触发方式**：Workspace Rule 或用户手动在 Antigravity GUI 发起。

**优点**：
- Cat Café 侧改动最小——只加 agent key auth（~50 行）
- 不依赖 ConnectRPC（不依赖逆向协议）
- MCP 已验证可用

**缺点**：
- **不满足"跟 @opus 对称"的要求** — 不能自动路由，需要手动触发
- 不是真正的 AgentService provider — 没有 AgentRouter 路由
- 多 thread 并发受限于 Antigravity GUI 的单 session

## 鉴权方案：Agent Key

无论选哪种架构，持久 MCP 进程的 callback 鉴权都需要解决：

1. 新增 `CAT_CAFE_AGENT_KEY` env var（设在 `mcp_config.json` 的 env 中）
2. `callback-tools.ts` 的 `getCallbackConfig()` 增加 fallback：invocation 凭证 > agent key
3. API 侧 `/api/callbacks/*` 增加 agent key 验证分支（agent key → catId 映射）
4. Agent key 模式下：`get_pending_mentions()` 返回跨 thread mentions，`post_message()` 必须显式传 threadId

## 我的倾向：方案 A

理由：
1. **架构一致性** — F143 的初衷就是统一 provider 模式，ACP Proxy 让 Antigravity 复用同一套基建
2. **零核心改动** — Cat Café 核心不感知 Antigravity 的特殊性，它只是"又一个 ACP agent"
3. **代理层足够薄** — 本质上是 `ACP JSON-RPC ↔ ConnectRPC` 的协议翻译，~200 行
4. **铲屎官要的体验** — 全自动路由、多 session 并发、跟 @opus 对称

风险在 ConnectRPC 协议的稳定性，但这个风险方案 A 和 B 都有。选 A 至少在 Cat Café 侧保持了架构纯净。

## 待讨论

1. **方案选择**：A/B/C 哪个最优雅？有没有我漏掉的第四种可能？
2. **ConnectRPC 风险评估**：社区 SDK 被 Antigravity 官方封堵的概率？有没有更稳定的替代通道？
3. **Agent Key 安全边界**：长期 key vs per-session key？key rotation 策略？
4. **`antigravity --acp` 可能性**：Antigravity 毕竟共享 Gemini 的 Language Server，未来加 --acp 的概率？要不要赌这条路？
