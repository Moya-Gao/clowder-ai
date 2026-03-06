# Review Request: F060 Phase 2 — lightbox + copy-to-clipboard for media gallery images

## What

MediaGalleryBlock.tsx 增加两个交互能力（1 file, +113 -21）：

1. **Lightbox (AC-2)**: 点击图片 → 全屏遮罩 + 大图预览，Escape/背景点击关闭，`role="dialog"` + `aria-modal` 无障碍
2. **CopyButton (AC-5)**: hover 显示 Copy 按钮，`fetch → blob → ClipboardItem` 复制图片到剪贴板，data URI 和 URL 都支持，失败降级为文本复制

## Why

铲屎官在 MCP 工具返回的图片（如小红书 QR 码）上没有交互能力——不能放大看清楚，不能复制粘贴到别处。Phase 1 解决了"能看到"，Phase 2 解决"能交互"。

## Original Requirements

> "图片可交互（放大查看）" — F060 spec R2
> "方便我复制" — 铲屎官 2026-03-05 18:50 thread_mm4dj9jp0tij0ch3

- 来源：`docs/features/F060-output-image-rich-block.md` AC-2, AC-5
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 未使用 next/image：MCP 返回的 data URI 无法被 next/image 优化（需要外部 URL），biome-ignore 注释已说明
- 未做 lightbox 左右切换（gallery 中多图场景）：Phase 2 scope 聚焦单图放大 + 复制，多图切换如需后续补
- CopyButton 用 `ClipboardItem` API：需要 HTTPS 或 localhost，但 Cat Cafe Hub 已满足

## Open Questions

1. **Copy 按钮位置**：当前在图片右上角 hover 显示，lightbox 内底部也有。位置是否合适？
2. **Copied! 反馈时长**：2 秒后消失，是否足够？
3. **是否需要右键菜单复制**：当前只有 hover 按钮，未覆盖右键场景（浏览器原生右键已支持"复制图片"对普通 img）

## Next Action

请 review 以下重点：
1. `MediaGalleryBlock.tsx:6-10` — `copyImageToClipboard` 的 fetch → blob 路径是否健壮
2. `MediaGalleryBlock.tsx:44-83` — Lightbox 的 a11y 和键盘交互是否充分
3. 整体：是否有安全隐患（XSS via data URI、内存泄漏等）

## 自检证据

### Spec 合规

| # | 铲屎官原始需求 | AC | 实现？ |
|---|---------------|-----|--------|
| 1 | 图片放大查看 | AC-2 | Lightbox 组件 |
| 2 | 方便复制 | AC-5 | CopyButton 组件 |

### 测试结果

```
pnpm lint                          # 0 errors
biome check MediaGalleryBlock.tsx  # 0 errors
pnpm --filter @cat-cafe/web build  # exit 0
API tests: 3158 pass, ~263 fail (pre-existing on main ~261, 无新增)
```

### 相关文档

- Feature: `docs/features/F060-output-image-rich-block.md`
- Branch: `feat/f060-phase2`
- Phase 1 PR: merged (codex R1→R2 通过)
