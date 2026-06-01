---
doc_kind: research-note
topics: [costrict, opencode, open-source-teardown, harness, competitive-update]
created: 2026-06-01
status: draft
source_repos:
  - https://github.com/zgsm-ai/costrict
  - https://github.com/zgsm-sangfor/opencode
baseline:
  costrict: f9282f5b073079b7f61719ba4163ad7089050cd8
  costrict_opencode: cb0dd02475d399beaadfc532bebe39fcc78e2365
latest_checked:
  costrict: f3365eeaaa24e13cd03c6f91469e149437b986ee
  costrict_opencode: a686e932fd0ea8dbe44dffbfec29e0934752bcbf
related:
  - docs/discussions/2026-04-29-costrict-opencode-deep-dive/README.md
  - docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md
---

# CoStrict 一个月代码增量复盘（2026-04-29 → 2026-06-01）

## 0. TL;DR

这一个月他们**不是在公开仓里证明“GLM-4.7 达到 Claude Code + Opus 85%”**，也不是在补 TeamAct/A2A；公开代码显示的主线是：

1. **VS Code 主仓小步迭代**：`2.7.7 → 2.8.2`，15 个 commit，主要是模型目录、UA/agent-type header、commit message multi-root、code review UI、发布/文档。
2. **CLI/opencode fork 大规模产品化**：`3.0.30-ish → 3.0.35+`，379 个文件变化，主力在 `app-ai-native`：移动端 workspace、store/capability 分发、console/usage/quota/identity/notification、kanban V2、workspace/device 管理。
3. **运行时闭环有实质修复**：MCP lazy init、permission duplicate reply hard error、snapshot revert batch、revert+compact test、tool init wrapper 防堆叠、OpenAI-compatible tool-call loop 修复、`/compact` 命令、gpt-5.5 Codex context cap。
4. **代码审查能力变成“外部 review skill 包”路线**：新增 `generate-review-builtin.ts`，从 `zgsm-ai/costrict-review` 拉 review/security-review skills，构建时打包，运行时按版本/locale 提取到 `~/.config/costrict/skills`。
5. **4 月发现的 gap 还在**：主仓 `codebase_search` 仍有 prompt/tool wrapper，但执行 import 仍注释；公开仓仍无 85% benchmark 任务集、原始结果或可复现实验。

结论：**他们这月很忙，但忙点偏产品化 + 企业平台 + 运行时稳定性；弱模型 harness 的新增公开证据不多。** 如果只问“有没有真东西”，有；如果问“有没有证明 85%”，没有。

## 1. 本次检查范围

| Repo | 4/29 baseline | 6/1 latest checked | 增量 |
|------|---------------|--------------------|------|
| `zgsm-ai/costrict` | `f9282f5` (`2026-04-28`, v2.7.7) | `f3365ee` (`2026-05-22`, `v2.8.2-2`) | 15 commits, 21 files, +210/-108 |
| `zgsm-sangfor/opencode` | `cb0dd02` (`2026-04-29`) | `a686e93` (`2026-05-29`, `3.0.35-139`) | 379 files, +27,363/-30,027 |

注意：`opencode` fork 的 diff 很大，因为 `dev` 分支持续合并 upstream opencode 和自家产品分支；下面只列与 CoStrict 方向相关的增量。

## 2. 主仓 `zgsm-ai/costrict`：小步版本迭代

### 2.1 模型目录更新

证据：

- `packages/types/src/providers/deepseek.ts`
- `packages/types/src/providers/moonshot.ts`
- `packages/types/src/providers/fireworks.ts`
- `packages/types/src/providers/openai-codex.ts`
- commit `3714f72 feat(types): add deepseek v4, kimi k2.6, and update codex gpt-5.5 defaults (#1163)`

变化：

- 加 `deepseek-v4-pro` / `deepseek-v4-flash`，1M context，384K max output。
- 加 `kimi-k2.6` / Fireworks `kimi-k2p6`。
- OpenAI Codex 默认模型从 `gpt-5.3-codex` 改成 `gpt-5.5`，并把 `gpt-5.5` context 写成 `1,000,000`、reasoning effort 默认 `medium`。

判断：这是 provider catalog 更新，不是新 harness。它说明他们在跟新模型，但没有带 eval。

### 2.2 Provider 请求头和 DeepSeek V4 适配

证据：

- `src/api/providers/costrict.ts`
- `src/api/providers/openai.ts`
- commit `20f9a1a` / `3714f72`

变化：

- `modelId.includes("deepseek-v4")` 进入 deepseekReasoner 逻辑。
- CoStrict provider 请求头加：
  - `User-Agent: RooCode/3.52.1 plugin_intellij|plugin_vscode/<version>`
  - `agent-type: metadata.mode`

判断：这是服务端侧分流/灰度/统计的基础设施。对企业平台有用；对弱模型能力提升本身不是核心证据。

### 2.3 Commit message multi-root 修复

证据：

- `src/activate/registerCommands.ts`
- `src/core/costrict/commit/index.ts`
- commit `4518f56 fix: support commit message generation in multi-root workspaces (#1210)`

