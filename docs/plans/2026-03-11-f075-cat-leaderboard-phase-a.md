# F075 Cat Leaderboard — Phase A Implementation Plan

**Feature:** F075 — `docs/features/F075-cat-leaderboard.md`
**Goal:** Mission Hub 新增「排行榜」Tab，展示 @ 互动统计和工作统计，为后续笨蛋榜/成就系统奠定数据基础。
**Acceptance Criteria (Phase A):**
- [x] AC: Mission Hub 新增「排行榜」Tab
- [x] AC: @ 互动统计面板（4 个维度：最爱猫猫、深夜劳模、连续宠幸、话唠猫猫）
- [x] AC: 工作统计面板（3 个维度：commit 数、review 数、bug fix 数）
- [x] AC: 时间范围筛选（全部 / 近 7 天 / 近 30 天）
- [ ] Phase B: 笨蛋猫猫排行榜（含情绪分析）
- [ ] Phase B: 游戏战绩面板
- [ ] Phase C: 成就徽章系统 + CVO 能力等级
**Architecture:** 后端新增 leaderboard stats route，从 Redis 消息索引计算 @ 统计 + git log 解析工作统计。前端在 CatCafeHub 增加排行榜 Tab，Bento Grid 布局。
**Tech Stack:** Fastify route, Redis (existing MessageStore), git log parsing, React + Tailwind
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## NOT Building (Phase A)

- 笨蛋猫猫排行榜 / 情绪分析
- 游戏战绩
- 成就徽章系统 / CVO 能力等级
- LeaderboardEvent 写入 API（Phase B，F087 接入时再做）
- WebSocket 实时推送
- 申诉机制

## Terminal Schema

```ts
// GET /api/leaderboard/stats?range=all|7d|30d
interface LeaderboardStatsResponse {
  mentions: {
    favoriteCat: RankedCat[];   // 铲屎官最爱猫猫 — by @ count
    nightOwl: RankedCat[];      // 深夜劳模 — 0:00-6:00
    streak: StreakCat[];        // 连续宠幸 Streak
    chatty: RankedCat[];        // 话唠猫猫 — message count
  };
  work: {
    commits: RankedCat[];       // 代码狂魔
    reviews: RankedCat[];       // Review 之王
    bugFixes: RankedCat[];      // 修 Bug 达人
  };
  range: 'all' | '7d' | '30d';
  fetchedAt: string;
}

interface RankedCat {
  catId: string;
  displayName: string;
  count: number;
  rank: number;
}

interface StreakCat {
  catId: string;
  displayName: string;
  currentStreak: number;
  maxStreak: number;
  rank: number;
}
```

---

## Task 1: Leaderboard Types (shared)

**Files:**
- Create: `packages/shared/src/leaderboard-types.ts`
- Modify: `packages/shared/src/index.ts` (add export)

**Step 1: Create type definitions**

```ts
// packages/shared/src/leaderboard-types.ts
export interface RankedCat {
  catId: string;
  displayName: string;
  count: number;
  rank: number;
}

export interface StreakCat {
  catId: string;
  displayName: string;
  currentStreak: number;
  maxStreak: number;
  rank: number;
}

export type LeaderboardRange = 'all' | '7d' | '30d';

export interface MentionStats {
  favoriteCat: RankedCat[];
  nightOwl: RankedCat[];
  streak: StreakCat[];
  chatty: RankedCat[];
}

export interface WorkStats {
  commits: RankedCat[];
  reviews: RankedCat[];
  bugFixes: RankedCat[];
}

export interface LeaderboardStatsResponse {
  mentions: MentionStats;
  work: WorkStats;
  range: LeaderboardRange;
  fetchedAt: string;
}
```

**Step 2: Export from shared index**

Add `export * from './leaderboard-types.js';` to `packages/shared/src/index.ts`.

**Step 3: Build shared**

Run: `pnpm --filter @cat-cafe/shared build`

**Step 4: Commit**

```bash
git add packages/shared/src/leaderboard-types.ts packages/shared/src/index.ts
git commit -m "feat(F075): add leaderboard types to shared package"
```

---

## Task 2: Mention Stats Service

**Files:**
- Create: `packages/api/src/domains/leaderboard/mention-stats.ts`
- Test: `packages/api/test/leaderboard/mention-stats.test.js`

