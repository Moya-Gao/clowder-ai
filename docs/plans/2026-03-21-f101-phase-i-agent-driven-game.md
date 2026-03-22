---
feature_ids: [F101]
related_features: [F105, F086, F065, F024, F025, F035, F032]
topics: [game, werewolf, a2a, session, security, agent, mention]
doc_kind: plan
created: 2026-03-21
version: 1
---

# F101 Phase I — Agent-Driven Game (A2A Mention Protocol)

> **Owner**: 金渐层 (@opencode) | **Reviewer**: 缅因猫 (@codex) | **Vision Guard**: 布偶猫 (@opus)
>
> **一句话**：让猫猫从"不知道自己在玩游戏的 HTTP 被调者"变成"收到通知、理解身份、战略思考、结构化行动的真正 agent 玩家"。

## Goal

Transform the werewolf game driver from `GameAutoPlayer` (800ms tick polling + raw HTTP LLM calls where cats don't know they're playing) into `GameNarratorDriver` (narrative-driven A2A mention protocol where real cat CLI agents are woken up, receive briefings, think strategically, and submit structured actions).

## Acceptance Criteria

From `docs/features/F101-mode-v2-game-engine.md`:

### P0 Prerequisites (安全门禁 — 砚砚审查不过不开工)

- [ ] **AC-I-P0a**: Session API catId 授权 — `list_session_chain` / `read_session_events` / `read_invocation_detail` 默认只返回调用者自己的 session，防跨猫读取内心独白
- [ ] **AC-I-P0b**: Evidence 索引排除游戏 thread — `threadListFn` 过滤 `projectPath.startsWith('games/')`，游戏内容不入检索
- [ ] **AC-I-P0c**: 游戏行动走结构化工具 `submit_game_action`（gameId/round/phase/seat/action/target/nonce），引擎端做 phase/seat/role/合法性校验；`post_message` 只用于公开发言和叙事播报

### Core Implementation

- [ ] **AC-I1**: 猫猫通过 A2A mention 协议（`post_message` → dispatch → CLI `--resume`）参与游戏，不再裸调 HTTP API
- [ ] **AC-I2**: GameNarrator 发叙事消息到游戏 thread（天黑请闭眼 → 守卫请睁眼 → ...），可见节奏
- [ ] **AC-I3**: 首次唤醒 Briefing — 猫猫收到完整上下文：身份、队友（如有）、存活状况、行动指引、规则约束
- [ ] **AC-I4**: 后续 Resume Capsule — 导航指引 + 关键摘要 + 搜索提示（KD-35），不做全量状态 dump
- [ ] **AC-I5**: Session seal 后 re-briefing — 如果 CLI session 因上下文溢出被 seal，新 session 注入完整 resume capsule
- [ ] **AC-I6**: 讨论环节顺序发言 — 按座位序轮流 @猫猫，后发言者能看到前面猫说了什么
- [ ] **AC-I7**: 时限从固定相位超时改为每角色预算制（夜晚 45s/角色，讨论 30s/发言者，投票 20s/投票者）+ 全局单局 30min 天花板
- [ ] **AC-I8**: `GameDriver` 接口兼容层 — `GameAutoPlayer` 包装为 `LegacyAutoDriver`，新 `GameNarratorDriver` 实现同接口，feature flag 切换
- [ ] **AC-I9**: 游戏 thread 创建时自动设 `thinkingMode: 'play'`（心里话模式），CLI 内思考不广播（KD-36）
- [ ] **AC-I10**: 端到端验证 — 7 人局完整跑通，猫猫 CLI agent 真正接入，叙事流可观，信息隔离红线测试通过

## Architecture Overview

```
Phase H (current):                    Phase I (target):
┌──────────────────┐                  ┌──────────────────────────────────┐
│  GameAutoPlayer   │                  │  GameNarratorDriver               │
│  (800ms tick)     │                  │  (event-driven, await response)   │
│                   │                  │                                    │
│  pickRandom()  ───┼───▶ action      │  1. post_message("天黑请闭眼")     │
│  callLLM(HTTP) ───┼───▶ speech      │  2. post_message("@布偶猫 请行动") │
│                   │                  │     → dispatch → CLI --resume      │
│  800ms poll ──────┼───▶ fallback    │  3. 猫猫 submit_game_action(MCP)   │
└──────────────────┘                  │  4. Engine validates + advance     │
                                       │  5. Timeout → fallback action      │
                                       └──────────────────────────────────┘

Information Isolation (4 layers, KD-40):
┌─ Layer 1: play mode ─── CLI 内心思考不广播 (thinkingMode: 'play')
├─ Layer 2: Session auth ── catId 授权，只能读自己的 session chain
├─ Layer 3: Evidence ────── 游戏 thread 不入 evidence 索引
└─ Layer 4: Structured ─── 行动走 submit_game_action MCP 工具，不走 post_message
```

