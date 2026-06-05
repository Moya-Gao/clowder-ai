---
feature_ids: [F224]
related_features: [F220, F216, F118]
topics: [a2a, session, continuation, coordinator, queue, design]
doc_kind: plan
created: 2026-06-04
---

# SessionContinuationCoordinator 设计图（F224 Design Gate）

> **Status**: design-review | **作者**: 宪宪 (Opus-4.8) | **设计共识**: 宪宪 + 砚砚 (GPT-5.5)，thread `thread_mpxf7fdx5gonafzh`，2026-06-04
>
> **关键贡献**：四象限坐标系 + `sourceCategory` 隔离不变量 + F220 依赖硬隔离 = 砚砚独立读代码 + #834 diff 后收敛（不是吃倾向）。
>
> 本图供铲屎官过 Design Gate（架构级）+ 决定 F224 OQ-2 协作方式。

## 1. 问题（现状）

`CollaborationContinuityCapsule` 是**纯数据结构 + 纯函数**（build/seal/format/consume codec），**没有 coordinator**——continuation 生命周期的"决策 + 提交"编排**散落 6 文件**：

| 文件 | 现在干的 continuation 活 |
|------|----------------------|
| `CollaborationContinuityCapsule.ts` | 数据结构 + 纯函数（保持不动） |
| `QueueProcessor.ts`（1475 行） | `enqueueContinuation` + rate-limit + 去重 window + `formatContinuationPrompt` 注入 |
| `invoke-single-cat.ts` | `completeCapsuleForSeal` + session lifecycle |
| `route-serial.ts` / `route-parallel.ts` | `buildCapsuleFromRouteState`（route state → capsule） |
| `session-hooks.ts` | compact boundary continuation |

#834（吴浪）的 inline 方案在这些散点**继续加**（passive seal 进 QueueProcessor finally、reborn guard 散 4 处）→ 加剧碎裂。**coordinator 的价值 = 给 continuation lifecycle 一个单一 owner，收口这 6 处。**

## 2. 核心坐标系（设计锚，四 owner 各司其职）

```
┌─────────────────────────────────────────────────────────────┐
│  SessionContinuationCoordinator  =  continuation lifecycle    │  ← F224 新增
│    决策(consume?) + 提交(produce/restore/reborn-skip)         │
├─────────────────────────────────────────────────────────────┤
│  InvocationQueue / A2ACoalescer  =  A2A fan-in owner          │  ← 保持现状
│    coalesce candidates + sourceCategory 隔离不变量            │
├─────────────────────────────────────────────────────────────┤
│  route-serial / route-parallel   =  route state owner        │  ← 保持现状
│    build capsule (chain index/depth/directFrom/A2A route)    │
├─────────────────────────────────────────────────────────────┤
│  invoke-single-cat               =  session runtime owner    │  ← 保持现状
│    session record / seal request / transcript / CLI lifecycle│
└─────────────────────────────────────────────────────────────┘
```

> 坐标系判据：**谁最懂这块状态谁 own**。route 最懂 chain/depth → build 留 route；queue 最懂 fan-in → coalesce 留 queue；invoke 最懂 CLI session → session runtime 留 invoke；continuation 的 consume/produce 决策没有单一 owner → 这正是 coordinator 要补的空位。

## 3. Coordinator 接口（决策 + 提交，不碰 runtime/topology）

```ts
interface SessionContinuationCoordinator {
  // 单猫 invocation 开始前：按策略决定是否 consume pending continuation
  // 返回改写后的 content + consumedContinuation token（commit 时用它决定 restore）
  prepareInvocationContext(input): {
    content: string;                       // 注入 continuation prompt 后的 content
    consumedContinuation?: ConsumedToken;  // 记账：consume 了什么，failure 时 restore
    sessionPolicy: 'resume' | 'reborn';
  };

  // invocation 收尾：根据 finalStatus 提交 produced capsule / restore consumed / reborn skip
  commitInvocationOutcome(input: {
    finalStatus: 'succeeded' | 'failed' | 'canceled';
    consumedContinuation?: ConsumedToken;  // 来自 prepare
    producedCapsule?: CollaborationContinuityCapsuleV1; // seal 产出（来自 invoke）
  }): void;

  // 集中 resume|reborn 决策，调用方只拿结果不查 store
  resolveSessionStrategy(threadId, catId, userId): 'resume' | 'reborn';

  // passive seal 的 pending metadata 存取 + 原子 consume（Redis Lua HGET+HDEL）
}
```

**依赖**：`threadStore`（pending 存取）、queue adapter（拿 coalesce 结果，不找 candidates）、clock、logger、strategy 读取。**纯决策 + IO 提交，无 runtime slot 概念。**

## 4. Corner cases（#834 实测出来的，必须显式 model）

