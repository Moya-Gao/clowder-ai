# Cat Cafe 技术债务 & 待办事项

> 维护者：布偶猫 | 最后更新：2026-02-25 (F38 Skills 梳理 + 按需发现)
>
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P0 — 阻塞后续 Phase

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 38 | **Session 按 Thread 隔离** | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | Session key 从 `userId:catId` 改为 `userId:catId:threadId`，防止跨 thread 上下文污染 |
| 89 | **System Prompt / 协作说明重复注入导致 token 膨胀** | [x] | [bug report](./bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md) | PR #63 `bca8b7e` — resume-aware injection + MCP short/full split + rich block 渐进式披露 + teammates 去重 + compression detection。~73% token 节省。 |

## P1 — 必须做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 1 | MCP 统一挂载 (Codex/Gemini) | [x] | Demo 发现 | Phase 3.7 `8114d1d` + review fix `6137cc9` — McpPromptInjector HTTP callback 注入 |
| 2 | Redis ThreadStore | [x] | Phase 3.2 | Phase 3.7 `a8236bc` — RedisThreadStore + factory |
| 3 | Redis TaskStore + SummaryStore | [x] | Phase 3.5 | Phase 3.7 `1bd0eb3` — RedisTaskStore + RedisSummaryStore + factories |
| 4 | MCP 工具接入 (文件操作切 MCP Server) | [x] | Phase 2.5 | Phase 3.7 `8114d1d` + review fix `6137cc9` — 与 #1 合并, prompt 注入方式 |
| 5 | 目录浏览安全 (allowlist/blocklist) | [x] | Phase 3.2 review | Phase 3.7 `59d2d80` — PROJECT_ALLOWED_ROOTS env var |
| 6 | 多猫调用状态可观测性 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` (前端 per-cat status) + `1c3efe4` (CLI timeout 传播) |
| 37 | **消息级审计日志** | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | 新增 `CAT_INVOKED`, `CAT_RESPONDED`, `CAT_ERROR`, `A2A_HANDOFF` 事件 + prompt-digest.ts 摘要 |
| 46 | **Fail-closed storage guard** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `assertStorageReady()`: 无 Redis 且无 `MEMORY_STORE=1` → 拒绝启动。`start-dev.sh` Redis 失败 → exit 1 |
| 47 | **Persist guard (invocation 成功条件)** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `PersistenceContext` 跨 generator 传递持久化失败 → invocation 标 failed (可重试) + 前端通知。cursor ack 仅在 succeeded |
| 56 | **file_change 事件后前端失联 / 超时** | [x] | [bug report](./bug-report/file-change-event-frontend-disconnect/bug-report.md) | 根因：猫猫在主仓编辑文件触发 dev server 热更新重启导致 WS 断链。`file_change` 本身不是原因（多轮复现实验证实）。**流程规避**：CLAUDE.md §9 worktree 纪律强制隔离，执行以来未再复现。代码层面未做防御性修复（前端断线诊断仍粗糙），属已知限制。2026-02-21 关闭。 |
| 77 | **pending-mentions ack 机制** | [x] | [bug report](./archive/2026-02/bug-report/2026-02-16-pending-mentions-no-ack/bug-report.md) | `0ef1cdd` — messageId 游标 + 显式 ack + 4-way 验证 + 窗口硬校验。已合入 main。 |
| 78 | **MCP `get_thread_context` 不返回历史图片** | [x] | 铲屎官 2026-02-16 实测 | `b69fcc2` — `callbacks.ts` thread-context response map 漏传 `contentBlocks`，加回即可。存储层已正确保存图片附件，仅 API response 序列化时遗漏。回归测试已补。 |
| 83 | **`post-message` 回调路径不支持 Rich Blocks** | [x] | 2026-02-20 布偶猫排查 | `c466213` — `callbacks.ts:post-message` handler 加 `extractRichFromText`，存 cleanText + `extra.rich.blocks`，SSE 广播 `rich_block` 事件。3 new tests。已合入 main。 |
| 85 | **Rich Blocks 格式容错 + CardBlock Markdown 渲染** | [x] | 2026-02-20 铲屎官实测 + 砚砚 review | `ecc199b` — (1) CardBlock `bodyMarkdown` 改用 MarkdownContent + `disableCommandPrefix`；(2) `normalizeRichBlock` 在 `@cat-cafe/shared`，三入口共用（Route A/B/MCP tool）：`type→kind` alias + 自动 `v:1`；(3) 裸 JSON 数组全量验证（云端 P1 修复：部分匹配不提取）；(4) 提示词补 `kind≠type` 警告。105 tests pass。PR #40 已合入。 |

## P2 — 建议做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 80 | **流式草稿持久化（Streaming Draft Persistence）** | [ ] | [2026-02-17 超时复盘](./plans/2026-02-17-timeout-and-message-persistence.md) | 当前消息只在猫猫完成后持久化；streaming 阶段刷新页面消息消失。需在 streaming 阶段增量写入草稿消息，完成后合并/替换。难点：写入时机、草稿合并语义、TTL/清理、Redis 写入频率。Phase A 止血已合入 `8057aac`，Phase B 待设计实现。**计划在 F10 Phase A 中一并处理。** |
| 81 | **GitHub Review Email Watcher（自动唤醒猫猫处理 review）** | [x] | [2026-02-18 设计方案](./plans/2026-02-18-github-review-email-watcher.md) | Phase 1+2 已实现 `385f3ab`：IMAP 轮询 + 3 层路由（registry → fallback → triage）+ PR tracking API + 46 tests。砚砚 R1→R2 review 通过。Phase 3（auto-invoke, Redis impl, skill 集成）待后续。|
| 82 | **`onIntentMode` flat setter 线程切换竞态** | [x] | split-pane invocation state R1 deep review P2 | `9cfba72` — `useSocket.ts` intent_mode handler 升级为双指针 guard（route + store 必须一致），非活跃线程走 thread-scoped background path（新增 `setThreadIntentMode` / `setThreadTargetCats`）。ChatContainer 移除冗余 closure guard。模式与 agent_message 一致。 |
| 84 | **`create_rich_block` MCP 工具在非 invocation 场景不可用** | [x] | 2026-02-20 布偶猫排查 | `c466213` — `handleCreateRichBlock` 加 Route A→B 降级链：Route A (direct callback) 失败 → Route B (post_message + cc_rich text) → 两路皆败返回 cc_rich hint。5 new tests。Token 生命周期根因未改（需 session-scoped token），但降级保证可用性。已合入 main。 |
| 86 | **ImageExporter Puppeteer 进程泄漏** | [x] | 2026-02-21 铲屎官排查耗电 | `44b4530` — `thread-export.ts` 的 `process.once('SIGTERM/SIGINT')` 替换为 `fastify.addHook('onClose', ...)`，让 Puppeteer 清理跟随 Fastify 生命周期（`app.close()` 会 await 完成后再 `process.exit()`）。`sharedExporter` 从 module-level 移入 plugin scope。新增 cleanup 守护测试。 |
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
| 36 | CLI 全局配置隔离 | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | **已回退**: 隔离 HOME 方案失效 — Codex CLI 初始化覆盖 copy 的 auth/config/sessions，导致 401 + 模型回落 + resume 断裂。已删除 `cli-config-isolation.ts` + 测试，改用真实 HOME（项目级 AGENTS.md 已覆盖全局）。commit `1d8cb59`。详见 [timeline.md](./archive/2026-02/bug-report/tea-coffee/timeline.md) |
| 39 | useChatCommands 命令解析自动化测试 | [x] | Phase 5.0-S2 follow-up | Phase 5.2 — vitest + jsdom 基建 + 14 tests for isCommandInvocation |
| 40 | delivery cursor 生命周期治理 | [x] | [resume 重复发送修复](./archive/2026-02/bug-report/opus-resume-history-duplication/bug-report.md) | Phase 5.2 — TTL 86400→604800 (7天)，长期键自然过期 |
| 41 | Gemini CLI 回答后 `candidates` 收尾崩溃跟踪 | [x] | [Gemini post-response crash](./archive/2026-02/bug-report/gemini-cli-post-response-candidates-crash/bug-report.md) | 2026-02-09 上游 `google-gemini/gemini-cli#18621` 已关闭（completed），`#18656` 已合并；2026-02-10 本地 `stream-json` 连续 3 次复测无崩溃，关闭该跟踪项 |
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
| 66 | 布偶猫权限申请不弹窗（MCP callback 未挂载） | [x] | 2026-02-12 铲屎官反馈 | 2026-02-12 缅因猫完成：`ClaudeAgentService` 自动解析默认 MCP 路径 + `start-dev.sh` 构建 `mcp-server` 并导出 `CAT_CAFE_MCP_SERVER_PATH`，补充 `claude-agent-service` 与 `start-dev-script` 回归测试。 |
| 67 | Hindsight discussion 例外导入机制（`hindsight: include`） | [x] | ADR-005 附录 C + P0.5 边界 | `fe47e85` + `5794e07` — 白名单导入 + review P2 follow-ups。已合入 main。 |
| 68 | ADR 历史否决理由回填（批量） | [x] | ADR-005 附录 C | `83dc22d` — 6 历史 ADR 否决理由回填。已合入 main。 |
| 69 | Hindsight 周评测流水线（precision/noise/staleness） | [ ] | P0 Plan Task 5 | 建立自动周评测与阈值告警，避免 recall 质量劣化无感发生。 |
| 70 | workspace 全量 build 阻塞（packages/web lint/type） | [x] | 2026-02-13 Task 5 验证 | 2026-02-13 缅因猫完成：清理 4 处 `no-unused-vars`（`ChatContainer.tsx`, `RightStatusPanel.tsx`, `useSplitPaneKeys.test.ts`, `useChatHistory.ts`），`pnpm -r --if-present run build` 恢复通过。 |
| 71 | Hindsight 最新性保障（freshness guard） | [x] | 2026-02-14 #68/#69 收口讨论 | `f90a1c4` + `eec372b` — full freshness fail-closed guard + dedupe parsers。已合入 main。 |
| 72 | **F24: 手动绑定 Session + 前端入口（铲屎官兜底能力）** | [x] | [session-not-found bug](./archive/2026-02/bug-report/2026-02-14-claude-session-not-found-after-a2a-abort/bug-report.md) | **API** `5d158ae` — `PATCH /api/threads/:threadId/sessions/:catId/bind` 端点（带审计）。**前端** `4e85883` — `SessionChainPanel` bind 输入框 UI。 |
| 73 | **A2A Stop 按钮 UX 改进** | [x] | [2026-02-14 情人节聊天](./archive/2026-02/mailbox/2026-02-14/2026-02-14-valentines-day-cat-chat-meeting-minutes.md) | 三个修复方向均已完成：**(1)** callback A2A 同步前端 loading (`0a1b1da`)；**(2)** `hasActiveInvocation` 状态 + Stop 按钮常驻显示；**(3)** ParallelStatusBar Stop 按钮。缅因猫 R3 放行，commit `2ccc87c`。 |
| 74 | **Hindsight 临时停用（等 GPT Pro 调研）** | [~] | 2026-02-14 预评测数据质量复盘 | 已新增全局开关 `HINDSIGHT_ENABLED`（commit `8876677`）：关闭后 evidence/reflect/callback retain 不再调用 Hindsight，改为 docs fallback 或 skipped；并已停本地 Hindsight 容器避免 token 消耗。待 GPT Pro 结论后再决定恢复策略与 #69 评测时点。 |
| 75 | **pending-mentions 跨线程泄漏** | [x] | [情人节聊天 bug](./archive/2026-02/bug-report/2026-02-14-pending-mentions-cross-thread-leak/bug-report.md) | `a822296` — getMentionsFor 增加 threadId 过滤 + 暄罗语音别名 + 4 tests (内存/Redis/API)。暹罗猫 R1 + 缅因猫 R2 放行。 |
| 76 | **cancel_invocation 反馈 catId 硬编码为 opus** | [x] | [情人节聊天 bug](./archive/2026-02/bug-report/2026-02-14-cancel-catid-hardcoded-opus/bug-report.md) | `af9bfb7` — InvocationTracker 追踪 catIds + CancelResult + buildCancelMessages 纯函数 + 14 tests。暹罗猫 R1 + 缅因猫 R2 放行。 |

