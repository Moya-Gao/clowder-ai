/**
 * F174 D2b-2 (rev) — system-level callback-auth health indicator.
 *
 * Replaces the rejected per-cat dot UX (PR #1403 → 铲屎官 alpha 反馈
 * "莫名其妙的颜色"). The indicator lives in the top bar with a plug SVG
 * icon, color-coded badge, and click → D2b-3 deep-dive.
 *
 * Renders:
 *   isAvailable=false                 → null (zero pollution for non-owner)
 *   24h totalFailures = 0             → gray plug, no badge (passive)
 *   24h totalFailures 1-5             → amber plug + badge
 *   24h totalFailures >= 6            → red plug + badge
 *   total > 99                        → "99+" badge text
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

import { CallbackAuthHealthIndicator } from '../CallbackAuthHealthIndicator';

Object.assign(globalThis as Record<string, unknown>, { React });

describe('CallbackAuthHealthIndicator (F174 D2b-2 rev)', () => {
  it('renders nothing when snapshot is unavailable (non-owner)', () => {
    mockAvailable = false;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toBe('');
  });

  it('renders gray plug, no badge, when available + 0 failures (factual tooltip — 砚砚 P2 #1410)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toContain('data-testid="callback-auth-health-indicator"');
    expect(html).toContain('data-callback-auth-level="healthy"');
    expect(html.toUpperCase()).toContain('#A89386'); // cafe-muted gray
    expect(html).not.toContain('data-testid="callback-auth-health-badge"');
    // Factual tooltip — failure-only counter cannot prove "healthy" (same trap
    // as cloud P1 round 7 "absent ≠ healthy").
    expect(html).toContain('24h 无失败记录');
    expect(html).not.toContain('全部健康');
  });

  it('renders amber + badge when 1-5 failures (degraded)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 3, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toContain('data-callback-auth-level="degraded"');
    expect(html.toUpperCase()).toContain('#F59E0B'); // amber
    expect(html).toContain('data-testid="callback-auth-health-badge"');
    expect(html).toContain('>3<');
    expect(html).toContain('3 次失败');
  });

  it('renders red + badge when >= 6 failures (broken)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 12, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toContain('data-callback-auth-level="broken"');
    expect(html.toUpperCase()).toContain('#EF4444'); // red
    expect(html).toContain('>12<');
  });

  it('caps badge text at "99+" for very high counts', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 250, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toContain('99+');
  });

  it('uses plug SVG (not emoji) for the icon (铲屎官 instruction: SVG only)', () => {
    mockAvailable = true;
    mockAggregate = { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] };
    const html = renderToStaticMarkup(<CallbackAuthHealthIndicator />);
    expect(html).toContain('<svg'); // SVG element
    expect(html).not.toContain('🔌'); // no emoji
  });

  it('砚砚 P2 #1410: click invokes openHub("observability", "callback-auth") with exact args', async () => {
    // Core affordance — without this assertion, anyone could refactor the
    // onClick handler and break the deep-link silently.
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
      root.render(<CallbackAuthHealthIndicator />);
    });

    const button = container.querySelector('[data-testid="callback-auth-health-indicator"]') as HTMLButtonElement;
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
