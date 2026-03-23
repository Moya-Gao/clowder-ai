---
feature_ids: [F132]
related_features: [F088]
topics: [dingtalk, wecom, gateway, connector, research]
doc_kind: note
created: 2026-03-22
---

# F132 钉钉/企微接入 — GPT Pro 调研咨询

> 委托人：布偶猫/宪宪 → GPT Pro（云端）
> 日期：2026-03-22
> Related: F132, F088

---

## Part 1: 发给云端模型的提示词

> 直接复制以下内容发送给 GPT Pro

你好，我们是 Cat Cafe（一个多 AI Agent 协作平台），已通过内部 Feature F088 实现了飞书（Lark）和 Telegram 的双向 DM 网关。核心架构是三层设计：

1. **Principal Link**: `connector + externalSenderId → internalUserId`（身份绑定）
2. **Session Binding**: `connector + externalChatId → activeThreadId`（会话绑定，Redis 持久化）
3. **Command Layer**: 平台无关的 IM 命令集（`/new /threads /use /where`）

Adapter 只负责协议转换（`parseEvent` / `sendReply` / `sendFormattedReply` / `sendMedia`），所有业务逻辑在公共层。新增平台 = 新增 adapter 文件 + bootstrap 注册，公共层零改动。

我们的飞书接入参考了 **OpenClaw**（github.com/openclaw/openclaw，~330k stars）的 Feishu 扩展（`extensions/feishu/`），其 composable adapter + capability flags + plugin manifest 的模式验证了我们的架构方向。

现在我们立项 F132，计划新增 **钉钉（DingTalk）** 和 **企业微信（WeCom）** 两个 adapter。

### 需要调研的问题

**Q1: OpenClaw 生态的钉钉/企微接入**
- OpenClaw 本体是否有钉钉和企业微信的 extension/adapter？（`extensions/` 目录下？社区 PR？）
- OpenClaw 的 WebChat 通道（用 Gateway WebSocket）具体是什么？网页聊天 widget？还是微信/企微通道？
- OpenClaw 的衍生产品/fork（"小龙虾"生态），有哪些实现了钉钉或企微接入？怎么做的？

**Q2: OpenClaw-like 平台的钉钉/企微对接方案**
请重点调研**与 OpenClaw 同代/同级别的现代 AI Agent 平台**——而非 Dify、Coze、FastGPT 等上一代框架。关注：
- 哪些 OpenClaw 生态项目已实现了钉钉/企微接入？
- adapter/extension 架构是什么样的？
- 认证流程？消息格式映射？
- 有公开代码仓库或文档可参考吗？

如果 OpenClaw 生态确实没有钉钉/企微接入，请明确说明，并指出**最接近的参考实现**在哪里。

**Q3: 关键技术决策点**
对于每个调研到的实现，按以下维度对比：

| 维度 | 钉钉（DingTalk） | 企业微信（WeCom） |
|------|------------------|------------------|
| **SDK 选型** | 官方 SDK？第三方？自建轻量封装？ | 同左 |
| **连接模式** | Stream 长连接 vs HTTP 回调？ | 回调 URL 验证流程？ |
| **认证** | appKey/appSecret？企业内部应用 vs ISV？ | corpid/corpsecret？access_token 管理？ |
| **安全** | 签名校验？ | AES 加解密（EncodingAESKey）？ |
| **消息格式** | JSON？支持哪些类型？卡片？ | XML 还是 JSON？卡片类型？ |
| **流式/编辑** | 互动卡片支持 update？ | 能编辑已发消息？流式输出 workaround？ |
| **媒体** | 图片/音频/文件上传 API？ | 临时素材 vs 永久素材？ |

**Q4: 企微特殊挑战**
企业微信有几个与其他平台不同的技术特点，请重点关注各参考实现怎么处理的：
- **AES 消息加解密**（EncodingAESKey，CBC 模式）— Node.js/TypeScript 有成熟库吗？
- **XML 消息体**（其他平台都是 JSON）— 用什么库解析和生成？
- **不支持消息编辑** — 流式输出怎么做？有 workaround（如模板消息、异步更新）吗？

### 输出要求
- 每个结论标注信息来源（GitHub 仓库 URL / 官方文档 URL / 代码路径）
- 区分"已确认（代码/文档可证实）"和"推测"
- 给出**推荐方向**（SDK 选型、连接模式、消息格式策略）+ 风险
- 重点关注 **Node.js/TypeScript 生态**（我们的技术栈）
- 发现特别优雅的实现或踩坑经验请重点标注

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官粘贴 GPT Pro 的回答到这里

截至我这次检索，先把结论摊开讲。

**1）OpenClaw 主仓当前没有内建的钉钉 / 企微 extension。** 我检查了主仓当前 `extensions/` 清单，能看到 `feishu` 等官方扩展，但没有 `dingtalk` 或 `wecom` 目录。与此同时，官方 Community Plugins 文档已经明确列出 `DingTalk` 和 `wecom` 两个社区插件，所以更准确的状态是“官方文档承认的社区插件”，不是“主仓 bundled”。([GitHub][1])

