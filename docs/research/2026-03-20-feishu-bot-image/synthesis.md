---
feature_ids: []
debt_ids: []
---

# 飞书机器人发送图片消息 调研报告

> 调研人：砚砚（Codex）  日期：2026-03-20  来源：飞书开放平台官方文档 + GitHub 社区案例

---

## 1. 飞书机器人能否发送图片？API 格式是什么？

**答案：能，必须两步走。**

飞书机器人发送图片**不能**直接把图片二进制塞进消息，必须先上传获取 `image_key`，再用 `image_key` 发消息。这是飞书平台的强制要求，类似于"先存快递柜再给取件码"的机制。

### 完整 API 调用链

**Step 1: 上传图片 → 获取 image_key**
```
POST https://open.feishu.cn/open-apis/im/v1/images
Content-Type: multipart/form-data
Authorization: Bearer {tenant_access_token}

image_type=message
image={二进制文件}
```
响应：
```json
{
  "code": 0,
  "data": { "image_key": "img_v2_xxx" },
  "msg": "success"
}
```

**Step 2: 用 image_key 发送图片消息**
```
POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
Authorization: Bearer {tenant_access_token}
Content-Type: application/json

{
  "receive_id": "ou_xxx",
  "msg_type": "image",
  "content": "{\"image_key\": \"img_v2_xxx\"}"
}
```

