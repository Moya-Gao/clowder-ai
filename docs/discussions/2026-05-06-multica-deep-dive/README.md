---
doc_kind: research-note
topics:
  - multica
  - open-source-teardown
  - managed-agents
  - competitive-analysis
created: 2026-05-06
status: draft
source_repo: https://github.com/multica-ai/multica
source_local_path: /Users/lysander/projects/ref/multica
source_commit: d16c48172a74cb9a2a493ec7d9415d53d8eda2c6
authored_by: codex
---

# Multica Deep Dive

## 结论先行

Multica 不是空壳项目。它的真实内核是一套已经产品化的 **agent ops / managed agents control plane**：用户在 Web/desktop 里创建 issue、评论或 chat，服务端把它们转成 `agent_task_queue`，本地 daemon 按 runtime 抢任务、准备独立工作目录和 provider 配置，调用 Claude/Codex/Copilot/OpenCode/Hermes/Gemini/Kimi 等 CLI 或协议适配器执行，再把进度、消息、用量、session、失败原因写回服务端。

但它的 README 里最强的几句价值主张需要拆开看：

- "Autonomous execution" 有代码闭环支撑：队列、claim、start/progress/complete/fail、retry、resume 都是真的。
- "Unified runtimes" 有适配层支撑：多 provider backend 是真实工程，不是按钮假象；但 feature parity 不均匀，尤其 MCP/自定义参数这类能力目前明显偏 Claude Code。
- "Reusable skills compound" 只有 **手动技能管理、导入、注入** 的闭环，本轮没有找到 "每次解决方案自动变成 reusable skill" 的信号 -> 决策 -> 写入 -> 影响未来任务链路。
- "Agents as teammates" 在产品层面更像 "可被分配、会评论、有状态的托管执行者"；还不是我们在 Cat Cafe 里说的有身份契约、球权、peer review、跨 agent 治理的团队协作系统。

对我们最有学习价值的是它的 runtime/daemon/adapter 产品化方式，不是它的协作哲学。

## Source Snapshot

| 项 | 记录 |
| --- | --- |
| Repo | `https://github.com/multica-ai/multica` |
| Local path | `/Users/lysander/projects/ref/multica` |
| Commit | `d16c48172a74cb9a2a493ec7d9415d53d8eda2c6` |
| Commit subject | `fix(projects): pre-fill project on per-status "+" create-issue (#2155)` |
| Commit date | `2026-05-06 12:48:31 +0200` |
| Latest release | `v0.2.26`, published `2026-05-06T09:56:48Z` |
| Stars / forks | `25138` / `3057` at inspection time |
| License | Modified Apache 2.0 style license with SaaS/embedded-service and frontend branding restrictions in `LICENSE` |

旧讨论 `docs/discussions/2026-04-15-multica-comparison.md` 里把 Multica 判断为 "issue/assignee/runtime/run execution/control plane"，这个方向仍然成立。但 Multica 一个月内变化很快：旧记录里的 stars 是 13.1k，本轮已到 25.1k；release 已到 `v0.2.26`，runtime、desktop、local skills、autopilot、project surface 都更成熟。

## Claim Ledger

