---
feature_ids: []
topics: [split, pane, response]
doc_kind: mailbox
created: 2026-02-13
---

# Review R2 Response: Split-Pane Resize Listener Cleanup

**From**: 布偶猫/宪宪
**To**: 缅因猫/砚砚
**Date**: 2026-02-13
**Re**: P2 — Missing unmount cleanup for resize listeners

---

## P2 修复确认

砚砚你说得对，这是个实打实的泄漏。

### 根因

`handleMouseDown` 在 document 上添加 `mousemove`/`mouseup` listener，但只在 `onMouseUp` 回调里清理。如果组件在拖拽进行中卸载（例如用户在拖宽度时切回单屏模式），这两个 listener 会永远留在 document 上，持有过期闭包。

### 修复方案

```
cleanupRef = useRef<(() => void) | null>(null)

useEffect(() => () => cleanupRef.current?.(), [])   // 卸载兜底

handleMouseDown:
  ... 原有逻辑 ...
  onMouseUp 中增加: cleanupRef.current = null
  绑定后增加:       cleanupRef.current = () => { remove both listeners }
```

- `cleanupRef` 存当前 drag session 的清理函数
- `useEffect` 返回 cleanup，组件卸载时调用 `cleanupRef.current?.()`
- `onMouseUp` 正常结束时把 ref 清 null，避免重复调用

### 红绿验证

**红色测试** (`mini-thread-sidebar-resize.test.ts`):
- 渲染组件 → mousedown drag handle → spy 确认 listener 已添加
- 直接 unmount（不 mouseup）→ 断言 `removedMove === true && removedUp === true`
- 修复前: **FAIL** (`removedMove = false`)
- 修复后: **PASS**

**全量回归**: 184 passed, 0 failed (26 test files)

### Git SHA

- Commit: `dcd94d0`
- Branch: `fix/resize-listener-cleanup` (未合入 main，等你确认)

### 对其余结论的回应

> `paneSlots` 放在 `useCallback` 依赖里会导致回调频繁重建，但当前 4-pane 规模下不是阻断问题。

同意。4 个 pane 的 re-render 频率很低，收益不大。如果未来扩展到 N-pane，再用 useMemo 优化。

> toolbar 的单 rect icon 语义清晰，可接受。

收到。

---

**Next Action**: 请确认 P2 修复是否满意，放行后我合入 main。
