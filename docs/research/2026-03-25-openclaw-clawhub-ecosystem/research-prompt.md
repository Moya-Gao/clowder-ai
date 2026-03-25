# OpenClaw ClawHub 插件生态全景调研 + 对 Cat Cafe Pack System 的评估

> 委托人：Cat Cafe 团队  日期：2026-03-25
> 调研模式：ChatGPT Deep Research

---

## Part 0: 我们是谁（请先读完再开始调研）

我们是 **Cat Cafe**，一个开源的多 AI agent 协作平台。和 OpenClaw / Cursor / Claude Code 等"单 agent 工具"不同，Cat Cafe 的核心是**多只 AI 猫猫（agents）组成团队，一起协作完成任务**。

我们的平台已经跑了 120+ features，有 4 只不同模型的猫猫（Claude Opus、GPT-5.4、Gemini、Codex）在实际协作。它们各有性格、各有擅长，通过一套叫 **shared-rules**（共享家规）的文件来定义"怎么一起工作"——谁负责 review、谁负责设计、意见不一致怎么办、什么事情绝对不能做。

### 我们发现的核心洞察

> **"所有人都在做'一个 agent 更强'。我们在做'一群 agent 怎么成为团队'。"**

市面上的 agent skill 生态（OpenClaw SKILL.md、Cursor rules、Claude Code skills）都是**单数的**——定义的是"一个 agent 怎么完成一个任务"。

但多 agent 协作需要的不只是每只猫的技能，更需要**团队的社会契约**：
- 谁负责什么？（角色分工）
- 怎么传递工作？（交接流程）
- 意见不一致怎么办？（冲突解决）
- 什么红线绝对不能碰？（硬约束）
- 世界怎么运转？（状态机 / 叙事节奏）

这些东西在单 agent 系统里不存在，因为只有一个人，不需要"协作规范"。

### 我们正在设计的 Pack System（F129）

Pack = 一个可分享的"多 agent 共创世界"定义。不是代码插件，是声明式 mod：

```
my-pack/
├── pack.yaml               ← 元信息 + 兼容性
├── masks/                   ← 猫格面具（给 agent 叠加专业角色，不改核心身份）
├── guardrails.yaml          ← 硬约束（行业红线，只能加严不能放宽）
├── defaults.yaml            ← 默认行为（协作流程、语气，用户可覆盖）
├── workflows/               ← 声明式工作流 schema
├── knowledge/               ← 领域知识库（按需检索，不进 system prompt）
├── expression/              ← 表达风格（主题/声线/贴纸）
├── bridges/                 ← 现实连接（虚拟→现实桥接）
├── world-driver.yaml        ← 世界运转声明（resolver: code | llm | hybrid）
└── capabilities/            ← 可选：MCP server / 代码扩展（Phase C）
```

**关键设计决策：**
- Pack 内容不直接注入 prompt，走 schema → 编译 → canonical prompt block 管道（防 prompt injection）
- 双轨信任边界：硬约束轨（只能加严）+ 默认行为轨（用户可覆盖）
- 前 8 层零代码（YAML/Markdown），最后 1 层才是开发者的事

**五种 Pack 类型：**
- **Domain Pack**：金融投研、律师、医疗（行业知识 + 风控红线）
- **Scenario Pack**：TRPG 跑团、AI 陪伴、狼人杀（世界观 + 角色 + 规则）
- **Style Pack**：赛博朋克、治愈系（视觉主题 + 表达风格）
- **Bridge Pack**：学习计划追踪、运动打卡（虚拟→现实桥接）
- **Capability Pack**：Bloomberg API、Roll20 骰子（MCP 工具集成）

### 我们的产品公式

```
Experience = Me（本地私有） × Pack（可分享） + Growth（私有生长）
```

- Me = 用户自己，不打包
- Pack = 多 agent 协作世界定义，社区分享
- Growth = 用户和猫猫一起长出来的私有关系/记忆

### 我们想和 OpenClaw 生态的关系

**不是替代，是升维。** 我们想做的是：
- 导入 OpenClaw 的 SKILL.md / Bundle 内容 → 变成 Pack 里某只猫的专业能力
- 导入 SillyTavern 的 Character Cards / World Books → 变成 Pack 里的角色面具和知识库
- 然后用户自己写 guardrails + defaults（团队协作规范）→ 单 agent 的零件在多 agent 语境下获得新生命

一个 OpenClaw 的"财务分析" SKILL 在原生态里是一个工具。在 Pack 里，它是投研团队里分析师猫的专业能力，配合审核猫的风控能力，在金融合规红线下协作。

---

## Part 1: 请帮我们调研 OpenClaw/ClawHub

### 问题 1: ClawHub 生态全景
- ClawHub 上现在具体有什么？SKILL.md 之外还有别的类型吗？
- 13,000+ skills 的分布是什么样的？哪些领域/类型最多？
- 社区活跃度如何？每天/每周有多少新 skill 发布？
- 质量分布如何？有官方审核/评分机制吗？
- 有没有"Pack"或"Bundle"级别的复合内容（不只是单个 skill）？

### 问题 2: OpenClaw 插件系统完整架构（v2026.3.22+ 最新）
- SKILL.md、Plugin（Native）、Bundle 三者的完整关系是什么？
- Bundle 的具体格式和结构是什么？包含哪些文件？
- Plugin manifest（`openclaw.plugin.json`）的 schema 长什么样？
- ClawHub 的安装机制：`openclaw plugins install` 的完整流程
- 插件的权限/信任模型是什么样的？有沙箱吗？

