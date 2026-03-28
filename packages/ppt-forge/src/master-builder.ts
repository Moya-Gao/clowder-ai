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
 * Each master sets background color — element styling is handled by renderers.
 */
export function buildSlideMasters(
  pres: PptxPresentation,
  theme: ThemeTokens,
): void {
  pres.defineSlideMaster({
    title: MASTER_NAMES.COVER,
    background: { color: theme.slide.cover.bg },
  });

  pres.defineSlideMaster({
    title: MASTER_NAMES.SECTION,
    background: { color: theme.slide.section.bg },
  });

  pres.defineSlideMaster({
    title: MASTER_NAMES.CONTENT,
    background: { color: theme.slide.content.bg },
  });

  pres.defineSlideMaster({
    title: MASTER_NAMES.CLOSING,
    background: { color: theme.slide.closing.bg },
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
