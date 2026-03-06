# Review Request: F065 Phase A — Bootstrap Enhancement (Task Snapshot + MCP Guidance + Token Cap)

## What

Session #2+ bootstrap now includes:
1. **Task snapshot** — compact list of thread tasks with priority sort, focus marker, injection defense
2. **Updated MCP guidance** — `read_invocation_detail` + `view=handoff` in step-by-step recall path
3. **Token cap** — `MAX_BOOTSTRAP_TOKENS=2000` internal cap with graceful degradation (drop task snapshot first, then hard-truncate)
4. **Wiring** — TaskStore plumbed through InvocationDeps → AgentRouter → route-serial/parallel → buildSessionBootstrap

## Why

封印重生的猫几乎"失忆"：新 session 不知道有哪些任务、做到哪了。Task 快照让新猫一醒来就知道"N 个任务，M 完成，当前在做哪个"。MCP 引导路径更新让新猫知道如何用已有工具搜旧 session。Token cap 防止 bootstrap 超预算。

## Original Requirements（必填）

> "Session chain 新启动的猫需要继承过去的猫的猫猫崇崇。现在是你之前的 chain 上下文超过了被封印了，然后启动后的新 session 的你，我估计是没自动继承这个 plan 的。"
> "搜文件树那样搜 session chain → invocation → 文件树"
> "记忆模式：只是'知道之前做了什么'，自行决定下一步"

- 来源：Thread `thread_mmdzcvac30doaova`，铲屎官 2026-03-05 消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Route-level budget accounting deferred** — 修改 route-serial/parallel 的 token 预算计算爆炸半径太大。改为 bootstrap-internal token cap（`MAX_BOOTSTRAP_TOKENS=2000`），统一覆盖所有 call path。
- **ThreadMemory deferred to Phase B** — Phase A 只做 task snapshot（小且关键），线程级滚动摘要留 Phase B。
- **`sanitize()` is conservative** — 宁可多剥一些 markdown 也不冒注入风险。如果过度剥离实际影响用户体验，Phase B 可以调整。

## Open Questions

1. **Token cap 2000 是否合理？** — 当前 bootstrap 不含 task snapshot 时约 400-600 tokens，加 task snapshot 约 600-1000。2000 留有余量。
2. **`estimateTokens` 的跨 worktree import 路径** — `../../../../utils/token-counter.js` 路径较深，是否需要重新组织 import？（功能无影响，风格问题）

## Next Action

请审查代码质量、注入防护完整性、token cap 策略。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-1 | ✅ | `formatTaskSnapshot` + bootstrap 注入，11 + 4 tests |
| AC-2 | ✅ | 紧凑列表 + counts + `▸` focus marker |
| AC-3 | ✅ | `read_invocation_detail` + `view=handoff` in guidance |
| AC-4 | ✅ | 3-step recall path in bootstrap |
| AC-5 | ✅ | `MAX_BOOTSTRAP_TOKENS=2000` internal cap |
| AC-6 | ✅ | `sanitize()` + truncation + data marker + 4 injection tests |

### 测试结果

```
pnpm --filter @cat-cafe/api test  # 2601 pass, 5 fail (Redis isolation guard, baseline)
pnpm lint                         # 0 errors
pnpm -r build                     # exit 0
pnpm check:dir-size               # no violations
```

### 相关文档

- Spec: `docs/features/F065-session-continuity.md`
- Plan: `docs/plans/2026-03-05-f065-phase-a-bootstrap-enhancement.md`
- Feature: F065 / evolved from F024
