# Cat Cafe 技术债务 & 待办事项

> 维护者：布偶猫 | 最后更新：2026-02-08 (茶话会夺魂 bug 侦查)
>
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P0 — 阻塞后续 Phase

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 38 | **Session 按 Thread 隔离** | [x] | [茶话会夺魂 bug](./bug-report/tea-coffee/bug-report.md) | Session key 从 `userId:catId` 改为 `userId:catId:threadId`，防止跨 thread 上下文污染 |

## P1 — 必须做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 1 | MCP 统一挂载 (Codex/Gemini) | [x] | Demo 发现 | Phase 3.7 `8114d1d` + review fix `6137cc9` — McpPromptInjector HTTP callback 注入 |
| 2 | Redis ThreadStore | [x] | Phase 3.2 | Phase 3.7 `a8236bc` — RedisThreadStore + factory |
| 3 | Redis TaskStore + SummaryStore | [x] | Phase 3.5 | Phase 3.7 `1bd0eb3` — RedisTaskStore + RedisSummaryStore + factories |
| 4 | MCP 工具接入 (文件操作切 MCP Server) | [x] | Phase 2.5 | Phase 3.7 `8114d1d` + review fix `6137cc9` — 与 #1 合并, prompt 注入方式 |
| 5 | 目录浏览安全 (allowlist/blocklist) | [x] | Phase 3.2 review | Phase 3.7 `59d2d80` — PROJECT_ALLOWED_ROOTS env var |
| 6 | 多猫调用状态可观测性 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` (前端 per-cat status) + `1c3efe4` (CLI timeout 传播) |
| 37 | **消息级审计日志** | [x] | [茶话会夺魂 bug](./bug-report/tea-coffee/bug-report.md) | 新增 `CAT_INVOKED`, `CAT_RESPONDED`, `CAT_ERROR`, `A2A_HANDOFF` 事件 + prompt-digest.ts 摘要 |

## P2 — 建议做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 7 | 上下文预算管理 (token 截断) | [x] | 身份注入讨论 | Phase 3.7 `999a775` — maxTotalChars + MAX_PROMPT_CHARS env |
| 8 | 单猫 @mention 无加载提示 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` — ThinkingIndicator 组件 |
| 9 | 前端图片压缩 | [ ] | Phase 3.2 review | 当前 10MB/张直传 |
| 10 | 对话级联删除 | [x] | Phase 3.2 review | `523d9f0` — Promise.allSettled cascade 删除 messages/tasks/memory |
| 11 | cancel_invocation 真正鉴权 | [x] | Phase 3.3b review | Phase 3.7 `0c3d318` — userId 追踪 + 校验 |
| 12 | 取消后显示"已取消"标记 | [x] | Phase 3.3b review | Phase 4.0 Step 4 `f379b67` — system_info 事件 + "⏹ 已取消" |
| 13 | cats.ts TODO: 从 Redis 获取猫状态 | [x] | 代码 TODO | 已澄清：猫状态通过 WebSocket 实时推送，API 为未来预留 |
| 14 | sendMessageSchema 语义归属 | [x] | Phase 3.5 Step 0 review | Phase 4.0 Step 0 — 迁到 `messages.schema.ts` |
| 15 | AgentRouter.ts 超 200 行 (379行) | [x] | Phase 3.5 Step 3 | Phase 3.7 `122ff12` — 379→209行, 提取 route-strategies.ts |
| 16 | ChatContainer.tsx 超 200 行 (297行) | [x] | Phase 3.5 final review | Phase 4.0 Step 3 — 拆分为 useChatHistory/useChatCommands/useSendMessage hooks |
| 17 | Invocation 新入口必须传 threadId | [x] | Phase 3.5 缅因猫 review | 已文档化：AgentRouter.ts + messages.ts 头部说明约束 |
| 18 | isFinal 丢失防护 | [x] | Phase 3.5 缅因猫 final review | Phase 4.0 Step 5 `f379b67` — 5 分钟 timeout + 30s heartbeat |
| 19 | 自动讨论纪要生成 | [ ] | Phase 3.5 计划 stretch | 当前 summary 仅手动 API 创建，后续可调 opus 自动总结 |
| 20 | start-dev.sh Redis 失败分支无自动化测试 | [x] | Phase 3.6 缅因猫 review | Phase 3.7 `b8d4313` — test-start-dev.sh |
| 21 | 消息发送到不存在的 threadId 会产生孤儿消息 | [ ] | 辩论测试发现 | 前端应先 POST /api/threads；需要 ThreadStore.createWithId() 或严格校验 |
| 31 | /api/memory 与 /api/commands 身份/权限边界 | [ ] | Phase 4.0 缅因猫 review P2-1 | 当前依赖 threadId 不可猜；多用户需统一 userId 来源 |
| 32 | DegradationPolicy 绑定实际链路 | [ ] | Phase 4.0 缅因猫 review P2-2 | 目前是 framework only；需绑定至少一个 user-facing system_info |
| 33 | TaskExtractor prompt/解析鲁棒性 | [x] | Phase 4.0 缅因猫 review P2-3 | `8e0ba93` — normalizeSourceIndex 处理 number/string/msg-N 格式 |
| 34 | cascade delete 语义边界文档 | [ ] | Quick wins 缅因猫 review P2-1 | best-effort 策略需写入 docs/decisions；强语义需后台重试或 tombstone |
| 35 | thread 删除与 invocation 竞态 | [ ] | Quick wins 缅因猫 review P2-2 | delete thread 是否 cancel invocation？append 前是否检查 thread 存在？ |
| 36 | CLI 全局配置隔离 | [ ] | [茶话会夺魂 bug](./bug-report/tea-coffee/bug-report.md) | Codex CLI `~/.codex/AGENTS.md` 会覆盖会话规则。需调研：1) `--no-global-agents` flag 2) 独立配置目录 `CODEX_CONFIG_DIR` 3) 会话规则优先级声明 |

