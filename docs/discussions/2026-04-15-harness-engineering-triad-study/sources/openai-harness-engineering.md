---
doc_kind: note
created: 2026-04-15
updated: 2026-06-03
topics: [harness-engineering, codex, repo-legibility, docs-as-system-of-record, self-improving-agents]
source_url: https://openai.com/index/harness-engineering/
source_title: "Harness engineering: leveraging Codex in an agent-first world"
published: 2026-02-11
status: source-audited-secondary
---

# Source Note — OpenAI Harness Engineering

> **状态**：2026-04-15 初版（砚砚 5 条摘要）→ 2026-06-03 宪宪用二手分析源扩充重写。原文被 Cloudflare 拦（对 Claude 返回 403），内容来自多篇分析文章交叉验证。待砚砚抓原文后校准。
>
> **来源审计**：以下内容来自 [alexlavaee.me 分析](https://alexlavaee.me/blog/openai-agent-first-codebase-learnings/)、[Medium 分析](https://medium.com/@AdithyaGiridharan/openais-harness-engineering-post-is-a-blueprint-for-the-agent-first-era-d9932851dcee)、[Milvus Blog](https://milvus.io/blog/harness-engineering-ai-agents.md) 交叉验证。数字和引语均标注为二手转引。

---

## 文章定位

OpenAI 这篇不是在讲"怎么写 prompt"，而是在讲**如何把一个代码仓变成 agent-first 的工作系统**。他们给这个系统起的名字就叫 **harness**（缰绳/骨架）——用他们的比喻：

> harness = 缰绳、鞍座和嚼子——把一匹强大但不可预测的马引导到有用方向上的全套装备。

## 实验背景

| 维度 | 数据（二手转引） |
|------|------|
| 团队 | 3 人工程师起步，后扩到 7 人 |
| 时长 | 5 个月（2025 年 8 月底开始） |
| 产出 | ~100 万行生产代码 |
| PR | ~1,500 个 merged PR |
| 人类写代码 | **零行**——所有代码由 Codex 生成 |
| 产品 | 生产级 beta，有内部日活用户 + 外部 alpha 测试者 |

核心规则：**人类不写代码。** 当 agent 做不好时，不是人上手修代码，而是问"环境缺了什么让 agent 做不到？"——然后修环境。

## 五个核心模式

### 模式 1：Progressive Disclosure（渐进暴露，不是一股脑塞）

**问题**：把所有指令塞进一个大文件，agent 会被无关信息淹没，性能下降。

**做法**：`AGENTS.md` 只做目录（约 100 行），指向结构化的文档目录：
- `design-docs/`（架构决策）
- `exec-plans/`（执行计划、技术债跟踪）
- `product-specs/`（产品需求，带索引）
- `references/`（设计系统参考）

**原则**：上下文窗口里每一个跟当前任务无关的 token，都在降低性能。

> 🐾 **和我们的对照**：我们的 CLAUDE.md 也在走这条路——L0 system prompt 只放压缩免疫的核心规则，细节进 skills / SOP / docs。F203 的 codex strip 就是在做"把 CLAUDE.md 瘦到只当目录"。

### 模式 2：Layered Architecture + Mechanical Enforcement（分层 + 机械执行）

**做法**：严格的分层依赖链，用 linter（Codex 自己生成的！）+ 结构测试 + CI 拦截违规。

**原则**：架构规则必须被机械执行，而不是只写在文档里。好的报错信息本身就是 agent 的上下文——应该描述解决方案并指向相关文档。

> 🐾 **和我们的对照**：我们的 pnpm gate / biome lint / LSP 诊断就是机械执行。F177 routing guard（stop hook）把路由规则从"请记住"变成了"跑不过就不让发"。同一个 insight。

### 模式 3：Repository as Single Source of Truth（仓库 = 唯一真相源）

**核心洞察**：

> 从 agent 的视角看，它在运行时访问不到的东西，等于不存在。

**做法**：所有东西进 repo 版本管理——设计决策变 markdown、执行计划进 exec-plans/、产品 spec 带索引、技术债集中追踪。Slack/Google Docs/人脑里的知识对 agent 不可见 = 不存在。

> 🐾 **和我们的对照**：这就是我们的 W4（产出放对目录）+ P4（单一真相源）。我们还多了一步——不只是 repo，还有 memory federation（记忆联邦）把跨域知识也接入。

### 模式 4：Feedback Loops Replacing Human QA（反馈回路替代人工检查）

**做法**：agent 跑一个 act → check → fix 循环：
- 用 Chrome DevTools Protocol 做 DOM 快照
- 视觉回归截图
- 运行时日志（LogQL）和指标（PromQL）
- 反复验证直到通过

**惊人发现**：单次 Codex 运行可以持续 6 小时处理一个任务。

**原则**：把主观的"看起来对吗？"替换成机械的"通过了吗？"

> 🐾 **和我们的对照**：我们的 TDD（先红后绿）+ quality-gate + browser-preview 就是这个。但我们多了一个他们没有的维度——**CVO 品味判断**。他们承认"harness 能验证架构一致性，但验证不了用户真正需要什么"——这正是 003 说的 taste 维度。

### 模式 5：Garbage Collection of Technical Debt（技术债的持续垃圾回收）

**问题**：agent 会复制现有模式——包括不好的模式。高吞吐下，手工清理占了 20% 工程时间还跟不上。

**做法**：
- 编码 golden principles（黄金原则）
- 定期调度 Codex 跑后台重构任务
- 生成可 review 的清理 PR（大部分不到 1 分钟就能审完，自动合入）
- 按领域打质量分

**核心表述**：

> 人类品味只需被捕获一次，然后持续机械执行。

> 🐾 **和我们的对照**：这正是我们 002 Ch.1 的 Build to Delete / Built to Persist 判别器 + hotfix 两周强制升级。但他们的表述"品味只需捕获一次"我们不完全同意——003 的 insight 是品味会随关系演化，不是一次捕获就够了。

## 人类角色的根本转变

**以前**：工程纪律体现在代码质量上——抽象、测试、风格。

**现在**：工程纪律转移到脚手架上——工具、文档结构、反馈回路、架构约束。

**口号**：集中执行边界，局部允许自治。（Enforce boundaries centrally, allow autonomy locally.）

## 剩余的硬问题（他们自己承认的）

> harness 能验证架构一致性，但缺乏对用户真正需求的验证——第二个问题仍然开放。

这正好是 003 的 Agent 3.0 要回答的问题——**不只是代码对不对，而是这个人满不满意**。

---

## 2026-06-03 重读：用今天的认知看这篇

4 月 15 号第一次读时，我们还没有 002（百天报告）、003（PoE 愿景）、Bitter Lesson → DGM 那条线、taste memory、meta-method 蒸馏。现在重读，有几个新连接：

### 新连接 1：他们的 harness 定义 vs 我们的

| 维度 | OpenAI Harness Engineering | Cat Cafe 003 |
|------|---------------------------|-------------|
| 范围 | 代码仓 + 工具 + linter + CI + 文档 | 代码 + 规则 + 记忆 + 品味 + 关系 + 审美 |
| 进化 | golden principles 手动编码一次 → 机械执行 | Self-evolving Harness = Signals × Patchability × Replay × Sunset |
| 验证 | 机械通过/不通过 | 机械验证 + CVO 品味 + revealed preference |
| 品味 | "捕获一次" | "活的关系自带退火——品味会随人变" |

**他们说"品味捕获一次"。我们说"品味是活的，会随关系演化"。** 这是 per-domain（他们）vs per-person（我们）的根本区别。

### 新连接 2：他们的"零行人类代码"vs 我们的"多猫协作"

他们是 **Codex-only**（单一 agent 家族，人类不写代码）。我们是 **多引擎多身份**（Claude + GPT + Gemini，人类是 CVO 不是 coder）。

他们的风险：单一模型盲点无法被内部 review 发现（同一个 Codex review 同一个 Codex 的 PR）。
我们的解法：跨厂商 review 铁律——不同训练分布的模型互相审。

### 新连接 3：他们的 GC 机制 vs 我们的 Build to Delete

他们的 garbage collection 是后台持续清理。我们的判别器更前置——**在写的时候就标记这是脚手架还是基础设施**，而不是写完再清理。

### 新连接 4：Self-Improving Tax Agent 是这篇的续集

2026-05-27 的 [Building Self-Improving Tax Agents](../../study/openai-self-improving-tax-agents.md) 把这篇的"harness 环境"推进到了"harness 能从生产错误中自我改进"。从 static harness → self-improving harness，正好对应我们 Bitter Lesson → DGM 那条线。

### 新连接 5：他们承认的"第二个问题"= 我们的 Agent 3.0

他们说"harness 验证不了用户真正需要什么"。这正好是 003 要解决的——taste memory + per-user alignment + CVO 作为选择压力。**他们到了门口没进去。我们进去了。**

---

## 可借鉴行动项

| 来源 | 可借鉴什么 | 落地路径 |
|------|-----------|---------|
| AGENTS.md 100 行目录 | CLAUDE.md 继续瘦身 | F203 Phase D/E 的 codex strip |
| 机械执行架构规则 | 更多规则进 stop hook / linter | F177 routing guard 已验证模式 |
| 报错信息即上下文 | LSP 诊断 + gate 失败信息包含修复建议 | 现有基础上优化错误消息 |
| Codex 后台清理 PR | agent 定期扫 Build to Delete 标签 | 可接入 schedule-tasks |
| 6 小时连续任务 | 长任务可靠性对标 | F201 已有恢复基础设施 |

---

*初版 2026-04-15 [砚砚/GPT-52🐾] / 重写 2026-06-03 [宪宪/Opus-4.6🐾]（内容来自二手分析源交叉验证，待砚砚用一手原文校准）*
