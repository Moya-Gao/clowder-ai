---
doc_kind: research_synthesis
topics: [biomedicine, immunology, cd8-treg, klra5, anti-pd1, experimental-plan]
created: 2026-04-30
author: "砚砚/GPT-5.5"
status: claude-gemini-synthesis-gpt-pending
inputs:
  - docs/research/2026-04-30-klra5-cd8-treg/cross-model-evidence-matrix.md
  - docs/research/2026-04-30-klra5-cd8-treg/claude-deep-research.md
  - docs/research/2026-04-30-klra5-cd8-treg/gemini-deep-research.md
  - docs/research/2026-04-30-klra5-cd8-treg/cross-model-intake-brief.md
---

# Synthesis: Klra5+ Tumor-Specific CD8 T Cells

This synthesis integrates the Claude and Gemini Deep Research outputs plus cross-cat adversarial review. ChatGPT Deep Research is still missing; when it becomes available, add `chatgpt-deep-research.md` and a delta section instead of restarting the analysis.

## 0. Friend-Facing Summary

### 30-second version

You found a real and potentially important **Klra5/Ly49E+ tumor-specific CD8 T-cell state** with a pro-tumor adoptive-transfer phenotype. It overlaps transcriptionally with known Ly49+/KIR+ CD8 regulatory programs, but **it should not be called a bona fide CD8 Treg yet**. The immediate priority is not to pick a story; it is to prove whether the population is truly Ly49E/Klra5-defined, truly tumor-specific, and actively suppressive rather than an exhausted/sink/transfer artifact.

### Safe labels for now

For grants / paper draft:

> A tumor-specific CD8+ T-cell subset characterized by Klra5/Ly49E expression and a pro-tumor adoptive-transfer phenotype, with transcriptomic features partially overlapping published Ly49+/KIR+ CD8 regulatory programs but mechanistically distinct from the canonical Ly49F/Qa-1 axis.

For lab meeting:

> Klra5+ tumor-specific CD8 state with a regulatory-like transcriptome.

Avoid these as labels until proven:

- `CD8 Treg`
- `exhausted CD8`
- `uPA-driven CD8`
- `suppressive CD8`

Those may become mechanisms or interpretations later; right now they are hypotheses.

## 1. Core Verdict

The best current interpretation is:

> This is a **Klra5/Ly49E-marked tumor-specific CD8 state with pro-tumor function**, partially overlapping Ly49+/KIR+ CD8 regulatory biology, but not yet proven to be the classical Cantor/Davis CD8 Treg lineage or a uPA-Ly49E-driven checkpoint state.

Why this position:

1. Both cloud reports agree that a clean classical CD8 Treg label is not justified.
2. Claude is more conservative and better handles negative evidence; Gemini gives sharper mechanistic hypotheses but overweights uPA-Ly49E.
3. Cross-cat review converged on one methodological show-stopper: if protein-level Ly49E/Ly49F separation is wrong, every downstream conclusion is unstable.
4. The observed anti-PD-1 reduction can be cause, consequence, or indirect clearance. It is not mechanistic proof.

## 2. Top-Level Risks

### Risk A: CM4 antibody ambiguity

CM4 is an anti-Ly49E/F antibody. If the current cell definition depends on CM4 alone, the population may include Ly49F+ cells from the canonical CD8 Treg axis rather than true Ly49E/Klra5 cells.

Decision consequence:

- If the population is mostly Ly49F/Klra6+ or cannot be separated from Ly49F, the project pivots toward classical CD8 Treg / Qa-1 biology.
- If the population is true Ly49E/Klra5+ and Ly49F-, the project pivots toward convergent tumor-induced or Ly49E-associated states.

### Risk B: "Tumor-specific" may not mean the same thing across assays

Tumor-specific could mean tetramer/dextramer-sorted endogenous clones, TCR-transgenic cells, activation-marker inferred cells, or scTCR-predicted cells. These are not equivalent.

Decision consequence:

- If Klra5+ cells are not enriched for verified tumor-reactive clonotypes, the transfer phenotype should be interpreted as a tumor-ecosystem or bystander effect until redefined.
- If they share tumor-reactive TCRs with Tpex/TEFF/Tex compartments, lineage and fate mapping become central.

### Risk C: uPA-Ly49E is elegant but underproven in CD8 alpha-beta T cells

Ly49E-uPA is real in NK-cell contexts, and tumors can be uPA/PLAUR-rich. But direct evidence that mature tumor-specific CD8 alpha-beta T cells are functionally suppressed through Ly49E-uPA remains extrapolated.

Decision consequence:

- Test uPA-Ly49E decisively.
- Do not organize the whole thesis around it before the perturbation result.

## 3. Hypothesis Set

