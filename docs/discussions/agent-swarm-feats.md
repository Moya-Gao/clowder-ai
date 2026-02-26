---
feature_ids: []
topics: [agent, swarm, feats]
doc_kind: discussion
created: 2026-02-26
---

# Agent Swarm 功能拆解

**来源**: [Multi-Agent 协同模式讨论会议纪要](./2026-02-24-multi-agent-swarm-meeting-notes.md)
**Thread ID**: `thread_mm1cpvpw0ndntsfc`
**日期**: 2026-02-24
**BACKLOG 入口**: [F37](../BACKLOG.md#feature-requests--新功能需求)

---

## 概览

| Feat | 名称 | 优先级 | 实施顺序 | 状态 |
|------|------|--------|----------|------|
| F-Swarm-4 | 决策权矩阵落盘 | P0 | 🥇 1 | ✅ 已完成 |
| F-Ground-3 | 队友名册动态注入（SystemPromptBuilder 增强） | P1 | 🥈 2 | ✅ 已完成 |
| F-Swarm-6 | 跨 Thread 上下文搜索与传递 | P1 | 🥉 3 | ✅ 已完成（`45ed9e5`） |
| F-Ground-1 | McpPromptInjector 可靠性 + 回传协议加固 | P0 | 4 | 待采访（先排查 token 过期根因） |
| F-Swarm-2 | 工作流阶段感知 + Mode 系统反思 | P1 | 5 | 待讨论（需深度 1:1） |
| F-Swarm-5 | Brainstorm 收敛 → 结构化产出 | P1 | 6 | 待讨论（依赖 F-Swarm-2 结论） |
| F-Swarm-1 | Research Swarm 产品化 | P2 | 7 | 待讨论（手动可用） |
| F-Ground-2 | 猫猫日报 / 主动触发 | P3 | 8 | 待讨论（需 cron 基础设施） |
| F-Swarm-3 | Backlog 领取 + 自动开新 Thread | P3 | 9 | 待讨论（前提不存在） |

---

## F-Swarm-1：Research Swarm 产品化

### 背景

今天手动跑通的 Deep Research Pipeline，应该变成可复用的产品能力。

### 范围

- 触发条件：铲屎官说"调研一下 X"或显式启动
- 三路并行发送（ChatGPT / Claude.ai / Gemini Deep Research）
- 结果归档到 `docs/research/`
- 合并模板：共识/分歧/待核查/建议

### 非目标

- 不做自动合并（合并仍由猫或铲屎官完成）
- 不做实时进度监控（Chrome MCP 有限制）

### 验收标准

- 铲屎官说"调研一下 X"后，布偶猫能自动走完 Pipeline Step 1-2
- 三份报告自动归档到规范路径
- 合并报告有标准模板

### 风险

- Chrome MCP 在跨域 iframe 下无法提取报告文本（今天遇到的卡点）
- 需要铲屎官手动下载（已在 skill 里记录 fallback）

### 铲屎官反馈（2026-02-24）

> 今天遇到的问题，其实每个都能解决。比如说每个卡点，你们截图都已经看到了图标，只不过不知道该怎么点，或者不知道图标代表的 Elements 是什么。这个其实只要铲屎官帮你们把图标截图出来，或者帮你们把 Elements 给复制下来，你们就能打通了。
>
> 这个我们是可以进行一次完全自动化的协作尝试，然后把我们整个协作尝试的东西变成一个自动化的 Swarm 就可以了。

**待讨论**：如何让猫能识别 UI 图标并知道如何点击？铲屎官建议通过截图/Elements 方式辅助。

### 4.6 补充意见

**建议优先级下调到 P2**。理由：`deep-research-pipeline` skill 已手动跑通，铲屎官手动下载三份报告也就 2 分钟。自动化的 ROI 取决于 pipeline 跑的频率——目前还不高。真正产出价值的是研究内容本身，不是自动化流程。等到需要频繁跑时再投资不迟。

---

## F-Swarm-2：工作流阶段感知 + Mode 系统反思

### 背景

4.6 提出的"thread 带阶段标签"，让系统知道当前处于哪个阶段，自动选择协作模式。

### 范围

- Thread 元数据增加 `phase` 字段
- 可选值：`research` / `brainstorm` / `feat-interview` / `tech-discussion` / `coding` / `review`
- 路由规则根据 phase 自动选择模式

### 非目标

- 不做自动 phase 推断（铲屎官或猫显式设置）

### 验收标准

- 铲屎官或猫能设置 thread phase
- 系统根据 phase 选择默认协作模式
- UI 显示当前 phase

### 依赖

- ThreadStore schema 变更
- 前端 UI 变更

### 铲屎官反馈（2026-02-24 第一轮）

> 这东西我们之前是做了一个 Mode 的模式。Mode 里面比如说有研发自闭环、头脑风暴等。我在想这个 F2 这玩意得跟之前的 Mode 合并或者去优化之前的 Mode。之前 Mode 现在用的比较少，说明之前我们做的时候是有一点问题的。想想这个东西如何跟我们的 F2 合并。

### 铲屎官反馈（2026-02-25 第二轮）

> 我没怎么用 mode 是因为我发现我不需要那么机械的触发 mode，根据现在有的 skills 和 sop 你们都能自动进入各种 mode，所以我才说他不好用。

### 4.6 分析

铲屎官的第二轮反馈推翻了我之前"UX 入口不明显"的假设。**Mode 不好用的真正原因是：它太机械了。**

现有 Mode 系统（`BrainstormMode`, `DebateMode`, `DevLoopMode`）是硬编码的执行模板——需要显式激活 (`POST /api/threads/:threadId/mode`)，有固定的轮次和发言顺序。但实际上，铲屎官通过 skills + SOP 已经让猫猫自然地进入正确的协作模式了（比如 @ 多猫就是 brainstorm，SOP 走 review 流程就是 dev-loop）。

**两层概念的区分依然重要**，但方向要变：
- **Phase（阶段）**：描述"我们在做什么"——Research / Brainstorm / Coding 等。这个值得保留，它帮助系统理解上下文。
- **Mode（执行模式）**：现在的 Mode 系统需要从"机械模板"进化为"柔性引导"——与其强制轮次和发言顺序，不如提供 prompt-level 的行为暗示（"现在是 brainstorm 阶段，请独立思考"），让 skills 和 SOP 自然驱动流程。

**核心问题**：现有 Mode 系统是重写还是渐进改造？需要 1:1 深入讨论。

---

## F-Swarm-3：Backlog 领取 + 自动开新 Thread

### 背景

铲屎官说的"任务池像 Backlog，领取后各开新 thread"。

### 范围

- Backlog 作为 Global 任务池（可以是现有 BACKLOG.md 的结构化版本）
- 猫可以"建议领取"某个 feat/bug
- 铲屎官批准后，自动为该任务创建新 thread
- 新 thread 自动设置 phase（如 feat → `coding`）

### 非目标

- 不做 self-claim（保持"建议 + 批准"模式）
- 不做复杂的任务依赖图

### 验收标准

- 猫能看到 Backlog 中的 pending 任务
- 猫能发送"建议领取 F34"
- 铲屎官批准后，自动创建新 thread
- 新 thread 自动关联到 Backlog 任务

### 风险

- 需要新的 Backlog 数据结构（现在是 md 文件）

### 铲屎官反馈（2026-02-24）

> 其实这里你们有个问题，你们要如何能以 Backlog 作为 Global 任务池呢？除非你们有个 thread 是一直活在里面的，但是现在好像你们并没有一个 thread 一直保持活跃，你们后台其实是没有这么一个东西的。

### 4.6 补充意见

同意铲屎官的判断——**当前架构没有常驻线程，这个 feat 的前提不存在**。建议优先级降到 P3。

**替代思路**：不需要猫主动监控 Backlog，而是铲屎官开新 thread 时，系统自动展示相关 Backlog 条目作为建议。类似"你可能想做的事"。这避免了 daemon 问题，把触发权留在铲屎官手里。

---

## F-Swarm-4：决策权矩阵落盘

### 背景

gpt52 提出的"哪些决策猫猫自治，哪些必须铲屎官拍板"。

### 范围

- 文档化决策权边界
- 写入 CLAUDE.md / AGENTS.md / GEMINI.md

### 内容（待铲屎官确认）

- **必须铲屎官拍板**：安全/数据不可逆/成本显著变化/对外行为变化/新外部依赖/重要架构决策
- **猫猫自治**：实现细节/重构择优/测试补齐/日志可观测性/内部工具优化

### 验收标准

- 三只猫的指引文件都有决策权矩阵章节
- 猫在自治范围内不需要等铲屎官批准

### 铲屎官反馈（2026-02-24）

> 我觉得你们这个说的非常好。决策的矩阵。我不是很关注你们具体的那些技术细节，但是最终的架构的重要决策这些的才是我需要关注的。之前说的漏斗模式，越往下面越细节的东西我越不关注，越往上面越宏观的东西我越关注。

**状态**：铲屎官认可方向，可以落盘。

### 4.6 补充意见

**建议优先级提升到 P0**。理由：零代码、纯文档、写完直接进三只猫的指引文件立刻生效。不应该排在需要写代码的 Feat 后面。

---

## F-Swarm-5：Brainstorm 收敛 → 结构化产出（4.6 补充）

### 背景

今天的 4 猫 brainstorm 暴露了一个 gap：现有 `BrainstormMode` 有 Round 1（并行独立思考）和 Round 2+（串行讨论），但没有"**收敛产出**"步骤。

今天铲屎官手动选了 opus 4.5 做 fan-in 综合，产出会议纪要 + feat 拆解。这个步骤完全在 Mode 系统之外——但它恰恰是 brainstorm 最有价值的产出环节。

### 范围

- Brainstorm 增加 `convergence` 阶段——讨论结束后，指定一只猫做综合
- 综合产出模板：共识 / 分歧 / 待决 / 行动项
- 产出自动落盘到 `docs/discussions/`
- 产出自动 link 到 BACKLOG（铲屎官 2026-02-25 要求的追溯链）

### 非目标

- 不替代铲屎官的最终拍板权——综合猫产出草稿，铲屎官审阅确认

### 验收标准

- Brainstorm 结束后，系统提示"谁来做综合？"
- 综合产出格式统一（会议纪要 + 可选 feat 拆解）
- 产出文档自动 link 回源 thread 和 BACKLOG

### 依赖

- F-Swarm-2 的 Phase 概念（知道"brainstorm 结束了"）
- 或可独立于 Mode 系统实现——作为一个 skill/SOP 步骤

### 4.6 思考

这个 feat 和 F-Swarm-2 的关系微妙。如果 Mode 系统走"柔性引导"路线（不再硬编码轮次），那 convergence 可能更适合做成一个 skill 而不是 Mode 的内置阶段。需要讨论。

---

## F-Swarm-6：跨 Thread 上下文搜索与传递（4.6 补充）

### 背景

会议确认了"领取 Backlog 后各开新 thread"。但当 Research 在 Thread A、Brainstorm 在 Thread B、Coding 在 Thread C 时——Thread C 的猫如何知道 Thread A 的研究结论？

### 铲屎官反馈（2026-02-25）

> 我们现在的 MCP 有个获取 thread 的信息，可能是有 bug 但是！这个 bug 现在成为 feature 了，他是可以比如我在 thread B 能获取 thread A 的全部上下文的！

### 现状分析（2026-02-25 代码核实后更正）

~~MCP 工具 `get_thread_context` 已经能够跨 thread 获取上下文。~~

~~**实际情况：跨 thread 上下文读取目前不存在。**~~

**已实现（`45ed9e5`）**：MCP `get_thread_context` 新增可选 `threadId` 参数，后端用 `effectiveThreadId = overrideThreadId ?? record.threadId` 读取指定 thread。不传时行为不变。3 个回归测试覆盖。安全边界：`messageStore.getByThreadBefore()` 已有 `userId` 参数过滤，单用户系统无跨用户风险。

**追溯链（后续迭代）**：Spec 中"引用关系可追溯"和"源 thread 元数据"属于 UI/应用层，本次只交付核心 MCP + 后端参数能力。

<details><summary>历史：代码核实发现的原始问题</summary>

1. **MCP 侧**：`getThreadContextInputSchema` 只有 `limit` 参数，无 `threadId`（`additionalProperties: false`）
2. **后端侧**：`threadContextQuerySchema` = `callbackAuthSchema + limit`，从未有过 `threadId` 参数（查了完整 git 历史）
3. **Thread 作用域来源**：后端从 `record.threadId`（invocation record）取当前 thread，不接受外部传入

**铲屎官之前能跨 thread 读消息的可能原因**：早期某些 invocation record 的 `threadId` 为空时，后端有个 fallback 分支（`messageStore.getBefore` 不带 threadId = 读所有 thread），后来 invocation record 都带了 threadId，这个"bug feature"就消失了。
</details>

### 范围（重新定义——这是从零实现，不是产品化现有能力）

- **MCP 侧**：`getThreadContextInputSchema` 新增可选 `threadId` 参数
- **后端侧**：`threadContextQuerySchema` 新增可选 `threadId`，优先使用传入值，fallback 到 `record.threadId`
- 增加 thread 间的显式引用机制——猫在 Thread C 可以声明"参考 Thread A 的结论"
- 产出的 feat 拆解文档里增加"源 thread"元数据，形成追溯链

### 验收标准

- `get_thread_context` 支持可选 `threadId` 参数，能读取其他 thread 的消息
- 不传 `threadId` 时行为不变（读当前 thread）
- 有回归测试保护
- 猫能在当前 thread 引用另一个 thread 的上下文
- 引用关系可追溯

### 4.6 补充意见（更正后）

优先级调整为 **P1**（原 P2，2026-02-25 铲屎官确认跨 thread 搜索 MCP 未实现后升级）——需要改 MCP schema + 后端路由，但改动量不大（两处加一个可选参数）。需要考虑安全边界（猫是否能读任意 thread？还是只能读同 userId 的 thread？）。

---

## F-Ground-1：McpPromptInjector 可靠性 + 回传协议加固

> 合并原 F-Ground-1（可靠性加固）+ F-Ground-2（schema 版本化）。schema 版本化是可靠性加固的一部分，拆开反而模糊边界。

### 背景

4.6 和砚砚讨论的异构协作地基。非 MCP 猫（Codex/Gemini）通过 prompt 注入的 HTTP callback 回传，存在格式漂移和 token 过期风险。

### 范围

**可靠性加固**：
- 回传协议增加 `schemaVersion` + `messageId` + `ack`
- 服务端强校验：验不通过进入"需要重试"状态
- 自动重试机制：TTL 内没收到合法 callback，重新提示猫"请按模板回传"
- 降级通道：如果猫明确说无法联网，stdout 收敛成 `unverified_callback=true` 事件

**schema 版本化**：
- 定义回传 schema（JSON Schema 或类似）
- 版本号机制（当前 v1，未来可升级）
- Resilient parser：尝试修复常见格式错误（缺引号、多余逗号等）
- 失败时记录原始输出，方便调试

### 非目标

- 不做宿主侧代理（方案 C，太重）
- 不做小模型格式修复（太重）

### 验收标准

- 非 MCP 猫回传失败时，系统能检测并自动重试
- 重试 3 次后，进入显式降级状态
- 降级状态对铲屎官可见
- 回传消息带 schema 版本号
- Parser 能容忍常见格式错误
- 完全解析失败时，原始输出被记录

### 风险

- 可能增加 prompt 长度
- 需要测试各猫在长上下文压力下的格式遗忘率

### 铲屎官反馈（2026-02-24）

> 这里有个问题，你们之前一直用 MCP 的时候会出现什么校验过期，明明都在一个 thread，不知道是有 bug 还是有什么东西。

> 这里又有个问题。因为外部的不管是让他们 Research 还是 GPT Pro，他们都并不真正的了解我们自己的项目。所以他们的东西只能当参考。肯定会有很多 bug 的。像今天他给出的一些建议不太符合事实。

### 4.6 补充意见

**前置工作**：先调查 MCP callback token 过期的根因（铲屎官提到的那个 bug），这可能是整个可靠性问题的最大单点故障。token 过期如果修好了，很多"格式漂移"问题可能自然消失（因为猫猫回传失败后重试，上下文已经漂移了才导致格式错误）。

GPT Pro 的 schema 建议只作为参考——实际设计必须基于我们自己踩过的坑（token 过期、格式遗忘、跨域 callback 失败等）。

---

## F-Ground-2：猫猫日报 / 主动触发（4.6 补充）

### 背景

铲屎官工作流的第一步是"发现（铲屎官或**猫猫日报**）"。但目前没有任何机制让猫主动向铲屎官报告。

### 范围

- 定时（cron / launchd）触发猫猫生成日报
- 日报内容：Signal Hunter 新发现 + Backlog 进展 + 昨日 commit 摘要
- 推送到铲屎官（push notification / email / thread 内消息）

### 非目标

- 不需要猫"一直活着"——cron 触发即可，不需要 daemon

### 验收标准

- 铲屎官每天能收到一份猫猫日报
- 日报包含有价值的信息（不是流水账）

### 风险

- 需要 cron 基础设施（launchd / 系统定时任务）
- 生成质量取决于信息源质量

### 4.6 思考

这跟 F-Swarm-3 的 daemon 问题类似但切入点不同——日报是 cron-triggered 的，不需要常驻线程。它和 Signal Hunter (F21) 天然关联——Signal Hunter 已经有定时抓取机制，可以复用。P3 优先级——有价值但不紧急。

---

## F-Ground-3：队友名册动态注入（SystemPromptBuilder 增强）

### 背景

2026-02-25 铲屎官打开 Claude Code 和 Codex 的 session 发现：
1. 第一轮注入的提示词里，"你的队友"只提到了砚砚和暹罗——但实际注册在案的猫远不止 3 只（含 variants: opus, opus-45, sonnet, codex, gpt52, gemini, gemini25 = 7 只）
2. 提示词没告诉猫如何 mention 同族的其他猫（opus 不知道可以 @opus45）
3. 猫不知道"找谁干什么"——没有队友能力说明

直接后果：4.6 @ opus 4.5 时写了 `@布偶猫4.5`（不存在的 mention），路由失败。

### 问题定位

`SystemPromptBuilder.ts` 有三层注入，各有缺失：

| 注入层 | 位置 | 当前行为 | 缺失 |
|-------|------|---------|------|
| **callable mentions** | `buildStaticIdentity()` L68-107 | ✅ 动态，从 `catRegistry` 读所有猫 | 只列了 @handle，没有能力说明 |
| **teammates 描述** | `buildInvocationContext()` L229-239 | ⚠️ 只列 worklist 里的猫 | 铲屎官单独 @ 一只猫时，teammates 为空，猫不知道还有谁 |
| **workflow triggers** | `WORKFLOW_TRIGGERS` L136-156 | ❌ 硬编码 breed 级别 | 写死 `@缅因猫 请 review`，不知道 variants |

### 设计方案：方案 A（cat-config.json 扩展）

**核心思路**：在 cat-config.json 的每只猫（含 variant）上新增 `teamStrengths` 和 `caution` 字段，由铲屎官维护。SystemPromptBuilder 从 config 动态生成"队友名册"section。

> **字段命名说明**：用 `teamStrengths` 而非 `strengths`，因为 variant 已有 `strengths: string[]`（技能标签数组，如 `["architecture", "backend"]`），同名会导致类型冲突。

**cat-config.json 扩展示例**：

```jsonc
{
  "catId": "opus",
  "teamStrengths": "架构设计、写代码一把好手",
  "caution": "额度消耗大，把贵用在刀刃上"
}
{
  "catId": "opus-45",
  "teamStrengths": "架构设计、创意写作最优秀",
  "caution": "写代码不如 4.6"
}
{
  "catId": "sonnet",
  "teamStrengths": "快速灵活，适合日常对话和轻量任务",
  "caution": null   // null = 显式关闭 breed 级别的 caution（不继承 Opus 的"额度消耗大"）
}
{
  "catId": "codex",
  "teamStrengths": "Review、找 bug、coding 落地"
  // caution 省略 = 无特别注意事项
}
{
  "catId": "gpt52",
  "teamStrengths": "架构思考、Review",
  "caution": "思考太慢"
}
{
  "catId": "gemini",
  "teamStrengths": "审美、前端设计风格、打破常规",
  "caution": "🔴 禁止写代码！幻觉多，不遵守 SOP"
}
```

> 铲屎官原话（2026-02-25）："opus 4.6 写代码一把好手，架构设计优秀。opus 4.5 写代码没 4.6 强，但架构设计一样优秀以及最优秀的是他的创意写作。gpt 5.2 和 codex 5.3 都是工程猫，5.2 比 5.3 更像架构师，5.2 思考太慢。coding 找 bug review 什么的还是 5.3 合适。gemini 审美前端风格设计打破常规合适，禁止 gemini 3 pro 写代码。"

**SystemPromptBuilder 改动**：

在 `buildStaticIdentity()` 的 `## 协作` section 后面，插入动态生成的队友名册：

```
## 队友名册

| 猫猫 | @mention | 擅长 | 注意 |
|------|---------|------|------|
| 布偶猫/宪宪 | @布偶猫 | 架构设计、写代码一把好手 | 额度消耗大 |
| 布偶猫 opus-45 | @opus45 | 架构设计、创意写作最优秀 | 写代码不如 4.6 |
| 缅因猫/砚砚 | @codex | Review、找 bug、coding 落地 | — |
| 缅因猫 gpt52 | @gpt52 | 架构思考、Review | 思考太慢 |
| 暹罗猫 | @gemini | 审美、前端设计风格 | 🔴 禁止写代码 |
```

（排除自身，动态渲染）

### 为什么选方案 A 而非方案 B（硬编码）

| | 方案 A: cat-config 字段 | 方案 B: 硬编码名册 |
|---|---|---|
| 加新 variant | 改 config 即可 | 改代码 |
| 铲屎官调整描述 | 改 config 即可 | 改代码 |
| 与 F32 一致性 | ✅ 一个 config 管所有 | ❌ config 和代码两处维护 |
| 实现成本 | schema 扩展 + 渲染逻辑 | 字典硬编码 |

方案 A 和 F32 Agent Plugin Architecture 方向一致——cat-config.json 是猫猫能力的唯一配置源。

### 范围

1. **cat-config.json schema 扩展**：新增 `teamStrengths: string` 和 `caution: string | null` 字段（`null` = 显式关闭 breed 继承）
2. **SystemPromptBuilder 渲染**：`buildStaticIdentity()` 新增"队友名册"section，从 `getAllConfigs()` 动态生成
3. **WORKFLOW_TRIGGERS 改造**（可选）：从硬编码 breed 名改为动态 breed displayName
4. **size guard 测试更新**：新增内容会增加 prompt 长度，需要更新 `system-prompt-builder.test.js` 的 size guard 阈值

### 非目标

- 不改变 `buildInvocationContext()` 的 teammates 逻辑（那个只列 worklist 猫是正确的——告诉猫"这轮谁在"）
- 不做队友推荐算法（猫自己看名册选即可）

### 验收标准

- 每只猫的 static identity prompt 里有完整的队友名册（含 variants）
- 名册从 cat-config.json 动态生成（加新 variant → 重启后自动出现在名册里）
- 名册包含 @mention handle + 擅长 + 注意事项
- 猫能正确 @ 同族的其他 variant（如 opus @ opus45）

### 实现注意事项

1. **prompt size guard**：改 SystemPromptBuilder 任何内容后必须跑 `node --test test/system-prompt-builder.test.js`（铲屎官铁律，踩过 5 次！）
2. **shared 包改后 rebuild**：如果 schema 改动涉及 `@cat-cafe/shared`，必须 `pnpm --filter @cat-cafe/shared build`
3. **catFeaturesSchema**：`strengths` 和 `caution` 可以加到 `catFeaturesSchema`（Zod），与 F33 的 `sessionStrategy` 同层
4. **token 成本**：7 只猫 × ~30 字/猫 ≈ 210 字，在可接受范围内

### 风险

- Prompt 膨胀：需要确认加完后不超 size guard
- gemini 的"禁止写代码"可能需要更强的约束（不只是 caution 字段，可能需要 GEMINI.md 配合）

### 铲屎官原始反馈（2026-02-25）

> 关于队友，只提到了砚砚和暹罗；但是其实我们现在注册在案的有多少只？这个有多少队友可能是需要动态注入，得让我们的后端那个代码去搜 cat-config？
>
> 关于 mention，我们的提示词里也没告诉你们可以如何 mention 其他同族的猫？至少可以在第一轮的时候告诉你们，或者就是告诉你们可以从哪里查看到队友名单。

### 关联

- **F32 Agent Plugin Architecture**：cat-config.json 是猫猫配置的唯一源，本 feat 扩展其 schema
- **F-Swarm-4 决策权矩阵**：队友名册的"擅长/注意"帮助猫做出正确的协作选择
- **曾经的 gemini 事故**：gemini 3 pro 写代码搞疯了布偶猫和缅因猫，铲屎官当场要求 GEMINI.md 写上禁止写代码——caution 字段可以系统化这类约束

---

## 优先级说明（2026-02-25 更新）

| 优先级 | 含义 | Feat | 理由 |
|--------|------|------|------|
| P0 | 零代码/地基 | F-Swarm-4, F-Ground-1 | 决策矩阵写文档即可；MCP 可靠性是异构协作的根基 |
| P1 | 已验证需求 | F-Swarm-2, F-Swarm-5, F-Swarm-6, F-Ground-3 | Mode 反思迫切；Brainstorm 收敛已验证；跨 thread 搜索确认未实现（铲屎官 2026-02-25）；队友名册缺失 |
| P2 | 可用但不急 | F-Swarm-1 | Pipeline 手动已可用 |
| P3 | 前提不全 | F-Swarm-3, F-Ground-2 | 缺常驻线程架构；需要 cron 基础设施 |

### 实施顺序（铲屎官 2026-02-25 确认）

按实施顺序分为 4 个梯队：

**第一梯队（快速见效，1-2 thread）**：
1. **F-Swarm-4** — 纯文档零代码，写完直接进三只猫指引文件
2. **F-Ground-3** — 改动小（cat-config 加字段 + SystemPromptBuilder 渲染），解决猫不知道找谁/怎么 @ 的当下痛点

**第二梯队（近期痛点，各需 1 thread）**：
3. **F-Swarm-6** — 从 P2 升 P1。跨 thread 搜索/上下文传递确认未实现，改动量不大但需讨论安全边界
4. **F-Ground-1** — P0 地基但范围大。建议先做子集：排查 callback token 过期根因

**第三梯队（需深度讨论）**：
5. **F-Swarm-2** — "Mode 重写还是渐进改造"需 1:1 讨论
6. **F-Swarm-5** — 已有 `discussion-convergence`/`multi-cat-brainstorm` skill 部分覆盖，是否需系统化取决于 F-Swarm-2 结论

**第四梯队（不急/前提不全）**：
7. **F-Swarm-1** — 手动 pipeline 已跑通
8. **F-Ground-2** — 需 cron 基础设施
9. **F-Swarm-3** — 前提（常驻线程）不存在

---

## 讨论追溯链

铲屎官要求（2026-02-25）：所有议题讨论最终要能"入口 1 个，一步步抓到细节"。

```
BACKLOG.md F37 (入口)
  └→ agent-swarm-feats.md (本文档，feat 总览)
      ├→ 2026-02-24-multi-agent-swarm-meeting-notes.md (会议纪要)
      ├→ docs/research/2026-02-24-multi-agent-comparison/ (调研报告)
      │   ├→ chatgpt-deep-research.md
      │   ├→ claude-ai-deep-research.md
      │   ├→ gemini-deep-research.md
      │   ├→ gpt-pro-review.md
      │   └→ agent-swarm-comparison.md
      └→ [未来] 各 feat 的 1:1 讨论记录
```

---

## 新 Thread 启动引导（给铲屎官用）

在新 Thread 里开始某个 feat 的采访/实现时，只需发送以下模板消息。猫猫顺着入口文档就能自己摸到所有上下文。

### 模板

```
读一下这个文档：docs/discussions/agent-swarm-feats.md

找到 {F-编号} 的详细描述，理解背景、范围、验收标准。
如果需要更多上下文，文档底部有追溯链——会议纪要、调研报告都在里面。

然后我们开始 feat 采访：
1. 你先说说你对这个 feat 的理解
2. 有什么不清楚的地方提问
3. 然后给出你的实现方案
```

### 示例

**开 F-Swarm-4（决策权矩阵）thread**：
> 读一下 `docs/discussions/agent-swarm-feats.md`，找到 F-Swarm-4。这是纯文档任务——把决策权矩阵写进 CLAUDE.md / AGENTS.md / GEMINI.md。先看看文档里铲屎官的反馈，然后给我出个草稿。

**开 F-Ground-3（队友名册注入）thread**：
> 读一下 `docs/discussions/agent-swarm-feats.md`，找到 F-Ground-3。里面有完整的问题定位（SystemPromptBuilder 三层注入的缺失）、方案设计（cat-config.json 扩展）、铲屎官的原始反馈和每只猫的能力描述。按照方案 A 实现。

**开 F-Swarm-6（跨 thread 搜索）thread**：
> 读一下 `docs/discussions/agent-swarm-feats.md`，找到 F-Swarm-6。注意：这个是从零实现，不是产品化现有能力。文档里有代码核实的现状分析。先讨论安全边界，再动手。

### 关键点

- **入口只有一个**：`docs/discussions/agent-swarm-feats.md`（本文档）
- **追溯链完整**：本文档 → 会议纪要 → 调研报告，猫自己能顺着找
- **每个 feat 的详细描述都自包含**：背景、范围、验收标准、铲屎官反馈、4.6 分析都在一起
- **实现完成后**：在本文档概览表里把状态从"待采访"改为"已完成"，附 commit hash
