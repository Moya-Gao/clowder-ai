---
feature_ids: [F149, F143]
topics: [acp, runtime, process-pool, lease, gemini, agent-hosting]
doc_kind: consult
created: 2026-03-31
updated: 2026-03-31
model: gpt-pro
---

# F149 ACP Runtime Operations — GPT Pro Consultation

## Part 1: 发给云端模型的提示词

> 直接复制发送

---

你好，我们是 **Cat Café** —— 一个多 AI agent 协作平台。家里有多只 AI 猫（Claude / GPT / Gemini 等），它们通过 Hub、线程、@mention、MCP 工具和 session chain 协作完成任务。

我们不是在问“ACP 协议值不值得支持”，也不是在问“要不要把 agent 降级成 raw API”。这两件事都已经在本地拍板：

1. **要支持 ACP-style local agent**
2. **不能把 Gemini 这类 agent 替换成 API adapter**，否则会失去 agent 身份、工具能力、session 连续性

我们现在真正需要你帮忙的是：

> **对于 ACP-style local agent，runtime 的 process / session / thread / project / lease 应该怎么建模和回收，才能在多 thread / 多 project 场景下既保留 agent 性质，又避免进程爆炸。**

### 现有架构背景

我们已有一个更大的母 feature：**F143 Hostable Agent Runtime**。它解决的是通用宿主抽象：

`Transport × Binding × RuntimeContract × EventAdapter + Supervisor/Discovery`

F143 的边界是“如何让不同宿主协议/载体都能接进来”，它的 Phase B 只要求：

- ACP-style local agent 能通过新栈完成单轮对话
- session / task 两类 runtime contract 能 resume / cancel

也就是说，F143 关注的是 **kernel / abstraction seam**，不是 ACP agent 的池化与租约运营策略。

### 当前本地实测（Gemini 为第一载体）

我们最近验证了 `gemini --acp` 这条路：

- `gemini --acp` 是真实的 machine-facing 协议入口，不是 TUI 黑魔法
- 在仓库 cwd 下，配合精简后的 MCP profile，可以完成：
  - `initialize`
  - `newSession`
  - `prompt`

当前可复现测量值：

| 场景 | 指标 |
|------|------|
| 干净 `HOME` + 干净 cwd | `initialize ≈ 5s` |
| 当前 `HOME` + 干净 cwd | `initialize ≈ 12.5s` |
| 当前 `HOME` + 仓库 cwd + 精简 MCP | `initialize = 20.6s` |
| 同上 | `newSession = 2.3s` |
| 同上 warm prompt | 首字约 `5-6s` |

我们已经把 workspace MCP 缩到了这 5 个：

- `cat-cafe`
- `cat-cafe-memory`
- `cat-cafe-collab`
- `cat-cafe-signals`
- `pencil`

外部高噪声项（`playwright` / `agent-browser` / `pinchtab` / `MCP_DOCKER` / `xiaohongshu`）已去掉。

### 关键未验证约束：ACP 并发模型

**尚未验证**：单个 ACP 进程是否支持多 session 并发 prompt（stdio 单通道多路复用），还是 single-flight（同一时刻只能有一个 prompt in flight）。

ACP 走 stdin/stdout NDJSON 流，一个进程只有一对 stdin/stdout。我们目前只验证了**顺序**两轮 prompt（同一 session），没验证**并发**多 session prompt。这直接影响 pool sizing 策略：
- 如果支持并发多路复用 → 一 project 一 process 可能够用
- 如果 single-flight → 并发 @ 同一 agent 的 thread 要么排队，要么需要多个 process

请在回答 pool key、admission/eviction 策略时，分这两种情况给建议。

### 问题已经从”协议能不能活”转移到了”runtime 怎么运营”

铲屎官给出的关键现实约束是：

- 一次可能同时开 10 个活跃 thread
- 一天可能累计开 20+ 个 thread
- 但 Gemini 并不会参与每一个 thread
- 所以 **10 个 thread 不应该等于 10 个 Gemini 进程**

我们当前本地倾向是：

1. **F149 单独立项**，作为 F143 的子层 feature  
   F143 解决宿主抽象；F149 解决 ACP runtime operations

2. **V1 默认一 project 一 process**  
   进程池 key 倾向于 `(projectPath, providerProfile)`，而不是按 thread 开进程

3. **thread 不直接拥有 process，只拥有 session / lease**  
   thread 真正需要 @ 这个 agent 时才 attach

