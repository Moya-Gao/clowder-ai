# F101 Frontend Game UI Implementation Plan

**Feature:** F101 — `docs/features/F101-mode-v2-game-engine.md`
**Goal:** 铲屎官能看到狼人杀的完整游戏 UI：座位局势、阶段进度、事件流、操作面板，玩家/上帝两种视角
**Acceptance Criteria:**
- AC-B7: PlayerGrid + PhaseTimeline 前端组件可用
- AC-B6: 断线重连后可恢复游戏状态（v1 简单刷 GameView）
- B6 前端部分: GameShell + ActionDock + God Inspector + 日夜氛围
**Architecture:** Zustand game store + WebSocket `game:state_update` → React components. Full-screen overlay replaces chat chrome. Dark theme with CSS variable day/night toggle.
**Tech Stack:** Next.js 14 / React 18 / Tailwind / Zustand / socket.io-client / existing CatAvatar
**前端验证:** Yes — reviewer 必须用浏览器实测完整游戏流程

---

## Terminal Schema

```typescript
// gameStore state (Zustand)
interface GameStoreState {
  // Core state from WebSocket
  gameView: GameView | null;
  gameId: string | null;
  threadId: string | null;

  // UI state (local only)
  isGameActive: boolean;
  selectedTarget: SeatId | null;     // ActionDock target selection
  godScopeFilter: string;            // God Inspector scope tab
  isNight: boolean;                   // derived from currentPhase

  // Actions
  setGameView: (view: GameView, gameId: string, threadId: string) => void;
  clearGame: () => void;
  setSelectedTarget: (seatId: SeatId | null) => void;
  setGodScopeFilter: (scope: string) => void;
}
```

## Component Tree (final form)

```
ChatContainer (existing)
└── {isGameActive && <GameShell />}   ← full-screen overlay
    ├── TopBar (phase name + timer + round info)
    ├── PhaseTimeline (breadcrumb: Night1 → Day1 → Night2 → ...)
    ├── PlayerGrid (9 seat cards with avatar + name + status)
    ├── {godView
    │     ? <div flex>
    │         <EventFlow 70% />
    │         <GodInspector 30% />
    │       </div>
    │     : <EventFlow 100% />
    │   }
    └── ActionDock (vote btn + input + send)  ← day only
        OR NightStatus (role + status dot)    ← night, player view
```

## What We're NOT Building

- Judge mode (v2 — KD-5)
- Voice/TTS integration (AC-B8 done server-side, audio rich blocks render in EventFlow)
- Card-flip ceremony animation (follow-up, interactive rich block — no custom React needed)
- Mobile responsive god inspector drawer (follow-up)
- Multi-game-per-thread (KD-15 forbids this)

---

## Task 1: Game Store (Zustand)

**Files:**
- Create: `packages/web/src/stores/gameStore.ts`
- Test: `packages/web/src/stores/__tests__/gameStore.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../gameStore';

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().clearGame());

  it('setGameView populates state', () => {
    const view = {
      gameId: 'g1', threadId: 't1', gameType: 'werewolf',
      status: 'playing' as const, currentPhase: 'day_discuss',
      round: 2, seats: [], visibleEvents: [],
      config: { timeoutMs: 180000, voiceMode: false },
    };
    useGameStore.getState().setGameView(view, 'g1', 't1');
    const s = useGameStore.getState();
    expect(s.isGameActive).toBe(true);
    expect(s.gameView?.currentPhase).toBe('day_discuss');
    expect(s.isNight).toBe(false);
  });

  it('clearGame resets all state', () => {
    useGameStore.getState().setGameView(
      { gameId: 'g1', threadId: 't1', gameType: 'werewolf', status: 'playing', currentPhase: 'night_action', round: 1, seats: [], visibleEvents: [], config: { timeoutMs: 180000, voiceMode: false } },
      'g1', 't1',
    );
    useGameStore.getState().clearGame();
    expect(useGameStore.getState().isGameActive).toBe(false);
    expect(useGameStore.getState().gameView).toBeNull();
  });

  it('isNight derived from phase containing "night"', () => {
    useGameStore.getState().setGameView(
      { gameId: 'g1', threadId: 't1', gameType: 'werewolf', status: 'playing', currentPhase: 'wolf_kill', round: 1, seats: [], visibleEvents: [], config: { timeoutMs: 180000, voiceMode: false } },
      'g1', 't1',
    );
    expect(useGameStore.getState().isNight).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @cat-cafe/web vitest run src/stores/__tests__/gameStore.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```typescript
import { create } from 'zustand';
import type { GameView, SeatId } from '@cat-cafe/shared';

