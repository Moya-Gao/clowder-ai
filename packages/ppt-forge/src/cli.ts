#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closeBrowser, compileAndBuild } from './compiler/index.js';
import { runPipeline } from './pipeline.js';
import { buildDeck } from './slide-builder.js';
import type { DeckBlueprint, ResearchOutput, StorylineOutput, ThemeTokens } from './types.js';

function usage(): never {
  console.error(`Usage:
  ppt-forge build     <blueprint.json> <theme.json> <output.pptx>  [--engine v1|v2]
  ppt-forge pipeline  <research.json> <storyline.json> <theme.json> <output.pptx>
  ppt-forge pipeline  <research.json> <storyline.json> <blueprint.json> <theme.json> <output.pptx>`);
  process.exit(1);
}

async function cmdBuild(args: string[]) {
  // Check for --engine flag
  const engineIdx = args.indexOf('--engine');
  let engine = 'v2'; // Default to V2 (Phase B)
  if (engineIdx !== -1 && args[engineIdx + 1]) {
    engine = args[engineIdx + 1];
    args.splice(engineIdx, 2);
  }

  const [blueprintPath, themePath, outputPath] = args;
  if (!blueprintPath || !themePath || !outputPath) usage();

  const blueprint: DeckBlueprint = JSON.parse(readFileSync(resolve(blueprintPath), 'utf-8'));
  const theme: ThemeTokens = JSON.parse(readFileSync(resolve(themePath), 'utf-8'));

  console.log(
    `[ppt-forge] Building "${blueprint.meta.title}" (${blueprint.slides.length} slides, engine=${engine})...`,
  );

  if (engine === 'v2') {
    const pres = await compileAndBuild(blueprint, theme);
    await pres.writeFile({ fileName: resolve(outputPath) });
    await closeBrowser();
  } else {
    const pres = buildDeck(blueprint, theme);
    await pres.writeFile({ fileName: resolve(outputPath) });
  }
  console.log(`[ppt-forge] Done → ${outputPath}`);
}

async function cmdPipeline(args: string[]) {
  // 4-arg mode: research storyline theme output (blueprint auto-generated)
  // 5-arg mode: research storyline blueprint theme output (explicit blueprint)
  if (args.length < 4) usage();

  const research: ResearchOutput = JSON.parse(readFileSync(resolve(args[0]), 'utf-8'));
  const storyline: StorylineOutput = JSON.parse(readFileSync(resolve(args[1]), 'utf-8'));

  let blueprint: DeckBlueprint | undefined;
  let themePath: string;
  let outputPath: string;

  if (args.length >= 5) {
    blueprint = JSON.parse(readFileSync(resolve(args[2]), 'utf-8'));
    themePath = resolve(args[3]);
    outputPath = resolve(args[4]);
  } else {
    themePath = resolve(args[2]);
    outputPath = resolve(args[3]);
  }

  console.log(`[ppt-forge] Pipeline: "${research.topic}"`);
  console.log(
    `[ppt-forge]   Research: ${research.findings.length} findings, ${research.dataPoints.length} data points`,
  );
  console.log(`[ppt-forge]   Storyline: ${storyline.sections.length} sections, framework=${storyline.framework}`);
  console.log(`[ppt-forge]   Blueprint: ${blueprint ? 'explicit' : 'auto-generate from storyline'}`);

  const result = await runPipeline({
    research,
    storyline,
    blueprint,
    themePath,
    outputPath,
  });

  console.log(`[ppt-forge] ✓ ${result.slidesCount} slides → ${outputPath}`);
  console.log(
    `[ppt-forge]   Gates: research=${result.gateResults.research} narrative=${result.gateResults.narrative} blueprint=${result.gateResults.blueprint}`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'build':
      await cmdBuild(args);
      break;
    case 'pipeline':
      await cmdPipeline(args);
      break;
    default:
      // Backwards-compatible: 3 args = old build mode
      if (process.argv.length === 5) {
        await cmdBuild(process.argv.slice(2));
      } else {
        usage();
      }
  }
}

main().catch((err) => {
  console.error('[ppt-forge] Fatal:', err.message);
  process.exit(1);
});
