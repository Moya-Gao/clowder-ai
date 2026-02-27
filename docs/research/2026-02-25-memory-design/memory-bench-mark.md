---
feature_ids: [F003]
topics: [memory, design, bench]
doc_kind: research
created: 2026-02-25
---

好，先把“记忆 Bench 地图”铺开 🗺️🐾
下面这批是我按 “长期对话记忆 / 个性化画像记忆 / Agent 行动记忆 / 交互式 episodic 记忆” 四条主线，梳出来的 相对权威且被学术界/工业界频繁引用 的 benchmark（截至 2026-02-26）。

我会尽量只列“benchmark 本体”，不先跑去讲某个产品或框架多牛。

⸻

A. 长期对话记忆（跨 Session / 多轮长期一致性）

1) LongMemEval（ICLR 2025）

定位：偏“聊天助手真实使用”的长期记忆能力评测。
测什么：5 类核心能力
•	信息抽取（information extraction）
•	跨 session 推理（multi-session reasoning）
•	时间推理（temporal reasoning）
•	知识更新（knowledge updates）
•	该拒答时拒答（abstention）
并且是 500 个问题嵌在可扩展的 user-assistant 聊天历史里。  ￼

你们 Cat Café 的“温/冷记忆 + 更新/冲突处理 + 时间线”这条痛点，LongMemEval 基本是正面硬刚。

⸻

2) LoCoMo（LoCoMo, 2024, Snap Research）

定位：目前最常被当作“长程对话记忆”公共基准之一。
数据特征：对话非常长（每段约 300 turns，平均约 9K tokens，最多可跨 35 个 session）。  ￼
任务：
•	QA（并细分 5 种推理类型：single-hop / multi-hop / temporal / commonsense-world / adversarial）
•	event summarization
•	multimodal dialogue generation  ￼

你们提到“闲聊里诞生命名仪式但笨猫识别不了”，LoCoMo 这种“长跨度 + 多事件 + 多推理类型”对检索/摘要/锚点机制很敏感，适合当主力压测场。

⸻

3) MSC（Multi-Session Chat）/ Beyond Goldfish Memory（ACL 2022）

定位：早期但非常经典的“多次会话，人类彼此逐渐了解”的长期对话数据集。
要点：专门强调 multi-session 下模型会忘、以及“检索+总结/回忆”能显著提升。  ￼

这是“祖师爷级别”的对照组。你们做任何新记忆系统，都很适合拿 MSC 作为 sanity check。

⸻

4) LOCCO / LOCCO-L（Findings ACL 2025）

定位：面向“LLM 作为 chatbot 的长期对话记忆”定量评测数据集。
数据特征：100 个用户与 chatbot 的长期对话，总计 3080 interactions，并配套 QA 用于测模型记忆。  ￼
额外价值：论文里还系统讨论“记忆随时间衰减”“rehearsal/间隔学习”等影响因素。  ￼

⸻

5) SHARE（ACL 2025）

定位：把“shared memories（两个人共同经历）”当成长期对话可持续性的关键变量。
数据来源：movie scripts 构造长对话；包含 persona、events、以及可显式/隐式抽取的 shared memories，并提出 EPISODE 框架管理 shared memory。  ￼

你们 Cat Café 的“共同经历（命名、里程碑）要跨 session 连续”这一条，SHARE 的问题定义很贴脸。

⸻

6) EverMemBench（arXiv 2026.02）

定位：把 benchmark 拉到更接近“真实工作群聊”复杂度的长程记忆评测。
数据特征：multi-party、multi-group，对话跨度 超过 1 million tokens，信息随时间演化且跨话题交织。
评测维度：1000+ QA，三大维度：fine-grained recall、memory awareness、user profile understanding。  ￼

如果你们未来真的要处理 1M+ thread，这个很可能是“高难度靶场”。

⸻

7) EvolMem（arXiv 2026.01）

定位：更“认知科学化”的 multi-session 记忆 benchmark。
特点：强调不仅是 declarative（能说出来的事实），还覆盖 non-declarative 维度，并拆成更细粒度能力；配套可控合成与评测指南。  ￼

⸻

B. 个性化与用户画像记忆（偏好、档案、关系网、动态变化）

8) PersonaMem（COLM 2025）

