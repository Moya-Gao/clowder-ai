---
feature_ids: []
debt_ids: []
topics: [knowledge-engineering, skills, mcp]
doc_kind: research
created: 2026-02-27
---

# 《知识工程实践指南：如何写好 Skills & MCP》🐾

（砚砚交稿版 | 面向架构师与开发者 | 截止到 2026-02-28 的资料口径）

宪宪国王👑，Landy 铲屎官，砚砚来把这套“跨猫协作共识”钉成一份可落地的指南：**Skills 不是原子操作清单，MCP 也不是 HTTP 套皮**。真正的分水岭在“知识工程”：你写下的描述，会变成模型的路标，决定它会不会走对路、会不会拿对工具、会不会交付对的成品。

下面按你给的 5 大交付结构来。

---

## 1) 总览篇：什么是知识工程

### 1.1 为什么 AI Agent 的准确率取决于“描述写得好不好”

因为在大多数 Agent 体系里，**“触发/路由”读到的信息非常少**，往往只包含：

* Skills：`name + description` 这类元信息会被“常驻加载”，其余正文只有在技能被激活后才会载入（分层加载 / progressive disclosure）。([代理技能][1])
* MCP Tools：模型会先看到工具的 `name/description/inputSchema`，再决定是否 `tools/call`。规范里明确工具是 “model-controlled”，即模型自行发现和调用。([Model Context Protocol][2])
* OpenAI Function Calling：模型会根据你给的工具定义（JSON schema + 描述）决定是否需要工具数据或能力。([OpenAI Developer Center][3])

所以**描述不是文案，是路由规则**：
写得含糊，就像咖啡馆门口挂了个牌子“本店提供服务”，猫看了也不知道进去点啥 ☕🐱。

---

### 1.2 Skills vs Tools vs MCP：本质区别（人话版）

把它们想成一家“猫咖的后厨系统”：

* **Tool（工具/函数）**：一只会干具体动作的猫爪子

  * 例如：读文件、拉网页、查 Git 状态、写入数据库
  * 重点：**输入输出清晰、可执行、可失败、可重试**

* **MCP（协议/能力层）**：猫咖后厨的“统一插座标准”

  * MCP 定义了资源（Resources）、提示模板（Prompts）、工具（Tools）等能力，以及能力协商、错误、日志等机制。([Model Context Protocol][4])
  * 重点：**让工具“可发现、可描述、可安全接入”**，不是简单 HTTP wrapper。

* **Skill（经验/工作流层）**：猫王的“菜谱 + 出餐标准 + 质检流程”

  * Anthropic 的插件仓库直接把 Skills 定义为“编码领域经验、最佳实践、分步工作流，让 Claude 自动产出专业级成果”。([GitHub][5])
  * 重点：**教模型怎么把多个工具串成一套交付物**（报告、模型、合同红线、KB 文档、QC 图等）。

一句话落地：

> **MCP 给你“能做什么”，Skill 给你“怎么做得专业”。**([GitHub][5])

---

### 1.3 常见误区（带“官方反例/坏例子”）

下面这些，是你说的“大厂访客”最容易踩的坑，我直接用官方资料里的坏例子来当“反面教材标本”。

#### 误区 A：把 Skills 写成原子操作手册

结果：技能正文一堆“先点这里再点那里”，但**没有产物定义、没有边界、没有触发语义**，模型无法稳定选择。

对照：Agent Skills 规范强调 `description` 必须包含“做什么 + 什么时候用”，并给了**差的描述**：

* Poor example: `description: Helps with PDFs.`([代理技能][1])
  这就是典型“原子化废话”，触发能力极差。

#### 误区 B：把 MCP 当 HTTP wrapper

结果：只把 API 端点塞进工具列表，没有把**输入 schema、输出结构、错误语义、安全边界**讲清楚。
而 MCP 规范明确：工具要有 `inputSchema`（必须是有效 JSON Schema），并且有工具能力协商、错误处理、注解等协议层设计。([Model Context Protocol][2])

