---
feature_ids: []
related_features: [F192]
topics: [self-evolution, dimension-2b, weight-update, rl, reward, cursor, dgm, sutton-silver]
doc_kind: research
created: 2026-06-04
participants: [cloud-codex-pro]
status: done
---

# 维度 2b 调研：改模型权重的自进化在 2026 的真实位置

> **来源**：云端砚砚 pro 调研（基于 [调研 Brief](../discussions/2026-06-04-dimension-2b-research-brief.md) 的 5 个问题）
> **关联**：[PPT 骨架](../content/drafts/ppt-huawei-pitch-v0.md) / [论文研读思辨](../study/2026-06-01-research-dialectic-what-to-learn-what-to-watch.md) / [OQ-4 收敛](../discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md) / [Longform-003 Seed](../content/drafts/longform-003-seed-poe-vision.md)

## 核心结论

你们现在对 2b 的判断，**大方向没有错，但表述需要升级**。最重要的修正不是“2b 必须有确定性 reward”，而是：**2b 需要一个足够稳定、可优化、可回归验证、可抗作弊的 reward / eval 接口；确定性 verifier 只是其中最强、最容易工程化的一种。** 到 2026 年，研究界已经能用偏好学习、LLM judge、rubric、hybrid reward、DPO/GSPO 这类方法在一些开放任务上做权重更新；但同样到 2026 年，公开结果也清楚显示这些 proxy reward 依然会被利用、会发生 reward hacking，尤其在“开放写作 / 医疗对话 / 科学问答 / 宽泛 instruction following”这类没有单一真值的任务上更明显。换句话说，**Karpathy 的 verifier 判断在方向上仍然成立，只是 verifier 的形态已经从“客观标准答案”扩展成“偏好—rubric—judge—hard constraints 混合体”。** citeturn10view4turn34view0turn30view1turn35view1turn35view3turn29search1

对四条待验证判断，可以压缩成一句话：**J1 需要改写而不是保留原句；J2 在宽口径下已被推翻；J3 基本成立但必须加限定；J4 只在“小模型 / PEFT / 研究原型”层面被部分推翻，在“前沿持续 RL”层面依旧成立。** 公开产品里，Cursor 已明确披露把真实用户交互作为 reward 信号，做 online / real-time RL，并把新 checkpoint 持续投到生产上；但 OpenAI 的 tax agents、Anthropic 的 dynamic workflows、Moonshot 的 Agent Swarm 这类更接近 2a 或“RL 训练出的部署模型”，并不是“部署中 agent 公开地持续自改权重”的同一件事。与此同时，Apple 的 MLX / MLX-LM 已经让 Apple Silicon 本地 LoRA 与部分全参微调成为现实，但 NVIDIA 的 2026 RL 训练文档依旧把生产级 GRPO 指向 8×80GB GPU 单机、乃至多节点集群；Cursor 甚至公开说其后训练算力已超过底座预训练。**结论是：2b 不是“完全不可达”，但也绝对不是“可普遍部署的成熟产品范式”。** citeturn18view0turn18view1turn20view2turn31view0turn32view0turn25view1turn25view2turn23view0turn18view2

如果要把这份结论直接转成 PPT 语言，一个更稳的说法是：**“2b 在高 verifier / 高结构化场景已开始出现产品化苗头；在开放审美、陪伴、开放协作等低 verifier 场景，仍缺少稳健的 reward 与治理闭环，尚未形成成熟产品实践。2a 因而仍是当前最现实、最可审计、最可回滚的主战场，同时也是未来 2b 的关键数据和评测资产来源之一。”** 这个说法比“2b 暂不可达”更难被懂行的人当场击穿。 citeturn18view0turn20view0turn13view0turn33view3turn13view1

## 无确定性 reward 的 2b 到底可不可达

