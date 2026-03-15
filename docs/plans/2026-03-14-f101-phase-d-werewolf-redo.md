# F101 Phase D — 狼人杀重做 Implementation Plan

**Feature:** F101 — `docs/features/F101-mode-v2-game-engine.md`
**Goal:** 基于铲屎官 1v1 采访定案，重做狼人杀体验：独立游戏 thread、上帝操控面板、真实就绪状态、战绩结算+MVP
**Acceptance Criteria:**
- AC-D1: 游戏在独立 thread 运行，归档分类 `游戏-狼人杀`，左侧栏可见
- AC-D2: 猫猫保留咖啡馆身份（宪宪/砚砚/烁烁），复用现有头像系统 — ✅ 已满足（KD-14）
- AC-D3: 上帝面板三按钮（发牌、暂停/恢复、跳过阶段），无踢人功能
- AC-D4: 每只猫展示真实 ready 状态 + 卡住时有 loading 指示
- AC-D5: 狼人猫猫风 UX（可爱+暗色调+猫猫 cosplay 狼人）— 视觉资产需暹罗猫，本次先做深色主题框架
- AC-D6: 结算画面 — 胜负 + 各玩家统计 + MVP 评选
**Architecture:** 三层扩展 — GameRuntime 加 `paused` 状态 + god actions API；Thread 用 `projectPath: 'games/werewolf'` 分类；前端加 GameResultScreen 组件 + GodPanel 按钮
**Tech Stack:** TypeScript, Fastify, Zustand, React, Tailwind
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## 不做的事（Scope 边界）

- D5 的完整视觉资产（狼人猫猫头像装扮等）— 需暹罗猫参与，本次只做深色主题配色
- LLM 驱动的 AI 发言策略 — 保持 GameAutoPlayer 确定性逻辑
- Judge 模式 — v2 范围
- 跨局战绩排行榜 — F075 范围，本次只做单局结算画面

## Terminal Schema

### 新增/修改的类型

```typescript
// packages/shared/src/types/game.ts 扩展
interface GameRuntime {
  // ...existing...
  status: 'lobby' | 'playing' | 'paused' | 'finished'; // 加 paused
}

interface GameConfig {
  // ...existing...
  godActions?: boolean; // god-view 模式下是否启用上帝操控
}

// GameView 扩展
interface GameView {
  // ...existing...
  gameStats?: GameResultStats; // status === 'finished' 时填充
}

interface GameResultStats {
  winner: string; // faction
  mvpSeatId: string;
  mvpReason: string;
  players: Array<{
    seatId: string;
    actorId: string;
    role: string;
    faction: string;
    survived: boolean;
    won: boolean;
    killCount: number;
    savedCount: number;
    divineCount: number;
  }>;
  rounds: number;
  duration: number; // ms
}
```

### 新增 API 端点

```
POST /api/threads/:threadId/game/god-action
  body: { action: 'pause' | 'resume' | 'skip_phase' | 'deal_roles', params?: {...} }
  → 仅 humanRole === 'god-view' 可用
```

---

## Task 1: GameRuntime 加 `paused` 状态（AC-D3 基础）

**Files:**
- Modify: `packages/shared/src/types/game.ts:85` — status union 加 `'paused'`
- Test: `packages/api/test/game-pause.test.js`

**Step 1: Write failing test — pause/resume lifecycle**

```javascript
// game-pause.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('GameRuntime pause/resume', () => {
  it('status type accepts paused', () => {
    // TypeScript compile check — verify 'paused' is valid
    const status = 'paused';
    assert.ok(['lobby', 'playing', 'paused', 'finished'].includes(status));
  });
});
```

**Step 2: Modify shared type**

In `packages/shared/src/types/game.ts:85`:
```typescript
status: 'lobby' | 'playing' | 'paused' | 'finished';
```

**Step 3: Rebuild shared**

```bash
pnpm --filter @cat-cafe/shared build
```

**Step 4: Commit**

---

## Task 2: God Actions API — pause/resume/skip（AC-D3）

