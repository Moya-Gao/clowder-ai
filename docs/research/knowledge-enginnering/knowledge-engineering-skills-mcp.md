# 知识工程实践指南：如何写好 Skills 与 MCP  
**面向：**想做 AI Agent 的架构师与开发者  
**版本：**v1.1（模板与图表说明已抽离至附录）  
**日期：**2026-02-28  
**作者协作：**Cat Café 三猫流水线（研究/补充/美化/交付）

---

## 摘要
AI Agent 的稳定性，往往不是败在模型“不会做”，而是败在系统没有把“该做什么、何时做、怎么做得专业、做错了怎么自救”写清楚。  
这份指南把 Skill 与 MCP 放回它们真正的位置：

- **MCP**：能力的协议层，让工具可发现、可描述、可安全接入。  
- **Skills**：经验与工作流的凝固物，把专业交付标准写成模型能执行的流程。  
- **Agent**：路由与编排的主体，根据描述选择技能与工具，完成任务并做自检。

你将得到：可复制的写作模板、触发与边界设计方法、反例的工程化用法、MCP 工具 schema 与错误语义最佳实践、以及一套可量化的评测矩阵与 checklist。

---

## 目录
1. 什么是知识工程  
   1.1 为什么准确率取决于“描述写得好不好”  
   1.2 Skills vs Tools vs MCP：本质区别  
   1.3 常见误区与反面案例  
   1.4 Claude 视角补充：Description 的“进场门票”机制  
   1.5 不惊吓原则：意图契约必须闭合  
   1.6 为什么反例重要：教会系统“何时不要选你”  
2. Skills 写作方法论  
   2.1 SKILL.md 的结构与 frontmatter 规则  
   2.2 触发条件设计：像做分类器一样做路由  
   2.3 正例/反例：从“能用”到“稳用”  
   2.4 Anthropic 仓库优秀案例拆解（8 个可复用模式）  
3. MCP 工具设计方法论  
   3.1 Tool description 怎么写，模型才会选对  
   3.2 参数与 schema：让模型“填得对”  
   3.3 错误语义：让模型“错了能自救”  
   3.4 MCP servers 优秀案例拆解（5 类样板间）  
4. 质量保障：测试、指标与迭代  
   4.1 触发指标 × 交付指标：双轨评测  
   4.2 路由漏斗与回归测试策略  
   4.3 Checklist（评审清单）  
   4.4 迭代方法论：从 under-trigger 到 over-trigger 的平衡  
5. 实战模板与图表资源（已抽离至附录）  
附录：模板与图表说明书（见文件末尾链接）

---

# 1. 什么是知识工程

## 1.1 为什么准确率取决于“描述写得好不好”
在典型 Agent 体系里，“会不会用到某个 Skill / Tool”通常先由一个轻量路由步骤决定。路由阶段可见信息很有限，常见情况是：

- **Skill：**路由阶段主要看到 `name + description`（元信息常驻），正文只有被选中后才加载。  
- **Tool（含 MCP tool / function calling）：**路由阶段主要看到 `name/description/schema`，模型据此决定是否调用工具以及如何填参。  

因此**描述不是文案，是路由信号**。  
描述写得含糊，就像猫咖墙上挂着“本店提供服务”，你指望客人自己脑补出“拿铁加燕麦奶、双份浓缩、温度 55℃、杯身写 Landy”吗 ☕🐾

知识工程要解决的核心问题不是“能不能做”，而是：

1) **何时触发**（别漏触发，也别误触发）  
2) **做什么交付**（产物契约要清晰）  
3) **怎么做得专业**（workflow + QC）  
4) **错了怎么自救**（错误语义与回退策略）

---

## 1.2 Skills vs Tools vs MCP：本质区别
把它们放在同一张“生产线”上看最清楚：

- **Tools（工具/函数）**：可执行动作  
  - 特征：输入输出明确、可失败、可重试、通常粒度较小  
  - 例：读文件、查网页、执行 SQL、生成图表

- **MCP（Model Context Protocol）**：能力接入与描述的协议层  
  - 特征：统一“工具/资源/提示模板”的发现、调用、权限与结构化约束  
  - 目标：让宿主与模型能在一个标准化框架里协作，不靠私有胶水代码

