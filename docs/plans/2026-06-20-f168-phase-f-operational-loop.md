---
feature_ids: [F168]
phase: F
plan_status: draft
created: 2026-06-20
author: opus (宪宪)
---

# F168 Phase F: 运营闭环上线 — 实施计划

> **真相源**: `docs/features/F168-community-ops-board.md` Phase F 段
> **CVO 方向收敛**: 3 轮修正（2026-06-20 thread），最终定向 = 置信度分流路由
> **前置**: A→E 全部 merged + 愿景守护 PASS

## 0. 北极星

A→E 建了精密管道（Event Log → Projector → State Machine → Reconciler → SLA → Decision Queue → Closure Guard），但生产中 515 条 issue、0 条被分配到工作 thread。Phase F = 把水接进管道。

**铲屎官原话**：
> "砚砚每天都在跟啊！" — 运营在跑，系统没记录
> "有把握的直接传球！没把握的才让我审批" — 置信度分流
> "接受到球的猫需要验证是不是属于他们的 thread！！！" — 目标猫验证

## 1. 三步走

| Step | 内容 | 依赖 |
|------|------|------|
| F-Step0 | per-repo routing config — 铲屎官配置每个 repo 的守门 thread + 守门猫 | 无 |
| F-Step1 | 存量 backfill — 从 per-repo config 读 guardCatId/guardThreadId 标记存量 | F-Step0 |
| F-Step2 | 置信度分流路由 — narrator triage → 置信度判断 → 按 repo config 路由 → 目标猫验证 | F-Step0, F-Step1 |

**CVO 方向（2026-06-20 第四轮）**：
> "每个不同的 repo → 对应的守门 thread？以及猫猫，比如这个 repo 守门 thread a 猫猫 b 另一个也允许我定义？"
>
> → per-repo routing config，不硬编码。铲屎官在 CommunityPanel 设置，系统消费。

---

## 2. Stateful Object Gate（F229 教训：stateful 对象先给状态机再写代码）

### SO-0: CommunityRepoConfig（新增，per-repo routing 配置）

铲屎官定义每个 repo 的守门 thread 和守门猫。

```typescript
interface CommunityRepoConfig {
  readonly repo: string;              // e.g. 'zts212653/clowder-ai'
  readonly guardThreadId: string;     // 守门 thread（narrator triage 产出在这里、backfill 标到这里）
  readonly guardCatId: string;        // 守门猫（默认 assignedCatId）
  readonly createdAt: number;
  readonly updatedAt: number;
}
```

**不是状态机**——是静态配置（CRUD），铲屎官设置后系统消费。

**持久化**：Redis store，TTL=0（铁律 #5）。
**设置入口**：CommunityPanel repo 下拉旁 ⚙️ → 配置守门 thread + 猫。
**消费方**：backfill 脚本 / narrator 路由 / 看板筛选 / autoRoute。

**INV-F0**: 无 repo config 的 repo 不允许 backfill 或 autoRoute（fail-closed）。

### SO-1: TriageConfidence（新增，纯派生值）

**不是独立状态机**——是 TriageEntry 的派生属性，纯函数计算，无持久化。

```
deriveTriageConfidence(entry: TriageEntry): 'high' | 'low'

high 条件（全部满足）:
  1. routeRecommendation.kind === 'existing-thread'（明确知道去哪）
  2. verdict === 'WELCOME'（方向确认）
  3. questions 全部 PASS 或 WARN（无 FAIL/UNKNOWN）

其余一律 low
```

**为什么不做 medium**：CVO 方向是二分——"有把握"vs"没把握"。三级增加判断成本但不增加决策路径（medium 最终还是需要人决定走哪条路）。

**INV-F1**: `deriveTriageConfidence` 是纯函数，无副作用，不读 store。

### SO-2: RouteAcceptance（新增，CommunityIssueItem 扩展字段）

目标猫收到路由后的验证状态。

```
状态转移表:

null ──[case.routed]──→ pending
                          │
              ┌───────────┼───────────┐
              │                       │
     [target accepts]        [target rejects]
              │                       │
              ▼                       ▼
          accepted                rejected
              │                       │
         (工作开始)          [auto → Decision Queue]
                                      │
                              [CVO reassigns]
                                      │
                                  pending
                                  (新目标猫)
```

| 从 | 到 | 触发 | 副作用 |
|----|-----|------|--------|
| null | pending | `case.routed` event（无论高/低置信度路由） | 写 assignedCatId + assignedThreadId |
| pending | accepted | 目标猫 POST `/validate-route` decision=accept | 发 `case.route-validated` event |
| pending | rejected | 目标猫 POST `/validate-route` decision=reject | 清空 assignedCatId/ThreadId，state → pending-decision，发 `case.route-rejected` event，自动入 Decision Queue（kind=direction-decision） |
| rejected | pending | CVO 在 Decision Queue 重新 resolve + 路由到新目标 | 写新 assignedCatId + assignedThreadId |

