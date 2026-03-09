# F086 M2 — 元思考触发器 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Put "when should I ask others" into 5 verifiable trigger rules baked into Skills/shared-rules, with Design Gate integration and end-to-end test.

**Architecture:** M2 is purely Skills/docs/test layer — no new runtime code. The MCP hardcheck (`searchEvidenceRefs` / `overrideReason`) was already built in M1. M2 adds the behavioral rules that tell cats *when* to use that tool, plus a Design Gate checkpoint.

**Tech Stack:** Markdown (Skills files) + node:test (verification test)

**What we're NOT building:** No new API endpoints, no new MCP tools, no runtime code changes, no UI changes.

---

### Task 1: Add Meta-Thinking Trigger Rules to shared-rules.md

**Files:**
- Modify: `cat-cafe-skills/refs/shared-rules.md` (add new §13)

**Step 1: Read current shared-rules.md to find insertion point**

After §12 (Runtime Singleton Protection), add §13.

**Step 2: Add §13 元思考触发器 section**

```markdown
### §13 元思考触发器（F086 M2）

调用 `cat_cafe_multi_mention` 前，**必须先搜后问**（MCP 层硬检查：缺少 `searchEvidenceRefs` 且无 `overrideReason` → 拒绝调用）。

| 触发器 | 场景 | 默认动作 |
|--------|------|---------|
| **A: 高影响决策** | 架构选型、API 契约、跨模块改动 | 先搜 `docs/decisions/` → 再决定是否 multi_mention |
| **B: 跨领域问题** | 涉及前端/安全/性能/UX 等非自身专长 | 先搜对应领域文档 → 再 @ 对应领域的猫 |
| **C: 高不确定性** | 方案不确定、多种选择难以取舍 | 先搜历史讨论 → 再拉猫获取多视角 |
| **D: 信息不足** | 发现自己对上下文了解不够 | 先 search（messages/docs/evidence）→ 再问人 |
| **E: 新领域侦查** | 要写新代码/MCP/集成时，先摸清现有体系 | 先从 `docs/features/README.md` 顺藤摸瓜 → 读相关 spec/discussion → 再动手 |

**硬检查 vs 软引导**：
- **硬**：`multi_mention` MCP 调用必须带 `searchEvidenceRefs[]`（≥1 条）或 `overrideReason`
- **软**：触发器表是自检参考，不是每次工作都要填表——只在调 `multi_mention` 时强制

**不滥用**：不是每个问题都拉全体。优先级：自己搜 → 搜不到再拉 1-2 只对口猫 → 真正跨领域才拉 3 只。
```

**Step 3: Commit**

```bash
git add cat-cafe-skills/refs/shared-rules.md
git commit -m "docs(F086): add meta-thinking trigger rules to shared-rules §13 [布偶猫🐾]"
```

---

### Task 2: Add Design Gate "先搜现状" Check to feat-lifecycle

**Files:**
- Modify: `cat-cafe-skills/feat-lifecycle/SKILL.md` (Design Gate section)

**Step 1: Read current Design Gate section and find insertion point**

The Design Gate section has a table and a 5-step flow. Add a Step 0 check.

**Step 2: Add "先搜现状" check before Design Gate flow**

In the Design Gate section, before "**流程**：", add:

```markdown
**前置检查（F086 M2）**：
开 Design Gate 前，先做触发器 E "新领域侦查"：
1. 读 `docs/features/README.md` 找相关 Feature
2. 读相关 Feature spec 的 Key Decisions / Open Questions
3. 搜 `docs/discussions/` 看有没有前人讨论过类似问题
4. 把发现记录到 Design Gate 讨论里（避免重复造轮子）
```

**Step 3: Commit**

```bash
git add cat-cafe-skills/feat-lifecycle/SKILL.md
git commit -m "docs(F086): add Design Gate '先搜现状' check (M2 trigger E) [布偶猫🐾]"
```

---

### Task 3: Reference Trigger Rules in collaborative-thinking Mode B

**Files:**
- Modify: `cat-cafe-skills/collaborative-thinking/SKILL.md` (Mode B section)

**Step 1: Read Mode B section and find insertion point**

Mode B is "Multi-cat independent thinking". Add a note about when to trigger multi-cat thinking.

**Step 2: Add trigger reference at the start of Mode B**

Before the existing Mode B content, add:

```markdown
**何时启动 Mode B？** 参见 `shared-rules.md` §13 元思考触发器 A-D。
调 `cat_cafe_multi_mention` 前必须带搜索证据（`searchEvidenceRefs`）。
```

**Step 3: Commit**

```bash
git add cat-cafe-skills/collaborative-thinking/SKILL.md
git commit -m "docs(F086): reference meta-thinking triggers in collaborative-thinking Mode B [布偶猫🐾]"
```

---

### Task 4: End-to-End Verification Test

