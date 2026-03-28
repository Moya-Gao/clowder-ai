import type {
  ChartElement,
  ChartStyleTokens,
  LayoutSlot,
  CategoricalChartData,
  XYChartData,
  BubbleChartData,
} from '../types.js';

/** Map our chartType string to pptxgenjs charts enum value */
function resolveChartType(
  chartType: ChartElement['chartType'],
  charts: Record<string, string>,
): string {
  const map: Record<string, string> = {
    bar: charts.BAR,
    bar3d: charts.BAR3D,
    line: charts.LINE,
    pie: charts.PIE,
    doughnut: charts.DOUGHNUT,
    area: charts.AREA,
    radar: charts.RADAR,
    scatter: charts.SCATTER,
  };
  return map[chartType] ?? charts.BAR;
}

/** Convert categorical data to pptxgenjs series format */
function toCategoricalSeries(data: CategoricalChartData) {
  return data.series.map(s => ({
    name: s.name,
    labels: data.categories,
    values: s.values.map(v => v ?? 0),
  }));
}

/** Convert XY data to pptxgenjs scatter series format */
function toXYSeries(data: XYChartData) {
  return data.series.map(s => ({
    name: s.name,
    values: s.points.map(p => [p.x, p.y]),
  }));
}

/** Convert bubble data to pptxgenjs series format */
function toBubbleSeries(data: BubbleChartData) {
  return data.series.map(s => ({
    name: s.name,
    values: s.points.map(p => [p.x, p.y, p.size]),
  }));
}

/**
 * Render a ChartElement onto a pptxgenjs slide.
 * Supports categorical/xy/bubble chart profiles with CJK font support.
 */
export function renderChart(
  slide: { addChart(chartType: unknown, data: unknown, options: unknown): void },
  element: ChartElement,
  slot: LayoutSlot,
  style: ChartStyleTokens,
  charts: Record<string, string>,
  fontFace: string,
): void {
  const pptxChartType = resolveChartType(element.chartType, charts);

  let series: unknown;
  switch (element.data.chartProfile) {
    case 'categorical':
      series = toCategoricalSeries(element.data);
      break;
    case 'xy':
      series = toXYSeries(element.data);
      break;
    case 'bubble':
      series = toBubbleSeries(element.data);
      break;
  }

  const seriesCount =
    element.data.chartProfile === 'categorical'
      ? element.data.series.length
      : element.data.series.length;

  slide.addChart(pptxChartType, series, {
    x: slot.position.x,
    y: slot.position.y,
    w: slot.position.w,
    h: slot.position.h,
    showLegend: seriesCount > 1,
    legendPos: 'b',
    legendFontFace: fontFace,
    legendFontSize: style.axisLabelSize,
    legendColor: style.axisLabelColor,
    chartColors: style.palette.slice(0, seriesCount),
    catAxisLabelColor: style.axisLabelColor,
    catAxisLabelFontSize: style.axisLabelSize,
    catAxisLabelFontFace: fontFace,
    valAxisLabelColor: style.axisLabelColor,
    valAxisLabelFontSize: style.axisLabelSize,
    valAxisLabelFontFace: fontFace,
    catGridLine: { color: style.gridColor, size: style.gridSize },
    valGridLine: { color: style.gridColor, size: style.gridSize },
    dataLabelColor: style.dataLabelColor,
    dataLabelFontSize: style.dataLabelSize,
    dataLabelFontFace: fontFace,
    plotArea: { fill: { color: style.bgColor } },
    ...element.hints,
  });
}
