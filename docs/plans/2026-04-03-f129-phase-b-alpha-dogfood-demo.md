---
feature_ids: [F129]
doc_kind: plan
created: 2026-04-03
---

# F129 Phase B-α: Dogfood Export + Demo Packs

**Feature:** F129 — `docs/features/F129-pack-system-multi-agent-mod.md`
**Goal:** Validate the Pack pipeline by exporting Cat Café's own config as a "Coding World" Pack and authoring a non-coding TRPG demo pack. Enforce Growth boundary on export.
**Acceptance Criteria:**
- [B1] 当前 cat-config + shared-rules + skills 成功导出为 "Coding World" Pack
- [B2] 至少 1 个非 Coding 示范 Pack 可运行（TRPG 跑团）
- [B4] Growth Layer（私有关系/记忆）不随 Pack 外发
- [B7] Pack export 默认不包含 Growth 原始数据；只允许导出蒸馏后的方法论补丁或模板变更（KD-11 硬边界）

**NOT building (B-β scope):** AC-B3 Remix, AC-B5 OpenClaw importer, AC-B6 SillyTavern importer
**Architecture:** New `PackExporter` service maps cat-config → masks, shared-rules → guardrails/defaults, skills manifest → workflows. GrowthBoundary filter ensures no private data leaks. Demo packs are hand-authored YAML validated against Phase A pipeline.
**Tech Stack:** Node.js, YAML, Zod (Phase A schemas), node:test
**前端验证:** No — pure backend

---

## Terminal Schema

PackExporter produces a standard Pack directory (same format Phase A already consumes):

```
<pack-name>/
├── pack.yaml           ← PackManifest
├── guardrails.yaml     ← hard constraints from shared-rules
├── defaults.yaml       ← soft behaviors from shared-rules + operational rules
├── masks/              ← one .yaml per mapped role
├── workflows/          ← one .yaml per mapped skill trigger
├── world-driver.yaml   ← resolver + collaboration model
└── knowledge/          ← optional .md files (pack-scoped)
```

No new types needed — reuses `CompiledPackBlocks`, `PackManifest`, etc. from Phase A.

New interfaces:

```typescript
/** Input config for PackExporter */
interface ExportSourceConfig {
  catConfigPath: string;      // path to cat-config.json
  sharedRulesPath: string;    // path to shared-rules.md
  skillsManifestPath: string; // path to manifest.yaml
}

/** Export result */
interface ExportResult {
  outputDir: string;          // where the Pack was written
  manifest: PackManifest;     // generated manifest
  warnings: string[];         // non-fatal mapping issues
}

/** Growth boundary check result */
interface GrowthCheckResult {
  clean: boolean;
  violations: string[];       // paths/fields that contain Growth data
}
```

## IMMUTABLE_FIELDS expansion (OQ-5 → F093 KD-12)

Phase A has 5 fields: `catId, family, provider, displayName, breedId`

Expand to full L1+L2 per KD-12:
- **L1 (routing identity)**: `catId`, `family`, `breedId`, `name`, `displayName`, `nickname`, `mentionPatterns`
- **L2 (infrastructure)**: `provider`, `model`, `contextBudget`, `cli`, `defaultModel`, `mcpSupport`

---

## Task 1: Expand IMMUTABLE_FIELDS to L1+L2 (OQ-5)

**Files:**
- Modify: `packages/api/src/domains/packs/PackSecurityGuard.ts:58`
- Test: `packages/api/test/pack-core.test.js`

**Step 1: Write failing test**

```javascript
test('rejects mask with L1 routing identity fields (KD-12)', async () => {
  // Create fixture with mask containing nickname field
  // Expect: security validation fails
});

test('rejects mask with L2 infrastructure fields (KD-12)', async () => {
  // Create fixture with mask containing provider/model/contextBudget
  // Expect: security validation fails
});
```

**Step 2: Expand IMMUTABLE_FIELDS**

```typescript
const IMMUTABLE_FIELDS = new Set([
  // L1: Routing identity — never overridable
  'catId', 'family', 'breedId', 'name', 'displayName', 'nickname', 'mentionPatterns',
  // L2: Infrastructure — never overridable, not even visible to packs
  'provider', 'model', 'defaultModel', 'contextBudget', 'cli', 'mcpSupport',
]);
```

**Step 3: Run tests, verify green**

**Step 4: Commit** `feat(F129): expand IMMUTABLE_FIELDS to L1+L2 per F093 KD-12`

---

## Task 2: GrowthBoundary filter

**Files:**
- Create: `packages/api/src/domains/packs/GrowthBoundary.ts`
- Test: `packages/api/test/pack-export.test.js` (new)

Growth = private data that must NOT appear in exported packs:
- evidence.sqlite / any SQLite files
- Session/thread data (`.cat-cafe/sessions/`, `.cat-cafe/threads/`)
- User preferences (`.cat-cafe/preferences/`)
- Memory/digest files
- Any file matching Growth patterns