## What We're NOT Building

- **No new game types** — Phase I only changes the driver layer for werewolf
- **No frontend changes** — Chat UI, lobby, god panel from Phase D-H remain as-is
- **No new persona/identity system** — cats remain as themselves (KD-19)
- **No voice mode changes** — voice TTS integration stays as Phase H implemented
- **No session management rewrite** — we reuse existing `invoke-single-cat.ts` + `SessionManager`

## Terminal Schema (接口终态)

### GameDriver Interface

```typescript
// packages/api/src/domains/cats/services/game/GameDriver.ts (NEW)

export interface GameDriver {
  /** Start the game loop for a given game */
  startLoop(gameId: string): Promise<void>;
  /** Stop the game loop */
  stopLoop(gameId: string): Promise<void>;
  /** Stop all active loops (for graceful shutdown) */
  stopAllLoops(): Promise<void>;
  /** Recover active games on startup */
  recoverActiveGames(): Promise<void>;
}
```

### submit_game_action MCP Tool Schema

```typescript
// packages/mcp-server/src/tools/game-action-tools.ts (NEW)

interface SubmitGameActionParams {
  gameId: string;          // game UUID
  round: number;           // current round number
  phase: string;           // current phase name (e.g. 'night_wolf')
  seat: number;            // caller's seat number
  action: string;          // action type: 'kill' | 'guard' | 'divine' | 'vote' | 'speak' | 'last_words'
  target?: number;         // target seat number (for kill/guard/divine/vote)
  text?: string;           // speech content (for speak/last_words)
  nonce: string;           // idempotency key
}
```

### Briefing Capsule Structure

```typescript
// packages/api/src/domains/cats/services/game/briefing.ts (NEW)

interface BriefingCapsule {
  type: 'first_wake' | 'resume' | 'rebriefing';
  gameId: string;
  threadId: string;
  // Identity
  seatNumber: number;
  roleName: string;           // '狼人' | '预言家' | '守卫' | '女巫' | '村民'
  roleDescription: string;    // what you can do
  teammates?: string[];        // wolf pack only: other wolf catIds
  // Game state
  round: number;
  phase: string;
  aliveSeatsSummary: string;  // "存活: 座位1(布偶猫), 座位3(缅因猫), ..."
  deadSeatsSummary?: string;  // "已死亡: 座位2(第1夜被杀), 座位5(第2天被放逐)"
  // Action guidance
  currentAction: string;       // what you need to do right now
  actionConstraints: string;   // rules about your action
  toolUsage: string;           // how to use submit_game_action
  // Resume-specific (KD-35)
  searchHints?: string;        // "你可以用 get_thread_context 回看讨论记录"
  strategySummary?: string;    // brief recap of key events
}
```

---

## Implementation Order

```
Task 1: GameDriver interface + LegacyAutoDriver wrapper     (AC-I8, foundation)
Task 2: Session catId authorization (P0a)                    (AC-I-P0a, security gate)
Task 3: Evidence index game thread exclusion (P0b)           (AC-I-P0b, security gate)
Task 4: submit_game_action MCP tool (P0c)                    (AC-I-P0c, security gate)
   ── 砚砚 P0 review gate ──
Task 5: Game thread thinkingMode: 'play' (AC-I9)
Task 6: Briefing capsule builder (AC-I3, AC-I4, AC-I5)
Task 7: GameNarratorDriver — narrative + A2A dispatch        (AC-I1, AC-I2, AC-I6, AC-I7)
Task 8: Feature flag switch + recovery                       (AC-I8 completion)
Task 9: E2E validation                                       (AC-I10)
```

---

## Task 1: GameDriver Interface + LegacyAutoDriver Wrapper

**AC Coverage**: AC-I8 (foundation half)

**Files:**
- Create: `packages/api/src/domains/cats/services/game/GameDriver.ts`
- Create: `packages/api/src/domains/cats/services/game/LegacyAutoDriver.ts`
- Modify: `packages/api/src/routes/games.ts:127` — use GameDriver interface
- Modify: `packages/api/src/routes/messages.ts:124` — use GameDriver interface
- Modify: `packages/api/src/index.ts:1139` — use GameDriver interface
- Test: `packages/api/src/domains/cats/services/game/__tests__/GameDriver.test.ts`

**Why first**: All 3 GameAutoPlayer instantiation sites (games.ts L127, messages.ts L124, index.ts L1139) must go through the `GameDriver` interface. This is the injection seam that makes everything else possible. The existing `Pick<GameAutoPlayer, 'startLoop'|'stopAllLoops'>` pattern in the routes already hints at this interface — we're formalizing it.

### Step 1: Define GameDriver interface

