# Multi-Agent 架构对比调研（三份 Deep Research）交叉审阅审计报告

审计对象为三份对同一主题的独立报告：[ChatGPT] 、[Claude] 、[Gemini] 。
我的定位是“审计员”：不替他们补研究，而是检查**同一事实是否被说成不同版本**、**断言是否有证据链**、**是否存在系统性盲区与偏见**，并把三份建议合并成对 Cat Cafe 可执行的行动清单。

---

# Part 1: 事实分歧清单

下面只列“同一对象/特性被描述为矛盾版本”的点。对“缺失”不算分歧，但会在 Part 3 记为盲区。

## 1) Kimi Swarm 是否与 “k1” 绑定

* 涉及系统/特性：**Kimi Agent Swarm 的模型归属与命名（k1 vs K2.5）**
* 报告怎么说

  * [ChatGPT]：专门加了核实小节，结论是**公开材料将 Agent Swarm 与 Kimi K2.5 直接绑定**，“k1 + swarm”在公开信息范围内未能确认，更像旧命名或混称，建议对接时以 K2.5/Agent Swarm 为锚点。
  * [Gemini]：在开头定义里直接写成 **“Kimi Agent Swarm（k1/k2.5 混合专家模型集群）”**，并在异构性段落继续沿用“k1 和 k2.5”作为 swarm 的基础。
* 谁更可能正确（审计判断）
  我更倾向 [ChatGPT]。我在 Moonshot 的 Kimi K2.5 Tech Blog 中看到明确表述：**K2.5 可自发创建 up to 100 sub-agents、执行 up to 1,500 tool calls，且 Agent Swarm 是 K2.5 的一种模式（Beta）**，页面并未把 Swarm 绑定到 “k1”。([Kimi][1]) 同样，InfoQ 报道也把 Agent Swarm 作为 Kimi K2.5 的 research preview 模式描述。([InfoQ][2])
  这不证明 “k1”绝对不存在，但证明 [Gemini] 把 “k1/k2.5 swarm”当成硬事实写下去时，证据链明显不够硬。
* 严重性：**[Critical]**（命名与归属会影响接口假设、对接路线、风险评估）

---

## 2) oh-my-opencode 是否因 Anthropic 封禁而“毁灭性打击”

* 涉及系统/特性：**oh-my-opencode 的可用性、合规风险、依赖路径**
* 报告怎么说

  * [Gemini]：断言 oh-my-opencode 的异构性是通过“伪造 Claude Code 的 OAuth 请求签名”实现；并进一步声称 Anthropic 在 2026 年 1 月以 ToS 为由“全面封杀第三方客户端接入”，对 oh-my-opencode 造成“毁灭性打击”。
  * [Claude]：把 oh-my-opencode 视作持续迭代中的社区工程，列出 2026-02 的多项更新（f知、background agent 重构等），并把“自定义 agent 对编排器不可见”当成持续问题在跟进。
  * [ChatGPT]：把 oh-my-opencode 描述为基于 OpenCode 的 harness，重点在 b量 issue 暴露的问题（卡死、竞态、重复通知、无法 stop、无限循环），并提到主仓库警告冒充/钓鱼站点。
* 谁更可能正确（审计判断）
  这里要拆开两层：

  1. “Anthropic 对第三方 harness 的限制/封禁he Register 报道 Anthropic 修改条款以澄清对“使用 Claude 订阅配合第三方 harness”的禁止政策。([注册者][3]) GitHub 上也有关于 OpenCode OAuth 登录导致封禁的 issue 讨论。([GitHub][4])
  2. “oh-my-opencode 是否具体通过伪造 OAuth 签名、并已遭毁灭性打击”：这部分 [Gemini] 给的是**非常具体且非常重的指控**，但在三份报告里只有它这么写，且它的引用体系里夹杂较多二手来源（见 Part 2）。从审计角度，我只能判定：**风险方向可能对（合规风险确实大），但具体实现细节与结论措辞过猛，可信度不足**。
* 严重性：**[Critical]**（若属实会影响 Cat Cafe 的“订阅经济学 + CLI 自动化”合规路线）

---

## 3) Kimi Swarm 是否存在“Stored Session / 挂起与重连”