**INV-F2**: routeAcceptance 只能通过 `/validate-route` 端点变更，不能被 sync/backfill 覆盖。
**INV-F3**: rejected → pending-decision 时必须清空 assignedCatId 和 assignedThreadId（防止看板显示错误归属）。
**INV-F4**: backfill 写入的 routeAcceptance 直接为 `accepted`（砚砚已完成的工作不需要再验证）。

### SO-3: AutoRouteDecision（新增，TriageOrchestrator 行为分支）

recordTriageEntry 完成后的路由决策分支。

```
narrator 完成 triage
  │
  ├── bugfix（猫自决）── 现有逻辑不变
  │
  ├── 非 bugfix + 第一猫 ── await-second-cat（现有逻辑不变）
  │
  └── 非 bugfix + 共识达成
        │
        ├── consensus.verdict = WELCOME
        │     │
        │     ├── deriveTriageConfidence(latestEntry) === 'high'
        │     │     → autoRoute(): 自动调用 routeAccepted()
        │     │     → 发 case.auto-routed event
        │     │     → @ 目标猫验证
        │     │
        │     └── confidence === 'low'
        │           → state = pending-decision（现有逻辑）
        │           → 进 Decision Queue，CVO 审批
        │
        ├── consensus.verdict = NEEDS-DISCUSSION
        │     → state = pending-decision（现有逻辑）
        │
        └── consensus.verdict = POLITELY-DECLINE
              → routeDeclined()（现有逻辑）
```

**INV-F5**: autoRoute 只在 verdict=WELCOME + confidence=high 时触发，其余路径保持不变。
**INV-F6**: autoRoute 必须设置 routeAcceptance=pending（目标猫验证是安全网）。
**INV-F7**: autoRoute 的目标 thread 必须是现有 thread：优先使用 `entry.routeRecommendation.kind === 'existing-thread'` 的 threadId；缺失时 fallback 到 per-repo `guardThreadId`（守门 thread 也必须存在于 thread store）。

---

## 3. 数据模型变更

### 3.1 CommunityIssueItem 扩展

```typescript
// 新增字段（所有 optional，backward compat）
interface CommunityIssueItem {
  // ... 现有字段 ...
  
  /** Phase F: 目标猫对路由的验证状态 */
  readonly routeAcceptance?: 'pending' | 'accepted' | 'rejected' | null;
  
  /** Phase F: 路由方式（auto = 高置信度自动路由，manual = CVO 审批后路由，backfill = 存量标记） */
  readonly routeSource?: 'auto' | 'manual' | 'backfill' | null;
}
```

### 3.2 Event Log 新事件类型

```typescript
// 新增 event kinds
'case.auto-routed'      // 高置信度自动路由（含 confidence derivation 证据）
'case.route-validated'  // 目标猫确认接单
'case.route-rejected'   // 目标猫退回
'case.backfilled'       // 存量 backfill 标记
```

### 3.3 Decision Queue 扩展

现有 `direction-decision` kind 已支持 routeRecommendation 展示。Phase F 需要：
- rejected issue 自动回流到 Decision Queue（复用 direction-decision kind）
- Decision Queue item 区分"新 triage 待审批" vs "被退回重新分配"（加 `subKind?: 'new-triage' | 'reassignment'`）

---

## 4. 实施步骤（TDD）

### F-0: per-repo routing config（F-Step0）

**改动**:
- `packages/shared/src/types/community-repo-config.ts`: 新类型 `CommunityRepoConfig`
- `packages/api/src/domains/community/CommunityRepoConfigStore.ts`: Redis store（CRUD）
- `packages/api/src/routes/community-repo-config.ts`: REST endpoints
  - `GET /api/community-repo-configs` — 列出所有 repo config
  - `POST /api/community-repo-configs` — 创建/更新（upsert by repo）
  - `DELETE /api/community-repo-configs/:repo` — 删除
- `packages/web/src/components/community/RepoConfigDialog.tsx`: 配置对话框
  - CommunityPanel repo 下拉旁 ⚙️ 按钮
  - 设置守门 thread（下拉选已有 thread）+ 守门猫（下拉选 roster 猫）

**TDD**:
- RED: store CRUD 测试（create/get/list/delete）
- RED: upsert 同 repo 更新不重复创建
- RED: 无 config 的 repo 读取返回 null
- GREEN: 实现 store + endpoints

