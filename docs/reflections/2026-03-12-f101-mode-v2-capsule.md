---
capsule_id: "F101-2026-03-12"
context: "F101 Mode v2 游戏系统引擎 + 狼人杀 完成后的反思"
feature_ids: [F101]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- 四猫讨论（opus/gpt52/codex/gemini）在 1 天内从"mode 应该是什么"收敛到完整 spec + 18 个 KD，铲屎官当场拍板。这是目前最快的大功能立项。
- seat/actor/role 三层分离（gpt52 提出）被证明是正确抽象——让人类和猫在架构上完全对称，前端 PlayerGrid 零特殊处理。
- Pencil UX 设计稿先行 + Design Gate 流程有效：3 屏 wireframe 铲屎官确认后，前端代码一次到位，没有返工。
- 信息隔离做在服务端（scoped event log + GameView 裁剪），前端只做渲染——安全审计干净，codex review 没有在信息泄漏上发现问题。
- 云端 review 抓到一个真实 P1（hasTargetedAction 未按角色门控，villager 能看到 NightActionCard），修复后补了回归测试。

## What Failed
- 前 3 轮 codex review 累计 8 个 P1，密度偏高。根因：ChatContainer 集成层一次性接太多 props/callbacks，缺少中间集成测试。应该在 GameOverlayConnector 层写集成断言，而不是等 review 时才发现接线错误。
- PHASE_ACTION_MAP 的 action name 第一版和后端不一致（用了 `attack` 而非 `kill`），暴露了前后端契约没有共享常量。v2 应考虑从 shared 包导出 action name enum。
- 两个 commit 漏了 `[布偶猫🐾]` 签名（Round 2/3 fix commits），虽然不影响功能但违反了团队约定。

## Trigger Missed
- `quality-gate` 时没有模拟"非对应角色的玩家在特定 phase"的场景——这个场景是云端 review 才发现的。应在 quality-gate 增加"角色-阶段交叉矩阵"检查项。
- completion 文档闭环（需求点 checklist、Links、反思胶囊）差点漏掉，是 gpt52 愿景守护时才指出的。merge-gate Step 7.5 只做了 Phase 同步，completion 5 步应该有显式 checklist。

## Doc Links
- Feature spec: `docs/features/F101-mode-v2-game-engine.md`
- Discussion: Thread `thread_mmmt16riklhir6e4`
- Design: `designs/f101-werewolf-game-ui.pen`
- Research: `docs/research/2026-03-11-netease-werewolf-rules.md`
- Plan: `docs/plans/2026-03-12-f101-b8-frontend-game-ui.md`
- PR #400 (Phase A+B backend), PR #406 (Phase B frontend)

## Rule Update Target
- quality-gate: 增加"角色-阶段交叉矩阵"检查（当功能涉及 role-based 权限时）
- merge-gate → feat-lifecycle: completion 5 步应有显式 checklist，不能只靠愿景守护猫兜底
- 前后端 action name: 考虑从 shared 包导出常量，消除手动同步风险
