---
doc_kind: research-response
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, source-ledger, training-methods]
related_features: [F221, F231]
provider: claude-deep-research
status: round1-raw-response
participants: [landy, opus-48]
---

# ROUND 1 — Source Ledger & Method-Genealogy Skeleton (as of 2026-06-14)

**All six candidate families resolve to real, empirically-verified latest public versions, but primary-source completeness varies sharply — and that variance, not performance, is the finding that should drive layer-allocation prep.** GLM-5, DeepSeek-V4, Kimi K2.5, and OLMo 3 carry full T0/T1 training reports; MiniMax M3 has only an architecture/inference paper; Qwen3.7-Max has only an official blog (T2). The disclosure-completeness wildcard locks to **OLMo 3 (AI2)**.

## TL;DR
- **Existence is confirmed for every candidate**, but only **four** families publish a complete latest-version training report (GLM-5, DeepSeek-V4, Kimi K2.5, OLMo 3). MiniMax M3's "technical report" is narrowly an MSA-attention paper; Qwen3.7-Max has **no** technical report at all (proprietary, API-only, blog only).
- **The fully-open wildcard is OLMo 3 / OLMo 3.1 (AI2)** — the only candidate releasing data + code + methods + intermediate checkpoints + training logs (full "model flow"), making it uniquely valuable for learning "how it's done."
- **Temporal/object hygiene is decisive:** "Qwen 3.7-Max," "GLM-5.1," and "Kimi K2.6" all genuinely exist, but the two point-releases ship weights **without** a dedicated report (their method anchors fall back onto GLM-5 / Kimi K2.5), and Qwen3.7-Max ships **without weights or a report**. None of these three may have methods back-filled from older objects.

## Key Findings
Five of the eight ledger objects pass the HARD GATE to enter Round 2 (verified existence + ≥1 T0/T1 evidence anchor): **GLM-5, DeepSeek-V4-Pro/Flash, Kimi K2.5, OLMo 3/3.1, and MiniMax M3 (architecture + inference scope only)**. Qwen3.7-Max and the two latest point-releases (GLM-5.1, Kimi K2.6) are **QUESTIONABLE** for method deep-dive and are flagged to-be-supplemented. No locked candidate is EXCLUDED on existence grounds — notably, the "DeepSeek V4 / Engram" speculation circulating in March 2026 was **refuted** by the actual 24 Apr 2026 release, whose shipped architecture diverged from the rumored design (a textbook Round-1 disconfirmation).

## 6a. Source Ledger