**INV 覆盖**: INV-F0

### F0: shared types 扩展（≤30 min）

**改动**:
- `packages/shared/src/types/community-issue.ts`: 加 `routeAcceptance`, `routeSource` 字段
- `packages/shared/src/types/community-event.ts`: 加新 event kinds
- 纯函数 `deriveTriageConfidence(entry: TriageEntry): 'high' | 'low'`

**TDD**:
- RED: `deriveTriageConfidence` 测试——5Q 全 PASS + WELCOME + existing-thread = high；任一 FAIL = low；new-thread = low；decline = low
- GREEN: 实现纯函数
- RED: edge cases——无 routeRecommendation = low；无 questions = low

**INV 覆盖**: INV-F1

### F1: 存量 backfill 脚本（F-Step1）

**改动**:
- `packages/api/src/cli/community-backfill.ts`: 新 CLI 脚本
  - **从 CommunityRepoConfigStore 读 per-repo config**（不硬编码 catId/threadId）
  - 按 repo 分组扫描 CommunityIssueItem
  - closed（state='closed'）→ `assignedCatId=config.guardCatId`, `assignedThreadId=config.guardThreadId`, `routeAcceptance='accepted'`, `routeSource='backfill'`
  - 已有 assignedCatId 的跳过
  - open 且 triaged（state!='unreplied'）→ `assignedCatId=config.guardCatId`（但 routeAcceptance=null）
  - 无 repo config 的 issue 跳过 + 警告（INV-F0 fail-closed）
  - 每条发 `case.backfilled` event
- `package.json`: 加 `"backfill:community": "tsx src/cli/community-backfill.ts"` 脚本

**TDD**:
- RED: backfill 从 repo config 读 guardCatId/guardThreadId（不硬编码）
- RED: backfill 对 closed issue 写 assignedCatId + assignedThreadId + routeAcceptance=accepted + routeSource=backfill
- RED: backfill 跳过已有 assignedCatId 的 issue
- RED: 无 repo config 的 issue 跳过 + 警告日志
- RED: backfill 发 case.backfilled event（每条一个）
- GREEN: 实现脚本

**INV 覆盖**: INV-F0, INV-F4
**生产执行**: 在 6399 上 `--allow-sanctuary` 跑（类似 Phase B Task 0 的 bootstrap）

### F2: 目标猫验证端点

**改动**:
- `packages/api/src/routes/community-issues.ts`: 新端点 `POST /api/community-issues/:id/validate-route`
  - body: `{ decision: 'accept' | 'reject', reason?: string }`
  - accept: routeAcceptance → accepted，发 case.route-validated event
  - reject: routeAcceptance → rejected，清空 assignedCatId/ThreadId，state → pending-decision，发 case.route-rejected event
  - 前置检查: routeAcceptance 必须是 pending（409 otherwise）
  - 身份检查: 调用者 catId 必须等于 assignedCatId（403 otherwise）

**TDD**:
- RED: accept 时 routeAcceptance pending → accepted
- RED: reject 时 routeAcceptance pending → rejected + assignedCatId 清空 + state → pending-decision
- RED: routeAcceptance 非 pending 时 409
- RED: 非 assignedCat 调用时 403
- RED: reject 后 issue 出现在 Decision Queue（direction-decision, subKind=reassignment）
- GREEN: 实现端点

**INV 覆盖**: INV-F2, INV-F3

### F3: 置信度分流路由（TriageOrchestrator 扩展）

**改动**:
- `packages/api/src/domains/community/TriageOrchestrator.ts`:
  - `recordTriageEntry` 在 consensus resolved + verdict=WELCOME 后检查置信度
  - high → 调用新方法 `autoRoute(issueId, entry)`
  - `autoRoute`: 调用 `routeAccepted(issueId, relatedFeature, catId, threadId)` + 设置 `routeAcceptance='pending'` + `routeSource='auto'` + 发 `case.auto-routed` event
  - low → 现有逻辑（state=pending-decision → Decision Queue）

- `TriageAction` 联合类型扩展:
  ```typescript
  | { action: 'auto-routed'; issueId: string; threadId: string; targetCatId: string }
  ```

**TDD**:
- RED: verdict=WELCOME + high confidence → action='auto-routed' + routeAcceptance=pending + routeSource=auto
- RED: verdict=WELCOME + low confidence → action='resolved' + state=pending-decision（现有行为不变）
- RED: verdict=NEEDS-DISCUSSION → pending-decision（现有行为不变）
- RED: verdict=POLITELY-DECLINE → declined（现有行为不变）
- RED: bugfix 单猫 → 现有行为不变
- RED: autoRoute 必须设 routeAcceptance=pending（INV-F6）
- GREEN: 实现

