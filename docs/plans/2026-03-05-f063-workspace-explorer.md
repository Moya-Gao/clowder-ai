# F063 Hub Workspace Explorer — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add a Workspace Explorer panel to the Hub that lets the铲屎官 browse files, view code with syntax highlighting, search, and edit — without opening an IDE.

**Architecture:** New `/api/workspace/*` routes serve file tree, content, and search from the worktree root. New React panel `WorkspacePanel` replaces `RightStatusPanel` when toggled. CodeMirror 6 for viewing/editing. State in `chatStore` (`workspaceMode: 'status' | 'workspace'`). Security: all paths resolved server-side against registered worktree roots.

**Tech Stack:** Hono (API), CodeMirror 6 (editor), Next.js/React (frontend), `node:fs` + `node:child_process` (file ops + grep)

**Not building in this phase:** Phase 2 (HTML/JSX preview), Phase 3 (audit logs in panel), file editing (Phase 1 is read-only + search + browse; editing is a follow-up once browse is stable).

---

## Terminal Schema

```typescript
// === API Types (packages/shared or inline) ===

interface WorkspaceTreeNode {
  name: string;
  path: string;           // relative to worktree root
  type: 'file' | 'directory';
  children?: WorkspaceTreeNode[];  // only if directory + expanded
}

interface WorkspaceFileResponse {
  path: string;
  content: string;
  sha256: string;
  size: number;
  mime: string;
  truncated: boolean;     // true if >1MB
}

interface WorkspaceSearchResult {
  path: string;
  line: number;
  content: string;        // the matching line
  contextBefore: string;  // 2 lines before
  contextAfter: string;   // 2 lines after
}

interface WorkspaceSearchResponse {
  query: string;
  results: WorkspaceSearchResult[];
  totalMatches: number;
  truncated: boolean;     // true if >100 results
}

// === Frontend State (chatStore) ===
// workspaceMode: 'status' | 'workspace'
// workspaceOpenFilePath: string | null
// workspaceWorktreeId: string | null
```

---

## Task 1: Backend — Worktree Registry + Path Security

**Files:**
- Create: `packages/api/src/domains/workspace/workspace-security.ts`
- Test: `packages/api/test/workspace-security.test.js`

**What:** Build the security foundation: worktree ID → root path mapping, path resolution with traversal/symlink/denylist guards.

**Step 1: Write failing tests**

```javascript
// packages/api/test/workspace-security.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('workspace-security', () => {
  // Tests import from dist after build — we'll test the compiled output
  let mod;
  beforeEach(async () => {
    mod = await import('../dist/domains/workspace/workspace-security.js');
  });

  it('resolves valid relative path within root', async () => {
    const result = await mod.resolveWorkspacePath('/tmp/test-root', 'src/index.ts');
    assert.ok(result.startsWith('/tmp/test-root/'));
    assert.ok(result.endsWith('src/index.ts'));
  });

  it('rejects ../ traversal', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '../etc/passwd'),
      { message: /outside workspace root/i }
    );
  });

  it('rejects absolute path', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '/etc/passwd'),
      { message: /outside workspace root/i }
    );
  });

  it('rejects URL-encoded traversal', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '%2e%2e%2fetc/passwd'),
      { message: /outside workspace root/i }
    );
  });

  it('rejects denylist file .env', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '.env'),
      { message: /denied/i }
    );
  });

  it('rejects denylist file .env.local', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '.env.local'),
      { message: /denied/i }
    );
  });

  it('rejects .git directory access', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', '.git/config'),
      { message: /denied/i }
    );
  });

  it('rejects *.pem files', async () => {
    await assert.rejects(
      () => mod.resolveWorkspacePath('/tmp/test-root', 'certs/server.pem'),
      { message: /denied/i }
    );
  });

  it('listWorktrees returns worktree entries', async () => {
    // This tests against the actual repo — will find at least the main worktree
    const entries = await mod.listWorktrees();
    assert.ok(entries.length >= 1);
    assert.ok(entries[0].id);
    assert.ok(entries[0].root);
  });
});
```

