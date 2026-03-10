---
feature_ids: [F092]
topics: [voice, companion, hands-free, TTS, STT, AirPods, typeless]
doc_kind: research
created: 2026-03-10
---

# F092 Cats & U 语音陪伴体验 — GPT Pro 调研

> 委托人：布偶猫/宪宪 (Opus 4.6)  日期：2026-03-10

## Part 1: 发给 GPT Pro 的提示词

见 `docs/prompts/2026-03-10-f092-voice-companion-research-prompt.md`

四大调研问题：
1. 浏览器音频自动播放政策 + PWA 方案
2. AirPods 与 Web 应用的交互能力
3. typeless 和 STT 优化方案
4. 语音对话模式的 UX 参考

## Part 2: GPT Pro 回答（待回填）

这事能做，而且我会很明确地给一个判断：

**已确认**：纯 Web/PWA 能把体验从“要点播放的语音留言板”推进到“进入语音模式后基本免手”，但它拿不到 iPhone 上完整、稳定的后台音频和硬件控制。最大的硬边界有三块：Safari/Chrome 的有声 autoplay 仍受限，Web 只能接到媒体动作层而不是 AirPods 原始捏压事件，iOS standalone PWA 的后台音频链路虽然这些年改善了，但围绕 `ended`、下一条自动续播、锁屏控制仍有公开 bug 和回归报告。([Chrome for Developers][1])

**推测/工程判断**：最省钱也最稳的路线是两段式。先做 web-first，把 70 分体验拿到手。再在确认“锁屏后台 + AirPods 切 thread + Siri/Shortcuts”真是高频之后，用 **Capacitor** 包一层 native shell，直接桥到 `AVAudioSession`、后台音频、App Intents / App Shortcuts。以你们现有 Next.js 代码栈看，我不建议为这个场景重写 React Native。([Capacitor][2])

**已确认**：Typeless 值得借鉴的是产品形态，不像一个现成可接的公开 STT 平台 API。它公开展示的是跨平台 AI 语音键盘/听写产品，强调去口癖、去重复、自动格式化、个人词典、混语输入、按 app 调整语气，以及零保留与云端处理。([Typeless.com][3])

---

## 1. 浏览器音频自动播放政策 + PWA

### 1.1 Chrome / Safari 现在怎么管 autoplay

**已确认**：Chrome 仍是这套规则。静音自动播放一直允许；带声音的自动播放要满足用户交互、桌面端 MEI 条件，或者移动端被加到主屏/桌面安装为 PWA 等条件。顶层页面还能通过 Permissions Policy 把 autoplay 能力委托给 iframe。([Chrome for Developers][1])

**已确认**：Safari / WebKit 仍然更严。无音轨或 muted 的媒体可以自动播；带声音的媒体通常需要用户手势，`play()` 不满足条件会被拒绝。macOS Safari 也默认会拦截有声自动播放，只是用户能做站点级配置。([WebKit][4])

**结论**：你们不能把“自动播第一句猫叫”当成默认能力，必须把“启动语音模式”的用户手势设计成产品入口，而不是把它当 bug 绕过去。

### 1.2 合法可行的“绕法”有哪些

**已确认**：真正合法可行的路主要有四条。第一，显式用户手势，比如“开始语音陪伴”按钮。第二，静音或无音轨 autoplay。第三，Chrome 侧利用安装 PWA / 加到主屏带来的更宽松条件。第四，若音频在 iframe 内，由顶层页通过 Permissions Policy 授权。Media Session API 本身不解锁 autoplay，它只是把系统媒体控制动作递给网页。([Chrome for Developers][1])

**工程建议**：首击时一次性做完五件事：`AudioContext.resume()`、prime 一个全局 `<audio>`、请求麦克风权限、注册 Media Session action handlers、记录“本 tab 已解锁音频”。这样后面整条链就不容易散架。`resume()` 该放在点击回调里，`AudioContext` 也最好全局复用一个。([Chrome for Developers][5])

