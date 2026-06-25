---
doc_kind: research-synthesis
topics: [memory, retrieval, mcp, agent-surface, epistemic-labels, trilogy-synthesis]
created: 2026-06-24
status: draft
authored_by: "@opus-47 [宪宪/Opus 4.7🐾]"
parent_reports:
  - ./cat-cafe-memory-agent-surface.md
  - ./openviking-agent-surface.md
  - ./atommem-agent-surface.md
reviewer_audits:
  - ./reviewer-audit-cat-cafe-baseline.md
  - ./reviewer-audit-openviking.md
  - ./reviewer-audit-atommem.md
covers:
  - cross-system-synthesis
  - adr-draft
  - lessons-candidates
  - cvo-decision-packet
  - f243-implications
---

# Memory Systems Agent Surface — Trilogy Synthesis

> 6 份产物收尾的判断性沉淀（3 份 baseline + 3 份 reviewer audit）。本文做四件事：跨系统结论提炼 + ADR 草稿 + lessons 候选 + CVO 决策点。
> Trilogy 阅读顺序与各报告导航见 [README.md](./README.md)。

## 0. Executive Synthesis

> **3 个 memory system 全部 L2 / L3 第 9 镜头 Fail —— 这不是个别项目 bug，是 RAG/memory 工具链系统性盲点**。

| System | Stars | Agent-Surface Verdict | L1 | L2 | L3 |
|---|---|---|---|---|---|
| Cat Cafe (longform-002) | n/a (internal) | First-party MCP + 9 axes 全覆盖 + 唯一有 epistemic labels 的 | Pass | **Fail（partial — 知道 hazard）** | **Fail（soft enforcement）** |
| OpenViking | 25,969 | 真 production system + broad MCP surface + tenant scoping | Pass | **Fail** | **Fail** |
| AtomMem | 14 | 研究 demo + 无 MCP + 算法 idea 有亮点 | Partial | **Fail** | **Fail** |

**Trilogy 最锋利结论**：

1. **L2 epistemic labels（generated vs observed）这条**，三家全 Fail——但 cat-cafe 是**唯一在 schema 层做了准备**的（authority / confidence / sourcePath / passages 字段都有），只是**enforcement soft + `confidence` 命名易误读**
2. **L3 epistemic loop closure（correction / verify / writeback）这条**，三家全 Fail——cat-cafe 也只是"raw drill-down 让 verify 容易"，**没有 structured correction API**
3. **cat-cafe 真护城河被三方对比 confirmed**：在 OV / AtomMem **完全没有**或**弱实现**的维度上，cat-cafe 是**唯一做了正确事**的——这次拆解的核心收获是"**确认我们做对了方向**"，不是发现新坑

## 1. 9-Axis Synthesis Table

trilogy 三方 9 axes 收敛对比（每行 Cat Cafe / OV / AtomMem）：

| Axis | Cat Cafe | OpenViking | AtomMem |
|---|---|---|---|
| 1. Truth source | Markdown / runtime traces 真相源，DB/vector 编译层 | viking:// URI raw + LLM sidecars 混合 | LLM-generated JSON rows 主，raw LoCoMo data 在 split_samples |
| 2. Ingestion | Authored docs + traces + scanner，generated summaries 带 sourcePath | LLM/VLM sidecars + memory extraction，无 observed/generated label | LLM fact/event/profile pipelines + SFT data branch（BYO finetune） |
| 3. Retrieval | **BM25/FTS + vector + RRF hybrid** + graph/recent | Dense+sparse vector + L0/L1/L2 hierarchy + 旁路 grep/glob | Embedding cosine + Jaccard + event compensation + PPR/RWR rerank |
| 4. MCP surface | 三入口 + raw drill + session-chain，typed schema | **15 @mcp.tool**（13/14/15 doc drift），broad coverage | **None**（demo HTTP + Python only） |
| 5. Raw drill-down | sourcePath + read_file_slice + session-chain tools | **Strong**：read(uri) + grep + glob + code tools | Weak：dia_id anchor 无 read 工具 |
| 6. Epistemic labels | **authority/confidence/sourcePath/passages/ranking factors** — 唯一做了 | **score/level/context_type** 不分 observation vs generation | 几乎完全没有 |
| 7. Skill contract | memory-navigation / memory-search-best-practices first-party | OpenClaw plugin 是 official-ish（不是 vanilla OV） | None — agent 须自己包 |
| 8. Feedback loop | F200 consumption signals + ranking factors + outputVerified bridge | active_count / hotness（默认 off）+ watches + recall traces | 仅 memory write loop，无 eval/user correction repair |
| 9. Multi-collection / tenant | Collection/dimension routing + server-derived visibility + federated RRF | **Strong**：account_id + visible_roots + actor-peer + server-side filters | **None**：`conversation_id` 文件命名 + 全局 FACTS_DIR + global config mutation |

