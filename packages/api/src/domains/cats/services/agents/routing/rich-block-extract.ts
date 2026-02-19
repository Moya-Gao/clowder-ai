/**
 * F22: Rich Block Text Extraction (Route B fallback)
 *
 * Extracts ```cc_rich {...}``` blocks from cat response text,
 * parses them as RichBlock arrays, and returns clean text + blocks.
 * Used for cats without MCP (Codex, Gemini) that embed rich blocks in text.
 */

import type { RichBlock } from '@cat-cafe/shared';

const CC_RICH_RE = /```cc_rich\s*\n([\s\S]*?)\n```/g;

/**
 * Validate kind-specific required fields. Rejects malformed blocks that would
 * crash rendering (cloud Codex P1: checklist/media_gallery items must be arrays
 * with correct shape).
 */
export function isValidRichBlock(b: unknown): b is RichBlock {
  if (!b || typeof b !== 'object') return false;
  const obj = b as Record<string, unknown>;
  if (typeof obj['id'] !== 'string' || !obj['id']) return false;
  if (obj['v'] !== 1) return false;
  switch (obj['kind']) {
    case 'card': {
      if (typeof obj['title'] !== 'string') return false;
      if ('bodyMarkdown' in obj && typeof obj['bodyMarkdown'] !== 'string') return false;
      if ('tone' in obj && !['info', 'success', 'warning', 'danger'].includes(obj['tone'] as string)) return false;
      if ('fields' in obj) {
        if (!Array.isArray(obj['fields'])) return false;
        if (!(obj['fields'] as unknown[]).every(
          (f: unknown) => f && typeof f === 'object'
            && typeof (f as Record<string, unknown>)['label'] === 'string'
            && typeof (f as Record<string, unknown>)['value'] === 'string',
        )) return false;
      }
      return true;
    }
    case 'diff': {
      if (typeof obj['filePath'] !== 'string' || typeof obj['diff'] !== 'string') return false;
      if ('languageHint' in obj && typeof obj['languageHint'] !== 'string') return false;
      return true;
    }
    case 'checklist': {
      if ('title' in obj && typeof obj['title'] !== 'string') return false;
      return Array.isArray(obj['items']) && (obj['items'] as unknown[]).every(
        (it: unknown) => {
          if (!it || typeof it !== 'object') return false;
          const r = it as Record<string, unknown>;
          if (typeof r['id'] !== 'string' || typeof r['text'] !== 'string') return false;
          if ('checked' in r && typeof r['checked'] !== 'boolean') return false;
          return true;
        },
      );
    }
    case 'media_gallery': {
      if ('title' in obj && typeof obj['title'] !== 'string') return false;
      return Array.isArray(obj['items']) && (obj['items'] as unknown[]).every(
        (it: unknown) => {
          if (!it || typeof it !== 'object') return false;
          const r = it as Record<string, unknown>;
          if (typeof r['url'] !== 'string') return false;
          if ('alt' in r && typeof r['alt'] !== 'string') return false;
          if ('caption' in r && typeof r['caption'] !== 'string') return false;
          return true;
        },
      );
    }
    default:
      return false;
  }
}

export function extractRichFromText(text: string): {
  cleanText: string;
  blocks: RichBlock[];
} {
  const blocks: RichBlock[] = [];
  const cleanText = text.replace(CC_RICH_RE, (_match, json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.v === 1 && Array.isArray(parsed.blocks)) {
        for (const b of parsed.blocks) {
          if (isValidRichBlock(b)) {
            blocks.push(b);
          }
        }
      }
    } catch { /* Parse failure → ignore, keep as plain text */ }
    return '';
  }).trimEnd();

  return { cleanText, blocks };
}