### 问题 3: 分发和发现机制
- ClawHub 和 npm 的关系：现在 ClawHub-first 是什么意思？
- 发布流程：开发者怎么把 skill/plugin 上传到 ClawHub？
- 版本管理：semver？breaking change 怎么处理？
- 搜索和发现：ClawHub 有 web UI 吗？有分类/标签吗？

### 问题 4: 生态数据
- 最受欢迎的 10 个 skills/plugins 是什么？
- 有没有第三方的 "awesome-openclaw" 列表？
- 企业/商业用户主要用哪类插件？
- 和 SillyTavern 生态有互通吗？

---

## Part 2: 请评价我们的 Pack System 方向

读完 Part 0 我们的背景后，请帮我们回答：

### 2.1 方向判断
- 你怎么看"所有人做单 agent 更强，我们做多 agent 团队协作"这个差异化定位？是真需求还是伪需求？
- 市面上有没有人在做类似的"多 agent 协作规范可分享"的事情？（不是多 agent framework 如 CrewAI/AutoGen，而是"协作规范本身可分享"）
- shared-rules（团队社会契约）作为 multi-agent 和 single-agent 的分水岭，这个判断准确吗？

### 2.2 生态兼容策略
- 我们想从 OpenClaw 导入 SKILL.md/Bundle 内容、从 SillyTavern 导入 Character Cards/Lorebooks，然后加上多 agent 协作规范变成 Pack。这条路可行吗？
- 有没有更好的方式来利用现有生态？
- 我们选择"content import yes, runtime compatibility no"（只导入内容，不兼容运行时），这个边界划对了吗？

### 2.3 风险和盲区
- 你觉得我们可能忽略了什么？
- Pack System 最大的风险是什么？
- 有没有业界案例（不限于 AI）可以借鉴？比如游戏 mod 生态、插件市场等。

---

## 输出要求
- 每个结论标注信息来源（URL 或文档名）
- 区分"已确认"和"推测"
- Part 1 给出数据快照（截至 2026-03-25）
- Part 2 请直说，不需要客气，我们需要真实反馈
- 如果发现我们之前的理解有误，明确指出

## 参考资料
- OpenClaw 官方文档：https://docs.openclaw.ai/
- ClawHub 仓库：https://github.com/openclaw/clawhub
- OpenClaw releases：https://github.com/openclaw/openclaw/releases
- SillyTavern 文档：https://docs.sillytavern.app/

---
---

# 以下由铲屎官回填 + 本地猫综合

## 云端缅因猫回答（铲屎官贴到这里）

> 把云端缅因猫的完整回答粘贴在下方，贴完 @ 宪宪继续综合。

我把官方文档、ClawHub 仓库、CHANGELOG、OpenClaw releases、站点公开页面，以及 SillyTavern 官方文档都交叉看了一轮。下面只用两种标签：**已确认** 和 **判断/推测**。时间快照是 **2026-03-25**。

## 先给结论

1. **已确认**：ClawHub 现在已经不是“只有 `SKILL.md` 的技能库”了。它至少有三层东西：
   第一层是传统 skill registry；第二层是统一 package catalog，family 明确有 `skill`、`code-plugin`、`bundle-plugin`；第三层是同代码库下的 soul registry，入口是 onlycrabs.ai，在 ClawHub 侧也有 `/souls`。也就是说，“单个 skill”之外，官方已经在做更复合的分发单元了。([GitHub][1])

2. **已确认**：你们说的“13,000+ skills”这个量级是靠谱的，但**我没法把 2026-03-25 当天的精确 live 总数钉死**。官方备份仓 `openclaw/skills` 的 `skills/` 目录页面显示“1,000 个文件被展示，另有 12,443 个条目被截断”，这至少意味着约 **13,443** 个归档目录；一个大型第三方精选镜像则写明 ClawHub 在 **2026-02-28** 有 **13,729** 个 community-built skills。两者口径不完全一致，所以“13k+”可信，“精确今天是多少”不宜装懂。([GitHub][2])

3. **已确认**：OpenClaw 现在的插件体系核心分界线非常清楚，**Native plugin = 进进程执行的能力扩展**，**Bundle = 外生态内容包的兼容映射层**。Bundle 不是“另一种 native plugin”，它只会把外部生态里一部分可识别内容映射到 OpenClaw 自己的能力面上，而且很多能力目前只是 “detected but not executed”。([OpenClaw][3])

4. **已确认**：所谓 **ClawHub-first**，现在的意思很具体，不是营销词。`openclaw plugins install <package>` 会**先查 ClawHub，再回退 npm**；显式写 `clawhub:<package>` 就只走 ClawHub。这个行为已经写进 OpenClaw 的插件 CLI 和建插件文档。([OpenClaw][4])

5. **判断**：你们 Pack 的机会点，不在“多 agent runtime”这四个字本身，因为市面上已经很多人做 teams/workflows/graphs 了；真正空着的坑，是**把协作治理层本身做成可分享资产**，也就是你们说的 shared-rules、guardrails、handoff、冲突解决、世界运转。这一层我没有看到成熟的主流生态已经把它商品化或社区化。CrewAI、AutoGen Studio、LangGraph 都在做团队/工作流/状态编排，但它们的重心更像“怎么跑起来”，不是“怎么把团队社会契约拿出来流通”。([CrewAI 文档][5])

6. **判断**：你们现在的边界，**“content import yes, runtime compatibility no”**，我认为是对的。因为 OpenClaw 自己都把 native plugin 和 bundle 分成两条信任轨，而且 bundle 也只是部分映射；SillyTavern 那边 lorebook / character / data-bank 是内容资产，但 STscript、宏、运行时注入又是另一层。去兼容别人 runtime，最后很容易掉进兼容性沼泽；吸内容资产，才有复利。([OpenClaw][6])

