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
3. **平台 Adapter** — MVP 单平台（飞书 **或** Slack），后续可并行扩展 Discord、钉钉等
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

### 需要新建的（~40%，经缅因猫 review 修正）

> 原估 30% 偏乐观。Outbound 不是挂 callback 就完事，需要改造 route-serial/parallel 的 streaming 流；Thread mapping 是新真相源，不是白送的字段。

| 组件 | 复杂度 | 说明 | 修正后工期 |
|------|--------|------|-----------|
| **Outbound delivery hook** | **中-高** | **final-only**：agent 回复完成后一次性发送，不做 streaming/edit；改造 route-serial 完成回调 | 2-3天 |
| Webhook receiver 路由 | 低 | 通用 webhook 入口 + 签名校验 | 0.5天 |
| **ConnectorThreadBinding store** | **中** | 外部 conversation_id ↔ threadId，新真相源 + 去重 | 1-1.5天 |
| 飞书 Adapter（`@larksuiteoapi/node-sdk`） | 中 | inbound webhook + outbound reply | 1-2天 |
| Slack Adapter（`@slack/bolt`） | 中 | Socket Mode / Events API + reply | 1-2天 |
| 消息格式双向转换 | 中 | Markdown ↔ 飞书 RichText / Slack BlockKit | 1天 |
| 平台 Auth（MVP: 静态 token） | 低 | env 配置 bot token / app secret | 0.5天 |

## 工期评估（猫猫并发速度）

### 与 OpenClaw 的核心差异

OpenClaw 用了 ~98.5K LOC 做 25+ 平台，但其中 **一半以上是 AI agent 基础设施**（我们已有）。真正的 channel adapter 层，每个平台 ~1000-2000 LOC。

### 按阶段（经缅因猫 review 修正）

| 阶段 | 内容 | 猫猫天数 | 并行度 |
|------|------|---------|--------|
| **MVP** | 单平台 DM-only 双向对话（飞书 **或** Slack） | 5-7天 | 2猫 |
| **Phase 2** | 第二平台 + 群聊（需 F077 前置） | 3-4天 | 3猫 |
| **Phase 3** | 通用 Gateway 基座 + OAuth 自助接入 + 配置 UI + 更多渠道 | 5-7天 | 3猫 |
| **Phase 4** | 产品化（多账号/多workspace/运维/审计） | 5-7天 | 3猫 |

**MVP 到可用：5-7 天（单平台）。全量 Gateway：3-4 周。**

#### MVP Scope 硬边界（缅因猫 + 布偶猫共识）

**包含**：
- 单平台（飞书 **或** Slack，二选一）
- DM-only（私聊）
- 单 Owner（铲屎官本人）
- 静态 token（env 配置 bot token / app secret）
- 纯文本 + Markdown
- Webhook 签名校验
- 入站消息幂等去重（同一外部消息重放不触发重复 invoke，沿用 GitHub review 的 UID 去重纪律）
- 基本 thread mapping
- **Outbound = final-only**（agent 回复完成后一次性发送，不做流式/编辑同步）

**显式排除（Phase 2+）**：
- ❌ 群聊 / @mention 触发
- ❌ 多用户 / 权限隔离（依赖 F077）
- ❌ OAuth 自助接入
- ❌ 多账号 / 多 workspace
- ❌ 消息编辑/撤回同步
- ❌ 附件/文件/图片传输
- ❌ 配置管理 UI
- ❌ 第二平台
- ❌ Outbound streaming / 流式编辑同步（MVP = final-only）

### 为什么不是"好几个月"

初始评估分歧已通过 review 收敛：
- **布偶猫初始估 3-4 天** → 低估了 outbound streaming 改造 + thread mapping 新真相源
- **缅因猫初始估 6-10 周** → 口径按 OpenClaw 级产品化，scope 偏大
- **收敛共识：MVP 5-7 天，全量 3-4 周**

Outbound 不是挂 callback 就完事——需要改造 route-serial/parallel 的 streaming 流，这是首个平台最难的 50%，不是轻松的 30%。

## Acceptance Criteria

### MVP（Phase 1）— 单平台 DM-only
- [ ] AC-1: 飞书**或**Slack DM 发消息 → Cat Café 收到 → 触发猫猫回复 → 回复发回原平台
- [ ] AC-2: 外部 DM 自动映射到 Cat Café thread（ConnectorThreadBinding）
- [ ] AC-3: Webhook 签名校验通过
- [ ] AC-4: 现有 Web UI 功能不受影响
- [ ] AC-5: 入站消息幂等——同一外部消息重放不触发重复 invoke（沿用 UID 去重纪律）
- [ ] AC-6: Outbound = final-only——agent 回复完成后一次性发送到外部平台

### Phase 2+
- [ ] AC-7: 群聊消息 @猫猫 → 仅 @mention 触发回复
- [ ] AC-8: 支持 2+ 平台
- [ ] AC-9: 管理员可通过 UI 配置连接器
- [ ] AC-10: Outbound streaming（流式输出到外部平台）

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
| R2 | 消息双向通（收+回） | AC-1, AC-6 | E2E test | [ ] |
| R3 | 不影响现有功能 | AC-4 | 回归测试 | [ ] |
| R4 | 并发 feat 快速交付 | — | 工期跟踪 | [ ] |
| R5 | 入站幂等（不重复触发） | AC-5 | 重放测试 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）
