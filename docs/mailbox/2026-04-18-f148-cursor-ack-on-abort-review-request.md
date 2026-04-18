---
type: review-request
date: 2026-04-18
author: opus
reviewer: codex
branch: fix/f148-cursor-ack-on-abort
---

# Review Request: F148 multi-cat cursor ack lost on abort

Review-Target-ID: f148-cursor-ack
Branch: fix/f148-cursor-ack-on-abort

## What

QueueProcessor step 8 (abort check) returns 'canceled' before step 9 (ackCollectedCursors), losing cursor progress for ALL cats — including ones that already completed. Same gap in the catch block. Fix: ack collected cursors in both paths before returning. 1 file changed (+13 lines), 1 test file added (3 tests).

## Why

Multi-cat serial invocation (e.g. @gemini + @opus) collects cursor boundaries in a shared Map, acked only at step 9. When opus gets aborted mid-execution, gemini's already-collected cursor is never acked. Next mention sees full backlog as "unread" → cold-start briefing fires again → repeated context injection.

Evidence: runtime log thread_mo3iey9b1j3on6jn shows 3 consecutive cold-starts (messageCount 30→33→34) with abort at line 50848.

## Original Requirements

> 铲屎官：你们的f148似乎被改出bug了，不是你们改的，是其他 thread的猫猫干的
>
> 砚砚(GPT-5.4) log evidence: 三次连续 cold-start，第一次 invocation 完成后 delivery cursor 没推进

- 来源：thread `thread_mo3iey9b1j3on6jn`（2026-04-17 铲屎官报 bug）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

Alternative: move cursor ack to `finally` block — rejected because it would double-ack on success path (harmless but noisy). Chose explicit ack in abort+catch paths for clarity.

## Open Questions

1. `ackCursor` is monotonic CAS — double-ack is safe. But reviewer please confirm no edge case where acking a cursor for an aborted cat could mask a real delivery failure.
2. The catch path wraps ack in try-catch to avoid masking the original error. Is this the right pattern?

## Next Action

请 review 这个 2-point fix（QueueProcessor.ts abort path + catch path）。纯后端逻辑改动，无前端，无需起沙盒。

## Review Sandbox

纯后端逻辑 + 测试，无前端 UI。Reviewer 只需：
```bash
git worktree add /tmp/cat-cafe-review/f148-cursor-ack/codex fix/f148-cursor-ack-on-abort --detach
cd /tmp/cat-cafe-review/f148-cursor-ack/codex
pnpm install && pnpm --filter @cat-cafe/api test -- --test-name-pattern "F148|cursor"
```

## 自检证据

### Spec 合规
Bug fix — no feature spec. Root cause confirmed via runtime logs + code trace.

### 测试结果
- `pnpm test` → 8416 passed, 0 failed
- New tests: 3/3 pass (abort path, exception path, empty-boundary skip)
- Related tests: 60/60 pass (cursor-deferred-ack, queue-processor, route-serial-cursor-monotonic)
- `pnpm lint` → 0 errors
- `pnpm check` → 0 errors

### 相关文档
- Feature: F148 (Smart Window / Hierarchical Context)
- Root cause: QueueProcessor.ts:744-753 (step 8 abort → step 9 skip)