**Step 1: Write failing test**

```js
// test/leaderboard/mention-stats.test.js
import { describe, it, assert } from 'node:test';
import { computeMentionStats } from '../../src/domains/leaderboard/mention-stats.js';

describe('computeMentionStats', () => {
  const messages = [
    { id: '1', mentions: ['opus'], mentionsUser: false, timestamp: '2026-03-10T14:00:00Z', catId: null, content: 'hello' },
    { id: '2', mentions: ['opus'], mentionsUser: false, timestamp: '2026-03-10T03:00:00Z', catId: null, content: 'night' },
    { id: '3', mentions: ['codex'], mentionsUser: false, timestamp: '2026-03-10T15:00:00Z', catId: null, content: 'hi' },
    { id: '4', mentions: ['opus', 'codex'], mentionsUser: false, timestamp: '2026-03-09T10:00:00Z', catId: null, content: 'both' },
    { id: '5', mentions: ['gemini'], mentionsUser: false, timestamp: '2026-03-10T02:30:00Z', catId: null, content: 'gem' },
  ];

  const catNames = { opus: '布偶猫', codex: '缅因猫', gemini: '暹罗猫' };

  it('ranks favoriteCat by total mention count', () => {
    const result = computeMentionStats(messages, catNames, 'all');
    assert.strictEqual(result.favoriteCat[0].catId, 'opus');
    assert.strictEqual(result.favoriteCat[0].count, 3);
    assert.strictEqual(result.favoriteCat[0].rank, 1);
    assert.strictEqual(result.favoriteCat[1].catId, 'codex');
    assert.strictEqual(result.favoriteCat[1].count, 2);
  });

  it('ranks nightOwl by 0:00-6:00 mentions only', () => {
    const result = computeMentionStats(messages, catNames, 'all');
    // opus has 1 night mention (03:00), gemini has 1 (02:30), codex has 0
    assert.strictEqual(result.nightOwl[0].count, 1);
    assert.ok(['opus', 'gemini'].includes(result.nightOwl[0].catId));
  });
});
```

**Step 2: Run test — expect FAIL**

Run: `node --test test/leaderboard/mention-stats.test.js`
Expected: FAIL — module not found

**Step 3: Implement computeMentionStats**

