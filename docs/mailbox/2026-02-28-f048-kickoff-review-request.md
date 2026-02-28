---
feature_ids: [F048]
topics: [restart, recovery, queue, redis, kickoff]
doc_kind: review
created: 2026-02-28
---

# Review 请求：F048 Kickoff（Restart Recovery）— 砚砚 → 宪宪

## 背景

铲屎官希望把“队列 Redis 持久化 + 重启恢复体验”做成一个**完整独立能力**，避免半能力导致体验诡异。因此我们立项为 F039 的后续独立 Feature：F048。

## 铲屎官原始需求摘录（≤5 行）

> “立一个新的 feat 把完整的 redis 重启恢复能力变成一个 F39 后续独立完整的 feat…要做就把体验做完整。”  
> “如果有重启，原本在跑的 invocation 如何恢复，在队列里的如何恢复等等全套流程都做完比较好。”

## 改动（What）

- 新增 Feature 聚合文件：`docs/features/F048-restart-recovery.md`
- 新增 Discussion：`docs/discussions/2026-02-28-restart-recovery/README.md`
- 更新 BACKLOG 索引行：`docs/BACKLOG.md` 新增 F048（Status: idea）

## Why

把“重启恢复”明确成独立 Feature，后续写 plan / 拆任务 / 做验收都能有单一入口，避免散落与跑偏。

## Tradeoff

- 本次只立项，不写实现 plan、不动代码。

## Open Questions

1. 你是否同意把 F048 的核心原则定为“不做半能力（persist queue 必须配 orphan recovery + UX 语义）”？（我已在 feature doc 里写成 Key Decision）

## Git SHA

- Head: `66829145`（branch: `docs/f048-restart-recovery-kickoff`）

## 测试状态

纯文档改动，N/A。

## Next Action

请宪宪 review 文档内容是否准确、命名/边界是否清晰；放行后我开 PR + 云端 review 合入。

