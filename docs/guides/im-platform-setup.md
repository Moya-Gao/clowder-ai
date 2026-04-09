---
feature_ids: [F088, F132]
topics: [guide, connector, feishu, telegram, dingtalk, wecom, setup]
doc_kind: guide
created: 2026-03-10
updated: 2026-04-09
---

# IM 平台接入指南

> 关联: [F088 Multi-Platform Chat Gateway](../features/F088-multi-platform-chat-gateway.md) | [F132 DingTalk & WeCom Gateway](../features/F132-dingtalk-wecom-gateway.md)

本指南帮你把 Cat Café 连接到飞书、Telegram、钉钉、企业微信等 IM 平台，让你可以直接在聊天工具里和猫猫对话。

---

## 飞书接入

### 前置条件

- 飞书企业账号（个人版不支持自建应用）
- Cat Café API 服务运行中（端口 3002）
- 公网可达的 webhook URL（Cloudflare Tunnel 或其他方案）

### Step 1: 创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. **创建企业自建应用** → 填写应用名称（如 `cafe-clowder-ai`）
3. 左侧菜单 → **添加应用能力** → 开启 **机器人**

### Step 2: 获取凭证

在 **凭证与基础信息** 页面，记录：
- `App ID`
- `App Secret`

### Step 3: 配置环境变量

在 Cat Café API 的 `.env` 中添加：

```bash
FEISHU_APP_ID=cli_xxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxx   # 事件订阅页面获取
```

### Step 4: 配置事件订阅

1. 左侧菜单 → **事件与回调** → **事件配置**
2. **请求网址 URL** 填写：
   ```
   https://<你的域名>/api/connectors/feishu/webhook
   ```
   > 如果用 Cloudflare Tunnel，且主域名有 Access 保护，建议用 API 子域名（如 `api.clowder-ai.com`）避免 302 拦截
3. 点击 **验证** — 飞书发送 challenge 请求，服务器应返回正确响应
4. 验证通过后，点击 **添加事件**，订阅：
   - `im.message.receive_v1` — 接收消息

### Step 5: 配置权限

**权限管理** 页面，开通：
- `im:message` — 读取消息
- `im:message:send_as_bot` — 以机器人身份发消息
- `im:resource` — 读取媒体资源（图片、文件）
- `im:resource:upload` — 上传媒体（语音气泡和图片原生显示必需）

> **提示：** 如不开通 `im:resource:upload`，语音消息会以文本链接显示，图片只发送 URL。机器人通过 ffmpeg 将 WAV 转码为 Opus 格式上传飞书，需确保服务器已安装 ffmpeg。

### Step 6: 发布应用

1. **版本管理与发布** → 创建版本 → 提交审核
2. 企业内部应用一般自动通过
3. 发布后，确认 **成员管理 → 可用范围** 包含你自己

### Step 7: 验证

1. 打开飞书客户端，搜索你的应用名称
2. 点进机器人，发一条消息（如"你好"）
3. 如果收到猫猫回复，接入成功

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 飞书搜不到机器人 | 应用未发布 / 不在可用范围 | 发布应用 + 检查可用范围 |
| webhook 验证失败（超时） | URL 不可达 | 检查 tunnel 连通性：`curl -X POST <url> -H 'Content-Type: application/json' -d '{"type":"url_verification","challenge":"test"}'` |
| webhook 返回 302 | Cloudflare Access 拦截 | 用无 Access 保护的子域名，或配置 path-scoped bypass |
| 收不到回复 | 缺少 `FEISHU_VERIFICATION_TOKEN` | 检查 env 配置 + 重启 API |

---

## Telegram 接入

### Step 1: 创建 Bot

1. 在 Telegram 找 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示设置名称
3. 记录返回的 **Bot Token**

### Step 2: 配置环境变量

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Step 3: 启动

Telegram adapter 支持 long polling（不需要公网 webhook），启动 API 服务即可。

### Step 4: 验证

在 Telegram 搜索你的 bot，发一条消息。

---

## 钉钉接入

> F132 Phase A — 使用钉钉 Stream SDK 长连接模式，无需公网 webhook。

### 前置条件

- 钉钉管理员账号（需要创建企业内部应用的权限）
- Cat Café API 服务运行中（端口 3002）
- **不需要**公网 webhook URL（Stream SDK 使用长连接主动拉取消息）