**Step 1: Write failing tests**

```javascript
describe('GrowthBoundary', () => {
  test('flags .sqlite files as Growth violation');
  test('flags session/thread directories as Growth violation');
  test('flags evidence/memory paths as Growth violation');
  test('passes clean pack directory');
  test('passes pack with knowledge/ .md files (not Growth)');
});
```

**Step 2: Implement GrowthBoundary**

```typescript
const GROWTH_PATTERNS: RegExp[] = [
  /\.sqlite$/i,
  /\bsessions?\b/i,
  /\bthreads?\b/i,
  /\bpreferences?\b/i,
  /\bevidence\b/i,
  /\bmemory\b/i,
  /\bdigest\b/i,
  /\bgrowth\b/i,
  /\.env$/i,
  /credentials/i,
];

export function checkGrowthBoundary(packDir: string): Promise<GrowthCheckResult>
// Recursively scan packDir, flag any file/dir matching GROWTH_PATTERNS
```

**Step 3: Run tests, verify green**

**Step 4: Commit** `feat(F129): GrowthBoundary filter — KD-11 hard boundary`

---

## Task 3: PackExporter — cat-config → masks mapping

**Files:**
- Create: `packages/api/src/domains/packs/PackExporter.ts`
- Test: `packages/api/test/pack-export.test.js` (extend)

**Mapping rules (cat-config → masks/):**

| cat-config field | mask field | Notes |
|---|---|---|
| `breeds[].variants[].roleDescription` | `roleOverlay` | Role overlay text |
| `breeds[].variants[].personality` | `personalityOverlay` | Personality text |
| `breeds[].variants[].strengths` | `expertise` | Array of skill tags |
| `breeds[].catId` | `id` | Mask ID = catId |
| `breeds[].displayName` + role | `name` | Human-readable name |

**One mask per breed** (not per variant — masks are role archetypes, not model-specific):
- ragdoll → mask "architect" (roleOverlay from opus roleDescription)
- maine-coon → mask "reviewer" (roleOverlay from codex roleDescription)
- siamese → mask "designer" (roleOverlay from gemini roleDescription)

Only export breeds where `roster[catId].available === true`.

**Step 1: Write failing tests**

```javascript
test('exports one mask per available breed');
test('mask roleOverlay comes from variant roleDescription');
test('mask expertise comes from variant strengths');
test('skips unavailable breeds');
test('mask validates against PackMaskSchema');
```

**Step 2: Implement `exportMasks(catConfig) → PackMask[]`**

**Step 3: Run tests, verify green**

**Step 4: Commit** `feat(F129): PackExporter masks mapping from cat-config`

---

## Task 4: PackExporter — shared-rules → guardrails/defaults

**Files:**
- Modify: `packages/api/src/domains/packs/PackExporter.ts`
- Test: `packages/api/test/pack-export.test.js` (extend)

**Mapping rules:**

| shared-rules section | Pack target | severity |
|---|---|---|
| Iron Laws (铁律 1-4) | guardrails | `block` |
| First Principles (P1-P5) | guardrails | `warn` |
| World View (W1-W8) | defaults | overridable |
| Operational Rules (§1-18) | defaults | overridable |

**Approach:** Parse shared-rules.md by section headers. Extract bullet points. Map to PackConstraint/PackBehavior.

Note: This is a **best-effort mapping** — shared-rules.md is human-authored Markdown, not structured data. The exporter extracts the title/summary of each rule, not the full multi-paragraph explanation.

**Step 1: Write failing tests**

```javascript
test('iron laws become block-severity guardrails');
test('first principles become warn-severity guardrails');
test('world view rules become overridable defaults');
test('operational rules become overridable defaults');
test('guardrails validate against PackGuardrailsSchema');
test('defaults validate against PackDefaultsSchema');
```

**Step 2: Implement `exportGuardrails(sharedRulesContent) → PackGuardrails`**
**Step 3: Implement `exportDefaults(sharedRulesContent) → PackDefaults`**

**Step 4: Run tests, verify green**

**Step 5: Commit** `feat(F129): PackExporter shared-rules → guardrails/defaults`

---

## Task 5: PackExporter — skills manifest → workflows + world-driver + assemble

**Files:**
- Modify: `packages/api/src/domains/packs/PackExporter.ts`
- Test: `packages/api/test/pack-export.test.js` (extend)

**Skills → Workflows mapping:**
- Each SOP-linked skill (feat-lifecycle, tdd, quality-gate, etc.) → one workflow
- `trigger` = skill's primary trigger phrase
- `steps` = mapped from skill's `next` chain (declarative, not executable)
- Only SOP-linked skills (sop_step != null) are exported; specialized skills skipped

**World Driver:**
```yaml
resolver: hybrid    # coding = code reviews + agent decisions
roles:
  - architect
  - reviewer
  - designer
actions:
  - implement-feature
  - review-code
  - design-ui
  - write-tests
canonRules:
  - No self-review (different family required)
  - TDD: write failing test before implementation
  - Single source of truth (P4)
```

