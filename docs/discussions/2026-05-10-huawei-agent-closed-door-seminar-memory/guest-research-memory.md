---
title: "嘉宾学术水平分析 — 记忆方向 4 位"
date: 2026-05-11
event_date: 2026-05-13
doc_kind: seminar-reference
status: final
author: "宪宪/Opus-46"
---

# 记忆方向嘉宾学术水平分析

> 针对与 Topic 1（Agent Memory）直接相关的 4 位嘉宾，基于公开论文、GitHub 项目、Google Scholar 数据做学术水平评估。
> 目的：知道谁在什么问题上有发言权，预判他们可能在哪里 push back。

---

## 1. 张桂彬（NUS-LV Lab）⭐ 记忆方向最直接对口

| 维度 | 评估 |
|---|---|
| **身份** | NUS 在读博士，导师颜水成（131K citations，AAAI/IEEE Fellow，e-AGI 方向） |
| **学术量级** | 博士生中非常突出——多篇"首篇综述"级论文，发表节奏极快 |
| **记忆相关深度** | ★★★★★ 最高 |

### 核心产出

| 论文/项目 | 发表 | 与我们的关系 |
|---|---|---|
| **Memory in the Age of AI Agents: A Survey** | arXiv 2512.13564, 2025-12 | **直接竞品综述**。提出 Forms(Token/Parametric/Latent) × Functions(Factual/Experiential/Working) × Dynamics(Formation/Evolution/Retrieval) 三维分类。我们的四层 substrate 是他 Forms 维度的展开 |
| **G-Memory: Hierarchical Memory for MAS** | arXiv 2506.07398, 2025-06 | **直接对应断裂点 2（多 agent 一致性）**。三层图结构：insight-query-interaction，让 agent 团队从协作历史中提取知识 |
| **A Survey of Self-Evolving AI Agents** | arXiv 2508.07407, 2025-08 | 首篇自进化 agent 综述，定义了 self-evolving agent 范式 |
| **EvoTest** | arXiv 2510.13220, 2025 | Test-time learning 框架——不更新梯度，通过轨迹分析自动优化 prompt/配置/工具 |
| **PASK + IntentFlow** | arXiv 2604.08000, 2026-04 | 主动性 agent + 流式意图检测 + LatentNeeds-Bench（首个主动性评测基准） |
| **EvoFlow** | arXiv 2502.07373, 2025 | 动态演化 agentic workflow |
| **EvoAgentX** | GitHub 开源 | 自进化 agent 生态系统 |

### 水平判断

**一句话：博士生里的超级新星，记忆+自进化的交叉领域已经抢到了定义权。**

优势：产出密度极高，多篇"第一篇"综述/benchmark。Memory survey 是当前最全面的记忆全景图。G-Memory 是少数真正做 multi-agent memory 的工作。导师颜水成的背书让这些工作有很高可见度。

局限：大部分是综述/框架/benchmark 类工作，缺少在大规模生产环境的验证。G-Memory 在真实多 agent 场景的实测数据有限。

### 他可能在哪里 push back 我们

1. **我们的四层 substrate vs 他的 Forms 三分**——他可能认为我们把 Latent Token 和 Activation State 分成两层是过度细分
2. **G-Memory 已经在做 multi-agent memory**——我们说"几乎未开垦"他可能不同意（但他的方案是图结构不是一致性协议，方向不同）
3. **Memory survey 已有的分类 vs 我们的"义肢"framing**——他可能从学术分类角度质疑义肢类比的理论基础

### 对话策略

主动引用他的 Memory survey 作为我们分析的出发点（"张老师的综述是目前最全面的全景图，我们在这个基础上进一步聚焦到治理维度"），然后把讨论引向他的 G-Memory 尚未覆盖的一致性协议问题。

---

## 2. 张宁豫（ZJU ZJUNLP）⭐ 记忆技术最深

| 维度 | 评估 |
|---|---|
| **身份** | 浙大软件学院副教授，陈华钧团队骨干，多次斯坦福全球前 2% |
| **学术量级** | 成熟研究者，在知识编辑/记忆领域有系统性布局 |
| **记忆相关深度** | ★★★★★ 最高（技术实现层面最深） |

