---
feature_id: F064
title: A2A 出口检查 — 链条终止盲区修复
status: in-progress
owner: 布偶猫
created: 2026-03-05
topics: [a2a, prompt-engineering, collaboration]
doc_kind: feature
---

# F064: A2A 出口检查 — 链条终止盲区修复

## 问题

缅因猫(GPT-5.2) 在协作场景中反复出现两种极端：
1. **链条终止盲区**（高频）：该 @ 下一只猫时完全没有 @ 的意识，消息写完就停了，导致铲屎官不得不手动补 @ 当路由器
2. **mention spam**（低频但曾爆发）：疯狂 @ 所有猫，不管对方需不需要行动

两者看似矛盾，实为同一根因的两面：**缺少"发消息前出口检查"的决策节点**。

## 根因分析

### 1. 提示词结构偏差

`shared-rules.md` §10 设计了"发 @ 前三问"自检，但这是**事前门控**——假设猫已经意识到"可能需要 @"才会跑这个检查。砚砚的问题在更前面：他**根本没走到"要不要 @"这个决策点**。

### 2. 缅因猫 WORKFLOW_TRIGGERS 比重失衡

`SystemPromptBuilder.ts` 中 `maine-coon` 的工作流触发点：
- 正面触发点：2 条（完成 review → @ 布偶猫、修完 bug → @ 布偶猫）
- 抑制规则：8 行（@ 自检占一半篇幅）

对比布偶猫：3 条正面触发 + 0 行抑制规则。

**提示词给缅因猫传递的信号是"小心 @，别乱 @"，而不是"该 @ 就 @"。** 对本来就倾向"少打扰"的模型底色，三问自检变成了"三重否定门"。

### 3. `mentionRoutingFeedback` 数据流断裂

`InvocationContext` 定义了 `a2aEnabled` 和 `mentionRoutingFeedback` 字段，`route-serial.ts` 也在计算和传入它们。**但 `buildInvocationContext()` 从来没有把它们渲染成提示词文本。** 系统知道上次 @ 没被路由成功，但没告诉猫。

## 解决方案

### 三层修复

**Layer 1: shared-rules.md §10 — 补出口检查（影响所有猫）**
- 新增"出口检查"：每条消息发送前问"这件事到我这里结束了吗？"
- 三问短路：Q1（需要对方采取行动）= 是 → 直接 @，跳过 Q2/Q3
- 明确禁止"把铲屎官当隐性路由"

**Layer 2: WORKFLOW_TRIGGERS['maine-coon'] — 平衡正面/抑制比重**
- 新增出口检查作为工作流第一步
- 补充讨论/交接等场景的正面触发点
- 精简 @ 自检（保留核心三问，删大段解释）

**Layer 3: 激活 `mentionRoutingFeedback` 提示词渲染（代码改动）**
- `buildInvocationContext()` 中新增 A2A 出口检查提示（非 parallel 且 a2aEnabled 时）
- 渲染 `mentionRoutingFeedback` 为一次性纠正提醒

### 防矫枉过正

上述修复必须同时保留 Anti-Mention-Spam 机制：
- **出口检查不等于"每条消息都 @"** — 只有"不是终点 + 需要对方动"才 @
- **三问自检保留**，但短路规则让 Q1=是时不被 Q2/Q3 拦截
- **parallel 模式不注入出口检查** — 独立思考时不应鼓励 @ 链
- 保留 `MAX_A2A_MENTION_TARGETS = 2` 硬上限
- 保留"三个都是否 → 不 @"的兜底

## 改动范围

| 文件 | 改动 |
|------|------|
| `cat-cafe-skills/refs/shared-rules.md` | §10 补出口检查 + 三问短路 + 禁止隐性路由 |
| `SystemPromptBuilder.ts` WORKFLOW_TRIGGERS | 缅因猫补出口检查 + 平衡正面/抑制比 |
| `SystemPromptBuilder.ts` buildInvocationContext | 激活 a2aEnabled + mentionRoutingFeedback 渲染 |
| `system-prompt-builder.test.js` | 新增出口检查 + 路由反馈注入的断言 |

## 验收标准

- [ ] 缅因猫 system prompt 中"出口检查"和"@ 自检"篇幅大致平衡
- [ ] `a2aEnabled=true` 且非 parallel 时，invocation context 包含出口检查提示
- [ ] `mentionRoutingFeedback` 有值时，invocation context 包含纠正提醒
- [ ] parallel 模式不注入出口检查
- [ ] 所有现有 system-prompt-builder 测试 + 新增测试通过
- [ ] size guard 未超限

## 参考

- 讨论来源：2026-03-05 thread（铲屎官 + 布偶猫 + 缅因猫 GPT-5.2 联合诊断）
- 历史事件：缅因猫 mention spam 事件（Anti-Mention-Spam 规则起源）
- 相关 Feature：F046 Anti-Drift Protocol、F055 A2A MCP Structured Routing