4. **优化目标是 process reuse，不是再谈 session resume**  
   我们已有旧路径的 `--resume` 能力；当前痛点是每轮重启 CLI

### 我们不想让你重新回答的事情

下面这些不要再从头论证，默认已经成立：

- 不要建议把 Gemini 改成 Google AI SDK 的 raw API adapter
- 不要把问题重新提升回“如何设计通用 hostable runtime kernel”（那是 F143）
- 不要再泛泛讨论“ACP 和 A2A 哪个是标准”；我们只问 ACP-style local agent 的 runtime operations

### 请你重点回答的问题

请给明确立场，不要温柔折中。我们更想要 **V1 推荐方案 + tradeoff table**，而不是“都可以”。

#### 1. Process pool 的 key 该怎么选？

对于 ACP-style local agent，V1 默认 key 应该是什么？

- `projectPath`
- `providerProfile`
- `provider + model`
- `projectPath + providerProfile`
- 其他组合

请回答：

- 你推荐哪个作为 V1 默认？
- 哪个维度绝对不能进 key？
- 哪些信息应该放在 session/lease 层，而不是 process 层？

#### 2. thread / session / lease / process 的关系怎么拆最稳？

我们现在最需要一个清楚的分层：

- process：长驻 ACP 进程
- session：agent 内部对话连续性
- lease：host 侧资源占用与回收语义
- thread：Cat Café 的业务对话线程

**重要约束**：我们的 thread 是异步多猫对话（不是同步 RPC）。一个 thread 内 @ Gemini 的间隔可能从秒级到小时级——铲屎官 @ 烁烁后可能 10 分钟才看回复，中间又 @ 了其他猫。lease 需要兼容这个时间尺度。

请给出一个 **最稳的 V1 映射**：

- 一个 thread 对应一个 session 吗？
- 同一个 process 能挂多个 thread session 吗？
- lease 应该绑 session、绑 thread，还是绑一次 invocation？
- cancel / timeout / crash 后，哪个对象负责回收？

#### 3. Admission / eviction / TTL 应该怎么定？

请针对下面这类场景给具体建议：

- 10 个活跃 thread 并发
- 一天累计 20+ thread
- 但某个 agent 只在其中 3 个 thread 真正被 @ 到

我们想知道：

- idle TTL 应该偏短还是偏长？
- max live process count 建议怎么定？
- 超上限时应该按 LRU、按空闲时间、还是按 session 数做淘汰？
- 单 project 多 thread 并发时，是 queue、single-flight，还是允许多 session 并行？

#### 4. 哪些指标最能判断这套设计是对的？

请告诉我们 V1 必须落地的 metrics / benchmark matrix。我们当前想到的有：

- `cold_init_ms`
- `attach_ms`
- `warm_first_chunk_ms`
- `warm_hit_rate`
- `live_process_count`
- `sessions_per_process`
- `idle_waste_ms`
- `lease_queue_wait_ms`

请补充或删减，并说明：

- 哪些是“必须上 dashboard”的
- 哪些只用于调试

#### 5. 失败模式和恢复策略

我们预期的失败模式包括：

- ACP 初始化失败
- prompt 期间 provider/model 容量错误
- stdout/stderr 被噪声污染
- 僵尸进程
- stale lease
- poisoned session
- MCP profile 漂移

请给我们一个 V1 失败 taxonomy：

- 哪些错误该 kill process
- 哪些错误该只 seal session
- 哪些错误该 fail-open / retry
- 哪些必须带人工可见告警

#### 6. 哪些该问云端，哪些必须由我们本地拍板？

请你顺手帮我们划一刀：

- 哪些是适合让外部专家给建议的架构问题
- 哪些是必须结合我们自己的 runtime / UX / 资源预算才能定的本地 policy

### 理想输出格式

请按下面结构答：

1. **V1 明确推荐**（最多 10 条）
2. **Process / session / lease / thread 关系图**
3. **Admission / eviction / TTL 建议表**
4. **Metrics 清单（必须 / 可选）**
5. **Failure taxonomy**
6. **我们当前方案里最危险的 3 个盲区**

如果你觉得我们当前倾向（`一 project 一 process` + `thread 持有 session/lease`）是错的，请直接推翻。

---

## Part 2: 云端模型回答（待回填）

> 铲屎官把 GPT Pro 的回答粘贴到这里

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合 GPT Pro / Gemini DeepThink / codebase 约束后撰写

[待撰写]
