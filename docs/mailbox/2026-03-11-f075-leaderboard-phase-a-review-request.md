# Review Request: F075 Cat Leaderboard — Phase A

## What
Mission Hub 新增「排行榜」Tab，包含 @ 互动统计（4 维度）+ 工作统计（3 维度）+ 时间范围筛选。

核心变更（6 commits）：
- `packages/shared/src/types/leaderboard.ts` — 共享类型定义
- `packages/api/src/domains/leaderboard/mention-stats.ts` — @ 统计纯函数
- `packages/api/src/domains/leaderboard/work-stats.ts` — Git log 解析纯函数
- `packages/api/src/domains/leaderboard/leaderboard-service.ts` — 服务编排层
- `packages/api/src/routes/leaderboard.ts` — GET /api/leaderboard/stats?range=all|7d|30d
- `packages/web/src/components/HubLeaderboardTab.tsx` — Bento Grid 前端组件

## Why
F075 spec 要求可视化猫猫互动和工作数据。Phase A 聚焦核心统计展示，为后续笨蛋榜/成就系统奠定数据基础。

## Original Requirements（必填）
> "Can we track how many times you were mentioned by the user and separately for each cat? Can we create a leaderboard showing the user's favorite cat? This would be a fun feature."
- 来源：`docs/features/F075-cat-leaderboard.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 只实现 Phase A（@ 统计 + 工作统计），不含笨蛋榜/游戏/成就系统
- 工作统计的 author map 暂时硬编码（只有 opus），后续从 cat-config 动态读取
- 消息获取用 `getRecent(10000)` + 客户端日期过滤，非最优但 Phase A 数据量可控

## Open Questions
1. `computeStreaks` 复杂度 24（Biome 建议 ≤15）——拆分还是 suppress？
2. `getAuthorMap()` 硬编码 email → catId 映射，Phase B 是否需要配置化？
3. 前端 Tab 放在最后一个位置，位置是否合适？

## Next Action
请审阅代码质量、架构设计、类型安全，以及是否满足铲屎官的原始需求。

## 自检证据

### Spec 合规
Phase A 4 项 AC 全部实现：
- ✅ Mission Hub 新增「排行榜」Tab
- ✅ @ 互动统计面板（最爱猫猫、深夜劳模、连续宠幸、话唠猫猫）
- ✅ 工作统计面板（commit 数、review 数、bug fix 数）
- ✅ 时间范围筛选（全部 / 近 7 天 / 近 30 天）

### 测试结果
```
node --test packages/api/test/leaderboard/*.test.js  # 11 passed, 0 failed
pnpm --filter @cat-cafe/api build                     # exit 0
pnpm --filter @cat-cafe/web build                     # Compiled successfully
pnpm lint                                              # 0 errors (warnings only)
pnpm biome check (F075 files)                          # 0 errors, 1 warning (complexity)
```

### 相关文档
- Plan: `docs/plans/2026-03-11-f075-cat-leaderboard-phase-a.md`
- Feature: `docs/features/F075-cat-leaderboard.md`