```typescript
// packages/api/src/domains/cats/services/game/GameDriver.ts
export interface GameDriver {
  startLoop(gameId: string): Promise<void>;
  stopLoop(gameId: string): Promise<void>;
  stopAllLoops(): Promise<void>;
  recoverActiveGames(): Promise<void>;
}
```

### Step 2: Create LegacyAutoDriver that wraps GameAutoPlayer

```typescript
// packages/api/src/domains/cats/services/game/LegacyAutoDriver.ts
import type { GameDriver } from './GameDriver.js';
import { GameAutoPlayer } from './GameAutoPlayer.js';

export class LegacyAutoDriver implements GameDriver {
  private readonly autoPlayer: GameAutoPlayer;

  constructor(deps: ConstructorParameters<typeof GameAutoPlayer>[0]) {
    this.autoPlayer = new GameAutoPlayer(deps);
  }

  async startLoop(gameId: string): Promise<void> {
    return this.autoPlayer.startLoop(gameId);
  }

  async stopLoop(gameId: string): Promise<void> {
    return this.autoPlayer.stopLoop(gameId);
  }

  async stopAllLoops(): Promise<void> {
    return this.autoPlayer.stopAllLoops();
  }

  async recoverActiveGames(): Promise<void> {
    return this.autoPlayer.recoverActiveGames();
  }
}
```

### Step 3: Update all 3 instantiation sites to use `GameDriver`

At each site, replace `new GameAutoPlayer(deps)` with `new LegacyAutoDriver(deps)` and type the variable as `GameDriver`. The callers already only use `startLoop`/`stopAllLoops`/`stopLoop`/`recoverActiveGames` — zero signature mismatch.

### Step 4: Write test for GameDriver contract

Test that `LegacyAutoDriver` satisfies the `GameDriver` interface and delegates to `GameAutoPlayer`. Verify that the existing game flow (lobby → start → tick → end) still works unchanged.

### Step 5: Commit

```
feat(game): extract GameDriver interface + LegacyAutoDriver wrapper [AC-I8]

Formalizes the GameAutoPlayer → GameDriver injection seam.
All 3 instantiation sites now go through GameDriver interface.
Zero behavioral change — LegacyAutoDriver delegates 1:1.

[金渐层/Opus-46🐾]
```

---

## Task 2: Session API catId Authorization (P0a)

**AC Coverage**: AC-I-P0a

**Files:**
- Modify: `packages/api/src/routes/session-chain.ts` — add catId filter
- Modify: `packages/api/src/routes/session-transcript.ts` — add catId filter
- Modify: `packages/mcp-server/src/tools/session-chain-tools.ts` — pass callerCatId from invocation context
- Test: `packages/api/src/routes/__tests__/session-chain-auth.test.ts`

**Problem**: Currently `list_session_chain` / `read_session_events` / `read_invocation_detail` authorize by `userId` only. Session chain key = `{catId}:{threadId}` in Redis sorted sets, but any cat with same userId can read any other cat's sessions. In a werewolf game, this means a wolf cat could call `read_session_events` to read the seer's inner monologue.

### Step 1: Identify the auth check points

Route: `session-chain.ts` — `GET /api/session-chain/:threadId`
- Currently checks `thread.createdBy === userId` only
- Need: also filter results to `catId === callerCatId`

Route: `session-transcript.ts` — `GET /api/session-transcript/:sessionId`  
- Currently checks userId only
- Need: session's catId must match callerCatId

MCP tools: `session-chain-tools.ts` — `list_session_chain` / `read_session_events` / `read_invocation_detail`
- These call the API routes above
- Need: pass the invocation's `catId` in the request (from MCP invocation context)

### Step 2: Add catId filter to session-chain route

```typescript
// In session-chain.ts GET handler:
// After existing userId auth check, add:
const callerCatId = req.headers['x-cat-id'] as string | undefined;
// If callerCatId provided, filter session chain entries to only this cat's sessions
if (callerCatId) {
  entries = entries.filter(e => e.catId === callerCatId);
}
```

**Design note**: We use `x-cat-id` header (already set by the callback/MCP proxy layer) rather than a new auth mechanism. The route already runs behind the userId auth — this adds a second dimension of filtering. Non-MCP callers (e.g., hub UI with god-view) can omit the header to see all sessions (god-view is legitimate for the game owner).

### Step 3: Add catId check to session-transcript route

```typescript
// In session-transcript.ts GET handler:
// After loading session metadata:
const callerCatId = req.headers['x-cat-id'] as string | undefined;
if (callerCatId && session.catId !== callerCatId) {
  return res.status(403).json({ error: 'Cannot read another cat\'s session' });
}
```

### Step 4: Update MCP tools to pass callerCatId

In `session-chain-tools.ts`, the MCP tool handlers receive invocation context. Pass `catId` from the invocation context as `x-cat-id` header when calling the API routes.

