# F140 Phase B: 猫自动处理 Implementation Plan

**Feature:** F140 — `docs/features/F140-github-pr-automation.md`
**Goal:** 猫收到冲突/review feedback 通知后能自动采取行动（rebase/处理 review），而不只是看到通知
**Acceptance Criteria:**
- AC-B1: 猫收到冲突通知后能自动尝试 rebase resolve
- AC-B2: 简单冲突自动 resolve + push，复杂冲突通知铲屎官
- AC-B3: 猫收到 review feedback 后按 receive-review 模式自动处理
**Architecture:** Phase A 已交付完整的检测→投递→唤醒管道。Phase B 在消息层加入 action hint metadata，在 Skill 层加入自动响应行为引导，让被唤醒的猫知道该做什么。附带修复 ReviewFeedbackTaskSpec 的 F139 1b 对齐偏差。
**Tech Stack:** TypeScript (backend) + Skill markdown (behavior layer)
**前端验证:** No — 纯后端 + Skill 层

---

## Task 0: Fix ReviewFeedbackTaskSpec F139 1b alignment

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts`
- Test: `packages/api/test/scheduler/review-feedback-spec.test.js`

**Step 1: Add actor + ctx to ReviewFeedbackTaskSpec**

```typescript
// Line 11: Add ExecuteContext import
import type { ExecuteContext, TaskSpec_P1 } from '../scheduler/types.js';

// Line 103: Add _ctx parameter
async execute(signal: ReviewFeedbackSignal, _subjectKey: string, _ctx: ExecuteContext) {

// After line ~147 (before closing }): Add actor field
actor: { role: 'repo-watcher', costTier: 'cheap' },
```

**Step 2: Run existing tests to confirm no regression**

Run: `pnpm --filter @cat-cafe/api test -- --grep "review-feedback"`
Expected: All existing tests PASS

**Step 3: Commit**

```
fix(F140): align ReviewFeedbackTaskSpec with F139 1b (actor + ctx)
```

---

## Task 1: Add action hint to conflict notification messages

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConflictRouter.ts` (`buildConflictMessageContent`)
- Test: `packages/api/test/scheduler/conflict-check-spec.test.js`

**Step 1: Write the failing test**

Add a test that verifies the conflict message contains an action hint block:

```javascript
it('conflict message includes action hint metadata', () => {
  const { buildConflictMessageContent } = require('../../src/infrastructure/email/ConflictRouter.js');
  const content = buildConflictMessageContent({
    repoFullName: 'owner/repo',
    prNumber: 42,
    headSha: 'abc1234567890',
    mergeState: 'CONFLICTING',
  });
  assert.ok(content.includes('自动处理'), 'should include action hint');
  assert.ok(content.includes('git fetch origin main'), 'should include rebase command');
  assert.ok(content.includes('owner/repo#42'), 'should include PR reference');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/scheduler/conflict-check-spec.test.js`
Expected: FAIL

**Step 3: Add action hint block to `buildConflictMessageContent`**

```typescript
export function buildConflictMessageContent(signal: ConflictSignal): string {
  const lines: string[] = [
    '⚠️ **PR 冲突**',
    '',
    `PR #${signal.prNumber} (${signal.repoFullName})`,
    `Commit: \`${signal.headSha.slice(0, 7)}\``,
    '',
    '当前分支与 base 存在冲突，需要 rebase 或手动解决。',
    '',
    '---',
    '🔧 **自动处理**（KD-13: 全自动 + 事后通知）',
    `- 目标: ${signal.repoFullName}#${signal.prNumber}`,
    '- 操作: 在对应 worktree 执行 `git fetch origin main && git rebase origin/main`',
    '- rebase 成功: push 并通知铲屎官已自动解决',
    '- rebase 冲突: 评估复杂度 → 简单则尝试解决 → 复杂则通知铲屎官附冲突文件列表',
  ];
  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `node --test packages/api/test/scheduler/conflict-check-spec.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(F140-B): add action hint to conflict notification messages
```

---

## Task 2: Add action hint to review feedback notification messages

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts` (`buildReviewFeedbackContent`)
- Test: `packages/api/test/scheduler/review-feedback-spec.test.js`

**Step 1: Write the failing test**

```javascript
it('review feedback message includes action hint metadata', () => {
  const { buildReviewFeedbackContent } = require('../../src/infrastructure/email/ReviewFeedbackRouter.js');
  const content = buildReviewFeedbackContent({
    repoFullName: 'owner/repo',
    prNumber: 42,
    newComments: [],
    newDecisions: [{ id: 1, author: 'alice', state: 'CHANGES_REQUESTED', body: 'fix this', submittedAt: '2026-03-26' }],
  });
  assert.ok(content.includes('自动处理'), 'should include action hint');
  assert.ok(content.includes('receive-review'), 'should reference receive-review mode');
  assert.ok(content.includes('owner/repo#42'), 'should include PR reference');
});
```

**Step 2: Run test to verify it fails**

**Step 3: Add action hint block to `buildReviewFeedbackContent`**

After the three-section content, append:

```typescript
// After all sections, before return:
lines.push(
  '',
  '---',
  '🔧 **自动处理**',
  `- 目标: ${signal.repoFullName}#${signal.prNumber}`,
);

