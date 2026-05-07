---
feature_ids: [F187]
doc_kind: plan
created: 2026-05-07
updated: 2026-05-07
---

# F187 Thread Labels Phase C — 猫猫辅助分类 Implementation Plan (v2)

**Feature:** F187 — `docs/features/F187-thread-labels.md`
**Goal:** 让用户通过功能 thread + skill 双入口触发猫猫分类建议，批量给未分类 thread 打标签
**Acceptance Criteria:**
- AC-C1: sidebar "未分类" pill 旁有 ✨ 按钮，点击创建/打开专属功能 thread 触发分类流程
- AC-C2: 猫猫通过现有消息路由分析未分类 thread 并建议标签（不引入独立 API 端点）
- AC-C3: 用户可在 ThreadOrganizerModal 面板中逐条确认/修改建议后批量应用标签
- AC-C4: 用户可在任意 thread 说"帮我整理"触发猫猫加载 skill 整理
**Architecture:** 双入口（✨按钮→功能thread、对话→skill）→ 猫猫走现有消息路由分析 → ThreadOrganizerModal 浮层确认 → 批量 PATCH 应用
**Tech Stack:** React, Zustand, existing cat routing (AgentRouter), MCP tools, skill system
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## v1→v2 变更说明

v1 方案（客户端关键词匹配 → 独立 API 端点）被铲屎官否决：
- "我们家没有 api 只有 cli"
- "和我们的架构设计割裂了"
- "路由到当前的 thread 你这当前的 thread 可能在开发呢"

v2 方案：功能 thread 承载分类交互 + organize-threads skill + 现有消息路由。

## Straight-Line Check

**Finish line:** 用户点 ✨ → 打开/创建 "Thread 整理助手" 功能 thread → 猫猫通过现有路由分析未分类 thread → 建议标签 → 用户在 ThreadOrganizerModal 确认/修改 → 批量应用。

**What we're NOT building:**
- 不引入 FunctionRun 数据模型
- 不新建独立 API 端点直接调 LLM（KD-5）
- 不做 `cat_cafe_list_labels` MCP 工具（V2 scope；V1 通过触发消息传入标签信息）
- 不做自动分类（用户主动触发）

**Terminal Schema:**
```typescript
// ThreadOrganizerModal props (已存在)
interface ThreadOrganizerModalProps {
  open: boolean;
  onClose: () => void;
  threads: Thread[];
  labels: ThreadLabel[];
  onApply: (assignments: Map<string, string[]>) => Promise<{ failedThreadIds: string[] }>;
  onSuggestAll?: () => void;
  initialSuggestions?: Map<string, string[]>;
  loading?: boolean;
}
```

---

### Task 1: 移除旧 API 端点方案

**Files:**
- Delete: `packages/api/src/routes/labels-suggest.ts`
- Delete: `packages/api/test/labels-suggest-route.test.js`
- Delete: `packages/web/src/utils/label-suggest-api.ts`
- Modify: `packages/api/src/routes/index.ts` — 移除 export
- Modify: `packages/api/src/index.ts` — 移除 import 和 registration

**Step 1:** 移除 routes/index.ts 中的 export

**Step 2:** 移除 api/src/index.ts 中的 import 和 route registration

**Step 3:** 删除三个文件

**Step 4:** 运行测试确认无回归
```bash
pnpm test && pnpm lint && pnpm check
```

**Step 5:** Commit
```bash
git commit -m "refactor(F187): remove independent API endpoint — use cat routing instead"
```

---

### Task 2: 创建 organize-threads skill

**Files:**
- Create: `cat-cafe-skills/organize-threads/SKILL.md`
- Modify: `cat-cafe-skills/manifest.yaml` — 添加 skill entry

**Step 1:** 写 SKILL.md

Skill 内容要点：
- 猫猫收到"帮我整理"消息时加载
- 指导猫猫用 `cat_cafe_list_threads` 获取 thread 列表
- 分析 thread 标题/元数据，对照用户提供的标签列表
- 输出格式化建议（每个 thread 推荐 0-N 个标签）
- 不自动应用——输出建议供用户确认

