---
feature_ids: [F149]
related_features: [F143, F053, F118]
topics: [acp, runtime, baseline, concurrency, provider-profile]
doc_kind: plan
created: 2026-04-02
---

# F149 Phase A: Boundary Convergence + Quantitative Baseline

**Feature:** F149 --- `docs/features/F149-acp-runtime-operations.md`
**Goal:** Verify ACP concurrency model (OQ-6), establish quantitative baselines, define provider profile --- all inputs needed before Phase B builds the Gemini ACP hosted provider
**Acceptance Criteria:**
- AC-A1: Feature doc boundary with F143/F053/F115/F118/F050 --- already in spec
- AC-A2: Baseline script produces `cold_init_ms / attach_ms / warm_first_chunk_ms / sessions_per_process`
- AC-A3: OQ-6 answered: single-flight or multiplex
- AC-A4: Cloud consultations done (GPT Pro + DeepThink)
- AC-A5: ACP provider profile whitelist + repo-cwd startup path reproducible
**Architecture:** Write a minimal `AcpClient` (NDJSON-over-stdio transport) that both experiment scripts and Phase B's adapter will use. Provider profile type extends existing `cat-config.json` schema.
**Tech Stack:** Node.js child_process, NDJSON, existing `ndjson-parser.ts`
**Not building:** Process pool (Phase C), GeminiAcpAdapter (Phase B), production routing

---

## Straight-Line Check

**B (finish line):** Phase A is done when we have:
1. A working `AcpClient` that can talk to `gemini --acp` (persists into Phase B)
2. Quantitative numbers for cold init / attach / warm prompt
3. OQ-6 answered with evidence
4. Provider profile type defined (persists into Phase B)

**Terminal schema:** `AcpProviderProfile` type + `AcpClient` class + `AcpBenchmarkResult` --- Phase B extends these, no rewrite.

**Explicit spikes:** Task 1 is a protocol spike --- `gemini --acp` exact NDJSON format must be observed before writing client code.

---

## Task 1: ACP Protocol Spike (time-boxed: 15 min)

> **Spike output:** Exact NDJSON request/response schema for `initialize`, `newSession`, `prompt`. If `gemini --acp` behaves differently than expected, adjust all subsequent tasks.

**Files:** None (interactive experiment, results documented in commit message)

**Step 1: Spawn gemini --acp and observe handshake**

```bash
# In a terminal, start ACP server:
echo '{"method":"initialize","id":"1","params":{}}' | gemini --acp 2>/tmp/gemini-acp-stderr.log
```

Record: does `gemini --acp` wait for stdin input? Does it emit anything before `initialize`? What does the response look like?

**Step 2: Document observed NDJSON schema**

Record exact field names, id correlation pattern, and streaming chunk format into a structured note that Task 2 will consume.

**Step 3: Test newSession and prompt if initialize succeeds**

Use a helper script (Node.js, ~30 lines) that:
1. Spawns `gemini --acp` with `{ stdio: ['pipe', 'pipe', 'pipe'] }`
2. Sends `initialize` request, reads response
3. Sends `newSession` request, reads response
4. Sends `prompt` with a trivial question, reads streaming chunks
5. Prints timing for each step

**Decision gate:** If `gemini --acp` is not available on this machine or the protocol is fundamentally different from NDJSON-RPC, STOP and escalate to user.

---

## Task 2: ACP Type Definitions

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/acp/types.ts`

**Step 1: Write ACP message types (based on spike findings)**

```typescript
/** ACP NDJSON-RPC request envelope */
export interface AcpRequest {
  method: string;
  id: string;
  params?: Record<string, unknown>;
}

