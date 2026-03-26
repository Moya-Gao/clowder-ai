# F129 Phase A: Pack Format + Loader + Compiler — Implementation Plan

**Feature:** F129 — `docs/features/F129-pack-system-multi-agent-mod.md`
**Goal:** 让 Pack System 可安装、可编译、可注入——用户能 `cafe pack add` 一个 Git URL 的 Pack，编译为 canonical prompt blocks 注入 SystemPromptBuilder，双轨信任边界生效
**ADR:** `docs/decisions/021-f129-pack-system-architecture.md`
**Acceptance Criteria:**
- AC-A1: `pack.yaml` schema 定义完成
- AC-A2: Directory Convention 文档化
- AC-A3: Pack Compiler 编译为 canonical prompt blocks
- AC-A4: `cafe pack add <git-url>` 安装
- AC-A5: `cafe pack list` / `cafe pack remove`
- AC-A6: 双轨信任边界（guardrails 只加严；defaults 可覆盖）
- AC-A7: Malicious Pack 测试套件
- AC-A8: Schema fail-closed（未知字段拒绝；高风险字段 bounded）
- AC-A9: `capabilities/` 遇到则 reject 或 ignore+warn
- AC-A10: `knowledge/` pack-scoped，不污染全局 evidence
**Architecture:** 新建 `packages/api/src/domains/packs/` 域。Pack schema types + Zod 校验在 `@cat-cafe/shared`。PackLoader 负责 git clone + schema 验证 + 本地存储。PackCompiler 将 validated Pack 编译为 `CompiledPackBlocks`。SystemPromptBuilder 新增 `packBlocks` 注入点。
**Tech Stack:** TypeScript, Zod (fail-closed .strict()), yaml (已有), node:child_process execFile (git clone), node:test
**前端验证:** No — Phase A 是纯后端/CLI，无前端 UI

---

## Straight-Line Check

**Finish Line:** 用户执行 `cafe pack add <git-url>` → Pack 下载+校验安装 → 下次 cat 调用时 PackCompiler 编译 Pack → blocks 注入 SystemPromptBuilder → cat 行为被 Pack guardrails/defaults/masks 影响。Malicious content 全部被拦。

**What we're NOT building:**
- ❌ Pack Composer (Phase C)
- ❌ Marketplace/Registry (Phase C)
- ❌ Pack Remix/Patch (Phase B)
- ❌ OpenClaw/SillyTavern importers (Phase B)
- ❌ Capability Pack 运行时加载 (Phase C)
- ❌ World Driver 运行时执行 (Phase B, 需 F093)
- ❌ knowledge/ RAG 检索实现 (只做 scope 隔离基座)
- ❌ 前端 UI

---

## Terminal Schema

### Core Types (`@cat-cafe/shared`)

```typescript
// packages/shared/src/types/pack.ts

/** Pack manifest (pack.yaml) */
interface PackManifest {
  name: string;                  // e.g. "quant-cats"
  version: string;               // semver
  description: string;
  author?: string;
  license?: string;
  packType: 'domain' | 'scenario' | 'style' | 'bridge' | 'capability';
  compatibility?: {
    catCafeVersion?: string;     // semver range
  };
}

/** Guardrails — hard constraints, only-add-strict */
interface PackGuardrails {
  constraints: Array<{
    id: string;
    scope: 'all-cats' | 'specific-breeds';
    breeds?: string[];
    rule: string;                // bounded string (max 500 chars)
    severity: 'block' | 'warn';
  }>;
}

/** Defaults — user-overridable behaviors */
interface PackDefaults {
  behaviors: Array<{
    id: string;
    scope: 'all-cats' | 'specific-breeds';
    breeds?: string[];
    behavior: string;            // bounded string (max 500 chars)
    overridable: true;           // always true (enforced by schema)
  }>;
}

/** Mask — role overlay, never touches core identity */
interface PackMask {
  id: string;
  name: string;
  roleOverlay: string;           // bounded (max 300 chars)
  personalityOverlay?: string;   // bounded (max 300 chars)
  expertise?: string[];          // max 10 items
  activationCondition?: 'always' | 'on-demand';
}

/** Workflow step — declarative, no free-text instructions */
interface PackWorkflow {
  id: string;
  name: string;
  trigger: string;               // enum-like pattern
  steps: Array<{
    action: string;              // from allowed action enum
    params?: Record<string, string | number | boolean>;
  }>;
}

/** Compiled output that SystemPromptBuilder consumes */
interface CompiledPackBlocks {
  packName: string;
  guardrailBlock: string | null;    // compiled constraints text
  defaultsBlock: string | null;     // compiled defaults text
  masksBlock: string | null;        // compiled role overlays text
  workflowsBlock: string | null;    // compiled workflow hints text
  worldDriverSummary: string | null; // read-only summary (no execution)
  warnings: string[];               // e.g. "capabilities/ skipped"
}
```

