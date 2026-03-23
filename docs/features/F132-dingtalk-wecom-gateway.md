---
feature_ids: [F132]
related_features: [F088, F077, F113]
topics: [gateway, connector, dingtalk, wecom, wechat-work, chat-platform, enterprise-im]
doc_kind: spec
created: 2026-03-22
---

# F132: DingTalk + WeCom Chat Gateway — 钉钉/企微接入

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

Cat Café 已通过 F088 建立了飞书和 Telegram 的双向 DM 通道，但国内企业级 IM 还有两个主力平台未覆盖：**钉钉**（阿里系，6 亿+用户）和**企业微信**（腾讯系，与微信互通）。三者合计覆盖国内企业即时通讯 90%+ 的份额。

铲屎官原话：*"我们需要接入钉钉和企业微信，必须复用我们的 channel 等等架构设计，学习飞书的接入"*

F088 已验证的三层架构（Principal Link / Session Binding / Command Layer）+ adapter-only-protocol 原则天然支持新平台扩展——新增 adapter 无需改动公共层。本 feature 的核心工作是：为钉钉和企微各写一个 adapter，复用 F088 全部公共基础设施。

## What

### 架构复用（零改动公共层）

```
┌─ F088 平台无关公共层（已有，不改）─────────────────────┐
│  ConnectorMessageFormatter → MessageEnvelope           │
│  ConnectorCommandLayer → /new /threads /use /where     │
│  ConnectorRouter → dedup → binding → store → invoke    │
│  OutboundDeliveryHook / StreamingOutboundHook           │
│  IConnectorThreadBindingStore (Redis)                   │
└────────────────────────────────────────────────────────┘
        ↕              ↕              ↕             ↕
  FeishuAdapter   TelegramAdapter  DingTalkAdapter  WeComAdapter
  (F088 已有)      (F088 已有)      (本 feature)    (本 feature)
```

每个新 adapter 只需实现：`parseEvent()` / `sendReply()` / `sendFormattedReply()` / `sendMedia()`。

### Phase A: DingTalk Adapter — 钉钉企业内部应用

**连接方式**：Stream 模式（钉钉官方长连接，无需公网回调 URL，与飞书 WebSocket 模式类似）。降级方案：HTTP 回调（需公网 URL + 签名验证）。

**认证**：企业内部应用 `appKey` + `appSecret` → 获取 `access_token`（2h 有效期，需自动续期）。

**入站消息处理** (`parseEvent`):
- 解析 Stream 事件 / HTTP 回调 JSON
- 支持消息类型：text、richText、picture、audio、file
- DM-only（MVP，与 F088 飞书一致）
- 回调签名校验（HTTP 模式）/ Stream 心跳维护

**出站消息发送** (`sendReply` / `sendFormattedReply`):
- 文本消息：text / markdown
- 富文本卡片：互动卡片（ActionCard）— 对标飞书 interactive card
- 图片/音频：调用钉钉媒体上传 API

**流式支持**：实现 `IStreamableOutboundAdapter`，复用 StreamingOutboundHook 的 placeholder → edit → final 模式（钉钉互动卡片支持更新）。

**SDK**：`@anthropic/dingtalk-sdk` 或 `dingtalk-stream`（钉钉官方 Stream SDK）

### Phase B: WeCom Adapter — 企业微信应用

**连接方式**：HTTP 回调（企业微信标准模式）。需配置回调 URL + Token + EncodingAESKey。

**认证**：`corpid` + 应用 `corpsecret` → 获取 `access_token`（2h 有效期）。

**安全层（WeCom 特有）**：
- 回调 URL 验证：GET 请求 echostr 解密回传
- 消息体 AES 加解密（EncodingAESKey，CBC 模式）— 所有入站事件都是加密的
- 签名校验（msg_signature + timestamp + nonce）

**入站消息处理** (`parseEvent`):
- AES 解密 → XML 解析（企微用 XML，非 JSON）
- 支持消息类型：text、image、voice、video、location、file
- DM-only（MVP）

**出站消息发送** (`sendReply` / `sendFormattedReply`):
- 文本 / markdown 消息
- 图文卡片（Text Card / News）— 对标飞书 interactive card
- 图片/语音/视频：调用企微媒体上传 API（`/cgi-bin/media/upload`）

**流式支持**：企微原生不支持消息编辑，考虑两种方案：
1. 仅发最终消息（降级，最简）
2. 连续发送 + 最后一条标记最终（体验较差，备选）

**SDK**：`@anthropic/wechat-work-sdk` 或 `@anthropic/wecom-sdk`（可自建轻量封装）

### Phase C: 跨平台富文本映射增强

统一 `MessageEnvelope` → 各平台原生卡片的映射层：

| Envelope 字段 | 飞书 (已有) | 钉钉 | 企微 |
|--------------|-------------|------|------|
| header + subtitle | Card header | ActionCard title | TextCard title |
| body (markdown) | Card body | ActionCard markdown | TextCard description |
| footer (deep link) | Card footer + URL | ActionCard single URL | TextCard URL |
| media (image) | Image card element | Picture msg | Image msg |
| media (audio) | Audio upload | Audio msg | Voice msg |

### Phase D: Bootstrap + 配置 + 文档

- `connector-gateway-bootstrap.ts` 注册新 adapter
- 环境变量：`DINGTALK_APP_KEY`、`DINGTALK_APP_SECRET`、`WECOM_CORP_ID`、`WECOM_APP_SECRET`、`WECOM_ENCODING_AES_KEY`、`WECOM_TOKEN`
- 用户文档：扩展 `docs/guides/im-platform-setup.md` 和 `docs/guides/im-usage-guide.md`

