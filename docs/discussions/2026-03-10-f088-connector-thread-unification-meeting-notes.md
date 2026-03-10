---
feature_ids: [F088]
related_features: [F097]
topics: [connector, thread, feishu, telegram, architecture]
doc_kind: meeting-notes
created: 2026-03-10
---

# F088 Connector Thread 统一设计 讨论纪要

**Thread**: multi_mention from opus | **日期**: 2026-03-10 | **参与者**: 布偶猫(opus), 缅因猫(gpt52)

## 背景

F088 飞书实测发现 ISSUE-1：ConnectorRouter 收到飞书消息后在 ThreadStore 创建 thread，但用 `defaultUserId: 'default-user'`，导致铲屎官在前端看不到 connector thread。同时 binding 纯内存（重启即丢），IM 侧无法管理 thread。

铲屎官核心诉求："飞书接入我们的前端应该是可见的！我也能在前端看到你们的 thread"

## 各方观点

### 布偶猫(opus)
- connector 消息已经在 ThreadStore/MessageStore 里，问题是 userId 不匹配导致前端过滤掉了
- 方案：userId 映射 + 命令式交互(`/new /switch /list /thread`) + Redis binding
- MVP 可以用 env 配 `DEFAULT_OWNER_USER_ID` 跳过绑定流程

### 缅因猫(gpt52)
- 核心洞察：**统一的是 Cat Café thread/message core，不是 GitHub transport**。GitHub 也是 connector，不该变成会话内核
- 提出 `ConnectorPrincipalLink` 概念：显式用户绑定（前端生成 code → IM 发 `/link code`）
- 强调 Chat 和 Thread 必须拆开：`externalChatId → activeThreadId` + recent threads 列表
- 未 link 用户一律不创建 thread，避免幽灵 thread

## 共识

1. **统一的是 Cat Café 的 thread/message/router 内核**，GitHub/飞书/Telegram 都只是 connector
2. **前端可见是 owner 归属对齐的自然结果**，不开"all threads"后门视图
3. **三层结构**：
   - **Principal Link**: `connector + externalSenderId → internalUserId`（解决"飞书用户是谁"）
   - **Session Binding**: `connector + externalChatId → activeThreadId` + recent threads（解决"聊天窗口当前指向哪个 thread"）
   - **Command Layer**: 平台无关的 `/new /threads /use /where /link`，夹在 adapter 和 ConnectorRouter 之间（解决"IM 侧如何管理 thread"）
4. **命令解析放平台无关层**，adapter 只做平台协议解析。Slack/Discord 接入时复用，不重写命令语义
5. **Redis 持久化 binding**，接口抽象（`IConnectorPrincipalLinkStore` / `IConnectorThreadBindingStore`）
6. **回复带 thread badge** `[T7 需求梳理][布偶猫🐱] ...` + 前端 deep link
7. **IM 输出统一格式规范**（所有平台拉齐，见下文）

## IM 输出格式规范（跨平台统一）

### 普通回复 → 统一用富文本/卡片，不用纯文本

所有平台的猫猫回复必须包含以下信息层：

```
┌──────────────────────────────────┐
│ 🐱 布偶猫/宪宪                     │  ← 猫名 + 身份
│ T12 飞书登录bug排查 · F088         │  ← 当前 thread + feat（如有）
├──────────────────────────────────┤
│                                  │
│ 正文内容（支持 markdown）           │  ← 代码块、加粗、链接等
│                                  │
├──────────────────────────────────┤
│ 📎 在前端查看 · 01:22             │  ← deep link + 时间戳
└──────────────────────────────────┘
```

### 各平台渲染方式

| 信息层 | 飞书 | Telegram | Slack | Discord |
|--------|------|----------|-------|---------|
| 猫名+身份 | Card header | Bold 首行 | Block Kit header | Embed author |
| Thread+Feat | Card subtitle | 第二行 italic | Block Kit context | Embed title |
| 正文 | Card markdown element | MarkdownV2 | Block Kit section (mrkdwn) | Embed description (markdown) |
| Deep link+时间 | Card action link | Inline link 末行 | Block Kit context + button | Embed footer + link |

