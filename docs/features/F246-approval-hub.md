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
| KD-7 | Index 注入 internal-only + user-scoped | 注入 API 只允许 internal service call（不暴露为 MCP/callback tool），Index 带 `ownerUserId`，Hub 读写都走 user auth（砚砚 R1 P1-1） |
| KD-8 | Index 可从 canonical stores 重建 | CQRS read view 是派生数据，crash/restart 后从 F128/F225/F193 stores backfill；phantom item 不出现、settled item 不残留（砚砚 R1 P1-2） |
| KD-9 | F193 E3 effect-class 机械化边界 | FYI/协调/只读调查 = 自动投递（不产生 ApprovalItem）；任务分配/要求接收方改代码 = Approval Hub。有 fixture 证明非任务分配类不触发审批（砚砚 R1 P1-3） |

### Admission Criteria（接入资格三条件，AND）

> **eligibility ≠ v1 inclusion**：满足三条件 = 有资格接入底座。v1 是 scope 控制（MVP 先做 F128/F225/F193 E3），不是资格排除。F231 等满足条件但 v1 不接，纯粹是排期。（砚砚 R1 P2-1）

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

- **ApprovalItem index store**：read-side 索引，字段：
  - `ownerUserId` — 审批项归属用户（Hub 读取按 userId 过滤，防跨用户泄露）
  - `sourceFeatureId` — 来源 feature（限 allowlist：`F128` / `F225` / `F193`，v1 硬编码）
  - `sourceThreadId`, `sourceMessageId` — 原始位置（跳转用）
  - `requesterCatId` — 发起审批的猫
  - `status` — `pending` / `approved` / `rejected` / `stale`
  - `summary`, `actions`, `inlineApprovable`, `expiresAt`
  - `canonicalProposalId` — 指向 feature 自己的 proposal store 的 ID（backfill/reconciliation 用）
- **事件注入 API**：`registerApprovalItem` / `updateApprovalItemStatus`，**internal service call only**（不暴露为 MCP tool / callback endpoint）。feature adapter 在自己的 propose/approve route 里调用，不是猫直接调
- **Index recovery**：crash/restart 后从 F128 ThreadProposal store + F225 HandoffProposal store backfill pending items。phantom item（注入成功但 canonical proposal 不存在）定期 reconciliation 清理。settled item（已 approved/rejected）不残留超过 TTL
- **Hub "待审批" panel**：列表展示当前用户（`ownerUserId`）的 pending items，计数徽标，点击跳转到原 thread。Hub 读/写都走 user auth（`resolveUserId`），不允许跨用户操作
- **就地审批**：`inlineApprovable=true` 且 `inlineMinFields` 校验通过时，Hub 内直接 approve/reject。**F128 特殊**：就地审批必须支持 `title/parentThreadId` override（与现有卡片 approve 契约一致），否则默认跳转（砚砚 R1 P2-2）
- **过期提醒**：`expiresAt` 到期 → Hub 标记 stale + 徽标提醒，不自动 reject

**AC-A1**: F128 propose_thread 事件注入到 index → Hub 可见
**AC-A2**: F225 session_handoff 事件注入到 index → Hub 可见
**AC-A3**: Hub panel 展示待审批列表 + 计数徽标
**AC-A4**: 就地审批 F128 → 批完状态同步回 F128 store。**必须支持 `title`/`parentThreadId` override**（与 F128 现有 approve-time 编辑契约一致），否则默认跳转不降级审批能力
**AC-A5**: 跳转审批 F225（需上下文）→ 跳到原 thread
**AC-A6**: 过期项标记 stale，不自动 reject
**AC-A7**: Hub 读取按 `ownerUserId` 过滤，user A 看不到 user B 的待审批项
**AC-A8**: 注入 API 不暴露为 MCP tool/callback。非 allowlist feature 的注入调用被拒绝
**AC-A9**: 服务 restart 后从 canonical stores (F128/F225) backfill → index 不丢单。phantom item（canonical 不存在）不出现在 Hub
**AC-A10**: 已 settled（approved/rejected）的 item 在 reconciliation 后从 pending 列表移除

### Phase B: F193 E3 接入

- F193 E3 卡片审批路径接入底座
- DispatchProposal store + 事件注入

#### F193 E3 Effect-Class Matrix（机械化边界，砚砚 R1 P1-3）

| effect-class | 接收方动作 | 示例 | 走底座？ |
|-------------|-----------|------|---------|
| `fyi` | 看一眼 + 知道了 | "shared 改了请 rebuild" | ❌ 自动投递 |
| `coordinate` | 协调自己的节奏 | "你卡我了请 ack" / "请 rebase" | ❌ 自动投递 |
| `investigate` | 只读调查 | "main 上有你 feature 的 stray 文件" | ❌ 自动投递 |
| `assign_work` | 开 worktree 写代码 | "这个 bug 归你修" | ✅ Approval Hub |

**AC-B1**: F193 E3 `assign_work` 类卡片审批走底座 → Hub 可见
**AC-B2**: F193 E3 `fyi`/`coordinate`/`investigate` 类不产生 ApprovalItem（有 fixture 测试证明）
**AC-B3**: effect-class 由发送猫在 cross-post 时声明，不由底座推断

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