#### 误区 C：说 “MCP 过时了”

MCP 规范页面标注了 **2025-11-25 (latest)**，而且“Tools/Resources/Prompts/安全原则”都在持续更新。([Model Context Protocol][2])

#### 误区 D：在 Skills 外面再套编排引擎

很多时候是“把不确定性转移给框架”，但模型本身就会做路由与工具选择：

* MCP：工具是模型可发现、可调用的。([Model Context Protocol][2])
* OpenAI：模型生成响应时可能决定需要工具数据/能力。([OpenAI Developer Center][3])
* Anthropic 插件：技能会在相关时自动触发，命令才是显式调用。([GitHub][5])

编排不是不能做，而是要先问一句：
**“我是在补产品工程缺口，还是在替描述失败买单？”**

---

## 2) Skills 写作篇

### 2.1 SKILL.md 的结构剖析（按规范口径）

Agent Skills 规范要求：**一个 Skill 至少是一个目录 + `SKILL.md`**，且 `SKILL.md` 必须是 **YAML frontmatter + Markdown body**。([代理技能][1])

#### Frontmatter（必填 + 可选）

必填：

* `name`：1–64，小写字母/数字/连字符，且应与目录名匹配。([代理技能][1])
* `description`：1–1024，必须同时描述“做什么 + 何时用”，建议包含关键词帮助触发。([代理技能][1])

可选：

* `license`、`compatibility`、`metadata`、`allowed-tools`（实验性）。([代理技能][1])

> 注：Anthropic skills repo 的 README 也强调“创建基础 Skill 只需要 name + description”，但生态上允许你用可选字段表达环境与依赖。([GitHub][6])

#### Body（正文）

规范不强制格式，但建议包含：步骤、输入输出例子、边界与 edge cases。([代理技能][1])

---

### 2.2 Description 写作模板（可复制）

把 description 当“技能路牌”，写成 **一句话能力 + 使用场景列表 + 排除场景 + 关键产物**。

> ✅ 推荐模板（适合 Claude Skills / Agent Skills 触发模型）

```yaml
---
name: <kebab-case-skill-name>
description: >
  <一句话：产出/目标 + 对象 + 交付形态>.
  Use when: <3-8 条典型用户表述/上下文关键词>.
  Not ideal for: <2-5 条明确不该触发的情况>.
  Output: <文件类型/结构/长度/格式约束（如果关键）>.
compatibility: <仅当确有环境限制时填写，比如需要某 app/需要联网/需要特定工具>
metadata:
  owner: <team-or-org>
  version: "1.0"
---
```

写作要点来自 Anthropic 的 skill-creator：

* **description 是主要触发机制**
* “什么时候用”的信息应放在 description，而不是正文
* 为了对抗模型“undertrigger”，描述可以稍微“更主动一些”（但别欺骗）。([GitHub][7])

同时注意：**别把 description 写成无限泛化的“万能技能”**。这会造成错误路由，后期很难修。

---

### 2.3 触发条件设计方法（把它当分类器来做）

我给一套工程化做法：**触发语义 = 词面信号 + 任务语义 + 输入形态 + 产物约束**。

1. **词面信号（Lexical cues）**

* 用户会怎么说？有哪些同义表达？（例如“earnings update / quarterly update / Q1 results”）
* 直接写进 description（不是正文），因为元信息常驻。([代理技能][1])

2. **任务语义（Intent cues）**

* “要交付物”还是“要解释”？
* “专业报告/模板化输出”通常更适合 Skill。

3. **输入形态（Input modality）**

* 文件类型、数据源、系统环境
* 如果环境不满足，用 `compatibility` 或在正文开头明确“无法执行则停止并说明”。（见优秀案例：cowork-plugin-customizer）([GitHub][8])

4. **产物约束（Output contract）**

* 文件名、页数、结构、必须包含的表格/图
* 产物越明确，触发越稳定，回归测试越容易。

---

### 2.4 正例/反例的重要性

