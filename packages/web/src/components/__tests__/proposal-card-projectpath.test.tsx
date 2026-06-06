/**
 * F128 ProposalCard — projectPath ownership (砚砚 review P1-1).
 *
 * The backend card block surfaces a 项目归属 field and the approve route accepts a projectPath
 * override, but neither is usable unless the card renders the field + submits the input. These
 * tests pin: (1) the ownership is visible, (2) editing + approve sends projectPath, (3) the
 * default-notice string is NOT prefilled into the editable input (only a real path is).
 *
 * Split from proposal-card.test.tsx to keep each file under the AC-X1 350-line cap.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => React.createElement('p', null, content),
}));

const apiFetchMock = vi.fn();
vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('@/components/ThreadSidebar/thread-navigation', () => ({
  pushThreadRouteWithHistory: vi.fn(),
}));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: { getState: () => ({ updateThreadPin: vi.fn() }) },
}));

import { ProposalCard } from '@/components/rich/ProposalCard';
import type { RichCardBlock } from '@/stores/chat-types';

const PROPOSAL_ID = 'proposal_pp123';
const DEFAULT_NOTICE = '未指定（default · 子 thread 无项目归属，cat 会回落运行时默认目录）';

function makeBlock(ownership: string): RichCardBlock {
  return {
    id: `proposal-${PROPOSAL_ID}`,
    kind: 'card',
    v: 1,
    title: `📥 提议新建 thread：projectPath`,
    bodyMarkdown: 'body',
    tone: 'info',
    fields: [
      { label: '父 Thread', value: 'thread_parent' },
      { label: '建议成员', value: '（未指定）' },
      { label: '项目归属', value: ownership },
    ],
    actions: [
      { label: '批准并创建', action: 'propose:approve', payload: { proposalId: PROPOSAL_ID } },
      { label: '驳回', action: 'propose:reject', payload: { proposalId: PROPOSAL_ID } },
    ],
  };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('ProposalCard — projectPath ownership', () => {
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
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(() => Promise.resolve(jsonResponse(404, { error: 'not found' })));
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(block: RichCardBlock) {
    await act(async () => {
      root.render(React.createElement(ProposalCard, { block }));
    });
  }

  function findButton(label: string): HTMLButtonElement {
    const button = [...container.querySelectorAll('button')].find((n) => n.textContent?.includes(label));
    if (!button) throw new Error(`Missing button: ${label}`);
    return button as HTMLButtonElement;
  }

  // Find the text input whose enclosing <label> mentions the given field name.
  function findInputByLabel(labelText: string): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(labelText));
    const input = label?.querySelector('input[type="text"]') as HTMLInputElement | null;
    if (!input) throw new Error(`Missing input for label: ${labelText}`);
    return input;
  }

  function setInput(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('surfaces the project ownership in the card (AC-Z4 visibility)', async () => {
    await render(makeBlock('/Users/me/projects/clowder-ai'));
    expect(container.textContent).toContain('项目归属');
    expect(container.textContent).toContain('/Users/me/projects/clowder-ai');
  });

  it('shows the default-ownership notice when the child has no project', async () => {
    await render(makeBlock(DEFAULT_NOTICE));
    expect(container.textContent).toContain(DEFAULT_NOTICE);
  });

  it('edit + approve sends the projectPath override in the approve body (AC-Z2 re-home)', async () => {
    await render(makeBlock(DEFAULT_NOTICE));
    await act(async () => {
      findButton('编辑').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Default notice must NOT be prefilled into the editable input — only a real path is.
    const ppInput = findInputByLabel('项目归属');
    expect(ppInput.value).toBe('');
    await act(async () => {
      setInput(ppInput, '/Users/me/projects/clowder-ai');
    });
    apiFetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { proposalId: PROPOSAL_ID, threadId: 'thread_rehomed', status: 'approved' })),
    );
    await act(async () => {
      findButton('批准（含编辑）').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const approveCall = apiFetchMock.mock.calls.find(([url]) => String(url).endsWith('/approve'));
    expect(approveCall).toBeTruthy();
    const sentBody = JSON.parse((approveCall![1] as { body: string }).body);
    expect(sentBody.projectPath).toBe('/Users/me/projects/clowder-ai');
  });

  it('prefills a real project path into the editable input', async () => {
    await render(makeBlock('/Users/me/projects/repo'));
    await act(async () => {
      findButton('编辑').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findInputByLabel('项目归属').value).toBe('/Users/me/projects/repo');
  });
});
