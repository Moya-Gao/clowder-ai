# F088 Phase 3: Rich Block → Platform Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Cat Café rich blocks (card, diff, checklist, media_gallery, audio) are formatted as platform-native messages (Feishu interactive card / Telegram HTML) and delivered to external chats, with plaintext fallback.

**Architecture:** Extend `IOutboundAdapter` with optional `sendRichMessage()`. OutboundDeliveryHook detects rich blocks from the stored message after invocation, dispatches to `sendRichMessage` if available, falls back to `sendReply` with plaintext rendering. Each adapter handles its own platform-specific formatting internally.

**Tech Stack:** TypeScript, `@larksuiteoapi/node-sdk` (Feishu card JSON), `grammy` (Telegram HTML parse_mode), existing RichBlock types from `@cat-cafe/shared`.

**NOT building:** AC-14 button callbacks (interactive card actions) — display only, deferred to later phase. No streaming/edit (Phase 4). No audio as voice message (Phase 6).

---

### Task 1: Plaintext Rich Block Renderer (shared utility)

Pure function: any `RichBlock` → readable plaintext string. Used as fallback when adapter doesn't support rich messages or for unsupported block kinds.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/rich-block-plaintext.ts`
- Create: `packages/api/test/rich-block-plaintext.test.js`

**Step 1: Write failing tests**

```typescript
// packages/api/test/rich-block-plaintext.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderRichBlockPlaintext } from '../dist/infrastructure/connectors/rich-block-plaintext.js';

describe('renderRichBlockPlaintext', () => {
  it('renders card with title and body', () => {
    const block = { id: 'b1', kind: 'card', v: 1, title: 'Review Summary', bodyMarkdown: 'All good' };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('Review Summary'));
    assert.ok(result.includes('All good'));
  });

  it('renders card with fields', () => {
    const block = { id: 'b1', kind: 'card', v: 1, title: 'Status', fields: [{ label: 'P1', value: '0' }] };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('P1'));
    assert.ok(result.includes('0'));
  });

  it('renders checklist with checked/unchecked items', () => {
    const block = {
      id: 'b2', kind: 'checklist', v: 1, title: 'TODO',
      items: [{ id: 'i1', text: 'Write tests', checked: true }, { id: 'i2', text: 'Deploy' }],
    };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('✅ Write tests'));
    assert.ok(result.includes('☐ Deploy'));
  });

  it('renders diff with file path', () => {
    const block = { id: 'b3', kind: 'diff', v: 1, filePath: 'src/index.ts', diff: '+added line' };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('src/index.ts'));
    assert.ok(result.includes('+added line'));
  });

  it('renders audio with text', () => {
    const block = { id: 'b4', kind: 'audio', v: 1, url: 'https://x.mp3', text: 'Hello world' };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('Hello world'));
  });

  it('renders media_gallery with items', () => {
    const block = {
      id: 'b5', kind: 'media_gallery', v: 1,
      items: [{ url: 'https://img.png', caption: 'Screenshot' }],
    };
    const result = renderRichBlockPlaintext(block);
    assert.ok(result.includes('Screenshot'));
  });

  it('renders unknown kind gracefully', () => {
    const block = { id: 'b6', kind: 'unknown_future', v: 1 };
    const result = renderRichBlockPlaintext(block);
    assert.equal(typeof result, 'string');
  });
});
```

**Step 2:** Run `node --test packages/api/test/rich-block-plaintext.test.js` — expect FAIL (module not found)

**Step 3: Implement**

