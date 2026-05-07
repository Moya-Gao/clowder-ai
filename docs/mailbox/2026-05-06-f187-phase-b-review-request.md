---
feature_ids: [F187]
doc_kind: review-request
created: 2026-05-06
---

# Review Request: F187 Thread Labels Phase B — Sidebar 筛选 + 智能视图

Review-Target-ID: f187-phase-b
Branch: feat/f187-phase-b

## What

纯前端改动，在 ThreadSidebar 搜索框下方加入 LabelFilterBar 组件：

1. **LabelFilterBar.tsx**（新建 111 行）— 标签筛选条：inline chips (max 5) + overflow dropdown + "未分类" pill + clear 按钮
2. **ThreadSidebar.tsx**（+28 行）— 新增 `labelFilter` state + `labelFilteredThreads` memo + `uncategorizedCount` memo，替换 `threadGroups` 输入源

## Why

铲屎官原话："置顶都置顶了大几十个！" — pin 被迫承担分类职责，几十个置顶等于没有置顶。Phase A 建了 label 基座，Phase B 让用户通过标签筛选 sidebar thread 列表，减少信息噪声。

## Original Requirements（必填）

> "我发现我们现在置顶都置顶了大几十个！thread！我感觉导致这个问题是我们的收藏夹或者说也没有什么 tag 系统让我没办法分门别类我们的 thread，比如哪些是在拆技术（开源项目），哪些在 thread 开发，哪些是我们一起闲聊共创等等"

- 来源：`docs/features/F187-thread-labels.md` Why 段落
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 不做 AND 组合筛选（spec 明确留后续，V1 单选）
- 不做后端筛选 API（当前 thread 数量级 < 200，纯前端过滤足够）
- 筛选状态存 local state 不存 Zustand（ephemeral UI state，不持久化）

## Open Questions

- label 排序：Phase A 有 `sortOrder` 字段但管理 UI 不在本 Phase scope，当前按 API 返回顺序显示
- overflow 阈值 `MAX_INLINE=5` 是否合适？spec 说 5-6，实现取 5

## Next Action

请 reviewer：
1. 在 review 沙盒中启动服务，创建 6+ 标签
2. 验证筛选交互：点击标签→只显示该标签 thread，再点取消
3. 验证"未分类"视图：只显示无标签 thread
4. 验证 overflow："..." 下拉显示第 6+ 个标签
5. 验证 clear："✕" 清除筛选
6. 验证 search + filter 组合

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f187-phase-b/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer sandbox 会自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-B1 | ✅ | 标签筛选器：点击标签→只显示该标签 thread |
| AC-B2 | ✅ | "未分类"视图：显示无标签 thread |
| AC-B3 | ✅ | Phase A 已实现（commit 9bfa33169） |
| Overflow | ✅ | 6+ labels → 5 inline + "..." dropdown |
| Clear | ✅ | ✕ button clears active filter |
| Search+filter | ✅ | labelFilteredThreads chains after filteredThreads |

### 测试结果

```
pnpm test → 10211 passed, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build → exit 0 ✅
```

### 浏览器验证

截图保存在 `/tmp/cat-cafe-evidence/`：
- `f187-phase-b-filter-bar.png` — LabelFilterBar 渲染（5 inline chips + "..." + 未分类）
- `f187-phase-b-uncategorized-filter.png` — 未分类筛选激活 + ✕ clear 按钮
- `f187-phase-b-overflow-dropdown.png` — overflow dropdown 展开（第 6 个标签"设计"）

### 设计稿对照

无 .pen 设计稿（⚠️ 有 UI 改动但无设计稿）

### 根目录工件闸门

无根目录媒体/设计工件 ✅

### 相关文档

- Plan: `docs/plans/2026-05-06-f187-thread-labels-phase-b.md`
- Feature: `docs/features/F187-thread-labels.md`
- Phase A PR: #1576 (merged)

---

如果判断错了我最可能错在哪（pre-registered retraction）：
1. `useLabelStore` 的 `fetchLabels` 在 ThreadSidebar mount 时调用的时机——如果 store 初始化比渲染晚，可能出现 labels=[] 导致 LabelFilterBar 闪烁
2. `uncategorizedCount` 基于 `liveThreads` 而非 `filteredThreads`——如果搜索缩小了列表，未分类计数不跟着变（设计选择：全局计数 vs 搜索后计数）
3. overflow dropdown 的 z-index 可能被其他 sidebar 元素遮挡

[宪宪/Opus-46🐾]
