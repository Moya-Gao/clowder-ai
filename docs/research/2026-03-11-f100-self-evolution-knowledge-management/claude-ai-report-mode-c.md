# How AI agent knowledge is born, matures, and becomes capability

**The lifecycle of knowledge in AI agent systems — from raw experience to reusable capability — is now an active research frontier with concrete, implementable patterns.** Cat Café's Mode C three-question test (reusability + non-obviousness + decay-resistance) is well-grounded by academic standards, mapping closely to both patent law's utility/novelty/non-obviousness trinity and the Generative Agents' memory scoring system. However, it lacks two critical dimensions: an **impact/importance threshold** and a **verification gate**. Across 50+ papers surveyed (2023–2026), the most actionable systems — ExpeL, AutoRefine, Voyager, and MemGPT/Letta — converge on a common pattern: separate experience gathering from insight extraction, distinguish procedural from declarative knowledge, and implement tiered promotion with decay detection. The frontier question of whether agents can develop genuine "intuition" has a nuanced answer: functional analogues are achievable through knowledge compilation (à la SOAR chunking) and reflection hierarchies, but true recognition-primed decision-making remains beyond current capabilities.

---

## Q1: When experience becomes worth distilling

The question "is this experience worth keeping?" has no single academic framework but several converging approaches from distinct fields that validate and extend Cat Café's three-question test.

**ExpeL (Experiential Learning Agent, AAAI 2024)** provides the closest academic analog to Mode C's distillation pipeline. It uses a three-stage process: experience gathering through trial-and-error, insight extraction from success/failure pairs using UPVOTE/DOWNVOTE operations, and recall at inference time. The worthiness signal is implicit — insights that recur across tasks get upvoted (mapping to **reusability**), and insights derived from failure patterns capture non-obvious knowledge. GitHub: https://github.com/LeapLabTHU/ExpeL

**Generative Agents (Stanford, Park et al., 2023)** scores every memory on three factors: **recency** (exponential decay at 0.995/hour), **importance** (LLM-scored 1–10 on "poignancy"), and **relevance** (embedding cosine similarity). This scoring system maps surprisingly well onto Cat Café's test: recency ↔ decay-resistance, importance ↔ non-obviousness, relevance ↔ reusability. The critical architectural difference is that Generative Agents filter at *read time* (store everything, retrieve smartly), while Cat Café filters at *write time* (store selectively). Write-time filtering prevents knowledge bloat — a meaningful advantage for context-constrained systems.

**Voyager (Wang et al., 2023)** uses a simpler binary gate: skills enter the library only after passing **self-verification** — the generated code must execute without errors, receive positive environment feedback, and pass peer-review from another LLM. Voyager stores *all* verified skills without scoring non-obviousness or decay-resistance, relying on retrieval ranking to surface relevant skills later. GitHub: https://github.com/MineDojo/Voyager

The parallel to **patent law (35 U.S.C.)** is striking. Patent law requires utility (specific, credible usefulness → Cat Café's **reusability**), novelty (not previously known → Cat Café's **non-obviousness**), and non-obviousness (not obvious to a person of ordinary skill in the art). Cat Café adds **decay-resistance** with no direct patent analog — a pragmatic addition for dynamic environments. The ≥2/3 threshold is sensible: highly reusable + non-obvious knowledge passes even if it may decay (appropriate for fast-changing tech domains), while decay-resistant + reusable but somewhat obvious knowledge also passes (appropriate for stable reference knowledge).

**Two gaps in the three-question test need addressing.** First, it lacks an **importance/impact dimension**. Knowledge can be reusable, non-obvious, and decay-resistant while being trivially unimportant. Generative Agents' 1–10 poignancy score addresses this. Second, there is no **verification gate** — Voyager's requirement that skills must actually work before storage prevents accumulation of plausible-sounding but incorrect knowledge.

