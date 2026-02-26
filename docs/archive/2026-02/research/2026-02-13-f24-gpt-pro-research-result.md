---
feature_ids: [F024]
topics: [gpt, pro, result]
doc_kind: research
created: 2026-02-13
---

## A. Claude CLI stream-json 深入调研

> 本节结论以 Anthropic 官方 Claude Code / Agent SDK 文档 + GitHub Issues 为主；均为 2025-2026 期间材料。
> 标注方式：**已确认**（有来源）/ **推测**（需要你们本地实测兜底）。

### A1. 消息格式的完整 schema：有哪些字段？`parent_tool_use_id` 做什么？

**已确认：CLI 的 stream-json 输入/输出，与 Agent SDK（TypeScript）里定义的 `SDKMessage` 族一致。**它把“每行一个 JSON”当作消息帧（JSONL）。

#### 1) 你通过 stdin 发送的用户消息（核心字段）

Agent SDK TypeScript 参考里，`SDKUserMessage` 定义如下（字段名与 CLI JSON 一致）：

* `type`: `"user"`
* `uuid?`: 可选（用于回放/去重/复现等场景）
* `session_id`: 会话标识（见 A3）
* `message`: `APIUserMessage`（Anthropic Messages API 的用户消息结构）
* `parent_tool_use_id`: `string | null`

**最小可用示例（来自 Claude Code issue 的可复现输入）：**

```json
{"type":"user","message":{"role":"user","content":"What's the capital of France?"},"session_id":"default","parent_tool_use_id":null}
```

#### 2) 输出侧你会看到的关键事件类型（schema 摘要）

同一份 TypeScript 参考定义了常见输出消息（对你们前端/WS 推送非常关键）：

* `system/init`：会话初始化信息（含真实 `session_id`、工具列表、模型名、权限模式、slash_commands 等）
* `assistant`：完整 assistant message
* `stream_event`：部分流式事件（需要启用 `includePartialMessages` 才有）
* `result`：本轮结束的汇总（usage、cost、modelUsage 等）
* `system/compact_boundary`：发生压缩边界（见 A4）

其中 `system/compact_boundary` 的 schema（注意只有 `pre_tokens`，没看到 `post_tokens`）：

```ts
type SDKCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: "manual" | "auto";
    pre_tokens: number;
  };
}
```

#### 3) `parent_tool_use_id` 的语义与什么时候需要设

**已确认（语义）：**在 Agent SDK streaming output 文档里，`parent_tool_use_id` 用来标记“这条消息/事件来自某个子代理（subagent）”，它等于启动该 subagent 的 `Task` 工具调用的 `tool_use` id。

**对你们的后端含义：**

* 主会话产生的普通用户消息：`parent_tool_use_id: null`
* 若你启用了 subagent/Task 并想在 UI 上做“消息归属到哪个子任务”：

  * 输出侧用 `parent_tool_use_id` 把消息挂到对应 Task 节点
  * 输入侧通常仍发给主会话（`null`），由 Claude 自己路由

**推测（输入侧何时需要非 null）：**除非 Claude Code/SDK 支持“把用户消息定向投递到某个 subagent”，否则大多数实现不需要在 stdin 注入时设置 `parent_tool_use_id`。你们可以先把它固定为 `null`，等真的要做“对子代理对话框单独插话”再实测。

---

### A2. 在工具执行期间发消息会怎样？排队还是中断？

**已确认：Agent SDK 明确支持“Queued Messages”。**也就是 streaming mode 下可以连续提交多条用户消息，它们会按序被处理，并且“可以 interrupt”。

基于此，最符合你们“像桌面版一样”的行为模型是：

* **默认行为（建议按“排队”实现）**：你们把新消息写入 stdin 后，Claude 在“完成当前工具调用/当前 turn 的关键步骤”后处理该消息（不会立刻把正在执行的 Bash/Write 之类硬中断）。
* **中断行为（推测，需实测）**：

  * Claude CLI print/headless 模式未看到“stdin 发送 interrupt 帧”的官方 schema；
  * 更稳的方式可能是 **对 CLI 子进程发 OS 级中断**（例如 SIGINT）或走 hooks/权限机制“阻止下一步”，但这属于工程实测范畴。

**你们后端实现建议（可落地）：**

* 前端允许随时输入
* 后端将输入写入 Claude 子进程 stdin（JSONL）
* UI 显示状态：`queued`（已入队）/`accepted`（被 turn 消费）
* 若需要“打断”，为每只猫提供 `interrupt()` 能力：

  * Claude：先做 SIGINT 实测；不保证稳定，需要兜底“本轮作废并重启 session”

---

### A3. `session_id` 管理：第一条用什么？后续必须用 `system/init` 的真实 session_id 吗？

**已确认：多轮 stream-json 的常见做法是：第一条用 `"default"`，然后从输出捕获真实 `session_id`，第二条开始使用真实值。**

Issue #5034 给了非常明确的复现步骤：

* 第一条 stdin：

  * `session_id: "default"`
* 第二条 stdin：

  * `session_id: "<captured_session_id>"`（从输出的 system/init 或其他消息里抓到）

**推测（不匹配会怎样）：**

* 若你用一个不存在/不匹配的 `session_id`，可能出现：

  1. CLI 报错/无响应
  2. CLI 当作新会话
  3. CLI 把日志写到奇怪的 transcript 里
* 这块官方没有给“错误码行为合同”，建议你们做一次自动化集成测试（见路线图 F）。

