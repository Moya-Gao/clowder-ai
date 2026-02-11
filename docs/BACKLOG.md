# Cat Cafe 技术债务 & 待办事项

> 维护者：布偶猫 | 最后更新：2026-02-10 (新增 F17/F18/F19 UX 体验优化三件套；F11 已完成 6 轮 review 合入；F13 已完成；F16 完成 OAuth + 记忆闭环)
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
| 46 | **Fail-closed storage guard** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `assertStorageReady()`: 无 Redis 且无 `MEMORY_STORE=1` → 拒绝启动。`start-dev.sh` Redis 失败 → exit 1 |
| 47 | **Persist guard (invocation 成功条件)** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `PersistenceContext` 跨 generator 传递持久化失败 → invocation 标 failed (可重试) + 前端通知。cursor ack 仅在 succeeded |
| 56 | **file_change 事件后前端失联 / 超时** | [~] | [bug report](./bug-report/file-change-event-frontend-disconnect/bug-report.md) | Why: 证据显示 `file_change completed` 后紧接服务重启与前端失联。风险边界：当前调试会话可能在首次文件编辑后断链。触发条件：完成最小复现（含 ws close reason）并确认前端/后端根因后再关闭。 |

## P2 — 建议做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 7 | 上下文预算管理 (token 截断) | [x] | 身份注入讨论 | Phase 3.7 `999a775` — maxTotalChars + MAX_PROMPT_CHARS env |
| 8 | 单猫 @mention 无加载提示 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` — ThinkingIndicator 组件 |
| 9 | 前端图片压缩 | [x] | Phase 3.2 review | Phase 5.2 — compressImage.ts Canvas API 压缩 (maxWidth=1920, sweep 0.8→0.3) |
| 10 | 对话级联删除 | [x] | Phase 3.2 review | `523d9f0` — Promise.allSettled cascade 删除 messages/tasks/memory |
| 11 | cancel_invocation 真正鉴权 | [x] | Phase 3.3b review | Phase 3.7 `0c3d318` — userId 追踪 + 校验 |
| 12 | 取消后显示"已取消"标记 | [x] | Phase 3.3b review | Phase 4.0 Step 4 `f379b67` — system_info 事件 + "⏹ 已取消" |
| 13 | cats.ts TODO: 从 Redis 获取猫状态 | [x] | 代码 TODO | 已澄清：猫状态通过 WebSocket 实时推送，API 为未来预留 |
| 14 | sendMessageSchema 语义归属 | [x] | Phase 3.5 Step 0 review | Phase 4.0 Step 0 — 迁到 `messages.schema.ts` |
| 15 | AgentRouter.ts 超 200 行 (379行) | [x] | Phase 3.5 Step 3 | Phase 3.7 `122ff12` — 379→209行, 提取 route-strategies.ts |
| 16 | ChatContainer.tsx 超 200 行 (297行) | [x] | Phase 3.5 final review | Phase 4.0 Step 3 — 拆分为 useChatHistory/useChatCommands/useSendMessage hooks |
| 17 | Invocation 新入口必须传 threadId | [x] | Phase 3.5 缅因猫 review | 已文档化：AgentRouter.ts + messages.ts 头部说明约束 |
| 18 | isFinal 丢失防护 | [x] | Phase 3.5 缅因猫 final review | Phase 4.0 Step 5 `f379b67` — 5 分钟 timeout + 30s heartbeat |
| 19 | 自动讨论纪要生成 | [x] | Phase 3.5 计划 stretch | `16496b8` — AutoSummarizer 已实现 (pattern matching)，createdBy=system，历史回放已修复 |
| 20 | start-dev.sh Redis 失败分支无自动化测试 | [x] | Phase 3.6 缅因猫 review | Phase 3.7 `b8d4313` — test-start-dev.sh |
| 21 | 消息发送到不存在的 threadId 会产生孤儿消息 | [x] | 辩论测试发现 | Phase 5.2 — 400 拒绝 + code=THREAD_NOT_FOUND，前端解析 detail 显示中文提示 |
| 31 | /api/memory 与 /api/commands 身份/权限边界 | [x] | Phase 4.0 缅因猫 review P2-1 | 2026-02-10 缅因猫完成：`commands/memory` 接入 `resolveUserId` + thread ownership guard（header 优先、缺失 401、越权 403），commit `69ad9a9` |
| 32 | DegradationPolicy 绑定实际链路 | [x] | Phase 4.0 缅因猫 review P2-2 | 5.0-pre: routeSerial/routeParallel 调用 checkContextBudget → yield system_info |
| 33 | TaskExtractor prompt/解析鲁棒性 | [x] | Phase 4.0 缅因猫 review P2-3 | `8e0ba93` — normalizeSourceIndex 处理 number/string/msg-N 格式 |
| 34 | cascade delete 语义边界文档 | [x] | Quick wins 缅因猫 review P2-1 | Phase 5.2 — ADR `docs/decisions/007-cascade-delete-semantics.md` |
| 35 | thread 删除与 invocation 竞态 | [x] | Quick wins 缅因猫 review P2-2 | Phase 5.2 — 409 ACTIVE_INVOCATION 保护 + InvocationTracker 注入 |
| 36 | CLI 全局配置隔离 | [x] | [茶话会夺魂 bug](./bug-report/tea-coffee/bug-report.md) | 已闭环：`2a6c7d4` 引入隔离 HOME + 不复制 AGENTS，后续 `81fa2bf`/`fb134b6` 完善稳健性（顺带修复 sessions 兼容） |
| 39 | useChatCommands 命令解析自动化测试 | [x] | Phase 5.0-S2 follow-up | Phase 5.2 — vitest + jsdom 基建 + 14 tests for isCommandInvocation |
| 40 | delivery cursor 生命周期治理 | [x] | [resume 重复发送修复](./bug-report/opus-resume-history-duplication/bug-report.md) | Phase 5.2 — TTL 86400→604800 (7天)，长期键自然过期 |
| 41 | Gemini CLI 回答后 `candidates` 收尾崩溃跟踪 | [x] | [Gemini post-response crash](./bug-report/gemini-cli-post-response-candidates-crash/bug-report.md) | 2026-02-09 上游 `google-gemini/gemini-cli#18621` 已关闭（completed），`#18656` 已合并；2026-02-10 本地 `stream-json` 连续 3 次复测无崩溃，关闭该跟踪项 |
| 42 | Branch 回滚 best-effort 双失败容错 | [x] | ADR-008 S7 缅因猫 R3 review | 2026-02-10 缅因猫完成：回滚清理改为 sync/async failure-safe + background orphan reconciliation retries（`CAT_BRANCH_ROLLBACK_RETRY_DELAYS_MS`）；review 跟进补充 reconcile 外层 try/catch 防 unhandled rejection，commit `bd69629` + `f3b743e` |
| 44 | **Codex exec 模式不保存 session → 缅因猫无法 resume** | [x] | 2026-02-10 实测发现 | 已闭环：根因是隔离 HOME 导致 sessions 写入 `/tmp`；`449fe91` + `81fa2bf` + `fb134b6` 通过 `sessions/` symlink 与回归测试修复 |
| 45 | **缅因猫动态授权 + git 写入权限** | [x] | [bug report](./bug-report/dynamic-authorization-and-git-commit-blocked/bug-report.md) | 2026-02-10 缅因猫完成：Codex CLI callback 模式支持可配置 sandbox/approval（`CAT_CODEX_SANDBOX_MODE` / `CAT_CODEX_APPROVAL_POLICY`，默认 `danger-full-access` + `on-request`），并纳入 `/api/config` 热更新；解除 `.git` 写入阻塞，commit `bd69629` |
| 46 | **授权系统 Redis 持久化** | [x] | 缅因猫 review P1 | RedisAuthorizationRuleStore + RedisPendingRequestStore + RedisAuthorizationAuditStore + 3 factories，28 Redis tests 全绿 |
| 43 | 身份入口统一（header 优先）与 URL 脱敏 | [x] | feat/ux-polish review P2 | `2aa54b6` — `resolveUserId` 扩展到 messages/threads，前端 apiFetch + `X-Cat-Cafe-User` header 取代 URL query |
| 48 | **MCP callback at-least-once 投递** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：`clientMessageId` 幂等去重（API）+ 指数退避重试（MCP，默认 1s/2s/4s，可 env 覆盖），commit `69ad9a9` |
| 49 | **MCP callback local outbox** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：`post-message` 失败入本地 outbox（文件队列）+ 后续调用自动回放重试，4xx 毒消息丢弃避免无限重试；review 跟进补充 `CAT_CAFE_CALLBACK_OUTBOX_MAX_FLUSH_BATCH`（批次上限）+ `CAT_CAFE_CALLBACK_OUTBOX_MAX_ATTEMPTS`（老化清理），commit `595a14f` + `f3b743e` |
| 50 | **消息持久化故障演练测试** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：新增持久化故障演练集成测试（故障显式失败 + 恢复后 retry 转绿）；review 跟进将固定 sleep 改为 `waitFor` 轮询，降低 CI flaky 风险，commit `69ad9a9` + `f3b743e` |
| 53 | callback-tools.ts 超 200 行拆分 | [x] | Rebase 冲突复核 follow-up | 2026-02-10 缅因猫完成：将 retry/outbox 逻辑从 `callback-tools.ts` 提取为 `callback-retry.ts` + `callback-outbox.ts`，`callback-tools.ts` 降到 161 行，commit `1ec2811` |
| 54 | F16 控制面行为接通（Task 3） | [x] | F16 Hindsight Config review | 2026-02-10 缅因猫完成：evidence/reflect/callback 路由统一读取运行时配置（recall defaults + reflect disposition），并补齐 RED→GREEN 回归测试闭环。 |
| 55 | F16 配置变更审计（Task 6） | [x] | F16 Hindsight Config review | 2026-02-10 缅因猫完成：`PATCH /api/config` 写入 `config_updated` 审计事件（key/old/new/operator/source/timestamp），`/api/config/runtime-status` 补充 source 元数据。 |