**Full export assembly:**
- `exportPack(config: ExportSourceConfig) → ExportResult`
- Writes all YAML files to output directory
- Runs GrowthBoundary check on output
- Runs PackSecurityGuard.validate on output (self-test!)
- Returns manifest + warnings

**Step 1: Write failing tests**

```javascript
test('exports SOP-linked skills as workflows');
test('skips non-SOP skills');
test('workflows validate against PackWorkflowSchema');
test('generates world-driver.yaml with hybrid resolver');
test('full export produces valid pack directory');
test('exported pack passes PackSecurityGuard validation');
test('exported pack passes GrowthBoundary check');
```

**Step 2: Implement workflow export + world-driver + assembler**

**Step 3: Run tests, verify green**

**Step 4: Commit** `feat(F129): PackExporter full assembly + self-validation`

---

## Task 6: Export REST endpoint

**Files:**
- Modify: `packages/api/src/routes/packs.ts`
- Test: `packages/api/test/pack-routes.test.js` (extend)

**Endpoint:**
```
POST /api/packs/export
Body: { name?: string }  (default: "coding-world")
Returns: { ok: true, outputDir: string, manifest: PackManifest, warnings: string[] }
```

**Step 1: Write failing test**

```javascript
test('POST /api/packs/export generates valid pack', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/packs/export', payload: {} });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.manifest.name, 'coding-world');
});
```

**Step 2: Implement endpoint**

**Step 3: Run tests, verify green**

**Step 4: Commit** `feat(F129): POST /api/packs/export endpoint`

---

## Task 7: "Coding World" dogfood pack — generate + round-trip test

**Files:**
- Create: `docs/packs/coding-world/` (generated reference pack)
- Test: `packages/api/test/pack-integration.test.js` (extend)

**Step 1: Write integration test**

```javascript
test('B1: exported Coding World pack round-trips through install → compile → inject', async () => {
  // 1. Export pack
  // 2. Install it via PackLoader
  // 3. Compile it via PackCompiler
  // 4. Verify all blocks present (masks, guardrails, defaults, workflows, worldDriver)
  // 5. Inject into SystemPromptBuilder
  // 6. Verify prompt contains pack sections
});
```

**Step 2: Generate the pack and commit it to `docs/packs/coding-world/`**

**Step 3: Run integration test, verify green**

**Step 4: Commit** `feat(F129): Coding World dogfood pack (AC-B1)`

---

## Task 8: TRPG demo pack — author + validate

**Files:**
- Create: `docs/packs/trpg-adventure/` (hand-authored)
- Test: `packages/api/test/pack-integration.test.js` (extend)

**TRPG Pack structure:**

```yaml
# pack.yaml
name: trpg-adventure
version: "1.0.0"
description: TRPG 跑团冒险世界 — 多猫扮演 DM + 玩家角色，骰子裁决 + 叙事推进
packType: scenario
author: cat-cafe-team
license: MIT
```

Masks: DM (dungeon-master), warrior, mage, healer
Guardrails: stay in character, no metagaming, respect canon
Defaults: fantasy tone, third-person narration, dice results honored
Workflows: combat-round, dialogue-scene, exploration
World-driver: resolver=hybrid, roles=[dm, warrior, mage, healer]
Knowledge: basic-rules.md (simplified TRPG rules)

**Step 1: Write validation test**

```javascript
test('B2: TRPG pack round-trips through install → compile → inject');
```

**Step 2: Author all YAML files**

**Step 3: Run test, verify green**

**Step 4: Commit** `feat(F129): TRPG adventure demo pack (AC-B2)`

---

## Task 9: End-to-end integration + biome + gate prep

**Files:**
- Extend: `packages/api/test/pack-integration.test.js`

**Step 1: Integration tests for Growth boundary**

```javascript
test('B4/B7: exported pack contains no Growth data');
test('B4/B7: pack with Growth artifacts fails GrowthBoundary');
```

**Step 2: Run full test suite**

```bash
node --test packages/api/test/pack-*.test.js packages/api/test/system-prompt-builder.test.js
```

**Step 3: Biome check + fix**

```bash
pnpm check:fix && pnpm check
```

**Step 4: Commit** `test(F129): Phase B-α end-to-end Growth boundary + integration`

---

## Summary

| Task | AC | Deliverable |
|------|-----|------------|
| 1 | OQ-5 | IMMUTABLE_FIELDS expanded to L1+L2 |
| 2 | B4, B7 | GrowthBoundary filter |
| 3 | B1 | PackExporter: cat-config → masks |
| 4 | B1 | PackExporter: shared-rules → guardrails/defaults |
| 5 | B1 | PackExporter: skills → workflows + world-driver + assembly |
| 6 | B1 | Export REST endpoint |
| 7 | B1 | Coding World dogfood pack + round-trip test |
| 8 | B2 | TRPG demo pack + validation |
| 9 | B4, B7 | Growth boundary integration test |