---

### A4. `/compact` 能否通过 stdin 发送？`compact_boundary` 事件完整格式？

#### 1) `/compact` 是否能“当作 slash command”在 headless 里触发？

**已确认：Claude Code headless/print 模式下，内置命令（例如 `/commit`）只在交互式 REPL 中可用。**文档直说“用户触发技能/内置命令只在 interactive mode”。

这意味着：在你们当前 `claude -p ... --output-format stream-json` 的形态下，**把 `"/compact"` 当作普通文本塞进 stdin，很可能不会触发真正的 compact**。

同时也有用户提出“/compact 只能用户键入，Claude 不能在 workflow 指令里调用”的需求，进一步侧面印证“程序化触发 compact”的缺口。

#### 2) `compact_boundary` 事件格式（已确认）

见 A1：TypeScript 参考只给了 `pre_tokens`，未提供 `post_tokens`。

---

### A5. `PreCompact` hook：完整 input/output schema？能否影响或阻止压缩？

#### 1) 输入 schema（已确认）

Claude Code hooks 参考明确列出：`PreCompact` input = 通用字段 + `trigger` + `custom_instructions`。

* 通用字段：`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`
* PreCompact 特有：

  * `trigger`: `"manual" | "auto"`
  * `custom_instructions`: manual 时来自 `/compact` 参数，auto 时为空

Agent SDK Python 也给了同样的类型定义（字段同名）：

#### 2) 输出 schema（已确认）

Hook 的 JSON 输出是通用结构（`continue`, `stopReason`, `systemMessage`, `decision`, `reason`, `hookSpecificOutput` 等）。

#### 3) 能否阻止 compaction（已确认：不能）

Claude Code hooks 文档在 “Exit code 2 behavior per event” 表里写死了：

* `PreCompact`：**Can block? = No**，exit 2 只会把 stderr 展示给用户，不会阻止压缩。

所以你们可以把 `PreCompact` 当作：

* “压缩前做快照/归档/外部通知”的入口
* 不是“延迟/改写/阻止压缩”的开关

---

### A6. `Stop` hook：能否检查 context 使用量并决定阻止停止？input 有 token/context 信息吗？

#### 1) input 是否含 token/context（已确认：不含）

`Stop input` 里只有通用字段 + `stop_hook_active`。
没有 usage/token/window 字段。

#### 2) 能否阻止停止（已确认：可以）

`Stop decision control`：返回 `{"decision":"block","reason":"..."}` 可以阻止 stop，让 Claude 继续工作。

#### 3) 那要怎么在 Stop hook 里“基于 context 决策”？（推测 + 可工程化）

你们可以在 Stop hook 脚本里：

* 读取 `transcript_path` 文件
* 找到最近一次 `result` 或 `modelUsage` 信息（如果 transcript 里记录）
* 或者在你们 Node 后端里实时维护 “最后一次 result 的 modelUsage/contextWindow” 并写到某个共享状态文件，让 hook 脚本读取

这样 Stop hook 才能做到：

* “接近阈值就 block stop + 要求写交接文档”
* 写完交接再允许 stop

---

### A7. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`：范围？设 70 是否安全？与 PreCompact 顺序？

#### 1) 取值范围与默认（已确认）

设置页写得很清楚：

* `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`：设置触发 auto-compaction 的 context 使用百分比
* **范围：1-100**
* **默认：约 95%**
* **高于默认阈值无效**（“values above the default threshold have no effect”）
* 与 status line 的 `context_window.used_percentage` 对齐

#### 2) 设为 70 是否“安全”？（工程建议）

* **安全（系统稳定性角度）**：只会更早触发压缩，降低“顶到 context ceiling”的风险（但会增加压缩频率）。
* **风险（任务质量角度）**：压缩越频繁，越容易丢掉你们认为重要但模型没总结到的细节（尤其长工程任务）。这会直接影响你们的“自动交接”成功率。

另外有用户报告该变量在某些版本“被忽略”，所以你们要把它当作“尽力而为”的开关，并做好 UI/监控兜底。

#### 3) 与 PreCompact 的触发顺序（推测）

基于语义推断顺序应为：

1. context 使用达到阈值（默认 95% 或 override）
2. 触发 auto compaction
3. 触发 `PreCompact` hook（因为文档说它“runs before compact operation”）
4. 实际压缩
5. 输出 `system/compact_boundary`（带 `pre_tokens`）

这条链路建议你们用一条超长对话本地压测确认一遍。

---

## B. Codex app-server 评估

### B1. 启动方式：stdio 还是 ws？哪种更适合作为子进程？

**已确认：stdio 是默认且推荐；websocket 被标注为 experimental/unsupported。**

* `--listen stdio://`（默认）：newline-delimited JSON（JSONL）
* `--listen ws://IP:PORT`：每条 JSON-RPC 一帧，但 **experimental / unsupported**，不建议用于生产

**工程结论（给 Cat Café 的 spawn 模型）：**

* 作为子进程：选 **stdio://** 最省事，跟你们现有 NDJSON 解析路径一致
* ws 只适合你们未来如果要“独立部署 Codex 服务”，但目前不值得赌稳定性

---

### B2. JSON-RPC 协议文档：`turn/steer` / `turn/interrupt` / tokenUsage 通知的 schema？

#### 1) 协议层（已确认）

`codex app-server` 使用 JSON-RPC 2.0 风格消息，并且 **线上消息省略 `"jsonrpc":"2.0"` header**。

