import type { TextElement, SlideStyleTokens, LayoutSlot } from '../types.js';

interface TextSegment {
  text: string;
  options: {
    fontFace: string;
    fontSize: number;
    color: string;
    bold?: boolean;
  };
}

/** Parse simple **bold** markdown into pptxgenjs TextProps segments */
function parseMarkdownBold(
  content: string,
  baseOpts: { fontFace: string; fontSize: number; color: string; bold?: boolean },
): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: content.slice(lastIndex, match.index),
        options: { ...baseOpts },
      });
    }
    segments.push({
      text: match[1],
      options: { ...baseOpts, bold: true },
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      text: content.slice(lastIndex),
      options: { ...baseOpts },
    });
  }

  if (segments.length === 0) {
    segments.push({ text: content, options: { ...baseOpts } });
  }

  return segments;
}

/** Resolve color + fontSize from theme based on slot type */
function resolveSlotStyle(
  slotType: LayoutSlot['type'],
  style: SlideStyleTokens,
): { color: string; fontSize: number } {
  switch (slotType) {
    case 'title':
      return { color: style.titleColor, fontSize: style.titleFontSize };
    case 'subtitle':
      return {
        color: style.subtitleColor ?? style.titleColor,
        fontSize: style.subtitleFontSize ?? style.titleFontSize - 4,
      };
    case 'caption':
      return {
        color: style.labelColor ?? style.bodyColor ?? '666666',
        fontSize: style.labelFontSize ?? 11,
      };
    default:
      return {
        color: style.bodyColor ?? '333333',
        fontSize: style.bodyFontSize ?? 12,
      };
  }
}

/**
 * Render a TextElement onto a pptxgenjs slide.
 * Supports **bold** markdown, theme-driven colors, and element-level overrides.
 */
export function renderText(
  slide: { addText(text: unknown, options: unknown): void },
  element: TextElement,
  slot: LayoutSlot,
  style: SlideStyleTokens,
  fontFace: string,
): void {
  const { color, fontSize } = resolveSlotStyle(slot.type, style);

  const baseOpts = {
    fontFace,
    fontSize: element.fontSize ?? fontSize,
    color,
    bold: element.fontWeight === 'bold' ? true : undefined,
  };

  const segments = parseMarkdownBold(element.content, baseOpts);

  slide.addText(segments, {
    x: slot.position.x,
    y: slot.position.y,
    w: slot.position.w,
    h: slot.position.h,
    align: element.align,
    valign: 'top',
    margin: 0,
  });
}