* 涉及系统/特性：**Kimi Swarm 的会话形态、人类介入方式**
* 报告怎么说

  * [Claude]：明确写 **“无 Human-in-the-Loop：启动后无法中途干预”**。
  * [Gemini]：写 Kimi Wide Research 常运行 10 分钟到 1 小时，因此实现了 **“存储会话（Stored Session）的挂起与重连”**，人类可在执行完毕或必须决策节点重新接入；还提到 “Planning Critic”。
* 谁更可能正确（审计判断）
  就“官方公开材料是否明确支持 Stored Session”而言，我更偏向 [Claude] 的谨慎说Blog 与 InfoQ 报道的公开描述中，我没有看到对“stored session / 挂起重连”的明确机制说明（页面大量讲的是 sub-agent 并行、tool calls、critical steps、Beta 形态等）。([Kimi][1])能是产品 UI 功能存在但未写进 tech blog。审计结论是：**[Gemini] 把它写成“已确认”的硬事实过早；[Claude] 的“无中途干预”更符合当前公开信息能支撑的强度**。
* 严重性：**[Minor]**（影响对“人在环”对比的结论力度，但不改 Swarm 的核心架构判断）

---

## 4) Claude Code Agent Teams 本地路径示例不一致

* 涉及系统/特性：**Agent Teams 的 mailbox/inbox 路径**
* 报告怎么说

  * [Claude]：示例为 `~/.claude/<teamName>/inboxes/<agentName>.json`。
  * [Gemini]：示例为 `~/.claude/teams/my-project/inboxes/backend-dev.json`。
  * [ChatGPT]：确认 mailbox/inbox 机制与本地文件持久化，但不锁定具体目录结构。
* 谁更可能正确（审计判断）
  这更像“示例路径写法/版本差异/作者记忆偏差”，不影响机制结论（mailbox + 本地文件 + file lockin议后续写合并报告时：**路径类细节必须用官方文档逐字对齐，避免把“举例路径”写成“规范路径”**。
* 严重性：**[Minor]**

---

的成本模型在 [Claude] 内部自相矛盾

* 涉及系统/特性：**OMO 的计费形态（订阅额度 vs AP  - [Claude]：概览表写 OMO 成本模型是“订阅额度（约 $60/月三订阅）”。

  * 但同一份 [Claude] 在“Cat Cafe 差异化优势”又写 “OMO 基于 API token 计费”。
* 谁更可能正确（审计判断）
  这是**同一报告内部矛盾**，审计结论是：该点不适合用作合并报告的“硬事实”，需要回到 OMO 的官方文档/实现去澄清“支持订阅驱动还是 API 驱动，或两者皆可”。
* 严重性：**[Critical]**（成本模型是架构取舍的重要输入，内部矛盾会污染后续决策）

---

# Part “抓错别字”，只抓会影响产品决策的“关键断言”，尤其是：**说成已确认但缺可核验来源**、**数字没出处**、**由单一 ishatGPT] 的主要问题点（整体最好，但仍有可改进处）

1. **Cat Cafe 的事实几乎全部来自“委托方提供说明”**
   [ChatGPT] 对 Cat Cafe 的“已确认”明确标注来自委托方提供的设计说明，这是诚实的边界划分。
   但从审计角度，这意味着它对 Cat Cafe 的结论更像“系统自述审阅”，不是外部可复核事实。合并报告若要对外发布，需要把这类内容改写成“自述/内部实现”并加上可复核 artefact（例如接口契约、测试统计、日志样例）。

2. **对 OMO 的问题归因可能有“issue 选择偏差”**
   [ChatGPT] 用大量 issue 佐证 background tasks 的复杂性与不稳定。 这很有价值，但也容易落入“只看故障票”的样本偏差：issu不可用”。
   建议合并时加一句“该结论基于公开 issue 的负面样本，缺少成功率数据”。

总体评价：证据链清晰，“已确认/推测”标注纪律性强，弱点主要是“对 Cat Cafe 依赖内部自述、对 OMO 依赖负面样本”。

---

## [Claude] 的主要问题点（结构化强，但数字与结论落地证据不足）

