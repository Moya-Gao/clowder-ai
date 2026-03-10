---
feature_ids: [F088]
related_features: [F050, F077, F044]
topics: [gateway, connector, feishu, telegram, slack, discord, chat-platform]
doc_kind: spec
created: 2026-03-09
---

# F088 Multi-Platform Chat Gateway — 聊天平台接入网关

> Owner: 布偶猫 | Status: Phase 1-4+A+B+C done, Phase 5 next
> 参考: [OpenClaw](https://github.com/openclaw/openclaw) | 用户文档: [IM 接入指南](../guides/im-platform-setup.md) · [IM 使用指南](../guides/im-usage-guide.md)
> Reflection: `docs/reflections/2026-03-09-f088-chat-gateway-capsule.md`

## Why

Cat Café 目前只能通过 Web UI 和猫猫对话。铲屎官和未来用户希望在**已有的工作聊天工具**中直接与猫猫交互，不用切换窗口。

MVP 选型：**飞书**（国内企业）+ **Telegram**（海外开发者）。选型细节见 [平台选型参考](assets/F088/platform-selection.md)。

## What

在 Cat Café 现有 Connector 体系上增加双向聊天能力：

```
┌─ 平台无关公共层 ─────────────────────────────────────┐
│  ConnectorMessageFormatter → MessageEnvelope          │
│  ConnectorCommandLayer → /new /threads /use /where    │
│  ConnectorRouter → dedup → binding → store → invoke   │
│  OutboundDeliveryHook / StreamingOutboundHook          │
│  IConnectorThreadBindingStore (Redis)                  │
└───────────────────────────────────────────────────────┘
        ↕                    ↕                ↕
  FeishuAdapter        TelegramAdapter    SlackAdapter
  (仅平台协议)          (仅平台协议)      (仅平台协议)
```

**原则**：能沉淀到公共层的就做成公共的，adapter 只做 parseEvent / formatMessage / sendMessage。所有业务逻辑在公共层。

**核心架构（三层结构）**：
1. **Principal Link**: `connector + externalSenderId → internalUserId`
2. **Session Binding**: `connector + externalChatId → activeThreadId`
3. **Command Layer**: 平台无关的 `/new /threads /use /where /link`

详细设计见 [架构归一设计](assets/F088/architecture-unification.md) · [设计讨论纪要](../discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md)

## Phase 进度

| Phase | 内容 | 状态 | PR |
|-------|------|------|-----|
| **1 (MVP)** | 飞书 + Telegram DM-only 双向对话 | ✅ | [#328](https://github.com/zts212653/cat-cafe/pull/328) |
| **2** | 多猫身份 + 分角色展示 + 外部 @路由 | ✅ | [#336](https://github.com/zts212653/cat-cafe/pull/336) |
| **3** | 富文本卡片（rich block → 飞书 card / Telegram formatted） | ✅ | — |
| **A** | ISSUE-1 修复：格式化 + DEFAULT_OWNER + Redis binding | ✅ | #344 + #346 |
| **B** | IM 命令集 `/new /threads /use /where` + deep link | ✅ | #349 |
| **4** | 消息编辑模拟流式（placeholder → edits → final） | ✅ | [#350](https://github.com/zts212653/cat-cafe/pull/350) |
| **C** | 架构归一：命令管道统一 + 跨平台 thread | ✅ | [#353](https://github.com/zts212653/cat-cafe/pull/353) |
| **5** | 图片/文件收发（双向） | 🚧 next | — |
| **6** | 语音消息（STT/TTS） | 📋 planned | — |
| **7** | 群聊 + 多人 + 权限隔离 | 📋 planned | — |
| **8** | 更多平台 + OAuth + 配置 UI | 📋 planned | — |
| **9** | 产品化（多账号/多workspace/运维） | 📋 planned | — |

完整 AC 列表见 [各 Phase 详细 AC](assets/F088/acceptance-criteria.md)

## MVP Scope 硬边界

**包含**：飞书+Telegram DM-only、单 Owner、静态 token、Markdown、入站幂等去重、thread mapping、outbound final-only

**显式排除**：群聊(Phase 7)、多用户(Phase 7)、Slack/Discord(Phase 8)、OAuth(Phase 8)、多账号(Phase 9)

## 需求点 Checklist

| # | 需求点 | AC 映射 | 状态 |
|---|--------|---------|------|
| R1 | "飞书等聊天软件的Gateway能力" | AC-1, AC-2 | ✅ |
| R2 | 消息双向通（收+回） | AC-1, AC-2, AC-7 | ✅ |
| R3 | "来个海外的" — Telegram | AC-2 | ✅ |
| R4 | 不影响现有功能 | AC-5 | ⏳ |
| R5 | 入站幂等（不重复触发） | AC-6 | ✅ |

## Dependencies

- **Evolved from**: Connector 体系（GitHub Review Watcher, F050 A2A）
- **Related**: F077 多用户安全协作（群聊依赖）、F044 Channel 系统
- **External**: 飞书开放平台 App、Telegram Bot (@BotFather)

## Risk

1. **多用户安全模型**：群聊引入非 owner 用户，需权限隔离（F077 前置）
2. **平台 API 变更**：飞书/Telegram SDK 更新，需适配层
3. **消息格式损失**：rich content 转换中可能丢信息

## Known Issues

- **ISSUE-1**: Connector 消息不走统一管道 — **✅ Phase A+B+C 已解决**。详见 [架构归一设计](assets/F088/architecture-unification.md)
- **ISSUE-2**: Cloudflare Access 与 webhook 路径冲突 — 临时用 `api.clowder-ai.com`。详见 [架构归一设计](assets/F088/architecture-unification.md#issue-2-cloudflare-access-与-tunnel-ingress-路径冲突)

## Open Questions (resolved)

1. ~~MVP 先做飞书还是 Slack？~~ → 飞书 + Telegram
2. ~~群聊排期？~~ → Phase 7（F077 前置）
3. ~~多猫外显策略？~~ → 方案 A（消息前缀 `[布偶猫🐱]`），单 bot 最简

## Timeline

| Date | Event |
|------|-------|
| 2026-03-09 | Kickoff: F088 立项，Phase 1 + 2 完成 (PR #328 + #336) |
| 2026-03-09 | Phase 3 + A + B 完成 (PR #344 + #346 + #349) |
| 2026-03-09 | Phase 4 完成 (PR #350) |
| 2026-03-10 | Phase C 架构归一完成 (PR #353) |

## 参考文件

| 文件 | 内容 |
|------|------|
| [平台选型参考](assets/F088/platform-selection.md) | 平台对比表 + 选型决策 + 工期评估 |
| [架构归一设计](assets/F088/architecture-unification.md) | ISSUE-1/2 解决方案 + 三层架构设计 |
| [各 Phase 详细 AC](assets/F088/acceptance-criteria.md) | 完整 AC 清单（Phase 1-9） |
| [设计讨论纪要](../discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md) | 布偶猫+缅因猫 thread 统一讨论 |