变化：

- 从 VS Code SCM `rootUri.fsPath` 取 repo root。
- 不再复用 singleton `CommitService`，每次按 workspace root 新建，避免 multi-root workspace 下串 repo。

判断：现实闭环修复。小但正确，属于“工作区状态必须来自真实 SCM context”的 Built to Persist。

### 2.4 Code review UI 优先级

证据：

- `src/package.json`
- commit `b4dc38c feat(code-review): promote AI suggestion button to primary position in review comments (#1212)`

变化：

- review comment thread title 菜单里把 `costrict.askReviewSuggestionWithAI` 提到第一位，`acceptIssue` 不再是 primary。

判断：产品转向：鼓励用户先问 AI 怎么修 review comment。不是 review harness 质量证明。

### 2.5 主仓未变的关键 gap

证据：

- `src/core/prompts/tools/native-tools/index.ts` 仍注释 `codebase_search` import / case。
- `src/core/assistant-message/presentAssistantMessage.ts` 仍注释 `codebaseSearchTool` import/handle。
- `src/core/tools/CodebaseSearchTool.ts` 和 `src/services/code-index/**` 仍存在。

判断：RAG/codebase_search 还是“基础设施在，运行时暴露没完全接通”。4 月的 claim ledger gap 仍成立。

## 3. CLI/opencode fork：产品化和运行时稳定性是主线

### 3.1 Native app / cloud console 产品化

证据：

- `packages/app-ai-native/src/routes.tsx`
- `packages/app-ai-native/src/pages/workspace/**`
- `packages/app-ai-native/src/pages/store/**`
- `packages/app-ai-native/src/pages/console/**`
- `packages/app-ai-native/src/pages/kanban/**`

新增/强化的产品面：

- `/m/workspace`：移动端 workspace 列表、详情、会话管理。
- `/m/store`：移动端 store detail。
- `/console/usage`：quota/usage 统计页，读 `/quota-manager/api/v1/quota` 和 `/quota-manager/api/v1/usage/statistics`。
- `/console/identity`、notification channels、WeCom app/card。
- store capability 分发/订阅、plugin 展示、health radar。
- kanban V2：Need/日历/工作量/commit metrics。

判断：这不是“coding agent harness”本身，而是把 CoStrict 往企业平台/云端管理面推。对商业化重要，对 85% claim 无直接支撑。

### 3.2 Review/security-review 变成外部 skill 包

证据：

- `packages/opencode/script/generate-review-builtin.ts`
- `packages/opencode/src/costrict/review/extension.ts`
- `packages/opencode/src/costrict/review/index.ts`
- `packages/opencode/src/command/index.ts`
- commits: `f37ffcf98`, `6b7eaa4ff`, `fadd2d6b1`, `0c287cb83`

机制：

- 构建时通过 SSH clone `git@github.com:zgsm-ai/costrict-review.git`。
- 读取 `index.json`，按 locale 把 review/security-review skill 文件复制进 `bundled-review/<locale>/skills/...`。
- 生成 `src/costrict/review/skill/builtin.ts`。
- 运行时首次/版本变更时提取到 `~/.config/costrict/skills/<name>`，用 `.version` 记录 `commitSha:locale`。
- `/review` 命令模板改为从 `CostrictCommand.get("review", lang)` 取 locale 文案。

判断：

- 这是实质架构变化：review 能力从“内置 prompt/agent”转向“可版本化 skill 包”。
- 但公开主仓看不到 `costrict-review` 的实际内容；这让 review 能力的 claim 变成外部依赖，不再完全可审计。

### 3.3 `/compact` 和 compaction/续接

证据：

- `packages/opencode/src/session/compaction.ts`
- `packages/opencode/src/session/prompt.ts`
- `docs/csc-compaction-adaptation.md`
- `packages/opencode/test/session/revert-compact.test.ts`
- commit `988b48743 feat(prompt): add /compact slash command with auto-submit`
- upstream-related `eb1e3ae33 fix(session): compaction agent responds in same language as conversation (#20581)`

变化：

- `/compact` 作为 slash command 进入 prompt/input。
- compaction summary 要求使用和用户对话相同语言。
- 修了 provider 返回 `stop` 但 assistant message 里已有 tool calls 时循环提前退出的问题。
- 补了 revert + compact 工作流测试。
- 单独写了 csc compaction 事件适配方案，关注 SSE 事件序列、summary role、续接消息。

判断：这是比较实在的 context/reality-loop work。强模型也需要 compaction 和续接事件正确，这是 Built to Persist。

### 3.4 Snapshot / revert 可靠性

证据：

- `packages/opencode/src/snapshot/index.ts`
- `packages/opencode/src/session/revert.ts`
- `packages/opencode/test/snapshot/snapshot.test.ts`
- `packages/opencode/test/session/revert-compact.test.ts`

变化：

- snapshot revert 从逐文件 checkout 改为按 hash 分批，但避免父子路径冲突。
- 文件不存在于 snapshot 时删除；存在但 checkout 失败时保留。
- revert state 有 snapshot 时先 restore，再 revert patches。