| Family | Exact object/version | (1) Existence | (2) Primary tier | Source link + date | Evidence anchor (≤30-word excerpt) | Claim type | (3) Method keywords (evidence-supported only) | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|
| GLM | GLM-5 (744B total / 40B active MoE) | empirically-verified | T1 | arXiv:2602.15763 "GLM-5: from Vibe Coding to Agentic Engineering", 17 Feb 2026; HF `zai-org/GLM-5` (MIT) | §2.1: "we scale the model parameters up to 744B and extend the training token budget to 28.5T tokens"; §2.1.1: "We use DSA in our training" | existence/method/data/post-train | DSA continued pre-training, MLA + Muon Split, MTP w/ parameter sharing, 28.5T tokens, INT4 QAT, SFT interleaved/preserved thinking, Reasoning/Agentic/General RL (GRPO+IcePop), on-policy cross-stage distillation, slime async RL | high | Released 11 Feb 2026; trained on Huawei Ascend (MindSpore). **ENTER R2** |
| GLM | GLM-5.1 (754B MoE) | empirically-verified | T0 (model card) | HF `zai-org/GLM-5.1`; API 27 Mar 2026 / open weights ~7 Apr 2026 | Card cites arXiv:2602.15763 (the GLM-5 paper); **no dedicated 5.1 report** | existence/post-train | "state-of-the-art on SWE-Bench Pro"; longer-horizon agentic stability | med | NO dedicated 5.1 technical report; methods would inherit GLM-5 → temporal-hygiene flag. **QUESTIONABLE** |
| DeepSeek | DeepSeek-V4-Pro (1.6T/49B) & V4-Flash (284B/13B) | empirically-verified | T0 | `DeepSeek_V4.pdf` "DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence", on HF `deepseek-ai/DeepSeek-V4-Pro`; transparency model card publ. 27 Apr 2026; release 24 Apr 2026 (MIT) | Model card: "Hybrid Attention Architecture: combines Compressed Sparse Attention (CSA) and Heavily Compressed Attention (HCA)… CSA… applies DeepSeek Sparse Attention (DSA)" | existence/method/data/post-train | Hybrid Attention (CSA+HCA), DSA, mHC, Muon optimizer, DeepSeekMoE + MTP, on-policy distillation (10 teachers→1, reverse-KL), three reasoning modes | high | "Preview" release of two open-weight models. Pre-trained on **33T (Pro) / 32T (Flash) tokens** — more than 2× V3's 14.8T (per technical report). **ENTER R2** |
| Kimi | Kimi K2.6 (1T total / 32B active MoE) | empirically-verified | T0 (model card) | HF `moonshotai/Kimi-K2.6`, 20 Apr 2026 (Modified MIT); card cites arXiv:2602.02276 (the K2.5 paper) | Card: "Kimi-K2.6 has the same architecture as Kimi-K2.5, and the deployment method can be directly reused"; **no dedicated K2.6 report** | existence/post-train | INT4 native quant, long-horizon coding post-train, Agent Swarm (300 sub-agents / 4,000 steps) | med | NO dedicated K2.6 report; method anchors land on K2.5 → temporal-hygiene flag. **QUESTIONABLE** |
| Kimi | Kimi K2.5 (1T total / 32B active MoE) | empirically-verified | T1 | arXiv:2602.02276 "Kimi K2.5: Visual Agentic Intelligence", submitted 2 Feb 2026; HF `moonshotai/Kimi-K2.5` | Abstract: "joint text-vision pre-training, zero-vision SFT, and joint text-vision reinforcement learning"; introduces "Agent Swarm" | existence/method/data/post-train | Continual pretrain on ~15T mixed vision-text tokens (3 stages) atop Kimi-K2-Base, MoonViT-3D encoder, zero-vision SFT, joint text-vision RL, Agent Swarm | high | Latest *full-report* Kimi object. **ENTER R2** |
| MiniMax | MiniMax-M3 (428B total / 23B active MoE) | empirically-verified | T1 (architecture/inference only) | arXiv:2606.13392 "MiniMax Sparse Attention", submitted 11 Jun 2026 (MiniMax; corr. Pengyu Zhao); HF `MiniMaxAI/MiniMax-M3` (license: minimax-community); blog minimax.io/blog/minimax-m3, 1 Jun 2026 | Paper: "MiniMax Sparse Attention (MSA), a blockwise sparse attention built upon Grouped Query Attention (GQA)"; "exp-free Top-k selection and KV-outer sparse attention" | existence/method (architecture + inference) | MSA blockwise sparse attention on GQA, Top-k KV-block selection, exp-free inference kernel, 428B/23B active MoE, native multimodal | high (arch); n/a (post-train) | Weights + report both materialized by 14 Jun (promised "within 10 days" of 1 Jun launch). The "technical report" is an **MSA architecture paper, NOT a full model report** — pre-train corpus / SFT / RL pipeline: **no public primary source found**. **ENTER R2 for architecture/inference ONLY** |
| Qwen | Qwen3.7-Max (proprietary MoE, ~1T class) | empirically-verified | T2 (official blog) | Official blog "Qwen3.7: The Agent Frontier", qwen.ai/blog?id=qwen3.7; launched 19–20 May 2026 (Alibaba Cloud Model Studio) | Blog: "Building on the environment scaling approach introduced in Qwen3.5, we have continued to aggressively expand… agentic training environments" | existence/post-train (lead only) | "environment scaling" for agentic training (lead only); architecture "not fully disclosed" | med (existence); low (method) | Proprietary, **API-only, no weights, no technical report/arXiv**. Architecture undisclosed. **QUESTIONABLE — does NOT enter R2 for method** |
| Wildcard | OLMo 3 / OLMo 3.1 Think 32B (7B & 32B, fully open) | empirically-verified | T1 | arXiv:2512.13961 "Olmo 3", Team Olmo, submitted 15 Dec 2025 (v2 14 Apr 2026); allenai.org/blog/olmo3 | Abstract: "This release includes the entire model flow… every stage, checkpoint, data point, and dependency used to build it" | existence/method/data/post-train | Dolma 3 (~9.3T corpus); Dolma 3 Mix = 5.9T-token pretrain; Dolmino midtraining; Longmino long-context; Dolci post-train suite (Instruct/Think/RL-Zero); OlmoTrace provenance; full data + code + checkpoints + logs | high | **Disclosure-completeness winner; fully-open** (pretrained on up to 1,024 H100 GPUs per AI2). **ENTER R2** |