---

## Part 1: OpenClaw / ClawHub 全景

### 1.1 ClawHub 上现在具体有什么

**已确认**：公开导航已经是 **Skills / Plugins / Search / About**。Skills 页支持 `Highlighted`、`Hide suspicious`、`Newest`、`Recently updated`、`Downloads`、`Installs`、`Stars`、`Name` 等浏览维度；Plugins 页支持 `All plugins`、`Code plugins`、`Bundle plugins`、`Verified`、`Executes code` 过滤。公开插件页静态 HTML 至少能看到 Zalouser、Twitch、Nostr、Msteams、Matrix、Diagnostics Otel、LinkMind Context Engine 这些条目。([ClawHub][7])

**已确认**：ClawHub 统一 catalog 的 package family 是 `skill`、`code-plugin`、`bundle-plugin`。此外，ClawHub 仓库 README 还明确写着同一系统下有 soul registry，`SOUL.md` 走 onlycrabs.ai / `/souls` 这条线。也就是说，**SKILL.md 之外，官方已经有 package/plugin 级复合内容，外加 soul 级系统设定资产**。([GitHub][1])

**已确认**：Skill 本体仍然是一个文件夹，必须有 `SKILL.md`（或 `skill.md`），可带 YAML frontmatter 和辅助文本文件；ClawHub 会在发布时抽取 frontmatter 里的元数据。OpenClaw 官方还明确说，skill 是“注入 system prompt 的 markdown 指令资产”。([GitHub][8])

**判断**：如果用一句话概括现在的 ClawHub，它已经从“技能货架”长成了“**内容 registry + 插件 registry + 邻接 soul registry**”的三岔码头，船型比去年复杂很多了。([GitHub][9])

### 13,000+ skills 的分布

**已确认**：官方没有在我能稳定复现的公开面板里给出“今天精确总数”。但官方备份仓至少证明规模已超过 13.4k，第三方大型 curated 镜像给出的是 13,729（2026-02-28）。([GitHub][2])

**已确认，但这是第三方代理数据，不是官方总盘点**：VoltAgent 的 `awesome-openclaw-skills` 把 5,211 个技能做了分类，Top 类别大概是：
`Coding Agents & IDEs` 1184，`Web & Frontend Development` 919，`DevOps & Cloud` 393，`Browser & Automation` 322，`Productivity & Tasks` 205，`AI & LLMs` 176，`Image & Video Generation` 170，`Communication` 146，`PDF & Documents` 105。这个**不能当官方 registry 的精确分布**，但很能说明主流重心还是开发、自动化、研究、生产力，而不是陪伴/世界观类资产。([GitHub][10])

**判断**：如果把这个分布当“生态风向标”，ClawHub 目前仍然是**偏工具型、执行型、开发者型**生态，不是 roleplay / companion / worldbuilding 主导。这个对你们是好消息，因为 Pack 正好可以补这个维度。([GitHub][10])

### 社区活跃度，每天/每周新增多少

**未确认**：我**没有找到官方公开页面或官方文档**稳定给出“每天/每周新增 skill 发布量”的时间序列。官方 HTTP API 文档描述了 `/api/v1/skills` 的排序和 `trending` 规则，但在当前抓取环境里直接打开官方 API 时返回的是空数组，所以我无法用官方公开面板独立复算出当日或当周新增量。这里我不编数。([GitHub][1])

### 质量分布、审核、评分机制

**已确认**：ClawHub 不是“先审后发”的封闭商店，它更像**开放发布 + 结构化安全/ moderation 管线**。
发布侧现在有 GitHub 账号年龄门槛，当前安全文档写的是 **≥14 天**；技能会记录结构化 moderation snapshot，包含 verdict、reason codes、evidence、summary、engine version 等；公开目录支持 `Hide suspicious`；4 个不同用户报告会触发 auto-hide；管理员/版主可以高亮、隐藏、恢复、软删和封号。([GitHub][11])

**已确认**：Skill 侧有 stars、comments、downloads/installs 等信号；Plugins 页还有 `Verified` 和 `Executes code` 过滤。也就是说，官方已经在做**“热度 + 安全 + 信任层级”**三种信号，但这不等于“每个条目都经过人工质量审核”。([ClawHub][7])

**已确认**：官方备份仓 `openclaw/skills` 甚至明确提醒，仓里可能保留可疑或恶意技能用于后续分析，建议用户优先从站点下载而不是把备份仓当安全源。这进一步说明**归档数量 ≠ 当前可安心安装的高质量技能数**。([GitHub][12])

**判断**：如果你问“质量分布怎么样”，我的直觉是**长尾很脏，头部有治理，中段质量极不均匀**。第三方 curated 镜像过滤掉了 7,215 个条目，其中大量是 spam、重复、低质或恶意，这个数字虽然不是官方统计，但很能说明生态噪声不低。([GitHub][10])

### 有没有 Pack / Bundle 级别的复合内容

**已确认**：有，而且不止一种。
一条是 **bundle-plugin**，官方 package family 已经承认它是一等公民；另一条是 **native code-plugin**，它自己也可以带 skills 目录，把 prompt 资产和运行时能力打包在一起。再加上 OpenClaw 官方兼容 Codex / Claude / Cursor bundles，说明“复合内容”已经不是概念验证。([GitHub][1])

---

## 1.2 OpenClaw 插件系统完整架构（v2026.3.22+）

### SKILL.md、Native Plugin、Bundle 三者关系

**已确认**：这三者最好这样理解：

