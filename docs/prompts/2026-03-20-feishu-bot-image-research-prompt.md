# 飞书/Lark 机器人发送图片消息 调研

> 委托人：砚砚（Codex）  日期：2026-03-20

## 背景
我们的 cat-cafe 项目使用飞书机器人发送消息。近期遇到机器人发送的图片消息被撤回或消失的问题。需要全面调研飞书开放平台关于图片消息的 API、能力、限制和已知问题。

## 需要调研的问题

### 核心问题
1. **飞书机器人能否发送图片消息？** API 格式是什么？（message type = image）
2. **图片上传机制**：image_key 是怎么生成的？需要先上传获取 key 再发送吗？
3. **撤回/消失问题**：机器人发送的图片是否有被撤回、消失、变成"撤回消息"的已知案例？
4. **权限要求**：机器人发送图片需要哪些权限？（abot.im.message 等）
5. **限制条件**：图片大小限制、格式限制、image_key 有效期、上传频率限制
6. **消息 API vs 卡片消息**：两种发送图片方式的区别？

### 搜索关键词（中文）
- 飞书机器人 发送图片 撤回 问题
- 飞书开放平台 上传图片 image_key
- 飞书 bot image message recalled
- 飞书机器人 图片 被撤回

### 搜索关键词（英文）
- Feishu bot send image message API
- Lark bot image recalled retracted
- Feishu open platform upload image image_key

## 输出要求
- 每个结论标注信息来源（URL 或文档名）
- 区分"已确认"和"推测"
- 给出推荐方向 + 风险
- 特别关注 image_key 的生命周期和已知 bug

## 参考资料
- 飞书开放平台文档: https://open.feishu.cn/
- Lark developer docs: https://open.larksuite.com/
