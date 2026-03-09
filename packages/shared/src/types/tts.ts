/**
 * F34: TTS (Text-to-Speech) Types
 *
 * Provider-agnostic types for the TTS subsystem.
 * Audio uses Uint8Array (not Buffer) to stay runtime-neutral — usable in both
 * Node.js and browser contexts without pulling in Node-specific types.
 */

/** Per-cat TTS voice configuration */
export interface VoiceConfig {
  readonly voice: string; // provider-specific voice ID (e.g. 'zm_yunxi')
  readonly langCode: string; // 'z' for Chinese, 'en-us' for English
  readonly speed?: number; // playback speed multiplier (default 1.0)
  // F066: Qwen3-TTS Base clone mode fields
  readonly refAudio?: string; // path to reference audio file for voice cloning
  readonly refText?: string; // transcript of the reference audio
  readonly instruct?: string; // style/emotion instruction for Qwen3 clone
  readonly temperature?: number; // generation temperature (0.3 recommended for consistency)
}

/** TTS synthesis request (passed to ITtsProvider) */
export interface TtsSynthesizeRequest {
  readonly text: string;
  readonly voice: string;
  readonly langCode?: string;
  readonly speed?: number;
  readonly format?: 'wav' | 'mp3';
  // F066: Qwen3-TTS Base clone mode fields
  readonly refAudio?: string;
  readonly refText?: string;
  readonly instruct?: string;
  readonly temperature?: number;
}

/** TTS synthesis result (returned by ITtsProvider) */
export interface TtsSynthesizeResult {
  readonly audio: Uint8Array;
  readonly format: string;
  readonly durationSec?: number;
  readonly metadata: {
    readonly provider: string;
    readonly model: string;
    readonly voice: string;
  };
}

/** Interface that all TTS providers must implement */
export interface ITtsProvider {
  readonly id: string;
  /** Model identifier — included in cache key to avoid stale hits across model swaps */
  readonly model: string;
  synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
}
