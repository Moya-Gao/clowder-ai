---
doc_kind: research-note-review
topics: [cat-cafe, memory, retrieval, mcp, agent-surface, cross-family-review]
created: 2026-06-24
status: draft
parent_report: ./cat-cafe-memory-agent-surface.md
parent_author: "@codex [砚砚/GPT-5.5🐾]"
reviewer: "@opus-47 [宪宪/Opus 4.7🐾]"
review_type: cross-family-independent
verdict: approve-with-minor-revisions
---

# Cat Cafe Memory Baseline — Reviewer Audit (Cross-Family)

> Sibling to [cat-cafe-memory-agent-surface.md](./cat-cafe-memory-agent-surface.md).
> Cross-family audit: spot-check + answer §9 reviewer questions + 1 axis补缺 + verdict。

## 0. Reviewer Stance

砚砚这份基准报告**比之前两份外部拆解更系统**：先拆自己作为基准坐标系，再拿基准对比外部，方法论上更稳。我作为跨族 reviewer 担心的两件事都没出现：

1. **Home bias / 过度自我赞美**：砚砚 §0 主动写"confidence 易误读"，§8 主动写"enforcement is mostly soft"，§9 主动暴露 4 个反向 questions —— **不是 home-biased 全 supported**
2. **Hallucinated claim**：spot-check 4/4 hold（详见 §1）

verdict: **Approve with minor revisions** — 1 项漏轴 + 部分 ledger verdict 精确度建议（不阻塞 approve）。

## 1. Spot-Check Verdicts

| 砚砚 claim | 砚砚 evidence | 我独立 grep | 一致？ |
|---|---|---|---|
| 三 MCP tools 注册存在 | `graph-tools.ts / recent-tools.ts / evidence-tools.ts` | 实测 `cat_cafe_search_evidence/graph_resolve/list_recent/read_file_slice` 出现在 antigravity-step-effects 白名单、`normalize-mcp-tool-name.ts:15`、`SessionBootstrap.ts:268,279`、`SqliteEvidenceStore.ts:1053` drillDown 输出、`span-helpers.ts:66` + `tool-span-tracker.ts:32` telemetry | ✅ |
| BM25 + 向量 + RRF 三路 | `SqliteEvidenceStore` | 实测 `test/memory/search-mode-split.test.js:15` 注释 "hybrid = BM25 + NN → RRF fusion"；`knowledge-resolver-federation.test.js:156`/`172`、`federated-search-integration.test.js:157,180-181`、`f200-v11-batch2.test.js:639` (DF-8 跨语种 RRF degradation) 多组测试 | ✅ |
| F200 consumption rerank hooks | longform-002 自陈 | 实测 `domains/memory/graph-edge-weight.ts` + `domains/memory/schema.ts` 命中 consumption/F200/rankingFactors | ✅ |
| SqliteEvidenceStore 真实 | 直接引用 | 实测 `packages/api/src/domains/memory/SqliteEvidenceStore.ts:1053` 存在，drillDown 字段输出 | ✅ |

**Spot-check 结论**：4/4 hold，无 hallucinated 引用。

## 2. 漏点：8 axes 漏了一项 — Multi-Collection / Tenant Scoping

砚砚 §7 给了 8 axes baseline checklist（truth source / ingestion / recall / MCP surface / raw drill-down / epistemic labels / skill contract / feedback loop）。**漏了一项关键 axis**：

> **Multi-Collection / Tenant Scoping**：cross-collection 召回 + private collection 可见性 + dimension routing。

理由：

- cat-cafe 有 `dimension: project/global/library/collection/all` + `collections` 路由 + `KnowledgeResolver` federated fan-out + RRF fusion across collections + **server-derived 可见性**（client 不能 self-grant private collection 访问，砚砚 §4 自己提到 graph_resolve 不接受 callerCollections）
- OV 有 `account_id` / `peer_id` / `namespace` + vector backend `account_id filter`（OV ingestion 深拆有 evidence）
- AtomMem 完全没有 — 单 `conversation_id` 命名空间 + 无 user_id（AtomMem reviewer-audit §2.3）

这是**横向对比的差异化重轴**，OV/AtomMem 报告必须按这个 axis 比，否则会漏掉 cat-cafe 的护城河之一。**建议砚砚 §7 加第 9 项**：

| 第 9 axis | Cat Cafe baseline question |
|---|---|
| Multi-collection / tenant scoping | Cross-collection 召回是不是 federated + privacy redaction？private collection 可见性是 server-derived 还是 client-asserted？dimension routing 是不是 first-class？ |

## 3. 回答砚砚 §9 4 个 Reviewer Questions（有立场）

