---
doc_kind: research-note
topics: [openviking, l0-l1-index, retrieval-precision, evaluation, F243]
created: 2026-06-24
status: complete
evaluator: "@codex"
executor_output: gemini35-output.md
protocol: prompt-quality-blind-test.md
source_commit: d8ec56ba7
---

# OpenViking L0/L1 Index Precision Evaluation

> Evaluator: 砚砚 (@codex, gpt-5.5)  
> Executor: 烁烁 (@gemini35)  
> Scope: manual index-surface evaluation of `gemini35-output.md`, not a live embedding benchmark.

## Verdict

**CVO human-query audit invalidates the aggregate as a human-facing verdict.** The earlier **9/10** number is only a machine/L1-assisted paper score. It is **not** a valid "humans can understand the L0" score.

After CVO reviewed the raw L0s, the checked subset is:

- **Pass**: F038.
- **Marginal**: F189.
- **Fail**: F008, F155, F161.

So the current human-facing evidence is **1 pass / 5 reviewed**, not 9/10. The remaining 5 should not be self-certified without human-query review.

Compared with F243 prompt v3's old aggregate (**4/10 production-ready; hard cases 1/6, 83% fail**), the OV output still improves some machine-index properties, but it fails as user-visible L0 text:

- **Status/lifecycle** is present in all 10 outputs (`done`, `parked`, `implemented`, `archived`, `spec`).
- **Hard-case internal mechanisms** are preserved instead of hidden behind titles.
- **Most original discriminators** such as `AcpAgentService`, `OperationContext`, `BM25`, `RightStatusPanel`, and `WordPairBank` are present.
- **But** the L0 style is document-admin prose ("本篇文档是一篇...") and often answers "what kind of document is this?" instead of "what product/capability is this?".
- **F155 fails the human-facing L0 gate**: a human would ask "哪个功能会一步步教用户操作/高亮按钮/告诉我点哪", while the L0 says "核心特性设计规约...架构重构、状态机、多层状态权威级". L1 is recoverable, but L0 is not acceptable as a user-facing summary.
- **F161 is misleading**: the L0 frames the feature as ACP decoupling/refactor, but the human-facing story is "Gemini first used ACP; later OpenCode needed ACP too, so the ACP path had to generalize." The L0 hides the demand/timeline and makes the feature sound like pure refactoring.

Boundary: this proves the **best-case method looks usable on paper** with a strong model and the OV prompt shape. It does not prove OV's small-model claim, does not reproduce vector/embedding ranking, and does not make ungated LLM memory writes safe.

## Input Checks

| Check | Result |
|-------|--------|
| Executor output exists | `docs/discussions/2026-06-23-openviking-deep-dive/gemini35-output.md` |
| Output commit | `d8ec56ba7` |
| Blind statement | Present: "未读 F243 aggregate/samples/evaluations/verdict；未读本实验评测答案。" |
| Protocol followed | Output uses `semantic_title`, `abstract`, `overview` JSON per document |
| Evaluation baseline | F243 `aggregate.md`: 4/10 PR, hard 1/6 PR |

## Machine/L1 Paper Score Table

This table is retained as a machine/L1-assisted score only. It should not be read as human-facing L0 approval.

| ID | Type | Machine/L1 paper verdict | CVO human L0 audit | F243 old aggregate |
|----|------|--------------------------|---------------------|--------------------|
| F008 | hard | index-ready | fail: cannot tell what F008 did | needs-fix |
| F038 | hard | index-ready | pass | needs-fix |
| F155 | hard | needs-fix | fail: architecture jargon hides product | needs-fix |
| F161 | hard | index-ready | fail: misleading focus, hides Gemini→OpenCode ACP story | needs-fix |
| F170 | hard | index-ready | not CVO-reviewed in this pass | production-ready |
| F189 | hard | index-ready | marginal | needs-fix |
| F009 | easy | index-ready | not CVO-reviewed in this pass | production-ready |
| F012 | easy | index-ready | not CVO-reviewed in this pass | production-ready |
| F013 | easy | index-ready | not CVO-reviewed in this pass | production-ready |
| F119 | easy | index-ready | not CVO-reviewed in this pass | needs-fix |

Note on `Distinction=1`: F009/F012/F013 are tiny early notes, and the OV abstract style keeps a formulaic "本篇文档是一篇..." prefix. They remain index-ready because the unique terms survive, but the prefix is unnecessary retrieval noise.

Note: CVO audit supersedes the earlier self-scored `Human query` column. Cats are not reliable judges of "human can understand this" without showing the raw L0 to a human or using explicit human-query fixtures.

Aggregate:

| Metric | F243 prompt v3 old result | OV prompt + strong model result |
|--------|---------------------------|---------------------------------|
| Machine/L1 paper ready | 4/10 | 9/10 |
| CVO-reviewed human L0 pass | n/a | 1/5 reviewed |
| CVO-reviewed human L0 marginal | n/a | 1/5 reviewed |
| CVO-reviewed human L0 fail | n/a | 3/5 reviewed |

## Query Probe Matrix

These probes are derived from source docs, not from the generated output.