**横向看一眼就懂**：cat-cafe 在 Axes 1 / 6 / 8 是**唯一做对的**，OV 在 Axes 4 / 5 / 9 是**最强工程的**，AtomMem 在 Axes 3 graph rerank idea 上有 algorithmic credit 但其他基本全弱。

## 2. Cross-System Lessons Candidates

按 6 份 reviewer audit 提炼合流（每条都附跨系统证据）：

### L1: Generated Content 没有 source-tier label = 给 agent 制造死路（**ADR 候选**）

**证据**：
- cat-cafe：schema 层有 authority/confidence/sourcePath，但 `confidence` 命名易误读为 truth confidence（reviewer-audit-cat-cafe-baseline §3 Q1/Q2）
- OV：`MatchedContext` 字段 `uri/context_type/level/abstract/overview/category/score/match_reason/relations` — grep `authority|confidence_tier|source_tier|trust_level` 0 命中（review-and-cat-cafe-synthesis §B）
- AtomMem：facts/events/profiles 完全没有 epistemic 字段（atommem-agent-surface §1 ledger 最后一行）

**判断**：三系统全 Fail → 不是项目 bug，是工具链系统性盲点 → **应升级到 ADR**（详见 §3 草稿）

### L2: Agent Surface 的 Product Credit > Algorithm Credit

**证据**：
- AtomMem 有 graph rerank algorithm credit（seed-only PPR/RWR + 三通道 graph）但 agent-surface verdict 仍然弱（无 MCP / 无 raw drill / 无 correction）
- OV exact-recovery tool suite（grep/glob/code_outline/code_search/code_expand）= product credit，让 agent 能续工作
- agent-facing 视角下，**再好的 ranking algorithm，agent 拿不到 raw drill-down 还是死路**

**判断**：cat-cafe 设计取舍——retrieval 智能放在 backend（hybrid RRF）vs agent skill（memory-search-best-practices），dependency direction 不同；OV/AtomMem 把"算法做对"当 product proxy，但 agent 不接界面也无效。**lesson candidate**：value memory system by agent-callable surface first, not by ranking benchmark.

### L3: BYO Model Claim 默认 source-audit

**证据**：
- AtomMem SFT：4352 records 公开但无 training script / weights / eval table —— "BYO fine-tuning" 不是"已交付小模型"
- OV：Ollama 支持 + `bge-small-zh-v1.5-f16` 默认 embedding（24MB），但 small VLM/LLM L0/L1 质量未证（OV ingestion deep-dive §2.5）
- 都没构成"已交付经过 eval 的小模型工作流"

**判断**：source-audit skill trigger list 应加 "research demo / open-source memory system 提到 small-model claim 时默认追 (data / script / weights / eval table) 四件套"——这是 ADR-031 source-audit 的具体场景扩展。**自决可改 source-audit skill**。

### L4: Doc / Log / Code Drift 是 Agent Contract 风险（P1）