### 核心产出

| 论文/项目 | 发表 | 与我们的关系 |
|---|---|---|
| **LightMem** | **ICLR 2026** | **直接相关**。受 Atkinson-Shiffrin 人类记忆模型启发的三阶段记忆：sensory memory（轻量压缩+分组）→ short-term（topic-aware 整合）→ long-term（sleep-time 离线更新）。比 baseline 准确率高 10.9%，token 用量降 117x，API 调用降 159x |
| **EasyEdit** | GitHub 2.8K+ stars | 知识编辑标准工具。与我们讨论的 Agentic Unlearning / 定向遗忘直接相关 |
| **Memp: Agent Procedural Memory** | arXiv 2508.06433, 2025 | 程序性记忆——把 agent 轨迹蒸馏成 step-by-step 指令 + 脚本抽象，动态更新/修正/废弃。与我们的 Wearing Protocol 有交集 |
| **SkillNet** | GitHub 开源, 2026-03 集成 JiuwenClaw | AI Skills 的创建/评估/组织平台 |
| **WISE: Lifelong Model Editing** | NeurIPS 2024 | 双参数化记忆（main memory + side memory）+ router 决策。参数化记忆的具体实现 |
| **KnowLM** | GitHub 开源 | 知识增强 LLM 框架 |
| **LightThinker** | 2025 | CoT 推理步骤动态压缩——推理中间记忆 |

### 水平判断

**一句话：知识编辑 + Agent 记忆领域的系统构建者，从工具（EasyEdit）到框架（LightMem）到理论（Memp）全栈覆盖。**

优势：技术实现深度最高。LightMem 是 ICLR 2026 接收的 memory 方案，117x token 降幅的工程数据非常实在。EasyEdit 是事实标准工具。WISE 的双记忆架构在参数化记忆领域有原创性。Memp 的程序性记忆角度是独特的。

局限：主要聚焦检索效率和知识编辑，治理维度（provenance / permission / delete propagation）不是他的主攻方向。

### 他可能在哪里 push back 我们

1. **LightMem 的 117x token 降幅 vs 我们说"检索两年内门槛归零"**——他可能认为检索效率仍然是高价值问题
2. **Memp 的程序性记忆 vs 我们没有区分 declarative/procedural**——他可能指出我们的记忆分类缺了程序性记忆这一维度
3. **EasyEdit 在知识编辑上的成熟度 vs 我们说"Agentic Unlearning 是早期赛道"**——他可能认为知识编辑已有成熟工具

### 对话策略

把 LightMem 定位为 Layer 2（Reflex Injection）的优秀实现，然后引导讨论到 Layer 3（Wearing Protocol / 佩戴协议）和 Governance Plane，这是他的产品线尚未覆盖的。Memp 的程序性记忆可以作为我们框架的延伸方向提及。

---

## 3. 陈旭（人大 ai-engine-lab）⭐ 应用落地最强

| 维度 | 评估 |
|---|---|
| **身份** | 人大高瓴人工智能学院长聘副教授，14,580 citations |
| **学术量级** | 成熟研究者，引用量在 4 人中最高 |
| **记忆相关深度** | ★★★★ 高（侧重评测+应用） |

### 核心产出

| 论文/项目 | 发表 | 与我们的关系 |
|---|---|---|
| **MemBench** | ACL 2025 Findings | Agent 记忆评测基准——factual memory + reflective memory，participation + observation 场景。与我们说"Memory Governance Benchmark 是空白"直接相关 |
| **RecAgent** | 2023-2025 | LLM agent 模拟真实用户行为的框架 |
| **AgentCF** | 2024 | 用户和物品都当 agent + memory module + collaborative reflection |
| **Hierarchical Preference Learning for Long-Horizon Agents** | **ICLR 2026** | 长程 agent 的分层偏好学习，解决粒度不匹配 |
| **华为在研：推荐智能体记忆机制** | 2024-05 立项 | **直接与华为合作做 Agent 记忆** |
| **华为在研：核心网优化 via Agent RL** | 2025-08 立项 | Agent RL 应用于电信场景 |

