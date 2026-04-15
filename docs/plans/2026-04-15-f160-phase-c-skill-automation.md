---
feature_ids: [F160]
topics: [task-board, skills, automation, system-prompt]
doc_kind: phase
created: 2026-04-15
---

# F160 Phase C: Skill Automation — Implementation Plan

**Feature:** F160 — `docs/features/F160-task-board-upgrade.md`
**Goal:** 让猫主动用起来——在关键 Skill 节点自动创建任务 + blocked 任务进入 thread 时主动提醒
**Acceptance Criteria:**
- AC-C1: feat-lifecycle kickoff 自动创建 thread 任务
- AC-C2: receive-review 为 P1/P2 自动创建修复任务
- AC-C3: blocked 任务在猫进入 thread 时触发 system prompt 提醒
**Architecture:** 改两层——Skill markdown（猫的行为指引）+ SystemPromptBuilder（blocked 提醒注入）
**Tech Stack:** Skill markdown + TypeScript (formatTaskSnapshot.ts)
**前端验证:** No — 纯后端 + skill 内容改动

---

## Task 1: feat-lifecycle kickoff 自动创建 thread 任务 (AC-C1)

**Files:**
- Modify: `cat-cafe-skills/feat-lifecycle/SKILL.md:87-89`（Step 5 之后加任务创建指引）

**Step 1: 在 feat-lifecycle kickoff Step 5 后加任务创建指引**

在正式立项 Step 1-5 的检查清单后，加入毛线球任务创建指引：

```markdown
6. **创建毛线球任务**：立项 commit 后，调用 `cat_cafe_create_task` 为当前 thread 创建跟踪任务：
   - title: `完成 F{NNN}: {Feature 名称}`
   - why: 从 spec Why 节摘 1 句
   - 不要为 trivial feature（≤1 file 改动、无 Phase 拆分）创建任务

**Gotcha**: 只在有 threadId 的会话中创建。铲屎官在非 thread 环境立项（如 BACKLOG 批量整理）时跳过此步。
```

同时在检查清单行追加 `毛线球任务创建 ✓`。

**Step 2: Commit**

```bash
git commit -m "feat(F160): AC-C1 feat-lifecycle kickoff auto-create task"
```

---

## Task 2: receive-review 为 P1/P2 自动创建修复任务 (AC-C2)

**Files:**
- Modify: `cat-cafe-skills/receive-review/SKILL.md:113-126`（Red→Green 流程前加任务创建）

**Step 1: 在 Red→Green 流程前加 P1/P2 任务创建指引**

在"对每个 P1/P2 问题："后、步骤列表前，插入：

```markdown
对每个 P1/P2 问题：

**Step 0: 创建修复任务**（在动手修之前）
调用 `cat_cafe_create_task` 为每个 P1/P2 创建独立跟踪任务：
- title: `[P{N}] {问题摘要}`（如 `[P2] TaskComposer HTTP 错误时丢失输入`）
- why: reviewer 的原始描述（≤120 字）
- 修复完成后 `cat_cafe_update_task` 状态改为 `done`

**Gotcha**: 不要为 P3 创建任务——P3 当场修或放下，不记 BACKLOG 也不记毛线球。
```

**Step 2: 在修复后确认章节加 task 状态更新提醒**

在修复确认表格模板中，提醒更新任务状态：

```markdown
修复完成后：
- 每个 P1/P2 修复任务 → `cat_cafe_update_task` 状态改为 `done`
- 回给 reviewer 确认（硬规则不变）
```

**Step 3: Commit**

```bash
git commit -m "feat(F160): AC-C2 receive-review auto-create fix task per P1/P2"
```

---

## Task 3: blocked 任务 system prompt 提醒 (AC-C3)

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/formatTaskSnapshot.ts:56-113`
- Test: `packages/api/test/format-task-snapshot.test.js`

**Step 1: 写失败测试 — blocked 任务触发提醒 header**

在 `format-task-snapshot.test.js` 添加测试：

```javascript
it('prepends blocked reminder when blocked tasks exist', () => {
  const tasks = [
    { id: 't1', threadId: 'th1', title: 'Waiting for API key', ownerCatId: 'opus',
      status: 'blocked', why: 'Need admin approval', createdBy: 'user',
      createdAt: Date.now() - 86400000, updatedAt: Date.now() - 3600000 },
    { id: 't2', threadId: 'th1', title: 'Build UI', ownerCatId: 'opus',
      status: 'doing', why: '', createdBy: 'user',
      createdAt: Date.now(), updatedAt: Date.now() },
  ];
  const result = formatTaskSnapshot(tasks);
  assert.ok(result.includes('⚠️ 有 1 个任务被阻塞'));
  assert.ok(result.includes('Waiting for API key'));
});

it('does not show blocked reminder when no blocked tasks', () => {
  const tasks = [
    { id: 't1', threadId: 'th1', title: 'Build UI', ownerCatId: 'opus',
      status: 'doing', why: '', createdBy: 'user',
      createdAt: Date.now(), updatedAt: Date.now() },
  ];
  const result = formatTaskSnapshot(tasks);
  assert.ok(!result.includes('⚠️ 有'));
});

it('shows plural blocked reminder for multiple blocked tasks', () => {
  const tasks = [
    { id: 't1', threadId: 'th1', title: 'Task A', ownerCatId: null,
      status: 'blocked', why: 'Dep 1', createdBy: 'user',
      createdAt: Date.now(), updatedAt: Date.now() },
    { id: 't2', threadId: 'th1', title: 'Task B', ownerCatId: null,
      status: 'blocked', why: 'Dep 2', createdBy: 'user',
      createdAt: Date.now(), updatedAt: Date.now() },
  ];
  const result = formatTaskSnapshot(tasks);
  assert.ok(result.includes('⚠️ 有 2 个任务被阻塞'));
});
```

**Step 2: 运行测试确认红灯**

```bash
pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build && node --test packages/api/test/format-task-snapshot.test.js
```

**Step 3: 实现 blocked 提醒**

在 `formatTaskSnapshot.ts` 的 `formatTaskSnapshot()` 函数中，header 行之后、任务列表之前插入：

```typescript
// Blocked reminder (F160 Phase C: AC-C3)
if (counts.blocked > 0) {
  const blockedTasks = sorted.filter((t) => t.status === 'blocked');
  lines.push(`⚠️ 有 ${counts.blocked} 个任务被阻塞，请优先处理或更新状态：`);
  for (const bt of blockedTasks) {
    const title = truncate(sanitize(bt.title), MAX_TITLE);
    lines.push(`  → ${title}`);
  }
  lines.push('');
}
```

**Step 4: 运行测试确认绿灯**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/format-task-snapshot.test.js
```

**Step 5: Commit**

```bash
git commit -m "feat(F160): AC-C3 blocked task reminder in system prompt"
```

---

## Task 4: 全量验证 + biome

**Step 1: 运行全套检查**

```bash
pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build
```

**Step 2: Commit any format fixes**

---

## Not Building (YAGNI)

- debugging skill 自动创建修复任务 — spec 列了但 AC 没覆盖，Phase C AC 只有 C1/C2/C3
- cross-cat-handoff 自动创建交接任务 — 同上
- 定期检查 doing 超 3 天无更新的提醒 — C2 提到但无对应 AC，后续补
- 任务完成率统计 / dashboard — 超出 scope
