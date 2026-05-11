import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FloatingTranscriptWindow } from '../FloatingTranscriptWindow';

Object.assign(globalThis as Record<string, unknown>, { React });

describe('FloatingTranscriptWindow', () => {
  const sampleLines = [
    { ts: 1715400000, elapsed_s: 10, chunk_num: 1, asr_latency: 0.3, text: '你好世界' },
    { ts: 1715400003, elapsed_s: 13, chunk_num: 2, asr_latency: 0.25, text: '第二句话' },
  ];

  it('renders transcript lines', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={sampleLines} connected={true} recording={false} onClose={() => {}} />,
    );
    expect(html).toContain('你好世界');
    expect(html).toContain('第二句话');
  });

  it('shows recording indicator when active', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow
        lines={[]}
        connected={true}
        recording={true}
        sourceLabel="Google Chrome"
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Google Chrome');
  });

  it('shows empty state when no lines and not recording', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={[]} connected={false} recording={false} onClose={() => {}} />,
    );
    expect(html).toContain('No transcript');
  });

  it('renders minimize button', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={sampleLines} connected={true} recording={false} onClose={() => {}} />,
    );
    expect(html).toContain('Minimize');
  });

  it('renders chunk count in footer', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={sampleLines} connected={true} recording={false} onClose={() => {}} />,
    );
    expect(html).toContain('2 chunks');
  });

  it('shows SSE connection status', () => {
    const htmlConnected = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={[]} connected={true} recording={false} onClose={() => {}} />,
    );
    expect(htmlConnected).toContain('SSE');

    const htmlDisconnected = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={[]} connected={false} recording={false} onClose={() => {}} />,
    );
    expect(htmlDisconnected).toContain('disconnected');
  });

  it('applies tabIndex=-1 to prevent focus stealing', () => {
    const html = renderToStaticMarkup(
      <FloatingTranscriptWindow lines={[]} connected={true} recording={false} onClose={() => {}} />,
    );
    expect(html).toContain('tabindex="-1"');
  });
});
