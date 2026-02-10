# F11 模式系统 — 设计文档

> **作者**: 布偶猫 (Opus 4.6) + 铲屎官
> **日期**: 2026-02-10
> **状态**: ✅ 设计确认，待实施
> **来源**: [Feature Backlog Brainstorm](../discussions/2026-02-10-feature-backlog-brainstorm/README.md)
> **分支**: `feat/mode-system`
> **Worktree**: `/Users/lysander/projects/relay-station/cat-cafe-mode-system`

---

## 1. 为什么做这个（WHY）

### 铲屎官原话

> "这个肯定第一，这个做完未来的 feat 就在猫咖里就行了不要我一直传声在你和缅因里了"
> "内置点模式比如进入头脑风暴模式，agent 平行第一轮然后根据我指定的顺序"
> "布偶猫自己决定他发言之后 at 谁 也可以 at 铲屎官"

### 核心痛点

铲屎官目前是三只猫之间的**人肉路由器**：
- 开发时要在布偶猫和缅因猫之间传话（"布偶猫写完了，缅因猫去 review"）
- 头脑风暴时要手动 @ 每只猫，手动汇总
- 辩论时要手动轮流转述

### 为什么是 P0（#1 优先级）

F11 是**元功能** — 做完后：
- 铲屎官只需给需求 + 最终审批，不当传声筒
- 后续 F10-F16 的开发都能用「开发自闭环」模式让猫猫自己做
- 投资回报率最高

---

## 2. 三种核心模式

### 2.1 头脑风暴模式 (brainstorm)

**流程：**
```
第一轮：routeParallel(selectedCats, topic)
  → 选中的猫并行独立思考，互不可见
  → 结果同时展示给铲屎官

第二轮起：按 speakingOrder 串行
  → 每只猫看到前面所有猫的发言
  → 发言结束后猫自己决定 @谁：
    - @另一只猫 → 自动路由到那只猫
    - @铲屎官 → 等铲屎官回复
    - 没有 @ → 按 speakingOrder 下一只
```

**为什么并行第一轮：** 串行讨论会让后面的猫被前面的猫锚定，丢失观点多样性。这是 2026-02-06 三猫 + 铲屎官讨论 Agent Teams 时总结的实践（见 CLAUDE.md 准则第 3 条）。

**为什么参与者可选：** 铲屎官说"头脑风暴其实未必全体参加！让我选吧！"。有时候只需要两只猫，或者某只猫的专长和议题不相关。

### 2.2 辩论模式 (debate)

**流程：**
```
轮次循环（默认 3 轮）：
  catA 发言（看到 catB 上一轮发言）
  catB 发言（看到 catA 本轮发言）
  → 重复 N 轮

结束条件：
  - 铲屎官随时可以喊停
  - 到达轮次上限
```

**历史：** 猫猫们已经举办过辩论，并在辩论中达成一致做了记忆系统（Hindsight）。辩论是验证过的协作模式。

### 2.3 开发自闭环模式 (dev-loop)

**流程：**
```
1. 铲屎官给需求 → 主开发猫接收
2. 主开发猫开发 → 完成后自动 @review 猫
3. Review 猫 review → 按 P 级分类：
   - P1/P2：必须修 → @主开发猫修复 → 重新 review
   - P3：记录 → 汇总报铲屎官决定
4. 循环直到 review 通过
5. 最终报告给铲屎官：
   「可以合入了，以下 N 个 P3 待你决定」
```

**铲屎官原话：**
> "代码开发自闭环，你们自己好好 review，最后要合并 worktree 的时候告诉我有多少 P3 你们没处理，我会决定让你们处理还是可以合入。P1 P2 必须处理！"

**为什么是状态机：** dev-loop 有明确的状态流转（开发 → review → 修复 → 再 review → 报告），需要跟踪当前处于哪个阶段，比头脑风暴和辩论复杂。

---

## 3. 模式流转

### 为什么需要流转

铲屎官指出模式不是孤立的，有自然的流转关系：

> "最开始可能是头脑风暴/辩论 → 有结果了开发，或者发现 bug 开发"

典型流程：
```
头脑风暴 ──结论──→ 开发自闭环（结论作为需求）
辩论 ──共识──→ 开发自闭环（共识作为需求）
铲屎官发现 bug ──→ 开发自闭环（bug 描述作为需求）
```

### 流转触发

**谁可以触发：** 铲屎官和猫都可以。

铲屎官原话：
> "猫和我！"

**确认机制：**
- 默认：猫提议切换时需要铲屎官确认（弹确认对话框）
- 可配置为自动切换（`mode.switchRequiresApproval = false`）

**为什么默认要确认：** 模式切换改变整个 thread 的行为模式，铲屎官应该知情。但如果铲屎官信任猫猫的判断，可以关掉确认。

---

## 4. 数据模型

### Thread 扩展

```typescript
interface Thread {
  // ...现有字段
  currentMode?: ThreadMode;
  modeHistory: ThreadModeRecord[];
}
```

### 模式记录

```typescript
interface ThreadModeRecord {
  name: 'brainstorm' | 'debate' | 'dev-loop';
  config: ModeConfig;
  startedAt: string;
  endedAt?: string;
  outcome?: string;       // 该模式产出，串联下一个模式的输入
  triggeredBy: string;    // userId 或 catId
}

type ModeConfig = BrainstormConfig | DebateConfig | DevLoopConfig;
```

### 模式配置

