---
feature_ids: [F002, F027]
topics: [multi, agent, comparison]
doc_kind: research
created: 2026-02-06
---

好，猫爪上线 🐾
我按“摸团子底裤”的同款思路，把 **Teamily AI** 这套东西从公开信息里翻一遍（截至 **2026-03-02**）。

下面所有结论都严格区分：**官方口径** / **媒体转述** / **可执行或可复现的公开证据**。找不到就直接标“未找到证据”，不脑补。

---

## 0) 我这次用到的“证据包”

### 你给的材料

* KeyPoints 文章 PDF《前腾讯员工，造了个AI版微信》
  这是“第三方媒体叙事 + 自称深度实测”，不是官方技术文档。

### 我补的公开材料

* Teamily 官方 About 页（产品定位、架构三层、功能主张） ([Teamily AI][1])
* Teamily 官方 Privacy Policy（AI 数据处理承诺、是否用于训练等） ([Teamily AI][2])
* Teamily 官方 Terms（地域限制等硬条款） ([Teamily AI][3])
* Teamily 官方 Help Center（计费 credits、提到“不同模型消耗不同”这类线索） ([Teamily AI][4])
* Teamily 的新闻稿（ACCESS Newswire，三层架构、六大能力、创始人背景） ([ACCESS Newswire][5])
* 36氪英文稿（同样三层架构 + “多模型协调”这个敏感关键词 + 融资数字） ([36氪][6])
* 一个 GitHub 仓库：`teamily-ai/phone-call-skill`（SKILL.md、脚本、外呼能力实现方式） ([GitHub][7])
  注意：仓库名像官方，但 **官方站点/新闻稿没有直接链接 GitHub**，所以“是否官方出品”我会单独标注证据强度。

---

## 1) 先给一个“底裤结论总览”（便于你们快速下判断）

### 我能确认的

* **Teamily 的核心叙事不是“多角色聊天”，而是“IM 形态 + 多 Agent 常驻 + 全局记忆 + 编排器”**：这是官方 About 和新闻稿反复强调的产品定义。 ([Teamily AI][1])
* **它确实在公开材料里把架构明确写成三层**：Global Memory & Context Layer / Social Brain Model / Agent Social Network。 ([ACCESS Newswire][5])
* **隐私条款里明确写了“不用用户内容训练自家或第三方模型，除非另行披露”**（这是“承诺已存在”，不是“行为已审计”）。 ([Teamily AI][2])
* **服务条款里明确写了：不向中国大陆地区提供服务**（硬限制，直接影响你们是否能拿到一手实测）。 ([Teamily AI][3])

### 我只能部分确认的

* **“多模型协调 / 异构模型”**：36氪里出现了“创业公司优势在于能更激进尝试多模型协调”的表述，但官方并没有列出任何模型清单，也没有模型卡/论文/接口披露。 ([36氪][6])
* **“技能生态 / MCPs”**：KeyPoints 文章写了 Skills/MCPs 方向 ，但 Teamily 官方站点没提 MCP 或 Skills（我做过站内检索无结果）。 ([Teamily AI][1])
  不过 GitHub 上确实出现了“SKILL.md”形态的仓库，且与“电话呼叫”能力吻合。 ([GitHub][7])

### 我目前找不到证据的（你们要谨慎引用）

* **到底用了哪些底层大模型（OpenAI/Anthropic/Gemini/自研/混合）**：没有公开披露。 ([Teamily AI][1])
* **“Social Brain Model”是否真的是自研模型（训练/微调）还是编排器名字**：官方只写“proprietary LLM-based planning/orchestration engine”，缺乏模型训练细节与可验证材料。 ([ACCESS Newswire][5])
* KeyPoints 文中那种“群聊里自动弹出视频片段和背景音乐”的产品细节：除该媒体叙述外，官方公开材料未给同级别可验证描述。

---

## 2) 按“团子式审计题纲”逐条摸 Teamily 的底裤

下面每条都给：**问题 ->  部分确认 / 未找到证据 / 与公开信息矛盾）。

---

# Q1 他们的“多 Agent”到底是不是“多模型异构”，还是同模型分身？

### 1) Teamily 底层用了哪些模型？单一还是多模型？

**公开结论：未披露模型清单。**

* 官方 About + 新闻稿：只强调“LLM-based”、三层架构、多个 AI agents、全局记忆，但**没有任何具体模型名称**。 ([Teamily AI][1])
* Help Center：有一句关键线索是“不同功能或模型会以不同速率消耗 credits（不同 features or models may consume credits at different rates）”，这暗示“体系里存在不止一种 model 选择或配置”，但仍然不等于披露。 ([Teamily AI][4])

**判定：**