## P3 — 可选优化

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 22 | blob URL 同 thread 连发大量图累积 | [ ] | Phase 3.3b review | clearMessages 时已回收，但不切 thread 会累积 |
| 23 | 冷/热状态视觉反馈 (猫头像发光) | [ ] | 暹罗猫提议 | CSS class 切换，低成本；与 P1 #6 可观测性相关 |
| 24 | Antigravity cancel 无效 (detached 进程) | [ ] | Phase 3.3b review | gemini-cli fallback 可选 |
| 25 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包，Docker MCP 可让猫管理容器；开发阶段脚本够用 |
| 26 | Gemini/Codex resume 作为补充 context 源 | [ ] | Phase 3.6 决策 2 | prompt prepend 跑稳后，resume 减少 token 开销；Gemini index 问题需等 CLI 支持 UUID |
| 27 | 导出格式 locale 依赖 | [x] | Phase 3.6 交接 OQ | 改用 `formatDatetime()` 固定 YYYY-MM-DD HH:mm 格式 |
| 28 | A2A mention 与 AgentRouter.parseMentions 逻辑重复 | [x] | Phase 3.9 | 已澄清设计意图：用户消息用 indexOf (宽松)，猫回复用行首匹配 (严格防误触) |
| 29 | A2A 悄悄话折叠 UI | [ ] | 暹罗猫建议 | A2A 链中间对话可折叠（"查看内部讨论"），减少信息过载 |
| 30 | /config context 数字误导 | [x] | Phase 3.9 缅因猫 review P2 | Phase 4.0 Step 2 — perCatBudgets 显示实际值，context 段标注 deprecated |

## Feature Requests — 新功能需求

> 区别于技术债务：这里是"想做的新功能"，不是"应该做好但没做好的"。

