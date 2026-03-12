# F101: Mode v2 — Game Engine + Werewolf Implementation Plan

**Feature:** F101 — `docs/features/F101-mode-v2-game-engine.md`
**Goal:** 将 Mode 从协作流程容器改造为游戏系统引擎，首个实现：网易狼人杀
**Acceptance Criteria:**
- AC-A1: GameDefinition/GameRuntime/GameView 类型定义完成
- AC-A2: GameEngine 可自主驱动 tick，超时自动结算
- AC-A3: Event log append-only + scope 裁剪，API/socket 只返回 GameView
- AC-A4: ModeStore Redis 持久化，进程重启后可恢复游戏
- AC-A5: 旧三 mode 代码完全删除，前端入口重写为游戏模式
- AC-A6: 信息泄漏红线测试
- AC-B1: 7/9 人局可完整跑通
- AC-B2: 铲屎官可选 player 或 god-view
- AC-B3: 猫猫 AI 玩家能合理发言和执行夜间动作
- AC-B4: 信息隔离：村民看不到狼队夜聊
- AC-B5: 非法动作被拒绝
- AC-B6: 断线重连后可恢复游戏状态
- AC-B7: PlayerGrid + PhaseTimeline 前端组件可用
- AC-B8: 语音模式可选
**Architecture:** 三层架构 — GameDefinition（规则集，纯数据）→ GameRuntime（状态机+事件日志，Redis 持久化）→ GameView（按 scope 裁剪的只读视图）。法官=纯代码 GameEngine，LLM 只做玩家发言。信息隔离通过 append-only event log + scope tag 实现。
**Tech Stack:** TypeScript, Fastify, Redis, Socket.IO, Node test runner
**前端验证:** Yes — PlayerGrid / PhaseTimeline / 日夜主题切换需实测

**规则基准:** `docs/research/2026-03-11-netease-werewolf-rules.md`

---

## Straight-Line Check

**Finish line:** 铲屎官在前端开一局 9 人狼人杀，选 player 或 god-view，猫猫 AI 自动参与，系统法官驱动回合，信息严格隔离，可语音可文字，游戏可正常结束并宣布胜负。

**NOT building (v1):**
- judge 手动法官模式
- 扩展角色（狼王/白狼王/隐狼/狼美人）
- 警长竞选
- 同一 thread 多局并发
- 观战者列表（god-view 只限铲屎官本人）

---

## Terminal Schema（终态类型定义）

