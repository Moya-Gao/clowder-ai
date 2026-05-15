---
title: "HAGE teardown: query-conditioned memory graph routing for F200"
doc_kind: teardown
status: code-evidence-review
created: 2026-05-15
topics: [memory, HAGE, F200, graph, recall-eval, open-source-teardown]
source_repo: "https://github.com/FredJiang0324/HAGE_MVPReview"
source_commit: "ddc159d7b16f362d31d0273d6990aa28f1e424e"
paper: "https://arxiv.org/abs/2605.09942"
related_features: [F102, F188, F200]
---

# HAGE Teardown: Query-Conditioned Memory Graph Routing

> Context: 铲屎官要求拆解论文/开源项目
> `HAGE: Harnessing Agentic Memory via RL-Driven Weighted Graph Evolution`，
> 并特别要求不要做夸夸猫，要从“猫作为真实用户”判断能力到底有没有用。

## Verdict

HAGE 比 TencentDB-Agent-Memory 的 MMD 当前任务画布更贴近我们家的核心问题。

MMD 主要压缩 tool-call 过程轨迹。对 Cat Cafe 来说，多数 tool history 是过程噪音；任务最终态应该沉淀到代码、feat md、ADR、毛线球、commit 和 lesson。MMD 顶多是长任务 debug 辅助，不是核心记忆能力。

HAGE 关注的是另一个问题：长期记忆已经形成图之后，agent 面对不同查询时应该沿哪些关系边继续找答案。这个问题直接对应 F188/F200 的 graph_resolve、edge traversal、consumption-weighted ranking。

结论：

- HAGE 有真实研究含金量，不是空壳。
- 但当前 GitHub 是研究 MVP，不是可直接接入 Cat Cafe 的产品化记忆系统。
- 我们值得吸收的是 query-conditioned edge scoring 的思路，而不是整套 RL 训练复杂度。
- 最小可学方案：在 F200 后续 Phase 里加一个 shadow-mode edge scorer，对比现有启发式边权是否提升 consumed MRR / graph traversal completion。

## Sources Checked

- Paper: arXiv 2605.09942
- Repository: `FredJiang0324/HAGE_MVPReview`
- Local clone: `/Users/lysander/projects/ref/HAGE_MVPReview`
- Source commit: `ddc159d7b16f362d31d0273d6990aa28f1e424e`
- Paper source: `/Users/lysander/projects/ref/HAGE-src/main.tex`
- Static verification: `python3 -m py_compile memory/*.py scripts/*.py test_fixed_memory.py test_hotpotqa.py train_rl_edge_scorer.py`

I did not reproduce the benchmark numbers. This is a code-evidence teardown, not a benchmark replication.

## What HAGE Actually Implements

HAGE builds a weighted multi-relational memory graph with four relation types:

- semantic
- temporal
- causal
- entity

Each edge has an edge feature vector. For a query, HAGE uses a QueryRouter MLP to compute a query-conditioned structural edge weight, then combines it with semantic similarity during graph traversal.

Core code evidence:

- `memory/model.py`: `QueryRouter` is a 3-layer MLP over query embedding + edge features.
- `memory/model.py`: transition logits are `lambda * semantic_similarity + (1 - lambda) * edge_weight`.
- `memory/env.py`: graph traversal environment uses target node ID rewards, step penalty, and timeout penalty.
- `memory/rl_trainer.py`: REINFORCE with baseline subtraction trains the policy.
- `memory/rl_edge_adapter.py`: trained scorer can be plugged back into the retrieval path.
- `memory/query_engine.py`: `_adaptive_graph_traversal()` calls `edge_scorer.score_edge()` and uses it as a gating/weighting signal.
- `test_fixed_memory.py`: CLI supports `rl_transductive`, `rl_inductive`, `rl_coevo`, `rl_router_only`, and `rl_edge_only` scorers.

This is enough to reject the “README-only / fake architecture” hypothesis.

## Paper Claims

The paper claims:

- LoCoMo with GPT-4o-mini: strongest baseline overall judge score `0.700`, HAGE `0.739`.
- LoCoMo with Qwen2.5-3B: strongest baseline `0.499`, HAGE `0.548`.
- HotpotQA with GPT-4o-mini: HAGE F1 `0.678`, LLM score `0.824`.
- Ablation: static edge `0.698`, LLM scorer edge `0.712`, trainable edge `0.724`, trainable router `0.713`, full HAGE `0.739`.

Interpretation:

- The reported gain is plausible for graph-heavy multi-hop retrieval.
- The evaluation still depends on benchmark gold evidence and LLM-as-a-Judge.
- The repo does not ship pretrained checkpoints or a production memory service.

## User Test: Is This Useful To A Cat?

The user is not Landy looking at a dashboard. The user is the cat trying to do work.

Useful:

- A cat searched F200 and needs to decide whether to follow edges into F102, F163, F188, or MemOS teardown notes.
- A cat is debugging a repeated issue and needs to traverse feature -> decision -> review -> lesson.
- `graph_resolve` returns multiple plausible anchors and the first BM25 hit is not actually the right next node.

Not very useful:

- A cat just needs the current source code. Use `rg` / Read.
- A cat needs final task state. Read code, feat md, ADR, task state, commit.
- A cat wants to remember raw tool-call history. That should not become durable knowledge by default.

So HAGE helps a narrow but important user story:

> When a cat has already entered memory graph navigation, query-conditioned edge scoring can reduce wrong turns.

## Comparison With Cat Cafe F200

Cat Cafe already has the safer root signal:

- F200 records real recall behavior: searched -> read/consumed -> used -> verified.
- Consumption signals affect navigation utility, not truth/authority.
- Authority remains grounded in spec, ADR, review, CVO decision, and verified docs.

Current Cat Cafe graph scoring is intentionally conservative:

- `graph-edge-weight.ts`: type base + traversal count + recency decay.
- `consumption-prior.ts`: Bayesian shrinkage CTR + kind-specific recency + constitutional immunity.
- `RecallEventCorrelator`: correlates memory search tool calls with follow-up Read/Grep/graph drill-down.

HAGE is stronger in one specific dimension:

- It learns query-conditioned edge routing instead of using fixed relation weights.

Cat Cafe is stronger in the production governance dimension:

- It has provenance, authority, contradiction, stale handling, shadow mode, and multi-agent workflow feedback.
- It avoids using LLM self-evaluation as truth.

## What To Learn

Do not import the full RL system first.

Recommended F200 follow-up:

1. Keep current F200 heuristic scorer as baseline.
2. Add a shadow-only query-conditioned edge scorer.
3. Input features:
   - query embedding or query class
   - edge relation type
   - source/target doc kind and authority
   - traversal count / recency
   - source and target consumption prior
   - graph depth / candidate rank
4. Output:
   - alternative edge score for graph candidate/frontier sorting
5. Evaluation:
   - consumed MRR
   - graph traversal completion
   - non-first candidate selection rate
   - search abandon / reformulation rate
6. Guardrail:
   - shadow first
   - never write to authority
   - no automatic truth score
   - no LLM judge as root signal

This gives us HAGE's useful part without importing reward-design complexity.

## What Not To Learn

- Do not treat raw tool-call history as durable memory.
- Do not let learned edge weights change authority.
- Do not train directly on LLM self-judged answer quality.
- Do not add RL before we have enough F200 behavior data.
- Do not add graph complexity for simple source-code lookup workflows.

## Proposed Cross-Thread Message

For F200 owners:

> HAGE suggests a useful F200 Phase D/E candidate: query-conditioned graph edge scoring. Their repo implements a real QueryRouter + REINFORCE traversal trainer, but it is research MVP and benchmark-driven. The useful transplant for Cat Cafe is not RL itself; it is a shadow scorer that compares query-conditioned edge ranking against our current `type_base + traversal_count + recency` heuristic using F200 consumption metrics. This should remain navigation-only and never affect authority.

## Final Take

HAGE is not a general memory product we should copy. It is a focused research prototype pointing at a real gap in memory graph navigation.

For Cat Cafe, the right adoption shape is:

> F200 behavior telemetry as the root signal, HAGE-style query-conditioned edge scoring as a shadow-ranked candidate, and Cat Cafe governance as the safety boundary.

[砚砚/GPT-5.5🐾]
