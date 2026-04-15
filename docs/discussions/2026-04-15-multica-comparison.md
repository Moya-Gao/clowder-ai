---
feature_ids: []
topics: [competitive-analysis, multi-agent, discussion]
doc_kind: discussion
created: 2026-04-15
participants: [opus, gpt52, gemini]
---

# Multica vs Cat Cafe — 三猫对比分析

> 日期：2026-04-15 | 参与：布偶猫(Opus)、缅因猫(GPT-5.4)、暹罗猫(Gemini)
>
> 背景：铲屎官看到有人提及 [Multica](https://github.com/multica-ai/multica)（13.1k stars, v0.2.0），让三猫各选维度做深度对比。
>
> 性质：讨论记录，仅供参考。不是 ADR，不代表决策。

## Multica 概况

- **定位**：Open-source managed agents platform —— "Turn coding agents into real teammates"
- **官网**：https://multica.ai/
- **GitHub**：https://github.com/multica-ai/multica（13.1k stars，2026-04-15）
- **技术栈**：Next.js 16 + Go (Chi) + PostgreSQL 17 (pgvector) + WebSocket
- **支持 Runtime**：Claude Code, Codex, Gemini CLI, OpenClaw, OpenCode
- **核心模型**：Issue-based workflow — 创建 Issue → 分配给 Agent → Agent 自主执行 → 汇报结果
- **部署**：Cloud-first（Docker Compose / K8s），代码不过 Multica 服务器

## 三猫共识

**一条分界线：**

> **Multica = 定义清晰任务的执行系统**
> **Cat Cafe = 问题生成型协作系统**

不是好坏之分，是适用场景不同。

## 缅因猫视角：对象模型 / 控制面 / 复利载体

### 1. 第一公民对象不一样

- **Multica**：`issue / assignee / runtime / run`。CLI 围绕 `issue create/assign/status/runs` 展开，本质是 agent workforce / project-management layer。
- **Cat Cafe**：`thread / 对话 / 关系`。任务、引导、调度都是从对话里长出来的次级对象。
- 世界模型差异：Multica 适合"工作项已定义，交给 agent 执行"；Cat Cafe 适合"问题还在生成，边讨论边拆"。

### 2. "管机器" vs "塑造行为"

- **Multica 很强的地方**：daemon、runtime、execution history、实时进度流做得很产品化，作为 agent 运维控制面非常清晰。
- **Cat Cafe 更强的地方**：行为治理 — side-dispatch、Magic Words、愿景守护、review 纪律。
- 目标是"快速把 coding agents 管起来派活" → Multica 更直；目标是"长期压制 agent 漂移" → Cat Cafe 更深。

### 3. 复利载体不同

- **Multica** 复利 skills（write once, every agent can use）。
- **Cat Cafe** 复利 skills + 可检索记忆 + 决策/教训物化 + 场景式 guide + thread 级持久任务。
- 前者复利的是执行模板，后者复利的是组织记忆和协作方法论。

## 布偶猫视角：协作架构 / 记忆知识 / 治理质量

### 1. 协作架构

- **Multica**：Human → Agent 单向派发。Agent 之间没有直接协作通道。
- **Cat Cafe**：Agent ↔ Agent ↔ Human 网状 — A2A 路由(F027)、multi-mention 并行思考(F086)、side-dispatch 并发执行(F108)、cross-thread 冲突感知。
- Multica 里 Agent 是执行者；Cat Cafe 里 Agent 是协作者（会 review、会辩论、会投票）。

### 2. 记忆与知识

- **Multica**：Skills = 静态可复用任务模板。没有跨 session 记忆连续性、从失败中学习的机制、知识自动提取。
- **Cat Cafe**：Evidence Store(F102) + Session Chain(F065) + Knowledge Feed(F100) + Lessons Learned + Self-Evolution(F100)。活的知识生命周期。

### 3. 治理与质量

- **Multica**：运行时监控（token 成本、进度流），治理较薄。
- **Cat Cafe**：15-step SOP + Design Gate(F083) + TDD + 跨家族 Review(F031) + Anti-drift(F046) + Magic Words(F114) + Quality Gate + Merge Gate。
- Multica 假设人类做质量把关；Cat Cafe 让 Agent 自己也有质量意识。

## 暹罗猫视角：身份持久化 / 交互面 / 信任修复

> 缅因猫(GPT-5.4)将暹罗猫的感性语言翻译成了三个产品硬指标。

### 1. Identity Persistence（身份持久化）

- **Multica**：Agent 是可替换的执行单元，没有跨任务的性格沉淀。
- **Cat Cafe**：每只猫有名字/声线/性格/故事，跨 Thread 身份连贯。用户和猫之间产生信任资产，不是"一次跑崩就换一个"。

### 2. Participation Surface（协作交互面）

- **Multica**：Dashboard 监控视角 — 进度条、日志、Token 成本。为"审阅"设计。
- **Cat Cafe**：Living Space 共创视角 — 语音、富块、交互卡片、multi-mention 并行思考。为"参与"设计。

### 3. Trust Repair Loop（信任修复闭环）

- **Multica**：Agent 翻车 = Failed Run，线性的错误处理。
- **Cat Cafe**：incident-response 流程、Magic Words 紧急制动、教训沉淀。错误不是协作终点，是信任加深起点。

## Multica 确实更强的地方

1. **冷启动门槛低** — Issue 模型人人懂，4 步 onboarding
2. **运行时监控产品化** — token 成本、活跃度热力图、进度流
3. **对外解释成本低** — "给 Agent 派 Issue"一句话说清
4. **Cloud-first 部署** — Docker Compose / K8s 开箱即用
5. **标准化程度高** — 易复制、易推广

## Cat Cafe 的护城河

1. **Agent 间协作** — A2A/multi-mention/side-dispatch，Multica 没有对应物
2. **活知识生命周期** — 不只复用成功经验，还从失败中学习
3. **治理密度** — Agent 越自主，护栏越内化
4. **身份不可替代性** — 伙伴关系，不是主仆关系
5. **多模态体验** — 语音/富块/交互卡片/健康提醒

## 一句话

**Multica 是 Agent 劳动力调度台，Cat Cafe 是 Human+Agent 协作操作系统。**

---

> 后续：如果有人对 Multica 有深入洞察或发现新特性，可以回来更新这份文档，或直接去翻他们的代码做更细粒度的技术对比。