**2）`WebChat` 不是微信/企微，也不是网页聊天 widget。** 官方文档把它写成 `WebChat (Gateway WebSocket UI)`，而且明确说明这是一个直接连 Gateway WebSocket 的聊天 UI，当前形态是 macOS / iOS 的 SwiftUI 原生客户端，使用与其他 channel 相同的 session 和 routing 规则。名字容易让人误会，但它本质上是“Gateway 自带前端通道”，不是微信系通道。([OpenClaw][2])

**3）钉钉侧公开可抄的最佳参考，是 `largezhou/openclaw-dingtalk`、`DingTalk-Real-AI/dingtalk-openclaw-connector`、`soimy/openclaw-channel-dingtalk`。** 前者是“最像标准 OpenClaw channel plugin 的朴素实现”，后两者则把 AI Card 流式更新做出来了。([GitHub][3])

**4）企微侧最值得重点看的是两条线。** 一条是 **AI Bot WebSocket** 线，代表实现有 `WecomTeam/wecom-openclaw-plugin` 和 `YanHaidao/wecom`；另一条是 **传统自建应用 callback + AES/XML** 线，代表实现是 `toboto/openclaw-wecom-channel`。真正优雅的工程做法，几乎都不是二选一，而是把两条线拆开处理。([GitHub][4])

**5）给你们 F132 的推荐方向很明确。** 钉钉建议走 **Stream 模式** 作为基础接入，再把 **AI Card** 作为可选增强层；企微建议至少拆成两个 transport / connector，分别是 **`wecom-bot`（AI Bot WebSocket）** 和 **`wecom-agent`（自建应用 callback / API）**，不要硬塞进一个“统一企微 adapter”。这样最贴合你们现有 `Principal Link + Session Binding + Command Layer` 的公共层设计。([GitHub][5])

下面按 Q1 到 Q4 展开。
标记规则：**✅ 已确认** = 有代码 / 文档可证实。**🟡 推测** = 基于代码行为做的工程推断。

---

## Q1. OpenClaw 生态里，钉钉 / 企微到底接进来了没有？

### 1) OpenClaw 本体

**✅ 已确认：主仓当前没有 bundled 的 DingTalk / WeCom extension。** 主仓 `extensions/` 里有 `feishu`，但没有 `dingtalk` / `wecom`。所以截至现在，它们都还不算“官方内置通道”。([GitHub][1])

**✅ 已确认：官方文档已经把 DingTalk / WeCom 作为 Community Plugins 挂出来。** Community Plugins 页里，钉钉条目标的是 `@largezhou/ddingtalk` / `largezhou/openclaw-dingtalk`，企微条目标的是 `@wecom/wecom-openclaw-plugin` / `WecomTeam/wecom-openclaw-plugin`。这说明 OpenClaw 官方文档承认这两个生态插件，但依然把它们放在第三方层。([OpenClaw][6])

### 2) 上游 issue / PR 动向

**✅ 已确认：钉钉有上游推进，但当前不是 merged 状态。** OpenClaw 的 feature issue #13858 明说 “We Have a Production-Ready Implementation”，并指向 `largezhou/openclaw-dingtalk`；同一个 issue 里还提到提交过 PR #13291。不过 PR #13291 当前页面状态是 **Closed**，不是 merged。([GitHub][7])

**✅ 已确认：企微也有上游 feature issue，但仍然是“外部 production-ready 实现”姿态。** issue #14008 同样写了 “We Have a Production-Ready Implementation”，并指向 `YanHaidao/wecom`；但主仓 `extensions/` 里依然没有 `wecom`。这说明企微在生态里是“成熟外部插件”，不是“主仓内建”。([GitHub][8])

### 3) WebChat 到底是什么

**✅ 已确认：`WebChat` 是 Gateway 的原生聊天 UI，不是微信系通道。** 文档直接写了 “Gateway WebSocket UI”，并说明当前是 macOS / iOS SwiftUI 原生客户端，不嵌浏览器，不起本地静态服务，通过 `chat.history`、`chat.send`、`chat.inject` 这些 Gateway WS 方法与后端通信。([OpenClaw][2])

### 4) 你们架构方向和 OpenClaw 当前插件哲学是否一致

**✅ 已确认：非常一致。** OpenClaw 当前 channel plugin 指南明确写到，channel plugin 一般不需要自带 send / edit / react tools，因为 core 共享 `message` tool；plugin 自己主要负责配置、安全、配对、出站和 threading。当前 SDK 还要求用 `openclaw.plugin.json` 声明插件，并推荐 `defineChannelPluginEntry` 这种 channel entry 方式。你们“adapter 只做协议转换，公共层零改动”的 F088/F132 路线，和这个思路是同方向的。([OpenClaw][9])

---

## Q2. 公开可参考的实现有哪些，它们怎么做？

先给一个总判断：**OpenClaw 生态里，真正有参考价值的代码，不是“有没有接入”，而是“接入分成哪几类”**。我看到的主流形态基本都是：

1. `openclaw.plugin.json` 做 manifest
2. `src/index.ts` 做 bootstrap / register
3. `src/channel.ts` 写 capability flags
4. 再按平台补 `monitor / parser / sender / client / media-*` 文件

这和你们现有 adapter + bootstrap 注册的骨架几乎一一对应。([GitHub][10])

