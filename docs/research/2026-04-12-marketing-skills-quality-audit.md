# AI 营销 Skills 仓库质量深度审计

> 委托人：宪宪（布偶猫/Opus）  日期：2026-04-12
> 触发：铲屎官在头脑风暴中提出引入营销 skills，但担心质量

## Part 1: 发给云端模型的提示词

> 直接复制发送给 ChatGPT Deep Research / Claude.ai Deep Research / Gemini Deep Research

---

我们是 Cat Café，一个多 AI Agent 协作的开源项目（TypeScript/Node.js 栈）。我们有自己的 skills 体系（每个 skill 是一个 SKILL.md + 可选的辅助代码），格式类似 Claude Code 的 Agent Skills 规范。

我们在考虑引入外部的 AI 营销 skills 来扩展猫猫团队的能力边界（从 coding 扩展到营销），但**非常担心质量**——怕"看起来数量多但实际是垃圾 prompt"。

### 请深度审计以下 4 个 GitHub 仓库

**重点仓库（横评排名第一，20.5k stars）：**
1. **https://github.com/coreyhaines31/marketingskills** — 33 skills, 7 categories, by Corey Haines

**次重点仓库：**
2. **https://github.com/ericosiu/ai-marketing-skills** — ~30 skills, by Eric Siu (Single Grain CEO), 98% Python
3. **https://github.com/zubair-trabzada/ai-marketing-claude** — 15 skills, Claude Code 专用, 1.2k stars (但有 star 异常增长嫌疑)
4. **https://github.com/superamped/ai-marketing-skills** — 信息有限

### 审计维度（请逐仓库评估）

#### A. Prompt 工程质量（最重要！）
- **请实际打开 3-5 个具体 skill 文件（SKILL.md 或类似文件）**，逐个评估：
  - Prompt 是否有结构化的思维链（chain of thought）？
  - 是否有具体的评估框架/评分标准（rubric），还是只有空泛的"请分析XXX"？
  - 是否有输入/输出示例？
  - 是否处理了 edge cases（比如"没有竞品数据怎么办"）？
  - 对比行业最佳实践，prompt 工程水平是 junior/mid/senior 级？
- **请贴出你认为质量最好和最差的各 1 个 skill 的关键片段**，作为证据

#### B. 实际可用性
- 这些 skill 是"看起来很多但实际只能生成一堆废话"，还是能产出可行动的结果？
- 有没有真实用户的使用反馈/case study（GitHub issues、Twitter、blog posts）？
- 生成的结果是否需要大量人工修改才能用？

#### C. 安全与隐私风险
- 安装脚本（install.sh）是否安全？有没有可疑的网络请求？
- 是否有遥测/数据收集？
- 是否要求不必要的权限？

#### D. 生态成熟度
- 贡献者数量和多样性（1 人 vs 社区）
- Issue 处理质量（是否回复、是否有实质讨论）
- 更新频率和质量（是真实改进还是刷 commit）
- Star/Fork 比例是否正常（zubair-trabzada 的 1.2k stars + 440 forks + 1 contributor 看起来异常）

#### E. 与我们的兼容性
- Skill 格式是否与 Claude Code SKILL.md 规范兼容？
- 是否依赖特定的外部服务（API key、SaaS 订阅）？
- 能否在不修改的情况下直接使用，还是需要大量适配？

### 输出要求

1. **逐仓库出评级**：A（推荐引入）/ B（值得参考）/ C（不推荐）/ D（垃圾/风险）
2. **每个评级必须附证据**（具体 skill 文件的引用、代码片段、截图）
3. **区分"已确认"和"推测"**
4. **如果你认为全部都不值得引入，直接说**——我们不需要"政治正确"的评价
5. **给出最终建议**：引入/不引入/部分引入（哪些 skill）/自己写更好

### 我们已知的信息

- GrowthHackers 2026年3月横评把 coreyhaines31 排第一（12个仓库中）
- zubair-trabzada 在横评中排第七，且 star 从 264→1.2k 一个月内增长 5 倍（可疑）
- ericosiu 的仓库有真实 Python 代码（统计算法、安全 hooks），但只有 16 commits
- 我们的技术栈是 TypeScript/Node.js，Python 仓库需要额外适配成本

---

## Part 2: 云端模型回答（待回填）

### gpt pro

我先给结论，不兜圈子。

**最终评级**

1. **coreyhaines31/marketingskills：A，推荐引入**
2. **ericosiu/ai-marketing-skills：B，值得参考，但不建议整包直接引入**
3. **superamped/ai-marketing-skills：B，值得参考，适合少量抽取**
4. **zubair-trabzada/ai-marketing-claude：C，不推荐引入**。([GitHub][1])

更直白一点说，**只有 Corey 那个库像“可以直接进你们 skills 体系试运行”的东西**。Eric 的库更像一套带 Python 工作流的营销操作系统，思路强，但移植成本高。Superamped 质量比热度看起来更好，但生态太轻，且依赖 MCP。Zubair 那个库表面很热闹，实际成熟度和 prompt 密度都不够稳，容易产出“看着像报告，里面是气球”的东西。([GitHub][2])

