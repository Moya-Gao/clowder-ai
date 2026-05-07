---
feature_ids: []
topics: [agentic-harness-engineering, open-source-teardown, harness-engineering, observability, self-evolution]
doc_kind: research-note
created: 2026-05-05
status: draft
source_repo: https://github.com/china-qijizhifeng/agentic-harness-engineering
source_commit: 388ac247444dc6d9e6654f176af017a024beeb9f
authored_by: codex
covers: [paper, architecture, star-features, algorithms, comparison]
---

# Agentic Harness Engineering Deep Dive

## 0. Scope

- User question: AHE paper + repo "到底有多少含金量"，按我们家 open-source-teardown 方法拆，并希望有宪宪视角一起看。
- Review note: initial draft mistakenly summarized a Codex internal sidecar as "宪宪视角". This version incorporates a visible A2A review from **宪宪/Opus 4.6** and treats the earlier sidecar only as internal scratch, not as a Cat Cafe teammate message.
- Paper: arXiv:2604.25850 v3, submitted 2026-04-28, revised 2026-04-30.
- Source repo: `china-qijizhifeng/agentic-harness-engineering`
- Local path: `/Users/lysander/projects/ref/agentic-harness-engineering`
- Commit inspected: `388ac247444dc6d9e6654f176af017a024beeb9f` (`2026-05-05 13:01:43 +0800`)
- Verdict: **high-concept, medium-to-high engineering value, not yet fully reproducible as a benchmark artifact**.

## 1. Claim Ledger

| Claim | Evidence paths | Verdict | Caveat |
|-------|----------------|---------|--------|
| Harness, not model, evolves across seven component types | `agents/evolve_agent/evolve_prompt.md`, `agents/code_agent_simple/`, `evolve.py` | Mostly true | Relies heavily on NexAU and harbor external packages; this repo is an orchestration harness, not a standalone runtime. |
| Experience observability distills raw traces into reports | `evolve.py` `_write_debugger_analyse`, `run_parallel_adb_ask`; `agents/evolve_agent/skills/agent-debugger-cli/` | True as released | README explicitly says Agent Debugger is only partially open-sourced. |
| Decision observability falsifies edits by next-iteration outcomes | `evolve.py` `load_change_manifest`, `evaluate_changes`, `save_change_evaluation`; `evolve_prompt.md` `change_manifest.json` contract | True as attribution/reporting | Mechanical rollback is weaker than marketing wording: normal loop emits reports and asks the evolve agent to rollback; `perform_auto_rollback` is resume-oriented, not continuous per-change rollback. |
| Ten iterations lift Terminal-Bench 2 pass@1 69.7% to 77.0% | Paper abstract/results; README overview | Plausible from paper | Repo does not include full `experiments/runs`, raw results, or reproduction bundle; verifying the exact number requires expensive external infra and API access. |
| Frozen harness transfers to SWE-bench-verified and other model families | Paper RQ2; README overview | Interesting paper result | Again not independently reproducible from this repo alone. |

## 2. Architecture Map

```text
evolve.py
  -> create/resume experiment workspace
  -> harbor run current code_agent in E2B
  -> collect result.json / reward.txt / NexAU traces
  -> Agent Debugger asks over traces
  -> write analysis/overview.md + analysis/detail/*.md
  -> build evolution query with stats, diffs, attribution, history
  -> run NexAU evolve_agent
  -> mutate workspace/ components
  -> commit/tag workspace
  -> next iteration evaluates the mutated workspace
```

Entrypoints:

- `python evolve.py` and `scripts/evolve.sh`.
- `agents/code_agent_simple/` is the seed coding agent.
- `agents/evolve_agent/` is the meta-agent that edits the seed.

State stores:

- Experiment filesystem: `experiments/{run}/workspace`, `runs/iteration_NNN/`, `iteration_scores.yaml`, `task_history.json`, `evolution_history.md`, `change_manifest.json`, `best_ever.json`.
- Git commits/tags inside the evolving workspace.

Extension points:

- Prompt, tool descriptions, tool implementations, middleware, skills, sub-agents, long-term memory.
- Optional best-of-N variants.

Missing / weak artifacts:

- No `.github/workflows`.
- No checked-in full experiment results.
- Only Agent Debugger package has tests in the repo.
- No release tag; GitHub shows no published releases at inspection time.
- `evolve.py` is a 4716-line orchestrator that owns config, eval launch, ADB analysis, attribution, rollback/resume, Best-of-N, notification, and main loop. This is a research-project shape, not a production library boundary.

Positive signals:

- Feishu webhook notification integration suggests the authors used this in a real internal workflow, not only as a paper demo.
- The `input/` vs `evolve/` generation split is a good engineering pattern: one generation's output is evaluated by the next generation, reducing self-observation confusion.

## 3. Star Feature Deep Dives

### Component Observability

The strongest engineering move is making harness pieces file-level artifacts. The evolver prompt lists writable component classes and enforces `workspace/` as the only mutation surface. New tools/middleware/skills must also be registered in `code_agent.yaml`, so evolution is not just prompt text editing.

Verdict: **real and useful**. This matches our ADR-031 position: harness layers are valuable when they create traceable signal and can later be deleted.

### Experience Observability

The loop converts harbor outputs and NexAU traces into `analysis/overview.md` plus per-task detail files. The evolve query tells the agent to read analysis first, then drill into raw `nexau_in_memory_tracer.cleaned.json` only when needed.