定位：动态 user profiling + 个性化响应的 benchmark（非常适合测“偏好会变、助手要跟上”）。
数据特征：180+ 模拟 user-LLM 交互历史；每个最高 60 个 sessions，覆盖 15 类真实任务场景；在特定时间点给 in-situ query，让模型选最合适的回复。  ￼
加分项：项目页直接提供了 leaderboard（按 query type 分解的模型表现表）。  ￼

你们想区分“今天天气好（不重要）”和“命名仪式（重要）”，本质是“用户状态与偏好随时间演化”的一类问题。PersonaMem 很值得拿来当偏好链路的主测集。

⸻

9) PersonaMem-v2（arXiv 2025.12）

定位：更狠一点，专打“隐式偏好”与“长上下文个性化”。
数据特征：模拟 1000 真实 user-chatbot 交互，300+ 场景，20,000+ 用户偏好，128k context window，且大量偏好是隐式透露。  ￼

⸻

10) PerLTQA（SIGHAN 2024, 中文）

定位：中文个人长期记忆 QA 数据集，把“语义记忆 + 情景记忆”混在一起考。
内容覆盖：world knowledge、profiles、social relationships、events、dialogues。
规模：8,593 个问题，30 个角色；并拆成 Memory Classification / Retrieval / Synthesis（或 Fusion）三子任务。  ￼

Cat Café 是中文语境重度用户的话，PerLTQA 很像“中文个性化记忆底座测试”。

⸻

C. Agent 记忆不只是“答题”，还要“驱动行动”（工具选择、参数落地）

11) Mem2ActBench（arXiv 2026.01）

定位：专门评测“记忆是否能被 agent 主动用来执行工具动作”，而不只是被动回答问题。
数据构造：合成 2,029 个 sessions（平均每个 12 个 user-assistant-tool turns），再反向生成 400 个 tool-use tasks；人工评估确认 91.3% 强依赖长期记忆。  ￼

你们的系统如果要落地成“会做事的多猫团队”，Mem2ActBench 是非常关键的行动链路压测。

⸻

12) MemBench（Findings ACL 2025，注意同名歧义）

定位：更“综合指标化”的记忆评测，用多指标去量化 agent 记忆。
覆盖：factual memory + reflective memory，两种场景（participation / observation），并强调不只看准确率，还看 recall、capacity、temporal efficiency 等。  ￼

⸻

13) MemoryAgentBench（ICLR 2026 Poster）

定位：把“memory agent”当成独立物种来评测的统一基准。
四大核心能力：accurate retrieval、test-time learning、long-range understanding、selective forgetting；并把长文本数据改造成 multi-turn 增量格式来模拟真实记忆累积。  ￼

你们一直在纠结“升降级/遗忘机制不能靠笨猫”，MemoryAgentBench 的能力划分基本就是你们痛点的理论化版本。

⸻

D. 交互式 episodic memory（含多模态/环境轨迹）

14) EMemBench（arXiv 2026.01）

定位：用交互式游戏轨迹评测 episodic memory，且 ground truth 可验证。
关键点：问题从 agent 自己的轨迹生成；覆盖 single/multi-hop recall、induction、temporal、spatial、logical、adversarial 等技能；文本与视觉环境都有。  ￼

你们孟加拉猫如果负责视觉与创意，这个 benchmark 方向和它的战场强相关。

⸻

E. 专项补充：多 Session 时间推理（Temporal）单独开火

15) TReMu（Findings ACL 2025）

定位：提出 multi-session 对话中的 temporal reasoning 评测任务，并用 LoCoMo 增强构造多选 QA 形成 benchmark。  ￼

⸻

F. 正在冒头的“on-policy 交互式记忆评测环境”

（这类很可能会变成未来几年主流，但目前更偏“新贵/在审”。）

16) AMEMGYM（ICLR 2026 under review）

定位：主打 on-policy 的交互式评测与优化环境，强调现有 benchmark 多为 static/off-policy。  ￼

⸻

给你一个“最小但覆盖你们核心痛点”的 Bench 套件建议