在 Skill 正文里，**“Do / Don’t” 的反例**能显著减少跑偏：

* earnings-analysis 明确写了 “Do NOT use if initiation report / flash note”等边界。([GitHub][9])
* contract-review 用 GREEN/YELLOW/RED 分级与红线格式，把输出“钉死”为可执行的审阅建议。([GitHub][10])
* 3-statements 明确提示：某些分析“仅在用户要求或模板要求时才做，否则跳过”。([GitHub][11])

反例还有一个隐藏价值：**它其实是在训练“何时不要触发”。**
这是很多团队缺失的半边脑子。

---

### 2.5 Anthropic 仓库 5+ 优秀案例拆解（我给 8 个）

下面每个案例我都提炼“它为什么触发稳、交付稳”。

#### 案例 1：Comparable Company Analysis（`fsi-comps-analysis`）

亮点：

* description 里直接给 “Perfect for / Not ideal for”，边界清楚。([GitHub][12])
* 正文一上来就是 **数据源优先级**，且强调 MCP 数据源优先、避免网页检索作为主数据源。([GitHub][12])
* 给出结构化输出（表头、统计区块、公式规则、QC checklist），这就是“机构级交付”的凝固经验。([GitHub][12])

你要学它的：**先定义“正确性与可审计性”，再谈格式**。

---

#### 案例 2：Earnings Update（`earnings-analysis`）

亮点：

* description 把交付物规格写成“硬指标”：页数、字数、图表数量、适用请求语句。([GitHub][9])
* “训练数据过时”这类时间敏感风险被写进流程：要求写下今天日期、验证财报日期在 3 个月内。([GitHub][9])
* 强制引用与超链接规范（对专业场景非常关键）。([GitHub][9])

你要学它的：**把最大幻觉风险点写成“强制自检步骤”**。

---

#### 案例 3：3-Statement 模板填充（`3-statements`）

亮点：

* description 直接写 “Triggers include requests to fill/complete/populate…”，触发意图非常明确。([GitHub][11])
* 正文先教识别模板结构（tab 命名、输入 vs 公式、命名区域），属于高复用经验。([GitHub][11])
* 条件执行：非必要分析默认跳过，避免“无请求就自嗨”。([GitHub][11])

你要学它的：**用“默认不做”保护用户时间与错误率**。

---

#### 案例 4：Value Creation Plan（`value-creation-plan`）

亮点：

* description 列出触发关键词（100-day plan / EBITDA bridge 等），并明确产物：EBITDA bridge、KPI、责任矩阵。([GitHub][13])
* 工作流从基线到 100 天到 KPI dashboard，一条龙可交付。([GitHub][13])

你要学它的：**用“桥表/表格骨架”把抽象咨询工作变成可执行结构**。

---

#### 案例 5：Diligence Meeting Prep（`dd-meeting-prep`）

亮点：

* 第一步先问会议上下文（类型/参会者/关注点），这是典型“先建约束再产出”。([GitHub][14])
* 输出限制（15-20 问以内）非常重要，防止模型生成失控清单。([GitHub][14])

你要学它的：**把“长度/范围”写成硬约束**。

---

#### 案例 6：Contract Review（`contract-review`）

亮点：

* 先找“组织 playbook”，没有就提示并标注基线来源，避免装懂。([GitHub][10])
* GREEN/YELLOW/RED 分级把“升级路径”写清楚，输出可直接进入法务工作流。([GitHub][10])
* 红线输出格式钉死：Clause/Current/Proposed/Rationale/Priority/Fallback。([GitHub][10])

你要学它的：**让输出直接可落盘进协作链路**。

---

#### 案例 7：Knowledge Management（`knowledge-management`）

亮点：

* 为 KB 写作建立“可检索性”规则（标题、关键词、错误信息），这就是知识工程本体。([GitHub][15])
* 有维护节奏（monthly/quarterly），把“知识腐烂”纳入流程。([GitHub][15])

你要学它的：**知识不是写完就完了，是要养护的**。

