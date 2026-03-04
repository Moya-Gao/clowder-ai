# F050 Phase 1b: 狸花猫 Identity & Frontend Integration

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Align Phase 1 DARE implementation with the 狸花猫 (Dragon Li) identity design doc, add frontend visual resources, and update mention routing.

**Architecture:** Update cat-config.json breed/identity fields to match design doc (breed=`dragon-li`, catId=`dare`, colors=`#D4A76A` amber). Add CSS variables, Tailwind tokens, bubble styles, and CatTokenUsage mapping. Update DareAgentService default catId. All changes are non-blocking (no DARE CLI changes needed).

**Tech Stack:** TypeScript, React, Tailwind CSS, Zod, Node test runner

**Design doc:** `docs/discussions/2026-03-04-f050-dragon-li-identity-design/README.md`

---

### Task 1: Update cat-config.json — breed identity alignment

**Files:**
- Modify: `cat-config.json:318-345`

**Step 1: Update the dare breed entry**

Change the following fields to match design doc:

```jsonc
// BEFORE (Phase 1 placeholder):
{
  "id": "dare",
  "catId": "dare-agent",
  "name": "DARE Agent",
  "displayName": "DARE",
  "avatar": "/avatars/dare.png",
  "color": { "primary": "#FF6B35", "secondary": "#FFE0D0" },
  "mentionPatterns": ["@dare-agent", "@dare"],
  "roleDescription": "External DARE agent (Deterministic Agent Runtime Engine)",
  ...
}

// AFTER (design doc aligned):
{
  "id": "dragon-li",
  "catId": "dare",
  "name": "狸花猫",
  "displayName": "狸花猫",
  "avatar": "/avatars/dare.png",
  "color": { "primary": "#D4A76A", "secondary": "#F5EBD7" },
  "mentionPatterns": ["@dare", "@狸花猫", "@狸花", "@dragon-li", "@lihua"],
  "roleDescription": "确定性执行与审计引擎，擅长零信任验证、状态外化追踪和可重放执行",
  "teamStrengths": "确定性执行、审计追踪、零信任验证、状态外化",
  "caution": "框架猫，底层 LLM 可变；事件输出需映射",
  ...
}
```

Also update the variant:
- Model: keep `zhipu/glm-4.7` (test phase)
- Add personality: `"沉默寡言但极其警觉，不会主动亲近但一旦认可就绝对可靠，信任是挣来的不是给的"`
- Add contextBudget (design doc: 120k/100k)

**Step 2: Update roster entry**

```jsonc
// BEFORE:
"dare-agent": { "family": "dare", ... }

// AFTER:
"dare": { "family": "dragon-li", ... }
```

**Step 3: Run config loader test**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-phase1b && pnpm --filter @cat-cafe/api test 2>&1 | grep -E '(pass|fail|cat-config)'`
Expected: All existing tests pass, DARE cat loads with new identity.

**Step 4: Commit**

```
feat(F050): align cat-config with dragon-li identity design
```

---

### Task 2: Update DareAgentService default catId

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/DareAgentService.ts:46`
- Modify: `packages/api/test/dare-agent-service.test.js`

**Step 1: Write failing test**

In `dare-agent-service.test.js`, add test:
```javascript
test('default catId is "dare" (not "dare-agent")', () => {
  const svc = new DareAgentService({ model: 'test/model', darePath: '/tmp' });
  assert.strictEqual(svc.catId, 'dare');
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f050-phase1b && node --test packages/api/test/dare-agent-service.test.js`
Expected: FAIL — catId is `'dare-agent'`

**Step 3: Fix DareAgentService default**

```typescript
// Line 46: change 'dare-agent' → 'dare'
this.catId = options?.catId ?? createCatId('dare');
```

**Step 4: Update existing tests that pass `catId: 'dare-agent'`**

Replace all `catId: 'dare-agent'` with `catId: 'dare'` in test file.

