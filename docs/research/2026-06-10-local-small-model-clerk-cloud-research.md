---
created: 2026-06-10
owner: codex
status: imported-cloud-research
doc_kind: research-report
topics: [local-small-model, memory-clerk, gemma-4, mlx-vlm, pi-agent, eval-harness]
related_features: [F102, F188, F200, F218, F227, F229]
related_docs:
  - docs/research/2026-06-07-local-small-model-memory-clerk-proposal.md
  - docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md
---

# Cat Cafe 本地小模型 Clerk 研究报告

## 核心判断

基于你给定的目标模型与约束，我的结论是：**把 Gemma 4 26B A4B IT 放在 `mlx_vlm.server` 之后，用你自己的可信 harness 作为真正的控制平面；把模型定位成“候选摘要器 / 候选路由器”，而不是“直接执行工具的代理”**。这样最符合你们的四个关键要求：Markdown 优先、短锚点句柄优先、禁止模型直接写状态、以及升级必须携带原始会话而不是模型二次摘要。Gemma 4 官方确实具备原生 function calling 与 system role 支持，而且 26B A4B 在 Google 展示页上的 τ2-bench retail（代理式工具使用）和 LiveCodeBench 表现都很强，说明它适合作为“读懂线程、给出候选动作”的本地 clerk；但当前 MLX / MLX-VLM 这条链上的 OpenAI 兼容工具调用仍有若干已知语义缺口和解析缺口，因此**最稳的设计不是把信任下沉到 `tool_calls`，而是把信任留在 harness**。citeturn18view1turn6view3turn6view4turn40view0turn20view0turn13view0turn13view3turn13view5

更具体地说，**F102 线程记忆摘要候选**应当走“Markdown 主体 + 你们自己的锚点/引用验证器”的路径；**F229 Concierge 意图路由 / 导航 / 只读工具选择**应当走“文本化工具意图候选 + harness 执行工具”的路径。原生 `tool_calls` 可以保留为实验性快路径，但只建议在极小的只读工具集上、并且仅通过 `/v1/chat/completions`、明确规避 `/v1/responses` 与 `tool_choice` 依赖的前提下使用。citeturn8view3turn13view3turn13view5turn30view0

## 当前栈的事实基线

Gemma 4 官方文档明确说明：Gemma 4 具备**原生 function calling**、**原生 system role**，并且工具使用训练依赖专门的控制 token；其中 `<|tool_response>` 还被当成额外的 stop sequence。Google 的 function calling 文档还说明，工具可以通过 JSON Schema 或原始 Python 函数定义传入 chat template。对你们来说，这意味着：Gemma 4 本身不是问题，**问题主要在本地 serving 层与 OpenAI 兼容适配层**。citeturn18view1turn6view3turn6view4

Gemma 4 26B A4B 官方定位本来就偏向“工作站上的本地第一代理与编码工作流”。Google DeepMind 页面给出的公开指标里，Gemma 4 26B A4B IT Thinking 在 τ2-bench retail 上是 85.5，在 LiveCodeBench v6 上是 77.1；这对你们的 F229 Concierge 场景尤其相关，因为那个场景本质上就是“零写入的零售/导航型代理判断”。citeturn40view0

Google 自己的 Gemma × MLX 集成页目前给出的路径也是直接走 `mlx_vlm.server`，暴露 OpenAI-compatible `/v1` 端点，而不是强调 `mlx_lm.server` 作为产品级服务入口。与此同时，`mlx-vlm` README 现在已经明确支持 `/v1/chat/completions`、`/v1/responses`、APC 自动前缀缓存，以及 OpenAI 兼容 `json_schema` structured outputs；最新发布的 `mlx-vlm` v0.6.2 还修了 Gemma 4 长文本 prefill、Gemma 4 某些加载问题、以及“thinking enabled 时 structured output”的 bug。citeturn20view0turn33search3turn8view2turn8view3turn37view0

但这一栈仍然存在多个与你们需求直接相关的已知问题。`mlx-lm` 一度无法把 Gemma 4 的原生工具调用解析回 OpenAI 兼容 `tool_calls` 字段，导致原始工具调用文本落回 `message.content`；此后发布说明陆续加入 Gemma 4 工具解析器、修复带连字符的函数名/字符串里花括号的解析，以及并行工具调用处理。与此同时，`mlx-lm.server` 仍明确提示“只实现了基础安全检查，不建议用于生产”，而且截至 2026-06-10，`mlx-lm` 0.31.3 上还有针对 sliding-window / RotatingKVCache 模型服务线程崩溃的公开 issue。citeturn13view0turn16view0turn15view0turn13view1turn13view2turn17search3

