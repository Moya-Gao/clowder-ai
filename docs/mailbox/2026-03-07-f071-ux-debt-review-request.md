# Review Request: F071 UX Debt Batch

## What
三个前端 UX 小修复：
1. **D1 图片预览**：提取 Lightbox 为共享组件，ChatMessage 图片点击从 `window.open` 改为 inline lightbox（Esc/背景点击关闭 + 复制按钮）
2. **D2 猫猫状态幽灵面板**：无活跃猫猫时显示"空闲"替代误导性的"等待调用..."
3. **D3 @ mention 下拉**：添加搜索过滤（匹配 label/id/insert）+ `max-h-80` 滚动容器 + 空结果提示 + fragment limit 4->12

## Why
- D1：铲屎官上传图片后无法预览，只能新标签打开，体验差
- D2：F5 刷新或切换 thread 后，状态面板显示"等待调用..."但实际无猫在工作，造成困惑
- D3：猫猫家族 9+ 个成员，下拉列表平铺无法快速定位

## Original Requirements
> 1. 上传的图片上传后不支持预览
> 2. 发送消息当前thread没有消息和猫猫在处理；但是任然提示有猫猫正在工作 一般发生在f5 或者切换到其他thread查看然后回来后
> 3. @现在猫猫家族的成员太多了。。我都看不到都有谁了 如何优化？
- 来源：铲屎官对话 2026-03-07 01:55
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- D1 选择提取共享 Lightbox 而非 npm 库（项目已有成熟实现，无需外部依赖）
- D2 选择改文案（"空闲"）而非从后端同步状态（方案 B 更简单，D2 的根因是 WS 不回放 intent_mode，完整修复需要后端改动，超出 debt 范围）
- D3 选择客户端过滤而非分组显示（过滤已足够解决"找不到"的问题，分组是锦上添花）

## Open Questions
1. D2 的"空闲"文案是否合适？或者整个 section 在无活跃猫时隐藏更好？
2. D3 fragment limit 从 4 改到 12，是否会引起其他副作用？（目前看逻辑安全）

## Next Action
请审查代码变更，关注：
- Lightbox 提取是否完整（MediaGalleryBlock 仍然正常工作）
- mention 过滤逻辑是否正确（大小写不敏感匹配）
- 状态面板变更是否影响其他场景

## 自检证据

### Spec 合规
- 3 个 AC 全部覆盖（D1 lightbox, D2 空闲文案, D3 搜索过滤+滚动）
- 愿景核对：铲屎官三个原始需求逐一对应

### 测试结果
```
pnpm --filter @cat-cafe/web test  → 128 files, 778 passed, 0 failed
pnpm lint                         → 0 errors (1 pre-existing warning)
pnpm --filter @cat-cafe/web build → exit 0, all pages compiled
```

### 变更统计
- 9 files changed, 153 insertions, 122 deletions
- 1 new file (Lightbox.tsx), 8 modified

### 相关文档
- Feature: `docs/features/F071-ux-debt-batch.md`
- BACKLOG: F071 entry added
