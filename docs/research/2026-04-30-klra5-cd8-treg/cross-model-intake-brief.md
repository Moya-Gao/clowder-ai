---
doc_kind: research_intake_brief
topics: [biomedicine, immunology, cd8-treg, klra5, anti-pd1, cross-model-review]
created: 2026-04-30
author: "砚砚/GPT-5.5"
status: discussion-brief
inputs:
  - docs/research/2026-04-30-klra5-cd8-treg/claude-deep-research.md
  - docs/research/2026-04-30-klra5-cd8-treg/gemini-deep-research.md
  - docs/prompts/2026-04-30-klra5-cd8-treg-deep-research-prompt.md
---

# Cross-Model Intake Brief: Klra5+ CD8 T Cell Deep Research

## Current State

Two cloud deep-research outputs have been archived:

- `claude-deep-research.md`
- `gemini-deep-research.md`

The ChatGPT / GPT cloud run is currently missing because the cloud service was unavailable. Treat GPT as `pending`, not as silent agreement.

This brief is not the final scientific synthesis. It is a discussion scaffold for cross-model adversarial review.

## First-Pass Verdict Comparison

| Axis | Claude | Gemini | Initial Read |
|------|--------|--------|--------------|
| Identity verdict | "Related but distinct suppressive CD8 state" with partial Ly49/KIR CD8 Treg features | "Exhausted, uPA-responsive, NK-like chronically stimulated CD8 state" | Both reject a clean "bona fide classical CD8 Treg" label. Gemini is more decisive; Claude is more conservative. |
| Confidence | Moderate | High on not being classical Cantor-lineage; moderate on mechanism | Gemini may be overconfident where CD8-specific Ly49E/uPA evidence is still extrapolated. |
| Core divergence from CD8 Treg | Klra5/Ly49E is distinct from Klra6/Ly49F and classical Qa-1/H2-T23 axis | Same, stronger: Ly49E/uPA axis is the central explanation | Strong consensus that Ly49E vs Ly49F is decisive. |
| Main mechanism | Mixed: suppressive/regulatory-like CD8 plus possible Ly49E-uPA axis, effector fratricide, cytokine/niche possibilities | uPA-driven direct effector paralysis / terminal exhaustion / NK-like state | Debate should focus on whether uPA-Ly49E is driver, marker, or elegant overfit. |
| Anti-PD-1 interpretation | Mixed C+A+E: ecosystem remodeling, some causal resistance, possible effector-mediated clearance | Mostly terminal state dynamics / AICD or clearance after effector reinvigoration | Both warn that anti-PD-1 reduction does not prove causality. |
| Experimental posture | More exhaustive, includes strong decision rules and multiple competing mechanisms | More pointed, prioritizes uPA/Klra5 axis and exhaustion-vs-Treg disambiguation | Claude is better for experimental matrix; Gemini is better for hypothesis sharpness. |

## Strong Consensus

1. Do not call these cells bona fide CD8 Tregs yet.
2. Klra5/Ly49E must be separated from Ly49F/Klra6 and Qa-1/H2-T23 biology.
3. Tumor-specificity definition is a hard prerequisite: tetramer/dextramer, TCR-transgenic system, activation-marker inference, or scTCR inference have different evidentiary weight.
4. Protein-level validation is mandatory; RNA-level Klra5 is insufficient.
5. Anti-PD-1 reducing this subset is compatible with several causal directions and cannot by itself establish resistance mechanism.
6. The most important first experiments are identity/protein validation, matched Klra5+ vs Klra5- controls, functional suppression/sink assays, and perturbation of Klra5/uPA or relevant axes.

## Key Disagreements to Discuss

### D1. What label should be used now?

Options:

- "Tumor-induced suppressive/regulatory-like CD8 state"
- "uPA-responsive exhausted / NK-like CD8 state"
- "CD8 Treg-like but mechanistically divergent from classical Cantor/Davis lineage"
- "Klra5+ tumor-specific CD8 state" only, with no functional label until validated

The safest current label may be: **Klra5+ tumor-specific CD8 state with pro-tumor function and partial CD8 Treg-like features**.

### D2. Is uPA-Ly49E a driver or a tempting narrative?

Both reports center the uPA / Ly49E axis, but both also admit the direct CD8 T cell evidence is weak or extrapolated from NK/NKT contexts.

Discussion questions:

- Should uPA/Ly49E be the leading mechanistic hypothesis or one branch among several?
- What evidence would make it a driver rather than a correlated tumor-stroma feature?
- How should we phrase this to the PhD friend without overclaiming?

### D3. Is the adoptive-transfer phenotype active suppression or artifact?

Both reports warn that "promotes tumor growth" could reflect:

- active suppression or killing of effector immune cells
- cytokine / IL-15 / IL-2 niche competition
- antigen sink
- exhausted-cell transfer artifact
- tumor-stage or engraftment confounding

The final plan must treat active suppression as unproven until matched controls and functional assays resolve it.

### D4. What is the minimum experiment set?

Candidate minimum set:

1. Ly49E vs Ly49F protein disambiguation with orthogonal validation.
2. Tumor-specificity validation by tetramer/dextramer and scTCR.
3. Matched Klra5+ vs Klra5- tumor-specific adoptive transfer with equalized dose and engraftment tracking.
4. In vitro suppression/sink assay with contact vs soluble and rescue controls.
5. Perturbation test: Klra5 loss-of-function or uPA/PLAU perturbation, paired with anti-PD-1.

Question: Is this sufficient for a first experimental plan, or do we need Qa-1/H2-T23 testing in Tier 1?

## Red Flags Before We Trust Either Report

1. Citation verification is still required. Both reports name papers and PMIDs, but no local verification pass has been done.
2. Gemini uses stronger language around Ly49E/uPA and exhaustion than the direct CD8 evidence may justify.
3. Claude includes broader mechanisms, but some may be too exhaustive for a first-pass plan.
4. Both reports depend heavily on the missing experimental details: tumor model, mouse strain, tumor-specific definition, timing, sorting/gating, and transfer controls.
5. Gemini output includes image references and very compressed long lines from export; it should be normalized before final synthesis if humans need to read it deeply.

## Proposed Discussion Tasks

### For Opus 4.6

Focus: scientific logic and experimental design.

- Which first-tier experiments are truly must-do vs overbuilt?
- Is Qa-1/H2-T23 a Tier 1 discriminator or Tier 2?
- How should we phrase the uPA/Ly49E axis without overclaiming?

### For Opus 4.7

Focus: structure and adversarial synthesis.

- Which hypothesis label should be used in the friend-facing plan?
- Which claims are too attractive / too narratively clean?
- How should we proceed with GPT missing: wait, rerun later, or synthesize Claude+Gemini now with a missing-source caveat?

### For Gemini

Focus: visual and communication layer.

- How should the mechanism diagram distinguish "classical CD8 Treg" vs "uPA-responsive exhausted/NK-like" models?
- What metaphor is helpful but not misleading?
- Which parts of the final report need visual scaffolding for a biology PhD audience?

## Current Recommendation Before Cat Discussion

Do not produce the final experimental plan yet.

First, run a short cross-cat adversarial review on the two reports, then write:

- `cross-model-evidence-matrix.md`
- `synthesis.md`

If GPT cloud comes back later, add `chatgpt-deep-research.md` and update both files with a delta section rather than restarting from scratch.
