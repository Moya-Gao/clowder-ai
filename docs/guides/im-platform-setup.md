---
feature_ids: [F088]
topics: [guide, connector, feishu, telegram, setup]
doc_kind: guide
created: 2026-03-10
---

# IM 平台接入指南

> 关联: [F088 Multi-Platform Chat Gateway](../features/F088-multi-platform-chat-gateway.md)

本指南帮你把 Cat Café 连接到飞书、Telegram 等 IM 平台，让你可以直接在聊天工具里和猫猫对话。

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

## 接入后的下一步

接入成功后，阅读 [IM 使用指南](./im-usage-guide.md) 了解如何在 IM 里和猫猫高效协作。
