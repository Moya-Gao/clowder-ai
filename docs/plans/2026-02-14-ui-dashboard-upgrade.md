# F-UI: UI Dashboard Upgrade — 右面板重构 + 实时计划进度

> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-14
> **状态**: 📋 设计中
> **前端实施**: 暹罗猫 (Pencil Skill)
> **关联**: cli-ndjson-treasure-map.md, F8 Token Budget, F24 Context Health

---

## 1. 问题陈述

### P1: 右面板"最近调用"信息丢失

**现象**: 一个 thread 里先后喊了三只猫，但下一轮只 @布偶猫，右面板只显示布偶猫的调用信息，其他两只猫的数据消失了。

**根因**: `RightStatusPanel` 的渲染逻辑绑定 `targetCats`（来自最近一次 `intent_mode` 事件），而非 thread 维度的所有历史参与者：

```typescript
// RightStatusPanel.tsx — 当前逻辑
const cats = targetCats.length > 0
  ? Array.from(new Set(targetCats))   // ← 只显示最近一轮的目标猫
  : ['opus', 'codex', 'gemini'];
```

`catInvocations` store 里其实**还保留着**其他猫的数据，只是没被渲染。

### P2: 猫猫执行计划时，前端看不到进度

**现象**: 猫猫在后台用 TaskCreate/TaskUpdate/write_todos 管理自己的执行计划，但前端完全不知道——只能看到流式文本输出和工具调用名。

**根因**: 三猫的 NDJSON 流中，task 管理工具和普通工具一视同仁，`transform*Event()` 只提取了 `toolName`/`toolInput`，没有对 task 类工具做语义识别。

### P3: 右面板信息密度不够、层次不清

**现象**: 当前右面板是"平铺列表"结构——模式状态、猫状态、消息统计、任务统计、调用详情、线程信息混在一起滚动，没有层次感。重要信息（猫正在做什么）和次要信息（thread ID）权重一样。

---

## 2. 设计目标

| 目标 | 衡量标准 |
|------|---------|
| **不丢信息** | Thread 中出现过的每只猫，在右面板始终有一席之地 |
| **实时进度** | 猫猫创建/更新 task 后，1s 内在面板上可见 |
| **层次清晰** | 一眼区分"正在做什么"（动态）vs"做过什么"（历史）|
| **三猫一致** | Claude/Gemini 有结构化 task，Codex 有 reasoning fallback |
| **暹罗猫可实施** | 前端改动用 Pencil Skill 出设计稿，降低交接成本 |

---

## 3. 解法设计

### 3.1 右面板重构：从 targetCats 到 threadParticipants

**核心改动**: 引入 `threadParticipants` 概念，区分"本轮目标"和"历史参与者"。

```
┌─────────────────────────────────┐
│ 🔴 当前调用 (targetCats)        │  ← 高亮区：正在工作的猫
│                                 │
│ ┌─ 🐱 布偶猫 ─────── 工作中 ──┐ │
│ │  ⏱ 12.3s  ⬆ 25k  ⬇ 1.2k   │ │
│ │  💰 $0.17  📊 38% context   │ │
│ │                              │ │
│ │  📋 执行计划 (2/4)           │ │  ← 新增：实时 task 进度
│ │  ✅ Fix auth bug             │ │
│ │  🔄 Add Redis caching       │ │
│ │  ⬚  Write tests             │ │
│ │  ⬚  Update docs             │ │
│ └──────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│ 💤 历史调用 (past participants) │  ← 灰色区：不在本轮但有历史
│                                 │
│ ┌─ 🐱 缅因猫 ─────── 2分钟前 ─┐ │
│ │  上次: ⬆ 1.3M  ⬇ 10k       │ │  ← 折叠态，点击可展开
│ └──────────────────────────────┘ │
│ ┌─ 🐱 暹罗猫 ─────── 5分钟前 ─┐ │
│ │  上次: ⬆ 12k  ⬇ 800        │ │
│ └──────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│ 📊 线程统计 (折叠)              │  ← 次要信息折叠
│ 📝 审计日志 (折叠)              │
└─────────────────────────────────┘
```

**数据源变更**:

```typescript
// 新增: threadParticipants — 有过 invocation 数据的所有猫
const threadParticipants = Object.keys(catInvocations);

// 渲染分区
const activeCats = targetCats.filter(c => catStatuses[c] === 'streaming' || catStatuses[c] === 'pending');
const historyCats = threadParticipants.filter(c => !activeCats.includes(c));
```

### 3.2 实时 Task 进度面板

#### 3.2.1 后端: NDJSON Task 工具识别

在三猫的 `transform*Event()` 中增加 task 工具识别层：

```typescript
// 新增: task 工具名映射表
const TASK_TOOL_NAMES: Record<string, string> = {
  // Claude Code
  'TaskCreate':     'task_create',
  'TaskUpdate':     'task_update',
  'TaskList':       'task_list',
  'EnterPlanMode':  'plan_enter',
  'ExitPlanMode':   'plan_exit',
  // Gemini CLI
  'write_todos':    'task_create',   // Gemini 的 todo 工具
  'exit_plan_mode': 'plan_exit',
};
```

