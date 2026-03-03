---
feature_ids: [F046]
topics: [anti-drift, b5, runtime-regression]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F046 B5 Seed — Runtime Regression 0→1

## What

本轮交付 F046 B5 的 seed 回归能力（从 0 到 1）：

1. 新增测试文件：`packages/api/test/f046-b5-runtime-regression-seed.test.js`
2. 覆盖 3 条高风险对话场景：
   - debug 模式下 A2A 下游可见上游文本
   - play 模式下 A2A 下游不可见上游文本（隔离）
   - 同族 review 握手失败时，`⚠️ Review 无效` 标记向下游传递
3. F046 spec 同步：B5 标注为“seed=3 已落地，尚未达到 ≥10”

## Why

咱们现在 F046 的主要缺口是 B5 一直是 0，愿景守护停留在流程/门禁层。先落 3 条可执行回归，把“运行时守护”能力从 0→1，再继续扩到 ≥10。

## Original Requirements（必填）

> "来吧先完成f43的收尾！然后进行f46"
> "@codex 来吧开始f46"
> "@codex 开始吧！发给 @gpt52 做 code review 等他给你绿灯你就可以开pr 挂mcp的tracking pr"

- 来源：当前会话 thread（铲屎官，2026-03-03）
- **请对照上面的摘录判断交付物是否满足“先推进 F46，并先走 @gpt52 code review”的要求**

## Tradeoff

- 这轮只做 B5 seed，不碰 Phase D 机制改造（D1-D4），避免混改路由主链。
- 收益是快速建立运行时回归基线；代价是 AC“≥10 场景”仍未达标，需要后续扩容。

## Open Questions

1. 这 3 条 seed 场景是否足以代表 B5 的第一批最小闭环？
2. 是否还需要在本轮追加 1 条“多跳 A2A + 无动作 @”相关场景，还是留到 Phase D 一起做？
3. spec 中 B5 的“seed 已落地但不勾 AC”表述是否清晰可验？

## Next Action

请 `@gpt52` 重点 review：

1. 场景选取是否覆盖当前最关键的运行时漂移风险
2. 测试断言是否准确体现 debug/play 与 review gate 语义
3. spec 同步是否符合“真相源”标准（不虚勾 AC）

## 自检证据

### Spec 合规

- [x] F046 B5 seed 回归测试已落地（3 条）
- [x] F046 spec 已同步 seed 状态、证据、timeline
- [x] B5 AC（≥10）保持未勾选，未虚报完成

### 测试结果（本轮真实运行）

- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/f046-b5-runtime-regression-seed.test.js packages/api/test/route-strategies.test.js packages/api/test/route-serial-review-identity-propagation.test.js` ✅（52 passed, 0 failed）

### 相关文档

- Plan: `docs/plans/2026-03-03-f046-b5-runtime-regression-seed.md`
- Feature: `docs/features/F046-anti-drift-protocol.md`
