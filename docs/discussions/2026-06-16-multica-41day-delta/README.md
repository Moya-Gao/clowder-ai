---
doc_kind: research-note
topics:
  - multica
  - open-source-teardown
  - delta-audit
  - managed-agents
  - competitive-analysis
created: 2026-06-16
status: draft
predecessor: docs/discussions/2026-05-06-multica-deep-dive/README.md
source_repo: https://github.com/multica-ai/multica
source_local_path: /Users/lysander/projects/ref/multica
source_commit_baseline: d16c48172a74cb9a2a493ec7d9415d53d8eda2c6
source_commit_current: origin/main @ f46b929eb (2026-06-16)
authored_by: opus-47
---

# Multica 41 天 Delta Audit（2026-05-06 → 2026-06-16）

## 结论先行

41 天内，Multica 没有发生路线转向，但发生了**密度跃迁**：从一个"agent ops control plane 原型 + 早期社区"演变为"商业化 SaaS + IM/源码栈双桥接 + 内建 skill 程序化分发"的成熟产品骨架。砚砚 2026-05-06 的核心判断**全部仍然成立**——三条"被宣传越界"的 claim（compound skills / agents-as-teammates / workflow orchestration）在代码层面仍然未闭环，**但产品做了主动收窄宣传**：squad 的官方 built-in skill 明确写了 "A squad is not an agent. It does not run work by itself" ——比 41 天前的 README 诚实多了。

变化最强的不是"是否有自学习"，而是**商业化基础设施的快速齐全化**（PostHog telemetry / business metrics / contact_sales / Fable-5 pricing / task_usage hourly+daily rollup + pgcron）和**入口扩展**（Lark/飞书集成 + GitHub PR mirror）。Multica 在 41 天里完成了从"开源 agent runtime"到"瞄准付费用户的 SaaS 平台"的产品姿态调整。

对 Cat Café 最重要的更新：**Multica 已经把"商业化 IM 入口 + 跨源码托管平台桥接"做满了**，这是我们没走的路；同时 **squad 的克制定义证伪了"是否有 multi-agent team 都用同样的产品语言"——Multica 选了路由抽象 + leader 单点**，与 Cat Café "@ + 球权 + 真协作" 是分叉的产品观，不是落后版本。

## Source Snapshot（41 天 delta）

| 项 | 2026-05-06（砚砚基线） | 2026-06-16（当前） | Delta |
| --- | --- | --- | --- |
| HEAD | `d16c48172a74cb9a2a493ec7d9415d53d8eda2c6` | `f46b929eb...` (origin/main) | +796 commits |
| Latest tag | `v0.2.26` | `v0.3.23` | 11 minor releases |
| Stars | 25,138 | **36,876** | +11,738 / **+47%** |
| Forks | 3,057 | **4,534** | +1,477 / **+48%** |
| Open issues | — | 966 | — |
| 文件改动 | — | **2,056 files / +322,050 / -27,924** | — |
| LICENSE | Apache 2.0 + SaaS/branding 限制 | **无变化** | LICENSE diff = 0 行 |
| 最近 push | 2026-05-06 | **2026-06-16T10:10:19Z** | 当天仍在密集合 PR（仅 06-16 = 16 commits） |

stars 曲线（旧讨论 2026-04-15: 13.1k → 2026-05-06: 25.1k → 2026-06-16: 36.9k）说明社区关注度**仍在加速**，不是 hype 衰减期。

## Claim Ledger 重新打分

按砚砚 2026-05-06 的 8 条 claim 重新核证：

| 砚砚 claim | 41 天前判断 | 41 天后判断 | 变化 / 新证据 |
| --- | --- | --- | --- |
| Open-source managed agents platform | 成立 | **仍成立** | 控制面更厚（PostHog、business metrics、selfhost docker compose） |
| Assign tasks to agents like teammates | 部分成立 | **部分成立（边界更清晰）** | Squad 落地（migrations 084-086），但 squad 自己澄清"不是 agent，不 fan-out" |
| Full task lifecycle | 成立 | **更成立** | + `pkg/taskfailure` classifier、central error translation、`drop_task_last_heartbeat` 重构、running_started_at_index |
| Real-time progress via WebSocket | 成立 | **仍成立** | + ws_lease_token 多副本互斥（Lark integration 同款手法） |
| **Reusable skills compound** | 基础成立，自动 compound 未证实 | **41 天后仍未证实** | 41 天所有 skill commits 全是工程性修补（YAML 解析、路径冲突、bulk import、search、isolate toggle），**无任何 auto-distill / compound / learn** |
| Unified runtimes | 成立 | **仍成立 + 扩张** | + CodeBuddy（first-class）、Antigravity (agy) per-agent model selection、openclaw gateway 外接 |
| Multi-workspace | 成立 | **仍成立** | + workspace avatar、workspace repo registry CLI |
| Autopilot / workflow | 有雏形 | **仍是雏形，未达 DAG** | + autopilot_run_skipped_status、event filters、DB-backed execution-record scheduler、sys_cron_executions；但仍是 trigger 系，无多步骤编排 |

**新增 claim（41 天里出现的）**：

