# F082 Phase 2 — Git Health Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add a Git Health dashboard to the existing Git tab, showing stale branches, orphan worktrees, and runtime drift — so 铲屎官 can answer "main 脏了什么" at a glance.

**Architecture:** One new `GET /api/workspace/git-health` endpoint in `workspace-git.ts` that runs 3 git commands (branch --merged, worktree list, rev-list for drift) and returns structured health data. Frontend adds a `HealthDashboard` section to the existing `GitPanel.tsx`. Runtime path configured via `RUNTIME_REPO_PATH` env var (optional — drift section hidden when unset).

**Tech Stack:** Node child_process (git CLI), Fastify routes, React, Tailwind CSS

**NOT building:** Auto-cleanup actions (delete stale branch, remove worktree). Phase 2 is read-only diagnostics only.

---

## Terminal Schema

```typescript
// API response: GET /api/workspace/git-health
interface GitHealthResult {
  staleBranches: Array<{
    name: string;           // e.g. "feat/f079-voting"
    lastCommitDate: string; // ISO date of branch tip
    author: string;         // last commit author (猫猫归属)
    mergedInto: string;     // "main" | "origin/main"
  }>;
  worktrees: Array<{
    path: string;           // e.g. "/Users/.../cat-cafe-f082-git-health"
    branch: string;         // e.g. "feat/f082-git-health"
    head: string;           // short sha
    isOrphan: boolean;      // true if branch already merged into main
  }>;
  runtimeDrift: {
    available: boolean;     // false if RUNTIME_REPO_PATH not set
    aheadOfMain: number;    // commits runtime has that main doesn't
    behindMain: number;     // commits main has that runtime doesn't
    runtimeHead: string;    // short sha
    mainHead: string;       // short sha
  } | null;
}
```

---

## Task 1: Backend — Stale Branches Parser

**Files:**
- Modify: `packages/api/src/routes/workspace-git.ts`
- Modify: `packages/api/test/workspace-git.test.js`

**Step 1: Write failing test for parseStaleBranches**

Append to `workspace-git.test.js`:

```js
describe('parseStaleBranches', () => {
  test('identifies merged branches with author and date', async () => {
    const { parseStaleBranches } = await import('../dist/routes/workspace-git.js');
    // Simulates `git branch --merged main --format` output (NUL-delimited)
    const mockOutput = [
      'feat/f079-voting\x002026-03-05T10:00:00+08:00\x00Alice',
      'feat/f080-completion\x002026-03-06T12:00:00+08:00\x00Bob',
      '* main\x002026-03-07T09:00:00+08:00\x00Charlie',  // current branch, should be excluded
    ].join('\n');
    const result = parseStaleBranches(mockOutput);
    assert.equal(result.length, 2); // main excluded
    assert.equal(result[0].name, 'feat/f079-voting');
    assert.equal(result[0].author, 'Alice');
    assert.ok(result[0].lastCommitDate);
  });

  test('returns empty for no merged branches', async () => {
    const { parseStaleBranches } = await import('../dist/routes/workspace-git.js');
    assert.deepEqual(parseStaleBranches(''), []);
  });

  test('excludes main and master from stale list', async () => {
    const { parseStaleBranches } = await import('../dist/routes/workspace-git.js');
    const mockOutput = [
      'main\x002026-03-07\x00X',
      'master\x002026-03-07\x00X',
      'feat/old\x002026-03-01\x00Y',
    ].join('\n');
    const result = parseStaleBranches(mockOutput);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'feat/old');
  });
});
```

Run: `cd packages/api && pnpm build && node --test test/workspace-git.test.js`
Expected: FAIL — `parseStaleBranches` not exported

**Step 2: Implement parseStaleBranches**

In `workspace-git.ts`, add after existing parsers:

```typescript
export interface StaleBranch {
  name: string;
  lastCommitDate: string;
  author: string;
  mergedInto: string;
}

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop']);

export function parseStaleBranches(stdout: string): StaleBranch[] {
  if (!stdout.trim()) return [];
  return stdout
    .trim()
    .split('\n')
    .map((line) => {
      const clean = line.replace(/^\*\s*/, '').trim();
      const [name = '', lastCommitDate = '', author = ''] = clean.split('\0');
      return { name: name.trim(), lastCommitDate, author, mergedInto: 'main' };
    })
    .filter((b) => b.name && !PROTECTED_BRANCHES.has(b.name));
}
```

**Step 3: Build + run test**

Run: `cd packages/api && pnpm build && node --test test/workspace-git.test.js`
Expected: 11 passed (8 old + 3 new)

