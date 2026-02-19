import { appendFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SignalArticle, SignalSource, SignalSourceConfig } from '@cat-cafe/shared';
import type { SignalNotificationConfig } from '../config/notifications-loader.js';
import { loadSignalNotifications } from '../config/notifications-loader.js';
import type { SignalPaths } from '../config/signal-paths.js';
import { resolveSignalPaths } from '../config/signal-paths.js';
import { loadSignalSources } from '../config/sources-loader.js';
import { ApiFetcher } from '../fetchers/api-fetcher.js';
import { RssFetcher } from '../fetchers/rss-fetcher.js';
import type { FetchError, FetchErrorCode, Fetcher, FetchResult } from '../fetchers/types.js';
import { WebpageFetcher } from '../fetchers/webpage-fetcher.js';
import { renderDailyDigestEmail } from '../templates/daily-digest.js';
import type { StoreArticleInput } from './article-store.js';
import { ArticleStoreService } from './article-store.js';
import { DeduplicationService } from './deduplication.js';
import type { EmailSendResult } from './email-service.js';
import { SignalEmailService } from './email-service.js';
import type { InAppNotificationResult, InAppNotificationSink, PublishDailyDigestInput } from './in-app-notification.js';
import { SignalInAppNotificationService } from './in-app-notification.js';

interface DeduplicationLike {
  checkAndMark(url: string): {
    readonly articleId: string;
    readonly isNew: boolean;
  };
}

interface ArticleStoreLike {
  store(input: StoreArticleInput): Promise<SignalArticle>;
}

interface EmailServiceLike {
  sendDailyDigest(message: { subject: string; html: string; text: string }): Promise<EmailSendResult>;
}

interface InAppServiceLike {
  publishDailyDigest(input: PublishDailyDigestInput): Promise<InAppNotificationResult>;
}

interface SourceProcessingResult {
  readonly errors: readonly FetchError[];
  readonly fetchedArticles: number;
  readonly duplicateArticles: number;
  readonly storedArticles: readonly SignalArticle[];
}

interface SchedulerServices {
  readonly deduplication: DeduplicationLike;
  readonly articleStore: ArticleStoreLike;
}

export interface SignalFetchSchedulerSummary {
  readonly dryRun: boolean;
  readonly fetchedAt: string;
  readonly processedSources: number;
  readonly skippedSources: number;
  readonly fetchedArticles: number;
  readonly newArticles: number;
  readonly storedArticles: number;
  readonly duplicateArticles: number;
  readonly errors: readonly FetchError[];
  readonly notifications?:
    | {
        readonly email: EmailSendResult;
        readonly inApp: InAppNotificationResult;
      }
    | undefined;
}

