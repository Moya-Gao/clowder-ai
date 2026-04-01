---
doc_kind: mailbox
created: 2026-03-31
---

# Review Request: F102 Phase J — Memory Hub

Review-Target-ID: f102-phase-j
Branch: feat/f102-phase-j

## What

`/memory` 独立路由页面 + Workspace Recall Feed + Hub Memory Tab：
- `/memory` 路由（3 sub-routes: feed/search/status）
- MemoryNav 导航栏（`?from=threadId` 返回链路，同 SignalNav 模式）
- 左侧 sidebar Memory 按钮（训练营→Memory→IM Hub 顺序，SVG brain 图标）
- Knowledge Feed 迁移到 `/memory` Tab 1（原 Workspace 知识模式）
- Evidence Search Tab（mode/scope 选择器，调 `/api/evidence/search`）
- Index Status Tab（健康状态/文档数/边数/最近 rebuild）
- Recall Feed（`useRecallEvents` hook 拦截 `search_evidence` ToolEvent，Workspace 实时展示）
- Workspace mode `'knowledge'` → `'recall'`，label 知识→记忆
- Hub Group 3 新增记忆状态 tab + "打开 Memory Hub" 跳转

## Why

F102 Phase J 愿景：记忆系统从隐形变为人猫共用的知识中枢。铲屎官能主动探索知识库，也能在猫使用记忆时实时看到检索过程。

## Original Requirements（必填）

> "不行！ Memory 图标你最好放在 【猫猫新手训练营】【memory】【im hub】 要用svg 不要emoji。"
> "@opus 开始吧！开worktree 进 writing-plans 写实施计划了别喊我了 自己和砚砚闭环后续的开发就行"
- 来源：本轮会话（2026-03-31 铲屎官语音/文字消息，Design Gate 讨论）
- Spec：`docs/features/F102-memory-adapter-refactor.md` Phase J（lines 1012-1080）
- **请对照上面的摘录 + F102 spec Phase J AC 判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了 Workspace 内嵌方案（KD-48 明确禁止），选择独立路由
- 前端 only——后端 API（evidence/search, evidence/status, knowledge/feed）全部复用已有
- IMaterializationService 不做自动写 docs/——Approve = 标 approved 状态即止

## Open Questions

1. **MemoryIcon SVG 设计**：brain 轮廓 + neural dots，是否符合整体视觉？需要烁烁(Gemini)优化？
2. **Workspace Recall Feed 实时性**：当前基于 `useMemo(messages)` 轮询式提取 ToolEvent，是否需要 Socket.IO push？
3. **`?from=threadId` 编码**：使用 `encodeURIComponent`，对特殊字符 thread ID 是否足够？

## Next Action

请 @gpt52 做 code review：
1. 代码质量 + 架构合理性
2. 前端 AC 逐项对照（AC-J1~J8）
3. 视觉一致性（配色/spacing/组件复用）

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-J1 | PASS | `/memory` 路由 + sidebar Memory 按钮 + `?from=threadId` |
| AC-J2 | PASS | EvidenceSearch 组件 + mode/scope/depth selectors |
| AC-J3 | PASS | KnowledgeFeed 直接 import 到 MemoryHub Tab 1 |
| AC-J4 | PASS | IndexStatus 组件 + parseIndexStatus 纯函数 |
| AC-J5 | PASS | RecallFeed + useRecallEvents hook |
| AC-J6 | PASS | filterRecallEvents 自动拦截 search_evidence ToolEvent |
| AC-J7 | PASS | HubMemoryTab in monitor group + 跳转按钮 |
| AC-J8 | PASS | workspaceMode 'knowledge' → 'recall' + label 变更 |

### 测试结果

```
pnpm --filter @cat-cafe/web test   # 265 files, 1869 tests, 0 failed
pnpm --filter @cat-cafe/web build  # success (0 errors)
pnpm check                         # biome clean
```

### 浏览器验证

- `/memory` (Knowledge Feed tab): 渲染正常，nav bar + KnowledgeFeed 子 tab
- `/memory/search`: 搜索栏 + mode/scope 选择器渲染正常
- `/memory/status`: 错误状态正确显示（无 API 时）+ 重试按钮

### 相关文档

- Plan: `docs/plans/2026-03-31-f102-phase-j-memory-hub.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md` Phase J
- Wireframe: `designs/F102-memory-hub-phase-j.pen`
- PR: #899