| # | 功能 | 优先级 | 来源 | 描述 |
|---|------|--------|------|------|
| F1 | ~~配置可见性~~ | [x] | 铲屎官洞察 🐬 | Phase 3.9 `6a671ac` — ConfigRegistry + GET /api/config + `/config` chat command |
| F2 | ~~Agent-to-Agent 调用 (A2A)~~ | [x] | 铲屎官洞察 🐬 | Phase 3.9 `7a519b9` — worklist 链式调用 + parseA2AMentions + a2a_handoff 前端显示 |
| F3 | ~~显式记忆 (F3-lite)~~ | [x] | Phase 4.0 计划 | Phase 4.0 Step 6 `25ca123` — /remember /recall 命令 + MemoryStore |
| F3b | 协作记忆 (Hindsight 集成) | P2 | 上下文工程讨论 | **重大澄清 (2026-02-08)**: Hindsight 是**已存在的外部服务**（Docker），不需要自己开发！铲屎官本地已部署。见 `docs/mailbox/2026-02-08-hindsight-clarification-to-maine.md`。剩余工作：1) HTTP 客户端封装 2) Bank 设计 (cat-cafe-shared 等) 3) MCP 工具复用 pangu-doer 版本 |
| F4 | 配置运行时修改 | P3 | Phase 3.9 | PATCH /api/config 热更新部分配置 (如 maxDepth, timeout) 无需重启 |
| F5 | ideate 模式 A2A follow-up | P2 | Phase 3.9 | 并行模式下猫 @其他猫不会触发 A2A（设计如此），铲屎官反馈这不符合预期。需要：1) 前端提示"并行模式不支持 A2A" 2) 或实现队列机制让并行后能 follow-up |
| F6 | Thread 名字编辑 | P2 | 功能性试用 | 自定义/编辑 thread 名字，方便未来查找 |
| F7 | Thread 名字检索 | P3 | 功能性试用 | 从名字 filter/搜索历史对话 |
| F8 | 猫工作状态实时显示 | P1 | 功能性试用 | 前端显示：工具调用、thinking、耗时、token 消耗等。参考 Claude Code 的 token 计数 + 耗时显示。当前 UX 极差（辩论时铲屎官等得难受）|
| F9 | tool_use/tool_result 事件显示 | P1 | Phase 5 拍板发现 | **Bug**: `useAgentMessages.ts` 没有处理 `tool_use` 和 `tool_result`，导致用户等待时看不到猫猫在做什么。后端有发，前端丢弃了。见 `docs/decisions/005-hindsight-integration-decisions.md` |

## 讨论议题 — 待探索的方向

> 这里记录值得深入讨论但还没形成具体需求的话题。

| # | 议题 | 来源 | 备注 |
|---|------|------|------|
| D1 | Google A2A 协议为何没成标准？ | 铲屎官洞察 🐬 | Agent 调用 Agent 的方式：API / MCP / 我们的 @机制？各有什么优劣？ |
| D2 | 上下文工程方向选择 | 四方圆桌 | Layer 1/2 (索引) vs Layer 4 (调度) 的投入优先级 |
| D3 | 可维护性法则提炼 | 圆桌设计 | Cat Café 做对了什么？如何迁移到其他项目？详见 `docs/discussions/2026-02-07-context-enginnering/maintainability-roundtable-design.md` |

## 已知限制（非 bug，需意识到）

| 项目 | 严重度 | 缓解方案 |
|------|--------|----------|
| CLI 启动开销 ~500ms-2s | 中 | 可考虑进程池 |
| NDJSON 格式可能随 CLI 升级变化 | 中 | 版本锁定 + 容错解析 |
| Antigravity MCP 回传可能无响应 | 中 | gemini-cli fallback |
| **Codex CLI 全局配置可覆盖会话规则** | 高 | `~/.codex/AGENTS.md` 含 `<EXTREMELY_IMPORTANT>` 优先级极高。详见 [茶话会夺魂 bug](./bug-report/tea-coffee/bug-report.md) |

## 已完成项（归档）

<details>
<summary>点击展开</summary>

