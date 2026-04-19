# F146 Phase D: L1/L2/L3 联动体验 Implementation Plan

**Feature:** F146 — `docs/features/F146-mcp-marketplace-control-plane.md`
**Goal:** 能力中心同时显示 MCP 状态(L1)、Skill 依赖满足度(L2)、分发来源/认证状态(L3)，并支持从缺依赖直接补齐。
**Acceptance Criteria:**
- AC-D1: Skills 页可从 `requires_mcp missing` 直接发起补齐
- AC-D2: 能力中心可按 `L1/L2/L3` 分层过滤
- AC-D3: UI 中可追踪每个 MCP 的来源生态（Codex/Claude/OpenClaw/Antigravity）
**Architecture:** 三处改动：(1) shared types 扩展 CapabilityBoardItem 增加 layer/ecosystem/lockVersion 字段；(2) 后端 GET /api/capabilities 填充新字段；(3) 前端 HubSkillsTab 加"补齐"按钮 + HubCapabilityTab 加 layer filter + CapabilityCard 加 ecosystem badge。
**Tech Stack:** TypeScript, React, Fastify, @cat-cafe/shared
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Finish Line

能力中心 UI 上：
1. 每个 MCP 卡片显示来源生态 badge（如 `Claude`/`Codex`/手动安装）
2. 顶部可按 L1(MCP)/L2(Skill)/L3(Extension) 筛选
3. HubSkillsTab 的 `missing` MCP 依赖旁有"补齐"按钮，点击直接跳到能力中心的 marketplace 安装流程

**不做的事：**
- 不改 marketplace search/install API
- 不加新的后端 endpoint
- 不改 capabilities.json 持久化格式（lockVersion 字段已有，只是 board API 未暴露）

## Terminal Schema

```typescript
// CapabilityBoardItem 新增字段（packages/shared/src/types/capability.ts）
interface CapabilityBoardItem {
  // ... existing fields ...
  layer?: 'L1' | 'L2' | 'L3';
  ecosystem?: MarketplaceEcosystem;
  lockVersion?: LockVersion;
}
```

Layer 推导规则（后端自动填充，不持久化）：
- `type === 'mcp'` → `'L1'`
- `type === 'skill'` → `'L2'`
- `type === 'limb'` 或 `source === 'external' && type === 'skill'` → `'L3'`

Ecosystem 推导：
- `lockVersion?.source === 'marketplace'` → 需额外存储 ecosystem（在 install 时写入）
- 无 lockVersion → 不显示 ecosystem badge（手动配置的 MCP）

---

## Task 1: Extend shared types — add layer/ecosystem/lockVersion to CapabilityBoardItem

**Files:**
- Modify: `packages/shared/src/types/capability.ts:76-95`

**Step 1: Add new optional fields to CapabilityBoardItem**

```typescript
// Add after connectionStatus field (line 94):
  /** F146-D: Capability layer (L1=MCP, L2=Skill, L3=Extension) */
  layer?: 'L1' | 'L2' | 'L3';
  /** F146-D: Source ecosystem (from marketplace install) */
  ecosystem?: MarketplaceEcosystem;
  /** F146-D: Version lock info (from Phase C install governance) */
  lockVersion?: LockVersion;
```

**Step 2: Add ecosystem field to CapabilityEntry for persistence**

The `CapabilityEntry` needs an optional `ecosystem` field so marketplace installs can record which ecosystem the MCP came from.

```typescript
// Add after probeState field (line 62):
  /** F146-D: Source ecosystem when installed from marketplace */
  ecosystem?: MarketplaceEcosystem;
```

**Step 3: Add MarketplaceEcosystem import**

```typescript
import type { MarketplaceEcosystem } from './marketplace.js';
```

**Step 4: Build shared package**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: exit 0

**Step 5: Commit**

```
feat(F146-D): extend CapabilityBoardItem with layer/ecosystem/lockVersion
```

---