**Ledger rules applied:** Existence and primary-source tier are scored independently — e.g., Qwen3.7-Max genuinely exists yet has only T2 sourcing, which is recorded honestly as a *legitimate* "opaque family" result, not a failure. Every method/data/post-train keyword above lands on a T0/T1 first-party anchor (technical report, official model card, or author-bylined arXiv paper); third-party blogs were used only as discovery leads and never as anchors.

## 6b. Method-Genealogy Skeleton (primary-source-supported only)

```
pre-train:
- DeepSeek Sparse Attention (DSA)           → GLM-5 (arXiv 2602.15763 §2.1.1); DeepSeek-V4 (DeepSeek_V4.pdf / model card)
- Hybrid Attention CSA+HCA                    → DeepSeek-V4 (model card) [27% single-token inference FLOPs, 10% KV cache vs V3.2 at 1M ctx]
- Manifold-Constrained Hyper-Connections(mHC) → DeepSeek-V4 (model card)
- Muon optimizer / "Muon Split"               → GLM-5 (§2.1); DeepSeek-V4 (model card); MuonClip → Kimi K2 (arXiv 2507.20534)
- Multi-latent Attention (MLA)                → GLM-5 (§2.1)
- Multi-token Prediction (MTP)                → GLM-5 (§2.1); DeepSeek-V4 (model card)
- MiniMax Sparse Attention (MSA, blockwise/GQA) → MiniMax M3 (arXiv 2606.13392)
- Joint text-vision pretraining + MoonViT-3D  → Kimi K2.5 (arXiv 2602.02276)
- Dolma 3 corpus / Dolmino midtrain / Longmino long-ctx → OLMo 3 (arXiv 2512.13961)
- Token budgets (primary-source): 28.5T (GLM-5); 33T Pro / 32T Flash (DeepSeek-V4); ~15T mixed, 3 stages (Kimi K2.5);
                                  5.9T pretrain mix (OLMo 3); 15.5T (Kimi K2)
- INT4 quantization-aware training in SFT      → GLM-5 (§2.4.3)

post-train:
- SFT w/ interleaved & preserved thinking      → GLM-5 (§3.1)
- Reasoning RL / Agentic RL / General RL (GRPO + IcePop) → GLM-5 (§3.2–3.4)
- On-policy cross-stage distillation           → GLM-5 (§3.5);
  On-policy distillation, 10 domain teachers → 1 (reverse-KL) → DeepSeek-V4 (technical report)
- RLVR + self-critique rubric reward           → Kimi K2 (arXiv 2507.20534)
- Zero-vision SFT + joint text-vision RL + Agent Swarm → Kimi K2.5 (arXiv 2602.02276)
- Dolci suite: Instruct / Think / RL-Zero (RLVR) → OLMo 3 (arXiv 2512.13961)
- slime asynchronous RL infrastructure          → GLM-5 (§3.6)
- "environment scaling" for agentic training    → Qwen3.7-Max (OFFICIAL BLOG / T2 ONLY — lead, does NOT enter conclusions)

inference:
- DSA dynamic sparse attention (long context)   → GLM-5; DeepSeek-V4
- Speculative decoding via MTP draft (EAGLE)     → GLM-5; DeepSeek-V4
- exp-free Top-k selection + KV-outer sparse attention kernel → MiniMax M3 (arXiv 2606.13392)
- Three reasoning modes (Non-think / Think High / Think Max)  → DeepSeek-V4 (model card)
- Turn-level thinking control                    → GLM-5 (§3.1)
- W4A8 mixed-precision quant for Chinese chips    → GLM-5 (§5)
- OlmoTrace provenance (infini-gram over Dolma 3) → OLMo 3
```
*(Methods absent from every primary source are deliberately omitted rather than invented; a blank is preferred to a fabrication.)*