**Step 4: Commit**

```bash
git add packages/api/src/routes/workspace-git.ts packages/api/test/workspace-git.test.js
git commit -m "feat(F082-P2): add parseStaleBranches parser + tests [布偶猫]"
```

---

## Task 2: Backend — Worktree Health Parser

**Files:**
- Modify: `packages/api/src/routes/workspace-git.ts`
- Modify: `packages/api/test/workspace-git.test.js`

**Step 1: Write failing test for parseWorktreeHealth**

```js
describe('parseWorktreeHealth', () => {
  test('marks worktrees with merged branches as orphan', async () => {
    const { parseWorktreeHealth } = await import('../dist/routes/workspace-git.js');
    const worktreeListOutput = [
      'worktree /Users/x/cat-cafe',
      'HEAD abc1234567890123456789012345678901234567',
      'branch refs/heads/main',
      '',
      'worktree /Users/x/cat-cafe-f079',
      'HEAD def1234567890123456789012345678901234567',
      'branch refs/heads/feat/f079-voting',
      '',
    ].join('\n');
    const mergedBranches = new Set(['feat/f079-voting']);
    const result = parseWorktreeHealth(worktreeListOutput, mergedBranches);
    assert.equal(result.length, 2);
    assert.equal(result[0].isOrphan, false); // main
    assert.equal(result[1].isOrphan, true);  // f079 merged
    assert.equal(result[1].branch, 'feat/f079-voting');
  });

  test('handles detached HEAD worktrees', async () => {
    const { parseWorktreeHealth } = await import('../dist/routes/workspace-git.js');
    const output = [
      'worktree /Users/x/detached',
      'HEAD abc1234567890123456789012345678901234567',
      'detached',
      '',
    ].join('\n');
    const result = parseWorktreeHealth(output, new Set());
    assert.equal(result.length, 1);
    assert.equal(result[0].branch, '(detached)');
    assert.equal(result[0].isOrphan, false);
  });
});
```

Expected: FAIL — `parseWorktreeHealth` not exported

**Step 2: Implement parseWorktreeHealth**

```typescript
export interface WorktreeHealthEntry {
  path: string;
  branch: string;
  head: string;
  isOrphan: boolean;
}

export function parseWorktreeHealth(
  porcelainOutput: string,
  mergedBranches: Set<string>,
): WorktreeHealthEntry[] {
  const entries: WorktreeHealthEntry[] = [];
  let current: Partial<WorktreeHealthEntry> = {};
  for (const line of porcelainOutput.split('\n')) {
    if (line.startsWith('worktree ')) {
      current.path = line.slice(9);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5, 13); // short sha
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === 'detached') {
      current.branch = '(detached)';
    } else if (line === '' && current.path) {
      entries.push({
        path: current.path,
        branch: current.branch ?? '(unknown)',
        head: current.head ?? '',
        isOrphan: current.branch ? mergedBranches.has(current.branch) : false,
      });
      current = {};
    }
  }
  return entries;
}
```

**Step 3: Build + run test**

Expected: 13 passed (11 + 2 new)

**Step 4: Commit**

```bash
git add packages/api/src/routes/workspace-git.ts packages/api/test/workspace-git.test.js
git commit -m "feat(F082-P2): add parseWorktreeHealth parser + tests [布偶猫]"
```

---

## Task 3: Backend — Runtime Drift Parser

**Files:**
- Modify: `packages/api/src/routes/workspace-git.ts`
- Modify: `packages/api/test/workspace-git.test.js`

**Step 1: Write failing test for parseRuntimeDrift**

```js
describe('parseRuntimeDrift', () => {
  test('parses rev-list --left-right count output', async () => {
    const { parseRuntimeDrift } = await import('../dist/routes/workspace-git.js');
    // git rev-list --left-right --count main...runtime-head
    const result = parseRuntimeDrift('3\t1\n', 'abc12345', 'def67890');
    assert.equal(result.behindMain, 3);  // left = main ahead
    assert.equal(result.aheadOfMain, 1); // right = runtime ahead
    assert.equal(result.mainHead, 'abc12345');
    assert.equal(result.runtimeHead, 'def67890');
    assert.equal(result.available, true);
  });

  test('returns zero drift when in sync', async () => {
    const { parseRuntimeDrift } = await import('../dist/routes/workspace-git.js');
    const result = parseRuntimeDrift('0\t0\n', 'abc', 'abc');
    assert.equal(result.aheadOfMain, 0);
    assert.equal(result.behindMain, 0);
  });
});
```

