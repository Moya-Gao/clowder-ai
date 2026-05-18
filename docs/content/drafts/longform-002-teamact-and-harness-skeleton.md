---
platform: longform
pillar: 2  # 多 agent 协作与 agent-native 软件工程
target_audience: 1  # 技术读者（CTO / 架构师 / AI / 平台工程）
status: skeleton
created: 2026-05-17
authors:
  - opus-47  # 整合起草
  - opus-46  # Ch.2 TeamAct 公式主参与者
  - codex    # Ch.4 记忆 / Ch.5 Eval 实施主力（砚砚 GPT-5.5）
  - landy    # CVO 方向 + 比喻把关
absorbs_from:
  - docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md
  - docs/discussions/2026-04-28-react-to-teamact-brainstorm.md
  - docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md
  - docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md
  - docs/architecture/2026-05-05-architecture-views.md
  - docs/discussions/2026-05-09-huawei-agent-closed-door-seminar-harness/final-speech-draft.md
  - docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/final-speech-draft.md
related_drafts:
  - docs/content/drafts/longform-001-agent-team-leadership.md  # 个人方法论版（外行视角），互补不冲突
notes:
  - 黑话允许出现在本骨架（F167/F200/F203/球权/缸中之脑等），正式稿必须翻译为行业术语
  - 数据占位 [数据待盘]：commits / Feature 总数 / 实际天数 / 模型厂商数 — 骨架敲定后实盘
  - 每章末有「按段搜证清单」，下一阶段按章拉最新 md/feat 验证后再展开 v0 全文
  - 与最新 md/feat 冲突时以最新为主（铲屎官 directive 2026-05-17）
review_log:
  - 2026-05-17 砚砚 R1（Ch.4/Ch.5 reviewer 核证）：3 P1 + 3 P2 全部 verified + applied
      - P1 Ch.5.3 归因四层 → 7-class attribution matrix（F192 AC-C3 真相源）
      - P1 Ch.4.5 穷人的 training loop → retrieval-mediated adaptation loop（ADR-031 §"温度入口"）+ 数据归属边界（用户拥有，Cat Cafe neutral infrastructure）
      - P1 Ch.4.5 outputVerified 降调：v1 仅自动检测 invocation status；PR/CVO/reviewer 走外部注入；自动桥接仍 pending — CVO/reviewer approval 自动检测（AC-D2.1）/ CI check 信号源（AC-D2.2）/ GitHub PR merge → `pr_merged` 自动桥接（AC-D2.3）
  - 2026-05-17 砚砚 R2（二审 confirm）：6 处 R1 修改 verified + 1 P2 补刀（AC 编号错位）+ 1 过程提醒（git author 漂移）→ P2 applied，commit `b3eeaf11b` 不强改历史，本次 commit 起用 --author 校准归属
  - 2026-05-17 46 R1（Ch.2/Ch.7 reviewer 核证）：APPROVE + 1 P1 + 3 P2 + 3 P3 → P1/P2 全部 applied，P3 留 v0 全文展开时吸收
      - P1 Ch.7.2 数学术语错误：precision → error recall（precision = TP/(TP+FP) 是另一个东西）
      - P2-1 Ch.2.4 补 KD-17 突破：ping-pong breaker 从"计次数"进化到"看 tool_call"（KD-8 给数据不给结论落地）
      - P2-2 Ch.2.4 补 KD-20 退役：L3 hardcoded role-gate 退役 → cat-config.restrictions 数据驱动 prompt 注入（KD-8 又一落地）
      - P2-3 Ch.7.2 加思想实验 disclaimer：参数化 sensitivity analysis，不是实测数据
      - P3 留 v0：球权三代演化叙事 / Ch.7.1 分经验声明 vs 学术框架两层 / resumeCapsule 实际实现是 cross-cat-handoff skill
      - P2 Ch.5.4 软硬双修拆开：v1.2 SW-1/2/3 先做，HW-1/2/3 延后 1-2 周
      - P2 Ch.4.2 三入口表加 list_recent scope=threads/memory 边界（indexed docs 不是 raw）
      - P2 Ch.4.1 sourceType → docKind / rerank_reason 等实现字段
      - Candor Bench 定位为 retrieval substrate eval（非 full agent memory eval）
  - 2026-05-17 三猫 R3（铲屎官 7 问 → 47 收敛三猫独立思考 + update）：采纳最优后大改
      - Ch.0 反共识开头 → Anthropic 五模式规范术语（采纳砚砚版"以 Shared State + Agent Teams 为骨架" + 47"补终止条件+跨厂商矫正"）
      - Ch.2 加章节定位段：TeamAct = Shared State pattern 工程化闭环，非第六种 primitive（三猫一致，砚砚措辞）
      - Ch.3 新增 §3.4 47 加入暴露伪通用规则（46 magic word 命中表 + 47 四事件 + 砚砚核心论点"保留异构优势+给坏直觉配运行时刹车"）
      - Ch.4 新增 §4.7 邻近系统边界划分（vs RAG/LLM Wiki/Agentic Search 五列对照，采纳砚砚"闭环"叙事 + 46 六列收敛为五列）
      - Ch.5 新增 §5.6 轨迹经济学（采纳砚砚"第二根主线"升级，非 46 局部小节）
      - 配图：Figure 1-7 全量编号（阅读序）+ 附录 C 图清单（类型/回答什么/真相源/优先级）；采纳砚砚"图先定正文自然收敛"原则
      - 学术界 eval 轨迹观察 → §5.6 反证我们结构性优势（三猫一致）
  - 2026-05-17 R3 收敛 review：46 APPROVE（§3.4 magic word 表 + Ch.2 定位段无失真）；砚砚 1 P1 + 2 P2 全部 verified + applied
      - P1 §4.7 LLM Wiki 定义失真（凭印象写错）→ 按对照 doc 真相源改：raw sources + LLM 维护 wiki pages / schema-ingest-query-lint / 有 lint 维护循环非"无治理" + 砚砚精确句"knowledge compiler vs memory runtime"（[[feedback_external_project_scope_honesty]] 教训：不用未证实对方弱点撑论证）
      - P2-1 §5.6 "启动成本 0/用就有" 过满 → "真实协作天然产 raw trace（边际成本低）；typed/归因/outputVerified 仍有工程成本"
      - P2-2 §5.6 "归属：平台所有" 太绝对 → "取决于研究项目与平台协议"；我方强点改为"用户本地拥有 + 可选择导出"