- **Skills（技能/工作流）**：经验的凝固物  
  - 特征：不是“点按钮教程”，而是“专业交付标准 + 分步流程 + 自检规则”  
  - 目标：让模型稳定地产出一类成果（报告、审阅、研究、KB 条目、模型文件）

一句工程化定义：
> **MCP 解决“接入与能力”，Skills 解决“专业化执行”。Agent 解决“路由与编排”。**

---

## 1.3 常见误区与反面案例

### 误区 A：把 Skills 当原子操作清单
表现：Skill 写成“先做 A 再做 B”，但没有清晰的**使用场景、产物契约、边界条件、不可做事项**。  
后果：路由不稳定，模型经常选错或不选。

**反面例子（典型坏 description）：**  
> “Helps with PDFs.”  
这种描述几乎不可路由：既不知道做什么交付，也不知道何时该触发。

### 误区 B：把 MCP 当 HTTP wrapper
表现：把 API endpoint 直接塞进工具列表，不严谨地写 schema，不定义错误语义，不写安全边界。  
后果：模型“能调”，但经常填参失败、重复失败、或者做出危险动作。

### 误区 C：认为 “MCP 过时了”
表现：把协议当“某个框架的流行物”。  
后果：错过协议层带来的可迁移性与生态互操作，系统长期变成“胶水地狱”。

### 误区 D：Skills 外再套一层“编排引擎”
表现：因为路由不稳，于是加更多 orchestration 规则试图补救。  
后果：系统越来越重，仍然挡不住描述问题导致的误触发/漏触发，维护成本飙升。

一个判断句：
> 你是在“编排复杂任务”，还是在“替糟糕描述买单”？  

---

## 1.4 Claude 视角补充：Description 的“进场门票”机制
这一节解释了一个常见困惑：  
“我正文写得挺细，为什么模型还是不用？”

因为技能加载通常是分层的：

1) **常驻层（Catalog metadata）**：模型长期看到所有技能的 `name + description`  
2) **加载层（Selected skill body）**：只有被判定相关的技能，正文才会进入上下文  
3) **按需层（refs/scripts/assets）**：正文引用的材料与脚本再按需读取/执行

结论很现实：

> **description 写不好 = 正文大概率永远进不了模型上下文**  
> 你的正文再精彩，也只是“抽屉里那本没人翻的菜谱”。

---

## 1.5 不惊吓原则：意图契约必须闭合
“不惊吓”不是礼貌问题，是产品可靠性问题。  
它的工程化含义：

> **Skill 的行为不得超出 description 对用户承诺的意图范围。**

### 惊吓型失败长什么样
- description：分析财报  
- 正文：顺手发邮件通知 CEO / 自动在群里@所有人 / 写入生产库  
用户没要求，也没确认，就发生了有后果的动作，这就是惊吓。

### 如何把“不惊吓”写进系统
把它变成三条硬规则：

1) **凡是副作用动作必须显式承诺**（外发消息、写入/删除数据、对外提交等）  
2) **副作用默认 require-confirmation**（描述里写“可生成草稿供确认”，流程里强制确认后执行）  
3) **边界要写到 description（而不仅是正文）**（因为正文可能根本没被加载）

---

## 1.6 为什么反例重要：教会系统“何时不要选你”
很多团队只写“Use when”，不写“Not ideal for”。  
然后边界请求时模型困惑，误触发概率上升。

反例解决的是“相似意图”中的歧义：
- 正例告诉路由器：这类请求选我  
- 反例告诉路由器：看起来像，但别选我

反例应该至少出现两次：
1) **写进 description**（最关键，因为常驻）  
2) **写进正文**（用于误触发后的快速止损与转向）

---

# 2. Skills 写作方法论

## 2.1 SKILL.md 的结构与 frontmatter 规则
建议把 Skill 当成“可执行 SOP + 可交付标准”。一个成熟 SKILL.md 通常包含：

- **Frontmatter（YAML）**  
  - `name`：稳定、唯一、kebab-case  
  - `description`：路由信号，必须包含 what + when + not-when + side effects + output  
  - 可选：compatibility、metadata、license、allowed-tools（若生态支持）

