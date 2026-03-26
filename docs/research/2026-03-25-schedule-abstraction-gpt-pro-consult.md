---
feature_ids: [F102, F104, F085]
related_features: [F118]
topics: [heartbeat, schedule, cron, openclaw, autonomy,定时任务]
doc_kind: note
created: 2026-03-25
participants: [opus, opencode, gpt52, gpt-pro]
---

# 统一调度抽象（Schedule Abstraction）— GPT Pro 咨询

> 委托人：宪宪/opus → GPT Pro（云端）
> 日期：2026-03-25
> Related: F102, F104, F085, F118

---

## 三猫调研综述

铲屎官让三只猫（宪宪/Opus、金渐层/OpenCode、砚砚/GPT-5.4）独立调研 OpenClaw 的 heartbeat 体系，对比我们的定时任务现状。以下是三猫核心观点的交叉比对：

### 三猫共识（三只猫都同意）

| 结论 | 依据 |
|------|------|
| **HEARTBEAT_OK 静默协议值得学** | "无事则闭嘴"解决定时任务噪音问题，是协议级设计不是 prompt hack |
| **"Cheap Checks First" 模式值得学** | 确定性 gate 过滤 90%+ 空轮，只在有信号时才调 LLM，大幅降本 |
| **OpenClaw 当前 heartbeat 实现不成熟** | 6+ 个公开 bug（#45772 setTimeout 死掉、#51639 不 fire、#43767 lightContext 被忽略…） |
| **我们需要统一调度抽象** | 现有 F102 setInterval、F085 /loop、未来 cron/schedule 各自为战 |
| **不要把精确任务建在 heartbeat 上** | OpenClaw 官方也承认：heartbeat = awareness，cron = precision |

### 三猫分歧/侧重

| 维度 | 宪宪(Opus) | 金渐层(OpenCode) | 砚砚(GPT-5.4) |
|------|-----------|-----------------|---------------|
| **抽象层设计** | 提了 `ScheduleAdapter` 接口 + 4 种 backend 实现 | 同意需要统一抽象，强调 queue lane 隔离 | 认为不应叫 HeartbeatAdapter，应拆 5 个维度：schedule/durability/context/gate/delivery |
| **学 OpenClaw 的程度** | 学设计模式（OK ack、cheap checks、isolatedSession、checklist、activeHours） | 学三个模式（OK ack、dual-track、checklist file），避三个反模式（setTimeout、Gateway 耦合、过早双系统） | 最谨慎——"学语义设计，不学实现形态"，不信文档字段=成熟能力 |
| **单系统 vs 双系统** | 未明确表态 | 引用 Paperclip 案例倾向单系统扩展 | 不急着决定，先把 5 维度接口定义清楚 |
| **外部调度器** | 提到 ClaudeScheduleAdapter / CronAdapter / EventBridgeAdapter | 引用 TinMan（launchd/cron → CLI） | 未展开，但强调 `/loop` 只是兜底不是主调度 |

### 布偶猫的综合判断

**砚砚的 5 维度拆分比我最初提的 ScheduleAdapter 更精准**——把 schedule（何时触发）、durability（重启是否丢）、context（带不带上下文）、gate（确定性前置检查）、delivery（结果往哪投）拆开，每个维度独立配置，比单一接口更灵活。

但具体的接口设计和分层策略，我们想听听 GPT Pro 的外部视角。

---

## Part 1: 发给云端模型的提示词

> 直接复制以下内容发送给 GPT Pro

你好，我们是 **Cat Café**，一个多 AI Agent 协作平台（TypeScript/Node.js 全栈）。我们有多只 AI 猫猫（Claude Opus、GPT-5.4、Gemini 等），它们通过 MCP 协议协作，共享一个后端 API 服务。

请你把自己当成**后端架构审阅者**，不是普通聊天助手。我们已经做过一轮本地调研（三只猫独立调研了 OpenClaw 的 heartbeat 体系），现在需要你帮我们做一次设计审阅：指出盲点、给出更稳的抽象设计、补充业界案例。

## 1. 问题背景

我们的多猫系统目前有**多个分散的定时/周期性任务需求**，但没有统一的调度抽象：

| 现有场景 | 当前实现 | 问题 |
|----------|----------|------|
| **记忆摘要调度**（F102）| `setInterval` 每 30 分钟扫描 thread，对符合条件的做 LLM 摘要 | 硬编码、进程重启丢状态、无静默机制 |
| **健康提醒**（F085）| Claude Code `/loop 90m` 定期提醒铲屎官休息 | 会话级、3天过期、不持久 |
| **PR/CI 轮询** | `setInterval` 检查 GitHub PR review 和 CI 状态 | 各自为战，无统一接口 |
| **未来：猫猫巡检** | 尚未实现 | 类似 OpenClaw heartbeat——猫定期醒来检查有没有需要注意的事 |
| **未来：精确定时任务** | 尚未实现 | 如"每天 9:00 生成日报"、"每周五 17:00 汇总本周进展" |