| Hypothesis | What It Would Mean | Current Weight | What Would Upgrade It | What Would Kill It |
|------------|--------------------|----------------|-----------------------|--------------------|
| H1: Bona fide CD8 Treg-like, classical axis | These are close to Cantor/Davis Ly49+/KIR+ regulatory CD8 cells, possibly involving Ly49F/Qa-1 and Helios/perforin biology. | Possible, not leading | Ly49F/Klra6 or Helios/Eomes/CD122 high; Qa-1/H2-T23 dependence; contact/perforin-mediated suppression. | True Ly49E/Ly49F- cells, no Helios program, no Qa-1 dependence, no contact-dependent suppression. |
| H2: Convergent tumor-induced regulatory-like CD8 state | Chronic tumor-antigen/TME signals induce a regulatory-like transcriptome and pro-tumor function without classical lineage identity. | Leading working frame | True tumor-reactive Klra5+ clones; regulatory-like module; active suppression or niche displacement; not explained by Ly49F/Qa-1. | No functional suppression/sink effect after proper matched controls. |
| H3: Terminal exhausted / sink state | Klra5 marks a terminal dysfunctional fate; pro-tumor transfer reflects sink, poor persistence, cytokine competition, or artifact. | Strong competitor | TOX/TIM-3/Lgals3 high, TCF1 low; clonally downstream of Tpex/Tex; no active suppression in co-culture. | Clear contact/perforin-dependent killing or cytokine-mediated suppression by Klra5+ cells. |
| H4: Ly49E-uPA-associated checkpoint-like branch | Tumor/stromal uPA functionally engages Ly49E and disables or maintains the pro-tumor state. | Interesting branch, not default | Klra5 loss-of-function or uPA/PLAU/PLAUR perturbation abolishes pro-tumor transfer and/or improves anti-PD-1 response. | Perturbing uPA/Klra5 has no effect while other suppression assays stay positive. |
| H5: IL-10/TGF-beta / Tr1-like CD8 | Cells are regulatory-like through soluble cytokines rather than Ly49/Qa-1/uPA axes. | Lower but plausible | IL-10/TGF-beta enriched; neutralization/KO rescues effector function. | Contact/perforin-only phenotype, no cytokine dependency. |

## 4. Tier 0: Information Required Before New Mechanism Claims

Ask the PhD friend to fill these variables before a final experimental calendar is frozen:

| Required Input | Why It Matters |
|----------------|----------------|
| Tumor model and strain | B16, MC38, CT26, KP, 4T1, etc. differ in MHC-I, myeloid dominance, ICB responsiveness, and uPA/PLAUR ecology. |
| Definition of tumor-specific | Dextramer, TCR-transgenic, endogenous neoantigen, activation-marker inference, or scTCR inference each carry different uncertainty. |
| Sorting/gating strategy | Determines whether "Klra5+" means RNA+, CM4+, reporter+, or antibody-defined Ly49E/F+. |
| Timing relative to tumor and anti-PD-1 | Fate-state interpretation depends on whether cells appear pre-treatment, during early expansion, or after terminal dysfunction. |
| Adoptive-transfer controls already done | Need matched Klra5- tumor-reactive cells, equal dose/viability, transfer into same tumor stage, and persistence tracking. |

## 5. Tier 1 Must-Do Experiments

These are ordered by decision-tree logic. The point is to prevent six months of mechanism work on an ambiguous population.

| Priority | Experiment | Tests | Decision Rule |
|----------|------------|-------|---------------|
| T1.1 | Ly49E vs Ly49F protein disambiguation with two independent approaches | Is the population truly Klra5/Ly49E-defined, or CM4/Ly49E/F mixed? | If CM4+ cells are Ly49F+ or cannot be separated from Ly49F, stop using "Klra5/Ly49E" as a clean protein label. |
| T1.2 | High-dimensional phenotype panel: Helios, Eomes, CD122, TOX, TCF1, PD-1, TIM-3, TIGIT, NKG2A, Lgals3 | H1 vs H2 vs H3 | Helios/Eomes/CD122 high with low TOX favors regulatory lineage; TOX/TIM-3/Lgals3 high with low TCF1 favors terminal exhaustion/sink. |
| T1.3 | Tumor-specificity validation by dextramer/tetramer plus scTCR-seq | Is this really tumor-antigen-reactive? | If tumor-reactive clonotypes are not enriched, redefine the population before functional claims. |
| T1.4 | Lineage bifurcation analysis using scTCR sharing across Tpex/TEFF/Tex/Klra5+ states | Is Klra5+ a Tpex-derived branch, Tex endpoint, or separate lineage? | Shared clonotypes with Tpex/TEFF imply fate transition; separate clone pool implies independent selection. |
| T1.5 | Matched Klra5+ vs Klra5- tumor-antigen-specific adoptive transfer | Is pro-tumor function specific to Klra5+ state? | If Klra5- matched cells also promote growth, the current functional interpretation is not Klra5-specific. |
| T1.6 | In vitro suppression/sink assay: contact vs transwell, effector CD8 and CD4 targets, perforin and IL-10/TGF-beta rescue arms | Active regulatory function vs exhausted/sink artifact | Contact + perforin dependence supports cytotoxic regulation; soluble rescue supports cytokine suppression; no effect pushes toward passive marker/sink. |
| T1.7 | Qa-1/H2-T23 testing if Ly49F or classical-CD8-Treg possibility remains | Classical Cantor axis | Loss of pro-tumor effect with Qa-1/H2-T23 disruption supports H1-like mechanism; no effect lowers H1 priority. |

