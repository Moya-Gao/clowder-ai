---
doc_kind: review-request
created: 2026-05-17
author: codex
reviewer: opus
source_pr: clowder-ai#702
intake_issue: cat-cafe#1729
absorb_pr: cat-cafe#1730
---

# Review Request: intake clowder-ai#702 Japanese README

Review-Target-ID: pr702-ja-readme-intake
Branch: feat/pr702-ja-readme-intake

## What

Absorb clowder-ai#702 back into Cat Cafe's outbound sync source:

- add `README.opensource.ja-JP.md` as the source for public `README.ja-JP.md`
- add Japanese language-switch links to `README.opensource.md` and `README.opensource.zh-CN.md`
- generate `README.ja-JP.md` from `scripts/sync-to-opensource.sh`
- declare the new transform in `sync-manifest.yaml`
- classify root README variants as `manual-port` in `scripts/intake-from-opensource.sh`

## Why

clowder-ai#702 is a valid docs-only Japanese README contribution. If it only lands in
`clowder-ai`, the next full outbound sync will delete `README.ja-JP.md` and overwrite
the Japanese language links in generated English/Chinese READMEs.

## Original Requirements

> "前至少让作者清掉 PR body 模板残留 好像可以帮他清理一下？ 然后你合入"
> "最稳的做法是在家里新增 README.opensource.ja-JP.md，同步脚本/manifest 加日语 README transform"
> "单纯把 README.ja-JP.md 标 target-owned 不够，因为入口链接仍会被生成版 README 覆盖。"

- Source: current thread, 2026-05-17 CVO instruction for clowder-ai#702
- Please check that the source-of-truth approach, not target-owned preservation, is actually implemented.

## Tradeoff

I did not mark `README.ja-JP.md` as target-owned. Target-owned would preserve the
file itself, but the generated `README.md` and `README.zh-CN.md` language switchers
would still lose their Japanese link on the next outbound sync.

## Open Questions

Reviewer focus:

- Is `manual-port` the right intake classification for root README variants now that
  they are generated from `README.opensource*` sources?
- Does `sync-to-opensource.sh --dry-run` prove the generated Japanese README will survive full sync?
- Is the imported Japanese README acceptable as a public docs source, with no brand/source leakage?
- Please write a GitHub PR review/comment that explicitly covers current HEAD SHA.

## Next Action

Review cat-cafe#1730 against cat-cafe#1729 Intake Review Guard. If clean, leave a
formal GitHub review/comment on the PR with the current HEAD SHA so
`intake-from-opensource.sh --record` can use it as review proof after merge.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/pr702-ja-readme-intake/opus`
- Start Command: `pnpm review:start`
- Ports: not started by author; this is docs/sync-script intake with no UI surface.

## 自检证据

### Spec 合规

- Intake Intent Issue: cat-cafe#1729
- Absorb PR: cat-cafe#1730
- Source PR: clowder-ai#702
- Source merge commit: `89cca85c109142dc8464ecb1c6e7719e7e432f4a`
- Architecture cell: open-source sync / intake tooling
- Map delta: none
- Why: extends existing README transform and intake classification; no new sync subsystem.
- Path Guard: final diff is limited to source README files, sync manifest, sync script,
  intake classifier, and this review request.
- Fallback Guard: `node scripts/check-fallback-layers.mjs` => no code files changed.

### 验证结果

- `bash -n scripts/sync-to-opensource.sh` passed
- `bash -n scripts/intake-from-opensource.sh` passed
- `bash scripts/sync-to-opensource.sh --dry-run` passed
- generated `README.ja-JP.md` matched `README.opensource.ja-JP.md` byte-for-byte
- generated JA README: headings=40, replacementChars=0, local relative links resolved
- `bash scripts/intake-from-opensource.sh --pr 702 --mode=plan` => manual-port 3 files
- `NODE_ENV=development pnpm check` passed
- root artifact hygiene check: no matches

[砚砚/GPT-55🐾]
