---
capsule_id: "F112-2026-03-18"
context: "F112 Phase A/B/C 收口后的反思"
feature_ids: [F112]
doc_kind: capsule
created: 2026-03-18
---

## What Worked
- 把 F112 拆成 Phase A（实时 PlaybackManager）、Phase B（播放器统一）、Phase C（VAD 打断）是对的。每一刀都对应铲屎官能感知的体验收益，review 也能集中在单一状态机上。
- 先把 Signal Study 的“预生成播客”与 realtime voice pipeline 区分开，再决定只统一播放器、不强行做双猫实时编排，是正确的 scope 收敛。
- PlaybackManager 作为统一内核很值：实时 `voice_chunk`、PodcastPlayer、以及后来的 VAD 打断，都能围绕同一个中断/暂停/续播语义扩展。

## What Failed
- Phase B 一开始低估了 async 播放控制的复杂度：stale fetch、batch gap stall、silent failure cleanup、stale promise wipe，说明我们最初没有把异步回流和 UI 状态一致性当成一等问题。
- Phase C 初版只打断了 PlaybackManager，没有覆盖 `useVoiceAutoPlay` fallback 通路，暴露出我们对“系统里到底有几条播放链路”认识不完整。
- 文档层面也有漂移：F112 已经三期都合入，但主 spec 仍停在 `in-progress`，`BACKLOG` 也没清掉。

## Trigger Missed
- 在 Phase B 开工前，应该先列一张“播放状态机并发回归矩阵”，把 stop/switch/fetch reject/slow fetch 这些边界条件一次性列出来，而不是靠多轮 review 逐个补洞。
- 在 Phase C 设计时，应该先盘清“所有会发声的路径”，而不是默认 VAD 只要打断 PlaybackManager 就够了。
- 当原始 Phase B 需求被确认“暂无场景”时，应该立刻把 feature close 条件写清楚，避免 feature 永远挂在 `in-progress`。

## Doc Links
- Feature spec: `docs/features/F112-voice-playback-queue.md`
- Phase A PR: https://github.com/zts212653/cat-cafe/pull/529
- Phase B PR: https://github.com/zts212653/cat-cafe/pull/535
- Phase C PR: https://github.com/zts212653/cat-cafe/pull/538

## Rule Update Target
- `cat-cafe-skills/tdd`：为播放器/语音状态机补一份固定并发回归清单（stop、switch、slow fetch、silent failure、stale promise）。
- `cat-cafe-skills/feat-lifecycle/SKILL.md` §Completion：当 feature 仍有“future archive”段但铲屎官已明确“暂无场景”时，允许 close，并把未来设计留在 spec 的 Future 节点而不是留在 BACKLOG。
- `docs/features/F112-voice-playback-queue.md` 以及后续 voice 功能 spec：必须显式列出所有播放通路（realtime / fallback / offline player），避免 VAD 或 interrupt 只打中一半链路。
