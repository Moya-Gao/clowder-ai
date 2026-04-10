---
title: Hierarchical Context Transport for Multi-Agent Threads
type: dual-cloud-consult
date: 2026-03-31
authors: [opus, gpt52]
status: pending
---

# Hierarchical Context Transport — GPT Pro Consultation

## Part 1: Prompt for GPT Pro

> Copy everything below this line and send to GPT Pro.

---

Hi, we're building **Cat Cafe** — a multi-AI-agent collaboration system where 3-4 AI agents (Claude Opus, GPT-5.4, Gemini) share persistent conversation threads via a central message bus. Agents are @-mentioned into threads on demand — they don't all observe every message in real time.

### Background: The Problem

When an agent is @-mentioned into a thread it hasn't been following, we need to deliver enough context for it to contribute meaningfully. Our current implementation (`assembleIncrementalContext`) uses a **flat incremental delivery** approach:

```
cursor (last-seen position, per-cat, Redis CAS)
  → fetch all unseen messages since cursor
  → filter (skip system-only, apply visibility rules)
  → cap at maxMessages (200)
  → truncate each message body to maxContentLengthPerMsg (10,000 chars)
  → trim from oldest until aggregate fits maxContextTokens
```

**Real budget numbers** (from production config):

| Agent | maxMessages | maxContentLengthPerMsg | maxContextTokens | maxPromptTokens |
|-------|-------------|----------------------|------------------|-----------------|
| Claude Opus | 200 | 10,000 chars | 160,000 tokens | 180,000 tokens |
| GPT-5.4 | 200 | 10,000 chars | 216,000 tokens | 240,000 tokens |
| Gemini | 300 | 15,000 chars | 300,000 tokens | 350,000 tokens |

**The pain**: When a cat is cold-mentioned into a busy thread (e.g., 150+ messages of design discussion), the flat delivery sends up to 200 × 10K chars of raw messages. This consumes 160K–216K tokens of context budget *before the agent even starts thinking*. The signal-to-noise ratio is terrible — most of those messages are intermediate back-and-forth, not key decisions.

### Hard Constraint: No Cheap-Model Summarization

We empirically tested using a cheap model (Claude Haiku) to summarize context before delivering to the main model (Opus). **Result: Haiku's summaries actively misled Opus**, causing worse outcomes and higher total cost (Opus spent more tokens recovering from bad summaries than it would have processing raw messages). Sonnet was indirectly helpful at best. Only same-tier summarization produced accurate results — but that defeats the cost savings.

