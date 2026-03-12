---
capsule_id: "F098-2026-03-12"
context: "Callback Message UX 全 Phase（A/B/B.5/C/D + cleanup）完成后的反思"
feature_ids: [F098]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- 分 Phase 推进是对的：A 先解决方向标注与 A2A 刺眼，B/B.5 收 Evidence 与 connector 主题，C/D 再补元数据与双时间，能边交付边收敛，不会被一个大需求卡死。
- 本地 review + 云端 review 的双层闭环有效，几次关键问题都是真问题：`source.meta` 序列化、`targetCats` 实时广播、Tailwind content scan、分支混入 F075，都在合入前被拦住了。
- Connector 主题注册表化（Phase B.5）是面向终态的正确动作，提前把 iMessage 这类未来平台的扩展口打开了，而不是继续堆 if-else。
- Phase C 和 AC-A2 合并推进是对的：先补 `targets` 元数据，再做 multi_mention 方向标注，前后端契约一次闭环。
- Phase D 选“双时间标注”而不是重排时间线也对，既保留实时体验，又把“发送 vs 收到”的回顾歧义消掉了。

## What Failed
- Close 文档闭环没有在 F098 全部合入后立刻完成，直到铲屎官点名“愿景守护 + feat close”才回来补，说明 completion 真相源同步还是不够主动。
- 我们一开始对 AC-A2 的理解有偏差，错误地把 multi_mention 当成普通 callback 路径，后来被 review 指出其实走的是 connector 路径，导致中途多了一次错误 pushback。
- F098 cleanup 分支混入了 F075 提交，说明最后一轮“清债”时对分支瘦身警惕性不够，还是靠 review 才兜住。
- `/messages` 序列化这类“写入 OK、读取漏字段”的链路问题，还是在 reviewer 提醒后才补 route-level 回归测试，测试意识比实现慢了一拍。

## Trigger Missed
- `feat-lifecycle` completion 应该在最后一个 cleanup PR 合入后立即触发，但当时只做了 phase doc sync，没有立刻补反思胶囊、BACKLOG 移除和 completed 索引登记。
- Phase C 第一次收到 P1 时，我应该先核后端真实路由，再判断 pushback 是否成立，而不是先凭前端路径印象下结论。
- cleanup 分支开工前应该主动做一次 `git log main..HEAD` / `git diff --stat main..HEAD` 范围核对，避免无关提交混入后再靠 reviewer 发现。

## Doc Links
- Feature spec: `docs/features/F098-callback-message-ux.md`
- Design: `designs/f098-callback-message-ux.pen`
- Phase A PR: https://github.com/zts212653/cat-cafe/pull/379
- Phase B PR: https://github.com/zts212653/cat-cafe/pull/383
- Phase B.5 PR: https://github.com/zts212653/cat-cafe/pull/385
- Phase C PR: https://github.com/zts212653/cat-cafe/pull/387
- Phase D PR: https://github.com/zts212653/cat-cafe/pull/390
- Cleanup PR: https://github.com/zts212653/cat-cafe/pull/399

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion：最后一个 cleanup / follow-up PR 合入后，也必须立即回到 Step 0.5-6，把反思胶囊、BACKLOG、已完成索引一次补齐。
- `cat-cafe-skills/request-review` / `receive-review` 的执行习惯：遇到“路径归属”类争议（callback vs connector）时，先查真实后端路由和序列化链路，再决定是否 pushback。
- `merge-gate` 前自检习惯：补一个固定检查项 `git diff --stat main..HEAD`，防止 cleanup 分支混入其他 Feature。
