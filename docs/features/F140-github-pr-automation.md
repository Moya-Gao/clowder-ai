---
feature_ids: [F140]
related_features: [F133, F139, F141]
topics: [github, conflict-detection, review-feedback, pr-signals, automation]
doc_kind: spec
created: 2026-03-26
---

# F140: GitHub PR Signals — 冲突检测 + Review Feedback 全来源感知

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## 三层架构定位

```
① F141 发现层 (Repo Inbox) → "仓库里来了新东西"（webhook 被动推送）
② 认领层 (Triage)           → "谁来跟？"（register_pr_tracking）
③ F140 追踪层 (PR Signals)  → "这个 PR 现在怎么样了？"（F139 轮询）
     └─ F133: CI Signals (done)
     └─ F140: Conflict + Review Feedback Signals (本 Feature)
```

**产品域命名**：GitHub Automation > GitHub PR Signals > F140

## Why

社区开发者（fork 用户）在讨论 AI 开发中的核心痛点：

> 郑亚林："当前我们都使用 AI 开发，存在的代码冲突比较会比较大，后面我们提交代码这部分怎么搞"
> 胡兴哲："猫猫挂 webhook，收到冲突，自动处理...比如别人 MR 了以后，我的代码有一条 message 是冲突，这块好像要增强一下"
> 胡兴哲："基于 github 就是几乎都可以自动"

铲屎官补充：

> "review 的不止是云端的 codex 而是你给他们的 comments 哦，这个估计也得覆盖？"
> "这个就是社区里那几个人讨论的那个，我们单独立项不要挂 F133"

**角色需求**（砚砚 GPT-5.4 分析）：

- **Contributor 最想知道**："我现在要不要动手？"
  - 冲突出现 → 要动手 rebase
  - review feedback（comments + requested changes）→ 要动手改
  - approved → 可以准备 merge

- **Maintainer 最想知道**："这个 PR 现在是 ready、blocked、还是需要我介入？"
  - 冲突 → PR blocked
  - review state 变化 → PR 进展
  - approved → 可能 ready

**现状 Gap**：F133 解决了 CI/CD 状态追踪，但 PR 冲突检测和全来源 review feedback 感知仍未闭环。F139 Phase 1a 已交付统一调度框架（TaskRunnerV2 + TaskSpec_P1），并注册了 `conflict-check` 和 `review-comments` 的骨架（gate 能感知，execute 是 stub）。本 Feature 补完 execute 层：投递 + 唤醒猫 + 行为引导。

## What

### Phase A: 投递管道 + 消息路由 + 行为引导

在 F139 Phase 1a 已注册的 TaskSpec 基础上，实现 execute 函数的实际投递逻辑：

**1. ConflictRouter**
- 格式化冲突消息：哪个 PR、`mergeStateStatus` 变化（MERGEABLE → CONFLICTING）
- 通过 `deliverConnectorMessage()` 投递到注册 PR 的 thread
- `ConnectorInvokeTrigger` urgent 唤醒猫

**2. ReviewFeedbackRouter**
- 格式化 review feedback 消息：
  - 新 comments：谁留的、在哪个文件、说了什么
  - review decision 变化：approved / requested changes / dismissed
- 覆盖所有来源：Codex 云端 review、人类 reviewer、猫通过 `gh pr review` 留的 comments
- 投递到 thread + 唤醒猫

**3. ConnectorSource 注册**
- `github-conflict`：冲突通知 connector（orange/warning 主题）
- `github-review-feedback`：Review feedback connector（slate 主题，复用 GitHubIcon）

**4. ConnectorBubble 渲染**
- 两个新 connector 类型的图标渲染（复用 GitHubIcon SVG，按 connector 类型区分颜色/badge）

**5. Skill/SOP 更新**（行为引导——没有 Skill 引导的信号投递 = 无效）
- `merge-gate` SKILL.md：告知猫猫注册 PR 后会收到三类通知（CI + 冲突 + review feedback）
- `receive-review` SKILL.md：补充 GitHub PR review feedback 入口的处理流程
- `opensource-ops` SKILL.md：maintainer 处理社区 PR 的冲突/review 状态
- `refs/pr-signals.md`：新增——PR Signals 通知格式、处理策略、配置说明

### Phase B: 猫自动处理

猫收到冲突/review feedback 通知后的自动响应能力：

**1. 冲突自动 resolve**
- 猫收到冲突通知 → 在 worktree 中 `git fetch origin main && git rebase origin/main`
- 自动解决简单冲突 → push → 等下一轮 CI 通知
- 复杂冲突（无法自动 resolve）→ 通知铲屎官

**2. Review feedback 自动处理**
- 猫收到 review feedback 通知 → 读取内容 → 按 receive-review 模式处理
- 区分 review decision：requested changes / approve / comment → 不同处理策略

