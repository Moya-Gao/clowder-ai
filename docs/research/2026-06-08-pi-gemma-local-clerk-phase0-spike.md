---
created: 2026-06-08
owner: codex
status: spike-complete
doc_kind: research-spike-report
topics: [local-small-model, memory-clerk, pi-agent, gemma-4, mlx, eval-harness]
related_features: [F102, F188, F200, F218, F227]
related_docs:
  - docs/research/2026-06-07-local-small-model-memory-clerk-proposal.md
---

# Pi Agent + Gemma 4 Local Clerk Phase 0 Spike

## Verdict

Pi can carry a read-only local-model clerk profile for offline spikes and bounded
batch jobs. The durable Phase A interface should still be a `small-model-clerk`
MCP toolset over a local model server, not raw Pi sessions and not direct truth
source writes.

Gemma 4 26B A4B 8-bit is feasible on this machine from a hardware perspective,
but it was not downloaded or run in this spike. The local machine has 128 GB
unified memory and about 1.1 TiB free disk, but no complete Gemma 4 cache was
present. The relevant 8-bit artifacts are roughly 26.8-28 GB depending on
text-only vs multimodal MLX packaging, and the official safetensors weights are
about 51.6 GB before quantization. That crosses the "large download /
persistent install" threshold, so CVO approval should precede a Gemma-specific
run.

Correction after CVO pushback: memory clerk scope is not text-only. Meeting
audio exports, screenshots, design artifacts, and video work need media-backed
anchors too. The next decision should choose which lane to spike first:

- Text clerk lane: `mlx-community/gemma-4-text-26b-a4b-it-8bit` via `mlx-lm`
  for thread/repo/taste/source-hygiene text.
- Media clerk lane: `mlx-community/gemma-4-26b-a4b-it-8bit` via `mlx-vlm` for
  screenshots and sampled video frames; audio needs an ASR lane first, then the
  text clerk consumes timestamped transcripts.

Recommended next move: approve Phase A only as a strict MCP wrapper with schema
validation and media/text anchor checks. Separately ask CVO which Phase 0b lane
matters first: text clerk, media clerk, or both.

## Constraints Honored

- Did not touch Redis 6399.
- Did not restart Cat Cafe runtime.
- Did not write Event Memory, Taste Memory truth sources, or runtime state.
- Started one temporary MLX server on `127.0.0.1:18080`; stopped it and verified
  the port was no longer listening.
- Used `/tmp/cat-cafe-clerk-spike-venv` and `/tmp/pi-clerk-spike` for temporary
  runner/config state.

## Local Environment

| Check | Result |
|---|---|
| Machine | MacBook Pro `Mac16,5`, Apple M4 Max |
| CPU | 16 cores, 12 performance + 4 efficiency |
| Memory | 128 GB unified |
| OS | macOS 26.2, arm64 |
| Free disk | about 1.1 TiB free on Data volume |
| Ollama | installed `0.12.9`; no server running; local manifest only `manutic/nomic-embed-code` |
| MLX | not globally installed; installed `mlx-lm==0.31.3` and `mlx==0.31.2` in `/tmp` venv |
| Pi | not globally installed; verified via `npx @earendil-works/pi-coding-agent@0.79.0` |
| Existing HF cache | no complete Gemma 4 weights; has `mlx-community/Qwen3-8B-4bit-AWQ` (4.4 GB), `mlx-community/Qwen3.5-35B-A3B-4bit` (19 GB), `mlx-community/Qwen3-VL-8B-Instruct-4bit` (5.4 GB), `mlx-community/Qwen3-ASR-1.7B-8bit` (2.3 GB), and `mlx-community/whisper-large-v3-turbo-asr-fp16` (1.5 GB) |

## Pi Carrier Boundary

What Pi supports, based on docs and local run:

- `--mode rpc` gives JSONL stdin/stdout integration.
- Custom providers can point to OpenAI-compatible local endpoints such as MLX
  server, Ollama, LM Studio, or vLLM via `models.json`.
- Tool surface can be narrowed with `--no-tools`, or made read-only with
  `--tools read,grep,find,ls`.
- `--no-context-files`, `--no-extensions`, `--no-skills`,
  `--no-prompt-templates`, and `--no-session` work for an isolated one-shot
  clerk/eval invocation.

Important boundary: Pi is not a sandbox. Its own security docs say it runs with
the permissions of the user process and built-in tools/extensions can read,
write, edit, and run shell commands. So the clerk profile must be enforced by
process args, isolated config dirs, and the outer MCP/schema gate. Do not treat
Pi project trust as a security boundary.

Package drift found: Pi official docs and npm current package are
`@earendil-works/pi-coding-agent` (`0.79.0`, modified 2026-06-08). The
HuggingFace Gemma/Pi snippet still names `@mariozechner/pi-coding-agent`
(`0.73.1`, modified 2026-05-07). Use the official Pi package name.