**处理逻辑**: 当检测到 task 工具调用时，除了正常的 `tool_use` AgentMessage，额外 yield 一条 `task_progress` 消息：

```typescript
// 新 AgentMessage type
interface TaskProgressMessage {
  type: 'task_progress';
  catId: string;
  action: 'task_create' | 'task_update' | 'task_list' | 'plan_enter' | 'plan_exit';
  payload: {
    taskId?: string;
    subject?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;         // "正在做什么"的现在进行时描述
    tasks?: TaskSnapshot[];      // TaskList 的完整快照
  };
  timestamp: number;
}

interface TaskSnapshot {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}
```

#### 3.2.2 三猫差异化处理

| 猫 | 工具名 | 数据提取方式 | 精度 |
|----|--------|-------------|------|
| 布偶猫 | `TaskCreate` | `input.subject`, `input.description` | ★★★★★ 完整结构化 |
| 布偶猫 | `TaskUpdate` | `input.taskId`, `input.status` | ★★★★★ 精确状态变更 |
| 暹罗猫 | `write_todos` | `parameters.todos[]`（待确认具体 schema） | ★★★ 有结构但 schema 不确定 |
| 缅因猫 | `reasoning` 事件 | 文本解析（"Planning..."/"Investigating..."） | ★★ 非结构化 fallback |

**缅因猫 fallback 策略**: 对 `item.completed(reasoning)` 事件的 text 做轻量解析，提取 Markdown 加粗标题作为"正在做什么"：

```typescript
// reasoning text: "**Planning investigation for feature statuses**"
const match = reasoningText.match(/\*\*(.+?)\*\*/);
if (match) {
  yield { type: 'task_progress', action: 'reasoning_hint', payload: { activeForm: match[1] } };
}
```

#### 3.2.3 前端: Task 进度 UI

**新增 store 字段**:

```typescript
interface CatInvocationInfo {
  // ... 现有字段 ...
  taskProgress?: {
    tasks: TaskSnapshot[];
    planMode?: boolean;       // 是否在 plan mode 中
    lastUpdate: number;       // 最后更新时间
    reasoningHint?: string;   // Codex reasoning fallback
  };
}
```

**UI 组件**: `CatTaskProgress`

```
┌─ 📋 执行计划 (2/4) ───────────┐
│ ✅ Fix authentication bug      │  ← completed: 绿色 + 划线
│ 🔄 Add Redis caching layer    │  ← in_progress: 品牌色 + spinner
│ ⬚  Write integration tests    │  ← pending: 灰色
│ ⬚  Update API documentation   │  ← pending: 灰色
├────────────────────────────────┤
│ ████████░░░░░░░░  50%          │  ← 进度条
└────────────────────────────────┘
```

对 Codex (无结构化 task) 的降级显示：

```
┌─ 🧠 缅因猫正在思考 ───────────┐
│ Planning investigation for     │  ← 从 reasoning 提取的最新思考
│ feature statuses...            │
│                                │
│ 💭 已思考 12 步                 │  ← reasoning 事件计数
└────────────────────────────────┘
```

### 3.3 信息层次重构

将右面板从"平铺列表"改为"分区折叠"：

| 分区 | 默认状态 | 内容 |
|------|---------|------|
| **当前调用** | 展开 | 正在工作的猫 + task 进度 |
| **历史参与** | 折叠（有数据时展开摘要行） | 不在本轮但有历史数据的猫 |
| **线程统计** | 折叠 | 消息计数、任务计数 |
| **对话信息** | 折叠 | Thread ID、审计日志链接 |

---

## 4. 数据流架构

```
CLI NDJSON 流 (claude / codex / gemini)
  │
  ▼
transform*Event()
  ├─ 普通事件 → AgentMessage (text/tool_use/done/...)
  └─ Task 工具检测 → 额外 yield TaskProgressMessage
       │
       ▼
  invoke-single-cat.ts (yield both)
       │
       ▼
  SocketManager.broadcastAgentMessage()
       │
       ▼
  [WebSocket]
       │
       ▼
  useSocket.ts → useAgentMessages.ts
  ├─ agent_message(task_progress) → setCatInvocation({ taskProgress: ... })
  └─ agent_message(tool_use) → appendToolEvent() (正常流程不变)
       │
       ▼
  RightStatusPanel
  ├─ 当前调用区: targetCats + taskProgress
  ├─ 历史参与区: threadParticipants - activeCats
  └─ 统计/信息区: 折叠
```

---

## 5. 改动范围估算

### 后端 (布偶猫负责)

| 文件 | 改动 | 复杂度 |
|------|------|--------|
| `ClaudeAgentService.ts` | 识别 TaskCreate/Update/List 工具 | 低 |
| `codex-event-transform.ts` | 提取 reasoning 事件作为 fallback | 低 |
| `GeminiAgentService.ts` | 识别 write_todos 工具 | 低 |
| `shared/types` | 新增 `TaskProgressMessage` type | 低 |
| `useAgentMessages.ts` (共用 hook) | 处理 task_progress 消息 | 中 |

