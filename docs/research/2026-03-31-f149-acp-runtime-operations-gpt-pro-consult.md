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

我给明确结论：

**你们的 V1 不该推翻“`一 project 一 process 域`”，但必须推翻“thread 持有 long lease”这半句。**
正确形状是：

**`poolKey = (workspaceRoot, providerBootstrapProfileHash)`**
**`thread -> logical session binding`**
**`session -> short residency lease on process`**
**`prompt -> execution slot`**

ACP 本来就把 session 视为独立会话上下文，而且一条连接可以承载多个 concurrent sessions；Gemini 的 ACP 实现也是在 agent 内部维护一个 `sessions: Map`，`newSession`/`loadSession`/`prompt` 都围绕 sessionId 运作。([代理客户端协议][1])

## 1. V1 明确推荐

1. **V1 默认 process pool key 用 `workspaceRoot + providerBootstrapProfileHash`。**
   `workspaceRoot` 取规范化后的项目根，不是 thread 当下的原始 cwd。Gemini 的 project settings、`.gemini` 目录内容、sandbox/context 等都是项目作用域；同时 Gemini 的 ACP `newSession` 也会按传入的 `cwd` 加载该目录的 settings。([GitHub][2])

2. **`providerBootstrapProfileHash` 要表达“进程级兼容域”，不是 “provider + model”。**
   它至少该包含：agent kind（如 `gemini-acp`）、binary path + version/channel、auth method/identity、baseUrl/custom headers、以及所有 restart-required 的启动配置与策略包。Gemini 在 agent 实例上保存 `apiKey`、`baseUrl`、`customHeaders`，后续 `newSession` 会继续复用这些进程级认证参数。([GitHub][3])

3. **绝对不能进 key 的维度：`threadId`、`sessionId`、`invocationId`、`model`、`mode`、approval level。**
   ACP 把 model/mode 设计成 session 级配置项，并且允许在 session 存活期间动态修改；Gemini 也实现了 per-session 的 `setSessionMode` 和 `unstable_setSessionModel`，CLI 文档里的 `--model` 也是“for this session”。([代理客户端协议][4])

4. **一个 Cat Café thread 应该对应“一个 logical ACP session per agent identity/profile”，不是一个 thread 共用一个 Gemini session，也不是每次 invocation 新开 session。**
   ACP 对 session 的定义就是“独立 conversation/thread 的上下文、历史与状态”。共享到多个业务 thread 会直接引入上下文串味。([代理客户端协议][1])

5. **同一个 process 可以挂多个 thread 的 session，但只限于同一个 `poolKey`。**
   这不是取巧，而是 ACP 和 Gemini 这条栈本来的设计方向：ACP 文档明确说一个 connection 可以支持多个 concurrent sessions，Gemini 源码也确实把多个 session 存进同一个 agent 实例里。([代理客户端协议][5])

6. **并发规则我给得很硬：`session-single-flight`，`process-multi-session`。**
   同一 session 上，永远不允许两个 prompt overlap。Gemini 的 `Session.prompt()` 一进来就会 abort 掉已有的 `pendingPrompt`。不同 session 之间，我建议 V1 **允许并行**，但做低上限，先从 **每个 process 最多 2 个并发 prompt** 起步。ACP TypeScript SDK 的接收循环不会等前一个请求处理完才读下一个消息，说明跨 session 的并发处理在当前 SDK 里是通的；写出站消息则用单独 write queue 串行化。([GitHub][3])

7. **thread 持有的是 `SessionBinding`，不是 long-lived lease。**
   thread 可以长期记住 “我和这个 agent/profile 绑定的是哪个 logical session”，但真正的 lease 应该是“这个 session 当前短暂附着在哪个 process 上”，并带 `leaseEpoch` 之类的 fencing。因为在同一 stdio 连接上，多 session 更新会交错出现，你们的事件路由必须按 `(sessionId, leaseEpoch)` demux，不能按“当前这个 process 正在服务哪个 thread”去猜。([代理客户端协议][5])

8. **生命周期要分三层：session 长，residency 中，execution 短。**
   逻辑 session 可以跟 thread 走很久；session 附着在某个 process 上的 warm residency 只保留一段 idle TTL；每次 prompt 的 execution slot 则只活一个 turn。你们现在最容易犯的错，就是把这三层揉成一个“lease”。

9. **`loadSession` 只能当恢复/重绑原语，不能当用户可见 attach。**
   ACP 规范要求 `session/load` 时 agent 必须把整段历史重新以 `session/update` replay 一遍，之后客户端才能继续 prompt。也就是说，崩溃恢复一定要走“shadow rehydrate”路径，吞掉 replay，再把 session 重新挂回 thread；不然你们的 thread transcript 会被重复灌一遍。([代理客户端协议][1])

10. **把 `project+profile` 看成一个 pool domain，不是单例进程。**
    我的 V1 不是“一 key 永远只有一个 process”，而是“**一 key 默认 warm 1 个，热点时 burst 到 2 个**”。这样你们既不会掉进 “10 个 thread = 10 个 Gemini 进程”，也不会被迫接受“同项目只要并发就全部排一条长队”。

