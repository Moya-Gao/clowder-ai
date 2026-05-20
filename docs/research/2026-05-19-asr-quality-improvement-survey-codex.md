---
feature_ids: [F195]
topics: [asr, speech-recognition, meeting-transcription, quality]
doc_kind: research
created: 2026-05-19
author: codex (GPT-5.5 砚砚)
---

# 2026 ASR 转写质量提升调研（砚砚/Codex 版）

## 核心判断

基于你给出的当前配置，我的结论和你原始判断大方向一致，但需要做一个重要校正：**F195 的主要瓶颈更像是转写管道，而不是底层模型选错了**。公开 benchmark 里，Qwen3-ASR-1.7B 在中文与会议风格数据上确实是强模型；尤其在 WenetSpeech 的 **meeting** 子集上，Qwen3-ASR-1.7B 的错误率为 **5.88**，Qwen3-ASR-0.6B 为 **6.88**，Whisper-large-v3 为 **19.11**。也就是说，“换回 Whisper”大概率不是正路。更关键的是，你原文里把 **15.30/32.27** 归给了 Whisper-large-v3，这一项在 Qwen3-ASR technical report 里实际上对应的是 **GPT-4o-Transcribe**；Whisper-large-v3 在同表中的 WenetSpeech 成绩是 **9.86/19.11**。所以“Qwen 模型本体不差”这个结论成立，但基准对手的数字需要纠正。 citeturn36view0turn32view2

更具体地说，当前这条“固定 3 秒切片、无 VAD、无上下文热词、无结构化后处理、无说话人分离”的链路，会把现代 ASR 模型最吃香的几个能力全部抵消掉：长上下文、对真实语流的语义连续性、非语音过滤、名词偏置、以及对可读输出的后整理能力。近年的 streaming ASR 研究明确指出，**chunk-based** 推理如果只能看到“历史 + 当前 chunk”，会因为缺少未来上下文而出现性能下降；而更长上下文的 ASR 在长音频场景里仍能继续获益。换句话说，**3 秒硬切** 既太短，也太机械。 citeturn18view0turn18view1

因此，最值得立刻投入的不是“再换一个更大的 ASR 模型”，而是把这条链路补成一个更像 2026 年产品级会议转写系统的样子：**VAD/endpointing → Qwen3-ASR → 热词/术语上下文 → 标点与段落恢复 → 可选 LLM 后修正 → 会后 diarization 与摘要**。这个方向与头部产品和最新研究的收敛路线是一致的。 citeturn30view0turn8view1turn11view0turn19view0turn27view1

## 关键证据

下表只挑与你的场景最相关的数字：中文、会议、真实口语，而不是只看英文朗读集。表里的公开 benchmark 数字来自 **Qwen3-ASR technical report**；Apple Silicon 本地推理能力与 MLX 集成能力来自 **mlx-qwen3-asr** 项目说明。 citeturn36view0turn32view2turn40view2

| 数据集与条件 | Whisper-large-v3 | Qwen3-ASR-0.6B | Qwen3-ASR-1.7B | 结论 |
|---|---:|---:|---:|---|
| WenetSpeech net | 9.86 | 5.97 | **4.97** | Qwen 明显更强 |
| WenetSpeech meeting | 19.11 | 6.88 | **5.88** | 会议场景优势更大 |
| AISHELL-2 test | 5.06 | 3.15 | **2.71** | 中文标准集也领先 |
| Dialog-Mandarin 内部集 | 14.01 | 7.06 | **6.54** | 真实对话场景仍领先 |

这意味着，**Meeting Copilot 当前“听起来很烂”并不能直接归因到 Qwen3-ASR-1.7B 本身**。相反，从公开结果看，它本来就是更适合中文会议的底模之一。真正可疑的是切分与输入条件：如果模型只能拿到被硬切碎的 3 秒小块、静音也被送进识别器、而且没有把参会人名和项目术语喂进去，那么最终体验会比 benchmark 好坏更受工程实现支配。 citeturn36view0turn18view0turn19view0

这一点还有一个很强的旁证：关于 ASR 幻觉的最新研究显示，**非语音音频、静音和噪声** 会诱发明显的错误转写。研究者在 Whisper 上做的消融里，使用更有效的 VAD（Silero VAD）后，幻觉检出率和 WER 都显著下降；在其特定压力测试条件下，SileroVAD 前处理把 WER 从 **104.8/112.0** 降到了 **8.0/10.8**。这个实验不是在你的数据集上做的，绝对数值不能直接照搬，但它很有力地说明：**把静音与非语音挡在 ASR 前面**，会先于很多“大模型升级”产生肉眼可见的收益。 citeturn25view1turn25view4