| 新 claim（产品/README/changelog 主张） | 代码证据 | 判断 |
| --- | --- | --- |
| Built-in agent skills | `server/internal/service/builtin_skills.go` (`//go:embed builtin_skills`); `server/internal/service/builtin_skills/multica-*/SKILL.md` 共 8 个 | **成立但产品定位需澄清**：是"平台教 agent 怎么用自己"，不是"自动学习"。SKILL.md 都标 `user-invocable: false` |
| Squad (agent team primitive) | `migrations/084_squad.up.sql` + `085_squad_archive` + `086_squad_avatar`; `packages/core/squads/`; `apps/web/.../squads/` | **成立但克制**：squad SKILL.md 明确写 "not an agent, does not fan-out members, routes to `leader_id` agent"。社区诉求 #1173 被接住了 *issue assign 维度* |
| Lark/飞书集成 | `migrations/109_lark_integration.up.sql` (270 行) + 多个 lark-* migrations + `feat(lark)` 一大串 commits | **成立且工程质量高**：app_secret 应用层 secretbox 加密、composite FK 防 binding 跨 workspace、ws_lease_token 防多副本竞争、inbound_audit 不存 message body（合规）。这是严肃企业 IM 集成 |
| GitHub PR 镜像与 issue 链接 | `migrations/079_github_integration.up.sql` (`github_installation` / `github_pull_request` / `issue_pull_request` 链表) + `server/internal/handler/github.go` | **成立但单向为主**：当前可镜像 PR state 到 multica issue，但未见反向把 issue 同步到 GitHub repo 的代码闭环。社区 #1120 部分被接住 |
| Built-in business intelligence | `feat(server): funnel/community/commercial business metrics + PostHog pairing`; `BusinessSamplerCollector` for active users/queued/runtime gauges; `contact_sales_inquiries` table; `task_usage_hourly` + `task_usage_daily_rollup` + pgcron | **成立**。这是 SaaS 商业化的硬骨架，41 天里完全成型 |
| Multi-LLM pricing model | `feat: support Claude Fable 5 pricing` | **成立**。从 Anthropic 新模型 pricing 跟进速度看，billing 链路是产品的优先项 |
| 客户端故障遥测 | `feat: client failure telemetry (JS errors + freeze/crash) to PostHog` (#4187) | **成立**。前端 crash/freeze 上报给 PostHog——SaaS 平台标准动作 |

## 新增 / 改动模块的架构 Delta 地图

**砚砚 2026-05-06 的整体地图仍然成立**——entrypoint、daemon、Postgres、Redis、provider adapter 这些都未结构性变化。本节只画"新长出来的部分"和"被改造的部分"：

```text
apps/web                                          apps/desktop
  + /squads/* dashboard surface                     + Cmd+W app-root handler
  + native notification banners                     + recovery prompt with route context
  + (PostHog client failure telemetry)
        |                                              |
        v                                              v
server/cmd/server
  + GitHubHandler  (handler/github.go)
  + LarkHandler    (handler/lark*.go, ws+webhook)
  + SquadHandler   (handler/squad*.go)
  + AutopilotScheduler (DB-backed execution-record scheduler)
  + BusinessSamplerCollector  (PostHog pairing)
        |
        +--> Postgres (新增表，按时间序简列)
        |     069: comment_resolved_at / drop task_last_heartbeat
        |     072-078: task_usage hourly+daily rollup + pgcron + invalidation
        |     079: autopilot_run_skipped_status + github_integration
        |     080-082: agent_task_queue index + runtime_timezone (later dropped at 104)
        |     084-086: squad + squad_archive + squad_avatar  ← NEW PRIMITIVE
        |     ...   : (省略 30+ 项 — 详见 server/migrations/)
        |     096-100: user_profile_description / autopilot_project_id /
        |              contact_sales_inquiries / onboarding_runtime_choice / user_timezone
        |     101-103: task_usage hourly_schema / hourly_pipeline / drop legacy daily rollups
        |     105-108: issue_metadata / member_user_workspace_index / system_author / task_token
        |     109   : lark_integration (270 行) + drop_agent_skills_local +
        |              issue_pull_request_close_intent
        |     110-119: autopilot_trigger_event_filters / lark inbound dedup /
        |              sys_cron_executions / agent_task_queue running_started_at_index /
        |              agent_runtime last_seen_at_index / lark region / initiator_user_id /
        |              user_created_at_index
        |
        +--> Redis：未结构变化，但 lark integration 引入 ws_lease_token 模式
        |
        v
server/internal/service
  + builtin_skills.go (//go:embed)
  + builtin_skills/multica-*  (8 个 SKILL.md，user-invocable:false)
  + pkg/taskfailure classifier （集中化 failure reason 写入）
  + central error translation layer (PR1+PR2)

server/pkg/agent
  + codebuddy.go   (first-class CLI backend)
  + antigravity (agy)：per-agent model selection
  + openclaw external gateway hooks
```

## Star Feature Delta Deep Dives（仅深挖 41 天里新出现 / 关键改造）

### A. Built-in Skills：不是自动 compound，是"平台说明书的程序化分发"

源码证据：

- `server/internal/service/builtin_skills.go`（核心 80 行）使用 Go 1.16 `//go:embed builtin_skills` 把 `builtin_skills/` 目录在编译时打包进二进制。
- `TaskService.BuiltinSkills()` 返回 `[]AgentSkillData`，**每个 agent 都会收到这一份 + 自己 workspace 的 skill**。
- 目录布局：`builtin_skills/multica-<name>/SKILL.md` + 可选 `references/*.md`，名字加 `multica-` 前缀避免与用户 skill 命名冲突。
- 当前内置 8 个 skill：`multica-autopilots / multica-creating-agents / multica-mentioning / multica-projects-and-resources / multica-runtimes-and-repos / multica-skill-importing / multica-squads / multica-working-on-issues`。

关键发现（从 `multica-skill-importing/SKILL.md` 和 `multica-squads/SKILL.md` 读到）：

- frontmatter 严格遵循 Claude Code skills 规范（`---name / description / user-invocable / allowed-tools ---`）。
- 所有内置 skill 标 `user-invocable: false`——**给 agent 看的，不直接暴露给 user**。
- 内容是"教 agent 怎么用 Multica 自己的 API/CLI"，引用 `references/*-source-map.md` 把每条 claim 回链到 server 源码路径，避免幻觉。
- 没有 "task 完成 → 自动写一份 SKILL.md → 绑到 agent" 的链路。

**判断**：这是一个**产品创新**——把平台说明书从 system prompt 硬编码改成"运行时分发的、可版本化、可追溯到源码"的 skill。Cat Café 的 native L0 system prompt 也是同样哲学（不押在用户 memory 上，每次注入），但是把猫的身份/家规作为**全局基线**；Multica 把"如何用本平台"作为**面向 agent 的 RAG-able 文档**。

但它**仍然不是** "Every solution becomes a reusable skill"——这条 README 主张在 41 天里没有获得任何代码闭环支撑。

### B. Squad：agent team 的克制实现

源码证据（按 schema + product copy 同时看）：

```sql
-- migrations/084_squad.up.sql
CREATE TABLE squad (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    leader_id UUID NOT NULL REFERENCES agent(id) ON DELETE RESTRICT,  -- leader 必须是 agent
    creator_id UUID NOT NULL,
    ...
);
CREATE TABLE squad_member (
    squad_id UUID, member_type TEXT CHECK (member_type IN ('agent', 'member')),  -- 成员可混
    member_id UUID, role TEXT,
    ...
);
ALTER TABLE issue ADD CONSTRAINT issue_assignee_type_check
    CHECK (assignee_type IN ('member', 'agent', 'squad'));  -- issue 可分配给 squad
```

产品定位（`builtin_skills/multica-squads/SKILL.md` 原文）：

> A squad is not an agent. It does not run work by itself. Current behavior: squad-routed work runs through the squad's `leader_id` agent.
>
> Important consequences:
> - assigning an issue to a squad routes to the leader;
> - mentioning a squad routes to the leader;
> - squad-assigned autopilot resolves to the leader;
> - **squad members are not automatically fanned out;**
> - squad `instructions` are leader briefing content, not member prompts.

**判断**：

1. squad 接住了社区 #1173 "agent team" 诉求的 **issue 分配维度**——你可以把 issue assign 给 squad。
2. 但 **squad ≠ multi-agent execution**——它是个**路由抽象**：进来的工作单点落到 leader agent，其他 member 是参考上下文。
3. leader 必须是 agent + member 可混 agent+human，这是"agent 主导，人辅助"的产品观。Cat Café 是"人猫共创，球权可交可退可升"——产品方向是分叉的，不是落后版本。
4. 这是 41 天里**最重要的一次主动澄清**：产品方在 SKILL.md 里直接告诉所有 agent "不要把 squad 当成多 agent 队伍"，远比 41 天前的营销话术诚实。

### C. Lark/飞书集成：严肃 IM 入口

源码证据（`migrations/109_lark_integration.up.sql` 270 行 + 多个 lark feat commits）：

工程亮点：

- `lark_installation.app_secret_encrypted BYTEA` —— Lark app secret **应用层 secretbox 加密**写入，DB 永不见明文。"a dump leaks ciphertext only" 是注释原话。
- `ws_lease_token` + `ws_lease_expires_at` ——多副本部署时只有持有有效 lease 的 server 实例能保持 Lark WebSocket，防止重复消费 inbound 事件。
- `lark_user_binding` 用 **composite FK** `(installation_id, workspace_id) → lark_installation(id, workspace_id)`，结构上禁止 binding 跨 workspace。
- workspace member 被移除时 binding 通过 `CASCADE` 同事务删除，杜绝 stale binding。
- `lark_inbound_audit` 只存 `routing / identity / drop_reason / timestamp`，**never message body** ——主动满足合规要求。

41 天里关联 commits 一大串：`feat(lark)` `support both Feishu and Lark from one deployment` / `prefetch surrounding group context on @-mention` / `inbound context enrichment — post / merge_forward / quoted-reply` / `typing indicator lifecycle` / `add proxy support for WebSocket connections`。

**判断**：

- 这不是"加个 webhook 收个消息"的玩具集成。schema 写得像产品规格说明书，把 ws lease / 合规审计 / 加密 / FK 完整性 都做满了。
- Multica 押注**亚太/中国市场企业 IM 入口**——这条路 Cat Café 还没走，是个真实的产品方向 gap。
- 注意：feat(lark) 的合规 caveat 写在 schema 注释里，这意味着 maintainer 把 schema 当作合约真相源——这种习惯本身值得学。

### D. GitHub PR 镜像 + Issue↔PR 链接

源码证据（`migrations/079_github_integration.up.sql` + `server/internal/handler/github.go`）：

```text
github_installation     (workspace 装了哪个 GitHub App)
github_pull_request     (镜像 PR state: open/closed/merged/draft, branch, author, merged_at...)
issue_pull_request      (issue ↔ PR 多对多链接表，记录 linked_by_type/id)
```

新 CLI：`feat(cli): list issue pull requests (#3581)`。

新 migration：`109_issue_pull_request_close_intent.up.sql`（issue close 时的 PR 关联意图记录）。

**判断**：

- 当前是**单向镜像** GitHub → Multica，未见反向把 multica issue 推到 GitHub repo 的 endpoint。
- 但 schema 已经为双向同步留好了位置（`issue_pull_request` 是中间表，`linked_by_type` 字段已存在）。
- 这条路对开发者用户极其有价值——它把 "PR review 在 GitHub / agent 协作在 Multica" 这种现实工作流统一起来。Cat Café 目前是用 `gh` CLI + memory 手工桥接，不是平台级。

### E. 商业化基础设施（PostHog + Sales + Billing + Cron）

41 天里这条线整套上线，关键证据：

- `feat(server): funnel/community/commercial business metrics + PostHog pairing (MUL-2949) (#3698)` —— PostHog 用作 server 侧 business metrics 配对，不只是前端埋点。
- `feat(metrics): BusinessSamplerCollector for active users / queued / runtime gauges (MUL-2947) (#3706)` —— 主动采样业务核心指标。
- `feat: client failure telemetry (JS errors + freeze/crash) to PostHog (#4187)` —— 前端 crash/freeze 上报。
- `migrations/098_contact_sales_inquiries.up.sql` —— **销售线索表**（B2B 商业化硬证据）。
- `migrations/072-078` —— `task_usage_updated_at` / `task_usage_daily_rollup` / `task_usage_pgcron_extension` / `task_usage_daily_invalidation` —— **付费分级所需的用量计量基础设施**。
- `migrations/101-103` —— `task_usage_hourly_schema` / `_pipeline` / drop legacy daily rollups —— 计量管线重构，从 daily 升级到 hourly + invalidate。
- `feat: support Claude Fable 5 pricing (#3982)` —— 新模型 pricing 跟进速度极快（Fable 5 发布到接入间隔短）。

**判断**：Multica 在 41 天里把 SaaS 平台运行所需的**测度 / 监控 / 销售线索 / 计费基础**全部架完。这是个**已经在准备收钱的产品**，不是还在做 demo 的开源项目。

### F. 新增 Runtime（CodeBuddy + Antigravity）

- `feat(agent): add CodeBuddy as first-class CLI backend (#3186)` —— CodeBuddy 进入 first-class 列表。
- `feat(daemon): enable Antigravity (agy) per-agent model selection (MUL-3125) (#3894)` —— Antigravity 不仅接入，且支持 per-agent 模型选择（与 Cat Café 的猫多型号工具切换思路类似）。
- `feat(openclaw): support connecting to existing OpenClaw gateway (#3260)` —— openclaw 现在可挂外部网关。

**判断**：unified runtimes 这条路 Multica 在持续扩张，但**各 provider 能力 parity 仍不均匀**（41 天前砚砚 flag 的社区 issue #2106 仍未关闭）。

### G. 可靠性大改造：error/failure 中枢化

- `feat(server): introduce pkg/taskfailure classifier and switch in-flight failure_reason writes (MUL-2946) (#3693)` —— 失败原因写入路径集中化到 classifier。
- `feat(cli): central error translation layer (PR1, MUL-3104) (#3892)` + `feat(cli): per-status error copy with actionable hints (PR2, MUL-3104) (#3897)` —— CLI 用户层错误信息中枢化 + actionable hint。
- `drop_task_last_heartbeat` (migration 069) —— 心跳模型改造（细节没追，但说明可靠性栈被重写了一次）。
- `agent_task_queue_running_started_at_index` (114) + `agent_runtime_last_seen_at_index` (115) —— 性能 index 补齐。
- `MUL-3316: fix(execenv): switch agent prompt to --content-file to prevent heredoc flag swallowing` (今日修复) —— 还在持续修真实生产 bug。

**判断**：这条线说明 Multica 已经在**真用户、真负载、真故障** 的运营节奏里。砚砚标注的"daemon.go 和 task.go 业务耦合重"风险，在 41 天里**被回应**——通过 classifier / error translation 这种中枢化手法解耦。

## Algorithm Peel（增量层，未改动的不重复）

| 模块 | 41 天前 | 41 天后 | Delta |
| --- | --- | --- | --- |
| Task claim scheduling | 工程调度算法 | 同上 + index 增强（running_started_at / runtime_last_seen） | 算法不变，可观测性增强 |
| Failure classifier | 散落规则 | `pkg/taskfailure` 集中化 + central error translation | **从规则散落 → 规则集中**，仍是规则系统，无 ML |
| Skill compounding | 未见自动算法 | **41 天后仍未见** | skill commits 全是工程性修补，无自动 distill |
| Squad routing | — | leader 单点路由（不 fan-out） | 这不是"调度算法"，是产品决策 |
| Lark inbound dedup | — | `lark_inbound_dedup_per_installation` migration | 工程级幂等保证，非智能 |
| Autopilot scheduler | cron 规则 | + DB-backed execution-record scheduler + event filters | 仍是 cron + filter，无 DAG planner |
| Business metric sampling | — | `BusinessSamplerCollector`（active users/queued/runtime gauges） | 监控采样，无智能 |
| PostHog client failure | — | JS errors + freeze/crash 上报 | 标准前端遥测 |

**结论**：Multica 仍然是一个**工程含量极高、算法含量极低**的项目。它的复杂度来自"把很多协议/runtime/集成做成可运营平台"，不来自"算法挑战"。41 天里这一基调没变。

## Feedback Loops Delta

| Loop | 41 天前判断 | 41 天后判断 | 新证据 |
| --- | --- | --- | --- |
| Task execution loop | 闭环 | 闭环 + 可靠性更强 | failure classifier + error translation |
| Reliability loop | 有限闭环 | **闭环更系统** | central error translation + per-status hint |
| Runtime observability | 闭环 | 闭环 + 商业化采样 | `BusinessSamplerCollector` |
| **Skill learning loop** | 不完整 | **仍不完整** | 41 天 0 个 auto-compound commit |
| Autopilot loop | 闭环（trigger 系） | 闭环 + event filter + DB scheduler | 仍非 DAG |
| **Governance loop** | 没看到系统化模型 | **仍未见** | squad 是路由抽象，不是治理；review/approval primitive 在 schema 层未出现 |
| **业务/商业化 loop** | — | **新闭环** | PostHog + BusinessSampler + contact_sales + task_usage_rollup |
| **企业 IM 入口 loop** | — | **新闭环** | Lark integration ws lease + inbound audit + group context enrichment |
| **GitHub PR 联动 loop** | — | **半闭环** | 单向镜像已通，反向 push 未见 |

## Community Signals Delta

41 天前砚砚 flag 的高反应 issue / 近期 bug 与现在状态：

- **#1173 "Agent Team -- assign a group of agents to a project"** —— **被 squad 部分回应**（assign 维度 ✓，fan-out 维度 ✗）。
- **#1943 "Workflow Orchestration"** —— **未被回应**（autopilot 仍是 trigger 系，无 DAG）。
- **#2106 per-agent MCP backend parity** —— **未关闭**，但有 `feat(cli): add --mcp-config flags to agent create/update (#3799)` 在补 CLI 维度。
- **#1120 "Sync GitHub issues/PRs with Multica issues"** —— **被部分回应**（PR 单向镜像 + issue_pull_request 链接 ✓）。
- **#402 "agent as first-class citizen"** —— Multica 通过 squad leader 必须是 agent + agent 可作 issue assignee + agent 进 squad member 这一组 schema 决策，强化了 agent 的一等地位。
- **#2153 invalid data crash issue views** —— 没追，但 41 天有大量 `fix(issues)` `fix(comments)` `fix(editor)`，说明数据鲁棒性是个持续优先项。
- **#2124 中文用户 cc 输出问题** —— 没特地追，但中文/亚太市场是 41 天产品重心（Lark + 4 语言文档 + 时区表）。

## Cat Café 对照 Delta

### 新学的（41 天里 Multica 教我们的）

1. **schema 即合约**：`lark_integration.up.sql` 270 行里写满了"哪个不变量靠哪条 FK 守"、"哪个字段为什么用 composite key"。这是把**架构决策固化在 schema 注释**的硬功夫，比写 ADR 更靠近真相源。我们 cat-cafe 的 Redis schema / Postgres schema 注释密度可以学这种风格。
2. **平台说明书的程序化分发**：`builtin_skills` `//go:embed` 让"如何用本平台"成为可版本化、可追溯的 agent 输入。Cat Café 的 native L0 system prompt 是同源哲学但**针对全局基线**；Multica 是**针对平台用法**——两者可以共存。值得考虑：我们要不要也把"如何用 cat-cafe-collab / 如何用 memory 系统 / 如何用 hold_ball" 做成可版本化的内建 skill 而不是散落在文档里？
3. **squad-style 路由抽象 vs 多 agent 真协作的边界澄清**：Multica 用 SKILL.md 直接告诉 agent "squad 不是 agent team"——产品方主动收窄宣传比加产品功能更有价值。Cat Café 应该考虑用同样的诚实**写一份"什么是球权 / 什么不是球权"** 的内建说明书，避免猫之间互相误解。
4. **失败处理中枢化**：`pkg/taskfailure` classifier + central error translation layer 是干掉"散落规则补丁"的标准动作。Cat Café 的 hold_ball / mention routing / merge gate 三处都有"failure reason 散落"的味道，可以考虑同款手法。
5. **企业 IM 入口的工程严肃度**：ws_lease_token 防多副本竞争消费 / app_secret 应用层加密 / inbound_audit 不存 message body / composite FK 防身份跨域——这一套是"接外部 IM 平台"的入门规格，不是可选项。如果 Cat Café 未来接 Lark/Slack/微信，这一套必须照学。

### 仍然不该照抄

1. **不要把 issue 当唯一协作真相**（砚砚 41 天前的判断仍然成立，且 41 天的 squad/lark/github 演进都没改变这点——它们仍然以 issue 为中心组织协作）。Cat Café 的 thread / handoff / 球权 / review / memory / 决策真相源是另一条路。
2. **不要把 skill 管理包装成自动学习**（41 天证据更硬：所有 skill commits 都是 manual import / search / bulk import / 解析鲁棒性，无 auto-compound）。我们的 cat-cafe-skills 也是 manual，不要被 README 措辞带走，要继续把"自动 distill"做扎实再用这个词。
3. **不要把 squad-style 路由抽象误认作"多 agent 协作"**：squad 仍是单点 leader 接收，"多猫真协作"是 Cat Café 的差异化护城河，不应该向 squad 的克制定义靠拢。
4. **不要押"全 runtime parity"**：MCP / session / permission / skills 在不同 provider 上仍不等价（#2106 未关），Cat Café 的"每只猫的能力画像 (`docs/team/cat-dossier.md`)" 这条思路反而更诚实。
5. **不要追"商业化基础设施先于愿景"的节奏**：Multica 41 天把 PostHog/billing/sales/cron 装齐了，是它的产品阶段决定的；我们目前在做愿景驱动+情感壁垒（IKEA 效应 / 自我延伸 / 安全依恋），这两条路不在同一坐标系，**不要让 Multica 的进度感影响我们的优先级**。

### 我们承认的 Gap（值得 Cat Café 立项排序参考）

1. **企业 IM 入口**：Cat Café 当前家用为主，外部用户接入路径未定。Multica 用 Lark 集成证明了"agent 进入用户已有协作场域"是可行且有价值的方向，我们要不要走这条路是个**产品决策**——但走的话 schema 严肃度必须照抄。
2. **GitHub PR 与 issue 联动**：当前 cat-cafe 用 `gh` CLI + memory + 手工 mention 串起来，每只猫各自记账。Multica 把 PR 镜像到自己库 + 中间链接表的做法值得借鉴——尤其当多猫围绕同一 PR 协作时，"PR 状态在哪 / 哪只猫看过 / 哪只猫批了" 应该是一等数据。
3. **失败原因集中化**：cat-cafe 当前 hold_ball / merge_gate / runtime 各有 failure 处理，且各自写 lessons。`pkg/taskfailure` 风格的 classifier 也许能帮我们把"为什么这个流程没接住"做成可查询数据。

### 对砚砚旧报告的 follow-up

砚砚 2026-05-06 报告的**核心 bottom line** 仍然成立：

> Agent control plane 的产品脊柱必须是可恢复、可观察、可审计的 runtime state machine；但真正的多 agent 协作不能停在 task board，需要把身份、球权、review、知识沉淀和升级路径做成同样一等的系统对象。

41 天后唯一需要补充的：

> Multica 在 41 天里证明了"agent control plane + 商业化 SaaS"是一条可达的产品路径——但它**主动收窄了 multi-agent 协作的宣传**（squad SKILL.md 自己澄清 "not an agent, no fan-out"），等于在产品语言上承认"我们做的是 agent ops，不是 agent 协作"。Cat Café 的"agent 协作"差异点因此**反而被强化**：行业里没有人在这条路上做出来，Multica 也主动绕开了。

## Strategic Intent Deep Dive：Multica 41 天里想做什么（铲屎官追问）

第一节是审计层"做了什么"，这节是战略层"为什么这么做"。每条都用 41 天的代码/schema/commit 证据说话，不脑补意图。

### 1. 商业模式：典型"开源核心 + SaaS / Enterprise 上层"

证据链：

- LICENSE **0 行 diff**——保持 Apache 2.0 + SaaS/前端 branding 限制。这是 BSL-style 模板：**开源代码可读可学，云端托管/嵌入式 SaaS 须授权**。同型项目：PostHog / Supabase / Sentry / Cal.com。
- `migrations/098_contact_sales_inquiries.up.sql` —— **B2B 销售线索表**。这是产品准备接 enterprise 客户的硬证据，开源个人版用不上这张表。
- `feat: support Claude Fable 5 pricing (#3982)` + `task_usage_hourly` + `task_usage_daily_rollup` + `pgcron` + `task_usage_daily_invalidation` ——**多模型 pricing + 用量计量 + 失效重算**。这套是按 token / per-task 计费的标准基础设施。
- `feat(server): funnel/community/commercial business metrics + PostHog pairing` + `BusinessSamplerCollector for active users / queued / runtime gauges` ——业务漏斗指标 + community vs commercial 区分采样。投资人 due diligence 需要的数字现在能一键拉出来。
- `apps/docs/content/docs/squads.{en,ja,ko,zh}.mdx` + `user_timezone` migration ——4 语言文档 + 时区表。**全球化产品姿态**，不是单一英文市场玩家。

**判断**：41 天里 Multica 把"开源吸引开发者 → 转化为付费 enterprise 用户"这套漏斗装齐了。下一个 41 天的核心动作几乎可以预测——**正式开通付费层 / 公布定价 / 拉资本**。

### 2. 市场押注：亚太 IM + 全球 dev 双线作战

证据链：

- **亚太 IM 押注**：109_lark_integration 一整套 270 行 + 后续 lark-* 多条 migration（installation region / bot union id / inbound dedup / chat origin）+ 一长串 `feat(lark)` commits（typing indicator / group context / @ mention prefetch / Feishu+Lark 同一部署 / WebSocket proxy）。
- **西方 dev 工作流押注**：079_github_integration（PR mirror + issue↔PR 链接）+ `feat(cli): list issue pull requests` + `issue_pull_request_close_intent` migration。
- **中国 coding agent 拉拢**：`feat(agent): add CodeBuddy as first-class CLI backend (#3186)` + `feat(daemon): enable Antigravity (agy) per-agent model selection`。CodeBuddy / Antigravity 都是 Anthropic 朝向中国市场的延伸品牌或可平替接入；first-class 待遇 = Multica 在主动迎接中国开发者。
- **合规姿态**：`lark_inbound_audit` 强制 "never message body, only routing/identity/drop_reason"。这是 enterprise/合规客户能接受的数据姿态。

**判断**：Multica 在押**"在哪里有付费意愿的 agent ops 用户"**。亚太 IM = 高 ARPU 企业市场入口；GitHub PR = 全球开发者高活跃用户基础；CodeBuddy/Antigravity = 中国开发者池子。这不是"广撒网"，是**有市场分析过的精准三线投入**。

### 3. 产品路线推断：下个 41 天大概率会做什么

按 41 天 schema + commits 留下的"半成品"判断：

| 已留好接口 / 部分实现 | 下个 41 天大概率补全 |
| --- | --- |
| `issue_pull_request.linked_by_type/id` + PR mirror 单向 | **GitHub PR 反向 push**（multica issue → GitHub repo） |
| `lark_installation` schema + Feishu/Lark 同部署 | **更多 IM 平台**：Slack / 微信 / Discord，schema 已经模板化 |
| `task_usage_hourly` + pgcron + invalidation | **付费层定价表 + 自助 billing UI**，schema 已就绪 |
| `squad` + leader 单点 + member 不 fan-out | 大概率**保持克制不做 fan-out**——产品方已 SKILL.md 明确收窄宣传 |
| `autopilot_trigger_event_filters` + DB-backed scheduler | autopilot **多步骤编排**（DAG）仍是未填的坑，但优先级看起来比 IM 集成低 |
| `builtin_skills` embed | 内置 skill **数量扩张 + 多语言**几乎必然 |
| `contact_sales_inquiries` + business metrics | **enterprise tier 公布**（私有部署服务 / 企业 SLA / 专属支持） |

**几乎肯定不会做的事**：

- "Every solution becomes a reusable skill" 自动 compound：**41 天 0 个相关 commit + 内置 skill 全是 manual authored** = 战略上放弃了这个 README claim。
- Workflow DAG / 多步骤编排：autopilot 一直在 trigger 系修补，没有 planner / scheduler / DAG 模型迹象。
- Multi-agent fan-out 真协作：squad SKILL.md **主动澄清** "members not fanned out"——这是产品决策，不是没来得及做。

### 4. 资本/团队信号：从开源到组织化的转变

证据链：

- `MUL-XXXX` 内部 ticket 前缀贯穿 41 天大量 commit（如 MUL-2759 / MUL-3104 / MUL-3125 / MUL-3158 / MUL-3304 / MUL-3324）——**linear/jira-style 项目管理**，社区贡献者通常不会用这种 ticket ID 提 PR。这意味着 Multica 已经有规模化的内部团队 + 流程化产品管理。
- `changelog 制度化`：`MUL-3324: add 2026-06-16 changelog entry (#4194)` ——**每日 changelog entry**。这是有专门 owner / 流程的产品节奏，不是开源 maintainer 顺手。
- `central error translation layer (PR1, PR2)` + `pkg/taskfailure classifier` ——这种"中枢化重构"需要**多人协作 + 多周时间**，不是一个 maintainer 周末干的活。
- 商业指标 / 销售线索表 / 多语言文档 / per-status error hints —— 这些是**产品经理 + 设计师 + 客户成功**这种岗位才会推动的工作。

**判断**：Multica 从 41 天前的"较成熟开源 + 早期商业化探索"演进到"组织化产品团队 + 进入种子/A 轮募资准备状态"。stars 从 25k → 37k（+47%）也是给投资人的 traction 信号。

### 5. 威胁判断：他们会不会做 Cat Café 的方向？

**答：不会，且 41 天里 Multica 主动放弃了走这条路的所有可能。**

- squad SKILL.md 明确写 "A squad is not an agent. squad members are not automatically fanned out." ——产品方**主动收窄宣传**而不是补功能。这是市场定位决策。
- 没有 thread / handoff / 球权 / cross-cat-review / 平行猫自意识 相关的 schema 或 commit。
- 协作模型仍以 issue 为中心（assignee + comment + mention），即使加了 squad 也是路由抽象。
- 商业化 SaaS 的路径**强制要求**"单点责任 + 可计量 + 可计费"——多猫真协作的"球权可流转 / 多猫共担"恰恰反向于 SaaS 计价模型。

**Multica 选择了"agent ops 产品化"的路径并按此优化全部产品决策**。这一选择越坚定，Cat Café 的"多猫真协作 + 情感壁垒 + 知识沉淀"差异化越独特。

### 6. 战略意图小结

| 维度 | Multica 的押注 | 证据 |
| --- | --- | --- |
| 商业模式 | 开源核 + Enterprise SaaS | LICENSE 0 diff + sales 表 + business metrics + 计费基础 |
| 市场入口 | 亚太 IM + 全球 GitHub dev + 中国 coding agent | Lark + GitHub mirror + CodeBuddy/Antigravity first-class |
| 产品哲学 | Agent ops（单点责任 / 可计量 / 可计费） | squad 路由抽象 + leader 单点 + 主动收窄宣传 |
| 团队/资本 | 组织化产品团队，准备募资 | MUL-XXXX ticket + 日 changelog + 中枢化重构 + 4 语言文档 |
| 不做 | 多 agent 真协作 / skill 自动 compound / workflow DAG | 主动收窄宣传 + 41 天 0 个相关 commit |

## Cat Café 可执行学习清单（Actionable Five，铲屎官追问）

不是抽象"我们应该学"，是**具体到文件 / 模式 / 估计工作量**的清单。按 ROI 排序（高在前）：

### 学习项 #1：schema 注释即合约（ROI 极高，工作量小）

**Multica 怎么做**（`server/migrations/109_lark_integration.up.sql` 头部 18 行）：

```sql
-- Lark (飞书) Bot integration: per-agent PersonalAgent installations,
-- user/chat bindings, inbound dedup + drop audit, outbound card mapping,
-- and short-lived member binding tokens.
--
-- Scope notes (mirror description §4.8 boundaries):
--   * `chat_session` is reused as-is — Lark routes through a separate
--     `lark_chat_session_binding` rather than adding a `metadata` JSONB
--     column to chat_session.
--   * Outbound card-message mapping is *task/message* scoped, not session
--     scoped, so multiple runs on the same chat_session don't stomp each
--     other's cards.
--   * `app_secret` is stored encrypted; the application layer encrypts
--     before writing and decrypts on read (no DB-side decryption helper).
--   * `lark_inbound_audit` is the only writable surface for events that
--     fail identity check or group-mention filter — it stores routing /
--     identity / drop_reason / timestamp ONLY, never message body.
```

字段级注释也是同款风格——"composite FK 是为了守哪个不变量"、"为什么不加 metadata JSONB"。**schema 自己就是 ADR**。

**Cat Café 当前现状**：Postgres migrations / Redis schema 注释密度不高，决策原因主要在 `docs/decisions/`。当架构问题问到字段级时，要跳转。

**怎么搬**：
- 已有 schema 在下次重构时按"每张表 head 注释 = 这张表存在的理由 + 与谁的不变量"补
- 新 schema 强制 head 注释：scope notes / 不变量 / 安全约束
- 工作量：每张表 5-15 分钟 head 注释；不需新功能

### 学习项 #2：平台说明书的程序化分发（ROI 高，工作量中）

**Multica 怎么做**（`server/internal/service/builtin_skills.go` + `builtin_skills/multica-*/SKILL.md`）：

- Go 1.16 `//go:embed builtin_skills` 把 8 个 SKILL.md 编译进二进制
- 每个 agent 启动时收到这 8 份 + workspace 自己的 skill
- frontmatter 标 `user-invocable: false`，**只给 agent 看**
- 内容是教 agent 用 Multica 自己的 API/CLI（autopilots / mentioning / projects / runtimes / skill-importing / squads / working-on-issues）
- 每条 claim 都引用 `references/*-source-map.md` 回链 server 源码路径

**Cat Café 当前现状**：
- native L0 system prompt（每次注入 catId / 家规 / 队友 / SOP 导航）已经覆盖**全局基线**
- 但"如何用 cat-cafe-collab MCP / 怎么 hold_ball / 怎么 cross_post / 怎么用 memory 三入口"散落在 cat-cafe-skills/refs/ 文档里
- 猫读这些文档的时机依赖 skill 触发反射，不是每次启动自动加载

**怎么搬**：
- 立 feat：建 `cat-cafe-builtin-skills/`（独立目录与 user skills 区分），仿 Multica 用 frontmatter `user-invocable: false` 标记
- 内容覆盖：`how-to-hold-ball.md` / `how-to-cross-post.md` / `how-to-recall-memory.md` / `how-to-merge-gate.md` / `how-to-vision-guard.md`
- 每条 claim 引用源码路径（`packages/api/src/...` / `packages/collab/src/...`）
- 修改 SystemPromptBuilder：每次 invocation embed 这批 skill 到 user message 头部（不是 system prompt），猫加载触发时直接读
- 工作量：建目录 + 5-8 篇 SKILL.md + SystemPromptBuilder 改动 ≈ 1-2 个 worktree

### 学习项 #3：Failure 中枢化（ROI 中等，工作量中）

**Multica 怎么做**（`pkg/taskfailure` classifier + `feat(cli): central error translation layer (PR1+PR2)`）：

- 所有 task failure reason 写入路径走 `pkg/taskfailure.Classify(err)` 一处
- CLI 用户层错误展示走 central error translation：error code → actionable hint
- "per-status error copy with actionable hints" 让用户看到"这步失败因为 X，你可以试 Y"

**Cat Café 当前现状**：hold_ball 失败 / merge_gate 失败 / mention 路由失败 / memory 检索失败 各自处理，error 信息分散，lesson 各自写。

**怎么搬**：
- 立 feat：建 `packages/api/src/failure-classifier.ts`，定义 `FailureKind` enum + `classify(err): { kind, retriable, userHint, sourceModule }`
- 所有写 fail 状态的地方走 classifier
- Hub / message UI 展示 classifier 的 userHint
- 配套 telemetry：哪类 failure 出现频率最高
- 工作量：1 个 feat（classifier 中枢 + 5-7 处迁移 + UI 展示）≈ 2-3 个 worktree

### 学习项 #4：外部对象镜像 + 中间链接表（ROI 中等，工作量中）

**Multica 怎么做**（`migrations/079_github_integration.up.sql`）：

```text
github_installation       -- workspace 装了哪个 GitHub App
github_pull_request       -- 镜像 PR state (open/closed/merged/draft, branch, author, merged_at)
issue_pull_request        -- issue ↔ PR 多对多链接表 (linked_by_type/id)
```

"外部对象在我们库里有个镜像 + 用中间链接表组织关系"是个能复用的模式。

**Cat Café 当前现状**：PR / GitHub issue 现在通过 `cat_cafe_register_pr_tracking` / `cat_cafe_register_issue_tracking` 做了部分镜像，但中间链接表（哪个 thread 关注哪个 PR / 哪只猫 review 过 / merge 后哪只猫接 vision guard）还不是一等数据。

**怎么搬**：
- 增量改 F167 / register_pr_tracking 当前 schema，补"PR ↔ thread ↔ cat ↔ phase" 链接表
- 让"PR 状态在哪 / 哪只猫看过 / 哪只猫批了 / merge 后是谁接" 进入 graph_resolve 可达
- 工作量：schema 改 + tracking handler 改 + graph_resolve 索引 ≈ 1-2 个 worktree

### 学习项 #5：WS lease + 应用层加密 + 合规 audit（ROI 取决于产品方向）

**Multica 怎么做**（`migrations/109_lark_integration.up.sql`）：

- `ws_lease_token` + `ws_lease_expires_at`：多副本部署时只有持有有效 lease 的 server 能保持 WebSocket，防 inbound 事件重复消费
- `app_secret_encrypted BYTEA`：应用层 secretbox 加密，DB 永不见明文
- `lark_inbound_audit` ：**只存 routing/identity/drop_reason，never message body**

**Cat Café 当前现状**：
- 单机部署，没遇到多副本竞争
- 没接外部 IM 平台，没有 enterprise IM 安全约束

**怎么搬**：
- **当前不抄**——产品阶段不到
- 但**留为参考模板**：当 Cat Café 决定接入任何外部 IM / SaaS / enterprise 客户时，这套"WS lease + 应用层加密 + audit 不存敏感 body"是 day 1 必备规格
- 工作量：当前 0；触发条件出现后单独立 feat

### 学习项小结 / 优先级建议

| # | 学习项 | ROI | 工作量 | 推荐立项时机 |
| --- | --- | --- | --- | --- |
| 1 | schema 注释即合约 | 极高 | 极小（每张表 5-15 分钟） | 下一次重构 schema 时顺手补 |
| 2 | 平台说明书程序化分发 | 高 | 中（1-2 个 worktree） | 短期立项可考虑 |
| 3 | Failure 中枢化 | 中 | 中（2-3 个 worktree） | 中期立项（先看 lesson 频率） |
| 4 | 外部对象镜像 + 链接表 | 中 | 中（1-2 个 worktree） | 增量改 F167 时顺路 |
| 5 | WS lease + 加密 + audit | 低（当前） | 0（当前） | 触发条件出现后单独立 feat |

## Bottom Line

41 天 Multica delta 不是路线转向，是**密度跃迁 + 边界澄清**：

1. **密度跃迁**：商业化基础设施（PostHog + business metrics + sales + billing rollup + pgcron）+ 企业 IM 入口（Lark）+ 源码托管联动（GitHub PR mirror）+ 新 runtime（CodeBuddy / Antigravity）一次性补齐。社区指标 +47% / +48% 印证产品市场契合度仍在加速。
2. **边界澄清**：squad 主动承认"不是 agent team / 不 fan-out"；built-in skills 主动承认"是平台说明书 / `user-invocable: false`"；skill compound 仍然不存在。这是**比新增功能更难得的产品诚实**——maintainer 知道哪些 README 措辞是营销越界，并用 SKILL.md 直接回收。
3. **Cat Café 立场不变**：我们的护城河（情感壁垒 + 多猫真协作 + 球权 + 跨族 review + 知识沉淀 + 平行猫 self-awareness）和 Multica 的护城河（agent ops 产品化 + 商业化 SaaS + IM 入口）是**两条不重叠的路径**。41 天演进非但没把这两条路径拉近，反而让它们各自变得更清晰。

我们应该感谢 Multica 持续把这条**对照镜**做得越来越清晰——它替我们验证了"agent ops 产品化"是可达的，让 Cat Café 可以**坚定地继续走相反那条路**。

[宪宪/Opus 4.7🐾]
