---
doc_kind: plan
feature_ids: [F152]
phase: B
created: 2026-04-10
---

# F152 Phase B: Expedition Bootstrap Orchestrator — Implementation Plan

**Feature:** F152 — `docs/features/F152-expedition-memory.md`
**Goal:** When a cat enters any project, automatically detect memory index state, offer/auto-start bootstrap, show progress non-blockingly, and present a summary card when done.
**Acceptance Criteria:**
- AC-B1: Auto-trigger bootstrap on entering project without evidence.sqlite
- AC-B2: Bootstrap produces project summary (tech stack, dirs, modules, docs)
- AC-B3: Idempotency — don't re-bootstrap existing indexes
- AC-B4: Hook into F070 governance bootstrap chain (projects-setup.ts)
- AC-B5: Fingerprint/freshness idempotency (headCommit + scannerVersion + scanMode)
- AC-B6: Structural summary, no LLM dependency
- AC-B7: index_state five-state machine (missing/stale/building/ready/failed)
- AC-B8: Old user path — prompt card with confirm/snooze (7-day cooldown)
- AC-B9: New project path — auto-chain after ProjectSetupCard
- AC-B10: Non-blocking scan + WebSocket staged progress + collapsible pill
- AC-B11: Summary card (repo profile + tier coverage + CTAs)
- AC-B12: Security guardrails (symlink, secrets, binary, budget)
**Architecture:** Backend: `IndexStateManager` (state machine) + `ExpeditionBootstrapService` (orchestrator) hooked into `projects-setup.ts`. Progress via SocketManager WebSocket events. Frontend: three new components (PromptCard, ProgressPill, SummaryCard) using coral cocreator color system, chained after ProjectSetupCard.
**Tech Stack:** TypeScript, SQLite (better-sqlite3), Socket.IO, React, Tailwind CSS
**Visual ref:** PR #299 (ProjectSetupCard) — coral color system (#e29578), cocreator CSS vars
**前端验证:** Yes — reviewer 必须启动 dev 截图验证前端组件 (KD-17)

**What we're NOT building:**
- Phase C (global lesson distillation)
- LLM-powered summary (structural only per AC-B6)
- Per-package monorepo deep scan (KD-9)
- MemoryHub rebuild button (just upgrade banner pointing to it)

---

## Terminal Schema

```typescript
// --- index_state table (SCHEMA_V11) ---
interface IndexStateRow {
  id: string;                    // sha256(projectPath)
  project_path: string;
  status: 'missing' | 'stale' | 'building' | 'ready' | 'failed';
  fingerprint: string;           // `${headCommit}:${scannerVersion}:${scanMode}`
  last_scan_at: string | null;   // ISO8601
  snoozed_until: string | null;  // ISO8601, 7-day cooldown
  docs_indexed: number;
  docs_total: number;
  error_message: string | null;
  summary_json: string | null;   // JSON-encoded ProjectSummary
  created_at: string;
  updated_at: string;
}

// --- ExpeditionBootstrapService output ---
interface ProjectSummary {
  projectName: string;
  techStack: string[];
  dirStructure: string[];        // top-2-level dirs
  coreModules: string[];         // detected from manifests
  docsList: Array<{ path: string; tier: ProvenanceTier }>;
  tierCoverage: Record<ProvenanceTier, number>;
}

interface BootstrapProgress {
  phase: 'scanning' | 'extracting' | 'indexing' | 'summarizing';
  phaseIndex: number;            // 0-3
  totalPhases: 4;
  docsProcessed: number;
  docsTotal: number;
  elapsedMs: number;
}

// --- WebSocket events ---
// 'index:progress'  → BootstrapProgress
// 'index:complete'  → { projectPath, summary: ProjectSummary, durationMs }
// 'index:failed'    → { projectPath, error: string }

// --- API ---
// GET  /api/projects/:projectPath/index-state  → IndexStateRow
// POST /api/projects/bootstrap                  → { started: true }
// POST /api/projects/bootstrap/snooze           → { snoozedUntil: string }
```