## Acceptance Criteria

### Phase A（投递管道 + 消息路由 + 行为引导）
- [ ] AC-A1: PR mergeable 状态从 MERGEABLE → CONFLICTING 时，冲突消息投递到注册 PR 的 thread
- [ ] AC-A2: 冲突消息通过 ConnectorInvokeTrigger urgent 唤醒猫
- [ ] AC-A3: GitHub PR 上的新 comments（不限来源）投递到注册 PR 的 thread
- [ ] AC-A4: Review decision 变化（approved / requested changes / dismissed）投递到 thread
- [ ] AC-A5: Review feedback 唤醒猫处理
- [ ] AC-A6: ConnectorSource `github-conflict` 和 `github-review-feedback` 注册，ConnectorBubble 正确渲染图标
- [ ] AC-A7: 冲突状态迁移去重 — CONFLICTING 后 push 新 commit 回到 MERGEABLE 不重复通知
- [ ] AC-A8: Comments/review cursor 去重 — 同一 comment/review 只通知一次，cursor 仅在 execute 成功后推进
- [ ] AC-A9: 测试覆盖：ConflictRouter + ReviewFeedbackRouter 单元测试
- [ ] AC-A10: merge-gate / receive-review / opensource-ops SKILL.md 更新
- [ ] AC-A11: refs/pr-signals.md 新增

### Phase B（猫自动处理）
- [ ] AC-B1: 猫收到冲突通知后能自动尝试 rebase resolve
- [ ] AC-B2: 简单冲突自动 resolve + push，复杂冲突通知铲屎官
- [ ] AC-B3: 猫收到 review feedback 后按 receive-review 模式自动处理

## Dependencies

- **Evolved from**: F133（CI/CD tracking — 投递管道模式复用）
- **Blocked by**: F139 Phase 1a（统一调度框架 — ✅ 已合入 PR #747）
- **Sibling**: F141（Repo Inbox 发现层 — 不阻塞，可并发）
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
| OQ-2 | Review comments 是否需要区分 inline comment vs PR body comment vs review summary？ | 待 Design Gate |
| OQ-3 | Phase B 自动 rebase 的触发条件是否需要铲屎官确认？ | 待 Phase B |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 基于 F139 统一调度，不搞独立 setInterval | 铲屎官指示"不太喜欢很多套东西" | 2026-03-26 |
| KD-2 | 投递管道复用 F133 的 deliverConnectorMessage() | 体验一致，代码复用 | 2026-03-26 |
| KD-3 | 独立立项不挂 F133 | 铲屎官指示"单独立项不要挂 F133" | 2026-03-26 |
| KD-4 | ReviewFeedbackRouter（非 ReviewCommentsRouter）| 砚砚指出：contributor 在乎的不是"有没有 comment"，而是"review feedback 有没有改变 PR 的下一步动作"。只追 comments 不追 decision，信息不完整 | 2026-03-26 |
| KD-5 | review decision state（approved/requested changes/dismissed）进 Phase A | 比 label/assignee 更有行动价值：contributor 看到 requested changes 才知道"现在该改"，maintainer 看到 approved 才知道"可能 ready" | 2026-03-26 |
| KD-6 | Skill/SOP 更新是 Phase A 必须组件 | 铲屎官指出：技术管道建了没有行为引导 = 通知发了猫不知道怎么处理 = 等于没做。F133 Phase B 就是做这件事 | 2026-03-26 |
| KD-7 | F140 定位为追踪层（PR Signals），发现层（Repo Inbox）独立为 F141 | 铲屎官确认分开立项，可并发开发 | 2026-03-26 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-26 | 社区开发者讨论 AI 开发冲突问题，铲屎官转述 |
| 2026-03-26 | 铲屎官确认单独立项，F140 kickoff |
| 2026-03-26 | 与砚砚讨论：命名体系（GitHub PR Signals）+ 角色需求矩阵 + ReviewFeedbackRouter |
| 2026-03-26 | 铲屎官指出 Skill/SOP 软文化层缺失，补入 Phase A |
| 2026-03-26 | 与砚砚讨论触发模型：三层架构收敛（发现/认领/追踪），F141 独立立项 |

## Review Gate

- Phase A: 砚砚 (codex/gpt52) cross-family review
- Phase B: 待定

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F141-github-repo-inbox.md` | 发现层（Repo Inbox） |
| **Feature** | `docs/features/F133-cicd-tracking.md` | CI Signals（追踪层兄弟） |
| **Feature** | `docs/features/F139-unified-schedule-abstraction.md` | TaskSpec 框架依赖 |
| **Issue** | [#668](https://github.com/zts212653/cat-cafe/issues/668) | ReviewRouter fallback 清理（前置工作） |
| **Issue** | [#669](https://github.com/zts212653/cat-cafe/issues/669) | F133 原始 issue |
