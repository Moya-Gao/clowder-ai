# Review Request: F118 Phase A — SessionMutex + 超时诊断增强

## What

消除 cliSessionId 并发 resume 导致的 CLI 静默挂死（P1 bug），并增强超时诊断信息。

核心变更：
1. **SessionMutex** — 新建 per-cliSessionId 串行锁类（queue/fail-fast 策略，无抢占）
2. **超时诊断增强** — `__cliTimeout` 事件新增 6 个诊断字段（firstEventAt, lastEventAt, lastEventType, silenceDurationMs, processAlive, invocationId/cliSessionId）
3. **接入点** — invoke-single-cat.ts 在 sessionId 解析后加锁，finally 释放；5 个 AgentService 透传诊断字段

## Why

两个具体事故：
- Codex CLI 1800s 超时（thread_mmq8de3e0o4p1407）
- Codex session resume 失败（thread_mmq9wjiiht3k5vb3）

根因：cliSessionId 无 mutex → 并发 resume 同一 session → 一个进程静默挂死。InvocationTracker 只守 threadId:catId 槽位，不守 cliSessionId。

## Original Requirements（必填）

> "本质是我们的cli都没有心跳！！万一有进程但是假死咋办？"
> "最好直接feature立项，把bug也挂进去。把现象记录进去，设计稿画出来"
> "每做完一个phase找砚砚(codex)代码review，找GPT-5.4愿景守护。不用找我，直接进下一个phase。全部完成再找我"

- 来源：铲屎官在 thread 讨论中的原话（2026-03-14 05:45-06:10）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **mutex 策略**: 选 queue/fail-fast 而非 preempt-old。原因：不能假设旧请求一定无效——可能只是慢。抢占仅在 Phase B 显式触发（如超时+进程假死证据）。
- **mutex 作用域**: 进程级单例，与 InvocationTracker 独立。IT 守 threadId:catId 是正交职责。
- **诊断字段直接放 __cliTimeout**: 不新建事件类型，复用现有 yield 机制。

## Open Questions

1. `invoke-single-cat.ts` 中 mutex 放在 sessionId 解析后、workingDirectory 解析前——是否应该更靠近 service.invoke()？当前位置能覆盖 sessionId 变更后的所有路径。
2. 5 个 AgentService 都加了 invocationId/cliSessionId 透传，但 AntigravityAgentService 走不同路径（无 cliOpts）——是否需要覆盖？

## Next Action

请 @codex 做代码 review，重点关注：
- SessionMutex 的并发正确性（acquire/release/abort 交互）
- invoke-single-cat.ts 中 mutex 的作用域和生命周期是否正确
- finally 中释放时机是否合理（在 finalizeTaskProgress 之前）

## 自检证据

### Spec 合规

| AC | 状态 |
|----|------|
| AC-A1: 同 cliSessionId 并发 resume 排队/fail-fast | ✅ |
| AC-A2: SessionMutex 独立单元测试 | ✅ (8 tests) |
| AC-A3: __cliTimeout 增强诊断字段 | ✅ (6 fields) |
| AC-A4: 回归测试复现双 resume 场景 | ✅ |
| AC-A5: 验证 timeout 诊断字段完整 | ✅ (4 tests) |

### 测试结果

```
session-mutex.test.js: 8/8 pass ✅
cli-spawn.test.js: 26/26 pass ✅
invoke-single-cat.test.js: 47/49 pass (2 pre-existing F062 failures, verified baseline identical) ✅
pnpm lint: 0 errors ✅
pnpm check (biome): 0 errors ✅
pnpm check:dir-size: pass ✅
```

### 相关文档

- Feature: `docs/features/F118-cli-liveness-watchdog.md`
- Plan: `docs/plans/2026-03-14-f118-phase-a-session-mutex.md`
- BACKLOG: F118 row added

### 变更文件清单

| 文件 | 变更类型 |
|------|----------|
| `SessionMutex.ts` | 新建 |
| `cli-spawn.ts` | 修改（诊断字段） |
| `cli-types.ts` | 修改（+invocationId, +cliSessionId） |
| `invoke-single-cat.ts` | 修改（mutex 接入） |
| `types.ts` (AgentServiceOptions) | 修改（+invocationId, +cliSessionId） |
| `ClaudeAgentService.ts` | 修改（透传） |
| `CodexAgentService.ts` | 修改（透传） |
| `GeminiAgentService.ts` | 修改（透传） |
| `OpenCodeAgentService.ts` | 修改（透传） |
| `DareAgentService.ts` | 修改（透传） |
| `session-mutex.test.js` | 新建（8 tests） |
| `cli-spawn.test.js` | 修改（+4 tests） |

### Commits

```
4ceabeac feat(F118): add SessionMutex — per-cliSessionId serialization lock
39ed8cd9 feat(F118): enrich __cliTimeout with diagnostic fields
5db3b287 feat(F118): wire SessionMutex into invoke-single-cat + diagnostic pass-through
```