```typescript
// packages/api/src/infrastructure/connectors/rich-block-plaintext.ts
import type { RichBlock } from '@cat-cafe/shared';

export function renderRichBlockPlaintext(block: RichBlock): string {
  switch (block.kind) {
    case 'card': {
      const parts = [`📋 ${block.title}`];
      if (block.bodyMarkdown) parts.push(block.bodyMarkdown);
      if (block.fields?.length) {
        parts.push(block.fields.map((f) => `  ${f.label}: ${f.value}`).join('\n'));
      }
      return parts.join('\n');
    }
    case 'checklist': {
      const header = block.title ? `☑️ ${block.title}` : '☑️ Checklist';
      const items = block.items.map((i) => `${i.checked ? '✅' : '☐'} ${i.text}`).join('\n');
      return `${header}\n${items}`;
    }
    case 'diff':
      return `📝 ${block.filePath}\n\`\`\`\n${block.diff}\n\`\`\``;
    case 'audio':
      return block.text ? `🔊 ${block.text}` : `🔊 [Audio: ${block.url}]`;
    case 'media_gallery': {
      const header = block.title ? `🖼️ ${block.title}` : '🖼️ Gallery';
      const items = block.items.map((i) => i.caption || i.alt || i.url).join('\n');
      return `${header}\n${items}`;
    }
    default:
      return `[${(block as RichBlock).kind}]`;
  }
}

export function renderAllRichBlocksPlaintext(blocks: RichBlock[]): string {
  return blocks.map(renderRichBlockPlaintext).join('\n\n');
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): add plaintext rich block renderer`

---

### Task 2: Feishu Card Formatter

Format RichBlock[] → Feishu Lark interactive card JSON. The card JSON follows [Lark Message Card](https://open.larkoffice.com/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create) format.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/adapters/feishu-card-formatter.ts`
- Create: `packages/api/test/feishu-card-formatter.test.js`

**Step 1: Write failing tests**

```typescript
// packages/api/test/feishu-card-formatter.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFeishuCard } from '../dist/infrastructure/connectors/adapters/feishu-card-formatter.js';

describe('formatFeishuCard', () => {
  it('formats card block as Lark interactive card', () => {
    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
    const card = formatFeishuCard(blocks, '布偶猫');
    assert.equal(card.header.title.content, '[布偶猫🐱] Review');
    assert.ok(card.elements.length > 0);
  });

  it('formats checklist as card elements', () => {
    const blocks = [{
      id: 'b2', kind: 'checklist', v: 1, title: 'TODO',
      items: [{ id: 'i1', text: 'Tests', checked: true }, { id: 'i2', text: 'Deploy' }],
    }];
    const card = formatFeishuCard(blocks, '布偶猫');
    const content = JSON.stringify(card);
    assert.ok(content.includes('Tests'));
    assert.ok(content.includes('Deploy'));
  });

  it('formats diff as code block element', () => {
    const blocks = [{ id: 'b3', kind: 'diff', v: 1, filePath: 'src/a.ts', diff: '+line' }];
    const card = formatFeishuCard(blocks, '布偶猫');
    const content = JSON.stringify(card);
    assert.ok(content.includes('src/a.ts'));
  });

  it('sets card header color from tone', () => {
    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Warning', tone: 'warning' }];
    const card = formatFeishuCard(blocks, '布偶猫');
    assert.equal(card.header.template, 'orange');
  });

  it('handles multiple blocks in single card', () => {
    const blocks = [
      { id: 'b1', kind: 'card', v: 1, title: 'Summary', bodyMarkdown: 'Done' },
      { id: 'b2', kind: 'checklist', v: 1, items: [{ id: 'i1', text: 'Item' }] },
    ];
    const card = formatFeishuCard(blocks, '布偶猫');
    assert.ok(card.elements.length >= 2);
  });
});
```

**Step 2:** Run test — expect FAIL

**Step 3: Implement**

