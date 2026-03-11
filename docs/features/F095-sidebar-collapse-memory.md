---
feature_ids: [F095]
related_features: []
topics: [frontend, ux, sidebar]
doc_kind: spec
created: 2026-03-10
---

# F095: Thread Sidebar 分组折叠状态记忆

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官截图反馈：Thread Sidebar 分组列表（置顶/dare-framework/studio-flow/cat-cafe/api/未分类/收藏）每个都默认折叠，每次进入都要手动展开。cat-cafe 有 174 条 thread 却排在第四位，找起来很痛苦。

铲屎官原话：
> "你看我们有这么多每个都展开而且我想用的 cat cafe 在这么下面！这也太难用了，能够记录我是不是展开或者默认折叠？"

核心痛点：**频繁使用的分组每次都要重新展开，没有持久化记忆**。

## What

### Phase A: 折叠状态持久化

1. **记忆展开/折叠状态**：用户展开或折叠某个分组时，将状态持久化到 localStorage
2. **恢复状态**：页面加载时读取 localStorage，恢复上次的展开/折叠状态
3. **默认行为**：首次访问（无记忆）时，所有分组默认折叠（保持现状）

## Acceptance Criteria

### Phase A（折叠状态持久化）
- [ ] AC-A1: 展开/折叠某分组后刷新页面，该分组保持上次的展开/折叠状态
- [ ] AC-A2: 多个分组可以各自独立记忆状态
- [ ] AC-A3: 首次访问（无 localStorage 记录）时保持现有默认行为（全部折叠）
- [ ] AC-A4: localStorage key 有命名空间前缀，不与其他功能冲突

## Dependencies

- **Related**: 无直接依赖，ThreadSidebar 现有组件改造

## Risk

| 风险 | 缓解 |
|------|------|
| localStorage 不可用（隐私模式等） | try-catch 降级为不记忆，不影响功能 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-10 | 立项（铲屎官截图反馈） |