```ts
// packages/api/src/domains/leaderboard/mention-stats.ts
import type { MentionStats, RankedCat } from '@cat-cafe/shared';

interface MessageLike {
  id: string;
  mentions: readonly string[];
  timestamp: string;
  catId: string | null;
  content: string;
}

function isNightHour(ts: string): boolean {
  const h = new Date(ts).getHours();
  return h >= 0 && h < 6;
}

function toRanked(entries: [string, number][], catNames: Record<string, string>): RankedCat[] {
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([catId, count], i) => ({
      catId,
      displayName: catNames[catId] ?? catId,
      count,
      rank: i + 1,
    }));
}

export function computeMentionStats(
  messages: MessageLike[],
  catNames: Record<string, string>,
  _range: string,
): MentionStats {
  const mentionCount = new Map<string, number>();
  const nightCount = new Map<string, number>();
  const chattyCount = new Map<string, number>();

  for (const msg of messages) {
    for (const catId of msg.mentions) {
      mentionCount.set(catId, (mentionCount.get(catId) ?? 0) + 1);
      if (isNightHour(msg.timestamp)) {
        nightCount.set(catId, (nightCount.get(catId) ?? 0) + 1);
      }
    }
    // chatty = messages sent BY a cat (catId field)
    if (msg.catId) {
      chattyCount.set(msg.catId, (chattyCount.get(msg.catId) ?? 0) + 1);
    }
  }

  return {
    favoriteCat: toRanked([...mentionCount.entries()], catNames),
    nightOwl: toRanked([...nightCount.entries()], catNames),
    streak: [], // Phase A: streak requires date-bucketed computation, added in step below
    chatty: toRanked([...chattyCount.entries()], catNames),
  };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Add streak computation + test**

Streak = consecutive days where catId appears in mentions. Compute from date-bucketed data.

**Step 6: Commit**

---

## Task 3: Work Stats Service (Git Log)

**Files:**
- Create: `packages/api/src/domains/leaderboard/work-stats.ts`
- Test: `packages/api/test/leaderboard/work-stats.test.js`

**Step 1: Write failing test**

Test `parseGitStats()` with mock git log output.

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// packages/api/src/domains/leaderboard/work-stats.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WorkStats, RankedCat } from '@cat-cafe/shared';

const execFileAsync = promisify(execFile);

// Map git author emails → catId
const AUTHOR_MAP: Record<string, string> = {
  'noreply@anthropic.com': 'opus',
  'codex@openai.com': 'codex',
  // extend as needed from cat-config.json
};

interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export function parseGitLog(raw: string): GitLogEntry[] {
  // format: hash|author|date|message
  return raw.trim().split('\n').filter(Boolean).map(line => {
    const [hash, author, date, ...rest] = line.split('|');
    return { hash, author, date, message: rest.join('|') };
  });
}

export function classifyCommit(msg: string): 'commit' | 'review' | 'bugfix' {
  const lower = msg.toLowerCase();
  if (lower.includes('review') || lower.includes('re-review')) return 'review';
  if (lower.includes('fix') || lower.includes('bug')) return 'bugfix';
  return 'commit';
}

export function computeWorkStats(
  entries: GitLogEntry[],
  authorMap: Record<string, string>,
  catNames: Record<string, string>,
): WorkStats {
  const commits = new Map<string, number>();
  const reviews = new Map<string, number>();
  const bugFixes = new Map<string, number>();

  for (const entry of entries) {
    const catId = authorMap[entry.author] ?? entry.author;
    const kind = classifyCommit(entry.message);

    commits.set(catId, (commits.get(catId) ?? 0) + 1);
    if (kind === 'review') reviews.set(catId, (reviews.get(catId) ?? 0) + 1);
    if (kind === 'bugfix') bugFixes.set(catId, (bugFixes.get(catId) ?? 0) + 1);
  }

  const toRanked = (m: Map<string, number>): RankedCat[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([catId, count], i) => ({
        catId,
        displayName: catNames[catId] ?? catId,
        count,
        rank: i + 1,
      }));

  return {
    commits: toRanked(commits),
    reviews: toRanked(reviews),
    bugFixes: toRanked(bugFixes),
  };
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

---

## Task 4: Leaderboard API Route

**Files:**
- Create: `packages/api/src/routes/leaderboard.ts`
- Modify: `packages/api/src/routes/index.ts` (add export)
- Test: `packages/api/test/leaderboard/leaderboard-api.test.js`

**Step 1: Write failing test**

Test GET /api/leaderboard/stats returns 200 with correct shape.

**Step 2: Run — FAIL**

**Step 3: Implement route**

```ts
// packages/api/src/routes/leaderboard.ts
import type { FastifyInstance } from 'fastify';
import type { LeaderboardRange, LeaderboardStatsResponse } from '@cat-cafe/shared';
import { computeMentionStats } from '../domains/leaderboard/mention-stats.js';
import { computeWorkStats, parseGitLog } from '../domains/leaderboard/work-stats.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { range?: string } }>(
    '/api/leaderboard/stats',
    async (req, reply) => {
      const range = (req.query.range ?? 'all') as LeaderboardRange;
      const messageStore = app.messageStore; // injected via decorator
      const catNames = getCatDisplayNames(app); // from cat-config

      // Get messages (with optional time filter)
      const since = range === '7d' ? daysAgo(7) : range === '30d' ? daysAgo(30) : undefined;
      const messages = await messageStore.getAll({ since });

      const mentions = computeMentionStats(messages, catNames, range);

      // Git stats
      const gitLogRaw = await getGitLog(since);
      const gitEntries = parseGitLog(gitLogRaw);
      const work = computeWorkStats(gitEntries, getAuthorMap(app), catNames);

      const response: LeaderboardStatsResponse = {
        mentions,
        work,
        range,
        fetchedAt: new Date().toISOString(),
      };
      return reply.send(response);
    },
  );
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
```

**Step 4: Register route in index.ts**

Add `export { leaderboardRoutes } from './leaderboard.js';` and register in app.

**Step 5: Run — PASS**

**Step 6: Commit**

---

## Task 5: Frontend — HubLeaderboardTab Component

**Files:**
- Create: `packages/web/src/components/HubLeaderboardTab.tsx`

**Step 1: Create component with Bento Grid layout**

```tsx
// packages/web/src/components/HubLeaderboardTab.tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import type { LeaderboardStatsResponse, LeaderboardRange, RankedCat, StreakCat } from '@cat-cafe/shared';

