# Review Request: F102 Phase H — Knowledge Emergence Feed

Review-Target-ID: f102-phase-h
Branch: feat/f102-phase-h

## What

Phase H 实现：将对话中涌现的 decision/lesson/method 知识可视化并提供人猫协同审核。

**后端（commit 9411c1c3）：**
- `SummaryCompactionTask` 新增 `submitCandidate` 回调，从摘要中提取 `[decision]`/`[lesson]`/`[method]` 标签自动提交到 MarkerQueue
- `knowledge-feed.ts` — 新 API 路由：GET /api/knowledge/feed（grouped 列表）、POST /approve、POST /reject、POST /undo、GET /stats
- explicit 置信度候选项自动走 captured→normalized→approved 链路

**前端（commit b184427f）：**
- `KnowledgeFeed.tsx` — 新组件：4 tabs（待确认/已沉淀/高频命中/值得升级）、KnowledgeCard with kind badges、approve/dismiss/undo actions、stats bar、60s auto-refresh
- `WorkspacePanel.tsx` — Workspace mode switcher（开发 | 知识）两种模式切换

**H-2 + H-8（commit 3321ee15）：**
- workspace navigate 端点扩展 `action: 'knowledge-feed'`（无需文件路径）
- chatStore 新增 `workspaceMode` / `setWorkspaceMode`
- useWorkspaceNavigate 联动 socket 事件驱动模式切换
- CLAUDE.md / AGENTS.md 添加 Knowledge Feed 猫猫指引

## Why

铲屎官原话："人是需要一个信息总入口以及可视化界面的，散落在各处的东西我如何搜集？"
对话中有价值的知识不应该散落在 thread 里被遗忘，而应该自动浮现 → 猫整理 → 人轻确认 → 反哺团队搜索。

## Original Requirements（必填）
> "如果涉及到审核，可能都得有ux哦，不然人类怎么和你们合作捏？"
> "不要做脚手架，而是考虑用户需求...产品最终形态是什么？"
> "放在Hub里...Workspace跟别人你浮在这上面的"
> "用铅笔画！记得用铅笔画哦"（设计稿已完成：`designs/F102-knowledge-emergence-feed.pen`）
- 来源：`docs/discussions/2026-03-22-knowledge-emergence-workspace-brainstorm.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 放弃原因 |
|------|----------|
| Hub 新 Tab | 铲屎官说"你要加第六个Tab会不会就很挤了"→ 改为 Workspace 面板内嵌 |
| 每条 interactive block 审核 | 铲屎官说"脚手架"→ 改为集中 Feed 入口 |
| 全自动沉淀 | 违反产品原则 P2"先建议后自动"——inferred 需要人确认 |

## Open Questions

1. **IMaterializationService** 还未实现（approved → docs/*.md 自动写入），当前 approved 状态是终态
2. **前端尚未浏览器实测**（需要 runtime 环境启动后验证）——请 reviewer 重点审查 React 逻辑正确性
3. KnowledgeFeed 组件 270 行，接近 200 行警告线但未超 350 硬上限

## Next Action

请 reviewer：
1. 审查后端 candidate 提取 + MarkerQueue 链路是否正确
2. 审查前端 KnowledgeFeed 组件 UX 逻辑（tabs/actions/auto-refresh）
3. 审查 chatStore.workspaceMode + socket 联动是否有竞态风险
4. 确认 CLAUDE.md/AGENTS.md 指引措辞是否准确

## 自检证据

### Spec 合规
- H-1 知识涌现 Feed：✅ 4 tabs + kind badges + actions
- H-2 自然语言联动：✅ workspace navigate + socket 驱动
- H-3 Candidate→MarkerQueue 链路：✅ submitCandidate 回调 + auto-approve
- H-8 配套 Skill：✅ CLAUDE.md + AGENTS.md 更新

### 测试结果
```
pnpm check                                    # ✅ 0 errors, 52 feature tests pass
pnpm --filter @cat-cafe/api lint              # ✅ tsc --noEmit clean
pnpm --filter @cat-cafe/web lint              # ✅ only pre-existing <img> warnings
node --test test/system-prompt-builder.test.js test/summary-compaction-task.test.js test/evidence-store.test.js
                                               # ✅ 69 passed, 0 failed
```

### 相关文档
- Feature: `docs/features/F102-memory-adapter-refactor.md` Phase H
- ADR: `docs/decisions/020-f102-memory-system-architecture.md`
- Discussion: `docs/discussions/2026-03-22-knowledge-emergence-workspace-brainstorm.md`
- Design: `designs/F102-knowledge-emergence-feed.pen` + `designs/F102-knowledge-emergence-workspace-integration.pen`
