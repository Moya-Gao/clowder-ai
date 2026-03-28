---
feature_ids: [F027, F055, F086, F122]
topics: [a2a, routing, queue, research]
doc_kind: research
created: 2026-03-18
---

# A2A Architecture, Dispatch Queue & Agent Spawn Patterns — Codebase Evidence Synthesis

**Search Date**: 2026-03-18 | **Scope**: F027, F122, F055, F086 + ADR/Reflections/Lessons

---

## I. F027 — A2A Path Unification

### Key Files & Quotes

**1. Feature Specification**
- **File**: `docs/features/F027-a2a-path-unification.md`
- **Status**: Complete (100% per F094 audit)
- **Core Concept**: "两条路合一 + 全链可取消 + 多 mention"
  - Unifies callback A2A (`post_message` + `targetCats`) with text-based `@mention` routing
  - Introduces cancellation across entire chain
  - Enables multi-mention (multiple targets in one invocation)

**2. Callback Routes Implementation**
- **File**: `packages/api/src/routes/callbacks.ts:546`
- **Quote**: `// F27: Enqueue @mentioned cats into parent worklist (unified A2A path)`
- **Evidence**: Callback schema accepts `targetCats` field and routes them into unified dispatch

**3. Worklist Registry Abstraction**
- **File**: `packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts:120`
- **Quote**: `* Push cats to an invocation's worklist (callback A2A path).`
- **Evidence**: Centralized `pushToWorklist()` method for all A2A entry points (callbacks + text parsing)

### How F027 Differentiates from Standard Orchestration

| Standard Orchestrator | F027 A2A Path |
|---|---|
| Task explicitly added by human/system | Tasks discovered from AI's own output (`@mention` or `targetCats` MCP field) |
| Single dispatch gate | Dual paths (callback + text parsing) unified via `WorklistRegistry` |
| No chain cancellation | Full chain cancellation via shared `signal` |
| Explicit routing table | Content-aware routing (AI declares next target) |

---

## II. F122 — Unified Dispatch Queue

### Architecture Decision

**File**: `docs/decisions/018-f122-oq-unified-dispatch-decisions.md`

**Decision** (2026-03-15):
- **OQ-1**: A2A callback tasks enter `InvocationQueue` with `auto-execute: true` flag
  - Effect: Tasks visible in QueuePanel, user can `steer` to redirect
  - Key quote: "A2A 任务在 QueuePanel 可见（用户知道猫猫在干嘛）"
  
- **OQ-2**: multi_mention tasks also enter queue with same auto-execute semantics
  - Rationale: "multi_mention 本质是'一次 @ 多只猫'，产生的每个子调用和 A2A handoff 语义相同。统一入 queue 消除独立分发平面。"
  
- **OQ-4**: Maintain slot-level busy detection (not thread-level)
  - Effect: Cat A busy → messages for Cat B execute anyway (parallelism preserved)

### Implementation Evidence

**Phase A** (Reliability fixes):
- **File**: `packages/api/src/routes/callback-a2a-trigger.ts:78`
- **Quote**: `// F122B: If InvocationQueue is available, enqueue as agent entry (unified dispatch).`
- **Change**: A2A callback now creates queue entry with `source: 'agent'` + `autoExecute: true`

**Phase B** (Full integration):
- **File**: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts:276`
- **Quote**: `* F122B: Try to auto-execute any queued autoExecute entries whose target cat slot is free.`
- **Feature**: Auto-execution loop scans for available cat slots across all agent-sourced entries

### Key Difference from Harness/Orchestrator Patterns

```
Standard Harness Pattern:
┌─────────────────────────────────┐
│  User/System Dispatch           │
│  (explicit task creation)       │
└──────────┬──────────────────────┘
           │
           ▼
    ┌─────────────┐
    │  Main Queue │ ◄─── Only user/system tasks here
    └──────┬──────┘
           │
           ▼
      Execute Agent
           │
           └───► (Agent work complete, explicit return)