### Step 5: Write auth tests

- Test: cat A cannot read cat B's session events via MCP tool (403)
- Test: cat A can read own session events (200)
- Test: god-view (no catId header) can see all sessions (200)
- Test: list_session_chain with catId filter returns only caller's entries

### Step 6: Commit

```
security(session): add catId authorization to session API [AC-I-P0a]

Cats can now only read their own session chains and transcripts
via MCP tools. Prevents cross-cat inner monologue leakage in
werewolf games. God-view (hub UI) retains full access.

[金渐层/Opus-46🐾]
```

---

## Task 3: Evidence Index Game Thread Exclusion (P0b)

**AC Coverage**: AC-I-P0b

**Files:**
- Modify: `packages/api/src/index.ts:370-380` — add game thread filter to `threadListFn`
- Test: `packages/api/src/domains/cats/services/__tests__/evidence-game-exclusion.test.ts`

**Problem**: `threadListFn` at index.ts L370-380 returns ALL threads to the IndexBuilder. Game threads (with `projectPath` starting with `games/`) get indexed, so a coding cat searching for "werewolf strategy" could surface game thread content.

### Step 1: Add filter to threadListFn

```typescript
// In index.ts threadListFn:
// After existing thread query, filter out game threads:
const threads = await threadStore.list();
const nonGameThreads = threads.filter(t => !t.projectPath?.startsWith('games/'));
return nonGameThreads;
```

### Step 2: Write test

- Test: threads with `projectPath: 'games/werewolf-xxx'` are excluded from evidence indexing
- Test: threads with `projectPath: 'projects/cat-cafe'` are still indexed
- Test: threads with no `projectPath` are still indexed

### Step 3: Commit

```
security(evidence): exclude game threads from evidence indexing [AC-I-P0b]

Threads with projectPath starting with 'games/' are no longer
sent to IndexBuilder. Coding cats won't find game content in
search_evidence results.

[金渐层/Opus-46🐾]
```

---

## Task 4: submit_game_action MCP Tool (P0c)

**AC Coverage**: AC-I-P0c

**Files:**
- Create: `packages/mcp-server/src/tools/game-action-tools.ts`
- Modify: `packages/mcp-server/src/index.ts` — register new tool
- Create: `packages/api/src/routes/game-actions.ts` — API endpoint for structured actions
- Modify: `packages/api/src/routes/index.ts` — mount route
- Modify: `packages/api/src/domains/cats/services/game/GameEngine.ts` — add action submission validation
- Test: `packages/api/src/routes/__tests__/game-actions.test.ts`

**Problem**: Currently game actions go through `GameAutoPlayer.buildAction()` which calls `pickRandom()` or LLM HTTP. Phase I needs cats to submit actions via MCP tool — structured, validated, idempotent.

### Step 1: Create API route for game action submission

```typescript
// packages/api/src/routes/game-actions.ts
// POST /api/game/:gameId/action
// Body: { round, phase, seat, action, target?, text?, nonce }
// Validation:
//   1. Game exists and is active
//   2. Phase matches current phase
//   3. Round matches current round
//   4. Seat is assigned to the calling catId
//   5. Action is valid for seat's role in this phase
//   6. Target is a valid alive seat (for targeted actions)
//   7. Nonce is unique (idempotency)
// On success: submit action to GameEngine, return { accepted: true }
// On validation failure: return 400 with specific error
```

### Step 2: Add validation to GameEngine

Extend `GameEngine.submitAction()` (or add new method) with:
- Phase/round check against current game state
- Seat ownership check: the catId submitting must be the actor for that seat
- Role/action legality: wolves can kill, seer can divine, guard can guard, etc.
- Nonce dedup: store submitted nonces per game in Redis, reject duplicates

### Step 3: Create MCP tool

```typescript
// packages/mcp-server/src/tools/game-action-tools.ts
// Tool: submit_game_action
// Description: "提交游戏行动。只在你被唤醒要求行动时使用。"
// Params: gameId, round, phase, seat, action, target?, text?, nonce
// Calls: POST /api/game/:gameId/action with catId from invocation context
```

### Step 4: Write comprehensive validation tests

- Test: valid wolf kill action → accepted
- Test: seer trying to kill → rejected (role mismatch)
- Test: action on wrong phase → rejected
- Test: action on wrong round → rejected
- Test: action targeting dead seat → rejected
- Test: duplicate nonce → rejected (idempotent)
- Test: cat submitting for wrong seat → rejected
- Test: speak action with text → accepted, text recorded

### Step 5: Commit

```
feat(game): add submit_game_action MCP tool with full validation [AC-I-P0c]

Structured game action submission via MCP tool. Engine validates
phase/round/seat/role/target legality + nonce dedup. Cats use
this instead of free-text post_message for game actions.

[金渐层/Opus-46🐾]
```