### File Layout

```
packages/
├── shared/src/
│   ├── types/pack.ts              ← Pack type definitions
│   ├── schemas/pack.ts            ← Zod schemas (.strict() fail-closed)
│   └── schemas/index.ts           ← re-export
├── api/src/domains/packs/
│   ├── PackLoader.ts              ← git clone + validate + store
│   ├── PackCompiler.ts            ← schema → prompt blocks
│   ├── PackStore.ts               ← local pack storage (CRUD)
│   ├── PackSecurityGuard.ts       ← malicious content detection
│   ├── index.ts                   ← barrel export
│   └── __fixtures__/              ← test pack fixtures
├── api/src/routes/
│   └── packs.ts                   ← REST API: add/list/remove
└── api/test/
    ├── pack-compiler.test.js
    ├── pack-loader.test.js
    ├── pack-security.test.js
    └── pack-integration.test.js
```

---

## Task 1: Pack Schema Types + Zod Validation

**AC coverage:** AC-A1, AC-A8

**Files:**
- Create: `packages/shared/src/types/pack.ts`
- Create: `packages/shared/src/schemas/pack.ts`
- Modify: `packages/shared/src/types/index.ts` (re-export)
- Modify: `packages/shared/src/schemas/index.ts` (re-export)
- Test: `packages/api/test/pack-schema.test.js`

### Step 1: Write failing test — pack.yaml schema validation

```typescript
// Test: valid pack.yaml parses; unknown fields rejected; missing required fields rejected
test('PackManifestSchema accepts valid manifest', () => { ... });
test('PackManifestSchema rejects unknown fields (fail-closed)', () => { ... });
test('PackGuardrailsSchema rejects rule > 500 chars', () => { ... });
test('PackDefaultsSchema enforces overridable: true', () => { ... });
test('PackMaskSchema rejects roleOverlay > 300 chars', () => { ... });
test('PackWorkflowSchema rejects free-text instruction steps', () => { ... });
```

### Step 2: Run test → verify fails (types/schemas don't exist yet)

```bash
pnpm --filter @cat-cafe/shared build && \
  node --test packages/api/test/pack-schema.test.js
```

### Step 3: Implement types + Zod schemas

