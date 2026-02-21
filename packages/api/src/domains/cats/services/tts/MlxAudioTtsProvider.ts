/**
 * F34: MLX-Audio TTS Provider
 *
 * Implements ITtsProvider by calling the local Python TTS server
 * (scripts/tts-api.py) via HTTP. The Python server wraps mlx-audio
 * and serves an OpenAI-compatible /v1/audio/speech endpoint.
 */

import type { ITtsProvider, TtsSynthesizeRequest, TtsSynthesizeResult } from '@cat-cafe/shared';

export interface MlxAudioTtsProviderOptions {
  /** Base URL of the Python TTS server (default: http://localhost:9877) */
  readonly baseUrl?: string;
  /** Model to request (default: mlx-community/Kokoro-82M-bf16) */
  readonly model?: string;
  /** Request timeout in ms (default: 30000) */
  readonly timeoutMs?: number;
}

export class MlxAudioTtsProvider implements ITtsProvider {
  readonly id = 'mlx-audio';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: MlxAudioTtsProviderOptions) {
    this.baseUrl = options?.baseUrl ?? process.env['TTS_URL'] ?? 'http://localhost:9877';
    this.model = options?.model ?? 'mlx-community/Kokoro-82M-bf16';
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
    const url = `${this.baseUrl}/v1/audio/speech`;
    const body = {
      input: request.text,
      voice: request.voice,
      model: this.model,
      response_format: request.format ?? 'wav',
      speed: request.speed ?? 1.0,
      lang_code: request.langCode ?? 'z',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => 'unknown');
        throw new Error(`TTS server returned ${response.status}: ${detail}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audio = new Uint8Array(arrayBuffer);

      return {
        audio,
        format: request.format ?? 'wav',
        metadata: {
          provider: this.id,
          model: this.model,
          voice: request.voice,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
