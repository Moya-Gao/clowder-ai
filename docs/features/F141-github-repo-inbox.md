---
feature_ids: [F141]
related_features: [F140, F133, F139]
topics: [github, webhook, repo-inbox, issue-discovery, pr-discovery, opensource]
doc_kind: spec
created: 2026-03-26
---

# F141: GitHub Repo Inbox — 仓库事件自动发现

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## 三层架构定位

```
① F141 发现层 (Repo Inbox) → "仓库里来了新东西"（本 Feature）
② 认领层 (Triage)           → "谁来跟？"（register_pr_tracking）
③ F140 追踪层 (PR Signals)  → "这个 PR 现在怎么样了？"（F139 轮询）
```

**产品域命名**：GitHub Automation > GitHub Repo Inbox > F141

## Why

铲屎官原话（2026-03-26 thread `F140 讨论`）：

> "你看之前的猫猫是如何知道什么时候要挂PR，什么时候要挂CICD的...有的应该是你们主动注册关注哪个 PR 或者 issue 但是有的又是怎么样的？被通知吗？还是都是要主动注册？"

砚砚分析（GPT-5.4）：

> "基本靠铲屎官/maintainer 人肉发现，再把球传给我们...当前最大缺口不是 tracked PR 的后续信号，而是我们根本不知道仓库里来了一个新的外部 PR / Issue"

**现状 Gap**：
- F133/F140 解决的是"已注册 PR 后续发生了什么"（追踪层）
- 但 maintainer 最痛的是"有个新东西出现了，系统完全没感知"（发现层）
- 社区 contributor 不用 Cat Café，不会调 `register_pr_tracking`
- 新 PR / 新 Issue 全靠铲屎官人肉当 webhook

## What

### Phase A: GitHub Webhook Adapter + Repo Inbox 投递

**1. GitHubWebhookAdapter**
- 复用现有 `POST /api/connectors/:connectorId/webhook` 通用端点
- 新增 `github-repo` webhook handler
- 校验：`X-Hub-Signature-256`、`X-GitHub-Event`、`X-GitHub-Delivery`
- `X-GitHub-Delivery` id 去重
- 事件归一化为 `RepoInboxSignal`

**2. 覆盖的 GitHub 事件**
- `pull_request.opened` — 新 PR 出现
- `issues.opened` — 新 Issue 出现
- `pull_request.ready_for_review` — draft → ready

**3. 投递路径**
```
GitHub webhook POST → GitHubWebhookAdapter
  → 校验签名 + delivery id 去重
  → 归一化 RepoInboxSignal
  → deliverConnectorMessage()          ← 统一消息管线
  → 投递到 maintainer inbox thread
  → 猫决定是否认领 → register_pr_tracking → 进入 F140 追踪
```

**4. ConnectorSource 注册**
- `github-repo-event`：仓库事件 connector（GitHub 品牌色主题）

**5. Skill/SOP 更新**
- `opensource-ops` SKILL.md：maintainer 收到 Repo Inbox 通知后的 triage 流程
- `refs/repo-inbox.md`：新增——Repo Inbox 通知格式、webhook 配置指南

### Phase B: Reconciliation 补偿扫描

**1. RepoScanTaskSpec**（F139 TaskSpec）
- 低频扫描（每 5-10min）
- `gh api` 查 open PRs / Issues
- 发现未在 tracking 中的新对象 → 补发通知
- 防 webhook 丢事件、防部署窗口漏消息

## Acceptance Criteria

