import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { MarkdownContent } from '@/components/MarkdownContent';

Object.assign(globalThis as Record<string, unknown>, { React });

function render(content: string): string {
  return renderToStaticMarkup(React.createElement(MarkdownContent, { content }));
}

describe('MarkdownContent mention highlighting', () => {
  it('highlights nickname and english-alias mentions with cat colors', () => {
    const html = render('@砚砚 请看下，@宪宪 也看下，@siamese 收尾');
    expect(html).toContain('text-codex-primary');
    expect(html).toContain('text-opus-primary');
    expect(html).toContain('text-gemini-primary');
  });
});