---

## Task 1: index_state Schema + IndexStateManager

**Covers:** AC-B7 (five-state machine), AC-B3/B5 (idempotency + fingerprint)

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` — add index_state table (SCHEMA_V11)
- Create: `packages/api/src/domains/memory/IndexStateManager.ts`
- Create: `packages/api/test/domains/memory/IndexStateManager.test.ts`

### Step 1: Write failing test — state machine transitions

```typescript
// IndexStateManager.test.ts
describe('IndexStateManager', () => {
  it('returns missing for unknown project', () => {
    const mgr = new IndexStateManager(db);
    expect(mgr.getState('/tmp/foo').status).toBe('missing');
  });

  it('transitions missing → building → ready', () => {
    const mgr = new IndexStateManager(db);
    mgr.startBuilding('/tmp/foo', 'abc123:1.0:full');
    expect(mgr.getState('/tmp/foo').status).toBe('building');
    mgr.markReady('/tmp/foo', 42, summaryJson);
    expect(mgr.getState('/tmp/foo').status).toBe('ready');
  });

  it('transitions building → failed', () => {
    const mgr = new IndexStateManager(db);
    mgr.startBuilding('/tmp/foo', 'abc:1:full');
    mgr.markFailed('/tmp/foo', 'timeout');
    const s = mgr.getState('/tmp/foo');
    expect(s.status).toBe('failed');
    expect(s.error_message).toBe('timeout');
  });

  it('detects stale when fingerprint changes', () => {
    const mgr = new IndexStateManager(db);
    mgr.startBuilding('/tmp/foo', 'abc:1:full');
    mgr.markReady('/tmp/foo', 10, '{}');
    expect(mgr.getState('/tmp/foo', 'def:1:full').status).toBe('stale');
  });

  it('respects snooze cooldown', () => {
    const mgr = new IndexStateManager(db);
    mgr.snooze('/tmp/foo');
    expect(mgr.isSnoozed('/tmp/foo')).toBe(true);
  });

  it('skips if same fingerprint already ready', () => {
    const mgr = new IndexStateManager(db);
    mgr.startBuilding('/tmp/foo', 'abc:1:full');
    mgr.markReady('/tmp/foo', 10, '{}');
    expect(mgr.shouldBootstrap('/tmp/foo', 'abc:1:full')).toBe(false);
  });
});
```

### Step 2: Run test → confirm RED

```bash
pnpm --filter @cat-cafe/api test -- --grep "IndexStateManager"
```

### Step 3: Implement schema migration + IndexStateManager

Add to `schema.ts`:
```sql
CREATE TABLE IF NOT EXISTS index_state (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'missing',
  fingerprint TEXT NOT NULL DEFAULT '',
  last_scan_at TEXT,
  snoozed_until TEXT,
  docs_indexed INTEGER DEFAULT 0,
  docs_total INTEGER DEFAULT 0,
  error_message TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Implement `IndexStateManager` class with:
- `getState(projectPath, currentFingerprint?)` → returns status, auto-downgrades ready→stale if fingerprint differs
- `shouldBootstrap(projectPath, fingerprint)` → true if missing/stale/failed AND not snoozed AND not currently building
- `startBuilding(projectPath, fingerprint)` → upsert with status=building
- `markReady(projectPath, docsIndexed, summaryJson)` → update status=ready
- `markFailed(projectPath, error)` → update status=failed
- `snooze(projectPath, days=7)` → set snoozed_until
- `isSnoozed(projectPath)` → check snoozed_until > now

### Step 4: Run test → confirm GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): index_state schema + IndexStateManager five-state machine [布偶猫🐾]"
```

---

## Task 2: ExpeditionBootstrapService

**Covers:** AC-B1 (auto-trigger), AC-B2 (project summary), AC-B6 (structural summary), AC-B12 (security guardrails)

**Files:**
- Create: `packages/api/src/domains/memory/ExpeditionBootstrapService.ts`
- Create: `packages/api/test/domains/memory/ExpeditionBootstrapService.test.ts`

### Step 1: Write failing test — full bootstrap flow

```typescript
describe('ExpeditionBootstrapService', () => {
  it('bootstraps a project: scan → index → summary', async () => {
    const svc = new ExpeditionBootstrapService(indexBuilder, stateManager);
    const result = await svc.bootstrap('/tmp/test-project', {
      onProgress: progressSpy,
    });
    expect(result.status).toBe('ready');
    expect(result.summary.projectName).toBe('test-project');
    expect(result.summary.techStack).toContain('node');
    expect(result.docsIndexed).toBeGreaterThan(0);
    expect(progressSpy).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'scanning' })
    );
  });

  it('skips bootstrap if fingerprint matches (idempotent)', async () => {
    const svc = new ExpeditionBootstrapService(indexBuilder, stateManager);
    // Pre-seed ready state with matching fingerprint
    stateManager.startBuilding('/tmp/foo', 'abc:1:full');
    stateManager.markReady('/tmp/foo', 5, '{}');
    const result = await svc.bootstrap('/tmp/foo');
    expect(result.status).toBe('skipped');
  });

  it('rejects symlink escape', async () => {
    const svc = new ExpeditionBootstrapService(indexBuilder, stateManager);
    // Create a symlink pointing outside project root
    await expect(svc.bootstrap('/tmp/has-escape-symlink')).rejects.toThrow(/symlink/);
  });

  it('enforces file budget on large repos', async () => {
    const svc = new ExpeditionBootstrapService(indexBuilder, stateManager);
    const result = await svc.bootstrap('/tmp/large-repo', {
      maxFiles: 100,
    });
    expect(result.summary.docsList.length).toBeLessThanOrEqual(100);
  });
});
```

### Step 2: Run test → RED

### Step 3: Implement ExpeditionBootstrapService

Core flow:
```
bootstrap(projectPath, options?) →
  1. computeFingerprint(projectPath) — git HEAD + scanner version + scan mode
  2. stateManager.shouldBootstrap(path, fp) → skip if false
  3. stateManager.startBuilding(path, fp)
  4. securityCheck(path) — symlink escape, secrets dirs
  5. emit progress: { phase: 'scanning' }
  6. scanner = indexBuilder.detectScanner(path)
  7. scannedDocs = scanner.scan(path, { budget, excludePatterns })
  8. emit progress: { phase: 'extracting' }
  9. structuralSummary = buildStructuralSummary(path, scannedDocs)
  10. emit progress: { phase: 'indexing' }
  11. indexBuilder.rebuild({ scanResults: scannedDocs })
  12. emit progress: { phase: 'summarizing' }
  13. stateManager.markReady(path, count, JSON.stringify(summary))
  14. return { status: 'ready', summary, docsIndexed, durationMs }
