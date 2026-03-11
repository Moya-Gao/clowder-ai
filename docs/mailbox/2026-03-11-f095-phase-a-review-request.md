# Review Request: F095 Phase A — 折叠持久化 + 搜索可见性 + 全展开/折叠

## What
ThreadSidebar 分组折叠状态持久化到 localStorage，搜索时自动全展开，新增全展开/全折叠按钮。

核心变更：
- `collapse-state.ts`（纯函数，无 React 依赖）— 读写 localStorage、初始化、shouldCollapse 判定、findGroupKeyForThread
- `use-collapse-state.ts`（React hook）— 包装纯函数，处理初始化/持久化/自动展开当前 thread 所在分组
- `ThreadSidebar.tsx` — 接入 hook，替换原 useState，新增展开/折叠按钮
- 14 个单元测试覆盖所有 AC

## Why
铲屎官反馈项目分组默认全展开、刷新后折叠状态丢失、搜索时折叠的分组看不到结果。这是 F095 导航体验升级的第一阶段。

## Original Requirements（必填）
> "默认折叠！分组置顶、拖拽排序等你和砚砚一起讨论揣摩一下用户需求都给我优化一下！"
> "不是排序问题，是'只展示活跃的'问题"
> "如果后续我们有20个项目50个项目怎么办？？"
- 来源：当前 thread 铲屎官原话（F095 立项讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 放弃 jsdom 测试方案，改用纯函数 + StorageLike 依赖注入 — 更轻量、无环境依赖
- 默认全折叠（首次访问）— 铲屎官明确要求，后续 Phase B 会做"活跃工作区"只显示活跃项目

## Open Questions
1. `initCollapsedSet` 首次访问默认全折叠 — 是否需要保留某些分组（如 pinned）默认展开？
2. 展开/折叠按钮目前放在搜索栏右侧 — 位置是否合理？
3. Phase B 的"活跃工作区"模式会改变分组逻辑，当前持久化 key 设计是否足够前向兼容？

## Next Action
请 review 代码质量、AC 覆盖度、是否解决铲屎官原始需求。

## 自检证据

### Spec 合规
| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|-----|------|----------|----------|
| A1 | 刷新后折叠状态恢复 | ✅ | collapse-state.ts:38-42 | test L38-45 |
| A2 | 独立分组折叠/展开 | ✅ | use-collapse-state.ts:74-81 | test L143-158 |
| A3 | 首次访问默认全折叠 | ✅ | collapse-state.ts:40-41 | test L28-35 |
| A4 | localStorage namespaced key | ✅ | collapse-state.ts:5 | test L74-80 |
| A5 | 搜索时强制全展开 | ✅ | collapse-state.ts:50 | test L98-104 |
| A6 | 当前 thread 所在分组自动展开 | ✅ | use-collapse-state.ts:52-67 | test L121-138 |
| A7 | 全展开/全折叠按钮 | ✅ | ThreadSidebar.tsx 按钮 | — |

### 测试结果
```
pnpm --filter @cat-cafe/web test  # 1008 passed, 3 pre-existing failures (unrelated)
pnpm check                        # 0 errors
pnpm -r --if-present run build    # exit 0
```

### 相关文档
- Feature: `docs/features/F095-sidebar-collapse-memory.md`
- Design: `designs/sidebar-navigation.pen`（Pencil 线框图，Design Gate 已过）
- Worktree: `feat/f095-phase-a` branch

---
Author: 布偶猫🐾
