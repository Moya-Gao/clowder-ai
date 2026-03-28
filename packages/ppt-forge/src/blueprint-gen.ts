import type {
  DeckBlueprint,
  DeckMeta,
  NarrativeSlide,
  RenderBudget,
  SectionSpec,
  SlideElement,
  SlideSpec,
  StorylineOutput,
  TextElement,
} from './types.js';

/**
 * Suggest a layout based on the slide's intended data visualization.
 * Maps suggestedDataViz → layoutId from the Phase A catalog.
 */
export function suggestLayout(slide: NarrativeSlide): string {
  switch (slide.suggestedDataViz) {
    case 'chart':
      return 'layout-chart-insight';
    case 'table':
      return 'layout-dense-table';
    case 'kpi':
      return 'layout-kpi';
    case 'text-only':
    default:
      return 'layout-title-body';
  }
}

/** Default maxWords by layout complexity */
function defaultBudget(layoutId: string): RenderBudget {
  const budgets: Record<string, number> = {
    'layout-cover': 20,
    'layout-section': 15,
    'layout-closing': 25,
    'layout-title-body': 80,
    'layout-two-col': 100,
    'layout-chart-insight': 60,
    'layout-full-chart': 30,
    'layout-kpi': 40,
    'layout-kpi-4col': 50,
    'layout-dense-table': 30,
  };
  return { maxWords: budgets[layoutId] ?? 60 };
}

/** Create a text element for a slot */
function textElement(slotName: string, content: string): TextElement {
  return { type: 'text', slotName, content };
}

/**
 * Generate a structural blueprint skeleton from a validated StorylineOutput.
 *
 * Output is a TEXT-ONLY skeleton: layout selection + text elements from narrative.
 * Chart/table/KPI data elements are NOT generated — the caller must enrich the
 * skeleton with real data elements before passing to buildDeck(). The skeleton
 * provides correct layout hints (via suggestLayout) and renderBudget defaults.
 */
export function generateBlueprint(storyline: StorylineOutput, meta: Partial<DeckMeta>): DeckBlueprint {
  const slides: SlideSpec[] = [];
  const sections: SectionSpec[] = [];
  const now = new Date().toISOString();

  // ── Cover slide ──
  slides.push({
    slideId: 'slide-cover',
    intent: 'cover',
    purpose: '封面：标题与作者',
    layoutId: 'layout-cover',
    elements: [
      textElement('title', meta.title ?? storyline.centralMessage),
      textElement('subtitle', meta.subtitle ?? ''),
    ],
    renderBudget: defaultBudget('layout-cover'),
  });

  // ── Agenda slide ──
  const agendaContent = storyline.sections.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
  slides.push({
    slideId: 'slide-agenda',
    intent: 'agenda',
    purpose: '议程：展示整体结构',
    layoutId: 'layout-title-body',
    elements: [textElement('title', '议程'), textElement('body', agendaContent)],
    renderBudget: defaultBudget('layout-title-body'),
  });

  // ── Content sections ──
  for (const section of storyline.sections) {
    const sectionSlideIds: string[] = [];

    // Section break
    const sectionBreakId = `slide-${section.sectionId}-break`;
    slides.push({
      slideId: sectionBreakId,
      sectionId: section.sectionId,
      intent: 'section-break',
      purpose: `章节：${section.title}`,
      layoutId: 'layout-section',
      elements: [textElement('label', section.purpose), textElement('title', section.title)],
      renderBudget: defaultBudget('layout-section'),
    });
    sectionSlideIds.push(sectionBreakId);

    // Content slides
    for (const narrativeSlide of section.slides) {
      const layoutId = suggestLayout(narrativeSlide);
      const elements: SlideElement[] = [];

      // Title element (all layouts have a title slot)
      elements.push(textElement('title', narrativeSlide.keyMessage));

      // Body/insight from supporting points
      if (narrativeSlide.supportingPoints.length > 0) {
        const bodyContent = narrativeSlide.supportingPoints.map((p) => `• ${p}`).join('\n');

        if (layoutId === 'layout-chart-insight') {
          elements.push(textElement('insight', bodyContent));
        } else if (layoutId === 'layout-title-body' || layoutId === 'layout-kpi') {
          const bodySlot = layoutId === 'layout-kpi' ? 'detail' : 'body';
          elements.push(textElement(bodySlot, bodyContent));
        }
      }

      slides.push({
        slideId: narrativeSlide.slideId,
        sectionId: section.sectionId,
        intent: narrativeSlide.intent,
        purpose: narrativeSlide.keyMessage,
        layoutId,
        elements,
        renderBudget: defaultBudget(layoutId),
      });
      sectionSlideIds.push(narrativeSlide.slideId);
    }

    sections.push({
      sectionId: section.sectionId,
      title: section.title,
      slideIds: sectionSlideIds,
    });
  }

  // ── Closing slide ──
  slides.push({
    slideId: 'slide-closing',
    intent: 'closing',
    purpose: '结尾：总结与行动号召',
    layoutId: 'layout-closing',
    elements: [textElement('title', '谢谢'), textElement('contact', meta.author ?? '')],
    renderBudget: defaultBudget('layout-closing'),
  });

  return {
    version: '1.0',
    meta: {
      title: meta.title ?? storyline.centralMessage,
      subtitle: meta.subtitle,
      author: meta.author ?? 'PPT Forge',
      createdAt: meta.createdAt ?? now,
      researchRef: meta.researchRef ?? '',
      storylineRef: meta.storylineRef ?? '',
      themeRef: meta.themeRef ?? 'huawei-like',
      framework: storyline.framework,
      targetAudience: meta.targetAudience ?? 'corporate-executive',
    },
    sections,
    slides,
    assets: [],
  };
}
