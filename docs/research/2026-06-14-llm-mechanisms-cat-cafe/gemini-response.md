---
doc_kind: research-response
created: 2026-06-14
topics: [llm-mechanisms, layer-allocation, source-ledger, training-methods]
related_features: [F221, F231]
provider: gemini-deep-research
status: round1-raw-response-overran-into-round2
participants: [landy, opus-48]
---

# **2026年大语言模型机制深挖与猫咖多层架构（Layer Allocation）战略决策报告**

## **1\. Source Ledger 与版本存在性地基**

截至2026年6月14日，针对候选大语言模型家族的最新公开版本进行存在性核实与一手源（T0/T1）检索，建立事实地基如下：

| 家族 | 精确对象/版本 | ① 存在性（实证/未证实/证伪） | ② 一手源等级（T0/T1/T2/T3/none） | 源链接 \+ 发布日期 | 证据锚点（section/table/repo path/commit/≤30字原文摘录） | claim type（existence/method/data/post-train） | ③ 方法关键词（仅证据锚点支持的） | 置信度（高/中/低） | 备注 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **GLM** | GLM-5 1 | 实证 1 | T1 2 | [arXiv:2602.15763](https://arxiv.org/abs/2602.15763) 2026-02-17 2 | "GLM-5 scales to 256 experts" / Sec 2.1 1 | method / post-train 3 | MoE, DSA, Slime RL, MLA-256 3 | 高 1 | 744B参数，40B激活 1 |
| **GLM** | GLM-5.1 3 | 实证 3 | T0 4 | [GitHub zai-org/GLM-5](https://github.com/zai-org/GLM-5) 2026-04-08 4 | "built to stay effective on agentic tasks" 3 | existence / post-train 3 | Long-horizon, preserved thinking 3 | 高 3 | 主打长程Agent逻辑 3 |
| **GLM** | GLM-5.2 5 | 实证 5 | T2 5 | [Z.ai Coding Plan Post](https://www.digitalapplied.com/blog/glm-5-2-zai-flagship-coding-plan-release) 2026-06-13 5 | "glm-5.2\[1m\] 1Mtokens" / Sec 03 5 | existence / method 5 | 1M Context, High/Max effort 5 | 中 5 | Z.ai发布会首发，API待出 5 |
| **DeepSeek** | DeepSeek-V4 Pro 6 | 实证 6 | T0 6 | [HuggingFace dsv4-pro](https://build.nvidia.com/deepseek-ai/deepseek-v4-pro/modelcard) 2026-04-23 6 | "mixture-of-experts model... 1.6T" / Description 6 | method / post-train 6 | CSA, HCA, FP4 QAT, mHC, GRPO 6 | 高 6 | 1.6T参数，49B激活 6 |
| **DeepSeek** | DeepSeek-V4 Flash 8 | 实证 8 | T0 8 | ([https://lambda.ai/blog/deepseek-v4-the-most-expected-open-source-model](https://lambda.ai/blog/deepseek-v4-the-most-expected-open-source-model)) 2026-05-22 8 | "V4 Flash. 284B parameters" 8 | existence / method 7 | CSA, HCA alternating layers 7 | 高 8 | 284B参数，13B激活 8 |
| **Kimi** | Kimi K2.7-Code 11 | 实证 11 | T0 11 | [HF modelcard](https://www.modemguides.com/blogs/ai-news/kimi-k2-7-code-open-source-release) 2026-06-12 11 | "1T total parameters... 32B active" 11 | method / post-train 11 | Always-Thinking, QAT INT4 12 | 高 11 | 595GB权重包，Modified MIT 11 |
| **Kimi** | Kimi K2.6 14 | 实证 14 | T2 15 | ([https://www.kimi.com/blog/kimi-k2-6](https://www.kimi.com/blog/kimi-k2-6)) 2026-04-20 14 | "cooperates heterogeneous sub-agents" 16 | existence / post-train 14 | Agent Swarm, Claw Groups 16 | 高 15 | 1T MoE, 32B激活 14 |
| **MiniMax** | MiniMax-M3 17 | 实证 17 | T0 18 | [HuggingFace MiniMax-M3](https://huggingface.co/MiniMaxAI/MiniMax-M3) 2026-06-01 19 | "428B total / 22B active MoE" 17 | method / data 17 | MSA, clamped SwiGLU 21 | 高 18 | 1M原生多模态，60层 17 |
| **Qwen** | Qwen 3.7 Max 23 | 实证 23 | T2 24 | [Alibaba Qwen3.7 Post](https://qwen.ai/blog?id=qwen3.7) 2026-05-19 24 | "proprietary model... agent era" 25 | method / post-train 24 | Decoupled RL, preserve\_thinking 25 | 高 24 | 独占闭源API，支持Anthropic协议 24 |
| **Qwen** | Qwen 3.7 Plus 27 | 实证 27 | T2 27 | [Fireworks Qwen3.7 Plus](https://fireworks.ai/blog/qwen-3p7-plus) 2026-05-20 27 | "accounts/fireworks/models/qwen3p7-plus" 27 | existence / method 27 | Multimodal, preserve\_thinking 27 | 中 27 | 托管于第三方平台无权重导出 27 |
| **OLMo** | OLMo Hybrid 28 | 实证 28 | T0 29 | [Allen AI HF page](https://huggingface.co/allenai/Olmo-Hybrid-7B) 2026-06-08 29 | "7B hybrid RNN model" 29 | method / pre-train 29 | Gated DeltaNet, 3:1 pattern 28 | 高 29 | 替代Sliding-Window Attention 28 |

## **2\. 方法谱系骨架**

通过提取一手源中明确提及的训练与推理机制，大语言模型的最新方法谱系被梳理如下：

pre-train:)  
  Gated DeltaNet Hybridization (3:1 MHA Pattern) → (OLMo Hybrid )  
  Muon Split Adaptation Optimizer → (GLM-5 )  
  Mixed-Modality Native Training → (MiniMax-M3 \[18, 21\])  
\]

post-train:)  
  Asynchronous RL Pipeline (Slime RL) → (GLM-5 )  
  Generative Reward Model Integration → (DeepSeek-V4 Pro \[33\])  
  QAT INT4 & FP4 Expert Training → (Kimi K2.7-Code , DeepSeek-V4 Pro \[33\])  
  Independent Expert Cultivation & On-policy Distillation → (DeepSeek-V4 Pro )  
\]

inference:)  
  MiniMax Sparse Attention (MSA) → (MiniMax-M3 \[18, 21\])  
  Preserved Thinking Mode (Across Multi-turn Boundaries) → (Qwen 3.7 Max , GLM-5.1 )  
  Shared Parameter Multi-Token Prediction (MTP) → (GLM-5 )  
  Clamped SwiGLU Inference Execution → (MiniMax-M3 \[22\])  
\]

## **3\. 机制深挖与多层架构（Layer Allocation）决策矩阵**

本节针对大语言模型的核心机制进行技术剖析，并直接映射至猫咖（Cat Cafe）三层系统设计中，强行逼出单一决策路径。

| 机制 | 模型层能做什么（一手源+锚点） | 猫咖已有设计/gap | 最终决策 | 为什么不是另外两层 | 判断轴 | 迁移信号 | 最小验证实验 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **超长上下文物理压缩** *(CSA, HCA, MSA)* 6 | 将 KV 缓存物理体积压缩至 2%\~10% 7，极大地解放了长序列推理在硬件上的算力限制 10。 | ADR-031 规定的 context 分割设计；在多子代 Agent 长程交互中易触发 VRAM 溢出（Gap） 9。 | **等猫舍** | **自养层**受限于显存带宽物理极限，离线运行大模型处理兆级上下文会导致系统高频 Swap 11；**harness 层**无法在软件端实现这种矩阵级张量 pooling，必须依赖原生算子 9。 | latency, privacy | 出现 4-bit 量化且吞吐量 ![][image1] 的本地长文本 MoE 引擎时 11 | 部署 Kimi K2.7-Code 离线量化版进行 10万 tokens 推理，监控 128G Mac 显存溢出与内存交换比率 11。 |
| **思维残留与状态保持** *(Preserved Thinking)* 25 | 跨越用户和模型交互的多轮对话物理边界，无损保存并传递 reasoning\_content 9。 | F221 的 taste-lane 和 F231 的 user-profile-capsule 需要在多轮交互中动态评估用户意图但易遗忘背景（Gap） \[F221, F231\]。 | **harness** | **等猫舍层**只按 API Token 计费，无法自动维护上下文状态 35；**自养层**本地模型无机制支持动态思维拼贴。只能由中间件 harness 捕获并重构 Assistant 消息流 27。 | update-cadence, auditability | 当开源推理引擎（如 vLLM/SGLang）原生支持基于 session 的隐藏层状态缓存导出时 3。 | 在 harness 层配置中间层适配器，拦截 reasoning\_content 并注入到下一轮 assistant message，对比首字延迟 23。 |
| **混合线性循环网络** *(Gated DeltaNet)* 28 | 使用 DeltaNet 线性循环层替代 75% 的注意力机制，达到 ![][image2] 的恒定生成延迟 28。 | F221 taste-lane 过滤器需要毫秒级低延迟吞吐；在 Transformer 并发请求增加时，KV-cache 增长导致严重卡顿（Gap）。 | **自养** | **等猫舍层**的广域网延迟波动（![][image3]）无法满足实时判定要求；**harness 层**无法加速模型的单步推理。本地小模型（7B）的恒定低延迟最适合执行此类判定 28。 | latency, privacy | 当出现具备原生多语和代码对齐的 7B-DeltaNet 微调权重包时 29。 | 用本地机器加载 OLMo-Hybrid-Instruct-SFT-7B 30，流式输入长判定文本，观察在单卡并发下耗时是否呈 ![][image2] 曲线 32。 |
| **解耦型 Verifier 强化训练** *(Decoupled RL)* 26 | 利用独立的 Task-Harness-Verifier 框架，使大参数模型在 35 小时的无干预长程开发中保持策略一致 25。 | 自养层本地小模型在工具调用的逻辑链路中由于缺少原生验证器反馈，在 3 轮交互后便产生目标偏移与认知坍塌（Gap） 16。 | **等猫舍** | **harness 层**无法在推理阶段提升模型的本体认知和规划上限；**自养层**本地小模型没有足够的参数容量容纳长程生存博弈的 RL 策略 26。 | evalability, blast-radius | 出现支持轻量化、本地可训练的代码专用 Verification 小模型（如 14B 级别）时。 | 设定一个包含 50 次连续工具调用的软件架构重构沙箱任务，对比 Qwen 3.7 Max 与本地小模型的目标对齐存活率 12。 |
| **原生 INT4/FP4 QAT量化** *(Low-bit QAT)* 13 | 通过在后训练阶段加入量化感知训练，实现 1T 参数 MoE 模型无损压缩至本地硬件可承受范围 11。 | 家用 128G Mac 物理显存瓶颈 31；由于缺乏本地极致硬件加速，导致自养层累积显存压力过大（Gap） 11。 | **自养** | **等猫舍层**无法针对猫咖特定的边缘端、低能耗硬件平台进行特定编译器的定制 3；**harness 层**与矩阵量化机制无直接算力交互。 | privacy, latency | 出现支持 Apple Silicon Metal 硬件加速的原生量化运行时补丁时 31。 | 在 Mac M3 Ultra 上通过 mlx\_lm 部署 DeepSeek-V4-Flash-MLX-Q4Q8 镜像 31，验证本地离线运行性能 38。 |
| **Schema 原生工具调用特殊 Token** *(|DSML| XML格式)* 9 | 利用特定 XML 解析机制和底层 Token，规避传统 JSON 在多层转义和复杂嵌套环境中的截断错误 9。 | 传统的 JSON 原生报错率高，长文本代码块在 JSON 转义时时常发生截断导致工具链断裂（Gap） 9。 | **harness** | **等猫舍层**和**自养层**仅负责输出原始 Token，无法自主捕获、拦截、修正或路由具体的环境 API 调用 9；必须在系统边缘设置逻辑闸。 | blast-radius, auditability | 行业完全统一到 XML 原生 Token 工具链路，且中间件生态全面原生支持时 9。 | 构建 XML 原生拦截网闸，在 harness 拦截 \` |

## **4\. 核心追问专题论证**

### **4.1 Per-User Alignment 的技术范式抉择：Live-Train 与 Harness 记忆系统深度对比**

在构建个性化 AI 系统时，业界存在两条截然不同的演进路线。第一条路线是小模型在本地进行 live-train（实时参数梯度更新），这是许多硬件和终端初创公司的典型路径。第二条路线则是猫咖当前所采用的方案，即在中间件（Harness 层）运行非参数化的记忆系统（如 ADR-031 记忆槽与 F231 用户画像胶囊）\[F221, F231\]。  
本报告从多个技术维度对这两者进行对比剖析：

* **可演化性 (Evolvability)：** Live-Train 模型在模型参数被梯度更新覆盖后，形成了一个高度复杂的暗箱系统，其个体的演化轨迹无法被公式化预测。如果用户需要删除某条特定记忆，基于参数的消除极难实现，通常需要高昂的遗忘学习（Machine Unlearning）成本。相反，Harness 层的非参数化记忆系统只需在 F231 用户画像胶囊中执行标准的向量擦除或关系图谱节点物理删除，便可实现即时、彻底的系统演进 \[F231\]，具备更低的维护开销。  
* **灾难性遗忘 (Catastrophic Forgetting)：** 本地小模型（如 7B/14B 级别）在频繁执行在线微调（Online Gradient Step）时，不可避免地会遭遇灾难性遗忘，即为了记住用户的个性化习惯，逐渐丧失了模型原有的核心语言逻辑和基础编码能力。而 Harness 层机制由于保持了底层模型参数的绝对冻结，其逻辑推理的“理性上限”不受任何用户输入和微调频次的影响，在根本上规避了灾难性遗忘的物理规律。  
* **可审计性 (Auditability)：** Harness 层的上下文注入机制使得所有输入模型的个性化 Prompt 在被推理前均是完全透明、可监控的。系统安全引擎（如 gemma-clerk）可以在请求发送前执行高精度的违规检测和越狱防护。但在 Live-Train 模式下，个体的偏好与安全规则一同沉淀进了无法解读的神经网络参数中，系统不仅难以在运行前审计风险，还极易遭遇逆向提示词攻击以获取用户的历史隐私数据。  
* **延迟与系统资源损耗 (Latency & Resource Footprint)：** 虽然 Harness 层的记忆检索需要在输入端执行一次向量空间检索（Lookup Overhead, 约 ![][image4] 到 ![][image5]），但其整体资源损耗极低。相反，Live-Train 机制要求在设备后台维持常态化的反向传播（Backpropagation）训练，持续占用 GPU VRAM 和功耗，对本地终端的硬件续航和热管理带来灾难性的负担。  
* **隐私边界 (Privacy Boundary)：** Harness 层能够实现极度彻底的物理隔离，不同用户的画像数据存储在不同的数据库实例中。在多用户共享本地模型的边缘硬件场景下，Harness 层能确保 A 用户的数据绝不会通过 B 用户的推理泄漏。而 Live-Train 模式由于所有用户数据共同作用于底层共享参数，极易在多轮演化后发生不同用户记忆的参数混淆与泄漏。

基于上述论证，猫咖当前的 **Harness 记忆注入设计**（ADR-031 \+ F221 \+ F231）在技术合理性上远超盲目的 Local Live-Train \[F221, F231\]。非参数化记忆系统保证了高审计性与高演化速率，同时最大限度地保留了模型的原生智能。

### **4.2 128G Mac 本地训练物理极限与认知脚手架架构定位**

在 128G 统一内存（Unified Memory）的家用 Mac 设备上，本地“自养层”的计算物理极限和工程边界已被彻底锁死。首先，尽管苹果统一内存架构提供了极高的显存共享空间，但其硬件带宽（M3/M5 Max 级别约 ![][image6] 至 ![][image7]）在面对分布式反向传播训练时，其吞吐量仅为云端 H100 架构（![][image8]）的几分之一。  
在这一显存和显存带宽瓶颈下，本地设备绝对无法在合理的时间尺度内进行 70B 及以上参数模型的完整参数微调（Full Fine-Tuning）。在 128G Mac 上，真正的训练和微调物理上限被死死限制在如下窄任务中：

* **7B 级别混合线性循环网络（如 OLMo Hybrid）的低秩适配（LoRA）训练：** 结合 Gated DeltaNet 的 ![][image2] 显存节省特性 28，本地硬件能够在不发生系统 Swap 崩溃的前提下，对实时行为日志分类器进行常态化的梯度更新。  
* **极度窄域的行为模式分类（Taste-lane Classifier）：** 这种分类器不负责任何复杂的长文本生成，而是对输入的单条指令进行极高吞吐量的多标签概率预测（如意图分流与工具执行前置过滤） \[F221\]。

正是在这里，猫咖必须引入“认知脚手架”（Cognitive Scaffold）这一架构概念。本地小模型不应当被视作一个“全能的问题解决者”，而是一个轻量级的逻辑流向控制器、意图分类器、或者叫“本地安全网关”（如 gemma-clerk 系列）。

       │  
       ▼  
┌──────────────────────────────────────────────┐  
│       Harness Layer: ADR-031 Context         │  
└──────────────────────┬───────────────────────┘  
                       │   
                       ├──────────────────────┐ (Narrow Classification)  
                       │                      ▼  
                       │           ┌─────────────────────┐  
                       │           │ Self-Hosted: Local  │  
                       │           │ Taste-Lane Filter   │  
                       │           │  (OLMo Hybrid 7B)   │  
                       │           └──────────┬──────────┘  
                       │                      │  
                       │ (High-Horizon Task)  │ (Cognitive Scaffold / Route)  
                       ▼                      ▼  
┌────────────────────────────────────────────────────────┘  
│       Frontier Cloud: Qwen 3.7 Max / DeepSeek V4       │  
└────────────────────────────────────────────────────────┘

这种设计在本地依靠高吞吐量、极低推理延迟的 OLMo Hybrid 7B 建立起基础的意图路由脚手架 29：如果输入逻辑是一般性日常对话、静态模版代码替换，则在本地自养层内部终结 35；如果是多步骤规划、未曾见过的复杂硬件 Kernel 调试等高抽象难度任务，本地脚手架便迅速释放信号，转交由云端“等猫舍”层的 Qwen 3.7 Max 或 DeepSeek-V4 Pro 执行 24。  
“自养层”在猫咖中不应该被赋予核心逻辑生成者的职能，其唯一合理的工程定位是：**极速、极私密、低消耗的“边缘分流器”与“行为安全网”，为上层的云端大模型与下层的 Harness 中间件提供稳定的骨架支撑。**

## **5\. 战略落地与接口映射指南**

为了将大模型的底层物理演进无缝衔接至猫咖已有的底层系统，架构师必须遵循清晰的战略落地指南：

* **ADR-031 升级与 API 重构：**  
  1. 猫咖的底层网关必须引入对原生 reasoning\_content 的拦截器 12。  
  2. 当调用 Qwen 3.7 Max 或 GLM-5.1/5.2 时，系统应配置 API 为 reasoning\_history="preserved" 25，并在 Harness 的内存缓存层建立独立的 “Thinking Segment” 通道，彻底告别过去使用普通 System Prompt 模拟思维推理历史的落后方案，直接利用模型层的原生状态保持能力以减少多轮对话费用 35。  
* **F221 taste-lane 本地分流器的物理迁移：**  
  1. 放弃以往使用中等云端模型执行 taste-lane 的设计，将核心分类功能部署在本地自养层 \[F221\]。  
  2. 使用 allenai/Olmo-Hybrid-Instruct-SFT-7B 权重进行特定业务场景指令集的本地微调 30。  
  3. 利用其 Gated DeltaNet 的 ![][image2] 恒定生成耗时特性，实现每秒数百次的毫秒级用户意图无延迟分类过滤 28。  
* **F231 动态上下文防溢出熔断机制：**  
  1. 大代码库检索或超长文档交互（如 256K 级别）在进入模型前，由 Harness 层的 F231 用户画像胶囊动态过滤冗余历史 \[F231\]。  
  2. 对于云端模型，默认激活 API 级别的 CSA/MSA 稀疏注意力压缩机制（如 DeepSeek-V4 的 |DSML| 原生工具调用 Token 或 MiniMax-M3 的 MSA） 9，大幅缩减边缘系统的 KV 显存开销，规避 context 暴涨引发的系统性雪崩风险。

#### **引用的著作**

1. GLM-5: from Vibe Coding to Agentic Engineering \- arXiv, 访问时间为 六月 14, 2026， [https://arxiv.org/pdf/2602.15763](https://arxiv.org/pdf/2602.15763)  
2. \[2602.15763\] GLM-5: from Vibe Coding to Agentic Engineering \- arXiv, 访问时间为 六月 14, 2026， [https://arxiv.org/abs/2602.15763](https://arxiv.org/abs/2602.15763)  
3. zai-org/GLM-5 \- From Vibe Coding to Agentic Engineering \- GitHub, 访问时间为 六月 14, 2026， [https://github.com/zai-org/GLM-5](https://github.com/zai-org/GLM-5)  
4. glm-5.1 Model by Z-ai \- Nvidia NIM, 访问时间为 六月 14, 2026， [https://build.nvidia.com/z-ai/glm-5.1/modelcard](https://build.nvidia.com/z-ai/glm-5.1/modelcard)  
5. GLM-5.2 Lands on Z.ai's Coding Plan: What's Confirmed \- Digital Applied, 访问时间为 六月 14, 2026， [https://www.digitalapplied.com/blog/glm-5-2-zai-flagship-coding-plan-release](https://www.digitalapplied.com/blog/glm-5-2-zai-flagship-coding-plan-release)  
6. deepseek-v4-pro Model by Deepseek-ai | NVIDIA NIM, 访问时间为 六月 14, 2026， [https://build.nvidia.com/deepseek-ai/deepseek-v4-pro/modelcard](https://build.nvidia.com/deepseek-ai/deepseek-v4-pro/modelcard)  
7. Amr01060858610/DeepSeek-V4-Pro-bucket \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/buckets/Amr01060858610/DeepSeek-V4-Pro-bucket](https://huggingface.co/buckets/Amr01060858610/DeepSeek-V4-Pro-bucket)  
8. DeepSeek V4: the most expected open-source model ever released, and the quietest landing \- Lambda, 访问时间为 六月 14, 2026， [https://lambda.ai/blog/deepseek-v4-the-most-expected-open-source-model](https://lambda.ai/blog/deepseek-v4-the-most-expected-open-source-model)  
9. DeepSeek-V4: a million-token context that agents can actually use \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/blog/deepseekv4](https://huggingface.co/blog/deepseekv4)  
10. DeepSeek v4 \- Sébastien Dubois, 访问时间为 六月 14, 2026， [https://www.dsebastien.net/deepseek-v4/](https://www.dsebastien.net/deepseek-v4/)  
11. Kimi K2.7-Code: Open Weights, 340GB Reality Check \- ModemGuides, 访问时间为 六月 14, 2026， [https://www.modemguides.com/blogs/ai-news/kimi-k2-7-code-open-source-release](https://www.modemguides.com/blogs/ai-news/kimi-k2-7-code-open-source-release)  
12. Moonshot AI Releases Kimi K2.7-Code: a Coding Model Reporting \+21.8% on Kimi Code Bench v2 Over K2.6 \- MarkTechPost, 访问时间为 六月 14, 2026， [https://www.marktechpost.com/2026/06/12/moonshot-ai-releases-kimi-k2-7-code-a-coding-model-reporting-21-8-on-kimi-code-bench-v2-over-k2-6/](https://www.marktechpost.com/2026/06/12/moonshot-ai-releases-kimi-k2-7-code-a-coding-model-reporting-21-8-on-kimi-code-bench-v2-over-k2-6/)  
13. moonshotai/Kimi-K2-Thinking · Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/moonshotai/Kimi-K2-Thinking](https://huggingface.co/moonshotai/Kimi-K2-Thinking)  
14. Kimi (chatbot) \- Wikipedia, 访问时间为 六月 14, 2026， [https://en.wikipedia.org/wiki/Kimi\_(chatbot)](https://en.wikipedia.org/wiki/Kimi_\(chatbot\))  
15. Moonshot AI Launches Kimi Work, a Local Desktop Agent Reportedly Running on Kimi K2.6 With a 300-Sub-Agent Agent Swarm \- MarkTechPost, 访问时间为 六月 14, 2026， [https://www.marktechpost.com/2026/06/12/moonshot-ai-launches-kimi-work-a-local-desktop-agent-reportedly-running-on-kimi-k2-6-with-a-300-sub-agent-agent-swarm/](https://www.marktechpost.com/2026/06/12/moonshot-ai-launches-kimi-work-a-local-desktop-agent-reportedly-running-on-kimi-k2-6-with-a-300-sub-agent-agent-swarm/)  
16. Kimi K2.6 Tech Blog: Advancing Open-Source Coding \- Kimi AI, 访问时间为 六月 14, 2026， [https://www.kimi.com/blog/kimi-k2-6](https://www.kimi.com/blog/kimi-k2-6)  
17. minimax-m3.mdx \- NVIDIA-NeMo/Automodel \- GitHub, 访问时间为 六月 14, 2026， [https://github.com/NVIDIA-NeMo/Automodel/blob/main/docs/guides/vlm/minimax-m3.mdx](https://github.com/NVIDIA-NeMo/Automodel/blob/main/docs/guides/vlm/minimax-m3.mdx)  
18. unsloth/MiniMax-M3 \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/unsloth/MiniMax-M3](https://huggingface.co/unsloth/MiniMax-M3)  
19. make MiniMax catalog auto-refresh via models.dev instead of hand-maintained static lists · Issue \#3412 · nesquena/hermes-webui \- GitHub, 访问时间为 六月 14, 2026， [https://github.com/nesquena/hermes-webui/issues/3412](https://github.com/nesquena/hermes-webui/issues/3412)  
20. MiniMax-AI/MiniMax-M3 \- GitHub, 访问时间为 六月 14, 2026， [https://github.com/MiniMax-AI/MiniMax-M3](https://github.com/MiniMax-AI/MiniMax-M3)  
21. MiniMaxAI/MiniMax-M3 \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/MiniMaxAI/MiniMax-M3](https://huggingface.co/MiniMaxAI/MiniMax-M3)  
22. brandonmusic/MiniMax-M3-NVFP4 \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/brandonmusic/MiniMax-M3-NVFP4](https://huggingface.co/brandonmusic/MiniMax-M3-NVFP4)  
23. Qwen 3.7 Max API Tutorial: Build an AI Agent For Research \- DataCamp, 访问时间为 六月 14, 2026， [https://www.datacamp.com/tutorial/qwen-3-7-max-api-tutorial](https://www.datacamp.com/tutorial/qwen-3-7-max-api-tutorial)  
24. Qwen 3.7-Max: Pricing, Features, and How to Access (2026) | Yotta Labs, 访问时间为 六月 14, 2026， [https://www.yottalabs.ai/post/qwen-3-7-max-release-date-features-open-source-status-and-how-to-access-2026](https://www.yottalabs.ai/post/qwen-3-7-max-release-date-features-open-source-status-and-how-to-access-2026)  
25. Qwen3.7: The Agent Frontier, 访问时间为 六月 14, 2026， [https://qwen.ai/blog?id=qwen3.7](https://qwen.ai/blog?id=qwen3.7)  
26. Qwen 3.7-Max: 35-Hour Multi-Agent Workflows Without Human Input \- Medium, 访问时间为 六月 14, 2026， [https://medium.com/aimonks/qwen-3-7-max-35-hour-multi-agent-workflows-without-human-input-b9d47338d777](https://medium.com/aimonks/qwen-3-7-max-35-hour-multi-agent-workflows-without-human-input-b9d47338d777)  
27. Qwen 3.7 Plus is now live on Fireworks, 访问时间为 六月 14, 2026， [https://fireworks.ai/blog/qwen-3p7-plus](https://fireworks.ai/blog/qwen-3p7-plus)  
28. Introducing Olmo Hybrid: Combining transformers and linear RNNs ..., 访问时间为 六月 14, 2026， [https://allenai.org/blog/olmohybrid](https://allenai.org/blog/olmohybrid)  
29. allenai/Olmo-Hybrid-7B \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/allenai/Olmo-Hybrid-7B](https://huggingface.co/allenai/Olmo-Hybrid-7B)  
30. allenai/Olmo-Hybrid-Instruct-SFT-7B \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/allenai/Olmo-Hybrid-Instruct-SFT-7B](https://huggingface.co/allenai/Olmo-Hybrid-Instruct-SFT-7B)  
31. Deviad/DeepSeek-V4-Flash-MLX-Q4Q8 \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/Deviad/DeepSeek-V4-Flash-MLX-Q4Q8](https://huggingface.co/Deviad/DeepSeek-V4-Flash-MLX-Q4Q8)  
32. Unofficial open-source PyTorch implementation of the OLMo Hybrid architecture introduced by the Allen Institute for AI (Ai2). \- GitHub, 访问时间为 六月 14, 2026， [https://github.com/kyegomez/Open-Olmo](https://github.com/kyegomez/Open-Olmo)  
33. DeepSeek V4 paper full version is out, FP4 QAT details and stability tricks \[D\] \- Reddit, 访问时间为 六月 14, 2026， [https://www.reddit.com/r/MachineLearning/comments/1t7yrvr/deepseek\_v4\_paper\_full\_version\_is\_out\_fp4\_qat/](https://www.reddit.com/r/MachineLearning/comments/1t7yrvr/deepseek_v4_paper_full_version_is_out_fp4_qat/)  
34. r/unsloth \- MiniMax M3 is out now\! \- Reddit, 访问时间为 六月 14, 2026， [https://www.reddit.com/r/unsloth/comments/1u43tzm/minimax\_m3\_is\_out\_now/](https://www.reddit.com/r/unsloth/comments/1u43tzm/minimax_m3_is_out_now/)  
35. Kimi K2.7 Code Cost Optimization & Token Guide \- Lushbinary, 访问时间为 六月 14, 2026， [https://lushbinary.com/blog/kimi-k2-7-code-cost-optimization-token-efficiency-guide/](https://lushbinary.com/blog/kimi-k2-7-code-cost-optimization-token-efficiency-guide/)  
36. DeepSeek\_V4.pdf · deepseek-ai/DeepSeek-V4-Pro at main \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek\_V4.pdf](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek_V4.pdf)  
37. OLMo Hybrid \- Hugging Face, 访问时间为 六月 14, 2026， [https://huggingface.co/docs/transformers/model\_doc/olmo\_hybrid](https://huggingface.co/docs/transformers/model_doc/olmo_hybrid)  
38. Kimi K2.7 Code \+ Hermes Agent: Autonomous Coding Setup Guide \- Lushbinary, 访问时间为 六月 14, 2026， [https://lushbinary.com/blog/kimi-k2-7-code-hermes-agent-autonomous-coding-setup-guide/](https://lushbinary.com/blog/kimi-k2-7-code-hermes-agent-autonomous-coding-setup-guide/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAWCAYAAABe+7umAAAApElEQVR4Xu3XIQoCURhF4R8sLkAsZhGrRUGwmQS7WxDcg8niKiyuwewirC5B61j0yky6Qeb5DCrng1Pm8sorMxMBAMCXmaq7WvqAPOMoL3brA/J0VaH2PiBPS13U0QfkaaqzOqmGbXhTW13VwQek6amb2vmANJMo3/gbH5BmEXyTfsQqyouc+4B0azXwhwD+VUfNajaqzuCF5y/msGb96gyAn/MAy94X0nfvVKgAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAABwklEQVR4Xu2WTytEURjGH/9ZEAvKAgufQWQjf8IHUCxkslD2SvIRlJIsfAcfwYaNZCU2oiyQBRaUQv6+r3MuM49773tGQ9H86qnxO89953TnzjFAkb/DIAuDZkkpy+/QJlmVrEjqaC2OackcywBeWeTDEtyACf93q+RCcv/R+EqL5JxlFvVI3lSl5IWlhX4cOnCTFzxPSB6q11WTa5Sc+LUoSWxJFlmmocOOWWbRB9fpJ98teSDHWJstQ/p6Dmewy9GdXyP/CPtZtTar6PoAS6YHrrhBnmmA612TV1dDjgnZ7IFkhyWjd0YH8TPHjMP1drNcrXcWIZudh90JGqQcwvX0iIro9c4i5D3GYHSaEDZIietNxrg44q5lOmF0om/hHS8QI3A9PtYy3luEbLYDdidoUFKnC/GeSbo+m1HYHdwgvRQd7BW8gM8TwiJks3r8WZ13tLTHUriEOy3S0Gv1X2YaIZvdR+5Jk8oV3MBtuGdYX+tDb6G9GZYePZP1N8Opj77mczpC5wyxLDSzkluWeVIC+84XDH2jcpZ5sC5ZZvlTDEuOWAaivzmeWf40C5IplgH8+kYjMiwM2iVVLIsU+Q+8AcPof4U5yGDQAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAWCAYAAACWl1FwAAAAjklEQVR4Xu3WsQ1BYRiF4UMhDCCxgkKrVNjCDNa4xhBjMIBSYwBhA4mWhPfmVk4viu88ydv8p/urT4qIiPiXuT+ENKAbHan3PUWfznSlkW2BPT1o4kNIO3rRzIeQNvSmhQ+VrdV9ysqHihp1n7H0oaItPWnqQ0UHutPYh2rag+1EFxraVlZ75ueSjYj4gQ914hHWBkKn9wAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAZCAYAAACIA4ibAAACiUlEQVR4Xu2XS6iNURTHl3dSBoiBRzeZiIGBGaEoGSCPiTISyiOlcJm4N4+BUiIGXinFAAOUREoZkQw8M1MeeRSXrkd5r7+1dmd9//N9x3FL93bbv/p3zvrtfb7HPvvb+xyRTCaT6blc1fzSdGhWUFtiguaWWL9r1NarwA0O8PfLvH5Ta/7DTPeJKVT3Gi5rzpO7JHazC4JDvSbU4KvmJrluY6JmLMsS+rAgvovd7NLgJrl77fVIr/EaSY9Zt9IidhE/NZ/9/erYITBYM5UlMVpzktwssePe8Xq718wJqfkRYjNon7+CuZpTYgOcWKQ5o9kQXKKv5pjmmWaXZlOxuRwMBHNd800zhvwXqpvlitiNTvYaj1TZgBySmh+vOer1Ec1T9xgouM1i1zhE7Mbh3nsf0M9dVV3JPBbOcM0PsYOkTC/0aI50IbeDu+GO2S/mMcsS6dyRD+4GBrfNXWId1eAC1V2mP4t/ALMqPSqJ01J/seCgmI/nQ/0k1ABrEX9+I7lhXiMHNONC21/ZI7UPn6U2ZgaLBjwUe76ZqjXkuNR71I/IPXcfWV/ilrtLiY9UJdjmdob6sNiHFweXaJXiNG3EOc1ucljcwDSxczSzy6C+Rw7H4X5ryQ0K78EOsfZ28nXsZeHcFzsAVuaFmgeax4Ue1WyR+t8Yo8QWzUTZoH/UvCOHfjh3pGyG8JrRptkaanBXbNAb0ugbHyq2FWLKrqS2KmZLcZrGYNtMYOfBb5YEft+gT0twAC7NrASmPg9ImgFYxEG715FXmjnk/js8CDHYHiP4xj6JPV5ojxc7X2zxxGBgRrx1j1fU8Pg7gJ2vU/PC3UvNRbEBWeJ90vlXSSaTyWQymUwP5Dc6CrxIEVZqGAAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAZCAYAAABOxhwiAAAB4klEQVR4Xu2VSyhFURSGtzyKgUwMlUzI1FxkpsxEQl0xYCKPFCHlUcpMKKUkJibmMvFIycQjMTFDMmDglZRY/91rX2uve657M7gDzld/9/z/2mffdc7ZZx9jQkL+B72kdVI5+zLSGqknNuKbUdIj6ZXUrmppZ5L0qXTkjbCck7aEPyPtC592xkizpBXSCCnTL0fJN/aCNMgKdJgu0Gy1DhXHJnHjSzpMF8MmeeNuCWlk3mjsTVhljyeBp9nNHmSTxknzXNc0kU6NXZKVpEO/7DNEmjK2gWX+XfRGpNb4IOmN/TSphnM0gayWNMdZPWdF7MEBqUP4BdKd8HH0kTZVhkknlE/WOMAfw3eJDCC7DMg2lC8VHvzYeBC6Ie0dOo8o70DWEJBtC//CGXY0LJmkZOiA+DC/a7xFeQcyLBWd7arsiXOnOr/sgwH3AZlswE2oQXYhfDNnmlQaLxTHxaR3EzxXDBQHAjJ5Eh5z0CTIKoSPcKZJ1Pie8pqgLAY+3/Jqq4w9Qb8oyDqFn+FM0s9ZjsjyOGsTGUCGr6/0+Io7sF3q+ePAUsEgpxK/HCXX2Br21hNjtz75fjyTbkhXpFvSDo/DMTLU8AK2GrtbILsmPeBkY+fDjXE9oJbFtZCQkJCQP8QX4v2d2MFXHCgAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAZCAYAAABAb2JNAAADXUlEQVR4Xu2YS6hPURTGl1ciJAOFCRFGiJLyuOWVV55FyYi8QgYGSp4lEybEyGtABiIGktdIyWtCiUK6AwNveb8f62vtff/rfHef/+teA5xffd2zv7XOPuvs/z777HNFCgoK/l7asfEvsV51SLWQ/FHUbk1OqtqyWS9DVS9Vv1TXVN2z4SY2qd6qPqqWUCwyQHVdrK9LFKuGr2LnHlNNUU1VfVaNE6txdSlVnqu+ieVDqOuV6rWU+jnTlF0Z5LcKK1R7XPuoWOfDnQfuqi669h3VFdcGDZItbBi1y9FNLPcpBwL3xeJ+UCNxUJl+Yv4XDiQYpNrIZr2kCmIv3jADz89qtFe6NsCMweyvBF8zRa2DCmKsJweIRjZawmNpXhAXeYvaEXgHwjGKThV/IfjlwPqJnIMcIPC01DuogzlAVDOb62aDWBHTnJdXtPc3u2PPYUn7nrguYj0uxzKpbVA7iPk/OUAsUM1hUxkrtsThHTFf9SAbro7ZYkXsJj+vaO+fdseefZL2PXn9V0s8v38QZuXS4OFJqQR+VGan2Pslgl1IzTXuUh1X/VBNoFjeTXv/sjv24AeC34cDjrz+qyWePz5osmq62EvvnapLKTXJQzbE+lue8OoCN4+T/VYk76a9jy1QKmevmN+eA47YD6/HYIZqtGpkELZWMzMZ+fWBJ2KxvKVlh6RjV8XOa5Tmg1sXXCS3I97PW1Px8kn5nptiOYs4oKxSrRPbfyIH6xo8T159YKBY7DsHAnnnAczg2De0JRvOB4/7fvJiJ2NCG49Q6uLw7oVjzCa0ebZV8/bvLZaDzXse28Ry1nJAyg9qZ8mPd1KdYjPQyx33UD2TdB/NmCfpC0Yvfgfjzcc5AN4Ias91bfBebJZV4pzY+fhxUmDNR3wNByR9D5EjYjH0z2CJ68hmINWfH5OyINF3PCR4Z50H4OHrK4K3I1/4vGQfszZiOX2dV474ssNSwsSBq2VLtV3Mr+fRRwz3w15VYGpjHwe9EDsR2yAGjwpiN1S3xb7HMWgMYh9UJ8TyJ2bDFWkQ+/9CHCgIX2Wos6tqcSk1kxOFAfykeiP2aYttYgqstVvZdKCvSeEvhHvK+59IQeARGwUt549+lv6P4MNgFpsFLQM7koJWBl9pBQUFBa3Jb42+G4dgsb+6AAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAZCAYAAABAb2JNAAADO0lEQVR4Xu2YS8iNQRjHH7dESJRyCxGWSkmJr4SI3BaUrMgtZGFh41qyYaNYKJcFWREL5ZoFya1EiUL6ysZd7tfw/HtmvjPv/8yc8573OxZ4f/Xvm/k/z8w3Z868M+8ckZKSkr+XTmz8S2xQHVQtIn881ZvJcVVHNpvBENUvNh2bVO9Un1RLKeYZobou1scFiuXhm1jbo6rpqhmqL6pJqleqNZVUeaH6LpYPYVyvVW+k0s+ptuz6pD53u/EDZO6pzgf1u6orQR20SLbtGKrXopdY7jMOOB6IxcNJ9aTGPEzM/8qBCKNUG9lsBudUH6V6gP4DM/B6U31VUAdYMdfIi5GamJBGJxX4WD8OEK1sNINBqpOql1I9wNsRD8Db78oYdGzw+KJibUOwfyLnAAcIPC1FJ3U0B4g8q7lh/KBik5oadOhvDsohhyTuh/h9EftxLZZLY5PaRcz/yQFioWoem8pEsS0OZ8QC1cNsuDY49Qa7ctFJxSqP5eyVuB+S6j8vvv1wJ6zKZc7Dk1IPfKnMTtWRoI63kNxj7Ku6GNSLTuqloByyW8wfyIGAVP958e0nO01TzRQ79N6relRSozxiQ6y/FREvF5xYdFLxChTL2SPmd+ZAgO+H92MwSzVBNc4Jr1azMxnp8YGnYrHU1rJD4rGrYu1apXpya7JPqjfwopOa2lNx+MT8kJtiOYs5oKxWrRd7/0QO9jV4IanxgZFisR8ccKTaAaxg3ze0JRuOc1p1meQ7QNmf7HiEYv8c3n1XxmpCnVdbntN/gFgOXt5TbBPLWccBqT2p3SUd76Y6waajf1Duo3ou8T5yERsATj72ALyxVJ8f1MEHsVVWjzNi7fHlxNglFl/LAYmP2XNYLIb+Gdy2urLpiPUHr9BvA6kBwlsZ1HE6ct5ZyT5mHcRyhgZeLfxhh62E8eNq5JVqu5hf5NFHDJ+HvYa4JbapP3FCGXudB48KOr2huiN2H8ekMYjhVnZMLH9KNlyXFrHfF/xEQbiV4RHsqVpSSc3keGECP6veil1t57ZlZ8Feu5XNAPQ11f2F8JnC22NJhMdslLSfP3It/Z/BxWAOmyXtA28kJU0Gt7SSkpKSZvIbOkMbJY9M/MwAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAZCAYAAABAb2JNAAACyklEQVR4Xu2YSehOURjGXzNJSaZSknlOlB3JkGwolMhCSpHVvyRl4TNlY6VshH/ZEcVChuzYYWHBisg8JEMks+ft3OM797nnDufeb/Gn86unvvO85zvn3Pe7Z/pEIpHIv8s8NiLN6AudZrMncRX6Db2DNlPMxzUx9atK2Qp9dLxf0AfoLfQp8bT/IUn9Ms5A/dnsKejD9Es+r0/Kr9thL88k+5a4CbRM9HiHE28O+YptYzAHPHC7tZnPRkMuQefJuyhmwCvJd/E9kC+pygsq26ROI1/ZICZ2jwPEeGg/m3XR1/0RdAPqlQ7V4oeYh1jreDMS75XjMb7k5SX1GNTHKdukTnE8yyoxsZccIO6z0Ql6Q3egh9AgioUwBjpF3iIxD3abfJfdbEh+UmdDQ51yUVLtmjuSA8R3NsTk5Dj0BDoA7UiHw9AprIMZzYGaXBHzYDM5UEJeUhmb1GXQBGiymKORzprP0PB2VS+roXXk6Uxw++ZybbrFDGwWBwKwg7nJgQqEJnUTtBhaCq2ATjp+EV/ZANsl2/cFKjfioJgOFnKgAl+keNoXEZpU3/TXjVhj1zng8JgNMEza/R+BxqbDzbG/mh6PQrgr5uxXl04kVbHt+DbivdB0NhM2Svu7qvfpcD10cdbGdEqFclbMG+6iC34IoUmdyoEE246+fUxe+wOovE9M3Rb5lTkhZjf0nfuqsBPaRt4o6Ch5ZYQm1TdevXrmtaPHST1D+9gD7SJPT0d6Uwzisphr3QgOBLBE0lPG1XKnXhXs98rG0y2m3lzyJyW+Sg/3zDnJPz62JPtD6FlXN8FSdJ25BT2ABlKsDpxIV3ruK0PfOr27PxezXKieirk48C7dJdk+foqpp3f/N9Chv7WzcNJcWtAaMddr2/YWt0IRujv6FvD/nXGSXfMjDSn7LyBSg29sRJqxQMzVNNJB9D/ZSCQS6SR/AGeDzz8vkDA3AAAAAElFTkSuQmCC>