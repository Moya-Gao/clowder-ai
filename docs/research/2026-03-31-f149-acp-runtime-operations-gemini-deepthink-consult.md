---
feature_ids: [F149, F143]
topics: [acp, runtime, process-pool, lease, gemini, agent-hosting]
doc_kind: consult
created: 2026-03-31
updated: 2026-03-31
model: gemini-deepthink
---

# F149 ACP Runtime Operations — Gemini DeepThink Consultation

## Part 1: 发给云端模型的提示词

> 直接复制发送

---

你好，我们是 **Cat Café** —— 一个多 AI agent 协作平台。现在我们准备让 **ACP-style local agent** 作为一等公民接进来，但不想把问题做成临时 workaround。

请你把自己当成一个会专门挑毛病的架构顾问：**优先帮我们找盲区、反例和错误默认值**，不要只顺着我们的当前倾向说“可以”。

### 我们已经本地拍板的事情

以下问题不要重新展开大辩论：

1. **要支持 ACP-style local agent**
2. **不能把 Gemini 这类 agent 降级成 raw API adapter**
3. **通用宿主抽象由 F143 负责**，这次不是再写一个新的 runtime kernel

更具体地说：

- F143 已经定义了更上层的 hostable runtime 抽象：  
  `Transport × Binding × RuntimeContract × EventAdapter + Supervisor/Discovery`
- F143 负责“怎么让 ACP-style local agent 这类载体能接进来”
- 我们这次要解决的是：  
  **接进来之后，runtime 应该怎样池化、分配、回收、观测**

### 当前本地实验事实（Gemini 为第一载体）

我们验证了 `gemini --acp`：

- 协议是真实可用的 machine-facing 入口
- 在仓库 cwd 下，配合精简 MCP profile，可以完成：
  - `initialize`
  - `newSession`
  - `prompt`

当前测量数据：

| 场景 | 指标 |
|------|------|
| 干净 `HOME` + 干净 cwd | `initialize ≈ 5s` |
| 当前 `HOME` + 干净 cwd | `initialize ≈ 12.5s` |
| 当前 `HOME` + 仓库 cwd + 精简 MCP | `initialize = 20.6s` |
| 同上 | `newSession = 2.3s` |
| 同上 warm prompt | 首字约 `5-6s` |

当前 workspace 的 Gemini MCP 最小集：

- `cat-cafe`
- `cat-cafe-memory`
- `cat-cafe-collab`
- `cat-cafe-signals`
- `pencil`

已经移除高噪声外部 MCP。

### 关键未验证约束：ACP 并发模型

**尚未验证**：单个 ACP 进程是否支持多 session 并发 prompt（stdio 单通道多路复用），还是 single-flight。ACP 走 stdin/stdout NDJSON 流，我们只验证了顺序两轮 prompt，没验证并发多 session。这直接决定"一 project 一 process"够不够用。请在挑战我们的默认值时考虑这个变量。

另外，我们的 thread 是**异步多猫对话**（不是同步 RPC），@ agent 的间隔可能从秒级到小时级。请在评估 lease / TTL 策略时考虑这个时间尺度。

### 铲屎官给我们的真实约束

这是这个问题最重要的现实输入：

- 同时可能有 10 个活跃 thread
- 一天累计可能有 20+ thread
- 但 Gemini 不会参与全部 thread
- 所以不能把“thread 数”直接映射成“ACP 进程数”

铲屎官原话：
> “10个thread 烁烁可不是随时都需要参加的啊。”
>
> “今天可能一共开了20个甚至更多thread。”
>
> “砚砚的想法还是一个脚手架不是最终状态。”

### 我们当前的本地倾向

请你重点挑战这些点，而不是机械赞同：

1. **单开子 feature（F149）而不是继续塞回 F143 AC-B1**  
   理由：F143 解决抽象内核，F149 解决 ACP runtime operations

2. **V1 默认一 project 一 process**  
   process pool key 倾向 `(projectPath, providerProfile)`

3. **thread 不拥有 process，只拥有 session / lease**

4. **优化目标是 process reuse，不是再重复讨论 session resume**

5. **Gemini 是第一载体，但 feature 命名不绑死单 provider**  
   未来可能扩到 Codex / Claude Code / OpenCode 这类 ACP carrier

### 请你重点挑战的 5 个问题

#### 1. 我们最可能搞错的默认值是什么？

在下面这些默认值里，你最想先推翻哪个？

- `一 project 一 process`
- `process pool key = (projectPath, providerProfile)`
- `thread 拥有 session / lease`
- `warm process 优先于更多冷 process`
- `Gemini 先落地、其他 ACP carrier 以后再说`

请按风险从高到低排序。

#### 2. 如果不采用“一 project 一 process”，最强的替代模型是什么？

我们想听反例：

- 按 providerProfile 开 pool？
- 按模型档位开 pool？
- 单 process 多 project multiplex？
- 彻底不要 pool，只做按需常驻？

请你给出最强替代方案，并明确说它为什么优于我们当前倾向。

#### 3. session / lease / thread 三者最容易串味的地方在哪？

我们担心的问题包括：

- 一个 thread 的 session 被另一个 thread 误复用
- lease 回收了但 session 还挂着
- session 很脏但 process 还活着
- process 很干净但 session 已 poisoned

请你告诉我们：

- 最危险的状态错位是哪几种？
- 应该用什么 invariant / state machine 防住？

#### 4. 在多 thread 但非全量参与的现实里，最好的 admission / eviction 策略是什么？

请直接给策略，不要抽象空话。尤其回答：

- idle TTL 偏短还是偏长？
- 先做 LRU 还是更复杂的热度模型？
- max live process count 怎么定更稳？
- attach 新 thread 时该 queue，还是允许多 session 并行？

#### 5. 如果这套设计未来要兼容 Codex / Claude Code ACP，最早应该留什么 seam，最不该提前抽象什么？

我们现在不想过度泛化，但也不想做成 Gemini-only patch。

请告诉我们：

- 哪个 seam 必须现在就留
- 哪个抽象应该坚决等第二个 carrier 真的接入后再做

### 你不要浪费篇幅回答的事情

- 不要建议 raw API adapter
- 不要重新设计完整 hostable runtime kernel
- 不要再给我们科普 A2A/MCP/ACP 历史

### 理想输出格式

请按下面结构输出：

1. **先推翻我们最危险的 3 个默认值**  
2. **给一个更稳的 V1 方案**  
3. **用表格写 admission / eviction / TTL 建议**  
4. **写出关键 invariants / state machine 提醒**  
5. **列出“现在就该抽象” vs “绝对别提前抽象”的清单**

如果你觉得我们当前方向总体对，也请明确指出“对，但最容易死在哪三个细节”。

---

## Part 2: 云端模型回答（待回填）

> 铲屎官把 Gemini DeepThink 的回答粘贴到这里

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合 GPT Pro / Gemini DeepThink / codebase 约束后撰写

[待撰写]
