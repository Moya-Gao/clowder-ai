# Review Request: F060 — output_image 从 Codex MCP tool result 自动渲染

## What

Codex CLI 的 `mcp_tool_call` completed 事件包含 `image` 类型 content block 时，自动提取并生成 `media_gallery` rich block，通过 WebSocket 推到前端渲染。

核心变更（3 files, +202 -8）：
- `codex-event-transform.ts`: 返回类型 → `AgentMessage | AgentMessage[] | null`，提取 image blocks → data URI → media_gallery rich block
- `CodexAgentService.ts`: 适配数组返回（参照 ClaudeAgentService 的 `Array.isArray(result)` 模式）
- `codex-event-transform.test.js`: 6 个新测试

## Why

MCP 工具（小红书 `get_login_qrcode`）返回 `output_image` 二维码时，猫猫看得到但铲屎官在 Hub 前端看不到。当前 event transform 只提取 `type: 'text'` 块，image 块被静默丢弃。

Phase 1 只做 Codex 路径（Claude CLI 内部消费 MCP tool result，不在 NDJSON 中暴露原始图片数据）。

## Original Requirements（必填）

> "添加一个feat 要做富文本返回 output_image"
> 铲屎官在小红书 MCP 排查中发现：猫猫调了 `get_login_qrcode` 拿到了二维码图片，但 Hub 前端啥都没显示。

- 来源：Thread `thread_mm4dj9jp0tij0ch3` (2026-03-04), F060 spec `docs/features/F060-output-image-rich-block.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **放弃新增 `tool_image` MessageContent 类型**：复用现有 `media_gallery` rich block 更简单，前端零改动
- **Phase 1 不做 Claude 路径**：Claude CLI 不在 NDJSON 中暴露 MCP tool result 的 image 数据，需要不同策略（Phase 2）
- **Phase 1 不做 lightbox (AC-2)**：前端 MediaGalleryBlock 已有 `<img>` 渲染，点击放大待后续

## Open Questions

1. **base64 大小**：大图片的 data URI 可能很大（QR 码通常很小所以没问题）。Phase 2 是否需要服务端存储 + URL 方案？
2. **rich block 持久化**：当前 rich block 只在流式推送中存在，refresh 后是否需要从存储恢复？（现有 rich block 已有此问题，不是 F060 新引入的）

## Next Action

请 review 以下重点：
1. `codex-event-transform.ts:172-209` — image 提取逻辑和 data URI 构造
2. `CodexAgentService.ts:382-393` — 数组返回处理是否与 ClaudeAgentService 一致
3. 测试覆盖是否充分（edge cases: 无 mimeType、无 data、纯图片无文本）

## 自检证据

### Spec 合规

| # | AC | 状态 | 备注 |
|---|-----|------|------|
| AC-1 | MCP output_image → 前端自动显示 | ✅ (Codex) | Claude 待 Phase 2 |
| AC-2 | 图片可点击放大 | ⏳ Phase 2 | |
| AC-3 | 所有 MCP 工具通用 | ✅ | 不限 server/tool |
| AC-4 | 不需要猫猫额外操作 | ✅ | 自动从 event transform 注入 |

### 测试结果

```
node --test codex-event-transform.test.js  # 25 passed, 0 failed
pnpm test (full API)                       # 2546 passed, 4 failed (Redis isolation, pre-existing)
pnpm lint                                  # 0 errors
pnpm build                                 # exit 0
```

### 相关文档

- Feature: `docs/features/F060-output-image-rich-block.md`
- Branch: `feat/f060-output-image-rich-block`
