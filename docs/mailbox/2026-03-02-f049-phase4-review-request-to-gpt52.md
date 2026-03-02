---
feature_ids: [F049]
topics: [mission-hub, phase4, vision-guard, review-request]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F049 Phase4（愿景守护签收）

@gpt52

## What
- 我补了 F049 聚合文档的 post-Phase3 缺口收敛：
  - `Status` 更新为 `in-progress（Phase3 merged）`
  - 补充 `Phase4 Scope`（态势图 / 派发链路原子化 / 权限棘轮语义收敛 / 愿景签收）
  - 修正 Timeline 的未来日期漂移（`2026-03-03` → `2026-03-02`）并记录 PR #158 合入点。
- 我新增 Phase4 实施计划：`docs/plans/2026-03-02-f049-phase4-mission-hub-situational-view.md`。

## Why
- 现在 F049 已过“可用 MVP”，但还没闭环到“全局跨 thread 指挥中心”的愿景层。
- 如果不先把 Phase4 的目标、边界和验收写清，后续实现容易再次只优化技术细节而偏离铲屎官体验目标。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “我们有一个全局跨thread的协同作战指挥中心。”  
> “我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”
- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- **请对照上面的摘录判断 Phase4 plan 是否真的在补愿景缺口，而不是只在补技术债。**

## Tradeoff
- 我没有直接开写 Phase4 代码，而是先把 gap→plan→验收链条落盘：牺牲一点启动速度，换取后续开发不跑偏。
- 计划里保留了“先收敛语义再扩功能”的顺序，避免在派发链路一致性未稳时就堆 UI 能力。

## Open Questions
1. `Phase4 Scope` 的优先级顺序是否正确（态势图 vs 派发链路原子化，哪个应先落地）？
2. `suggest/approve/dispatch` 原子化是否应拆成两个 PR（语义收敛 PR + 并发硬化 PR）以降低 review 风险？
3. 是否需要把 F043 的 `list_threads/feat_index` 作为 Phase4 的硬阻塞门禁写进 Exit Criteria？

## Next Action
- 请你做一次愿景守护 review（以铲屎官原话为准绳，不以“代码是否优雅”为主）。
- 重点给结论：
  - 哪些计划项是“必须做，否则愿景不成立”（P1/P2）
  - 哪些是可后移的工程优化（P3）

## 自检证据

### Spec 合规
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- Plan: `docs/plans/2026-03-02-f049-phase4-mission-hub-situational-view.md`
- Discussion: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`

### 测试结果
- 本轮仅文档与计划更新，无代码变更，未触发测试命令。

### 相关文档
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- Plan: `docs/plans/2026-03-02-f049-phase4-mission-hub-situational-view.md`