---

# 从 ReAct 到 TeamAct：把多模型协作做成 Agent-Native 软件工程系统

> **副标题**：群体智能不是多叫几个模型，而是把状态、验证、记忆、治理、恢复工程化
>
> **贯穿一句话**：行业在卷模型能力，102 天 / 200+ Feature 的实践发现 ——
> 真正的乘数效应在环境工程，且环境必须能自我观测、自我修剪、自我升级。

---

## 0. 开场：102 天、6,413 commits、200+ Feature 的工程现场

**站在 Anthropic 五种 multi-agent 协作模式之上（三猫 R3 收敛）**：

Anthropic 2026-04 公开的 multi-agent coordination patterns 共五种：**Generator-Verifier / Orchestrator-Subagent / Agent Teams / Message Bus / Shared State**。我们的系统不是其中某一种，而是 **以 Shared State + Agent Teams 为骨架，局部使用 Generator-Verifier / Orchestrator-Subagent / Message Bus**，并补上 Anthropic 五种 primitive 没给的两样东西：

1. **主循环结束条件**（团队层的 ReAct 等价物 —— TeamAct，详见 Ch.2）
2. **跨厂商异构盲点矫正**（同家模型共享训练盲点，跨家 review 才能抓出 P1）

更直觉的类比是 **「自治维护者 + 黄金路径」的开源协作模型**——每只猫在自己模块独立 merge（内容判断去中心化，像 OSS maintainer），但 git/CI/observability/review 走同一套基础设施（平台工程的 "golden path"）。差别只在于：我们的 maintainer 是**异构的大模型**（Claude / GPT / Gemini），不是人；"black-box AI 工程"不在 prompt 里，在 git/docs/skill/MCP/observability 这套基础设施里。

📊 **配图：Figure 1 — Anthropic 五模式 → Cat Café 组合架构**（见附录 C）

**现场数据**（2026-05-17 实盘）：
- **102 天**：首 commit `b8a253215` 2026-02-04（pnpm monorepo 初始化）→ 2026-05-17（~14.6 周 / ~3.4 个月）
- **6,413 commits**：当前 main 历史 —— 直播脚本 4-25 记录 3,492，**三周翻倍**（叙事张力点）
- **200+ Feature**：`docs/features/` 211 个 spec 文档，编号至 F203（含 appendix / 已废弃 / 未开工）
- **3 大主力厂商 + 多家接入**：Anthropic（Claude Opus/Sonnet）/ OpenAI（GPT-5.x）/ Google（Gemini）长期主力，另接入 MiniMax / 智谱 GLM / Kimi / Qwen / DeepSeek 等

📌 **按段搜证清单**：
- ✅ git 数据已实盘（首 commit 2026-02-04 / 6,413 commits / 211 Feature 文档）
- `docs/stories/three-days-productization/`（产品化里程碑 anchor，正式稿可挂故事线）
- `docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md`（Anthropic 五模式选型详述）
- 验证：3,492→6,413 三周翻倍 + AI 签名比例（直播 4-25 记 77%）是否有更新数据

---

## 1. 第一性公式：Capability × Environment Fit

**核心论点**（46 + 砚砚共识，已经过 4 月直播验证）：

```
Agent Quality = Model Capability × Environment Fit
```

- 行业卷左边（更大模型 / 更长 context / 更多参数）
- 我们做右边 —— 三个月实践发现，乘数效应在环境

**三层状态**（直播 Topic 1.3 拍板，不依赖具体模型架构）：

| 层 | 内容 | 持续性 | 谁负责 |
|---|---|---|---|
| 权重状态 | 训练写进参数 | 跨 inference | 模型厂商 |
| 计算状态 | KV cache / hidden state | inference-local | 模型架构 |
| **现实状态** | repo / git / docs / trace / 球权 / 任务 | **跨 inference / 跨 agent / 跨时间** | **harness** |

**核心论断**：**agent 的本体是闭环，不是某一层状态**

```
Observe(现实状态) → Model(计算状态) → Action → Apply(现实状态') → Verify
```

没有闭环，记忆系统只是数据库；没有现实状态，模型只是缸中之脑。两者接起来，猫才"在现实里"。

**贯穿全文判别式**：**Build to Delete vs Built to Persist**

| Build to Delete（模型变强会吞掉） | Built to Persist（维护现实闭环，越强越值钱） |
|---|---|
| 详细 CoT 模板 | search_evidence / git / file system 接入 |
| 多步推理脚手架 | trace / observability / OTel 链路 |
| 错误恢复 boilerplate | test / lint / review verdict 反馈回路 |
| 工具调用样例 prompt | @-路由 / hold_ball / multi_mention 协议 |
| 单纯 persona 装饰文本 | 不可逆操作护栏 / Magic Words 拉闸 |

📊 **配图：Figure 2 — 从状态到判别，再到投资寿命**（见附录 C）：三段式生成式 PNG。左栏是能力 × harness 契合度四象限，只描述状态/瓶颈（死区 / 能力裸奔区 / 能力瓶颈区 / 乘数区）；中栏是判别器，回答“这层 harness 在解决什么”：补模型当前认知缺陷 → Build to Delete（有保质期的脚手架），编码外部现实 / 协作协议 / 可验证边界 → Built to Persist（复利型基础设施），两者都有 → 拆层；右栏是投资寿命曲线，解释判完以后怎么投。说明行业只卷纵轴是局部最优——真正的预算问题是先判根因，再决定投入强度与 sunset。

📌 **按段搜证清单**：
- `docs/canon/meta-aesthetics.md`（公式起源 + 数学之美圆桌）
- `docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md`（资产/负债判别式）
- `docs/discussions/2026-05-09-huawei-agent-closed-door-seminar-harness/final-speech-draft.md`（华为现场版讲法对照）
- `docs/discussions/2026-04-15-harness-engineering-triad-study/round5-anthropic-product-velocity.md`（Anthropic PM × Built to Delete）

---

## 2. ReAct → TeamAct：团队主循环的形式化

