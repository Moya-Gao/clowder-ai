# Review Request: F149 Phase C — AcpProcessPool + Session Lease

Review-Target-ID: f149-phase-c
Branch: feat/f149-phase-c

## What

实现项目级 ACP 进程池（`AcpProcessPool`），将"烁烁是一个长驻 agent runtime"落成明确控制面：

1. **AcpProcessPool** — 按 `(projectPath, providerProfile)` 管理 ACP 进程生命周期
2. **Lease 机制** — thread acquire/release，idle 后自动回收（TTL + LRU）
3. **Health check** — 定期检测死进程（zombie cleanup）
4. **Observable metrics** — `GET /api/diagnostics/acp-pool` 暴露 live process count / warm hit rate / eviction count 等 7 项指标
5. **Adapter 重构** — GeminiAcpAdapter 从 lazy-init shared client 改为 pool.acquire/release per invocation

## Why

Phase B 证明了 Gemini ACP 能跑通，但每条消息独立管理进程 = 没有池化 = 20 个 thread 就是 20 个进程。Phase C 解决运行时运营层的核心问题。

## Original Requirements（必填）

> "10个thread 烁烁可不是随时都需要参加的啊。"
> "今天可能一共开了20个甚至更多thread。"
> "砚砚的想法还是一个脚手架不是最终状态。"
> "我们要支持acp这个协议 支持烁烁acp接入。"

- 来源：`docs/features/F149-acp-runtime-operations.md` — 铲屎官原话（2026-03-31）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择了 multiplexing（多 lease 共享一个进程）而非 per-thread 进程隔离——Phase A 实验确认 ACP 是 single-flight-per-session 但支持多 session
- 池配置目前从 `cat-config.json` 的 `acp.pool` 字段读取，没有做运行时热更新——等需求出现再加
- `AcpPoolClient` 接口保持最小化（`isAlive` + `initialize` + `close`），adapter 内部通过 `as unknown as {...}` 访问 `newSession`/`promptStream`——这是有意的，pool 不需要知道 ACP 协议细节

## Open Questions

1. **AcpProcessPool.ts 299 行**：在 200-350 warning zone。逻辑紧密耦合（pool + entry + eviction + health check），拆分反而增加复杂度。reviewer 判断是否需要拆。
2. **evictOne() 同步 close**：当前 `close().catch(() => {})` 是 fire-and-forget，不阻塞 acquire。如果关进程慢（>5s），理论上可能暂时超 maxLiveProcesses。是否需要加 closing 状态的等待队列？
3. **diagnostics endpoint 无 auth**：`/api/diagnostics/acp-pool` 目前公开。是否需要 admin-only guard？

## Next Action

请 review 代码质量、边界条件、错误处理。重点关注 Open Questions 的 3 个点。

## 自检证据

### Spec 合规

| AC | 要求 | 状态 |
|----|------|------|
| C1 | pool key=(projectPath, providerProfile) | ✅ |
| C2 | acquire/release lease, inactive 不 pin | ✅ |
| C3 | idle TTL / max live / eviction 可配置 | ✅ |
| C4 | cancel/crash/timeout 无僵尸 | ✅ |
| C5 | 可观测指标 | ✅ |

### 测试结果

```
node --test test/acp/*.test.js → 42/42 pass, 0 fail ✅
pnpm lint                      → 0 errors ✅
pnpm check                     → 0 errors ✅ (biome)
pnpm -r build                  → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-02-f149-phase-c-acp-process-pool.md`
- Feature: F149 — `docs/features/F149-acp-runtime-operations.md`

### 变更文件

| 文件 | 变更 |
|------|------|
| `packages/api/src/.../acp/AcpProcessPool.ts` | NEW (299 lines) — pool core |
| `packages/api/src/.../acp/GeminiAcpAdapter.ts` | MODIFIED (182 lines) — pool-backed |
| `packages/api/src/config/cat-config-loader.ts` | MODIFIED (+5 lines) — pool config |
| `packages/api/src/index.ts` | MODIFIED (+48 lines) — registry + shutdown + diagnostics |
| `packages/api/test/acp/acp-process-pool.test.js` | NEW (316 lines) — 13 pool tests |
| `packages/api/test/acp/gemini-acp-adapter.test.js` | REWRITTEN — 10 adapter tests migrated to pool |

Commits:
- `71873e09b` feat(F149): AcpProcessPool — acquire/release, TTL, LRU, health check, metrics
- `674996163` feat(F149): wire GeminiAcpAdapter to AcpProcessPool + pool config
- `8f6fb750f` feat(F149): /api/diagnostics/acp-pool endpoint for pool metrics
- `90cce8a9a` style(F149): biome format fixes