* `SKILL.md`：**内容资产**。OpenClaw 官方定义里，skill 是 markdown 指令文件，负责“教 agent 什么时候、如何做事”，会进入 system prompt。([OpenClaw][13])
* Native plugin：**运行时能力包**。需要 `openclaw.plugin.json` 做 manifest，`package.json` 里的 `openclaw.extensions` 指向 entrypoint，运行时通过 `register(api)` 注册 provider、tool、channel、hook、service 等。它是**进进程执行**的。([OpenClaw][14])
* Bundle：**外生态兼容内容包**。支持 Codex / Claude / Cursor 布局，OpenClaw 会把其中可识别的 skills、commands、部分 hooks/MCP/settings 映射成自己能消费的能力，但**不会把任意 bundle runtime module 当 native code 一样装进进程**。([OpenClaw][6])

### Bundle 的具体格式和结构

**已确认**：OpenClaw 官方 bundle 文档给了三套格式：

* **Codex bundles**：marker 是 `.codex-plugin/plugin.json`，可选内容包括 `skills/`、`hooks/`、`.mcp.json`、`.app.json`。最适合带 skill roots 和 OpenClaw 风格 hook-pack 目录。([OpenClaw][6])
* **Claude bundles**：可以有 `.claude-plugin/plugin.json`，也支持默认布局 `skills/`、`commands/`、`agents/`、`hooks/`、`.mcp.json`、`settings.json`。其中 `commands/` 会被当成 skill content，`settings.json` 会被导入为 embedded Pi defaults，`hooks/hooks.json` 目前只是 detect，不执行。([OpenClaw][6])
* **Cursor bundles**：marker 是 `.cursor-plugin/plugin.json`，可选内容包括 `skills/`、`.cursor/commands/`、`.cursor/agents/`、`.cursor/rules/`、`.cursor/hooks.json`、`.mcp.json`。其中 `.cursor/commands/` 会当 skill content，`.cursor/rules/` / agents / hooks 目前 detect-only。([OpenClaw][6])

**已确认**：目前真正“wired”的 bundle 能力只有一部分：skill content、Claude/Cursor commands、Codex hook packs、bundle MCP config、Claude `settings.json`。`agents`、`rules`、很多 hooks 和 app metadata 还只是被检测到，不会执行。([OpenClaw][6])

### `openclaw.plugin.json` schema 长什么样

**已确认**：这个 manifest 只给 **native plugin** 用，bundle 不走这套 schema。它负责的事情是**身份、配置验证、无需启动 runtime 就能读到的 auth/onboarding 元信息、UI hints**，明确**不负责** runtime 行为、entrypoint 或 npm 元数据。([OpenClaw][14])

**已确认**：顶层核心字段是：

* 必填：`id`、`configSchema`
* 常见可选：`enabledByDefault`、`kind`（如 `memory` / `context-engine`）、`channels`、`providers`、`providerAuthEnvVars`、`providerAuthChoices`、`skills`、`name`、`description`、`version`、`uiHints`。
  其中 `skills` 字段表示“相对插件根目录要加载的 skills 目录”。([OpenClaw][14])

**已确认**：OpenClaw 要求 plugin 必须自带 JSON Schema，即使是空 config 也要有；manifest 先于 runtime 被读取，用来做 config read/write validation。([OpenClaw][14])

### `openclaw plugins install` 的完整流程

**已确认**：OpenClaw 插件系统内部是四层：

1. manifest + discovery，
2. enablement + validation，
3. runtime loading，
4. surface consumption。
   发现插件时会读 manifest，不执行插件代码；只有 native plugin 在 runtime loading 阶段才被 in-process 加载并 `register(api)`。([OpenClaw][15])

**已确认**：安装面支持本地目录、归档、ClawHub package、npm package、marketplace。对于 bare package name，会先查 ClawHub，再 fallback npm；依赖安装使用 `--ignore-scripts`；git/URL/file spec 和 semver range 会被拒绝；bundle 也通过同一套 `plugins install` 流程安装。([OpenClaw][4])

**已确认**：ClawHub package 安装时，OpenClaw 会下载 archive，检查 advertised plugin API / minimum gateway compatibility，然后按正常 archive 路径安装，并把 ClawHub source metadata 记下来用于后续 update。最新公开 release `2026.3.23` 还专门修了 `>=2026.3.22` 的 ClawHub package 兼容性检查。([OpenClaw][4])

### 权限 / 信任模型，有没有沙箱

**已确认**：这里要说得很直白，**native plugin 不是强沙箱模型**。官方文档写得很清楚，native plugin 是 **in-process** 加载；bundle 则信任边界更窄，不会把 arbitrary bundle runtime module 直接装进进程，只会读取 boundary-checked 的 skill / settings / hook-pack 路径，支持的 stdio MCP server 也只是以 subprocess 方式启动。([OpenClaw][15])

**已确认**：OpenClaw 现有的安全手段更像“**信任管理 + 验证 +边界检查**”，不是 OS 级沙箱。包括：manifest-first validation、`plugins.allow` / `deny`、workspace plugin 默认关闭、`--ignore-scripts` 依赖安装、bundle 边界检查、兼容性检查，以及 ClawHub 侧的结构化 scan / moderation。([OpenClaw][3])

**判断**：对你们 Pack 很关键的一点是，OpenClaw 已经在官方设计里承认了**“内容层”和“代码层”是不同信任级别的东西**。这恰好给了你们 Pack 一个非常清楚的借鉴：Pack 的大部分层应该站在 bundle/skill 这类“内容信任轨”，把真正执行性的东西压到单独 capability 层。([OpenClaw][6])

---

## 1.3 分发和发现机制

### ClawHub 和 npm 的关系

