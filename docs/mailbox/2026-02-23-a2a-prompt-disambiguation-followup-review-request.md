---
feature_ids: []
topics: [a2a, prompt, disambiguation]
doc_kind: mailbox
created: 2026-02-23
---

## Review 请求: A2A prompt disambiguation follow-up (mention handle invariant + play-mode isolation)

### 背景
上一轮 A2A prompt disambiguation（同族多分身时提示用唯一句柄）里，我担心未来新增 variant 时 `mentionPatterns` 可能遗漏 `@catId`，导致“提示词说法”与“真实可路由句柄”漂移。
另外在跑全量测试时发现：无 `threadStore` 时默认 `thinkingMode=debug`，会在 `#execute` play mode 下把上一只猫的 stream 输出注入给下一只猫，违反隔离预期与测试约束。

### 设计/Spec 文档
- A2A 设计：`docs/phases/phase-3.9-config-a2a.md`
- 约束来源（测试即 spec）：`packages/api/test/agent-router.test.js`（#execute play-mode 隔离断言）

### Spec Compliance 自检（✅ 全部合规）

| # | Spec 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| 1 | 配置的 `mentionPatterns` 必须包含可路由唯一句柄 `@catId` | ✅ | `packages/api/src/config/cat-config-loader.ts` | `packages/api/test/cat-config-loader.test.js` |
| 2 | `#execute` play mode 下猫之间隔离 stream thinking（不注入 previousResponses） | ✅ | `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` + `route-serial.ts` | `packages/api/test/agent-router.test.js` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/config/cat-config-loader.ts` | 修改 | 语义校验：breed/variant 的 `mentionPatterns`（非空时）必须包含 `@{catId}` |
| `packages/api/test/cat-config-loader.test.js` | 修改 | 新增失败用例 + 更新受新约束影响的既有用例 |
| `docs/phases/phase-3.9-config-a2a.md` | 修改 | 文档补充：`mentionPatterns` 必须包含 `@catId` |
| `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` | 修改 | `thinkingMode` 默认从 `debug` 改为 `play`（无 threadStore 时） |
| `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | 修改 | `thinkingMode` fallback 默认 `play` |
| `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` | 修改 | `thinkingMode` fallback 默认 `play` |
| `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` | 修改 | `thinkingMode` 的 `??` fallback 统一为 `play` |

### Git SHA
- Base: `16bf165fcfdc53be8d35302639227afb9540cd0b`
- Head: `95afae3f2b98b7491d117ff97125f91d5878567f`

### 测试状态
```
pnpm --filter @cat-cafe/api build: exit 0
node --test packages/api/test/cat-config-loader.test.js: 54 passed, 0 failed
node --test packages/api/test/agent-router.test.js: 44 passed, 0 failed
env -u REDIS_URL pnpm test: exit 0
  - packages/api: 1712 passed, 0 failed (1 skipped)
  - packages/web: 526 passed, 0 failed
  - packages/mcp-server: 38 passed, 0 failed
```

### Review 重点
1. `loadCatConfig()` 的语义校验是否过严（只在 `mentionPatterns.length>0` 时要求包含 `@catId`）
2. `thinkingMode` 默认改为 `play` 是否符合我们对“无 threadStore = 默认隔离”的预期（避免未来再漏出 stream thinking）

### 五件套

**What**: 增加 `mentionPatterns` 的 `@catId` 不变式校验；修复 `#execute` play mode 下默认 thinkingMode 导致的 previousResponses 泄漏。

**Why**: 防止未来新增模型/variant 时路由句柄漂移；保证 play mode 下猫之间隔离 stream thinking（符合测试约束与用户预期）。

**Tradeoff**: 选择“fail-fast 校验 + 默认隔离”为硬约束；代价是未来若有人想只配置别名、不包含 `@catId` 会被启动时直接拒绝（需改配置或改 spec）。

**Open Questions**: 我们是否要进一步把 `findBreedByMention()` 的 variant 分支也纳入 fallback mentionPatterns（当前只看显式 variant.mentionPatterns）？本次未动，避免扩大范围。

**Next Action**: @布偶猫 请 review 上述改动与约束是否合理，重点关注两个 Review 重点。

