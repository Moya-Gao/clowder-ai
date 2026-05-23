---
feature_ids: [F210]
topics: [antigravity-cli, agy, e2e, smoke, wiring]
doc_kind: evidence
created: 2026-05-23
---

# F210 Phase E E2E Smoke

## Scope

Phase E verifies that the Phase B/C/D `antigravity-cli` path works through the Cat Cafe routing layer, not only as a direct service unit smoke.

## Local AGY Setup

- Installed `agy 1.0.1` from the official bootstrapper into `/tmp/cat-cafe-f210-agy-bin/agy` for this smoke.
- The installer appended profile PATH lines even with `--dir`; those exact `/tmp/cat-cafe-f210-agy-bin` lines were removed from `.zshrc`, `.zprofile`, `.bashrc`, and `.bash_profile`.
- The live smoke used process-local `PATH=/tmp/cat-cafe-f210-agy-bin:$PATH`, so the repo does not depend on a global `agy` install.
- Runtime env included `GEMINI_ADAPTER=antigravity-cli`, `AGY_CLI_DISABLE_AUTO_UPDATE=1`, and `CLI_TIMEOUT_MS=120000`.

## Hermetic Wiring Coverage

`packages/api/test/integration/wiring.test.js` now covers both Google carrier routes:

- explicit/default `gemini-cli` fallback still spawns `gemini`, requests `-o stream-json`, and does not use `--print`.
- env-selected `antigravity-cli` routes `@gemini` through `agy --print`, binds `--add-dir`, does not pass an unverified `--model`, and surfaces plain-text stdout.

## Live Cat Cafe Route Smoke

One-off smoke used the Cat Cafe routing layer with a real `GeminiAgentService({ catId: "gemini" })` and routed:

```text
@gemini Reply with one short sentence ending with CAT_CAFE_AGY_E2E_OK.
```

Observed result:

| Field | Value |
|-------|-------|
| ok | true |
| duration | about 14.3s |
| final marker | `CAT_CAFE_AGY_E2E_OK` |
| command path | `agy --print` via `GEMINI_ADAPTER=antigravity-cli` |
| model metadata | `account-selected (antigravity-cli)`, `modelVerified: false` |
| warning leakage | false after parser fix |

## Live Finding

When Cat Cafe creates a new `agy-*` conversation id, AGY may print:

```text
Warning: conversation "agy-..." not found.
```

before the successful answer. This is an infrastructure warning for the first use of a generated conversation id, not assistant content. `antigravity-cli-event-parser.ts` now strips that exact leading warning before surfacing final text, with a regression test in `packages/api/test/antigravity-cli-event-parser.test.js`.

## Default Switch

Phase E proves the opt-in route is usable. It does not flip the default adapter: `gemini-cli` remains the default until AC-E4/Phase F review explicitly changes it.
