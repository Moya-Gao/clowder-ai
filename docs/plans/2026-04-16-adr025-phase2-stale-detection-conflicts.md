---
feature_ids: []
topics: [skills, governance, adr-025, hub, ux]
doc_kind: plan
created: 2026-04-16
status: active
---

# ADR-025 Phase 2 — Stale Detection + Conflict Resolution

**Feature:** ADR-025 — `docs/decisions/025-skills-canonical-mount-policy.md`
**Goal:** Detect when managed skills are out of date, show gentle "上新" notification in Hub, and resolve user/project skill name conflicts via choice cards.
**Acceptance Criteria:**
- AC2 (#386): 用户级和项目级同名 skill 如同时存在，系统能检测并报告 target 不一致
- AC4 (#386): A/B checkout 切换后，不会让旧项目静默混用两棵 skill tree
- ADR-025 §4: 冲突时给用户选择卡片，不是红灯报错
- ADR-025 §5b: Stale 时 Hub 显示温和上新通知 + 一键同步按钮
**Architecture:** Extend `/api/skills` response with `staleness` + `conflicts` fields. Add `POST /api/skills/sync` endpoint. Frontend `HubSkillsTab` renders stale banner and conflict cards using existing toast system.
**Tech Stack:** Node.js (backend), React/Zustand (frontend), existing `skills-state.ts` + `skill-mount.ts`
**NOT building:** Hub skills panel redesign (Phase 3), worktree lifecycle hooks (Phase 4), install script migration (Phase 5)
**前端验证:** Yes — reviewer 必须用 Chrome/Playwright 验证 toast + conflict card 交互

---

## Terminal Schema

```typescript
// Backend additions to /api/skills response
interface SkillsStaleness {
  stale: boolean;
  currentHash: string;
  recordedHash: string | null;
  newSkills: string[];      // in source but not in state
  removedSkills: string[];  // in state but not in source
}

interface SkillConflict {
  skillName: string;
  projectTarget: string;    // realpath of project-level symlink
  userTarget: string;       // realpath of user-level symlink
  activeLayer: 'user' | 'project'; // which one Claude Code would resolve
}

// Extended /api/skills response
interface SkillsResponse {
  skills: SkillEntry[];
  summary: SkillsSummary;
  staleness: SkillsStaleness | null;   // null if no skills-state.json
  conflicts: SkillConflict[];
}

// POST /api/skills/sync response
interface SkillsSyncResult {
  synced: string[];         // skill names that were created/updated
  removed: string[];        // stale symlinks removed
  newHash: string;
  conflicts: SkillConflict[];  // remaining conflicts after sync
}

// POST /api/skills/resolve-conflict request
interface ConflictResolution {
  skillName: string;
  choice: 'official' | 'mine';
}
```

## Tasks

### Task 1: Stale detection logic (`skills-state.ts`)

**Files:**
- Modify: `packages/api/src/config/governance/skills-state.ts`
- Test: `packages/api/test/governance/skills-state.test.js`

**What:** Add `checkStaleness(projectRoot, sourceRoot)` function that compares recorded manifest hash against current source directory.

**Step 1:** Write failing tests — stale when hash differs, fresh when same, new/removed skill detection.

**Step 2:** Implement `checkStaleness()`:
```typescript
export interface SkillsStaleness {
  stale: boolean;
  currentHash: string;
  recordedHash: string | null;
  newSkills: string[];
  removedSkills: string[];
}

export async function checkStaleness(
  projectRoot: string,
  sourceRoot: string,
): Promise<SkillsStaleness> {
  const state = await readSkillsState(projectRoot);
  const currentHash = await computeSourceManifestHash(sourceRoot);
  const currentNames = await listSourceSkillNames(sourceRoot);
  const managedNames = state?.managedSkillNames ?? [];
  return {
    stale: state === null || state.sourceManifestHash !== currentHash,
    currentHash,
    recordedHash: state?.sourceManifestHash ?? null,
    newSkills: currentNames.filter(n => !managedNames.includes(n)),
    removedSkills: managedNames.filter(n => !currentNames.includes(n)),
  };
}
```

**Step 3:** Run tests, commit.

### Task 2: Conflict detection logic (new `skill-conflict.ts`)

**Files:**
- Create: `packages/api/src/config/governance/skill-conflict.ts`
- Test: `packages/api/test/governance/skill-conflict.test.js`

**What:** Scan user-level and project-level skill directories for same-name skills with different realpath targets.

**Step 1:** Write failing tests — no conflict when same target, conflict when different target, handles missing dirs.

**Step 2:** Implement `detectConflicts()`:
```typescript
export interface SkillConflict {
  skillName: string;
  projectTarget: string;
  userTarget: string;
  activeLayer: 'user' | 'project';
}

export async function detectConflicts(
  projectRoot: string,
  homeDir: string,
  managedSkillNames: string[],
): Promise<SkillConflict[]> {
  // For each managed skill: check if user-level also has it
  // Compare realpath of project-level vs user-level
  // Claude Code priority: enterprise → personal → project
  // So user-level (personal) shadows project-level
}
```

**Step 3:** Run tests, commit.

### Task 3: Sync endpoint (`POST /api/skills/sync`)

**Files:**
- Modify: `packages/api/src/routes/skills.ts`
- Test: `packages/api/test/routes/skills-sync.test.js`

**What:** Endpoint that re-syncs managed per-skill symlinks and updates `skills-state.json`.

**Step 1:** Write failing test — POST returns updated state with new hash.

**Step 2:** Implement sync handler:
- Discover current skill names from source dir
- Create/update per-skill symlinks for all 4 providers (project-level only)
- Update `skills-state.json` with new managed names + hash
- Return sync result

**Step 3:** Run tests, commit.

### Task 4: Conflict resolution endpoint (`POST /api/skills/resolve-conflict`)

**Files:**
- Modify: `packages/api/src/routes/skills.ts`

**What:** Endpoint to resolve a single conflict.

**Step 1:** Write failing test — official choice removes user-level, mine choice removes from managed set.

**Step 2:** Implement:
- `choice: 'official'` → remove user-level symlink (for the specific skill)
- `choice: 'mine'` → remove skill from `managedSkillNames` in state file + remove project-level symlink

**Step 3:** Run tests, commit.

### Task 5: Extend `GET /api/skills` response

**Files:**
- Modify: `packages/api/src/routes/skills.ts`

**What:** Add `staleness` and `conflicts` fields to existing response.

**Step 1:** Import `checkStaleness` and `detectConflicts`, call them in GET handler.

**Step 2:** Add to response, verify existing tests still pass.

**Step 3:** Commit.

### Task 6: Frontend stale banner in HubSkillsTab

**Files:**
- Modify: `packages/web/src/components/HubSkillsTab.tsx`

**What:** Show info banner when skills are stale, with one-click sync button.

**Step 1:** Update `SkillsData` interface to include `staleness`.

**Step 2:** Render banner above skills table:
- "咖啡馆上新啦！有 {N} 个新 skill 可用" + [立即同步] button
- Button calls `POST /api/skills/sync`, on success: refresh + toast "同步完成"
- Gentle styling (info blue, not error red)

**Step 3:** Visual test with dev server, commit.

### Task 7: Frontend conflict cards in HubSkillsTab

**Files:**
- Modify: `packages/web/src/components/HubSkillsTab.tsx`

**What:** Show conflict cards when conflicts detected.

**Step 1:** Update interface to include `conflicts`.

**Step 2:** Render conflict card for each conflict:
- "{skillName} 在用户级和项目级来源不同"
- [用官方版本] → POST resolve-conflict with 'official'
- [用我的版本] → POST resolve-conflict with 'mine'
- After resolution: refresh data + toast

**Step 3:** Visual test, commit.

## Execution Order

```
Task 1 (stale detection) → Task 2 (conflict detection) → Task 3 (sync endpoint)
  → Task 4 (resolve endpoint) → Task 5 (extend GET) → Task 6 (stale banner)
  → Task 7 (conflict cards) → quality-gate → request-review → merge-gate
```

Tasks 1-2 are pure backend logic, testable independently.
Tasks 3-5 wire them into the API.
Tasks 6-7 are frontend.

## Risks

- **File size**: `skills.ts` is already moderate (~200 lines). May need to extract helpers.
- **Sync endpoint security**: Must validate projectPath to prevent path traversal.
- **User-level symlink removal**: Destructive action — conflict card must be explicit.
