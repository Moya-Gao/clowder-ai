# F246 Phase C: Workspace Integration + Responsive Tab Bar

**Feature:** F246 — `docs/features/F246-approval-hub.md`
**Goal:** Approval Hub 从 drawer overlay 迁移到 workspace panel 顶层 tab；workspace tab bar 支持响应式宽度适配
**Acceptance Criteria:** AC-C1 ~ AC-C8（见 F246 spec Phase C）
**Architecture cell:** platform-infra（subcell: `approval-index`）+ web-shell（subcell: `workspace-panel`）
**Map delta:** none — 扩展现有 WorkspacePanel 路由 + chatStore 的 workspaceMode union，不新增架构 cell
**Map delta why:** WorkspacePanel 已有 mode switcher 机制，加一个 mode 是增量扩展不改边界
**前端验证:** Yes — reviewer 必须用浏览器实测 tab 响应式 + 审批 tab 功能

---

## Task 1: chatStore WorkspaceMode 类型扩展

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts` — WorkspaceMode union 加 `'approval'`

**Step 1: 修改 WorkspaceMode 类型**

`chatStore.ts` 中两处 WorkspaceMode 类型声明（L1024, L1025）加 `| 'approval'`：

```typescript
// L1024
workspaceMode: 'dev' | 'recall' | 'schedule' | 'tasks' | 'community' | 'artifacts' | 'approval';
// L1025
setWorkspaceMode: (mode: 'dev' | 'recall' | 'schedule' | 'tasks' | 'community' | 'artifacts' | 'approval') => void;
```

`setWorkspaceMode` 实现（L1621）已自动 `set({ rightPanelMode: 'workspace' })`，新 mode 无需额外逻辑。

**Step 2: Commit**

```bash
git commit -m "feat(F246): add 'approval' to WorkspaceMode union"
```

## Task 2: ApprovalPanel workspace 组件

**Files:**
- Create: `packages/web/src/components/ApprovalPanel.tsx`
- Test: 在 Task 5 统一测试

**Step 1: 创建 ApprovalPanel**

从 `ApprovalHubDrawer.tsx` 提取内容部分（去掉 drawer chrome / backdrop / fixed positioning），包裹在 workspace 容器布局中：

```tsx
// ApprovalPanel.tsx — workspace 模式下的审批面板
// 复用 ApprovalItemCard + useApprovalHubStore
// 全宽布局（flex-1），不是 380px 固定宽
// 包含：header（标题 + count badge）+ 内容列表（items.map → ApprovalItemCard）
// 加载/空/错误 三态处理（同 drawer 逻辑）
```

**Step 2: Commit**

## Task 3: WorkspacePanel 路由 + Tab 按钮

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx` — 加审批 tab button + mode routing

**Step 1: 加审批 tab 按钮**

在 tab bar（L752 区域）的产物按钮后面加审批按钮：

```tsx
<button
  type="button"
  onClick={() => setWorkspaceMode('approval')}
  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-semibold transition-all ${
    workspaceMode === 'approval'
      ? 'bg-cafe-surface text-cafe-interactive border border-cafe-subtle/60'
      : 'text-cafe-interactive/40 hover:text-cafe-interactive/60'
  }`}
>
  <BellIcon className="w-3 h-3" />
  审批
</button>
```

**Step 2: 加 mode routing**

在 content routing 区域（L876 之后）加：

```tsx
{workspaceMode === 'approval' && <ApprovalPanel />}
```

**Step 3: Commit**

## Task 4: Bell 铃铛行为变更

**Files:**
- Modify: `packages/web/src/components/ActivityBar.tsx` — bell click → workspace approval tab
- Modify: `packages/web/src/components/AppShell.tsx` — 移除 ApprovalHubDrawer 渲染

**Step 1: 修改 ApprovalHubButton onClick**

```tsx
// Before: onClick={toggle} (toggles drawer)
// After: onClick → setWorkspaceMode('approval')
// setWorkspaceMode 已自动 set rightPanelMode='workspace'
// 如果 workspace 已打开且已在 approval tab → toggle 关闭（保留快捷切换体感）
```

需要从 chatStore 取 `setWorkspaceMode` + `workspaceMode` + `rightPanelMode`：
- 当前不在 approval → `setWorkspaceMode('approval')` 打开
- 当前已在 approval + workspace 打开 → toggle 关闭（`setRightPanelMode('status')`）

**Step 2: AppShell 移除 drawer**

```diff
- <ApprovalHubDrawer />
+ {/* F246 Phase C: drawer deprecated — approval now lives in workspace panel */}
```

**Step 3: Commit**

## Task 5: Workspace Tab Bar 响应式

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx` — tab bar 响应式逻辑
- Test: `packages/web/src/components/workspace/__tests__/workspace-tab-overflow.test.tsx`

