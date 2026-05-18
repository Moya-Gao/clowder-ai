---
feature_ids: [F200]
topics: [memory, recall, consumption, attribution]
doc_kind: plan
created: 2026-05-18
---

# F200 HW-4 Consumption Attribution Fix Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md`
**Goal:** 修复 F200 consumption attribution 三类根因，让 consumed/candidates 数据可信，可作为 OQ-6/OQ-7 排序决策裁判（修复前不可信）
**Acceptance Criteria:**（从 spec HW-4 + audit Round 1 Repair Scope 转写）
- AC-HW4-1: Claude/Opus 并行路径下，`tool_result` 无 result-side `toolName`/`toolUseId`/mcp label 时，仍能把 result-side summary（含 `_f200Candidates`、`resultCount`、`_resultMerged`）merge 回原 `tool_use` 事件
- AC-HW4-2: `search_evidence` / `list_recent` 的 `_f200Candidates` 携带 `sourcePath`，路径型后续 read 可按 path 匹配（不止 anchor）
- AC-HW4-3: `command_execution` 里的安全只读 shell 命令（`sed`/`nl`/`cat`/`rg`）被解析为文件 read targets，喂入 `RecallEventCorrelator` consumption **和** trajectory `files_read_json`
- AC-HW4-4: recall_events 携带消费 provenance（consuming event id / method / distance）+ bundle/result-set marker，区分 clean per-result consumption vs ambiguous coverage-bundle consumption
- AC-HW4-5: 回归测试覆盖：tool_result 有 result text 但无 result-side tool name（根因①核心 fixture）
- AC-HW4-6: 全部既有 F200 测试不回归（`test/memory/recall-event-correlator.test.js`、`test/tool-usage/derive-result-summary-f200.test.js`、`test/memory/recall-correlation-integration.test.js`、`test/memory/f200-trajectory-persistence.test.js`）

**Architecture cell:** `memory`（RecallEventCorrelator/schema/TrajectoryAggregator）+ `cats/services/agents/routing`（route-parallel）+ `cats/services/tool-usage`（derive-result-summary）
**Map delta:** none
**Map delta why:** cell 内行为修复（result-merge 健壮性 + consumption 解析 + schema 加列），不改 ownership / boundary / extension point / cell 间契约。route-parallel 复用 route-serial 已有的 pending+pair 模型（F197 KD-3 同一模型），不引入新概念
**Architecture:** 根因①在 `route-parallel.ts` 引入 per-cat pending-tool FIFO（参考 `route-serial.ts:197-227` `consumePendingToolResult`，但多猫并发需 `Map<catId,string[]>`），result 推不出 toolName 时 FIFO 兜底；根因②扩 `RecallEventCorrelator` 消费方法集 + 新增 shell-read 路径解析，同源喂 trajectory；根因③ schema 加 provenance/bundle 列 + 同 invocation search 归 resultSetId + clean/ambiguous 标记
**Tech Stack:** TypeScript, better-sqlite3, node:test, 现有 versioned schema migration（`schema_version` 表 + `SCHEMA_Vxx` 常量）
**前端验证:** No（纯后端 telemetry substrate；Recall sidebar 数据准确性提升但无 UI 改动）

---

## Straight-Line Check (A→B, No Detour)

**B 定义（一句话）**：F200 telemetry substrate 可信——candidates 不因 route-merge 丢失、shell-read 算消费、归因可区分 clean/ambiguous。

**Out of scope（audit Round 1 明确，不做）**：
- explicit human "I used this result" 确认 UI
- 基于 consumption metrics 的 ranking policy 改动
- OQ-6/OQ-7 close 决策（本批是修 substrate，不是用它做决策）

**Terminal schema（最终形态，步骤围绕它，非脚手架）**：