1. **“精确数字”大量缺少逐条出处**
   例如：OMO “133k LOC、11测 3-16”、Kimi API 价格、OMO 订阅价格、以及“5 teammates 约 5 倍 token”这类数值，在文本中呈现为硬事实，但缺少可以追溯到哪篇文档/哪次测量的指针。
   审计建议：合并时把数字分为三类标注：官方声明、作者实测、第三方估算。否则这些数字会在评审会上被一问就塌。

2. **“OpenCode 社区验证 GPT-5.3 Codex + Gemini 2.5 Pro + Claude Sonnet 4”属于高风险断言**
   这句话信息密度极高（跨厂商、跨代际型号、同 message bus 协作）。
   若没有强引用（官方 repo、可复现 demo、明确 commit），就不应写成“验证了”。审计建议：降现链接或删去。

3. **内部自相矛盾（成本模型）已在 Part 1 点名**
   同文同时出现“OMO 订阅额度”与“OMO API token 计费”。
   这是合并时必须先修的“数据一致性 bug”。

总体评价：[Claude] 很适合当“合并底稿骨架”（维度全、建议有路线图），但目前像一份“产品分数字证据链、措辞强度控制、内部一致性。

---

## [Gemini] 的主要问题点（叙事张力强，但“已确认”滥用且引用质量参差）

1. **把高度争议或高度具体的指控写成“已确认”**
   典型就是 “OMO 伪造 OAuth 签名”以及“Anthropic 2026-01 全面封杀导致毁灭性打击”。
   这类内容不是不能写，而是必须满足更高证据门槛（法律声明、官方公告、可复现技术细节、多源交叉）。否则它会把合并报告拖进不必要的合规争议。

2. **“市场闪崩、股票跌幅”属于高噪音信息，且来源可信度不稳**
   [Gemini] 写了 Claude Code Security 触发网络安全板块闪崩、并给出具体跌幅。
   我额外核对后发现：确有多家媒体报道 Anthropic 的 Claude Code Security 相关消息引发安全类股票下跌，但不([巴伦周刊][5])
   审计建议：这类内容在架构对比报告里价值有限（容易抢戏），除非你的结论是“合规与市场风险是关键维度”，否则应删除或压缩成一句“近期出现市场层面的关注与波动”。

3. **大量“推测”段落写得像“结论宣判”**
   比如把 mailbox 为“策略漂移灾难”等，方向可能对，但写法太像确定性陈述。
   审计建议：把推测改成“风险假设 + 触发条件 + 缓解手段”，否则读者会把文学修辞当事实。

总体评价：[Gemini] 在“风险想象力”上最强，很适合做 threat modeling 的素材库；但若直接并入合并报告，会显著拉低整体可审计性。

---

# Part 3: 盲区分析（3 份都覆盖不足的维度）

三份报告的共同优点是：维度齐（拓扑、并行、上下文、人在环、异构、DX、已知问题），但它们共同缺失了一些“真正会让系统在生产环境活下来”的硬维度：

1. **可观测性与可调试性（Observability）几乎缺位**
   多 agent 系统最常见的死亡方式不是“不会思考”，而是“你不知道它为什么这么做、卡在哪里、哪一步开始偏航”。
   三份报gent 的 trace id

* 是否可回放（replay）一次执行
* 是否有因果链（spawn 原因、工具调用原因）
* 日志粒度与结构化程度
  这会直接影响 Cat Cafe 未来的“线上事故处理体验”。

2. **安全模型只谈“审批”，没谈“对抗”**
   审批是治理的一部分，但不等于安全。三份报告都没有系统展开：

* prompt injection / tool injection 的攻击面
* secrets（token、ssh key、cookie）如何隔离与审计
* MCP server 的供应链风险（谁发布、如何签名、如何权限分级）
* 数据出境与隐私合规（尤其是异构模型混用时）
  [Gemini] 有一些风险叙事，但仍偏宏观，缺少“攻击路径图”。

3. **一致性与并发控制只被点到，没有对比“写入冲突”的系统解**
   大家都提到了 file locking 或“缺少锁”。但更关键的是：

* 多 agent 同时修改同一文件如何合并
* 失败回滚与补偿（compensation）策略
* 幂等性（重复执行是否安全）
  这些是 Cat Cafe 去中心化 Worklist 走向更大规模协作时的核心地雷。