```typescript
interface BrainstormConfig {
  topic: string;
  participants: string[];      // 铲屎官选谁参加
  speakingOrder?: string[];    // 第二轮顺序（默认同 participants）
  parallelFirst: true;         // 第一轮总是并行
}

interface DebateConfig {
  topic: string;
  catA: string;                // 正方
  catB: string;                // 反方
  rounds?: number;             // 轮次（默认 3）
}

interface DevLoopConfig {
  requirement: string;         // 需求描述
  leadCat: string;             // 主开发猫
  reviewCat: string;           // review 猫
  autoMerge: false;            // P1P2 必须处理，P3 报铲屎官
}
```

### 配置项

```typescript
// ConfigRegistry 新增
{
  key: 'mode.switchRequiresApproval',
  label: '模式切换需要铲屎官确认',
  type: 'boolean',
  default: true,
  description: '关闭后猫猫可以自动切换模式，无需铲屎官确认'
}
```

### 为什么模式挂在 Thread 上

- 不是全局状态 — 同一时间可以有一个 thread 跑「开发自闭环」，另一个在「头脑风暴」
- `modeHistory` 保留完整流转记录，用于审计和复盘
- `outcome` 字段串联前后模式：头脑风暴的 outcome → dev-loop 的 requirement

---

## 5. 入口交互设计

### 决策：A + C 混合

布偶猫提出三个方案：
- A) `/mode` 命令 + 弹出选择器
- B) 独立触发符 `!` + 弹出选择器
- C) UI 按钮 + 状态栏

**最终决策：A + C 混合。** 铲屎官确认。

理由：
- `/mode` 命令复用已有 `/` 命令基础设施（`/config`, `/remember` 等），不引入新触发符
- UI 按钮照顾鼠标党，也提高可发现性（F12 的前置实践）
- 状态栏始终显示当前模式，不会迷失

### 进入模式流程

```
方式 1：输入 "/" → 命令列表 → "mode" → 模式选择器 → 配置表单
方式 2：点击输入框旁模式图标 → 模式选择器 → 配置表单
```

模式选择器展示：
```
🧠 头脑风暴 — 并行思考，保护多样性
⚔️ 辩论 — 两猫对决
🔄 开发自闭环 — 给需求，猫猫自己闭环
```

### 切换模式

1. **铲屎官**：再次 `/mode` 或点按钮
2. **猫猫**：回复中用 `@mode:dev-loop` 格式提议 → 弹确认对话框（可配置自动）

### 状态栏显示

```
🧠 头脑风暴 · 议题：F11 模式系统设计 · 已进行 15 分钟
```

---

## 6. 架构集成

### 新增模块

```
packages/api/src/
├── domains/cats/services/
│   ├── ModeOrchestrator.ts      # 模式编排调度器（入口）
│   ├── modes/
│   │   ├── BrainstormMode.ts    # 头脑风暴编排
│   │   ├── DebateMode.ts        # 辩论编排
│   │   └── DevLoopMode.ts       # 开发自闭环编排（状态机）
├── routes/
│   └── modes.ts                 # POST/GET/PATCH /api/modes
packages/shared/src/
│   └── types/modes.ts           # 模式类型定义
packages/web/src/
│   ├── components/
│   │   ├── ModeSelector.tsx     # 模式选择弹出面板
│   │   └── ModeStatusBar.tsx    # 顶部模式状态显示
│   └── hooks/
│       └── useModeCommands.ts   # /mode 命令解析
```

### 改动现有文件

```
packages/api/src/
├── routes/messages.ts           # 发消息时检查 currentMode → 交给 ModeOrchestrator
├── domains/cats/services/
│   └── AgentRouter.ts           # 被 ModeOrchestrator 调用（不改接口，加模式上下文注入）
packages/shared/src/
│   └── types/index.ts           # 导出模式类型
packages/web/src/
│   └── components/
│       └── ChatInput.tsx        # 加模式按钮入口
```

### 核心调用链路

```
用户发消息 → messages.ts 检查 thread.currentMode
  → 有模式 → ModeOrchestrator.handle(mode, message)
    → 根据 mode.name 分发：
      brainstorm → BrainstormMode.handle()
        → routeParallel (第一轮) / routeSerial + A2A (后续轮)
      debate → DebateMode.handle()
        → routeSerial + 轮次控制
      dev-loop → DevLoopMode.handle()
        → 状态机驱动：develop → review → fix → re-review → report
  → 无模式 → 走现有逻辑（完全向后兼容）
```

### 设计原则

1. **向后兼容**：没进模式 = 行为和现在完全一样，零影响
2. **复用不重写**：ModeOrchestrator 是上层调度，复用已有的 routeParallel/routeSerial/A2A
3. **模式可扩展**：新模式只需加一个 `XxxMode.ts` + 注册到 ModeOrchestrator
4. **铲屎官在环**：所有关键决策点（模式切换、P3 决定、合入审批）铲屎官都参与

---

## 7. 可扩展性

### 为什么要可扩展

铲屎官举例说未来可能想玩「狼人杀」等新模式。模式系统的价值不只是当前三种模式，而是提供一个**猫猫协作的编排框架**。

### 添加新模式的步骤

1. 定义 `XxxConfig` 类型（`packages/shared/src/types/modes.ts`）
2. 实现 `XxxMode.ts`（继承统一接口）
3. 注册到 `ModeOrchestrator`
4. 前端 `ModeSelector.tsx` 加一个选项

不需要改 AgentRouter、messages.ts 或其他现有逻辑。

---

## 8. 开放问题（实施时决定）

1. dev-loop 状态机的持久化 — 用 Redis 还是挂在 Thread metadata 上？
2. dev-loop 的 P 级判断 — 缅因猫自己判断 P 级，还是有结构化的输出格式？
3. 模式内的消息 — 是否需要特殊标记（类似 a2a_handoff）以便前端区分渲染？
4. 超时处理 — 模式内某只猫长时间没响应怎么办？
5. 并发安全 — 同一 thread 多人同时操作模式切换的竞态？