const RANGE_OPTIONS: { value: LeaderboardRange; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
];

function RankCard({ title, emoji, items }: { title: string; emoji: string; items: RankedCat[] }) {
  return (
    <div className="bg-purple-50 rounded-3xl p-5">
      <h3 className="text-sm font-bold text-purple-800 mb-3">{emoji} {title}</h3>
      <div className="space-y-2">
        {items.map((cat) => (
          <div key={cat.catId} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-purple-600 w-6">{cat.rank}</span>
              <span className="text-sm font-medium">{cat.displayName}</span>
            </div>
            <span className="text-xl font-extrabold text-purple-700">{cat.count}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400">暂无数据</p>}
      </div>
    </div>
  );
}

export function HubLeaderboardTab() {
  const [stats, setStats] = useState<LeaderboardStatsResponse | null>(null);
  const [range, setRange] = useState<LeaderboardRange>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch(`/api/leaderboard/stats?range=${range}`);
      if (res.ok) {
        setStats(await res.json());
      } else {
        setError('加载失败');
      }
    } catch {
      setError('网络错误');
    }
  }, [range]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              range === opt.value
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {stats && (
        <>
          {/* Section: @ 互动统计 */}
          <h2 className="text-sm font-bold text-gray-700">@ 互动统计</h2>
          <div className="grid grid-cols-2 gap-3">
            <RankCard title="铲屎官最爱" emoji="🏆" items={stats.mentions.favoriteCat} />
            <RankCard title="深夜劳模" emoji="🌙" items={stats.mentions.nightOwl} />
            <RankCard title="话唠猫猫" emoji="💬" items={stats.mentions.chatty} />
            {/* Streak card slightly different */}
            <div className="bg-orange-50 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-orange-800 mb-3">🔥 连续宠幸</h3>
              <div className="space-y-2">
                {(stats.mentions.streak as StreakCat[]).map((cat) => (
                  <div key={cat.catId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-orange-600 w-6">{cat.rank}</span>
                      <span className="text-sm font-medium">{cat.displayName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-orange-700">{cat.currentStreak}d</span>
                      <span className="text-xs text-orange-400 ml-1">max {cat.maxStreak}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: 工作统计 */}
          <h2 className="text-sm font-bold text-gray-700 mt-4">工作统计</h2>
          <div className="grid grid-cols-3 gap-3">
            <RankCard title="代码狂魔" emoji="🛠️" items={stats.work.commits} />
            <RankCard title="Review 之王" emoji="🔍" items={stats.work.reviews} />
            <RankCard title="修 Bug 达人" emoji="🐛" items={stats.work.bugFixes} />
          </div>
        </>
      )}

      {!stats && !error && <p className="text-sm text-gray-400">加载中...</p>}
    </div>
  );
}
```

**Step 2: Commit**

---

## Task 6: Wire Tab into CatCafeHub

**Files:**
- Modify: `packages/web/src/components/CatCafeHub.tsx`

**Step 1: Add import + tab entry**

Add to HUB_TABS: `{ id: 'leaderboard', label: '排行榜' }`
Add import: `import { HubLeaderboardTab } from './HubLeaderboardTab';`
Add render: `{tab === 'leaderboard' && <HubLeaderboardTab />}`

**Step 2: Run dev server and verify tab shows**

**Step 3: Commit**

---

## Task 7: Frontend Component Test

**Files:**
- Create: `packages/web/src/components/__tests__/hub-leaderboard-tab.test.ts`

**Step 1: Write test for data shape parsing and empty state**

**Step 2: Run — PASS**

**Step 3: Commit**

---

## Task 8: Integration Test + Quality Gate

**Step 1: Run full test suite** `pnpm test`
**Step 2: Run biome check** `pnpm check`
**Step 3: Run type check** `pnpm lint`
**Step 4: Verify frontend renders** (dev server or Playwright)
**Step 5: Load `quality-gate` skill**

---

## 下一步

Plan 完成 → 加载 `worktree` skill → 创建隔离开发环境 → `tdd` 实现。
