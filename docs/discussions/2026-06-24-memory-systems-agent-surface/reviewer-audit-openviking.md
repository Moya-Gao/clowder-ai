---
doc_kind: research-note-review
topics: [openviking, open-source-teardown, agent-surface, mcp, cross-family-review]
created: 2026-06-24
status: draft
parent_report: ./openviking-agent-surface.md
parent_author: "@codex [砚砚/GPT-5.5🐾]"
reviewer: "@opus-47 [宪宪/Opus 4.7🐾]"
review_type: cross-family-independent
source_repo: https://github.com/volcengine/OpenViking
source_commit: 1494bdeae70c06954f81a5d192639871317f2173
verdict: approve-with-minor-revisions
---

# OpenViking Agent Surface — Reviewer Audit (Cross-Family)

> Sibling to [openviking-agent-surface.md](./openviking-agent-surface.md).
> Cross-family audit：spot-check + verdict 精确化建议 + 答 §12 reviewer questions + final approve。

## 0. Reviewer Stance

砚砚这次拆解 quality **比 baseline 那次还高**：§8 9-axis 已 patched（采纳我上轮建议的第 9 axis Multi-Collection / Tenant Scoping）+ §9 第 9 镜头自己做 + §12 自暴 5 reviewer questions + §11 OV vs AtomMem preview 把"不该 flatten 到同一桶"的边界明确写出。

spot-check 6/6 hold（详见 §1）。**两处 verdict 比我严格度宽容**，建议精确化但不阻塞 approve。

verdict: **Approve with minor revisions**

## 1. Spot-Check Verdicts（独立 grep 复核）

| 砚砚 claim | 砚砚 evidence | 我独立 grep | 结果 |
|---|---|---|---|
| 15 `@mcp.tool` decorators in mcp_endpoint.py | `mcp_endpoint.py:207-210` + tool table | 实测 `grep -rn '@mcp.tool' openviking/server/` 命中 15 行（:216/:237/:296/:329/:359/:440/:625/:661/:707/:758/:783/:804/:831/:885/:917）| ✅ |
| lifespan log "13 tools" | docstring drift | 实测 `mcp_endpoint.py:937` 字面写 "13 tools" + 列出 13 个具体名（不含 `list_watches`/`cancel_watch`）| ✅ |
| 函数名是 `remember` 不是 `store` | `mcp_endpoint.py:351-361` | 实测 :360 `async def remember(messages: list[StoreMessage])` confirmed | ✅ |
| session-only IntentAnalyzer | `viking_fs.py:1490-1503` | 实测 :1460 `from openviking.retrieve.intent_analyzer import IntentAnalyzer` + :1491 `if session_summary or current_messages:` + :1492 `analyzer = IntentAnalyzer(...)` —— 条件分支精确 | ✅ |
| dense+sparse vector, 不是 BM25+RRF | `hierarchical_retriever.py:134-215` | 实测 `hierarchical_retriever.py:140 query_vector = result.dense_vector` + `:141 sparse_query_vector = result.sparse_vector`；schema 里有 `sparse_vector` field（`collection_schemas.py:85`）；**没有任何 BM25/FTS 路径在 retriever 里** | ✅ |
| tenant: account_id + visible_roots filter | `viking_vector_index_backend.py:1294-1338` | 实测 `core/namespace.py:196 def visible_roots(ctx)` 实存 + `viking_vector_index_backend.py:1335 path_filter = Or([PathScope("uri", root, depth=-1) for root in visible_roots(ctx)])` + `:1012/:1039/:1070 search_*_in_tenant` 三个 tenant-scoped function + `vector_migration.py:126 filter=And([Eq("account_id", account_id), Or(filters)])` | ✅ |

**结论**：6/6 hold。事实层无 hallucinated 引用。

## 2. Verdict 精确化建议（P2，不阻塞 approve）

砚砚 §9 第 9 镜头自己做了，但**两处 verdict 比之前两次（AtomMem reviewer-audit / OV ingestion reviewer-audit）的判据应用更宽容**。一致性建议如下：

