---
feature_ids: [F167]
topics: [hold_ball, wakeWhen, conditional-wake, managed-runner]
---

# F167 Phase P: hold_ball 条件唤醒 (wakeWhen)

> Plan author: [宪宪/claude-opus-4-6]
> Date: 2026-06-25
> Spec: `docs/features/F167-a2a-chain-quality.md` Phase P section
> AC: P1-P5 (P0 already merged as PR #2544)

## Problem

hold_ball 只有定时唤醒 (`wakeAfterMs`)。猫想说"这个东西跑完了叫我"，但没有工具表达这个意图。四只猫独立踩过的 `run_in_background` bug 的根因就是缺这个能力。

## Solution

给 `hold_ball` 增加 `wakeWhen` 参数（与 `wakeAfterMs` 互斥），服务端 managed runner 托管长命令、盯终态、完成后带结果唤醒。

## Architecture

### 数据流

```
Cat calls hold_ball({ wakeWhen: { command, cwd, timeoutMs } })
  → MCP tool handler (callback-tools.ts)
  → POST /api/callbacks/hold-ball (callback-hold-ball-routes.ts)
  → ManagedRunner.launch(command, cwd, timeoutMs)
    → child_process.spawn(command, { shell: true, cwd })
    → pipe stdout/stderr to temp log file
    → on exit → wake cat with results
    → on timeout → kill + wake with timeout info
  → DynamicTaskStore (same single-slot semantics)
  → ball.held event (ball-custody)
```

### 唤醒数据

```typescript
interface WakeWhenResult {
  exitCode: number | null;  // null = timeout killed
  timedOut: boolean;
  durationMs: number;
  tailOutput: string;       // last 50 lines of combined stdout+stderr
}
```

### Key Decisions

1. **Runner lives in API process** — same machine as cat, same filesystem access. No need for a separate daemon.
2. **Shell mode** — `spawn(command, { shell: true })` because commands are shell expressions (`pnpm gate`, `cd /path && pnpm test`).
3. **Output capture** — combined stdout+stderr piped to temp file (`/tmp/cat-cafe-runner/{taskId}.log`). Only last 50 lines returned in wake message (context budget).
4. **Timeout** — defaults to 600000ms (10min), max 3600000ms (1h). On timeout: SIGTERM → wait 5s → SIGKILL.
5. **Single-slot** — wakeWhen hold cancels prior pending holds (same as timed). If prior hold had a running process, kill it (SIGTERM).
6. **Cleanup** — log files cleaned up after wake delivery. On API restart: orphan child processes are NOT re-adopted (too complex); log files survive for debugging.

## Implementation Breakdown

### Hard Layer (code)

| # | File | Change | AC |
|---|------|--------|------|
| H1 | `packages/mcp-server/src/tools/callback-tools.ts` | Add `wakeWhen` to schema (mutually exclusive with `wakeAfterMs`), forward to API | P1 |
| H2 | `packages/api/src/routes/callback-hold-ball-routes.ts` | Route `wakeWhen` to ManagedRunner, pass runner result to wake mechanism | P1, P3 |
| H3 | `packages/api/src/infrastructure/managed-runner.ts` (NEW) | Spawn command, capture output, track pid, handle exit/timeout/kill | P2, P4 |
| H4 | `packages/api/src/infrastructure/scheduler/templates/reminder.ts` | Extend wake message format to include WakeWhenResult | P3 |
| H5 | `packages/api/src/domains/ball-custody/ball-custody-events.ts` | New event: `ball.wake_condition_met` (vs existing `ball.hold_expired`) | P3 |
| H6 | Tests: `test/managed-runner.test.mjs` (NEW), extend `callback-hold-ball-routes` tests | All |

### Soft Layer (L0 / skills / prompts)

| # | File | Change | Why |
|---|------|--------|-----|
| S1 | `assets/prompt-templates/handoff-decision-tree.md` | Add **2c**: wakeWhen 模式 — 本地长命令交给服务端跑，完成后带结果唤醒 | 猫需要知道什么时候用 wakeWhen vs wakeAfterMs vs event-driven |
| S2 | `assets/prompt-templates/l3-routing-rules.md` | Add 2c routing rule alongside 2a/2b | 同上 |
| S3 | `assets/prompt-templates/l5-mcp-tools-index.md` | Update hold_ball description — mention wakeWhen | 工具索引准确 |
| S4 | `cat-cafe-skills/receive-handoff-grounding/SKILL.md` | Add wakeWhen path in Keeper Wait UX, update WaitSourceRef (new kind: 'managed_command') | Grounding skill 是 hold_ball 的认知守门员 |
| S5 | `cat-cafe-skills/receive-handoff-grounding/refs/resolver-catalog.md` | Add managed_command resolver | 完整性 |
| S6 | `cat-cafe-skills/receive-handoff-grounding/refs/dogfood-fixtures.md` | Add fixture: wakeWhen(pnpm gate) in headless mode | 测试 |
| S7 | `cat-cafe-skills/receive-handoff-grounding/refs/claim-schema.md` | Add 'wait_managed' claim kind | Schema 完整 |

### Eval Layer (验证 wakeWhen 被正确使用)

| # | What | How |
|---|------|-----|
| E1 | 猫是否在该用 wakeWhen 时用了 | Telemetry: `hold_ball` 调用中 `wakeWhen` vs `wakeAfterMs` 比例 |
| E2 | 假绿检测 | `pnpm gate` + `run_in_background` 仍被 P-0 hook 拦，但 `wakeWhen` 模式不受限 |

## Implementation Order

1. **H3** ManagedRunner (Red→Green，独立可测)
2. **H5** Ball custody events (新 event type)
3. **H2** API route (接入 ManagedRunner + wake)
4. **H1** MCP tool schema (暴露给猫)
5. **H4** Reminder template (wake message format)
6. **H6** Integration tests
7. **S1-S7** Soft layer (全部，一个 commit)
8. **E1-E2** Eval (可在 merge 后 follow-up)

## Stateful Object Gate (F229)

**ManagedRunner 状态转移表**:

```
                 launch()
IDLE ────────────────────→ RUNNING
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         exit(code)      timeout          cancel(SIGTERM)
              │               │               │
              ▼               ▼               ▼
          COMPLETED       TIMED_OUT       CANCELLED
              │               │               │
              └───────────────┼───────────────┘
                              │
                         wake cat
                              │
                              ▼
                          CLEANED_UP
                        (log deleted)
```

**不变量**:
- 每个 runner 实例只能从 RUNNING 转到 COMPLETED/TIMED_OUT/CANCELLED 之一，不可逆
- RUNNING 状态必须有 pid（进程已 spawn）
- 终态（COMPLETED/TIMED_OUT/CANCELLED）必须有 exitCode（null = 被杀）和 durationMs
- wake 只触发一次（dedup by taskId）
- cancel 后如果进程未退出，5s 后 SIGKILL

## Test Strategy

| Test | What | Red condition |
|------|------|---------------|
| T1 | ManagedRunner.launch() → command exits normally → result has exitCode + output | launch 'echo hello' → expect exitCode=0, output contains 'hello' |
| T2 | ManagedRunner.launch() → command fails → result has non-zero exitCode | launch 'exit 1' → expect exitCode=1 |
| T3 | ManagedRunner.launch() → timeout → process killed, result.timedOut=true | launch 'sleep 999' with timeoutMs=100 → expect timedOut=true |
| T4 | ManagedRunner.cancel() → SIGTERM sent → result.exitCode=null | launch 'sleep 999', cancel → expect exitCode=null |
| T5 | hold_ball({ wakeWhen }) → ManagedRunner launched → command exits → cat woken | Integration: full flow |
| T6 | hold_ball({ wakeWhen }) replaces prior hold with running process → old killed | Single-slot |
| T7 | hold_ball({ wakeWhen, wakeAfterMs }) → validation error | Mutual exclusion |
| T8 | hold_ball({ wakeWhen }) in gate-keeping thread → blocked | Gate-keeping guard |

## Risk

| Risk | Mitigation |
|------|-----------|
| Zombie processes on API restart | Log files survive; PIDs don't. Document limitation. Operator can `ps aux \| grep cat-cafe-runner` |
| Command runs too long / consumes resources | timeoutMs max=1h, default=10min. No memory limit (OS handles). |
| Path traversal in cwd | Validate cwd starts with project root or /tmp |
| Log files fill disk | Max 10MB per log, truncate head. Cleanup on wake. |
| Command injection | `spawn(command, { shell: true })` — same trust model as cat running Bash. Cat already has shell access. |

## Open Questions

None — proceed to implementation.