### A. 钉钉侧

#### 1) `largezhou/openclaw-dingtalk`

**✅ 已确认。** 这是官方 Community Plugins 页面直接挂出来的 DingTalk 插件。README 说明它走 **Stream 模式**，无需公网 IP/域名，支持私聊与群聊、文本/Markdown/图片/音频/视频/文件、主动消息、官方命令；配置里填的是 `AppKey / AppSecret`，manifest 是 `openclaw.plugin.json`，核心文件是 `src/index.ts`、`src/channel.ts`、`src/client.ts`、`src/monitor.ts`。([OpenClaw][6])

**✅ 已确认：它是“标准 adapter 化”的好参考，但在流式上很保守。** `src/channel.ts` 里直接把 `blockStreaming: true` 写死，并注明“钉钉不支持流式消息”；`src/client.ts` 走主动私聊 `batchSend` 和媒体上传，`src/monitor.ts` 还 monkey-patch 了 `dingtalk-stream` 的 keepAlive reconnect。这意味着它适合拿来参考“最小可用的 Stream 通道”，但不适合作为“富流式 UX”的终局方案。([GitHub][11])

#### 2) `DingTalk-Real-AI/dingtalk-openclaw-connector`

**✅ 已确认。** 这个项目把自己描述成 **“Stream mode with AI Card streaming”**。README 配置项仍然是 `clientId / clientSecret`，manifest 是独立 channel `dingtalk-connector`，`src/index.ts` 里除了 register channel 还 register 了 gateway methods，`src/channel.ts` 的文案明确写“支持 AI Card 流式响应”。([GitHub][12])

**✅ 已确认：这是钉钉“placeholder → update → final”体验最接近你们飞书做法的参考。** 它的 capability 对普通 message edit 仍然很保守，但它把富文本 / AI Card 单独当成一条更强的发送路径处理。对你们来说，这很适合对应到 `sendFormattedReply`，而不是污染公共 `sendReply`。([GitHub][13])

#### 3) `soimy/openclaw-channel-dingtalk`

**✅ 已确认。** 这是目前我看到的钉钉侧“工程味最浓”的社区实现之一。README 明说它是 Stream 模式、无需公网 IP，并且专门写了一个 AI Card 流式机制：先走 `/v1.0/card/instances/createAndDeliver`，再走 `/v1.0/card/streaming`，状态机会从 `PROCESSING` 到 `INPUTING` 再到 `FINISHED`，还有 300ms throttle、single-flight、`dynamicSummary` 等细节。([GitHub][14])

**✅ 已确认：它还把坑写出来了。** README 直接提到过 `dingtalk-stream` 一度有丢消息问题，并说随着钉钉侧扩容已经改善；配置层又做了 `dmPolicy / groupPolicy / allowlist / mention requirement / displayNameResolution` 等很多现实世界约束。这个仓库很适合抄“边界条件”和“线上防呆”，不只是抄 happy path。([GitHub][14])

#### 4) `BytePioneer-AI/openclaw-china`

**✅ 已确认。** 这不是单一钉钉插件，而是一套“中国区 channel extension 集合”。`AGENTS.md` 说它给 Moltbot/OpenClaw 增加了 Feishu、DingTalk、WeCom、QQ，仓库树里能看到 `extensions/dingtalk`、`extensions/wecom`、`extensions/wecom-app`。更适合参考“多中国 IM 并存时的目录布局和插件命名”，不一定是最深的单协议实现。([GitHub][15])

### B. 企业微信侧

#### 1) `WecomTeam/wecom-openclaw-plugin`

**✅ 已确认。** 这是官方 Community Plugins 页面列出的企微插件，README 直接写 “by the Tencent WeCom team”，并说明它是 **WeCom AI Bot WebSocket persistent connections**，支持私聊 / 群聊、主动消息、图片文件自动下载、流式回复、Markdown、心跳与重连。代码结构里能看到 `message-parser.ts`、`message-sender.ts`、`media-handler.ts`、`media-uploader.ts`、`monitor.ts` 等典型 adapter 文件。([OpenClaw][6])

**✅ 已确认：它不只是 channel，还带了工具层。** `src/index.ts` 里除了 register channel，还注册了 `wecom_mcp` 工具，并在 `before_prompt_build` 注入提示。对你们这种“公共层已经很清晰”的架构来说，这种做法很优雅，但不是必须照抄。你们完全可以只拿 channel 部分，把工具层留在公共系统。([GitHub][16])

**🟡 推测：这个仓库在“核心能力声明”和“底层协议能力”之间有一点张力。** `src/channel.ts` 里把 `blockStreaming` 设成了 `true`，但 `src/message-sender.ts` 又明确调用了 `replyStream()`。我更倾向把它理解为“协议层支持流式，插件对 OpenClaw core 暴露时采取了保守兼容策略”，不是企微 Bot 本身不能流式。([GitHub][17])

**✅ 已确认：这里还有一个生态命名分叉。** Community Plugins 页和 README 用的是 `@wecom/wecom-openclaw-plugin`，但同仓库 `package.json` 里的 `openclaw.install.npmSpec` 写成 `@tencent/wecom-openclaw-plugin`。内部文档里最好 pin 到“具体仓库 + commit + 包名”，别只记一个 npm 名字。([OpenClaw][6])

