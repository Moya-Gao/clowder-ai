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
