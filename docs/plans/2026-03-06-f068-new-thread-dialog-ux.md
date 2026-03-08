# F068 — 新建对话弹窗 UX 优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Replace the clunky directory browser in "新建对话" modal with a native OS folder picker + path input + recent projects.

**Architecture:** Backend adds `POST /api/projects/pick-directory` that shells out to `osascript` (macOS) to open native NSOpenPanel. Frontend replaces the collapsible directory browser with a big "选择文件夹" button, a path input field, and a streamlined recent-projects list. The `/api/projects/browse` route stays (not deleted) for backwards compat but the UI no longer calls it.

**Tech Stack:** Fastify (backend), React + Tailwind (frontend), `node:child_process` (osascript), Vitest (tests)

---

## Task 1: Backend — `POST /api/projects/pick-directory`

**Files:**
- Modify: `packages/api/src/routes/projects.ts`
- Modify: `packages/api/src/routes/index.ts` (if re-export needed — check)
- Test: `test/pick-directory.test.js`

### Step 1: Write the failing test

```js
// test/pick-directory.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// We'll test the osascript helper directly, not through HTTP
// (HTTP integration test would need full app setup)

describe('pickDirectory via osascript', () => {
  it('returns trimmed path on success', async () => {
    // Will import from routes/projects.ts once implemented
    const { execPickDirectory } = await import('../packages/api/src/routes/projects.js');
    // Mock execFile to simulate osascript returning a path
    // This test will fail because execPickDirectory doesn't exist yet
    assert.ok(typeof execPickDirectory === 'function');
  });
});
```

### Step 2: Implement `execPickDirectory` + route

In `packages/api/src/routes/projects.ts`, add:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

/**
 * Shell out to macOS osascript to open native folder picker.
 * Returns the selected absolute path, or null if user cancelled.
 */
export async function execPickDirectory(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e', 'POSIX path of (choose folder)',
    ], { timeout: 120_000 }); // 2 min timeout for user to pick
    const picked = stdout.trim().replace(/\/$/, ''); // remove trailing slash
    if (!picked) return null;
    // Verify it's a real directory
    const s = await stat(picked);
    if (!s.isDirectory()) return null;
    return picked;
  } catch {
    // User cancelled (osascript exits with code 1) or timeout
    return null;
  }
}
```

Add route in same file inside `projectsRoutes`:

```ts
// POST /api/projects/pick-directory - open native macOS folder picker
app.post('/api/projects/pick-directory', async (_request, reply) => {
  const picked = await execPickDirectory();
  if (!picked) {
    reply.status(204); // No Content = user cancelled
    return;
  }
  // Validate the picked path is under allowed roots
  const validated = await validateProjectPath(picked);
  if (!validated) {
    reply.status(403);
    return { error: 'Selected directory is outside allowed roots' };
  }
  return { path: validated, name: basename(validated) };
});
```

### Step 3: Write proper tests

```js
// test/pick-directory.test.js
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('POST /api/projects/pick-directory', () => {
  it('returns 204 when user cancels', async () => {
    // Integration test with app.inject()
    // Setup: mock execPickDirectory to return null
  });

  it('returns path when user picks valid directory', async () => {
    // Setup: mock execPickDirectory to return '/Users/test/projects'
  });

  it('returns 403 for path outside allowed roots', async () => {
    // Setup: mock execPickDirectory to return '/etc/secrets'
  });
});
```

### Step 4: Run tests, verify pass

```bash
cd packages/api && node --test test/pick-directory.test.js
```

### Step 5: Commit

```bash
git add packages/api/src/routes/projects.ts test/pick-directory.test.js
git commit -m "feat(F068): add POST /api/projects/pick-directory with osascript native picker"
```

---

## Task 2: Frontend — Rewrite DirectoryPickerModal

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`
- Test: `packages/web/src/components/ThreadSidebar/__tests__/directory-picker-modal.test.ts`

### Step 1: Read and understand existing test file

