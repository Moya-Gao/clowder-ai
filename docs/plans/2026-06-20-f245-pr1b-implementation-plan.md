---
feature_ids: [F245]
topics: [friction, eval, live-sink, implementation-plan]
---

# F245 Phase C PR1b — Friction Live Sink 施工手册

> 固化日期 2026-06-20 · owner 布偶猫/宪宪 @opus-48 · 分支 `feat/f245-phase-c-pr1b`（基于 origin/main f430ae195）
> 来源：subagent 全量 recall（读 34 文件，196k tokens）→ 本手册。任何 session 接力照此实现，零重新 recall。
> 真相源 feat doc：`docs/features/F245-friction-signal-eval.md`

## 目标（PR1b scope）

PR1a 已 merged（squash 1b67516b9）：eval:friction domain 注册（`enabled:false`）+ pure report producer `buildFrictionRollupReport`。
**PR1b = live sink**：把 friction rollup 接进 eval verdict pipeline，让 `cat_cafe_publish_verdict` 对 `eval:friction` 可用。replayable-selector pattern，仿 capability-wakeup / task-outcome generator。
- AC-C1（completes）：flip `enabled:true`，cron 才会 pick up（`frequency: weekly` 保持，N-day 是 PR2）
- AC-C2（completes）：periodic rollup 真跑 live store（Top-N + sensorForm + 7-class）
- AC-C3（delivers）：verdict via F192 Verdict Handoff Packet（cat 提交 packet → verdict.md + bundle）

## Decisions Locked（owner 拍板，架构级自决 feedback_architectural_kd_autonomy）

1. **Selector 位置 = shared**（`packages/shared/src/types/friction-signal.ts`）。遵循交接 outline；理由：friction report/input types 已在 shared。**接受**与 api 包同类 selector（`MemoryRecallSourceSelector` 在 `publish-verdict/types.ts`）的位置不一致——report 类型同地优先。
2. **Bundle layout = task-outcome shape**：raw 写 `bundleDir/raw/`，**无 `extraStagedPaths`**。避开 capability-wakeup 的 `generated/` gitignore force-add gotcha。
3. **submittedPacket = required**（mirror task-outcome，非 optional）。root cause 7-class 由 eval cat 在 packet `rootCauseHypothesis` 给，**generator 不用 rule classifier**（KD-8 feedback_no_classifier_give_data）。
4. **Construction-ordering**：`index.ts` 把 `TaskOutcomeEpisodeStore` 构造移到 verdictGenerators block 之前（friction provider 要用它）。
5. **测试 = pure/stub-injected**（非 Redis-backed）。现有 friction 测试全是 stub 注入纯测试，mirror cw/memory/task-outcome 的 generator-adapter 测试。**修正交接 gotcha 5 的「Redis-backed」误解**。
6. **enabled flip = true + frequency weekly**，**同 PR 落地**（不单独提前 flip——`enabled:true` 但 generator 未 wired 会让 cron 调到 501）。
7. **count assertion 已是 6**（`eval-hub-read-model.test.js:233-238`，PR1a 改过），**不动**。

## 4 层改动清单（实现顺序：L1→L2→L3→L4，每层 build+test 绿再下一层）

### L1 — shared types + barrel
- `packages/shared/src/types/friction-signal.ts`（append after L167）：加 `FrictionRollupSourceSelector` interface
  ```ts
  export interface FrictionRollupSourceSelector {
    kind: 'friction-rollup-snapshot';
    windowStartMs: number;   // inclusive epoch ms
    windowEndMs: number;     // exclusive, must > windowStartMs
    topN?: number;           // default 10 in producer
    tokenCap?: number;       // default 4000 in producer
  }
  ```
- `packages/shared/src/types/index.ts`（L391-404 显式 export block，**非 export ***）：加 `FrictionRollupSourceSelector,` 到 alphabetized friction block
- **改 shared 后必 `pnpm --filter @cat-cafe/shared build`**（api 从 dist import，stale dist=假绿 feedback_review_sandbox_env_artifact_first）

### L2 — api union + validation + publish-verdict handler
- `packages/api/.../publish-verdict/types.ts`（L125-130）：import `FrictionRollupSourceSelector` from `@cat-cafe/shared`，加进 `VerdictSourceRefs` union
- `packages/api/.../publish-verdict/validation.ts`：
  - `isFrictionSourceRefs`（~L46，mirror `isMemorySourceRefs:32-36`）：`refs.kind === 'friction-rollup-snapshot'`
  - `validateFrictionRollupSelector`（after `validateMemoryRecallSelector` ~L124，非 throw 返回 `string|null`）：校验 kind / windowStartMs finite / windowEndMs finite / windowEndMs>windowStartMs / topN 正整数 / tokenCap 正整数
  - `inferSourceRefsKind`（L78-91）：返回类型 union 加 `'friction-rollup-snapshot'`，分支加在 **a2a 之前**（⚠️ `isA2aSourceRefs` 对 undefined/缺 kind 返回 true，是 backward-compat default，friction guard 必须在它前面）
