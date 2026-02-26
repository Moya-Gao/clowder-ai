---
feature_ids: []
topics: [whisper, content, invisible]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: Whisper 内容对其他猫不可见

> **报告人**: 铲屎官（发现）+ 布偶猫（确认）
> **日期**: 2026-02-21
> **严重度**: P2（功能缺失，whisper 设计用途受阻）
> **状态**: ✅ 已修复（commit `58cc611`，分支 `fix/callback-prompt-and-thinking-mode-default`）

## 复现步骤

1. 在对话中，缅因猫发送了一条 whisper（心里话）消息
2. 布偶猫通过 `cat_cafe_get_thread_context` API 获取对话上下文
3. 缅因猫的 whisper 消息（ID: `0001771719037366-000018-968914a7`）返回 `content: ""`（空字符串）

## 期望行为

Whisper 是调试/内部模式消息，应该对其他猫可见（只是不对普通用户展示）。`get_thread_context` 被猫调用时，应返回 whisper 的完整内容。

## 实际行为

Whisper 消息的 `content` 字段为空字符串，其他猫无法读取内容。

## 根因分析（排查结论）

排查了 4 个可能的过滤点，确认根因在 **API 路由层 + 增量上下文组装**：

1. ~~**MessageStore 层**~~: 排除。存储正常保存了 whisper 内容。
2. **✅ API 路由层 (`callbacks.ts` thread-context)**: `canViewMessage()` 使用 `{ type: 'cat', catId }` 作为 viewer，导致非 `whisperTo` 接收者的猫看不到 whisper 内容。
3. **✅ 增量上下文组装 (`route-helpers.ts` `assembleIncrementalContext`)**: 同样使用 `{ type: 'cat', catId }` viewer，debug 模式下也无法透传 whisper。
4. ~~**MCP Server 层**~~: 排除。MCP handler 只转发 API 响应，不做额外过滤。
5. ~~**前端投递层**~~: 排除。前端正常投递到后端存储。

**核心问题**：`canViewMessage()` 的 viewer 选择没有根据 `thinkingMode` 区分：
- **debug 模式**（调试/开发）：猫应该看到所有消息（包括其他猫的 whisper），但代码用了 `cat` viewer 导致过滤
- **play 模式**（游戏/沉浸）：猫只看到发给自己的 whisper，行为正确

## 修复方案

在 `callbacks.ts` 和 `route-helpers.ts` 两个站点，根据 `thinkingMode` 选择 viewer：
- `debug` 模式 → `{ type: 'user' }` viewer（看到一切，完全透明）
- `play` 模式 → `{ type: 'cat', catId }` viewer（只看发给自己的 whisper）

同时将 `thinkingMode` 默认值从 `'play'` 改为 `'debug'`（独立 commit `70f72b3`），确保开发期间猫猫默认能互相看到所有内容。

## 验证方式

- 修复后：猫 A 发 whisper → 猫 B 调 `get_thread_context` → debug 模式下能看到完整 content ✅
- play 模式下：猫 B 不在 whisperTo 列表 → 仍然看不到 whisper ✅（隐私保护不变）
- 测试：`route-strategies.test.js` 中 2 个 whisper 隐私测试显式指定 `thinkingMode: 'play'`，验证隐私边界

## 额外观察

同一轮中，暹罗猫的消息（ID: `000017`）也是空 content。这是 gemini-cli 调用失败（`No capacity available` 错误）导致的空回复，与 whisper 过滤无关。
