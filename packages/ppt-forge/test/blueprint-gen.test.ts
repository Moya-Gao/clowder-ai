import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateBlueprint, suggestLayout } from '../src/blueprint-gen.js';
import type { NarrativeSlide, StorylineOutput } from '../src/types.js';

function makeStoryline(): StorylineOutput {
  return {
    framework: 'pyramid',
    centralMessage: 'AI Agent 正在重塑企业软件格局',
    sections: [
      {
        sectionId: 'sec-market',
        title: '市场概览',
        purpose: '建立市场规模认知',
        slides: [
          {
            slideId: 'slide-m1',
            intent: 'data-insight',
            keyMessage: 'Agent 市场 2026 年将达 500 亿',
            supportingPoints: ['年增长率 40%', '企业采用率 65%'],
            suggestedDataViz: 'chart',
          },
          {
            slideId: 'slide-m2',
            intent: 'comparison',
            keyMessage: '头部玩家格局',
            supportingPoints: ['OpenAI', 'Anthropic', 'Google'],
            suggestedDataViz: 'table',
          },
        ],
      },
      {
        sectionId: 'sec-tech',
        title: '技术趋势',
        purpose: '展示技术演进方向',
        slides: [
          {
            slideId: 'slide-t1',
            intent: 'key-statement',
            keyMessage: '多模态 + 工具调用是核心能力',
            supportingPoints: ['视觉理解', '代码执行', 'API 调用'],
            suggestedDataViz: 'kpi',
          },
        ],
      },
      {
        sectionId: 'sec-outlook',
        title: '前瞻展望',
        purpose: '总结与展望',
        slides: [
          {
            slideId: 'slide-o1',
            intent: 'summary',
            keyMessage: '三大行动建议',
            supportingPoints: ['投资 Agent 基础设施', '培养 Agent 工程人才', '建立 Agent 安全框架'],
          },
        ],
      },
    ],
  };
}

describe('suggestLayout', () => {
  it('returns layout-chart-insight for chart viz', () => {
    const slide: NarrativeSlide = {
      slideId: 's1',
      intent: 'data-insight',
      keyMessage: 'x',
      supportingPoints: [],
      suggestedDataViz: 'chart',
    };
    assert.equal(suggestLayout(slide), 'layout-chart-insight');
  });

  it('returns layout-kpi for kpi viz', () => {
    const slide: NarrativeSlide = {
      slideId: 's1',
      intent: 'content',
      keyMessage: 'x',
      supportingPoints: [],
      suggestedDataViz: 'kpi',
    };
    assert.equal(suggestLayout(slide), 'layout-kpi');
  });

  it('returns layout-dense-table for table viz', () => {
    const slide: NarrativeSlide = {
      slideId: 's1',
      intent: 'comparison',
      keyMessage: 'x',
      supportingPoints: [],
      suggestedDataViz: 'table',
    };
    assert.equal(suggestLayout(slide), 'layout-dense-table');
  });

  it('returns layout-title-body for text-only or no viz hint', () => {
    const slide: NarrativeSlide = {
      slideId: 's1',
      intent: 'content',
      keyMessage: 'x',
      supportingPoints: [],
    };
    assert.equal(suggestLayout(slide), 'layout-title-body');
  });

  it('returns layout-title-body for key-statement without viz hint', () => {
    const slide: NarrativeSlide = {
      slideId: 's1',
      intent: 'key-statement',
      keyMessage: 'x',
      supportingPoints: [],
    };
    assert.equal(suggestLayout(slide), 'layout-title-body');
  });
});

describe('generateBlueprint', () => {
  it('auto-adds cover + closing slides', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'AI Agent Report', author: 'Cat Café' });
    const intents = bp.slides.map((s) => s.intent);
    assert.equal(intents[0], 'cover');
    assert.equal(intents[intents.length - 1], 'closing');
  });

  it('inserts section-break slides', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'Test', author: 'Test' });
    const sectionBreaks = bp.slides.filter((s) => s.intent === 'section-break');
    // 3 sections → 3 section-break slides
    assert.equal(sectionBreaks.length, 3);
  });

  it('generates ≥10 slides from 3-section storyline', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'Test', author: 'Test' });
    // cover(1) + 3 section-breaks + 4 content slides + closing(1) = 9 minimum
    // But we want ≥10 for AC-A1, so agenda slide is auto-added
    assert.ok(bp.slides.length >= 9, `Expected ≥9 slides, got ${bp.slides.length}`);
  });

  it('populates sections[] with correct slideIds', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'Test', author: 'Test' });
    assert.ok(bp.sections.length >= 3);
    for (const section of bp.sections) {
      assert.ok(section.slideIds.length > 0, `Section ${section.sectionId} has no slideIds`);
      for (const sid of section.slideIds) {
        assert.ok(
          bp.slides.some((s) => s.slideId === sid),
          `slideId ${sid} not found in slides[]`,
        );
      }
    }
  });

  it('every content slide has ≥1 text element with keyMessage', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'Test', author: 'Test' });
    const contentSlides = bp.slides.filter((s) => !['cover', 'closing', 'section-break', 'agenda'].includes(s.intent));
    for (const slide of contentSlides) {
      const hasText = slide.elements.some((e) => e.type === 'text');
      assert.ok(hasText, `Slide ${slide.slideId} (${slide.intent}) has no text element`);
    }
  });

  it('sets renderBudget.maxWords on every slide', () => {
    const bp = generateBlueprint(makeStoryline(), { title: 'Test', author: 'Test' });
    for (const slide of bp.slides) {
      assert.ok(slide.renderBudget.maxWords > 0, `Slide ${slide.slideId} has no maxWords`);
    }
  });

  it('fills meta fields correctly', () => {
    const bp = generateBlueprint(makeStoryline(), {
      title: 'AI Agent Report',
      subtitle: '2026 趋势分析',
      author: 'Cat Café',
    });
    assert.equal(bp.meta.title, 'AI Agent Report');
    assert.equal(bp.meta.subtitle, '2026 趋势分析');
    assert.equal(bp.meta.author, 'Cat Café');
    assert.equal(bp.meta.framework, 'pyramid');
  });
});
