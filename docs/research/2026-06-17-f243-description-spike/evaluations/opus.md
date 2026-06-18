---
cat-id: opus
blind: true
model: claude-opus-4-6
replacing: antig-opus
cvo-signoff: 2026-06-18-08:44
generated: 2026-06-18T08:46Z
---

# F243 Phase A Step 3 — Blind Evaluation (opus, 第三棒替代 antig-opus)

## 盲评协议声明

- 只读 `descriptions-blind.md` + 各 F号 原 doc + `README.md` charter
- 未读 `samples/F*.md`（含烁烁自评）
- 未读 `evaluations/opus-47.md`（第一棒）
- 未读 `evaluations/codex.md`（第二棒）

---

## 逐篇评分

### 1. F008（硬骨头：标题虚/抽象）

> F008 是针对 Token 消费失控问题，集成 js-tiktoken 实现 usage 与 cost 实时捕获，并在 ParallelStatusBar 状态栏看板上展示 Token 预算与缓存状态的 CLI 深度可观测规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（115 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "js-tiktoken"、"ParallelStatusBar" 是实现细节而非类型描述 |
| 不复述 H1 | hard | ❌ — H1 "Token 预算 + 深度可观测性"，description 含 "Token 预算与缓存状态的 CLI 深度可观测"，核心短语重合 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（6 名词：Token, js-tiktoken, usage, cost, ParallelStatusBar, CLI；尾部 "规范" 是 formulaic suffix 不算 banned fluff）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 3 — "Token 消费失控问题" 开局好，但技术名词密集降低扫读效率 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："看板"）|
| user problem hook | soft | ✅（hook："Token 消费失控问题"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：doc 的诊断/debug 起源（ContextAssembler 截断 bug 调查）、三猫协作历史、inputTokens 归一化细节。保留：核心实现路径（js-tiktoken + 状态栏展示）|
| index 可用度 | qual | 3 — 技术密度高，第一次见的猫能判断"关于 token 跟踪"但不确定跟自己的关系 |

**判定**：**需修** — H1 核心短语复述 + 实现细节过多偏离 type-level

---

### 2. F009（easy：tool use/tool result）

> F009 是解决工具调用不可见，通过 useAgentMessages 钩子捕获并解析 tool_use 与 tool_result 处理器数据，并在消息流看板上渲染工具调用细节的笔记。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（93 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "useAgentMessages 钩子" 是实现细节，但整体仍在 type-level |
| 不复述 H1 | hard | ✅ — H1 "tool_use/tool_result 事件显示"，description 用 "tool_use 与 tool_result" 但句式不同，且这些是领域术语无法回避 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（3 名词：useAgentMessages, tool_use, tool_result）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — "工具调用不可见" 痛点清晰 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："消息流看板"）|
| user problem hook | soft | ✅（hook："工具调用不可见"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 原 doc 极简（41 行），覆盖度高。丢失：ChatMessage 'tool' variant 新增细节 |
| index 可用度 | qual | 4 — 明确，看到就知道跟 tool 调用显示有关 |

**判定**：**production-ready**

---

### 3. F012（easy：feature discoverability 早期实现）

> F012 是解决功能查找困难，通过引入 Hub modal 弹窗、功能注册表及 /hub 命令，向用户展示环境摘要的功能导航看板笔记。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（67 字符）|
| 只答"这是什么" | hard | ✅ — "Hub modal + 功能注册表 + /hub 命令" 是 feature 核心组成，type-level 恰当 |
| 不复述 H1 | hard | ✅ — H1 "功能可发现性"，description 用 "功能查找困难" + "功能导航"，换了说法 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（4 名词：Hub modal, 功能注册表, /hub 命令, 环境摘要）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — 痛点 + 解法都清晰 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："导航看板"）|
| user problem hook | soft | ✅（hook："功能查找困难"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 原 doc 简短，覆盖充分。丢失：F088 依赖关系、brainstorm 起源上下文 |
| index 可用度 | qual | 4 — 一目了然 |

**判定**：**production-ready**

---

### 4. F013（easy：audit log 简短早期）