同样，硬切短 chunk 也有明确的机制性问题。2025 年一篇 streaming ASR 研究指出，chunk-based inference 因为把模型限制在历史与当前 chunk 内，会在需要未来上下文的地方造成性能退化；他们通过引入 future context，得到 **10%–13.9% 的相对 WER 改善**。而 2026 年的长上下文 ASR 研究进一步显示，长音频识别并不是“超过几十秒就没收益”，模型在更长上下文下仍可能继续获益，在主实验里相对短上下文基线最高获得 **14.2% 相对改善**。所以，从研究证据看，**3 秒强切** 本身就是一个很值得先动刀的设计。 citeturn18view0turn18view1

## 头部产品与开源生态的共同做法

头部会议转写产品的共识不是“把 ASR 一次性做到完美”，而是把系统拆成多层。Granola 的官方文档显示，它在桌面端**没有会议机器人**，只在本机用系统音频与麦克风做实时转写；会后再基于**转写、用户原始笔记、日历信息**生成增强笔记。它也明确说明：桌面端当前并不支持真正的 live diarization，只能把转写大致分成 “Me” 与 “Them”，对应麦克风输入与系统音频输入。这个设计说明两件事：第一，**实时转写与事后增强分层** 是合理的；第二，**实时多说话人 diarization 并没有你想象得那么“标配且廉价”**。 citeturn12view3turn12view4turn30view0

Otter 的公开页面则把另两件事情说得很直白：它把 **speaker identification**、**keywords and speaker talk time**、**automated summaries** 放在同一条产品链上；同时它允许用户加入 **custom vocabulary** 来提高 proper names、jargon、acronyms 的识别准确率。也就是说，成熟产品并不只盯着 WER，而是把**术语偏置、说话人标签、摘要与检索价值**一起当成体验指标。 citeturn8view1turn26search0turn26search6

飞书系官方内容则更进一步，把“**实时说话人区分**、**企业声纹识别**、**专业术语词库**、**会后知识沉淀与问答**”放到同一个工作流里。这当然带有产品营销色彩，不能当作标准化 benchmark 来读，但它非常清楚地反映了 2026 中文会议产品的主流目标函数：**不是仅做字幕，而是做可追溯、可归因、可复用的会议知识对象**。 citeturn11view0

开源生态也已经把这些模块拆好了。`mlx-qwen3-asr` 已经在 Apple Silicon 上提供了 **Qwen3-ASR、本地 forced aligner、可选 diarization、streaming、OpenAI 兼容 HTTP 服务、context 热词上下文**；`pyannote` 的 `community-1` 则把 offline diarization 做到了更成熟的水平，并提供了 **exclusive speaker diarization** 来简化与 STT 时间戳的对齐；`speech-swift` 则给了你一个全本地 Swift 路线的选择，覆盖 **ASR、VAD、diarization** 等模块。也就是说，今天真正缺的不是“技术不存在”，而是把这些成熟模块拼成适合 F195 的工程形态。 citeturn40view2turn28view0turn33view2turn33view0turn14view0turn14view1

## 推荐技术方案

如果目标是**最快把 F195 的“太烂了”变成“能用了”**，我不建议第一步就全面重写到 Swift。最优先的方案其实是一个低侵入改造：**保留你现有的 `ASR_URL` 调用模式，但把后端服务换成 `mlx-qwen3-asr serve`**。这个项目自带 HTTP server，支持 async jobs、Bearer token，以及 OpenAI API 兼容接口；对已有 service 边界最友好，同时又能把 Apple Silicon 本地推理、timestamps、context、后续 diarization 通道带进来。换句话说，**你不一定要先把“HTTP → 进程内调用”这件事做完，才能吃到 MLX 的收益**。 citeturn40view0turn40view2

在 ASR 这一层，我的建议仍然是继续以 **Qwen3-ASR-1.7B** 为主线，而不是回退到 Whisper。原因不是“Qwen 新所以更酷”，而是它在中文、会议风格、噪声与方言上的公开结果都更稳，同时 `mlx-qwen3-asr` 已经把它在 Apple Silicon 上变成了相对成熟的本地栈。这个实现还提供了 **context 参数**，可把领域词、人名、项目缩写直接注入 system prompt；这与 2025–2026 年 contextual biasing 研究的方向一致：先从大词表里检索更小的 hotword 候选，再把它们作为 prompt/context 输入到 LLM-ASR 中，以提高 named entities 与热词的识别率。对 Meeting Copilot 来说，参会者姓名、公司名、PRD 名、项目代号，都是天然的 context。 citeturn36view0turn28view0turn19view0