这点很要命：你们的 JSON-RPC 客户端别强依赖 `jsonrpc` 字段。

#### 2) `turn/steer`（已确认，有官方示例）

官方 README 明确：

* `turn/steer`：把用户输入追加到“正在进行的 turn”，**不会**开启新 turn
* 返回接受输入的 `turnId`
* `expectedTurnId` **必填**，如果当前没有 active turn 或不匹配，会报 `invalid request`

示例请求/响应（你们可以直接照抄实现）：

```json
{ "method": "turn/steer", "id": 32, "params": {
  "threadId": "thr_123",
  "input": [ { "type": "text", "text": "Actually focus on failing tests first." } ],
  "expectedTurnId": "turn_456"
} }
{ "id": 32, "result": { "turnId": "turn_456" } }
```

#### 3) `turn/interrupt`（已确认）

README 同段落说明：

* `turn/interrupt`：按 `(thread_id, turn_id)` 请求取消 in-flight turn
* 成功响应是空对象 `{}`，turn 最终以 `status: "interrupted"` 结束

#### 4) token usage / context window（已确认字段存在，但“对应哪个通知名”需你们实测确认）

在 `openai/codex` 的 protocol 定义中，`TokenUsageInfo` 明确包含：

* `input_tokens`
* `cached_tokens`
* `output_tokens`
* `reasoning_tokens`
* `total_tokens`
* `model_context_window`（可选）
* `last_request_id`（可选）

这意味着：**app-server 协议层具备“告诉你模型 context window 大小”的字段位**，非常适合做你们的 Context 存活监控。

---

### B3. 从 `codex exec` 迁移到 `app-server` 的工作量评估

**已确认的差异（来自 app-server 定位）：**`codex app-server` 是 Codex 用来支撑富交互界面的接口（例如 VS Code extension）。
因此它天然更接近你们想要的“中途 steer / 注入 / 监控”。

**迁移拆解（工程评估，属于可执行方案）：**

1. **进程模型改造**

   * exec：每次 spawn 一次
   * app-server：长驻进程 + 你们自己管理 thread/turn 生命周期

2. **协议解析层改造**

   * exec：一次性 JSON 结果
   * app-server：JSONL 的 JSON-RPC request/response + server notifications（事件流）

3. **状态机**

   * 需要保存：

     * `threadId`
     * 当前 active `turnId`
     * 最近一次 token usage（用于 UI context 进度条）
   * 注入时：必须带 `expectedTurnId`（乐观锁）

4. **错误与背压**

   * app-server 提到使用 bounded queues 做 backpressure（这对你们 WS 推送爆量时很关键）
   * 你们也要在 Node 侧做：

     * stdout 读取不能阻塞
     * WebSocket 推送做节流
     * 注入请求做队列化

---

### B4. app-server 稳定性：stable API 吗？breaking change 风险？

**已确认：websocket transport 明确“experimental / unsupported”。**
此外，README 里也出现“某方法是 experimental 且需要 capabilities.experimentalApi = true”的描述，说明协议确实存在实验面。

**工程结论：**

* 选 stdio transport 可以最大化稳定性
* 把 protocol 适配层做成“可版本化”的（见 D 的 capabilities 模型）
* 事件 schema 建议用“宽松解析 + unknown 字段透传保存”，避免小改动就炸

---

### B5. app-server vs exec 的性能差异（推测，但强烈建议你们这么想）

* 长驻进程通常减少每轮 spawn 的启动成本，适合长任务与实时 UI
* 代价是常驻内存与 thread 状态管理复杂度
* 你们已经有 “三猫 session/resume” 思路，迁移 app-server 反而更统一

---

### B6. `turn/steer` 行为细节：排队还是立即处理？expectedTurnId 失败会怎样？

**已确认：**`turn/steer` 是“追加到 in-flight turn”，不是开启新 turn，并且不发 `turn/started`。
**已确认：**`expectedTurnId` 必填；无 active turn 或不匹配会返回 `invalid request` error。

**你们可直接采用的注入语义：**

* 注入调用成功返回 `{turnId}`：表示“已被该 turn 接受”
* 若 `invalid request`：

  * 说明 turn 已结束 或你们拿到的 activeTurnId 过期
  * 后端应把消息转为“下一轮 turn 的首条用户消息”（deferred），并在 UI 告知“本轮没赶上，已放到下一轮”

---

## C. Gemini CLI 的替代方案

> 这一节我用的是 Gemini CLI 官方仓库 docs（不是 2024 老资料），但目前我没有看到你们提到的 “PreCompress hook” 在已打开的官方文档片段中出现；因此相关部分我会明确标成未知/需源码确认。

### C1. 不走 CLI，直接调用 Gemini API + Tool Use 是否更灵活？

**已确认：Gemini CLI 本身是一个终端 agent，支持脚本化非交互模式 `-p`，并且支持 `--output-format stream-json` 输出事件流（JSONL）。**

从“中途消息注入”角度看：

* CLI 的 `-p` 模式是“一次性 prompt -> 输出”风格，你们现在用它就天然不支持“运行中追加输入”
* 直接用 API 你们可以自己实现：

  * websocket/HTTP streaming 输出
  * 中途追加用户消息（你们自己的队列 + 下一个模型 step 消费）
  * tool 调用与状态机（更接近 Codex app-server/Claude stream-json 的模式）

**成本/延迟（部分已确认 + 部分推测）：**

