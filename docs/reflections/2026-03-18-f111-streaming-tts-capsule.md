---
capsule_id: "F111-2026-03-18"
context: "F111 Phase A/B 全量完成后的反思"
feature_ids: [F111]
doc_kind: capsule
created: 2026-03-18
---

## What Worked
- 先做 Phase A 的 `/api/tts/stream` 验证，再升级到 Phase B 的 route-serial token speech pipeline 是对的。我们先证明“分句合成能显著降首音延迟”，再把 LLM token 流并进来，风险和 review 范围都更可控。
- 后端 speech stream 和前端 PlaybackManager 分拆成 F111/F112 协同实现是对的。边界清楚后，review 很快就能定位是“后端生产者”问题还是“前端消费者”问题。
- 本地 reviewer + 云端 reviewer 的双层闭环很有价值。F111 的播放状态机、fallback 双播和零 chunk 边界，都是在合入前被连续拦下来的。

## What Failed
- 文档时间线曾经出现“按记忆写日期”而不是按实际 merge/commit 写日期，导致 Phase B 完成日期漂移到 2026-03-18。close 时如果不重新核 git/PR，就会把错日期固化成真相源。
- 一开始把实时语音主触发器绑在 rich block/fallback 路径上，导致我们在“实时流”和“持久化回放”之间来回打架，双播问题被放大。
- Phase close 当时只做了 phase sync，没有顺手把 `features/README` 的 F111 行收口到 `done`，留下了“spec done 但索引仍显示 impl”的真相源漂移。

## Trigger Missed
- 在 Phase B 开工前，应该更早触发“实时主路径 vs fallback 主路径”的单一真相源讨论，而不是等实现里出现双播才补。
- merge-gate 的 Phase 文档同步后，应该立刻补一次“README/BACKLOG/feature header 是否一致”的收尾检查。
- 当铲屎官第一次实测延迟后，应该立刻把“CLI 冷启动不是 F111 范围”这个结论写进 close 守护结论，而不是只留在线程里。

## Doc Links
- Feature spec: `docs/features/F111-streaming-tts-chunker.md`
- Phase A PR: https://github.com/zts212653/cat-cafe/pull/522
- Phase B PR: https://github.com/zts212653/cat-cafe/pull/529
- Latency report commit: `26399fe3`

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` §Completion Step 0：完成判定时除了核 PR/commit，还要顺手核对 `features/README` 和 `BACKLOG`，避免 phase sync 后索引残留旧状态。
- `cat-cafe-skills/merge-gate/SKILL.md` Step 7.5：时间线记录必须以实际 merge commit / PR mergedAt 为准，不按会话记忆手填日期。
- `docs/features/F112-voice-playback-queue.md` / 未来所有 voice feature spec：实时主触发器与 fallback 触发器必须在 What 段明确，禁止实现期再猜。