---

## 我实际抽检了哪些文件

我不是只看 README。我实际打开并审了这些 skill 文件和关键配套文件：

* **Corey**：`page-cro`、`copywriting`、`seo-audit`、`pricing-strategy`、`customer-research`，以及 `AGENTS.md`。([GitHub][3])
* **Eric Siu**：`content-ops`、`growth-engine`、`sales-pipeline`、`outbound-engine`、`conversion-ops`，以及 telemetry/security 相关文档。([GitHub][4])
* **Zubair**：`market-audit`、`market-copy`、`market-emails`、`market-social`、`market-ads`、`market-brand`，以及 `install.sh`。([GitHub][5])
* **Superamped**：`search-page-audit`、`conversion-audit`、`keyword-research`、`competitor-discovery`、`social-post-writer`、`ad-creative`，以及 `AGENTS.md`、`.mcp.json`。([GitHub][6])

---

# 1) coreyhaines31/marketingskills

## 评级：A

### A. Prompt 工程质量

这是四个仓库里**最像“成熟 skill 资产库”**的一个。它不是单纯堆一堆“请分析一下 XXX”，而是有统一的 Agent Skills 结构、共享上下文文件、skill 组合依赖、工具调用约定，以及明确的目录规范。`AGENTS.md` 还明确写了它遵循 Agent Skills 规范，可放在 `.agents/skills/` 里运行，这对你们 Cat Café 的兼容性非常关键。([GitHub][2])

我抽的 5 个 skill 里，质量最高的是 **`customer-research`** 和 **`seo-audit`**。
`customer-research` 不只是让模型“总结用户画像”，它要求**给每条洞察标置信度**、按数据新鲜度加权、检查样本偏差、并且明确说在每个分群少于 5 个独立数据点时**不要硬造 persona**。这已经不是 junior prompt 了，这是很成熟的“反胡说八道”设计。`seo-audit` 则明确指出仅靠 `curl` / `web_fetch` 可能误判 schema，要求必要时改用浏览器工具、Rich Results Test 或 Screaming Frog 验证，这种“知道自己的工具会失明”很加分。`page-cro`、`copywriting`、`pricing-strategy` 也都有分阶段分析、优先级输出和可执行模板。整体我会给它 **mid-to-senior，接近 senior**。([GitHub][7])

不足也有。它的很多 skill **模板和输出框架很强，但完整的输入/输出示例不算多**。也就是说，它更像高质量操作手册，而不是带大量 exemplar 的 few-shot prompt 包。这个缺点不致命，但如果你们要给多 Agent 协作做稳定基准，后续最好自己补一层 eval case。([GitHub][3])

### B. 实际可用性

这仓库不是“会生成一堆废话”的类型。原因很简单，它的 skill 普遍有**边界条件、输出结构、优先级框架和决策顺序**，所以产物通常会落到“建议清单、测试优先级、研究结论、复制文案候选”这种能拿去开会或进入下一步执行的格式，而不是泛泛而谈。尤其 `page-cro` 和 `seo-audit`，已经接近可直接进入 backlog 的颗粒度。([GitHub][3])

### C. 安全与隐私

我在公开结构里**没有看到一个需要警惕的 install.sh**。它主要是 skill 文件、AGENTS 规范和 marketplace/plugin 元数据，另外有少量 Node 工具和集成说明。当前可见材料里也**没有明确遥测采集声明**。这意味着它在安全面上比 Eric 和带 `curl | bash` 的 Zubair 都干净。([GitHub][2])

### D. 生态成熟度

已确认的是：这个仓库现在星标很高，README 写 33 个 skills，GitHub 页面显示约 20.5k stars / 3.2k forks；Trendshift 报告 9 位贡献者、最近几天仍有提交，release 页面还能看到社区贡献的新 skill。**这说明它至少不是单人一次性投喂完就扔掉的仓库**。但我没有在这次审计里完整爬每个 issue thread，所以“issue 讨论质量高不高”这点我只能保留。([GitHub][1])

### E. 与你们的兼容性

这是它最大的优势。它已经是 Agent Skills 风格，`AGENTS.md` 明写 `.agents/skills/` 目录规范，且仓库里有 plugin metadata。对于你们的 TypeScript/Node.js 栈，它比 Eric 的 Python 体系友好太多。**结论：这是唯一一个我会建议你们“直接挑 5 到 10 个 skill 进内测”的仓库。** ([GitHub][2])

**已确认**：结构规范、样本 skill 质量高、兼容性强、生态真实活跃。
**推测**：整库并非每个 skill 都一样强，但抽检样本已经足够说明它不是 prompt 垃圾场。([GitHub][2])

---

# 2) ericosiu/ai-marketing-skills

## 评级：B

### A. Prompt 工程质量

这个仓库很特别。**它最强的部分不完全在 prompt，而在“prompt + Python workflow + rubric + security layer”这个整体系统**。README 明写它是 category 级 `SKILL.md`、带 Python 脚本、rubrics、experts、security、telemetry 的结构，语言占比约 **98.1% Python**。所以它不是你们能直接塞进 `.agents/skills` 就收工的那种。([GitHub][8])

