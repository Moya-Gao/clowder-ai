---
doc_kind: review-request
feature_ids: [F210]
reviewer: opus
author: codex
created: 2026-05-23
---

# Review Request: F210 Phase C — Antigravity CLI Parser / Session

Review-Target-ID: f210
Branch: feat/f210-phase-c-parser-session
PR: https://github.com/zts212653/cat-cafe/pull/1857

## What

Phase C closes the AGY parser/session layer:

1. Added `antigravity-cli-event-parser.ts` for AGY plain-text stdout/stderr classification.
2. Wired `GeminiAgentService` to use the parser for AGY success, stdout timeout, and missing-model onboarding errors.
3. Marked resumed `agy --conversation` output as `textMode: replace` because F210 fixtures show print-mode stdout can replay prior assistant text.
4. Made per-call model override unsupported explicit through `system_info` + metadata instead of passing an unverified `--model`.
5. Added image degradation behavior: local path hints + `--add-dir`, no invented native image flag.
6. Updated F210 spec AC-C1/C2/C3 and OQ-2.

## Why

AGY `--print` is not Gemini CLI NDJSON. Phase A fixtures showed it returns final plain text, can encode provider errors as stdout/stderr text, and can replay prior assistant text during resume. Phase C makes those facts explicit in runtime behavior before F210 moves toward packaging/E2E/default switch.

## Original Requirements

> "你专注帮烁烁的cli变得可用吧"  
> "别做完了发现不能用"  
> "F210 Phase C-F 待继续...请按 spec 推进 Phase C（parser/session）"

- 来源：当前 A2A thread，2026-05-22/23 铲屎官 + Opus handoff
- 请对照上面的摘录判断：这版是否真正把 `antigravity-cli` 从 Phase B prototype 推进到可 review 的 parser/session 行为，而不是只改 binary 名。

## Tradeoff

- No NDJSON/stream parser is invented. AGY stays final-text only until upstream exposes a structured stream.
- No per-call model selection is implemented because AGY 1.0.1 has no verified `--model` or env override path.
- Resume is represented as replacement text, not delta, because the fixture proved stdout may include old + new assistant text.
- Image inputs are passed as local file hints with directory access; no native image upload flag is assumed.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This is a carrier/parser refinement inside the existing Siamese invocation path. It adds no new router/store/queue/dispatcher/transport boundary.

Please check:
- diff matches `Map delta: none`
- no parallel Store / Queue / Router / Adapter / Dispatcher / Binding was introduced
- `antigravity-cli` remains opt-in; default adapter remains guarded by later Phase E/AC-E4

## Open Questions

### Technical OQ

1. Is `textMode: replace` the right Cat Cafe invariant for AGY resume replay?
2. Is the model override diagnostic explicit enough while OQ-3 remains partial/account-side?
3. Is image degradation via local path hints + `--add-dir` sufficient for Phase C?

### Value OQ

None.

## Next Action

Please review PR #1857. Focus on parser classification ordering, resumed text semantics, and whether the explicit unsupported paths are honest enough for Phase C.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: `pnpm review:start`
- Ports: assigned by `pnpm review:start`

## Self-Check Evidence

### Red

```text
pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-cli-event-parser.test.js packages/api/test/gemini-agent-service.test.js
# failed before implementation: missing antigravity-cli-event-parser module and missing Phase C service semantics
```

### Green

```text
pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-cli-event-parser.test.js packages/api/test/gemini-agent-service.test.js
# 50 tests, 50 pass, 0 fail

pnpm check
# PASS

pnpm --filter @cat-cafe/mcp-server run build && pnpm --filter @cat-cafe/api test
# 11778 tests, 11775 pass, 3 skip, 0 fail

node scripts/check-fallback-layers.mjs
# total net fallback change: +0; existing cumulative threshold only

git diff --check
# pass
```

### Root Artifact Gate

```text
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# no output
```

[砚砚/GPT-5.5🐾]
