# F096: Interactive Rich Blocks — Implementation Plan

**Feature:** F096 — `docs/features/F096-interactive-rich-blocks.md`
**Goal:** 在现有 Rich Block 架构上新增 `interactive` kind，支持 select/multi-select/card-grid/confirm 4 种交互，用户选择后自动发送消息，状态持久化到 message.extra.rich。
**Acceptance Criteria:** AC-A1~A7, AC-B1~B2（全量覆盖）
**Architecture:** 前端新增 InteractiveBlock 组件 → 用户点选 → PATCH 持久化 block 状态 → CustomEvent 触发 ChatContainer 发送消息 → 猫猫收到普通文字。后端仅增加类型、Zod schema 和 PATCH endpoint，零业务逻辑改动。
**Tech Stack:** TypeScript, React, Zustand, Zod, Fastify, Vitest
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Straight-Line Check

**Finish line:** 猫猫通过 `create_rich_block` 发送 `kind: 'interactive'` block → 前端渲染可交互组件 → 用户点选 → 自动发消息 → block 变 disabled + 回显已选（持久化，刷新不丢）。

**NOT building:**
- 后端交互状态机（交互结果就是一条普通消息）
- 复杂双向实时交互（拖拽、实时协作）
- CLI/API 端的交互支持（Phase B 降级为纯文本）

---

## Task 1: Terminal Schema — Types（shared）

**Files:**
- Modify: `packages/shared/src/types/rich.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Write failing test — interactive block type validation**

Test: `packages/api/test/rich-block-interactive.test.js`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRichBlock } from '@cat-cafe/shared';

describe('F096: normalizeRichBlock — interactive kind', () => {
  it('T1: type→kind alias works for interactive', () => {
    const raw = { type: 'interactive', id: 'i1', interactiveType: 'select', options: [] };
    const result = normalizeRichBlock(raw);
    assert.deepStrictEqual(result.kind, 'interactive');
    assert.strictEqual(result.type, undefined);
  });

  it('T2: auto-fills v:1 for interactive', () => {
    const raw = { kind: 'interactive', id: 'i1', interactiveType: 'select', options: [] };
    const result = normalizeRichBlock(raw);
    assert.strictEqual(result.v, 1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

Expected: FAIL — `VALID_KINDS` doesn't include `'interactive'`, type→kind alias won't work.

**Step 3: Implement types in `packages/shared/src/types/rich.ts`**

Add after `RichAudioBlock`:

```typescript
/** F096: Interactive rich block — user can select/confirm within the block */
export interface InteractiveOption {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  level?: number;
  group?: string;
}

export interface RichInteractiveBlock extends RichBlockBase {
  kind: 'interactive';
  interactiveType: 'select' | 'multi-select' | 'card-grid' | 'confirm';
  title?: string;
  description?: string;
  options: InteractiveOption[];
  maxSelect?: number;
  allowRandom?: boolean;
  messageTemplate?: string;
  disabled?: boolean;
  selectedIds?: string[];
}
```

Update `RichBlockKind`:
```typescript
export type RichBlockKind = 'card' | 'diff' | 'checklist' | 'media_gallery' | 'audio' | 'interactive';
```

Update `RichBlock` union:
```typescript
export type RichBlock =
  | RichCardBlock
  | RichDiffBlock
  | RichChecklistBlock
  | RichMediaGalleryBlock
  | RichAudioBlock
  | RichInteractiveBlock;
```

Update `VALID_KINDS`:
```typescript
const VALID_KINDS: readonly string[] = ['card', 'diff', 'checklist', 'media_gallery', 'audio', 'interactive'];
```

**Step 4: Export new types in `packages/shared/src/types/index.ts`**

Add `RichInteractiveBlock` and `InteractiveOption` to the re-exports.

**Step 5: Build shared**

```bash
pnpm --filter @cat-cafe/shared build
```

**Step 6: Run test to verify it passes**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/shared/src/types/rich.ts packages/shared/src/types/index.ts packages/api/test/rich-block-interactive.test.js
git commit -m "feat(F096): add RichInteractiveBlock type + normalizeRichBlock support"
```

---

## Task 2: API Zod Schema — Interactive Block Validation

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` (richBlockSchema)
- Test: `packages/api/test/rich-block-interactive.test.js` (extend)

**Step 1: Write failing test — Zod validation**

Append to `packages/api/test/rich-block-interactive.test.js`:

```javascript
// Need to import the Zod schema — test by calling the create-rich-block endpoint
// or extract the schema. For now, test via isValidRichBlock if available.
import { isValidRichBlock } from '../src/domains/cats/services/agents/routing/rich-block-extract.js';