* Gemini CLI 文档明确提到它有 **token caching** 来降低后续请求 tokens，从而优化成本。
* 并且缓存特性与认证方式相关：API key/Vertex AI 有，OAuth 没有。
* **推测：**你们直连 API 能不能享受同等缓存能力，取决于你们是否实现同等“cached content / system instruction reuse”机制（需要查 Google 端 API 支持情况并实测）。

### C2. 你们提到的 `PreCompress` hook 回调方案（官方文档可见性：不足）

**已确认：在已打开的官方 Gemini CLI 文档里，我没有看到任何 “hook / PreCompress” 机制描述。**（README 不包含 hook；相关 CLI docs 片段也未出现 hook 关键词。）

所以这里我只能给你们“可替代的、现在就能落地”的路径：

* 用 CLI 自带的 **checkpointing**（工具改文件前自动做快照，存到 `~/.gemini/history/` 的 shadow repo，配 `/restore` 回滚）来保证长任务安全性。
* 用 `/stats` 获取 token 使用与缓存节省（你们可以把它采集进 UI）。
* 用 `GEMINI.md` + `/memory` 体系做“持久上下文”（类似你们的交接文档，但更像全局说明书）。

**如果你们坚持 hook：**

* 需要下一步对 gemini-cli repo 做一次源码 grep（例如 `hook`, `compress`, `compact`, `threshold` 等关键字）确认是否存在，以及执行环境（timeout、env、PATH）。
* 这一步我在本次 web 调研额度内没法继续展开，只能在 E 风险里标记“待验证”。

### C3. Gemini 1M context window：多少 token 开始降质？有无安全区数据？

**本次调研未确认。**
我没有在已打开的 Gemini CLI 官方文档里看到“1M window 的质量曲线/安全区”说明（通常这类信息在模型说明或研究博客里，需要另开一轮专门查证）。

**工程建议（可操作）：**

* 不要把“1M”当成“可以放心塞满 99 万 token”
* 对你们 UI 侧，可以先把 Gemini 的 `ContextHealth.source` 标成 `approx`
* 用 `/stats` 输出做 baseline，再结合任务成功率做你们自己的安全阈值（例如 70% 开始预警，85% 强制交接）

### C4. Gemini CLI 交互模式 + pipe：用 `expect`/`pty` 绕过 one-shot 限制？

**已确认：Gemini CLI 支持交互式启动 `gemini`，也支持 `-p` 非交互脚本模式。**

**推测（工程可行但风险高）：**

* 用 pty 驱动交互式 CLI 通常能实现“运行中继续输入”
* 但代价是：

  * 输出解析复杂（TUI/颜色/进度）
  * 协议不稳定（不像 Claude/Codex 明确给了机器协议）
* 你们已经有“统一 NDJSON/JSON-RPC”方向，我会把 pty 方案定位为“临时救火，不作为长期架构主干”。

---

## D. 跨猫统一架构建议

这里给你们一个“统一接口 + 能力降级”的设计，让三猫差异不会把后端写成意大利面🍝。

### D1. 统一的 stdin 注入接口：`injectMessage(catId, message)`

关键在于：不要假设所有猫都能“立即注入”。要让接口返回 **注入模式**：

* `immediate`: 已追加到 in-flight turn（Codex steer）
* `queued`: 写入 stdin，等待当前工具/turn 边界消费（Claude streaming input）
* `deferred`: 当前猫不支持中途注入，已缓存到下一个 turn/session（Gemini CLI -p）

```ts
type CatId = "claude" | "codex" | "gemini";

type InjectMode = "immediate" | "queued" | "deferred" | "rejected";

type InjectMessageReq = {
  catId: CatId;
  sessionId: string;         // 统一用你们自己的 session handle 映射
  text: string;
  // 可选：用于子代理/任务归属
  parentToolUseId?: string | null;
  // 并发控制（Codex 用 expectedTurnId）
  expectedTurnId?: string;
};

type InjectAck = {
  mode: InjectMode;
  acceptedByTurnId?: string; // Codex steer 成功时回填
  reason?: string;
};
```

**Claude 实现要点（已确认字段）：**

* 写 JSONL 到 stdin，字段至少包含 `type/user/message/session_id/parent_tool_use_id`
* `session_id` 首条用 `"default"`，之后用 `system/init` 抓到的真实值

**Codex 实现要点（已确认行为）：**

* 走 app-server stdio JSONL JSON-RPC
* in-flight 注入用 `turn/steer`，必须带 `expectedTurnId`，不匹配就 `invalid request`
* 需要“硬打断”时用 `turn/interrupt`

**Gemini（CLI -p）实现建议：**

* `injectMessage` 一律返回 `deferred`
* 把消息缓存到“下一次 gemini -p 调用的 prompt 拼接区”
* 如果你们未来改成直连 API，再把 `deferred` 升级成 `queued/immediate`

---

### D2. Token 监控的统一数据模型：`ContextHealth`

你们的 UI 想显示 “75% context used”，就要统一：

* **窗口大小**（windowTokens）
* **已使用**（usedTokens）
* **来源可信度**（exact/approx/none）

```ts
type ContextHealthSource = "exact" | "approx" | "none";

type TokenBreakdown = Partial<{
  input: number;
  output: number;
  reasoning: number;
  cachedRead: number;
  cachedWrite: number;
  total: number;
}>;

type ContextHealth = {
  windowTokens?: number;
  usedTokens?: number;
  usedPct?: number;          // 0-1
  remainingTokens?: number;
  remainingPct?: number;     // 0-1
  source: ContextHealthSource;
  breakdown?: TokenBreakdown;
  updatedAt: string;
};
```