**Step 2: Run test → expect FAIL** (module not found)

```bash
cd packages/api && pnpm build && node --test test/workspace-security.test.js
```

**Step 3: Implement**

```typescript
// packages/api/src/domains/workspace/workspace-security.ts
import { resolve, relative, sep, basename } from 'node:path';
import { realpath, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Denylist patterns (checked against each path segment and full basename)
const DENYLIST_PATTERNS = [
  /^\.env/,           // .env, .env.local, .env.production
  /\.pem$/,
  /\.key$/,
  /^id_rsa/,
  /^\.git$/,          // .git directory
];

const DENYLIST_DIRS = [
  '.git',
  'secrets',
  'node_modules',     // too large, not useful for browsing
];

export class WorkspaceSecurityError extends Error {
  constructor(message: string, public readonly code: 'TRAVERSAL' | 'DENIED' | 'NOT_FOUND') {
    super(message);
    this.name = 'WorkspaceSecurityError';
  }
}

/**
 * Resolve a user-provided relative path against a workspace root.
 * Throws on traversal, symlink escape, or denylist match.
 */
export async function resolveWorkspacePath(root: string, userPath: string): Promise<string> {
  // Decode any URL-encoded chars first
  const decoded = decodeURIComponent(userPath);

  // Resolve against root
  const resolved = resolve(root, decoded);

  // Check the resolved path starts with root
  const relFromRoot = relative(root, resolved);
  if (relFromRoot.startsWith('..') || resolve(root, relFromRoot) !== resolved) {
    throw new WorkspaceSecurityError('Path outside workspace root', 'TRAVERSAL');
  }

  // Check denylist on each segment
  const segments = relFromRoot.split(sep);
  for (const seg of segments) {
    // Directory denylist
    if (DENYLIST_DIRS.includes(seg)) {
      throw new WorkspaceSecurityError(`Access denied: ${seg}`, 'DENIED');
    }
    // Pattern denylist on final segment (filename)
    if (seg === segments[segments.length - 1]) {
      for (const pat of DENYLIST_PATTERNS) {
        if (pat.test(seg)) {
          throw new WorkspaceSecurityError(`Access denied: ${seg}`, 'DENIED');
        }
      }
    }
    // Also check directory segments against .git pattern
    if (/^\.git$/.test(seg)) {
      throw new WorkspaceSecurityError(`Access denied: ${seg}`, 'DENIED');
    }
  }

  // Symlink escape check: resolve real path and verify still under root
  try {
    const stat = await lstat(resolved);
    if (stat.isSymbolicLink()) {
      const real = await realpath(resolved);
      if (!real.startsWith(root + sep) && real !== root) {
        throw new WorkspaceSecurityError('Symlink escapes workspace root', 'TRAVERSAL');
      }
    }
  } catch (e) {
    // File doesn't exist yet (for write operations) — that's OK, traversal check above covers it
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (e instanceof WorkspaceSecurityError) throw e;
    }
  }

  return resolved;
}

export interface WorktreeEntry {
  id: string;       // URL-safe identifier
  root: string;     // absolute path
  branch: string;   // branch name or HEAD
  head: string;     // commit SHA (short)
}

/**
 * List all git worktrees for the current repo.
 */
export async function listWorktrees(repoRoot?: string): Promise<WorktreeEntry[]> {
  const cwd = repoRoot ?? process.cwd();
  const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], { cwd });
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> = {};

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.root) entries.push(current as WorktreeEntry);
      const root = line.slice('worktree '.length);
      current = {
        root,
        id: basename(root).replace(/[^a-zA-Z0-9_-]/g, '_'),
      };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length, 'HEAD '.length + 8);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch refs/heads/'.length) || line.slice('branch '.length);
    }
  }
  if (current.root) entries.push(current as WorktreeEntry);

  // Deduplicate IDs
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.id)) e.id = `${e.id}_${e.head}`;
    seen.add(e.id);
  }

  return entries;
}

/** Lookup a worktree root by ID */
export async function getWorktreeRoot(worktreeId: string, repoRoot?: string): Promise<string> {
  const entries = await listWorktrees(repoRoot);
  const entry = entries.find((e) => e.id === worktreeId);
  if (!entry) throw new WorkspaceSecurityError(`Worktree not found: ${worktreeId}`, 'NOT_FOUND');
  return entry.root;
}
```

