import type { ResearchOutput, StorylineOutput } from './types.js';

/**
 * Research Gate — validates research output before narrative generation.
 * Checks: ≥1 finding, ≥1 dataPoint, all source references valid.
 */
export function validateResearch(research: ResearchOutput): void {
  const sourceIds = new Set(research.sources.map((s) => s.id));

  if (research.findings.length === 0) {
    throw new Error('Research gate failed: at least 1 finding required');
  }

  for (const finding of research.findings) {
    for (const sid of finding.sourceIds) {
      if (!sourceIds.has(sid)) {
        throw new Error(`Research gate failed: source "${sid}" not found for finding "${finding.id}"`);
      }
    }
  }

  if (research.dataPoints.length === 0) {
    throw new Error('Research gate failed: at least 1 data point required');
  }

  for (const dp of research.dataPoints) {
    if (!sourceIds.has(dp.sourceId)) {
      throw new Error(`Research gate failed: source "${dp.sourceId}" not found for dataPoint "${dp.id}"`);
    }
  }
}

/**
 * Narrative Gate — validates storyline before blueprint generation.
 * Checks: non-empty centralMessage, ≥1 section, every section has slides, every slide has keyMessage.
 */
export function validateStoryline(storyline: StorylineOutput): void {
  if (!storyline.centralMessage.trim()) {
    throw new Error('Narrative gate failed: centralMessage is empty');
  }

  if (storyline.sections.length === 0) {
    throw new Error('Narrative gate failed: at least 1 section required');
  }

  const sectionIds = new Set<string>();
  const slideIds = new Set<string>();

  for (const section of storyline.sections) {
    if (sectionIds.has(section.sectionId)) {
      throw new Error(`Narrative gate failed: duplicate sectionId "${section.sectionId}"`);
    }
    sectionIds.add(section.sectionId);

    if (section.slides.length === 0) {
      throw new Error(`Narrative gate failed: section "${section.sectionId}" has at least 1 slide required`);
    }

    for (const slide of section.slides) {
      if (slideIds.has(slide.slideId)) {
        throw new Error(`Narrative gate failed: duplicate slideId "${slide.slideId}"`);
      }
      slideIds.add(slide.slideId);

      if (!slide.keyMessage.trim()) {
        throw new Error(`Narrative gate failed: slide "${slide.slideId}" keyMessage is empty`);
      }
    }
  }
}
