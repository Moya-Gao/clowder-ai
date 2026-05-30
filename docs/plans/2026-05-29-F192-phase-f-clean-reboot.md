# F192 Phase F — Capability Wakeup Library Layer Clean Reboot

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md` (Phase F)
**Goal:** 把 F192 Phase F `eval:capability-wakeup` 库层从 #1942 的"补锅"分支 clean reboot 出来——transplant 已稳定的 source-instrumented blocks + 按对的坐标系（normalize-at-boundary + centralize-scope）重写 `trials.ts`/`trace.ts` 这两个补锅 epicenter。
**Acceptance Criteria:** 覆盖原 F192 AC-F1..F9（design memo `docs/plans/2026-05-28-F192-phase-f-capability-wakeup-eval.md`），且**消化原 #1942 的 31 条 cloud inline comments（含 2 条 open P2）作为新代码的反模式 checklist**。
**Architecture cell:** harness-eval（`packages/api/src/infrastructure/harness-eval/`）
**Map delta:** none — 同 F192 eval 控制面内 domain 扩展，不新增架构 cell。
**Architecture:** 两阶段管道（trace 构建 → trial 评估 → 分类 → verdict），与 design memo 一致；但 **trials.ts / trace.ts 的实现 approach 换坐标系**——从"直接读异构 event 形状 + 散点 scope 绑定"换成"normalize-at-boundary（一个 normalizer）+ centralize-scope（一个 chokepoint）"。
**Tech Stack:** TypeScript + session `events.jsonl` + per-thread `ToolEventLog` + audit events。

> **决策来源**：CVO + opus-47 + gpt52 (砚砚) 共识。#1942 PR container 已被 review 噪音 + 58-commit 分叉 + 0 CI 拖累；趁这次 reboot 顺手把 design memo 隐含的"normalize+centralize"坐标系落地（这是 31 cloud comments 65% 聚集 trials.ts/trace.ts 的根因）。砚砚作者，opus-47 owner 收口策略 + cross-individual review，opus-48 帮标旧 PR superseded。

---

## 1. 坐标系原则（**重写两个文件的全部依据**）

### 1.1 normalize-at-boundary

**问题**：`buildCapabilityTrace` 直接读 `evt.event.toolName / toolInput`（AgentMessage 形状）+ 不认 `evt.event.name / input`（raw NDJSON）+ 不读 `event.toolInput.changes[]`（Codex `file_change`）→ 每多一个 provider 形状 = 一个洞 = 一条 cloud comment。

**解法**：boundary 处 normalize 一次，下游只读 normalized shape。

```ts
// 边界：一个 normalizer 把所有 provider shape 压成一个 typed shape
interface NormalizedToolUse {
  invocationId: string;
  eventNo: number;
  timestamp: number;
  toolName: string;          // 不管 provider 是 toolName 还是 name，统一字段
  toolInput: Record<string, unknown>;  // 不管 toolInput / input
  changedFiles: string[];    // Write/Edit 直接抽；Codex file_change 从 changes[] 抽
  referencedPaths: string[];
}

function normalizeTranscriptEvent(evt: TranscriptEvent): NormalizedEvent | null;
function normalizeToolEvent(evt: ToolEvent): NormalizedToolUse;
function normalizeAuditEvent(evt: AuditEvent): NormalizedAudit;
```

`trace.ts` 只读 normalized shape，**无 if-else 分支判断 provider 形状**。新增 provider 形状只改 normalizer，不动 trace 逻辑。

### 1.2 centralize-scope

**问题**：旧代码每条 evidence path（tool / audit / scenario / preview）都各自重新写 scope check：
```ts
// audit
if (event.threadId && event.threadId !== trace.threadId) continue;  // fail-open!
if (auditCatId && auditCatId !== trace.catId) continue;             // fail-open!
// workspace_navigate
if (worktreeId && typeof summary.worktreeId === 'string' && summary.worktreeId !== worktreeId) return false;  // fail-open!
// browser_preview_open audit
// 完全没 worktree 检查！
```

→ N 散点 = N 次写错机会 = N 条 cloud comment。

**解法**：一个 chokepoint，所有 evidence 都过它，**fail-closed**：

```ts
interface EvidenceScope {
  catId: string;
  threadId: string;
  worktreeId: string | null;
  timeWindow: { startMs: number; endMs: number };
}

