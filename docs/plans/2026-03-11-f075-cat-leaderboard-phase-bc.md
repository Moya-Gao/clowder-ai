# F075 Cat Leaderboard Phase B+C Implementation Plan

**Feature:** F075 — `docs/features/F075-cat-leaderboard.md`
**Goal:** 笨蛋猫猫排行榜 + 游戏战绩 + 成就徽章 + CVO 等级 + 事件接入
**Acceptance Criteria:**
- [ ] AC-B1: "笨蛋猫猫"排行榜（含情绪分析）
- [ ] AC-B2: 游戏战绩面板（至少猫猫杀 + 谁是卧底）
- [ ] AC-B3: 排行榜入口与运行态对齐（runtime sync 是铲屎官操作，代码层面确保 Hub tab 可见）
- [ ] AC-B4: 移动端适配
- [ ] AC-C1: 成就徽章系统（通用框架 + CVO 成就 + 日常成就）
- [ ] AC-C2: CVO 能力等级追踪（Lv.1-5，框架 + 内存实现；持久化为 follow-up）
- [ ] AC-C3: `POST /api/leaderboard/events` + F087 接入闭环
**Architecture:** 扩展现有 leaderboard domain，新增 silly-stats（关键词情绪分析）、game-store（战绩存储）、achievement-store（成就 + 事件存储）。遵循项目的 Port→InMemory 存储模式。前端替换 ComingSoon 占位为真实组件。
**Tech Stack:** TypeScript, Fastify routes, in-memory stores, React + Tailwind
**前端验证:** Yes — reviewer 必须用 Chrome 实测

**NOT building (本轮 scope 外):**
- Redis / 持久层实现（AC-C2 持久化作为 follow-up，本轮交付框架 + 内存实现）
- 自动情绪分析模型（MVP = 关键词匹配）
- F087 Bootcamp 的具体训练逻辑（只提供事件写入接口）

---

## Terminal Schema

```typescript
// 扩展 shared/types/leaderboard.ts

// Phase B
interface SillyCatEntry {
  catId: string; displayName: string; label: string; description: string; count: number;
}
interface SillyStats { entries: SillyCatEntry[]; }

interface GameRecord {
  id: string; game: string; catId: string; result: 'win' | 'lose' | 'mvp' | 'shame';
  detail?: string; timestamp: number;
}
interface GameStats {
  catKill: { wins: number; mvps: number; topCat?: RankedCat };
  whoSpy: { shameCount: number; shameCat?: RankedCat };
}

// Phase C
interface Achievement {
  id: string; emoji: string; label: string; description: string;
  category: 'cvo' | 'daily'; unlockedAt?: number;
}
interface CvoLevel { level: number; title: string; description: string; progress: number; nextTitle?: string; needed?: number; }

// Extended response
interface LeaderboardStatsResponse {
  mentions: MentionStats; work: WorkStats; range: LeaderboardRange; fetchedAt: string;
  silly?: SillyStats;       // Phase B
  games?: GameStats;        // Phase B
  achievements?: Achievement[];  // Phase C
  cvoLevel?: CvoLevel;     // Phase C
}
```

---

## Task 1: Shared Types — Phase B+C (AC-B1, B2, C1, C2, C3)

**Files:**
- Modify: `packages/shared/src/types/leaderboard.ts`

Add SillyStats, GameRecord, GameStats, Achievement, CvoLevel, LeaderboardEvent types. Extend LeaderboardStatsResponse with optional fields.

Build shared: `pnpm --filter @cat-cafe/shared build`

---

## Task 2: Silly Stats Service + Tests (AC-B1)

**Files:**
- Create: `packages/api/src/domains/leaderboard/silly-stats.ts`
- Create: `packages/api/test/leaderboard/silly-stats.test.js`

