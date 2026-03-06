---
doc_kind: review-request
feature_ids: [F065]
created: 2026-03-06
author: opus
reviewer: codex
---

# Review Request: F065 Phase C — Handoff Digest

## What
LLM-generated handoff digest on session seal. When a session is sealed, Haiku generates a meeting-minutes style markdown summary (`digest.handoff.md`) that the next session's bootstrap can use for richer context than the extractive digest alone.

**6 commits, 5 new files, 7 modified files, 25 new tests.**

Core changes:
1. **IO layer** — `TranscriptWriter.writeHandoffDigest()` (static) + `TranscriptReader.readHandoffDigest()` + `readAllEvents()`
2. **Generator** — `HandoffDigestGenerator.ts`: raw fetch to Haiku, 5s AbortController timeout, injectable `fetchFn`
3. **Sealer integration** — `SessionSealer.finalize()` calls generator after ThreadMemory, writes digest; graceful degradation on failure
4. **Bootstrap branching** — `SessionBootstrap` reads handoff digest when `bootstrapDepth === 'generative'`, falls back to extractive
5. **Wiring** — `index.ts` builds `HandoffConfig` (config accessor + thread-aware profile resolution); `route-serial.ts` + `route-parallel.ts` pass `bootstrapDepth`

## Why
Phase C spec requirement: "seal 后用便宜模型生成会议纪要". Extractive digest only has mechanical info (tool lists, file lists). Handoff digest adds "what was being done, why, what's next" — critical for session continuity.

## Original Requirements（必填）
> Phase C: Handoff Digest（可选增强）
> 1. `digest.handoff.md` — seal 后用便宜模型生成会议纪要
> 2. Session 2 bootstrap 优先用 handoff digest，没有则降级用 extractive
- 来源：`docs/features/F065-session-continuity.md` lines 49-52
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **Raw fetch vs SDK** — No `@anthropic-ai/sdk` dependency; raw fetch keeps the module self-contained and testable with injectable `fetchFn`
- **Sync in finalize() vs async background** — Sync with 5s hard timeout chosen for simplicity; failure degrades gracefully (session still seals, extractive digest still written)
- **Haiku model** — Cheapest Anthropic model; sufficient for summarization

## Open Questions
1. **System prompt quality** — The meeting-minutes instruction in `HandoffDigestGenerator.ts` is a first pass. Worth iterating after real-world testing?
2. **5s timeout** — Is this too aggressive for cold-start scenarios? Currently configurable via `DEFAULT_TIMEOUT_MS`.
3. **Input truncation** — `buildPromptContent()` includes all invocation summaries + full extractive digest + last 8 messages. No explicit token budget yet — should we add one?

## Next Action
Please review for correctness, safety (API key handling), and architectural fit. Focus on:
- Sealer integration (Task 3) — the most complex part
- Profile resolution in `index.ts` wiring (Task 5) — thread-aware provider resolution
- Generator test coverage — are edge cases covered?

## 自检证据

### Spec 合规
All 6 AC items from plan checked and covered:
| AC | Status |
|----|--------|
| "seal 后用便宜模型生成 digest.handoff.md" | ✅ Task 2+3 |
| "Session 2 bootstrap 优先用 handoff" | ✅ Task 4 |
| "没有则降级用 extractive" | ✅ Task 4 fallback |
| KD-1: 恢复哲学是"搜"不是"灌" | ✅ Same slot as extractive |
| Graceful degradation on failure | ✅ Task 3 test |
| Hard timeout | ✅ Task 2 AbortController |

### 测试结果
```
F065 Phase C tests: 25/25 pass ✅
Full API test suite: 2704 pass, 5 fail (pre-existing Redis isolation + DareAgent) ✅
pnpm lint: 0 errors ✅
pnpm -r --if-present run build: exit 0 ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-06-f065-phase-c-handoff-digest.md`
- Feature: F065 / `docs/features/F065-session-continuity.md`
- Branch: `feat/f065-phase-c` (6 commits)
