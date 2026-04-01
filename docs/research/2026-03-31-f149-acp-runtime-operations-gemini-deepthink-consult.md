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

你好。作为架构顾问，我非常欣赏你们这种“带着真实压测数据、明确不想做临时 workaround、专门来找刺”的提问方式。把 F143（抽象）和 F149（运行时操作）拆开是极度明智的工程决策，因为**本地黑盒 Agent 的并发池化与生命周期管理，历来都是翻车重灾区**。

基于你们拿到的现实约束——**“冷启极慢 (20.6s) / 新建极快 (2.3s)”**、**“未验证的底层并发能力”**，以及\*\*“异步多猫（秒级到小时级），且并非全量参与”\*\*——你们当前的倾向里藏着足以导致全局死锁和宿主 OOM（内存溢出）的定时炸弹。

不废话，我们直接上强度：

### 1\. 先推翻你们最危险的 3 个默认值（按致死率降序）

**💥 风险 Top 1：默认“thread 拥有 session / lease”**

  * **推翻理由（生命周期倒挂）**：这是导致系统资源枯竭的万恶之源。Thread 是长生命周期的业务实体（存活几小时到几天）；而 Lease 是对物理进程的排他性锁。如果 Thread 拥有 Lease，意味着猫在睡觉的 3 个小时里，底层的物理进程依然被牢牢霸占，无法被回收或服务于别人。
  * **正解**：Thread 只能拥有逻辑上的 `Session Context`。**Lease 必须严格收敛到 Turn / Prompt 的物理执行期（几秒到几十秒）**。发出 Prompt 瞬间申请 Lease，流结束的下一毫秒立刻归还 Lease。

**💥 风险 Top 2：V1 默认“一 project 一 process”**

  * **推翻理由（两极分化的灾难）**：在“未验证 stdio 多路复用”的情况下，必须悲观假设底层是 Single-flight（单通道阻塞）的。这个默认值会在两端炸开：
      * **极端 A（集中）**：如果 10 个活跃 Thread 在同一个 Project 下，唯一的 Process 就成了一把**全局串行大锁**。Thread A 执行 2 分钟的深思，会让仅仅想打招呼的 Thread B 被队头阻塞卡死 2 分钟。
      * **极端 B（分散）**：如果 10 个 Thread 分布在 10 个 Project 下，系统会无脑拉起 10 个挂载着 V8 和 MCP 的厚重 ACP 进程，这会直接把铲屎官的本地电脑拉爆（OOM）。

**💥 风险 Top 3：默认“warm process 优先于更多冷 process”（保活至上）**

  * **推翻理由（无视状态腐败）**：把服务器微服务的思维生搬硬套给本地 Agent。20.6s 冷启确实痛，但本地带状态 Agent 长时间运行必然发生内存泄漏、文件句柄遗留或上下文串味。如果不设上限地保 Warm，最后一定是以极度诡异的幻觉或暴毙收场。Process 必须被视为**易耗品**。

-----

### 2\. 更稳的 V1 替代方案：带防堵塞上限的弹性工作池 (Bounded Worker Pool)

如果不采用死板的“1 Project = 1 Process”，最强的替代模型是：**按 Project 隔离的动态 Worker 进程池**。

  * **Pool Key 不变**：依然是 `(projectPath, providerProfile)`。
  * **但 Value 变了**：不再是单一实例，而是一个 `List<Process>`，且拥有 `MaxWorkersPerPool`。

**为什么它完胜你们当前的倾向？**

1.  **完美化解“并发黑盒”地雷**：如果测出来 Gemini 不支持并发，池子允许拉起 Process 2 来处理 Thread B 的请求（吃 20s 延迟拉起，但绝生死锁阻塞）。
2.  **隔离爆炸半径**：某个 MCP 崩溃引起的 Panic 只会带走当前正在执行的 Worker 及其身上的 Session，该 Project 下分配在其他 Worker 的 Thread 毫发无损。
3.  **无痛兼容未来**：如果日后接入了完美支持多路并发的 Claude Code，只需将 Process 内的 `MaxConcurrentLeases` 参数从 1 调大，架构无需任何重构。

-----

### 3\. Admission / Eviction / TTL 建议表

