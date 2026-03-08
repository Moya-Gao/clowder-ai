---
feature_ids: [F065]
doc_kind: plan
created: 2026-03-06
---

# F065 Phase C: Handoff Digest Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Generate LLM-powered handoff digest (meeting-minutes style) on session seal, so the next session's bootstrap gets richer context than the extractive digest alone.

**Architecture:** On `finalize()`, after writing the extractive digest and ThreadMemory, call Haiku via raw `fetch` (Anthropic Messages API) with a combined input (handoff summaries + extractive digest + recent chat messages). Write the result to `digest.handoff.md` with YAML frontmatter. `SessionBootstrap` reads the handoff digest when `bootstrapDepth === 'generative'`, falling back to extractive.

**Tech Stack:** Node `fetch` (Anthropic Messages API), Haiku model, YAML frontmatter, existing TranscriptFormatter + TranscriptReader

**Design Decisions (converged with gpt52):**
- Q1 Timing: Sync in `finalize()` with hard timeout (5s default), failure degrades gracefully
- Q2 Model: Haiku (cheapest, Anthropic infra already available)
- Q3 Input: Combined: `formatEventsHandoff()` + `digest.extractive.json` + last 8 chat messages
- Q4 Storage: Disk `digest.handoff.md` with YAML frontmatter (same session dir)
- Q5 Fallback: ThreadMemory is INDEPENDENT section (NOT in fallback chain); previous session summary slot: handoff digest -> extractive digest -> none
- Q6 Config: Use existing `bootstrapDepth: 'extractive' | 'generative'` per-cat; add system-level params

**R1 fixes (codex plan review):**
- P1-1: `finalize()` checks per-cat `bootstrapDepth` before generating — only `generative` cats trigger Haiku call (was: "always generate if API key exists")
- P1-2: Read ALL events via paginated loop (was: single `readEvents()` call with default limit=50, losing long sessions)
- P1-3: Profile resolution injected as `(threadId, catId) => Promise<{apiKey, baseUrl}>` function, not startup-time singleton (was: global `handoffConfig` from `resolveAnthropicRuntimeProfile`)

**R2 fixes (codex plan review):**
- P1-1: Task 5 接线示例修正：正确 import `resolveProviderProfilesRoot` + `findMonorepoRoot`，`await` async 调用链
- P1-2: Task 5 resolver 使用 `threadStore.get(threadId).projectPath` 匹配 invoke-single-cat.ts:313 的 thread→projectRoot→profile 解析路径

**Not building:**
- LLM-generated ThreadMemory (Phase B's rule-based approach stays)
- UI for handoff digest display
- Retry logic (single attempt with hard timeout; failure = graceful degradation)

---

### Task 1: TranscriptReader — `readHandoffDigest()` + TranscriptWriter helper

Add read/write capabilities for `digest.handoff.md` alongside the existing extractive digest.

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/TranscriptReader.ts`
- Modify: `packages/api/src/domains/cats/services/session/TranscriptWriter.ts`
- Test: `packages/api/test/handoff-digest-io.test.js`

**Step 1: Write the failing test for `readHandoffDigest`**

```javascript
// test/handoff-digest-io.test.js
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TranscriptReader } from '../dist/domains/cats/services/session/TranscriptReader.js';

describe('handoff digest IO', () => {
  let tempDir;
  let reader;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'handoff-io-'));
    reader = new TranscriptReader({ dataDir: tempDir });
  });
  afterEach(async () => { await rm(tempDir, { recursive: true }); });

  const sessionDir = (t, c, s) => join(t, 'threads', c, s, 'sessions');

  test('readHandoffDigest returns markdown body when file exists', async () => {
    const dir = join(tempDir, 'threads', 'thread1', 'cat1', 'sessions', 'sess1');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'digest.handoff.md'), [
      '---',
      'v: 1',
      'model: claude-haiku-4-5-20251001',
      'generatedAt: 1709700000000',
      '---',
      '',
      '## Session Summary',
      'Cat worked on feature X.',
    ].join('\n'));

    const result = await reader.readHandoffDigest('sess1', 'thread1', 'cat1');
    assert.ok(result);
    assert.equal(result.v, 1);
    assert.equal(result.model, 'claude-haiku-4-5-20251001');
    assert.ok(result.body.includes('Session Summary'));
    assert.ok(result.body.includes('feature X'));
  });

  test('readHandoffDigest returns null when file missing', async () => {
    const result = await reader.readHandoffDigest('nope', 'thread1', 'cat1');
    assert.equal(result, null);
  });

  test('readHandoffDigest returns null on malformed frontmatter', async () => {
    const dir = join(tempDir, 'threads', 'thread1', 'cat1', 'sessions', 'sess2');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'digest.handoff.md'), 'no frontmatter here');
    const result = await reader.readHandoffDigest('sess2', 'thread1', 'cat1');
    assert.equal(result, null);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/handoff-digest-io.test.js
```
Expected: FAIL — `reader.readHandoffDigest is not a function`

**Step 3: Implement `readHandoffDigest` in TranscriptReader**

Add to `TranscriptReader.ts` after `readDigest()`:

```typescript
export interface HandoffDigestMeta {
  v: number;
  model: string;
  generatedAt: number;
  body: string;
}

/**
 * Read handoff digest (LLM-generated meeting minutes) for a sealed session.
 * F065 Phase C: markdown file with YAML frontmatter.
 */