---

**── 砚砚 P0 Review Gate ──**

After Tasks 2-4, request 缅因猫 (@codex) review:
- Session catId auth (P0a) — can a wolf read the seer's session?
- Evidence exclusion (P0b) — does search_evidence surface game content?
- Structured action tool (P0c) — can a cat submit an invalid action?

砚砚门禁: "现在不加就推进 A2A 狼人杀，我会判不放行"

---

## Task 5: Game Thread thinkingMode: 'play'

**AC Coverage**: AC-I9

**Files:**
- Modify: `packages/api/src/routes/games.ts` — set thinkingMode on game thread creation
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts` — verify thread has play mode
- Test: `packages/api/src/routes/__tests__/game-thread-play-mode.test.ts`

**Problem**: Game threads need `thinkingMode: 'play'` so that CLI inner thoughts (origin: 'stream') are not broadcast via WebSocket to other cats. This is Layer 1 of the 4-layer info isolation (KD-40).

### Step 1: Set thinkingMode on game thread creation

In `games.ts` where the game thread is created (POST /api/game/start), ensure:
```typescript
await threadStore.update(threadId, { thinkingMode: 'play' });
```

### Step 2: Add play mode verification to GameOrchestrator

When `GameOrchestrator.startGame()` is called, verify the thread has `thinkingMode: 'play'`. If not, set it. This is a safety net for games started through other paths.

### Step 3: Write tests

- Test: new game thread has `thinkingMode: 'play'`
- Test: existing thread without play mode gets it set when game starts

### Step 4: Commit

```
feat(game): auto-set thinkingMode: 'play' on game threads [AC-I9]

Game threads now default to play mode. CLI inner thoughts
(origin: 'stream') won't broadcast via WebSocket. Layer 1
of 4-layer information isolation.

[金渐层/Opus-46🐾]
```

---

## Task 6: Briefing Capsule Builder

**AC Coverage**: AC-I3, AC-I4, AC-I5

**Files:**
- Create: `packages/api/src/domains/cats/services/game/briefing.ts`
- Test: `packages/api/src/domains/cats/services/game/__tests__/briefing.test.ts`

**Why separate from Task 7**: The briefing builder is a pure function (game state → string). It can be tested exhaustively without any A2A infrastructure.

### Step 1: Build first-wake briefing generator (AC-I3)

```typescript
export function buildFirstWakeBriefing(params: {
  seat: SeatView;
  gameState: GameRuntime;
  roleDef: RoleDefinition;
  teammates?: Array<{ catId: string; seatNumber: number }>;  // wolf pack
}): string
```

Produces a natural-language briefing like:

```
🌙 你好，布偶猫！你被分配到了 **座位 3**。
你的身份是 **预言家** — 每个夜晚你可以查验一名玩家的身份。

📋 当前存活玩家：
  座位1: 缅因猫 | 座位2: 暹罗猫 | 座位3: 你 | 座位4: 金渐层 | ...

🎯 现在是 **第 1 夜，预言家行动阶段**。
请使用 `submit_game_action` 工具选择你要查验的目标：
  - gameId: "xxx"
  - round: 1
  - phase: "night_seer"
  - seat: 3
  - action: "divine"
  - target: <目标座位号>
  - nonce: <随机字符串>

⚠️ 规则约束：
  - 不能查验自己
  - 查验结果只有你知道（信息隔离）
  - 你有 45 秒时间做出决定
```

### Step 2: Build resume capsule generator (AC-I4, KD-35)

```typescript
export function buildResumeCapsule(params: {
  seat: SeatView;
  gameState: GameRuntime;
  recentEvents: GameEvent[];  // last N relevant events
}): string
```

Produces a compact capsule:

```
🔄 游戏恢复提醒
你是 座位3 预言家。当前第 3 轮，白天讨论阶段。
存活: 座位1(缅因猫), 座位3(你), 座位4(金渐层), 座位6(暹罗猫), 座位7(布偶猫45)
已死亡: 座位2(第1夜被杀), 座位5(第2天被放逐)

💡 你可以用 get_thread_context 回看之前的讨论记录和投票结果。
```

### Step 3: Build re-briefing generator (AC-I5)

When a CLI session is sealed (context overflow) and a new session starts, generate a full re-briefing that combines first-wake identity info + resume state + search hints.

```typescript
export function buildRebriefing(params: {
  seat: SeatView;
  gameState: GameRuntime;
  recentEvents: GameEvent[];
  previousKnowledge?: string[];  // seer results, etc.
}): string
```

### Step 4: Write exhaustive tests

- Test: wolf briefing includes teammates
- Test: seer briefing does NOT include teammate info
- Test: villager briefing is minimal
- Test: resume capsule shows correct alive/dead
- Test: re-briefing includes full identity + state
- Test: briefing tool usage instructions are correct for each role
- Test: round/phase numbers are accurate

### Step 5: Commit

```
feat(game): briefing capsule builder — first-wake, resume, re-briefing [AC-I3/I4/I5]