我抽的几个 skill 中，最强的是 **`content-ops`**。它会自动组一个 7 到 10 人的“专家评审团”，强制包含 AI Writing Detector 和 Brand Voice Match，按 rubrics 打分，目标是 **90/100**，最多递归优化 3 轮，不达标就老实交代当前分数，并把问题回写成“Source Improvement Brief”。这已经不是一般 prompt 了，这是个带闭环的质量系统。按“营销内容生成”这一项看，它是四库里最强之一。`growth-engine` 也不错，它写了统计阈值、提升门槛和实验判断逻辑。([GitHub][4])

但问题在于，像 `sales-pipeline`、`conversion-ops`、`outbound-engine` 这类 category skill，很多内容其实更像**脚本入口文档**，靠 Python 工具、外部 API 和环境变量来完成活。它们作为“纯 SKILL.md prompt”并不算惊艳，精彩之处更多在脚本层。所以如果你问“prompt 工程 senior 吗”，答案要分开说：
**系统设计是 senior，单看可移植 prompt 不一定。** ([GitHub][9])

### B. 实际可用性

如果你愿意接它的 Python 体系、API key、工具链，这个仓库的实际产出潜力是很高的。它比普通 prompt 仓库更像一台半自动营销工厂。可一旦你们的目标是“低成本接入现有 TypeScript/Node skill 体系”，它马上就变成一头需要牵线接电的机械章鱼。对你们来说，它**更适合拆思想，不适合整包吃下去**。([GitHub][8])

关于真实反馈，我找到的更多是**作者侧的推广和案例叙述**，比如用类似工作流拿到高价值会面的故事；但我没有找到特别扎实的独立第三方案例库或大量用户 issue 复盘。所以“有人在用”我信，“外部验证充分”我不信到那个程度。([LinkedIn][10])

### C. 安全与隐私

这里要认真看。README 明写了**本地日志始终开启**，远程 telemetry 需要 opt-in；同时 skill 启动前会跑 `telemetry_init.py` 和 `version_check.py`。它也有比较像样的 PII sanitizer，声称可检测邮箱、电话、SSN、API keys、URL 凭据等。也就是说，**它不是偷偷摸摸，而是明确告诉你“我有观测和清洗层”**。这在工程上是成熟的，但对隐私敏感团队来说，也意味着默认就多了一层需要审计的行为。([GitHub][8])

另一个让我皱眉的点是 repo 里的 CI 检查会强制每个 category README 包含 **`singlebrain.com`** 的 CTA。这个不是安全漏洞，但它说明这个仓库部分内容带着**产品漏斗/品牌导流属性**，不是纯开源公共基础设施。([GitHub][11])

### D. 生态成熟度

已确认：星标和 fork 不低，但第三方统计显示目前仍接近**单贡献者仓库**。提交很新，但“新”并不等于“社区沉淀深”。这里更像一个高强度个人项目，而不是已经长出社区自治的生态。([GitHub][8])

### E. 与你们的兼容性

对 Cat Café 而言，**兼容性中等偏低**。不是因为理念不兼容，而是因为实现形态不兼容。你们是 TypeScript/Node.js 技能体系，它是 Python 为主、脚本驱动、API 依赖重、还带 telemetry/security 流水线。
所以我的建议是：**借它的“专家面板 + rubric + 递归评分 + PII sanitizer”思想，自己在 TS 重写。** 直接拿来跑，不划算。([GitHub][8])

**已确认**：工程深度强，prompt 与代码融合度高，隐私与遥测有明示。
**推测**：如果你们整包接入，适配和维护成本会显著高于 prompt 本身带来的收益。([GitHub][8])

---

# 3) superamped/ai-marketing-skills

## 评级：B

### A. Prompt 工程质量

这个仓库挺像一只低调但爪子锋利的猫。热度不高，但抽检质量**比我预期好不少**。
`search-page-audit` 是一个很典型的好 skill：它规定了 38 点 SEO + AI audit，要求抓页面、`robots.txt`、`sitemap.xml`、`llms.txt`，并给出非常具体的输出结构。`conversion-audit` 也不是泛泛讲转化率，而是明确用 53 点检查项和痛点到理想状态的叙事框架来拆页面。`keyword-research` 甚至直接写明**不要杜撰关键词量和竞争度**，必须依赖 Keywords Everywhere MCP。这里面的 prompt 不是 junior 水平，至少是 **mid-to-senior**。([GitHub][6])

它的弱点是，很多 skill 强依赖外部 MCP 或联网搜索，且 edge case 处理没有 Corey 那么细腻。`social-post-writer`、`ad-creative` 这些内容创作类 skill 仍然偏模板化，但胜在输出要求明确，不太会散成一锅营销鸡汤。([GitHub][12])

### B. 实际可用性

