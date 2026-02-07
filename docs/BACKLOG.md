# Cat Cafe 技术债务 & 待办事项

> 维护者：布偶猫 | 最后更新：2026-02-07 (Phase 3.8 狼人杀 Bug 修复)
>
> 规则：每次 review 产生遗留项、或 coding 时发现新债务，**必须更新这个文件**。
> 标记规则：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成（附 commit 或 Phase）

---

## P0 — 阻塞后续 Phase

全部已清。

## P1 — 必须做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 1 | MCP 统一挂载 (Codex/Gemini) | [x] | Demo 发现 | Phase 3.7 `8114d1d` + review fix `6137cc9` — McpPromptInjector HTTP callback 注入 |
| 2 | Redis ThreadStore | [x] | Phase 3.2 | Phase 3.7 `a8236bc` — RedisThreadStore + factory |
| 3 | Redis TaskStore + SummaryStore | [x] | Phase 3.5 | Phase 3.7 `1bd0eb3` — RedisTaskStore + RedisSummaryStore + factories |
| 4 | MCP 工具接入 (文件操作切 MCP Server) | [x] | Phase 2.5 | Phase 3.7 `8114d1d` + review fix `6137cc9` — 与 #1 合并, prompt 注入方式 |
| 5 | 目录浏览安全 (allowlist/blocklist) | [x] | Phase 3.2 review | Phase 3.7 `59d2d80` — PROJECT_ALLOWED_ROOTS env var |
| 6 | 多猫调用状态可观测性 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` (前端 per-cat status) + `1c3efe4` (CLI timeout 传播) |

## P2 — 建议做

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 7 | 上下文预算管理 (token 截断) | [x] | 身份注入讨论 | Phase 3.7 `999a775` — maxTotalChars + MAX_PROMPT_CHARS env |
| 8 | 单猫 @mention 无加载提示 | [x] | 狼人杀测试 | Phase 3.8 `180bd1a` — ThinkingIndicator 组件 |
| 9 | 前端图片压缩 | [ ] | Phase 3.2 review | 当前 10MB/张直传 |
| 10 | 对话级联删除 | [ ] | Phase 3.2 review | DELETE thread 不删消息，依赖 TTL |
| 11 | cancel_invocation 真正鉴权 | [x] | Phase 3.3b review | Phase 3.7 `0c3d318` — userId 追踪 + 校验 |
| 12 | 取消后显示"已取消"标记 | [ ] | Phase 3.3b review | 现在只停止 loading，没有视觉提示 |
| 13 | cats.ts TODO: 从 Redis 获取猫状态 | [ ] | 代码 TODO | `packages/api/src/routes/cats.ts:33` |
| 14 | sendMessageSchema 语义归属 | [ ] | Phase 3.5 Step 0 review | 当前在 `parse-multipart.ts`，建议迁到 `messages.schema.ts` |
| 15 | AgentRouter.ts 超 200 行 (379行) | [x] | Phase 3.5 Step 3 | Phase 3.7 `122ff12` — 379→209行, 提取 route-strategies.ts |
| 16 | ChatContainer.tsx 超 200 行 (297行) | [ ] | Phase 3.5 final review | 提取 fetchHistory/fetchTasks/handleSend 到自定义 hook |
| 17 | Invocation 新入口必须传 threadId | [ ] | Phase 3.5 缅因猫 review | 跨线程鉴权依赖正确 threadId；新增入口需保持约束 |
| 18 | isFinal 丢失防护 | [ ] | Phase 3.5 缅因猫 final review | 前端完全信任后端 isFinal 结束 loading；若后端漏发则 loading 卡死。可加超时兜底或心跳检测 |
| 19 | 自动讨论纪要生成 | [ ] | Phase 3.5 计划 stretch | 当前 summary 仅手动 API 创建，后续可调 opus 自动总结 |
| 20 | start-dev.sh Redis 失败分支无自动化测试 | [x] | Phase 3.6 缅因猫 review | Phase 3.7 `b8d4313` — test-start-dev.sh |

## P3 — 可选优化

| # | 项目 | 状态 | 来源 | 备注 |
|---|------|------|------|------|
| 21 | blob URL 同 thread 连发大量图累积 | [ ] | Phase 3.3b review | clearMessages 时已回收，但不切 thread 会累积 |
| 22 | 冷/热状态视觉反馈 (猫头像发光) | [ ] | 暹罗猫提议 | CSS class 切换，低成本；与 P1 #6 可观测性相关 |
| 23 | Antigravity cancel 无效 (detached 进程) | [ ] | Phase 3.3b review | gemini-cli fallback 可选 |
| 24 | Docker 化部署 | [ ] | 铲屎官建议 (~5.x) | Redis + API + Web 打包，Docker MCP 可让猫管理容器；开发阶段脚本够用 |
| 25 | Gemini/Codex resume 作为补充 context 源 | [ ] | Phase 3.6 决策 2 | prompt prepend 跑稳后，resume 减少 token 开销；Gemini index 问题需等 CLI 支持 UUID |
| 26 | 导出格式 locale 依赖 | [ ] | Phase 3.6 交接 OQ | `formatThreadAsMarkdown` 用 `toLocaleString('zh-CN')`，非中文环境格式可能不同 |

## Feature Requests — 新功能需求

> 区别于技术债务：这里是"想做的新功能"，不是"应该做好但没做好的"。

| # | 功能 | 优先级 | 来源 | 描述 |
|---|------|--------|------|------|
| F1 | 配置可见性 | P2 | 铲屎官洞察 🐬 | 魔法数字问题：截断长度、超时时间等配置不可见。方案：配置页面 / `/config` 命令 / 启动日志 |
| F2 | Agent-to-Agent 调用 (A2A) | P1 | 铲屎官洞察 🐬 | 猫猫互相 @：布偶写完 → @缅因 review → 缅因 @布偶 反馈。减少铲屎官当"人肉路由器" |
| F3 | 协作记忆 (Hindsight) | P1 | 上下文工程讨论 | 三猫共享长期记忆：cafe-shared + cafe-{catId}。详见 `docs/discussions/2026-02-07-context-enginnering/` |

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

</details>
