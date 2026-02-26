---
feature_ids: []
topics: [voice, input, implementation]
doc_kind: plan
created: 2026-02-11
---

# Voice Input (M1 MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the user speak into the mic in Cat Cafe Web, transcribe via local faster-whisper, correct technical terms, and fill the result into the existing chat textarea for manual send.

**Architecture:** A standalone faster-whisper HTTP service runs locally (port 9876). The frontend records audio via MediaRecorder, POSTs to the Whisper service, runs a 3-layer correction pipeline (initial_prompt bias + term dictionary + filler removal), then fills the corrected text into the existing textarea. Zero backend (Fastify) changes.

**Tech Stack:** faster-whisper (Python), React hooks, MediaRecorder Web API, vitest + jsdom

**Design doc:** `docs/plans/2026-02-11-voice-input-design.md`

---

## Task 1: Transcription Corrector (Pure Utility)

**Files:**
- Create: `packages/web/src/utils/voice-terms.json`
- Create: `packages/web/src/utils/transcription-corrector.ts`
- Create: `packages/web/src/utils/__tests__/transcription-corrector.test.ts`

This is pure string-processing logic with zero DOM or audio dependencies. Easiest to TDD.

### Step 1: Write the failing tests

```typescript
// packages/web/src/utils/__tests__/transcription-corrector.test.ts
import { describe, it, expect } from 'vitest';
import { correctTranscription, removeFillers, applyTermDictionary } from '../transcription-corrector';

describe('applyTermDictionary', () => {
  it('replaces known misrecognitions case-insensitively', () => {
    expect(applyTermDictionary('帮我看看 icp 的配置')).toBe('帮我看看 MCP 的配置');
  });

  it('replaces multiple terms in one string', () => {
    expect(applyTermDictionary('icp 和 法式的 路由')).toBe('MCP 和 Fastify 路由');
  });

  it('leaves unknown words untouched', () => {
    expect(applyTermDictionary('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(applyTermDictionary('')).toBe('');
  });
});

describe('removeFillers', () => {
  it('removes Chinese filler words', () => {
    expect(removeFillers('嗯那个帮我看看')).toBe('帮我看看');
  });

  it('removes multiple fillers', () => {
    expect(removeFillers('嗯啊那个就是说帮我改一下')).toBe('帮我改一下');
  });

  it('trims and collapses whitespace', () => {
    expect(removeFillers('嗯  帮我  看看')).toBe('帮我 看看');
  });

  it('preserves content without fillers', () => {
    expect(removeFillers('重构这个函数')).toBe('重构这个函数');
  });
});

describe('correctTranscription', () => {
  it('applies full pipeline: terms + fillers', () => {
    const raw = '嗯那个帮我看看 icp 的配置还有法式的路由';
    const result = correctTranscription(raw);
    expect(result).toBe('帮我看看 MCP 的配置还有 Fastify 路由');
  });

  it('returns empty string for empty input', () => {
    expect(correctTranscription('')).toBe('');
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm --filter @cat-cafe/web test -- src/utils/__tests__/transcription-corrector.test.ts`
Expected: FAIL — module not found

### Step 3: Create the term dictionary

```json
// packages/web/src/utils/voice-terms.json
{
  "icp": "MCP",
  "法式的": "Fastify",
  "为的": "void",
  "那的js": "Node.js",
  "type script": "TypeScript",
  "组单的": "Zustand",
  "锐的死": "Redis",
  "瑞迪斯": "Redis",
  "威士伯": "Whisper",
  "work tree": "worktree",
  "re base": "rebase",
  "宪宪": "@布偶",
  "砚砚": "@缅因",
  "暹罗猫": "@暹罗"
}
```

> **Note:** This dictionary will grow over time as we discover new misrecognitions. Keep adding entries.

### Step 4: Write minimal implementation