## Decision Interface (per-version classification)
- **ENTER Round 2** (exists + T0/T1 + evidence anchor): GLM-5; DeepSeek-V4-Pro/Flash; Kimi K2.5; OLMo 3 / OLMo 3.1; **MiniMax M3 (architecture + inference scope ONLY)**.
- **QUESTIONABLE** (exists, but no qualifying method anchor on the latest object — to-be-supplemented, does NOT enter R2 for method): GLM-5.1 (no dedicated report; inherits GLM-5); Kimi K2.6 (no dedicated report; inherits K2.5); MiniMax M3 **post-training/data pipeline** (only the MSA architecture paper exists); Qwen3.7-Max (T2 official blog only; no report, no weights).
- **EXCLUDE** (existence unverified / pure rumor): none among the locked candidates. The pre-release "DeepSeek V4 Engram/Conditional-Memory" architecture was a rumor and is refuted by the shipped 24 Apr 2026 release.

## Recommendations
**Stage 1 — proceed now.** Open Round 2 mechanism deep-dives on the five ENTER objects, each pinned to its cited T0/T1 anchor. Prioritize OLMo 3 first for "how it's done" learning value, because it is the only object where data + code + checkpoints + logs let you trace a method end-to-end (use OlmoTrace as the worked example).

**Stage 2 — scope-limit MiniMax M3.** Confine its Round 2 to the MSA architecture and inference kernel (arXiv:2606.13392). Treat its pre-training corpus, SFT, and RL as "no public primary source found" — do not let Round 2 infer them.

**Stage 3 — do not deep-dive Qwen3.7-Max for method.** The only T0/T1 source anywhere in the Qwen family is the older Qwen3 report (arXiv:2505.09388, May 2025); do **not** extrapolate it onto 3.7-Max. If Qwen agentic-training mechanisms are essential, treat the gap as open and revisit only if Alibaba ships a 3.7 open-weight tier or report.

**Thresholds that change these calls:** (a) publication of a *dedicated* GLM-5.1 or Kimi K2.6 technical report would upgrade those from QUESTIONABLE to ENTER; (b) a full MiniMax M3 *model* report (beyond MSA) would expand its R2 scope to pre/post-training; (c) any Qwen3.7 arXiv report or open-weight release would lift it from T2 to T1/T0. Re-poll the official HF orgs (`zai-org`, `moonshotai`, `MiniMaxAI`, `QwenLM`) and arXiv listings before Round 2 kickoff.

## Caveats
- **Temporal & object applicability:** GLM-5.1, Kimi K2.6, and Qwen3.7-Max all post-date their family's last full report. Method claims for them must not be back-filled from older objects; this is the single highest-risk error for Round 2 and is gated out above.
- **"Released weights" ≠ "disclosed methods":** GLM-5.1 and Kimi K2.6 are weight-open but recipe-light; MiniMax M3 is weight-open with only attention-level method disclosure. This distinction is exactly why OLMo 3 is the disclosure wildcard despite being smaller (7B/32B) than the frontier MoE candidates.
- **Vendor-reported numbers excluded:** Benchmark/performance/"35-hour autonomous run"-type claims circulating for these models are vendor-reported and out of Round-1 scope; they were not used as anchors.
- **One enrichment cross-check:** the DeepSeek-V4 "33T/32T tokens" figure comes from the technical-report PDF as relayed; the first-party transparency model card I fetched directly confirms the architecture and "Public + Licensed data" pre-training description but states token counts only in the full report PDF. The architecture, license (MIT), parameter counts, and reasoning-mode anchors are confirmed first-party.
- **arXiv identifiers** for 2026 papers (26xx.xxxxx) follow the year-2026 numbering scheme and were each confirmed against first-party repos/HF model cards rather than third-party paraphrase.