---
doc_kind: review-request
feature_ids: [F182]
created: 2026-05-04
author: 宪宪/Sonnet-4.6
reviewer: 砚砚
---

# Review Request: F182 Cat Roster Lifecycle Toggle — Sonnet 4.6 参赛实现

Review-Target-ID: f182-sonnet
Branch: feat/F182-sonnet

## What

F182 全 4 Phase 闭环实现：

- **Phase A**: `CatRoutingError` 类型 + `resolveCatTarget()` 纯函数 resolver (≤40 行) + 5 个入口接入（a2a-mentions pattern-building 阶段 + AgentRouter match-time + post/cross/rich targetCats + multi_mention + start_vote + register_scheduled_task）
- **Phase B**: 守护测试 — disabled 猫不出现在 buildTeammateRoster / buildStaticIdentityPrompt 任何区段
- **Phase C**: 7 个 MCP 工具降级 — A 类 3 软降级（routing_warnings + isError + KD-7 message 模板）+ A' 类 multi_mention 契约式 400 + B 类 3 契约式 400；KD-6 wrapper 双轨人类可读前缀 + JSON
- **Phase D**: `GET /api/cats/:catId/disable-impact` 端点 + Hub Toggle 确认弹窗 + "已停用成员"独立区段

## Why

铲屎官 2026-04-30 原话（thread `thread_molhvy2v84woqas9`）：

> Original Requirements（必填）
> "咱 成员协助总览里面能停止使用某些猫猫吗？...disable 的时候提示词或者说 harness 给你们注入队友就要不注入这些队友 避免你们调用，然后调用比如发 mcp at 他们也应该报错？这个报错就是告诉你们这个队友 disable 了换一个？"

来源：`docs/discussions/2026-04-30-f182-contest/README.md`，铲屎官立项原话
**请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Resolver 返回格式 vs 向后兼容**：multi_mention 的 `cat_not_found` 路径保留了旧的 `{ error: 'Unknown cat: ...' }` 格式（pre-existing test contract），`cat_disabled` 路径返回完整 CatRoutingError（AC-C2 新约定）。两种 kind 差异化格式可能让 API 行为不直觉——但破坏 15 个历史测试代价更高。
- **Hub confirm 逻辑在 `CatCafeHub.tsx` vs `HubMemberOverviewCard.tsx`**：spec 涉及文件列表写了 HubMemberOverviewCard，但实际实现把 disable-impact 调用和 confirm dialog 放在 `CatCafeHub.tsx.handleToggleAvailability`（数据来源最近，避免 prop drilling）。UI 行为一致。
- **start-dev-script.test.js 4 个失败**：由 PR #1499 WORKTREE_PORT_OFFSET 特性引入（派生端口优先级高于 CLI env vars）。只在 worktree 环境下失败，origin/main 0 失败。不是 F182 回归，但需砚砚确认是否计入评分。

## Open Questions

| # | 问题 | 期望 reviewer 判断 |
|---|---|---|
| Q1 | start-dev-script.test.js 4 个失败（WORKTREE_PORT_OFFSET 历史债）是否视为本提交回归？ | 确认是否扣分 |
| Q2 | multi_mention cat_not_found/cat_disabled 响应格式差异是否可接受？ | 是否需要统一 |
| Q3 | disable-impact 端点用 `ITaskStore.listByKind('work')` 全表扫描，首版不加索引（spec OQ-2 拍板）——是否满足 Phase D AC-D1？ | 确认 spec 对齐 |

## Next Action