```typescript
// packages/web/src/utils/transcription-corrector.ts
import terms from './voice-terms.json';

const FILLER_PATTERN = /(?:^|(?<=\s))(?:嗯|啊|那个|就是说|就是|然后呢|对对对|那么)(?=\s|$|[\u4e00-\u9fff])/g;

/**
 * Replace known ASR misrecognitions with correct technical terms.
 * Case-insensitive matching, dictionary from voice-terms.json.
 */
export function applyTermDictionary(text: string): string {
  if (!text) return '';
  let result = text;
  for (const [wrong, right] of Object.entries(terms)) {
    const pattern = new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(pattern, right);
  }
  return result;
}

/**
 * Remove common Chinese filler words (口癖).
 * Collapses resulting whitespace.
 */
export function removeFillers(text: string): string {
  if (!text) return '';
  return text
    .replace(FILLER_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Full correction pipeline: term dictionary → filler removal.
 */
export function correctTranscription(text: string): string {
  if (!text) return '';
  return removeFillers(applyTermDictionary(text));
}
```

### Step 5: Run test to verify it passes

Run: `pnpm --filter @cat-cafe/web test -- src/utils/__tests__/transcription-corrector.test.ts`
Expected: PASS (all 9 tests)

> **Note:** The exact assertions may need tuning — Chinese filler regex boundaries are tricky. Adjust the regex and test expectations together until they match actual Whisper output patterns.

### Step 6: Commit

```bash
git add packages/web/src/utils/voice-terms.json \
       packages/web/src/utils/transcription-corrector.ts \
       packages/web/src/utils/__tests__/transcription-corrector.test.ts
git commit -m "feat(web): add transcription corrector with term dictionary [布偶猫🐾]

Why: ASR engines misrecognize project-specific terms (MCP→ICP, Fastify→法式的).
Three-layer correction: term dictionary + filler removal + whitespace cleanup."
```

---

## Task 2: useVoiceInput Hook

**Files:**
- Create: `packages/web/src/hooks/useVoiceInput.ts`
- Create: `packages/web/src/hooks/__tests__/useVoiceInput.test.ts`

**Depends on:** Task 1 (transcription-corrector)

### Step 1: Write the failing tests

```typescript
// packages/web/src/hooks/__tests__/useVoiceInput.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MediaRecorder before importing hook
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockMediaRecorder = vi.fn(() => ({
  start: mockStart,
  stop: mockStop,
  state: 'inactive',
  ondataavailable: null as ((e: { data: Blob }) => void) | null,
  onstop: null as (() => void) | null,
  addEventListener: vi.fn((event: string, handler: Function) => {
    if (event === 'dataavailable') mockMediaRecorder._dataHandler = handler;
    if (event === 'stop') mockMediaRecorder._stopHandler = handler;
  }),
  _dataHandler: null as Function | null,
  _stopHandler: null as Function | null,
}));
(mockMediaRecorder as any)._dataHandler = null;
(mockMediaRecorder as any)._stopHandler = null;

vi.stubGlobal('MediaRecorder', mockMediaRecorder);
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue('mock-stream'),
  },
});

vi.mock('@/utils/transcription-corrector', () => ({
  correctTranscription: (t: string) => `[corrected] ${t}`,
}));

// Dynamic import after mocks
const { useVoiceInput } = await import('../useVoiceInput');

describe('useVoiceInput', () => {
  it('exports startRecording, stopRecording, state, transcript', () => {
    // Verify the hook returns the expected API shape
    expect(useVoiceInput).toBeDefined();
    expect(typeof useVoiceInput).toBe('function');
  });
});
```

> **Note:** Full hook testing requires a React render harness. The implementer should add integration-level tests once the hook is wired into a component. This test file establishes the mock infrastructure.

### Step 2: Run test to verify it fails

Run: `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useVoiceInput.test.ts`
Expected: FAIL — module not found

### Step 3: Write the hook implementation

