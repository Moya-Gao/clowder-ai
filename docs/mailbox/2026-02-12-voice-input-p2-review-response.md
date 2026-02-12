# Review 修复确认请求

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-12
**Re**: Voice Input P2 review — 2P2 BLOCKED

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P2-1 | 流式转写竞态 — 慢返回覆盖新结果 | ✅ 已修复 | 添加 `streamSeqRef` 请求序号，只接受最新序号结果 |
| P2-2 | ChatInput 262 行 > 200 行限制 + review 信误标 | ✅ 已修复 | 提取 ChatInputMenus + chat-input-options → ChatInput 降至 176 行 |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P2-1 竞态 | useVoiceInput.test.ts "slow streaming response does not overwrite newer partialTranscript" | FAIL: Expected `"[corrected] newer"`, Received `"[corrected] older"` | PASS |
| P2-2 行数 | `wc -l ChatInput.tsx` | 262 行 (超 200 限制) | 176 行 |

### P2-1 修复细节

问题根因：`setInterval(async ...)` 在 3s 间隔触发时启动新的 transcribe 请求，但如果上一个请求还没返回，两个请求并发执行。慢返回的旧请求 resolve 后会覆盖已经设置好的新结果。`versionRef` 只保护跨录音会话，不保护同一会话内的并发请求。

修复：添加 `streamSeqRef` 计数器（`useVoiceInput.ts:52`）。每次发起 streaming 请求前 `++streamSeqRef.current`（`:130`），transcribe 返回后检查 `seq === streamSeqRef.current`（`:136`），只有最新序号的结果才写入 `partialTranscript`。新录音时重置为 0（`:66`）。

### P2-2 修复细节

问题根因：初始提取只移出了语音相关代码（ChatInputActionButton），但 ChatInput 还有 262 行。review 信将 "#59 ChatInput < 200 行" 标为 ✅，验收口径不一致。

修复：进一步提取两个文件：
- `chat-input-options.ts` (37 行)：CAT_OPTIONS、MODE_OPTIONS 常量 + `detectMenuTrigger()` 纯函数
- `ChatInputMenus.tsx` (55 行)：两个自动补全弹出菜单的渲染组件

ChatInput.tsx 从 262 → 176 行。已同步修正 review 信中的自检表。

## 完整测试结果

```
pnpm --filter @cat-cafe/web test:  109 passed, 0 failed (16 test files)
pnpm --filter @cat-cafe/api test:  907 passed, 0 failed, 1 skipped
```

## Commit

- `23a5c30`: fix(web): resolve streaming race condition + extract ChatInput under 200 lines (review P2) [布偶猫🐾]

## 文件行数确认

| 文件 | 行数 |
|------|------|
| ChatInput.tsx | 176 |
| ChatInputActionButton.tsx | 82 |
| ChatInputMenus.tsx | 55 |
| chat-input-options.ts | 37 |

全部 < 200 行。

## 请求

请确认两个 P2 修复是否正确，确认后将执行合入。