后端总量: ~100-150 行新增

### 前端 (暹罗猫负责，Pencil Skill 出设计)

| 组件 | 改动 | 复杂度 |
|------|------|--------|
| `RightStatusPanel.tsx` | 分区重构 (active/history/stats) | 中 |
| `CatTaskProgress.tsx` (新增) | Task 进度条 + checklist UI | 中 |
| `CatReasoningHint.tsx` (新增) | Codex 思考过程 fallback UI | 低 |
| `CatInvocationCard.tsx` (新增) | 单猫调用卡片 (含 token + task) | 中 |
| `chat-types.ts` | 扩展 CatInvocationInfo | 低 |
| `chatStore.ts` | threadParticipants 计算 | 低 |

前端总量: ~200-300 行新增 + ~100 行重构

---

## 6. 暹罗猫交付约定

### 分工

| 角色 | 职责 |
|------|------|
| **布偶猫** | 后端 task 工具识别 + WebSocket 消息 + shared types |
| **暹罗猫** | 前端 UI 全部 — 用 Pencil Skill 先出设计稿，再写组件 |
| **缅因猫** | Code review (后端 + 前端) |

### 暹罗猫 Pencil 任务清单

1. **右面板分区布局** — 设计 active/history/stats 三区的视觉层次
2. **CatInvocationCard** — 单猫调用信息卡片（含 token 仪表盘 + task 进度）
3. **CatTaskProgress** — checklist + 进度条组件
4. **CatReasoningHint** — Codex 思考气泡组件
5. **折叠/展开交互** — 分区折叠的动画和交互

### 交接内容（给暹罗猫的）

- 数据接口: `CatInvocationInfo` 的完整 TypeScript 类型
- 设计约束: 固定宽度 w-72 (288px)，配色用现有 design tokens
- 参考组件: `CatTokenUsage.tsx`, `ContextHealthBar.tsx` (已有风格)
- 品牌色: opus-primary, codex-primary, gemini-primary (已定义)

---

## 7. 实施阶段

### Phase A: 后端 Task 提取 (布偶猫, ~0.5 天)

1. 新增 `TaskProgressMessage` 类型到 shared
2. `transformClaudeEvent()` 识别 TaskCreate/TaskUpdate/TaskList
3. `transformCodexEvent()` 提取 reasoning 事件
4. `transformGeminiEvent()` 识别 write_todos
5. `invoke-single-cat.ts` yield task_progress 消息
6. 测试: 针对三猫的 task 工具事件各写 2-3 个用例

### Phase B: 前端 Task 进度 (暹罗猫, ~1 天)

1. 扩展 `CatInvocationInfo` 类型
2. `useAgentMessages.ts` 处理 task_progress 消息
3. Pencil 设计稿 → CatTaskProgress 组件
4. Pencil 设计稿 → CatReasoningHint 组件

### Phase C: 右面板重构 (暹罗猫, ~1 天)

1. Pencil 设计稿 → 分区布局
2. `threadParticipants` 替换 `targetCats` 渲染逻辑
3. active/history 分区 + 折叠交互
4. CatInvocationCard 组合 token + task
5. 响应式: 移动端隐藏/抽屉

### Phase D: Review + 集成 (~0.5 天)

1. 缅因猫 review 后端 + 前端
2. 修 review 反馈
3. 集成测试: 模拟三猫调用，验证面板数据完整

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Gemini `write_todos` 的实际 schema 不确定 | 暹罗猫 task 提取可能不准 | Phase A 先用 gemini CLI 实测一次，确认 schema |
| Codex reasoning 文本格式不稳定 | fallback 显示可能乱 | 只提取 `**bold**` 标题，其余不解析 |
| 右面板 288px 宽度放不下 task 列表 | task subject 截断严重 | 允许单行截断 + tooltip 显示全文 |
| 暹罗猫 Pencil 设计风格与现有不一致 | 需要额外调整 | 给暹罗猫提供现有 design tokens + 参考组件截图 |

---

## 9. 非目标 (本次不做)

- ❌ Task 进度的历史回放/时间线
- ❌ 跨 thread 的猫猫效率统计
- ❌ 自定义右面板布局/拖拽排序
- ❌ 移动端完整适配（只保证不crash）
- ❌ 暹罗猫 `write_todos` 和 Claude `TaskCreate` 的语义统一

---

## 10. 成功标准

- [ ] 三只猫都在 thread 里发过言 → 右面板始终显示三只猫的信息（不因 targetCats 变化而丢失）
- [ ] 布偶猫使用 TaskCreate 后 → 1s 内右面板出现 checklist
- [ ] 缅因猫 reasoning 事件 → 右面板显示"正在思考: xxx"
- [ ] 暹罗猫 write_todos 后 → 右面板出现 todo 列表
- [ ] 信息层次清晰 → 正在工作的猫占主视觉区域，历史猫折叠但可展开