| 项目 | 完成于 | Commit |
|------|--------|--------|
| 身份注入 (SystemPromptBuilder) | Phase 3.3 | `cace330` |
| 猫配置外置 `cat-config.json` | Phase 3.5 Step 1 | `bab9fcf` |
| 循环依赖 (socketManager 注入) | Phase 3a | - |
| AgentRouter 错误处理 | Phase 3a | - |
| Session 迁移 Redis | Phase 3a | - |
| requestId → InvocationTracker | Phase 3.3b | `ae7bbc2` |
| 消息铭牌 (MetadataBadge) | Phase 3.3 | `d273c7e` |
| 图片显示 (contentBlocks + blob URL) | Phase 3.3b | `823cb8d` |
| 自动命名 (首消息截断 30 字) | Phase 3.3b | `efa8259` |
| InvocationTracker 竞态修复 | Phase 3.3b R1 | `ee53b66` |
| 前端 fetch non-2xx 检查 | Phase 3.3b R1 | `ee53b66` |
| cancel 房间约束 | Phase 3.3b R1 | `ee53b66` |
| blob URL clearMessages 回收 | Phase 3.3b R1 | `ee53b66` |
| Path traversal 修复 | Phase 3.2 review | `5a6d678` |
| 默认 thread 全局广播修复 | Phase 3.2 review | `5a6d678` |
| 跨线程 Task 鉴权缺口 | Phase 3.5 缅因猫 review | `1633815` |
| SummaryCard createdBy 显示 bug | Phase 3.5 final review | `bb10eb1` |
| taskStore upsert 补全 | Phase 3.5 final review | `bb10eb1` |
| fetchTasks 初始加载 + 线程切换 | Phase 3.5 final review | `bb10eb1` |
| done/error handler size===0 误触发 | Phase 3.5 final review | `445ec34` |
| 跨猫 Context Assembly (ContextAssembler) | Phase 3.6 Step 1 | `1930372` |
| SystemPrompt 诚实规则 (不确定说不知道) | Phase 3.6 Step 2 | `d697316` |
| Redis 自动启动 (start-dev.sh) | Phase 3.6 Step 3 | `58a45ee` |
| Gemini resume 注释更新 (调研结论) | Phase 3.6 Step 0 | `e92d5a0` |
| 聊天记录导出 Markdown (export route) | Phase 3.6 Step 4 | `1c48089` |
| ContextAssembler Error: 误过滤修复 | Phase 3.6 R1 | `7810f3b` |
| start-dev.sh set -e 安全修复 | Phase 3.6 R1 | `7810f3b` |
| projectPath 目录存在性校验 | Phase 3.2 review → 3.5 | `validateProjectPath()` |
| MCP 统一挂载 (Codex/Gemini) | Phase 3.7 | `8114d1d` |
| Redis ThreadStore | Phase 3.7 | `a8236bc` |
| Redis TaskStore + SummaryStore | Phase 3.7 | `1bd0eb3` |
| MCP 工具接入 (prompt 注入) | Phase 3.7 | `8114d1d` |
| 目录浏览安全 (PROJECT_ALLOWED_ROOTS) | Phase 3.7 | `59d2d80` |
| 上下文预算管理 (maxTotalChars) | Phase 3.7 | `999a775` |
| cancel_invocation userId 鉴权 | Phase 3.7 | `0c3d318` |
| AgentRouter 拆分 (379→209行) | Phase 3.7 | `122ff12` |
| start-dev.sh Redis 回退测试 | Phase 3.7 | `b8d4313` |
| MCP 端点+鉴权修复 (缅因猫 review P1) | Phase 3.7 R1 | `6137cc9` |
| MCP prompt 注入 E2E 集成测试 | Phase 3.7 R1 | `6e42cd7` |
| CLI 超时错误传播 (__cliTimeout) | Phase 3.8 | `1c3efe4` |
| 上下文 per-message 限制 500→1500 | Phase 3.8 | `a0bfddc` |
| 多猫状态可观测性 (ParallelStatusBar) | Phase 3.8 | `180bd1a` |
| 单猫思考指示器 (ThinkingIndicator) | Phase 3.8 | `180bd1a` |
| 配置可见性 (ConfigRegistry + /config) | Phase 3.9 | `6a671ac` |
| A2A 猫猫互调 (worklist chain) | Phase 3.9 | `7a519b9` |
| A2A 前端显示 (a2a_handoff info msg) | Phase 3.9 | `e7cc2ff` |
| Per-cat 上下文预算 (cat-budgets.ts) | Phase 4.0 Step 1-2 | - |
| ChatContainer 拆分 (hooks) | Phase 4.0 Step 3 | - |
| system_info + 取消反馈 | Phase 4.0 Step 4 | `f379b67` |
| Done timeout + heartbeat | Phase 4.0 Step 5 | `f379b67` |
| 显式记忆 F3-lite (/remember /recall) | Phase 4.0 Step 6 | `25ca123` |
| /tasks extract 4-A MVP | Phase 4.0 Step 7 | `fe5f528` |
| DegradationPolicy 降级框架 | Phase 4.0 Step 8 | `b2bcc23` |
| Deliberate 两轮制类型预埋 | Phase 4.0 Step 9 | `552385e` |
| cat-config.json 默认路径稳定 | Phase 4.0 R1 | `af80d41` |
| routeParallel append 失败降级 | Phase 4.0 R1 | `af80d41` |

</details>