- `packages/shared/src/types/pack.ts` — all interfaces from Terminal Schema
- `packages/shared/src/schemas/pack.ts` — Zod schemas with `.strict()`, `.max()` bounds, enum restrictions
- Key: `z.object({...}).strict()` on every schema = unknown fields → parse error (fail-closed)
- High-risk fields: `severity` → `z.enum(['block', 'warn'])`; `scope` → `z.enum(['all-cats', 'specific-breeds'])`; `packType` → `z.enum([...5 types])`
- Workflow `action` → `z.enum([...allowed actions])` (no arbitrary strings)
- Re-export from `index.ts` files

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): pack schema types + Zod validation (fail-closed)
```

---

## Task 2: PackStore — Local Pack Storage

**AC coverage:** AC-A4, AC-A5

**Files:**
- Create: `packages/api/src/domains/packs/PackStore.ts`
- Test: `packages/api/test/pack-store.test.js`

### Step 1: Write failing test

```typescript
test('install() stores pack to .cat-cafe/packs/<name>/', () => { ... });
test('list() returns installed pack manifests', () => { ... });
test('remove() deletes pack directory', () => { ... });
test('get() returns null for non-installed pack', () => { ... });
test('install() overwrites existing pack (upgrade)', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement PackStore

```typescript
// packages/api/src/domains/packs/PackStore.ts
export class PackStore {
  constructor(private readonly baseDir: string) {}  // default: <project>/.cat-cafe/packs

  async install(name: string, packDir: string): Promise<void>  // copy validated pack
  async remove(name: string): Promise<boolean>
  async list(): Promise<PackManifest[]>
  async get(name: string): Promise<PackOnDisk | null>
  async has(name: string): Promise<boolean>
}

interface PackOnDisk {
  manifest: PackManifest;
  rootDir: string;
}
```

- Uses `node:fs/promises` (cp, rm, readdir)
- Reads+validates `pack.yaml` on every get/list (schema is truth, not cache)

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): PackStore — local pack CRUD (.cat-cafe/packs/)
```

---

## Task 3: PackSecurityGuard — Malicious Content Detection

**AC coverage:** AC-A7, AC-A8, AC-A9

**Files:**
- Create: `packages/api/src/domains/packs/PackSecurityGuard.ts`
- Create: `packages/api/test/__fixtures__/malicious-packs/` (test fixtures)
- Test: `packages/api/test/pack-security.test.js`

### Step 1: Write failing tests — malicious pack fixtures

```typescript
// Fixture packs in test/__fixtures__/malicious-packs/:
// - prompt-injection/     (guardrails.yaml with "ignore previous instructions")
// - identity-override/    (masks/ trying to set core identity fields)
// - permission-escalation/(guardrails trying to relax Core Rails)
// - hidden-instructions/  (YAML comments/anchors hiding instructions)
// - capabilities-present/ (has capabilities/ dir → must reject or warn)
// - unknown-fields/       (extra fields in pack.yaml → must reject)

test('rejects prompt injection in guardrails', () => { ... });
test('rejects identity override in masks', () => { ... });
test('rejects permission escalation (guardrails trying to relax)', () => { ... });
test('rejects hidden instructions via YAML anchors', () => { ... });
test('rejects or warns on capabilities/ directory', () => { ... });
test('rejects unknown fields in pack.yaml', () => { ... });
test('accepts clean valid pack', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement PackSecurityGuard

```typescript
export class PackSecurityGuard {
  /**
   * Validate a pack directory. Returns { ok: true } or { ok: false, reasons: [...] }.
   * Checks:
   * 1. Schema validation (fail-closed via Zod .strict())
   * 2. Prompt injection patterns (blocklist regex scan)
   * 3. Identity field protection (masks can't set immutable fields)
   * 4. Constraint direction (guardrails only-add-strict, never relax)
   * 5. capabilities/ presence → reject or warn (Phase A)
   * 6. String bounds (max length enforcement via schema)
   */
  async validate(packDir: string): Promise<SecurityResult>
}
```

**Prompt injection blocklist** (regex patterns):
- `ignore (all )?(previous|above|prior) instructions`
- `you are now|from now on you|forget (everything|all|your)`
- `system prompt|reveal your|show me your instructions`
- `override (your|the) (rules|identity|constraints|personality)`
- `do not follow|disregard|bypass`

**Identity field protection** — masks cannot set:
- `catId`, `family`, `provider`, `name` (immutable fields)
- Only `roleOverlay`, `personalityOverlay`, `expertise` allowed

**Constraint direction check** — guardrails can:
- Add new constraints ✅
- Make existing constraints stricter ✅
- Cannot contain: "allow", "permit", "relax", "remove restriction", "disable" ❌

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): PackSecurityGuard — malicious pack detection + fixtures
```

---

## Task 4: PackLoader — Git Clone + Validate + Install

**AC coverage:** AC-A4, AC-A9

**Files:**
- Create: `packages/api/src/domains/packs/PackLoader.ts`
- Test: `packages/api/test/pack-loader.test.js`

### Step 1: Write failing tests

```typescript
test('loads pack from local directory path', () => { ... });
test('loads pack from git URL (clone to temp → validate → install)', () => { ... });
test('rejects pack that fails schema validation', () => { ... });
test('rejects pack that fails security check', () => { ... });
test('rejects pack with capabilities/ (AC-A9)', () => { ... });
test('cleans up temp directory on failure', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement PackLoader

```typescript
export class PackLoader {
  constructor(
    private readonly store: PackStore,
    private readonly guard: PackSecurityGuard,
  ) {}

  /** Install from git URL or local path */
  async add(source: string): Promise<PackManifest>

  /** List installed packs */
  async list(): Promise<PackManifest[]>

  /** Remove installed pack */
  async remove(name: string): Promise<boolean>
}
```

- Git clone: `execFile('git', ['clone', '--depth=1', url, tmpDir])` — same pattern as existing git integration in `git-doc-reader.ts`
- After clone: `guard.validate(tmpDir)` → if fail, rm tmpDir, throw with reasons
- If pass: `store.install(manifest.name, tmpDir)` → rm tmpDir
- Local path: skip clone, validate in-place, copy to store

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): PackLoader — git clone + validate + install pipeline
```

---

## Task 5: PackCompiler — Schema → Canonical Prompt Blocks

**AC coverage:** AC-A3, AC-A6

**Files:**
- Create: `packages/api/src/domains/packs/PackCompiler.ts`
- Test: `packages/api/test/pack-compiler.test.js`

### Step 1: Write failing tests

```typescript
// Compilation tests
test('compiles masks/ into role overlay block', () => { ... });
test('compiles guardrails.yaml into constraint block', () => { ... });
test('compiles defaults.yaml into defaults block', () => { ... });
test('compiles workflows/ into workflow hints block', () => { ... });
test('world-driver.yaml produces read-only summary (no execution)', () => { ... });
test('expression/ and bridges/ produce no prompt blocks', () => { ... });
test('knowledge/ produces no prompt block (pack-scoped RAG only)', () => { ... });

