# Phase 5.0: 上下文工程（Layer 1/2）— Evidence‑first 检索 + 协作记忆治理（Hindsight）

> 提议者：缅因猫（Codex）  
> 日期：2026-02-08  
> 状态：**草案（待铲屎官拍板）**

本 Phase 的目标：把「上下文工程」从口号落到**可验证、可审计、可渐进交付**的工程能力上，优先补齐 Layer 1/2（索引/检索）缺口，同时把协作记忆纳入治理体系。

---

## 0) 参考输入（本 Phase 的“证据锚点”）

- 四层模型原讨论：`docs/discussions/2026-02-07-context-enginnering/intro-discuss-with-claude-app-opus4.5.md`
- 辩论赛完整记录（备份）：`docs/discussions/2026-02-07-context-enginnering/result/cat_cafee_context_engineering_debate_log.md`
- 布偶猫纪要（记忆派）：`docs/discussions/2026-02-07-context-enginnering/result/ragdoll-debate-summary.md`
- 暹罗猫纪要（体验派）：`docs/discussions/2026-02-07-context-enginnering/result/gemini-meeting-minutes.md`
- 缅因猫纪要（融合版）：`docs/discussions/2026-02-07-context-enginnering/result/codex-meeting-minutes.md`
- Hindsight 重大澄清（外部服务已部署）：`docs/mailbox/2026-02-08-hindsight-clarification-to-maine.md`
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
- Hindsight 外部服务（据 `docs/mailbox/2026-02-08-hindsight-clarification-to-maine.md`）：铲屎官本地已通过 Docker 部署，可直接调用 Retain/Recall/Reflect API（无需我们在 Cat Café 代码里“自己实现一个记忆系统”）。

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
- Bank 隔离优先：把 `scope` 映射为 bank（例如 `cat-cafe-shared` / `cat-cafe-{catId}` / `cat-cafe-{project}`），而不是把所有东西塞进一个 Redis Hash。  
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

- `F3b` 协作记忆（Hindsight 集成）— Phase 5 主线（治理 + bank 分层 + recall/reflect）。  
- `#19` 自动讨论纪要生成 — Phase 5 的“自动沉淀”入口（Summary→Memory 候选），建议作为 Step 2a 的加速器而非 gate。  
- `#32` DegradationPolicy 绑定实际链路 — 证据检索/记忆 publish 过程必须可降级，并给出用户可理解的 system_info。  

（其余 P2/P3 项可不强行并入 Phase 5，避免范围膨胀。）

---

## 8) 需要铲屎官拍板的 7 个问题（开工前）

1. Hindsight Docker 的连接参数是否确认？（URL/端口/是否鉴权/环境变量命名）  
2. Bank 设计怎么定？（`cat-cafe-shared` / `cat-cafe-{catId}` / `cat-cafe-{project}` 是否需要 thread 维度？）  
3. F3‑lite `/remember` `/recall` 与 Hindsight 的分工是什么？（分层：临时 vs 持久；还是最终迁移到 Hindsight？）  
4. 发布门禁（24h 提醒 + 互审/签核）放在哪里实现？（Cat Café 调用层 vs Hindsight metadata；状态持久化方案）  
5. Step 1 的 evidence 检索是否直接复用 Hindsight Recall？若是：哪些内容要批量 Retain（docs/decisions/phases/discussions + git lineage）以及同步策略（手动/定时/增量）？  
6. Reflect 的触发策略与默认模型是什么？（每日定时 / 讨论结束 / 手动命令；以及 provider 配置）  
7. UX 以什么方式呈现最合适？（系统消息 vs 卡片；折叠/展开；失败降级提示）  

---

*签名：缅因猫🐾（基于三猫辩论共识，已吸收 2026-02-08 Hindsight 澄清）*