interface GameStoreState {
  gameView: GameView | null;
  gameId: string | null;
  threadId: string | null;
  isGameActive: boolean;
  selectedTarget: SeatId | null;
  godScopeFilter: string;
  isNight: boolean;
  setGameView: (view: GameView, gameId: string, threadId: string) => void;
  clearGame: () => void;
  setSelectedTarget: (seatId: SeatId | null) => void;
  setGodScopeFilter: (scope: string) => void;
}

const NIGHT_PHASES = new Set(['wolf_kill', 'seer_check', 'witch_act', 'guard_protect']);

function deriveIsNight(phase: string): boolean {
  return NIGHT_PHASES.has(phase) || phase.includes('night');
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameView: null,
  gameId: null,
  threadId: null,
  isGameActive: false,
  selectedTarget: null,
  godScopeFilter: 'all',
  isNight: false,

  setGameView: (view, gameId, threadId) =>
    set({
      gameView: view,
      gameId,
      threadId,
      isGameActive: view.status === 'playing' || view.status === 'lobby',
      isNight: deriveIsNight(view.currentPhase),
    }),

  clearGame: () =>
    set({
      gameView: null,
      gameId: null,
      threadId: null,
      isGameActive: false,
      selectedTarget: null,
      godScopeFilter: 'all',
      isNight: false,
    }),

  setSelectedTarget: (seatId) => set({ selectedTarget: seatId }),
  setGodScopeFilter: (scope) => set({ godScopeFilter: scope }),
}));
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```
feat(F101): add gameStore — Zustand store for game state [布偶猫🐾]
```

---

## Task 2: Wire WebSocket `game:state_update` to Store

**Files:**
- Modify: `packages/web/src/hooks/useChatSocketCallbacks.ts`
- Modify: `packages/web/src/components/ChatContainer.tsx` (import gameStore, pass callback)

**Step 1: In `useChatSocketCallbacks.ts`, add `onGameStateUpdate` callback**

```typescript
// Add to useMemo return:
onGameStateUpdate: (data) => {
  const { setGameView, clearGame } = useGameStore.getState();
  const view = data.view as GameView;
  if (view.status === 'finished') {
    // Game ended — keep view briefly for results, then clear
    setGameView(view, data.gameId, threadId);
  } else {
    setGameView(view, data.gameId, threadId);
  }
},
```

**Step 2: In `useSocket.ts`, add the `game:state_update` listener** (already has the callback type defined at line 85)

Add socket listener:
```typescript
socket.on('game:state_update', (data: { gameId: string; view: unknown; timestamp: number }) => {
  callbacksRef.current.onGameStateUpdate?.(data);
});
```

**Step 3: Commit**

```
feat(F101): wire game:state_update WebSocket to gameStore [布偶猫🐾]
```

---

## Task 3: GameShell — Full-Screen Overlay

**Files:**
- Create: `packages/web/src/components/game/GameShell.tsx`
- Test: `packages/web/src/components/game/__tests__/GameShell.test.tsx`

**Design reference:** Screen 1 (GtDPA) — full 1280×800 dark container

**Step 1: Write test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameShell } from '../GameShell';

