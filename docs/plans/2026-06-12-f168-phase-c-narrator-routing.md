# F168 Phase C — Narrator + Role Registry + 路由 Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`（reopened 2026-06-10）
**终态设计:** `docs/discussions/2026-06-09-f168-community-ops-final-design.md` §4（Role Registry）/ §7（Phase C 行）
**Goal:** 把"一个 issue/PR 来了，谁讲人话 + 谁分发"做成系统能力——引擎只认角色不认猫，narrator 短命 spawn 出结构化定方向卡片（讲人话 + 搜证 + 推荐路由），路由接到 F128，owner 的确认/推翻自动喂 F192 eval。
**Architecture cell:** community-ops（Phase A Task 0 建）
**Map delta:** update required
**Map delta why:** community-ops cell 新增三个子组件——`RoleResolver`（角色解析）、narrator spawn 驱动、repo 级 comment poller；不新建 cell，归入既有 community-ops。
**Architecture:** event-sourced 既有底座（Event Log + Projector + 状态机，Phase A/B 已建）之上，新增 (1) `RoleResolver` 注入接口让引擎 role→executor 解耦猫名（对齐既有 `ActorResolver` injectable 模式），(2) narrator 短命 spawn 产出扩展版 `DirectionCard`，(3) `routed` 转换接 F128 propose-thread + role 下拉，(4) eval 钩子记 narrator 初判 vs owner 裁定。**禁止平行系统**——全部扩展/接线既有 community 域模块。
**Tech Stack:** TypeScript, fastify, Redis, 既有 `packages/api/src/domains/community/*`
**前端验证:** Yes — C3（F128 role 下拉 + DirectionCard 渲染）reviewer 必须用 Playwright/Chrome 实测

---

## 0. Straight-Line Check（A→B，无绕路）

**Finish line（一句话 B）:** 社区 issue/PR 进来后，系统自动 spawn 一只配置指定的轻量猫，搜证后产出一张「这是啥 + 收不收 + 建议路由给谁」的定方向卡片；铲屎官/owner 在卡片上一键路由（已有 thread 或新建 + role 下拉改派），整个判断-路由-确认链路记入事件流喂 eval。引擎对"哪只猫担任 narrator"零硬编码。

**Terminal schema（终态数据结构，步骤围绕它建，非脚手架）:**

```typescript
// 1) RoleResolver capability contract（core engine 唯一依赖，零猫名）
type CommunityRole = 'narrator' | 'case-owner' | 'reconciler';
interface RoleExecutor { catId: string; model: string; promptTemplateId: string; capabilities: readonly RoleCapability[]; }
type RoleCapability = 'triage' | 'route-recommend' | 'public-reply';  // 显式不含 'code'/'merge'/'worktree'
interface RoleResolver { resolve(role: CommunityRole): RoleExecutor | null; }  // null = fail-closed

// 2) DirectionCard 扩展（narrator 输出，append 进既有 DirectionCardPayload.entries）
interface TriageEntry {  // 既有字段 + 新增（向后兼容，新增全 optional）
  catId: string; verdict: Verdict; questions: readonly QuestionResult[];
  reasonCode?: string; relatedFeature?: string; timestamp: number;
  // ↓ Phase C 新增
  authoredByRole?: CommunityRole;          // 'narrator' 标记机器初判 vs 人工
  narrative?: string;                       // 一句话人话："这 issue 在说啥"
  evidenceRefs?: readonly string[];         // 搜证清单（linked PR/issue/相关 feat）
  routeRecommendation?: { kind: 'existing-thread'; threadId: string } | { kind: 'new-thread' } | { kind: 'decline' };
  recommendedOwnerRole?: CommunityRole;     // 推荐谁接（默认 case-owner）
}

// 3) eval 记录（narrator 推荐 vs owner 裁定，append timeline）
interface RouteDecisionEvalEvent {
  subjectKey: string; narratorRecommendation: TriageEntry['routeRecommendation'];
  ownerDecision: { threadId: string | null; verdict: Verdict }; agreed: boolean; at: number;
}
```