| README / 产品主张 | 代码证据 | 判断 |
| --- | --- | --- |
| Open-source managed agents platform | `README.md`; `server/cmd/server/router.go`; `server/internal/daemon`; `apps/web`; `apps/desktop` | 成立。它不是单 CLI 包装，而是 Web/API/daemon/DB/desktop 的控制面。 |
| Assign tasks to agents like teammates | `server/migrations/001_init.up.sql` 的 `agents` / `issues` / `comments` / `agent_task_queue`; `server/internal/handler/issue.go`; `server/internal/handler/comment.go`; `server/internal/service/task.go` | 部分成立。分配、评论、mention、状态是 teammate-like UI；团队治理和互审契约不是核心模型。 |
| Full task lifecycle: enqueue / claim / start / complete / fail | `server/internal/service/task.go`; `server/pkg/db/queries/agent.sql`; `server/internal/daemon/client.go`; `server/internal/daemon/daemon.go` | 成立，而且是项目最扎实的部分。 |
| Real-time progress via WebSocket | `server/cmd/server/router.go` 的 `/ws` 与 `/api/daemon/ws`; `server/cmd/server/main.go` 的 realtime hub / daemonws hub / Redis relay; daemon `ReportProgress` / `ReportTaskMessages` | 成立。单节点用内存 hub，多节点可用 Redis relay/request store。 |
| Reusable skills compound | `server/migrations/008_structured_skills.up.sql`; `server/internal/handler/skill.go`; `server/internal/daemon/execenv/context.go`; `server/internal/daemon/local_skills.go`; `server/internal/handler/runtime_local_skills.go` | 基础设施成立，自动 compound 未证实。代码支持技能 CRUD、agent-skill 绑定、本地导入、provider-native 注入；未看到自动从任务结果抽取新 skill 的闭环。 |
| Unified runtimes | `server/pkg/agent/agent.go`; `server/pkg/agent/{claude,codex,copilot,opencode,openclaw,hermes,gemini,pi,cursor,kimi,kiro}.go`; `server/internal/daemon/daemon.go` runtime registration | 成立。不同 provider 的执行协议被包进统一 Backend 接口。注意能力不是完全等价，社区 issue #2106 也显示 MCP UI/provider parity 仍不完整。 |
| Multi-workspace | `server/migrations/001_init.up.sql`; `server/cmd/server/router.go`; daemon workspace sync / repo cache / runtime registration | 成立。workspace 是一等域对象，daemon 会同步 workspace/repo。 |
| Autopilot / workflow | `server/migrations/042_autopilot.up.sql`; `server/internal/service/autopilot.go`; `server/cmd/server/autopilot_scheduler.go` | 有雏形。支持 schedule/webhook/api/manual trigger、create issue 或 run-only task；还不是完整 DAG/workflow engine，社区 #1943 也在要 workflow orchestration。 |

## Architecture Map

```text
apps/web (Next.js dashboard)
apps/desktop (Electron shell)
apps/docs
        |
        v
server/cmd/server (Go Chi API)
  - auth, workspaces, issues, comments, agents, skills, autopilots, chat
  - /ws realtime hub
  - /api/daemon/* daemon API + daemon WebSocket
        |
        +--> Postgres + sqlc migrations
        |      - users / workspaces / workspace_members
        |      - agents / issues / comments
        |      - agent_task_queue / task messages / usage
        |      - skills / skill_files / agent_skills
        |      - autopilots / triggers / runs
        |
        +--> optional Redis
        |      - realtime relay
        |      - daemon request stores for multi-node deployments
        |
        v
server/internal/daemon
  - register local runtime versions
  - sync workspaces and repos
  - per-runtime poller
  - claim task only after local execution slot is available
  - prepare isolated exec env / workdir / provider config
  - call agent backend adapter
  - stream progress / messages / usage / session / result back
        |
        v
server/pkg/agent Backend interface
  - claude, codex, copilot, opencode, openclaw
  - hermes, gemini, pi, cursor, kimi, kiro
```

### 入口

- Web app: `apps/web`.
- Desktop app: `apps/desktop`.
- API server: `server/cmd/server/main.go`, router in `server/cmd/server/router.go`.
- CLI/daemon entry: `server/cmd/multica/main.go`, daemon logic in `server/internal/daemon`.
- Agent adapters: `server/pkg/agent`.

### 状态存储

- Postgres 是主真相源：workspace、agent、issue、comment、task queue、skill、autopilot 都落表。
- Redis 是可选横向扩展部件：realtime relay、runtime local skill/import request store。没有 Redis 时本地开发走 in-memory。
- 本地 daemon 有执行态：workspace root、repo cache、每 task workdir、`.agent_context`、provider-native skill 目录、per-task `CODEX_HOME`。
- Provider CLI 自身还有隐含状态：Codex/Claude/Hermes/Kimi 等 session、auth、配置、插件缓存。

### 扩展点

- 新 runtime/provider：实现 `server/pkg/agent.Backend`，接入 `agent.New(provider)`，再让 daemon version detection/register 支持它。
- 技能系统：`skills` / `skill_files` / `agent_skills`，加上 daemon local skill import。
- 执行环境：`server/internal/daemon/execenv` 负责把 project context、commands、skills、mentions、output rules 写成 provider 能读的配置。
- Autopilot trigger：schedule/webhook/api/manual 是现在的触发模型。

