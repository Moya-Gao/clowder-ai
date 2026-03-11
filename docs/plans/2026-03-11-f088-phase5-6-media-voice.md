# F088 Phase 5+6 + AC-14: Media, Voice, Card Actions

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Complete F088 remaining ACs — card button callbacks (AC-14), bidirectional image/file handling (AC-19~21), and voice message STT/TTS conversion (AC-22~24).

**Architecture:** The worktree `feat/f088-media` already has adapter-layer changes (parsing + sending for media/card actions in both FeishuAdapter and TelegramAdapter). This plan fills the **middleware gaps**: platform media download/upload, server-side STT, and TTS→platform delivery wiring. Uses existing `ITtsProvider`/`TtsRegistry` pattern for STT; reuses `saveUploadedImages` pattern for media storage.

**Tech Stack:** TypeScript, Node.js, `@larksuiteoapi/node-sdk` (Feishu file API), `grammy` (Telegram getFile), Whisper-compatible STT service (OpenAI `/v1/audio/transcriptions` endpoint), existing TTS infrastructure (F034/F066).

**Worktree:** `/Users/lysander/projects/relay-station/cat-cafe-f088-media` (branch `feat/f088-media`)

**Existing uncommitted work:** 753 lines across 9 files — adapter-level media parsing/sending + AC-14 card action parsing + comprehensive tests. All of this is DONE and should be committed as-is in Task 1.

---

## Terminal Schema

```typescript
// ── ConnectorMediaService (new) ──
interface IConnectorMediaService {
  /** Download media from external platform → local file → return local URL path */
  download(connectorId: string, attachment: MediaAttachment): Promise<DownloadedMedia>;
}

interface MediaAttachment {
  type: 'image' | 'file' | 'audio';
  platformKey: string;        // feishuKey or telegramFileId
  fileName?: string;
  duration?: number;
}

interface DownloadedMedia {
  localUrl: string;           // e.g. "/uploads/connector-media/1234-abcd.jpg"
  absPath: string;
  mimeType: string;
  originalFileName?: string;
}

// ── ISttProvider (new, mirrors ITtsProvider) ──
interface ISttProvider {
  readonly id: string;
  readonly model: string;
  transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult>;
}

interface SttTranscribeRequest {
  audioPath: string;          // local file path
  language?: string;          // e.g. 'zh', 'en'
  format?: string;            // audio format hint
}

interface SttTranscribeResult {
  text: string;
  language?: string;
  durationSec?: number;
  metadata: { provider: string; model: string };
}

// ── SttRegistry (mirrors TtsRegistry) ──
// Same pattern as TtsRegistry: register(), get(), getDefault(), has(), listIds()

// ── Extended ConnectorRouter.route() signature ──
route(
  connectorId: string,
  externalChatId: string,
  text: string,
  externalMessageId: string,
  attachments?: MediaAttachment[],  // NEW
): Promise<RouteResult>
```

## What We're NOT Building

- New UI components (frontend unchanged)
- Media CDN / S3 storage (use local fs like existing upload/TTS cache)
- Image recognition / cat "seeing" images (just passing URLs to agent context)
- Streaming STT (batch transcription only)
- Custom STT model training
- Group chat media handling (DM-only scope matches F088 MVP)

---

## Task 1: Commit Existing Adapter Work (Foundation)

The worktree has 753 lines of uncommitted, working code. Commit it as the foundation.

**Files (existing, uncommitted):**
- `packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts`
- `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts`
- `packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts`
- `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- `packages/api/test/connector-gateway-bootstrap.test.js`
- `packages/api/test/f088-gateway-integration.test.js`
- `packages/api/test/feishu-adapter.test.js`
- `packages/api/test/outbound-delivery-hook.test.js`
- `packages/api/test/telegram-adapter.test.js`

**Step 1: Run existing tests to verify**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f088-media
node --test packages/api/test/feishu-adapter.test.js packages/api/test/telegram-adapter.test.js packages/api/test/outbound-delivery-hook.test.js packages/api/test/connector-gateway-bootstrap.test.js packages/api/test/f088-gateway-integration.test.js
```

Expected: All tests pass.

**Step 2: Commit**

