---
feature_ids: [F137]
related_features: [F088, F132]
topics: [gateway, connector, weixin, wechat, personal-im, ilink-bot, chat-platform]
doc_kind: spec
created: 2026-07-19
---

# F137: WeChat Personal Gateway — 微信个人号 iLink Bot 接入

> **Status**: in-progress | **Owner**: 金渐层 | **Priority**: P1
>
> **分工**：金渐层（@opencode）实现 → 砚砚（@codex）review → 布偶猫（@opus）愿景守护
> 实现过程中不 @ 布偶猫，保持 owner 上下文干净。每个 Phase PR merge 后触发愿景守护。

## Why

F088 + F132 覆盖了**企业级 IM**（飞书、Telegram、钉钉、企业微信），但铲屎官的个人微信——12 亿用户量级的国民级 IM——一直无法接入。2026 年 7 月，腾讯微信正式开放 **iLink Bot 协议**（灰度中），允许个人微信号直接与 AI Bot 交互（扫码登录、长轮询收消息、HTTP 发消息），无需企业资质、无需公网 URL、无需 XML/AES 加解密。

铲屎官原话：*"那我们是不是可以学习 @tencent-weixin/openclaw-weixin 这个的实现模式！把我们的猫猫接入微信！！？"*

铲屎官原话：*"你也得复用那些基础设施，就不要自己做一套"*

铲屎官原话：*"如果这个有配置需要配置，有配置哈，我们也在得在那边能够显示我们的这个配置才可以"*（指 IM Hub 配置向导）

铲屎官确认已被灰度到 ClawBot（iLink Bot）功能。

**为什么独立于 F132**：F132 是**企业微信**（WeCom），走 WebSocket SDK / HTTP callback + AES/XML；F137 是**个人微信**，走 iLink Bot HTTP 长轮询，协议、认证、能力完全不同。两者平行但互不依赖。

## What

### 架构复用（零改动公共层）

```
┌─ F088 平台无关公共层（已有，不改）──────────────────────────┐
│  ConnectorMessageFormatter → MessageEnvelope               │
│  ConnectorCommandLayer → /new /threads /use /where         │
│  ConnectorRouter → dedup → binding → store → invoke        │
│  OutboundDeliveryHook / StreamingOutboundHook               │
│  IConnectorThreadBindingStore (Redis)                       │
└─────────────────────────────────────────────────────────────┘
      ↕            ↕            ↕            ↕            ↕
 FeishuAdapter  TelegramAd.  DingTalkAd.  WeixinAdapter  (F132 WeCom)
 (F088 已有)    (F088 已有)   (F132 done)  ← 本 Feature
```

新增 `WeixinAdapter` 实现 `IOutboundAdapter`，通过 duck typing 自动发现能力。连接方式为 **HTTP 长轮询**（类似 Telegram），无需 webhook、无需公网 URL。

### iLink Bot 协议要点

| 维度 | 说明 |
|------|------|
| **认证** | 扫码登录 → 获取 `bot_token`，无需企业资质 |
| **入站** | `POST /ilink/bot/getupdates`（35s 长轮询），JSON 格式 |
| **出站** | `POST /ilink/bot/sendmessage`，需要 `context_token`（从入站消息获取） |
| **会话** | `context_token` 是 per-(account, user) 的，必须缓存 |
| **断线** | `errcode -14` = session 过期，需重新扫码登录 |
| **媒体** | CDN 上传/下载，AES-128-ECB 加密，PKCS7 padding |
| **输入状态** | `POST /ilink/bot/sendtyping`（需 `typing_ticket`） |
| **消息限制** | 单条 2000 字符，超长需分块发送 |
| **Auth Header** | `AuthorizationType: ilink_bot_token` + `Authorization: Bearer <token>` + `X-WECHAT-UIN: <random>` |

### Phase A: 文本双向 — 扫码登录 + 收发文本消息 ✅

**连接方式**：HTTP 长轮询（`getupdates`，35s timeout）。

**认证流程**：
1. `GET /ilink/bot/get_bot_qrcode?bot_type=3` → 获取 QR code URL
2. 用户用微信扫码
3. `GET /ilink/bot/get_qrcode_status?qrcode=...` → 轮询状态 → 获取 `bot_token`
4. 持久化 `bot_token` 到 Redis

**入站** (`parseEvent`):
- `getupdates` 长轮询解析
- 文本消息类型处理
- `get_updates_buf` 游标持久化（Redis）
- 消息类型映射到 `ConnectorRouter` 标准格式

