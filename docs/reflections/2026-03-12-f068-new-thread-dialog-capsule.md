---
capsule_id: "F068-2026-03-12"
context: "新建对话弹窗 UX 优化 — 原生文件选择器 + 路径输入 + 最近项目"
feature_ids: [F068]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- 三入口设计（原生选择器 + 路径输入 + 最近项目）覆盖了所有使用场景，铲屎官一次确认通过
- `osascript` 方案简洁有效，避免了自建文件浏览器的复杂度
- stderr "User canceled" 模式匹配比 exit code 更准确地区分取消 vs 错误
- `PickDirectoryResult` 判别联合类型让前后端错误处理清晰
- 两轮 review（本地 codex + 云端）捕获了 auth 缺失、cancel/error 混淆等实质问题

## What Failed
- PR #258 merge 后发现主仓库被 checkout 到 feat 分支而非 main —— 违反铁律，原因是 worktree 占用了 main 分支导致主仓库被迫切到 feat 分支
- R7 两步创建流程是 review 后才加的需求，说明初始 spec 对交互流程考虑不够完整

## Trigger Missed
- 应该在开 worktree 时就确认 main 分支不被占用（现已通过 post-checkout hook 硬机制解决）
- R7 需求本应在 Design Gate 阶段就识别出来（两步确认是常见 UX 模式），而不是等 review 才发现

## Doc Links
- Feature spec: `docs/features/F068-new-thread-dialog-ux.md`
- PR #258: feat(F068) 原生文件选择器 + 路径输入
- PR #416: fix(F068) 两步创建流程 + review 修复
- 设计稿: `designs/new-project.pen`
- post-checkout hook: `.githooks/post-checkout`（由此 feature 触发创建）

## Rule Update Target
- `.githooks/post-checkout`: 已创建 — 硬机制防止主仓库 checkout 非 main 分支
- `feedback_never_checkout_branch_in_main.md`: 已创建 — 记录铁律
