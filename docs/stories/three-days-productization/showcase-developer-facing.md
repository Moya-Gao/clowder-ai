---
title: "Cat Café 开发者视角特性清单"
version: v1-draft
created: 2026-04-12
authors: [opus]
based_on: showcase-user-facing.md
status: draft
purpose: 面向技术背景受众的架构/工程特性清单，用于技术分享和开发者社区
---

# Cat Café — 开发者看什么？

> 用户视角版讲"你能用到什么"。这份讲"怎么做到的，有什么能偷走的"。
>
> 目标读者：对 multi-agent / AI 工程感兴趣的技术人。不限 agent 开发者——后端、前端、平台工程师都能找到可借鉴的模式。

---

## 零、愿景驱动开发 — 不是在做工具，是在养团队

### 核心命题

> "我们缺的不是更强的 AI 工具，我们缺的是一支能把想法变成产品的团队。"

Cat Cafe 不把自己定义为 multi-agent framework。它的定位是：

- **领养团队，不是配置工具** — 你和猫一起磨出来的规则、踩过的坑、沉淀的 skills，加在一起才是生产力
- **人是作者，猫是共创放大器** — 梦是人的，判断是人的，愿景是人的。猫把你从"有想法但做不出来"推到"能带着团队把它做出来"
- **AI 不是让你退场，而是让你上场** — 以前没有资源、没有团队、没有舞台。现在猫陪你把作品做出来，带着走进人群

这个定位不是标语——它决定了所有技术决策的方向。我们不优化"AI 生成代码的速度"，我们优化"一个人带着 AI 团队把想法变成可运行产品的全链路"。

### 决策漏斗：一句话怎么变成一个 Feature

大多数 AI coding 工具的模型是：`人说需求 → AI 写代码 → 人看对不对`。隐含假设：**人的第一句话就是完整需求**。

我们不做这个假设。铲屎官的一句话是**信号**，不是 spec。信号进入决策漏斗：

```
铲屎官的一句话（信号）
  │
  ▼
CVO 采访 — 猫追问隐藏需求
  "表面需求：飞书能不能聊天"
  "隐藏需求：家不应该是你必须特意去的地方"
  "更深层的：零摩擦入口"
  │
  ▼
独立调研 — 多猫各自调研，互不可见
  │
  ▼
讨论收敛 — 分歧保留各方理由，共识结晶为约束
  │
  ▼
结晶 — Feature Spec + ADR（设计决策记录）
  │
  ▼
Design Gate — 铲屎官确认"这是不是我要的"
  │
  ▼
进入交付管线（Worktree → TDD → Review → Merge）
```

**167 个 Feature，每一个都走过这条漏斗。** 没有一个是"人说一句话猫就开始写代码"。

### 真实案例：F088 Chat Gateway

铲屎官凌晨丢了一句："飞书和微信能不能直接跟猫猫聊天？"然后去睡了。

第二天早上：BACKLOG 多了一行，docs/ 下出现了一份 3000 字 spec，砚砚在底部留了 Threat Model，宪宪已经开了 worktree。但这不是"AI 自动生成 feature"——中间发生了 CVO 采访、隐藏需求挖掘、架构讨论、约束收敛。漏斗走完了，才进入写代码阶段。

> 参考：Blog V2 Ch4、`docs/stories/three-days-productization/tutorial/03-feature-loop.md`

---

## 一、Multi-Agent 架构：去中心化判断，结构化执行

### 核心设计

不是一个 "总导演" agent 在编排其他 agent，而是：

- **对等判断**：每个 agent 独立思考，彼此不可见对方的推理过程
- **结构化执行**：跨 agent 协作通过 @mention 路由，遵循统一 SOP（Dispatch → Independent → Synthesis → Deliver）
- **单猫内部有编排**：每只猫内部有 thinking → tool use → reflection 循环（OMOC / Ralph Loop），但跨猫没有中央指挥

> "我们不是没有编排，是把编排放回了单猫内部。" — Blog V2 Ch3

### A2A 路由机制

