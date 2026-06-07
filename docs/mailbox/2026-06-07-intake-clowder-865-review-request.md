---
topics: [opensource-intake, service-lifecycle, macos-python]
source: clowder-ai#865
target_pr: cat-cafe#2135
intent_issue: cat-cafe#2133
author: codex
reviewer: opus
date: 2026-06-07
---

@opus

## Review Request: intake clowder-ai#865

Review-Target-ID: fix-intake-clowder-865
Branch: fix/intake-clowder-865
PR: https://github.com/zts212653/cat-cafe/pull/2135
Intent Issue: https://github.com/zts212653/cat-cafe/issues/2133

### What

Absorbed clowder-ai#865 into Cat Cafe:

- `packages/api/src/domains/services/service-lifecycle.ts`
  - lowercases only the executable basename before applying the existing Python executable regex.
- `packages/api/test/services-lifecycle-route.test.js`
  - adds macOS `Python.app/.../MacOS/Python` coverage for `embedding-model`;
  - keeps the wrong-script-path negative case false.

### Why

clowder-ai#864 showed a real macOS runtime shape where Homebrew framework Python appears in `ps` with uppercase basename `Python`. The old matcher rejected that executable before checking the exact managed `embed-api.py` path, so an API-owned embedding listener could be classified as foreign after restart/reconciliation.

Original request from current thread:

> 之前在issue守门的你看过这个 https://github.com/zts212653/clowder-ai/pull/865 也aaprove过了，你看看要不要merge 然后intake回来？

Source issue acceptance:

> accepted as a bug; make only the Python executable basename match case-insensitive; keep exact runtime script identity checks unchanged.

### Tradeoff

I kept this as a safe-cherry-pick intake, not a broader lifecycle refactor. The matcher still requires exact managed runtime script identity, so arbitrary Python commands and wrong script paths stay non-owned.

### Open Questions

Technical:

- Please verify PR #2135 covers every `absorb` row in cat-cafe#2133 and does not expand beyond clowder-ai#865.
- Please check the fallback-layer self-check: the script flags cumulative existing layers in `service-lifecycle.ts`, but this diff has net fallback change `+0` and keeps the existing `executable ?? ''` coordinate while adding a basename case normalization.

Value:

- None. This is an accepted bugfix intake, not a new product surface.

### Architecture Ownership

- Architecture cell: plugin
- Map delta: none
- Why: this extends existing service lifecycle process ownership matching; it does not add a Store, Queue, Router, Adapter, Dispatcher, Binding, or new ownership boundary.
- Mechanical check: `pnpm check:architecture-ownership` exited 0; existing unrelated warnings remain, diff architecture nouns OK.

### Quality Gate

Intent/spec:

- `bash scripts/intake-from-opensource.sh --pr 865 --mode=plan`
  - `safe-cherry-pick (2 files)`
  - `packages/api/src/domains/services/service-lifecycle.ts`
  - `packages/api/test/services-lifecycle-route.test.js`

Verification:

```bash
pnpm --dir packages/api run build
# pass

pnpm biome check packages/api/src/domains/services/service-lifecycle.ts packages/api/test/services-lifecycle-route.test.js --diagnostic-level=error
# pass, 2 files checked

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/services-lifecycle-route.test.js
# pass, 69/69

bash scripts/intake-from-opensource.sh --validate-inbound --from-index
# pass, no brand violations

git diff --check --cached
# pass
```

Additional quality-gate checks:

- `node scripts/check-hotfix-pattern.mjs` -> `hotfix:false`
- `node scripts/check-fallback-layers.mjs` -> cumulative self-check triggered; net fallback change `+0`
- root media/design artifact hygiene -> no matches
- design `.pen` glob for this backend slice -> no matches
- Dogfood: exempt; pure backend ownership matcher bugfix, no user-facing UI/API flow beyond the tested service lifecycle path.

### Next Action

Please review cat-cafe#2135 against cat-cafe#2133. If approved, leave formal GitHub review proof on PR #2135 so I can run:

```bash
bash scripts/intake-from-opensource.sh --record --pr 865 --decision absorbed --intent-issue 2133 --absorb-pr 2135 --review-proof <review-url>
bash scripts/intake-from-opensource.sh --advance-ledger
```

[砚砚/GPT-5.5🐾]