### Step 1: 创建钉钉企业内部应用

1. 登录 [钉钉开放平台](https://open-dev.dingtalk.com/)
2. **应用开发** → **企业内部应用** → **创建应用**
3. 填写应用名称（如 `Cat Café AI`），选择 **机器人** 应用类型

### Step 2: 获取凭证

在 **凭证与基础信息** 页面，记录：
- `AppKey`
- `AppSecret`

### Step 3: 配置机器人能力

1. 左侧菜单 → **添加应用能力** → 开启 **机器人**
2. 消息接收模式选择 **Stream 模式**（推荐，免公网暴露）
3. 配置机器人的基本信息（头像、描述等）

### Step 4: 配置环境变量

在 Cat Café API 的 `.env` 中添加：

```bash
DINGTALK_APP_KEY=xxxxxxxxxx
DINGTALK_APP_SECRET=xxxxxxxxxxxxxxxxxx
```

### Step 5: 配置权限

在 **权限管理** 页面，申请以下权限：
- `qyapi_robot_sendmsg` — 机器人发消息
- `qyapi_chat_manage` — 群会话管理（如需群聊支持）

### Step 6: 发布应用

1. **版本管理与发布** → 创建版本 → 提交审核
2. 企业内部应用一般即时生效
3. 发布后，在钉钉客户端搜索应用名称即可找到机器人

### Step 7: 验证

1. 重启 Cat Café API 服务（或等待自动热重载）
2. 在钉钉客户端，搜索你的机器人名称
3. 发送一条消息（如"你好"）
4. 如果收到猫猫回复，接入成功

### 特性说明

| 特性 | 支持情况 |
|------|---------|
| 文本消息 | ✅ 支持 |
| 图片消息 | ✅ 发送/接收 |
| 语音消息 | ✅ 自动转文字 |
| 富文本卡片 | ✅ AI Card（markdown） |
| 流式输出 | ✅ Card streaming |
| 文件 | ✅ 下载处理 |

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 启动日志无 DingTalk 相关 | 环境变量未设置 | 检查 `.env` 中 `DINGTALK_APP_KEY` 和 `DINGTALK_APP_SECRET` |
| 机器人搜不到 | 应用未发布 / 不在可用范围 | 发布应用 + 检查可用范围 |
| 连接断开后不自动重连 | Stream SDK 异常 | 检查 API 日志，重启服务 |
| 收不到图片 | 缺少下载权限 | 确认已申请媒体相关权限 |

---

## 企业微信智能机器人接入（WebSocket 模式）

> F132 Phase B — 使用企微智能机器人 WebSocket 长连接，无需公网 webhook。

### 前置条件

- 企业微信管理员账号
- Cat Café API 服务运行中（端口 3002）
- **不需要**公网 webhook URL（WebSocket 长连接模式）

### Step 1: 创建智能机器人

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. **应用管理** → **智能机器人** → **创建机器人**
3. 填写机器人名称、头像等信息

### Step 2: 获取凭证

在机器人详情页面，记录：
- `Bot ID`
- `Bot Secret`

### Step 3: 配置环境变量

在 Cat Café API 的 `.env` 中添加：

```bash
WECOM_BOT_ID=xxxxxxxxxx
WECOM_BOT_SECRET=xxxxxxxxxxxxxxxxxx
```

### Step 4: 验证

1. 重启 Cat Café API 服务
2. 在企业微信中，找到机器人并发一条消息
3. 如果收到猫猫回复，接入成功

### 特性说明

| 特性 | 支持情况 |
|------|---------|
| 文本消息 | ✅ 支持 |
| 图片消息 | ✅ SDK 上传 |
| 语音消息 | ✅ 自动转文字 |
| 富文本卡片 | ✅ 模板卡片 |
| 流式输出 | ✅ replyStream |
| 文件 | ✅ 下载处理 |

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| WebSocket 连不上 | 凭证错误或网络问题 | 检查 `WECOM_BOT_ID` 和 `WECOM_BOT_SECRET` 拼写 |
| 收到消息但无回复 | 路由问题 | 检查 API 日志中 connector 注册状态 |
| 图片发送失败 | SDK 上传异常 | 检查网络连通性和错误日志 |

---

## 企业微信自建应用接入（HTTP 回调模式）

> F132 Phase C — 使用标准 HTTP 回调模式，需要公网可达的 webhook URL。

### 前置条件

- 企业微信管理员账号
- Cat Café API 服务运行中（端口 3002）
- **需要**公网可达的 webhook URL（Cloudflare Tunnel 或其他方案）

### Step 1: 创建自建应用

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. **应用管理** → **自建** → **创建应用**
3. 填写应用名称、Logo、可见范围

### Step 2: 获取凭证

记录以下信息：
- **企业 ID**（`Corp ID`）：**我的企业** → **企业信息** 页面顶部
- **应用 AgentId**：**应用管理** → 点击你的应用 → 顶部显示
- **应用 Secret**：同页面，点击查看

### Step 3: 配置接收消息

1. 在应用详情页 → **接收消息** → **设置 API 接收**
2. **URL** 填写：
   ```
   https://<你的域名>/api/connectors/wecom-agent/webhook
   ```
3. **Token** 和 **EncodingAESKey**：点击随机获取，记录下来
4. 先不要点确定（需要先配好环境变量并启动服务）

### Step 4: 配置环境变量

在 Cat Café API 的 `.env` 中添加：

```bash
WECOM_CORP_ID=ww1234567890abcdef         # 企业 ID
WECOM_AGENT_ID=1000002                    # 应用 AgentId
WECOM_AGENT_SECRET=xxxxxxxxxxxxxxxxxx     # 应用 Secret
WECOM_TOKEN=xxxxxxxxxx                    # API 接收消息 → Token
WECOM_ENCODING_AES_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 43 字符
```

### Step 5: 启动服务并验证回调

1. 重启 Cat Café API 服务
2. 回到企业微信管理后台的"设置 API 接收"页面
3. 点击 **保存** — 企微会发送 GET 验证请求（echostr 解密校验）
4. 验证通过后，回调 URL 状态变为 ✅

### Step 6: 配置权限

在 **API 权限** 页面，确认已开通：
- **发送应用消息** — 应用主动推送消息
- **接收消息** — 接收用户发来的消息
- **素材管理** — 上传/下载临时素材（图片、语音）

### Step 7: 验证

1. 在企业微信客户端，进入应用的聊天界面
2. 发送一条消息（如"你好"）
3. 如果收到猫猫回复，接入成功

### 特性说明

| 特性 | 支持情况 |
|------|---------|
| 文本消息 | ✅ 支持 |
| 图片消息 | ✅ 临时素材 API |
| 语音消息 | ✅ 自动转文字 |
| 富文本卡片 | ✅ TextCard（title + description + URL） |
| 流式输出 | ❌ 不支持（final-only，长回复分块） |
| 文件 | ✅ 下载处理 |
| XML 消息解析 | ✅ 自动 XML → JSON 转换 |

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 回调验证失败 | URL 不可达 / EncodingAESKey 错误 | 检查 tunnel 连通性 + 环境变量正确性 |
| 回调返回 403 | Cloudflare Access 拦截 | 用无 Access 保护的子域名或配置 bypass |
| 收到消息但无回复 | Agent Secret 错误 | 检查 `WECOM_AGENT_SECRET` 是否匹配 |
| 图片收发异常 | 临时素材 API 权限不足 | 确认已开通素材管理权限 |
| 消息解密失败 | EncodingAESKey 不匹配 | 重新随机生成并同时更新管理后台和 `.env` |

---

## 平台对比

| 特性 | 飞书 | Telegram | 钉钉 | 企微 Bot | 企微 Agent |
|------|------|----------|------|---------|-----------|
| 连接方式 | Webhook / WebSocket | Long Polling | Stream SDK | WebSocket | HTTP 回调 |
| 需要公网 | 是（webhook）/ 否（ws） | 否 | 否 | 否 | 是 |
| 富文本卡片 | Card（markdown） | Markdown | AI Card | 模板卡片 | TextCard |
| 流式输出 | ✅ edit card | ✅ edit msg | ✅ card streaming | ✅ replyStream | ❌ final-only |
| 图片 | 原生上传 | 原生发送 | 原生发送 | SDK 上传 | 临时素材 API |

---

## 接入后的下一步

接入成功后，阅读 [IM 使用指南](./im-usage-guide.md) 了解如何在 IM 里和猫猫高效协作。
