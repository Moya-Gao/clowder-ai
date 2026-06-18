---
title: "F167 Gate-Keeping Thread Guard — Quality Gate Report"
feature: F167
type: quality-gate-report
date: 2026-06-17
---

# F167 Gate-Keeping Thread Guard — Quality Gate Report

Spec: `docs/plans/2026-06-17-f167-gate-keeping-thread-guard.md`
原始需求来源: 主 thread `thread_mp3ab0r9xqxrkrc5` 的诊断 + 平行 thread `thread_mqiwk2ir6u1jyrbk`
检查时间: 2026-06-17 03:50 UTC
Author / Executor: 布偶猫 / 宪宪 (@opus-47, claude-opus-4-7)

## 愿景覆盖（Step 0）

| # | 原始诊断需求 | AC/INV 覆盖 | 实现状态 |
|---|------------|-----------|--------|
| 1 | 同 session 同天 2 只猫违规挂 PR tracking → 双 owner，需 trigger-time 阻塞 | INV-G2 | ✅ register_pr_tracking guard 400 |
| 2 | 同样违规挂 hold_ball → 球权死锁，需 trigger-time 阻塞 | INV-G2 | ✅ hold_ball guard 400 |
| 3 | 守门猫 vs 下游 owner 的边界——下游 owner 不应被误伤 | INV-G3 | ✅ override='i-am-the-downstream-owner' |
| 4 | 文字层 100%/trigger-time 0 enforcement = 三层 harness 缺角 | ADR-031 三层完整 | ✅ 软层 (SKILL) + 硬层 (guard) + eval (telemetry) |
| 5 | F229 R19 P2 crash-window 教训：marker stamping 必须 self-heal | INV-G5 + self-heal | ✅ ensureInboxThread 双路径 markGateKeepingKind |
| 6 | Fail-open 不阻塞生产：threadStore 抖动不让 PR tracking 链路挂 | INV-G7 | ✅ guard_skipped + log.warn |

## Delivery Completeness（Step 0.5）

- ✅ 完整 feat：硬+软+eval 三层全部到位（Phase 7 migration script 走 OQ-2 既定方案另开 small PR + CVO signoff）
- ✅ 后续可扩展不需重写（GateKeepingMetricCounter / ThreadKind union 都是扩展点）

## 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | ThreadKind union 扩展加 'gate-keeping' | ✅ | `packages/shared/src/types/concierge.ts:65-72` | tsc + build pass |
| 2 | ThreadStore.updateThreadKind signature 接受 ThreadKind | ✅ | `ports/ThreadStore.ts:467, 858` + `redis/RedisThreadStore.ts:583, 1227` | regression 31/31 |
| 3 | gate-keeping-guard helper 复用 | ✅ | `packages/api/src/routes/gate-keeping-guard.ts` | 13/13 guard tests |
| 4 | register_pr_tracking default-block | ✅ | `callbacks.ts:2247` + override schema | 4/4 INV-G2/G3/G4/G7 |
| 5 | register_issue_tracking default-block | ✅ | `callbacks.ts:2363` | 3/3 INV-G2/G3/G4 |
| 6 | hold_ball default-block | ✅ | `callback-hold-ball-routes.ts:117` | 3/3 INV-G2/G3/G4 + 16/16 regression |
| 7 | MCP client 三 tool schema 加 override + handler 透传 | ✅ | `mcp-server/src/tools/callback-tools.ts:1130, 1184, 2207` | tool-registration 19/19 |
| 8 | ensureInboxThread 创建 inbox thread 后 stamp marker | ✅ | `GitHubRepoWebhookHandler.ts:489-528` markGateKeepingKind | INV-G5 + idempotent |
| 9 | self-heal pre-existing binding | ✅ | `GitHubRepoWebhookHandler.ts:530-543` selfHealGateKeepingKind | self-heal test ✅ |
| 10 | F192 telemetry counter | ✅ | `instruments.ts:143-160` gateKeepingHarnessAttemptCount | 13/13 tests 不破坏 |
| 11 | opensource-ops SKILL.md reflex line | ✅ | top blockquote + Common Mistakes 表 | check:skills:manifest PASS |
| 12 | Plan 文档（含 Stateful Object Gate） | ✅ | `docs/plans/2026-06-17-f167-gate-keeping-thread-guard.md` | INV-G1~G7 + 状态转移表 + 对抗场景 |