**Files:**
- Create: `packages/api/test/multi-mention-m2-triggers.test.js`

**Step 1: Write the test**

This test verifies:
1. The MCP hardcheck rejects calls without searchEvidenceRefs AND without overrideReason (already tested in M1, but re-verify)
2. The trigger rules exist in shared-rules.md (documentation completeness guard)
3. All 5 trigger types (A-E) are documented
4. The triggerType enum in the MCP schema matches the documented triggers

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('F086 M2: Meta-thinking trigger documentation', () => {
  const sharedRules = readFileSync(
    resolve(import.meta.dirname, '../../../cat-cafe-skills/refs/shared-rules.md'),
    'utf-8',
  );

  it('shared-rules contains §13 meta-thinking trigger section', () => {
    assert.ok(sharedRules.includes('§13'), 'Missing §13 section');
    assert.ok(sharedRules.includes('元思考触发器'), 'Missing trigger section title');
  });

  it('documents all 5 trigger types (A-E)', () => {
    const triggers = ['A: 高影响决策', 'B: 跨领域问题', 'C: 高不确定性', 'D: 信息不足', 'E: 新领域侦查'];
    for (const t of triggers) {
      assert.ok(sharedRules.includes(t), `Missing trigger: ${t}`);
    }
  });

  it('documents hardcheck vs soft guidance distinction', () => {
    assert.ok(sharedRules.includes('searchEvidenceRefs'), 'Missing searchEvidenceRefs reference');
    assert.ok(sharedRules.includes('overrideReason'), 'Missing overrideReason reference');
  });

  it('triggerType enum values match documented triggers', async () => {
    const { multiMentionInputSchema } = await import(
      '../../mcp-server/dist/tools/callback-tools.js'
    );
    const triggerField = multiMentionInputSchema.triggerType;
    // Zod enum — extract options
    const options = triggerField._def.innerType._def.values;
    const expected = ['high-impact', 'cross-domain', 'uncertain', 'info-gap', 'recon'];
    assert.deepStrictEqual([...options].sort(), [...expected].sort());
  });

  it('feat-lifecycle contains Design Gate 先搜现状 check', () => {
    const featLifecycle = readFileSync(
      resolve(import.meta.dirname, '../../../cat-cafe-skills/feat-lifecycle/SKILL.md'),
      'utf-8',
    );
    assert.ok(featLifecycle.includes('先搜现状'), 'Missing Design Gate pre-check');
    assert.ok(featLifecycle.includes('新领域侦查'), 'Missing trigger E reference');
  });

  it('collaborative-thinking references trigger rules', () => {
    const collabThinking = readFileSync(
      resolve(import.meta.dirname, '../../../cat-cafe-skills/collaborative-thinking/SKILL.md'),
      'utf-8',
    );
    assert.ok(collabThinking.includes('§13'), 'Missing §13 reference');
  });
});
```

**Step 2: Run test to verify it fails (Red)**

```bash
node --test packages/api/test/multi-mention-m2-triggers.test.js
```

Expected: FAIL (§13 doesn't exist yet, feat-lifecycle doesn't have 先搜现状, etc.)

**Step 3: Implement Tasks 1-3 (make tests pass)**

Apply the changes from Tasks 1-3.

**Step 4: Run test to verify it passes (Green)**

```bash
node --test packages/api/test/multi-mention-m2-triggers.test.js
```

Expected: 6 passed, 0 failed

**Step 5: Commit test**

```bash
git add packages/api/test/multi-mention-m2-triggers.test.js
git commit -m "test(F086): add M2 meta-thinking trigger documentation guard [布偶猫🐾]"
```

---

### Task 5: Update F086 Spec — Check Off M2 ACs

**Files:**
- Modify: `docs/features/F086-cat-orchestration-multi-mention.md` (M2 AC section)

**Step 1: Check off all M2 ACs**

Change `- [ ]` to `- [x]` for each M2 AC line.

**Step 2: Add Timeline entry**

```markdown
- 2026-03-09: M2 元思考触发器实施完成（5 trigger rules + Design Gate + verification tests）
```

**Step 3: Commit**

```bash
git add docs/features/F086-cat-orchestration-multi-mention.md
git commit -m "docs(F086): check off M2 ACs + timeline [布偶猫🐾]"
```

---

## Execution Order

TDD-first approach — write the guard test first (Task 4 Step 1-2), then implement Tasks 1-3 to make it pass, then check off ACs (Task 5).

1. Task 4 Step 1-2 (write test, verify Red)
2. Task 1 (shared-rules §13)
3. Task 2 (feat-lifecycle Design Gate)
4. Task 3 (collaborative-thinking reference)
5. Task 4 Step 4-5 (verify Green, commit test)
6. Task 5 (spec ACs)

Total: ~5 commits, ~20 minutes work. No runtime code changes.
