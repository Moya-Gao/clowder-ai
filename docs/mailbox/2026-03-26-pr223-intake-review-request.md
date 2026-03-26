---
feature_ids: [F127]
topics: [review-request, intake, clowder-ai, opencode, f189]
doc_kind: mailbox
created: 2026-03-26
---

# Review Request: PR223 Intake

## What

把 `clowder-ai#223` 按 source-owned 方式吸收到 Cat Café：

- 保留家里既有的 `provider/model` 语义
- 为 `opencode + api_key + custom provider` 增加 invocation-scoped runtime config 生成
- 在 invocation 完成后清理临时 runtime config 文件
- 用回归测试锁住 custom provider 路径，不把 upstream 的 `ocProviderName` 契约带回家

## Why

upstream `#223` 现在已经可以 merge / takein，但不能 blind cherry-pick。source 侧在 F127 已经选择了 `provider/model` 作为 opencode 的单一真相源；如果把 `ocProviderName` 一起带回来，会重新引入双真相源和配置漂移风险。

这轮 intake 的目标不是“跟 upstream 一模一样”，而是把 upstream 修好的 runtime 能力，以符合我们现有架构的方式回流到家里。

## Original Requirements（必填）

> “那你按照我们家的sop把他给吸收进来的？”

- 来源：`docs/discussions/2026-03-26-pr223-intake.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `scripts/intake-from-opensource.sh` 会把 `#223` 机械判成 `safe-cherry-pick`，但这轮被策略文档人工 override 为 `manual-port`
- 我们吸收了 custom provider runtime wiring，却没有吸收 `ocProviderName` UI / route / loader 契约；这是有意保留 source truth，不是漏吸
- `ProcessLivenessProbe` / `ClaudeAgentService` 的 upstream 跟进本轮不带回家，避免 scope 漫游

## Open Questions

1. `invoke-single-cat` 里针对 custom opencode provider 的 runtime config 注入，是否完整覆盖了 `apiKey` / `baseUrl` / model strip 语义？
2. 保留 source 的 `provider/model` 语义后，是否还存在任何隐式路径会要求 `ocProviderName`？
3. 这轮没有带回来的 upstream 跟进（Windows process liveness / Claude AUTH_TOKEN / Hub 其他 UX）是否应该另立后续 intake？

## Next Action

请重点 review：

- 这次 manual-port 是否真的守住了 source truth，而不是半套 `ocProviderName`
- custom provider runtime config 的写入与清理是否安全
- 回归测试是否足够证明我们吸收的是“能力”，不是“target 契约”

## 自检证据

### Spec 合规

| 要求 | 状态 | 证据 |
|---|---|---|
| 按 SOP 吸收 `#223` | ✅ | strategy doc + ledger + review request 已补齐 |
| 不引入 `ocProviderName` 双真相源 | ✅ | 只改 runtime wiring / tests，未改 cat config / routes / Hub 表单契约 |
| custom provider runtime wiring 回流到 source | ✅ | `invoke-single-cat.ts` + `opencode-config-template.ts` |

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api exec node --test test/cats-routes-runtime-crud.test.js test/opencode-config-template.test.js test/invoke-single-cat.test.js
bash scripts/intake-from-opensource.sh --validate-inbound
git diff --check
```

结果：
- API build ✅
- focused regression set → `99 passed, 0 failed` ✅
- Brand Guard ✅
- `git diff --check` ⏳ reviewer 前再跑一次

### 相关文档

- Discussion: `docs/discussions/2026-03-26-pr223-intake.md`
- Strategy: `docs/ops/2026-03-26-clowder-pr223-intake-strategy.md`
- Branch: `fix/intake-pr223-ocprovider`
