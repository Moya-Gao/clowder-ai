import { describe, it, expect, vi } from 'vitest';

// Mock transcription-corrector
vi.mock('@/utils/transcription-corrector', () => ({
  correctTranscription: (t: string) => t,
}));

describe('useVoiceInput', () => {
  it('exports a function', async () => {
    const mod = await import('../useVoiceInput');
    expect(typeof mod.useVoiceInput).toBe('function');
  });

  it('exports VoiceState type (module loads without error)', async () => {
    const mod = await import('../useVoiceInput');
    expect(mod).toBeDefined();
  });
});