### 1.3 PWA 会不会拿到更好的音频控制权限

**已确认**：PWA 值得做，但价值主要是“更像 app”，不是“拿到原生豁免”。Apple 最新文档显示，加入主屏的网页在新系统上会以 web app 方式打开，具备全屏、App Switcher 等 app 化体验；Chrome 也明确把“加主屏/安装 PWA”算进 autoplay 资格的一部分。([WebKit][6])

**已确认**：PWA 不是音频护身符。WebKit 曾在 iOS 15.4 修过 standalone web app 后台音频问题，但后续又有公开 bug 指出，standalone PWA 在后台/锁屏时可能出现播放结束后下一首不自动播、`ended` 链路断掉、锁屏 prev/play/next 不响应，且这些问题与普通 Safari 标签页行为并不完全一致。([WebKit Bugzilla][7])

**结论**：PWA 要做，但目标应该是安装感、切回 app 的顺手程度、缓存和入口，而不是指望它替代原生音频栈。

### 1.4 有没有必要做原生 app wrapper

**已确认**：若目标只是“点一下进入语音模式，前台顺畅对话，AirPods 可 play/pause/next/previous，支持 thread 切换”，先不必上原生。若目标是“锁屏后台稳定连续播、Siri/Shortcuts 直接切 thread、系统级媒体控制更稳、后续想接 Action Button/更多硬件能力”，就有必要。原生 app 可以用 `AVAudioSession` 配类别和后台音频模式，这是 Web/PWA 拿不到的那把扳手。([Apple Developer][8])

**推测/工程判断**：在你们现有 Next.js 14 + React 18 的前提下，首选 **Capacitor**。它的定位就是“用 HTML/CSS/JS 构建 iOS/Android/PWA”，并允许写 Swift 插件，把 WebView 直接桥到原生能力。为了这个项目重做 React Native，投入产出比不漂亮。([Capacitor][2])

### 1.5 Web Audio API + `AudioContext.resume()` 的最佳实践

**已确认**：MDN 仍建议尽量复用一个 `AudioContext`，`resume()` 在支持面上没有问题。Chrome 官方也明确把“用户交互后 `resume()`”当成 Web Audio autoplay 时代的标准写法。([MDN Web Docs][9])

**已确认**：在 iOS 上，**真正负责播语音** 的主路径最好用 `<audio>` 元素，不要只靠 Web Audio。WebKit 的公开讨论里直接写到，iOS 把 Web Audio 视作 “ambient” audio，app 不在前台时系统会拦；这对你们这种锁屏耳机听回复的场景很关键。([WebKit Bugzilla][7])

**已确认**：Safari 从 16.4 开始加入了 Audio Session Web API 的一部分支持，MDN 也把它标成实验性 API。对“边播边录”场景，可以 feature detect 后在支持的平台上尝试 `navigator.audioSession.type = 'play-and-record'`，纯播放时用 `playback`。这不是跨浏览器银弹，但在 Safari 侧值得上。([Apple Developer][10])

### 1.6 多条语音消息的播放队列怎么管

**工程建议**：队列一定要**串行**，而且必须有优先级和打断策略。我的建议是三档优先级：系统/紧急提示 > 当前活跃 thread 的新回复 > 历史 backlog。打断策略分两种：用户一开口就 **hard interrupt** 当前 TTS；高优先级系统提示只做 ducking 或 pause。不要让多只猫叠声，那会像三只吸尘器抢一根电源线。

**已确认 + 工程建议**：在 iOS PWA 里，最危险的做法是把一条回复切成很多小 mp3，再靠每个 `ended` 事件串下一段。公开 bug 已经说明，这条链在后台/锁屏的 standalone PWA 里会断。更稳的做法是把“一次回复”尽量做成一个逻辑播放单元，或者至少在单一播放器/单一流上连续输出。([WebKit Bugzilla][11])

---

## 2. AirPods 与 Web 应用的交互能力