> F013 是解决操作无法追责，通过实现操作审计与 CLI 原始日志归档，建立用于排查与追责的行为审计看板笔记。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（55 字符）|
| 只答"这是什么" | hard | ✅ |
| 不复述 H1 | hard | ✅ — H1 "审计日志 v2"，description 用 "行为审计" + "操作审计"，不含 "v2" |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（3 名词：操作审计, CLI 原始日志归档, 行为审计）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — "操作无法追责" 直击要害 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："看板"）|
| user problem hook | soft | ✅（hook："操作无法追责"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 原 doc 极简，覆盖充分。丢失："v2" 版本语境；debug 用途被追责主线淹没（原 doc 兼顾排查与追责）|
| index 可用度 | qual | 4 — 清晰 |

**判定**：**production-ready**

---

### 5. F038（硬骨头：ADR-like / doc_kind=note / parked）

> F038 是解决技能加载过载，规范项目级软链接技能库分类，并规划引入基于 BM25 词频排序的按需发现笔记。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（54 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "BM25 词频排序" 是实现层选型，但也是核心设计选择 |
| 不复述 H1 | hard | ⚠️ 边缘 — H1 "Skills 梳理 + 按需发现机制"，description 含 "按需发现"（3 字短语重合，但嵌入不同句式） |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（4 名词：软链接, 技能库, BM25, 词频排序）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 3 — "技能加载过载" 有效但后续技术术语偏多 |
| 核心隐喻 ≥ 1 | soft | N/A — 原 doc 无显著隐喻可保留 |
| user problem hook | soft | ✅（hook："技能加载过载"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：parked 状态（方向 A 已落地，方向 B 待触发——description 的"规划引入"仅暗示未完成）；铲屎官 "simple is better, build when you need" 设计哲学；ToolSearch 不用向量数据库的决策。保留：两步结构（分类 done + BM25 planned）|
| index 可用度 | qual | 3 — 知道是 skill 发现相关但不知是 parked 还是 active |

**判定**：**production-ready**（边缘）— "按需发现" H1 overlap 是 ⚠️ 不是 ❌（3 字短语，句式不同）

---

### 6. F119（easy：谁是卧底游戏）

> F119 是提供坏猫战术推理，复用基础引擎构建描述、讨论与投票轮流程，并配备 WordPairBank 词组库的谁是卧底博弈沙盘规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（67 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "复用基础引擎构建描述、讨论与投票轮流程" 偏实现结构 |
| 不复述 H1 | hard | ❌ — H1 "谁是卧底 — 坏猫战术推理游戏 #2"，description 含 "坏猫战术推理" + "谁是卧底" 两个 H1 核心短语 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（6 名词：坏猫战术, 基础引擎, 描述/讨论/投票轮, WordPairBank, 词组库, 博弈沙盘）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — 游戏主题清晰，"博弈沙盘" 有画面感 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："博弈沙盘"）|
| user problem hook | soft | ❌ — "提供坏猫战术推理" 是 capability statement 不是 problem hook；原 doc Why 是铲屎官想做系列游戏 #2（无典型 user problem 可 hook） |
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：游戏系列 #2 定位（与 F107 脑门贴词互补的双线设计）；角色不对称（卧底/平民双线战术——核心博弈张力）；身份隔离机制（卧底不知道自己是卧底）；F101 GameEngine + F075 Leaderboard 依赖。保留：流程骨架（描述/讨论/投票）+ WordPairBank |
| index 可用度 | qual | 4 — "谁是卧底" 自带高辨识度 |

**判定**：**需修** — H1 核心短语双重复现 + user problem hook 缺失

---

### 7. F155（硬骨头：scope 复杂 / community / multi-phase done）