describe('F096: isValidRichBlock — interactive', () => {
  it('valid select block', () => {
    const block = {
      id: 'i1', kind: 'interactive', v: 1,
      interactiveType: 'select',
      options: [{ id: 'o1', label: 'Option A' }],
    };
    assert.strictEqual(isValidRichBlock(block), true);
  });

  it('invalid — missing options', () => {
    const block = { id: 'i1', kind: 'interactive', v: 1, interactiveType: 'select' };
    assert.strictEqual(isValidRichBlock(block), false);
  });

  it('invalid — unknown interactiveType', () => {
    const block = {
      id: 'i1', kind: 'interactive', v: 1,
      interactiveType: 'slider',
      options: [{ id: 'o1', label: 'A' }],
    };
    assert.strictEqual(isValidRichBlock(block), false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

**Step 3: Add interactive branch to Zod schema in `callbacks.ts`**

Add to `richBlockSchema` discriminated union array:

```typescript
z.object({
  id: z.string().min(1),
  kind: z.literal('interactive'),
  v: z.literal(1),
  interactiveType: z.enum(['select', 'multi-select', 'card-grid', 'confirm']),
  title: z.string().optional(),
  description: z.string().optional(),
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    emoji: z.string().optional(),
    description: z.string().optional(),
    level: z.number().optional(),
    group: z.string().optional(),
  })).min(1),
  maxSelect: z.number().int().min(1).optional(),
  allowRandom: z.boolean().optional(),
  messageTemplate: z.string().optional(),
  disabled: z.boolean().optional(),
  selectedIds: z.array(z.string()).optional(),
}),
```

**Step 4: Update `isValidRichBlock` in `rich-block-extract.ts`**

Add interactive kind validation:

```typescript
case 'interactive':
  return typeof (b as Record<string, unknown>).interactiveType === 'string'
    && Array.isArray((b as Record<string, unknown>).options)
    && ((b as Record<string, unknown>).options as unknown[]).length > 0;
```

**Step 5: Run tests**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

Expected: PASS

**Step 6: Run existing rich block tests to verify no regression**

```bash
cd packages/api && node --test test/rich-block-extract.test.js
```

Expected: All existing tests PASS

**Step 7: Commit**

```bash
git add packages/api/src/routes/callbacks.ts packages/api/src/domains/cats/services/agents/routing/rich-block-extract.ts packages/api/test/rich-block-interactive.test.js
git commit -m "feat(F096): add interactive block Zod schema + isValidRichBlock support"
```

---

## Task 3: Backend — Block State Persistence (PATCH endpoint)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (IMessageStore + MessageStore)
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisMessageStore.ts`
- Modify: `packages/api/src/routes/callbacks.ts` (or `message-actions.ts`)
- Test: `packages/api/test/rich-block-interactive.test.js` (extend)

**Step 1: Write failing test — updateExtra method**

```javascript
import { MessageStore } from '../src/domains/cats/services/stores/ports/MessageStore.js';

describe('F096: MessageStore.updateExtra', () => {
  it('updates extra.rich block state', () => {
    const store = new MessageStore();
    const msg = store.append({
      userId: 'u1', catId: 'opus', content: 'hello', mentions: [], timestamp: Date.now(),
      extra: { rich: { v: 1, blocks: [
        { id: 'i1', kind: 'interactive', v: 1, interactiveType: 'select', options: [{ id: 'o1', label: 'A' }] }
      ] } },
    });

    const updated = store.updateExtra(msg.id, {
      rich: { v: 1, blocks: [
        { id: 'i1', kind: 'interactive', v: 1, interactiveType: 'select', options: [{ id: 'o1', label: 'A' }], disabled: true, selectedIds: ['o1'] }
      ] },
    });

    assert.ok(updated);
    assert.strictEqual(updated.extra.rich.blocks[0].disabled, true);
    assert.deepStrictEqual(updated.extra.rich.blocks[0].selectedIds, ['o1']);
  });

  it('returns null for non-existent message', () => {
    const store = new MessageStore();
    const result = store.updateExtra('nonexistent', { rich: { v: 1, blocks: [] } });
    assert.strictEqual(result, null);
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Add `updateExtra` to IMessageStore interface**

In `MessageStore.ts`:

```typescript
// In IMessageStore interface:
/** F096: Update message extra data (for interactive block state persistence) */
updateExtra(id: string, extra: StoredMessage['extra']): StoredMessage | null | Promise<StoredMessage | null>;
```

**Step 4: Implement in MessageStore (in-memory)**

```typescript
// In MessageStore class:
updateExtra(id: string, extra: StoredMessage['extra']): StoredMessage | null {
  const msg = this.messages.find((m) => m.id === id);
  if (!msg) return null;
  msg.extra = extra;
  return msg;
}
```

**Step 5: Implement in RedisMessageStore**

```typescript
async updateExtra(id: string, extra: StoredMessage['extra']): Promise<StoredMessage | null> {
  const msg = await this.getById(id);
  if (!msg) return null;
  const key = MessageKeys.detail(id);
  await this.redis.hset(key, { extra: JSON.stringify(extra) });
  msg.extra = extra;
  return msg;
}
```

**Step 6: Add PATCH route in `callbacks.ts`**

```typescript
// PATCH /api/messages/:id/block-state — F096: persist interactive block state
const patchBlockStateSchema = z.object({
  blockId: z.string().min(1),
  disabled: z.boolean().optional(),
  selectedIds: z.array(z.string()).optional(),
});

app.patch('/api/messages/:id/block-state', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = patchBlockStateSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400);
    return { error: 'Invalid request', details: parsed.error.issues };
  }

  const { blockId, disabled, selectedIds } = parsed.data;
  const msg = await messageStore.getById(id);
  if (!msg) {
    reply.status(404);
    return { error: 'Message not found' };
  }

  if (!msg.extra?.rich?.blocks) {
    reply.status(404);
    return { error: 'Message has no rich blocks' };
  }

  const block = msg.extra.rich.blocks.find((b) => b.id === blockId);
  if (!block) {
    reply.status(404);
    return { error: `Block ${blockId} not found` };
  }

  // Merge patch into block
  if (disabled !== undefined) (block as Record<string, unknown>).disabled = disabled;
  if (selectedIds !== undefined) (block as Record<string, unknown>).selectedIds = selectedIds;

  await messageStore.updateExtra(id, msg.extra);
  return { status: 'ok' };
});
```

**Step 7: Run tests**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

Expected: PASS

**Step 8: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/MessageStore.ts packages/api/src/domains/cats/services/stores/redis/RedisMessageStore.ts packages/api/src/routes/callbacks.ts packages/api/test/rich-block-interactive.test.js
git commit -m "feat(F096): add updateExtra + PATCH /api/messages/:id/block-state endpoint"
```

---

## Task 4: Frontend — InteractiveBlock Component

**Files:**
- Create: `packages/web/src/components/rich/InteractiveBlock.tsx`
- Test: `packages/web/src/components/__tests__/interactive-block.test.ts`

**Step 1: Write failing test — message template builder**

```typescript
import { describe, it, expect } from 'vitest';

// Extract as a pure function for testing
function buildSelectionMessage(
  interactiveType: string,
  options: Array<{ id: string; label: string; emoji?: string }>,
  selectedIds: string[],
  messageTemplate?: string,
): string {
  const selected = options.filter((o) => selectedIds.includes(o.id));
  const labels = selected.map((o) => o.emoji ? `${o.emoji} ${o.label}` : o.label);

  if (messageTemplate) {
    return messageTemplate.replace('{selection}', labels.join(', '));
  }

  if (interactiveType === 'confirm') {
    return selectedIds[0] === '__confirm__' ? '确认' : '取消';
  }

  return `我选了：${labels.join(', ')}`;
}

describe('F096: buildSelectionMessage', () => {
  it('select — default template', () => {
    const result = buildSelectionMessage('select', [
      { id: 'a', label: '方案 A' },
      { id: 'b', label: '方案 B' },
    ], ['a']);
    expect(result).toBe('我选了：方案 A');
  });

  it('multi-select — multiple items', () => {
    const result = buildSelectionMessage('multi-select', [
      { id: 'a', label: 'Node.js' },
      { id: 'b', label: 'pnpm' },
    ], ['a', 'b']);
    expect(result).toBe('我选了：Node.js, pnpm');
  });

  it('card-grid — with emoji', () => {
    const result = buildSelectionMessage('card-grid', [
      { id: 'a', label: '猫猫盲盒', emoji: '🎲' },
    ], ['a']);
    expect(result).toBe('我选了：🎲 猫猫盲盒');
  });

  it('confirm — confirm action', () => {
    const result = buildSelectionMessage('confirm', [], ['__confirm__']);
    expect(result).toBe('确认');
  });

  it('confirm — cancel action', () => {
    const result = buildSelectionMessage('confirm', [], ['__cancel__']);
    expect(result).toBe('取消');
  });

  it('custom messageTemplate', () => {
    const result = buildSelectionMessage('select', [
      { id: 'a', label: '宪宪' },
    ], ['a'], '我选了 {selection} 作为引导猫');
    expect(result).toBe('我选了 宪宪 作为引导猫');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/web && pnpm vitest run src/components/__tests__/interactive-block.test.ts
```

**Step 3: Create `InteractiveBlock.tsx`**

Core component (~180 lines) with:
- `buildSelectionMessage` pure function (exported for testing)
- `SelectInteraction` — radio-button-style list
- `MultiSelectInteraction` — checkbox list + confirm button
- `CardGridInteraction` — card grid + optional random button with shuffle animation
- `ConfirmInteraction` — two buttons (confirm/cancel)
- Main `InteractiveBlock` component — switch on `interactiveType`, handle disabled state, dispatch `cat-cafe:interactive-send` event, call PATCH API

Key architecture decisions:
- **Event dispatch:** `window.dispatchEvent(new CustomEvent('cat-cafe:interactive-send', { detail: { text } }))`
- **State persistence:** `apiFetch(\`/api/messages/${messageId}/block-state\`, { method: 'PATCH', body: ... })`
- **Disabled rendering:** Faded opacity + selected option highlighted
- **Random animation:** `setInterval` with increasing delays (50ms → 300ms), cycling through highlighted card index, total ~1.5s

**Step 4: Run test to verify it passes**

```bash
cd packages/web && pnpm vitest run src/components/__tests__/interactive-block.test.ts
```

**Step 5: Commit**

```bash
git add packages/web/src/components/rich/InteractiveBlock.tsx packages/web/src/components/__tests__/interactive-block.test.ts
git commit -m "feat(F096): InteractiveBlock component with 4 interaction types"
```

---

## Task 5: Frontend — Integration (RichBlocks + chatStore + ChatContainer)

**Files:**
- Modify: `packages/web/src/components/rich/RichBlocks.tsx`
- Modify: `packages/web/src/components/ChatMessage.tsx`
- Modify: `packages/web/src/stores/chatStore.ts`
- Modify: `packages/web/src/stores/chat-types.ts`
- Modify: `packages/web/src/components/ChatContainer.tsx`
- Test: `packages/web/src/stores/__tests__/chatStore-interactive-block.test.ts`

**Step 1: Write failing test — chatStore.updateRichBlock action**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@/stores/chatStore';

describe('F096: chatStore.updateRichBlock', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages();
  });

  it('updates a rich block by id within a message', () => {
    const store = useChatStore.getState();
    store.addMessage({
      id: 'msg-1', type: 'assistant', content: 'pick one', timestamp: Date.now(),
      extra: { rich: { v: 1, blocks: [
        { id: 'i1', kind: 'interactive', v: 1, interactiveType: 'select', options: [{ id: 'o1', label: 'A' }] },
      ] } },
    });

    store.updateRichBlock('msg-1', 'i1', { disabled: true, selectedIds: ['o1'] });

    const msg = useChatStore.getState().messages.find((m) => m.id === 'msg-1');
    const block = msg?.extra?.rich?.blocks[0];
    expect(block?.disabled).toBe(true);
    expect(block?.selectedIds).toEqual(['o1']);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/web && pnpm vitest run src/stores/__tests__/chatStore-interactive-block.test.ts
```

**Step 3: Implement**

**chat-types.ts** — Re-export `RichInteractiveBlock` and `InteractiveOption` from `@cat-cafe/shared` (or from local re-export pattern).

**chatStore.ts** — Add `updateRichBlock` action:

```typescript
updateRichBlock: (messageId: string, blockId: string, patch: Record<string, unknown>) =>
  set((state) => ({
    messages: state.messages.map((m) => {
      if (m.id !== messageId || !m.extra?.rich?.blocks) return m;
      return {
        ...m,
        extra: {
          ...m.extra,
          rich: {
            ...m.extra.rich,
            blocks: m.extra.rich.blocks.map((b) =>
              b.id === blockId ? { ...b, ...patch } : b
            ),
          },
        },
      };
    }),
  })),
```

**RichBlocks.tsx** — Add `messageId` prop + case `'interactive'`:

```typescript
import { InteractiveBlock } from './InteractiveBlock';

function RichBlockRenderer({ block, catId, messageId }: { block: RichBlock; catId?: string; messageId?: string }) {
  switch (block.kind) {
    // ... existing cases ...
    case 'interactive':
      return <InteractiveBlock block={block} messageId={messageId} />;
    // ...
  }
}

export function RichBlocks({ blocks, catId, messageId }: { blocks: RichBlock[]; catId?: string; messageId?: string }) {
  // ... pass messageId to RichBlockRenderer
}
```

**ChatMessage.tsx** — Pass `messageId` to `RichBlocks`:

```typescript
<RichBlocks blocks={message.extra.rich.blocks} catId={message.catId} messageId={message.id} />
```

**ChatContainer.tsx** — Add event listener for `cat-cafe:interactive-send`:

```typescript
// Inside ChatContainer, after useSendMessage:
useEffect(() => {
  const handler = (e: Event) => {
    const text = (e as CustomEvent<{ text: string }>).detail.text;
    if (text) handleSend(text);
  };
  window.addEventListener('cat-cafe:interactive-send', handler);
  return () => window.removeEventListener('cat-cafe:interactive-send', handler);
}, [handleSend]);
```

**Step 4: Run test**

```bash
cd packages/web && pnpm vitest run src/stores/__tests__/chatStore-interactive-block.test.ts
```

Expected: PASS

**Step 5: Run all frontend tests for regression**

```bash
cd packages/web && pnpm vitest run
```

**Step 6: Commit**

```bash
git add packages/web/src/components/rich/RichBlocks.tsx packages/web/src/components/ChatMessage.tsx packages/web/src/stores/chatStore.ts packages/web/src/stores/chat-types.ts packages/web/src/components/ChatContainer.tsx packages/web/src/stores/__tests__/chatStore-interactive-block.test.ts
git commit -m "feat(F096): integrate InteractiveBlock into RichBlocks + chatStore + ChatContainer"
```

---

## Task 6: Phase B — Fallback Text + Rules Update

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (no code change needed — already generic JSON)
- Modify: `cat-cafe-skills/refs/rich-blocks.md`
- Modify: `packages/api/src/domains/cats/services/agents/routing/rich-block-extract.ts` (cc_rich text fallback for interactive)

**Step 1: Update rich-blocks.md**

Add `interactive` kind documentation with all 4 types, usage examples, and `messageTemplate` explanation.

**Step 2: Test cc_rich text extraction for interactive blocks**

Add test in `rich-block-interactive.test.js`:

```javascript
import { extractRichFromText } from '../src/domains/cats/services/agents/routing/rich-block-extract.js';

describe('F096: extractRichFromText — interactive', () => {
  it('extracts interactive block from cc_rich fence', () => {
    const text = '请选择：\n```cc_rich\n{"id":"i1","kind":"interactive","v":1,"interactiveType":"select","options":[{"id":"o1","label":"A"}]}\n```';
    const { blocks } = extractRichFromText(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].kind, 'interactive');
  });
});
```

**Step 3: Run tests**

```bash
cd packages/api && node --test test/rich-block-interactive.test.js
```

**Step 4: Commit**

```bash
git add cat-cafe-skills/refs/rich-blocks.md packages/api/test/rich-block-interactive.test.js
git commit -m "docs(F096): update rich-blocks rules + cc_rich extraction test for interactive"
```

---

## Task 7: Update Feature Doc + Biome Check

**Files:**
- Modify: `docs/features/F096-interactive-rich-blocks.md` (update KD-4, KD-5, mark OQ as resolved)

**Step 1: Update feature doc with final decisions**

- OQ-1 → KD-4: 持久化到 `message.extra.rich`
- OQ-2 → KD-5: 闪烁高亮减速动画

**Step 2: Run full quality checks**

```bash
pnpm check
pnpm lint
cd packages/api && node --test test/rich-block-interactive.test.js && node --test test/rich-block-extract.test.js
cd ../web && pnpm vitest run
```

**Step 3: Commit**

```bash
git add docs/features/F096-interactive-rich-blocks.md
git commit -m "docs(F096): resolve OQ-1→KD-4, OQ-2→KD-5"
```

---

## AC Coverage Matrix

| AC | Task | Test |
|----|------|------|
| AC-A1: RichBlockKind + types | Task 1 | normalizeRichBlock tests |
| AC-A2: InteractiveBlock renderer (4 types) | Task 4 | interactive-block.test.ts |
| AC-A3: Auto-send on selection | Task 4+5 | ChatContainer event listener + manual |
| AC-A4: Disabled + 回显 | Task 3+4+5 | PATCH endpoint + updateRichBlock store test |
| AC-A5: MCP create_rich_block support | Task 2 | Zod schema (existing tool is generic JSON) |
| AC-A6: Zod validation | Task 2 | rich-block-interactive.test.js |
| AC-A7: card-grid allowRandom animation | Task 4 | manual verification |
| AC-B1: 非交互降级为文本 | Task 6 | cc_rich extraction test |
| AC-B2: Rules 更新 | Task 6 | rich-blocks.md |