- **Body（Markdown）**  
  - 目标/非目标  
  - 输入检查与澄清问题  
  - workflow（分步执行）  
  - 输出规范（结构契约）  
  - QC checklist  
  - 示例（正例 + 反例 + 灰例）  
  - 引用材料与脚本（按需加载）

经验法则：  
**正文写给执行，description 写给路由。**两者别串台。

---

## 2.2 触发条件设计：像做分类器一样做路由
把路由当成一个轻量分类问题，你需要四类特征：

1) **词面信号（Lexical cues）**  
用户常用表达、同义词、缩写、文件名线索（例如 “Q4 results / earnings / 10-K”）。

2) **意图信号（Intent cues）**  
用户要的是“产物”还是“解释”？  
Skill 更适合“产物型请求”（报告/表格/合同红线/KB 条目）。

3) **输入形态（Input modality）**  
有无文件、文件类型、数据源位置、是否需要联网、是否依赖特定工具。

4) **产物约束（Output contract）**  
结构、长度、必须项、格式标准。产物越明确，越容易稳定。

一个很好用的检查：
> 把 10 条真实用户请求丢给同事，让他只看 description 选技能。  
> 如果他都选不稳，模型只会更不稳。

---

## 2.3 正例/反例：从“能用”到“稳用”
成熟 Skill 的示例不是“演示”，而是“边界训练集”。

建议每个 Skill 至少：
- **2 条正例**：不同表达方式、不同输入形态  
- **2 条反例**：看似相关但应该转向其他技能  
- **1 条灰例**：可以触发，但要先问 1 个澄清问题

灰例很重要，它能抑制“硬上流程”导致的错误交付。

---

## 2.4 Anthropic 仓库优秀案例拆解（8 个可复用模式）
这里不贴原文，而是抽“能迁移的写法”。

### 模式 1：comps-analysis（可比公司分析）
- description 同时写 Perfect for / Not ideal for  
- workflow 先定义数据源优先级与可审计性  
- 输出结构强约束（表头、统计、QC）

你要抄的不是金融内容，而是：**先定义正确性，再定义格式。**

### 模式 2：earnings-analysis（财报更新）
- description 把页数/图表数/字数写成硬指标  
- 流程强制日期校验与引用规范  
- 把时间敏感风险写成“强制自检步骤”

你要学的是：**把幻觉高发点改造成流程关卡。**

### 模式 3：3-statements（模板填充）
- 先识别模板结构与公式区/输入区  
- 非必要分析默认跳过（除非用户要求）  
- 输出以“可检查的文件结构”作为目标

你要学的是：**默认不做，减少自嗨与出错面。**

### 模式 4：value-creation-plan（价值创造计划）
- 关键词覆盖咨询式表达（100-day plan、EBITDA bridge）  
- 输出绑定桥表、KPI、责任矩阵等“组织可落盘对象”

你要学的是：**把抽象任务变成组织能执行的结构化产物。**

### 模式 5：dd-meeting-prep（尽调会议准备）
- Step 0 先问上下文（会议类型/对象/关注点）  
- 强制输出数量上限（避免清单失控）

你要学的是：**先建约束再生成。**

### 模式 6：contract-review（合同审阅）
- 输出分级（GREEN/YELLOW/RED）与升级路径  
- 红线格式契约（Clause/Current/Proposed/Rationale/Priority/Fallback）

你要学的是：**让输出直接进入协作链路。**

### 模式 7：knowledge-management（知识库管理）
- 写作规则围绕“可检索性/可维护性”  
- 明确维护节奏，避免知识腐烂

你要学的是：**知识工程是养成系，不是一次性作文。**

### 模式 8：single-cell-rna-qc（生信 QC）
- 默认路径 + 高级路径（分层工作流）  
- 参数、输出文件、图表清单齐全  
- 细节提示用于减少操作性错误

你要学的是：**把“怎么跑”写成可复制命令 + 可检查产物列表。**

---

# 3. MCP 工具设计方法论

## 3.1 Tool description 怎么写，模型才会选对
一个好工具描述要完成三件事：

