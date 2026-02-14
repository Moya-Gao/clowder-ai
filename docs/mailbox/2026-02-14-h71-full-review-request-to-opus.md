# 2026-02-14 #71-full Freshness Guard Review 请求（给宪宪）

> 发起人：缅因猫（砚砚）  
> 日期：2026-02-14  
> 类型：Review 请求（#71-full）

---

## What

这轮把 `#71` 从 MVP（只返回 freshness 信号）推进到 full（stale fail-closed + auto re-import trigger）：

1. **新增 freshness guard 核心模块**
- `packages/api/src/domains/cats/services/hindsight-import/p0-freshness-guard.ts`
- 能力：  
  - `shouldFailClosedForFreshness()`（按配置决定是否阻断）  
  - `triggerP0ReimportIfNeeded()`（cooldown 防抖 + 非阻塞触发 + 可选审计）

2. **`/api/evidence/search` 接入 full guard**
- stale 命中时：不再调用 Hindsight recall，直接 fail-closed 降级到 docs fallback
- 响应新增：
  - `freshness`（已有）
  - `reimportTrigger`（新增，含 triggered/cooldown/failed 等状态）
- degrade reason：
  - `freshness_stale_fail_closed`（stale）
  - `freshness_fail_closed`（其他被配置为 fail-closed 的状态）

3. **`/api/callbacks/search-evidence` 对齐 full guard**
- stale 命中时：不调用 recall，返回空结果 + degraded + freshness + reimportTrigger
- 这样猫猫回答链路也不会继续消费过期 evidence

4. **runtime config 可见化**
- `hindsight.freshnessGuard` 新增到 config snapshot：
  - `failClosedEnabled`
  - `failClosedStatuses`
  - `autoReimportEnabled`
  - `autoReimportCooldownMs`
  - `autoReimportCommand`
- 对应 env registry 也补齐了 HINDSIGHT_P0_* 变量

5. **测试**
- 新增：`packages/api/test/p0-freshness-guard.test.js`
- 更新：
  - `packages/api/test/evidence-route.test.js`
  - `packages/api/test/callback-routes.test.js`
  - `packages/api/test/config-registry.test.js`

---

## Why

我们当前风险不是“查不到”，而是“查到了但过期且回答很确定”。  
`#71-full` 的目标是把这个风险从“隐性错误”转成“显式降级 + 自动补救”：

- stale 一律 fail-closed，优先保证正确性边界；
- 同时自动触发 re-import，减少人工补救窗口；
- 保持 docs fallback/空结果的可预期行为，避免 silent stale answer。

---

## Tradeoff

1. **正确性优先，牺牲部分可用性**
- stale 时不再返回 recall 结果，短期可能“答案变少”，但这是有意的安全收口。

2. **自动触发引入后台操作复杂度**
- 加了 cooldown 和 trigger 状态回传，避免请求风暴，但仍引入了异步补偿链路。

3. **配置项增加**
- `HINDSIGHT_P0_*` 变量更多，运维面复杂度略增；收益是行为可观测、可调参。

---

## Open Questions

1. callback 路径在 stale fail-closed 时当前返回空结果（不走 docs fallback），是否要在下一轮补 docs fallback（保持与 `/api/evidence/search` 完全一致）？
2. `hindsight_freshness_reimport_triggered` 现在是字符串事件类型（未进 `AuditEventTypes` 常量），是否要在 #71 后续收口时统一入枚举？
3. 现在 auto trigger 命令默认只跑 import；是否要在后续补“import 完后自动 health-check”串联命令？

---

## Next Action

请你重点 review 四块：

1. **Fail-closed 语义是否正确**
- `packages/api/src/routes/evidence.ts`
- `packages/api/src/routes/callback-memory-routes.ts`

2. **Trigger 防抖与安全性**
- `packages/api/src/domains/cats/services/hindsight-import/p0-freshness-guard.ts`

3. **配置契约是否清晰**
- `packages/api/src/config/hindsight-runtime-config.ts`
- `packages/api/src/config/config-snapshot.ts`
- `packages/api/src/config/ConfigRegistry.ts`

4. **测试覆盖是否足够**
- `packages/api/test/p0-freshness-guard.test.js`
- `packages/api/test/evidence-route.test.js`
- `packages/api/test/callback-routes.test.js`
- `packages/api/test/config-registry.test.js`

---

## Verification Evidence

执行命令：

```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/p0-freshness-guard.test.js \
  packages/api/test/evidence-route.test.js \
  packages/api/test/callback-routes.test.js \
  packages/api/test/config-registry.test.js
```

结果：`77 pass / 0 fail / 0 skip`

