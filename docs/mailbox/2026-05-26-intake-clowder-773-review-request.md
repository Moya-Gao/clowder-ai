---
topics: [opensource-intake, runtime-config, desktop, review-request]
doc_kind: mailbox
created: 2026-05-26
---

# Review Request: intake clowder-ai#773

Review-Target-ID: intake-clowder-773
Branch: fix/intake-clowder-773
PR: cat-cafe#1906
Code commit under review: 2ba36497d4f5908c9aa0512ec6f63d30cc329a25
Intake Intent Issue: cat-cafe#1905
Source PR: clowder-ai#773
Source merge commit: 197b2857a7b2bb3f7f3288e374a49d81d3d27fd0

## What

- Absorbs clowder-ai#773 so template-only breeds no longer leak into runtime-resolved cats.
- Reuses a shared merge path for both `loadCatConfig()` and `getAcpConfig()` so ACP lookup cannot drift from runtime config resolution.
- Prunes template-only roster entries even when the runtime catalog exists with `breeds: []`.
- Stops desktop packaging/installer/service-manager from copying legacy `cat-config.json` into installed runtime state.
- Manual-ports `scripts/check-skills-manifest.mjs` to read handles from `cat-template.json`, including variant `catId`s.
- Adds focused regression coverage for duplicate `catId`, template-only breed leak, empty-catalog roster leak, and ACP leak.

## Why

`cat-template.json` is seed/menu data, not runtime truth. When `.cat-cafe/cat-catalog.json` exists, template-only breeds and their roster/ACP metadata must not survive deep merge into runtime state. Otherwise user-added cats can collide on `catId`, and router/reviewer matching can see phantom cats that the runtime catalog does not actually own.

## Original Requirements

> clowder-ai#772 已补标签：bug, triaged, accepted。
> 是不是可以merge 然后intake回家了？ @gpt52

- Source: current Cat Café A2A thread, Landy message at 2026-05-26 04:45 PT.
- Please check the diff against the above requirement: merge the accepted community bugfix, then actually run the intake flow back into cat-cafe instead of stopping at the open-source merge.

## Tradeoff

I did not delete home-repo `cat-config.json` itself in this intake. The source PR deletes it in clowder-ai, but the intake plan explicitly marks that file as `public-only` for now. This PR only removes legacy assumptions that desktop/runtime still need to package or copy it, while leaving a separate decision about the home repo file itself.

## Architecture Ownership

Architecture cell: identity-session
Map delta: none
Why: This changes runtime cat identity resolution and supporting bootstrap/packaging edges, but does not add a new store, queue, router, adapter, dispatcher, binding, or ownership boundary.

Please check:

- Diff matches `Map delta: none`.
- `mergeTemplateWithCatalog()` preserves template inheritance for catalog-owned breeds while filtering template-only runtime members.
- Empty-catalog bootstrap keeps `owner` / explicit catalog roster entries and prunes only template-only breed catIds.
- The `check-skills-manifest` manual-port preserves home behavior for roster handles, breed catIds, and variant catIds.

## Open Questions

### 技术 OQ（给 reviewer）

- Is `identity-session` the right ownership anchor for this mixed runtime-loader + desktop bootstrap slice, or do you want a narrower architecture note before merge?
- Do you see any home-only reason the desktop installer should still carry `cat-config.json`, despite runtime code no longer reading it?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review cat-cafe#1906 against cat-cafe#1905. If approved, I will record the intake as `absorbed` with `--intent-issue 1905 --absorb-pr 1906` and then try `--advance-ledger`.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-773/opus`
- Start Command: no service start needed; run the validation commands below.
- Ports: n/a (no web/api server; do not use 3001/3002/3011/3012/4111)

## 自检证据

### Spec 合规

- Intake Intent Issue: `cat-cafe#1905`
- Diff stays within the 7 absorbed files from the issue table; `cat-config.json` remains skipped as `public-only`.
- `bash scripts/intake-from-opensource.sh --pr 773 --mode=plan` classified: 6 safe-cherry-pick, 1 manual-port, 1 public-only.
- `bash scripts/intake-from-opensource.sh --validate-inbound` passed with no brand violations.
- Root artifact gate: no root-level media/design artifacts in worktree status or `main...HEAD` diff.

### 测试结果

```bash
cd packages/api
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/cat-config-loader.test.js
# 85 passed, 0 failed

cd ../..
node scripts/check-skills-manifest.mjs
# PASS check-skills-manifest: 41 skills validated
# WARN: 5 pre-existing advisory requires_mcp entries

git diff --check main...HEAD
# passed

pnpm lint
# passed

pnpm check
# passed
```

### 相关文档

- Intake Intent Issue: `cat-cafe#1905`
- Absorb PR: `cat-cafe#1906`
- Mailbox: `docs/mailbox/2026-05-26-intake-clowder-773-review-request.md`

[砚砚/GPT-5.4🐾]
