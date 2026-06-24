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

**Manual index-surface pass (strong-model best-case).** The OpenViking-style L0/L1 output is index-ready for **10/10** samples by manual review, including **6/6** hard cases.

Compared with F243 prompt v3's old aggregate (**4/10 production-ready; hard cases 1/6, 83% fail**), this run decisively improves the index surface:

- **Status/lifecycle** is present in all 10 outputs (`done`, `parked`, `implemented`, `archived`, `spec`).
- **Hard-case internal mechanisms** are preserved instead of hidden behind titles.
- **Most original discriminators** such as `AcpAgentService`, `OperationContext`, `BM25`, `RightStatusPanel`, and `WordPairBank` are present.
- **F155 caveat**: the output preserves `场景式`, `Overlay`, guide state, and State Authority, but drops the exact `spotlight/HUD` anchor terms from the source document.

Boundary: this proves the **best-case method looks usable on paper** with a strong model and the OV prompt shape. It does not prove OV's small-model claim, does not reproduce vector/embedding ranking, and does not make ungated LLM memory writes safe.

## Input Checks

| Check | Result |
|-------|--------|
| Executor output exists | `docs/discussions/2026-06-23-openviking-deep-dive/gemini35-output.md` |
| Output commit | `d8ec56ba7` |
| Blind statement | Present: "未读 F243 aggregate/samples/evaluations/verdict；未读本实验评测答案。" |
| Protocol followed | Output uses `semantic_title`, `abstract`, `overview` JSON per document |
| Evaluation baseline | F243 `aggregate.md`: 4/10 PR, hard 1/6 PR |

## Score Table

Scoring follows `prompt-quality-blind-test.md`: each dimension is 0/1/2; `index-ready = all dimensions >=1 and total >=5`.

| ID | Type | Core coverage | Distinction | Query hit | Total | Verdict | F243 old aggregate |
|----|------|---------------|-------------|-----------|-------|---------|--------------------|
| F008 | hard | 2 | 2 | 2 | 6 | index-ready | needs-fix |
| F038 | hard | 2 | 2 | 2 | 6 | index-ready | needs-fix |
| F155 | hard | 2 | 2 | 1 | 5 | index-ready | needs-fix |
| F161 | hard | 2 | 2 | 2 | 6 | index-ready | needs-fix |
| F170 | hard | 2 | 2 | 2 | 6 | index-ready | production-ready |
| F189 | hard | 2 | 2 | 2 | 6 | index-ready | needs-fix |
| F009 | easy | 2 | 1 | 2 | 5 | index-ready | production-ready |
| F012 | easy | 2 | 1 | 2 | 5 | index-ready | production-ready |
| F013 | easy | 2 | 1 | 2 | 5 | index-ready | production-ready |
| F119 | easy | 2 | 2 | 2 | 6 | index-ready | needs-fix |

Note on `Distinction=1`: F009/F012/F013 are tiny early notes, and the OV abstract style keeps a formulaic "本篇文档是一篇..." prefix. They remain index-ready because the unique terms survive, but the prefix is unnecessary retrieval noise.

Aggregate:

| Metric | F243 prompt v3 old result | OV prompt + strong model result |
|--------|---------------------------|---------------------------------|
| Total ready | 4/10 | 10/10 |
| Hard ready | 1/6 | 6/6 |
| Easy ready | 3/4 | 4/4 |
| Hard fail rate | 83% | 0% |

## Query Probe Matrix

These probes are derived from source docs, not from the generated output.

| ID | Query probes | Output support | Hit verdict |
|----|--------------|----------------|-------------|
| F008 | `js-tiktoken usage cost cache`; `RightStatusPanel ParallelStatusBar`; `ContextAssembler 截断` | L1 includes all three clusters and status done | hit |
| F038 | `parked skills BM25 ToolSearch`; `.claude/skills symlink`; `skills 50+ 延迟加载` | L0/L1 include parked state, direction A/B, BM25, symlink fix | hit |
| F155 | `spotlight HUD 场景式引导`; `GuideStateMachine Redis Zustand`; `YAML guide flows GuideRoutingInterceptor` | L1 preserves `场景式`, guide state, State Authority, YAML/GuideRoutingInterceptor, but drops exact `spotlight/HUD` terms | partial hit |
| F161 | `AcpAgentService resolveEnvMap`; `OpenCode ACP`; `sessionId thinking buffer compaction` | L1 includes ACP decoupling, env maps, OpenCode, session/thinking followups | hit |
| F170 | `archived interview demo`; `9x10 棋盘 7 种棋子`; `feat lifecycle feature branch` | L0/L1 include archived demo, rules engine, feature branch artifact | hit |
| F189 | `OperationContext HTTP MCP A2A`; `trust boundary parity bug`; `MCP schema HTTP query params` | L0/L1 include OperationContext builder, carriers, trust boundary, parity bug | hit |
| F009 | `tool_use tool_result useAgentMessages`; `ChatMessage tool variant` | L0/L1 include both event names and frontend mapping | hit |
| F012 | `Hub modal 功能注册表 /hub`; `环境摘要` | L0/L1 include Hub modal, registry, summary, `/hub` | hit |
| F013 | `操作审计 追责`; `CLI 原始日志归档 debug` | L0/L1 include audit accountability and CLI raw log archive | hit |
| F119 | `WordPairBank`; `坏猫战术 prompt`; `scoped event log 身份隔离` | L1 includes word bank, deception tactics, identity isolation, leaderboard | hit |

## Failure-Mode Comparison

| F243 old weakness | OV output behavior | Evaluation |
|-------------------|--------------------|------------|
| H1/title repetition | Some semantic titles reuse domain terms, but L0/L1 add internal mechanisms and queryable details. | Improved; no index failure found. |
| Status missing | All 10 outputs carry lifecycle/status semantics. | Fixed for this run. |
| Metaphor replacement | F155 preserves the broader `场景式` anchor but drops exact `spotlight/HUD`; F119 preserves game/tactics vocabulary. | Partially improved, not fully fixed. |
| doc_kind formula | OV prompt encourages genre/length intro; most abstracts start with formulaic phrasing. | Residual retrieval noise; should strip or downweight. |

## Cat Cafe Takeaways

### Learn

OpenViking's `semantic_title + abstract(L0) + overview(L1)` shape is better than a single 160-char description for index use. The L1 5W scaffold makes status, mechanisms, and usage scenarios much harder to drop.

### Gate

If Cat Cafe adopts this direction for F243 or memory sidecars, add validation before accepting generated entries:

- status/lifecycle must be present;
- at least 2 unique mechanism terms must survive;
- original domain metaphor/anchor terms must be retained when present (`spotlight/HUD` would have caught the F155 miss);
- query-probe self-check must pass for hard docs.

### Do Not Follow

Do not copy the formulaic resource prefix into Cat Cafe's primary index. "本篇文档是一篇约 N 字..." is mostly retrieval noise. Also keep Cat Cafe's authority/confidence/source-tier tags; OpenViking's output shape improves recall, not evidence trust.

## Next

1. Feed this result back to F243 Phase B prompt v4 design: prefer L0/L1 sidecar generation over one-line-only description.
2. Optional B group, only if we need prompt/model isolation: run @gemini35 with the original F243 prompt v3 on the same 10 docs. If B is also strong, the win is mostly model; if B regresses, OV prompt shape carries the gain.
3. If building an automated gate, use this 10-doc set as regression fixture: hard cases must stay at least `4/6 index-ready`.

[砚砚/gpt-5.5🐾]
