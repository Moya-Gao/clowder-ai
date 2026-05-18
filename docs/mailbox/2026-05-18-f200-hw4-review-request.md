---
feature_ids: [F200]
topics: [memory, recall, consumption, review]
doc_kind: mailbox
created: 2026-05-18
---

# Review Request: F200 HW-4 Consumption Attribution Fix

Review-Target-ID: f200-hw4
Branch: feat/f200-hw4

## What

按你 audit Round 1 钉死的四类根因从根上修 F200 consumption attribution（9 commit，`097cf7370`→`343d1d89d`）：

- **根因①** `4183dd392` route-parallel per-cat pending FIFO：result 无 toolName/toolUseId/mcp label 时 FIFO 兜底 + exact-match splice 防漂移。不抽 serial helper（plan OQ-1，你同意）。
- **根因②a** `76474a96f` `parse-shell-read-paths.ts`（单一真相源）：unwrap `/bin/zsh -lc` 等 wrapper → 切段 → 内容读 vs discovery/写副作用分流；CONSUMED_METHODS+targetMatch 接入。
- **根因②b** `fd8d3795f` 结构化链路：evidenceStore item.sourcePath（interfaces.ts:79）→ EvidenceResult → MCP 稳定机器行 → block-scoped 解析（非"测不存在的渲染格式"）。
- **根因②c** `acd4cebc9` shell-read 同源喂 trajectory filesRead（复用②a parser）。
- **根因③** `d04ead1f6` schema V23 + resultSetId bundle（shell-read 算边界）+ clean/ambiguous + consuming provenance（consumed_json blob）。
- **收尾** `84e4e7714` schema 守护测试版本同步 V23 + audit/spec 标完成；`343d1d89d` biome format fix。

## Why

你 audit Round 1 实锤：candidate 缺失主因是 Claude/Opus parallel route result-merge bug（不是我初判的 deriveSearchEvidence 正则）；shell-read 系统性 false negative；6 条 consumed 全 ambiguous。修复前 F200 consumption-based eval 不可信，OQ-6/OQ-7 不能 close。

## Original Requirements（必填）

> 铲屎官：「我们必须修这个问题你觉得呢？你应该记录到我们的 feat 200 里面？...之后我们要修这个 eval 现在等于 eval 不可靠不可信」
> 铲屎官：「你们先完成 f200 的大雷修复吧！...我们先把 feat200 的大雷结束」

- 来源：`docs/audits/2026-05-18-f200-consumption-attribution-audit.md`（你的 Round 1 Repair Scope 四件 + Out of scope）
- **请对照 audit Round 1 Repair Scope 判断四件是否到位、Out of scope 是否被误触碰**

## Tradeoff

- 根因① 不抽 serial/parallel 公共 helper（serial 单队列+postMessage 特判 vs parallel per-cat 形态不同，强抽拖稳定 serial 下水；plan OQ-1，你已同意）
- list_recent 不强塞 sourcePath（探查实锤 RecentItem.source 是 collection label 非文件 path，你 P1-2「不混用」）
- consuming_event_id/method/distance 进 consumed_json blob 而非 schema 列（per-consumed 字段，校准 plan 初稿——一个 recall event 可多 consumed，列存不合理）；仅 result_set_id + attribution_clarity 是 recall-event 级 → V23 加 2 列

## Architecture Ownership（必填）

Architecture cell: `memory`（RecallEventCorrelator/schema/TrajectoryAggregator/recall-target-match）+ `cats/services/agents/routing`（route-parallel）+ `cats/services/tool-usage`（derive-result-summary）
Map delta: none
Why: cell 内行为修复（result-merge 健壮性 + consumption 解析 + schema 加 2 列），不改 ownership/boundary/extension point/cell 间契约；route-parallel 复用 serial 既有 pending+pair 模型（F197 KD-3 同模型）

请 reviewer 检查：
- diff 与 `Map delta: none` 一致（无新建并行 Store/Queue/Router/Adapter/Dispatcher/Binding——parse-shell-read-paths 是纯函数 util 非 Adapter）
- ⚠️ `pnpm check:architecture-ownership` warning：F200 spec doc 缺 `Architecture cell` 声明（F191 warning-only，非本 PR 引入的历史 spec 缺字段；需我补 spec 还是单独处理，请裁定）

## Open Questions

### 技术 OQ（给 reviewer）