**NOT building（明确不做，防 scope 膨胀）:**
- ❌ 不重建 Event Log / Projector / 状态机（Phase A 已建，只接线）
- ❌ 不做 narrator 的 correctness 判断权——narrator 只 recommend，不 own case state，不碰代码
- ❌ 不做多 narrator 投票/共识（保留 Phase A 的双猫 `resolveConsensus`，narrator 是其中一个 entry 来源）
- ❌ 不做 Workspace tab UX 改版（那是 v1 已完成的 AC-C1~C10；本 Phase 复用既有看板）
- ❌ 不做 Reconciler 完整实现（GitHub⇄Case diff cron 是 Phase D）

**Spike（纯探索，time-boxed，输出决策非交付物）:**
- **SPIKE-1（C2 前置，≤30min）**: 确认 narrator 短命 spawn 复用哪个机制——候选 (a) scheduler wake（`infrastructure/scheduler` + `ActorResolver`）(b) 既有 triage 端点同步调用 (c) subagent。输出：一句话决策 + 选定机制的注入点。**不**预先实现。

---

## 1. Stateful Object Gate — Census（🔴 F229 PR-A1 20 轮教训的正解）

> Phase C 状态对象密集。Census 先行：先列全部有生命周期对象，再逐个三件套。漏报 = gate 形同虚设（A3a ConversationSendCycle 漏普查 → 云端 5 轮补课）。

### Census 清单（6 个生命周期对象）

| # | 对象 | lifecycle owner | 新增/既有 |
|---|------|-----------------|----------|
| SO-1 | narrator invocation（短命 spawn） | 引擎（per-event 触发） | 新增 |
| SO-2 | RoleResolver / Role Registry binding | deployment 配置 | 新增 |
| SO-3 | routing 决策（triaged→routed 转换） | community 状态机 | 既有，接线修复 |
| SO-4 | repo 级 comment 轮询 cursor | TaskStore（采集 operational state） | 新增（扩展 RepoScan 模式） |
| SO-5 | DirectionCard（case 投影 + narrator 字段） | case（CommunityObject） | 既有，schema 扩展 |
| SO-6 | eval override 记录 | timeline（append-only）+ community-eval-domain | 新增 |

### SO-1 narrator invocation — 三件套

**状态×事件转移表:**

| 状态 \ 事件 | trigger(case) | produce(DirectionCard) | timeout/crash |
|---|---|---|---|
| (none) | → spawned | — | — |
| spawned | (dedup: 同 sourceEventId 不重复 spawn) | → emitted | → terminated（无半写） |
| emitted | — | (terminal) | — |
| terminated | retry 允许（case 仍 triaged） | — | — |

- **唯一 lifecycle owner:** 引擎触发，narrator 自身**不持有任何 case 状态**。
- **旁路 API 禁止:** narrator executor 的 capabilities 显式不含 `code`/`merge`/`worktree`——RoleResolver 解析出的 narrator executor 不得获得这些能力。

**不变量:**
- **INV-1**（narrator 无持久状态）：narrator 只产出 `TriageEntry` payload，绝不直接写 `case.state`——case 状态转移由状态机 owner。可测：narrator 路径调用 `communityIssueStore.update` 时断言只改 `directionCard`，不改 `state`。
- **INV-2**（narrator 能力受限）：`RoleExecutor.capabilities` for narrator ⊆ {triage, route-recommend, public-reply}，不含 code/merge。可测：`resolve('narrator').capabilities` 断言 + grep 守护无 worktree 调用。
- **INV-3**（spawn 幂等）：同 `(subjectKey, sourceEventId)` 只 spawn 一个 narrator。可测：重复 trigger 同 eventId → 第二次 no-op。

**对抗场景（每个一条测试）:**
- spawn 失败 → case 停在 `triaged`，可重试，不进 `routed`（不静默标记完成）
- narrator 超时 → SLA 计时 → 死信浮回看板（复用 Phase A SLA）
- 重复 spawn（同 eventId 二次到达）→ idempotent no-op
- narrator 崩溃中途 → DirectionCard 要么完整 emit 要么不 emit（无半写 entry）

### SO-2 RoleResolver / Role Registry binding — 三件套

**状态×事件转移表:**

| 状态 \ 事件 | config load | resolve(known role) | resolve(unknown/unbound) |
|---|---|---|---|
| unloaded | → loaded | (error) | (error) |
| loaded | (reload→loaded) | → RoleExecutor | → null (fail-closed) |

- **唯一 lifecycle owner:** deployment 配置文件（家里 = roster 绑定；别人家 = 他们的 catalog）。
- **旁路 API 禁止:** core community engine **禁止 import `getRoster()` / 猫名常量 / 模型名常量**——只能通过注入的 `RoleResolver`。