砚砚按 F182 大赛 Rubric 评分，100 分制；请重点关注：
1. **KD-9**: resolver 的"不在 roster"vs"在 roster 但 disabled"两步判断是否正确
2. **KD-10**: a2a-mentions.ts pattern-building 阶段改造 vs AgentRouter match-time skip 改造是否分别处理
3. **KD-7**: A 类响应 natural language `message` 字段模板是否符合 spec
4. **KD-6**: MCP wrapper 双轨输出格式是否正确

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f182-sonnet/codex`
- Branch: `feat/F182-sonnet`（worktree offset=-20）
- Start Command: `pnpm review:start`
- Ports（当前 worktree 派生值）: `web=5122`, `api=3122`, `redis=6378`

> 注：review 沙盒不受 worktree offset 影响，`pnpm review:start` 自动分配隔离端口（3201/3202 起），无需手动设。

## 自检证据

### Spec 合规（All ACs ✅）

| Phase | AC | 状态 |
|---|---|---|
| A | AC-A1: CatRoutingError 两种 kind export 到 shared | ✅ |
| A | AC-A2: resolveCatTarget() 纯函数 38 行（KD-8, KD-9 两步） | ✅ |
| A | AC-A3: 5 入口接入（KD-4, KD-10 分别处理） | ✅ |
| B | AC-B1/B2: 守护测试 disabled 不出现 | ✅ |
| B | AC-B3: 不改 buildTeammateRoster 逻辑 | ✅ |
| C | AC-C1: A 类 3 工具软降级 + routing_warnings + KD-7 message | ✅ |
| C | AC-C2: A' + B 类 4 工具 400 cat_disabled + alternatives | ✅ |
| C | AC-C3: KD-6 wrapper 双轨前缀 + JSON | ✅ |
| C | AC-C4: MCP 工具描述更新 | ✅ |
| D | AC-D1: GET /api/cats/:catId/disable-impact 端点 | ✅ |
| D | AC-D2: Hub Toggle disable 前 impact 弹窗 | ✅ |
| D | AC-D3: Hub 独立显示 disabled 成员，可一键启用 | ✅ |

### 测试结果（这次真实运行）

```
pnpm check             → ✅ all checks pass（含 followup-tails）
pnpm lint              → ✅ 0 errors（warnings only，pre-existing）
pnpm -r --if-present run build → ✅ exit 0
pnpm test:
  api:        9956 pass, 4 fail（见 Tradeoff — start-dev-script WORKTREE_PORT_OFFSET 历史债）
  web:           5 pass, 0 fail
  mcp-server:  166 pass, 0 fail
  ppt-forge:   251 pass, 0 fail
F182-specific: 29 pass, 0 fail（cat-target-resolver + disable-impact + callbacks-f182-c）
```

### Commit 链（TDD 红绿可见）

```
c3935d680 chore(F182): biome format + complete C2-e/f/g multi-mention tests
cfe2d1a4d fix(F182-A): resolver — cats not in roster treated as available
ae3498c5d feat(F182-D): [green] disable-impact endpoint + Hub UX
a72f369ea test(F182-D): [red] disable-impact endpoint tests
0bd0b134a feat(F182-C): [green] Phase C routing degradation — all 7 tools + KD-6 wrapper
69d4f2f89 test(F182-C): [red] Phase C routing degradation — A soft + A'/B hard + KD-7 message
f6552e8c9 test(F182-B): guard disabled cats absent from buildTeammateRoster + system prompt
15142f28b feat(F182-A): wire resolver into a2a-mentions + AgentRouter — KD-10 two-point patch
3dae44056 feat(F182-A): [green] resolveCatTarget ≤40L — KD-9 two-step + alts sorting
c085f6090 test(F182-A): [red] CatRoutingError types + resolver stub — 8 tests fail
```

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|...)$' → 空（✅）
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$' → 空（✅）
```

### 相关文档

- Feature: `docs/features/F182-cat-roster-lifecycle-toggle.md`（v4 final）
- Contest: `docs/discussions/2026-04-30-f182-contest/README.md`

---

## 如果我判断错了，最可能错在哪（预注册 retraction 清单）

1. **multi_mention cat_not_found/cat_disabled 格式不一致**：我选择向后兼容老格式（`{ error: 'Unknown cat' }`），但 AC-C2 可能要求统一 CatRoutingError 格式。若砚砚认为 pre-existing test 应该更新而不是迁就，我会改。

2. **a2a-mentions.ts 改造是否真的是 pattern-building 阶段**：KD-10 说"让所有猫的 pattern 都参与匹配，再在命中后调 resolver 检查可用性"。我的实现是让 disabled 猫的 patterns 参与匹配，命中后调 resolver 返回 error。需要砚砚验证这是 KD-10 要求的路径还是我理解偏了。

3. **disable-impact 端点的测试用 mock DynamicTaskStore**：`ITaskStore.listByKind` 是真实的接口，但 `dynamicTaskStore.getAll()` 用了 mock。这不是 Redis 测试隔离，但可能被视为"测试覆盖不足"。

4. **Phase D 弹窗实现在 CatCafeHub.tsx 而非 spec 涉及文件列表里的 HubMemberOverviewCard.tsx**：功能正确但文件位置与 spec 不符，砚砚可能要求移到 HubMemberOverviewCard。

[宪宪/Sonnet-4.6🐾]
