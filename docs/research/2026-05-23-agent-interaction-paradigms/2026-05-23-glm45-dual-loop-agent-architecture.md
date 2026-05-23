# GLM-4.5 Dual-Loop Agent Architecture (CoCo + AICO)

- **Source**: Zhipu AI (智谱)
- **Date**: 2026-05 (approximate)
- **Type**: Enterprise agent architecture proposal
- **Noted by**: 烁烁/Gemini

## Core Concept: Dual-Loop Synergy

GLM-4.5 proposes a "dual-loop collaborative architecture" for enterprise
agents, splitting agent work into two complementary cycles to "activate
existing assets and release data value."

## Outer Loop: CoCo Exploration Loop

- **Role**: Autonomous enterprise agent for **human-AI collaborative
  exploration**
- **Scenarios**: Complex, open-ended, uncertain tasks
- **Examples**: Market research, data analysis
- **Metaphor**: Scout / think-tank — explores new paths alongside humans

## Inner Loop: AICO Execution Loop

- **Role**: Process orchestration and agent development for **efficient,
  stable execution of known tasks**
- **Scenarios**: Mainstream, scalable daily operations
- **Examples**: Template writing, standard process orchestration
- **Metaphor**: Assembly-line operator — executes established rules strictly

## Loop Interaction (the key insight)

The loops are not isolated but dynamically connected:

1. **Experience Crystallization (Outer -> Inner)**: Successful patterns
   discovered through CoCo exploration are refined and **crystallized into
   standard processes**, then handed to AICO for scalable, automated execution.

2. **Feedback Loop (Inner -> Outer)**: AICO takes over mainstream tasks,
   freeing human/compute capacity. New blind spots and requirements discovered
   during execution feed back to CoCo for re-exploration.

**One-liner**: "Outer loop conquers new territory (explore methods), inner loop
holds territory (execute efficiently). Successful exploration becomes rules,
rules get executed, cycle repeats."

## Relevance to Cat Cafe and Interaction Models

This dual-loop maps interestingly onto the Interaction Models question:

- **TML's Interaction Model** (200ms micro-turns, 12B active / 276B total) is
  essentially an architectural realization of this split: fast reflexive
  interaction (inner loop / muscle memory) + async deep reasoning delegation
  (outer loop / exploration)
- **Cat Cafe's routing**: if A2A routing decisions (which cat, which tool)
  could be handled by a fast "inner loop" reflex layer (like TML's 12B active
  params) while deep reasoning stays in the background, real-time collaborative
  interaction becomes feasible
- **Symphony** sits purely in the inner loop paradigm — deterministic
  orchestration of known work items, no exploration
