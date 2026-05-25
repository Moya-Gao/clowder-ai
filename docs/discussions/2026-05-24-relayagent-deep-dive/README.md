# RelayAgent Deep Dive — ReactMethod 特性拆解

> 日期：2026-05-24
> 源项目：https://github.com/huxixx/RelayAgent
> 本地路径：/Users/lysander/projects/ref/RelayAgent
> Commit：d16604e (HEAD)
> 拆解猫：宪宪/Opus-46

## 铲屎官朋友原始 Claims

1. "react method"：输入输出是 schema，函数体是提示词，回调函数=工具注册
2. 执行时拉 ReAct+LLM，对外层看就是个挂了回调函数的普通函数
3. 用 react method 重写了压缩、记忆沉淀、recall 等非核心功能
4. 模型越强，外周功能就越强，甚至不用二次开发
5. 用来做 harness 非常简单

---

## 项目概况

| 维度 | 数据 |
|------|------|
| 语言 | Python 3.12-3.13 + Vue 3 前端 |
| 总 Python 源文件 | ~905 |
| 测试文件 | ~124 |
| Commits | 179（全在 2026 年） |
| 贡献者 | 主要 1 人（huxixx），bot 提交占多数 |
| 架构 | 单体 FastAPI + WebSocket + Vue 3 SPA |
| Agent 拓扑 | delegate / roleplay / groupchat / guarded / feishu_harness |
| 核心能力 | Skills 分层加载、Plugin 平台、MCP 工具接入、本地记忆 |

---

## Claims Ledger（逐条验证）

### Claim 1: "输入输出是 schema，函数体是提示词，回调函数=工具注册"

**Verdict: ✅ 代码证据完整**

```
ReactMethodDefinition(
    method_id: str,          # 唯一标识
    prompt_body: str,        # 函数体 = 提示词
    input_model: type,       # 输入 schema（dataclass / pydantic）
    output_model: type,      # 输出 schema
    callback_tool_names: tuple[str, ...],  # 回调 = 工具注册
    max_iters: int = 4,      # ReAct 循环次数上限
)
```

**代码路径**：`src/relay/domain/react_method/models.py:14-27`

这就是核心抽象——一个 `ReactMethodDefinition` 就是一个"函数签名"：
- `input_model` / `output_model` = 类型化的输入输出 schema
- `prompt_body` = 自然语言的"函数体"
- `callback_tool_names` = 这个函数能调用哪些工具（必须显式注册绑定）

### Claim 2: "执行时拉 ReAct+LLM，对外看就是普通函数"

**Verdict: ✅ 实现闭环**

**调用链路**：
```
caller code
  → ReactMethodRuntime.invoke(method_id, typed_request)
      → registry.get(method_id)          # 查定义
      → to_payload(request)              # dataclass → dict
      → hash_input → 幂等检查
      → _create_invocation()             # 持久化 ledger 行
      → _run_invocation()
          → _resolve_callbacks()         # 绑定回调函数
          → AgentInvocationRequest(executor=lambda: _execute_with_callbacks(...))
          → runner.run(request)          # 走 agent invocation 基础设施
              → LLMReactMethodExecutor.execute()
                  → 构造 initial prompt（方法正文+回调注册表+输入）
                  → for turn in range(max_iters):
                      → _call_llm(messages)         # LLM 决策
                      → validate_action(action)
                      → if compile: break           # 终止
                      → if callback: execute_callback → 追加观察
                  → compile → typed output
      → _to_output(definition, payload)  # dict → typed result
      → return typed_result              # 调用者看到的就是个正常返回值
```

**代码路径**：`src/relay/domain/react_method/runtime.py:134-219`（Runtime）、`460-711`（LLM Executor）

对外层确实看到的就是 `await runtime.invoke("method_id", typed_request) -> TypedResult`，和普通异步函数调用一样。

**关键工程细节**：
- 幂等控制：input hash + method_call_id 确保同样输入不重复执行
- 状态持久化：每次调用创建 `ReactMethodInvocation` ledger 行（created → running → completed/failed）
- 回调沙箱：LLM 只能调用 `callback_tool_names` 里声明的工具，调用未注册工具直接报 `MethodCallbackBindingError`
- 双 executor 策略：`LLMReactMethodExecutor`（真 LLM ReAct 循环）和 `BoundedCallbackReactMethodExecutor`（硬编码回调顺序的 fallback）

### Claim 3: "用 react method 重写了压缩、记忆沉淀、recall"

