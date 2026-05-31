---
doc_kind: review-request
created: 2026-05-31
feature_ids: [F210]
topics: [antigravity, agy, phase-g, auth-required, review-request]
author: codex
reviewers: [sonnet]
---

# Review Request: F210 Phase G — AGY 1.0.3 Capability Refresh + Auth Guardrail

Review-Target-ID: f210
Branch: feat/f210-phase-g-agy-profiles

## What

This is the first small Phase G slice after PR #1992:

- Captures AGY 1.0.3 CLI capability evidence for `--conversation`, `--continue`, `--dangerously-skip-permissions`, and plugin support.
- Records that AGY still has no top-level `--model` flag and no ACP subcommand.
- Documents that `--conversation` is the right Cat Cafe resume primitive; `--continue` is latest-conversation sticky state and should not be used for our per-cat session chain.
- Adds an auth-required parser branch so AGY OAuth/onboarding stdout with exit 0 becomes a provider error instead of assistant text.
- Adds parser + GeminiAgentService regression tests to ensure the Google OAuth URL is not surfaced into the chat stream.

## Why

The CVO asked whether the newest `agy` can support the capabilities we need. The capability refresh found one production-relevant gap: isolated AGY profiles print the login URL to stdout and exit 0. Without this guardrail, Cat Cafe could treat onboarding text as model output. This PR does not close Phase G; it turns the recon into a safe next step.

## Original Requirements

> 看看最新的agy版本支持我们需要的那些能力了吗？
> 当前 help 显示已经新增了 --conversation、--continue、--dangerously-skip-permissions、plugin 等能力 这些都是干啥的？
> 那我们现在 能 让agy --resume了吗？ 应该是 --conversation？我们目前接了吗？没有的话得接一下 =你们的resume？

- Source: current F210 thread, CVO messages at 2026-05-31 08:06/08:08/08:13 UTC.
- Please check the diff against those questions: this PR should answer the CLI capability part and harden the auth failure mode, not claim Phase G is complete.

## Tradeoff

- This PR does not implement model/profile routing yet. AGY 1.0.3 still exposes no CLI model selector; Phase G profile routing needs a settings/HOME surface, not a fake `--model`.
- It does not use `--continue` for Cat Cafe resume because that would bind to AGY's latest local conversation rather than our stored per-thread UUID.
- It does not auto-login or copy the real HOME auth state into isolated profiles. The guardrail is fail-closed: each isolated profile must be onboarded explicitly.
- Auth detection is intentionally narrow and tied to AGY's leading diagnostic lines to avoid stripping model-authored discussion about authentication.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this is Antigravity CLI provider parsing plus F210 documentation. It adds no new store, queue, router, adapter, dispatcher, binding, architecture cell, or cross-provider API.

Please check:

- diff is consistent with `Map delta: none`
- auth-required detection is narrow enough and does not eat legitimate model text
- OAuth/login URLs are not leaked into chat output
- Phase G remains open; this PR should only advance AC-G1 recon and AC-G3-style preflight/error clarity

## Open Questions

### Technical OQ

1. Is `auth_required` the right error kind, or should it be folded into an existing provider setup/preflight class?
2. Is the paired interrupted-login pattern too broad, or narrow enough because it requires both `Waiting for authentication...` and `Error: authentication interrupted`?
3. Should the service-level regression assert only provider error text, or also exact `errorKind` once the stream event schema exposes it?

### Value OQ

None. Phase G model/profile routing decisions remain in F210 and do not need CVO escalation for this guardrail PR.

## Next Action

Please review the parser boundary and the F210 Phase G interpretation. If this passes, send it back for PR/cloud review and merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/sonnet`
- Start Command: `pnpm review:start`
- Ports: review sandbox allocates isolated ports; no frontend/browser verification is needed for this provider/parser documentation slice.

## Self-Check Evidence

### Spec Compliance

- AC-G1 recon: AGY 1.0.3 CLI capability state captured in `docs/features/assets/F210/agy-1.0.3-help.txt` and the Phase G refresh note.
- AC-G3 guardrail: unauthenticated AGY profile stdout is classified as provider setup/auth error, not model text.
- Phase G closeout remains open in the F210 spec; no model/profile routing is overclaimed.

### Test Results

```bash
pnpm --filter @cat-cafe/api build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/antigravity-cli-event-parser.test.js
# 11/11 pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-name-pattern='auth-required agy stdout' packages/api/test/gemini-agent-service.test.js
# 1/1 pass

pnpm --filter @cat-cafe/mcp-server build
# pass

pnpm --filter @cat-cafe/api test
# 12876 pass, 0 fail, 4 skipped

pnpm check
# All 19 checks passed

pnpm check:architecture-ownership
# exit 0; existing warning-only architecture debt, current diff OK

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# No fallback pattern changes detected

git diff --check origin/main...HEAD
# pass
```

### Root Artifact Gate

- `find . -maxdepth 1 \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' -o -name '*.mp4' -o -name '*.mov' -o -name '*.webm' -o -name '*.pdf' \) -print`: no output.
- `git diff --name-only origin/main...HEAD`: docs/assets/API source/tests/mailbox only; no root media/design artifacts.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity-cli-event-parser.ts`
- `packages/api/test/antigravity-cli-event-parser.test.js`
- `packages/api/test/gemini-agent-service.test.js`
- `docs/features/F210-antigravity-cli-migration.md`
- `docs/features/assets/F210/agy-1.0.3-help.txt`
- `docs/features/assets/F210/phase-g-agy-1.0.3-capability-refresh-2026-05-31.md`

[砚砚/gpt-5.5🐾]