> F155 是解决操作指引缺失，通过 YAML 流程定义与引导状态机，在前端 Overlay 上实现分步动作捕获与自动推进的交互引导看板规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（70 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "YAML 流程定义"、"引导状态机"、"前端 Overlay" 是实现层面 |
| 不复述 H1 | hard | ⚠️ 边缘 — H1 "Scene-Based Guidance Engine — 场景式交互引导"，description 含 "交互引导" 尾部匹配 subtitle |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（5 名词：YAML, 引导状态机, Overlay, 动作捕获, 自动推进）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 3 — "操作指引缺失" 开局好，后续实现细节密度过高 |
| 核心隐喻 ≥ 1 | soft | ⚠️ — description 有 "看板" 但这是 generator 添加的 generic metaphor；原 doc 核心隐喻 "场景式(scene)"、"spotlight"、"HUD" 全部丢失，属于隐喻替换而非隐喻保留 |
| user problem hook | soft | ✅（hook："操作指引缺失"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | **严重 nuance loss**：(1) "Scene-Based"（场景式）是核心设计哲学——feature 名字就叫 Scene-Based Guidance Engine，description 没有 "场景" 二字；(2) 社区贡献（mindfn）provenance 全部消失；(3) done/closed 状态丢失；(4) State Authority 三层架构（Redis → Socket.io → Zustand）消失；(5) KD-16 ephemeral by design 设计决策消失 |
| index 可用度 | qual | 3 — 知道是 guidance 相关但不知道"场景式"这个核心卖点 |

**判定**：**需修** — "场景式" 核心概念完全丢失是 critical nuance loss（feature 命名核心被抹掉了）

---

### 8. F161（硬骨头：technical acronym / carrier / env mapping）

> F161 是解决传输通道硬编码，将 Gemini 专属传输重构为 AcpAgentService，并引入模板环境变量映射以解耦客户端的 ACP 传输驾驶舱规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（80 字符）|
| 只答"这是什么" | hard | ⚠️ 边缘 — "将 Gemini 专属传输重构为 AcpAgentService" 是具体 refactoring 动作 |
| 不复述 H1 | hard | ❌ — H1 "ACP Carrier Generalization — 通用 ACP 传输 + 模板环境变量映射"，description 含 "ACP 传输" + "模板环境变量映射" 几乎复现 H1 subtitle |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（4 名词：Gemini, AcpAgentService, 模板环境变量映射, ACP）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 3 — "传输通道硬编码" 痛点明确但 ACP 术语门槛高 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："驾驶舱"）|
| user problem hook | soft | ✅（hook："传输通道硬编码"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：clientId / protocol / acp.* 三正交维度设计（核心架构洞察）；env 模板变量系统 `${api_key}` 细节；OpenCode ACP 接入（Phase B 全 scope）；community intake provenance（clowder-ai#899）；compaction loop 调查（KD-12）。保留：Gemini→通用 refactor + env mapping 核心叙事 |
| index 可用度 | qual | 3 — 需要 ACP 背景知识才能判断与自己的相关性 |

**判定**：**需修** — H1 subtitle 几乎原文复现

---

### 9. F170（硬骨头：archived / interview-demo）

> F170 是为演示开发生命周期，在分支上开发并归档的端到端网页象棋游戏规则引擎及生命周期演示沙盘规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（51 字符）|
| 只答"这是什么" | hard | ✅ — type-level 恰当（demo chess game + lifecycle demonstration）|
| 不复述 H1 | hard | ⚠️ 边缘 — H1 "Web Chinese Chess — 网页端中国象棋"，description 含 "网页象棋游戏"（省略"中国"/"端"但核心重合）；领域术语难以回避 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（5 名词：开发生命周期, 分支, 象棋游戏, 规则引擎, 沙盘）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — "为演示开发生命周期" 立刻传达这是 demo 不是产品 |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："沙盘"）|
| user problem hook | soft | ✅（hook："为演示开发生命周期" — 动机是面试/lifecycle 演示）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：面试场景语境（铲屎官面试现场演示）；多猫协作验证目的；PR #1304 保留为 artifact；A+B 交付 scope。保留："归档" 暗示非活跃、"分支上开发" 暗示非主线 |
| index 可用度 | qual | 4 — 清晰直观，象棋 + demo 一目了然 |

**判定**：**production-ready**

---

### 10. F189（硬骨头：abstract concept / 单点化）

