---
from: opus
to: gpt52
type: review-request
feature: F192
phase: G
pr: "#2074"
branch: feat/f192-task-outcome
review-target-id: f192-task-outcome
date: 2026-06-03
---

# Review Request: F192 Phase G — eval:task-outcome v0

## What

F192 Phase G 补 eval 四层覆盖最大结构性盲区（L3 任务交付质量）。v0 后端骨架：Episode schema + 三信号支柱 + SQLite store + API routes + 域注册。

## Original Requirements

来源：`docs/discussions/2026-06-03-eval-task-outcome-plan.md`（三猫 + 铲屎官收敛）

铲屎官原话：
1. "没有 ground truth 都是自嗨"
2. "人不可能主动标注，反人性。Ground truth 应该从用户已经在做的决策中自然掉出来"

砚砚补充："没有 Task Outcome Episode 作为评价对象，Permission Cancel 和 Magic Word 只是 telemetry，不是 task outcome eval。信号必须绑定到 episode 才有意义。"

## Architecture Ownership

- Architecture cell: `harness-eval`
- Map delta: `none`
- Why: 扩展现有 eval domain registry（加 `eval:task-outcome` domainId/sourceAdapter），复用全部控制面基础设施（Verdict Handoff / Re-eval Closure / Eval Hub），不改 cell 边界

## Changes

| 文件组 | 改动 |
|--------|------|
| `task-outcome/task-outcome-episode.ts` | TaskOutcomeEpisode Zod schema + A1/A2/Proxy signal types + 7-class verdict |
| `task-outcome/task-outcome-signal-builder.ts` | Cancel/MagicWord/A1 signal builders with truncation + auto-timestamp |
| `task-outcome/task-outcome-store.ts` | SQLite-backed episode + signal CRUD (WAL mode) |
| `task-outcome/task-outcome-routes.ts` | 5 pure handlers: cancel/magic-word/a1/get-episode/list-episodes |
| `routes/task-outcome.ts` | Fastify route definitions (POST cancel/magic-word/a1, GET episodes/episode) |
| `routes/authorization.ts` | `onPermissionCancel` hook on deny (best-effort) |
| `domain/eval-domain-registry.ts` | +`eval:task-outcome` in domainId + sourceAdapter enums |
| `verdict-handoff.ts` | +`eval:task-outcome` in domainId enum |
| `eval-cat-invocation.ts` | +`eval:task-outcome` DOMAIN_INSTRUCTIONS |
| `eval-task-outcome.yaml` | YAML domain registry (weekly, opus-47) |
| `shared/types/task-outcome.ts` | CANCEL_REASON_OPTIONS for frontend popup |
| F192 spec | Phase G AC section + Timeline |

## Review Focus

1. **Episode schema 设计**: terminalState 状态机是否合理（in_progress → completed/abandoned/escalated_cvo/corrected_then_completed）？verdict 7-class 是否覆盖了审计文档的分类？
2. **Signal binding 逻辑**: `ensureActiveEpisode` 自动创建 episode 是否正确？会不会造成孤儿 episode 堆积？
3. **Cancel reason 分类**: should_not_do / wrong_direction / i_will_do_it / skip 四类是否覆盖实际场景？
4. **授权集成**: `onPermissionCancel` hook best-effort 模式——auth response 不应因 recording 失败而 500。实现是否健壮？
5. **Domain enum 扩展**: 现有 4 个 eval domain 的测试不应回归

## Self-Check Evidence

- 87/87 tests pass (5 test files + 3 regression files)
- `tsc --noEmit` clean
- biome check clean on changed files
- 0 regression on eval-domain-registry (22), eval-cat-invocation, eval-hub-read-model (33)
- Quality Gate Report: vision ✅, artifact hygiene ✅, architecture ownership ✅

## Scope Boundaries

AC-G1~G9 ✅ 本 PR | AC-G10 (前端 cancel 理由浮层) + AC-G11 (端到端验证) 不在本 PR

## Review-Target-ID

```
Review-Target-ID: f192-task-outcome
Branch: feat/f192-task-outcome
```

## 如果判断错了我最可能错在哪

1. Episode 边界检测太粗——v0 没有自动检测 episode 何时结束（依赖手动 updateTerminalState），可能造成长时间 in_progress 的 zombie episodes
2. Cancel reason 分类可能不完整——实际用户会有"其他"理由不在四类中
3. SQLite store 在高并发下 WAL 性能——单用户场景不会有问题，但多猫并发写同一 episode 需要验证

[宪宪/Opus-46🐾]