## Acceptance Criteria

### Phase A（DingTalk Adapter）
- [ ] AC-A1: 钉钉企业内部应用 DM 消息入站解析正确（text + richText）
- [ ] AC-A2: 猫猫回复通过 DingTalkAdapter 发送到钉钉（text + markdown）
- [ ] AC-A3: 互动卡片（ActionCard）正确渲染猫名 header + 正文 + deep link
- [ ] AC-A4: 流式编辑通过互动卡片 update 实现（placeholder → edits → final）
- [ ] AC-A5: 图片/音频双向收发
- [ ] AC-A6: 复用 ConnectorRouter/CommandLayer/BindingStore，公共层零改动
- [ ] AC-A7: Stream 连接断线自动重连

### Phase B（WeCom Adapter）
- [ ] AC-B1: 回调 URL 验证（echostr challenge）通过
- [ ] AC-B2: AES 消息加解密正确（入站解密 + 出站无需加密）
- [ ] AC-B3: 企微 DM 消息入站解析正确（text + image + voice）
- [ ] AC-B4: 猫猫回复通过 WeComAdapter 发送到企微（text + markdown + 图文卡片）
- [ ] AC-B5: 图片/语音双向收发
- [ ] AC-B6: 复用 ConnectorRouter/CommandLayer/BindingStore，公共层零改动

### Phase C（富文本映射）
- [ ] AC-C1: MessageEnvelope → DingTalk ActionCard 映射完整（header/body/footer/media）
- [ ] AC-C2: MessageEnvelope → WeCom TextCard 映射完整
- [ ] AC-C3: Rich blocks（card/diff/checklist）在三个新+旧平台正确降级

### Phase D（Bootstrap + 文档）
- [ ] AC-D1: connector-gateway-bootstrap 动态注册（有 env var 才启用，无则跳过）
- [ ] AC-D2: IM 接入指南文档覆盖钉钉 + 企微的配置步骤
- [ ] AC-D3: 现有飞书/Telegram 功能无回归

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "接入钉钉" | AC-A1~A7 | test + manual DM | [ ] |
| R2 | "接入企业微信" | AC-B1~B6 | test + manual DM | [ ] |
| R3 | "必须复用我们的 channel 等等架构设计" | AC-A6, AC-B6 | code review: 公共层 diff = 0 | [ ] |
| R4 | "学习飞书的接入" | AC-C1~C3 | adapter 结构对照 FeishuAdapter | [ ] |
| R5 | 参考 OpenClaw 架构 | KD-1 | 设计文档引用 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— 本 feature 无前端

## Dependencies

- **Evolved from**: F088（Multi-Platform Chat Gateway — 复用其三层架构和全部公共层）
- **Related**: F077（Multi-User Secure Collaboration — 群聊阶段需要）
- **Related**: F113（Multi-Platform One-Click Deploy — 部署配置联动）
- **External**: 钉钉开放平台企业内部应用、企业微信管理后台自建应用

## Risk

| 风险 | 缓解 |
|------|------|
| 企微消息体 XML 格式（其他平台都是 JSON） | 引入轻量 XML parser（`fast-xml-parser`），adapter 内部转 JSON 后交公共层 |
| 企微不支持消息编辑，流式体验受限 | Phase B MVP 走 final-only 降级；后续可探索模板消息 + 异步更新 |
| 钉钉 Stream SDK 成熟度 | 降级方案：HTTP 回调模式（需公网 URL，复用飞书的 Cloudflare 隧道） |
| 企业应用审核周期（钉钉/企微都需要企业管理员授权） | 文档中明确前置条件 + 开发环境配置指南 |
| 三平台卡片格式差异大，富文本映射复杂 | Phase C 统一映射层 + 平台 capability flags 标记支持度，优雅降级 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 钉钉优先用 Stream 模式还是 HTTP 回调？（Stream 更简单但较新） | ⬜ 未定 |
| OQ-2 | 企微流式体验如何解决？（不支持 editMessage） | ⬜ 未定 |
| OQ-3 | 是否需要支持钉钉/企微的群聊（Phase 7 of F088 范围）？ | ⬜ 排除（MVP DM-only） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 参考 OpenClaw Feishu 扩展的插件架构，但不引入其 ChannelPlugin 接口 | OpenClaw 无钉钉/企微实现，但其 composable adapter + capability flags 模式验证了我们 F088 的设计方向。我们的三层架构已足够，无需额外抽象层 | 2026-03-22 |
| KD-2 | adapter-only 扩展，公共层零改动 | F088 架构验证：新平台 = 新 adapter 文件 + bootstrap 注册，不改 Router/CommandLayer/BindingStore | 2026-03-22 |
| KD-3 | DM-only MVP，群聊留给 F088 Phase 7 | 与 F088 飞书/Telegram 一致的 scope 策略，群聊依赖 F077 多用户安全模型 | 2026-03-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-22 | 立项，related F088 |

## Review Gate

- Phase A: 跨 family review（缅因猫）
- Phase B: 跨 family review（缅因猫）
- Phase C+D: 可合并 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F088-multi-platform-chat-gateway.md` | 复用三层架构 |
| **Architecture** | `docs/features/assets/F088/architecture-unification.md` | 三层架构设计文档 |
| **Reference** | [OpenClaw Feishu Extension](https://github.com/openclaw/openclaw) | 插件架构参考 |
| **Adapter 参考** | `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts` | 飞书 adapter 实现（学习样板） |
| **Guide** | `docs/guides/im-platform-setup.md` | 需扩展的用户文档 |
