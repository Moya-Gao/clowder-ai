# Bridgic / AmphiFlow 调研

> 调研日期：2026-05-22
> 来源：铲屎官推荐文章 + GitHub 仓库
> 仓库：https://github.com/bitsky-tech/bridgic
> 语言：Python | Stars: ~140 | 子包：bridgic-amphibious

## 一句话

**AmphiFlow = workflow-first execution with automatic agent fallback on failure。** 不是 agent 和 workflow 二选一，而是同一个类里同时实现两种模式，运行时按需切换。

## 核心问题

传统开发迫使你做一个虚假二选一：
- 用 workflow → 确定性但脆弱，一步出错全链挂
- 用 agent → 灵活但不可控，LLM 可能走偏

Bridgic 的回答：**不选，两个都要**。在同一个运行时里让 workflow 和 agent 共存，失败时自动切换。

## 架构

### 底层：Dynamic Directed Graph (DDG)

Agent 和 workflow 共享同一个图引擎。区别只是：
- Workflow 模式：图拓扑由代码写死（确定性）
- Agent 模式：图拓扑由 LLM 动态决定（自主性）
- AmphiFlow 模式：先跑确定性拓扑，失败时让 LLM 动态修复

### 四层栈

```
AmphibiousAutoma    ← 编排层：路由 workflow/agent
  └─ CognitiveWorker  ← 思维单元：OTC 循环（Observe-Think-Act）
      └─ CognitiveContext ← 状态管理：goal, tools, skills, history
          └─ Exposure Layer  ← 信息控制：决定 LLM 能看到什么
```

### 四种执行模式

| Mode | 驱动者 | 何时用 | Fallback |
|------|--------|--------|----------|
| `AGENT` | 纯 LLM（`on_agent()`） | 开放式、探索性任务 | 无 |
| `WORKFLOW` | 纯代码（`on_workflow()`） | 已知、可重复流程 | 无，出错直接抛异常 |
| `AMPHIFLOW` | Workflow + LLM 降级 | 生产环境混合执行 | 自动切 agent |
| `AUTO` | 自动检测 | 默认 | 根据实现的方法推断 |

**模式解析规则**：
- 只实现 `on_agent()` → AGENT
- 只实现 `on_workflow()` → WORKFLOW
- 两个都实现 → AMPHIFLOW

### AmphiFlow 降级机制

```
on_workflow() 开始执行
  ├─ Step 1: ActionCall("login") ✅ 继续
  ├─ Step 2: ActionCall("navigate") ❌ 失败！
  │   └─ 自动 fallback → on_agent(ctx) 介入修复
  │       └─ Agent 用 LLM 判断怎么处理失败
  ├─ Step 3: ActionCall("extract") ✅ 继续
  └─ ...
  
max_consecutive_fallbacks=2 → 连续失败 2 次后放弃 workflow，全转 agent
```

两类失败处理：
- **Tool 执行失败**：步骤级恢复，agent 接管当前步骤
- **Generator 内部异常**：不可恢复，整体委托 `on_agent()` 或抛 RuntimeError

### 代码示例

```python
class FormFiller(AmphibiousAutoma):
    fixer = think_unit(
        CognitiveWorker.inline("Fix issues and complete steps"),
        max_attempts=5,
    )

    async def on_agent(self, ctx):
        # LLM 自主模式：遇到意外时的兜底
        await self.fixer

    async def on_workflow(self, ctx):
        # 确定性模式：happy path
        yield ActionCall("login", username="admin")
        yield ActionCall("navigate_to", url="/dashboard")
        yield ActionCall("extract_data", selector=".metrics")

# 运行：workflow 优先，失败自动切 agent
await agent.arun(
    goal="Extract dashboard data",
    tools=[browser_tool, db_tool],
    mode=RunMode.AMPHIFLOW,
    max_consecutive_fallbacks=2,
)
```

## 其他设计亮点

### OTC 循环（Observe-Think-Act）

每个 think unit 执行一轮完整的：
1. **Observe** — 收集当前状态（可自定义观察范围）
2. **Think** — LLM 决策（支持多轮 cognitive policies：Acquiring / Rehearsal / Reflection）
3. **Act** — 执行工具调用或产出结构化输出

### 记忆架构

四层级联：Working Memory → Short-term → Long-term Pending → Long-term Compressed
容量溢出时自动压缩。

### Human-in-the-Loop

内置 `request_human` 工具，所有模式下 LLM 都可以调用，异步中断-恢复。

### ASL（Agent Structure Language）

Python-native DSL，用运算符组合图拓扑：
```python
with graph as g:
    start = some_function
    handler = other_function
    +start >> ~handler    # >> 顺序，& 并行
```

## 与 Cat Cafe 的对比

| 维度 | Cat Cafe | Bridgic AmphiFlow |
|------|----------|-------------------|
| **粒度** | 多 agent 协作编排 | 单 agent 内部模式切换 |
| **融合策略** | Agent 在 SOP 轨道内保留判断力（Rule 0） | Workflow-first, agent fallback |
| **切换触发** | 猫的判断力（push back / 传球） | 异常驱动自动降级 |
| **确定性保证** | Skill 门禁（gate 检查点） | `on_workflow()` + fallback 阈值 |
| **状态管理** | 消息传递 + Redis + 记忆系统 | CognitiveContext + 四层记忆 |

### 可以借鉴的

1. **显式 fallback 阈值**：我们的 Skill 系统在"猫遇到障碍时自主判断"，但没有显式的"连续失败 N 次后切换策略"机制
2. **模式自动检测**：根据实现了哪些方法自动推断模式——零配置但可覆盖
3. **Exposure Layer**：控制 LLM 能看到什么信息，渐进式披露——和我们的 LayeredExposure / context window 管理思路相通

### 不适用的

1. 我们面对的是**多 agent 编排**（猫之间传球），AmphiFlow 解决的是**单 agent 内部**的模式切换
2. 我们的"workflow"是跨猫的 SOP（一只猫开发 → 另一只 review → 又一只愿景守护），不是单 agent 内的步骤序列
3. DDG 图引擎对我们没有直接价值——我们的编排模型是消息驱动而非图驱动
