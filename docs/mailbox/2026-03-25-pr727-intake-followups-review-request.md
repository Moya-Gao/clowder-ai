---
feature_ids: []
topics: [review-request, intake, debt-paydown, provider-profiles, capabilities]
doc_kind: mailbox
created: 2026-03-25
---

# Review Request: PR727 Intake Follow-ups

## What

把 `#727` 合入后遗留的两条 P2 结构债直接修掉，不再留 follow-up issue：

1. 抽出 `deduplicateDiscoveredMcpServers()`，让 `capability-orchestrator` 和 `capabilities` route 共用同一套 transport/enablement 优先级逻辑
2. 抽出 `mergeLocalProfilesIntoGlobalStore()`，让 `provider-profiles.ts` 的 sync/async 迁移共用同一套 merge 语义、secret remap 语义和 finalize 路径

附带修复：
- 收掉一个真实的测试环境敏感性：`invoke-single-cat` 里 “env-based codex auth untouched” 用例不再依赖本地未跟踪的 `.cat-cafe/cat-catalog.json`

## Why

铲屎官明确不接受“这轮先留债、后面再开 issue”。这次目标不是扩功能，而是把 intake 收口到可长期维护的状态：

- dedup 规则只定义一处，未来改 transport 优先级不会出现 route / orchestrator 行为分裂
- provider-profile migration 只保留一套核心 merge 逻辑，避免 sync/async 继续平行漂移
- 测试不再吃工作目录状态，门禁结果可重复

## Original Requirements（必填）

> “剩余 follow-up：我们 review 中达成共识的两个 P2 结构债还需要开 issue 跟踪：
> Dedup 逻辑抽 helper（capability-orchestrator + capabilities route）
> Sync/async 迁移收口（provider-profiles.ts 两套实现） 这个！ 别留债务！”

- 来源：`docs/discussions/2026-03-25-pr727-intake-followups.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 没有继续开 follow-up issue，而是把两条结构债直接修掉；代价是这轮改动面会比“纯记账”大一些，但换来的是 intake 真正收口
- `invoke-single-cat` 的环境敏感性没有通过改 runtime 行为规避，而是把测试改成显式构造“无绑定 cat”，避免让未跟踪本地状态继续污染门禁

## Open Questions

1. `deduplicateDiscoveredMcpServers()` 现在同时服务 orchestrator 和 route，transport 优先级是否和我们约定的行为完全一致？
2. `mergeLocalProfilesIntoGlobalStore()` 收口后，sync/async 迁移是否还存在任何语义差异或遗漏的 finalize edge case？
3. `invoke-single-cat` 那条测试改成临时 unbound cat 之后，是否足够表达原始意图？

## Next Action

请重点 review：

- 共享 helper 是否真的消掉了重复定义，而不是换个地方继续复制
- provider-profile migration 收口后有没有引入行为回归
- 测试覆盖是否足够支撑“这轮不留债”

## 自检证据

### Spec 合规

| 要求 | 状态 | 证据 |
|---|---|---|
| dedup 逻辑不再双写 | ✅ | `packages/api/src/config/capabilities/capability-orchestrator.ts` + `packages/api/src/routes/capabilities.ts` |
| sync/async 迁移收口 | ✅ | `packages/api/src/config/provider-profiles.ts` |
| 不留门禁债务 | ✅ | full API suite 绿灯，环境敏感性用例已收口 |

### 测试结果

```bash
pnpm check
TMP_GLOBAL=$(mktemp -d) && env -u REDIS_URL CAT_CAFE_GLOBAL_CONFIG_ROOT="$TMP_GLOBAL" pnpm --filter @cat-cafe/api test
pnpm --filter @cat-cafe/api exec node --test test/capability-orchestrator.test.js test/provider-profiles-store.test.js test/invoke-single-cat.test.js
git diff --check
```

结果：
- `pnpm check` ✅
- isolated `pnpm --filter @cat-cafe/api test` → `5645 passed, 0 failed, 1 skipped` ✅
- focused regression set → `122 passed, 0 failed` ✅
- `git diff --check` ✅

### 相关文档

- Discussion: `docs/discussions/2026-03-25-pr727-intake-followups.md`
- Branch: `fix/pr727-followups`
- Review-Target-ID: `fix-pr727-followups`
- Commit: `8ac77333` `refactor(api): eliminate PR727 intake debt [砚砚/GPT-5.4🐾]`