**Files:**
- Modify: `packages/api/src/routes/games.ts` — 新增 `POST /god-action` 路由
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts` — 新增 `pauseGame`, `resumeGame`, `skipPhase` 方法
- Test: `packages/api/test/god-actions.test.js`

**Step 1: Write failing tests**

```javascript
// god-actions.test.js — 6 tests
describe('God Actions API', () => {
  it('pauses a playing game');
  it('resumes a paused game');
  it('skips current phase');
  it('rejects god actions in player mode (403)');
  it('rejects pause when already paused (400)');
  it('rejects resume when not paused (400)');
});
```

**Step 2: Implement GameOrchestrator methods**

```typescript
// GameOrchestrator.ts
async pauseGame(gameId: string): Promise<void> {
  const runtime = await this.store.getGame(gameId);
  if (!runtime) throw new Error('Game not found');
  if (runtime.status !== 'playing') throw new Error('Game is not playing');
  runtime.status = 'paused';
  runtime.updatedAt = Date.now();
  await this.store.updateGame(gameId, runtime);
  this.socket.broadcastToRoom(`thread:${runtime.threadId}`, 'game:paused', { gameId, timestamp: Date.now() });
}

async resumeGame(gameId: string): Promise<void> {
  const runtime = await this.store.getGame(gameId);
  if (!runtime) throw new Error('Game not found');
  if (runtime.status !== 'paused') throw new Error('Game is not paused');
  runtime.status = 'playing';
  runtime.phaseStartedAt = Date.now(); // reset phase timer
  runtime.updatedAt = Date.now();
  await this.store.updateGame(gameId, runtime);
  this.socket.broadcastToRoom(`thread:${runtime.threadId}`, 'game:resumed', { gameId, timestamp: Date.now() });
  await this.broadcastGameState(gameId);
}

async skipPhase(gameId: string): Promise<void> {
  const runtime = await this.store.getGame(gameId);
  if (!runtime) throw new Error('Game not found');
  if (runtime.status !== 'playing') throw new Error('Game is not playing');
  const engine = new GameEngine(runtime);
  engine.appendEvent({
    round: runtime.round, phase: runtime.currentPhase,
    type: 'god_skip', scope: 'public',
    payload: { reason: 'god_skipped_phase' },
  });
  this.advancePhase(engine);
  await this.store.updateGame(gameId, engine.getRuntime());
  await this.broadcastGameState(gameId);
}
```

**Step 3: Add route handler**

```typescript
// games.ts — POST /api/threads/:threadId/game/god-action
app.post('/api/threads/:threadId/game/god-action', async (request, reply) => {
  const { threadId } = request.params;
  const runtime = await gameStore.getActiveGame(threadId);
  if (!runtime) { reply.status(404); return { error: 'No active game' }; }
  if (runtime.config.humanRole !== 'god-view') { reply.status(403); return { error: 'god actions require god-view mode' }; }

  const body = request.body as { action: string };
  switch (body.action) {
    case 'pause': await orchestrator.pauseGame(runtime.gameId); return { ok: true };
    case 'resume': await orchestrator.resumeGame(runtime.gameId); return { ok: true };
    case 'skip_phase': await orchestrator.skipPhase(runtime.gameId); return { ok: true };
    default: reply.status(400); return { error: `Unknown god action: ${body.action}` };
  }
});
```

**Step 4: Run tests, verify green**

**Step 5: Commit**

---

## Task 3: Game End Detection + Stats in GameView（AC-D6 基础）

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts` — advancePhase 后检查 win condition，status → finished
- Modify: `packages/api/src/domains/cats/services/game/GameViewBuilder.ts` — finished 时附带 gameStats
- Modify: `packages/api/src/domains/cats/services/game/GameStatsRecorder.ts` — 加 `killCount`, `savedCount`, `divineCount` + MVP 计算
- Test: `packages/api/test/game-end-stats.test.js`

**Step 1: Write failing tests**

```javascript
describe('Game End + Stats', () => {
  it('sets status=finished and winner when all wolves dead');
  it('GameView includes gameStats when finished');
  it('MVP is the player with the highest impact');
  it('GameAutoPlayer stops loop when game finishes');
});
```

