# F229 Phase B: 总机能力 — 实施计划

> **Feature**: F229 猫猫球前台猫
> **Phase**: B（总机能力）
> **Owner**: 宪宪 (opus)
> **Co-planner**: 砚砚 (gpt-5.5)
> **Date**: 2026-06-15
> **Predecessor**: Phase A（前台开张 MVP，AC-A1~A6 ✅，Bug1/Bug2 双修 merged）

## 终点定义

Phase B = 前台猫从"能找、能跳、能看"升级为"能接线"：用户一句话进来，系统生成
可确认的分诊计划，执行 `跟去 / 传话 / 开新调查 / 自己调查`，所有执行状态可恢复、
可追踪、有 anchor。

## 不做（Phase B scope 排除）

- Phase E 门面/桌宠/皮肤
- Phase C 语音 loop
- Phase D 快速档 clerk
- relay 监听子系统（A3 减法不动——目标猫 cross_post 回 concierge thread 即可）
- 模型直接执行工具（KD-12 clerk 零执行权继续）
- Document anchor action（`concierge_open_doc`——alpha 验收证明必要再补）

## 已有基建（Phase A 已合入，不重做）

| 组件 | 位置 | 状态 |
|------|------|------|
| CardBlock action handlers (teleport/go/peek/relay) | `CardBlock.tsx` | ✅ |
| `/api/concierge/relay` endpoint | `route-serial.ts` | ✅ |
| `ConciergeRelayStore` (Redis, TTL=0) | `ConciergeRelayStore.ts` | ✅ |
| `ConciergeConfirmationStore` (Redis, TTL=0) | `ConciergeConfirmationStore.ts` | ✅ |
| HandleMap + reply validator + inline marker buttons | `ConciergeHandleMapStore.ts` / `concierge-reply-validator.ts` / `ConciergeMessageContent.tsx` | ✅ |
| ConciergePromptSection (duty cat prompt with relay/marker protocol) | `ConciergePromptSection.ts` | ✅ |
| `pushThreadRouteWithHistory` + `scrollToMessage` + `planTeleport` | 前端导航 | ✅ |

## 新增内容

### 1. PendingConfirmation 持久化闭环（B1 前置）

**现状**：ConfirmationStore + confirm route 有了，但缺：
- `(messageId, blockId, action) → confirmationId` 反向索引
- mount-time 查询（刷新后重建确认卡 confirmed/cancelled 状态）

**交付物**：
- 反向索引 key: `concierge:confirm-rev:{messageId}:{blockId}:{action}`
- `GET /api/concierge/confirmations?userId=X` mount-time 批量查询
- 前端 `useConciergeConfirmations` hook：mount 时查 + 写入 richBlock 状态
- 测试：确认 → 刷新 → 状态保持；取消 → 刷新 → 按钮 disabled

### 2. TriagePlan / DispatchPlan 状态对象（B1 核心）

用户描述问题 → 值班猫生成 TriagePlan → 确认卡 → 用户确认 → dispatch

#### TriagePlan schema

```
{
  id: string (uuid)
  userId: string
  sourceMessageId: string        // 用户原话所在消息
  originalText: string           // 用户原话全文快照
  intent: 'relay' | 'go' | 'propose_thread' | 'investigate'
  target: {
    threadId?: string            // relay/go 目标
    threadTitle?: string
    targetCats?: string[]        // relay 目标猫（resolver 产出或用户选择）
    query?: string               // investigate 的搜索范围
  }
  status: 'proposed' | 'confirmed' | 'dispatched' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  dispatchedAt?: number
  completedAt?: number
  result?: {                     // dispatch 结果
    relayReceiptId?: string
    proposedThreadId?: string
    investigationJobId?: string
  }
}
```

#### 状态转移表

```
proposed → confirmed     用户点击确认卡
proposed → cancelled     用户点击取消 / 超时
confirmed → dispatched   harness 执行 dispatch（relay/go/propose/investigate）
dispatched → completed   dispatch 成功（relay 投递 / thread 跳转 / 调查完成）
dispatched → failed      dispatch 失败（cross_post 失败 / API 错误）
failed → confirmed       用户重试（重新确认）
```

#### targetCats resolver

1. 用户显式 @ → 直接用
2. 目标 thread 最近 3 条非 system 消息参与猫 → 候选列表
3. feat_index 归属猫 → 候选列表
4. 候选 > 1 或候选 = 0 → **确认卡让用户选择**，fail-closed 不盲投

