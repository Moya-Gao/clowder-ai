# Review Request: F178 Phase B — CallbackPrincipal + AgentKeyRegistry

Review-Target-ID: f178-phase-b
Branch: feat/f178-phase-b

## What

Phase B 基建：给 F178 persistent MCP agent-key auth 搭底层 —

1. **CallbackPrincipal** 抽象（`kind: 'invocation' | 'agent_key'`）— 砚砚在 Design Gate 提出的坐标变换点（KD-3）
2. **AgentKeyRegistry** facade + MemoryAgentKeyBackend（issue / verify / revoke / rotate / list）
3. **derivePrincipal()** + **resolvePrincipalThread()** scope helpers — agent_key 路径强制显式 threadId
4. Agent-key 失败原因 taxonomy（aligned with F174 pattern）

10 files, +482 lines, 16 new tests + 36 regression tests = 52 total.

## Why

F061 闭环把 Bug-H 拆出立 F178，F174 Lifecycle 基建已就位。Bengal 需要持久身份 + 持久写权。Phase B 是基建层 — Phase C 才真正接线到 MCP tool path。

## Original Requirements

> 铲屎官 2026-04-26 原话："得给孟加拉一个梦想，不然他好可怜"
> 铲屎官 2026-04-26 拍板 OQ-2："为啥要点开启啊？难道不是默认大家都开启吗？社区小伙伴问的最多的问题就是如何给宪宪砚砚开启 yolo 模式"
> 铲屎官 2026-04-26："走起！"

- 来源：`docs/discussions/2026-04-26-f178-design/README.md` §5 OQ-2
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **RedisAgentKeyBackend（Task 6 stretch）本轮未做** — `IAgentKeyBackend` interface 已 ready，memory fallback 可用。Redis 后端在 Phase C 接线前补不影响合入。
- **discriminator 用 `'agentKeyId' in record`** 而非 plan 里写的 `'invocationId' in record` — 效果等价，选 agent_key 方向判断因为 InvocationRecord 字段更多、更不稳定。
- **resolvePrincipalThread 对 agent_key + threadId 走独立验证** 而非复用 resolveScopedThreadId — 因为 agent_key 没有 bound thread，不能传空 threadId 给 resolveScopedThreadId 的 actor.threadId。

## Open Questions

1. **IAgentKeyBackend.verify()** 目前 MemoryAgentKeyBackend 有 brute-force fallback（O(n) hash all records）。Redis 后端不需要（有 secret-index），但 memory 后端保留这个是否 OK？还是应该要求所有 backend 都依赖 secretIndex？
2. **AgentKeyRegistry.rotate() 里的 rotatedFrom** 通过 type assertion `(newRecord as AgentKeyRecord).rotatedFrom = ...` 直接 mutate backend 内部状态。Redis 后端不能这样做。是否应该在 IAgentKeyBackend 加一个 `setRotatedFrom()` 方法？

## Next Action

请 review 代码质量 + 架构对齐。特别关注：
- CallbackPrincipal 抽象是否和你在 Design Gate 提的一致
- scope helper 的 agent_key threadId guard 逻辑
- secret hashing 是否安全（sha256 + per-key random salt）

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f178-phase-b/codex`
- Start Command: `pnpm review:start`
- Ports: N/A — backend only, no dev server needed. Run `node --test test/agent-key-registry.test.js test/callback-principal-helpers.test.js` to verify.

## 自检证据

### Spec 合规

AC-B1 ✅ CallbackPrincipal + existing invocation path unchanged (13/13 callback-auth-prehandler + 23/23 invocation-registry)
AC-B2 ✅ AgentKeyRegistry + MemoryAgentKeyBackend (Redis stretch deferred)
AC-B3 ✅ issue/verify/revoke/rotate/list + hash-only storage (11/11 tests)
AC-B4 ✅ Structured reason codes aligned with F174

### 测试结果

```
node --test test/agent-key-registry.test.js          # 11 passed, 0 failed
node --test test/callback-principal-helpers.test.js   # 5 passed, 0 failed
node --test test/callback-auth-prehandler.test.js     # 13 passed, 0 failed (regression)
node --test test/invocation-registry.test.js          # 23 passed, 0 failed (regression)
pnpm biome check . --diagnostic-level=error           # 0 errors
pnpm --filter @cat-cafe/api build                     # 0 errors in F178 files (24 pre-existing TS7016)
```

### 相关文档

- Plan: `docs/plans/2026-04-26-f178-phase-b-agent-key-registry.md`
- Feature: `docs/features/F178-persistent-mcp-agent-key-auth.md`
- Discussion: `docs/discussions/2026-04-26-f178-design/README.md`