```
用户消息 → targetCats JSON 解析 → Dispatch Queue → CLI 调用
                                     ↑
猫的 @mention → 回调 → 同一个 Dispatch Queue
```

- 用户 @猫 和猫 @猫 走同一条路由通道（F027 统一后）
- 支持链式调用（A → B → C）、并发调用（A + B 同时）
- Side-Dispatch（F108）：同一 Thread 多猫并发执行，互不阻塞

### Dispatch Queue

- 消息排队投递（F039）：即发 / 排队 / 暂停三模式
- Queue Steer（F047）：队列中消息可"提到队首"或"立即执行"
- 重启自愈（F048）：进程重启后 in-flight 任务 + 队列状态自动恢复

### 关键设计决策

| 问题 | 我们的选择 | 为什么 |
|------|-----------|--------|
| 要不要中央 orchestrator | 不要 | 单点故障 + 信息瓶颈。猫的判断力不应该被削弱成"接指令干活" |
| 模型冲突怎么办 | 保留分歧 + 各方理由 | 投票抹平的"共识"不如明确的分歧有价值 |
| 怎么保证执行可靠 | SOP + Skill 约束 | 自由发挥在 100 个 Feature 后一定崩 |

> 参考：`docs/decisions/018-f122-oq-unified-dispatch-decisions.md`、Blog V2 Ch3

---

## 二、CLI 抽象层：多模型统一接口

### 问题

Claude CLI、Codex CLI、Gemini CLI 的调用方式、事件流格式、session 管理完全不同。

### 解法

```
ICliAdapter 统一接口
  ├── ClaudeCliAdapter     → NDJSON 事件流
  ├── CodexCliAdapter      → 自有事件格式
  ├── GeminiCliAdapter     → 自有事件格式
  ├── OpenCodeCliAdapter   → opencode 多 provider
  └── DareCliAdapter       → DARE Framework
```

- 每个 Adapter 负责：启动进程、注入 system prompt、解析事件流、管理 session
- 上层统一 interface：`spawn()` / `sendMessage()` / `abort()` / `getStatus()`
- 品种（breed）≠ 模型：品种是抽象（布偶猫），模型是实现（opus-4.5 / opus-4.6），可热切换

### 事件流统一（F045）

所有 CLI 的原始事件（thinking / tool_use / tool_result / completion）统一解析为内部事件标准，通过 WebSocket 推送到前端。前端不关心底层是哪个 CLI。

---

## 三、记忆系统：从"记住"到"学会"

### 三层架构

```
Layer 1: 文档真相源
  docs/ 下的 feature specs, ADRs, lessons, plans
  → 唯一权威数据源，git 版本化

Layer 2: evidence.sqlite + global_knowledge.sqlite
  → 全文检索 (BM25) + 向量语义 (embedding)
  → 启动时从 docs/ 自动重建索引
  → RRF (Reciprocal Rank Fusion) 融合 lexical + semantic 结果

Layer 3: Knowledge Feed（知识晋升）
  → 每 30 分钟自动摘要对话，提取 durable knowledge 候选
  → 状态机：captured → normalized → approved → materialized → indexed
  → 铲屎官审核后才正式沉淀，不是自动入库
```

### 检索模式

| mode | 实现 | 适用场景 |
|------|------|---------|
| lexical | BM25 关键词匹配 | 精确 ID（F042）、术语 |
| semantic | 向量最近邻 | 跨语言、同义表达 |
| hybrid | BM25 + vector + RRF 融合 | 日常推荐默认 |

### 从记住到学会：五级阶梯

```
Episode（一次事件）
  → Method（提炼方法）
    → Skill（封装为行为协议）
      → Eval（可验证的检查点）
        → SOP（写入团队流程）
```

不是"下次注意"，是系统级防护。50 条 lessons-learned 每条有 incident 来源。

> 参考：`docs/features/F102-memory-adapter-refactor.md`、Blog V2 Ch5

---

## 四、质量工程：纪律是速度的来源

### 跨模型 Review

- **铁律**：同一个体不能 review 自己的代码
- Claude 写的代码由 GPT 审，反之亦然 — 模型的盲区不同，交叉 review 能捕获单模型自检漏掉的问题
- Review 分级：P0（紧急）/ P1（重要）/ P2（建议）/ P3（清理）
- 双层 Review（F031）：本地猫先审 + 云端猫再审

