import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  CompiledContent,
  CompiledDeck,
  CompiledElement,
  CompiledSlide,
  CompiledStyle,
  CompiledTableRow,
  PptRole,
  TextRun,
} from '../../src/compiler/types.js';

/**
 * Types are compile-time only — these tests verify:
 * 1. The module compiles and resolves (import succeeds)
 * 2. Objects conforming to the terminal schema type-check correctly
 * 3. PX_PER_INCH constant is exported and correct
 */
describe('compiler/types — terminal schema', () => {
  it('exports PX_PER_INCH = 128 (1280px viewport ÷ 10 inches)', async () => {
    const { PX_PER_INCH } = await import('../../src/compiler/types.js');
    assert.equal(PX_PER_INCH, 128);
  });

  it('text CompiledElement satisfies the interface contract', () => {
    const el: CompiledElement = {
      role: 'text',
      rect: { x: 1, y: 0.5, w: 8, h: 1.5 },
      content: {
        type: 'text',
        runs: [{ text: 'Hello', fontSize: 24, fontFamily: 'PingFang SC', color: '333333' }],
      },
      style: { fill: 'FFFFFF' },
    };
    assert.equal(el.role, 'text');
    assert.equal(el.rect.w, 8);
    assert.equal((el.content as { type: 'text'; runs: TextRun[] }).runs[0].text, 'Hello');
  });

  it('shape CompiledElement with border style', () => {
    const shape: CompiledElement = {
      role: 'shape',
      rect: { x: 0.3, y: 0.9, w: 2, h: 1 },
      content: { type: 'shape', shapeType: 'roundRect', fill: 'CF0A2C' },
      style: { fill: 'CF0A2C', borderColor: '999999', borderWidth: 1.2, borderRadius: 4 },
    };
    assert.equal(shape.style.borderRadius, 4);
  });

  it('group CompiledElement nests children', () => {
    const group: CompiledElement = {
      role: 'group',
      rect: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
      content: { type: 'group' },
      style: { fill: 'FAFAFA' },
      children: [
        {
          role: 'text',
          rect: { x: 0.3, y: 0.9, w: 2, h: 0.3 },
          content: { type: 'text', runs: [{ text: 'Child', fontSize: 10, fontFamily: 'sans-serif', color: 'FFFFFF' }] },
          style: { fill: 'CF0A2C' },
        },
      ],
    };
    assert.equal(group.children?.length, 1);
  });

  it('table content has headers + rows with cell styling', () => {
    const table: CompiledElement = {
      role: 'table',
      rect: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
      content: {
        type: 'table',
        headers: ['Feature', 'Status'],
        rows: [{ cells: [{ text: 'Auth', bgColor: 'E8F5E9' }, { text: 'Done' }] }],
      },
      style: {},
    };
    const tc = table.content as { type: 'table'; headers: string[]; rows: CompiledTableRow[] };
    assert.equal(tc.headers.length, 2);
    assert.equal(tc.rows[0].cells[0].text, 'Auth');
  });

  it('CompiledSlide aggregates elements + fontsUsed', () => {
    const slide: CompiledSlide = {
      slideId: 'slide-cover',
      intent: 'cover',
      masterName: 'COVER',
      elements: [],
      fontsUsed: ['PingFang SC'],
    };
    assert.equal(slide.slideId, 'slide-cover');
    assert.deepEqual(slide.fontsUsed, ['PingFang SC']);
  });

  it('CompiledDeck has slides + global fontsUsed', () => {
    const deck: CompiledDeck = {
      slides: [],
      fontsUsed: ['PingFang SC', 'Noto Sans SC'],
    };
    assert.equal(deck.fontsUsed.length, 2);
  });

  it('PptRole union covers all 6 element types', () => {
    const roles: PptRole[] = ['text', 'shape', 'group', 'table', 'chart', 'image'];
    assert.equal(roles.length, 6);
  });
});