## P3 — 可选优化

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 22 | blob URL 同 thread 连发大量图累积 | [x] | Phase 3.3b review | Phase 5.2 — addMessage 增量 revoke (MAX_BLOB_MESSAGES=200) |
| 23 | 冷/热状态视觉反馈 (猫头像发光) | [ ] | 暹罗猫提议 | CSS class 切换，低成本；与 P1 #6 可观测性相关 |
| 24 | Antigravity cancel 无效 (detached 进程) | [ ] | Phase 3.3b review | gemini-cli fallback 可选 |
| 25 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包，Docker MCP 可让猫管理容器；开发阶段脚本够用 |
| 26 | Gemini/Codex resume 作为补充 context 源 | [x] | Phase 3.6 决策 2 | Phase 5.2 调研结论: Codex 已支持 UUID resume ✅; Gemini v0.27.2 仍只支持 index/latest, 无 UUID resume, 现由 ContextAssembler 提供上下文 |
| 27 | 导出格式 locale 依赖 | [x] | Phase 3.6 交接 OQ | 改用 `formatDatetime()` 固定 YYYY-MM-DD HH:mm 格式 |
| 28 | A2A mention 与 AgentRouter.parseMentions 逻辑重复 | [x] | Phase 3.9 | 已澄清设计意图：用户消息用 indexOf (宽松)，猫回复用行首匹配 (严格防误触) |
| 29 | A2A 悄悄话折叠 UI | [ ] | 暹罗猫建议 | A2A 链中间对话可折叠（"查看内部讨论"），减少信息过载 |
| 30 | /config context 数字误导 | [x] | Phase 3.9 缅因猫 review P2 | Phase 4.0 Step 2 — perCatBudgets 显示实际值，context 段标注 deprecated |
| 51 | Codex 隔离 HOME 固定路径并发冲突 | [ ] | F16 review P3 | Why: 当前以单实例部署优先，先保证 OAuth 连续性。风险边界：同机并发实例可能互相覆盖隔离目录内容。触发条件：出现多实例/并发 CI 运行时，改为 invocation-scoped 隔离目录 + 文件锁。 |
| 52 | callbackToken 出现在 query string | [ ] | F16 review P3 | Why: 与现有 callback GET 鉴权方式保持兼容。风险边界：token 可能出现在 access log / proxy cache。触发条件：引入网关或外部代理前，迁移到 header 鉴权或改为 POST。 |

