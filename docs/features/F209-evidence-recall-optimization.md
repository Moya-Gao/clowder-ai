---
feature_ids: [F209]
related_features: [F102, F188, F200, F192]
topics: [memory, evidence-recall, passage-vector, entity-anchor, perspective, eval]
doc_kind: spec
created: 2026-05-21
---

# F209: Evidence Recall Optimization — 消息级语义、实体门牌号与活查询藤

> **Status**: spec | **Owner**: 缅因猫/砚砚 | **Priority**: P1

## Why

铲屎官提出一个现实用户问题：普通人不会认真分 thread，一个 thread 里可能同时聊技术、rua 猫、红巨星、战争新闻、金融分析和家人健康。等 session 被压缩后，用户会说“你失去记忆了”。如果系统只靠 ChatGPT / Claude.ai 那种被动摘要注入，就会出现两个问题：

1. 摘要可能过期、漏掉 tradeoff、混淆边界。
2. 模型会一本正经地拿摘要当真相源回答。

Cat Café 现有 F102 / F188 已经走了另一条路：`search_evidence` 找候选证据，猫读原文判断。但本轮代码剖面确认：当前检索还有一个关键缺口——`depth=raw` 仍是 lexical-only，因为 passage-level vectors 还没有做。也就是说，消息原文虽然进了 `evidence_passages`，但“没有出现精确字面词”的旧聊天仍不稳。

F209 的目标是把 evidence-first recall 推到终态一层：**消息级语义召回 + 实体门牌号 + typed 原文窗口 + 活查询 Perspective + retrieval eval**。它不做摘要记忆，不做算法路由，不替猫判断，只让猫更快抓到可审计原文。

讨论来源：`docs/discussions/2026-05-21-chat-memory-and-evidence-recall/04-current-retrieval-state-and-f209-optimization.md`

## Architecture Cell

```markdown
Architecture cell: memory
Map delta: update required during Design Gate
Why: 本 feature 扩展 Memory / Evidence 的 retrieval grain（passage vector）、anchor 类型（entity）、drill-down reader 与 Perspective 视图边界。
```

## What

F209 完整终态包含五层：

1. **Passage-level semantic recall**：message / transcript passage 也能 semantic/hybrid 检索。
2. **Entity anchor / alias registry**：人、猫、功能、外部概念有确定门牌号。
3. **Typed message-window drill-down**：搜到 message / invocation / file 后能打开合适窗口，不打开巨型 blob。
4. **Perspective live query plan**：保存“常顺的藤”，每次现场重跑，不存结果。
5. **Retrieval eval**：用真实 golden queries 验证召回，不让 F200 消费信号变成 rich-get-richer。

核心边界：

> 系统给线索 + 坐标 + 可打开的原文窗口；猫读证据、判断、沉淀 artifact。

## Non-goals

- 不做小模型 topic splitter。
- 不做摘要注入式 memory。
- 不做自动 topic map 真相源。
- 不做算法替猫判断 intent。
- 不把 Perspective 的结果缓存成“事实”。
- 不用 entity / facet 推断替代原文证据。

## Phase A: Passage-level Semantic Recall

让 `depth=raw` 支持 semantic/hybrid，而不是强制降级 lexical。

### Acceptance Criteria

- [ ] AC-A1: `evidence_passages` 的 message / transcript passage 有 embedding path（`passage_vectors` 或等价结构）。
- [ ] AC-A2: `search_evidence(depth=raw, mode=semantic)` 能走 passage-level NN，而不是降级 lexical。
- [ ] AC-A3: `search_evidence(depth=raw, mode=hybrid)` 用 passage BM25 + passage vector NN 做 RRF。
- [ ] AC-A4: raw results 仍返回 `passageId`、speaker、timestamp、contextWindow、thread/message anchor；不返回“摘要结论”。
- [ ] AC-A5: embedding unavailable 时 fail-open 到 lexical，并明确 `degraded/effectiveMode`。

## Phase B: Entity Anchor / Alias Registry

把实体做成一等检索轴，解决 `landy` / `铲屎官` / `CVO` 这种别名误伤。

### Acceptance Criteria

