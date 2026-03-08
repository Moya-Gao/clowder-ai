# F082 Git Health Panel — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add git log + git status viewing to Hub's WorkspacePanel so users can see commit history and working tree state without a terminal.

**Architecture:** Two new GET endpoints in `workspace.ts` that call `git log` / `git status` via `execFileAsync`, plus a new "Git" tab in `WorkspacePanel.tsx` that renders commits + status in two collapsible sections. Reuses existing `getWorktreeRoot()` for path resolution and security.

**Tech Stack:** Node child_process (git CLI), Fastify routes, React, Tailwind CSS

---

## Task 1: Backend — `GET /api/workspace/git-log`

**Files:**
- Modify: `packages/api/src/routes/workspace.ts`
- Test: `packages/api/test/workspace-git.test.js` (new)

**Step 1: Write failing test for git-log endpoint**

```js
// packages/api/test/workspace-git.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Use the actual repo as test fixture (read-only git commands are safe)
const REPO_ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');

describe('GET /api/workspace/git-log', () => {
  test('returns commits with hash, author, date, subject', async () => {
    const { parseGitLog } = await import(
      '../dist/routes/workspace.js'
    );
    // Get real git log output for this repo
    const { stdout } = execFileSync('git',
      ['log', '-n', '3', '--pretty=format:%H%x00%an%x00%aI%x00%s'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    // NOTE: parseGitLog does not exist yet → this test should fail
    const commits = parseGitLog(stdout);
    assert.equal(commits.length, 3);
    assert.ok(commits[0].hash.length === 40, 'full SHA');
    assert.ok(commits[0].author, 'has author');
    assert.ok(commits[0].date, 'has date');
    assert.ok(commits[0].subject, 'has subject');
  });

  test('returns empty array for empty output', async () => {
    const { parseGitLog } = await import('../dist/routes/workspace.js');
    assert.deepEqual(parseGitLog(''), []);
  });
});
```

Run: `node --test test/workspace-git.test.js`
Expected: FAIL — `parseGitLog` not exported

**Step 2: Implement parseGitLog + route handler**

In `packages/api/src/routes/workspace.ts`, add:

```typescript
// Near top: export the parser for testing
export function parseGitLog(stdout: string): Array<{
  hash: string; short: string; author: string; date: string; subject: string;
}> {
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').map((line) => {
    const [hash, author, date, ...subjectParts] = line.split('\0');
    return { hash, short: hash.slice(0, 8), author, date, subject: subjectParts.join('\0') };
  });
}

// In the route registration function, add:
app.get<{
  Querystring: { worktreeId?: string; limit?: string };
}>('/api/workspace/git-log', async (request, reply) => {
  const { worktreeId, limit = '50' } = request.query;
  if (!worktreeId) return reply.code(400).send({ error: 'worktreeId required' });
  const root = await getWorktreeRoot(worktreeId);
  const n = Math.min(Math.max(1, Number(limit) || 50), 200);
  const { stdout } = await execFileAsync('git',
    ['log', '-n', String(n), '--pretty=format:%H%x00%an%x00%aI%x00%s'],
    { cwd: root, timeout: 5000 }
  );
  return { worktreeId, commits: parseGitLog(stdout) };
});
```

**Step 3: Build + run test**

```bash
pnpm --filter @cat-cafe/api build
node --test test/workspace-git.test.js
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/api/src/routes/workspace.ts packages/api/test/workspace-git.test.js
git commit -m "feat(F082): add GET /api/workspace/git-log endpoint [布偶猫]"
```

---

## Task 2: Backend — `GET /api/workspace/git-status`

**Files:**
- Modify: `packages/api/src/routes/workspace.ts`
- Modify: `packages/api/test/workspace-git.test.js`

**Step 1: Write failing test**

Append to `workspace-git.test.js`:

```js
describe('GET /api/workspace/git-status', () => {
  test('parseGitStatus categorizes staged/unstaged/untracked', async () => {
    const { parseGitStatus } = await import('../dist/routes/workspace.js');
    // Simulate porcelain output
    const mockOutput = [
      'M  staged-file.ts',       // staged modified
      ' M unstaged-file.ts',     // unstaged modified
      '?? new-file.ts',          // untracked
      'A  added-file.ts',        // staged new
      'MM both-file.ts',         // staged + unstaged
    ].join('\n');
    const result = parseGitStatus(mockOutput);
    assert.ok(result.staged.length >= 2, 'has staged files');
    assert.ok(result.unstaged.length >= 1, 'has unstaged files');
    assert.ok(result.untracked.length >= 1, 'has untracked files');
  });

  test('parseGitStatus returns empty categories for clean repo', async () => {
    const { parseGitStatus } = await import('../dist/routes/workspace.js');
    const result = parseGitStatus('');
    assert.deepEqual(result, { staged: [], unstaged: [], untracked: [] });
  });
});
```

