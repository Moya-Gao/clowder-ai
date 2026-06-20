---
feature_ids: [F246]
related_features: [F128, F225, F193, F168, F231]
topics: [approval, hub, cvo-gate, cross-thread, cqrs, proposal]
doc_kind: spec
created: 2026-06-20
---

# F246: Approval Hub — 统一审批中心底座

> **Status**: spec（2026-06-20 CVO approved direction + three-cat convergence） | **Owner**: 布偶猫/宪宪 (opus-46) | **Priority**: P2

Architecture cell: platform-infra（subcell: `approval-index`）
Map delta: 新 cell — CQRS read-side index 聚合多 feature 的 CVO 审批项 + Hub UI panel。不拥有状态机，只索引和展示。
Why: CVO 审批散落在各 thread（F128/F225/F193），铲屎官不在对应 thread 就看不到。需要跨 thread 统一入口。

## Why

> 铲屎官原话（2026-06-20）："要是我没看thread呢？ 或者是我在thread a 但是b的猫找我审批呢？"
> "现在f128 和 f225 都有富文本需要我审批的东西笑死但是很多猫可能反馈铲屎官忘记点了！"
> "我感觉这种thread内的点击审批似乎需要有个event中心。。能让我看到 点击跳转到对应thread等等等"
> "这个应该是底座 底座上是f168 193 128 225 这些可能涉及到需要我审批的"

### 痛点

1. **审批被困在 thread 里** — 铲屎官不在对应 thread 就看不到审批卡片
2. **审批散落多 feature** — F128/F225 各自做了审批卡片，铲屎官不知道总共多少待批
3. **忘记审批** — 卡片埋没在 thread 消息流里，无人提醒
4. **没有审批中心** — 需要逐个 thread 翻

### 不是什么

- **不是把所有跨线程通讯变成审批** — F193 绝大多数场景（FYI/协调）继续自动投递，只有极少数任务分配类走审批
- **不是泛化 F168 Decision Queue** — F168 是 action queue（多 actor + 多态 action），底座是 approval queue（actor=CVO + binary approve/reject），是 sibling concept 不是 parent-child
- **不是 push notification** — Hub 是 pull surface，push channel（iOS/邮件/webhook）独立问题

## Design Discussion

详细痛点分析 + 架构图 + 三猫讨论记录：
`docs/discussions/2026-06-20-unified-approval-hub-pain-points.md`

### Key Decisions (from three-cat convergence)

| # | 决定 | 理由 |
|---|------|------|
| KD-1 | 底座新开 Feature，不泛化 F168 | F168 Queue actor 多型 + 三态，不是 approval shape |
| KD-2 | v1 只接 F128 + F225 + F193 E3 | 共性：actor=CVO + binary approve/reject |
| KD-3 | CQRS read view 架构 | 各 feature 保留自己的 proposal store + 状态机；底座只做 read-side index |
| KD-4 | 就地审批有条件 | inlineMinFields 守门（summary + impact + action 非空），不靠 feature 自报 |
| KD-5 | 过期 ≠ 自动拒绝 | 过期 = 上下文 stale，按钮变"刷新/重新提议"；提醒走 Hub 徽标不追加噪音 |
| KD-6 | F193 E3 拆两半 | 自动投递先做不卡，卡片审批等底座 v1 |

### Admission Criteria（接入三条件，AND）

| # | 条件 | 说明 | 反例 |
|---|------|------|------|
| 1 | actor = CVO | 必须铲屎官本人审批 | 猫间协调（FYI/ACTION）→ 自动投递 |
| 2 | binary outcome | approve / reject（可选 modify） | F168 acknowledge/resolve/waive → 多态 action |
| 3 | 跨 thread 需求 | 审批可能在铲屎官不在的 thread 产生 | 铲屎官主动发起的操作 |

### Census（全量审批点）

| Feature | 审批项 | 接入 |
|---------|--------|------|
| F128 | propose_thread | **v1** |
| F225 | session_handoff | **v1** |
| F193 E3 | cross_thread_dispatch (任务分配) | **v1** |
| F168 | community direction | Sibling（不迁 v1） |
| F231 | propose_profile_update | v2 候选 |
| Knowledge Feed | 知识条目审核 | v2 候选 |
| Limb | pair_approve | v2 候选 |

## What

### Phase A: Approval Index + Hub Panel (MVP)

- **ApprovalItem index store**：read-side 索引，字段 `sourceFeatureId, sourceThreadId, sourceMessageId, requesterCatId, status, summary, actions, inlineApprovable, expiresAt`
- **事件注入 API**：各 feature 状态变更时调用 `registerApprovalItem` / `updateApprovalItemStatus`
- **Hub "待审批" panel**：列表展示所有 pending items，计数徽标，点击跳转到原 thread
- **就地审批**：`inlineApprovable=true` 且 `inlineMinFields` 校验通过时，Hub 内直接 approve/reject
- **过期提醒**：`expiresAt` 到期 → Hub 标记 stale + 徽标提醒，不自动 reject

**AC-A1**: F128 propose_thread 事件注入到 index → Hub 可见
**AC-A2**: F225 session_handoff 事件注入到 index → Hub 可见
**AC-A3**: Hub panel 展示待审批列表 + 计数徽标
**AC-A4**: 就地审批 F128（信息自足）→ 批完状态同步回 F128 store
**AC-A5**: 跳转审批 F225（需上下文）→ 跳到原 thread
**AC-A6**: 过期项标记 stale，不自动 reject

### Phase B: F193 E3 接入

- F193 E3 卡片审批路径接入底座
- DispatchProposal store + 事件注入

**AC-B1**: F193 E3 卡片审批走底座 → Hub 可见
**AC-B2**: 自动投递路径不受影响（不走底座）

### Phase C: 成熟化

- 批量操作（全部 approve / 全部 reject）
- 筛选（by feature / by thread / by 时效）
- v2 接入（F231 等）

## Links

- 痛点分析 + 架构图：`docs/discussions/2026-06-20-unified-approval-hub-pain-points.md`
- F128 propose_thread spec：`docs/features/F128-cat-create-thread.md`
- F225 session_handoff spec：`docs/features/F225-cat-initiated-session-handoff.md`
- F193 cross-thread spec：`docs/features/F193-cross-thread-comm-unification.md`
- F168 community ops：`docs/features/F168-community-ops-board.md`