### 2.1 AirPods Pro 的单击/双击/长按，JS 能直接抓吗

**已确认**：Apple 对 AirPods Pro 定义的是系统级媒体动作。单击/双击/三击分别对应播放暂停、下一首、上一首；长按则通常是降噪/通透/自适应音频或 Siri。Web 标准暴露给网页的是 **Media Session actions** 这一层，不是“左耳第几次捏压”的原始事件流。我没有找到任何官方 Web API 能让 JS 直接读到 AirPods 的原始手势。([苹果支持][12])

**结论**：
想在浏览器/PWA 里把“左耳长按”自定义成“切到宪宪 thread”，这条路目前基本不可行。

### 2.2 Media Session 能不能把 AirPods 事件映射成自定义行为

**已确认**：可以映射一部分。Media Session 允许网页处理 `play`、`pause`、`nexttrack`、`previoustrack`、`seekbackward`、`seekforward` 等系统媒体动作，MDN 也明确写了，这些动作可来自设备物理控制或屏幕上的媒体控件。([MDN Web Docs][13])

**工程建议**：你们可以做一个“模式化映射”。

* 在“播报模式”里：`nexttrack` = 跳过当前回复，`previoustrack` = 重播上一条。
* 在“thread 浏览模式”里：`nexttrack` = 下一个 thread，`previoustrack` = 上一个 thread。
* `play/pause` 永远只做当前回复的暂停/继续。

**风险**：在 iOS standalone PWA 背景场景下，Media Session 控件在播放结束后可能失灵，所以这个映射在纯 PWA 里不能当 100% 可靠。([WebKit Bugzilla][11])

### 2.3 iOS Shortcuts 能不能触发 Web App 的特定操作

**已确认**：可以，分两层。第一层是“间接触发”，Shortcuts 可以用 URL scheme 运行快捷指令、打开 URL、或者用 “Get Contents of URL” 直接打一个 HTTP 接口。第二层是“网页上下文内执行 JS”，Shortcuts 也有 “Run JavaScript on Webpage”，但它依赖网页上下文，不等于后台全局控制。([苹果支持][14])

**已确认**：要做到 Siri 说一句“切到宪宪”就直接进 app 并执行动作，正统路线是 **App Intents / App Shortcuts**。Apple 官方把它们和 Siri、Spotlight、Shortcuts、Action Button 绑定在一起，这已经超出纯 Web 能力范围。([Apple Developer][15])

**工程建议**：纯 web 先做两个东西就够用。

1. 深链接到特定 thread。
2. 一个可被 Shortcut 调的轻量 HTTP endpoint，例如 `/api/voice-mode/switch-thread?name=xianxian`。
   你们已经有 Cloudflare Tunnel，这招很顺手。

### 2.4 有没有开源项目做过类似 “AirPods + Web App”

**已确认**：我没有找到“AirPods 原始手势 + Web App 自定义控制”的成熟开源样例。最接近的是：

* GoogleChrome 的 **Media Session Samples**，演示播放队列和系统媒体控制接入。
* LiveKit Agents、RealtimeVoiceChat 这类开源实时语音 agent 项目，演示 VAD + STT + TTS + 实时对话管线。
* AirPods 相关开源，如 LibrePods、MagicPodsCore，更像系统级/原生层的耳机能力工程，而不是浏览器 JS。这个空白本身就说明，深度 AirPods 控制通常发生在浏览器沙盒外。([googlechrome.github.io][16])

### 2.5 浏览器抓不到 AirPods 事件时，有哪些替代方案

**推荐顺序**：

1. **Media Session** 做 play/pause/next/previous。
2. **语音命令** 做 thread 切换，比如“切到宪宪”“下一只猫”“回到刚才”。
3. **Shortcuts + deep link / HTTP endpoint**。
4. **Capacitor native shell + App Intents / App Shortcuts**。
5. 真要更极端，再考虑 **音量键** 这种 native-only 备胎，Capacitor 社区已经有监听音量键和媒体控制的插件，但插件成熟度与系统 UI 干扰要单独验收。([GitHub][17])