## Task 2: Backend — populate new fields in GET /api/capabilities

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts:637-678`
- Test: `packages/api/src/__tests__/capabilities-board-layer.test.ts`

**Step 1: Write failing test**

Test that GET /api/capabilities returns items with `layer` field populated, and items with `lockVersion` get `ecosystem` populated.

**Step 2: Run test → verify fail**

**Step 3: Populate layer + ecosystem + lockVersion when building board items**

In the MCP item builder (line 637-646):
```typescript
const mcpItem: CapabilityBoardItem = {
  id: cap.id,
  type: 'mcp',
  source: cap.source,
  enabled: cap.enabled,
  cats,
  layer: 'L1',
  ...(cap.ecosystem && { ecosystem: cap.ecosystem }),
  ...(cap.lockVersion && { lockVersion: cap.lockVersion }),
};
```

In the Skill item builder (line 662-677):
```typescript
const skillItem: CapabilityBoardItem = {
  // ... existing ...
  layer: cap.source === 'external' ? 'L3' : 'L2',
};
```

**Step 4: Run test → verify pass**

**Step 5: Commit**

```
feat(F146-D): populate layer/ecosystem/lockVersion in capabilities board API
```

---

## Task 3: Backend — record ecosystem on marketplace install

**Files:**
- Modify: `packages/api/src/config/capabilities/capability-install.ts:28-42`
- Modify: `packages/shared/src/types/capability.ts` (McpInstallRequest)
- Test: `packages/api/src/__tests__/capability-install-ecosystem.test.ts`

**Step 1: Write failing test**

Test that `buildInstallPreview` with `ecosystem` in request produces entry with ecosystem field.

**Step 2: Run test → verify fail**

**Step 3: Add ecosystem to McpInstallRequest type**

```typescript
// In McpInstallRequest, add:
  ecosystem?: MarketplaceEcosystem;
```

**Step 4: Pass ecosystem through in buildInstallPreview**

```typescript
const entry: CapabilityEntry = {
  // ... existing ...
  ...(req.ecosystem && { ecosystem: req.ecosystem }),
};
```

**Step 5: Run test → verify pass**

**Step 6: Commit**

```
feat(F146-D): pass ecosystem through marketplace install path
```

---

## Task 4: Frontend — Layer filter in HubCapabilityTab

**Files:**
- Modify: `packages/web/src/components/HubCapabilityTab.tsx:33,41,149-153,196-206`
- Modify: `packages/web/src/components/capability-board-ui.tsx:16-28` (frontend type sync)
- Test: `packages/web/src/components/__tests__/hub-capability-layer-filter.test.tsx`

**Step 1: Write failing test**

Test that FilterChips for "层级" renders L1/L2/L3 options and clicking filters items.

**Step 2: Run test → verify fail**

**Step 3: Sync frontend CapabilityBoardItem type**

In `capability-board-ui.tsx`, add to CapabilityBoardItem interface:
```typescript
  layer?: 'L1' | 'L2' | 'L3';
  ecosystem?: MarketplaceEcosystem;
  lockVersion?: LockVersion;
```

**Step 4: Add layer filter state and FilterChips in HubCapabilityTab**

```typescript
type FilterLayer = 'all' | 'L1' | 'L2' | 'L3';
const [filterLayer, setFilterLayer] = useState<FilterLayer>('all');

// In filter section, add after source FilterChips:
<FilterChips
  label="层级"
  value={filterLayer}
  options={[
    { value: 'all', label: '全部' },
    { value: 'L1', label: 'L1 MCP' },
    { value: 'L2', label: 'L2 Skill' },
    { value: 'L3', label: 'L3 扩展' },
  ]}
  onChange={(v) => setFilterLayer(v as FilterLayer)}
