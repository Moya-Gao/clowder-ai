# #723 P2/P3 Visual Normalization Plan

**Feature:** #723 — Console visual normalization (F190 Shell contract follow-up)
**Goal:** Fix remaining 9 P2 + 4 P3 visual/i18n issues across voice/skills/settings/memory/signals pages
**Acceptance Criteria:**
- [x] P2-13: Settings nav arrows → ALREADY FIXED
- [ ] P2-1: ServiceStatusPanel action labels Chinese + proper badge tone
- [ ] P2-2: InstallPreviewModal full Chinese i18n
- [ ] P2-3: Skills amber token normalization
- [ ] P2-5: Cross-page border violations → CDS §1.1/§2.2 compliant
- [ ] P2-6: Font fragmentation → SettingsText primitives
- [ ] P2-7: SettingsRow/Card pattern consistency
- [ ] P2-8a: MemoryNav tabs Chinese
- [ ] P2-8b: SignalNav tabs Chinese
- [ ] P3-8: SettingsStatusStrip emerald tokens + ServiceStatusPanel density
- [ ] P3-9: Members page toggle/card normalization
- [ ] P3-10: Accounts page card wrapper
- [ ] P3-11: MCP modal Chinese + cafe styling
**Architecture cell:** web/settings
**Map delta:** none
**Map delta why:** Pure visual/i18n normalization, no architecture change
**Architecture:** Batch of surgical edits across ~15 files. All changes are string/class/token replacements within existing component structure. No new components, no API changes, no state changes.
**Tech Stack:** React, Tailwind, CDS tokens, F206 primitives
**前端验证:** Yes — 12-page screenshot verification after all fixes

---

## Verification Summary

| Item | File(s) | Status |
|------|---------|--------|
| P2-13 nav arrows | SettingsNav.tsx | ALREADY FIXED |
| P2-1 voice labels | ServiceStatusPanel.tsx:22-24 | EXISTS |
| P2-2 install modal | InstallPreviewModal.tsx (全文) | EXISTS |
| P2-3 skills amber | SkillConflictBanner.tsx:36 | EXISTS |
| P2-5 borders | SettingsStatusStrip:22-25, GithubConfigPanel:113,152, PushServiceConfig:151 | EXISTS |
| P2-6 fonts | InstallPreviewModal, SkillPreviewModal, PushDiagnosticsSection, SkillConflictBanner | EXISTS |
| P2-7 cards | InstallPreviewModal:85,92,108, SkillPreviewModal:151 | EXISTS |
| P2-8a memory | MemoryNav.tsx:40-45 | EXISTS |
| P2-8b signals | SignalNav.tsx:42-43 | EXISTS |
| P2-8c ops | ops-nav-config.ts | ALREADY FIXED (Chinese) |
| P3-8 green/density | SettingsStatusStrip:24, ServiceStatusPanel:27 | EXISTS |
| P3-9 members | HubMemberOverviewCard.tsx:174-199 | EXISTS (minor) |
| P3-10 accounts | HubAccountsTab.tsx:141-152 | EXISTS (minor) |
| P3-11 MCP modal | McpConfigModalSections.tsx:72,135,180 | EXISTS |

---

## Task 1: Voice Service i18n (P2-1 + P2-2)

**Files:**
- Modify: `packages/web/src/components/settings/ServiceStatusPanel.tsx:21-24`
- Modify: `packages/web/src/components/settings/InstallPreviewModal.tsx`

**Step 1: ServiceStatusPanel — Chinese action labels**

```typescript
// ServiceStatusPanel.tsx:21-25
const ACTION_CONFIG: Record<string, { label: string; tone: ActionBadgeTone }> = {
  install: { label: '安装', tone: 'blue' },
  start: { label: '启动', tone: 'emerald' },
  stop: { label: '停止', tone: 'amber' },
};
```

**Step 2: InstallPreviewModal — Chinese UI strings**

