---
feature_id: F208
doc_kind: capability-profile-template
version: 1.0
created: 2026-06-21
notes:
  - This is a BLANK TEMPLATE for teams adopting capability-profile routing.
  - Fill in your own team members — DO NOT use Cat Café example data as defaults.
  - See cold-start-routing.md for bootstrapping guidance.
  - See cat-dossier-example-catcafe.md for a worked example (marked DEMO).
---

# [Your Team] Capability Profile (Cat Dossier)

> **Purpose**: Decision data for task handoff — not a resume (strengths only), but a
> full profile (strengths + blind spots + meltdown signals).
> **Reading guide**: Quick handoff → one-liner summary; Complex/uncertain handoff →
> expand 6 fields; Need evidence → follow provenance links.
> **What this is NOT**: Not an algorithmic routing table. Profiles provide data;
> judgment is made by the agent holding the ball (human or AI).

## Schema: L1 Profile — 6 Fields

| # | Field | Description |
|---|-------|-------------|
| 1 | **Peak Abilities** | What this agent does best — high confidence of quality output |
| 2 | **Underrated Abilities** | Easily overlooked strengths (prevents routing bias) |
| 3 | **Bad Intuitions** | Systematic cognitive biases — not occasional mistakes, but patterns |
| 4 | **Anti-Signals** | When should you NOT call this agent (more precise than "weaknesses") |
| 5 | **Synergy & Anti-Patterns** | Who pairs well / who pairs badly |
| 6 | **Meltdown Signals** | Observable external signals that this agent is going off the rails |

Each entry should include **provenance**: `[source_type: drilldown_path | date]`
- `peer`: teammate observation → link to conversation/review
- `owner`: team lead/CVO experience → link to notes
- `incident`: specific event/lesson → link to commit/PR/issue
- `eval`: evaluation data → link to benchmark results
- `self`: self-reflection (lowest priority) → link to config/docs

## Team Members

<!-- Copy this block for each team member -->

### [Agent Name] · @[handle] · `cat:[id]`

```yaml
# structured-profile: cat:[id]
entityId: "cat:[id]"
oneLiner: "[One sentence — core value + primary risk, not a resume]"
l0RosterSummary: "[Routing-facing summary: what to hand off to this agent]"
routingSignals:
  peakCapabilities:
    - "[Capability 1]"
    - "[Capability 2]"
  antiSignals:
    - "[When NOT to route here 1]"
    - "[When NOT to route here 2]"
provenance:
  version: "0.1"
  date: "[YYYY-MM-DD]"
  primarySources: []  # owner | peer | incident | eval | self
```

| # | Field | Content |
|---|-------|---------|
| 1 | **Peak Abilities** | [Fill in] |
| 2 | **Underrated Abilities** | [Fill in] |
| 3 | **Bad Intuitions** | [Fill in] |
| 4 | **Anti-Signals** | [Fill in] |
| 5 | **Synergy & Anti-Patterns** | [Fill in] |
| 6 | **Meltdown Signals** | [Fill in] |

<!-- End of agent block — duplicate above for each team member -->

---

## How to Use This Template

1. **Start small**: Begin with 2-3 agents. You don't need all 6 fields filled on day 1.
2. **Peak Abilities first**: Field 1 is the minimum viable profile — routing works with just this.
3. **Grow from incidents**: Fields 3/4/6 emerge from real handoff failures, not theory.
4. **Provenance matters**: Every claim needs a link back to evidence. "I think X" with no
   backing is noise, not signal.
5. **Cold start?** See `cold-start-routing.md` for bootstrapping without historical data.
6. **Evolution**: Append new observations with version tags `[vX.Y | date]`. Don't delete
   old observations — history shows growth trajectory.

## Distillation (Optional — requires infrastructure)

If your platform supports automated distillation (like Cat Café's `DossierDistillationProposal`):
- Events (review completion, phase close) trigger distillation proposals
- A human approves/rejects each proposal before it modifies the profile
- `baseHash` stale-write lock prevents concurrent overwrites
- The profile file stays in git — full history via `git log`

Without infrastructure, manual updates work fine. The value is in the profiles existing,
not in how they're updated.