**Step 4: Build + run tests → expect PASS**

```bash
cd packages/api && pnpm build && node --test test/workspace-security.test.js
```

**Step 5: Commit**

```bash
git add packages/api/src/domains/workspace/ packages/api/test/workspace-security.test.js
git commit -m "feat(F063): workspace security — path resolution + denylist + worktree registry"
```

---

## Task 2: Backend — Workspace API Routes (tree + file + search)

**Files:**
- Create: `packages/api/src/routes/workspace.ts`
- Modify: `packages/api/src/index.ts` (register routes)
- Test: `packages/api/test/workspace-routes.test.js`

**What:** Three GET endpoints for file tree, file content, and search. All use worktreeId-based resolution.

**Step 1: Write failing tests**

```javascript
// packages/api/test/workspace-routes.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// These tests hit the actual API server — start it first or use supertest pattern
// For now, test the route handler logic directly

describe('workspace routes', () => {
  let mod;
  before(async () => {
    mod = await import('../dist/routes/workspace.js');
  });

  it('exports workspaceRoutes', () => {
    assert.ok(typeof mod.workspaceRoutes === 'function' || typeof mod.default === 'function');
  });

  // Integration tests require running server — covered by manual testing
  // The security layer is tested in workspace-security.test.js
});
```

**Step 2: Implement routes**