**Claude（已确认可拿到 window）：**

* `result` 里的 `modelUsage[model].contextWindow` 字段存在
* 同时还给 per-model cache 相关统计，方便你们区分“有效输入 vs cached”

**Codex（已确认字段存在）：**

* 协议里 `TokenUsageInfo.model_context_window` 存在
* 同时有 `reasoning_tokens` 等细分，可直接映射到 breakdown

**Gemini CLI（已确认能拿 token 使用）：**

* `/stats` 可以查看 token usage 与 cached token savings
* 但它是否能给 “模型 context window 上限” 尚未在已打开文档中确认，所以初期 `source` 建议标 `approx`

---

### D3. 自动交接的统一策略：`HandoffPolicy`

你们需求 3 的本质是：**别等 auto-compact 把记忆磨没了才想起写交接**。

我建议把策略拆成两层：

1. **触发条件**（基于 ContextHealth）
2. **行动脚本**（让猫产出 handoff artifact，并让系统“满血复活”）

```ts
type HandoffPolicy = {
  warnAtRemainingPct: number;     // 例如 0.25
  triggerAtRemainingPct: number;  // 例如 0.15
  handoffDocPath: string;         // 例如 docs/HANDOFF.md
  requireCommit: boolean;
  restartStrategy: "nativeCompact" | "sessionRestart";
};
```

**推荐的“跨猫一致”复活方式：`sessionRestart`（工程上更可控）**

原因：

* Claude headless 模式下 slash `/compact` 并不可靠可编程触发
* Gemini/Codex 的 compact 机制也各不相同

因此统一做法可以是：

1. 触发阈值 -> 注入 “写交接文档 + 最小可复现状态 + 下一步计划”
2. 要求猫把交接写到 repo（或固定路径）
3. 要求猫 commit（如果猫支持；Gemini CLI checkpointing 是 shadow repo，不等于你项目 repo 的 commit）
4. 后端结束当前 session
5. 新开 session，把交接文档内容作为 system/首条 context（或者让猫先 Read 再继续）

这样你们“满血复活”不依赖各家 compact 黑箱。

---

## E. 风险与未知

### Claude 侧

* **stream-json 输入用法本身存在文档缺口**（用户提 issue 说 “undocumented beyond flags table”）。
* 已知历史 bug：

  * “第二条消息 hang”类问题曾被报告（你们已提到 #3187）。
  * session `.jsonl` 重复写入（#5034）。
* `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 有被报告“ignored”的风险，别把它当硬保证。
* `PreCompact` 不能阻止压缩，不能把它当“阈值拦截器”。

### Codex 侧

* websocket transport **明确不建议生产使用**，别用。
* `turn/steer` 的 expectedTurnId 是乐观锁，处理不好会出现“注入丢失/落到下一轮”的用户体验问题。
* JSON-RPC 省略 `jsonrpc` header，第三方库可能不兼容，需要自写轻量解析层。

### Gemini 侧

* 目前已确认：CLI 支持 `-p` + `--output-format stream-json` 输出事件，但没有看到“输入流式追加”机制的官方描述。
* 你们提到的 “PreCompress hook” 在本次打开的官方文档片段中未出现，需源码确认（高不确定）。
* checkpointing 是 shadow repo（`~/.gemini/history/`），不会帮你把变更 commit 到你项目 repo。

---

## F. 推荐实施路线图

按“先把用户体验做出来，再补齐监控和自动交接”的顺序推进。

### Phase 1：Claude 中途注入闭环（你们最快能看到质变的一步）

**产出：**

* 后端把 Claude 子进程 stdin 从 `ignore` 改 `pipe`
* 用 stream-json 输入发送多轮消息（首条 `session_id:"default"`，后续用真实 session_id）
* UI 支持 “执行中追加消息”，显示状态 `queued`

**验收用例：**

* Claude 正在 Write/Edit 工具执行时追加一条“顺便改测试”
* 工具结束后，Claude 能消费该追加消息（排队成功）

### Phase 2：统一 ContextHealth（先做 Claude + Codex）

**产出：**

* Claude：从 `result.modelUsage[model].contextWindow` 计算 usedPct
* Codex：从 token usage 的 `model_context_window`（若有）计算 usedPct
* UI 显示“剩余百分比 + 数据来源 exact/approx”

### Phase 3：Codex 从 exec 迁移到 app-server（为了 steer 能力）

**产出：**

* 子进程启动 `codex app-server --listen stdio://`
* 实现 JSONL JSON-RPC client
* turn 进行中可 `turn/steer` 注入消息（expectedTurnId 乐观锁处理好）
* 可选：实现 `turn/interrupt` 做“打断当前 turn”

### Phase 4：自动交接（跨猫一致的 sessionRestart 版本）

**产出：**

* 当 `remainingPct < 0.15`：

  * Claude/Codex：立即 inject “写交接 + commit + 下一步计划”
  * Gemini CLI：标记 deferred，下次 turn 首条强制执行
* 交接写入固定文件（如 `docs/HANDOFF.md`）
* 系统重启会话，把 HANDOFF 作为启动上下文继续任务

### Phase 5：Gemini 方案定稿

两条路二选一：

* **保守路**：继续 CLI -p，用 `/stats`/GEMINI.md/checkpointing 提升可靠性
* **进攻路**：改直连 Gemini API，自建 tool loop，实现真正的 mid-turn queue/steer（这条需要另开一轮“Google API 能力与成本”专项调研）