#### 2) `YanHaidao/wecom`

**✅ 已确认，而且这是我最推荐优先深看的一份。** 它的 README 和 feature issue 都强调 **Bot + Agent dual-mode parallel architecture with Bot-first, Agent-fallback**。README 推荐的生产架构就是“Bot WS 做低延迟流式交互，Agent 做主动推送、媒体、长任务兜底”，并且支持多账号、`dynamicAgents`、Bot / Agent 两套能力面。([GitHub][8])

**✅ 已确认：它把企微两条宇宙都收进一个插件里了。** onboarding 同时支持 Bot 模式与 Agent 模式。Bot 模式填 `botId / secret`，Agent 模式填 `corpId / agentId / agentSecret / token / encodingAESKey`；`src/index.ts` 既注册 channel，也注册 HTTP 路由；`src/monitor.ts` 明写会处理 `/plugins/wecom/{bot|agent}/{accountId}` 的签名验证、解密、GET `EchoStr` 校验和 POST 消息处理；`src/channel.ts` 里还把 `blockStreaming` 设成了 `false`。这套实现非常适合作为你们“同一个 connector 家族下的双 transport”范本。([GitHub][18])

**✅ 已确认：它自己也把自己当“上游来源”来维护。** 仓库治理文件里直接写了 “This repository is the Upstream / Source of Truth for the OpenClaw WeCom plugin”。至少在企微这个分支上，它已经不是一个随手 fork，而是带着上游野心在做。([GitHub][19])

#### 3) `toboto/openclaw-wecom-channel`

**✅ 已确认。** 这是经典 **企微自建应用 callback + AES/XML** 的干净参考实现。README 说明它兼容较新的 OpenClaw 版本，支持官方企微 API、加密消息收发、文本/图片/文件、回调校验；核心文件包括 `src/lib/wecom-crypto.ts`、`src/lib/wecom-xml.ts`、`src/lib/official-api.ts`、`src/lib/wecom-client.ts`。([GitHub][20])

**✅ 已确认：AES / XML 这块，它是最适合 Node / TS 团队抄的。** `wecom-crypto.ts` 里直接用 Node `crypto` 做 SHA1 签名校验、Base64 解 `EncodingAESKey`、`aes-256-cbc` 解密、IV 取 key 前 16 字节、PKCS7 去 padding、CorpID 校验；`wecom-xml.ts` 用的是 `fast-xml-parser`；`official-api.ts` 封装了 `message/send`、`media/upload`、`media/get`。如果你们要补“传统企微自建应用入口”，这仓库是首选教材。([GitHub][21])

**✅ 已确认：它没有消息编辑语义，现实做法是退化处理。** `wecom-client.ts` 里对文本和 Markdown 还专门做了字节数保守限制与分块发送。也就是说，在 classic callback / app 模式下，工程现实不是“edit 已发消息”，而是“控制长度、必要时拆段、发送最终结果”。([GitHub][22])

#### 4) `sunnoy/openclaw-plugin-wecom`

**✅ 已确认。** 这个项目同样走 **WebSocket-first** 路线，包依赖里用了 `@wecom/aibot-node-sdk`。README 摘要显示，它把被动回复统一走 WS `replyStream`，主动发送按能力分层到 WS / webhook / Agent API，并在 WS 断线时把待发送队列自动用 Agent 补发。这说明“Bot-first, Agent-fallback”不是个别项目的异想天开，而是企微生态里正在收敛成共识的工程模式。([GitHub][23])

---

## Q3. 关键技术决策点，对你们怎么选最合适

### 1) SDK 选型

**钉钉建议：`dingtalk-stream` 负责 inbound / event push，卡片与媒体走轻量 OpenAPI 封装。** 官方文档写得很清楚，Stream SDK 负责事件订阅、机器人消息、卡片回调；更复杂的交互卡片等能力仍然建议走 OpenAPI。社区 DingTalk 插件也几乎都依赖 `dingtalk-stream`。所以我不建议找重型第三方 SDK，直接 “官方 Stream SDK + 自建薄封装” 最稳。([GitHub][5])

**企微建议分两套。** `wecom-bot` 直接用官方 `@wecom/aibot-node-sdk`，因为它已经给了 WS 连接、认证、心跳、重连、`replyStream`、模板卡片更新、媒体上传下载等完整能力；`wecom-agent` 则建议用 Node `crypto` + `fast-xml-parser` + 自建 access_token manager，不要把 callback/AES/XML 这部分绑死在不透明第三方 SDK 里。([GitHub][24])

### 2) 连接模式

**钉钉建议主推 Stream 长连接。** 官方 SDK README 和社区实现都强调 Stream 模式，优点就是不需要公网 IP / 域名，天然更贴合 OpenClaw / Cat Cafe 这类“统一网关 + adapter”架构。([GitHub][5])

**企微不要只选一个模式。** AI Bot 是 WebSocket 长连接世界，传统自建应用是 GET / POST callback URL + `EchoStr` 校验 + AES/XML 世界。两者在认证、消息格式、流式能力、安全面都不一样，硬揉成一个 adapter 只会把接口越揉越糊。([GitHub][24])

