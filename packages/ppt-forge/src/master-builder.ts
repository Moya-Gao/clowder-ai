import type { ThemeTokens } from './types.js';

export const MASTER_NAMES = {
  COVER: 'MASTER_COVER',
  SECTION: 'MASTER_SECTION',
  CONTENT: 'MASTER_CONTENT',
  CLOSING: 'MASTER_CLOSING',
} as const;

interface PptxPresentation {
  defineSlideMaster(opts: Record<string, unknown>): void;
}

/**
 * Register slide masters from theme tokens into pptxgenjs presentation.
 * Masters include brand-consistent decorative elements:
 * - Content: top red accent line + left red indicator bar + slide number
 * - Section: red navigation bar (华为-style section break)
 * - Cover: full brand-primary background
 * - Closing: top red accent line + slide number
 */
export function buildSlideMasters(pres: PptxPresentation, theme: ThemeTokens): void {
  const primary = theme.brand.colors.primary;
  const fontFace = theme.brand.typography.cjkFont;
  const snColor = theme.slideNumber?.color ?? '8C8C8C';
  const snSize = theme.slideNumber?.fontSize ?? 10;

  // Cover: full brand-primary background, no additional chrome
  pres.defineSlideMaster({
    title: MASTER_NAMES.COVER,
    background: { color: theme.slide.cover.bg },
  });

  // Section: white bg + thick red nav bar at top (华为 section break signature)
  pres.defineSlideMaster({
    title: MASTER_NAMES.SECTION,
    background: { color: theme.slide.section.bg },
    objects: [{ rect: { x: 0, y: 0, w: 10, h: 1.02, fill: { color: primary } } }],
  });

  // Content: white bg + top red accent line + red indicator bar + slide number
  pres.defineSlideMaster({
    title: MASTER_NAMES.CONTENT,
    background: { color: theme.slide.content.bg },
    objects: [
      { rect: { x: 0, y: 0, w: 10, h: 0.01, fill: { color: primary } } },
      { rect: { x: 0.25, y: 0.2, w: 0.031, h: 0.234, fill: { color: primary } } },
    ],
    slideNumber: { x: '95%', y: '95%', color: snColor, fontSize: snSize, fontFace },
  });

  // Closing: white bg + top red accent line + slide number
  pres.defineSlideMaster({
    title: MASTER_NAMES.CLOSING,
    background: { color: theme.slide.closing.bg },
    objects: [{ rect: { x: 0, y: 0, w: 10, h: 0.01, fill: { color: primary } } }],
    slideNumber: { x: '95%', y: '95%', color: snColor, fontSize: snSize, fontFace },
  });
}

/** Map slide intent to master name */
export function intentToMaster(intent: string): string {
  switch (intent) {
    case 'cover':
      return MASTER_NAMES.COVER;
    case 'section-break':
      return MASTER_NAMES.SECTION;
    case 'closing':
      return MASTER_NAMES.CLOSING;
    default:
      return MASTER_NAMES.CONTENT;
  }
}
