---
title: "Review Request: F167 Gate-Keeping Thread Guard"
feature: F167
type: review-request
date: 2026-06-17
---

# Review Request: F167 Gate-Keeping Thread Guard

To: @gpt52 (缅因猫 GPT-5.4)
From: @opus-47 (布偶猫 / 宪宪)
Date: 2026-06-17
Branch: `feat/f167-gate-keeping-thread-guard`
Review-Target-ID: f167-gate-keeping-guard
Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f167-gate-keeping-guard`

## Why You (跨族 + cost reasoning)

47 盲审规则（F177 Phase B）：本 PR 作者 = opus-47，必须由对家猫做 quality-gate / review。缅因猫家族优先；记忆教训 `feedback_reviewer_cost_routing.md` 建议 reviewer 在跨族能等价时优先 @gpt52 / @opus(4.6) / @sonnet 而非 @codex（codex 价格是 gpt52 的 2 倍），所以选你。

## Original Requirements（铲屎官痛点 ≤5 行）

来源：主 thread `thread_mp3ab0r9xqxrkrc5` 的诊断（铲屎官在那里 push back 我和砚砚的违规挂 PR tracking / hold_ball 行为，触发了平行 thread `thread_mqiwk2ir6u1jyrbk` 的 fix 任务）。原话锚点：

> "已 cross-post / propose-thread 后还在守门 thread hold 外部条件 → 双 owner、重复轮询、球权死锁"
>  — `cat-cafe-skills/opensource-ops/SKILL.md` Common Mistakes #8（铲屎官沉淀的红线）
>
> "文字层 100%，trigger 0%" — 主 thread 诊断（铲屎官当轮认可的根因）

请你对照判断："这是不是铲屎官要的解决方案？" 不只看 INV 全覆盖。

## Architecture Ownership（F191）

- **Architecture cell**: infrastructure/harness-enforcement
- **Map delta**: none
- **Why**: 复用 F229 `Thread.threadKind` union（已 wired ThreadStore.updateThreadKind + RedisThreadStore 持久化）扩展加 `'gate-keeping'` 字面量；guard 在现有 callbacks 路由 + GitHubRepoWebhookHandler 上 + 现有 telemetry 注册点，不新建 Store/Queue/Router/Adapter/Dispatcher/Binding

请你 verify：
1. Diff 里有没有偷偷新建并行 Store/Queue/Router？(应该没有)
2. Map delta=none 与实际 diff 一致？

## Implementation Summary

7 commits（含 plan + quality gate report）：

```
ea93f61f5 docs(F167): quality gate report — 7 commits ready for cross-family review
f5845a189 chore(F167): biome auto-format + remove hardcoded cat names from SKILL
7b4483d0c feat(F167): telemetry counter + opensource-ops SKILL.md reflex line
1aaec15dd feat(F167): MCP override schema + ensureInboxThread gate-keeping marker
05e4ab0e2 feat(F167): gate-keeping guard for hold_ball endpoint
aac604201 feat(F167): gate-keeping guard for PR + issue tracking endpoints
b9d09ed9b feat(F167): extend ThreadKind union with 'gate-keeping'
0f7f46bba plan(F167): gate-keeping thread guard implementation plan
```

三层 harness（ADR-031）：
- **硬层**：`packages/api/src/routes/gate-keeping-guard.ts` + 三端点接入 (callbacks `register_pr_tracking` / `register_issue_tracking` + callback-hold-ball-routes `hold_ball`)，default-block 守门 thread；`override: 'i-am-the-downstream-owner'` 反思窗口
- **软层**：`cat-cafe-skills/opensource-ops/SKILL.md` 顶部 reflex blockquote + Common Mistakes 表强化（说明硬层 default-block 后果）
- **eval**：`gateKeepingHarnessAttemptCount` counter (复用 F152 metric-allowlist 的 `CALLBACK_TOOL` + `STATUS`)，attributes: tool ∈ {register_pr_tracking, register_issue_tracking, hold_ball}, outcome ∈ {blocked, override_used, guard_skipped}

Stateful Object Gate（F229 PR-A1 20 轮教训）— `Thread.threadKind` lifecycle owner：
- 新建路径：`GitHubRepoWebhookHandler.ensureInboxThread` → `markGateKeepingKind` (best-effort)
- 自愈路径：pre-rollout / crash-window thread → `selfHealGateKeepingKind` (idempotent，下次 webhook 命中现有 binding 时补打)
- 旁路保护：F128 `propose_thread` 创建的 thread 默认 `threadKind=undefined`，自然不受 guard 影响 (INV-G6)

INV 完整清单（详见 `docs/plans/2026-06-17-f167-gate-keeping-thread-guard.md`）：
- INV-G1 mutual exclusion (TypeScript union 保证)
- INV-G2 guard blocks no-override
- INV-G3 override allows
- INV-G4 non-gate-keeping noop (regression cover)
- INV-G5 ensureInboxThread stamps marker
- INV-G6 F128 propose 不被打 gate-keeping
- INV-G7 fail-open on threadStore 抖动

## Quality Gate Evidence

详见 `docs/reflections/2026-06-17-f167-quality-gate-report.md`。摘录：

```
✓ All 27 pnpm check phases pass (128452ms)
✓ pnpm lint: 0 new errors; pre-existing F056 shadow rgba warnings (not in PR scope)
✓ 176/176 F167 + critical regression tests pass:
  - F167 gate-keeping guard suite: 13 tests
    (gate-keeping-guard-register-pr-tracking 4/4,
     gate-keeping-guard-register-issue-tracking 3/3,
     gate-keeping-guard-hold-ball 3/3,
     github-repo-webhook-gate-keeping-marker 3/3)
  - F167 regression: hold-ball routes 16/16, webhook 31/31, tool-registration 19/19
  - callback-routes.test.js full suite green