Pure function: messages → SillyStats. Keyword-based sentiment:
- **被骂关键词**: 爆粗口、感叹号连发(≥3)、"你怎么又"、"我让你...没让你"、"啊？！"
- **亲昵关键词**: 笨蛋、傻猫、小绿茶、心机小坏猫 + 带"哈哈"或 emoji
- **反复犯错**: 从 MEMORY.md 铁律 pattern（同一错误 ≥3 次）
- 置信度 < 0.7 标记待确认

Tests: 亲昵 vs 真生气区分、empty input、多猫统计

---

## Task 3: Game Record Store (AC-B2)

**Files:**
- Create: `packages/api/src/domains/leaderboard/game-store.ts`
- Create: `packages/api/test/leaderboard/game-store.test.js`

In-memory store following MessageStore pattern:
- `append(record: GameRecordInput): GameRecord`
- `getByCat(catId: string): GameRecord[]`
- `getByGame(game: string): GameRecord[]`
- `computeGameStats(): GameStats`

Tests: append + query, stats computation, empty store

---

## Task 4: Achievement Store + Definitions (AC-C1, C2)

**Files:**
- Create: `packages/api/src/domains/leaderboard/achievement-store.ts`
- Create: `packages/api/src/domains/leaderboard/achievement-defs.ts`
- Create: `packages/api/test/leaderboard/achievement-store.test.js`

achievement-defs.ts: Static definitions for all badges (CVO + daily).
achievement-store.ts: In-memory store:
- `unlock(userId: string, achievementId: string): Achievement`
- `getUnlocked(userId: string): Achievement[]`
- `getCvoLevel(userId: string): CvoLevel`

CVO level = count of CVO achievements unlocked → maps to Lv.1-5.

Tests: unlock + get, CVO level computation, duplicate unlock idempotent

---

## Task 5: Event Ingestion Route (AC-C3)

**Files:**
- Create: `packages/api/src/routes/leaderboard-events.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`

`POST /api/leaderboard/events` — accepts LeaderboardEvent, validates source enum, dedup by eventId, routes to achievement-store or game-store based on eventType. Returns `{ status: 'ok' | 'duplicate' }`.

---

## Task 6: Extend Leaderboard Service (AC-B1, B2, C1, C2)

**Files:**
- Modify: `packages/api/src/domains/leaderboard/leaderboard-service.ts`
- Modify: `packages/api/src/routes/leaderboard.ts`

Add silly stats + game stats + achievements + CVO level to getLeaderboardStats response. Pass stores via route options.

---

## Task 7: Frontend — Silly Cats + Game Arena (AC-B1, B2)

**Files:**
- Modify: `packages/web/src/components/leaderboard-cards.tsx`
- Modify: `packages/web/src/components/HubLeaderboardTab.tsx`

Replace ComingSoon("翻车现场") with SillyCatsList (warm orange rows from .pen: `#D4845E` accent, avatars, ×N counts).
Replace ComingSoon("游戏竞技场") with GameArena (cat kill wins/MVP + spy shame badges from .pen).

---

## Task 8: Frontend — Achievement Wall + CVO Level (AC-C1, C2)

**Files:**
- Modify: `packages/web/src/components/leaderboard-cards.tsx`
- Modify: `packages/web/src/components/HubLeaderboardTab.tsx`

Replace ComingSoon("成就墙") with AchievementWall (badge grid, unlocked = beige, locked = gray+opacity from .pen).
Replace ComingSoon("CVO 能力等级") with CvoLevelCard (level badge + progress bar + next level text from .pen).

---

## Task 9: Mobile Responsive (AC-B4)

**Files:**
- Modify: `packages/web/src/components/HubLeaderboardTab.tsx`
- Modify: `packages/web/src/components/leaderboard-cards.tsx`

Grid breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Hero cards stack on mobile. Work metrics 1-col on mobile.

---

## Task 10: Quality Gate + Request Review

- `pnpm check` — lint
- `pnpm --filter @cat-cafe/api build` — compile
- `node --test packages/api/test/leaderboard/*.test.js` — all tests pass
- Commit, push, quality-gate self-check, request-review to codex