**不变量:**
- **INV-4**（role 名封闭集）：`CommunityRole` 是有界联合 {narrator, case-owner, reconciler}，未知 role → fail-closed（return null + 可观测告警），不静默。可测：`resolve('bogus' as any)` → null + 告警。
- **INV-5**（binding 缺失 fail-loud）：role 已知但未绑定 cat / cat unavailable → null + 告警 + case 停在 triaged，不静默吞。可测：空 roster resolve('narrator') → null + 日志。
- **INV-6**（引擎零猫名）：community 域引擎代码零 `getRoster`/猫名/模型名常量。可测：**硬层 grep 守护测试**（见 Task C1.3）扫 `domains/community/**` 禁止 `getRoster`/已知猫名 import。

**对抗场景:**
- role 未配置 → fail-closed
- 绑定 cat 当前 unavailable（F182 soft-degradation）→ 降级 alternatives 或 null
- 配置热更新中途 resolve → 读到一致快照（不读半改配置）
- 多租户：两套 binding 互不污染（repo 维度隔离）

### SO-3 routing 决策（triaged→routed）— 三件套

**状态×事件转移表:**（嵌入既有 community-state-machine）

| 状态 \ 事件 | route(existing-thread) | route(new-thread) | route(decline) |
|---|---|---|---|
| triaged | → routed (assignedThreadId set) | → routed (thread created) | → declined |
| routed | (幂等：重复路由同目标 no-op) | (幂等) | — |

- **唯一 lifecycle owner:** `TriageOrchestrator.routeAccepted` + 状态机。
- **旁路 API 禁止:** 路由必须经状态机产生 `routed` 事件进 Event Log，不允许直接 `store.update({state:'accepted'})` 绕过事件。

**不变量:**
- **INV-7**（routed 必有有效 thread）：进入 `routed` 必须有有效 `assignedThreadId`（已有 thread 存在 or 新建成功）。**threadStore 缺失时 fail-loud 不静默 return**（C0 修复 — 现 `routeAccepted:78` 静默 return）。可测：threadStore 缺失 + new-thread 路由 → 抛错/告警，不静默成功。
- **INV-8**（路由事件可重建）：每次路由 append `routed` 事件，投影可重建。可测：rebuild from events → assignedThreadId 一致。

**对抗场景:**
- threadStore 未注入（C0 bug）→ 改为 fail-loud（Task C0.1）
- 目标 thread 不存在/已关闭 → 校验 + 拒绝路由到死 thread
- 重复路由同 case → 幂等（同目标 no-op，换目标 = 改派事件）
- 并发双路由 → 状态机 last-write 或拒绝第二次

### SO-4 repo 级 comment 轮询 cursor — 三件套

**状态×事件转移表:**

| 状态 \ 事件 | poll(since=cursor) | append success | append dedup-hit |
|---|---|---|---|
| cursor=T0 | fetch comments since T0 | cursor→T_latest | cursor→T_latest（仍推进） |

- **唯一 lifecycle owner:** TaskStore（采集 operational state，**不是案件 canonical**，终态设计 §2）。
- **旁路 API 禁止:** cursor 只由 poller 推进，不被投影层/视图改写。

**不变量:**
- **INV-9**（采集 cursor append 即推进）：事件 append 进 Event Log 成功即推进 cursor——informational 被静默 ≠ 丢失（终态设计 §2 双 cursor 语义；修正旧 `IssueCommentTaskSpec` 仅 notified 才 commit cursor 的语义）。可测：informational comment → append + cursor 推进，不重复消费。
- **INV-10**（sourceEventId 去重）：同 comment id 多次轮询只 append 一次。可测：同 comment 二次 poll → 第二次 dedup no-op。

**对抗场景:**
- crash window（cursor 推进前崩溃）→ 重复消费靠 sourceEventId 幂等兜底
- since 游标分页边界 → 不漏不重
- 未-routed issue 的追评（**本 task 要灭的盲区**）→ repo 级轮询覆盖所有 issue，不只已注册 tracking 的

### SO-5 DirectionCard（case 投影 + narrator 扩展字段）— 三件套

- **唯一 lifecycle owner:** case（CommunityObject.directionCard）。
- **旁路 API 禁止:** DirectionCard entries append-only，不改已有 entry。