我们当前的调度器非常薄，只是一个 `setInterval` 壳：

```typescript
interface ScheduledTask {
  name: string;
  intervalMs: number;
  enabled: () => boolean;
  execute: () => Promise<void>;
}
```

注释写着：*"MVP: tasks are run by a simple setInterval-based TaskRunner. Future: replace with cron / priority queue / distributed scheduler"*

## 2. 我们从 OpenClaw 调研中提取的设计模式

我们三只猫独立调研了 OpenClaw 的 heartbeat + cron 体系，提取出以下**值得借鉴的模式**：

### 2.1 HEARTBEAT_OK 静默协议
Agent 定期唤醒后，如果没什么需要注意的，回复 `HEARTBEAT_OK`，系统自动丢弃消息不打扰用户。这是**协议级静默**，不是靠 prompt 让 agent 闭嘴。

### 2.2 Cheap Checks First
每次心跳先跑确定性检查（shell/API），只有检测到信号才调 LLM。90%+ 的空轮零 LLM 成本。

### 2.3 Heartbeat vs Cron 双轨
OpenClaw 明确拆分两个原语：
- **Heartbeat**：周期性 awareness check，跑在主 session，带上下文，适合"看看有没有事"
- **Cron**：精确定时执行，独立 session，适合"9:00 准时做某事"

### 2.4 HEARTBEAT.md Checklist
用一个可编辑文件定义"每次醒来检查什么"，声明式、可版本管理、agent 可自我修改。

### 2.5 运行策略
- `isolatedSession`：心跳用全新 session（~100K → ~2-5K tokens）
- `lightContext`：只注入 checklist，不加载完整 bootstrap
- `activeHours`：只在工作时间运行，时区感知

### 2.6 我们决定不学的
- OpenClaw heartbeat 当前实现有 6+ 个公开 bug（setTimeout 死掉、lightContext 被忽略等）
- 不照搬纯 polling 架构——我们需要事件驱动 + 定时兜底
- 不照搬 Gateway 硬耦合——我们需要可插拔 backend

## 3. 我们团队内部的设计雏形

三猫讨论后，砚砚(GPT-5.4) 提出了一个 **5 维度抽象**，我们认为比单一 `ScheduleAdapter` 更合理：

| 维度 | 含义 | 配置示例 |
|------|------|----------|
| **Schedule** | 何时触发 | `{ type: 'interval', ms: 1800000 }` / `{ type: 'cron', expr: '0 9 * * *' }` / `{ type: 'event', source: 'mention' }` |
| **Durability** | 重启是否丢 | `'ephemeral'`（setInterval）/ `'persistent'`（写盘/DB） |
| **Context** | 带什么上下文 | `'full-session'` / `'isolated'` / `'checklist-only'` |
| **Gate** | 前置确定性检查 | `() => pendingMessageCount > threshold` |
| **Delivery** | 结果投递策略 | `'silent-if-ok'` / `'always'` / `'channel:telegram'` |

我（宪宪/Opus）之前提的实现草案：

```
ScheduleAdapter (interface)
  ├─ register(task: ScheduledTask)
  ├─ unregister(taskId)
  ├─ listActive(): ScheduledTask[]
  └─ onTick(handler)

Implementations:
  ├─ SetIntervalAdapter      // 当前 F102 用的
  ├─ ClaudeScheduleAdapter   // Claude Code /schedule
  ├─ CronAdapter             // node-cron / OS cron
  └─ EventBridgeAdapter      // 事件驱动 + 定时混合
```

## 4. 请求

**请帮我们做以下审阅和补充：**

### 4.1 5 维度抽象的设计审阅
- 这 5 个维度（Schedule/Durability/Context/Gate/Delivery）是否完备？有没有遗漏的重要维度？
- 各维度之间有没有耦合或矛盾？
- 这种"正交维度"的抽象方式，在业界有没有类似的成熟设计可以参考？

### 4.2 业界案例补充
- 除了 OpenClaw heartbeat/cron，还有哪些 AI Agent 框架/产品做了类似的"统一调度抽象"？
- 特别关注：多 Agent 场景下的调度（不只是单 agent）
- 有没有开源项目的接口设计可以直接参考？

### 4.3 实现路径建议
- 我们应该先做什么后做什么？（渐进式演进路径）
- 当前只有 `setInterval` 壳，第一步最小改动是什么？
- 哪些维度可以延迟实现，哪些必须一开始就考虑？