- `packages/api/.../publish-verdict/publish-verdict.ts`：
  - import `isFrictionSourceRefs`, `validateFrictionRollupSelector`（L27-37）
  - `EXPECTED_REFS_KIND_BY_DOMAIN`（L199-205）：加 `'eval:friction': 'friction-rollup-snapshot'`
  - error `detail` 字符串（L208-212）：append friction 例子
  - validation dispatch chain（L215-242）：加 friction 分支（在 cw fallthrough 前）

### L3 — friction generator adapter + live-verdict + renderer + guard（新文件，每个 ≤350 行）
模板：`task-outcome/eval-task-outcome-live-verdict.ts` + `eval-task-outcome-renderer.ts`（最接近：submittedPacket required + bundle-only）。memory-generator-adapter.ts 是最干净的 adapter 模板。
- **新** `publish-verdict/friction-generator-adapter.ts`：定义 `FrictionMetricsProvider` port（`resolve(selector): Promise<FrictionRollupInput>`）+ `createFrictionGeneratorAdapter(provider): VerdictGenerator`。流程：guard kind → validate selector → `provider.resolve` → loadDomains 校验 domain==eval:friction → `generateFrictionLiveVerdict(...)` → `{verdictPath, bundleDir}`
- **新** `friction/eval-friction-live-verdict.ts`：`generateFrictionLiveVerdict({verdictId, harnessFeedbackRoot, domain, rollupInput, selector, submittedPacket})`。调 `buildFrictionRollupReport(rollupInput, generatedAt, {topN, tokenCap})`，写 `bundle/snapshot.json`+`attribution.json`+`provenance.json`+raw report 到 `bundleDir/raw/`，`resolveA2aEvidenceBundle` 解 bundle refs，写 verdict.md，返回 `{path, bundleDir}`
- **新** `friction/friction-submitted-packet-guard.ts`（mirror cw `submitted-packet-guard.ts:22+`）：校验 `domain.domainId==='eval:friction'` / `submitted.domainId===domain.domainId` / `submitted.harnessUnderEval.featureId===domain.handoffTargetResolver.featureId`（=F245）
- **新** `friction/eval-friction-renderer.ts`：`formatFrictionLiveVerdictMarkdown(...)` → verdict.md（YAML frontmatter：`feedback_type: live-verdict` / `domain_id: eval:friction` / `packet_id:`）
- ⚠️ **写 snapshot.json 前先读** `a2a/eval-a2a-artifact-resolver.ts` 的 `bundleSnapshotSchema`（确切必填字段：`evalSnapshotId`/`window.durationHours`/`components[].id/name` 等）。components 从 `topClusters` 构建（一 cluster 一 component，或一个 aggregate）

### L4 — provider impl + mcp-server schema + bootstrap + enabled flip
- **新** `friction/friction-metrics-provider-impl.ts`：见下「provider 数据来源」
- `packages/mcp-server/src/tools/publish-verdict-tool.ts`（⚠️ **独立 zod schema，最高风险遗漏点**）：
  - `frictionRollupSourceRefsShape`（after L214，mirror `memorySourceRefsShape:144-166`）：zod object kind literal + windowStartMs/EndMs number finite + topN/tokenCap int min1 optional
  - 加进 `sourceRefsShape` union（L217-223）
  - 加进 `PublishVerdictToolInput` TS union（L249-285）
  - tool description wired-domains GOTCHA（L314）加 `eval:friction`
- `packages/api/src/index.ts`（**两个分隔 ~2200 行的 block 都要改**）：
  - verdictGenerators block（after L1867）：构造 `FrictionMetricsProviderImpl` + `verdictGenerators['eval:friction'] = createFrictionGeneratorAdapter(provider)`
  - **移** `TaskOutcomeEpisodeStore`/`taskOutcomeDbPath` 构造（L1871-1873）到 friction block 之前（ordering，decision 4）
  - wiredPublishDomains block（L4021-4030）：`wiredPublishDomains.add('eval:friction')`（无条件，mirror task-outcome:4022）