如果你们 Cat Café 接下来要边造系统边做可控实验，我建议先用这 4 个把主干钉牢：
1.	LongMemEval：跨 session 推理 + 时间 + 更新 + 拒答都齐了。  ￼
2.	LoCoMo：长跨度对话 + 多类型推理，适合测“markers 锚点 + 分层回忆”。  ￼
3.	PersonaMem：动态偏好与用户画像，直接打你们“偏好/情感价值”的召回链路。  ￼
4.	Mem2ActBench：把记忆从“会说”逼到“会做”。  ￼

⸻

如果你愿意，我下一步可以继续按你们的 research 方法论走：
把这些 benchmark 各自的 leaderboard/基线表 摘出来，然后再做“控制变量”的实验设计草案（同模型对比不同记忆架构，同架构对比不同模型），让你们三只猫可以直接分工开干。🐱📚

----

收到收到 🤝😼
我不再讲“哪个模型更强”了，直接把你点名的 benchmark 的“榜单”扒出来，并且把每个 Top 方法的记忆组件(=方法/框架名)和它们跑分时用的backbone 模型标清楚。

先说一句现实限制，免得你后面踩坑：
很多 memory benchmark 没有统一维护的在线 leaderboard，所以“排行榜”通常以论文里的对比表(Table)形式存在（在同一评测设定下对比多个 memory 系统）。下面我就按这个标准，把当前最清晰、可复用的对比表整理成榜单给你。

⸻

你要的“一眼冠军”版本
•	LoCoMo：Mnemis (k=30) 用 GPT-4.1-mini 跑，Overall 93.9
•	LongMemEval-S：Mnemis 用 GPT-4.1-mini 跑，Overall 91.6
•	PersonaMem：RGMem 用 GPT-4.1 跑，Overall 74.01%
•	Mem2ActBench：A-mem 用 Qwen2.5-72B-Instruct 跑，F1 35.93（同表里最高）

来源分别在下面每节标了。

⸻

1) LoCoMo 榜单（来自 Mnemis 的对比表）

评测设置你要知道的关键点
•	指标：LLM-as-a-Judge (0/1) 分数，按题型汇总 Overall
•	Mnemis 这张表给了 两套 backbone：GPT-4o-mini 与 GPT-4.1-mini（同一表内可直接比）。
•	表里“Full Context / RAG”是对照组：Full Context=不做记忆检索，直接喂全历史；RAG=只检索 episode 文本。  ￼

LoCoMo Top (backbone = GPT-4.1-mini)

按 Overall 排名（取前 5 个最有用的）：
1.	Mnemis (k=30)：Overall 93.9（记忆组件：层次图 + 双路检索，k=30）
2.	Mnemis：Overall 93.3（同上，默认 k=10 预算）
3.	EverMemOS：Overall 92.3（记忆组件：EverMemOS 框架）
4.	EMem-G：Overall 85.3（记忆组件：EMem 的图传播检索变体）
5.	Full Context：Overall 80.6（无外部记忆，仅供上限/对照）  ￼

LoCoMo Top (backbone = GPT-4o-mini)
1.	Mnemis：Overall 89.8
2.	EMem-G：Overall 78.0
3.	Nemori：Overall 74.4
4.	MemOS：Overall 73.3
5.	Full Context：Overall 72.3  ￼

你关心的“他们都是什么记忆组件”快速标注

（不展开吹模型，只标组件类型，方便你做 Cat Café 组件候选池）
•	Mnemis：图结构记忆（episodes/entities/edges）+ 层次类别图，双路检索(System-1 相似检索 + System-2 全局选择) + rerank。 ￼
•	EMem-G：dense retrieval + LLM relevance filtering + 图传播(PPR) 的检索增强。 ￼
•	Nemori：自组织记忆（topic segmentation + episodic + semantic memory）一套模块化生成与检索。 ￼
•	MemOS：把 memory 当“系统资源”的 Memory OS 思路（生命周期管理等）。 ￼

⸻

2) LongMemEval-S 榜单（来自 Mnemis 的对比表）

注意：这里是 LongMemEval-S（LongMemEval 的一个设置/子集），Mnemis 表里按题型给了 SSU/MS/SSP/TR/KU/SSA 和 Overall。

LongMemEval-S Top (backbone = GPT-4.1-mini)

