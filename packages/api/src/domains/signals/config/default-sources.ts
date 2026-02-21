import type { SignalSourceConfig } from '@cat-cafe/shared';

/**
 * Default signal sources for Cat Café Signal Hunter.
 *
 * Sources are grouped by tier and category.
 * New sources default to `schedule: { frequency: 'manual' }` so they
 * won't auto-fetch until each one is manually tested and promoted.
 *
 * Full list based on:
 *  - 缅因猫调研: docs/archive/2026-02/research/signal-hunter.md
 *  - 集成讨论: docs/archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md
 *  - 布偶猫补充: xAI, Mistral, Cohere, Together AI, Groq
 *  - Gap 审计: docs/plans/2026-02-20-f21-signal-sources-gap.md
 */
export const DEFAULT_SIGNAL_SOURCES: SignalSourceConfig = {
  version: 1,
  sources: [
    // ================================================================
    // Tier 1: Anthropic (P0 — 铲屎官特别指出)
    // ================================================================
    {
      id: 'anthropic-news',
      name: 'Anthropic Newsroom',
      url: 'https://www.anthropic.com/news',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .news-item' },
      schedule: { frequency: 'daily' },
    },
    {
      id: 'anthropic-research',
      name: 'Anthropic Research',
      url: 'https://www.anthropic.com/research',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .research-item, a[href*="/research/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'anthropic-engineering',
      name: 'Anthropic Engineering',
      url: 'https://www.anthropic.com/engineering',
      tier: 1,
      category: 'engineering',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .engineering-item, a[href*="/engineering/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'anthropic-alignment',
      name: 'Anthropic Alignment Science',
      url: 'https://alignment.anthropic.com/',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .post-item, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: OpenAI
    // ================================================================
    {
      id: 'openai-news-rss',
      name: 'OpenAI News RSS',
      url: 'https://openai.com/news/rss.xml',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'daily' },
    },
    {
      id: 'openai-research',
      name: 'OpenAI Research',
      url: 'https://openai.com/research/',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, a[href*="/research/"]' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: Google (DeepMind + Research)
    // ================================================================
    {
      id: 'deepmind-blog',
      name: 'Google DeepMind Blog',
      url: 'https://deepmind.google/blog/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-card, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'deepmind-publications',
      name: 'Google DeepMind Publications',
      url: 'https://deepmind.google/research/publications/',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .publication-card' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'google-research-blog',
      name: 'Google Research Blog',
      url: 'https://research.google/blog/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-card' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'google-blog-ai',
      name: 'Google Blog AI',
      url: 'https://blog.google/technology/ai/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .uni-blog-article' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: Meta AI
    // ================================================================
    {
      id: 'meta-ai-blog',
      name: 'Meta AI Blog',
      url: 'https://ai.meta.com/blog/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-post-card, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'meta-research-publications',
      name: 'Meta Research Publications',
      url: 'https://research.facebook.com/publications/',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .publication-card' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: Microsoft + Apple + AWS (RSS available)
    // ================================================================
    {
      id: 'microsoft-research-rss',
      name: 'Microsoft Research Blog',
      url: 'https://www.microsoft.com/en-us/research/blog/feed/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'apple-ml-rss',
      name: 'Apple ML Research',
      url: 'https://machinelearning.apple.com/feed.xml',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'aws-ml-blog-rss',
      name: 'AWS ML Blog',
      url: 'https://aws.amazon.com/blogs/machine-learning/feed/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'amazon-science',
      name: 'Amazon Science',
      url: 'https://www.amazon.science/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .card, a[href*="/publications/"]' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: Other global labs (布偶猫补充)
    // ================================================================
    {
      id: 'xai-blog',
      name: 'xAI Blog',
      url: 'https://x.ai/blog',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-post, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'mistral-news',
      name: 'Mistral AI News',
      url: 'https://mistral.ai/news/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, a[href*="/news/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'cohere-research',
      name: 'Cohere Research',
      url: 'https://cohere.com/research',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .card' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'together-ai-blog',
      name: 'Together AI Blog',
      url: 'https://www.together.ai/blog',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-card, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'groq-news',
      name: 'Groq News',
      url: 'https://groq.com/news/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .news-item' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: 国内厂商
    // ================================================================
    {
      id: 'deepseek-api-news',
      name: 'DeepSeek API News',
      url: 'https://api-docs.deepseek.com/news',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .news-item, main a' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'qwen-blog',
      name: 'Qwen Blog',
      url: 'https://qwenlm.github.io/blog/',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .post-card, a[href*="/blog/"]' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'moonshot-docs',
      name: 'Moonshot Docs',
      url: 'https://platform.moonshot.ai/docs/overview',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, main' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'zhipu-report',
      name: '智谱技术报告',
      url: 'https://bigmodel.cn/technology-report',
      tier: 1,
      category: 'research',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .report-card' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'bytedance-seed-blog',
      name: '字节 Seed Blog',
      url: 'https://seed.bytedance.com/blog',
      tier: 1,
      category: 'official',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .blog-card' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1: 国内厂商 GitHub (API fetcher)
    // ================================================================
    {
      id: 'deepseek-github',
      name: 'DeepSeek GitHub Repos',
      url: 'https://api.github.com/orgs/deepseek-ai/repos?sort=updated&per_page=10',
      tier: 1,
      category: 'engineering',
      enabled: true,
      fetch: {
        method: 'api',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'qwen-github',
      name: 'Qwen GitHub Repos',
      url: 'https://api.github.com/orgs/QwenLM/repos?sort=updated&per_page=10',
      tier: 1,
      category: 'engineering',
      enabled: true,
      fetch: {
        method: 'api',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 1/2: 论文平台
    // ================================================================
    {
      id: 'arxiv-cs-cl',
      name: 'arXiv cs.CL',
      url: 'https://export.arxiv.org/rss/cs.CL',
      tier: 1,
      category: 'papers',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'daily' },
      filters: {
        keywords: {
          include: ['agent', 'llm', 'context', 'tool', 'mcp', 'rag'],
        },
      },
    },
    {
      id: 'arxiv-cs-ai',
      name: 'arXiv cs.AI',
      url: 'https://export.arxiv.org/rss/cs.AI',
      tier: 1,
      category: 'papers',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
      filters: {
        keywords: {
          include: ['agent', 'llm', 'reasoning', 'planning', 'tool use', 'mcp'],
        },
      },
    },
    {
      id: 'arxiv-cs-lg',
      name: 'arXiv cs.LG',
      url: 'https://export.arxiv.org/rss/cs.LG',
      tier: 1,
      category: 'papers',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
      filters: {
        keywords: {
          include: ['transformer', 'llm', 'language model', 'fine-tuning', 'rlhf', 'alignment'],
        },
      },
    },
    {
      id: 'huggingface-papers',
      name: 'HuggingFace Papers',
      url: 'https://huggingface.co/papers',
      tier: 2,
      category: 'papers',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, a[href*="/papers/"]' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 2: 开源社区与框架
    // ================================================================
    {
      id: 'langchain-blog-rss',
      name: 'LangChain Blog',
      url: 'https://blog.langchain.dev/rss/',
      tier: 2,
      category: 'engineering',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'github-trending',
      name: 'GitHub Trending',
      url: 'https://github.com/trending',
      tier: 2,
      category: 'community',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article.Box-row, .Box-row' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'vllm-github',
      name: 'vLLM GitHub Releases',
      url: 'https://api.github.com/repos/vllm-project/vllm/releases?per_page=5',
      tier: 1,
      category: 'engineering',
      enabled: true,
      fetch: {
        method: 'api',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'llamacpp-github',
      name: 'llama.cpp GitHub Releases',
      url: 'https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=5',
      tier: 1,
      category: 'engineering',
      enabled: true,
      fetch: {
        method: 'api',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'ollama-github',
      name: 'Ollama GitHub Releases',
      url: 'https://api.github.com/repos/ollama/ollama/releases?per_page=5',
      tier: 2,
      category: 'engineering',
      enabled: true,
      fetch: {
        method: 'api',
        headers: { Accept: 'application/vnd.github.v3+json' },
      },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 2-3: 技术博主
    // ================================================================
    {
      id: 'simon-willison',
      name: 'Simon Willison',
      url: 'https://simonwillison.net/',
      tier: 2,
      category: 'community',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .entry, .day .entry' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'lilian-weng',
      name: "Lilian Weng (Lil'Log)",
      url: 'https://lilianweng.github.io/',
      tier: 2,
      category: 'community',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .post-link' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'chip-huyen',
      name: 'Chip Huyen',
      url: 'https://huyenchip.com/',
      tier: 3,
      category: 'community',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .post' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 3: VC / 行业分析
    // ================================================================
    {
      id: 'latent-space-rss',
      name: 'Latent Space',
      url: 'https://www.latent.space/feed',
      tier: 3,
      category: 'community',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
    },
    {
      id: 'a16z-ai',
      name: 'a16z AI',
      url: 'https://a16z.com/ai/',
      tier: 3,
      category: 'community',
      enabled: true,
      fetch: { method: 'webpage', selector: 'article, .post-card' },
      schedule: { frequency: 'manual' },
    },

    // ================================================================
    // Tier 3: 社区 / 聚合
    // ================================================================
    {
      id: 'hacker-news-rss',
      name: 'Hacker News',
      url: 'https://news.ycombinator.com/rss',
      tier: 3,
      category: 'community',
      enabled: true,
      fetch: { method: 'rss' },
      schedule: { frequency: 'manual' },
      filters: {
        keywords: {
          include: ['ai', 'llm', 'gpt', 'claude', 'gemini', 'agent', 'transformer', 'machine learning'],
        },
      },
    },
  ],
};
