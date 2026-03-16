# F101 Phase F — Core Gameplay Fixes Implementation Plan

**Feature:** F101 — `docs/features/F101-mode-v2-game-engine.md`
**Goal:** 解决铲屎官实测反馈的 4 类核心体验 bug：投票不透明 / 行动真实性存疑 / 超时卡游戏 / 多狼投票缺失
**Acceptance Criteria:**
- AC-F1: ✅ 调研完成
- AC-F2: God-view 夜晚时间线实时展示每个角色的具体行动目标
- AC-F3: 已行动状态从二态改为三态（waiting/acting/acted）
- AC-F4: 多狼独立投票 + 多数票结算 + 平票处理
- AC-F5: 白天投票可改票 + 全员 commit 提前结束
- AC-F6: 超时未行动自动 fallback，游戏不卡住
- AC-F7: 慢启动猫猫有 grace period + god-view 展示真实连接状态
- AC-F8: 铲屎官在 god-view 能清楚理解"正在发生什么"
**Architecture:** 三层改动 — types（shared 包新增 Ballot/ActionStatus）→ engine（WerewolfEngine 多狼投票 + GameOrchestrator 超时 fallback）→ view（GameViewBuilder 透明度 + 前端三态指示器）
**Tech Stack:** TypeScript, Vitest, Redis 6398 (worktree)
**前端验证:** Yes — GodInspector 夜间面板 + PlayerGrid 三态指示器需要 Playwright/Chrome 实测

**NOT building:** replay_full 赛后复盘 / ActionAttempt 级追踪 / LLM 模型降级 fallback / AIWolf 兼容模式

---

## Terminal Schema（最终数据结构）

### 1. ActionStatus（game.ts 新增）

```typescript
type ActionStatus = 'waiting' | 'acting' | 'acted' | 'timed_out' | 'fallback';

interface PendingAction extends GameAction {
  status: ActionStatus;
  requestedAt: number;
  submittedAt?: number;
  fallbackSource?: 'heuristic' | 'random';
}
```

### 2. Ballot（game.ts 新增）

```typescript
interface Ballot {
  voterSeat: string;
  choice: string | null;
  revision: number;
  locked: boolean;
  source: 'player' | 'llm' | 'fallback' | 'random';
  submittedAt: number;
}

interface Resolution {
  winningChoice: string | null;
  tiePolicy: 'no_kill' | 'random_tied';
  revoteCount: number;
  fallbackApplied: boolean;
}
```

### 3. Event types 新增

```typescript
// reveal_policy 加到 GameEvent
interface GameEvent {
  // ...existing
  revealPolicy?: 'live' | 'phase_end' | 'game_end';
}

// 新事件类型: 'action.requested' | 'action.submitted' | 'action.timeout' | 'action.fallback'
// 'ballot.updated' | 'ballot.locked' | 'ballot.resolved'
```

---

## Task 1: Types — Ballot + ActionStatus + Event extensions

**Files:**
- Modify: `packages/shared/src/types/game.ts:75-102`
- Test: `packages/api/test/game-types.test.js` (new)

**Step 1:** Write failing test — `ActionStatus` type guard + `Ballot` shape validation

```typescript
// test: isValidActionStatus returns true for valid statuses
// test: Ballot interface has required fields
```

**Step 2:** Run test → FAIL

**Step 3:** Add types to `game.ts`:
- `ActionStatus` type union (line ~93, after GameAction)
- `PendingAction` interface extending `GameAction` (add status, requestedAt, submittedAt?, fallbackSource?)
- `Ballot` interface (voterSeat, choice, revision, locked, source, submittedAt)
- `Resolution` interface (winningChoice, tiePolicy, revoteCount, fallbackApplied)
- `revealPolicy` optional field on `GameEvent` (line ~101)
- Update `GameRuntime.pendingActions` type from `Record<string, GameAction>` to `Record<string, PendingAction>` (line 84)

**Step 4:** Run test → PASS + `pnpm --filter @cat-cafe/shared build`

**Step 5:** Commit: `feat(F101): Phase F types — Ballot, ActionStatus, PendingAction, Resolution`

---