**Step 1: 写失败测试**

```tsx
// workspace-tab-overflow.test.tsx
// 1. 宽容器（500px）→ 所有 7 个 tab 文字可见
// 2. 中容器（300px）→ 部分 tab 收入 overflow dropdown
// 3. 窄容器（200px）→ icon-only 模式
// 4. overflow dropdown 点击切换 mode
```

**Step 2: 实现响应式 tab bar**

核心逻辑：

```tsx
// useResizeObserver 或从 ResizeHandle 获取 panel 宽度
const [barWidth, setBarWidth] = useState(0);
const tabBarRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!tabBarRef.current) return;
  const obs = new ResizeObserver(([entry]) => setBarWidth(entry.contentRect.width));
  obs.observe(tabBarRef.current);
  return () => obs.disconnect();
}, []);

const TABS = [
  { mode: 'dev', label: '开发', icon: <CodeIcon /> },
  { mode: 'recall', label: '记忆', icon: <BrainIcon /> },
  { mode: 'schedule', label: '调度', icon: <ClockIcon /> },
  { mode: 'tasks', label: '任务', icon: <TargetIcon /> },
  { mode: 'community', label: '社区', icon: <UsersIcon /> },
  { mode: 'artifacts', label: '产物', icon: <LayersIcon /> },
  { mode: 'approval', label: '审批', icon: <BellIcon /> },
];

const TAB_FULL_WIDTH = 65;  // icon + 2 chars + padding
const TAB_ICON_WIDTH = 36;  // icon-only + padding
const OVERFLOW_WIDTH = 32;  // ⋯ button

const visibleCount = Math.min(
  TABS.length,
  Math.floor((barWidth - OVERFLOW_WIDTH) / TAB_FULL_WIDTH)
);
const iconOnly = barWidth < TABS.length * TAB_ICON_WIDTH;
const needsOverflow = visibleCount < TABS.length;
```

**Step 3: Overflow dropdown**

```tsx
// 溢出的 tab 进入 Popover/dropdown
// 每个项：icon + label，onClick → setWorkspaceMode(mode)
// 当前选中 mode 在 overflow 中高亮
```

**Step 4: 运行测试确认绿灯**

**Step 5: Commit**

## Task 6: 清理 + 集成测试

**Files:**
- Modify: `packages/web/src/stores/approvalHubStore.ts` — 可选：移除 isOpen/toggle（drawer 专用状态）
- Deprecate: `packages/web/src/components/ApprovalHubDrawer.tsx` — 加 deprecated 注释但暂不删
- Existing tests: 确认 `approval-hub-drawer.test.tsx` 等现有测试更新或标记

**Step 1: approvalHubStore 清理**

- `isOpen` / `open` / `close` / `toggle` 是 drawer 专用状态
- Phase C 后不再需要（workspace panel 的开闭由 chatStore.rightPanelMode 控制）
- 但为了向后兼容先保留，标注 `@deprecated`
- `items` / `count` / `fetchPending` / `approveProposal` / `rejectProposal` / `deciding` 继续使用

**Step 2: 全量测试 + lint + build**

```bash
pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build
```

**Step 3: Final commit**

---

## Open Questions

| # | 问题 | 类型 | 处置 |
|---|------|------|------|
| OQ-1 | Tab 顺序：审批放最后还是插到任务后面？ | 技术 | 先放最后（最新加入），用户反馈后可调 |
| OQ-2 | Overflow 时哪些 tab 优先保留？ | 技术 | 按声明顺序从左到右保留，溢出从右截断（审批在最后但有铃铛常驻兜底） |
| OQ-3 | ApprovalHubDrawer 何时正式删除？ | 技术 | Phase C merge 后下一个 PR 清理，不同 PR 删 |