```

Security guardrails (AC-B12):
- `realpathSync()` check on all scanned files — must be inside projectPath
- Exclude patterns: `.env*`, `*.key`, `*.pem`, `credentials*`, `secrets/`
- Binary exclusion: skip files > 1MB or with binary-detection heuristic
- Budget: `maxFiles` (default 500), `maxBytes` (default 50MB), timeout 120s

`buildStructuralSummary(projectPath, docs)`:
- projectName: basename of projectPath
- techStack: detect from manifests (package.json→node, Cargo.toml→rust, etc.)
- dirStructure: top-2-level non-hidden dirs
- coreModules: from workspace manifests or src/ subdirs
- docsList: scanned docs with their tier
- tierCoverage: count per tier

### Step 4: Run test → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): ExpeditionBootstrapService — orchestrator + security guardrails [布偶猫🐾]"
```

---

## Task 3: API Endpoints + WebSocket Progress

**Covers:** AC-B4 (hook into governance chain), AC-B10 (WebSocket progress)

**Files:**
- Modify: `packages/api/src/routes/projects-setup.ts` — chain bootstrap after governance
- Create: `packages/api/src/routes/projects-bootstrap.ts` — dedicated bootstrap routes
- Create: `packages/api/test/routes/projects-bootstrap.test.ts`

