---
feature_ids: []
topics: [system, prompt, context]
doc_kind: bug-report
created: 2026-02-23
---

# Bug Report: System Prompt / 协作说明重复注入导致 token 膨胀（越聊越胖 + 每轮都很重）

## 1. 报告人
- 报告人：铲屎官（2026-02-23 会话实测反馈）
- 定位：缅因猫（砚砚 / gpt52）
- 发现方式：
  - 在多轮对话/多猫转发过程中，观察到输入 token 消耗异常快
  - 系统提示词/协作手册被反复带入，每转发一次就重复一次
  - Prompt 中 “你的队友”出现重复条目（例如 `codex` 重复两次），链路序号显示 `第 4/4` 等疑似未去重

## 2. 复现步骤（期望 vs 实际）
### 复现（概念步骤）
1. 启动 API（多猫可用：Claude/Codex/Gemini）
2. 在一个 thread 中进行多轮对话（≥10 turns），并触发至少一次多猫串行/转发（routeSerial + A2A）
3. 观察每轮调用的 prompt 内容与 usage 指标（如 `input_tokens`、`cached_input_tokens` 或 CLI/前端统计）

期望：
- **静态身份/规则**不会在同一 session 内“越聊越胖”
- **长手册**（富消息块/HTTP 回调用法等）遵循渐进式披露：只在首次需要/显式请求时出现，而不是每轮都重复
- “你的队友”列表应去重且能区分多 variant（避免重复/歧义）

实际：
- 在支持 `resume` 的 provider 上，提示词内容会进入 session，随回合数线性膨胀
- 对非原生 MCP 的猫（Codex/Gemini），注入的 HTTP 回调手册非常长，并且每轮重复
- “你的队友”可能重复出现同一 catId，导致 prompt 噪声与歧义增加

## 3. 影响评估（token 量级）
### 3.1 单轮固定开销（`js-tiktoken` 估算，cl100k_base）
在当前实现下，单轮 prompt 的“固定块”大致是：
- `SystemPromptBuilder.buildStaticIdentity`：约 **300–370 tokens**
- `SystemPromptBuilder.buildInvocationContext`：
  - `mcpAvailable=false` 时约 **~100–135 tokens**
  - `mcpAvailable=true`（Claude 带 MCP_TOOLS_SECTION）时约 **~720–740 tokens**
- `McpPromptInjector.buildMcpCallbackInstructions`（HTTP callback 手册）：约 **~1768 tokens**

> 结论：对非原生 MCP 的猫（Codex/Gemini），单轮仅“注入手册”就接近 **1.8k tokens**；如果这段进入 session 并重复 N 次，N=10 时就是 ~18k tokens 的纯噪声。

### 3.2 “越聊越胖”的累积项
只要 provider 采用 `resume`（Claude CLI session / Codex CLI thread），且这些固定块被当作普通对话输入写入 session：
- 它们会随 turns 线性增长 → 造成“越聊越胖”
- 进一步挤占 context window，触发更早的截断/压缩/退化

## 4. 根因分析（代码证据）
### 4.1 Prompt 拼装链路：每次调用都会 prepend 固定块
- 串行路由在每只猫调用前拼接（含 A2A 扩展 worklist）：
  - `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
    - `buildStaticIdentity(catId)` 作为 `options.systemPrompt`
    - `buildInvocationContext({...})` 作为 prompt prepend
    - 对非原生 MCP：`buildMcpCallbackInstructions(...)` 作为 prompt prepend

### 4.2 Claude（Anthropic）：“resume 也 append system prompt”导致会话内重复累积
- `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
  - 当前逻辑：只要 `options.systemPrompt` 存在，就传 `--append-system-prompt`
  - 同时如果 `options.sessionId` 存在会传 `--resume`
  - 结果：**同一 session 内，每轮都会 append 同一段静态身份 prompt** → 明确的线性膨胀根因

### 4.3 Codex（OpenAI）：“systemPrompt 通过 prepend 注入 + resume”同样会累积
- `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
  - 注释已说明：Codex CLI 无 system prompt flag，因此通过 `effectivePrompt = systemPrompt + prompt` 实现
  - 当存在 `options.sessionId` 时走 `codex exec resume ... -- effectivePrompt`
  - 结果：**systemPrompt 被当作普通输入反复写入同一 thread session** → 同样线性膨胀

### 4.4 Gemini（Google）
- `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`
  - `gemini-cli` 路径基本是“每轮独立 prompt”（我们注释里也说明 `--resume` 不可靠，历史主要靠 prompt prepend）
  - `antigravity` 路径每次生成新 sessionId（不做 resume）
- 结论：Gemini **不一定表现为“越聊越胖”**，但仍可能因为“每轮重复注入长手册”造成 **每轮都很重** 的 token 浪费（尤其在 Codex/Gemini 需要 callback 手册注入时）。

### 4.5 “你的队友重复”根因：worklist/teammates 未去重
- `route-serial.ts` 里 `teammates = worklist.filter((id) => id !== catId)` 未做去重。
- worklist 允许 A→B→A ping-pong 再入队（设计上允许），因此 teammate 列表可能出现重复 catId，进而在 `buildInvocationContext()` 中重复渲染。

## 5. 修复方向（明天再做，先定方案边界）
> 目标：保留 cached/resume 的成本优势，但避免固定块重复进入同一 session；长说明改为渐进式披露。

### 5.1 Session-aware 注入策略（核心）
- **只在新 session（无 sessionId）注入静态身份/长手册**；`resume` 时不再注入（或仅注入短的、必要的动态块）。
- 需要一个“版本化”机制：
  - `systemPromptVersion` / `injectionVersion`（当规则升级时可强制重注入一次）
  - 在 `SessionChainStore` 或 `SessionManager` 侧存储（而不是依赖对话历史是否被压缩）

### 5.2 渐进式披露：把长手册从每轮 prompt 移走
- `McpPromptInjector.buildMcpCallbackInstructions()` 现状过长（~1.8k tokens）
- 建议拆分：
  - 常驻短提示（5–10 行）：只告诉“如何 @队友（行首）+ 有哪些 endpoint + 凭证变量名”
  - 全量手册：仅首次注入 / 或用户显式请求（例如输入 `#help callbacks`）
  - 文档落盘：将全量手册搬到 `docs/`，prompt 里只给路径引用（人类可点开，模型不需要每轮重复背诵）

### 5.3 teammates 去重 + 链路标识更可信
- `teammates` 在进入 `buildInvocationContext` 前做稳定去重（preserve order）
- “第 N/M”应反映“本轮实际参与的唯一猫集合”（至少不要被重复 catId 误导）

## 6. 验证方式（Red → Green 计划）
> 本次仅记录现状，修复与测试明天执行。

计划补充的回归测试（建议放在 `packages/api/test`）：
1. `claude-agent-service.test.js`
   - 当 `sessionId` 存在时，不应再传 `--append-system-prompt`
2. `codex-agent-service.test.js`
   - 当 `sessionId` 存在时，不应再 prepend `systemPrompt` 到 `effectivePrompt`
3. `route-strategies` / `system-prompt-builder` 相关
   - teammates 去重（同一个 catId 不应重复渲染）
4. `mcp-prompt-injector.test.js`
   - 短提示常驻，全量手册仅在“首次/显式请求”路径出现（需要设计一个开关或状态来源）

