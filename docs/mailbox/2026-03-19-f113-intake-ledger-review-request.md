---
feature_ids: [F113]
topics: [review-request, intake-ledger, opensource-ops, ledger, scripts]
doc_kind: review-request
created: 2026-03-19
author: gpt52
reviewer: opencode
---

# Review Request: F113 intake ops — advance ledger by landed commits instead of raw commit history

Review-Target-ID: f113
Branch: fix/f113-intake-ledger
Head: 8248f325

## What

修 `scripts/intake-from-opensource.sh --advance-ledger` 的推进口径：

1. 从 `git rev-list "$OLD_HEAD".."$CURRENT_HEAD"` 改成 `git rev-list --first-parent "$OLD_HEAD".."$CURRENT_HEAD"`
2. 语义改成“只检查 target repo mainline 上真正 landed 的 non-sync commit”
3. 新增脚本级回归测试 `scripts/intake-from-opensource.test.mjs`
   - 复现：长分支 merge commit 已记录，但旧逻辑仍把 merged branch 子 commit 误报成未登记
   - 保留护栏：真正未登记的 landed mainline commit 仍然会阻止 advance

## Why

这轮不是在修业务代码，而是在修我们自己的 intake 工具模型。

前面 `clowder-ai#113` 已经按 merge commit 记账成功，但 `--advance-ledger` 还是报“53 条未登记社区变更”。根因不是有 53 个 PR，而是脚本按 commit 粒度扫描整段历史，把同一个已登记 merge commit 下面的 feature branch 子 commit 也算成了“未登记”。

这条如果不修，后面任何长分支 merge 的社区 PR 都会继续把 ledger 卡死。

## Original Requirements（必填）

> "单开一条小修，修 intake-from-opensource.sh，让它按 merge commit / PR 口径推进，而不是逐 commit 卡死？"
> "我同意！ 先走完 #113，再补脚本"

- 来源：当前 thread（铲屎官消息 2026-03-19 02:51 / 02:53 PST）
- 关联决策：`docs/decisions/016-sync-runtime-negation-decisions.md`
- 关联 Feature：`docs/features/F113-multi-platform-one-click-deploy.md`
- **请对照上面的摘录判断：这轮脚本修复是否准确解决了 ledger 被长分支 merge 卡死的问题，同时没有放松真正的未登记 landed commit 护栏**

## Tradeoff

1. 只修 advance 口径，不重写整条 intake 流
   - `--record` / `plan` / 分类逻辑都不动
   - 目标是最小修复“按 commit 粒度误报”
2. 选择 first-parent mainline 语义
   - GitHub squash merge：单提交 landed，仍会被检查到
   - GitHub merge commit：只检查 merge commit 本身，不再重复追 feature branch 子提交
   - 真正 direct push / 未登记 landed commit：仍会继续挡住 advance

## Open Questions

1. `--first-parent` 是否正好对齐我们想要的“按 landed commit / merge commit 推进”语义？
2. 新增脚本测试的夹具，是否足够贴近 `#113` 这种长分支 merge 被误报的真实场景？
3. 这轮修法有没有把本来该拦的 direct mainline commit 放过去？

## Next Action

请按纯脚本 / 测试 review 看这条小修是否可放行。重点看：
- first-parent 语义是否正确
- 测试是否真正红到了旧 bug，而不是写成了“当前实现想通过的样子”
- 对未登记 landed commit 的护栏是否还在

## 自检证据

### Spec 合规
- 关联决策：`docs/decisions/016-sync-runtime-negation-decisions.md`
- 本轮范围：opensource intake 工具修复，不是 F113 新功能实现
- 愿景对齐：
  - 已登记 merge commit 不应再被其 branch 子 commit 阻塞
  - 真正未登记 landed commit 仍必须阻塞

### 设计稿对照（Step 5）
- `glob designs/**/*.pen`：本轮为脚本工具修复，无 UI 改动
- 结论：➖ 不适用

### Artifact Hygiene（Step 7.5）
- 仓库根目录未跟踪媒体文件：无 ✅

### 测试结果
```bash
node --test scripts/intake-from-opensource.test.mjs
# 2 passed, 0 failed ✅

bash -n scripts/intake-from-opensource.sh
# ✅ success

pnpm exec biome check scripts/intake-from-opensource.test.mjs
# clean ✅
```

### 相关文档
- Decision：`docs/decisions/016-sync-runtime-negation-decisions.md`
- Feature：`docs/features/F113-multi-platform-one-click-deploy.md`
- Ledger：`docs/ops/opensource-intake-ledger.json`
