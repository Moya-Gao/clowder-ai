---
feature_ids: []
topics: [tech, debt]
doc_kind: note
created: 2026-02-26
---

# Cat Cafe 技术债务
> 维护者：三猫 | 最后更新：2026-03-28
> 来源：由原 `docs/BACKLOG.md` 债务段拆分。
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P0 — 阻塞后续 Phase

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD038 | **Session 按 Thread 隔离** | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | Session key 从 `userId:catId` 改为 `userId:catId:threadId`，防止跨 thread 上下文污染；commit `adc368e` |
| TD089 | **System Prompt / 协作说明重复注入导致 token 膨胀** | [x] | [bug report](./bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md) | PR #63 `bca8b7e` — resume-aware injection + MCP short/full split + rich block 渐进式披露 + teammates 去重 + compression detection。~73% token 节省。 |

## P1 — 必须做

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD001 | MCP 统一挂载 (Codex/Gemini) | [x] | Demo 发现 | Phase 3.7 `8114d1d` + review fix `6137cc9` — McpPromptInjector HTTP callback 注入 |
| TD002 | Redis ThreadStore | [x] | Phase 3.2 | Phase 3.7 `a8236bc` — RedisThreadStore + factory |
| TD003 | Redis TaskStore + SummaryStore | [x] | Phase 3.5 | Phase 3.7 `1bd0eb3` — RedisTaskStore + RedisSummaryStore + factories |
| TD004 | MCP 工具接入 (文件操作切 MCP Server) | [x] | Phase 2.5 | Phase 3.7 `8114d1d` + review fix `6137cc9` — 与 #1 合并, prompt 注入方式 |
| TD005 | 目录浏览安全 (allowlist/blocklist) | [x] | Phase 3.2 review | Phase 3.7 `59d2d80` — PROJECT_ALLOWED_ROOTS env var |
| TD006 | 多猫调用状态可观测性 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` (前端 per-cat status) + `1c3efe4` (CLI timeout 传播) |
| TD037 | **消息级审计日志** | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | 新增 `CAT_INVOKED`, `CAT_RESPONDED`, `CAT_ERROR`, `A2A_HANDOFF` 事件 + prompt-digest.ts 摘要；commit `adc368e` |
| TD046 | **Fail-closed storage guard** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `assertStorageReady()`: 无 Redis 且无 `MEMORY_STORE=1` → 拒绝启动。`start-dev.sh` Redis 失败 → exit 1，commit `fad73e7` |
| TD047 | **Persist guard (invocation 成功条件)** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | `PersistenceContext` 跨 generator 传递持久化失败 → invocation 标 failed (可重试) + 前端通知。cursor ack 仅在 succeeded，commit `32763cb` |
| TD056 | **file_change 事件后前端失联 / 超时** | [x] | [bug report](./bug-report/file-change-event-frontend-disconnect/bug-report.md) | 根因：猫猫在主仓编辑文件触发 dev server 热更新重启导致 WS 断链。`file_change` 本身不是原因（多轮复现实验证实）。**流程规避**：CLAUDE.md §9 worktree 纪律强制隔离，执行以来未再复现。代码层面未做防御性修复（前端断线诊断仍粗糙），属已知限制。2026-02-21 关闭，commit `7489158`。 |
| TD077 | **pending-mentions ack 机制** | [x] | [bug report](./archive/2026-02/bug-report/2026-02-16-pending-mentions-no-ack/bug-report.md) | `0ef1cdd` — messageId 游标 + 显式 ack + 4-way 验证 + 窗口硬校验。已合入 main。 |
| TD078 | **MCP `get_thread_context` 不返回历史图片** | [x] | 铲屎官 2026-02-16 实测 | `b69fcc2` — `callbacks.ts` thread-context response map 漏传 `contentBlocks`，加回即可。存储层已正确保存图片附件，仅 API response 序列化时遗漏。回归测试已补。 |
| TD083 | **`post-message` 回调路径不支持 Rich Blocks** | [x] | 2026-02-20 布偶猫排查 | `c466213` — `callbacks.ts:post-message` handler 加 `extractRichFromText`，存 cleanText + `extra.rich.blocks`，SSE 广播 `rich_block` 事件。3 new tests。已合入 main。 |
| TD085 | **Rich Blocks 格式容错 + CardBlock Markdown 渲染** | [x] | 2026-02-20 铲屎官实测 + 砚砚 review | `ecc199b` — (1) CardBlock `bodyMarkdown` 改用 MarkdownContent + `disableCommandPrefix`；(2) `normalizeRichBlock` 在 `@cat-cafe/shared`，三入口共用（Route A/B/MCP tool）：`type→kind` alias + 自动 `v:1`；(3) 裸 JSON 数组全量验证（云端 P1 修复：部分匹配不提取）；(4) 提示词补 `kind≠type` 警告。105 tests pass。PR #40 已合入。 |
| TD091 | **ContextAssembler 截断丢失消息结尾关键信息** | [x] | [bug report](./bug-report/2026-02-24-context-assembler-truncation-loses-conclusion/bug-report.md) | 修复：(A) `formatMessage()` 改为 head(40%)+tail(60%) 保留 + `[...truncated N chars...]` 标记；(B) `route-helpers.ts` 增量路径改用 `getCatContextBudget(catId).maxContentLengthPerMsg` 替代硬编码 2000。commit `970648e` |
| TD092 | **Skills Lifecycle Hardening（发布流程补全）** | [x] | [设计文档](./plans/2026-02-23-skills-lifecycle-hardening.md) | PR #68 (`c5ce356`)。(M1) 挂载 `using-rich-blocks` + `using-mcp-callbacks` 三猫 symlink；(M2) `writing-skills` 补 Cat Café 发布 Checklist；(M3) `check:skills` 双向校验（源目录 ↔ BOOTSTRAP.md）+ worktree-aware 路径解析。21/21 全绿。 |

## P2 — 建议做

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD007 | 上下文预算管理 (token 截断) | [x] | 身份注入讨论 | Phase 3.7 `999a775` — maxTotalChars + MAX_PROMPT_CHARS env |
| TD008 | 单猫 @mention 无加载提示 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` — ThinkingIndicator 组件 |
| TD009 | 前端图片压缩 | [x] | Phase 3.2 review | Phase 5.2 — compressImage.ts Canvas API 压缩 (maxWidth=1920, sweep 0.8→0.3)；commit `a953aad` |
| TD010 | 对话级联删除 | [x] | Phase 3.2 review | `523d9f0` — Promise.allSettled cascade 删除 messages/tasks/memory |
| TD011 | cancel_invocation 真正鉴权 | [x] | Phase 3.3b review | Phase 3.7 `0c3d318` — userId 追踪 + 校验 |
| TD012 | 取消后显示"已取消"标记 | [x] | Phase 3.3b review | Phase 4.0 Step 4 `f379b67` — system_info 事件 + "⏹ 已取消" |
| TD013 | cats.ts TODO: 从 Redis 获取猫状态 | [x] | 代码 TODO | 已澄清：猫状态通过 WebSocket 实时推送，API 为未来预留 |
| TD014 | sendMessageSchema 语义归属 | [x] | Phase 3.5 Step 0 review | Phase 4.0 Step 0 — 迁到 `messages.schema.ts`；commit `6b77e7f` |
| TD015 | AgentRouter.ts 超 200 行 (379行) | [x] | Phase 3.5 Step 3 | Phase 3.7 `122ff12` — 379→209行, 提取 route-strategies.ts |
| TD016 | ChatContainer.tsx 超 200 行 (297行) | [x] | Phase 3.5 final review | Phase 4.0 Step 3 — 拆分为 useChatHistory/useChatCommands/useSendMessage hooks；commit `31b11ab` |
| TD017 | Invocation 新入口必须传 threadId | [x] | Phase 3.5 缅因猫 review | 已文档化：AgentRouter.ts + messages.ts 头部说明约束 |
| TD018 | isFinal 丢失防护 | [x] | Phase 3.5 缅因猫 final review | Phase 4.0 Step 5 `f379b67` — 5 分钟 timeout + 30s heartbeat |
| TD019 | 自动讨论纪要生成 | [x] | Phase 3.5 计划 stretch | `16496b8` — AutoSummarizer 已实现 (pattern matching)，createdBy=system，历史回放已修复 |
| TD020 | start-dev.sh Redis 失败分支无自动化测试 | [x] | Phase 3.6 缅因猫 review | Phase 3.7 `b8d4313` — test-start-dev.sh |
| TD021 | 消息发送到不存在的 threadId 会产生孤儿消息 | [x] | 辩论测试发现 | Phase 5.2 — 400 拒绝 + code=THREAD_NOT_FOUND，前端解析 detail 显示中文提示；commit `ae710b6` |
| TD031 | /api/memory 与 /api/commands 身份/权限边界 | [x] | Phase 4.0 缅因猫 review P2-1 | 2026-02-10 缅因猫完成：`commands/memory` 接入 `resolveUserId` + thread ownership guard（header 优先、缺失 401、越权 403），commit `69ad9a9` |
| TD032 | DegradationPolicy 绑定实际链路 | [x] | Phase 4.0 缅因猫 review P2-2 | 5.0-pre: routeSerial/routeParallel 调用 checkContextBudget → yield system_info；commit `b2bcc23` |
| TD033 | TaskExtractor prompt/解析鲁棒性 | [x] | Phase 4.0 缅因猫 review P2-3 | `8e0ba93` — normalizeSourceIndex 处理 number/string/msg-N 格式 |
| TD034 | cascade delete 语义边界文档 | [x] | Quick wins 缅因猫 review P2-1 | Phase 5.2 — ADR `docs/decisions/007-cascade-delete-semantics.md`；commit `e46fd55` |
| TD035 | thread 删除与 invocation 竞态 | [x] | Quick wins 缅因猫 review P2-2 | Phase 5.2 — 409 ACTIVE_INVOCATION 保护 + InvocationTracker 注入；commit `ae710b6` |
| TD036 | CLI 全局配置隔离 | [x] | [茶话会夺魂 bug](./archive/2026-02/bug-report/tea-coffee/bug-report.md) | **已回退**: 隔离 HOME 方案失效 — Codex CLI 初始化覆盖 copy 的 auth/config/sessions，导致 401 + 模型回落 + resume 断裂。已删除 `cli-config-isolation.ts` + 测试，改用真实 HOME（项目级 AGENTS.md 已覆盖全局）。commit `1d8cb59`。详见 [timeline.md](./archive/2026-02/bug-report/tea-coffee/timeline.md) |
| TD039 | useChatCommands 命令解析自动化测试 | [x] | Phase 5.0-S2 follow-up | Phase 5.2 — vitest + jsdom 基建 + 14 tests for isCommandInvocation；commit `a953aad` |
| TD040 | delivery cursor 生命周期治理 | [x] | [resume 重复发送修复](./archive/2026-02/bug-report/opus-resume-history-duplication/bug-report.md) | Phase 5.2 — TTL 86400→604800 (7天)，长期键自然过期，commit `9ff5073` |
| TD041 | Gemini CLI 回答后 `candidates` 收尾崩溃跟踪 | [x] | [Gemini post-response crash](./archive/2026-02/bug-report/gemini-cli-post-response-candidates-crash/bug-report.md) | 2026-02-09 上游 `google-gemini/gemini-cli#18621` 已关闭（completed），`#18656` 已合并；2026-02-10 本地 `stream-json` 连续 3 次复测无崩溃，关闭该跟踪项 |
| TD042 | Branch 回滚 best-effort 双失败容错 | [x] | ADR-008 S7 缅因猫 R3 review | 2026-02-10 缅因猫完成：回滚清理改为 sync/async failure-safe + background orphan reconciliation retries（`CAT_BRANCH_ROLLBACK_RETRY_DELAYS_MS`）；review 跟进补充 reconcile 外层 try/catch 防 unhandled rejection，commit `bd69629` + `f3b743e` |
| TD043 | 身份入口统一（header 优先）与 URL 脱敏 | [x] | feat/ux-polish review P2 | `2aa54b6` — `resolveUserId` 扩展到 messages/threads，前端 apiFetch + `X-Cat-Cafe-User` header 取代 URL query |
| TD044 | **Codex exec 模式不保存 session → 缅因猫无法 resume** | [x] | 2026-02-10 实测发现 | 已闭环：根因是隔离 HOME 导致 sessions 写入 `/tmp`；`449fe91` + `81fa2bf` + `fb134b6` 通过 `sessions/` symlink 与回归测试修复 |
| TD045 | **缅因猫动态授权 + git 写入权限** | [x] | [bug report](./bug-report/dynamic-authorization-and-git-commit-blocked/bug-report.md) | 2026-02-10 缅因猫完成：Codex CLI callback 模式支持可配置 sandbox/approval（`CAT_CODEX_SANDBOX_MODE` / `CAT_CODEX_APPROVAL_POLICY`，默认 `danger-full-access` + `on-request`），并纳入 `/api/config` 热更新；解除 `.git` 写入阻塞，commit `bd69629` |
| TD046 | **授权系统 Redis 持久化** | [x] | 缅因猫 review P1 | RedisAuthorizationRuleStore + RedisPendingRequestStore + RedisAuthorizationAuditStore + 3 factories，28 Redis tests 全绿；commit `fb4a649` |
| TD048 | **MCP callback at-least-once 投递** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：`clientMessageId` 幂等去重（API）+ 指数退避重试（MCP，默认 1s/2s/4s，可 env 覆盖），commit `69ad9a9` |
| TD049 | **MCP callback local outbox** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：`post-message` 失败入本地 outbox（文件队列）+ 后续调用自动回放重试，4xx 毒消息丢弃避免无限重试；review 跟进补充 `CAT_CAFE_CALLBACK_OUTBOX_MAX_FLUSH_BATCH`（批次上限）+ `CAT_CAFE_CALLBACK_OUTBOX_MAX_ATTEMPTS`（老化清理），commit `595a14f` + `f3b743e` |
| TD050 | **消息持久化故障演练测试** | [x] | [消息丢失 bug](./bug-report/message-log-missing-after-auto-compact/bug-report.md) | 2026-02-10 缅因猫完成：新增持久化故障演练集成测试（故障显式失败 + 恢复后 retry 转绿）；review 跟进将固定 sleep 改为 `waitFor` 轮询，降低 CI flaky 风险，commit `69ad9a9` + `f3b743e` |
| TD053 | callback-tools.ts 超 200 行拆分 | [x] | Rebase 冲突复核 follow-up | 2026-02-10 缅因猫完成：将 retry/outbox 逻辑从 `callback-tools.ts` 提取为 `callback-retry.ts` + `callback-outbox.ts`，`callback-tools.ts` 降到 161 行，commit `1ec2811` |
| TD054 | F16 控制面行为接通（Task 3） | [x] | F16 Hindsight Config review | 2026-02-10 缅因猫完成：evidence/reflect/callback 路由统一读取运行时配置（recall defaults + reflect disposition），并补齐 RED→GREEN 回归测试闭环；commit `0e2b1f7` |
| TD055 | F16 配置变更审计（Task 6） | [x] | F16 Hindsight Config review | 2026-02-10 缅因猫完成：`PATCH /api/config` 写入 `config_updated` 审计事件（key/old/new/operator/source/timestamp），`/api/config/runtime-status` 补充 source 元数据；commit `0e2b1f7` |
| TD066 | 布偶猫权限申请不弹窗（MCP callback 未挂载） | [x] | [bug report](./bug-report/2026-02-12-opus-permission-request-no-popup/bug-report.md) | 2026-02-12 缅因猫完成：`ClaudeAgentService` 自动解析默认 MCP 路径 + `start-dev.sh` 构建 `mcp-server` 并导出 `CAT_CAFE_MCP_SERVER_PATH`，补充 `claude-agent-service` 与 `start-dev-script` 回归测试。commit `672eaf9` |
| TD067 | Hindsight discussion 例外导入机制（`hindsight: include`） | [x] | ADR-005 附录 C + P0.5 边界 | `fe47e85` + `5794e07` — 白名单导入 + review P2 follow-ups。已合入 main。 |
| TD068 | ADR 历史否决理由回填（批量） | [x] | ADR-005 附录 C | `83dc22d` — 6 历史 ADR 否决理由回填。已合入 main。 |
| TD069 | Hindsight 周评测流水线（precision/noise/staleness） | [ ] | P0 Plan Task 5 | 建立自动周评测与阈值告警，避免 recall 质量劣化无感发生。 |
| TD070 | workspace 全量 build 阻塞（packages/web lint/type） | [x] | 2026-02-13 Task 5 验证 | 2026-02-13 缅因猫完成：清理 4 处 `no-unused-vars`（`ChatContainer.tsx`, `RightStatusPanel.tsx`, `useSplitPaneKeys.test.ts`, `useChatHistory.ts`），`pnpm -r --if-present run build` 恢复通过；commit `fd98f85` |
| TD071 | Hindsight 最新性保障（freshness guard） | [x] | 2026-02-14 #68/#69 收口讨论 | `f90a1c4` + `eec372b` — full freshness fail-closed guard + dedupe parsers。已合入 main。 |
| TD072 | **F24: 手动绑定 Session + 前端入口（铲屎官兜底能力）** | [x] | [session-not-found bug](./archive/2026-02/bug-report/2026-02-14-claude-session-not-found-after-a2a-abort/bug-report.md) | **API** `5d158ae` — `PATCH /api/threads/:threadId/sessions/:catId/bind` 端点（带审计）。**前端** `4e85883` — `SessionChainPanel` bind 输入框 UI。 |
| TD073 | **A2A Stop 按钮 UX 改进** | [x] | [2026-02-14 情人节聊天](./archive/2026-02/mailbox/2026-02-14/2026-02-14-valentines-day-cat-chat-meeting-minutes.md) | 三个修复方向均已完成：**(1)** callback A2A 同步前端 loading (`0a1b1da`)；**(2)** `hasActiveInvocation` 状态 + Stop 按钮常驻显示；**(3)** ParallelStatusBar Stop 按钮。缅因猫 R3 放行，commit `2ccc87c`。 |
| TD074 | **Hindsight 临时停用（等 GPT Pro 调研）** | [~] | 2026-02-14 预评测数据质量复盘 | 已新增全局开关 `HINDSIGHT_ENABLED`（commit `8876677`）：关闭后 evidence/reflect/callback retain 不再调用 Hindsight，改为 docs fallback 或 skipped；并已停本地 Hindsight 容器避免 token 消耗。待 GPT Pro 结论后再决定恢复策略与 #69 评测时点。 |
| TD075 | **pending-mentions 跨线程泄漏** | [x] | [情人节聊天 bug](./archive/2026-02/bug-report/2026-02-14-pending-mentions-cross-thread-leak/bug-report.md) | `a822296` — getMentionsFor 增加 threadId 过滤 + 暄罗语音别名 + 4 tests (内存/Redis/API)。暹罗猫 R1 + 缅因猫 R2 放行。 |
| TD076 | **cancel_invocation 反馈 catId 硬编码为 opus** | [x] | [情人节聊天 bug](./archive/2026-02/bug-report/2026-02-14-cancel-catid-hardcoded-opus/bug-report.md) | `af9bfb7` — InvocationTracker 追踪 catIds + CancelResult + buildCancelMessages 纯函数 + 14 tests。暹罗猫 R1 + 缅因猫 R2 放行。 |
| TD080 | **流式草稿持久化（Streaming Draft Persistence）** | [ ] | [2026-02-17 超时复盘](./plans/2026-02-17-timeout-and-message-persistence.md) | 当前消息只在猫猫完成后持久化；streaming 阶段刷新页面消息消失。需在 streaming 阶段增量写入草稿消息，完成后合并/替换。难点：写入时机、草稿合并语义、TTL/清理、Redis 写入频率。Phase A 止血已合入 `8057aac`，Phase B 待设计实现。**计划在 F10 Phase A 中一并处理。** |
| TD081 | **GitHub Review Email Watcher（自动唤醒猫猫处理 review）** | [x] | [2026-02-18 设计方案](./plans/2026-02-18-github-review-email-watcher.md) | Phase 1+2 已实现 `e50f99c`：IMAP 轮询 + 3 层路由 + PR tracking API + 67 tests（7 轮云端 Codex + 砚砚 R4）。Skill Step 2.5 注册已加 `454fe72`。Phase 3 → 见 #97。|
| TD082 | **`onIntentMode` flat setter 线程切换竞态** | [x] | split-pane invocation state R1 deep review P2 | `9cfba72` — `useSocket.ts` intent_mode handler 升级为双指针 guard（route + store 必须一致），非活跃线程走 thread-scoped background path（新增 `setThreadIntentMode` / `setThreadTargetCats`）。ChatContainer 移除冗余 closure guard。模式与 agent_message 一致。 |
| TD084 | **`create_rich_block` MCP 工具在非 invocation 场景不可用** | [x] | 2026-02-20 布偶猫排查 | `c466213` — `handleCreateRichBlock` 加 Route A→B 降级链：Route A (direct callback) 失败 → Route B (post_message + cc_rich text) → 两路皆败返回 cc_rich hint。5 new tests。Token 生命周期根因未改（需 session-scoped token），但降级保证可用性。已合入 main。 |
| TD086 | **ImageExporter Puppeteer 进程泄漏** | [x] | 2026-02-21 铲屎官排查耗电 | `44b4530` — `thread-export.ts` 的 `process.once('SIGTERM/SIGINT')` 替换为 `fastify.addHook('onClose', ...)`，让 Puppeteer 清理跟随 Fastify 生命周期（`app.close()` 会 await 完成后再 `process.exit()`）。`sharedExporter` 从 module-level 移入 plugin scope。新增 cleanup 守护测试。 |
| TD097 | **Connector Messages — 外部信息源抽象 + 自动唤起** | [~] | [2026-02-25 Phase 3 设计](./plans/2026-02-25-connector-messages-phase3.md) | Phase 3a `e13cd1d`：ConnectorSource 类型 + registry + 前端气泡 + 15 tests。Phase 3b `c641b12`+`f6cab42`：ConnectorInvokeTrigger 自动唤起猫猫 + RouteResult 扩展 + 13 tests。砚砚 R1→R2 放行 + 云端 Codex P1→降级 P3（reject 不能实现重试，需 durable queue）。**待做**: 3c Redis 持久化 + connector invoke durable retry queue。|
| TD098 | **Session 查询工具升级 — 让猫更会查旧事** | [x] | [08 课件 gap 分析](./plans/2026-02-25-session-query-tools-upgrade.md) | 3 功能 gap 全部补齐：view 模式 (chat/handoff/raw) + read_invocation_detail + search invocationId 指针。27 tests (10+17)。砚砚 R1→R2 放行 + 云端 R1→R2 通过。性能债延后。commit `b88fd9f`, `cbf0451` |
| TD099 | **Hook 归一化 — 跨项目 hook 注入机制** | [ ] | 2026-02-26 铲屎官提出 | 现状：F24 hooks 写死在 `cat-cafe/.claude/settings.json`（project 级），猫猫打开其他项目时无 F24 hook。需要一个机制让猫猫咖啡的 hooks 能跟随猫猫到任何项目。详见 `docs/plans/2026-02-26-hook-unification.md`。|
| TD101 | ~~能力看板~~ → **已升级为 [F041](features/F041-capability-dashboard.md)** | — | — | 本条目已升级为独立 Feature。详见 `docs/features/F041-capability-dashboard.md`。|
| TD102 | ~~SessionBootstrap 同步~~ → **已升级为 [F065](features/F065-session-continuity.md)** | — | — | Bootstrap 增强 + Task 快照注入 + ThreadMemory，归入 F065 统一处理。|
| TD103 | **课件契约文档同步 — read_invocation_detail 参数差异** | [ ] | [砚砚 F98 对照验收](./discussions/2026-02-26-capability-dashboard/README.md) | 课件 `08-session-management.md:247` 写 `read_invocation_detail(invocationId)` 单参数，实现是 `sessionId + invocationId` 双参数。非功能缺失，实现更严谨，但文档需同步。|
| TD104 | **统一能力模型 `transport` 字段（YAGNI 暂不实现）** | [ ] | [F041 技术讨论](./discussions/2026-02-26-capability-dashboard/tech-discussion-open-questions.md) | 砚砚建议统一能力内部模型含 `transport` 字段（stdio/sse/ws）。布偶猫认为当前三猫 CLI 都是 stdio，YAGNI 原则暂不加。铲屎官认可 YAGNI 但记录 debt。触发条件：接入非 stdio transport 的 MCP server 时。|
| TD105 | **多分身（variant）UI 兼容：warning 渲染 + 圆点导航 sender 映射** | [x] | [bug report](./bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md) | 现象：warning JSON 直出、`opus-45/codex-spark` 在导航 tooltip 显示「系统」。修复落点：`useAgentMessages.ts` 增加 warning 分支；`MessageNavigator.tsx` 改用动态 cat data + baseId fallback。commit `c0bf811` |
| TD106 | **多分身（variant）hardcode 扫描与归一化** | [ ] | [bug report](./bug-report/2026-03-01-variant-ui-warning-and-navigator/bug-report.md) | 目标：把 Web/UI 中写死 `opus/codex/gemini` 的地方统一迁移到 `useCatData()`（例：`ContextHealthBar.tsx` 的 family color、Hub/Sidebar 的固定入口、未知 catId 的统一展示策略）。|
| TD107 | **Signal Inbox 列表 UX 设计语言归一化** | [x] | F091 AC-13 转出 | 标题优先布局 + flex-1 填充 + min-h 固定两行高 + badges/meta 移到标题下方。commit `4104d31b`。|
| TD108 | **Hyperfocus Brake 前端 TTS 播放** | [x] | F085 AC25 裁出 → **回收到 F085 Phase 5 AC29** | brake 触发时前端自动播放三猫语音撒娇。Phase 5 PR #361 已实现（`useTts.synthesize()` autoplay）。|
| TD109 | **Hyperfocus Brake agent hook 退役** | [ ] | F085 AC27 裁出 | Phase 4 平台化上线后，移除 `pretool-brake-check.sh` + `hyperfocus-brake-timer.sh`。需先验证平台 brake 稳定运行 1 周+。触发条件：铲屎官确认平台 brake 稳定后。|
| TD110 | **Hyperfocus Brake 设置真持久化** | [ ] | F085 AC31 裁出 | brake 开关 + 阈值目前存 in-memory Map，浏览器刷新不丢但服务重启丢。需迁移到 Redis 或 DB。触发条件：铲屎官反馈设置丢失或部署频率增加时。|
| TD111 | **Bubble writer identity contract 统一收敛** | [ ] | F123 AC-B1 转出 | `active/background/history/draft/queue` 五条写路径还没有统一到同一个 enforced identity contract。`bubbleIdentity.ts` 已提供 truth model/helper，但不是写路径级 enforcer。Evolved from: F123。|
| TD112 | **ChatStore duplicate identity invariant** | [ ] | F123 AC-B2 转出 | 目前没有 store 级 invariant 明确阻止同一 `catId + invocationId + bubble kind` 在 store 中稳定共存两条 text bubble。需要在写入层或 store 层加硬防线。Evolved from: F123。|
| TD113 | **placeholder → formal 单调升级规则收口** | [ ] | F123 AC-B3 转出 | 现有 replace/hydration/callback 优先级已覆盖高频症状；`PR #506` 又补了一条 CLI Output 窄口热修（callback text 回收无 `invocationId` 的 rich-block placeholder），但 placeholder 升级到 formal 仍是 case-by-case 规则，尚未统一成系统性单调 contract。Evolved from: F123。|
| TD114 | **Bubble duplicate invariant diagnostics / assertions** | [ ] | F123 AC-B5 转出 | 目前有 `dumpBubbleTimeline()`，但没有 invariant 断言直接指出 duplicate 是从哪个入口创建的。需要 dev/test 级诊断或断言。Evolved from: F123。|
| TD115 | **logs-health.sh 跨平台兼容性（Linux + Windows）** | [ ] | F130 缅因猫 review 观察 | `oldest_file_days()` 用 `stat -f '%m'`（BSD/macOS 专用），Linux 需 `stat -c '%Y'`。`date -v-1H` 也是 BSD 语法。Windows 上整个 bash 脚本不可用——但 Pino logger.ts 本身是纯 Node.js 跨平台，**日志落盘不受影响**，只是缺少 `pnpm logs:health` 诊断能力和 `start-dev.sh` 进程层 stderr capture。修复方向：(A) `logs-health.sh` 加 `uname` 判断走不同 stat 语法；(B) Windows 用户提供 Node.js 版 logs-health 替代；(C) start-dev.sh 的 process-layer 暂无 Windows 等价方案。触发条件：社区 Windows/Linux 用户反馈或 Docker 化部署时。|
| TD116 | **scheduled web-digest 对接现有 browser-automation backend** | [x] | F139 AC-H2b 转出 | 已在 PR #826 完成：`web-digest` 的 `needs-browser` 分支改为先存真实 trigger message，再 `invokeTrigger` 唤醒猫并携带 `suggestedSkill: browser-automation`。2026-03-28 关闭。 |

