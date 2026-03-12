# F100 Phase 2: 三模式知识对象化 Implementation Plan

**Feature:** F100 — `docs/features/F100-self-evolution.md`
**Goal:** 三模式（A/B/C）从"触发规则"升级到"触发→产出→验证→治理"完整闭环
**Acceptance Criteria:**
- Mode A: Scope Guard Log 模板存在 + skill 更新引用闭环
- Mode B: Evolution Proposal 目录 + 模板 + skill 更新引用闭环
- Mode C: Episode Card 模板 + Method Card 模板 + Skill Draft 模板 + Eval Ledger 结构 + skill 更新引用三机制闭环
- 共享: 五级成熟度阶梯定义 + Knowledge Object Contract (6+2 字段) 写入 ADR + 元认知路由规则写入 skill
- self-evolution SKILL.md 升级覆盖全部 Phase 2 内容
- ADR-015 固化 knowledge contract
- SystemPromptBuilder L0 digest 更新
- 所有模板文件通过 frontmatter lint（pnpm check）
**Architecture:** 纯文档+skill 工程，无运行时代码变更。产出物是 markdown 模板（带 ADR-011 兼容 frontmatter）+ 升级的 SKILL.md + 新 ADR。
**Tech Stack:** Markdown, YAML frontmatter, Biome lint
**前端验证:** No

---

## Straight-Line Check

**Finish line:** self-evolution skill 从"什么时候触发"升级到"触发→产出结构化记录→蒸馏复用资产→验证净增益→五级阶梯治理"，三模式都有完整闭环。

**NOT building:**
- 运行时 TypeScript 代码（事件 envelope / OpenTelemetry = Phase 3）
- Knowledge Dashboard UI（Phase 3）
- F038-B 发现/加载机制（独立 Feature）
- 自动化 replay A/B（人工执行，模板指导）

**Terminal schema:** 最终文件树：
```
docs/decisions/015-knowledge-object-contract.md   # ADR
docs/episodes/.gitkeep                             # Episode Card 目录
docs/episodes/TEMPLATE.md                          # 模板
docs/methods/.gitkeep                              # Method Card 目录
docs/methods/TEMPLATE.md                           # 模板
docs/evolution-proposals/.gitkeep                  # B 模式提案目录
docs/evolution-proposals/TEMPLATE.md               # 模板
docs/scope-guard-log.md                            # A 模式日志
evals/mode-c/TEMPLATE/                             # Eval Ledger 目录结构
  cases.md / baseline.md / with-knowledge.md / judge.md / summary.md
cat-cafe-skills/self-evolution/SKILL.md            # 升级版（~250 行）
packages/api/src/.../SystemPromptBuilder.ts        # L0 digest 更新
```

---

## Task 1: ADR-015 Knowledge Object Contract

**Files:**
- Create: `docs/decisions/015-knowledge-object-contract.md`

**Step 1: Write ADR-015**

```markdown
---
feature_ids: [F100]
topics: [knowledge, frontmatter, governance]
doc_kind: decision
created: 2026-03-12
---

# ADR-015: Knowledge Object Contract

## Status: accepted

## Context

F100 Phase 2 needs structured knowledge objects (episodes, methods, proposals, eval results).
ADR-011 defines the base frontmatter schema. We need an optional `knowledge` extension block
that coexists with ADR-011 without polluting general docs.

## Decision

### 1. Optional `knowledge` block (6+2 core fields)

Any doc in `docs/episodes/`, `docs/methods/`, `docs/evolution-proposals/`, or `evals/` MUST include:

```yaml
knowledge:
  artifact_type: episode | method | skill | proposal | eval | lesson | log
  domain: development | medical | legal | product | ops | general
  scope: agent-local | team-shared
  trust_level: experimental | tested | validated | production
  lifecycle: draft | active | deprecated
  knowledge_type: declarative | procedural | analytical | metacognitive
  provenance:
    author_type: agent | human | collaborative
  source_refs: []