### 设计原则

1. **msg_type 必须用富文本格式**（飞书 `interactive` / Telegram `MarkdownV2` / Slack `blocks`），禁止纯 text
2. **所有平台同一套信息层**，只是渲染载体不同
3. **正文必须支持 markdown**：代码块、加粗、链接、列表
4. **每条回复必须带 thread 标识和 deep link**，用户始终知道"我在哪"和"在前端怎么找到这段对话"
5. **格式逻辑在平台无关层定义**（`ConnectorMessageFormatter`），adapter 只做最终的平台格式转换

### 实现架构

```
猫猫回复 (content + catId + threadId + featId)
  ↓
ConnectorMessageFormatter（平台无关）
  → 生成统一 MessageEnvelope { header, subtitle, body, footer }
  ↓
FeishuAdapter.formatCard(envelope) → interactive card JSON
TelegramAdapter.formatMarkdown(envelope) → MarkdownV2 string
SlackAdapter.formatBlocks(envelope) → Block Kit JSON
DiscordAdapter.formatEmbed(envelope) → Embed object
```

## 否决

- **否决"自动按话题分 thread"**：看起来聪明，实际最容易把用户搞丢。理由：IM 场景用户心智是"我在和谁聊"而不是"AI 觉得我在聊什么话题"
- **否决"把 IM 事件绕回 GitHub transport"**：GitHub 也是 connector，不该变成会话内核

## 分期

### Phase A — 最小可用（解决铲屎官当前痛点）
- `DEFAULT_OWNER_USER_ID` env 配置（单 owner bootstrap mode）
  - 硬约束：必须是显式模式。配了 = 单 owner 直连；没配 = 未 link 用户不创建 thread
- Binding 持久化到 Redis（`IConnectorThreadBindingStore` 接口 + Redis 实现）
- 前端自然可见（thread.createdBy = 真实 userId）
- **IM 回复改用富文本格式**（飞书 `interactive` card），禁止纯 text
- `ConnectorMessageFormatter` 平台无关层：统一 MessageEnvelope { header, subtitle, body, footer }

### Phase B — IM 侧 thread 管理
- 统一 Command Layer：`/new [标题]` / `/threads` / `/use <短ID>` / `/where`
- `activeThreadId` pointer（chat ↔ thread 解绑）
- 回复带 thread badge + 前端 deep link
- 各平台 adapter 实现各自的富文本渲染（Telegram MarkdownV2、Slack Block Kit、Discord Embed）

### Phase B+ — 智能路由（解决"直接发消息，不知道该去哪个 thread"）
- **Dispatch thread** + `im_forward` MCP：用户无命令直接说话 → post 到 dispatch thread → 轻量猫（Haiku）搜索匹配 thread → 转发
- 仅在"需求不明确/话题漂移"时介入，命令式交互和有明确 active thread 的消息走快路径不经过 dispatch
- Dispatch thread 里的路由记录在前端可见（可审计）
- 铲屎官原话："只有用户需求不明确你才是这样转发"

### Phase C — 多用户 + 跨平台通用
- `ConnectorPrincipalLink` + `/link` 正式绑定流程
- 前端"连接 IM"UI（生成一次性 code）
- 多用户支持 + Slack/Discord adapter 复用同一内核

## 待决

- Phase A 的 `DEFAULT_OWNER_USER_ID` 应该对应哪个 userId？需要确认铲屎官在前端的实际 userId
- Thread badge 格式细节（短 ID 用 hash 还是序号？）
- Deep link URL 格式
- Phase B+ dispatch 猫的模型选择（Haiku？Sonnet？）和 prompt 设计

## 行动项

| # | 行动 | Owner | 前置 |
|---|------|-------|------|
| 1 | 更新 F088 spec Known Issues + 设计方向 | opus | — |
| 2 | Phase A 实施计划 | opus | 铲屎官确认分期 |
| 3 | Phase A 代码实现 | opus | #2 |
