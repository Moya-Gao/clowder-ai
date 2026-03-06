# Review Request: F058 Phase H — Mission Hub UX 重设计

## What

Mission Hub 主视图从 kanban 三列布局重构为 **Feature-centric 两 Tab 信息架构**：

1. **功能列表 Tab**（默认）：Feature 行列表，一行一 Feature，显示状态 dot + 进度 badge + 线程数 + inline 展开详情
2. **依赖全景 Tab**：grid-constrained DAG 拓扑图，节点按 Feature 状态着色，done 节点半透明
3. **侧边栏入口图标**（AC-H1）：给 Mission Hub 按钮加了 dashboard grid SVG icon
4. **Referrer-based 返回按钮**（AC-H2）：从 sidebar 进入时带 `?from=threadId`，Mission Hub 的返回按钮返回来源 thread
5. **状态栏**（AC-H5）：顶部 3 dot 显示 待审批 / 执行中 / 已完成 计数
6. **已完成折叠**（AC-H6）：全 done 的 Feature 沉到底部折叠区，点击展开

**改动范围**：6 files（4 modified + 2 new），前端 only，无 API 改动。

## Why

铲屎官直接反馈 kanban 布局 UX 太差（原话见下方），经四猫独立思考 + 收敛讨论（Opus 4.6/4.5、Codex、Gemini），决定用 Feature-row 为主轴 + 两 Tab 分离操作型和理解型视角（KD-4），替代原来的 Open/Suggested/Dispatched 三列。

## Original Requirements（必填）

> "现在这种 ux 太差了 可能需要有些变成 tab 隐藏或者切换？你想想看跳出最开始砚砚设计的这个 ux 体验思考我要如何看什么时候可能看什么"
> "你最好先画出设计图我看看的？别用他现在这个丑丑的 包括入口好像也能从 mission hub 纯粹文字然后加一个图标好看点 以及返回哪个按钮现在是返回 default thread 很难用 你得返回我之前在的 thread 能做到吗？"

- 来源：`docs/features/F058-mission-control-enhancements.md` L273-276（Phase H 讨论记录 → 铲屎官原话）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **放弃 kanban 三列布局** — 原来的 Open/Suggested/Dispatched 三列是以 status 为主轴，铲屎官心智模型是 Feature 级别不是 task 级别
- **不用搜索优先方案**（Opus 4.5 提案）— 铲屎官可能习惯点击不习惯打字，Feature 行列表更直观
- **从"无 Tab"回退到"两 Tab"**（KD-4）— 功能列表（操作型）和依赖全景（理解型）是本质不同的视角，硬塞在一起都做不好
- **依赖全景用 grid 不用 SVG 连线** — grid-constrained 保证不突破屏幕宽度（KD-5），SVG 箭头实现复杂且移动端适配差

## Open Questions

1. **Feature 名称提取逻辑**：目前从 `[F058] xxx` 标题格式提取，如果标题没有方括号前缀则 fallback 到完整标题。Reviewer 看看这个 heuristic 是否够用？
2. **依赖全景的 edge 渲染**：当前用文字列表替代 SVG 连线（"F049 → F058 演化"），reviewer 觉得可读性如何？
3. **Tab 切换不保留 URL state** — 目前用 React state，刷新回到默认 Tab。是否需要 URL query param 持久化？

## Next Action

请 @codex review 全部改动，重点关注：
- Feature-row 数据流（items → groupBy feature → active/done split）
- 依赖全景的 edge 去重逻辑（related 双向 → 只保留 id < 对方的那条）
- 测试覆盖是否充分（12 旧测试迁移 + 5 新测试）

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-H1 侧边栏图标 | ✅ | ThreadSidebar.tsx L279-293 dashboard grid SVG |
| AC-H2 Referrer back | ✅ | MissionControlPage.tsx referrerThread memo + 条件渲染 |
| AC-H3 Feature 行列表 | ✅ | FeatureRowList.tsx（新文件 312 行） |
| AC-H4 Inline 展开 | ✅ | FeatureRow 组件 expanded state + tasks/threads detail |
| AC-H5 状态栏 | ✅ | StatusDot × 3（pending/active/done counts） |
| AC-H6 Done 折叠 | ✅ | mc-feature-done-section collapsible |
| AC-H7 保留快速创建/导入 | ✅ | 按钮保留在 header |
| KD-4 两 Tab | ✅ | activeTab state + 功能列表/依赖全景切换 |
| KD-5 屏幕宽度约束 | ✅ | DependencyGraphTab grid-cols-2/3/4 |

### 测试结果

```
pnpm test → 119 files, 727/727 pass ✅
pnpm lint → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- Spec: `docs/features/F058-mission-control-enhancements.md`（Phase H section）
- Plan: `docs/plans/2026-03-04-f058-mission-control-enhancements.md`
- Design: `designs/mission-hub-坏猫采访.pen`
- Feature: F058 / BACKLOG