**Step 5: Run tests to verify pass**

Run: `node --test packages/api/test/dare-agent-service.test.js`
Expected: All pass

**Step 6: Commit**

```
feat(F050): update DareAgentService default catId to 'dare'
```

---

### Task 3: Add frontend CSS variables for 狸花猫

**Files:**
- Modify: `packages/web/src/app/globals.css:27-28` (after Gemini section)

**Step 1: Add CSS variables**

```css
/* DARE / 狸花猫 (Dragon Li) - Amber */
--color-dare-primary: #D4A76A;
--color-dare-light: #E8C99B;
--color-dare-dark: #8B6F47;
--color-dare-bg: #FBF5EC;
```

**Step 2: Add dark mode override**

```css
--color-dare-bg: rgba(212, 167, 106, 0.15);
```

**Step 3: Commit**

```
feat(F050): add dragon-li CSS color variables
```

---

### Task 4: Add Tailwind color tokens

**Files:**
- Modify: `packages/web/tailwind.config.js:24-25` (after owner section)

**Step 1: Add dare color tokens**

```javascript
dare: {
  primary: 'var(--color-dare-primary)',
  light: 'var(--color-dare-light)',
  dark: 'var(--color-dare-dark)',
  bg: 'var(--color-dare-bg)',
},
```

**Step 2: Commit (combine with Task 3)**

```
feat(F050): add dragon-li CSS variables + Tailwind tokens
```

---

### Task 5: Add bubble style for 狸花猫

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx:18-22`

**Step 1: Add dragon-li breed style**

```typescript
const BREED_STYLES: Record<string, { radius: string; font?: string }> = {
  ragdoll: { radius: 'rounded-2xl rounded-bl-sm' },
  'maine-coon': { radius: 'rounded-2xl rounded-br-sm', font: 'font-mono' },
  siamese: { radius: 'rounded-2xl rounded-tr-sm' },
  'dragon-li': { radius: 'rounded-lg rounded-tl-sm', font: 'font-mono' },
};
```

Design doc: 左上 (top-left) pointer = `rounded-tl-sm`, 6px ≈ `rounded-lg`, monospace font.

**Step 2: Commit**

```
feat(F050): add dragon-li bubble style (top-left pointer, mono font)
```

---

### Task 6: Add CatTokenUsage color mapping

**Files:**
- Modify: `packages/web/src/components/CatTokenUsage.tsx:17-21`

**Step 1: Add dare entry**

```typescript
const CAT_TEXT_COLORS: Record<string, string> = {
  opus: 'text-opus-dark',
  codex: 'text-codex-dark',
  gemini: 'text-gemini-dark',
  dare: 'text-dare-dark',
};
```

**Step 2: Commit (combine with Task 5)**

```
feat(F050): add dragon-li frontend visual integration
```

---

### Task 7: Run full test suite + build verification

**Step 1: Run API tests**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f050-phase1b
pnpm --filter @cat-cafe/api test
```

**Step 2: Run build**

```bash
pnpm -r --if-present run build
```

**Step 3: Run biome**

```bash
pnpm check
```

Expected: All green.

---

### Task 8: Commit design doc

**Files:**
- Stage: `docs/discussions/2026-03-04-f050-dragon-li-identity-design/README.md`

**Step 1: Commit**

```
docs(F050): add dragon-li identity design discussion
```

---

## Out of Scope (blocked / deferred)

| Item | Blocker | Tracking |
|------|---------|----------|
| stdin pipe (control-stdin) | DARE CLI needs changes | F050 spec Phase 1b |
| Session resume (`--session-id`) | DARE issue #184 | GitHub issue |
| 头像 (`dare.png`) | 烁烁需要绘制 | Design doc §4 |
| 昵称 | 铲屎官拍板 | Design doc §2 |
| 协作阶段变体 (dare-claude etc.) | 测试阶段优先 | Design doc §6 |
