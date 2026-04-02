---
feature_ids: [F149]
doc_kind: plan
created: 2026-04-02
---

# F149 Phase B: Gemini ACP Hosted Provider — Implementation Plan

**Feature:** F149 — `docs/features/F149-acp-runtime-operations.md`
**Goal:** 让烁烁的 @gemini 消息走 ACP 协议而不是旧 headless CLI，且两条路径可配置切换
**Acceptance Criteria:**
- AC-B1: Gemini ACP 在仓库 cwd 下可完成 `initialize → newSession → prompt`
- AC-B2: 同一 ACP process 内，至少两个 thread session 可顺序复用而不重新 `initialize`
- AC-B3: warm attach 路径不再重付 cold `initialize` 成本
- AC-B4: 失败分类至少区分 `init_failure / prompt_failure / model_capacity / mcp_pollution / lease_timeout`
**Architecture:** 新建 `GeminiAcpAdapter implements AgentService`，内部持有一个长驻 `AcpClient` 实例（lazy init），通过 `promptStream()` 流式 yield `AgentMessage`。启动时读 cat-config.json `acp` section 决定注册哪个实现。两条路径（旧 CLI / 新 ACP）共存，配置切换。
**Tech Stack:** AcpClient (Phase A), AgentService interface, cat-config.json
**前端验证:** Yes — 成员总览卡片需显示 ACP/CLI badge（Task 4.5）

---

## Straight-Line Check

**Finish line (B):** `@gemini` 消息通过 ACP 协议完成对话，流式回传 AgentMessage，且可通过 cat-config.json 切换回旧 headless CLI。

**NOT building:**
- 进程池/lease（Phase C）
- 多 carrier 泛化（Phase D）
- 前端 UI 改动
- session resume（loadSession）— V1 每次 newSession，session 复用留 Phase C

**Terminal schema:**
```typescript
// GeminiAcpAdapter — the final form, Phase C only adds pool layer on top
class GeminiAcpAdapter implements AgentService {
  async *invoke(prompt, options): AsyncIterable<AgentMessage>
}
```

**Step validation:**
1. `promptStream` — stays as-is, Phase C wraps it → extend only ✅
2. Event transformer — pure function, permanent → extend only ✅
3. Adapter class — final form, Phase C adds pool on top → extend only ✅
4. Registration switch — permanent → extend only ✅
5. Integration test — permanent → extend only ✅

---

## Task 1: Add `promptStream()` to AcpClient

Phase A's `promptCollect()` waits for all events then returns. Phase B needs streaming for real-time UI. Add `promptStream()` that yields events as they arrive.

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.ts`
- Test: `packages/api/test/acp/acp-client.test.js`

**Design:**
```typescript
async *promptStream(sessionId: string, text: string, options?: { timeoutMs?: number }):
  AsyncGenerator<AcpSessionUpdate, AcpStopReason> {
  // 1. Create a push queue (notification listener → queue)
  // 2. Send session/prompt request
  // 3. yield* from queue as events arrive
  // 4. When prompt response comes back, return stopReason
}
```

Uses a simple push-queue pattern: notification listener pushes to an array, generator pulls from it via a resolve/wait cycle.

**Steps:**
1. Write failing test: `promptStream yields events as they arrive`
2. Run test → RED
3. Implement `promptStream()` in AcpClient
4. Run test → GREEN
5. Verify existing 9 tests still pass
6. Commit

---

## Task 2: ACP Event Transformer

Pure function: maps `AcpSessionUpdate` → `AgentMessage | null`.

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/acp/acp-event-transformer.ts`
- Test: `packages/api/test/acp/acp-event-transformer.test.js`

**Mapping:**

| AcpSessionUpdateType | AgentMessage type | Notes |
|---|---|---|
| `agent_message_chunk` | `text` | content.text |
| `agent_thought_chunk` | `system_info` | type=thinking, content.text |
| `tool_call` | `tool_use` | extract toolName + toolInput |
| `tool_call_update` | `tool_use` | incremental tool output |
| `plan` | `system_info` | type=plan |
| `user_message_chunk` | null | skip echo |
| others | null | skip |

**Design:**
```typescript
export function transformAcpEvent(
  update: AcpSessionUpdate,
  catId: CatId,
  metadata: MessageMetadata,
): AgentMessage | null
```

**Steps:**
1. Write failing tests for each mapping (6+ cases)
2. Run → RED
3. Implement transformer
4. Run → GREEN
5. Commit

---

## Task 3: GeminiAcpAdapter

The main deliverable — implements `AgentService`, wraps AcpClient with lazy init.

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/acp/GeminiAcpAdapter.ts`
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js`

**Design:**