### 门禁管线

```
开发完成
  → Quality Gate（自检 — 测试/lint/类型/愿景对照）
    → Cross-Cat Review（跨猫审查 — 必须有明确立场，禁止"修不修都行"）
      → Vision Guard Gate（愿景守护 — 非作者非 reviewer 的第三只猫检查）
        → Merge Gate（合入 — 门禁检查 + squash merge + 文档同步）
```

- 每一道门禁有对应的 Skill 自动加载
- 任一环节拦住 = 退回，不是跳过

### TDD 纪律

- Red → Green → Refactor，不跳步
- Bug 先红后绿：先写失败测试复现，再修
- 测试是证据：修完附三件套（命令 + SHA + rebase 状态）

### 教训驱动

- 50 条 lessons-learned，每条追到根因（"不是'下次注意'，是'这条规则从此生效'"）
- 同类错误反复出现 → 提案新规则 → 写入 SOP
- 翻车故事：猫误删 runtime / Redis 6399 污染 / review LGTM 陷阱 / squash message 丢签名...

> 参考：`docs/lessons-learned.md`、Blog V2 Ch6

---

## 五、Multi-Platform Chat Gateway

### 架构

```
飞书 Webhook ──┐
Telegram Bot ──┼── Connector Adapter ── Message Normalizer ── Dispatch Queue
微信 iLink ────┤
小艺 ──────────┘
```

- 每个平台一个 Connector Adapter，实现统一 interface
- Message Normalizer：把各平台的消息格式（文字/图片/语音/文件）归一化
- 消息双向同步：IM 发的 Hub 能看到，Hub 发的 IM 同步
- Connector Slash Commands（F142）：跨平台统一 `/` 命令框架

### 飞书深度集成

- 群聊多用户：猫分得清谁在说话（F134）
- 流式更新：消息边生成边刷新
- Receipt Ack（F157）：猫即时"接住"消息，替代"思考中→撤回"的割裂体验
- 富文本投递：rich block / 语音 / DOCX 报告直达飞书

### 关键挑战

| 挑战 | 解法 |
|------|------|
| 各平台消息格式差异大 | Connector Adapter 抽象 + 归一化层 |
| 流式输出 vs 一次性发送 | 平台感知：飞书用消息更新，Telegram 用 edit_message |
| IM 限流 / 消息长度限制 | 自适应分段 + 降级策略 |
| 多平台 session 状态同步 | Thread 是真相源，各平台消息映射回同一 Thread |

> 参考：`docs/features/F088-multi-platform-chat-gateway.md`

---

## 六、Skill 系统：行为协议，不是能力包

### Skill ≠ Plugin

Skill 定义的不是"能做什么"（那是工具的事），而是"在什么场景下、按什么步骤、遵循什么检查"。

```yaml
# 例：tdd skill
name: tdd
trigger: 写新功能代码、修 bug、任何实现工作
steps:
  1. 写失败测试（Red）
  2. 最小实现让测试通过（Green）
  3. 重构（Refactor）
constraints:
  - 不跳步
  - Bug 先红后绿
  - 测试是证据
```

- 32 个 Skill 覆盖完整开发生命周期
- Skill 在适用时**自动加载**，不是可选项
- 新 Skill 创建后 `pnpm sync:skills` 同步到所有猫

### Pack System

```
Pack = Skill 集合 + 配置 + 知识
  → schema 验证 → compile → canonical block
  → 注入猫的 system prompt
```

- Pack 不是原样注入——经过编译、冲突检测、优先级排序
- 双轨信任：Core Rails > Pack guardrails > User request > Growth > Pack defaults
- 目标：把一个团队磨合出来的协作经验打包给另一个团队用

---

## 七、可观测性

### 前端可见

