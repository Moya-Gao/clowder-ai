# Review Request: F075 Phase B+C — 笨蛋榜 + 游戏战绩 + 成就 + CVO

## What
Phase B+C of the Cat Leaderboard feature:
- **Phase B**: Silly cats 翻车现场 (keyword sentiment analysis for angry vs affectionate scolding) + Game arena (猫猫杀 wins/MVP, 谁是卧底 shame stats)
- **Phase C**: Achievement badge system (7 CVO + 6 daily badges) + CVO level tracking (Lv.1-5) + Event ingestion route (`POST /api/leaderboard/events`)
- **Frontend**: Replaced all ComingSoon placeholders with real components + responsive grid breakpoints

7 commits, 32 tests green, all under 200-line file limit.

## Why
Phase A (mention stats + work stats) was merged in PR #371. This completes the remaining leaderboard features per the spec.

## Original Requirements（必填）
> 铲屎官: "Phase B（笨蛋榜 + 游戏战绩）和 Phase C（成就 + CVO）还没做 走起！"
> F075 spec: 铲屎官想可视化猫猫互动数据——@ 提及、消息、review、游戏记录。排行榜让铲屎官看到"谁是猫奴"、"谁是夜班冠军"，增加猫猫间的趣味竞争。
- 来源：`docs/features/F075-cat-leaderboard.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- In-memory stores only (no Redis persistence) — spec explicitly says "后续按需加"
- Keyword matching for sentiment (no ML model) — MVP approach per spec
- CVO level is per-userId, not per-catId — matches the achievement unlock model

## Open Questions
1. **Sentiment patterns**: 7 angry patterns + 6 affection patterns — are there common scolding patterns we're missing?
2. **CVO level thresholds**: 0/2/4/6/7 — reasonable progression? Or should it be more gradual?
3. **Achievement catalog**: 13 badges total — enough for MVP? Categories balanced?

## Next Action
请 review 代码质量 + 愿景对照。特别关注 silly-stats 的情绪判断逻辑和 achievement-store 的幂等性。

## 自检证据

### Spec 合规
| AC | Status |
|----|--------|
| AC-B1: 笨蛋猫猫排行榜 | ✅ silly-stats.ts + SillyCatsList UI |
| AC-B2: 游戏战绩面板 | ✅ game-store.ts + GameArena UI |
| AC-B3: Hub tab 可见 | ✅ Wired into HubLeaderboardTab |
| AC-B4: 移动端适配 | ✅ Responsive grid breakpoints |
| AC-C1: 成就徽章 | ✅ achievement-defs.ts (7 CVO + 6 daily) + AchievementWall UI |
| AC-C2: CVO 等级 Lv.1-5 | ✅ computeCvoLevel + CvoLevelCard UI |
| AC-C3: POST /api/leaderboard/events | ✅ leaderboard-events.ts with dedup |

### 测试结果
```
node --test packages/api/test/leaderboard/*.test.js
  32 pass, 0 fail ✅

pnpm lint → warnings only (pre-existing) ✅
pnpm --filter @cat-cafe/shared build → exit 0 ✅
pnpm --filter @cat-cafe/api build → exit 0 ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-11-f075-cat-leaderboard-phase-bc.md`
- Feature: `docs/features/F075-cat-leaderboard.md`

### 关键文件
| File | Lines | Purpose |
|------|-------|---------|
| `packages/shared/src/types/leaderboard.ts` | 108 | Phase B+C type definitions |
| `packages/api/src/domains/leaderboard/silly-stats.ts` | 53 | Keyword sentiment analysis |
| `packages/api/src/domains/leaderboard/game-store.ts` | 66 | In-memory game record store |
| `packages/api/src/domains/leaderboard/achievement-defs.ts` | 58 | Achievement catalog + CVO levels |
| `packages/api/src/domains/leaderboard/achievement-store.ts` | 44 | Achievement unlock store |
| `packages/api/src/routes/leaderboard-events.ts` | 55 | Event ingestion route |
| `packages/api/src/domains/leaderboard/leaderboard-service.ts` | 102 | Extended with Phase B+C data |
| `packages/web/src/components/leaderboard-phase-bc.tsx` | 98 | Phase B+C UI components |
| `packages/web/src/components/HubLeaderboardTab.tsx` | 146 | Updated tab with real components |
