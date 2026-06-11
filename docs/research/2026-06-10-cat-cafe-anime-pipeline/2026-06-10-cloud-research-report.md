---
title: Cat Cafe 动画短剧生产管线深度调研报告
doc_kind: research-report
created: 2026-06-10
topics: [anime, video, pipeline, story-to-video, tts, subtitles, github, open-source]
related_features: [F138]
related_docs:
  - cloud-research-mode-b-consult.md
  - 2026-06-10-video-generation-failure-modes-v0.1.md
  - 2026-06-10-animation-recruitment-brief-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
---

# Cat Cafe 动画短剧生产管线深度调研报告

## 执行建议

**结论：要建，但不要把它建成“脚本一贴进去，自动吐出 2–3 分钟成片”的黑箱。**  
截至 2026 年 6 月，最有工程可行性的证据仍然指向**镜头级生产**而不是**整片端到端生成**：Runway Gen-4 官方仍以 **5 秒或 10 秒**视频为基本生成单位；Google Flow 的官方帮助中心把创作组织成 **scenes** 与 **ingredients**；LTX-Video 虽然已经支持 **keyframes、video extension、多条件媒体控制**，但官方仍建议工作在 **257 帧以下**且把 prompt 写成“像 cinematographer 的 shot 描述”；Wan2.1 官方给出的可运行基线也还是 **5 秒 480p** 量级。换句话说，今天的“长片”能力更像是**多镜头工作流 + extension + 编辑**，而不是一次性生成完整 3 分钟。citeturn36search0turn36search15turn3search10turn3search12turn40view3turn9view0

**角色连续性是这条管线成败的核心，而且现有证据不支持“只靠更长文本提示词”就能稳定解决。**  
Runway 官方做长片教程时明确建议先做 **character plates**，理由就是只用单张角色图会出现细微变化；其 Gen-4 References 也把角色、风格、物体提取做成单独工作流。开源侧，StoryDiffusion 直接把“长程一致角色图像/视频”当成主要卖点，IP-Adapter 则把参考图条件化做成基础能力；HunyuanCustom 也不是靠纯文本，而是通过 **image/audio/video/text** 多模态条件来强化 subject consistency；EchoShot 更是把“multi-shot identity consistency”做成专门研究问题。对 Cat Cafe 来说，这意味着 **character bible + reference sheets + accepted reference frames + shot-level manifests** 才是主线，LoRA 只是后续增强手段，不应是 MVP 的第一锤。citeturn36search13turn36search1turn9view3turn9view2turn31view1turn38search4turn38search1

**我建议的 MVP 形态**是：  
**脚本 → beat sheet → shot list → 角色参考板/关键帧 → 每镜头短视频生成 → EDL 拼接 → 全场景或全集音频 → 强制对齐字幕 → 渲染 → QA。**  
其中镜头再分成三条 lane：  
第一条是**剧情/环境/动作镜头**，走 keyframe / reference → I2V；第二条是**对白近景**，单独走 audio-driven portrait 或多角色对话模型；第三条是**补洞镜头**，包括 freeze、pan/zoom、插入画面、字幕卡和过场。之所以要分 lane，是因为当前 talking-portrait 模型与通用视频模型已经明显分化：FantasyTalking、MultiTalk、HunyuanVideo-Avatar、Runway Act-Two 都把音频驱动人像或多角色对话做成单独能力，而且明确支持 stylized / cartoon / non-human 场景；这比强行让一个通用 T2V/I2V 模型承担所有对白镜头更现实。citeturn37search6turn37search1turn31view0turn36search5turn36search7

**优先评估的开源件**我会排成这样：  
先看 **Jellyfish** 的“短剧工作台/一致性管理/shot-ready 状态机”，再看 **WhisperX** 的强制对齐，接着用 **StoryDiffusion + IP-Adapter** 做角色关键帧与角色板，再用 **LTX-Video** 与 **Wan2.1** 做镜头生成基线，用 **FFmpeg** 做底座拼接，用 **Remotion** 只做可替换的渲染前端；TTS 先并行评估 **OpenVoice** 与 **CosyVoice**。真正应该自己写的是 **Cat Cafe 的 series/character bible、clip inventory、edit manifests、continuity QA、provider adapters**，因为这些正是 Jellyfish、OpenMontage、KrillinAI、Toonflow 这类系统最有启发、但又最不应该直接照搬代码的部分。citeturn28view0turn10view1turn9view3turn9view2turn10view3turn9view0turn39search2turn39search0turn19search13turn17view2turn17view0turn24view0turn24view4turn28view1