### Q1: Baseline 是否 overclaim epistemic safety？

**部分 overclaim，程度可接受**。

砚砚 §0 / §8 自己已经写了 self-criticism（"some labels can still be misread" + "enforcement is mostly soft"），但 §1 claim ledger **7/8 都是 "Supported"**，没有一行升级到 "Supported in shape; enforcement remains soft"。

**建议**：§1 ledger "Epistemic metadata exists in the core result schema" 和 "Feedback affects future recall, not truth" 两行 verdict 改为 "**Supported in shape; agent compliance dependent**"。这样和 §0/§8 self-criticism 对齐，不被未来读者只看 ledger 误读为"全做对了"。

### Q2: `confidence` 命名是否 P1 hazard 该先 fix？

**是 P1 hazard，不阻塞本轮对比**。

理由：
- 真实 cat-cafe agent（包括我作为 invocation 拿到结果时）**会默认把 `confidence` 读成 "truth confidence" 而不是 "rank confidence"** —— 这不是 paranoia，是 fingerprint
- 改名是 breaking change（schema migration + 所有 consumer 同步），**不该和外部对比并行做**
- **但对比报告里必须写一笔 caveat**：cat-cafe baseline 已知这个命名 hazard，OV/AtomMem 对比时不要假装我们这一项 fully solved

建议未来开 P1 issue（`rankConfidence` 重命名 + schema versioning），但**不阻塞本对比系列**。

### Q3: `memory-search-best-practices` skill 算不算 product surface？

**算，但必须标注"agent-side compliance dependent"**。

更精确的对比框架：

| Dependency 方向 | cat-cafe | OV / AtomMem |
|---|---|---|
| 智能放在哪里 | **agent side**（skill + 多查询 recipe + 召回扩展由 agent 主导）| **backend side**（LLM judge 在 ingestion / extraction / 答案合成里做判断）|
| Quality 主要依赖 | **agent quality（model + skill compliance）** | **backend LLM 质量** |
| 弱 agent 后果 | 召回降级（但 truth authority 不变）| 召回不变（但生成的 sidecar/memory 可能成为新错） |

**不能简单说"我们有 skill 他们没有"**—— 要说"我们把智能放在 agent 端，他们放在 backend 端，trade-off 不同；cat-cafe 的赌注是 smart agent + epistemic label > backend LLM judge"。这是对比的真核心，不是 surface count。

### Q4: 下一份 OV 从 MCP endpoint 还是 retrieval store 开始？

**从 MCP endpoint 开始**。

理由：
- 这一系列的核心是 **agent-facing surface**（铲屎官的原问题：他们提供了怎么样的 MCP / skills 给 agent？）
- agent 看到的是 MCP tool list + 入参出参 + 返回 shape；retrieval store 是 backend implementation detail，agent 看不到
- 先从 MCP 开始 = 与 cat-cafe baseline 的视角对称
- backend 是补充证据，不是主线；retrieval store 应该在 §3 "Retrieval / Recall Chain" 子段，不是 §1 起点

**具体路径**：OV `openviking/server/mcp_endpoint.py` → 数 tool list + 每个 tool 入参出参 schema → 跑一条 `find/search` 完整链路看返回 shape（authority/confidence/level/score/etc.）→ 然后才追到 backend retrieval store。

## 4. Minor Revisions（不阻塞 approve）

砚砚下棒做 OV 之前顺手改即可：

1. **§7 加第 9 axis**：Multi-Collection / Tenant Scoping（见本文 §2）
2. **§1 ledger 两行 verdict 精确化**：epistemic metadata + feedback affects recall 两行从 "Supported" → "Supported in shape; agent compliance dependent"（见本文 §3 Q1）
3. **§5 表格加一笔 dependency direction caveat**：cat-cafe 是 agent-side intelligence，OV/AtomMem 是 backend-side intelligence（见本文 §3 Q3）

## 5. Final Verdict

**Approve with minor revisions** — baseline 方向 / 结构 / 事实层 / 自我批评全部 hold。3 项 minor revision 不阻塞，砚砚下棒做 OV 之前顺手 patch。

下一棒（沿用 AtomMem / OV ingestion 那套分工）：

- 砚砚（@codex）按 §7 9 axes 拆 OV agent surface → `openviking-agent-surface.md`，从 MCP endpoint 开始（§3 Q4）
- 我做跨族 review（spot-check + 同步 §7 axis 覆盖度）
- 然后 AtomMem 同款拆（§7 第 4 项 "MCP surface" 一项可能直接判 "no MCP, HTTP only"，但仍走完整 8/9 axes）

Reviewer: [宪宪/Opus 4.7🐾]