```typescript
interface GeminiAcpAdapterOptions {
  catId?: CatId;
  model?: string;
  acpConfig: { command: string; startupArgs: string[]; mcpWhitelist?: string[] };
  workingDirectory?: string;
  spawnFn?: typeof nodeSpawn;  // for testing
}

class GeminiAcpAdapter implements AgentService {
  private client: AcpClient | null = null;
  private initPromise: Promise<void> | null = null;

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    // 1. Ensure AcpClient initialized (lazy, shared across invocations)
    await this.ensureInitialized(options);
    // 2. Create new ACP session
    const session = await this.client.newSession(cwd, mcpServers);
    // 3. yield session_init
    // 4. Stream prompt → yield transformed AgentMessage events
    // 5. yield done with stopReason-based metadata
    // 6. Error handling: classify failures (init_failure, prompt_failure, model_capacity, etc.)
  }

  private async ensureInitialized(options): Promise<void> {
    if (this.client?.isAlive) return;
    // Lazy init: spawn + initialize, reuse across invocations (AC-B2, AC-B3)
  }
}
```

**Key behaviors:**
- **Lazy init**: First `invoke()` spawns AcpClient + calls `initialize()`. Subsequent calls reuse (AC-B2, AC-B3).
- **Session per invocation**: Each `invoke()` calls `newSession()`. Session reuse is Phase C.
- **Failure classification** (AC-B4): Catch AcpProtocolError/AcpTimeoutError, map to error categories.
- **System prompt**: Prepend to prompt text (Gemini CLI has no system prompt flag, ACP same).
- **AbortSignal**: Wire options.signal to client.close() on abort.

**Steps:**
1. Write failing test: `invoke yields session_init + text + done`
2. Run → RED
3. Implement GeminiAcpAdapter skeleton
4. Run → GREEN
5. Write test: `reuses AcpClient across invocations (no re-initialize)`
6. Run → RED → implement ensureInitialized → GREEN
7. Write test: `classifies init failure vs prompt failure`
8. Run → RED → implement error classification → GREEN
9. Commit

---

## Task 4: Registration Switch

Wire GeminiAcpAdapter into startup: if cat-config has `acp` section, register AcpAdapter; else GeminiAgentService.

**Files:**
- Modify: `packages/api/src/index.ts:724-726`
- Modify: `packages/api/src/domains/cats/services/index.ts` (export)

**Design:**
```typescript
// index.ts line 724
case 'google': {
  const catFullConfig = catConfigStore.getRawConfig(id);
  if (catFullConfig?.acp) {
    const { GeminiAcpAdapter } = await import(
      './domains/cats/services/agents/providers/acp/GeminiAcpAdapter.js'
    );
    service = new GeminiAcpAdapter({
      catId,
      acpConfig: catFullConfig.acp,
      workingDirectory: process.cwd(),
    });
  } else {
    service = new GeminiAgentService({ catId });
  }
  break;
}
```

**Steps:**
1. Read catConfigStore to understand how to access raw config with `acp` section
2. Add dynamic import + conditional registration
3. Add export in services/index.ts
4. Verify `pnpm lint` + `pnpm check` pass
5. Commit

---

## Task 4.5: Frontend Visibility — ACP Badge in Member Overview

铲屎官要求：前端成员协作-总览能看到当前是 ACP 还是旧 CLI。

**Files:**
- Modify: `packages/api/src/routes/cats.ts` — cat response 增加 `adapterMode` 字段
- Modify: `packages/web/src/components/HubMemberOverviewCard.tsx` — 显示 ACP badge

**Design:**
- API: `GET /api/cats` response 增加 `adapterMode?: 'acp' | 'cli'`，从 agentRegistry 或 cat-config.json `acp` section 推导
- Frontend: model 行旁边显示小 badge（`ACP` 绿色 / `CLI` 灰色），仅当 provider=google 时显示

**Steps:**
1. 修改 cat response 类型 + toCatResponse 增加 adapterMode 推导
2. 前端读取 adapterMode，显示 badge
3. 验证：`pnpm lint` + `pnpm check` + build
4. Commit

---

## Task 5: Integration Test with Mock ACP Process

End-to-end test: GeminiAcpAdapter → AcpClient → mock child → verify AgentMessage stream.

**Files:**
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js` (extend from Task 3)

**Design:**
Mock ACP process that responds to initialize → session/new → session/prompt with realistic events (notifications + response). Verify the full AgentMessage yield stream.

**Steps:**
1. Write integration test: full invoke flow with mock ACP process
2. Verify: session_init → text chunks → done with correct metadata
3. Write test: abort signal kills the ACP process
4. Commit
5. Run `pnpm gate` equivalent checks (test + lint + check + build)

---

## Commit Strategy

| Commit | Content |
|--------|---------|
| 1 | `feat(F149): AcpClient.promptStream() — streaming prompt variant` |
| 2 | `feat(F149): ACP event transformer — AcpSessionUpdate → AgentMessage` |
| 3 | `feat(F149): GeminiAcpAdapter — hosted provider for Gemini ACP` |
| 4 | `feat(F149): wire ACP adapter registration switch in startup` |

## Risk

| Risk | Mitigation |
|------|-----------|
| AcpClient.ts already 320 lines, adding promptStream pushes it further | promptStream is ~40 lines, staying under 350. If needed, extract transport layer. |
| cat-config.json `acp` section not accessible from catConfigStore | Task 4 step 1: verify access pattern before coding |
| ACP process crashes between invocations → stale client | ensureInitialized checks `client.isAlive` before reuse; spawns fresh if dead |