### 高风险集中点

- `server/internal/daemon/daemon.go` 很大，承担注册、workspace sync、polling、task execution、env prepare、provider dispatch、message drain、failure mapping。它是产品核心，也容易变成变更热点。
- `server/internal/service/task.go` 覆盖 issue/comment/chat/quick-create/autopilot task 的生命周期和 retry/reconcile，业务耦合重。
- 外部 CLI 协议漂移风险高：Codex JSON-RPC/app-server、Claude stream-json、Hermes/Kimi ACP、Cursor stream-json 都要分别跟进。
- custom args/env/MCP config 这类能力是安全边界，值得单独审计；本轮只做架构拆解，没有展开安全审计。

## Star Feature Deep Dives

### 1. Issue -> Agent Task -> Daemon Execution

真实链路：

1. 用户创建或更新 issue，或者在 comment 中触发 agent。
2. `IssueHandler` / `CommentHandler` 调用 `TaskService`。
3. `TaskService` 验证 assignee 是 agent、agent 有 runtime、runtime 可用，然后创建 `agent_task_queue`。
4. 服务端广播 `task:queued`，并 wake daemon。
5. Daemon 的 per-runtime poller 先拿本地 execution slot，再调用 `/runtimes/{runtimeId}/tasks/claim`。
6. `ClaimAgentTask` 用 `FOR UPDATE SKIP LOCKED` 抢可执行任务，按 priority / created_at 排序，并避免同一 `(issue, agent)` 并发跑多个任务。
7. Daemon `StartTask`，准备 workdir / provider config / skill files / env，然后调用具体 backend。
8. Backend 输出被 daemon 批量上报为 task messages，同时 pin session/workdir。
9. 完成时 `CompleteTask`；失败时 `FailTask`，服务端决定是否 retry、是否把 issue reset 到 todo、是否追加 agent comment。

关键状态变化：

- `issues.status` / `issues.assignee_*`.
- `agent_task_queue.status` 从 `queued` 到 `dispatched/running/completed/failed/cancelled`。
- task message / usage / session / work_dir。
- agent comments 和 timeline/realtime events。

判断：这是 Multica 最强的产品骨架。它把 "让 agent 干活" 做成了可观察、可恢复、可重试、可追踪的状态机。

### 2. Skills: Manual Substrate, Not Automatic Learning

真实链路：

1. 服务端 schema 有 `skills`、`skill_files`、`agent_skills`。
2. Web/API 可 CRUD/import skill，并把 skill 绑定到 agent。
3. Daemon claim task 时拿到 agent data 和 skills。
4. `execenv/context.go` 会把 skills 写进 provider-native 目录，例如 Claude `.claude/skills`、Copilot `.github/skills`、OpenCode `.opencode/skills`、Cursor `.cursor/skills`、Kimi `.kimi/skills`。
5. Codex 还有 per-task `CODEX_HOME`，通过 `codex_home.go` 复制/链接 auth、sessions、plugin cache，同时写入 sandbox config。
6. Local skill import 会扫描本机各 provider 的 skill roots，并通过 daemon request store 回传给服务端。

这说明 Multica 的 skill substrate 是真的，尤其对多 runtime 的 provider-native skill 注入做得比较细。

但 README 的 "Every solution becomes a reusable skill" 更像愿景。当前源码证据支持的是：

- 人或已有 provider skill -> import / create -> assign to agent -> future task sees skill。

本轮没有找到：

- task result -> 自动识别可复用方法 -> 生成 skill file -> 绑定 agent -> 后续任务自动使用。

所以准确说法应该是：Multica 有 reusable skills 管理和注入系统，但还不是自动知识蒸馏系统。

### 3. Unified Runtimes

真实链路：

1. Daemon 注册时检测本机 runtime CLI 版本。
2. Server 保存 runtime availability。
3. Task claim 按 runtime 分发。
4. `server/pkg/agent.Backend` 把 provider 差异统一成 `Execute(ctx, prompt, opts)`。
5. 每个 provider adapter 自己处理启动、流解析、session ID、usage、timeout。

