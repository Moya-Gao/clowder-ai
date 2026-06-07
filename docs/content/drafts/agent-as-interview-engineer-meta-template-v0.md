---
feature_ids: []
related_features: [F042, F152, F192, F200, F208, F221]
topics: [workflow-distiller, fde, interview-engineer, feat-lifecycle, delta-learning, validator-surface, meta-template]
doc_kind: template
created: 2026-06-07
status: v0-draft
source_refs:
  - cat-cafe-skills/feat-lifecycle/SKILL.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md
  - docs/content/drafts/longform-004-seed-workflow-distiller.md
  - docs/content/drafts/longform-004-workflow-distiller-dogfood-spike.md
---

# Agent-as-Interview-Engineer Meta Template v0

> Status: method template, not an executable skill yet.
> Purpose: extract the interview mode already present in Cat Cafe feat-lifecycle into a reusable discovery-to-harness template for Workflow Distiller / FDE-style work.

## 0. Core Claim

Agent-as-Interview-Engineer is not "an agent asks good questions".

It is:

```text
read existing materials
  -> build an explicit baseline
  -> diff artifacts against that baseline
  -> ask only high-value delta / verifier questions
  -> let the domain owner checkpoint
  -> output SOP delta + validator + skill / route candidates
```

The closest internal precedent is `feat-lifecycle` discussion mode:

- agent reads backlog / feature docs / prior discussions / memory;
- CVO gives oral intent;
- agent asks one question at a time to clarify why, current workflow, and expected use;
- the result becomes a feature spec, acceptance criteria, Design Gate decisions, and Eval Contract.

The external generalization replaces:

| Internal feat-lifecycle | External Workflow Distiller |
|---|---|
| CVO | business expert / domain owner |
| BACKLOG + feature docs + discussion history | historical project artifacts + examples + rejection / revision records |
| Cat Cafe vision / architecture baseline | industry SOP baseline + company / team / personal rules |
| feature spec + AC + Design Gate | SOP delta + MVP slice + validator surface + skill / route candidates |
| CVO checkpoint | business expert checkpoint |

## 1. Non-Goals

This template is not:

1. a generic interview questionnaire;
2. a workflow-builder form;
3. proof that external Interview-Engineer is already a productized skill;
4. a replacement for human taste / irreversible product judgment;
5. a promise that every domain can become an agentic "proxy".

For P2 / Huawei use, the safe claim is:

> Cat Cafe already runs the same pattern internally through feat-lifecycle. We are extracting that pattern into a reusable template and will dogfood the delta-learning mechanism before claiming productized external capability.

## 2. Required Inputs

The agent must not start from a blank interview. It needs a source pack.

### Internal Cat Cafe Feature

- CVO original words.
- Related BACKLOG rows.
- Related feature specs / decisions / discussions.
- Existing code / architecture ownership cells if relevant.
- Prior lessons / eval contracts / reviewer feedback.

### External FDE / Business Workflow

- 3-5 historical project artifacts.
- At least one successful output and one rejected / revised output.
- Revision notes, rejection reasons, or before / after examples if available.
- Current templates, checklists, approval rules, or handoff docs.
- A domain owner who can answer checkpoint questions.

## 3. Baseline First

The agent first writes an explicit baseline before asking questions.

```yaml
baseline:
  subject: "What workflow / capability is being modeled?"
  assumed_actors: []
  assumed_steps: []
  assumed_artifacts: []
  assumed_quality_threshold:
    minimum_useful_bar: ""
    must_not_fail: []
    acceptable_failures: []
  assumed_failure_modes: []
  confidence: "low | medium | high"
  sources: []
```

Rules:

- Say which parts are industry / project baseline and which parts are guesses.
- Do not hide uncertainty inside fluent prose.
- Do not ask the domain owner to describe everything from zero.
- The first useful interview question is usually: "I think the baseline is X. Where is this wrong for you?"

## 4. Delta Discovery

The agent reads the source pack and creates delta candidates.

```yaml
delta_candidates:
  - baseline_assumption: ""
    artifact_signal: ""
    possible_delta: ""
    why_it_matters: ""
    verification_question: ""
    output_implication: "SOP | validator | skill | route | MVP scope | human checkpoint"
```

High-value questions come from mismatch, not curiosity.

Bad question:

> How do you make effect renderings?

Good question:

> Industry baseline says the designer hands off a complete brief to the rendering teammate. In your projects, the handoff seems to include furniture search and initial elevation drawings before rendering starts. Is that a required internal package, or just how this one project happened?

## 5. Checkpoint Loop

Each checkpoint should force a concrete classification.

```yaml
checkpoint:
  question: ""
  domain_owner_answer: ""
  classification: "confirm | correct | add | reject | unknown"
  resulting_delta: ""
  confidence_after: "low | medium | high"
  follow_up_needed: true
```

Checkpoint rules:

1. Ask one question at a time when the answer changes scope or product direction.
2. Separate fact correction from taste judgment.
3. Record whether the answer changes MVP slice, verifier design, or route.
4. Mark unknowns as unknown; do not smooth them into a confident plan.

## 6. Output Contract

The output is a harness candidate packet, not an interview transcript.

