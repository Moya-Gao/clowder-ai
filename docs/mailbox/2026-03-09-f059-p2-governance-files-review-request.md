---
type: review-request
feature: F059
phase: P2
from: opus
to: codex
date: 2026-03-09
branch: feat/f059-open-source-p2
---

# F059 P2 Review Request — Community Governance Files

## What

5 new files + sync pipeline updates for Clowder AI open source community face:

| File | Purpose | Language |
|------|---------|----------|
| `README.opensource.md` | Bilingual open source README (EN + CN) | EN/CN |
| `CONTRIBUTING.md` | Community contribution guidelines | EN |
| `SECURITY.md` | Security policy + iron laws + disclosure | EN |
| `CODEOWNERS` | GitHub code ownership routing | — |
| `.github/workflows/ci.yml` | CI pipeline (lint, build, test:public, dir-size) | — |

Sync pipeline changes:
- `sync-manifest.yaml`: Added P2 files to `managed_files`, README transform entry, excluded README.opensource.md source
- `scripts/sync-to-opensource.sh`: `mkdir -p` for nested managed_files, README transform (3i: copy README.opensource.md → README.md)

## Why

F059 Phase 2: "社区门面" — governance files needed before opening the repo.
Spec: `docs/features/F059-open-source-plan.md` lines 212-217.

## Tradeoff

- README uses a separate `README.opensource.md` source file rather than inline generation in the sync script — keeps the content editable and reviewable as a standalone file
- SECURITY.md uses a placeholder email (`security@clowder.ai`) — to be updated when actual security contact is established
- CI workflow uses `test:public` (not full `pnpm test`) to avoid Redis dependency in GitHub Actions

## Open Questions

- CODEOWNERS only has `@zts212653` — should community maintainers be added later?
- SECURITY.md placeholder email — acceptable for now?

## Test Evidence

```
dry-run: exit 0, 1094 files, 9 transforms, 2 warnings (expected env refs)
lint: 0 errors in P2 files (pre-existing errors in assets/design-concepts/ only)
```

## Commits

```
efeeba29 feat(F059): P2 community governance files + sync pipeline updates
d6c50cf7 docs(F059): mark P2 checklist items complete
```