```typescript
// packages/api/src/infrastructure/connectors/adapters/feishu-card-formatter.ts
import type { RichBlock } from '@cat-cafe/shared';

const TONE_TO_COLOR: Record<string, string> = {
  info: 'blue', success: 'green', warning: 'orange', danger: 'red',
};

interface LarkCardElement {
  tag: string;
  [key: string]: unknown;
}

interface LarkCard {
  header: { title: { content: string; tag: string }; template: string };
  elements: LarkCardElement[];
}

function blockToElements(block: RichBlock): LarkCardElement[] {
  switch (block.kind) {
    case 'card': {
      const els: LarkCardElement[] = [];
      if (block.bodyMarkdown) {
        els.push({ tag: 'markdown', content: block.bodyMarkdown });
      }
      if (block.fields?.length) {
        els.push({
          tag: 'markdown',
          content: block.fields.map((f) => `**${f.label}**: ${f.value}`).join('\n'),
        });
      }
      return els;
    }
    case 'checklist': {
      const text = block.items.map((i) => `${i.checked ? '✅' : '☐'} ${i.text}`).join('\n');
      return [{ tag: 'markdown', content: block.title ? `**${block.title}**\n${text}` : text }];
    }
    case 'diff':
      return [
        { tag: 'markdown', content: `**${block.filePath}**` },
        { tag: 'markdown', content: `\`\`\`${block.languageHint || ''}\n${block.diff}\n\`\`\`` },
      ];
    case 'audio':
      return [{ tag: 'markdown', content: block.text ? `🔊 ${block.text}` : `🔊 [Audio]` }];
    case 'media_gallery': {
      const text = block.items.map((i) => `[${i.caption || i.alt || 'image'}](${i.url})`).join('\n');
      return [{ tag: 'markdown', content: block.title ? `**${block.title}**\n${text}` : text }];
    }
    default:
      return [{ tag: 'markdown', content: `[${(block as RichBlock).kind}]` }];
  }
}

export function formatFeishuCard(blocks: RichBlock[], catDisplayName: string): LarkCard {
  // Use first card block's title + tone if available, else generic
  const firstCard = blocks.find((b) => b.kind === 'card');
  const title = firstCard ? `[${catDisplayName}🐱] ${firstCard.title}` : `[${catDisplayName}🐱]`;
  const tone = (firstCard?.kind === 'card' && firstCard.tone) || 'info';
  const template = TONE_TO_COLOR[tone] || 'blue';

  const elements: LarkCardElement[] = [];
  for (const block of blocks) {
    elements.push(...blockToElements(block));
  }

  return { header: { title: { content: title, tag: 'plain_text' }, template }, elements };
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): add Feishu Lark card formatter for rich blocks`

---

### Task 3: Telegram HTML Formatter

Format RichBlock[] → HTML string for Telegram `sendMessage` with `parse_mode: 'HTML'`.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/adapters/telegram-html-formatter.ts`
- Create: `packages/api/test/telegram-html-formatter.test.js`

**Step 1: Write failing tests**

```typescript
// packages/api/test/telegram-html-formatter.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTelegramHtml } from '../dist/infrastructure/connectors/adapters/telegram-html-formatter.js';

describe('formatTelegramHtml', () => {
  it('formats card with title and body', () => {
    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'All good' }];
    const html = formatTelegramHtml(blocks, '布偶猫');
    assert.ok(html.includes('<b>[布偶猫🐱] Review</b>'));
    assert.ok(html.includes('All good'));
  });

  it('formats checklist with emoji checkboxes', () => {
    const blocks = [{
      id: 'b2', kind: 'checklist', v: 1,
      items: [{ id: 'i1', text: 'Done', checked: true }, { id: 'i2', text: 'Pending' }],
    }];
    const html = formatTelegramHtml(blocks, '布偶猫');
    assert.ok(html.includes('✅ Done'));
    assert.ok(html.includes('☐ Pending'));
  });

  it('formats diff as pre/code block', () => {
    const blocks = [{ id: 'b3', kind: 'diff', v: 1, filePath: 'src/a.ts', diff: '+line' }];
    const html = formatTelegramHtml(blocks, '布偶猫');
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('+line'));
  });

  it('escapes HTML special chars in content', () => {
    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Test <script>', bodyMarkdown: 'a & b' }];
    const html = formatTelegramHtml(blocks, '布偶猫');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&amp;'));
  });

  it('respects Telegram 4096 char limit with truncation', () => {
    const longBody = 'x'.repeat(5000);
    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Big', bodyMarkdown: longBody }];
    const html = formatTelegramHtml(blocks, '布偶猫');
    assert.ok(html.length <= 4096);
  });
});
```

**Step 2:** Run test — expect FAIL

**Step 3: Implement**

