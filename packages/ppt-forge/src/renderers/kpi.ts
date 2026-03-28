import type { KPIElement, KPIStyleTokens, LayoutSlot } from '../types.js';

const TREND_ARROWS: Record<string, string> = {
  up: ' ▲',
  down: ' ▼',
  flat: ' ─',
};

function getTrendColor(trend: string, style: KPIStyleTokens): string {
  switch (trend) {
    case 'up': return style.trendUp;
    case 'down': return style.trendDown;
    default: return style.trendFlat;
  }
}

/**
 * Render a KPIElement onto a pptxgenjs slide.
 * Two addText calls: large number (with optional trend arrow) + small label below.
 */
export function renderKPI(
  slide: { addText(text: unknown, options: unknown): void },
  element: KPIElement,
  slot: LayoutSlot,
  style: KPIStyleTokens,
  fontFace: string,
): void {
  // Number row (top ~60% of slot height)
  const numberHeight = slot.position.h * 0.6;
  const labelHeight = slot.position.h * 0.4;

  const numberSegments: { text: string; options: Record<string, unknown> }[] = [
    {
      text: element.number,
      options: {
        fontFace,
        fontSize: style.numberFontSize,
        color: element.trendColor ?? style.numberColor,
        bold: true,
      },
    },
  ];

  if (element.trend) {
    numberSegments.push({
      text: TREND_ARROWS[element.trend] ?? '',
      options: {
        fontFace,
        fontSize: Math.round(style.numberFontSize * 0.6),
        color: getTrendColor(element.trend, style),
        bold: true,
      },
    });
  }

  slide.addText(numberSegments, {
    x: slot.position.x,
    y: slot.position.y,
    w: slot.position.w,
    h: numberHeight,
    align: 'center',
    valign: 'bottom',
    margin: 0,
  });

  // Label row (bottom ~40% of slot height)
  slide.addText(
    [
      {
        text: element.label,
        options: {
          fontFace,
          fontSize: style.labelFontSize,
          color: style.labelColor,
        },
      },
    ],
    {
      x: slot.position.x,
      y: slot.position.y + numberHeight,
      w: slot.position.w,
      h: labelHeight,
      align: 'center',
      valign: 'top',
      margin: 0,
    },
  );
}