// Decision-aware action hints
const hasChangesRequested = signal.newDecisions.some((d) => d.state === 'CHANGES_REQUESTED');
const hasApproved = signal.newDecisions.some((d) => d.state === 'APPROVED');

if (hasChangesRequested) {
  lines.push('- 操作: 加载 `receive-review` 模式，逐项处理 review 意见（Red→Green）');
} else if (hasApproved) {
  lines.push('- 操作: PR 已被批准，检查 CI 和冲突状态，准备 merge');
} else {
  lines.push('- 操作: 阅读评论内容，需要回复则回复，需要修改则按 `receive-review` 模式处理');
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```
feat(F140-B): add action hint to review feedback notification messages
```

---

## Task 3: Update pr-signals.md with auto-response behavior guide

**Files:**
- Modify: `cat-cafe-skills/refs/pr-signals.md`

**Step 1: Add "Receiving and Acting on Notifications" section**

Append after existing content:

```markdown
## Phase B: 收到通知后的自动响应（KD-13）

猫被 ConnectorInvokeTrigger 唤醒后，根据通知类型自动采取行动。

### 冲突通知响应（AC-B1 + AC-B2）

收到 `github-conflict` 通知时：

1. **定位 worktree**：根据 PR 号找到对应的 worktree（`gh pr view {N} --json headRefName`）
2. **执行 rebase**：
   ```bash
   cd <worktree-path>
   git fetch origin main
   git rebase origin/main
   ```
3. **评估结果**：
   - **rebase clean（无冲突）**→ `git push --force-with-lease` → 通知铲屎官"已自动 resolve"
   - **冲突 ≤3 个文件 + 非 binary**→ 尝试手动解决 → 成功则 push + 通知
   - **复杂冲突**（>3 文件 / binary / 语义冲突）→ `git rebase --abort` → 通知铲屎官附冲突文件列表

### Review Feedback 响应（AC-B3）

收到 `github-review-feedback` 通知时，根据 review decision 分流：

| Decision | 行动 |
|----------|------|
| `CHANGES_REQUESTED` | 加载 `receive-review` 模式，逐项处理（Red→Green） |
| `APPROVED` | 检查 CI + 冲突状态 → 全绿则准备 merge-gate |
| `COMMENTED` | 阅读评论，需回复则回复，需修改则按 receive-review 处理 |
| `DISMISSED` | 记录，不自动行动 |

### 事后通知（KD-13: 全自动 + 事后通知）

所有自动行动完成后，通知铲屎官结果：
- 成功: "已自动 rebase 并 push PR #42"
- 失败: "PR #42 冲突无法自动解决，需要人工介入" + 冲突文件列表
```

**Step 2: Commit**

```
docs(F140-B): add auto-response behavior guide to pr-signals.md
```

---

## Task 4: Update merge-gate SKILL with conflict auto-response

**Files:**
- Modify: `cat-cafe-skills/merge-gate/SKILL.md`

**Step 1: Add conflict auto-response section**

After the existing PR tracking registration section, add a section on "Handling Conflict Notifications":

```markdown
### 收到冲突通知时（F140 Phase B）

如果你在 merge-gate 流程中或 worktree 开发中收到 `github-conflict` connector 通知：

1. 暂停当前工作，处理冲突优先（冲突是 merge blocker）
2. 在对应 worktree 执行 rebase（参见 `refs/pr-signals.md` Phase B）
3. rebase 成功后继续原工作流
4. 复杂冲突 → 通知铲屎官，等指示后再继续
```

**Step 2: Commit**

```
docs(F140-B): add conflict auto-response to merge-gate SKILL
```

---

## Task 5: Update receive-review SKILL with auto-trigger entry

**Files:**
- Modify: `cat-cafe-skills/receive-review/SKILL.md`

**Step 1: Add auto-trigger section**

Enhance the existing "triggered by github-review-feedback connector" mention with explicit auto-response behavior:

```markdown
### 自动触发处理（F140 Phase B）

当 `github-review-feedback` connector 唤醒你时：

1. 读取通知内容，识别 review decision 类型
2. `CHANGES_REQUESTED` → 直接进入本 Skill 的 Red→Green 流程
3. `APPROVED` → 不需要 receive-review，检查是否可以走 merge-gate
4. `COMMENTED` → 判断是否需要代码修改，需要则进入 Red→Green 流程
5. 处理完成后通知铲屎官结果（KD-13: 事后通知）
```

**Step 2: Commit**

```
docs(F140-B): add auto-trigger entry to receive-review SKILL
```

---

## Verification Checklist

| AC | 覆盖任务 | 验证方式 |
|----|---------|---------|
| AC-B1 | Task 1 (action hint) + Task 3 (behavior guide) + Task 4 (merge-gate) | 冲突消息含 rebase 指令 + Skill 引导猫执行 |
| AC-B2 | Task 3 (simple/complex 分级) | pr-signals.md 含分级决策树（≤3 文件 vs 复杂） |
| AC-B3 | Task 2 (action hint) + Task 3 (decision 分流) + Task 5 (receive-review) | review 消息含处理指令 + Skill 引导按 decision 分流 |
| F139 alignment | Task 0 | ReviewFeedbackTaskSpec 有 actor + ctx |
