import type { LayoutSlot, TableElement, TableStyleTokens } from '../types.js';

interface PptxTableCell {
  text: string;
  options: {
    fill: string;
    color: string;
    fontFace: string;
    fontSize: number;
    bold?: boolean;
    border?: { type: string; color: string; pt: number }[];
  };
}

/**
 * Render a TableElement onto a pptxgenjs slide.
 * Supports per-cell bgColor/fontColor overrides for Huawei status matrix.
 */
export function renderTable(
  slide: { addTable(rows: unknown, options: unknown): void },
  element: TableElement,
  slot: LayoutSlot,
  style: TableStyleTokens,
  fontFace: string,
): void {
  const border = [
    { type: 'solid', color: style.borderColor, pt: 0.5 },
    { type: 'solid', color: style.borderColor, pt: 0.5 },
    { type: 'solid', color: style.borderColor, pt: 0.5 },
    { type: 'solid', color: style.borderColor, pt: 0.5 },
  ];

  // Header row
  const headerRow: PptxTableCell[] = element.headers.map((h) => ({
    text: h,
    options: {
      fill: style.headerBg,
      color: style.headerColor,
      fontFace,
      fontSize: 10,
      bold: true,
      border,
    },
  }));

  // Data rows with alternating bg + per-cell overrides
  const dataRows: PptxTableCell[][] = element.rows.map((row, rowIdx) => {
    const defaultBg = rowIdx % 2 === 0 ? style.rowBg : style.rowAltBg;

    return row.cells.map((cell) => ({
      text: cell.text,
      options: {
        fill: cell.bgColor ?? defaultBg,
        color: cell.fontColor ?? style.rowColor,
        fontFace,
        fontSize: 9,
        bold: cell.fontBold === true ? true : undefined,
        border,
      },
    }));
  });

  const allRows = [headerRow, ...dataRows];

  slide.addTable(allRows, {
    x: slot.position.x,
    y: slot.position.y,
    w: slot.position.w,
    colW: Array(element.headers.length).fill(slot.position.w / element.headers.length),
    rowH: 0.3,
    autoPage: false,
    margin: [2, 4, 2, 4],
  });
}
