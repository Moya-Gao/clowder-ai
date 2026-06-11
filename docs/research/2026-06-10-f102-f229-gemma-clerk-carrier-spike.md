---
created: 2026-06-10
owner: codex
status: spike-complete
doc_kind: research-spike-report
topics: [local-small-model, f102, f229, gemma-4, mlx-vlm, pi-agent, opencode, mcp, concierge, eval-harness]
related_features: [F102, F188, F200, F218, F227, F229]
related_docs:
  - docs/features/F229-cat-ball-concierge.md
  - docs/research/2026-06-07-local-small-model-memory-clerk-proposal.md
  - docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md
  - docs/research/2026-06-10-local-small-model-clerk-cloud-research.md
issue_refs:
  - cat-cafe#2175
---

# F102/F229 Gemma Clerk Carrier Spike

## Verdict

Gemma 4 26B A4B 8-bit via `mlx-vlm` is good enough to continue into the next
local-clerk validation stage, but only as a candidate generator. The trusted Cat
Cafe harness remains the control plane.

Two product lanes can share the same provider/harness work:

- F102: MD-first thread digest candidates with short anchor handles.
- F229: MD tool-intent candidates for front-desk navigation, memory lookup, and
  user-confirmed relay actions.

Pi is currently the strongest validated carrier for local Gemma + Cat Cafe MCP:
it can run against `mlx_vlm.server`, use a narrowed read-only tool surface, and
call the `cat-cafe-memory` MCP tools. It is not a security boundary and should
not be the production abstraction.

OpenCode is not ruled out, but it is not green for local Gemma through
`mlx_vlm.server` yet. Its MCP layer worked with a hosted/free model, but the
local OpenAI-compatible provider path looped even on a trivial "return exactly"
prompt.

F229 should treat small models as a quick-clerk provider behind a shared
provider abstraction, not as a directly empowered agent. The clerk may propose;
Cat Cafe code validates, confirms, executes, and escalates.

## What Was Tested

| Area | Result | Evidence |
|---|---|---|
| Gemma 4 multimodal package | Pass for text and visual lanes; audio requires ASR first | `docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md` |
| MD-first F102 digest | Pass only after switching from long message IDs to short handles | cat-cafe#2175 Phase 0c comment |
| F229 tool-intent selection | Pass after adding explicit routing rules | cat-cafe#2175 Phase 0c add-on |
| Pi + local Gemma carrier | Pass with isolated config and read-only tools | cat-cafe#2175 Pi carrier smoke |
| Direct Gemma tool calls | Pass for a simple OpenAI-compatible `tool_calls` case | cat-cafe#2175 Pi carrier smoke |
| Pi + Cat Cafe MCP | Pass for `search_evidence`, `graph_resolve`, and `list_recent` | cat-cafe#2175 Pi/OpenCode expanded smoke |
| OpenCode MCP | Pass with `opencode/deepseek-v4-flash-free` | cat-cafe#2175 Pi/OpenCode expanded smoke |
| OpenCode + local Gemma provider | Not green: HTTP 200 from `mlx_vlm.server`, but OpenCode did not terminate | cat-cafe#2175 Pi/OpenCode expanded smoke |

All spikes were bounded: no Redis 6399 access, no runtime restart, no truth-source
writes, and only ignored temporary config under `tmp/` or `/tmp`.

## Harness Findings

### 1. MD-first is better than JSON-first for this role

The CVO objection was right: even strong models can break JSON or XML under
pressure, while Markdown is the native shape of the work product. F102 and F229
should ask for Markdown candidate documents with a small machine-readable tail,
not for one large brittle JSON object.

The candidate still needs hard validation:

- Required headings must be present.
- Anchors must use wrapper-supplied short handles such as `M001` or `T02`.
- The harness maps handles back to real IDs.
- Exact quotes must match source text before the candidate is accepted.
- Forbidden action words inside a boundary/prohibition section are not the same
  as requested actions.

### 2. Short handles are mandatory

The failed digest attempt copied long message IDs with angle brackets and
truncation. The corrected attempt used `M001`, `M002`, etc.; the validator then
resolved all anchors and exact-matched quotes.

This should be a general Cat Cafe local-clerk rule:

- Models receive short handles.
- Models never copy long message IDs, thread IDs, Redis keys, memory IDs, or
  truth-source paths as authority.
- The trusted wrapper owns the real mapping.

### 3. Tool descriptions are not enough

The first F229 tool-intent fixture mostly worked but chose `graph_resolve` for
"previous discussion / where was this discussed" because the query included
`F102`. That is a dangerous bias: a feature ID appearing in a query does not mean
the user wants the feature anchor.

The second run passed 9/9 only after explicit rules:

- Previous discussion / where / "在哪" -> `search_evidence`.
- Feature spec / status / doc -> feature index.
- Exact anchor resolution only -> `graph_resolve`.
- Known thread/message handle navigation -> teleport.
- `cross_post_message`, `propose_thread`, and guide start -> confirmation
  required.
- Redis 6399, runtime restart, truth-source writes, and irreversible actions ->
  `refuse_or_escalate` with original user text, no confirmation prompt.

F229 Phase D should ship routing rules as code-owned prompt material, not as
implicit model lore.

### 4. Direct `tool_calls` can be a fast-path experiment, not the default

Gemma through `mlx_vlm.server` returned a structured OpenAI-compatible
`message.tool_calls` response for a trivial `get_current_time` function. That is
useful signal, but it does not remove the harness boundary.

Default production shape should stay:

1. Model outputs an MD tool-intent candidate.
2. Validator checks handle mapping, allowlist, confirmation requirements, and
   forbidden actions.
3. Trusted Cat Cafe code executes allowed read-only tools or asks the user to
   confirm write/relay actions.
4. Dangerous actions fail closed or escalate with original text.

Native `tool_calls` can remain a later optimization after version pinning and a
regression suite for parser, `tool_choice`, replay, and loop behavior.

## Carrier Findings

### Pi

Validated path:

- `mlx-community/gemma-4-26b-a4b-it-8bit`
- `python -m mlx_vlm.server --host 127.0.0.1 --port 18082 --model <snapshot>`
- `@earendil-works/pi-coding-agent@0.79.0`
- isolated `PI_CODING_AGENT_DIR`
- read-only built-ins: `read,grep,find,ls`
- temporary `pi-mcp-extension`
- only `cat-cafe-memory` MCP exposed over stdio

Observed passes:

- Carrier returned `PI_GEMMA_OK`.
- Direct MLX OpenAI-compatible request returned `DIRECT_MLX_OK`.
- Read-only tools found the F229 spec title.
- Write request was refused with only read-only tools enabled.
- Pi + Gemma selected `cat_cafe_search_evidence`.
- Expanded fixture selected `search_evidence`, `graph_resolve`, and
  `list_recent` correctly.

Interpretation:

Pi is useful for Phase 0/Phase A spikes and bounded offline jobs. It should not
be treated as the Cat Cafe production abstraction or security boundary. If used
for F102/F229, start it with an isolated config, a read-only allowlist, and an
outer Cat Cafe validator.

### OpenCode

Validated path:

- OpenCode 1.2.27 is installed.
- Its MCP layer can call `cat-cafe-memory_cat_cafe_search_evidence` using
  `opencode/deepseek-v4-flash-free`.

Not validated:

- OpenCode + local `mlx_vlm.server` provider did not terminate even for
  `Return exactly: OPENCODE_GEMMA_OK`.
- `streaming: false` did not fix the loop.

Interpretation:

OpenCode/ACP may still be valuable because Cat Cafe already supports ACP-shaped
integration, but it needs a separate compatibility investigation before being
selected as the local Gemma carrier. Do not block F102/F229 on it.

## F229-Specific Implications

### Phase D wording

Keep F229 Phase D provider-agnostic. The quick clerk can be local Gemma, an API
fast model, or a later ACP/OpenCode carrier. Pi is now validated as a spike
carrier, not selected as the final production runtime.

### Session and short-term state

F229 cannot rely on Pi/OpenCode/model context compaction as product memory. The
front-desk surface needs its own explicit session/action state:

- current route/page title,
- active conversation,
- recent short handles and their real anchor map,
- pending confirmations,
- whether the user chose go / inline-read / relay,
- relay receipts and target thread,
- active guide state,
- clerk/provider used and fallback reason,
- escalation packet with original user text.

This state belongs in Cat Cafe application code. The model sees a narrow
projection of it, not the whole runtime.

### Tool surface

For Phase D, expose only a small handle-based candidate surface:

- memory search,
- exact anchor resolve,
- recent sweep,
- feature index,
- teleport candidate,
- guide lookup/start candidate,
- relay/propose candidate with confirmation,
- digest candidate,
- refuse/escalate.

No shell, filesystem write, collab write, limb, Redis, runtime restart, or
truth-source tool should be exposed to the small model.

### Escalation

Escalation must carry original user text and validated anchors. It must not
carry a small-model summary as the only evidence. This preserves the KD-8
no-classifier boundary and keeps duty cats from inheriting hidden model errors.

## Recommended Next Tests

Before connecting any production queue:

1. Run 5-10 diverse F102 digest fixtures:
   - long thread,
   - short/noise thread that should abstain,
   - F192/Eval Hub thread,
   - memory/F102/F188 thread,
   - multi-topic mixed thread,
   - media-adjacent thread with image/video anchors if available.
2. Run 10-15 F229 real-intent fixtures:
   - "where was this discussed",
   - "open that thread",
   - "show it here without navigating",
   - "relay this to F229",
   - "start the guide",
   - dangerous Redis/runtime/truth-source requests,
   - ambiguous feature/status/search queries.
3. Add a multi-turn F229 session-state fixture:
   - user asks where a thing is,
   - chooses inline read,
   - then chooses teleport,
   - then asks to relay a follow-up,
   - validator must preserve handle mapping and confirmation state.
4. Keep OpenCode local-provider debugging separate:
   - provider-only termination,
   - streaming behavior,
   - local OpenAI-compatible stop semantics,
   - ACP adapter fit.
5. Measure latency with the actual intended wrapper:
   - direct `mlx-vlm`,
   - Pi + Gemma,
   - Pi + Gemma + MCP,
   - cloud/fast-model fallback,
   - duty-cat escalation baseline.

## Recommendation

Proceed with a shared `local-small-model` provider/harness track for F102 and
F229, but do not connect it directly to production automatic summaries or front
desk actions yet.

The next engineering artifact should be a fail-closed candidate queue:

- provider abstraction,
- MD candidate parser,
- short-handle mapper,
- quote/anchor validator,
- tool-intent validator,
- confirmation gate,
- visible review queue,
- no direct truth-source writes.

F229 can consume the same harness as a quick-clerk provider in Phase D. F102 can
consume it as a digest candidate generator. Pi is a useful validated carrier for
continued spikes; OpenCode remains a candidate after compatibility work.

[砚砚/gpt-5.5🐾]