All English strings → Chinese:
- `Install {serviceName}` → `安装 {serviceName}`
- `Runtime` → `运行环境`
- `Packages` → `依赖包`
- `Model` → `模型`
- `Custom model` → `自定义模型`
- `Estimated time: ~{n} min` → `预计耗时：~{n} 分钟`
- `Cancel` → `取消`
- `Install` (confirm button) → `安装`
- `关闭` aria-label already correct
- placeholder `org/model-name` → keep as-is (technical format)

**Step 3: Run tests**

```bash
pnpm --filter @cat-cafe/web test -- --testPathPattern="service|install" 2>/dev/null || echo "no matching tests"
```

**Step 4: Commit**

```bash
git add packages/web/src/components/settings/ServiceStatusPanel.tsx packages/web/src/components/settings/InstallPreviewModal.tsx
git commit -m "fix(web): #723 P2-1/P2-2 — voice service + install modal Chinese i18n [宪宪/Opus-46🐾]"
```

---

## Task 2: Skills Amber Token Normalization (P2-3)

**Files:**
- Modify: `packages/web/src/components/settings/SkillConflictBanner.tsx:36`

**Step 1: Replace raw amber with CDS tokens**

```typescript
// Line 36: "Official" button — before:
className="rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"

// After:
className="rounded-lg bg-conn-amber-text px-2.5 py-1 text-[10px] font-bold text-white hover:bg-conn-amber-hover disabled:opacity-50"
```