1. **failure/cancel 上 restore consumed continuation**：prepare 时 consume 的 capsule，若本次 invocation 没成功，commit 时 restore 回 pending（下次重试还能拿到）。
2. **new capsule 优先于 restore**：若 failure/cancel 过程中本次又产生了新 capsule（seal），新 capsule 优先于 restore 的旧 capsule（不覆盖丢失最新状态）。
3. **reborn skip 三点**：prepare 跳 consume / commit 跳 produce+restore / route 层 reborn 跳 bootstrap。
4. **strategy update 清 stale pending**：`memberSessionStrategy` 改成 reborn 时，清掉残留的 pending continuation（invariant 由 `ThreadStore.updateMemberSessionStrategy` 守）。

## 5. #836 reborn —— 集中 policy read（不散 4 处 `isRebornSession()`）

```
queue/direct 入口 → coordinator.resolveSessionStrategy() → 'resume' | 'reborn'
  ├─ route 层：reborn → skip bootstrap digest
  ├─ coordinator.prepare：reborn → skip continuation consume
  ├─ coordinator.commit：reborn → skip pending store/restore
  └─ ThreadStore.updateMemberSessionStrategy：改 reborn → 清 stale pending
```
→ direct path 和 QueueProcessor path **不分叉**（同一个 policy 入口）。

## 6. F220 边界（依赖 + 类型硬隔离，结构防揉入）

- coordinator **不允许依赖** `InvocationTracker` / processing slot / cancel / force-reset / releaseSlot。
- 只接收调用方传入的 `finalStatus` + capsule outcome，**不读/不修 slot 状态**。
- **测试守门**：coordinator 的 fake deps 根本不提供 tracker/cancel API → 以后谁想"顺手"把 F220 invocation-hang 轴揉进来，编译/测试就挡。
- → F224（session/message 轴）与 F220 Phase 2（invocation-hang 深水区）从结构上解耦。

## 7. F224 scope 修正（按坐标系重新分层 —— 比原 spec 精确）

| #834 bug | 原 F224 spec | 设计后归属 |
|----------|-------------|-----------|
| #813 passive seal | Phase A | **Coordinator 核心**（prepare/commit + pending 存取） |
| #836 reborn | Phase A | **Coordinator 策略**（resolveSessionStrategy + skip 点） |
| #815 A2A coalesce | Phase C（曾拟进 coordinator） | **留 Queue**（A2ACoalescer / InvocationQueue）；coordinator 只在 commit 接收"成功才 remove candidates"。理由：coalesce 是 queue fan-in 语义 + `sourceCategory:'a2a'` 不能混进 `'continuation'`，否则 continuation 控制流被当普通 handoff 合并 |
| #814 bubble dedup | Phase B | **独立 message identity 轴**（web reducer / `origin:'callback'` + identity 分流），**不进 coordinator**，不加 `extra.isExplicitPost` schema 字段 |

→ Coordinator 主设计聚焦 **#813 + #836**；#815 是 queue 的事（coordinator 接结果）；#814 完全独立拆出。

## 8. 现状对接（6 散落点 → 收口）

- `QueueProcessor.executeEntry`：`prepare` 在 routeExecution **前**调（拿 content + token），`commit` 在 finally 调（替换现在内联的 continuation enqueue 编排）。
- `invoke-single-cat`：保留 session runtime + seal request；seal 产出的 capsule 经 `commit` 提交。
- `route-serial`/`route-parallel`：保留 build capsule + 拿 `sessionPolicy` 决定 skip bootstrap。
- `session-hooks`：compact boundary continuation 走 coordinator commit。

## 9. Open Questions（给铲屎官 / 后续）

| # | 问题 | 处置 |
|---|------|------|
| OQ-2（F224） | 协作方式：吴浪按本设计图改 #834 vs cat-cafe 实现 + full-sync | **本图清晰可外包** → 倾向请吴浪按图改（坐标系明确，corner cases 列全，他熟自己代码）。待铲屎官 Design Gate 拍。 |
| OQ-D1 | `ConsumedToken` 具体形状（capsule 引用 vs 完整快照） | 技术细节，实现时定 |

## 收敛检查
1. 否决理由 → ADR？**没有**（无技术方案被否决，砚砚收紧边界是 align 非否决）
2. 踩坑教训 → lessons-learned？**没有**（设计阶段，未踩新坑）
3. 操作规则 → 指引文件？**没有**（feature 内设计，无新全局规则）

## 追溯
- F224 spec：`docs/features/F224-a2a-session-message-reliability.md`
- 社区源：`clowder-ai#834`（吴浪发现 4 bug + inline 初版）
- 讨论 thread：`thread_mpxf7fdx5gonafzh`（宪宪 + 砚砚，2026-06-04）