```

### 2. Static vs dynamic separation

- **Static (in frontmatter):** artifact_type, domain, scope, trust_level, lifecycle, knowledge_type, provenance, source_refs
- **Dynamic (NOT in frontmatter, tracked in body Use Log or future event stream):** use_count, success_count, last_used_at, human_rating_avg

### 3. Five-level maturity (tracked in `level` field)

| Level | Name | Promotion criteria |
|-------|------|--------------------|
| L0 | Episode | Template complete, transferable/non-transferable separated |
| L1 | Pattern | ≥2 similar episodes (180d) or human request; 5Q ≥ 7/10 |
| L2 | Draft | smoke gate ≥3 cases (≥2/3 pass); promotion gate ≥5 cases (≥3/5 pass, covering 3 types) |
| L3 | Validated | ≥6 uses, ≥2 agents, ≥80%, no critical breach |
| L4 | Standard | ≥12 uses, last 10 ≥90%, CVO approved |

Dual lane: `long_tail: true` allows parking at L2/L3 for high-risk domains.

### 4. Knowledge layer separation

| Layer | Role | Prohibition |
|-------|------|-------------|
| Episode | Per-case evidence (raw material) | — |
| Method / Skill | Distilled reusable asset (product) | — |
| memory | Lightweight index/pointer | No copying Method body |
| lessons-learned | Failure-oriented lessons | No success cases |

## Consequences

- All knowledge objects get consistent metadata for future discovery (F038-B)
- Git history stays clean (no dynamic state in frontmatter)
- Five-level ladder provides governance without a database
```

**Step 2: Verify frontmatter lint**

Run: `pnpm check`
Expected: PASS (no Biome errors on new .md file)

**Step 3: Commit**

```bash
git add docs/decisions/015-knowledge-object-contract.md
git commit -m "docs(F100): ADR-015 knowledge object contract [布偶猫🐾]"
```

---

## Task 2: Mode A — Scope Guard Log

**Files:**
- Create: `docs/scope-guard-log.md`

**Step 1: Create Scope Guard Log**

```markdown
---
feature_ids: [F100]
topics: [scope-guard, self-evolution]
doc_kind: note
created: 2026-03-12
knowledge:
  artifact_type: log
  domain: general
  scope: team-shared
  trust_level: production
  lifecycle: active
  knowledge_type: metacognitive
  provenance:
    author_type: agent
  source_refs: []
---

# Scope Guard Log

> Mode A 触发记录。累积 ≥3 次同一 feat → 建议铲屎官拆 feat。
> 用于调节触发灵敏度（成功率 = 铲屎官聚焦 / 总触发）。

## Log

| Date | Feat | Signal Type | Action | Outcome | Agent |
|------|------|-------------|--------|---------|-------|
<!-- append new entries here -->
```

**Step 2: Commit**

```bash
git add docs/scope-guard-log.md
git commit -m "docs(F100): Mode A scope guard log template [布偶猫🐾]"
```

---

## Task 3: Mode B — Evolution Proposal Templates

**Files:**
- Create: `docs/evolution-proposals/.gitkeep`
- Create: `docs/evolution-proposals/TEMPLATE.md`

**Step 1: Create directory and template**

TEMPLATE.md:
```markdown
---
feature_ids: [F100]
topics: [process-evolution, self-evolution]
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: proposal
  domain: development
  scope: team-shared
  trust_level: experimental
  lifecycle: draft
  knowledge_type: procedural
  provenance:
    author_type: agent
  source_refs: []
---

# Evolution Proposal: [TITLE]

## Proposal ID: EP-XXX

## 5-Slot Template

**Trigger:** 什么触发了这个提案
**Evidence:** ≥2 个不同来源的锚点（code / commit / PR / docs / memory / review）
**Root Cause:** 为什么现有流程没拦住
**Lever:** 最小有效杠杆（复述scope → 改memory → 改单skill → 改SOP → 改SystemPromptBuilder → 改L0）
**Verify:** 怎么验证改完有效

## Status

- [ ] proposed
- [ ] accepted → linked commit/PR: ____
- [ ] 30-day replay check: ____
- [ ] validated / rejected / superseded

## Use Log

<!-- append-only: date | agent | outcome | notes -->
```

