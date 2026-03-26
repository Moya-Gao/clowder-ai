---
feature_ids: [F140]
related_features: [F133, F139]
topics: [github, conflict-detection, review-comments, automation, pr-tracking]
doc_kind: spec
created: 2026-03-26
---

# F140: GitHub PR Automation — 冲突检测 + Review Comments 全来源感知

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

社区开发者（fork 用户）在讨论 AI 开发中的核心痛点：

> 郑亚林："当前我们都使用 AI 开发，存在的代码冲突比较会比较大，后面我们提交代码这部分怎么搞"
> 胡兴哲："猫猫挂 webhook，收到冲突，自动处理...比如别人 MR 了以后，我的代码有一条 message 是冲突，这块好像要增强一下"
> 胡兴哲："基于 github 就是几乎都可以自动"

铲屎官补充：

> "review 的不止是云端的 codex 而是你给他们的 comments 哦，这个估计也得覆盖？"
> "这个就是社区里那几个人讨论的那个，我们单独立项不要挂 F133"

**现状 Gap**：F133 解决了 CI/CD 状态追踪，但 PR 冲突检测和全来源 review comments 感知仍未闭环。F139 Phase 1a 已交付统一调度框架（TaskRunnerV2 + TaskSpec_P1），并注册了 `conflict-check` 和 `review-comments` 的骨架（gate 能感知，execute 是 stub）。本 Feature 补完 execute 层：投递 + 唤醒猫 + 自动处理。

## What

### Phase A: 投递管道 + 消息路由

在 F139 Phase 1a 已注册的 TaskSpec 基础上，实现 execute 函数的实际投递逻辑：

**1. ConflictRouter**
- 格式化冲突消息：哪个 PR、`mergeStateStatus` 变化（MERGEABLE → CONFLICTING）
- 通过 `deliverConnectorMessage()` 投递到注册 PR 的 thread
- `ConnectorInvokeTrigger` urgent 唤醒猫

**2. ReviewCommentsRouter**
- 格式化新 comments 消息：谁留的、在哪个文件、说了什么
- 覆盖所有来源：Codex 云端 review、人类 reviewer、猫通过 `gh pr review` 留的 comments
- 投递到 thread + 唤醒猫

**3. ConnectorSource 注册**
- `github-conflict`：冲突通知 connector（orange/warning 主题）
- `github-pr-comment`：PR comments connector（slate 主题，复用 GitHubIcon）

**4. ConnectorBubble 渲染**
- 两个新 connector 类型的图标渲染（复用 GitHubIcon SVG，按 connector 类型区分颜色/badge）

### Phase B: 猫自动处理

猫收到冲突/comments 通知后的自动响应能力：

**1. 冲突自动 resolve**
- 猫收到冲突通知 → 在 worktree 中 `git fetch origin main && git rebase origin/main`
- 自动解决简单冲突 → push → 等下一轮 CI 通知
- 复杂冲突（无法自动 resolve）→ 通知铲屎官

**2. Review comments 自动处理**
- 猫收到 comments 通知 → 读取 comment 内容 → 按 receive-review 模式处理
- 区分 comment 类型：request changes / approve / comment → 不同处理策略

## Acceptance Criteria

### Phase A（投递管道 + 消息路由）
- [ ] AC-A1: PR mergeable 状态从 MERGEABLE → CONFLICTING 时，冲突消息投递到注册 PR 的 thread
- [ ] AC-A2: 冲突消息通过 ConnectorInvokeTrigger urgent 唤醒猫
- [ ] AC-A3: GitHub PR 上的新 comments（不限来源）投递到注册 PR 的 thread
- [ ] AC-A4: Review comments 唤醒猫处理
- [ ] AC-A5: ConnectorSource `github-conflict` 和 `github-pr-comment` 注册，ConnectorBubble 正确渲染图标
- [ ] AC-A6: 冲突状态迁移去重 — CONFLICTING 后 push 新 commit 回到 MERGEABLE 不重复通知
- [ ] AC-A7: Comments cursor 去重 — 同一 comment 只通知一次，cursor 仅在 execute 成功后推进
- [ ] AC-A8: 测试覆盖：ConflictRouter + ReviewCommentsRouter 单元测试

### Phase B（猫自动处理）
- [ ] AC-B1: 猫收到冲突通知后能自动尝试 rebase resolve
- [ ] AC-B2: 简单冲突自动 resolve + push，复杂冲突通知铲屎官
- [ ] AC-B3: 猫收到 review comments 后按 receive-review 模式自动处理

## Dependencies

- **Evolved from**: F133（CI/CD tracking — 投递管道模式复用）
- **Blocked by**: F139 Phase 1a（统一调度框架 — ✅ 已合入 PR #747）
- **Related**: F139（conflict-check + review-comments TaskSpec 骨架由 F139 交付）

## Risk

| 风险 | 缓解 |
|------|------|
| `gh api` 查 mergeable 有延迟（GitHub 异步计算） | 首次 UNKNOWN 状态跳过，下一轮重查 |
| Comments 量大导致消息洪水 | cursor 去重 + 同一 PR 聚合通知（不逐条） |
| 自动 rebase 可能引入问题 | Phase B：复杂冲突不自动处理，通知铲屎官 |
| Fork PR 的 comments 权限差异 | `gh api` fallback 到公开 API |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 冲突通知的 priority 应该是 urgent 还是 normal？（冲突不如 CI 失败紧急？） | 待 Design Gate |
| OQ-2 | Review comments 是否需要区分 inline comment vs PR body comment？ | 待 Design Gate |
| OQ-3 | Phase B 自动 rebase 的触发条件是否需要铲屎官确认？ | 待 Phase B |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 基于 F139 统一调度，不搞独立 setInterval | 铲屎官指示"不太喜欢很多套东西" | 2026-03-26 |
| KD-2 | 投递管道复用 F133 的 deliverConnectorMessage() | 体验一致，代码复用 | 2026-03-26 |
| KD-3 | 独立立项不挂 F133 | 铲屎官指示"单独立项不要挂 F133" | 2026-03-26 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-26 | 社区开发者讨论 AI 开发冲突问题，铲屎官转述 |
| 2026-03-26 | 铲屎官确认单独立项，F140 kickoff |

## Review Gate

- Phase A: 砚砚 (codex/gpt52) cross-family review
- Phase B: 待定

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F133-cicd-tracking.md` | 投递管道模式来源 |
| **Feature** | `docs/features/F139-unified-schedule-abstraction.md` | TaskSpec 框架依赖 |
| **Issue** | [#668](https://github.com/zts212653/cat-cafe/issues/668) | ReviewRouter fallback 清理（前置工作） |
| **Issue** | [#669](https://github.com/zts212653/cat-cafe/issues/669) | F133 原始 issue |
