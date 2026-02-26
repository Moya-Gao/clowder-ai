---
feature_ids: [F024]
topics: [prompts, gpt, pro]
doc_kind: note
created: 2026-02-13
---

# F24 调研委托 — GPT Pro 深度调研

> 委托人：布偶猫（Claude Opus）
> 日期：2026-02-13
> 用途：交给 GPT Pro 猫猫做技术可行性调研

---

## 背景：Cat Café 是什么

Cat Café 是一个让三只 AI 猫猫（Claude / Codex / Gemini）协作的系统。铲屎官（人类）通过一个 Web 前端和三只猫对话，后端通过 CLI 子进程调用各自的 Agent。

架构简图：

```
铲屎官 (浏览器)
    ↓ WebSocket + REST
Cat Café 后端 (Fastify + Node.js)
    ├── spawn('claude', ['-p', ..., '--output-format', 'stream-json'])  → 布偶猫
    ├── spawn('codex', ['exec', '--json', ...])                         → 缅因猫
    └── spawn('gemini', ['-p', ..., '-o', 'stream-json', '-y'])         → 暹罗猫
```

- 每只猫是一个 CLI 子进程，通过 stdout NDJSON 流输出事件（text_delta, tool_use, result 等）
- 后端解析 NDJSON 事件 → 通过 WebSocket 推送给前端
- stdin 当前设为 `'ignore'`（三猫都不接受运行时输入）
- 每只猫有 session/resume 机制，跨多轮调用保持上下文

## 问题：F24 — 中途消息注入 + Context 存活监控 + 自动交接

铲屎官提出了三个紧密关联的需求：

### 需求 1：中途消息注入

**场景**：铲屎官发了一个任务给布偶猫，布偶猫正在执行工具调用（比如写文件）。这时铲屎官想追加一句"别忘了也改那个测试文件"。目前做不到——必须等布偶猫整个调用完成后才能发新消息。

**期望**：类似 Claude Code 桌面版 / Codex app 的体验——猫猫在执行期间，铲屎官可以随时发消息，猫猫完成当前工具调用后立即收到。

### 需求 2：Context 存活监控

**场景**：猫猫执行长任务时，context window 会逐渐被填满。铲屎官想在前端 UI 上看到"当前 session 已用了 75% 的 context"这样的指标。

**各猫 context window 大小**：
- 布偶猫 (Claude Opus): ~200k tokens
- 缅因猫 (Codex/GPT): ~128k tokens（待确认具体模型的 window 大小）
- 暹罗猫 (Gemini): ~1M tokens

### 需求 3：自动交接触发

**场景**：铲屎官可能睡着了，猫猫的 context 快满了，自动压缩（auto-compact）会导致记忆丢失。铲屎官希望当 context 剩余 < 15% 时，系统自动注入一条消息让猫猫写交接文档 + commit，然后 `/compact`，再读交接文档，"满血复活"。

**流程**：检测阈值 → 注入"写交接"指令 → 猫猫写文档 + commit → /compact → 读交接 → 继续工作

---

## 我们已知的信息（初步调研）

### Claude CLI (`claude`)

| 能力 | 状态 | 细节 |
|------|------|------|
| 中途注入 | ✅ 可行 | `--input-format stream-json` 支持 stdin 持续写入 NDJSON 用户消息 |
| Context 监控 | ⚠️ 部分 | `result/success` 事件的 `modelUsage.*.contextWindow` 有窗口大小；`compact_boundary` 事件有 `pre_tokens`；但只在调用结束后才有数据 |
| 自动交接 | ⚠️ 部分 | `PreCompact` hook 在 auto-compact 前触发；可组合 stdin 注入 + hook |

**关键改造**：当前 stdin 设为 `'ignore'`，需改为 `'pipe'` + 加 `--input-format stream-json`。去掉 `-p prompt` 改为 stdin 发第一条消息。

**已知风险**：
- GitHub Issue #3187：stream-json 第二条消息 hang 住（已关闭/修复）
- GitHub Issue #5034：stream-json 输入下 session .jsonl 出现重复条目
- `session_id` 管理需要从 `system/init` 事件捕获真实 ID

### Codex CLI (`codex`)

| 能力 | 状态 | 细节 |
|------|------|------|
| 中途注入 | ❌ exec 不支持 | `codex exec --json` 是 one-shot 模式，stdin 被 ignore |
| 中途注入（替代） | ✅ app-server 支持 | `codex app-server` 有 JSON-RPC 协议，`turn/steer` 可以在活跃 turn 期间注入消息 |
| Context 监控 | ⚠️ 部分 | `turn.completed` 有 `usage.input_tokens`，但无 `model_context_window` |
| Context 监控（替代） | ✅ app-server | `thread/tokenUsage/updated` 通知含 `modelContextWindow` |
| 自动交接 | ⚠️ 轮间 | exec 模式只能在两次调用之间检测 token 使用，决定是否 resume |

**架构抉择**：是否从 `codex exec` 迁移到 `codex app-server`（stdio 或 WebSocket JSON-RPC）？这是架构级变更。

### Gemini CLI (`gemini`)

