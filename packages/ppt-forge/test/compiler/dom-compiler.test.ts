import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvaluatedNode } from '../../src/compiler/layout-evaluator.js';
import type { SlideSpec } from '../../src/types.js';

function makeNode(overrides: Partial<EvaluatedNode>): EvaluatedNode {
  return {
    role: 'text',
    rect: { x: 64, y: 38, w: 1152, h: 64 },
    computedStyle: {
      fontSize: 24,
      fontFamily: '"PingFang SC", sans-serif',
      color: 'rgb(51, 51, 51)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderColor: 'rgb(0, 0, 0)',
      borderWidth: 0,
      borderRadius: 0,
    },
    children: [],
    ...overrides,
  };
}

function makeSlideSpec(overrides?: Partial<SlideSpec>): SlideSpec {
  return {
    slideId: 'slide-1',
    intent: 'content',
    layoutId: 'layout-title-body',
    purpose: 'test',
    elements: [],
    renderBudget: { maxWords: 200 },
    ...overrides,
  };
}

describe('dom-compiler — compileDom()', () => {
  it('converts px rect to inches (÷128)', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [makeNode({ rect: { x: 128, y: 256, w: 512, h: 128 } })];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.equal(slide.elements.length, 1);
    assert.equal(slide.elements[0].rect.x, 1); // 128/128
    assert.equal(slide.elements[0].rect.y, 2); // 256/128
    assert.equal(slide.elements[0].rect.w, 4); // 512/128
    assert.equal(slide.elements[0].rect.h, 1); // 128/128
  });

  it('extracts text runs from textContent + computedStyle', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'text',
        textContent: 'Hello World',
        computedStyle: {
          fontSize: 24,
          fontFamily: '"PingFang SC"',
          color: 'rgb(51, 51, 51)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: 'rgb(0,0,0)',
          borderWidth: 0,
          borderRadius: 0,
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    const content = slide.elements[0].content;
    assert.equal(content.type, 'text');
    if (content.type === 'text') {
      assert.equal(content.runs[0].text, 'Hello World');
      assert.equal(content.runs[0].fontSize, 24);
      assert.equal(content.runs[0].color, '333333');
    }
  });

  it('converts rgb() color to 6-char hex', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'text',
        textContent: 'Red',
        computedStyle: {
          fontSize: 14,
          fontFamily: 'sans-serif',
          color: 'rgb(207, 10, 44)',
          backgroundColor: 'rgb(245, 245, 245)',
          borderColor: 'rgb(0,0,0)',
          borderWidth: 0,
          borderRadius: 0,
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    if (slide.elements[0].content.type === 'text') {
      assert.equal(slide.elements[0].content.runs[0].color, 'CF0A2C');
    }
    assert.equal(slide.elements[0].style.fill, 'F5F5F5');
  });

  it('compiles shape elements with fill + border', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'shape',
        textContent: 'Fastify',
        computedStyle: {
          fontSize: 10,
          fontFamily: 'sans-serif',
          color: 'rgb(51,51,51)',
          backgroundColor: 'rgb(245,245,245)',
          borderColor: 'rgb(207,10,44)',
          borderWidth: 1.2,
          borderRadius: 4,
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.equal(slide.elements[0].role, 'shape');
    assert.equal(slide.elements[0].style.fill, 'F5F5F5');
    assert.equal(slide.elements[0].style.borderColor, 'CF0A2C');
    assert.equal(slide.elements[0].style.borderWidth, 1.2);
    assert.equal(slide.elements[0].style.borderRadius, 4);
  });

  it('compiles group elements with recursive children', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'group',
        rect: { x: 38, y: 115, w: 1203, h: 563 },
        children: [
          makeNode({ role: 'shape', textContent: 'Child1', rect: { x: 42, y: 119, w: 597, h: 555 } }),
          makeNode({ role: 'shape', textContent: 'Child2', rect: { x: 643, y: 119, w: 594, h: 555 } }),
        ],
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.equal(slide.elements[0].role, 'group');
    assert.equal(slide.elements[0].children?.length, 2);
    assert.equal(slide.elements[0].children![0].role, 'shape');
  });

  it('compiles table elements from tableData', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'table',
        tableData: {
          headers: ['Name', 'Status'],
          rows: [{ cells: ['Auth', 'Done'] }],
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.equal(slide.elements[0].content.type, 'table');
    if (slide.elements[0].content.type === 'table') {
      assert.deepEqual(slide.elements[0].content.headers, ['Name', 'Status']);
      assert.equal(slide.elements[0].content.rows[0].cells[0].text, 'Auth');
    }
  });

  it('includes text runs in shape content for label rendering (P1-2)', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'shape',
        textContent: 'Fastify',
        computedStyle: {
          fontSize: 10,
          fontFamily: '"PingFang SC"',
          color: 'rgb(51,51,51)',
          backgroundColor: 'rgb(245,245,245)',
          borderColor: 'rgb(207,10,44)',
          borderWidth: 1.2,
          borderRadius: 4,
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    const content = slide.elements[0].content;
    assert.equal(content.type, 'shape');
    if (content.type === 'shape') {
      assert.ok(content.runs, 'shape content should have text runs for label');
      assert.equal(content.runs![0].text, 'Fastify');
      assert.equal(content.runs![0].fontSize, 10);
    }
  });

  it('passes through table cell styles (bgColor, fontColor, bold) (P2-1)', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'table',
        tableData: {
          headers: ['Name', 'Status'],
          rows: [
            {
              cells: [
                { text: 'Auth', bgColor: 'rgb(232, 245, 233)', fontColor: 'rgb(51, 51, 51)', bold: false },
                { text: 'Done', bgColor: 'rgb(200, 230, 201)', fontColor: 'rgb(27, 94, 32)', bold: true },
              ],
            },
          ],
        },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    const content = slide.elements[0].content;
    assert.equal(content.type, 'table');
    if (content.type === 'table') {
      const cell0 = content.rows[0].cells[0];
      const cell1 = content.rows[0].cells[1];
      assert.equal(cell0.text, 'Auth');
      assert.equal(cell1.text, 'Done');
      assert.equal(cell1.bold, true, 'bold cell should have bold=true');
      assert.ok(cell1.bgColor, 'styled cell should have bgColor');
      assert.ok(cell1.fontColor, 'styled cell should have fontColor');
    }
  });

  it('compiles chart elements as passthrough', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const chartData = { chartProfile: 'categorical', categories: ['A'], series: [{ name: 's', values: [1] }] };
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'chart',
        chartData: { chartType: 'bar', data: chartData },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.equal(slide.elements[0].content.type, 'chart');
    if (slide.elements[0].content.type === 'chart') {
      assert.equal(slide.elements[0].content.chartType, 'bar');
    }
  });

  it('collects fontsUsed from all elements', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const nodes: EvaluatedNode[] = [
      makeNode({
        role: 'text',
        textContent: 'A',
        computedStyle: { ...makeNode({}).computedStyle, fontFamily: '"PingFang SC", sans-serif' },
      }),
      makeNode({
        role: 'text',
        textContent: 'B',
        computedStyle: { ...makeNode({}).computedStyle, fontFamily: '"Noto Sans SC", sans-serif' },
      }),
    ];
    const slide = compileDom(nodes, makeSlideSpec());
    assert.ok(slide.fontsUsed.includes('PingFang SC'), 'should include PingFang SC');
    assert.ok(slide.fontsUsed.includes('Noto Sans SC'), 'should include Noto Sans SC');
  });

  it('sets slideId, intent, masterName from SlideSpec', async () => {
    const { compileDom } = await import('../../src/compiler/dom-compiler.js');
    const slide = compileDom([], makeSlideSpec({ slideId: 'cover-1', intent: 'cover', speakerNotes: 'Welcome!' }));
    assert.equal(slide.slideId, 'cover-1');
    assert.equal(slide.intent, 'cover');
    assert.equal(slide.masterName, 'MASTER_COVER');
    assert.equal(slide.speakerNotes, 'Welcome!');
  });
});