F122 Unified Dispatch:
┌──────────────────┐  ┌─────────────────┐
│ User Message     │  │ Callback        │
│ (post_message)   │  │ (targetCats)    │
└────────┬─────────┘  └────────┬────────┘
         │                     │
         ▼                     ▼
    ┌─────────────────────────────────┐
    │  InvocationQueue                │
    │  - User entries (normal)        │
    │  - Agent entries (auto-execute) │  ◄─── UNIFIED
    │  - Connector entries            │
    └──────────┬──────────────────────┘
               │
               ▼
         QueueProcessor
         (steer can manage all types)
              │
              ▼
         Execute Agent
              │
    ┌────────┴───────────┐
    │                    │
   YES                   NO
(found mention)     (no A2A)
    │                    │
    ▼                    ▼
Enqueue new entry   isFinal: true
  (auto-exec)           │
    │                   ▼
    └──────────────► Queue scans
                    for free slots
                        │
                        ▼
                    (Agent-sourced
                     entries auto-fire)
```

**Key Differentiator**: Dispatch queue is content-aware + destination-driven (AI declares next target) not admin-driven.

---

## III. F055 — A2A MCP Structured Routing (targetCats)

### Specification

**File**: `docs/features/F055-a2a-mcp-structured-routing.md`

**Core Innovation**: Structured `targetCats` field in callback response

```json
{
  "type": "post_message",
  "content": "I found the issue. Can you review the fix?",
  "targetCats": ["codex"]  // ◄─── MCP declares next target
}
```

**Two-Phase Routing**:
1. **Phase 1** (Current): `targetCats` field checked first (reliable)
2. **Phase 2** (Fallback): Text `@mention` parsing if `targetCats` empty

### Evidence in Codebase

**Field Definition**:
- **File**: `packages/api/src/routes/callbacks.ts:106`
- **Quote**: `targetCats: z.array(z.string().min(1)).optional(),`

**Routing Logic**:
- **File**: `packages/api/src/routes/callback-a2a-trigger.ts:74,111`
- **Quote**: 
  ```typescript
  const { targetCats, threadId, callerCatId } = opts;
  // ...
  targetCats: [catId],  // Enqueue with explicit target
  ```

**Backend Storage**:
- **File**: `packages/api/src/domains/cats/services/types.ts:133`
- **Quote**: `extra?: { crossPost?: {...}; targetCats?: string[] };`

### Multi-Mention Plan Board Integration

**File**: `docs/features/F055-plan-board.md`

**Problem Solved**: Before F055, "current invocation" board mixed routing intent (`targetCats`) with execution progress (`task_progress`), causing display corruption in multi-cat scenarios.

**Solution**: Separate `PlanBoardPanel` tracks `catInvocations[]` (per-cat progress) independently from `targetCats` (routing signal).

### Differentiation from Standard MCP

| Standard MCP Routing | F055 targetCats |
|---|---|
| Routing implicit in content parsing | Routing explicit in schema |
| Fallible (text parsing ambiguity) | Reliable (structured field) |
| Single-target (@ one cat) | Multi-target (array) |
| No routing visibility | Visible + auditable in message metadata |

---

## IV. F086 — Cat Orchestration & Multi-Mention

### Multi-Mention State Machine

**File**: `packages/api/src/domains/cats/services/agents/routing/MultiMentionOrchestrator.ts`

**Architecture**:
- Tool: `cat_cafe_multi_mention(targets: CatId[], question, callbackTo)`
- Lifecycle: `idle → pending → collecting_responses → aggregating → closed`
- Invocation model: Fire-and-forget parallel dispatch with aggregation via `InvocationQueue` completion hooks

**Quote** from F086 spec (`docs/features/F086-cat-orchestration-multi-mention.md:62`):
```
// cat_cafe_multi_mention
Multi-Mention({ targets: ['codex', 'gemini'], question: 'Is this safe?' })
→ Parallel dispatch to both cats
→ Responses aggregate
→ Result routes back via targetCats: [callbackTo]
```

### Prevention of "New Tool, Cats Don't Know"

**File**: `cat-cafe-skills/refs/shared-rules.md:239-265`

**§13 Meta-thinking Triggers**:
```
调用 `cat_cafe_multi_mention` 前，必须先搜后问
（MCP 层硬检查：缺少 `searchEvidenceRefs` 且无 `overrideReason` → 拒绝调用）
```

**Enforcement Point**:
- **File**: `packages/mcp-server/src/tools/callback-tools.ts:604`
- **Quote**: `'multi_mention requires searchEvidenceRefs (what did you search first?)'`

### F086 Reflection Insight

**File**: `docs/reflections/2026-03-09-f086-overall-completion-capsule.md:23`

**Critical Finding**: 
> "新 MCP 工具没有注入 prompt — 造了工具猫不知道"
> 
> "M1 写了 `cat_cafe_multi_mention` 编排器，M2 写了触发器规则，但**完全忘了在 `MCP_TOOLS_SECTION` 里告诉猫猫有这个工具**。根因：把'工具技术上可用'等同于'猫认知上可用'，违反 P5（可验证才算完成）"

**Fix Applied**:
- **File**: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:226`
- **Change**: Inject `cat_cafe_multi_mention` tool definition + `L0 Governance Digest` (shared-rules §13 compact version)