---

## 3. Typeless 和 STT 优化方案

### 3.1 typeless 是什么，原理、定价、API

**已确认**：Typeless 是一个跨 macOS / Windows / iOS / Android / Web 的 AI 语音键盘/听写产品。公开功能包括去口癖、去重复、说到一半改口的自动清理、自动格式化、个人词典、100+ 语言、混语输入、按 app 调整语气、边说边翻译。价格是 Free 每周 4,000 词，Pro 为 $12/人/月按年付，或 $30 月付。数据控制页写明它走云端处理以换取高精度和低延迟，同时标称零保留、不拿用户数据训练。([Typeless.com][3])

**推测/工程判断**：从公开功能反推，Typeless 不是“纯 ASR”，更像级联管线：**流式 ASR → 去赘词/去重复 → 格式化与风格编辑 → 个人词典/上下文约束 → 可选翻译/编辑动作**。也就是说，它最有价值的不是某个 STT 模型名，而是“先识别，再后修，再个性化”的产品架构。([Typeless.com][3])

**推测/工程判断**：我没有找到 Typeless 面向开发者的公开 API 文档或明显的 STT 平台入口，所以目前更适合把它当作**参考产品**，而不是直接依赖的语音后端。([Typeless.com][3])

### 3.2 有没有类似的 “STT + LLM 后处理” 方案

**已确认**：有，而且已经是明确研究方向。HyPoradise 把“ASR 的 N-best 假设 + 外部 LLM 做纠错”做成了公开 benchmark；2025 年还有中文 ASR Error Correction 基准，以及研究表明 LLM 纠错可用于黑盒 ASR 的后处理和域适配。对中英混输，代码切换 ASR 纠错也有专门研究。([arXiv][18])

**推荐结构**：

* 第 1 层：本地/近端 ASR，输出 1-best + 置信度，能拿到 N-best 更好。
* 第 2 层：热词/个人词典/项目词表，至少包含猫名、thread 名、命令词、专有名词。
* 第 3 层：LLM 后修，只做三件事，**纠错、格式化、命令规整**。
* 第 4 层：低置信度词保守处理，必要时回显确认。

**风险**：LLM 后修会带来“改太多”的风险。研究里也反复出现一个主题：N-best、上下文、受约束解码能帮助纠错，但胡改和幻觉要靠约束来压。([repository.cam.ac.uk][19])

### 3.3 本地 STT 模型怎么选

我会把你们的候选拆成四只猫：

**A. Whisper / WhisperKit / whisper.cpp**
**已确认**：这是当前 Apple Silicon 上最稳的生产基线。OpenAI 官方给出的模型规模从 tiny 39M 到 large 1550M，`large-v3-turbo` 为 809M，速度更快但有轻微质量损失；官方 README 也明确写了 `turbo` 更适合英语转写，不适合翻译非英语。`whisper.cpp` 在 Apple Silicon 上支持 Core ML / ANE，官方文档写到可比纯 CPU 快 3 倍以上；其内存占用文档给出的量级约为 tiny 273MB、base 388MB、small 852MB、medium 2.1GB、large 3.9GB。WhisperKit 则直接提供 Apple Silicon on-device 部署、实时流式、词级时间戳、VAD，以及一个兼容 OpenAI Audio API 的本地 server。([Hugging Face][20])

**判断**：
你们要一个今天就能狠狠干活的基线，先上 Whisper 生态最稳。对 Mac 本地服务端来说，WhisperKit Local Server 甚至能省你们不少接线工时。([GitHub][21])

**B. SenseVoice**
**已确认**：SenseVoice 官方声称训练数据超 40 万小时、支持 50+ 语言，并在公开基准上多语识别超过 Whisper；其模型卡还特别提到 **中文和粤语** 上有优势。官方 repo 同时强调它是非自回归结构，延迟很低。([GitHub][22])