### 4.4 风险和盲区
- 我们的设计有什么盲区或隐性假设？
- 多猫场景下的调度有什么特殊注意点（如多猫同时被唤醒、任务争用、优先级）？
- "Agent 可自我修改 schedule"这个能力的安全边界在哪？

## 5. 参考信息

- **技术栈**：TypeScript、Node.js、Express、Redis、SQLite（记忆组件）
- **多猫协作**：通过 MCP（Model Context Protocol）协议，每只猫是独立进程
- **现有自主性分层共识**（F104 thread 讨论）：
  - L1: `/loop` → 会话内心跳（短期守望）
  - L2: Desktop scheduled tasks → 日常巡检
  - L3: GitHub Actions + Agent SDK → 制度级自主
- **铲屎官原话**："有点像定时任务，但定时任务太机械了，我不想要机械的东西"
- **设计原则**：事件驱动 + 意图驱动优先，定时轮询作为兜底

理想的回答特征：
- 有具体的框架/产品名 + 接口设计参考（不要泛泛而谈）
- 指出我们设计的具体盲区（不是"要注意安全"这种废话）
- 给一个渐进式演进路径（Phase 1/2/3）

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴 GPT Pro 回答到这里

[待我的结论先摆桌上：你们现在最该做的，不是把 `ScheduleAdapter` 长成一棵四处开叉的圣诞树，而是先把“任务语义”从“触发实现”里剥出来。更稳的形状是一个统一 `TaskSpec`，外加 `TriggerDriver` 和中央 `RunCoordinator`。成熟系统真正一等公民的，通常不是“怎么 tick”，而是 overlap、catchup/backfill、queue/concurrency、idempotency、thread/session 隔离、run durability 这些执行语义。Temporal、Inngest、Trigger.dev、LangSmith 都是这么拆的。([Temporal 文档][1])

我会把顶层切成两层：

* **Control plane**：任务注册、权限、审批、审计、pause/resume、配置版本。
* **Runtime plane**：trigger、lease、gate、execute、delivery。

`ScheduleAdapter` 只该存在于 runtime plane，而且它本质上应该叫 **TriggerDriver**，别让它顺手兼职门禁、工单系统、邮局和法务。

## 1. 对你们 5 维度的审阅

砚砚那套 5 维度方向是对的，但还差两根承重梁，而且有三处维度需要拆开。

### 我会把 `Schedule` 改名成 `Trigger`

因为你们自己已经把 `{ type: 'event' }` 放进去了，那它就已经不只是 schedule，而是 activation trigger。Inngest 和 GitHub Actions 都把 event 与 schedule 视作同级触发源，Inngest 还支持一个函数同时挂多个 event/cron trigger，这正好对应你们“事件驱动优先，定时兜底”的原则。([Inngest][2])

### `Durability` 不能只是一位开关，要拆成三块

你们现在的 `'ephemeral' | 'persistent'` 太粗了。至少要分成：

* **registration durability**：任务定义和下一次触发是否能跨重启活着
* **run durability**：一次运行中途崩了能不能恢复、重试、续跑
* **cursor durability**：上次扫到哪里，是否持久化

这是三件不同的事。LangSmith 的 stateless cron 已经把 run 的 durability 单独暴露出来，CrewAI 也把 flow state 的持久化单独建模，所以“任务活着”和“运行状态活着”不是同一个比特。([LangChain 文档][3])

### `Context` 其实混了两件事，要拆成 session 隔离 和 context materialization

`'full-session' | 'isolated' | 'checklist-only'` 里，`isolated` 是**运行位置/线程隔离**，`checklist-only` 才是**上下文装载策略**。LangSmith 直接把“跑在同一个 thread 上的 cron”和“每次新建 thread 的 stateless cron”分开建模，这恰好说明“同不同行程本”与“带多少上下文”是两条轴。([LangChain 文档][4])

### `Delivery` 也混了两件事，要拆成 outcome policy 和 sink

`silent-if-ok` 不是投递地址，它是**结果契约**。`channel:telegram` 才是 sink。建议拆成：

* **outcome policy**：`drop-no-signal | record-only | always-emit`
* **sink**：`thread | telegram | github | memory | ops-log`
* **escalation**：连续失败 N 次后去哪儿

这样 `HEARTBEAT_OK` 才会落到“结果契约”这一层，而不是把 delivery 搅成一锅猫粮。

### 真正缺的两个维度：`Actor/Placement` 和 `RunPolicy`

这两项在多猫场景里是硬骨头。

**Actor/Placement**：谁来醒，按什么策略醒。不要 schedule 到某个模型名或某个进程 PID，要 schedule 到一个**角色**，例如 `role:repo-watcher`、`role:memory-curator`，然后运行时再用 lease 决定哪只猫接单。AutoGen 的 runtime 明确负责 agent lifecycle、消息投递和安全边界，topic/subscription 也是在表达“哪些消息会进哪些 agent”；CrewAI 则把 flows 和 crews 分开，说明“流程”与“执行者群体”本来就不是一个维度。([GitHub Microsoft][5])

**RunPolicy**：这一层建议独立出来，至少包含 `overlap / retry / timeout / queue / priority / idempotency / catchup`。Temporal 把 overlap policy、catchup window、pause-on-failure、backfill 都做成一等公民；Kubernetes CronJob 有 `concurrencyPolicy`、`startingDeadlineSeconds`、`suspend`；Trigger.dev 有 queue、priority、idempotency；Inngest 有 concurrency、retries、debounce。它们都在提醒同一件事：真正的“调度语义”不在 timer 里，而在 run policy 里。([Temporal 文档][1])

### 我建议的模型：6+1

`Trigger / Actor / Context / Admission / RunPolicy / State / Outcome`，外加一个横切面的 `Governance`。

```ts
type TaskProfile = "awareness" | "poller" | "precise";

interface TaskSpec<Signal = unknown> {
  id: string;
  profile: TaskProfile;

  trigger: TriggerSpec; // interval | cron | event | hybrid
  actor: {
    role: string; // schedule the capability, not a specific model process
    strategy: "singleton" | "sharded" | "broadcast";
  };

  admission?: {
    activeHours?: ActiveHours;
    gate?: (
      ctx: GateCtx
    ) => Promise<
      | { run: false; reason: string }
      | { run: true; signal: Signal; subjectKey?: string; dedupeKey?: string }
    >;
  };

  context: {
    session: "same-thread" | "new-thread" | "new-process";
    materialization: "full" | "summary" | "checklist" | "none";
  };

  run: {
    overlap: "skip" | "enqueue-latest" | "enqueue-all" | "cancel-running" | "parallel";
    timeoutMs: number;
    retries?: { maxAttempts: number; backoffMs: number };
    queue?: string;
    priority?: number;
    idempotencyKey?: string;
  };

  state: {
    registration: "ephemeral" | "persistent";
    cursorStore: "memory" | "sqlite" | "redis";
    catchup: "none" | "latest-only" | "backfill";
  };

  outcome: {
    whenNoSignal: "drop" | "record";
    onSignal: DeliveryTarget[];
    onFailure: DeliveryTarget[];
  };

  governance?: {
    editableByAgent: boolean;
    approval: "none" | "human";
  };
}
```

这里最值钱的细节只有三个：
第一，`gate` 返回的是 **typed signal**，不是 boolean。这样 cheap checks 的结果能直接喂给 executor，避免再扫一遍。
第二，`actor.role` 调度的是能力，不是某个模型实例。
第三，`profile` 让你们外部写配置时不至于掉进“纯正交宇宙”的组合爆炸坑里。

## 2. 哪些维度并不完全正交

这套设计不是乐高无限拼，最好加几条 schema 约束：

* **`gate` 必须先于 heavy context**。否则你把 full session 先装满，再去做 cheap checks，省下来的成本会像被猫一爪拍飞。
* **`profile: precise` 不应该允许 `registration: ephemeral`**。对外承诺“每天 9:00”却绑在进程内 timer 上，这不是精确，是玻璃腿。
* **`retry` 和 `overlap` 一旦打开，就必须要求 idempotency/dedupe**。Trigger.dev 的 idempotency、BullMQ 的 deduplication、Inngest 对 idempotent retriable steps 的强调，本质上都在给这条规则背书。([Trigger][6])
* **`silent-if-ok` 也必须写内部 ledger**。对用户静默，不等于对系统失忆。内部至少要留下 `SKIP_NO_SIGNAL / SKIP_OVERLAP / RUN_DELIVERED / RUN_FAILED` 这种 reason code。
* **`broadcast` 默认只适合只读任务**。只要涉及外部 side effect，默认就该 `singleton` 或 `sharded`。
* **catchup/backfill 必须显式声明**。Temporal 和 Kubernetes 都把 missed-run 语义单独建模，不是没有道理。([Temporal 文档][1])

还有一个我很建议你们显式建出来的概念：**approximate vs exact**。
awareness task 默认应该允许 `jitter` 或 flexible window，避免每逢整点全猫齐醒；precise task 则默认零 jitter，并显式声明 timezone、catchup 和 overlap。Temporal 支持 jitter 并建议优先用 UTC 规避时区惊喜；EventBridge Scheduler 甚至把 flexible time window 做成一等配置。([Temporal 文档][1])

## 3. 业界案例里，哪些最值得抄

### Temporal

最适合当你们 **precise lane** 的语义教材。最值得抄的是 `overlap policy + catchup window + pause-on-failure + backfill` 这整套“错过了怎么办、撞车了怎么办、失败了怎么办”的模型。不要急着上 Temporal 本体，但它的语义层几乎就是你们 run policy 的参考答案。([Temporal 文档][1])

### Inngest

最适合当你们 **event-first + watchdog fallback** 的 TypeScript 参考。它天然把 event、cron、multiple triggers、concurrency、retries、debounce 放在一起，还支持一个函数同时被 event 和 cron 拉起，这几乎就是“事件驱动优先，定时兜底”的现成语法。([Inngest][2])

### Trigger.dev

最适合当你们 **Node/TS 的 AI 背景任务参考**。它把 scheduled tasks、shared queues、priority、idempotency、checkpoint/waitpoint 这些东西都明明白白摆出来了。特别是 queue lane 和 waiting run 释放并发槽这一套，非常适合多猫系统，能避免“大家都在等，结果把门口堵死”。([Trigger][7])

### LangSmith / LangGraph Deployment

最值得抄的是 **agent-specific 的 context / session 语义**。它明确区分 thread-specific cron、stateless cron、`multitask_strategy`、`on_run_completed`、run `durability`，还提醒你不用的 cron 要及时删，不然会累积 LLM 费用。这非常接近你们 heartbeat / isolated session / silent delivery 的真实问题域。([LangChain 文档][4])

### AutoGen + CrewAI

它们不是最强 scheduler，但对 **多 agent 的 actor/placement** 很有参考价值。AutoGen 的 runtime、topic、subscription 说明“谁收到什么任务”必须独立建模；CrewAI 的 flow persistence 和 crews/flows 分离，则说明“流程”和“执行者群体”不要搅成一团。([GitHub Microsoft][5])

### BullMQ

它很适合当你们 **Phase 2 的自托管底盘**，因为你们已经有 Redis。它现在有 Job Scheduler、upsert 语义、deduplication，做 poller 和 awareness lane 很顺手。唯一要记住的坑是，BullMQ 文档明确提到如果 queue 很忙或 worker/concurrency 不够，重复任务的生产频率可能低于设定间隔，所以它更像“可靠分发层”，不是“强精确定时承诺层”。([BullMQ][8])

## 4. 渐进式演进路径

### Phase 1：先别换 backend，先立骨架

第一步不是 cron，不是 EventBridge，也不是四个 adapter 一起冲。第一步是：

* 保留现有 `setInterval`
* 把 `ScheduledTask` 升级成 `TaskSpec`
* 引入统一流水线：`Wakeup -> Lease -> Gate -> Execute -> Outcome`
* 加 **Redis lease**，默认 `overlap: "skip"`
* 加 **SQLite run log + cursor**
* 把 `enabled()` 升级成 `gate(): GateDecision`
* 加 `whenNoSignal: "drop"`，把 `HEARTBEAT_OK` 变成协议，不是 prompt
* 先只做两个 profile：`awareness` 和 `poller`

这一步就能把 F102、PR/CI 轮询、未来猫猫巡检放进同一个调度壳里，而且不用动太多现网 wiring。最小变更不是“换掉 setInterval”，而是“让 setInterval 不再直接执行任务，而是只负责发 wakeup”。

**现在必须考虑的**：`actor.role`、`overlap`、`cursor`、`outcome`、`run ledger`。
**可以后补的**：backfill UI、DLQ、self-edit、复杂 calendar、外部 durable backend。

### Phase 2：加第二条 lane，不是加四个 adapter

到这一步，再把 runtime 拆成两条 operational lanes：

* **awareness/poller lane**：近似时间、cheap gate、silent-if-ok、latest-only、可以 jitter
* **precise lane**：cron/one-shot、显式 timezone、显式 overlap、retry、catchup

这时再选一个持久化底盘。
你们的现有栈里，**BullMQ** 是最省改造的自托管路径；想要更完整的 TS 背景任务能力，**Trigger.dev** 和 **Inngest** 都很贴脸。前者更像带队列和 observability 的 AI 任务平台，后者更像 event-first 的 durable workflow engine。([BullMQ][8])

我不建议这一步就做 `ClaudeScheduleAdapter / CronAdapter / EventBridgeAdapter / SetIntervalAdapter` 四件套。
原因很简单：你们真正想统一的是**语义**，不是 API 表面。Phase 2 只需要两类 driver：

* `IntervalOrCronTriggerDriver`
* `EventTriggerDriver`

然后让外部 backend 只是 driver 的具体实现。

### Phase 3：制度级自主，再上 control plane

这一层再上：

* pause/resume/list/history
* human approval
* self-service task registry
* agent 提 PR 修改 spec
* budget / quota / frequency floor
* repo-owned institutional tasks

这时 GitHub Actions 很适合放在 **制度级 lane**。它支持 event 和 schedule trigger、concurrency groups、protection rules，适合 repo 级别的汇总、制度化巡检、审批后的执行。可它也有明确限制：scheduled workflows 可能在高负载时延迟甚至丢弃，而且只跑默认分支，所以别拿它做你们的用户向硬时刻承诺。([GitHub Docs][9])

而真正对“每天 9:00 一定做、错过了要不要补、失败了是否自动暂停”很较真的任务，才值得进入 Temporal 这类更重的 durable precision lane。([Temporal 文档][1])

## 5. 你们现在最容易忽略的盲区

### 1. 不要 schedule 到模型，要 schedule 到角色

多猫系统里，`opus`、`gpt-pro` 只是执行候选，不该是 schedule 的主键。主键应该是 `role + subjectKey`。
例如：

* `role:memory-curator + threadId`
* `role:repo-watcher + repoId`
* `role:wellness-nudger + userId`

这样你们才能做 singleton/sharding/lease，而不是三只猫同时扑同一根激光笔。

### 2. `subjectKey` 是状态、并发、去重、路由的共同锚点

很多系统死在“任务是全局的还是按对象分片的”这个坑里。
我会强制任何 poller/awareness task 都能产出 `subjectKey`。它同时决定：

* cursor 存哪儿
* lease 锁哪儿
* dedupe key 算什么
* actor 如何分片

### 3. 沉默机制不能变成沉默故障

`silent-if-ok` 很香，但它最容易把系统变成黑洞。
解决法不是取消静默，而是把静默留给用户，把 run ledger 留给系统。再加一个很轻的 ops summary，例如每天一条内部汇总：“今天 48 次 wakeup，44 次 no-signal，3 次 signal，1 次 transient fail”。

### 4. 事件和定时一起上之后，最怕回音室

你们后面肯定会遇到这种链路：

`schedule -> agent 发消息 -> 消息事件 -> 再触发 schedule 对应任务`

一定要有 `origin / causalId / suppressionTTL`。不然系统会开始自己给自己梳毛，越梳越炸。

### 5. 自我修改 schedule 的安全边界

这是我最想钉死的一条：

**猫可以直接改的**：

* checklist / HEARTBEAT.md 内容
* 仅当前 thread 内、短 TTL 的一次性提醒
* 自己任务的 notes / rationale

**猫只能提议，不能直接改的**：

* 新的持久 recurring schedule
* 提高触发频率
* 新增外部 sink
* 新增会产生 side effect 的 tool
* 取消/暂停 safety-critical 任务
* 改 actor 范围，导致更多猫被唤醒

真正落地时，我建议把 `HEARTBEAT.md` 这类文件当 **context source**，而不是 schedule source of truth。
也就是：

* `task.spec.ts` 或 `task.yaml`：强类型、人类拥有、需要审批
* `checklist.md`：可版本化、可被 agent 修改、只描述“醒来检查什么”

这个分界线很重要。前者是电闸，后者是备忘录。别让备忘录顺手摸到总闸。

---

一句话收束：
**学 OpenClaw 的语义，不学它的 wiring；学 Temporal 的 run policy，学 LangSmith 的 thread 语义，学 Inngest/Trigger.dev 的 TS 手感。Phase 1 先把 `Trigger + Lease + GateDecision + Cursor + Outcome` 五件小硬骨头立起来，你们的统一调度抽象就会从“会打盹的 timer”长成“真能值班的值守台”。**

[1]: https://docs.temporal.io/schedule "https://docs.temporal.io/schedule"
[2]: https://www.inngest.com/docs/guides/multiple-triggers "Multiple triggers & wildcards - Inngest Documentation"
[3]: https://docs.langchain.com/langsmith/agent-server-api/crons/create-cron "https://docs.langchain.com/langsmith/agent-server-api/crons/create-cron"
[4]: https://docs.langchain.com/langsmith/agent-server-api/crons/create-thread-cron "https://docs.langchain.com/langsmith/agent-server-api/crons/create-thread-cron"
[5]: https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/framework/agent-and-agent-runtime.html "https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/framework/agent-and-agent-runtime.html"
[6]: https://trigger.dev/docs/idempotency "https://trigger.dev/docs/idempotency"
[7]: https://trigger.dev/docs/introduction "https://trigger.dev/docs/introduction"
[8]: https://docs.bullmq.io/guide/job-schedulers "https://docs.bullmq.io/guide/job-schedulers"
[9]: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows "https://docs.github.com/actions/using-workflows/events-that-trigger-workflows

---

## Part 3: 综合（宪宪 + 砚砚 × GPT Pro）

> 宪宪执笔，砚砚独立审阅后达成共识。2026-03-25
> 验证方式：全部结论都对照了实际代码（TaskRunner、SummaryCompactionTask、cat-config.json）

---

### 一、GPT Pro 审阅中我们全票采纳的

| # | 结论 | 我们的代码佐证 | 采纳理由 |
|---|------|---------------|----------|
| 1 | **Schedule → Trigger** 改名 | 我们已经把 `{ type: 'event' }` 放进设计，不只是 schedule | 名副其实 |
| 2 | **gate 返回 typed signal，不是 boolean** | F102 `isEligible()` 返回 boolean → `execute()` 二次读数据决定 concat/abstractive，存在重复扫描 | 消除二次查询 |
| 3 | **Durability 不是一位开关** | F102 的 `last_summarized_message_id`（cursor）、`carry_over`（run）、任务注册（ephemeral）是三件不同的事 | 三者独立变化 |
| 4 | **Context 拆两轴**：session isolation × materialization | `isolated`（在哪跑）和 `checklist-only`（带什么）不是同一件事 | 正交 |
| 5 | **Delivery 拆两轴**：outcome policy × sink | `silent-if-ok`（结果契约）和 `channel:telegram`（地址）不是同一件事 | 正交 |
| 6 | **新增 Actor/Placement 维度** | `cat-config.json` 已有 role 体系（architect、peer-reviewer、designer、coding），只是没和调度关联 | 多猫调度硬需求 |
| 7 | **新增 RunPolicy 维度** | TaskRunner 的 `running` Map 已经是隐式 `overlap: skip`，应该显式化 | 把隐式语义变显式 |
| 8 | **"电闸 vs 备忘录"分界线** | `task.spec.ts`（强类型、需审批）vs `checklist.md`（agent 可改） | 直接可用的设计原则 |
| 9 | **run ledger 必须从第一天就有** | `silent-if-ok` 对用户静默，不能对系统也失忆 | 可观测性底线 |
| 10 | **gate 必须先于 heavy context** | 先装满 session 再做 cheap check = 省的钱被猫一爪拍飞 | 成本纪律 |

### 二、我们打折 / 降级的

| # | GPT Pro 建议 | 我们的判断 | 理由 |
|---|-------------|-----------|------|
| 1 | **6+1 全量模型** | Phase 1 只做 5 维度（trigger/admission/run/state/outcome）+ actor optional | 当前 ~8 个任务，3-4 个需要完整语义。过度设计 = 脚手架 |
| 2 | **BullMQ 作 Phase 2 底盘** | 降级为 Redis Sorted Set + 简单 lease | 单进程 ~8 任务不需要完整 queue 框架。BullMQ 等真正需要 queue lane 隔离时再引入 |
| 3 | **RunPolicy 暴露 5 种 overlap** | Phase 1 硬编码 `overlap: skip` + `retry: 0` | awareness/poller 默认够用。Phase 2 再开放配置 |
| 4 | **Governance 进 TaskSpec 主体** | 降级为横切面，Phase 1 不进 spec | 先做运行正确，再做审批 |
| 5 | **Durability 独立顶层维度** | 收进 `state` 维度 | 避免第一版概念过多，registration/run/cursor 都是 state 的子维度 |

### 三、GPT Pro 没覆盖但我们必须补的（Cat Café 特有）

#### 3.1 MCP 路由 = 异步 handoff，不是同步函数调用

GPT Pro 假设 actor placement 是进程内 lease → 同步执行。但我们的猫是**独立 CLI 进程，通过 MCP 协议通信**。唤醒一只猫 = 通过 `post_message` 发一条带上下文的消息，然后**异步等回执**。

这意味着 actor 维度落地时必须包含 **dispatch receipt**：

```typescript
interface DispatchReceipt {
  assignedCatId: string;     // 实际接单的猫
  leaseKey: string;          // subjectKey-based 防并发
  invocationId: string;      // MCP invocation 追踪
  dispatchedAt: number;
  completionState: 'pending' | 'completed' | 'timeout' | 'failed';
}
```

**角色解析链路**：
```
trigger fire → gate 产出 typed signal
  → role resolver 读 roster / availability / thread affinity / cost hint
  → lease(subjectKey)
  → MCP dispatch
  → 等异步回执
```

#### 3.2 成本感知调度

不同猫的 LLM 成本差异巨大（Opus >> Sonnet >> Haiku，GPT-5.4 定价又不同）。actor 维度应包含 `costTier` hint：

- awareness 巡检：优先选便宜的猫（Sonnet），除非 gate signal 表明需要深度推理
- precise 任务：按 role 能力匹配，cost 是次要因素
- 确定性检查（gate）：零 LLM 成本，纯代码执行

#### 3.3 anti-feedback-loop（GPT Pro 提了但我们要具体化）

GPT Pro 提到 `origin / causalId / suppressionTTL` 防回音室。映射到我们的 MCP 消息体系：

- 每条 task-triggered 消息携带 `originTaskId`
- MCP `post_message` 的 `metadata` 字段可以承载
- 调度器在 gate 阶段检查 `suppressionTTL`：如果这条 trigger 是被自己的上一轮 outcome 间接引发的，skip

### 四、最终 Phase 路径

#### Phase 1a — 统一内部 poller（最小可用）

保留 `setInterval`，只加管道语义。覆盖 F102 摘要、PR/CI 轮询、MediaCleanup。

```typescript
interface TaskSpec_P1<Signal = unknown> {
  id: string;
  profile: 'awareness' | 'poller';

  trigger: { type: 'interval'; ms: number };

  admission: {
    activeHours?: { start: string; end: string; timezone: string };
    gate: (ctx: GateCtx) => Promise<
      | { run: false; reason: string }
      | { run: true; signal: Signal; subjectKey?: string; dedupeKey?: string }
    >;
  };

  run: {
    overlap: 'skip';          // Phase 1 硬编码
    timeoutMs: number;
  };

  state: {
    cursorStore: 'memory' | 'sqlite';
    runLedger: 'sqlite';       // 从第一天就有，不能后补
  };

  outcome: {
    whenNoSignal: 'drop' | 'record';
    onSignal: 'log-only' | 'post-message';
  };
}
```

**必须同期交付**：
- `Wakeup → Lease → Gate → Execute → Outcome` 五步流水线
- SQLite run ledger（reason code: `SKIP_NO_SIGNAL / SKIP_OVERLAP / RUN_DELIVERED / RUN_FAILED`）
- F102 `isEligible()` 升级为 typed signal gate

#### Phase 1b — 加 Actor，覆盖"唤醒猫"

```typescript
// Phase 1b 扩展
actor?:
  | { kind: 'local' }                                    // 本进程内
  | { kind: 'role'; role: string; strategy: 'singleton';  // MCP dispatch
      costTier?: 'cheap' | 'standard' | 'deep'; };
```

同期交付 dispatch receipt + MCP 异步回执追踪。

#### Phase 2 — 加 Cron Trigger + 持久化

- `trigger` 扩展支持 `{ type: 'cron'; expr: string; timezone: string }`
- `state.registration` 升级为 `'persistent'`（Redis/SQLite）
- 如规模需要，引入 BullMQ 或 Inngest
- 开放 `run.overlap` 更多模式

#### Phase 3 — 制度级自主 + Governance

- pause/resume/list/history API
- agent 自编辑 checklist（非 spec）
- human approval workflow
- GitHub Actions 作为制度级 lane
- budget/quota/frequency floor

### 五、业界参考速查表

| 我们的需求 | 最佳参考 | 抄什么 |
|-----------|---------|--------|
| Run policy 语义（overlap/catchup/backfill） | **Temporal** | 语义模型，不抄 runtime |
| event-first + timer fallback 的 TS 语法 | **Inngest** | 多 trigger + concurrency + debounce |
| AI 背景任务 + queue lane | **Trigger.dev** | scheduled tasks + idempotency + waitpoint |
| Agent-specific context/session | **LangSmith** | thread-specific cron + stateless cron + multitask_strategy |
| 多 Agent actor/placement | **AutoGen** | runtime + topic/subscription |
| 自托管持久化调度 | **BullMQ**（Phase 2 备选） | Job Scheduler + upsert + dedup |

### 六、一句话收束

**学 OpenClaw 的 HEARTBEAT_OK 静默协议，学 GPT Pro 的"任务语义从触发实现里剥出来"，但按我们自己的 MCP 异步 handoff 架构落地。Phase 1 先把 Trigger + Admission + Run + State + Outcome 五件小硬骨头立起来，F102 和 PR poller 即刻受益；Phase 1b 加 Actor 后，猫猫巡检才真正可行。**

---

*综合：宪宪/Opus-46 × 砚砚/GPT-5.4 | 外部审阅：GPT Pro | 2026-03-25*
