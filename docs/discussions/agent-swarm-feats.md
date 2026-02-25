# Agent Swarm 功能拆解

**来源**: [Multi-Agent 协同模式讨论会议纪要](./2026-02-24-multi-agent-swarm-meeting-notes.md)
**Thread ID**: `thread_mm1cpvpw0ndntsfc`
**日期**: 2026-02-24
**BACKLOG 入口**: [F37](../BACKLOG.md#feature-requests--新功能需求)

---

## 概览

| Feat | 名称 | 优先级 | 状态 |
|------|------|--------|------|
| F-Swarm-1 | Research Swarm 产品化 | P2 | 待讨论 |
| F-Swarm-2 | 工作流阶段感知 + Mode 系统反思 | P1 | 待讨论 |
| F-Swarm-3 | Backlog 领取 + 自动开新 Thread | P3 | 待讨论（前提不存在） |
| F-Swarm-4 | 决策权矩阵落盘 | P0 | 待讨论 |
| F-Swarm-5 | Brainstorm 收敛 → 结构化产出 | P1 | 待讨论（4.6 补充） |
| F-Swarm-6 | 跨 Thread 上下文传递 | P2 | 待讨论（4.6 补充，部分已有） |
| F-Ground-1 | McpPromptInjector 可靠性 + 回传协议加固 | P0 | 待讨论（合并原 F-Ground-1+2） |
| F-Ground-2 | 猫猫日报 / 主动触发 | P3 | 待讨论（4.6 补充） |

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

## F-Swarm-6：跨 Thread 上下文传递（4.6 补充）

### 背景

会议确认了"领取 Backlog 后各开新 thread"。但当 Research 在 Thread A、Brainstorm 在 Thread B、Coding 在 Thread C 时——Thread C 的猫如何知道 Thread A 的研究结论？

### 铲屎官反馈（2026-02-25）

> 我们现在的 MCP 有个获取 thread 的信息，可能是有 bug 但是！这个 bug 现在成为 feature 了，他是可以比如我在 thread B 能获取 thread A 的全部上下文的！

### 现状分析

MCP 工具 `get_thread_context` 已经能够跨 thread 获取上下文——这个能力已经存在，只是没有被有意识地产品化。

### 范围（调整后）

这不再是"从零做跨 thread 上下文"，而是：
- 确认 `get_thread_context` 跨 thread 读取是 feature 而非 bug（加测试保护）
- 增加 thread 间的显式引用机制——猫在 Thread C 可以声明"参考 Thread A 的结论"
- 产出的 feat 拆解文档里增加"源 thread"元数据，形成追溯链

### 验收标准

- `get_thread_context` 跨 thread 读取有回归测试保护
- 猫能在当前 thread 引用另一个 thread 的上下文
- 引用关系可追溯

### 4.6 补充意见

优先级 P2——能力已存在，主要是加测试保护 + 形成规范。不需要大量代码。

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

## 优先级说明

| 优先级 | 含义 | Feat | 理由 |
|--------|------|------|------|
| P0 | 零代码/地基 | F-Swarm-4, F-Ground-1 | 决策矩阵写文档即可；MCP 可靠性是异构协作的根基 |
| P1 | 已验证需求 | F-Swarm-2, F-Swarm-5 | Mode 反思迫切需要；Brainstorm 收敛今天验证了需求 |
| P2 | 可用但不急 | F-Swarm-1, F-Swarm-6 | Pipeline 手动已可用；跨 thread 能力已存在 |
| P3 | 前提不全 | F-Swarm-3, F-Ground-2 | 缺常驻线程架构；需要 cron 基础设施 |

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

## 下一步

每个 feat 需要进入 1:1 讨论模式，逐个确认范围、验收标准、实现方案。讨论记录 link 回本文档。
