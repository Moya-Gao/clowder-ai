# F101 Phase E — Detective Mode Implementation Plan

**Feature:** F101 — `docs/features/F101-mode-v2-game-engine.md`
**Goal:** 观战者开局选定一只猫，只能看到该玩家的身份和信息权限，其余座位只看到公开信息
**Acceptance Criteria:**
- AC-E1: 上帝推理模式（Detective Mode）— 选定一只猫，继承该座位的信息域
**Architecture:** 新增 `detective` humanRole。GameViewBuilder 接受 `detective:P3` 格式的 viewer，以被绑定座位的视角构建 view（看到该座位的 role + faction + scoped events），但人类自己不占游戏 seat（与 god-view 相同的 seat 布局）。前端 Lobby 新增 detective 选项 + 绑定猫选择。
**Tech Stack:** TypeScript, Fastify, React, Vitest, node:test
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## 终态 Schema

### Shared Types (`packages/shared/src/types/game.ts`)

```typescript
// GameConfig.humanRole 扩展
humanRole: 'player' | 'god-view' | 'detective';

// 新增字段：detective 绑定的座位
detectiveSeatId?: SeatId;  // 仅 detective 模式有值
```

### GameViewBuilder viewer 格式

```
viewer = SeatId          // player mode (e.g. 'P1')
       | 'god'           // god-view mode
       | `detective:${SeatId}`  // detective mode (e.g. 'detective:P3')
```

Detective 视角规则：
- **Role visibility**: 只看到被绑定座位的 role + faction mates（如果绑定的是狼人，看到所有狼人身份）
- **Event visibility**: public + `seat:{boundSeat}` + `faction:{boundFaction}`
- **自己没有座位**: 不参与游戏，只观察（与 god-view 相同的 seat 布局）
- **死亡后**: 被绑定座位死亡后，失去 faction visibility（与 player 一致）

### Frontend GameStartPayload

```typescript
interface GameStartPayload {
  gameType: 'werewolf';
  humanRole: 'player' | 'god-view' | 'detective';
  playerCount: number;
  catIds: string[];
  voiceMode: boolean;
  detectiveCatId?: string;  // 仅 detective 模式：绑定哪只猫
}
```

### NOT building

- 塔罗牌卡背 / 灵魂链接光效 / 翻牌仪式（视觉增强 → 单独 PR）
- DetectiveInspector 独立组件（复用现有 GodInspector 的局部渲染逻辑，按 view 数据自然裁剪）
- Detective 切换绑定目标（一局绑定一只，不可中途换）

---

## Task 1: Shared Types — 扩展 humanRole + detectiveSeatId

**Files:**
- Modify: `packages/shared/src/types/game.ts:116` (GameConfig)
- Modify: `packages/shared/src/types/game.ts:132` (GameView.config)
- Build: `pnpm --filter @cat-cafe/shared build`

**Step 1: Extend GameConfig.humanRole**

```typescript
// game.ts:116
humanRole: 'player' | 'god-view' | 'detective';
```

Add `detectiveSeatId` to GameConfig:
```typescript
// After humanSeat
detectiveSeatId?: SeatId;
```

**Step 2: Extend GameView.config**

```typescript
// game.ts:132 — add detectiveSeatId to the Pick
config: Pick<GameConfig, 'timeoutMs' | 'voiceMode' | 'humanRole'> & {
  humanSeat?: SeatId;
  detectiveSeatId?: SeatId;
};
```

**Step 3: Build shared**

```bash
pnpm --filter @cat-cafe/shared build
```

**Step 4: Commit**

```bash
git commit -m "feat(F101): extend GameConfig with detective humanRole + detectiveSeatId"
```

---

