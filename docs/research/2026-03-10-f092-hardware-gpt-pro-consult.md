---
feature_ids: [F092]
topics: [voice, companion, hardware, DJI-Mic, bone-conduction, Apple-Watch, wearables]
doc_kind: research
created: 2026-03-10
---

# F092 硬件调研 — GPT Pro 咨询（Round 2）

> 委托人：布偶猫/宪宪 (Opus 4.6)  日期：2026-03-10

## Part 1: 发给 GPT Pro 的提示词

见 `docs/prompts/2026-03-10-f092-hardware-followup-prompt.md`

八大调研问题：
1. DJI Mic 2 作为高质量拾音器 → Mac 系统音频输入
2. 骨传导麦克风方案（环境噪音抑制）
3. 喉部振动麦克风（专业级噪音场景）
4. Apple Watch 作为语音交互控制器
5. 智能戒指（Oura Ring 等）可编程交互
6. 蓝牙遥控器/快捷键设备
7. 三档预算硬件组合方案（入门/进阶/旗舰）
8. 固定场景设备（房间麦克风阵列等）

## Part 2: GPT Pro 回答（铲屎官回填区）

这次从硬件角度看，结论比软件层更直球一些：

**别先骂 STT，先换耳朵。**
在你们这个“iPhone + AirPods + Web App + 运动”场景里，拾音链路大概率比换模型更影响最终识别。iOS 26 已经支持对**特定 app 或网站**单独选择输入设备，Apple 在 WWDC25 也确认了新的输入选择能力；同时 iPhone 早就能把 iPhone 麦克风的声音送到 AirPods，说明系统层确实存在输入/输出分离的路由能力。**但**我没有找到 Apple 或 DJI 对“DJI 接收器作为 Safari/PWA 输入，同时 AirPods 继续作为输出”的端到端官方保证，所以这条链路应视为**已确认系统能力存在，具体组合高概率可行，但首日必须实测**。([苹果支持][1])

我先给一句拍板版：**如果明天只买一件，我会先买 DJI Mic Mini；如果再多买一件，我会加 Flic Button；如果想把“切 thread”也做顺，第三件买 Apple Watch SE 3。** DJI Mic Mini 的价格门槛最低，iPhone 适配路径最清楚；Flic 是最轻的物理控制入口；Apple Watch 则是最像“未来可进化成正式控制器”的方案。([DJI 商店][2])

## 1. 拾音硬件

### 先回答最关键的问题：DJI Mic / 其他无线麦，能不能“麦克风输入 A + AirPods 输出 B”？

* **已确认**：iOS 26 支持你对一个**具体 app 或网站**选择输入源。Apple 的 iPhone 用户指南写得很明确，打开 app 或网站后，可以从控制中心进入该 app/browser 的控制项，然后点 `Input` 选择输入设备。WWDC25 也明确说了 iOS/iPadOS 26 新增 input picker，并且系统会记住你为 app 选过的输入设备。([苹果支持][1])
* **已确认**：DJI Mic 2 和 DJI Mic Mini 都官方支持连 iPhone。Mic 2 支持手机适配器，Mic Mini 支持 Type-C/Lightning 适配器，也支持直连蓝牙到手机。([DJI Official][3])
* **推测，高概率**：把 **DJI 接收器插到 iPhone 作为输入**，同时让 **AirPods 继续做系统输出**，在 Safari/PWA 里大概率能走通。原因是 iOS 26 已有 per-app/per-website input picker，而系统层也已有输入输出分离的例子，比如 Live Listen 会把 iPhone 麦克风声音送到 AirPods。**但**这不是 Apple 官方明写的“Safari + 外置接收器 + AirPods”认证组合，所以我会把它列为**首购后 10 分钟内就要验证的 day-1 test**。([苹果支持][1])

### 我的便携拾音排序

* **DJI Mic Mini**
  **推荐级别：最高。**
  1 发 1 收官方价 **$59**，2 发 1 收带盒 **$99**，Lightning 套装分别到 **$78 / $118**；渠道有 **DJI Store、Best Buy、Dell、Samy’s**。它的卖点是体积极小、两档主动降噪、自动限幅防爆音、带盒续航最长 48 小时。对你们这种“运动时轻声说话 + 风噪 + Web App”场景，它是**最便宜、最像正确答案**的第一跳。**iOS / Web 对接难度：低到中。** 优先用**接收器直插手机**，不要把“直连蓝牙模式”当主方案。([DJI 商店][2])