**Verdict: ⚠️ 部分成立——recall 和 topic generation 已重写，压缩还没有**

目前已注册的 3 个 ReactMethod：

| method_id | 用途 | 代码 |
|-----------|------|------|
| `memory.startup_recall.v1` | 启动记忆回忆 | `config/react_methods/memory_startup_recall.py` |
| `session.topic_generation.v1` | 自动生成会话标题 | `config/react_methods/session_topic_generation.py` |
| `feishu.tick_decision.v1` | 飞书群消息 tick 决策 | `config/react_methods/feishu_tick_decision.py` |

**压缩（compression）**：`config/compression/COMPRESSION_PROMPT.md` 仍是传统 prompt template 模式，**没有**用 ReactMethod 重写。compression 目录下无 ReactMethod 引用。

**记忆沉淀**：`startup_recall` 用了 ReactMethod，但"沉淀"（write/persist）部分只有一个 `memory.write_candidate` 回调在注册表里，实际记忆写入仍走传统 `LocalMemoryKernel`。ReactMethod 只负责**读取**和**选择**记忆注入 prompt。

### Claim 4: "模型越强，外周功能越强，甚至不用二次开发"

**Verdict: ⚠️ 理论成立，但有重要 caveat**

这个 claim 的核心逻辑是对的：因为函数体是 prompt，所以 LLM 越强，在 ReAct 循环里做的决策越好（比如该搜哪些记忆、该选哪些结果）。但实际上：

1. **回调工具的实现是硬编码的**——`MemoryStartupRecallCallbackBinding` 里 `search`/`walk`/`explore`/`grep`/`recent` 等工具的实现完全是传统 Python 代码，LLM 强不会让这些工具返回更好的结果
2. **输出 schema 解析是硬编码的**——`_to_output()` 里对 `StartupRecallResult`、`TopicGenerationResult` 有大量手工字段映射（runtime.py:373-444），LLM 输出格式稍有偏差就报 `MethodOutputValidationError`
3. **还有一个 fallback executor**——`BoundedCallbackReactMethodExecutor` 完全不走 LLM，是硬编码的 search→walk→build_prompt_block 三步流水线（runtime.py:911-1072）

所以更准确的说法是：**在回调工具本身质量不变的前提下，强 LLM 能更好地编排多个工具的调用顺序和参数**。

### Claim 5: "用来做 harness 非常简单"

**Verdict: ⚠️ 定义一个 ReactMethod 确实简单，但 Runtime 不简单**

定义端确实极简——44 行就定义了 `memory_startup_recall`（包括 prompt、schema、callback 列表）。

但 runtime 层的复杂度不可忽视：
- `runtime.py` = 1253 行，包含幂等控制、状态持久化、两个 executor、大量特化解析逻辑
- `react_method_callbacks.py` = 401 行，每个回调工具的绑定和适配
- 回调注册必须人工绑定到 `agent_factory.py`
- 输出解析对不同 output_model 有特化路径（不是通用的）

---

## 架构地图

```
RelayAgent/
├── src/relay/
│   ├── apps/relay_application.py     # 主应用组装（mode 选择、agent 构建）
│   ├── domain/
│   │   ├── react_method/             # 🌟 核心：ReactMethod 运行时
│   │   │   ├── models.py             # ReactMethodDefinition + Invocation
│   │   │   ├── registry.py           # 定义注册表（process-local dict）
│   │   │   ├── runtime.py            # Runtime + 2 个 Executor + 幂等 + 状态
│   │   │   ├── errors.py             # 6 种显式错误类型
│   │   │   └── feishu_tick_decision.py  # 飞书 tick 的 domain contracts
│   │   ├── agent/                    # Agent 生命周期、工厂、invocation
│   │   ├── memory/                   # 本地记忆内核 + ReactMethod 回调绑定
│   │   └── session/                  # 会话管理、topic generation
│   ├── config/
│   │   └── react_methods/            # 🌟 ReactMethod 定义（prompt_body + schema）
│   ├── infrastructure/               # LLM provider、ripgrep、存储
│   └── web/                          # FastAPI + Vue 3 前端
├── config/
│   ├── compression/                  # 压缩 prompt（传统模板，非 ReactMethod）
│   ├── plugins/                      # memory、auto_approve 等插件
│   └── skills/                       # 技能包（md2word、pptx-craft 等）
├── tests/                            # 124 个测试文件（含 5 个 ReactMethod 相关）
└── sdk/python/                       # Python SDK
```

---

## 算法剥皮表