### Process key 取舍表

| 候选 key                          | Verdict   |
| ------------------------------- | --------- |
| `projectPath`                   | 不够        |
| `providerProfile`               | 不作为 V1 默认 |
| `provider + model`              | 不要        |
| `projectPath + providerProfile` | **V1 默认** |
| `thread / session / invocation` | **禁止**    |

背后的刀法很简单：project 是本地策略、context、sandbox、settings 的自然隔离边界；model/mode 属于 session 层；而 auth/baseUrl/headers 与 restart-required 启动配置属于 process 兼容域。([GitHub][2])

## 2. Process / session / lease / thread 关系图

```text
Cat Café Thread
   └─ AgentBinding
      (threadId, agentIdentity, providerBootstrapProfileHash)
         └─ SessionRecord
            (logicalSessionId, acpSessionId?, status, poisoned?, lastUsedAt)
               ├─ detached
               └─ attached via SessionLease
                  (processId, leaseEpoch, idleTTL, attachedAt)
                     └─ ACP Process
                        (poolKey, inflightPrompts, residentSessions, state)
                           ├─ Session A
                           ├─ Session B
                           └─ Execution slots
                              - same session: 1 hard max
                              - cross session: 2 soft max
```

实际运行时我建议这样走：

* 第一次在 thread 里 `@Gemini` 时，创建 `SessionRecord`，向 `poolKey` 下某个 process 发 `session/new(cwd, mcpServers)`。
* 后续再 `@Gemini`，优先复用同一个 `SessionRecord`。如果原 process 还活着且 lease 有效，直接复用；如果 process 死了或被驱逐，就对新的兼容 process 做一次 **shadow `session/load`**，吞掉 history replay，再继续。([代理客户端协议][1])
* 一个 `SessionRecord` **永远只允许 attached 到一个 live process**。不要双挂，不要双写。
* `cancel / timeout` 由 execution slot 负责；`crash / disconnect / zombie` 由 process supervisor 负责；`poisoned session` 由 `SessionRecord` 自己负责封印并拒绝后续 attach。

## 3. Admission / eviction / TTL 建议表

| Knob                                | V1 默认                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| `poolKey`                           | `workspaceRoot + providerBootstrapProfileHash`               |
| warm target per key                 | `1`                                                          |
| burst max per key                   | `2`                                                          |
| global live Gemini processes        | `4` 起步                                                       |
| concurrent prompts per session      | `1` 硬上限                                                      |
| concurrent prompts per process      | `2` 软上限，只允许跨 session                                         |
| primary idle TTL                    | `20 min`                                                     |
| overflow idle TTL                   | `5 min`                                                      |
| logical session TTL                 | **不设短 TTL**，跟 thread 生命周期走                                   |
| session attachment TTL              | 跟 hosting process 一起失效                                       |
| resident session cap / process      | `8`，到 cap 后进入 draining                                       |
| spawn trigger                       | `queue_wait_p95 > 1.5s` 或 queue depth > 1 且所有 slot 已满        |
| eviction order                      | idle overflow → idle draining → 最冷 key 的 oldest idle primary |
| fallback if concurrency bench fails | 把 `concurrent prompts per process` 降到 `1`，其余模型不变             |

我对这些数值的态度也很明确：

* **idle TTL 对 primary 要偏长**。你们自己测到 cold init 很贵，而且 `loadSession` 还会 replay 全历史，conversation 越长恢复越重，所以保一段 warm residency 值回票价。([代理客户端协议][1])
* **idle TTL 对 overflow 要偏短**。burst 进程只负责吸峰值，峰一过就该塌回去。
* **单 project 多 thread 并发**，不是全局 single-flight，也不是无限并行。我的建议是：**同 session 一律 queue；不同 session 在同 process 上允许 2 路并行；超过 2 路再 queue；queue 变坏时再 burst 第二个 process。** 这和 ACP 文档的多 session 形状、Gemini 的 session map、当前 TypeScript SDK 的并发接收路径是一致的。([代理客户端协议][5])
* **resident session cap 一定要有**。Gemini 的 initialize 响应里有 `loadSession`，但没给你 session close/delete/list 这类稳定 GC 能力，所以 V1 最靠谱的 resident-session 回收边界就是 process rotation。([GitHub][3])

## 4. Metrics 清单

`attach_ms` 我会删掉，拆成 **`session_new_ms`** 和 **`session_load_ms`**。前者是首绑成本，后者是恢复成本，两者语义完全不同，尤其 `loadSession` 还带 history replay。Gemini CLI 也支持把 ACP telemetry 落地成 JSON 文件，足够接你们的 benchmark harness。([代理客户端协议][1])

**必须上 dashboard**

* `process_cold_init_ms`
* `session_new_ms`
* `session_load_ms`
* `prompt_queue_wait_ms`
* `time_to_first_session_update_ms`
  你们现在的 `warm_first_chunk_ms` 可以并进来
* `turn_wall_ms`
* `process_reuse_rate`
* `session_recover_success_rate`
* `live_process_count`
* `live_process_count_by_key`
* `inflight_prompts_per_process`
* `resident_session_count_per_process`
* `evictions_total{reason}`
* `transport_resets_total`
* `cancel_latency_ms`

