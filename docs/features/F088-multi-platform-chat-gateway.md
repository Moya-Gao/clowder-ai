---
feature_ids: [F088]
related_features: [F050, F077, F044]
topics: [gateway, connector, feishu, telegram, slack, discord, chat-platform]
doc_kind: spec
created: 2026-03-09
---

# F088 Multi-Platform Chat Gateway — 聊天平台接入网关

> Owner: 布偶猫 | Status: Phase 1-4+A+B+4fix done | Phase C next
> PR: [#328](https://github.com/zts212653/cat-cafe/pull/328) (Phase 1) | [#336](https://github.com/zts212653/cat-cafe/pull/336) (Phase 2) | Reflection: `docs/reflections/2026-03-09-f088-chat-gateway-capsule.md`
> 参考: [OpenClaw](https://github.com/openclaw/openclaw)
> 用户文档: [IM 平台接入指南](../guides/im-platform-setup.md) | [IM 使用指南](../guides/im-usage-guide.md) | [设计讨论纪要](../discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md)

## Why

Cat Café 目前只能通过 Web UI 和猫猫对话。铲屎官和未来用户希望在**已有的工作聊天工具**中直接与猫猫交互，不用切换窗口。

OpenClaw 项目（~98.5K LOC）提供了 25+ 平台接入的参考架构，但其定位是 single-user personal assistant，与我们的多猫协作场景不同。我们不需要复制 OpenClaw 全家桶，而是**在已有 Connector 框架上扩展双向聊天能力**。

## 平台选型

### 全球主要聊天平台对比

| 平台 | MAU | 主要市场 | Bot API 成熟度 | 接入难度 | 适合场景 |
|------|-----|---------|---------------|---------|---------|
| **飞书/Lark** | ~1000万+ | 中国企业 | 中-高 | 中 | 国内工作协作 |
| **Telegram** | **~10亿** | 全球（中东/东欧/东南亚/开发者圈） | **极高（最开放）** | **低** | 海外开发者/个人 |
| Slack | ~4000万 DAU | 北美/欧洲企业 | 高 | 中 | 海外企业团队 |
| Discord | ~2亿 | 北美/欧洲社区 | 高 | 低 | 开源社区/游戏 |
| WhatsApp | ~30亿 | 全球 | 中（Business API 付费） | 高 | 个人通讯 |
| 钉钉 | ~7亿注册 | 中国企业 | 中 | 中 | 国内大企业 |
| Teams | ~3.2亿 | 全球企业 | 中（Bot Framework 重） | 高 | 微软生态企业 |

### MVP 选型决策：飞书（国内）+ Telegram（海外）

**飞书**：铲屎官日常工作用，国内企业标配。
**Telegram**：
- 10 亿 MAU，海外开发者浓度最高
- Bot API 是所有平台里**最开放最简单的**——`grammY` 库几十行就能跑起来
- OpenClaw 最重度维护的也是 Telegram（450+ 文件，核心 channel），说明 AI bot 需求最强
- 不需要公网 webhook（支持 long polling），本地开发即可测试

**为什么不选 Slack**：Slack 用户量（4000万）远小于 Telegram（10亿），且偏企业场景。MVP 先覆盖最大用户池，Slack 作为后续企业场景补充（Phase 4）。

## What

在 Cat Café 现有 Connector 体系（`ConnectorSource` → `StoredMessage` → `ReviewRouter` → `ConnectorInvokeTrigger`）基础上，增加：

1. **Outbound Adapter 层** — 把猫猫的 AgentMessage 回复到外部平台
2. **Webhook Receiver** — `/api/connectors/:connectorId/webhook` 通用入口
3. **平台 Adapter** — MVP：飞书 + Telegram，后续可并行扩展 Slack、Discord、钉钉等
4. **Thread Mapping** — 外部对话 ID ↔ Cat Café threadId 双向映射

### 公共层架构原则（2026-03-10 补充）

> **能沉淀到公共层的就做成公共的，禁止每个 adapter 各做一套。**

```
┌─ 平台无关公共层 ─────────────────────────────────────┐
│                                                       │
│  ConnectorMessageFormatter                            │
│    → MessageEnvelope { header, subtitle, body, footer}│
│                                                       │
│  ConnectorCommandLayer                                │
│    → /new /threads /use /where /link 命令解析          │
│                                                       │
│  IConnectorThreadBindingStore (Redis)                 │
│    → Principal Link + Session Binding + recent threads│
│                                                       │
│  ConnectorRouter                                      │
│    → 入站路由：dedup → binding → store → invoke       │
│                                                       │
│  OutboundDeliveryHook                                 │
│    → 出站路由：thread → binding → adapter.send        │
│                                                       │
└───────────────────────────────────────────────────────┘
          ↕                    ↕                ↕
   FeishuAdapter        TelegramAdapter    SlackAdapter
   (仅平台协议)          (仅平台协议)      (仅平台协议)
```

每个 Adapter 只做三件事：
1. **parseEvent** — 把平台 webhook 转成统一 `InboundMessage`
2. **formatMessage(envelope)** — 把 `MessageEnvelope` 转成平台格式（飞书 card / Telegram MarkdownV2 / Slack blocks）
3. **sendMessage** — 调平台 API 发送

所有业务逻辑（thread 管理、命令解析、消息格式生成、binding 持久化）都在公共层。

### 我们已有的基建（~60%）

| 组件 | 状态 | 文件 |
|------|------|------|
| ConnectorSource 类型 + 注册表 | ✅ 已有 | `packages/shared/src/types/connector.ts` |
| StoredMessage.source 集成 | ✅ 已有 | `MessageStore.ts` |
| 3 层路由（tracking → tag → triage） | ✅ 已有 | `ReviewRouter.ts` |
| 自动触发 agent + 队列/优先级 | ✅ 已有 | `ConnectorInvokeTrigger.ts` |
| WebSocket 广播 connector_message | ✅ 已有 | `SocketManager.ts` |
| UID/PR 级去重 | ✅ 已有 | `ProcessedEmailStore.ts` |
| Agent 路由全流程 | ✅ 已有 | `AgentRouter.ts` |
| GitHub Review Watcher（参考实现） | ✅ 已有 | `GithubReviewWatcher.ts` |

### 需要新建的（~40%，经缅因猫 review 修正）

> 原估 30% 偏乐观。Outbound 不是挂 callback 就完事，需要基于现有 streaming pipeline 挂 final-only outbound hook；Thread mapping 是新真相源，不是白送的字段。

| 组件 | 复杂度 | 说明 | 修正后工期 |
|------|--------|------|-----------|
| **Outbound delivery hook** | **中-高** | **final-only**：agent 回复完成后一次性发送，不做 streaming/edit；基于 route-serial 完成回调 | 2-3天 |
| Webhook receiver 路由 | 低 | 通用 webhook 入口 + verification token 校验 | 0.5天 |
| **ConnectorThreadBinding store** | **中** | 外部 conversation_id ↔ threadId，新真相源 + 去重 | 1-1.5天 |
| 飞书 Adapter（`@larksuiteoapi/node-sdk`） | 中 | inbound webhook + outbound reply | 1-2天 |
| Telegram Adapter（`grammy`） | **低-中** | long polling inbound + Bot API outbound（最简单的平台 SDK） | 1天 |
| 消息格式双向转换 | 中 | Markdown ↔ 飞书 RichText / Telegram MarkdownV2 | 1天 |
| 平台 Auth（MVP: 静态 token） | 低 | env 配置 bot token / app secret | 0.5天 |

## 工期评估（猫猫并发速度）

### 与 OpenClaw 的核心差异

OpenClaw 用了 ~98.5K LOC 做 25+ 平台，但其中 **一半以上是 AI agent 基础设施**（我们已有）。真正的 channel adapter 层，每个平台 ~1000-2000 LOC。

### 按阶段（经缅因猫 review 修正 + 铲屎官 Phase 2 优先级调整）

| 阶段 | 内容 | 猫猫天数 | 并行度 | 前置 |
|------|------|---------|--------|------|
| **Phase 1 (MVP)** ✅ | 飞书 + Telegram DM-only 双向对话 | **完成** | — | — |
| **Phase 2** ✅ | 多猫身份 + 分角色展示 + 外部 @路由 | **完成** | — | — |
| **Phase 3** ✅ | 富文本卡片（rich block → 飞书 card / Telegram formatted） | **完成** | — | — |
| **Phase A** ✅ | ISSUE-1 修复：消息格式化 + DEFAULT_OWNER_USER_ID + Redis binding 持久化 | **完成** | — | — |
| **Phase B** ✅ | IM 命令集 `/new /threads /use /where` + activeThread + deep link | **完成** | — | — |
| **Phase 4** ✅ | 消息编辑模拟流式（placeholder → rate-limited edits → final） | **完成** | — | — |
| **Phase 5** | 图片/文件收发（双向：接收用户图片 + 发送猫的图片） | 2-3天 | 1猫 | — |
| **Phase 6** | 语音消息（接收语音 → STT → 猫处理 → TTS → 发送语音） | 4-5天 | 1猫 | 外部 STT/TTS |
| **Phase 7** | 群聊 + 多人 + 权限隔离 | 3-4天 | 3猫 | F077 |
| **Phase 8** | 更多平台（Slack/Discord）+ OAuth + 配置 UI | 5-7天 | 3猫 | — |
| **Phase 9** | 产品化（多账号/多workspace/运维/审计） | 5-7天 | 3猫 | — |

**Phase 1+2+3+A+B+4 已完成。下一里程碑：Phase 5（图片）→ 6（语音）→ 7（群聊）。**

#### Phase 2 详细拆解（多猫身份 + 分角色展示）

铲屎官明确要求：先让外部平台能看到"三只猫各自在说话"，再做群聊/多人。

| 子项 | 说明 | 复杂度 |
|------|------|--------|
| **外部 @路由** | 外部消息 `@布偶` / `@缅因` → 路由到指定猫（而非 defaultCatId） | 中 |
| **多猫身份映射** | 每只猫在外部平台的显示名/头像（可能需要多 bot 或消息前缀 `[布偶猫🐱]`） | 中 |
| **分角色展示** | 多猫接力时，外部看到分角色对话（而非一个 bot 说所有话） | 中-高 |
| **outbound 按猫路由** | OutboundDeliveryHook 区分是哪只猫的回复，标注身份后发送 | 低-中 |

> 平台限制：飞书/Telegram 单 bot 只有一个身份。分角色展示的实现方案需要探索：
> - 方案 A：消息前缀 `[布偶猫🐱]` / `[缅因猫🐱]`（最简单，单 bot）
> - 方案 B：多个 bot 各自回帖（每只猫一个 bot token，最真实但配置重）
> - 方案 C：Telegram 用 `sendMessage` 不同 `parse_mode` + 签名行；飞书用 rich text 卡片头部区分
>
> 需要在 Phase 2 kickoff 时做 Design Gate 选型。

#### MVP Scope 硬边界（缅因猫 + 布偶猫共识，铲屎官确认双平台）

**包含**：
- 双平台：飞书（国内）+ Telegram（海外）
- DM-only（私聊）
- 单 Owner（铲屎官本人）
- 静态 token（env 配置 bot token / app secret）
- 纯文本 + Markdown
- 飞书 webhook verification token 校验（fail-closed）/ Bot API auth（Telegram）
- 入站消息幂等去重（同一外部消息重放不触发重复 invoke，沿用 GitHub review 的 UID 去重纪律）
- 基本 thread mapping（ConnectorThreadBinding）
- **Outbound = final-only**（agent 回复完成后一次性发送，不做流式/编辑同步）

**显式排除（后续 Phase）**：
- ✅ ~~多猫身份映射 / 分角色展示 / 外部 @路由~~ — **Phase 2 已完成**
- 🚧 富文本卡片 rich block → card 映射（Phase 3，进行中）
- 🚧 消息编辑模拟流式（Phase 4）
- 🚧 图片/文件收发（Phase 5）
- 🚧 语音消息 STT/TTS（Phase 6）
- ❌ 群聊 / @mention 触发（Phase 7，依赖 F077）
- ❌ 多用户 / 权限隔离（Phase 7，依赖 F077）
- ❌ Slack / Discord / 钉钉（Phase 8）
- ❌ OAuth 自助接入 / 配置管理 UI（Phase 8）
- ❌ 多账号 / 多 workspace（Phase 9）

### 为什么不是"好几个月"

初始评估分歧已通过 review 收敛：
- **布偶猫初始估 3-4 天** → 低估了 outbound 改造 + thread mapping 新真相源
- **缅因猫初始估 6-10 周** → 口径按 OpenClaw 级产品化，scope 偏大
- **收敛共识：双平台 MVP 7-9 天，全量 3-4 周**

Outbound 不是挂 callback 就完事——需要基于现有 streaming pipeline 挂 final-only hook，这是首个平台最难的 50%，不是轻松的 30%。但第二个平台（Telegram）边际成本低，因为共享基座。

## Acceptance Criteria

### MVP（Phase 1）— 飞书 + Telegram DM-only
- [x] AC-1: 飞书 DM 发消息 → Cat Café 收到 → 触发猫猫回复 → 回复发回飞书 (integration test)
- [x] AC-2: Telegram DM 发消息 → Cat Café 收到 → 触发猫猫回复 → 回复发回 Telegram (integration test)
- [x] AC-3: 外部 DM 自动映射到 Cat Café thread（ConnectorThreadBinding）(7 + 6 unit tests)
- [x] AC-4: 飞书 webhook verification token 校验（fail-closed: 未配置则拒绝启动）/ Bot API auth 通过（Telegram）(adapter tests)
- [ ] AC-5: 现有 Web UI 功能不受影响 (regression pending)
- [x] AC-6: 入站消息幂等——同一外部消息重放不触发重复 invoke（integration test）
- [x] AC-7: Outbound = final-only——agent 回复完成后一次性发送到外部平台 (wired in trigger)

### Phase 2 — 多猫身份 + 分角色展示
- [x] AC-8: 外部消息 `@布偶` / `@缅因` → 路由到指定猫（parseMentions + ConnectorRouter, 11+9 unit tests）
- [x] AC-9: 外部回帖标明是哪只猫在说话（方案 A: 消息前缀 `[布偶猫🐱]`，8 unit tests）
- [x] AC-10: 多猫接力时，外部看到分角色对话（ConnectorInvokeTrigger 传透 catId → OutboundDeliveryHook 前缀，3 integration tests）

### Phase 3 — 富文本卡片（rich block → platform card）
- [x] AC-11: Cat Café rich block（check-in card、audio reminder 等）→ 飞书消息卡片 JSON（interactive card）— feishu-card-formatter + FeishuAdapter.sendRichMessage, 8 tests
- [x] AC-12: Cat Café rich block → Telegram formatted message（HTML parse_mode）— telegram-html-formatter + TelegramAdapter.sendRichMessage, 9 tests
- [x] AC-13: OutboundDeliveryHook 自动检测 rich block 类型，选择纯文本降级 or 卡片格式 — IOutboundAdapter.sendRichMessage? dispatch, 12 tests
- [ ] AC-14: 飞书卡片支持按钮交互回调（card action callback → ConnectorRouter）— deferred to Phase 3b

### Phase A — ISSUE-1 修复（消息格式化 + 前端可见 + Redis 持久化）
- [x] AC-A1: ConnectorMessageFormatter 生成平台无关 MessageEnvelope（header/subtitle/body/footer），6 tests
- [x] AC-A2: FeishuAdapter.sendFormattedReply 渲染为飞书交互卡片（蓝色 header + markdown body），3 tests
- [x] AC-A3: DEFAULT_OWNER_USER_ID 配置 → connector threads 用真实 userId 创建 → 前端可见，2 tests
- [x] AC-A4: OutboundDeliveryHook threadMeta — best-effort 2s timeout + late rejection guard，3 tests
- [x] AC-A5: RedisConnectorThreadBindingStore — Lua 原子 bind + 防御性 getByThread 自愈 + 重启不丢绑定，11 tests
- [x] AC-A6: IConnectorThreadBindingStore async-compatible interface（T | Promise<T>），ConnectorRouter + OutboundDeliveryHook await

### Phase B — IM 命令层 + activeThread
- [x] AC-B1: ConnectorCommandLayer 解析 `/new` `/threads` `/use <id>` `/where` 命令，返回结构化 CommandResult — 12 unit tests
- [x] AC-B2: `/new` 创建新 thread 并切换 activeThread binding — ConnectorCommandLayer.handleNew + bind
- [x] AC-B3: `/threads` 列出当前用户最近 N 个 thread — listByUser (Memory + Redis ZADD/ZREVRANGE), 3 Redis tests
- [x] AC-B4: `/use <id>` 切换 activeThread 到指定 thread — prefix match + rebind
- [x] AC-B5: `/where` 显示当前绑定的 thread 信息 + deep link
- [x] AC-B6: ConnectorRouter 集成 CommandLayer — `/` 开头走命令路径，否则正常对话路径, 4 router tests
- [x] AC-B7: 出站回复带 deep link（前端 URL，threadMetaLookup 返回 deepLinkUrl）— wired in index.ts
- [x] AC-B8: 命令响应包含中文 UX + deep link + thread 短 ID

### Phase 4 — 消息编辑模拟流式
- [x] AC-15: agent 开始处理时发送"思考中..."占位消息 — StreamingOutboundHook.onStreamStart, 2 tests
- [x] AC-16: agent streaming 过程中，定期 patch/edit 占位消息更新内容（飞书 `im.message.patch` / Telegram `editMessageText`）— onStreamChunk rate-limited, 3 tests
- [x] AC-17: agent 完成后最终更新为完整回复 — onStreamEnd removes cursor indicator, 2 tests
- [x] AC-18: 编辑频率限流（2s interval + 200 char delta，避免触发平台 rate limit）— configurable thresholds, 1 test

### Phase 5 — 图片/文件收发
- [ ] AC-19: 接收用户发送的图片消息（飞书 image / Telegram photo）→ 下载 → 存储 → 传递给猫
- [ ] AC-20: 接收用户发送的文件消息 → 下载 → 传递给猫
- [ ] AC-21: 猫的回复包含图片时 → 上传到平台 → 发送图片消息（飞书 `im.image.create` / Telegram `sendPhoto`）

### Phase 6 — 语音消息
- [ ] AC-22: 接收用户语音消息 → 下载音频 → STT 转文字 → 作为文本消息传给猫
- [ ] AC-23: 猫的文字回复 → TTS 合成语音 → 上传 → 发送语音消息到外部平台
- [ ] AC-24: STT/TTS 服务可配置（支持多个 provider：Whisper / Azure / 讯飞等）

### Phase 7 — 群聊 + 多人
- [ ] AC-25: 群聊消息 @猫猫 → 仅 @mention 触发回复（依赖 F077）
- [ ] AC-26: 多用户权限隔离（非 owner 用户能力边界）

### Phase 8 — 更多平台 + 自助接入
- [ ] AC-27: Slack adapter 接入
- [ ] AC-28: 支持 3+ 平台
- [ ] AC-29: 管理员可通过 UI 配置连接器
- [ ] AC-30: OAuth 自助接入流程

### Phase 9 — 产品化
- [ ] AC-31: 多账号 / 多 workspace
- [ ] AC-32: 运维监控 + 审计日志

## Dependencies

- **Evolved from**: Connector 体系（GitHub Review Watcher, F050 A2A）
- **Related**: F077 多用户安全协作（群聊场景会依赖）、F044 Channel 系统
- **External**: 飞书开放平台 App（App ID + App Secret）、Telegram Bot（@BotFather 创建，Bot Token）

## Risk

1. **多用户安全模型**：群聊场景引入非 owner 用户，需要权限隔离（F077 前置，MVP 不碰）
2. **平台 API 变更**：飞书/Telegram SDK 更新频率，需要适配层
3. **消息格式损失**：复杂 rich content 在转换中可能丢失信息

## Open Questions

1. ~~MVP 先做飞书还是 Slack？~~ → **已决定：飞书 + Telegram**
2. ~~群聊是 Phase 2 还是直接跳过？~~ → **已决定：Phase 3（F077 前置）**
3. ~~多猫外显策略采用哪种默认方案：前缀签名 / 多 bot / rich card？~~ → **已决定：方案 A（消息前缀 `[布偶猫🐱]`），最简单、跨平台兼容、单 bot**
4. 是否需要消息编辑/撤回同步？（当前排除到 Phase 5）

## Known Issues（2026-03-09 飞书实测发现）

### ISSUE-1: Connector 消息不走 GitHub 管道，前端不可见 — ✅ RESOLVED

**解决方案（Phase A，PR #344 + #346）**：
- `ConnectorMessageFormatter` — 平台无关 `MessageEnvelope { header, subtitle, body, footer }`
- `FeishuAdapter.sendFormattedReply()` — 渲染为飞书交互卡片
- `DEFAULT_OWNER_USER_ID` — connector threads 用真实 userId 创建，前端自然可见
- `RedisConnectorThreadBindingStore` — Lua 原子 bind + 防御性 getByThread 自愈，重启不丢绑定
- `OutboundDeliveryHook` threadMeta — best-effort 2s timeout + late rejection guard

**设计方向**（2026-03-10 布偶猫+缅因猫讨论收敛，详见 `docs/discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md`）：

核心结论：**统一的是 Cat Café thread/message core，不是 GitHub transport**。GitHub 也是 connector。

三层架构：
1. **Principal Link**: `connector + externalSenderId → internalUserId`（解决"IM 用户是谁"）
2. **Session Binding**: `connector + externalChatId → activeThreadId` + recent threads（解决"当前指向哪个 thread"）
3. **Command Layer**: 平台无关的 `/new /threads /use /where /link`（解决"IM 侧如何管理 thread"）

分期：
- **Phase A** ✅: `DEFAULT_OWNER_USER_ID` 单 owner bootstrap + Redis 持久化 + 前端自然可见（PR #344 + #346）
- **Phase B** ✅: IM 命令集 `/new /threads /use /where` + activeThread + deep link（PR #349）
- **Phase 4-fix** ✅: StreamingOutboundHook 接入调用链 + 命令回复走 MessageEnvelope（愿景守护 P1+P2 修复，PR #350）
- **Phase C**: 架构归一 — 全链路统一管道 + `/link` 正式绑定 + 跨平台 thread 视图

否决：不做自动按话题分 thread；不把 IM 事件绕回 GitHub transport

### 铲屎官愿景：架构归一（2026-03-10 明确要求）

> **所有消息（包括命令回复）都要走统一管道（cat-cafe-collab / GitHub channel），架构要归一！**

核心原则：
1. **connector 不是独立闭环** — 所有 IM 入站/出站消息必须经过统一管道，前端可见，铲屎官能看到完整 thread
2. **命令回复也是消息** — `/new /threads /use /where` 的响应不能绕过 MessageEnvelope 直接 `adapter.sendReply()`
3. **streaming 也是消息** — StreamingOutboundHook 的 placeholder / edit 也应走统一出站链路
4. **thread 是核心，平台是入口** — 用户在飞书看到的 thread 和在 Telegram、前端看到的是同一个，`/threads` 应展示全局视图而非 connector-scoped

Phase C 架构目标：
- `ConnectorRouter` 入站 → 写入统一 message store → 前端自然可见
- `OutboundDeliveryHook` 出站 → 所有响应（agent 回复 / 命令回复 / streaming）走同一链路
- `/threads` `/use` 基于全局 `threadStore.list(userId)` 而非 `bindingStore.listByUser(connectorId, userId)`
- 任何新平台接入只需实现 adapter 协议，业务逻辑零拷贝

### ISSUE-2: Cloudflare Access 与 Tunnel ingress 路径冲突

**现象**：`cafe.clowder-ai.com` 配了 Cloudflare Access 保护，webhook 请求被 302 到登录页。创建 path-scoped bypass Application 后，请求不再 302 但被路由到了前端（3001）而非 API（3002），疑似 Access Application 与 tunnel ingress 规则冲突。

**临时方案**：飞书 webhook URL 使用 `api.clowder-ai.com`（无 Access 保护的备用子域名），webhook 安全性靠应用层 verification token。

**长期方案**：排查 `cafe.clowder-ai.com` 的 Access bypass + tunnel ingress 共存问题，统一为单域名。

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "飞书等聊天软件的Gateway能力" | AC-1, AC-2 | E2E test | [x] |
| R2 | 消息双向通（收+回） | AC-1, AC-2, AC-7 | E2E test | [x] |
| R3 | "来个海外的" — Telegram | AC-2 | E2E test | [x] |
| R4 | 不影响现有功能 | AC-5 | 回归测试 | [ ] |
| R5 | 并发 feat 快速交付 | — | 工期跟踪 | [x] |
| R6 | 入站幂等（不重复触发） | AC-6 | 重放测试 | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（不适用——F088 MVP 无前端改动）
