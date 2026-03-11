---
capsule_id: "F071-CLOSE-2026-03-11"
context: "F071 UX debt batch 完成收尾与真相源同步"
feature_ids: [F071]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- 把 D1/D2/D3 合成一个 debt batch 是对的，范围小但都直击高频聊天路径。
- 提取共享 `Lightbox.tsx` 后，消息图片、rich block 和待上传预览能统一体验，没有再长出第二套实现。
- review 链条有效，本地 review 抓到“测试没补齐”和 Enter 语义问题，云端 review 又补到了 `Shift+Enter` 这个细边角。

## What Failed
- PR 合入后没有同轮执行 feat close，导致 F071 明明已完成，却继续挂在 BACKLOG 里。
- D3 第一次修完后只解决了“能滚动”，没有解决“用户知道还能滚”和“键盘导航会跟着滚”，真实使用感还是断的。
- D1 的 spec 最初只记了已发送消息图片，没有第一时间把待上传图片预览写进 AC。

## Trigger Missed
- `feat-lifecycle` completion 没在 2026-03-07 当天执行，真相源同步滞后到了 2026-03-11。
- `quality-gate` 阶段没有把“滚动容器 + 键盘导航 + 隐藏滚动条场景”当成显式检查点。

## Doc Links
- `docs/features/F071-ux-debt-batch.md`
- `docs/features/F075-cat-leaderboard.md`
- `docs/mailbox/2026-03-07-f071-ux-debt-review-request.md`

## Rule Update Target
- `cat-cafe-skills/merge-gate/SKILL.md`：merge 完且满足 close 定义时，补一条“同轮提醒回到 feat-lifecycle completion”的检查。
- `cat-cafe-skills/quality-gate/SKILL.md`：为滚动型下拉/列表增加“键盘导航是否自动滚动到可见区域”和“隐藏内容是否有视觉提示”的检查项。