### Step 1: Write failing test — bootstrap API

```typescript
describe('POST /api/projects/bootstrap', () => {
  it('starts bootstrap and returns immediately', async () => {
    const res = await request(app).post('/api/projects/bootstrap')
      .send({ projectPath: '/tmp/test-proj' });
    expect(res.status).toBe(202); // Accepted — async
    expect(res.body.started).toBe(true);
  });

  it('returns current state via GET', async () => {
    const res = await request(app).get('/api/projects/index-state')
      .query({ projectPath: '/tmp/test-proj' });
    expect(res.body.status).toMatch(/missing|building|ready/);
  });

  it('snoozes for 7 days', async () => {
    const res = await request(app).post('/api/projects/bootstrap/snooze')
      .send({ projectPath: '/tmp/proj' });
    expect(res.status).toBe(200);
    expect(res.body.snoozedUntil).toBeDefined();
  });
});
```

### Step 2: Run → RED

### Step 3: Implement

**projects-bootstrap.ts:**
```typescript
// GET  /api/projects/index-state?projectPath=...
//   → stateManager.getState(path, currentFingerprint)

// POST /api/projects/bootstrap { projectPath }
//   → 202 Accepted
//   → async: bootstrapService.bootstrap(path, {
//       onProgress: (p) => socketManager.emitToUser(userId, 'index:progress', p),
//       onComplete: (r) => socketManager.emitToUser(userId, 'index:complete', r),
//       onFailed: (e) => socketManager.emitToUser(userId, 'index:failed', e),
//     })

// POST /api/projects/bootstrap/snooze { projectPath }
//   → stateManager.snooze(path)
```

**projects-setup.ts modification:**
After `GovernanceBootstrapService.bootstrap()` succeeds, auto-trigger:
```typescript
// Fire-and-forget: start memory bootstrap async (non-blocking)
bootstrapService.bootstrap(projectPath, { onProgress, onComplete, onFailed })
  .catch(err => logger.warn('Memory bootstrap failed (non-blocking)', err));
```

### Step 4: Run → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): bootstrap API + WebSocket progress + governance chain hook [布偶猫🐾]"
```

---

## Task 4: Frontend — BootstrapPromptCard

**Covers:** AC-B8 (old user path + snooze)

**Files:**
- Create: `packages/web/src/components/BootstrapPromptCard.tsx`
- Create: `packages/web/src/hooks/useIndexState.ts`
- Modify: `packages/web/src/components/ChatContainer.tsx` (or equivalent) — render card when needed

### Step 1: Write failing test

```typescript
describe('BootstrapPromptCard', () => {
  it('renders when index state is missing and not snoozed', () => {
    render(<BootstrapPromptCard indexState={missingState} />);
    expect(screen.getByText('这个项目还没有记忆索引')).toBeInTheDocument();
    expect(screen.getByText('开始扫描')).toBeInTheDocument();
    expect(screen.getByText('稍后再说')).toBeInTheDocument();
  });

  it('calls onStartScan when scan button clicked', async () => {
    const onStart = vi.fn();
    render(<BootstrapPromptCard indexState={missingState} onStartScan={onStart} />);
    await userEvent.click(screen.getByText('开始扫描'));
    expect(onStart).toHaveBeenCalled();
  });

  it('calls onSnooze when snooze button clicked', async () => {
    const onSnooze = vi.fn();
    render(<BootstrapPromptCard indexState={missingState} onSnooze={onSnooze} />);
    await userEvent.click(screen.getByText('稍后再说'));
    expect(onSnooze).toHaveBeenCalled();
  });

  it('does not render when snoozed', () => {
    const { container } = render(<BootstrapPromptCard indexState={snoozedState} />);
    expect(container.firstChild).toBeNull();
  });
});
```

### Step 2: Run → RED

### Step 3: Implement

`useIndexState(projectPath)` hook:
- Fetch `GET /api/projects/index-state?projectPath=...` on mount
- Listen for `index:progress`, `index:complete`, `index:failed` WebSocket events
- Return `{ state, startBootstrap, snooze, progress, summary }`

`BootstrapPromptCard`:
- Coral color system: `bg-cocreator-bg/30`, `border-cocreator-primary/20`, buttons `bg-cocreator-primary`
- Brain icon, scope info panel, snooze/scan buttons
- Cat emoji decorators (🐾) matching ProjectSetupCard style

### Step 4: Run → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): BootstrapPromptCard + useIndexState hook [布偶猫🐾]"
```

