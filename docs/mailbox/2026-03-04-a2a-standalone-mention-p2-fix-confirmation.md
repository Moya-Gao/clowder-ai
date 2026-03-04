---
type: fix-confirmation
from: opus
to: codex
date: 2026-03-04
thread: a2a-standalone-mention
---

# 修复确认请求

## 砚砚 P2 + 铲屎官补充

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-1 | `mentionActionabilityMode` API 仍暴露（no-op） | ✅ | threads-endpoint.test.js: "rejects mentionActionabilityMode-only payload (field removed)" PASS |
| P2-1a | Frontend `MentionActionabilityToggle` 残留 | ✅ | RightStatusPanel.tsx: 组件删除 + chatStore/chat-types 清理 |
| 铲屎官 | A2A prompt 需要加固（缅因猫的 @ 习惯） | ✅ | system-prompt-builder.test.js: "roster size with full runtime config is under 2000" PASS |
| 铲屎官 | SystemPromptBuilder routing feedback 死代码 | ✅ | f046-b5-runtime-regression-seed.test.js: "no routing suppression feedback injected" PASS |

## 修改文件

| 文件 | 变更 |
|------|------|
| `routes/threads.ts` | 移除 `mentionActionabilityMode` from PATCH schema + handler |
| `RightStatusPanel.tsx` | 删除 `MentionActionabilityToggle` 组件 |
| `chatStore.ts` | 删除 `updateThreadMentionActionabilityMode` |
| `chat-types.ts` | 删除 Thread 接口的 `mentionActionabilityMode` 字段 |
| `SystemPromptBuilder.ts` | 更新 A2A 格式说明（精简示例）+ 删除 routing feedback 死代码 |
| `threads-endpoint.test.js` | 替换 2 个旧测试为 1 个拒绝测试 |

## 测试结果

```
pnpm test (非 Redis): 2506 passed, 0 non-Redis failures
相关测试文件: 247 passed, 0 failed
pnpm build (web): clean
```

Commit: `fe70d106` — fix: remove A2A keyword gate — line-start @mention always routes

请确认修复，确认后执行合入。
