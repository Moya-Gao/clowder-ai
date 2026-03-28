import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlideMasters, MASTER_NAMES } from '../src/master-builder.js';
import type { ThemeTokens } from '../src/types.js';

function createMockPres() {
  const masters: { name: string; opts: Record<string, unknown> }[] = [];
  return {
    defineSlideMaster(opts: { title: string; background?: unknown; [k: string]: unknown }) {
      masters.push({ name: opts.title, opts });
    },
    masters,
  };
}

function loadTheme(): ThemeTokens {
  // Inline minimal theme matching huawei-like structure
  return {
    version: '1.0',
    name: 'test-theme',
    description: 'test',
    brand: {
      colors: {
        primary: 'CF0A2C',
        secondary: '333333',
        accent: 'E60012',
        background: 'FFFFFF',
        surface: 'F5F5F5',
        surfaceAlt: 'EEEEEE',
        white: 'FFFFFF',
        text: { primary: '333333', secondary: '666666', muted: '999999', onPrimary: 'FFFFFF' },
      },
      typography: {
        headingFont: 'Noto Sans SC',
        bodyFont: 'Noto Sans SC',
        monoFont: 'IBM Plex Mono',
        cjkFont: 'Noto Sans SC',
        headingWeight: '700',
        bodyWeight: '400',
        fallback: { headingFont: 'Microsoft YaHei', bodyFont: 'Microsoft YaHei', monoFont: 'Consolas', cjkFont: 'PingFang SC' },
      },
      spacing: { unit: 0.15, xs: 0.08, sm: 0.15, md: 0.3, lg: 0.5, xl: 0.8 },
    },
    slide: {
      cover: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 32, subtitleColor: 'FFFFFF', subtitleFontSize: 16 },
      section: { bg: 'CF0A2C', labelColor: 'FFFFFF', labelFontSize: 12, titleColor: 'FFFFFF', titleFontSize: 28 },
      content: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 20, bodyColor: '333333', bodyFontSize: 12 },
      kpi: { numberColor: 'CF0A2C', numberFontSize: 40, labelColor: '666666', labelFontSize: 11, trendUp: '4CAF50', trendDown: 'CF0A2C', trendFlat: '999999' },
      chart: { palette: ['CF0A2C'], gridColor: 'EEEEEE', gridSize: 0.5, axisLabelColor: '666666', axisLabelSize: 9, dataLabelColor: '333333', dataLabelSize: 9, bgColor: 'FFFFFF' },
      table: { headerBg: 'CF0A2C', headerColor: 'FFFFFF', rowBg: 'FFFFFF', rowAltBg: 'F5F5F5', rowColor: '333333', borderColor: 'DDDDDD' },
      closing: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 24, bodyColor: '666666', bodyFontSize: 12 },
    },
    slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '95%' } },
  };
}

describe('buildSlideMasters', () => {
  it('registers all expected master names', () => {
    const pres = createMockPres();
    buildSlideMasters(pres as never, loadTheme());
    const names = pres.masters.map(m => m.name);
    assert.ok(names.includes(MASTER_NAMES.COVER));
    assert.ok(names.includes(MASTER_NAMES.SECTION));
    assert.ok(names.includes(MASTER_NAMES.CONTENT));
    assert.ok(names.includes(MASTER_NAMES.CLOSING));
  });

  it('cover master has red background', () => {
    const pres = createMockPres();
    buildSlideMasters(pres as never, loadTheme());
    const cover = pres.masters.find(m => m.name === MASTER_NAMES.COVER);
    assert.ok(cover);
    assert.deepEqual(cover.opts.background, { color: 'CF0A2C' });
  });

  it('content master has white background', () => {
    const pres = createMockPres();
    buildSlideMasters(pres as never, loadTheme());
    const content = pres.masters.find(m => m.name === MASTER_NAMES.CONTENT);
    assert.ok(content);
    assert.deepEqual(content.opts.background, { color: 'FFFFFF' });
  });
});