## Architecture Ownership（Step 2.7）

- Architecture cell: infrastructure/harness-enforcement
- Map delta: none
- Why: 在 F229 threadKind union + 现有 callbacks 路由层扩展，不引入新 cell
- Diff mismatch scan: 无新 Store/Queue/Router/Adapter ✅

## Stateful Object Gate ✅（F229 PR-A1 教训前置）

完整 census + 状态×事件转移表 + INV-G1~G7 + 对抗场景见 plan 文档 §"Stateful Object Gate"。
关键覆盖：
- ✅ INV-G1 mutual exclusion (TypeScript union)
- ✅ INV-G5 marker stamping (test ensureInboxThread)
- ✅ INV-G6 F128 propose-thread 不被打 gate-keeping (默认 undefined + 自然受保护)
- ✅ INV-G7 fail-open (guard_skipped path)
- ✅ Crash window: self-heal 补救（pre-rollout / bind-succeeded-no-stamp）
- ✅ 并发双写: KD-20 NX lock 复用

## Fallback Layer Check（Step 2.6）

新增 fallback 层数：guard 内部 1 层 (`?? gateKeepingHarnessAttemptCount`) + 异常 1 层 (`try/catch → guard_skipped`) = 2 层。**坐标系正确**——fail-open 是显式 INV-G7 设计，不是补锅。✅

## Artifact Hygiene（Step 7.5）

仓库根目录媒体/设计工件: 无 ✅

## Dogfood-Your-Slice（Step 4.5）

Scope verdict: 🆗 可豁免（理由：本 feat 是 trigger-time MCP guard，无 user-visible UI 改动；典型用户路径走的是「猫调 MCP tool 守门 thread → 收到 400 错误 + remediation」的失败路径，已被 4/4 INV-G2 测试 with full error message assertion 覆盖；猫体感的 "学到 trigger-time block" 是经 telemetry F192 weekly verdict 长期 dogfood，不是单 PR 闭环）

## 验证命令输出（这次真实运行）

```
env -u NODE_ENV pnpm check
→ ✓ All 27 checks passed (128452ms total)

env -u NODE_ENV pnpm lint
→ Done (只剩 pre-existing F056 shadow rgba warnings + react-hooks/exhaustive-deps，不在 PR scope)

env -u NODE_ENV pnpm --filter @cat-cafe/api build
→ exit 0

env -u NODE_ENV pnpm --filter @cat-cafe/mcp-server build
→ exit 0

env -u NODE_ENV node --test [F167 + critical regression suite]
→ 176/176 pass, 0 fail
  - F167 gate-keeping guard: 13 tests (INV-G2/G3/G4/G7 across 3 endpoints)
  - F167 Phase 5 marker stamping: 3 tests
  - F167 regression: hold-ball (16/16), webhook (31/31), tool-registration (19/19)
  - callback-routes.test.js full suite (includes existing register-pr-tracking tests)

env -u NODE_ENV pnpm --filter @cat-cafe/api test:redis
→ [pending background, will report in commit message before merge]
```

## Pen / UI Check（Step 5）

- glob `designs/**/*.pen` 匹配本 feat：**无匹配**（pure backend trigger-time guard）
- 前端 UI 改动：无 (packages/web/* 未触碰)
- ➖ 无 UI 改动

## 47 盲审规则（F177 Phase B）

- 作者: @opus-47
- Quality-gate 执行: @opus-47 (self-pre-check before review)
- 正式 review: 必须由对家猫执行（@codex 砚砚优先；@gpt52 / @opus(4.6) 兜底）— 见 request-review step
- 47 的自评不计入放行判据 ✅（仅作为 review packet）

## 总结

7 个 commits clean，三层 harness（硬层 default-block + 软层 SKILL reflex + eval telemetry）齐全，Stateful Object Gate 7 个 INV 全覆盖，176/176 tests pass，27/27 pnpm check phases pass。

下一步: 加载 `request-review`，跨族 @codex（缅因猫家族）请 review；本次 review 必须由对家猫执行（47 盲审规则）。

[宪宪/Opus 4.7🐾]