在切分这一层，**VAD/endpointing 必须顶到 P0**。Silero VAD 官方仓库提供 Python 直接可用接口，宣称单线程 CPU 上一个 30ms+ 的 chunk 处理时间低于 1ms，并支持 8k/16k 采样率；更重要的是，前面提到的 ASR 幻觉研究已经给出了把 VAD 放在识别前面的强实证理由。我的工程建议不是“无限相信某一个默认阈值”，而是先把硬切 3 秒改成：**VAD 收集语音、短静音内合并、遇到明显停顿或达到上限时 flush**。如果你打算继续做 streaming，还可以利用 `mlx-qwen3-asr` 自带的 **speech-aware endpointing / energy boundary** 能力，让 chunk 边界尽量靠近低能量区域，而不是用时钟砍。 citeturn39view0turn25view4turn28view0

在文本输出这一层，建议把“转写结果展示”分成**即时可读层**和**会后修正层**。即时层做两件事就够了：一是标点与段落恢复，二是简单格式化。标点恢复之所以值得单列，不是因为它“好看”，而是因为近年来的研究反复指出：无标点 transcript 会显著损害**人类可读性**和下游 NLP 能力；而针对 spontaneous speech 的 punctuation restoration 模型，已经把目标明确放在真实语流、假起始、回溯和口语停顿上。 citeturn35view1

会后修正层则建议使用**“保守型” LLM 后修正**，而不是让大模型自由发挥地“帮你重写一份会议记录”。更合适的路线，是参考两类最近工作：一类是 **Judge–Editor** 范式，即尽量保留高置信片段，只重写不确定片段；另一类是 **Chain of Correction**，即把长 transcript 按段纠错，但在每一步都保留全文上下文，减少大段重写时的稳定性问题、过度改写与对齐丢失。对 Meeting Copilot 来说，这意味着：**先把你已有的 F20e 后修正逻辑，升级成“按段、带全文上下文、限制改写幅度”的模式**，而不是让模型自由生成“更像笔记”的新文本。 citeturn19view1turn27view0turn27view1

说话人分离这一层，我会调整你原文里的优先级描述：**diarization 很重要，但不建议放在“实时 P0”里赌**。原因有两个。第一，`mlx-qwen3-asr` 目前明确写了 `--diarize` 不支持 `--streaming`/`--mic` 模式，意味着开源本地栈里“高质量离线 diarization”比“低延迟实时 diarization”成熟得多。第二，Granola 官方也明确说明桌面端当前不做真正的 live diarization，只做 “Me / Them” 的双路展示。如果你的采集层能区分**本机麦克风**与**系统回放**，那可以先做一个几乎零成本的二分类说话人方案；如果是多人同麦、线下会议或混合会，那更稳妥的做法是**会后跑 `pyannote community-1` 的 exclusive diarization，再结合 forced aligner 的词级时间戳，把词/句归给 speaker**。这个路线在会议产品里更现实，也更容易先把结果做对。 citeturn28view0turn12view1turn33view2turn33view0

## 建议的落地顺序

下面这个顺序是按“**最小工作量换最大主观体验提升**”排的，不是按“技术上最酷”排的。所有公开能力与约束说明，来自 Qwen/MLX、pyannote、Granola、Otter、飞书及相关研究资料；其中工期是我基于这些资料和你当前系统形态做的工程估算，不是来源方给出的承诺。 citeturn40view2turn33view2turn30view0turn8view1turn11view0

| 阶段 | 改动 | 我预计的收益 | 复杂度 | 说明 |
|---|---|---|---|---|
| P0 | **VAD 驱动切分** 替换固定 3s | 立刻减少断句、截词、静音幻觉 | 低 | 用户最容易感知到 |
| P0 | **把 ASR 服务切到 MLX Qwen3-ASR** | 降低端到端延迟，保留中文优势 | 低 | 可先保留 HTTP 架构 |
| P1 | **context 热词注入** | 参会者名、项目名、术语显著改善 | 很低 | 性价比极高 |
| P1 | **标点/段落恢复** | 输出从“流水账”变成“能读” | 低 | 对 UI 观感提升很大 |
| P2 | **保守型 LLM 后修正** | 修正同音误识、代词、省略、格式 | 中 | 必须限制改写幅度 |
| P2 | **会后 diarization + speaker merge** | 解决“谁说的” | 中 | 先离线，后考虑实时 |
| P3 | **Swift 原生路线 spike** | 更深集成 Apple 平台 | 中到高 | 适合长期演进 |
| P3 | **更大模型 spike** | 可能再提质 | 中到高 | 先拿真实录音验证 |

如果只做一轮 3–5 天的小冲刺，我会建议你把目标定义成：**“把主观转写质量从不可用拉到可接受”**，而不是冲着最终的“行业最佳”去。按照这个目标，最值钱的组合是：**VAD + MLX Qwen + context 热词 + 标点段落恢复**。这四项叠加后，通常就足以让用户第一次明显感觉“同一个模型，怎么突然像换了一个系统”。 citeturn25view4turn40view2turn28view0turn35view1

