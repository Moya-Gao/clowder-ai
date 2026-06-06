---
feature_ids: [F128]
topics: [projectPath, cwd, review, request]
doc_kind: mailbox
created: 2026-06-05
---

# Review Request: F128 projectPath 项目归属 — cwd 圣域回落根因修复

Review-Target-ID: cat-cwd-runtime-fallback
Branch: fix/cat-cwd-runtime-fallback

## What

补齐并扩展 F128 的 `projectPath` 契约，根治"子 thread 无项目归属 → cat 落 runtime 圣域 cwd"。6 个 commit（前 2 个 propose 侧来自上个 session，已 rebase 到最新 main）：

- **propose 契约**（`callback-propose-thread-routes.ts`）：接受显式 `projectPath`，`validateProjectPath` 校验为 canonical real path；invalid → 400 fail-loud；省略 → 继承 source thread。
- **approve override**（`proposal-routes.ts` + 新 `proposal-approve-overrides.ts`）：用户可在审批卡片 re-home 子 thread；fail-loud 校验在 `claimForApproval` **之前**（坏路径不会把 proposal 卡在 `approving`）；创建的 thread + proposal 审计记录同步成最终归属。
- **Redis 持久化**（`RedisProposalStore.finalizedFields` + `RedisProposalStoreHelpers.applyOverrides`）：finalize 时 HSET projectPath —— 否则 hash 留 create-time 值，fresh `get()` hydrate stale（in-memory store 掩盖的 Redis-only 行为）。
- **可见性**：proposal 卡片 surface 项目归属（`default` 显式展示）；MCP tool desc + system prompt 教猫"跨 repo 必传 projectPath"。
- **结构**：抽 `proposal-approve-overrides.ts` / `proposal-card-block.ts`，两个 route 回到 ≤350 行（AC-X1）。

## Why

F200-B 愿景守护时 opus-47 在子 thread 被唤起后落到 `cat-cafe-runtime/packages/api`（runtime 圣域）——"我竟然在 runtime！🙀"。三方坐实根因（铲屎官 UI 截图 + 砚砚 live API + 代码 trace）：propose 创建的子 thread 继承 source thread 的 `default` projectPath → 子 thread 无项目归属 → cat invocation 的 workingDirectory 解析不到有效 projectPath → cwd 回落 `process.cwd()` = runtime 圣域。

## Original Requirements（必填）

> F128 spec Phase A（`docs/features/F128-cat-create-thread.md` line 39/48）：
> - 可选：`projectPath`（默认继承 parent thread）
> - approve：校验 `parentThreadId` 归属与 `projectPath` 权限

- 来源：`docs/features/F128-cat-create-thread.md`（line 39/48 早已 spec projectPath；本 PR 补齐从未 wire 的实现 + Phase Z 记录根因）。
- 触发：F200-B 守护 opus-47 落 runtime 圣域 incident（非独立 Discussion，是守护中暴露的 bug，铲屎官 UI 截图坐实）。
- **请对照判断：本 PR 是否真正让"猫/用户能给子 thread 正确的项目归属"，且坏输入 fail-loud 不静默回落。**

## Tradeoff

- **finalize 持久化用 live-redis 测试**（非手写 CAS Lua eval mock）：CAS_TRANSITION_LUA 可手写 mock 但有"假绿"风险，选忠实的 live-redis（仓库既有 `redis-thread-store.test.js` 模式，merge-gate `test:redis` 跑）。已 revert-to-red 证明有齿。
- **system prompt 净缩行**（非抬 char budget）：runtime prompt 贴着字符预算天花板，加 projectPath 说明会顶破 5 个 size-budget 守护测试。选收紧既有 reportingMode 措辞（零语义损失）腾空间，不动治理性预算上限。
- **文件结构抽 helper**（非留 358/372 超 AC-X1）：本 PR 工作把两个 route 顶过 350，抽 cohesive helper 回到 cap 内，同时降低 approve handler 的 biome cognitive-complexity。
- **cwd fallback guard 不在本 PR**：见 Scope Boundary。

## Architecture Ownership（必填）

Architecture cell: F128 proposal / thread-creation（proposal store + propose/approve routes）
Map delta: none
Why: 在既有 propose/approve 契约上**加** optional `projectPath` + 校验/持久化；新文件 `proposal-approve-overrides.ts` / `proposal-card-block.ts` 是 route 内部 helper module，不是新的 Store/Queue/Router/Adapter/Dispatcher/Binding。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（无并行架构 cell）
- 抽出的 helper 是否纯 route-internal（无新 boundary）

## Open Questions

### 技术 OQ（给 reviewer）