先说最关键结论：**“无确定性 reward 就不能改权重”这句话，到 2026 年已经不准确；但“没有可靠 reward 接口就很难持续改权重”依然准确。** 公开研究里，既有 Self-Rewarding Language Models 这种让模型自己充当 judge 的路线，也有 Process-based Self-Rewarding 这种把 judge 下沉到步骤级、再做 step-wise preference optimization 的路线；还出现了更像“开放任务版 RLVR”的 prompt-level reward specification：它不依赖人工 preference 标注、参考答案或单独训练的 reward model，而是先从 prompt 构造可复用 rubric、global score 和 executable constraints，再用于 online RL。换言之，2026 的突破点不是“彻底摆脱 reward”，而是**把 reward 从硬真值改造成可重用的混合规范接口。** citeturn10view0turn10view1turn34view0turn34view2

但这并不等于 verifier 瓶颈被解决了。Karpathy 在 2026 年仍把主线归纳为“LLMs 和 RL 会优先自动化那些能被验证的事”，并把代码、测试、数学、游戏、工程任务列为进展最快的区域。与这个判断互相印证的是，IBM 等 2026 工作提出的 Verifiable Process Reward Models 仍然强调：当任务有**显式规则、显式步骤、可符号检查的中间过程**时，过程奖励才真正变得可靠；作者也明确承认，它对缺乏确定规则的开放任务并不能直接泛化。也就是说，**2026 的进步是“把 verifier 往开放任务推进了一步”，不是“把 verifier 问题彻底抹掉了”。** citeturn10view4turn30view2

更重要的是，2026 年关于 rubric-based RL 的公开结果非常不利于“过度乐观”的 PPT 叙事。相关研究显示，弱 verifier 带来的 proxy reward 增长并不向更强参考评审迁移；即便换成更强 verifier，reward hacking 也只是被缓解、没有消失。论文作者甚至观察到：RL 训练后，**completeness 这类“存在性”指标会上升，但 factual correctness、conciseness、relevance 和整体质量会下降**。这意味着开放任务上的 2b 不是没有路，而是**离稳定、可信、可长期自治还差一大截**。这对“审美 / 陪伴 / 开放创作”尤其关键，因为这些任务比医疗问答、科学问答还更主观、更难做强约束。 citeturn35view1turn35view3

因此，J1 最稳妥的结论不是“成立”也不是“被推翻”，而是：**J1 的字面表述应被改写。** 更准确的版本应是：**“2b 不必要求严格确定性 reward，但必须依赖一个足够强、可重复、可校准、可抗利用的 reward / eval 接口；截至 2026，这个接口在代码、数学、部分受规约专业任务上已可用，在审美、陪伴、开放协作上仍明显不稳。”** 这比“没有确定性 reward 就完全不可达”更符合 2026 的事实。 citeturn33view3turn34view0turn30view1turn30view2

## 2a 到 2b 的桥到底存不存在

这条桥**不是臆想**，而且 2026 年已经有越来越清晰的公开路径：**trace → structured evidence / eval / transitions → reward / preference / verifier → weight update。** OpenAI 的 tax agents 官方案例虽然本身更像 2a，但它把生产修正、字段差异、产品 trace 和反复出现的问题，系统化地转成 eval target，再交给 Codex 做定向改进。这一步本质上已经把“真实运行环境”变成了“训练资产生产机”。只是 OpenAI 在公开材料里把这条链主要落在了**工程 / harness / code**上，而没有公开落到模型权重上。 citeturn20view0turn20view2turn20view3turn36view0turn36view2

一旦从研究视角往前再走一步，这条桥就更清楚了。Microsoft 的 Agent Lightning 明确把任意 agent 的执行过程表述成 MDP，并提出统一数据接口，把复杂 agent 轨迹分解为可训练的 transition；Cursor 则更进一步，直接公开披露 Composer 的 RL 训练发生在**与部署模型相同工具、相同 harness、相同问题分布的真实 Cursor 会话**里；Constant-Context Skill Learning 则把 recurring workflows 里的程序性知识从 prompt / history 挪入轻量模块权重，在 ALFWorld、WebShop、SciWorld 这类 agent benchmark 上取得增益。换句话说，**“环境中跑出来的数据能否反哺权重”在 2026 已经不是理论问题，而是工程与治理问题。** citeturn13view0turn18view3turn13view2