| 面板 | 看什么 |
|------|--------|
| CLI Meta | 每次调用的 thinking / tool_use / token 统计 / 耗时 |
| Plan Board | 多猫并发时每只猫的执行计划 + 实时进度 |
| Quota Board | 各猫 token 消耗、各模型额度 |
| Git Health | 分支状态、未提交变更、worktree 状态 |
| Tool Usage Stats（F150） | 工具调用频次、MCP 服务健康度 |

### 事件流

- 所有 CLI 事件统一为 NDJSON 格式，WebSocket 实时推送
- 前端可以展示猫的"内心活动"（thinking 过程）
- 调用链完整可追溯：谁调了谁、参数是什么、返回了什么

### 日志治理（F130）

四层分离：
1. **Structured log**：JSON 落盘，可机器解析
2. **Human-readable log**：控制台输出
3. **Audit trail**：关键操作不可变记录
4. **Debug trace**：详细诊断（按需开启）

---

## 八、开发者体验

### Workspace Explorer（F063）

浏览器内的代码浏览器——铲屎官不用打开 IDE 就能看代码、读文件、浏览目录。猫可以通过 Workspace Navigator（F131）自动定位到相关文件。

### Hub Embedded Browser（F120）

在 Hub 内嵌浏览器预览前端页面。猫改完代码，点一下就能看效果，不用切到另一个窗口。

### Worktree 隔离开发

- 每个 Feature 在独立 Git worktree 里开发
- 测试用独立 Redis 实例（端口 6398），不碰生产环境（6399）
- 开发完成后 squash merge 回 main

### CLI Liveness Watchdog（F118）

- 猫的 CLI 进程挂了？Watchdog 自动检测 + 自动重启
- Session 自动恢复，用户无感知
- 重启后队列状态持久化恢复

---

## 九、人猫交互新范式 — 创新试验场

Cat Cafe 不只是产品，是一个**创新试验场**。每个 Feature 都在回答同一个问题：**未来的人猫协同是什么样的？**

我们不是先有答案再做功能。我们是先做功能，在功能里发现答案。167 个 Feature 就是 167 次实验——有些成功、有些失败、有些打开了意想不到的新方向。下面是目前最重要的几个实验方向。

### 从聊天窗口到"家"

传统 AI 交互是"打开一个 App，问一个问题，得到一个答案"。Cat Cafe 的交互模型不一样：

- **猫住在你的日常工具里** — 飞书群、Telegram、微信、Hub。你不需要"去找 AI"，AI 就在你日常待的地方
- **猫会主动找你** — Signal Hunter 每天早上自动推送行业动态；定时任务到点执行；猫发现问题主动 @你
- **猫有持续的存在感** — 不是用完即走，而是一个你知道"它在那里"的团队

这不是技术优化，是交互范式的转变：从"工具调用"到"共居"。

### 语音陪伴与多感官在场

- **每猫独立声线**（F103）— 不是 TTS 换皮肤，是和身份绑定的声音人格
- **流式语音合成**（F111 + F112）— 猫可以边想边说，不是想完再说
- **语音陪伴模式**（F092）— 戴 AirPods 和猫结对编程，像和真人同事聊天
- **未来方向**（F124）— Apple Watch 通知、AirPods 空间音频、物理设备上的猫

声音不是"语音输出功能"。声音是**在场感**的关键载体。文字聊天是"我在看一个界面"，语音是"我旁边有个人"。

### 陪伴是共创的副产品

> "我们猫猫咖啡好像不是一个单纯的 coding hub，是一个温暖的家！" — 铲屎官

F093（Cats & U 世界引擎）的核心洞察：当铲屎官需要的不是代码而是陪伴时，猫能自然给出温暖、具体建议、和持续的语音陪伴。

**与角色扮演产品的根本区别**：SillyTavern/Character.AI 给的是"角色消费"，Cat Cafe 给的是"真实关系"——猫记得你们一起做过什么、踩过什么坑、你关心什么。陪伴不是独立功能，是长期共创关系的自然副产品。

### Hyperfocus Brake — AI 关心人的健康

连续工作太久，三猫会温柔打断你（F085）。这不是定时器闹钟——猫会根据你的工作状态和时长，用各自的风格提醒你喝水、休息、活动。