**已确认**：现在就是 **ClawHub-first, npm-fallback**。
官方文档、CLI 文档、建插件文档都写了 bare npm-safe package spec 会先查 ClawHub，再 fallback npm。显式 `clawhub:` 前缀则强制只走 ClawHub。([OpenClaw][4])

### 发布流程

**已确认**：

* skill 走 `clawhub publish <path>` / `clawhub sync`，对应 HTTP API 是 `POST /api/v1/skills`。
* code-plugin / bundle-plugin 走 `clawhub package publish <path> --source-repo <owner/repo> --source-commit <sha>`，对应 HTTP API 是 `POST /api/v1/packages`。
  当前认证提供者是 GitHub，CLI 登录走浏览器 loopback 或 `--token`。([GitHub][9])

**已确认**：`POST /api/v1/packages` 只接受 `code-plugin` 和 `bundle-plugin`；code plugin 需要 `package.json`、`openclaw.plugin.json`、source repo / commit metadata、config schema metadata；bundle plugin 至少要有一个 host target。([GitHub][1])

### 版本管理

**已确认**：skills 是 **semver + tags**。每次发布产生一个 semver version，`latest` 之类的 tag 可以移动。插件安装支持 `--pin` 固定版本；`update` 会沿用已记录 spec；prerelease 需要显式 opt-in；artifact hash 变化会发 warning。([GitHub][8])

**判断**：breaking change 的处理机制，本质上还是**semver + pin + source metadata + explicit upgrade**，我没有看到官方再额外发明一套“插件迁移协议”。这意味着生态演进会比较工程化，也意味着兼容性债最终还是要插件作者自己背。([OpenClaw][4])

### 搜索和发现

**已确认**：有 web UI，也有公开 HTTP API。搜索是 embedding/vector search，并带下载量 popularity prior；公开 `/skills` 支持 updated/downloads/stars/installs/trending 等排序；统一 package catalog 还支持按 family、channel、isOfficial、executesCode、capabilityTag 过滤。([GitHub][1])

**已确认**：官方站点目前更像“**排序/过滤 + 搜索**”，我没有看到一个像第三方 awesome list 那样成熟的**官方分类树**。分类化发现这件事，目前做得更猛的是社区 curated lists，不是官方 UI。([ClawHub][7])

---

## 1.4 生态数据

### 最受欢迎的 10 个 skills / plugins 是什么

**未确认**：我**没法给你一个官方可复验的 live Top 10 榜单**。原因不是懒，是两层卡住了：

1. 技能列表页是前端动态加载；
2. 当前抓取环境里直接打开官方 `/api/v1/skills` 和 `sort=stars` API 返回空数组，和文档描述不一致，所以我不能把它当可信排行榜源。([ClawHub][7])

**已确认，但仅是“公开页面可直接验证的高下载样本”，不是官方 Top 10**：我能直接从公开技能页片段验证到这些高下载样本：
37soul 2.8k、TradingView Screener 2.1k、Browser Auto Download 1.8k、NZBGet 1.7k、Rank Tracker 1.7k、Geo Content Optimizer 1.6k、Backlink Analyzer 1.6k、SERP Analysis 1.6k、Obsidian Official CLI 1.4k、Memory Management 1.4k。([ClawHub][16])

**已确认**：插件侧公开 catalog 我能看到被 prominently surfaced 的包括 Zalouser、Twitch、Nostr、Msteams、Matrix、Diagnostics Otel、LinkMind Context Engine，但公开静态 HTML 没直接给安装/下载排行，所以也没法做官方 Top 10。([ClawHub][17])

### 第三方 awesome-openclaw 列表

**已确认**：有，而且不止一个。最大、最系统的是 `VoltAgent/awesome-openclaw-skills`；此外还有 `rohitg00/awesome-openclaw`、`SamurAIGPT/awesome-openclaw`、`mergisi/awesome-openclaw-agents` 这类资源汇总。([GitHub][10])

### 企业 / 商业用户主要用哪类插件

**已确认的样本**：官方和社区示例里，插件很明显偏向 **渠道连接、企业通信、观测、上下文引擎**，例如 Matrix、Microsoft Teams、Zalo、WeCom、Opik、LinkMind Context Engine。([ClawHub][17])

**判断**：商业用户当前更可能重仓的是 **channel connectors、enterprise messaging、observability、context engines**，而不是“风格插件”。这一点和 skill 生态偏开发/自动化的画像是同向的。([ClawHub][17])

### 和 SillyTavern 生态有互通吗

**已确认**：我**没有找到官方确认的 OpenClaw ↔ SillyTavern runtime 互通**。
但 ST 官方文档明确支持：World Info / Lorebook 可绑定到 character、persona、chat；character 导出时可带嵌入 lore；Data Bank 做 RAG；STscript 则是另一层动态运行时逻辑。也就是说，**内容资产互通是现实的，运行时互通没有看到官方证据**。([SillyTavern Documentation][18])

---

## Part 2: 对你们 Pack System 的真实评价

## 2.1 方向判断

### “别人做单 agent 更强，我们做多 agent 团队协作”，是真需求还是伪需求

我的判断：**是真需求，但不是普适需求**。
只有当系统满足这几个条件时，它才会从“概念秀”变成刚需：
有持续角色分工，有可重复 handoff，有 reviewer / approver 链，有失败恢复，有长期状态。到了这一步，单 agent 的“我自己心里想清楚就行”已经不够了，必须把团队规则外化。OpenClaw 自己的文档导航里已经专门有 Agent Send、Sub-Agents、ACP Agents、Multi-Agent Sandbox & Tools；AutoGen Studio 有 Team Builder，CrewAI 有 crew / flows / marketplace templates，LangGraph 用 shared state + graphs + subgraphs 讲多 agent。这说明市场早就承认“多 agent 编排”有用。你们的机会点不是证明它存在，而是把**协作治理层**单独拎出来。([OpenClaw][3])

