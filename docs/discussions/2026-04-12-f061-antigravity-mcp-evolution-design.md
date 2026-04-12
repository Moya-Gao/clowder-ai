---
feature_ids: [F061]
related_features: [F143, F149, F050]
topics: [antigravity, bengal-cat, mcp, connectrpc, bridge, architecture]
doc_kind: discussion
created: 2026-04-12
---

# F061 Phase 2 设计定案：Antigravity Bridge（Bridge-owned writeback）

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

## 关键发现

### 凭证断裂

Cat Café callback 工具（`get_pending_mentions`、`post_message`、`get_thread_context`）依赖 `CAT_CAFE_INVOCATION_ID` + `CAT_CAFE_CALLBACK_TOKEN`——由 AgentRouter spawn 时注入 env。Antigravity 的 MCP 进程由 Language Server 启动，是持久进程，没有这些 env var。

### 为什么 ACP 不能直接用

| ACP 假设 | Antigravity 现实 |
|----------|-----------------|
| CLI spawn（`gemini --acp`） | Antigravity 没有 `--acp` flag |
| stdin/stdout NDJSON | Antigravity 是 Electron IDE + WebSocket |
| Per-invocation spawn | Language Server 是持久进程 |
| MCP 注入 via session/new | MCP 已持久注册在 mcp_config.json |

**F149 的应复用物是 runtime policy（pool / lease / poison taxonomy / session binding），不是 ACP wire protocol。**

---

## 定案：方案 D — Antigravity Bridge（Bridge-owned writeback）

> 讨论经过 A→B→C→D 四轮迭代，A/B/C 淘汰理由见附录。

### 核心原则

**Antigravity 负责"思考与工具使用"，Bridge 负责"线程绑定、上下文装配、结果投递"。**

### 架构

```text
@antigravity in thread
  → AgentRouter（标准路由，创建 InvocationRecord）
    → AntigravityHostedService（薄 provider，实现 AgentService 接口）
      → Local Antigravity Bridge（隔离模块，封装 ConnectRPC 风险）
        → ConnectRPC / antigravity-sdk
          → createBackgroundSession (thread-bound)
          → sendPrompt(sessionId, prompt)
            prompt = 身份指令 + thread context + 任务描述
          → stream back text / thought / tool-progress
      → Bridge 收集响应流 → 转成 AgentMessage → 回 thread
```

### 职责分离

| 职责 | 由谁完成 | 机制 |
|------|---------|------|
| 路由 @antigravity | AgentRouter | 标准 invocation 流程 |
| 创建 Antigravity session | Bridge | `createBackgroundSession()` via ConnectRPC |
| 装配 prompt（thread context + 身份） | Bridge / AntigravityHostedService | 从 API 取 thread context，构造完整 prompt |
| 思考 + 推理 | Antigravity Language Server | Ultra 模型，使用订阅 token |
| 只读工具调用（search_evidence 等） | Antigravity 直接调全局 MCP | 不需要 callback 凭证 |
| **写回帖（post_message）** | **Bridge 代发** | 标准 invocation 凭证（Bridge 在 Cat Café 进程内） |
| **ack mentions** | **Bridge 代发** | 同上 |
| session 映射（thread ↔ Antigravity session） | Bridge 内部 | 内存/Redis 映射表 |
| ConnectRPC 故障隔离 | Bridge 模块边界 | 坏了只坏 Antigravity 集成，不污染核心 |

### 为什么不需要 Agent Key / 不需要改 callback-tools

Bridge 运行在 Cat Café API 进程内（或作为由 API 管理的 sidecar），由当前 invocation 驱动。它把 Antigravity 的响应流直接转成 `AgentMessage` 回流到 thread——跟 `GeminiAcpAdapter` 把 ACP promptStream 转成 AgentMessage 是完全同构的。

写操作不经过 Antigravity 的全局 MCP → 不需要给持久 MCP 加凭证 → callback-tools.ts **零改动**。

### Antigravity 全局 MCP 的范围控制

`mcp_config.json` 中注册的 Cat Café MCP Server 只保留**只读/无副作用**能力：

| 工具 | 保留 | 说明 |
|------|------|------|
| `search_evidence` | ✅ | 搜索项目知识（本地 SQLite） |
| `reflect` | ✅ | 记忆反思（本地） |
| `read_session_digest` | ✅ | 读 session 摘要（API fallback） |
| `signal_search` / `signal_list_inbox` | ✅ | 信号检索（只读） |
| `post_message` | ❌ | 写操作，由 Bridge 代发 |
| `get_pending_mentions` | ❌ | 需要 invocation 凭证 |
| `ack_mentions` | ❌ | 写操作，由 Bridge 代发 |
| `get_thread_context` | ❌ | Bridge 在 prompt 中预装 |

实现方式：MCP Server 的 tool registration 支持按配置裁剪。在 `mcp_config.json` 的 env 中加 `CAT_CAFE_READONLY=true`，MCP Server 启动时只注册只读工具。

