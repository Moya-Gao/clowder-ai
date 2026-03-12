# Review Request: F091 Phase 6 — Thread-based Podcast Generation

## What
Podcast generation now uses the existing message pipeline instead of standalone `ClaudeAgentService`. When a study thread exists, the prompt is posted to the thread and the cat is invoked via `router.routeExecution()` (same flow as GitHub/connector triggers). When no thread exists, one is created and linked via `StudyMetaService`.

Core changes:
- `podcast-generator.ts`: Added `ThreadInvokeDeps` interface + `generateScriptViaThread()` — posts message to thread, invokes cat, collects response
- `signal-podcast-routes.ts`: Added `PodcastRouteOptions` DI interface + `resolveStudyThread()` for thread resolution/creation
- `index.ts`: Wired DI deps (messageStore, threadStore, router, invocationRecordStore, invocationTracker) to podcast routes

## Why
Phase 5 used standalone `new ClaudeAgentService()` which bypassed the message pipeline — responses weren't visible in threads, no session context. Phase 6 integrates with the thread system so podcast generation benefits from existing thread context and conversation history.

## Original Requirements
> "假设我们有一个Study已经在线程一里讨论过了，然后实际上你这里要做的就只是，比如说调度起线程，因为我们有消息管道嘛，跟GitHub通知一样子，往线程里面去给发一条消息就行了。你们你们想太复杂了。"
- 来源：铲屎官 2026-03-11 19:51 语音消息（F091 Phase 6 讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Followed ConnectorInvokeTrigger pattern (post message + routeExecution) instead of MCP-based invocation — simpler, synchronous response collection
- Kept standalone LLM fallback for cases where threadDeps aren't available (backward compatibility)

## Open Questions
1. `generateScriptViaThread` runs synchronously (awaits full response) — acceptable for podcast gen but different from ConnectorInvokeTrigger's fire-and-forget. Is blocking OK here since the route already returns 202?
2. Thread participant is hardcoded to `'opus'` — should this be configurable?

## Next Action
@gpt52 请 review commit `2a82fede`（feat/f091-phase6 branch），重点关注：
- `generateScriptViaThread` 的 invocation lifecycle（是否正确 create → track → route → complete）
- 错误路径：generation 失败时 tracker cleanup 和 artifact rollback 是否完整
- DI wiring 在 index.ts 是否正确

## 自检证据

### Spec 合规
| AC | 状态 | 代码位置 |
|----|------|----------|
| AC-P6-1: 复用已有线程 | ✅ | signal-podcast-routes.ts:38-43 |
| AC-P6-2: 创建新线程 | ✅ | signal-podcast-routes.ts:45-53 |
| Thread pipeline invocation | ✅ | podcast-generator.ts:108-161 |

### 测试结果
```
tsc --noEmit → exit 0
node --test (16/16) → 0 failures
  - podcast-thread-generation.test.js: 5 pass
  - study-meta-dedup.test.js: 3 pass
  - study-meta-collections.test.js: 8 pass
```

### 相关文档
- Plan: `docs/plans/2026-03-12-f091-phase-6-thread-session-reuse.md`
- Feature: `docs/features/F091-signal-study-mode.md`
