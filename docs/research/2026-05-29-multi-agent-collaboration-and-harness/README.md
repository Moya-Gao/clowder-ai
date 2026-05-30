# Multi-Agent Collaboration & Code-as-Harness 论文集

> 收录日期：2026-05-29
> 主题：多 Agent 协作机制、Agent Harness 工程化、递归语言模型

---

## 1. Multi-Agent Teams Hold Experts Back

- **链接**：https://arxiv.org/abs/2602.01011
- **作者**：Aneesh Pappu, Batu El, Hancheng Cao, Carmelo di Nolfo, Yanchao Sun, Meng Cao, James Zou
- **关键词**：multi-agent synergy, expertise utilization, integrative compromise
- **摘要**：研究自组织 LLM 团队的协同效能。发现与人类团队不同，LLM 团队表现始终低于其最优个体成员（损失最高达 37.6%）。核心问题不在于识别专家，而在于利用专家知识——系统倾向于"整合妥协"（averaging expert and non-expert views），而非恰当加权专业意见。这种共识倾向虽然增强了对抗对抗性 agent 的鲁棒性，但与有效的专业能力利用形成显著 trade-off。

---

## 2. Recursive Language Models

- **链接**：https://arxiv.org/abs/2512.24601
- **作者**：Alex L. Zhang, Tim Kraska, Omar Khattab
- **关键词**：recursive inference, long-context, self-decomposition
- **摘要**：提出递归语言模型（RLMs），一种让 LLM 处理远超其上下文窗口长度 prompt 的推理方法。RLM 允许模型"程序化地检查、分解输入，并递归调用自身处理 prompt 片段"。实验表明该方法可处理比模型限制长 100 倍的输入，在多种基准上优于标准 LLM 和常见长上下文方法，且计算成本相当。团队还发布了 RLM-Qwen3-8B 微调模型。

---

## 3. AgentNet: Decentralized Evolutionary Coordination for LLM-based Multi-Agent Systems

- **链接**：https://proceedings.neurips.cc/paper_files/paper/2025/hash/9a379c1b05793d1c42dc832269834515-Abstract-Conference.html
- **来源**：NeurIPS 2025
- **作者**：Yingxuan Yang, Huacan Chai, Shuai Shao, Yuanyi Song, Siyuan Qi, Renting Rui, Weinan Zhang
- **代码**：https://github.com/zoe-yyx/AgentNet
- **关键词**：decentralized coordination, DAG topology, RAG-based evolution
- **摘要**：提出 AgentNet，一个去中心化、基于 RAG 的多 Agent 框架。Agent 在有向无环图（DAG）结构网络中自主演化能力并高效协作。核心创新：(1) 完全去中心化范式，移除中央编排器，agent 自主协调和专业化；(2) 动态演化的图拓扑，根据任务需求实时调整 agent 连接；(3) 基于检索的记忆系统实现自适应专业技能精炼。

---

## 4. G-Memory: Tracing Hierarchical Memory for Multi-Agent Systems

- **链接**：https://proceedings.neurips.cc/paper_files/paper/2025/hash/136a45cd9b841bf785625709a19c6508-Abstract-Conference.html
- **来源**：NeurIPS 2025
- **arXiv**：https://arxiv.org/abs/2506.07398
- **关键词**：hierarchical memory, organizational memory theory, graph hierarchy
- **摘要**：受组织记忆理论启发，提出层次化 agent 记忆系统 G-Memory，用于管理多 Agent 系统中的冗长交互历史。采用三层图层级结构：洞察图（insight graph）、查询图（query graph）和交互图（interaction graph），实现对 MAS 交互的高效组织和检索。

---

## 5. GUARDIAN: Safeguarding LLM Multi-Agent Collaborations with Temporal Graph Modeling