`mlx-vlm` 侧的风险更贴近你们的代理工作流：公开 issue 记录显示，OpenAI-compatible server **接受但不真正执行 `tool_choice` 约束**；`/v1/responses` 在函数调用场景里**会吞掉 `tools`**；Gemma 4 的某个 chat template 版本在“前一个消息是 `tool_response`、紧接着 assistant `tool_calls` 且 `content` 为空”时，还会把 assistant turn 留在未闭合状态，从而诱发**确定性的无限工具调用循环**。因此，如果你们把 core control plane 直接建立在原生 `tool_calls` 之上，就会同时暴露在“解析失真”“策略字段无效”“多轮 replay 触发死循环”三类故障里。citeturn13view3turn13view4turn13view5

## 方案对比

下表是我对四条可行路线的结论性比较。它不是在问“哪个最先进”，而是在问“哪个最适合你们这个 clerk 形态”。

| 路线 | 适合 F102 摘要 | 适合 F229 只读路由 | 主要优点 | 主要风险 | 结论 |
|---|---|---|---|---|---|
| **原生 OpenAI-compatible `tool_calls`** | 一般 | 可用，但不宜做唯一控制面 | 能直接接 OpenAI SDK；Gemma 4 原生支持工具调用；`mlx-vlm` 已支持 chat completions 与 JSON Schema。citeturn6view3turn20view0turn8view3 | `mlx-lm`/`mlx-vlm` 历史上有 Gemma 4 解析缺失；`tool_choice` 不可靠；`/v1/responses` 现有工具缺口；多轮 replay 有已知死循环案例。citeturn13view0turn13view3turn13view4turn13view5 | **只适合实验性快路径，不适合当唯一真相源** |
| **文本化 / Markdown 工具意图候选 + 自定义验证器** | **非常适合** | **非常适合** | 与“MD-first”“短句柄”“禁止写状态”天然同向；绕过 MLX parser 细节；最容易做 quote/anchor 验证与 forbidden-field 拦截。支持证据锚点优于原生 `tool_calls`。这一判断由 Gemma 4 的原生能力、以及当前 MLX 适配层问题共同支持。citeturn6view4turn13view0turn13view3turn13view5 | 你们需要自己写 parser/validator 和回放逻辑。 | **建议作为默认控制面** |
| **Pi 作为 agent carrier** | 适合，但需强约束 | 适合，但需强约束 | 支持自定义 OpenAI-compatible provider、动态注册工具、运行时切换 active tools、事件拦截、RPC/JSON 模式、会话压缩和扩展持久化。citeturn6view2turn11view0turn11view4turn11view5turn32view0turn31view2 | Pi 没有内建 sandbox；默认工具包含 write/edit/bash；`tool_call` 事件里修改输入后**不会再次校验**；项目与扩展按本机权限运行。citeturn12view0turn11view1turn32view1 | **可用，但必须锁成 read-only 受限壳** |
| **替代 carrier** | 取决于选择 | 取决于选择 | PydanticAI 强在 typed validation / retry / tool filtering；LangGraph 强在 interrupt、持久化、人工审核与失败恢复；LM Studio 强在本地 OpenAI/Anthropic 兼容与认证开关。citeturn25view0turn26search0turn26search2turn26search4turn26search14turn30view0turn30view1turn30view3 | 复杂度与运行形态不同；LiteRT-LM 目前只支持 Gemma 4 E2B/E4B，不支持你们目标 26B；OpenHands/Agent Canvas 偏重更大的 coding agent。citeturn20view3turn20view1turn27view0turn27view2 | **若不用 Pi，我更推荐 PydanticAI 或 LangGraph** |

从你们的约束出发，我最推荐的排序是：**自研 trusted harness + `mlx_vlm.server`** 为主；**Pi** 仅在你们已经需要一个现成 agent shell / TUI / RPC 外壳时才加上；**PydanticAI** 是最值得认真考虑的“更轻、更 typed”的替代 carrier；**LangGraph** 适合未来如果你们要把 clerk 变成有审核节点、可回放、可中断恢复的正式工作流引擎。citeturn20view0turn25view0turn26search0turn26search2turn26search14