针对“活跃 10 个、累计 20+、参与度稀疏、人类对话间隔长”的现实，策略的核心是：**对算力极其抠门，对内存极其无情。**

| 策略维度 | 建议配置 / 算法 | 顾问批注（防坑指南） |
| :--- | :--- | :--- |
| **Admission<br>(准入分发)** | **按需申请 + 悲观排队 (Queue)** | 只有 Prompt 瞬间才准入。如果有 IDLE 进程就拿走（2.3s 创建 session）；全 Busy 且不满额就扩容新进程；如果已达上限，**坚决让请求在池子外 Queue 排队（Fast-fail 30s）**，绝不把并发压力硬塞给底层的单管 STDIO。 |
| **Max Capacity<br>(容量上限)** | **全局总上限 = 3\~4 个**<br>**单 Pool 上限 = 2 个** | 绝对不能按 Thread 数定进程数！本地并发跑 4 个全副武装的大模型进程已经是体验灾难的边缘，必须有全局内存水位线做物理兜底。 |
| **Idle TTL<br>(空闲回收)** | **短 TTL：激进定在 15 分钟** | 对话间隔长达几小时，没必要为了省 20s 冷启而霸占内存。15 分钟没任何 Lease 产生直接 `SIGTERM` 杀进程。猫去睡觉了，唤醒需要 20s 是符合人类直觉的。 |
| **Forced Eviction<br>(强制转生)** | **Max Turns = 50 轮**<br>或 **Max Lifetime = 2 小时** | 无论进程当前多“健康”、多“Warm”，到点强制切为 `Draining` 态。等当前 Prompt 结束后强杀。**这是防本地内存泄漏和状态串味的唯一物理防御**。 |

-----

### 4\. 关键 Invariants (不变量) 与 State Machine 提醒

Session、Lease 和 Thread 最容易在这三种情况下发生灾难级“串味”：

  * **僵尸租约 (Zombie Lease)**：前端断网或被用户打断，但底层的流还在出，Lease 没被释放。进程永远卡在 BUSY 无法回收。
  * **刻舟求剑 (Orphaned Session)**：Process 因为 OOM 或 TTL 被池子悄悄杀了。Thread 醒来后，拿着老 `sessionId` 向新分配的 Process 发 Prompt，导致 `Session Not Found` 甚至跨会话串号。
  * **毒化传染 (Poisoned Process)**：Thread A 的非法 Prompt 导致 Process 内部出现未捕获异常。进程没死，被归还到 IDLE 池，无辜的 Thread B 拿到后直接继承了故障。

#### 🛡️ 必须死守的 3 个 Invariants：

1.  **同生共死 (Fate-Sharing)**：在内存里绝对禁止单独传递 `SessionId`，必须使用 `(PID, SessionId)` 复合主键。只要 Process PID 变了或挂了，其下的所有 Session 立刻在状态机中标记为 `DEAD`，强迫 Thread 下次乖乖走 2.3s 的 `newSession`。
2.  **遇错即封锁 (Taint on Error)**：只要 Process 的 stderr 抛出异常、标准输出报解析错误、或遭遇协议级超时，立刻将该 Process 标记为 **`TAINTED`**。该状态下的进程在当前 Lease 结束后**直接强制销毁（SIGKILL）**，严禁放回 IDLE 池。
3.  **计算即租约**：`Lease.AcquiredAt` 必须在发出第一段 NDJSON 前一毫秒；`Lease.ReleasedAt` 必须在收到 Stream 结束符的后一毫秒。**无 I/O 则无 Lease。**

-----

### 5\. “现在就该抽象” vs “绝对别提前抽象”的清单

为了以后兼容 Codex / Claude Code 这类新 Carrier，边界必须在 V1 就卡死：

#### 🟢 现在就必须留的 Seam（接缝）

1.  **`Capabilities.supports_multiplexing` Flag**
    在 Provider Profile 里留出这个能力探针。今天 Gemini 默认填 `false`，调度器走排队或水平扩容；明天如果接入了支持原生并发的模型，改个 `true`，Pool 就可以直接向同一个进程并行下发 Lease。
