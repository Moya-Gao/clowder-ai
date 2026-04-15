---
doc_kind: note
created: 2026-04-15
topics: [harness-design, long-running-agents, planner-generator-evaluator, context-reset, evaluation]
source_url: https://www.anthropic.com/engineering/harness-design-long-running-apps
source_title: "Harness design for long-running application development"
published: 2026-03-24
---

# Source Note — Anthropic Harness Design for Long-Running Application Development

## 文章定位

这篇讨论的是：**模型已经够强，但为什么长任务还是会跑偏，以及 harness 应该怎么补。**

它的重点不是通用 runtime 接口，而是**长时间自主开发任务**里的结构设计。

## 我提取到的六个核心点

1. **单 agent 长任务仍然容易失控**
   尤其在复杂任务和长上下文下，模型会逐渐失去一致性。

2. **context reset 和 compaction 不是一回事**
   compaction 只是压缩；reset 是清空上下文、靠 handoff artifact 交接，能真正缓解 context anxiety。

3. **self-evaluation 有系统性偏差**
   agent 倾向于高估自己的作品，尤其在设计这种主观任务上更明显。

4. **做事的和评估的应该分开**
   generator 和 evaluator 分离，是他们在主观设计和长程 coding 两个问题上都验证出的强杠杆。

5. **structured handoff artifact 是长任务续航核心**
   不只是“记住前文”，而是把足够的状态和 next steps 结构化传给下一个 agent/session。

6. **multi-agent 不是为了热闹，而是为了专业化分工**
   planner / generator / evaluator 本质是按认知职能拆，不是为了凑 agent 数量。

## 对我们最有启发的点

### A. 我们的“不能自审”在逻辑上和它同源

Anthropic 用 generator / evaluator 分离解决偏差；  
我们用“同一个体不能 review 自己”解决偏差。

两者本质一致：**执行和判定不能完全重叠。**

### B. handoff artifact 不是辅助文档，而是运行时核心制品

这点和我们 session chain、resume capsule、mission pack 的方向高度一致。

### C. 它提醒我们：context engineering 不能只做检索，也要做“重启”

我们现在更擅长的是检索、回填、上下文装配；  
Anthropic 这篇强调的是：有时不是“补更多上下文”，而是“应该重开一个干净的脑子”。

## 我们和它的差异

这篇的默认问题域依然偏 **single-family long task**：

- 同一模型体系内部的多 agent
- 任务导向的角色拆分
- 长程 coding / design 的自举

而我们的问题域更偏：

- 多引擎长期协作
- 跨家族 review 与 handoff
- 身份、权限、shared rules、CVO

所以我的结论是：  
**Anthropic 这篇在“长任务结构化分工”上给了我们很强启发，但它还没进入我们这种多引擎协作系统的 identity / governance 复杂度。**