## 证据矩阵

下表只放**真正进入结论**的工具或来源；`Activity/maturity` 优先看**release/维护状态/文档/问题信号**，而不是只看 star。

| Area | Repo/tool/source | License | Activity/maturity | Solves | Does not solve | Cat Cafe action |
|------|------------------|---------|-------------------|--------|----------------|-----------------|
| 工作台与资产一致性 | Jellyfish `github.com/Forget-C/Jellyfish` citeturn28view0 | Apache-2.0 | `v0.3.2` 于 **2026-04-17**；约 **3.8k⭐**；README 明确包含 script breakdown、consistency、shot prep、async task center citeturn28view0 | 从 script 输入一路到 storyboard、资产一致性、shot 准备、生成任务与导出 | 不是 anime 专项；仍是新项目；不替你解决最终审美与剪辑判断 | **Pilot** |
| Agent 编排与契约 | OpenMontage `github.com/calesthio/OpenMontage` citeturn24view0turn26view0 | AGPL-3.0 | README 声称 **12 pipelines / 52 tools / 500+ skills**；约 **4.6k⭐**；有 contract tests；**无 release**，但 2026-04 仍在加 Seedance 支持 citeturn24view0turn25view5turn11search4 | stage-driven artifacts、skills、schemas、质量门、provider 适配思路 | 不是 narrative anime 专项；AGPL 不适合静悄悄地掐代码进闭源核心 | **Learn architecture only** |
| 分阶段 CLI / Skills 结构 | KrillinAI `github.com/krillinai/KrillinAI` citeturn24view4turn25view0 | GPL-3.0 | **v2.0.3** 于 **2026-06-09**；约 **10.3k⭐**；有 `skills/`、分阶段 CLI、pipeline orchestration citeturn24view4turn25view0 | “每阶段独立执行并输出结构化结果”的 skill 设计，非常适合借鉴到 `anime-video-forge` | 重点是本地化/配音，不是剧情镜头生成；GPL 直接复用会带来传染性 | **Learn architecture only** |
| 节点图实验台 | ComfyUI `github.com/Comfy-Org/ComfyUI` citeturn10view0turn29search1 | GPL-3.0 | 官方 core 持续维护；生态庞大；有视频节点与大量社区 custom nodes citeturn10view0turn29search0turn29search17 | 把参考图、LoRA、Control、I2V/T2V、视频 I/O 组合成可实验工作流 | 不该做 source of truth；节点生态抖动大；GPL 约束明显 | **Pilot** |
| 开源视频基线 | Wan2.1 `github.com/Wan-Video/Wan2.1` citeturn9view0turn10view4 | Apache-2.0 | 2025-02 发布，2025-03 进 Diffusers，2025-02 进 ComfyUI；1.3B 模型可在消费级 GPU 跑；官方写明 **5 秒 480p 在 4090 上约 4 分钟** citeturn9view0 | 本地 T2V/I2V 基线；低显存入口；中英文本能力；与 Comfy/Diffusers 生态联动 | 不自动解决多镜头连续性；生成仍慢；需要大量镜头后期 | **Pilot** |
| 开源可控视频基线 | LTX-Video `github.com/Lightricks/LTX-Video` citeturn10view3 | 代码 Apache-2.0；新 checkpoint 商用条款转向 OpenRail-M citeturn10view3 | **v0.9.5** 于 **2025-03-05**；约 **10.4k⭐**；官方支持 **keyframes、video extension、多条件媒体控制** citeturn10view3turn40view3 | 对“关键帧条件化镜头生成”特别有价值；支持 extension；多条件对镜头级制作友好 | 仍然不是整片系统；最佳工作区间低于 257 帧；要自己做资产账本与剪辑 | **Pilot** |
| 一致角色关键帧 | StoryDiffusion `github.com/HVision-NKU/StoryDiffusion` citeturn9view3turn10view5 | Apache-2.0 | NeurIPS 2024 Spotlight；约 **87 commits**；主打 consistent self-attention 与两阶段长视频思路 citeturn9view3turn10view5 | 生成角色一致的漫画帧、角色板、场景 keyframes，很适合 anime pre-production | 不是最终成片引擎；README 里视频示例也明确是“两阶段”的延伸策略 | **Pilot** |
| 参考图条件化 | IP-Adapter `github.com/tencent-ailab/IP-Adapter` citeturn9view2 | Apache-2.0 | 已接入 Diffusers/ComfyUI；训练代码已放出；长期被当作“1-image LoRA”式基础组件使用 citeturn9view2 | 把角色/风格/主体参考图稳定注入图像与视频生成链路 | 不能单独解决长程 continuity、镜头设计或跨 shot 叙事 | **Adopt** |
| 强化 subject consistency 的重模型 | HunyuanCustom `github.com/Tencent-Hunyuan/HunyuanCustom` citeturn31view1turn34view0 | Tencent Hunyuan Community License；**不适用于 EU/UK/韩国** citeturn34view0 | 2025-05 发布；约 **1.2k⭐**；官方给出 **最低 24GB、推荐 80GB** 的显存要求 citeturn31view1turn32view0 | 多模态 subject-consistent video：image/audio/video/text 条件都可用 | 计算太重、许可证复杂，不适合先做本地 MVP 默认路径 | **Learn architecture only** |
| 强制对齐与说话人 | WhisperX `github.com/m-bain/whisperx` citeturn10view1 | BSD-2-Clause | 约 **556 commits**；README 明写 **word-level timestamps & diarization** citeturn10view1 | 词级时间戳、说话人分离，最符合“全场景音频先行，再对齐字幕”的原则 | 不负责 TTS、不负责镜头剪辑；对极端拟声/夸张演绎仍要人工校验 | **Adopt** |
| 老牌 Whisper 时间戳增强 | stable-ts `github.com/jianfch/stable-ts` citeturn24view7 | MIT | **2026-05-30 archived**，只读；README 还写明 development indefinitely paused citeturn24view7 | 时间戳修正、音频索引 | 已经归档，不该继续作为主线依赖 | **Avoid** |
| 多语种即时声线克隆 | OpenVoice `github.com/myshell-ai/openvoice` citeturn17view2turn18view2 | MIT | V2 自 2024-04 起 MIT；约 **36.6k⭐**；支持中英日法西韩等多语种 citeturn17view2turn18view2 | 商用友好的多语种 voice identity 起点，适合 recurring characters 先建立“固定声线” | 不提供稳定字幕时间戳；情绪控制与导演粒度仍需实测 | **Pilot** |
| 中文优先的高自然度 TTS | CosyVoice `github.com/FunAudioLLM/CosyVoice` citeturn17view0turn18view1 | Apache-2.0 | README 路线图到 **2025-12**；约 **21.6k⭐**；强调 zh/en/日/韩与中文方言、content consistency、pronunciation inpainting citeturn17view0turn18view1 | 对中文对白和口音/发音控制很有吸引力；适合作为 Cat Cafe 中文主声轨候选 | 仍需你们自建 alignment、角色管理与批处理控制 | **Pilot** |
| 可替换渲染前端 | Remotion `github.com/remotion-dev/remotion` citeturn39search0turn39search3 | 特殊 Remotion license；某些公司场景需 company license citeturn39search0turn39search3 | 文档 2026-06 仍在更新；issues 2026-06 持续活跃；`@remotion/captions` 提供统一 caption shape 与 SRT 工具 citeturn39search6turn19search13turn19search4turn19search16 | 对 `video-spec.json` / `subtitle-track.json` 这种 spec-first 合成很合适；字幕动画和组件化强 | 不是免费无条件 OSS；也不是你们的 pipeline source-of-truth | **Pilot** |
| 媒体底座 | FFmpeg `github.com/FFmpeg/FFmpeg` citeturn39search2turn39search5 | 主要 LGPL v2.1+，部分组件 GPL citeturn39search5 | 极成熟；官方文档明确推荐 concat filter 做重编码拼接 citeturn19search23turn19search1 | trim、concat、freeze、转码、字幕烧录、filtergraph，是整个流水线的最低层保险绳 | 命令层复杂，直接把它当 source-of-truth 会失控 | **Adopt** |
| QA 积木 | PySceneDetect `github.com/Breakthrough/PySceneDetect` + open_clip `github.com/mlfoundations/open_clip` + SyncNet `github.com/joonson/syncnet_python` citeturn21view2turn23view0turn21view1 | BSD-3 / MIT / MIT | PySceneDetect **v0.7** 于 **2026-05-03**；open_clip **v3.3.0** 于 **2026-02-27**；SyncNet 较老但功能专注 citeturn21view2turn22view0turn23view0turn21view1 | scene-cut 检测、参考图相似度、lip-sync lag 评估，可拼出 continuity QA | 没有现成的“anime continuity QA”整套方案；阈值、视图与审阅交互都要自己做 | **Pilot** |