* “官方公开披露具体模型列表” -> **[未找到证据]**
* “系统内部存在多模型可能性” -> **[部分确认]**（仅凭 help center 描述 + 语义推断）

---

### 2) 如果多模型：跨厂商还是同厂商不同档位？

**公开结论：未披露。**

* 36氪英文稿提到：创业公司优势在于能更激进尝试“多模型协调”，并对比“大厂通常只支持自家大模型”。这更像创始人口径/报道转述，仍未给厂商名单。 ([36氪][6])

**判定：** **[部分确认]**（只确认“有人这么说过”，不确认“做到了什么程度/怎么做”）

-多 Agent 角色，那和“角色扮演”有什么区别？
这里要分清：**Teamily 的主张不是“角色扮演提升推理”，而是“协作表面 + 记忆层 + 编排器 + 工具执行”**。

* 官方把差异点放在：

    * Multi-user × Multi-agent 群聊并行执行 ([ACCESS Newswire][5])
    * Global Memory Management / Universal Memory Layer 跨群跨会话保留上下文 ([ACCESS Newswire][5])
    * Social Brain Model 负责分解目标和编排工作流 ([ACCESS Newswire][5])
* KeyPoints 则把“跨群记忆继承、B 群 AI 秒懂 A 群前因后果”讲得很戏剧化，但这是媒体转述。

**判定：**

* “Teamily 的差异点主要在系统层而非纯 prompt 角色扮演” -> **[部分确认]**（官方叙事明确，但实现细节不可审计）
* “它不是同模型角色扮演” -> **[未找到证据]**（因为模型层没披露）

---

### 4) 有无技术博客/GitHub/论文/招聘来佐证“多模型/多 Agent”实现？

* 官方站点本身是“产品宣言 + 架构框架”，不含工程细节级别的技术博客。 ([Teamily AI][1])
* 但我确实找到了一个 GitHub 仓库 `teamily-ai/phone-call-skill`，以 **SKILL.md** 形式定义“电话呼叫技能”，并且明确提到在 `~/.openclaw/workspace/skills/phone-call` 下使用脚本，还调用 `fluents.ai` API。 ([GitHub][8])

    * 这证明两件事：

        1. 他们至少愿意把“Agent 能打电话”拆成技能包的形态对外公开。 ([GitHub][8])
        2. “电话呼叫能力”在工程上很可能是通过外部语音/外呼平台（fluents.ai）实现，而不是 IM 内置魔法。 ([GitHub][8])
    * 但仍然有一个重要不确定：**这个 GitHub 组织是否官方**，公开材料没有相互链接能闭环验证。 ([Teamily AI][1])

**判定：**

* “存在可复现的技能实现线索（外呼）” -> **[部分确认]**
* “该 GitHub 仓库可作为 Teamily 官方技术披露” -> **[未找到证据]**（缺乏官方链接背书）

---

# Q2 Teamily 的 agent 协同机制是什么？谁在“控场”？

### 1) 有没有“协调人/编排器”？

**有，但命名是 Social Brain Model（社交大脑模型）。**

* 新闻稿明确写：Social Brain Model 是“LLM-based planning and orchestration engine”，负责把复杂目标拆解成可执行工作流，并在 agent network 里分配任务。 ([ACCESS Newswire][5])
* 36氪英文稿同样按三层写法描述 Social Brain Model 的职责：分析意图、拆解目标、分配任务、决定顺序。 ([36氪][6])

**判定：** **[已确认]**（“存在编排层这个概念”在多处官方/媒体一致）

---

### 2) 这是一个独立 agent，还是系统逻辑？

**公开材料只到“功能职责”，没有实现形态。**

* “Social Brain Model”被描述成“model/engine”，但没说它是：

    * 一个常驻 agent
    * 一个隐藏的系统调度器

      官方没有给实现形态。 ([ACCESS Newswire][5])

**判定：** **[未找到证据]**

---

### 3) Agent 之间怎么通信？共享上下文还是消息传递？

官方能确认的是“跨群/跨会话记忆与上下文层存在”，但通信协议没披露。

* 新闻稿：Global Memory Management / Universal Memory Layer 支持“across groups, sessions, contexts”。 ([ACCESS Newswire][5])
* 官方 About：强调“Global Memory & Context Layer maintains coherent multimodal context across conversations”。 ([Teamily AI][1])
* KeyPoints 讲得更具体，比如“B 群 AI 继承 A 群记忆”，但属于媒体叙事。

**判定：**

* “跨群上下文/记忆层作为产品主张存在” -> **[已确认]**（主张存在）
* “具体通信方式（共享上下文/消息总线/内部 API）” -> **[未找到证据]**

---

### 4) “主动干预”机制是否真实？