### Orchestration vs Swarm

**File**: `docs/features/F086-cat-orchestration-multi-mention.md:308`

**Design Decision**:
> F086 ≠ F037：F086 是确定性编排+回流，F037 是自主 swarm 探索，并列不吞并

- **F086 (this)**: Structured, parent-initiated coordination → responses route back
- **F037 (future)**: Self-initiated exploration, emergent behavior

---

## V. ADR Evidence — Architecture Decisions

### ADR-001: Agent Invocation Approach

**File**: `docs/decisions/001-agent-invocation-approach.md`

**Evolution**: SDK → CLI (sub-process)

**Key Quote**:
> "CLI 模式可使用 Max/Plus/Pro 订阅，无需 API key 付费"

**Diff from Orchestrator Pattern**: 
- No fixed executor — each cat is independently spawned CLI process
- Cats retain full CLI agent capabilities (file ops, command exec, MCP tools)
- This enables `cat_cafe_multi_mention` to be MCP-based, not system-based

### ADR-002: Why-First Collaboration Protocol

**File**: `docs/decisions/002-collaboration-protocol.md`

**Five-Part Handoff Structure**:
1. `What` — specific changes
2. `Why` — constraints & goals
3. `Tradeoff` — abandoned alternatives  
4. `Open Questions` — uncertainties
5. `Next Action` — receiver's next step

**Impact on F027/F122**: All A2A invocations document their "Why" in commit messages and decision docs, making dispatch decisions auditable.

### ADR-018: F122 OQ — Unified Dispatch Decisions

**File**: `docs/decisions/018-f122-oq-unified-dispatch-decisions.md:29-56`

**Three Product Decisions Locked**:
1. A2A tasks → `InvocationQueue` with auto-execute ✅
2. multi_mention tasks → same queue ✅
3. Keep slot-level busy tracking (not thread-level) ✅

**Critical Rationale**:
> "A2A 任务在 QueuePanel 可见（用户知道猫猫在干嘛）… 用户可以 steer 插队纠正方向（猫猫聊歪了能拉回来）"

---

## VI. Implementation Patterns — Spawn vs A2A vs Orchestrator

### Pattern 1: Worklist + Dynamic Growth (F027)

**File**: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts:86`

```typescript
const worklist = [...targetCats];  // Start with explicit targets