// Dual-track trust boundary tests (AC-A6)
test('guardrails block is marked as hard-constraint track', () => { ... });
test('defaults block is marked as user-overridable track', () => { ... });
test('compiled blocks include track metadata for SystemPromptBuilder', () => { ... });

// Empty pack tests
test('pack with only pack.yaml produces empty blocks', () => { ... });
test('pack with only guardrails produces only guardrailBlock', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement PackCompiler

```typescript
export class PackCompiler {
  /**
   * Compile a validated, installed pack into prompt blocks.
   * Pure function: reads files → produces CompiledPackBlocks.
   *
   * Compilation mapping (from ADR-021 §5):
   * - masks/      → masksBlock (role overlay, persona 叠加)
   * - guardrails  → guardrailBlock (硬约束轨, 只加严)
   * - defaults    → defaultsBlock (默认行为轨, 可覆盖)
   * - workflows/  → workflowsBlock (声明式流程提示)
   * - knowledge/  → skip (RAG, not prompt)
   * - expression/ → skip (assets)
   * - bridges/    → skip (Phase B)
   * - world-driver→ worldDriverSummary (read-only 摘要)
   * - capabilities→ already rejected by PackSecurityGuard
   */
  async compile(packOnDisk: PackOnDisk): Promise<CompiledPackBlocks>
}
```

**Compilation format** — each block is a structured prompt section:

```
## [Pack: quant-cats] 角色叠加
- 你同时具备以下专业角色：金融分析师（...）
- 激活条件：always

## [Pack: quant-cats] 硬约束（不可覆盖）
- 所有金融建议必须附带风险提示
- 不得给出具体投资标的推荐

## [Pack: quant-cats] 默认行为（用户可覆盖）
- 默认使用专业术语，用户说"说人话"时切换
- 每次分析附带数据来源引用
```

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): PackCompiler — schema→canonical prompt blocks + dual-track
```

---

## Task 6: SystemPromptBuilder Integration

**AC coverage:** AC-A3, AC-A6

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- Modify: `packages/api/test/system-prompt-builder.test.js`

### Step 1: Write failing tests

```typescript
test('injects compiled pack guardrail block after GOVERNANCE_L0_DIGEST', () => { ... });
test('injects compiled pack defaults block after guardrails', () => { ... });
test('injects compiled pack masks block in identity section', () => { ... });
test('injects compiled pack workflow block after workflow triggers', () => { ... });
test('no pack blocks → prompt unchanged (backward compatible)', () => { ... });
test('dual-track: guardrails marked as non-overridable', () => { ... });
test('dual-track: defaults marked as user-overridable', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Modify SystemPromptBuilder

**Changes:**

1. Extend `InvocationContext` (or `StaticIdentityOptions`) to accept `packBlocks`:

```typescript
export interface StaticIdentityOptions {
  mcpAvailable?: boolean;
  /** F129: Compiled pack blocks to inject */
  packBlocks?: CompiledPackBlocks | null;
}
```

2. In `buildStaticIdentity()`, inject blocks at correct positions:
   - `masksBlock` → after identity section (role overlay)
   - After `GOVERNANCE_L0_DIGEST` → inject `guardrailBlock` (hardcoded non-overridable header)
   - After guardrails → inject `defaultsBlock` (marked as user-overridable)
   - After `WORKFLOW_TRIGGERS` → inject `workflowsBlock`
   - `worldDriverSummary` → informational section at end

3. Priority enforcement in prompt ordering:
```
Identity (core, immutable)
  └─ Pack Masks (role overlay, never changes core fields)
Governance L0 Digest (Core Rails)
  └─ Pack Guardrails (硬约束轨: only adds strictness)
Pack Defaults (默认行为轨: user can override)
Workflow Triggers
  └─ Pack Workflows (声明式 hints)
```

4. In `buildSystemPrompt()`, pass through `packBlocks` from context:

```typescript
export function buildSystemPrompt(context: InvocationContext): string {
  const staticPart = buildStaticIdentity(context.catId, {
    mcpAvailable: context.mcpAvailable,
    packBlocks: context.packBlocks,  // NEW
  });
  // ... rest unchanged
}
```

### Step 4: Run test → verify passes (including all existing tests)

```bash
pnpm --filter @cat-cafe/api build && \
  node --test packages/api/test/system-prompt-builder.test.js
```

### Step 5: Commit

```
feat(F129): SystemPromptBuilder — pack blocks injection + dual-track priority
```

---

## Task 7: Pack-Scoped Knowledge Base

**AC coverage:** AC-A10

**Files:**
- Create: `packages/api/src/domains/packs/PackKnowledgeScope.ts`
- Test: `packages/api/test/pack-knowledge-scope.test.js`

### Step 1: Write failing tests

```typescript
test('registers pack knowledge files under pack scope', () => { ... });
test('search with packId only returns that pack\'s knowledge', () => { ... });
test('global search does NOT include pack knowledge', () => { ... });
test('uninstalling pack removes its scoped knowledge', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement PackKnowledgeScope

Phase A 不实现 RAG 检索，只做 scope 隔离基座：

```typescript
export class PackKnowledgeScope {
  /**
   * Register knowledge files from a pack.
   * Phase A: indexes files with pack_id tag for future retrieval.
   * Does NOT inject into system prompt (per spec: "知识按需检索，不进静态 prompt").
   */
  async registerKnowledge(packName: string, knowledgeDir: string): Promise<void>

  /** Remove all knowledge entries for a pack */
  async removeKnowledge(packName: string): Promise<void>
}
```

- Extends `evidence_docs` table with optional `pack_id TEXT` column (schema migration V5)
- `kind = 'pack-knowledge'` for pack knowledge entries
- Search filter: `WHERE pack_id = ?` when scoped, `WHERE pack_id IS NULL` for global (default)

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): pack-scoped knowledge base isolation (AC-A10)
```

---

## Task 8: REST API Routes

**AC coverage:** AC-A4, AC-A5

**Files:**
- Create: `packages/api/src/routes/packs.ts`
- Modify: `packages/api/src/index.ts` (register routes)
- Test: `packages/api/test/pack-routes.test.js`

### Step 1: Write failing tests

```typescript
test('POST /api/packs/add with git URL installs pack', () => { ... });
test('POST /api/packs/add with local path installs pack', () => { ... });
test('GET /api/packs returns installed packs list', () => { ... });
test('DELETE /api/packs/:name removes pack', () => { ... });
test('POST /api/packs/add rejects invalid pack', () => { ... });
```

### Step 2: Run test → verify fails

### Step 3: Implement routes

```typescript
// POST /api/packs/add    body: { source: string }
// GET  /api/packs         → PackManifest[]
// DELETE /api/packs/:name → { removed: boolean }
```

Wire into existing Hono router in `packages/api/src/index.ts`.

### Step 4: Run test → verify passes

### Step 5: Commit

```
feat(F129): REST API — POST/GET/DELETE /api/packs
```

---

## Task 9: Integration Test — End-to-End

**AC coverage:** All AC-A1 through AC-A10

**Files:**
- Create: `packages/api/test/__fixtures__/valid-packs/quant-cats/` (test fixture)
- Test: `packages/api/test/pack-integration.test.js`

### Step 1: Create test fixture pack

```
test/__fixtures__/valid-packs/quant-cats/
├── pack.yaml
├── masks/
│   └── analyst.yaml
├── guardrails.yaml
├── defaults.yaml
├── workflows/
│   └── research-flow.yaml
├── knowledge/
│   └── finance-basics.md
└── world-driver.yaml
```

### Step 2: Write integration test

```typescript
test('end-to-end: install → compile → inject → verify prompt', async () => {
  // 1. PackLoader.add(fixtureDir)
  // 2. PackStore.get('quant-cats')
  // 3. PackCompiler.compile(pack)
  // 4. buildSystemPrompt({ ...context, packBlocks: compiled })
  // 5. Assert: prompt contains guardrail text
  // 6. Assert: prompt contains defaults text
  // 7. Assert: prompt contains mask overlay
  // 8. Assert: prompt does NOT contain raw YAML
  // 9. Assert: knowledge/ NOT in prompt
});

test('end-to-end: malicious pack is rejected at install', async () => {
  // PackLoader.add(maliciousFixtureDir) → throws with reasons
});

test('end-to-end: pack with capabilities/ is rejected (AC-A9)', async () => {
  // PackLoader.add(capabilitiesFixtureDir) → rejected or warned
});
```

### Step 3: Run integration test → verify passes

### Step 4: Commit

```
feat(F129): Phase A integration test — end-to-end pack pipeline
```

---

## Task 10: Directory Convention Documentation

**AC coverage:** AC-A2

**Files:**
- Modify: `docs/features/F129-pack-system-multi-agent-mod.md` (timeline update)

### Step 1: Update F129 spec timeline

Add Phase A completion entry with commit ref.

### Step 2: Commit

```
docs(F129): Phase A complete — timeline update
```

---

## Execution Order

```
Task 1 (Schema Types + Zod)          ← foundation, everything depends on this
  ↓
Task 2 (PackStore)                    ← needs types
Task 3 (PackSecurityGuard)            ← needs schemas for validation
  ↓  (both can be parallel)
Task 4 (PackLoader)                   ← needs Store + Guard
  ↓
Task 5 (PackCompiler)                 ← needs types, can parallel with Task 4
  ↓
Task 6 (SystemPromptBuilder)          ← needs CompiledPackBlocks type
Task 7 (PackKnowledgeScope)           ← independent, can parallel with Task 6
  ↓
Task 8 (REST API)                     ← needs Loader
  ↓
Task 9 (Integration Test)             ← needs everything
  ↓
Task 10 (Docs Update)                 ← final
```

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Schema 过度设计 | 先用 quant-cats fixture dogfood，只加 fixture 需要的字段 |
| Prompt injection 绕过 | Blocklist + schema bounds 双重拦截；fixtures 覆盖 OWASP prompt injection patterns |
| SystemPromptBuilder 改坏 | 现有 test 全部保持 pass；新 test 覆盖有/无 pack 两种场景 |
| evidence.sqlite migration 风险 | V5 migration 只加 nullable 列，不动已有数据 |
