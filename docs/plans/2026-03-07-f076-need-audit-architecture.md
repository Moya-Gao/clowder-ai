---
feature_ids: [F076]
related_features: [F049, F058, F070]
topics: [need-audit, architecture, client-governance]
doc_kind: plan
created: 2026-03-07
---

# F076 Need Audit — Final Architecture Design

> Contributors: Opus (lead), GPT-5.2 (review + guardrails), GPT Pro (external consultation)
> Status: **Architecture Definitive** | Ready for implementation planning

## 1. Five-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   5. Knowledge Reflux                    │
│   Pattern Reflux only — no project data crosses home     │
│   Interface: F070 Phase 3                                │
├─────────────────────────────────────────────────────────┤
│                 4. Mission Hub View                       │
│   Translation Matrix │ Clarification Queue │ Risk Register│
│   Slice Ladder │ Governance Health + Delivery Health      │
│   (Blocks A / B / D from wireframe)                      │
├─────────────────────────────────────────────────────────┤
│                 3. Planning Bridge                        │
│   Audit products → Slice Ladder → Dispatched Work Items  │
│   Learning Slice / Value Slice / Hardening Slice         │
├─────────────────────────────────────────────────────────┤
│              2. Audit Workbench (Core)                    │
│   Stage 0: Frame                                         │
│   Stage 1: Downgrade + Intent Extraction                 │
│   Stage 1.5: Domain Pass                                 │
│   Stage 2: Validity Triage                               │
│   Stage 3: Resolution Design                             │
├─────────────────────────────────────────────────────────┤
│                 1. Ingestion Layer                        │
│   PRD / JXS / Interview notes / Existing system samples  │
│   Claim extraction + Provenance tagging                  │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Ingestion

| Input type | Format | Provenance default |
|-----------|--------|-------------------|
| Client PRD (AI-generated) | Markdown / PDF / Doc | A (AI inference) |
| Client JXS / wireframes | Code / Image | A (AI inference) or D (document) |
| Interview transcript | Text | Q (client stated) |
| Existing system screenshots / Excel | Image / File | O (observed) or D (document) |
| Regulations / contracts | PDF | R (regulation) |

Core operation: Split raw input into **claims** (atomic statements), each tagged with provenance.

### Layer 2: Audit Workbench

This is the methodology core. See Pipeline v2 below.

### Layer 3: Planning Bridge

Converts audit products into executable work:
- `Build Now` cards → grouped into **Slices** (Learning / Value / Hardening)
- Each Slice → **Dispatched Work Items** (compatible with F070 DispatchMissionPack)
- Slice completion → **Learning feedback** (what did we learn, what changed)

### Layer 4: Mission Hub View

Displays **governance products only**, not raw project data:

| Panel | Data source | Refresh |
|-------|------------|---------|
| A: Governance + Delivery Health | Slice progress, test counts, triage stats | Per-slice update |
| B: Translation Matrix | Intent Cards with triage status | After each audit pass |
| D: Risk Register + Clarification Queue | Challenge/Validate First cards + open questions | Live |

### Layer 5: Knowledge Reflux

- **What flows home**: Methodology patterns, risk signal patterns, audit templates refined by experience
- **What stays outside**: Project data, client info, code, business details
- **Interface**: F070 Phase 3 (blocked until F076 defines reflux boundary — now defined)

---

## 2. Need Audit Pipeline v2 (Definitive)

### Stage 0: Frame

Before touching the PRD, answer these 6 questions:

| Question | Output field |
|----------|-------------|
| Who is the decision sponsor? | `sponsor` |
| Why is this being built now? | `motivation` |
| What does success look like (measurable)? | `success_metric` |
| What are the time/budget constraints? | `constraints` |
| What is the current workflow (before the system)? | `current_workflow` |
| Where does each claim in the PRD come from? | `provenance_map` |

**If sponsor or success_metric is empty, do not proceed to Stage 1.**

### Stage 1: Downgrade + Intent Extraction

1. Treat PRD as **claim backlog** (not feature backlog)
2. Extract **Intent Cards** (see Object Model below)
3. Apply **Source tag** to every card (Q/O/D/R/A)
4. **Granularity gate**: If a card's scope > 3 dev-days or is not independently testable, it must be decomposed further before proceeding

### Stage 1.5: Domain Pass

Build three artifacts:
1. **Glossary**: Key terms with agreed definitions
2. **Entity-State Map**: Core objects + their state machines
3. **Data Source Registry**: Where each data type lives, who owns it

Without this stage, slicing is "cutting in the air."

### Stage 2: Validity Triage

Five-dimensional scoring:

| Dimension | Question | Scale |
|-----------|----------|-------|
| clarity | Is the requirement well-defined? | 1-3 |
| groundedness | Is the source verified (not AI inference)? | 1-3 |
| necessity | Does core delivery fail without it? | 1-3 |
| coupling | Does it drag in hidden dependencies? | 1-3 |
| size-band | Is it within a single slice? | S/M/L/XL |

Five triage buckets:

| Bucket | Criteria | Next action |
|--------|----------|-------------|
| **Build Now** | High clarity + groundedness + necessity, manageable coupling, sized S/M | → Stage 4 (Slice Planning) |
| **Clarify First** | Necessary but low clarity | → Stage 3 (question/evidence) |
| **Validate First** | Clear but low groundedness (source = A) | → Stage 3 (anchor to Q/O/D/R) |
| **Challenge** | Clear + grounded but low necessity or unreasonable ROI | → Stage 3 (sponsor decision) |
| **Later** | Not needed for minimum delivery | → Waiting Room |

**Hard gate: A-tagged cards CANNOT enter Build Now.** Must be upgraded to Q/O/D/R first.

### Stage 3: Resolution Design

Not just "generate questions" — design the right resolution path for each unresolved card:

| Resolution type | When to use | Example |
|----------------|-------------|---------|
| Constrained confirmation | Requirement is almost clear, need yes/no | "We think A, if not then B/C" |
| Evidence request | Need to see real data/process | "Show us last 5 review approvals" |
| Artifact request | Need existing documents | "Share the Excel you currently use" |
| Low-fi prototype | Client can't imagine from text | Quick mockup of the review flow |
| Sponsor escalation | Conflicting stakeholder needs | "Sales wants X, Ops wants Y — who decides?" |

### Stage 4: Slice Planning

Three slice types:

| Slice type | Purpose | Example |
|-----------|---------|---------|
| **Learning Slice** | Expose misunderstandings early | Admin login → dashboard → review one item → status recorded |
| **Value Slice** | Deliver real business value | Complete review workflow + notifications |
| **Hardening Slice** | Add robustness | Audit trail + permissions + performance |

Slicing rule: **Vertical cuts by business flow** (one actor + one complete workflow + one verifiable outcome). Never horizontal by module.

---

## 3. Object Model

### Intent Card (v2)

```
Intent Card
├── Core slots (6)
│   ├── actor: string              — Who performs this
│   ├── context_trigger: string    — When/why it happens (event, schedule, role switch)
│   ├── goal: string               — Desired outcome / progress sought
│   ├── object_state: string       — What object, from what state, to what state
│   ├── success_signal: string     — Observable proof of done
│   └── non_goal: string           — Explicitly NOT in scope
│
├── Metadata
│   ├── id: string                 — Unique identifier (IC-001, IC-002...)
│   ├── source_tag: Q|O|D|R|A     — Provenance (hard gate: A cannot → Build Now)
│   ├── source_detail: string      — "Client interview 03-07" / "PRD section 3.2"
│   ├── decision_owner: string     — Who can resolve this card
│   ├── confidence: 1-3            — Assessor's confidence
│   ├── dependency_tags: string[]  — IDs of cards this depends on
│   ├── card_type: intent|constraint|quality|transition  — v2: always "intent"; v3: card family
│   └── risk_signals: string[]     — Which of 8 signals triggered
│
└── Triage result
    ├── clarity: 1-3
    ├── groundedness: 1-3
    ├── necessity: 1-3
    ├── coupling: 1-3
    ├── size_band: S|M|L|XL
    ├── bucket: build_now|clarify_first|validate_first|challenge|later
    └── resolution_path: confirmation|evidence|artifact|prototype|escalation|null
```

### Card family (v3 extension point, schema reserved now)

```
card_type: intent      — "Actor wants to achieve X" (current)
card_type: constraint  — "System must comply with X" (v3)
card_type: quality     — "Under condition X, quality Y must be Z" (v3)
card_type: transition  — "Migrate from current to future state" (v3)
```

**v2 ships with Intent Card only. Schema includes card_type field to avoid future data model rewash.**

---

## 4. Artifact Lifecycle (State Machine)

```
Raw Input (PRD/JXS/Interview)
    │
    ▼
  Claim ──────────────────────────────────────────┐
    │ (Stage 1: extract + tag provenance)          │
    ▼                                              │
  Intent Card ◄── granularity gate ── too large ──┘
    │ (Stage 1.5: domain pass enriches entity refs)
    ▼
  Triaged Card (Stage 2: scored + bucketed)
    │
    ├─── Build Now ──────► Sliced Card (Stage 4) ──► Work Item ──► Done
    ├─── Clarify First ──► Resolution Item (Stage 3) ──► re-triage ──┐
    ├─── Validate First ─► Resolution Item (Stage 3) ──► re-triage ──┤
    ├─── Challenge ──────► Sponsor Decision ──► Build/Reject/Defer ──┤
    └─── Later ──────────► Waiting Room                              │
                                                                     │
    ◄─────────────── resolved cards cycle back to Stage 2 ───────────┘
```

### Provenance Upgrade Paths

| From | To | How |
|------|----|-----|
| A (AI inference) | Q (client stated) | Client confirms in interview / chat |
| A (AI inference) | O (observed) | Team observes actual workflow |
| A (AI inference) | D (document) | Client provides existing artifact |
| A (AI inference) | R (regulation) | Found in contract / regulation |

**A card stays in Validate First until its source_tag is upgraded. No exceptions.**

---

## 5. Decision Ownership Matrix