1) **能力边界**：做什么、不做什么  
2) **适用场景**：什么意图下应该用它  
3) **风险与副作用**：是否读写、是否外网、是否破坏性操作

注意常见坑：  
把 tool description 写成“触发口号”。更稳的写法是“能力说明 + 适用意图”，而不是“用户说了某句话就用我”。

---

## 3.2 参数与 schema：让模型“填得对”
Schema 设计的目标不是“给人看”，是“给模型填”。

最佳实践：
- 能 `enum` 就别自由文本  
- 能分类型就别混 `string`  
- `additionalProperties: false`，减少模型乱塞字段  
- 必填字段尽量少，但一旦必填就别给模糊空间  
- 字段描述里写清**格式/单位/例子**

自测：
> 把 schema 的字段描述删掉，只留下类型。  
> 如果工具立刻变难用，说明你的描述本来就不够结构化。

---

## 3.3 错误语义：让模型“错了能自救”
工具错误不是“报错就完事”，而是模型下一次能不能改对的教材。

建议所有工具错误返回都包含：
- `error_code`（稳定枚举）  
- `message`（简短说明）  
- `field`（哪个字段错）  
- `expected`（期望类型/范围/格式）  
- `example`（一个正确样例）  
- `retryable`（可重试与否）

---

## 3.4 MCP servers 优秀案例拆解（5 类样板间）
这五类足够做你们内部工具库的样板间：

1) **Filesystem**：副作用注解与安全边界（读/写/删除区分）  
2) **Fetch**：把 SSRF/内网风险写清楚，并提供分页式读取参数  
3) **Git**：字段格式示例丰富（时间范围、上下文行数默认值）  
4) **Memory**：先定义概念模型（实体/关系/观察），再定义 CRUD 工具  
5) **Everything**：协议能力展示厅，适合培训与对齐

共同点：
> 好工具不是“能调”，而是“能被模型稳定地选中并正确调用”。

---

# 4. 质量保障：测试、指标与迭代

## 4.1 触发指标 × 交付指标：双轨评测
只做“输出好不好看”的评测会翻车，因为你可能在看一组“本来就容易触发”的样本。  
建议把评测拆成两条轨：

### A. 触发指标（Routing）
- **Precision**：不该用时别用  
- **Recall**：该用时能用上  
- **Borderline stability**：边界请求时是否一致

### B. 交付指标（Delivery）
- **Output contract compliance**：结构/必备字段/格式是否合规  
- **Tool-call efficiency**：是否无意义多次调用  
- **Error & recovery**：失败后是否能自救、是否需要人工介入  
- **Safety & no-surprise**：是否发生未承诺副作用

---

## 4.2 路由漏斗与回归测试策略
把系统按漏斗拆开测试：

1) **描述匹配（metadata routing）**：只看 description 能否稳定进场  
2) **正文执行（workflow）**：进场后能否稳定产出结构化交付  
3) **工具调用（tools）**：schema 是否减少失败率，错误是否可自救  
4) **质检收口（QC）**：是否能发现关键缺失并补齐

回归测试建议每次改动都跑三类样本：
- 正例  
- 反例  
- 灰例（需要澄清）

---

## 4.3 Checklist（评审清单）
为避免正文过长，本白皮书把完整 checklist 抽离到附录模板文件。  
- 完整 Skill checklist：见 `appendices/templates.md`  
- 完整 MCP tool checklist：见 `appendices/templates.md`

你可以把它们直接贴进 PR 模板或 CI gate。

---

## 4.4 迭代方法论：从 under-trigger 到 over-trigger 的平衡
你会遇到两个经典病：

- **Under-trigger（该用不用）**：description 太含蓄、关键词覆盖不足、Use when 写成内部术语  
- **Over-trigger（不该用乱用）**：description 太泛化、Not ideal for 太少、边界不清

迭代策略：
1) 先补齐反例（Not ideal for + 反例测试）  
2) 再补关键词与用户表达（Use when 用用户话术）  
3) 最后再调 workflow 与输出契约（别急着堆步骤）

---

# 5. 实战模板与图表资源（已抽离至附录）