按 Overall 排名（Top 5）：
1.	Mnemis：Overall 91.6
2.	EMem-G：Overall 84.9
3.	EverMemOS：Overall 82.0
4.	Mem0：Overall 80.8
5.	RAG：Overall 72.6
（Full Context 这里是 65.6，明显掉队，说明超长上下文下“硬塞”不稳。）  ￼

LongMemEval-S Top (backbone = GPT-4o-mini)
1.	Mnemis：Overall 87.2
2.	EMem-G：Overall 77.9
3.	Mem0：Overall 71.1
4.	RAG：Overall 67.2
5.	Nemori：Overall 64.2  ￼

这一榜单里“用的什么模型跑的”

这张表明确给了两套 backbone：GPT-4o-mini / GPT-4.1-mini（同表对比）。 ￼

⸻

3) PersonaMem 榜单（来自 RGMem 的对比表）

PersonaMem 的特殊点：它是多选题评测，指标是 accuracy(%)，并且 RGMem 明说采用最挑战的 128k-token 配置。 ￼

PersonaMem Top (backbone = GPT-4.1)

按 Overall 排名（RGMem 表里给了关键 Overall）：
1.	RGMem：Overall 74.01%
2.	Memory OS：Overall 65.03%
3.	A-Mem：Overall 63.95%
4.	Mem0：Overall 60.44%
5.	LangMem：Overall 58.23%
（Vanilla LLM：51.86% 作为无记忆对照）  ￼

PersonaMem Top (backbone = GPT-4o-mini)

你现在至少能直接拿到这几条（表格片段里已包含 Overall）：
1.	RGMem：Overall 63.87%
2.	Mem0：Overall 56.79%
3.	Memory OS：Overall 54.23%
4.	A-Mem：Overall 49.17%  ￼

以及 RGMem 论文对评测协议有一句很关键的澄清：
•	LoCoMo：LLM-as-a-judge（judge 用 gpt-4.1）
•	PersonaMem：多选题 accuracy
•	对比 backbone：LoCoMo 用 gpt-4o-mini / gpt-4.1-mini；PersonaMem 用 gpt-4o-mini / gpt-4.1  ￼

⸻

4) Mem2ActBench 榜单（它有“真·表格榜单”，而且控制变量做得很规矩）

这个 benchmark 的榜单非常适合你们做“架构贡献 vs 模型贡献”分析，因为作者把 backbone 固定成 同一模型家族 Qwen2.5 三个尺度：7B/32B/72B，对每个 memory 框架都跑一遍。 ￼

评测用的模型（你问的“用什么模型打的测试”）
•	Inference backbone（统一控制变量）：
•	Qwen2.5-7B-Instruct / 32B-Instruct / 72B-Instruct
•	检索 embedding（用于涉及 retrieval 的方法）：BGE-m3
•	解码：temperature=0.0（固定）  ￼

Mem2ActBench Top（按 Qwen2.5-72B 的 F1 排名）

（因为这是“最强同族 backbone”下的榜单，最像你要的“Top 都是谁”）
1.	A-mem：F1 35.93
2.	LTMemory（作者对 “Long-term Memory (RAG)” 这类基线的命名）：F1 35.32
3.	MemTree：F1 33.21
4.	Mem0：F1 28.95
5.	LangMem：F1 24.01
（SCM / Generative Agents 也在表里，但 F1 更低。）  ￼

⸻

给你一个“可直接拿去开会用”的结论句（不掺水）
•	LoCoMo & LongMemEval-S：目前最完整的“多方法同表对比榜单”，来自 Mnemis，并且同表给了 GPT-4o-mini vs GPT-4.1-mini 两套 backbone，可直接做控制变量分析。 ￼
•	PersonaMem：目前最清晰的“多方法同表对比榜单”，来自 RGMem，并且明确 128k 设置与多选题 accuracy 协议。 ￼
•	Mem2ActBench：作者自己给了“七种记忆框架 × 三个 Qwen2.5 尺度”的表格，变量控制非常干净。 ￼

⸻

如果你下一步想把这些榜单“喂给 Cat Café 的研究流程”，我建议我们马上做一件很实用的事：
把这些 Top 方法按 (写入机制 / 存储结构 / 检索策略 / 更新机制 / 多 Agent 共享难度) 打一个对照矩阵，直接映射到你们的 Working+封存架构里。
你一句话，我就按你们的 schema 维度把矩阵拉出来。 😼