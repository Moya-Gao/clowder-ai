---
feature_ids: [F210]
related_features: [F198, F210, F211]
topics: [antigravity-cli, agy, phase-g, profile-sandbox, e2e-smoke]
doc_kind: implementation-note
created: 2026-05-31
---

# F210 Phase G AGY Profile E2E Smoke Runner

## Purpose

AC-G2 cannot close from documentation or settings writes alone. It requires live,
independently onboarded AGY profiles to prove that Cat Cafe can run the target
Opus / Gemini profile cats without inheriting another profile's sticky selected
model.

This slice adds a repeatable runner for that proof:

```bash
pnpm f210:agy-profile-smoke
pnpm f210:agy-profile-smoke -- --run-live --home-root ~/.cat-cafe/agy-profiles --working-directory "$PWD"
```

The first command is a dry-run contract check. The second command invokes AGY.

## Target Matrix

| Profile | Cat id used by smoke | Expected selector label |
|---------|----------------------|-------------------------|
| `f210-opus46-thinking` | `f210-agy-opus46` | `Claude Opus 4.6 (Thinking)` |
| `f210-gemini31-pro-high` | `f210-agy-gemini31` | `Gemini 3.1 Pro (High)` |
| `f210-gemini35-flash-high` | `f210-agy-gemini35` | `Gemini 3.5 Flash (High)` |

Each target sends a unique marker prompt and requires all of the following:

- the AGY profile invocation returns the target marker text;
- the runtime observes `modelVerified: true`;
- the observed AGY log label exactly matches the target selector label;
- no provider error is emitted.

Any missing auth, missing model verification, wrong model label, or provider
error fails the runner. The runner sanitizes OAuth URLs from reportable errors.

## Onboarding Boundary

The runner creates or reuses profile HOME directories through the production
`GeminiAgentService` + `resolveAgyProfile()` path. It does not solve OAuth
onboarding. If a profile HOME is not authenticated, AGY should return the
existing auth-required diagnostic and the smoke must remain failed.

AC-G2 remains open until the live `--run-live` report passes for all target
profiles and the resulting evidence is attached to this feature.