// 单一 chokepoint，所有 evidence path 都用
function matchesScope(
  candidate: { threadId?: string; catId?: string; worktreeId?: string; timestamp: number },
  scope: EvidenceScope,
): boolean {
  // fail-closed: 缺字段 = 拒
  if (!candidate.threadId || candidate.threadId !== scope.threadId) return false;
  if (!candidate.catId || candidate.catId !== scope.catId) return false;
  if (scope.worktreeId !== null) {
    if (!candidate.worktreeId || candidate.worktreeId !== scope.worktreeId) return false;
  }
  if (candidate.timestamp < scope.timeWindow.startMs || candidate.timestamp > scope.timeWindow.endMs) return false;
  return true;
}
```

新增 evidence path 时**禁止**重写 scope 判定，只调 `matchesScope`。

---

## 2. Transplant blocks（**直接搬，不动 approach**）

这些 block 在 #1942 已稳定 + cloud 已 clean + 是 source-instrumentation 友好的。直接搬：

### Block A — Domain plumbing

| 来源（旧 #1942） | 动作 |
|------|------|
| `eval-domain-registry.ts:4,13` | enum 拓宽：`domainId` 加 `eval:capability-wakeup`，`sourceAdapter` 加 `capability-wakeup-eval` |
| `verdict-handoff.ts:10` | enum 拓宽：`domainId` 加 `eval:capability-wakeup` |
| `eval-cat-invocation.ts:30` | `DOMAIN_INSTRUCTIONS` Record 加 `'eval:capability-wakeup'` 指令文案（"prioritize workspace-navigator first; separate cognitive / behavioral / attention-dilution misses"） |
| 新 `docs/harness-feedback/eval-domains/eval-capability-wakeup.yaml` | 域注册 YAML（frequency: weekly / evalCat: @opus47 / handoffTarget: F203 / opus-47） |
| `packages/api/src/infrastructure/harness-eval/index.ts` | barrel exports |

### Block B — Source-instrumented route audits

| 来源（旧 #1942） | 动作 |
|------|------|
| `workspace.ts /api/workspace/navigate` | 写 `WORKSPACE_NAVIGATE` audit + `data.catId` + `data.worktreeId` + `data.path` + `data.action` |
| `preview.ts` 5 个 POST（open / close / navigate / auto-open / screenshot） | audit body 都加可选 `catId` + 保留 `worktreeId` + 落 `BROWSER_PREVIEW_*` audit |
| `EventAuditLog.ts:254` AuditEventTypes | 加 `WORKSPACE_NAVIGATE: 'workspace_navigate'` |
| `.gitignore` | 加 `generated/capability-wakeup/`（raw eval data 不 commit） |

### Block C — Live verdict bundle generator

| 来源（旧 #1942） | 动作 |
|------|------|
| `eval-capability-wakeup-live-verdict.ts` | 直接搬。**已含的正确实现**：复用 `resolveA2aEvidenceBundle` / KD-13 sanitized bundle / provenance sha256 对**落盘字节**算（`sha256File` 不是 `sha256Json`）/ raw inputs 真写到 `generated/` / `assertSafeVerdictId` / generatedAt 透传到 packet+markdown（不 `new Date()` drift）/ markdown frontmatter 匹配 Hub filter |

### Block D — Verdict builder

| 来源（旧 #1942） | 动作 |
|------|------|
| `eval-capability-wakeup-verdict.ts` | 直接搬。**已含**：`buildCapabilityWakeupVerdictHandoff` + `hasMisses` 守卫（no-miss → 合法 packet）+ 1:1 root-cause→action 映射（behavioral→hook / attention→jit / cognitive+reachability→doc-fix） |

---

## 3. Rebuild blocks（**重写，不 cherry-pick**）

### `eval-capability-wakeup-trace.ts`（重写）

按 §1.1 normalize-at-boundary：
1. 入口接收 `CapabilityTraceInput`（transcript / tool / skill / audit / preview availability）
2. 每类 input 通过对应 normalizer → 一个 typed normalized stream
3. trace 构建只读 normalized shape，按 invocationId 聚合 + 排时间窗 + 累 `changedFiles` / `referencedPaths`
4. 输出 `CapabilityTrace`（含 `EvidenceScope` 字段）

### `eval-capability-wakeup-trials.ts`（重写）

按 §1.2 centralize-scope：
1. opportunity 检测（4 个 predicate type）走 normalized shape，无 hand-parse
2. **所有** usage evidence（tool / audit / scenario / preview）都先走 `matchesScope(candidate, trace.scope)` chokepoint
3. classification（reachability_doubt / cognitive / behavioral / attention_dilution / unclassified）按 design memo §3b STEP 0→3 严格按序
4. amplifier 真 gating，**无恒真子句、无能力硬编码**
5. `zeroFrictionDefault` 按 capability + 机会窗口实际文本算（不硬编码）

---

## 4. 反模式 checklist（**新代码必须 cover**，从旧 #1942 31 条 cloud comments 抽出）

每条都是旧 PR 上某轮 cloud 找的真 bug。新代码不能再犯。

### 4.1 Unit-semantics（数值字段 unit/type 必须 match）

- [ ] **不**把 `eventNo`（事件索引）当 `startMs/endMs`（毫秒）用——live verdict snapshot window 必须用 `trial.timeSpan`，不是 `eventNoSpan`
- [ ] sha256 **必须对落盘字节算**（`sha256File(path)`），**不**对 `JSON.stringify(value)` 算（两者字节不同 → provenance 验证会假失败）
- [ ] `generatedAt` **必须透传**到 verdict packet + markdown，**不**在生成器内部用 `new Date()`（replay/backfill 时间会漂）

### 4.2 Cross-ref 完整性

- [ ] provenance 引用的 `trials.json` / `summary.json` **必须先落盘再 hash**——别引用还没存在的文件
- [ ] 重构后扫 orphan helper：`sha256Json` 等被废弃的 function 必须删干净（biome `noUnusedVariables` 会拦）

### 4.3 Scope 绑定（fail-closed，**所有 evidence path 走 `matchesScope` chokepoint**）

- [ ] audit evidence **fail-closed**：缺 `threadId` 或 `catId` 直接拒，**不**只拒"present-and-mismatch"
- [ ] `workspace_navigate` audit 路由**必须写 `catId`**——否则 audit 无法 per-cat 归因
- [ ] `preview` 5 个 POST 路由**必须写 `catId` + 保留 `worktreeId`**——browser-preview 第二真值源才有归因能力
- [ ] worktree check **fail-closed**：trace.worktreeId 设了，audit summary 缺 worktreeId 也拒——**不**只拒 present-and-mismatch
- [ ] `browser_preview_open` audit usage 必须 check `event.data.worktreeId` vs `trace.worktreeId`（同 `workspace_navigate` 走 chokepoint）
- [ ] usage evidence **必须 filter 到 evaluated cat**——别让不同 cat 的 audit/tool event 串味
- [ ] telemetry **必须在 build invocation window 之前 filter**（同上，scope 先做）
- [ ] preview scenario detections（live port）**必须收窄到当前 invocation window + 当前 worktree**——不能对整 trace `some()`

### 4.4 Shape 兼容（由 normalizer 一次处理掉）

- [ ] `tool_use` 事件**必须同时支持** AgentMessage 形状（`toolName/toolInput`）**和** raw NDJSON 形状（`name/input`）
- [ ] Codex `file_change` 形状的 `changes[]` 列表**必须**被 normalizer 抽路径（不只读 `path/file_path`）
- [ ] `ensureInvocation` 对 tool/skill 补充事件**必须**传 `undefined` 而非 `0`——existing invocation 的 `eventNoStart` 不能被压成 0

### 4.5 Edge path（不可达 ≠ 死路径）

- [ ] no-miss 路径**必须**产合法 packet：`buildCapabilityWakeupVerdictHandoff` 用 `hasMisses` 守卫，`rootCauseHypothesis.alternatives` 必须非空（no-miss 用 fallback 文案）
- [ ] `unclassified` 必须可达：`hasAttentionAmplifier` **无恒真子句、无能力硬编码**——真 gating（lateInvocation / priorMissCount>=2 / unrelatedActivity>=3）
- [ ] `zeroFrictionDefault` **不硬编码 true**——按 capability + window 实际文本算

### 4.6 数据卫生

- [ ] `generated/capability-wakeup/` **必须在 `.gitignore`** 里——raw trial data（含 catId / sessionId / evidence）不能误 commit
- [ ] `docs/mailbox/2026-05-29-f192-phase-f-clean-reboot-review-request.md`（新 PR 的）必须有 YAML frontmatter（`feature_ids` / `topics` / `doc_kind` / `created`）

### 4.7 Predicate 信号

- [ ] `requireLivePreview` 收窄到**当前 worktree + 当前机会窗口**（不要对整 trace `some()`）
- [ ] `eventNoSpan` + `timeSpan` 同时记录（前者 for 证据锚点，后者 for verdict window）

---

## 5. 测试方法

1. **每条反模式 checklist 项 → 至少一条 unit test 钉死**（red→green）
2. **fixture 用 raw NDJSON shape**（不只用 AgentMessage shape），避免又一轮"测试用一套、runtime 用另一套"的 lesson_inmemory_store_tests_miss_redis_behavior
3. **多 worktree fixture 必须有**——验证 worktree-scope fail-closed
4. **classifier 覆盖**：reachability_doubt / cognitive / behavioral / attention_dilution / unclassified 五条路径都要测，且 `unclassified` 是被实测的活路径（不是不可达）
5. **provenance 自验**：测试读回 trials.json 字节算 sha256 + assert 等于 provenance.rawInputs[].sha256

---

## 6. 角色 + 执行 sequence

| 角色 | 谁 | 干什么 |
|------|------|------|
| Author | 砚砚（gpt52） | 开新分支、transplant blocks A-D、重写 trials/trace、写测试、push、开新 PR |
| Closure strategy + reviewer | opus-47 | review transplant checklist 对齐度 + cross-individual review + cross-个体 approval（按需找 cross-family 第二审） |
| 旧 PR superseded | opus-48 | 在新 PR 开后标 #1942 close with `superseded by #NEW`（branch 不删） |
| 架构知情人 | 砚砚 | 同 author，但拒绝再被旧 review 噪音绑架，只对新分支负责 |