* **DJI Mic 2**
  **推荐级别：高。**
  1 发 1 收官方价 **$129**，2 发 1 收带盒 **$199**；渠道主要是 **DJI Store、Best Buy**。它比 Mic Mini 更像“专业备份型”选择，带 **32-bit float 内录**、14 小时内部录音、智能降噪。你们如果想要“即使 Web 端哪天抽风，我也有本地备份音轨”，Mic 2 更香。**iOS / Web 对接难度：低到中。** 同样建议用**接收器模式**。因为 DJI 官方明确写了，**Mic 2 直连手机蓝牙时，智能降噪和内部录音不能用**。([DJI 商店][4])
* **Hollyland LARK M2 / M2S**
  **推荐级别：中高。**
  LARK M2 现在常见在 **$76 到 $88**，M2S 约 **$109 到 $119**；渠道有 **Hollyland Store、Best Buy、B&H、Walmart**。M2 的优势是便宜、轻、续航长；M2S 的优势是更隐蔽、夹持更适合运动场景，官方和零售页都强调它的轻量、降噪和兼容性。**iOS / Web 对接难度：低到中。** 如果你们跑步或骑车时经常担心麦夹不稳，M2S 比普通 M2 更值得看。([Hollyland Store][5])
* **RØDE Wireless ME**
  **推荐级别：中高。**
  Apple 官方商店价 **$149.95**。它的优势不是最便宜，而是“通吃相机、电脑、手机”的通用性很强，且接收器本身也带麦，GainAssist 对非专业用户很友好。**iOS / Web 对接难度：低到中。** 如果你们希望一套设备兼顾 iPhone、Mac、本地录音和以后拍视频，Wireless ME 很稳。([Apple][6])
* **RØDE Wireless Micro**
  **推荐级别：中。**
  零售价常见 **$99**，渠道有 **Apple、B&H、Best Buy**。它很适合“iPhone 拍视频”这类场景，但你们要注意一个大坑：RØDE 官方写得很直白，**Direct Connect 蓝牙功能只支持 RØDE Capture，不支持第三方 app**。也就是说，它做“Web App 通用麦克风”的稳定性和自由度，不如“接收器插手机”的方案。**iOS / Web 对接难度：中。** 买它就按**接收器模式**用，不要把 Direct Connect 当通用方案。([Apple][7])

### 骨传导麦克风 / 喉麦，这条路值不值？

* **Shokz OpenComm2 / OpenComm2 UC**
  **已确认**：这两款是开放式骨传导耳机，带 **DSP 降噪 boom mic**，官方价分别约 **$159.95 / $199.95**。它们适合“开放耳道 + 比普通耳机通话更稳”的工作或运动场景。**但它们更像 AirPods 的替代耳机，不是给 AirPods 加一只神奇骨传导麦克风。** 如果你们愿意放弃 AirPods 作为输出，OpenComm2 是可以试的；如果你们就是要“AirPods 出声 + 外部更强拾音”，它不是最优路径。**iOS / Web 对接难度：中。**([Shokz][8])
* **真正的骨传导麦克风 / 喉麦**
  **已确认**：这类产品真实存在，但主战场更接近**军警、战术、极端噪声通信**。比如 INVISIO X5 明写是骨传导麦克风，IASUS BMT 是 **$199** 的蓝牙喉麦，EarHugger 也有面向 iPhone 的喉麦，最低看到 **$56**。**推测 / 工程判断**：它们只有在“噪声极端、且你能接受舒适度与语音自然度妥协”的情况下才值得上。对你们这种日常运动语音陪伴，我**不建议把喉麦当第一轮升级**。**iOS / Web 对接难度：高。**([invisio.com][9])

**一句话总结拾音层**：
你们真正该优先买的不是“神秘骨传导黑科技”，而是**标准的无线领夹麦 + iPhone 接收器**。这条路设备成熟、对 iPhone 友好、对 Web 也最容易借系统音频栈上车。([苹果支持][1])

## 2. 可穿戴 / 控制入口

### Apple Watch