- [ ] AC-B1: 有 durable entity registry，支持 `entity_id`、aliases、type、provenance、updated_at。
- [ ] AC-B2: `search_evidence` query 可进行确定性 alias expansion；alias 字典不是 classifier。
- [ ] AC-B3: 索引层可记录 entity mentions，结果能解释“为何命中 person:landy / cat:gemini”。
- [ ] AC-B4: entity 与 project/global/library/collection 联邦检索兼容。
- [ ] AC-B5: 隐私实体默认受 scope 控制，不跨域泄漏。

## Phase C: Typed Drill-down Readers

统一 anchor contract，但保留 typed readers，不造万能黑盒。

### Acceptance Criteria

- [ ] AC-C1: 支持 message window reader：按 `threadId + messageId + before/after` 打开上下文。
- [ ] AC-C2: 支持 invocation detail reader：按 invocationId 打开工具调用 / 输出 / 状态细节。
- [ ] AC-C3: 支持 file slice reader：按 path + line range 打开文档或代码切片。
- [ ] AC-C4: `search_evidence` 结果为不同 sourceType 给明确 drill-down hint。
- [ ] AC-C5: 大文件 / 大 thread 默认窗口化，不一次塞全文。

## Phase D: Perspective Live Query Plans

从 Smart Folder 学“存问题，不存结果”。

### Acceptance Criteria

- [ ] AC-D1: Perspective 存 query plan / route recipe，不存结果集。
- [ ] AC-D2: 打开 Perspective 时现场重跑，结果全带 anchor + drill-down。
- [ ] AC-D3: Perspective 可由猫保存 / 命名 / 复用；默认用户不是操作员。
- [ ] AC-D4: skill / 任务可激活建议 Perspective，但只给“藤”，不下结论。
- [ ] AC-D5: Perspective 消费信号可进入 F200 navigation utility，不改变 truth / authority。

## Phase E: Retrieval Eval + Feedback Loop

避免“更聪明但更偏”的检索回归。

### Acceptance Criteria

- [ ] AC-E1: 建立 golden query set，至少覆盖旧聊天、实体别名、非字面语义、feature provenance、跨 collection。
- [ ] AC-E2: 指标包含 recall@k、anchor open rate、false confidence rate、raw drill-down success。
- [ ] AC-E3: F200 consumption rerank 对 navigation utility 生效，但不得改变 authority/truth。
- [ ] AC-E4: 有 freshness / exploration 对冲，防 rich-get-richer。
- [ ] AC-E5: 每个 Phase 至少新增 2 条回归 fixture。

## Dependencies

- **Related / base**: F102 Memory Adapter Refactor — evidence store、passages、raw lexical、KnowledgeResolver。
- **Related**: F188 Library Stewardship — navigation / collection 维度。
- **Related**: F200 Memory Recall Eval — consumption signal 与召回评估。
- **Related**: F192 Socio-Technical Harness Eval — eval contract / finding→action 框架。

## Risk

| 风险 | 缓解 |
|------|------|
| embedding 被误解成“模型替猫判断” | AC-A4 强制返回 anchor + context；embedding 只做 sensor，不做 conclusion |
| entity/facet 推断污染真相源 | alias 只做确定字典；candidate facet 必须标 candidate + provenance |
| raw hybrid 召回噪音变大 | Eval golden set + false confidence rate + contextWindow |
| Perspective 变成固化 topic map | 只存 query plan，每次现场重跑；不存结果 |
| F200 consumption rich-get-richer | exploration/freshness 对冲；consumption 不影响 authority |
| 大 thread / 大文件把猫上下文撑爆 | typed reader 默认窗口化，禁止大 blob 默认展开 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `passage_vectors` 复用现有 vector store，还是独立 passage vector table？ | ⬜ Design Gate |
| OQ-2 | message passage embedding 是热路径 append 即 embed，还是批处理？ | ⬜ Design Gate |
| OQ-3 | entity registry 真相源放 docs、DB，还是 DB + git-backed export？ | ⬜ Design Gate |
| OQ-4 | candidate facet 如何表达，才能让猫一眼看出“不是真相”？ | ⬜ Design Gate |
| OQ-5 | typed reader 是新增 MCP tools，还是扩现有 read_session/read_invocation 家族？ | ⬜ Design Gate |
| OQ-6 | Perspective 的创建入口：猫手动保存、F200 自动建议、还是 settings 可见？ | ⬜ Design Gate |
| OQ-7 | initial golden query set 谁维护，是否由 F200 统一收？ | ⬜ Design Gate |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立新号 F209，不只挂 F102 Phase K/K3 | 范围已超过 passage vector：包含 entity anchor、typed drill-down、Perspective、eval 闭环 | 2026-05-21 |
| KD-2 | 优化召回，不替猫判断 | 贯彻 agentic search：系统给候选 + 坐标，猫读原文 | 2026-05-21 |
| KD-3 | 统一 anchor contract，不统一读取实现 | file/message/invocation/thread 的最佳读取方式不同；统一成万能 reader 会制造巨型 blob | 2026-05-21 |
| KD-4 | Embedding 是 sensor，不是判断者 | 只要结果带 anchor + 原文窗口，语义召回不会违反 KD-8 | 2026-05-21 |
| KD-5 | Perspective 存 query plan，不存 result set | 结果集会 stale；活查询每次现场重跑才保鲜 | 2026-05-21 |