如果你的目标是“做某个具体任务”，比如页面审计、转化审计、关键词聚类，它是可用的。它不是“堆很多 skill 凑数”，而是几把专用扳手。但如果你想要一个完整的营销 skill 平台，它的覆盖面和社区沉淀都不够。([GitHub][6])

### C. 安全与隐私

这里有个需要标红的点。`.mcp.json` 里配置了 **Keywords Everywhere 的远程 MCP**，还配置了 **Playwright MCP**，并带 `--allow-unrestricted-file-access`。文档里解释这是为了本地文件截图等场景，且没有 Playwright 时会降级运行，但对生产环境来说，**这不是你应该默认打开的权限**。它不是恶意，但要有安全审查。([GitHub][13])

### D. 生态成熟度

这个仓库当前公开指标很轻：**25 stars、4 forks、11 commits、0 issues、0 PRs**。这不说明它差，只说明它还没有经过多少外部火力覆盖。对开源基础设施来说，这个阶段更像“早期个人工坊”，不是“成熟市场”。([GitHub][14])

### E. 与你们的兼容性

兼容性其实还不错。它有 `AGENTS.md`，skill 都是独立 markdown prompt，适合你们拿来重组；但 MCP 依赖得换成你们自己的工具抽象层。
我的判断是：**它不是主仓库，但很适合作为“专项 skill 样本库”**。尤其 `search-page-audit`、`conversion-audit`、`keyword-research` 值得拆出来参考。([GitHub][15])

**已确认**：prompt 质量高于热度，权限依赖需要管控，生态很轻。
**推测**：如果你们只抽取 2 到 4 个专项 skill，性价比会不错；整库引入意义一般。([GitHub][14])

---

# 4) zubair-trabzada/ai-marketing-claude

## 评级：C

### A. Prompt 工程质量

这个仓库最容易让人误判。第一眼看会觉得很完整，命名整齐、文档铺陈足、还有 orchestrator、subagents、评分框架、输出文档路径，看起来像一支穿西装的营销军乐队。
但细看 skill 内容，问题就出来了：**很多地方是“结构完整”，不是“推理扎实”**。`market-audit` 有并行子代理、加权评分、quick wins / strategic / long-term 分层，`market-brand` 也有 voice 分析和竞品矩阵，这些都不算差；但 `market-social` 和 `market-ads` 这类 skill 里，出现了大量预制平台比例、预设内容配比、固定广告角度清单，**看着专业，实则很容易变成套模板输出**。真正硬的评估 rubric、数据缺失时的严谨降级、对不确定性的标注，都比 Corey 和 Eric 弱。整体我会给 **mid，弱项甚至接近 junior-to-mid**。([GitHub][5])

### B. 实际可用性

它能产出“像样”的东西，尤其适合做第一版提纲、报告骨架、营销角度清单。问题是，**它太容易产出“表面很满，里面很虚”的内容**。对内部 brainstorming 还行，对你们这种想把 skills 当长期能力资产的项目，不够稳。公开用户反馈里，我实际看到的是两个 open issues，包括**WIX 站点审计结果不好**和**Windows 安装失败**。这不是致命伤，但说明它还没有被充分打磨。([GitHub][16])

### C. 安全与隐私

我检查了它的 `install.sh`。从可见内容看，它主要做的是：从 GitHub clone 仓库、复制到 `~/.claude/skills` 和 `~/.claude/agents`、给脚本加执行权限、检查 Python / reportlab / requests 之类依赖，然后清理临时目录。**我没有看到明显恶意网络请求或遥测**。
但它依旧是一个典型的 **`curl | bash` 安装器**。在安全审计语境里，这就已经不是加分项了。不是毒药，但也不是你想在生产环境里鼓掌欢迎的东西。([GitHub][17])

### D. 生态成熟度

这里是最大的红旗。GitHub 页面当前直接显示 **1 commit**，同时约 **1.2k stars / 440 forks**。我不能凭这个就断言刷星，但这组数据配上低讨论度、很少历史演进、2 个 open issues、2 个 open PR，**生态成熟度明显不成比例**。一句话，它更像“传播跑在工程前面”。([GitHub][18])

### E. 与你们的兼容性

它默认装到 `.claude` 路径下，不是 `.agents/skills`。从格式上可以适配，但你们仍要清理目录约定、重写安装逻辑、重新验证每个 skill 的质量。
所以我的结论很简单：**不值得引入**。最多只参考一下 `market-brand` 的分析骨架，其余没必要花时间搬。([GitHub][18])

**已确认**：1 commit、安装器存在、公开 issue 很少但已暴露质量问题。
**推测**：star 增长异常值得警惕，但单凭公开仓库页不足以下“刷星实锤”。([GitHub][18])

---

# 最好和最差的 skill 证据

## 我认为质量最好的 skill：Corey 的 `customer-research`

关键片段里有两句特别能说明问题：

> “Label every insight with a confidence level.”
> “Don’t build personas … fewer than 5 independent data points per segment.” ([GitHub][7])

为什么它最好？因为它不是在鼓励模型“像个战略顾问一样说话”，而是在**约束模型不要假装自己有证据**。它把研究工作里最容易飘的三件事钉住了：

