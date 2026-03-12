# F098: Callback Message UX — Phase A Implementation Plan

**Feature:** F098 — `docs/features/F098-callback-message-ux.md`
**Goal:** 让铲屎官看到猫猫传话方向（谁→谁），优化 A2A 讨论颜色
**Acceptance Criteria:**
- AC-A1: callback 消息 header 显示方向标注（→ @猫名），从消息内容 @mention 解析
- AC-A2: multi_mention 相关消息显示 `→ @猫A + @猫B` 方向
- AC-A3: cross_post 消息方向标注包含来源/目标 thread
- AC-A4: 猫猫 whisper badge 显示 "悄悄话 → @猫名"（和铲屎官 whisper 一致）
- AC-A5: callback 消息有品种色深底气泡（已有，保持不变）
- AC-A6: 方向标注用品种色 pill badge
- AC-A7: A2A 内部讨论消息用中性灰底，品种色仅用于边框/badge
**Architecture:** 纯前端改动。新增方向解析工具函数 + DirectionPill 组件，修改 ChatMessage header 和 A2ACollapsible 样式。
**Tech Stack:** React, TypeScript, Tailwind
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Straight-Line Check

**Finish line (B):** 铲屎官在 chat 中能看到每条猫猫消息的方向（→ @谁），A2A 讨论区颜色不刺眼。

**NOT building:**
- Phase B: Evidence Panel 适配（另开）
- Phase C: 后端 targetCats 元数据（另开）
- connector 消息视觉统一（Phase B）

**Terminal schema:**
```typescript
// 方向信息（从消息解析）
interface DirectionInfo {
  type: 'mention' | 'crossPost' | 'whisper';
  targets: string[];      // catId[] or thread labels
  arrow: '→' | '↗';      // mention/whisper = →, crossPost = ↗
}

// 解析函数签名
function parseDirection(message: ChatMessageType, getMentionToCat: () => Map<string, string>): DirectionInfo | null;
```

---

### Task 1: parseDirection 工具函数