On **distillation timing**, systems diverge. Reflexion generates reflections immediately after failure; ExpeL batches experience first then extracts insights in a separate phase; Generative Agents trigger reflection when cumulative importance scores exceed **150 points**. ExpeL's delayed batch approach is most relevant to Cat Café — separating experience gathering from insight extraction enables cross-task pattern recognition that immediate reflection misses. From reinforcement learning, **Prioritized Experience Replay (Schaul et al., ICLR 2016)** prioritizes experiences with high TD-error (surprise value), which maps directly to non-obviousness. **Hindsight Experience Replay** offers a key insight: even failed experiences can be valuable if reframed — the agent retroactively substitutes goals to transform failures into learning opportunities.

On **over-distillation risks**, the emerging concept of "memory pollution" describes agents storing too many low-value memories, degrading retrieval precision. **A-MEM (NeurIPS 2025)**, based on the Zettelkasten method, combats this through dynamic linking — poorly-connected memories that don't meaningfully link to other knowledge become effectively isolated and unretrievable. **Mem0** implements a Conflict Detector and LLM-powered Update Resolver for memory consolidation, while **MemoryBank (Zhong et al., 2024)** applies an Ebbinghaus forgetting curve to deprioritize unreinforced memories. GitHub for A-MEM: https://github.com/WujiangXu/A-mem

**Mode C improvement recommendation:** Add a fourth question — "Is this knowledge impactful?" (importance ≥5 on a 1–10 scale) — and require ≥3/4. Add a deferred verification step: knowledge enters at "draft" status and promotes to "verified" only after successful application. Adopt ExpeL's batch extraction approach for cross-task insight discovery.

---

## Q2: Turning one-time analysis into reusable methodology across domains

The fundamental distinction is between **procedural knowledge** ("how to read medical test reports" — transferable methodology) and **declarative knowledge** ("normal WBC range is 4,500–11,000/μL" — domain facts). This distinction, well-established in cognitive science, is now being operationalized in concrete AI agent systems.

**AutoRefine (Qiu et al., January 2026)** is the single most relevant system for Cat Café. It automatically extracts dual-form "Experience Patterns" from agent execution histories: **subagents** for procedural subtasks with independent reasoning, and **skill patterns** as guidelines or code snippets for static knowledge. On TravelPlanner, automatic extraction *exceeded* manually designed systems (**27.1% vs 12.1%**), with 20–73% step reductions across benchmarks. The system includes continuous maintenance — scoring, pruning, and merging patterns to prevent repository degradation.

**MACLA (2025)** demonstrates efficient knowledge compression: from **2,851 trajectories, only 187 unique reusable procedures** were extracted (15:1 compression ratio), achieving a **78% reuse rate**. This quantifies what "methodology distillation" looks like at scale. **ProcMEM (Xu et al., 2025)** explicitly stores *procedures* (step-by-step workflows) rather than facts, demonstrating that agents with procedural memory significantly outperform those with only declarative memory on repeated tasks.

For **what distilled methodology should look like**, the research converges on a trigger-steps-validation pattern:

- **Trigger conditions**: "When user asks about interpreting lab results"
- **Framework steps**: Ordered procedure with tool calls at appropriate points
- **Validation criteria**: "Expert human review of first 5 applications"
- **Abstraction level**: Tagged as domain-specific or domain-transferable
- **Source interaction**: Linked back to the originating conversation

**Anthropic's Agent Skills specification (October 2025)** formalizes this as a portable, open format: each skill is a filesystem directory with a SKILL.md file containing YAML frontmatter and Markdown body. Progressive disclosure loads metadata at startup but full instructions only when triggered — a practical pattern for managing context costs.

On **human-AI knowledge co-creation**, Nonaka's SECI model has been extended for AI in three independent 2025 papers. The **HAC-SECI model (Matsumoto et al., Springer 2025)** proposes a dual-loop structure: an Inner Loop where humans provide knowledge to AI (Agent Growth Loop) and an Outer Loop where AI-accumulated knowledge helps humans recognize their own expertise (Target Development Loop). The **GRAI framework (Böhm & Durst, 2025)** splits each SECI quadrant into human and machine perspectives, creating eight knowledge conversion pathways including "machine-to-machine socialization" and "human-to-machine externalization." Zhang et al. (Journal of Knowledge Management, 2025) reconstruct the entire SECI model for human-intelligence symbiosis.