```typescript
// === packages/shared/src/types/game.ts ===

// --- 基础抽象 ---
type SeatId = `P${number}`          // P1, P2, ... Pn
type ActorType = 'human' | 'cat' | 'system'
type EventScope = 'public' | `seat:${SeatId}` | `faction:${string}` | 'judge' | 'god'

interface Seat {
  seatId: SeatId
  actorType: ActorType
  actorId: string           // userId or catId
  role: string              // game-specific role name
  alive: boolean
  properties: Record<string, unknown>  // game-specific (e.g. hasHealPotion)
}

// --- Game Definition (规则集，纯数据) ---
interface GameDefinition {
  gameType: string           // 'werewolf' | future games
  displayName: string
  minPlayers: number
  maxPlayers: number
  roles: RoleDefinition[]
  phases: PhaseDefinition[]
  actions: ActionDefinition[]
  winConditions: WinCondition[]
}

interface RoleDefinition {
  name: string               // 'wolf' | 'seer' | 'witch' | ...
  faction: string            // 'wolf' | 'villager'
  nightActionPhase?: string  // which phase this role acts in
  description: string
}

interface PhaseDefinition {
  name: string               // 'night_guard' | 'night_wolf' | ...
  type: 'night_action' | 'day_discuss' | 'day_vote' | 'resolve' | 'announce'
  actingRole?: string        // which role acts (null = all alive)
  timeoutMs: number
  autoAdvance: boolean       // advance when all actions collected?
}

interface ActionDefinition {
  name: string               // 'attack' | 'guard' | 'divine' | ...
  allowedRole: string
  allowedPhase: string
  targetRequired: boolean
  schema: Record<string, unknown>  // validation schema
}

// --- Game Runtime (运行时状态) ---
interface GameRuntime {
  gameId: string
  threadId: string
  gameType: string
  definition: GameDefinition
  seats: Seat[]
  currentPhase: string
  round: number
  eventLog: GameEvent[]      // append-only
  pendingActions: Map<SeatId, GameAction>
  status: 'lobby' | 'playing' | 'finished'
  winner?: string            // faction name
  config: GameConfig
  version: number            // optimistic concurrency
  createdAt: number
  updatedAt: number
}

interface GameEvent {
  eventId: string
  round: number
  phase: string
  type: string               // 'role_assigned' | 'night_action' | 'death' | 'vote' | ...
  scope: EventScope
  payload: Record<string, unknown>
  timestamp: number
}

interface GameAction {
  seatId: SeatId
  actionName: string
  targetSeat?: SeatId
  params?: Record<string, unknown>
  submittedAt: number
}

interface GameConfig {
  timeoutMs: number          // default 180000 (3 min)
  voiceMode: boolean
  humanSeat?: SeatId         // which seat is the human player
  humanRole: 'player' | 'god-view'
}

// --- Game View (裁剪后只读视图) ---
interface GameView {
  gameId: string
  threadId: string
  gameType: string
  status: 'lobby' | 'playing' | 'finished'
  currentPhase: string
  round: number
  seats: SeatView[]          // role hidden based on viewer scope
  visibleEvents: GameEvent[] // filtered by viewer scope
  myActions?: GameAction[]   // only if viewer is a player
  winner?: string
  config: Pick<GameConfig, 'timeoutMs' | 'voiceMode'>
}

interface SeatView {
  seatId: SeatId
  actorType: ActorType
  actorId: string
  displayName: string
  role?: string              // only visible if scope allows
  faction?: string           // only visible if scope allows
  alive: boolean
}
```

---

## Phase A: Game Engine Foundation

### Task A1: Delete Old Mode System

**Files to DELETE:**
- `packages/api/src/domains/cats/services/modes/BrainstormMode.ts`
- `packages/api/src/domains/cats/services/modes/DebateMode.ts`
- `packages/api/src/domains/cats/services/modes/DevLoopMode.ts`
- `packages/api/src/domains/cats/services/modes/mode-prompts.ts`
- `packages/api/src/domains/cats/services/modes/dev-loop-parser.ts`

**Files to REWRITE (later tasks):**
- `packages/shared/src/types/modes.ts` → replace with `game.ts`
- `packages/api/src/domains/cats/services/modes/mode-types.ts` → replace with game engine interface
- `packages/api/src/domains/cats/services/stores/ports/ModeStore.ts` → replace with GameStore
- `packages/api/src/domains/cats/services/orchestration/ModeOrchestrator.ts` → replace with GameOrchestrator
- `packages/api/src/routes/modes.ts` → replace with game routes
- `packages/web/src/hooks/useChatCommands.ts:759-849` → replace /mode with /game
- `packages/web/src/components/ModeStatusBar.tsx` → replace with GameStatusBar

**Steps:**
1. Delete 5 handler/prompt/parser files
2. Remove old type exports from `packages/shared/src/types/modes.ts` (keep file, rewrite content)
3. Remove `MODE_HANDLERS` registry from ModeOrchestrator
4. Remove old Zod schemas from routes/modes.ts
5. Remove /mode commands from useChatCommands.ts
6. Run `pnpm check` to find all broken imports → fix each one
7. Run `pnpm lint` to confirm clean
8. Commit: `refactor(F101): delete old mode system (brainstorm/debate/dev-loop)`

### Task A2: Game Type System