```typescript
// packages/api/src/routes/workspace.ts
import { Hono } from 'hono';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  resolveWorkspacePath,
  getWorktreeRoot,
  listWorktrees,
  WorkspaceSecurityError,
} from '../domains/workspace/workspace-security.js';

const execFileAsync = promisify(execFile);
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_SEARCH_RESULTS = 100;
const MAX_TREE_DEPTH = 4;

const MIME_MAP: Record<string, string> = {
  '.ts': 'text/typescript', '.tsx': 'text/tsx', '.js': 'text/javascript',
  '.jsx': 'text/jsx', '.json': 'application/json', '.md': 'text/markdown',
  '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.yaml': 'text/yaml', '.yml': 'text/yaml', '.toml': 'text/toml',
  '.sh': 'text/x-shellscript', '.py': 'text/x-python',
};

function guessMime(filepath: string): string {
  return MIME_MAP[extname(filepath)] ?? 'text/plain';
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

async function buildTree(root: string, dirPath: string, depth: number, maxDepth: number): Promise<TreeNode[]> {
  if (depth >= maxDepth) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  // Sort: directories first, then files, alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip hidden dirs, node_modules, .git
    if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(root, fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(root, fullPath, depth + 1, maxDepth);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }
  return nodes;
}

export function workspaceRoutes(): Hono {
  const app = new Hono();

  // GET /worktrees — list available worktrees
  app.get('/worktrees', async (c) => {
    try {
      const entries = await listWorktrees();
      return c.json({ worktrees: entries });
    } catch (e) {
      return c.json({ error: 'Failed to list worktrees' }, 500);
    }
  });

  // GET /tree?worktreeId=&path=&depth=
  app.get('/tree', async (c) => {
    const worktreeId = c.req.query('worktreeId');
    const subpath = c.req.query('path') ?? '';
    const depth = Math.min(Number(c.req.query('depth') ?? 3), MAX_TREE_DEPTH);

    if (!worktreeId) return c.json({ error: 'worktreeId required' }, 400);

    try {
      const root = await getWorktreeRoot(worktreeId);
      const resolved = subpath ? await resolveWorkspacePath(root, subpath) : root;
      const tree = await buildTree(root, resolved, 0, depth);
      return c.json({ root: subpath || '.', worktreeId, tree });
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        return c.json({ error: e.message }, e.code === 'NOT_FOUND' ? 404 : 403);
      }
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // GET /file?worktreeId=&path=
  app.get('/file', async (c) => {
    const worktreeId = c.req.query('worktreeId');
    const filePath = c.req.query('path');
    if (!worktreeId || !filePath) return c.json({ error: 'worktreeId and path required' }, 400);

    try {
      const root = await getWorktreeRoot(worktreeId);
      const resolved = await resolveWorkspacePath(root, filePath);
      const fileStat = await stat(resolved);

      if (fileStat.isDirectory()) {
        return c.json({ error: 'Path is a directory' }, 400);
      }

      const mime = guessMime(resolved);
      const isBinary = mime.startsWith('image/');

      if (isBinary) {
        // Return metadata only for binary files (frontend fetches via URL)
        return c.json({
          path: filePath,
          content: '',
          sha256: '',
          size: fileStat.size,
          mime,
          truncated: false,
          binary: true,
        });
      }

      const truncated = fileStat.size > MAX_FILE_SIZE;
      const content = await readFile(resolved, 'utf-8');
      const displayContent = truncated ? content.slice(0, MAX_FILE_SIZE) : content;

      return c.json({
        path: filePath,
        content: displayContent,
        sha256: sha256(content),
        size: fileStat.size,
        mime,
        truncated,
      });
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        return c.json({ error: e.message }, e.code === 'NOT_FOUND' ? 404 : 403);
      }
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return c.json({ error: 'File not found' }, 404);
      }
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // POST /search { worktreeId, query, type, limit }
  app.post('/search', async (c) => {
    const body = await c.req.json<{
      worktreeId: string;
      query: string;
      type?: 'content' | 'filename';
      limit?: number;
    }>();

    if (!body.worktreeId || !body.query) return c.json({ error: 'worktreeId and query required' }, 400);
    if (body.query.length > 200) return c.json({ error: 'Query too long' }, 400);

    const limit = Math.min(body.limit ?? 50, MAX_SEARCH_RESULTS);

    try {
      const root = await getWorktreeRoot(body.worktreeId);

      if (body.type === 'filename') {
        // Filename search using find
        const { stdout } = await execFileAsync('find', [
          root, '-type', 'f', '-name', `*${body.query}*`,
          '-not', '-path', '*/node_modules/*',
          '-not', '-path', '*/.git/*',
          '-not', '-path', '*/.next/*',
          '-not', '-path', '*/dist/*',
        ], { timeout: 5000, maxBuffer: 1024 * 1024 });

        const results = stdout.trim().split('\n')
          .filter(Boolean)
          .slice(0, limit)
          .map((fullPath) => ({
            path: relative(root, fullPath),
            line: 0,
            content: '',
            contextBefore: '',
            contextAfter: '',
          }));

        return c.json({ query: body.query, results, totalMatches: results.length, truncated: false });
      }

      // Content search using grep
      const { stdout } = await execFileAsync('grep', [
        '-rn', '--include=*.ts', '--include=*.tsx', '--include=*.js',
        '--include=*.jsx', '--include=*.json', '--include=*.md',
        '--include=*.css', '--include=*.html', '--include=*.yaml',
        '--include=*.yml', '--include=*.sh', '--include=*.py',
        '-l',  // Just list files first for count
        body.query, root,
      ], { timeout: 10000, maxBuffer: 5 * 1024 * 1024 }).catch(() => ({ stdout: '' }));

      // Now get line-level matches
      const { stdout: lineOutput } = await execFileAsync('grep', [
        '-rn', '-B2', '-A2',
        '--include=*.ts', '--include=*.tsx', '--include=*.js',
        '--include=*.jsx', '--include=*.json', '--include=*.md',
        '--include=*.css', '--include=*.html',
        body.query, root,
      ], { timeout: 10000, maxBuffer: 5 * 1024 * 1024 }).catch(() => ({ stdout: '' }));

      // Parse grep output (file:line:content format)
      const results: Array<{ path: string; line: number; content: string; contextBefore: string; contextAfter: string }> = [];
      const groups = lineOutput.split('--\n');

      for (const group of groups) {
        if (results.length >= limit) break;
        const lines = group.trim().split('\n').filter(Boolean);
        const matchLine = lines.find((l) => {
          const m = l.match(/^(.+?):(\d+):/);
          return m && l.includes(body.query);
        });
        if (!matchLine) continue;

        const match = matchLine.match(/^(.+?):(\d+):(.*)$/);
        if (!match) continue;

        const [, fullPath, lineStr, content] = match;
        const relPath = relative(root, fullPath);

        // Skip denylist paths
        if (relPath.includes('node_modules') || relPath.includes('.git')) continue;

        const beforeLines = lines.filter((l) => l !== matchLine && lines.indexOf(l) < lines.indexOf(matchLine));
        const afterLines = lines.filter((l) => l !== matchLine && lines.indexOf(l) > lines.indexOf(matchLine));

        results.push({
          path: relPath,
          line: parseInt(lineStr, 10),
          content: content.trim(),
          contextBefore: beforeLines.map((l) => l.replace(/^.+?:\d+[:-]/, '')).join('\n'),
          contextAfter: afterLines.map((l) => l.replace(/^.+?:\d+[:-]/, '')).join('\n'),
        });
      }

      const fileCount = stdout.trim().split('\n').filter(Boolean).length;
      return c.json({
        query: body.query,
        results,
        totalMatches: fileCount,
        truncated: results.length >= limit,
      });
    } catch (e) {
      if (e instanceof WorkspaceSecurityError) {
        return c.json({ error: e.message }, e.code === 'NOT_FOUND' ? 404 : 403);
      }
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  return app;
}
```