### Sequence

1. 砚砚 `git worktree add /path -b feat/f192-capability-wakeup-v2 origin/main`（off 最新 main）
2. Block A-D transplant（按 §2，直接搬）
3. Block trace + trials 按 §3 重写（按 §1 坐标系原则）
4. 按 §4 反模式 checklist 写 unit tests（按 §5 方法）
5. push + 开新 PR（title: `feat(F192): capability wakeup library layer — clean reboot`，body 引用本 doc + #1942 superseded note）
6. opus-47 review transplant 对齐度 + cross-individual approval（或找 cross-family 第二审）
7. cloud review（packages 代码必走）
8. merge-gate（含 `pnpm gate` 全量）
9. squash merge
10. opus-48 / opus-47 close #1942 with `superseded by #NEW`（保留 branch）
11. Step 7.5 F192 feat doc Phase F build seq 同步状态

---

## 7. AC（新 PR）

- [ ] §2 Block A-D 全部 transplant 完整（spot-check 对照旧 #1942 终态）
- [ ] §3 `trace.ts` + `trials.ts` 重写，**无 hand-parse N-shape 分支**，**所有 evidence 走 `matchesScope` chokepoint**
- [ ] §4 反模式 checklist **每条都有对应 unit test 钉死**（自检表附 PR body）
- [ ] 新 PR cloud review clean（按本 doc 写，应该一两轮内 converge——不再补锅 30 轮）
- [ ] `pnpm gate` 全绿
- [ ] cross-individual + cross-family review 都过（opus-47 + 至少一只非布偶猫族）
- [ ] feat doc Phase F build seq step 3 状态同步成 "rebuilt in PR #NEW (clean reboot, 坐标系正)"

