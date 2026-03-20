---
capsule_id: "F130-2026-03-20"
context: "API 日志治理全量闭环 — 四层分离 × 结构化落盘 × 迁移 × 巡检"
feature_ids: [F130]
doc_kind: capsule
created: 2026-03-20
---

## What Worked

- **Phase 分级策略精准**：Phase A 止血（5 核心模块）→ Phase B 全量迁移（89 处）→ Phase C 护栏（logs:health），每层产物即终态，不是脚手架。Review 友好，铲屎官确认方向后自驱完成
- **进程层 stderr 兜底设计**：放弃 tee 管道（macOS 孤儿进程问题），改用 console monkey-patch + stderr redirect，既解决了未迁移 console 的持久化问题，又避免了进程管理炸弹
- **Redaction 与落盘同步上线（KD-5）**：日志写磁盘 = 泄露面复制到磁盘，redaction 必须同步，不能 Phase B 补。这个决策在 review 中验证正确
- **8 轮 review 的价值**：缅因猫在 Phase A 发现了 tee 孤儿进程问题、redundant fallback 问题、console bridge 误删问题——都是实际会炸的 bug。密集 review 是投资不是成本
- **批量迁移用 subagent 并行**：Phase B 37 文件迁移拆成 4 个 Sisyphus-Junior 并行，20 分钟完成全量迁移，效率极高

## What Failed

- **Phase B+C spec 更新滞后**：Phase A merge 时更新了 spec，但 Phase B+C 的 spec 状态（Review Gate、Timeline）没有在 merge-gate Step 7.5 同步更新，留到了 feat close 才补。违反了 merge-gate 实时同步原则
- **AC-B3 ESLint rule 预判失误**：原计划加 ESLint no-console rule，但项目用的是 Biome 不是 ESLint，立项时没核实工具链现状就写了 AC
- **暹罗猫愿景守护失败**：铲屎官让暹罗猫做愿景守护，暹罗猫却开始写/修改代码文件（违反 roster 约束：禁止写代码），铲屎官紧急停止。留下了 debug 残留在 main 上（test-run.js、security-boundary.test.js 的 debug log）

## Trigger Missed

- **应该在 Phase B+C PR merge 后立即触发 feat-lifecycle completion**，但实际拖了 2 个 context window 才开始。merge-gate Step 7.5 → feat close 的衔接不够自动
- **暹罗猫参与前应该检查 roster 约束**：roster 明确写了"暹罗猫禁止写代码"，但 dispatch 愿景守护时没做前置 roster 检查，导致它越权写代码

## Doc Links

- Feature spec: [F130-api-log-governance.md](../features/F130-api-log-governance.md)
- Issue: [#594](https://github.com/zts212653/cat-cafe/issues/594)
- PR #600 (Phase A): [#600](https://github.com/zts212653/cat-cafe/pull/600)
- PR #601 (Phase B+C): [#601](https://github.com/zts212653/cat-cafe/pull/601)
- Related: [F013-audit-log-v2.md](../features/F013-audit-log-v2.md), [F045-ndjson-observability.md](../features/F045-ndjson-observability.md)

## Rule Update Target

- `feat-lifecycle` completion flow: 补充"merge-gate Step 7.5 完成后，应立即检查是否所有 Phase 已完成，若是则自动进入 completion flow"
- `shared-rules.md` roster 执行: 补充"dispatch 任务给其他猫前，先检查 roster 约束（特别是'禁止写代码'标记），不是事后审计"
- `merge-gate` Step 7.5: 补充"Phase B+C 类后续 Phase merge 后，Review Gate 和 Timeline 也必须实时同步，不只是 AC checkbox"
