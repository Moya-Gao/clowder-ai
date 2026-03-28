import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDeck } from '../src/slide-builder.js';
import type { DeckBlueprint, DiagramElement, ThemeTokens } from '../src/types.js';

function makeTheme(): ThemeTokens {
  return {
    version: '1.0',
    name: 'test',
    description: 'test theme',
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
        fallback: {
          headingFont: 'Microsoft YaHei',
          bodyFont: 'Microsoft YaHei',
          monoFont: 'Consolas',
          cjkFont: 'PingFang SC',
        },
      },
      spacing: { unit: 0.15, xs: 0.08, sm: 0.15, md: 0.3, lg: 0.5, xl: 0.8 },
    },
    slide: {
      cover: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 32, subtitleColor: 'FFFFFF', subtitleFontSize: 16 },
      section: { bg: 'CF0A2C', labelColor: 'FFFFFF', labelFontSize: 12, titleColor: 'FFFFFF', titleFontSize: 28 },
      content: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 20, bodyColor: '333333', bodyFontSize: 12 },
      kpi: {
        numberColor: 'CF0A2C',
        numberFontSize: 40,
        labelColor: '666666',
        labelFontSize: 11,
        trendUp: '4CAF50',
        trendDown: 'CF0A2C',
        trendFlat: '999999',
      },
      chart: {
        palette: ['CF0A2C', 'E60012', 'FF6B35'],
        gridColor: 'EEEEEE',
        gridSize: 0.5,
        axisLabelColor: '666666',
        axisLabelSize: 9,
        dataLabelColor: '333333',
        dataLabelSize: 9,
        bgColor: 'FFFFFF',
      },
      table: {
        headerBg: 'CF0A2C',
        headerColor: 'FFFFFF',
        rowBg: 'FFFFFF',
        rowAltBg: 'F5F5F5',
        rowColor: '333333',
        borderColor: 'DDDDDD',
      },
      diagram: {
        boxBg: 'F5F5F5',
        boxBorder: 'CF0A2C',
        boxBorderWidth: 1.5,
        labelColor: '333333',
        labelFontSize: 9,
        nestedBg: ['FFFFFF', 'F5F5F5', 'EEEEEE'],
        connectorColor: '999999',
        connectorWidth: 1,
      },
      closing: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 24, bodyColor: '666666', bodyFontSize: 12 },
    },
    slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '95%' } },
  };
}

describe('DiagramElement integration with buildDeck', () => {
  it('renders a slide with diagram element without throwing', () => {
    const diagramEl: DiagramElement = {
      type: 'diagram',
      slotName: 'diagram',
      boxes: [
        {
          id: 'system',
          label: 'Cat Café',
          children: [
            { id: 'fe', label: 'Frontend' },
            { id: 'be', label: 'Backend' },
            { id: 'db', label: 'Database' },
          ],
        },
      ],
    };

    const bp: DeckBlueprint = {
      version: '1.0',
      meta: {
        title: 'Test Diagram',
        subtitle: 'Sub',
        author: 'Test',
        createdAt: '2026-03-28',
        researchRef: 'none',
        storylineRef: 'none',
        themeRef: 'test',
        framework: 'pyramid',
        targetAudience: 'corporate-executive',
      },
      sections: [{ sectionId: 's1', title: 'Arch', slideIds: ['slide-d1'] }],
      slides: [
        {
          slideId: 'slide-d1',
          intent: 'content',
          purpose: 'Architecture diagram',
          layoutId: 'layout-diagram',
          elements: [{ type: 'text', slotName: 'title', content: '系统架构' }, diagramEl],
          renderBudget: { maxWords: 100 },
        },
      ],
      assets: [],
    };

    assert.doesNotThrow(() => buildDeck(bp, makeTheme()));
  });

  it('produces correct slide count with diagram slides', () => {
    const bp: DeckBlueprint = {
      version: '1.0',
      meta: {
        title: 'Test',
        subtitle: '',
        author: 'Test',
        createdAt: '2026-03-28',
        researchRef: 'none',
        storylineRef: 'none',
        themeRef: 'test',
        framework: 'pyramid',
        targetAudience: 'corporate-executive',
      },
      sections: [{ sectionId: 's1', title: 'S', slideIds: ['s1', 's2'] }],
      slides: [
        {
          slideId: 's1',
          intent: 'cover',
          purpose: 'Cover',
          layoutId: 'layout-cover',
          elements: [{ type: 'text', slotName: 'title', content: 'Title' }],
          renderBudget: { maxWords: 20 },
        },
        {
          slideId: 's2',
          intent: 'content',
          purpose: 'Arch',
          layoutId: 'layout-diagram',
          elements: [
            { type: 'text', slotName: 'title', content: 'Architecture' },
            {
              type: 'diagram',
              slotName: 'diagram',
              boxes: [{ id: 'r', label: 'Root' }],
            } as DiagramElement,
          ],
          renderBudget: { maxWords: 100 },
        },
      ],
      assets: [],
    };

    const pres = buildDeck(bp, makeTheme());
    const slides = (pres as unknown as { slides: unknown[] }).slides;
    assert.equal(slides.length, 2);
  });
});