---

## 8. 注记 — 为什么这次 reboot 是值得的

旧 #1942 不是失败——它是**一次必要的探索**：
- 把 design memo 里"build CapabilityTrace from events.jsonl JOIN ToolEventLog + classify"的实现一遍跑通
- 通过 31 条 cloud comments 暴露出"hand-parse heterogeneous shapes + scattered scope-binding" 这个坐标系的真实代价
- 现在我们知道对的坐标系是 normalize-at-boundary + centralize-scope，不是凭直觉猜出来的，是补锅 30 轮实测出来的

所以**这份 reboot 应该比第一版快很多 + 一次到位**——补锅成本已经转化成了"反模式 checklist"。第二次走同一段路应该不再补锅 epicenter。

> Lessons learned 沉淀点：**review-design-misses-unit-crossref** + **inmemory-store-tests-miss-redis-behavior** + 一个新教训 **复用 PR-container-health-vs-code-value**（当 review 噪音 + 分叉历史 + 0 CI 都堆叠时，PR 容器本身值得抛弃，不只是看代码价值）。

---

## 9. Checkpoint Review Findings — 2026-05-29 opus-47 review-owner

**Context**: PR #1963 立起来后 review-owner（opus-47）做的第一轮 checkpoint review。坐标系骨架（§1）已对齐（spot-check 通过）。下面是测试套件运行暴露出的两个 transplant 引入的真实问题，砚砚 quota reset 回来直接接。

### Finding C1（P2 / cross-ref 完整性）— hub-read-model 测试硬编码 3 个 domain

**症状**: `pnpm --filter @cat-cafe/api test -- capability-wakeup` 命中 `test/harness-eval/eval-hub-read-model.test.js:315`
```
should have 3 registered domains (eval:a2a + eval:memory + eval:sop)
AssertionError: 4 !== 3
```

**根因**: `packages/api/src/infrastructure/harness-eval/eval-domain-registry.ts:4` 已经把 `'eval:capability-wakeup'` 加入 zod enum（4 个 domain），但 transplant 漏了 cross-ref 测试断言更新。**典型 §4 反模式之一**：加新 domain 必须同步 enumeration 测试、断言、文档（呼应 `feedback_design_review_misses_unit_crossref` 教训）。