**Files:**
- Create: `packages/shared/src/types/game.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)
- Test: `packages/api/test/game-types.test.js`

**Steps:**
1. Write test: type guards (`isGameEvent`, `isValidScope`, `isSeatId`) work correctly
2. Run test → FAIL
3. Write `game.ts` with all interfaces from Terminal Schema above + type guards
4. Export from shared index
5. `pnpm --filter @cat-cafe/shared build`
6. Run test → PASS
7. Commit: `feat(F101): game type system (GameDefinition/Runtime/View/Event)`

### Task A3: GameEngine Core — Event Log + Action Validation

**Files:**
- Create: `packages/api/src/domains/cats/services/game/GameEngine.ts`
- Create: `packages/api/src/domains/cats/services/game/GameViewBuilder.ts`
- Test: `packages/api/test/game-engine.test.js`

**Steps:**
1. Write failing tests:
   - `appendEvent()` adds to event log with auto-incrementing eventId
   - `getVisibleEvents(seatId)` filters by scope correctly
   - `submitAction()` validates phase + role + alive
   - `submitAction()` rejects illegal actions (dead player, wrong phase, wrong role)
   - `allActionsCollected()` returns true when all expected actions are in
   - `buildView(viewerSeatId)` returns correctly scoped GameView
   - `buildView('god')` returns full view
2. Run tests → FAIL
3. Implement GameEngine:
   - Constructor takes `GameRuntime`
   - `appendEvent(event)` → push to eventLog, bump version
   - `submitAction(seatId, action)` → validate → store in pendingActions
   - `allActionsCollected()` → check current phase's acting role
   - `advancePhase()` → abstract (implemented by game-specific subclass)
4. Implement GameViewBuilder:
   - `buildView(runtime, viewerScope)` → filter events + seats by scope
   - Seat role/faction hidden unless viewer scope allows
5. Run tests → PASS
6. Commit: `feat(F101): GameEngine core + GameViewBuilder`

### Task A4: GameStore — Redis Persistence

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisGameStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/GameKeys.ts`
- Create: `packages/api/src/domains/cats/services/stores/ports/GameStore.ts` (interface)
- Test: `packages/api/test/game-store.test.js`

**Steps:**
1. Write failing tests:
   - `createGame()` persists to Redis, returns GameRuntime
   - `getGame(gameId)` loads from Redis
   - `updateGame(gameId, runtime)` with version check (optimistic concurrency)
   - `updateGame()` rejects stale version
   - `listActiveGames(threadId)` returns active games for thread
   - `endGame(gameId, winner)` marks as finished
2. Run tests → FAIL (use `pnpm --filter @cat-cafe/api test:redis`)
3. Implement IGameStore interface in ports/
4. Implement RedisGameStore following existing RedisThreadStore pattern
5. Implement GameKeys following existing key pattern
6. Run tests → PASS
7. Commit: `feat(F101): RedisGameStore with optimistic concurrency`

### Task A5: GameOrchestrator — System-Driven Tick

**Files:**
- Rewrite: `packages/api/src/domains/cats/services/orchestration/ModeOrchestrator.ts` → `GameOrchestrator.ts`
- Test: `packages/api/test/game-orchestrator.test.js`

核心改造：从"用户消息触发一轮"→"系统 tick 驱动"。

**Steps:**
1. Write failing tests:
   - `startGame(threadId, gameType, config, seats)` → creates game, broadcasts state
   - `tick(gameId)` → checks phase timeouts, advances if needed
   - `handlePlayerAction(gameId, seatId, action)` → validates + stores
   - `handlePlayerAction()` triggers auto-advance when all actions collected
   - `tick()` applies timeout default actions when timer expires
   - Socket broadcasts correct GameView per viewer scope
2. Run tests → FAIL
3. Implement GameOrchestrator:
   - `startGame()` → use GameStore.createGame + broadcast
   - `handlePlayerAction()` → GameEngine.submitAction + check allCollected → advancePhase
   - `tick()` → check timeout → apply defaults → advance (called by setInterval or setTimeout)
   - `broadcastGameState(gameId)` → for each connected user, build scoped GameView, emit socket
   - Timer management: `schedulePhaseTimeout(gameId, phaseTimeoutMs)`
4. Run tests → PASS
5. Commit: `feat(F101): GameOrchestrator with system-driven tick`

### Task A6: Game API Routes