**Step 3: Register routes in API index**

Find where other routes are registered (likely `packages/api/src/index.ts`) and add:
```typescript
import { workspaceRoutes } from './routes/workspace.js';
// ...
app.route('/api/workspace', workspaceRoutes());
```

**Step 4: Build + test**

```bash
cd packages/api && pnpm build && node --test test/workspace-routes.test.js
```

**Step 5: Manual smoke test** (start dev server, curl the endpoints)

```bash
curl http://localhost:3001/api/workspace/worktrees | jq .
curl "http://localhost:3001/api/workspace/tree?worktreeId=cat-cafe&depth=2" | jq .
curl "http://localhost:3001/api/workspace/file?worktreeId=cat-cafe&path=package.json" | jq .
```

**Step 6: Commit**

```bash
git add packages/api/src/routes/workspace.ts packages/api/src/index.ts packages/api/test/workspace-routes.test.js
git commit -m "feat(F063): workspace API routes — tree, file, search endpoints"
```

---

## Task 3: Frontend — Workspace Panel (file tree + viewer)

**Files:**
- Create: `packages/web/src/components/WorkspacePanel.tsx`
- Create: `packages/web/src/hooks/useWorkspace.ts`
- Modify: `packages/web/src/components/ChatContainer.tsx` (add workspace toggle)
- Modify: `packages/web/src/components/ChatContainerHeader.tsx` (add 📁 button)
- Modify: `packages/web/src/stores/chatStore.ts` (add workspace state)

**What:** The 50:50 split panel with file tree on top, code viewer on bottom. Toggle button in header switches between status panel and workspace panel.

**Step 1: Add workspace state to chatStore**

Add to `chatStore.ts`:
```typescript
// In the store state:
rightPanelMode: 'status' | 'workspace';
workspaceWorktreeId: string | null;
workspaceOpenFilePath: string | null;

// Actions:
setRightPanelMode: (mode: 'status' | 'workspace') => void;
setWorkspaceWorktreeId: (id: string | null) => void;
setWorkspaceOpenFile: (path: string | null) => void;
```

**Step 2: Create useWorkspace hook**

```typescript
// packages/web/src/hooks/useWorkspace.ts
// Fetches tree, file content, search results from /api/workspace/*
// Uses apiFetch for consistency
// Returns: { tree, file, search, loading, error, fetchTree, fetchFile, searchFiles }
```