Claude Code (Anthropic's own CLI) also uses the **main model** for its `autoCompact`, not a cheaper one. This validates our finding.

**Therefore**: Any solution must avoid real-time LLM summarization in the hot path. Pre-computed summaries from the same model tier are acceptable if amortized.

### Existing Infrastructure We Can Reuse

1. **DeliveryCursorStore** — Per-agent exact cursor tracking with Redis CAS (compare-and-swap). Monotonic advancement, no duplicate delivery. ✅ Production-proven.

2. **SessionBootstrap + threadMemory** — A seal-driven rolling memory primitive: when a session ends, `buildThreadMemory.ts` appends a digest-based summary line. **Current reality**: sparse coverage (~4% of threads have non-empty summaries), only fires on session seal (not real-time), and NOT connected to the @-mention hot path. Pattern-based extraction (not LLM), so ~zero marginal cost per invocation — but needs significant work to become a hot-path-ready L1. We consider it a **candidate primitive, not production infrastructure**.

3. **AutoSummarizer** — Pattern-based (non-LLM) summarizer that creates `ThreadSummary` objects every 30 minutes. Currently used for Knowledge Feed, NOT injected into context delivery.

4. **evidence.sqlite** — Full-text search (FTS5) + vector semantic rerank over all project documents (feature specs, ADRs, lessons learned, past session digests). Agents can already call `search_evidence()` to self-serve. 500ms timeout for best-effort recall.

5. **get_thread_context MCP tool** — Agents can explicitly request deeper thread history on demand.

### Proposed Direction: 5-Layer Hierarchical Transport

Instead of flat delivery, we're considering a layered approach:

| Layer | Content | Source | Cost |
|-------|---------|--------|------|
| L0: Identity | Who am I, who's talking, what thread, invocation context | A2A metadata | ~0 tokens extra |
| L1: Thread Memory | Rolling summary of thread state (key decisions, open questions, participants) | Candidate: `buildThreadMemory.ts` (pattern-based, not LLM) — seal-driven, sparse today (~4% coverage), needs upgrade to hot-path | ~2K-5K tokens |
| L2: Recent Raw | Last N unseen messages (verbatim) | Current cursor system, but N=3-8 instead of N=200 | ~3K-15K tokens |
| L3: Evidence Recall | Best-effort retrieval of related docs/decisions/lessons | `evidence.sqlite` FTS5+vector, 500ms timeout | ~2K-8K tokens |
| L4: Self-Service | Agent explicitly requests more via `get_thread_context` / `search_evidence` | MCP tools (already available) | On-demand |

**Total L0-L3**: ~7K-28K tokens (vs current 160K-216K). The agent starts thinking with a high-SNR context packet and can self-serve if it needs more.

### Research Questions

**Please help us evaluate this direction with these specific questions:**

1. **Published approaches**: Are there published papers, blog posts, or production system descriptions of hierarchical/tiered context delivery for multi-agent systems? Specifically approaches that avoid real-time LLM summarization. We're interested in both academic work and engineering blog posts from companies running multi-agent systems at scale.

2. **Optimal recency window (L2)**: What's the right number of recent raw messages to include? Our intuition says 3-8, but is there research or practical experience on the recency-vs-relevance tradeoff? Does it depend on message density (e.g., rapid-fire debugging vs. weekly design review)?

3. **Production multi-agent context handoff**: How do production multi-agent frameworks (AutoGen, CrewAI, LangGraph, OpenAI Swarm, Google A2A, etc.) handle context when handing off between agents? Do any of them implement layered/hierarchical context rather than "dump everything"?

4. **Zero-cost context importance scoring**: Are there effective techniques for scoring message importance without calling an LLM? We're thinking: structural signals (message length, @-mentions, reactions/votes, message type like "decision" vs "chatter"), positional signals (first/last in a burst, after long silence), semantic signals (keyword/regex matching for decisions, action items). What works in practice?

5. **Failure modes of lazy-loading context (L4)**: If the agent starts with minimal context (L0-L3) and self-serves the rest, what are the known failure modes? E.g., the agent doesn't know what it doesn't know, so it doesn't request the right context. Are there strategies to mitigate this (like the system proactively hinting "you may want to check X")?

### Additional Request

- If our 5-layer design has blind spots, please point them out.
- If there are better layer decompositions from the literature or practice, suggest alternatives.
- If you know of specific systems (open-source or described in papers) that solved this problem well, please name them with enough detail for us to investigate further.

Ideal output characteristics:
- Concrete examples from real systems (not hypothetical)
- Distinguish "confirmed in production" from "proposed in paper"
- Actionable for a team that already has the infrastructure listed above

---

## Part 2a: GPT Pro Response (Pending)

> 铲屎官粘贴 GPT Pro 的回答到这里

Yes. I would move Cat Cafe away from flat incremental delivery.

Your 5-layer packet has good bones. It matches the direction serious agent systems are drifting toward: keep a small working set in prompt, move durable state outside the prompt, and let agents pull more only when needed. Anthropic’s context-engineering guidance explicitly pushes compaction, structured notes outside the context window, and isolated subagent contexts; LangChain frames the design space as write, select, compress, and isolate; MemGPT and Letta formalize the same idea as a memory hierarchy; Google ADK separates scratch state from full event history. ([Anthropic][1])

The two changes I would make immediately are:

1. Add an explicit **coverage map** so the receiving agent knows what was omitted.
2. Split L1 into a **structured state ledger** plus an optional prose digest.

That turns the packet from “here is some context” into “here is the current state, here is the freshest raw burst, here is what you are *not* seeing.” That difference matters a lot for lazy-loading.

## 1) Published approaches close to your design

### Official product / framework docs and engineering write-ups

* **Anthropic / Claude Code / Agent SDK**: Anthropic describes compaction, tool-result clearing, and structured note-taking outside the context window. In Claude Code, compressed context is paired with the **five most recently accessed files**. Their Agent SDK also emphasizes subagents with **isolated context windows** that send back only relevant information, not full local history. This is very close to your “small working set + durable memory + isolated worker” idea, although Claude Code’s compaction path is model-based rather than non-LLM. ([Anthropic][1])

* **OpenAI Agents SDK / Swarm**: The current Agents SDK is **history-first** by default. A handoff receives the **entire conversation history** unless you apply an `inputFilter`, and the Python SDK ships a helper that collapses prior transcript into a single summary message. The older Swarm repo is explicit that it is an educational, mostly client-side system that stores no state between calls and relies on caller-supplied `messages`. Good primitives, but not layered by default. ([OpenAI GitHub][2])

* **AutoGen**: AutoGen Swarm says all agents share the **same message context**, and the receiving agent takes over with that same context. To bound context, AutoGen exposes **MRU**, **token-limited**, and **head-and-tail** context objects. That is useful evidence that bounded raw windows and anchor-plus-tail patterns are mainstream, but the framework default is still closer to “shared transcript” than to your hierarchical handoff packet. ([GitHub Microsoft][3])

* **Google ADK + A2A**: Google’s ADK is the closest major framework to your state-first thinking. `session.state` is documented as a scratchpad while `session.events` holds the full history; agents can opt out of prior contents with `include_contents='none'`; ADK supports sliding-window context compaction; and the A2A protocol lets clients request only the last `N` messages via `historyLength` while also returning task status and artifacts. That is not your exact L0-L4 stack, but it is a strong precedent for separating state from transcript and retrieving only recent history on demand. ([Google GitHub][4])

* **CrewAI**: CrewAI’s memory docs say that when memory is enabled, the crew **extracts discrete facts after each task**, stores them, and **injects recalled context before each task**. Recall ranking uses a composite of semantic similarity, recency decay, and importance, and shallow recall can skip LLM analysis for short queries. But its default overflow handling is still automatic summarization when `respect_context_window=True`. So it is partially aligned with your design, but not fully. ([CrewAI Documentation][5])

* **Zep / Graphiti**: This is one of the best public matches for your “no cheap hot-path summarizer” requirement. Zep’s docs say it **precomputes facts, entity summaries, and other artifacts asynchronously**, and its AutoGen integration injects the **last 2 episodes plus relevant facts and entities** as a system message. Their LangGraph integration also persists knowledge asynchronously for future queries. This is very close to your L1/L3 idea. ([GitHub Microsoft][6])

* **Letta**: Letta, built on MemGPT, documents a **memory hierarchy** split between in-context and out-of-context memory, **shared memory blocks** attachable to multiple agents, and **sleep-time agents** for asynchronous memory refinement. This is not a public write-up about thread handoff specifically, but it is highly relevant to your amortized-precompute direction. ([Letta Docs][7])

* **LangChain / LangGraph**: LangChain’s own context-engineering write-up organizes current practice into **write / select / compress / isolate**, and its Open Deep Research system uses a compressed research brief, isolated subagents, and pruned findings returned to the supervisor. LangMem also exposes both hot-path memory tools and a background memory manager that extracts and consolidates memory asynchronously. This is more “toolkit plus example system” than a prescribed handoff policy, but it supports your overall direction. ([LangChain Blog][8])

### Papers / research proposals

* **MemGPT** introduces “virtual context management” inspired by hierarchical memory in operating systems. ([arXiv][9])
* **Zep paper** proposes a temporally aware knowledge graph memory layer; the authors report better DMR and LongMemEval results than baselines, but those are paper claims, not independent production audits. ([arXiv][10])
* **Self-RAG** argues against indiscriminately retrieving a fixed amount of context and instead retrieves passages **on demand**. ([arXiv][11])
* **Adaptive-RAG** argues that one-size-fits-all retrieval is suboptimal and that retrieval strategy should vary with query complexity. ([ACL Anthology][12])
* **Lost in the Middle** shows that relevant information buried in the middle of long contexts is used worse than information near the beginning or end. ([ACL Anthology][13])
* **Retrieval meets Long Context LLMs** finds that simple retrieval with shorter context can match or beat some longer-context baselines, and retrieval still helps even when context windows are extended. ([OpenReview][14])

So the answer to Q1 is **yes**: there is solid precedent for hierarchical or tiered context delivery. What is still rare is an off-the-shelf framework that automatically does your exact cold-mention thread handoff policy without custom engineering. ([OpenAI GitHub][2])

## 2) What should L2 be?

I did **not** find a paper or framework doc that says “3 to 8 raw messages is the optimal universal window.” What I *did* find points strongly against giant flat tails: relevant facts get lost when buried in long contexts, retrieval plus shorter context can outperform large raw windows, Anthropic’s own example pairs compressed memory with only a tiny recent working set, and major frameworks expose bounded MRU/head-tail or recent-history-length controls rather than a single canonical huge tail. ([ACL Anthology][13])

My recommendation is:

* **Do not make L2 a fixed message count first. Make it a recent burst first.**
* Default to **1 recent interaction burst**, usually **4 to 6 messages**.
* Expand to **6 to 10** for dense debugging or tool-heavy loops where local state mutates quickly.
* In slower design threads, use **3 to 5 recent messages plus 1 to 3 older landmarks**, not 8 bland recent turns.
* Only go beyond roughly **10 to 12** when trimming would break a semantic chain such as:

  * question → answer
  * proposal → accept/reject
  * tool call → result → interpretation
  * patch → review → fix

The better unit is usually **segment**, not **message**. Segment by silence gap, reply graph, file/topic shift, or explicit decision markers. Adaptive retrieval work backs the broader idea that fixed maximal policies are usually inferior to dynamic ones. ([ACL Anthology][12])

One more important twist: I would not make L2 “tail only.” I would make it **tail + landmarks**. AutoGen’s head-and-tail context object is a public sign that this pattern is useful. ([GitHub Microsoft][15])

## 3) How production frameworks handle handoff today

The short version is: **most do not do your hierarchical packet by default**.

OpenAI Agents SDK is transcript-first. Handoffs keep full history unless you filter it. Swarm is also history-first and stateless between calls. ([OpenAI GitHub][2])

AutoGen Swarm is also transcript-first. All participants share the same context, though AutoGen gives you bounded context objects if you choose to use them. ([GitHub Microsoft][3])

Google ADK is more state-first. It separates mutable state from full history, can suppress prior contents entirely, and A2A supports fetching only recent history plus task artifacts. ([Google GitHub][4])

CrewAI is memory-oriented but still defaults to summarization when context overflows. ([CrewAI Documentation][16])

LangGraph is more of a kit than a policy. LangChain’s own guidance and examples clearly move toward layered context engineering, but you still assemble the policy yourself. ([LangChain Blog][8])

So your design is not behind the curve. In a funny way, it is ahead of many defaults.

## 4) Zero-cost importance scoring that is actually worth trying

This is probably the most promising part of your plan.

Older email and meeting literature found that **dialogue-act cues, structural features, speaker features, quotation/reply structure, and lexical recurrence** are strong signals for important sentences, action items, and decision points. In one meeting action-item study, structural features were especially strong; email thread work found that parent/child “clue words” and dialogue-act modeling improved summary selection. CrewAI’s current memory stack also uses a weighted mix of recency, semantic relevance, and importance. ([cs.ubc.ca][17])

For Cat Cafe, I would start with a cheap composite score like this:

```text
score(message) =
  0.30 * bm25_to_current_ask
+ 0.20 * decision_action_signal
+ 0.15 * direct_address_signal
+ 0.15 * thread_graph_salience
+ 0.10 * boundary_signal
+ 0.05 * novelty
+ 0.05 * reactions_votes
```

Where:

* `bm25_to_current_ask` uses FTS/BM25 against the @mention text, the last user request, thread title, and maybe the last 1 to 2 non-system messages.
* `decision_action_signal` is regex/lexicon-based: `decide`, `ship`, `blocker`, `owner`, `deadline`, `revert`, `ADR-`, `PR #`, commit SHAs, filenames, issue IDs, dates, constraints.
* `direct_address_signal` fires on `@cat`, explicit questions, imperatives, or “can you check/review/decide”.
* `thread_graph_salience` uses reply depth, child count, quoted overlap, closes-open-question, proposal-accepted, or first interpretation after tool output.
* `boundary_signal` catches first/last in burst, after long silence, before/after handoff, and after topic shift.
* `novelty` downweights near-duplicates using token overlap, MinHash, or SimHash.
* `reactions_votes` uses approvals, votes, or “+1 / ack / merged”.

Two practical tips:

First, keep **older landmarks** with this score, not just recent raw. Second, train the weights offline on your own traces. A tiny logistic regression or GBDT over these features will probably beat hand-tuned heuristics surprisingly fast.

## 5) Failure modes of lazy-loading context, and how to blunt them

The biggest failure mode is exactly the one you named: **the agent does not know what it does not know**. That is not just folklore. Recent RAG work found that stronger proprietary models answer well when context is sufficient, but often produce **incorrect answers instead of abstaining** when context is insufficient. ([arXiv][18])

A second failure mode is **bad retrieval policy**. Self-RAG and Adaptive-RAG both argue that blindly retrieving a fixed amount every time, or never retrieving unless explicitly asked, is suboptimal. Retrieval needs to be conditional and query-aware. ([arXiv][11])

A third failure mode is **local-burst myopia**. If the most recent 6 messages are chatter and the real constraint was decided 40 turns ago, the model can confidently reason from a warped local picture. “Lost in the Middle” is a warning flare here. ([ACL Anthology][13])

What I would do about it:

* Add **L0.5 coverage metadata**. Tell the agent what ranges were omitted, how fresh L1 is, how many older messages exist, and whether older landmarks were included.
* Add **retrieval hints**, not just tools. Example: “Older decision likely relevant: auth migration ADR-42, retry policy discussion, last owner assignment.”
* Add **1 to 3 older landmarks automatically** when the packet is built.
* Add an explicit **answer gate** in the system prompt: if the answer depends on older rationale, superseded decisions, or missing constraints, fetch before concluding.
* Make every L1/L3 item carry **provenance**: source IDs, timestamps, freshness, and supersedes/superseded-by where possible.
* Seed L4 retrieval from structured terms in the packet, not only from the model’s free-form search query.

Here is the kind of coverage object I would actually deliver:

```json
{
  "coverage": {
    "raw_unseen_range": [4821, 4977],
    "raw_included_range": [4970, 4977],
    "omitted_unseen_count": 149,
    "thread_memory_freshness_s": 240,
    "older_landmarks_included": 3,
    "likely_missing_topics": ["auth migration", "ADR-42 retry policy"],
    "retrieval_hints": [
      "get_thread_context(tag='decision', before=4970)",
      "search_evidence('ADR-42 retry policy auth migration')"
    ]
  }
}
```

That tiny object solves a lot of “unknown unknowns.”

## Blind spots in the current 5-layer plan

I see six main blind spots.

First, **no coverage map**. Without it, the receiving agent cannot reason about omission.

Second, **L1 is too prose-shaped**. You want a structured ledger for decisions, constraints, owners, open questions, and rejected alternatives. Prose digest is still useful, but it should not be the only memory object.

Third, **L2 as last-N raw can still miss the one crucial message from 40 turns ago**. This is why I would add landmarks.

Fourth, **L3 looks doc-centric**. Thread-internal decisions need to be indexed into `evidence.sqlite` too, not only ADRs and project docs.

Fifth, you need an explicit **conflict rule**. If L1 says X and recent raw says Y, recent raw should usually win, and the packet should say so.

Sixth, you need **negative memory**. “Rejected alternatives” and “we already tried this and it failed because…” are often more important than the accepted path, especially for cold-mentioned agents.

## A better layer split

If I were renaming the packet, I would make it:

* **L0**: identity, invocation goal, participants, visibility
* **L0.5**: coverage map
* **L1**: structured state ledger
* **L1b**: short narrative digest
* **L2**: recent raw burst
* **L2.5**: older landmarks
* **L3**: external evidence and prior digests
* **L4**: self-service tools

If you want to keep five layers on paper, fold L0.5 into L0 and L2.5 into L3. The important thing is not the numbering. It is the separation of **state**, **recent verbatim flow**, **older anchors**, and **external evidence**.

## What I would ship first for Cat Cafe

1. Keep `DeliveryCursorStore` exactly as your truth for delta accounting.
2. Build a cheap **thread state ledger** updated continuously with rules, not prose summarization first.
3. Change L2 from `last N unseen` to **latest relevant burst + closure chain**.
4. Add **older landmark selection** using non-LLM scoring.
5. Index thread digests, ledger entries, and landmark messages into `evidence.sqlite` alongside project docs.
6. Add a **coverage map** and explicit retrieval hints to every cold-start packet.
7. Evaluate on replay with these metrics: first-response usefulness, extra-context fetch rate, missed-decision rate, false-confidence rate, token spend, and latency.

Net: I think your direction is right, and the highest-leverage refinement is **hierarchical packet + coverage map + landmarks**, not “summary versus raw” as a binary choice. That turns the handoff from a transcript dump into a compact state transfer.

[1]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
[2]: https://openai.github.io/openai-agents-js/guides/handoffs/ "https://openai.github.io/openai-agents-js/guides/handoffs/"
[3]: https://microsoft.github.io/autogen/0.4.7//user-guide/agentchat-user-guide/swarm.html "https://microsoft.github.io/autogen/0.4.7//user-guide/agentchat-user-guide/swarm.html"
[4]: https://google.github.io/adk-docs/sessions/state/ "https://google.github.io/adk-docs/sessions/state/"
[5]: https://docs.crewai.com/en/concepts/memory "https://docs.crewai.com/en/concepts/memory"
[6]: https://microsoft.github.io/autogen/0.2/docs/ecosystem/agent-memory-with-zep/ "https://microsoft.github.io/autogen/0.2/docs/ecosystem/agent-memory-with-zep/"
[7]: https://docs.letta.com/api/python/ "https://docs.letta.com/api/python/"
[8]: https://blog.langchain.com/context-engineering-for-agents/ "https://blog.langchain.com/context-engineering-for-agents/"
[9]: https://arxiv.org/abs/2310.08560 "https://arxiv.org/abs/2310.08560"
[10]: https://arxiv.org/abs/2501.13956 "https://arxiv.org/abs/2501.13956"
[11]: https://arxiv.org/abs/2310.11511 "https://arxiv.org/abs/2310.11511"
[12]: https://aclanthology.org/2024.naacl-long.389.pdf "https://aclanthology.org/2024.naacl-long.389.pdf"
[13]: https://aclanthology.org/2024.tacl-1.9/ "https://aclanthology.org/2024.tacl-1.9/"
[14]: https://openreview.net/forum?id=xw5nxFWMlo "https://openreview.net/forum?id=xw5nxFWMlo"
[15]: https://microsoft.github.io/autogen/stable//reference/python/autogen_core.model_context.html "https://microsoft.github.io/autogen/stable//reference/python/autogen_core.model_context.html"
[16]: https://docs.crewai.com/en/concepts/agents "https://docs.crewai.com/en/concepts/agents"
[17]: https://www.cs.ubc.ca/~gabrielm/actions.pdf "https://www.cs.ubc.ca/~gabrielm/actions.pdf"
[18]: https://arxiv.org/abs/2411.06037 "https://arxiv.org/abs/2411.06037"


【round1 gpt如下】

Your 5-layer direction is strong. The flat handoff is a token bonfire; the pattern that keeps showing up in both official framework docs and recent memory papers is: keep a compact working set, preserve a little local continuity, and fetch deeper history just in time. Anthropic’s context-engineering guidance explicitly treats context as finite, recommends the minimal sufficient information up front, and pushes tools for runtime retrieval; research lines like MemGPT, DyCP, and LightMem all move toward tiered memory, dynamic pruning, or offline consolidation instead of giant verbatim dumps. ([Anthropic][1])

The especially important thing I found is this: mainstream multi-agent frameworks still mostly do **not** ship your desired cold-mention policy out of the box. OpenAI Agents passes full history by default unless you filter it; AutoGen’s handoff patterns often carry chat history directly; LangChain explicitly says context engineering is the center of multi-agent design; CrewAI and Google ADK/A2A give you scoped memory/state/context primitives, not a standard layered handoff packet. So Cat Cafe is solving a real systems gap, not rebuilding a solved feature. ([OpenAI GitHub][2])

## 1) Published approaches closest to what you want

### Confirmed in production or official framework behavior

* **Anthropic Research**: Anthropic’s production writeup describes an orchestrator-worker system where the lead agent saves its plan to memory because context past 200,000 tokens can be truncated. Their broader guidance is also very aligned with your design: keep context tight, avoid false assumptions of shared context, and load more information via tools at runtime. ([Anthropic][3])

* **OpenAI Agents SDK / old Swarm**: In the production SDK, a handoff gives the next agent the conversation history by default, but OpenAI exposes `inputFilter`, `handoff_input_filter`, and an opt-in `nest_handoff_history` mode that collapses prior transcript to one assistant message. The older `openai/swarm` README is explicit that Swarm is stateless between calls, saves no state, and keeps the chat history unless the caller manages it. ([OpenAI GitHub][4])

* **AutoGen**: AutoGen Swarm says agents share the same message context. Its Core handoff example passes a `UserTask` containing the chat history, while the lower-level agent API separately notes that agents are stateful and should receive only new messages if you manage their state yourself. In other words, AutoGen gives you the escape hatch, but not the layered transport policy. ([GitHub Microsoft][5])

* **LangChain / Deep Agents**: LangChain’s docs put “context engineering” at the center, and its subagent/deep-agent patterns are really about context isolation, compression, and long-term memory. Subagents are stateless, the main agent keeps memory, and deep agents compress/offload heavy work. Again: strong primitives, no built-in cold-mention packet. ([LangChain 文档][6])

* **CrewAI / Google ADK / A2A**: CrewAI supports shared memory or scoped private views. Google ADK distinguishes `session.events` as full history from `session.state` as the scratchpad, and A2A defines `contextId` for continuity across tasks/messages. The official A2A JS SDK examples also carry task `history` and artifacts. These are useful building blocks for layered transport, but they still leave the actual packet design to you. ([docs.crewai.com][7])

### Papers and systems that support the design, with nuance

* **Direct fits for your “no cheap summarizer in the hot path” constraint**:

  * **DyCP** dynamically selects coherent spans at query time, without pre-segmentation and without extra LLM calls; it also preserves contiguous spans instead of isolated turn retrieval. ([arXiv][8])
  * **MemGPT** is the canonical “virtual context management” paper: hierarchical memory tiers plus movement between fast and slow memory. ([arXiv][9])
  * **HippoRAG** is retrieval-first rather than summary-first, using a knowledge graph plus Personalized PageRank; it reports single-step retrieval that is much cheaper and faster than iterative retrieval. ([arXiv][10])
  * **LongMemEval** is not a transport design itself, but it is highly relevant because it breaks long-term memory into indexing, retrieval, and reading, and proposes session decomposition plus time-aware query expansion. ([arXiv][11])

* **Useful, but only partial fits**:

  * **LightMem** is very relevant if you accept amortized/offline memory work: it uses a three-stage memory design and an offline “sleep-time” update that decouples consolidation from online inference. ([arXiv][12])
  * **Mem0** also separates write-time memory extraction from query-time retrieval and reports much lower latency/token cost than full-context baselines. ([arXiv][13])
  * **MemoRAG** is conceptually close because it uses a light long-range system to form global clues and a more expressive system to answer. But because it still introduces an additional model-driven layer in the reasoning path, I’d treat it as inspiration rather than a direct fit for your hard constraint. ([arXiv][14])
  * **A-MAC** is also only a partial fit because it still uses one LLM-assisted utility signal, but its factorization of memory value is extremely useful for designing your own zero-cost heuristics. ([arXiv][15])

If you want one extra open-source system to inspect, **Zep/Graphiti** is worth a read. Its docs and paper center on temporally aware context graphs that update as facts change, which is highly relevant to your versioning problem. I would just treat the benchmark numbers as vendor-reported until you reproduce them. ([GitHub][16])

## 2) L2 recency window: 3-8 is a decent floor, not a full policy

I would **not** hardcode “3-8 recent raw messages” as the universal answer. The literature says two things at once: relevant information near the end often gets used better than information buried earlier, and preserving local continuity matters. “Lost in the Middle” shows strong position sensitivity, with relevant material at the beginning or end often beating material buried in the middle. DyCP shows that full-context performance can degrade sharply on long conversations, that relevant info closer to the end benefits from recency bias, and that removing low-relevance continuity turns causes small but consistent answer-quality drops. ([arXiv][17])

My recommendation is:

* **Always include a guaranteed hot tail** of the last **4 raw unseen turns**.
* **If the @-mention lands inside an active burst**, expand to the whole burst up to roughly **8-12 turns**. This matters most for debugging, tool-heavy back-and-forth, or threads where the last few messages depend tightly on adjacency.
* **Also include 2-6 earlier anchors** from the unseen span, chosen by importance score, with **one neighbor on each side** so the anchor does not lose its local meaning.
* Cap L2 by **message count and tokens**, not just count. In your setup I would start around **8-16 messages** or roughly **8k-12k tokens** for L2.

That gives you a small raw tail for immediate grounding, plus a few semantically important “spikes” from farther back. It is much safer than plain “last N,” because the last N can easily be acknowledgments, jokes, or tool noise after the real decision already happened. The research support here is basically: local continuity matters, but blindly prepending everything is worse than selective contiguous spans. ([arXiv][8])

A density-sensitive rule is the sweet spot. Rapid-fire debugging should bias toward a larger raw burst window; slower design review should bias toward stronger L1/L3 and a smaller raw tail. That is the recency-vs-relevance tradeoff I’d actually ship.

## 3) Zero-cost importance scoring: what I think will work best

The most useful transferable lesson from A-MAC is that **interpretable factors** matter: future utility, factual confidence, semantic novelty, temporal recency, and content type prior. Its ablation says **content type prior** was the strongest single factor. That matches my intuition for your system: classifying a message as “decision / blocker / changed requirement / owner assignment / explicit ask” is not decoration, it is the backbone. ([arXiv][15])

I’d start with a score like this:

```text
importance =
  6 * explicit_request_to_target_agent
+ 5 * decision_or_acceptance
+ 5 * supersedes_or_correction
+ 4 * blocker_or_owner_assignment
+ 3 * artifact_or_doc_or_tool_result
+ 2 * author_is_decider_or_thread_owner
+ 2 * approval_or_reaction_signal
+ 1 * burst_boundary_or_after_long_silence
+ 1 * novelty
- 3 * near_duplicate
```

Then I would add a **hard-include override** for these classes:

* explicit `@cat` mentions or direct asks
* accepted/rejected decisions
* changed constraints or corrected assumptions
* blockers and owner assignments
* any message that supersedes prior state
* tool outputs or external evidence that changed the thread’s direction

Concretely, your zero-cost features should be a blend of:

* **Structural**: message type, doc links, code diffs, tool outputs, reactions, approvals, explicit mentions.
* **Positional**: first/last in a burst, after long silence, immediately after new evidence arrives.
* **Semantic-lite**: regexes for `decision`, `final`, `approved`, `ship`, `owner`, `todo`, `blocker`, `actually`, `updated`, `supersedes`, `reverted`, `no longer`, version markers.
* **Novelty**: entity/file/ADR names not seen in the last cluster; punish near-duplicates.
* **Role**: speaker is human owner, orchestrator, domain maintainer, or previous assignee.

The crucial design choice is to keep the output **structured**, not prose-y. Pattern extraction should emit slots like `accepted_decisions[]`, `changed_constraints[]`, `blockers[]`, `open_questions[]`, each with `source_message_ids`. That avoids the same “bad summary poisons the main model” failure mode you already saw with cheap summarizers.

## 4) Failure modes of lazy loading, and how to blunt them

The big one is exactly the one you named: the agent does not know what it does not know. EverMemBench makes this concrete. It finds that memory awareness is bottlenecked by retrieval because similarity-based methods miss implicitly relevant information. It also finds temporal reasoning breaks without explicit version semantics, and multi-hop reasoning collapses under multi-party attribution even with oracle evidence. ([arXiv][18])

That leads to five predictable failure modes:

1. **Unknown unknowns**
   The agent answers from L0-L3 and never asks for missing rationale.
   **Mitigation**: include a `possible_missing_context` section with 2-4 machine-generated hints and starter queries, like “If rationale for ADR-17 matters, call `search_evidence('ADR-17 superseded')`.” This is where Anthropic’s “just in time” retrieval philosophy is helpful: do not only expose tools, also point the agent toward likely fetches. ([Anthropic][1])

2. **Temporal/version mistakes**
   The agent uses an obsolete decision because summaries and evidence lack invalidation semantics.
   **Mitigation**: every state item should carry `valid_from`, optional `valid_to`, `supersedes`, and source IDs. Timestamps alone are not enough. ([arXiv][18])

3. **Attribution mistakes in multi-party threads**
   The agent remembers *what* was said but not *who owns it* or *who approved it*.
   **Mitigation**: carry speaker role, owner, approver, and assignee metadata in L1. This matters more than most teams think. ([arXiv][18])

4. **Overconfident answers when retrieval fails**
   LongMemEval explicitly treats abstention as a core memory ability because systems often answer confidently even when the right evidence was not retrieved.
   **Mitigation**: require the agent to either cite a packet item / evidence hit or explicitly fetch more context before making strong claims about rationale, ownership, or latest state. ([arXiv][11])

5. **Tool non-use or wrong tool use**
   Anthropic warns that bloated toolsets create ambiguous decision points.
   **Mitigation**: keep `get_thread_context` and `search_evidence` semantically distinct, and surface a very short “recommended next fetches” list in the packet instead of making the agent infer everything from raw tool docs. ([Anthropic][1])

## 5) The biggest blind spot in your current 5 layers

I would split your current L1 into two layers:

* **L1a: canonical state ledger**

  * current goal
  * accepted decisions
  * changed constraints
  * blockers
  * open questions
  * owners / approvers
  * relevant artifacts / ADRs
  * each item with source IDs and versioning metadata

* **L1b: delta since this agent last saw the thread**

  * newly accepted decisions
  * decisions superseded
  * blockers opened/resolved
  * newly relevant artifacts
  * questions answered / still open

That gives you **current truth** and **what changed** as separate things. Right now your L1 “rolling thread memory” risks mixing them together. For cold handoffs, that is dangerous. Agents need a stable ledger first, then a change log, then recent raw evidence.

So my preferred layer split is:

* **L0** identity / invocation envelope
* **L1** canonical thread state ledger
* **L2** delta-since-cursor
* **L3** selective raw evidence: hot tail + anchors + neighbors
* **L4** retrieved docs / ADRs / lessons / past digests
* **L5** self-service tools

This also lets you reuse your **AutoSummarizer** more effectively. Instead of injecting one big summary blob, use its 30-minute summaries as time-sliced deltas when the cursor gap is large. That matches LongMemEval’s session decomposition idea and LightMem’s offline-consolidation idea much better than a single rolling summary. ([arXiv][11])

One more blind spot: your cursor today is purely **message-based**. I would add a lightweight **state cursor** as well. Even if the agent missed 150 noisy messages, you can still deterministically say: “since you were last here, decision D-12 changed from v2 to v4, blocker B-3 opened, ADR-19 was attached.” That is higher signal than anything a raw message cursor can provide.

## 6) What I would build first with the infrastructure you already have

I’d ship this packet shape:

```text
ContextPacket {
  identity: {agent, thread, invocation_reason, participants, last_seen_at}

  state_ledger: {
    current_goal
    accepted_decisions[]
    changed_constraints[]
    blockers[]
    open_questions[]
    owners[]
    artifacts[]
  }

  delta_since_cursor: {
    new_decisions[]
    superseded_decisions[]
    blocker_changes[]
    answered_questions[]
    new_artifacts[]
  }

  recent_raw: [
    hot_tail_turns[],
    anchor_turns_with_neighbors[]
  ]

  evidence_hits: [
    ADRs, specs, lessons, prior digests, linked docs
  ]

  possible_missing_context: [
    suggested get_thread_context / search_evidence calls
  ]
}
```

Then the rollout plan:

1. **Wire `buildThreadMemory.ts` into the @-mention hot path**, but force it into structured slots with source IDs and optional confidence, not prose paragraphs.
2. **Build `ThreadDelta` mechanically from unseen messages** using the scoring rules above. This is where your zero-cost extraction should live.
3. **Replace `last N unseen` with `hot tail + anchors + continuity neighbors`**. DyCP is the key mental model here: contiguous spans beat isolated fragments, and preserving some low-relevance continuity is worth it. ([arXiv][8])
4. **Run `evidence.sqlite` in parallel** with two query families: one derived from the state ledger and one from the latest raw anchors. If you can precompute richer retrieval features offline, Anthropic’s contextual retrieval results are a strong hint that contextual BM25/embeddings can materially improve recall. ([Anthropic][19])
5. **Make the packet retrieval-aware**, not just retrieval-capable. Give the agent 2-4 suggested fetches. This directly attacks the “doesn’t know what it doesn’t know” problem.
6. **Evaluate on the failure modes that matter**, not just final task quality: stale-fact rate, wrong-confident rate, fetch-when-needed rate, attribution correctness, temporal update correctness, abstention when evidence is missing. LongMemEval and EverMemBench are the right benchmark templates for those axes. ([arXiv][11])

## Direct answers to your research questions

* **Published approaches?** Yes. The strongest direct fits are DyCP, MemGPT, HippoRAG, and the indexing/retrieval/reading decomposition from LongMemEval. LightMem and Mem0 are strong partial fits because they shift memory work out of the hot path. MemoRAG and A-MAC are conceptually useful but not exact fits for your “no cheap model summarization in hot path” rule. ([arXiv][8])

* **Optimal L2 raw window?** Not a fixed global 3-8. Use a guaranteed base tail of ~4, expand to 8-12 for an active burst, and add 2-6 earlier anchors with neighbors. Density matters: debugging wants more adjacency; design review wants more state/evidence and less raw. ([arXiv][17])

* **How do frameworks handle handoff?** Mostly by forwarding full/shared context or by giving you hooks to filter it. I did not find a mainstream framework that already ships your exact layered cold-handoff packet as the default. ([OpenAI GitHub][2])

* **Zero-cost importance scoring?** Yes, I think it is very viable. Start with content type prior, recency, novelty, role, explicit mentions, approvals, artifact/tool-result presence, and supersession cues. A-MAC’s factorization is the best recent evidence for this style of scoring, even though I would not copy its LLM-assisted utility step into your hot path. ([arXiv][15])

* **Failure modes of lazy loading?** The core failures are unknown unknowns, stale versions, attribution loss, and confident answering after retrieval misses. The mitigations are proactive hinting, explicit version semantics, provenance-rich state ledgers, and a prompt policy that makes fetch-or-abstain normal. ([arXiv][18])

My bottom-line recommendation: **yes, move to hierarchical transport**, but make two upgrades before you ship it. First, split “current truth” from “recent change.” Second, do not make L2 a pure “last N” window; make it **recent burst + importance anchors + neighbors**. That is where the design goes from “reasonable” to “robust.”

[1]: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
[2]: https://openai.github.io/openai-agents-js/openai/agents/classes/handoff/ "https://openai.github.io/openai-agents-js/openai/agents/classes/handoff/"
[3]: https://www.anthropic.com/engineering/multi-agent-research-system "https://www.anthropic.com/engineering/multi-agent-research-system"
[4]: https://openai.github.io/openai-agents-python/agents/ "https://openai.github.io/openai-agents-python/agents/"
[5]: https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/swarm.html "https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/swarm.html"
[6]: https://docs.langchain.com/oss/python/langchain/multi-agent "https://docs.langchain.com/oss/python/langchain/multi-agent"
[7]: https://docs.crewai.com/en/concepts/memory "https://docs.crewai.com/en/concepts/memory"
[8]: https://arxiv.org/html/2601.07994v1 "https://arxiv.org/html/2601.07994v1"
[9]: https://arxiv.org/abs/2310.08560 "https://arxiv.org/abs/2310.08560"
[10]: https://arxiv.org/abs/2405.14831 "https://arxiv.org/abs/2405.14831"
[11]: https://arxiv.org/abs/2410.10813 "https://arxiv.org/abs/2410.10813"
[12]: https://arxiv.org/abs/2510.18866 "https://arxiv.org/abs/2510.18866"
[13]: https://arxiv.org/abs/2504.19413 "https://arxiv.org/abs/2504.19413"
[14]: https://arxiv.org/abs/2409.05591 "https://arxiv.org/abs/2409.05591"
[15]: https://arxiv.org/html/2603.04549v1 "https://arxiv.org/html/2603.04549v1"
[16]: https://github.com/getzep/graphiti "https://github.com/getzep/graphiti"
[17]: https://arxiv.org/abs/2307.03172 "https://arxiv.org/abs/2307.03172"
[18]: https://arxiv.org/html/2602.01313v3 "https://arxiv.org/html/2602.01313v3"
[19]: https://www.anthropic.com/news/contextual-retrieval "https://www.anthropic.com/news/contextual-retrieval"

## Part 2b: Gemini Ultra Deep Think Response (Pending)

> 铲屎官粘贴 Gemini Ultra 的回答到这里（同一份 Part 1 prompt）


Your empirical finding—that cheap-model summarization actively poisons the context for frontier models—is a hard-learned industry truth. Summarization is inherently lossy, and smaller models routinely drop nuanced technical constraints or hallucinate state (a phenomenon sometimes called "cascading hallucination"). The main model then wastes tokens chasing ghosts, erasing any cost savings. 

Your proposed **5-Layer Hierarchical Transport** is an exceptional architectural direction. It directly maps to the operating system memory tiering concepts (Registers → L1/L2 Cache → RAM → Disk) that cutting-edge multi-agent systems use to escape the "flat context trap."

Here is an evaluation of your direction, addressing your specific research questions with concrete examples from production systems and academic literature.

---

### 1. Published Approaches (Hierarchical Context without Hot-Path LLMs)

The industry is rapidly moving toward explicitly separating *storage* from *working context*, relying heavily on asynchronous processing.

*   **MemGPT / Letta (UC Berkeley):** The canonical foundation for tiered LLM memory. MemGPT maps the context window to RAM ("Main Context") and the database to Disk ("External Context"). **Crucially, MemGPT does not summarize on the fly.** It avoids hot-path latency by using what they call **"Sleep-Time Compute"**—background agents that asynchronously update the Core Memory (your L1) while the user/system is idle. The agent must use OS-like paging (tools) to fetch older memory.
*   **Generative Agents (Stanford "Smallville"):** To avoid massive context costs, this architecture uses a Retrieval function scored by a heuristic: *Recency + Importance + Relevance*. While the original paper used an LLM for Importance, almost all production forks replaced it with zero-cost static dictionaries and metadata scoring to avoid the hot-path latency you're trying to dodge.
*   **Google ADK (Agent Development Kit):** In their multi-agent architecture teardowns, Google engineers advocate against "context stuffing." They divide working context into **Stable Prefixes** (your L0/L1) and **Variable Suffixes** (your L2). They mandate that sub-agents receive isolated, scoped contexts and must explicitly reach for tools to fetch ancestral history.

### 2. Optimal Recency Window (L2)

Your intuition of **3 to 8 messages** is mathematically aligned with conversational coherence (Miller's Law applied to dialogue usually lands on 3–7 turns). However, **relying on fixed message counts is a dangerous trap in multi-agent environments.** 

*   **The Density/Token Trap:** If you hardcode `N=5`, and those messages are *"LGTM"*, *"deploying"*, *"wait"*, *"failed"*, *"fixing"*, the newly mentioned agent receives zero semantic signal. Conversely, a 5-message window containing massive code blocks will blow out your budget.
*   **The Fix: Token-Bounded, Time-Clustered Windows.** Size L2 based on a dual constraint. Example: *"Include the most recent messages up to 3,000 tokens, guaranteeing at least 3 messages."* Furthermore, don't sever temporal bursts. If the gap between message `N-4` and `N-5` is 20 seconds, include `N-5`. If the gap is 2 hours, cut it off. 
*   **The Sandwich Strategy (Primacy Anchor):** Research on the "Lost in the Middle" phenomenon shows LLMs pay attention to the very beginning and very end of a prompt. Always include **Message #1** (the thread's initiating premise) at the top of L2, followed by the omission gap, followed by the recency window.

### 3. Production Multi-Agent Context Handoff

Most off-the-shelf frameworks are surprisingly primitive in their tutorials, but their *production-grade* implementations heavily rely on explicit context engineering rather than "dump everything." The trend is moving from passing *Conversational State* (raw logs) to passing *Epistemic State* (what we know).

*   **LangGraph:** By default, their `messages` reducer is an append-only flat dump. However, production implementations explicitly mandate a `trim_messages` node, or pass complex state via an explicitly defined `Command` object, ensuring sub-agents only see the exact schema they need without the conversational thrashing.
*   **OpenAI Swarm (and derived patterns):** Stateless by design. When Agent A hands off to Agent B, it populates a `context_variables` dictionary (extracted key-value pairs). It *does not* broadcast the full chat history by default.
*   **CrewAI:** Agents do not read each other's chat histories. They operate on a Graph of Tasks. Agent B receives the explicitly formulated *TaskOutput string* of Agent A, completely obfuscating the intermediate conversational logic.

### 4. Zero-Cost Context Importance Scoring

You can extract high-value messages from the "omitted middle" without calling an LLM using deterministic, microsecond heuristics in Node/Python. Create a composite score `[0.0 - 1.0]` for unseen messages:

*   **Structural Signals (High Weight):** Markdown density. Messages containing code blocks (```` ``` ````), diffs, or bolded lists (`### Decision`) are statistically highly likely to be technical payloads. Give them a massive multiplier. Apply a bell-curve penalty to length (strip messages < 40 chars; penalize > 5,000 char log dumps).
*   **Social Signals:** Any message with an explicit `@-mention` (a delegation), or messages that received human UI reactions/votes (👍, ✅). 
*   **Temporal Burst Boundaries:** The *first* message following a silence of >30 minutes (initiating a new topic). The *last* message before a thread goes silent (usually a conclusion).
*   **Semantic Signals (Zero-Cost FTS5):** Since you already have `evidence.sqlite`, run a fast local BM25 query over the omitted messages using the text of the `@-mention` that triggered the current agent as the query string.

*How to use this:* Take the top 2-3 highest-scoring messages from the omitted gap and inject them verbatim between L1 and L2 as `[Extracted High-Signal Intermediate Messages]`.

### 5. Failure Modes of Lazy-Loading Context (L4)

The primary failure mode of self-serve context is **"The Unknown Unknowns" (The Illusion of Competence)**. If you drop an agent into a thread with only L0-L3, it doesn't know what it missed. Instead of calling `get_thread_context`, it will confidently hallucinate an answer based on its limited L2 view.

**Mitigation: The Metadata Tombstone (Information Scent)**
When you truncate the flat delivery, do not leave a silent gap. Replace the dropped messages with a highly compressed, zero-cost structural skeleton.

*Example injected system message:*
> `[System: 142 messages omitted from this thread between 10:00 AM and 2:30 PM. Active participants: @GPT-5.4, @User. 14 code blocks were shared. 3 messages received 👍 reactions. To read these messages, use get_thread_context(start_msg=20, end_msg=162).]`

If you want to go slightly further, run a zero-cost TF-IDF keyword extraction on the dropped messages:
> `[Key terms in omitted messages: Redis CAS, connection_timeout, payload_size]`

This costs ~40 tokens, requires zero LLM calls, and gives the agent the exact "Information Scent" it needs to trigger an informed L4 tool call.

---

### Critical Blind Spots in Your 5-Layer Design

Your architecture is structurally sound, but there are two vulnerabilities given your existing infrastructure constraints:

**1. The "L1 Staleness" Trap (The Unsealed Gap)**
You noted that `threadMemory` only fires on **session seal** (~4% coverage). If a thread has been intensely active for 150 messages today and Opus is suddenly cold-mentioned, the L1 summary will be completely empty or stale because the session hasn't sealed. L2 only holds 5 messages. The agent is flying blind.
* **The Fix:** Decouple L1 generation from the "seal" event. You already have an `AutoSummarizer` running every 30 minutes. Point it at active threads to write directly into L1 on a tumbling window. **Because it runs asynchronously in the background, you can use your main model (Opus/GPT-5.4) for this.** Amortize the cost in the background so the hot-path L1 read remains a zero-latency fetch.

**2. Tool Payload Blowouts in L2**
If L2 contains verbatim raw messages, and message `N-2` was a massive `search_evidence` JSON return or a giant file read executed by Gemini, your Opus token budget is instantly destroyed upon mention.
* **The Fix:** Implement strict payload truncation in L2. If a tool-call message is older than the immediate last turn, systematically replace its payload with a heuristic summary: `<tool_result truncated: successfully executed search_evidence, returned 45 rows>`.


【gemini round1】
Your empirical finding that **cheap-model summarization actively misleads the main model** is a hard-won, formally recognized truth in production LLM engineering. In the industry, this is known as **"logical context poisoning"** or **"summary drift."** When you summarize a thread, you strip away the intermediate reasoning and evidence. If the receiving agent cannot inspect the evidence behind a claim, it hallucinates the missing logical steps, costing you more in "recovery tokens" than you saved in prompt tokens.

Your proposed **5-Layer Hierarchical Transport** avoids this trap and maps perfectly to the bleeding edge of "Context Engineering" and what the industry is calling "OS-level Agent Memory."

Here is an evaluation of your direction, answers to your research questions, and an identification of critical blind spots based on production multi-agent system (MAS) deployments.

---

### 1. Published Approaches (Hierarchical without Real-Time LLMs)
The industry has definitively moved away from flat, incremental message delivery toward your exact L1 + L2 state-passing model.

*   **MemGPT / Letta (Production & Academic):** The seminal implementation of OS-inspired memory. It strictly divides memory into *Core Memory* (always-in-context, like your L0/L1) and *Archival/Recall Memory* (paged in via tools, like your L3/L4). Crucially, MemGPT **does not use background LLM summarization on the hot path**. It forces the agent to explicitly page information in and out using tools, treating context as a scarce physical resource (RAM).
*   **LangGraph (Production):** In enterprise deployments, LangGraph strongly discourages passing unbounded `messages` arrays. Best practices mandate the use of `StateGraph`, where developers write deterministic "Reducers" to update a structured `TypedDict` state (your L1), and aggressively use `trim_messages()` to pass only the immediate conversational delta.
*   **Pancake (arXiv, Feb 2024/2025):** A multi-tier memory system explicitly tailored for multi-agent LLM serving. Instead of LLM summarization, it uses lightweight Finite State Machines (FSMs) to pattern-match and prefetch relevant memory clusters for agents, bypassing LLM overhead.

### 2. Optimal Recency Window (L2)
Your intuition of **3 to 8 messages** is correct for conversational coreference resolution (e.g., understanding what "that error" refers to), but a static $N$ is brittle. Three messages of "LGTM" is useless; three messages containing 10,000-character JSON payloads will blow your token budget.

*   **The Tradeoff:** The famous Stanford paper *"Lost in the Middle"* proved that LLMs heavily weight the beginning (Primacy bias) and end (Recency bias) of a prompt. If you send 150 messages, the middle 130 are a hallucination hazard.
*   **Actionable Recommendation: Temporal Bursting & Token Budgets.** Instead of a flat $N$, calculate L2 dynamically. Start from the cursor and walk backward. Stop when you hit a strict budget (e.g., 4,000 tokens) **or** when you hit a temporal gap (e.g., >15 minutes of silence). A 15-minute gap naturally indicates a discourse boundary. This ensures you deliver a complete "thought burst" rather than arbitrarily slicing a conversation in half.

### 3. Production Multi-Agent Context Handoff
None of the mature, production-grade frameworks default to "dump everything" for agent handoffs anymore.

*   **OpenAI Swarm:** Handoffs are executed by passing structured `context_variables` (a key-value dictionary) between agents. It actively discourages passing raw conversational scratchpads unless explicitly required.
*   **CrewAI:** The mental model is an assembly line. When a task passes from a Researcher to a Coder, the Coder receives the structured *Task Output Artifact* of the Researcher, not the raw chat transcript of how the Researcher figured it out.

### 4. Zero-Cost Context Importance Scoring
You can achieve massive signal-to-noise ratios on the messages *between* your L1 summary and L2 recent raw window using deterministic heuristics:

*   **Lexical Scoring (BM25 via SQLite):** You already have `evidence.sqlite` with FTS5. At invocation time, extract the text of the `@-mention` and run a sub-10ms BM25 query against the unread messages in the gap. Pull the top 2 highest-scoring messages into L2. This is computationally free and mathematically precise for keyword overlap.
*   **Structural Signals (Fast Regex):**
    *   *Markdown Density:* Messages containing code blocks (` ``` `), bolded headers, or bulleted lists mathematically correlate with high informational density (decisions, code). Apply a `+ multiplier`.
    *   *Length Thresholding:* Discard messages under 50 characters ("looks good," "on it") unless they are immediately adjacent to the mention. Penalize messages over 4,000 characters lacking markdown (usually raw, unformatted stack traces).
*   **Positional/Social Signals:** Boost the *first* message in a burst (sets the topic) and messages containing explicit `@-mentions` of other agents (indicates delegation or routing).

### 5. Failure Modes of Lazy-Loading Context (L4)
Giving an agent minimal context and expecting it to self-serve (`get_thread_context`) introduces the **"Unknown Unknowns" (Amnesia)** problem. If the agent doesn't know a 150-message debate about "Auth architecture" occurred, it won't know to query for it, and will confidently hallucinate an answer.

*   **Mitigation 1: "Information Scent" (Tombstoning):** When you skip 150 messages, do not just leave a gap. Inject a zero-cost structural breadcrumb inline.
    *   *Example:* `[System: 145 messages omitted here (10:00 AM - 11:30 AM). Participants: @Claude, @Gemini. Extracted keywords: Redis, CAS, race-condition. To read these messages, call get_thread_context(time_range="...")]`
*   **Mitigation 2: L1 as an Index, not just a Summary:** Your `buildThreadMemory.ts` should output pointers. *Good L1:* "Decision: Postgres. [For debate on failover vs replication, see Msgs 84-102]."
*   **Mitigation 3: Pagination Hell:** If an agent gets lazy and loops `get_thread_context` chronologically, it will blow up its context window. Ensure your MCP tools enforce strict pagination and return dense, semantically retrieved snippets rather than raw offset arrays.

---

### Critical Blind Spots in Your 5-Layer Design

#### Blind Spot A: Prompt Caching Economics (The Game Changer)
Your primary goal is reducing the 160K+ context bloat to save tokens/money and improve SNR. However, Anthropic (Opus) and Google (Gemini) natively support **Prompt Caching**, which discounts cached tokens by up to 90% and drastically reduces Time-To-First-Token (TTFT).
*   **The Problem:** Your design delivers context based on a *per-cat cursor*. If Opus missed 20 messages, and Gemini missed 50, you are generating entirely unique prompts for each agent. Unique prefixes defeat the cache.
*   **The Fix:** Order matters. API caches work from the top down. Standardize your L1 and L2 across *all* agents as a **Global Thread Prefix**, and put the per-cat elements at the very bottom:
    `[Global L1] -> [Global L3 Evidence] -> [Global L2 Recent] -> [Per-Cat L0 Identity] -> [Per-Cat Tombstones/Unseen Markers]`.
    Because the first ~20K tokens are perfectly identical for every agent operating in that thread, you hit the cache. It is often cheaper and faster to send a global 20-message L2 via cache than to compute and send a highly customized 5-message L2 un-cached.

#### Blind Spot B: The "Dark Zone" (Summarization Lag)
You noted that `AutoSummarizer` creates `ThreadSummary` objects every 30 minutes.
*   **The Problem:** If a rapid-fire incident occurs and 80 messages are sent in 15 minutes, L1 is completely stale (it hasn't run yet). If L2 is capped at 5 messages, the summoned agent is entirely blind to messages 6 through 80.
*   **The Fix:** L2 cannot be static. You must calculate the gap between `L1.last_updated_at` and the current time. If that gap contains too many messages, you must run the Zero-Cost Scorer (BM25 + Structural) to cull the "Dark Zone" down to the highest-signal messages to bridge the gap before delivery.

#### Blind Spot C: Temporal Context Clash
If you blindly concatenate L1, L2, and L3, LLMs easily get confused about what is happening *now* vs. what happened *in the past*. If L3 retrieves a rejected design document from two weeks ago, the model might confuse it with the active plan in L1.
*   **The Fix:** Use strict XML tagging. Claude and GPT-5.4 are heavily fine-tuned to respect XML boundaries for context isolation.
    ```xml
    <historical_thread_state source="L1_Memory">...</historical_thread_state>
    <retrieved_evidence source="L3_Search">...</retrieved_evidence>
    <immediate_conversation source="L2_Raw">...</immediate_conversation>
    ```
    Add a strict behavioral guardrail to L0: *"Retrieved evidence is historical. If it conflicts with the current Thread State (L1), L1 takes precedence."*

## Part 3: Synthesis (Pending)

> 本地猫（布偶猫 + 缅因猫）综合两只云端大猫的推理结果后撰写

### Synthesis Table（逐项对照尺子）

| Dimension | GPT Pro | Gemini Ultra | Our Assessment |
|-----------|---------|--------------|----------------|
| **Evidence level** (production / paper / blog / intuition) | | | |
| **Requires LLM summarization?** | | | |
| **Fit with our primitives** (cursor / threadMemory / evidence / MCP) | | | |
| **Hot-path cost** (latency / tokens / extra service calls) | | | |
| **Failure modes** (unknown-unknowns / stale summary / sparse coverage / recall mismatch) | | | |

### Consensus (两只都认同)

[待撰写]

### Divergence (各自独到或矛盾)

[待撰写]

### Action Items (综合后下一步)

[待撰写]