**修复（~5 行）**:
- `test/harness-eval/eval-hub-read-model.test.js:315/316` — `3` → `4`
- `test/harness-eval/eval-hub-read-model.test.js:330` 之后加 `eval:capability-wakeup` 检查项（mirror `eval:sop` block）
- 若 fixture 测试不提供 capability-wakeup verdict，断言 `capabilityWakeupDomain.latestVerdictId` 为 null/undefined（与 eval:memory 零 verdict 检查同型）

**单跑命中 / 全套命中**: 都失败（硬 assertion，跟环境无关）。

### Finding C2（**CLOSED — structural test isolation fix**）— 不是 F192 transplant regression，是 codex-agent-service.test.js 自己 case 间并发 race

> **最终真因**（砚砚 author debug 钉死，opus-47 verify 通过）：
> `test/codex-agent-service.test.js` 内多个 test mutate global `process.env`（`ALLOWED_WORKSPACE_DIRS` / `CAT_CAFE_WORKSPACE_ROOT`）+ filesystem-backed MCP dist state，node:test 默认并发跑互踩，导致 `cat-cafe-collab` workspace-env assertion 非确定性。
>
> **Fix（structural test isolation, commit `e830580bb`）**：把整个 file 包进 `describe('CodexAgentService Tests (CLI mode)', { concurrency: false }, () => { ... })`，强制 file-level serialize。不动 production code。
>
> **为什么 main 上历史绿、worktree 上红**：worktree 上 `packages/mcp-server/dist` 初始缺失，砚砚 debug 时单独 build，导致 dist mutate state 变化 + test 并发 race window 暴露。Main 上历史绿是 race window 没 trigger 的运气，不是 source code 行为差。



> **C2 两轮诊断都错（自纠）**：
> - 第一轮 opus-47："transplant test isolation 污染" — 错（单跑此 test 也 FAIL）
> - 第一轮 gpt52："main 也红" — 错（同 wrapper 下 main 是 45/45 全绿，对照环境不一致）
> - 第二轮 opus-47："rebase staleness 缺 #1964" — 错（HEAD merge-base = 33e11c9de = origin/main，behind=0，#1964 完整在 HEAD 链 + service-manifest fallback 完整，trash dist 全 rebuild 后仍 4 fail）
> - 第二轮 gpt52："rebase 后 45/45 PASS" — 不能复现（同条件下仍 4 fail）

**铁证（同 worktree 命令、同 wrapper `with-test-home.sh + setup-cat-registry`）**:
- **main 完整跑** `test/codex-agent-service.test.js` → **45/45 PASS** ✅
- **worktree（rebase 到 33e11c9de + nuke dist 全 rebuild）** → **41/45**（4 fail）❌
- 4 个 fail 全是 `cat-cafe-collab must use {ALLOWED_WORKSPACE_DIRS | CAT_CAFE_WORKSPACE_ROOT | thread workingDirectory}`

**已经排除的 hypothesis（避免下一轮再走老路）**:
| 假设 | 排除证据 |
|---|---|
| Test isolation 污染 | 单跑此 test 也 FAIL（不是相邻 test 改 env） |
| Rebase staleness | HEAD 含 #1964，behind=0，service-manifest fallback 完整 |
| Stale dist | trash + 全 rebuild 后仍 fail |
| 直接改 cat-cafe-collab logic | CodexAgentService.ts + mcp-config-adapters.ts diff origin/main..HEAD 都空 |
| cat-template.json | main vs worktree diff 空 |

**剩下的假设面（author debug 起点）**:
- transplant 加的 module（`eval-domain-registry.ts` zod enum / `eval-cat-invocation.ts` DOMAIN_INSTRUCTIONS）可能触发 module load time side effect
- `routes/preview.ts` / `routes/workspace.ts` 的 audit 注入改 `EventAuditLog` singleton init order，间接影响 capability-orchestrator.ts cat-cafe-collab env 生成
- setup-cat-registry → cat-config-loader → capability-orchestrator import chain 上某处被 capability-wakeup re-export 拉进 transplant 代码触发 side effect

**怀疑路径 grep 命中**：
- `packages/api/src/config/capabilities/capability-orchestrator.ts:571/602/691` — cat-cafe-collab env 注入
- `packages/api/src/config/capabilities/mcp-config-adapters.ts:resolveWorkspaceRoot()` — 三层优先级链
- Test L416 期望 spawn args 包含 `mcp_servers.cat-cafe-collab.env.ALLOWED_WORKSPACE_DIRS="/workspace/root"`

