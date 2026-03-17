# F111: Streaming TTS Chunker Implementation Plan

**Feature:** F111 — `docs/features/F111-streaming-tts-chunker.md`
**Goal:** Reduce first-audio latency from "full synthesis time" (10-30s) to <2s by streaming text chunks to TTS and playing audio segments incrementally.
**Acceptance Criteria:**
- AC-A1: LLM streaming → first audio playback < 2s (100+ char text)
- AC-A2: Long text (>100 chars) end-to-end latency reduced 50%+ vs full synthesis
- AC-A3: Chinese punctuation correctly segments (no mid-word breaks)
- AC-A4: First 2 segments use Boost mechanism (lower threshold, verifiable via logs)
- AC-A5: Non-streaming `/api/tts/synthesize` unaffected (regression test)
- AC-A6: AudioBlock streaming playback with smooth progress bar
**Architecture:** Plan C — Node-layer TTS Chunker segments text at sentence boundaries, calls existing `MlxAudioTtsProvider.synthesize()` per-segment, sends audio chunks via SSE (`fetch` + `ReadableStream`, not `EventSource`). Frontend decodes Base64 chunks into blob URLs and plays sequentially. Exit condition: if AC-A1/AC-A2 not met, escalate to Plan A (vLLM-Omni).
**Tech Stack:** TypeScript, Fastify SSE, `Intl.Segmenter`, `fetch`+`ReadableStream`, `HTMLAudioElement`
**前端验证:** Yes — AudioBlock streaming playback needs visual verification

---

## Straight-Line Check

**Finish line (B):** User sends text → backend streams audio chunks via SSE → frontend plays first chunk in <2s while remaining chunks arrive → smooth progress bar.