来源：[Send Message API](https://open.feishu.cn/document/server-docs/im-v1/message/create) + [Upload Image API](https://open.feishu.cn/document/server-docs/im-v1/image/create)

---

## 2. image_key 上传机制详解

### image_key 是什么
`image_key` 是飞书平台返回的图片唯一标识符（格式如 `img_v2_xxx`），用于在后续的消息 API 中引用已上传的图片资源。

### image_key 生命周期
- **官方文档未标注过期时间** — 已确认：上传后获得的 `image_key` 在飞书平台上是持久化的，可以多次引用
- 可以跨消息复用同一个 `image_key`
- 图片上传后存储在飞书服务器，**不依赖本地文件**

### image_key 在不同消息类型中的使用

| 消息类型 | image_key 用途 | 位置 |
|----------|----------------|------|
| `image` (独立图片消息) | 直接在 content 中传 `{"image_key": "..."}` | [官方示例](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json#6cf7eb0f) |
| `post` (富文本消息) | 在 `tag: "img"` 元素中传 `image_key` | 独立段落 |
| `interactive` (卡片消息) | 在卡片 `img` 组件的 `image_key` 字段 | 组件内 |
| 下载收到的图片 | 调用 `/im/v1/messages/{message_id}/resources/{image_key}` | 需同时提供 message_id |

来源：[Message Content Structure](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json)

---

## 3. 机器人发送的图片会被撤回/消失吗？

### 3.1 飞书内置撤回机制（已知行为）

飞书平台**允许撤回消息**，包括机器人发送的消息：
- **时间限制**：机器人可撤回自己发送的、发送时间不超过 **24 小时**的消息
- **撤回范围**：通过 `DELETE /im/v1/messages/{message_id}` 接口
- **批量消息例外**：通过「批量发送消息」接口发送的消息**无法撤回**，必须用「批量撤回消息」接口
- 企业管理员可以设置撤回时限

来源：[撤回消息 API](https://open.feishu.cn/document/server-docs/im-v1/message/delete?lang=zh-CN)

### 3.2 如果你遇到了"图片消息消失"——常见原因

根据 GitHub 社区（主要是 OpenClaw 项目）的大规模案例，图片"消失"的根本原因是**实现方式错误**，而非飞书平台主动撤回：

#### 原因 1: 直接发送文件路径而不是上传图片（最常见）
```
❌ 错误：message 工具直接发 "/path/to/image.png" 路径文本
结果：收到 "📎 /path/to/image.png"（文件附件图标）
```
这是 OpenClaw 项目中报告最多的 bug，Issue #24053、#35575 都与此相关。

#### 原因 2: 下载图片时缺少 message_id 参数
```
❌ 错误：只传 file_key/image_key，缺少 message_id
结果：GET /im/v1/messages/{message_id}/resources/{image_key} → 400 错误
```
Issue #2483 (zeroclaw) 和 Issue #359 (clawdbot-feishu) 都报告了此问题。正确做法是 `downloadMessageResourceFeishu` 函数需要同时传递 `message_id` 和 `file_key`。

#### 原因 3: image_key 属于不同应用
- 机器人 A 上传的图片产生的 `image_key`，只能被同一个应用（app_id）发送
- **错误码 230017**：`Bot is NOT the owner of the resource`

#### 原因 4: tenant_access_token 过期
- token 有效期 2 小时，过期后上传/发送都会失败
- 上传图片成功但发送消息失败 → 图片存在但消息没发出去

### 3.3 关于"撤回"的结论

**飞书不会自动撤回机器人发送的图片消息。** 如果出现了"撤回"效果（图片变成灰色"撤回消息"提示），可能原因：
1. 有人/某个自动化流程调用了撤回 API
2. 企业管理员配置了 DLP（数据防泄漏）扫描导致消息被拦截（错误码 230028）
3. 消息内容触发了飞书的内容审核

来源：综合 GitHub Issues #24053、#35575、#48891、#2483、#359 及官方 API 文档

---

## 4. 权限要求

### 发送图片消息需要的权限

| 权限 | 用途 | 说明 |
|------|------|------|
| `im:message` | 读取和发送私聊/群组消息 | 三选一即可 |
| `im:message:send_as_bot` | 以机器人身份发送消息 | 三选一即可 |
| `im:message:send` | 发送消息 V2 | 三选一即可 |
| `im:resource` | 上传和获取图片/文件资源 | 必需（用于上传 image_key） |
| `im:message:recall` | 撤回消息 | 如需撤回能力 |

来源：[Send Message API - Required Scopes](https://open.feishu.cn/document/server-docs/im-v1/message/create)

### 其他前提条件
- 应用必须开启**机器人能力**
- 机器人必须在目标群组中
- 接收消息的用户必须在机器人的**可用范围**内
- 群聊中机器人需要有**发言权限**

---

## 5. 限制条件汇总

### 图片上传限制（`/im/v1/images`）

| 限制项 | 值 |
|--------|-----|
| 文件大小 | ≤ **10 MB** |
| 格式 | JPG、JPEG、PNG、WEBP、GIF、BMP、ICO、TIFF、HEIC |
| TIFF/HEIC | 上传后**自动转为 JPG** |
| 分辨率（普通图片） | ≤ **12000 × 12000** |
| 分辨率（GIF） | ≤ **2000 × 2000** |
| 分辨率（头像） | ≤ **4096 × 4096** |
| 大小为 0 的文件 | **不支持** |

### API 频率限制

| 接口 | 限制 |
|------|------|
| 所有 IM v1 接口 | **1000 次/分钟，50 次/秒** |
| 发送消息（同用户/同群组） | **5 QPS** |

### 消息体大小限制

| 类型 | 限制 |
|------|------|
| 文本消息 | ≤ **150 KB** |
| 卡片/富文本消息 | ≤ **30 KB** |

来源：[Upload Image API](https://open.feishu.cn/document/server-docs/im-v1/image/create) + [Send Message API](https://open.feishu.cn/document/server-docs/im-v1/message/create)

---

## 6. 消息 API vs 卡片消息发送图片的区别

### 消息 API（`msg_type: "image"`）
- ✅ 最简单，content 直接是 `{"image_key": "..."}`
- ✅ 渲染为内嵌图片，用户体验最好
- ❌ 不支持复杂交互

### 富文本消息（`msg_type: "post"`）
- ✅ 可在文字段落之间插入图片（`tag: "img"`）
- ✅ 支持多语言（`zh_cn` / `en_us`）
- ✅ 同一段落内可混排文字、图片、链接、@

### 卡片消息（`msg_type: "interactive"`）
- ✅ 最灵活，支持按钮、输入框、图表等交互组件
- ✅ 图片放在 `img` 组件中使用 `image_key`
- ⚠️ 卡片 JSON 2.0 结构限制 **200 个组件/元素**
- ⚠️ 图片必须是该应用上传的（错误码 200570：`card contains invalid image keys`）
- ⚠️ 包含音频组件的卡片**不支持转发**（错误码 200220）
- ⚠️ JSON 1.0 结构的卡片**不支持** `img` 和 `at` 标签

来源：[Message Content Structure](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json)

---

## 7. 常见错误码速查

| 错误码 | 含义 | 解决方案 |
|--------|------|----------|
| 230017 | Bot 不是资源的拥有者 | image_key 必须是同一个 app 上传的 |
| 230006 | Bot 能力未启用 | 在开放平台开启机器人能力 |
| 230013 | 用户不在 Bot 可用范围 | 调整应用可用范围配置 |
| 230035 | 没有发消息权限 | 检查群组禁言/用户屏蔽 |
| 200570 | 卡片包含无效 image_key | 确认 image_key 由正确应用上传 |
| 234011 | 无法识别图片格式 | 确认格式为 JPG/PNG/WEBP/GIF/BMP/ICO/TIFF/HEIC |
| 234039 | 图片分辨率超限 | 缩小图片分辨率后重试 |
| 234006 | 图片大小超限 | 压缩到 10MB 以下 |
| 230028 | 消息 DLP 审核失败 | 检查消息是否包含电话号码/邮箱等敏感信息 |

---

## 8. 对 cat-cafe 的建议

基于以上调研，如果 cat-cafe 的飞书机器人出现图片问题：

1. **确认是否走对了两步**：必须先 `/im/v1/images` 上传，再 `/im/v1/messages` 发送
2. **检查 image_key 归属**：上传图片和发送消息必须使用同一个 app 的 token
3. **处理 token 过期**：tenant_access_token 有效期 2 小时，考虑实现自动刷新
4. **如果图片"消失"**：大概率是 API 调用顺序错误，不是飞书主动撤回
5. **下载图片注意**：必须同时提供 `message_id` + `image_key`，单独传 image_key 会 400

---

## 附录：GitHub 参考实现

以下开源项目有经过验证的飞书图片发送实现，可直接参考：

| 项目 | 语言 | 关键文件 |
|------|------|---------|
| [openclaw/extensions/feishu/src/media.ts](https://github.com/openclaw/openclaw/blob/main/extensions/feishu/src/media.ts) | TypeScript | `uploadImageFeishu()` / `downloadImageFeishu()` |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking/blob/main/bot/vikingbot/channels/feishu.py) | Python | `_upload_image_to_feishu()` / `_download_feishu_image()` |
| [zhayujie/chatgpt-on-wechat](https://github.com/zhayujie/chatgpt-on-wechat/blob/master/channel/feishu/feishu_message.py) | Python | 图片消息处理 + 下载 |
| [smallnest/goclaw](https://github.com/smallnest/goclaw) (feishu-upload-image skill) | 多语言 | 专门的图片上传 skill |

