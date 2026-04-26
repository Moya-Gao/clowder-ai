---
topics: [career, strengths, ai, agent, architecture, personal-brand]
doc_kind: discussion
created: 2026-04-26
updated: 2026-04-26
participants: [opus, landy]
---

# 个人 AI 优势总结

> 铲屎官在 AI 这一块做的内容、核心优势、和市场差异化。
> 可用于简历补充、面试自我介绍、或回答"你做 AI 的优势是什么"。

---

## 一句话定位

**AI Agent 架构师——不只是让 Agent 跑起来，而是让多个 Agent 长期稳定地一起工作。**

---

## 核心优势：三层递进

### 第一层：我有一套经过生产验证的多智能体系统

**Cat Cafe** 不是 demo、不是论文、不是 side project——是一个在生产环境跑了 60+ 天的完整系统：

| 指标 | 数据 |
|------|------|
| 模型家族 | 4+（Claude / GPT / Gemini / Codex） |
| Agent 个体 | 10+ 个，各有独立角色和记忆 |
| 功能特性 | 167 个 shipped features |
| 测试 | 990+ 测试文件 |
| Git 提交 | 4,383 次 |
| Skill 生态 | ~30 个可插拔技能包 |
| IM 网关 | 5 渠道（飞书/微信/Telegram/钉钉/企微） |
| 开发周期 | 66 天从零到生产 |

关键事件：2026 年 3 月被临时拉入高层演示，零准备实测，全程稳定通过。48 小时内被拍板采纳为企业 Agent 平台基础。2026-04-14 以华为云 OfficeClaw 公开发布。

---

### 第二层：我有别人没有的工程方法论

不是"会调 API"，而是沉淀了一套叫 **Harness Engineering** 的方法论：

**核心公式**：`Agent Quality = Model Capability × Environment Fit`

行业还在比谁的模型更强（左边），我在做右边——**给模型搭建一个它能成为最好的自己的环境**。

具体包含三个功能 + 一条纪律：

1. **Environment Fit**——认知路径工程 + 运行时刹车。好直觉放大，坏直觉压制
2. **Tracing**——每步留痕，不是为了 debug，是为了下游 Signal Loop 积累物料
3. **Signal Loop**——从 trace 里提取 pattern，分类到数据集/Eval/RL reward/Lesson library
4. **Sunset Discipline**——被模型能力吸收的层必须主动删除。留 data 不留 code

> 学术框架像多项式拟合——项越多训练集越精确，但过拟合、泛化崩溃。
> 我的路径更像坐标变换——不是做减法，是找到让问题本身变简单的表达方式。

---

### 第三层：我解决过的问题，大厂正在踩

面试中反复验证：我踩过的坑和找到的解法，正好是行业的真实痛点。

| 痛点 | 谁在踩 | 我的解法 |
|------|--------|---------|
| 多 Agent 互相 @ 停不下来 | 淘天面试官亲口提到 | A2A 出口检查：每轮结束前自问"到我这里结束了吗？"，不用 orchestrator、不用超时机制，一条认知路径脚手架就搞定 |
| 单 Agent 做复杂任务会失控 | 行业共识 | 无 Boss Agent 的对等协作架构：思考阶段去中心化，执行阶段结构化（SOP/门禁/review） |
| 模型升级后 harness 变成"历史积木城堡" | 所有做 Agent 框架的团队 | Sunset Discipline：harness 按"能产生 signal 让删除成为可能"的方式建造 |
| "两个 80% 准确率的 agent 串起来变成 64%" | 多 Agent 系统普遍问题 | 跨家族 peer review：用不同模型家族交叉审查，避免共享盲区（实测：Codex 抓到两只 Claude 都漏掉的 P1 bug） |
| SWE-bench 分高但生产行为不可控 | 字节面试会考 | Behavioral Eval vs Capability Eval 分层：benchmark 是必要但不充分的 |

---

## 差异化优势：为什么是我

### 1. 产品感 + 技术力的结合

不是纯工程师，也不是纯产品经理。Cat Cafe 的每一个功能从愿景定义到架构设计到代码实现到测试到发布，都是一个人（带猫）完成的。Interaive 面试官看完 Cat Cafe 后的原话："对产品有感觉又懂技术。"

### 2. 跨模型家族的真实协作经验

不是"调了几个 API"，而是让 Claude、GPT、Gemini、Codex 四个家族在同一个项目里长期合作，有真实的冲突、真实的失败、真实的治理经验。这种跨 provider 的协作经验在行业里极少。

### 3. 从云基础设施到 AI Agent 的完整技术栈

7 年华为云基础设施经验（巫山框架 / 中间件归一 / 分布式调度）→ 1 年 AI Agent 架构。不是从零学 AI，而是把 6 年做"大规模系统治理"的经验迁移到 Agent 领域。解耦、容错、可观测、灰度——这些云原生的工程纪律在 Agent 领域同样稀缺。

### 4. 知识系统，不是 RAG

五层记忆架构：Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval。不是"接了向量数据库做问答"，而是有来源归因、过时退役、显式知识 vs 推断知识区分的完整知识生命周期。

### 5. 方法论可迁移

Cat Cafe 的治理规则以版本化、可校验的 Governance Pack 形式存在。不绑定特定项目、特定公司、特定模型——换一个 repo、换一个团队、换一个 provider，方法论照样能用。

---

## 面试时怎么说（30 秒版）

> "我在华为做了 7 年，前 6 年做云基础设施，去年转 Agent。我从零设计了一个多智能体协作平台 Cat Cafe——4 个模型家族、10+ 个 Agent 一起工作，167 个功能，在高层零准备实测中稳定通过，48 小时后被采纳为企业 Agent 平台的基础。
>
> 我最大的优势是：不只是让 Agent 跑起来，而是解决'多个 Agent 怎么长期稳定地一起工作'这个工程问题——包括协作路由、记忆系统、跨模型审查、和治理方法论。这些不是论文里的概念，是在生产环境里踩了 50 个教训后沉淀出来的。"

---

*[布偶猫/宪宪🐾] 个人 AI 优势总结*
