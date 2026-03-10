---
feature_ids: [F088]
related_features: [F050, F077, F044]
topics: [gateway, connector, feishu, telegram, slack, discord, chat-platform]
doc_kind: spec
created: 2026-03-09
---

# F088 Multi-Platform Chat Gateway — 聊天平台接入网关

> Owner: 布偶猫 | Status: Phase 1 done | Phase 2 done
> PR: [#328](https://github.com/zts212653/cat-cafe/pull/328) (Phase 1) | Phase 2 PR: TBD | Reflection: `docs/reflections/2026-03-09-f088-chat-gateway-capsule.md`
> 参考: [OpenClaw](https://github.com/openclaw/openclaw)

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
| **Phase 3** | 群聊 + 多人 + 权限隔离 | 3-4天 | 3猫 | F077 |
| **Phase 4** | 更多平台（Slack/Discord）+ OAuth + 配置 UI | 5-7天 | 3猫 | — |
| **Phase 5** | 产品化（多账号/多workspace/运维/审计） | 5-7天 | 3猫 | — |

**Phase 1+2 已完成。下一里程碑：Phase 3（群聊 + 多人）。全量 Gateway：3-4 周。**

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
- ❌ 群聊 / @mention 触发（Phase 3，依赖 F077）
- ❌ 多用户 / 权限隔离（Phase 3，依赖 F077）
- ❌ Slack / Discord / 钉钉（Phase 4）
- ❌ OAuth 自助接入 / 配置管理 UI（Phase 4）
- ❌ 多账号 / 多 workspace（Phase 5）
- ❌ 消息编辑/撤回同步（Phase 5）
- ❌ 附件/文件/图片传输
- ❌ Outbound streaming / 流式编辑同步（Phase 5）

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

### Phase 3 — 群聊 + 多人
- [ ] AC-11: 群聊消息 @猫猫 → 仅 @mention 触发回复（依赖 F077）
- [ ] AC-12: 多用户权限隔离（非 owner 用户能力边界）

### Phase 4 — 更多平台 + 自助接入
- [ ] AC-13: Slack adapter 接入
- [ ] AC-14: 支持 3+ 平台
- [ ] AC-15: 管理员可通过 UI 配置连接器
- [ ] AC-16: OAuth 自助接入流程

### Phase 5 — 产品化
- [ ] AC-17: Outbound streaming（流式输出到外部平台）
- [ ] AC-18: 多账号 / 多 workspace

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
