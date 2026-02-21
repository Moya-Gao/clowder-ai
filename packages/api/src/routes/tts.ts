/**
 * F34: TTS Routes
 *
 * POST /api/tts/synthesize — Synthesize text to speech, returns audioUrl
 * GET  /api/tts/audio/:filename — Download audio file (auth-gated)
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat as fsStat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { resolveUserId } from '../utils/request-identity.js';
import { getCatVoice } from '../config/cat-voices.js';
import type { TtsRegistry } from '../domains/cats/services/tts/TtsRegistry.js';

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  catId: z.string().optional(),
  voice: z.string().optional(),
  langCode: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
});

/** Strict validation for audio download filename: {64-hex}.{wav|mp3} */
const AUDIO_FILENAME_RE = /^[0-9a-f]{64}\.(wav|mp3)$/;

export interface TtsRouteOptions extends FastifyPluginOptions {
  ttsRegistry: TtsRegistry;
  cacheDir: string;
}

export async function ttsRoutes(
  app: FastifyInstance,
  opts: TtsRouteOptions,
): Promise<void> {
  const { ttsRegistry, cacheDir } = opts;

  // Ensure cache directory exists
  await mkdir(cacheDir, { recursive: true });

  /**
   * POST /api/tts/synthesize
   * Synthesize text to speech for a cat.
   */
  app.post<{ Body: unknown }>('/api/tts/synthesize', async (request, reply) => {
    // Auth gate
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    // Validate body
    const parsed = synthesizeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request', details: parsed.error.issues };
    }
    const { text, catId, voice: voiceOverride, langCode: langCodeOverride, speed: speedOverride } = parsed.data;

    // Resolve voice config: explicit params > per-cat defaults
    const catVoice = catId ? getCatVoice(catId) : getCatVoice('opus');
    const voice = voiceOverride ?? catVoice.voice;
    const langCode = langCodeOverride ?? catVoice.langCode;
    const speed = speedOverride ?? catVoice.speed ?? 1.0;
    const format = 'wav' as const;

    // Get provider
    let provider;
    try {
      provider = ttsRegistry.getDefault();
    } catch {
      reply.status(503);
      return { error: 'No TTS provider available' };
    }

    // Compute cache hash: sha256(provider + model + voice + langCode + speed + format + text)
    const hashInput = [provider.id, provider.model, voice, langCode, String(speed), format, text].join('|');
    const hash = createHash('sha256').update(hashInput).digest('hex');
    const filename = `${hash}.${format}`;
    const filePath = path.join(cacheDir, filename);

    // Check cache
    let cached = false;
    try {
      await fsStat(filePath);
      cached = true;
    } catch {
      // Not cached
    }

    if (!cached) {
      // Synthesize
      try {
        const result = await provider.synthesize({ text, voice, langCode, speed, format });
        await writeFile(filePath, result.audio);
      } catch (err) {
        request.log.error({ err, voice, langCode }, 'TTS synthesis failed');
        reply.status(502);
        return { error: 'TTS synthesis failed', detail: err instanceof Error ? err.message : 'unknown' };
      }
    }

    return {
      audioUrl: `/api/tts/audio/${filename}`,
    };
  });

  /**
   * GET /api/tts/audio/:filename
   * Auth-gated audio download (R2-P1: not served via public /uploads/).
   */
  app.get<{ Params: { filename: string } }>('/api/tts/audio/:filename', async (request, reply) => {
    // Auth gate
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { filename } = request.params;

    // R3-P1: Strict filename validation — 64-hex hash + wav/mp3 extension
    if (!AUDIO_FILENAME_RE.test(filename)) {
      reply.status(400);
      return { error: 'Invalid audio filename' };
    }

    // R3-P1: Safe path join + prefix verification
    const resolvedPath = path.resolve(cacheDir, filename);
    if (!resolvedPath.startsWith(path.resolve(cacheDir))) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    // Check file exists
    try {
      await fsStat(resolvedPath);
    } catch {
      reply.status(404);
      return { error: 'Audio not found' };
    }

    // Determine MIME type
    const ext = path.extname(filename).slice(1);
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';

    reply.header('Content-Type', mimeType);
    reply.header('Cache-Control', 'private, max-age=86400');
    return reply.send(createReadStream(resolvedPath));
  });
}
