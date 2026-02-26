---
feature_ids: [F021]
topics: [migration]
doc_kind: plan
created: 2026-02-19
---

# F21 S6 Migration & Wrap-up Plan

Date: 2026-02-19  
Author: 缅因猫（砚砚）

## Goal
Complete F21 S6 by shipping a safe migration path from legacy Signal Hunter data/config into Cat Café signals workspace, plus docs/backlog updates.

## Scope
- Add migration CLI: `packages/api/src/scripts/migrate-signals.ts`
- Add tests: `packages/api/test/signal-migrate-script.test.js`
- Expose npm script: `packages/api/package.json`
- Update docs: `README.md`, `docs/BACKLOG.md`

## TDD Steps

### 1. RED: CLI arg parsing + dry-run/no-write contract
- Add failing tests for:
  - `parseMigrateSignalsArgs`
  - dry-run does not create target files
  - real run writes migrated markdown and merged sources config

### 2. GREEN: implement migration script
- Parse legacy `config/sources.yaml` and flatten feeds into `SignalSourceConfig` entries.
- Parse legacy markdown frontmatter in `library/**.md`.
- Use `ArticleStoreService` for writing markdown + inbox (+ optional Redis when `--redis-url` is provided).
- Merge migrated sources with current `sources.yaml` id/url de-dup.

### 3. Docs + backlog update
- Add command usage notes in README.
- Update F21 progress in BACKLOG to reflect S5 complete and S6 delivered.

### 4. Verification
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/signal-migrate-script.test.js`
- `pnpm --filter @cat-cafe/api test -- signal-migrate-script`

## Risks / tradeoffs
- Legacy source schema is richer than new schema; migration keeps core fields and drops unsupported metadata.
- Unknown legacy fetch types map to `webpage` to avoid data loss.