## Task 2: WerewolfEngine — Multi-wolf ballot + resolveNightBallots

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfEngine.ts:11-56`
- Test: `packages/api/test/werewolf-night-ballot.test.js` (new)

**Step 1:** Write failing tests:
- 2 wolves submit different targets → majority wins
- 2 wolves submit same target → that target dies
- 2 wolves tie (1v1) → no_kill (空刀)
- 3 wolves: 2 agree, 1 disagrees → majority wins
- revote scenario (if first vote ties, short revote)

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- Replace `NightActions.kill?: { by, target }` with `nightBallots: Map<string, Ballot>` (line 11-16)
- New method `submitNightBallot(seatId, targetSeatId)` — creates Ballot with revision tracking
- New method `resolveNightBallots(tiePolicy)` — majority vote, returns Resolution
- Update `resolveNight()` (line 59) to use `resolveNightBallots()` instead of single `nightActions.kill`
- Keep `setNightAction()` (line 38) for non-kill actions (guard/divine/heal) unchanged

**Step 4:** Run tests → PASS + run existing `werewolf-full-game.test.js` → no regression

**Step 5:** Commit: `feat(F101): multi-wolf ballot — independent kill votes + majority resolve + tie policy`

---

## Task 3: GameOrchestrator — Action lifecycle events + timeout fallback

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts:80-123`
- Modify: `packages/api/src/domains/cats/services/game/GameEngine.ts:56-78`
- Test: `packages/api/test/game-orchestrator-fallback.test.js` (new)

**Step 1:** Write failing tests:
- action submitted → `action.requested` event logged with `revealPolicy: 'live'`
- action completed → `action.submitted` event logged
- timeout fires → `action.timeout` event for missing seats + `action.fallback` with random target
- timeout with grace period → first round gets extra time per cat breed
- after fallback → game advances (no stuck phase)

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- `handlePlayerAction()` (line 80): log `action.requested` event when action first received; set `status: 'acting'`; on completion set `status: 'acted'` + log `action.submitted`
- `tick()` (line 97): replace `clearPendingActions() + advancePhase()` with `applyFallbacks() + advancePhase()`
- New `applyFallbacks()` method: for each seat without action → generate fallback (kill=random alive non-wolf, vote=random, guard=random, divine=random) → log `action.fallback` event with `fallbackSource` + `reason: 'timeout'`
- Grace period: `getGraceMs(actorId)` — returns extra ms based on cat breed config (opus: 6000, codex/gpt52: 12000, gemini: 30000). Applied only on round 1.
- New event types added to `appendEvent()` calls with appropriate scope + `revealPolicy`

**Step 4:** Run tests → PASS + existing orchestrator tests → no regression

**Step 5:** Commit: `feat(F101): action lifecycle events + timeout fallback + grace period`

---

## Task 4: GameViewBuilder — God-view transparency + player aggregation

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameViewBuilder.ts:14-104`
- Test: `packages/api/test/game-view-builder-transparency.test.js` (new)

**Step 1:** Write failing tests:
- god-view: night timeline shows specific action targets (who killed whom)
- god-view: shows action status per seat (waiting/acting/acted/timed_out/fallback)
- god-view: shows fallback annotation (source: 'random', reason: 'timeout')
- player-view: only sees aggregate "3/4 已提交" (no seat-level detail in night)
- player-view: day votes are real-time visible (实名公开, KD-26)
- revealPolicy filtering: phase_end events hidden during phase, visible after

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- `buildView()`: add `actionStatuses` field to god-view GameView (Map of seatId → ActionStatus + details)
- `buildView()`: add `submittedCount` / `totalExpected` to player-view (aggregate only, no seat breakdown in night)
- `buildView()`: day phase votes visible to all (实名公开)
- `isVisible()` (line 106): add `revealPolicy` check — `phase_end` events filtered until phase changes
- `SeatView`: add `actionStatus?: ActionStatus` for god-view

**Step 4:** Run tests → PASS + existing view builder tests → no regression

**Step 5:** Commit: `feat(F101): god-view action transparency + player aggregate progress`

---

## Task 5: WerewolfEngine — Day vote revision + lock + commit

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfEngine.ts:125-180`
- Test: `packages/api/test/werewolf-day-vote.test.js` (new)

**Step 1:** Write failing tests:
- cast vote → creates Ballot with revision=1
- cast vote again → updates same Ballot, revision=2
- lock vote → Ballot.locked=true, further changes rejected
- all alive players locked → allVotesLocked() returns true
- resolve with tie → no exile (no_kill policy, KD-25)
- resolve with majority → exile target
- log `ballot.updated` / `ballot.locked` events

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- Replace `private votes: Map<string, string>` (line 35) with `private dayBallots: Map<string, Ballot>`
- `castVote()` → `castDayVote(voterSeat, target)`: create/update Ballot with revision++, log `ballot.updated` event (scope: public, revealPolicy: live — 实名公开)
- New `lockVote(voterSeat)`: set Ballot.locked=true, log `ballot.locked` event
- New `allVotesLocked()`: check all alive non-dead seats have locked ballot
- Update `resolveVotes()` to use `dayBallots` instead of `votes` Map
- Update `resolvePK()` similarly

