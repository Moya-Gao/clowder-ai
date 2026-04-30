---
doc_kind: cross_model_evidence_matrix
topics: [biomedicine, immunology, cd8-treg, klra5, anti-pd1, cross-model-review]
created: 2026-04-30
author: "砚砚/GPT-5.5"
status: claude-gemini-synthesis-gpt-pending
inputs:
  - docs/research/2026-04-30-klra5-cd8-treg/claude-deep-research.md
  - docs/research/2026-04-30-klra5-cd8-treg/gemini-deep-research.md
  - docs/research/2026-04-30-klra5-cd8-treg/cross-model-intake-brief.md
  - docs/prompts/2026-04-30-klra5-cd8-treg-deep-research-prompt.md
---

# Cross-Model Evidence Matrix: Klra5+ Tumor-Specific CD8 T Cells

This matrix compares the Claude and Gemini cloud reports plus cross-cat review from Opus 4.6 / Opus 4.7. ChatGPT Deep Research is unavailable at this point, so all GPT columns are left as `pending`.

This is not the final experimental plan. It is the evidence ledger used to write `synthesis.md`.

## Legend

| Term | Meaning |
|------|---------|
| `dual-consensus` | Claude and Gemini agree, or agree after conservative reframing. |
| `conflict` | Claude and Gemini differ in conclusion, confidence, or mechanism weight. |
| `single-source: Claude` | Only Claude raised the claim clearly. |
| `single-source: Gemini` | Only Gemini raised the claim clearly. |
| `reviewer-added` | Added by Opus 4.6 / Opus 4.7 cross-model review. |
| `verified` | Spot-checked against PubMed/PMC/vendor page in this pass. |
| `needs verification` | Needs primary-source or experimental-panel verification before being treated as fact. |

Evidence labels:

- `E1`: direct experimental evidence in related/same biology.
- `E2`: experimental evidence in a different context, extrapolated here.
- `E3`: computational/bioinformatic evidence or model-derived claim.
- `E0`: inference or hypothesis; useful, but not literature-established.

## Source Hygiene Notes

| Item | Verification Result | Implication |
|------|---------------------|-------------|
| Davis/KIR+ CD8 regulatory paper | Verified: Li et al., *Science* 2022, PMID 35258337, DOI 10.1126/science.abi9591; KIR+ CD8 cells suppress pathogenic CD4 T cells in autoimmunity/infection. | Strong anchor for human KIR+ CD8 regulatory biology, but not tumor-specific by itself. |
| Melanoma tumor-reactive KIR+ CD8 paper | Verified: final paper is *Nature Immunology* 2025, PMID 39609626, DOI 10.1038/s41590-024-02023-4. The 2024 PMID 38464315 is a Research Square preprint. | Use the final 2025 paper when citing the cancer/human anchor. |
| Ly49E-uPA paper | Verified: Van Den Broeck et al., *Blood* 2008, PMID 18784372, DOI 10.1182/blood-2008-06-164350. | Supports Ly49E-uPA in NK-cell context; CD8 alpha-beta T-cell function remains extrapolated. |
| Ly49E KO intestinal tumor paper | Verified: Van Acker et al., *Cancer Immunol Immunother* 2016, PMID 27585789. | Negative/null counterweight against treating Ly49E-uPA as the default tumor driver. |
| Cantor Nature Tfh suppression paper | Verified: Kim et al., *Nature* 2010, PMID 20844537, DOI 10.1038/nature09370. | Anchor for Qa-1-dependent CD8 regulatory control of Tfh/self-tolerance. |
| Cantor PNAS Ly49 CD8 Treg marker paper | Corrected: PMID is 21233417, not 21233414. DOI 10.1073/pnas.1018974108. | Cloud citation hygiene issue; keep PMIDs checked before external use. |
| Saligrama EAE paper | Corrected: PMID is 31391585, not 31391584. DOI 10.1038/s41586-019-1467-x. | Another cloud citation hygiene issue; do not trust model PMIDs without verification. |
| CM4 antibody specificity | Verified via Thermo Fisher product page: clone CM4 is anti-Ly-49E/F, reacting with Ly49E and Ly49F. | Prerequisite-level methodology risk: CM4-only sorting definitionally yields a Ly49E/F+ population, not a clean Ly49E/Klra5+ population. |

## Evidence Matrix