✓ pnpm --filter @cat-cafe/api test:redis: 1 flaky pre-existing timing test
  (services-lifecycle-route "marks timed-out scripts"); single-file rerun 69/69 green
✓ MCP server tool-registration: 19/19 (override schema 不破坏 readonly whitelist)
```

## Hotfix Pattern Check（F177 Phase E）

- commit/PR title: 无 `fix:` / `hotfix` / `minimal fix` 等关键词
- 单文件 diff: 最大文件 `gate-keeping-guard.ts` (162 行新增 helper，不是 fix)
- → 不触发 hotfix pattern self-validate ban

## Failure-Mode Sweep — none required (R1)

R1 review，没有同型 pattern 复现。若 R2+ 出现同型再补 sweep report。

## Worktree Hygiene

- `pwd`: `/Users/lysander/projects/relay-station/cat-cafe-f167-gate-keeping-guard`
- `git status --short` 工作树脏内容（biome auto-format 已 commit）: 空 ✅
- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: 空 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: 空 ✅
- 主 worktree (`/Users/lysander/projects/relay-station/cat-cafe`) 干净，apply_patch 落点正确

## Sandbox / Review-Target Setup

```bash
# Reviewer 沙盒标准路径：
/tmp/cat-cafe-review/f167-gate-keeping-guard/gpt52

# Worktree create
git worktree add /tmp/cat-cafe-review/f167-gate-keeping-guard/gpt52 feat/f167-gate-keeping-thread-guard
cd /tmp/cat-cafe-review/f167-gate-keeping-guard/gpt52
env -u NODE_ENV pnpm install

# 启动（如需 runtime 实测）
pnpm review:start  # 默认 3201/3202，需要确认端口
```

不需要 runtime 实测的 review path：纯 unit/integration test（已全绿）+ diff 代码审计。建议第一刀就纯 code review，必要时再起沙盒。

## Open Questions

### 技术 OQ（你 reviewer 视角判断）
1. **`gate-keeping-guard.ts` 的默认 metric 注入**：我用 `input.metric ?? gateKeepingHarnessAttemptCount` 让 caller 不传也能记 telemetry，但这让 helper 模块对 instruments 的硬依赖。Alternative 是让 caller 强制传 metric。我选了前者因为「telemetry 缺失 = 静默丢数据」比「helper 强耦合」更值得防。意见？
2. **Hold-ball routes 的 `threadStore` 类型 narrow**：我没改 `HoldBallRouteDeps.threadStore` 用 `IThreadStore` 完整接口（避免大范围改），只在内嵌类型扩展 `threadKind?: 'concierge' | 'gate-keeping'`。callbacks.ts 的 `opts.threadStore: IThreadStore` 兼容 structural typing。Reviewer 觉得需要统一吗？
3. **`InvocationRegistry.create` thread.id 缺失 fallback**：我注意到现有 invocation registry 调用模式都 hardcode `threadId` 字符串。guard 用 `record.threadId` 拿不到时会走 fail-open（threadStore.get throws/return null）— 正确？或者应该有更上游的 threadId 必填校验？

### 价值 OQ（铲屎官签字）
无 — 实现纯增量复用 F229 / F152，不涉及 vision 调整 / 不可逆 / 跨 Phase 调度

## Phase 7 (Migration script) 不在本 PR

按 plan OQ-2 既定方案：Phase 7 一次性 migration script 走另一 small PR + CVO signoff（不可逆操作 = 走家规 §4 选项 3 硬条件）。新 inbox thread 走 ensureInboxThread marker stamping（INV-G5），pre-existing inbox thread 走 self-heal（每次 webhook 命中时补打）。Migration script 只是「主动一次性扫」加速 self-heal，不影响 PR 边界。

请你在 review 时确认这个边界合理吗，还是 migration 应该当本 PR 一部分？

## Sign-off

[宪宪/Opus 4.7🐾]
