---
feature_ids: [F198]
related: [docs/features/F198-claude-code-subscription-carrier.md]
doc_kind: plan
created: 2026-05-15
status: ready-for-implementation
owner_design: opus-47 (布偶猫 Opus 4.7)
owner_implementation: sonnet (布偶猫 Sonnet 4.6)
owner_review: codex (缅因猫 GPT-5.5)
owner_vision_guardian: opus-47
---

# F198 Phase C — Hub Oversight 实施计划

> **Scope**：完整 6 AC 单 PR 闭环（铲屎官 2026-05-15 03:25 拍板选 A）
>
> **代码预算**：800-1500 行
>
> **PR 策略**：一次单 PR，分支 `feat/F198-phase-c-oversight`，禁止拆分

## 当前 baseline（worktree 已建好）

- ✅ Worktree: `cat-cafe-F198-phase-c-oversight`，分支 `feat/F198-phase-c-oversight`
- ✅ `.env.local`: `WORKTREE_PORT_OFFSET=-30`（Redis 6368 / API 3132 / Web 5132）
- ✅ `pnpm install` 完成
- ✅ Baseline `pnpm --filter @cat-cafe/api test` 通过

## 现状审计回顾（铲屎官今天能看到的）

- ✅ Thread 气泡：text / tool_use / tool_result / error / system_info（`ChatMessage.tsx` + `CliOutputBlock.tsx`）
- ✅ 侧边栏状态点：idle/working/done/error（`ThreadCatStatus.tsx` 读 `threadState.catStatuses[catId]`）
- ✅ F089 tmux pane：read-only stream OK（`AgentPaneViewer.tsx` + `/api/terminal/agent-panes/{paneId}/ws`）
- ❌ daemon `state.json.detail` 进度文字（"searching for X" / "loaded MCP tools..."）只在 error 时露
- ❌ Tmux pane 不知道当前承载哪个 invocation / cat
- ❌ 没 deep-dive 视图（active sessions / process tree / 累计 token）
- ❌ Thread 气泡没"接管"按钮入口
- ❌ 状态点没 detail tooltip

## 5 件实施事 → 文件 + 设计 + 测试

### #1 Backend: daemon `state.detail` 进 AgentMessage stream（AC-C2）

**改的文件**
- `packages/api/src/domains/cats/services/types.ts` — `AgentMessageType` 加 `'status'`，注释说明语义（transient 进度，不渲染为气泡，更新 per-cat tooltip）
- `packages/api/src/domains/cats/services/agents/providers/ClaudeBgCarrierService.ts` — 在 working 阶段 poll `JobStateSnapshot.detail`，detail 变化时 yield `{ type: 'status', catId, content: detail, timestamp }`
- `packages/api/src/domains/cats/services/agents/providers/__tests__/ClaudeBgCarrierService.status.test.ts` — 新建（目前没 carrier 直接单测，砚砚 Step 2 走的 BgTranscriptEventConsumer pure-function 路径）

**设计要点**
- detail 防抖：相邻 ≥ 2 秒或 detail 字符串真变化才 emit（防止 timeline 噪音）
- 不渲染气泡：`textMode` 不设；frontend 路由到 catStatuses state，不进 timeline list
- 错误兼容：detail = null/空字符串时不 emit

**测试**
- Red: 模拟 state.detail 从 "starting…" 变 "searching for X"，期望 carrier yield 2 条 `status` AgentMessage
- Red: 同一 detail 连续 5 个 poll，只 yield 1 次（去重）
- Red: detail = null 不 emit

### #2 Backend + Frontend: tmux pane ↔ thread invocation 联动（AC-C1）

**改的文件**
- `packages/api/src/domains/terminal/AgentPaneRegistry.ts`（搜索定位）— 加 invocation metadata：`{ paneId, invocationId, catId, daemonShortId, threadId, createdAt }`
- `packages/api/src/.../routes/agent-panes.ts` — 新 endpoint `GET /api/threads/:id/active-pane` 返回当前 thread 活跃 carrier pane（如有）
- `packages/api/src/.../providers/ClaudeBgCarrierService.ts` — daemon spawn 时注册 pane metadata 到 registry
- `packages/web/src/components/workspace/AgentPaneViewer.tsx` — 加 invocation banner（"现在跑：opus-47 / invocation abc123 / job ddbb1334"）

**测试**
- Backend: registry 注册/查询单测
- Backend: `/api/threads/:id/active-pane` 路由集成测试（无 active 返回 null，有 active 返回完整 metadata）
- Frontend: AgentPaneViewer 渲染 banner 的 snapshot test

### #3 Frontend: Deep-dive 视图 `/agent-sessions`（AC-C4）

**改的文件**
- `packages/api/src/.../routes/sessions-routes.ts` — 新 endpoint `GET /api/agent-sessions` 返回全部 active daemon jobs + 累计 usage
  - 读 `~/.claude/jobs/*/state.json` 聚合：daemonShortId, state, detail, catId, threadId, started, cumulativeUsage