---

如果你愿意，我可以把上面 D 里的接口/类型，直接贴成你们 `packages/api/src/domains/cats/services/` 里可落地的 TypeScript 适配层骨架（包含 Claude JSONL writer、Codex JSON-RPC client、Gemini deferred queue），并且把“注入队列 + ContextHealth 聚合 + 自动交接状态机”拆成几个文件，方便你们直接开工。

----

# research round 2

我把这份「Session 链 + Sub-agent 交接」讨论稿当成设计评审读了一遍，整体方向非常对：把“记忆”从黑箱 compact 里夺回来，变成你们自己掌控的可追溯资产（session transcript + invocation 索引 + 可视化链条）。这条路走通之后，猫就算失忆，Cat Café 也不会失忆 🧠📚

下面我按“能立刻补强这份方案、并减少后续返工”的角度，给一套更落地的补丁建议。

---

## 0) 先给两条需要立刻更新的事实补丁（避免后面讨论跑偏）

### 0.1 Claude Code 的 context/window 其实已经不是“固定 200k”那套了

你们文档里把 Opus 当成 ~200k、Sonnet 当成 1M sub-agent。这里建议改成“模型可配置，window 由 runtime 报告为准”。

* Claude API 的 1M context 是 **beta**，仅 Opus 4.6 / Sonnet 4.5 / Sonnet 4 支持，并需要 beta header；超过 200k input 会触发 **long-context premium（输入 2x、输出 1.5x）**。([Claude开发平台][1])
* Claude Code 的 model alias 里已经明确存在 `sonnet[1m]`（1M context），并且可在 session 内 `/model` 切换。([Claude Code][2])
* 同一页还写了：Claude Code 可能在 Opus 达到用量阈值时 **自动 fallback 到 Sonnet**。你们的 SessionChainStore 里必须记录 “本 session / 本 turn 实际使用的 model”。([Claude Code][2])

> 结论：**“session 链”不仅要链 session_id，还要链 model snapshot/alias**，否则“换猫不自知”会变成“换模型不自知”。

---

### 0.2 Codex/GPT 的 context window 不一定是 128k（至少 gpt-5.1-codex 是 400k）

你们表里写 Codex/GPT ~128k。这个在 2026 已经很可能不准了，尤其如果你们未来用 OpenAI 官方的 Codex 模型。

OpenAI 官方模型页写得很明确：**GPT-5.1 Codex = 400,000 context window，max output 128,000**。([OpenAI开发者][3])

> 结论：Codex 的 window 最好不要“硬编码 128k”。
> 最稳方案：**优先从协议/运行时拿 model_context_window**，拿不到再 fallback 到配置映射表（model name -> window）。

---

## 1) 你们这套“Thread -> 多 Session”我建议再加一个“封存（Seal）”概念

现在的讨论把 session “结束”当作一个动作。实际工程里最好分两步：

1. **Seal Session（封存）**：不再接受新 turn，把 transcript、invocation index、usage 等元数据写齐，生成可查询快照
2. **Start New Session（续命）**：创建新 session，挂到 chain 上

封存的价值：

* 让“读取旧 transcript”变成读一个 **immutable snapshot**，避免边写边读的竞态
* 你们可以在 Seal 时刻触发后台 job：生成 digest、抽取文件清单、生成 invocation 表，等等

---

## 2) SessionChainStore 我建议的最小可用数据模型（MVP 但不脆）

你们现在提 `parentSessionId, status, tokenUsage`，我建议加几个字段，否则后续会反复补洞：

```ts
type SessionStatus = "active" | "sealing" | "sealed" | "error";

type SessionRecord = {
  id: string;                 // internal session id (uuid)
  threadId: string;
  catId: "claude" | "codex" | "gemini";

  parentSessionId?: string;
  createdAt: string;
  sealedAt?: string;

  status: SessionStatus;
  endReason?: "threshold" | "user" | "error" | "manual";

  // provider linkage (debug + resume)
  providerSessionId?: string; // e.g. Claude system/init session_id
  providerThreadId?: string;  // e.g. Codex app-server threadId

  // model lineage (超级关键)
  modelAlias?: string;        // e.g. "opus", "sonnet", "sonnet[1m]"
  modelName?: string;         // pinned snapshot if available

  // transcript storage pointers
  transcriptUri: string;      // e.g. file:///.../events.jsonl.zst
  indexUri?: string;          // e.g. file:///.../invocations.json
  digestUri?: string;         // e.g. file:///.../digest.md

  // usage & context health (end-of-session authoritative)
  context: {
    windowTokens?: number;
    usedTokens?: number;
    usedPct?: number;
    source: "exact" | "approx" | "none";
    lastUpdatedAt: string;
  };

  // derived facts (Seal 时刻写入，供 UI/摘要用)
  stats?: {
    turns: number;
    invocations: number;
    filesTouched: number;
    autoCompactionSeen?: boolean;
  };
};
```

**为什么 model lineage 要进 store？**
Claude Code 文档明确提到会自动 fallback model（Opus -> Sonnet）这种行为。你们如果不记录，Session2 再读 Session1，看到的“行为差异”会像灵异事件。([Claude Code][2])

---

## 3) Transcript 存储：别让 Redis 扛大锅，建议“文件落盘 + 元数据索引”

你们开放问题 #1 问 Redis vs FS，我建议：