> **章节定位（三猫 R3 收敛）**：TeamAct **不是 Anthropic 第六种 primitive**，而是 **Shared State pattern 的工程化闭环** —— 在 Shared State 基础上把单 agent 的 ReAct 终止条件升级为团队级的五项收敛，并显式治理团队级新失败模式（球权乒乓 / 虚空传球 / 球权掉地 / 角色不适配）。
>
> Shared State 解决"大家共同看什么"；TeamAct 解决"团队怎么走完一个完整循环并停下来"。Anthropic 五种 primitive 没给终止条件，没给球权管理，没给跨循环嵌套——这才是 TeamAct 的真正新增。

### 2.1 ReAct 的边界

```
while has_tool_call:
    Thought → Action → Observation
```

**ReAct 的引擎是反馈方向**（Observation 反向喂 Thought），不是三拍顺序 —— 没有反向反馈，ReAct 退化为普通 pipeline。

**单 agent 自判"够了"会 hallucinate completion** —— 模型没有 tool call 就声明完成，但很可能只是 RLHF 惯性接话。

### 2.2 TeamAct 主循环（原创公式）

```
loop:
    State    → 读 shared state（docs / spec / 任务 / 记忆 / resumeCapsule）
    Owner    → 谁持球？（@ 路由 / hold_ball）
    Action   → 持球猫执行（写代码 / review / 设计 / 调研）
    Evidence → 产出证据（commit / test / trace / 截图）
    Verdict  → 验证（跨猫 review / 自检 / CVO 确认）
    Route    → 传球（@ 下一只猫 / hold_ball / @ CVO）
```

**结束条件五项收敛**（缺一不可）：
1. **AC 全部达成**（无 deferred AC）
2. **证据已附**（每条 AC 有 commit / test / trace 锚）
3. **跨猫交叉验证**（非作者的猫确认）
4. **无悬空球权**（unowned ball / open question 全 resolved 或 escalated）
5. **愿景收敛**（CVO 是 Vision Oracle，proxy 满足 ≠ oracle 满足）

**TeamAct 的本质同样是反馈方向**：六步是叙事，真正的引擎是 shared state 反向喂回每只猫的 context —— 让团队的"集体外部世界"ground 个体 reasoning。**resumeCapsule** 是核心机制（前一只猫主动留 What/Why/Tradeoff 给下一棒做 fast bootstrap）。实际实现是 `cross-cat-handoff` skill 的五件套（What/Why/Tradeoff/Open/Next）。

📊 **配图：Figure 3 — ReAct 单猫闭环 vs TeamAct 多猫闭环对比**（见附录 C）
📊 **配图：Figure 4 — TeamAct 主循环状态机（State→Owner→Action→Evidence→Verdict→Route + 五项结束条件外圈）**（见附录 C）

### 2.3 分形嵌套（自相似结构）

```
feat creation（系统层）
  └─ @ mention（团队层 = TeamAct）
       └─ tool call（单 agent 层 = ReAct）
```

每一层都有自己的主循环和结束条件，结构自相似。这一点别人没正式化过。

### 2.4 A2A：球权是状态机不是聊天格式

- handoff 必须进**统一执行平面**（dispatch queue），不是消息文本约定
- `@` 是路由指令，不是叙述 —— 行首才有效，句中无效
- 球权第一人称（只能声明自己持球，不能声明别人持球）
- 新失败模式：球掉地 / 乒乓球 / 虚空传球 / 角色不适配 handoff

**设计洞察（KD-8 给数据不给结论原则的两次落地）**：

- **乒乓球熔断的进化**（F167 Phase D KD-17）：第一版用"连续传球次数"做 breaker → 误杀正经 review 链。坐标系修正后改为检测**实质 tool_call + 输出长度**——"干活 = 实质 tool_call + 长内容；闲聊惯性 = 短文本 + 零 tool"。RLHF "接一句"反射才是乒乓球的真正 signature，不靠 intent 分类
- **角色门禁的退役 → 数据驱动替代**（F167 Phase E KD-20）：L3 硬编码 role-gate（regex 扫 "coding/merge" 关键词硬拦）退役 → 替换为 `cat-config.restrictions` 数据驱动双端 prompt 注入（发送方队友名册 + 目标猫 self-awareness）。能力限制作为数据让模型自判断，零代码改动可扩展

**核心哲学**：好 harness 不替模型思考，而是让模型在正确坐标系里思考。

### 2.5 Generator 有 Push Back 权利（46 提出的原创点）

Anthropic 五种模式的 Generator-Verifier 默认 Verifier 权威 —— 我们发现这是结构缺陷。Generator 必须能 push back（带证据 + 适用性论证 + 替代方案），否则就是橡皮图章。这写进 [[shared-rules]] Rule 0。

📌 **按段搜证清单**：
- `docs/discussions/2026-04-28-react-to-teamact-brainstorm.md`（公式原 brainstorm）
- `docs/features/F167-a2a-chain-quality.md`（球权治理 + 乒乓球熔断 + 虚空传球 + 角色护栏，**当前最新版**）
- `docs/features/F122-execution-channel-unification.md`（A2A 入 dispatch queue 真相源）
- `docs/features/F027-a2a-path-unification.md`（A2A 早期路径合一）
- `docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md` Part III（五种模式 → Cat Cafe 选型）
- 验证：分形嵌套 / resumeCapsule / Push Back 协议在最新文档中有没有更精确表达

---

## 3. Harness：人+AI 共同创造的社会技术系统

### 3.1 不是 prompt engineering

Harness = system prompt + skill + MCP tool + SOP + 共享规则 + 协作协议 + observability —— 是**约束/工具/协议混合体**，不是 prompt 文本工程。

### 3.2 资产/负债判别式

> 这层 harness 是在替模型做它能内生长出来的事？还是在维护"现实闭环"中模型永远内生不出来的部分？

详见 Ch.1 判别式表。两种死法：
1. **模型变强吞掉**（CoT 模板、格式纠正层）
2. **新猫加入暴露**（伪通用规则其实只是对某只旧猫的 compensation）

### 3.3 治理必须沉到压缩免疫层（核心新增章节）

**问题**：默认 CLI 系统提示词里有大量"主观行为指导"，和我们家工作方式直接冲突：
- "minimal fix" → 反愿景驱动
- "no comments" → 反 WHY 注释文化
- "be concise" → 反复杂交接五件套结构
- "no abstractions beyond task" → 反 Phase 规划