4. **评估方法学缺失（除了 Kimi 给了 benchmark）**
   Kimi 有 benchmark 和官方指标（critical steps、tool calls、Wall-clock gains）。([Kimi][1])
   但对 Agent Teams 与 OMO 的对比，三份都缺“同题同测”：例如用同一个 repo、同一组任务（修 bug、加特性、重构、写测试），跑 N 次，统计成功率、耗时、人工介入次数、回滚次数。
   没有这层，架构对比会更像“设计哲学对比”，难以指导投入优先级。

5. **替代方案与竞品生态缺席**
   你的题目限定 4 个方案没问题，但合并报告至少应点名“类比基线”，否则读者无法校准：

* LangGraph / AutoGen / CrewAI 这类框架型
* OpenAI/Google/Anthropic 各自的官方 agent SDK 形态
  它们可能不直接竞争 Cat Cafe，但会影响“用户心智与生态接口标准”。

---

# Part 4: 偏见检测（系统性偏差与 prompt 诱导）

## [ChatGPT] 可能的偏见

* **工程治理偏好**：它倾向把问题归结为“需要最小中心化状态机、需要可观测与审计”，这对 Cat Cafe 是加分项，但也可能低估“轻量方案的速度优势”。
* **信息不对称导致的“Cat Cafe 细节偏爱”**：Cat Cafe 被提供了详细自述，它对 Cat Cafe 的分析天然更细、更像“知道内部结构的人写的评审”。
  审计结论：偏见可控，因为它把“委托方提供”标得很清楚。

## [Claude] 可能的偏见

* **路线图偏好**：它更像在给你写“短中长期 roadmap”，因此容易把不确定数字写得很确定（为了推动决策）。
* **对 Cat Cafe 的正向叙事偏强**：它强调 Cat Cafe 的“三个独特优势”，语气接近定位宣言。
  审计结论：适合做内部动员稿，不适合直接当对外研究结论。

## [Gemini] 可能的偏欢用“闪崩、毁灭性打击、数字霸权”这类叙事组织材料。

这会放大合规与市场风险（不一定错），但会牺牲可审计性。

* **对社写成“被封杀的悲剧”，Cat Cafe 被写成“绕开封锁的巧解”。
  审计结论：适合做 threat brainstorming，不适合当事实底稿。

## 三份共同偏见（最的背景信息更多”必然导致正向偏差**：不仅更容易看到亮点，也更容易把自述当事实。三份都不同程度出现“把 Cat Cafe机制”。

* **把“架构特性”误当“用户体验结果”**：例如“去中心化更像人类团队协作”这类判断，需要# Part 5: 给 Cat Cafe 的合并建议（去重后的行动清单）

下面把三份报告的建议做“交集/并集/冲突”整理，尽量落到你真能排进 backlog 的工程动作。

## 共识建议 **把 Worklist 从“队列”升级为“可审计的任务系统”**

共同指向点：

* [Claude] 想要 task dependency graph + self-claim。
* [ChatGPT] 想要“最小中心化的可观测状态机”，解决并发一致性与循环治理。
* [Gemini] 想要“写入锁、语义级中断协议”。

合并成一句工程定义：

> 引入 Task 实体（id、owner、状态机、依赖、重试策略、超时、取消），并把每次工具调用与产物挂到 task event log 上。

2. **并发写入必须有“物理级”冲突治理**

* [Claude]/[ChatGPT] 都认可 Agent Teams 的 file locking 价值。
* [Gemini] 直接建议 Cat Cafe 在 Write/Bash 前先申请文件写锁。

共识落地：对“会改 repo 状态”的动作引入强约束（file lock、branced mutex）。

3. **异构回传与结构化输出要“从承认：异构协作最怕输出格式漂移、回传失败、链路静默断裂。
   共识落地：把 McpPromptInjector 的输出格式要求固化为可验证 schema（带版本号），并加 resilient parser + 自动修复（必要时用小模型做格式修复）。

---

## 分歧建议（有报告反对或证据不足，合并时需标注条件）

1. **“模型 fallback chain”是否该优先做**

* 支持方：[Claude] ack chain 应对 rate limit。
* 另一种声音：[ChatGPT] 更强调“治理与审计外壳”，并未把 fallback 当第一优先级。
* [Gemini] 从合规角度建议“提供切回官方 API 的后备选项”。