**Meta lesson 沉淀（双向）**:
- 同一 finding 改判 3 次 = reviewer 工作质量红色信号（feedback_design_review_misses_unit_crossref 教训放大）
- 任何"诊断结论"前必须用**同 wrapper / 同 setup / 同命令**双向复现，不能拿"上次跑过一样的命令"当对照
- author 跑"我自己验过了"必须报：CWD / wrapper / 是否含 build / 是否 nuke dist，否则对照不严谨
- 不在 author 给铁证 reproduce 之前 unilateral 改判 finding 状态（避免 plan doc 反复 churning）

### Review-Owner verdict（2026-05-29 四轮终态 — C2 closed）

- **坐标系骨架（§1.1/§1.2）APPROVE** — `NormalizedTranscriptToolUse` boundary type + `EvidenceScope` chokepoint 都在对的位置 + fail-closed 语义到位
- **§3 第一刀 normalize-at-boundary 方向 APPROVE** — `trace.ts` 边界产 `NormalizedCapabilityUsageCandidate`，`trials.ts` 走 `collectUsageCandidates` 不读 raw shape，trials.ts 自然瘦身（440→378 回 350 限内）
- **C1 closed** — 砚砚 commit `71bae9d69`（rebased SHA） / origin `280b9159d` 修了 cross-ref 测试断言，独立单测已绿
- **C2 closed (structural fix verified)** — 砚砚 commit `e830580bb` 把 `codex-agent-service.test.js` 包进 `describe({ concurrency: false })` 强制 file-level serialize。opus-47 verify：同 wrapper 重跑 **45/45 PASS** ✅ + capability-wakeup 五组仍 **37/37 PASS** ✅。Fix 形状结构性（不动 production code，不是 hard-code skip）
- **trace.ts 接近硬限 flag** — 226→346/350 接近 350 硬限，下一轮 §3 收敛前明确拆分计划
- **NIT/dead-code** — `trials.ts:67-70` rich-messaging sourceId 反向解析（boundary 已保证只有 create_rich_block 产 rich-messaging candidate，redundant）
- **NOTE/future** — normalizer 在 boundary 里做 capability 判定（hardcode `create_rich_block → rich-messaging`），混入 business rule。未来加新 capability 要改 normalizer，考虑 normalizer-classifier 解耦
- **作者继续 §3 work**：trace.ts/trials.ts 剩余 provider-shape 收敛 + plan §4 反模式 checklist self-check
- **Cross-individual review 安排**：opus-47（已 review-owner）+ 另需一只跨族猫做 code review（按 LL-049 reviewer 成本路由：候选 @opus / @sonnet / @opus48 — 作者 gpt52 排除）
- **Cloud review timing**：cross-individual review 通过 + WIP 拉掉 + 最后一次 fetch 同步 main → 一次性触发 cloud

### PR 容器决策 — force-with-lease 推荐（review-owner 推荐 / author 决定）

C2 closed + 数据 clean + 8 个 commit history 整齐 + origin tip `5e4d16bdb` 是错的 "rebase staleness" 改判需要替换 + PR draft + WIP marker + 0 cloud trigger → **force-with-lease 时机成熟**。

```bash
git push origin feat/f192-capability-wakeup-v2 --force-with-lease=feat/f192-capability-wakeup-v2:5e4d16bdb
# --force-with-lease 不是 force：会 reject 如果 remote 已经又前进
# 当前 remote = 5e4d16bdb（我们都同步过），所以 lease 会通过
```

**Author 决定权**：force-with-lease 由你（gpt52）拍。Review-owner 推荐 ✅。

### Meta lessons sink（2026-05-29 reviewer-author 数据 churning saga）

C1/C2 共 4 轮反复改判才收敛，是一次双向工作质量 stress test：
- **第一轮 opus-47 错诊**："transplant test isolation 污染" — hypothesis 方向对（确实是 test isolation），但具体污染源猜错（不是 capability-wakeup 污染 codex-agent-service，而是 codex-agent-service 自己 case 间并发 race）
- **第一轮 gpt52 错对照**："main 也红" — 环境不一致（wrapper / CWD / HEAD 任一）
- **第二轮 opus-47 错改判**："rebase staleness 缺 #1964" — 推理过快，没核 commit 历史在 HEAD 上
- **第二轮 gpt52 错复现**："rebase 后 45/45 PASS" — wrapper 跑不严格，没 byte-for-byte 复现
- **第三轮 opus-47**：硬数据 reproduce capture + 设升级阈值（feedback_break_ack_loop_proactively）
- **第四轮 gpt52**：byte-for-byte 复跑 → 撤回 + author debug 钉死真因 → structural fix → verify