### 3) 认证

**钉钉这边，公开实现基本都是“企业内部应用 / 机器人”路径。** README 和配置示例里收集的是 `AppKey/AppSecret` 或 `clientId/clientSecret`，没有看到哪个 OpenClaw 插件把 ISV 套件授权做成通用 adapter 主流程。对 F132 来说，先把企业内部应用场景做好就够了。([GitHub][3])

**企微这边天然分裂。** Bot 模式用 `botId + secret`；Agent / 自建应用模式用 `corpId + agentId + agentSecret`，再加 callback 侧的 `token + EncodingAESKey`，出站还要自己做 `access_token` 管理。`YanHaidao/wecom` 和 `toboto/openclaw-wecom-channel` 都是按这套拆的。([GitHub][24])

### 4) 安全

**钉钉 Stream 模式里，安全重点不在 webhook 签名，而在长连接认证和业务侧准入控制。** 我查到的几个钉钉 OpenClaw 插件重心都在 `clientId/clientSecret` 建连，以及 `dmPolicy / groupPolicy / allowlist / mention requirement` 之类的业务安全策略，而不是 callback 风格的手工签名校验。([GitHub][5])

**企微 classic callback 的安全面则很硬核。** 需要 SHA1 签名校验、`EncodingAESKey` 解密、`aes-256-cbc`、CorpID 校验；即便走 AI Bot WS 路线，媒体文件下载也仍然会有单独的解密逻辑。也就是说，企微不是“有没有 AES”的问题，而是“整条消息 envelope 需要 AES，还是只有媒体需要 AES”。([GitHub][21])

### 5) 消息格式

**钉钉消息面基本是 JSON 世界。** 社区实现支持文本、Markdown、图片、音频、视频、文件、富文本；AI Card 这条线又单独提供 richer 的格式化响应能力。([GitHub][7])

**企微消息格式要一分为二。** AI Bot WS 是 JSON 帧世界，还带模板卡片；经典自建应用 inbound 是 XML，outbound 则是 JSON 的 `message/send` / `media/upload` / `media/get` API。也就是说，企微从协议层开始就不统一。([GitHub][24])

### 6) 流式 / 编辑

**钉钉 plain message 路径不适合按“编辑已发消息”理解，但 AI Card 可以做出近似飞书的体验。** `largezhou` 在 `src/channel.ts` 里直接 `blockStreaming: true`；但 `DingTalk-Real-AI` 和 `soimy` 又都做了 AI Card 流式，`soimy` 还明确写了 `/card/instances/createAndDeliver` + `/card/streaming` 的状态机。结论不是“钉钉不能流”，而是“普通消息不适合流，卡片适合做流式更新”。([GitHub][11])

**企微 AI Bot 原生就有流式，但 classic app 没有 edit 语义。** 官方 Node SDK 直接提供 `replyStream`、模板卡片发送 / 更新；`WecomTeam` 和 `YanHaidao` 都沿着这个方向做。相反，classic app 参考实现 `toboto` 的现实策略是长度控制与分块发送，不是 edit。([GitHub][24])

### 7) 媒体

**钉钉媒体上传没问题，但接口代际要留神。** `largezhou` 明确实现了媒体上传，不过走的是 `oapi.dingtalk.com/media/upload` 这种老接口风格；说明“能做”，但你们新实现最好把媒体层抽成独立 client，方便以后替换到更新 API。([GitHub][3])

**企微媒体也分两套。** AI Bot SDK 自带上传媒体、下载文件并解密；classic app 参考实现则主要围绕临时素材 API，也就是 `media/upload` / `media/get` 这一套，我没有在这些 OpenClaw 插件里看到把“永久素材”作为会话消息主通路来做。([GitHub][24])

---

## Q4. 企微三个特殊挑战，怎么落地更靠谱

### 1) AES 消息加解密

**✅ 已确认：Node / TypeScript 生态完全能做，而且不需要神秘黑盒。** `toboto` 的 `wecom-crypto.ts` 已经证明，用 Node 原生 `crypto` 就能把签名校验、AES-CBC 解密、padding、CorpID 校验全部做干净。([GitHub][21])

**✅ 已确认：现成包是有，但我不会把它当主心骨。** npm 上有 `@wecom/crypto`，但搜索结果显示版本是 1.0.1，而且已经 4 年前发布。拿来对照可以，拿来做 F132 的核心安全依赖，我会偏谨慎。([NPM][25])

### 2) XML 消息体

**✅ 已确认：`fast-xml-parser` 这条路可行。** `toboto` 的 `wecom-xml.ts` 就是这么干的。对你们来说，最省心的做法是“parse 用库，生成 XML 用极小模板”，因为回包 XML 形状很简单，没必要引入厚重 XML 栈。([GitHub][26])

### 3) 不支持消息编辑，流式怎么办

**✅ 已确认：classic app 路线没有优雅的 edit。** 至少在我看过的 OpenClaw 实现里，没有看到“编辑已发企微消息”的通用能力；实际工程策略是分块、补发、主动再发一条，而不是 edit 原消息。([GitHub][22])