**Step 2: Extend GameStatsRecorder with MVP**

Add `extractDetailedStats` that counts per-player actions from eventLog:
- `killCount`: events where player was the wolf killer
- `savedCount`: events where player healed/guarded successfully
- `divineCount`: events where player divined

MVP logic: highest `killCount + savedCount * 2 + divineCount` on winning side.

**Step 3: Extend GameViewBuilder**

When `runtime.status === 'finished'`, attach `gameStats` to GameView by calling `GameStatsRecorder.extractDetailedStats(runtime)`.

**Step 4: Extend GameOrchestrator.advancePhase**

After advancing, check `WerewolfEngine.checkWinCondition()`. If non-null, set `runtime.status = 'finished'`, `runtime.winner = result`, broadcast `game:finished` event.

**Step 5: Run tests, verify green**

**Step 6: Commit**

---

## Task 4: Game AutoPlayer stops on pause/finish（AC-D3 + D6）

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameAutoPlayer.ts:71` — check `paused`/`finished`
- Test: `packages/api/test/game-auto-player-lifecycle.test.js`

**Step 1: Write failing test**

```javascript
it('stops acting when game status is paused');
it('exits loop when game status is finished');
```

**Step 2: Modify runLoop**

```typescript
if (!runtime || runtime.status === 'finished') return;
if (runtime.status === 'paused') { await sleep(TICK_MS); continue; }
if (runtime.status !== 'playing') return;
```

**Step 3: Run tests, verify green**

**Step 4: Commit**

---

## Task 5: Independent Game Thread（AC-D1）

**Files:**
- Modify: `packages/api/src/routes/game-command-interceptor.ts` — 游戏开始时创建独立 thread（projectPath: `games/werewolf`）
- Modify: `packages/api/src/routes/messages.ts` — `/game` 拦截器创建新 thread
- Test: `packages/api/test/game-thread.test.js`

**Step 1: Write failing test**

```javascript
describe('Independent Game Thread', () => {
  it('creates a new thread with projectPath games/werewolf when /game command is sent');
  it('new thread has title containing 狼人杀');
  it('game runs in the new thread, not the source thread');
});
```

**Step 2: Modify /game interceptor in messages.ts**

When a `/game` command is intercepted:
1. Create a new thread: `threadStore.create(userId, '狼人杀 — 7人局', 'games/werewolf')`
2. Start the game in the new thread (not resolvedThreadId)
3. Return `{ status: 'game_started', gameId, threadId: newThread.id }` so frontend can navigate

**Step 3: Run tests, verify green**

**Step 4: Commit**

---

## Task 6: Frontend — Game Result Screen（AC-D6）

**Files:**
- Create: `packages/web/src/components/game/GameResultScreen.tsx`
- Modify: `packages/web/src/stores/gameStore.ts` — detect `status === 'finished'`, keep game active for result display
- Modify: `packages/web/src/components/game/GameOverlayConnector.tsx` — render GameResultScreen when finished
- Test: `packages/web/test/game-result-screen.test.tsx` (render test)

**Step 1: Write failing test**

```javascript
it('renders winner faction name');
it('renders MVP player with reason');
it('renders all players with role, survived, won columns');
it('has a close button to exit results');
```

**Step 2: Implement GameResultScreen**

深色主题组件：
- 顶部：胜利阵营（好人胜/狼人胜）+ 动效
- 中间：MVP 卡片（头像 + 角色 + 原因）
- 下方：所有玩家表格（头像、昵称、角色、阵营、存活、胜负）
- 底部：关闭按钮

**Step 3: Modify gameStore**

```typescript
// deriveFromView — keep game active during 'finished' for result display
isGameActive: view.status === 'playing' || view.status === 'lobby' || view.status === 'finished',
```

**Step 4: Modify GameOverlayConnector**

```typescript
if (gameView?.status === 'finished') {
  return <GameResultScreen stats={gameView.gameStats} onClose={clearGame} />;
}
```

**Step 5: Run tests, verify green**

**Step 6: Commit**

---

## Task 7: Frontend — God Panel Buttons（AC-D3）

**Files:**
- Modify: `packages/web/src/components/game/GodInspector.tsx` — 加三个操控按钮
- Modify: `packages/web/src/components/game/GameOverlay.tsx` — 传递 god action callbacks
- Create: `packages/web/src/hooks/useGodActions.ts` — API call hook
- Test: `packages/web/test/god-panel-buttons.test.tsx`

**Step 1: Write failing test**

```javascript
it('renders deal, pause, skip buttons in god-view');
it('pause button toggles to resume when paused');
it('does not render god buttons in player mode');
```

**Step 2: Implement useGodActions hook**

```typescript
export function useGodActions(threadId: string | null) {
  const pause = () => fetch(`/api/threads/${threadId}/game/god-action`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
  const resume = () => fetch(...{ action: 'resume' });
  const skipPhase = () => fetch(...{ action: 'skip_phase' });
  return { pause, resume, skipPhase };
}
```

**Step 3: Add buttons to GodInspector**

Three buttons at the top of the panel:
- 发牌（deal_roles）— Phase D scope 内先禁用（标记 coming soon），因为需要 UI 选角色
- 暂停/恢复 — toggle between pause/resume
- 跳过阶段 — skip current phase

**Step 4: Run tests, verify green**

**Step 5: Commit**

---

## Task 8: Frontend — Real Ready State（AC-D4）

**Files:**
- Modify: `packages/web/src/components/game/PlayerGrid.tsx` — 显示 ready/loading 状态
- Modify: `packages/web/src/stores/gameStore.ts` — 从 GameView 派生 ready 信息
- Test: `packages/web/test/ready-state.test.tsx`

**Step 1: Write failing test**

```javascript
it('shows loading indicator for seats with no pending action in action phase');
it('shows ready checkmark for seats that have submitted action');
```

**Step 2: Derive ready state from pendingActions**

在 GameView 中，`seats` + `pendingActions`（如果可见）可以判断谁已提交动作。对于 god-view，所有 seat 状态可见。对于 player，只看到公开信息。

GodInspector 已有 `status` 字段（已行动/行动中/等待）— 扩展 PlayerGrid 也展示简化版。

**Step 3: Implement in PlayerGrid**

给每个 seat 添加小圆点指示器：
- 绿色 ✓ = 已提交动作
- 黄色 ◐ = 正在思考/加载
- 灰色 ○ = 等待中

**Step 4: Run tests, verify green**

**Step 5: Commit**

---

## Task 9: 深色主题框架（AC-D5 部分）

**Files:**
- Modify: `packages/web/src/components/game/GameShell.tsx` — 确保深色基底
- Modify: `packages/web/src/components/game/TopBar.tsx` — 暗色调 + 氛围色
- 无需新文件 — 现有组件已使用 `bg-[#0A0F1C]` 暗色系

**分析：** 现有 GameShell、GodInspector、GameLobby 已全部使用深色配色（`#0A0F1C`、`#0F172A`、`#1E293B`）。狼人猫猫风的核心视觉差异在于：
1. 角色颜色加深/饱和（已有 ROLE_COLORS）
2. 夜间氛围（已有 `isNight` 条件渲染）
3. 猫猫装扮头像 — 需要暹罗猫设计

**结论：** 深色主题已基本就位，仅需微调。本 Task 合并到 Task 6（GameResultScreen）和 Task 7（GodPanel）中的样式调整，不单独成 Task。

---

## 执行顺序

```
Task 1 (type扩展) → Task 2 (god actions API) → Task 3 (game end + stats) → Task 4 (autoplayer lifecycle)
→ Task 5 (independent thread) → Task 6 (result screen) → Task 7 (god panel) → Task 8 (ready state)
```

后端先行（Task 1-5），前端跟进（Task 6-8）。Task 9 已合并。

预计 8 个 Task，每个 2-5 个 step，TDD red-green 纪律。