**我刻意没有把 generic shorts 自动化系统放进优先结论。**  
ShortGPT 与 OpenShorts 对“自动配音、自动字幕、自动发布”有启发，但它们的目标更接近 YouTube/TikTok 自动化而非 recurring characters 的剧情动画；而且现有公开 issue 已经暴露出成片时长、字幕显示等问题。它们更适合借鉴“编辑 DSL / 平台自动化”，不适合做 Cat Cafe 的故事片主干。citeturn24view2turn11search6turn24view3turn11search15

## 推荐生产管线蓝图

**下面这套蓝图是推断，不是任何单个仓库的直译。**  
它综合了 Jellyfish 的“script breakdown → shot preparation → candidate confirmation → shot ready → generation workspace”、OpenMontage 的 contract/schema 思路、KrillinAI 的阶段化技能与结构化输出、Toonflow 的外置技能文件与 provider 配置、WhisperX 的强制对齐能力，以及 Remotion/FFmpeg 的字幕与渲染接口。结论很明确：**你们应该把 prompts 降级为“派生物”，把 manifests / bibles / EDLs 升级为“系统真实来源”。** citeturn28view0turn24view0turn24view4turn28view1turn10view1turn19search13turn39search2

**我建议的端到端流程**是：  
先由人类 CVO 与 agent 一起维护 `series-bible` 和 `character-bible`；再把 `episode-script` 拆成 `beat-sheet` 和 `shot-list`；随后走“角色板 / 场景板 / keyframes”的预制阶段；每个 shot 生成多个 clip takes 并进入 `clip inventory`；接受的 takes 进入 `edit-decision-list`；音频采用**全场景或全集先生成**的策略，再由 WhisperX 之类的对齐工具生成词级 cue；最后通过 `video-spec` 交给 Remotion 或 FFmpeg 渲染，同时跑自动 QA 并让人类只审**被标红的 shot**。对白近景单独走 audio-driven lane，环境与动作镜头走 keyframe-conditioned I2V，补洞镜头走 still / insert / freeze / typography lane。citeturn28view0turn10view1turn19search13turn36search13turn37search6turn37search1turn31view0