**可选 / 调试**

* `idle_waste_ms`
* `sessions_per_process`
* `mcp_init_ms`
* `permission_roundtrip_ms`
* `fs_proxy_roundtrip_ms`
* `stdout_parse_error_total`
* `stale_lease_drop_total`
* `poisoned_session_total`
* `shadow_reload_replay_ms`

## 5. Failure taxonomy

| Failure                                              | 作用域           | V1 动作                                                   |
| ---------------------------------------------------- | ------------- | ------------------------------------------------------- |
| `initialize` / bootstrap / auth 失败                   | process start | 失败即不入池；只有 transport/bootstrap 类错误允许一次 clean-proc retry  |
| provider 429 / 5xx，且**尚未出现 tool call**               | turn          | 保留 session/process，允许一次带 backoff 的自动重试                  |
| provider 429 / 5xx，且**已经出现 tool call / side effect** | turn          | **禁止盲重试**，把失败抛给上层；session 仍可继续                          |
| empty turn / merged chunks / context poison          | session       | seal session，禁止继续复用；新建 session + handoff summary        |
| stdout/stderr 污染、NDJSON 解析失败、协议失步                    | process       | 直接 kill process，detach 全部 attached sessions             |
| cancel 超时、僵尸进程、连接断开                                  | process       | kill/reap，attached sessions 变 detached，下次按需 shadow load |
| stale lease / late update                            | lease         | 用 `leaseEpoch` 丢弃，不 kill；高频时告警                          |
| MCP profile drift                                    | attach path   | 拒绝 attach 到旧 process，改路由到兼容 key 或新建 process             |

几条硬规则：

* Gemini 源码里会把 429 映射成 ACP `RequestError(429, "Rate limit exceeded")`，所以 **429 不是 process-poison**，默认不该一刀把 worker 杀掉。([GitHub][3])
* 但 **只要这个 turn 已经出现 tool call**，你们就不能自动重试，因为幂等性已经不可靠了。
* `gemini --acp` 是 stdio 上的 JSON-RPC/NDJSON 通道，**stdout 一旦被污染就是 transport 级事故**，按 process-poison 处理。([代理客户端协议][6])
* “poisoned session” 不是我在危言耸听。Gemini 官方仓库在 **2026-03-27** 还有一个 ACP issue，报告“同一 session 的第 2 个及之后 prompt 会出现 dropped response / merged response”。所以 V1 一定要有 session seal 机制，别无限 retry 到天荒地老。([GitHub][7])

## 6. 你们当前方案里最危险的 3 个盲区

1. **把 lease 跟 thread 绑死。**
   这会把“人类 10 分钟后再回来 @ 一次”的空窗，硬生生变成“进程 10 分钟不能回收”。thread 该长持有的是 session binding，不是 worker residency。

2. **把 `loadSession` 当成静默 attach。**
   不是。ACP 要求 replay 全历史。恢复路径如果不做 shadow rehydrate，你们会把旧 transcript 再喷一遍到 Cat Café 线程里。([代理客户端协议][1])

3. **`providerProfile` 定义得太松，或者 `projectPath` 规范化得太粗糙。**
   如果 profile 里不含 auth/baseUrl/restart-required policy/env，你们会把不兼容 session 塞进同一 process；如果 path 只是原始 cwd，又会把同一项目切碎成多个 key。Gemini 的项目 settings、策略路径、sandbox/context 都说明了 project 与 startup config 需要被严肃对待。([GitHub][2])

## 7. 哪些该问云端，哪些必须本地拍板

**适合问外部专家的**

* 对象分层是不是稳：process / session / lease / thread 的职责边界
* 并发不变量：same-session overlap 禁止，cross-session capped parallelism 是否合理
* failure taxonomy 是否完整
* benchmark matrix 应该怎么设计，才能最快证伪错误假设

**必须你们本地拍板的**

* `workspaceRoot` 的规范化规则
* `providerBootstrapProfileHash` 的具体字段
* `primary TTL 20 min` 还是 `30 min`
* global live cap 是 `4` 还是 `6`
* queue 等待多久才 burst 第二个 process
* 告警阈值、用户可见 UX、shadow recovery 是否静默

如果只留一句话，就是这句：

**把 thread 绑到 session，把 session 短租到 process，把 process 放进 `project × bootstrap-profile` 的小池子里。**

[1]: https://agentclientprotocol.com/protocol/session-setup "https://agentclientprotocol.com/protocol/session-setup"
[2]: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md "https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md"
[3]: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/cli/src/acp/acpClient.ts "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/cli/src/acp/acpClient.ts"
[4]: https://agentclientprotocol.com/protocol/session-config-options "https://agentclientprotocol.com/protocol/session-config-options"
[5]: https://agentclientprotocol.com/get-started/architecture "https://agentclientprotocol.com/get-started/architecture"
[6]: https://agentclientprotocol.com/protocol/overview "https://agentclientprotocol.com/protocol/overview"
[7]: https://github.com/google-gemini/gemini-cli/issues/24017 "https://github.com/google-gemini/gemini-cli/issues/24017"

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
