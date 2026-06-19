# F167 Phase O — PR-O1 Plan: `receive-handoff-grounding` skill + claim schema + resolver catalog

> **Status**: DRAFT — pending @opus-48 R2 view (审 resolver catalog 漏类 + 合法守门 wait UX 边界)
> **Author**: @opus-47 (宪宪)
> **Spec source**: `docs/features/F167-a2a-chain-quality.md` §Phase O (R0 opus-47 → R1+R2 codex/砚砚)
> **Design thread**: `thread_mqkasedeqeo56ayc`
> **Source thread**: `thread_mqiwk2ir6u1jyrbk`
> **Sibling PR cuts**: PR-O2 telemetry shadow / PR-O3 Phase N policy patch / PR-O4 hardening (separate plans)

---

## 1. Why（北极星 + 真痛点）

铲屎官 2026-06-18 push back：「我不希望连级失败！别让我看到 thread b c d 要么去干不属于自己的事情，要么明明自己的事情不知道哪里来的幻觉昏头喵和他们说『你们本来的事情不属于你们』，然后他们还对对对」。

第一性原理（R0→R1）：**接球时，传球内容里的归属/授权/等待 claim 一律只是候选，不能作为事实；接球猫必须把 claim 拆成可验证对象，再用独立 resolver 得到第二源**。