Expected: FAIL

**Step 2: Implement parseRuntimeDrift**

```typescript
export interface RuntimeDrift {
  available: boolean;
  aheadOfMain: number;
  behindMain: number;
  runtimeHead: string;
  mainHead: string;
}

export function parseRuntimeDrift(
  revListOutput: string,
  mainHead: string,
  runtimeHead: string,
): RuntimeDrift {
  const [left = '0', right = '0'] = revListOutput.trim().split('\t');
  return {
    available: true,
    behindMain: Number(left) || 0,
    aheadOfMain: Number(right) || 0,
    mainHead,
    runtimeHead,
  };
}
```

**Step 3: Build + test**

Expected: 15 passed (13 + 2 new)

**Step 4: Commit**

```bash
git add packages/api/src/routes/workspace-git.ts packages/api/test/workspace-git.test.js
git commit -m "feat(F082-P2): add parseRuntimeDrift parser + tests [布偶猫]"
```

---

## Task 4: Backend — `GET /api/workspace/git-health` Route

**Files:**
- Modify: `packages/api/src/routes/workspace-git.ts`

**Step 1: Add the route handler**

```typescript
// GET /api/workspace/git-health
app.get<{
  Querystring: { worktreeId?: string };
}>('/api/workspace/git-health', async (request, reply) => {
  const { worktreeId } = request.query;
  if (!worktreeId) {
    reply.status(400);
    return { error: 'worktreeId required' };
  }
  try {
    const root = await getWorktreeRoot(worktreeId);

    // 1. Stale branches: merged into main but not deleted
    const { stdout: mergedOut } = await execFileAsync(
      'git',
      ['branch', '--merged', 'main', '--format=%(refname:short)\x00%(committerdate:iso-strict)\x00%(authorname)'],
      { cwd: root, timeout: 5000 },
    );
    const staleBranches = parseStaleBranches(mergedOut);

    // 2. Worktree health
    const mergedNames = new Set(staleBranches.map((b) => b.name));
    const { stdout: wtOut } = await execFileAsync(
      'git', ['worktree', 'list', '--porcelain'],
      { cwd: root, timeout: 5000 },
    );
    const worktrees = parseWorktreeHealth(wtOut, mergedNames);

    // 3. Runtime drift (optional)
    let runtimeDrift: RuntimeDrift | null = null;
    const runtimePath = process.env.RUNTIME_REPO_PATH;
    if (runtimePath) {
      try {
        const { stdout: mainRef } = await execFileAsync(
          'git', ['rev-parse', '--short', 'HEAD'],
          { cwd: root, timeout: 3000 },
        );
        const { stdout: rtRef } = await execFileAsync(
          'git', ['rev-parse', '--short', 'HEAD'],
          { cwd: runtimePath, timeout: 3000 },
        );
        const { stdout: drift } = await execFileAsync(
          'git', ['rev-list', '--left-right', '--count', `HEAD...${rtRef.trim()}`],
          { cwd: root, timeout: 5000 },
        );
        runtimeDrift = parseRuntimeDrift(drift, mainRef.trim(), rtRef.trim());
      } catch {
        runtimeDrift = { available: false, aheadOfMain: 0, behindMain: 0, runtimeHead: '', mainHead: '' };
      }
    }

    return { staleBranches, worktrees, runtimeDrift };
  } catch (e) {
    if (e instanceof WorkspaceSecurityError) {
      reply.status(e.code === 'NOT_FOUND' ? 404 : 403);
      return { error: e.message };
    }
    throw e;
  }
});
```

**Step 2: Build**

```bash
cd packages/api && pnpm build
```

**Step 3: Commit**

```bash
git add packages/api/src/routes/workspace-git.ts
git commit -m "feat(F082-P2): add GET /api/workspace/git-health endpoint [布偶猫]"
```

**⚠️ File size check:** After Task 4, `workspace-git.ts` will be ~250 lines. Under the 350 hard limit.

---

## Task 5: Frontend — useGitHealth Hook

**Files:**
- Create: `packages/web/src/hooks/useGitHealth.ts`

**Step 1: Create the hook**