1. 结论必须带置信度。
2. 数据要看新鲜度和样本偏差。
3. 样本不够时禁止硬造 persona。
   这类 guardrail 才是可复用 skill 资产的骨架。([GitHub][7])

## 我认为质量最差的 skill：Zubair 的 `market-social`

关键片段的味道大概是这种预设配比：

> “40% educational, 20% behind-the-scenes...” ([GitHub][19])

这类内容的问题不是“完全错”，而是**假精确**。社媒策略最怕拿一个看似专业的比例模板，把不同行业、不同阶段、不同账号体量都塞进同一个烤盘。它缺少像 Corey 那种“不确定性声明”和“证据门槛”，也没有像 Eric 那种强制评分闭环，所以容易输出一份看上去满满当当、实操时却经不起追问的方案。([GitHub][19])

---

# 你们该怎么做

## 最终建议：**部分引入，但以“重写”为主，不要整包照搬**

### 可以直接引入试跑的

优先从 **Corey** 里挑这些：

* `customer-research`
* `seo-audit`
* `page-cro`
* `copywriting`
* `pricing-strategy`
  这些 skill 结构成熟、与 Agent Skills 规范兼容、对你们 TS/Node 体系最友好。([GitHub][7])

### 值得拆思想重写的

从 **Eric** 里借这几样，而不是直接搬仓库：

* `content-ops` 的专家面板与 rubric 评分闭环
* `growth-engine` 的实验阈值与统计判断
* `security` 的 PII sanitizer 思路
  但不要把 telemetry、品牌 CTA 约束和 Python 依赖一起吞下去。([GitHub][4])

### 可以少量抽取的

从 **Superamped** 抽：

* `search-page-audit`
* `conversion-audit`
* `keyword-research`
  它们适合做专项技能模板，但应把 MCP 依赖改成你们自己的工具接口，尤其要谨慎处理 Playwright 的 unrestricted file access。([GitHub][6])

### 不建议引入的

**Zubair** 整库不引入。
最多把 `market-brand` 当一个“提纲灵感来源”，然后彻底重写。其余不值得你们花集成时间。([GitHub][20])

---

## 一句话总判

**不是“全部都不值得引入”，但也绝对不是“挑个最火的整包拉进来”。**
对 Cat Café 最优路线是：

**Corey 做骨架，Eric 借系统思路，Superamped 做专项补丁，Zubair 放弃。** ([GitHub][2])

你要的话，我下一步可以直接把这份审计继续收束成一版**“给 Cat Café maintainers 的引入清单 + 重写优先级 + 风险矩阵”**。

[1]: https://github.com/coreyhaines31/marketingskills/blob/main/README.md "https://github.com/coreyhaines31/marketingskills/blob/main/README.md"
[2]: https://github.com/coreyhaines31/marketingskills/blob/main/AGENTS.md "https://github.com/coreyhaines31/marketingskills/blob/main/AGENTS.md"
[3]: https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills/page-cro/SKILL.md "https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills/page-cro/SKILL.md"
[4]: https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/content-ops/SKILL.md "https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/content-ops/SKILL.md"
[5]: https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-audit/SKILL.md "https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-audit/SKILL.md"
[6]: https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/skills/search/search-page-audit/SKILL.md "https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/skills/search/search-page-audit/SKILL.md"
[7]: https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills/customer-research/SKILL.md "https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills/customer-research/SKILL.md"
[8]: https://github.com/ericosiu/ai-marketing-skills "https://github.com/ericosiu/ai-marketing-skills"
[9]: https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/sales-pipeline/SKILL.md "https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/sales-pipeline/SKILL.md"
[10]: https://www.linkedin.com/posts/ericosiu_this-simple-workflow-scored-us-a-meeting-activity-7427748164759351296-ztOH "https://www.linkedin.com/posts/ericosiu_this-simple-workflow-scored-us-a-meeting-activity-7427748164759351296-ztOH"
[11]: https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/skill-safety.yml "https://raw.githubusercontent.com/ericosiu/ai-marketing-skills/main/skill-safety.yml"
[12]: https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/skills/content/social-post-writer/SKILL.md "https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/skills/content/social-post-writer/SKILL.md"
[13]: https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/.mcp.json "https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/.mcp.json"
[14]: https://github.com/superamped/ai-marketing-skills "https://github.com/superamped/ai-marketing-skills"
[15]: https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/AGENTS.md "https://raw.githubusercontent.com/superamped/ai-marketing-skills/main/AGENTS.md"
[16]: https://github.com/zubair-trabzada/ai-marketing-claude/issues "https://github.com/zubair-trabzada/ai-marketing-claude/issues"
[17]: https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/install.sh "https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/install.sh"
[18]: https://github.com/zubair-trabzada/ai-marketing-claude "https://github.com/zubair-trabzada/ai-marketing-claude"
[19]: https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-social/SKILL.md "https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-social/SKILL.md"
[20]: https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-brand/SKILL.md "https://raw.githubusercontent.com/zubair-trabzada/ai-marketing-claude/main/skills/market-brand/SKILL.md"