## Feature Requests — 新功能需求

> 区别于技术债务：这里是"想做的新功能"，不是"应该做好但没做好的"。

| # | 功能 | 优先级 | 来源 | 描述 |
|---|------|--------|------|------|
| F1 | ~~配置可见性~~ | [x] | 铲屎官洞察 🐬 | Phase 3.9 `6a671ac` — ConfigRegistry + GET /api/config + `/config` chat command |
| F2 | ~~Agent-to-Agent 调用 (A2A)~~ | [x] | 铲屎官洞察 🐬 | Phase 3.9 `7a519b9` — worklist 链式调用 + parseA2AMentions + a2a_handoff 前端显示 |
| F3 | ~~显式记忆 (F3-lite)~~ | [x] | Phase 4.0 计划 | Phase 4.0 Step 6 `25ca123` — /remember /recall 命令 + MemoryStore |
| F3b | 协作记忆 (Hindsight 集成) | [x] | 上下文工程讨论 | Phase 5.0 全完成: HindsightClient + Evidence 路由 + 治理状态机 + /evidence /reflect /approve /archive 前端命令 + MCP evidence/reflect 工具 + anchor 验证。567 tests |
| F4 | 配置运行时修改 | [x] | Phase 3.9 | Phase 5.2 — PATCH /api/config + ConfigStore overlay + `/config set` 前端命令。567 tests |
| F5 | ideate 模式 A2A follow-up | [x] | Phase 3.9 | Phase 5.2 — routeParallel 完成后 yield a2a_followup_available system_info + 前端 a2a_followup variant 显示 |
| F6 | ~~Thread 名字编辑~~ | [x] | 功能性试用 | `81939c1` — PATCH /api/threads/:id 更新标题 + 前端编辑 UI |
| F7 | ~~Thread 名字检索~~ | [x] | 功能性试用 | `81939c1` — GET /api/threads?q= 大小写不敏感搜索 |
| F8 | 猫工作状态实时显示 | P1 | 功能性试用 | 已有基础可见性：顶部并行状态条 + 右侧状态栏（模式/猫状态/消息任务统计）。待补全：token/耗时等深度指标，才可关闭。 |
| F9 | tool_use/tool_result 事件显示 | [x] | Phase 5 拍板发现 | 5.0-pre: useAgentMessages 新增 tool_use/tool_result handler + ChatMessage 'tool' variant |
| F10 | 手机端猫猫 | P1 (#5) | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 参考 [Happy](https://happy.engineering/) + [OpenClaw](https://openclaw.ai/) 做多猫版移动端。iOS app / iMessage 对接待决策 |
| F11 | **模式系统** | **[x]** | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 开发自闭环 / 头脑风暴 / 辩论三种模式 + 可扩展。6 轮 review 通过，939 tests。[攻防录](../tmp/f11-maine-log.md) |
| F12 | 功能可发现性 | P1 (#3) | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | magic word / MCP skill / 配置统一可视化入口。找不到的功能 = 不存在 |
| F13 | 审计日志 v2 | [x] | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 已完成：操作审计（追责）+ CLI 原始日志归档（debug）。计划文档: [`2026-02-10-f13-audit-log-v2.md`](./plans/2026-02-10-f13-audit-log-v2.md) |
| F14 | 动画优化 | P3 (#6) | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | UI 过渡动画 + 流式回复体验，铲屎官确认优先级低 |
| F15 | Backlog 管理 | P3 (#7) | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 功能想法不散落在手机备忘录。本次讨论即 MVP 实践 |
| F16 | ~~Codex OAuth + 记忆闭环~~ | [x] | [brainstorm 2026-02-10](./discussions/2026-02-10-feature-backlog-brainstorm/README.md) | Phase F16：Codex 默认走 OAuth（隔离 HOME 下 `auth.json`/`sessions` 与真实 `~/.codex` 打通），并新增 invocation-token 保护的 `search-evidence` / `reflect` / `retain-memory` callback + MCP 对应工具，形成缅因猫记忆闭环。计划见 [`2026-02-10-f16-codex-oauth-memory-loop.md`](./plans/2026-02-10-f16-codex-oauth-memory-loop.md)。 |
| F17 | 导出对话长图 | P2 (#3) | [ux-polish 2026-02-10](./discussions/2026-02-10-ux-polish-brainstorm/README.md) | 前端按钮一键导出对话为 PNG 长图，支持全量/range 选择。Chrome headless 方案已验证可行。 |
| F18 | 工具栏收起+滚动 | P2 (#2) | [ux-polish 2026-02-10](./discussions/2026-02-10-ux-polish-brainstorm/README.md) | 工具调用栏可收起，收起时滚动显示最新工具调用 + 动态指示。参考 Claude Code/Codex thinking 效果。 |
| F19 | 动态累积计时器 | P1 (#1) | [ux-polish 2026-02-10](./discussions/2026-02-10-ux-polish-brainstorm/README.md) | 运行中显示动态累积时间（0.0s → 0.1s → ...），顶部状态栏可见多猫。让铲屎官安心。 |

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
| Thread 名字编辑 (PATCH /api/threads/:id) | `81939c1` merge | - |
| Thread 名字检索 (GET /api/threads?q=) | `81939c1` merge | - |
| tool_use/tool_result 事件显示 | 5.0-pre | `08f1284` |
| 协作记忆 F3b (Hindsight 全链路) | Phase 5.0 | `8aa8f32`→`5ad35bc` |
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
| #34 cascade delete 语义 ADR | Phase 5.2 | Step 1 |
| #22 blob URL 增量 revoke | Phase 5.2 | Step 1 |
| #21 孤儿消息 400 拒绝 | Phase 5.2 | Step 2 |
| #35 thread 删除 409 保护 | Phase 5.2 | Step 2 |
| #40 delivery cursor TTL 7d | Phase 5.2 | Step 2 |
| #9 前端图片压缩 | Phase 5.2 | Step 3 |
| #39 useChatCommands vitest | Phase 5.2 | Step 3 |
| F5 A2A follow-up 提示 | Phase 5.2 | Step 4 |
| F4 配置热更新 PATCH | Phase 5.2 | Step 5 |
| #26 Gemini resume 调研关闭 | Phase 5.2 | Step 6 |
| #46 Fail-closed storage guard | fix/fail-closed-storage | `d24780c` |
| #47 Persist guard (invocation 成功条件) | fix/fail-closed-storage | `32763cb` |

</details>