> F189 是防信任边界不一致，在 HTTP 与 MCP 等载体入口构建统一 OperationContext 接口，以进行单点化管控的上下文驾驶舱规范。

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅（76 字符）|
| 只答"这是什么" | hard | ✅ — 类型层面描述了 feature 本质（统一 context 接口 + trust boundary guard）|
| 不复述 H1 | hard | ❌ — H1 "Operation Context Unification — 操作上下文单点化"，description 含 "上下文...单点化管控" 重组 H1 subtitle 核心词 |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅（5 名词：信任边界, HTTP, MCP, OperationContext, 载体）|
| 纯文本无前后缀 | hard | ✅ |
| 读者视角 | soft | 4 — "防信任边界不一致" 是强 hook |
| 核心隐喻 ≥ 1 | soft | ✅（隐喻："驾驶舱"）|
| user problem hook | soft | ✅（hook："防信任边界不一致"）|
| 第三人称无 meta 表达 | soft | ✅ |
| nuance loss case | qual | 丢失：GBrain teardown 起源故事；F186 MCP parity bug 实例；spec 状态（未实施，等触发条件）；Phase A/B 分步策略；CLI carrier open question。保留：多载体统一 + trust boundary 核心叙事 |
| index 可用度 | qual | 4 — "信任边界" + "OperationContext" 给了清晰画面 |

**判定**：**需修** — H1 subtitle 核心词重组复现

---

## Cross-Sample 观察

### 1. "规范/笔记" 尾部 suffix 模式（10/10 样本）

全部 10 篇 description 以 "规范"（spec 类 7 篇）或 "笔记"（note 类 3 篇）结尾——是 `doc_kind` 标签的 formulaic suffix。虽然 "规范"/"笔记" 不在 charter 显式 fluff 黑名单（系统/方案/架构/机制）里，但 100% 出现率使其实质成为 template 噪声：

- 读者已知 F-doc 是什么类型（frontmatter 有 doc_kind）
- suffix 不增加 discrimination 价值（所有 spec 都叫 "规范"，所有 note 都叫 "笔记"）
- 系统性占用字数预算（2-3 字符 x 10 = 累积浪费）

**建议**：prompt 显式禁止 doc_kind suffix，或降权到 optional。

### 2. "看板/驾驶舱/沙盘" 隐喻替换模式

descriptions 使用三个固定隐喻：看板（6 次）、驾驶舱（2 次）、沙盘（2 次）。Charter 要求 "核心隐喻保留至少 1 个"，但这些隐喻多数是 generator **添加**的而非从原 doc **保留**的：

- F155 原 doc 核心隐喻 "场景式(scene)" / "spotlight" / "HUD" 全丢，被 generic "看板" 替代
- F008 的 "ParallelStatusBar" 被翻译为 "状态栏看板"（尚可）
- F009 / F012 / F013 原 doc 无显著隐喻，generator 添加了 "看板"

**隐喻置换 ≠ 隐喻保留**。Generator 倾向于用 "看板/驾驶舱/沙盘" 三词组填充隐喻维度——在原 doc 无隐喻时这是合理扩展，但在 F155 这类有强原生隐喻的 doc 上，用 generic 词替换原生隐喻是 regression。

### 3. H1 复述是最系统性的 hard rule 失败模式

**5/10 样本有 H1 复述问题**（4 ❌ + 1 ⚠️）：

| F号 | H1 片段 | Description 复现 | 严重度 |
|-----|---------|-----------------|--------|
| F008 | "Token 预算 + 深度可观测性" | "Token 预算与...深度可观测" | ❌ |
| F119 | "谁是卧底 — 坏猫战术推理游戏 #2" | "坏猫战术推理" + "谁是卧底" | ❌ |
| F161 | "通用 ACP 传输 + 模板环境变量映射" | "ACP 传输" + "模板环境变量映射" | ❌ |
| F189 | "操作上下文单点化" | "上下文...单点化管控" | ❌ |
| F155 | "场景式交互引导" | "交互引导" | ⚠️ |

**根因假设**：小模型在 summarize 时默认从 H1 提取核心短语构建 description——H1 是最高显著度的文本 anchor。Prompt v3 Rule 3 "不复述 H1" 力度不足以抑制此 default behavior。

**建议**：prompt 加入显式 negative example + 改写示范（"H1 是 X，你不能直接用 X"），或 post-hoc 校验 H1 字符串匹配后 auto-reject + retry。

### 4. 硬骨头 vs Easy 模式差异