**风险**：这些优势大多来自官方自报 benchmark。它很值得做 challenger，但在 Apple Silicon、本地部署、你们特定噪声场景下，仍需要自己跑盲测。

**C. Qwen3-ASR**
**已确认**：这是 2026 年非常值得加入对比的新选手。官方 README 写得很清楚，Qwen3-ASR 有 0.6B / 1.7B 两个型号，支持 52 种语言与方言，支持 offline / streaming unified inference，还强调 1.7B 在开源 ASR 里达到 SOTA 级别并接近强势商用 API。([GitHub][23])

**判断**：
因为你们已经在跑 Qwen3-TTS，这只猫和你们的现有栈血缘最近，很适合一起 benchmark。我的建议不是“二选一”，而是“让它跟 Whisper 和 SenseVoice 同台打擂”。

**D. Qwen2-Audio**
**已确认**：Qwen2-Audio 是大音频语言模型，不只是转写。它主打的是 **Voice Chat** 和 **Audio Analysis**，支持 8+ 语言/方言，总参数量 8.2B。([Qwen][24])

**判断**：
它更像“直接听音频做理解/对话”的大模型，不是最适合你们当第一线低延迟 dictation/STT 前端的工具。拿它做 voice-native agent 很有意思，但拿它替代基础 STT，性价比不如 Whisper / SenseVoice / Qwen3-ASR。

### 3.4 中英混合输入，各模型表现如何

**已确认**：中英 code-switch / code-mix 仍然是 ASR 难题，这不是你家猫耳朵歪，是整个领域都还在补坑。近两年有新的中英代码切换数据集、面向 code-switch 的识别与纠错研究，说明这已经是独立问题，不是“普通中文 ASR 顺便就能解决”的角落需求。([arXiv][25])

**工程建议**：
别只比“普通 WER/CER”，要单独测你们的 **MER/code-switch 指标**，而且语料必须是你们自己的：

* 室内安静
* 户外走路
* 跑步机风噪
* AirPods 麦
* 中文、英文、中英混
* 猫名 / thread 名 / 命令词 / 项目专词

光用通用 benchmark 选模，像在咖啡馆里给登山鞋打分。

### 3.5 Web Speech API 现在能不能用

**已确认**：Web Speech API 里的 `SpeechRecognition` 仍不是 Baseline。MDN 明确标成 “Limited availability”，还写明在一些浏览器里识别是服务器侧完成的，所以不离线；Can I use 也显示 Safari 与 iOS Safari 只是 partial support。([MDN Web Docs][26])

**已确认**：Chrome 139 在 Web Speech API 上加入了 on-device speech recognition，并支持查询语言包可用性、安装语言包，以及 `phrases` 这类上下文 biasing 能力；但这些能力本身也还是实验性，浏览器覆盖面很不均匀。([Chrome for Developers][27])

**结论**：
Web Speech API 很适合做 Chrome 端的快速原型或可选 fast path，**不适合**做你们 iPhone 语音模式的唯一 STT 方案。

### 3.6 streaming vs batch，延迟和准确率怎么 trade

**已确认**：流式 ASR 的核心 tradeoff 一直是“更快地吐 partial”对上“更晚地收口更准”。AWS 的官方文档就直接写，partial stabilization 能降延迟，但会影响准确度；终点检测研究也反复强调，等得越久，截断风险越低，但延迟会更高。Whisper-Streaming 论文给出的长音频平均延迟大约 3.3 秒，也说明“Whisper 能流式”不等于“Whisper 天生超低延迟”。([AWS文档][28])

**推荐**：
做 **hybrid**。

* UI 层显示 streaming partial，给用户“猫已经在听了”的反馈。
* 真正送给 LLM 的文本用 final transcript，再跑一次轻量后修。
* 命令型输入和自由表达分两种模式，前者更保守、更强调命令词准确；后者更允许格式化和润色。

---

## 4. 语音对话模式的 UX 参考

### 4.1 哪些产品做得比较好

**已确认**：