审计合并结论：**做，但要带条件**。如果你继续走“订阅经济学 + CLI 自动化”，近期确实存在第三方 harness 被限制的现实风险。([注册者][3]) 所以 fallback 更像“合规与可用性保险丝”，不是性能特性。

2. **“Planning Critic/低成本批评者 agent”**

* 主要来自 [Gemini]，用于减少无效修改、降低审批疲劳。


审计合并结论：可以做，但别神化。把它实k**（自动 lint/test/spec check + 简短 critiqu”。

---

## 优先级排序：如果只能做 3 件事，做哪 3 件？

我按“风险下降幅度 / 对差异化的放大 / 工程可落地”给你一个三连击组合：

1. **Worklist V2：任务状态机 + 事件日志 + 取消/超时 + 幂等重试**

   * 目标：让系统从“聊天驱动的协作”升级为“可回放、可定位、可止损的协作”。
   * 这是承接三份共识的地基工程。

2. **写入冲突治理：路径级写锁 + 分支隔离（至少二选一）**

   * 目标：去中心化架构最怕“两个猫同时改同一 - 直接借鉴 Agent Teams 的 file locking 精神，同时适配你自己的 worklist。

3. **协议化输出：schema 版本化 + resilient parser + 自动质量门禁**

   * 目标：把异构回传的脆弱点变成工程优势。
   * 在 TaskCompleted 时自动跑 lint/test/contract check，不通过就回滚或打回。三份报告都在不同角度暗示你需要“结构化验收”。

（你会发现：这三件事不是“堆功能”，而是在给三只猫加上项圈、铃铛和定位器。它们依旧能跑，但你不会在凌晨 3 点追着 log 满屋子抓猫 🐾）

---

## 最大风险：Cat Cafe 最应该担心什么？

把三份报告的风险项去重后，我认为最大风险不是“竞品更强”，而是两类“系统性事故”：

1. **合规与账号风险（订阅经济学路线的外部不确定性）**
   你走的是 CLI + 订阅额度，这在成本上很香，但在 2026 的现实里，“第三方 harness + 订阅”已经被明确讨论过合规边界与封禁案例。([注册者][3])
   一旦某个上游收紧策略，Cat Cafe 可能出现“技术没问题，但账号没了”的硬停机。

2. **策略棘轮的“不可逆漂移”叠加异构链路脆弱性**

* 棘轮机制会把人类的局部决策固化成全局权限，这在长期会极大降摩擦，但也可能把一次疲劳期的错误批准永久化。[Gemini] 把它称为 policy drift 风险。
* 异构回传（尤其非原生 MCP 的注入）一旦格式漂移，最糟的是“静默失败”，让 Worklist 以为任务完成或继续错误分支。

审计建议：把“棘轮升级”也纳入任务系统的审计轨道（可回滚、可过期、可按风险分级永不升级），并对回传做强校验与失败显式化。

---

如果你愿意把这份审计报告继续推进成“可执行的合并 PR”，下一步最划算的是：我可以把上面三大优先事项拆成一份 Cat Cafe backlog（含里程碑、验收标准、风险与依赖），并把三份报告中可复用的术语与维度统一成一个对外可发布的对比框架（避免下次又出现 k1/k2.5 这种命名漂移）。

[1]: https://www.kimi.com/blog/kimi-k2-5.html "Kimi K2.5 Tech Blog: Visual Agentic Intelligence"
[2]: https://www.infoq.com/news/2026/02/kimi-k25-swarm/ "Moonshot AI Releases Open-Weight Kimi K2.5 Model with Vision and Agent Swarm Capabilities - InfoQ"
[3]: https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/ "Anthropic clarifies ban on third-party tool access to Claude • The Register"
[4]: https://github.com/anomalyco/opencode/issues/6930?utm_source=chatgpt.com "Using opencode with Anthropic OAuth violates ToS & ..."
[5]: https://www.barrons.com/articles/crowdstrike-stock-price-cybersecurity-zscaler-3efb4a93?utm_source=chatgpt.com "CrowdStrike Dived. Why a New AI Tool Crushed Cybersecurity Stocks."