- **链接**：https://proceedings.neurips.cc/paper_files/paper/2025/hash/0bc795afae289ed465a65a3b4b1f4eb7-Abstract-Conference.html
- **来源**：NeurIPS 2025
- **arXiv**：https://arxiv.org/abs/2505.19234
- **关键词**：temporal graph, hallucination amplification, error propagation, safety
- **摘要**：将多 Agent 协作过程建模为离散时间时序属性图，显式捕获幻觉和错误的传播动力学。提出 GUARDIAN，一种用于检测和缓解多种安全问题的统一方法。采用基于编码器-解码器架构的无监督学习范式，从潜在嵌入中重建节点属性和图结构，识别偏离正常模式的异常，定位潜在的幻觉或错误。

---

## 6. TUMIX: Multi-Agent Test-Time Scaling with Tool-Use Mixture

- **链接**：https://openreview.net/forum?id=HBm3MFtszH
- **作者**：Yongchao Chen, Jiefeng Chen, Rui Meng, Ji Yin, Na Li, Chuchu Fan, Chi Wang, Tomas Pfister, Jinsung Yoon
- **关键词**：test-time scaling, tool-use ensemble, iterative refinement
- **摘要**：提出 TUMIX 集成框架，并行部署多个使用不同工具策略的 agent，agent 之间迭代共享和精炼响应以提升性能。相比 SOTA 工具增强和测试时缩放方法，平均准确率提升最高 3.55%。框架还支持提前终止精炼过程，在保持性能的同时将计算成本减半。

---

## 7. Code as Agent Harness

- **链接**：https://arxiv.org/abs/2605.18747
- **作者**：Xuying Ning, Katherine Tieu, Dongqi Fu, Tianxin Wei, Zihao Li, Yuanchen Bei, Jiaru Zou, Mengting Ai, Zhining Liu, Ting-Wei Li, Lingjie Chen, Yanjun Zhao, Ke Yang, Bingxuan Li, Cheng Qian, Gaotang Li, Xiao Lin, Zhichen Zeng, Ruizhong Qiu, Sirui Chen, Yifan Sun, Xiyuan Yang, Ruida Wang, Rui Pan, Chenyuan Yang, Dylan Zhang, Liri Fang, Zikun Cui, Yang Cao, Pan Chen, Dorothy Sun, Ren Chen, Mahesh Srinivasan, Nipun Mathur, Yinglong Xia, Hong Li, Hong Yan, Pan Lu, Lingming Zhang, Tong Zhang, Hanghang Tong, Jingrui He
- **关键词**：code-driven agent, harness interface, planning, tool use, multi-agent scaling
- **摘要**：综述性论文，审视代码如何作为 AI Agent 系统的基础设施。将编程语言作为 LLM 智能体的核心运行框架，让 Agent 通过生成、执行代码完成任务规划、工具调用与异常处理。分析覆盖三个层次：连接 agent 与推理/行动的 harness 接口层；包含规划与工具使用的 harness 机制层；从单 agent 到多 agent 系统的扩展层。应用范围从编码助手到科学发现，同时指出评估、验证和确保人类安全监督方面的开放挑战。

---

## 主题关联

这批论文涵盖 multi-agent 协作的几个关键维度：

| 维度 | 论文 |
|------|------|
| 协作效能与瓶颈 | #1 Multi-Agent Teams Hold Experts Back |
| 去中心化架构 | #3 AgentNet |
| 记忆与上下文管理 | #2 RLMs, #4 G-Memory |
| 安全与可靠性 | #5 GUARDIAN |
| 推理时扩展 | #6 TUMIX |
| 工程化范式（Code-as-Harness） | #7 Code as Agent Harness |

与 Cat Cafe 的关联点：
- **#1** 直接挑战"多猫协作一定优于单猫"的假设——我们的跨猫 review + 专家传球机制本质上在避免"整合妥协"陷阱
- **#3** AgentNet 的去中心化 DAG 拓扑 vs 我们的 A2A 传球协议是两种不同的多 agent 协调范式
- **#4** G-Memory 的三层图记忆 vs 我们的 session chain + graph_resolve + evidence search 是相似问题的不同解法
- **#5** GUARDIAN 的幻觉传播检测对应我们的跨猫 review 铁律——阻断错误在猫之间放大
- **#7** Code as Agent Harness 范式与我们的 workflow/skill 编排高度相关——LLM 生成代码驱动 agent 行为