**Files:**
- Create: `packages/web/src/lib/parse-direction.ts`
- Create: `packages/web/src/lib/__tests__/parse-direction.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/web/src/lib/__tests__/parse-direction.test.ts
import { describe, it, expect } from 'vitest';
import { parseDirection } from '../parse-direction';

const mockMentionMap = new Map([
  ['opus', 'opus'], ['布偶猫', 'opus'],
  ['codex', 'codex'], ['缅因猫', 'codex'],
  ['gpt52', 'gpt52'],
]);

describe('parseDirection', () => {
  it('returns null for stream messages', () => {
    const msg = { origin: 'stream', content: '@codex hi' } as any;
    expect(parseDirection(msg, () => mockMentionMap)).toBeNull();
  });

  it('parses @mention from callback content', () => {
    const msg = { origin: 'callback', content: 'R2 修复确认\n\n@codex' } as any;
    const result = parseDirection(msg, () => mockMentionMap);
    expect(result).toEqual({ type: 'mention', targets: ['codex'], arrow: '→' });
  });

  it('parses multiple @mentions', () => {
    const msg = { origin: 'callback', content: '通知\n@codex\n@gpt52' } as any;
    const result = parseDirection(msg, () => mockMentionMap);
    expect(result).toEqual({ type: 'mention', targets: ['codex', 'gpt52'], arrow: '→' });
  });

  it('deduplicates same cat different aliases', () => {
    const msg = { origin: 'callback', content: '@codex @缅因猫' } as any;
    const result = parseDirection(msg, () => mockMentionMap);
    expect(result).toEqual({ type: 'mention', targets: ['codex'], arrow: '→' });
  });

  it('parses crossPost direction', () => {
    const msg = { origin: 'callback', content: 'cross post', extra: { crossPost: { sourceThreadId: 'thread_abc123' } } } as any;
    const result = parseDirection(msg, () => mockMentionMap);
    expect(result).toEqual({ type: 'crossPost', targets: ['abc123'], arrow: '↗' });
  });

  it('parses whisper direction from whisperTo', () => {
    const msg = { visibility: 'whisper', whisperTo: ['codex', 'gpt52'], content: 'secret' } as any;
    const result = parseDirection(msg, () => mockMentionMap);
    expect(result).toEqual({ type: 'whisper', targets: ['codex', 'gpt52'], arrow: '→' });
  });

  it('returns null for callback with no @mention', () => {
    const msg = { origin: 'callback', content: 'general broadcast' } as any;
    expect(parseDirection(msg, () => mockMentionMap)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/__tests__/parse-direction.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/web/src/lib/parse-direction.ts
import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';

export interface DirectionInfo {
  type: 'mention' | 'crossPost' | 'whisper';
  targets: string[];
  arrow: '→' | '↗';
}

/**
 * Parse direction info from a chat message.
 * Priority: whisper > crossPost > @mention in content.
 */
export function parseDirection(
  message: Pick<ChatMessageType, 'origin' | 'content' | 'visibility' | 'whisperTo' | 'extra'>,
  getMentionToCat: () => Map<string, string>,
): DirectionInfo | null {
  // Whisper — highest priority, has explicit targets
  if (message.visibility === 'whisper' && message.whisperTo?.length) {
    return { type: 'whisper', targets: message.whisperTo, arrow: '→' };
  }

  // CrossPost — has source thread metadata
  if (message.extra?.crossPost?.sourceThreadId) {
    const shortId = message.extra.crossPost.sourceThreadId.replace(/^thread_/, '').slice(0, 8);
    return { type: 'crossPost', targets: [shortId], arrow: '↗' };
  }

  // Stream messages don't need direction (catId is enough)
  if (message.origin === 'stream') return null;

  // Callback — parse @mentions from content
  const mentionMap = getMentionToCat();
  const mentionRe = /@(\S+)/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRe.exec(message.content)) !== null) {
    const alias = match[1].toLowerCase();
    const catId = mentionMap.get(alias);
    if (catId) found.add(catId);
  }

  if (found.size > 0) {
    return { type: 'mention', targets: [...found], arrow: '→' };
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/__tests__/parse-direction.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add packages/web/src/lib/parse-direction.ts packages/web/src/lib/__tests__/parse-direction.test.ts
git commit -m "feat(F098): add parseDirection utility for callback message direction"
```

---

### Task 2: DirectionPill 组件

**Files:**
- Create: `packages/web/src/components/DirectionPill.tsx`

**Step 1: Write the component**

```typescript
// packages/web/src/components/DirectionPill.tsx
import type { CatData } from '@/hooks/useCatData';
import type { DirectionInfo } from '@/lib/parse-direction';

interface DirectionPillProps {
  direction: DirectionInfo;
  getCatById: (id: string) => CatData | undefined;
}

/**
 * F098: Direction pill badge — shows "→ @猫名" in breed color.
 * Placed in ChatMessage header row, after timestamp.
 */
export function DirectionPill({ direction, getCatById }: DirectionPillProps) {
  // Build label: "→ @猫A + @猫B" or "↗ abc123"
  const labels = direction.targets.map((target) => {
    if (direction.type === 'crossPost') return target;
    const cat = getCatById(target);
    return cat ? `@${cat.displayName}` : `@${target}`;
  });
  const text = `${direction.arrow} ${labels.join(' + ')}`;

  // Get color from first target cat (for breed-tinted pill)
  const firstCat = direction.type !== 'crossPost' ? getCatById(direction.targets[0]) : undefined;
  const color = firstCat?.color.primary ?? '#9B7EBD';

  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {text}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/DirectionPill.tsx
git commit -m "feat(F098): add DirectionPill component for breed-colored direction badge"
```

---

### Task 3: 集成方向标注到 ChatMessage header

**Files:**
- Modify: `packages/web/src/components/ChatMessage.tsx:7,256-269`

**Step 1: Add imports and direction parsing**

Add to imports (after line 7):
```typescript
import { getMentionToCat } from '@/lib/mention-highlight';
import { parseDirection } from '@/lib/parse-direction';
import { DirectionPill } from './DirectionPill';
```