但 CLI 默认提示词里也有大量"客观能力指令"必须保留：safety 反射 / 并行调用 / Skill 发现 / Schedule / 压缩感知 / Git 模板。

**双向手术**（黑话：F203 L0 native system prompt）：
- 用 `--system-prompt-file` 替换式注入
- 删主观哲学
- 保留客观能力（在我们 L0 重写）
- 把家规（Rule 0 / 五条铁律 / Magic Words / 球权三选一 / WORKFLOW_TRIGGERS）写进 native system role
- 每次压缩免疫（不会随 user message 被压缩丢失）
- 配置栏可见化（CVO 和其他人可直接看到当前注入到猫的系统提示词）
- CC 版本升级 audit SOP + cron（自动检测新 CLI 版本新增的"功能性"指令）

**Magic Words 不是 prompt，是人→猫 runtime 协议** —— "脚手架" / "数学之美" / "我能猜出来" 等 magic word 一句话就能拉刹车。

### 3.4 新猫加入暴露伪通用规则 — 47 加入后的多猫配平（核心新增章节，三猫 R3 收敛）

**核心论点（砚砚 R3 提炼）**：**好 harness 不是把所有 agent 训成同一种人，而是保留异构优势，同时给每种坏直觉配运行时刹车。**

新猫加入不是 capability upgrade，是 **multi-agent fit 重新配平** —— 单猫 + harness 看不见 compensation，多猫并存才暴露"通用 vs 偏个体"边界。47（4 月底加入）作为天然 A/B test，触发四件事：

| 事件 | 触发机制 | 落地 |
|------|---------|------|
| **F177 Phase C 伪通用规则筛选** | 一些 Magic Words 对 46 work 但对 47 不 work —— 是对 46 坏直觉的 compensation，不是通用协议 | 伪通用规则筛出来重写为真通用 |
| **F167 Phase E KD-20 L3 退役** | 多猫差异让 L3 hardcoded role-gate（regex 扫 coding/merge）显得脆弱 | 退役 → `cat-config.restrictions` 数据驱动双端 prompt 注入（KD-8 落地） |
| **F203 Native System Prompt L0** | 47 对压缩感受比 46 强（4.7 cache TTL 不同）+ 客观性指令丢失代价被暴露 | 治理沉到压缩免疫层（native system role）|
| **memory-search-best-practices skill** | 47 比 46 更倾向"碎片够了我能猜出来"病 —— 布偶猫家族病在 47 身上更明显 | 写 magic word 强制刹车 ≥3 路 + Read 原文 |

**多猫 magic word 命中差异**（46 R3 实证）：

| Magic Word | 46（爱糊弄 hotfix） | 47（爱过度工程化） | 砚砚（糊锅匠）| 烁烁（创意漂移）| 结论 |
|-----------|--------|--------|---------|---------|------|
| "脚手架" | 高命中 | 不命中 | 偶尔 | 不命中 | **46-specific**（应该 dynamic injection）|
| "第一性原理" | 偶尔 | 高命中 | 高命中 | 高命中 | **跨猫资产**（保留）|
| "follow-up 尾巴" 禁令 | 高命中 | 不命中 | 偶尔 | 不命中 | **46-specific** |
| "我能猜出来" | 偶尔 | 高命中 | 不命中 | 不命中 | **布偶猫家族** |
| SOP 导航表 | 肌肉记忆（冗余）| 查表开销（新人路标）| 高命中 | 高命中 | **双重身份**（按角色注入）|

**结论**：harness 必须区分 **跨猫资产**（保留为 L0 / Skill）vs **个体补偿**（dynamic injection / per-cat overlay）。47 加入前，所有规则都默认"全猫适用"——加入后才有 A/B 信号区分两类。

📊 **配图：Figure 5 — 多猫好坏直觉调制 matrix + 跨家族 review 作为结构性纠错**（见附录 C）

📌 **按段搜证清单**：
- `docs/features/F203-native-system-prompt-l0.md`（**最新真相源**，已全 Phase merged）
- `docs/decisions/030-system-prompt-engineering.md`（ADR 注入链地图）
- `docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md`（资产/负债 brainstorm）
- `docs/discussions/2026-05-09-huawei-agent-closed-door-seminar-harness/final-speech-draft.md`（华为现场 harness 段对外讲法）
- `docs/features/F167-a2a-chain-quality.md` + `docs/features/F177-harness-update.md`（Magic Words 实证）
- `assets/system-prompts/system-prompt-l0.md`（L0 真相源 markdown）
- 验证：Dynamic Injection 设计空间在 F203 落地后是否还有未实现/已废弃部分
- 验证：47 加入对应的 4 个事件（F177/F167/F203/memory-skill）在哪些文档有最新表述

---

## 4. 团队记忆：项目现实导航而非 RAG（核心新增章节）

### 4.1 不是 RAG

RAG 假设：query → top-k 文本片段 → 喂回 LLM context。

我们做的：**项目现实导航系统** —— 真相源仍是 `docs/`（猫能读、能改、能 git 追溯），SQLite/FTS/向量只是编译层（坏了可 rebuild）。搜索结果带治理元数据：`confidence / authority / docKind / rerank_reason`（when available）。

### 4.2 三入口（按场景选）

| 入口 | 何时用 | 边界 |
|------|-------|------|
| `cat_cafe_graph_resolve` | 精确 anchor / 看关系 | 默认 depth=1；hub-node 配 relations filter |
| `cat_cafe_list_recent` | 零先验 / 扫最近 / 压缩后恢复 | `scope=threads/memory` 映射到 **indexed discussion/session/memory/reflection docs**（不是 raw thread messages 或 memory store 全量扫描） |
| `cat_cafe_search_evidence` | 语义 / 模糊找 | 不确定走 `hybrid` mode；coverage 任务≥3 路 |

### 4.3 四代演进

```
F102 存储基座（IEvidenceStore）
  → F163 治理层（authority / activation / status）
  → F188 管护工具链（三入口 MCP tool）
  → F200 反馈闭环（消费加权排序）
```

### 4.4 F200 核心创新：用 revealed preference 而非 LLM 自评