## P3 — 可选优化

| ID | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| TD022 | blob URL 同 thread 连发大量图累积 | [x] | Phase 3.3b review | Phase 5.2 — addMessage 增量 revoke (MAX_BLOB_MESSAGES=200)；commit `e46fd55` |
| TD023 | 冷/热状态视觉反馈 (猫头像发光) | [x] | 暹罗猫提议 | 已实现：`CatAvatar` 在 `streaming` 状态启用 glow + `animate-pulse`，并由 `ChatMessage` 流式状态驱动；commit `dc80bf9` |
| TD024 | Antigravity cancel 无效 (detached 进程) | [~] | Phase 3.3b review | 已接通信号链路：`messages` 将 AbortSignal 传入执行链，`GeminiAgentService(antigravity)` 在 abort 时 `process.kill(-pid, SIGTERM)`；待补一条实机 cancel 验证后可转 `[x]`。 |
| TD025 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包，Docker MCP 可让猫管理容器；开发阶段脚本够用 |
| TD026 | Gemini/Codex resume 作为补充 context 源 | [x] | Phase 3.6 决策 2 | 2026-03-03 F053 纠偏后结论：Codex 与 Gemini 均支持 UUID resume（Gemini CLI 0.31.0 已接入 `--resume`）；ContextAssembler 继续承担跨猫历史补全。 |
| TD027 | 导出格式 locale 依赖 | [x] | Phase 3.6 交接 OQ | 改用 `formatDatetime()` 固定 YYYY-MM-DD HH:mm 格式 |
| TD028 | A2A mention 与 AgentRouter.parseMentions 逻辑重复 | [x] | Phase 3.9 | 已澄清设计意图：用户消息用 indexOf (宽松)，猫回复用行首匹配 (严格防误触)；commit `e17e96d` |
| TD029 | A2A 悄悄话折叠 UI | [x] | 暹罗猫建议 | 已实现：`A2ACollapsible` + `ChatContainer` 按 `a2aGroupId` 分组折叠，默认"查看内部讨论"；commit `b23f38a` |
| TD030 | /config context 数字误导 | [x] | Phase 3.9 缅因猫 review P2 | Phase 4.0 Step 2 — perCatBudgets 显示实际值，context 段标注 deprecated；commit `f822eb8` |
| TD051 | ~~Codex 隔离 HOME 固定路径并发冲突~~ | [x] | F16 review P3 | 已关闭：隔离 HOME 方案已废弃 (BACKLOG #36 重开 → 删除隔离)，此项自动解决。 |
| TD052 | callbackToken 出现在 query string | [ ] | F16 review P3 | Why: 与现有 callback GET 鉴权方式保持兼容。风险边界：token 可能出现在 access log / proxy cache。触发条件：引入网关或外部代理前，迁移到 header 鉴权或改为 POST。 |
| TD057 | Claude CLI partial flag 版本兼容检查 | [x] | 2026-02-11 Opus review P2 建议 | 关闭：铲屎官 CLI 保持最新 (v2.1.39+)，无需兼容旧版。 |
| TD058 | 补充无 message_start 的 delta 场景测试 | [ ] | 2026-02-11 Opus review P2 建议 | Why: 现有逻辑在 `currentMessageId` 为空时仍会输出 text_delta，但缺少显式回归测试。风险边界：后续重构可能误改该容错行为。触发条件：下次触达 `ClaudeAgentService` 流式逻辑时，优先补此测试并转为 [x]。 |
| TD059 | ~~ChatInput.tsx 超 200 行~~ | [x] | Voice Input M1 review | `23a5c30` — 302 → 176 行。提取 ChatInputActionButton + ChatInputMenus + chat-input-options。 |
| TD060 | ~~useVoiceInput 测试覆盖不足~~ | [x] | Voice Input M1 review | `8e11f96` + `23a5c30` — 2 → 20 tests (MockMediaRecorder + streaming + 竞态回归)。 |
| TD061 | ~~whisper-api.py 健壮性~~ | [x] | Voice Input M1 开发 | `4343a66` — 25MB 限制/空文件/503/logging/SIGTERM/model load exit(1)。 |
| TD062 | Whisper 模型选择 small → large-v3-turbo | [x] | Voice Input M1 open question | `fb51e1f` — mlx-whisper 迁移，默认 `mlx-community/whisper-large-v3-turbo`，Metal GPU 加速 |
| TD063 | Whisper 服务集成到 start-dev.sh | [x] | Voice Input M1 open question | `ae99da9` — start-dev.sh 自动启动 Whisper ASR 服务 |
| TD064 | 删除废弃的 `ExportImageButton.tsx` | [x] | F17b review P3 | 已删除，无引用确认；commit `761df79` |
| TD065 | `ChatInputMenus.tsx:23` RefObject 类型错误 | [x] | F17b review P3 | `RefObject<HTMLDivElement | null>` → `RefObject<HTMLDivElement>` 与 useRef 返回类型对齐；commit `761df79` |
| TD079 | archive 内部互引旧路径未更新 | [ ] | WT-4 docs archive R2 | `docs/archive/2026-02/` 内历史文档互相引用仍用归档前路径（如 `docs/discussions/...`）。60+ 处，不影响活跃文档。触发条件：如需给 archive 生成静态站点或可点击链接时再批量修。 |
| TD087 | sources-loader "does not rewrite" 测试强化 mtime/spy | [ ] | source-sync 缅因猫 R1 P3-1 | 当前 `signal-sources-loader.test.js` 的"no rewrite"断言仅比较文件内容；无法区分"未写盘"和"写盘但内容相同"。可用 `fs.statSync().mtimeMs` 或 write spy 强化。触发条件：下次改 sources-loader 写盘逻辑时一并补。 |
| TD088 | Redis PushSubscriptionStore upsert TOCTOU race | [ ] | C1+C2 云端 Codex review P3 | `hget(previousUserId)` 在 `MULTI` 外面，并发同一 endpoint 的 owner 变更有理论竞态。实际场景需同一设备两个用户同时订阅，概率极低。修复需 Lua 脚本原子化。触发条件：引入多用户并发订阅场景时。 |
| TD090 | Codex 压缩检测 1 轮空窗（启发式盲区） | [ ] | [压缩检测讨论](./discussions/2026-02-24-compression-detection-cross-provider/README.md) | 当前检测是反应式：Codex 压缩发生在本轮，re-injection 在下一轮才生效，中间有 1 轮身份空窗。升级方向：持久化 prevFill / preflight context snapshot / 等 Codex CLI 支持独立 system prompt slot。实际影响有限，观察到事故再升级。 |
| TD093 | ~~Gemini resume：按 thread 隔离目录 + `--resume latest`~~ | [x] | 铲屎官 2026-03-01 实测 | 已被 F053（2026-03-03）纠偏关闭：Gemini CLI 0.31.0 支持 UUID resume，现直接按 `sessionId` 恢复，无需 `latest/index` 隔离方案。 |
| TD094 | 压缩效率检测（pre/post fillRatio delta） | [ ] | F033 毕业遗留 | 当前无法量化压缩是否有效。升级方向：SessionRecord 增加 pre/post compression fillRatio 对比。触发条件：观察到压缩策略未降低 token 消耗时。 |
| TD095 | MEMORY.md auto-dump（猫猫自动落盘关键记忆） | [ ] | F033 毕业遗留 | 当前各猫手动维护 MEMORY.md，可能遗漏。需要猫间协调机制自动从 session events 提取关键信息。属研究方向。 |
| TD091 | **PR Tracking 注册链路断裂 — 猫猫无法自动收到云端 review 推送** | [ ] | F045 PR #88 实际踩坑 | **问题**：完整链路（GitHub email → IMAP → ReviewRouter → ConnectorInvokeTrigger）已接通，但猫猫端注册 PR tracking 的体验断裂：(1) 没有 MCP 工具注册 PR tracking，只有裸 `curl`，猫猫需要自己拼 URL + 猜 threadId；(2) `cat_cafe_get_thread_context` 返回消息列表但**不返回 threadId**，猫猫无法获取自己所在的 threadId；(3) Skill `requesting-cloud-review` Step 2.5 写了 curl 示例但没说怎么获取 threadId，猫猫只能填 `"unknown"`（导致 Layer 1 路由失败）。**修复方向**：(A) 新增 MCP 工具 `cat_cafe_register_pr_tracking`，内部自动获取当前 threadId；或 (B) `cat_cafe_get_thread_context` 返回中加 `threadId` 字段 + 猫猫咖啡程序自动在 ConnectorInvokeTrigger 创建 PR 时帮注册；(C) SOP/Skill 补充明确说明。触发条件：下次提 PR 需要云端 review 自动回传时。 |
