---
topics: [opensource-ops, governance, F070, clowder-ai]
source: clowder-ai#887
author: codex
reviewer: opus
date: 2026-06-10
---

@opus

## Review Request: clowder-ai#887 governance port wording

Review-Target-ID: fix-887-governance-external-ports
Branch: fix/887-governance-external-ports
Commit: 9bfe24171
Issue: https://github.com/zts212653/clowder-ai/issues/887

### What

Fixed F070 governance pack port wording so Cat Cafe self-context and external-project bootstrap no longer share the same semantics:

- `getGovernanceManagedBlock(provider)` remains self-context by default for existing callers.
- `getGovernanceManagedBlock(provider, 'external')` now emits reserved/avoidance wording for Cat Cafe runtime ports.
- `computePackChecksum()` gained the same context parameter so registry checksums track the actual injected block semantics.
- `GovernanceBootstrapService` now writes and registers the external-context block for external projects.
- `GOVERNANCE_PACK_VERSION` bumped `1.4.0 -> 1.4.1`.
- Added pack-level and bootstrap-level regression tests.

### Why

clowder-ai#887 reports that external projects receive governance text telling their agents to use Cat Cafe's frontend/API ports, causing direct local dev-server collisions. I rechecked the issue, current comments, F070 spec, and commit `3497d1a9`; the report is accurate. `3497d1a9` changed external-project wording from reservation/avoidance to runtime-default usage, and later changes only fixed values/env sourcing.

### Original Requirements

From clowder-ai#887:

> External project governance block should say something like:
> **Cat Cafe runtime ports**: frontend 3003 and API 3004 are reserved by Cat Cafe. Avoid using these ports for this project's dev servers.
> Add a `context: 'self' | 'external'` parameter to `getGovernanceManagedBlock()`.

Source: https://github.com/zts212653/clowder-ai/issues/887

Please verify this diff solves the reporter's expected behavior without rewriting broader F070 governance.

### Tradeoff

I kept the scope to governance pack wording/contract. I did not rewrite Redis wording, preflight health logic, or the sync sanitizer. The self-context default is backward compatible; only explicit external callers get avoidance wording. The registry checksum now takes context because bootstrap otherwise would record a checksum for the wrong semantic block.

### Open Questions

Technical:

- Is `self` as the default parameter the right compatibility choice, or should every caller be forced to pass context explicitly?
- Is `computePackChecksum('external')` enough for bootstrap registry semantics, given existing health checks still compare version only?
- Fallback layer check flags the four `??` env defaults in `governance-pack.ts`; these are existing env fallbacks moved into `getRuntimePorts()` with net +0 fallback change. Please confirm this is not over-defensive.

Value:

- None. This is an accepted community bugfix with low rollback cost and no roadmap/product choice.

### Architecture Ownership

Architecture cell: `dispatch` (closest existing cell; F070 governance pack remains the feature truth source)
Map delta: none
Why: this changes existing governance-pack content generation and bootstrap call-site semantics; it does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, owner boundary, extension point, or canonical anchor.

Please check that `Map delta: none` is defensible despite F070 not having a dedicated ownership cell.

### Quality Gate

Spec alignment:

- F070 says external projects are independent execution planes that receive Cat Cafe methodology and hard constraints, including port reservations.
- #887 expected external wording is avoidance/reservation, not "use Cat Cafe ports".
- Bootstrap-level test proves real external project files receive external-context text.

Dogfood:

- Scope verdict: exempt. This is pure internal governance text generation; no browser/UI or live runtime path. The bootstrap regression test is the end-to-end slice for this behavior.

Fallback self-check:

- `node scripts/check-fallback-layers.mjs` triggered on `governance-pack.ts`.
- Net fallback change: `+0`; the four `??` env defaults already existed and were moved into `getRuntimePorts()`.
- Why kept: governance pack is env-sensitive by existing contract; removing defaults would break source/open-source defaults and test determinism.

Verification:

```bash
# RED: expected failures before implementation
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  test/governance/governance-pack.test.js test/governance/governance-bootstrap.test.js
# failed 3/31 on external context + checksum assertions

# GREEN focused, after implementation
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  test/governance/governance-pack.test.js test/governance/governance-bootstrap.test.js
# pass: 31/31

# Post-rebase focused
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  test/governance/governance-pack.test.js test/governance/governance-bootstrap.test.js
# pass: 31/31

pnpm check
# pass: All 22 checks

pnpm lint
# exit 0; existing web warnings only

pnpm -r --if-present run build
# exit 0; existing web warnings only

(cd packages/api && pnpm test)
# pass: tests 14302, pass 14295, fail 0, skipped 7

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# triggered self-check; net fallback change +0, explanation above

git diff --check origin/main...HEAD
# pass
```

### Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-887-governance-external-ports/opus`
- Start Command: `pnpm review:start` if you need a service, but this change should be reviewable with source + tests only.
- Ports: not used by this review; do not use runtime `3001/3002`.

### Next Action

Please review commit `9bfe24171` plus this request packet. Focus on:

- self/external wording contract;
- bootstrap using external context;
- checksum context semantics;
- whether version bump `1.4.1` is sufficient.

If approved, pass back to me for merge-gate / outbound issue follow-up.

[砚砚/GPT-5.5🐾]
