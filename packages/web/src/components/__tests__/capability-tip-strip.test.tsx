import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordCapabilityTipEvent } from '@/lib/capabilityTipEvents';
import { useConciergeStore } from '@/stores/conciergeStore';
import { CapabilityTipStrip } from '../CapabilityTipStrip';

vi.mock('@/lib/capabilityTipEvents', async () => ({
  recordCapabilityTipEvent: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

async function render(jsx: React.ReactNode) {
  await act(async () => {
    root.render(jsx);
    await Promise.resolve();
  });
}

describe('F244 CapabilityTipStrip', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useConciergeStore.setState({
      surfaceState: 'collapsed',
      pendingPrompt: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('delays the first visible tip', async () => {
    await render(
      <CapabilityTipStrip
        surface="thread_execution_bar"
        contexts={['thinking']}
        firstDelayMs={6000}
        rotateMs={12000}
      />,
    );
    expect(container.querySelector('[data-testid="capability-tip-strip"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(container.querySelector('[data-testid="capability-tip-strip"]')).not.toBeNull();
  });

  it('does not default omitted audience to all-only tips', async () => {
    await render(
      <CapabilityTipStrip surface="thread_execution_bar" contexts={['review']} firstDelayMs={0} rotateMs={12000} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="capability-tip-strip"]')?.getAttribute('data-tip-id')).toBe(
      'capability-cli-diagnostics',
    );
  });

  it('records the context that matched the selected tip', async () => {
    const recordCapabilityTipEventMock = vi.mocked(recordCapabilityTipEvent);

    await render(
      <CapabilityTipStrip
        surface="thread_execution_bar"
        contexts={['pet_waiting_for_user', 'long_running']}
        firstDelayMs={0}
        rotateMs={12000}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(recordCapabilityTipEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'capability_tip_exposed',
        context: 'long_running',
      }),
    );

    const button = container.querySelector('[data-testid="capability-tip-learn-more"]') as HTMLButtonElement | null;
    act(() => {
      button?.click();
    });

    expect(recordCapabilityTipEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'capability_tip_action',
        context: 'long_running',
      }),
    );
  });

  it('clicking learn more opens concierge bubble with a draft and does not send', async () => {
    await render(
      <CapabilityTipStrip surface="thread_execution_bar" contexts={['thinking']} firstDelayMs={0} rotateMs={12000} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const button = container.querySelector('[data-testid="capability-tip-learn-more"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.getAttribute('title')).toContain('不会自动发送');

    act(() => {
      button?.click();
    });

    const state = useConciergeStore.getState();
    expect(state.surfaceState).toBe('bubble');
    expect(state.pendingPrompt).toContain('解释这个 tip');
    expect(state.pendingPrompt).toContain('tipId');
  });
});