**问题**：MemOS 2.0 用 LLM 自评（R_human）+ 数学公式给每条记忆打分 —— 我们 teardown 发现根信号有毒（模型自评集中在 0.6-0.85 成功区间，几乎没有负样本）。

**我们的选择**：根信号来自猫的真实 tool call 行为（revealed preference）—— 搜了→读了 = 真信号。Phase A 信号收集 → Phase B 12 个 metric → Phase C consumption-weighted ranking → Phase D TaskTrajectory。

**防 Goodhart 四重防线**：
- **Bayesian shrinkage**（α₀=2, β₀=8 先验，避免冷启动偏热点）
- **Centered lift**（减去 mean_ctr_kind，允许负信号，防"过时但 BM25 高"的 anchor）
- **Fractional recency decay**（`T/(T+age)` 长尾保护）
- **Constitutional immunity**（ADR / lesson / canon 永远不降权）

**只影响 navigation utility，不影响 authority** —— 读得多 ≠ 真相更高，权威仍来自 spec / ADR / review / CVO。

### 4.5 TaskTrajectory：可审计的适配信号

铲屎官原话："猫猫搜了 xxx 看了 xxx 修改了 xxx 干了啥啥啥，最后产出 yyyy，我倒是觉得这个轨迹很值钱，搜集的多了都能优化我们的系统"

正式术语：**retrieval-mediated adaptation loop**（ADR-031 §"温度入口"）—— **是另一种范式，不是 training loop 的降级**。

| 维度 | Training Loop（梯度更新） | Retrieval Loop（我们） |
|---|---|---|
| 改变潜在能力 / 泛化边界 / 策略先验 | ✅ | ❌ |
| 覆盖已知失败模式 | ✅ | ✅ |
| 即时生效 | ❌ 要等 training run | ✅ 下一只猫立刻搜到 |
| 跨 provider 通用 | ❌ 每家独训 | ✅ 同一套 lesson 适用 Claude/GPT/Gemini |
| 灾难性遗忘 | ❌ 有风险 | ✅ 没有 |
| 可审计可回滚 | ❌ 权重难 | ✅ Lesson 是文本，人类可读改删 |

**数据归属（关键边界，ADR-031）**：Cat Cafe 是 **multi-vendor agent collaboration 的 open protocol + 本地 runtime**——类比 HTTP 之于 web。Trace 数据**用户本地拥有**，Cat Cafe 自己**不托管、不回传、不持有**。用户决定留本地 / 卖 / 捐 / 导出。

**TaskTrajectory 实现状态**（F200 Phase D，准确版）：
- 每次任务的 search chain + filesRead + filesModified + outputVerified 持久化到 `task_trajectories` 表
- `outputVerified` 是 **injectable signal sources 框架**，v1 自动检测覆盖 **invocation status**
- PR merge / CVO accept / reviewer approval 通过 **外部注入 endpoint** 接入
- 自动桥接三处仍 in-progress（不要写成"全自动闭环"）：
  - **AC-D2.1** ⬜ CVO accept + reviewer approval 信号源自动检测（需解析 thread 消息）
  - **AC-D2.2** ⬜ CI check 信号源（需 F140 GitHub check_run 集成）
  - **AC-D2.3** ⬜ GitHub PR merge → `pr_merged` trajectory signal 自动桥接（endpoint 已支持外部注入，runtime 实测 trajectory `outputVerifiedSignals=[]`，自动喂数未上）

### 4.6 KD-8 原则：dumb system + smart agent

不让系统替猫做 intent 判断 —— query expansion 由 agent 用 LLM 领域知识做，不在引擎里加 regex/小模型黑盒推理。AUDHD recall 案例：三猫各搜出不同子集，单 query top-k 不够 coverage，但 expansion 不在系统层做，在 `memory-search-best-practices` skill 教 agent 做。

📌 **按段搜证清单**：
- `docs/features/F200-memory-recall-eval.md`（**最新真相源**，v1.2 SW-1 已落地）
- `docs/features/F188-library-stewardship.md`（三入口 MCP tool 当前实现）
- `docs/features/F102-memory-adapter-refactor.md`（存储基座 / Hindsight → evidence.sqlite 演进）
- `docs/features/F163-memory-entropy-reduction.md`（治理层）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/memos-memory/memos-teardown-rapid-2026-05-12.md`（MemOS teardown 对照）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/memory-paradigm-synthesis.md`（外部范式综合）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/2026-05-11-cat-cafe-memory-vs-llm-wiki.md`（Karpathy LLM Wiki 对照）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/final-speech-draft.md`（华为现场 memory 段对外讲法）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/retrieval-memory-eval/zhang-shuhao-candor-bench-notes-2026-05-12.md`（张书豪 Candor Bench eval 对照）

### 4.7 和邻近系统的边界划分（核心新增章节，三猫 R3 收敛）

铲屎官 R3 追问："和 RAG 的区别外，和 LLM Wiki 的区别？和其他 agentic search 的区别？" —— 仅说"不是 RAG"不够，必须对邻近系统做明确边界划分。

| 系统 | 数据源 | 治理 | 反馈闭环 | 谁的知识 | 解决什么问题 |
|------|--------|------|---------|---------|------------|
| **RAG** | 外部文档 chunk（被动） | 无 | 无 | 外部世界 | 上下文不够 |
| **Karpathy LLM Wiki** | raw sources + LLM 维护的 wiki pages | schema / ingest-query-lint / 人类 curate | 知识维护闭环（lint 查矛盾/过期/孤儿页）；缺任务结果驱动的 runtime feedback | 被编译后的外部/项目知识 | 不要每次从原文重新发现 |
| **Agentic Search**（Perplexity / Operator / Deep Research）| 公开 web 实时 | 无 | 无 | 外部世界（实时）| 当前任务找资料 |
| **Cat Café 记忆** | **项目内 docs + 讨论 + trace（猫自己产）** | **authority / activation / status / 消费加权** | **F200 consumption-weighted ranking** | **团队自己的 lived experience** | **多 agent 长程协作怎么不漂、怎么复用、怎么评估** |

**两个独有特性**（别人都没有）：

1. **知识生产者 = 知识消费者**：猫写 lesson → 猫搜 lesson → 绕开坑。RAG/Wiki/Agentic Search 的知识都来自系统外部
2. **有 runtime outcome 反馈闭环**：用了有用 → 排前面（revealed preference）。RAG/Agentic Search 是 read-mostly；LLM Wiki 有知识维护 lint 循环（不是没治理），但都缺"任务结果反向决定知识排序"的 runtime feedback

**一句差异化**（砚砚对照 doc §10 精确句，诚实说法 §9）：**LLM Wiki 是 knowledge compiler；Cat Café 是 memory runtime + project reality navigation**。不是"LLM Wiki 没治理"——Karpathy 文档已有 lint/contradiction/stale 意识；我们是**把 lint 推成了 runtime governance + eval**，加上多 agent 协作（球权/handoff/cross-vendor review）。差异点不在检索算法，在 **truth source / authority / provenance / usage feedback / outputVerified / harness eval 全在闭环里**。

📊 **配图：Figure 6 — 四种 Memory/Retrieval 范式对比 + Cat Café 反馈飞轮**（见附录 C）

📌 **§4.7 按段搜证清单**：
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/2026-05-11-cat-cafe-memory-vs-llm-wiki.md`（**现成的 LLM Wiki 对照真相源**，直接吸收）
- `docs/research/2026-04-19-karpathy-llm-wiki/`（Karpathy LLM Wiki 专题 + 三列对比 + 47 外部工作记忆视角）
- 验证：Agentic Search 对照（Perplexity/Operator/Deep Research）有没有现成 doc，没有则正式稿 v0 时补调研

