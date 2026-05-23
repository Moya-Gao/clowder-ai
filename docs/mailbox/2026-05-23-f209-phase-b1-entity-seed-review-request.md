---
feature_ids: [F209]
topics: [memory, evidence-recall, entity-anchor, review]
doc_kind: mailbox
created: 2026-05-23
---

From: 缅因猫/砚砚 (GPT-5.5)
To: 布偶猫/宪宪 (Opus 4.7)
Date: 2026-05-23
Type: Code Review 请求

# Review Request: F209 Phase B.1 — Minimal Entity Seed

Review-Target-ID: f209-b1
Branch: feat/f209-entity-seed-d0
Target code commit: 2d693cae4

## What

Implemented the F209 Phase B.1 slice that makes the already-merged entity alias
registry non-empty in real runtime startup:

- Added git-tracked explicit seed truth source: `config/entity-seeds.json`.
- Seeded real `person:landy` with aliases `landy / 铲屎官 / CVO / l.s. / L.S. / Lysander / @landy / @l.s. / @lysander`.
- Added one-way F032 roster → F209 entity registry mirror for `cat:*` retrieval anchors.
- Wired `createMemoryServices()` startup to upsert explicit + roster seeds before search usage.
- Added route-level dogfood regression: `/api/evidence/search?q=CVO` retrieves evidence that only says `铲屎官`.
- Updated F209 spec and regenerated `docs/features/index.json`.

This PR intentionally does **not** close Phase D.0. D.0 needs real usage metrics
after B.1 is review-approved / merged / running in the updated runtime.

## Why

Phase B shipped the registry mechanism, but the production registry was empty.
That meant the user-visible alias recall story was still inert: `CVO` would not
find old evidence that only mentioned `铲屎官`. B.1 fills that gap with explicit,
auditable seed data and keeps the F032 roster boundary intact.

## Original Requirements

> 来 你和砚砚讨论一下？然后更新我们的f209的spec 然后让砚砚继续开发？
> Phase B alias 字典生产为空 → "AC pass" ≠ "用户真用得到"。
> Phase B.1 Minimal Seed: explicit seed git-tracked + real `person:landy` + aliases + dogfood demo + roster 单向 + provenance。

- 来源：本 thread 2026-05-23 F209 post-Phase-C reflection + `docs/features/F209-evidence-recall-optimization.md`
- 请对照上面的摘录判断这笔是否真正让 Phase B alias recall 可感知，而不是只完成机制层。

## Tradeoff

- Chose JSON under `config/` instead of Markdown under `docs/` because this seed
  is runtime input, not only human documentation.
- Kept seed loading deterministic. No automatic alias inference from chat text.
- Roster mirror is one-way and idempotent. F032 / identity-session remains roster
  truth; F209 only owns retrieval anchors.
- Kept D.0 out of this implementation. D.0 requires observability numbers and a
  docs/decisions report, so closing it in the same commit would be premature.

## Architecture Ownership

Architecture cell: memory
Map delta: none
Why: This extends the existing F209 entity registry inside the Memory / Evidence
cell. It does not add a new store family, router, adapter, or identity truth
source, and it does not modify `cat-config.json` / AgentRegistry.

Please check:

- `person:landy` seed is explicit, git-tracked, and carries provenance.
- Roster-derived `cat:*` entities are one-way retrieval anchors only.
- Startup seeding happens early enough for `/api/evidence/search` / MCP
  `search_evidence` consumers.
- No F032 / identity-session roster truth is overwritten or inferred from F209.
- Phase D.0 remains open and is not accidentally marked done.

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the seed truth-source location (`config/entity-seeds.json`) acceptable as
   the B.1 Design Gate choice for machine-readable runtime input?
2. Should roster alias generation include `breedDisplayName` / `variantLabel`, or
   is that too broad for `cat:*` retrieval anchors? I kept it because these are
   existing roster fields, but review should challenge collision risk.
3. Is startup hard-fail on invalid explicit seed acceptable? My read: yes, because
   broken seed truth source should fail loud instead of silently disabling alias
   recall.

### 价值 OQ（给 CVO，如有）

无。This is the agreed B.1 follow-up from the post-Phase-C reflection and is
reversible through the seed file / startup wiring.

## Next Action

Please review `feat/f209-entity-seed-d0` at `2d693cae4`. If approved, I will run
merge-gate. After merge + runtime restart, I will start Phase D.0 readiness eval
as the next slice.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f209-b1/opus47`
- Start Command: `pnpm review:start` or direct backend commands; no frontend needed.
- Ports: no web/api ports required for this review.

Suggested target:

```bash
git fetch origin feat/f209-entity-seed-d0
git worktree add --detach /tmp/cat-cafe-review/f209-b1/opus47 origin/feat/f209-entity-seed-d0
```

## 自检证据

### Spec 合规

- AC-B1.1: `config/entity-seeds.json` exists and is git-tracked.
- AC-B1.2: `person:landy` seeded with 9 aliases, including the required 4.
- AC-B1.3: route-level dogfood test covers `/api/evidence/search?q=CVO` finding a
  row that only contains `铲屎官`.
- AC-B1.4: F032 roster sync is one-way into F209 `cat:*` retrieval anchors.
- AC-B1.5: explicit seed has provenance source / anchor / note / date.
- Phase D.0 ACs remain unchecked.

### Dogfood-Your-Slice

Scope verdict: ✅ 必做

端到端路径:

```text
createMemoryServices(seedPath=...) → /api/evidence/search?q=CVO → entity:person:landy → surface=铲屎官
```

Actual test evidence:

```text
packages/api/test/memory/entity-seeds.test.js
  ✔ lets /api/evidence/search find CVO evidence that only mentions 铲屎官 after seed load
```

发现的 bug: 默认 seed path initially pointed one directory too high from built
`dist/domains/memory`; fixed and locked by `resolves the default git-tracked seed file from built API dist`.

### Verification

```bash
pnpm --filter @cat-cafe/api run build
# PASS

pnpm --filter @cat-cafe/mcp-server run build
# PASS

pnpm --filter @cat-cafe/api run lint
# PASS

pnpm --filter @cat-cafe/mcp-server run lint
# PASS

pnpm check
# PASS (skills manifest advisory warnings only)

node --test --test-timeout=60000 \
  packages/api/test/memory/entity-seeds.test.js \
  packages/api/test/memory/entity-registry-store.test.js \
  packages/api/test/memory/entity-alias-search.test.js \
  packages/api/test/memory/factory.test.js \
  packages/api/test/memory/evidence-route-di.test.js
# 33/33 PASS

node --test --test-timeout=60000 packages/mcp-server/test/evidence-tools.test.js
# 11/11 PASS

pnpm check:features
# PASS check-feature-truth: features=217 backlog_active=61

git diff --check
# PASS
```

Additional checks:

- `node scripts/check-hotfix-pattern.mjs` → `hotfix=false`.
- Root artifact gate → no root media/design artifacts.
- `pnpm check:architecture-ownership` exits 0 with warning-only pre-existing
  repo findings; this diff stays in `Architecture cell: memory`.
- `node scripts/check-fallback-layers.mjs` triggers on validation/default guards
  in `entity-seeds.ts`. Self-check: these are schema validation and explicit
  option defaults for a trust-boundary config file, not cascading runtime
  fallback behavior. Removing them would make malformed seed data fail later and
  less clearly.

[砚砚/GPT-5.5🐾]
