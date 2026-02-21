/**
 * F34: MlxAudioTtsProvider tests
 * Mocks global fetch to test HTTP interaction with Python TTS server.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MlxAudioTtsProvider } from '../dist/domains/cats/services/tts/MlxAudioTtsProvider.js';

describe('MlxAudioTtsProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct id and model', () => {
    const p = new MlxAudioTtsProvider({ baseUrl: 'http://localhost:9999' });
    assert.strictEqual(p.id, 'mlx-audio');
    assert.strictEqual(p.model, 'mlx-community/Kokoro-82M-bf16');
  });

  it('sends correct request body to TTS server', async () => {
    let capturedUrl;
    let capturedBody;
    globalThis.fetch = async (url, init) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };

    const p = new MlxAudioTtsProvider({ baseUrl: 'http://test:9877' });
    await p.synthesize({ text: 'hello', voice: 'vm_test', langCode: 'en', speed: 1.5, format: 'wav' });

    assert.strictEqual(capturedUrl, 'http://test:9877/v1/audio/speech');
    assert.strictEqual(capturedBody.input, 'hello');
    assert.strictEqual(capturedBody.voice, 'vm_test');
    assert.strictEqual(capturedBody.response_format, 'wav');
    assert.strictEqual(capturedBody.speed, 1.5);
    assert.strictEqual(capturedBody.lang_code, 'en');
  });

  it('returns Uint8Array audio with correct metadata', async () => {
    const audioBytes = new Uint8Array([0, 1, 2, 3, 4]);
    globalThis.fetch = async () => new Response(audioBytes, { status: 200 });

    const p = new MlxAudioTtsProvider({ baseUrl: 'http://test:9877' });
    const result = await p.synthesize({ text: 'test', voice: 'v1' });

    assert.ok(result.audio instanceof Uint8Array);
    assert.strictEqual(result.audio.length, 5);
    assert.strictEqual(result.format, 'wav');
    assert.strictEqual(result.metadata.provider, 'mlx-audio');
    assert.strictEqual(result.metadata.voice, 'v1');
  });

  it('throws on non-200 response', async () => {
    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });

    const p = new MlxAudioTtsProvider({ baseUrl: 'http://test:9877' });
    await assert.rejects(
      () => p.synthesize({ text: 'test', voice: 'v1' }),
      (err) => err.message.includes('500'),
    );
  });

  it('uses default langCode and speed when not provided', async () => {
    let capturedBody;
    globalThis.fetch = async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(new Uint8Array(0), { status: 200 });
    };

    const p = new MlxAudioTtsProvider({ baseUrl: 'http://test:9877' });
    await p.synthesize({ text: 'test', voice: 'v1' });

    assert.strictEqual(capturedBody.speed, 1.0);
    assert.strictEqual(capturedBody.lang_code, 'z');
    assert.strictEqual(capturedBody.response_format, 'wav');
  });
});
