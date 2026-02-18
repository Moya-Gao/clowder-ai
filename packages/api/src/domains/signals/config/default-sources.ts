import type { SignalSourceConfig } from '@cat-cafe/shared';

export const DEFAULT_SIGNAL_SOURCES: SignalSourceConfig = {
  version: 1,
  sources: [
    {
      id: 'anthropic-news',
      name: 'Anthropic Newsroom',
      url: 'https://www.anthropic.com/news',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: {
        method: 'webpage',
        selector: 'article, .news-item',
      },
      schedule: {
        frequency: 'daily',
      },
    },
    {
      id: 'openai-news-rss',
      name: 'OpenAI News RSS',
      url: 'https://openai.com/news/rss.xml',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: {
        method: 'rss',
      },
      schedule: {
        frequency: 'daily',
      },
    },
    {
      id: 'arxiv-cs-cl',
      name: 'arXiv cs.CL',
      url: 'https://export.arxiv.org/rss/cs.CL',
      tier: 1,
      category: 'papers',
      enabled: true,
      fetch: {
        method: 'rss',
      },
      schedule: {
        frequency: 'daily',
      },
      filters: {
        keywords: {
          include: ['agent', 'llm', 'context', 'tool', 'mcp', 'rag'],
        },
      },
    },
  ],
};
