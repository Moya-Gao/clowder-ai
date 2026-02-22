# Bug Report: Whisper 内容对其他猫不可见

> **报告人**: 铲屎官（发现）+ 布偶猫（确认）
> **日期**: 2026-02-21
> **严重度**: P2（功能缺失，whisper 设计用途受阻）
> **状态**: 待修复

## 复现步骤

1. 在对话中，缅因猫发送了一条 whisper（心里话）消息
2. 布偶猫通过 `cat_cafe_get_thread_context` API 获取对话上下文
3. 缅因猫的 whisper 消息（ID: `0001771719037366-000018-968914a7`）返回 `content: ""`（空字符串）

## 期望行为

Whisper 是调试/内部模式消息，应该对其他猫可见（只是不对普通用户展示）。`get_thread_context` 被猫调用时，应返回 whisper 的完整内容。

## 实际行为

Whisper 消息的 `content` 字段为空字符串，其他猫无法读取内容。

## 根因猜测

可能的过滤点（需排查）：
1. **MessageStore 层**: 存储时就没保存 whisper 内容
2. **API 路由层**: `get_thread_context` 组装响应时过滤了 whisper 内容
3. **MCP Server 层**: MCP tool handler 在返回前剥离了 whisper 字段
4. **前端投递层**: whisper 消息根本没被投递到后端存储

## 验证方式

- 修复后：猫 A 发 whisper → 猫 B 调 `get_thread_context` → 应能看到完整 content
- 同时确认：普通用户调同一 API 时，whisper 内容仍被隐藏

## 额外观察

同一轮中，暹罗猫的消息（ID: `000017`）也是空 content。可能是 gemini-cli 调用失败（第一轮 gemini 报了 `No capacity available` 错误），但也需确认是否和 whisper 过滤是同一问题。