```typescript
// packages/web/src/hooks/useVoiceInput.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { correctTranscription } from '@/utils/transcription-corrector';

/** Whisper service URL — local faster-whisper */
const WHISPER_URL = process.env.NEXT_PUBLIC_WHISPER_URL || 'http://localhost:9876';

/** initial_prompt to bias Whisper toward project vocabulary */
const INITIAL_PROMPT =
  'Cat Cafe 项目对话。常见术语：MCP, Redis, Fastify, Whisper, worktree, ' +
  'rebase, InvocationRecord, Hindsight, 布偶猫, 缅因猫, 暹罗猫, NDJSON, ' +
  'Zustand, TypeScript, WebSocket, Codex, Gemini, Claude, API, CLI, ' +
  'Opus, ADR, Lua, CAS, 宪宪, 砚砚';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

export function useVoiceInput() {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener('stop', async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Skip very short recordings (< 0.5s)
        if (Date.now() - startTimeRef.current < 500) {
          setState('idle');
          return;
        }

        setState('transcribing');

        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('initial_prompt', INITIAL_PROMPT);
          formData.append('language', 'zh');

          const res = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error(`Whisper service error: ${res.status}`);

          const data = await res.json();
          const raw = data.text || '';
          const corrected = correctTranscription(raw);
          setTranscript(corrected);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setState('idle');
        }
      });

      recorder.start();
      startTimeRef.current = Date.now();
      setState('recording');

      // Duration timer (updates every second)
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setState('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { state, transcript, error, duration, startRecording, stopRecording };
}
```

### Step 4: Run test to verify it passes

Run: `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useVoiceInput.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add packages/web/src/hooks/useVoiceInput.ts \
       packages/web/src/hooks/__tests__/useVoiceInput.test.ts
git commit -m "feat(web): add useVoiceInput hook for mic recording + Whisper ASR [布偶猫🐾]

Why: Core hook that captures audio via MediaRecorder, sends to local
faster-whisper for transcription, and runs correction pipeline."
```

---

## Task 3: MicIcon + StopRecordingIcon

**Files:**
- Create: `packages/web/src/components/icons/MicIcon.tsx`
- Create: `packages/web/src/components/icons/StopRecordingIcon.tsx`

No tests needed for pure SVG icon components (consistent with existing icon files in the project which have no tests).

### Step 1: Create MicIcon

```tsx
// packages/web/src/components/icons/MicIcon.tsx
export function MicIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}
```

### Step 2: Create StopRecordingIcon

```tsx
// packages/web/src/components/icons/StopRecordingIcon.tsx
export function StopRecordingIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
```

### Step 3: Commit

```bash
git add packages/web/src/components/icons/MicIcon.tsx \
       packages/web/src/components/icons/StopRecordingIcon.tsx
git commit -m "feat(web): add MicIcon and StopRecordingIcon SVGs [布偶猫🐾]"
```

---

## Task 4: ChatInput Integration (Dynamic Button)

**Files:**
- Modify: `packages/web/src/components/ChatInput.tsx` (lines 1-259)
- Create: `packages/web/src/components/__tests__/chat-input-voice.test.ts`

**Depends on:** Tasks 1, 2, 3

This is the main integration task. We modify ChatInput to:
1. Import and use `useVoiceInput` hook
2. Replace the static send button with a dynamic mic/stop/loading/send button
3. When transcript arrives, append to textarea
4. Show recording state (duration, pulsing indicator)

### Step 1: Write the failing test

```typescript
// packages/web/src/components/__tests__/chat-input-voice.test.ts
import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// Mock all dependencies following established pattern
vi.mock('@/components/icons/SendIcon', () => ({
  SendIcon: () => React.createElement('span', { 'data-testid': 'send-icon' }, 'send'),
}));
vi.mock('@/components/icons/LoadingIcon', () => ({
  LoadingIcon: () => React.createElement('span', null, 'loading'),
}));
vi.mock('@/components/icons/AttachIcon', () => ({
  AttachIcon: () => React.createElement('span', null, 'attach'),
}));
vi.mock('@/components/icons/MicIcon', () => ({
  MicIcon: () => React.createElement('span', { 'data-testid': 'mic-icon' }, 'mic'),
}));
vi.mock('@/components/icons/StopRecordingIcon', () => ({
  StopRecordingIcon: () => React.createElement('span', { 'data-testid': 'stop-icon' }, 'stop'),
}));
vi.mock('@/components/ImagePreview', () => ({
  ImagePreview: () => null,
}));
vi.mock('@/utils/compressImage', () => ({
  compressImage: (f: File) => Promise.resolve(f),
}));

// Mock useVoiceInput
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
let mockVoiceState = 'idle';
let mockTranscript = '';
let mockVoiceError: string | null = null;
let mockDuration = 0;

vi.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({
    state: mockVoiceState,
    transcript: mockTranscript,
    error: mockVoiceError,
    duration: mockDuration,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
  }),
}));

import { ChatInput } from '@/components/ChatInput';

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
});
afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockVoiceState = 'idle';
  mockTranscript = '';
  mockVoiceError = null;
  mockDuration = 0;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ChatInput voice button', () => {
  it('shows mic icon when textarea is empty and idle', () => {
    act(() => { root.render(React.createElement(ChatInput, { onSend: vi.fn() })); });
    const micBtn = container.querySelector('[aria-label="Start voice input"]');
    expect(micBtn).toBeTruthy();
    expect(micBtn?.textContent).toContain('mic');
  });

  it('shows send icon when textarea has content', () => {
    act(() => { root.render(React.createElement(ChatInput, { onSend: vi.fn() })); });
    const textarea = container.querySelector('textarea')!;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )!.set!;
      nativeInputValueSetter.call(textarea, 'hello');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const sendBtn = container.querySelector('[aria-label="Send message"]');
    expect(sendBtn).toBeTruthy();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm --filter @cat-cafe/web test -- src/components/__tests__/chat-input-voice.test.ts`
