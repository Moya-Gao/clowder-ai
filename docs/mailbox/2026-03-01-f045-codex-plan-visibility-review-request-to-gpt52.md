---
feature_ids: [F045]
debt_ids: []
topics: [review, status-panel, task-progress]
doc_kind: mailbox
created: 2026-03-01
---

# Review Request: F045 Codex Plan Visibility（右侧看板当前调用）

## What
- 修复右侧状态栏“当前调用”集合计算：除 `targetCats` 外，把**有 task progress 的猫**也算作 active cats。
- 同步修复移动端 `MobileStatusSheet` 的 active cats 逻辑，保持桌面/移动一致。
- 新增回归测试：`targetCats=['opus']` 但 `codex` 有 `taskProgress` 时，`当前调用` 必须出现缅因猫和执行计划。

## Why
- 铲屎官反馈“右上角还是只有布偶猫的 plan，明明缅因猫干活两小时了”。
- 现有实现只基于 `targetCats` 渲染“当前调用”，导致非 target 但有快照的猫被归入历史区（默认折叠），造成“看不见 plan”的体感 bug。

## Original Requirements（必填）
> "有bug 我发现右上角还是只有布偶猫的plan ，明明缅因猫干活干了两小时了，难道缅因猫没写plan吗？"
- 来源：本线程铲屎官反馈（2026-03-01 05:38）
- 关联 Feature：`docs/features/F045-ndjson-observability.md` Gap #4（右侧看板计划可见性）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 备选方案 A：仅自动展开“历史参与”，不改 active 集合。  
  放弃原因：仍然依赖用户展开，且“当前调用”语义继续错误。
- 备选方案 B：仅桌面侧修复。  
  放弃原因：移动端会继续出现同类不一致。

## Open Questions
1. “有 taskProgress 即 active”这条规则是否需要再加状态约束（如仅 `running/interrupted`）？
2. 当前测试是 SSR 静态渲染断言；是否需要补一个交互态（历史区展开/折叠）测试来防止将来回归？

## Next Action
- 请 `@gpt52` 做 R1 review，重点看：
  1) active/history 分类语义是否合理；
  2) 移动端同步改动是否会引入行为偏差；
  3) 回归测试是否覆盖到了真实用户路径。

## 自检证据

### Spec 合规（quality-gate 摘要）
- 痛点映射：缅因猫 plan 不可见 -> active cats 分类漏算 `taskProgress` cats。
- 实现覆盖：桌面+移动双端修复 + 回归测试。
- 风险：无后端协议改动，仅前端展示逻辑调整。

### 测试结果（本轮真实运行）
- `pnpm --filter @cat-cafe/web test src/components/__tests__/right-status-panel.test.ts`  
  -> 6 passed, 0 failed（包含新增回归用例）
- `pnpm --filter @cat-cafe/web test`  
  -> 100 files, 584 passed, 0 failed
- `pnpm --filter @cat-cafe/web build`  
  -> success（仅现有历史 warning，无新增错误）

### 相关文档
- Feature: `docs/features/F045-ndjson-observability.md`
- Review target commit: `1881de67` (`fix(F045): show task-progress cats in active status panel`)