### L2: Can Distinguish Evidence Quality — 砚砚标 "Fail / Partial"，我建议改 **Fail**

砚砚理由：HTTP JSON 能区分 `context_type (memory/resource/skill)` 和 `level (L0/L1/L2)`，所以"agent 能粗略区分"。

我的 push back：
- `context_type` 是 **存放位置**（这条数据在哪个 namespace），**不是证据性质**（observation vs generation）
- `level` 是 **摘要层级**（L0 vs L1 vs L2），**不是 epistemic 标签**（authority vs confidence vs source-tier）
- 这俩字段都不构成 L2 判据要的"generated vs observed"区分
- 砚砚自己 §1 ledger 最后一行 + §3 Result Shape 段已经写"epistemic label is missing"——verdict 应与自陈对齐

**对比 AtomMem 那次我标的 L2 Fail / OV ingestion 那次我标的 L2 Fail**：判据一致性要求这次也是 Fail（不是 Partial），否则跨报告判据漂移。

### L3: Can Close The Loop — 砚砚标 "Partial Pass"，我建议改 **Fail**

砚砚理由：`read/grep/forget/add_resource/remember` 让 agent 能 mutate state。

我的 push back：
- L3 判据是 "**can verify, correct, write back, and re-observe**" with **epistemic loop closure**
- **能 mutate ≠ 能 close epistemic loop**
- 砚砚自己 §9 L3 段写："does not expose a structured correction API with authority/confidence transitions"；"forget is irreversible with soft confirmation only"
- soft docstring confirmation 不构成 correction gate
- 没有 epistemic transition API（"this fact was generated, mark it as observed after user verifies"）= 没 close epistemic loop

**对比 AtomMem 那次我标的 L3 Fail**：同样应用 "structured correction API + epistemic transition" 判据，OV 也是 Fail。

### 升级措辞建议

把 L2/L3 改成 Fail 后，§9 末尾 "Overall: OpenViking is an excellent exploration and context-recovery substrate, but not an epistemically labeled memory backend" 这个总判定**正好和 Fail Fail 对齐**——这是砚砚 self-criticism 已经到的位置，verdict 只是和它对齐。

## 3. 回答砚砚 §12 5 个 Reviewer Questions（有立场）

### Q1: tenant scoping 是否单独 axis？

**给的够，不需要单独 axis**。

§8 9-Axis 已经把 "Multi-collection / tenant scoping" 列为独立 axis（采纳我上轮建议）+ §5 独立一节 + §1 ledger 单独一行 + §10 Learn 第 5 项已写。再单独 axis 是重复劳动。

### Q2: Cat Cafe 是否该 copy OV 的 code navigation MCP tools？

**不直接 copy，但学其设计哲学**。

理由：
- `code_outline/search/expand` 是围绕 "ingested code as viking:// file" 设计的，依赖 OV 资源模型
- cat-cafe 的代码导航生态是 LSP / Grep / Read / JetBrains MCP，**原生工具链已覆盖**
- 该 copy 的不是工具 list，是 §10 Learn 第 1 项的设计哲学："**exact recovery beside semantic search**"
- 具体落地：cat-cafe `search_evidence` 已有 BM25/FTS，但**没暴露 `grep` 工具给 agent** —— 这是 cat-cafe 可补的 gap

### Q3: "no BM25+embedding fusion" 是否过严？

**措辞已经精确，不需要软化**。

理由：
- 砚砚措辞 "dense+sparse vector retrieval exists, but not Cat Cafe-style BM25/FTS + vector RRF fusion" 已经准确
- sparse vector ≠ BM25 — **sparse vector 是 SPLADE/learnable sparse 类的 neural method**，BM25 是 lexical/statistical method 在 inverted index 上跑
- retrieval characteristics 不同：sparse vector 学过 corpus，BM25 zero-shot；OOV 词上 BM25 仍然 OK，learned sparse 可能不行
- 不软化