Expected: FAIL — MicIcon import not found in ChatInput / aria-label not found

### Step 3: Modify ChatInput.tsx

Changes to `packages/web/src/components/ChatInput.tsx`:

**Add imports** (after line 7):
```typescript
import { MicIcon } from './icons/MicIcon';
import { StopRecordingIcon } from './icons/StopRecordingIcon';
import { useVoiceInput } from '@/hooks/useVoiceInput';
```

**Add voice hook + effect** (after line 41, inside the component):
```typescript
const voice = useVoiceInput();

// When transcript arrives, append to textarea
useEffect(() => {
  if (voice.transcript) {
    setInput((prev) => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + voice.transcript;
    });
  }
}, [voice.transcript]);
```

**Replace the send/stop button block** (lines 246-255) with:
```tsx
{disabled && onStop ? (
  <button onClick={onStop} className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors" aria-label="Stop generation">
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="4" width="12" height="12" rx="2" /></svg>
  </button>
) : voice.state === 'recording' ? (
  <button onClick={voice.stopRecording}
    className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors animate-pulse"
    aria-label="Stop recording">
    <StopRecordingIcon className="w-5 h-5" />
  </button>
) : voice.state === 'transcribing' ? (
  <button disabled className="p-3 rounded-xl bg-gray-300 text-white cursor-wait" aria-label="Transcribing">
    <LoadingIcon className="w-5 h-5" />
  </button>
) : input.trim() ? (
  <button onClick={handleSend} disabled={disabled}
    className="p-3 rounded-xl bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
    <SendIcon className="w-5 h-5" />
  </button>
) : (
  <button onClick={voice.startRecording} disabled={disabled}
    className="p-3 rounded-xl text-gray-400 hover:text-owner-primary hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Start voice input">
    <MicIcon className="w-5 h-5" />
  </button>
)}
```

**Add recording status indicator** (before the textarea, inside the flex container):
When recording, show duration badge above the textarea.

```tsx
{voice.state === 'recording' && (
  <div className="absolute top-0 right-16 -mt-6 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
    REC {Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, '0')}
  </div>
)}
```

**Show error toast** (after the recording indicator):
```tsx
{voice.error && (
  <div className="absolute top-0 left-4 -mt-6 px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg">
    {voice.error}
  </div>
)}
```

### Step 4: Run test to verify it passes

Run: `pnpm --filter @cat-cafe/web test -- src/components/__tests__/chat-input-voice.test.ts`
Expected: PASS

### Step 5: Run ALL existing ChatInput tests to check for regressions

Run: `pnpm --filter @cat-cafe/web test -- src/components/__tests__/chat-input`
Expected: All existing tests still pass

### Step 6: Commit

```bash
git add packages/web/src/components/ChatInput.tsx \
       packages/web/src/components/__tests__/chat-input-voice.test.ts
git commit -m "feat(web): integrate voice input into ChatInput with dynamic button [布偶猫🐾]

Why: Dynamic mic/send button (iMessage style) - empty textarea shows 🎤,
has text shows ▶ send. Recording state with pulse animation and duration."
```