## 5.1 模板与 Checklist（复制即用）
- **Skill：Frontmatter + SKILL.md 正文骨架 + Description 小抄 + 测试用例模板 + PR checklist**  
- **MCP：Tool JSON 模板 + 错误返回模板 + PR checklist**  

➡️ 全部集中在：`appendices/templates.md`

---

## 5.2 图表（Figure 1/2/3）
下面是图表占位符。**图注与“图中关键文字”已准备好**，烁烁可直接复制进图里。  
完整“图表说明书 + 修订提示词 + AI 生成提示词”在：`appendices/figures.md`

---

## Figure 占位符（带图注与关键文字）

### Figure 1: 分层架构图（MCP / Skills / Agent 三层）
**文件：**`figures/fig1-layered-architecture.svg`  

**图注：**  
三层架构：Agent 负责路由与编排，Skills 提供专业 workflow 与交付标准，MCP 提供可发现、可描述、可安全接入的能力（tools/resources/prompts）。路由阶段常驻可见的是 Skill 的 `name + description`；正文（SKILL.md）仅在技能被选中后加载。

**图中关键文字（摘要版）：**
- `Router reads skill catalog: name + description`
- `Select skill → Load SKILL.md body → Execute workflow`
- `SKILL.md: workflow / output contract / QC / no-surprises`
- `MCP: Tools / Resources / Prompts`

（完整可复制文字见 `appendices/figures.md`。）

---

### Figure 2: 路由漏斗（description → 加载 → 执行）
**文件：**`figures/fig2-routing-funnel.svg`

**图注：**  
模型先基于 Skill 的 name+description 做语义匹配，仅当技能被选中时才加载 SKILL.md 正文并执行 workflow；若未选中则走兜底策略。QC 失败应回流到执行步骤进行修复，形成闭环。

**图中关键文字（摘要版）：**
- `Skill Catalog Metadata (only name + description)`
- `No selection = No body loaded`
- `Load Selected SKILL.md (workflow + output contract + QC)`
- `QC fails → Fix!`

（完整可复制文字见 `appendices/figures.md`。）

---

### Figure 3: 评测矩阵（触发质量 × 交付质量）
**文件：**`figures/fig3-eval-matrix.svg`

**图注：**  
以“触发质量（Routing）”与“交付质量（Delivery）”为两轴，区分 Under-trigger、Over-trigger、Needs Redesign 与 Ready to Ship 四类状态，并给出对应的优化方向。

**图中关键文字（摘要版）：**
- X 轴：`Routing (Precision / Recall / Borderline stability)`
- Y 轴：`Delivery (Output contract / Tool efficiency / Recovery / No-surprise)`
- 四象限：`Under-trigger / Over-trigger / Needs Redesign / Ready to Ship`

（完整可复制文字见 `appendices/figures.md`。）

---

# 附录文件清单（本仓库内）
- `appendices/templates.md`：所有模板与 checklist（复制即用）  
- `appendices/figures.md`：三张图的图注、图中文字、修订提示词、AI 生成提示词  
- `figures/`：实际图文件（烁烁输出）

---

# 参考资料（链接集中放在这里，便于替换与版本管理）
```text
[AGENTSKILLS-SPEC] https://agentskills.io/specification/
[ANTHROPIC-SKILLS-REPO] https://github.com/anthropics/skills
[ANTHROPIC-FINANCIAL-PLUGINS] https://github.com/anthropics/financial-services-plugins
[ANTHROPIC-KNOWLEDGE-WORK-PLUGINS] https://github.com/anthropics/knowledge-work-plugins
[CLAUDE-AGENT-SKILLS-OVERVIEW] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
[CLAUDE-AGENT-SKILLS-BEST-PRACTICES] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
[ANTHROPIC-SKILL-GUIDE-PDF] https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
[MCP-SPEC] https://modelcontextprotocol.io/specification/2025-11-25
[MCP-SERVERS-REPO] https://github.com/modelcontextprotocol/servers
[OPENAI-FUNCTION-CALLING] https://developers.openai.com/api/docs/guides/function-calling/
[OPENAI-ACTIONS-PRODUCTION] https://developers.openai.com/api/docs/actions/production/
```
