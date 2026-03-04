---
feature_ids: [F055]
topics: [plan-board, implementation]
doc_kind: plan
created: 2026-03-03
---

# F055 猫猫祟祟 — 实施计划

## 概览

新增独立 `<PlanBoardPanel />` section 到右侧状态栏，将 task progress 从"当前调用"的 CatInvocationCard 中抽出，每猫独立卡片。

## 改动范围

| 文件 | 动作 | 说明 |
|------|------|------|
| `components/PlanBoardPanel.tsx` | **新增** | 猫猫祟祟主组件 |
| `components/RightStatusPanel.tsx` | **编辑** | 移除 CatTaskProgress 渲染 + 引入 PlanBoardPanel |
| `__tests__/plan-board-panel.test.ts` | **新增** | 核心测试 |

不改后端、不改 store、不改事件消费链路。纯前端展示层。

## 分步计划

### Step 1: Red — 写失败测试 (TDD)

新建 `packages/web/src/components/__tests__/plan-board-panel.test.ts`

测试用例（按 AC 编号）：

| # | 用例 | 对应 AC |
|---|------|---------|
| T1 | renders section title "猫猫祟祟" with cat count | AC-1 |
| T2 | shows only cats with taskProgress (filters out empty) | AC-2 |
| T3 | renders per-cat card with color dot + name + progress | AC-3 |
| T4 | running cats appear first, completed fold to bottom | AC-4 |
| T5 | interrupted cat shows "继续" button | AC-5 |
| T6 | invocation_created resets card to empty (via prop change) | AC-6 |
| T7 | renders 8 cats without overflow/crash | AC-7 |
| T8 | does not render when no cats have taskProgress | AC-2 |

先写 T1~T5 跑红灯。

### Step 2: Green — 实现 PlanBoardPanel

从 `RightStatusPanel.tsx` 提取 `CatTaskProgress`（目前定义在该文件 L40-L109），搬到 `PlanBoardPanel.tsx`。

PlanBoardPanel 结构：

```
<section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
  <header>猫猫祟祟 (N)</header>

  {/* running + interrupted cats */}
  {runningCats.map(cat => <PlanCard />)}
  {interruptedCats.map(cat => <PlanCard />)}

  {/* completed — 折叠区 */}
  {completedCats.length > 0 && (
    <CollapsibleSection title="已完成 (N)">
      {completedCats.map(cat => <CompletedPlanCard />)}
    </CollapsibleSection>
  )}
</section>
```

分类逻辑（useMemo）：
- `running`: `snapshotStatus === 'running'`，按 `startedAt` desc
- `interrupted`: `snapshotStatus === 'interrupted'`
- `completed`: `snapshotStatus === 'completed'`，按 `lastUpdate` desc

Props: `{ threadId: string; catInvocations: Record<string, CatInvocationInfo> }`

### Step 3: 迁移 — 从 CatInvocationCard 移除 task progress

编辑 `RightStatusPanel.tsx`：
1. 删除 `CatTaskProgress` 组件定义（L40-L109）
2. 删除 CatInvocationCard 中的 task progress 渲染条件（L149-L151）
3. 在 SessionChainPanel 前/后插入 `<PlanBoardPanel />`

### Step 4: 补充测试 + 回归

- T6~T8 跑绿
- 跑现有 `RightStatusPanel` 相关测试确认无回归
- `pnpm --filter @cat-cafe/web test -- --run`
- `pnpm --filter @cat-cafe/web build`

### Step 5: 提交

```bash
git add packages/web/src/components/PlanBoardPanel.tsx \
       packages/web/src/components/__tests__/plan-board-panel.test.ts \
       packages/web/src/components/RightStatusPanel.tsx
git commit -m "feat(F055): add 猫猫祟祟 Plan Board panel [布偶猫/宪宪]"
```

## 检查点

- [ ] 所有新测试绿灯
- [ ] 现有测试无回归
- [ ] `pnpm --filter @cat-cafe/web build` 通过
- [ ] `pnpm check` (Biome) 无新 error
- [ ] 文件 < 200 行