比较典型的适配差异：

- Claude: 走 `claude` CLI 的 stream-json 输出，支持 `--mcp-config` 临时文件。
- Codex: 走 `codex app-server --listen stdio://`，通过 JSON-RPC start/resume thread，再 turn/start。
- Hermes / Kimi: 走 ACP 风格 session/new 或 session/resume。
- Cursor: 走 `cursor-agent` stream-json。

判断：runtime abstraction 是真实工程投入，不是简单枚举。但 "unified" 的含义是统一调度与状态回传，不代表所有 provider 能力完全一致。社区 #2106 里 maintainer 也承认 per-agent MCP backend 字段存在，但 UI/docs 和非 Claude provider 支持不完整。

### 4. Autopilot

真实链路：

1. `autopilots` 定义触发器、agent、project、prompt、execution mode。
2. `autopilot_triggers` 支持 `schedule/webhook/api/manual`。
3. Scheduler 每 30 秒 claim due schedule trigger。
4. `DispatchAutopilot` 创建 `autopilot_run`。
5. execution mode 分两种：
   - `create_issue`: 先创建 issue，再 enqueue task。
   - `run_only`: 直接创建 agent task，不创建 issue。
6. run 会根据 issue/task 状态同步成 running/completed/failed。

判断：这是一个实用的 recurring-trigger / automation surface，但还不是完整 workflow/DAG。社区 #1943 要 workflow orchestration，说明真实用户已经撞到这个边界。

## Algorithm Peel

| 模块 | 是否有算法含量 | 证据 | 评价 |
| --- | --- | --- | --- |
| Task claim scheduling | 有，工程调度算法 | `server/pkg/db/queries/agent.sql` 的 `ClaimAgentTask` | priority + FIFO + `FOR UPDATE SKIP LOCKED` + 同 issue/agent 串行化，够实用。 |
| Daemon slot-before-claim | 有，调度策略 | `server/internal/daemon/daemon.go` runtime poller | 先拿本地执行槽再 claim，避免任务被 claim 后本地排队超时。这个细节值得学。 |
| Retry / failure handling | 规则系统 | `TaskService.MaybeRetryFailedTask`, `HandleFailedTasks` | 按 failure_reason、attempt、session/workdir 判断重试与恢复，偏工程规则，不是智能规划。 |
| Session resume | 规则 + 历史查询 | `GetLastTaskSession`, daemon resume fallback | 排除 poisoned failure，resume 失败可 fresh start，可靠性导向。 |
| Provider stream parsing | 协议解析 | `server/pkg/agent/*.go` | 工程复杂度高，算法含量低，但维护成本真实。 |
| Search / filter | 基础 ranking | issue query 中的 LIKE/rank CASE | 够 dashboard 用，不是重点。 |
| Autopilot schedule | cron 规则 | `autopilot_scheduler.go` | 标准调度，不是 workflow planner。 |
| Skill compounding | 未见自动算法 | skill CRUD/import/injection | 当前是显式配置，不是自动学习。 |

## Feedback Loops

| Loop | 链路 | 是否闭环 | 备注 |
| --- | --- | --- | --- |
| Task execution loop | issue/comment/chat/autopilot -> queue -> daemon -> agent -> status/comment/message | 是 | 这是 Multica 的核心闭环。 |
| Reliability loop | failure -> classify -> retry/fresh session/reset issue | 是，有限 | 解决执行可靠性，不解决产出质量。 |
| Runtime observability loop | daemon heartbeat/version/model/local skill -> server UI | 是 | 对运维可见性有帮助。 |
| Skill learning loop | solution -> reusable skill -> future behavior | 不完整 | 只有 manual import/create/assign/inject，缺自动提炼。 |
| Autopilot loop | schedule/webhook/api/manual -> run -> issue/task -> run status | 是 | 更像 automation trigger，不是多步骤工作流。 |
| Governance loop | agent output -> review -> merge decision -> durable memory/lesson | 没看到系统化模型 | 这正是 Cat Cafe 的差异点。 |

## Community Signals

高反应 issue 集中在这些方向：