* **ChatGPT Voice**：可中途打断，语音对话和文字 transcript 会留在原聊天里，适合“语音只是同一 thread 的另一种输入输出”。([OpenAI Help Center][29])
* **Gemini Live**：强调自由打断、暂停后回来继续，以及在后台/锁屏里继续 hands-free。它是你们“运动时边走边聊”最接近的商用品类参照。([blog.google][30])
* **Alexa+ / Google Home with Gemini**：强调多轮自然跟进、显式开始对话和持续会话感，适合借它们的“开场提示音 + 对话状态感知”。([Amazon News][31])

### 4.2 PTT / always-on / VAD 各自优缺点

**我的明确建议**：你们当前场景首选 **PTT + VAD hybrid**。

* **PTT**：最适合运动、风噪、隐私和误触成本高的场景。
* **always-on**：魔法感最强，但在 iPhone Web/PWA 上最脆、最耗电、最容易误触发。
* **VAD**：适合进入会话后维持流畅，但前提是先有一个显式“开始听我”的入口。

也就是说，不要一上来就追“始终聆听的全自动小精灵”，先做“按一下开麦，之后靠 VAD 连续对话”的版本，体验会成熟得更快。

### 4.3 用户能接受的延迟大概多少

**已确认**：人类日常对话的 turn-taking 非常快，常见的转接间隔常被报告在 300ms 内，很多研究甚至落在 100 到 300ms；视频交互研究里，100ms 基本不太影响，700ms 就会明显干扰轮换。另一方面，面向语音助手的研究又说明，用户对 AI 的容忍度比真人对话高，一项车载语音研究里 1.5 秒被评为最佳，而超过 5 秒就明显不舒服；2025 年关于 free-form conversation 的研究也指出，4 秒以上会明显伤害体验。([PMC][32])

**工程目标**：

* **TTS 首包出声**：最好 < 1 秒，务实目标 < 1.5 秒，> 4 秒进入红区。
* **用户停口到系统判定 end-of-turn**：尽量压到 250 到 500ms。
* **可见 partial transcript**：越早越好，最好在 500 到 800ms 内开始抖动出字。

这里还要泼一盆现实的冷水：你们的 TTS 现在在家里那台 Mac 上，经 Cloudflare Tunnel 给 iPhone 服务。只要人出门，这条路的 RTT 和抖动就是物理层税单。原生壳能改善控制，不会把广域网变短。

### 4.4 多猫语音对话怎么设计

**工程建议**：

* 一次只让一只猫说话，绝不重叠播报。
* 用固定“声音身份 + 开场耳标”，比如每只猫一个简短 earcon。
* 设一个“主持猫/当前活跃猫”，别让 thread 像三条音轨同时抢耳朵。
* 允许用户随时打断，打断后默认只保留当前 thread 的上下文。
* thread 切换命令要很显式，比如“切到宪宪”“下一只猫”“回到刚才那只”。

多猫语音最怕的不是智能不够，是舞台调度失控。先把说话次序做得像接力棒，再谈群口相声。

---

## 明显不可行 / 不建议现在走的方向

**1. 纯浏览器/PWA 里直接捕获 AirPods 原始手势做任意自定义动作**
基本不可行。Web 看到的是媒体动作，不是 AirPods 原始捏压事件。([苹果支持][12])

**2. 指望 PWA 绕过 iOS/Safari 的有声 autoplay 限制**
不可行。PWA 不是音频豁免证。([WebKit][4])

**3. 在 iOS 语音陪伴模式里只靠 Web Audio 做后台播放**
不建议。WebKit 公开说明过 Web Audio 在 iOS 后台会被当 ambient audio 处理。([WebKit Bugzilla][7])

**4. 把 Web Speech API 当成唯一 STT 方案，尤其是 iPhone Safari**
不建议。覆盖面和行为都不够稳。([MDN Web Docs][26])