Pure function: game state → natural language briefing for each
cat. Covers first-wake (full identity + rules), resume (compact
status + search hints), re-briefing (post-seal full recovery).

[金渐层/Opus-46🐾]
```

---

## Task 7: GameNarratorDriver — Core A2A Logic

**AC Coverage**: AC-I1, AC-I2, AC-I6, AC-I7

**Files:**
- Create: `packages/api/src/domains/cats/services/game/GameNarratorDriver.ts`
- Modify: `packages/api/src/domains/cats/services/game/GameOrchestrator.ts` — phase timeout → per-role budget
- Modify: `packages/api/src/domains/cats/services/game/werewolf/WerewolfDefinition.ts` — new timeout values
- Test: `packages/api/src/domains/cats/services/game/__tests__/GameNarratorDriver.test.ts`

This is the core task. GameNarratorDriver replaces the 800ms tick loop with event-driven narrative dispatch.

### Step 1: GameNarratorDriver skeleton

```typescript
// packages/api/src/domains/cats/services/game/GameNarratorDriver.ts
import type { GameDriver } from './GameDriver.js';

export class GameNarratorDriver implements GameDriver {
  constructor(private deps: {
    gameStore: GameStore;
    messageStore: MessageStore;
    threadStore: ThreadStore;
    orchestrator: GameOrchestrator;
    // No LLM dependency! Cats are the LLMs now.
  }) {}

