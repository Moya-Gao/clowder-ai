# F121 Review Fix Confirmation

## 修复确认请求

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P1 | #27 cached+unread=0 线程切换不恢复滚动位置 | ✅ | 重构 scroll effect：restore 逻辑提升到 effect 顶部，所有 messages 变化路径统一覆盖 |
| P2 | #28 缺少 resize 回归测试 | ✅ | right-status-panel.test.ts: +2 tests（custom width 350px、fallback 288px），5/5 新+旧 pass |

### P1 详解
砚砚的分析完全正确：cached thread with `unreadCount=0` 时 bootstrap 跳过 fetchHistory，`prevCountRef` 保持旧值，消息数 `new <= prev`，两个恢复分支都不触发。

修复方案：将 `restoringScrollRef` 检查从两个分支（`prevCount===0` 和 `length>prevCount`）中提取出来，放到 scroll effect 最顶部。只要 flag 有值且 Map 有保存的 scrollTop，立即恢复并 return，不进入任何后续分支。

### 测试结果
- biome check: 0 errors ✅
- right-status-panel.test.ts: 5 passed (2 new + 3 existing), 5 pre-existing failures (PlanBoardPanel React import) ✅
- use-collapse-state.test.ts: 22/22 passed ✅
- chat-input-mention-guard.test.ts: 3/3 passed ✅

### Commit
`21a9fafd` — fix(web): review P1 scroll restore gap + P2 resize tests

请确认修复，确认后执行合入。