2.  **Transport Demultiplexer（I/O 帧边界隔离器）**
    必须把“提取完整的 NDJSON 并按 ID 路由”和“业务逻辑调度”拆开。F149 的底噪必须是一层纯粹且稳健的 Stream 分发器，它只看帧，不拆解业务 Payload。
3.  **Graceful Teardown 钩子**
    不同 Carrier 的拔管方式不同。必须留出 `Shutdown(timeout)` 接口，允许发送特定 JSON-RPC `exit` 指令。如果只用 `kill -9`，底层遗留的 SQLite 锁文件或孤儿 MCP 子进程会把你们下一次冷启坑死。

#### 🛑 绝对不要提前做的事情（YAGNI - 剧毒）

1.  **跨 Carrier 的 Session 状态迁移 / 快照恢复**
    不要尝试“把进程 A 的上下文 dump 出来喂给进程 B”。各家的内存树完全是黑盒。既然重点是 Process Reuse，一旦进程死了，上下文重建的最稳做法就是**利用 2.3s 的新建优势，靠上层 Thread 重新 Playback（回放）历史消息记录**。
2.  **细粒度的权限沙箱或 CWD 状态回滚**
    F149 是 Runtime Ops，只负责进程的生杀予夺。如果 Agent 把文件写坏了，不要试图在 F149 里实现一个虚拟文件系统去撤销修改。这属于 F143 配置或上层 Git Workspace 的事。
3.  **统一的 Token/Cost 算力记账模型**
    现在不要做。各家模型的 Token 计量和本地消耗方式天差地别，F149 只要充当透传管道，把原始 usage metrics 扔给 Observability，绝对不要试图在这一层建立“通用算力成本抽象”。
## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合 GPT Pro / Gemini DeepThink / codebase 约束后撰写

### 结论先行

两份云端结果里，真正值得我们吸收的不是那些具体数字，而是三条结构性共识：

1. **thread 不该持有 long lease，只该持有 logical session binding**
2. **`project/workspace + bootstrap profile` 应该是 pool domain 的 key，不该把 thread/session/model 塞进 process key**
3. **必须把失败作用域拆成 process / session / turn 三层，而不是所有错误都“一刀 kill worker”**

但我们也不能把云端建议当现成答案。对我们家当前代码和约束来说，下面这些是**可以采纳**、**暂时保留为假设**、以及**明确不采纳**的部分。

### 一、我们采纳的部分

#### 1. thread 持有 session binding，不持有物理 lease

这是两份结果最强的共同结论，也是我最认同的一条。

- thread 是业务层异步对话，生命周期可能跨分钟到小时
- process lease / execution slot 是物理资源，生命周期只能跟单次 prompt 或短暂 warm residency 走

所以正确的控制面是：

`thread -> logical session binding -> short-lived execution slot on process`

而不是：

`thread -> long-lived process lease`

这条如果不先定，后面所有 TTL / eviction 都会歪。

#### 2. `poolKey` 应该是 workspace/project + bootstrap profile

我接受 GPT Pro 的核心判断：**key 的职责是表达“这个进程可以安全复用给谁”**，不是表达“谁正在用它”。

因此：

- 应该进 key 的：规范化后的 `workspaceRoot/projectPath`、启动时不可热切换的 bootstrap/profile 信息
- 不该进 key 的：`threadId`、`sessionId`、`invocationId`、每轮 prompt 的局部参数

我也同意不能把 `model` 默认塞进 process key。Gemini ACP 客户端本地代码已经明确暴露了 `setSessionMode()` 和 `unstable_setSessionModel()`，这说明 model/mode 更像 session 级而不是 process 级：

- [acpClient.js](/opt/homebrew/Cellar/gemini-cli/0.35.3/libexec/lib/node_modules/@google/gemini-cli/dist/src/acp/acpClient.js)

#### 3. `loadSession` 是恢复原语，不是普通 attach

这点 GPT Pro 说得对，而且我用本机代码核实了：

- `GeminiAgent.loadSession()` 会调用 `session.streamHistory(sessionData.messages)`
- 也就是 **load 之后会把历史重新流一遍**

这意味着我们如果以后用 `loadSession` 做恢复，必须走 **shadow rehydrate** 或至少走“吞掉 replay 后再重新挂回 thread”的路径，不能把它当成普通 attach。

本地证据：