Note: `bg-conn-amber-text` (#b45309) is the dark amber used for solid buttons, `hover:bg-conn-amber-hover` (#78350f) for hover. This maintains the solid-button visual while using CDS tokens.

**Step 2: Run lint**

```bash
pnpm biome check packages/web/src/components/settings/SkillConflictBanner.tsx
```

**Step 3: Commit**

```bash
git add packages/web/src/components/settings/SkillConflictBanner.tsx
git commit -m "fix(web): #723 P2-3 — skills conflict banner amber → CDS tokens [宪宪/Opus-46🐾]"
```

---

## Task 3: Border CDS Compliance (P2-5)

**Files:**
- Modify: `packages/web/src/components/settings/primitives/SettingsStatusStrip.tsx:22-25`
- Modify: `packages/web/src/components/settings/GithubConfigPanel.tsx:113,152`
- Modify: `packages/web/src/components/settings/PushServiceConfig.tsx:151`

**Step 1: SettingsStatusStrip — replace raw border colors with CDS tokens**

```typescript
// Line 22-25: bordered tone map
info: 'border border-[var(--conn-blue-ring)] bg-conn-blue-bg text-conn-blue-text',
success: 'border border-[var(--conn-emerald-ring)] bg-[var(--conn-emerald-bg)] text-[var(--conn-emerald-text)]',
warning: 'border border-conn-amber-ring bg-conn-amber-bg text-conn-amber-text',
error: 'border border-[var(--conn-red-ring)] bg-conn-red-bg text-conn-red-text',
```

Verify `--conn-emerald-ring`, `--conn-emerald-bg`, `--conn-emerald-text` tokens exist in connector-tokens.css. If not, use `--conn-emerald-*` CSS variables directly.

**Step 2: GithubConfigPanel — remove inline border styles**

```typescript
// Line 113: Replace borderTop inline style with Tailwind class
// Before: style={{ borderTop: '1px solid var(--cafe-border)' }}
// After: className="... border-t border-[var(--console-border-soft)]"

// Line 152: Replace inline border on input
// Before: border: '1px solid var(--cafe-border)'
// After: className="... border border-[var(--console-border-soft)]"
```

**Step 3: PushServiceConfig — same inline border fix**

```typescript
// Line 151: Same pattern as GithubConfigPanel
// Before: border: '1px solid var(--cafe-border)'
// After: className="... border border-[var(--console-border-soft)]"
```

**Step 4: Run lint + tests**

```bash
pnpm biome check packages/web/src/components/settings/primitives/SettingsStatusStrip.tsx packages/web/src/components/settings/GithubConfigPanel.tsx packages/web/src/components/settings/PushServiceConfig.tsx
```

**Step 5: Commit**

```bash
git add packages/web/src/components/settings/primitives/SettingsStatusStrip.tsx packages/web/src/components/settings/GithubConfigPanel.tsx packages/web/src/components/settings/PushServiceConfig.tsx
git commit -m "fix(web): #723 P2-5 — border violations → CDS §1.1/§2.2 tokens [宪宪/Opus-46🐾]"
```

---

## Task 4: Memory / Signals Nav i18n (P2-8)

**Files:**
- Modify: `packages/web/src/components/memory/MemoryNav.tsx:40-45`
- Modify: `packages/web/src/components/signals/SignalNav.tsx:42-43`

**Step 1: MemoryNav tabs Chinese**

```typescript
// MemoryNav.tsx:40-45
{ id: 'feed', href: `/memory${fromSuffix}`, label: '知识动态' },
{ id: 'search', href: `/memory/search${fromSuffix}`, label: '搜索' },
{ id: 'status', href: `/memory/status${fromSuffix}`, label: '索引状态' },
{ id: 'health', href: `/memory/health${fromSuffix}`, label: '健康度' },
{ id: 'catalog', href: `/memory/catalog${fromSuffix}`, label: '图书馆' },
{ id: 'graph', href: `/memory/graph${fromSuffix}`, label: '知识图谱' },
```

**Step 2: SignalNav tabs Chinese**

```typescript
// SignalNav.tsx:42-43
{ id: 'signals' as const, href: `/signals${fromSuffix}`, label: '信号' },
{ id: 'sources' as const, href: `/signals/sources${fromSuffix}`, label: '信号源' },
```

**Step 3: Run tests**

```bash
pnpm --filter @cat-cafe/web test -- --testPathPattern="memory|signal" 2>/dev/null || echo "check for test failures"
```

**Step 4: Commit**

```bash
git add packages/web/src/components/memory/MemoryNav.tsx packages/web/src/components/signals/SignalNav.tsx
git commit -m "fix(web): #723 P2-8 — MemoryNav + SignalNav tabs Chinese i18n [宪宪/Opus-46🐾]"
```

---

## Task 5: Font + Card Normalization (P2-6 + P2-7)

**Files:**
- Modify: `packages/web/src/components/settings/InstallPreviewModal.tsx` (already touched in Task 1)
- Modify: `packages/web/src/components/settings/SkillPreviewModal.tsx`
- Modify: `packages/web/src/components/settings/PushDiagnosticsSection.tsx`
- Modify: `packages/web/src/components/settings/SkillConflictBanner.tsx` (already touched in Task 2)

**Scope note:** Full primitive migration of modals (InstallPreviewModal, SkillPreviewModal) would be a large refactor. The plan focuses on the most visible inconsistencies:
1. Modal header font sizes → keep as-is (modals have their own visual hierarchy, SettingsText `variant` doesn't cover modal headers)
2. Card wrappers in modals → replace raw `rounded-2xl bg-[var(--console-panel-bg)]` with import of CDS panel pattern
3. PushDiagnosticsSection raw `text-xs` grid → keep as diagnostic micro-text (appropriate for technical readout)

**Step 1: SkillPreviewModal — replace raw card div**

```typescript
// Line 151: Before
<div className="rounded-2xl bg-[var(--console-panel-bg)] p-4">

// After: Use SettingsCard import (or inline the settingsCardClass if appropriate)
// Check if SettingsCard's padding/radius matches — if so, use it directly
```

**Step 2: InstallPreviewModal — replace 3 raw card divs**

Lines 85, 92, 108: same `rounded-2xl bg-[var(--console-panel-bg)]` pattern.
These are inside a modal, so importing `settingsCardClass` (the class string) is lighter than the full `<SettingsCard>` component.

**Step 3: Run lint**

```bash
pnpm biome check packages/web/src/components/settings/SkillPreviewModal.tsx packages/web/src/components/settings/InstallPreviewModal.tsx
```

**Step 4: Commit**

```bash
git add packages/web/src/components/settings/SkillPreviewModal.tsx packages/web/src/components/settings/InstallPreviewModal.tsx
git commit -m "fix(web): #723 P2-6/P2-7 — modal card/font normalization [宪宪/Opus-46🐾]"
```

---

## Task 6: P3 Batch — Green Token + Members + Accounts + MCP Modal

**Files:**
- Modify: `packages/web/src/components/settings/primitives/SettingsStatusStrip.tsx` (already touched in Task 3)
- Modify: `packages/web/src/components/settings/ServiceStatusPanel.tsx:27` (density)
- Modify: `packages/web/src/components/McpConfigModalSections.tsx:72,135,180`

**Step 1: ServiceStatusPanel density — reduce row padding (P3-8)**

```typescript
// Line 27: Before
const ROW_STYLE = { paddingInline: '1.25rem', paddingBlock: '1rem' } as const;

// After: Align with SettingsRow py-3 (0.75rem)
const ROW_STYLE = { paddingInline: '1.25rem', paddingBlock: '0.75rem' } as const;
```

**Step 2: MCP modal Chinese placeholders (P3-11)**

```typescript
// McpConfigModalSections.tsx
// Line 72: placeholder="MCP server name" → placeholder="MCP 服务名称"
// Line 135: placeholder="Resolver" → placeholder="解析器"
// Line 180: 'e.g. npx' → '例如 npx'
```

**Step 3: P3-9 Members + P3-10 Accounts — assess and fix if trivial**

P3-9: HubMemberOverviewCard toggle is already using SettingsBadge as button — this is acceptable per CDS §3.9 (badge-buttons for actions). Labels are already Chinese. **No change needed.**

P3-10: HubAccountsTab missing SettingsCard wrapper — add `<SettingsCard>` around account list group if it improves visual consistency. Assess at implementation time.

**Step 4: Run lint + tests**

```bash
pnpm biome check packages/web/src/components/McpConfigModalSections.tsx packages/web/src/components/settings/ServiceStatusPanel.tsx
pnpm --filter @cat-cafe/web test 2>/dev/null
```

**Step 5: Commit**

```bash
git add packages/web/src/components/settings/ServiceStatusPanel.tsx packages/web/src/components/McpConfigModalSections.tsx
git commit -m "fix(web): #723 P3-8/P3-11 — density + MCP modal Chinese [宪宪/Opus-46🐾]"
```

---

## Task 7: Full Test Suite + Screenshot Verification

**Step 1: Run full test suite**

```bash
pnpm --filter @cat-cafe/web test
pnpm biome check packages/web/src/
```

**Step 2: Screenshot verification (12 pages)**

Open browser and verify each page:
1. Settings → 语音服务 (voice services) — Chinese labels, badge actions
2. Settings → 安装弹窗 (install modal) — Chinese strings
3. Settings → Skills — amber tokens, no raw colors
4. Settings → GitHub 配置 — no border violations
5. Settings → 推送配置 — no border violations
6. Memory → 导航标签 — Chinese tabs
7. Signals → 导航标签 — Chinese tabs
8. Ops → 导航标签 — Chinese tabs (verify still correct)
9. Settings → 系统配置 — density, green tokens
10. Settings → 成员 — card consistency
11. Settings → 账户 — card wrapper
12. Settings → MCP 配置弹窗 — Chinese placeholders

**Step 3: Commit any screenshot evidence**

---

## Open Questions

**技术 OQ (self-resolve):**
1. `--conn-emerald-ring` / `--conn-emerald-bg` / `--conn-emerald-text` token existence — verify in connector-tokens.css at implementation time; if missing, use CSS var directly
2. SkillPreviewModal / InstallPreviewModal card pattern — assess whether `settingsCardClass` import or `<SettingsCard>` component is cleaner; decide at implementation time
3. P3-10 HubAccountsTab SettingsCard wrapper — assess if wrapping changes visual appearance; skip if it introduces visual regression

**价值 OQ: None** — all items are direct execution of 铲屎官's listed P2/P3 requirements from #723.