/>
```

**Step 5: Apply layer filter in useMemo**

```typescript
const filtered = useMemo(() => {
  let result = items;
  if (filterSource !== 'all') result = result.filter((i) => i.source === filterSource);
  if (filterLayer !== 'all') result = result.filter((i) => i.layer === filterLayer);
  return result;
}, [items, filterSource, filterLayer]);
```

**Step 6: Run test → verify pass**

**Step 7: Commit**

```
feat(F146-D): add L1/L2/L3 layer filter to capability center
```

---

## Task 5: Frontend — Ecosystem badge in CapabilityCard

**Files:**
- Modify: `packages/web/src/components/capability-board-ui.tsx:228-237`
- Test: `packages/web/src/components/__tests__/capability-card-ecosystem.test.tsx`

**Step 1: Write failing test**

Test that CapabilityCard renders EcosystemBadge when item has ecosystem field.

**Step 2: Run test → verify fail**

**Step 3: Import and render EcosystemBadge in CapabilityCard header**

After `TypeBadge` (line 236), add:
```tsx
{item.ecosystem && <EcosystemBadge ecosystem={item.ecosystem} />}
```

Import from marketplace-badges:
```typescript
import { EcosystemBadge } from './marketplace/marketplace-badges';
```

**Step 4: Run test → verify pass**

**Step 5: Commit**

```
feat(F146-D): show ecosystem badge on capability cards
```

---

## Task 6: Frontend — "补齐" button in HubSkillsTab for missing MCP deps

**Files:**
- Modify: `packages/web/src/components/HubSkillsTab.tsx:89-108`
- Test: `packages/web/src/components/__tests__/hub-skills-install-missing.test.tsx`

**Step 1: Write failing test**

Test that when a skill has `requiresMcp` with `status: 'missing'`, a clickable "补齐" button renders next to it.

**Step 2: Run test → verify fail**

**Step 3: Add callback prop + state for install trigger**

HubSkillsTab needs a way to communicate "user wants to install MCP X" to the parent Hub. Options:
- (A) Open marketplace panel with pre-filled search — requires parent coordination
- (B) Open inline McpInstallForm within the skills tab — self-contained

Option (B) is simpler and self-contained. Add state + inline form:

```typescript
const [installMcpId, setInstallMcpId] = useState<string | null>(null);
```

**Step 4: Add "补齐" button next to missing status badge**

```tsx
{dep.status === 'missing' && (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); setInstallMcpId(dep.id); }}
    className="ml-1 text-[10px] text-blue-600 hover:text-blue-800 underline"
  >
    补齐
  </button>
)}
```

**Step 5: Render McpInstallForm when installMcpId is set**

At top of the return JSX, before category groups:
```tsx
{installMcpId && (
  <div className="rounded-lg border border-cafe-accent/20 bg-cafe-surface p-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-cafe-secondary">
        安装缺失的 MCP: {installMcpId}
      </span>
      <button type="button" onClick={() => setInstallMcpId(null)}
        className="text-xs text-cafe-muted hover:text-cafe-secondary">✕</button>
    </div>
    <McpInstallForm
      prefilledId={installMcpId}
      onInstalled={() => { setInstallMcpId(null); fetchSkills(); }}
      onClose={() => setInstallMcpId(null)}
    />
  </div>
)}
```

**Step 6: Extend McpInstallForm to accept prefilledId**

In `McpInstallForm.tsx`, add optional `prefilledId?: string` prop. When provided, pre-populate the ID field and make it read-only.

**Step 7: Run test → verify pass**

**Step 8: Commit**

```
feat(F146-D): add "补齐" button for missing MCP deps in skills tab
```

---

## Task 7: Integration test + full verification

**Files:**
- Test: run existing test suites

**Step 1: Run full test suite**

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

**Step 2: Verify all pass**

**Step 3: Final commit if any fixups needed**

---

## Summary

| Task | AC | What |
|------|-----|------|
| 1 | D2/D3 | Shared types: layer + ecosystem + lockVersion on CapabilityBoardItem |
| 2 | D2/D3 | Backend: populate new fields in board API |
| 3 | D3 | Backend: record ecosystem on marketplace install |
| 4 | D2 | Frontend: L1/L2/L3 layer filter chips |
| 5 | D3 | Frontend: ecosystem badge on capability cards |
| 6 | D1 | Frontend: "补齐" button + inline install form |
| 7 | all | Integration test + full verification |