**Step 3: Create WorkspacePanel component**

Layout (inside the panel):
```
┌─── Worktree indicator ────────────────┐
│ 🌿 feat/f060  abc1234                 │
├─── File tree (scrollable) ────────────┤
│ 📂 packages/                          │
│   📂 api/src/                         │
│     📄 index.ts                       │
│   📂 web/src/                         │
├─── Search bar ────────────────────────┤
│ 🔍 [search input                    ] │
├─── File viewer (CodeMirror) ──────────┤
│ 1│ import { Hono } from 'hono';       │
│ 2│ ...                                │
└───────────────────────────────────────┘
```

- File tree: clickable items, expand/collapse dirs
- Search: input + results list (click to open file at line)
- Viewer: CodeMirror 6 with syntax highlighting, read-only by default

**Step 4: Wire up ChatContainer**

In `ChatContainer.tsx`:
- Import `WorkspacePanel`
- Replace the `{statusPanelOpen && <RightStatusPanel .../>}` block with:
  ```tsx
  {statusPanelOpen && rightPanelMode === 'status' && <RightStatusPanel ... />}
  {statusPanelOpen && rightPanelMode === 'workspace' && <WorkspacePanel threadId={threadId} />}
  ```

**Step 5: Add 📁 toggle to ChatContainerHeader**

Add a button next to the existing status panel toggle that switches `rightPanelMode` between `'status'` and `'workspace'`.

**Step 6: Install CodeMirror 6**

```bash
pnpm --filter @cat-cafe/web add @codemirror/view @codemirror/state @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-css @codemirror/lang-html @codemirror/theme-one-dark
```

**Step 7: Test manually**

- Click 📁 → workspace panel opens
- File tree loads from API
- Click file → content shown in CodeMirror
- Search → results shown → click result → file opens at line
- Click status icon → back to status panel

**Step 8: Commit**

```bash
git add packages/web/src/components/WorkspacePanel.tsx packages/web/src/hooks/useWorkspace.ts
git add packages/web/src/components/ChatContainer.tsx packages/web/src/components/ChatContainerHeader.tsx
git add packages/web/src/stores/chatStore.ts
git commit -m "feat(F063): workspace panel — file tree + CodeMirror viewer + search"
```

---

## Task 4: File Path Clickable Links in Chat Messages

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx` (or markdown renderer)
- Test: manual — click file path in chat message → opens in workspace panel

**What:** When a cat mentions `packages/api/src/routes/workspace.ts:42` in a message, it becomes a clickable link that opens the file in the workspace panel at that line.

**Step 1: Add path detection regex**

Pattern: paths that look like `packages/.../*.ts:123` or `docs/features/F063-*.md`

**Step 2: Wrap matches in clickable spans**

On click: set `workspaceOpenFile` + `rightPanelMode = 'workspace'` + scroll to line.

**Step 3: Commit**

```bash
git commit -m "feat(F063): clickable file paths in chat messages → workspace panel"
```

---

## Task 5: Polish + Quality Gate

**Files:** Various small fixes

**What:**
1. Run `pnpm check` (Biome) — fix any new lint errors
2. Run `pnpm lint` (TypeScript) — fix type errors
3. Run `pnpm build` — verify clean build
4. Run full test suite — verify no regressions
5. Run `pnpm check:dir-size` — verify directory limits
6. Update `docs/features/F063-hub-workspace-explorer.md` — mark Phase 1 progress

**Commit:**
```bash
git commit -m "chore(F063): lint + type fixes + quality gate pass"
```

---

## Summary

| Task | What | Est. Complexity |
|------|------|-----------------|
| 1 | Security layer (path resolution + denylist + worktree registry) | Medium |
| 2 | API routes (tree + file + search) | Medium |
| 3 | Frontend panel (file tree + CodeMirror + search UI + toggle) | Large |
| 4 | Clickable file paths in chat | Small |
| 5 | Polish + quality gate | Small |

**Total: 5 tasks, ~200-350 lines backend + ~300-400 lines frontend**