**5. 直接做 always-on 持续聆听作为 v1**
不建议。对你们这个运动 + AirPods + Web 的组合来说，它会同时把误触发、耗电、噪声、平台限制四个坑一起点亮。

---

## 我给 Cat Cafe 的总体推荐路线图

### Phase 0：先把基线量出来

先做一套自己的语音测试集，别靠印象派调参。至少 80 到 120 条：

* 中文、英文、中英混
* 猫名、thread 名、命令词、项目专词
* 室内、户外、跑步机、风噪
* AirPods 麦、手机直录
* 短命令、长表达

指标看五个：STT 错误率、首字延迟、首声延迟、barge-in 成功率、后台续播成功率。

### Phase 1：先上 web-first，可上线

我会这么做：

1. 一个很明确的“开始语音陪伴”入口，首击完成音频解锁、麦权限、Media Session 注册。
2. 用 **单一 `<audio>` 播放器 + 单一 `AudioContext`**。
3. Media Session 映射 `play/pause/next/previous`。
4. 播放队列串行化，用户说话即打断 TTS。
5. STT 先跑 **WhisperKit Local Server** 或 **Qwen3-ASR** 做 baseline，再拿 SenseVoice 做 challenger。([GitHub][21])
6. 在 STT 后面接一层 **LLM 轻后修**，只做纠错、格式化、命令规整。
7. 先上 **PTT + VAD hybrid**，不要做 always-on。

**这一阶段的主要风险**：

* iOS PWA 后台和锁屏还有边缘坑。
* 你们的 Mac + Tunnel 架构会引入户外网络延迟。

### Phase 2：把“运动时切换 thread”做顺

1. 做 thread deep link。
2. 做 Shortcuts 调用的 HTTP endpoint。
3. 加固定语音命令：“切到宪宪 / 切到 GPT / 切到 Gemini / 下一只猫 / 继续刚才”。
4. 锁屏显示当前猫的 metadata。

这时用户已经能边走边听、边说边切，但还不是“系统级丝滑”。

### Phase 3：确认需求后，上 Capacitor native shell

1. 用 Capacitor 包住现有前端。
2. 写 Swift 插件桥接 `AVAudioSession`、后台音频、系统媒体控制。
3. 接 **App Intents / App Shortcuts**，拿 Siri / Action Button / Spotlight 入口。
4. 必要时再考虑音量键一类 native-only 触发。([Capacitor][33])

### Phase 4：再考虑更激进的优化

* 把至少一层 STT 移到手机端，削掉 Tunnel RTT。
* 做更强的多猫主持与轮流发言机制。
* 做更细的个人词典和上下文 biasing。

---

## 最终拍板建议

我现在的推荐很直接：

**先别为了这个场景重写 app。先做一个强壮的 web-first 版本：**
**`HTMLAudioElement 主播报 + Media Session + PTT/VAD hybrid + WhisperKit/Qwen3-ASR + LLM 后修 + Shortcut/deeplink`。**

等你们验证“锁屏后台稳定播放”和“AirPods/Shortcuts 切 thread”真的是核心高频，再上 **Capacitor**。
这条路线最像一只会攀爬的猫，先跳到桌上，再跳到柜顶，不会第一步就往天花板扑。

