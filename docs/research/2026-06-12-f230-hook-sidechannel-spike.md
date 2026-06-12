---
feature_ids: [F230]
related_features: [F198, F210]
topics: [claude-code, pty, interactive, hook, transcript-regression, sidechannel, save-opus]
doc_kind: research
created: 2026-06-12
---

# F230 Hook Sidechannel Spike — 绕过 transcript 回归的金钥匙

> **Verdict: GO** ✅ | Owner: 宪宪 Fable-5 | 2026-06-12 | claude **2.1.175**（最新版，非 pin 2.1.170）

## 背景：transcript 回归 + 我自己的证据污染

- 2.1.172+ interactive TUI 不再把 assistant 回复写进 `~/.claude/projects/<slug>/<uuid>.jsonl`（只写 1 行 `ai-title` 元数据）。今日切干净复核：assistant 内容也不在 `sessions/`（仅 pid 元数据）、`history.jsonl`（仅 user 输入）、`memory/`（空）——**确实不落盘**。
- ⚠️ **证据污染自首**（[[feedback_evidence_slice_to_unique_coordinate]]）：此前我测 173/175 用路径 `versions/2.1.X/claude`，但 `versions/2.1.X` **本身就是可执行文件**（Mach-O），`/claude` 后缀不存在 → claude 根本没启动 → "不写 transcript" 部分是**假阴性**（claude 没跑）。用正确路径（直接 `versions/2.1.175`）重测，回归结论**依然成立**（切到内容层只有 ai-title），但教训记牢：版本目录结构 = 文件不是目录。

## 实验：Stop hook 作输出侧信道

`.claude/settings.json` 配 Stop hook → 脚本 dump stdin。2.1.175 正确路径起 + 干净 env（`unset CLAUDE_CODE_ENTRYPOINT CLAUDECODE`）+ 发 prompt `Reply with only: HOOK_SIDECHANNEL_TEST`。

**Stop hook stdin 实采（硬证据）**：
```json
{"session_id":"8ec45e66-bbce-44ea-9f41-9c0bed2e7148",
 "transcript_path":"...8ec45e66....jsonl",
 "cwd":"/private/tmp/f230-hook-spike","permission_mode":"default",
 "effort":{"level":"high"},"hook_event_name":"Stop","stop_hook_active":false,
 "last_assistant_message":"HOOK_SIDECHANNEL_TEST",
 "background_tasks":[],"session_crons":[]}
```
env：`CLAUDE_CODE_ENTRYPOINT=cli`（订阅安全）、`CLAUDE_CODE_SESSION_ID=8ec45e66...`。

## 为什么这是金钥匙（不是又一个 pin）

| 维度 | transcript-tail（现状） | hook-sidechannel（本 spike） |
|------|------------------------|------------------------------|
| 数据源 | claude 内部 transcript 写入行为 | **Anthropic 官方 hook 扩展点** |
| 版本依赖 | **死锁 pin 2.1.170**（170 写、172+ 不写、binary 被自动清理过） | **2.1.175 实证可用**，任何版本只要 hook 机制在 |
| 抗回归 | 上游改内部行为即失明（已发生） | 关 hook = 废整个 hook 生态，量级更稳 |
| 回复内容 | transcript jsonl（已被关） | `last_assistant_message` 直接喂 |
| session 接力 | cliSessionId from transcript | `session_id` 在 hook input |
| 计费 | entrypoint=cli | entrypoint=cli（同样订阅安全） |

**核心**：Anthropic 关了 transcript 写入，但 hook 的 `last_assistant_message` 还在喂回复内容。F210 方法论"进程是手、结构化侧信道是眼"——侧信道从"claude 的 transcript"换成"我们用官方 hook 制造的侧信道"，**摆脱 pin 旧版本的死锁**。

## 新架构（建议，待评估）

carrier 启动 interactive claude 时注入一个 `.claude/settings.json`（或 `--settings`）配 Stop hook（+ 可能 PostToolUse），hook 脚本把 `last_assistant_message` + `session_id` + 元数据写到 carrier 约定的 jsonl 侧信道文件 → 现有 `TranscriptTailer`/consumer 改 tail 这个文件。输出面消费层大部分可复用。

## 待验清单（实施前 spike，不阻塞 GO 结论）

1. **多轮**：第 2/3 轮 Stop hook 是否持续给 last_assistant_message（预期是，单轮已证机制在）
2. **tool_use 场景**：中间工具调用过程——Stop 只给最终 message，中间步骤是否需 PostToolUse hook（input 含 tool_response）补
3. **usage**：hook input 无 usage 字段 → 从哪拿（PostToolUse? 或降级，footer parity PR 在修）
4. **streaming**：last_assistant_message 是 turn 粒度整段（无逐 token）——但 transcript 路线本就无 streaming，不退化
5. **hook 注入隔离**：per-carrier settings 不污染用户全局 `.claude/settings.json`

## 结论

**GO**：hook-sidechannel 在最新版 claude 实证可拿回复内容 + session_id + cli entrypoint，**彻底绕过 transcript 回归、摆脱 pin 2.1.170 死锁**。这把 interactive 从"靠考古旧版本续命"升级成"靠官方扩展点长期可用"。pin 2.1.170 降级为短期兜底，hook 路线是终态。


---

## 5 待验项结论（2026-06-12 spike 续，claude 2.1.175，单 tmux session 3 轮）

| # | 待验 | 结论 | 证据 |
|---|------|------|------|
| 1 | 多轮连续性 | ✅ | 3 轮 Stop hook 全触发，`last_assistant_message`=OK/42/FILEDONE，**session_id 全同 `00d24fb4`**（多轮 + 接力天然成立）；轮2 答"42"=记忆连续 |
| 2 | tool_use 中间步骤 | ✅ **超预期** | 轮3 Read 文件 → PostToolUse hook 触发，给 `tool_name`/`tool_input`/**`tool_response`(有内容)**/`tool_use_id`/`duration_ms` → 中间工具步骤**完全可见且结构化**（比 transcript 解析更干净）；Stop 仍给最终 `FILEDONE` |
| 3 | usage 来源 | ⚠️ **唯一缺口** | Stop + PostToolUse input **均无 usage/token 字段**。处置：短期 footer cost 降级显示（不阻塞功能，B-min footer 本就后补）/ 中期探 SessionEnd hook 或别的侧信道 / 6-15 dev support 问 Anthropic |
| 4 | settings 注入隔离 | ✅ | hook 只在 `<cwd>/.claude/settings.json`，全局 `~/.claude/settings.json` 零污染 → per-carrier 隔离天然成立（carrier 给每个 PTY cwd 写独立 settings） |
| 5 | streaming | 整段（已知边界，不退化，同 transcript 路线） | — |

**最终新架构（实施纲要）**：carrier 启动 interactive claude 时，往该 cwd 写 `.claude/settings.json` 配 **Stop hook**（捕获 `last_assistant_message` = 回复全文）+ **PostToolUse hook**（捕获 `tool_name`/`tool_input`/`tool_response` = 工具步骤）→ 两个 hook 脚本把结构化 JSON append 到 carrier 约定的 sidecar jsonl → 现有 consumer 改 tail 这个 sidecar（`session_id` 多轮接力，`tool_use_id` 关联）。**解除 factory 的 2.1.170 pin fail-fast**（hook 任意版本可用，175 实证）。usage 短期降级。

**GO 确认**：5 项 4 绿 1 降级（usage 非阻塞）。hook-sidechannel 是 interactive carrier 终态，pin 2.1.170 退役为短期兜底。