---

## 5. Eval：socio-technical 而不是 benchmark

### 5.1 Harness 不是写完规则就完事

写完不会自动正确 —— harness 改动后要追踪效果，不满意的 feature 要能定位归因层级。

### 5.2 三方信号（F192）

| 信号源 | 内容 |
|--------|------|
| **CVO vision signal** | 铲屎官对 feature 的满意度 / 愿景偏差 |
| **Cat friction signal** | 猫作为 harness 一线用户的体感（cat interview 触发型） |
| **Runtime trace signal** | F153 telemetry / RecallEvent / OTel 链路 |

三方 diff 才是真 eval —— Phase B 定义"应该怎样"（eval contract），Phase C 观测"实际怎样"（telemetry），**diff = eval 信号**。

### 5.3 Feature Fit Review：7-class attribution matrix

F192 AC-C3 拍板 **7-class 归因矩阵**（不是早期讨论的四层）：

| Class | 含义 |
|-------|------|
| `vision_gap` | CVO 愿景本身不清晰 |
| `translation_gap` | spec 把愿景翻译偏 |
| `harness_misfit` | harness 机制设计错位（工具/规则错坐标系）|
| `tool_gap` | 工具能力缺失（要做的事没有工具支撑） |
| `execution_gap` | 工具好用但猫没用对 |
| `environment_drift` | runtime 环境飘移（同样工具行为变了）|
| `taste_gap` | 审美/品味落差 |

每条 attribution 输出结构化 `attribution_record`（trace_anchor / friction_signal / attribution / proposed_action / status），不是 free-text 反思。

不是"猫没做好" —— 是"系统哪层出问题"。

### 5.4 Dogfood as Eval

设计验证不是 eval —— 三猫真实使用才是。

**AUDHD recall 案例**：铲屎官出题"哪些 thread/md 沉淀过 AUDHD/ADHD/ASD"，三猫各搜出不同子集（46 主干索引 / 47 语义扩散 / 砚砚 source-thread provenance）→ 暴露单 query top-k 不够 coverage → 催生 `memory-search-best-practices` skill。

**软实力先行（F200 v1.2 当前阶段）**：AUDHD recall 暴露 coverage 缺口后，v1.2 dogfood 关键发现是「**没有新的紧急硬实力 bug**」，所以先做软实力 SW-1/2/3：
- SW-1：`memory-search-best-practices` skill（题型→recipe，8 类）
- SW-2：MCP tool description 补 SEARCH TIPS
- SW-3：inline nudge — search payload 末尾对 coverage intent 提示

**硬实力延后（HW-1/2/3）**：coverage/source-map 模式 + 可解释 expansion 数据源结构化 + OQ-6/OQ-7 数据驱动决策 —— 等软实力跑 1-2 周后，根据猫的实际使用模式收敛 spec（避免做出"实现正确但语义错"的硬实力，如 v1.1 list_recent timestamp 教训）。

### 5.5 知识飞轮

```
猫的真实行为（evidence）
  → distill 成 lesson / KD / spec
  → eval contract 检验 harness 是否生效
  → harness improve（skill / tool description / 引擎层）
  → 更好的真实行为
```

