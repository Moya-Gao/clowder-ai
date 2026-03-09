---
doc_kind: guide
created: 2026-03-09
feature_ids: [F088]
topics: [feishu, telegram, setup, gateway]
---

# 飞书 + Telegram 接入指南

> F088 Phase 1 配套指南。预计 10 分钟完成配置。

## 一、Telegram Bot（2 分钟）

1. 打开 Telegram，搜索 `@BotFather`
2. 发送 `/newbot`
3. 输入 Bot 名称（如 `Cat Café Dev`）和用户名（如 `catcafe_dev_bot`）
4. 复制返回的 **Bot Token**（格式：`123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`）
5. 在 `.env` 中设置：
   ```
   TELEGRAM_BOT_TOKEN=你的token
   ```
6. 重启 API 服务，日志应显示 `[api] Connector gateway started`
7. 在 Telegram 中搜索你的 bot，发送任意消息，应收到猫猫回复

> Telegram 使用 long polling，**不需要公网 IP 或 webhook URL**。本地开发即可测试。

## 二、飞书 Bot（8 分钟）

### 步骤 1: 创建飞书应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)，登录
2. 点击 **创建企业自建应用**
3. 填写应用名称（如 `Cat Café`）和描述
4. 进入应用详情，记录 **App ID** 和 **App Secret**

### 步骤 2: 添加机器人能力

1. 在应用详情左侧菜单，点击 **添加应用能力** → 选择 **机器人**
2. 机器人名称填写（如 `布偶猫`）

### 步骤 3: 配置事件订阅（webhook）

1. 左侧菜单 → **事件订阅**
2. 请求地址填写你的公网 webhook URL：
   ```
   https://你的域名/api/connectors/feishu/webhook
   ```
   > 本地开发可用 ngrok/Cloudflare Tunnel 暴露：
   > ```bash
   > # ngrok
   > ngrok http 3001
   > # 或 Cloudflare Tunnel
   > cloudflared tunnel --url http://localhost:3001
   > ```
3. 记录页面上显示的 **Verification Token**
4. 添加事件：搜索并勾选 `im.message.receive_v1`（接收消息）

### 步骤 4: 配置权限

1. 左侧菜单 → **权限管理**
2. 搜索并开通以下权限：
   - `im:message`（获取与发送单聊/群聊消息）
   - `im:message:send_as_bot`（以应用身份发消息）

### 步骤 5: 发布应用

1. 左侧菜单 → **版本管理与发布**
2. 创建版本 → 提交审核
3. 如果是企业内部测试，管理员可以直接审批通过

### 步骤 6: 配置环境变量

在 `.env` 中设置：
```
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxx
```

> ⚠️ 三个变量必须全部配置，缺任何一个飞书 handler 不会启动（fail-closed 策略）。

### 步骤 7: 验证

1. 重启 API 服务
2. 日志应显示 `[api] Connector gateway started`
3. 在飞书中找到你的机器人，发送私聊消息
4. 应收到猫猫回复

## 三、环境变量汇总

```bash
# === Telegram ===
TELEGRAM_BOT_TOKEN=       # 从 @BotFather 获取

# === 飞书 ===
FEISHU_APP_ID=            # 飞书开放平台 → 应用详情
FEISHU_APP_SECRET=        # 飞书开放平台 → 应用详情
FEISHU_VERIFICATION_TOKEN= # 飞书开放平台 → 事件订阅页面
```

至少配置一个平台即可启动 gateway。未配置的平台会被跳过。

## 四、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 日志无 `Connector gateway started` | 没配置任何平台 env var | 至少配一个 |
| 飞书 webhook 验证失败 | Verification Token 不对 | 检查事件订阅页面的 token |
| 飞书 handler 未启动 | 三个 env var 缺一个 | 必须全配 |
| Telegram 无回复 | Bot Token 无效或网络问题 | 检查 token、确认能访问 api.telegram.org |
| 收到消息但猫猫不回复 | 可能是 DM 以外的消息类型 | Phase 1 只支持私聊文本 |

## 五、本地开发 Tips

Telegram 不需要公网，直接本地跑就行。

飞书需要公网 webhook，推荐用 Cloudflare Tunnel（免费）：
```bash
# 安装
brew install cloudflared

# 临时隧道（每次 URL 不同）
cloudflared tunnel --url http://localhost:3001

# 把打印的 URL 填到飞书事件订阅的请求地址
```