* **已确认**：Apple Watch 可以直接从 **Shortcuts app** 或表盘 complication 运行快捷指令；Shortcuts 还能发 **GET / POST / PUT / PATCH** 这类 HTTP 请求。所以对你们来说，最务实的 v1 是：**手表 complication -> Shortcut -> 打你们的 `/api/voice-mode/*` endpoint**。**iOS / Web 对接难度：中。**([苹果支持][10])
* **已确认**：如果你们以后愿意做 **原生 watchOS app**，表冠是能拿来做 thread 切换的。Apple 的 `digitalCrownRotation` 就是干这个的。**但这只存在于原生 Watch App，不是 Shortcut。** 所以“旋转表冠切 thread”这件事，**可行，但属于原生手表开发项**。([Apple Developer][11])
* **已确认**：Apple Watch 的 **Double Tap** 只能做常见动作，媒体场景下主要是 **Play/Pause 或 Skip**，不是任意自定义。好消息是 **AssistiveTouch** 可以把手势映射到 **Siri shortcut**。所以你们可以先用 Shortcut 路线，再决定要不要上原生 Watch App。Apple Watch SE 3 **$249 起**，Ultra 3 **$799 起**。([苹果支持][12])

### 蓝牙按钮 / 极简控制器

* **Flic Button**
  这是我最喜欢的“共犯按钮”。官方单个 **$35**，蓝牙连手机/电脑，支持 **单击、双击、长按**。Flic 自家 App 页面和 App Store 描述都明确写了这些触发方式，而且它本身就是“用一个按钮触发各种动作”的产品。**iOS / Web 对接难度：低到中。** 最稳妥的玩法不是折腾奇怪黑魔法，而是让 Flic 触发一个 URL 或 Shortcut，再去打你们的 Web endpoint。([Flic Smart Button][13])
* **Satechi R2 / 泛蓝牙快门类遥控器**
  Satechi R2 官方价 **$44.99**，明确支持媒体控制、app 控制、演示控制和 Siri。它适合当“通用媒体遥控器”，但不如 Flic 那么像“为自定义动作而生”。如果你们只是想要**上一条/下一条/播放暂停**，这类遥控器够了；如果你们要“开麦、切宪宪、切回上一只猫”，Flic 更好。iPhone 也支持外接键盘控制，所以把自己伪装成键盘的遥控器理论上能做一些系统级控制，但网页级自定义通常还是不如 Shortcut/HTTP 直打来得稳。([Satechi][14])

### 智能戒指 / AI 硬件

* **Oura / RingConn**
  **不推荐为了控制而买。** Oura Ring 4 现在是 **$349 起**，RingConn Gen 2 是 **$299 起**，Gen 2 Air 是 **$199**。它们今天的官方卖点仍然是健康/睡眠/活动追踪，不是可编程手势控制。Oura 最近确实刚收购了 Doublepoint，这说明“未来可能会走向手势交互”，但**现在不是现在**。([Oura Ring][15])
* **Sandbar Stream Ring**
  这玩意是个值得盯着的未来项目。官方现在是 **预购 $249，MSRP $299**；TechCrunch 的报道提到它有触摸面板、媒体控制和 AI 助手，但它仍然是自家生态里的早期产品，不是一个成熟的通用 Web 控制器。**结论：看着很酷，今天不当主力。**([sandbar.com][16])
* **Humane AI Pin / Rabbit r1**
  Humane AI Pin 已经停卖且设备已停止工作，**不要买**。rabbit r1 倒有一个你们该抄的点：它把 **侧边 PTT 按钮**当成主交互入口。借鉴的是交互模式，不是硬件本体。([TechCrunch][17])

### 家里健身房的触觉控制面板

* **Elgato Stream Deck 家族**
  这类设备很适合**家里健身房**，不适合出门。Stream Deck Neo 常见 **$69.99 到 $99.99**，Mark 2 **$149.99**，Pedal **$89.99**。Pedal 特别适合跑步机/单车，因为它是真正的脚下控制。**iOS / Web 对接难度：低到中。** 最舒服的接法不是让它直接去碰 iPhone，而是**接到你们那台本地 Mac**，由 Mac 直接调用你们的本地 Next/Web API。([Elgato][18])
* **Stream Deck Mobile**
  如果你不想先买实体设备，Stream Deck Mobile 在 iPhone / iPad 上就能跑，免费层有 **6 个键**，但它需要电脑端 Stream Deck 一起配合。它还支持 Siri Shortcuts。**结论：家里固定空间可用，户外不如实体按钮或手表。**([App Store][19])

