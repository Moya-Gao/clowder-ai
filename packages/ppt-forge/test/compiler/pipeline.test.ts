import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import type { DeckBlueprint, ThemeTokens } from '../../src/types.js';

const THEME: ThemeTokens = JSON.parse(
  readFileSync(new URL('../../src/themes/huawei-like.json', import.meta.url), 'utf-8'),
);

function makeBlueprint(): DeckBlueprint {
  return {
    version: '1.0',
    meta: {
      title: 'E2E Test Deck',
      subtitle: 'Phase B Pipeline',
      author: 'Cat Café',
      createdAt: '2026-03-28',
      researchRef: 'test',
      storylineRef: 'test',
      themeRef: 'huawei-like',
      framework: 'pyramid',
      targetAudience: 'technical-deep-dive',
    },
    sections: [{ sectionId: 'sec1', title: 'Main', slideIds: ['cover-1', 'content-1', 'diagram-1', 'table-1'] }],
    slides: [
      {
        slideId: 'cover-1',
        intent: 'cover',
        layoutId: 'layout-cover',
        purpose: 'Title',
        elements: [
          { type: 'text', slotName: 'title', content: 'E2E Test Deck' },
          { type: 'text', slotName: 'subtitle', content: 'Phase B Pipeline Test' },
        ],
        renderBudget: { maxWords: 50 },
      },
      {
        slideId: 'content-1',
        intent: 'content',
        layoutId: 'layout-title-body',
        purpose: 'Content',
        elements: [
          { type: 'text', slotName: 'title', content: 'Key Findings' },
          {
            type: 'text',
            slotName: 'body',
            content:
              'HTML+CSS layout engine provides CSS flexbox, grid, and automatic text flow — replacing thousands of lines of hand-calculated coordinate logic.',
          },
        ],
        renderBudget: { maxWords: 200 },
      },
      {
        slideId: 'diagram-1',
        intent: 'content',
        layoutId: 'layout-diagram',
        purpose: 'Architecture',
        elements: [
          { type: 'text', slotName: 'title', content: 'Architecture Overview' },
          {
            type: 'diagram',
            slotName: 'diagram',
            boxes: [
              {
                id: 'frontend',
                label: 'Frontend',
                borderColor: 'CF0A2C',
                children: [
                  { id: 'next', label: 'Next.js' },
                  { id: 'react', label: 'React' },
                  { id: 'tailwind', label: 'Tailwind' },
                ],
              },
              {
                id: 'backend',
                label: 'Backend',
                borderColor: '333333',
                children: [
                  { id: 'fastify', label: 'Fastify' },
                  { id: 'redis', label: 'Redis' },
                  { id: 'sqlite', label: 'SQLite' },
                ],
              },
            ],
          },
        ],
        renderBudget: { maxWords: 200 },
      },
      {
        slideId: 'table-1',
        intent: 'content',
        layoutId: 'layout-dense-table',
        purpose: 'Comparison',
        elements: [
          { type: 'text', slotName: 'title', content: 'Feature Comparison' },
          {
            type: 'table',
            slotName: 'table',
            headers: ['Feature', 'Phase A', 'Phase B'],
            rows: [
              { cells: [{ text: 'Layout' }, { text: 'Hand-calc' }, { text: 'CSS Flexbox', bgColor: 'E8F5E9' }] },
              { cells: [{ text: 'Diagram' }, { text: 'Recursive algo' }, { text: 'HTML+CSS', bgColor: 'E8F5E9' }] },
            ],
          },
        ],
        renderBudget: { maxWords: 200 },
      },
    ],
    assets: [],
  };
}

describe('compiler/pipeline — compileAndBuild() E2E', () => {
  after(async () => {
    const { closeBrowser } = await import('../../src/compiler/layout-evaluator.js');
    await closeBrowser();
  });

  it('produces a valid .pptx buffer from Blueprint + Theme', async () => {
    const { compileAndBuild } = await import('../../src/compiler/pipeline.js');
    const pres = await compileAndBuild(makeBlueprint(), THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf instanceof Buffer, 'should produce a buffer');
    assert.ok(buf.length > 5000, `buffer should be non-trivial (got ${buf.length})`);
  });

  it('handles diagram slides with CSS flexbox layout', async () => {
    const { compileAndBuild } = await import('../../src/compiler/pipeline.js');
    // Just the diagram slide
    const bp = makeBlueprint();
    bp.slides = bp.slides.filter((s) => s.slideId === 'diagram-1');
    bp.sections = [{ sectionId: 'sec1', title: 'Main', slideIds: ['diagram-1'] }];
    const pres = await compileAndBuild(bp, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 2000, 'diagram slide should produce output');
  });

  it('handles table slides', async () => {
    const { compileAndBuild } = await import('../../src/compiler/pipeline.js');
    const bp = makeBlueprint();
    bp.slides = bp.slides.filter((s) => s.slideId === 'table-1');
    bp.sections = [{ sectionId: 'sec1', title: 'Main', slideIds: ['table-1'] }];
    const pres = await compileAndBuild(bp, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 2000, 'table slide should produce output');
  });
});
