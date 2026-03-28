import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { renderKPI } from '../../src/renderers/kpi.js';
import type { KPIElement, KPIStyleTokens, LayoutSlot } from '../../src/types.js';

function createMockSlide() {
  const calls: { text: unknown; options: unknown }[] = [];
  return {
    addText(text: unknown, options: unknown) {
      calls.push({ text, options });
    },
    calls,
  };
}

const slot: LayoutSlot = {
  name: 'kpi-1',
  type: 'kpi-number',
  position: { x: 0.5, y: 1.2, w: 2.8, h: 1.5 },
};

const kpiStyle: KPIStyleTokens = {
  numberColor: 'CF0A2C',
  numberFontSize: 40,
  labelColor: '666666',
  labelFontSize: 11,
  trendUp: '4CAF50',
  trendDown: 'CF0A2C',
  trendFlat: '999999',
};

describe('renderKPI', () => {
  let mockSlide: ReturnType<typeof createMockSlide>;

  beforeEach(() => {
    mockSlide = createMockSlide();
  });

  it('renders KPI number with large fontSize from theme', () => {
    const el: KPIElement = {
      type: 'kpi',
      slotName: 'kpi-1',
      number: '98.5%',
      label: 'SLA达成率',
    };
    renderKPI(mockSlide as never, el, slot, kpiStyle, 'Noto Sans SC');
    assert.ok(mockSlide.calls.length >= 1);
    // First addText = number
    const numSegments = mockSlide.calls[0].text as { text: string; options: Record<string, unknown> }[];
    assert.equal(numSegments[0].text, '98.5%');
    assert.equal(numSegments[0].options.fontSize, 40);
    assert.equal(numSegments[0].options.color, 'CF0A2C');
  });

  it('renders label below number', () => {
    const el: KPIElement = {
      type: 'kpi',
      slotName: 'kpi-1',
      number: '1,234',
      label: '活跃用户',
    };
    renderKPI(mockSlide as never, el, slot, kpiStyle, 'Noto Sans SC');
    // Second addText = label
    assert.ok(mockSlide.calls.length >= 2);
    const labelSegments = mockSlide.calls[1].text as { text: string; options: Record<string, unknown> }[];
    assert.equal(labelSegments[0].text, '活跃用户');
    assert.equal(labelSegments[0].options.fontSize, 11);
    assert.equal(labelSegments[0].options.color, '666666');
  });

  it('renders trend arrow with correct color (up=green)', () => {
    const el: KPIElement = {
      type: 'kpi',
      slotName: 'kpi-1',
      number: '23%',
      label: 'Growth',
      trend: 'up',
    };
    renderKPI(mockSlide as never, el, slot, kpiStyle, 'Noto Sans SC');
    // Number call should include trend indicator
    const numSegments = mockSlide.calls[0].text as { text: string; options: Record<string, unknown> }[];
    const trendSegment = numSegments.find((s) => s.options.color === '4CAF50');
    assert.ok(trendSegment, 'should have a green trend segment');
    assert.ok(trendSegment.text.includes('▲'));
  });

  it('renders trend arrow with correct color (down=red)', () => {
    const el: KPIElement = {
      type: 'kpi',
      slotName: 'kpi-1',
      number: '-5%',
      label: 'Churn',
      trend: 'down',
    };
    renderKPI(mockSlide as never, el, slot, kpiStyle, 'Noto Sans SC');
    const numSegments = mockSlide.calls[0].text as { text: string; options: Record<string, unknown> }[];
    const trendSegment = numSegments.find((s) => s.options.color === 'CF0A2C' && s.text.includes('▼'));
    assert.ok(trendSegment, 'should have a red trend segment');
  });

  it('positions KPI within slot bounds', () => {
    const el: KPIElement = {
      type: 'kpi',
      slotName: 'kpi-1',
      number: '42',
      label: 'Score',
    };
    renderKPI(mockSlide as never, el, slot, kpiStyle, 'Noto Sans SC');
    const numOpts = mockSlide.calls[0].options as Record<string, unknown>;
    assert.equal(numOpts.x, 0.5);
    assert.equal(numOpts.w, 2.8);
  });
});
