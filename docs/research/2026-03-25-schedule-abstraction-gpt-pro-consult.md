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

[待回填]

---

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合 Part 2 + 本地 codebase 验证后撰写

[待撰写]