* 新闻稿把 “Proactive AI”列为六大创新能力之一，描述为“detect intent, initiate actions, provide recommendations without waiting”。 ([ACCESS Newswire][5])
* KeyPoints 给了大量“群里自动介入总结、自动理解链接”的例子，但这还是媒体自述实测，缺少可复现材料。

**判定：** **[部分确认]**（官方承认这个特性，但实现策略与触发阈值不可验证）

---

# Q3 关键量化/商业断言：融资、成本、迭代周期

Teamily 这篇 PDF 的强点不是数字，而是体验叙事；数字主要来自 36氪与新闻稿。

### 1) “研发四年”？

* 新闻稿写“三层技术架构 developed over four years of research and product iteration”。 ([ACCESS Newswire][5])
* 官方 About 也写“result of four years of R&D”。 ([Teamily AI][1])

**判定：** **[已确认]**（确认“官方这么宣称”）

---

### 2) 融资金额与轮次？

* 36氪英文稿称：累计融资 2000 万美元，预计 3 月开启新一轮融资计划。 ([36氪][6])
* 官方新闻稿没有披露融资额、投资人。 ([ACCESS Newswire][5])

**判定：**

* “融资=2000 万美元” -> **[部分确认]**（单一媒体口径，缺官方背书）
* “投资人是谁/条款/轮次” -> **[未找到证据]**

---

### 3) 定价/成本口径？

* 官方 Pricing 页我能打开，但目前公开信息偏少，Help Center 用 credits 解释计费。 ([Teamily AI][4])
* 有第三方文章提到“订阅 19.9 美元/月”一类信息，但不是权威渠道，且不一定最新。 ([统一通信策略][9])

**判定：** **[未找到证据]**（以官方可验证材料为准）

---

# Q4 隐私、安全、合规：这条是“真底裤”，不然都是营销内衣

### 1) 是否用用户内容训练模型？

* Privacy Policy 明确写：**不使用用户内容训练自研或第三方 AI 模型，除非明确披露**。 ([Teamily AI][2])

**判定：** **[已确认]**（确认“条款承诺存在”）

但我要加一句“共犯式提醒”：这不是技术审计报告，只是法律文本。它提升信任，但不等于“可验证的工程隔离机制已经实现”。

---

### 2) “细粒度隐私边界、最大化效率”的实现细节？

* 新闻稿提到 “Advanced Context Management: Fine-grained privacy boundaries”。 ([ACCESS Newswire][5])
* 但隐私策略页并没有展开“如何做边界隔离、跨群记忆如何授权、哪些数据进记忆层、是否支持逐群/逐人屏蔽、是否支持企业级 data residency”等细项。 ([Teamily AI][2])

**判定：** **[部分确认]**（官方提出目标，但缺可核验机制）

---

### 3) 地域合规与可达性

* Terms 里直接写：服务不提供给位于中国大陆的用户。 ([Teamily AI][3])

**判定：** **[已确认]**

这条对你们特别关键：如果你们团队/测试机房在大陆，实测链路会天然受限。

---

# Q5 生态与“技能/工具接入”：是真能动手，还是只会说

### 1) Gmail/Slack/GitHub/X/电话等集成是否只是口头？

* 新闻稿明确写“connected to Gmail, Slack, GitHub, X… can even phone calls”。 ([ACCESS Newswire][5])
* 官方 About 页也有类似描述（强调“+ New Agent”创建个人 agent 并连接账户）。 ([Teamily AI][1])

**判定：** **[已确认]**（确认“官方宣称存在这些 integration 能力”）

---

### 2) 有没有“能跑的工程证据”？

* GitHub 的 `phone-call-skill` 给出了非常具体的落地方式：

    * 通过脚本 `phone_ca:contentReference[oaicite:54]{index=54}fluents.ai` API
    * 提供 `analyze_call.py` 做通话分析
    * 通过 `.env` 配置 API KEY 等 ([GitHub][8])

这属于“能跑”的线索，虽然它更像是给 **Claude Code/OpenClaw** 这类 agent 工具用的 Skill 包，而不是 Teamily IM 客户端自身。 ([GitHub][8])

**判定：** **[部分确认]**（能确认“外呼=通过第三方平台 + 技能脚本化”这条路线存在；但不能确认“Teamily 产品内就是这么接的”）

---

## 3) 反推一张“Teamily 可能的技术骨架图”（明确：这是推断，不当事实引用）

基于官方三层架构描述 ([ACCESS Newswire][5]) + credits/多模型暗示 ([Teamily AI][4]) + 外呼 skill 的工程形态 ([GitHub][8])，我能M 层（Agent Social Network）**
群聊消息流 + AI 作为一等参与者（可@、可被分派任务、可并行输出）

