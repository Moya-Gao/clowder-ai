import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { renderChart } from '../../src/renderers/chart.js';
import type { CategoricalChartData, ChartElement, ChartStyleTokens, LayoutSlot, XYChartData } from '../../src/types.js';

function createMockSlide() {
  const calls: { chartType: unknown; data: unknown; options: unknown }[] = [];
  return {
    addChart(chartType: unknown, data: unknown, options: unknown) {
      calls.push({ chartType, data, options });
    },
    calls,
  };
}

/** Mock pptxgenjs charts enum */
const mockCharts = {
  BAR: 'bar',
  BAR3D: 'bar3D',
  LINE: 'line',
  PIE: 'pie',
  DOUGHNUT: 'doughnut',
  AREA: 'area',
  RADAR: 'radar',
  SCATTER: 'scatter',
};

const slot: LayoutSlot = {
  name: 'chart',
  type: 'chart',
  position: { x: 0.5, y: 1.0, w: 5.5, h: 4.2 },
};

const chartStyle: ChartStyleTokens = {
  palette: ['CF0A2C', 'E60012', 'FF6B35', 'FFA726', '4CAF50', '2196F3'],
  gridColor: 'EEEEEE',
  gridSize: 0.5,
  axisLabelColor: '666666',
  axisLabelSize: 9,
  dataLabelColor: '333333',
  dataLabelSize: 9,
  bgColor: 'FFFFFF',
};

describe('renderChart', () => {
  let mockSlide: ReturnType<typeof createMockSlide>;

  beforeEach(() => {
    mockSlide = createMockSlide();
  });

  it('renders categorical bar chart with correct series format', () => {
    const data: CategoricalChartData = {
      chartProfile: 'categorical',
      categories: ['Q1', 'Q2', 'Q3'],
      series: [
        { name: 'Revenue', values: [100, 200, 300] },
        { name: 'Cost', values: [80, 150, 250] },
      ],
    };
    const el: ChartElement = {
      type: 'chart',
      slotName: 'chart',
      chartType: 'bar',
      data,
    };
    renderChart(mockSlide as never, el, slot, chartStyle, mockCharts, 'Noto Sans SC');
    assert.equal(mockSlide.calls.length, 1);
    assert.equal(mockSlide.calls[0].chartType, 'bar');
    const series = mockSlide.calls[0].data as { name: string; labels: string[]; values: number[] }[];
    assert.equal(series.length, 2);
    assert.equal(series[0].name, 'Revenue');
    assert.deepEqual(series[0].labels, ['Q1', 'Q2', 'Q3']);
    assert.deepEqual(series[0].values, [100, 200, 300]);
  });

  it('renders scatter chart from xy data', () => {
    const data: XYChartData = {
      chartProfile: 'xy',
      series: [
        {
          name: 'Points',
          points: [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
          ],
        },
      ],
    };
    const el: ChartElement = {
      type: 'chart',
      slotName: 'chart',
      chartType: 'scatter',
      data,
    };
    renderChart(mockSlide as never, el, slot, chartStyle, mockCharts, 'Noto Sans SC');
    assert.equal(mockSlide.calls[0].chartType, 'scatter');
  });

  it('sets chart position from slot', () => {
    const data: CategoricalChartData = {
      chartProfile: 'categorical',
      categories: ['A'],
      series: [{ name: 'S', values: [1] }],
    };
    const el: ChartElement = {
      type: 'chart',
      slotName: 'chart',
      chartType: 'line',
      data,
    };
    renderChart(mockSlide as never, el, slot, chartStyle, mockCharts, 'Noto Sans SC');
    const opts = mockSlide.calls[0].options as Record<string, unknown>;
    assert.equal(opts.x, 0.5);
    assert.equal(opts.y, 1.0);
    assert.equal(opts.w, 5.5);
    assert.equal(opts.h, 4.2);
  });

  it('applies CJK font to chart labels', () => {
    const data: CategoricalChartData = {
      chartProfile: 'categorical',
      categories: ['一月', '二月'],
      series: [{ name: '收入', values: [100, 200] }],
    };
    const el: ChartElement = {
      type: 'chart',
      slotName: 'chart',
      chartType: 'bar',
      data,
    };
    renderChart(mockSlide as never, el, slot, chartStyle, mockCharts, 'Noto Sans SC');
    const opts = mockSlide.calls[0].options as Record<string, unknown>;
    assert.equal(opts.catAxisLabelFontFace, 'Noto Sans SC');
    assert.equal(opts.valAxisLabelFontFace, 'Noto Sans SC');
  });

  it('applies theme palette colors to chart series', () => {
    const data: CategoricalChartData = {
      chartProfile: 'categorical',
      categories: ['A'],
      series: [
        { name: 'S1', values: [1] },
        { name: 'S2', values: [2] },
      ],
    };
    const el: ChartElement = {
      type: 'chart',
      slotName: 'chart',
      chartType: 'bar',
      data,
    };
    renderChart(mockSlide as never, el, slot, chartStyle, mockCharts, 'Noto Sans SC');
    const opts = mockSlide.calls[0].options as Record<string, unknown>;
    assert.deepEqual(opts.chartColors, ['CF0A2C', 'E60012']);
  });
});