### Phase A（Webhook Adapter + Repo Inbox）
- [ ] AC-A1: GitHub webhook `pull_request.opened` 事件自动投递到 maintainer inbox thread
- [ ] AC-A2: GitHub webhook `issues.opened` 事件自动投递
- [ ] AC-A3: GitHub webhook `pull_request.ready_for_review` 事件自动投递
- [ ] AC-A4: `X-Hub-Signature-256` 签名校验通过才处理
- [ ] AC-A5: `X-GitHub-Delivery` delivery id 去重
- [ ] AC-A6: ConnectorSource `github-repo-event` 注册，ConnectorBubble 正确渲染
- [ ] AC-A7: 投递走 deliverConnectorMessage() 统一消息管线
- [ ] AC-A8: 测试覆盖：GitHubWebhookAdapter 单元测试
- [ ] AC-A9: opensource-ops SKILL.md 更新 triage 流程
- [ ] AC-A10: refs/repo-inbox.md 新增（含 webhook 配置指南）

### Phase B（Reconciliation）
- [ ] AC-B1: RepoScanTaskSpec 低频扫描发现未追踪的 open PRs/Issues
- [ ] AC-B2: webhook 丢失事件后，reconciliation 补发通知

## Dependencies

- **Sibling**: F140（PR Signals 追踪层——认领后进入 F140）
- **Related**: F133（CI Signals——追踪层的一部分）
- **Related**: F139（TaskSpec 框架——Phase B reconciliation 使用）
- **Infra**: `POST /api/connectors/:connectorId/webhook`（通用 webhook 端点——复用传输层）

## Risk

| 风险 | 缓解 |
|------|------|
| GitHub webhook 配置需要 public URL | 文档引导 ngrok / cloudflare tunnel 方案；Phase B reconciliation 作为 fallback |
| webhook 丢事件（GitHub 不保证 exactly-once） | Phase B reconciliation 补偿扫描 |
| GitHub 不是 chat connector，语义不同 | 不硬塞 chat gateway 语义，独立 webhook handler |
| Fork 仓库的 webhook 权限 | 只配置在我们 maintain 的仓库上 |
| 多仓库事件量大 | 只转发 opened/ready_for_review 事件，其余 skip |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | maintainer inbox thread 是专门的"收件箱"thread 还是通知到 maintainer 的现有 thread？ | 待 Design Gate |
| OQ-2 | Issue 后续信号（comment、close、label）是否需要类似 F140 的追踪层？ | 以后 |
| OQ-3 | 多仓库支持：每个仓库一个 webhook 配置还是统一入口？ | 待 Design Gate |
| OQ-4 | webhook secret 配置存储在哪？cat-config.json 还是环境变量？ | 待 Design Gate |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Webhook 做主发现入口，定时扫描只做补偿 | 零延迟、精确、省 API 额度；扫描适合已知对象状态轮询，不适合新事件发现 | 2026-03-26 |
| KD-2 | 复用通用 webhook 端点传输层，不复用 chat connector 语义 | GitHub 不是 chat connector，repo 事件需先进 inbox 再路由，与 Feishu/Telegram 绑定模型不同 | 2026-03-26 |
| KD-3 | Issue discovery 和 PR discovery 在同一个 Repo Inbox | 都是"仓库新事件"，统一发现层 | 2026-03-26 |
| KD-4 | 独立立项不合并进 F140 | F140 = 追踪层（已注册 PR 信号），F141 = 发现层（新事件感知），不同抽象层级；铲屎官确认分开立项 | 2026-03-26 |
| KD-5 | 投递走 deliverConnectorMessage() 统一消息管线 | 与 F133/F140 体验一致，复用基础设施 | 2026-03-26 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-26 | F140 讨论中发现 maintainer 最大痛点是"发现层缺失" |
| 2026-03-26 | 铲屎官确认 F141 独立立项，可与 F140 并发开发 |

## Review Gate

- Phase A: 砚砚 (codex/gpt52) cross-family review
- Phase B: 待定

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F140-github-pr-automation.md` | PR Signals 追踪层 |
| **Feature** | `docs/features/F133-cicd-tracking.md` | CI Signals |
| **Feature** | `docs/features/F139-unified-schedule-abstraction.md` | TaskSpec 框架 |
| **Code** | `packages/api/src/routes/connector-webhooks.ts` | 通用 webhook 端点（复用传输层） |
