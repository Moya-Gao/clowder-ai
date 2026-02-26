---
feature_ids: []
topics: [phases, context, engineering]
doc_kind: note
created: 2026-02-26
---

# Phase 5.0: 上下文工程（Layer 1/2）— Evidence‑first 检索 + 协作记忆治理（Hindsight）

> 提议者：缅因猫（Codex）  
> 日期：2026-02-08  
> 状态：**草案（已拍板：见 ADR-005，待实施拆解）**

本 Phase 的目标：把「上下文工程」从口号落到**可验证、可审计、可渐进交付**的工程能力上，优先补齐 Layer 1/2（索引/检索）缺口，同时把协作记忆纳入治理体系。

---

## 0) 参考输入（本 Phase 的“证据锚点”）

- 四层模型原讨论：`docs/archive/2026-02/discussions/2026-02-07-context-enginnering/intro-discuss-with-claude-app-opus4.5.md`
- 辩论赛完整记录（备份）：`docs/archive/2026-02/discussions/2026-02-07-context-enginnering/result/cat_cafee_context_engineering_debate_log.md`
- 布偶猫纪要（记忆派）：`docs/archive/2026-02/discussions/2026-02-07-context-enginnering/result/ragdoll-debate-summary.md`
- 暹罗猫纪要（体验派）：`docs/archive/2026-02/discussions/2026-02-07-context-enginnering/result/gemini-meeting-minutes.md`
- 缅因猫纪要（融合版）：`docs/archive/2026-02/discussions/2026-02-07-context-enginnering/result/codex-meeting-minutes.md`
- Phase 5 决策拍板（ADR-005）：`docs/decisions/005-hindsight-integration-decisions.md`
- Hindsight 重大澄清（外部服务已部署）：`docs/archive/2026-02/mailbox/2026-02-08/2026-02-08-hindsight-clarification-to-maine.md`
- Backlog（必须对齐）：`docs/BACKLOG.md`

---

## 1) 背景：我们现在卡在哪里

Cat Café 在 Layer 3/4（prompt 组装 + 多猫调度）上已经“能跑且好玩”，但 Layer 1/2（索引/检索）不足，导致：

1. **重复解释/重复阅读**：每次新 thread 或跨猫接力，都要重新找“证据在哪里/为什么这么做”。  
2. **记忆缺失或腐烂风险**：纯文本记忆很容易 stale/误导；可写的跨 thread 共享记忆会放大注入/污染面。  
3. **用户体验痛点**：铲屎官等猫时看不到“正在做什么/卡在哪里/有没有在查证”。  

辩论收敛后的共识是：**索引与记忆不是对立，它们都属于 Layer 2（检索），且依赖 Layer 1（稳定定位）**；正确路线是“融合但有门禁”。

---

## 2) Phase 5 目标（Success Criteria）

### 2.1 用户可感知的成功标准

- 铲屎官提问“之前我们为什么这么做？”时，猫猫能在 **30 秒内** 给出：**结论 + 可点击证据锚点（文件/commit/纪要）**。  
- 任意一条“协作记忆”都能回答：**谁写的、依据是什么、是否已发布、如何回滚**。  
- 在长调用/多步链路中，UI 至少能显示：**检索中 / 写入中 / 等待队友 review 中 / 已降级**（不再“黑箱等死”）。

### 2.2 工程可验证的成功标准（指标）

- `time_to_first_evidence`：从用户发起到首个证据锚点返回的耗时。  
- `evidence_hit_rate / miss_rate`：每次检索是否真的指向正确锚点（抽样人工验证即可）。  
- `stale_memory_rate`：被访问时判定为 stale / needs_review 的比例（越低越好，但不能靠“永不标 stale”作弊）。  

---

## 3) 不做什么（Non‑Goals）

为避免“上来就做 Augment 级别的大工程”，Phase 5 明确不做：

