import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateResearch, validateStoryline } from '../src/gates.js';
import type { ResearchOutput, StorylineOutput } from '../src/types.js';

function makeValidResearch(): ResearchOutput {
  return {
    topic: 'AI Agent 发展趋势',
    generatedAt: '2026-03-27T12:00:00Z',
    sources: [
      { id: 'src-1', title: 'Gartner Report 2026', type: 'report' },
      { id: 'src-2', title: 'ArXiv paper', url: 'https://arxiv.org/abs/2026.1234', type: 'paper' },
    ],
    findings: [
      { id: 'f1', claim: 'Agent 市场规模将达 500 亿美元', sourceIds: ['src-1'], confidence: 'fact' },
      { id: 'f2', claim: '多模态 Agent 将成主流', sourceIds: ['src-1', 'src-2'], confidence: 'inference' },
    ],
    dataPoints: [{ id: 'dp1', label: 'Agent 市场规模', value: 500, unit: '亿美元', sourceId: 'src-1' }],
  };
}

function makeValidStoryline(): StorylineOutput {
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
            slideId: 'slide-market-1',
            intent: 'data-insight',
            keyMessage: 'Agent 市场 2026 年预计达 500 亿',
            supportingPoints: ['年增长率 40%', '企业采用率 65%'],
            suggestedDataViz: 'chart',
          },
          {
            slideId: 'slide-market-2',
            intent: 'comparison',
            keyMessage: '头部玩家格局：OpenAI / Anthropic / Google',
            supportingPoints: ['市场份额对比', '技术路线差异'],
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
            slideId: 'slide-tech-1',
            intent: 'key-statement',
            keyMessage: '多模态 + 工具调用是核心能力',
            supportingPoints: ['视觉理解', '代码执行', 'API 调用'],
            suggestedDataViz: 'kpi',
          },
        ],
      },
    ],
  };
}

describe('validateResearch', () => {
  it('passes valid research output', () => {
    assert.doesNotThrow(() => validateResearch(makeValidResearch()));
  });

  it('rejects research with no findings', () => {
    const research = makeValidResearch();
    research.findings = [];
    assert.throws(() => validateResearch(research), /at least 1 finding/i);
  });

  it('rejects finding referencing non-existent source', () => {
    const research = makeValidResearch();
    research.findings[0].sourceIds = ['non-existent'];
    assert.throws(() => validateResearch(research), /source.*not found/i);
  });

  it('rejects research with no data points', () => {
    const research = makeValidResearch();
    research.dataPoints = [];
    assert.throws(() => validateResearch(research), /at least 1 data point/i);
  });

  it('rejects dataPoint referencing non-existent source', () => {
    const research = makeValidResearch();
    research.dataPoints[0].sourceId = 'ghost';
    assert.throws(() => validateResearch(research), /source.*not found/i);
  });
});

describe('validateStoryline', () => {
  it('passes valid storyline', () => {
    assert.doesNotThrow(() => validateStoryline(makeValidStoryline()));
  });

  it('rejects storyline with empty sections', () => {
    const storyline = makeValidStoryline();
    storyline.sections = [];
    assert.throws(() => validateStoryline(storyline), /at least 1 section/i);
  });

  it('rejects section with no slides', () => {
    const storyline = makeValidStoryline();
    storyline.sections[0].slides = [];
    assert.throws(() => validateStoryline(storyline), /at least 1 slide/i);
  });

  it('rejects slide without keyMessage', () => {
    const storyline = makeValidStoryline();
    storyline.sections[0].slides[0].keyMessage = '';
    assert.throws(() => validateStoryline(storyline), /keyMessage.*empty/i);
  });

  it('rejects empty centralMessage', () => {
    const storyline = makeValidStoryline();
    storyline.centralMessage = '';
    assert.throws(() => validateStoryline(storyline), /centralMessage.*empty/i);
  });

  it('rejects duplicate sectionId', () => {
    const storyline = makeValidStoryline();
    storyline.sections[1].sectionId = storyline.sections[0].sectionId;
    assert.throws(() => validateStoryline(storyline), /duplicate sectionId/i);
  });

  it('rejects duplicate slideId across sections', () => {
    const storyline = makeValidStoryline();
    storyline.sections[1].slides[0].slideId = storyline.sections[0].slides[0].slideId;
    assert.throws(() => validateStoryline(storyline), /duplicate slideId/i);
  });
});