**Files:**
- Rewrite: `packages/api/src/routes/modes.ts` → `packages/api/src/routes/games.ts`
- Modify: `packages/api/src/index.ts` (wire up new routes + GameStore + GameOrchestrator)
- Test: `packages/api/test/game-routes.test.js`

**Endpoints:**
```
POST   /api/threads/:threadId/game          — Start a game (gameType, config, players)
GET    /api/threads/:threadId/game          — Get current game view (scoped to requester)
POST   /api/threads/:threadId/game/action   — Submit player action
DELETE /api/threads/:threadId/game          — Abort game
GET    /api/threads/:threadId/game/history  — Past games
```

**Steps:**
1. Write route tests (HTTP-level)
2. Implement routes with Zod validation
3. Wire up in index.ts: create GameStore(redis) + GameOrchestrator
4. Update message handler integration (messages.ts:424) → route to GameOrchestrator when game active
5. Run tests → PASS
6. Commit: `feat(F101): game API routes + server wiring`

### Task A7: Information Isolation Red-Line Tests (AC-A6)

**Files:**
- Test: `packages/api/test/game-isolation.test.js`

这些是"必须永远通过"的安全红线测试：

**Test cases:**
1. Village player CANNOT see wolf faction events
2. Village player CANNOT see other players' night action results
3. Wolf player CAN see `faction:wolf` events
4. Seer CAN see their own `seat:seer` divine results
5. Witch CAN see `seat:witch` (who was knifed)
6. God-view CAN see ALL events
7. `GET /game` returns different views for different players
8. Socket `game_state_changed` delivers scoped views
9. Dead players can only see public events (no night spy)

**Steps:**
1. Write all 9 red-line tests
2. Run → they should PASS with existing GameViewBuilder
3. If any fails → fix GameViewBuilder, not the test
4. Commit: `test(F101): information isolation red-line tests`

### Task A8: Frontend — Game Status + Commands

**Files:**
- Rewrite: `packages/web/src/components/ModeStatusBar.tsx` → `GameStatusBar.tsx`
- Modify: `packages/web/src/hooks/useChatCommands.ts` (replace /mode with /game)
- Modify: `packages/web/src/stores/chatStore.ts` (replace currentMode with currentGame)

**New commands:**
```
/game werewolf [player|god-view] [voice]  — Start werewolf game
/game status                               — Show current game state
/game end                                  — Abort game
```

**Steps:**
1. Remove old ModeStatusBar, create GameStatusBar showing: game type + phase + round + timer
2. Replace /mode commands with /game commands
3. Add socket listener for `game_state_changed` → update store
4. Test manually in browser
5. Commit: `feat(F101): frontend game status bar + /game commands`

---

## Phase B: Werewolf v1

### Task B1: WerewolfDefinition — Rules as Data

**Files:**
- Create: `packages/api/src/domains/cats/services/game/werewolf/WerewolfDefinition.ts`
- Create: `packages/api/src/domains/cats/services/game/werewolf/WerewolfRoles.ts`
- Create: `packages/api/src/domains/cats/services/game/werewolf/WerewolfPresets.ts`
- Test: `packages/api/test/werewolf-definition.test.js`

**Steps:**
1. Write tests: definition has correct roles, phases, actions, win conditions for 6/7/8/9/10/12 player presets
2. Implement role definitions (wolf, seer, witch, hunter, guard, idiot, villager)
3. Implement phase sequence: NIGHT_GUARD → NIGHT_WOLF → NIGHT_SEER → NIGHT_WITCH → NIGHT_RESOLVE → DAY_ANNOUNCE → DAY_LAST_WORDS → DAY_HUNTER → DAY_DISCUSS → DAY_VOTE → DAY_PK → DAY_EXILE
4. Implement preset configs (6p, 7p, 8p, 9p, 10p, 12p) per research doc
5. Run tests → PASS
6. Commit: `feat(F101): WerewolfDefinition + role/phase/preset data`

### Task B2: WerewolfEngine — Night Resolution

**Files:**
- Create: `packages/api/src/domains/cats/services/game/werewolf/WerewolfEngine.ts`
- Test: `packages/api/test/werewolf-night.test.js`

