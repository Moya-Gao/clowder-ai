# F132 钉钉/企微接入 — OpenClaw 生态对接调研

> 委托人：布偶猫/宪宪 → GPT Pro（云端）
> 日期：2026-03-22
> Related: F132, F088

## 背景

我们是 Cat Cafe（一个多 AI Agent 协作平台），已通过内部 Feature F088 实现了飞书（Lark）和 Telegram 的双向 DM 网关。核心架构是三层设计：

1. **Principal Link**: `connector + externalSenderId → internalUserId`（身份绑定）
2. **Session Binding**: `connector + externalChatId → activeThreadId`（会话绑定，Redis 持久化）
3. **Command Layer**: 平台无关的 IM 命令集（`/new /threads /use /where`）

Adapter 只负责协议转换（`parseEvent` / `sendReply` / `sendFormattedReply` / `sendMedia`），所有业务逻辑在公共层。新增平台 = 新增 adapter 文件 + bootstrap 注册，公共层零改动。

我们的飞书接入参考了 **OpenClaw**（github.com/openclaw/openclaw，~330k stars）的 Feishu 扩展（`extensions/feishu/`），其 composable adapter + capability flags + plugin manifest 的模式验证了我们的架构方向。

现在我们立项 F132，计划新增 **钉钉（DingTalk）** 和 **企业微信（WeCom）** 两个 adapter。

## 需要调研的问题

### Q1: OpenClaw 生态的钉钉/企微接入

OpenClaw 本体及其衍生项目/fork 中：
- **OpenClaw 本体**：是否有钉钉和企业微信的 extension/adapter？（`extensions/` 目录下？社区 PR？）
- **OpenClaw 的 WebChat 通道**：文档中提到了 WebChat（用 Gateway WebSocket）——这具体是什么？网页聊天 widget？还是微信/企微通道？
- **OpenClaw 衍生产品/fork**：市面上基于 OpenClaw 的二次开发项目（类似"小龙虾"生态），有哪些实现了钉钉或企微接入？它们是怎么做的？

### Q2: OpenClaw-like 平台的钉钉/企微对接方案

请重点调研**与 OpenClaw 同代/同级别的现代 AI Agent 平台**——而非 Dify、Coze、FastGPT 等上一代框架。关注点：

- 哪些 OpenClaw 生态项目（fork、插件、衍生品）已经实现了钉钉/企微接入？
- 它们的 adapter/extension 架构是什么样的？
- 认证流程怎么处理？消息格式怎么映射？
- 有没有公开的代码仓库或文档可以参考？

如果 OpenClaw 生态确实没有钉钉/企微接入，请明确说明，并指出**最接近的参考实现**在哪里（可以扩展到非 OpenClaw 生态，但请标注清楚）。

### Q3: 关键技术决策点

对于每个调研到的实现，请按以下维度对比：

| 维度 | 钉钉（DingTalk） | 企业微信（WeCom） |
|------|------------------|------------------|
| **SDK 选型** | 官方 SDK？第三方？自建轻量封装？ | 同左 |
| **连接模式** | Stream 长连接 vs HTTP 回调？ | 回调 URL 验证流程？ |
| **认证** | appKey/appSecret？企业内部应用 vs ISV？ | corpid/corpsecret？access_token 管理？ |
| **安全** | 签名校验？ | AES 加解密（EncodingAESKey）？ |
| **消息格式** | JSON？支持哪些类型？卡片？ | XML 还是 JSON？卡片类型？ |
| **流式/编辑** | 互动卡片支持 update？ | 能编辑已发消息？流式输出 workaround？ |
| **媒体** | 图片/音频/文件上传 API？ | 临时素材 vs 永久素材？ |

### Q4: 企微特殊挑战

企业微信有几个与其他平台不同的技术特点，请重点关注各参考实现是怎么处理的：
- **AES 消息加解密**（EncodingAESKey，CBC 模式）— Node.js/TypeScript 有成熟库吗？
- **XML 消息体**（其他平台都是 JSON）— 怎么解析和生成？用什么库？
- **不支持消息编辑** — 流式输出（我们飞书用 placeholder → edit → final）在企微怎么做？有没有 workaround（如模板消息、异步更新）？

## 输出要求

- 每个结论标注信息来源（GitHub 仓库 URL / 官方文档 URL / 代码文件路径）
- 区分"已确认（代码/文档可证实）"和"推测"
- 给出**推荐方向**（SDK 选型、连接模式、消息格式策略）+ 风险
- 重点关注 **Node.js/TypeScript 生态**（我们的技术栈）
- 如果发现某个实现特别优雅或踩过坑，请重点标注
