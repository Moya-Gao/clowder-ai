import { readFile, writeFile } from 'node:fs/promises';
import { generateBlueprint } from './blueprint-gen.js';
import { validateResearch, validateStoryline } from './gates.js';
import { buildDeck } from './slide-builder.js';
import type { DeckBlueprint, ResearchOutput, StorylineOutput, ThemeTokens } from './types.js';

export interface PipelineInput {
  research: ResearchOutput;
  storyline: StorylineOutput;
  /** Optional — when omitted, auto-generated from storyline via generateBlueprint(). */
  blueprint?: DeckBlueprint;
  themePath: string;
  outputPath?: string;
}

export interface PipelineResult {
  slidesCount: number;
  outputPath?: string;
  buffer: Buffer;
  gateResults: { research: 'pass'; narrative: 'pass'; blueprint: 'pass' };
}

/**
 * Collect all storyline slideIds (content slides only, not auto-generated structural slides).
 */
function collectStorylineSlideIds(storyline: StorylineOutput): Set<string> {
  const ids = new Set<string>();
  for (const section of storyline.sections) {
    for (const slide of section.slides) {
      ids.add(slide.slideId);
    }
  }
  return ids;
}

/**
 * Coherence gate: when an explicit blueprint is provided, verify every storyline
 * content slideId appears in the blueprint. This prevents stale/mismatched blueprints
 * from silently passing through.
 */
function validateCoherence(storyline: StorylineOutput, blueprint: DeckBlueprint): void {
  const storylineIds = collectStorylineSlideIds(storyline);
  const blueprintIds = new Set(blueprint.slides.map((s) => s.slideId));
  for (const id of storylineIds) {
    if (!blueprintIds.has(id)) {
      throw new Error(
        `Coherence gate: storyline slideId "${id}" not found in blueprint — storyline/blueprint mismatch`,
      );
    }
  }
}

/**
 * Run the full PPT Forge pipeline:
 * 1. Validate research (Research Gate)
 * 2. Validate storyline (Narrative Gate)
 * 3. Auto-generate or validate blueprint (Blueprint Gate)
 * 4. Build deck from blueprint + theme (Export Gate = buildDeck internal validation)
 * 5. Optionally write to outputPath
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  // Gate 1: Research
  validateResearch(input.research);

  // Gate 2: Narrative
  validateStoryline(input.storyline);

  // Gate 3: Blueprint — auto-generate from storyline or validate coherence with explicit blueprint
  const blueprint =
    input.blueprint ??
    generateBlueprint(input.storyline, {
      title: input.research.topic,
      subtitle: `Generated ${input.research.generatedAt}`,
    });

  if (input.blueprint) {
    validateCoherence(input.storyline, blueprint);
  }

  // Gate 4: Export (buildDeck validates hex colors + slots internally)
  const themeJson = await readFile(input.themePath, 'utf-8');
  const theme: ThemeTokens = JSON.parse(themeJson);
  const pptx = buildDeck(blueprint, theme);
  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;

  // Write to disk if outputPath specified
  if (input.outputPath) {
    await writeFile(input.outputPath, buffer);
  }

  return {
    slidesCount: blueprint.slides.length,
    outputPath: input.outputPath,
    buffer,
    gateResults: { research: 'pass', narrative: 'pass', blueprint: 'pass' },
  };
}