async readHandoffDigest(
  sessionId: string,
  threadId: string,
  catId: string,
): Promise<HandoffDigestMeta | null> {
  const digestPath = join(
    this.sessionDir(threadId, catId, sessionId),
    'digest.handoff.md',
  );
  try {
    const content = await readFile(digestPath, 'utf-8');
    return parseHandoffDigest(content);
  } catch {
    return null;
  }
}
```

Add standalone parser (bottom of file or exported for testing):

```typescript
/** Parse handoff digest markdown: YAML frontmatter + body. */
export function parseHandoffDigest(content: string): HandoffDigestMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1];
  const body = match[2].trim();

  // Minimal YAML parse (key: value lines only — no dependency needed)
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }

  const v = Number(meta['v']);
  if (!Number.isFinite(v) || !meta['model']) return null;

  return {
    v,
    model: meta['model'],
    generatedAt: Number(meta['generatedAt']) || 0,
    body,
  };
}
```

**Step 4: Add `writeHandoffDigest` static helper to TranscriptWriter**

Add to `TranscriptWriter.ts`:

```typescript
/**
 * Write handoff digest to disk. Static helper — no buffer dependency.
 * F065 Phase C: called by HandoffDigestGenerator after LLM response.
 */
static async writeHandoffDigest(
  sessionDir: string,
  meta: { v: number; model: string; generatedAt: number },
  body: string,
): Promise<void> {
  const content = [
    '---',
    `v: ${meta.v}`,
    `model: ${meta.model}`,
    `generatedAt: ${meta.generatedAt}`,
    '---',
    '',
    body,
  ].join('\n');
  await writeFile(join(sessionDir, 'digest.handoff.md'), content, 'utf-8');
}
```

Note: Also need to expose `sessionDir` computation. Add a static method or make the path computation a standalone export:

```typescript
/** Compute session directory path (static, for use by HandoffDigestGenerator). */
static sessionDirPath(
  dataDir: string,
  threadId: string,
  catId: string,
  sessionId: string,
): string {
  return join(dataDir, 'threads', threadId, catId, 'sessions', sessionId);
}
```

**Step 5: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/handoff-digest-io.test.js
```
Expected: 3 passing

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/session/TranscriptReader.ts \
       packages/api/src/domains/cats/services/session/TranscriptWriter.ts \
       packages/api/test/handoff-digest-io.test.js
git commit -m "feat(F065): Phase C — TranscriptReader.readHandoffDigest + TranscriptWriter.writeHandoffDigest [布偶猫🐾]"
```

---

### Task 2: HandoffDigestGenerator — Haiku LLM call with hard timeout

New module that takes session data, formats a prompt, calls Haiku, returns markdown.

**Files:**
- Create: `packages/api/src/domains/cats/services/session/HandoffDigestGenerator.ts`
- Test: `packages/api/test/handoff-digest-generator.test.js`

**Step 1: Write the failing test**

```javascript
// test/handoff-digest-generator.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoffPrompt,
  generateHandoffDigest,
} from '../dist/domains/cats/services/session/HandoffDigestGenerator.js';

