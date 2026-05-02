---
capsule_id: "F185-2026-05-02"
context: "ADR-034 实施 — connector 入口从 slot 级改 thread 级门控 + fairness invariant"
feature_ids: [F185]
doc_kind: capsule
created: 2026-05-02
---

## What Worked
- 四猫审计 → ADR → 三猫 review → 铲屎官 signoff → 立项，决策链完整
- TDD 严格红绿循环，12 AC 全有对应测试
- `tryStartThread` 原子 gate 一举解决 thread 级 + TOCTOU 两个问题
- `skipOnComplete` flag 干净解决 duplicate 路径不应触发 onInvocationComplete('failed') 的问题
- 云端 P2（notifySkip dedup）当场修复 + 测试，不拖到下一轮

## What Failed
- pnpm gate 被 NODE_ENV=production 残留坑了一轮（gate script 自己设的环境变量没清理）
- 首次尝试安装 `@types/better-sqlite3` 导致 lockfile churn 进了 commit，被砚砚 R3 抓出
- PR tracking 注册首次失败（422 repo not accessible），第二次才成功

## Trigger Missed
- 无

## Doc Links
- [ADR-034](../decisions/034-dispatch-busy-gate-unification.md)
- [F185 spec](../features/F185-dispatch-busy-gate-unification.md)
- [F122 unified dispatch](../features/F122-unified-dispatch-queue.md)
- [F175 unified message queue](../features/F175-unified-message-queue.md)

## Rule Update Target
- 无新规则需要回写
