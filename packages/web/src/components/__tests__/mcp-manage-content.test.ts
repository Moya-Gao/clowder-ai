import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_ITEMS = [
  {
    id: 'pencil',
    type: 'mcp' as const,
    source: 'cat-cafe' as const,
    enabled: true,
    cats: {},
    description: 'Pencil design tool',
    layer: 'L1' as const,
  },
  {
    id: 'custom-mcp',
    type: 'mcp' as const,
    source: 'external' as const,
    enabled: true,
    cats: { opus: true },
    description: 'External MCP',
    layer: 'L1' as const,
  },
  {
    id: 'cross-cat-handoff',
    type: 'skill' as const,
    source: 'cat-cafe' as const,
    enabled: true,
    cats: { opus: true },
    description: 'Should stay hidden on the MCP settings page',
    layer: 'L2' as const,
  },
];

const ITEMS_RESPONSE = {
  ok: true,
  json: async () => ({
    items: MOCK_ITEMS,
    catFamilies: [{ id: 'ragdoll', name: 'Ragdoll', catIds: ['opus'] }],
    projectPath: '/test/project',
    skillHealth: null,
  }),
};

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ threads: [] }),
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/utils/api-client';
import { McpManageContent } from '../settings/McpManageContent';

describe('McpManageContent', () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockFetch = apiFetch as ReturnType<typeof vi.fn>;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(ITEMS_RESPONSE);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders MCP cards without leaking skill sections', async () => {
    await act(async () => {
      root.render(React.createElement(McpManageContent));
    });

    expect(container.textContent).toContain('pencil');
    expect(container.textContent).toContain('custom-mcp');
    expect(container.textContent).not.toContain('cross-cat-handoff');
    expect(container.textContent).toContain('共 2 项');
  });

  it('requests probed capability data for MCP status and tools', async () => {
    await act(async () => {
      root.render(React.createElement(McpManageContent));
    });

    expect(mockFetch.mock.calls[0][0]).toBe('/api/capabilities?probe=true');
  });

  it('keeps existing external MCP soft-delete behavior', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      root.render(React.createElement(McpManageContent));
    });

    const trashButtons = Array.from(container.querySelectorAll('button[title="禁用此 MCP"]'));
    expect(trashButtons.length).toBe(1);

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce(ITEMS_RESPONSE);

    await act(async () => {
      (trashButtons[0] as HTMLButtonElement).click();
    });

    const deleteCalls = mockFetch.mock.calls.filter(
      (args: unknown[]) => (args[1] as { method?: string } | undefined)?.method === 'DELETE',
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0][0]).toContain('/api/capabilities/mcp/custom-mcp?');
    expect(deleteCalls[0][0]).not.toContain('hard=true');

    confirmSpy.mockRestore();
  });
});
