---
feature_ids: [F060]
related_features: [F022]
topics: [rich-block, mcp, image, frontend]
doc_kind: spec
created: 2026-03-04
---

# F060: output_image 富文本渲染

## Status: spec

## Why

MCP 工具（如小红书 `get_login_qrcode`）返回 `output_image` 类型数据时，Hub 前端无法渲染——猫猫看到了二维码但铲屎官看不到。当前 Hub 只支持两种图片渲染路径：

1. `ImageContent`（用户上传，`type: 'image', url: string`）
2. `media_gallery` rich block（需要猫猫主动创建 rich block）

两者都不覆盖 **MCP 工具自动返回的图片** 这个场景。

## What

让 Hub 能自动渲染猫猫调用 MCP 工具后返回的 `output_image`，无需猫猫手动创建 rich block。

### 方案

MCP tool result 中的 `output_image` 是 base64 编码图片。需要在消息流中将其转换为可渲染内容。

**推荐路径**：在 Agent 调用链中拦截 MCP tool result，检测到 `output_image` 类型时自动生成 `media_gallery` rich block（复用现有渲染能力），通过 WebSocket 推到前端。

**备选路径**：新增 `MessageContent` 类型 `tool_image`，前端直接渲染 base64 data URI。

## Acceptance Criteria

- [ ] AC-1: MCP 工具返回 `output_image` 时，Hub 前端自动显示图片
- [ ] AC-2: 图片可点击放大查看
- [ ] AC-3: 对所有 MCP 工具的 output_image 生效（不限于小红书）
- [ ] AC-4: 不需要猫猫额外操作（无需手动创建 rich block）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "添加一个feat 要做富文本返回 output_image" | AC-1 | screenshot + manual | [ ] |
| R2 | 图片可交互（放大查看） | AC-2 | manual | [ ] |
| R3 | 通用化，不限特定 MCP | AC-3 | test | [ ] |
| R4 | 自动化，不增加猫猫负担 | AC-4 | test | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（若适用）

## Links

- 触发场景：小红书 MCP `get_login_qrcode` 返回 output_image，Hub 无法显示
- Rich Block 规范：`cat-cafe-skills/refs/rich-blocks.md`
- 前端渲染：`packages/web/src/components/ChatMessage.tsx`（ImageContent）、`packages/web/src/components/rich/MediaGalleryBlock.tsx`

## Key Decisions

- **KD-1 (2026-03-04)**: 复用 `media_gallery` rich block，不新增类型。理由：富媒体本来就是要能发图发语音，output_image 是图片的一种来源，复用现有渲染组件最合理。（铲屎官拍板）

## Dependencies

- `Evolved from`: F022（rich blocks 基础设施）
- `Related`: 小红书 MCP 集成

## Risk

- 低：base64 图片可能较大，需考虑消息体积
- 低：安全性——需验证 base64 内容确实是图片

## Open Questions

1. ~~推荐路径 vs 备选路径~~ → **已决定：复用 `media_gallery`**（KD-1）
2. base64 图片是否需要先存到服务端再返回 URL？（大图片场景）

## Review Gate

- Reviewer: 跨家族优先（缅因猫）
- 验收: 铲屎官用小红书 QR 码场景端到端验证

## Timeline

- 2026-03-04: Kickoff（小红书 MCP 排查中发现需求）