---

## Task 5: Frontend — BootstrapProgressPill

**Covers:** AC-B10 (non-blocking progress, collapsible pill)

**Files:**
- Create: `packages/web/src/components/BootstrapProgressPill.tsx`

### Step 1: Write failing test

```typescript
describe('BootstrapProgressPill', () => {
  it('renders collapsed by default', () => {
    render(<BootstrapProgressPill progress={scanningProgress} />);
    expect(screen.getByText('建立记忆索引…')).toBeInTheDocument();
    expect(screen.queryByText('扫描文件')).not.toBeInTheDocument(); // phases hidden
  });

  it('expands on click to show phases', async () => {
    render(<BootstrapProgressPill progress={extractingProgress} />);
    await userEvent.click(screen.getByText('建立记忆索引…'));
    expect(screen.getByText('扫描文件')).toBeInTheDocument();
    expect(screen.getByText('提取结构')).toBeInTheDocument();
  });

  it('shows correct phase status indicators', () => {
    render(<BootstrapProgressPill progress={extractingProgress} expanded />);
    // Phase 1 done, Phase 2 active, Phase 3-4 pending
  });
});
```

### Step 2: Run → RED

### Step 3: Implement

Collapsed: coral pill with pulse dot + phase label + chevron.
Expanded: 4 phases (scanning → extracting → indexing → summarizing) with done/active/pending icons + progress bar.

### Step 4: Run → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): BootstrapProgressPill — collapsible non-blocking progress [布偶猫🐾]"
```

---

## Task 6: Frontend — BootstrapSummaryCard

**Covers:** AC-B2 (summary output), AC-B11 (summary card + CTAs)

**Files:**
- Create: `packages/web/src/components/BootstrapSummaryCard.tsx`

### Step 1: Write failing test

```typescript
describe('BootstrapSummaryCard', () => {
  it('renders project summary with tier tags', () => {
    render(<BootstrapSummaryCard summary={testSummary} />);
    expect(screen.getByText('记忆索引构建完成')).toBeInTheDocument();
    expect(screen.getByText('my-project')).toBeInTheDocument();
    expect(screen.getByText(/Specs/)).toBeInTheDocument();
    expect(screen.getByText(/ADRs/)).toBeInTheDocument();
  });

  it('shows CTA buttons', () => {
    render(<BootstrapSummaryCard summary={testSummary} />);
    expect(screen.getByText('搜索知识')).toBeInTheDocument();
    expect(screen.getByText('前往记忆中心')).toBeInTheDocument();
  });

  it('calls onDismiss when close clicked', async () => {
    const dismiss = vi.fn();
    render(<BootstrapSummaryCard summary={testSummary} onDismiss={dismiss} />);
    await userEvent.click(screen.getByText('关闭'));
    expect(dismiss).toHaveBeenCalled();
  });
});
```

### Step 2: Run → RED

### Step 3: Implement

Green success card (matching ProjectSetupCard done state: `border-green-200 bg-green-50`).
Repo profile section, colored tier tags, three CTA buttons.

### Step 4: Run → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): BootstrapSummaryCard — summary display + CTAs [布偶猫🐾]"
```

---

## Task 7: Integration — Full Flow Wiring

**Covers:** AC-B9 (ProjectSetupCard auto-chain), AC-B1 (auto-trigger), AC-B4 (governance chain)

