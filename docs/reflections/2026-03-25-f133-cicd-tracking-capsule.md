---
capsule_id: "F133-2026-03-25"
context: "GitHub CI/CD Tracking — 已注册 PR 的 CI/CD 执行结果自动追踪"
feature_ids: [F133]
doc_kind: capsule
created: 2026-03-25
---

## What Worked

- **Design Gate 跨猫讨论**：金渐层出初版 spec，砚砚(GPT-5.4) 做 Design Gate review 贡献了 10 点架构反馈（raw Checks API 漏 commit statuses、patchCiState 独立接口、状态迁移去重替代时间窗口去重等），避免了 3 个设计坑
- **管道复用策略**：复用现有 Review 消息管道（messageStore → socket → ConnectorInvokeTrigger），只新增 `CiCdCheckPoller` + `CiCdRouter` + `github-ci-bootstrap` + `deliver-connector-message`（共享 helper），不改动任何现有 Review 代码路径
- **PR 级 rollup 替代 raw Checks API**：`gh pr view --json statusCheckRollup` 一次请求覆盖 Checks + commit statuses 两套体系，比逐个查 check-suites/runs 更高效且覆盖更全
- **Phase A + Phase B 当日闭环**：从铲屎官提出需求到两个 Phase 全部合入只用了一天（2026-03-23），得益于 spec 讨论充分 + 架构复用到位
- **KD-4 决策修正闭环快**：铲屎官 3-24 确认 CI failure trigger 应为 urgent，3-25 当天完成一行代码修改 + 测试 + PR + review + merge

## What Failed

- **KD-4 初始决策偏差**：Design Gate 时砚砚建议 CI failure 用 `normal` priority，我采纳了。但铲屎官次日发现这与 review 行为不一致（review 用 `urgent`），需要额外一轮 PR (#724) 修正。说明 Design Gate 对"跨模块行为一致性"的审视不够——只看了 CI 本身的需求，没对比 review 的已有行为
- **AC-B1 暂缓处置不够显式**：铲屎官说"只在有额度时才有意义，暂缓"，但 spec 只加了括号注释 `⏸️`，没有正式转 TD 或标 N/A，导致 close 时守护猫合理 BLOCKED

## Trigger Missed

- **元思考触发器 E "新领域侦查" 不够彻底**：Design Gate 时查了 ReviewRouter 代码，但没有对比 `github-review-bootstrap.ts` 的 trigger priority 设置。如果当时跑一遍 `grep -r "priority.*urgent" packages/api/src/infrastructure/email/`，会发现 review 用 `urgent`，Design Gate 就能做出一致性决策，省掉后续 KD-4 修正
- **AC 暂缓项应该在讨论时就确定处置方式**：铲屎官口头说"暂缓"时，应该立刻追问"这个转 TD 还是标 N/A？"而不是默默加个括号注释

## Doc Links

- [F133 Spec](../features/F133-cicd-tracking.md)
- [PR #675 — Phase A](https://github.com/zts212653/cat-cafe/pull/675)
- [PR #677 — Phase B](https://github.com/zts212653/cat-cafe/pull/677)
- [PR #724 — KD-4 修正](https://github.com/zts212653/cat-cafe/pull/724)
- [refs/cicd-tracking.md](../../cat-cafe-skills/refs/cicd-tracking.md)
- [Issue #669](https://github.com/zts212653/cat-cafe/issues/669)

## Rule Update Target

- `shared-rules.md` 或 Design Gate SOP：补充"Design Gate 跨模块一致性检查"——新增模块的行为（如 priority、retry 策略）必须与相同管道中已有模块的行为做显式对比，不只看新模块自身需求
- `feat-lifecycle` SKILL.md：AC 暂缓项必须在讨论当场确定处置（转 TD / 标 N/A / 挂 OQ），不允许只加括号注释留到 close 时处理
