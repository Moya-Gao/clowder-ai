---
feature_ids: [F071]
debt_ids: []
topics: [web, image-preview, lightbox, portal]
doc_kind: bug-report
created: 2026-03-12
---

# Lightbox Open Flicker

## 报告人

铲屎官，2026-03-12 07:37 在聊天区手动测试时发现。症状是点开已发送图片后，大图预览会持续闪烁。

## 复现步骤

1. 在聊天线程里发送一张图片
2. 点击消息气泡中的缩略图，打开大图预览
3. 观察打开后的 lightbox

### 期望 vs 实际

| # | 期望 | 实际 |
|---|------|------|
| 1 | 大图预览稳定覆盖整个 viewport | 大图预览持续闪烁，像在反复重绘 |
| 2 | lightbox 不受消息气泡 hover/overflow 影响 | lightbox 会被气泡的 hover transform 干扰 |

## 根因分析

`Lightbox` 当前直接渲染在 `ChatMessage` / `ImagePreview` / `MediaGalleryBlock` 的局部 DOM 里，而不是 portal 到 `document.body`。

问题路径：

1. `ChatMessage` 的消息气泡容器带 `transition-transform hover:-translate-y-0.5 overflow-hidden`
2. `ContentBlocks` 把 `<Lightbox />` 直接挂在这个气泡内部
3. 打开大图后，鼠标实际上悬停在 lightbox 蒙层上，但由于它还是父气泡的后代，父级 hover 仍然生效
4. 带 transform/overflow 的祖先会影响 fixed 定位层的 containing block 和裁剪行为，导致蒙层/图片发生抖动式重绘，表现为“持续闪烁”

根因不是图片资源本身，也不是业务消息状态抖动，而是 modal 容器层级错误。

## 修复方案

把 `Lightbox` 改成通过 React portal 渲染到 `document.body`，让它脱离消息气泡的 hover、transform 和 overflow 上下文。

配套约束：

1. 增加回归测试，要求 dialog 不再留在调用方容器内部
2. 保持现有关闭行为（Esc、背景点击、关闭按钮）不变

## 验证方式

- 组件测试：`Lightbox` 渲染后，`role="dialog"` 存在于 `document.body`，而不是调用容器内部
- 组件测试：现有 Esc / backdrop / close button 行为继续通过
- 手工验证：在聊天区点开已发送图片，大图预览不再闪烁
