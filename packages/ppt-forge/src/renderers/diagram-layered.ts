/**
 * Huawei-style layered architecture grid layout.
 * Renders diagrams as rows (left red nav bar) + columns (capability cards with bullet lists).
 * Based on pptx-craft's huawei.md: "左侧垂直导航 + 右侧分层网格布局".
 */
import type { DiagramBox, DiagramStyleTokens } from '../types.js';
import { measureTextWidth } from './diagram-svg.js';

// ── Fallback colors (Huawei defaults, overridden by style tokens) ──
const FALLBACK_ACCENT = 'c7020e';
const FALLBACK_BORDER = 'd9d9d9';
const FALLBACK_BG = 'FFFFFF';
const FALLBACK_TEXT = '333333';

// Layout (inches) — tuned for Huawei-level density (24+ leaves per page)
const NAV_W = 0.55;
const ROW_GAP = 0.02;
const CARD_GAP = 0.02;
const CARD_PAD = 0.04;
const RED_BAR_W = 3 / 72; // 3px left accent bar
const BORDER_W = 1 / 72;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fit(text: string, maxW: number, basePt: number, minPt: number): number {
  let pt = basePt;
  while (pt > minPt && measureTextWidth(text, pt) > maxW) pt -= 0.5;
  return Math.max(pt, minPt);
}

/** 2+ rows, each with 2+ card-groups whose children are all leaves. */
export function isLayeredGrid(boxes: DiagramBox[]): boolean {
  if (boxes.length < 2) return false;
  return boxes.every(
    (r) =>
      r.children &&
      r.children.length >= 2 &&
      r.children.every((c) => !c.children || c.children.every((l) => !l.children?.length)),
  );
}

export function compileLayeredGrid(
  boxes: DiagramBox[],
  w: number,
  h: number,
  style: DiagramStyleTokens,
  fontFace: string,
): string {
  // Resolve style tokens with Huawei fallbacks
  const accent = style.highlightBorder || FALLBACK_ACCENT;
  const borderClr = style.nestedBg?.[2] || FALLBACK_BORDER;
  const cardBg = style.nestedBg?.[0] || FALLBACK_BG;
  const textClr = style.labelColor || FALLBACK_TEXT;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);

  const font = `${esc(fontFace)}, sans-serif`;
  const rowCount = boxes.length;
  const rowH = (h - ROW_GAP * (rowCount - 1)) / rowCount;
  const gridW = w - NAV_W - CARD_GAP;

  let ry = 0;
  for (const row of boxes) {
    // Parse "title — subtitle"
    const di = row.label.indexOf(' — ');
    const title = di >= 0 ? row.label.slice(0, di) : row.label;
    const sub = di >= 0 ? row.label.slice(di + 3) : '';

    // ── Left navigation bar (Huawei red) ──
    out.push(`<rect x="0" y="${ry}" width="${NAV_W}" height="${rowH}" fill="#${accent}" />`);
    const navMaxW = NAV_W - 0.08;
    const tPt = fit(title, navMaxW, 11, 6);
    const tIn = tPt / 72;
    const navCx = NAV_W / 2;
    const titleY = sub ? ry + rowH * 0.38 : ry + rowH * 0.5;
    out.push(
      `<text x="${navCx}" y="${titleY}" data-w="${navMaxW.toFixed(3)}" ` +
        `font-family="${font}" font-size="${tIn}" fill="#FFFFFF" ` +
        `font-weight="bold" text-anchor="middle">${esc(title)}</text>`,
    );
    if (sub) {
      const sPt = fit(sub, navMaxW, 7, 4);
      const sIn = sPt / 72;
      out.push(
        `<text x="${navCx}" y="${titleY + tIn * 1.6}" data-w="${navMaxW.toFixed(3)}" ` +
          `font-family="${font}" font-size="${sIn}" fill="#FFFFFF" ` +
          `text-anchor="middle">${esc(sub)}</text>`,
      );
    }

    // ── Capability cards ──
    const cards = row.children ?? [];
    const cardW = (gridW - CARD_GAP * Math.max(0, cards.length - 1)) / cards.length;
    let cx = NAV_W + CARD_GAP;

    for (const card of cards) {
      // Card background + border
      out.push(
        `<rect x="${cx}" y="${ry}" width="${cardW}" height="${rowH}" ` +
          `fill="#${cardBg}" stroke="#${borderClr}" stroke-width="${BORDER_W}" />`,
      );
      // Left red accent
      out.push(`<rect x="${cx}" y="${ry}" width="${RED_BAR_W}" height="${rowH}" fill="#${accent}" />`);

      const hx = cx + RED_BAR_W + CARD_PAD;
      const hMaxW = cardW - CARD_PAD * 2 - RED_BAR_W;
      const hPt = fit(card.label, hMaxW, 13, 7);
      const hIn = hPt / 72;
      const hy = ry + CARD_PAD + hIn * 0.85;
      out.push(
        `<text x="${hx}" y="${hy}" data-w="${hMaxW.toFixed(3)}" font-family="${font}" ` +
          `font-size="${hIn}" fill="#${textClr}" font-weight="bold" text-anchor="start"` +
          `>${esc(card.label)}</text>`,
      );

      // Separator line (thin rect)
      const sepY = hy + hIn * 0.4;
      out.push(`<rect x="${hx}" y="${sepY}" width="${hMaxW}" height="${BORDER_W}" fill="#${borderClr}" />`);

      // Bullet list (leaf children with optional descriptions)
      const bMaxW = hMaxW - 0.06;
      let by = sepY + CARD_PAD * 0.5;
      for (const bullet of card.children ?? []) {
        const bPt = fit(bullet.label, bMaxW, 10, 6);
        const bIn = bPt / 72;
        const bty = by + bIn * 1.0;
        out.push(
          `<text x="${hx + 0.1}" y="${bty}" data-w="${bMaxW.toFixed(3)}" font-family="${font}" ` +
            `font-size="${bIn}" fill="#${textClr}" font-weight="bold" text-anchor="start"` +
            `>\u2022 ${esc(bullet.label)}</text>`,
        );
        by = bty + bIn * 0.35;
        // Description line (smaller, gray — Huawei auxiliary text)
        if (bullet.description) {
          const dPt = fit(bullet.description, bMaxW, 8, 5);
          const dIn = dPt / 72;
          const dty = by + dIn * 0.7;
          out.push(
            `<text x="${hx + 0.1}" y="${dty}" data-w="${bMaxW.toFixed(3)}" font-family="${font}" ` +
              `font-size="${dIn}" fill="#${style.connectorColor || '8c8c8c'}" text-anchor="start">${esc(bullet.description)}</text>`,
          );
          by = dty + dIn * 0.4;
        } else {
          by += bIn * 0.25;
        }
      }

      cx += cardW + CARD_GAP;
    }

    ry += rowH + ROW_GAP;
  }

  out.push('</svg>');
  return out.join('\n');
}