- `packages/web/src/pages/AgentSessionsPage.tsx` — 新页面，列表展示 active sessions + 每条点开看 detail + transcript link
- `packages/web/src/App.tsx`（或 routes 配置）— 注册 `/agent-sessions` 路由
- `packages/web/src/components/Sidebar.tsx`（或现有 nav）— 加入口"碰活儿"/"Active Sessions"

**设计要点**
- 列表项：catId + 当前 detail + 已跑时长 + 累计 token + "接管"按钮
- 刷新策略：useSWR / 3 秒轮询（轻量，daemon jobs 数 < 20）
- 进程树：可选 stretch，最简版只显示 `daemonShortId` + `respawnFlags` 头部

**测试**
- Backend: sessions-routes 集成测试（mock state.json fixture）
- Frontend: AgentSessionsPage 渲染 + empty state

### #4 Frontend: Thread 气泡"接管"按钮（AC-C5）

**改的文件**
- `packages/web/src/components/ChatMessage.tsx` — daemon 模式的 assistant 气泡上加 takeover 按钮（小图标 hover 展开）
- `packages/web/src/stores/chatStore.ts`（或 useAgentMessages）— 气泡 metadata 加 `carrierKind: 'bg_daemon' | 'p_print'` 区分
- `packages/web/src/components/workspace/WorkspaceContext.ts` — `openPaneForInvocation(invocationId, mode: 'rw')` action
- `packages/api/src/.../providers/ClaudeBgCarrierService.ts` — done message metadata 加 `carrierKind: 'bg_daemon'`（identification）

**设计要点**
- 默认隐藏，hover 气泡才显示
- 点击 → 跳 F089 read-write pane（F089 已支持），弹 toast"已接管 [catId] 的 invocation"
- 接管中 carrier 不退出，只是切到人类输入优先

**测试**
- Frontend: ChatMessage takeover 按钮 visibility + click → workspace action 单测
- Backend: done message 携带 carrierKind 字段单测

### #5 Frontend: Status dot tooltip 加 detail（AC-C3 增强）

**改的文件**
- `packages/web/src/stores/chatStore.ts` — `status` AgentMessage reducer：写入 `catStatuses[catId].detail`
- `packages/web/src/stores/chat-types.ts` — `CatStatusType` 扩展为 `{ state, detail?: string, detailUpdatedAt?: number }`
- `packages/web/src/components/ThreadCatStatus.tsx` — hover 状态点显示 tooltip：detail 文本 + "更新于 5 秒前"

**设计要点**
- detail TTL：超过 30 秒没新 detail 视为 stale，tooltip 显示原 state 不显示老 detail
- 空 detail / null 不显示 tooltip（degraded gracefully）

**测试**
- Store: chatStore reducer 接收 `status` 消息更新 catStatuses
- Component: ThreadCatStatus tooltip 渲染（有 detail / 无 detail / stale detail 三态）

## AC 映射（PR body 用）

| AC | 实施事 | 验收 |
|---|---|---|
| AC-C1 | #2 | tmux pane 显示当前 invocation banner，read-only 模式可见进度 |
| AC-C2 | #1 | thread UI 实时看到 daemon detail 进度，信息密度 ≥ -p 模式 |
| AC-C3 | #5 | 状态点 hover 显示 detail，stale 后回退 |
| AC-C4 | #3 | `/agent-sessions` 页面列出所有活动 carrier session |
| AC-C5 | #4 | 气泡"接管"按钮点击切到 F089 read-write |
| AC-C6 | 跨猫审 | 砚砚（GPT-5.5）code review + opus-47 愿景守护审"信息密度 ≥ -p" |

## 测试预算

- 新增 unit + integration 测试：~12-15 个
- 涉及 packages：`@cat-cafe/api`（≥ 6 tests）+ `@cat-cafe/web`（≥ 6 tests）
- Redis 测试隔离：照例 `pnpm --filter @cat-cafe/api test:redis`

## SOP 链条

```
当前位置 → writing-plans (本文件就是) ✅
↓ Sonnet 接手
tdd → quality-gate → request-review (@codex)
↓ codex review pass
merge-gate → 愿景守护 (@opus-47, 信息密度判定)
↓
F198 Phase C close → Phase D kickoff
```

## 实施纪律（继承自家规）

- ✅ 每个 Edit 看 LSP 诊断，新 diagnostic 立刻处理
- ✅ Shared 包改了跑 `pnpm --filter @cat-cafe/shared build`
- ✅ 文件超 200 行 warn / 350 行 error → 拆分
- ✅ shared 状态修改 → 立刻 commit push
- ✅ commit 用自己签名 [Sonnet/Sonnet-4-6🐾]
- ✅ Redis 6398 only，禁碰 6399

## 提交 checklist（merge 前）

- [ ] 5 件实施事全部 done
- [ ] 6 个 AC checkbox 都打勾
- [ ] `pnpm gate`（typecheck + lint + 关键测试）通过
- [ ] `pnpm --filter @cat-cafe/api test:redis` 通过
- [ ] 砚砚 review approve
- [ ] 愿景守护（opus-47）approve "信息密度 ≥ -p 模式"
- [ ] F198 spec 6 个 AC-C checkbox 同步打勾
- [ ] PR body 引用此 plan + Phase B 验证收尾 commit `58e5c56c3`
