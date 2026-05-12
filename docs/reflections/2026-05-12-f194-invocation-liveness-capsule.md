---
capsule_id: "F194-2026-05-12"
context: "后端 invocation 活性真相源收口 + bubble identity contract — 10 phase (A+B+Z~Z10) 修 14 条铲屎官报告"
feature_ids: [F194]
doc_kind: capsule
created: 2026-05-12
---

## What Worked

- **三猫独立诊断收敛**（opus-47 + 砚砚 + opus-46）——Z8 方向选择（top-down unified projection vs bottom-up per-record stamp）靠三猫各自读代码给出不同视角，最终收敛到正确方向：先统一投影规则（Z8），再补后端 identity stamp（Z9）
- **Z9 hotfix 的 1-line fix 拯救了整条链**——safeParseExtra 默默丢弃 turnInvocationId 是典型的"写入正确但读出错误"，被 47 在 alpha 4-turn 成语游戏中抓到。Z1-Z9 白做了直到这一行修好
- **replay fixture 方法论**——用铲屎官真实 thread 的 raw records 做 fixture（z8-alpha-3-records.json），证明 hydrate ≡ live byte-identical，比 mock 更有说服力
- **铲屎官连续 push back 方法论**（"你们总修不全怎么办呢？"）——逼出了从 Z1-Z7 局部 reducer patch 到 Z8/Z9 contract-level 修法的跃迁

## What Failed

- **Z1-Z7 连续 7 轮 frontend-only patch 未解决根因**——每轮修完 alpha 仍裂，本质是坐标系错了（前端猜后端 group key vs 后端明确 stamp identity）
- **Z4 deriveBubbleId 公式引入新 bug**——helper 创建 placeholder id 时不知道 eventKind，跟 reducer 的 kind suffix 路径冲突。Z4 反而让情况更糟（裂了不自愈），后来必须 revert
- **Z9 backend stamp 写入正确但 safeParseExtra 在读路径丢字段**——parser 重建 `result.stream = { invocationId }` 只取了一个字段，典型的"写入和读取不对称"隐性 bug

## Trigger Missed

- **Z3/Z4 守护猫对照表没 catch "live ≡ hydrate 一致性"不变量**——守护只审计了"刷新前后气泡数一致"（上一次 catch 的症状），没审 "你这次改的 contract 有没有跟周边 contract 漂"。KD-26 已记录为元教训
- **backend persist site audit 应该在 Z3 就做**——Z3 只改了 route-serial 和 route-parallel 的 formal message，完全没审其他 9+ persist site（callbacks.ts、ConnectorRouter、QueueProcessor 等）。如果 Z3 就做全量 audit，Z9 不需要存在

## Doc Links

- Feature spec: `docs/features/F194-invocation-liveness-canonical-read-model.md`
- Bug report: `docs/bug-report/2026-05-09-f194-runtime-bubble-still-split-completion-leak/`
- Related: F183（bubble pipeline）、F173（frontend thread-runtime state）、F048（restart recovery）

## Rule Update Target

- `cat-cafe-skills/refs/vision-guard-checklist` (待建): 加 "live UI bubble count ≡ hydrate canonical bubble count" 不变量检查项（KD-26 元教训）
- `shared-rules.md`: "parser 重建字段时必须 spread 全部已知字段，不能只取子集"——generic 但 Z9-hotfix 是典型案例