---

#### 案例 8：Single-cell RNA QC（`single-cell-rna-qc`）

亮点：

* 有“默认路径 + 高级路径”：Approach 1 一键脚本，Approach 2 模块化函数。([GitHub][16])
* 参数、输出文件、图表都列清楚，甚至提示“复制文件不要整个目录”。([GitHub][16])

你要学它的：**把“怎么跑”写成可复制命令 + 可检查产物列表**。

---

## 3) MCP 设计篇

### 3.1 MCP Tool description 怎么写，AI 才会选对？

MCP 规范里，一个 tool 不是随便一个函数名，它至少包含：

* `name`（唯一标识）、`description`、`inputSchema`（必须是有效 JSON Schema）、可选 `outputSchema`、可选 `annotations`。([Model Context Protocol][2])

所以“选对工具”的关键不在玄学，而在三件事：

1. **description 说清楚“能力边界”**（做什么、不做什么、对谁有用）
2. **inputSchema 把“模型该填什么”讲清楚**（类型、必填、枚举、默认、禁止额外字段）
3. **错误返回能指导自修正**（模型下一次会不会改对参数，很看错误信息）([Model Context Protocol][2])

---

### 3.2 参数说明最佳实践（Schema 设计的“猫爪友好”原则）

你可以直接抄 MCP 规范对 schema 的硬要求与建议：

* `inputSchema` 默认按 JSON Schema 2020-12（无 `$schema` 时），且必须是有效对象，不能是 `null`。([Model Context Protocol][2])
* **无参数工具**推荐：`{ "type": "object", "additionalProperties": false }`，明确只接受空对象。([Model Context Protocol][2])
* 工具名字符集、长度也有建议（1–128，允许字母数字、`_`、`-`、`.`）。([Model Context Protocol][2])

工程化建议（超实用）：

* **能枚举就别自由文本**：`enum` 比 `string` 稳得多
* **把“单位/格式”写进字段描述**：例如 timestamp 接受 ISO 8601 还是自然语言
* **禁止额外字段**：`additionalProperties: false`，减少“模型乱塞字段”的幻觉面
* **字段名别同义词乱飞**：`start_index`/`offset` 二选一，别两套都支持

---

### 3.3 错误处理的描述方式（让模型会自救）

MCP 在错误处理上区分：

* Tool Execution Errors：应包含可行动反馈，便于模型调整参数重试
* Protocol Errors：请求结构问题，模型较难自修复
  并且建议客户端把工具执行错误提供给模型用于自修正。([Model Context Protocol][2])

落地写法建议：

* 错误里包含：**哪一个字段错了 + 期望类型/范围 + 给一个正确示例**
* 对“权限/安全边界”类错误：说明如何缩小范围（例如“只允许在 roots 内访问”）

---

### 3.4 MCP servers 仓库 5+ 优秀案例分析（我给 5 个）

这些是“参考实现”，特别适合当你们团队的 tool spec 模板。

#### 案例 1：Filesystem Server（文件系统工具）

它把工具的 **安全意图**讲得很清楚：

* README 里有 “Tool annotations” 映射表，区分 read / destructive 等操作类型，让宿主更容易做人类确认与风险提示。([GitHub][17])
* 这类“行为注解”在 MCP 规范中也有对应概念（annotations）。([Model Context Protocol][2])

你要学它的：**用注解表达副作用等级，但别把安全完全押在注解上**（规范也提醒注解在不可信服务器上应视为不可信）。([Model Context Protocol][2])

---

#### 案例 2：Fetch Server（网页抓取）

亮点非常“安全工程”：

* 明确写了 CAUTION：可访问本地/内网 IP，存在敏感数据暴露风险。([GitHub][18])
* 参数设计支持分段读取：`start_index` + 截断策略，让模型能“翻页式阅读网页”。([GitHub][18])

你要学它的：**把“滥用风险”写进文档和默认行为**，别只靠口头约束。

---

#### 案例 3：Git Server（仓库交互）

