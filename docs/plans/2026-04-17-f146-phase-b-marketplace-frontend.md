---
feature_ids: [F146]
topics: [marketplace, frontend, phase-b]
doc_kind: plan
created: 2026-04-17
---

# F146 Phase B: Marketplace Frontend Implementation Plan

**Feature:** F146 — `docs/features/F146-mcp-marketplace-control-plane.md`
**Goal:** Hub 内新增 Marketplace Tab，用户可搜索 4 生态 MCP 服务、查看结果卡片、预览安装计划
**Acceptance Criteria:**
- AC-B1: Unified search UI returning results from 4 ecosystems
- AC-B2: Results include trustLevel, filterable by official/verified/community
- AC-B3: Install plan preview with mode-appropriate action buttons
- AC-B4~B6: (backend already merged in PR #1231)
**Architecture:** Zustand store + 4 React components, following Hub tab pattern (AccordionSection). apiFetch() calls to `/api/marketplace/search` and `/api/marketplace/install/plan`
**Tech Stack:** React 18, Next.js App Router, Zustand, Tailwind, apiFetch
**Design:** `designs/F146-marketplace-phase-b-ux.pen` (4 screens, reviewed by 砚砚)
**Frontend verification:** Yes — reviewer must visually verify via dev server or browser

---

## Not Building

- Actual install execution (existing Phase A `capabilities.write` path)
- Real catalog fetchers (stubs return `[]`, Phase C)
- Security scanning UI (Phase D)

---

### Task 1: Zustand Store — `marketplaceStore.ts`

**Files:**
- Create: `packages/web/src/stores/marketplaceStore.ts`
- Test: `packages/web/src/stores/__tests__/marketplaceStore.test.ts`

**Step 1:** Write failing test — store search calls apiFetch, returns results

```typescript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('marketplaceStore', () => {
  it('search sets results from API response', async () => {
    // mock apiFetch, create store, call search('memory')
    // assert results array populated
  });

  it('search with ecosystem filter passes CSV param', async () => {
    // assert apiFetch called with ?ecosystems=claude,codex
  });

  it('getInstallPlan fetches plan for artifact', async () => {
    // assert POST body has ecosystem + artifactId
  });

  it('search sets loading states correctly', async () => {
    // assert loading=true during fetch, false after
  });
});
```

**Step 2:** Run test → RED
**Step 3:** Implement store

```typescript
interface MarketplaceState {
  results: MarketplaceSearchResult[];
  selectedResult: MarketplaceSearchResult | null;
  installPlan: InstallPlan | null;
  loading: boolean;
  error: string | null;
  query: string;
  ecosystemFilter: MarketplaceEcosystem[];
  trustFilter: TrustLevel[];
  search: (q: string) => Promise<void>;
  setEcosystemFilter: (ecosystems: MarketplaceEcosystem[]) => void;
  setTrustFilter: (levels: TrustLevel[]) => void;
  selectResult: (result: MarketplaceSearchResult) => void;
  getInstallPlan: (ecosystem: MarketplaceEcosystem, artifactId: string) => Promise<void>;
  clearSelection: () => void;
}
```

**Step 4:** Run test → GREEN
**Step 5:** Commit: `feat(F146): add marketplace Zustand store`

---

### Task 2: Badge Components — `marketplace-badges.tsx`

**Files:**
- Create: `packages/web/src/components/marketplace/marketplace-badges.tsx`

**Step 1:** Implement three badge components (pure presentational, no logic to test):

- `EcosystemBadge({ ecosystem })` — color-coded pill (Claude=purple, Codex=green, OpenClaw=red, Antigravity=blue)
- `TrustBadge({ level })` — verified=green shield, community=blue users, unknown=gray
- `InstallModeBadge({ mode })` — direct=green zap, cli=blue terminal, manual=orange file

Colors from design tokens:
| Ecosystem | bg | text/border |
|-----------|-----|------------|
| claude | `#F3EAFF` | `#7C3AED` |
| codex | `#ECFDF5` | `#059669` |
| openclaw | `#FEF2F2` | `#DC2626` |
| antigravity | `#EFF6FF` | `#2563EB` |

**Step 2:** Visual verify via dev server
**Step 3:** Commit: `feat(F146): add marketplace badge components`

---

### Task 3: Search Component — `marketplace-search.tsx`

**Files:**
- Create: `packages/web/src/components/marketplace/marketplace-search.tsx`

**Step 1:** Implement `MarketplaceSearch` component:
- Search input with magnifying glass icon, placeholder "搜索 MCP 服务..."
- Ecosystem filter pills row (全部 | Claude | Codex | OpenClaw | Antigravity)
- Active pill uses `bg-cafe-text text-white`, inactive uses `bg-cafe-surface border`
- Debounced search (300ms) via store.search()
- Pill click toggles ecosystem filter

**Step 2:** Visual verify
**Step 3:** Commit: `feat(F146): add marketplace search + filter UI`

---

### Task 4: Artifact Card — `artifact-card.tsx`

**Files:**
- Create: `packages/web/src/components/marketplace/artifact-card.tsx`

**Step 1:** Implement `ArtifactCard({ result, onSelect })`:
- Top row: icon + displayName (left), EcosystemBadge + TrustBadge (right)
- Middle: componentSummary text (truncate 2 lines)
- Bottom row: InstallModeBadge (left), publisherIdentity (right)
- Card: white bg, rounded-xl, border, subtle shadow, hover highlight
- onClick → `onSelect(result)`

**Step 2:** Visual verify with mock data
**Step 3:** Commit: `feat(F146): add marketplace artifact card`

---

### Task 5: Install Plan Detail — `install-plan-detail.tsx`

**Files:**
- Create: `packages/web/src/components/marketplace/install-plan-detail.tsx`

**Step 1:** Implement `InstallPlanDetail({ result, plan, onBack })`:
- Header: back arrow + "安装详情" + external link
- Hero: large icon + displayName + author + badge row
- Config section: key-value table (transport, command, scope, mode)
- Env vars section (if mcpEntry has env keys)
- Safety note: green (verified) / yellow (community) / gray (unknown)
- Action button varies by mode:
  - `direct_mcp` → "安装到当前猫猫" (blue, download icon)
  - `delegated_cli` → "复制 CLI 命令" (blue, terminal icon)
  - `manual_file` → "复制配置文件" (blue, file icon)
  - `manual_ui` → "打开设置" (blue, external-link icon)
- Hint text below button

**Step 2:** Visual verify with mock data per mode
**Step 3:** Commit: `feat(F146): add install plan detail panel`

---

### Task 6: Panel Container — `marketplace-panel.tsx`

**Files:**
- Create: `packages/web/src/components/marketplace/marketplace-panel.tsx`

**Step 1:** Implement `MarketplacePanel()`:
- Two views: search (default) ↔ detail (when selectedResult + installPlan)
- Search view: `<MarketplaceSearch />` + result count + `<ArtifactCard />` list
- Detail view: `<InstallPlanDetail />` with back button returning to search
- Loading skeleton when `store.loading`
- Empty state: "搜索关键词，发现 MCP 服务" hint
- Error state: retry button

**Step 2:** Visual verify full flow
**Step 3:** Commit: `feat(F146): add marketplace panel container`

---

### Task 7: Hub Navigation Integration

**Files:**
- Modify: `packages/web/src/components/cat-cafe-hub.navigation.tsx`
- Modify: `packages/web/src/components/CatCafeHub.tsx`

**Step 1:** Add marketplace tab to `cats` group (most relevant — MCP capabilities):

```typescript
{ id: 'marketplace', label: 'MCP 市场', icon: 'store' },
```

**Step 2:** Add conditional render in `CatCafeHub.tsx`:

```typescript
{activeTab === 'marketplace' && <MarketplacePanel />}
```

**Step 3:** Test navigation renders tab
**Step 4:** Visual verify full E2E: Hub → click Marketplace → search → card → detail → back
**Step 5:** Commit: `feat(F146): integrate marketplace tab into Hub navigation`

---

### Task 8: Quality Gate + Commit

**Step 1:** `pnpm check` (Biome)
**Step 2:** `pnpm lint` (TypeScript)
**Step 3:** `pnpm --filter @cat-cafe/web test`
**Step 4:** Visual verify in browser (golden path + edge cases)
**Step 5:** Final commit if any fixes needed