* **源数据（raw events）**：落盘文件（JSONL，建议压缩 zstd），可选对象存储（S3/MinIO）
* **索引（可查询）**：数据库（Postgres/SQLite 都行）存：

  * session 元数据（SessionChainStore）
  * event 的偏移索引（按 uuid/行号 -> byte offset）
  * invocation 索引（invocationId -> [startOffset, endOffset]）
  * 可选：FTS（全文索引）或 embedding 索引

Redis 只做：

* active session 的小缓存（最近 N 条 event、当前 usage、注入队列）
* 绝不做“长期真相仓库”

这样你们：

* UI 展开 Session1 时，可以分页读（offset/limit）
* Sub-agent 工具也能分页读（避免一次塞爆 token）

---

## 4) MCP 工具设计：我建议把 “读 transcript” 拆成三层视图，不要只做一个 read_all

你们现在的想法是：

* `read_session_transcript(sessionId) -> 完整对话记录`

这在工程上会马上撞墙（token 上限、网络、解析、内存、UI 卡死）。建议改成：

### 4.1 Session 链查询

```ts
list_session_chain(threadId, catId) -> SessionRecordSummary[]
```

### 4.2 Transcript 分页读取（按 event）

```ts
read_session_events({
  sessionId,
  cursor?: string,         // e.g. event uuid or byte offset
  limit?: number,          // e.g. 50 events
  view?: "raw" | "handoff" | "chat",
  includeToolResults?: "none" | "summary" | "full",
}) -> { events: Event[], nextCursor?: string }
```

* `raw`：完整 NDJSON（调试/审计用）
* `chat`：只返回 user/assistant 文本（最省 token）
* `handoff`：用于交接的“黄金视图”

  * tool_use 保留
  * tool_result 默认只给摘要（或者截断）
  * 每条都带 `invocationId/toolUseId` 方便后续点查

### 4.3 Invocation 级点查（按 “一次工具/一次 turn”）

```ts
read_invocation_detail({ invocationId, includeStdout: boolean }) -> InvocationDetail
```

**你们的“按需拉取”体验，会主要靠 4.2 + 4.3 成立。**
先拿 `handoff view` 做总览，再点查 invocation。

---

## 5) Sub-agent 交接：我建议“Server 预生成 Digest + Agent 按需加深”双轨并行

你们的核心洞察是对的：别让濒死猫写交接，让满血猫（或便宜长窗模型）回看 transcript。

我建议把它做成两层，既保留“按需拉取”，又避免每次 Session2 都要从零读 200k：

### 5.1 Seal 时刻自动生成 SessionDigest（后台 job）

* 触发点：Session1 `status=sealed`
* 执行者：你们后端启动一个“总结任务”

  * 可以用 Sonnet 4.5（或 `sonnet[1m]`）([Claude Code][2])
  * 也可以用更便宜的 Haiku 4.5（$1/$5 MTok）做第一版粗摘要([anthropic.com][4])
* 输入：`handoff view`（不是 raw view）
* 输出：`digest.md` + `invocation_table.json` + `files_touched.json`

这样 Session2 启动时：

* 先把 digest 注入到 ContextAssembler
* 需要细节再调用 MCP 点查

### 5.2 Session2 仍可派 sub-agent “二次加深”

Claude Code 子代理支持：

* 子代理可配置 `model` 字段，支持 `sonnet/opus/haiku/inherit`，并继承 MCP 工具（除非你 deny）。([Claude Code][5])

所以 Session2 可以按需：

* “给我把 Session1 的某段 decision WHY 挖深一点”
* “把 invocation #37 的工具输出全文拉回来分析”

---

## 6) 你们开放问题逐条给可落地答案

### #1 Session transcript 存储位置？

**建议：文件系统/对象存储做真相，DB 存索引，Redis 只缓存热数据。**
理由见第 3 节。

---

### #2 200k transcript 用 Sonnet 读一次大概多少钱？

用 Anthropic 官方价算一下（以 Sonnet 4.5 为例）：

* Sonnet 4.5：**$3/MTok input，$15/MTok output**。([anthropic.com][6])
* 若你启用 1M context，且 **input 超过 200k**，会触发 premium：输入按 2x、输出按 1.5x。([Claude开发平台][1])

**粗算（不触发 premium，200k input + 8k output）：**

* input：0.2M * $3 = **$0.60**
* output：0.008M * $15 = **$0.12**
* 合计约 **$0.72/次**

**若稍微超 200k（比如 250k input + 8k output，触发 premium）：**

* input：0.25M * ($3*2) = **$1.50**
* output：0.008M * ($15*1.5) = **$0.18**
* 合计约 **$1.68/次**

> 工程建议：交接用 `handoff view` + 分页/分块总结，尽量把单次 input 控在 200k 以下，避免“因为系统提示/包装多几千 token 就突然翻倍”。

顺带一提，如果你们改用 OpenAI 的 GPT-5.1 Codex 做摘要：
它页面标价是 input $1.25/MTok、output $10/MTok，context 400k。([OpenAI开发者][3])
同样 200k+8k 大约 $0.25+$0.08=$0.33。是否合适取决于你们对摘要质量/风格的偏好。

---

### #3 Session 切换阈值设多少？

我建议别用固定百分比“一刀切”，用 **动态 turn-budget** 更稳：

* 维护一个 `turnTokenBudget`（比如 8k 或 12k，取你们线上 P95）
* 当 `remainingTokens < turnTokenBudget + safetyMargin` 时，直接 Seal 并开新 session