**出站** (`sendReply`):
- `sendmessage` + `context_token` 缓存（per user）
- 2000 字符限制 + 自动分块
- `message_state: 2 (FINISH)` 固定值

**Bootstrap**：
- `connector-gateway-bootstrap.ts` 条件注册（`WEIXIN_BOT_TOKEN` env var）
- 启动轮询循环

**Connector 注册**：
- `packages/shared/src/types/connector.ts` 新增 `'weixin'` ConnectorDefinition
- 绿色主题（微信品牌色 `#07C160`）

### Phase B: 输入状态 + 媒体收发

**输入状态**：
- `POST /ilink/bot/getconfig` 获取 `typing_ticket`
- `POST /ilink/bot/sendtyping` 显示"对方正在输入中"
- 在 agent 处理期间持续发送 typing（interval timer）

**媒体收发**：
- `sendMedia`: `getuploadurl` → CDN 上传（AES-128-ECB 加密）
- 入站图片: CDN 下载 → AES-128-ECB 解密
- 实现 `sendMedia?(externalChatId, payload)` 接口

### Phase C: IM Hub 配置向导 + 健壮性

**IM Hub 集成**：
- 扩展 IM Hub 配置向导 UI，添加微信个人号配置流程
- QR 码展示 + 扫码状态实时反馈
- Bot token 状态显示（已连接 / 已过期 / 未配置）

**健壮性**：
- Session 过期检测（`errcode -14`）→ 自动提醒重新扫码
- 长轮询断线重连 + 指数退避
- 幂等去重（复用 F088 `InboundMessageDedup`）
- 多账号支持预留（当前 MVP 单账号）

## Acceptance Criteria

### Phase A（文本双向）
- [x] AC-A1: 扫码登录流程完整（获取 QR → 扫码 → 获取 bot_token → 持久化）
- [x] AC-A2: 微信个人号 DM 消息入站解析正确（文本消息）
- [x] AC-A3: 猫猫回复通过 WeixinAdapter 发送到微信（文本，含 context_token 缓存）
- [x] AC-A4: 长消息自动分块（>2000 字符）
- [x] AC-A5: 复用 ConnectorRouter/CommandLayer/BindingStore，公共层零改动
- [ ] AC-A6: /new /threads /use /where 命令在微信内正常工作
- [x] AC-A7: `connector.ts` 新增 `'weixin'` ConnectorDefinition，前端 bubble 正确渲染

### Phase B（输入状态 + 媒体）
- [ ] AC-B1: agent 处理期间微信显示"对方正在输入中"
- [ ] AC-B2: 图片发送到微信（CDN 上传 + AES-128-ECB 加密）
- [ ] AC-B3: 图片从微信接收（CDN 下载 + AES-128-ECB 解密）
- [ ] AC-B4: `sendMedia` 接口实现正确

### Phase C（IM Hub + 健壮性）
- [ ] AC-C1: IM Hub 配置向导可添加微信个人号（QR 展示 + 扫码流程）
- [ ] AC-C2: Session 过期（errcode -14）自动检测 + 提醒重新扫码
- [ ] AC-C3: 长轮询断线自动重连 + 指数退避
- [ ] AC-C4: 幂等去重（InboundMessageDedup 复用）
- [ ] AC-C5: 现有飞书/Telegram/钉钉功能无回归

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "把我们的猫猫接入微信" | AC-A1~A7 | test + manual DM | [ ] |
| R2 | "你也得复用那些基础设施，就不要自己做一套" | AC-A5, AC-C4 | code review: 公共层 diff = 0 | [ ] |
| R3 | "也得接入我们的消息管线，都得是一样的" | AC-A5, AC-A6 | /new /threads /use /where 可用 | [ ] |
| R4 | "如果有配置需要配置...在那边能够显示" | AC-C1 | IM Hub 配置向导可见 | [ ] |
| R5 | "按照我们的开发速度，不需要一天" | Phase A 优先 | Phase A 独立可用 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— Phase C IM Hub 需要

## Dependencies

- **Evolved from**: F088（Multi-Platform Chat Gateway — 复用其三层架构和全部公共层）
- **Related**: F132（DingTalk + WeCom — 姐妹 feature，企业微信 vs 个人微信）
- **External**: 腾讯微信 iLink Bot 协议（灰度阶段，铲屎官已获权限）

## Risk