```typescript
// 根因① route-parallel.ts — per-cat pending FIFO（新增，不动 serial）
const pendingToolResultsByCat = new Map<string, string[]>();
// tool_use:  pendingToolResultsByCat.get(catId)?.push(normalizedToolName)
// tool_result 推不出 toolNameCandidate 时:
//   const q = pendingToolResultsByCat.get(catId); toolNameCandidate = q?.shift()

// 根因②a/c RecallEventCorrelator.ts — 消费方法扩展
const CONSUMED_METHODS = new Set([...既有, 'command_execution']);
// 新增纯函数（Task 2/4 共用，单一真相源）：
export function parseShellReadPaths(command: string): string[]
//   解析 sed -n '..p' FILE / nl -ba FILE / cat FILE / rg ... FILE
//   只认只读命令；忽略管道写、重定向、rm/mv 等

// 根因②b derive-result-summary.ts — 候选带 sourcePath
type F200Candidate = { anchor: string; rank: number; docKind?: string; sourcePath?: string };

// 根因③ schema.ts SCHEMA_V<next> + recall_events 加列
//   consuming_event_id TEXT, consuming_method TEXT, consuming_distance INTEGER,
//   result_set_id TEXT, attribution_clarity TEXT  -- 'clean' | 'ambiguous'
// ConsumedEntry 扩展: { ...既有, consumingEventId?, distance?, clarity?: 'clean'|'ambiguous' }
```

**三问检验**（每个 Task 均通过）：
- 输出留存最终系统、只扩展不重写？→ 是（per-cat FIFO / parseShellReadPaths / schema 列 / clarity 标记都是终态结构）
- 每步可测？→ 是（每 Task 都有 node:test 断言）
- 删掉该步到 B 的代价？→ Task1 删=59% 候选继续丢；Task2/4 删=Codex 工作流系统性漏报；Task3 删=路径匹配残缺；Task5 删=OQ-6/7 拿重复/歧义正例做决策

---