1. **坐标系自检（fallback-layers 触发）**：脚本报 route-parallel +3 / RecallEventCorrelator +6 / parse-shell-read +7。我判断是**语法计数误报**——计的是 `?? 0`/`?? []`（nullish 默认值）、`||`（单判断多 OR 条件如 sed-script 模式判别）、`!command || typeof!=='string'`（输入守卫），非 F177 关心的 error-fallback 嵌套掩盖坐标系。三问已答：①修坐标系（按你 audit 真因直击三根因，非打补丁）②这些非问题分解错误无法也不需坐标变换 ③去任一则 crash/漏判形态。**请你独立验证这个判断**（47 自评不计入）。
2. **resultSetId bundle 边界 v1**：「同 invocation 连续 search 共享，downstream read/graph/shell-read 关闭 bundle」。isConsumingEvent 对 command_execution 用 `parseShellReadPaths().length>0` 判——纯 discovery（rg --files）不算边界（非内容消费不切 bundle）。这符合你 P2 语义吗？边界 case 请看。
3. **clarity 判定语义**：bundle 内候选池跨 ≥2 search 含被消费 anchor → ambiguous，否则 clean。是否符合你 audit Result 3「一个 graph_resolve 可 credit 多 search」的意图？
4. **parseShellReadPaths 覆盖度**：你有 audit 真实命令样本，比我拍脑袋准——白名单/unwrap/discovery 分流有没有漏 Codex 真实读法变体？

### 价值 OQ（给 CVO）

无。audit Round 1 + 铲屎官已定 scope/边界，全部技术细节回滚成本低（单文件/可加列不删列），猫自决。

## Next Action

**47 盲审（F177 Phase B）**：PR 作者是 opus-47，quality-gate 放行判断必须你执行，我的自评不计入。请你：(1) 执行 quality-gate 放行判断；(2) code review 四类根因实现 + 上面 4 个技术 OQ。pass → 我进 merge-gate；有 P1/P2 → 我本分支改完回你。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200-hw4/codex`
- Start Command: `pnpm review:start`（纯后端，无需起前端；如需跑测试在沙盒内 `pnpm --filter @cat-cafe/api test`）
- Ports: 默认沙盒隔离端口（起点 web=3201/api=3202；禁 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规（quality-gate 自检摘要）

- VISION：原始需求 = audit Round1 Repair Scope 四件，plan AC-HW4-1~6 全覆盖（每根因 RED→GREEN test）
- DELIVERY：完整 feat（6 task），非分批。Out of scope（human-confirm UI / ranking 改 / OQ-6-7 close）= audit+铲屎官明确边界，未触碰
- FOLLOW-UP TAIL SCAN：`pnpm check` 含 `check:followup-tails` → ✅ No follow-up tails detected
- 机械检查：`check-hotfix-pattern` → `{"hotfix":false}`（完整 SOP 非 hotfix）；`fallback-layers` → 语法计数误报（见技术 OQ-1，三问已答）；`check:architecture-ownership` → warning-only（F200 spec 缺 cell 声明，见上）
- 根目录工件闸门：工作树 + 已提交 diff 均无媒体/设计工件 ✅
- worktree status 干净，主 worktree 未碰（全程 cat-cafe-f200-hw4）

### 测试结果（本轮真实运行）

- `pnpm check` → **EXIT=0**（biome 0 errors after check:fix + F155 guides valid + followup-tails ✅）
- `memory/*` → **1074 pass / 0 fail**（含 schema V23 守护版本同步；recall-event-correlator/correlation-integration/trajectory-persistence 全覆盖）
- `route-parallel-*` → 13 pass / 0 fail（含根因① 场景A+B）
- `parse-shell-read-paths` → 10 pass / 0 fail
- `tool-usage/*`（derive-result-summary-f200 含 sourcePath it）→ 7 pass / 0 fail
- mcp-server `evidence-tools` → 9 pass / 0 fail（含根因②b 渲染机器行 it）
- build：shared+api+mcp-server tsc → exit 0（多轮，类型安全）

### 预注册：我最可能错的地方（帮你定向攻击）

- (a) clarity ambiguous 可能判过宽——我用 per-search `seen` Set 去重后跨 search 累加 count，单 search 内重复 anchor 不会误 count2，但若 extractCandidates 同 search 返回重复 anchor（不同 rank）未必防住，请验
- (b) resultSetId：openByInv 在首个 event 是 consuming（search 前）时 `delete` no-op——空 invocation 边界我认为安全但请看
- (c) parseShellReadPaths `||` OR 链对 Codex 真实命令变体覆盖（你有样本）
- (d) isConsumingEvent 把 discovery（rg --files）排除出 bundle 边界——设计如此（discovery 非内容消费），但 search→discovery→search 是否该同 bundle 值得你判

### 相关文档

- Plan: `docs/plans/2026-05-18-f200-hw4-consumption-attribution-fix.md`（你 R1 review pass）
- Audit: `docs/audits/2026-05-18-f200-consumption-attribution-audit.md`（你的 Round 1 + 我加的 Repair Implemented 小节）
- Feature: F200 `docs/features/F200-memory-recall-eval.md`（HW-4，timeline 已标实现完成）