## 3. 我给你的 3 档组合方案

### 经济版，约 $100

* **输入**：DJI Mic Mini **1 TX + 1 RX**，USB-C 版 **$59**；如果是 iPhone 14 及更早 Lightning 机型，买 **$78 的 Lightning 套装**。
* **输出**：继续用现有 **AirPods Pro**。
* **控制**：**Flic Button $35**。
* **Web 对接**：iOS 26 里给浏览器/网站选 Mic Mini 作为输入，AirPods 继续做输出；Flic 触发 Shortcut 或 URL，去打你们的 thread 切换 / 开麦 endpoint。
* **我的评价**：这是“最小投入，最大改善”的真香版。USB-C iPhone 总价大约 **$94**，Lightning iPhone 大约 **$113**。如果预算死卡 $100 且是 Lightning 机型，就先买 Mic Mini，不买按钮。([DJI 商店][2])

### 进阶版，约 $300

* **输入**：DJI Mic Mini **1 TX + 1 RX**。
* **输出**：AirPods Pro。
* **控制**：**Apple Watch SE 3，$249 起**。
* **Web 对接**：手表 complication 触发 Shortcut，Shortcut 发送 GET/POST 到你们本地 Web API；后续如果愿意写原生 watchOS app，再把表冠用来切 thread。
* **我的评价**：这档的提升不是“收音更猛”，而是**控制终于像个产品了**。Mic Mini + Watch SE 3 大概 **$308**，已经很接近“运动中半免手”的体验。([Apple][20])

### 旗舰版，约 $500+

* **输入（移动）**：DJI Mic 2 **2 TX + 1 RX + 充电盒，$199**。
* **输出**：AirPods Pro。
* **控制（移动）**：Apple Watch SE 3；如果你真的想冲，换 **Ultra 3**。
* **输入（家里健身房）**：**ReSpeaker 4-mic USB Array，$69**，直接插你们本地 Mac。
* **Web 对接**：出门时走“DJI 接收器 + AirPods + Watch Shortcut”；在家时直接让 Mac 从 ReSpeaker 吃音频，本地 STT 和本地 Web 不再受 iPhone 路由牵制。
* **我的评价**：这套很像双引擎猫车。移动场景稳，家里场景更稳。Mic 2 combo + Watch SE 3 + ReSpeaker 大约 **$517**。如果把 Watch 升到 Ultra 3，会一路冲到豪华包厢。([DJI 商店][4])

## 4. 健身室固定设备，值不值得搞？

* **最值得的固定拾音**：**ReSpeaker USB Mic Array**
  Seeed 的 4 麦阵列大约 **$69**，官方写到**最远约 5 米拾音**，带波束成形、AEC、AGC、降噪。它的美妙之处在于：**直接插你们本地 Mac**，绕过 iPhone 的移动音频路由麻烦。对于“家里固定健身室”这事，它反而可能比给 iPhone 上更贵的外设更舒服。**Web 对接难度：低。**([seeedstudio.com][21])
* **更像认真做房间语音节点的**：**miniDSP UMA-8-SP**
  这是更像“小型语音中控脑”的东西，官方说它有波束成形、AEC、降噪、去混响，且对 Mac 是 driverless；miniDSP 当年给的 MSRP 是 **$125**。如果你们真想把健身室做成“猫猫语音站”，这比堆更多 iPhone 配件更工程化。**Web 对接难度：低到中。**([minidsp.com][22])
* **一体式房间设备**：**Insta360 Wave / AnkerWork PowerConf S500 / Jabra Speak2 75**
  Insta360 Wave 约 **$299.99**，有 **8 个 MEMS 麦克风**、定向拾音，零售页写到可在约 **16 英尺**距离内工作；PowerConf S500 **$219.99 起**，有 VoiceRadar、4 个 MEMS 麦、USB-C/Bluetooth/ dongle；Jabra Speak2 75 则是更贵的商务级方案，4 个 beamforming mic，零售价常见 **$435.26**。这类设备适合“家里一个固定点，既收音又播音，还想要实体按键/灯条反馈”。**Web 对接难度：低到中。**([insta360.com][23])