### 3. Relay Receipt UX 收口

v1 语义：
- **"已传话"** = dispatch receipt 卡（status: dispatched），可重试 / 可跟去
- **"对方回复"** = 目标猫 cross_post 回 concierge thread，作为普通消息出现
- 不等猫在线，不做超时追踪，不保证对方回复
- receipt 卡状态从 RelayStore 读取，刷新后保持

### 4. InvestigationJob 状态对象（B2 核心）

#### Schema

```
{
  id: string (uuid)
  userId: string
  triagePlanId: string
  query: string
  scope: string[]               // 允许的源：'memory' | 'docs' | 'feat_index' | 'github'
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  createdAt: number
  startedAt?: number
  completedAt?: number
  deadline: number              // createdAt + 60s（默认 1 分钟上限）
  report?: {
    summary: string
    anchors: Array<{
      handle: string            // R1, R2...
      threadId: string
      messageId?: string
      title: string
      relevance: string
    }>
  }
}
```

#### 状态转移表

```
queued → running        worker 开始执行
running → done          search 完成，报告已生成
running → failed        API 错误 / 所有源均失败
running → cancelled     用户取消 / deadline 到期
queued → cancelled      用户取消
```

#### 执行策略

1. search_evidence(query, mode='hybrid') → anchors
2. feat_index(keyword) → feature 状态
3. GitHub（如可用）：`gh issue list --search` / `gh pr list --search`
4. 汇总成带 anchor 的报告消息，回 concierge thread
5. 报告使用 [跳过去 Rn] marker → inline button 复用 Bug2 基建

### 5. Duty Cat Prompt Phase B 扩展

ConciergePromptSection 追加：
- 分诊意图识别指引（"用户想传话/想直接去/想开新调查/想让你查"→ 对应 intent）
- TriagePlan 输出格式（MD-first，validator parse）
- 确认卡生成协议（不自行 dispatch，必须经确认）
- 调查报告格式指引

## PR 拆分（2 PR，Phase A 教训：别拆太稀碎）

| PR | 内容 | AC | 依赖 |
|----|------|-----|------|
| **PR-B1** | AC-B1 一把过：confirmation persistence + TriagePlan + dispatch 全链 (relay/go/propose_thread) + relay receipt UX + targetCats resolver + duty cat prompt rewrite | AC-B1 + PendingConfirmation | — |
| **PR-B2** | AC-B2 + alpha 验收：InvestigationJob (bounded async + 报告 + anchor + cancel/deadline) + Phase B close | AC-B2 | B1 |

## 验收标准

- [ ] AC-B1: 用户描述问题 → 前台猫给确认卡（含目标 thread + targetCat + intent）→ 用户确认 → relay 投递 + receipt 卡 / teleport 跳转 / propose_thread 开新调查——**刷新后确认状态保持**
- [ ] AC-B2: "自己调查" → 前台猫查 memory/docs/feat_index → 带 anchor 报告回对话框——**anchor 可点击跳转**
- [ ] PendingConfirmation: 刷新后 confirmed/cancelled 状态正确重建

## 风险

| 风险 | 缓解 |
|------|------|
| targetCats 推断盲投 | resolver fail-closed：候选不唯一 → 用户选择卡 |
| Gemini 值班猫不遵守 TriagePlan 格式 | MD-first + validator fail-closed；KD-19 fallback 模式 |
| InvestigationJob 无感挂死 | 60s deadline + 状态可取消 + 前端 loading 状态 |
| TriagePlan 状态机 review 补边 | 先画状态表再写代码（本文档已画） |
| relay "回执" 偷换 "保证对方回复" | v1 明确：保证投递留痕，不保证回复 |

## 测试策略

每个状态转移都有对应测试用例：
- TriagePlan: proposed→confirmed→dispatched→completed 全链
- TriagePlan: proposed→cancelled / dispatched→failed→confirmed(retry)
- InvestigationJob: queued→running→done / running→cancelled(deadline)
- Confirmation: confirm→refresh→state-preserved
- targetCats: 0 candidates→user-select / 1 candidate→auto / 3 candidates→user-select

---

[宪宪/claude-opus-4-6🐾 + 砚砚/gpt-5.5🐾]
