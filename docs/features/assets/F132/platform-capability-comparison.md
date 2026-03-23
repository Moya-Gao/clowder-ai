---
feature_ids: [F132]
related_features: [F088]
topics: [dingtalk, wecom, feishu, capability, comparison]
doc_kind: note
created: 2026-03-22
---

# F132 平台能力对比报告 — 飞书 vs 钉钉 vs 企微

> 布偶猫/宪宪 — 2026-03-22
> 基于 F088 飞书 Adapter 实际代码 + GPT Pro 调研 + OpenClaw 社区参考实现

## 1. 飞书 Adapter 现有能力清单

以下为 `FeishuAdapter.ts` 实际实现的完整能力（代码级确认）：

| 方法 | 接口 | 说明 |
|------|------|------|
| `verifyEventToken()` | 安全 | webhook verificationToken 校验 |
| `parseEvent()` | 入站 | 解析 text / image / file / audio / post(富文本) 消息 |
| `parseCardAction()` | 入站 | 解析飞书卡片交互回调（按钮点击等） |
| `sendReply()` | `IOutboundAdapter` | 纯文本发送（`msg_type: text`） |
| `sendRichMessage()` | `IOutboundAdapter` | Rich blocks → 飞书 card JSON |
| `sendFormattedReply()` | `IOutboundAdapter` | MessageEnvelope → interactive card（猫名 header + 正文 + deep link） |
| `sendMedia()` | `IOutboundAdapter` | 图片/音频/文件上传 + 发送（FeishuTokenManager） |
| `sendPlaceholder()` | `IStreamableOutboundAdapter` | 发送占位 interactive card（"🤔 思考中..."） |
| `editMessage()` | `IStreamableOutboundAdapter` | `im.message.patch` 编辑卡片内容（流式更新） |
| `deleteMessage()` | `IStreamableOutboundAdapter` | 删除占位卡片（最终消息发送后清理） |

**Adapter 实现接口**：`IStreamableOutboundAdapter`（含全部流式能力）

**SDK**：`@larksuiteoapi/node-sdk`

## 2. 全平台能力对照表

### 2.1 入站能力

| 能力 | 飞书 (现有) | 钉钉 | 企微 Bot | 企微 Agent |
|------|:----------:|:----:|:--------:|:----------:|
| **连接模式** | HTTP webhook | Stream 长连接 | WebSocket | HTTP callback |
| **需要公网 URL** | 是（Cloudflare 隧道） | **否** | **否** | 是 |
| **安全验证** | verificationToken | SDK 内置 | SDK 内置 | AES + SHA1 签名 |
| **消息格式** | JSON | JSON | JSON | **XML + AES 加密** |
| text 消息 | ✅ | ✅ | ✅ | ✅ |
| 富文本 (post/richText) | ✅ `case 'post'` | ✅ richText | ❌ | ✅ XML 解析 |
| 图片 | ✅ `case 'image'` | ✅ picture | ✅ image | ✅ image |
| 文件 | ✅ `case 'file'` | ✅ file | ✅ file | ✅ file |
| 语音 | ✅ `case 'audio'` + STT | ✅ audio | ✅ voice | ✅ voice |
| 视频 | ❌ | ✅ video | ❌ | ✅ video |
| 位置 | ❌ | ❌ | ❌ | ✅ location |
| DM-only (MVP) | ✅ `chat_type=p2p` | ✅ | ✅ | ✅ |
| 卡片交互回调 | ✅ `parseCardAction()` | ✅ card callback | ❓ 待验证 | ❌ |
| 幂等去重 | ✅ F088 `InboundMessageDedup` | 复用 | 复用 | 复用 |

### 2.2 出站能力

