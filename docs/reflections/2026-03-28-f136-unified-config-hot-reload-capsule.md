---
capsule_id: "F136-2026-03-28"
context: "F136 Unified Config Hot Reload — 从 event bus 到单一真相源的全链路配置热更新"
feature_ids: [F136]
doc_kind: capsule
created: 2026-03-28
---

## What Worked

- **铲屎官参与关键决策**：Phase 4 真相源讨论中铲屎官直接点破"两个真相源在打架"，推翻了 A* 方案，避免了"合理化脚手架"的方向错误
- **渐进式 Phase 拆分**：6 个 PR（#778→#784→#788→#790→#818→#824→#831），每步产物是终态基座。Connector 热重载 MVP 3 天落地，Phase 4 真相源统一用了 1 天密集讨论+实现
- **@gpt52 两轮 risk audit 效果显著**：P1-A（global migration marker）和 P1-B（credential clear 缺前端闭环）都是 risk audit 而非常规 review 发现的，说明愿景守护级别的审查比行级 review 更有价值
- **spec 决策记录含铲屎官原话**：后续任何猫回顾都能对齐原始意图，不会二次偏航

## What Failed

- **global migration marker 设计缺陷**：首版迁移用了全局一位标记，多项目场景下 project B 会被跳过。根因是设计时没考虑多项目场景（只想着"我的机器只有一个项目"）
- **best-effort catch 太静默**：`accountStartupHook` 的非 HC-5 异常被吞为 warn，服务带病启动。运行时用户看到空 accounts 页面才发现问题——迁移没跑成但无高信号暴露
- **分支 scope 漂移**：feature branch 混进了 F137 BACKLOG 修复和 threshold bumps，被 @gpt52 打回。应该在第一次 commit 时就保持 scope 纯净
- **git rebase 事故**：在 main repo 意外执行了 feature branch 的 pull --rebase，差点覆盖 main。恢复用了 reset + cherry-pick

## Trigger Missed

- **多项目场景测试**：写迁移代码时应该触发"这个设计在多 projectRoot 下行为如何？"的思考。单项目测试通过 ≠ 设计正确
- **startup readiness 检查**：删旧层（PR #824）时应该同步思考"如果迁移没跑成怎么办？"——删和迁移是原子操作的两端，中间断了就数据丢失
- **分支纯净度自检**：commit 前 `git log --oneline base..HEAD` 检查每个 commit 是否都属于当前 feature scope

## Doc Links

- [F136 spec](/docs/features/F136-unified-config-hot-reload.md)
- [Phase 4 决策讨论（推翻 A*）](/docs/features/F136-unified-config-hot-reload.md#决策记录2026-03-28铲屎官--opus--codex-讨论收敛--phase-4-真相源统一)
- [F136 Phase 4a-4d 实施计划](/docs/plans/2026-03-28-f136-phase-4-single-source-of-truth.md)
- [Startup invariant follow-up](/docs/features/F136-unified-config-hot-reload.md#follow-up-startup-invariant-guardp2-hardening)

## Rule Update Target

- `shared-rules.md` 或 `lessons-learned.md`：**删旧层与迁移必须原子验证**——删除旧读取路径的 PR 必须包含"迁移未完成时的 startup guard"测试，否则中间态 = 数据丢失
- `account-startup.ts`：follow-up 实施时把 best-effort catch 升级为 startup invariant（legacy source 在 + accounts 缺 → error/fail）