A cautionary finding: an empirical study of SECI + ChatGPT integration showed the SECI model's predictive power *decreased* from 63.4% to 41.3% with ChatGPT involvement. Naive AI integration into knowledge creation cycles can hinder internalization. The implication for Cat Café: **preserve collaboration context (the reasoning traces, decision points, human corrections), not just conclusions** — this is what distinguishes productive human-AI knowledge co-creation from mere output generation.

**Mode C improvement recommendation:** Implement a tri-layer architecture: (1) Methodology Templates (procedural knowledge in SKILL.md format), (2) Domain Knowledge Base (declarative facts with freshness timestamps, updated independently), (3) Collaboration Context (reasoning traces, human corrections, confidence assessments). Apply AutoRefine's continuous maintenance for automatic scoring, pruning, and merging of methodology templates.

---

## Q3: Knowledge does have clear maturity stages — here is the ladder

No single paper proposes a "knowledge maturity model for AI agent systems" as of March 2026 — this represents an original contribution opportunity for Cat Café. However, synthesizing DIKW (Ackoff, 1989), CMMI (CMU SEI), Dreyfus's skill acquisition model (1980), SOAR's chunking mechanism, MemGPT's memory tiers, and Generative Agents' reflection trees yields a coherent five-level maturity ladder.

**Level 0 — Observation (Raw Memory):** One-time insight recorded by a single agent. Analogous to SOAR working memory, DIKW "Data." Stored with timestamp, source agent, and context. Promotes when referenced ≥3 times within a decay window or manually flagged as important.

**Level 1 — Pattern (Draft Methodology):** Observation recognized as recurring; initial generalization attempted. Analogous to Dreyfus "Advanced Beginner," SOAR substate processing. Promotes when successfully applied ≥5 times with >80% success rate, validated by human review, or used by ≥2 different agents.

**Level 2 — Skill (Verified Practice):** Validated, tested procedure that reliably produces desired outcomes. Analogous to Voyager's verified skill library, Dreyfus "Competent," DIKW "Knowledge." Promotes when used by ≥3 agents across ≥2 contexts with >90% success rate and no conflicts for >30 days.

**Level 3 — Standard (Team Practice/Doc):** Formalized knowledge endorsed as team-wide best practice. Analogous to CMMI Level 3 "Defined," Dreyfus "Proficient," Argyris's double-loop learning output.

**Level 4 — Wisdom (Meta-Knowledge):** Abstract principles about *when and why* to apply knowledge. Analogous to DIKW "Wisdom," Dreyfus "Expert" intuition, Generative Agents' high-level reflections.

**Promotion triggers** draw from spaced repetition research, which shows that knowledge referenced at *spaced intervals* (not clustered) consolidates most durably. Pan & Rickard's 2018 meta-analysis found spaced retrieval improves outcomes ~25% over single-review strategies. SOAR's chunking mechanism provides the computational analog: when deliberate substate processing successfully resolves an impasse, the processing is automatically compiled into a fast production rule — converting System 2 deliberation into System 1 reactivity.

**Knowledge decay** varies dramatically by domain. Engineering knowledge half-life has compressed from ~35 years (1930) to **2–5 years** today. Technology/digital skills decay in **2–3 years** (World Economic Forum). Foundational algorithmic principles may last decades. For detection, concept drift methods from ML monitoring are directly applicable: track knowledge "success rate" over time windows, and declining rates signal staleness. The **Driftage framework** implements multi-agent concept drift detection using the MAPE-K pattern (Monitor-Analyze-Plan-Execute-Knowledge).

For **knowledge conflict resolution**, AGM belief revision theory (Alchourrón, Gärdenfors, Makinson, 1985) provides the formal foundation. Three operations: **expansion** (add without conflict), **revision** (add while maintaining consistency — retract less-entrenched beliefs first), and **contraction** (remove a belief). The principle of **epistemic entrenchment** orders beliefs by confidence; less-entrenched beliefs yield first. Practically for Cat Café: low-confidence conflicts auto-update (AGM revision), equal-confidence conflicts coexist with context labels (following Assumption-based TMS), and high-confidence conflicts flag for human review with full provenance chains.