这是最复杂的核心逻辑——夜晚结算。

**Test cases (from research doc):**
1. Wolf kills unprotected, unhealed target → target dies
2. Guard protects knifed target → target survives
3. Witch heals knifed target → target survives
4. **同守同救**: guard + witch heal same knifed target → target DIES
5. Witch poisons target → target dies (independent of knife)
6. Witch first-night self-heal → allowed
7. Witch non-first-night self-heal → rejected
8. Witch can't use both potions same night
9. Guard can't protect same target two consecutive nights
10. Hunter dies to wolf knife → can shoot; dies to witch poison → cannot shoot
11. Idiot voted out → survives but loses vote right
12. Win condition check after night resolve

**Steps:**
1. Write all 12 night resolution tests
2. Run → FAIL
3. Implement WerewolfEngine extending GameEngine:
   - `resolveNight()` — implements resolution logic from research doc
   - `resolveVote()` — handles day voting, PK, exile
   - `checkWinCondition()` — wolf-all-dead or good≤wolf
   - `advancePhase()` — phase transition logic with skip (e.g. skip NIGHT_GUARD if no guard)
4. Run → PASS
5. Commit: `feat(F101): WerewolfEngine night resolution + win conditions`

### Task B3: WerewolfEngine — Day Phase (Vote + Exile + Hunter)

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfEngine.ts`
- Test: `packages/api/test/werewolf-day.test.js`

**Test cases:**
1. Discussion phase → all players speak → advance to vote
2. Vote phase → highest votes → exile
3. Tied vote → PK round → re-vote → still tied → no exile
4. Exiled player gets last words
5. Exiled hunter → can shoot
6. Hunter shoot → target dies → check win condition
7. Idiot survives vote → loses vote right → tracked in seat.properties
8. Dead player can't vote
9. Last-words text captured as public event

**Steps:**
1. Write tests, implement, verify
2. Commit: `feat(F101): WerewolfEngine day phase (vote/exile/hunter/last-words)`

### Task B4: Game Lobby + Role Assignment

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfEngine.ts`
- Test: `packages/api/test/werewolf-lobby.test.js`

