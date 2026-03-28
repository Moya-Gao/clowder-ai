import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { renderText } from '../../src/renderers/text.js';
import type { LayoutSlot, SlideStyleTokens, TextElement } from '../../src/types.js';

/** Minimal mock that captures addText calls */
function createMockSlide() {
  const calls: { text: unknown; options: unknown }[] = [];
  return {
    addText(text: unknown, options: unknown) {
      calls.push({ text, options });
    },
    calls,
  };
}

const slot: LayoutSlot = {
  name: 'title',
  type: 'title',
  position: { x: 0.5, y: 0.3, w: 9, h: 0.5 },
};

const contentStyle: SlideStyleTokens = {
  bg: 'FFFFFF',
  titleColor: 'CF0A2C',
  titleFontSize: 20,
  bodyColor: '333333',
  bodyFontSize: 12,
};

describe('renderText', () => {
  let mockSlide: ReturnType<typeof createMockSlide>;

  beforeEach(() => {
    mockSlide = createMockSlide();
  });

  it('renders plain text with slot position and theme colors', () => {
    const el: TextElement = {
      type: 'text',
      slotName: 'title',
      content: 'Hello World',
    };
    renderText(mockSlide as never, el, slot, contentStyle, 'Noto Sans SC');
    assert.equal(mockSlide.calls.length, 1);
    const { text, options } = mockSlide.calls[0];
    // text is pptxgenjs TextProps array
    assert.ok(Array.isArray(text));
    assert.equal((options as Record<string, unknown>).x, 0.5);
    assert.equal((options as Record<string, unknown>).y, 0.3);
    assert.equal((options as Record<string, unknown>).w, 9);
    assert.equal((options as Record<string, unknown>).h, 0.5);
  });

  it('applies title slot styling from theme', () => {
    const el: TextElement = {
      type: 'text',
      slotName: 'title',
      content: 'Title',
    };
    renderText(mockSlide as never, el, slot, contentStyle, 'Noto Sans SC');
    const { text } = mockSlide.calls[0];
    const segments = text as { text: string; options: Record<string, unknown> }[];
    assert.equal(segments[0].options.fontFace, 'Noto Sans SC');
    assert.equal(segments[0].options.color, 'CF0A2C');
    assert.equal(segments[0].options.fontSize, 20);
  });

  it('applies body slot styling from theme', () => {
    const bodySlot: LayoutSlot = {
      name: 'body',
      type: 'body',
      position: { x: 0.5, y: 1.0, w: 9, h: 4.2 },
    };
    const el: TextElement = {
      type: 'text',
      slotName: 'body',
      content: 'Body text',
    };
    renderText(mockSlide as never, el, bodySlot, contentStyle, 'Noto Sans SC');
    const { text } = mockSlide.calls[0];
    const segments = text as { text: string; options: Record<string, unknown> }[];
    assert.equal(segments[0].options.color, '333333');
    assert.equal(segments[0].options.fontSize, 12);
  });

  it('parses **bold** markdown into separate segments', () => {
    const el: TextElement = {
      type: 'text',
      slotName: 'title',
      content: 'Hello **World** today',
    };
    renderText(mockSlide as never, el, slot, contentStyle, 'Noto Sans SC');
    const { text } = mockSlide.calls[0];
    const segments = text as { text: string; options: Record<string, unknown> }[];
    assert.equal(segments.length, 3);
    assert.equal(segments[0].text, 'Hello ');
    assert.equal(segments[0].options.bold, undefined);
    assert.equal(segments[1].text, 'World');
    assert.equal(segments[1].options.bold, true);
    assert.equal(segments[2].text, ' today');
  });

  it('respects element-level overrides (fontSize, align)', () => {
    const el: TextElement = {
      type: 'text',
      slotName: 'title',
      content: 'Custom',
      fontSize: 32,
      align: 'center',
      fontWeight: 'bold',
    };
    renderText(mockSlide as never, el, slot, contentStyle, 'Noto Sans SC');
    const { text, options } = mockSlide.calls[0];
    const segments = text as { text: string; options: Record<string, unknown> }[];
    assert.equal(segments[0].options.fontSize, 32);
    assert.equal(segments[0].options.bold, true);
    assert.equal((options as Record<string, unknown>).align, 'center');
  });
});