| ID | Query probes | Output support | Hit verdict |
|----|--------------|----------------|-------------|
| F008 | `js-tiktoken usage cost cache`; `RightStatusPanel ParallelStatusBar`; `ContextAssembler 截断` | L1 includes all three clusters and status done | hit |
| F038 | `parked skills BM25 ToolSearch`; `.claude/skills symlink`; `skills 50+ 延迟加载` | L0/L1 include parked state, direction A/B, BM25, symlink fix | hit |
| F155 | `spotlight HUD 场景式引导`; `GuideStateMachine Redis Zustand`; `YAML guide flows GuideRoutingInterceptor`; `一步步教用户操作 高亮按钮 告诉我点哪` | L1 preserves `场景式`, guide state, State Authority, YAML/GuideRoutingInterceptor, and says "步骤级上下文引导"; L0 is architecture jargon and drops exact `spotlight/HUD` plus the plain-language product hook | partial hit |
| F161 | `Gemini 先接 ACP 后来 OpenCode 也要接 ACP`; `AcpAgentService resolveEnvMap`; `OpenCode ACP` | L1 includes ACP decoupling and OpenCode, but L0 over-frames the feature as refactor and underplays the demand/timeline story | partial/misleading |
| F170 | `archived interview demo`; `9x10 棋盘 7 种棋子`; `feat lifecycle feature branch` | L0/L1 include archived demo, rules engine, feature branch artifact | hit |
| F189 | `OperationContext HTTP MCP A2A`; `trust boundary parity bug`; `MCP schema HTTP query params` | L0/L1 include OperationContext builder, carriers, trust boundary, parity bug | hit |
| F009 | `tool_use tool_result useAgentMessages`; `ChatMessage tool variant` | L0/L1 include both event names and frontend mapping | hit |
| F012 | `Hub modal 功能注册表 /hub`; `环境摘要` | L0/L1 include Hub modal, registry, summary, `/hub` | hit |
| F013 | `操作审计 追责`; `CLI 原始日志归档 debug` | L0/L1 include audit accountability and CLI raw log archive | hit |
| F119 | `WordPairBank`; `坏猫战术 prompt`; `scoped event log 身份隔离` | L1 includes word bank, deception tactics, identity isolation, leaderboard | hit |

## Failure-Mode Comparison

| F243 old weakness | OV output behavior | Evaluation |
|-------------------|--------------------|------------|
| H1/title repetition | Some semantic titles reuse domain terms, but L0/L1 add internal mechanisms and queryable details. | Improved, but F155 shows L0 can still be unreadable to humans. |
| Status missing | All 10 outputs carry lifecycle/status semantics. | Fixed for this run. |
| Metaphor replacement | F155 preserves the broader `场景式` anchor but drops exact `spotlight/HUD`; F119 preserves game/tactics vocabulary. | Partially improved, not fully fixed. |
| doc_kind formula | OV prompt encourages genre/length intro; most abstracts start with formulaic phrasing. | Residual retrieval noise; should strip or downweight. |
| Human-query mismatch | F155 L0 describes the document form and architecture, not the product capability. | New failure mode exposed by CVO review. |
| Demand-story loss | F161 L0 describes the refactor result but loses the human/product story: Gemini ACP existed first, then OpenCode needed the same transport. | New failure mode exposed by CVO review. |

## Cat Cafe Takeaways

### Learn

OpenViking's `semantic_title + abstract(L0) + overview(L1)` shape is better than a single 160-char description for machine indexing only if L1 is included. The L1 5W scaffold makes status, mechanisms, and usage scenarios much harder to drop.

For human-facing discovery, OV's resource-style L0 is too document-shaped. Cat Cafe needs a separate `product_summary` or `human_description` field that says what the capability does in plain language before mentioning architecture, and it must preserve the demand/story that a human would use to ask for it.

### Gate

If Cat Cafe adopts this direction for F243 or memory sidecars, add validation before accepting generated entries:

- status/lifecycle must be present;
- at least 2 unique mechanism terms must survive;
- original domain metaphor/anchor terms must be retained when present (`spotlight/HUD` would have caught the F155 miss);
- at least one human query probe must match the L0 or title; matching only L1 is not enough for a user-visible summary;
- the "why now / demand story" must survive when it is the thing a human would remember (`Gemini ACP → OpenCode ACP` would have caught the F161 miss);
- query-probe self-check must pass for hard docs.

### Do Not Follow

Do not copy the formulaic resource prefix into Cat Cafe's primary index. "本篇文档是一篇约 N 字..." is mostly retrieval noise, and for F155 it actively hides the product. Also keep Cat Cafe's authority/confidence/source-tier tags; OpenViking's output shape improves recall, not evidence trust.

## Next

1. Feed this result back to F243 Phase B prompt v4 design: keep L1 sidecars, but add a human-facing `product_summary` gate before any generated text becomes `docs/features/index.md` description.
2. Optional B group, only if we need prompt/model isolation: run @gemini35 with the original F243 prompt v3 on the same 10 docs. If B is also strong, the win is mostly model; if B regresses, OV prompt shape carries the gain.
3. Build human-query fixtures before any automated gate: each feature needs 1-3 plain-language queries written without internal architecture terms.

[砚砚/gpt-5.5🐾]