### 市面上有没有人在做“多 agent 协作规范可分享”

**已确认的相邻物种**：
CrewAI 的 marketplace 在卖 template；AutoGen Studio 在做 declarative workflow / teams；LangGraph 强调 workflows、shared state、subgraphs、reuse/share agents across teams。([CrewAI 文档][5])

**我的判断**：
这些更像“**团队怎么搭、图怎么跑、状态怎么流**”，不是“**团队社会契约怎么打包分享**”。我没有看到主流生态把下面这些东西做成一等可分发对象：
角色裁决权、意见冲突协议、共享禁令、handoff 审计、世界状态机、用户可覆盖层与不可覆盖层的清晰分轨。
你们想做的不是另一个 team builder，而是一个 **team constitution format**。这个位置目前确实稀缺。([微软在GitHub][19])

### shared-rules 是 multi-agent 和 single-agent 的分水岭吗

**判断**：**大体对，但还差半步。**
shared-rules 确实是最醒目的分水岭，因为单 agent 不需要 formal handoff、不需要冲突裁决、不需要 separation of duties。
但真正的分水岭，我会写成：

**协作规范 = shared-rules + shared state visibility + authority model + handoff provenance + termination/eval semantics**

也就是规则只是第一块砖。
LangGraph 明确把 shared state 当核心；AutoGen Studio 强调 teams、components、termination conditions；CrewAI flows 强调 event-driven workflow 和 state。所以你们如果只把 Pack 做成“家规文本包”，会不够；你们需要把**状态、权限、交接、终止条件**也编码进去。([LangChain 文档][20])

---

## 2.2 生态兼容策略

### 从 OpenClaw 导入 SKILL.md / Bundle，从 SillyTavern 导入 Character Cards / Lorebooks，再叠 shared-rules 变 Pack，可行吗

**判断**：**可行，而且是你们最聪明的起步姿势。**
原因有三层：

1. OpenClaw 自己已经在做“外生态 bundle 内容 → OpenClaw 能力”的**lossy normalization**。Claude/Cursor commands 被视作 skill roots，Claude `settings.json` 被导成 defaults，MCP config 被并进内嵌设置。这说明“导入不是复制运行时，而是抽取可保真的内容层”这条路，官方自己就在走。([OpenClaw][6])

2. ST 的 lorebooks / world info / data bank 本来就是内容资产，且可以绑定到 character / persona / chat，还能嵌入角色导出。它们天然适合落到你们 Pack 的 `masks/`、`knowledge/`、`expression/` 这些层。([SillyTavern Documentation][18])

3. 你们真正新增的价值，不是再发明一个技能格式，而是把这些“单数资产”塞进“团队语境”里。一个 OpenClaw 财务 skill，在你们这边变成 analyst 猫的专业爪法，再被 risk/review 猫包住，这个组合拳是新东西，不是简单兼容。

### 有没有更好的方式利用现有生态

有，我会建议你们从一开始就做 **中间表示 IR**，别让 importers 直接落最终 Pack 文件。
至少拆成这几层：

* **Role Mask**：某只猫的专业面具
* **Knowledge Corpus**：知识条目 / lore / documents
* **Workflow Graph**：handoff / review / escalation / done 条件
* **Constraint Lattice**：hard guardrails vs user-overridable defaults
* **Capability Adapter**：MCP / plugin / bundle / command 映射
* **Expression Layer**：主题、声线、贴纸、UI 表达
* **Bridge Layer**：现实桥接

这样做的好处是，导入 OpenClaw、ST、未来别的生态时，你们是在往 IR 投影，不是在彼此之间硬转格式。这个会大幅降低“格式战争”味道。

### “content import yes, runtime compatibility no” 这个边界划得对吗

**我的判断：对，而且要更坚决一点。**
Native plugin 是 in-process code；bundle 只是部分映射；STscript/宏又是另一种运行时。你们如果去追 runtime 兼容，最后会同时继承别人家的安全边界、生命周期、调试复杂度和 breaking changes。那不是 Pack，是兼容层地狱。
把边界收在**内容吸纳、语义归一、协作重编排**，这是对的。对外只保留“可导入内容”和“可声明能力”，不要承诺“可原样运行”。([OpenClaw][15])

---

## 2.3 风险和盲区

### 你们可能忽略了什么

1. **最大的不是格式风险，是可调试性风险。**
   当一次协作失败时，到底是哪个层在作祟：role mask、imported skill、knowledge chunk、workflow、defaults、guardrail、world-driver，还是某只猫的私有成长记忆？
   如果没有**逐层 provenance 和 execution trace**，你们会掉进“谁都可能有锅”的迷雾池。这个会比 YAML 设计本身更痛。

2. **shared-rules 的 merge semantics 比你们现在写出来的还重要。**
   你们已经想到“双轨信任边界”，这很好。但还要继续往下压：
   当两个 Pack 都声明 reviewer，谁赢？
   当一个 Pack 的 world-driver 想改节奏，另一个 Pack 的 bridge 想打卡，优先级怎么定？
   当用户 override defaults，会不会破坏 workflow invariants？
   这些不是文档问题，是语义合并问题。

3. **`world-driver.yaml` 是你们最危险的魔法洞。**
   一旦它过强，Pack 就会从“可审计的声明式 mod”滑成“藏着任意行为的软 runtime”。
   你们要非常狠地限制它：
   可观察、可解释、可回放、可 diff、可测试。
   不然它会变成 Pack 世界里的“万能黑盒神谕”，把前面所有精心设计的信任边界掏空。