**✅ 已确认：真正顺手的 workaround，是双平面。** 也就是 `YanHaidao/wecom`、`sunnoy/openclaw-plugin-wecom` 这种做法：**Bot WS 负责实时流式回复，Agent/API 负责主动推送、媒体、长任务兜底、必要时断线补发**。这比在 classic callback 上硬凿“伪流式”要自然得多。([GitHub][27])

---

## 我给 F132 的推荐方案

### A. 钉钉

**推荐：做一个 `dingtalk` adapter，里面再分两条发送策略。**

* `parseEvent` / inbound：统一基于官方 `dingtalk-stream`。
* `sendReply`：走 plain text / markdown / image / file 的保守路径。
* `sendFormattedReply`：单独做 **AI Card** 模式，给“placeholder → streaming update → final”留专门能力位。

这样你们的公共层不用知道钉钉卡片细节，只需要知道“这个 connector 支持 richer formatted reply”。这个方向与官方 Stream SDK能力边界、以及 `DingTalk-Real-AI` / `soimy` 的实践最一致。([open-dingtalk.github.io][28])

### B. 企业微信

**推荐：不要只做一个 `wecom`，至少拆成两个 connector。**

* `wecom-bot`

  * Bot ID / Secret
  * WebSocket 长连接
  * JSON 帧
  * 支持 `replyStream`
  * 适合 DM / 群聊实时交互

* `wecom-agent`

  * CorpID / AgentID / AgentSecret / Token / EncodingAESKey
  * HTTP callback + AES/XML
  * 通过 `message/send` / `media/upload` 等 API 出站
  * 适合主动消息、媒体补发、兼容老企业接入方式

这不是“设计癖”，而是协议现实。两个 transport 的身份、认证、消息格式、流式能力差别太大，强行共用一个 connector 名称，后面会把 `Principal Link`、`Session Binding`、capability flags 都搅成毛线球。([GitHub][24])

### C. 你们公共层怎么映射最顺

**推荐：把能力声明做到 transport 级，而不是平台级。**

* `dingtalk/plain`: `streaming = false`, `messageEdit = false`, `cards = optional`
* `dingtalk/card`: `streamingLikeUpdate = true`
* `wecom-bot`: `streaming = true`, `messageEdit = false`, `templateCard = true`
* `wecom-agent`: `streaming = false`, `messageEdit = false`, `aesXmlIngress = true`

你们现在已经有 adapter-only 设计，这种 capability flag 粒度会比“平台名一个大开关”更干净。这个建议是基于社区插件在 `src/channel.ts` 里已经明显按 transport 差异声明能力。([GitHub][11])

---

## 我会重点标红的风险

**1）不要直接照搬老插件的 bootstrap。** 好几份社区代码还在用旧式 `openclaw/plugin-sdk` 入口，但当前官方 SDK 文档已经把这种方式标成 deprecated，推荐 `openclaw/plugin-sdk/core` 等子路径和 `defineChannelPluginEntry`。你们如果要抄结构，抄思路可以，别把旧 API 原封不动搬进来。([OpenClaw][29])

**2）企微包名和“谁是正统”已经有点分叉。** `WecomTeam` 文档、`package.json`、`YanHaidao` 仓库三者并不完全一致。内部依赖管理里最好 pin 到“仓库 + commit + 包版本”，不要只记一个包名。([OpenClaw][6])

**3）钉钉 Stream 线要把连接观测和幂等当一等公民。** 一个仓库在 monkey-patch `dingtalk-stream` reconnect，另一个仓库在 README 里专门提到过消息丢失问题。这种味道已经很明确了，监控、重连、去重、重放策略都要提前设计。([GitHub][30])

**4）企微 classic callback 不是“多写点样板代码”那么简单。** 它会把 AES、签名、XML、回调 URL 校验、token 管理一起拖进来；如果你们的产品目标首先是“把实时聊天体验做顺”，那优先级应该先给 `wecom-bot`，再补 `wecom-agent`。([GitHub][21])

---

## 我心里最值得抄的三个点

**第一名：`YanHaidao/wecom` 的“双平面架构”。** 这是企微最像成熟产品思维的实现，Bot 做实时，Agent 做兜底，不和协议硬碰硬。([GitHub][8])

**第二名：`soimy/openclaw-channel-dingtalk` 的 AI Card 流式状态机。** 它把“钉钉普通消息不适合流式”这个硬约束，转化成了“卡片流式更新”的工程解法。([GitHub][14])

**第三名：`toboto/openclaw-wecom-channel` 的 AES/XML 参考价值。** 这份代码不像花哨 demo，更像能让 TS 团队直接照着重写的协议教科书。([GitHub][21])

如果你愿意，我下一步可以直接把这份调研继续收束成一版 **F132 技术方案草案**，按你们现有 Cat Cafe 接口拆成 `dingtalk.adapter.ts`、`wecom-bot.adapter.ts`、`wecom-agent.adapter.ts` 的建议文件结构和 capability 设计。

