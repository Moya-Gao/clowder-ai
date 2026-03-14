---
capsule_id: "F118-2026-03-14"
context: "CLI Liveness Watchdog & Session Recovery — session mutex + liveness probe + warning UI + session recovery"
feature_ids: [F118]
doc_kind: capsule
created: 2026-03-14
---

## What Worked
- 三猫联合取证定位根因：布偶猫 + 缅因猫(GPT-5.4) 从 audit log + raw archive + 本地 rollout 交叉定位出"同一 cliSessionId 被并发 resume"的硬证据
- 社区 issue (#86/#98/#99) 统一归入 F118 而非拆成独立 feature，保持了因果链完整性（KD-6 决策正确）
- Phase A/B/C 分阶段交付，每个 Phase 有独立 code review + vision guardian，质量逐层把关
- Codex review 在每轮都抓到了真实 P1（store persistence、pendingTimeoutDiagRef 单槽、finally audit 误报），TDD Red→Green 修复流程有效
- Pencil Scene 4 设计稿先行，前端实现 100% 设计 fidelity

## What Failed
- Phase C 首轮提交时 `consecutiveRestoreFailures` 只在 invoke-single-cat 层读写，store 层（InMemory + Redis）都没处理持久化，codex 连抓两轮才彻底修完。应在写 invoke 层代码时就同步检查 store interface 和实现
- Quality gate 自检时没有发现 store 层持久化缺失，说明自检 checklist 需要包含"跨层一致性"检查
- Phase A 和 Phase B 都出现过"AC 口径写满但实际未完成"的问题（rawArchivePath、AC-B5 前端展示），被 GPT-5.4 愿景守护两次踢回

## Trigger Missed
- 写 `update()` 调用时应触发"store 层是否支持该字段"检查（跨层一致性）
- AC 自检时应触发"文档承诺 vs 代码实际"逐字段对账，不能假设 checkbox 等于真相
- Phase C 首轮 commit 把 `pendingTimeoutDiagRef` 做成全局单槽，应在设计阶段就考虑多猫并发场景

## Doc Links
- Feature spec: `docs/features/F118-cli-liveness-watchdog.md`
- Phase C plan: `docs/plans/2026-03-14-f118-phase-c-liveness-ui-recovery.md`
- PR #445: Phase A+B merged
- PR #448: Phase C merged
- Community issues: clowder-ai#86, #98, #99

## Rule Update Target
- Quality gate checklist 应增加"跨层一致性"检查项：当 invoke 层调用 store.update(field) 时，确认 store interface + InMemory + Redis 三层都处理该字段
- 教训已有（GPT-5.4 两次指出）："phase 完成前必须把'后端 ready'和'用户可见完成'分开对账"
