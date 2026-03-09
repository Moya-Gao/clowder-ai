---
feature_ids: [F088]
related_features: [F050, F077, F044]
topics: [gateway, connector, feishu, slack, discord, chat-platform]
doc_kind: discussion
created: 2026-03-09
---

# F088 Multi-Platform Chat Gateway — 聊天平台接入网关

> Owner: 布偶猫 | Status: discussion
> 参考: [OpenClaw](https://github.com/openclaw/openclaw)

## Why

Cat Café 目前只能通过 Web UI 和猫猫对话。铲屎官和未来用户希望在**已有的工作聊天工具**（飞书、Slack、Discord 等）中直接与猫猫交互，不用切换窗口。

OpenClaw 项目（~98.5K LOC）提供了 25+ 平台接入的参考架构，但其定位是 single-user personal assistant，与我们的多猫协作场景不同。我们不需要复制 OpenClaw 全家桶，而是**在已有 Connector 框架上扩展双向聊天能力**。

## What

在 Cat Café 现有 Connector 体系（`ConnectorSource` → `StoredMessage` → `ReviewRouter` → `ConnectorInvokeTrigger`）基础上，增加：

1. **Outbound Adapter 层** — 把猫猫的 AgentMessage 回复到外部平台
2. **Webhook Receiver** — `/api/connectors/:connectorId/webhook` 通用入口
3. **平台 Adapter** — 首批：飞书、Slack（可并行扩展 Discord、钉钉等）
4. **Thread Mapping** — 外部对话 ID ↔ Cat Café threadId 双向映射

### 我们已有的基建（~70%）

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

### 需要新建的（~30%）

| 组件 | 复杂度 | 说明 |
|------|--------|------|
| Outbound reply 接口 + agent 回复钩子 | 中 | AgentMessage → 平台消息格式转换 + 发送 |
| Webhook receiver 路由 | 低 | 通用 webhook 入口 + 签名校验 |
| Thread mapping store | 低-中 | 外部 conversation_id ↔ threadId |
| 飞书 Adapter（`@larksuiteoapi/node-sdk`） | 中 | inbound webhook + outbound reply |
| Slack Adapter（`@slack/bolt`） | 中 | Socket Mode / Events API + reply |
| 消息格式双向转换 | 中 | Markdown ↔ Slack BlockKit / 飞书 RichText |
| 平台 Auth（OAuth / Bot Token） | 低 | 飞书 App ID+Secret / Slack Bot Token |

## 工期评估（猫猫并发速度）

### 与 OpenClaw 的核心差异

OpenClaw 用了 ~98.5K LOC 做 25+ 平台，但其中 **一半以上是 AI agent 基础设施**（我们已有）。真正的 channel adapter 层，每个平台 ~1000-2000 LOC。

### 按阶段

| 阶段 | 内容 | 猫猫天数 | 并行度 |
|------|------|---------|--------|
| **MVP** | 单渠道 DM 双向对话（飞书 or Slack） | 3-4天 | 2猫 |
| **Phase 2** | 第二渠道 + 群聊支持 + thread mapping | 3-4天 | 3猫 |
| **Phase 3** | 通用 Gateway 基座 + 配置 UI + 更多渠道 | 5-7天 | 3猫 |
| **Phase 4** | 产品化（多账号/多workspace/运维/审计） | 5-7天 | 3猫 |

**MVP 到可用：3-4 天。全量 Gateway：3-4 周。**

### 为什么不是砚砚说的"好几个月"

砚砚的评估（6-10 周）包含了"OpenClaw 级产品化"（pairing / channel policy / 多账号 / 运维安全 / 回放重试 / 配置产品化）。如果目标是 OpenClaw 的成熟度，这个估算合理。但 MVP 不需要这些——我们先做"飞书 DM + 单 owner + 能收能回"就够了。

**核心论点：我们不是从零建 Gateway，是在已跑通的 Connector 框架上加 outbound + 新 adapter。**

## Acceptance Criteria

### MVP（Phase 1）
- [ ] AC-1: 飞书/Slack 发消息 → Cat Café 收到 → 触发猫猫回复 → 回复发回飞书/Slack
- [ ] AC-2: 外部对话自动映射到 Cat Café thread
- [ ] AC-3: Webhook 签名校验通过
- [ ] AC-4: 现有 Web UI 功能不受影响

### Phase 2+
- [ ] AC-5: 群聊消息 @猫猫 → 仅 @mention 触发回复
- [ ] AC-6: 支持 2+ 平台
- [ ] AC-7: 管理员可通过 UI 配置连接器

## Dependencies

- **Evolved from**: Connector 体系（GitHub Review Watcher, F050 A2A）
- **Related**: F077 多用户安全协作（群聊场景会依赖）、F044 Channel 系统
- **External**: 飞书开放平台 App / Slack Bot Token

## Risk

1. **多用户安全模型**：群聊场景引入非 owner 用户，需要权限隔离（F077 前置）
2. **平台 API 变更**：飞书/Slack SDK 更新频率高，需要适配层
3. **消息格式损失**：复杂 rich content 在转换中可能丢失信息

## Open Questions

1. MVP 先做飞书还是 Slack？（建议飞书，铲屎官日常用）
2. 群聊是 Phase 2 还是直接跳过？
3. 是否需要消息编辑/撤回同步？

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "飞书等聊天软件的Gateway能力" | AC-1 | E2E test | [ ] |
| R2 | 消息双向通（收+回） | AC-1 | E2E test | [ ] |
| R3 | 不影响现有功能 | AC-4 | 回归测试 | [ ] |
| R4 | 并发 feat 快速交付 | — | 工期跟踪 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）