```typescript
// packages/api/src/infrastructure/connectors/adapters/telegram-html-formatter.ts
import type { RichBlock } from '@cat-cafe/shared';

const TELEGRAM_MAX = 4096;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function blockToHtml(block: RichBlock): string {
  switch (block.kind) {
    case 'card': {
      const parts = [`📋 <b>${esc(block.title)}</b>`];
      if (block.bodyMarkdown) parts.push(esc(block.bodyMarkdown));
      if (block.fields?.length) {
        parts.push(block.fields.map((f) => `<b>${esc(f.label)}</b>: ${esc(f.value)}`).join('\n'));
      }
      return parts.join('\n');
    }
    case 'checklist': {
      const header = block.title ? `☑️ <b>${esc(block.title)}</b>` : '☑️ <b>Checklist</b>';
      const items = block.items.map((i) => `${i.checked ? '✅' : '☐'} ${esc(i.text)}`).join('\n');
      return `${header}\n${items}`;
    }
    case 'diff':
      return `📝 <b>${esc(block.filePath)}</b>\n<pre>${esc(block.diff)}</pre>`;
    case 'audio':
      return block.text ? `🔊 ${esc(block.text)}` : '🔊 [Audio]';
    case 'media_gallery': {
      const header = block.title ? `🖼️ <b>${esc(block.title)}</b>` : '🖼️ <b>Gallery</b>';
      const items = block.items.map((i) => esc(i.caption || i.alt || i.url)).join('\n');
      return `${header}\n${items}`;
    }
    default:
      return `[${esc((block as RichBlock).kind)}]`;
  }
}

export function formatTelegramHtml(blocks: RichBlock[], catDisplayName: string): string {
  const header = `<b>[${esc(catDisplayName)}🐱]</b>`;
  const body = blocks.map(blockToHtml).join('\n\n');
  const full = `${header}\n\n${body}`;
  if (full.length <= TELEGRAM_MAX) return full;
  return full.slice(0, TELEGRAM_MAX - 1) + '…';
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): add Telegram HTML formatter for rich blocks`

---

### Task 4: Extend IOutboundAdapter + OutboundDeliveryHook

Add optional `sendRichMessage` to adapter interface. OutboundDeliveryHook detects rich blocks and dispatches accordingly.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts`
- Modify: `packages/api/test/outbound-delivery-hook.test.js`

**Step 1: Write failing tests**

Add to existing test file:

```typescript
it('calls sendRichMessage when adapter supports it and blocks provided', () => {
  // Mock adapter with sendRichMessage
  // Call deliver with richBlocks
  // Assert sendRichMessage was called, not sendReply
});

it('falls back to sendReply with plaintext when adapter lacks sendRichMessage', () => {
  // Mock adapter WITHOUT sendRichMessage
  // Call deliver with richBlocks
  // Assert sendReply was called with plaintext-rendered blocks
});