```typescript
import { useCallback, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { apiFetch } from '../utils/api-client';

export interface StaleBranch {
  name: string;
  lastCommitDate: string;
  author: string;
  mergedInto: string;
}

export interface WorktreeHealth {
  path: string;
  branch: string;
  head: string;
  isOrphan: boolean;
}

export interface RuntimeDrift {
  available: boolean;
  aheadOfMain: number;
  behindMain: number;
  runtimeHead: string;
  mainHead: string;
}

export interface GitHealthResult {
  staleBranches: StaleBranch[];
  worktrees: WorktreeHealth[];
  runtimeDrift: RuntimeDrift | null;
}

export function useGitHealth() {
  const worktreeId = useChatStore((s) => s.workspaceWorktreeId);
  const [health, setHealth] = useState<GitHealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!worktreeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/workspace/git-health?worktreeId=${encodeURIComponent(worktreeId)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      setHealth(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch git health');
    } finally {
      setLoading(false);
    }
  }, [worktreeId]);

  return { health, loading, error, fetchHealth };
}
```

**Step 2: Commit**

```bash
git add packages/web/src/hooks/useGitHealth.ts
git commit -m "feat(F082-P2): add useGitHealth hook [布偶猫]"
```

---

## Task 6: Frontend — HealthDashboard Component

**Files:**
- Create: `packages/web/src/components/workspace/HealthDashboard.tsx`

**Step 1: Create the component**

Three collapsible sections:
1. **Stale Branches** — yellow warning rows: branch name, author (猫猫), last commit date
2. **Worktrees** — list with orphan warning badge (red for orphan, green for active)
3. **Runtime Drift** — ahead/behind counters with colored indicators (hidden when `runtimeDrift === null`)

UI patterns to follow from `GitPanel.tsx`:
- Same `StatusBadge`-like badges (reuse pattern, not import — separate component)
- `text-xs`, `font-mono`, collapsible sections with ▸/▾
- Orphan worktrees get red badge "Orphan" + branch name
- Stale branches get amber badge with author name

Key behavior:
- Call `fetchHealth()` on mount
- Show "All clean!" message when no stale branches and no orphan worktrees
- Runtime drift section only renders when `runtimeDrift?.available === true`

**Target: ≤150 lines.**

**Step 2: Commit**

```bash
git add packages/web/src/components/workspace/HealthDashboard.tsx
git commit -m "feat(F082-P2): add HealthDashboard component [布偶猫]"
```

---

## Task 7: Frontend — Integrate HealthDashboard into GitPanel

**Files:**
- Modify: `packages/web/src/components/workspace/GitPanel.tsx`

**Step 1: Add HealthDashboard as a third collapsible section**

In `GitPanel.tsx`, between the Status and Log sections:
- Import `HealthDashboard`
- Add it as `<HealthDashboard />` (it manages its own data via `useGitHealth`)
- Wrap in a collapsible container like the existing Status section

**Step 2: Build**

```bash
pnpm --filter @cat-cafe/web build
```

**Step 3: Commit**

```bash
git add packages/web/src/components/workspace/GitPanel.tsx
git commit -m "feat(F082-P2): integrate HealthDashboard into Git tab [布偶猫]"
```

**⚠️ File size check:** `GitPanel.tsx` is currently 184 lines. Adding ~10 lines for integration → ~194. Under 200 warning.

---

## Task 8: Full test + quality gate

**Step 1: Run all tests**

```bash
cd packages/api && pnpm build && node --test test/workspace-git.test.js  # expect 15+
pnpm --filter @cat-cafe/web build                                        # clean
pnpm check                                                                # biome
pnpm lint                                                                 # tsc
```

**Step 2: Check file sizes**

```bash
pnpm check:dir-size  # workspace-git.ts < 350, HealthDashboard.tsx < 200
```

**Step 3: Update F082 spec — mark P2 ACs**

Edit `docs/features/F082-git-health-panel.md`: change Phase 2 `[ ]` → `[x]` for completed items.

**Step 4: Final commit + push**

```bash
git add docs/features/F082-git-health-panel.md
git commit -m "docs(F082): mark Phase 2 ACs complete [布偶猫]"
git push origin feat/f082-p2-git-health
```

---

## Security Notes

- `RUNTIME_REPO_PATH` not passed to git commands from user input — only from env var
- Reuses existing `getWorktreeRoot()` security layer
- `git branch --merged` and `git worktree list` are read-only git commands
- No user-controlled arguments in Phase 2 commands (worktreeId validated by getWorktreeRoot)
- Runtime drift catches all errors gracefully (returns `available: false`)

## Open Questions

1. **Runtime path**: Using `RUNTIME_REPO_PATH` env var. 铲屎官 needs to set this in `.env` for drift detection to work.
2. **猫猫归属**: Using git commit author name from branch tip. May not perfectly map to cat names — good enough for Phase 2, can enhance later.
