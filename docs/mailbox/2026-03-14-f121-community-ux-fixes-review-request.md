# Review Request: F121 Community Frontend UX Fixes (clowder-ai #22/#89/#28/#27)

## What

4 个社区报告的前端 UX 问题的上游完整修复：

1. **#22 mention dropdown overflow** — 容器从 `w-64` 加宽到 `w-72`，猫名加 `truncate`，描述加 `line-clamp-1`
2. **#89 sidebar collapse jump** — `findGroupKeyForThread()` 改为优先返回 project group，recent 作 fallback
3. **#28 status panel resize** — 复用 `ResizeHandle` + `usePersistedState` 模式，双击重置
4. **#27 scroll position restore** — 用 `Map<threadId, scrollTop>` 在 effect cleanup 保存、初始化时恢复，suppress replace-hydration 的自动滚底

**Branch**: `feat/f121-ux-fixes` (5 commits, 9 files, +144/-28)

## Why

铲屎官要求侦查社区 `clowder-ai` 的 UX issue 并做上游完整修复（opensource-ops Inbound B2 路线）。三猫分诊后确认这 4 个是 accept-bug/accept-enhancement，社区 PR #40/#43 质量不达标但方向正确，关闭后上游修。

## Original Requirements（必填）
> "你们三只猫猫加载一下开源管理的 Scalars，然后去社区看看有哪些是跟 UX 相关的优化"
> "不是所有的需求或者所有觉得是 enhance 的都需要 enhance，也不是所有他们认为的 bug 也是 bug，你们得定位清楚是不是有这个问题"
> "不要问我，你全部修完之后，让砚砚给你 review"
- 来源：本 thread 铲屎官语音消息（2026-03-14 09:38-11:00）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- #27 scroll position 用内存 Map 而非 localStorage — 刷新后丢失可接受，避免序列化开销
- #28 resize 范围 200-480px — 硬编码边界，与 sidebar resize 一致
- 没有为 #27 写 unit test — 逻辑全在 React effects + DOM refs 里，有意义的测试需要 E2E

## Open Questions

1. **#27 replace hydration 边界**：cached thread 有 unread 时 fetchHistory(replace) 会触发 append-scroll。用 `restoringScrollRef` 拦截了，但如果 replace 返回的消息数 < 缓存数，会走 "length decreased" 分支（无动作），这个 path 天然安全。请 reviewer 确认这个分析。
2. **#89 type 字段透传**：`use-collapse-state.ts` 的 groupsMeta 现在传了 `type: g.type`，这个 type 来自 `ThreadGroup.type`。请确认 type 字段的语义覆盖完整（pinned/recent/project/archived-container/favorites）。

## Next Action

请 @codex 做跨 family review。重点关注 #27 的 scroll effect 时序和 #89 的 group type 优先级逻辑。

## 自检证据

### Spec 合规
- F121 spec 4 个 code issue 全部 addressed
- 愿景：铲屎官要求社区 UX 问题上游修复 → 4/4 完成
- 设计稿对照：无 .pen 文件（⚠️ 无设计稿，有 UI 改动）

### 测试结果
- pnpm check → 0 errors ✅ (biome format + lint)
- pnpm lint → 0 errors ✅ (warnings 均为 pre-existing)
- pnpm -r --if-present run build → exit 0 ✅
- pnpm test → 60 failures 全为 pre-existing（main 分支同样 60 failures）
- 我们修改的测试文件：25/25 passed ✅
  - chat-input-mention-guard.test.ts: 3/3 ✅
  - use-collapse-state.test.ts: 22/22 ✅（含 2 个新增 #89 回归测试）

### 相关文档
- Feature: `docs/features/F121-community-frontend-ux-triage.md`
- BACKLOG: F121 row with community source links
- Community issues: clowder-ai #22, #89, #28, #27
- Community PRs closed: clowder-ai #40, #43