describe('GameShell', () => {
  it('renders full-screen overlay with children', () => {
    render(<GameShell onClose={() => {}}><div data-testid="child" /></GameShell>);
    expect(screen.getByTestId('game-shell')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('has dark background matching design (#0A0F1C)', () => {
    const { container } = render(<GameShell onClose={() => {}} />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain('bg-[#0A0F1C]');
  });
});
```

**Step 2: Implement**

```tsx
'use client';
import { type ReactNode } from 'react';

interface GameShellProps {
  children?: ReactNode;
  onClose: () => void;
  isNight?: boolean;
}

export function GameShell({ children, onClose, isNight = false }: GameShellProps) {
  return (
    <div
      data-testid="game-shell"
      className={`fixed inset-0 z-50 flex flex-col bg-[#0A0F1C] text-white
        ${isNight ? 'brightness-90 saturate-75' : ''}`}
    >
      {children}
    </div>
  );
}
```

**Step 3: Commit**

---

## Task 4: PhaseTimeline Component

**Files:**
- Create: `packages/web/src/components/game/PhaseTimeline.tsx`
- Test: `packages/web/src/components/game/__tests__/PhaseTimeline.test.tsx`

**Design reference:** D3g3Z — horizontal breadcrumb: `🌙 第一夜 → ☀️ 第一天 → 🌙 第二夜 → ☀️ 第二天(active)`

**Step 1: Write test**

```typescript
it('renders current phase highlighted', () => {
  render(<PhaseTimeline round={2} currentPhase="day_discuss" phases={phases} />);
  const active = screen.getByText(/第二天/);
  expect(active.closest('[data-active="true"]')).toBeInTheDocument();
});

it('renders past phases dimmed', () => {
  render(<PhaseTimeline round={2} currentPhase="day_discuss" phases={phases} />);
  const past = screen.getByText(/第一夜/);
  expect(past.closest('[data-active="false"]')).toBeInTheDocument();
});
```

**Step 2: Implement** — render phase history from round/phase, active phase gets `bg-[#22D3EE]` (cyan), past phases get `bg-[#1E293B]`, arrows between.

**Step 3: Commit**

---

## Task 5: TopBar Component

**Files:**
- Create: `packages/web/src/components/game/TopBar.tsx`
- Test: `packages/web/src/components/game/__tests__/TopBar.test.tsx`

**Design reference:** fuVoJ — `☀️ 第二天 · 自由讨论 | ⏱ 02:34 | 第 2 轮 · 9 人局`

**Step 1: Test** — renders phase name, countdown timer, round info
**Step 2: Implement** — useEffect countdown from phaseStartedAt + timeoutMs
**Step 3: Commit**

---

## Task 6: PlayerGrid Component

**Files:**
- Create: `packages/web/src/components/game/PlayerGrid.tsx`
- Test: `packages/web/src/components/game/__tests__/PlayerGrid.test.tsx`

**Design reference:** kjgfL — 9 seat cards (56×64), avatar on top, name below, status text

Key behaviors:
- Active speaker: cyan highlight `bg-[#22D3EE]` + dark text
- Dead seat: `opacity-0.4`
- Default: `bg-[#1E293B]` + light text
- Avatar: `<CatAvatar catId={seat.actorId} size={28} />`
- Name format: `P{n} {displayName}`
- Status: 发言中/等待/死亡/投票中

**Step 1: Write test**

```typescript
it('renders all seats with avatars and names', () => {
  render(<PlayerGrid seats={mockSeats} activeSeatId="P2" />);
  expect(screen.getByText('P1 铲屎官')).toBeInTheDocument();
  expect(screen.getByText('P2 宪宪')).toBeInTheDocument();
});

it('dead seat has reduced opacity', () => {
  render(<PlayerGrid seats={[{ ...deadSeat }]} activeSeatId={null} />);
  const card = screen.getByTestId('seat-P6');
  expect(card.className).toContain('opacity-40');
});
```

**Step 2: Implement**
**Step 3: Commit**

---

## Task 7: EventFlow Component

**Files:**
- Create: `packages/web/src/components/game/EventFlow.tsx`
- Test: `packages/web/src/components/game/__tests__/EventFlow.test.tsx`

**Design reference:** 9Ezk3 — scrollable event stream with system messages + chat bubbles

Key behaviors:
- System events: `🔔 icon + text` (e.g., "法官宣布：P4 号玩家死亡")
- Chat bubbles: dark card `bg-[#1E293B]` with sender name (colored) + content
- Auto-scroll to bottom on new events
- Divider between system events and chat

**Step 1: Test** — renders system events, renders chat bubbles, auto-scrolls
**Step 2: Implement**
**Step 3: Commit**

---

## Task 8: ActionDock Component (Day)

**Files:**
- Create: `packages/web/src/components/game/ActionDock.tsx`
- Test: `packages/web/src/components/game/__tests__/ActionDock.test.tsx`

**Design reference:** 1UTZ1 — `[投票] [输入发言内容...] [发送]`

Key behaviors:
- Vote button: cyan `bg-[#22D3EE]` → opens target selection (PlayerGrid click)
- Input: text field for speech
- Send: submit speech action to API
- Hidden during night (player view) — replaced by NightStatus

**Step 1: Test**
**Step 2: Implement**
**Step 3: Commit**

---

## Task 9: NightStatus Component (Night Player View)

**Files:**
- Create: `packages/web/src/components/game/NightStatus.tsx`
- Test: `packages/web/src/components/game/__tests__/NightStatus.test.tsx`

**Design reference:** DGRX4 — `● 你的身份：预言家 · 请选择查验目标`

**Step 1: Test** — renders role name and action hint
**Step 2: Implement** — status dot (cyan) + role text + action prompt
**Step 3: Commit**

---

## Task 10: NightActionCard (Night Active Role)

**Files:**
- Create: `packages/web/src/components/game/NightActionCard.tsx`
- Test: `packages/web/src/components/game/__tests__/NightActionCard.test.tsx`

**Design reference:** yAa17 (SeerActionCard) — role header + target grid + confirm button + hint

Key behaviors:
- Shows only when it's your turn (myActions available + matching phase)
- Target grid: clickable seat cards (reuse PlayerGrid card style)
- Confirm button: `bg-[#22D3EE]` → POST /api/threads/:threadId/game/action
- Different roles show different prompts (seer: 查验, witch: 用药/毒药, guard: 守护)

**Step 1: Test**
**Step 2: Implement**
**Step 3: Commit**

---

## Task 11: GodInspector Component (God View Only)

**Files:**
- Create: `packages/web/src/components/game/GodInspector.tsx`
- Test: `packages/web/src/components/game/__tests__/GodInspector.test.tsx`

**Design reference:** QiTf3 — right panel 360px with 3 sections

### Section 1: Seat Matrix
- 9 rows: `P{n} | role (colored) | status`
- Wolf seats: red bg `#2D1619`, wolf text `#EF4444`
- Dead: `opacity-0.4`
- Status: `✓ 已行动` (cyan) / `◐ 行动中` (amber) / `— 被刀` (red) / `死亡` (gray)

### Section 2: Night Timeline
- Ordered resolution steps: Guard → Wolf → Seer → Witch → Resolve
- Each: status icon + role name (colored) + detail text
- Status: `✓` done (cyan) / `◐` in-progress (amber) / `○` pending (gray)

### Section 3: Scope Tabs
- Filter buttons: All (cyan active) / Wolves (red) / Seer (purple) / Witch (pink)
- Filters EventFlow to show only events matching selected scope

**Step 1: Test** — renders three sections, seat matrix shows roles, scope tabs filter
**Step 2: Implement**
**Step 3: Commit**

---

## Task 12: Assemble GameShell + Integration

**Files:**
- Modify: `packages/web/src/components/game/GameShell.tsx` (compose all sub-components)
- Modify: `packages/web/src/components/ChatContainer.tsx` (render GameShell when game active)

**Step 1: Test** — when `isGameActive`, ChatContainer renders GameShell instead of normal chat
**Step 2: Wire up:**
```tsx
// In ChatContainer, near the top:
const { isGameActive } = useGameStore();

// In render:
if (isGameActive) {
  return <GameShell onClose={() => useGameStore.getState().clearGame()} />;
}
// ... existing chat UI
```

**Step 3: Commit**

---

## Task 13: API Integration (fetch + submit)

**Files:**
- Create: `packages/web/src/hooks/useGameApi.ts`
- Test: `packages/web/src/hooks/__tests__/useGameApi.test.ts`

Provides:
- `fetchGameState(threadId)` → GET /api/threads/:threadId/game
- `submitAction(threadId, seatId, actionName, targetSeat?)` → POST /api/threads/:threadId/game/action
- `abortGame(threadId)` → DELETE /api/threads/:threadId/game

Used by ActionDock (vote/speak) and NightActionCard (night actions).

**Step 1: Test** — mock fetch, verify correct endpoints/payloads
**Step 2: Implement**
**Step 3: Commit**

---

## Task 14: Reconnect Recovery (AC-B6 v1)

**Files:**
- Modify: `packages/web/src/hooks/useGameApi.ts`
- Modify: `packages/web/src/components/game/GameShell.tsx`

On socket reconnect or page refresh:
1. Check if thread has active game: `GET /api/threads/:threadId/game`
2. If game exists → populate gameStore → show GameShell
3. If no game → do nothing

**Step 1: Test** — on mount, if threadId has game, auto-populate store
**Step 2: Implement** — useEffect in GameShell or ChatContainer that fetches on mount
**Step 3: Commit**

---

## Summary

| Task | Component | AC | Priority |
|------|-----------|-----|----------|
| 1 | gameStore | B7 | P0 |
| 2 | WebSocket wiring | B7 | P0 |
| 3 | GameShell | B7 | P0 |
| 4 | PhaseTimeline | B7 | P0 |
| 5 | TopBar | B7 | P0 |
| 6 | PlayerGrid | B7 | P0 |
| 7 | EventFlow | B7 | P1 |
| 8 | ActionDock | B7 | P1 |
| 9 | NightStatus | B7 | P1 |
| 10 | NightActionCard | B7 | P1 |
| 11 | GodInspector | B7 | P2 |
| 12 | Assembly | B7 | P0 |
| 13 | API hooks | B7 | P1 |
| 14 | Reconnect | B6 | P2 |

**Total: 14 tasks. Estimated new files: ~12. Lines: ~800-1000.**

All designs traced from `designs/f101-werewolf-game-ui.pen` (Design Gate passed 2026-03-11).