亮点是“参数语义讲清楚”：

* 每个工具都列了输入字段、可选字段与默认值（如 `context_lines: default 3`）。([GitHub][19])
* `git_log` 的时间过滤支持 ISO、相对时间、自然语言日期示例，减少模型乱填。([GitHub][19])

你要学它的：**字段描述里给“可接受格式的例子”= 工具选择与参数正确率双提升**。

---

#### 案例 4：Memory Server（知识图谱记忆）

亮点是“先定义概念，再定义 API”：

* 把 Entities/Relations/Observations 解释清楚，甚至规定关系用 active voice。([GitHub][20])
* 工具设计覆盖 CRUD，并写清 “不存在时静默跳过 / 不存在时报错” 等行为差异。([GitHub][20])

你要学它的：**模型不是你团队新人，它更像外包，必须先给词典**。

---

#### 案例 5：Everything Server（演示型全集）

它是“协议能力展示厅”，特别适合你们做内部培训：

* `features.md` 把大量 tools/prompts/resources 一次列清，还展示 structured content、进度通知、tasks、elicitation 等高级能力。([GitHub][21])
* “Conditional tool registration” 讲了为何要在能力协商后再注册某些工具。([GitHub][22])

你要学它的：**把协议能力当产品能力来设计，而不是只把函数端点搬进来**。

---

### 3.5 顺手对照：OpenAI Actions / Function Calling 的“描述禁忌”

这里有个很关键的跨生态差异点，建议你在文档里写成“对照表”，避免团队混用写法：

* OpenAI GPT Actions 的 production notes 明确说：

  1. 描述不应鼓励 GPT 在用户没请求该类服务时就调用 action
  2. 描述不应规定特定触发话术，系统会自动判断何时使用
  3. API response 应尽量返回原始数据而不是自然语言（让模型自己组织话术）([OpenAI Developer Center][23])

* 但 Claude Skills 生态里，**description 本身就是触发路由的核心信号**，skill-creator 甚至建议为了对抗 undertrigger 可以稍微主动一些。([GitHub][7])

怎么统一团队标准？

> **Skill description：允许写触发线索（关键词/场景/不适用）。**
> **Tool description（尤其 Actions）：少写“触发口号”，多写“能力边界 + 数据契约”。**([OpenAI Developer Center][23])

---

## 4) 质量保障篇

### 4.1 如何测试 Skill/MCP 的“被调用准确率”

把它当一个可测系统，而不是“提示词艺术”。

#### A. Skills：用“触发评测 + 交付评测”双轨

Anthropic 的 skill-creator 给了一套非常工程化的闭环：

* 写草稿
* 准备 2–3 条真实测试 prompt
* 同时跑“有 skill”与“无 skill”的对照
* 生成 review、做定量指标、迭代
  并建议把测试写入 `evals/evals.json`。([GitHub][7])

你可以把指标拆成两类：

1. **触发指标（Routing）**

* Precision：不该触发时有没有触发（误触发）
* Recall：该触发时有没有触发（漏触发）
* Borderline：灰区样本的稳定性（最重要）

2. **交付指标（Delivery）**

* 结构是否符合 output contract
* 必备字段/章节是否齐全
* 是否遵守“默认不做”的分支逻辑
* 错误是否可解释、可恢复

#### B. MCP Tools：用“选对工具 + 填对参数 + 失败可自救”

* 选对工具：同一 intent 下是否总选同一个 tool
* 填对参数：schema 校验通过率、required 字段缺失率
* 失败自救：错误信息是否能引导模型下一次改对（MCP 规范鼓励可行动错误）。([Model Context Protocol][2])

---

### 4.2 Checklist（评审清单）

给你一份可以直接塞进 PR 模板的。

**Skill 评审清单**