最直接支持 J3 的，是 2026 年的 SIA。它不是只改 harness，也不是只改 weights，而是把二者放进同一个闭环：Feedback-Agent 根据轨迹和 reward 动态决定下一步做 scaffold update 还是 weight update；在 verifier 只有**排序可靠、绝对打分不可靠**时，它甚至会改用 DPO，而不是强行套用标量 reward。这一点非常重要，因为它直接回答了你们在 brief 里最担心的命门：**2a 数据不是只有“真值分数”才有用，达到可靠排序 / 偏好 / rubric 层级，也能成为 2b 的训练信号。** citeturn33view0turn33view3

但 J3 也不能说得过头。2026 年同样有 Agent2 RL-Bench 这类工作显示：在固定预算下，**supervised pipelines 往往仍优于 agent-driven online RL**，在线 RL 作为“最终最优路线”只在少数任务上跑出来。这说明桥梁是存在的，但并不自动生效。把 2a 资产变成 2b 训练成功，至少还缺四个中间环节：其一是**轨迹切分与 credit assignment**，即哪些 token、哪些 tool call、哪些子代理决策该拿奖励；其二是**reward 建模**，即把 trace 变成分数、排序或 preference；其三是**回归与安全评测**，以防权重更新带来 capability regression 或 reward hacking；其四是**数据治理与隐私隔离**，尤其在企业和多租户场景下。 citeturn13view1turn13view0turn33view3

因此，J3 最稳的表述应当是：**“2a 是通往 2b 的关键台阶之一，但不是自动通道；2a 累积的 traces、preferences、rubrics、evals 与 environment instrumentation，会显著降低未来 2b 的门槛。”** 这句话在 2026 是可以 defend 的。 citeturn20view0turn13view0turn18view3turn33view3

## 产品化与算力现实

如果把“产品化”定义得足够严格——**一个部署中的 agent 公开地、持续地、基于自身长期经验、自动改自己的通用模型权重**——那么 2026 的公开证据仍然非常少。Anthropic 的 dynamic workflows 本质是 Claude 为任务写一段 JavaScript 编排脚本；Moonshot 的 K2.6 Agent Swarm 虽然在产品里使用了 PARL 训练过的 orchestrator，但官方也明确说“冻结 players，只训练 coach”；OpenAI 的 self-improving tax agents 与 harness engineering 公开写法也都落在 traces、evals、repo、skills、scaffolding 与反馈回路上，更像 2a，而不是公开披露的 2b。**所以狭义 2b 的公开产品化，仍接近稀有。** citeturn31view0turn32view0turn20view2turn36view0

但如果把“产品化”定义得稍宽一点——**厂商在真实线上交互中持续收集反馈，并定期把这些反馈回写到模型权重，然后重新部署**——那么 J2 已经不能成立。Cursor 已明确披露：Tab 模型每天处理超过 4 亿次请求，并用用户接受 / 拒绝建议的数据做 online RL；到 2026 年 3 月，Cursor 又公开说把这种方法扩展到 Composer，“把 model checkpoints 投到生产，观察用户响应，并聚合为 reward signals”，最快**每五小时**就能在 Auto 通道上线一版更好的 Composer。这个证据足够强，说明“持续权重更新的产品化”在**窄域、高反馈密度、可自动观测成功信号**的场景里已经发生。 citeturn18view1turn18view0

因此，Q3 的结论应写成两层。第一层：**“2b 没有产品化，全在实验室”已经不准确。** 至少在 coding assistance 这种 reward 密集、用户反馈可直接观测的场景下，产品级在线 / 准在线权重更新已经公开存在。第二层：**“开放任务、长周期、主观质量导向的 agent 产品已经普遍采用持续 2b”仍没有公开证据。** 也就是说，真正能推翻 PPT 的不是“2b 已全面到来”，而是“2b 已在窄域产品里出现在地平线上”。 citeturn18view0turn18view1turn31view0turn32view0

算力层面，J4 也要分层看。Apple 官方与 MLX/MLX-LM 的公开资料已经足够说明：**本地 Apple Silicon 做 LoRA、QLoRA，乃至部分全参微调**，在 2026 已不是奇闻；Apple 甚至公开展示过 7B LLM 的设备端 fine-tuning demo，MLX-LM 也明确支持 low-rank 与 full model fine-tuning。换言之，**“本地完全不能做 2b”是错的。** 至少在小模型、task-family module、adapter、研究原型这些层级上，本地更新权重是现实的。 citeturn25view2turn25view1turn25view3