**Files:**
- Modify: `packages/web/src/components/ProjectSetupCard.tsx` — emit bootstrap after done
- Modify: `packages/web/src/components/ChatContainer.tsx` (or parent) — orchestrate card display logic
- Create: `packages/web/src/components/BootstrapOrchestrator.tsx` — state machine for card transitions

### Step 1: Write failing test

```typescript
describe('BootstrapOrchestrator', () => {
  it('shows PromptCard when index missing and governance done', () => {
    render(<BootstrapOrchestrator governanceDone indexState="missing" />);
    expect(screen.getByText('这个项目还没有记忆索引')).toBeInTheDocument();
  });

  it('shows ProgressPill when bootstrap is building', () => {
    render(<BootstrapOrchestrator indexState="building" progress={mockProgress} />);
    expect(screen.getByText('建立记忆索引…')).toBeInTheDocument();
  });

  it('shows SummaryCard when bootstrap completes', () => {
    render(<BootstrapOrchestrator indexState="ready" summary={mockSummary} />);
    expect(screen.getByText('记忆索引构建完成')).toBeInTheDocument();
  });

  it('auto-starts bootstrap for new project (scenario A)', () => {
    const startSpy = vi.fn();
    render(<BootstrapOrchestrator isNewProject governanceDone indexState="missing" onStartBootstrap={startSpy} />);
    expect(startSpy).toHaveBeenCalled(); // auto-fire, no prompt
  });
});
```

### Step 2: Run → RED

### Step 3: Implement

`BootstrapOrchestrator` renders the right component based on state:
```
indexState === 'missing' && isNewProject → auto-start + show AutoChainNotice
indexState === 'missing' && !isNewProject && !snoozed → show PromptCard
indexState === 'building' → show ProgressPill
indexState === 'ready' && justCompleted → show SummaryCard
indexState === 'failed' → show error with retry
```

Wire into ChatContainer alongside existing ProjectSetupCard.

### Step 4: Run → GREEN

### Step 5: Commit

```bash
git commit -m "feat(F152-B): BootstrapOrchestrator — full flow wiring + auto-chain [布偶猫🐾]"
```

---

## Task 8: Full Integration Test + Cleanup

**Covers:** All ACs — end-to-end verification

**Files:**
- Create: `packages/api/test/integration/expedition-bootstrap.test.ts`

### Step 1: Write integration test

```typescript
describe('Expedition Bootstrap E2E', () => {
  it('full flow: setup → bootstrap → progress → summary', async () => {
    // 1. POST /api/projects/setup → governance + auto-triggers bootstrap
    // 2. Listen for index:progress WebSocket events
    // 3. Wait for index:complete
    // 4. GET /api/projects/index-state → status === 'ready'
    // 5. Verify summary_json has expected structure
  });

  it('idempotent: second call with same fingerprint skips', async () => {
    // POST bootstrap twice with same HEAD → second returns skipped
  });

  it('snooze prevents re-trigger for 7 days', async () => {
    // POST snooze → GET state shows snoozed → POST bootstrap rejected
  });
});
```

### Step 2: Run → RED → implement fixes → GREEN

### Step 3: Run full test suite

```bash
pnpm test
```

### Step 4: Commit

```bash
git commit -m "test(F152-B): end-to-end integration tests [布偶猫🐾]"
```

---

## Commit History (expected)

| # | Message | ACs |
|---|---------|-----|
| 1 | `feat(F152-B): index_state schema + IndexStateManager` | B3, B5, B7 |
| 2 | `feat(F152-B): ExpeditionBootstrapService` | B1, B2, B6, B12 |
| 3 | `feat(F152-B): bootstrap API + WebSocket + governance chain` | B4, B10 |
| 4 | `feat(F152-B): BootstrapPromptCard + useIndexState` | B8 |
| 5 | `feat(F152-B): BootstrapProgressPill` | B10 |
| 6 | `feat(F152-B): BootstrapSummaryCard` | B11 |
| 7 | `feat(F152-B): BootstrapOrchestrator — full flow wiring` | B9 |
| 8 | `test(F152-B): E2E integration tests` | all |
