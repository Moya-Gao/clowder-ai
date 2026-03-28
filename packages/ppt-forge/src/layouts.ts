import type { LayoutCatalogEntry } from './types.js';

/**
 * Phase A Layout Catalog — 8 core + 2 Huawei dense variants
 * Based on 16:9 (10" × 5.625")
 */
export const LAYOUT_CATALOG: Record<string, LayoutCatalogEntry> = {
  'layout-cover': {
    layoutId: 'layout-cover',
    description: '封面页：居中大标题 + 副标题',
    slots: [
      { name: 'title', type: 'title', position: { x: 1, y: 1.5, w: 8, h: 1.5 } },
      { name: 'subtitle', type: 'subtitle', position: { x: 1, y: 3.2, w: 8, h: 0.8 } },
    ],
  },
  'layout-section': {
    layoutId: 'layout-section',
    description: '章节分隔页：章节标签 + 大标题',
    slots: [
      { name: 'label', type: 'caption', position: { x: 1, y: 1.8, w: 8, h: 0.5 } },
      { name: 'title', type: 'title', position: { x: 1, y: 2.4, w: 8, h: 1.5 } },
    ],
  },
  'layout-title-body': {
    layoutId: 'layout-title-body',
    description: '标准内容页：顶部标题 + 主体正文区',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'body', type: 'body', position: { x: 0.5, y: 1.0, w: 9, h: 4.2 } },
    ],
  },
  'layout-two-col': {
    layoutId: 'layout-two-col',
    description: '双栏页：左右两个等宽区域',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'col-left', type: 'body', position: { x: 0.5, y: 1.0, w: 4.2, h: 4.2 } },
      { name: 'col-right', type: 'body', position: { x: 5.1, y: 1.0, w: 4.2, h: 4.2 } },
    ],
  },
  'layout-chart-insight': {
    layoutId: 'layout-chart-insight',
    description: '数据洞察页：左侧图表 60% + 右侧洞察 40%',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'chart', type: 'chart', position: { x: 0.5, y: 1.0, w: 5.5, h: 4.2 } },
      { name: 'insight', type: 'body', position: { x: 6.3, y: 1.0, w: 3.2, h: 4.2 } },
    ],
  },
  'layout-full-chart': {
    layoutId: 'layout-full-chart',
    description: '全幅图表页：顶部标题 + 全宽图表',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'chart', type: 'chart', position: { x: 0.5, y: 1.0, w: 9, h: 4.2 } },
    ],
  },
  'layout-kpi': {
    layoutId: 'layout-kpi',
    description: 'KPI 仪表板：标题 + 3 个 KPI 卡片 + 详情',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'kpi-1', type: 'kpi-number', position: { x: 0.5, y: 1.2, w: 2.8, h: 1.5 } },
      { name: 'kpi-2', type: 'kpi-number', position: { x: 3.6, y: 1.2, w: 2.8, h: 1.5 } },
      { name: 'kpi-3', type: 'kpi-number', position: { x: 6.7, y: 1.2, w: 2.8, h: 1.5 } },
      { name: 'detail', type: 'body', position: { x: 0.5, y: 3.2, w: 9, h: 2.0 } },
    ],
  },
  'layout-closing': {
    layoutId: 'layout-closing',
    description: '结尾页：居中 CTA 标题 + 联系信息',
    slots: [
      { name: 'title', type: 'title', position: { x: 1, y: 1.5, w: 8, h: 1.5 } },
      { name: 'contact', type: 'body', position: { x: 1, y: 3.5, w: 8, h: 1.5 } },
    ],
  },

  // ── Huawei Dense Variants ──────────────────────────────

  'layout-kpi-4col': {
    layoutId: 'layout-kpi-4col',
    description: '华为高密 KPI：4 列 KPI + 底部详情',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'kpi-1', type: 'kpi-number', position: { x: 0.5, y: 1.0, w: 2.1, h: 1.5 } },
      { name: 'kpi-2', type: 'kpi-number', position: { x: 2.85, y: 1.0, w: 2.1, h: 1.5 } },
      { name: 'kpi-3', type: 'kpi-number', position: { x: 5.2, y: 1.0, w: 2.1, h: 1.5 } },
      { name: 'kpi-4', type: 'kpi-number', position: { x: 7.55, y: 1.0, w: 2.1, h: 1.5 } },
      { name: 'detail', type: 'body', position: { x: 0.5, y: 2.8, w: 9, h: 2.5 } },
    ],
  },
  'layout-dense-table': {
    layoutId: 'layout-dense-table',
    description: '华为密排表格：标题 + 全幅表格（华为状态矩阵）',
    slots: [
      { name: 'title', type: 'title', position: { x: 0.5, y: 0.3, w: 9, h: 0.5 } },
      { name: 'table', type: 'table', position: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 } },
    ],
  },
};

export function getLayout(layoutId: string): LayoutCatalogEntry {
  const layout = LAYOUT_CATALOG[layoutId];
  if (!layout) {
    throw new Error(`Unknown layoutId: "${layoutId}". Available: ${Object.keys(LAYOUT_CATALOG).join(', ')}`);
  }
  return layout;
}

export function getSlot(layoutId: string, slotName: string) {
  const layout = getLayout(layoutId);
  const slot = layout.slots.find(s => s.name === slotName);
  if (!slot) {
    throw new Error(`Slot "${slotName}" not found in layout "${layoutId}". Available: ${layout.slots.map(s => s.name).join(', ')}`);
  }
  return slot;
}