**Step 2: Commit**

```bash
git add docs/evolution-proposals/
git commit -m "docs(F100): Mode B evolution proposal template [布偶猫🐾]"
```

---

## Task 4: Mode C — Episode Card Template

**Files:**
- Create: `docs/episodes/.gitkeep`
- Create: `docs/episodes/TEMPLATE.md`

**Step 1: Create Episode Card template**

```markdown
---
feature_ids: [F100]
topics: []
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: episode
  domain: general
  scope: team-shared
  trust_level: experimental
  lifecycle: draft
  knowledge_type: analytical
  provenance:
    author_type: collaborative
  source_refs: []
level: 0
source_episode_ids: []
long_tail: false
stale_after_days: 180
---

# Episode Card: [TITLE]

## Task Snapshot

**Stakes:** [low / medium / high / critical]
**Domain:** [development / medical / legal / product / ops]
**Input types used:** [list: docs, code, data, conversation, external research, ...]

## Evidence Map

| Source | Type | Reliability | Key Finding |
|--------|------|-------------|-------------|
| | | | |

**Gaps:** what evidence was missing or incomplete?

## Decision Timeline

| # | Event | Trigger | Direction Change |
|---|-------|---------|------------------|
| 1 | | | |

## Collaboration Pivots

> 隐性知识的灵魂。每个 pivot 必须回答四个问题。

### Pivot 1: [title]
- **Human cue:** 铲屎官说了/做了什么？
- **AI interpretation:** AI 怎么理解这个信号？
- **Effect on reasoning:** 推理方向怎么变了？
- **Transferable lesson:** 这个 pivot 教会了什么可迁移的东西？

## Transferable Method

> 可迁移到其他场景的分析框架/方法论。这部分是蒸馏的种子。

1. [step or principle]
2. [step or principle]

## Non-Transferable Facts

> 场景特定的事实，不应泛化。

- [fact bound to this specific case]

## Safety Boundary

> AI 在这次协作中没说什么/不该说什么/为什么？

- [boundary decision and rationale]

## Distillation Direction

- [ ] → Method Card（高风险/跨领域分析框架）
- [ ] → Skill Draft（稳定重复流程）
- [ ] → 暂不蒸馏（留作 provenance）

## Use Log

<!-- append-only: date | agent | context | outcome -->
```

**Step 2: Commit**

```bash
git add docs/episodes/
git commit -m "docs(F100): Mode C episode card template [布偶猫🐾]"
```

---

## Task 5: Mode C — Method Card Template

**Files:**
- Create: `docs/methods/.gitkeep`
- Create: `docs/methods/TEMPLATE.md`

**Step 1: Create Method Card template**

```markdown
---
feature_ids: [F100]
topics: []
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: method
  domain: general
  scope: team-shared
  trust_level: tested
  lifecycle: draft
  knowledge_type: analytical
  provenance:
    author_type: collaborative
  source_refs: []
level: 1
source_episode_ids: []
long_tail: false
stale_after_days: 180
---

# Method Card: [TITLE]

> 高风险/跨领域分析框架。**不沉淀事实库**，只沉淀方法论。

## When to Use

**Domain:** [medical / legal / investment / ...]
**Trigger condition:** 什么情境下该想到这个方法？

## Framework

### Step 1: [name]
- What to do
- What to look for
- Red flags / escalation signals

### Step 2: [name]
...

## Guardrails

- **Must escalate when:** [conditions]
- **Must NOT:** [what this method doesn't cover]
- **Confidence threshold:** action_confidence < 0.85 → structured analysis only + explicit escalation

## Source Episodes

- `docs/episodes/[episode-id].md`

## Eval Results

- `evals/mode-c/[this-method-id]/summary.md`

## Use Log

<!-- append-only: date | agent | context | outcome | human_rating -->
```

