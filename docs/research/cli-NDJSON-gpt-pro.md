---
feature_ids: [F045]
topics: [ndjson, cli, codex, claude, observability, transform]
doc_kind: research
created: 2026-02-27
---

# CLI NDJSON 事件流协议深度调研（GPT Pro Deep Research）

> **来源**：铲屎官用 GPT Pro Deep Research 生成，2026-02-27 搬入仓库
> **前置研究**：`docs/archive/2026-02/research/cli-ndjson-treasure-map.md`
> **置信度说明**：本文引用了官方文档、Agent SDK 类型定义、以及第三方 cheatsheet（takopi.dev，非官方）。各结论的证据等级在行文中以 **(Observed)** / **(Inferred)** 标注。部分事件类型尚未在我们的实际抓包中验证，落地前需实测确认。

把 **Codex CLI（`codex exec --json`）** 和 **Claude Code CLI（`claude -p --output-format stream-json`）** 的”事件流协议”又扒了一遍，结论是：我们那份《三猫 NDJSON 宝藏地图》已经很强了，但 **确实还有几块更肥的矿脉**，而且”能不能区分 thinking vs 输出”两家都能做得很干净。下面按猫补全”宝藏清单 + 识别规则 + UI/transform 落点”。

---

## 1) 缅因猫 Codex CLI：除了 reasoning / agent_message，还有 4 个“隐藏大件”

我们文档里主要覆盖了 `reasoning / agent_message / command_execution / file_change / turn.completed / turn.failed / error`。但 OpenAI 官方文档和一份很实用的 `exec --json` cheatsheet 都明确写了：**item 类型不止这些**，尤其是下面 4 个我们现在 transform 很可能还在 `return null` 的宝藏。 ([OpenAI开发者中心][1])

### 1.1 `mcp_tool_call`：MCP 工具调用全量结构（可做“工具面板 + 结构化结果”）

`item.type = "mcp_tool_call"` 会在 started/completed 都出现，字段非常丰富：

* `server` / `tool` / `arguments`
* `result.content[]`：MCP content blocks（text/image/audio/resource_link/resource）
* `result.structured_content`：**可直接给前端/后续流水线用的 JSON**
* `error.message` + `status`（in_progress/completed/failed） ([takopi][2])

**落点建议**：

* 前端可以做一个折叠块：

  * 标题：`MCP: {server}/{tool}`
  * 子区：arguments（格式化 JSON）、structured_content（如果有）、content 渲染（尤其 resource_link 很适合做可点击引用）
* transform 里别只当成 tool_use/tool_result；它其实比 shell command 更“语义化”。

### 1.2 `web_search`：Codex 自带 web search 事件（你可以像 Claude 的 web_search_requests 一样计数/展示）

当 Codex 使用 web 搜索，会出现：
`{"type":"item.completed","item":{"type":"web_search","query":"..."}}` ([takopi][2])

**落点建议**：

* 这玩意儿是“可观测性黄金指标”：你可以在 UI 里明确标出“本回合用了几次 web search、搜了什么 query”。
* 还能做安全审计：把 web 搜索的 query 打点记录（当然注意脱敏策略）。

### 1.3 `todo_list`：计划/待办流（started/updated/completed 都会来）

这就是我们想要的”计划进度条事件”。它会发：

* `item.started(todo_list)` 初始清单
* `item.updated(todo_list)` 勾选进度
* `item.completed(todo_list)` 全完成 ([takopi][2])

**落点建议**：

* 直接把它喂给前端做一个“Plan ✅/⬜️ checklist”组件，比我们自己从自然语言里抽计划稳得多。

### 1.4 `item.completed(error)`：非致命 warning（比如输出被截断）

除了顶层 `type="error"`（断流/重连等），还有一种 **item 级别的 warning**：
`{"type":"item.completed","item":{"type":"error","message":"command output truncated"}}` ([takopi][2])

**落点建议**：

* UI 上当“⚠️ 本次命令输出被截断（64KiB）”这种小黄条提示即可。
* 这比我们靠 `aggregated_output` 末尾 `...(truncated)` 更可靠（两层都能用）。 ([takopi][2])

---

## 2) Codex：thinking vs 输出怎么区分？（可以做到 0 歧义）

### 2.1 规则很简单

* **thinking / reasoning**：`type="item.completed" && item.type="reasoning"`
* **最终对用户可见输出**：`type="item.completed" && item.type="agent_message"` ([takopi][2])

我们现在统计到 reasoning 很多，这个方向完全对，而且“区分 thinking vs 输出”在 Codex 侧是**硬分流**，无需 NLP。

### 2.2 一个我们文档里没强调但很关键的坑

