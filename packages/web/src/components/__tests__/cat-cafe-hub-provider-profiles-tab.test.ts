import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const storeState = {
  hubState: { open: true, tab: 'provider-profiles' },
  closeHub: () => {},
  threads: [],
  currentThreadId: 'thread-active',
  catInvocations: {},
  threadStates: {},
};

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => ({
    cats: [
      {
        id: 'opus',
        displayName: '布偶猫',
        nickname: '宪宪',
        color: { primary: '#9B7EBD', secondary: '#E8D5F5' },
        mentionPatterns: ['@opus'],
        provider: 'anthropic',
        defaultModel: 'claude-opus-4-6',
        avatar: '/avatars/opus.png',
        roleDescription: '架构',
        personality: '稳重',
      },
    ],
    isLoading: false,
    getCatById: () => undefined,
    getCatsByBreed: () => new Map(),
  }),
  formatCatName: (cat: { displayName: string; variantLabel?: string }) =>
    cat.variantLabel ? `${cat.displayName}（${cat.variantLabel}）` : cat.displayName,
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
}));

import { CatCafeHub } from '@/components/CatCafeHub';
import { HubProviderProfilesTab } from '@/components/HubProviderProfilesTab';

describe('CatCafeHub provider profiles tab', () => {
  it('renders provider profiles tab label', () => {
    const html = renderToStaticMarkup(React.createElement(CatCafeHub));
    expect(html).toContain('账号配置');
  });

  it('renders provider profiles tab initial loading state', () => {
    const html = renderToStaticMarkup(React.createElement(HubProviderProfilesTab));
    expect(html).toContain('加载中');
  });
});