## P3 — 可选优化

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 22 | blob URL 同 thread 连发大量图累积 | [x] | Phase 3.3b review | Phase 5.2 — addMessage 增量 revoke (MAX_BLOB_MESSAGES=200) |
| 23 | 冷/热状态视觉反馈 (猫头像发光) | [x] | 暹罗猫提议 | 已实现：`CatAvatar` 在 `streaming` 状态启用 glow + `animate-pulse`，并由 `ChatMessage` 流式状态驱动。 |
| 24 | Antigravity cancel 无效 (detached 进程) | [~] | Phase 3.3b review | 已接通信号链路：`messages` 将 AbortSignal 传入执行链，`GeminiAgentService(antigravity)` 在 abort 时 `process.kill(-pid, SIGTERM)`；待补一条实机 cancel 验证后可转 `[x]`。 |
| 25 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包，Docker MCP 可让猫管理容器；开发阶段脚本够用 |
| 26 | Gemini/Codex resume 作为补充 context 源 | [x] | Phase 3.6 决策 2 | Phase 5.2 调研结论: Codex 已支持 UUID resume ✅; Gemini v0.27.2 仍只支持 index/latest, 无 UUID resume, 现由 ContextAssembler 提供上下文 |
| 27 | 导出格式 locale 依赖 | [x] | Phase 3.6 交接 OQ | 改用 `formatDatetime()` 固定 YYYY-MM-DD HH:mm 格式 |
| 28 | A2A mention 与 AgentRouter.parseMentions 逻辑重复 | [x] | Phase 3.9 | 已澄清设计意图：用户消息用 indexOf (宽松)，猫回复用行首匹配 (严格防误触) |
| 29 | A2A 悄悄话折叠 UI | [x] | 暹罗猫建议 | 已实现：`A2ACollapsible` + `ChatContainer` 按 `a2aGroupId` 分组折叠，默认"查看内部讨论"。 |
| 30 | /config context 数字误导 | [x] | Phase 3.9 缅因猫 review P2 | Phase 4.0 Step 2 — perCatBudgets 显示实际值，context 段标注 deprecated |
| 51 | ~~Codex 隔离 HOME 固定路径并发冲突~~ | [x] | F16 review P3 | 已关闭：隔离 HOME 方案已废弃 (BACKLOG #36 重开 → 删除隔离)，此项自动解决。 |
| 52 | callbackToken 出现在 query string | [ ] | F16 review P3 | Why: 与现有 callback GET 鉴权方式保持兼容。风险边界：token 可能出现在 access log / proxy cache。触发条件：引入网关或外部代理前，迁移到 header 鉴权或改为 POST。 |
| 57 | Claude CLI partial flag 版本兼容检查 | [x] | 2026-02-11 Opus review P2 建议 | 关闭：铲屎官 CLI 保持最新 (v2.1.39+)，无需兼容旧版。 |
| 62 | Whisper 模型选择 small → large-v3-turbo | [x] | Voice Input M1 open question | `fb51e1f` — mlx-whisper 迁移，默认 `mlx-community/whisper-large-v3-turbo`，Metal GPU 加速 |
| 63 | Whisper 服务集成到 start-dev.sh | [x] | Voice Input M1 open question | `ae99da9` — start-dev.sh 自动启动 Whisper ASR 服务 |
| 58 | 补充无 message_start 的 delta 场景测试 | [ ] | 2026-02-11 Opus review P2 建议 | Why: 现有逻辑在 `currentMessageId` 为空时仍会输出 text_delta，但缺少显式回归测试。风险边界：后续重构可能误改该容错行为。触发条件：下次触达 `ClaudeAgentService` 流式逻辑时，优先补此测试并转为 [x]。 |
| 64 | 删除废弃的 `ExportImageButton.tsx` | [x] | F17b review P3 | 已删除，无引用确认。 |
| 65 | `ChatInputMenus.tsx:23` RefObject 类型错误 | [x] | F17b review P3 | `RefObject<HTMLDivElement | null>` → `RefObject<HTMLDivElement>` 与 useRef 返回类型对齐。 |
| 59 | ~~ChatInput.tsx 超 200 行~~ | [x] | Voice Input M1 review | `23a5c30` — 302 → 176 行。提取 ChatInputActionButton + ChatInputMenus + chat-input-options。 |
| 60 | ~~useVoiceInput 测试覆盖不足~~ | [x] | Voice Input M1 review | `8e11f96` + `23a5c30` — 2 → 20 tests (MockMediaRecorder + streaming + 竞态回归)。 |
| 61 | ~~whisper-api.py 健壮性~~ | [x] | Voice Input M1 开发 | `4343a66` — 25MB 限制/空文件/503/logging/SIGTERM/model load exit(1)。 |
| 79 | archive 内部互引旧路径未更新 | [ ] | WT-4 docs archive R2 | `docs/archive/2026-02/` 内历史文档互相引用仍用归档前路径（如 `docs/discussions/...`）。60+ 处，不影响活跃文档。触发条件：如需给 archive 生成静态站点或可点击链接时再批量修。 |
| 87 | sources-loader "does not rewrite" 测试强化 mtime/spy | [ ] | source-sync 缅因猫 R1 P3-1 | 当前 `signal-sources-loader.test.js` 的"no rewrite"断言仅比较文件内容；无法区分"未写盘"和"写盘但内容相同"。可用 `fs.statSync().mtimeMs` 或 write spy 强化。触发条件：下次改 sources-loader 写盘逻辑时一并补。 |
| 88 | Redis PushSubscriptionStore upsert TOCTOU race | [ ] | C1+C2 云端 Codex review P3 | `hget(previousUserId)` 在 `MULTI` 外面，并发同一 endpoint 的 owner 变更有理论竞态。实际场景需同一设备两个用户同时订阅，概率极低。修复需 Lua 脚本原子化。触发条件：引入多用户并发订阅场景时。 |
| 90 | Codex 压缩检测 1 轮空窗（启发式盲区） | [ ] | [压缩检测讨论](./discussions/2026-02-24-compression-detection-cross-provider/README.md) | 当前检测是反应式：Codex 压缩发生在本轮，re-injection 在下一轮才生效，中间有 1 轮身份空窗。升级方向：持久化 prevFill / preflight context snapshot / 等 Codex CLI 支持独立 system prompt slot。实际影响有限，观察到事故再升级。 |

## P1 — 必须做（新增）

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 92 | **Skills Lifecycle Hardening（发布流程补全）** | [x] | [设计文档](./plans/2026-02-23-skills-lifecycle-hardening.md) | PR #68 (`c5ce356`)。(M1) 挂载 `using-rich-blocks` + `using-mcp-callbacks` 三猫 symlink；(M2) `writing-skills` 补 Cat Café 发布 Checklist；(M3) `check:skills` 双向校验（源目录 ↔ BOOTSTRAP.md）+ worktree-aware 路径解析。21/21 全绿。 |
| 91 | **ContextAssembler 截断丢失消息结尾关键信息** | [x] | [bug report](./bug-report/2026-02-24-context-assembler-truncation-loses-conclusion/bug-report.md) | 修复：(A) `formatMessage()` 改为 head(40%)+tail(60%) 保留 + `[...truncated N chars...]` 标记；(B) `route-helpers.ts` 增量路径改用 `getCatContextBudget(catId).maxContentLengthPerMsg` 替代硬编码 2000。 |

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
| F8 | ~~Token 预算 + 深度可观测性~~ | **[x]** | [NDJSON 宝藏调研](./archive/2026-02/research/cli-ndjson-treasure-map.md) | 全部完成：char→token 迁移 (js-tiktoken, 16 files) + 三猫 CLI usage/cost/cache 捕获 + 前端 RightStatusPanel per-cat token 显示 + ParallelStatusBar 聚合 + inputTokens 归一化 (`da75aaf`) + review fix (`e8d1dbd`)。commits: `66a59e4`→`6f25a2b`→`e8d1dbd` |
| F9 | tool_use/tool_result 事件显示 | [x] | Phase 5 拍板发现 | 5.0-pre: useAgentMessages 新增 tool_use/tool_result handler + ChatMessage 'tool' variant |
| F10 | 手机端猫猫 | P1 (#5) | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | **路线图**：[`2026-02-20-mobile-cat-roadmap.md`](./plans/2026-02-20-mobile-cat-roadmap.md)。决策：PWA 先行（两猫独立思考共识 + 铲屎官确认）。Phase A PWA 手机化 → B TTS/Voice Block → C 推送 → D 原生壳（如需要）。关联：F20/F22/F34。参考 [Happy](https://happy.engineering/) + [OpenClaw](https://openclaw.ai/) |
| F11 | **模式系统** | **[x]** | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 开发自闭环 / 头脑风暴 / 辩论三种模式 + 可扩展。6 轮 review 通过，939 tests。[攻防录](../tmp/f11-maine-log.md) |
| F12 | 功能可发现性 | **[x]** | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | `43f88ca` + `7b03236` — Cat Café Hub modal（功能注册表 + 环境摘要 + /hub 命令）。已合入 main。 |
| F13 | 审计日志 v2 | [x] | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 已完成：操作审计（追责）+ CLI 原始日志归档（debug）。计划文档: [`2026-02-10-f13-audit-log-v2.md`](./archive/2026-02/plans/2026-02-10-f13-audit-log-v2.md) |
| F14 | **SVG 猫猫状态动画** | P2 | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 把 ASCII `ᓚᘏᗢ` 升级为三猫参数化 SVG 动画。方案 B（AI 生成 + 结构化 + CSS 动画）已确认。调研报告+执行计划: [`svg-frontend-research.md`](./archive/2026-02/research/svg-frontend-research.md#7-执行计划2026-02-13-布偶猫--铲屎官讨论确认) |
| F15 | Backlog 管理 | P3 (#7) | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 功能想法不散落在手机备忘录。本次讨论即 MVP 实践 |
| F16 | ~~Codex OAuth + 记忆闭环~~ | [x] | [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | Phase F16：Codex 默认走 OAuth（隔离 HOME 下 `auth.json`/`sessions` 与真实 `~/.codex` 打通），并新增 invocation-token 保护的 `search-evidence` / `reflect` / `retain-memory` callback + MCP 对应工具，形成缅因猫记忆闭环。计划见 [`2026-02-10-f16-codex-oauth-memory-loop.md`](./plans/2026-02-10-f16-codex-oauth-memory-loop.md)。 |
| F17 | ~~导出对话长图~~ | [x] | [ux-polish 2026-02-10](./archive/2026-02/discussions/2026-02-10-ux-polish-brainstorm/README.md) | Chrome headless 导出。缅因猫 3 轮 review 通过（R1 路径 + R2 安全/构建/性能 + R3 system thread）。设计: [`2026-02-10-f19-f18-f17-ux-polish.md`](./plans/2026-02-10-f19-f18-f17-ux-polish.md) |
| F18 | ~~工具栏收起+滚动~~ | [x] | [ux-polish 2026-02-10](./archive/2026-02/discussions/2026-02-10-ux-polish-brainstorm/README.md) | 可收起/展开，收起时 2s 滚动 + fade-in 动画。缅因猫 review 通过。 |
| F19 | ~~动态累积计时器~~ | [x] | [ux-polish 2026-02-10](./archive/2026-02/discussions/2026-02-10-ux-polish-brainstorm/README.md) | useElapsedTime hook (100ms)，顶部 + 右侧面板动态显示。缅因猫 review 通过。 |
| F20 | **语音输入 M1 MVP** | **[x]** | 铲屎官需求 2026-02-11 | 麦克风录音 → 本地 Whisper ASR → 术语纠错 → 填入 textarea → 手动发送。动态按钮 (🎤/▶/⏹/⏳)。缅因猫 2 轮 review 通过 (P1 安全边界 + P1 启动入口 + P2 stream 泄露)。设计: [`2026-02-11-voice-input-design.md`](./archive/2026-02/plans/2026-02-11-voice-input-design.md)，commit `965b569` |
| F20b | ~~语音输入 M2 — 流式转写~~ | **[x]** | Voice Input design | `1ec0910` + `23a5c30` — requestData() 轮询 + partialTranscript + streamSeqRef 竞态保护。 |
| F20c | **cat-cafe-whisper 系统级语音输入** | **[x]** | Voice Input design + 铲屎官 2026-02-15 | 已独立实现为 relay-station 平级项目（非 cat-cafe 子包）。macOS 全局热键（⌥Space）+ Whisper 转写 + 术语纠正 + 打字到任意 app。 |
| F20d | ~~语音术语自助配置 UI~~ | **[x]** | 铲屎官 2026-02-15 | CatCafeHub "语音设置" tab：可编辑术语纠正表 + initial_prompt 编辑 + 语言选择。内置词典 + localStorage 用户自定义合并。计划: [`2026-02-15-voice-accuracy-and-system-whisper.md`](./plans/2026-02-15-voice-accuracy-and-system-whisper.md) Phase B |
| F21 | **Signal Hunter 集成** | **[x]** | [讨论 2026-02-12](./archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md) | 每日自动抓取 AI 技术信源 + 邮件日报 + 和猫猫深度学习。合并 Signal Hunter 到 Cat Café，launchd 定时 + 50+ 信源 + on/off 开关 + Hindsight 洞察存储。计划: [`2026-02-12-signal-hunter-integration.md`](./plans/2026-02-12-signal-hunter-integration.md)，缅因猫调研: [`signal-hunter.md`](./archive/2026-02/research/signal-hunter.md)。S1~S6 全部完成，缅因猫多轮 review 放行。信源补全 3→45 源 + 手动 Fetch 端点 + GitHub PAT 自动注入。已全部合入 main。 |
| F32 | **Agent Plugin Architecture（CatId 松绑 + AgentRegistry）** | **P1** | [讨论 2026-02-18](./discussions/2026-02-18-f32-agent-plugin-architecture/README.md) | 开源前地基。CatId 从编译时 `Brand<'opus'\|'codex'\|'gemini'>` 改为运行时 `Brand<string>` + AgentRegistry 动态注册。分两期：F32-a 核心松绑（PR #29 `aa6ed6d`）、F32-b 配置驱动+多 variant 多实例+mention 冲突防护+AgentService 参数化。**F32-b Phase 1 后端基建完成**（PR #44 `a87afb3`），**Phase 2 线程级选择完成**（PR #46 `d25c1a1`），**Phase 3 前端动态化完成**（PR #52）— useCatData hook + buildCatOptions/buildWhisperOptions 分流 + ThreadCatSettings UI + 509 tests。**Phase 4 布偶猫军团完成** — 4a ChatMessage 动态化 + 4b Variant 消歧义 + 4d 硬编码清理 (McpPromptInjector/TaskExtractor/useChatCommands/SystemPromptBuilder/DeliveryCursorStore/breedId configs) + 4c Schema 扩展 (per-variant avatar/color) + Sonnet variant 上线 + findBreedByMention longest-match-first + 50 config-loader tests + 513 web tests。R21-R29 缅因猫 review (9 轮)。设计: [`2026-02-18-f32a-agent-registry-design.md`](./plans/2026-02-18-f32a-agent-registry-design.md), [`2026-02-21-f32-model-configurability.md`](./plans/2026-02-21-f32-model-configurability.md) |
| F33 | **Session Chain 策略可配置化** | **P1** | 2026-02-18 PR #29 事故反思 → 2026-02-21 铲屎官扩展方向 | Session Chain 的阈值和策略（handoff/compress/hybrid）per-cat 可配置。**Phase 1 完成**（PR #71）：`SessionStrategyConfig` + `shouldTakeAction()` 三策略决策 + `invoke-single-cat` 策略驱动 + `session-hooks` 策略感知 + `compressionCount` 追踪 + atomic Lua CAS。**Phase 2 完成**：`catFeaturesSchema` 扩展 sessionStrategy + `getConfigSessionStrategy()` 接通 cat-config.json + `seal-thresholds.ts` 合并删除 + `SessionChainPanel` compressionCount 展示 + 71 tests。Phase 3 待做：实战调优。设计: [`2026-02-21-f33-session-strategy-configurability.md`](./plans/2026-02-21-f33-session-strategy-configurability.md)（砚砚 R3 放行）。 |
| F22 | **Rich Blocks 富消息系统** | **[x]** | [SillyTavern 调研](./archive/2026-02/research/sillytavern-phone-ui-research.md) | `bd8ae63` PR #34 — 全栈实现：4 种 block kind (card/diff/checklist/media_gallery) + 双路由 (MCP callback + cc_rich text) + RichBlockBuffer (invocationId 绑定 + dedup + post-completion 拒绝) + Zod discriminatedUnion 入口验证 + isValidRichBlock 全字段类型守卫 + 前端 5 组件 + 50 tests。7 轮 cloud review + 砚砚本地 R1-R7。 |
| F34 | **Voice Block 语音消息** | **[x]** | 2026-02-18 铲屎官+三猫讨论 | 两期全部完成：**F34-a TTS 基建** — Python TTS service (edge-tts) + cat-voices 配置 + TtsProviderRegistry + TtsCacheCleaner + `/api/tts/*` 路由 + 前端 AudioBlock + useTts hook + ChatMessage 朗读按钮。**F34-b 语音消息** — 猫猫主动 `{kind:'audio', text:'...'}` → VoiceBlockSynthesizer 自动合成 → 微信风格语音条。三路 whitespace 防御 (Route A guard + Route B isValidRichBlock trim + Synthesizer trim)。砚砚 R9→R12 (4 轮) 放行。设计: [`2026-02-21-f34b-voice-message.md`](./plans/2026-02-21-f34b-voice-message.md) |
| F35 | **Whisper 消息可见性（悄悄话）** | **[x]** | 2026-02-19 独立思考测试 → 三方共识 | `8223a60` + `d12d3f1` + `7b7194e` — 消息级 `visibility: 'public' \| 'whisper'` + `whisperTo: CatId[]` + 线程级揭秘（reveal）+ whisper 内容防泄漏（incremental fallback injection）+ 并行 whisper 隐私回归测试。已合入 main。设计: [`2026-02-19-f35-whisper-message-visibility.md`](./plans/2026-02-19-f35-whisper-message-visibility.md) |
| F36 | **Logo 一笔画动画（Stroke Drawing Animation）** | **P3** | 2026-02-22 视频 Logo 讨论 | 视频 Logo 用 `stroke-dashoffset` 做真正的"笔尖游走"线条生长效果。**当前阻塞**：(1) AI（Pencil MCP）画出来像"发芽土豆+球星飞船"🥔🚀，完全不能用；(2) `autotrace -centerline` 输出太杂乱（~13 段分离路径 + 内部交叉线）。**需要**：人工 Inkscape 手动描摹干净 stroke 路径，或等 AI 绘画能力提升。**当前替代方案**：clip-path reveal 动画（circle/wipe/bottom-up），见 `assets/icons/logo-animation-demo.html`。 |
| F23 | **目录结构防腐化 + 重构 + 代码检查工具链** | **[x]** | 铲屎官 2026-02-13 | PR #21 (`d366ad5`) — 5 WT 全部合入 main。87 files → 7 子目录 + ~690 imports 迁移 + 5 大文件拆分。防腐化门禁 `pnpm check:dir-size` + `pnpm check:deps`。Biome v2.4 + LSP + JetBrains MCP 全部启用。routes 目录有 `.dir-exceptions.json` 例外到 2026-04-01。ADR: [`010-directory-hygiene-anti-rot.md`](./decisions/010-directory-hygiene-anti-rot.md) |
| F37 | **Agent Swarm 协同模式** | **[~] P1** | [2026-02-24 讨论](./discussions/2026-02-24-multi-agent-swarm-meeting-notes.md) | 四猫 + 铲屎官讨论 multi-agent 协同方式借鉴。8 个 feat 拆解（4.5 初版 + 4.6 补充 + 铲屎官反馈）。**追溯链**：[Feat 拆解（入口）](./discussions/agent-swarm-feats.md) → [会议纪要](./discussions/2026-02-24-multi-agent-swarm-meeting-notes.md) → [调研报告](./research/2026-02-24-multi-agent-comparison/)。核心共识：Swarm 是阶段性工具（Research+Brainstorm），决策权漏斗模式，Mode 系统需从机械模板转向柔性引导。 |
| F38 | **Skills 梳理 + 按需发现机制** | **P3** | [skills 调研 2026-02-25](./discussions/2026-02-25-f38-skills-discovery/README.md) | **当前**：方向 A（分类标记），skill bug 已修（项目级 `.claude/skills/` symlinks `5257e1c`）。**未来**：方向 B（类 ToolSearch 延迟加载，BM25/regex，触发条件 skills 50+）。ToolSearch 不用向量数据库，用 BM25 词频排序。铲屎官决策：simple is better, build when you need。 |
| F21++ | **Signal Study Mode（深度学习伴侣）** | **P1** | [feat 采访 2026-02-26](./plans/2026-02-26-f21-study-mode-design.md) | F21 从 RSS 阅读器升级为学习伴侣：双入口触发 Study + 文章上下文自动注入 + 深度笔记归档 + 播客生成（复用 F34 TTS）+ 多猫研究（复用 F-Swarm-1）+ Signal Hunter 迁移。10 个需求 (R1-R10)，11 轮 feat 采访确认。设计: [`2026-02-26-f21-study-mode-design.md`](./plans/2026-02-26-f21-study-mode-design.md) |
| F24 | **中途消息注入 + Context 存活监控 + 自动交接** | **[x]** | 铲屎官 2026-02-13 | 三个子能力全部完成：**(1) 中途消息注入** [x]：`4e85883` ChatInputActionButton 改为 hasActiveInvocation 时同时展示 Stop + Send 按钮。**(2) Context 存活监控** [x]：`fcf949d` SessionChainPanel + ContextHealthBar。**(3) 自动交接触发** [x]：`3772cd9` SessionSealer + per-cat seal thresholds + hook 注入。 |
| F25 | **可靠性工程（状态机规格 + 并发演练 + 证据闸门）** | **[x]** | [2026-02-14 情人节聊天](./archive/2026-02/mailbox/2026-02-14/2026-02-14-valentines-day-cat-chat-meeting-minutes.md) | PR #21 (`d366ad5`) — 三件事全部完成：(1) `4ab5b47` 状态机规格 + fast-check property tests；(2) `7340176` 并发演练 + evidence gate；(3) 竞态守护。1327 tests 全绿。 |
| F31 | **PR 双层 Review 流程（本地猫 + 云端猫）** | **[x]** | 2026-02-14 铲屎官提议 | ✅ 已完成：本地猫 review（`cat-cafe-requesting-review`/`cat-cafe-receiving-review` skill）+ 云端 Codex review（`requesting-cloud-review` skill）+ SOP.md Step 5 阻塞规则。双层 Review 流程已在 PR #6/#8 中实践，SOP 已修正云端 review 为阻塞守护（非异步）。 |
| F30 | **消息代码块复制按钮 + 文件路径可跳转** | **[x]** | 2026-02-14 铲屎官提议 | ✅ `9ffd972` + R1 fix `70e8321`, PR #6. CodeBlock 复制按钮 + linkifyFilePaths vscode:// 链接. |
| ~~F29~~ | ~~**删除右面板"任务统计"死区 + TaskExtractor 清理**~~ | ~~**P2**~~ | ✅ `e532ab4` + `9ebb93f` | 右面板"任务统计"永远是 0——TaskExtractor 从对话文本提取 `- [ ]` / `TODO:` 标记，但猫猫实际用 CLI 工具 (TaskCreate/write_todos) 管理任务，两套系统不搭。删除：RightStatusPanel 的任务统计 section + taskSummary prop + ChatContainer taskSummary 计算。TaskExtractor 后端逻辑（TaskStore/fetchTasks）暂保留给 sidebar 毛线球用；前端右面板的任务展示由 **F26 的实时 task 进度**取代（放在每只猫的调用卡片里）。 |
| F28 | **授权请求跨渠道通知** | **[x]** | 2026-02-14 铲屎官提议 | ✅ `b98230f` + R1 fix `70e8321`, PR #6. Desktop Notification + Tab flash + header badge + pulse animation. 计划: [`2026-02-14-f28-authorization-cross-channel-notification.md`](./plans/2026-02-14-f28-authorization-cross-channel-notification.md) |
| F27 | **A2A 路径统一 — 两条路合一 + 全链可取消 + 多 mention** | **[x]** | 2026-02-14 铲屎官亲历 | `ae873cd` — callback enqueue to worklist，统一单路径 + 共享 AbortController + 多目标 mention。已合入 main。Bug report: [`2026-02-14-a2a-feedback-loop`](./archive/2026-02/bug-report/2026-02-14-a2a-feedback-loop/bug-report.md) |
| F26 | **UI Dashboard Upgrade — 右面板重构 + 实时计划进度** | **[x]** | 2026-02-14 铲屎官提议 | ✅ `f59740f` + R1 fix `70e8321`, PR #6. RightStatusPanel active/history 分区 + CatTaskProgress checklist + invoke-single-cat task 提取. 计划: [`2026-02-14-ui-dashboard-upgrade.md`](./archive/2026-02/plans/2026-02-14-ui-dashboard-upgrade.md) |

## 讨论议题 — 待探索的方向

> 这里记录值得深入讨论但还没形成具体需求的话题。

| # | 议题 | 来源 | 备注 |
|---|------|------|------|
| D1 | Google A2A 协议为何没成标准？ | 铲屎官洞察 🐬 | Agent 调用 Agent 的方式：API / MCP / 我们的 @机制？各有什么优劣？ |
| D2 | 上下文工程方向选择 | 四方圆桌 | Layer 1/2 (索引) vs Layer 4 (调度) 的投入优先级 |
| D3 | 可维护性法则提炼 | 圆桌设计 | Cat Café 做对了什么？如何迁移到其他项目？详见 `docs/archive/2026-02/discussions/2026-02-09-dare-framework/maintainability-roundtable-design.md` |

## 已知限制（非 bug，需意识到）

| 项目 | 严重度 | 缓解方案 |
|------|--------|----------|
| **`cache_creation` 计入总输入的语义风险** | 低 | 当前 `extractClaudeUsage` 将 `cache_creation_input_tokens` 计入 `inputTokens` 总量以统一口径（`da75aaf`）。若产品定义改动（如 Anthropic 调整 cache_creation 计费语义），需按同一语义整体调整归一化逻辑。来源：砚砚 2026-02-13 review 残余说明。 |


| 项目 | 严重度 | 缓解方案 |
|------|--------|----------|
| **Token 输入口径与 CLI 原始 input_tokens 存在差异** | 低 | 当前 UI `inputTokens` 采用"统一口径总输入"（会合并 cache read/create），用于跨 provider 对齐；因此可能与 CLI resume 页面展示的原始 `input_tokens` 不完全一致。已在最近调用卡片补充"缓存命中/上下文占用"标签降低误解。若要 1:1 对齐 CLI 原始口径，后续需新增 raw 字段并并列展示。 |
| CLI 启动开销 ~500ms-2s | 中 | 可考虑进程池 |
| NDJSON 格式可能随 CLI 升级变化 | 中 | 版本锁定 + 容错解析 |
| **Claude/Gemini 图片输入当前为 prompt 路径 fallback（非原生多模态）** | 中 | `claude --images` 与 `gemini -p + -i` 在现版本不兼容，已改为将图片绝对路径附加到 prompt 避免 CLI 启动失败。详见 [bug report](./bug-report/cli-image-flags-mismatch/bug-report.md)。后续若要恢复原生读图，需要改接 provider 支持的正式图片协议并补集成验证。 |
| Antigravity MCP 回传可能无响应 | 中 | gemini-cli fallback |
| **Codex CLI 全局配置可覆盖会话规则** | 中 | Session 跨 thread 污染已修 (#38)。全局 `AGENTS.md` 在有项目级 `AGENTS.md` 的项目中不生效。HOME 隔离方案已废弃 (BACKLOG #36)。详见 [timeline.md](./archive/2026-02/bug-report/tea-coffee/timeline.md) |
| **私有 `MEMORY.md` 不在 Git，无法仓库内审计** | 中 | `~/.claude/projects/` 下的私有记忆仅作个人上下文恢复，不作为团队事实源。所有会影响协作决策的信息必须同步落盘到仓库文档（`docs/mailbox/`、`docs/decisions/`、`docs/plans/`）并附 commit 锚点。 |

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
| #77 pending-mentions ack 机制 | 2026-02-17 审计确认 | `0ef1cdd` |
| #67 Hindsight discussion 例外导入 | 2026-02-17 审计确认 | `fe47e85` + `5794e07` |
| #68 ADR 否决理由回填 | 2026-02-17 审计确认 | `83dc22d` |
| #71 Hindsight freshness guard | 2026-02-17 审计确认 | `f90a1c4` + `eec372b` |
| F12 Cat Café Hub 功能可发现性 | 2026-02-17 审计确认 | `43f88ca` + `7b03236` |
| F23 目录防腐化 + 重构 | PR #21 | `d366ad5` |
| F25 可靠性工程 | PR #21 | `d366ad5` |
| F27 A2A 路径统一 | 2026-02-17 审计确认 | `ae873cd` |
| #72 F24 手动绑定 Session 前端 UI | feat/f24-mid-inject-and-bind-ui | `4e85883` |
| F24 中途消息注入 (最后一个子能力) | feat/f24-mid-inject-and-bind-ui | `4e85883` |
| #83 Rich Blocks post-message 路径 | 2026-02-20 审计确认 | `c466213` |
| #84 create_rich_block 降级链 | 2026-02-20 审计确认 | `c466213` |
| F35 Whisper 消息可见性（悄悄话） | 2026-02-20 审计确认 | `8223a60` + `d12d3f1` + `7b7194e` |
| #81 GitHub Review Email Watcher (Phase 1+2) | 2026-02-24 砚砚 R2 放行 | `385f3ab` |

</details>