* **HomePod 作为中继**
  它更适合当**语音触发器**，不适合当你们 Web App 的直接麦克风前端。Apple 明确说 Siri 可以在 HomePod/Apple Watch 上运行 shortcuts，但**需要打开 app 的 shortcut 在 HomePod 和 Apple Watch 上可能不工作**。所以我的建议是：让 HomePod 只负责“开始猫猫模式”“切到宪宪”这类 Siri 口令，再去打你们的 HTTP endpoint，不要让它承担实时 STT 前端。([苹果支持][24])

## 我的最终推荐

如果铲屎官**明天就要买**，我会这样下单：

1. **DJI Mic Mini (1 TX + 1 RX)**
   USB-C iPhone 直接买 **$59** 套装；Lightning iPhone 买 **$78** 套装。渠道优先 **DJI Store / Best Buy**。这是当前最稳的第一笔钱。([DJI 商店][2])
2. **Flic Button 单个装，$35**
   渠道 **Flic 官方**。它是你们最快拿到“物理开麦 / 切换动作”的方式。([Flic Smart Button][13])
3. **Apple Watch SE 3，$249 起**
   渠道 **Apple Store**。这是“先用 Shortcut，后做原生 app”的最好控制器。([Apple][20])
4. **家里健身室加一个 ReSpeaker USB Mic Array，$69**
   渠道 **Seeed Studio**。这是最划算的固定空间升级。([seeedstudio.com][21])
5. **如果预算再往上走，把 Mic Mini 升成 DJI Mic 2**
   你会得到更好的备份与容错。([DJI 商店][4])

**不建议明天买的**也给你一句狠话版：

* **不要为了控制买 Oura / RingConn**。今天它们还是健康环，不是控制环。([Oura Ring][15])
* **不要买 Humane AI Pin**。它已经谢幕。([TechCrunch][17])
* **不要把喉麦当第一升级**。它更像战术装备，不像日常陪伴硬件。([IASUS Concepts][25])

如果你愿意，我下一轮可以直接给你出一份 **“首购后 30 分钟验收 checklist”**，把“DJI Mic + AirPods + Safari/PWA + Flic/Watch”这条链路怎么一步一步验出来写成测试单。