原因：你们的监控多半只能在 **turn.completed/result** 后才拿到准确 usage（至少 Claude/Codex 很常见是这样），固定 90% 可能来不及躲开下一轮的 token 波峰。

**默认建议：**

* `warnAtRemainingPct = 0.25`
* `triggerAtRemainingPct = 0.15`
* 但实际触发以 `remainingTokens` vs `turnTokenBudget` 为准

---

### #4 前端 session 链 UI 怎么设计？

给一个“工程省力且好用”的布局建议：

1. Thread 顶部加一个 **Session Timeline**（横条或竖轴）

   * 节点显示：Session #、model、tokens usedPct、sealed reason
2. 点击节点，右侧面板展示：

   * Digest（会议纪要格式）
   * Files touched 列表（可点开 diff）
   * Invocation 表（可过滤 tool/status）
3. Transcript 浏览器：

   * 默认 `chat view`
   * 勾选 “显示工具调用”切到 `handoff view`
   * “调试模式”才看 `raw view`

这样普通用户不会被 NDJSON 淹死，调试时又能一键下潜。

---

### #5 Codex 值不值得从 exec 迁移到 app-server？

结论我倾向：**不 block Phase 1-2，但 Phase 3 之前必须定。**

* 如果 F24 的“中途注入”是硬需求，app-server 的 `turn/steer` 基本是唯一正解（exec 天生 one-shot）。
* 但 session 链、transcript、digest、自动切换，这些都可以在 exec 模式先做起来。

**评估标准（建议写进决策记录）：**

* 是否需要 “turn 进行中注入/打断”
* 是否需要 “更细的 tokenUsage 持续更新”
* 你们能否接受“常驻进程”引入的状态机复杂度

---

### #6 Gemini 1M 安全区 & 压缩阈值

你们文档里写“auto-compress 70%”，这里要小心版本差异：

* Gemini CLI 配置文档写：compression threshold 默认 **0.7**，可配 0~1。([google-gemini.github.io][7])
* 但官方讨论里提到：从某版本开始默认阈值曾被调到 **20%**（更激进，强调质量）。([GitHub][8])
* Gemini CLI 的 `PreCompress` hook 存在，但它是 **advisory only，不能阻止或修改压缩**。([Gemini CLI][9])

**建议：**

* 不要依赖默认值，启动时强制写死你们要的 threshold（比如 0.6 或 0.7）
* “安全区”先用保守值，等你们做真实任务压测再调

---

## 7) 我建议你们给这份讨论稿再加一段“统一的交接产物规范（机器可校验）”

现在规范偏“会议纪要文本”。我建议再补一份机器可校验的 JSON 产物，避免摘要写漏：

* `files_touched.json`：[{path, ops: ["write","edit"], invocations:[...]}]
* `invocations.json`：[{id, tool, status, startedAt, durationMs, summary}]
* `decisions.json`：[{id, title, why, alternatives, evidenceInvocations:[...]}]
* `open_items.json`：[{id, description, blockers, nextActions}]

文本 digest 作为“阅读体验”，JSON 作为“系统可靠性”。

---

## 8) 路线图我建议的小调整（减少耦合、并行推进）

你们现在 Phase 4 才做 Claude 中途注入。我的建议：

* **Session 链 + Transcript Store + UI** 是主干（先做，收益最大）
* **Claude 中途注入**可以并行提前（它对 Session 链几乎没依赖）
* **Codex app-server**作为“注入能力”的后置决策，不阻塞主干

一个更顺滑的排序：

1. Phase A：SessionChainStore + Transcript 落盘 + UI session 链骨架（哪怕先只显示列表）
2. Phase B：ContextHealth 统一类型 + 阈值封存（turn 边界触发）
3. Phase C：Seal 时后台生成 Digest（handoff view 输入）
4. Phase D：Claude stdin 注入（体验升级）
5. Phase E：Codex app-server（注入 + 更实时 usage）
6. Phase F：Gemini hooks + 压缩策略固化（版本差异收敛）

---

如果你愿意，我可以把你这份 markdown 直接“打补丁版”给你一份可 commit 的更新稿：

* 更新 context/window 表（加入 `sonnet[1m]`、Codex 400k 的注释）([Claude Code][2])
* 把 open questions 的推荐答案写进去
* 加上 MCP 工具的分页 schema 和 `handoff view` 规范

你们拿去直接进仓库就能继续拉齐三猫和铲屎官的共识 🐾

[1]: https://platform.claude.com/docs/en/build-with-claude/context-windows "Context windows - Claude API Docs"
[2]: https://code.claude.com/docs/en/model-config "Model configuration - Claude Code Docs"
[3]: https://developers.openai.com/api/docs/models/gpt-5.1-codex "GPT-5.1 Codex Model | OpenAI API"
[4]: https://www.anthropic.com/claude/haiku?utm_source=chatgpt.com "Claude Haiku 4.5"
[5]: https://code.claude.com/docs/en/sub-agents "Create custom subagents - Claude Code Docs"
[6]: https://www.anthropic.com/claude/sonnet "Claude Sonnet 4.5 \ Anthropic"
[7]: https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html "Gemini CLI Configuration | gemini-cli"
[8]: https://github.com/google-gemini/gemini-cli/discussions/12311?utm_source=chatgpt.com "Increasing capacity and reliability · google-gemini gemini-cli"
[9]: https://geminicli.com/docs/hooks/reference/ "Hooks reference | Gemini CLI"