**不变量:**
- **INV-11**（catId 不重复 triage）：既有 `TriageOrchestrator:26` dedup by catId，narrator entry 同样受约束。可测：narrator + 同 catId 二次 → reject。
- **INV-12**（扩展字段向后兼容）：新增字段全 optional，旧 DirectionCard（无 narrative/route）仍合法解析。可测：旧 payload 反序列化不报错。

**对抗场景:**
- 并发 triage 双写 → store update 原子性
- narrator entry 与人工 entry 混合 → `authoredByRole` 区分，consensus 正常
- schema 演化 → `Record<string,unknown>` 存储层向后兼容（既有设计）

### SO-6 eval override 记录 — 三件套

- **唯一 lifecycle owner:** timeline（append-only）+ `community-eval-domain`。
- **旁路 API 禁止:** eval 事件 append-only，不回改。

**不变量:**
- **INV-13**（每次 owner 裁定记一条）：owner confirm/override narrator 的 routeRecommendation → append 一条 `RouteDecisionEvalEvent`（agreed = narrator 推荐 == owner 实选）。自动路由权限"用数据开不用信任开"。可测：override 路由 → eval 事件 agreed=false；confirm → agreed=true。

**对抗场景:**
- override 信号丢失 → resolve 端点强制记录（不依赖猫记性）
- 无 narrator 推荐时的纯人工路由 → 不算 override（narratorRecommendation=null，不污染 agreed 统计）
- 重复记录 → 幂等 by (subjectKey, decisionEventId)

**派生值规则检查:** `agreed` 字段是 `narratorRecommendation` vs `ownerDecision` 的纯投影 → **不独立存储**，eval 查询时计算（零失同步风险）。

---

## 2. Component 总览

| Component | 交付 | 依赖 | AC |
|---|---|---|---|
| **C0** 前置遗留收口 | threadStore 接线 fail-loud + optional-dep 硬层 grep 守护 + repo comment 轮询 + narrator 排除存量 | 无（最独立，先做解风险） | AC-C0 |
| **C1** Role Registry + RoleResolver | `CommunityRole` 类型 + `RoleResolver` 接口 + 配置层 binding + 引擎零猫名 grep 守护 | C0.2 守护机制 | AC-C1/C2 |
| **C2** narrator spawn + DirectionCard | SPIKE-1 决策 + narrator executor + DirectionCard 扩展字段 + 接 triage/dispatch 端点 | C1（RoleResolver） | AC-C3/C4 |
| **C3** F128 路由扩展 | DirectionCard → propose-thread（已有/新建）+ role 下拉改派（前端） | C2（routeRecommendation） | AC-C5 |
| **eval** 钩子 | resolve 端点记 `RouteDecisionEvalEvent` → community-eval-domain → F192 | C3（owner 裁定信号） | AC-C6 |

**Phase C Acceptance Criteria（本 plan 定义，源自终态设计 §4/§7，待写回 feature doc）:**
- **AC-C0**: 4 项 Phase B 遗留收口（接线 fail-loud + 硬层守护 + repo 轮询灭盲区 + 存量排除）
- **AC-C1**: Role Registry — 引擎只认 narrator/case-owner/reconciler，role→binding 在配置；引擎代码零猫名/模型名（grep 守护通过）
- **AC-C2**: RoleResolver contract — core engine 依赖注入的 `resolve(role)→executor`，不 import getRoster
- **AC-C3**: narrator 短命 spawn — per-event clean-context，产 DirectionCard，无 case-state/code 权限
- **AC-C4**: DirectionCard 扩展 — 含人话叙述 + 搜证 + 推荐路由，结构化 schema，向后兼容
- **AC-C5**: F128 路由 — 卡片可路由到已有 thread + role 下拉改派
- **AC-C6**: eval 钩子 — owner confirm/override 记 timeline → F192

**narrator 绑定粒度 — DECIDED（CVO 2026-06-12）**: ① 部署配置可换（C1.2 落地，满足"可选+解耦"硬约束）= Phase C 交付物；② Hub UI 点选切换 = **接缝预留 + follow-up**（C1 配置层留好读写接口，后续增量加 UI 不返工，不在 Phase C 强做）；③ per-case 临时选**不做**（违背 F168 解放人肉 dispatcher 愿景）。F208 画像注入 narrator 见 §4 OQ-V1。

---