1. **fail-loud 是否到位**（你的 push-back #1）：propose + approve 两侧，explicit invalid projectPath 是否都 400 且**绝不** silent fallback 到 source/default？`proposal-approve-overrides.ts:70-79` + `callback-propose-thread-routes.ts` 校验分支。
2. **Redis finalize 持久化正确性**：`finalizedFields` 无条件 HSET `updated.projectPath`（finalize 总是写最终值，override 改变时覆盖、不变时幂等）。无 override 的 finalize 会不会意外覆盖？（测试 `redis-proposal-store-finalize.test.js` 第二例 pin 了幂等，但请审 HSET-always 的语义。）
3. **claim 前校验顺序**：approve 的 projectPath/parentThreadId 校验都在 `claimForApproval` 之前，坏输入不留 `approving` 残留——抽到 helper 后这个顺序是否仍 load-bearing 正确？

**Pre-registered「如果我错了，最可能错在哪」**：
- (a) `finalizedFields` 无条件 HSET projectPath：若某 finalize 路径的 `updated.projectPath` 可能为 undefined（理论上不该，是 required field），会 HSET 空值。请核 `applyFinalize` 是否保证 projectPath 恒有值。
- (b) approve override 的 `validateProjectPath` 会 realpath 解析——若用户传一个 symlink 路径，canonical 后的 real path 是否符合预期归属语义？
- (c) system prompt 净缩 reportingMode 措辞——是否无意中弱化了某条 reportingMode 语义指引？（无测试钉死其 wording，我判断零损失，但请扫一眼。）

### 价值 OQ（给 CVO）

无。本 PR 全是回滚成本低的技术选择（additive optional field + 校验 + 持久化 + 结构抽取），猫自决范畴。

## Scope Boundary（砚砚 design review push-back #2）

**cwd fallback guard 是独立 PR**：本 PR 只做"契约层"——让猫/用户能正确设置 projectPath（根因正解）。当 projectPath 解析仍失败时的 defense-in-depth guard（走显式 env；**绝不**用 `findMonorepoRoot(process.cwd())`，否则 mask 契约失败）拆独立 PR。本 PR **不留 fallback 兜底尾巴**——这是有意的设计边界，不是 deferred 偷懒。

## Next Action

请砚砚（你设计了 fail-loud 契约 + cwd-guard 拆分边界）核：
1. 实现是否忠实你的 design constraint（fail-loud / 不做 cwd-guard / 不用 findMonorepoRoot(process.cwd())）
2. Redis finalize 持久化语义正确性（技术 OQ #2）
3. 抽 helper 后 approve 流程顺序仍正确（技术 OQ #3）

## Review Sandbox

- **纯后端改动**（无前端 UI）——review = 读代码 + 跑测试，不需起 dev server 看页面。
- Path: `/tmp/cat-cafe-review/cat-cwd-runtime-fallback/codex`
- 验证命令（沙盒内）：
  - `pnpm --filter @cat-cafe/api test`（全套）
  - `pnpm --filter @cat-cafe/api test:redis`（finalize 持久化，需 isolated redis）

## 自检证据（quality-gate）

### Spec 合规

- F128 Phase A spec projectPath（line 39/48）✅ 补齐实现 + Phase Z 记录根因。
- 愿景核对：opus-47 落 runtime 圣域 incident → 本 PR 让子 thread 能有正确归属（契约层）✅。
- Dogfood：纯 worktree 改动无法走 live MCP（live MCP 打 runtime，非本 worktree code）；**端到端 dogfood 替身 = route-level 测试**——`proposal-project-path.test.js` 经真 Fastify route（propose callback → approve user route）→ 真 store → 断言 `thread.projectPath` = canonical override；`redis-proposal-store-finalize.test.js` dogfood store 持久化。
- Failure-mode：projectPath 三态（valid/invalid/omitted）propose + approve 两侧对称覆盖。

### 测试结果（本轮真实运行）

```
pnpm --filter @cat-cafe/api test         → 13764 passed, 0 failed, 4 skipped（skip=无 REDIS_URL 的 redis 测试）
  └ test:redis (isolated, redis-proposal-store-finalize) → 2 passed（含 revert-to-red 证明有齿）
pnpm --filter @cat-cafe/mcp-server test  → 254 passed, 0 failed
pnpm biome check（12 changed files）      → 0 errors（23 pre-existing warn：handler complexity / let thread / line96 optionalChain）
pnpm --filter @cat-cafe/{shared,api,mcp-server} build → tsc exit 0
```

### 相关文档

- Feature: `docs/features/F128-cat-create-thread.md`（Phase Z）
- 改动文件（15）：propose/approve routes + 2 新 helper + ProposalStore(inmem+redis) + shared type + callback-tools + SystemPromptBuilder + 3 测试文件 + F128 doc

---
[宪宪/Opus-4.8🐾]