Run: `node --test test/workspace-git.test.js`
Expected: FAIL — `parseGitStatus` not exported

**Step 2: Implement parseGitStatus + route**

```typescript
export function parseGitStatus(stdout: string): {
  staged: Array<{ status: string; path: string }>;
  unstaged: Array<{ status: string; path: string }>;
  untracked: Array<{ status: string; path: string }>;
} {
  const staged: Array<{ status: string; path: string }> = [];
  const unstaged: Array<{ status: string; path: string }> = [];
  const untracked: Array<{ status: string; path: string }> = [];
  if (!stdout.trim()) return { staged, unstaged, untracked };

  for (const line of stdout.trim().split('\n')) {
    if (line.length < 4) continue;
    const x = line[0]; // index (staged) status
    const y = line[1]; // worktree (unstaged) status
    const filePath = line.slice(3);
    if (x === '?' && y === '?') {
      untracked.push({ status: '??', path: filePath });
    } else {
      if (x !== ' ' && x !== '?') staged.push({ status: x, path: filePath });
      if (y !== ' ' && y !== '?') unstaged.push({ status: y, path: filePath });
    }
  }
  return { staged, unstaged, untracked };
}

app.get<{
  Querystring: { worktreeId?: string };
}>('/api/workspace/git-status', async (request, reply) => {
  const { worktreeId } = request.query;
  if (!worktreeId) return reply.code(400).send({ error: 'worktreeId required' });
  const root = await getWorktreeRoot(worktreeId);
  const { stdout } = await execFileAsync('git',
    ['status', '--porcelain', '-uall'],
    { cwd: root, timeout: 5000, maxBuffer: 1024 * 1024 }
  );
  const { stdout: branchOut } = await execFileAsync('git',
    ['branch', '--show-current'],
    { cwd: root, timeout: 3000 }
  );
  return {
    worktreeId,
    branch: branchOut.trim(),
    ...parseGitStatus(stdout),
  };
});
```

**Step 3: Build + run test**

```bash
pnpm --filter @cat-cafe/api build
node --test test/workspace-git.test.js
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/api/src/routes/workspace.ts packages/api/test/workspace-git.test.js
git commit -m "feat(F082): add GET /api/workspace/git-status endpoint [布偶猫]"
```

---

## Task 3: Backend — `GET /api/workspace/git-show` (commit detail)

**Files:**
- Modify: `packages/api/src/routes/workspace.ts`
- Modify: `packages/api/test/workspace-git.test.js`

**Step 1: Write failing test**

```js
describe('GET /api/workspace/git-show', () => {
  test('parseGitShow extracts changed files from --stat output', async () => {
    const { parseGitShow } = await import('../dist/routes/workspace.js');
    const mockStat = [
      ' src/foo.ts | 12 +++---',
      ' src/bar.ts |  3 +++',
      ' 2 files changed, 9 insertions(+), 6 deletions(-)',
    ].join('\n');
    const files = parseGitShow(mockStat);
    assert.equal(files.length, 2);
    assert.equal(files[0].path, 'src/foo.ts');
  });
});
```

**Step 2: Implement**

```typescript
export function parseGitShow(statOutput: string): Array<{ path: string; summary: string }> {
  return statOutput.trim().split('\n')
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [pathPart, ...rest] = l.split('|');
      return { path: pathPart.trim(), summary: rest.join('|').trim() };
    });
}

app.get<{
  Querystring: { worktreeId?: string; hash?: string };
}>('/api/workspace/git-show', async (request, reply) => {
  const { worktreeId, hash } = request.query;
  if (!worktreeId || !hash) return reply.code(400).send({ error: 'worktreeId and hash required' });
  // Validate hash is hex-only (prevent injection)
  if (!/^[0-9a-f]{7,40}$/i.test(hash)) return reply.code(400).send({ error: 'invalid hash' });
  const root = await getWorktreeRoot(worktreeId);
  const { stdout } = await execFileAsync('git',
    ['show', '--stat', '--no-color', hash],
    { cwd: root, timeout: 5000 }
  );
  // Split: first lines are commit info, after blank line is stat
  const parts = stdout.split('\n\n');
  const statSection = parts.length > 1 ? parts.slice(1).join('\n\n') : '';
  return { worktreeId, hash, files: parseGitShow(statSection) };
});
```