## 3. Tasks（TDD：RED→GREEN→commit；bite-sized）

### C0.1 — threadStore 接线 fail-loud 修复

**Files:**
- Modify: `packages/api/src/index.ts:2502`（register communityIssueRoutes — 补 threadStore）
- Modify: `packages/api/src/domains/community/TriageOrchestrator.ts:78`（静默 return → fail-loud）
- Test: `packages/api/test/community/triage-orchestrator.test.js`（新增 fail-loud 断言）

**Step 1（RED）:** 写测试——`routeAccepted(id, null, userId)` 在 `threadStore` 缺失时，断言抛错或返回显式错误（不静默 return undefined）。运行 → FAIL（现在静默 return）。
**Step 2（GREEN）:** `TriageOrchestrator.routeAccepted` line 78：`if (!this.deps.threadStore)` → 改为 throw / 返回 `{error:'threadStore-not-wired'}` + log.error。INV-7。
**Step 3:** index.ts:2502 register opts 补 `threadStore`（确认 index.ts 作用域内 threadStore 变量名，grep `threadStore` in index.ts 定位）。
**Step 4:** 跑 triage + 接线测试 GREEN。**Step 5:** commit。

### C0.2 — optional-dep 构造点硬层 grep 守护（ADR-031，治第 4 犯）

**Files:**
- Create: `packages/api/test/community/optional-dep-wiring.guard.test.js`
- Reference: ADR-031 软+硬+eval 三层 → 这是**硬层**

**Step 1（RED）:** 写守护测试——扫 `index.ts` 中 `communityIssueRoutes` register 调用，断言传入了 `threadStore`/`communityObjectStore`/`communityEventLog`（已声明为 route 消费的 optional dep）。当前 threadStore 缺失 → FAIL。
**Step 2（GREEN）:** C0.1 修复后此测试转 GREEN——守护锁死，防再退化。
**Step 3:** 守护测试覆盖"声明即必传"——任何 `Pick<IThreadStore...>` optional dep 在唯一生产构造点必须传。**Step 4:** commit。

### C0.3 — repo 级 comment 轮询（灭未-routed 追评盲区）

**Files:**
- Modify/Reference: `packages/api/src/infrastructure/connectors/github-repo-event/RepoScanTaskSpec.ts`（扩展 repo 级扫描）或新增 repo-comment poller
- Reference: `packages/api/src/infrastructure/email/IssueCommentTaskSpec.ts`（现 per-tracked-issue 轮询，盲区源）
- Test: redis-backed（`test:redis`，因涉及 cursor + 索引行为，LL `feedback_inmemory_store_tests_miss_redis_behavior`）

**Step 1（RED）:** 测试——repo 有一个**未注册 tracking** 的 issue 收到 comment，断言 repo 级轮询能捕获并 append `issue.commented` 进 Event Log。现无 repo 级轮询 → FAIL。
**Step 2（GREEN）:** 实现 repo 级 `GET /repos/{repo}/issues/comments?since={cursor}` 游标轮询，sourceEventId 去重（INV-9/10）。复用 RepoScan 框架的 HMAC/去重/调度。
**Step 3:** 双 cursor 语义——append 成功即推进 cursor（INV-9）。redis-backed 测试断言 cursor 单调 + dedup。**Step 4:** commit。

> **技术 OQ-C0a:** 扩展 RepoScanTaskSpec vs 新建 repo-comment poller —— 实现时按耦合度定（倾向扩展 RepoScan，复用调度）。

### C0.4 — narrator 排除存量（防 453 卡风暴，终态设计硬约束）

**Files:**
- Modify: triage 队列入口（narrator trigger 处，C2 接入点）
- Reference: `community-bootstrap.ts`（453 条 bootstrap case 标记）
- Test: 单元

**Step 1（RED）:** 测试——bootstrap 迁入的存量 case（无新 external 事件）不进 narrator triage 队列；只有新增/有新追评的 case 进。FAIL（无过滤）。
**Step 2（GREEN）:** narrator trigger 过滤——`source !== 'bootstrap'` 或 `lastExternalActivityAt > bootstrapAt`。INV：存量静默记账，新事件才唤醒（终态设计 §0「安静地记得，需要时活过来」）。
**Step 3:** commit。

### C1.1 — CommunityRole 类型 + RoleResolver 接口

