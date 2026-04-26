/**
 * F174 D2b-2 (rev2) — callback-auth failure badge merged into HubButton.
 *
 * Replaces the standalone CallbackAuthHealthIndicator (rev1, PR #1410) which
 * was rejected by 铲屎官 alpha 验收 ("top 栏位置宝贵, plug 图标冗余").
 *
 * Behavior matrix:
 *   isAvailable=false                 → no badge (zero pollution)
 *   24h totalFailures = 0             → no badge (top-bar visual zero increment)
 *   24h totalFailures 1-5             → amber badge with count
 *   24h totalFailures >= 6            → red badge with count
 *   total > 99                        → "99+" cap
 *
 * Click semantics:
 *   no badge  → openHub()  (default, no args)
 *   has badge → openHub('observability', 'callback-auth') (deep-link to source)
 */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let mockAvailable = false;
let mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
let mockOpenHub: (tab?: string, subTab?: string) => void = () => {};

vi.mock('@/stores/callbackAuthStore', () => ({
  useCallbackAuthAvailable: () => mockAvailable,
  useCallbackAuthAggregate: () => mockAggregate,
}));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (s: { openHub: (tab?: string, subTab?: string) => void }) => unknown) =>
    selector({ openHub: mockOpenHub }),
}));

import { HubButton } from '../HubButton';

Object.assign(globalThis as Record<string, unknown>, { React });

describe('HubButton — F174 D2b-2 (rev2) callback-auth failure badge', () => {
  it('renders without badge when snapshot is unavailable (non-owner)', () => {
    mockAvailable = false;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('data-testid="hub-button"');
    expect(html).not.toContain('data-testid="hub-button-callback-auth-badge"');
    expect(html).not.toContain('data-callback-auth-failures');
  });

  it('renders without badge when available + 0 failures (top-bar visual zero increment)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('data-testid="hub-button"');
    expect(html).not.toContain('data-testid="hub-button-callback-auth-badge"');
    expect(html).not.toContain('data-callback-auth-failures');
  });

  it('renders amber badge when 1-5 failures (degraded)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 3, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('data-testid="hub-button-callback-auth-badge"');
    expect(html).toContain('data-callback-auth-failures="3"');
    expect(html.toUpperCase()).toContain('#F59E0B'); // amber
    expect(html).toContain('>3<');
    // Tooltip is factual — no overclaim of healthy from failure-only counter
    expect(html).toContain('24h 3 次失败');
  });

  it('renders red badge when >= 6 failures (broken)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 12, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('data-callback-auth-failures="12"');
    expect(html.toUpperCase()).toContain('#EF4444'); // red
    expect(html).toContain('>12<');
  });

  it('caps badge text at "99+" for very high counts', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 250, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('99+');
    expect(html).toContain('data-callback-auth-failures="250"'); // raw count preserved in attr
  });

  it('uses no emoji in icon (铲屎官 instruction: SVG only)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<HubButton />);
    expect(html).toContain('<svg'); // SVG element
    expect(html).not.toContain('🔌'); // no plug emoji
    expect(html).not.toContain('⚙️'); // no gear emoji
  });

  it('click without badge calls openHub() with no args (default Hub)', async () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const calls: Array<[string?, string?]> = [];
    mockOpenHub = (tab, subTab) => {
      calls.push([tab, subTab]);
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<HubButton />);
    });

    const button = container.querySelector('[data-testid="hub-button"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(calls).toEqual([[undefined, undefined]]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    mockOpenHub = () => {};
  });

  it('click with badge calls openHub("observability", "callback-auth") — deep-link to source', async () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 7, topReasons: [], topTools: [] };
    const calls: Array<[string?, string?]> = [];
    mockOpenHub = (tab, subTab) => {
      calls.push([tab, subTab]);
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<HubButton />);
    });

    const button = container.querySelector('[data-testid="hub-button"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(calls).toEqual([['observability', 'callback-auth']]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    mockOpenHub = () => {};
  });
});
