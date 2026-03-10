# F085 Phase 4 — Platform Brake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Move hyperfocus brake from Claude Code agent hook to Cat Café platform (API + frontend), so all three cats trigger the brake regardless of CLI tool.

**Architecture:** Fastify `onRequest` hook records per-user activity timestamps in-memory. An `ActivityTracker` service calculates continuous work time (5min gap = reset). When threshold (90min) is crossed, it emits `brake:trigger` via Socket.io `emitToUser`. Frontend listens, shows a modal overlay with cat avatars + 撒娇 messages + TTS audio. Check-in response resets the timer via POST /api/brake/checkin.

**Tech Stack:** Fastify hooks, Socket.io (existing), Zustand store (frontend), React modal

**Not building:** Agent hook replacement (AC27) deferred until platform version is proven stable. Phase 1-3 shell scripts stay as fallback.

---

## Terminal Schema

```typescript
// packages/shared/src/types/brake.ts
interface BrakeEvent {
  level: 1 | 2 | 3;
  activeMinutes: number;
  nightMode: boolean;
  timestamp: number;
}

interface BrakeCheckinRequest {
  choice: 'rest' | 'wrap_up' | 'continue';
  reason?: string; // required when choice === 'continue'
}

interface BrakeCheckinResponse {
  ok: boolean;
  nextCheckMinutes: number; // 0=timer reset, 10=wrap_up, 30/45/-1=continue
}

interface BrakeState {
  activeWorkMs: number;
  lastActivityTs: number;
  triggerLevel: 0 | 1 | 2 | 3;
  bypassCount: number;
  dismissed: boolean;
  dismissCooldownMs: number;
  lastCheckinTs: number;
}
```

---

### Task 1: Shared Types

**Files:**
- Create: `packages/shared/src/types/brake.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)

**Step 1:** Create `brake.ts` with BrakeEvent, BrakeCheckinRequest, BrakeCheckinResponse, BrakeState interfaces.

**Step 2:** Add `export * from './brake.js'` to index.ts.

**Step 3:** `pnpm --filter @cat-cafe/shared build` to regenerate .d.ts.

**Step 4:** Commit.

---

### Task 2: ActivityTracker Core (TDD)

**Files:**
- Create: `packages/api/src/domains/health/ActivityTracker.ts`
- Create: `packages/api/src/domains/health/__tests__/ActivityTracker.test.ts`

**Step 1: Write failing tests**

```typescript
// Test cases:
// 1. recordActivity() initializes state for new user
// 2. recordActivity() accumulates active time within 5min gap
// 3. recordActivity() resets gap if > 5min since last activity
// 4. shouldTrigger() returns 0 when under threshold
// 5. shouldTrigger() returns 1 at 90min, 2 at 180min, 3 at 270min
// 6. handleCheckin('rest') resets timer
// 7. handleCheckin('wrap_up') sets 10min cooldown
// 8. handleCheckin('continue') records bypass with escalating cooldown
// 9. bypass count >= 3 returns cooldown -1 (disabled)
// 10. dismissed state auto-resets after cooldown expires
// 11. isNightMode() returns true between 23:00-06:00
```

**Step 2:** Run tests, confirm all fail.

**Step 3:** Implement ActivityTracker class:
- In-memory Map<userId, BrakeState>
- `recordActivity(userId)` — gap detection, accumulation
- `shouldTrigger(userId, thresholdMs?)` — level calculation
- `handleCheckin(userId, choice, reason?)` — state transitions
- `getState(userId)` — read-only access
- `isNightMode()` — hour check

**Step 4:** Run tests, confirm all pass.

**Step 5:** Commit.

---

### Task 3: Brake Route + Fastify Integration

**Files:**
- Create: `packages/api/src/routes/brake.ts`
- Modify: `packages/api/src/index.ts` (register hook + route)

**Step 1: Write failing test for brake route**

Test POST /api/brake/checkin returns 200 with valid choice.

**Step 2:** Implement brake route:
- `POST /api/brake/checkin` — accepts BrakeCheckinRequest, calls ActivityTracker
- `GET /api/brake/state` — returns current BrakeState for debugging

**Step 3:** Add Fastify `onRequest` hook in index.ts:
- Extract userId from request (header/query/auth)
- Call `activityTracker.recordActivity(userId)`
- If `shouldTrigger()` > 0 AND not dismissed → `socketManager.emitToUser(userId, 'brake:trigger', event)`
- Skip for /api/brake/* routes (avoid trigger-on-checkin loop)

**Step 4:** Register brake route in index.ts plugin registration block.

**Step 5:** Run tests, confirm pass.

**Step 6:** Commit.

---

### Task 4: Frontend Brake Store

**Files:**
- Create: `packages/web/src/stores/brakeStore.ts`

**Step 1:** Create zustand store:

```typescript
interface BrakeStore {
  visible: boolean;
  level: 0 | 1 | 2 | 3;
  activeMinutes: number;
  nightMode: boolean;
  show: (event: BrakeEvent) => void;
  hide: () => void;
  checkin: (choice: string, reason?: string) => Promise<void>;
}
```

**Step 2:** Implement:
- `show()` sets visible=true + event data
- `hide()` sets visible=false
- `checkin()` calls POST /api/brake/checkin then hides

**Step 3:** Commit.

---

### Task 5: Socket Event Listener

**Files:**
- Modify: `packages/web/src/hooks/useSocket.ts` (add brake:trigger listener)

**Step 1:** Add `brake:trigger` callback registration alongside existing events.

**Step 2:** In the listener, call `useBrakeStore.getState().show(data)`.

**Step 3:** Commit.

---

### Task 6: BrakeModal Component

**Files:**
- Create: `packages/web/src/components/BrakeModal.tsx`
- Modify: `packages/web/src/app/layout.tsx` or root component (mount BrakeModal)

**Step 1:** Create BrakeModal:
- Reads from brakeStore (visible, level, activeMinutes, nightMode)
- Shows overlay with three cat avatars (宪宪/砚砚/烁烁)
- Displays 撒娇 messages based on level (L1 温柔 / L2 关心 / L3 急了)
- Night mode: darker overlay, softer colors
- Three buttons: 🛏️ 立刻休息 / ⏱️ 收尾 10 分钟 / 💪 继续工作
- "继续工作" requires typing a reason (textarea)
- Calls brakeStore.checkin() on button click

**Step 2:** Mount BrakeModal at app root level (always rendered, visibility controlled by store).

**Step 3:** TTS audio: on show, create Audio elements for each cat's message and play sequentially.

**Step 4:** Commit.

---

### Task 7: Integration Test + Polish

**Step 1:** Manual integration test:
- Start API with ActivityTracker
- Open frontend
- Send messages for >threshold time (use low threshold env var for testing)
- Verify modal appears
- Test all three check-in choices

**Step 2:** Update F085 spec — mark AC21-AC26 as done.

**Step 3:** Final commit.

---

## Execution Order

```
Task 1 (types) → Task 2 (ActivityTracker core) → Task 3 (route + hook)
→ Task 4 (store) → Task 5 (socket listener) → Task 6 (modal) → Task 7 (integration)
```

Tasks 1-3 are backend, 4-6 are frontend, 7 is integration. Sequential dependency chain.

## Testing Strategy

- **Unit tests**: ActivityTracker (Task 2) — pure logic, no I/O
- **Route tests**: brake.ts (Task 3) — Fastify inject
- **Integration**: Manual with low threshold (Task 7)
- **env var**: `HYPERFOCUS_THRESHOLD_MS` for testing with short intervals