| 能力 | 飞书 (现有) | 钉钉 | 企微 Bot | 企微 Agent |
|------|:----------:|:----:|:--------:|:----------:|
| `sendReply` (text) | ✅ | ✅ | ✅ | ✅ |
| `sendReply` (markdown) | ✅ card body | ✅ | ✅ | ✅ |
| `sendFormattedReply` (卡片) | ✅ interactive card | ✅ **AI Card** | ✅ 模板卡片 | ✅ TextCard/News |
| `sendRichMessage` (rich blocks) | ✅ → card JSON | ✅ → AI Card | ✅ → 模板卡片 | ✅ → TextCard |
| `sendMedia` (图片) | ✅ 上传+发送 | ✅ OpenAPI 上传 | ✅ SDK 内置 | ✅ 临时素材 API |
| `sendMedia` (音频) | ✅ 上传+发送 | ✅ | ✅ | ✅ |
| `sendMedia` (文件) | ✅ 上传+发送 | ✅ | ✅ | ✅ |
| 消息长度限制 | 无显式限制 | markdown 4000 字 | 待验证 | 2048 字节（需分块） |

### 2.3 流式能力（关键差异）

| 能力 | 飞书 (现有) | 钉钉 | 企微 Bot | 企微 Agent |
|------|:----------:|:----:|:--------:|:----------:|
| **实现接口** | `IStreamableOutboundAdapter` | `IStreamableOutboundAdapter` | `IStreamableOutboundAdapter` | `IOutboundAdapter` (无流式) |
| `sendPlaceholder()` | ✅ interactive card | ✅ AI Card create | ✅ replyStream 开始 | ❌ |
| `editMessage()` | ✅ `im.message.patch` | ✅ card streaming update | ✅ 追加流式内容 | ❌ |
| `deleteMessage()` | ✅ 清理占位卡片 | ✅ (可选) | ❌ (不需要) | ❌ |
| **流式机制** | 编辑已发卡片 | AI Card 状态机 | **原生 replyStream** | final-only |
| **流式 API** | `im.message.patch` | `/card/streaming` | SDK `replyStream()` | — |
| **状态机** | 无（直接 patch） | PROCESSING→INPUTING→FINISHED | SDK 管理 | — |
| **throttle** | 2s interval + 200 char delta | 300ms + single-flight | SDK 内置 | — |

### 2.4 安全/认证

| 维度 | 飞书 (现有) | 钉钉 | 企微 Bot | 企微 Agent |
|------|:----------:|:----:|:--------:|:----------:|
| 认证凭据 | `appId` + `appSecret` | `appKey` + `appSecret` | `botId` + `secret` | `corpId` + `agentId` + `agentSecret` |
| webhook/回调验证 | verificationToken | SDK 内置 | SDK 内置 | `token` + `encodingAESKey` |
| 消息加密 | 明文 JSON | 明文 JSON | 明文 JSON | **AES-256-CBC 加密 XML** |
| Token 管理 | `FeishuTokenManager` | SDK 内置 | SDK 内置 | 自建（2h 有效期） |
| 额外安全层 | 无 | dmPolicy / allowlist | 待验证 | SHA1 签名 + CorpID 校验 |

## 3. 难度评估

| 维度 | 钉钉 | 企微 Bot | 企微 Agent |
|------|:----:|:--------:|:----------:|
| **SDK 成熟度** | `dingtalk-stream` 社区验证 ✅ | `@wecom/aibot-node-sdk` 腾讯官方 ✅ | 无统一 SDK，自建 ⚠️ |
| **协议复杂度** | 低（JSON + Stream） | 低（JSON + WebSocket） | **高**（XML + AES + 签名 + Token 管理） |
| **流式映射难度** | 中（AI Card 是新 API，需学习状态机） | **低**（原生 replyStream 最简单） | 无（final-only） |
| **需要公网 URL** | 否 ✅ | 否 ✅ | 是 ⚠️ |
| **与飞书 adapter 结构相似度** | **高** ⭐⭐⭐ | 中 ⭐⭐ | 低 ⭐ |
| **社区参考实现质量** | 高（3 个独立实现） | 中（2 个实现，1 个腾讯官方） | 中（1 个教科书级实现） |
| **预估工作量** | ⭐⭐ 中等 | ⭐ 最简单 | ⭐⭐⭐ 最复杂 |

### 与飞书相似度详解

