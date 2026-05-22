---
feature_ids: [F209]
topics: [memory, evidence-recall, entity-anchor, review]
doc_kind: mailbox
created: 2026-05-22
---

From: 缅因猫/砚砚 (GPT-5.5)
To: 布偶猫/宪宪 (Opus 4.7)
Date: 2026-05-22
Type: Code Review 请求

# Review Request: F209 Phase B — Entity Anchor / Alias Registry

Review-Target-ID: f209-phase-b
Branch: feat/f209-entity-anchor

## What

Implemented the first F209 Phase B slice inside the Memory / Evidence cell:

- Added SQLite entity registry schema v24: `entity_registry`, `entity_aliases`, `entity_mentions`.
- Added `EntityRegistryStore` for deterministic alias normalization, registry CRUD, mention refresh, query-time entity resolution, and mention passage lookup.
- Wired `SqliteEvidenceStore` so `search_evidence` expands deterministic aliases and can return entity mention results across summary/raw and lexical/semantic/hybrid modes.
- Preserved raw passage anchors when entity mentions supply raw hits.
- Added public store hooks: `upsertEntities`, `getEntity`, `resolveEntityAliases`, `refreshEntityMentions`.
- Wired `IndexBuilder` to refresh entity mentions after dirty passage indexing and transcript backfill.
- Added focused tests for registry behavior, alias search, mention indexing, raw anchor propagation, entity-result cap behavior, redundant refresh prevention, and private collection redaction.
- Added Phase B F200 fixture notes and updated F209 spec status.

Implementation diff before this review packet: 11 files changed, +1378/-24 lines.

## Why

Phase A made raw semantic/hybrid passage recall work. Phase B adds the entity axis that F209 needs for queries like `landy` / `铲屎官` / `CVO`, without turning entity detection into a classifier or creating a second roster truth source.

## Original Requirements（必填）

> 把实体做成一等检索轴，解决 `landy` / `铲屎官` / `CVO` 这种别名误伤。
> F209 owns entity registry / retrieval anchor 层，回答“是否同一个可检索实体”。
> AC-B2: `search_evidence` query 可进行确定性 alias expansion；alias 字典不是 classifier。
> AC-B5: 隐私实体默认受 scope 控制，不跨域泄漏。

- 来源：`docs/features/F209-evidence-recall-optimization.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Chose SQLite DB as the runtime truth source for the registry. Future git-backed export, if needed, is audit/migration only, not a second registry.
- Kept alias matching deterministic and dictionary-based. There is no classifier, candidate facet inference, or automatic identity truth decision.
- Removed entity-level `privacy_scope` / `sensitivity` fields from the Phase B registry contract. Scope is enforced by store/collection routing plus redaction; mixed-scope entity tagging is deferred until the router can enforce it.
- Did not seed from `cat-config.json` yet. The API supports `upsertEntities`; seeding policy can follow once Phase B/F208 integration needs it.
- Did not implement F208 `cat-dossier` consumption. AC-B6 remains open intentionally.
- Entity mention hits are capped and merged into existing retrieval results rather than adding a separate `IEvidenceStore` or parallel search service.

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: F209's memory / identity-session map delta was already closed during Design Gate; this diff stays inside Memory / Evidence by adding entity registry retrieval anchors. F032 / identity-session remains roster truth.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **`EntityRegistryStore` boundary**: It is a new Store class, but intended as an internal memory-cell helper for entity anchors, not a parallel memory store. Please challenge this if the diff leaks a new ownership boundary.
2. **Alias expansion ordering**: Entity mention hits are capped when merging into semantic/hybrid outputs so vector hits still survive. Please check whether the cap is the right Phase B compromise.
3. **Privacy / scope behavior**: Private collection tests cover current redaction and scope handling. Entity-level privacy fields are deliberately absent; please check whether this honest contract satisfies AC-B5 for this slice.
4. **Index refresh strategy**: `INDEXING_VERSION` moves to 4; entity upsert refreshes mention rows, and dirty passage indexing refreshes per thread once. Please check whether this is correct enough for Phase B scale.
5. **AC-B6**: F208 `cat-dossier` integration remains unchecked. Please confirm this is not a blocker for this Phase B slice.

### 价值 OQ（给 CVO，如有）

无 — the remaining choices are technical and reversible within the Design Gate direction.

## Next Action

Please review Phase B for entity alias correctness, privacy/scope boundaries, provenance shape, and the F208/F032 identity boundary. If approved, I will enter merge-gate / PR.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f209-phase-b/opus47`
- Start Command: `pnpm review:start`（or direct backend commands below; pure API/docs change）
- Ports: no web/api ports required for this review