- `docs/harness-feedback/eval-domains/eval-friction.yaml`：`enabled: false` → `true`（共享 doc，commit+push 零延迟）

## Provider 数据来源（4 channel，全只读 KD-4）

`FrictionMetricsProviderImpl.resolve(selector)` 组合 PR1a/Phase B 已建的 4 个 channel adapter：

| Channel | Adapter（已存在） | 后端 live source | 构造 |
|---|---|---|---|
| paw-feel | `PawFeelAdapter` | `IMessageStore.getBefore`（global TIMELINE zset） | `new PawFeelAdapter(messageStore)`（index.ts:536） |
| cancel | `CancelAdapter` | `TaskOutcomeEpisodeStore.listSignalsInWindow`（SQLite 只读） | `new CancelAdapter(taskOutcomeStore)`（index.ts:1873） |
| user-feedback | `UserFeedbackAdapter` | `RedisFrustrationIssueStore.listConfirmedInWindow`（F222 Redis 读） | `new UserFeedbackAdapter(frustrationIssueStore)`（index.ts:554） |
| eval-domain | `EvalDomainAdapter` | `<harnessFeedbackRoot>/bundles/*/snapshot.json`（FS 只读） | `new EvalDomainAdapter(harnessFeedbackRoot)` |

resolve body：
```ts
async resolve(selector) {
  const sources = [
    new PawFeelAdapter(this.deps.messageStore),
    new CancelAdapter(this.deps.taskOutcomeStore),
    new UserFeedbackAdapter(this.deps.frustrationIssueStore),
    new EvalDomainAdapter(this.deps.harnessFeedbackRoot),
  ];
  const aggregator = new FrictionAggregator(sources);
  const clusterer = new FrictionClusterer(this.deps.embeddingService); // undefined → fail-open degraded
  return buildFrictionRollupInput(aggregator, clusterer, selector.windowStartMs, selector.windowEndMs);
}
```
- deps 用 `Pick<>`（messageStore: Pick<IMessageStore,'getBefore'> 等），test stub 易写
- **KD-4 只读铁律**：4 adapter 全零写侧。friction generator **禁止任何 writeback**（不像 task-outcome 有 `buildEpisodeVerdictWriteback`）——无 afterPublish 副作用。唯一写 = verdict.md+bundle（publisher 在隔离 worktree owns）

## 契约 fan-out 全集（18 点）

已在 PR1a，**勿动**：eval-domain-registry.ts:12-19(domainId)/28-35(sourceAdapter)/83(EvalDomainId 自derive) · eval-friction.yaml(存在) · eval-hub-read-model.test.js:233-238(count 已 6)

PR1b 要加：

| # | 文件 | 位置 | 改 |
|---|---|---|---|
| 1 | shared/.../friction-signal.ts | append 167 | FrictionRollupSourceSelector |
| 2 | shared/.../types/index.ts | 391-404 | export selector |
| 3 | api/.../publish-verdict/types.ts | 125-130 | union + import |
| 4 | api/.../validation.ts | ~46 | isFrictionSourceRefs |
| 5 | api/.../validation.ts | ~124 | validateFrictionRollupSelector |
| 6 | api/.../validation.ts | 78-91 | inferSourceRefsKind（a2a 前） |
| 7 | api/.../publish-verdict.ts | 199-205 | EXPECTED_REFS_KIND_BY_DOMAIN |
| 8 | api/.../publish-verdict.ts | 208-212 | detail 串 |
| 9 | api/.../publish-verdict.ts | 215-242 | dispatch 分支 + import 27-37 |
| 10 | mcp-server/.../publish-verdict-tool.ts | ~214 | frictionRollupSourceRefsShape |
| 11 | mcp-server/.../publish-verdict-tool.ts | 217-223 | sourceRefsShape union |
| 12 | mcp-server/.../publish-verdict-tool.ts | 249-285 | TS input union |
| 13 | mcp-server/.../publish-verdict-tool.ts | 314 | description |
| 14 | api/src/index.ts | after 1867 | provider + verdictGenerators |
| 15 | api/src/index.ts | 1871-1873 | 移 TaskOutcomeEpisodeStore 上 |
| 16 | api/src/index.ts | 4021-4030 | wiredPublishDomains.add |
| 17 | eval-friction.yaml | enabled | false→true |
| 18 | 新文件 ×5 | — | adapter/live-verdict/renderer/guard/provider |

> EvalDomainId 是 `z.infer` 自 registry enum derive（registry:83），verdictGenerators/wiredPublishDomains 类型 `Partial<Record<EvalDomainId,...>>`/`Set<EvalDomainId>` **自动接受** 'eval:friction'，无需额外类型编辑（PR1a DRY收敛红利）