**INV 覆盖**: INV-F5, INV-F6, INV-F7

### F4: 前端 — 路由验证 UX

**改动**:
- `packages/web/src/components/community/RouteValidationCard.tsx`: 新组件
  - 目标猫收到路由后在 CommunityPanel 看到验证卡片
  - 显示: issue 标题 + narrator 分析摘要 + routeRecommendation + 置信度
  - 按钮: [接单 ✓] [退回 ✗]（调用 `/validate-route`）
  - 退回时需填 reason（≤200 字）
- `packages/web/src/components/community/CommunityPanel.tsx`: 集成 RouteValidationCard
  - 在 Issues 列表顶部显示"待验证"分组（routeAcceptance=pending 的 issue）
- Decision Queue: rejected issue 显示 subKind=reassignment badge + 退回 reason

**TDD**:
- RED: RouteValidationCard 渲染 accept/reject 按钮
- RED: accept 调用 API 后卡片消失
- RED: reject 需要 reason（空 reason block submit）
- RED: Decision Queue 显示 reassignment badge
- GREEN: 实现组件

### F5: 看板 assignedCatId/ThreadId 展示增强

**改动**:
- board API 返回 `assignedCatId` + `assignedThreadId` + `routeAcceptance` 字段
- 前端 issue 行显示: `@codex → thread_xxx` 带点击跳转
- 筛选器: 按 assignedCatId 筛选

**TDD**:
- RED: board API 返回新字段
- RED: issue 行显示 assignedCat + thread 链接
- RED: 点击跳转到 thread
- GREEN: 实现

**AC 覆盖**: AC-F6

### F6: 端到端验证（AC-F7）

**不是代码——是生产验证**:
1. backfill 跑完后检查看板（AC-F0）
2. 手动触发一条新 issue 的 narrator triage
3. 观察: narrator 生成 Direction Card → 置信度判断 → 路由（auto 或 Decision Queue）→ 目标猫验证 → 接单或退回
4. 至少 1 条跑完整流程（AC-F7）

---

## 5. Architecture Ownership

| 字段 | 值 |
|------|-----|
| Architecture cell | community-ops |
| Map delta | update required — 加 routeAcceptance 状态 + autoRoute 路径 |
| Why | 扩展现有 TriageOrchestrator 的路由行为，新增目标猫验证闭环 |

---

## 6. 风险

| 风险 | 缓解 |
|------|------|
| backfill 量大（515 条）影响生产 Redis | 分批写入 + rate limit（50 条/批，间隔 1s） |
| autoRoute 误判高置信度 | INV-F7 限制目标 thread 必须存在（routeRecommendation existing-thread 或 repo guard thread）+ 目标猫验证兜底 |
| 目标猫忘记验证（routeAcceptance 永远 pending） | F-Step2+ 可加 SLA 提醒（复用 Phase D SLA 机制），但 Phase F 不做 |
| Decision Queue reassignment 循环（退回→重分→退回） | Phase F 不加硬上限；如果实际发生再迭代 |

---

## 7. Open Questions

| # | 问题 | 建议 | 状态 |
|---|------|------|------|
| OQ-F1 | backfill 的 assignedThreadId 写什么？ | `thread_mp3ab0r9xqxrkrc5`（砚砚的社区守门 thread，铲屎官 2026-06-20 确认"砚砚都在这里工作"） | ✅ CVO 确认 |
| OQ-F2 | open 未 triaged 的 issue（state=unreplied/new）backfill 时标给谁？ | 不标——这些是 narrator triage 的对象（自决，安全默认） | ✅ 自决 |
| OQ-F3 | 目标猫验证的 UX 触发方式？ | 双通道：autoRoute 后 @ 目标猫提醒 + CommunityPanel 验证卡片操作入口（自决） | ✅ 自决 |

---

## 8. PR 拆分预案

| PR | 内容 | 预估 |
|----|------|------|
| F-PR1 | F-0 per-repo config store + API + F0 shared types + F1 backfill 脚本 | 后端配置+backfill，~500 行 |
| F-PR2 | F2 validate-route 端点 + F3 置信度分流（TriageOrchestrator 扩展） | 路由逻辑，~300 行 |
| F-PR3 | F4 前端验证 UX + F5 看板增强 + RepoConfigDialog | 前端组件，~400 行 |

三个 PR 串行（F-PR1 → F-PR2 → F-PR3），每个独立 review + merge。

---

[宪宪/claude-opus-4-6🐾]