如果你愿意接受更明确的架构建议，我会把 F195 的目标链路改成下面这种形态：**音频采集 → VAD/endpointing → Qwen3-ASR-1.7B（带 context）→ 词级时间戳 → 即时标点与段落恢复 → 前端实时展示；会后再并行跑 pyannote community-1 exclusive diarization → 词级 speaker merge → CoC/Judge-Editor 后修正 → 结构化纪要与知识沉淀**。这个结构的优点是，每层都可以独立测、不好就拆回去，不会把整个体验绑死在一次“换大模型”的豪赌上。 citeturn28view0turn33view0turn33view2turn27view1turn19view1

## 评估方法与验收口径

这里最容易踩的坑，是只看一个总体 WER。会议产品的用户不只在意“平均少错几个字”，他们更在意三件事：**是否把同一句话切碎、是否把专有名词写错、是否把人说话的归属搞混**。因此，内部评估最好至少分四层：ASR 准确度、热词准确度、说话人归因、最终可读性/可用性。研究侧也支持这种做法：`pyannote` 官方博客明确建议把 **DER / WDER / JER** 区分开看，其中 **WDER** 更贴近真实转写体验；热词研究则把 **KER** 当作 contextual biasing 的核心指标；后修正研究则提醒，**只看 WER 会漏掉语义保真**。 citeturn16view2turn19view0turn19view1

因此，我建议你的内部验收集不要拿“干净 demo 音频”做样子货，而要用真实会议切片构成一个小而硬的 test set：至少覆盖安静线上 1v1、多人线上会、线下远场、术语密集、普通闲聊、以及中英日混杂几类。对这套集子，我会优先盯这几项：**总 WER/CER、热词命中率或 KER、人名错误率、静音误转写率、段落切分质量、speaker attribution 的 WDER/DER、以及会后摘要的一致性抽检**。这些不需要一开始就完全自动化，但一定要让每次改动都能在同一套音频上做 A/B 对比。 citeturn36view0turn16view2turn19view0turn25view4

从实现上看，`mlx-qwen3-asr` 已经提供了你很需要的几样“评估友好”能力：**词级时间戳**、**speaker-labeled spans**、**chunk 级输出**、以及强制对齐器；其中项目说明还写到，原生 MLX forced aligner 与官方 `qwen-asr` backend 达到了 **100% text match rate**，时间误差 MAE 小于 6ms，并有速度优势。对 F195 来说，这意味着你完全可以把“用户抱怨转写烂”拆成更具体的归因：到底是 VAD 问题、chunk 边界问题、热词问题、还是 speaker merge 问题。 citeturn32view0turn28view0turn40view1

## 开放问题与边界

有两个地方我建议你在决策时保留一点工程谨慎。第一，**MLX 对 1.7B 的实时性**。公开资料里，`mlx-qwen3-asr` 已经展示了 1.7B 在 M4 Pro 上的实时系数大约 **0.27–0.28**（快于实时），也展示了 long-form parity 与 OpenAI 兼容 HTTP 服务，但“MLX 相对当前你这套 PyTorch/HTTP 组合到底能快多少”这个问题，公开可引用的对照主要集中在 0.6B 和 long-form parity lane，而不是你的精确硬件与录音分布。所以，**切换到 MLX 是高置信建议；具体加速倍数还需要你在自己的 M4 Max + 真实会议录音上做一次 trace**。 citeturn32view5turn32view0turn40view2

第二，**实时多人 diarization**。从公开资料看，不论是 Granola 桌面端，还是 `mlx-qwen3-asr` 当前的 diarization 能力，现实路线都更偏向“会后/离线高质量”而不是“会中低延迟强行上线”。如果你的产品在短期内主要面向“我 + 对方”的线上会议，那最实用的办法可能不是立刻上通用 diarization，而是先利用采集链路里的通道信息做 “我 / 对方” 二分类，再把真正的多说话人分离放到会后增强阶段。只有当你确认多人会是核心高频场景时，才值得把实时 diarization 提到更高优先级。 citeturn12view1turn28view0turn33view2

综合起来，我对 F195 的最终建议是：**不换主模型，先修管道；不追求一步到位的“完美转写”，先把分层架构搭对；不把说话人分离强塞进实时链路，先让会后版本稳定可用**。如果只能押一个最可能立刻改善用户主观感受的组合，那就是：**VAD 驱动切分 + MLX Qwen3-ASR + context 热词 + 标点段落恢复**。这是当前证据最强、工程风险最低、且与你现有栈最兼容的一条路。 citeturn25view4turn40view2turn28view0turn35view1turn36view0