**Files:**
- Create: `packages/shared/src/types/community-role.ts`（`CommunityRole`/`RoleExecutor`/`RoleCapability`/`RoleResolver`）
- Test: `packages/shared` 类型测试

**Step 1（RED）:** 测试 `RoleResolver.resolve('narrator')` 契约 + `resolve(unknown)` → null（INV-4）。
**Step 2（GREEN）:** 定义有界联合 + 接口（terminal schema §0）。
**Step 3:** shared build (`pnpm --filter @cat-cafe/shared build`)。**Step 4:** commit。

### C1.2 — RoleResolver 家里实现（roster binding，对齐 ActorResolver）

**Files:**
- Create: `packages/api/src/domains/community/RoleResolver.ts`（injectable getRoster，对齐 `infrastructure/scheduler/ActorResolver.ts` 模式）
- Modify: deployment 配置（role→binding，narrator: gemini35 默认）
- Test: 单元（mock roster 注入）

**Step 1（RED）:** 测试——注入 mock roster，`resolve('narrator')` → 配置绑定的 executor；空 roster → null + 告警（INV-5）。
**Step 2（GREEN）:** factory `createRoleResolver(getRoster, bindingConfig)`（ActorResolver 同款 injectable）。binding 在配置，非代码常量。
**Step 3:** capabilities 断言 narrator ⊄ {code,merge}（INV-2）。**Step 4:** commit。

### C1.3 — 引擎零猫名硬层 grep 守护（INV-6）

**Files:**
- Create: `packages/api/test/community/engine-no-catname.guard.test.js`
- Modify: 收敛 `community-issues.ts:492/592` guardian 的 `getRoster()` 直调 → RoleResolver（或标注 Phase D 收敛）

**Step 1（RED）:** 守护测试扫 `domains/community/**`（除 RoleResolver 实现自身）禁止 `import getRoster` / 已知猫名常量。当前 GuardianMatcher/route 直调 → FAIL（或先 scope 到 narrator 路径）。
**Step 2（GREEN）:** narrator 路径全走 RoleResolver；guardian getRoster 收敛或显式 allowlist + Phase D TODO。
**Step 3:** commit。

> **技术 OQ-C1a:** guardian 的 getRoster 直调（Phase D 代码）本 Phase 收敛还是 allowlist 豁免 → 倾向 narrator 路径先纯净，guardian 收敛留 Phase D（避免 scope 蔓延）。

### C2.0 — SPIKE-1：narrator spawn 机制（≤30min，输出决策）

候选：(a) scheduler wake + ActorResolver (b) triage 端点同步调用 (c) subagent。读 `wakeCatImpl.ts` / `GameNarratorDriver.ts` / scheduler，输出一句话决策 + 注入点。**不预先实现。**

### C2.1 — DirectionCard schema 扩展（向后兼容）

**Files:**
- Modify: `packages/shared/src/types/community-issue.ts:50`（`TriageEntry` 加 optional 字段，见 §0 terminal schema）
- Test: 向后兼容（旧 payload 解析）+ 新字段

**Step 1（RED）:** 测试 narrator entry 含 `narrative`/`routeRecommendation`/`authoredByRole`；旧 payload（无新字段）仍合法（INV-12）。
**Step 2（GREEN）:** 加 optional 字段 + shared build。**Step 3:** commit。

### C2.2 — narrator executor（产 DirectionCard，能力受限）

**Files:**
- Create: `packages/api/src/domains/community/NarratorDriver.ts`（按 SPIKE-1 决策接入）
- Modify: triage/dispatch 端点（`community-issues.ts:171 dispatch` / `:350 triage-complete`）接 narrator
- Test: 单元 + 端点

**Step 1（RED）:** 测试——trigger narrator → 产出 `TriageEntry{authoredByRole:'narrator', narrative, routeRecommendation}`，且 narrator 路径不改 `case.state`（INV-1）、能力不含 code（INV-2）、同 eventId 幂等（INV-3）。
**Step 2（GREEN）:** NarratorDriver via RoleResolver('narrator')；搜证（复用 link-parser）填 evidenceRefs；产 entry append 既有 TriageOrchestrator。
**Step 3:** spawn 失败/超时对抗测试（case 停 triaged，SLA 死信）。**Step 4:** commit。