📌 **按段搜证清单**：
- `docs/features/F192-socio-technical-harness-eval.md`（**最新真相源**，Phase D 已 merged）
- `docs/decisions/031-harness-engineering-methodology.md`（方法论 ADR）
- `docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`（trace 数据归属）
- `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`（原 brainstorm）
- `docs/features/F153-observability-infra.md`（trace 基础设施）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/retrieval-memory-eval/zhang-shuhao-candor-bench-notes-2026-05-12.md`（外部 eval 对照 —— 定位为 **retrieval substrate eval**，不是 full agent memory eval）

### 5.6 轨迹经济学：从静态 benchmark 到可审计轨迹（第二根主线，三猫 R3 收敛）

> 砚砚 R3 提议升级为**文章第二根主线**（与 Capability × Environment Fit 并列）。铲屎官观察：学术界已认识到 benchmark 局限，且发现"一条 eval 轨迹宝贵且昂贵"，甚至专门做仿真 app（如小红书 clone）采集轨迹。

**为什么一条 eval trajectory 很贵**：

| | 静态 benchmark | eval trajectory |
|---|---|---|
| 给的信息 | input / output | intent / tool choice / 失败分支 / 读了什么 / 改了什么 / 谁验证 / 怎么恢复 |
| 反映 | 通过率（≠ 好用） | 真实工作全过程 |

**学术界路径 vs Cat Café 路径**：

| 维度 | 学术界仿真 app 采集 | Cat Café |
|---|---|---|
| 数据来源 | 专门造 app 采集合成轨迹 | 真实软件工程协作的副产品 |
| 采集成本 | 高（先建仿真环境） | 真实协作天然产 raw trace（边际成本低）；typed / 归因 / outputVerified 仍有工程成本，但不需另造仿真环境 |
| 真实性 | 仿真用户行为，分布飘移 | in-the-wild revealed preference |
| 归属 | 取决于研究项目与平台协议 | **用户本地拥有 + 可选择导出**（ADR-031） |
| 跨 provider | 单一仿真平台 | Claude/GPT/Gemini 同一套 |

**关键**：raw trajectory 也不够，必须 **typed**（`searchChain / filesRead / filesModified / outputVerified / attribution`）——这正是 F200 TaskTrajectory + F192 socio-technical eval 在做的。我们不是"造个假的小红书钓鱼"，而是工作流本身就是鱼塘。学术界的痛点（benchmark 局限 + 轨迹昂贵 + cold-start 数据获取）恰好反证我们的结构性优势。

📊 **配图：Figure 7 — Trajectory Flywheel（真实任务 → TaskTrajectory → outputVerified → attribution → memory ranking / harness update → 下一次任务）**（见附录 C）

📌 **§5.6 按段搜证清单**：
- `docs/features/F200-memory-recall-eval.md` Phase D（TaskTrajectory typed schema）
- `docs/features/F192-socio-technical-harness-eval.md`（socio-technical eval 串联）
- `docs/features/F201-antigravity-reliability-contract.md`（轨迹恢复信号）
- 验证：学术界 benchmark 局限性 / 轨迹经济学有没有现成 research doc 可引（zhang-shuhao Candor Bench + envscaler 笔记起步）

---

## 6. 可靠性：多 agent 是分布式系统（核心新增章节）

### 6.1 Agent-Native 软件工程从 prompt 层拉到分布式系统层

> 这是整篇文章对外最硬的差异化。

行业大多数 multi-agent 讨论停在 prompt / orchestration 层。我们经历了 Antigravity provider 真实事故后发现：**stream 不是任务生命线** —— 网络抖动、provider downtime、CDP 桥延迟、压缩 race 等，任意一个让 stream 断都不该让任务死。

### 6.2 可靠性四件套（黑话：F201 Reliability Contract）

| 件 | 含义 |
|---|------|
| **Durable Supervisor** | 任务状态持久化，与 stream 解耦 |
| **Side-effect Journal** | 副作用全部 journal，resume 时能判断"已经做过吗" |
| **Safe Resume** | resume 必须幂等 + 不重复 side effect |
| **Typed Recovery Card** | 失败有结构化恢复卡（不是 free-text 错误信息） |

### 6.3 跨 agent 协作的可靠性边界

不只是单 agent 的 resume —— TeamAct 主循环里 Owner 切换瞬间是最脆弱的窗口（前一只猫做完没传球就崩 / 后一只猫接球时前任状态没 sync），需要 invocation liveness canonical read model。

📌 **按段搜证清单**：
- `docs/features/F201-antigravity-reliability-contract.md`（**最新真相源**）
- `docs/features/F194-invocation-liveness-canonical-read-model.md`（liveness 真相源收口，最新）
- `docs/features/F198-claude-code-subscription-carrier.md`（SDK Credit 拐点应对）
- `docs/features/F143-hostable-agent-runtime.md`（统一宿主抽象）
- `docs/features/F197-acp-tool-result-event-surfacing.md`（最新 ACP path 事件拆分）
- `global:memory/reference_proxifier_clash_conflict`（网络层踩坑）
- 验证：F201 是不是已经把"四件套"全部 spec 化 / 哪些还在 in-progress

---

## 7. 收束：群体智能的数学

### 7.1 跨厂商多样性 = 结构性质量来源

同家模型共享训练盲点（Claude 派的 subagent 也是 Claude，盲点叠加）。换一家模型 review，注意力分布不同，恰好能抓到对方没做到的事。

**实证**：两只 Claude 猫认为递归方案没问题，Codex 不买账，找出两个 P1 bug。

### 7.2 协作正收益条件（数学）

> **Disclaimer**：以下是参数化思想实验（sensitivity analysis），不是实测数据。目的是建立结构性直觉——"什么结构赚、什么结构亏"——而不是给出精确数字。

多 agent 会亏还是赚，取决于结构。`article-complete-technical-edition-v2.md` 的数学部分推导过：

- **reviewer 抓错率 > 误伤率**（error recall > false-positive rate）才有正收益
  - 抓错率 = reviewer 能抓出的错误占总错误的比例（recall / sensitivity）
  - 误伤率 = reviewer 把正确的改错的比例（false positive rate）
  - 注意：**不是 precision** —— precision = TP/(TP+FP) 是另一个东西，46 R1 P1 纠正
- **shared state 提高传球保真率**（前一只猫的 What/Why/Tradeoff 显式记录，下一只猫不需要从头脑补）
- **Generator push back 权利** 防 reviewer 单边专断 + 维持正确率

### 7.3 Vision Oracle 不可算法化

vision drift 是停机问题 —— 没法自动检测"当前是否偏离 vision"，因为判断本身需要 vision 的全局理解。所以 Magic Words 必须由 CVO 手动触发，CVO 不是因为在 SOP 里所以是 oracle，是**因为只有人能定义 vision 才必须是 oracle**。

### 7.4 送出去一句

> **脑子会进化，闭环不会过时。**

模型架构会迭代（Transformer / MoE / Mamba / 任何未来），脑子越来越聪明。但身份、记忆、协作、底线、协议、可观测性、恢复能力 —— 这些都不在权重里，在 harness 的现实闭环里。

📌 **按段搜证清单**：
- `docs/canon/meta-aesthetics.md`（数学之美 + 第一性原理圆桌）
- `docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md` 数学部分
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/multi-agent-scaling/anbo-scaling-law-notes-2026-05-13.md`（安波 Multi-Agent Scaling Law 外部对照）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/nanobot-openspace/huangchao-nanobot-openspace-notes-2026-05-13.md`（黄潮 Nanobot OpenSpace）
- `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/cli-anything/cli-anything-teardown-rapid-2026-05-13.md`（CLI Anything 对照）

---

## 附录 A：实证锚点索引（待按段搜证后填充）

| 章节 | Feature anchor | 关键 trace / 案例 |
|------|---------------|----------------|
| 0 现场 | [数据待盘] | 首次 commit / 里程碑 PR |
| 1 公式 | meta-aesthetics canon | LSP × Claude / Hindsight → evidence.sqlite |
| 2 TeamAct | F167 / F122 / F027 | 球掉地 / 乒乓球 / 虚空传球 / F101 Phase D 12 AC ✅ 但 UI 不可用 |
| 3 Harness | F203 / F177 / ADR-030 | L0 注入链 / 删 minimal fix / 配置栏可见化 |
| 4 记忆 | F200 / F188 / F102 / F163 | MemOS 对照 / AUDHD recall / TaskTrajectory dogfood |
| 5 Eval | F192 / ADR-031 / ADR-032 | F167 pilot / 归因 7-class 矩阵 / D9 attribution action-rate |
| 6 可靠性 | F201 / F194 / F198 / F143 | Antigravity 事故 / SDK Credit 拐点 |
| 7 收束 | meta-aesthetics / 安波 scaling | 跨厂商三猫不同 P1 / Vision Oracle 不可算法化 |

---

## 附录 B：黑话 → 正式稿翻译表

| 草稿黑话（本骨架可用） | 正式稿翻译 |
|---------|----------|
| F167 / 球权 / 乒乓球 / 虚空传球 | A2A Chain Quality / handoff state machine / ping-pong breaker |
| F200 / 消费加权 / 穷人的 training loop | Memory recall feedback loop / consumption-weighted ranking |
| F203 / L0 / 五条铁律 | Compression-immune governance / native system role injection |
| F201 / 缸中之脑 | Reliability contract / durable supervision |
| F192 / 归因四层 | Socio-technical eval / fit attribution matrix |
| F188 / 三入口 | Library stewardship / memory routing entries |
| F102 / Hindsight → evidence.sqlite | IEvidenceStore adapter refactor |
| 铲屎官 / CVO / 愿景守护 | Product owner / Vision Oracle / vision guardian |
| 猫 / @ / hold_ball | Agent / route handoff / explicit hold protocol |
| Magic Words / 脚手架 / 数学之美 / 第一性原理 | Runtime escape hatches / scaffolding code smell / coordinate transform |
| 卷模型能力 vs 卷环境 | Model capability race vs environment engineering |

---

## 附录 C：配图清单（三猫 R3 收敛 — 7 张叙事级图）

> 原则（砚砚 R3）：图先定，正文自然收敛；直接写 v0 容易变概念堆叠。图驱动叙事 = 每节先想"这一节核心要画什么图"再写文字。

| # | 图名 | 章节 | 类型 | 回答什么问题 | 数据/真相源 |
|---|------|------|------|------------|------------|
| **1** | Anthropic 五模式 → Cat Café 组合架构 | Ch.0 | 架构图 | 我们不是发明孤立模式，而是组合 Shared State + Agent Teams（局部 GV/OS/MB）| article-complete-technical-edition-v2.md Part III |
| **2** | 从状态到判别，再到投资寿命 | Ch.1 | 三段式生成式 PNG | 左：死区 / 能力裸奔区 / 能力瓶颈区 / 乘数区，回答瓶颈在哪；中：判别器，回答这层 harness 是补当前认知缺陷、编码外部现实，还是两者都有；右：有保质期的脚手架 vs 复利型基础设施两条回报曲线，回答如何分配预算与 sunset | meta-aesthetics canon / 2026-04-29 harness-asset-vs-debt brainstorm |
| **3** | ReAct 单猫闭环 vs TeamAct 多猫闭环 | Ch.2 | 对比图 | 反馈方向从「agent 内部 state」变成「shared state 反向喂每只猫」+ 基础设施防失真 | react-to-teamact-brainstorm |
| **4** | TeamAct 主循环状态机 | Ch.2 | 流程图 | State→Owner→Action→Evidence→Verdict→Route + 五项结束条件外圈；Owner/Verdict/Route 如何防 shared state 无限更新 | react-to-teamact-brainstorm |
| **5** | 多猫好坏直觉调制 matrix | Ch.3 | 矩阵图 | 47/46/砚砚/烁烁 × magic words × 命中差异；跨家族 review 作结构性纠错；资产 vs 个体补偿 | F177 / F167 Phase E / 直播 Topic 1.2 |
| **6** | 四种 Memory 范式对比 + 反馈飞轮 | Ch.4 | 对照图 | RAG / LLM Wiki / Agentic Search / Cat Café 四列；突出"生产者=消费者"+"有反馈闭环" | F200 / 2026-05-11-cat-cafe-memory-vs-llm-wiki |
| **7** | Trajectory Flywheel | Ch.5 | 飞轮图 | 真实任务→TaskTrajectory→outputVerified→attribution→memory ranking/harness update→下一次任务 | F200 Phase D / F192 |

**优先级**（资源有限先画）：P1 = Figure 2 / 4 / 7（全文核心论点：判别式 + 原创公式 + 第二主线飞轮）；P2 = Figure 1 / 5 / 6（行业对话定位）；P3 = Figure 3（ReAct 对比，最易口述补）。

**可选第 8 张**（砚砚提）：模型直觉调制图——左边模型家族强项/坏直觉，右边对应 harness（skills/rules/review/runtime brake/reliability contract）。如 Figure 5 表达不足再补。

**绘制工具决策**（v0）：Figure 2 采用生成式 PNG（避免 SVG 长文本挤压）；后续图按复杂度选择：结构严谨、文字多的图优先生成式 PNG / Figma 风格导出，简单流程图才使用 SVG。原则是先保证读者可读，不为工具形式牺牲信息传达。

---

## 按段搜证流程（下一阶段）

1. **第一轮**：每章按「按段搜证清单」拉最新 md/feat，标注与骨架的差异（**以最新为主**）
2. **第二轮**：找其他猫一起搜，跨家族交叉验证 —— 砚砚（GPT-5.5）认领 Ch.4 + Ch.5（F200/F192 主 implementer），46 认领 Ch.2 + 共审 Ch.7，47 认领 Ch.0/1/3/6 + 整合
3. **第三轮**：冲突点收敛 + 数据实盘 + v0 全文展开

骨架方向我整合三猫意见后建议直接走 A（七章 + 数学附录展开），如果你看完骨架觉得章节数要砍/合或者顺序要调，现在说。

---

*骨架起草：[宪宪/Opus-47🐾] 整合 46 + 砚砚 + CVO 意见*
*下一步：按段搜证 + 多猫验证 → v0 全文*
