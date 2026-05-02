# Review Request: F185 dispatch busy gate unification — ADR-034 implementation

Review-Target-ID: f185
Branch: feat/dispatch-busy-gate

## What

ConnectorInvokeTrigger busy gate 从 slot-level 升级为 thread-level，修复 PR tracking/CI/review 等 connector event 绕过队列并发唤醒猫的问题。

核心变更（11 files, +306/-13）：
1. **ConnectorInvokeTrigger.trigger()**: 两层 thread-level gate — `isThreadBusy()` + `tryStartThread()` 原子获取，替代旧的 `has(threadId, catId) || isCatBusy(threadId, catId)` cat-level 检查
2. **InvocationQueue**: 新增 `hasQueuedNonAgentForThread(threadId)` 查询 + agent urgent downgrade（non-continuation → normal）
3. **QueueProcessor**: `tryAutoExecute()` 增加 pause-aware fairness gate `hasDispatchableNonAgentQueued()`
4. **4 个 TaskSpec/Poller**: connector policy 补 `sourceCategory`

## Why

铲屎官报告 PR tracking event 唤醒布偶猫时砚砚在跑，外部 IM/GitHub 消息静默丢弃。根因：ADR-018 OQ-4 对所有入口统一用 slot 级判忙，connector event 只要目标 catId 不同就绕过 busy gate。四猫审计一致确认 → ADR-034 → 铲屎官 signoff。

## Original Requirements（必填）
> "你们好像有点奇怪了 我看到云端r2的时候他就给你过了然后你当时改了一堆东西 后面又出现新的问题...而且好像经常出现你和砚砚并发在干活的情况，你们这弄了好像很乱。"
>
> "比如说 你 挂了pr tracking → 你被 event唤醒，按道理这个时候如果砚砚在干活你应该在队列里！但是这时候你似乎会被唤醒！"
>
> "外部 IM 和 GitHub 来的消息永远不会被推送到猫猫那边"
- 来源：`docs/discussions/2026-05-01-dispatch-queue-architecture/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **thread-level vs slot-level gate**: 选择 thread-level 是因为 connector event 不应区分目标 cat —— 只要 thread 有活跃执行就排队。用户主动 @mention side-dispatch 不受影响（走不同入口）
- **tryStartThread 原子获取 vs has→start 两步**: 选择原子操作消除 TOCTOU 间隙，代价是 controller 需要在 executeInBackground 中传递（AC-3）
- **pause-aware fairness gate**: 最初用简单 `hasQueuedNonAgentForThread` 但回归测试发现会误阻 paused cat 的条目。改用 `hasDispatchableNonAgentQueued` 跳过 paused target

## Open Questions

1. **AC-4/AC-5 覆盖度**: system_info 可见性由现有 `queue_full_warning` socket event + info log + TaskSpec filter 覆盖，没有新增代码。请审查这是否足够，还是需要显式 system_info emit
2. **fairness gate 与 pause 交互**: `hasDispatchableNonAgentQueued` 检查 `pausedSlots` 跳过 paused cat 的条目 — 请确认这个语义是否正确（防止 paused cat 的 user entry 阻塞 free cat 的 agent autoExecute）
3. **controller 生命周期**: tryStartThread 返回的 controller 在 duplicate 路径会 `complete()` 释放 — 请确认没有泄漏路径

## Next Action

请 review 代码变更，重点关注 Open Questions 中的三个问题。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f185/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端变更，无需启动 dev server；测试命令：`cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import "$(pwd)/test/helpers/setup-cat-registry.js" --test --test-timeout=60000 test/invocation-queue.test.js test/queue-processor.test.js test/connector-invoke-trigger.test.js test/queue-integration.test.js`

## 自检证据

### Spec 合规
12/12 ACs 覆盖（AC-4/AC-5 由现有基础设施功能满足）。quality-gate 报告在本轮会话中生成。

### 测试结果
- F185 相关测试：237/237 pass, 0 failed
- 全量 API 测试：9971/9988 pass — 17 failures 均在无关子系统（catalog-loaders, game-types, port-validation），已验证 main 上通过
- pnpm biome check（改动文件）：0 errors
- pnpm lint（主仓）：0 errors
- pnpm build（主仓）：exit 0

### 相关文档
- Spec: `docs/features/F185-dispatch-busy-gate-unification.md`
- ADR: `docs/decisions/034-dispatch-busy-gate-unification.md`
- Discussion: `docs/discussions/2026-05-01-dispatch-queue-architecture/README.md`