  async startLoop(gameId: string): Promise<void> { /* ... */ }
  async stopLoop(gameId: string): Promise<void> { /* ... */ }
  async stopAllLoops(): Promise<void> { /* ... */ }
  async recoverActiveGames(): Promise<void> { /* ... */ }
}
```

### Step 2: Narrative message posting (AC-I2)

```typescript
private async postNarrative(threadId: string, text: string): Promise<void> {
  // Posts a system narrative message to the game thread
  // catId: null (system narrator), scope: 'public'
  // Examples: "🌙 天黑请闭眼", "🛡️ 守卫请睁眼", "☀️ 天亮了"
  await this.deps.messageStore.append(threadId, {
    role: 'system',
    catId: null,
    content: text,
    scope: 'public',
  });
}
```

### Step 3: A2A mention dispatch (AC-I1)

```typescript
private async wakeCat(params: {
  threadId: string;
  catId: string;
  briefing: string;
  timeoutMs: number;
}): Promise<void> {
  // 1. Post a @mention message to the game thread
  //    This triggers the existing dispatch pipeline:
  //    post_message → AgentRouter.routeExecution → invokeSingleCat
  //    → CLI --resume (same thread = same session chain)
  //
  // 2. The briefing content is included in the mention message
  //    The cat's CLI will receive it as the first message in the session
  //
  // 3. Set a timeout: if cat doesn't submit_game_action within
  //    timeoutMs, auto-submit fallback action

  await this.deps.messageStore.append(params.threadId, {
    role: 'system',
    content: params.briefing,
    targetCats: [params.catId],  // triggers dispatch
    scope: 'private',  // only this cat sees the briefing
  });

  // Start timeout watcher
  this.startActionTimeout(params.threadId, params.catId, params.timeoutMs);
}
```

### Step 4: Night phase — sequential role dispatch

```typescript
private async runNightPhase(gameId: string): Promise<void> {
  const game = await this.deps.gameStore.get(gameId);
  const nightRoles = ['wolf', 'seer', 'guard', 'witch'];  // in order

  for (const role of nightRoles) {
    const seats = getAliveSeatsForRole(game, role);
    if (seats.length === 0) continue;

    // Post narrative
    await this.postNarrative(game.threadId, getNightNarrative(role));
    // e.g., "🐺 狼人请睁眼" or "🔮 预言家请睁眼"

    // Wake each seat (wolves get woken together for discussion)
    if (role === 'wolf') {
      // Wolf faction: wake all wolves, they discuss via faction channel
      for (const seat of seats) {
        const briefing = buildFirstWakeBriefing({ seat, gameState: game, ... });
        await this.wakeCat({
          threadId: game.threadId,
          catId: seat.actorId,
          briefing,
          timeoutMs: 45_000,  // AC-I7: 45s per role
        });
      }
      // Wait for ALL wolves to submit kill action (or timeout)
      await this.waitForAllActions(gameId, seats, 45_000);
    } else {
      // Solo role: wake one cat
      const seat = seats[0];
      const briefing = buildFirstWakeBriefing({ seat, gameState: game, ... });
      await this.wakeCat({
        threadId: game.threadId,
        catId: seat.actorId,
        briefing,
        timeoutMs: 45_000,
      });
      await this.waitForAction(gameId, seat, 45_000);
    }

    await this.postNarrative(game.threadId, `${getRoleName(role)}请闭眼`);
  }
}
```

### Step 5: Day discuss — sequential speaking (AC-I6)

```typescript
private async runDayDiscuss(gameId: string): Promise<void> {
  const game = await this.deps.gameStore.get(gameId);
  const aliveSeats = getAliveSeats(game).sort((a, b) => a.seatNumber - b.seatNumber);

  await this.postNarrative(game.threadId, '☀️ 天亮了！请各位发表看法。');

  // Sequential: each cat speaks in seat order (AC-I6)
  for (const seat of aliveSeats) {
    await this.postNarrative(game.threadId,
      `请 座位${seat.seatNumber}(${seat.displayName}) 发言`
    );

    await this.wakeCat({
      threadId: game.threadId,
      catId: seat.actorId,
      briefing: buildResumeCapsule({ seat, gameState: game, ... }),
      timeoutMs: 30_000,  // AC-I7: 30s per speaker
    });

    // Wait for speak action (or timeout → skip)
    await this.waitForAction(gameId, seat, 30_000);
  }
}
```

### Step 6: Day vote — parallel dispatch with budget (AC-I7)

```typescript
private async runDayVote(gameId: string): Promise<void> {
  const game = await this.deps.gameStore.get(gameId);
  const aliveSeats = getAliveSeats(game);

  await this.postNarrative(game.threadId, '🗳️ 投票环节开始！');

  // Wake all voters in parallel (unlike discuss which is sequential)
  for (const seat of aliveSeats) {
    await this.wakeCat({
      threadId: game.threadId,
      catId: seat.actorId,
      briefing: buildResumeCapsule({ seat, gameState: game, ... }),
      timeoutMs: 20_000,  // AC-I7: 20s per voter
    });
  }

  // Wait for all votes (or timeout → abstain)
  await this.waitForAllActions(gameId, aliveSeats, 20_000);
}
```

### Step 7: Timeout handling + fallback actions

```typescript
private async handleTimeout(gameId: string, seat: SeatView): Promise<void> {
  // Cat didn't respond in time → submit fallback action
  // Night: random valid target (same as current Phase H behavior)
  // Vote: abstain
  // Speak: skip (empty speech)
  const fallbackAction = buildFallbackAction(game, seat);
  await this.deps.orchestrator.submitAction(gameId, fallbackAction);
}
```

### Step 8: Per-role time budgets (AC-I7)

Modify `WerewolfDefinition.ts` to expose per-role budgets instead of fixed phase timeouts:

```typescript
export const TIME_BUDGETS = {
  night_per_role: 45_000,      // 45s per role (wolves share this)
  discuss_per_speaker: 30_000, // 30s per speaker
  vote_per_voter: 20_000,      // 20s per voter
  last_words: 30_000,          // 30s for last words
  global_cap: 30 * 60_000,     // 30 min global cap
} as const;
```

### Step 9: Global 30-minute cap

```typescript
private async checkGlobalTimeout(gameId: string): Promise<boolean> {
  const game = await this.deps.gameStore.get(gameId);
  const elapsed = Date.now() - game.startedAt;
  if (elapsed > TIME_BUDGETS.global_cap) {
    await this.postNarrative(game.threadId,
      '⏰ 游戏时间超过 30 分钟，强制结束。');
    await this.deps.orchestrator.forceEnd(gameId, 'timeout');
    return true;
  }
  return false;
}
```

### Step 10: Action receipt listener

The driver needs to know when a cat has submitted an action via the `submit_game_action` MCP tool (Task 4). Use an event emitter or Redis pub/sub:

```typescript
// When submit_game_action API receives a valid action:
// 1. Submit to GameEngine
// 2. Publish event: `game:${gameId}:action:${seatNumber}`
// GameNarratorDriver subscribes to these events to unblock waitForAction()
```

### Step 11: Write tests

- Test: night phase dispatches roles in correct order
- Test: discuss phase dispatches speakers in seat order
- Test: vote phase dispatches all voters in parallel
- Test: timeout produces fallback action
- Test: 30-min global cap forces game end
- Test: action receipt unblocks the driver
- Test: narrative messages appear in correct order

### Step 12: Commit

```
feat(game): GameNarratorDriver — A2A mention dispatch + narrative flow [AC-I1/I2/I6/I7]

Replaces 800ms tick loop with event-driven A2A dispatch.
Cats are woken via @mention → CLI resume, briefed on identity
and state, then submit actions via MCP tool. Sequential discuss,
parallel vote, per-role time budgets + 30min global cap.