## 测试策略（pure/stub-injected，node --test，import dist）

改 src 后必 `pnpm --filter @cat-cafe/api build`（test import dist）。
1. `friction-generator-adapter.test.js`（mirror capability-wakeup-generator-adapter.test.js）：stub provider，断言 wrong-kind→`friction_adapter_wrong_kind` / invalid selector→`invalid_source_ref` / unknown domain→`unknown_domain` / happy path verdictPath+bundleDir 落盘 + provider 收到原 selector。tmp harnessFeedbackRoot 要 seed eval-friction.yaml（现有 `setupHarnessFeedback` fixture 只 seed 5 domain 不含 friction，inline 补）
2. `eval-friction-live-verdict.test.js`（mirror sop-generator-adapter.test.js）：verdict.md frontmatter + bundle 3 文件 + snapshot 符合 a2a schema + refs canonical `snapshot:bundle/` 前缀
3. `publish-verdict-friction.test.js`（mirror publish-verdict-memory.test.js）：handlePublishVerdict e2e，accept eval:friction+friction-rollup-snapshot / kind↔domain cross-check / 501 无 generator / provider-empty→4xx 非 500
4. validation 单测：isFrictionSourceRefs / inferSourceRefsKind→'friction-rollup-snapshot' / validateFrictionRollupSelector accept+reject
5. mcp-server schema 测：grep `packages/mcp-server/test` 找现有 publish-verdict-tool 测，有则加 friction case；无则加 zod round-trip
- TDD：每测先红。full suite `pnpm --filter @cat-cafe/api test` + `pnpm check` + `pnpm lint`（repo 工具链，非 npx）

## Gotcha 全集

1. **mcp-server 独立 schema（最高风险）**：zod union 缺 friction → 在 zod 边界 reject，到不了 api handler。3 处（schema/TS union/description）都要加
2. `isA2aSourceRefs` 对 undefined 返 true → friction guard 必须在 a2a 前（L2 #6）
3. index.ts 两个 wiring block ~2200 行隔开，都要加（verdictGenerators + wiredPublishDomains），漏第二个=split-brain
4. construction-ordering：TaskOutcomeEpisodeStore（1871-1873）在 verdictGenerators（1823-1867）后，移上去
5. KD-8 no classifier：root cause 由 packet 给，generator 不填 rule-based
6. frequency 仍 daily|weekly enum，yaml weekly 正确，**勿加 N-day**（PR2）
7. recursion 自觉：eval-domain channel 读 bundles snapshot frictionCounts，friction verdict 自己也产 snapshot.json frictionCounts → 自身成未来 friction signal（by-design，别 emit 巨量自放大 count）
8. enabled:false 是 silent-fire guard，flip true 必须和 generator 同 PR
9. submittedPacket required（mirror task-outcome），guard 校验 featureId=F245
10. 350 行硬限 + LSP：拆 generator/renderer/guard。每 Edit 看 `<new-diagnostics>`，`pnpm check`/`pnpm biome`（非 npx feedback_verify_with_repo_toolchain）
11. shared build 步：改 shared 后 `pnpm --filter @cat-cafe/shared build`
12. **cross-thread ping at merge**（F245 doc:153）：PR1b 落 F236 Track-2 依赖的 shared eval-domain infra → merge 时 `cat_cafe_cross_post_message` ping @opus-48 @ thread_mqg1ek0wfttbxt4l
13. grep consumers before contract change：VerdictSourceRefs union 是 discriminated union，§D 18 点就是那次 grep，一次改全 + 一起跑测

## 实现前必读（load-bearing，未完全 trace）
- `a2a/eval-a2a-artifact-resolver.ts` 的 `bundleSnapshotSchema`（snapshot.json 必填字段）
- `task-outcome/eval-task-outcome-live-verdict.ts` 全文（buildSnapshot/buildAttribution/provenance pattern）
- `task-outcome/eval-task-outcome-renderer.ts`（renderer 模板）
- `packages/mcp-server/test/`（确认有无 publish-verdict-tool schema 测）

## 收尾 SOP
quality-gate 自检 → request-review（跨个体，优先 @gpt52/@opus 便宜等价，reviewer_cost_routing）→ receive-review → merge-gate（pnpm gate 全量 rebased main + 云端 review，LL-072：cloud 5轮/>50%FP→停交 gpt52 final）→ cross-thread ping @opus-48 → feat doc sync