- 不做全代码库向量检索/GraphRAG/知识图谱（先用 docs + git lineage 验证 ROI）。  
- 不做“记忆写入即进入 system prompt 并当作指令执行”的路径（共享记忆默认不可信）。  
- 不把“符号级完整索引（LSP/Tree‑sitter 全量）”作为本 Phase 的 gate（可作为 Phase 5 的 stretch 或 Phase 6 主线）。  

---

## 4) 设计原则（Invariants）

1. **Evidence‑first**：任何检索/记忆输出都要带 anchors（`commit/file/symbol/discussion/decision`）。  
2. **记忆是数据，不是指令**：跨 thread/跨猫共享记忆一律按不可信数据处理，默认通过 tool response 通道呈现，不直接注入 system prompt。  
3. **可审计、可回滚、可降级**：发布/提升/回滚必须可追溯；失败时宁可降级为“只给证据、不自动写入”。  
4. **渐进交付**：优先交付只读检索（低风险、可量化），再开放写入（高风险、要治理）。  

---

## 5) 现有资产（我们已经有的积木）

- Thread‑scoped 显式记忆（F3‑lite）：`POST/GET/DELETE /api/memory`（`packages/api/src/routes/memory.ts`），前端命令 `/remember` `/recall`（`packages/web/src/hooks/useChatCommands.ts`）。  
- Redis 持久化（可用则启用）：`RedisMemoryStore` + `createMemoryStore()`（`packages/api/src/domains/cats/services/RedisMemoryStore.ts`）。  
- 讨论沉淀与结构化：`docs/discussions/`、`docs/decisions/`、`docs/phases/`（本质是“可检索的协作记忆雏形”）。  
- 事件审计日志：`EventAuditLog`（`packages/api/src/domains/cats/services/EventAuditLog.ts`）— “即使 Redis 丢了，真相可追溯”。  
- MCP Server 基础：`packages/mcp-server/src/tools/file-tools.ts`（文件读取/写入等）。  
- Hindsight 外部服务（据 `docs/archive/2026-02/mailbox/2026-02-08/2026-02-08-hindsight-clarification-to-maine.md`）：铲屎官本地已通过 Docker 部署，可直接调用 Retain/Recall/Reflect API（无需我们在 Cat Café 代码里“自己实现一个记忆系统”）。

### 5.1 Hindsight API 探测结果（2026-02-08）

> 目的：把 “Retain/Recall/Reflect 到底怎么调用、bank 路径是什么” 固化成可执行事实，避免继续靠口口相传。

**服务地址（铲屎官本机）**
- API Base URL：`http://localhost:8888`
- Health check：`GET /health` → `{"status":"healthy","database":"connected"}`
- OpenAPI：`GET /openapi.json`（FastAPI/uvicorn）

**核心路径（与 Phase 5 强相关）**
- `GET /v1/default/banks`：列出全部 bank（实测：当前已有 5 个 bank；Cat Café 还没建专用 bank）
  - `routing-shared`（name: `Pangu Router 共享记忆库`）
  - `dare-framework`
  - `nf-lite-worktrees`
  - `IDEA-Enhanced-Context-MCP`
  - `mission-control-hub`
- `PUT /v1/default/banks/{bank_id}`：创建/更新 bank（Body: `CreateBankRequest`，可填 `name/background/disposition`；也可只建空 bank）
- `POST /v1/default/banks/{bank_id}/memories`：Retain（写入）
  - Body: `{ items: MemoryItem[], async?: boolean=false, document_tags?: string[] }`
  - `MemoryItem` 最小字段只有 `content`；可选字段：`document_id`、`timestamp`、`tags`、`metadata`…
  - 重要约束：`metadata` 的 value 类型是 `string`（`Record<string,string>`），不支持嵌套对象
  - Response: `{ success, bank_id, items_count, async, operation_id?, usage? }`
