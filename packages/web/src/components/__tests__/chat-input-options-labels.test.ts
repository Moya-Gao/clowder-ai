import { describe, expect, it } from 'vitest';
import { buildCatOptions } from '@/components/chat-input-options';
import type { CatData } from '@/hooks/useCatData';

const FAKE_CATS: CatData[] = [
  {
    id: 'gemini',
    displayName: '暹罗猫',
    color: { primary: '#5B9BD5', secondary: '#D6E9F8' },
    mentionPatterns: ['暹罗', '暹罗猫', 'gemini'],
    provider: 'google',
    defaultModel: 'gemini-3-pro',
    avatar: '/avatars/gemini.png',
    roleDescription: '视觉设计师',
    personality: '活泼有创意',
  },
];

describe('chat input mention option labels', () => {
  it('uses official 暹罗猫 label/insert for gemini option', () => {
    const options = buildCatOptions(FAKE_CATS);
    const geminiOption = options.find((opt) => opt.id === 'gemini');
    expect(geminiOption).toBeDefined();
    expect(geminiOption?.label).toBe('@暹罗猫');
    expect(geminiOption?.insert).toBe('@暹罗 ');
  });
});
