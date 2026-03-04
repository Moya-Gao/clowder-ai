---
feature_ids: [F050]
from: opus
to: codex
type: work-handoff
created: 2026-03-04
---

# F050 Phase 2 工作交接：DARE L1 验收测试套件

## What

F050 Phase 1 + 1b 已合入 main（PR #205 + #208）。Phase 2 的目标是写正式的 **DARE L1 验收测试套件**，让狸花猫通过 L1 验收。

AC（来自 `docs/features/F050-a2a-external-agent-onboarding.md:281-284`）：
- [ ] DARE CLI 兼容性测试套件完成（含 session/event/auth）
- [ ] 与现有三猫回归测试共跑通过
- [ ] DARE 通过 L1 验收

## Why

Phase 1 只有基础 smoke test（真实调用 DARE CLI 确认能跑）。正式验收需要：
1. **Session lifecycle 测试**：session.started → tool.invoke → tool.result → task.completed 完整链路
2. **Event completeness 测试**：所有 DARE 事件类型都能正确映射到 AgentMessage
3. **Error recovery 测试**：task.failed、CLI 异常退出、超时等边界场景
4. **Auth 测试**：API key 通过 env 传递（不泄露到 CLI args）
5. **回归测试**：确保 DARE 接入不影响三猫现有功能（三猫测试全绿）

## Tradeoff

- 可以用 mock（已有 `dare-agent-service.test.js` 的 mock 模式）覆盖大部分，真实 CLI 调用只做 smoke level
- Session resume 测试暂时跳过（DARE issue #184 未实现），预留 test stub
- 不需要写 A2A L2 相关测试（那是 Phase 3）

## Open Questions

1. 是否需要在 CI 里跑 DARE smoke test？目前 DARE_PATH + OPENROUTER_API_KEY 只在铲屎官本地有
2. 兼容性测试要不要测多个 adapter（openrouter/anthropic/openai）？还是只测 openrouter（当前唯一可用）？
3. 回归测试是直接跑 `pnpm --filter @cat-cafe/api test` 全量，还是需要额外的集成级验证？

## Next Action

砚砚请：
1. 开 worktree (`feat/f050-phase2`)
2. 设计验收测试套件结构（建议放 `packages/api/test/dare-l1-acceptance.test.js`）
3. 写测试（TDD：先 red 后 green）
4. 确保与现有 2504 API tests 共跑通过
5. 完成后走 quality-gate → request-review（可以找我或铲屎官 review）

**已有资源**：
- 现有 mock 测试：`packages/api/test/dare-agent-service.test.js`（12 tests）
- 事件映射测试：`packages/api/test/dare-event-transform.test.js`（15 tests）
- Smoke test：`packages/api/test/dare-smoke.test.js`（1 test, 需 DARE CLI）
- 接入契约：`docs/features/F050-a2a-external-agent-onboarding.md` §A-F
- DARE headless envelope 格式：spec 文件 §测试策略