**证据**：
- OV：源码 15 `@mcp.tool` decorators / docs 写 14 tools 且叫 `store` / lifespan log 写 13 tools 且少 list_watches+cancel_watch（openviking-agent-surface §2 Tool Count / Naming Drift）
- 工具名/数量是 agent contract — **三个真相源不一致 = agent 会 hallucinate 不存在的能力或漏调存在的工具**

**判断**：cat-cafe 自己应该检查 `cat_cafe_*` 工具的源码 / docs / runtime-injected guide 三处是否一致——可以是 lint / harness eval / weekly CI check（按 ADR-031 三层落地：硬层 lint + eval 层 weekly verdict）。**lesson candidate**。

### L5: 不可逆操作只靠 docstring 软约束 = P0 反模式

**证据**：
- OV `forget(uri)` 直接 `Deleted: uri`，docstring 说"confirm first"但工具本身无法 enforce（openviking-agent-surface §10 第 4 项 P0 标注）
- cat-cafe 家规第 1/5 条（不可逆操作 / 用户状态持久化）已经在治这个病

**判断**：cat-cafe 现有不可逆边界做得对（Redis 6399 圣域 / commit-as-truth / 跨个体 review），但 MCP tool 写界面（如 `cat_cafe_create_task` / `propose_thread`）也应该过一遍这个判据——确认没有 default-permitted destructive action 只靠 docstring。**lesson candidate**。

### L6: Prompt Drift（evaluation 与 production 不同源）

**证据**：
- OV：blind-test 用 `parsing/context_generation.yaml` 评测 L0/L1，但**生产路径**用 `semantic.{code_ast_summary, code_summary, document_summary, file_summary, overview_generation}` 5 个独立模板（OV ingestion deep-dive §2.1）
- 评测结论"OV-style prompt shape 在 strong model 下 10/10 index-ready" 不等于"OV 生产路径质量"

**判断**：source-audit skill 触发场景应包含"评测的 prompt/code path vs 生产的 prompt/code path 是否同源"——这是 ADR-031 的另一个具体扩展。**自决可改 source-audit skill**。

## 3. ADR 草稿：Generated Content Must Preserve Source-Tier

> 本草稿是 CVO 直接 review 的候选 ADR。如批准 → 落到 `docs/decisions/` 下编号；如降级 → 落到 lessons-learned。

---

### ADR-XXX: Memory/Index/Sidecar 设计中 Generated Content 必须保留 Source-Tier 元数据

**Status**: Proposed
**Date**: 2026-06-24
**Authors**: @opus-47 (synthesis) + @codex (trilogy author)
**Context source**: Memory Systems Agent Surface Comparison trilogy (3 reports + 3 reviewer audits)

#### Context

Cat Cafe 通过 trilogy（vs OpenViking 25k stars + AtomMem 14 stars）拆解发现：

- 3 个 memory system **全部** L2 / L3 第 9 镜头 Fail —— 不是个别项目 bug，是 RAG/memory 工具链系统性盲点
- cat-cafe 是**唯一在 schema 层做了 epistemic labels 准备**的（authority/confidence/sourcePath/passages/ranking factors）
- 但 enforcement soft + `confidence` 命名易误读 + 新增 memory/index/sidecar 没有强制约束

#### Decision

Cat Cafe 所有 memory / index / sidecar / extracted-fact / generated-summary 类数据，**写入持久层时必须满足**：

1. **`generated` 标签必现**：generated content（LLM 抽取 / 摘要 / 推理 / 合并）必须有显式 `generated: true` + `generated_by: <model_id+prompt_id>` + `generated_at: <timestamp>`
2. **`source_anchor` 必现**：generated content 必须 link 回 raw observation（doc URI + line range / message ID + turn / file SHA + offset）
3. **`observed` 标签必现**：raw observation（user 原话 / file content / commit message）必须 `observed: true`，不与 generated 字段共存
4. **`authority` / `confidence` 字段语义**：
   - `authority` = 来源权威度（constitutional / observed / candidate / proposed）—— 离散等级
   - `confidence` 字段**必须 rename 为 `rankConfidence`**（rename 是 P1 breaking change，schema migration 计划另议）
   - 引入 `truthConfidence`（可选）作为独立字段，区分"语义相关性"与"事实可信度"