* [ ] frontmatter 合规：name/description 满足规范约束（长度、字符、description 含“做什么+何时用”）([代理技能][1])
* [ ] description 有“Not ideal for / Do not use when”，能抑制误触发
* [ ] 正文前 30 行内有：产物定义、流程总览、关键约束（数据源优先级/合规声明/默认跳过规则）
* [ ] 有至少 2 条正向测试样本 + 2 条负向测试样本（边界样本）([GitHub][7])
* [ ] 文件引用清晰、不过度深链；主 SKILL.md 不膨胀（建议 < 500 行）([代理技能][1])
* [ ] “不惊吓原则”：不做超出描述范围的事，不夹带风险内容([GitHub][7])

**MCP Tool 评审清单**

* [ ] `inputSchema` 完整且严格（required、类型、enum、additionalProperties）([Model Context Protocol][2])
* [ ] description 清楚写明：做什么/不做什么/副作用/权限边界
* [ ] 有错误返回约定：字段错误怎么报、权限错误怎么报、可重试与否([Model Context Protocol][2])
* [ ] 对高风险操作有注解或宿主侧确认策略（Filesystem 的注解思路可参考）([GitHub][17])
* [ ] 文档里有最小示例（good path + failure path）

---

## 5) 实战模板（可直接复制）

### 5.1 SKILL.md 模板（推荐工程版）

```markdown
---
name: <skill-name>
description: >
  <一句话定义：交付物 + 场景>.
  Use when: <关键词/用户话术/文件类型/上下文，3-8条>.
  Not ideal for: <明确不适用，2-5条>.
  Output: <文件类型/结构/长度/命名规则>.
license: <可选>
compatibility: <可选：需要联网/需要某桌面环境/依赖工具等>
metadata:
  owner: <team>
  version: "1.0"
---

# <Skill Display Name>

## 目标与非目标
- **目标**：……
- **非目标**：……（写清楚能显著降低误触发后的灾难半径）

## 工作流
### Step 0: 约束与输入检查
- 需要哪些信息？缺什么就问什么（最多 1-2 个关键问题）
- 有哪些前置条件？不满足就停止并说明

### Step 1: 执行步骤（可复用的“菜谱”）
1. …
2. …
3. …

### Step 2: 质量检查（QC）
- [ ] …
- [ ] …

## 输出规范（强约束）
- 文件名：…
- 结构模板：…
- 必须包含：…
- 禁止包含：…

## 示例
**Example 1（正向触发）**
- Input: …
- Output: …

**Example 2（反向样本：不应触发/应转其他技能）**
- Input: …
- Expected: …

## 参考资料（按需加载）
- See `references/...`
- Run `scripts/...`
```

---

### 5.2 MCP tool description 模板（MCP JSON 结构思路）

> 你可以把它映射到 MCP 的 `tools/list` 返回结构。

```json
{
  "name": "tool_name",
  "title": "Human readable title",
  "description": "What it does. When to use it (in terms of task intent, not trigger slogans). Side effects. Permissions/boundaries. What it will NOT do.",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "param1": {
        "type": "string",
        "description": "Format/units/examples. Constraints."
      }
    },
    "required": ["param1"]
  },
  "outputSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "result": { "type": "string" }
    },
    "required": ["result"]
  },
  "annotations": {
    "category": "read_only | destructive | network | ... (hint only)"
  }
}
```

对照 MCP 规范：tool 至少包含 name/description/inputSchema，outputSchema/annotations 可选。([Model Context Protocol][2])

---

### 5.3 测试用例模板

**Skills（参考 Anthropic skill-creator 的 evals/evals.json 结构）**([GitHub][7])

```json
{
  "skill_name": "<skill-name>",
  "evals": [
    {
      "id": 1,
      "prompt": "用户原话（真实口吻）",
      "expected_output": "期望产物与关键约束（结构/文件/必须项）",
      "files": []
    },
    {
      "id": 2,
      "prompt": "反向样本：看似相关但不该触发",
      "expected_output": "应不触发/应引导到其它技能或直接回答",
      "files": []
    }
  ]
}
```

**MCP Tools（建议你们内部加一层）**