export interface SignalFetchSchedulerOptions {
  readonly sourceId?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly paths?: SignalPaths | undefined;
  readonly now?: (() => Date) | undefined;
  readonly fetchers?: readonly Fetcher[] | undefined;
  readonly loadSources?: ((paths: SignalPaths) => Promise<SignalSourceConfig>) | undefined;
  readonly loadNotifications?: ((paths: SignalPaths) => Promise<SignalNotificationConfig>) | undefined;
  readonly loadKnownUrls?: ((paths: SignalPaths) => Promise<readonly string[]>) | undefined;
  readonly createDeduplicationService?: ((initialUrls: readonly string[]) => DeduplicationLike) | undefined;
  readonly articleStore?: ArticleStoreLike | undefined;
  readonly createEmailService?: ((config: SignalNotificationConfig) => EmailServiceLike) | undefined;
  readonly createInAppService?:
    | ((config: SignalNotificationConfig, paths: SignalPaths) => InAppServiceLike)
    | undefined;
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

function selectSources(config: SignalSourceConfig, sourceId: string | undefined): readonly SignalSource[] {
  if (!sourceId) {
    return config.sources.filter((source) => source.enabled && source.schedule.frequency !== 'manual');
  }

  const matched = config.sources.find((source) => source.id === sourceId);
  if (!matched) {
    throw new Error(`source "${sourceId}" not found in sources config`);
  }
  return [matched];
}

function createDefaultInAppSink(paths: SignalPaths): InAppNotificationSink {
  const logPath = join(paths.logsDir, 'signals-in-app.log');

  return {
    async publish(event): Promise<void> {
      const payload = {
        threadId: event.threadId,
        content: event.content,
        createdAt: new Date().toISOString(),
      };
      await appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8');
    },
  };
}

function createDefaultFetchers(): readonly Fetcher[] {
  return [new RssFetcher(), new ApiFetcher(), new WebpageFetcher()];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asInboxUrlRecord(value: unknown): { readonly url: string } | null {
  const record = asRecord(value);
  if (!record) return null;

  const maybeUrl = (record as { url?: unknown }).url;
  if (typeof maybeUrl !== 'string') return null;

  return { url: maybeUrl };
}

async function listInboxFiles(paths: SignalPaths): Promise<readonly string[]> {
  try {
    const files = await readdir(paths.inboxDir);
    return files.filter((file) => file.endsWith('.json'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function parseInboxUrls(payload: unknown): readonly string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const urls: string[] = [];
  for (const item of payload) {
    const record = asInboxUrlRecord(item);
    if (!record) continue;
    const url = record.url.trim();
    if (url.length > 0) {
      urls.push(url);
    }
  }
  return urls;
}

async function loadUrlsFromInboxFile(inboxFilePath: string): Promise<readonly string[]> {
  try {
    const raw = await readFile(inboxFilePath, 'utf-8');
    const payload = JSON.parse(raw) as unknown;
    return parseInboxUrls(payload);
  } catch {
    return [];
  }
}

async function loadKnownUrlsFromInbox(paths: SignalPaths): Promise<readonly string[]> {
  const files = await listInboxFiles(paths);
  const knownUrls = new Set<string>();

  for (const file of files) {
    const urls = await loadUrlsFromInboxFile(join(paths.inboxDir, file));
    for (const url of urls) {
      knownUrls.add(url);
    }
  }

  return Array.from(knownUrls);
}

function resolveSchedulerServices(
  options: SignalFetchSchedulerOptions,
  initialKnownUrls: readonly string[],
  paths: SignalPaths,
): SchedulerServices {
  const deduplication = options.createDeduplicationService
    ? options.createDeduplicationService(initialKnownUrls)
    : new DeduplicationService(initialKnownUrls);
  const articleStore = options.articleStore ?? new ArticleStoreService({ paths });

  return {
    deduplication,
    articleStore,
  };
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

async function processSources(params: {
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

async function sendDigestNotifications(params: {
  options: SignalFetchSchedulerOptions;
  paths: SignalPaths;
  date: string;
  articles: readonly SignalArticle[];
  loadNotifications: (paths: SignalPaths) => Promise<SignalNotificationConfig>;
}): Promise<{ readonly email: EmailSendResult; readonly inApp: InAppNotificationResult }> {
  const notificationsConfig = await params.loadNotifications(params.paths);
  const emailService = params.options.createEmailService
    ? params.options.createEmailService(notificationsConfig)
    : new SignalEmailService({ config: notificationsConfig });
  const inAppService = params.options.createInAppService
    ? params.options.createInAppService(notificationsConfig, params.paths)
    : new SignalInAppNotificationService({
        config: notificationsConfig,
        sink: createDefaultInAppSink(params.paths),
      });
  const digest = renderDailyDigestEmail({ date: params.date, articles: params.articles });

  const [emailResult, inAppResult] = await Promise.all([
    emailService.sendDailyDigest(digest),
    inAppService.publishDailyDigest({ date: params.date, articles: params.articles }),
  ]);

  return {
    email: emailResult,
    inApp: inAppResult,
  };
}

export async function runSignalFetchScheduler(
  options: SignalFetchSchedulerOptions = {},
): Promise<SignalFetchSchedulerSummary> {
  const now = options.now ?? (() => new Date());
  const fetchedAt = now().toISOString();
  const paths = options.paths ?? resolveSignalPaths();
  const dryRun = options.dryRun ?? false;
  const loadSources = options.loadSources ?? ((currentPaths) => loadSignalSources(currentPaths));
  const loadNotifications = options.loadNotifications ?? ((currentPaths) => loadSignalNotifications(currentPaths));
  const fetchers = options.fetchers ?? createDefaultFetchers();

  const sourceConfig = await loadSources(paths);
  const selectedSources = selectSources(sourceConfig, options.sourceId);
  const initialKnownUrls = await (options.loadKnownUrls ?? loadKnownUrlsFromInbox)(paths);
  const services = resolveSchedulerServices(options, initialKnownUrls, paths);
  const sourceResults = await processSources({
    sources: selectedSources,
    fetchers,
    dryRun,
    deduplication: services.deduplication,
    articleStore: services.articleStore,
  });

  const summaryBase = {
    dryRun,
    fetchedAt,
    processedSources: selectedSources.length,
    skippedSources: sourceConfig.sources.length - selectedSources.length,
    fetchedArticles: sourceResults.fetchedArticles,
    newArticles: sourceResults.fetchedArticles - sourceResults.duplicateArticles,
    storedArticles: sourceResults.storedArticles.length,
    duplicateArticles: sourceResults.duplicateArticles,
    errors: sourceResults.errors,
  };

  if (dryRun || selectedSources.length === 0) {
    return {
      ...summaryBase,
      storedArticles: 0,
    };
  }

  const notifications = await sendDigestNotifications({
    options,
    paths,
    date: fetchedAt.slice(0, 10),
    articles: sourceResults.storedArticles,
    loadNotifications,
  });

  return {
    ...summaryBase,
    notifications,
  };
}
