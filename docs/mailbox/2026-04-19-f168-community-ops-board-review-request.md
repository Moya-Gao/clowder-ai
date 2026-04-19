# Review Request: F168 Community Operations Board — Phase A-C

Review-Target-ID: f168
Branch: feat/f168-community-ops-board

## What

社区事务编排引擎的 Phase A-C 完整实现：

- **Phase B（数据层）**: `CommunityIssueItem` 类型 + Redis 存储 + `derivePrGroup()` PR 分组推导 + REST API (CRUD + board aggregation)
- **Phase A（流程层）**: Direction Card 结构化模板 + 双猫交叉评估指令 + repo-inbox/SKILL.md 集成
- **Phase C（视图层）**: `workspaceMode` 扩展 `community` + `Thread.preferredWorkspaceMode` 自动切换 + `CommunityPanel` 看板组件 + WorkspacePanel 接入

10 commits, 29 new tests (11 derivePrGroup + 10 store + 8 routes).

## Why

铲屎官是人肉 dispatcher：手动 @ 猫看 issue/PR、手动分配线程、手动跟进进度。现有 F141（发现层）+ F116（ops skill）有流程定义但缺状态管理。本 PR 建立台账 + 看板 + 流程模板，把铲屎官从 dispatcher 降级为 decision-maker。

## Original Requirements（必填）

> "现在全看我喊你们去看有点麻烦"
> "你们得想想得做管理的啊，不然上次这个任务派发给什么线程的猫，然后他们进度如何"
> "不应该和失败的 mission hub 那样放在独立的页面。应该和成功的 workspace 里面的 tab 一样挂在右边"
> "打开了社区系统 thread，右边可以看到社区事务管理，然后里边就是看板了"
> "别用 emoji 用 SVG"

- 来源：`docs/features/F168-community-ops-board.md`「铲屎官原话」section（2026-04-18 讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. PR 不另建存储——投影自现有 `pr_tracking` TaskItem（KD-11 gpt52 review P1）。好处是单一真相源，代价是看板查询要走 TaskStore 过滤
2. Direction Card 用 `RichCardBlock`（`kind: 'card'`）文本 badge 降级——`card.fields` 目前不支持 `icon` 字段，SVG 图标需后续扩展 `CardField` 类型
3. AC-C6 click-to-navigate 和 AC-C7 高级筛选降级——无现有 `navigateToThread()` API，初版按铲屎官原话 "最开始的 A-C 的完整版本" 只做 repo 筛选

## Open Questions

1. **AC-C6**: `CommunityPanel` item 行有 `cursor:pointer` 但无 click handler。需要 `navigateToThread(threadId)` API——这应该在本 PR 加还是另开 PR？
2. **AC-C7 筛选**: 当前仅 repo 筛选。状态/猫/时间筛选是否等 Phase D？
3. **AC-C10**: 无 .pen 设计稿。是否需要先 @ 烁烁出稿再合入，还是先合入功能后迭代视觉？
4. **derivePrGroup 优先级**: re-review-needed > has-conflict（新 commit + CI 绿 优先于冲突）。这个优先级合理吗？

## Next Action

请 @codex 做跨 family code review，重点关注：
- 数据模型设计（`CommunityIssueItem` 字段完备性）
- `derivePrGroup` 推导逻辑正确性
- Redis 存储实现（TTL=0、Lua guard、序列化/反序列化）
- 路由注册 + board aggregation 逻辑
- WorkspacePanel auto-switch 对现有测试的影响

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（review:start 自动分配）

## 自检证据

### Spec 合规

Quality gate report 通过（见上方对话）。Phase A-C 共 24 个 AC，20 个 ✅，4 个 ⚠️（AC-C1 运行时关注/AC-C6 降级/AC-C7 降级/AC-C10 无设计稿）。

### 测试结果

```
pnpm --filter @cat-cafe/api test       # 8644 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test       # 2252 passed, 0 failed ✅
pnpm check                             # 0 errors ✅ (biome format + lint)
pnpm lint                              # 0 errors ✅ (pre-existing warnings only)
pnpm -r --if-present run build         # 6 packages exit 0 ✅
```

### Artifact Hygiene

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → (empty) ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|...)$'  → (empty) ✅
```

### 相关文档

- Feature: `docs/features/F168-community-ops-board.md`
- Plan: `docs/plans/2026-04-18-f168-community-ops-board.md`
- Design Gate: gpt52 三轮 review 通过（KD-10/11/12 已纳入 spec）