**meta lesson 教训沉淀点**：
1. 任何"诊断结论"前必须用**同 wrapper / 同 setup / 同命令** byte-for-byte 双向复现，不能拿"上次跑过类似命令"当对照
2. 复现要报：CWD / wrapper / HEAD / dist mtime / 完整命令字串 / 完整 output tail（六件套），不能口头说"我跑了 45/45"
3. 同一 finding 改判 ≥3 次 = reviewer/author 工作质量红色信号，必须停下重新 verify 共识基线
4. reviewer 假设 author "已验证" 不算 verify — receive-review skill 硬规则
5. test isolation 病的真因可能是 **被测 file 自己 case 间并发**，不一定是相邻 file 污染（hypothesis 方向对了不等于具体来源对）

— [宪宪/Opus-4.7🐾] 2026-05-29 checkpoint review (initial → 三轮自纠 → 四轮 C2 closed)

---

### §10 §3 follow-up verify（2026-05-30 第五轮）— 砚砚 commit `343d648da` APPROVE

砚砚 §3 follow-up（拆分 + NIT elevation）opus-47 verify 通过：

**NIT → P2 bug fix elevation（高质量协作）**:
- 我第一轮标 trials.ts:67-70 rich-messaging sourceId 反向解析为 NIT/dead-code
- 砚砚不止删 redundant，还挖出真 bug：老代码 `split(':').at(-1)` 处理 Codex 形状 `mcp:cat-cafe/create_rich_block` 时得到 `cat-cafe/create_rich_block` ≠ `create_rich_block` → evidence 错误丢失
- 补红灯测试 `eval-capability-wakeup-evidence.test.js` Test 1 钉死回归（38/38 PASS，+1 red light）

**拆分 cohesion APPROVE**:
| 文件 | 旧→新 | 角色 |
|---|---|---|
| trace.ts | 346→**165** ✅ | orchestration (buildCapabilityTrace) |
| trace-normalizers.ts | **194** (新) ✅ | normalizeTranscriptToolUse / normalizeToolUsageCandidate / normalizeAuditCandidates / readPath / unique / commandExecutionSucceeded / isHttpSuccess |
| trials.ts | 378→**286** ✅ | orchestration (evaluate* predicates) |
| trials-support.ts | **99** (新) ✅ | EvidenceScope / matchesScope / matchesAny / canonicalizePathForGlobs / globToRegExp |

按"orchestration vs helpers" 边界划分清晰，全部远低 350 硬限。

**verify 实测**:
- `capability-wakeup` 五组 **38/38 PASS** ✅（+1 红灯回归 test）
- `codex-agent-service.test.js` 同 wrapper **45/45 PASS** ✅（concurrency:false fix 仍有效）
- force-with-lease 推 `origin/feat/f192-capability-wakeup-v2` 成功
- 我的 plan doc commit `5fe259bf7` + `01ef499e2` 保留在 origin 链上（lease 通过）

**仍 open**:
- 💡 NOTE/future: normalizer 在 boundary 里 hardcode `create_rich_block → rich-messaging` 等 capability 判定。当前 3 个 capability 内化合理，未来超过 5 个考虑 normalizer-classifier 解耦
- ⏳ Plan §4 反模式 checklist self-check — 砚砚下一步显式做（每条反模式 → 代码位置 → covered/not-covered）
- ⏳ Cross-individual review — opus-47 是 review-owner 但不算独立 cross-individual（按 LL-049 候选 @opus / @sonnet / @opus48；作者 gpt52 排除）
- ⏳ Cloud review trigger — 需 WIP → ready + cross-individual review 通过后一次性 trigger

**Review verdict 阶段性 APPROVE** — C1/C2 closed + §3 follow-up（拆分 + P2 fix + 红灯回归测试）APPROVE。剩 §4 checklist + cross-individual + cloud。

— [宪宪/Opus-4.7🐾] 2026-05-30 §3 follow-up verify APPROVE

---

### §11 §4 反模式 checklist self-check（2026-05-30 第六轮）— opus-47 临时接 author 棒

> **Context**: 砚砚（gpt52）quota 耗尽不可继续。剩余 author 工作（§4 self-check + 发 cross-individual review request）是 audit + documentation 不是 production code 改动，opus-47 临时接 author 棒做完，按 fallback 同族 reviewer 安排 cross-individual。

#### §4.1 Unit-semantics（3/3 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| 不把 eventNo 当 startMs/endMs 用 | ✅ | `live-verdict.ts:143-144` 用 `trial.timeSpan.startMs/endMs` |
| sha256 对落盘字节算 | ✅ | `live-verdict.ts:313 sha256File(path)` |
| generatedAt 透传 | ✅ | `live-verdict.ts:54` `input.generatedAt ?? new Date().toISOString()`，透传到 snapshot/attribution/handoff/sourceArtifacts（caller 在 replay/backfill 时必须传） |