## Task 2: GameViewBuilder — detective viewer 支持

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/GameViewBuilder.ts`
- Test: `packages/api/test/game-view-builder.test.js` (new)

**Step 1: Write failing tests**

Three tests:
1. `detective:P3 sees P3's role and faction mates' roles, not others`
2. `detective:P3 sees public + seat:P3 + faction events, not god/other-seat`
3. `detective view loses faction visibility when bound seat dies`

**Step 2: Run tests — verify RED**

**Step 3: Implement detective viewer**

In `buildView`, parse `detective:${seatId}` from viewer:
```typescript
const isDetective = typeof viewer === 'string' && viewer.startsWith('detective:');
const detectiveBoundSeat = isDetective ? viewer.slice(10) as SeatId : undefined;
const effectiveViewer = detectiveBoundSeat ?? (isGod ? undefined : viewer as SeatId);
```

Visibility: detective uses the bound seat's perspective for events and role masking, but is NOT a seat themselves.

**Step 4: Run tests — verify GREEN**

**Step 5: Commit**

---

## Task 3: Game Routes — detective mode 支持

**Files:**
- Modify: `packages/api/src/routes/games.ts:116` (gameStartSchema)
- Modify: `packages/api/src/routes/games.ts:184-188` (config construction)
- Modify: `packages/api/src/routes/games.ts:258-274` (GET viewer logic)
- Modify: `packages/api/src/routes/games.ts:298,337` (action/god permission)
- Modify: `packages/api/src/routes/game-command-interceptor.ts:112` (BuildSeatsInput)
- Test: `packages/api/test/game-routes.test.js`

**Step 1: Write failing tests**

1. `POST /api/game/start with detective mode + detectiveCatId creates game with detectiveSeatId`
2. `POST /api/game/start detective mode rejects when detectiveCatId missing`
3. `GET /api/threads/:threadId/game in detective mode returns detective-scoped view`

**Step 2: Implement**

- `gameStartSchema`: add `'detective'` to humanRole enum, add `detectiveCatId: z.string().optional()`
- `buildGameSeats`: detective = same as god-view (all cats, no human seat)
- Config: `humanRole === 'detective'` → resolve detectiveCatId to seatId, set `detectiveSeatId`
- GET viewer: detective mode → `viewer = 'detective:' + runtime.config.detectiveSeatId`
- Action submission: detective cannot submit actions (like god-view)
- God actions: detective cannot use god actions (unlike god-view)

**Step 3: Verify GREEN**

**Step 4: Commit**

---

## Task 4: Frontend Lobby — detective mode + 猫选择

**Files:**
- Modify: `packages/web/src/components/game/GameLobby.tsx`
- Modify: `packages/web/src/components/ChatInput.tsx` (startGame payload)
- Test: `packages/web/src/components/__tests__/chat-input-game-send-guard.test.ts`

**Step 1: GameStartPayload — add detective fields**

```typescript
export interface GameStartPayload {
  gameType: 'werewolf';
  humanRole: 'player' | 'god-view' | 'detective';
  playerCount: number;
  catIds: string[];
  voiceMode: boolean;
  detectiveCatId?: string;
}
```

**Step 2: GameLobby — third mode option**

Add `detective` button alongside player/god-view. When detective selected:
- Show cat selection grid (pick ONE cat to bind)
- Seat count = all cats (same as god-view)
- Confirm disabled until a cat is selected

**Step 3: Write test — detective mode sends detectiveCatId in payload**

**Step 4: Verify GREEN**

**Step 5: Commit**

---

## Task 5: Frontend Game UI — detective view 渲染

**Files:**
- Modify: `packages/web/src/components/game/GodInspector.tsx` (conditional rendering)
- Modify: `packages/web/src/components/game/GameShell.tsx` (detective layout)

**Step 1: Detective layout**

Detective mode renders similarly to god-view but:
- GodInspector shows only visible info (seats without roles show "?" card back)
- No god action buttons (pause/resume/skip) — detective is pure observer
- 顶部标示 "🔍 推理模式 — 绑定: {catName}"

Since GameView already returns scoped data, the frontend naturally renders only what's visible — the main change is hiding god action buttons and showing the bound cat indicator.

**Step 2: Commit**

---

## 直线路径检查

| Step | 终态产物？ | 可验证？ | 移除代价？ |
|------|-----------|---------|-----------|
| Task 1 (types) | ✅ 终态 schema | build 通过 | 后续全部编译失败 |
| Task 2 (ViewBuilder) | ✅ 核心信息隔离 | 3 unit tests | 无法正确裁剪视图 |
| Task 3 (routes) | ✅ API 端点 | 3 API tests | 无法创建/查询 detective 游戏 |
| Task 4 (lobby) | ✅ 入口 UI | 1 component test | 无法选择 detective 模式 |
| Task 5 (game UI) | ✅ 运行时 UI | manual verification | 功能可用但体验不完整 |