## 推荐架构

### 推荐的运行形态

我建议把 `Gemma 4 26B A4B IT` 跑在 **`mlx_vlm.server`** 后面，而不是直接把 Pi 或其他 carrier 接到 `mlx_lm.server`。原因有三点：第一，Google 自己的 Gemma × MLX 集成文档就是把 Gemma 4 接到 `mlx_vlm.server` 的 OpenAI-compatible 端点上；第二，`mlx-vlm` 已经把 structured outputs、APC prefix caching、metrics、多模态与 Gemma 4 新修复集中到了一个服务面上；第三，你们以后即使只做文本 clerk，也大概率会希望保留升级到图像/截图/卡片读取的路线。citeturn20view0turn8view2turn8view3turn37view0

服务协议层面，我建议**只用 `/v1/chat/completions` 处理工具相关工作流**，不要让任何真实工具工作流依赖 `mlx-vlm` 的 `/v1/responses`；同时，不要把 `tool_choice="required"` 或 `"none"` 当成 provider 级可靠约束，而是由 harness 自己决定“这一轮是否必须经工具”“这一轮是否强制无工具”。这是因为当前公开 issue 已经明确记录：`tool_choice` 在 `mlx-vlm` 上会被接受但不被执行，而 `/v1/responses` 会吞掉工具定义。citeturn13view3turn13view5

`mlx-vlm` 的 APC 自动前缀缓存值得启用，尤其适合 F102 这类“同一线程长前缀反复摘要 / 局部增量摘要”的场景。官方 README 里已经给出了 APC 的 tenant 隔离方式和 cache stats/reset 端点，因此你们可以按“用户 / workspace / thread family”分 tenant，以减少长线程重复 prefill 的成本。citeturn8view2

### F102 线程记忆摘要候选

F102 的目标不是“让模型写内存”，而是“让模型产出一个**待验证的记忆候选**”。因此这里最好的接口不是 `tool_calls`，而是**Markdown 主体 + 机器可解析的小控制尾部**。我推荐的设计是：模型先输出对人可读的 Markdown 摘要，然后在文末给出一个很小的 fenced block 或 YAML 风格尾部，只允许出现你们提供的短句柄、引用区间和摘要标签，不允许出现真实 message ID、Redis key、memory slot、truth source 名称或任何写入指令。这个设计不是因为 JSON schema 没价值，而是因为你们明确要求 MD-first；同时，当前 MLX 工具与 structured-output 路径都有过 parser / thinking / loop 类问题，把“人读内容”和“控制字段”合并进一段重 JSON 的回答会增加失败面。citeturn8view3turn37view0turn13view0turn13view4

这一阶段模型应当只做四件事：归纳、引用、标注不确定性、产出“是否值得入候选记忆”的建议。**真正的 memory write 必须在 harness 中完成**。如果你们未来想在 carrier 内保存一些辅助状态，Pi 的 `appendEntry()` 很有用，因为它保存的扩展状态**不参与 LLM 上下文**；但这也正说明，状态写入应该由扩展 / harness 掌控，而不是暴露成给模型随便调用的能力。citeturn31view2

一个适合 F102 的输出面可以长成这样：

```markdown
## 线程记忆候选

这段对话里，用户稳定表达了两个偏好：
- 喜欢简洁但不要失去可读性。
- 对“升级处理”更希望保留原始上下文，而不是二次转述。

关键证据：
- [a17] “……”
- [a24] “……”

结论：
建议生成记忆候选，但置信度为中等。

```catcafe_meta
kind: digest_candidate
anchors: [a17, a24]
candidate: yes
confidence: medium
notes: 仅基于本线程，不写入任何真实状态
```
```

这里真正重要的不是格式长什么样，而是**validator 只接受句柄，不接受长 ID；只接受可回查引用，不接受自由编造的证据**。Gemma 4 的 function-calling 训练能帮助它理解“该输出什么结构”，但最后是否采纳，必须由你们自己的 validator 决定。citeturn6view3turn6view4turn13view0

### F229 Cat Ball Concierge 路由与只读工具选择

