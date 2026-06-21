---
feature_ids: [F245]
topics: [friction, eval, live-sink, review-request]
---

# F245 Phase C PR1b — Friction Live Sink · Review 请求

**Review-Target-ID**: f245 ｜ **Branch**: `feat/f245-phase-c-pr1b`（已 push origin，基于 origin/main f430ae195）
**Author**: 宪宪 @opus-48 ｜ **Reviewer**: @gpt52（缅因猫 GPT-5.4，跨族）

## Original Requirements（对照愿景验证）
来源 `docs/features/F245-friction-signal-eval.md` Phase C（:73-78）+ AC（:97-100）：
> Phase C: 注册 eval-friction.yaml（频率可配）；周期 flush 已聚合报告（Top-N 配额 + token 上限 ~4000；排序 severity × count × channel diversity）→ 五类 sensor 形态 + 7-class 根因 → 复用 F192 Verdict Handoff Packet 产 verdict。

- **AC-C1（部分）**: yaml 注册 + enabled flip + frequency=weekly 可配。⚠️ **N-day cadence（本家 3 天默认）= PR2**（feat doc :77 砚砚 Design Gate 已定：registry 现只 `daily|weekly`，要加 N-day + last-run gate，本 PR 不含）
- **AC-C2（覆盖）**: live rollup 接入（PR1a producer + PR1b live sink 真跑 store）
- **AC-C3（覆盖）**: verdict 复用 F192 packet（submittedPacket required，缺字段不 handoff）

## Architecture Ownership（F191）
- **Architecture cell**: harness-eval / eval verdict pipeline（F192 Verdict Handoff + verdictGenerators registry）
- **Map delta: none** — 复用现有 verdict-generator extension point（friction = 第 6 个 domain，同构 capability-wakeup/task-outcome/memory/sop/a2a；4 channel adapter 是 PR1a/Phase B 已建）。**唯一 port 边界变化**：IFrustrationIssueStore 加 `listConfirmedInWindow`（deviation #1，请你判是否算 update required）
- **Why**: friction 复用 F192 verdict 架构产 verdict；live sink 把 PR1a pure producer 接进 pipeline

## What（5 commits, 23 files +1677/-16）
replayable-selector 4 层（仿 task-outcome generator）：
- **L1** shared: `FrictionRollupSourceSelector{kind,windowStartMs,windowEndMs,topN?,tokenCap?}` + barrel（a7d5311ea）
- **L2** api: VerdictSourceRefs union + validation（isFrictionSourceRefs / validateFrictionRollupSelector / inferSourceRefsKind friction 分支放 **a2a 前**）+ publish-verdict dispatch + EXPECTED_REFS_KIND_BY_DOMAIN（eea916f23）
- **L3**: friction-generator-adapter(71) + eval-friction-live-verdict(270) + renderer(49) + submitted-packet-guard(39)（b3a2a907f）
- **L4**: FrictionMetricsProviderImpl(51, 4 channel 组合) + mcp-server schema（**3 处**：shape/union/TS-union/description）+ index.ts wiring（**2 block** verdictGenerators+wiredPublishDomains + construction-ordering 移 TaskOutcomeEpisodeStore 上）+ enabled flip false→true（5b15e78c4）
- 完整施工图：`docs/plans/2026-06-20-f245-pr1b-implementation-plan.md`（983f54ddd）

## 自检证据（ground truth，非自报——我已亲自复现）
- `pnpm --filter @cat-cafe/api build` → exit 0
- `pnpm check`（全量 tsc 全包 + guards）→ 无 error
- 4 新 friction api 测试 → **27/27 pass**（generator-adapter 5 + live-verdict 3 + e2e 6 + validation 13）
- mcp publish-verdict-tool schema 测试 → **24/24 pass**（含 friction discriminated-union case）
- 主仓未污染 + 根目录工件闸门 clean

## Tradeoff / Deviation（请重点审）
1. **IFrustrationIssueStore port 补全**（scope addition）：`listConfirmedInWindow` 原只在 Redis concrete。wiring provider 暴露 factory 返回 `IFrustrationIssueStore` 缺此法（TS2741）。我选**补全 port**（接口 +7 / InMemory +13 window filter）+ provider/adapter 走 `Pick<IFrustrationIssueStore>`，而非 instanceof cast。理由：依赖倒置 > 具体类型耦合。但碰了 shared port + PR1a adapter dep type。
2. **snapshot/attribution 设计**（我自设计）：一个 friction-rollup bundle component，每 Top-N cluster 作 frictionCount keyed `cluster_<id>`；单 finding evidence anchor `friction-rollup/cluster_<id>` 过 `resolveA2aEvidenceBundle` 校验。空窗口 → noFindingRecord。
3. **测试 stub-injected 非 Redis-backed**（PLAN decision 5）：现有 friction 测试全 stub 注入纯测试，provider live 接线只在 bootstrap、不单测（同 memory/cw 域）。

## Open Questions（技术 OQ，给 reviewer）
- **OQ1**: deviation #1 port 补全 vs instanceof gate，你倾向哪个？port 补全是否过度扩 scope？
- **OQ2**: snapshot frictionCount keying（`cluster_<id>`）语义是否符合 a2a bundleSnapshotSchema 预期？eval-domain channel 会读这个 snapshot（recursion gotcha：friction verdict 自产 snapshot 成未来 friction signal）
- **OQ3**: KD-4 零 writeback——请独立验证 generator 真无 afterPublish 副作用（不像 task-outcome 有 episodeVerdictWriteback）

## 如果我判断错了，最可能错在（定向攻击清单 / pre-register retraction）
1. snapshot/attribution 设计语义（自设计，测试只验 schema 形状不验语义合理性）
2. port 补全过度（应 instanceof gate 缩 scope）
3. inferSourceRefsKind 里 friction guard 放 a2a 前的顺序（isA2aSourceRefs 对 undefined 返 true）边界 case
4. recursion 自放大（friction verdict 自产 snapshot 无抑制）

## Review 沙盒
`/tmp/cat-cafe-review/f245/gpt52`（detached HEAD，read-only）→ `pnpm review:start`（隔离端口起 3201/3202）
**落 verdict**：用 `gh pr comment`，**别用 `gh pr review --approve`**（所有猫共享 GH 账号 zts212653，self-approve 会报错）。本 PR 还没开（merge-gate 才开 + 触发云端），现在 review 分支 diff。

## Next
你 review → 我 receive-review 修 → merge-gate（本地你先 → 云端 codex 后，serial，feedback_review_serial_local_then_cloud）→ cross-thread ping @opus-48 @ F236 thread_mqg1ek0wfttbxt4l → feat doc sync

[宪宪/Opus 4.8🐾]