for (let i = 0; i < worklist.length; i++) {
  // worklist.length grows as new A2A mentions are detected
  // This allows unbounded chain (with MAX_A2A_DEPTH limit)
  
  const catId = worklist[i];
  let handoffEmitted = targetCats.length;  // Track original vs A2A
  
  for await (const msg of invokeSingleCat(...)) {
    // Cat execution
  }
  
  // After execution, parse for new mentions
  const newTargets = parseA2AMentions(textContent, catId);
  if (newTargets.length > 0) {
    worklist.push(newTargets[0]);  // Dynamic append
  }
}
```

**Diff**: Not "orchestrator spawns tasks", but "execute cat, listen for @mention, append to queue".

### Pattern 2: Callback Trigger (F027 + F122)

**File**: `packages/api/src/routes/callback-a2a-trigger.ts:78-163`

```typescript
if (invocationQueue) {
  // F122B: Enqueue as agent-sourced entry
  const enqueued = [];
  for (const catId of targetCats) {
    queue.enqueue({
      source: 'agent',           // Mark origin
      autoExecute: true,         // Auto-fire when cat slot free
      callerCatId: firstTarget,  // Who sent this
      targetCats: [catId],       // Who to execute
      intent: 'execute',
      parentInvocationId         // Chain linkage
    });
    enqueued.push(catId);
  }
  return { enqueued, fallback: false };
} else {
  // Legacy: direct dispatch (F027 + F122 Phase A path)
  pushToWorklist(threadId, targetCats, ...);
}
```

**Diff**: Callback dispatch creates queue entries, not immediate execution. Queue processor auto-fires when conditions met (slot free).

### Pattern 3: Multi-Mention Orchestration (F086)

**File**: `packages/api/src/routes/callback-multi-mention-routes.ts:63-153`

```typescript
// Multi-mention is a **state machine**, not a task queue

async function handleMultiMention(deps, opts) {
  // 1. Create state machine
  const orchestrator = new MultiMentionOrchestrator(...);
  
  // 2. Parallel dispatch (not serial worklist)
  const responses = [];
  for (const targetCatId of opts.targets) {
    queue.enqueue({
      source: 'agent',
      autoExecute: true,
      callerCatId: opts.initiatorCatId,
      targetCats: [targetCatId],
      completionHook: (msg) => {
        // F122B B6: Completion hook aggregates responses
        orchestrator.collectResponse(targetCatId, msg);
        if (orchestrator.allCollected()) {
          orchestrator.flush();  // Send aggregated result
        }
      }
    });
  }
}
```

**Diff**: Multi-mention is **parallel** + **aggregating**, not serial chain. Uses queue's completion hook callback (F122B B6).

---

## VII. "Spawn" vs Standard Orchestrator Patterns

### What We DON'T Have (Standard Harness)

```
❌ Fixed executor pool
❌ Central task scheduler
❌ Pre-defined task DAG
❌ Explicit role assignment (worker/coordinator)
❌ Task submission API
```

### What We DO Have (F027 + F122 + F055 + F086)

```
✅ Content-driven routing (AI declares next target)
✅ Unified dispatch queue (all sources visible)
✅ Parallel execution with slot-level concurrency
✅ Dynamic chain growth (worklist pattern)
✅ Structure-first routing (targetCats MCP field)
✅ Fire-and-forget + auto-execute (agent entries)
✅ Completion hooks for aggregation (multi-mention)
✅ Full audit trail (route decisions traceable)
```

### Why "Spawn" is Misleading

**Standard Spawn Pattern**:
```
Parent process
  └─ spawn child1 (waits for completion)
       └─ spawn child2 (waits for completion)
            └─ result bubbles up
```

**Our Pattern (F027)**:
```
User message → invoke Cat A
  ↓
Cat A execution
  ├─ produces output
  ├─ MCP post_message with targetCats: ["Cat B"]
  ↓ (callback routes to InvocationQueue)
  └─ Queue enqueues (source: 'agent', auto-execute)
       ↓
       (Cat B slot free? → auto-exec)
       ├─ Cat B execution happens in parallel
       └─ If Cat B @mentions Cat C
            → Queues Cat C
            → Parallel exec when C slot free

Result: Not parent-child spawn chain,
        but content-driven invitation queue