| Claim / Decision Point | Claude Stance | Gemini Stance | Cross-Cat Review | Consistency | Evidence Strength | GPT Slot |
|------------------------|---------------|----------------|------------------|-------------|-------------------|----------|
| Current safest label | "Related but distinct suppressive CD8 state with partial Ly49/KIR CD8 Treg features." | "Exhausted, uPA-responsive, NK-like chronically stimulated CD8 state." | Use observation-first label: `Klra5+ tumor-specific CD8 state with pro-tumor adoptive-transfer phenotype`; optional lab shorthand: `regulatory-like transcriptome`. | conflict | E0/E3; label choice, not a fact | pending |
| Do not call bona fide CD8 Treg yet | Yes; H1 lower than convergent suppressive state. | Yes; H1 unlikely. | Strongly agree. "CD8 Treg" encodes unproven lineage and mechanism. | dual-consensus | E0 decision supported by missing functional evidence | pending |
| Klra5/Ly49E is not Klra6/Ly49F and cannot be collapsed into Qa-1/H2-T23 | Strong emphasis; Ly49E-uPA diverges from Cantor axis. | Strong emphasis; treats Ly49E-uPA as core. | Agree; this is the first identity split. | dual-consensus | E1 for receptor/ligand distinction, E0 for this tumor subset | pending |
| Classical Cantor CD8 Treg axis is relevant background | Yes; includes Nature 2010, PNAS 2011, Science 2015, JCI 2024. | Yes; focuses on Ly49F/Qa-1/Helios divergence. | Agree as comparator, not identity proof. | dual-consensus | E1 for classical biology | pending |
| Davis/KIR+ CD8 regulatory biology is relevant background | Yes; human KIR+ CD8 equivalent to mouse Ly49+ CD8 Treg in autoimmunity/infection. | Yes; uses KIR+ CD8 analogy. | Agree, but functional equivalence does not mean mouse Klra5/Ly49E is same mechanism. | dual-consensus | E1 background, E2 for mouse tumor extrapolation | pending |
| Human melanoma KIR+ CD8 regulatory-like cells make cancer relevance plausible | Yes; cites tumor-antigen-specific KIR+ CD8 Tregs and worse OS. | Mentions less centrally. | Use final Nat Immunol 2025 paper, not only preprint; supports existence of pro-tumor KIR+ CD8 state in human cancer. | dual-consensus with source correction | E1 human cancer anchor, E2 for mouse Klra5 analog | pending |
| uPA-Ly49E is the leading mechanism | Claude: plausible H6, but not top mechanism. | Gemini: leading narrative. | Reject as default framework; keep as one decisive branch, likely Tier 2 unless early data point strongly to it. | conflict | E2 from NK/uPA + tumor uPA context; E0 for CD8 tumor cells | pending |
| uPA-Ly49E is a narrative overfit risk | Mentions caveat and Van Acker null result. | Self-criticizes but still overweights uPA. | Strongly agree: tempting story, weak direct CD8 evidence, negative Ly49E KO tumor evidence. | reviewer-added / conflict resolution | E2/E0 | pending |
| Ly49E KO null in intestinal tumor models should downweight uPA-Ly49E | Yes; explicit counter-evidence. | Not clearly incorporated into mechanism weighting. | Treat as important counter-signal, while noting different model/cell context. | single-source: Claude | E1 in IEL/CRC context, E2 counterweight | pending |
| CM4 antibody cross-reactivity is top-level methodology risk | Claude mentions in H1/Tier 1. | Gemini mentions generic Ly49 clone cross-reactivity but not as top risk. | Elevate to top-level: CM4 is Ly49E/F; CM4-only sorting definitionally includes Ly49F+ cells and cannot support Ly49E/Klra5-specific claims until orthogonal separation is shown. | reviewer-added | E1 vendor specificity; experiment-specific risk | pending |
| Protein validation must precede mechanism claims | Yes. | Yes. | Agree; RNA-level Klra5 and CM4-only flow are insufficient. | dual-consensus | E0 methodological rule | pending |
| Tumor-specificity definition is prerequisite | Yes. | Yes, via TCR lineage/dextramer emphasis. | Agree; tetramer/dextramer, OT-I/OVA, activation marker, and scTCR inference have different evidentiary weights. | dual-consensus | E0 methodological rule | pending |
| Adoptive-transfer phenotype proves active suppression | No; warns alternatives. | Often frames active uPA-driven suppression, but caveats artifact/sink. | Do not infer active suppression until matched Klra5+ vs Klra5- transfer and in vitro assays. | conflict | E0 until direct assays | pending |
| Matched Klra5+ vs Klra5- tumor-antigen-specific transfer is mandatory | Yes. | Yes, though less central than uPA KO. | Tier 1; must equalize dose, viability, activation state, tumor stage, and engraftment/persistence. | dual-consensus | E0 experimental requirement | pending |
| In vitro suppression/sink assay is mandatory | Yes; contact vs soluble, perforin, cytokine blockers. | Yes, with less conservative framing. | Tier 1; decisive for active regulatory function vs passive/exhausted sink. | dual-consensus | E0 experimental requirement | pending |
| Qa-1/H2-T23 testing belongs Tier 1 | Claude places some Qa-1 tests in Tier 2 but acknowledges H1. | Gemini treats Qa-1 mostly as contrast, not central. | Move to Tier 1 if Ly49F co-expression or CM4 ambiguity remains; otherwise Tier 1b/early Tier 2. | reviewer-added / conflict resolution | E1 background, E0 prioritization | pending |
| Anti-PD-1 reduction means these cells cause resistance | No; multiple models. | No; favors indirect/terminal state dynamics but allows causal component. | Reduction is not causality; design depletion/replenishment +/- anti-PD-1. | dual-consensus | E0 causal inference | pending |
| Anti-PD-1 may reduce Klra5+ via effector-mediated clearance | Claude explicitly includes model E. | Not clearly included. | Keep as a real alternative: reinvigorated effectors may clear Klra5+ cells. | single-source: Claude + reviewer-added | E0 | pending |
| Lgals3/Galectin-3 as rapid H2 vs H3 triage marker | Claude does not emphasize. | Gemini emphasizes Lgals3 in exhausted/tumor clusters and Galectin-3 cross-regulation. | Add to Tier 1 phenotyping, but label as triage marker, not mechanism until validated. | single-source: Gemini + reviewer-added | E3/E0; needs dataset verification | pending |
| Klra5+ lineage relationship to Tpex/Tex must be tested | Mentioned generally via scTCR/bioinformatics. | More explicit Tpex downstream hypothesis. | Make explicit: is Klra5+ a Tpex-derived branch, a terminal Tex endpoint, or separate clone pool? | reviewer-added | E0/E3 | pending |
| H6 senescent CD8 hypothesis | Claude includes H6 as Ly49E-uPA, not senescence. | Gemini proposes senescent/NK-like/exhausted direction. | Keep as single-source hypothesis; not central until markers support it. | single-source: Gemini | E0/E3 | pending |
| GPT cloud missing | Not applicable. | Not applicable. | Proceed now with Claude+Gemini synthesis; add GPT delta later. | reviewer-added | Process decision | pending |