[1]: https://support.apple.com/guide/iphone/record-audio-and-video-iph8dc8a5c3c/ios "https://support.apple.com/guide/iphone/record-audio-and-video-iph8dc8a5c3c/ios"
[2]: https://store.dji.com/product/dji-mic-mini "https://store.dji.com/product/dji-mic-mini"
[3]: https://www.dji.com/mic-2/faq "https://www.dji.com/mic-2/faq"
[4]: https://store.dji.com/product/dji-mic-2-tx-rx "https://store.dji.com/product/dji-mic-2-tx-rx"
[5]: https://store.hollyland.com/products/lark-m2s?srsltid=AfmBOoqs0trIXIUt0aQouyiVvjjcFhm2b_dOI1xdVt9oRlJbbVfaycdH "https://store.hollyland.com/products/lark-m2s?srsltid=AfmBOoqs0trIXIUt0aQouyiVvjjcFhm2b_dOI1xdVt9oRlJbbVfaycdH"
[6]: https://www.apple.com/shop/product/hr2e2zm/a/r%C3%B8de-wireless-me-microphone "https://www.apple.com/shop/product/hr2e2zm/a/r%C3%B8de-wireless-me-microphone"
[7]: https://www.apple.com/shop/product/hs4c2zm/a/r%C3%B8de-wireless-micro "https://www.apple.com/shop/product/hs4c2zm/a/r%C3%B8de-wireless-micro"
[8]: https://shokz.com/products/opencomm2-2025-upgrade "https://shokz.com/products/opencomm2-2025-upgrade"
[9]: https://invisio.com/products/headsets/invisio-x5/ "https://invisio.com/products/headsets/invisio-x5/"
[10]: https://support.apple.com/kk-kz/guide/shortcuts/apd5888b0858/9.0/ios/26 "https://support.apple.com/kk-kz/guide/shortcuts/apd5888b0858/9.0/ios/26"
[11]: https://developer.apple.com/documentation/swiftui/view/digitalcrownrotation%28_%3A%29 "https://developer.apple.com/documentation/swiftui/view/digitalcrownrotation%28_%3A%29"
[12]: https://support.apple.com/guide/watch/use-double-tap-for-common-actions-apdabb7b275c/watchos "https://support.apple.com/guide/watch/use-double-tap-for-common-actions-apdabb7b275c/watchos"
[13]: https://flic.io/shop/flic-2-single-pack "https://flic.io/shop/flic-2-single-pack"
[14]: https://satechi.com/products/r2-bluetooth-multimedia-remote-control?srsltid=AfmBOoraKYUiJ34PYGhHEHm6mbHBKgUI0Jr0ABB938oe-vEHBfbtQgQ1 "https://satechi.com/products/r2-bluetooth-multimedia-remote-control?srsltid=AfmBOoraKYUiJ34PYGhHEHm6mbHBKgUI0Jr0ABB938oe-vEHBfbtQgQ1"
[15]: https://ouraring.com/store?srsltid=AfmBOoonn9A4YMc194ZLUoliJhno3tqkgabKj-kSLgvp2isrxbalFPhE "https://ouraring.com/store?srsltid=AfmBOoonn9A4YMc194ZLUoliJhno3tqkgabKj-kSLgvp2isrxbalFPhE"
[16]: https://www.sandbar.com/stream "https://www.sandbar.com/stream"
[17]: https://techcrunch.com/2025/02/18/humanes-ai-pin-is-dead-as-hp-buys-startups-assets-for-116m/ "https://techcrunch.com/2025/02/18/humanes-ai-pin-is-dead-as-hp-buys-startups-assets-for-116m/"
[18]: https://www.elgato.com/us/en/p/stream-deck-pedal?srsltid=AfmBOors1De2AbARoTtnOofmsUOkc2uSmmDhIPZ3qNOSuFgoYRzS_m7Q "https://www.elgato.com/us/en/p/stream-deck-pedal?srsltid=AfmBOors1De2AbARoTtnOofmsUOkc2uSmmDhIPZ3qNOSuFgoYRzS_m7Q"
[19]: https://apps.apple.com/us/app/elgato-stream-deck-mobile/id1440014184 "https://apps.apple.com/us/app/elgato-stream-deck-mobile/id1440014184"
[20]: https://www.apple.com/shop/buy-watch/apple-watch-se "https://www.apple.com/shop/buy-watch/apple-watch-se"
[21]: https://www.seeedstudio.com/ReSpeaker-USB-Mic-Array-p-4247.html?srsltid=AfmBOoqqFjAynO8bhbLHUv8aiu2S2IDqvduPKnNPU1Qexda1PcAKKSeP "https://www.seeedstudio.com/ReSpeaker-USB-Mic-Array-p-4247.html?srsltid=AfmBOoqqFjAynO8bhbLHUv8aiu2S2IDqvduPKnNPU1Qexda1PcAKKSeP"
[22]: https://www.minidsp.com/products/usb-audio-interface/uma-8-sp-detail?srsltid=AfmBOormENwTtis8-InY4JEt9QUXGbEvt8pSPCXkamTNovSuSOwTH6C7 "https://www.minidsp.com/products/usb-audio-interface/uma-8-sp-detail?srsltid=AfmBOormENwTtis8-InY4JEt9QUXGbEvt8pSPCXkamTNovSuSOwTH6C7"
[23]: https://www.insta360.com/product/insta360-wave "https://www.insta360.com/product/insta360-wave"
[24]: https://support.apple.com/guide/shortcuts-mac/run-shortcuts-with-siri-apd07c25bb38/mac "https://support.apple.com/guide/shortcuts-mac/run-shortcuts-with-siri-apd07c25bb38/mac"
[25]: https://iasus-concepts.com/product/bmt-throat-mic/ "https://iasus-concepts.com/product/bmt-throat-mic/"



## Part 3: 布偶猫综合整理

> 整理人：布偶猫/宪宪 (Opus 4.6)  日期：2026-03-10

### 一、改变认知的核心洞察

**"别先骂 STT，先换耳朵。"**

GPT Pro 这句话直接改变了我们的优化顺序。之前我们（包括软件调研 Round 1）一直在想"换哪个 ASR 模型更准"，但硬件调研揭示了一个更根本的问题：**AirPods 麦克风在运动场景下拾音质量差**，再好的 ASR 也救不了垃圾音频输入。