5. **retrieval 输出 schema 必须暴露 source-tier**：agent 拿到 result 不能 default 当 observation；schema 必须有 `source_tier` field

#### Constraints

- 适用于**新增的** memory / index / sidecar / scanner 设计（F243 / 任何新 memory feat）
- 现有 `evidence_docs` schema **不**立即 migrate（schema migration 另议）；但任何**修改**现有 schema 的 PR 须 enforce 本 ADR
- 不适用于 ephemeral retrieval cache / debug telemetry（这些是 traversal trace 不是 epistemic state）

#### Consequences

**Positive**：
- 三系统拆解明确证明这条 ADR 是 cat-cafe 护城河之一；不写 ADR = implicit 纪律可能在新 feat 设计时被遗忘
- 未来跨 family 设计 memory tool 时有共同基础（不会出现"忘了加 epistemic label"的 silent regression）

**Negative**：
- 新 feat 设计 surface 多一条 mandatory check
- `confidence` rename 是 breaking change（独立 P1 issue）

**Migration**：
- Phase 0（本 ADR 通过即生效）：新 memory/sidecar/scanner feat 设计必须 conform
- Phase 1（独立 P1）：`confidence` rename 为 `rankConfidence` + schema migration
- Phase 2（可选）：现有 evidence_docs schema 补 `generated_from` / `source_anchor` fields

#### Alternatives Considered

- **不写 ADR，留在 lessons-learned**：implicit 纪律继续靠 W7 Knowledge Feed + reviewer 把关。简单但风险是新 feat 设计时可能遗忘。
- **更严格 ADR**：现有 schema 立即 migrate。工作量太大且与 cat-cafe 现有 priority 冲突。

#### References

- Memory Systems Agent Surface Comparison trilogy（`docs/discussions/2026-06-24-memory-systems-agent-surface/`）
- AtomMem deep-dive ingestion teardown（`docs/discussions/2026-06-23-openviking-deep-dive/ingestion-llm-judge-deep-dive.md`）
- ADR-031 source-audit
- F218 source-audit reflexes
- longform-002 §memory（cat-cafe self-baseline）

---

## 4. CVO Decision Packet

### 4.1 Must Decide

| # | Item | Options | 我的建议 | 取舍 |
|---|---|---|---|---|
| D1 | ADR 草稿（§3） | A: 写成正式 ADR 落 `docs/decisions/` ；B: 降级到 `lessons-learned` ；C: 拒绝（不需要） | **A: 写正式 ADR** | 三系统横向证据充分；implicit 纪律有 silent regression 风险；ADR 不阻塞现有 schema，只约束新 feat |
| D2 | `confidence` rename 为 `rankConfidence` | A: 启动独立 P1 issue（schema migration + 所有 consumer）；B: 留到 ADR Phase 1；C: 不改（接受 hazard） | **B: 留到 ADR Phase 1** | rename 工作量大 + 现在三系统对比 momentum 应该 commit ADR 不 fork 独立 issue |

### 4.2 Information Updates（不需拍板）

- Trilogy 6 份产物 + README + 本 synthesis 全部 published（不可逆操作 / 用户状态持久化范畴外，文档自决）
- 跨项目 lesson 候选 6 条（§2 L1-L6）已 surface；其中 L3+L6 我下棒自决合并到 source-audit skill trigger list
- F243 / memory sidecar 设计影响（§5）— 给 F243 owner 信号通报

### 4.3 自决范围（不需拍板，事后通报）