it('sends text via sendReply when no rich blocks', () => {
  // Call deliver WITHOUT richBlocks
  // Assert sendReply called as before (backward compatible)
});
```

**Step 2:** Run test — expect FAIL

**Step 3: Implement**

```typescript
// Updated IOutboundAdapter
export interface IOutboundAdapter {
  readonly connectorId: string;
  sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  sendRichMessage?(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

// Updated deliver()
async deliver(threadId: string, content: string, catId?: CatId, richBlocks?: RichBlock[]): Promise<void> {
  // ... existing binding lookup ...
  // If richBlocks and adapter has sendRichMessage → call it
  // Else → sendReply with text (+ plaintext-rendered blocks appended if blocks exist)
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): extend OutboundDeliveryHook to dispatch rich blocks`

---

### Task 5: FeishuAdapter.sendRichMessage

Implement `sendRichMessage` on FeishuAdapter using the Lark card formatter.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts`
- Add test cases to: `packages/api/test/feishu-adapter.test.js` (or create if needed)

**Step 1:** Write test for sendRichMessage calling Lark API with `msg_type: 'interactive'`

**Step 2:** Run test — expect FAIL

**Step 3:** Implement sendRichMessage on FeishuAdapter:

```typescript
async sendRichMessage(
  externalChatId: string,
  textContent: string,
  blocks: RichBlock[],
  catDisplayName: string,
): Promise<void> {
  const card = formatFeishuCard(blocks, catDisplayName);
  await this.client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: externalChatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
  });
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): implement Feishu sendRichMessage with Lark cards`

---

### Task 6: TelegramAdapter.sendRichMessage

Implement `sendRichMessage` on TelegramAdapter using the HTML formatter.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts`
- Add test cases

**Step 1:** Write test for sendRichMessage calling `bot.api.sendMessage` with `parse_mode: 'HTML'`

**Step 2:** Run test — expect FAIL

**Step 3:** Implement:

```typescript
async sendRichMessage(
  externalChatId: string,
  textContent: string,
  blocks: RichBlock[],
  catDisplayName: string,
): Promise<void> {
  const html = formatTelegramHtml(blocks, catDisplayName);
  await this.bot.api.sendMessage(Number(externalChatId), html, { parse_mode: 'HTML' });
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): implement Telegram sendRichMessage with HTML formatting`

---

### Task 7: ConnectorInvokeTrigger — Pass Rich Blocks to Deliver

After invocation completes, read the persisted message's `extra.rich.blocks` and pass to `outboundHook.deliver()`.

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts` (around line 335)
- Modify: `packages/api/test/f088-gateway-integration.test.js`

**Step 1:** Write integration test:

```typescript
it('passes rich blocks from stored message to outbound hook', () => {
  // Setup: agent produces text + rich block (card)
  // Mock outboundHook.deliver
  // Assert deliver was called with (threadId, text, catId, richBlocks)
  // where richBlocks contains the card
});
```

**Step 2:** Run test — expect FAIL

**Step 3:** Modify ConnectorInvokeTrigger (around line 335):

```typescript
// ⑥ Outbound delivery: send final text + rich blocks to bound external chats
if (this.opts.outboundHook && collectedTextParts.length > 0) {
  const finalContent = collectedTextParts.join('');

  // Retrieve rich blocks from the persisted message
  let richBlocks: RichBlock[] | undefined;
  try {
    const messages = this.opts.messageStore.getByThread(threadId);
    const lastAgentMsg = [...messages].reverse().find(
      (m) => m.role === 'assistant' && m.catId === catId && m.extra?.rich?.blocks?.length,
    );
    if (lastAgentMsg?.extra?.rich?.blocks?.length) {
      richBlocks = lastAgentMsg.extra.rich.blocks;
    }
  } catch {
    // Non-critical: proceed without rich blocks
  }

  this.opts.outboundHook.deliver(threadId, finalContent, catId, richBlocks).catch((err) => {
    log.error({ err, threadId }, '[ConnectorInvokeTrigger] Outbound delivery error');
  });
}
```

**Step 4:** Build + run test — expect PASS

**Step 5:** Commit `feat(F088): wire rich blocks from stored message to outbound delivery`

---

### Task 8: End-to-End Verification + Docs Update

**Files:**
- Run: `pnpm test` (full suite)
- Update: `docs/features/F088-multi-platform-chat-gateway.md` (check AC-11, AC-12, AC-13)

**Step 1:** Run full test suite, fix any regressions

**Step 2:** Update AC checkboxes in feature doc

**Step 3:** Final commit `docs(F088): mark Phase 3 AC-11/12/13 done`

---

## Dependency Graph

```
Task 1 (plaintext renderer)
    ↓
Task 4 (OutboundDeliveryHook) ← depends on Task 1 for fallback
    ↓
Task 7 (ConnectorInvokeTrigger) ← depends on Task 4 for new signature

Task 2 (Feishu formatter)
    ↓
Task 5 (FeishuAdapter) ← depends on Task 2

Task 3 (Telegram formatter)
    ↓
Task 6 (TelegramAdapter) ← depends on Task 3

Task 8 ← depends on all above
```

**Parallelizable:** Tasks 1/2/3 can run in parallel. Tasks 5/6 can run in parallel after their formatters.

## Deferred (NOT in this phase)

- **AC-14 card button callbacks**: Requires Feishu card action webhook endpoint + ConnectorRouter extension. Significant scope — defer to Phase 3b or later.
- **Audio as voice message**: Defer to Phase 6 (STT/TTS pipeline).
- **Media gallery as actual images**: Defer to Phase 5 (image upload/download pipeline).