[1]: https://github.com/openclaw/openclaw/tree/main/extensions "https://github.com/openclaw/openclaw/tree/main/extensions"
[2]: https://docs.openclaw.ai/web/webchat "https://docs.openclaw.ai/web/webchat"
[3]: https://github.com/largezhou/openclaw-dingtalk "https://github.com/largezhou/openclaw-dingtalk"
[4]: https://github.com/WecomTeam/wecom-openclaw-plugin "https://github.com/WecomTeam/wecom-openclaw-plugin"
[5]: https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs "https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs"
[6]: https://docs.openclaw.ai/plugins/community "https://docs.openclaw.ai/plugins/community"
[7]: https://github.com/openclaw/openclaw/issues/13858 "https://github.com/openclaw/openclaw/issues/13858"
[8]: https://github.com/openclaw/openclaw/issues/14008 "https://github.com/openclaw/openclaw/issues/14008"
[9]: https://docs.openclaw.ai/plugins/sdk-channel-plugins "https://docs.openclaw.ai/plugins/sdk-channel-plugins"
[10]: https://github.com/largezhou/openclaw-dingtalk/blob/master/openclaw.plugin.json "https://github.com/largezhou/openclaw-dingtalk/blob/master/openclaw.plugin.json"
[11]: https://github.com/largezhou/openclaw-dingtalk/blob/master/src/channel.ts "https://github.com/largezhou/openclaw-dingtalk/blob/master/src/channel.ts"
[12]: https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector "https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector"
[13]: https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector/blob/main/src/channel.ts "https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector/blob/main/src/channel.ts"
[14]: https://github.com/soimy/openclaw-channel-dingtalk "https://github.com/soimy/openclaw-channel-dingtalk"
[15]: https://github.com/BytePioneer-AI/openclaw-china/blob/main/AGENTS.md "https://github.com/BytePioneer-AI/openclaw-china/blob/main/AGENTS.md"
[16]: https://github.com/WecomTeam/wecom-openclaw-plugin/blob/main/index.ts "https://github.com/WecomTeam/wecom-openclaw-plugin/blob/main/index.ts"
[17]: https://github.com/WecomTeam/wecom-openclaw-plugin/blob/main/src/channel.ts "https://github.com/WecomTeam/wecom-openclaw-plugin/blob/main/src/channel.ts"
[18]: https://github.com/YanHaidao/wecom/blob/main/src/onboarding.ts "https://github.com/YanHaidao/wecom/blob/main/src/onboarding.ts"
[19]: https://github.com/YanHaidao/wecom/blob/main/GOVERNANCE.md "https://github.com/YanHaidao/wecom/blob/main/GOVERNANCE.md"
[20]: https://github.com/toboto/openclaw-wecom-channel "https://github.com/toboto/openclaw-wecom-channel"
[21]: https://github.com/toboto/openclaw-wecom-channel/blob/main/src/crypto.ts "https://github.com/toboto/openclaw-wecom-channel/blob/main/src/crypto.ts"
[22]: https://github.com/toboto/openclaw-wecom-channel/blob/main/src/client.ts "https://github.com/toboto/openclaw-wecom-channel/blob/main/src/client.ts"
[23]: https://github.com/sunnoy/openclaw-plugin-wecom/blob/main/package.json "https://github.com/sunnoy/openclaw-plugin-wecom/blob/main/package.json"
[24]: https://github.com/WecomTeam/aibot-node-sdk "https://github.com/WecomTeam/aibot-node-sdk"
[25]: https://www.npmjs.com/package/%40wecom/crypto?activeTab=versions "https://www.npmjs.com/package/%40wecom/crypto?activeTab=versions"
[26]: https://github.com/toboto/openclaw-wecom-channel/blob/main/src/message-parser.ts "https://github.com/toboto/openclaw-wecom-channel/blob/main/src/message-parser.ts"
[27]: https://github.com/yanhaidao/wecom "https://github.com/yanhaidao/wecom"
[28]: https://open-dingtalk.github.io/developerpedia/docs/develop/sdk/overview/ "https://open-dingtalk.github.io/developerpedia/docs/develop/sdk/overview/"
[29]: https://docs.openclaw.ai/plugins/sdk-entrypoints "https://docs.openclaw.ai/plugins/sdk-entrypoints"
[30]: https://github.com/largezhou/openclaw-dingtalk/blob/master/src/monitor.ts "https://github.com/largezhou/openclaw-dingtalk/blob/master/src/monitor.ts"

---

## Part 3: 综合报告

> 布偶猫/宪宪 — 2026-03-22 | 对照 Cat Café codebase 验证 + GPT Pro 调研综合

### 核心结论：F132 设计需要修订

GPT Pro 的调研揭示了一个关键洞察：**企微应该拆成两个 connector，而非一个统一 adapter**。这改变了 F132 的 Phase 结构。

### 1. 对照 codebase 验证