**Step 3: Build + test + commit**

---

## Task 4: Frontend — useGitPanel hook

**Files:**
- Create: `packages/web/src/hooks/useGitPanel.ts`

**Step 1: Create the hook**

```typescript
import { useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

interface GitCommit {
  hash: string; short: string; author: string; date: string; subject: string;
}
interface GitStatusResult {
  branch: string;
  staged: Array<{ status: string; path: string }>;
  unstaged: Array<{ status: string; path: string }>;
  untracked: Array<{ status: string; path: string }>;
}
interface CommitDetail {
  hash: string;
  files: Array<{ path: string; summary: string }>;
}

export function useGitPanel() {
  const worktreeId = useChatStore((s) => s.workspaceWorktreeId);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = useCallback(async (limit = 50) => {
    if (!worktreeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/git-log?worktreeId=${worktreeId}&limit=${limit}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCommits(data.commits);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch git log');
    } finally {
      setLoading(false);
    }
  }, [worktreeId]);

  const fetchStatus = useCallback(async () => {
    if (!worktreeId) return;
    try {
      const res = await fetch(`/api/workspace/git-status?worktreeId=${worktreeId}`);
      if (!res.ok) throw new Error(await res.text());
      setStatus(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch git status');
    }
  }, [worktreeId]);

  const fetchCommitDetail = useCallback(async (hash: string) => {
    if (!worktreeId) return;
    try {
      const res = await fetch(`/api/workspace/git-show?worktreeId=${worktreeId}&hash=${hash}`);
      if (!res.ok) throw new Error(await res.text());
      setCommitDetail(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch commit detail');
    }
  }, [worktreeId]);

  return { commits, status, commitDetail, loading, error, fetchLog, fetchStatus, fetchCommitDetail };
}
```

**Step 2: Commit**

```bash
git add packages/web/src/hooks/useGitPanel.ts
git commit -m "feat(F082): add useGitPanel hook for git log/status [布偶猫]"
```

---

## Task 5: Frontend — GitPanel component

**Files:**
- Create: `packages/web/src/components/workspace/GitPanel.tsx`

**Step 1: Create the component**

Build a `<GitPanel />` with two collapsible sections:

1. **Git Status** — branch name badge + staged/unstaged/untracked file lists with status indicators
2. **Git Log** — scrollable commit list, each row: `short hash | date | author | subject`, click to expand `--stat` detail

Key UI patterns to follow (from WorkspacePanel):
- Use same Tailwind classes: `text-xs`, `font-mono`, `bg-[var(--bg-secondary)]`
- Status badges: green (staged), yellow (unstaged), gray (untracked)
- Commit hash in monospace, truncated date (relative), subject ellipsis
- Click commit → toggle detail panel with changed files

Component should call `fetchLog()` + `fetchStatus()` on mount (via `useEffect`).

**Step 2: Commit**

---

## Task 6: Frontend — Integrate GitPanel into WorkspacePanel

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx`

**Step 1: Add "Git" as third viewMode**

- Change `viewMode` type from `'files' | 'changes'` to `'files' | 'changes' | 'git'`
- Add third tab button "Git" in the tab bar
- Render `<GitPanel />` when `viewMode === 'git'`

**Step 2: Build + manual test**

```bash
pnpm --filter @cat-cafe/web build
```

**Step 3: Commit**

```bash
git add packages/web/src/components/WorkspacePanel.tsx packages/web/src/components/workspace/GitPanel.tsx
git commit -m "feat(F082): add Git tab to WorkspacePanel with log + status [布偶猫]"
```

---

## Task 7: Full test + quality gate

**Step 1: Run all tests**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/workspace-git.test.js
pnpm --filter @cat-cafe/api test   # full suite
pnpm --filter @cat-cafe/web build  # frontend build check
pnpm check                          # biome
pnpm lint                           # tsc
```

**Step 2: Update F082 spec — mark P1 ACs**

**Step 3: Final commit + push**

---

## Security Notes

- `hash` parameter validated with `/^[0-9a-f]{7,40}$/i` regex to prevent command injection
- All paths go through `getWorktreeRoot()` (no user-controlled cwd)
- `--no-color` on git show to prevent ANSI escape codes in output
- `limit` clamped to 1-200 range
- `timeout: 5000` on all git commands