| Artifact | owner | source of truth or derived | validation rule |
|---|---|---|---|
| `series-bible.md/json` | human 主责，agent 辅助整理 | **Source of truth** | 必须有 `series_id`、世界规则、叙事基调、画风关键词、禁改 canon、版本号；任何 episode 不能写回冲突事实 |
| `character-bible.json` | human 主责，agent 维护增量 | **Source of truth** | 每个角色必须有稳定 `character_id`、参考图集、accepted character plates、voice profile、关系事实、禁用设定、服装/形态版本 |
| `episode-brief.md` | human 提供目标，agent 起草 | **Source of truth** | 必须写清 episode 目标、情绪弧线、时长上限、关键剧情约束、必须出现/不能出现元素 |
| `episode-script.md` | human 审批，agent 可草拟 | **Source of truth** | 台词、旁白、说话人、语言、场景顺序完整；审定后冻结，不允许下游 silently rewrite |
| `beat-sheet.json` | agent 生成，人审 | **Derived but locked after approval** | 每个 beat 必须映射到 script 段落；必须估计时长；必须标记情绪与信息功能 |
| `shot-list.json` | agent 生成，人审 | **Source of truth for visual production** | 每个 shot 要有 `shot_id`、beat 引用、镜头类型、持续时间预算、角色/场景/道具引用、机位说明、对白绑定 |
| `keyframe-manifest.json` | model 生成候选，agent 组织，人选定 | **Derived** | 每个 shot 至少一张 accepted keyframe 或明确豁免；必须记录 seed / model / refs / workflow hash |
| `clip-generation-manifest.json` | agent 生成，tool 执行 | **Source of truth for generation jobs** | 每个 job 必须绑定 `shot_id`、provider/model、input refs、prompt、negative prompt、target duration、fps、重试策略 |
| `clip-inventory.json` | generated tool + agent | **Derived but operationally critical** | 必须保存每个 take 的路径、元数据、从属 shot、accept/reject 状态、拒绝原因、QA flags、人工备注 |
| `audio-manifest.json` | agent 准备，TTS/tool 生成，人审 | **Source of truth for audio assets** | 区分 master scene audio、角色 stem、BGM、SFX；必须有 speaker map、采样率、情绪标签、版本号 |
| `subtitle-track.json` | generated tool | **Source of truth for captions** | 采用内部 JSON cues；必须保留 `speaker_id / start_ms / end_ms / text / words[]`；行级与词级都要能追溯 |
| `subtitle.srt / subtitle.ass / subtitle.vtt` | generated tool | **Derived** | 全部从 `subtitle-track.json` 导出，不允许手工成为唯一真相；SRT 用交付，ASS 仅在确需 karaoke/styling 时导出 |
| `edit-decision-list.json` | agent 生成，人审 | **Source of truth for assembly** | 每个轨道事件必须引用 clip/audio/subtitle IDs；必须写明 trim、freeze、hold、插入画面、转场与补洞规则 |
| `video-spec.json` | agent 生成，renderer 读取 | **Source of truth for render target** | 不得写死 Remotion 组件名；必须是 renderer-agnostic 的 composition contract |
| `qa-report.md/json` | generated tool + human reviewer | **Derived** | 必须包含 continuity、audio duration、subtitle mismatch、lip-sync、style drift、license provenance、人工结论 |