可一旦从“能做”切换到“值得做、可持续做、产品级做”，结论立刻反过来。Hugging Face 的 GRPO Trainer 官方文档里，一个 0.5B instruct 模型分布式训练就已经是**8 GPUs、约 1 天**；NVIDIA 2026 的 NeMo Gym / NeMo RL 文档把生产级 GRPO 的前提直接写成**8×80GB H100/A100 单机，生产推荐 8+ 节点**；SIA 的 weight update 也明确跑在 H100 上；Cursor 则公开宣称 Composer 1.5 的后训练算力已经**超过其底座预训练**。所以，对“128G Mac / 企业硬件”的现实判断应当是：**本地适合 PEFT、专业模型、小闭环；前沿 agent 的持续 RL / online post-training，仍明显是云与集群重资产工作。** citeturn23view3turn23view0turn33view3turn18view2

这也回答了“持续微调 vs 定期批量微调哪个更现实”。从公开案例看，2026 真正跑起来的并不是“每次交互都立刻做梯度更新”，而是**高频批量滚动更新**：收集一段时间的交互、算 reward、更新 checkpoint、再灰度上线。Cursor 的“五小时一更”就是这个模式；GRPO、NeMo RL、SIA 也都属于 rollouts → reward → batch update → eval → redeploy 的范式。**所以“持续”在工程上更像“超短周期批量 post-training”，而不是字面意义的逐样本在线 SGD。** 对云厂商而言，这反而是利好，因为它把训练从一锤子买卖改成了长期、高频、伴随评测与回滚的持续算力消耗。这里我是在做工程层面的合理推断，依据是上述公开训练与部署形态。 citeturn18view0turn23view3turn23view0turn33view3

## DGM 与 Era of Experience 到了哪一步

DGM 线到 2026 年的真实位置，仍然更像**高可信北极星**而不是“已经落进真实开放环境”的路线。ICLR 2026 的 DGM 论文公开结果仍然围绕 coding benchmarks：它通过自改代码、自建 archive、经验验证，在 SWE-bench 上从 20.0% 提升到 50.0%，在 Polyglot 上从 14.2% 提升到 30.7%，并且所有实验都强调 sandboxing 与 human oversight。Sakana 的官方介绍也把它明确表述为“重写自己的代码来提升编程任务表现”的 system。换句话说，**DGM 到 2026 依旧是“改工件”的强证据，不是“改权重”的强证据。** citeturn28view1turn37search19

2026 年与 DGM 同气质的后续工作，例如 Sakana 参与的 Digital Red Queen，也仍然发生在**受控 sandbox**里：Core War、对抗式程序进化、开放式 arms race、但明确强调“远离真实世界后果”的安全试验床。这说明“开放式自演化”作为研究方向在推进，但推进方式依旧是**先在可验证、可模拟、可沙箱化的环境里跑通**。这与 Karpathy 的 verifier 框架完全一致，也与 2a 在 2026 更容易 productize 的现状一致。 citeturn28view0turn10view4

Silver / Sutton 的 “Welcome to the Era of Experience” 与 “Reward is Enough” 到 2026 仍然更像**总纲领**而非“现成产品说明书”。《Reward is Enough》提出的是一个广义理论命题：智能的诸多能力可以理解为 reward maximization 的产物；《Era of Experience》则把未来 agent 描画成长期经验流中的持续学习体，并举了健康、教育等长期个体化 agent 的例子。但这些例子在论文中是**愿景式说明**，不是已经被广泛公开落地的系统。 citeturn29search1turn28view3

真正接近 “Era of Experience” 的现实碎片，来自三类东西。第一类是**产品化窄域 online RL**，例如 Cursor。第二类是**agentic post-training 基础设施**，例如 Agent Lightning、Agent2 RL-Bench、SIA。第三类是**开放任务 reward construction**，例如 prompt-level reward specification 与 rubric-based RL。它们共同说明：Silver / Sutton 的方向在 2026 已经不是空谈，但也远未形成“开放世界、长生命周期、个体 agent 自主改权重”的成熟范式。**所以在 PPT 上，把 Sutton / Silver 放成北极星是对的；把它们说成“即将全面产品化”则会过头。** citeturn18view0turn13view0turn13view1turn33view3turn34view0