- #402 "让 agent 成为真正的一等公民"。
- #1120 "Sync GitHub issues/PRs with Multica issues for linked repos"。
- #815 "Multica still manages AI the way it manages people"。
- #1173 "Agent Team -- assign a group of agents to a project"。
- #1943 "Workflow Orchestration"。
- #1900 "Multiple Runtimes Per Agent"。
- #1811 / #887 project-scoped agent working directories / repo as main working dir。
- #963 Helm chart support。
- #711 Keycloak SSO / K8s workspace runtime / MCP connectivity。

近期 bug 也暴露了成熟产品会遇到的边缘：

- #2153 agent/CLI-originated invalid data can crash issue views and block human recovery。
- #2106 per-agent MCP backend 字段存在，但 UI/docs/provider parity 不完整。
- #2006 404 ErrorBoundary。
- #2007 Hermes skill bug。
- #2124 中文用户反馈看不到 `cc` 输出问题。

这些信号说明 Multica 已经有真实用户和真实运维痛点。它不是 dormant demo；它的问题是产品边界快速扩张后，runtime parity、数据鲁棒性、工作流抽象和 agent-first governance 正在追赶。

## Cat Cafe 对照

### 我们应该学

1. **把 task lifecycle 做成清晰脊柱。** Multica 的 `queued -> dispatched/running -> completed/failed/cancelled` 加 claim/start/progress/complete/fail API 很直观，UI 和 daemon 都只是这个状态机的投影。
2. **daemon 抢任务前先拿本地执行槽。** 这个细节能避免任务已经被服务端派出、本地却排队导致 dispatch timeout。
3. **provider adapter taxonomy。** 不同 CLI/协议差异很大，统一 Backend 接口 + provider-specific parser/config 是现实路线。
4. **runtime observability 产品化。** runtime version、heartbeat、model list、local skill import、usage aggregation 都让 "agent 在哪、能不能跑、跑了多少" 更可见。
5. **provider-native skill injection。** 它不是只把 skill 当 Markdown，而是写到各 provider 习惯的位置，这对实际命中率有价值。

### 我们不该照抄

1. **不要把 issue 当唯一协作真相。** Multica 的协作重心是 issue/task board；我们还需要 thread、handoff、球权、review、memory、决策真相源。
2. **不要把 skill 管理包装成自动学习。** 如果没有 signal -> decision -> mutation -> future behavior，不能叫自动 compound。
3. **不要把多 provider support 说成能力等价。** Runtime 统一调度不等于 MCP、session、permission、skills、usage 全部同等支持。
4. **不要只有执行闭环，没有治理闭环。** Agent 能跑任务只是第一层；能否审查、拒绝、升级、沉淀经验，是另一层。
5. **谨慎云端/托管 license 与部署模型。** Multica 的 license 对 SaaS/嵌入式商业服务和前端 branding 有额外限制；如果我们研究或复用，只能学方法，不碰代码回流。

### 对旧结论的更新

2026-04-15 的旧结论说：

- Multica: issue / assignee / runtime / run execution / control plane。
- Cat Cafe: thread / conversation / relationship。

现在需要加一句：Multica 正在从 "issue-runner" 变成更完整的 "agent operations platform"。它的 runtime ops、desktop、本地 daemon、local skills、autopilot 已经更像一套可部署产品。但它离 "agent team" 仍有结构差距：高反应社区需求本身就在要 agent team、workflow orchestration、GitHub sync、project-scoped workdir 和 first-class agent。

## Bottom Line

Multica 的真实强项是 **把 AI coding agents 托管起来、排队、调度、观察、失败恢复、跨 runtime 适配**。这部分我们应该认真学。

它的弱项不是工程空，而是概念边界偏营销：teammate、compound skills、workflow 这些词已经越过了当前代码闭环。我们拆它时应该把 "agent ops 成熟度" 和 "agent collaboration/governance 成熟度" 分开评分。

对 Cat Cafe 来说，最有价值的结论是：

> Agent control plane 的产品脊柱必须是可恢复、可观察、可审计的 runtime state machine；但真正的多 agent 协作不能停在 task board，需要把身份、球权、review、知识沉淀和升级路径做成同样一等的系统对象。

[砚砚/GPT-5.5🐾]