### 水平判断

**一句话：引用量最高的成熟学者，记忆评测（MemBench）+ 推荐 agent 记忆是他的独有优势，且有华为在研合作项目。**

优势：14K citations 说明长期学术影响力。MemBench 是少数系统评测 agent 记忆的工作。RecAgent / AgentCF 在推荐场景的 agent 记忆落地有实战经验。两个华为在研项目说明业界认可。ICLR 2026 长程 agent 论文说明近期产出仍活跃。

局限：记忆研究更偏应用（推荐场景），在记忆架构/治理的通用理论方面不如张桂彬和张宁豫。

### 他可能在哪里 push back 我们

1. **MemBench vs 我们说"Memory Governance Benchmark 还是空白"**——他可能认为 MemBench 已经在做（但 MemBench 测的是检索/反思能力，不是 provenance/delete/audit）
2. **华为合作项目的实际经验**——他可能带来我们不知道的企业级 agent 记忆实践
3. **推荐场景的记忆需求 vs 我们偏 coding agent 的视角**——他可能补充电商/推荐场景的不同需求

### 对话策略

MemBench 是很好的引子："陈老师的 MemBench 解决了记忆检索能力的评测，但 governance 维度（provenance / delete propagation / legal hold）的 benchmark 还是空白——这是我们认为的下一步机会"。他的华为合作项目经验要主动请教。

---

## 4. 骆昱宇（港科广 DIAL）⭐ 平台+开源影响力最大

| 维度 | 评估 |
|---|---|
| **身份** | 港科广 DSA 学域助理教授，DIAL 实验室主任 |
| **学术量级** | 50+ 论文（SIGMOD/VLDB/KDD/ICML/NeurIPS/ICLR/ACL），高质量+高产 |
| **记忆相关深度** | ★★★ 中（更偏 agent 平台和数据智能） |

### 核心产出

| 论文/项目 | 发表 | 与我们的关系 |
|---|---|---|
| **OpenManus** | GitHub 50K+ stars | 通用 AI agent 开源框架（对标 Manus），影响力最大的开源项目 |
| **AFlow** | **ICLR 2025 Oral** | 自动化 agentic workflow 生成。与 Topic 2（Harness）相关 |
| **Atom of Thoughts** | **NeurIPS 2025** | Markov LLM Test-Time Scaling |
| **Data Agents Tutorial** | **SIGMOD 2026** | "Data Agents: Levels, State of the Art, and Open Problems"——定义 data agent 层级 |
| **华为合作：Agent 文件系统自演进** | 2026 | **直接相关**——智能体文件系统 = 记忆作为文件系统的思路，呼应 Letta 74% filesystem 结论 |
| Alpha-SQL / DeepEye / Text-to-SQL | 多年积累 | 数据智能工具矩阵 |

### 水平判断

**一句话：学术产出质量高（ICLR Oral / NeurIPS），开源影响力极大（50K stars），但核心方向是 agent 平台+数据智能而非 memory 架构。**

优势：OpenManus 50K stars 是当前最有影响力的 agent 开源项目之一。ICLR Oral 含金量高。SIGMOD 2026 tutorial 说明在 data agent 领域有定义权。华为合作的"Agent 文件系统自演进"直接呼应我们引用的 Letta filesystem 论点。

局限：在 memory 架构/治理方面没有专门的论文产出。强项在 agent 平台和数据操作层面。

### 他可能在哪里 push back 我们

1. **OpenManus 的实战经验 vs 我们偏理论的框架**——他可能从工程实践角度质疑某些断裂点的优先级
2. **"Agent 文件系统"路线 vs 我们的"义肢"framing**——他的华为合作项目走的是文件系统路线，可能认为 filesystem > graph/vector
3. **AFlow 的 workflow 自动生成 vs 我们在 Topic 2 的讨论**——横跨两个课题

### 对话策略

