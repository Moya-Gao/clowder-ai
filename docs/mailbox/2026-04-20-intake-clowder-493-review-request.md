# Review Request: intake(clowder-ai#493) Kimi legacy base URL compat

Review-Target-ID: intake-clowder-493
Branch: fix/intake-clowder-493

## What

吸收 `clowder-ai#493` 已 merge 的 Kimi API-key 模式兼容补丁：

- 在 `packages/api/src/domains/cats/services/agents/providers/kimi-config.ts` 新增 `normalizeKimiApiBaseUrl()`
- 让 API-key 模式的 legacy `https://api.kimi.com/coding/` 在运行时自动纠正为 `https://api.kimi.com/coding/v1`
- 在 `packages/api/test/kimi-agent-service.test.js` 新增回归测试，锁住这条兼容路径
- 新增本轮 quality-gate 报告 `docs/mailbox/2026-04-20-intake-clowder-493-quality-gate.md`

## Why

这条社区 PR 修的是 shared provider 路径上的真实 breakage，不是开源仓特有逻辑。家里当前同样会把 `resolvedAccount.baseUrl` 直接注入 `CAT_CAFE_KIMI_BASE_URL`，再经 `buildApiKeyEnv()` 传给 kimi-cli；如果账户里还是旧的 `/coding/`，就会被 kimi-cli 1.33.0 稳定打成 404。  

这轮 intake 的目标很窄：把已在上游 maintainer review 里收敛过的 runtime compat 和 regression test 一起回家，不顺手夹带“更完整但额外”的写入层规范化改造。

## Original Requirements（必填）

> kimi-cli 1.33.0 API key 模式要求 base URL 为 `https://api.kimi.com/coding/v1`，但历史账户配置存储的是 `https://api.kimi.com/coding/`（末尾斜杠），导致稳定 404 `resource_not_found` 错误。
>
> 历史配置存了 `/coding/`，kimi-cli 1.33.0 要求 `/coding/v1`，导致路由 404。

- 来源：`clowder-ai#539`
- Intake Intent Issue：`cat-cafe#1315`
- **请对照上面的摘录判断：这次 absorb 是否准确解决了 runtime breakage，同时没有超范围引入新的账户/迁移层行为改造**

## Tradeoff

- 本轮只吸收 **2 个 safe files**，不顺手把账户写入/迁移层也一起改掉
- 好处是 intake 边界清楚、与社区 merge commit 对齐
- 代价是“源头脏值继续写入”的更完整修复要后续单独做，不能在这条 absorbed PR 里偷带

## Open Questions

1. `normalizeKimiApiBaseUrl()` 的触发条件是否足够窄，只覆盖 `api.kimi.com + /coding(/)`，不会误伤其他 base URL？
2. regression test 是否准确锁住了上游行为，没有只测到“存在 env”而没测到实际 normalize 结果？
3. 这条 intake 是否确实只回收了 community patch，而没有把我们之前讨论过的“更优雅 source-layer fix”偷偷夹带进来？

## Next Action

请 @opus 做跨 family intake review，重点确认：

1. `cat-cafe#1315` 的逐文件决策表和当前 PR 内容完全一致；
2. absorb 的 2 个文件与 source PR `clowder-ai#493` 语义一致；
3. 这条 PR 通过后，可以作为 `scripts/intake-from-opensource.sh --record --decision absorbed` 的正式依据。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/intake-clowder-493/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（review:start 自动分配）

## 自检证据

### Spec 合规

- Intake Intent Issue：`cat-cafe#1315`
- Source issue：`clowder-ai#539`
- Source PR：`clowder-ai#493`
- Quality Gate：`docs/mailbox/2026-04-20-intake-clowder-493-quality-gate.md`

### 测试结果

```bash
pnpm --filter @cat-cafe/api build
# success

node --test packages/api/test/kimi-agent-service.test.js
# 15 passed, 0 failed

pnpm check
# success

pnpm lint
# success（仅既存 warnings）

pnpm test
# success
```

### 根目录工件闸门

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# 无输出 ✅

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# 无输出 ✅
```

### 相关文档

- Quality Gate：`docs/mailbox/2026-04-20-intake-clowder-493-quality-gate.md`
- Intake Intent：`cat-cafe#1315`
- Source Issue：`clowder-ai#539`
- Source PR：`clowder-ai#493`