## Eval / Tracking Contract

| 项 | 内容 |
|----|------|
| **Primary Users** | 需要从旧 thread/docs/sessions 找证据的猫；Activation Signal：`search_evidence` 在复杂 thread recall 中被调用 |
| **Friction Metric** | 搜到摘要但打不开原文窗口的比例；raw 搜不到但人工能在 transcript 找到的比例；>3 轮 query reformulation |
| **Regression Fixture** | ① `depth=raw&mode=hybrid` 不再静默 lexical-only ② `landy/铲屎官/CVO` alias 能归一到同一实体候选 ③ Perspective 打开后现场重跑且结果带 anchor，不返回固化结果集 |
| **Sunset Signal** | 6 个月内 golden query recall@k 无提升，或猫仍主要绕过 F209 直接人工 grep transcript → 回滚 Perspective / entity layer，仅保留 passage vector |

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | “一个 thread 什么都聊，压缩后你能找回之前记忆吗？” | AC-A1~A5, AC-C1 | raw semantic + message window fixture | [ ] |
| R2 | “不要小模型替猫思考，search_evidence 为什么不能用在群聊里？” | KD-2, AC-A4 | 搜索只返回候选 + anchor；猫读原文 | [ ] |
| R3 | “每条消息都有 invocation，这样不就能搜了？” | AC-C1, AC-C2 | message / invocation typed readers | [ ] |
| R4 | “Everything 为什么那么快，SmartFolder 是否能找奶奶相关内容？” | AC-B1~B5, AC-D1~D5 | entity alias + Perspective walk-through | [ ] |
| R5 | “现在检索有 bm25/embedding/docs/thread/msg，先列现状再优化” | discussion 04 + KD-1 | discussion doc review | [x] |
| R6 | “别补锅，要用我们现有 search_evidence / graph_resolve / list_recent 思路” | KD-3, Non-goals | spec 不引入摘要 memory / 小模型 splitter | [x] |

### 覆盖检查

- [x] 每个需求点都能映射到 AC / KD
- [x] 每个 AC 有验证方式
- [x] Eval Contract 存在（memory / MCP / harness 行为变更）
- [ ] Design Gate 时补 Architecture map delta 细节

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-21 | 铲屎官追问 ChatGPT / Claude.ai 产品记忆边界，形成 01/02/03 讨论 |
| 2026-05-21 | Codex 代码剖面确认当前 `depth=raw` lexical-only、passage-level vector 未做 |
| 2026-05-21 | 立项 F209 |

## Review Gate

- Design Gate：猫猫讨论 → CVO 拍板（架构级；会改变 memory ownership cell 的边界说明）
- Phase A：跨族 review（passage vector + raw hybrid 语义边界）
- Phase B：跨族 review（entity alias / privacy / provenance）
- Phase C：跨族 review（typed reader contract）
- Phase D：跨族 review + CVO product review（Perspective 语义）
- Phase E：F200/F192 owner review（eval contract + telemetry）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Discussion | `docs/discussions/2026-05-21-chat-memory-and-evidence-recall/04-current-retrieval-state-and-f209-optimization.md` | 当前检索剖面 + 本 feature 来源 |
| Prior discussion | `docs/discussions/2026-05-21-chat-memory-and-evidence-recall/03-everything-smartfolder-microinnovations.md` | Everything / Smart Folder 微创新 |
| Feature | `docs/features/F102-memory-adapter-refactor.md` | evidence store / passage / raw lexical 基座 |
| Feature | `docs/features/F200-memory-recall-eval.md` | retrieval consumption / eval 反馈 |
