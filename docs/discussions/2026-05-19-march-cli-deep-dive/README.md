---
doc_kind: discussion
topics: [march-cli, agent-cli, memory-system, context-management, open-source-teardown]
created: 2026-05-19
status: draft
source_repo: https://github.com/liuzhengdongfortest/march-cli
source_commit: 4043909cbda660aa4f7c282850a061ada02b7091
authored_by: opus-46
covers: [architecture, star-features, algorithms, comparison]
---

# March-CLI Deep Dive

## 0. Scope

- **User question**: 铲屎官同事刘政东的 agent CLI 项目，PK Claude Code / Codex / Hermes Agent
- **Project**: march-cli — 终端原生 coding agent + 多 agent 群聊编排
- **Source repo**: `https://github.com/liuzhengdongfortest/march-cli`
- **Local path**: `/Users/lysander/projects/ref/march-cli`
- **Commit**: `4043909` (Release 0.1.21, 2026-05-19)
- **File count**: 758 tracked files (含 ~30 vendored Claude Code system prompts)
- **Tech stack**: Node.js ESM, SQLite WAL, SSE, Pi SDK (`@mariozechner/pi-coding-agent`)
- **Author context**: 铲屎官同事，非竞品关系，属于 agent CLI 同行交流

### Claims to Verify (from 铲屎官转述)

1. "中间工具执行的输出修剪掉，只保留简单的历史"
2. "下次发消息的时候重建一下上下文"
3. "只会掉中间这段执行过程的 cache，之前的 cache 不会掉"
4. "记忆的结构有 name、description 和 tags"
5. "匹配源就是模型调用过程中的碎碎念（Thinking）和用户的话"
6. "关键字匹配就很够用了"
7. "memory_hint 每次最多 3 条记忆，且在轮内去重"
8. "有点像一个动态的技能发现系统"
9. "经验落盘我的记忆系统承接了，它会自动总结经验的"
10. "让他去看一下 git 的历史，是能总结出来的"

## 1. Claims Ledger

| # | Claim | Evidence paths | Verdict | Caveat |
|---|-------|----------------|---------|--------|
| 1 | 工具输出修剪 | `turn-events.mjs:75-82` `compactAssistantContext()` — 合并 thinking/output/tool parts，清理多余空白 | **✅ 实锤** | 不是截断，是 compact：保留 tool start/summary，去掉 tool 原始输出细节 |
| 2 | 每轮重建上下文 | `turn-runner.mjs:60` `resetPiMessageHistory()` 清空 Pi 的 messages 数组；`engine.mjs:38-50` `buildProviderContext()` 从 layers 重建 | **✅ 实锤** | 默认 `contextMode="rebuild"`；abort 后切 `continueExistingPiTranscript` 保留现场 |
| 3 | 只丢中间 cache | 重建时 system_core/injections/session_identity 这些前缀层不变（prefix-cache friendly），只有 recent_chat 层的 compacted turns 变了 | **✅ 设计意图正确** | Pi/provider 侧是否真的命中 prefix cache 取决于 API 实现，March 侧的层排列是有意为之 |
| 4 | 记忆 = name+description+tags | `markdown-store.mjs:66-77` entry 结构: `{id, path, name, description, tags, status, createdAt, updatedAt, mtimeMs, size}` | **✅ 实锤** | 还有 id、status、时间戳、文件元数据 |
| 5 | 匹配源 = Thinking + 用户输入 | `turn-runner.mjs:148-168` `flushAssistantRecall()` 从 `turnState.draft`（输出）+ `thinkingText`（思考）提取 delta；`repl-loop` 对用户输入调 `recallForUser()` | **✅ 实锤** | 助手侧同时看 draft 和 thinking，不只是 thinking |
| 6 | 关键字匹配够用 | `markdown-store.mjs:236-244` `#extractKnownTagTerms()` 从文本提取已知 tag 子串；`markdown-recall.mjs` `scoreEntry()` 精确 tag +10，部分 tag +5 | **✅ 实锤** | 无语义/向量搜索；全靠 tag 字典交集匹配，简单但有效 |
| 7 | 最多 3 条 + 轮内去重 | `markdown-store.mjs:125` `recallForUser(limit=3)`；`markdown-store.mjs:134` `recallForAssistant(limit=2)`；`turnSeenMemoryIds` Set 做轮内去重 | **✅ 实锤** | 用户侧 3 条，助手侧 2 条，共享 seen set |
| 8 | 像动态技能发现 | memory_hint 在每次 tool_execution_start 时注入（mid-turn），根据 thinking 文本动态触发 | **✅ 比喻准确** | 不是 skill discovery 机制，但 memory hint 的行为模式确实类似：上下文触发 → 相关知识浮现 |
| 9 | 自动总结经验 | `base.md:64` system prompt: "If execution takes a meaningful detour, create or update a memory after the task" + `memory_save` tool 可用 | **⚠️ 半真** | 是 **prompt 指令** 让模型自行判断是否保存，不是代码级自动触发；模型可能忘记执行 |
| 10 | 看 git 历史能总结 | `command_exec` tool 可执行 `git log` 等命令 | **✅ 能力具备** | 需要用户主动指示，不会自动扫 git history |