## Gemma 4 Feasibility

Google's Gemma 4 model card says 26B A4B is an MoE model with 25.2B total
parameters, 3.8B active parameters, 30 layers, 1024 token sliding window, 256K
context, and text/image modalities. It is a plausible clerk candidate because
active parameters are small relative to total weight size.

Important modality correction: the official Gemma 4 26B A4B instruction model is
multimodal (`image-text-to-text`). The `mlx-community/gemma-4-text-26b-a4b-it-8bit`
package is a text-generation conversion for `mlx-lm`, not the full multimodal
runtime surface. The full Mac multimodal route is
`mlx-community/gemma-4-26b-a4b-it-8bit` via `mlx-vlm`.

For memory clerk design, "source anchors" should generalize beyond line ranges:

- Text: `filePath` / `lineStart` / `lineEnd` / exact quote.
- Audio: `filePath` / `startMs` / `endMs` / transcript quote / ASR model.
- Video: `filePath` / `startMs` / `endMs` / sampled frame ids / VLM caption or
  OCR quote.
- Image: `filePath` / image region or full-image hash / VLM caption or OCR
  quote.

The model still produces candidates, not truth. Media candidates must remain
reviewable and replayable from timestamps/frames.

Artifact sizing checked without downloading weights:

| Artifact | Source | Size |
|---|---|---:|
| `google/gemma-4-26B-A4B` safetensors shard 1 | HF HEAD/API | 49,907,246,508 bytes |
| `google/gemma-4-26B-A4B` safetensors shard 2 | HF HEAD/API | 1,704,763,408 bytes |
| `mlx-community/gemma-4-text-26b-a4b-it-8bit` | HF model card | 26.8 GB |
| `mlx-community/gemma-4-26b-a4b-it-8bit` multimodal | HF model card | 28 GB |
| `unsloth/gemma-4-26B-A4B-it-GGUF` Q8_0 | HF API metadata | 26,859,859,744 bytes |
| `unsloth/gemma-4-26B-A4B-it-GGUF` UD-Q4_K_M | HF API metadata | 16,947,539,744 bytes |

Feasibility read: hardware is enough; disk is enough; MLX path is the cleanest
Apple Silicon route. Actual Gemma behavior remains unverified until CVO approves
either the 26.8 GB text model download, the 28 GB multimodal model download, or
both.

## Fixture Results

### MLX Direct, Cached Qwen3 8B 4-bit

Smoke:

- Command loaded `mlx-community/Qwen3-8B-4bit-AWQ` from local snapshot.
- Cold run elapsed 3.42 s.
- Max RSS about 5.04 GB; peak memory footprint about 5.26 GB.
- Prompt asked `Return exactly: OK`; model emitted `<think>` text instead.

Anchored JSON fixture:

- Input: three repo anchors from F227 no-classifier, taste restraint, and F218
  source-hygiene.
- Elapsed 10.74 s.
- Raw output began with empty `<think></think>`, so direct `json.loads` failed.
- Extracting the first JSON object succeeded.
- Candidate count: 3.
- Anchor count: 3.
- Empty anchors: false.
- `forbiddenActions` exactly matched
  `["write_truth_source","delete_memory","mark_event","route_cat"]`.

Interpretation: raw CLI output is not safe enough for production. Phase A must
use a server/chat-template path that suppresses thinking tags, and the MCP layer
must fail closed on non-JSON output instead of silently accepting repaired text.

### MLX Direct, Cached Qwen3.5 35B A3B 4-bit

This was only a larger-model pressure smoke test.

- Local cached model size: 19 GB.
- Cold run elapsed 10.94 s.
- Max RSS about 8.38 GB; peak memory footprint about 20.16 GB.
- It also emitted thinking text instead of the requested exact output.

Interpretation: this machine can load a 19 GB local MoE-like MLX model with
ample headroom, but model formatting still needs strict control.

### MLX Server + Pi Carrier

Server:

- Started `mlx_lm.server` on `127.0.0.1:18080`.
- `--chat-template-args '{"enable_thinking":false}'`.
- Using a HuggingFace repo id in the chat request tried a provider/network path
  and failed with `Using SOCKS proxy, but the 'socksio' package is not installed`.
- Using the local snapshot path as the model id returned clean JSON:
  `{"ok":true}`.

Pi:

- Config dir: `/tmp/pi-clerk-spike`.
- Provider: `mlx-lm`, OpenAI-compatible endpoint `http://127.0.0.1:18080/v1`.
- Invocation flags:
  `--no-tools --no-context-files --no-extensions --no-skills --no-prompt-templates --no-session`.