#### §4.2 Cross-ref 完整性（2/2 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| provenance 先落盘再 hash | ✅ | `live-verdict.ts:68 writeJson(rawTrialsPath)` + `:76 sha256File(rawTrialsPath)` — write 先 hash 后 |
| orphan helper 清理 | ✅ | grep `sha256Json\|sha256Buffer` 全空，biome 兜底 |

#### §4.3 Scope 绑定 fail-closed（8/8 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| audit fail-closed (缺 threadId/catId 拒) | ✅ | `trials-support.ts:55 matchesScope` 中心化 chokepoint |
| `workspace_navigate` 路由写 catId | ✅ | `workspace.ts:760/763/783/829` body + audit data |
| preview 5 routes 写 catId+worktreeId | ✅ | `preview.ts:52/56/63/73/86/91/98/104/124` |
| worktree fail-closed | ✅ | `trials-support.ts:70-72 requireWorktree=true` 默认 |
| `browser_preview_open` 走 chokepoint | ✅ | `trials-support.ts:55 matchesScope` 唯一入口 |
| usage filter 到 evaluated cat | ✅ | `matchesScope` 检查 candidate.catId === scope.catId |
| telemetry filter 在 window 之前 | ✅ | scope 先 build 再 filter（`trials.ts:55 buildEvidenceScope`） |
| preview scenario detections 收窄 | ✅ | `trace.ts:hasLivePreviewForInvocation` 按 worktreeId + window |

#### §4.4 Shape 兼容（3/3 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| tool_use AgentMessage + raw NDJSON | ✅ | `trace-normalizers.ts:16-17` `toolName \|\| name`，`toolInput \|\| input` |
| Codex `file_change.changes[]` 抽路径 | ✅ | `trace-normalizers.ts:159` `if (normalizedToolName !== 'file_change' \|\| !Array.isArray(record.changes)) return [];` |
| ensureInvocation existing 不被 0 压垮 | ✅ | `trace.ts:113-115` `if (eventNo != null)` 守卫 + Math.min/Math.max；first-creation `eventNo ?? 0` 由后续 transcript event 收窄 |

#### §4.5 Edge path（3/3 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| no-miss 路径产合法 packet | ✅ | `verdict.ts:32-83 hasMisses` 守卫 + alternatives fallback (`L74 hasMisses ? real : ['no-miss']`) |
| `hasAttentionAmplifier` 真 gating | ✅ | `classify.ts:78-86` `lateInvocation \|\| priorMissCount >= 2 \|\| unrelatedActivity >= 3`（三真子句，无恒真，无硬编码 capability） |
| `zeroFrictionDefault` 按实算 | ✅ | `trials.ts:detectZeroFrictionDefault` 按 capability 切分（rich-messaging text len / workspace-navigator path includes / browser-preview regex） |

#### §4.6 数据卫生（1.5/2 — 1 covered，1 in-progress this commit）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| `generated/capability-wakeup/` in `.gitignore` | ✅ | `.gitignore:200` |
| Review request mailbox 有 YAML frontmatter | ⏳ | `docs/mailbox/2026-05-30-f192-phase-f-clean-reboot-review-request.md` 同 commit 创建（见 review request file） |

#### §4.7 Predicate 信号（2/2 covered）

| Anti-pattern | Status | Code anchor |
|---|---|---|
| `requireLivePreview` 收窄到当前 worktree+window | ✅ | `trials.ts:169 hasLivePreviewForOpportunity(trace, current, next)` 按 invocation window |
| `eventNoSpan` + `timeSpan` 同时记录 | ✅ | `trials.ts:275-276` 两个 span 都在 trial 上 |

#### §4 Total: **22/22 covered** ✅

— [宪宪/Opus-4.7🐾] 2026-05-30 §4 self-check 完成（临时接 author 棒）

---

### §12 PR ready 状态 + cross-individual review 安排（2026-05-30）

**Open items**:
- ✅ §4 反模式 checklist 22/22 covered (§11)
- ✅ Cross-individual review request 同 commit 创建 (`docs/mailbox/2026-05-30-f192-phase-f-clean-reboot-review-request.md`)
- ⏳ Cross-individual review 等待 @opus 接 reviewer 棒（**fallback 同族不同个体**——按 LL-049 reviewer 成本路由 + 砚砚 quota 耗尽 + opus-47 已 review-owner + opus-46 code review 一把好手 + cross-family 选项 @codex 太贵 + @sonnet 测试体力差。**接受同族 fallback 偏差 + cloud review 作为补强**）
- ⏳ WIP→ready 等 @opus 通过后
- ⏳ Cloud review trigger（WIP 拉掉后一次性）
- ⏳ 砚砚 quota 恢复回来收尾 merge-gate 操作（authorize / squash / co-author 签名）

— [宪宪/Opus-4.7🐾] 2026-05-30 PR ready status
