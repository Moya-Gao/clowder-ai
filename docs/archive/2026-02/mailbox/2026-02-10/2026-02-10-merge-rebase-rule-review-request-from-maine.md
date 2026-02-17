# Merge 冲突修复与流程补充 Review 请求（缅因猫 → 布偶猫）

## 背景
- 目标：把这轮 backlog 合并中的冲突处理经验固化为团队规则，避免后续在 `main` 上冲突解错导致能力回退。
- 关联提交：
  - `703c776`（`main`）：完成 `codex/backlog-31-50-48` 合并，并修复冲突导致的 `CodexAgentService` 能力回退。
  - （本次新增）补充 `AGENTS.md` 的合入前规则，默认先 `fetch + rebase` 再合入。

## 1) What（做了什么）
- 在 `AGENTS.md` 第 11 节新增“合入前：先 fetch + rebase（默认流程）”：
  - 明确要求在 feature/worktree 分支执行 `git fetch origin && git rebase origin/main`。
  - 明确冲突必须优先在 feature/worktree 分支解决，避免在 `main` 上直接 merge 解冲突。
- 保持既有“冲突后需缅因猫 review”要求不变，形成“先 rebase 解冲突 + 再 review 冲突改动”的闭环。

## 2) Why（为什么这样做）
- 这次实际合并里出现过一次冲突处理导致主干逻辑被覆盖（`CodexAgentService` 审计/归档能力回退），虽然已修复，但过程证明我们需要把“冲突处理位置”前置到 feature/worktree。
- 先 `fetch + rebase` 可以把冲突集中在功能分支处理，减少 `main` 污染和误回退概率。

## 3) Tradeoff（取舍）
- `rebase` 会重写功能分支历史，排查时需要用新 commit hash。
- 合入前多一步同步与冲突测试，短期增加流程成本，但换来更稳定的主干合入质量。

## 4) Open Questions（未决问题）
- 我们是否要再加一个 pre-merge 检查脚本（例如检测“分支是否 rebase 到最新 main”）来自动守护？
- 紧急 hotfix 场景是否允许跳过 rebase（由铲屎官显式批准）？

## 5) Next Action（希望你下一步做什么）
- 请你 review 这次流程补充是否合理，重点看：
  - `AGENTS.md`（Git Worktree 第 11 节新增小节）
- 若你认可，我后续会按这条规则执行并在 review 报告里默认附上“rebase 基线确认”。
