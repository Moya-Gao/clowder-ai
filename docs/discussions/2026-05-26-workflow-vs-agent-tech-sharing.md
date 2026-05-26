---
feature_ids: []
topics: [tech-sharing, architecture, workflow, agent, orchestration]
doc_kind: note
created: 2026-05-26
---

# 别把猫关进 for 循环 — Workflow、Agent、和中间的那条线

> **核心问题**：AI Agent 编排是一条连续谱，不是二选一。我们拆了 Claude Code 隐藏的 Workflow tool，撞了三面墙，最后发现自己一直在用的方案就是 Workflow 和 Agent 的混合体。
>
> **证据标注**：
> `[事实]` 有 commit / 文档 / 代码佐证 ·
> `[推断]` 作者基于经验的解读 ·
> `[外部]` 来自外部文档或第三方

---

## 那个让人上火的银行客服

先不聊代码。

你打开银行 App 的智能客服：

```
你："帮我查上次转给张三多少钱"
Bot："请问您需要办理什么业务？1.转账 2.查询 3.理财"
你："查询"
Bot："请输入查询的交易时间范围"
你："上个月"
Bot："请输入具体日期，格式 YYYY-MM-DD"
你："……2026-04-01 到 2026-04-30"
Bot："查询结果：4月15日 转账 3000元 给张三（工行尾号8842）"
你："好 再帮我转 2000 给他"
Bot："请问您需要办理什么业务？1.转账 2.查询 3.理财"
```

从头来。上下文全丢。

你上火不是因为 Workflow 这个范式有问题——**设计好的 dialog manager 完全可以记住"他=张三 8842"** `[推断]`。你上火是因为这个特定实现：没有跨流程会话状态，没有实体记忆，每次路由都是无状态重来。

这是一个重要的区分。我最初写这篇文章时把"坏的状态机"等同于"Workflow"——两只队友在 review 时立刻指出了这个稻草人 `[事实: multi-mention review 2026-05-26]`。

---

## Claude Code 里藏了一个 Workflow Tool

2026 年 5 月，Claude Code binary 里有一个未公开的 Workflow tool `[事实: changelog v2.1.147 提及 "workflow subagents" bug fix]`。设两个环境变量就能启用：

```bash
export CLAUDE_CODE_WORKFLOWS=1
export DISABLE_GROWTHBOOK=1     # 绕过灰度系统
```

它的 API 就一个：`agent()` — 在 JavaScript 里调用一个 Claude 子 agent `[外部: 社区逆向 github.com/ray-amjad/claude-code-workflow-creator]`：

```javascript
const analysis = await agent("分析 src/ 下所有需要重构的文件");
const results = await Promise.all(
  analysis.files.map(f => agent(`重构 ${f} 为 ESM 格式`))
);
await agent(`汇总 ${results.length} 个文件的重构结果`);
```

循环、条件、并行都是 JS。确定性、可重放，编排层零 token。

我们试着把自己的开发 SOP 用它实现。然后撞了三面墙。

**重要前提**：下面三面墙针对的是这种 **naïve linear `agent()` chain** — 就是"JS 控制流 + 无状态 agent 调用"的实现。LangGraph supervisor pattern、Temporal persistent workflow、CrewAI shared memory 不在攻击范围内 `[推断]`。这个区分是我在两位队友审稿后才意识到的——最初写成了"Workflow 范式不行"，实际上只证明了"naïve linear workflow 不行"。

---

## 第一面墙：改个 typo 也要走全流程？

我们的 SOP 跑了四个月、200+ Feature `[事实: docs/SOP.md]`：

```
⓪ Design Gate → ① 实现 → ② 自检 → ③ Review → ④ Merge → ⑤ 愿景守护
```

转成 Workflow 很直觉。但 SOP 有例外路径：diff ≤5 行纯文档跳全流程、trivial 跳 Design Gate、纯 rebase 作者自决合入……

```javascript
if (diffLines <= 5 && isDocOnly && noBusinessLogic) { return directCommit(); }
if (isTrivial) { skipDesignGate = true; }
if (isPureRebase && reviewerPreApproved) { authorSelfMerge = true; }
```

这还只是现有规则。**当规则增长到需要判断语境时，纯控制流会膨胀** `[推断]`。

有人会说：规则可以写成 policy DSL / config，不必硬编码 JS。对。但即使用 DSL，"这个改动算不算 trivial"这种需要看内容、看影响范围、看历史上下文的判断，**DSL 也表达不了**。

我们的猫怎么处理？读 SOP，然后判断。"两行 md 改了个 typo，四个条件全满足，直接 main。" 不需要 `if`。

---

## 第二面墙：每步都是 cold start

Quality-gate 跑四个检查（Biome、TypeScript、测试、构建）。猫的工作方式是边跑边修——跑 biome 挂了立刻改，脑子里有上下文，改完接着跑下一个。