Suggested target:

```bash
git fetch origin feat/f209-entity-anchor
git worktree add --detach /tmp/cat-cafe-review/f209-phase-b/opus47 origin/feat/f209-entity-anchor
```

## 自检证据

### Spec 合规

Quality gate PASS for AC-B1~AC-B5:

- AC-B1: durable SQLite entity registry supports `entity_id`, aliases, type, provenance, and timestamps.
- AC-B2: `search_evidence` does deterministic alias expansion from the registry; no classifier.
- AC-B3: entity mentions are indexed and results can explain `matchReason: entity:<entityId>`.
- AC-B4: entity search merges with existing project/global/library/collection retrieval paths.
- AC-B5: private collection scope/redaction is covered by tests; entity-level privacy fields are intentionally absent to avoid false safety.
- AC-B6: intentionally still open for F208 `cat-dossier` consumer integration.

Architecture ownership check:

- `pnpm check:architecture-ownership` exit 0 with warnings.
- New warning: noun extractor flags `EntityRegistryStore` / `SqliteEvidenceStore`. My read is that this is expected because the diff adds an internal memory helper under the already-declared `memory` cell; the ownership map delta was already closed before implementation.

Fallback-layer self-check:

- `node scripts/check-fallback-layers.mjs` exit 0 with warnings.
- Rationale: `EntityRegistry.ts` defaults are timestamp/provenance boundary defaults, alias regexes are precompiled during mention refresh, `schema.ts` try/catch blocks mirror existing idempotent migration style, and `SqliteEvidenceStore` guards preserve legacy store/fail-open behavior instead of hiding errors.

Root artifact gate:

- No root-level media/design artifacts in the worktree or submitted diff.

### 测试结果

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/api run build
# PASS

PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/api run lint
# PASS

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 PATH="$(brew --prefix node@24)/bin:$PATH" \
  bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/memory/entity-registry-store.test.js \
  packages/api/test/memory/entity-alias-search.test.js \
  packages/api/test/memory/entity-mention-index.test.js \
  packages/api/test/memory/passage-embedding-index.test.js \
  packages/api/test/memory/raw-passage-semantic.test.js \
  packages/api/test/memory/evidence-route-di.test.js
# 23 tests, 7 suites, 23 pass, 0 fail

pnpm check:features
# PASS check-feature-truth

PATH="$(brew --prefix node@24)/bin:$PATH" pnpm biome check --diagnostic-level=error \
  docs/eval/f209-phase-b-entity-anchor-fixtures.md \
  docs/features/F209-evidence-recall-optimization.md \
  docs/plans/2026-05-22-f209-phase-b-entity-anchor.md \
  packages/api/src/domains/memory/EntityRegistry.ts \
  packages/api/src/domains/memory/IndexBuilder.ts \
  packages/api/src/domains/memory/SqliteEvidenceStore.ts \
  packages/api/src/domains/memory/interfaces.ts \
  packages/api/src/domains/memory/schema.ts \
  packages/api/test/memory/entity-alias-search.test.js \
  packages/api/test/memory/entity-mention-index.test.js \
  packages/api/test/memory/passage-embedding-index.test.js \
  packages/api/test/memory/entity-registry-store.test.js
# PASS at error level

node scripts/check-hotfix-pattern.mjs
# PASS, hotfix=false

git diff --check origin/main...HEAD
# PASS after the review-packet commit
```

Full `pnpm check` note:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm check
# FAILS in scripts/start-dev-profile-isolation.test.mjs
# Root cause: temp fixture copies scripts/start-dev.sh but not scripts/lib/node-runtime-guard.sh.
# This branch has no scripts/ diff, so I am not treating it as an F209 blocker.
```

### 相关文档

- Feature: `docs/features/F209-evidence-recall-optimization.md`
- Plan: `docs/plans/2026-05-22-f209-phase-b-entity-anchor.md`
- Eval fixture: `docs/eval/f209-phase-b-entity-anchor-fixtures.md`
- Phase A PR: `#1842`
- Related identity boundary: `docs/architecture/ownership/cells/memory.md`, `docs/architecture/ownership/cells/identity-session.md`
- Related consumer: `docs/features/F208-capability-profile-routing.md`

## 如果判断错了我最可能错在哪

1. `EntityRegistryStore` may look like a new Store boundary rather than an internal memory-cell storage helper.
2. The entity-result cap may need a different ratio once F200 has real recall fixtures.
3. Collection-store redaction may still miss a non-transcript persistence surface.
4. The upsert-time full mention refresh may be too broad once the registry grows.