[金渐层/Opus-46🐾]
```

---

## Task 8: Feature Flag Switch + Recovery

**AC Coverage**: AC-I8 (completion)

**Files:**
- Create: `packages/api/src/domains/cats/services/game/createGameDriver.ts` — factory with flag
- Modify: `packages/api/src/routes/games.ts` — use factory
- Modify: `packages/api/src/routes/messages.ts` — use factory
- Modify: `packages/api/src/index.ts` — use factory for recovery
- Test: `packages/api/src/domains/cats/services/game/__tests__/createGameDriver.test.ts`

### Step 1: Create factory with feature flag

```typescript
// packages/api/src/domains/cats/services/game/createGameDriver.ts
import type { GameDriver } from './GameDriver.js';
import { LegacyAutoDriver } from './LegacyAutoDriver.js';
import { GameNarratorDriver } from './GameNarratorDriver.js';

export function createGameDriver(deps: GameDriverDeps): GameDriver {
  const useNarrator = deps.configSnapshot?.gameNarratorEnabled ?? false;
  if (useNarrator) {
    return new GameNarratorDriver(deps);
  }
  return new LegacyAutoDriver(deps);
}
```

### Step 2: Update all 3 sites to use factory

Replace `new LegacyAutoDriver(deps)` with `createGameDriver(deps)` at:
- `packages/api/src/routes/games.ts`
- `packages/api/src/routes/messages.ts`
- `packages/api/src/index.ts` (recovery)

### Step 3: Recovery support

`GameNarratorDriver.recoverActiveGames()` must:
1. Find all active games in Redis
2. For each, determine what phase/step it was in
3. Resume the narrative loop from that point

### Step 4: Write tests

- Test: flag off → LegacyAutoDriver created
- Test: flag on → GameNarratorDriver created
- Test: recovery with narrator driver resumes from correct phase

### Step 5: Commit

```
feat(game): feature flag switch + recovery for GameNarratorDriver [AC-I8]

Factory function reads gameNarratorEnabled config flag.
All 3 instantiation sites use the factory. Recovery works
for both legacy and narrator drivers.

[金渐层/Opus-46🐾]
```

---

## Task 9: End-to-End Validation

**AC Coverage**: AC-I10

**Files:**
- Create: `packages/api/src/domains/cats/services/game/__tests__/e2e-narrator-driver.test.ts`

### Validation checklist

1. **Game startup**: lobby → start → game thread created with `thinkingMode: 'play'`
2. **Night phase**: narrative messages ("天黑请闭眼" → role-by-role dispatch)
3. **Cat wakeup**: CLI agent receives @mention → resumes session → receives briefing
4. **Action submission**: cat uses `submit_game_action` → engine validates → accepts
5. **Day discuss**: sequential speaking in seat order, later speakers see earlier speech
6. **Day vote**: parallel dispatch, votes visible in real-time (KD-26)
7. **Timeout fallback**: cat that doesn't respond gets fallback action
8. **Session seal recovery**: sealed session → new session → re-briefing
9. **Info isolation red line**:
   - Cat A cannot read Cat B's session events (P0a)
   - search_evidence doesn't return game thread content (P0b)
   - submit_game_action rejects invalid role/phase combos (P0c)
   - CLI inner thoughts not visible to other cats (play mode)
10. **Full game**: 7-person game runs to completion (victory condition met)

### How to run

```bash
# Enable narrator driver
redis-cli SET cat-cafe:config:gameNarratorEnabled true

# Start a game from lobby with 7 cats
# Monitor: game thread narrative flow, CLI agent sessions, action submissions
```

### Commit

```
test(game): E2E validation for GameNarratorDriver [AC-I10]

7-person game full lifecycle test. Verifies narrative flow,
A2A dispatch, briefing capsules, action validation, timeout
fallback, session recovery, and 4-layer info isolation.

[金渐层/Opus-46🐾]
```

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Cat CLI session takes >45s to start (cold start) | Grace period on first wake per cat (KD-28): 布偶猫 +6s, 缅因猫 +12s, 暹罗猫 +30s |
| Action event delivery latency (Redis pub/sub) | Use polling fallback if pub/sub misses, 500ms poll interval |
| Session sealed mid-action (context overflow) | Re-briefing (AC-I5) auto-triggers on new session |
| Feature flag race (switch mid-game) | Flag read once at game start, stored in game state |
| Multiple games running simultaneously | Each GameNarratorDriver instance manages its own gameId, no shared state |

## Review & Vision Guard Protocol

1. **After P0 (Tasks 2-4)**: `@codex` 砚砚 P0 安全审查 — 不过不推进
2. **After each merge to main**: `@opus` 布偶猫愿景守护 — 偏航了要狠狠指出
3. **Final AC-I10**: Full team review — 铲屎官实测 7 人局