正确的优化链路：
```
拾音硬件升级（最大收益）→ ASR 模型升级 → LLM 后修（已做）→ 术语词典（已有）
```

### 二、软件+硬件两轮调研汇总

| 层 | Round 1 (软件) 发现 | Round 2 (硬件) 发现 | 综合结论 |
|----|--------------------|--------------------|----------|
| **拾音** | 未涉及 | DJI Mic Mini 首选（$59） | **最高优先级升级** |
| **ASR** | Whisper→Qwen3-ASR | 拾音质量比模型更重要 | 先换耳朵，再换模型 |
| **LLM 后修** | Qwen3-4B 本地后修 | — | ✅ 已完成 |
| **术语词典** | 已有 voice-terms.json | — | ✅ 已有 |
| **自动播放** | Web-first 70% → Capacitor 95% | — | 分阶段推进 |
| **AirPods 控制** | Media Session API 有限 | Watch/Flic 更可靠 | 物理设备 > 软件 hack |
| **Thread 切换** | 语音指令可行 | Watch complication + Shortcut | HTTP endpoint + Shortcut |
| **控制入口** | 未涉及 | Flic($35)/Watch SE3($249) | 物理按钮是最快方案 |
| **固定场景** | 未涉及 | ReSpeaker USB Array($69) | 家里直插 Mac，绕过 iPhone |

### 三、修正后的 F092 实施优先级

```
P0（本周）: L3 LLM 后修 ✅ 已完成
P1（下一步）: 铲屎官购入 DJI Mic Mini + Flic Button（~$94）
P2（拿到硬件后）: Day-1 验证 — DJI 输入 + AirPods 输出 + Safari/PWA
P3（软件配套）: Qwen3-ASR 替换 Whisper + voice mode endpoint
P4（控制层）: Flic→Shortcut→HTTP endpoint 链路
P5（进阶）: Apple Watch SE 3 + 原生控制
P6（家里）: ReSpeaker USB Array 直插 Mac
P7（终极）: Qwen3-Omni 三合一替代三件套
```

### 四、GPT Pro 推荐购物清单 vs 我们的判断

| 设备 | GPT Pro 推荐 | 布偶猫评价 | 建议 |
|------|-------------|-----------|------|
| **DJI Mic Mini** | 🌟 最高推荐（$59） | 完全同意，最小投入最大收益 | **立刻买** |
| **Flic Button** | 🌟 高推荐（$35） | 同意，"共犯按钮"这个比喻太精准 | **立刻买** |
| **Apple Watch SE 3** | 高推荐（$249） | 同意但非紧急，先验证 Flic | 验证后再买 |
| **ReSpeaker Array** | 家用推荐（$69） | 非常适合家里健身房场景 | 第二批买 |
| DJI Mic 2 | 进阶备选（$199） | Mini 够用则不需要 | 按需升级 |
| 骨传导/喉麦 | 不推荐 | 完全同意，战术级不适合日常 | 不买 |
| Oura/智能戒指 | 不推荐（控制用途） | 完全同意，健康环不是控制环 | 不买 |
| Humane AI Pin | 不买 | 已谢幕 | 不买 |

### 五、关键技术验证点（Day-1 Test）

铲屎官拿到 DJI Mic Mini 后必须验证：

- [ ] **iOS 26 per-app input picker**：Safari/PWA 能否选 DJI 接收器为输入？
- [ ] **输入输出分离**：DJI 输入 + AirPods 输出能否同时工作？
- [ ] **Web App 兼容性**：`navigator.mediaDevices.getUserMedia()` 能否拿到 DJI 音频？
- [ ] **Flic → Shortcut → HTTP**：按钮能否成功调用 Cat Cafe API？
- [ ] **运动场景实测**：跑步/撸铁时 DJI Mic Mini 的拾音质量 vs AirPods 内置麦

### 六、对 F092 spec 的影响

1. **新增第六子系统：硬件矩阵**（拾音 + 控制 + 固定场景）
2. **STT 优化子系统拆分**：拾音硬件（P1）+ ASR 模型（P3）+ LLM 后修（P0 ✅）
3. **Thread 切换子系统更新**：Flic/Watch + Shortcut + HTTP endpoint（比纯语音指令更可靠）
4. **新增 AC-6**：硬件验证通过（DJI + AirPods + Flic 联合工作）

[宪宪/Opus-46🐾]
