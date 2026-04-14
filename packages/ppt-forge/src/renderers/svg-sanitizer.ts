/**
 * SVG Security Whitelist — AC-C4.
 *
 * Sanitizes SVG strings to only allow the Phase C core subset of elements.
 * Rejects potentially dangerous content: scripts, external references,
 * foreignObject, filters, event handlers.
 *
 * Used by svg-to-shapes before rendering to PPTX, and by the AI-direct
 * SVG path (AC-C6) where untrusted SVG enters the pipeline.
 */

// ── Allowed elements (Phase C core subset) ──────────────────

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'rect',
  'text',
  'tspan',
  'line',
  'circle',
  'ellipse',
  'path',
  'polygon',
  'polyline',
]);

// ── Blocked patterns ────────────────────────────────────────

/** Matches opening/self-closing tags: <tagName ... > or <tagName ... /> */
const TAG_RE = /<(\/?)(\w[\w-]*)\b([^>]*)(\/?)\s*>/g;

/** Event handler attributes (onclick, onload, onerror, etc.) */
const EVENT_HANDLER_RE = /\bon\w+\s*=/gi;

/** External URL references in href/xlink:href (both quote styles, all non-# protocols) */
const EXTERNAL_HREF_RE = /(?:xlink:)?href\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*')/gi;

/** Inline <style> block content */
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

/** XML processing instructions */
const XML_PI_RE = /<\?[\s\S]*?\?>/g;

/** DOCTYPE declarations */
const DOCTYPE_RE = /<!DOCTYPE[^>]*>/gi;

/** CDATA sections */
const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/g;

// ── Public API ──────────────────────────────────────────────

export interface SanitizeResult {
  /** Sanitized SVG string (safe to render) */
  svg: string;
  /** Elements that were stripped */
  stripped: string[];
  /** Whether any content was modified */
  modified: boolean;
}

/**
 * Sanitize an SVG string by stripping all non-whitelisted elements
 * and dangerous attributes.
 */
export function sanitizeSvg(input: string): SanitizeResult {
  const stripped: string[] = [];
  let modified = false;

  // Strip XML processing instructions, DOCTYPE, CDATA
  let svg = input
    .replace(XML_PI_RE, () => {
      modified = true;
      return '';
    })
    .replace(DOCTYPE_RE, () => {
      modified = true;
      return '';
    })
    .replace(CDATA_RE, () => {
      modified = true;
      return '';
    });

  // Strip <style> blocks entirely
  svg = svg.replace(STYLE_BLOCK_RE, () => {
    stripped.push('style');
    modified = true;
    return '';
  });

  // Strip event handler attributes (onclick="...", onload="...", etc.)
  svg = svg.replace(EVENT_HANDLER_RE, () => {
    modified = true;
    return '';
  });

  // Strip external href references (keep internal #id refs)
  svg = svg.replace(EXTERNAL_HREF_RE, () => {
    modified = true;
    return '';
  });

  // Strip non-whitelisted elements (keep content between tags)
  svg = svg.replace(TAG_RE, (match, slash, tagName, attrs, selfClose) => {
    const lower = tagName.toLowerCase();
    if (ALLOWED_ELEMENTS.has(lower)) {
      return match; // keep allowed elements
    }
    if (!stripped.includes(lower)) stripped.push(lower);
    modified = true;
    // For closing tags and self-closing tags, just remove
    // For opening tags, remove the tag but keep inner content
    return '';
  });

  return { svg: svg.trim(), stripped, modified };
}

/**
 * Validate that an SVG string passes the security whitelist.
 * Returns true if the SVG is safe (no modifications needed).
 */
export function isSvgSafe(input: string): boolean {
  return !sanitizeSvg(input).modified;
}