| Decision | Who decides | Escalation |
|----------|-------------|------------|
| Stage 0: Is the project worth auditing? | Sponsor (via human/铲屎官) | — |
| Stage 1: Is this card atomic enough? | Audit cat (布偶猫) | 铲屎官 if ambiguous |
| Stage 2: Triage bucket assignment | Audit cat, **confirmed by human for necessity scores** | 铲屎官 |
| Stage 2: Upgrade A → Q/O/D/R | Client (via human) | Sponsor |
| Stage 2: Promote Validate First → Build Now | Human (铲屎官 or client rep) | Sponsor |
| Stage 2: Resolve Challenge → Build/Reject/Defer | Sponsor | — |
| Stage 3: Resolution path selection | Audit cat | 铲屎官 if uncertain |
| Stage 4: Slice composition | Audit cat + 铲屎官 | Sponsor for priority |
| Stage 4: Slice can start development? | 铲屎官 | — |

**Principle: Cat provides structured recommendations. Human confirms decisions that affect scope/cost/direction.**

---

## 6. Mission Hub Panel — Definitive View Spec

### Block A: Governance + Delivery Health (was "Project Health")

| Metric | Source | Display |
|--------|--------|---------|
| Cards triaged | Triage results | 45 / 52 cards triaged |
| Build Now ready | Triage bucket counts | 18 cards ready |
| Open questions | Resolution items | 7 unresolved |
| Slices completed | Slice status | 2 / 5 slices done |
| Tests passing | External project CI | 251 / 251 |

### Block B: Translation Matrix

| Column | Content |
|--------|---------|
| Client's words | Original requirement text |
| Intent Card | Our structured translation |
| Source tag | Q/O/D/R/A badge |
| Triage bucket | Build Now / Clarify / Validate / Challenge / Later |
| Status | Open / Resolved / In Development / Done |

### Block D: Risk Alerts + Clarification Queue

Three alert types:
- **AMBIGUOUS** (red) — Clarify First items needing client input
- **UNANCHORED** (orange) — Validate First items (A-tagged, needs provenance upgrade)
- **DEPENDENCY** (purple) — Hidden coupling detected

Plus: **Questions for Client** section (constrained confirmation format)
Plus: **Run Need Audit** action button

---

## 7. Interface with F070 / F049 / F058

| Feature | Interface point | Data flow |
|---------|----------------|-----------|
| F070 Portable Governance | DispatchMissionPack | Slice → work item → dispatch with mission context |
| F070 Phase 3 (Reflux) | Pattern Reflux | Methodology learnings only (no project data) |
| F049/F058 Mission Hub | Panel integration | F076 adds "External Project" tab to existing Hub |

---

## 8. Risk Detection: 8 Signals (Definitive)

| # | Signal | Detection heuristic | Severity |
|---|--------|---------------------|----------|
| 1 | Hollow verbs | "improve/optimize/support/manage" without specific action | Medium |
| 2 | Missing actors | No actor specified or actor = "the system" | High |
| 3 | Unknown data source | Data referenced but origin/truth-source not stated | High |
| 4 | Missing success signal | No observable proof of completion | High |
| 5 | Missing edge cases | Only happy path; no error/empty/permission/undo | Medium |
| 6 | Hidden dependencies | One card drags in 3+ sub-systems | High |
| 7 | AI fake specificity | Long text but empty object model / no state transitions | Critical |
| 8 | Scope creep | MVP and enterprise-complete requirements mixed | Medium |

---

## 9. Methodology Lineage

| Our stage | Academic / industry lineage |
|-----------|---------------------------|
| Stage 0: Frame | Volere stakeholder/goal/scope, JTBD, Opportunity Solution Tree |
| Stage 1: Downgrade | Volere atomic requirement, IEEE 29148 requirement qualities |
| Stage 1.5: Domain Pass | Volere business data model, Domain-Driven Design |
| Stage 2: Triage | INCOSE/SEBoK traceability, BABOK requirement layers |
| Stage 3: Resolution Design | ATDD, Three Amigos, Specification by Example |
| Stage 4: Slice Planning | User Story Mapping, Impact Mapping |
| Commercial (deferred) | Volere waiting room, Agile contract models |

---

## 10. What's Deferred to v3

| Item | Why deferred | When to revisit |
|------|-------------|-----------------|
| Card family (Constraint/Quality/Transition) | Cognitive load; Intent Card covers 80% of initial needs | After first real audit trial |
| Commercial packaging | Business decision, not tech scope | When 铲屎官 needs pricing framework |
| Automated risk detection | Need real data to train heuristics | After 2-3 manual audit trials |
| Skeptic/Auditor agent | Natural fit for 砚砚, but needs audit data to audit | After first audit produces cards |

---

## Next Steps

1. **Trial run**: Execute Need Audit on studio-flow's real client PRD (validate schema + expose gaps)
2. **Implementation planning**: After trial, write `writing-plans` for F076 Phase 1
3. **Phase 1 scope**: Ingestion Layer + Audit Workbench (Stages 0-3) + basic Mission Hub panel