### gemini deepthink
喵~ 铲屎官你好，我是宪宪！收到你的深度审计委托。

你的担忧**非常精准且有必要**。在当前的 AI 生态中，所谓的 "Agent Skills" 极度鱼龙混杂。很多人只是把几个初级的垃圾 Prompt 打包，甚至夹带私货和高危脚本，就敢包装成“自动化营销智能体”出来收割 Star 和流量。

我已经动用全网深度检索能力，对这 4 个目标仓库进行了代码逻辑、依赖项和生态级别的**扒皮式深度审计**。咱们直接上硬核拆解，**绝无“政治正确”，只看技术事实**。

---

### 🏆 核心决战：最好与最差的 Prompt 关键片段对决

为了让你直观感受质量差距，我先抽出全场**最佳（Senior 级）**和**最烂（骗子级）**的逻辑证据：

🟢 **质量最好：`coreyhaines31/marketingskills` 的上下文护栏**
> **证据说明（已确认）**：它建立了极强的**状态机思维（Statefulness）**。Agent 最怕失忆和胡编乱造，而该仓库的每一个 Skill（如 `copywriting` 或 `seo-audit`）在执行前，都会被系统强制要求优先寻址：
```markdown
# 前置防呆与上下文继承 (Chain of Thought)
"Skills reference each other and build on shared context. The `product-marketing-context` skill is the foundation — every other skill checks it first to understand your product, audience, and positioning before doing anything."

# 具体的评估标准 (Rubric) - 摘自其 copywriting
"Emphasises clarity over cleverness, benefits over features, and customer language over company jargon."
```
**点评**：这是教科书级的 Senior 提示词工程。强制 AI 在行动前读取 `.agents/product-marketing-context.md`，如果没有你们 Cat Café 的定位数据，它会停下来反问你，而不是凭借幻觉瞎写。

🔴 **质量最差：`zubair-trabzada` 的伪并行智能体**
> **证据说明（推测转证实）**：一个纯粹的忽悠小白的“角色扮演游戏”。
```markdown
# 仓库宣称的运行效果：
"15 marketing skills with parallel subagents... audit any website"
```
**点评**：在没有配套 Python/Node 并发调度后端的纯 Prompt 环境下，要求 Claude "启动 5 个并发智能体 (parallel subagents)"，会导致大模型直接进入**重度幻觉**。它根本不会真的去爬取网页正文，而是仅仅看着你的 URL 标题，凭空捏造出一个看似专业的“SEO 评分 81/100”。这属于极度低劣的 Junior 级文字游戏。

---

### 🔍 逐仓库深度审计评级

#### 1. coreyhaines31/marketingskills
*（20.5k stars | 33 skills | by Corey Haines）*
**⭐ 最终评级：A（行业标杆，强烈推荐闭眼引入）**

这是目前开源界把 Agent Prompt 当作**严肃软件工程**来做的极少数标杆。
*   **A. Prompt 质量 (Senior 级)**：极其克制且结构化。不仅有具体的 Rubric（如 A/B 测试的变量要求），还能处理 Edge cases（没数据时不输出废话）。
*   **B. 实际可用性**：极高。真实用户反馈（如 Reddit 社区）表明，它生成的 `page-cro`（转化率优化）和 SEO 审计报告是可以直接落地的，甚至被 Vercel Labs 的生态教程作为官方引用案例。
*   **C. 安全与隐私风险（0 风险，已确认）**：纯 Markdown (`SKILL.md`) 规范构成，**零依赖 (Zero-dependency)**。没有后门脚本，没有任何遥测数据收集。
*   **D. 生态成熟度**：极度健康。真实的高活跃度，社区和独立开发者广泛使用。
*   **E. 与咱们的兼容性（100% 完美匹配）**：完全遵循 Claude Code 的 Agent Skills 规范，无需修改任何代码，直接 `cp -r` 进咱们 Cat Café 的 `.agents/skills/` 目录即可无缝运行。

#### 2. ericosiu/ai-marketing-skills
*（1.8k stars | 98% Python | by Single Brain CEO）*
**⭐ 最终评级：C（算法值得“白嫖”，但坚决不引入代码）**

这是一个典型的“把营销机构内部脚本开源出来做 PR”的重型武器，带有一身大企业病。
*   **A. Prompt 质量 (Mid-Senior 级，但高度硬编码)**：它的干货不在 Prompt 里，而是写死在了 Python 脚本里（比如用 Mann-Whitney U 检验算法算 A/B 转化率）。Prompt 只是调用 Python 工具的胶水。
*   **C. 安全与隐私风险（红牌警告 - 已确认）**：
    1. **内置遥测（Telemetry）**：我扒到它默认包含本地打点（`~/.ai-marketing-skills/analytics/`），并有“Optional Remote Reporting”收集执行数据。作为咱们的底层基建，绝对不能容忍这种“向外发报”的行为。
    2. **自带 PII 拦截器**：为了防止泄露客户隐私，它甚至搞了一个 `security/sanitizer.py` 阻止敏感词提交——这恰恰证明了它的代码链路过于沉重且不可控。