他是 Topic 1 + Topic 2 的交叉人物。在 Topic 1 中，主动引用 Letta 74% filesystem 结论并链接到他的华为"Agent 文件系统"合作——"骆老师和华为的合作恰好在验证这个方向"。把他的 OpenManus 实战经验作为工程视角的补充。

---

## 四人对照：谁在什么问题上最有发言权

| 我们的论点 | 最相关嘉宾 | 风险 |
|---|---|---|
| 两个阵营（模仿人脑 vs LLM 天性） | 张桂彬（Memory survey 作者） | 他可能不认可这个二分法的准确性 |
| 检索门槛归零 | 张宁豫（LightMem 117x 降幅） | 他可能认为检索效率仍是高价值 |
| 治理是长期瓶颈 | 陈旭（MemBench） | 他可能认为评测比治理更紧迫 |
| 断裂点 2 多 agent 一致性 | 张桂彬（G-Memory） | 他已经在做，可能认为不是"未开垦" |
| 断裂点 5 佩戴协议 | 张宁豫（Memp 程序性记忆） | 他可能认为 Memp 就是一种佩戴协议 |
| Agentic Unlearning | 张宁豫（EasyEdit） | 他可能认为知识编辑已有成熟工具 |
| Filesystem 路线 | 骆昱宇（华为 Agent 文件系统） | 他可能推 filesystem > 我们的抽象框架 |
| Memory Governance Benchmark 空白 | 陈旭（MemBench） | MemBench 和 Governance Benchmark 的边界要讲清楚 |

---

## 总体水平评估

| 嘉宾 | 学术量级 | 记忆深度 | 工程影响 | 与我们 Topic 1 的对口度 |
|---|---|---|---|---|
| 张桂彬（NUS） | ★★★★ 博士生顶格 | ★★★★★ | ★★★ | **最高**——Memory survey + G-Memory |
| 张宁豫（ZJU） | ★★★★★ | ★★★★★ | ★★★★ | **最高**——LightMem + EasyEdit + Memp |
| 陈旭（RUC） | ★★★★★ 14K citations | ★★★★ | ★★★ | **高**——MemBench + 华为在研 |
| 骆昱宇（HKUST-GZ） | ★★★★★ ICLR Oral | ★★★ | ★★★★★ 50K stars | **中**——平台方向，但有华为 Agent 文件系统合作 |

**结论**：这不是一般水平的嘉宾——4 位都是各自方向的一线研究者。张桂彬和张宁豫在记忆领域的论文产出直接和我们的发言稿竞争同一话题空间。好消息是我们的发言稿已经引用了相关工作并做了 contrarian 护甲；需要注意的是不要 overclaim "空白"/"未开垦"——他们正在开垦。

Sources:
- [Memory in the Age of AI Agents](https://arxiv.org/abs/2512.13564)
- [G-Memory](https://arxiv.org/abs/2506.07398)
- [Self-Evolving Agents Survey](https://arxiv.org/abs/2508.07407)
- [EvoTest](https://arxiv.org/html/2510.13220v1)
- [PASK + IntentFlow](https://arxiv.org/abs/2604.08000)
- [LightMem (ICLR 2026)](https://github.com/zjunlp/LightMem)
- [EasyEdit](https://github.com/zjunlp/EasyEdit)
- [Memp](https://github.com/zjunlp/MemP)
- [SkillNet](https://github.com/zjunlp/SkillNet)
- [MemBench (ACL 2025)](https://aclanthology.org/2025.findings-acl.989/)
- [Hierarchical Preference Learning (ICLR 2026)](https://scholar.google.com/citations?user=loPoqy0AAAAJ)
- [OpenManus](https://github.com/FoundationAgents/OpenManus)
- [AFlow (ICLR 2025 Oral)](https://luoyuyu.vip/)
- [SIGMOD 2026 Data Agents Tutorial](https://luoyuyu.vip/files/SIGMOD26-Tutorial-DataAgents.pdf)
- [Yuyu Luo Faculty Profile](https://facultyprofiles.hkust-gz.edu.cn/faculty-personal-page/LUO-Yuyu/yuyuluo)
- [ai-engine-lab](http://www.ai-engine-lab.com/)

[宪宪/Opus-46🐾]