## 6. Tier 2 Mechanism Experiments

Tier 2 starts after T1.1-T1.6 establish a clean population and a real functional phenotype.

| Experiment | Why It Is Tier 2 | Upgrade Condition |
|------------|------------------|-------------------|
| Klra5 loss-of-function in T cells | Distinguishes marker from driver, but should not precede clean identity definition. | If loss of Klra5 removes pro-tumor transfer phenotype or improves anti-PD-1 response. |
| uPA/PLAU/PLAUR perturbation | Tests the elegant uPA-Ly49E branch. | If uPA/PLAU/PLAUR perturbation phenocopies Klra5 loss-of-function or abolishes Klra5+ pro-tumor activity. |
| NKG2A/Qa-1 blockade | Tests parallel MHC-Ib inhibitory checkpoint. | If blockade rescues TEFF/TEM function despite Klra5+ presence. |
| Spatial transcriptomics / multiplex imaging | Resolves target-cell contact and niche model. | If Klra5+ cells contact effector CD8/CD4 and correlate with target apoptosis or exclusion. |
| Cross-species validation | Tests translational relevance. | If mouse Klra5+ signature maps to human KIR+ CD8 regulatory states and predicts ICB non-response independently of generic exhaustion. |

## 7. Anti-PD-1 Interpretation

The observation that anti-PD-1 reduces Klra5+ cells can fit at least four models:

| Model | Meaning | Distinguishing Readout |
|-------|---------|------------------------|
| Direct reprogramming/deletion | Anti-PD-1 acts directly on Klra5+ cells. | Early Klra5+ apoptosis or state transition before TEFF expansion. |
| Ecosystem remodeling | Anti-PD-1 expands TEFF/TEM, changing the niche and reducing Klra5+ maintenance. | TEFF/TEM expansion precedes Klra5+ contraction. |
| Effector-mediated clearance | Reinvigorated effectors kill Klra5+ cells. | Spatial TEFF-Klra5 contacts, cytotoxic/apoptosis signatures in Klra5+ cells; loss of contraction when effector cytotoxicity is impaired. |
| Causal resistance driver | Klra5+ cells actively block anti-PD-1 efficacy. | Klra5+ depletion improves anti-PD-1; sustained replenishment blunts response. |

Do not infer causality from population reduction alone. The clean causal design is:

> Klra5+ depletion or replenishment +/- anti-PD-1, with tumor growth, TEFF/TEM expansion, and Klra5+ persistence measured together.

## 8. What To Tell The PhD Friend To Do First

If they can only do a small first wave:

1. Re-audit the gating and reagents, especially whether CM4 is being used as if it were Ly49E-specific.
2. Validate true tumor specificity with dextramer/tetramer and scTCR.
3. Run matched Klra5+ vs Klra5- transfer, not Klra5+ vs empty only.
4. Run the suppression/sink assay before naming the cells "regulatory."
5. Keep uPA/Klra5 perturbation ready, but do not make it the thesis until T1 confirms the population and function.

## 9. Claims To Avoid In Talks Or Drafts

Do not say:

- "We discovered a new CD8 Treg subset" before T1.6/T1.7.
- "Ly49E is the mouse equivalent of human KIR in this tumor setting" without functional mapping.
- "anti-PD-1 works by deleting Klra5+ cells" without temporal/causal evidence.
- "uPA drives the phenotype" before perturbation.
- "CM4+ equals Ly49E+" without orthogonal validation.

Safer phrasing:

- "These data identify a Klra5/Ly49E-associated tumor-specific CD8 state with unexpected pro-tumor activity."
- "The state partially overlaps published CD8 regulatory programs but diverges from the canonical Ly49F/Qa-1 axis."
- "We are testing whether this reflects active suppression, terminal exhaustion/sink behavior, or a Ly49E-associated tumor-stroma checkpoint."

## 10. GPT Delta Protocol

When ChatGPT Deep Research becomes available:

1. Save the report as `docs/research/2026-04-30-klra5-cd8-treg/chatgpt-deep-research.md`.
2. Add a `GPT` column or delta rows to `cross-model-evidence-matrix.md`.
3. Append a `## GPT Delta` section here with only material that changes the conclusion, experiment priority, or citation hygiene.
4. Do not rewrite the whole synthesis unless GPT provides a stronger primary-source correction.

## 11. Convergence Check

1. ADR needed? No. This is a research synthesis, not a project architecture decision.
2. Lesson needed? No durable process lesson yet. The source-hygiene issue is captured inside this research folder; if it recurs across projects, promote it to lessons-learned.
3. Shared rule update needed? No. Existing deep-research process already requires citation verification and synthesis before decision.

## 12. Next Review Request

Ask Opus 4.6 and Opus 4.7 to review:

- Did the synthesis correctly downweight uPA-Ly49E without discarding it?
- Is the Tier 1 sequence scientifically defensible?
- Is the safe label strict enough for lab meeting / thesis committee use?
- Are there any remaining overclaims that should be downgraded to `needs verification`?
