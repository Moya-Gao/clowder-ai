# PR Signals 通知格式 + 处理策略

> F140: GitHub PR Signals — 冲突检测 + Review Feedback 全来源感知

## 三类通知

注册 PR tracking 后，你会收到三类自动通知：

| 类型 | ConnectorSource | 优先级 | 触发条件 |
|------|----------------|--------|----------|
| CI/CD 状态 | `github-ci` | fail=urgent, pass=normal | CI checks 完成（F133） |
| PR 冲突 | `github-conflict` | urgent | `mergeStateStatus` 变为 CONFLICTING（F140） |
| Review Feedback | `github-review-feedback` | changes_requested=urgent, 其余=normal | 新 comments / review decisions（F140） |

## 通知消息格式

### 冲突通知

```
⚠️ **PR 冲突**

PR #42 (owner/repo)
Commit: `abc1234`

当前分支与 base 存在冲突，需要 rebase 或手动解决。
```

### Review Feedback 通知（三分区聚合，OQ-2）

```
📋 **Review Feedback** — PR #42 (owner/repo)

--- Review Decisions ---
✅ **alice**: APPROVED — Ship it
🔄 **bob**: CHANGES_REQUESTED — Needs work

--- Inline Comments (1) ---
💬 **bob** `src/a.ts:5`: typo here

--- PR Conversation (1) ---
💬 **charlie**: great PR
```

## 处理策略

### 收到冲突通知

1. 在 worktree 中 `git fetch origin main && git rebase origin/main`
2. 自动解决简单冲突 → push → 等下一轮 CI 通知
3. 复杂冲突（无法自动 resolve）→ 通知铲屎官

### 收到 Review Feedback

1. 区分 review decision：
   - `CHANGES_REQUESTED` → 加载 `receive-review` skill，按 Red→Green 修复
   - `APPROVED` → 准备进入 merge-gate
   - `COMMENTED` → 阅读 comments，判断是否需要改动
   - `DISMISSED` → 记录，继续
2. Inline comments → 逐个定位代码位置，理解反馈后处理
3. Conversation comments → 理解讨论上下文后回应

## 去重机制

| 信号 | 去重方式 |
|------|----------|
| 冲突 | `lastConflictFingerprint = headSha:CONFLICTING`，MERGEABLE 时清除（KD-9） |
| Review Feedback | cursor-based：comment ID / review ID 单调递增，cursor 仅在 delivery 成功后推进（KD-10） |
| CI/CD | `lastCiFingerprint = headSha:bucket`（F133） |

## 配置

PR Signals 自动随 `register_pr_tracking` 生效，无需额外配置。轮询间隔：
- 冲突检测：5 分钟
- Review Feedback：1 分钟
- CI/CD：由 F133 CiCdCheckTaskSpec 控制