`reasoning` **可能是“可选发射”**：cheatsheet 里写了“only item.completed, **if enabled**”。也就是说，不要把“没有 reasoning”当异常。 ([takopi][2])

---

## 3) 布偶猫 Claude Code CLI：我们以为只有几种事件，其实系统消息类型多到能做“观测仪表盘”

我们目前覆盖：`system/init`、`assistant`、`result/success`、`result/error`、部分 `stream_event`、以及一个笼统的 `system/hook`。
但 Anthropic 的 Agent SDK 类型定义里，把 **stream-json 的每条 JSON** 都定义得非常细：`result` 甚至有多种错误 subtype，`system` 也不止 init。 ([platform.claude.com][3])

### 3.1 `result` 的 subtype 远不止 success / error

除了 `subtype:"success"`，还会有这些“可直接做错误归因”的 subtype：

* `error_max_turns`（用 `--max-turns` 撞限时）
* `error_max_budget_usd`（`--max-budget-usd` 撞限）
* `error_during_execution`（执行期错误）
* `error_max_structured_output_retries`（结构化输出重试耗尽） ([platform.claude.com][3])

**落点建议**：

* transform 里把 subtype 映射成我们的错误分类枚举（BudgetExceeded / MaxTurns / ExecError / SchemaRetryExhausted），这对稳定性看板很有用。

### 3.2 `structured_output`：我们没列，但这是“自动化流水线”的核弹级字段

当用 `--output-format json` + `--json-schema`，最终 `result` 里会带 `structured_output`。 ([Claude][4])

**落点建议**：

* Cat Café 如果要做“无头模式的可编排任务”，这字段比解析纯文本强太多。建议至少透传到 metadata。

### 3.3 `system` subtype：不止 init/hook，还有 compaction、任务、状态、限流……

Agent SDK 里列了很多我们可能现在全丢弃的系统消息类型（只列最有用的）：

* `system/compact_boundary`：告诉你发生了压缩边界 + `pre_tokens`（压缩前 token） ([platform.claude.com][3])
* `system/status`：比如正在 compacting ([platform.claude.com][3])
* `system/task_started` / `system/task_progress` / `system/task_notification`：后台任务进度、完成摘要、以及一个 usage 小统计（total_tokens/tool_uses/duration_ms） ([platform.claude.com][3])
* `tool_progress`：工具执行中的周期性进度（elapsed_time_seconds 等） ([platform.claude.com][3])
* `rate_limit_event`：限流状态 + resetsAt/utilization（能做“被限流导致慢/失败”的归因） ([platform.claude.com][3])
* `system/hook_started|hook_progress|hook_response`：比我们现在笼统的 `system/hook` 更细，包含 stdout/stderr/exit_code/outcome ([platform.claude.com][3])
* `system/files_persisted`：checkpoint 落盘事件（文件列表、失败原因） ([platform.claude.com][3])

**落点建议**：

* 这些就是“深度可观测性 Plan”想要的天然燃料：你甚至不用自己发明 metrics 事件。

---

## 4) Claude：thinking vs 输出能不能区分？能，而且规则更硬核（靠 content block 类型）

我们文档里写“thinking 不在 NDJSON”，这个更像是“当时没有启用 extended thinking/那次模型没吐 thinking block”。
**协议层面**，Anthropic 的 streaming event 明确支持 thinking block，而且和 text 完全不同类型。 ([platform.claude.com][5])

### 4.1 stream-json 里的 `stream_event` 其实是“原始 SSE 事件”的封装

事件流标准顺序是：
`message_start → content_block_start → content_block_delta* → content_block_stop → message_delta* → message_stop`，期间还可能插 `ping`、`error`。 ([platform.claude.com][5])

### 4.2 区分规则（最关键的几行）

看 `.event` 内部：

* **输出文本（给用户看的）**：

  * `content_block_start.content_block.type == "text"`
  * `content_block_delta.delta.type == "text_delta"`，文本在 `delta.text` ([platform.claude.com][5])

* **thinking（可折叠、可隐藏）**：

  * `content_block_start.content_block.type == "thinking"`
  * `content_block_delta.delta.type == "thinking_delta"`，内容在 `delta.thinking`
  * 并且结束前会来一个 `signature_delta`（完整性校验） ([platform.claude.com][5])

* **工具调用参数流（JSON 增量）**：

  * `content_block_start.content_block.type == "tool_use"`
  * `content_block_delta.delta.type == "input_json_delta"`，片段在 `delta.partial_json`
  * 收到 `content_block_stop` 再把累计 partial_json parse 成最终 input 对象 ([platform.claude.com][5])

