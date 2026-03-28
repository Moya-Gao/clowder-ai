import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SlideSpec, ThemeTokens } from '../../src/types.js';

const THEME: ThemeTokens = {
  version: '1.0',
  name: 'test-theme',
  description: 'Test',
  brand: {
    colors: {
      primary: 'CF0A2C',
      secondary: '333333',
      accent: 'E53935',
      background: 'FFFFFF',
      surface: 'F5F5F5',
      surfaceAlt: 'EEEEEE',
      white: 'FFFFFF',
      text: { primary: '333333', secondary: '666666', muted: '999999', onPrimary: 'FFFFFF' },
    },
    typography: {
      headingFont: 'PingFang SC',
      bodyFont: 'PingFang SC',
      monoFont: 'Menlo',
      cjkFont: 'PingFang SC',
      headingWeight: '700',
      bodyWeight: '400',
      fallback: { headingFont: 'sans-serif', bodyFont: 'sans-serif', monoFont: 'monospace', cjkFont: 'sans-serif' },
    },
    spacing: { unit: 8, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
  slide: {
    cover: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 36 },
    section: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 28 },
    content: { bg: 'FFFFFF', titleColor: '333333', titleFontSize: 24, bodyColor: '333333', bodyFontSize: 14 },
    kpi: {
      numberColor: 'CF0A2C',
      numberFontSize: 48,
      labelColor: '666666',
      labelFontSize: 12,
      trendUp: '4CAF50',
      trendDown: 'F44336',
      trendFlat: '999999',
    },
    chart: {
      palette: ['CF0A2C'],
      gridColor: 'E0E0E0',
      gridSize: 8,
      axisLabelColor: '666666',
      axisLabelSize: 10,
      dataLabelColor: '333333',
      dataLabelSize: 10,
      bgColor: 'FFFFFF',
    },
    table: {
      headerBg: 'CF0A2C',
      headerColor: 'FFFFFF',
      rowBg: 'FFFFFF',
      rowAltBg: 'F5F5F5',
      rowColor: '333333',
      borderColor: 'E0E0E0',
    },
    diagram: {
      boxBg: 'F5F5F5',
      boxBorder: 'CF0A2C',
      boxBorderWidth: 1.2,
      labelColor: '333333',
      labelFontSize: 10,
      nestedBg: ['FAFAFA', 'F5F5F5', 'EEEEEE', 'E8E8E8'],
      connectorColor: '999999',
      connectorWidth: 1,
    },
    closing: { bg: '333333', titleColor: 'FFFFFF', titleFontSize: 28 },
  },
  slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '96%' } },
};

function makeDiagramSlide(boxes: SlideSpec['elements'][0] & { type: 'diagram' }): SlideSpec {
  return {
    slideId: 'diagram-test',
    intent: 'content',
    layoutId: 'layout-diagram',
    purpose: 'test',
    elements: [boxes],
    renderBudget: { maxWords: 200 },
  };
}

describe('html-template — diagram CSS flexbox', () => {
  it('renders leaf boxes as data-ppt-role="shape"', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        { id: 'box-a', label: 'Fastify' },
        { id: 'box-b', label: 'Redis' },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    assert.ok(html.includes('data-ppt-role="shape"'), 'leaf boxes should be shapes');
    assert.ok(html.includes('Fastify'), 'should contain leaf label');
    assert.ok(html.includes('Redis'), 'should contain second leaf label');
  });

  it('renders parent boxes as data-ppt-role="group" with header bar', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'backend',
          label: 'Backend',
          borderColor: 'CF0A2C',
          children: [
            { id: 'fastify', label: 'Fastify' },
            { id: 'redis', label: 'Redis' },
          ],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    assert.ok(html.includes('data-ppt-role="group"'), 'parent should be a group');
    assert.ok(html.includes('Backend'), 'should contain parent label');
    // Header bar should have the border color as background
    assert.ok(html.includes('CF0A2C'), 'should use borderColor for header bar');
  });

  it('marks parent header bar with data-ppt-role="text" so evaluator preserves label (cloud P1-2)', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'backend',
          label: 'Backend',
          children: [
            { id: 'fastify', label: 'Fastify' },
            { id: 'redis', label: 'Redis' },
          ],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    // The parent header bar must have data-ppt-role="text" so it's extracted by the evaluator
    const headerMatch = html.match(/data-ppt-role="text"[^>]*>[\s\S]*?Backend/);
    assert.ok(headerMatch, 'parent header bar should have data-ppt-role="text" containing label "Backend"');
  });

  it('uses CSS flexbox (display: flex) for child layout', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'parent',
          label: 'Parent',
          children: [
            { id: 'c1', label: 'Child1' },
            { id: 'c2', label: 'Child2' },
            { id: 'c3', label: 'Child3' },
          ],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    assert.ok(html.includes('display: flex'), 'should use flexbox for children layout');
    assert.ok(html.includes('flex-wrap'), 'should support wrapping');
  });

  it('supports 3-level nesting with depth-based background colors', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'l0',
          label: 'Level 0',
          children: [
            {
              id: 'l1',
              label: 'Level 1',
              children: [
                { id: 'l2a', label: 'Leaf A' },
                { id: 'l2b', label: 'Leaf B' },
              ],
            },
          ],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    // nestedBg: ['FAFAFA', 'F5F5F5', 'EEEEEE', 'E8E8E8']
    assert.ok(html.includes('FAFAFA'), 'depth 0 should use nestedBg[0]');
    assert.ok(html.includes('F5F5F5'), 'depth 1 should use nestedBg[1]');
  });

  it('handles 50+ boxes without error', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    // Build a tree with 50+ leaf boxes across 4 groups
    const groups = Array.from({ length: 4 }, (_, gi) => ({
      id: `group-${gi}`,
      label: `Group ${gi}`,
      borderColor: 'CF0A2C',
      children: Array.from({ length: 13 }, (_, ci) => ({
        id: `box-${gi}-${ci}`,
        label: `Box ${gi}-${ci}`,
      })),
    }));
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: groups,
    });
    const html = renderSlideToHtml(slide, THEME);
    // Count data-ppt-role="shape" occurrences (52 leaf boxes)
    const shapeCount = (html.match(/data-ppt-role="shape"/g) || []).length;
    assert.ok(shapeCount >= 50, `should have ≥50 leaf shapes, got ${shapeCount}`);
    // Count data-ppt-role="group" occurrences (4 parent groups + 1 diagram root)
    const groupCount = (html.match(/data-ppt-role="group"/g) || []).length;
    assert.ok(groupCount >= 4, `should have ≥4 groups, got ${groupCount}`);
  });

  it('uses flex-grow for proportional child sizing', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeDiagramSlide({
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'parent',
          label: 'Parent',
          children: [
            { id: 'small', label: 'Small' },
            {
              id: 'big',
              label: 'Big',
              children: [
                { id: 'c1', label: 'C1' },
                { id: 'c2', label: 'C2' },
                { id: 'c3', label: 'C3' },
              ],
            },
          ],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);
    assert.ok(html.includes('flex:'), 'should use flex shorthand for proportional sizing');
  });
});