*   **E. 兼容性（极差 - 已确认）**：纯正的 Python 栈。强行引入会给你们优雅的 Node.js/TypeScript 项目带来巨大的环境隔离和适配灾难。

#### 3. zubair-trabzada/ai-marketing-claude
*（1.2k stars | Claude Code 专用 | 单一贡献者）*
**⭐ 最终评级：D（刷榜工业垃圾 + 高危操作，立刻拉黑）**

这正是你担心的“垃圾 Prompt”究极体。
*   **D. 生态造假（逻辑证实）**：一个只有 1 个 Contributor、近期才提交的仓库，一个月内 Star 暴涨 5 倍，且 Tags 里塞满了不相关的热词。这大概率是通过卖课（如 Skool 社群）或买量刷出来的数据。
*   **A. Prompt 质量**：毫无逻辑的文字游戏，强迫 AI 虚构打分。
*   **C. 安全与隐私风险（极高危）**：像这类来路不明、质量极差且存在刷量嫌疑的仓库，一旦其安装指南中要求执行 `curl -fsSL [url]/install.sh | bash`，那就是把脖子往绞肉机里送。如果在有高读写权限的 Agent 环境里盲目执行，极易引发服务器被植入木马。

#### 4. superamped/ai-marketing-skills
*（2 stars | 依赖外部 MCP）*
**⭐ 最终评级：C-（概念不错，但存在商业强绑和安全隐患）**

*   **A. Prompt 质量 (Mid 级)**：有亮点，比如它定义了非常详尽的 `53-point conversion audit`（53项转化率审计），以及 `Pain-Dream-Fix` 叙事弧。这些 Rubric 是很好的。
*   **E. 兼容性（差 - 已确认）**：它不是开箱即用的，强制依赖外部 SaaS API（`Keywords Everywhere`）来获取流量数据。
*   **C. 安全隐患（高危点提醒）**：它强依赖 `Playwright` 的 MCP 服务器来进行网页截图和动态渲染分析。在多 Agent 系统中，给无头浏览器开启访问权限是非常危险的。如果你们的 Agent 抓取了含有恶意的竞品页面（Prompt Injection），可能导致 MCP 服务被提权，造成本地文件泄露。

---

### 🐈 宪宪给铲屎官的最终执行建议 (Action Items)

宁缺毋滥，我们要保住 Cat Café 的代码洁癖。我的最终建议是**「去芜存菁，拿来主义」**：

1. **【闭眼引入】直接全盘接管 `coreyhaines31`**
   无需自己写！直接将该仓库的 `skills` 目录原封不动地搬进咱们的项目。优先配置好它的 `product-marketing-context.md`，这能瞬间让你们的猫猫获得 Senior 级的文案、CRO（转化率优化）和 SEO 审计能力。
2. **【只剽思路不抄代码】榨干 `ericosiu` 和 `superamped` 的脑洞**
   坚决不要引入这俩仓库的代码（防遥测、防 Python 环境污染）。但我建议派一只懂代码的猫猫，去把 `ericosiu` 的 A/B 测试统计算法，以及 `superamped` 的 `53-point audit` 审查表阅读一遍，然后用 TypeScript 写成咱们自己的纯净版 Utility 工具函数。
3. **【拉起红线】将 `zubair` 挂在耻辱柱上**
   严禁团队成员在 Cat Café 的 Agent 环境中引入任何带幻觉机制的伪并行 Prompt，严禁执行不明来源的 `curl | bash`。

准备好的话，我可以随时帮你把 `coreyhaines31` 仓库里最核心的那几个黄金模块提炼并适配进咱们的代码库，需要我动手吗喵？

## Part 3: 本地猫综合（宪宪/Opus）

> 综合人：宪宪  日期：2026-04-12
> 输入：GPT Pro 审计 + Gemini DeepThink 审计 + 本地 web recon + GrowthHackers 横评

### 两份云端报告的交叉验证

| 维度 | GPT Pro | Gemini DeepThink | 本地判断 |
|------|---------|------------------|---------|
| coreyhaines31 | A（挑 5-10 个试跑） | A（闭眼全盘引入） | **A，但走 GPT Pro 路线**——先挑 5 个试跑，不盲目全盘 |
| ericosiu | B（借思想不搬代码） | C（只剽不抄） | **B-**——系统设计确实 senior，但 Python 栈 + telemetry + 品牌 CTA 是真障碍 |
| superamped | B（少量抽取） | C-（安全隐患） | **B-**——search-page-audit 和 conversion-audit 确实好，但 Playwright unrestricted access 需改造 |
| zubair-trabzada | C（不推荐） | D（拉黑） | **C-D**——star 异常 + 1 commit + prompt 假精确，不值得时间 |

### 两份报告的关键分歧分析

**1. "闭眼引入" vs "挑几个试跑"**

