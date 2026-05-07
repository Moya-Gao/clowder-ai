# Review Request: F187 Phase C — P1-1 重写：功能 thread + skill 双入口架构（Round 3）

Review-Target-ID: f187-phase-c
Branch: feat/f187-phase-c

## What

**Round 3 — 铲屎官架构干预后的全面重写。**

Round 1/2 的 P1-1 方案（客户端关键词匹配 → 独立 API 端点调 Haiku）被铲屎官否决。核心反馈：
- "我们家没有 api 只有 cli"
- "和我们的架构设计割裂了"
- "路由到当前的 thread 你这当前的 thread 可能在开发呢"

铲屎官拍板新架构——功能 thread + skill 双入口：
1. ✨ 按钮 → 创建/打开 "Thread 整理助手" 功能 thread → 发送触发消息 → 猫猫通过现有消息路由分析
2. 任意 thread 说"帮我整理" → 猫猫加载 organize-threads skill → 当场整理

变更清单：
- **删除**：`labels-suggest.ts`（独立 API 端点）、`labels-suggest-route.test.js`、`label-suggest-api.ts`（前端客户端）、API index 注册
- **新增**：`cat-cafe-skills/organize-threads/SKILL.md` + `manifest.yaml` entry
- **修改**：`ThreadSidebar.tsx` ✨ 按钮改为创建功能 thread + 导航 + 发送触发消息；新增手动整理按钮（grid icon）→ 打开 ThreadOrganizerModal
- **修改**：`LabelFilterBar.tsx` 新增 `onManualOrganize` prop

P1-2（Promise.allSettled 批量错误处理）和 P2-1（emoji→SVG）的修复不变，来自 Round 1。

## Why

铲屎官否定了绕过现有 cat routing 的独立 API 端点方案，要求复用消息路由基础设施（KD-5/KD-7）。功能 thread 隔离分类交互不污染用户当前工作 thread（KD-6）。

## Original Requirements（必填）
> "我发现我们现在置顶都置顶了大几十个！thread！我感觉导致这个问题是我们的收藏夹或者说也没有什么 tag 系统让我没办法分门别类我们的 thread"
> "创建一个功能 thread 承载 可能更合适，然后外加就是可能有 skills，我在某个 thread 和你说 帮我整理 你直接加载 skills 然后整理 这两条路"
- 来源：F187 立项讨论 + 铲屎官 2026-05-07 架构干预
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Architecture Ownership
- Architecture cell: thread（Thread lifecycle + routing）
- Map delta: none（复用现有 thread 创建 + message routing，不新增架构单元）
- Why: ✨ 按钮调 POST /api/threads + POST /api/messages，走现有 AgentRouter 路由链。organize-threads skill 是行为指令不是架构单元。

## Tradeoff

- 放弃了直接 API 端点调 LLM 的方案（Round 2）——铲屎官否决
- 放弃了客户端关键词匹配方案（Round 1）——砚砚否决
- 猫猫建议通过 thread 对话呈现，暂不桥接到 ThreadOrganizerModal（Phase C scope，后续可扩展）

## Open Questions

1. **skill 触发精度**：manifest triggers 含"帮我整理"，可能误触发（用户在其他语境说"帮我整理"）。Phase C 接受此 tradeoff，后续可加 intent 过滤。
2. **功能 thread 复用**：多次点击 ✨ 按钮查找同名 thread，靠 `title === 'Thread 整理助手'` 匹配。用户改了 title 会创建新的。可接受。

## Next Action

请 review 以下重点：
1. 删除独立 API 端点是否干净（无残留 import）
2. ✨ 按钮 → 功能 thread 创建 + 触发消息的实现是否符合 KD-5/KD-7
3. organize-threads skill 内容是否合理
4. LabelFilterBar 双按钮 UX 是否清晰

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f187-phase-c/codex`
- Start Command: `pnpm review:start`
- Ports: reviewer 沙盒自动分配（起点 3201/3202）

## 自检证据

### Spec 合规
Quality Gate PASS — AC-C1/C2/C3/C4 全部覆盖。详见上方 gate report。

### 测试结果
```
pnpm --filter @cat-cafe/web test  → 2877/2877 pass ✅
pnpm --filter @cat-cafe/api test  → 10272 pass, 4 pre-existing fail (start-dev-script.test.js) ✅
pnpm lint                         → 0 errors ✅
pnpm check                        → 0 errors + follow-up tails clean ✅
pnpm -r --if-present run build    → all packages exit 0 ✅
```

### 前端验证
⚠️ 未启动 worktree dev server 取截图。核心 UI 组件（ThreadOrganizerModal、LabelFilterBar）来自已 review 的 Round 1/2，本轮仅改按钮 handler。请 reviewer 用 Playwright/Chrome 实测 ✨ 按钮创建 thread 流程。

### 根目录工件闸门
无根目录媒体/设计工件 ✅

### 相关文档
- Spec: `docs/features/F187-thread-labels.md`
- Plan: `docs/plans/2026-05-07-f187-thread-labels-phase-c.md` (v2)
- Skill: `cat-cafe-skills/organize-threads/SKILL.md`
