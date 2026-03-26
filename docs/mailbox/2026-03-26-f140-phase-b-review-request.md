# Review Request: F140 Phase B — 猫自动处理冲突和 review feedback

Review-Target-ID: f140-phase-b
Branch: feat/f140-phase-b

## What

Phase B 在 Phase A 的检测→投递→唤醒管道上加入自动响应能力：

1. **F139 1b 对齐修复** — ReviewFeedbackTaskSpec 补齐 `actor` + `ExecuteContext` 参数
2. **冲突通知 action hint** — `buildConflictMessageContent` 输出含 rebase 指令和 KD-13 决策引导
3. **Review feedback action hint** — `buildReviewFeedbackContent` 根据 decision 类型（CHANGES_REQUESTED / APPROVED / COMMENTED）分流操作指引
4. **Skill 层行为引导** — pr-signals.md 添加完整自动响应流程，merge-gate 和 receive-review SKILL 各加入对应入口

## Why

Phase A 实现了"猫能看到通知"，但猫被唤醒后不知道该做什么。Phase B 让消息自带操作指引，Skill 层提供行为决策树，使猫能自动 rebase 冲突或按 receive-review 流程处理 feedback。

关键决策 KD-13（OQ-3 resolved）：自动 rebase 采用「全自动 + 事后通知」，铲屎官批准。

## Original Requirements（必填）

> 铲屎官：
> - "开 Phase B 走起！"
> - "可以！选项 C 然后 commit push 开 worktree 干。记得记录一下决策"
> - "走起别问我！自己行动！！"

- 来源：当前会话 2026-03-26（F140 Phase B kickoff）
- Feature spec: `docs/features/F140-github-pr-automation.md`（AC-B1/B2/B3）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Action hint 是纯文本嵌入消息体，没有结构化 metadata schema — 选择简单方案因为当前只有两种通知类型，结构化可以留到通知类型增多时再做
- Skill 引导是 markdown 文档层面的行为规范，不是代码层面的 auto-dispatch — Phase B 定位是"让猫知道该做什么"，不是"完全自动化执行"

## Open Questions

1. **冲突分级阈值**：pr-signals.md 定义 ≤3 文件为"简单冲突"，这个阈值是否合理？
2. **F139 alignment**：Task 0 补齐了 actor + ctx，请确认与 F139 1b spec 完全一致
3. **Skill 引导覆盖**：merge-gate 和 receive-review 的新增段落是否与现有流程衔接自然？

## Next Action

请做跨 family review（缅因猫 → 布偶猫代码），重点关注：
- AC-B1/B2/B3 覆盖完整性
- F139 1b 对齐正确性
- Skill 文档与现有流程的衔接

## 自检证据

### Spec 合规

Quality Gate PASS — 2026-03-26 11:00
- 愿景覆盖：AC-B1/B2/B3 + F139 alignment 全部 ✅
- 交付完整性：Phase B 是分 phase 交付（铲屎官已同意），后续是扩展非重写
- 设计稿：无 F140 .pen 文件，纯后端 + Skill 层
- Artifact hygiene：无根目录未跟踪媒体

### 测试结果

```
Phase B 专项测试 (27 tests):     27 pass, 0 fail ✅
pnpm test (全量):                5415 pass, 40 fail (预存 Redis isolation + runtime catalog 环境依赖)
pnpm lint:                       0 errors ✅
pnpm check (biome):              52/52 pass ✅
pnpm -r build:                   exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-26-f140-phase-b-auto-response.md`
- Feature: `docs/features/F140-github-pr-automation.md`
- Decision: KD-13 in feature spec (OQ-3 → Option C)

### Commits (feat/f140-phase-b)

- `b224a4b7a` fix(F140-B): align ReviewFeedbackTaskSpec with F139 1b (actor + ctx)
- `619500c5e` feat(F140-B): add action hint to conflict notification messages (AC-B1)
- `0e9bd3607` feat(F140-B): add action hint to review feedback messages (AC-B3)
- `56589d3e1` docs(F140-B): add auto-response behavior to Skills (AC-B1/B2/B3)