### 多 thread 并发

```text
Thread A @antigravity → Bridge → createBackgroundSession("thread-A") → Session X
Thread B @antigravity → Bridge → createBackgroundSession("thread-B") → Session Y
Thread C @antigravity → Bridge → createBackgroundSession("thread-C") → Session Z
```

Background session 不需要 GUI 聚焦，天然并发。每个 thread 首次 @antigravity 创建 session，后续复用。

### cat-config.json 变更

```json
{
  "id": "bengal",
  "catId": "antigravity",
  ...
  "available": true,
  "variants": [{
    "id": "antigravity-gemini",
    "provider": "antigravity",
    "defaultModel": "gemini-3.1-pro",
    "mcpSupport": false,
    "bridge": {
      "type": "antigravity-hosted",
      "sdk": "antigravity-sdk",
      "transport": "connectrpc",
      "sessionStrategy": "background-per-thread"
    },
    "cli": null
  }]
}
```

`mcpSupport: false` 保持——MCP 工具不由 Cat Café 注入，而是 Antigravity 侧已有持久注册。`bridge` 替代 `cli` 作为连接配置。

### 代码改动清单

| 文件/模块 | 改动 | 行数估算 |
|-----------|------|---------|
| 新增 `providers/antigravity/AntigravityHostedService.ts` | 薄 provider，实现 AgentService | ~80 |
| 新增 `providers/antigravity/AntigravityBridge.ts` | ConnectRPC 封装 + session 映射 + 响应收集 | ~200 |
| 新增 `providers/antigravity/antigravity-event-transformer.ts` | ConnectRPC stream → AgentMessage 转换 | ~100 |
| 修改 `config/cat-config-loader.ts` | 识别 `bridge` 配置，注册 HostedService | ~30 |
| 修改 `index.ts` | boot 时创建 Bridge 实例 | ~20 |
| 删除 `providers/antigravity/AntigravityCdpClient.ts` | 349 行 DOM hack 全部干掉 | -349 |
| 重写 `providers/antigravity/AntigravityAgentService.ts` | 替换为 AntigravityHostedService | ~-163 / +80 |
| MCP Server: 支持 `CAT_CAFE_READONLY` env | 只注册只读工具 | ~15 |
| 新增 `GEMINI.md`（项目根） | Antigravity 身份 Rules + 协作指令 | ~30 |

**净变化**：删 ~500 行 CDP hack，新增 ~450 行 Bridge 实现。

---

## 开工前唯一技术前置验证

> 这不是"脚手架 Phase"，是开工前的一次性确认。

在本机跑一个 10 分钟 spike 脚本验证：
1. `antigravity-sdk` 的 `createBackgroundSession()` 是否能创建不弹 GUI 的后台 session
2. `sendPrompt(sessionId, prompt)` 是否能投递并获取流式响应
3. 并发 2 个 background session 是否稳定

如果这三个不过，D 也立不住——但这时候所有依赖 ConnectRPC 的方案（A/B/D）都立不住，退路是 C（MCP Pull）+ 等官方 ACP 支持。

---

## 附录：淘汰方案

### A. ACP 代理桥 — 淘汰

> 砚砚评价："A 不是最优雅，A 是为了复用 F149 而把 Antigravity 硬塞成 ACP。"

把 Antigravity 假装成 ACP CLI，表面"Cat Café 核心零改动"，实际上 callback auth / MCP scope / session ownership / stale policy 全是 Antigravity 特例，被塞进代理里。后面 debug 会很痛。

复用的是壳，不是语义。

### B. ConnectRPC 直连 Provider — 备选

承认 Antigravity 是特殊宿主，不假装 ACP。但如果直接把 ConnectRPC、session map、tool proxy、auth 全写进 provider，Cat Café 核心会长出一坨 Antigravity 专属逻辑，和 F143 想收敛 provider 的方向冲突。

如果 D 因技术原因不可行，可退回 B，但需把 Bridge/SDK 隔离成独立模块。

### C. MCP Pull + Agent Key — 淘汰

不满足"跟 @opus 对称"的要求。不能自动路由，需手动触发。不是最终态。

Agent Key 从主路径移除，降为 future external-agent scope（如果将来要让 Antigravity 脱离 invocation 长期自治、主动跨 thread，才需要）。

---

## 讨论参与者

| 猫 | 贡献 |
|----|------|
| 布偶猫 | 提出 A/B/C 三种方案，发现凭证断裂问题 |
| 砚砚 (GPT-5.4) | 提出方案 D（Antigravity Bridge），否决 agent key 作为终态方案，指出 A 的语义不诚实 |
| 布偶猫 | 在 D 基础上提出 Bridge-owned writeback，消除全局 MCP session routing 问题 |
| 砚砚 (GPT-5.4) | 确认 Bridge 代发为最终形态，明确 F149 复用边界（policy not wire） |