- Simple carrier check returned exactly `{"carrier":"pi","local":true}`.
- Mini anchored fixture returned direct valid JSON in 7.17 s with 1 candidate and
  1 source anchor.

Interpretation: Pi is a viable carrier for read-only local clerk invocations
when paired with a local OpenAI-compatible server and isolated config. It should
not be the permission boundary or schema boundary.

## Source Audit Ledger

| Claim | Source | Source type | Verdict | Provenance |
|---|---|---|---|---|
| Pi supports RPC over JSONL stdin/stdout | Pi official RPC docs | official docs | use | [official docs, current latest, applicable to Pi 0.79.0] |
| Pi supports custom local providers through `models.json` and OpenAI-compatible APIs | Pi official custom model docs + local Pi run | official docs + local test | use | [official docs + local smoke, 2026-06-08] |
| Pi can be narrowed to no tools or read-only tools | Pi usage docs + local `--help` | official docs + local test | use | [official docs + local smoke, 2026-06-08] |
| Pi project trust is not a sandbox | Pi security docs | official docs | use | [official docs, current latest] |
| Gemma 4 26B A4B has 25.2B total / 3.8B active parameters and 256K context | Google Gemma 4 model card | vendor official model card | use | [vendor official, model-card level] |
| Gemma 4 8-bit MLX artifacts are 26.8-28 GB | HuggingFace mlx-community model cards | community conversion model card | use-with-caveat | [community artifact metadata, not Google official] |
| Unsloth GGUF Q8/Q4 file sizes | HuggingFace API metadata | community artifact metadata | use-with-caveat | [HF metadata, no runtime quality claim] |
| Pi package name in HF Gemma snippet is current | HF Gemma/Pi snippet | community/generated integration snippet | reject | Pi official docs/npm point to `@earendil-works`; HF snippet uses older `@mariozechner` package. |

Sources:

- Pi RPC docs: https://pi.dev/docs/latest/rpc
- Pi custom models docs: https://pi.dev/docs/latest/models
- Pi usage docs: https://pi.dev/docs/latest/usage
- Pi security docs: https://pi.dev/docs/latest/security
- Pi quickstart docs: https://pi.dev/docs/latest/quickstart
- Google Gemma 4 model card: https://ai.google.dev/gemma/docs/core/model_card_4
- MLX Gemma 4 text 8-bit: https://huggingface.co/mlx-community/gemma-4-text-26b-a4b-it-8bit
- MLX Gemma 4 multimodal 8-bit: https://huggingface.co/mlx-community/gemma-4-26b-a4b-it-8bit
- Unsloth Gemma 4 GGUF metadata: https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF

## Phase A Recommendation

Proceed to Phase A only if the interface is:

```text
local model server
  -> small-model-clerk MCP tools
  -> schema + anchor validators
  -> JSONL candidate artifacts / review queue
  -> cat or CVO promotion
  -> truth source
```

Minimum Phase A gates:

- Direct JSON parse must pass. No prose, markdown, or thinking tags.
- `sourceAnchors.length > 0`.
- Every quote must be an exact substring of its source span.
- Anchors must include `filePath` plus line range, or thread/message ids when
  using conversation corpora.
- Candidate operation must be one of the proposal enum values.
- Output must include the forbidden action list and must not include database,
  routing, delete, mark, unmark, downgrade, or promotion commands.
- MCP must fail closed if any of the above fails.

Runner recommendation:

1. Use MLX server on Apple Silicon for the first real local model path.
2. Use Pi as an optional carrier for offline clerk jobs and fixture generation.
3. Keep the durable product contract at the MCP tool layer, not Pi.
4. For the Gemma-specific follow-up, choose the model by lane:
   - Text/repo/thread/taste/source-hygiene clerk:
     `mlx-community/gemma-4-text-26b-a4b-it-8bit` with `mlx-lm`.
   - Image/screenshot/video-frame clerk:
     `mlx-community/gemma-4-26b-a4b-it-8bit` with `mlx-vlm`.
   - Meeting audio clerk:
     run ASR first (`Qwen3-ASR` / Whisper-style model), then pass timestamped
     transcript spans into the text clerk. Gemma 4 26B A4B supports text/image,
     not native audio input.

Open CVO decision:

> Which Phase 0b lane should run first?
>
> 1. Text clerk only: download
>    `mlx-community/gemma-4-text-26b-a4b-it-8bit` (~26.8 GB).
> 2. Media clerk: download
>    `mlx-community/gemma-4-26b-a4b-it-8bit` (~28 GB) and test screenshot /
>    sampled-video-frame candidates via `mlx-vlm`.
> 3. Audio clerk: use existing ASR cache first, then feed timestamped transcripts
>    into the text candidate harness.
> 4. Run both text and media Gemma lanes.

[砚砚/gpt-5.5🐾]