| GPT Pro 建议 | 我们的 codebase 现状 | 可行性 |
|-------------|-------------------|--------|
| adapter-only 扩展，公共层零改动 | `IOutboundAdapter` 接口 + `adapters.set()` 注册 + duck typing 能力发现 | **直接可用** — 新 adapter 实现接口即可，不改 Router/CommandLayer/BindingStore |
| 钉钉 AI Card 流式 → `sendFormattedReply` | 我们有 `IStreamableOutboundAdapter`（sendPlaceholder + editMessage），飞书已验证 | **直接可用** — AI Card 的 create → stream update → finish 完美映射到 placeholder → edit → final |
| 企微拆 `wecom-bot` + `wecom-agent` | `adapters.set()` 支持任意多个 connector ID，每个独立注册 | **直接可用** — `adapters.set('wecom-bot', ...)` + `adapters.set('wecom-agent', ...)` |
| 能力声明做到 transport 级 | 当前用 duck typing（`'sendPlaceholder' in adapter`），无静态 flags | **兼容** — duck typing 天然支持不同 adapter 实现不同方法子集 |
| `fast-xml-parser` 处理企微 XML | 项目未引入此依赖 | **需验证** — Phase B 引入，adapter 内部用 |
| `dingtalk-stream` 官方 SDK | 项目未引入此依赖 | **需验证** — Phase A 引入 |

### 2. 设计修订要点

**原设计（立项时）**：
```
Phase A: DingTalkAdapter (单一)
Phase B: WeComAdapter (单一)
Phase C: 富文本映射
Phase D: Bootstrap + 文档
```

**修订后设计（基于调研）**：
```
Phase A: DingTalkAdapter (Stream + AI Card 双发送策略)
Phase B: WeComBotAdapter (WebSocket + replyStream，实时交互)
Phase C: WeComAgentAdapter (HTTP callback + AES/XML，主动推送/兜底)
Phase D: 跨平台富文本映射 + Bootstrap + 文档
```

**为什么企微必须拆**（GPT Pro 论证已确认）：
- **身份不同**：Bot 用 `botId/secret`，Agent 用 `corpId/agentId/agentSecret/token/encodingAESKey`
- **协议不同**：Bot 是 WebSocket + JSON，Agent 是 HTTP callback + AES/XML
- **能力不同**：Bot 支持 `replyStream`（真流式），Agent 不支持消息编辑
- 硬揉成一个 adapter 会把 Principal Link、Session Binding、capability 都搅成毛线球

### 3. 参考实现价值评估

| 仓库 | 价值 | 我们怎么用 |
|------|------|-----------|
| **`YanHaidao/wecom`** ⭐⭐⭐ | Bot + Agent 双平面架构范本 | 学习 dual-mode 注册 + fallback 策略 |
| **`soimy/openclaw-channel-dingtalk`** ⭐⭐⭐ | AI Card 流式状态机（create → stream → finish + 300ms throttle） | 直接参考映射到我们的 `IStreamableOutboundAdapter` |
| **`toboto/openclaw-wecom-channel`** ⭐⭐⭐ | AES/XML 协议教科书（Node crypto + fast-xml-parser） | Phase C 的 AES/XML 实现蓝本 |
| `largezhou/openclaw-dingtalk` ⭐⭐ | 最小可用 Stream adapter | 参考 bootstrap + monitor + reconnect |
| `WecomTeam/wecom-openclaw-plugin` ⭐⭐ | 腾讯官方企微插件 | 参考 `@wecom/aibot-node-sdk` 用法 |
| `BytePioneer-AI/openclaw-china` ⭐ | 中国区多 IM 目录布局 | 仅参考文件组织 |

### 4. 技术选型推荐

| 维度 | 钉钉 | 企微 Bot | 企微 Agent |
|------|------|---------|-----------|
| **SDK** | `dingtalk-stream`（官方 Stream SDK） | `@wecom/aibot-node-sdk`（腾讯官方） | Node `crypto` + `fast-xml-parser` 自建 |
| **连接** | Stream 长连接（无需公网 URL） | WebSocket 长连接 | HTTP callback（需公网 URL） |
| **认证** | `appKey` + `appSecret` | `botId` + `secret` | `corpId` + `agentSecret` + `token` + `encodingAESKey` |
| **消息格式** | JSON | JSON 帧 | 入站 XML（AES 加密）→ 出站 JSON API |
| **流式** | AI Card streaming（create → update → finish） | `replyStream`（原生） | 不支持（final-only） |
| **Adapter 接口** | `IStreamableOutboundAdapter` | `IStreamableOutboundAdapter` | `IOutboundAdapter`（无 streaming） |

### 5. 风险与缓解（更新）

| 风险 | 缓解 |
|------|------|
| `dingtalk-stream` 有丢消息历史（社区报告） | 从 F088 复用 `InboundMessageDedup`，加 reconnect 监控 |
| 企微 `@wecom/aibot-node-sdk` 版本稳定性未知 | 先 Phase B 用官方 SDK，Phase C 可降级到自建 |
| 企微包名分叉（`@wecom/` vs `@tencent/`） | 内部 pin 到仓库 + commit + 包版本，不只记名 |
| 三个 adapter 的 Session Binding 交叉 | 每个 connector ID 独立绑定，`wecom-bot` 和 `wecom-agent` 可绑不同 thread |

### 6. 行动项

- [x] Part 3 综合完成
- [ ] 更新 F132 spec：Phase 结构修订（A/B/C/D → A/B/C/D 内容变化）
- [ ] 更新 F132 Links：补充参考实现仓库
- [ ] 等铲屎官确认修订后的 Phase 结构 → Design Gate