describe('HandoffDigestGenerator', () => {
  describe('buildHandoffPrompt', () => {
    test('combines handoff summaries + digest + chat messages', () => {
      const prompt = buildHandoffPrompt({
        handoffSummaries: [
          { invocationId: 'inv1', eventCount: 10, toolCalls: ['Edit', 'Read'], errors: 0, durationMs: 5000, keyMessages: ['Working on feature'] },
        ],
        extractiveDigest: {
          v: 1, sessionId: 's1', threadId: 't1', catId: 'opus', seq: 0,
          time: { createdAt: 1000, sealedAt: 6000 },
          invocations: [{ toolNames: ['Edit'] }],
          filesTouched: [{ path: 'src/foo.ts', ops: ['edit'] }],
          errors: [],
        },
        recentMessages: [
          { role: 'user', content: 'Please fix the bug', timestamp: 2000 },
          { role: 'assistant', content: 'I found the issue in foo.ts', timestamp: 3000 },
        ],
        maxInputTokens: 4000,
      });
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.includes('fix the bug'));
      assert.ok(prompt.includes('foo.ts'));
      assert.ok(prompt.length > 50);
    });

    test('truncates when input exceeds maxInputTokens', () => {
      const longMessage = 'x'.repeat(20000);
      const prompt = buildHandoffPrompt({
        handoffSummaries: [],
        extractiveDigest: {
          v: 1, sessionId: 's1', threadId: 't1', catId: 'opus', seq: 0,
          time: { createdAt: 0, sealedAt: 0 },
          invocations: [], filesTouched: [], errors: [],
        },
        recentMessages: [{ role: 'user', content: longMessage, timestamp: 0 }],
        maxInputTokens: 2000,
      });
      // Rough check: prompt should be capped (4 chars per token estimate)
      assert.ok(prompt.length < 2000 * 5);
    });
  });

  describe('generateHandoffDigest', () => {
    test('returns markdown on successful API response', async () => {
      // Mock fetch that returns a valid Anthropic response
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '## Summary\nCat fixed a bug in foo.ts.' }],
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      });

      const result = await generateHandoffDigest({
        prompt: 'test prompt',
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-haiku-4-5-20251001',
        maxOutputTokens: 1024,
        timeoutMs: 5000,
        fetchFn: mockFetch,
      });

      assert.ok(result);
      assert.ok(result.body.includes('Summary'));
      assert.equal(result.model, 'claude-haiku-4-5-20251001');
      assert.ok(result.generatedAt > 0);
    });

    test('returns null on API error', async () => {
      const mockFetch = async () => ({ ok: false, text: async () => 'rate limited' });

      const result = await generateHandoffDigest({
        prompt: 'test',
        apiKey: 'key',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-haiku-4-5-20251001',
        maxOutputTokens: 1024,
        timeoutMs: 5000,
        fetchFn: mockFetch,
      });

      assert.equal(result, null);
    });

    test('returns null on timeout (AbortSignal)', async () => {
      const mockFetch = async (_url, opts) => {
        // Simulate slow response — check if already aborted
        if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        return new Promise((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('should not reach')), 60000);
          opts?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      };

      const result = await generateHandoffDigest({
        prompt: 'test',
        apiKey: 'key',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-haiku-4-5-20251001',
        maxOutputTokens: 1024,
        timeoutMs: 50, // 50ms timeout
        fetchFn: mockFetch,
      });

      assert.equal(result, null);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/handoff-digest-generator.test.js
```
Expected: FAIL — module not found

**Step 3: Implement HandoffDigestGenerator**

```typescript
// packages/api/src/domains/cats/services/session/HandoffDigestGenerator.ts
/**
 * HandoffDigestGenerator — F065 Phase C
 * Generates LLM-powered meeting-minutes style digest via Anthropic Messages API (Haiku).
 *
 * Pure functions + injectable fetch for testability.
 */

import type { ExtractiveDigestV1 } from './TranscriptWriter.js';
import type { HandoffInvocationSummary, ChatMessage } from './TranscriptFormatter.js';
import { estimateTokens } from '../../../../utils/token-counter.js';

// ── Types ────────────────────────────────────────────────────────────

export interface HandoffPromptInput {
  handoffSummaries: HandoffInvocationSummary[];
  extractiveDigest: ExtractiveDigestV1;
  recentMessages: ChatMessage[];
  maxInputTokens: number;
}

export interface GenerateOptions {
  prompt: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Injectable fetch for testing */
  fetchFn?: typeof globalThis.fetch;
}

export interface HandoffDigestResult {
  body: string;
  model: string;
  generatedAt: number;
  inputTokens: number;
  outputTokens: number;
}

// ── Prompt builder ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a session summarizer for a multi-agent coding assistant called Cat Cafe.
Write a concise handoff digest (meeting minutes) for the NEXT session's cat.
Focus on: what was accomplished, key decisions made, what's left to do, and any blockers.
Use markdown. Keep it under 500 words. Do NOT include greeting or sign-off.`;

export function buildHandoffPrompt(input: HandoffPromptInput): string {
  const sections: string[] = [];

  // 1. Extractive digest (structured data)
  const d = input.extractiveDigest;
  sections.push('## Session Metadata');
  sections.push(`Session seq: ${d.seq}, Cat: ${d.catId}`);
  if (d.time) {
    const durationMin = Math.round((d.time.sealedAt - d.time.createdAt) / 60000);
    sections.push(`Duration: ${durationMin} min`);
  }
  if (d.filesTouched.length > 0) {
    sections.push('Files touched: ' + d.filesTouched.map(f => f.path).join(', '));
  }
  if (d.errors.length > 0) {
    sections.push(`Errors: ${d.errors.length}`);
  }

  // 2. Invocation summaries (handoff view)
  if (input.handoffSummaries.length > 0) {
    sections.push('\n## Invocation Summaries');
    for (const inv of input.handoffSummaries) {
      const tools = inv.toolCalls.length > 0 ? ` [${inv.toolCalls.join(', ')}]` : '';
      const dur = Math.round(inv.durationMs / 1000);
      sections.push(`- ${inv.invocationId}: ${inv.eventCount} events, ${dur}s${tools}`);
      if (inv.keyMessages.length > 0) {
        sections.push(`  Key: ${inv.keyMessages[0]}`);
      }
    }
  }

  // 3. Recent chat messages (last N)
  if (input.recentMessages.length > 0) {
    sections.push('\n## Recent Conversation');
    for (const msg of input.recentMessages) {
      const content = msg.content.slice(0, 300);
      sections.push(`[${msg.role}]: ${content}`);
    }
  }

  let prompt = sections.join('\n');

  // Truncate if over budget (rough: 4 chars per token)
  const charBudget = input.maxInputTokens * 4;
  if (prompt.length > charBudget) {
    prompt = prompt.slice(0, charBudget) + '\n\n[...truncated for token budget]';
  }

  return prompt;
}

// ── LLM call ─────────────────────────────────────────────────────────

export async function generateHandoffDigest(
  opts: GenerateOptions,
): Promise<HandoffDigestResult | null> {
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const url = `${opts.baseUrl}/v1/messages`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxOutputTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.content
      ?.filter((c) => c.type === 'text')
      ?.map((c) => c.text)
      ?.join('\n');

    if (!text) return null;

    return {
      body: text,
      model: data.model ?? opts.model,
      generatedAt: Date.now(),
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  } catch {
    // Timeout (AbortError) or network error — graceful degradation
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/handoff-digest-generator.test.js
```
Expected: 5 passing

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/session/HandoffDigestGenerator.ts \
       packages/api/test/handoff-digest-generator.test.js
git commit -m "feat(F065): Phase C — HandoffDigestGenerator with Haiku LLM call + hard timeout [布偶猫🐾]"
```

---

### Task 3: SessionSealer — integrate handoff digest generation in `finalize()`

Wire the generator into the seal flow: after ThreadMemory update, attempt handoff digest generation.
**R1 fixes applied:** P1-1 (bootstrapDepth gate), P1-2 (read all events), P1-3 (injectable profile resolver).

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionSealer.ts`
- Modify: `packages/api/src/domains/cats/services/session/TranscriptReader.ts` (add `getSessionDir()` + `readAllEvents()`)
- Modify: `packages/api/src/index.ts` (wire resolver function)
- Test: `packages/api/test/session-sealer-handoff-digest.test.js`

**Step 1: Write the failing test**

```javascript
// test/session-sealer-handoff-digest.test.js
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SessionSealer handoff digest integration', () => {
  // Uses real TranscriptWriter + TranscriptReader + mock fetch + mock bootstrapDepth resolver
  // to verify finalize() writes digest.handoff.md only for generative cats

  test('finalize writes digest.handoff.md when bootstrapDepth=generative', async () => {
    const { SessionSealer } = await import('../dist/domains/cats/services/session/SessionSealer.js');
    const { TranscriptWriter } = await import('../dist/domains/cats/services/session/TranscriptWriter.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const tempDir = await mkdtemp(join(tmpdir(), 'sealer-handoff-'));

    try {
      const writer = new TranscriptWriter({ dataDir: tempDir });
      const reader = new TranscriptReader({ dataDir: tempDir });

      const sessions = new Map();
      const store = {
        get: async (id) => sessions.get(id),
        update: async (id, patch) => {
          const s = sessions.get(id);
          if (!s) return null;
          Object.assign(s, patch);
          return s;
        },
        getChain: async () => [],
        getActive: async () => null,
        create: async () => null,
      };

      const session = {
        id: 'sess-hd-1', threadId: 'th1', catId: 'opus',
        cliSessionId: 'cli1', seq: 0, status: 'sealing',
        createdAt: Date.now() - 5000,
      };
      sessions.set(session.id, session);

      writer.appendEvent(
        { sessionId: session.id, threadId: 'th1', catId: 'opus', cliSessionId: 'cli1', seq: 0 },
        { type: 'text', content: 'I am working on feature X' },
        'inv1',
      );

      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '## Handoff\nWorked on feature X.' }],
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 50, output_tokens: 30 },
        }),
      });

      // P1-3 fix: injectable profile resolver (per-thread, not global)
      const mockResolveProfile = async () => ({
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
      });

      // P1-1 fix: injectable bootstrapDepth resolver (per-cat)
      const mockGetBootstrapDepth = () => 'generative';

      const sealer = new SessionSealer(
        store,
        writer,
        undefined, // threadStore
        reader,
        undefined, // getMaxPromptTokens
        { // handoffConfig
          model: 'claude-haiku-4-5-20251001',
          timeoutMs: 5000,
          maxInputTokens: 4000,
          maxOutputTokens: 1024,
          resolveProfile: mockResolveProfile,
          getBootstrapDepth: mockGetBootstrapDepth,
          fetchFn: mockFetch,
        },
      );

      await sealer.finalize({ sessionId: session.id });

      // Verify handoff digest was written
      const handoffPath = join(tempDir, 'threads', 'th1', 'opus', 'sessions', 'sess-hd-1', 'digest.handoff.md');
      const content = await readFile(handoffPath, 'utf-8');
      assert.ok(content.includes('---'));
      assert.ok(content.includes('Handoff'));
      assert.ok(content.includes('feature X'));

      assert.equal(session.status, 'sealed');
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test('finalize skips handoff when bootstrapDepth=extractive (P1-1)', async () => {
    const { SessionSealer } = await import('../dist/domains/cats/services/session/SessionSealer.js');
    const { TranscriptWriter } = await import('../dist/domains/cats/services/session/TranscriptWriter.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const tempDir = await mkdtemp(join(tmpdir(), 'sealer-handoff-skip-'));
    let fetchCalled = false;

    try {
      const writer = new TranscriptWriter({ dataDir: tempDir });
      const reader = new TranscriptReader({ dataDir: tempDir });

      const sessions = new Map();
      const store = {
        get: async (id) => sessions.get(id),
        update: async (id, patch) => { const s = sessions.get(id); if (s) Object.assign(s, patch); return s; },
        getChain: async () => [],
        getActive: async () => null,
        create: async () => null,
      };

      const session = {
        id: 'sess-skip', threadId: 'th1', catId: 'opus',
        cliSessionId: 'cli1', seq: 0, status: 'sealing',
        createdAt: Date.now() - 5000,
      };
      sessions.set(session.id, session);

      writer.appendEvent(
        { sessionId: session.id, threadId: 'th1', catId: 'opus', cliSessionId: 'cli1', seq: 0 },
        { type: 'text', content: 'test' },
      );

      const mockFetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };
      const mockResolveProfile = async () => ({ apiKey: 'k', baseUrl: 'http://x' });
      // P1-1: extractive cat should NOT trigger Haiku call
      const mockGetBootstrapDepth = () => 'extractive';

      const sealer = new SessionSealer(
        store, writer, undefined, reader, undefined,
        { model: 'haiku', timeoutMs: 100, maxInputTokens: 1000, maxOutputTokens: 512,
          resolveProfile: mockResolveProfile, getBootstrapDepth: mockGetBootstrapDepth, fetchFn: mockFetch },
      );

      await sealer.finalize({ sessionId: session.id });
      assert.equal(session.status, 'sealed');
      assert.equal(fetchCalled, false, 'Haiku should NOT be called for extractive cats');
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test('finalize still seals session when handoff generation fails', async () => {
    const { SessionSealer } = await import('../dist/domains/cats/services/session/SessionSealer.js');
    const { TranscriptWriter } = await import('../dist/domains/cats/services/session/TranscriptWriter.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const tempDir = await mkdtemp(join(tmpdir(), 'sealer-handoff-fail-'));

    try {
      const writer = new TranscriptWriter({ dataDir: tempDir });
      const reader = new TranscriptReader({ dataDir: tempDir });

      const sessions = new Map();
      const store = {
        get: async (id) => sessions.get(id),
        update: async (id, patch) => { const s = sessions.get(id); if (s) Object.assign(s, patch); return s; },
        getChain: async () => [],
        getActive: async () => null,
        create: async () => null,
      };

      const session = {
        id: 'sess-hd-2', threadId: 'th1', catId: 'opus',
        cliSessionId: 'cli1', seq: 0, status: 'sealing',
        createdAt: Date.now() - 5000,
      };
      sessions.set(session.id, session);

      writer.appendEvent(
        { sessionId: session.id, threadId: 'th1', catId: 'opus', cliSessionId: 'cli1', seq: 0 },
        { type: 'text', content: 'test' },
      );

      const mockFetch = async () => { throw new Error('network error'); };

      const sealer = new SessionSealer(
        store, writer, undefined, reader, undefined,
        { model: 'haiku', timeoutMs: 100, maxInputTokens: 1000, maxOutputTokens: 512,
          resolveProfile: async () => ({ apiKey: 'k', baseUrl: 'http://x' }),
          getBootstrapDepth: () => 'generative', fetchFn: mockFetch },
      );

      await sealer.finalize({ sessionId: session.id });
      assert.equal(session.status, 'sealed'); // Must still seal
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test('finalize skips handoff when config not provided', async () => {
    const { SessionSealer } = await import('../dist/domains/cats/services/session/SessionSealer.js');

    const sessions = new Map();
    const store = {
      get: async (id) => sessions.get(id),
      update: async (id, patch) => { const s = sessions.get(id); if (s) Object.assign(s, patch); return s; },
      getChain: async () => [],
      getActive: async () => null,
      create: async () => null,
    };

    const session = { id: 's1', threadId: 't1', catId: 'opus', cliSessionId: 'c1', seq: 0, status: 'sealing', createdAt: Date.now() };
    sessions.set('s1', session);

    const sealer = new SessionSealer(store);
    await sealer.finalize({ sessionId: 's1' });
    assert.equal(session.status, 'sealed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/session-sealer-handoff-digest.test.js
```
Expected: FAIL — constructor doesn't accept handoffConfig

**Step 3a: Add `readAllEvents()` to TranscriptReader (P1-2 fix)**

```typescript
/**
 * Read ALL events from a session transcript (no pagination limit).
 * F065 Phase C: handoff digest needs full session context.
 */
async readAllEvents(
  sessionId: string,
  threadId: string,
  catId: string,
): Promise<TranscriptEvent[]> {
  const sessionDir = this.sessionDir(threadId, catId, sessionId);
  const jsonlPath = join(sessionDir, 'events.jsonl');

  try {
    await stat(jsonlPath);
  } catch {
    return [];
  }

  const events: TranscriptEvent[] = [];
  const rl = createInterface({
    input: createReadStream(jsonlPath, 'utf-8'),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line) as TranscriptEvent);
    } catch { /* skip malformed */ }
  }

  return events;
}

/** Public accessor for session directory path. F065 Phase C. */
getSessionDir(threadId: string, catId: string, sessionId: string): string {
  return this.sessionDir(threadId, catId, sessionId);
}
```

**Step 3b: Implement SessionSealer handoff integration**

Modify `SessionSealer.ts`:

1. New `HandoffConfig` interface — **injectable resolvers, not static config** (P1-1 + P1-3):

```typescript
import { buildHandoffPrompt, generateHandoffDigest } from './HandoffDigestGenerator.js';
import { formatEventsHandoff, formatEventsChat } from './TranscriptFormatter.js';
import { TranscriptWriter } from './TranscriptWriter.js';

export interface HandoffConfig {
  model: string;
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  /** P1-3: Per-thread profile resolver (not global singleton) */
  resolveProfile: (threadId: string, catId: string) => Promise<{ apiKey: string; baseUrl: string } | null>;
  /** P1-1: Per-cat bootstrapDepth check — only 'generative' triggers Haiku */
  getBootstrapDepth: (catId: string) => 'extractive' | 'generative';
  /** Injectable fetch for testing */
  fetchFn?: typeof globalThis.fetch;
}
```

2. Add to constructor as 6th param.

3. Handoff generation block in `finalize()` after ThreadMemory update:

```typescript
// F065 Phase C: Generate handoff digest (best-effort, hard timeout)
// P1-1: Only for cats with bootstrapDepth=generative
if (this.handoffConfig && this.transcriptReader) {
  const depth = this.handoffConfig.getBootstrapDepth(record.catId);
  if (depth === 'generative') {
    try {
      // P1-3: Resolve API credentials per-thread
      const profile = await this.handoffConfig.resolveProfile(record.threadId, record.catId);
      if (profile) {
        // P1-2: Read ALL events (not just first 50)
        const events = await this.transcriptReader.readAllEvents(
          record.id, record.threadId, record.catId,
        );

        if (events.length > 0) {
          const handoffSummaries = formatEventsHandoff(events);
          const recentMessages = formatEventsChat(events).slice(-8);
          const rawDigest = await this.transcriptReader.readDigest(
            record.id, record.threadId, record.catId,
          );

          if (rawDigest) {
            const prompt = buildHandoffPrompt({
              handoffSummaries,
              extractiveDigest: rawDigest as unknown as ExtractiveDigestV1,
              recentMessages,
              maxInputTokens: this.handoffConfig.maxInputTokens,
            });

            const result = await generateHandoffDigest({
              prompt,
              apiKey: profile.apiKey,
              baseUrl: profile.baseUrl,
              model: this.handoffConfig.model,
              maxOutputTokens: this.handoffConfig.maxOutputTokens,
              timeoutMs: this.handoffConfig.timeoutMs,
              fetchFn: this.handoffConfig.fetchFn,
            });

            if (result) {
              const sessionDir = this.transcriptReader.getSessionDir(
                record.threadId, record.catId, record.id,
              );
              await TranscriptWriter.writeHandoffDigest(
                sessionDir,
                { v: 1, model: result.model, generatedAt: result.generatedAt },
                result.body,
              );
            }
          }
        }
      }
    } catch {
      // best-effort: handoff digest failure doesn't prevent sealing
    }
  }
}
```

**Step 5: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/session-sealer-handoff-digest.test.js
```
Expected: 3 passing

**Step 6: Run all existing sealer tests to verify no regression**

```bash
cd packages/api && node --test test/session-sealer*.test.js
```
Expected: All passing (existing 4 ThreadMemory tests + 3 new handoff tests)

**Step 7: Commit**

```bash
git add packages/api/src/domains/cats/services/session/SessionSealer.ts \
       packages/api/src/domains/cats/services/session/TranscriptReader.ts \
       packages/api/test/session-sealer-handoff-digest.test.js
git commit -m "feat(F065): Phase C — SessionSealer integrates handoff digest generation [布偶猫🐾]"
```

---

### Task 4: SessionBootstrap — `bootstrapDepth` branching for generative digest

Wire the bootstrap to prefer handoff digest when `bootstrapDepth === 'generative'`.

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionBootstrap.ts`
- Test: `packages/api/test/session-bootstrap-handoff-digest.test.js`

**Step 1: Write the failing test**

```javascript
// test/session-bootstrap-handoff-digest.test.js
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SessionBootstrap handoff digest', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bootstrap-handoff-'));
  });

  async function setupSessionDir(threadId, catId, sessionId) {
    const dir = join(tempDir, 'threads', threadId, catId, 'sessions', sessionId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  test('uses handoff digest when bootstrapDepth=generative and file exists', async () => {
    const { buildSessionBootstrap } = await import('../dist/domains/cats/services/session/SessionBootstrap.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const reader = new TranscriptReader({ dataDir: tempDir });

    const dir = await setupSessionDir('t1', 'opus', 'prev-sess');
    // Write handoff digest
    await writeFile(join(dir, 'digest.handoff.md'), [
      '---', 'v: 1', 'model: claude-haiku-4-5-20251001', 'generatedAt: 1000', '---', '',
      '## Summary', 'Cat implemented feature Y and fixed 2 bugs.',
    ].join('\n'));
    // Also write extractive (should NOT be used when handoff exists)
    await writeFile(join(dir, 'digest.extractive.json'), JSON.stringify({
      v: 1, sessionId: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0,
      time: { createdAt: 1000, sealedAt: 5000 },
      invocations: [], filesTouched: [], errors: [],
    }));

    const chainStore = {
      getChain: async () => [
        { id: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0, status: 'sealed' },
      ],
      getActive: async () => ({ id: 'curr-sess', threadId: 't1', catId: 'opus', seq: 1, status: 'active' }),
    };

    const result = await buildSessionBootstrap(
      { sessionChainStore: chainStore, transcriptReader: reader, bootstrapDepth: 'generative' },
      'opus',
      't1',
    );

    assert.ok(result);
    assert.ok(result.text.includes('feature Y'));
    assert.ok(result.text.includes('fixed 2 bugs'));
    assert.ok(result.hasDigest);
  });

  test('falls back to extractive when bootstrapDepth=generative but no handoff file', async () => {
    const { buildSessionBootstrap } = await import('../dist/domains/cats/services/session/SessionBootstrap.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const reader = new TranscriptReader({ dataDir: tempDir });

    const dir = await setupSessionDir('t1', 'opus', 'prev-sess');
    // Only extractive digest exists
    await writeFile(join(dir, 'digest.extractive.json'), JSON.stringify({
      v: 1, sessionId: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0,
      time: { createdAt: 1000, sealedAt: 5000 },
      invocations: [{ toolNames: ['Edit'] }],
      filesTouched: [{ path: 'src/foo.ts', ops: ['edit'] }],
      errors: [],
    }));

    const chainStore = {
      getChain: async () => [
        { id: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0, status: 'sealed' },
      ],
      getActive: async () => ({ id: 'curr-sess', threadId: 't1', catId: 'opus', seq: 1, status: 'active' }),
    };

    const result = await buildSessionBootstrap(
      { sessionChainStore: chainStore, transcriptReader: reader, bootstrapDepth: 'generative' },
      'opus',
      't1',
    );

    assert.ok(result);
    // Falls back to extractive format
    assert.ok(result.text.includes('foo.ts'));
    assert.ok(result.hasDigest);
  });

  test('uses extractive when bootstrapDepth=extractive (default behavior unchanged)', async () => {
    const { buildSessionBootstrap } = await import('../dist/domains/cats/services/session/SessionBootstrap.js');
    const { TranscriptReader } = await import('../dist/domains/cats/services/session/TranscriptReader.js');

    const reader = new TranscriptReader({ dataDir: tempDir });

    const dir = await setupSessionDir('t1', 'opus', 'prev-sess');
    // Both digests exist — should use extractive because bootstrapDepth=extractive
    await writeFile(join(dir, 'digest.handoff.md'), [
      '---', 'v: 1', 'model: haiku', 'generatedAt: 1000', '---', '',
      '## Handoff Summary', 'Should NOT appear in output.',
    ].join('\n'));
    await writeFile(join(dir, 'digest.extractive.json'), JSON.stringify({
      v: 1, sessionId: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0,
      time: { createdAt: 1000, sealedAt: 5000 },
      invocations: [{ toolNames: ['Read'] }],
      filesTouched: [{ path: 'src/bar.ts', ops: ['edit'] }],
      errors: [],
    }));

    const chainStore = {
      getChain: async () => [
        { id: 'prev-sess', threadId: 't1', catId: 'opus', seq: 0, status: 'sealed' },
      ],
      getActive: async () => ({ id: 'curr-sess', threadId: 't1', catId: 'opus', seq: 1, status: 'active' }),
    };

    // bootstrapDepth defaults to 'extractive' when not specified
    const result = await buildSessionBootstrap(
      { sessionChainStore: chainStore, transcriptReader: reader },
      'opus',
      't1',
    );

    assert.ok(result);
    assert.ok(result.text.includes('bar.ts'));
    assert.ok(!result.text.includes('Should NOT appear'));
  });

  // Cleanup
  test.afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true }).catch(() => {});
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/session-bootstrap-handoff-digest.test.js
```
Expected: FAIL — `bootstrapDepth` option not recognized

**Step 3: Implement bootstrap branching**

Modify `SessionBootstrap.ts`:

1. Add `bootstrapDepth` to options:

```typescript
export interface SessionBootstrapOptions {
  sessionChainStore: ISessionChainStore;
  transcriptReader: TranscriptReader;
  taskStore?: ITaskStore;
  threadStore?: IThreadStore;
  /** F065 Phase C: 'generative' prefers handoff digest, 'extractive' (default) uses extractive only */
  bootstrapDepth?: 'extractive' | 'generative';
}
```

2. Import `HandoffDigestMeta`:

```typescript
import type { HandoffDigestMeta } from './TranscriptReader.js';
```

3. Replace the digest section logic (around line 107-120) with branching:

```typescript
let digestSection = '';
let hasDigest = false;

// F065 Phase C: generative mode tries handoff digest first
if (opts.bootstrapDepth === 'generative') {
  try {
    const handoff = await transcriptReader.readHandoffDigest(
      prevSession.id, prevSession.threadId, prevSession.catId,
    );
    if (handoff && handoff.body) {
      digestSection = '\n[Previous Session Summary (AI-generated)]\n' + handoff.body;
      hasDigest = true;
    }
  } catch {
    // Fall through to extractive
  }
}

// Extractive fallback (or default when bootstrapDepth !== 'generative')
if (!hasDigest) {
  try {
    const digest = await transcriptReader.readDigest(
      prevSession.id, prevSession.threadId, prevSession.catId,
    );
    if (digest) {
      digestSection = '\n[Previous Session Summary]\n' + formatDigest(digest as unknown as ExtractiveDigestV1);
      hasDigest = true;
    }
  } catch {
    // Digest read failed
  }
}
```

**Step 4: Wire `bootstrapDepth` from cat config in route-serial/route-parallel**

In `route-serial.ts` and `route-parallel.ts`, where `buildSessionBootstrap` is called, pass the cat's `bootstrapDepth` from session strategy config:

```typescript
import { getConfigSessionStrategy } from '../../../../../config/cat-config-loader.js';

// Inside the bootstrap call:
const strategy = getConfigSessionStrategy(catId);
const bootstrapDepth = strategy?.handoff?.bootstrapDepth ?? 'extractive';

const bootstrap = await buildSessionBootstrap(
  { sessionChainStore, transcriptReader, taskStore, threadStore, bootstrapDepth },
  catId,
  threadId,
);
```

**Step 5: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/session-bootstrap-handoff-digest.test.js
```
Expected: 3 passing

**Step 6: Run ALL bootstrap tests for regression check**

```bash
cd packages/api && node --test test/session-bootstrap*.test.js
```
Expected: All passing (existing ThreadMemory tests + new handoff tests)

**Step 7: Run full test suite**

```bash
cd packages/api && pnpm test
```
Expected: All tests pass, 0 failures

**Step 8: Commit**

```bash
git add packages/api/src/domains/cats/services/session/SessionBootstrap.ts \
       packages/api/src/domains/cats/services/agents/routing/route-serial.ts \
       packages/api/src/domains/cats/services/agents/routing/route-parallel.ts \
       packages/api/test/session-bootstrap-handoff-digest.test.js
git commit -m "feat(F065): Phase C — SessionBootstrap reads handoff digest when bootstrapDepth=generative [布偶猫🐾]"
```

---

### Task 5: Wiring + index.ts + final integration

Wire handoff config with injectable resolvers into SessionSealer construction.
**R1 P1-3 fix:** Profile resolution is a function injected at construction, not a startup-time singleton.
**R2 fixes:** P1-1 import + async chain correct; P1-2 resolver uses `threadStore.get(threadId).projectPath` like invoke-single-cat.

**Files:**
- Modify: `packages/api/src/index.ts`
- No new test file — covered by Task 3 tests + existing integration

**Step 1: Add handoff config resolution in index.ts**

Where SessionSealer is constructed (line ~135), inject resolver functions:

```typescript
import type { HandoffConfig } from './domains/cats/services/session/SessionSealer.js';
import { getConfigSessionStrategy } from './config/cat-config-loader.js';
import { resolveAnthropicRuntimeProfile } from './config/provider-profiles.js';
import { resolveProviderProfilesRoot } from './config/provider-profiles-root.js';
import { findMonorepoRoot } from './utils/monorepo-root.js';

// R2 P1-2 fix: Per-thread profile resolver matches invoke-single-cat.ts:313 pattern.
// Resolves thread's projectPath → worktree-aware provider-profiles root → runtime profile.
const handoffResolveProfile = async (threadId: string, _catId: string) => {
  try {
    // Same resolution as invoke-single-cat:
    // 1. Get thread's projectPath (if thread store available)
    // 2. Resolve worktree-aware provider-profiles root
    // 3. Resolve Anthropic runtime profile from .cat-cafe dir
    let projectRoot = findMonorepoRoot(process.cwd()); // fallback
    const thread = await threadStore.get(threadId);
    if (thread?.projectPath && thread.projectPath !== 'default') {
      projectRoot = thread.projectPath;
    }
    const profilesRoot = await resolveProviderProfilesRoot(projectRoot);
    const runtime = await resolveAnthropicRuntimeProfile(profilesRoot);
    if (!runtime.apiKey) return null;
    return {
      apiKey: runtime.apiKey,
      baseUrl: runtime.baseUrl || 'https://api.anthropic.com',
    };
  } catch {
    return null;
  }
};

// P1-1: Per-cat bootstrapDepth gate — only 'generative' cats get handoff digest
const handoffGetBootstrapDepth = (catId: string): 'extractive' | 'generative' => {
  const strategy = getConfigSessionStrategy(catId);
  return strategy?.handoff?.bootstrapDepth ?? 'extractive';
};

const handoffConfig: HandoffConfig = {
  model: 'claude-haiku-4-5-20251001',
  timeoutMs: 5000,
  maxInputTokens: 4000,
  maxOutputTokens: 1024,
  resolveProfile: handoffResolveProfile,
  getBootstrapDepth: handoffGetBootstrapDepth,
};

// Pass to SessionSealer constructor:
const sessionSealer = new SessionSealer(
  sessionChainStore,
  transcriptWriter,
  threadStore,
  transcriptReader,
  (catId) => getCatContextBudget(catId).maxPromptTokens,
  handoffConfig,
);
```

**Step 2: Build and verify**

```bash
cd packages/api && pnpm build
```
Expected: Clean build, no type errors

**Step 3: Run full test suite**

```bash
cd packages/api && pnpm test
```
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat(F065): Phase C — wire handoff config with injectable resolvers [布偶猫🐾]"
```

---

### Final Checklist

- [ ] All 5 tasks committed with `[布偶猫🐾]` signature
- [ ] Tests: ~15 new tests (3 IO + 5 generator + 4 sealer + 3 bootstrap = 15)
- [ ] Build clean: `pnpm -r --if-present run build`
- [ ] Full suite: `pnpm --filter @cat-cafe/api test`
- [ ] No new `any` types
- [ ] File size check: `pnpm check:dir-size`
- [ ] Biome: `pnpm check`

### Acceptance Criteria Coverage

| AC | Covered by |
|----|------------|
| Phase C spec: "seal 后用便宜模型生成 digest.handoff.md" | Task 2 (HandoffDigestGenerator) + Task 3 (SessionSealer integration) |
| Phase C spec: "Session 2 bootstrap 优先用 handoff" | Task 4 (bootstrapDepth branching) |
| Phase C spec: "没有则降级用 extractive" | Task 4 (fallback logic in bootstrap) |
| KD-1: 恢复哲学是"搜"不是"灌" | Handoff digest is injected as prev-session summary, same slot as extractive |
| Graceful degradation on failure | Task 3 test: sealer still seals when generation fails |
| Hard timeout | Task 2: AbortController with configurable timeoutMs |