* intent: “用户想要什么”
* expected_tool: “应该选哪个 tool”
* expected_args: “关键字段应如何填”
* expected_failure: “缺字段时工具错误应如何引导补参”

---

### 5.4 评审 checklist（交付版）

你可以直接贴到团队 Confluence/Notion：

* Skill 是否把“做什么+何时用”写进 description（而不是只在正文写）([代理技能][1])
* 是否有明确不适用场景（减少误触发）
* 是否定义了产物结构与 QC（减少交付漂移）
* 是否考虑时间敏感与数据可信度（例如 earnings-analysis 的日期校验）([GitHub][9])
* MCP tool 是否 schema 严格、错误可自救、安全边界明确([Model Context Protocol][2])
* 对高风险动作是否有“可见的用户确认策略”（OpenAI Actions 的 consequential 字段、或 MCP 注解 + 宿主确认）([OpenAI Developer Center][23])

---

## 结尾：给宪宪的“猫王一句话结案”

* **Skills 是凝固的经验与交付标准**，写得好，模型自己就能当编排者。([GitHub][5])
* **MCP 是能力与安全的协议层**，不是 HTTP 套皮。([Model Context Protocol][4])
* 真正的“知识工程”，就是把路由（description）、契约（schema）、交付（workflow+QC）三件事写到模型读得懂、测得出的程度。

如果你想让我把这份指南再加工成“对外可发布的白皮书风格”（加图：分层架构图、路由漏斗、评测矩阵），我也可以继续当你的共犯猫 🐾📎

[1]: https://agentskills.io/specification/ "https://agentskills.io/specification/"
[2]: https://modelcontextprotocol.io/specification/2025-11-25/server/tools "https://modelcontextprotocol.io/specification/2025-11-25/server/tools"
[3]: https://developers.openai.com/api/docs/guides/function-calling/ "https://developers.openai.com/api/docs/guides/function-calling/"
[4]: https://modelcontextprotocol.io/specification/2025-11-25 "https://modelcontextprotocol.io/specification/2025-11-25"
[5]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/README.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/README.md"
[6]: https://raw.githubusercontent.com/anthropics/skills/main/README.md "https://raw.githubusercontent.com/anthropics/skills/main/README.md"
[7]: https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md "https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md"
[8]: https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/cowork-plugin-management/skills/cowork-plugin-customizer/SKILL.md "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/cowork-plugin-management/skills/cowork-plugin-customizer/SKILL.md"
[9]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/equity-research/skills/earnings-analysis/SKILL.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/equity-research/skills/earnings-analysis/SKILL.md"
[10]: https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/legal/skills/contract-review/SKILL.md "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/legal/skills/contract-review/SKILL.md"
[11]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/financial-analysis/skills/3-statements/SKILL.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/financial-analysis/skills/3-statements/SKILL.md"
[12]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/financial-analysis/skills/comps-analysis/SKILL.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/financial-analysis/skills/comps-analysis/SKILL.md"
[13]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/private-equity/skills/value-creation-plan/SKILL.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/private-equity/skills/value-creation-plan/SKILL.md"
[14]: https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/private-equity/skills/dd-meeting-prep/SKILL.md "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/private-equity/skills/dd-meeting-prep/SKILL.md"
[15]: https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/customer-support/skills/knowledge-management/SKILL.md "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/customer-support/skills/knowledge-management/SKILL.md"
[16]: https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/bio-research/skills/single-cell-rna-qc/SKILL.md "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/bio-research/skills/single-cell-rna-qc/SKILL.md"
[17]: https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md "https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md"
[18]: https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/fetch/README.md "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/fetch/README.md"
[19]: https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/git/README.md "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/git/README.md"
[20]: https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/memory/README.md "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/memory/README.md"
[21]: https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/everything/docs/features.md "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/everything/docs/features.md"
[22]: https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/everything/docs/how-it-works.md "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/everything/docs/how-it-works.md"
[23]: https://developers.openai.com/api/docs/actions/production/ "https://developers.openai.com/api/docs/actions/production/"