F229 更接近“受约束的代理决策”。这里我建议使用**文本化的路由候选**而不是直接让模型把工具打出去。模型只输出：意图类别、建议工具名、参数草案、证据句柄、置信度、是否升级。harness 负责把它翻译成真正的 read-only 工具调用，并在拿到结果后决定是否给模型一次二次总结。这样可以完整满足你们的“模型不能写真相源 / 不能写 Redis / 不能写 routing state / 不能执行不可逆动作”约束。已知的 `tool_choice` 与 `/responses` 问题，也正好因此被绕开。citeturn13view3turn13view5

建议把 F229 的模型输出面压缩成很小的 grammar，例如：

```markdown
## Routing candidate
intent: navigate_thread
action: read_only_tool
tool: thread.read
args:
  handle: a31
why:
  - a31
confidence: high
escalate: no
```

如果 validator 通过，就由 harness 去执行 `thread.read`；如果 validator 不通过，直接判为“不执行工具、降级为说明型回答或升级”。这样做的好处是：**模型从来没有执行权限，只有建议权**。而 Gemma 4 在 retail/tool-use 方向的能力，与这种“先理解意图、再选只读动作”的 clerk 角色是相匹配的。citeturn40view0

## 失败模式与缓解

最重要的失败模式不是“模型答错一点”，而是**控制面失真**。当前公开资料里，至少有以下几类：Gemma 4 工具调用文本没被 parser 回填到 `tool_calls`；`tool_choice` 表面接受、实际不生效；`/v1/responses` 工具定义被静默丢弃；某些 Gemini/Gemma 风格 chat template 在回放带空 `content` 的 assistant tool-call 消息时会卡进无限工具循环；以及 `mlx-lm.server` 在线程化服务路径上对 sliding-window / RotatingKVCache 模型的崩溃。针对这些问题，你们最有效的统一缓解手段不是“继续堆 prompt”，而是**把 provider 当成不完全可信的 parser / transport**：所有工具执行都要经过 harness 二次确认，所有升级都要走原始会话透传，所有可写状态都不对模型暴露。citeturn13view0turn13view2turn13view3turn13view4turn13view5

还有一类失败模式是**长上下文与 stop-token 相关的不稳定**。`mlx-vlm` 自己的诊断报告就把“长上下文退化、重复输出、stop-token 行为异常、chat-template / generation kwargs wiring 问题”归到了 harness / integration issue，而不是单纯归咎于模型本身。这说明你们做 F102 时，不能把“完整超长线程原封不动塞给模型”当成默认路径；更稳的做法是“窗口化 + APC 前缀缓存 + 已验证摘要的层级压缩”。citeturn41view0turn8view2

Pi 作为 carrier 还有两类很现实的风险。第一，它默认给模型的内建工具包含 `read`、`write`、`edit`、`bash`，并且官方明确说明它**没有内建 sandbox**；第二，`tool_call` 事件虽然允许你拦截或篡改输入，但**修改后不会自动重新校验**。这意味着：如果你们采用 Pi，真正的防线应该是“根本不启用写工具 + 只注册 read-only custom tools + 在工具实现层做最终校验”，而不是“先把危险工具给模型，再期待事件钩子都能拦住”。citeturn12view0turn11view1turn32view1

结合这些风险，我建议把回归测试集固定成下面几种用例：带空 assistant content 的多轮 tool replay、带连字符的 tool name、参数字符串里含花括号、需要 `required` tool 才能回答的问题、明确要求“不准用工具”的问题、长线程增量摘要、句柄泄漏测试、长 ID 复制测试、升级路径是否带原文而非摘要。`mlx-lm` 和 `mlx-vlm` 近期发布说明里已经多次出现 Gemma 4 parser、parallel tool calling、structured output with thinking、Gemma4 prefill / load 的修复条目，这本身就说明**你们必须 pin 版本并自带回归套件，不能靠“最新版通常更好”**。citeturn16view0turn37view0

## 职责边界

### 应该交给 Gemma 4 的部分

Gemma 4 最适合承担的是：**候选摘要生成、候选意图判断、只读导航建议、证据句柄引用、升级建议**。Gemma 4 的 function-calling 训练、system role 支持、以及在 agentic retail / coding 指标上的表现，说明它非常适合做“能理解工作流约束的 clerk 大脑”。但这个“大脑”最适合输出的是**候选**，而不是最终执行。citeturn18view1turn40view0