**Mode C improvement recommendation:** Implement the five-level maturity ladder with explicit promotion criteria at each level. Attach domain-specific half-life estimates to all knowledge (tech: 6 months for Level 0–1; principles: 5+ years). Track success rates over sliding windows for automated staleness detection. Implement AGM-style conflict resolution with entrenchment ordering.

---

## Q4: Measuring whether knowledge actually helps — and when to retire it

The evaluation challenge is real: no standard benchmark exists specifically for measuring knowledge utilization in agents. However, converging evidence from Reflexion, Voyager ablations, and RAG evaluation frameworks provides a workable measurement architecture.

**Reflexion demonstrates the clearest before/after signal**: self-reflection improved task success by **22% absolute on AlfWorld**, 20% on HotPotQA reasoning, and 11% on HumanEval coding. The ablation is clean — CoT+Reflexion adds 8% absolute over CoT+episodic memory alone. **Voyager's ablation** is equally clear: removing the skill library caused significant performance drops, and even giving Voyager's skill library to AutoGPT improved its performance. These ablation studies provide the template for Cat Café's evaluation.

For **knowledge ROI**, the costs are non-trivial. RAG systems add **2,000–10,000 tokens per query** for retrieved context. At production scale, a proof-of-concept costing $50 has been documented scaling to **$2.5M/month** — a 717× increase. Prompt caching can save 90% of costs for repeated static context. The **CLEAR framework (2025)** proposes **Cost-Normalized Accuracy (CNA)** as the key metric: performance gain per token spent. This directly addresses Mode C's concern about context occupation costs.

A critical finding from long-tail knowledge research: **LLMs already know common knowledge; RAG's value is specifically for long-tail knowledge** (Li et al., ACL 2024). The GECE (Generative Expected Calibration Error) metric measures how "long-tail" a piece of knowledge is — knowledge that fills genuine gaps in the LLM's parametric knowledge is most valuable, while knowledge duplicating what the model already knows has near-zero or negative ROI (it wastes context tokens).

For **A/B testing**, the recommended approach adapts counterfactual evaluation methods:

- **Baseline**: Run agent on test suite WITHOUT knowledge → record success rate, quality, tokens consumed
- **Treatment**: Same agent WITH knowledge injected → record same metrics
- **Leave-one-out ablation**: For each knowledge entry, remove it and measure performance drop
- **Shapley value attribution**: From multi-agent RL (Wu et al., KDD 2021), compute marginal contribution of individual knowledge entries — adaptable from attributing value to individual agents to attributing value to individual knowledge pieces

For **long-term vs short-term value**, the power-law distribution applies: the vast majority of knowledge articles are rarely used but collectively critical. Knowledge retirement should use exponential decay with a **criticality floor** — value decays over time but never drops below a minimum set by the criticality rating. Low-frequency but high-criticality knowledge ("insurance knowledge") should undergo periodic stress tests with edge-case scenarios rather than passive decay.

**Mode C improvement recommendation:** Implement a three-layer evaluation: (1) Entry-level metrics (retrieval hit rate, contextual relevance via RAGAS, GECE long-tailness score), (2) Task-level impact (A/B success rate delta, CNA efficiency delta, LLM-as-judge quality delta), (3) System-level value (portfolio ROI, learning curve slope over time). Tag every knowledge entry with both usage frequency AND criticality rating. Knowledge with negative ROI (hurting performance) should be immediately retired.

---

## Q5: The gap between methodology and intuition is narrowing but still significant

The frontier question — whether AI agents can transcend step-by-step checklists to develop "domain intuition" — has become a legitimate research area in 2025–2026, with concrete findings from cognitive architecture research, metacognition studies, and multi-agent emergence.

**SOAR's chunking mechanism provides the most precise theoretical model.** When an agent encounters an impasse (knowledge insufficient for current task), it creates a substate for deliberative processing. When the substate produces a result, SOAR's chunking mechanism automatically compiles the processing into a fast production rule. Next time a similar situation occurs, the chunk fires directly — **converting System 2 deliberation into System 1 reactivity**. A 2025 paper, "Applying Cognitive Design Patterns to General LLM Agents," explicitly connects this to LLM agents, identifying Voyager's skill library as a form of knowledge compilation and calling this mechanism "underexplored" in agentic LLMs.