**Step 2:** 在 manifest.yaml 添加 entry

```yaml
organize-threads:
  description: >
    猫猫辅助整理未分类 thread，分析标题和元数据，建议合适的标签。
    Use when: 用户说"帮我整理"、点击整理按钮、thread 分类、label 建议。
    Not for: 创建/删除标签、管理标签系统。
    Output: 按 thread 的标签建议列表。
  triggers:
    - "帮我整理"
    - "整理 thread"
    - "organize threads"
    - "分类建议"
  not_for:
    - "创建标签"
    - "删除标签"
  output: "Thread label suggestion list"
  next: []
  sop_step: null
```

**Step 3:** 运行 `pnpm sync:skills`

**Step 4:** Commit

---

### Task 3: ✨ 按钮 → 功能 thread 创建/导航

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx`

**Step 1:** 修改 ✨ 按钮的 onClick handler

当前行为：直接调 fetchLabelSuggestions() API
新行为：
1. 查找现有 "Thread 整理助手" thread（按 title 匹配）
2. 如不存在，POST /api/threads 创建一个
3. 导航到该 thread
4. 自动发送触发消息，附带当前标签信息和未分类 thread 列表摘要

```typescript
const handleOrganizeClick = useCallback(async () => {
  const threads = useChatStore.getState().threads;
  const existingThread = threads.find(t => t.title === 'Thread 整理助手');
  
  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
  } else {
    const newThread = await apiFetch('/api/threads', {
      method: 'POST',
      body: { title: 'Thread 整理助手' },
    });
    threadId = newThread.id;
  }
  
  // Navigate to thread
  useChatStore.getState().setActiveThread(threadId);
  
  // Build trigger message with label context
  const labelInfo = labels.map(l => `${l.name} (${l.id})`).join(', ');
  const uncatCount = uncategorizedThreads.length;
  const triggerMessage = `帮我整理未分类的 thread。\n\n当前有 ${uncatCount} 个未分类 thread，可用标签：${labelInfo}`;
  
  // Send via existing message API
  await apiFetch('/api/messages', {
    method: 'POST',
    body: { content: triggerMessage, threadId },
  });
}, [labels, uncategorizedThreads]);
```

**Step 2:** 移除 handleSuggestAll 和 fetchLabelSuggestions 相关代码

**Step 3:** 运行测试
```bash
pnpm test && pnpm lint && pnpm check
```

**Step 4:** Commit

---

### Task 4: ThreadOrganizerModal 保持可用（手动批量模式）

ThreadOrganizerModal 已完成（P1-2 error handling + P2-1 SVG icons）。保持现有功能：
- 手动打开：用户仍可从 sidebar 打开 modal 手动分配标签
- 批量应用：Promise.allSettled + error banner
- onSuggestAll prop 暂时不连接猫猫路由（Phase C 的猫猫建议走功能 thread 对话方式）

不需要额外改动。

---

### Task 5: 浏览器验证 + 全量门禁

**Step 1:** Start dev server (`pnpm dev:direct` in worktree, OFFSET=-10)

**Step 2:** 验证 AC-C1 — ✨ 按钮
1. 确认 sidebar "未分类" pill 旁有 ✨ 按钮
2. 点击 ✨ → 创建 "Thread 整理助手" thread → 自动导航
3. 触发消息自动发送，包含标签和未分类 thread 信息

**Step 3:** 验证 AC-C2 — 猫猫路由
1. 消息通过现有路由投递给猫猫
2. 猫猫加载 organize-threads skill
3. 猫猫分析并在 thread 中输出建议

**Step 4:** 验证 AC-C3 — ThreadOrganizerModal 批量应用
1. 用户可从 sidebar 打开 organizer modal
2. 手动选择/修改标签
3. 批量应用成功，失败项有 error banner

**Step 5:** 验证 AC-C4 — skill 触发
1. 在任意 thread 输入"帮我整理"
2. 猫猫加载 organize-threads skill
3. 猫猫分析并输出建议

**Step 6:** 全量门禁
```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```
