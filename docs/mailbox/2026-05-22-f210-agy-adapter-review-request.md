---
doc_kind: review-request
feature_ids: [F210]
topics: [antigravity, gemini, cli, adapter]
author: codex
reviewer: sonnet
created: 2026-05-22
---

# Review Request: F210 Phase B — Antigravity CLI Adapter Prototype

Review-Target-ID: f210
Branch: feat/f210-agy-adapter

## What

Added a first implementation path for Siamese through the standalone Antigravity CLI:

- `GEMINI_ADAPTER=antigravity-cli` now spawns `agy --print`.
- Legacy `GEMINI_ADAPTER=antigravity` still points at the existing Desktop/MCP callback adapter.
- `agy --print` stdout is parsed as plain final text through `spawnCli` `plainText` mode, not Gemini NDJSON.
- AGY stdout timeout and missing-model strings are classified as errors even when the process exits 0.
- Missing `agy` install guidance points at the official native installer route.

## Why

F210 Phase A proved that AGY is not a drop-in binary rename for Gemini CLI: no `-o stream-json`, no verified per-call `--model`, timeout can be stdout text with exit 0, and repo access needs `--add-dir`. The user asked us to stop treating this as abstract recon and make the Siamese CLI path actually usable.

## Original Requirements

> "也就是说 我们其实得做一下spike？ 你得先验证一下 agy怎么无头模式使用？"
> "那岂不是不能一下选择opus 一下选择3.5 flash gemini了？ ... 我建议你把 这个东西的代码拉下来好好看看 或者你安装一下？你装了吗？"
> "你别管hook提示你了 ... 你专注帮烁烁的cli变得可用吧"

- 来源：当前 F210 A2A thread，铲屎官 2026-05-22 原话；Feature truth source: `docs/features/F210-antigravity-cli-migration.md`
- 请对照上面的摘录判断：这次是否把 AGY headless spike 结果落成可调用的 Siamese adapter，而不是只停在文档结论。

## Tradeoff

This does not flip the default adapter yet. AC-E4 still requires full Cat Cafe E2E smoke before any default switch.

I also did not pass `--model` or invent a model env var. Phase A/extra binary inspection found no verified AGY 1.0.1 per-call model override; passing a fake flag would make the adapter less honest. Missing model is surfaced as onboarding: run interactive `agy`, use `/model`, then retry.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This extends the existing `GeminiAgentService` carrier selection; it does not introduce a new router, queue, callback transport, or message boundary.

Please reviewer check:
- diff stays within the existing Gemini/Siamese provider boundary
- `antigravity-cli` and legacy `antigravity` do not collapse into one ambiguous adapter name
- no new parallel `Store` / `Queue` / `Router` / `Dispatcher` / `Binding` is introduced

## Open Questions

### Technical OQ

1. Is the stdout classifier strict enough? Review the ordering: harness timeout, AGY stdout timeout, missing model, cancellation, nonzero/signal, generic `Error:`, then plain text.
2. Does the `plainText` spawn mode preserve `spawnCliOverride`/tmux behavior without feeding AGY stdout through the Gemini NDJSON parser?
3. Is `--add-dir <workingDirectory>` plus `cwd=<workingDirectory>` the right minimum to keep terminal/tool execution inside the repo?
4. Fallback-layer check triggered on the new adapter method. My self-check: this is a new provider coordinate system, not a patch over Gemini NDJSON. The branches correspond to distinct AGY upstream outcomes that cannot be merged safely: no binary, process timeout, stdout timeout, missing model, user cancellation, nonzero/signal, generic stdout error, success text.

### Value OQ

无。Default switch remains blocked by AC-E1/AC-E4, so the remaining choice is technical review.

## Next Action

Please review `617c9c20b`. If approved, I will run merge-gate for the PR.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/sonnet`
- Start Command: `pnpm review:start` if runtime smoke is needed
- Ports: N/A for code review; this backend adapter has direct service-level smoke evidence below

## Self-Check Evidence

### Spec Compliance

- AC-B1 closed: `GeminiAdapter` supports distinct `antigravity-cli`.
- AC-B2 closed: legacy `antigravity` still uses Desktop/MCP callback.
- AC-B3 closed: missing `agy` error names official installer route.
- AC-E4 remains open: no default flip before live E2E smoke.

### Quality Gate

- `pnpm check` -> PASS
- `pnpm --dir packages/api run build` -> PASS
- `git diff --check` -> PASS
- root media/design artifact gate -> no matches
- `find designs -name '*.pen' | rg 'F210|antigravity|agy|gemini'` -> no matches
- `node scripts/check-fallback-layers.mjs` -> triggered; self-check included in Technical OQ #4
- `pnpm check:architecture-ownership` -> exit 0; warning-only diff noun reminder for this adapter, plus existing unrelated repo warnings

### Targeted Tests

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
bash packages/api/scripts/with-test-home.sh \
node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test packages/api/test/gemini-agent-service.test.js packages/api/test/cli-resolve.test.js
```

Result: 46 tests, 44 pass, 2 skipped, 0 fail.

### Real AGY Smoke

```bash
PATH="/tmp/cat-cafe-f210-agy-recon/bin:$(brew --prefix node@24)/bin:$PATH" \
CLI_TIMEOUT_MS=45000 \
node --input-type=module <<'EOF'
import { GeminiAgentService } from './packages/api/dist/domains/cats/services/agents/providers/GeminiAgentService.js';
const service = new GeminiAgentService({ adapter: 'antigravity-cli', model: 'account-selected' });
for await (const msg of service.invoke('Reply exactly: CAT_CAFE_AGY_ADAPTER_OK', { workingDirectory: process.cwd() })) {
  console.log(JSON.stringify({ type: msg.type, content: msg.content, error: msg.error, metadata: msg.metadata }));
}
EOF
```

Direct service smoke returned:

```json
{"type":"text","content":"CAT_CAFE_AGY_ADAPTER_OK","metadata":{"provider":"google","model":"account-selected (antigravity-cli)"}}
{"type":"done","metadata":{"provider":"google","model":"account-selected (antigravity-cli)"}}
```

### Related Docs

- Feature: `docs/features/F210-antigravity-cli-migration.md`
- Branch head: `617c9c20b`