### Q4: 最终 trilogy synthesis 是否把 OpenClaw plugin skill 当 product surface？

**当 product surface 但要标注 "optional / plugin-dependent"**。

理由：
- OpenClaw 是 OV 之外的 plugin，不是 OV 内置
- 但是 OV 团队/社区维护的，是 "official-ish" 推荐
- 不算 default OV 配置（vanilla OV MCP 里没有 OpenClaw skill）
- 横向对比 cat-cafe 时差异要标：
  - cat-cafe 的 skills = first-party 内置（`memory-navigation` / `memory-search-best-practices` 都是 cat-cafe 自带）
  - OV+OpenClaw = OV core + 配套 plugin
- 不模糊化

### Q5: AtomMem next: 从 "no MCP" 起还是 retrieval graph 起？

**从 "no MCP" 起，反向回到 demo HTTP API + Python client**。

理由：
- 与 cat-cafe baseline + OV agent-surface 视角对称：先看 agent-facing surface
- **AtomMem 没有 MCP 本身就是判定信号**（"研究 demo，不为 agent 设计"）—— 这点本身写进 claim ledger 第一行
- 然后回到 AtomMem 实际暴露的 HTTP API（demo server）和 Python client：agent 如何用？
- retrieval graph (PPR/RWR) 在之前 AtomMem deep-dive 拆过了 — 这次重点是 **surface**，不是 algorithm

## 4. 漏点：`forget` 的不可逆性应升级到 P0 severity

砚砚 §2 表格里 `forget` 列 "Yes, irreversible" + Risk 列 "Tool docstring tells agents to confirm first, but the tool itself cannot enforce human confirmation"。

§10 Do Not Follow 第 4 项 "Do not rely on docstring-only confirmation for irreversible deletes" 已经写了，但**严重度可以升级**：

- 不可逆操作只靠 prompt-level "请先确认" = **default-permitted destructive action**
- 真实 agent（如 cat-cafe 现在的猫）默认会 follow tool docstring instruction，但**hallucinated context** 时可能误判"用户已确认"
- 这是 P0 安全反模式 —— cat-cafe 家规第 1 / 5 条（不可逆操作 / 用户状态持久化）的反向反对例

**建议** §10 Do Not Follow 第 4 项升级到 P0 severity 标注 +  link 到 cat-cafe 家规相关条款；或者新加 §10b 节专门写"P0 反模式：default-permitted destructive action"。

不阻塞 approve（措辞 nit），但跨报告 lesson 沉淀时这条应当 P0。

## 5. Final Verdict

**Approve with minor revisions**

- 砚砚的方向、结构、9-axis 对照、第 9 镜头自做、5 reviewer questions self-disclosure **全部 hold**
- Minor revisions（不阻塞）：
  - §9 L2 Verdict 改 Fail（不是 Partial）— 与 AtomMem / OV ingestion reviewer audit 判据一致性
  - §9 L3 Verdict 改 Fail（不是 Partial Pass）— 同上
  - §10 Do Not Follow 第 4 项 `forget` severity 升级到 P0 标注

下一棒（沿用分工模式）：

- 砚砚（@codex）拆 AtomMem agent-surface 第三份 — 从 "no MCP" 起，反向回 HTTP demo + Python client
- 我做跨族 review 第三份 + 最终 trilogy synthesis review
- 然后铲屎官 CVO 拍板 generated-content + epistemic label ADR（三份齐了再决定，有充分横向证据）

报告系列闭环路径：
- `cat-cafe-memory-agent-surface.md`（砚砚 baseline）+ `reviewer-audit-cat-cafe-baseline.md`（我）+ refine commit
- `openviking-agent-surface.md`（砚砚）+ `reviewer-audit-openviking.md`（我，本文）
- `atommem-agent-surface.md`（砚砚下一棒）+ `reviewer-audit-atommem.md`（我）— 待
- 最终 trilogy synthesis 待决定（独立产物 OR README index）

Reviewer: [宪宪/Opus 4.7🐾]
