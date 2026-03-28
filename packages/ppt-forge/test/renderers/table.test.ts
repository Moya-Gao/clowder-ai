import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { renderTable } from '../../src/renderers/table.js';
import type { LayoutSlot, TableElement, TableStyleTokens } from '../../src/types.js';

function createMockSlide() {
  const calls: { rows: unknown; options: unknown }[] = [];
  return {
    addTable(rows: unknown, options: unknown) {
      calls.push({ rows, options });
    },
    calls,
  };
}

const slot: LayoutSlot = {
  name: 'table',
  type: 'table',
  position: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
};

const tableStyle: TableStyleTokens = {
  headerBg: 'CF0A2C',
  headerColor: 'FFFFFF',
  rowBg: 'FFFFFF',
  rowAltBg: 'F5F5F5',
  rowColor: '333333',
  borderColor: 'DDDDDD',
};

describe('renderTable', () => {
  let mockSlide: ReturnType<typeof createMockSlide>;

  beforeEach(() => {
    mockSlide = createMockSlide();
  });

  it('renders header row with theme headerBg (华为红色表头)', () => {
    const el: TableElement = {
      type: 'table',
      slotName: 'table',
      headers: ['项目', '状态', '进度'],
      rows: [{ cells: [{ text: 'A' }, { text: 'OK' }, { text: '80%' }] }],
    };
    renderTable(mockSlide as never, el, slot, tableStyle, 'Noto Sans SC');
    assert.equal(mockSlide.calls.length, 1);
    const rows = mockSlide.calls[0].rows as unknown[][];
    // First row is header
    const headerCell = rows[0][0] as { text: string; options: Record<string, unknown> };
    assert.equal(headerCell.options.fill, 'CF0A2C');
    assert.equal(headerCell.options.color, 'FFFFFF');
    assert.equal(headerCell.options.bold, true);
  });

  it('renders data rows with alternating background', () => {
    const el: TableElement = {
      type: 'table',
      slotName: 'table',
      headers: ['Name'],
      rows: [{ cells: [{ text: 'Row1' }] }, { cells: [{ text: 'Row2' }] }, { cells: [{ text: 'Row3' }] }],
    };
    renderTable(mockSlide as never, el, slot, tableStyle, 'Noto Sans SC');
    const rows = mockSlide.calls[0].rows as unknown[][];
    // rows[0] = header, rows[1..3] = data
    const row1Cell = rows[1][0] as { options: Record<string, unknown> };
    const row2Cell = rows[2][0] as { options: Record<string, unknown> };
    const row3Cell = rows[3][0] as { options: Record<string, unknown> };
    assert.equal(row1Cell.options.fill, 'FFFFFF');
    assert.equal(row2Cell.options.fill, 'F5F5F5');
    assert.equal(row3Cell.options.fill, 'FFFFFF');
  });

  it('applies per-cell bgColor/fontColor overrides (华为状态矩阵)', () => {
    const el: TableElement = {
      type: 'table',
      slotName: 'table',
      headers: ['Task', 'Status'],
      rows: [
        {
          cells: [{ text: 'Deploy' }, { text: '完成', bgColor: '4CAF50', fontColor: 'FFFFFF', fontBold: true }],
        },
        {
          cells: [{ text: 'Test' }, { text: '延期', bgColor: 'CF0A2C', fontColor: 'FFFFFF' }],
        },
      ],
    };
    renderTable(mockSlide as never, el, slot, tableStyle, 'Noto Sans SC');
    const rows = mockSlide.calls[0].rows as unknown[][];
    // rows[1] = first data row
    const statusGreen = rows[1][1] as { options: Record<string, unknown> };
    assert.equal(statusGreen.options.fill, '4CAF50');
    assert.equal(statusGreen.options.color, 'FFFFFF');
    assert.equal(statusGreen.options.bold, true);

    const statusRed = rows[2][1] as { options: Record<string, unknown> };
    assert.equal(statusRed.options.fill, 'CF0A2C');
    assert.equal(statusRed.options.color, 'FFFFFF');
  });

  it('sets table position from slot and border from theme', () => {
    const el: TableElement = {
      type: 'table',
      slotName: 'table',
      headers: ['A'],
      rows: [{ cells: [{ text: 'B' }] }],
    };
    renderTable(mockSlide as never, el, slot, tableStyle, 'Noto Sans SC');
    const opts = mockSlide.calls[0].options as Record<string, unknown>;
    assert.equal(opts.x, 0.3);
    assert.equal(opts.y, 0.9);
    assert.equal(opts.w, 9.4);
  });
});
