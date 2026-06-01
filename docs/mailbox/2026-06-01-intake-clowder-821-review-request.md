---
topics: [opensource-intake, owner-gate, security, review-request]
doc_kind: mailbox
created: 2026-06-01
---

# Review Request: intake clowder-ai#821

Review-Target-ID: intake-clowder-821-owner-gate
Branch: fix/intake-clowder-821
PR: cat-cafe#2024
Code commit under review: 877329fe8 (implementation commit; this mailbox file is a docs-only follow-up)
Intake Intent Issue: cat-cafe#2023
Source PR: clowder-ai#821
Source merge commit: d6f4cba123f5d4a5b18726a993c299fed247505b

## What

- Absorbs the accepted clowder-ai#821 owner-gate fix into Cat Cafe.
- Adds unified `resolveOwnerGate()`.
- Allows localhost single-user owner-gated operations when `DEFAULT_OWNER_USER_ID` is unset.
- Preserves LAN/Tailscale/proxy fail-closed behavior for privileged writes with `isDirectLoopbackRequest()`.
- Ports public setup guidance into `SETUP.opensource.md` and updates `docs/env-reference.md`.

## Why

The upstream bug made local single-user deployments return 403 for normal console operations when `DEFAULT_OWNER_USER_ID` was unset. The accepted fix must come home, but this is an auth/security surface, so the route files were treated as high-risk manual-port/manual-merge in cat-cafe#2023.

## Original Requirements

> 那是不是可以merge 然后走intake 流程回来了？
> 如果可以，注意！！！一定要按照sop 走流程回家
> 记得一定要好好看看intake skills

- Source: current Cat Cafe A2A thread, Landy message at 2026-06-01 09:23 UTC.
- Please review against the requirement: merge the approved third-party PR only if safe, then follow inbound intake SOP carefully.

## Tradeoff

I ported `SETUP.md` changes to `SETUP.opensource.md` instead of copying generated public files back. I also included a documented formatting-only exception for `packages/web/src/app/story-export/grep-hippocampus/*` because current `origin/main` failed `pnpm check` on those two files before this intake.

## Architecture Ownership

Architecture cell: existing API route/auth guard surface; no new ownership cell.
Map delta: none
Why: This changes guard implementation and route call sites, but does not introduce a new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please check:

- `resolveOwnerGate()` is the single owner-gate truth source and does not become a network-auth substitute.
- Every ownerless privileged write reachable from LAN/proxy has an independent direct-loopback guard or remains direct-localhost-only.
- `SETUP.opensource.md` and `docs/env-reference.md` accurately document localhost vs LAN/remote owner requirements.
- The story-export files are formatting-only and do not hide unrelated behavior.
- PR final file set matches cat-cafe#2023 plus its explicit exceptions.

## Open Questions

### 技术 OQ（给 reviewer）

- Is the split between `resolveOwnerGate()` and `isDirectLoopbackRequest()` strict enough across all changed route surfaces?
- Should `docs/env-reference.md` be enough for home-facing docs, or do you want another internal doc anchor for this owner-gate mode?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review cat-cafe#2024 against cat-cafe#2023. If approved, leave a GitHub PR comment that explicitly covers the current PR HEAD SHA. I will then run:

```bash
bash scripts/intake-from-opensource.sh --record --pr 821 --decision absorbed --intent-issue 2023 --absorb-pr 2024 --review-proof <review-url>
bash scripts/intake-from-opensource.sh --advance-ledger
```

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-821-owner-gate/opus`
- Start Command: no service start required for the mandatory checks; use `pnpm review:start` only if inspecting runtime behavior.
- Ports: n/a for required checks; do not use 3001/3002 as current-branch evidence.

## Quality Gate Report

### Spec 合规

- clowder-ai#821 merged: yes, squash merge `d6f4cba123f5d4a5b18726a993c299fed247505b`.
- Intake plan run: yes, 13 safe files, 9 high-risk files, 2 public-only files.
- Intake Intent Issue: cat-cafe#2023 with per-file decisions and explicit exceptions.
- High-risk files: route/auth/config files upgraded to manual-port/manual-merge with preserve proof in cat-cafe#2023.

### Validation

```bash
bash scripts/intake-from-opensource.sh --pr 821 --mode=plan
```

```bash
bash scripts/intake-from-opensource.sh --validate-inbound
bash scripts/intake-from-opensource.sh --validate-inbound --from-index
```

```bash
pnpm --filter @cat-cafe/api run build
```

```bash
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 \
  test/default-cat-config.test.js \
  test/owner-gate-single-user.test.js \
  test/sensitive-env-write.test.js \
  test/connector-hub-route.test.js \
  test/plugin-manifest-safety.test.js \
  test/skills-owner-gate.test.js \
  test/callback-auth-debug-route.test.js \
  test/config-secrets.test.js \
  test/push-routes.test.js
```

Result: 235/235 pass.

```bash
pnpm check
```

Result: 20/20 checks pass.

## Root Artifact Gate

No root media/design artifacts added.