**Steps:**
1. Test: `createLobby()` with player list → LOBBY state
2. Test: `startGame()` → shuffles roles, assigns seats, deals cards
3. Test: role assignment is random (run N times, check distribution isn't fixed)
4. Test: role_assigned events have correct scope (each player only sees their own)
5. Implement + verify
6. Commit: `feat(F101): werewolf lobby + role assignment`

### Task B5: AI Cat Player Integration

**Files:**
- Create: `packages/api/src/domains/cats/services/game/werewolf/WerewolfAIPlayer.ts`
- Create: `packages/api/src/domains/cats/services/game/werewolf/werewolf-prompts.ts`
- Test: `packages/api/test/werewolf-ai-player.test.js`

**Design:**
- GameOrchestrator detects cat seats → invokes cat LLM for:
  - Night actions: inject role-specific system prompt + visible game state → function call to submit action
  - Day discussion: inject public events + role knowledge → free-form speech (text or audio rich block)
  - Day vote: inject discussion summary → function call to vote

**Prompt injection per role:**
- Wolf: knows teammates, sees wolf-faction events
- Seer: knows divine results
- Witch: knows who was knifed + potion status
- Guard: knows own guard history
- Hunter/Idiot/Villager: only public info

**Steps:**
1. Write werewolf-prompts.ts with role-specific system prompts
2. Write WerewolfAIPlayer that:
   - Receives scoped GameView + role info
   - Calls LLM with structured output (function call) for actions
   - Returns speech text for discussion phase
3. Test: AI player produces valid actions (not testing LLM quality, just structure)
4. Commit: `feat(F101): werewolf AI player + role-specific prompts`

### Task B6: Human Player Integration (Player + God-View)

**Files:**
- Modify: `packages/api/src/routes/games.ts` (human action endpoint)
- Modify: Frontend game components
- Test: `packages/api/test/werewolf-human.test.js`

**Player mode:**
- Human receives interactive rich blocks for actions (select target for night skill, vote button)
- Discussion phase: human types normally in chat
- Scoped view: only sees what their role allows

**God-view mode:**
- Human sees full GameView (all roles, all events)
- Read-only: no action endpoints available
- Special UI: PlayerGrid shows all roles revealed

**Steps:**
1. Test: player mode receives correct scoped view
2. Test: player can submit actions via API
3. Test: god-view receives full view
4. Test: god-view cannot submit actions (403)
5. Implement + verify
6. Commit: `feat(F101): human player + god-view integration`

### Task B7: Voice Mode

**Files:**
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfAIPlayer.ts`
- Test: `packages/api/test/werewolf-voice.test.js`

**Steps:**
1. Test: when `config.voiceMode = true`, AI player discussion output includes audio rich block
2. Implement: if voiceMode, wrap speech text in `{ kind: 'audio', text: '...' }` rich block
3. Verify TTS pipeline handles it (relies on F066 existing infra)
4. Commit: `feat(F101): werewolf voice mode (audio rich blocks)`

### Task B8: Frontend — PlayerGrid + PhaseTimeline

**Files:**
- Create: `packages/web/src/components/game/PlayerGrid.tsx`
- Create: `packages/web/src/components/game/PhaseTimeline.tsx`
- Create: `packages/web/src/components/game/GamePanel.tsx` (container)
- Modify: `packages/web/src/components/GameStatusBar.tsx`

**PlayerGrid:**
- Grid of player avatars (cat stickers or human avatar)
- Alive = normal, Dead = grayscale + tombstone
- Role badge visible only in god-view
- Vote indicators during vote phase

**PhaseTimeline:**
- Horizontal progress: ☀️ Day 1 → 🌙 Night 1 → ☀️ Day 2 → ...
- Current phase highlighted
- Timer countdown

**Steps:**
1. Build PlayerGrid component with props from GameView.seats
2. Build PhaseTimeline component with props from GameView.currentPhase + round
3. Build GamePanel that composes both + action buttons
4. Wire to socket updates
5. Test in browser with mock data, then real game
6. Commit: `feat(F101): PlayerGrid + PhaseTimeline + GamePanel UI`

### Task B9: Full Integration Test — 9-Person Game

**Files:**
- Test: `packages/api/test/werewolf-full-game.test.js`

端到端测试：模拟一局完整的 9 人狼人杀。

**Steps:**
1. Create game with 9 seats (1 human player + 8 AI cats)
2. Verify lobby → deal → role assignment
3. Simulate 2-3 rounds of night/day cycle with hardcoded actions
4. Verify information isolation at each step
5. Force a win condition (kill all wolves or good≤wolf)
6. Verify game ends with correct winner
7. Verify game state persists in Redis and can be recovered
8. Commit: `test(F101): full 9-person werewolf integration test`

---

## Execution Order Summary

```
Phase A (Game Engine Foundation):
  A1: Delete old modes          → clean slate
  A2: Game type system          → shared types
  A3: GameEngine core           → event log + actions + view builder
  A4: GameStore (Redis)         → persistence
  A5: GameOrchestrator          → system-driven tick
  A6: Game API routes           → HTTP + socket
  A7: Isolation red-line tests  → security gate
  A8: Frontend basics           → status bar + commands

Phase B (Werewolf v1):
  B1: WerewolfDefinition        → rules as data
  B2: WerewolfEngine nights     → core resolution logic
  B3: WerewolfEngine days       → vote/exile/hunter
  B4: Lobby + role assignment   → game start flow
  B5: AI cat players            → LLM integration
  B6: Human player              → player + god-view
  B7: Voice mode                → audio rich blocks
  B8: Frontend game UI          → PlayerGrid + PhaseTimeline
  B9: Full integration test     → end-to-end validation
```

**估计复杂度：** Phase A ~8 tasks, Phase B ~9 tasks。每个 task 含多个 TDD step。建议分 2-3 个 PR 合入（A1-A4, A5-A8, B1-B9 或更细拆）。