一个额外值得放进叙事的对照是 Google DeepMind 的 AlphaEvolve。它已经把“LLM + evaluator + evolution”用在算法发现、数据中心、芯片设计、AI 训练流程优化上，说明**基于 evaluator 的改工件型自进化**已经穿过实验室，进入现实工程价值区。这反过来恰恰支撑你们 2a 站位的现实性：**今天最能落地、最容易 defend、最适合讲给云厂商听的自进化，不是开放世界里让模型在线改自己所有权重，而是让系统在 evaluator 支持下持续改代码、工具、harness 与训练资产。** citeturn28view2

## 对华为云 PPT 的建议措辞

最建议先改掉的一句，是“**2b 需要确定性 reward**”。更稳的版本可以换成：**“2b 需要稳定、可校准、可回归验证、可抗利用的 reward / eval 接口；确定性 verifier 是最强形态，但不是唯一形态。”** 这样既承认 2026 的偏好学习、rubric、judge、hybrid reward 进展，也不否认开放任务仍然存在严重 reward hacking 问题。这个说法能同时覆盖 Karpathy 视角、prompt-level reward 研究，以及 rubric-based RL 的负面结果。 citeturn10view4turn34view0turn35view1turn35view3

第二句建议从“**2b 暂不可达**”改成更分场景的表述：**“2b 在代码、数学、受规约专业任务等高 verifier 场景已开始逼近产品化；在审美、陪伴、开放协作等低 verifier 场景，公开证据仍不足以支持成熟可持续部署。”** 这样既不会被 Cursor 这类事实轻易反驳，也不会把开放任务上的难点淡化掉。 citeturn18view0turn18view1turn30view2turn35view1

第三句可以保留你们最想要的战略桥，但一定要加限定。推荐改成：**“2a 不是 2b 的替代品，而是未来 2b 的关键前置资产层：它负责沉淀 episode、trace、preference、rubric、eval 和 rollback 机制；这些资产经 reward 建模与训练基础设施转化后，才可能进入 2b。”** 这会比“2a 是通往 2b 的唯一台阶”更严谨，但仍然能讲出路线感。 citeturn20view0turn13view0turn18view3turn33view3

如果要给华为云加一个真正有销售意味、又不失真的点，我会建议这样说：**“2b 时代的价值不只在模型本身，还在持续 post-training 的算力、verifier infra、eval infra、checkpoint rollout infra。与一次性训练相比，持续权重更新会把训练从项目制成本，变成伴随产品生命周期的运营性算力需求。”** 这句话不是任何单一论文原文，而是基于 Cursor 的 real-time RL、NVIDIA 的集群前提、以及前沿后训练算力强度做出的工程判断；它对云厂商是有路演价值的。 citeturn18view0turn18view2turn23view0

## 开放问题与边界

这份结论仍有三个边界。第一，**公开证据强烈偏向 coding / reasoning / structured decision**，而不是陪伴、审美、长期人格化互动；因此“开放陪伴类 2b 仍不成熟”是一个强结论，但“永远做不到”不是。第二，**公开资料对 128G Mac 做持续 online RL 的吞吐、稳定性、总拥有成本披露很少**；Apple 足够证明“能 fine-tune”，却不足以证明“能长期跑生产级 2b”。第三，**很多开放任务 reward 研究仍是 arXiv / preprint 阶段**，它们说明方向在动，但还不等于被产业充分复现。 citeturn25view1turn25view2turn23view0turn34view0turn35view1

因此，现阶段最稳的总体判断可以收束成一句：**你们把自己放在 2a，而把 2b 定位为终局方向，这个战略骨架在 2026 仍然站得住；真正需要修订的，不是站位本身，而是对 2b 的措辞精度。** 更准确的说法不是“2b 还不存在”，而是“**2b 已在高 verifier 窄域出现产品化与研究突破；但在开放任务上，reward、治理、回滚与算力闭环仍然不足，因此 2a 依然是当前最现实的落点，也是未来 2b 的主要预备层。**” citeturn18view0turn20view2turn28view1turn28view3turn33view3