**字幕与时序格式建议**也要定死。  
内部只保留一个 canonical 格式：`subtitle-track.json`。它最好接近 Remotion `Caption` 一类的统一 cue 结构，因为 Remotion 已经提供 SRT 解析与导出工具；交付时再导出 `SRT`，如果要做逐字高亮或夸张 karaoke，再从同一个 canonical JSON 导出 `ASS` 或直接在 Remotion/FFmpeg 中做烧录动画。**不要让 SRT/ASS 反客为主，成为唯一真相。** 同理，`edit-decision-list.json` 与 `video-spec.json` 应该能同时喂给 Remotion 和 FFmpeg。citeturn19search13turn19search4turn19search16turn19search10turn19search23turn39search2

## 架构选项比较

**事实层面的约束**很明显：最轻量、最现实的本地开源视频基线是 Wan2.1 / LTX-Video；而 HunyuanCustom 这类 subject-consistent 强模型在许可证和显存上都更重。渲染层 FFmpeg 最稳，Remotion 可做上层；字幕对齐层 WhisperX 最成熟。基于这些约束，我建议**产品方向选 Balanced production pipeline，但执行顺序先交付 Lean MVP**。citeturn9view0turn10view3turn31view1turn34view0turn10view1turn39search2turn39search0

| 选项 | 形态 | 预期人工工作量 | 模型/API 依赖 | 计算/成本敏感度 | 主要失败模式 | 先做什么 |
|---|---|---|---|---|---|---|
| Lean MVP | 无数据库或最薄资产目录；用 manifests + 文件夹完成一集；shot list 由 agent 起草，人手动锁镜头 | **高**：镜头挑选、take 接受、补洞和 QA 仍主要手工 | **中到高**：可以先混用 Runway/本地 Wan/LTX；TTS 与对齐可开源 | **中**：主要花在反复 regen 与人工返工 | 风格飘、角色不稳、对白口型一般、时间轴和镜头长度对不上 | 先实现 `character-bible`、`shot-list`、`clip-inventory`、`subtitle-track`、`EDL` |
| Balanced production pipeline | 有结构化项目目录、clip inventory、provider adapters、自动 QA、可切换 Remotion/FFmpeg | **中**：人主要做审批与红旗镜头复查 | **中**：对单一供应商不锁死；本地模型与 SaaS 可并存 | **中到高**：需要一定工程，但可控 | 过度设计元数据；QA 阈值早期不准；多 provider 输出风格不一致 | 先把 manifests/QA/render adapters 做稳，再加最薄 UI |
| Ambitious studio | Jellyfish/Toonflow 风格工作台 + 队列 + 资产数据库 + 多用户审阅 + continuity dashboard | **低到中**：后期效率高，但前期建站成本大 | **高**：需要长期维护 provider 与模型变更 | **高**：前期投入大，且最怕把时间花在 UI 而不是成片质量 | 工具做成了，片子却仍不好看；review burden 被 UI 掩盖；锁死某栈 | 第一阶段不要做；等 3–5 集样片后再决定是否上数据库与队列 |

**我的明确建议：**  
下周不要做 `Ambitious studio`。先按 **Lean MVP** 交出可看的第一集，再把保留下来的 artifacts 与流程固化成 **Balanced production pipeline**。这条路线最符合现有公开证据，也最符合你们 F138 里“spec-first / renderer-decoupled / human-in-the-loop”的原则。citeturn28view0turn24view0turn24view4turn28view1

## 反证与主要风险

**先说会推翻或修正你们原始假设的证据。**