| 风险 | 缓解 |
|------|------|
| iLink Bot 仍在灰度，API 可能变动 | 协议层薄封装，变动只影响 adapter 内部；社区 `epiral/weixin-bot` 有完整 protocol spec 可参考 |
| `bot_token` 有效期不确定，可能频繁过期 | Session 过期检测 + IM Hub 一键重新扫码 |
| 微信对 Bot 消息频率可能有限制 | 实现发送 rate limiter + 队列化 |
| CDN 媒体 AES-128-ECB 加解密 | Node.js 原生 `crypto` 模块，参考 `epiral/weixin-bot` protocol spec |
| 灰度取消或协议大改 | Phase A 文本双向先跑通验证，低投入高价值 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | bot_token 有效期多长？是否需要定期刷新？ | ⬜ 未定（实测确认） |
| OQ-2 | 是否支持流式回复（typing_status 模拟 vs 真流式）？ | ✅ 不支持真流式（`message_state: GENERATING` 在 bot 窗口无效），用 typing + final 发送 |
| OQ-3 | 多账号支持是否需要？ | ⬜ MVP 单账号，多账号 Phase C 预留 |
| OQ-4 | 语音/视频/文件消息支持？ | ⬜ 排入后续 Phase（协议已文档化） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 独立 Feature（不合入 F132） | 个人微信 vs 企业微信：协议（iLink HTTP vs WS/callback）、认证（扫码 vs appKey）、能力完全不同 | 2026-07-19 |
| KD-2 | 直接实现 iLink 协议，不引入 `weixin-agent-sdk` | SDK 太薄（仅封装 fetch），我们需要完整控制长轮询生命周期 + ConnectorRouter 集成 | 2026-07-19 |
| KD-3 | 仅实现 `IOutboundAdapter`，不实现 `IStreamableOutboundAdapter` | iLink Bot 不支持消息编辑/流式更新，`message_state: GENERATING` 在 bot 窗口无效。用 typing 状态 + final 发送 | 2026-07-19 |
| KD-4 | adapter-only 扩展，公共层零改动 | F088/F132 已验证，duck typing 能力发现天然支持 | 2026-07-19 |
| KD-5 | Phase A 优先文本双向，媒体和 IM Hub 放后续 Phase | 铲屎官期望快速可用（"两小时后就能用"），文本覆盖 90% 日常场景 | 2026-07-19 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-07-19 | 调研 `@tencent-weixin/openclaw-weixin` 包 + iLink Bot 协议完整分析 |
| 2026-07-19 | 立项 F137，related F088/F132 |
| 2026-07-19 | Phase A 实现 + 砚砚 review 放行 + 云端 review 通过 → PR #687 squash merge (2cba337b) |
| 2026-07-20 | Hotfix: QR field name + string status + long-poll timeout → PR #688 squash merge (73af3e0a) |
| 2026-07-20 | Alpha 实测发现 iLink 协议字段不匹配（`msgs` not `messages`、`item_list` 嵌套结构、`msg` wrapper 等） |
| 2026-07-24 | iLink 协议对齐 + 空语音 fallback 修复 → PR #691 砚砚放行 + 云端 review 通过 → squash merge (e5180ad5) |

## Review Gate

- Phase A: 跨 family review（砚砚 @codex）
- Phase B: 跨 family review（砚砚 @codex）— AES 加解密需额外审查
- Phase C: 前端走 Design Gate（IM Hub 配置向导 UX → 铲屎官确认）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F088-multi-platform-chat-gateway.md` | 复用三层架构 |
| **Related** | `docs/features/F132-dingtalk-wecom-gateway.md` | 姐妹 feature（企业微信） |
| **Adapter 参考** | `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts` | 飞书 adapter 实现（学习样板） |
| **协议参考** | [epiral/weixin-bot protocol-spec.md](https://github.com/epiral/weixin-bot/blob/main/docs/protocol-spec.md) | iLink Bot 完整协议文档（1293 行） |
| **SDK 参考** | [wong2/weixin-agent-sdk](https://github.com/wong2/weixin-agent-sdk) | 社区提取的 SDK（736⭐） |
| **官方包** | [@tencent-weixin/openclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin) | 腾讯官方 npm 包（MIT，50K+ weekly） |
| **社区实现** | [HenryXiaoYang/wechat-openclaw-channel](https://github.com/HenryXiaoYang/wechat-openclaw-channel) | 社区 OpenClaw 接入（545⭐） |
| **Guide** | `docs/guides/im-platform-setup.md` | 需扩展的用户文档 |
