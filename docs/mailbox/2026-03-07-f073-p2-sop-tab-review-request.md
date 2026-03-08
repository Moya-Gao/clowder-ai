# Review Request: F073 P2 — SOP 告示牌 Tab (Mission Hub)

## What
在 Mission Hub 右侧 panel 新增第三个 mini-tab "SOP"，展示 workflow SOP 告示牌数据（stage pills、接力棒、resume capsule、checks badges）。

核心变更：
- `WorkflowSopPanel.tsx` (225行): 独立组件，调 `GET /api/backlog/:itemId/workflow-sop`，含 race guard + 404/error 处理
- `MissionControlPage.tsx`: 扩展 `rightPanelTab` 类型 + 新增 SOP tab 按钮 + 渲染 panel
- `workflow-sop-panel.test.ts`: 9 个测试覆盖所有状态

## Why
F073 告示牌哲学的前端可视化层。P1 已合入 backend（Redis store + API + MCP tools），P2 让铲屎官在 Mission Hub 直接看到每个功能的 SOP 进度。

## Original Requirements（必填）
> 铲屎官："有个问题你的告示牌要放在哪里？新增一个tab吗？"
> 铲屎官："你看我调整了一下,把那两个丑丑的变成了两个内部的Tab。你这个好像也可以。"
> 铲屎官："可以哦,我这个已经在面上了,你可以开始改了。"
- 来源：本会话铲屎官消息（2026-03-07 17:57~18:01）
- **请对照上面的摘录判断：SOP tab 是否正确集成到铲屎官已有的 mini-tabs 中？**

## Tradeoff
- 告示牌是只读展示，不提供编辑功能（编辑走 MCP `cat_cafe_update_workflow`）
- 没有 WebSocket 实时推送，切 tab / 切 item 时 fetch（足够用，告示牌更新频率低）

## Open Questions
1. `MissionControlPage.tsx` 已 631 行（超 350 硬上限），但这是铲屎官自己的修改积累，我只加了 15 行集成代码。需要拆分吗？
2. Stage pills 用固定 6 阶段，如果后续 SOP 阶段变化需要改常量

## Next Action
请 review 代码质量 + 告示牌展示是否完整覆盖 P1 的 WorkflowSop 类型字段。

## 自检证据

### Spec 合规
- 愿景覆盖：铲屎官三条需求全部满足（mini-tab 集成、4 区域展示、选中项切换）
- 所有 WorkflowSop 字段均有对应 UI 渲染

### 测试结果
pnpm --filter @cat-cafe/web test       # 138 files, 875 passed, 0 failed
pnpm -r --if-present run build         # 成功 exit 0
biome check                            # 0 errors in changed files

### 相关文档
- Feature: F073 / Mission Hub 告示牌化
- P1 PR: #278 (merged)
- Design: `designs/mission-hub-坏猫采访.pen` frame Thh2F