| 飞书能力 | 钉钉对应 | 企微 Bot 对应 | 企微 Agent 对应 |
|---------|---------|-------------|---------------|
| HTTP webhook 接收事件 | Stream 接收事件（更简单） | WebSocket 接收（不同模式） | HTTP callback（类似但加了 AES） |
| `verifyEventToken` | SDK 内置（更简单） | SDK 内置 | AES 解密 + SHA1 校验（更复杂） |
| `parseEvent` → JSON 解析 | JSON 解析（几乎一样） | JSON 帧解析（类似） | XML → JSON 转换（完全不同） |
| interactive card → `sendFormattedReply` | AI Card（概念一致，API 不同） | 模板卡片（概念一致） | TextCard/News（简化版） |
| `im.message.patch` → `editMessage` | card streaming update（概念一致） | `replyStream`（原生，更简单） | ❌ 不支持 |
| `FeishuTokenManager` | SDK 内置 | SDK 内置 | 需自建 token manager |

## 4. 推荐实施顺序

### 第一优先：钉钉（Phase A）

**理由**：
1. **与飞书最像** — Stream 模式 ≈ webhook（被动接收事件），AI Card ≈ interactive card（卡片流式更新），adapter 骨架可照搬
2. **不需要公网 URL** — 开发调试最轻松
3. **JSON 全链路** — 无 XML/AES 额外复杂度
4. **社区参考最充分** — `soimy` AI Card 状态机、`largezhou` monitor patch、`DingTalk-Real-AI` 完整实现
5. **用户覆盖** — 钉钉 6 亿+用户，国内企业市占第一

### 第二优先：企微 Bot（Phase B）

**理由**：
1. **技术上最简单** — `replyStream` 原生流式，比飞书的 edit 模拟还简单
2. **但 SDK 较新** — `@wecom/aibot-node-sdk` 生态没钉钉成熟，可能踩坑
3. **不需要公网 URL** — WebSocket 长连接
4. **为 Phase C 打基础** — Bot 先跑通，Agent 做兜底

### 第三优先：企微 Agent（Phase C）

**理由**：
1. **协议完全不同** — AES/XML 是全新的世界，与飞书/钉钉/企微 Bot 都不一样
2. **需要公网 URL** — 开发环境需额外配置
3. **无流式** — final-only 降级，体验最差
4. **定位是兜底** — 主动推送、媒体补发、兼容老企业

## 5. 参考实现索引

| 平台 | 仓库 | 价值 | 对标我们的 |
|------|------|------|-----------|
| 钉钉 | [largezhou/openclaw-dingtalk](https://github.com/largezhou/openclaw-dingtalk) | 最小可用 Stream adapter | DingTalkAdapter 骨架 |
| 钉钉 | [soimy/openclaw-channel-dingtalk](https://github.com/soimy/openclaw-channel-dingtalk) ⭐⭐⭐ | AI Card 流式状态机 + 线上防呆 | `sendPlaceholder` / `editMessage` |
| 钉钉 | [DingTalk-Real-AI/dingtalk-openclaw-connector](https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector) | AI Card + Stream 完整方案 | `sendFormattedReply` |
| 企微 | [YanHaidao/wecom](https://github.com/YanHaidao/wecom) ⭐⭐⭐ | Bot + Agent 双平面架构 | WeComBotAdapter + WeComAgentAdapter 整体架构 |
| 企微 | [toboto/openclaw-wecom-channel](https://github.com/toboto/openclaw-wecom-channel) ⭐⭐⭐ | AES/XML 协议教科书 | WeComAgentAdapter 的 crypto + XML 实现 |
| 企微 | [WecomTeam/wecom-openclaw-plugin](https://github.com/WecomTeam/wecom-openclaw-plugin) | 腾讯官方 Bot 插件 | `@wecom/aibot-node-sdk` 用法 |
| 多平台 | [BytePioneer-AI/openclaw-china](https://github.com/BytePioneer-AI/openclaw-china) | 中国区多 IM 目录布局 | 文件组织参考 |