在推理预算上，我会把控制面任务默认设为**thinking 关闭或极低**。`mlx-vlm` 文档写得很清楚：thinking 是额外的 server 行为开关，请求也可以覆盖默认值；而最新发布又专门修了“thinking enabled 时 structured output”的问题。对你们这种要做可验证控制面的场景，低复杂度、低花样、低温度通常比“多想一点”更重要。citeturn9view3turn37view0

### 必须留在 trusted harness 的部分

以下能力应该**完全不交给模型**：真实 ID 映射、quote/anchor 校验、truth source / Redis / memory / routing state 写入、工具白名单与参数最终校验、升级工单构造、以及任何不可逆动作。这个边界的根据，一半来自你们自己的安全要求，一半来自现有本地 serving 层与 carrier 层的已知风险：MLX parser 有过歧义与静默失配；Pi 没有 sandbox，且扩展/工具按进程权限运行。citeturn13view0turn13view3turn13view5turn11view1

如果你们采用 Pi，把它当作**外壳**而不是**信任根**更合理。Pi 的优点是：可自定义 provider，能用 `openai-completions` 适配本地 OpenAI-compatible 服务；能 `setActiveTools()` 动态切换成纯只读工具集；能用扩展做自定义 compaction、持久化和 RPC/JSON 嵌入。对接 `mlx_vlm.server` 时，provider 侧宜明确走 `api: "openai-completions"`，并按本地服务习惯设置 `maxTokensField: "max_tokens"` 一类兼容参数；同时建议关闭 developer role 映射，避免给本地兼容层增加无谓差异。Pi 文档明确支持这些 provider compat 选项。citeturn6view2turn11view3turn32view0

### 值得考虑的替代 carrier

如果你们最后发现 Pi 对这个 clerk 来说还是偏重，我最看好的替代是 **PydanticAI**。原因很直接：它原生提供 per-run capability、`prepare_tools` / `prepare_output_tools`、tool validation error hook、output validation error hook、以及 run/node/model 级包裹与恢复逻辑。这些能力与你们“候选输出 + trusted validator”的模式高度同构，尤其适合 Python 主控的 Cat Cafe 服务端。citeturn25view0

如果你们进一步希望要“可中断、可人工审核、可恢复、可回放”的正式工作流，**LangGraph** 会更合适。它官方把 human-in-the-loop interrupt、持久化 checkpointer、time travel、per-node retries/timeouts/error handling 都做成了第一等能力。这正好对应你们未来可能想做的“升级前人工确认”“工具执行前审批”“错误后重新路由”。citeturn26search0turn26search2turn26search7turn26search14

至于其他路线，我的判断是：**LM Studio** 可以作为更省运维的本地 OpenAI-compatible server 替代，因为它官方同时支持 OpenAI/Anthropic 兼容端点、tool use、structured output、认证及 MCP 开关；但它本身也有 parser/工具调用相关 bug tracker 记录，所以即使换成 LM Studio，也不改变“用 trusted harness 做最终验证”的总原则。**LiteRT-LM** 值得关注，但截至官方文档当前状态，它对 Gemma 4 只支持 E2B / E4B，大模型支持“coming soon”，因此不适合作为你们当前 26B A4B 的现实替代。**OpenHands / Agent Canvas** 则更偏完整 coding agent 平台；其官方文档也明确提示本地 LLM 功能可能受限，而且整体形态明显比你们的 clerk 更重。citeturn30view0turn30view1turn30view3turn20view3turn20view1turn27view0turn27view2

## 最终建议

如果今天就要落地，我会这样定案：**`mlx_vlm.server` + 你们自研 trusted harness** 作为主架构；**默认不用原生 `tool_calls` 作为真相源**；**F102 用 Markdown 摘要候选**；**F229 用文本化路由候选**；**所有真实工具执行、状态写入、升级透传都放在 harness**。Pi 可以作为 carrier，但只在你们确实需要它的 agent shell、扩展系统或 RPC 模式时采用，并且必须在启动时就把 active tools 收窄为只读，并将写工具与不可逆动作彻底从模型视野中移除。citeturn20view0turn6view2turn32view0turn11view1

如果要给一句最短的实施原则，那就是：**让 Gemma 4 负责“判断与起草”，让 harness 负责“验证与执行”**。在你们这个 Cat Cafe clerk 场景里，这不是保守，而是当前本地 Gemma 4 + MLX 生态下最符合事实、也最不容易踩坑的工程解。citeturn13view0turn13view3turn13view5turn25view0turn26search0turn26search14