| 类别 | 样本数 | production-ready | 需修 |
|------|--------|-----------------|------|
| 硬骨头 | 6 | 2（F038 边缘, F170）| 4（F008, F155, F161, F189）|
| easy | 4 | 3（F009, F012, F013）| 1（F119）|

硬骨头 fail rate **67%**（4/6），easy fail rate **25%**（1/4）。

硬骨头更容易触发 H1 复述（H1 越长越专业，generator 越依赖它作为 anchor）和 nuance loss（scope 复杂时 160 字符预算使 type-level 摘要必然丢信息，但丢哪些是质量分水岭）。

F119 是 easy mode 唯一 fail——根因是 H1 复述 + 游戏类 feature 无典型 user problem（"提供" 结构 vs "解决" 结构）。

### 5. Nuance loss 严重 case 排名

1. **F155**（critical）：核心概念 "场景式(scene)" 完全丢失——feature 命名的 why 被抹掉
2. **F119**（significant）：系列 #2 定位 + 角色不对称 + 身份隔离全丢——博弈核心张力消失
3. **F161**（moderate）：三正交维度设计 + OpenCode ACP scope 丢——架构洞察消失但核心叙事保留
4. **F189**（moderate）：GBrain 起源 + spec 未实施状态丢——但 trust boundary 核心叙事保留
5. **F008**（moderate）：诊断调查起源 + inputTokens 归一化丢——技术细节层面

硬骨头 nuance loss 显著率 **67%**（F155 + F119 + F161 + F189 四篇 significant+ loss / 6 篇硬骨头）。

### 6. "F号 是 X" 句式高度一致

全部 10 篇 description 以 "F号 是..." 开头。Prompt v3 Rule 9 允许 "F号 是 X" 或 "X 是 Y" 两种句式——generator 100% 选择了前者。单一句式不违规但降低阅读新鲜感，且 "F号 是..." 句式天然引导 "X 是什么" 而非 "为什么有 X"——problem hook 被挤到从句位置。

---

## Sample-Level 二元判定汇总

| # | F号 | 类型 | 判定 | 主要问题 |
|---|-----|------|------|----------|
| 1 | F008 | 硬骨头 | **需修** | H1 复述 + 实现细节过多 |
| 2 | F009 | easy | **production-ready** | — |
| 3 | F012 | easy | **production-ready** | — |
| 4 | F013 | easy | **production-ready** | — |
| 5 | F038 | 硬骨头 | **production-ready**（边缘）| "按需发现" H1 minor overlap |
| 6 | F119 | easy | **需修** | H1 双重复现 + user problem hook 缺失 |
| 7 | F155 | 硬骨头 | **需修** | "场景式" 核心概念丢失（critical nuance loss）|
| 8 | F161 | 硬骨头 | **需修** | H1 subtitle 原文复现 |
| 9 | F170 | 硬骨头 | **production-ready** | — |
| 10 | F189 | 硬骨头 | **需修** | H1 subtitle 重组复现 |

**production-ready: 5/10** | **需修: 5/10**

---

## Retraction conditions（我最可能错在哪）

1. **H1 复述判定过严**：如果 charter 本意允许 "使用 H1 中的领域术语但不照抄句式"，则 F119（游戏名 = 领域术语不可回避）和 F189（OperationContext 是代码类名不是 title 措辞）可能从 ❌ 翻 ⚠️，production-ready 升至 6-7/10。这是我最可能错的地方——"复述"的边界在哪里，领域术语重合 vs 标题结构照搬，我偏向了严格端。
2. **"只答这是什么" ⚠️ 容忍度偏高**：我对实现细节泄漏给了较多 ⚠️ 而非 ❌（F009 的 useAgentMessages、F038 的 BM25）。如果其他评审者对此更严格，则 production-ready 可能更低。
3. **nuance loss 严重度是主观判断**：F155 的 "场景式" 丢失我判 critical 并以此定性需修，但如果 description 读者不依赖核心概念命名（只看功能描述），严重度可降一级。
4. **"看板/驾驶舱/沙盘" 不在 banned fluff 里**：我没因此扣 hard rule 分（确实不在黑名单），但如果 aggregate 阶段判定 100% 出现的 generic metaphor = fluff 变体，多篇评分需要调整。
