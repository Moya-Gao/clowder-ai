---
feature_ids: [F148, F193]
topics: [prompt, context, cross-thread, routing, briefing, incident]
doc_kind: bug-report
created: 2026-05-29
severity: P0
status: resolved (PR #1961 merged 2026-05-30, commit 8551f5a42)
related_features: [F148, F193, F192, F200]
---

# Incident Report: Cross-thread context contaminated PR #1942 merge thread

> 报告人：铲屎官  
> 调查猫：缅因猫/砚砚（@gpt52）  
> 当前线程：`thread_mp6b68w9w0wt1boc`  
> 外来线程：`thread_mpr44buzrj1m793o`  
> 事故窗口：2026-05-29 16:14 UTC - 16:37 UTC

## 1. 摘要

在 PR `#1942` 的 merge / cloud review 收尾线程里，当前 invocation 原本一直在做
F192 Phase F 的 merge-gate。随后当前线程里突然出现一段完全不属于本任务的闲聊
上下文，内容围绕：

- `R8`
- `披着专业外衣的不太光彩偏好`
- `@codex`
- 多猫 round-chat 传球

我随后错误地把这段外来上下文当成当前线程的有效 handoff，回了一条：

```text
最后一条明确写的是 @codex，不是 @gpt52。这球不在我这儿……
```

这不是单纯的“我读错了球”。现在已经有证据表明：**外线程内容确实进入了当前线程
后续 invocation 的 prompt**。

因此这是一次 **thread isolation / prompt integrity** 事故。虽然没有数据删改，但它
突破了“当前线程只应消费当前线程 live context”的边界，足以改变 agent 的下一步行为，
所以按 P0 记录。

## 2. 影响

- PR `#1942` merge-gate 流程被打断。
- 当前线程短时间偏离到无关话题，出现错误 A2A 路由。
- 当前线程的 prompt integrity 被破坏：非当前任务的上下文进入后续 prompt。
- 当前线程里的人类与猫都无法再仅凭聊天历史判断“这段上下文是不是本线程真球”。
- 截止本报告写入时，没有发现因此产生的错误代码提交或错误 merge。

## 3. 已确认的事实

### 3.1 产出污染消息的那次输入 prompt 是干净的

产出错误回复那次 invocation 的 prompt capture 是：

- `/Users/lysander/.cat-cafe/prompt-captures/payloads/4d99262b-3948-4ffc-b44d-12afb1966f26.json.gz`
  - `catId=gpt52`
  - `threadId=thread_mp6b68w9w0wt1boc`
  - 内容只有 PR `#1942` 的 review feedback
  - **不包含**
    - `披着专业外衣的不太光彩偏好`
    - `客观性瘾`
    - `你来接 R8`

这直接排除了“本次串台是由当前 invocation 自身 prompt 注入造成”的解释。

### 3.2 外线程内容确实进入了后续 prompt，但那是下游污染

后续 prompt capture 证明，污染内容后来确实进入了 prompt：

- `/Users/lysander/.cat-cafe/prompt-captures/payloads/331fce47-2c62-4fdb-b6ff-cfb3a0b9e46b.json.gz`
  - `catId=codex`
  - `threadId=thread_mp6b68w9w0wt1boc`
  - prompt 包含：
    - `Direct message from 缅因猫 GPT-5.4(gpt52)`
    - `披着专业外衣的不太光彩偏好`
    - `R8`
- `/Users/lysander/.cat-cafe/prompt-captures/payloads/5528a17a-c96a-448a-8f7c-57e4ea18caac.json.gz`
  - `catId=antig-opus`
  - `threadId=thread_mp6b68w9w0wt1boc`
  - 同样包含 `披着专业外衣的不太光彩偏好` 和 `R8`

所以“污染进入 prompt”是真的，但它是**我先把脏内容读进来之后**的继发扩散，不是
这次事故的最上游入口。

### 3.3 外来内容原本属于另一条 thread

Redis AOF 里可确认该 round-chat 内容属于：

- `thread_mpr44buzrj1m793o`

并且 AOF 中能看到该线程的原始内容，例如：

- `@codex ... "披着专业外衣的不太光彩偏好" ... R8`
- `47 这题点名问的是你`

所以这段内容并非“当前线程里早就有”，而是有明确外来源 thread。

### 3.4 不是 mid-invocation 插入，而是工具 output 被我读进来了

这次事故不是“同一个 invocation 跑到 80% 时，另一个 thread 的消息自己飞进来”。

时序更符合下面这条链：

1. 当前 merge thread 的 gpt52 会话里执行了 `ps -ax -o command=`
2. `ps` 输出里泄露了另一只并发 Codex 进程的 argv
3. argv 里明文带着另一条 thread 的完整 prompt / L0
4. 我把这段 `ps` 输出当成当前线程上下文读进去了
5. 随后产出了 `你来接 R8`
6. 这条混合消息又继续污染了后续 prompt capture

也就是说，这次最上游不是 prompt assembly 污染，而是 **process inspection →
argv leakage → model misread**

## 4. 代码证据

这次最关键的代码证据不在 recall/briefing，而在 Codex carrier：

1. `CodexAgentService` 会先把 `systemPrompt` 拼进 `prompt`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:381-383`

2. 然后把完整 prompt 作为 argv 位置参数传给 `codex exec`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:489`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:526`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:545`

3. L0 系统提示也通过 `--config developer_instructions=...` 进入 argv
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:367-372`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:520`
   - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:539`

因此，只要同机并发跑着别的 Codex invocation，任何能够读取进程命令行的诊断命令
（如 `ps -ax -o command=`，以及同类 `/proc/<pid>/cmdline` 读取）都有机会看到完整
prompt / L0 明文。

## 5. Redis / rollout / 运行面证据

### 5.1 session 没串台

两条 thread 对应的是独立 rollout / session：

- merge thread session：`019e71d6-...`
- round-chat thread session：`019e7482-...`

它们是两条不同的 Codex rollout 文件，不是同一 session 被复用。

### 5.2 真正把脏内容带进来的，是 `ps -ax -o command=` 的 tool output

在 merge thread 的 gpt52 rollout 里，可以看到：

- 先执行了 `ps -ax -o command=`
- 紧接着该 tool output 里命中了：
  - `客观性瘾`
  - `披着专业外衣的不太光彩偏好`
  - `47 这题点名问的是你`
  - `你来接 R8`
- 随后 assistant 产出了污染回复

这说明：

- 不是 `search_evidence` / `get_thread_context` 把外线程内容塞进了这次坏回复的输入 prompt
- 而是 `ps` 看到了另一只并发 Codex 进程的 argv，tool output 自己成了污染入口

### 5.3 为什么 output 会这么长

那条 `ps` output 的 token 量远超正常 20 多行进程列表该有的体量，和“普通进程名列表”
不符，却和“某些进程 argv 里嵌了完整 prompt / L0”完全一致。

## 6. 直接原因 vs 系统性根因

### 6.1 直接原因

我在 merge thread 里执行了 `ps -ax -o command=`，随后把输出中泄露出来的另一条 thread
prompt 内容，当成了当前线程上下文读进去了。

这解释了为什么我会回那条错误的 `@codex` / `你来接 R8` 消息。

### 6.2 系统性根因（已确认）

Codex CLI carrier 当前把：

- 完整 prompt
- 拼进去的 systemPrompt
- L0 `developer_instructions`

都暴露在 argv 中。只要本机有并发 Codex 进程，任何读取命令行的诊断命令都可能把这些
明文泄露出来。

换句话说，这次事故的系统性根因是：

**CLI argv prompt leakage**

而不是：

- 记忆组件主动 push
- recall 升格成 live task context
- thread/session transport 直接串台

### 6.3 当前已经确认到的结论

- **确认有污染**
- **确认不是 session 串台**
- **确认不是当前坏回复那次 invocation 的输入 prompt 被注入**
- **确认最上游入口是 `ps` 读到了并发 Codex 进程 argv 里的明文 prompt**
- **确认后续 prompt capture 中出现的 round-chat 内容，是这次错误回复之后的继发污染**

## 7. 排除项

以下解释现在可以排除：

1. **“只是我自己读错了”**
   - 不成立。prompt capture 已证明外线程内容真的进 prompt。

2. **“是别的 thread 直接 live 发消息过来”**
   - 目前无证据支持。现有证据支持的是本机进程 argv 泄漏，不是 live transport 自发串线。

3. **“是在同一个 invocation 中途突然插入的”**
   - 不像。坏回复前的污染入口是 `ps` tool output，不是 mid-invocation 注入。

4. **“是记忆组件自己主动塞给我”**
   - 不成立。正常设计里记忆/召回是 pull-only；这次直接入口已经被更精确地钉到
     `ps` 读取并发 Codex 进程 argv。

## 8. 为什么这是 P0

这次没有删数据，也没有误 merge，但它仍然是 P0，原因是：

- 它破坏的是 **thread isolation**
- 破坏后直接影响 agent 行为选择
- 破坏后人类与猫都可能把“外线程内容”误认成“当前线程真球”
- 如果不被打断，下一步可能继续产生错误 handoff、错误 review、错误 merge 决策

这是**完整性/隔离性事故**，不是普通的 P2 文案或 recall 误命中。

## 9. 立即处置

1. 暂停由 gpt52 继续推进 PR `#1942` merge，先保留事故现场与证据链。
2. 把本报告落盘并提交，避免 merge 后丢失调查上下文。
3. `#1942` merge 收尾转交其他猫，不再让当前受污染调查线程继续跑 gate。

## 10. 后续调查与修复建议

1. **修 carrier**
   - 不再把完整 prompt / systemPrompt / L0 放在 argv 明文里
   - 改走 stdin / 临时文件 / 其它不会被 `ps` 直接看到的 carrier

2. **补进程诊断护栏**
   - 对 `command_execution` 的结果摘要增加“进程列表 / argv 可能含 prompt 明文”的风险处理
   - 避免把包含完整别会话 prompt 的 `ps` 输出继续原样回流到模型上下文

3. **增加 regression test**
   - 模拟并发 Codex 进程 argv 含敏感 prompt 时，进程诊断路径不得把这些内容重新喂回当前猫

4. **保留下游调查**
   - 虽然本次最上游不是 recall/briefing，但后续 prompt 污染已经发生；仍应检查 route 层对这类
     tool output 是否有进一步隔离/降权机制

## 11. 当前结论

这次“上下文串了”不是幻觉，也不是记忆组件乱推送。

**已经确认的最上游根因是：并发 Codex 进程把完整 prompt/L0 暴露在 argv，
我在 merge thread 里跑 `ps -ax -o command=` 时把这段明文读进来了。**

我自己的错误，是把 `ps` output 里的外来 prompt 当成了当前线程上下文；系统的错误，
是 carrier 设计允许 prompt/L0 以 argv 明文形式被本机进程检查命令直接泄露。

本事故的 owner 后续应以 **carrier 修复** 为主线，而不是再把主要精力放在 recall /
briefing 路由上。

[砚砚/gpt-5.4🐾]

---

## 12. opus-48 forensic 复核结论（2026-05-29，布偶猫接力调查）

### 12.1 一句话结论

确认 P0，但**根因不是 thread/session 串台，也不是 recall/briefing/message 投递污染**。真相是：

> **codex CLI 把完整 prompt（user prompt + L0 system prompt）作为命令行参数（argv）传给 `codex exec`。gpt52 在 merge thread 排查卡死的 merge-gate 进程时执行 `ps -ax -o command=`，ps 输出捕获了并发的 round-chat（`thread_mpr44`）codex 进程的明文 argv，gpt52 把这段 ps 结果当作当前线程上下文读入，产出了 "你来接 R8" 串台消息并持久化进 `thread_mp6b68`。**

这是一次**经进程命令行的明文 prompt 泄露**。"串台"只是它的可见症状；本质是**机密性漏洞**（thread isolation 失守是结果，不是原因）。

### 12.2 完整证据链（数据层 AOF/rollout + 代码层）

1. **污染落点**：codex@mp6b68 invocation（capture `331fce47`）的 `[对话历史增量]` line 279 含 round-chat「披着专业外衣 / 你来接 R8」。
2. **数据层持久化**：msg `0001780071280318-000481`（catId=gpt52, threadId=thread_mp6b68, origin=stream, content 6635B）混入 R8，真实写入 `thread_mp6b68` 并进 thread 索引（AOF `cat-cafe:msg:thread:thread_mp6b68w9w0wt1boc`）。→ 不是 codex 本轮临时组装错误。
3. **原始来源**：round-chat R7「客观性瘾 / 披着专业外衣」属 `thread_mpr44`、发送者 **opus-47**（AOF offset 113264088，threadId=thread_mpr44）。
4. **关键反转——input 是干净的**：产出 0481 的 invocation `e7754f55`（gpt52@mp6b68, 16:14:40, `isResume=true, injected=false`）captured userPrompt 仅 1480B，是干净的 PR#1942 Review Feedback，**零 round-chat**。`019e71d6` rollout 的 user 输入时间线确认：16:14:52 input 干净；round-chat 作为 input 首次进来是 **16:34:30**（晚于污染 assistant message 16:25:45，是扩散不是源头）。→ **排除 prompt 组装 / recall / 投递污染**。
5. **session 映射隔离正确**：`cat-cafe:sessions:default-user:gpt52:thread_mp6b68`→`019e71d6`，`...:thread_mpr44`→`019e7482`，是**不同 sessionId / 不同 codex rollout 文件**。→ 排除 session 复用/映射 bug。
6. **注入点——ps 捕获 argv**：gpt52@mp6b68 的 codex rollout（`019e71d6`）L4740 在 16:25:22 执行 `ps -ax -o pid=,ppid=,etime=,command= | rg "...pre-merge-check|next build|pnpm..."`（排查卡死的 gate 进程）；L4742 的 `function_call_output`（被工具从 58810 tokens 截断到 5000）里，ps 输出含某并发 codex 进程 argv 的完整 round-chat `[对话历史]`（R6 sonnet / R7 opus-47 / 传 @codex 接 R8）。16:25:45 gpt52 据此产出 "你来接 R8"（= 0481 污染结尾）。
7. **代码落点**：`packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
   - L520/539：`developerInstructionsArgs`（L0 system prompt）走 `--config developer_instructions="..."` → argv
   - L526/545：`promptArgs`（user prompt，含 `[对话历史]`）走位置参数 → argv
   - L617-634：`spawnCli({ command, args })` 直接把上述作为进程命令行 → `ps -o command=` / `/proc/<pid>/cmdline` 全部明文可见。

### 12.3 为什么比"串台"更严重（机密性升级）

泄露面 = **任何能读进程命令行的主体**：任何猫的任何 invocation（只要它跑 `ps` / 读 `/proc`，如本次 merge-gate 排查）、任何本地进程、多用户/多租户场景下的其他用户。能看到所有并发 codex 进程的：**完整 L0 system prompt + 完整 user prompt（含 `[对话历史]` = 跨 thread / 跨 cat / 跨 user 的对话内容）**。本次只是 gpt52 偶然 `ps` 撞上 round-chat 并"接了球"，所以表现为串台；泄露本身是无差别、被动、持续的。

### 12.4 修复方案（已验证 codex CLI 支持）

`codex exec --help`：`[PROMPT]` 不传位置参数（或用 `-`）时**从 stdin 读取**。
1. **P0 立即**：`promptArgs` 改走 **stdin**（位置参数用 `-` 或省略 + 写 stdin），不放 argv。这是用户对话 / 跨 thread 内容泄露的根因，codex 原生支持，改动局部（`CodexAgentService` spawn + `cli-spawn` 写 stdin）。
2. **P1 跟进**：`developer_instructions`（L0）改走 **config 文件 / `-p profile`**（`$CODEX_HOME/<name>.config.toml`），不走 `-c` argv。
3. **回归测试**：spawn 时断言 `args` 数组不含 prompt 正文 / L0 正文；构造"并发进程跑 ps"场景验证对话内容不暴露。
4. 注：cwd/HOME 已隔离，但命令行可见性是 **OS 级**——stdin/file 是唯一根治，env 不行（`/proc/<pid>/environ` 同样可读）。

### 12.5 对砚砚 §1-11 的校正

- ✅ 砚砚对的：污染真实、不是 mid-invocation 插入、是「上一轮产生→下一轮带入」链条、立即保留 prompt-capture + AOF 证据并冻结 PR#1942 的动作非常专业。
- ❌ 砚砚的入口假设（`search_evidence` / `get_thread_context` / `threadMemorySummary` / `briefingContext` / cross-thread relay）**均非根因**——这些通道本次都没污染。真正入口是 **gpt52 自己 turn 内调用的 `ps` 工具 output**，外线程内容来自**并发进程的 argv**，不在 Cat Café 的任何 prompt 组装 / recall 字段里。
- 这解释了为什么砚砚查 prompt assembly 链钉不死入口：污染根本不在 Cat Café 的组装层，而在 **codex CLI 的进程调用层（argv）** + gpt52 turn 内的 `ps` 调用。

[宪宪/Opus-4.8🐾]

---

## 13. 修复落地（PR #1961，merged 2026-05-30，commit `8551f5a42`）

opus-48 实现 → opus-46 本地 review APPROVE → 云端 codex review **4 轮**收敛 → squash merge。

**核心修复**：codex prompt 不再走 argv，改走 stdin（`promptArgs = ['--', '-']`，codex 从 stdin 读 PROMPT），覆盖**全部 3 个 spawn carrier**：

| carrier | 路径 | 修复 |
|---------|------|------|
| `spawnCli` direct | 生产 runtime（部分）/ Windows | 写 `child.stdin`（cli-spawn.ts） |
| `cli-supervisor` | 生产 runtime（macOS 包装） | 转发 `process.stdin → child.stdin`（cli-supervisor.ts） |
| tmux pane | worktree 开发 | prompt 写 0600 临时文件 + `< $STDIN_FILE` 重定向（tmux-agent-spawner.ts） |

**云端 codex 4 轮 review 链**（每轮抓出本地 review + dogfood 都看不到的真 P1）：
1. **P1 #1**：supervisor 以 `stdio:['ignore']` 启动 codex 且不转发 stdin → 生产 codex 收 EOF（空 prompt）
2. **P1 #2**：tmux `buildPaneCommand` 只发 command+args 不喂 stdin → worktree codex `-- -` 在 pane 等 EOF → hang
3. **P1 #3**：tmux stdin 临时文件写在主 try/finally 前，setup 失败时含对话历史的明文文件遗留磁盘 → 机密性泄露
4. **第 4 轮**：0 P1/P2，"no major issues" 收敛

**根因为何本地全绿却漏**：mock 测试用 fake spawnFn 绕过 supervisor/tmux；首轮 dogfood 直接跑 `codex exec` 也绕过中间层 —— 生产 carrier 路径是双重盲区，云端静态分析逐个抓出。

**lessons**（见 `docs/lessons-learned.md` LL-063）：dogfood 要走**真实生产路径**（不绕过 carrier 中间层）；全局调用契约改变（argv→stdin）需**审计所有 spawn carrier**，不逐个被 review 抓。

[宪宪/Opus-4.8🐾]
