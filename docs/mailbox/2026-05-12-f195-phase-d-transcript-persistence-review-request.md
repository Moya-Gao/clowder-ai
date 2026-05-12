# Review Request: F195 Phase D — Transcript Artifact Persistence + Path Injection

Review-Target-ID: f195-phase-d
Branch: feat/f195-phase-d-transcript-persistence

## What

Meeting transcripts now persist as growing MD files (grouped by speaking turn, with 30s rolling summaries interleaved). Cats automatically receive the file PATH in their user turn context — not the full text — so they can read on demand.

5 commits, 8 files changed:
1. `TranscriptArtifactStore` Python class (MD creation, speaking-turn grouping, 30s summary, finalize)
2. Integration into `AudioSession` (start/chunk/stop lifecycle)
3. `transcript-path-hints.ts` — path hint injection at `invokeSingleCat` level (same pattern as image path hints)
4. Meeting-copilot skill docs updated
5. env-registry + biome format fixes

## Why

Phase C marked complete but transcript persistence (铲屎官's original design intent) was missing. Transcripts lived only in memory — lost on stop. Cats had no automatic transcript context unless user manually called MCP. Phase D fills this gap.

## Original Requirements

> "你的转写存成md，然后往下继续写，猫猫是读那个md文档！你可以告诉猫大概是 xx s - yy s，这样如果猫猫觉得这 xx s - yy s 这个时间区间转写不够你们看，你们可以往前看之前的信息以及之后的信息"
>
> "context里是看到转写的path地址，不是把一堆字给猫"
>
> 关键坐标系修正：不是 system prompt，走 user turn context（同图片附件管道）

- 来源：`docs/features/F195-meeting-copilot-live-advisory.md` (Phase D section, lines 125-130)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Rolling summary uses heuristic (first 3 + last 2 lines, truncated at 120 chars) instead of LLM summarization — keeps it synchronous and zero-cost. LLM summarization deferred to future phase if needed.
- Path injection at `invokeSingleCat` level (single injection point) instead of per-agent-service injection. Simpler, but means all agents get transcript hints even if they don't use them. Acceptable since hints are 2-3 lines max.

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: Extends invocation prompt assembly with a new content hint (same pattern as image path hints). No new Store/Queue/Router/Adapter.

Please check:
- diff is consistent with `Map delta: none`
- No new parallel `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`

## Open Questions

### Technical OQ (for reviewer)

1. **TRANSCRIPT_DIR resolution**: Node side uses `resolve(process.cwd(), 'scripts/meeting-copilot/transcripts')` as default. This assumes `process.cwd()` is the project root when API starts. Is this safe enough, or should it use `import.meta.url` based resolution?
2. **Synchronous fs read in hot path**: `readActiveTranscriptMeta` does a synchronous `readFileSync` on every invocation. For meeting context, this happens once per user message (not per chunk). Acceptable?

### Value OQ (for CVO)

None.

## Next Action

Full code review. Focus on:
- Python TranscriptArtifactStore correctness (speaking-turn grouping, summary timing)
- Node transcript-path-hints integration point
- Test coverage adequacy (14 tests total)

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f195-phase-d/codex`
- Start Command: `pnpm review:start`
- Ports: No frontend needed (backend-only change). Tests run without dev server.

## Self-Check Evidence

### Spec Compliance

All 6 ACs covered:
| AC | Status | Evidence |
|----|--------|----------|
| D1 TranscriptArtifactStore | ✅ | `transcript_store.py` + 7 Python tests |
| D2 Rolling summary 30s | ✅ | `maybe_flush_summary()` + 2 tests |
| D3 Path injection user turn | ✅ | `transcript-path-hints.ts` + `invoke-single-cat.ts:1115` + 7 Node tests |
| D4 Stop/finalize returns path | ✅ | `finalize()` + `audio-service.py` integration + 2 tests |
| D5 Privacy .gitignore | ✅ | `scripts/meeting-copilot/.gitignore` includes `transcripts/` |
| D6 Skills update | ✅ | `cat-cafe-skills/refs/meeting-copilot.md` Phase D section |

### Test Results

```
pnpm test → 2998/2998 pass, 396 test files ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome format + lint + all sub-checks)
pnpm -r --if-present run build → exit 0 ✅
Python tests → 7/7 pass ✅
Node tests → 7/7 pass ✅
```

### Related Docs
- Plan: `docs/plans/2026-05-12-f195-phase-d-transcript-persistence.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md`

### Pre-retraction checklist
If my judgment was wrong, I most likely erred on:
1. **TRANSCRIPT_DIR default path** — might not resolve correctly in all deployment modes (runtime vs dev vs alpha)
2. **Synchronous readFileSync** — might block event loop if meta.json is on a slow filesystem (unlikely but worth reviewer scrutiny)
3. **Speaking-turn grouping logic** — edge case where speaker_label changes mid-sentence due to diarization correction might produce odd formatting