Verdict: **real, but quality depends on Agent Debugger**. Since ADB is partially open-sourced, the most important summarizer/judge remains partly a black box.

### Decision Observability

Each change must declare predicted fixes and risk tasks in `change_manifest.json`. Next iteration compares predicted flips/regressions with actual task diffs and produces `change_evaluation.json`.

Verdict: **real attribution mechanism, not full causal proof**. It can say "this prediction hit/missed"; it cannot precisely isolate interacting changes, and the code comment admits file-to-task regression attribution is not determinable precisely.

## 4. Algorithm Peel Table

| Mechanism | Input | Output | Type | Mutates future behavior? |
|-----------|-------|--------|------|--------------------------|
| Harbor evaluation | Workspace + dataset + model | task pass/fail/exception, traces | External eval runner | No, emits signal |
| Agent Debugger analysis | Raw traces + verifier output | overview/detail root-cause reports | LLM judge + trace summarization | No, emits distilled signal |
| Evolve Agent | Stats, diffs, ADB reports, history | file edits + manifest | LLM agent with constrained file mutation | Yes |
| Change attribution | manifest + task diff | verdict per change | Rule-based bookkeeping | Indirectly, through next query |
| Rollback | best snapshot / previous workspace | restored workspace | File restore / git discipline | Yes, but mostly resume/manual-agent-driven |
| Best-of-N | N evolve variants + parallel evals | selected winner | Search / selection heuristic | Yes |

## 5. Feedback Loop Test

```text
signal: harbor reward + NexAU trace + verifier output
decision: ADB root-cause reports + evolve-agent change plan
state mutation: workspace file edits + git commit + manifest
future behavior: next iteration evaluates mutated workspace
```

This passes the basic self-evolution loop test. The important downgrade is causal confidence: regression prediction is weak in the paper itself, and source code also treats attribution as a report for the agent to reason over, not as a guaranteed rollback controller.

Rollback precision:

- `evaluate_changes()` produces verdicts like `EFFECTIVE`, `MIXED`, `INEFFECTIVE`, and `HARMFUL` from predicted fixes/risks vs actual flips/regressions.
- The main loop comment explicitly says change attribution is "report only, rollback decided by evolve agent".
- `perform_auto_rollback()` restores a whole workspace snapshot, but in the inspected main loop it is triggered on resume from a chosen start iteration, not as continuous per-change rollback after a regression.

## 6. Cat Cafe Comparison

| Dimension | AHE | Cat Cafe | Judgment |
|-----------|-----|----------|----------|
| Component substrate | File-level components inside NexAU workspace | Skills, MCP tools, shared rules, docs, memory, session/runtime layers | Learn: make editable harness surfaces explicit and independently attributable. |
| Experience loop | Trace -> ADB report -> evolve query | Trace/session/docs -> search_evidence/Knowledge Feed -> next cat | Learn: use layered reports before raw trace. |
| Decision contract | `change_manifest.json` predictions verified next round | Review/quality gate evidence, but not uniformly machine-attributed | Gap: add structured prediction/outcome ledger for harness changes. |
| Eval target | Terminal-Bench pass@1 | Product correctness + CVO fit + multi-agent collaboration | Do not follow blindly: AHE optimizes benchmark pass@1; our value function includes social/coordination fit. |
| Data boundary | E2B + external APIs + experiment logs | Local-first user-owned traces | Keep our ADR-032 boundary: trace export is user-owned, not platform-owned. |

## 7. Score

**综合含金量：75/100.**

- 砚砚初评：78/100，偏重论文 framing 和源码闭环骨架。
- 宪宪/Opus 4.6 独立 review：73-76 区间，75 无异议；偏重开源 release 的不可复核性、partial Agent Debugger、rollback 叙事偏强。

- + High: The framing is correct: harness evolution becomes possible only after component, experience, and decision observability exist.
- + High: Source code implements a real outer loop, not just a README concept.
- + Medium: The evolved value in the paper comes from tools/middleware/memory, which aligns with our "prompt-only is not enough" experience.
- - Medium: The release is not a full reproducibility artifact; raw runs and benchmark evidence are not included.
- - Medium: The strongest analysis layer is only partially open-source.
- - Low/Medium: Rollback is more advisory/agent-driven than the README phrase suggests.
- - Low/Medium: The main orchestrator is a 4716-line monolith, which reinforces "do not intake code directly".
- + Low: Feishu webhook and generation isolation are real-world-use / workflow-maturity positive signals.

Maintainer口径：**值得拆方法，不值得直接 intake 代码**。吸收 manifest / evidence layering / variant eval；不吸收 "LLM self-review = automatic governance" 叙事。

## 8. Candidate Lessons

- Harness self-evolution needs three ledgers, not one: editable component ledger, evidence ledger, decision/outcome ledger.
- "Prompt self-improvement" is a weak baseline once tool and middleware mutation are allowed.
- Regression prediction is the hardest part of autonomous harness evolution; future Cat Cafe work should log predicted risks before changing shared harness rules.
- We should avoid adopting benchmark-only pass@1 as the top-level value function. For us, pass@1 is one slice under `Capability x Environment Fit`, not the whole score.
- If we adopt a `change_manifest` pattern, do not stop at "report only": decide where hard gates are required, and where agent judgment is acceptable.