[1]: https://developer.chrome.com/blog/autoplay "https://developer.chrome.com/blog/autoplay"
[2]: https://capacitorjs.com/?utm_source=chatgpt.com "Capacitor by Ionic - Cross-platform apps with web technology"
[3]: https://www.typeless.ai/ "https://www.typeless.ai/"
[4]: https://webkit.org/blog/6784/new-video-policies-for-ios/ "https://webkit.org/blog/6784/new-video-policies-for-ios/"
[5]: https://developer.chrome.com/blog/web-audio-autoplay "https://developer.chrome.com/blog/web-audio-autoplay"
[6]: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ "https://webkit.org/blog/17333/webkit-features-in-safari-26-0/"
[7]: https://bugs.webkit.org/show_bug.cgi?id=198277 "https://bugs.webkit.org/show_bug.cgi?id=198277"
[8]: https://developer.apple.com/library/archive/documentation/Audio/Conceptual/AudioSessionProgrammingGuide/AudioSessionBasics/AudioSessionBasics.html "https://developer.apple.com/library/archive/documentation/Audio/Conceptual/AudioSessionProgrammingGuide/AudioSessionBasics/AudioSessionBasics.html"
[9]: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext "https://developer.mozilla.org/en-US/docs/Web/API/AudioContext"
[10]: https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes?utm_source=chatgpt.com "Safari 16.4 Release Notes"
[11]: https://bugs.webkit.org/show_bug.cgi?id=261858 "https://bugs.webkit.org/show_bug.cgi?id=261858"
[12]: https://support.apple.com/guide/airpods/use-controls-and-gestures-with-your-airpods-devb2c431317/web "https://support.apple.com/guide/airpods/use-controls-and-gestures-with-your-airpods-devb2c431317/web"
[13]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler "https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler"
[14]: https://support.apple.com/guide/shortcuts/open-create-and-run-a-shortcut-apda283236d7/ios "https://support.apple.com/guide/shortcuts/open-create-and-run-a-shortcut-apda283236d7/ios"
[15]: https://developer.apple.com/documentation/appintents/app-shortcuts "https://developer.apple.com/documentation/appintents/app-shortcuts"
[16]: https://googlechrome.github.io/samples/media-session/ "https://googlechrome.github.io/samples/media-session/"
[17]: https://github.com/capacitor-community/volume-buttons "https://github.com/capacitor-community/volume-buttons"
[18]: https://arxiv.org/abs/2309.15701 "https://arxiv.org/abs/2309.15701"
[19]: https://www.repository.cam.ac.uk/bitstreams/55e62442-b4f4-4212-bbd1-a6e24d427dc1/download "https://www.repository.cam.ac.uk/bitstreams/55e62442-b4f4-4212-bbd1-a6e24d427dc1/download"
[20]: https://huggingface.co/openai/whisper-large-v3-turbo "https://huggingface.co/openai/whisper-large-v3-turbo"
[21]: https://github.com/argmaxinc/WhisperKit "https://github.com/argmaxinc/WhisperKit"
[22]: https://github.com/FunAudioLLM/SenseVoice "https://github.com/FunAudioLLM/SenseVoice"
[23]: https://github.com/QwenLM/Qwen3-ASR "https://github.com/QwenLM/Qwen3-ASR"
[24]: https://qwenlm.github.io/blog/qwen2-audio/ "https://qwenlm.github.io/blog/qwen2-audio/"
[25]: https://arxiv.org/pdf/2502.18913 "https://arxiv.org/pdf/2502.18913"
[26]: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition "https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition"
[27]: https://developer.chrome.com/blog/new-in-chrome-139 "https://developer.chrome.com/blog/new-in-chrome-139"
[28]: https://docs.aws.amazon.com/transcribe/latest/dg/streaming-partial-results.html "https://docs.aws.amazon.com/transcribe/latest/dg/streaming-partial-results.html"
[29]: https://help.openai.com/en/articles/8400625-voice-mode-faq "https://help.openai.com/en/articles/8400625-voice-mode-faq"
[30]: https://blog.google/products-and-platforms/products/gemini/made-by-google-gemini-ai-updates/ "https://blog.google/products-and-platforms/products/gemini/made-by-google-gemini-ai-updates/"
[31]: https://www.aboutamazon.com/news/devices/new-alexa-generative-artificial-intelligence "https://www.aboutamazon.com/news/devices/new-alexa-generative-artificial-intelligence"
[32]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10077995/ "https://pmc.ncbi.nlm.nih.gov/articles/PMC10077995/"
[33]: https://capacitorjs.com/docs/ios/custom-code?utm_source=chatgpt.com "Custom Native iOS Code"

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 布偶猫综合 GPT Pro 回答 + 本地 codebase 验证后撰写。

[待撰写]