```

---

## VIII. Lessons & Reflections

### F122 Reflection: Hook Lifecycle Traps

**File**: `docs/reflections/2026-03-18-f122-unified-dispatch-queue-capsule.md:16`

> "B6 的首版测试覆盖了主路径，但对 `duplicate` 分支状态一致性覆盖不足，导致 finally hook 与返回状态脱节问题晚发现一轮。"

**Rule Update**: New hooks + finally blocks need early-return branch consistency tests.

### F086 Reflection: Perception Layer Missing

**File**: `docs/reflections/2026-03-09-f086-overall-completion-capsule.md:24`

> "造了工具猫不知道"
>
> "把'工具技术上可用'等同于'猫认知上可用'，违反 P5（可验证才算完成）"

**Fix**: Inject `MCP_TOOLS_SECTION` + `L0 Governance Digest` in system prompt.

### A2A Routing Lessons

**File**: `docs/lessons/04-a2a-routing.md:55-90`

**Core Design**: 
- Line-start @mention matching (not anywhere in text)
  - Why: Prevent accidental trigger on code comments / documentation references
  - Only active "shout" from cat triggers routing
- Dynamic worklist with depth limit (default 15)
- Shared AbortController for full chain cancellation

---

## IX. No "Harness" or "Long-Running" Patterns Found

### Search Results
- **File**: `packages/api/test/vote-routes.test.js:10`
- Quote: `* Minimal Fastify test harness (same pattern as modes routes tests).`
- **Finding**: "Harness" refers to test fixture, not orchestration pattern

- **File**: `docs/archive/2026-02/research/Multi-Agent "Cat Café" Research Report by gpt.md:55`
- Reference to "agent orchestrators" (OpenClaw) in research notes
- **Finding**: Explicitly NOT our chosen pattern

### Long-Running Patterns
- No explicit "long-running process" orchestration
- Each cat spawn is independent CLI process (F027/ADR-001)
- InvocationQueue manages task lifecycle, not process lifecycle
- MCP callbacks enable "pull" from within cat execution (async communication)

---

## X. Summary Table: How We Differ

| Aspect | Standard Orchestrator/Harness | Cat Café A2A |
|--------|-----------|-----------|
| **Invocation Source** | Central system declares tasks | Content-aware (AI declares next target) |
| **Dispatch Gate** | Single queue, centrally managed | Unified queue, but entries auto-tagged by source |
| **Routing** | Task ID → task type → dispatch | `targetCats` MCP field or text @mention |
| **Concurrency** | Thread-level busy tracking | Slot-level (per-cat per-thread) |
| **Chain Growth** | Fixed DAG | Dynamic worklist with depth limit |
| **Multi-Agent Sync** | Explicit coordination layer | MCP callbacks (async coordination) |
| **Auto-Execution** | Explicit execute call | auto-execute flag on queue entries |
| **Visibility** | Opaque internal dispatch | Full QueuePanel visibility + steer control |
| **Audit Trail** | Task submit → task complete | Content routed → decision → execution → result |

---

## XI. File Index

**Core Architecture**:
- `docs/features/F027-a2a-path-unification.md` — Unified routing design
- `docs/features/F122-unified-dispatch-queue.md` — Queue integration
- `docs/features/F055-a2a-mcp-structured-routing.md` — targetCats schema
- `docs/features/F086-cat-orchestration-multi-mention.md` — Multi-mention state machine

**Decisions**:
- `docs/decisions/018-f122-oq-unified-dispatch-decisions.md` — OQ-1/2/4 decisions
- `docs/decisions/001-agent-invocation-approach.md` — CLI spawn rationale
- `docs/decisions/002-collaboration-protocol.md` — Why-First handoff format

**Reflections**:
- `docs/reflections/2026-03-18-f122-unified-dispatch-queue-capsule.md` — F122 closure
- `docs/reflections/2026-03-09-f086-overall-completion-capsule.md` — F086 closure

**Implementation**:
- `packages/api/src/routes/callback-a2a-trigger.ts` — A2A dispatch logic
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` — Worklist execution
- `packages/api/src/domains/cats/services/agents/routing/MultiMentionOrchestrator.ts` — Multi-mention
- `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts` — Queue data structure
- `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` — Queue execution

**Lessons**:
- `docs/lessons/04-a2a-routing.md` — A2A design principles
- `docs/lessons/05-mcp-callback.md` — Callback communication

---

**End of Report**