- `POST /v1/default/banks/{bank_id}/memories/recall`：Recall（检索）
  - Body 关键字段：`{ query, budget?: low|mid|high, tags?: string[], tags_match?: any|all|any_strict|all_strict, include?: { entities?, chunks? }, trace?: boolean }`
  - `tags_match` 语义（来自 OpenAPI）：`any/all` 会 *包含 untagged*，`*_strict` 会 *排除 untagged*
  - Response: `{ results: RecallResult[], entities?, chunks?, trace? }`
- `POST /v1/default/banks/{bank_id}/reflect`：Reflect（反思/生成回答）
  - Body 关键字段：`{ query, budget?: low|mid|high, context?, include?: { facts? }, response_schema?, tags?, tags_match? }`
  - Response: `{ text, based_on?, structured_output?, usage? }`

**示例 curl（仅用于确认路径与字段）**
```bash
# health / banks
curl -sS http://localhost:8888/health
curl -sS http://localhost:8888/v1/default/banks

# retain
curl -sS -X POST http://localhost:8888/v1/default/banks/<bank_id>/memories \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"content":"hello","document_id":"thread:<id>","tags":["project:cat-cafe"]}]}'

# recall
curl -sS -X POST http://localhost:8888/v1/default/banks/<bank_id>/memories/recall \
  -H 'Content-Type: application/json' \
  -d '{"query":"hello","budget":"mid","tags":["project:cat-cafe"],"tags_match":"all_strict"}'
```

**Memory types 快照（`/stats`，2026-02-08）**
- 观察到的 fact types（至少包含）：`world`、`observation`、`experience`、`opinion`
- 示例（`dare-framework`）：`total_nodes=377`；`world=271`、`observation=87`、`experience=8`、`opinion=11`
- 结论：Phase 5 不需要“发明分类体系”，但需要定义我们写入时的 **tags/metadata 约定**（例如 `project:*`、`kind:*`、`status:*`），避免单一 bank 下的串味与污染。

**实现含义（给 Phase 5 的落地约束）**
- **已拍板**：Phase 5 先用单一 bank `cat-cafe-shared`；用 `tags` + `metadata` 做 project/kind/status 等细分过滤。若后续确有隔离需求，再扩展 `bank_id` 分层。
- 若需要在 `metadata` 里放 anchors（`commit/file/symbol/...`），必须序列化成字符串（例如 JSON 字符串、或多行文本）。

**本地开发注意事项（Codex App 沙盒）**
- 在 Codex App 会话里，访问 `localhost` 也可能被当作“网络访问”拦截；需要铲屎官在弹窗里按次授权（见仓库根目录 `AGENTS.md` 的“权限与授权”小节）。

---

## 6) Phase 5 范围（Scope）

> 结构：先交付只读检索（Step 1），再开放写入但默认隔离（Step 2a），最后把“长期可靠性”补齐（Step 3 的最小可用子集）。

### 6.A Step 1：Evidence‑first 检索 MVP（只读）

**目标**：让猫猫在不依赖“我记得”的前提下，快速返回证据锚点。

**交付物（建议）**
- 新增一个“证据检索”入口（API + MCP + 前端命令三选二即可，推荐 API + 前端命令）：
  - 前端命令：`/evidence <query>`（返回 Top‑K 证据片段 + anchors）
  - API：`GET /api/evidence/search?q=...&limit=...`
  - MCP：`cat_cafe_search_evidence`（内部调用 API；对猫暴露为工具）

**覆盖的数据源（按价值排序）**
1. `docs/decisions/`（最接近“权威结论”）  
2. `docs/phases/`（路线与取舍）  
3. `docs/discussions/`（过程与 why）  
4. `git log`（Context Lineage 的最低配：commit message + touched files）  

**实现备注（建议）**
- 优先复用 Hindsight：把上述文档按“片段 + anchors 元数据”批量 Retain 到指定 bank，检索时用 Recall 返回 Top‑K 证据片段。  
- 若 Hindsight 不可用（或未部署），MVP 允许降级为本地全文检索（grep/简单倒排），但输出格式仍必须 evidence‑first。  

