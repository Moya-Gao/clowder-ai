---
doc_kind: review-request
feature_ids: [F168]
created: 2026-04-20
---

# Review Request: F168 Phase F — GitHub PR Sync Pipeline

Review-Target-ID: f168
Branch: feat/f168-phase-f

## What

Mirror Phase E's issue sync pattern for PRs. New:
- `CommunityPrStore` (port + in-memory) — PR discovery layer
- `GitHubPrFetcher.mapGitHubPr()` — state mapper with review-based replyState detection
- `POST /api/community-issues/sync-prs` — two-pass sync (list PRs, fetch reviews for open PRs)
- Board merge: `CommunityPrStore` + `pr_tracking` deduped by PR number (pr_tracking takes priority)
- Frontend: PR sections updated to unreplied/replied/has-new-activity/merged/closed, sync button calls both endpoints in parallel

## Why

PR section only showed manually registered `pr_tracking` items. No way to see all community PRs or their reply status. Phase F fills the same gap for PRs that Phase E filled for issues.

## Original Requirements

> "这里的PR我是想看到和issue那样，哪些我们回了哪些没回，比如上次回了之后对方有没有新的更新这些的"

- 来源：`docs/features/F168-community-ops-board.md` line 289（铲屎官 2026-04-19 确认）
- **请对照上面的摘录判断：PR 区是否实现了"和 issue 一样"的回复状态 + 新动态检测**

## Tradeoff

- In-memory store only (no Redis persistence) — matches Phase E initial approach, can add Redis later
- Two-pass sync (list + reviews per open PR) — N+1 calls but keeps logic simple; reviews only fetched for open PRs
- `has-new-activity` uses head SHA comparison only — doesn't track individual commits, just "something changed since last review"

## Open Questions

1. **replyState for merged/closed PRs**: Currently defaults to `replied`. Should merged PRs without any review show `unreplied`?
2. **KD-13 boundary**: CommunityPrStore (discovery) vs pr_tracking (rich tracking) — dedup by PR number with pr_tracking priority. Does this feel right from the reviewer's perspective?

## Next Action

Full code review. Focus on:
- replyState detection logic correctness (GitHubPrFetcher.ts)
- Board merge dedup logic (community-issues.ts board endpoint)
- Frontend section grouping (CommunityPanel.tsx)

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f168/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-F1: Sync → GitHub API → CommunityPrStore | ✅ | 4 route tests |
| AC-F2: Reply detection (non-author review) | ✅ | 7 fetcher tests |
| AC-F3: New activity (head SHA changed) | ✅ | fetcher test: has-new-activity |
| AC-F4: Board merge + dedup | ✅ | board merge test |
| AC-F5: Frontend PR sections | ✅ | type-check pass |

### 测试结果

```
pnpm test → 8810 pass / 4 fail (pre-existing worktree hoisting issue, all 4 pass on main)
Phase F tests: 62/62 pass, 0 fail
pnpm biome check → 0 errors
npx tsc (API) → 0 errors
```

### 相关文档

- Plan: `docs/plans/2026-04-20-f168-phase-f-pr-sync.md`
- Feature: `docs/features/F168-community-ops-board.md` Phase F section
- KD-13: CommunityPrStore coexists with pr_tracking

### 如果判断错了我最可能错在哪

1. `has-new-activity` 只比较 head SHA，如果 PR 只有新评论（无新 commit）不会被检测到 — 可能不符合铲屎官"有没有新的更新"的预期
2. Merged/closed PR 默认 `replied` 可能掩盖从未被 review 就合入的 PR
3. N+1 review fetch 对于大仓库（100+ open PRs）可能超时
4. 前端没有浏览器截图证据（worktree 无法启动 next build，需合入后用 alpha 验证）