The test mocks `apiFetch` and tests browse behavior. We need to:
- Remove browse-related tests
- Add tests for pick-directory button + path input

### Step 2: Update the test file

Add test cases:
1. Clicking "选择文件夹" calls `POST /api/projects/pick-directory` and calls `onSelect` with returned path
2. User cancel (204) shows no error, stays in modal
3. Path input: typing path + pressing Enter calls `onSelect`
4. Recent projects still render and are clickable
5. Lobby button still works

### Step 3: Rewrite DirectoryPickerModal

Remove:
- `browseData`, `isLoading`, `error` state (browse-related)
- `browseExpanded` state
- `browseTo` callback
- `useEffect` that calls `browseTo` on mount
- Entire "浏览其他目录" collapsible section
- `/api/projects/browse` fetch calls

Add:
- `pickDirectory` async function that calls `POST /api/projects/pick-directory`
- `pathInput` state + handler for manual path entry
- `isPicking` state (loading while native picker is open)

New layout (top to bottom):
1. Header (新建对话 + close button) — keep as-is
2. CatSelector — keep as-is
3. Session binding — keep as-is
4. **"选择文件夹" button** — calls `pickDirectory()`, shows spinner while picking
5. **Divider** — "─── 或 ───"
6. **Path input row** — text input + go button
7. **Recent projects** — existing projects list + lobby (moved from middle to bottom, streamlined)

### Step 4: Implement the rewrite

Key new code:

```tsx
const [pathInput, setPathInput] = useState('');
const [isPicking, setIsPicking] = useState(false);
const [pathError, setPathError] = useState<string | null>(null);

const pickDirectory = useCallback(async () => {
  setIsPicking(true);
  setPathError(null);
  try {
    const res = await apiFetch('/api/projects/pick-directory', { method: 'POST' });
    if (res.status === 204) {
      // User cancelled — do nothing
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setPathError(data.error || 'Failed to pick directory');
      return;
    }
    const data = await res.json();
    selectWithCats(data.path);
  } catch {
    setPathError('无法连接到服务器');
  } finally {
    setIsPicking(false);
  }
}, [selectWithCats]);

const handlePathSubmit = useCallback(() => {
  const trimmed = pathInput.trim();
  if (trimmed) {
    selectWithCats(trimmed);
  }
}, [pathInput, selectWithCats]);
```

### Step 5: Run tests

```bash
cd packages/web && pnpm vitest run src/components/ThreadSidebar/__tests__/directory-picker-modal.test.ts
```

### Step 6: Visual check (build)

```bash
cd packages/web && pnpm build
```

### Step 7: Commit

```bash
git add packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx \
       packages/web/src/components/ThreadSidebar/__tests__/directory-picker-modal.test.ts
git commit -m "feat(F068): rewrite DirectoryPickerModal with native picker + path input"
```

---

## Task 3: Cleanup — Remove unused browse API calls from frontend

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`

### Step 1: Verify no other frontend code calls `/api/projects/browse`

```bash
grep -r "projects/browse" packages/web/src/
```

If DirectoryPickerModal was the only consumer, the browse route can remain in the API (backwards compat / potential future use) but the frontend types `DirEntry` and `BrowseResult` can be removed from the component.

### Step 2: Remove dead types/imports

Remove `DirEntry`, `BrowseResult` interfaces from DirectoryPickerModal.tsx if no longer used.

### Step 3: Run full test suite + build

```bash
cd packages/web && pnpm vitest run && pnpm build
```

### Step 4: Commit

```bash
git commit -m "refactor(F068): remove unused browse types from DirectoryPickerModal"
```

---

## Not Building

- **Linux/Windows support** — `osascript` is macOS only; cross-platform is out of scope (noted in Open Questions)
- **Deleting `/api/projects/browse` route** — keep for backwards compat
- **Redesigning CatSelector** — unchanged
- **Session binding UI changes** — unchanged