Phase N (PR #2384) 是 surface-fix，只解决 "守门 thread 内 dual-owner" 5% 子集；90% a2a 路由质量未覆盖。Phase O 重设计通用 harness；PR-O1 是基础（docs/skill），不引入 runtime guard。

## 2. Scope（PR-O1 only — 严格 docs/skill）

**In scope**:
1. `cat-cafe-skills/receive-handoff-grounding/SKILL.md` — 接球前三问反射的 skill
2. `cat-cafe-skills/receive-handoff-grounding/refs/resolver-catalog.md` — 7 类 resolver 详解
3. `cat-cafe-skills/receive-handoff-grounding/refs/claim-schema.md` — claim/verdict TypeScript schema 定义
4. `cat-cafe-skills/receive-handoff-grounding/refs/dogfood-fixtures.md` — 5 类 dogfood case 描述
5. F167 feat doc PR-O1 完成 anchor 回填
6. Skill 注册 + `pnpm sync:skills`

**Out of scope（明确切到对应 PR）**:
- 任何 server 端运行时 guard / event emit（→ PR-O2）
- `GroundingResolverCache` 实现（→ PR-O2）
- Phase N `register_issue_tracking` + `hold_ball` policy patch（→ PR-O3）
- 任何 stateful tool fail-closed 改动（→ PR-O4）
- 任何 metric counter 实现（→ PR-O2）

**No code in this PR**：只有 markdown + skill manifest 同步。不动 `packages/api`、`packages/shared`、`packages/mcp-server`。

## 3. Concept Model — Claim / Resolver / Verdict

```
[Handoff message arrives]
        │
        ▼
[Receiver cat extracts claims]  ← R1 framing: claim ≠ fact
        │
        ▼
[For each claim:]
   1. Identify claimType (owner/auth/object/wait/route/role/freshness)
   2. Select resolver from catalog
   3. Invoke resolver (within budget)
   4. Verdict: verified | mismatch | insufficient
        │
        ▼
[Apply policy based on verdicts + actionRisk]
   - All verified + risk OK → proceed
   - Any mismatch + destructive risk → block, push back source thread
   - Insufficient + non-destructive → warn, telemetry, proceed cautiously
```

**关键 R1 unlearning**：
- Claim 不是 fact — 提取 claim **不**等于接受 claim
- Resolver 必须独立于 claim 本身（不能用 "传球者说" 当 resolver）
- 唯一例外：landy 本人在当前/源 thread 可引用 messageId 直接表态——message 本身是价值决策源；"某猫说 CVO signoff 了" 仍要查原 message

## 4. Claim Schema（PR-O1 定义；PR-O2 实施 emit）

```typescript
// claim-schema.md 内容（concept-level，PR-O1 不写 .ts）

export type ClaimType =
  | 'owner'       // "这是 X 的活" / "这是我的活"
  | 'auth'        // "X 同意 / CVO signoff / 守护猫 APPROVE"
  | 'object'      // "PR 在 / issue 已合 / branch 存在"
  | 'wait'        // "等 X 回我"
  | 'route'       // "这是 thread B 的活"
  | 'role'        // "你能做 / 你应该接"
  | 'freshness';  // "这是最新状态"

export type SourceKind =
  | 'cross_post'            // a2a cross-thread
  | 'mention'               // 行首 @cat
  | 'reply_in_thread'       // 本 thread reply
  | 'cvo_message'           // landy 本人 message
  | 'webhook'               // GitHub / external
  | 'self';                 // 自己的工具结果

export type ActionRisk =
  | 'read_only'             // 看文档 / list / search
  | 'mutate_local'          // 改 worktree files
  | 'register_tracking'     // PR/issue tracking task
  | 'hold_ball'             // 占球权
  | 'destructive'           // merge / close / delete
  | 'cvo_signoff_path';     // signoff/approve-related

export type Verdict =
  | 'verified'              // resolver 返回与 claim 一致
  | 'mismatch'              // resolver 返回与 claim 冲突
  | 'insufficient'          // resolver 无法返回足够证据 (含 budget exhausted)
  | 'not_applicable';       // claim 类型不适用此 resolver

export interface ClaimGroundingEvent {
  // 身份
  invocationId: string;
  catId: string;
  threadId: string;
  sourceThreadId?: string;       // cross-thread 时

  // claim
  claimType: ClaimType;
  sourceKind: SourceKind;
  sourceRef: SourceRef;          // messageId / PR URL+headSha / issue id / etc.
  claimSummary?: string;          // 短摘要 (hash, not raw body)

  // resolver
  resolver: string;               // resolver id (e.g. 'feat_index.lookup')
  resolverArgs?: Record<string, string>;  // 短键值 (no body)
  cacheHit: boolean;

  // verdict
  verdict: Verdict;
  verdictReason?: string;         // e.g. 'resolver_budget_exhausted'

  // 后果
  actionRisk: ActionRisk;
  tool: string;                   // 触发此 grounding 的工具
  threadKind?: 'concierge' | 'gate-keeping' | null;

  // observability
  ts: number;
  resolverCallsRemaining: number;
}

export interface SourceRef {
  kind: 'messageId' | 'pr_url' | 'issue_id' | 'feature_path' | 'task_id' | 'webhook_id' | 'commit_sha';
  value: string;
  status?: string;                // 'open' / 'merged' / 'closed' / etc.
  headSha?: string;
}
```

**Schema 设计约束**（R2 校准）：
- 不含 GitHub body / thread 大段内容 — 只 `sourceRef` + hash/status
- `claimSummary` 限 200 字符 + 内容哈希（防止反推全文）
- `resolverArgs` 限低敏 key-value（id / status / count），不存 raw payload

## 5. Resolver Catalog（7 类，详见 `refs/resolver-catalog.md`）

| # | 类别 | 默认 resolver | 备用 | 适用 claimType |
|---|------|--------------|------|---------------|
| 1 | Owner / scope | `feat_index.lookup(featId)` | `git log --grep --author` / PR author | `owner` `route` |
| 2 | Authorization | `cat_cafe_get_message(messageId).author=landy` | feature doc CVO signoff anchor | `auth` `cvo_signoff_path` |
| 3 | Object existence/status | `gh api {pr,issue,commit}` / `git ls-tree` | TaskStore.get / ThreadStore.get | `object` `freshness` |
| 4 | Callback / wait coverage | PR tracking task / webhook binding / scheduled task lookup | EYES count / reaction state | `wait` |
| 5 | Cross-thread routing | `cat_cafe_feat_index({featId}).linked_threads` | `cat_cafe_list_threads({keyword})` | `route` `owner` |
| 6 | Capability / role fit | cat dossier / cat-config restrictions | current runtime identity | `role` |
| 7 | Conflict / freshness | HEAD vs origin/main / PR head SHA | source message timestamp | `freshness` |

**Resolver budget**（PR-O2 实施，PR-O1 schema 定义）：
- Per invocation hard cap: **15 calls**（初始保守，按 rate-limit 校准）
- Per stateful tool call hard cap: **5 calls**
- 超 budget → verdict=`insufficient`, reason=`resolver_budget_exhausted`

## 6. Skill 设计 — `receive-handoff-grounding/SKILL.md`

**触发条件**（skill 自激活规则）：
- 收到 cross_post message
- 收到 cross-thread @mention
- 收到 hold_ball 请求 / register tracking 请求 / merge approval 请求
- handoff message 含归属/授权/等待 claim 关键词（"是你的"、"CVO 同意"、"等"、"应该"、"PR 在"…）

**三问反射**（skill core）：

```
Q1. claim 是什么？
    - 列出 message 里的所有可验证 claim（claimType + sourceRef）
    - 不要遗漏；漏 claim = 漏 verify

Q2. 第二源 resolver 是什么？
    - 每个 claim 至少一个 resolver
    - resolver 必须独立于 claim 本身（不能用 "他说" 当 source）
    - 多个 resolver 中至少一个不被传球者控制

Q3. 结果是 verified / mismatch / insufficient？
    - verified: resolver 返回与 claim 一致 → 接球允许
    - mismatch: resolver 返回与 claim 冲突 → push back source thread，引用 evidence
    - insufficient: resolver 无法返回足够证据 → 看 actionRisk 决定（destructive 退回，non-destructive warn）
```

**反例 demo**（skill 里给三个）：
1. 守门猫 2 字沾边接 issue → 应查 `feat_index` 而不是关键词匹配
2. 某猫说 "CVO 同意 merge" → 应查 thread context messageId，不直接相信转述
3. 收到 cross_post "等 X 回我" → 应查 PR tracking / webhook binding，反推 X 怎么回

**Push back 模板**（mismatch 时使用）：

```
@<源 thread 猫>

接球前核查发现 claim "<claim summary>" 与第二源不一致：
- claim 内容: <quote>
- resolver: <which>
- resolver 返回: <what>
- 冲突点: <specific>

退回本 thread，请确认或更新 claim。
```

## 7. Stateful Object Gate（F229 教训）

PR-O1 不引入 runtime stateful object，但**形式化** PR-O2 实施会引入的 `ClaimGroundingEvent` 状态机：

### State × Event 表

| State \\ Event | `claim_received` | `resolver_invoked` | `resolver_returned` | `budget_exhausted` | `action_taken` |
|---|---|---|---|---|---|
| `(none)` | → `proposed` | ❌ | ❌ | ❌ | ❌ |
| `proposed` | ❌ | → `resolving` | ❌ | → `insufficient`(终态) | ❌ (must verify first) |
| `resolving` | ❌ | → `resolving`(loop, budget--) | → `verified`/`mismatch`/`insufficient` | → `insufficient`(终态) | ❌ |
| `verified` | ❌ | ❌ | ❌ | ❌ | → `done`(终态) |
| `mismatch` | ❌ | ❌ | ❌ | ❌ | → `blocked`/`pushed_back`(终态) |
| `insufficient` | ❌ | ❌ | ❌ | ❌ | → `proceeded_with_warn`/`blocked` |

### Invariants（PR-O1 doc-only；PR-O2 enforce）

- **INV-O1**: 任何 `claim_received` 必须有 `sourceRef`（kind + value 非空）+ `claimType` ∈ 7 类枚举
- **INV-O2**: `verdict` 在 `{verified, mismatch, insufficient, not_applicable}` 终态，状态机不留 dangling intermediate
- **INV-O3**: `resolver_invoked` 只在 `resolving` state 触发；每次 invoke 消耗 1 个 budget；budget=0 后必转 `insufficient`(终态)
- **INV-O4**: `action_taken` 必在终态后；`destructive` actionRisk + `mismatch` verdict → 必转 `blocked`
- **INV-O5**: counter 100% 计数 ≥ sample event 计数；sample 受 R2 sampling 规则约束（mismatch/blocked 100% / insufficient 3-per-resolver-thread-day / verified 1/20）
- **INV-O6**: `sourceRef.kind='messageId'` 用于 `claimType='auth'` 时，目标 message author 必须 = `landy`；否则该 resolver 不能 satisfy auth claim
- **INV-O7**: `cacheHit=true` 不消耗 resolver budget
- **INV-O8**: `not_applicable` verdict 不计入 `mismatch` 或 `insufficient` 累积；仅用于"该 resolver 不适用此 claimType"标记
- **INV-O9**: 跨 invocation 状态不复用（每次 invocation 重置 budget；不做 long-running grounding session）

### Adversarial scenarios（PR-O1 doc 设计；PR-O2 fixture 实施）

1. **Resolver 返回过期数据**（freshness=stale）→ 必须升级到 `freshness` claim 查 HEAD vs origin/main；resolver 单查 PR state 不够
2. **Resolver 自身被传球者控制**（如查"传球者 thread context"）→ schema 拒绝；INV-O6 类规则
3. **Claim 链式假证**（"X 说 Y 说 Z 同意"）→ skill 三问展开每层 claim 独立 verify；不接受 transitively
4. **Budget exhausted on destructive action**（critical case）→ INV-O3 强制转 `insufficient`；destructive 必 block，无 fallback
5. **Multiple claims, partial verified**（接球 message 有 N 个 claim，部分 verified 部分 mismatch）→ 任一 mismatch + destructive risk = 全部 block；非 destructive = warn + proceed for verified subset

## 8. AC（PR-O1 only）

- [ ] **AC-O1.1** skill `receive-handoff-grounding/SKILL.md` 存在；触发条件可枚举；三问反射明确
- [ ] **AC-O1.2** `refs/resolver-catalog.md` 7 类 resolver 各有：用途 / 默认 resolver / 备用 / 适用 claimType / 已知 limitation
- [ ] **AC-O1.3** `refs/claim-schema.md` 定义 `ClaimGroundingEvent` / `SourceRef` / 8 枚举（ClaimType, SourceKind, ActionRisk, Verdict）；约束（no raw body / 200 字 summary cap）明确
- [ ] **AC-O1.4** `refs/dogfood-fixtures.md` 含 5 类 dogfood case（含期望 verdict + 期望 action），可被 PR-O2 / O3 / O4 测试复用
- [ ] **AC-O1.5** PR-O1 skill 通过 `pnpm sync:skills` 同步到 HOME；通过 `pnpm check:skills:manifest` 不含硬编码猫名
- [ ] **AC-O1.6** F167 feat doc Phase O R1+R2 spec section 新增 PR-O1 完成 anchor（`✅ R3 (opus-47, <date>): PR-O1 docs/skill 实施完成`）
- [ ] **AC-O1.7** Stateful Object Gate state×event 表 + INV-O1..O9 写入 plan；adversarial scenarios 5 类有 mitigation 描述
- [ ] **AC-O1.8** Pre-registered retraction conditions（下面 §11）写入 plan，跟 review 一起开放给 reviewer

## 9. Test plan（PR-O1 only）

PR-O1 无运行时代码 → 无单元测试 / 集成测试。验证用：

- `pnpm check:skills:manifest` — skill manifest 合规、无硬编码猫名
- `pnpm sync:skills` — HOME symlink 同步成功
- `pnpm check:features` — feat doc truth-source PASS
- Manual review by R3 reviewer — skill 触发条件覆盖度 / resolver catalog 完整性 / claim schema 设计合理性

**PR-O2 之后会复用** `refs/dogfood-fixtures.md` 写 regression test（在 PR-O2 plan 里详述）。

## 10. Out of scope handoff conditions

PR-O1 → PR-O2 handoff 必须满足：
- ✅ skill 已通过 R3 review (含 @opus-48 R2 + 实施后 R3)
- ✅ claim schema 已得到 sonnet/gpt52 中至少一只的 second-opinion APPROVE
- ✅ F167 feat doc PR-O1 anchor 已回填
- ⚠️ OQ-1 (合法守门 wait UX) 必须先收敛（影响 PR-O3 但 PR-O2 实施 telemetry 要看到这条信号）

PR-O1 → PR-O3 handoff：等 PR-O2 shadow 跑 1 周后才动 PR-O3 policy patch。

## 11. Pre-registered retraction conditions（feedback_pre_register_retraction_conditions）

我可能错在：

1. **R1 framing 自欺**：可能我接 R1 太彻底，把 "claim ≠ fact" 框过死，导致 skill 太重 — 每个 message 都要拆 claim、查 resolver、写 verdict，maintainer 体感像在做合规审计。**信号**：dogfood 一周 maintainer 抱怨"太慢/烦"。**Retract path**：考虑 skill 提供 "low-risk fast path"（read_only actionRisk + 单 resolver 命中即放行）。
2. **Resolver catalog 漏类**：7 类是 R1 framing，可能漏「**Time/Schedule**」（claim "明天 X 会回我"，timing claim 独立于 callback 存在）或「**Emotional/Social commitment**」（claim "我答应过 X"）。**信号**：opus-48 R2 视角点这个。**Retract path**：扩 catalog 到 8/9 类。
3. **Skill 触发条件过严**："含归属/授权/等待 claim 关键词" 关键词列表可能漏 case 或误触。**信号**：实际 cross_post 里 50% trigger 错（要么漏要么误触）。**Retract path**：触发条件改成 actionRisk-based（要走 destructive/mutate 才 trigger，纯阅读 cross_post 不 trigger）。
4. **Stateful Object Gate 形式化太早**：PR-O1 只是 docs/skill 但 INV-O1..O9 在 PR-O2 实施前就锁死，可能挡住 PR-O2 实测发现的合理调整。**信号**：PR-O2 review 反复要 update INV。**Retract path**：INV-O1..O9 标 "draft, may evolve per PR-O2 implementation findings"。
5. **landy messageId 例外被滥用**：唯一例外是 "landy 本人 messageId" 直接 = truth，但 LLM 可能很容易把 cross_post 当作"landy 本人 messageId"（实际是另一只猫转述）。**信号**：dogfood 出现猫把转述当 landy message。**Retract path**：landy messageId verification 必须查 author === 'landy' (catId 严格匹配)，不接受 'lysander' / 'l.s.' 等 handle variant 作为 truth source。

## 12. Owner / Timing / Handoff

- **PR-O1 owner**: @opus-47 (宪宪)
- **R3 review path**: PR-O1 完成后 @opus-48 (skill 设计审 + 触发条件审) + @sonnet (愿景守护) 双 review
- **CVO signoff**: 不需要单独 signoff（铲屎官 2026-06-18 北极星 + "你们达成 goal 就行" 已是 Phase O 总授权；除非 OQ-1 收敛偏离北极星才升级）
- **预计 PR-O1 完成时间**: skill + 4 个 markdown ref 文件 + plan 实施回填，4-6 小时（含 review 修正 turnaround）

## 13. Sibling PR cuts (separate plans, separate PRs)

- **PR-O2** (telemetry shadow): `docs/plans/2026-06-1X-f167-phase-o-pr-o2-telemetry-shadow.md`（待 PR-O1 R3 通过后起草）
- **PR-O3** (Phase N policy patch): `docs/plans/2026-06-1X-f167-phase-o-pr-o3-phase-n-policy-patch.md`（待 PR-O2 shadow 1 周后起草）
- **PR-O4** (hardening): 待 F192 weekly verdict 后起草

---

**Last updated**: 2026-06-18 (R1+R2 spec 同步入 plan)
**Pending**: @opus-48 R2 view → R3 实施开始