| # | Action | Owner | When |
|---|---|---|---|
| A1 | source-audit skill 加 trigger："research demo / open-source memory system reproducibility + BYO model claim + prompt drift 警觉" | @opus-47 我 | 下一棒 |
| A2 | lessons-learned 加 L4 + L5（doc/log/code drift + irreversible docstring-only confirmation 反模式）| @opus-47 我 | 下一棒，与 A1 同 commit batch |

## 5. F243 / Memory Sidecar 设计影响

trilogy 给 F243（或任何未来 memory/sidecar feat）的具体建议：

### 5.1 可借鉴的 Ergonomics

- **OV 的对称读契约**：`abstract(uri)=L0 / overview(uri)=L1 / read(uri)=L2` 三个干净 API。cat-cafe 现有 `search_evidence` 是 mode-based（mode=raw/summary），未来可考虑显式分层 read API 作为 alternative ergonomics
- **AtomMem 的 temporal profile versioning**：`valid_from/valid_to/history[]` 不覆盖只追加，是诚实的 evolving state 表达
- **OV 的 sidecar bottom-up 异步生成**：`.abstract.md`/`.overview.md` 与内容同目录 + 异步 SemanticQueue + 写锁 + stale 检查——工程纪律可参考
- **OV 的 exact-recovery 工具暴露**：cat-cafe `search_evidence` 已有 BM25/FTS，但**没暴露独立 `grep` MCP tool 给 agent**——这是可补的 gap（agent 想找 "F168" 这种 exact ID 时，专门 `grep` tool 比 `search_evidence mode=lexical` 更精准）

### 5.2 反对例（不学）

- **不学 OV 的 flat MCP search result schema**：MCP `find/search` 把 HTTP JSON 的 `query_plan / provenance / match_reason / level` 全 strip 成 `[resource 82%] uri + abstract` —— agent 拿到的信息密度低于 HTTP layer。cat-cafe MCP 输出应该保留完整 epistemic schema
- **不学 AtomMem 的 demo-as-agent-contract**：`/api/chat` 只返回 `assistant_message` 不返回 evidence —— agent 用不了。cat-cafe MCP 必须 return retrieval evidence + drill-down hints
- **不学 OV 的 docstring-only confirmation for irreversible deletes**（§2 L5）：cat-cafe 任何 destructive MCP tool（如未来 `cat_cafe_forget` 类）必须有 hard confirmation boundary
- **不学 OV 的 13/14/15 tool count drift**：agent contract 三处真相源同步是硬约束

### 5.3 cat-cafe 现做对的方向（继续投资）

- ✅ BM25/FTS + vector + RRF hybrid（vs OV 单路 / AtomMem 单路）— 双路设计正确
- ✅ Multi-collection / dimension routing + federated RRF + server-derived visibility（vs OV account-level / AtomMem 无）— 多租户设计已经走在前面
- ✅ authority / confidence / sourcePath / passages / ranking factors schema（vs OV/AtomMem 无）— 唯一做了正确事

## 6. Open Questions / Follow-up

1. **`rankConfidence` rename schema migration** 何时启动？（D2 = B 的 Phase 1）—— 不阻塞 ADR 本身
2. **`evidence_docs` 现有 schema** 是否补 `generated_from` / `source_anchor` fields？（ADR Phase 2）—— CVO 可后续单独决定
3. **cat-cafe MCP `cat_cafe_grep` 工具** 是否暴露给 agent 作为 exact-recovery？（§5.1 OV 借鉴 + cat-cafe `search_evidence` 已有 BM25 但没 grep MCP）—— 候选 F 号
4. **L4 lint/harness eval（doc/log/code drift detection）** 是否启动？—— 候选 F 号 + ADR-031 三层 implementation 信号

---

**Trilogy 收尾**：6 份产物 + README + synthesis 完整 published。下一棒铲屎官 CVO 拍 D1/D2 → 我下棒自决做 A1/A2。

[宪宪/Opus 4.7🐾]
