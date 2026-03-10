/**
 * F34-b: Voice Block Synthesizer
 *
 * Singleton service that resolves audio rich blocks with `text` but no `url`
 * by calling the TTS provider and writing the audio to disk.
 *
 * Used by:
 * - route-serial.ts (Route B: text-extracted rich blocks)
 * - callbacks.ts (Route A: MCP-buffered rich blocks)
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat as fsStat } from 'node:fs/promises';
import path from 'node:path';
import type { RichBlock } from '@cat-cafe/shared';
import type { TtsRegistry } from './TtsRegistry.js';
import { getCatVoice } from '../../../../config/cat-voices.js';

let instance: VoiceBlockSynthesizer | null = null;

export function initVoiceBlockSynthesizer(
  ttsRegistry: TtsRegistry,
  cacheDir: string,
): void {
  instance = new VoiceBlockSynthesizer(ttsRegistry, cacheDir);
}

export function getVoiceBlockSynthesizer(): VoiceBlockSynthesizer | null {
  return instance;
}

export class VoiceBlockSynthesizer {
  constructor(
    private readonly ttsRegistry: TtsRegistry,
    private readonly cacheDir: string,
  ) {}

  /**
   * Process an array of rich blocks. For audio blocks with `text` but no/empty `url`,
   * synthesize via TTS and fill in the url + durationSec.
   *
   * Blocks that fail synthesis are converted to info cards (graceful degradation).
   * Non-audio blocks pass through unchanged.
   */
  async resolveVoiceBlocks(blocks: RichBlock[], catId: string): Promise<RichBlock[]> {
    const resolved: RichBlock[] = [];

    for (const block of blocks) {
      if (block.kind !== 'audio') {
        resolved.push(block);
        continue;
      }

      // Voice blocks from cats may have `text` but no `url` (runtime shape differs from strict type)
      const text = ('text' in block && typeof block.text === 'string') ? block.text.trim() : '';
      const existingUrl = ('url' in block && typeof block.url === 'string') ? block.url.trim() : '';

      // Only synthesize if text is present and url is missing/empty
      if (!text || existingUrl) {
        resolved.push(block);
        continue;
      }

      try {
        // F085-P3: per-block speaker override for multi-cat voice
        const voiceCatId = ('speaker' in block && typeof block.speaker === 'string')
          ? block.speaker
          : catId;
        const result = await this.synthesizeToFile(text, voiceCatId);
        resolved.push({
          ...block,
          url: result.audioUrl,
          ...(result.durationSec != null ? { durationSec: result.durationSec } : {}),
          mimeType: 'audio/wav',
        });
      } catch (err) {
        // Graceful degradation: convert to card with the spoken text
        console.error(`[VoiceBlockSynthesizer] Synthesis failed for cat ${catId}:`, err);
        resolved.push({
          id: block.id,
          kind: 'card' as const,
          v: 1 as const,
          title: '🔇 语音合成失败',
          bodyMarkdown: text,
          tone: 'warning' as const,
        });
      }
    }

    return resolved;
  }

  /**
   * Synthesize text to an audio file and return the URL path.
   */
  private async synthesizeToFile(
    text: string,
    catId: string,
  ): Promise<{ audioUrl: string; durationSec?: number }> {
    await mkdir(this.cacheDir, { recursive: true });

    let provider;
    try {
      provider = this.ttsRegistry.getDefault();
    } catch {
      throw new Error('No TTS provider available');
    }

    // Resolve per-cat voice
    const catVoice = getCatVoice(catId);
    const voice = catVoice.voice;
    const langCode = catVoice.langCode;
    const speed = catVoice.speed ?? 1.0;
    const format = 'wav' as const;

    // F066: Clone fields from E-type voice config
    const refAudio = catVoice.refAudio;
    const refText = catVoice.refText;
    const instruct = catVoice.instruct;
    const temperature = catVoice.temperature;

    // Cache hash — includes clone params for distinct cache entries per voice config
    const hashParts = [provider.id, provider.model, voice, langCode, String(speed), format, text];
    if (refAudio) hashParts.push(refAudio);
    if (refText) hashParts.push(refText);
    if (instruct) hashParts.push(instruct);
    if (temperature != null) hashParts.push(String(temperature));
    const hashInput = hashParts.join('|');
    const hash = createHash('sha256').update(hashInput).digest('hex');
    const filename = `${hash}.${format}`;
    const filePath = path.join(this.cacheDir, filename);

    // Check cache
    let cached = false;
    try {
      await fsStat(filePath);
      cached = true;
    } catch { /* not cached */ }

    if (!cached) {
      const result = await provider.synthesize({
        text,
        voice,
        langCode,
        speed,
        format,
        ...(refAudio ? { refAudio } : {}),
        ...(refText ? { refText } : {}),
        ...(instruct ? { instruct } : {}),
        ...(temperature != null ? { temperature } : {}),
      });
      await writeFile(filePath, result.audio);
    }

    return { audioUrl: `/api/tts/audio/${filename}` };
  }
}
