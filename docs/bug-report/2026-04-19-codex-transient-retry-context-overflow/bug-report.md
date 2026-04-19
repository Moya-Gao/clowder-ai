---
topics: [codex, invoke-single-cat, retry, context-window]
doc_kind: bug-report
created: 2026-04-19
severity: P2
status: fixed
---

# Codex transient_cli_exit retry 把 session 里的 user turn 写两次

> 报告人：铲屎官（@codex thread 里观察到"一条消息被发了两次")
> 现场：`thread_mo56bnn88ifaaosf` + codex resume id `019da3cf-aaec-7a43-a0dc-8a8aec460feb`
> 联合调查：布偶猫(@opus-47) + 缅因猫(@codex)

## 1. 现象

铲屎官在 codex CLI 里打开被召唤的 codex 猫，看到同一条 user query 被连续写进 session 两次（逐字节一致），中间没有 assistant 回复。下游 resume 这条 session 时会把两份 user turn 一起塞进 context → 上下文爆炸。

## 2. 触发条件

1. Codex session 里已经积攒到接近 context window 上限
2. 新 user prompt 进去 → 模型 `last_agent_message: null`
3. Codex CLI emit stream_error:
   > "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying."
4. CLI exit code 1

## 3. 根因

`invoke-single-cat.ts` 的 `transient_cli_exit` self-heal 把 `CLI 异常退出 (code: 1, signal: none)` 一律视作可重试，对 **context window overflow** 这类"重试也救不回来"的错误无差别触发：

- `invoke-helpers.ts:68` `isTransientCliExitCode1` 只匹配退出码，不看流里的错误语义
- `invoke-single-cat.ts:1583-1591` + `:1732` 命中即 spawn 第二次 Codex CLI 进程
- 第二次 resume 同一 session → 再写一份同样的 user turn 进 rollout JSONL → 再次 overflow → 再次 exit 1
- 第二次错误才对外报（第一次被 suppress），所以 thread 只落一条 error，但 rollout 里有两份 user turn

## 4. 证据

`~/.codex/sessions/2026/04/18/rollout-2026-04-18T20-36-29-019da3cf-*.jsonl` 有两对重复：
- idx 227 ↔ 234（1012 字节一致）
- idx 241 ↔ 248（18258 字节一致）

每对时间线：
```
task_started (attempt 1)
turn_context + user message 写入
34s 模型运行 → last_agent_message: null
task_complete → CLI exit 1
↓ ~330ms
task_started (attempt 2, 新 CLI 进程)
turn_context + user message 写入（同样内容）
34s → null → exit 1
```

实测 `codex exec resume <big-session>` bootstrap 到 rollout 出现 `task_started` 约 **257ms**，与 330ms 吻合。

Thread 里对应的错误消息（`1776579744739`）：
> `Error: Codex CLI: CLI 异常退出 (code: 1, signal: none)`
> `最近流错误:`
> `- Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.`

## 5. 影响评估

- **用户可见**：Codex session 被污染，resume 会把 user turn 读两次
- **资源浪费**：每次 overflow 白跑 2×34s（~68s）+ 两轮 token 结算
- **严重度**：P2（不造成数据丢失，但污染 session + 浪费 API 额度 + 误导 resume 行为）

## 6. 修复方案

### Fix 1（本 bug 核心）：context overflow 错误归类为 non-transient

`isTransientCliExitCode1` 在退出码匹配基础上，额外检查 recent stream errors 是否包含 "ran out of room" / "context window" 关键字；匹配到则**不**视为 transient，不触发重试。

### Fix 2：retry 日志可观测

`invoke-single-cat.ts` 两个 retry 分支的 `log.info` 去掉 `catId === 'gemini'` 的 gate（当前 Codex/Claude 重试是静默的），并显式打 `attempt=1/2` + `retryReason`。便于下次现场一眼判断。

### 暂不做（更大范围）

- Preflight 检测 codex session 当前 tokens 后才 resume：需要扩 `contextSnapshotResolver` 的使用姿势，开独立 issue
- F167 `model_auto_compact_token_limit` 对 `exec resume` 不生效：同上，F167 owner 另查

## 7. 验证

- 单测（新增）：`isTransientCliExitCode1: context-overflow messages must NOT be treated as transient ...` —— 断言 helper 对 "ran out of room" / "context window" 返回 `false`，裸 `CLI 异常退出 (code: 1)` 仍返回 `true`
- 单测（新增）：`transient CLI self-heal: does NOT retry when Codex error carries context-window overflow ...` —— mock service 发带 "ran out of room" 的 CLI exit → 断言 `invokeCount === 1`（不重试）
- 回归：原有 `transient CLI self-heal: retries once when Claude exits code 1 before any stream output` 和 `... does not retry when stream already produced text` 仍绿
- 可观测性（Fix 2）：full test suite 日志显示 `catId:"opus"` / `catId:"codex"` 的 `retryReason` 字段现在都会打出来（原来只有 `gemini` 打，`opus/codex` 静默）
- 全量：`pnpm --filter @cat-cafe/api test` 之 `invoke-single-cat*` + `invoke-helpers*` 套件 123 个用例全绿
