---
feature_ids: [F192]
topics: [eval-hub, livefix, review]
---

# Review Request: F192 Eval Pipeline Livefix (OQ-16/17/18/19)

Review-Target-ID: f192-livefix
Branch: feat/f192-eval-pipeline-livefix

## What

Fix 4 CVO dogfood bugs that made the eval pipeline dead and eval domains invisible:

1. **OQ-19** — Eval domain threads don't appear in sidebar "系统" section: added `systemKind` field to Thread interface (backend + Redis + frontend), sidebar filter upgraded from `connectorHubState`-only to `systemKind || connectorHubState`
2. **OQ-16** — eval:memory invisible in Hub: `loadEvalHubSummary()` now returns `domains[]` from all YAML-registered domains (not just verdict-bearing ones); frontend `DomainCard` shows "待首次评估" for no-verdict domains
3. **OQ-17** — Scheduled eval pipeline dead: created `createEvalDomainDailySpec()` TaskSpec_P1, registered in index.ts, cron `0 3 * * *`, reads eval-domains/*.yaml, delivers invocation to system threads, triggers eval cat via invokeTrigger
4. **OQ-18** — System threads are empty shells: consequence of OQ-17 — once daily eval runs, eval cat works in the system threads

8 commits, 14 files changed (7 source + 4 test + 3 docs).

## Why

铲屎官 dogfood 了 Eval Hub，发现：eval:memory 完全不可见、eval domain threads 不在侧边栏系统分区（第二次 report）、定时 eval 从未跑过（整个 pipeline 是死的）、system threads 是空壳。这是 PR 1 of 3（CVO approved split）。

## Original Requirements（必填）

> 铲屎官 2026-05-26 15:11: "至少你的点击a2a工作thread 不能给我去一个随便的新建thread吧？这合理吗？你们的系统thread也没在这里创建啊？这个issue记录了吗？这是我第二次report！"
>
> 铲屎官 2026-05-26 15:18: "看看现在f192剩下的eval hub你打算如何排pr？"
>
> 铲屎官 2026-05-26 15:24: "可以你把你的这想法记录一下 我们三个pr 开始吧 按顺序！开wktree 到时候你review 喊gpt54好了！55同学哈哈哈他太贵了 没猫粮了！"

- 来源：thread 内直接对话（2026-05-26 15:11-15:24）
- **请对照上面的摘录判断：(1) eval threads 是否出现在侧边栏系统分区 (2) eval:memory 是否在 Hub 可见 (3) eval pipeline 是否有注册的定时任务**

## Tradeoff

- `systemKind` 采用 `||` bridge 而非全量迁移 existing connector threads — 避免触碰 Redis 6399 生产数据，backwards-compatible
- 没有运行首次实际 eval（needs eval cat invocation in target thread — out of scope for livefix）
- 没有删除 legacy scheduled tasks（dry-run 在 E-scale 已做，不在本 PR scope）

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: Extending existing Thread interface + eval-hub read model, no new ownership boundaries

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- ConnectorRouter.ts 改动只是在现有 updateConnectorHubState 后补 `updateSystemKind?.('connector_hub')`，不是新架构

## Open Questions

### 技术 OQ（给 reviewer）

1. **`systemKind || connectorHubState` bridge 长期维护成本**：当前两个判据并存是 migration bridge。是否应该在 F192 剩余 PR 中加一个 migration step 把 existing connector threads 补上 `systemKind='connector_hub'`？
2. **eval-domain-daily 的 `trendRefs: [], verdictRefs: []` 空数组**：`buildEvalCatInvocation()` 接受 longitudinal context refs，当前传空 — 需要后续 PR 补上 trend/verdict 查询逻辑，还是这 PR 先空着是合理的 bootstrap？

### 价值 OQ（给 CVO，如有）

无。

## Next Action

请 review 全部 8 commits，重点关注：
1. `systemKind` 在 Thread 接口上的位置和 Redis 序列化正确性
2. `loadRegisteredDomains()` 的 YAML 加载是否健壮（error handling）
3. `createEvalDomainDailySpec()` 的 execute 函数是否正确处理 invokeTrigger 缺失的 edge case

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192-livefix/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（review:start 默认端口）

## 自检证据

### Spec 合规

Quality gate passed — 全部 7 requirements 验收通过。OQ-16/17/18/19 在 spec 中标 ✅。
Fallback layer check: 3 files flagged (cumulative), all net +1 backwards-compat bridges — justified in gate report.
Architecture ownership: harness-eval cell, no new cells, no parallel Store/Queue/Router.

### 测试结果

```
API tests: 175 passed, 0 failed ✅
  - thread-system-kind.test.js: 5 pass
  - eval-domain-daily.test.js: 5 pass
  - eval-hub-read-model.test.js: 5 pass
  - eval-hub-thread-ensure.test.js: 9 pass
  - (and 151 other harness-eval tests)
Web tests: 3496 passed, 0 failed ✅
  - thread-utils.test.ts: 37 pass (2 new)
  - HubEvalTab.test.tsx: 4 pass (1 new)
pnpm biome check --diagnostic-level=error: 0 errors ✅
API build: exit 0 ✅
Web build: exit 0 ✅
```

Pre-existing failures (not from our changes):
- `services-lifecycle-failure-route.test.js:153` — TypeError on main
- `codex-agent-service.test.js` — assertion error on main

### 相关文档

- Plan: `docs/plans/2026-05-26-f192-eval-pipeline-livefix.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
