# F105 Phase 1: opencode 金渐层 L1 CLI 接入

**Feature:** F105 — `docs/features/F105-opencode-golden-chinchilla.md`
**Goal:** Cat Cafe 能通过 CLI adapter 驱动 opencode agent 完成任务并获取流式回复
**Acceptance Criteria:**
- AC-4: `CatProvider` 扩展支持 `'opencode'`（Zod enum + switch case）
- AC-5: `OpenCodeAgentService` 实现 `AgentService` 接口
- AC-6: `opencode-event-transform.ts` 完成 JSON → AgentMessage 映射
- AC-7: `cat-config.json` 注册金渐层（roster + breed + variant）
- AC-8: AgentRouter 可路由消息到 opencode 并获取流式回复
**Architecture:** 复用 DARE L1 CLI Adapter 模式 — spawn `opencode run --format json`，解析 NDJSON 事件流，映射到 AgentMessage
**Tech Stack:** TypeScript, node:test, spawnCli, NDJSON parser
**前端验证:** No — 纯后端 agent service

---

## opencode JSON 事件格式（Phase 0 Spike 捕获）

```jsonc
// step_start — 步骤开始
{"type":"step_start","timestamp":1773304958492,"sessionID":"ses_xxx","part":{"type":"step-start",...}}

// text — 文本输出
{"type":"text","timestamp":1773304958494,"sessionID":"ses_xxx","part":{"type":"text","text":"content...","time":{...}}}

// tool_use — 工具调用（含 input + output）
{"type":"tool_use","timestamp":1773304980356,"sessionID":"ses_xxx","part":{"type":"tool","callID":"toolu_xxx","tool":"bash","state":{"status":"completed","input":{...},"output":"..."}}}

// step_finish — 步骤结束（含 cost/tokens）
{"type":"step_finish","timestamp":1773304958508,"sessionID":"ses_xxx","part":{"type":"step-finish","reason":"stop","cost":0.036,"tokens":{...}}}
```

## Terminal Schema

```typescript
// opencode-event-transform.ts 输出
type OpenCodeEventResult = AgentMessage | null;

// 映射表：
// step_start  → session_init (首个) / null (后续)
// text        → { type: 'text', content: part.text }
// tool_use    → { type: 'tool_use', toolName: part.tool, toolInput: part.state.input }
// step_finish → null (metadata only, cost/tokens 可选 log)
// error       → { type: 'error', error: ... }
// unknown     → null
```

---

## Task 1: opencode-event-transform.ts (纯函数，无依赖)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/opencode-event-transform.ts`
- Test: `packages/api/test/opencode-event-transform.test.js`

### Step 1: Write failing tests

```javascript
// opencode-event-transform.test.js — 8 tests
// 1. maps step_start → session_init (with sessionID)
// 2. maps text → text (with content)
// 3. maps tool_use → tool_use (with toolName, toolInput)
// 4. maps step_finish → null (skipped)
// 5. maps error → error
// 6. returns null for unknown event type
// 7. handles missing part gracefully
// 8. extracts sessionID from top-level event
```

### Step 2: Run tests → all FAIL

Run: `cd packages/api && node --test test/opencode-event-transform.test.js`
Expected: 8 FAIL

### Step 3: Implement transform function

```typescript
// Minimal pure function:
export function transformOpenCodeEvent(event: unknown, catId: CatId): AgentMessage | null
```

### Step 4: Run tests → all PASS

### Step 5: Commit

---

## Task 2: CatProvider 扩展 ('opencode')

**Files:**
- Modify: `packages/shared/src/types/cat.ts:12` — add `'opencode'` to CatProvider union
- Modify: `packages/api/src/config/cat-config-loader.ts` — add `'opencode'` to Zod enum
- Build: `pnpm --filter @cat-cafe/shared build`

### Step 1: Add `'opencode'` to CatProvider type

### Step 2: Add `'opencode'` to Zod enum in cat-config-loader.ts

### Step 3: Build shared package

Run: `pnpm --filter @cat-cafe/shared build`
Expected: success, no type errors

### Step 4: Commit

---

## Task 3: OpenCodeAgentService

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/OpenCodeAgentService.ts`
- Test: `packages/api/test/opencode-agent-service.test.js`

### Step 1: Write failing tests

```javascript
// opencode-agent-service.test.js — 5 tests (mock spawnFn)
// 1. yields session_init + text + done for simple response
// 2. yields tool_use for tool events
// 3. yields error + done on CLI error
// 4. yields error + done on CLI timeout
// 5. respects AbortSignal
```

### Step 2: Run tests → all FAIL

### Step 3: Implement OpenCodeAgentService

Key design decisions (following DARE pattern):
- `command: 'opencode'`, `args: ['run', prompt, '--format', 'json', '-m', model]`
- API key via `ANTHROPIC_API_KEY` env var to child process
- baseURL via `ANTHROPIC_BASE_URL` env var (or `OPENCODE_BASE_URL`)
- `cwd` = thread's workingDirectory (unlike DARE, opencode doesn't need its own repo path)
- Session resume via `--session sessionId`

```typescript
export class OpenCodeAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly spawnFn: SpawnFn | undefined;

  constructor(options?: OpenCodeAgentServiceOptions) { ... }
  async *invoke(prompt, options): AsyncIterable<AgentMessage> { ... }
  private buildArgs(prompt, options): string[]
  private buildEnv(callbackEnv): Record<string, string | null>
}
```

### Step 4: Run tests → all PASS

### Step 5: Commit

---

## Task 4: AgentRouter 注册 + cat-config.json

**Files:**
- Modify: `packages/api/src/index.ts` — add `case 'opencode'` to switch
- Modify: `cat-config.json` — add 金渐层 breed + variant + roster entry
- Test: `packages/api/test/opencode-agent-service.test.js` — add registration test

### Step 1: Add switch case in index.ts

```typescript
case 'opencode':
  service = new OpenCodeAgentService({ catId });
  break;
```

### Step 2: Add 金渐层 to cat-config.json

breed `golden-chinchilla` with:
- catId: `opencode`
- mentionPatterns: `["@opencode", "@金渐层", "@golden"]`
- 1 variant: `opencode-default` (provider: `opencode`, model: `claude-sonnet-4-6`)

### Step 3: Write registration test

```javascript
// Verify cat-config-loader can parse 金渐层 breed without validation errors
```

### Step 4: Run full test suite

Run: `cd packages/api && node --test test/opencode-*.test.js`
Expected: all pass

### Step 5: Commit

---

## Task 5: 集成验证 + AC 更新

### Step 1: Build all

Run: `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build`

### Step 2: Type check

Run: `pnpm lint` (tsc --noEmit)

### Step 3: Run full test suite

Run: `pnpm --filter @cat-cafe/api test`

### Step 4: Update F105 feature doc — mark Phase 1 ACs

### Step 5: Final commit
