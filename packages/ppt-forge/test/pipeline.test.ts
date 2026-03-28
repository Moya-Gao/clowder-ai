import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { generateBlueprint } from '../src/blueprint-gen.js';
import { runPipeline } from '../src/pipeline.js';
import type { DeckBlueprint, ResearchOutput, StorylineOutput } from '../src/types.js';

const THEME_PATH = resolve(import.meta.dirname, '../src/themes/huawei-like.json');

function makeResearch(): ResearchOutput {
  return {
    topic: 'AI Agent 发展趋势',
    generatedAt: '2026-03-27T12:00:00Z',
    sources: [{ id: 'src-1', title: 'Gartner 2026', type: 'report' }],
    findings: [{ id: 'f1', claim: 'Agent 市场 500 亿', sourceIds: ['src-1'], confidence: 'fact' }],
    dataPoints: [{ id: 'dp1', label: '市场规模', value: 500, unit: '亿美元', sourceId: 'src-1' }],
  };
}

function makeStoryline(): StorylineOutput {
  return {
    framework: 'pyramid',
    centralMessage: 'AI Agent 重塑企业软件',
    sections: [
      {
        sectionId: 'sec-1',
        title: '市场',
        purpose: '规模认知',
        slides: [
          { slideId: 's1', intent: 'data-insight', keyMessage: '500 亿市场', supportingPoints: ['40% 增长'] },
          { slideId: 's2', intent: 'content', keyMessage: '三大玩家', supportingPoints: ['OpenAI', 'Anthropic'] },
        ],
      },
      {
        sectionId: 'sec-2',
        title: '技术',
        purpose: '技术趋势',
        slides: [
          { slideId: 's3', intent: 'key-statement', keyMessage: '多模态是未来', supportingPoints: ['视觉', '代码'] },
        ],
      },
    ],
  };
}

function makeBlueprint(storyline: StorylineOutput): DeckBlueprint {
  return generateBlueprint(storyline, { title: 'AI Agent Report', author: 'Cat Café' });
}

describe('runPipeline', () => {
  it('produces a valid pptx buffer', async () => {
    const result = await runPipeline({
      research: makeResearch(),
      storyline: makeStoryline(),
      blueprint: makeBlueprint(makeStoryline()),
      themePath: THEME_PATH,
    });
    assert.ok(result.buffer.length > 10_000, 'Buffer too small');
    // PK zip signature
    assert.equal(result.buffer[0], 0x50);
    assert.equal(result.buffer[1], 0x4b);
  });

  it('returns correct slide count', async () => {
    const storyline = makeStoryline();
    const result = await runPipeline({
      research: makeResearch(),
      storyline,
      blueprint: makeBlueprint(storyline),
      themePath: THEME_PATH,
    });
    // cover + agenda + 2 section-breaks + 3 content + closing = 8
    assert.equal(result.slidesCount, 8);
  });

  it('returns all gate results as pass', async () => {
    const storyline = makeStoryline();
    const result = await runPipeline({
      research: makeResearch(),
      storyline,
      blueprint: makeBlueprint(storyline),
      themePath: THEME_PATH,
    });
    assert.deepEqual(result.gateResults, {
      research: 'pass',
      narrative: 'pass',
      blueprint: 'pass',
    });
  });

  it('rejects if research gate fails', async () => {
    const badResearch = makeResearch();
    badResearch.findings = [];
    const storyline = makeStoryline();
    await assert.rejects(
      () =>
        runPipeline({
          research: badResearch,
          storyline,
          blueprint: makeBlueprint(storyline),
          themePath: THEME_PATH,
        }),
      /research gate/i,
    );
  });

  it('rejects if storyline gate fails', async () => {
    const badStoryline = makeStoryline();
    badStoryline.sections = [];
    await assert.rejects(
      () =>
        runPipeline({
          research: makeResearch(),
          storyline: badStoryline,
          blueprint: makeBlueprint(makeStoryline()),
          themePath: THEME_PATH,
        }),
      /narrative gate/i,
    );
  });

  it('auto-generates blueprint from storyline when blueprint omitted', async () => {
    const storyline = makeStoryline();
    const result = await runPipeline({
      research: makeResearch(),
      storyline,
      themePath: THEME_PATH,
    });
    assert.ok(result.buffer.length > 10_000, 'Buffer too small');
    // cover + agenda + 2 section-breaks + 3 content + closing = 8
    assert.equal(result.slidesCount, 8);
    assert.deepEqual(result.gateResults, { research: 'pass', narrative: 'pass', blueprint: 'pass' });
  });

  it('rejects when explicit blueprint slideIds do not match storyline', async () => {
    const storyline = makeStoryline();
    const blueprint = makeBlueprint(storyline);
    // Tamper: rename a content slideId in blueprint so it no longer matches storyline
    const contentSlide = blueprint.slides.find((s) => s.slideId === 's1');
    assert.ok(contentSlide);
    contentSlide.slideId = 'tampered-id';
    await assert.rejects(
      () =>
        runPipeline({
          research: makeResearch(),
          storyline,
          blueprint,
          themePath: THEME_PATH,
        }),
      /coherence.*mismatch|storyline.*blueprint/i,
    );
  });

  it('writes to outputPath when specified', async () => {
    const { mkdtemp, rm, stat } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const dir = await mkdtemp(resolve(tmpdir(), 'ppt-forge-test-'));
    const outPath = resolve(dir, 'test-output.pptx');
    try {
      const storyline = makeStoryline();
      const result = await runPipeline({
        research: makeResearch(),
        storyline,
        blueprint: makeBlueprint(storyline),
        themePath: THEME_PATH,
        outputPath: outPath,
      });
      assert.equal(result.outputPath, outPath);
      const fileStat = await stat(outPath);
      assert.ok(fileStat.size > 10_000);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