第一，**“现实路线一定是纯 clip stitching，而不是任何长视频能力”**，这句话并不完全成立。  
反证是存在的：SkyReels-V2 明确打出 **infinite-length film generative model**；EchoShot 直接做 **multi-shot portrait video generation**；Wan 的社区包装器甚至展示了 **1025 帧上下文窗口实验**。这说明“native multi-shot / long-video”并不是空想，而是在快速演进。**但**这些证据要么偏研究、要么偏 portrait、要么来自明确写着 *WORK IN PROGRESS* 的 community wrapper，不足以支撑 Cat Cafe 下周把主路线押宝在“长视频单模型”上。我的推断因此不是“长视频不可能”，而是“**现在还不该把它当主干**”。citeturn37search3turn38search1turn35view0

第二，**“角色一致性要靠 LoRA”**，这句话也需要修正。  
公开证据更支持的其实是：**character plates / reference images / accepted keyframes 先行，LoRA 后置。** Runway 教程明确建议先做 character plates；Gen-4 References 也是从参考图提取角色/风格/物体。开源侧，IP-Adapter 与 StoryDiffusion 也更像“参考图驱动的一致性工具”。与此同时，社区节点现实很残酷：`ComfyUI_IPAdapter_plus` 作者已把仓库标成 **maintenance only**；`ComfyUI-WanVideoWrapper` 维护者更直接写明，如果原生 ComfyUI 已有功能，“你其实不该用 wrapper”，而且 README 也解释了未合并 LoRA 可能显著增加显存；真实 issue 中也有人反馈一加 LoRA 就 OOM。对 Cat Cafe 来说，这意味着 LoRA 不是不能用，而是**不应该成为第一阶段的默认依赖**。citeturn36search13turn36search1turn9view2turn9view3turn9view4turn35view0turn30search17

第三，**“最可复用的价值主要来自 orchestration，而不是模型本身”**，这也只能算“多数正确”。  
Jellyfish、OpenMontage、KrillinAI、Toonflow 确实说明了：artifact contracts、skills、provider adapters、shot-ready gates 才是可复用的生产骨架。可是另一边，LTX-Video 的 keyframe / multi-condition / extension、EchoShot 的 multi-shot、HunyuanCustom 的 subject consistency，都是会**实质性改变你们镜头设计方式**的能力。也就是说，正确的说法应该是：**最可复用的骨架来自 orchestration；最可提升质量的突破，仍然会来自模型能力。** citeturn28view0turn24view0turn24view4turn28view1turn40view3turn38search4turn31view1

**再说如果这件事会失败，最可能怎么失败。**

最现实的失败点不是“模型不够酷”，而是**工程与授权约束**。  
HunyuanCustom 官方给到的推荐显存是 **80GB**，最低 **24GB** 也会很慢；HunyuanVideo-Avatar 官方推荐 **96GB**，最低 **24GB**；Remotion 对某些公司场景需要单独的 company license；Toonflow 虽然公开说自己基于 Apache-2.0，但同时又附了**补充商业协议**；Wav2Lip README 更直接写的是 **Non Commercial Open-source Version**。所以如果你们一开始就围绕这些工具做“默认生产栈”，很容易在第三步才发现许可或算力不通。citeturn31view1turn31view0turn39search0turn39search3turn27search9turn21view0

第二个失败点是**把自动化当成审美替代品**。  
Jellyfish 明确有“candidate confirmation”“shot readiness”；Toonflow 明确有三层 agent 协作里的 supervision layer；OpenMontage 强调 quality enforcement 与 contract tests。换句话说，先进项目的共同点不是“没人审”，而是“**只让人审有意义的节点**”。反过来，generic shorts 工具的公开 issue 已经说明，自动字幕显示、成片时长之类的基础问题都可能在真实使用中暴露。对剧情动画来说，**最终剪辑判断依旧是人工优势区**，而自动化真正应该做的是把人工注意力聚焦到最贵的地方。citeturn28view0turn28view1turn24view0turn11search15turn11search6

第三个失败点是**对齐栈选错代**。  
`stable-ts` 已于 **2026-05-30** 归档；`aeneas` 仍有人在 2024–2025 年报告安装问题，而更早的 issue 还提到即便是干净 TTS 音频，对齐质量也可能很差。相反，WhisperX 至少在 repo 设计上就是词级时间戳与 diarization 工具；Qwen3-ForcedAligner 则是 2026 年出现的新路线，支持 **11 种语言、任意单位时间戳**，但社区讨论也说明部署和 serving 仍在摸索。我的建议因此很直接：**WhisperX 做默认，Qwen3-ForcedAligner 做 spike，stable-ts/aeneas 不再做主线。** citeturn24view7turn14search14turn14search5turn10view1turn13search1turn13search9

