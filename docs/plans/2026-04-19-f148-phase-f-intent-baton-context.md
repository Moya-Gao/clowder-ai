# F148 Phase F: Intent + Baton Context Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** 猫冷启动/warm mention 时，context packet 第一屏回答"为什么叫我"和"球怎么来的/做完往哪传"
**Acceptance Criteria:**
- AC-F1: Intent classifier 从 @-mention 消息提取 intent（review/continue/fix/advise/general），零 LLM
- AC-F2: Baton context 从消息历史提取最后 @ 传球事件（谁传的、什么时候、从哪条消息）
- AC-F3: Active tasks 从 TaskStore 查询当前 thread 的活跃毛线球（status != done，最多 3 条）
- AC-F4: Navigation header 注入到 ALL mention paths（cold + warm），独立于 smart window（KD-7）
- AC-F5: Briefing card 包含 intent + baton + tasks（cold path 的 format-briefing 扩展）
- AC-F6: Baton 矛盾检测：@ 传球时间 > 消息内容中"我在干活/你别动"时间 → 标注⚠️（球权死锁防护）
**Architecture:** 新建 `navigation-context.ts` 纯函数模块（intent classifier + baton extractor + task summarizer）。修改 `route-helpers.ts` 在 cold/warm 分叉前注入 navigation header。修改 `format-briefing.ts` 扩展 briefing card。
**Tech Stack:** TypeScript, node:test, zero LLM cost
**前端验证:** No — navigation header 是 prompt-level 注入，不需要前端改动。Briefing card 扩展需验证展开态。

---

### Task 1: Navigation Context — Types + Intent Classifier

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/navigation-context.ts`
- Test: `packages/api/test/f148-navigation-context.test.js`

**Step 1: Write failing test — intent classification**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
const { classifyIntent } = await import(
  '../dist/domains/cats/services/agents/routing/navigation-context.js'
);

describe('classifyIntent', () => {
  it('detects review intent', () => {
    assert.equal(classifyIntent('@opus 帮我 review 一下'), 'review');
    assert.equal(classifyIntent('@opus please review this PR'), 'review');
  });
  it('detects continue intent', () => {
    assert.equal(classifyIntent('@opus 继续上次的工作'), 'continue');
    assert.equal(classifyIntent('@opus 接着昨天那个'), 'continue');
  });
  it('detects fix intent', () => {
    assert.equal(classifyIntent('@opus 这个 bug 帮修一下'), 'fix');
  });
  it('detects advise intent', () => {
    assert.equal(classifyIntent('@opus 你觉得这个方向怎么样？'), 'advise');
  });
  it('defaults to general', () => {
    assert.equal(classifyIntent('@opus hello'), 'general');
  });
});
```

**Step 2: Run test — expect FAIL (module not found)**

Run: `cd packages/api && npx tsc --noEmit && node --test test/f148-navigation-context.test.js`

**Step 3: Implement classifyIntent**

```typescript
// navigation-context.ts
export type MentionIntent = 'review' | 'continue' | 'fix' | 'advise' | 'general';

const INTENT_PATTERNS: Array<[MentionIntent, RegExp]> = [
  ['review', /\b(review|帮.*看|审[查阅]|code.?review|PR.*看|看.*PR)\b/i],
  ['fix', /\b(bug|fix|修[复一]|坏了|报错|crash|error|broken)\b/i],
  ['continue', /\b(继续|接着|上次|昨天|之前.*工作|resume|carry.?on)\b/i],
  ['advise', /\b(觉得|怎么看|方向|建议|opinion|思考|想法|怎么样)\b/i],
];

export function classifyIntent(mentionText: string): MentionIntent {
  for (const [intent, pattern] of INTENT_PATTERNS) {
    if (pattern.test(mentionText)) return intent;
  }
  return 'general';
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/routing/navigation-context.ts \
       packages/api/test/f148-navigation-context.test.js
git commit -m "feat(F148-F): intent classifier — zero-LLM heuristic [宪宪/Opus-46🐾]"
```

---

### Task 2: Baton Context Extractor

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/navigation-context.ts`
- Test: `packages/api/test/f148-navigation-context.test.js` (append)

**Step 1: Write failing test — baton extraction**

```javascript
const { extractBatonContext } = await import(
  '../dist/domains/cats/services/agents/routing/navigation-context.js'
);