## Synthesis Rules Derived From The Matrix

1. Use observation-first naming. Avoid `CD8 Treg`, `exhausted`, `suppressive`, or `uPA-driven` as labels until specific assays prove them.
2. Put CM4/Ly49E/F ambiguity and tumor-specificity definition before all mechanism discussion; treat CM4-only data as Ly49E/F+ until resolved.
3. Treat uPA-Ly49E as a mechanistic branch to test, not the organizing story.
4. Move Qa-1/H2-T23 forward if protein data show Ly49F or unresolved Ly49E/F ambiguity.
5. Preserve model disagreement. Claude's conservatism and Gemini's strong uPA narrative define the crucial experiments.
6. Add GPT later as a delta column/section rather than restarting the synthesis.

## Sources Spot-Checked In This Pass

- Li et al. `KIR+CD8+ T cells suppress pathogenic T cells and are active in autoimmune diseases and COVID-19`, *Science* 2022. PMID 35258337. https://pmc.ncbi.nlm.nih.gov/articles/PMC8995031/
- Naranbhai/Chiou et al. `Circulating tumor-reactive KIR+CD8+ T cells suppress anti-tumor immunity in patients with melanoma`, *Nature Immunology* 2025. PMID 39609626. https://pubmed.ncbi.nlm.nih.gov/39609626/
- Van Den Broeck et al. `Ly49E-dependent inhibition of natural killer cells by urokinase plasminogen activator`, *Blood* 2008. PMID 18784372. https://pubmed.ncbi.nlm.nih.gov/18784372/
- Van Acker et al. `The role of Ly49E receptor expression on murine intraepithelial lymphocytes in intestinal cancer development and progression`, *Cancer Immunology, Immunotherapy* 2016. PMID 27585789. https://pubmed.ncbi.nlm.nih.gov/27585789/
- Kim et al. `Inhibition of follicular T-helper cells by CD8+ regulatory T cells is essential for self tolerance`, *Nature* 2010. PMID 20844537. https://pmc.ncbi.nlm.nih.gov/articles/PMC3395240/
- Kim et al. `CD8+ T regulatory cells express the Ly49 Class I MHC receptor and are defective in autoimmune prone B6-Yaa mice`, *PNAS* 2011. PMID 21233417. https://doi.org/10.1073/pnas.1018974108
- Lu et al. `A narrow T cell receptor repertoire instructs thymic differentiation of MHC class Ib-restricted CD8+ regulatory T cells`, *JCI* 2024. PMID 37934601. https://pmc.ncbi.nlm.nih.gov/articles/PMC10760956/
- Saligrama et al. `Opposing T cell responses in experimental autoimmune encephalomyelitis`, *Nature* 2019. PMID 31391585. https://www.nature.com/articles/s41586-019-1467-x
- Miller et al. `Subsets of exhausted CD8+ T cells differentially mediate tumor control and respond to checkpoint blockade`, *Nature Immunology* 2019. PMID 30778252. https://pubmed.ncbi.nlm.nih.gov/30778252/
- Thermo Fisher CM4 product page: `Ly-49E/F Monoclonal Antibody (CM4)`. https://www.thermofisher.com/antibody/product/Ly-49E-F-Antibody-clone-CM4-Monoclonal/17-5848-80