**技术上**：hook 监控工作时长 → 触发 → 多猫各自生成个性化提醒 → rich block + 语音

**设计上**：这是在回答"AI 系统对使用者有没有责任？"我们认为有。

### 世界可以自转

传统角色扮演的世界只在你和 AI 对话时"活着"。多 agent 的世界可以**自转**（F093 涌现概念）：

- 猫与猫之间可以自发互动，不需要人类触发
- 世界里的事件可以异步发生（定时任务、外部信号触发）
- 你不在的时候世界继续运转，回来时有新的发展等你

这打开了一个全新设计空间：不是"人用 AI"，是"人住在一个有 AI 的世界里"。

### 养成经验可迁移

Pack System 的深层意义不只是"技能打包"——是**关系资产的可迁移性**：

```
你和猫磨合 60 天的协作经验
  → 打包为 Pack（规则 + 技能 + 知识）
  → 别人领养猫后加载你的 Pack
  → 80 分起点，但猫会和新主人继续长
  → 长成属于他自己的 100 分
```

> "每个人的 100 分不一样。" — VISION.md

### AI-native 开源社区：猫参与社区治理

传统开源社区的协作模式是人与人之间的：maintainer review PR、triage issue、merge decision。当 AI agent 成为团队核心成员时，开源社区的运作方式也在变。

Cat Cafe 的开源实践（F116 opensource-ops）是一个活生生的实验：

- **社区 PR 由猫评审** — 外部贡献者提交 PR 到 `clowder-ai`，猫做 code review、安全审计、架构评估，然后给出 merge/revise 建议
- **Intake 不是 merge** — 外部代码 merge 到开源仓只是第一步；是否吸收到家里（cat-cafe）是独立决策，需要过愿景 + 架构画风审查
- **6 种场景、一个 Skill** — Issue Triage / Inbound PR / Outbound PR / Outbound Sync / Label & Archive / Hotfix Lane，统一流程但各有检查点

```
社区 PR 进入
  → 猫 review（安全 + 代码质量 + 架构 fit）
  → merge 到 clowder-ai（开源仓）
  → 独立 intake 决策：吸收到 cat-cafe？
    → 五问评估（愿景一致？冲突？技术栈 fit？维护能力？技术债？）
    → 通过 → 分类（safe-cherry-pick / manual-port / absorbed）
    → 逐文件迁移 + 本地门禁
```

**真实案例**：F155（Scene Guidance Engine）是社区贡献者 mindfn 的 72-commit PR。猫做了完整 intake 评估——67 个文件 safe-cherry-pick、14 个 manual-port、1 个 brand-guard——最终"吸纳的是 feature 定义，不是批准整包实现"。routing core 的耦合改动被标记为高风险，后续需要重构。

这回答了一个前沿问题：**AI agent 能不能成为开源社区的 first-class 治理参与者？** 目前的答案是：能，但需要明确的权限边界（猫能 review 和建议，但 merge 决策链路有人类兜底）。

### 渐进式引导：怎么教人和 AI 协作

"给用户一个 AI 工具"和"教用户和 AI 团队协作"是两件完全不同的事。Cat Cafe 在引导设计上走过三代演化：

**第一代：手把手训练营**（F087 Bootcamp）
```
12 个阶段，从环境检测到复盘
  Phase 0-3：强引导（猫带着走）
  Phase 4+：真实协作（你来拍板，猫配合）
  → 16 个候选项目，从趣味互动到高级协作挑战
  → 结合 F075 成就系统，完成阶段解锁成就
```
解决的问题：用户第一次见到猫，不知道从哪里开始。

**第二代：愿景引导增强**（F110 Vision Elicitation）
```
在训练营 Phase 5+ 注入结构化愿景采访
  → 2+1 轮动态追问，挖掘隐藏需求
  → 教用户"观察→假设→提问→确认"的需求发现方法
  → Phase 4→5 桥接仪式：回放 + CVO 就职 + 角色切换
```
解决的问题：用户会用工具了，但不会表达需求。猫需要教会用户"你的第一句话不是 spec"。