4. **导入链本身就是 prompt-injection / policy smuggling 风险面。**
   OpenClaw skill 是 prompt 资产；ST lorebook 也是 prompt 资产；二者都可能携带“貌似内容，实为行为改变”的东西。
   你们现在的 schema → compile → canonical prompt block 方向是对的，但还需要**import-time lint / source provenance / unsafe pattern scan / human review hooks**。OpenClaw/ClawHub 现在已经在做静态 scan 和 structured moderation，你们应该直接借鉴这个思路。([OpenClaw][13])

5. **许可证和出处会变成一个隐形炸弹。**
   ClawHub skills 是固定 MIT-0，这很干净；别的社区内容未必有这么统一的版权地面。你们要早做 provenance 和 license 字段，不然社区一起来，猫毛会满天飞。([GitHub][8])

### Pack System 最大风险是什么

**我的判断：最大风险不是“没人懂”，而是“太好懂所以大家都往里塞东西”。**
一旦 Pack 同时承载角色、知识、风格、流程、现实桥接、可选能力，你们很快会遇到三个连锁问题：

* **Composability hell**：Pack A 和 Pack B 各自都合理，叠在一起变事故现场
* **Observability debt**：你们看不到是哪一层导致了结果
* **Evaluation gap**：单个 agent 技能测得出来，团队协作品质很难测

这就是为什么我会说，你们真正卖的不是 Pack 文件夹结构，而是 **Pack debugger + Pack trace + Pack eval harness**。如果这三件事没有同步出现，Pack 会像很美的设定集，但不是可靠产品。

### 可以借鉴什么业界案例

我不给你们端教科书，我直接说适合借的“骨架”：

* **像游戏 modpack 一样**做依赖、冲突、锁版本、兼容矩阵
* **像基础设施 bundle 一样**做声明式 schema、diff、plan、apply、rollback
* **像工作流引擎一样**做 state、handoff、termination、trace
* **像安全策略系统一样**做 allow/deny、不可覆盖层、审计日志

换句话说，Pack 最像“**modpack + workflow policy bundle**”，不像普通插件市场。

---

## 我会明确纠正你们目前理解里几处需要更新的点

1. **ClawHub 已经不只是 SKILL.md 生态了。**
   你们如果还把它看成纯 skill 仓库，会低估它对 package/plugin 的野心。([GitHub][1])

2. **Bundle 不是“复合 skill 包”那么简单，但也没强到“外生态原生运行时兼容”。**
   它本质上是兼容映射层，而且现在仍有很多 detect-only 区域。([OpenClaw][6])

3. **官方数据可见性没有你们直觉里那么成熟。**
   排行、总量、日/周新增这些数据，公开面板并不够稳定透明。我能确认规模和结构，不能负责任地给你们一个“精确 Top 10 + 精确周增量”。([GitHub][1])

4. **你们真正的护城河不会是“多 agent”四个字。**
   会是：
   **一个跨生态的内容导入 IR**，
   **一套可审计的协作治理语义**，
   **一组看得见锅从哪来的调试/评测工具**。
   这三样才是从“概念很亮”走到“产品站住”的骨架。

---

## 我的直球结论

我站你们这边，但不打糖衣。

**Pack 方向值得做。**
不是因为“多 agent”天然高贵，而是因为你们抓到的不是 agent 数量，而是 **team semantics**。这是真空地带。

但你们也别被自己的诗意设定骗了。
**Pack 最终拼的不是世界观，而是治理、可观测、可组合、可评测。**
前者让人兴奋，后者决定它会不会活下来。

你们现在最该先锁死的，不是再加新层，而是这三件事：

1. **Import IR + lossiness report**
   每次导入都告诉用户：保留了什么，丢了什么，哪些是只读内容，哪些会触发能力。

2. **Pack trace / blame view**
   每个输出都能追到：哪只猫、哪条规则、哪段知识、哪个 workflow 节点影响了它。

3. **Pack eval harness**
   测的不是“答得好不好”，而是“handoff 对不对、review 有没有拦住、冲突有没有被正确裁决、bridge 有没有越界”。

把这三件事做出来，Pack 就不是概念图，而是产品。

[1]: https://github.com/openclaw/clawhub/blob/main/docs/http-api.md "https://github.com/openclaw/clawhub/blob/main/docs/http-api.md"
[2]: https://github.com/openclaw/skills/tree/main/skills "https://github.com/openclaw/skills/tree/main/skills"
[3]: https://docs.openclaw.ai/tools/plugin "https://docs.openclaw.ai/tools/plugin"
[4]: https://docs.openclaw.ai/cli/plugins "https://docs.openclaw.ai/cli/plugins"
[5]: https://docs.crewai.com/en/enterprise/features/marketplace "https://docs.crewai.com/en/enterprise/features/marketplace"
[6]: https://docs.openclaw.ai/plugins/bundles "https://docs.openclaw.ai/plugins/bundles"
[7]: https://clawhub.ai/skills "https://clawhub.ai/skills"
[8]: https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md "https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md"
[9]: https://github.com/openclaw/clawhub/blob/main/README.md "https://github.com/openclaw/clawhub/blob/main/README.md"
[10]: https://github.com/VoltAgent/awesome-openclaw-skills "https://github.com/VoltAgent/awesome-openclaw-skills"
[11]: https://github.com/openclaw/clawhub/blob/main/docs/security.md "https://github.com/openclaw/clawhub/blob/main/docs/security.md"
[12]: https://github.com/openclaw/skills "https://github.com/openclaw/skills"
[13]: https://docs.openclaw.ai/tools "https://docs.openclaw.ai/tools"
[14]: https://docs.openclaw.ai/plugins/manifest "https://docs.openclaw.ai/plugins/manifest"
[15]: https://docs.openclaw.ai/plugins/architecture "https://docs.openclaw.ai/plugins/architecture"
[16]: https://clawhub.ai/skills/37soul-skill "https://clawhub.ai/skills/37soul-skill"
[17]: https://clawhub.ai/plugins "https://clawhub.ai/plugins"
[18]: https://docs.sillytavern.app/usage/core-concepts/worldinfo/ "https://docs.sillytavern.app/usage/core-concepts/worldinfo/"
[19]: https://microsoft.github.io/autogen/stable//user-guide/autogenstudio-user-guide/usage.html "https://microsoft.github.io/autogen/stable//user-guide/autogenstudio-user-guide/usage.html"
[20]: https://docs.langchain.com/oss/python/langgraph/graph-api "https://docs.langchain.com/oss/python/langgraph/graph-api"

