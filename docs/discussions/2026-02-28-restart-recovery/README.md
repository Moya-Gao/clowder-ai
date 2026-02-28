---
feature_ids: [F048]
topics: [restart, recovery, queue, redis]
doc_kind: discussion
created: 2026-02-28
---

# Discussion: Restart Recovery（重启自愈）

## Context

F039（消息排队投递）完成后，我们讨论了“队列持久化到 Redis（重启不丢队列）”是否值得做。由于我们当前执行模型会拉起外部子进程（如 `codex` CLI）流式输出，重启会直接影响 in-flight invocation 的语义与体验。

## 铲屎官原始需求摘录（≤5 行）

> “我建议你可以立一个新的 feat 把完整的 redis 重启恢复能力变成一个 F39 后续独立完整的 feat？避免只是部分内容？”  
> “要做就把体验做完整？如果有重启，原本在跑的 invocation 如何恢复，在队列里的如何恢复等等全套流程都做完比较好？”  
> “不然的话执行出来的结果会非常诡异？”

## Decision

立项为独立 Feature：**F048 Restart Recovery**（见 `docs/features/F048-restart-recovery.md`）。

关键原则：不做“半能力”。如果引入 Redis 队列持久化，必须同时定义并实现：
- 重启后的 orphan invocation 收敛语义
- 队列恢复与继续消费语义
- 用户可理解的 UI/提示

