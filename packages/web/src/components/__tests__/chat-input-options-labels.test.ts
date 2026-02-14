import { describe, expect, it } from 'vitest';
import { CAT_OPTIONS } from '@/components/chat-input-options';

describe('chat input mention option labels', () => {
  it('uses official 暹罗猫 label/insert for gemini option', () => {
    const geminiOption = CAT_OPTIONS.find((opt) => opt.id === 'gemini');
    expect(geminiOption).toBeDefined();
    expect(geminiOption?.label).toBe('@暹罗猫');
    expect(geminiOption?.insert).toBe('@暹罗 ');
  });
});

