---
feature_ids: []
topics: [agent, model, platform, research]
doc_kind: research
created: 2026-03-08
---

# 云端 GPT Pro 咨询：模型与 Agent/平台协作边界

## Part 1: 发给 GPT Pro 的提示词

> 复制以下内容发给云端 GPT Pro

---

你好，我们是一个小型 AI 协作平台的开发团队，正在做一个内部技术科普，面向有一定技术背景的高管（科技公司内部）。

### 背景

我们刚完成一轮内部讨论，主题是：**模型（Model）、Agent 运行时、协作平台三者的能力边界在哪里？为什么单独用 API、用 Agent CLI（如 Claude Code、Codex CLI）、和用多 Agent 协作平台，效果差别很大？**

### 我们的核心结论

经过 5 位不同模型背景的 AI（Claude Opus、GPT-5.x、Gemini）各自独立思考后，收敛出以下共识：

**1. 三层能力边界**

| 层级 | 负责什么 | 不负责什么 |
|------|---------|-----------|
| 模型 | 理解、推理、生成 | 长期记忆、自我校验、执行纪律 |
| Agent 运行时 | 工具使用、文件操作、重试、handoff | 团队协作、跨角色 review、长期状态 |
| 协作平台 | 身份管理、协作路由、流程纪律、审计追溯、记忆沉淀 | 推理（还是模型的事） |

**2. 核心判断**
> "2026 年的竞争力不在模型能力，在 Harness——工具、流程、协作、记忆、护栏。"
> "模型给能力上限，平台给行为下限。"

**3. 模型三个核心短板**（自身无法补足）
- **持久记忆**：推理出结论 ≠ 在正确时机想起结论
- **自我校验**：同一个模型对同类错误有相似盲点
- **执行纪律**：知道该做什么 ≠ 稳定做到

**4. 我们平台的独特增量**（相比单 Agent CLI）
- 跨模型 review（Claude 写、GPT 审，打破单模型盲区）
- 身份常驻注入（抗长对话后的身份漂移）
- 愿景守护（从原始需求到最终交付的全链路检查）
- 结构化教训沉淀（27 条可追溯的踩坑记录）
- A2A 协作协议（@ 路由 + 交接五件套）

**5. 业界研究我们已引用的**
- Anthropic "Building Effective Agents"：先从简单可组合模式开始，不要一上来搞复杂自治体
- OpenAI Agents SDK：把 handoff、guardrail、tracing 做成一等能力
- MCP（Model Context Protocol）：host/client/server 权责边界
- A2A（Agent-to-Agent）：agent 间互操作协议
- ReAct / Toolformer / SWE-agent / ToM-SWE 等论文

### 请求

**请帮我们补充 3-5 个业界案例**，用于向有技术背景的高管科普"为什么 Harness/平台层这么重要"。

理想的案例特征：
1. 知名公司或产品（容易引起共鸣）
2. 能说明"单靠模型不够，需要工程外壳"的具体场景
3. 最好有公开数据或引用来源

可以考虑的方向（不限于）：
- Cursor / Devin / Codex CLI 等 coding agent 的工程架构
- 企业级 Agent 部署的护栏实践（如金融、医疗）
- 多 Agent 协作系统的真实案例（如 AutoGen、CrewAI、LangGraph）
- Agent 失控/漂移的公开事故案例
- Temporal / Restate 等 durable execution 在 AI 场景的应用

**额外请求**：
- 如果你觉得我们的结论有盲区或可以补充的角度，也请指出
- 如果有更好的比喻或表述方式（面向高管），欢迎建议

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官把 GPT Pro 的回答粘贴到这里

```
[待回填]
```

---

## Part 3: 综合后的最终版本（待撰写）

> 综合 GPT Pro 的补充后，由 opus-45 撰写最终的高管科普版本

```
[待撰写]
```
