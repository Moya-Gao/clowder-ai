/**
 * F108 Scene 2: WhisperCatSelector unit tests.
 * Verifies design spec compliance: name format, status badges, selection, disabled state.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhisperCatSelector } from '@/components/WhisperCatSelector';
import type { CatData } from '@/hooks/useCatData';

const MOCK_CATS: CatData[] = [
  {
    id: 'opus',
    displayName: '宪宪',
    nickname: '宪宪',
    breedDisplayName: '布偶猫',
    color: { primary: '#9B7EBD', secondary: '#E8D5F5' },
    mentionPatterns: ['opus'],
    provider: 'anthropic',
    defaultModel: 'opus',
    avatar: '/a.png',
    roleDescription: 'dev',
    personality: 'kind',
    source: 'seed' as const,
  },
  {
    id: 'codex',
    displayName: '砚砚',
    nickname: '砚砚',
    breedDisplayName: '缅因猫',
    color: { primary: '#4A90D9', secondary: '#B8D4F0' },
    mentionPatterns: ['codex'],
    provider: 'openai',
    defaultModel: 'codex',
    avatar: '/b.png',
    roleDescription: 'review',
    personality: 'strict',
    source: 'seed' as const,
  },
  {
    id: 'gemini',
    displayName: '烁烁',
    nickname: '烁烁',
    breedDisplayName: '暹罗猫',
    color: { primary: '#E67E22', secondary: '#FAD7A0' },
    mentionPatterns: ['gemini'],
    provider: 'google',
    defaultModel: 'gemini',
    avatar: '/c.png',
    roleDescription: 'design',
    personality: 'creative',
    source: 'seed' as const,
  },
];

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderSelector(overrides: Partial<React.ComponentProps<typeof WhisperCatSelector>> = {}) {
  const props = {
    cats: MOCK_CATS,
    selected: new Set<string>(),
    activeCatIds: new Set<string>(),
    onToggle: vi.fn(),
    ...overrides,
  };
  act(() => {
    root.render(React.createElement(WhisperCatSelector, props));
  });
  return props;
}

describe('WhisperCatSelector', () => {
  it('renders "品种 · 昵称" name format from design spec', () => {
    renderSelector();
    expect(container.textContent).toContain('布偶猫 · 宪宪');
    expect(container.textContent).toContain('缅因猫 · 砚砚');
    expect(container.textContent).toContain('暹罗猫 · 烁烁');
  });

  it('shows "选择悄悄话目标：" header', () => {
    renderSelector();
    expect(container.textContent).toContain('选择悄悄话目标');
  });

  it('shows status badges: 空闲 for idle cats, 执行中 for active cats', () => {
    renderSelector({ activeCatIds: new Set(['opus']) });
    const rows = [...container.querySelectorAll('button')].filter((b) => b.className.includes('rounded-lg'));

    const opusRow = rows.find((b) => b.textContent?.includes('布偶猫 · 宪宪'));
    const codexRow = rows.find((b) => b.textContent?.includes('缅因猫 · 砚砚'));

    expect(opusRow?.textContent).toContain('执行中');
    expect(codexRow?.textContent).toContain('空闲');
  });

  it('disables active cats — click does not trigger onToggle', () => {
    const { onToggle } = renderSelector({ activeCatIds: new Set(['opus']) });
    const rows = [...container.querySelectorAll('button')].filter((b) => b.className.includes('rounded-lg'));
    const opusRow = rows.find((b) => b.textContent?.includes('布偶猫 · 宪宪'));

    act(() => opusRow?.click());
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('calls onToggle when clicking an idle cat', () => {
    const { onToggle } = renderSelector();
    const rows = [...container.querySelectorAll('button')].filter((b) => b.className.includes('rounded-lg'));
    const codexRow = rows.find((b) => b.textContent?.includes('缅因猫 · 砚砚'));

    act(() => codexRow?.click());
    expect(onToggle).toHaveBeenCalledWith('codex');
  });

  it('shows ring highlight on selected cats', () => {
    renderSelector({ selected: new Set(['codex']) });
    const rows = [...container.querySelectorAll('button')].filter((b) => b.className.includes('rounded-lg'));
    const codexRow = rows.find((b) => b.textContent?.includes('缅因猫 · 砚砚'));
    const opusRow = rows.find((b) => b.textContent?.includes('布偶猫 · 宪宪'));

    expect(codexRow?.className).toContain('ring-amber-200');
    expect(opusRow?.className).not.toContain('ring-amber-200');
  });

  it('shows "请至少选一只猫猫" when no cat selected', () => {
    renderSelector({ selected: new Set() });
    expect(container.textContent).toContain('请至少选一只猫猫');
  });

  it('hides empty-selection warning when a cat is selected', () => {
    renderSelector({ selected: new Set(['codex']) });
    expect(container.textContent).not.toContain('请至少选一只猫猫');
  });

  it('falls back to displayName when breedDisplayName is absent', () => {
    const catWithoutBreed = { ...MOCK_CATS[0], breedDisplayName: undefined };
    renderSelector({ cats: [catWithoutBreed] });
    // Should show displayName instead of "品种 · 昵称"
    expect(container.textContent).toContain('宪宪');
    expect(container.textContent).not.toContain('布偶猫 · 宪宪');
  });
});