describe('extractBatonContext', () => {
  const messages = [
    { id: 'm1', catId: 'codex', content: '我在干活，你别动', createdAt: 1000, userId: 'u1' },
    { id: 'm2', catId: 'codex', content: '@opus 帮我看看这个\n@opus', createdAt: 2000, userId: 'u1' },
    { id: 'm3', catId: null, content: '@opus 你觉得呢？', createdAt: 3000, userId: 'user1' },
  ];

  it('finds last @ mention directed at target cat', () => {
    const baton = extractBatonContext(messages, 'opus');
    assert.equal(baton.fromMessageId, 'm3');
    assert.equal(baton.fromSpeaker, 'user');
    assert.equal(baton.timestamp, 3000);
  });

  it('detects stale hold contradiction', () => {
    // codex said "别动" at t=1000, then @opus at t=2000
    const baton = extractBatonContext(messages.slice(0, 2), 'opus');
    assert.equal(baton.staleHoldWarning, true);
  });

  it('returns null when no @ found', () => {
    const baton = extractBatonContext([messages[0]], 'opus');
    assert.equal(baton, null);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement extractBatonContext**

```typescript
export interface BatonContext {
  fromMessageId: string;
  fromSpeaker: string; // catId or 'user'
  fromSpeakerDisplay: string;
  timestamp: number;
  staleHoldWarning: boolean;
}

const HOLD_PATTERNS = /别动|你.*等|不要.*动|hold|wait|我.*在.*[干做]|正在/i;

export function extractBatonContext(
  messages: Array<{ id: string; catId: string | null; content: string; createdAt: number; userId: string }>,
  targetCatId: string,
): BatonContext | null {
  const mentionPattern = new RegExp(`^@${targetCatId}\\b`, 'm');

  // Scan from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!mentionPattern.test(m.content)) continue;
    // Found the last @ directed at target
    const fromSpeaker = m.catId ?? 'user';

    // Check for stale hold: same speaker said "hold/wait/别动" BEFORE this @ message
    let staleHoldWarning = false;
    for (let j = i - 1; j >= 0; j--) {
      const prev = messages[j];
      const prevSpeaker = prev.catId ?? 'user';
      if (prevSpeaker !== fromSpeaker) continue;
      if (HOLD_PATTERNS.test(prev.content)) {
        staleHoldWarning = true;
        break;
      }
      // Only look back within same speaker's recent messages
      break;
    }

    return {
      fromMessageId: m.id,
      fromSpeaker,
      fromSpeakerDisplay: m.catId ?? m.userId,
      timestamp: m.createdAt,
      staleHoldWarning,
    };
  }
  return null;
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F148-F): baton context extractor with stale-hold detection [宪宪/Opus-46🐾]"
```

---

### Task 3: Task Summarizer

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/navigation-context.ts`
- Test: `packages/api/test/f148-navigation-context.test.js` (append)

**Step 1: Write failing test — task summary**

```javascript
const { summarizeActiveTasks } = await import(
  '../dist/domains/cats/services/agents/routing/navigation-context.js'
);

describe('summarizeActiveTasks', () => {
  it('returns top 3 non-done tasks sorted by recency', () => {
    const tasks = [
      { id: 't1', title: 'Fix Redis bug', status: 'todo', ownerCatId: 'opus', updatedAt: 1000 },
      { id: 't2', title: 'Review PR #900', status: 'in-progress', ownerCatId: 'codex', updatedAt: 3000 },
      { id: 't3', title: 'Write tests', status: 'done', ownerCatId: 'opus', updatedAt: 4000 },
      { id: 't4', title: 'Deploy v2', status: 'todo', ownerCatId: null, updatedAt: 2000 },
      { id: 't5', title: 'Phase F plan', status: 'in-progress', ownerCatId: 'opus', updatedAt: 5000 },
    ];
    const result = summarizeActiveTasks(tasks);
    assert.equal(result.length, 3);
    assert.equal(result[0].title, 'Phase F plan'); // most recent
    assert.ok(result.every(t => t.status !== 'done'));
  });

  it('returns empty for no tasks', () => {
    assert.deepEqual(summarizeActiveTasks([]), []);
  });
});
```

**Step 2-5: Implement + test + commit (same TDD cycle)**

```typescript
export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  ownerCatId: string | null;
}

export function summarizeActiveTasks(
  tasks: Array<{ id: string; title: string; status: string; ownerCatId: string | null; updatedAt: number }>,
): TaskSummary[] {
  return tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
    .map(({ id, title, status, ownerCatId }) => ({ id, title, status, ownerCatId }));
}
```

---

### Task 4: Format Navigation Header

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/navigation-context.ts`
- Test: `packages/api/test/f148-navigation-context.test.js` (append)

**Step 1: Write failing test — format header**

```javascript
const { formatNavigationHeader } = await import(
  '../dist/domains/cats/services/agents/routing/navigation-context.js'
);

describe('formatNavigationHeader', () => {
  it('formats complete navigation context', () => {
    const header = formatNavigationHeader({
      intent: 'review',
      baton: { fromMessageId: 'm1', fromSpeaker: 'codex', fromSpeakerDisplay: 'codex', timestamp: 1000, staleHoldWarning: false },
      tasks: [{ id: 't1', title: 'Fix Redis', status: 'in-progress', ownerCatId: 'opus' }],
    });
    assert.ok(header.includes('review'));
    assert.ok(header.includes('codex'));
    assert.ok(header.includes('Fix Redis'));
  });

  it('includes stale hold warning when present', () => {
    const header = formatNavigationHeader({
      intent: 'general',
      baton: { fromMessageId: 'm1', fromSpeaker: 'codex', fromSpeakerDisplay: 'codex', timestamp: 1000, staleHoldWarning: true },
      tasks: [],
    });
    assert.ok(header.includes('⚠️'));
  });

  it('handles missing baton and tasks gracefully', () => {
    const header = formatNavigationHeader({ intent: 'fix', baton: null, tasks: [] });
    assert.ok(header.includes('fix'));
    assert.ok(!header.includes('undefined'));
  });
});
```

**Step 2-5: Implement + test + commit**

```typescript
export interface NavigationContext {
  intent: MentionIntent;
  baton: BatonContext | null;
  tasks: TaskSummary[];
}

export function formatNavigationHeader(ctx: NavigationContext): string {
  const lines: string[] = ['[导航]'];

  const intentLabels: Record<MentionIntent, string> = {
    review: '🔍 Review 请求',
    continue: '🔄 继续之前的工作',
    fix: '🐛 Bug 修复',
    advise: '💬 征询意见',
    general: '📌 一般提及',
  };
  lines.push(`意图: ${intentLabels[ctx.intent]}`);

  if (ctx.baton) {
    const timeStr = new Date(ctx.baton.timestamp).toISOString().slice(11, 16);
    lines.push(`传球: ${ctx.baton.fromSpeakerDisplay} → 你 (${timeStr})`);
    if (ctx.baton.staleHoldWarning) {
      lines.push(`⚠️ ${ctx.baton.fromSpeakerDisplay} 之前说过"别动/等等"，但已传球给你——以传球为准`);
    }
  }

  if (ctx.tasks.length > 0) {
    lines.push(`活跃毛线球:`);
    for (const t of ctx.tasks) {
      const owner = t.ownerCatId ? `@${t.ownerCatId}` : '未分配';
      lines.push(`  - [${t.status}] ${t.title} (${owner})`);
    }
  }

  lines.push('[/导航]');
  return lines.join('\n');
}
```

---

### Task 5: Wire into route-helpers (KD-7: ALL paths)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:40-55` (add taskStore to deps)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:554-731` (inject navigation)
- Modify: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts` (extend IncrementalContextResult)
- Test: `packages/api/test/f148-navigation-context.test.js` (integration test)

**Step 1: Add taskStore to RouteStrategyDeps**

```typescript
// route-helpers.ts line ~54
/** F148 Phase F: Task store for navigation context (optional, fail-open) */
taskStore?: import('../../stores/ports/TaskStore.js').ITaskStore;
```

**Step 2: Add navigationHeader to IncrementalContextResult**

```typescript
// route-helpers.ts line ~114
/** F148 Phase F: Navigation context header (injected on ALL paths — KD-7) */
navigationHeader?: string;
```

**Step 3: Inject navigation before cold/warm fork (line ~598, after relevant filtering)**

```typescript
// After line 597 (currentMessageFilteredOut), before line 598 (cold mention detection):

// F148 Phase F (KD-7): Navigation context — injected on ALL paths (cold + warm)
const lastUserMessage = relevant.findLast((m) => m.catId === null);
const intent = classifyIntent(lastUserMessage?.content ?? '');
const baton = extractBatonContext(relevant, catId);
const activeTasks = deps.taskStore
  ? summarizeActiveTasks(await deps.taskStore.listByThread(threadId))
  : [];
const navigationCtx: NavigationContext = { intent, baton, tasks: activeTasks };
const navigationHeader = formatNavigationHeader(navigationCtx);
```

**Step 4: Prepend navigation header to BOTH warm and cold return paths**

Warm path (line ~726): prepend to contextText
Cold path: pass into assembleSmartWindowContext, prepend there

**Step 5: Wire taskStore in index.ts where RouteStrategyDeps is constructed**

**Step 6: Test + commit**

---

### Task 6: Extend Briefing Card (cold path only)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/format-briefing.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (pass navigation to briefing)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (same)

**Step 1: Add intent + baton + tasks to briefing card expanded view**

Add new section between one-line summary and participants:
```
🏐 意图: Review 请求 | 传球: codex → 你 (08:05)
🧶 活跃任务: Fix Redis [in-progress, @opus] | Deploy v2 [todo, 未分配]
```

**Step 2: Update briefingContext to carry NavigationContext**

**Step 3: Test briefing rendering + commit**

---

### Task 7: Integration test — full pipeline

**Files:**
- Test: `packages/api/test/f148-navigation-context.test.js` (integration section)

**Step 1: Write integration test**

Mock RouteStrategyDeps with taskStore + messageStore, call assembleIncrementalContext, verify:
1. Warm path: navigationHeader present in contextText
2. Cold path: navigationHeader present + briefing card includes intent/baton/tasks
3. Stale hold warning triggers correctly

**Step 2: Run full test suite**

Run: `pnpm --filter @cat-cafe/api test`

**Step 3: Final commit**

---

## Not Building (scope guard)

- LLM-based intent classification — heuristic regex is sufficient for v1
- Cross-thread baton tracking (that's Phase J)
- Warm path briefing cards (briefing card remains cold-only, navigation header covers warm)
- Intent-aware evidence recall ranking (future Phase, depends on eval data)