## 下一步 Spikes 与 anime-video-forge 技能提纲

**这些 spike 都足够小，能各自独立完成，并且都应该有明确的 pass/fail。**  
它们的目标不是证明“整套系统已经完成”，而是尽快回答最贵的问题：角色认不认得出来、对白能不能对齐、镜头拼起来像不像一集片子。这个优先级来自前面的事实：当前系统的胜负手不在大模型名字，而在 continuity、alignment、assembly 与 QA。citeturn36search13turn28view0turn10view1turn39search2

- **Spike：固定角色板，生成 20 秒双人对话场景。**  
  方案：用同一套角色参考板 + 统一服装版本，拆成 3 个 shot；近景对白可试 audio-driven lane，环境镜头走 I2V。  
  **Pass：** 同一对角色跨 3 个 clip 可辨认；至少 2 个 clip 无需超过 1 次重生；人工认为“同集同场景”。  
  **Fail：** 每个 shot 都要大量修图/重生，或者角色服装/面部差异明显。

- **Spike：全场景音频先行 + WhisperX 强制对齐。**  
  方案：先合成一段 25–35 秒 master scene audio，再用 WhisperX 得出词级时间戳，自动组行生成 `subtitle-track.json` 与 SRT。  
  **Pass：** 字幕整体偏移 < 200ms；行切分基本可读；角色切换不需要人工逐词修。  
  **Fail：** 必须手工一条条对字幕，或者说话人映射频繁错误。

- **Spike：角色板生成与关键帧一致性包。**  
  方案：先用 StoryDiffusion / IP-Adapter 生成主角在 3 个角度、2 套表情、2 套服装的 character plates，再做 6–8 张 story keyframes。  
  **Pass：** 不同角度下角色仍明显同一人/同一猫；可直接拿去喂后续镜头生成。  
  **Fail：** 每换角度就像换角色，只能回到纯手工挑图。

- **Spike：LTX-Video 与 Wan2.1 的镜头生成对比。**  
  方案：对同一 shot brief 做一组 keyframe-conditioned LTX 和一组 Wan I2V/T2V，对比风格延续、镜头跟随、重生次数和时长。  
  **Pass：** 至少有一个模型在 6 个 shot 中稳定过半，且单 shot 平均人工返工可控。  
  **Fail：** 两边都要高频人工修正，或者镜头语言不可控。

- **Spike：对白近景 lane 验证。**  
  方案：把一个 10–15 秒近景对白交给 FantasyTalking / MultiTalk / HunyuanVideo-Avatar / Act-Two 中任一可用方案，专测口型与情绪。  
  **Pass：** 口型主观可接受；字幕偏移不明显；角色风格没崩。  
  **Fail：** 嘴型明显错拍，或 stylized 角色被拉回真人感太强。

- **Spike：双渲染器一致性。**  
  方案：同一个 `edit-decision-list.json` 和 `video-spec.json` 同时喂给 FFmpeg 与 Remotion。  
  **Pass：** 两个输出在镜头时长与字幕时序上误差不超过 ±2 帧；`subtitle-track.json` 无需改写。  
  **Fail：** render target 一换就要改 manifests，说明你们没有真正 decouple renderer。

- **Spike：continuity QA 红旗门。**  
  方案：把 PySceneDetect + open_clip + SyncNet 接上生成片段，输出 style drift / identity drift / lip-sync lag / duration mismatch 红旗。  
  **Pass：** 能自动筛出“最值得人工看”的 20–30% shot。  
  **Fail：** QA 误报过多，结果等于全量人工重看。

- **Spike：许可证与部署审计。**  
  方案：逐个核对 MVP 候选仓库/license/model card，产一份 `license-audit.md`。  
  **Pass：** 明确哪些能直接商用，哪些只能借架构，哪些必须避开。  
  **Fail：** 到接近上线时才发现 GPL/AGPL/community license/company license 冲突。

**我建议的 `anime-video-forge` skill 目录不是一个大 prompt，而是一组相互咬合的 stage skills。**  
最应该借鉴的是 KrillinAI 的 `skills/`、Toonflow 的 Markdown skill files，以及 OpenMontage 的 schemas / contract tests。换言之，`anime-video-forge` 应该是**技能集合 + artifact contracts + adapters + QA gates**，而不是“一段超级 prompt”。citeturn24view4turn28view1turn24view0turn25view5

建议提纲如下：