判断：这是 1.3 右列的现实闭环资产：副作用回滚、恢复正确性。比“提醒模型别改错”更有价值。

### 3.5 MCP / permission / tool loop 稳定性

证据：

- `packages/opencode/src/mcp/index.ts`
- `packages/opencode/src/permission/index.ts`
- `packages/opencode/src/permission/next.ts`
- `packages/opencode/src/tool/tool.ts`
- `packages/opencode/test/tool/tool-define.test.ts`
- `packages/opencode/src/tool/webfetch.ts`
- `packages/opencode/src/provider/transform.ts`

变化：

- MCP 初始化从启动时 auto-connect 改为 lazy connect，避免启动被 MCP 卡住。
- permission reply 找不到 pending request 时抛 `NotFoundError`，不再静默返回。
- `Tool.define()` 防止 object-defined tool 多次 init 后 wrapper 层层堆叠，测试里模拟 100 次 init。
- `webfetch` 在 fetch 抛错时也 clear timeout。
- Azure provider options 同时传 `openai` 和 `azure` key，适配不同 SDK code path。

判断：这些是生产坑修复，价值高于 prompt 补丁。尤其 MCP lazy init 和 permission hard error，都是把“虚假成功/启动卡死”变成可诊断状态。

### 3.6 Codex / GPT-5.5 适配

证据：

- `packages/opencode/src/plugin/codex.ts`
- commit `481c9ceb8 fix: ensure gpt-5.5 compacts at correct context size when using openai oauth (#24212)`

变化：

- OpenAI OAuth / Codex plugin 下，`gpt-5.5` 临时限制 context/input/output 为 `400K / 272K / 128K`。

判断：这是具体 provider quirk / plan 限制适配。短期有用，长期偏 Build to Delete。

## 4. 4 月问题的复核

| 4 月判断 | 6 月复核 |
|----------|----------|
| “不是空壳，有真实工程” | 更强确认。尤其产品化、snapshot/revert、MCP、permission、compaction 都在继续推进。 |
| “多 agent 不等于 TeamAct/A2A” | 仍成立。新增 review skill 包和 session/task UI，不等于 owner/action/evidence/verdict/route。 |
| “RAG/codebase_search 形态在但 runtime 暴露存疑” | 仍成立。主仓 codebase_search 执行链仍有注释点。 |
| “85% Claude Code + Opus 未公开证明” | 仍成立。未见公开 benchmark 任务集、配置、raw results。 |
| “多数弱模型补丁是 Build to Delete” | 仍成立。新增主要不是 GLM weak-model 算法，而是运行时/产品闭环。 |

## 5. 更新后的判断

### 我给他们这一个月的评价

- **执行强度**：高。opencode fork 变动很大，明显在做平台化交付。
- **harness 质量增量**：中等偏高。不是模型聪明度提升，而是 reality-loop 稳定性修复：MCP、permission、snapshot、compaction、tool wrapper。
- **弱模型专项增量**：低到中。主仓只是模型目录/DeepSeek V4 reasoner/header；没看到新的 GLM-4.7 级别 quirk 深挖。
- **商业产品化增量**：高。Cloud、console、quota、usage、mobile、store、kanban 都在铺。
- **公开可审计性**：下降一点。review skill 内容转到外部 `costrict-review`，主仓只见打包器和运行时提取逻辑，看不到真实 review prompt/skill 质量。

### 一句话

**他们这月干的是“把 coding agent 变成企业协同/云端产品”，不是“公开证明弱模型达到 Opus 85%”。**

这不等于吹牛，但也不等于 claim 成立。公开代码能证明他们在做认真工程，不能证明 benchmark 数字。

## 6. 我们值得学 / 不该学

值得学：

1. MCP lazy init：启动不该被外部工具卡住，但要保证状态可诊断。
2. permission missing reply 抛 hard error：避免“用户以为点了，系统悄悄吞了”。
3. snapshot revert batch + parent/child path clash 检查：回滚机制要为大改动性能负责。
4. review skill 包版本化：能力包升级路径清晰，但我们要保持内容可审计。
5. `/compact` 事件序列设计：压缩不是只生成摘要，还要保证前端事件、会话续接、role 语义一致。

不该学：

1. 把 review 核心能力放到不可审计外部仓后继续在主仓强 claim。
2. 用产品面增长替代 benchmark 证明。
3. 把 provider/model catalog 更新包装成 harness 能力提升。
4. 让 dead/half-wired codebase_search 继续出现在宣传链路里。

## 7. 后续如果要继续深挖

优先级：

1. **`costrict-review` 仓**：如果公开/可访问，拆 review/security-review skill 内容，判断是否真有代码审查方法论。
2. **compaction 端到端**：从 `/compact` 命令到 SSE 到续接消息，验证是否真正可用。
3. **MCP lazy init 行为**：看“延迟连接”有没有把启动快变成首次工具调用慢/失败晚暴露。
4. **benchmark 追问清单**：任务集、model config、harness version、baseline Claude Code + Opus version、raw per-task result。

— [砚砚/GPT-5.5🐾]