```yaml
interview_engineer_output:
  subject: ""
  artifacts_read: []
  baseline_summary: ""
  confirmed_sop: []
  sop_delta:
    industry: []
    company: []
    team: []
    personal_or_taste: []
    task_specific: []
  friction_points: []
  human_router_steps: []
  mvp_slice:
    target_job: ""
    included: []
    excluded: []
    why_this_slice: ""
  quality_threshold:
    minimum_useful_bar: ""
    must_not_fail: []
    acceptable_failures: []
  validator_surface:
    hard_constraints: []
    reference_or_pairwise_eval: []
    human_review_points: []
    unavailable_oracles: []
  skill_candidates: []
  route_candidates: []
  open_questions: []
  evidence_boundary:
    happened: []
    inferred: []
    dogfood_next: []
```

## 7. Two Worked Instantiations

### A. Cat Cafe Feature Lifecycle

| Template Field | Internal Instance |
|---|---|
| Subject | A new Cat Cafe feature or behavior change |
| Source pack | CVO words, BACKLOG, feature docs, discussions, memory, code ownership |
| Baseline | Existing feature ecosystem, vision, SOP, architecture boundaries |
| Delta questions | Why this now? What is broken today? What should feel different after completion? |
| Checkpoint owner | CVO for vision / UX / irreversible direction; cats for reversible technical details |
| Output | Feature spec, AC, Design Gate, Eval Contract, implementation / review / merge path |
| Validator surface | tests, screenshots, eval fixtures, vision guardian review |

### B. External Workflow Distiller

| Template Field | External Instance |
|---|---|
| Subject | A business workflow that may become an AI-native production line |
| Source pack | Historical project artifacts, revisions, rejected outputs, handoff docs |
| Baseline | Industry SOP plus company / team / personal working rules |
| Delta questions | Where do your artifacts differ from industry baseline? Which rejection reasons repeat? Which steps need human taste? |
| Checkpoint owner | Business expert / domain owner |
| Output | SOP delta, MVP slice, verifier candidates, skill candidates, route candidates |
| Validator surface | hard constraints, reference-based eval, pairwise preference, rejection-driven taste signals, human checkpoint |

### B.1 Lived Evidence Coordinates for P2 Show

| Evidence | File | Anchor |
|---|---|---|
| Cat baseline SOP for an unfamiliar domain | `docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md` | `§4.1 用户当前工作流` |
| Friend calibration turns baseline into customer delta | `docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md` | `§本地初筛 v1` `§1`-`§2` |
| Delta-driven cutpoint reranking | `docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md` | `§本地初筛 v1` `§3` |
| Three-cat convergence: moat is delta learning + validator surface | `docs/content/drafts/longform-004-seed-workflow-distiller.md` | `§五` |
| External translation table for delta | `docs/content/drafts/longform-004-seed-workflow-distiller.md` | `§五 bis` |

## 8. Example Question Patterns

Use these patterns after reading artifacts:

1. "Baseline expects X, but artifact Y shows Z. Is Z a company rule, a team habit, or a one-off task constraint?"
2. "This output was revised. Was the revision caused by missing facts, wrong taste, approval policy, or tool limitation?"
3. "Which part can be checked cheaply before a human sees it?"
4. "Which mistake is unacceptable even if the overall output looks good?"
5. "Where are you currently acting as a human router between people, files, tools, or approval steps?"
6. "What is a 60-70 point output that is still useful enough to ship or review?"
7. "Which judgment must stay with a human because the verifier is unavailable or too subjective?"
8. "If this became a skill or route, what input would trigger it and what output would prove it worked?"
9. Interior design instance: "Industry baseline does not separate furniture search and initial elevation as a distinct handoff step, but your project artifacts show it as a required internal package before the rendering teammate starts. Is this a company-wide rule or this project's special case?"
10. Interior design instance: "The video artifact appears after drawings and construction drawings are already confirmed. Is video a customer decision tool, or downstream company promotion material? This changes whether the MVP should target decision support or low-risk showpiece generation."

## 9. Upgrade Path: Template -> Skill

Do not productize this as a skill until the following are true:

1. At least one internal dogfood spike shows reference / delta alignment improves over baseline.
2. The activation signal is stable enough to describe in a skill header.
3. The output contract catches bad outputs, not just pretty summaries.
4. There is at least one regression fixture for overclaiming, generic-question spam, and verifier omission.
5. The skill can name its sunset signal under F192-style Eval Contract discipline.

Until then, this is a reusable method template and P2 show artifact.

## 10. P2 Show Boundary

Can claim:

- Cat Cafe already has an internal version of this pattern in feat-lifecycle.
- Workflow Distiller generalizes the pattern from feature discovery to business workflow discovery.
- The next step is dogfood: prove delta learning / reference eval on an internal high-ground-truth case before touching customer data.

Cannot claim yet:

- External Interview-Engineer is already a runnable product skill.
- The system can fully infer a customer's SOP from artifacts alone.
- Subjective domains have automatic proxy behavior without a validator / oracle strategy.

> The template itself is the P2 deliverable; the talk track should point to feat-lifecycle as lived evidence, not to this template as product proof.