## 2. Architecture Map

→ 详见 [architecture-map.md](architecture-map.md)

## 3. Star Features (本轮概述，深挖待续)

### 3.1 Context Rebuild Engine
每轮重建上下文而非流式续写。6 层 context layers（system_core → injections → session_identity → project_context → profiles → recent_chat），前缀层稳定利于 provider prefix cache。turn history 保留 15 轮、trim 5 轮批量。

### 3.2 Markdown Memory + Tag Recall
Markdown 文件 + frontmatter 元数据 + FTS5 索引。recall 靠 tag 字典交集匹配。mid-turn 注入（tool_execution_start 时刻）+ end-of-turn flush。thinking 文本作为 recall query source。

### 3.3 Group Chat Orchestrator (MVP)
多 agent 群聊编排：SQLite 状态 + SSE 实时推送 + Pi SDK 执行。agent 各自 git worktree 隔离。subscription connectors（GitHub/GitLab/Sentry）轮询外部事件。alarm 系统定时触发。

### 3.4 Pi SDK Delegation
执行层完全委托给 Pi SDK (`@mariozechner/pi-coding-agent`)。March 只管 state + context + memory，Pi 管 LLM 调用 + tool 执行。

## 4-6. 深挖/算法/对比

→ 待第二轮产出。

## 7. 初步印象 (Lessons 待确认)

**值得学的**:
1. **Thinking 文本作为 recall query** — 比只用用户输入更精准，因为 thinking 暴露了 agent 的真实意图
2. **每轮重建上下文** — 成本控制策略，与我们的压缩策略互补
3. **Compact 而非截断** — 保留 tool 调用骨架，去掉输出细节，比粗暴 truncate 信息保留更好
4. **轮内 memory 去重** — 简单 Set，避免同一条 memory 在一轮内反复浮现

**不跟的**:
1. **纯 tag 匹配** — 我们的 BM25+vector hybrid 严格更强，支持跨语言和语义近义
2. **自动经验 = prompt 指令** — 我们的 knowledge feed + self-evolution 是结构化流程，不依赖模型自觉
3. **Pi SDK 强绑定** — 我们是 Claude 原生 + MCP-first，provider delegation 层不适用
4. **Vanilla JS 前端** — 已有 React

**对标定位**:
- march-cli 的 CLI 层 ≈ 轻量版 Claude Code（工具集相似，记忆更轻量）
- march-cli 的 Group Chat 层 ≈ Cat Café 的 A2A thread 协作（但用群聊而非 @传球）
- 相比 Hermes：march-cli 更聚焦 coding + 记忆，Hermes 更聚焦 skill 市场 + RL pipeline + 多平台 gateway