## Task 1: 根因① — route-parallel per-cat pending FIFO

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts:636-710`
- Reference (不改): `packages/api/src/domains/cats/services/agents/routing/route-serial.ts:197-227,708,863,869`
- Test: `packages/api/test/route-parallel-result-merge-fifo.test.js`（新建）

**Step 1: 写失败测试**（两个场景必须都覆盖）：
- **场景 A（核心 — AC-HW4-5）**：parallel route 收到 `tool_use(search_evidence, catId=opus)` 后收到无 toolName 的 `tool_result`（result text 有 `Found 5 result(s)` + anchor 行），断言 `toolEventLog.updateSummary` 被调用且 summary 含 `_f200Candidates`/`resultCount`。
- **场景 B（队列漂移 — 砚砚 review 补强）**：同 cat 连续 `tool_use(search_evidence)` + `tool_use(graph_resolve)`，先回来一个**带 toolName=graph_resolve** 的 result（exact match），再回来一个**无 toolName** 的 result。断言：exact-match 的 graph_resolve result 命中后必须从该 cat FIFO 队列 splice 掉 `graph_resolve`（不是只 shift 队头），否则后面无名 result 会错配成 graph_resolve（应配 search_evidence）。

**Step 2: 跑测试确认失败** — `node --test test/route-parallel-result-merge-fifo.test.js`，Expected: 场景 A FAIL（当前 L693 `if (toolNameCandidate)` 推不出 → 整块跳过，updateSummary 不调用）；场景 B FAIL（无 FIFO 队列，无 splice 逻辑）

**Step 3: 最小实现** — route-parallel.ts：
- 在 stream 循环外声明 `const pendingToolResultsByCat = new Map<string, string[]>();`
- `tool_use` append 块（L632 附近）后：`if (msg.catId) { const q = pendingToolResultsByCat.get(msg.catId) ?? []; q.push(normalizedToolName); pendingToolResultsByCat.set(msg.catId, q); }`
- `tool_result` 块 L692-693 改为三分支（顺序敏感）：
  1. `toolNameCandidate` 已推出（toolName/mcp label/command:）→ 用它，**且从该 cat 队列 splice 掉首个匹配该名的项**（`const q=pendingToolResultsByCat.get(catId); const i=q?.findIndex(n=>n===normalizedName); if(i>=0) q.splice(i,1)`）—— 防队列漂移（砚砚 review 点）
  2. 推不出但有 catId → `toolNameCandidate = pendingToolResultsByCat.get(catId)?.shift()`（FIFO 兜底）
  3. 仍无 → 维持现状跳过（无 pending 可兜，记 debug log）

**Step 4: 跑测试确认通过**

**Step 5: 既有 parallel 测试不回归** — `node --test test/route-parallel-*.test.js`

**Step 6: Commit** — `feat(F200): parallel route per-cat pending FIFO for result-merge (HW-4 根因①)`

> **技术 OQ-1**（自决）：是否抽 `consumePendingToolResult` 为 routing 公共 helper 供 serial+parallel 共用？决定：**不抽**。serial 单队列 + postMessage 特判逻辑与 parallel per-cat 纯 FIFO 形态不同，强行抽象会把 serial 已稳定路径拖进回归风险。parallel 内独立 per-cat 实现，注释指向 serial 作同源参考。回滚成本低（单文件）。

## Task 2: 根因②a — shell-read 进 consumption

**Files:**
- Create: `packages/api/src/domains/memory/parse-shell-read-paths.ts`
- Modify: `packages/api/src/domains/memory/RecallEventCorrelator.ts:10-18,161-185`
- Test: `packages/api/test/memory/parse-shell-read-paths.test.js`（新建）+ 扩 `test/memory/recall-event-correlator.test.js`

> **砚砚 P1-1 修正**：audit 的真实 `command_execution` 不是裸命令，是 zsh wrapper：
> `/bin/zsh -lc "sed -n '1,260p' docs/features/F200-memory-recall-eval.md"`，还有
> `/bin/zsh -lc 'rg ...'`、多段 `sed/nl`。裸命令做 RED 会 false-green（首 token
> `/bin/zsh` 直接漏掉、有 `&&`/pipe 又返回空 → 修完仍漏 Codex shell-read 根因）。

**Step 1: 写失败测试（RED 必须用 audit 原始命令样本，不用裸命令）**：
- `parseShellReadPaths(`/bin/zsh -lc "sed -n '1,260p' docs/features/F200-memory-recall-eval.md"`)` → `['docs/features/F200-memory-recall-eval.md']`
- `parseShellReadPaths(`/bin/zsh -lc 'rg pattern docs/features/F200-memory-recall-eval.md'`)` → 含该 file（`rg pattern FILE` = 内容读取）
- `parseShellReadPaths("bash -lc 'nl -ba docs/x.md'")` → `['docs/x.md']`
- 多段：`/bin/zsh -lc "sed -n 1,80p a.md; sed -n 1,80p b.md"` → `['a.md','b.md']`（unwrap 后逐段解析只读命令）
- **discovery 不算内容消费**：`rg --files docs | rg foo`、`find docs -name '*.md'` → `[]`（这是文件发现，不是读具体文件内容）
- 负例：`/bin/zsh -lc 'rm x'`、`> out`、`mv a b` → `[]`

**Step 2: 跑测试确认失败**（函数未定义）

**Step 3: 最小实现** — 新建 `parse-shell-read-paths.ts`：
1. **先 unwrap shell wrapper**：匹配 `^/(bin|usr/bin)/(ba|z)sh\s+-l?c\s+(['"])(.+)\3$` 提取内层命令串（覆盖 `/bin/zsh -lc`、`bash -lc`、`sh -c`）；无 wrapper 则原串
2. **按 `;` `&&` `|` 切段**，逐段解析；**不是整串遇 pipe 就全丢**（砚砚点）——pipe 段里仍可能有内容读（`sed -n 1,10p f | head`），但纯 discovery 段（`rg --files`、`find`、`ls`）跳过
3. **白名单内容读命令**：`sed`/`nl`/`cat`/`head`/`tail`/`less`/`bat` + `rg PATTERN FILE`（有具体 file 操作数）；**排除 discovery 形态**：`rg --files`、`rg -l/--files-with-matches`、`find`、`ls`、`grep -rl`
4. 每段提取非 flag / 非 pattern 的路径态参数；写副作用 token（`>` `>>` `rm` `mv` `tee` `cp -`）该段返回 `[]`

**Step 4: 跑测试确认通过**

**Step 5: 接入 RecallEventCorrelator** — `CONSUMED_METHODS` 加 `'command_execution'`；`findConsumed` L166：`command_execution` event 时 `parseShellReadPaths(summary.command)` → 对每个 path 与 `cand.targetRef`（doc/sourcePath kind）匹配，命中记 `method:'command_execution'`

**Step 6: 写 correlator 集成测试** — search 候选含 sourcePath，后续 `command_execution` sed 读该文件 → consumed 命中

**Step 7: 跑测试 + 既有 correlator 测试不回归**

**Step 8: Commit** — `feat(F200): parse safe shell reads into consumption (HW-4 根因②a)`

## Task 3: 根因②b — 候选带 sourcePath

> **砚砚 P1-2 修正**：当前生产链路**根本没有 sourcePath 字段**——`packages/api/src/routes/evidence.ts:169` 组装 `EvidenceResult` 时没有 `sourcePath`；`packages/mcp-server/src/tools/evidence-tools.ts:175` 只打印 `anchor/type/...` 不打 path。所以"解析渲染文本里可能有的 sourcePath 行"是测一个**不存在的格式**，不是修生产链路。Task 3 必须改结构化链路，不是解析。

**Files:**
- Modify: `packages/api/src/routes/evidence.ts:169`（`EvidenceResult` 组装加 `sourcePath`）
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:175`（MCP response 渲染稳定机器行 `sourcePath: <path>`）
- Modify: MCP response type 定义（`EvidenceResult`/对应 shared type 加 `sourcePath?: string`）
- Modify: `packages/api/src/domains/cats/services/tool-usage/derive-result-summary.ts:72-84,166-185`（解析新增的稳定机器行）
- Modify: `packages/api/src/domains/memory/RecallEventCorrelator.ts:112-143`（确认 extractCandidates 透传 sourcePath，inferTargetRef 已支持）
- Test: 扩 `derive-result-summary-f200.test.js` + 新增 evidence route / mcp-server 渲染测试

**Step 1: 探查（必要前置）— 已完成，结论**：
- `interfaces.ts:79` evidenceStore.search 返回 item **已有 `sourcePath?: string`**；缺口仅在 `evidence.ts:169` 组装 `EvidenceResult` 时没透传 + `EvidenceResult`/MCP type 无该字段。→ 链路：item.sourcePath 透传 → 类型加字段 → MCP 渲染机器行 → 解析。
- `list_recent` 的 `RecentItem`（recent-tools.ts:35-42）只有 `source: string`，渲染成 `[source: <label>]`，是 **collection/source label 不是文件 path**，无文件 path 数据源。→ 砚砚 P1-2「不混用」：**list_recent 这轮不强塞 sourcePath**，其候选匹配仍靠 anchor。Task 3 收敛到 search_evidence 链路（audit 大头 65/109 无候选即此）。

**Step 2: 写失败测试** — 端到端 fixture：evidence route 返回的结果含 `sourcePath` → MCP 渲染出 `sourcePath:` 机器行 → `deriveSearchEvidence` 解析出 `_f200Candidates[0].sourcePath`。RED 在「EvidenceResult 无 sourcePath」处先失败。

**Step 3: 跑测试确认失败**

**Step 4: 改结构化链路（自底向上）**：
1. `evidence.ts:169` `EvidenceResult` 加 `sourcePath`（从 anchor→doc path 映射取，Step 1 探查确认来源）
2. shared/MCP response type 加 `sourcePath?: string`
3. `evidence-tools.ts:175` 渲染加稳定机器行 `sourcePath: <path>`（与 `anchor:` 同块，固定格式便于解析）
4. `deriveSearchEvidence`/`deriveListRecent` 解析该机器行写入 `_f200Candidates[].sourcePath`（list_recent 仅当 Step 1 确认 source 是真 path 才接；是 label 则不强塞）
5. `extractCandidates` 透传 `c.sourcePath` 给 `inferTargetRef`

**Step 5: 跑测试确认通过**

**Step 6: 既有 derive-result-summary / evidence route / mcp-server 测试不回归**

**Step 7: Commit** — `feat(F200): EvidenceResult.sourcePath structured chain, not text-parse (HW-4 根因②b)`

## Task 4: 根因②c — shell-read 同源喂 trajectory filesRead

**Files:**
- Modify: `packages/api/src/domains/memory/TrajectoryAggregator.ts`（files_read_json 聚合处）
- Test: 扩 `packages/api/test/memory/f200-trajectory-persistence.test.js`

**Step 1: 写失败测试** — invocation 有 `command_execution` sed 读文件 → `task_trajectories.files_read_json` 含该路径

**Step 2: 跑测试确认失败**

**Step 3: 最小实现** — TrajectoryAggregator 聚合 filesRead 时，对 `command_execution` event 调 `parseShellReadPaths`（复用 Task 2 单一真相源）并入 files_read 集合

**Step 4: 跑测试确认通过 + 既有 trajectory 测试不回归**

**Step 5: Commit** — `feat(F200): shell reads feed trajectory filesRead (HW-4 根因②c)`

## Task 5: 根因③ — ambiguity-aware attribution + resultSetId

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`（新 `SCHEMA_V<next>` + migration apply 点）
- Modify: `packages/api/src/domains/memory/RecallEventCorrelator.ts`（insertStmt 列 + correlateWindow 归 bundle + clarity 判定）
- Modify: `packages/api/src/domains/memory/recall-correlation-hook.ts`（透传新字段）
- Modify: `packages/api/src/domains/memory/f200-types.ts`（ConsumedEntry/RecallEvent 扩字段）
- Test: 扩 `test/memory/recall-event-correlator.test.js` + `test/memory/recall-correlation-integration.test.js`

**Step 1: 探查（必要前置）— 已完成，结论**：`applyMigrations(db)` 顺序 `if (currentVersion < N) { ...; INSERT schema_version N }`，最高版本 **V22**，**V23** 是下个；`V21` L602 `try { db.exec('ALTER TABLE recall_events ADD COLUMN shadow_ranking_json TEXT') } catch {}` 是加列范例（try/catch 幂等）；apply 位置 = applyMigrations 末尾 V22 块后。**校准**：consuming_event_id/method/distance 是 per-consumed-entry provenance → 存 `consumed_json` blob（无需 schema 列）；仅 `result_set_id` + `attribution_clarity` 是 recall-event 级 → V23 加 2 列。

**Step 2: 写失败测试**（含砚砚 P2 交错场景）：
- 基础：同 invocation 两个 search 在首个 downstream read 前 → 共享同一 `result_set_id`；read 命中重叠候选池 → `attribution_clarity='ambiguous'`；单 search 唯一匹配 → `'clean'`
- **P2 交错（砚砚补）**：`search A → shell-read(命中A候选) → search B → shell-read(命中B候选)`，断言 A、B **不被错并成同一 bundle**（read 已介入则 B 起新 result_set），A 的消费归 A、B 归 B，不混锅。
- **downstream 必须包含 Task 2 解析出的 shell-read**（砚砚点：bundle 边界判定的 "downstream read" 不能只认 Read/Grep，要认 `command_execution` shell-read，否则 Codex 全 shell-read 工作流永远判不出 bundle 边界）

**Step 3: 跑测试确认失败**

**Step 4: schema 迁移** — `schema.ts` 加 `SCHEMA_V<next>`：`ALTER TABLE recall_events ADD COLUMN consuming_event_id TEXT` 等 5 列；migration apply 列表注册新版本

**Step 5: correlateWindow 归 bundle** — 同 invocation 在首个 downstream read/graph 前的 searches 分配同一 `resultSetId`；`findConsumed` 记 `consumingEventId`/`distance`；clarity 判定：候选池跨 search 唯一→clean，重叠/bundle 级→ambiguous

**Step 6: 持久化新字段** — insertStmt + persistBatch + hook 透传

**Step 7: 跑测试确认通过 + 全 F200 测试不回归**

**Step 8: Commit** — `feat(F200): ambiguity-aware attribution + resultSetId (HW-4 根因③)`

## Task 6: 收尾验证

**Step 1:** 全 F200 相关 suite 绿（route-parallel/serial + memory/* + tool-usage/*）
**Step 2:** `pnpm --filter @cat-cafe/api lint`（tsc --noEmit）+ `pnpm check`
**Step 3:** 更新 `docs/audits/2026-05-18-f200-consumption-attribution-audit.md` 标 Round 1 Repair 完成 + `docs/features/F200-memory-recall-eval.md` HW-4 状态推进
**Step 4:** Commit + 进 quality-gate

## Open Questions

| # | 类型 | 问题 | 处理 |
|---|------|------|------|
| OQ-1 | 技术 | parallel/serial pending 是否抽公共 helper | 自决：不抽（见 Task 1 注），回滚成本低 |
| OQ-2 | 技术 | ~~渲染文本是否含 sourcePath~~ | ✅ resolved（砚砚 P1-2 实锤生产链路无此字段）→ Task 3 改结构化链路，不解析。Step 1 探查 list_recent source 是 label 还是 path |
| OQ-3 | 技术 | resultSetId 归组边界=首个 downstream read/graph 前 | 按 audit Round 1 Result 3 建议 v1；downstream **含 Task 2 shell-read**（砚砚 P2）；Task 5 测试交错场景校验 |

无价值 OQ（不需 CVO）：本批是 audit 已拍板的 substrate 修复，scope/边界 audit Round 1 + 铲屎官已定，全部技术细节猫自决，回滚成本均为低（单文件/可加列不删列）。

## 下一步

→ 加载 `tdd`，按 Task 1→6 顺序 red-green-refactor。Reviewer：跨族 @codex（砚砚是 audit owner，最懂归因语义，跨族优先）。