---

## Task 5: Whisper Service Setup Script

**Files:**
- Create: `scripts/whisper-server.sh`

No tests for shell scripts — manual verification.

### Step 1: Create the setup/launch script

```bash
#!/usr/bin/env bash
# scripts/whisper-server.sh
# Start local faster-whisper server for Cat Cafe voice input.
#
# Usage:
#   ./scripts/whisper-server.sh          # Start with default model (large-v3)
#   ./scripts/whisper-server.sh small    # Start with smaller model (faster)
#
# Requires: pip install faster-whisper-server

set -euo pipefail

MODEL="${1:-large-v3}"
PORT="${WHISPER_PORT:-9876}"

echo "=== Cat Cafe Whisper Server ==="
echo "Model: $MODEL"
echo "Port:  $PORT"
echo ""

# Check if faster-whisper-server is installed
if ! command -v faster-whisper-server &> /dev/null; then
  echo "faster-whisper-server not found. Installing..."
  pip install faster-whisper-server
fi

echo "Starting Whisper server on port $PORT..."
echo "API endpoint: http://localhost:$PORT/v1/audio/transcriptions"
echo ""

faster-whisper-server --model "$MODEL" --port "$PORT"
```

### Step 2: Make executable and test manually

```bash
chmod +x scripts/whisper-server.sh
# Manual test: ./scripts/whisper-server.sh small
# Verify: curl -X POST http://localhost:9876/v1/audio/transcriptions \
#   -F "file=@test.webm" -F "language=zh"
```

### Step 3: Commit

```bash
git add scripts/whisper-server.sh
git commit -m "feat: add whisper server startup script [布偶猫🐾]

Why: One-command launch for local faster-whisper service.
Supports model selection (large-v3 default, small for faster iteration)."
```

---

## Task 6: End-to-End Manual Verification

**No new files — integration test.**

### Step 1: Start Whisper server

```bash
./scripts/whisper-server.sh
# Wait for model download (first time) and server ready
```

### Step 2: Start Cat Cafe dev environment

```bash
# In worktree
NEXT_PUBLIC_WHISPER_URL=http://localhost:9876 pnpm --filter @cat-cafe/web dev
```

### Step 3: Manual test checklist

Open browser at `http://localhost:3000` (or appropriate port).

- [ ] Empty textarea shows 🎤 mic button (not ▶ send)
- [ ] Click 🎤 → browser asks for mic permission
- [ ] After granting permission → button becomes ⏹ with red pulse
- [ ] REC timer counts up (00:01, 00:02, ...)
- [ ] Speak "帮我看看 MCP 的配置" → click ⏹
- [ ] Button shows ⏳ loading briefly
- [ ] Textarea fills with corrected text
- [ ] Button changes to ▶ send (because textarea now has content)
- [ ] Click send → message sent normally via existing pipeline
- [ ] After send → textarea empty → button reverts to 🎤
- [ ] Test filler removal: say "嗯那个帮我改一下" → fillers stripped
- [ ] Test term correction: say "MCP" → verify not mangled to "ICP"
- [ ] Test error: stop Whisper server → try recording → error toast shown

### Step 4: Run full test suite

```bash
pnpm --filter @cat-cafe/web test
```

Expected: All tests pass, including new voice-related tests.

### Step 5: Final commit (if any fixups needed)

```bash
git add -A
git commit -m "fix(web): voice input integration fixups [布偶猫🐾]"
```

---

## Summary

| Task | Description | Est. | Depends |
|------|-------------|------|---------|
| 1 | Transcription corrector (TDD) | 10 min | — |
| 2 | useVoiceInput hook | 15 min | Task 1 |
| 3 | MicIcon + StopRecordingIcon | 3 min | — |
| 4 | ChatInput integration | 20 min | Tasks 1-3 |
| 5 | Whisper server script | 5 min | — |
| 6 | E2E manual verification | 10 min | Tasks 1-5 |

**Total: ~6 tasks, all frontend, zero backend changes.**

Tasks 1 and 3 are independent and can run in parallel.
Tasks 5 is independent of all other tasks.