| 被宣传的能力 | 实际机制 | 分类 |
|-------------|---------|------|
| ReactMethod ReAct 循环 | LLM chat loop + JSON action parsing | LLM judge + 规则 |
| 记忆选择 | LLM 在 callback 观察中选 memory_id | LLM judge |
| 记忆检索 | SQLite BM25 + 传统向量搜索 | 真算法 |
| 幂等控制 | SHA256 input hash + call_id | 真算法 |
| 回调安全 | allowlist 比对 + binding 检查 | 规则 |
| 输出验证 | JSON parse + dataclass 字段映射 | 规则 |
| 压缩 | LLM prompt template（非 ReactMethod） | LLM judge |

---

## 和 Cat Cafe 对比

### Learn（值得学的）

1. **定义端极简**：44 行定义一个完整的"内部微服务方法"，对比我们的 Skill 体系确实更轻量。ReactMethodDefinition 的 5 个字段（method_id, prompt_body, input_model, output_model, callback_tool_names）是一个很精练的抽象。

2. **回调沙箱**：显式声明 callback_tool_names + 运行时 binding 检查，LLM 不能越权调用未注册的工具。这个安全边界设计干净。

3. **幂等 + 状态 ledger**：每次 invocation 有持久化的 ledger 行，支持 cached/resumed/rerun 状态，可以做断点续执行。

### Gap（我们缺的，但不一定要补）

- 我们没有"prompt 作为函数体"的编程模型——我们的 Skill 是结构化的 Markdown 指令集，不是 callable function。但 Skill 的优势是人可读、可 review、可 diff，这是个有意识的 tradeoff。

### Do Not Follow（不跟的，有哲学理由）

1. **LLM judge 做记忆选择**：ReactMethod 让 LLM 在 ReAct 循环里决定选哪些记忆注入 prompt。我们的记忆系统（cat_cafe_search_evidence / graph_resolve）走的是消费加权排序（F200），不依赖额外 LLM 调用。**理由**：每次 startup 多拉一个 LLM 调用 = 延迟 + 成本 + 不确定性。

2. **隐式 fallback 策略**：`BoundedCallbackReactMethodExecutor` 是一个完全硬编码的降级路径，和 LLM executor 走完全不同的逻辑但返回同样的类型。这在我们的哲学里是"缅因猫 fallback 层数检测"的典型触发器——同一个 output 从两条完全不同的路径产出，长期维护是定时炸弹。

3. **输出解析特化**：`_to_output()` 里对 `StartupRecallResult` 和 `TopicGenerationResult` 有 ~70 行的手工字段映射，不是通用反序列化。每新增一个 ReactMethod 都要写对应的解析器，和"不用二次开发"的 claim 矛盾。

---

## 核心洞察

ReactMethod 的**设计理念**确实 nice——"把提示词当函数体、schema 当签名、回调当工具"是一个优雅的抽象。但实际工程落地距离"简单"还有差距：

1. **runtime.py 1253 行**——一个"简单"的函数调用框架不应该有这么多行。核心原因是两个 executor + startup_recall 的特化路径 + 大量 trace/sanitize 逻辑。
2. **3 个 ReactMethod，179 个 commit**——产出密度不高，说明仍在快速迭代摸索阶段。
3. **压缩还没重写**——claim 3 里"大部分非核心功能都用 ReactMethod 重写了"，但目前只有 3 个方法，compression 仍是传统 prompt。

核心价值在于**抽象层面的思考**——把"外周功能"从硬编码提升到"prompt 可编程 + schema 约束 + 工具沙箱"，这个方向是对的。但当前实现还在概念验证阶段，距离"通用框架"有工程距离。

---

## 对 Cat Cafe 的启发

ReactMethod 最值得我们思考的不是具体实现，而是它提出的问题：

> **外周功能（压缩、记忆选择、话题生成）应该是"代码"还是"提示词"？**

我们的回答一直是"代码"（memory-routing-partial、consumption-weighted ranking、session hook injection）。ReactMethod 的回答是"提示词+工具沙箱"。

两种路径的 tradeoff：
- **代码路径**：确定性高、延迟低、可测试、不依赖模型能力。但迭代需要写代码+发版。
- **Prompt 路径**：灵活、模型越强越好、改提示词不用发版。但延迟高、不确定性大、debug 困难。

我们目前的哲学更倾向代码路径（P3 方向正确 > 执行速度 + P5 可验证才算完成），但值得关注 ReactMethod 这个方向在模型能力持续提升后是否会成为更优解。
