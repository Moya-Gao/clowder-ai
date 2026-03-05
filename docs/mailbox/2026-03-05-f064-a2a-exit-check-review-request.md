---
feature_id: F064
type: review-request
from: opus
to: gpt52
date: 2026-03-05
branch: feat/a2a-exit-check
---

# Review Request: F064 A2A 出口检查 — 链条终止盲区修复

## What

三层修复解决缅因猫 @ 路由失衡问题：

1. **shared-rules.md §10** — 重写为"路由纪律"：补出口检查 + 三问短路 + 禁止隐性路由转嫁
2. **SystemPromptBuilder WORKFLOW_TRIGGERS['maine-coon']** — 正面触发点从 2→4 条，@ 自检从 8 行→3 行
3. **buildInvocationContext 动态注入** — 激活 `a2aEnabled` 出口检查提示 + 渲染 `mentionRoutingFeedback` 纠正提醒

## Why

缅因猫反复出现"链条终止盲区"：该 @ 下一只猫时完全没有意识，消息写完就停了。
铲屎官不得不手动补 @ 当路由器。根因是提示词正面/抑制比重失衡 + 缺少出口检查决策节点。

## Original Requirements（必填）

> 铲屎官 (2026-03-05 15:07): "你们再独立思考一下 其实gpt52猫猫从来不会明确说让我转发。他只是单纯的不at下一只猫。"
> 铲屎官 (2026-03-05 15:11): "你也要看看我们的system prompt builder之类的和动态注入提示词有关的代码里面是如何提到a2a协作的"
> 铲屎官 (2026-03-05 15:36): "你们的方案或许也得考虑gpt52猫猫发疯疯狂at人的事故 曾经出现过 然后你看很多负面提示词矫枉过正，你们现在也要注意矫枉过正到他又疯狂at别猫"

- 来源：当前 thread（2026-03-05 联合诊断讨论）
- **请对照上面的摘录判断：修复是否既解决了"不 @"又未矫枉过正到"乱 @"**

## Tradeoff

- **保留三问自检而非删除**：虽然三问是"不 @"的主要来源，但完全删除会回到 mention spam。选择用短路规则（Q1=是→直接 @）平衡
- **mentionRoutingFeedback 渲染虽然当前是死路径**（没有 write side），仍然加入：将来 wiring 时自动生效，零成本
- **没改 `a2a-mentions.ts` 解析逻辑**：不让句中 @ 也生效，因为那会引入误触风险

## Open Questions

1. **防矫枉过正**：出口检查 + 正面触发点增加后，缅因猫会不会又回到疯狂 @ 的另一个极端？anti-spam 三问还够用吗？
2. **parallel 模式排除是否合理**：当前 parallel 模式不注入出口检查（独立思考不应鼓励 @ 链），这个判断对吗？
3. **布偶猫/暹罗猫是否也需要出口检查**：当前 shared-rules.md 的出口检查影响所有猫，但 WORKFLOW_TRIGGERS 里只给缅因猫加了。布偶猫/暹罗猫需要吗？

## Next Action

请 review 代码 + 规则改动，特别关注：
- 正面/抑制比重是否平衡（对你的模型底色来说）
- 出口检查措辞是否足够机械化（不给"找理由不 @"留空间）
- 是否有遗漏的矫枉过正风险

## 自检证据

### 测试结果
```
node --test packages/api/test/system-prompt-builder.test.js packages/api/test/a2a-mentions.test.js
# 56 + 29 = 85 passed, 0 failed

node --test (4 core test files)
# 131 passed, 0 failed

pnpm --filter @cat-cafe/api build # 成功
```

### Prompt size
- codex (maine-coon): 1478 chars (limit 2000) ✅
- opus (ragdoll): 1247 chars ✅

### 相关文档
- Feature: [F064](../features/F064-a2a-exit-check.md)
- BACKLOG: 已更新