```bash
git add packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts \
  packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts \
  packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts \
  packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts \
  packages/api/test/connector-gateway-bootstrap.test.js \
  packages/api/test/f088-gateway-integration.test.js \
  packages/api/test/feishu-adapter.test.js \
  packages/api/test/outbound-delivery-hook.test.js \
  packages/api/test/telegram-adapter.test.js
git commit -m "feat(F088): adapter-layer media parsing + sendMedia + AC-14 card actions"
```

---

## Task 2: STT Types + ISttProvider Interface

Mirror the `ITtsProvider` pattern for speech-to-text.

**Files:**
- Create: `packages/shared/src/types/stt.ts`
- Modify: `packages/shared/src/types/index.ts` (add re-export)

**Step 1: Write the failing test**

```bash
# Test: packages/api/test/stt-provider.test.js
```

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SttRegistry', () => {
  it('registers and retrieves a provider', async () => {
    // Dynamic import to verify the module exists and exports correctly
    const { SttRegistry } = await import(
      '../src/infrastructure/connectors/media/SttRegistry.js'
    );
    const registry = new SttRegistry();

    const mockProvider = {
      id: 'whisper-local',
      model: 'whisper-large-v3',
      async transcribe() {
        return { text: 'hello', metadata: { provider: 'whisper-local', model: 'whisper-large-v3' } };
      },
    };

    registry.register(mockProvider);
    assert.equal(registry.has('whisper-local'), true);
    assert.equal(registry.getDefault().id, 'whisper-local');
  });

  it('getDefault throws when empty', async () => {
    const { SttRegistry } = await import(
      '../src/infrastructure/connectors/media/SttRegistry.js'
    );
    const registry = new SttRegistry();
    assert.throws(() => registry.getDefault(), /No STT providers registered/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/api/test/stt-provider.test.js
```

Expected: FAIL (module not found)

**Step 3: Implement types + registry**

`packages/shared/src/types/stt.ts`:
```typescript
/**
 * F088 Phase 6: STT (Speech-to-Text) Types
 * Mirrors ITtsProvider pattern for speech recognition.
 */

export interface SttTranscribeRequest {
  readonly audioPath: string;
  readonly language?: string;
  readonly format?: string;
}

export interface SttTranscribeResult {
  readonly text: string;
  readonly language?: string;
  readonly durationSec?: number;
  readonly metadata: {
    readonly provider: string;
    readonly model: string;
  };
}

export interface ISttProvider {
  readonly id: string;
  readonly model: string;
  transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult>;
}
```

`packages/shared/src/types/index.ts` — add: `export type { ISttProvider, SttTranscribeRequest, SttTranscribeResult } from './stt.js';`

`packages/api/src/infrastructure/connectors/media/SttRegistry.ts`:
```typescript
import type { ISttProvider } from '@cat-cafe/shared';

export class SttRegistry {
  private readonly providers = new Map<string, ISttProvider>();

  register(provider: ISttProvider): void {
    if (this.providers.has(provider.id))
      throw new Error(`STT provider '${provider.id}' already registered`);
    this.providers.set(provider.id, provider);
  }

  get(id: string): ISttProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`STT provider '${id}' not found`);
    return p;
  }

  has(id: string): boolean { return this.providers.has(id); }

  getDefault(): ISttProvider {
    const first = this.providers.values().next();
    if (first.done) throw new Error('No STT providers registered');
    return first.value;
  }

  listIds(): string[] { return [...this.providers.keys()]; }
}
```

**Step 4: Rebuild shared + run test**

```bash
pnpm --filter @cat-cafe/shared build
node --test packages/api/test/stt-provider.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types/stt.ts packages/shared/src/types/index.ts \
  packages/api/src/infrastructure/connectors/media/SttRegistry.ts \
  packages/api/test/stt-provider.test.js
git commit -m "feat(F088): ISttProvider interface + SttRegistry (mirrors TtsRegistry)"
```

---

## Task 3: WhisperSttProvider — Server-Side STT

HTTP client to local Whisper service (same OpenAI-compatible API as frontend `useVoiceInput`).

**Files:**
- Create: `packages/api/src/infrastructure/connectors/media/WhisperSttProvider.ts`
- Test: `packages/api/test/whisper-stt-provider.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('WhisperSttProvider', () => {
  it('sends audio file to Whisper API and returns transcript', async () => {
    const { WhisperSttProvider } = await import(
      '../src/infrastructure/connectors/media/WhisperSttProvider.js'
    );

    // Mock fetch
    const mockFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ text: '你好世界' }),
    }));

    const provider = new WhisperSttProvider({
      baseUrl: 'http://localhost:9876',
      _fetchFn: mockFetch,
    });

    assert.equal(provider.id, 'whisper-local');

    const result = await provider.transcribe({
      audioPath: '/tmp/test-audio.wav',
    });

    assert.equal(result.text, '你好世界');
    assert.equal(result.metadata.provider, 'whisper-local');
    assert.equal(mockFetch.mock.calls.length, 1);

    // Verify FormData was sent to correct endpoint
    const [url, opts] = mockFetch.mock.calls[0].arguments;
    assert.equal(url, 'http://localhost:9876/v1/audio/transcriptions');
    assert.equal(opts.method, 'POST');
  });

  it('throws on non-ok response', async () => {
    const { WhisperSttProvider } = await import(
      '../src/infrastructure/connectors/media/WhisperSttProvider.js'
    );

    const provider = new WhisperSttProvider({
      baseUrl: 'http://localhost:9876',
      _fetchFn: async () => ({ ok: false, status: 500, text: async () => 'error' }),
    });

    await assert.rejects(
      () => provider.transcribe({ audioPath: '/tmp/test.wav' }),
      /STT request failed/,
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/api/test/whisper-stt-provider.test.js
```

**Step 3: Implement WhisperSttProvider**

```typescript
// packages/api/src/infrastructure/connectors/media/WhisperSttProvider.ts
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { ISttProvider, SttTranscribeRequest, SttTranscribeResult } from '@cat-cafe/shared';

export interface WhisperSttProviderOptions {
  baseUrl?: string;
  model?: string;
  /** @internal test injection */
  _fetchFn?: typeof fetch;
}

export class WhisperSttProvider implements ISttProvider {
  readonly id = 'whisper-local';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts?: WhisperSttProviderOptions) {
    this.baseUrl = opts?.baseUrl ?? process.env['WHISPER_URL'] ?? 'http://localhost:9876';
    this.model = opts?.model ?? 'whisper-large-v3';
    this.fetchFn = opts?._fetchFn ?? fetch;
  }

  async transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult> {
    // Read audio file as blob
    const { readFile } = await import('node:fs/promises');
    const audioBuffer = await readFile(request.audioPath);
    const ext = path.extname(request.audioPath).slice(1) || 'wav';
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
    formData.append('model', this.model);
    if (request.language) formData.append('language', request.language);

    const response = await this.fetchFn(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await (response as Response).text();
      throw new Error(`STT request failed (${(response as Response).status}): ${body}`);
    }

    const data = await (response as Response).json() as { text: string; duration?: number };

    return {
      text: data.text,
      durationSec: data.duration,
      metadata: { provider: this.id, model: this.model },
    };
  }
}
```

**Step 4: Run test**

```bash
node --test packages/api/test/whisper-stt-provider.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/media/WhisperSttProvider.ts \
  packages/api/test/whisper-stt-provider.test.js
git commit -m "feat(F088): WhisperSttProvider — server-side STT via OpenAI-compatible API"
```

---

## Task 4: ConnectorMediaService — Platform Media Download

Downloads media from Feishu/Telegram APIs → stores locally → returns local URL.

**Files:**
- Create: `packages/api/src/infrastructure/connectors/media/ConnectorMediaService.ts`
- Test: `packages/api/test/connector-media-service.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('ConnectorMediaService', () => {
  it('downloads feishu image and stores locally', async () => {
    const { ConnectorMediaService } = await import(
      '../src/infrastructure/connectors/media/ConnectorMediaService.js'
    );

    const tempDir = await mkdtemp(path.join(tmpdir(), 'media-test-'));

    const mockFeishuDownload = mock.fn(async () => Buffer.from('fake-image-data'));
    const service = new ConnectorMediaService({
      mediaDir: tempDir,
      feishuDownloadFn: mockFeishuDownload,
    });

    const result = await service.download('feishu', {
      type: 'image',
      platformKey: 'img_v2_abc123',
    });

    assert.ok(result.localUrl.startsWith('/api/connector-media/'));
    assert.ok(result.absPath.startsWith(tempDir));
    assert.equal(mockFeishuDownload.mock.calls.length, 1);

    // Verify file was written
    const content = await readFile(result.absPath);
    assert.deepEqual(content, Buffer.from('fake-image-data'));

    await rm(tempDir, { recursive: true });
  });

  it('downloads telegram file and stores locally', async () => {
    const { ConnectorMediaService } = await import(
      '../src/infrastructure/connectors/media/ConnectorMediaService.js'
    );

    const tempDir = await mkdtemp(path.join(tmpdir(), 'media-test-'));

    const mockTelegramDownload = mock.fn(async () => Buffer.from('fake-voice-data'));
    const service = new ConnectorMediaService({
      mediaDir: tempDir,
      telegramDownloadFn: mockTelegramDownload,
    });

    const result = await service.download('telegram', {
      type: 'audio',
      platformKey: 'telegram-file-id-123',
      duration: 5,
    });

    assert.ok(result.localUrl.startsWith('/api/connector-media/'));
    assert.ok(result.absPath.endsWith('.ogg'));

    await rm(tempDir, { recursive: true });
  });

  it('returns correct extension for file type with fileName', async () => {
    const { ConnectorMediaService } = await import(
      '../src/infrastructure/connectors/media/ConnectorMediaService.js'
    );

    const tempDir = await mkdtemp(path.join(tmpdir(), 'media-test-'));
    const service = new ConnectorMediaService({
      mediaDir: tempDir,
      feishuDownloadFn: async () => Buffer.from('data'),
    });

    const result = await service.download('feishu', {
      type: 'file',
      platformKey: 'file_key_123',
      fileName: 'report.pdf',
    });

    assert.ok(result.absPath.endsWith('.pdf'));
    assert.equal(result.originalFileName, 'report.pdf');

    await rm(tempDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/api/test/connector-media-service.test.js
```

**Step 3: Implement ConnectorMediaService**

```typescript
// packages/api/src/infrastructure/connectors/media/ConnectorMediaService.ts
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface MediaAttachment {
  type: 'image' | 'file' | 'audio';
  platformKey: string;
  fileName?: string;
  duration?: number;
}

export interface DownloadedMedia {
  localUrl: string;
  absPath: string;
  mimeType: string;
  originalFileName?: string;
}

export interface ConnectorMediaServiceOptions {
  mediaDir: string;
  feishuDownloadFn?: (key: string, type: string) => Promise<Buffer>;
  telegramDownloadFn?: (fileId: string) => Promise<Buffer>;
}

const TYPE_TO_EXT: Record<string, string> = {
  image: '.jpg',
  audio: '.ogg',
  file: '.bin',
};

export class ConnectorMediaService {
  constructor(private readonly opts: ConnectorMediaServiceOptions) {}

  async download(connectorId: string, attachment: MediaAttachment): Promise<DownloadedMedia> {
    await mkdir(this.opts.mediaDir, { recursive: true });

    let buffer: Buffer;
    if (connectorId === 'feishu' && this.opts.feishuDownloadFn) {
      buffer = await this.opts.feishuDownloadFn(attachment.platformKey, attachment.type);
    } else if (connectorId === 'telegram' && this.opts.telegramDownloadFn) {
      buffer = await this.opts.telegramDownloadFn(attachment.platformKey);
    } else {
      throw new Error(`No download function for connector: ${connectorId}`);
    }

    // Determine extension
    let ext: string;
    if (attachment.fileName) {
      ext = path.extname(attachment.fileName) || TYPE_TO_EXT[attachment.type] || '.bin';
    } else {
      ext = TYPE_TO_EXT[attachment.type] || '.bin';
    }

    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const absPath = path.resolve(path.join(this.opts.mediaDir, filename));

    await writeFile(absPath, buffer);

    const mimeType = extToMime(ext);

    return {
      localUrl: `/api/connector-media/${filename}`,
      absPath,
      mimeType,
      originalFileName: attachment.fileName,
    };
  }
}

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp',
    '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf', '.bin': 'application/octet-stream',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}
```

**Step 4: Run test**

```bash
node --test packages/api/test/connector-media-service.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/media/ConnectorMediaService.ts \
  packages/api/test/connector-media-service.test.js
git commit -m "feat(F088): ConnectorMediaService — platform media download + local storage"
```

---

## Task 5: Wire Media Download + STT into ConnectorRouter

Extend `ConnectorRouter.route()` to accept attachments. When voice attachment received, run STT to convert to text before routing to cat. For image/file, download and include local URL in message.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- Test: `packages/api/test/connector-router-media.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('ConnectorRouter media handling', () => {
  // Helper to create minimal router deps
  function makeDeps(overrides = {}) {
    const messages = [];
    const triggers = [];
    return {
      bindingStore: {
        async getByExternal() { return { connectorId: 'feishu', externalChatId: 'chat1', threadId: 'T1', userId: 'u1', createdAt: 0 }; },
        async getByThread() { return []; },
        async bind() { return { connectorId: 'feishu', externalChatId: 'chat1', threadId: 'T1', userId: 'u1', createdAt: 0 }; },
      },
      dedup: { isDuplicate: () => false },
      messageStore: {
        async append(input) { messages.push(input); return { id: `msg-${messages.length}` }; },
      },
      threadStore: {
        create: async () => ({ id: 'T1' }),
        get: async () => ({ id: 'T1', title: 'Test' }),
        list: async () => [],
      },
      invokeTrigger: {
        trigger(...args) { triggers.push(args); },
      },
      defaultUserId: 'user1',
      defaultCatId: 'opus',
      log: { info() {}, warn() {}, error() {}, debug() {} },
      messages,
      triggers,
      ...overrides,
    };
  }

  it('voice attachment triggers STT and routes transcribed text', async () => {
    const { ConnectorRouter } = await import(
      '../src/infrastructure/connectors/ConnectorRouter.js'
    );

    const sttTranscribe = mock.fn(async () => ({
      text: '你好猫猫',
      metadata: { provider: 'whisper', model: 'v3' },
    }));
    const mediaDownload = mock.fn(async () => ({
      localUrl: '/api/connector-media/audio.ogg',
      absPath: '/tmp/audio.ogg',
      mimeType: 'audio/ogg',
    }));

    const deps = makeDeps({
      mediaService: { download: mediaDownload },
      sttProvider: { transcribe: sttTranscribe },
    });

    const router = new ConnectorRouter(deps);
    const result = await router.route('feishu', 'chat1', '[语音]', 'msg1', [
      { type: 'audio', platformKey: 'audio_key_123', duration: 3 },
    ]);

    assert.equal(result.kind, 'routed');
    // Should have stored the transcribed text, not '[语音]'
    assert.equal(deps.messages[0].content, '🎤 你好猫猫');
    assert.equal(sttTranscribe.mock.calls.length, 1);
    assert.equal(mediaDownload.mock.calls.length, 1);
  });

  it('image attachment downloads and includes URL in message', async () => {
    const { ConnectorRouter } = await import(
      '../src/infrastructure/connectors/ConnectorRouter.js'
    );

    const mediaDownload = mock.fn(async () => ({
      localUrl: '/api/connector-media/photo.jpg',
      absPath: '/tmp/photo.jpg',
      mimeType: 'image/jpeg',
    }));

    const deps = makeDeps({ mediaService: { download: mediaDownload } });

    const router = new ConnectorRouter(deps);
    const result = await router.route('feishu', 'chat1', '[图片]', 'msg1', [
      { type: 'image', platformKey: 'img_key_456' },
    ]);

    assert.equal(result.kind, 'routed');
    assert.ok(deps.messages[0].content.includes('/api/connector-media/photo.jpg'));
    assert.equal(mediaDownload.mock.calls.length, 1);
  });

  it('routes normally when no attachments', async () => {
    const { ConnectorRouter } = await import(
      '../src/infrastructure/connectors/ConnectorRouter.js'
    );

    const deps = makeDeps();
    const router = new ConnectorRouter(deps);
    const result = await router.route('feishu', 'chat1', '普通消息', 'msg1');

    assert.equal(result.kind, 'routed');
    assert.equal(deps.messages[0].content, '普通消息');
  });

  it('falls back to placeholder text when STT fails', async () => {
    const { ConnectorRouter } = await import(
      '../src/infrastructure/connectors/ConnectorRouter.js'
    );

    const deps = makeDeps({
      mediaService: { download: async () => ({ localUrl: '/x', absPath: '/tmp/x', mimeType: 'audio/ogg' }) },
      sttProvider: { transcribe: async () => { throw new Error('STT service down'); } },
    });

    const router = new ConnectorRouter(deps);
    const result = await router.route('feishu', 'chat1', '[语音]', 'msg1', [
      { type: 'audio', platformKey: 'key', duration: 2 },
    ]);

    assert.equal(result.kind, 'routed');
    // Falls back to original text placeholder
    assert.equal(deps.messages[0].content, '[语音]');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/api/test/connector-router-media.test.js
```

**Step 3: Modify ConnectorRouter**

Add to `ConnectorRouterOptions`:
```typescript
readonly mediaService?: { download(connectorId: string, attachment: MediaAttachment): Promise<DownloadedMedia> } | undefined;
readonly sttProvider?: { transcribe(request: { audioPath: string; language?: string }): Promise<{ text: string }> } | undefined;
```

Add to `route()` method (after dedup, before command interception):
```typescript
// Phase 5+6: Process media attachments
let resolvedText = text;
if (attachments?.length && this.opts.mediaService) {
  resolvedText = await this.processAttachments(connectorId, text, attachments);
}
```

Then use `resolvedText` instead of `text` for messageStore.append and invokeTrigger.

Add private method:
```typescript
private async processAttachments(
  connectorId: string,
  originalText: string,
  attachments: MediaAttachment[],
): Promise<string> {
  const parts: string[] = [];

  for (const att of attachments) {
    try {
      const downloaded = await this.opts.mediaService!.download(connectorId, att);

      if (att.type === 'audio' && this.opts.sttProvider) {
        // Phase 6: STT — transcribe voice to text
        try {
          const result = await this.opts.sttProvider.transcribe({ audioPath: downloaded.absPath });
          parts.push(`🎤 ${result.text}`);
        } catch (err) {
          this.opts.log.warn({ err, connectorId }, '[ConnectorRouter] STT failed, using placeholder');
          parts.push(originalText);
        }
      } else {
        // Phase 5: Include media URL
        parts.push(`${originalText} ${downloaded.localUrl}`);
      }
    } catch (err) {
      this.opts.log.warn({ err, connectorId }, '[ConnectorRouter] Media download failed');
      parts.push(originalText);
    }
  }

  return parts.length > 0 ? parts.join('\n') : originalText;
}
```

**Step 4: Run test**

```bash
node --test packages/api/test/connector-router-media.test.js
```

Expected: PASS

**Step 5: Also run existing router tests to avoid regression**

```bash
node --test packages/api/test/connector-gateway-bootstrap.test.js packages/api/test/f088-gateway-integration.test.js
```

Expected: PASS (existing tests don't pass attachments, so backward compat preserved)

**Step 6: Update bootstrap to wire media service**

In `connector-gateway-bootstrap.ts`, update `startConnectorGateway()`:
- Accept optional `ConnectorMediaService` + `SttRegistry` in deps
- Wire them into ConnectorRouter options
- Pass attachments in Telegram polling handler and Feishu webhook handler

```typescript
// In Telegram polling handler:
telegram.startPolling(async (msg) => {
  await connectorRouter.route('telegram', msg.chatId, msg.text, msg.messageId, msg.attachments);
});

// In Feishu webhook handler (after parseEvent):
const result = await connectorRouter.route('feishu', parsed.chatId, parsed.text, parsed.messageId, parsed.attachments);
```

**Step 7: Commit**

```bash
git add packages/api/src/infrastructure/connectors/ConnectorRouter.ts \
  packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts \
  packages/api/test/connector-router-media.test.js
git commit -m "feat(F088): wire media download + STT into ConnectorRouter (AC-19~22)"
```

---

## Task 6: TTS → Platform Audio Delivery (AC-23)

When a cat replies with audio rich blocks, the `VoiceBlockSynthesizer` already fills `url` with a local path like `/api/tts/audio/abc.wav`. The `OutboundDeliveryHook` already sends audio blocks via `sendMedia()`. This task verifies the full chain works and adds integration test.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts` (add image block delivery)
- Test: `packages/api/test/outbound-delivery-media-integration.test.js`

**Step 1: Write the integration test**

```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('OutboundDeliveryHook — media delivery integration', () => {
  it('sends synthesized audio via sendMedia when audio block has url', async () => {
    const { OutboundDeliveryHook } = await import(
      '../src/infrastructure/connectors/OutboundDeliveryHook.js'
    );

    const sendMediaCalls = [];
    const mockAdapter = {
      connectorId: 'feishu',
      async sendReply() {},
      async sendMedia(chatId, payload) { sendMediaCalls.push({ chatId, payload }); },
      async sendRichMessage(chatId, text, blocks, name) {},
    };

    const hook = new OutboundDeliveryHook({
      bindingStore: {
        async getByThread() {
          return [{ connectorId: 'feishu', externalChatId: 'chat1', threadId: 'T1', userId: 'u1', createdAt: 0 }];
        },
      },
      adapters: new Map([['feishu', mockAdapter]]),
      log: { info() {}, warn() {}, error() {}, debug() {} },
    });

    await hook.deliver('T1', 'Here is the voice message', 'opus', [
      { id: 'block1', kind: 'audio', v: 1, url: '/api/tts/audio/abc123.wav', text: '你好' },
    ]);

    assert.equal(sendMediaCalls.length, 1);
    assert.equal(sendMediaCalls[0].payload.type, 'audio');
    assert.equal(sendMediaCalls[0].payload.url, '/api/tts/audio/abc123.wav');
  });

  it('sends image blocks via sendMedia when image block has url', async () => {
    const { OutboundDeliveryHook } = await import(
      '../src/infrastructure/connectors/OutboundDeliveryHook.js'
    );

    const sendMediaCalls = [];
    const mockAdapter = {
      connectorId: 'telegram',
      async sendReply() {},
      async sendMedia(chatId, payload) { sendMediaCalls.push({ chatId, payload }); },
      async sendRichMessage(chatId, text, blocks, name) {},
    };

    const hook = new OutboundDeliveryHook({
      bindingStore: {
        async getByThread() {
          return [{ connectorId: 'telegram', externalChatId: 'chat2', threadId: 'T2', userId: 'u1', createdAt: 0 }];
        },
      },
      adapters: new Map([['telegram', mockAdapter]]),
      log: { info() {}, warn() {}, error() {}, debug() {} },
    });

    await hook.deliver('T2', 'Check this image', undefined, [
      { id: 'block1', kind: 'media_gallery', v: 1, items: [{ url: '/uploads/photo.jpg', type: 'image' }] },
    ]);

    // media_gallery image delivery via sendMedia
    assert.equal(sendMediaCalls.length, 1);
    assert.equal(sendMediaCalls[0].payload.type, 'image');
  });
});
```

**Step 2: Run test, implement, iterate**

The audio path already works (worktree code handles it). For image blocks from `media_gallery`, add after the audio block loop in `OutboundDeliveryHook.deliver()`:

```typescript
// Phase 5: Send media_gallery images as image messages
if (block.kind === 'media_gallery' && 'items' in block) {
  const items = block.items as Array<{ url?: string; type?: string }>;
  for (const item of items) {
    if (item.url && item.type === 'image') {
      await adapter.sendMedia(binding.externalChatId, {
        type: 'image',
        url: item.url,
      });
    }
  }
}
```

**Step 3: Run all outbound tests**

```bash
node --test packages/api/test/outbound-delivery-hook.test.js packages/api/test/outbound-delivery-media-integration.test.js
```

**Step 4: Commit**

```bash
git add packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts \
  packages/api/test/outbound-delivery-media-integration.test.js
git commit -m "feat(F088): image block outbound delivery via sendMedia (AC-21+23)"
```

---

## Task 7: Connector Media Static Route

Serve downloaded connector media files (same pattern as `/uploads` and `/api/tts/audio`).

**Files:**
- Create: `packages/api/src/routes/connector-media.ts`
- Test: inline with bootstrap wiring

**Step 1: Implement static file route**

```typescript
// packages/api/src/routes/connector-media.ts
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

export interface ConnectorMediaRoutesOptions {
  mediaDir: string;
}

export default async function connectorMediaRoutes(
  app: FastifyInstance,
  opts: ConnectorMediaRoutesOptions,
): Promise<void> {
  await app.register(fastifyStatic, {
    root: resolve(opts.mediaDir),
    prefix: '/api/connector-media/',
    decorateReply: false,
  });
}
```

**Step 2: Wire in index.ts** (if needed, or note for bootstrap integration)

The route registration follows the same pattern as `uploadsRoutes` in `index.ts`.

**Step 3: Commit**

```bash
git add packages/api/src/routes/connector-media.ts
git commit -m "feat(F088): connector-media static route for downloaded platform files"
```

---

## Task 8: STT Provider Configurability (AC-24)

Add `WHISPER_URL` env var support and SttRegistry wiring in bootstrap.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- Modify: `packages/api/src/config/env-registry.ts` (add WHISPER_URL entry)

**Step 1: Add env var**

In `env-registry.ts`, add:
```typescript
{ name: 'WHISPER_URL', defaultValue: 'http://localhost:9876', description: 'Whisper STT 服务地址', category: 'stt', sensitive: false },
```

**Step 2: Wire SttRegistry into bootstrap**

In `ConnectorGatewayConfig`, add:
```typescript
whisperUrl?: string | undefined;
```

In `loadConnectorGatewayConfig()`:
```typescript
whisperUrl: process.env['WHISPER_URL'],
```

In `startConnectorGateway()`:
```typescript
// STT provider (optional — voice messages fall back to placeholder without it)
let sttProvider: ISttProvider | undefined;
if (config.whisperUrl || process.env['WHISPER_URL']) {
  const { WhisperSttProvider } = await import('./media/WhisperSttProvider.js');
  sttProvider = new WhisperSttProvider({ baseUrl: config.whisperUrl });
}
```

Pass to ConnectorRouter:
```typescript
const connectorRouter = new ConnectorRouter({
  ...existing,
  mediaService,
  sttProvider,
});
```

**Step 3: Commit**

```bash
git add packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts \
  packages/api/src/config/env-registry.ts
git commit -m "feat(F088): wire STT provider config (AC-24) — WHISPER_URL env"
```

---

## Task 9: Full Integration Test + Biome + Types

**Step 1: Run all connector tests**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f088-media
node --test packages/api/test/feishu-adapter.test.js packages/api/test/telegram-adapter.test.js \
  packages/api/test/outbound-delivery-hook.test.js packages/api/test/connector-gateway-bootstrap.test.js \
  packages/api/test/f088-gateway-integration.test.js packages/api/test/connector-router-media.test.js \
  packages/api/test/stt-provider.test.js packages/api/test/whisper-stt-provider.test.js \
  packages/api/test/connector-media-service.test.js packages/api/test/outbound-delivery-media-integration.test.js
```

**Step 2: Biome check**

```bash
pnpm check
```

Fix any issues with `pnpm check:fix`.

**Step 3: Type check**

```bash
pnpm lint
```

**Step 4: Dir size check**

```bash
pnpm check:dir-size
```

**Step 5: Final commit (if any fixes)**

```bash
git add -A && git commit -m "chore: biome + type fixes for F088 Phase 5+6"
```

---

## AC Coverage Summary

| AC | Description | Task |
|----|-------------|------|
| AC-14 | 飞书卡片按钮交互回调 | Task 1 (existing) |
| AC-19 | 接收用户图片 → 下载 → 存储 → 传给猫 | Task 4+5 |
| AC-20 | 接收用户文件 → 下载 → 传给猫 | Task 4+5 |
| AC-21 | 猫图片回复 → 上传 → 发图片消息 | Task 6 |
| AC-22 | 接收语音 → STT → 文本消息 | Task 3+5 |
| AC-23 | 文字回复 → TTS → 语音消息 | Task 6 (existing VoiceBlockSynthesizer + sendMedia) |
| AC-24 | STT/TTS provider 可配置 | Task 8 (TTS already configurable, STT now too) |