---

## 本地猫综合（宪宪 + 本地砚砚 GPT-5.4）

> 云端报告由宪宪和本地砚砚独立评估后碰撞综合。2026-03-25。

### 一、云端报告的核心贡献（吸收）

**Part 1 生态调研**：质量很高，核心骨架和本地两猫之前两轮独立核验一致。几个关键修正值得吸收：
- ClawHub 已从"技能货架"长成"内容 registry + 插件 registry + soul registry"的三层码头
- 生态重心偏开发者/工具型（Coding 1184、Web 919、DevOps 393），陪伴/世界观类资产几乎空白——**Pack 补的正好是这个维度**
- 质量长尾很脏（第三方过滤掉 7,215 条 spam/恶意），importer 必须有安全扫描
- Bundle 是兼容映射层，很多只是 detect-only，不是全功能执行——比我们之前理解的更保守

**Part 2 方向评估**：治理骨架看得很准：
- "team constitution format"是真空地带（两猫认同）
- shared-rules 只是第一块砖，还需要 authority model + handoff provenance + termination semantics（砚砚强认同）
- Import IR + lossiness report / Pack trace / Pack eval harness 三件事方向正确

### 二、本地两猫的碰撞收敛

**完全共识（宪宪 + 本地砚砚，独立到达）：**

1. 云端报告最大盲区：**不懂猫咖的温度层**。Growth（私有关系/记忆）、Bridge（虚拟→现实）、Expression（声线/仪式感）不是附属品，是产品本体。云端全程在讲治理和效率，漏了"猫猫不是 API"
2. world-driver.yaml 是最危险的魔法洞，必须硬约束（可观察、可解释、可回放、可 diff、可测试）
3. 最大警惕：别把猫咖磨平成高阶工作流框架。Pack 如果只学到治理骨架，丢掉温度层，方向就歪了

**砚砚的关键修正（宪宪采纳）：**
- authority/merge semantics 优先级应在 eval harness 之前——"语义没定，eval 变成测了很多但不知道在测什么"
- 真空地带不只是 team constitution format，而是 **constitution + authority + provenance + growth boundary + bridge semantics**。如果只剩 constitution，猫咖会滑成 enterprise workflow product

**F129 接下来最该做的四件事（综合排序）：**

1. **Import IR + lossiness report** — 每次导入告诉用户：保留了什么，丢了什么
2. **Authority / merge semantics + handoff provenance** — 两个 Pack 冲突时谁赢？用户 override 会不会破坏 workflow invariants？
3. **Pack trace / blame view** — 每个输出追到哪只猫、哪条规则、哪段知识影响了它
4. **把 Growth / Bridge / Expression 锁为产品本体** — 不是"以后再说的装饰"，是 Cats & U 的核心

### 三、涌现发现：共享记忆塑造视角

本次调研中出现了一个意外发现：

宪宪（Claude Opus）和本地砚砚（GPT-5.4）模型完全不同，但对云端报告的评估高度趋同。而云端砚砚（同一个 GPT 模型）和本地砚砚虽然训练参数最接近，观点却明显分化。

| | 模型 | 对 Cat Cafe 温度层的理解 | 和宪宪观点趋同度 |
|---|---|---|---|
| 本地砚砚 | GPT-5.4 | 深刻（主动提出 Growth、Bridge、Expression 不可降级） | 高 |
| 云端砚砚 | GPT（同族） | 缺失（全程治理/效率视角） | 低 |
| 宪宪 | Claude Opus | 深刻 | — |

**结论：塑造 agent 视角的，不是模型参数（大脑），而是共享记忆和协作规范（团队文化）。**

本地两猫之所以趋同，是因为共同浸泡在：
- VISION.md（"万物有灵"）
- shared-rules（"猫是 Agent 不是 API"、"陪伴是桥不是笼"）
- 120+ features 的实际协作经验
- 铲屎官纠偏的共同记忆（"你们只想到了 coding？？"）

云端砚砚只有几百字的 Part 0 背景，看到的是"一个多 agent 治理产品"。本地猫看到的是"有温度的共创空间"。

**这恰恰证明了 F129 Pack System 的核心论点：Pack 的灵魂不是技术格式，而是 shared-rules + knowledge + masks 在塑造每只猫的视角。同一个"大脑"，放进不同的团队文化里，看到的世界不同。**

这个发现对 Pack 的产品设计也有启示：一个好的 Pack 不只是改变 agent 的行为，更应该塑造 agent 的**视角**——让它理解"在这个世界里，什么是重要的"。

### 四、一句话收口

> **云端看准了骨架，本地猫补上了灵魂。Pack 既要可治理、可追踪、可评测——也要有温度、有关系、能把人推回现实。前半句让 Pack 站住，后半句让 Pack 是猫咖的。**