* **实时 token 用量**：

  * `message_delta.usage` 的 token 是 **cumulative**（累计值），可以用来实时刷新 UI 的 token 计数器 ([platform.claude.com][5])

### 4.3 “怎么确保 Claude 会吐 thinking block？”

两条正路（都来自 Claude Code 的配置体系）：

* settings 里有 `alwaysThinkingEnabled`（默认启用 extended thinking） ([Claude][6])
* 还可以用环境变量 `MAX_THINKING_TOKENS` 限制/关闭 thinking（设 0 直接禁用） ([Claude][6])

---

## 5) 给 Cat Café transform 的“共犯级”改造建议（不问你要需求，直接给落点）

### 5.1 做一个统一的内部事件枚举（跨猫对齐）

建议我们最终对前端只输出这几类（其他全塞 metadata 透传）：

* `assistant_output_text`（用户可见）
* `assistant_thinking`（折叠/隐藏）
* `plan_update`（todo_list / compact_boundary / status）
* `tool_call`（command_execution started / tool_use block start / mcp_tool_call started）
* `tool_result`（command_execution completed / mcp_tool_call completed / tool_result block）
* `telemetry_usage`（turn.completed / message_delta usage / result usage）
* `telemetry_cost`（Claude 的 total_cost_usd / per-model cost）
* `warning`（Codex item.error / Claude rate_limit_event 等）
* `error`（turn.failed / result error_* / stream error）

### 5.2 Codex transform：立刻补上的 6 个 switch case

把这些从 `return null` 里救出来：

* `item.updated` + `item.type="todo_list"` → `plan_update`
* `item.*` + `item.type="mcp_tool_call"` → `tool_call/tool_result`（还能带 structured_content）
* `item.completed` + `item.type="web_search"` → `tool_call`（或单独 `meta_web_search`）
* `item.completed` + `item.type="error"` → `warning`
* `item.completed(file_change)` 把 `changes[].kind` 扩展到 `delete`（我们文档只写 add/update） ([takopi][2])
* 顶层 `type="error"`：如果 message 形如 “Reconnecting... x/y” → 当作 `system_info` 而不是 error（cheatsheet 明确建议当非致命进度） ([takopi][2])

### 5.3 Claude transform：stream_event 解析不要只看 text_delta

最“值钱”的补齐是：

* `thinking_delta` → `assistant_thinking`
* `input_json_delta` → tool 参数流（拼接 buffer，block_stop 再 parse）
* `message_delta.usage` → 实时 token 计数器（cumulative）
* 处理 `ping` / `error`（至少别炸）
* 接住 `system/compact_boundary`、`system/status`、`tool_progress`、`rate_limit_event`、`hook_*`、`task_*` 这些系统消息，做 observability 面板素材 ([platform.claude.com][3])

---

## 6) “还有什么宝藏？”— shortlist（最值得先挖的 5 个）

按“投入小、收益大”排序：

1. **Codex todo_list** → 前端 plan checklist（秒变专业） ([takopi][2])
2. **Claude stream_event: thinking_delta / input_json_delta / message_delta usage** → thinking 折叠 + 实时 token HUD ([platform.claude.com][5])
3. **Codex mcp_tool_call.structured_content** → 结构化产物直出（告别脆弱的文本解析） ([takopi][2])
4. **Claude result 的 error_* subtype** → 错误归因从“猜”升级为“判” ([platform.claude.com][3])
5. **Claude compact_boundary + rate_limit_event** → “为什么这次慢/为什么压缩/为什么失败”的根因可视化 ([platform.claude.com][3])

---

下一步可以按我们现有 `transformClaudeEvent()` / `transformCodexEvent()` 的风格，直接出一份 **事件路由对照表（输入 JSON shape → 我们的 AgentMessage type + metadata schema）**，把以上宝藏全部落到 Cat Café 数据流里，做到”前端能折叠 thinking、能展示 plan、能看到 MCP 工具结果、能实时 token/cost”。

[1]: https://developers.openai.com/codex/noninteractive/ "Non-interactive mode"
[2]: https://takopi.dev/reference/runners/codex/exec-json-cheatsheet/ "Codex exec --json event cheatsheet - takopi"
[3]: https://platform.claude.com/docs/en/agent-sdk/typescript "Agent SDK reference - TypeScript - Claude API Docs"
[4]: https://code.claude.com/docs/en/headless "Run Claude Code programmatically - Claude Code Docs"
[5]: https://platform.claude.com/docs/en/build-with-claude/streaming "Streaming Messages - Claude API Docs"
[6]: https://code.claude.com/docs/en/settings "Claude Code settings - Claude Code Docs"


pre-research：docs/archive/2026-02/research/cli-ndjson-treasure-map.md