**输出格式约束（强制）**
- 每条结果至少包含：
  - `title`（一句话）
  - `anchor`（例如：`docs/decisions/xxx.md` / `commit abc1234`）
  - `snippet`（最小相关片段，避免整篇糊上来）
  - `confidence`（高/中/低；低就说明“不确定，建议打开文件验证”）

### 6.B Step 2a：开放写入，但默认 draft/quarantine（协作记忆治理的 MVP）

**目标**：让三猫“能写”，但在治理体系稳定前**不自动成为项目事实源**。

**核心设计**
- 增加记忆维度：
  - `scope`: `thread_local | project_shared | cat_personal`
  - `status`: `draft | pending_review | published | archived`
  - `sensitivity`: `low | high`（低敏可走更轻门禁）
  - `anchors[]`: 证据锚点（必须字段；为空则强制低置信）

**存储与集成（关键澄清）**
- Hindsight 是**外部服务**：Retain/Recall/Reflect 已存在。Phase 5 的工作重点是“怎么用好它 + 怎么治理”，而不是在 Cat Café 里再造一套记忆系统。  
- **已拍板**：先只建一个 `cat-cafe-shared`；通过 `tags/metadata` 做过滤与治理，而不是把所有语义都塞进 Redis Hash。后续需要隔离时再增加 bank。  
- 发布门禁/状态机不属于 Hindsight：需要在 Cat Café 调用层实现（可用 Redis 存状态、EventAuditLog 记审计；记忆正文存 Hindsight）。  

**发布门禁（建议默认）**
- `thread_local`: 允许写入即生效（风险低，仅当前 thread）。
- `project_shared` (低敏)：**24h 提醒 + 猫猫互审模式**（建议）：
  1. 创建时 `status = draft`
  2. 24h 后 `status = pending_review`（**不是自动提升**，只是提醒需要 review）
  3. 任意一只猫 `/approve` → `status = published`
  4. 或者铲屎官 `/approve` → `status = published`
- `project_shared` (高敏) / `high sensitivity`: 必须"铲屎官签核"或"双猫签核"才能 publish。  

**审计与回滚**
- publish / rollback / archive 动作写入 `EventAuditLog`（数据里包含 entryId + anchors + 操作者）。  

### 6.C Step 3（最小子集）：锚点再验证与陈旧性治理

**目标**：避免“协作记忆 = 一次写入，永久正确”的幻觉。

**最低配即可**
- `onAccess`：每次 recall/publish 前，对 anchors 做轻量校验：
  - `file`：路径存在
  - `commit`：能在 `git cat-file -t` 找到
  - `symbol/function`：能在目标文件中找到（允许 grep‑level 的粗验证）
- 校验失败：标记 `needs_review`（或降 `confidence`），并提示用户打开 anchor 复核。  

---

## 7) Backlog 绑定（Phase 5 顺手/必要落地）

Phase 5 里应当显式承接这些 backlog：

- `F3b` 协作记忆（Hindsight 集成）— Phase 5 主线（治理 + tags/metadata 分层 + recall/reflect；必要时再扩展 bank）。  
- `#19` 自动讨论纪要生成 — Phase 5 的“自动沉淀”入口（Summary→Memory 候选），建议作为 Step 2a 的加速器而非 gate。  
- `#32` DegradationPolicy 绑定实际链路 — 证据检索/记忆 publish 过程必须可降级，并给出用户可理解的 system_info。  

（其余 P2/P3 项可不强行并入 Phase 5，避免范围膨胀。）

---

## 8) 铲屎官拍板结果（2026-02-08）