2. **记忆与上下文层（Global Memory & Context Layer）**
   把跨群信息组织成“可检索上下文”，并做“隐私边界/上下文压缩/召回策略”

3. **编排层（Social Brain Model）**
   做意图识别、任务拆解、Agent 分工、回合控制、输出合成
   这里极可能是：**一个调度服务 + 若干 LLM 调用**（但官方没披露是否自研训练）

4. **工具执行层（Integrations/Skills）**
   连接 Gmail/Slack/GitHub/X/电话等外部系统，带权限与审计（官方只说目标，细节未披露）

这张图你们可以内部当“对齐用的猜想”，但对外分享时必须标“推测”。

---

## 4) 你们如果要继续“摸更深”，最有价值的 8 个验证动作（不讲战略，只讲取证）

你们之前“摸团子底裤”的套路，我建议在 Teamily 也同样做这 8 个“证据采样点”，每一个都能直接把“营销叙事”压到“工程事实”：

1. **抓网络请求里是否出现 model 名称或 provider**
   目标：确认是否多模型，是否跨厂商。

2. **同一群内同时触发两种复杂任务，看是否并行执行**
   目标：验证“multi-agent parallel execution”不是顺序假并发。

3. **跨群继承：把 A 群关键上下文转给 B 群，检查 B 群 AI 是否能引用具体细节而不是泛化**
   目标：验证“Universal Memory Layer”是否真实可用，而不是“总结式猜测”。

4. **隐私边界：A 群明确标注敏感信息后，B 群 AI 是否会泄漏**
   目标：验证“fine-grained privacy boundaries”。

5. **主动介入阈值测试**
   用不同噪声水平的聊天流，看 AI 是否真的“意图检测”触发，而不是固定频率插话。

6. **工具授权形态**
   看 Gmail/Slack/GitHub/X 的授权是 OAuth、API key 还是代理登录，scope 是什么。
   目标：验证“安全与可控”。

7. **审计日志与可撤销性**
   任何外部动作（发邮件、发帖、打电话）是否有“执行前确认”和“可追溯记录”。

8. **把 AI 逼到失败边界**
   比如工具返回 429/权限不足/网络断开，是否有清晰的失败处理，而不是编故事。

---

## 5) 最后给你一句“可以在分享里安全引用”的话术（不碰未证实点）

如果你们要在内部报告或对外分享里引用 Teamily（而不踩雷），目前公开证据允许你们这么说：

* **已安全可引用（有官方文档支撑）**：
  “Teamily 将产品定义为 AI-native IM，让多个 AI agents 作为一等参与者进入群聊，并提出三层架构：Global Memory & Context Layer、Social Brain Model、Agent Social Network。” ([ACCESS Newswire][5])

* **不建议直接引用为事实（只能说‘其宣称’）**：
  “多模型异构/多模型协调到底怎么做、用哪些模型”
  “细粒度隐私边界的工程实现细节”
  “媒体描述的某些炫技体验细节（群聊自动放视频片段/配乐等）”

---

如果你愿意，我们可以下一步把“Teamily vs 团子”按同一张 A2A/Swarm 结构表做一次硬对齐：
只对齐 **三件事**：**模型异构证据、编排器形态、记忆边界**。这样你们写报告的时候，会非常干净利落，引用也不怕被反咬 🐱



[1]: https://teamily.ai/about "https://teamily.ai/about"
[2]: https://teamily.ai/about/privacy-policy "https://teamily.ai/about/privacy-policy"
[3]: https://teamily.ai/about/terms-of-service "https://teamily.ai/about/terms-of-service"
[4]: https://teamily.ai/about/help-center "https://teamily.ai/about/help-center"
[5]: https://www.accessnewswire.com/newsroom/en/business-and-professional-services/teamily-ai-launches-the-worlds-first-human-ai-social-network-for-1136668 "https://www.accessnewswire.com/newsroom/en/business-and-professional-services/teamily-ai-launches-the-worlds-first-human-ai-social-network-for-1136668"
[6]: https://eu.36kr.com/en/p/3678646020940422 "https://eu.36kr.com/en/p/3678646020940422"
[7]: https://github.com/teamily-ai/phone-call-skill "https://github.com/teamily-ai/phone-call-skill"
[8]: https://raw.githubusercontent.com/teamily-ai/phone-call-skill/main/SKILL.md "https://raw.githubusercontent.com/teamily-ai/phone-call-skill/main/SKILL.md"
[9]: https://ucstrategies.com/news/teamily-raised-20m-betting-people-will-pay-to-keep-ai-group-conversations-going/ "https://ucstrategies.com/news/teamily-raised-20m-betting-people-will-pay-to-keep-ai-group-conversations-going/"
