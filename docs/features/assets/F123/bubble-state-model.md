---
feature_ids: [F123]
doc_kind: note
created: 2026-03-16
topics: [bubble, identity, reconcile, write-paths]
---

# F123 Bubble State Model

## Identity Schema

| Field | Source | Meaning | Notes |
|-------|--------|---------|-------|
| `messageId` | `ChatMessage.id` | 当前 store 中的具体气泡实例 ID | 可能经历 draft / replace / hydrate 的实例级变化，不等于稳定身份 |
| `catId` | `ChatMessage.catId` | 说话的猫 | assistant bubble 稳定身份的一部分 |
| `invocationId` | `extra.stream.invocationId` 或 `draft-*` fallback | 一次调用的稳定执行身份 | `bubbleIdentity.ts` 用它构造 stable key |
| `bubbleKind` | 目前固定为 `text` | 气泡类别 | F123 现阶段只收 text bubble；rich block 关联属于后续对照项 |
| `originPhase` | `draft / stream / callback / history` | 当前气泡所处阶段 | `draft` / `stream` 是本地运行态；`callback` / `history` 是可视作 authoritative 的正式态 |
| `authoritative ordering` | `deliveredAt ?? timestamp` | 同 phase 内决定谁是更强版本的时间锚点 | 当前主要用于 callback↔callback hydration 恢复 |

## Current Write Paths

| Path | Entry | Produces | Identity Notes |
|------|-------|----------|----------------|
| active stream | `useAgentMessages.ts` | 本线程 runtime bubble | 可能先以 `stream` phase 出生，后续被 callback / history 替换 |
| background stream | `useSocket-background.ts` | 非激活线程 runtime bubble | 与 active path 镜像，易出现 ref-lost / late chunk 问题 |
| history hydration | `useChatHistory.ts` | authoritative history bubble | 负责把本地 shadow bubble 收回单一真相 |
| draft placeholder | `chatStore.ts` + stream 启动路径 | `draft-*` bubble | invocationId 通过 draft id fallback 提取，属于 local-only / unstable |
| queue / steer recovery | `useChatHistory.ts` + API queue lifecycle | history / loading 恢复 | 与 hydration 顺序交织，容易制造“F5 前后不一致”现场 |

## Current Contract

1. 稳定身份不是 `messageId`，而是 `catId + invocationId + bubbleKind`
2. `draft` / `stream` 属于 local-only phase，默认不可信，thread switch / hydration 时可以被 authoritative history 替换
3. `callback` / `history` 属于正式态；同 phase 冲突时不能再只按 richness，必须按 authoritative ordering 比较
4. 任何 cached snapshot 只要出现 duplicate stable identity 或 local-only bubble，就属于 unstable cache，thread switch 时必须 replace hydration

## Known Gaps

- rich block 目前还没有进入 stable identity schema，只能通过 symptom matrix 单独跟踪
- queue / hydration 乱序还缺一条完整 replay fixture，当前只在邻近回归里部分覆盖
- store 级 invariant 还没落地；目前的 identity contract 主要体现在 helper 和 hydrate 决策层
