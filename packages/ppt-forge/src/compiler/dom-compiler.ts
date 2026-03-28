/**
 * F144 Phase B — DOM Semantic Compiler
 *
 * Converts EvaluatedNode[] (px coordinates from Playwright) to
 * CompiledSlide (inch coordinates for pptxgenjs).
 *
 * Core transformation: px ÷ PX_PER_INCH (128) = inches.
 * Colors: rgb(r,g,b) → 6-char hex (no #).
 */

import { intentToMaster } from '../master-builder.js';
import type { SlideSpec } from '../types.js';
import type { EvaluatedNode } from './layout-evaluator.js';
import type { ChartData, CompiledElement, CompiledSlide, CompiledStyle, TextRun } from './types.js';
import { PX_PER_INCH } from './types.js';

/** Convert rgb(r,g,b) or rgba(r,g,b,a) to 6-char hex. Returns empty string for transparent. */
function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '';
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return [r, g, b].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/** Extract the primary font family name from a CSS fontFamily string. */
function extractFontFamily(fontFamily: string): string {
  // Take the first quoted or unquoted name
  const match = fontFamily.match(/"([^"]+)"|'([^']+)'|([^,\s]+)/);
  if (match) return match[1] ?? match[2] ?? match[3];
  return fontFamily;
}

function compileNode(node: EvaluatedNode): CompiledElement {
  const rect = {
    x: node.rect.x / PX_PER_INCH,
    y: node.rect.y / PX_PER_INCH,
    w: node.rect.w / PX_PER_INCH,
    h: node.rect.h / PX_PER_INCH,
  };

  const style: CompiledStyle = {
    fill: rgbToHex(node.computedStyle.backgroundColor) || undefined,
    borderColor: node.computedStyle.borderWidth > 0 ? rgbToHex(node.computedStyle.borderColor) || undefined : undefined,
    borderWidth: node.computedStyle.borderWidth > 0 ? node.computedStyle.borderWidth : undefined,
    borderRadius: node.computedStyle.borderRadius > 0 ? node.computedStyle.borderRadius : undefined,
  };

  const children = node.children.length > 0 ? node.children.map((c) => compileNode(c)) : undefined;

  switch (node.role) {
    case 'text': {
      const runs: TextRun[] = [
        {
          text: node.textContent ?? '',
          fontSize: node.computedStyle.fontSize,
          fontFamily: extractFontFamily(node.computedStyle.fontFamily),
          color: rgbToHex(node.computedStyle.color) || '000000',
        },
      ];
      return { role: 'text', rect, content: { type: 'text', runs }, style, children };
    }
    case 'shape': {
      const text = (node.textContent ?? '').trim();
      const runs: TextRun[] = text
        ? [
            {
              text,
              fontSize: node.computedStyle.fontSize,
              fontFamily: extractFontFamily(node.computedStyle.fontFamily),
              color: rgbToHex(node.computedStyle.color) || '000000',
            },
          ]
        : [];
      return {
        role: 'shape',
        rect,
        content: {
          type: 'shape',
          shapeType: 'roundRect',
          fill: style.fill ?? 'FFFFFF',
          runs: runs.length > 0 ? runs : undefined,
        },
        style,
        children,
      };
    }
    case 'group': {
      return { role: 'group', rect, content: { type: 'group' }, style, children };
    }
    case 'table': {
      const td = node.tableData;
      if (td) {
        return {
          role: 'table',
          rect,
          content: {
            type: 'table',
            headers: td.headers,
            rows: td.rows.map((r) => ({
              cells: r.cells.map((c) => {
                if (typeof c === 'string') return { text: c };
                return {
                  text: c.text,
                  bgColor: c.bgColor ? rgbToHex(c.bgColor) || undefined : undefined,
                  fontColor: c.fontColor ? rgbToHex(c.fontColor) || undefined : undefined,
                  bold: c.bold,
                };
              }),
            })),
          },
          style,
          children,
        };
      }
      return { role: 'table', rect, content: { type: 'table', headers: [], rows: [] }, style, children };
    }
    case 'chart': {
      const cd = node.chartData;
      return {
        role: 'chart',
        rect,
        content: { type: 'chart', chartType: cd?.chartType ?? 'bar', data: (cd?.data ?? { series: [] }) as ChartData },
        style,
        children,
      };
    }
    default: {
      return { role: node.role as CompiledElement['role'], rect, content: { type: 'group' }, style, children };
    }
  }
}

/** Recursively collect all font families used in a CompiledElement tree. */
function collectFonts(elements: CompiledElement[], out: Set<string>): void {
  for (const el of elements) {
    if (el.content.type === 'text') {
      for (const run of el.content.runs) {
        if (run.fontFamily) out.add(run.fontFamily);
      }
    }
    if (el.children) collectFonts(el.children, out);
  }
}

/** Compile EvaluatedNode[] (from Playwright) into a CompiledSlide (for pptxgenjs). */
export function compileDom(nodes: EvaluatedNode[], slideSpec: SlideSpec): CompiledSlide {
  const elements = nodes.map((n) => compileNode(n));
  const fontSet = new Set<string>();
  collectFonts(elements, fontSet);

  return {
    slideId: slideSpec.slideId,
    intent: slideSpec.intent,
    masterName: intentToMaster(slideSpec.intent),
    elements,
    speakerNotes: slideSpec.speakerNotes,
    fontsUsed: [...fontSet],
  };
}