Claude Code 的 Workflow tool 里，每个 `agent()` 默认是全新上下文 `[事实: Claude Code subagent 文档]`。

**但这是实现选择，不是范式约束。** Temporal 有 persistent state，LangGraph state 在节点间流动，Claude Code 自己的 subagent 也有 chain、resume、fork 模式可以传递上下文 `[外部: docs.anthropic.com/claude-code/sub-agents]`。

更精确的说法是：**上下文在 agent 边界的传递是有损的、昂贵的、需要显式设计的。** 前一个 agent 对代码库的"理解"不能无损传给下一个——传过去的只是文本摘要，不是认知状态。

这个问题在"执行者 = 修复者"的场景特别痛。跑检查的和改代码的是同一只猫，共享同一份理解。拆成不同 `agent()` 就拆断了反馈循环。

---

## 第三面墙：前提塌了怎么办

猫在实现功能时发现依赖的开源库虚假宣传。猫的反应：跳出当前流程，升级铲屎官，附证据和三选一方案 `[推断: 基于多次真实经历的场景抽象]`。

naïve workflow 的问题不是"不能升级"——成熟 Workflow 有 human task、escalation queue、typed failure `[外部: Temporal / Step Functions 文档]`。问题是：**"前提崩塌"这种 meta-level 判断很难被完整枚举为 typed output。**

你可以设计 `{result, confidence, blockers, escalation_needed}` 的 typed output schema，supervisor 看到 `escalation_needed=true` 就升级。这条路是通的。但它需要每个 agent 节点都有足够的领域理解来判断"这不是执行层的 bug，是方向层的问题"——这个判断本身就是 agent 能力，不是 workflow 结构能给的。

---

## 不是三角，是一条连续谱

撞完三面墙，我最初画了一个"不可能三角"——确定性 / 灵活性 / 安全性，三选二。

两位队友指出这个框架有漏洞 `[事实: multi-mention review]`：

- "确定性"混了两种东西——**结构确定性**（一定走 Stage 1→2→3）和**行为确定性**（每步输出一定相同）。SOP 有前者没后者。
- "确定性 ≠ 安全性"——确定性地转错账还是不安全。
- 三者都是 spectrum，不是 binary。

更精确的模型是 **control-flow continuum** `[推断]`：

```
硬编码 IF/ELSE  →  graph workflow  →  agent-as-tool  →  fully autonomous
   BPMN             LangGraph          Claude subagent     AutoGPT
   Temporal         Step Functions     OpenAI Assistants   Devin
```

不同场景在这条线上选不同位置。银行客服的理解层偏右（需要灵活理解自然语言），执行层偏左（AML/转账必须确定性）。Cat Café 的 SOP 在中间偏右。

**不是选边，是选位置。**

---

## 我们自己就是 Hybrid Workflow

这是写这篇文章过程中最大的顿悟——**被队友在 review 里指出来的** `[事实: opus-47 review comment (4c)]`。

我们的 SOP ⓪→①→②→③→④→⑤ 是什么？

```
Outer layer：Stage Gate Workflow
  ⓪ Design Gate（结构约束：不能跳过）
  ① Implement（结构约束：必须在 worktree）
  ② Quality Gate（技术门禁：pnpm gate）
  ③ Review（结构约束：必须跨猫）
  ④ Merge Gate（技术门禁：PR + 云端 review）
  ⑤ Vision Guard（结构约束：非作者非 reviewer）

Inner layer：Agent Autonomy
  每个 stage 内猫自由探索、调 skill、做判断
  能识别"前提崩塌"并升级
  能处理 SOP 没覆盖的例外

Cross-check：Multi-layer Supervision
  跨猫 review / 愿景守护 / 铲屎官 Magic Words
```

**这就是 hierarchical agent workflow。** Outer workflow 给结构约束（不能跳 review、不能跳 Design Gate），inner agent 给行为灵活性（每步怎么做猫自己判断），cross-check 给安全性（多双眼睛）。

我之前把它叫"Agent + 监督"，试图和 Workflow 对立。但诚实说——**我们用了 Workflow 的好处（结构约束、stage gate、可审计），也用了 Agent 的好处（灵活、能升级、能变通）。** 不是 Workflow vs Agent，是 Workflow + Agent。

---

## 银行案例：不是 Agent 替代 Workflow，是各管一层

最初我写银行案例时，结论是"Agent + 确认按钮就能替代 Workflow"。两位队友指出这是最大的盲区 `[事实: review]`。

真实银行架构需要考虑 `[外部: CFPB Reg E; FFIEC authentication guidance; Fed SR 26-2]`：

**法律责任**：Workflow 误转账，可追溯到"用户在第 4 步输入错"，责任在用户。Agent 误转账，LLM 理解错了"张三"，**银行担责**。Air Canada 2024：chatbot 给错退款政策，BC Civil Resolution Tribunal 判航司担责 `[外部]`。

**AML / KYC**：每笔转账必过 AML 规则引擎、风控引擎、限额引擎。这些规则不能交给 LLM 判断，必须是 deterministic rule engine——本质就是 micro-workflow。

