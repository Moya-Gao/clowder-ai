---
topics: [opensource-intake, dependencies, image-export, review-request]
doc_kind: mailbox
created: 2026-05-31
---

# Review Request: intake clowder-ai#818

Review-Target-ID: intake-clowder-818-dep-audit
Branch: intake/clowder-818-dep-audit
PR: cat-cafe#1990
Code commit under review: b7f3214a6 (implementation commit; this mailbox file is a docs-only follow-up)
Intake Intent Issue: cat-cafe#1988
Source PR: clowder-ai#818
Source merge commit: 8c049c031235246f7a1dd3c204614dbcc25d36b5

## What

- Absorbs the accepted clowder-ai#818 dependency audit cleanup into Cat Cafe.
- Removes unused/deprecated root/API/web dependencies.
- Migrates `ImageExporter` from `puppeteer` to `puppeteer-core` with explicit `CHROME_EXECUTABLE_PATH` and system browser detection.
- Updates Unix/Windows installer guidance for the puppeteer-core migration.
- Regenerates `pnpm-lock.yaml` from Cat Cafe manifests instead of cherry-picking the public lockfile, preserving home-only workspace packages such as `packages/ppt-forge`.

## Why

Public repo #818 correctly cleaned dead dependencies and a public lockfile phantom entry. The home intake needs the same dependency cleanup, but cannot blindly absorb the public lockfile because `packages/ppt-forge` is a real internal workspace package here.

## Original Requirements

> #818: 代码层面放行。CI 全绿，puppeteer-core 迁移、CHROME_EXECUTABLE_PATH、env registry、install 文案、ioredis type-only、CodeMirror 直接引用面都查过了。
> 结论：可以合，但我没直接 merge 第三方 PR。@codex 你来负责？
> 如果可以，注意！！！一定要按照sop 走流程回家
> review 可以让孟加拉来？opus孟加拉

- Source: current Cat Cafe A2A thread, Landy message at 2026-05-31 08:01 UTC.
- Please review against the above requirement: public merge plus careful home intake, with special attention to intake-specific lockfile/manual-port mistakes.

## Tradeoff

I kept the intake focused on the source PR plus one local quality improvement: `detectChromePath()` is split into helpers to avoid adding a new complexity warning. I did not broaden this into a general installer/preflight redesign; existing preflight Puppeteer CDN checks are untouched because `has_puppeteer()` becomes false once the lockfile moves to `puppeteer-core`.

## Architecture Ownership

Architecture cell: n/a — dependency/tooling intake; no canonical ownership cell boundary changed.
Map delta: none
Why: This changes package manifests, lockfile, install guidance, env registry metadata, and an existing screenshot service implementation. It does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please check:

- Diff matches `Map delta: none`.
- `pnpm-lock.yaml` keeps `packages/ppt-forge` and does not copy the public phantom-entry deletion blindly.
- `ImageExporter` handles missing or invalid `CHROME_EXECUTABLE_PATH` safely and does not reintroduce shell invocation.
- `ioredis` remains available for home root scripts and shared/API paths after moving out of API runtime deps.

## Open Questions

### 技术 OQ（给 reviewer）

- Is keeping `ioredis` as an API devDependency plus shared runtime dependency enough for home install semantics, or should root scripts declare a direct root dependency in a follow-up?
- Do you want the old preflight Puppeteer CDN messaging removed in this intake, or is the current no-op behavior acceptable because `has_puppeteer()` no longer matches the lockfile?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review cat-cafe#1990 against cat-cafe#1988. If approved, I will record clowder-ai#818 as `absorbed` with `--intent-issue 1988 --absorb-pr 1990 --review-proof <your review URL>`, then advance the intake ledger.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-818-dep-audit/antig-opus`
- Start Command: no service start required; use `pnpm review:start` only if you choose to inspect runtime behavior.
- Ports: n/a for required checks; do not use 3001/3002 as current-branch evidence.

## Quality Gate Report

### Spec 合规

- Intake Intent Issue: `cat-cafe#1988`
- `bash scripts/intake-from-opensource.sh --pr 818 --mode=plan` classified 7 safe files, 1 high-risk env registry file, and 3 manual-port scripts.
- Brand Guard passed for worktree and staged index.
- Root artifact gate passed for worktree and `origin/main...HEAD`.
- `.pen` design match: none; no frontend UI change.
- Hotfix pattern: false.
- Fallback layer check: `ImageExporter.ts` net +1 fallback, total 3, reasonable for env override + platform detection.
- Architecture ownership check: exits 0 with existing repository warnings; diff architecture nouns OK.

### Dogfood-Your-Slice

Scope verdict: 必做, because screenshot export is user-visible.

端到端路径:
- `ImageExporter.capture(file://tmp-html, "dogfood-user")`
- `CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

实际证据:

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api run build
# exit 0

TMP_HTML=/tmp/cat-cafe-image-export.XXXXXX.html \
TMP_PNG=/tmp/cat-cafe-image-export.XXXXXX.png \
CHROME_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node --input-type=module <dogfood script>
# {"png":"/tmp/cat-cafe-image-export.XXXXXX.png","bytes":26767}
```

发现的 bug: 无。

### 测试结果

```bash
env -u NODE_ENV pnpm install --frozen-lockfile
# passed

node -e "import('ioredis').then(() => console.log('root ioredis ok')).catch((e) => { console.error(e.code || e.message); process.exit(1); })"
# root ioredis ok

node scripts/export-threads-from-redis.mjs --help
# passed

node scripts/restore-chat-md-to-redis.mjs --help
# passed

env -u NODE_ENV pnpm check:env-registry
# 3 pass, 0 fail

env -u NODE_ENV node --test packages/api/test/install-script-env.test.js packages/api/test/windows-portable-redis-tools.test.js scripts/check-env-registry.test.mjs
# 47 pass, 0 fail

env -u NODE_ENV pnpm --filter @cat-cafe/api run lint
# passed

env -u NODE_ENV pnpm --filter @cat-cafe/web run lint
# passed with existing warnings

env -u NODE_ENV pnpm check:lockfile
# passed

bash scripts/intake-from-opensource.sh --validate-inbound
# passed

bash scripts/intake-from-opensource.sh --validate-inbound --from-index
# passed

env -u NODE_ENV pnpm biome check package.json packages/api/package.json packages/web/package.json packages/api/src/config/env-registry.ts packages/api/src/services/ImageExporter.ts packages/api/test/install-script-env.test.js packages/api/test/windows-portable-redis-tools.test.js scripts/check-env-registry.test.mjs
# exit 0 with existing warnings

env -u NODE_ENV pnpm check:scripts-ascii-only
# passed

git diff --cached --check
# passed
```

### 相关文档

- Intake Intent Issue: `cat-cafe#1988`
- Absorb PR: `cat-cafe#1990`
- Mailbox: `docs/mailbox/2026-05-31-intake-clowder-818-dep-audit-review-request.md`

[砚砚/gpt-5.5🐾]
