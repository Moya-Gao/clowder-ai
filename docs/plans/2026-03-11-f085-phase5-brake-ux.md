# F085 Phase 5: Brake UX 增强 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add Hub settings toggle (on/off + threshold), TTS auto-play on brake trigger, and enhanced cat images in the brake modal.

**Architecture:** New `BrakeSettings` type persisted via API → ActivityTracker respects enabled/threshold → BrakeModal gains `useTts` integration + larger cat art. Hub gets a new "健康" tab with toggle + slider.

**Tech Stack:** Fastify routes, Zustand store, React component, `useTts` hook (existing), shared types, cat avatar assets (existing in `/avatars/`)

**NOT building:** New TTS synthesis backend (F066 done), animated sprites, database persistence (in-memory Map like ActivityTracker state)

---

## Terminal Schema

```typescript
// packages/shared/src/types/brake.ts — additions
export interface BrakeSettings {
  enabled: boolean;          // default: true
  thresholdMinutes: number;  // default: 90, range: 30–240
}

// GET /api/brake/settings → BrakeSettings
// PUT /api/brake/settings → BrakeSettings (echo back)
```

## Codex Boundary Constraints (砚砚 R0)

Per codex pre-review:
1. **AC28/AC31**: Use `resolveUserId` (no hand-rolled header parsing). `threshold` strong validation (type, min 30, max 240, default 90). Config reads are idempotent; when `enabled=false`, no `brake:trigger` events emitted.
2. **AC29**: Handle browser autoplay policy — `play()` rejection → degrade to "click to play" button. Dedup by trigger timestamp (don't replay same trigger).
3. **AC30**: Static assets only (no external URLs). Night mode safe (no high-stimulus animation).

---

### Task 1: Shared Types — BrakeSettings

**Files:**
- Modify: `packages/shared/src/types/brake.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add BrakeSettings interface to shared types**

```typescript
// Add to brake.ts after BrakeState
export interface BrakeSettings {
  enabled: boolean;
  thresholdMinutes: number;
}
```

**Step 2: Re-export from index.ts**

Add `BrakeSettings` to the existing brake re-export block.

**Step 3: Rebuild shared**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: exit 0

**Step 4: Commit**

```
feat(F085): add BrakeSettings shared type
```

---

### Task 2: Backend Settings API + ActivityTracker Integration (AC28 + AC31)

**Files:**
- Modify: `packages/api/src/domains/health/ActivityTracker.ts`
- Modify: `packages/api/src/routes/brake.ts`
- Modify: `packages/api/src/index.ts` (onRequest hook reads enabled flag)
- Test: `packages/api/test/activity-tracker.test.js`

**Step 1: Write failing tests for settings behavior**

Test cases:
1. `getSettings(userId)` returns `{ enabled: true, thresholdMinutes: 90 }` by default
2. `updateSettings(userId, { enabled: false })` → `getSettings` returns `{ enabled: false, thresholdMinutes: 90 }`
3. `updateSettings(userId, { thresholdMinutes: 60 })` → `shouldTrigger` uses 60min threshold
4. `shouldTrigger` returns 0 when `enabled === false` regardless of work time
5. Validation: `thresholdMinutes < 30` → rejected, `> 240` → rejected, non-number → rejected

**Step 2: Run tests — expect 5 FAIL**

Run: `node --test packages/api/test/activity-tracker.test.js`

**Step 3: Implement ActivityTracker settings methods**

```typescript
// Add to ActivityTracker class:
private settings = new Map<string, BrakeSettings>();

private static defaultSettings(): BrakeSettings {
  return { enabled: true, thresholdMinutes: 90 };
}

getSettings(userId: string): BrakeSettings {
  return this.settings.get(userId) ?? ActivityTracker.defaultSettings();
}

updateSettings(userId: string, patch: Partial<BrakeSettings>): BrakeSettings | { error: string } {
  const current = this.getSettings(userId);
  if (patch.thresholdMinutes !== undefined) {
    if (typeof patch.thresholdMinutes !== 'number' || patch.thresholdMinutes < 30 || patch.thresholdMinutes > 240) {
      return { error: 'thresholdMinutes must be 30–240' };
    }
    current.thresholdMinutes = patch.thresholdMinutes;
  }
  if (patch.enabled !== undefined) {
    current.enabled = Boolean(patch.enabled);
  }
  this.settings.set(userId, current);
  return current;
}
```

**Step 4: Update shouldTrigger to respect settings**

```typescript
shouldTrigger(userId: string, thresholdMs?: number): 0 | 1 | 2 | 3 {
  const settings = this.getSettings(userId);
  if (!settings.enabled) return 0;
  const threshold = thresholdMs ?? settings.thresholdMinutes * 60_000;
  // ... rest unchanged
}
```

Note: Remove the `thresholdMs` default value — now reads from per-user settings.

**Step 5: Run tests — expect 5 PASS (+ existing 24)**

Run: `node --test packages/api/test/activity-tracker.test.js`
Expected: 29 pass, 0 fail

**Step 6: Add REST routes for settings**

```typescript
// In brake.ts — add:
app.get('/api/brake/settings', async (request) => {
  const userId = resolveUserId(request, { defaultUserId: 'default-user' });
  return activityTracker.getSettings(userId ?? 'default-user');
});

app.put<{ Body: Partial<BrakeSettings> }>('/api/brake/settings', async (request, reply) => {
  const userId = resolveUserId(request, { defaultUserId: 'default-user' });
  if (!userId) { reply.status(401); return { error: 'Identity required' }; }
  const result = activityTracker.updateSettings(userId, request.body ?? {});
  if ('error' in result) { reply.status(400); return result; }
  return result;
});
```

**Step 7: Update onRequest hook — skip tracking when disabled**

In `index.ts` onRequest hook, add early return:
```typescript
const brakeSettings = activityTracker.getSettings(userId);
if (!brakeSettings.enabled) return;
// ... existing recordActivity + shouldTrigger logic
```

And remove the hardcoded `90 * 60_000` from the `shouldTrigger` call (now uses settings internally).

**Step 8: Build + type-check**

Run: `pnpm --filter @cat-cafe/api build`
Expected: exit 0

**Step 9: Commit**

```
feat(F085): settings API + ActivityTracker respects enabled/threshold (AC28+AC31)
```

---

### Task 3: Frontend Settings Store + Hub Panel (AC28)

**Files:**
- Create: `packages/web/src/components/BrakeSettingsPanel.tsx`
- Modify: `packages/web/src/components/CatCafeHub.tsx` (add "健康" tab)
- Modify: `packages/web/src/stores/brakeStore.ts` (add settings state)

**Step 1: Extend brakeStore with settings**

```typescript
// Add to BrakeStoreState:
settingsEnabled: boolean;
settingsThreshold: number;
settingsLoading: boolean;

// Add actions:
loadSettings: () => Promise<void>;
saveSettings: (patch: { enabled?: boolean; thresholdMinutes?: number }) => Promise<void>;
```

`loadSettings`: GET `/api/brake/settings` → set `settingsEnabled`, `settingsThreshold`
`saveSettings`: PUT `/api/brake/settings` → optimistic update + revert on error

**Step 2: Create BrakeSettingsPanel component**

Following existing panel patterns (PushSettingsPanel style):

```
┌─────────────────────────────────────┐
│ 🐾 健康守护                         │
│ 三猫会在你连续工作一段时间后提醒休息    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 启用健康守护    [  toggle  ] ON │ │
│ │                                 │ │
│ │ 提醒间隔                        │ │
│ │ [===========●=======] 90 分钟   │ │
│ │ 30min              240min       │ │
│ │                                 │ │
│ │ 💡 夜间模式 (23:00-06:00)      │ │
│ │    提醒会更温柔                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Toggle: `<input type="checkbox">` styled as switch
- Slider: `<input type="range" min={30} max={240} step={15}>`
- Debounce save on slider change (500ms)
- On mount: `loadSettings()`

**Step 3: Add tab to CatCafeHub**

Add `{ id: 'health', label: '健康' }` to tab list.
Add `{tab === 'health' && <BrakeSettingsPanel />}` to render area.

**Step 4: Type-check**

Run: `cd packages/web && npx tsc --noEmit 2>&1 | grep -c "error TS"` (check 0 new errors in our files)

**Step 5: Commit**

```
feat(F085): Hub brake settings panel with toggle + threshold slider (AC28)
```

---

### Task 4: BrakeModal TTS Auto-Play (AC29)

**Files:**
- Modify: `packages/web/src/components/BrakeModal.tsx`

**Step 1: Integrate useTts into BrakeModal**

```typescript
const { synthesize, state: ttsState } = useTts();
const [ttsTriggerId, setTtsTriggerId] = useState<number | null>(null);
```

**Step 2: Auto-play on modal show**

```typescript
useEffect(() => {
  if (!visible || !level) return;
  const triggerId = Date.now(); // or use event timestamp
  // Dedup: don't replay same trigger
  if (ttsTriggerId === triggerId) return;
  setTtsTriggerId(triggerId);

  // Pick cat + message for TTS
  const catId = ['opus', 'codex', 'gemini'][level - 1] ?? 'opus';
  const text = catMessages[level - 1]; // first cat's message

  // Try auto-play; browser may block
  synthesize(`brake-${triggerId}`, text, catId);
}, [visible, level]);
```

**Step 3: Handle autoplay failure — degrade to click-to-play**

```typescript
// After the cat messages section, add:
{ttsState === 'error' && (
  <button
    onClick={() => synthesize(`brake-${ttsTriggerId}`, catMessages[0], 'opus')}
    className="text-xs text-gray-500 hover:text-gray-700 underline"
  >
    🔊 点击播放语音
  </button>
)}
```

**Step 4: Type-check**

Run: `cd packages/web && npx tsc --noEmit` (0 new errors in our files)

**Step 5: Commit**

```
feat(F085): TTS auto-play in brake modal with autoplay fallback (AC29)
```

---

### Task 5: BrakeModal Cat Image Enhancement (AC30)

**Files:**
- Modify: `packages/web/src/components/BrakeModal.tsx`

**Step 1: Enlarge cat avatars + add expression context**

Current: 36px avatars inline with text.
Target: 48-56px avatars with expression label (撒娇/睡觉/叉腰 per level).

```typescript
const catExpressions: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '🥺', label: '撒娇' },   // L1: gentle
  2: { emoji: '😤', label: '叉腰' },   // L2: concerned
  3: { emoji: '😴', label: '困困' },   // L3: sleepy/urgent
};
```

**Step 2: Update avatar rendering**

Replace current inline avatar with larger version:

```tsx
<div className="flex items-start gap-3">
  <div className="relative shrink-0">
    <img
      src={`/avatars/${catId}.png`}
      alt={catName}
      className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
    />
    <span className="absolute -bottom-1 -right-1 text-lg">
      {catExpressions[level]?.emoji}
    </span>
  </div>
  <div className="flex-1">
    <p className="font-semibold text-sm">{catName}</p>
    <p className="text-sm mt-0.5">{message}</p>
  </div>
</div>
```

**Step 3: Night mode safety check**

Ensure:
- No high-stimulus colors at night (already using indigo palette)
- Avatar border uses muted color in night mode: `border-indigo-200` instead of `border-white`
- Expression emoji is static (no animation)

**Step 4: Type-check + visual review**

Run: `cd packages/web && npx tsc --noEmit`

**Step 5: Commit**

```
feat(F085): enlarged cat avatars with expression emoji in brake modal (AC30)
```

---

### Task 6: Integration Test + Final Cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `node --test packages/api/test/activity-tracker.test.js`
Expected: 29+ pass, 0 fail

**Step 2: Build all packages**

```bash
pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build
```

**Step 3: Type-check web**

```bash
cd packages/web && npx tsc --noEmit
```

**Step 4: Biome lint**

```bash
pnpm check
```

**Step 5: File size check**

```bash
pnpm check:dir-size
```
Ensure no file exceeds 200-line warning / 350-line hard limit.

**Step 6: Final commit if any cleanup needed**

---

## AC → File Mapping

| AC | Files | Route/Event |
|----|-------|-------------|
| AC28 (Hub toggle) | `BrakeSettingsPanel.tsx`, `CatCafeHub.tsx`, `brakeStore.ts` | — |
| AC29 (TTS) | `BrakeModal.tsx` | uses `useTts` hook |
| AC30 (Cat images) | `BrakeModal.tsx` | uses `/avatars/*.png` |
| AC31 (Persistence) | `ActivityTracker.ts`, `brake.ts` routes, `brake.ts` types | `GET/PUT /api/brake/settings` |

## Interface Contract (for Codex parallel review)

### Settings API

```
GET  /api/brake/settings
→ { enabled: boolean, thresholdMinutes: number }

PUT  /api/brake/settings
← { enabled?: boolean, thresholdMinutes?: number }
→ { enabled: boolean, thresholdMinutes: number }
→ 400 { error: "thresholdMinutes must be 30–240" }
→ 401 { error: "Identity required" }
```

### Updated brake:trigger event (no change)

```typescript
{ level: 1|2|3, activeMinutes: number, nightMode: boolean, timestamp: number }
```

When `settings.enabled === false`: no `brake:trigger` emitted, `recordActivity` still runs but `shouldTrigger` returns 0.

### Threshold behavior

- `shouldTrigger` reads `settings.thresholdMinutes` instead of hardcoded 90min
- L1 = threshold, L2 = 2×threshold, L3 = 3×threshold
- Default: 90min → L1@90, L2@180, L3@270
- If user sets 60min → L1@60, L2@120, L3@180