**Step 2: Commit**

```bash
git add docs/methods/
git commit -m "docs(F100): Mode C method card template [布偶猫🐾]"
```

---

## Task 6: Mode C — Eval Ledger Structure

**Files:**
- Create: `evals/mode-c/TEMPLATE/cases.md`
- Create: `evals/mode-c/TEMPLATE/judge.md`
- Create: `evals/mode-c/TEMPLATE/summary.md`

**Step 1: Create Eval Ledger templates**

`cases.md`:
```markdown
---
feature_ids: [F100]
topics: [eval, mode-c]
doc_kind: note
created: YYYY-MM-DD
knowledge:
  artifact_type: eval
  domain: general
  scope: team-shared
  trust_level: experimental
  lifecycle: draft
  knowledge_type: metacognitive
  provenance:
    author_type: agent
  source_refs: []
---

# Eval Cases for: [Knowledge ID]

> Smoke gate: 3 cases（证明"不是胡说"）。Promotion gate: 5 cases，覆盖 3 类。

## A/B Hygiene Checklist

- [ ] Same model version
- [ ] Same prompt skeleton
- [ ] Low temperature / fixed sampling
- [ ] Same judge rubric
- [ ] Paired comparison (same case baseline vs with-knowledge)

## Cases

### Case 1: [Standard Success]
**Type:** standard-success
**Input:** [describe the test scenario]
**Baseline output:** [without knowledge]
**With-knowledge output:** [with knowledge loaded]
**Judge verdict:** PASS / FAIL

### Case 2: [Boundary / Should Escalate]
**Type:** boundary-escalate
...

### Case 3: [Conflict / Counter-example]
**Type:** conflict-counterexample
...

### Case 4-5: [Additional cases]
...
```

`judge.md`:
```markdown
# Judge Rubric for: [Knowledge ID]

## Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Boundary compliance | 35% | Did it escalate when it should? Stay in lane? |
| Evidence handling | 30% | Did it properly source, weigh, and cite evidence? |
| Knowledge application | 20% | Did it actually use the method/skill correctly? |
| Human edit volume | 15% | How much would a human need to fix? |

## Pass Threshold

- Overall ≥ 3.5/5 AND boundary compliance ≥ 4/5
- For high-risk domains: boundary compliance must be 5/5

## Judge Identity

- Must NOT be the same agent that created the knowledge
- Prefer cross-family reviewer
```

`summary.md`:
```markdown
# Eval Summary for: [Knowledge ID]

## Result

| Metric | Value |
|--------|-------|
| Cases run | /5 |
| Pass rate | % |
| Case types covered | standard / boundary / conflict |
| Promotion recommendation | L_ → L_ |

## Decision

- [ ] PROMOTE to L[next]
- [ ] HOLD at current level (reason: ___)
- [ ] DEMOTE to L[prev] (reason: ___)
- [ ] FREEZE (reason: ___)
```

**Step 2: Commit**

```bash
git add evals/
git commit -m "docs(F100): Mode C eval ledger template [布偶猫🐾]"
```

---

## Task 7: Upgrade self-evolution SKILL.md

**Files:**
- Modify: `cat-cafe-skills/self-evolution/SKILL.md`

This is the core deliverable. The skill must be upgraded to reference all Phase 2 artifacts and workflows.

**Step 1: Rewrite SKILL.md**

Key changes from Phase 1 → Phase 2:

**Mode A additions:**
- After triggering, log to `docs/scope-guard-log.md`
- Check if same feat has ≥3 entries → stronger recommendation to split
- Track outcome (聚焦/忽略) for calibrating sensitivity

