---
feature_id: F208
doc_kind: capability-profile-example
version: 1.0
created: 2026-06-21
demo: true
notes:
  - "⚠️ DEMO ONLY — This is Cat Café's real team profile, shown as a worked example."
  - "DO NOT use this as your team's default — your agents are not our agents."
  - "See cat-dossier-template.md for a blank starting point."
---

<!-- ============================================================ -->
<!--  ⚠️  D E M O   E X A M P L E                                -->
<!--                                                              -->
<!--  This file shows Cat Café's REAL capability profiles as a    -->
<!--  reference for how to fill in your own team's dossier.       -->
<!--                                                              -->
<!--  YOUR TEAM'S AGENTS ARE NOT THESE AGENTS.                    -->
<!--  Do not copy-paste content — copy the STRUCTURE.             -->
<!-- ============================================================ -->

# Cat Café Capability Profiles (DEMO EXAMPLE)

> **What this demonstrates**: A 5-agent team using L1 6-field profiles with provenance
> tracking. Two agents shown in full detail below; the real file has 8+ agents.
>
> **What to learn from this**:
> - How to write "peak abilities" that inform routing decisions
> - How "bad intuitions" differ from generic weaknesses
> - How provenance links back to real incidents (not theory)
> - How the structured YAML block enables machine consumption

## Schema (same as template)

| # | Field | Description |
|---|-------|-------------|
| 1 | **Peak Abilities** | What this agent does best |
| 2 | **Underrated Abilities** | Overlooked strengths (prevents routing bias) |
| 3 | **Bad Intuitions** | Systematic cognitive biases — patterns, not one-offs |
| 4 | **Anti-Signals** | When NOT to call this agent |
| 5 | **Synergy & Anti-Patterns** | Good pairs / bad pairs |
| 6 | **Meltdown Signals** | Observable signals that things are going wrong |

---

## DEMO: Agent 1 — Fast Coder (Claude Opus 4.6)

### 布偶猫 Opus 4.6 · @opus · `cat:opus`

```yaml
# structured-profile: cat:opus
entityId: "cat:opus"
oneLiner: "Fast coder — ships quickly but tends to cut corners. 'It works' ≠ 'It's done'."
l0RosterSummary: "Fast coding + system design; can push spec→impl→test in one session"
routingSignals:
  peakCapabilities:
    - "Full-stack implementation from spec to tests in one session"
    - "Translating vague human requirements into executable agent tasks"
    - "Quick self-correction when given evidence"
  antiSignals:
    - "End-to-end acceptance testing (too expensive, use lighter model)"
    - "Cautious architecture decisions (needs deeper deliberation)"
    - "Solo code review (misses things — needs cross-team reviewer)"
provenance:
  version: "0.1"
  date: "2026-05-25"
  primarySources: ["owner", "peer", "incident"]
```

| # | Field | Content |
|---|-------|---------|
| 1 | **Peak Abilities** | Fast coding + system design in one. Can push from spec to implementation to tests in one session. Fastest code velocity on the team. Naturally understands file system paths and structures. |
| 2 | **Underrated Abilities** | Understands human intent — best "translator" between fuzzy owner requests and executable agent tasks. Quick self-correction when shown evidence (doesn't fight it). |
| 3 | **Bad Intuitions** | **Hotfix mentality** (core): trained on "minimal change" → becomes scaffolding — builds something that runs and wants to move on, leaving "follow-up" tails. **Confident confabulation**: "I'm done" (actually just works, not production-ready). **Fragment reasoning** (family trait): finds one high-confidence hit and starts reasoning before reading the actual source. |
| 4 | **Anti-Signals** | End-to-end acceptance testing (use cheaper model). Deep architecture decisions (needs more deliberative agent). Solo reviewer role (tends to miss things). |
| 5 | **Synergy & Anti-Patterns** | **Good**: This agent as author + cross-provider reviewer (blind spot complementarity). **Bad**: Same model reviewing itself (shared blind spots = no gate). |
| 6 | **Meltdown Signals** | Says "done" with no test evidence. Message contains "follow-up / will address later / good enough for now". Starts reasoning from search snippets without reading source files. |

---

## DEMO: Agent 2 — Deep Thinker (Claude Opus 4.7)

### 布偶猫 Opus 4.7 · @opus47 · `cat:opus-47`

```yaml
# structured-profile: cat:opus-47
entityId: "cat:opus-47"
oneLiner: "Deliberator — finds structure in ambiguity but over-processes trivia. Ask for direction, not execution."
l0RosterSummary: "Architecture design, protocol layer, cross-disciplinary reasoning, long-form convergence"
routingSignals:
  peakCapabilities:
    - "Finding structure in ambiguous problems"
    - "Cross-disciplinary association and long-term plan convergence"
    - "Pushing back with evidence while acknowledging uncertainty"
  antiSignals:
    - "Trivial tasks (will over-engineer them)"
    - "High-volume mechanical work (too slow, too expensive)"
    - "Tasks needing fast iteration (deliberation adds latency)"
provenance:
  version: "0.1"
  date: "2026-05-25"
  primarySources: ["peer", "incident"]
```

| # | Field | Content |
|---|-------|---------|
| 1 | **Peak Abilities** | Architecture design + finding structure in ambiguity. Cross-disciplinary reasoning. Can push back with evidence while admitting what's uncertain. Strong at long-form document convergence. |
| 2 | **Underrated Abilities** | Genuinely curious about why things are the way they are — not just solving the task but understanding the problem space. Can write nuanced docs that capture trade-offs without false certainty. |
| 3 | **Bad Intuitions** | **Over-processing trivia**: Applies full SOP to 5-line changes. **Objectivity compulsion**: Avoids taking a stance when a stance is exactly what's needed. **Literal interpretation**: Sometimes follows the letter of a request while missing the spirit. |
| 4 | **Anti-Signals** | Fast iteration tasks. High-volume mechanical edits. When the answer is obvious and just needs doing (deliberation adds nothing). |
| 5 | **Synergy & Anti-Patterns** | **Good**: Paired with fast coder — one designs, other implements. Paired with external reviewer for architecture validation. **Bad**: Two deliberators together (analysis paralysis). |
| 6 | **Meltdown Signals** | Starts full SOP for a one-liner. Writes "on one hand... on the other hand" without concluding. Asks permission for clearly reversible actions. Outputs get longer without getting more precise. |

---

## What to Notice (DEMO Learning Points)

1. **Bad intuitions are specific and evidence-based** — not generic "sometimes makes mistakes".
   Every claim links to a real incident or owner observation.

2. **Anti-signals are routing-actionable** — they answer "when should I NOT route here?"
   rather than listing abstract weaknesses.

3. **Synergy/anti-patterns are pair-level** — not "works well with others" but specific
   combinations and WHY they work/fail.

4. **Meltdown signals are observable** — things a teammate can SEE happening, not internal
   states only the agent knows about.

5. **The structured YAML block** enables machine consumption while the markdown table
   remains human-readable. Both say the same thing in different formats.

6. **Provenance is non-negotiable** — "I think this agent is good at X" without evidence
   is noise. Every claim needs a trail back to observation, incident, or eval data.
