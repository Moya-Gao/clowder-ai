---
doc_kind: review-request
created: 2026-03-28
---

# Review Request: F108 Scene 2 — WhisperCatSelector 下拉选择器

Review-Target-ID: f108-whisper-selector
Branch: feat/f108-whisper-selector

## What

用 `WhisperCatSelector` 组件替换 whisper mode 的 inline chips，匹配设计稿 Scene 2：
- 新组件：`WhisperCatSelector.tsx`（107 行）— dropdown-style 选择面板
- 每行：色圆头像 + "品种 · 昵称" + 状态徽章（执行中/空闲）
- 执行中的猫 grayed out + disabled
- 选中态：amber ring 高亮
- ChatInput.tsx：移除 inline chips 渲染，换用 WhisperCatSelector
- 3 个测试文件更新/新增

## Why

铲屎官在愿景守护中指出 whisper 猫选择器"有点丑"，确认需要按设计稿实现 Scene 2 的下拉选择器。Scene 5C（强制按钮）铲屎官已接受现状。

## Original Requirements（必填）

> "来吧！Scene 2 的下拉猫选择器实现出来 小闪电可以用 原本的 这个无所谓 原本也挺好"
> "你有没有觉得 猫选择器是 inline chips 而不是设计稿的下拉列表 现在这个有点丑的！"

- 来源：当前对话（2026-03-28 16:52/16:54）
- 设计稿：`designs/F108-side-dispatch-phase-b-ux.pen` Scene 2 (`PHA8w`)
- **请对照设计稿 Scene 2 截图判断交付物是否匹配铲屎官要的下拉选择器**

## Tradeoff

- 保持 `whisperTargets` 为 `Set<string>` 多选接口（设计稿看起来像 radio 单选，但功能需要多猫 whisper）
- 用 `CatData[]` 直接传入组件（而非 `CatOption[]`），因为需要 `breedDisplayName`/`nickname` 字段
- `buildWhisperOptions` 不再被 ChatInput 使用，但保留导出（测试仍引用）

## Open Questions

1. 设计稿的"色圆"是否需要改为真实头像图？当前用 `cat.color.primary` 填充圆，未用 avatar 图片
2. 面板当前固定在输入框上方内联显示——是否需要做 popover 浮层？

## Next Action

请 review 代码质量 + 设计稿 fidelity。如有 P1/P2 我修。

## 自检证据

### Spec 合规

- Scene 2 逐项对照：名称格式 ✅ | 色圆 ✅ | 状态徽章 ✅ | 禁用执行中 ✅ | 选中高亮 ✅
- Scene 5C 铲屎官已接受现状，不改

### 测试结果

```
pnpm --filter @cat-cafe/web test  # 1785 passed, 0 failed
pnpm gate                         # ✅ GATE PASSED (SHA: c3b2c736)
```

### 相关文档

- Feature: `docs/features/F108-side-dispatch-concurrent-invocation.md`
- Design: `designs/F108-side-dispatch-phase-b-ux.pen` Scene 2
