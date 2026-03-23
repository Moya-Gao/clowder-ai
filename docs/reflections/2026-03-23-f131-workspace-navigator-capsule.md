---
capsule_id: "F131-COMP-2026-03-23"
context: "F131 Workspace Navigator 全链路交付与两轮线上回归修复"
feature_ids: [F131]
doc_kind: capsule
created: 2026-03-23
---

## What Worked
- 采用 F120 的 `HTTP API → Socket → Store → UI` 模式，快速落地了可编程导航能力，且复用了现有面板状态管理。
- 多轮 review 机制有效：本地跨猫 review + 云端 review 连续发现边界问题，最终收敛到稳定实现。
- E2E 验收由铲屎官直接反馈“已打开且不回弹”，将实现结果和真实使用体验对齐。

## What Failed
- 早期把“打开后回弹”归因为单一原因，导致 PR #672 后仍残留第二根因，修复回合偏多。
- 曾出现一次在 `main` 直接改代码的流程违规，增加了回滚和二次搬运成本。
- Feature close 文档索引未一次性闭环：`features/README.md` 未及时登记 F131。

## Trigger Missed
- 触发器“异步竞态与线程切换路径”识别偏晚，初版修复未覆盖 async caller 的 thread drift。
- completion 阶段的“索引一致性检查”未在第一时间执行（spec/BACKLOG/README/index.json 四处对齐）。

## Doc Links
- [F131 spec](../features/F131-workspace-navigator.md)
- [PR #611](https://github.com/zts212653/cat-cafe/pull/611)
- [PR #666](https://github.com/zts212653/cat-cafe/pull/666)
- [PR #672](https://github.com/zts212653/cat-cafe/pull/672)
- [PR #678](https://github.com/zts212653/cat-cafe/pull/678)

## Rule Update Target
- `cat-cafe-skills/refs/shared-rules.md`：在 Bug 修复章节补充“跨 thread + async 回调必须显式 thread ownership 保护”检查项。
- `cat-cafe-skills/merge-gate/SKILL.md`：补一条 post-merge checklist，要求 close 前强制核对 `features/README.md` 与 `docs/features/index.json`。
