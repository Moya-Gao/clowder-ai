import type { SignalArticle, SignalSource, SignalSourceConfig } from '@cat-cafe/shared';
import type { FetchError, FetchErrorCode, Fetcher, FetchResult } from '../fetchers/types.js';
import type { StoreArticleInput } from './article-store.js';

export interface DeduplicationLike {
  checkAndMark(url: string): {
    readonly articleId: string;
    readonly isNew: boolean;
  };
}

export interface ArticleStoreLike {
  store(input: StoreArticleInput): Promise<SignalArticle>;
}

export interface SourceProcessingResult {
  readonly errors: readonly FetchError[];
  readonly fetchedArticles: number;
  readonly duplicateArticles: number;
  readonly storedArticles: readonly SignalArticle[];
}

function createFetchError(code: FetchErrorCode, sourceId: string, message: string): FetchError {
  return {
    code,
    sourceId,
    message,
  };
}

function toFailureCode(method: 'rss' | 'api' | 'webpage'): FetchErrorCode {
  if (method === 'rss') return 'RSS_FETCH_FAILED';
  if (method === 'api') return 'API_FETCH_FAILED';
  return 'WEBPAGE_FETCH_FAILED';
}

export function selectSources(config: SignalSourceConfig, sourceId: string | undefined): readonly SignalSource[] {
  if (!sourceId) {
    return config.sources.filter((source) => source.enabled && source.schedule.frequency !== 'manual');
  }

  const matched = config.sources.find((source) => source.id === sourceId);
  if (!matched) {
    throw new Error(`source "${sourceId}" not found in sources config`);
  }
  return [matched];
}

async function fetchSourceResult(source: SignalSource, fetcher: Fetcher): Promise<FetchResult | FetchError> {
  try {
    return await fetcher.fetch(source);
  } catch (error) {
    return createFetchError(
      toFailureCode(source.fetch.method),
      source.id,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function storeFetchedArticles(params: {
  source: SignalSource;
  result: FetchResult;
  dryRun: boolean;
  deduplication: DeduplicationLike;
  articleStore: ArticleStoreLike;
}): Promise<Pick<SourceProcessingResult, 'duplicateArticles' | 'storedArticles'>> {
  const storedArticles: SignalArticle[] = [];
  let duplicateArticles = 0;

  for (const rawArticle of params.result.articles) {
    const dedup = params.deduplication.checkAndMark(rawArticle.url);
    if (!dedup.isNew) {
      duplicateArticles += 1;
      continue;
    }

    if (params.dryRun) continue;

    const stored = await params.articleStore.store({
      source: params.source,
      article: rawArticle,
      articleId: dedup.articleId,
      fetchedAt: params.result.metadata.fetchedAt,
    });
    storedArticles.push(stored);
  }

  return {
    duplicateArticles,
    storedArticles,
  };
}

async function processSource(params: {
  source: SignalSource;
  fetchers: readonly Fetcher[];
  dryRun: boolean;
  deduplication: DeduplicationLike;
  articleStore: ArticleStoreLike;
}): Promise<SourceProcessingResult> {
  const fetcher = params.fetchers.find((candidate) => candidate.canHandle(params.source));
  if (!fetcher) {
    return {
      errors: [
        createFetchError('UNSUPPORTED_SOURCE', params.source.id, `no fetcher supports source "${params.source.id}"`),
      ],
      fetchedArticles: 0,
      duplicateArticles: 0,
      storedArticles: [],
    };
  }

  const fetched = await fetchSourceResult(params.source, fetcher);
  if ('code' in fetched) {
    return {
      errors: [fetched],
      fetchedArticles: 0,
      duplicateArticles: 0,
      storedArticles: [],
    };
  }

  const stored = await storeFetchedArticles({
    source: params.source,
    result: fetched,
    dryRun: params.dryRun,
    deduplication: params.deduplication,
    articleStore: params.articleStore,
  });

  return {
    errors: fetched.errors,
    fetchedArticles: fetched.articles.length,
    duplicateArticles: stored.duplicateArticles,
    storedArticles: stored.storedArticles,
  };
}

export async function processSources(params: {
  sources: readonly SignalSource[];
  fetchers: readonly Fetcher[];
  dryRun: boolean;
  deduplication: DeduplicationLike;
  articleStore: ArticleStoreLike;
}): Promise<{
  readonly errors: readonly FetchError[];
  readonly fetchedArticles: number;
  readonly duplicateArticles: number;
  readonly storedArticles: readonly SignalArticle[];
}> {
  const errors: FetchError[] = [];
  const storedArticles: SignalArticle[] = [];
  let fetchedArticles = 0;
  let duplicateArticles = 0;

  for (const source of params.sources) {
    const sourceResult = await processSource({
      source,
      fetchers: params.fetchers,
      dryRun: params.dryRun,
      deduplication: params.deduplication,
      articleStore: params.articleStore,
    });

    errors.push(...sourceResult.errors);
    fetchedArticles += sourceResult.fetchedArticles;
    duplicateArticles += sourceResult.duplicateArticles;
    storedArticles.push(...sourceResult.storedArticles);
  }

  return {
    errors,
    fetchedArticles,
    duplicateArticles,
    storedArticles,
  };
}
