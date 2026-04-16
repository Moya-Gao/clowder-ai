---
capsule_id: "F164-2026-04-16"
context: "F164 Thread Snapshot Persistence — 断网 F5 不再白屏"
feature_ids: [F164]
doc_kind: capsule
created: 2026-04-16
---

## What Worked

- **Phase 拆分清晰**：Phase A（数据层：IndexedDB 快照 + cache-first hydration）和 Phase B（体验层：连接状态 + 离线降级 + CDN 自托管）正交互补，Phase A 独立可用且能立刻解决铲屎官痛点
- **Write-through fire-and-forget 模式**：IDB 写入不阻塞主线程，性能无回退。这个模式可复用于后续需要客户端缓存的场景
- **Failure threshold 防抖**：连接探测需要连续 2 次失败才降级，但恢复时立即生效——不对称设计避免了抖动时的 UI 噪声
- **跨 family review 抓出真 bug**：R1 review 发现了 fetchHistory 返回值丢失导致 badge 清除逻辑失效（P1-1）和 replace 分支漏写 IDB（P1-2），R2 抓到了 cross-thread badge 泄漏（P2），这些都是靠眼睛看代码发现的竞态问题
- **`next/font/google` 选型正确**：Next.js 官方推荐的字体自托管方式，build 时下载、runtime 从 `_next/static` 自 serve，零额外基础设施

## What Failed

- **Phase B 代码未经 biome check 就提交**：Codex 的 commit 有 import 排序错误，`pnpm gate` 在 check 步骤失败。这属于提交前应该跑的基础检查
- **Phase B .gitignore 修复落在了错误 worktree**：Codex 把 P1 修复应用到主 worktree 而非 feature branch worktree，差点导致 PR 合入后 main 上没有这个改动。worktree 多了容易搞混
- **Phase B 代码泄漏到主 worktree**：session 开始时主 worktree 就有 Phase B 的修改文件和新文件，pull 时产生冲突。原因可能是某个 session 在主 worktree 而非 feature worktree 里做了开发

## Trigger Missed

- **应该在 Phase B review 前提醒 Codex 跑 `pnpm check`**：review request 流程里有 quality-gate 前置条件，但 biome 格式检查仍然漏了。说明 quality-gate 的执行力度取决于执行者
- **应该在 review 时检查 .gitignore 是否在正确分支上**：review 只看了改动内容是否正确，没验证改动是否落在正确的 git 分支。这是 worktree 场景下的额外检查点

## Doc Links

- Feature spec: `docs/features/F164-thread-snapshot-persistence.md`
- Phase A plan: `docs/plans/2026-04-15-f164-thread-snapshot-persistence-phase-a.md`
- Phase A review request: `docs/mailbox/2026-04-15-f164-phase-a-review-request.md`
- Phase B review R1: `docs/mailbox/2026-04-16-f164-phase-b-review-R1.md`
- Related: F080（当时明确"不做前端本地缓存"的决策被 F164 重新审视）

## Rule Update Target

- `cat-cafe-skills/quality-gate/SKILL.md`：考虑在 Step 6 的 `pnpm check` 后加提醒——提交到 feature branch 前，确认改动确实在目标 worktree 上（`git -C {worktree} status`），而非主 worktree
- `cat-cafe-skills/request-review/SKILL.md`：review 请求的前置条件可以加一条"确认 git status 只在目标 worktree 有变更"
