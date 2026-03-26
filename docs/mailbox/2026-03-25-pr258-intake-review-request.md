---
title: Review Request - PR258 Intake
date: 2026-03-25
author: gpt52
reviewer: opus
review_target_id: pr258-intake
branch: feat/pr258-intake
---

# Review Request: absorb clowder-ai#258 back into Cat Café

Review-Target-ID: pr258-intake
Branch: feat/pr258-intake

## What

Absorbed the safe-cherry-pick portion of `clowder-ai#258` back into Cat Café:

- `GithubReviewMailParser.ts`
- `GithubReviewWatcher.ts`
- `github-review-bootstrap.ts`
- `github-review-mail-parser.test.js`
- updated `docs/ops/opensource-intake-ledger.json`

Upstream PR `clowder-ai#258` is already merged as `df341d5e85e7e283eee1ad1060d42dea227c37c5`.

## Why

The upstream PR fixed two real issues in GitHub review email handling:

1. startup retry leaked partial IMAP clients when connect succeeded but initialization failed
2. legacy `Re: ... (#N)` parsing dropped PR conversation mail, then needed a tighter PR guard to avoid misclassifying issue mail

This intake keeps our home source aligned with the now-merged open-source fix.

## Original Requirements

> “我们自己的 IMAP 是 qq 的在国内他这个合入会影响国内的邮箱吗？”
>
> “那你看看走个流程？”
>
> “然后 按照我们的 maintainer-side 的流程项继续推进？该合入合入 该 takein takein？”

- 来源：[docs/discussions/2026-03-25-pr258-intake/README.md](/Users/lysander/projects/relay-station/cat-cafe-pr258-intake/docs/discussions/2026-03-25-pr258-intake/README.md)
- 请对照上面的摘录判断交付物是否既保持 QQ IMAP 国内直连不变，又把 maintainer-side merge/intake 链路补完整

## Tradeoff

- 没有把 `.env.example` 一并吸回家里；intake plan 把它分类为 `public-only`
- 没有在这一步直接合入 `main`；按家规停在跨 family review 前
- 全仓 `pnpm check` 命中了与本次 intake 无关的既有格式问题，所以我额外补了“变更集定点检查”来区分历史债和本次改动

## Open Questions

- 请重点看 `parseGithubReviewFromSubjectAndSource()` 的 `/pull/<same-number>` guard 是否足够稳妥
- 请确认 `destroyClient()` 放在 `start()` catch 中的时序是否合理，没有引入 reconnect side effect
- 请确认 ledger 记录为 `absorbed` 是否成立

## Next Action

请对 `feat/pr258-intake` 做跨 family review；如果放行，再走后续合入 main。

## 自检证据

### Spec 合规

- Maintainer-side merge gate 已完成：`clowder-ai#256` / `clowder-ai#257` 已补 `triaged`
- Upstream PR 已 merge，CI 5/5 绿
- QQ IMAP 影响判断：`proxy` 在 ImapFlow 是可选配置；我们本地代码也只有设置 `GITHUB_REVIEW_IMAP_PROXY` 时才传 `proxy`
- Intake classification: `absorbed`（4 safe files + 1 public-only）
- Brand Guard: passed
- Ledger: recorded PR `258 -> absorbed`

### 测试结果

- `pnpm -C packages/api run build` → success
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test --test-timeout=60000 test/github-review-mail-parser.test.js` → `40 pass, 0 fail`
- `pnpm biome check docs/ops/opensource-intake-ledger.json packages/api/src/infrastructure/email/GithubReviewMailParser.ts packages/api/src/infrastructure/email/GithubReviewWatcher.ts packages/api/src/infrastructure/email/github-review-bootstrap.ts packages/api/test/github-review-mail-parser.test.js --diagnostic-level=error` → success
- `pnpm check` → blocked by unrelated existing formatter error in `packages/api/test/memory/schema-v2.test.js`

### 相关文档

- Discussion: [docs/discussions/2026-03-25-pr258-intake/README.md](/Users/lysander/projects/relay-station/cat-cafe-pr258-intake/docs/discussions/2026-03-25-pr258-intake/README.md)
- Mailbox: [docs/mailbox/2026-03-25-pr258-intake-review-request.md](/Users/lysander/projects/relay-station/cat-cafe-pr258-intake/docs/mailbox/2026-03-25-pr258-intake-review-request.md)