**What we're NOT building:**
- ❌ Real streaming from Qwen3-TTS model (that's Plan A, future upgrade)
- ❌ PlaybackManager / queue system (that's F112)
- ❌ VAD interrupt (that's F112 Phase B)
- ❌ WebSocket transport (decided: SSE)

**Terminal schema:**

```typescript
// packages/shared/src/types/tts.ts (additions)
interface TtsStreamRequest {
  text: string;
  catId?: string;
  voice?: string;
  langCode?: string;
  speed?: number;
}

// SSE event format (data: JSON string)
interface TtsStreamEvent {
  type: 'chunk' | 'done' | 'error';
  index?: number;       // chunk index (0-based)
  total?: number;       // estimated total chunks
  audioBase64?: string;  // Base64-encoded WAV audio
  text?: string;         // the text segment that was synthesized
  durationSec?: number;  // duration of this chunk
  error?: string;
}

// packages/api/src/domains/cats/services/tts/TtsChunker.ts
interface ChunkResult {
  text: string;
  isBoost: boolean;  // first 2 segments
}
```

---

## Task 1: TtsChunker — Sentence Segmentation Module

**Files:**
- Create: `packages/api/src/domains/cats/services/tts/TtsChunker.ts`
- Test: `packages/api/test/tts-chunker.test.js`

**Step 1: Write failing tests**

Test cases:
1. Hard breakpoints: `。？！\n` → immediate split
2. Soft breakpoints: `，、：` → split after accumulating 4+ chars
3. Boost: first 2 segments use lower threshold (2 chars min instead of 4)
4. Mixed Chinese+English: `Intl.Segmenter` doesn't break mid-word
5. Short text (<20 chars): returns as single chunk
6. Empty/whitespace: returns empty array

**Step 2: Implement TtsChunker**

Core algorithm:
```
for each char in text:
  append to buffer
  if char is hard breakpoint (。？！.?!\n):
    flush buffer as chunk
  else if char is soft breakpoint (，,、：:；;):
    if buffer.length >= threshold (4 normally, 2 for boost):
      flush buffer as chunk
  // At end: flush remaining buffer
```

Chinese word boundary: use `Intl.Segmenter('zh', { granularity: 'word' })` to verify we're not splitting mid-word at soft breakpoints.

**Step 3: Run tests, verify pass**
**Step 4: Commit**

---

## Task 2: Shared Types — TtsStreamEvent

**Files:**
- Modify: `packages/shared/src/types/tts.ts` (add stream types)
- Modify: `packages/shared/src/types/index.ts` (export new types)

**Step 1: Add types to shared package**

Add `TtsStreamRequest`, `TtsStreamEvent` interfaces.

**Step 2: Rebuild shared**

```bash
pnpm --filter @cat-cafe/shared run prepare
```

**Step 3: Commit**

---

## Task 3: SSE Streaming Endpoint `/api/tts/stream`

**Files:**
- Modify: `packages/api/src/routes/tts.ts` (add stream route)
- Test: `packages/api/test/tts-stream.test.js`

**Step 1: Write failing tests**

Test cases:
1. Auth gate: no `X-Cat-Cafe-User` → 401
2. Invalid body → 400
3. Happy path: text "你好。世界。" → receives 2 chunk events + 1 done event
4. SSE format: each event starts with `data: ` + JSON + `\n\n`
5. Content-Type: `text/event-stream`
6. Existing `/api/tts/synthesize` still works (regression)

**Step 2: Implement stream route**

Flow:
```
POST /api/tts/stream
  1. Auth check (resolveUserId)
  2. Validate body (same schema as synthesize + generationId)
  3. Set SSE headers: Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive
  4. Chunk text via TtsChunker
  5. For each chunk:
     a. Call provider.synthesize(chunk.text, ...) — reuse existing MlxAudioTtsProvider
     b. Base64-encode the audio Uint8Array
     c. Write SSE event: data: {type:'chunk', index, total, audioBase64, text, durationSec}
  6. Write done event: data: {type:'done'}
  7. End response
```

**Step 3: Run tests, verify pass**
**Step 4: Commit**

---

## Task 4: Frontend — Streaming Audio Consumer

**Files:**
- Create: `packages/web/src/utils/tts-stream.ts` (SSE stream consumer)
- Test: `packages/web/src/utils/__tests__/tts-stream.test.ts`

**Step 1: Write failing tests**

Test cases (unit, mocked fetch):
1. Parses SSE events from ReadableStream
2. Yields TtsStreamEvent objects for each chunk
3. Handles done event → generator completes
4. Handles error event → throws

**Step 2: Implement tts-stream.ts**

```typescript
export async function* streamTts(request: TtsStreamRequest): AsyncGenerator<TtsStreamEvent> {
  const response = await apiFetch('/api/tts/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`TTS stream failed: ${response.status}`);
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    // Parse SSE: split on double newline
    const events = buffer.split('\n\n');
    buffer = events.pop()!; // keep incomplete last part
    
    for (const event of events) {
      const dataLine = event.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      const json = JSON.parse(dataLine.slice(6));
      if (json.type === 'error') throw new Error(json.error);
      yield json;
      if (json.type === 'done') return;
    }
  }
}
```

**Step 3: Run tests, verify pass**
**Step 4: Commit**

---

## Task 5: AudioBlock Streaming Upgrade

**Files:**
- Modify: `packages/web/src/components/rich/AudioBlock.tsx` (add streaming mode)
- Create: `packages/web/src/hooks/useStreamingAudio.ts` (streaming playback hook)

**Step 1: Implement useStreamingAudio hook**

Manages a queue of audio blob URLs, plays them sequentially:
- Receives chunks from `streamTts()` generator
- Decodes Base64 → Blob → URL.createObjectURL
- Plays first chunk ASAP (this is where <2s latency comes from)
- Queues remaining chunks
- On each `ended` event → play next chunk
- Tracks overall progress across all chunks

**Step 2: Update AudioBlock**

Add a `streaming` prop/mode that uses `useStreamingAudio` instead of static blob URL.
Keep existing static mode untouched (AC-A5 regression safety).

**Step 3: Manual visual verification**

- Start dev server in worktree
- Send long text → verify chunks play sequentially
- Progress bar updates smoothly

**Step 4: Commit**

---

## Task 6: Integration Wiring — VoiceBlockSynthesizer + Auto-Play

**Files:**
- Modify: `packages/web/src/hooks/useVoiceAutoPlay.ts` (trigger streaming for new voice blocks)
- Modify: `packages/web/src/stores/voiceSessionStore.ts` (streaming state)

**Step 1: Wire streaming into voice auto-play flow**

When a new voice block arrives with `text` but no `url`:
- Instead of waiting for backend to fully synthesize → use `/api/tts/stream`
- AudioBlock enters streaming mode
- First chunk plays in <2s

**Step 2: Integration test**
**Step 3: Commit**

---

## Task 7: AC Verification + Logging

**Files:**
- Modify: `packages/api/src/domains/cats/services/tts/TtsChunker.ts` (add timing logs)

**Step 1: Add performance timing**

- Log: `[TTS-STREAM] chunk ${i}/${total} synthesized in ${ms}ms, boost=${isBoost}`
- Log: `[TTS-STREAM] first chunk latency: ${ms}ms` (must be <2000ms for AC-A1)
- Log: `[TTS-STREAM] total streaming time: ${ms}ms vs estimated full: ${ms}ms` (for AC-A2)

**Step 2: Verify AC-A4 (Boost mechanism)**

Boost logs visible for first 2 segments with lower threshold.

**Step 3: Commit**

---

## Exit Condition Check

After Task 7, measure:
- **AC-A1**: First chunk latency. If >2s consistently → Plan C insufficient → escalate to Plan A (vLLM-Omni)
- **AC-A2**: Total time comparison. If <50% improvement → escalate

---

## Implementation Order

```
Task 1 (TtsChunker) → Task 2 (Shared Types) → Task 3 (SSE Endpoint)
    → Task 4 (Frontend Consumer) → Task 5 (AudioBlock Upgrade)
    → Task 6 (Integration Wiring) → Task 7 (AC Verification)
```

Tasks 1+2 are independent and can be done in parallel.
Tasks 3-7 are sequential (each builds on the previous).

**Estimated effort:** ~2-3 hours total