After `isRevealed` (line 146), add:
```typescript
const direction = catData ? parseDirection(message, getMentionToCat) : null;
```

**Step 2: Add DirectionPill to header row**

In the header div (around line 258-280), add after the whisper badge or after timestamp:
```tsx
{direction && <DirectionPill direction={direction} getCatById={getCatById} />}
```

**Step 3: Fix cat whisper badge to show direction (AC-A4)**

Change line 267 from:
```tsx
{isRevealed ? '已揭秘' : '悄悄话'}
```
to:
```tsx
{isRevealed ? '已揭秘' : `悄悄话 → ${message.whisperTo?.map((id) => {
  const cat = getCatById(id);
  return cat ? cat.displayName : id;
}).join(', ') ?? ''}`}
```

**Step 4: Verify — run type check**

Run: `cd packages/web && npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add packages/web/src/components/ChatMessage.tsx
git commit -m "feat(F098): integrate direction pill + cat whisper direction in ChatMessage header"
```

---

### Task 4: A2A Collapsible 颜色优化

**Files:**
- Modify: `packages/web/src/components/A2ACollapsible.tsx:59-64`

**Step 1: Change A2A expanded container styling**

Replace lines 59-64:
```tsx
<div className="mt-1 ml-3 pl-3 border-l-2 border-purple-400 dark:border-purple-600 space-y-1">
  {group.messages.map((msg) => (
    <div key={msg.id} className="opacity-80">
      {renderMessage(msg)}
    </div>
  ))}
</div>
```

With (neutral gray bg + breed color border from first message, no opacity):
```tsx
<div className="mt-1 ml-3 pl-3 border-l-2 space-y-1 bg-slate-50 dark:bg-slate-800/50 rounded-r-lg py-2"
  style={{ borderColor: firstCatColor }}
>
  {group.messages.map((msg) => (
    <div key={msg.id}>
      {renderMessage(msg)}
    </div>
  ))}
</div>
```

**Step 2: Add breed color resolution**

After `catLabel` computation (line 37), add:
```typescript
// F098: Use first cat's breed color for A2A left border (instead of static purple)
const firstCatColor = group.messages[0]?.catId
  ? (getCatById?.(group.messages[0].catId)?.color.primary ?? '#9B7EBD')
  : '#9B7EBD';
```

This requires adding `getCatById` to props:
```typescript
interface A2ACollapsibleProps {
  group: A2AGroup;
  renderMessage: (msg: ChatMessage) => React.ReactNode;
  getCatById?: (id: string) => { color: { primary: string } } | undefined;
}
```

**Step 3: Update ChatContainer to pass getCatById to A2ACollapsible**

Find where `<A2ACollapsible>` is rendered in ChatContainer.tsx and add the `getCatById` prop.

**Step 4: Verify — visual check + type check**

Run: `cd packages/web && npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add packages/web/src/components/A2ACollapsible.tsx packages/web/src/components/ChatContainer.tsx
git commit -m "feat(F098): A2A neutral gray bg + breed color border, remove opacity-80"
```

---

### Task 5: 最终验证 + biome check

**Step 1: Run biome lint**

Run: `pnpm check`
Expected: no errors (fix if any)

**Step 2: Run type check**

Run: `pnpm lint`
Expected: clean

**Step 3: Run all web tests**

Run: `cd packages/web && npx vitest run`
Expected: all pass

**Step 4: Commit any lint fixes**

---

## AC Coverage Matrix

| AC | Task | 验证方式 |
|----|------|---------|
| AC-A1 | Task 1+3 | parseDirection test + visual pill in header |
| AC-A2 | Task 1+3 | parseDirection handles multi @mention |
| AC-A3 | Task 1+3 | parseDirection handles crossPost |
| AC-A4 | Task 3 | Whisper badge shows "悄悄话 → @猫名" |
| AC-A5 | — | Already met (breed color bg unchanged) |
| AC-A6 | Task 2+3 | DirectionPill uses breed color |
| AC-A7 | Task 4 | A2A gray bg + breed border |