**DeepMind's Talker-Reasoner framework (2024)** implements a structural analog of Kahneman's dual-process theory: a fast "Talker" (System 1) handles routine interactions while a deliberate "Reasoner" (System 2) performs deep reasoning and updates beliefs. The architecture routes simple tasks to fast pattern-matching and complex tasks to deliberate chains. For Cat Café, this suggests tracking which queries *graduate* from System 2 to System 1 over time — this graduation *is* the formation of intuition.

On **metacognition**, a landmark Anthropic study (Lindsey, October 2025) demonstrated that frontier models possess **"some functional awareness of their own internal states."** Claude models could notice injected concepts in their activations, recall prior internal representations, and distinguish their own outputs from artificial prefills. However, this capacity is "highly unreliable and context-dependent." The ICML 2025 position paper "Truly Self-Improving Agents Require Intrinsic Metacognitive Learning" argues that current agents lack genuine metacognition — an agent's weights and system prompt are static, and true self-improvement requires the ability to modify one's own learning strategy based on self-assessment.

For **tacit knowledge capture**, the most promising direction applies the HAC-SECI dual loop: the agent observes human decision patterns during interaction (Socialization), prompts humans to articulate implicit reasoning — "Why did you pursue that line of questioning?" (Externalization), cross-references distilled knowledge pieces to find patterns (Combination), and integrates compiled knowledge into default behavior (Internalization). The AI-Tacit Knowledge Co-Evolution Model (MDPI, 2025) positions AI as an "epistemic partner augmenting human interpretive processes rather than merely codifying."

**Knowledge emergence** from combining distilled pieces is partially demonstrated. AgentVerse (Tsinghua/Tencent) showed multi-agent systems developing emergent behaviors including role specialization and knowledge sharing that "parallels human sociological processes." A June 2025 paper on emergent intelligence in collaborative agentic AI confirmed that multi-agent systems can demonstrate "emergent intelligence that exceeds the capabilities of individual component agents." However, analogical reasoning — the core of creative knowledge transfer — remains weak in LLMs. LLMs excel at surface pattern matching but struggle with deep structural transfer to novel domains. Even OpenAI's o3 on the ARC-AGI benchmark, while achieving **76–88% accuracy** (a genuine breakthrough), required **$200–$20,000 per task** in processing costs.

The **Kahneman-Klein synthesis (2009)** provides the key design principle: skilled intuition can be trusted when (1) the environment is sufficiently regular to be predictable, and (2) the individual has had extensive practice with feedback. Cat Café should focus on creating both conditions: structured, feedback-rich interaction environments where compiled knowledge gets validated and refined.

**Mode C improvement recommendation:** Implement Generative Agents-style reflection trees that build abstraction hierarchies from raw observations. Add a dual-process routing layer: routine queries use compiled skill patterns (System 1), novel queries trigger full reasoning chains (System 2), and track graduation between levels. Build a metacognitive monitoring layer that tracks per-domain confidence scores ("In medical interpretation my accuracy is ~85%; in legal reasoning ~60%"). Use explicit externalization prompts to capture human collaborators' tacit reasoning. For knowledge emergence, periodically trigger cross-domain analogical search when encountering novel situations.

---

## Consolidated Mode C design recommendations

Based on the full research synthesis, here are the highest-impact improvements for Cat Café's Mode C, ordered by implementation priority:

1. **Expand the three-question test to four questions plus a verification gate.** Add "Is this impactful?" (importance ≥5/10). Require ≥3/4. All new knowledge enters at "draft" status; promotes to "verified" only after successful real-world application (à la Voyager's self-verification). This addresses the two gaps identified when comparing to academic standards.

2. **Implement the five-level maturity ladder** (Observation → Pattern → Skill → Standard → Wisdom) with explicit, quantitative promotion criteria at each level. This gives Mode C a structured lifecycle rather than a binary distill/don't-distill decision. Attach domain-specific half-life estimates for automated staleness detection.

3. **Separate procedural from declarative knowledge storage.** Methodology templates (how to analyze) should be versioned independently from domain facts (what values are normal). Use the trigger-steps-validation format from AutoRefine/ProcMEM. Consider adopting Anthropic's SKILL.md format as the container.

4. **Add ExpeL-style batch insight extraction** alongside immediate post-task reflection. Periodically (daily or weekly) run cross-task analysis to discover patterns invisible from single-task reflection. This captures the 15:1 compression ratio MACLA demonstrated.

5. **Implement GECE-style knowledge value assessment.** Before storing knowledge, check whether it fills a genuine gap in the LLM's parametric knowledge. Knowledge duplicating what the model already knows has near-zero ROI and wastes context tokens.

6. **Build A/B evaluation into the knowledge lifecycle.** Track success rate, quality score, and token efficiency WITH versus WITHOUT each knowledge entry. Compute CNA (Cost-Normalized Accuracy). Auto-retire knowledge with negative ROI; protect low-frequency/high-criticality "insurance knowledge" with a criticality floor.

7. **Implement HAC-SECI dual-loop for human-AI co-creation.** Preserve not just conclusions but reasoning traces, decision points, and human corrections. Use explicit externalization prompts ("Why did you pursue that approach?") to capture tacit knowledge from human collaborators.

8. **Add a dual-process routing layer** (medium-term). Route routine queries to compiled skill patterns (fast System 1), novel/high-stakes queries to full reasoning chains (System 2). Track which queries graduate from System 2 to System 1 over time — this graduation metric directly measures whether Mode C is producing intuition-like capability.

## Key open-source repositories

| System | Repository | Relevance |
|--------|-----------|-----------|
| Voyager | https://github.com/MineDojo/Voyager | Skill library architecture, self-verification gate |
| ExpeL | https://github.com/LeapLabTHU/ExpeL | Experience → insight extraction pipeline |
| Reflexion | https://github.com/noahshinn/reflexion | Verbal reinforcement learning, reflection mechanism |
| LATS | https://github.com/lapisrocks/LanguageAgentTreeSearch | Knowledge extraction from search trees |
| Letta (MemGPT) | https://github.com/letta-ai/letta | Tiered memory system, self-managing memory |
| A-MEM | https://github.com/WujiangXu/A-mem | Zettelkasten-based agentic memory with dynamic linking |
| Generative Agents | https://github.com/joonspk-research/generative_agents | Memory importance scoring, reflection trees |
| SOAR | https://github.com/SoarGroup/Soar | Chunking/knowledge compilation mechanism |
| Evidently AI | https://github.com/evidentlyai/evidently | Concept drift detection for knowledge staleness |
| Agent Benchmark Compendium | https://github.com/philschmid/ai-agent-benchmark-compendium | 50+ agent benchmarks cataloged |
| Agent Memory Paper List | https://github.com/Shichun-Liu/Agent-Memory-Paper-List | Comprehensive taxonomy (Tsinghua, Dec 2025) |
| Self-Reflection | https://github.com/matthewrenze/self-reflection | Empirical study of reflection types |
| UniCoTT | https://github.com/mengchuang123/UniCoTT | Structural chain-of-thought distillation |

## Conclusion

Cat Café's Mode C is architecturally sound and ahead of most production systems in explicitly gating knowledge quality at write time. The three-question test maps well to established academic frameworks (patent law, Generative Agents scoring, ExpeL's implicit criteria). The most important upgrades are adding an importance dimension and verification gate to the quality test, implementing a maturity ladder that gives knowledge a lifecycle rather than a binary state, and separating methodology from domain facts to enable independent evolution of each. The research confirms that the path from "remembering steps" to "forming intuition" runs through knowledge compilation (SOAR chunking applied to LLM agents), reflection hierarchies (Generative Agents), and metacognitive monitoring — all implementable with current technology, though genuine domain intuition comparable to human expert cognition remains a frontier challenge. The key design principle from the Kahneman-Klein synthesis applies directly: invest in creating regular, feedback-rich environments where Cat Café agents can accumulate validated experience — because that regularity plus practice is what transforms methodology into intuition.