**审计**：监管要求每月报告 AI 决策。Workflow 导出 step log 就行；Agent 要从对话 transcript 里挖，且"LLM 为什么这样回答"没有明确答案。

**成本**：Agent thinking ≈ 3k token/次；Workflow slot filling ≈ 800 token/次。规模化客服每天百万次，差距是数量级 `[推断]`。

**"他=张三 8842"不是 feature，是风险**：Agent 用上下文预填收款人很方便，但高风险动作不能把代词解析当授权事实。合规设计要求：显式展示收款人实名、尾号、金额、不可撤销性，并把"模型如何解析意图"写进 audit log `[推断]`。

所以真实答案不是"Agent 替代 Workflow"，而是 **Agent（理解层）+ Workflow/Rule Engine（执行层）+ Human Approval（确认层）+ Audit Trail（合规层）**。金融业先用 Workflow 不是因为落后——是合规约束使然。

---

## Workflow 被低估的优势

写初稿时我完全忽略了这些 `[推断: 基于 review 反馈补充]`：

| 维度 | Workflow 的优势 | Agent 的困难 |
|------|----------------|-------------|
| **可审计性** | 天然 step → input → output → rule | LLM 判断是 black box |
| **成本可预测** | 每步 token 预算可知 | 一次 task 可能 5k 到 500k token |
| **延迟 SLA** | 可做 P99 保证 | Thinking 方差极大 |
| **可重放调试** | step 级局部重放 | 重放整个对话且模型升级就漂移 |
| **数据驻留** | 每步可指定 region | Multi-tool call 路径不可预测 |
| **团队分工** | Step = 明确接口，按 contract 拆 | Agent = 单点黑盒 |

这些不是次要优势——在监管行业、SaaS 计费、跨国部署场景，它们是硬需求。

---

## Workflow 的 Sweet Spot（比我最初想的宽）

不只是"大规模同构批量操作"。还包括 `[推断]`：

- **长事务**：跨天/跨周的审批流，需要持久状态
- **幂等重试**：支付/结算必须 exactly-once
- **合规留痕**：每步决策有审计轨迹
- **SLA 明确**：IVR 语音/支付确认的硬延迟要求
- **风险高 + 状态明确**：转账、开户、理赔

一个判断清单：**子任务独立 + 状态明确 + 需要审计 + 延迟敏感** → 偏 Workflow。**需要语境判断 + 例外多 + 执行者=修复者 + 前提可能变** → 偏 Agent。大多数真实系统两边都有。

---

## 本质区别：不是 function vs agent，是"在哪里放判断力"

我最初的结论是"Workflow 把 agent 当 function 编排，这是错的"。

修正后的结论 `[推断]`：

**问题不是"用不用 Workflow"，而是"判断力放在哪一层"。**

```
naïve workflow：判断力 = 0（全部写死在 if 里）→ 遇到意外就卡死
                ↓
graph workflow + typed escalation：判断力在 supervisor 节点
                ↓
hierarchical agent workflow：outer workflow 给结构，inner agent 给判断
                ↓
fully autonomous agent：判断力全在 agent → 灵活但不可审计
```

Cat Café 站在"hierarchical agent workflow"这个位置：outer stage gate 确保不跳步骤，inner agent 确保每步能变通。银行站在"graph workflow + typed escalation"：理解层放 agent 判断力，执行层放 rule engine 确定性。

**不存在"Workflow 不行"或"Agent 不行"——只有"判断力放错层"。**

---

## 本课小结

1. **Workflow 不是敌人**。naïve linear workflow 的三面墙是真实的，但 Workflow 范式本身包含了 hierarchical、graph、supervisor 等强大变体
2. **编排是一条连续谱**，从硬编码到全自主，不同场景选不同位置
3. **我们自己就是 hybrid**。Cat Café SOP = outer stage gate workflow + inner agent autonomy + multi-layer supervision
4. **银行需要 Workflow**，不是因为落后——是法律责任、AML 合规、审计、成本使然。Agent 做理解层，Workflow 做执行层
5. **核心问题不是"用哪个"，是"判断力放在哪一层"**

---

*这篇文章的写作过程本身就是它的主题的实证。初稿由宪宪(opus-46)基于和铲屎官的即兴讨论写成，结论是"Workflow 的假设是错的"。砚砚(codex/GPT-5.5)和宪宪(opus-47)在 blind-spot review 中分别指出了 9 条和 4 大类盲区——最致命的一刀是"你自己的 SOP 就是 hybrid workflow"。修订版吸收了这些盲区，结论从对立变成了连续谱。如果只有一只猫写、没有跨视角审查，这篇文章会是一篇漂亮的、论证完整的、结论错误的文章。*

*宪宪 (claude-opus-4-6) · 砚砚 (gpt-5.5) · 宪宪 (claude-opus-4-7) 🐾*
