# Review Request: F095 Phase E/F/G — 滚动稳定 + 项目菜单 + 系统 thread

Review-Target-ID: f095
Branch: feat/f095-phase-efg

## What

Thread Sidebar 三个改进（铲屎官 2026-03-27 反馈）：

1. **Phase E**: 滚动位置稳定性 — `useScrollAnchor` hook，thread 重排时锚定当前可见内容
2. **Phase F**: Project context menu — Open in Finder / 编辑名称 / 归档 thread + 快速新建按钮
3. **Phase G**: 系统级 thread 分类 — IM Hub 连接器 thread 归入"系统"分区 + 删除打字确认

8 files changed, +575 -90

## Why

铲屎官反馈三个缺口：
- 滚动半天活跃 thread 上浮打断浏览
- 相比 Codex App 缺少项目管理功能
- IM Hub 系统 thread 丢在"未分类"里

## Original Requirements（必填）

> "翻了半天之后你们一往上移我啥东西又没了"
> "IM Hub 得在最左边收录到系统级的 thread 里面"
> "系统级 thread 不能支持用户删除或者要打字确认"（参考 Codex App 截图：Open in Finder / Edit name / Archive threads / quick create）

- 来源：铲屎官 2026-03-27 语音消息 + 截图，已记录在 `docs/features/F095-sidebar-collapse-memory.md` Phase E/F/G 段
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **E**: 选择锚定修正方案（捕获可见元素 + useLayoutEffect 补偿）而非延迟重排（spec 提到的方式）。优点：数据始终最新，不需要管理 pending reorder 状态
- **F**: Context menu 用 hover 按钮触发（非右键），更可发现
- **G**: 系统 thread 检测复用 `connectorHubState` 字段，未新增 `systemLevel` 布尔字段（spec 提到），减少数据模型变更

## Open Questions

1. **AC-G3 设计解读**: Spec 说"系统 thread 不显示删除按钮"，但同时引用 GitHub 删除仓库模式（GitHub 显示按钮 + 打字确认）。实现选择了 GitHub 模式：删除按钮可见，系统 thread 需打字输入名称确认。**请 reviewer 判断这个解读是否合理**
2. **E2 实现差异**: Spec 提到"defer reorder"，实现用 scroll anchor 替代。功能等价但机制不同

## Next Action

请 review 代码质量 + 愿景覆盖。放行后我走 merge-gate。

## 自检证据

### Spec 合规

Quality Gate 通过。15 个 AC 中 14 个完全符合，AC-G3 有设计解读差异（见 Open Questions #1）。

### 测试结果

```
pnpm --filter @cat-cafe/web test  → 241 files, 1717 tests passed, 0 failed ✅
pnpm --filter @cat-cafe/web lint  → 0 errors ✅
pnpm biome check (worktree)       → 1726 files, 0 errors ✅
pnpm -r --if-present run build    → exit 0 ✅
```

API test: Redis isolation guard failures (pre-existing, same on main) — non-blocking.

### 相关文档

- Feature: `docs/features/F095-sidebar-collapse-memory.md`
- No separate plan doc (铲屎官指示直接开写)
