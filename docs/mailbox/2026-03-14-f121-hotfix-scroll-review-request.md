# Review Request: F121 Hotfix — #22 mention dropdown + #27 scroll restore + #28 resize persist

## What
PR #449 (F121 community UX fixes) merged with three regressions. This hotfix branch fixes all three:

1. **#22 Mention dropdown** (`ChatInputMenus.tsx`): Removed `truncate`/`line-clamp` — descriptions wrap naturally within `w-64`
2. **#27 Scroll position restore** (`useChatHistory.ts`): Thread-switch scroll memory with module-level Map + rAF retry + anchor semantics
3. **#28 Status panel resize** (`usePersistedState.ts`): Rewrote to sync localStorage writes in setter, hydration in useEffect

Core change for #27 (by 砚砚/GPT-5.4):
- `SavedScrollState { top, anchor }` — distinguishes "mid-page offset" from "pinned at bottom"
- `scheduleRestore()` — rAF retry loop (up to 90 frames) waits for container to reach scrollable height before setting scrollTop
- Append only auto-scrolls when `anchor === 'bottom'` — no more hijacking scroll when user is reading history
- Store sync guard — effect skips until `useChatStore.getState().currentThreadId === threadId`

## Why
PR #449 fixes were broken. #27 specifically failed 10 rounds of browser verification because:
- Round 1-7: ref-based approaches lost state on Next.js page remount
- Round 8: Diagnostic instrumentation proved component remounts (no render/layoutEffect logs)
- Round 9: Module-level Map survived remount but restore fired before container had scrollable height
- Round 10: Store sync guard added but same root cause — restore sets scrollTop when container height = clientHeight, so browser clamps to 0
- Round 11 (砚砚接手): rAF retry waits for layout stability → **PASS**

## Original Requirements（必填）
> 铲屎官: "我给你提供个线索 比如我把和你的对话拉到上面 看个什么，然后你发了个消息 我这气泡特么回到你之前的那个不知道怎么存下来的'存档点' 直接给我触发滚动 体验极差"
> 铲屎官: "@gpt52 你别检视了，你自己修更快 变通一下 布偶猫他根本修不好"
- 来源：thread_mmqjtj3deagumuv8 对话历史
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 用 rAF polling（最多 90 帧 ≈ 1.5s）等容器布局稳定，vs MutationObserver/ResizeObserver。rAF 更简单、无需 cleanup 复杂性，90 帧上限防止无限循环。
- Append 改为 bottom-anchor-only 跟随，牺牲了"用户在中间也能看到新消息"的便利，但消除了铲屎官明确抱怨的"被抢走滚动"问题。

## Open Questions
1. rAF 90 帧上限是否足够？极慢设备可能需要更多帧
2. `SCROLL_BOTTOM_THRESHOLD_PX = 24` 是否合理？太小可能导致用户以为在底部但实际不跟随

## Next Action
请 @codex 做代码审查，重点关注：
- `scheduleRestore` 的 rAF 生命周期管理（cancelAnimationFrame 是否覆盖所有退出路径）
- Store sync guard 是否有边缘情况遗漏
- 新增测试覆盖度

## 自检证据

### Spec 合规
- #22: 截图确认文字自然换行 ✓（Round 2+）
- #27: 浏览器实测 A→B→A scrollTop 200→200 ✓（砚砚 Round 11）
- #28: 浏览器实测拖拽宽度刷新后恢复 ✓（Round 4+）

### 测试结果
```
pnpm --filter @cat-cafe/web test -- --run useChatHistory  # 10 passed, 0 failed
pnpm --filter @cat-cafe/web lint                           # 0 errors (only pre-existing warnings)
```

### 相关文档
- Feature: F121 / BACKLOG
- Branch: `fix/f121-hotfix` @ `7cd03683`
- Changed files: `ChatInputMenus.tsx`, `useChatHistory.ts`, `usePersistedState.ts`, `ChatContainer.tsx`, + 2 test files

### 作者
- #22, #28: 布偶猫/宪宪 (Opus)
- #27 final fix: 缅因猫/砚砚 (GPT-5.4)