| 能力 | 状态 | 细节 |
|------|------|------|
| 中途注入 | ❌ 不可行 | `-p` 模式是 one-shot，stdin 不接受追加 |
| Context 监控 | ⚠️ 部分 | `stats` 有 `total_tokens`/`input_tokens`/`output_tokens`，但无 context window 百分比 |
| 自动交接 | ⚠️ 部分 | Gemini CLI 有内置 auto-compress（threshold=0.7），但事件不输出到 stream-json；`PreCompress` hook 可执行回调脚本 |

---

## 需要你帮忙深入调研的问题

### A. Claude CLI `--input-format stream-json` 实战细节

1. **消息格式的完整 schema**：除了 `{"type":"user","message":{"role":"user","content":"..."},"session_id":"..."}` 之外，还有哪些字段？`parent_tool_use_id` 是做什么的？什么时候需要设置它？
2. **在工具执行期间发消息会怎样**？消息是排队等工具完成后处理，还是会中断工具执行？Agent SDK 的 `queued messages` 机制具体是怎样的？
3. **session_id 管理**：第一条消息用什么 session_id？后续消息需要用 `system/init` 返回的真实 session_id 吗？如果 session_id 不匹配会怎样？
4. **`/compact` 能否通过 stdin 发送**？如果可以，`compact_boundary` 事件的完整格式是什么？`pre_tokens` 和 `post_tokens` 都有吗？
5. **`PreCompact` hook 的完整 input/output schema**？hook 能返回什么来影响压缩行为？能否阻止压缩？
6. **`Stop` hook**：能否在 hook 中检查 context 使用量并决定是否阻止停止？input 里有没有 token/context 信息？
7. **`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 环境变量**：取值范围？设为较低值（比如 70）是否安全？与 `PreCompact` hook 的触发顺序？

### B. Codex `app-server` 模式评估

1. **启动方式**：`codex app-server --listen stdio://` 还是 `codex app-server --listen ws://localhost:PORT`？哪种更适合作为子进程？
2. **JSON-RPC 协议完整文档**：`turn/steer`、`turn/start`、`turn/interrupt`、`thread/tokenUsage/updated` 的完整 request/response schema？
3. **从 exec 迁移到 app-server 的工作量评估**：需要改哪些层？session 管理、认证、输出解析等分别怎么变？
4. **app-server 的稳定性**：是否已经是 stable API？有没有 breaking change 的风险？
5. **app-server 与 exec 的性能差异**：长驻进程 vs 每次 spawn 的资源占用对比？
6. **`turn/steer` 的行为细节**：消息是排队还是立即处理？`expectedTurnId` 乐观锁失败时会怎样？

### C. Gemini CLI 的替代方案

1. **Gemini API 直接调用（不走 CLI）**：如果 CLI 能力不足，直接用 Gemini API + Tool Use 是否更灵活？延迟和成本差异？
2. **`PreCompress` hook 回调方案**：hook 脚本能否 `curl http://localhost:3002/api/...` 通知 Cat Cafe 后端？有没有执行环境限制（timeout、env vars、PATH）？
3. **Gemini 的 1M context window**：实际使用中 context 会在多少 token 时开始降质？有没有"安全区"的实测数据？
4. **Gemini CLI 交互模式 + pipe**：有没有办法用 `expect`/`pty` 模拟交互模式，绕过 one-shot 限制？

### D. 跨猫统一架构

1. **三猫 stdin 注入的统一接口设计**：Claude 原生支持、Codex 需要 app-server、Gemini 不支持——后端怎么设计一个统一的 `injectMessage(catId, message)` 接口？
2. **Token 监控的统一数据模型**：三猫的 token usage 字段不同（Claude 有 cache 分类、Codex 有 reasoning、Gemini 只有 total），怎么设计一个统一的 `ContextHealth` 类型？
3. **自动交接的统一策略**：三猫触发时机不同（Claude 可以主动注入、Codex 只能轮间、Gemini 只能事后），怎么设计一个统一的 `HandoffPolicy` 策略？

---

## 输出要求

请按以下结构输出调研结果：

```markdown
## A. Claude CLI stream-json 深入调研
（每个问题逐一回答，附代码示例和引用来源）

## B. Codex app-server 评估
（同上）

## C. Gemini 替代方案
（同上）

## D. 跨猫统一架构建议
（给出推荐的接口设计 + 类型定义 + 分期策略）

## E. 风险与未知
（调研中发现的新风险、无法确认的问题、需要实测验证的假设）

## F. 推荐实施路线图
（基于调研结果，建议的实施顺序和每阶段预期产出）
```

每个结论请标注信息来源（官方文档 URL、GitHub issue/PR、实测结果等），区分"已确认"和"推测"。

---

## 参考资料

- Claude CLI 文档: https://docs.anthropic.com/en/docs/claude-code
- Claude Agent SDK: https://docs.anthropic.com/en/docs/claude-code/sdk
- Codex CLI: https://github.com/openai/codex
- Gemini CLI: https://github.com/google-gemini/gemini-cli
- Cat Cafe 后端入口: `packages/api/src/domains/cats/services/`
- Cat Cafe CLI 子进程管理: `packages/api/src/utils/cli-spawn.ts`
- 当前三猫 Agent Service:
  - `ClaudeAgentService.ts` — Claude NDJSON 流解析
  - `CodexAgentService.ts` — Codex exec JSON 解析
  - `GeminiAgentService.ts` — Gemini 双 adapter (gemini-cli + antigravity)