### C3.1 — DirectionCard 路由动作接 F128（后端）

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts:380 resolve`（routeRecommendation → propose-thread）
- Reference: `packages/api/src/routes/callback-propose-thread-routes.ts`（F128）
- Test: 路由到已有 thread / 新建 thread

**Step 1（RED）:** 测试——resolve 带 `routeRecommendation:{kind:'existing-thread',threadId}` → 路由到该 thread；`new-thread` → 经 F128 创建。死/不存在 thread 拒绝（INV-7）。
**Step 2（GREEN）:** resolve 端点消费 routeRecommendation，接 routeAccepted（C0.1 已修 fail-loud）+ F128 propose-thread。**Step 3:** commit。

### C3.2 — role 下拉改派（前端，🖥️ Playwright 验证）

**Files:**
- Modify: 看板 DirectionCard 渲染组件（`packages/web/src/...` — 实现时定位）+ role 下拉
- Test: Playwright/Chrome 实测（前端验证硬要求）

**Step 1（RED）:** 组件测试——DirectionCard 渲染 narrator narrative + 推荐路由 + role 下拉；改派触发 resolve。
**Step 2（GREEN）:** 前端组件 + 下拉（图标 SVG 非 emoji，KD-9）。**Step 3:** Playwright 实测截图。**Step 4:** commit。

> **设计 Gate:** C3.2 涉及 UX → 出 Pencil 设计稿给铲屎官审核再实现（feedback_ux_design_review + KD-9 SVG）。

### eval.1 — RouteDecisionEvalEvent 记录（INV-13）

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts:380 resolve`（记 eval）
- Modify: `packages/api/src/infrastructure/harness-eval/domain/community-eval-domain.ts`（消费）
- Test: confirm→agreed=true / override→agreed=false / 无推荐→不污染

**Step 1（RED）:** 测试——owner 路由 == narrator 推荐 → eval `agreed=true`；≠ → `agreed=false`；narratorRecommendation=null（纯人工）→ 不记 agreed（INV-13 对抗）。
**Step 2（GREEN）:** resolve 后 append `RouteDecisionEvalEvent`（`agreed` 纯投影不存储）→ community-eval-domain → F192。**Step 3:** commit。

---

## 4. Open Questions

**技术 OQ（实现时自行解决）:**
- OQ-C0a: repo 轮询扩展 RepoScan vs 新建 poller（倾向扩展）
- OQ-C1a: guardian getRoster 本 Phase 收敛 vs Phase D（倾向 Phase D）
- SPIKE-1: narrator spawn 机制（C2.0 输出）

**价值 OQ（需 CVO 知情/判断，附 Decision Packet）:**
- **OQ-V1（F208 联动）— DECIDED（CVO 2026-06-12）**: F208 能力画像**采纳**为 narrator 的判断材料——narrator 路由推荐时引用 F208 画像（哪只猫擅长啥 × task 要啥能力）作上下文，**判断权在 narrator 猫，非画像算法自动拍板**（铲屎官原话："本质还是当事猫判断"，正合 KD-8 给数据不给结论）。Phase C 落地：narrator prompt 注入相关 F208 画像 + 简单规则（relatedFeature→feat thread）兜底；画像 → 自动路由权限走 eval 数据开（INV-13），不靠信任。

---

## 5. 预注册撤回条件（本 plan 最可能错在哪）

1. **narrator spawn 机制（SPIKE-1）若三候选都不干净** → C2 可能需要新机制，Phase C scope 放大；撤回信号 = SPIKE-1 超时无干净方案 → 升级讨论。
2. **RoleResolver 在单租户下过度抽象**（终态设计 §9.1 同款风险）→ 若家里只一个 narrator binding，配置层可薄，但接缝（注入点、零猫名 grep）必须留对，这是"不硬编码"最低承诺。
3. **repo 级轮询放大噪音**（终态设计 §9.2）→ 若 informational 占比 >90%，分级打扰阈值要重调；C0.4 存量排除 + 打扰分级是缓解。
4. **eval `agreed` 统计在低样本下无意义** → 自动路由"用数据开"需要足够样本，初期纯采集不开自动。

---

## 下一步

plan committed → `worktree`（Redis 6398 隔离环境）→ `tdd`（C0.1 先行，最独立解风险）。SOP 链条自主推进。
实现猫 = opus-4.8（宪宪，铲屎官指派自己持球执行）；review = 缅因猫跨族；愿景守护 = 非作者非 reviewer 第三猫。

[宪宪/Opus-4.8🐾]