- [acpClient.js](/opt/homebrew/Cellar/gemini-cli/0.35.3/libexec/lib/node_modules/@google/gemini-cli/dist/src/acp/acpClient.js)

### 二、我们暂时只当假设，不当决策

#### 1. “同一个 process 可以稳定支持跨 session 并发 prompt”

这条现在**不能拍板**。

本机代码只证明了两件事：

- `GeminiAgent` 里确实有 `sessions = new Map()`
- `Session.pendingPrompt` 是 **每个 session 一个**，不是全局一个

这说明：

- **同 session 一定是 single-flight**
- **跨 session 可能允许并发**

但“可能允许并发”不等于“我们已经验证 Gemini ACP 端到端在一个 stdio 连接上多 session 并发是稳定的”。云端在这里走得比证据快了一步。

所以 F149 的 Phase A 仍然要先做这条实验：

> 同一 ACP process 下，两个不同 session 并发 prompt，是否会出现 merged / dropped / interleaved response。

在这条实验没过之前，我的默认运行策略是：

- **session-single-flight：真**
- **process-single-flight：先按真处理**
- 如果 Phase A 实测证明跨 session multiplex 稳定，再把 per-process cap 从 1 放宽到 2

#### 2. 具体数字：TTL、burst 数、resident session cap

GPT Pro 的 `20m/5m/8 cap`，Gemini DeepThink 的 `15m / 2h / 50 turns`，这些都只能当 **起始候选值**，不能直接抄成 Key Decision。

原因很简单：这些数字强依赖我们家真实的：

- @ 烁烁的日内分布
- project 热度
- 本机内存水位
- `loadSession` 成本
- 失败恢复 UX

这些都只有我们本地 telemetry 能决定。

### 三、我明确不采纳的部分

#### 1. 把“一 project 一 process”直接推翻成“固定小池 1→2 workers”

Gemini DeepThink 在这里给的是一个很有启发的**方向**，但不是我现在就会写进 spec 的**结论**。

我会保留它作为 **pool domain 设计的上界假设**：

- 一个 `poolKey` 不应该被解释成“单例 worker”
- 它应该被解释成“一个可扩缩的兼容域”

但 V1 到底是：

- warm 1 / burst 2
- 还是 strict 1 + queue

要等并发模型实验和 queue 指标回来再定。否则我们会在没有验证 multiplex 的情况下，先把调度器做成错的。

#### 2. “进程死了就直接 newSession + playback，不要管 loadSession”

Gemini DeepThink 这条太绝对，我不接受。

因为我们本地已经确认 Gemini ACP **有真实的 `loadSession` 能力**，虽然它会 replay 历史，但这不代表我们应该在设计上直接放弃它。更稳的说法应该是：

- `loadSession` 不是默认 attach
- 但它是值得保留的恢复原语
- 要不要在 V1 启用，取决于 Phase A 对 replay 成本和 transcript 污染的实测

### 四、我的综合方案

如果现在就要给 F149 一个本地综合版本，我的结论是：

1. **`poolKey = normalizedWorkspaceRoot + providerBootstrapProfileHash`，但这是 pool domain，不是单例 worker。**
2. **thread 持有 `logicalSessionBinding`，不持有 long lease。**
3. **lease/execution slot 只在单次 prompt 物理执行期存在；warm residency 是 process 级策略，不归 thread 所有。**
4. **V1 默认按最保守的并发假设运行：same-session single-flight，cross-session 暂不放开。**
5. **F149 Phase A 的第一优先实验，不是再测 cold start，而是测单进程双 session 并发 prompt 的正确性。**
6. **失败 taxonomy 采用三层：**
   - process-poison：协议污染、stdout parse failure、zombie、transport desync → kill worker
   - session-poison：merged/dropped response、replay 失真、重复内部错误 → seal session
   - turn-transient：429/5xx 且无 side effect → retry/backoff；有 tool side effect → 不盲重试
7. **`loadSession` 保留为恢复原语，但恢复路径必须 shadow，不得把 replay 直接喷回用户线程。**

### 五、最值得写回 F149 的一句话

> **F149 的核心不是“让 thread 占住一只烁烁”，而是“让 thread 稳定绑定一个 logical session，再把这个 session 短租到合适的 ACP runtime 上”。**