/** ACP NDJSON-RPC response envelope */
export interface AcpResponse {
  id: string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

/** ACP streaming event (prompt responses) */
export interface AcpStreamEvent {
  /** Event type from ACP protocol (e.g. 'message', 'tool_use', 'result') */
  type: string;
  sessionId: string;
  [key: string]: unknown;
}

/** Timing result from a single ACP operation */
export interface AcpTimingResult {
  coldInitMs: number;
  newSessionMs: number;
  warmFirstChunkMs: number;
  totalPromptMs: number;
}

/** Provider profile for ACP-mode agent */
export interface AcpProviderProfile {
  /** CLI command to start ACP server */
  command: string;
  /** Args to pass (e.g. ['--acp']) */
  startupArgs: string[];
  /** MCP servers to whitelist via --allowed-mcp-server-names */
  mcpWhitelist: string[];
  /** Working directory (repo root) */
  cwd: string;
  /** Model to use */
  model: string;
  /** Whether this carrier supports cross-session multiplex (default false, set by OQ-6) */
  supportsMultiplexing: boolean;
}
```

**Step 2: Commit types**

```bash
git add packages/api/src/domains/cats/services/agents/providers/acp/types.ts
git commit -m "feat(F149): ACP type definitions — protocol envelope + provider profile [...]"
```

---

## Task 3: Minimal AcpClient (NDJSON-over-stdio)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.ts`
- Test: `packages/api/test/acp/acp-client.test.ts`

**Step 1: Write failing test for AcpClient lifecycle**

```typescript
// packages/api/test/acp/acp-client.test.ts
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AcpClient } from '../../src/domains/cats/services/agents/providers/acp/AcpClient.js';

describe('AcpClient', () => {
  it('initialize sends correct NDJSON and parses response', async () => {
    // Mock child_process that responds to initialize
    const client = new AcpClient({
      command: 'echo', // mock
      args: [],
      cwd: '/tmp',
      spawnFn: mockSpawnFn,
    });
    const result = await client.initialize();
    assert.ok(result.protocolVersion);
    await client.close();
  });

  it('newSession returns sessionId', async () => {
    const client = createMockClient();
    await client.initialize();
    const session = await client.newSession();
    assert.ok(session.sessionId);
    await client.close();
  });

  it('prompt streams events', async () => {
    const client = createMockClient();
    await client.initialize();
    const session = await client.newSession();
    const events = [];
    for await (const event of client.prompt(session.sessionId, 'hello')) {
      events.push(event);
    }
    assert.ok(events.length > 0);
    await client.close();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/acp/acp-client.test.ts
```
Expected: FAIL (module not found)

**Step 3: Write AcpClient implementation**

Core design:
- Constructor takes `{ command, args, cwd, spawnFn? }`
- `initialize()`: spawns process, sends `initialize` request, waits for response
- `newSession()`: sends `newSession` request, returns `{ sessionId }`
- `prompt(sessionId, message)`: sends `prompt` request, yields `AcpStreamEvent` until turn complete
- `close()`: SIGTERM + grace period cleanup (reuse KILL_GRACE_MS pattern from cli-spawn.ts)
- Internal: readline on stdout for NDJSON parsing, correlate responses by `id`

```typescript
export class AcpClient {
  private child: ChildProcess | null = null;
  private pending = new Map<string, { resolve, reject }>();
  private streamListeners = new Map<string, (event) => void>();

  constructor(private readonly config: AcpClientConfig) {}

  async initialize(): Promise<AcpInitResult> {
    this.child = this.spawn();
    this.startReading();
    return this.sendRequest('initialize', {});
  }

  async newSession(): Promise<{ sessionId: string }> {
    return this.sendRequest('newSession', {});
  }

  async *prompt(sessionId: string, message: string): AsyncGenerator<AcpStreamEvent> {
    // ... yield streaming events until turn-complete signal
  }

  async close(): Promise<void> {
    // SIGTERM → wait KILL_GRACE_MS → SIGKILL if needed
  }

  private sendRequest(method: string, params: unknown): Promise<any> {
    const id = randomUUID();
    const line = JSON.stringify({ method, id, params }) + '\n';
    this.child!.stdin!.write(line);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  private startReading(): void {
    // readline on this.child.stdout, parse NDJSON, route to pending/stream
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/api && node --test test/acp/acp-client.test.ts
```

**Step 5: Commit**

```bash
git commit -m "feat(F149): AcpClient — NDJSON-over-stdio transport [...]"
```

---

## Task 4: ACP Baseline Measurement

> Produces AC-A2 numbers. Uses real `gemini --acp` (requires local Gemini CLI + OAuth).

**Files:**
- Create: `scripts/experiments/f149-acp-baseline.ts`

**Step 1: Write baseline script**

```typescript
// scripts/experiments/f149-acp-baseline.ts
import { AcpClient } from '../../packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.js';

const RUNS = 3;
const results: AcpTimingResult[] = [];

for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const client = new AcpClient({
    command: 'gemini',
    args: ['--acp'],
    cwd: process.cwd(),
  });

  const initResult = await client.initialize();
  const t1 = performance.now();

  const session = await client.newSession();
  const t2 = performance.now();

  let firstChunkAt: number | undefined;
  for await (const event of client.prompt(session.sessionId, 'Reply with exactly: PONG')) {
    if (!firstChunkAt && event.type === 'message') firstChunkAt = performance.now();
  }
  const t3 = performance.now();

  results.push({
    coldInitMs: t1 - t0,
    newSessionMs: t2 - t1,
    warmFirstChunkMs: (firstChunkAt ?? t3) - t2,
    totalPromptMs: t3 - t2,
  });

  await client.close();
}

// Output structured results
console.log(JSON.stringify({ runs: results, summary: computeSummary(results) }, null, 2));
```

**Step 2: Run script, capture results**

```bash
npx tsx scripts/experiments/f149-acp-baseline.ts | tee docs/research/f149-phase-a-baseline-results.json
```

**Step 3: Commit results**

```bash
git commit -m "docs(F149): Phase A baseline measurements [...]"
```

---

## Task 5: OQ-6 Concurrency Experiment

> Produces AC-A3. THE critical experiment: does a single ACP process support concurrent prompts across two sessions?

**Files:**
- Create: `scripts/experiments/f149-oq6-concurrency.ts`

**Step 1: Write concurrency experiment**

```typescript
// scripts/experiments/f149-oq6-concurrency.ts
import { AcpClient } from '../../packages/api/src/domains/cats/services/agents/providers/acp/AcpClient.js';

const client = new AcpClient({
  command: 'gemini',
  args: ['--acp'],
  cwd: process.cwd(),
});

await client.initialize();
const sessionA = await client.newSession();
const sessionB = await client.newSession();

// Concurrent prompts to different sessions on same process
const promptA = collectAll(client.prompt(sessionA.sessionId, 'Reply exactly: ALPHA'));
const promptB = collectAll(client.prompt(sessionB.sessionId, 'Reply exactly: BRAVO'));

const [resultA, resultB] = await Promise.allSettled([promptA, promptB]);

// Analysis:
// 1. Did both complete? (fulfilled vs rejected)
// 2. Were responses correct? (ALPHA in A, BRAVO in B — no cross-contamination)
// 3. Did they overlap in time? (concurrent) or sequence? (single-flight queue)
// 4. Any errors? (protocol rejection, merged responses — session-poison)

console.log(JSON.stringify({
  sessionA: { status: resultA.status, /* events, timing */ },
  sessionB: { status: resultB.status, /* events, timing */ },
  verdict: determineVerdict(resultA, resultB),
}, null, 2));

await client.close();
```

**Step 2: Run experiment, capture evidence**

```bash
npx tsx scripts/experiments/f149-oq6-concurrency.ts | tee docs/research/f149-oq6-results.json
```

**Step 3: Interpret results and update spec**

| Outcome | Verdict | Pool sizing implication |
|---------|---------|------------------------|
| Both complete correctly + overlapping timing | `multiplex` | 1 process can serve N sessions concurrently |
| Both complete but sequential (B starts after A ends) | `single-flight` | Need queue or 1 process per concurrent prompt |
| B rejected / error while A runs | `single-flight-strict` | Process rejects concurrent requests |
| Responses mixed (ALPHA in B's stream) | `session-poison` | Cross-session is unsafe, keep single-flight |

**Step 4: Write OQ-6 conclusion to F149 spec**

Update `docs/features/F149-acp-runtime-operations.md`:
- OQ-6 status: `✅ Verified: {verdict}`
- OQ-4 updated based on OQ-6 result
- If multiplex: `supports_multiplexing` default can be `true` for Gemini
- If single-flight: Phase C pool sizing confirmed at 1 concurrent prompt per process

**Step 5: Commit everything**

```bash
git commit -m "feat(F149): OQ-6 concurrency experiment — {verdict} [...]"
```

---

## Task 6: Provider Profile + cat-config Integration

> Produces AC-A5.

**Files:**
- Modify: `cat-config.json` (add `acp` section to gemini provider entries)

**Step 1: Add ACP config to gemini entries**

```json
{
  "id": "gemini-default",
  "provider": "google",
  "defaultModel": "gemini-3.1-pro-preview",
  "cli": { "command": "gemini", "outputFormat": "stream-json", "defaultArgs": [] },
  "acp": {
    "command": "gemini",
    "startupArgs": ["--acp"],
    "mcpWhitelist": ["cat-cafe", "cat-cafe-memory", "cat-cafe-collab", "cat-cafe-signals", "pencil"],
    "supportsMultiplexing": false
  }
}
```

`supportsMultiplexing` starts `false`, updated after OQ-6.

**Step 2: Commit**

```bash
git commit -m "feat(F149): ACP provider profile in cat-config [...]"
```

---

## Task 7: Boundary Documentation (AC-A1 cleanup)

**Files:**
- Modify: `docs/features/F149-acp-runtime-operations.md`

**Step 1: Add explicit boundary table**

If not already clear, add to the Dependencies section:

```markdown
## Boundary Clarification

| Feature | F149's relationship | What F149 does NOT do |
|---------|--------------------|-----------------------|
| F143 | Feeds into (concrete first, abstract later) | Does not define protocol-agnostic kernel |
| F053 | Parallel (session/resume semantic overlap) | Does not replace --resume; adds process reuse |
| F115 | Borrows methodology | Does not re-optimize overall startup chain |
| F118 | Reuses liveness/recovery patterns | Does not extend CLI watchdog itself |
| F050 | Eventual consumer | Does not define external agent onboarding contract |
```

**Step 2: Mark AC-A1 done, commit**

---

## Summary: AC Coverage

| AC | Task | Status |
|----|------|--------|
| AC-A1 | Task 7 (boundary doc) | Mostly done in spec, formalize |
| AC-A2 | Task 4 (baseline measurement) | Script + results |
| AC-A3 | Task 5 (OQ-6 experiment) | Experiment + verdict |
| AC-A4 | --- | Already done |
| AC-A5 | Task 6 (provider profile) | cat-config + type |