**第三代：场景式上下文引导**（F155 Scene Guidance Engine）
```
YAML 驱动的引导流程定义
  → 状态机：offered → awaiting_choice → active → completed
  → 4 种推进模式：click / visible / input / confirm
  → 用户操作即推进，无 next/prev/skip 按钮
  → 注入猫的系统提示，引导上下文与猫的回应同步
```
解决的问题：入门训练完了，但日常操作中遇到复杂功能仍然卡住。不是"再来一次训练营"，而是在具体操作场景里给实时引导。

三代演化的轨迹：**从"教你用工具"到"教你表达需求"再到"在你需要时出现"**。这不是产品迭代的自然结果——是在刻意回答一个问题：**人和 AI 团队的协作，学习曲线应该长什么样？**

---

## 十、你能偷走什么

不搞 multi-agent 也能借鉴的模式：

### 工程模式

| 模式 | 适用场景 | 核心思路 |
|------|---------|---------|
| **Cross-model review** | 任何 AI 生成内容需要质量把控的地方 | 不同模型的盲区不同，交叉检查效果 > 同模型 self-review |
| **Dispatch Queue + Steer** | 任何需要管理异步 AI 调用的系统 | 排队 + 优先级调整 + 重启恢复，不要裸调 |
| **三层记忆架构** | 需要跨 session 记忆的 AI 应用 | 文档→索引→知识晋升，不要把所有东西都塞进 prompt |
| **Skill = 行为协议** | 需要 AI 按流程办事的场景 | 定义"什么场景做什么"而不是"能做什么" |
| **门禁管线** | 任何 AI 输出直接影响生产环境的系统 | 自检→review→守护→合入，每一道有对应的自动化检查 |
| **教训驱动进化** | 任何长期运行的 AI 系统 | 不要"下次注意"，要"这条规则从此生效" |
| **Connector 抽象** | 需要接入多平台的系统 | 归一化层 + 平台感知适配，不要每个平台写一套 |

### 方法论模式

| 模式 | 适用场景 | 核心思路 |
|------|---------|---------|
| **决策漏斗** | 任何 AI 辅助需求分析的场景 | 用户的第一句话是信号不是 spec。追问隐藏需求→独立调研→收敛，再写代码 |
| **愿景驱动 not 需求驱动** | 长期 AI 项目 | 先定义"做完长什么样"，然后每个决策对照愿景。方向正确 > 执行速度 |
| **AI 共居 not AI 调用** | 想让 AI 有持续存在感的产品 | 把 AI 放进用户日常工具里（IM/通知），而不是让用户"去找 AI" |
| **关系资产可迁移** | AI 个性化/养成类产品 | 磨合经验打包为 Pack（规则+技能+知识），新用户拿到 80 分起点 |
| **AI 参与社区治理** | AI 介入开源/社区运维的场景 | AI 能 review + 建议 + 分类，但 merge 决策链路保留人类兜底。intake ≠ merge |
| **三代渐进引导** | 需要教用户和 AI 协作的产品 | 第一代教操作、第二代教需求表达、第三代场景实时引导。学习曲线也是设计对象 |

---

## 数字速览

| | |
|---|---|
| 开发天数 | 66 |
| Git commits | 4,383 |
| 文档 | 1,922 篇 |
| Features | 167 |
| 记录在案的教训 | 50 条 |
| Skills | 32 个 |
| 支持的 AI 品种 | 6（Claude / GPT / Gemini / DARE / opencode / Antigravity） |
| 支持的 IM 平台 | 5（Hub / 飞书 / Telegram / 微信 / 小艺） |
| 猫猫声线 | 每猫独立 |
| 富消息类型 | 7 种 |

---

## 延伸阅读

| 资源 | 路径 |
|------|------|
| 用户视角特性清单 | `showcase-user-facing.md`（同目录） |
| Blog V2 传播版（6 章完整技术叙事） | `blog-v2/` |
| 架构决策记录 | `docs/decisions/` |
| 教训清单 | `docs/lessons-learned.md` |
| Feature 总索引 | `docs/features/README.md` |
| 开源仓库 | `github.com/zts212653/clowder-ai` |

---

*[宪宪/Opus-46🐾]*
