# F118 Phase C: Liveness Warning UI + Session Recovery

**Feature:** F118 — `docs/features/F118-cli-liveness-watchdog.md`
**Goal:** 前端展示 CLI 进程活性状态（正常/静默等待/疑似卡住/超时诊断），并在后端补全 session recovery 的健康检查、审计闭环、溢出熔断
**Acceptance Criteria:**
- AC-C1: 消息气泡区域显示 CLI 进程当前状态（正常/静默等待/疑似卡住）
- AC-C2: `suspected_stall` 状态下有手动 Cancel 按钮
- AC-C3: 超时错误展示增强诊断信息（不只是"1800s 超时"）
- AC-C4: resume 前对 activeRec 做健康检查，session 不可用时 auto-seal + fresh session fallback (#98)
- AC-C5: `finally` 块补 fallback 审计写入，确保 generator `.return()` 路径也有 `CAT_ERROR` (#99)
- AC-C6: session resume 加 overflow circuit breaker，连续 N 次 restore 无有效命令时熔断 (#86)
**Architecture:** 前端通过 socket `agent_message` 接收 `__livenessWarning` 事件，映射到扩展的 `CatStatusType`，驱动 ThinkingIndicator 和 ChatMessage 中的 liveness UI（严格按 Pencil 设计稿）。后端在 `invoke-single-cat.ts` 的 session resume 路径加入健康检查、finally 审计闭环、溢出熔断。
**Tech Stack:** React, Zustand, Socket.IO, Tailwind CSS, Node.js
**前端验证:** Yes — 需 Playwright/Chrome 实测 liveness 状态显示

---

## Terminal Schema

### Frontend Types (chat-types.ts)

```typescript
// 扩展 CatStatusType
export type CatStatusType = 'pending' | 'streaming' | 'done' | 'error'
  | 'alive_but_silent' | 'suspected_stall';

// 新增：活性警告快照
export interface LivenessWarningSnapshot {
  level: 'alive_but_silent' | 'suspected_stall';
  state: 'active' | 'busy-silent' | 'idle-silent' | 'dead';
  silenceDurationMs: number;
  cpuTimeMs?: number;
  processAlive: boolean;
  receivedAt: number;
}

// 扩展 CatInvocationInfo
export interface CatInvocationInfo {
  // ... existing fields ...
  /** F118 Phase C: Latest liveness warning snapshot */
  livenessWarning?: LivenessWarningSnapshot;
}
```

### Backend Types (no new files — inline in invoke-single-cat.ts)

```typescript
// Resume health check result
interface ResumeHealthCheck {
  healthy: boolean;
  reason?: 'stale_session' | 'sealed' | 'overflow';
}
```

---

## Task 1: Extend CatStatusType + LivenessWarningSnapshot (AC-C1 foundation)

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts:345`

**Step 1: Write the failing test**

```typescript
// packages/web/src/stores/__tests__/chat-types-liveness.test.ts
import { describe, it, assert } from 'vitest';
import type { CatStatusType, CatInvocationInfo, LivenessWarningSnapshot } from '../chat-types';

describe('F118 CatStatusType extension', () => {
  it('accepts liveness status values', () => {
    const s1: CatStatusType = 'alive_but_silent';
    const s2: CatStatusType = 'suspected_stall';
    assert.ok(s1);
    assert.ok(s2);
  });

  it('LivenessWarningSnapshot holds probe data', () => {
    const snap: LivenessWarningSnapshot = {
      level: 'alive_but_silent',
      state: 'busy-silent',
      silenceDurationMs: 125000,
      cpuTimeMs: 4200,
      processAlive: true,
      receivedAt: Date.now(),
    };
    assert.equal(snap.level, 'alive_but_silent');
    assert.equal(snap.state, 'busy-silent');
  });

  it('CatInvocationInfo accepts livenessWarning field', () => {
    const info: CatInvocationInfo = {
      livenessWarning: {
        level: 'suspected_stall',
        state: 'idle-silent',
        silenceDurationMs: 300000,
        processAlive: true,
        receivedAt: Date.now(),
      },
    };
    assert.equal(info.livenessWarning?.level, 'suspected_stall');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chat-types-liveness.test.ts`
Expected: FAIL — `LivenessWarningSnapshot` not exported, `alive_but_silent` not in CatStatusType

**Step 3: Write minimal implementation**

In `packages/web/src/stores/chat-types.ts`:

1. Change line 345:
```typescript
export type CatStatusType = 'pending' | 'streaming' | 'done' | 'error' | 'alive_but_silent' | 'suspected_stall';
```

2. Add after `CatInvocationInfo` (after line 343):
```typescript
/** F118 Phase C: Liveness warning snapshot from ProcessLivenessProbe */
export interface LivenessWarningSnapshot {
  level: 'alive_but_silent' | 'suspected_stall';
  state: 'active' | 'busy-silent' | 'idle-silent' | 'dead';
  silenceDurationMs: number;
  cpuTimeMs?: number;
  processAlive: boolean;
  receivedAt: number;
}
```

3. Add `livenessWarning?: LivenessWarningSnapshot;` to `CatInvocationInfo`

**Step 4: Run test to verify it passes**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chat-types-liveness.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/stores/chat-types.ts packages/web/src/stores/__tests__/chat-types-liveness.test.ts
git commit -m "feat(F118-C): extend CatStatusType with liveness warning states [布偶猫🐾]"
```

---

## Task 2: Handle `__livenessWarning` in useAgentMessages (AC-C1)

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (add handler branch for `__livenessWarning`)
- Test: `packages/web/src/hooks/__tests__/useAgentMessages-liveness.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/web/src/hooks/__tests__/useAgentMessages-liveness.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('F118 useAgentMessages liveness warning handling', () => {
  // Test that __livenessWarning events update catStatus and catInvocation
  it('sets catStatus to alive_but_silent on soft warning', () => {
    // Setup: mock chatStore with setCatStatus, updateCatInvocation
    // Action: call onMessage with { __livenessWarning: true, level: 'alive_but_silent', ... }
    // Assert: setCatStatus called with ('catId', 'alive_but_silent')
    // Assert: updateCatInvocation called with livenessWarning snapshot
  });

  it('sets catStatus to suspected_stall on stall warning', () => {
    // Same pattern with level: 'suspected_stall'
  });

  it('clears liveness warning on next text event', () => {
    // After warning, a text event should reset catStatus to 'streaming'
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-liveness.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

In `useAgentMessages.ts`, add a handler branch in the `onMessage` callback (after the `msg.type === 'done'` branch):

```typescript
} else if ('__livenessWarning' in msg && msg.__livenessWarning) {
  // F118: Liveness warning from ProcessLivenessProbe
  const level = msg.level as 'alive_but_silent' | 'suspected_stall';
  setCatStatus(msg.catId, level);
  updateCatInvocation(msg.catId, {
    livenessWarning: {
      level,
      state: msg.state as LivenessWarningSnapshot['state'],
      silenceDurationMs: msg.silenceDurationMs as number,
      cpuTimeMs: msg.cpuTimeMs as number | undefined,
      processAlive: msg.processAlive as boolean,
      receivedAt: Date.now(),
    },
  });
```

Also: in the `msg.type === 'text'` branch, clear livenessWarning:
```typescript
updateCatInvocation(msg.catId, { livenessWarning: undefined });
```

**Step 4: Run test to verify it passes**

Run: same command
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/hooks/useAgentMessages.ts packages/web/src/hooks/__tests__/useAgentMessages-liveness.test.ts
git commit -m "feat(F118-C): handle __livenessWarning in useAgentMessages [布偶猫🐾]"
```

---

## Task 3: Liveness Warning UI in ThinkingIndicator (AC-C1)

**Files:**
- Modify: `packages/web/src/components/ThinkingIndicator.tsx`
- Test: `packages/web/src/components/__tests__/ThinkingIndicator-liveness.test.ts`

**Design reference:** `designs/F118-cli-liveness-warning-ui.pen` — Scene 2 (alive_but_silent) and Scene 3 (suspected_stall)

**Step 1: Write the failing test**

```typescript
// Test that ThinkingIndicator renders liveness states per design
describe('F118 ThinkingIndicator liveness', () => {
  it('shows "工具执行中，静默等待…" + elapsed time for alive_but_silent', () => {
    // Setup store: catStatuses = { codex: 'alive_but_silent' }
    // Assert: renders amber/warm indicator with elapsed time
  });

  it('shows warning banner + cancel button for suspected_stall', () => {
    // Setup store: catStatuses = { codex: 'suspected_stall' }
    // Assert: renders warning-colored banner with "可能卡住了" text
    // Assert: cancel button is present
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/ThinkingIndicator-liveness.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Extend `ThinkingIndicator.tsx` to handle liveness states:

```tsx
// Extend the status check at line 19
if (status === 'done') return null;

const invocation = useChatStore().catInvocations?.[catId];

if (status === 'alive_but_silent') {
  const elapsed = invocation?.livenessWarning?.silenceDurationMs;
  const elapsedText = elapsed ? `${Math.floor(elapsed / 1000)}s` : '';
  return (
    <div className="px-5 py-3 border-b border-amber-200 bg-amber-50/60">
      <div className="flex items-center gap-2">
        {/* lucide timer icon as SVG */}
        <svg className="w-4 h-4 text-amber-500 animate-pulse" ...>...</svg>
        <span className="text-sm text-amber-700">
          {name} 工具执行中，静默等待… {elapsedText}
        </span>
      </div>
    </div>
  );
}

if (status === 'suspected_stall') {
  return (
    <div className="px-5 py-3 border-b border-orange-300 bg-orange-50/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-600" ...>...</svg>
          <span className="text-sm font-medium text-orange-800">
            {name} 可能卡住了
          </span>
        </div>
        <button
          onClick={() => cancelInvocation(threadId)}
          className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700
                     hover:bg-orange-200 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
```

Colors/layout: strictly follow the Pencil design (warm amber for silent, orange for stall). Use inline SVG for lucide icons, no emoji.

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/ThinkingIndicator.tsx packages/web/src/components/__tests__/ThinkingIndicator-liveness.test.ts
git commit -m "feat(F118-C): liveness warning UI in ThinkingIndicator (AC-C1/C2) [布偶猫🐾]"
```

---

## Task 4: Enhanced Timeout Diagnostics in ChatMessage (AC-C3)

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx:191-218` (error variant section)
- Test: `packages/web/src/components/__tests__/ChatMessage-timeout-diagnostics.test.ts`

**Design reference:** `designs/F118-cli-liveness-warning-ui.pen` — Scene 4 (timeout diagnostics)

**Step 1: Write the failing test**

```typescript
describe('F118 ChatMessage timeout diagnostics', () => {
  it('renders expandable diagnostics panel for timeout errors', () => {
    // Setup: message with __cliTimeout data in extra field
    // Assert: shows "展开详情" button
    // Assert: expanded panel shows firstEventAt, lastEventAt, silenceDurationMs, processAlive
  });

  it('renders simple error for non-timeout errors', () => {
    // Regular error messages should not show diagnostics panel
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

For timeout errors (detected by `message.extra?.timeoutDiagnostics`), render an expandable diagnostics panel:

```tsx
// TimeoutDiagnosticsPanel component (inline in ChatMessage.tsx or extracted if >50 lines)
function TimeoutDiagnosticsPanel({ diag }: { diag: TimeoutDiagnostics }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        {expanded ? '收起' : '展开'} 诊断详情
      </button>
      {expanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono space-y-1">
          <div>首次事件: {diag.firstEventAt ? new Date(diag.firstEventAt).toLocaleTimeString() : '无'}</div>
          <div>末次事件: {diag.lastEventAt ? new Date(diag.lastEventAt).toLocaleTimeString() : '无'}</div>
          <div>末次类型: {diag.lastEventType ?? '无'}</div>
          <div>静默时长: {Math.round((diag.silenceDurationMs ?? 0) / 1000)}s</div>
          <div>进程存活: {diag.processAlive ? '是' : '否'}</div>
        </div>
      )}
    </div>
  );
}
```

The `__cliTimeout` event data needs to be forwarded to the message store. In `useAgentMessages.ts`, when an error message contains timeout diagnostics (detected from the `__cliTimeout` marker in the raw event), attach it to `message.extra.timeoutDiagnostics`.

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add packages/web/src/components/ChatMessage.tsx packages/web/src/components/__tests__/ChatMessage-timeout-diagnostics.test.ts packages/web/src/hooks/useAgentMessages.ts
git commit -m "feat(F118-C): enhanced timeout diagnostics panel (AC-C3) [布偶猫🐾]"
```

---

## Task 5: Resume Health Check + Auto-Seal (AC-C4)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:382-404`
- Test: `packages/api/test/invoke-single-cat-resume-health.test.js`

**Step 1: Write the failing test**

```javascript
// Test that stale active session is auto-sealed before resume
describe('F118 resume health check', () => {
  it('auto-seals session with stale cliSessionId and falls back to fresh', async () => {
    // Setup: activeRec with status='active', lastActivityAt > 30min ago
    // Action: invoke
    // Assert: SessionSealer.requestSeal called
    // Assert: sessionId = undefined (fresh session)
  });

  it('skips healthy active session', async () => {
    // Setup: activeRec with recent lastActivityAt
    // Assert: sessionId = activeRec.cliSessionId (normal resume)
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && node --test test/invoke-single-cat-resume-health.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

In `invoke-single-cat.ts`, after finding `activeRec` (line ~387-394), add a health check before using its `cliSessionId`:

```typescript
} else if (activeRec.cliSessionId) {
  // F118 AC-C4: Resume health check — auto-seal toxic sessions (#98)
  const isHealthy = await checkResumeHealth(activeRec, deps);
  if (isHealthy) {
    sessionId = activeRec.cliSessionId;
  } else {
    // Auto-seal the toxic session and fall back to fresh
    try {
      await deps.sessionSealer?.requestSeal(activeRec.id, 'auto_health_check');
    } catch { /* best-effort */ }
    sessionId = undefined;
  }
}
```

Helper function (add at file bottom or as a small inline function):

```typescript
async function checkResumeHealth(
  activeRec: SessionRecord,
  deps: { sessionChainStore?: ISessionChainStore },
): Promise<boolean> {
  // Stale session: no activity in last 30 minutes
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  if (activeRec.updatedAt && Date.now() - activeRec.updatedAt > STALE_THRESHOLD_MS) {
    return false;
  }
  return true;
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts test/invoke-single-cat-resume-health.test.js
git commit -m "feat(F118-C): resume health check with auto-seal for toxic sessions (AC-C4) [布偶猫🐾]"
```

---

## Task 6: Finally Block Audit Fallback (AC-C5)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:1211-1226` (finally block)
- Test: `packages/api/test/invoke-single-cat-finally-audit.test.js`

**Step 1: Write the failing test**

```javascript
// Test that generator .return() path writes CAT_ERROR audit
describe('F118 finally block audit fallback', () => {
  it('writes CAT_ERROR audit when generator is returned without catch', async () => {
    // Setup: start generator, call .return() without yielding 'done'
    // Assert: auditLog.append called with CAT_ERROR
  });

  it('does not double-write if catch already wrote CAT_ERROR', async () => {
    // Setup: generator throws → catch writes audit → finally runs
    // Assert: auditLog.append called exactly once
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && node --test test/invoke-single-cat-finally-audit.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

Add a `didWriteAudit` flag (set to true in the outer catch), and add fallback audit in finally:

```typescript
// At top of function, alongside hadError declaration
let didWriteAudit = false;

// In outer catch block (line ~1183), after auditLog.append:
didWriteAudit = true;

// In finally block (line ~1211), add:
} finally {
  sessionMutexRelease?.();

  // F118 AC-C5: Fallback audit for generator .return() path (#99)
  // If generator was force-returned (e.g. AbortController, client disconnect)
  // and the catch block didn't fire, write a fallback CAT_ERROR audit entry.
  if (!didWriteAudit && !hadError) {
    // Check if we actually started processing (avoid audit for pre-start returns)
    const durationMs = Date.now() - startTime;
    if (durationMs > 1000) {
      auditLog
        .append({
          type: AuditEventTypes.CAT_ERROR,
          threadId,
          data: {
            catId,
            userId,
            invocationId,
            durationMs,
            error: 'generator_returned_without_completion',
          },
        })
        .catch((auditErr) => {
          console.warn('[audit] finally fallback CAT_ERROR write failed', { threadId, invocationId, err: auditErr });
        });
    }
  }

  await finalizeTaskProgress();
  // ... rest of existing finally
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts test/invoke-single-cat-finally-audit.test.js
git commit -m "feat(F118-C): finally block fallback audit for generator .return() (AC-C5) [布偶猫🐾]"
```

---

## Task 7: Overflow Circuit Breaker (AC-C6)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:382-404`
- Test: `packages/api/test/invoke-single-cat-overflow-breaker.test.js`

**Step 1: Write the failing test**

```javascript
// Test that consecutive failed resumes trigger circuit breaker
describe('F118 overflow circuit breaker', () => {
  it('breaks circuit after N consecutive restore failures', async () => {
    // Setup: activeRec with contextHealth.consecutiveRestoreFailures >= 3
    // Assert: sessionId = undefined (fresh session, not resume)
    // Assert: auto-seal triggered
  });

  it('allows resume when consecutive failures below threshold', async () => {
    // Setup: activeRec with consecutiveRestoreFailures = 1
    // Assert: sessionId = activeRec.cliSessionId (normal resume)
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && node --test test/invoke-single-cat-overflow-breaker.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

Extend the `checkResumeHealth` function from Task 5:

```typescript
async function checkResumeHealth(
  activeRec: SessionRecord,
  deps: { sessionChainStore?: ISessionChainStore },
): Promise<boolean> {
  // AC-C4: Stale session check
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  if (activeRec.updatedAt && Date.now() - activeRec.updatedAt > STALE_THRESHOLD_MS) {
    return false;
  }

  // AC-C6: Overflow circuit breaker (#86)
  // If context health shows repeated restore failures, break the circuit
  const MAX_CONSECUTIVE_FAILURES = 3;
  if (
    activeRec.contextHealth?.consecutiveRestoreFailures &&
    activeRec.contextHealth.consecutiveRestoreFailures >= MAX_CONSECUTIVE_FAILURES
  ) {
    return false;
  }

  return true;
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts test/invoke-single-cat-overflow-breaker.test.js
git commit -m "feat(F118-C): overflow circuit breaker for session resume (AC-C6) [布偶猫🐾]"
```

---

## Task 8: Forward `__cliTimeout` Diagnostics to Frontend

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (handle `__cliTimeout` event, attach diagnostics to error message)
- Modify: `packages/web/src/stores/chat-types.ts` (add `TimeoutDiagnostics` type)
- Test: `packages/web/src/hooks/__tests__/useAgentMessages-timeout-diag.test.ts`

**Step 1: Write the failing test**

```typescript
describe('F118 __cliTimeout diagnostics forwarding', () => {
  it('attaches timeout diagnostics to error message extra', () => {
    // Action: onMessage with { type: 'error', __cliTimeout: true, firstEventAt, ... }
    // Assert: message.extra.timeoutDiagnostics populated
  });
});
```

**Step 2-5:** Standard TDD cycle + commit

```bash
git commit -m "feat(F118-C): forward __cliTimeout diagnostics to frontend error messages [布偶猫🐾]"
```

---

## Task 9: Integration Test + Biome + Type Check

**Files:**
- Run: `pnpm check` (Biome)
- Run: `pnpm lint` (tsc --noEmit)
- Run: `pnpm --filter @cat-cafe/web exec vitest run` (full web test suite)
- Run: `pnpm --filter @cat-cafe/api test:redis` (API tests)

**Step 1: Run Biome**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm check`
Expected: PASS (no lint errors)

**Step 2: Run type check**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm lint`
Expected: PASS

**Step 3: Run full test suites**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/web exec vitest run`
Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f118-phase-c && pnpm --filter @cat-cafe/api test:redis`
Expected: All PASS

**Step 4: Fix any regressions**

**Step 5: Final commit if fixes needed**

---

## Post-Implementation

1. **Quality Gate** — load `quality-gate` skill, run spec compliance check
2. **Request Review** — load `request-review` skill, send to 砚砚(codex) for cross-family review
3. **Process Review** — load `receive-review` skill to handle feedback
4. **Merge Gate** — load `merge-gate` skill for PR → cloud review → merge
5. **Feature Closure** — Phase doc sync, BACKLOG update, vision guardian