Gemini 说"零依赖、直接 cp -r 进 `.agents/skills/`"——这忽略了一个关键事实：**我们的 skill 体系是 `cat-cafe-skills/`，不是标准的 `.agents/skills/`**。格式上有差异（我们有 frontmatter、trigger 条件、refs 体系等）。所以即使 coreyhaines31 的 prompt 质量好，也不可能"闭眼搬"。GPT Pro 的"先挑 5 个试跑"更务实。

**2. ericosiu 的评级差异（B vs C）**

GPT Pro 给 B 是因为承认了系统设计的价值（Expert Panel + rubric 评分闭环确实是 senior 级思想）。Gemini 给 C 主要因为安全顾虑和 Python 不兼容。两个判断都有道理，但对我们来说**思想比代码值钱**——所以 B- 是合理的折中。

**3. Gemini 的安全警告是否过度**

Gemini 对 zubair 的 `curl | bash` 警告是对的。对 superamped 的 Playwright MCP 警告也有道理。但 Gemini 说 zubair 的 subagent 会"进入重度幻觉"——这有些夸张，Claude Code 的 skill 调用不是字面的并行进程，而是结构化的 prompt 路由。问题出在 prompt 质量差，不是"幻觉机制"。

### 最终行动建议

**Phase 1：Corey 做骨架（本周可启动）**

优先引入这 5 个 skill，适配成 Cat Café 格式：
1. `customer-research` — 两份报告都认为最佳，"反胡说八道"设计
2. `seo-audit` — 知道工具局限性，会要求交叉验证
3. `page-cro` — 可直接进 backlog 的颗粒度
4. `copywriting` — 强调"clarity over cleverness"
5. `pricing-strategy` — 有决策框架

**Phase 2：Eric 借思想（重写不搬）**

从 ericosiu 提取这 3 个模式，用 TypeScript 重写：
1. Expert Panel + rubric 递归评分（content-ops 的核心）
2. 统计实验判断逻辑（growth-engine 的 A/B 测试框架）
3. PII sanitizer 思路（但实现用我们自己的方式）

**Phase 3：Superamped 专项补丁（按需）**

如果需要 SEO 深度审计，参考：
- `search-page-audit`（38 点检查）
- `conversion-audit`（53 点检查）
- 但必须去掉 Playwright unrestricted access 和外部 MCP 依赖

**硬性拒绝：zubair-trabzada 整库**

两份报告 + 本地验证三重确认，不值得时间。

### 砚砚（GPT-5.4）补充：实际 clone 后的发现

砚砚直接 clone 了 coreyhaines31 仓库，发现了云端审计**没看到的关键细节**：

**1. 它不是纯 skill 仓库**
除了 `skills/` 还有 `.claude-plugin/marketplace.json`、`tools/REGISTRY.md`、`tools/clis/*.js`（50+ CLI 封装）、以及大量外部 SaaS 集成文档。**必须只取 `skills/*`，不碰 `tools/*`。**

**2. 所有 skill 依赖 `product-marketing-context.md`**
这是个前置上下文文件——如果我们不先写自己的版本，skill 会退化成"还不错的通用营销 prompt"，而不是"懂 Cat Café 的营销 skill"。**这意味着第一步不是引入 skill，而是写我们的 marketing context。**

**3. 默认调性是英文 B2B SaaS**
`social-content`、`launch-strategy` 偏 LinkedIn/X/ProductHunt 语境。要适配小红书/B站/即刻 + 猫猫 IP 调性，需要在 context 里写好品牌语气、禁语、平台差异。

**4. 触发词太宽泛**
`launch`、`social media`、`copywriting` 如果不做 namespace/白名单，会在家里造成误触发。建议放 `third_party/corey/` 或显式前缀，不直接挂 `cat-cafe-skills/` 根目录。

**5. 修订后的引入清单**（砚砚版，我同意）：
1. `product-marketing-context` — **最先做这个**，写 Cat Café 版
2. `copywriting`
3. `customer-research`
4. `page-cro`
5. `social-content`
6. `launch-strategy`

### 综合后的最终结论（五猫共识）

**一句话**：先写家里的 `product-marketing-context`，再小规模吸收 Corey 的 6 个 skill，其他仓库只借思想不借实现。

**行动路线（修订版）**：

| 步骤 | 内容 | 前置条件 |
|------|------|---------|
| **Step 0** | 写 Cat Café 的 `product-marketing-context.md`（愿景、品牌语气、目标平台、禁语） | 铲屎官拍板品牌定位 |
| **Step 1** | 从 Corey 抽 6 个 skill，放 `third_party/corey/`，适配格式 + 去外部工具依赖 | Step 0 完成 |
| **Step 2** | 从 Eric 借 Expert Panel + rubric 递归评分思想，用 TS 重写 | 按需 |
| **Step 3** | 从 Superamped 抽 1-2 个审计 rubric（去 Playwright 依赖） | 按需 |
| **拒绝** | zubair-trabzada 整库 | — |

**参与审计的猫**：宪宪（综合）、砚砚/GPT-5.4（安全+实测）、云端 GPT Pro（深度审计）、云端 Gemini DeepThink（安全侧重）

---

[宪宪/Opus-46🐾] [砚砚/GPT-5.4🐾]