| # | 问题 | 决策 | 备注 |
|---|------|------|------|
| 1 | 入口选择 | **三者都要**：`/evidence` + API + MCP | MCP 给猫猫 agent 用，`/evidence` 给铲屎官用 |
| 2 | project_shared 低敏发布 | **24h 提醒 + 猫猫互审** | draft → pending_review → /approve → published |
| 3 | anchors 最低要求 | **file path 即可** | commit hash 作为高置信度加分项 |
| 4 | Hindsight 接入形态 | **服务端 HTTP 调用** | Hindsight 作为外部 Docker 服务；复用现有 Redis/EventAuditLog，不另起“新记忆服务” |
| 5 | reflect 触发条件 | **三种都支持** | 猫猫 `/reflect` + 铲屎官主动 + thread 结束自动 |
| 6 | 符号级索引 | **留到 Phase 6** | Phase 5 用 file path 做索引 |
| 7 | UX | **卡片组件** | 请暹罗猫设计视觉方案 |

### 8.1) 铲屎官补充拍板（2026-02-08 第二轮）

详细决策过程见 `docs/decisions/005-hindsight-integration-decisions.md`

| # | 问题 | 决策 | 关键洞察 |
|---|------|------|---------|
| 1 | 连接参数 | `HINDSIGHT_URL=http://localhost:8888` | 用环境变量，方便部署 |
| 2 | Bank 设计 | **单一 `cat-cafe-shared`** | 不做 `cat-cafe-{catId}`，避免知识孤岛；调研 Hindsight memory types |
| 3 | F3-lite 分工 | **分层：F3-lite 临时，Hindsight 持久** | Thread 对话本身就是 session 记忆，不需要进 Hindsight |
| 4 | 发布门禁位置 | **Cat Café 调用层** | Redis 存状态，EventAuditLog 记审计，做好优雅停机 |
| 5 | Evidence 检索 | **Hindsight Recall，只导入归档后的稳定文档** | 正在进行的讨论不导入 |
| 6 | Reflect 触发 | **手动优先**：用户 `/reflect` + 猫 MCP | 后续可加定时/自动 |
| 7 | UX 呈现 | **卡片组件 + 右侧面板** | 参考 Claude Code cowork；**必须修复 tool_use（以及可能的 tool_result）事件丢弃问题** |

### 8.2) 发现的 Bug：tool_use（以及可能的 tool_result）事件被丢弃

**问题**：`useAgentMessages.ts` 没有处理 `tool_use`（以及预留的 `tool_result`）事件，导致用户等待时看不到猫猫在做什么。

**根因**：
- 后端 `types.ts` 定义了 `tool_use | tool_result` 类型
- 前端只处理了 `text | done | a2a_handoff | system_info | error`
- `tool_use`（以及 `tool_result`）被静默丢弃

**备注（实现差异）**：
- 不同 provider 的流式事件可能不一致：Phase 5 的修复应以“前端能展示 tool_use”为最低门槛；如后端确实发送 `tool_result`，则一并展示。

**影响**：可观测性极差，"等了几分钟前端只有猫猫在思考"

**修复**：登记 BACKLOG，Phase 5 或之前修复

---

## 9) Phase 5.1 最小增量锚点

> 以下锚点来自研究报告 `docs/archive/2026-02/research/agent-memory-research-report.md` + 三猫+铲屎官共识 (2026-02-09)。
> 参数细节见 `docs/phases/phase-5.1-memory-operation-profiles.md`。

1. **Retain 6 个月价值原则**：只存"6 个月后仍有用"的信息；提取规则走 Hindsight custom instructions。
2. **Narrative Fact 最低结构**：结论 + 依据 + 时间 + 参与者/实体；碎片化 fact 不合格。
3. **Recall strict tags**：默认 `tagsMatch=all_strict`、`budget=mid`、`limit=5`；图策略用 `link_expansion`。
4. **Step 3 治理清单**：记忆爆炸、实体漂移、观点僵化、上下文溢出、隐私泄露 — 每项有缓解措施。
5. **Disposition 延后**：仅预留 `template_only` 模式，不实现运行时个性化 Reflect。后续 Phase 5 后半或 Phase 6。

---

*签名：缅因猫🐾（基于三猫辩论共识，已吸收 2026-02-08 Hindsight 澄清）+ 布偶猫🐾（补充拍板记录）+ 🐬铲屎官（最终拍板 2026-02-08）*
