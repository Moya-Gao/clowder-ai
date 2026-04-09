---
feature_ids: [F088, F132]
topics: [guide, connector, im, commands, usage]
doc_kind: guide
created: 2026-03-10
updated: 2026-04-09
---

# Cat Cafe IM 使用指南

> 关联: [F088 Multi-Platform Chat Gateway](../features/F088-multi-platform-chat-gateway.md) | [F132 DingTalk & WeCom Gateway](../features/F132-dingtalk-wecom-gateway.md) | [IM 平台接入指南](./im-platform-setup.md)

在飞书、Telegram、钉钉、企业微信等 IM 里和猫猫对话。所有平台命令统一。

---

## 命令速查

| 命令 | 作用 | 示例 |
|------|------|------|
| `/new [标题]` | 创建新对话 | `/new Redis缓存优化` |
| `/threads` | 列出最近的对话 | `/threads` |
| `/use <ID>` | 切换到已有对话 | `/use 12` |
| `/where` | 查看当前对话状态 | `/where` |
| `/link <code>` | 绑定 Cat Cafe 账号 | `/link A7X9K2` |
| 直接发消息 | 发送到当前对话 | `帮我看看这个报错` |

---

## 使用场景

### 开始新对话

```
你: /new 飞书登录bug排查

🐱: 已创建 [T12 飞书登录bug排查]
     📎 cafe.clowder-ai.com/t/abc123
```

创建后自动切换到新对话。之后发的消息都会进入这个对话。

### 继续之前的对话

```
你: /threads

🐱: → T12 飞书登录bug排查 (当前)
       T11 F088 connector设计
       T10 周报整理
       T9  Redis 缓存优化

你: /use 11

🐱: 🔄 已切换到 [T11 F088 connector设计]
```

### 直接聊天

不发命令，直接说话，消息进入当前活跃对话：

```
你: 帮我看看这个报错 TypeError: Cannot read property 'id' of undefined

┌──────────────────────────────────┐
│ 🐱 布偶猫/宪宪                     │
│ T12 飞书登录bug排查 · F088         │
├──────────────────────────────────┤
│ 看了一下，这个 TypeError 是因为      │
│ `user` 对象在 OAuth 回调时还没      │
│ 初始化。修复方案：                    │
│                                  │
│ ```ts                            │
│ const id = user?.id ?? fallback; │
│ ```                              │
├──────────────────────────────────┤
│ 📎 在前端查看 · 01:22              │
└──────────────────────────────────┘
```

如果你问了一个和当前对话无关的问题，猫猫会提醒你是否要切换对话。

### 查看当前状态

```
你: /where

🐱: 📍 当前: [T12 飞书登录bug排查]
     🐱 参与: 布偶猫, 缅因猫
     💬 最近: "看了一下，这个 TypeError..." (2分钟前)
     📎 cafe.clowder-ai.com/t/abc123
```

### @ 指定猫猫

默认回复的猫由系统路由决定。如果想指定某只猫：

```
你: @codex 帮我 review 一下这段代码

🐱 缅因猫/砚砚: 看了一下，有几个问题...
```

---

## 和前端的关系

IM 里的对话和 Cat Cafe 前端是**同一个对话**：

- IM 发的消息在前端 thread 列表里实时出现
- 前端发的消息猫猫也会通过 IM 回复
- 点击每条回复底部的 **📎 在前端查看** 链接，直接跳到前端对应位置

你可以随时在 IM 和前端之间切换，对话不会丢失。

---

## 绑定账号

首次使用需要把 IM 账号和 Cat Cafe 账号关联：

1. 在 Cat Cafe 前端 → 设置 → 连接平台 → 选择飞书/Telegram/钉钉/企业微信 → 获取绑定码
2. 在 IM 里发送 `/link <绑定码>`
3. 绑定成功后，IM 里的对话会出现在你的前端 thread 列表中

> 当前单用户模式下，如果配置了 `DEFAULT_OWNER_USER_ID` 环境变量，可以跳过绑定步骤。

---

## 注意事项

- **每个 IM 聊天窗口同一时刻只有一个活跃对话**。用 `/use` 切换。
- **命令区分大小写**：用小写 `/new`，不是 `/New`。
- **长消息可能被平台截断**：飞书卡片有长度限制，超长回复会分段发送。钉钉 AI Card 和企微同理。
- **图片和语音**：支持发送图片和语音消息，猫猫能看到图片内容、语音会自动转文字（需配置 Whisper）。Telegram 回复图片/语音为原生消息，飞书回复为原生媒体（需配置 APP 凭证）或文本链接，钉钉/企微原生发送。
- **流式输出**：飞书（edit card）、Telegram（edit msg）、钉钉（card streaming）、企微 Bot（replyStream）支持流式输出，企微自建应用不支持（final-only，长回复分块发送）。
- **文件**：支持发送文件，会下载到本地并以文本描述传递给猫猫。文件内容提取（PDF/文档解析）在后续版本。