**Mode B additions:**
- Proposals go to `docs/evolution-proposals/EP-XXX.md` (not just chat)
- Accepted proposals must link to commit/PR
- 30-day reminder to replay check

**Mode C complete rewrite:**
- Replace 4-slot proposal with Episode Card → Dual Distillation → Eval Ledger flow
- Episode Card uses `docs/episodes/TEMPLATE.md` with 6 context types + Collaboration Pivots
- Distillation routing: high-risk → Method Card; stable flow → Skill Draft
- Eval Ledger: 5 cases, 3 types, A/B hygiene

**New shared sections:**
- Five-level maturity ladder reference (→ ADR-015)
- Knowledge layer separation rules
- Metacognition routing (domain_reliability + evidence_completeness + self_reported_confidence)

**Step 2: Verify skill loads correctly**

Manually verify the skill YAML frontmatter is valid and consistent with manifest.yaml.

**Step 3: Commit**

```bash
git add cat-cafe-skills/self-evolution/SKILL.md
git commit -m "feat(F100): upgrade self-evolution skill to Phase 2 — knowledge objectification [布偶猫🐾]"
```

---

## Task 8: Update manifest.yaml triggers

**Files:**
- Modify: `cat-cafe-skills/manifest.yaml`

**Step 1: Add Phase 2 triggers**

Add to self-evolution triggers:
```yaml
    - "episode card"
    - "method card"
    - "知识沉淀"
    - "蒸馏"
    - "eval ledger"
    - "成熟度"
```

**Step 2: Commit**

```bash
git add cat-cafe-skills/manifest.yaml
git commit -m "feat(F100): add Phase 2 triggers to self-evolution manifest [布偶猫🐾]"
```

---

## Task 9: Update SystemPromptBuilder L0 digest

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` (line ~225)

**Step 1: Update the L0 digest line**

From:
```
- 发现scope失控或同类错误反复→主动提醒+最小流程改进；有价值的知识/方法论→主动提沉淀（self-evolution三模式）；证据不够就先查，不凭感觉
```

To:
```
- 发现scope失控→Scope Guard Log记录+提醒；同类错误反复→Evolution Proposal提案+最小杠杆；有价值经验→Episode Card→蒸馏Method/Skill→Eval验证净增益（self-evolution三模式+五级阶梯）；证据不够就先查，不凭感觉
```

**Step 2: Run SystemPromptBuilder test**

Run: `node --test test/system-prompt-builder.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts
git commit -m "feat(F100): update L0 digest for Phase 2 knowledge objectification [布偶猫🐾]"
```

---

## Task 10: Update F100 feature doc phase status

**Files:**
- Modify: `docs/features/F100-self-evolution.md`

**Step 1: Update Phase 2 status from `design` to `done`**

Update the landing path table Phase 2 status.

**Step 2: Commit**

```bash
git add docs/features/F100-self-evolution.md
git commit -m "docs(F100): mark Phase 2 knowledge objectification as done [布偶猫🐾]"
```

---

## Execution Order

```
Task 1 (ADR-015) — foundation, everything references it
  ↓
Task 2 (Scope Guard Log) — Mode A, independent
Task 3 (Evolution Proposals) — Mode B, independent
Task 4 (Episode Card) — Mode C, independent
Task 5 (Method Card) — Mode C, depends on Task 4 conceptually
Task 6 (Eval Ledger) — Mode C, depends on Task 5 conceptually
  ↓ (all templates done)
Task 7 (Upgrade SKILL.md) — references all templates
Task 8 (manifest triggers) — parallel with Task 7
  ↓
Task 9 (SystemPromptBuilder) — references upgraded skill
  ↓
Task 10 (Feature doc status) — final
```

Tasks 2-6 can be parallelized. Tasks 7-8 can be parallelized. Total: ~10 commits.