**Step 4:** Run tests → PASS + existing vote tests → no regression

**Step 5:** Commit: `feat(F101): day vote revision + lock + commit mechanism`

---

## Task 6: GameOrchestrator — All-committed early advance + wolf discussion phase

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts:80-94, 219-276`
- Test: `packages/api/test/game-early-advance.test.js` (new)

**Step 1:** Write failing tests:
- all seats locked votes → phase advances early (no wait for timeout)
- all night actions submitted → phase advances early
- wolf discussion phase: 30s timer, wolves can whisper (scope: faction:wolf)

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- `handlePlayerAction()`: after action submitted, check `engine.allVotesLocked()` (day) or `engine.allActionsCollected()` (night) → if true, advance immediately
- `tick()`: add check for all-committed → early advance
- Phase definitions: add `night_wolf_discuss` phase (30s, scope: faction:wolf) before `night_wolf` action phase

**Step 4:** Run tests → PASS

**Step 5:** Commit: `feat(F101): early advance on all-committed + wolf discussion phase`

---

## Task 7: Frontend — PlayerGrid 三态 + GodInspector night panel

**Files:**
- Modify: `packages/web/src/components/game/PlayerGrid.tsx`
- Modify: `packages/web/src/components/game/GodInspector.tsx`
- Modify: `packages/web/src/stores/gameStore.ts`
- Test: `packages/web/src/components/__tests__/player-grid-action-status.test.ts` (new)
- Test: `packages/web/src/components/__tests__/god-inspector-night-panel.test.ts` (new)

**Step 1:** Write failing tests:
- `deriveActionStatusClass()`: waiting → pulse-gray, acting → pulse-yellow, acted → solid-green, timed_out → solid-red, fallback → solid-orange
- GodInspector night panel: renders ballot details (who voted whom)
- GodInspector: shows fallback annotation

**Step 2:** Run tests → FAIL

**Step 3:** Implement:
- `PlayerGrid.tsx`: new `deriveActionStatusClass(status: ActionStatus)` pure function
- `PlayerGrid.tsx`: replace binary hasActed with ActionStatus indicator
- `GodInspector.tsx`: new `NightBallotPanel` section showing per-wolf vote targets
- `GodInspector.tsx`: action status per seat with fallback annotation
- `gameStore.ts`: add `actionStatuses` and `submittedCount/totalExpected` from GameView
- `globals.css`: action status indicator animations (pulse-gray, pulse-yellow, solid-green, etc.)

**Step 4:** Run tests → PASS

**Step 5:** Commit: `feat(F101): frontend action status indicators + god-view night ballot panel`

---

## Task 8: Integration test — Full game with multi-wolf + timeout + transparency

**Files:**
- Modify: `packages/api/test/werewolf-full-game.test.js`
- Test: `packages/api/test/werewolf-phase-f-integration.test.js` (new)

**Step 1:** Write integration test:
- 7-player game: 2 wolves, 1 seer, 1 witch, 1 guard, 2 villagers
- Night 1: both wolves vote, one times out → fallback applied
- God-view: sees both wolf votes + fallback annotation
- Player-view: sees "2/2 已提交" but no specifics
- Day: players vote with revision + lock, one changes vote
- Day vote: 实名公开, all players see who voted whom
- Tie → no exile (KD-25)
- Grace period applied on round 1

**Step 2:** Run → FAIL (before implementation) → PASS (after all tasks complete)

**Step 3:** Commit: `test(F101): Phase F integration — multi-wolf ballot + fallback + transparency`

---

## Execution Order

```
Task 1 (types)          — shared 包基础类型
  ↓
Task 2 (night ballot)   — 多狼投票核心逻辑
  ↓
Task 3 (fallback)       — 超时 + 事件生命周期
  ↓
Task 4 (view builder)   — 透明度视图裁剪
  ↓
Task 5 (day vote)       — 改票 + 锁票
  ↓
Task 6 (early advance)  — 全员 commit + 狼队讨论
  ↓
Task 7 (frontend)       — 三态指示器 + 夜间面板
  ↓
Task 8 (integration)    — 全流程验证
```

**预计 commit 数**: 8 (每 task 一个 commit)
**预计文件变更**: ~15 files (+10 new test files, ~5 existing modifications)