- **Trigger description**  
  什么时候触发：已有 `episode-script.md` 或更上游材料，但还没有锁定 shot list；或者已有 shot list 需要生成/重生成/出片。

- **Required starting parameters**  
  `project_id`、`episode_id`、`language`、`target_duration_s`、`aspect_ratio`、`style_profile`、`primary_provider_set`、`tts_backend`、`render_target`、`review_mode`。

- **Directory layout**  
  ```text
  episodes/
    E###/
      bibles/
      script/
      beats/
      shots/
      refs/
      keyframes/
      clips/
      audio/
      subtitles/
      edits/
      qa/
      exports/
  ```

- **Artifact contracts**  
  明确每个 JSON 的字段、version、required keys、enum、引用关系；要求所有下游只读上游，不得 silently mutate。

- **Workflow stages**  
  `script-normalize` → `beat-plan` → `shot-design` → `reference-pack` → `keyframe-gen` → `clip-gen` → `audio-master` → `forced-align` → `edit-assemble` → `qa-check` → `review-handoff`。

- **Tool adapters**  
  `provider.video.runway`、`provider.video.ltx`、`provider.video.wan`、`provider.tts.openvoice`、`provider.tts.cosyvoice`、`align.whisperx`、`render.ffmpeg`、`render.remotion`。  
  适配器只读 manifests，不能把 provider-specific prompt 变成唯一真相。

- **QA gates**  
  `identity-drift`、`style-drift`、`lip-sync`、`subtitle-offset`、`duration-mismatch`、`license-provenance`、`missing-refs`。  
  任何 blocker 必须出现在 `qa-report.json`。

- **Common gotchas**  
  单张角色图导致 subtle variation；LoRA 加速显存爆炸；字幕被导出格式反客为主；对白近景误用通用 I2V；accepted take 没有写回 inventory；重生成后忘记失效旧 EDL。

- **Review handoff format**  
  对人类 reviewer 不要丢一堆散文件，而要给：  
  `review-summary.md` + `qa-report.md/json` + `candidate-takes.csv/json` + `preview.mp4` + `open_questions.md`。

**最后给一份我建议最先看的排序清单。**

1. **Jellyfish** `github.com/Forget-C/Jellyfish`：最接近你们要做的“短剧工作台 + consistency + shot readiness”。citeturn28view0  
2. **WhisperX** `github.com/m-bain/whisperx`：把“全局音频先行 + 强制对齐”做稳，是你们字幕和对白节奏的地基。citeturn10view1  
3. **StoryDiffusion** `github.com/HVision-NKU/StoryDiffusion`：最适合先做 recurring characters 的参考板与关键帧。citeturn9view3turn10view5  
4. **IP-Adapter** `github.com/tencent-ailab/IP-Adapter`：把参考图条件化做成基础能力，而不是靠玄学 prompt。citeturn9view2  
5. **LTX-Video** `github.com/Lightricks/LTX-Video`：如果你们最关心 keyframes、extension 与多条件镜头控制，它是高优先级。citeturn10view3turn40view3  
6. **Wan2.1** `github.com/Wan-Video/Wan2.1`：如果你们最关心本地可跑、低显存入口与 Comfy/Diffusers 生态，它是高优先级。citeturn9view0turn10view4  
7. **OpenVoice** `github.com/myshell-ai/openvoice`：商用友好的 recurring voice 起点。citeturn17view2turn18view2  
8. **CosyVoice** `github.com/FunAudioLLM/CosyVoice`：如果中文对白和发音控制比跨语种更重要，和 OpenVoice 并行验证。citeturn17view0turn18view1  
9. **FFmpeg** `github.com/FFmpeg/FFmpeg`：别拖到最后才规范它；它应该从第一天就是 assembly 底座。citeturn39search2turn19search23  
10. **Remotion** `github.com/remotion-dev/remotion`：如果公司许可证可接受，它是很好的上层 renderer，但一定保持可替换。citeturn39search0turn19search13  
11. **OpenMontage** `github.com/calesthio/OpenMontage`：不是为了抄代码，而是为了抄“contracts / schemas / stage skills / quality gates”的组织方法。citeturn24view0turn25view5

**一句话落地建议：**  
下周最值得做的不是“再找一个更神的视频模型”，而是把 **角色板、镜头 manifest、clip inventory、强制对齐、EDL、QA 红旗** 这六件事先固定下来。只要这六件事稳了，视频模型可以替换；如果这六件事不稳，任何模型都会把你们拖回手工混乱。citeturn28view0turn24view0turn10view1turn39search2
