import type { SignalSource } from '@cat-cafe/shared';
import { load } from 'cheerio';
import type { FetchError, Fetcher, FetchResult, RawArticle } from './types.js';

interface HtmlResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  text(): Promise<string>;
}

export interface HtmlFetchOptions {
  readonly headers?: Record<string, string> | undefined;
  readonly signal?: AbortSignal | undefined;
}

type FetchLike = (url: string, options?: HtmlFetchOptions) => Promise<HtmlResponseLike>;

const DEFAULT_TIMEOUT_MS = 15_000;

function nowIso(): string {
  return new Date().toISOString();
}

function unsupportedSourceError(source: SignalSource): FetchError {
  return {
    code: 'UNSUPPORTED_SOURCE',
    message: `source "${source.id}" is not a webpage source`,
    sourceId: source.id,
  };
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolveAbsoluteUrl(href: string, sourceUrl: string): string {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return href.trim();
  }
}

function parseWebpageArticles(html: string, source: SignalSource, fetchedAt: string): readonly RawArticle[] {
  const selector = source.fetch.selector?.trim();
  if (!selector) {
    throw new Error(`webpage source "${source.id}" requires fetch.selector`);
  }

  const $ = load(html);
  const nodes = $(selector).toArray();
  const articles: RawArticle[] = [];

  for (const node of nodes) {
    const element = $(node);
    const headingText = normalizeText(element.find('h1,h2,h3,h4,h5,h6').first().text());
    const anchor = element.find('a[href]').first();
    const anchorText = normalizeText(anchor.text());
    const href = normalizeText(anchor.attr('href'));
    const title = headingText ?? anchorText ?? normalizeText(element.text());
    const url = href ? resolveAbsoluteUrl(href, source.url) : undefined;

    if (!title || !url) continue;

    const publishedAt = normalizeText(element.find('time[datetime]').first().attr('datetime')) ?? fetchedAt;
    const summary = normalizeText(element.find('p').first().text());

    articles.push({
      url,
      title,
      publishedAt,
      ...(summary ? { summary } : {}),
    });
  }

  return articles;
}

export class WebpageFetcher implements Fetcher {
  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  canHandle(source: SignalSource): boolean {
    return source.fetch.method === 'webpage';
  }

  async fetch(source: SignalSource): Promise<FetchResult> {
    const start = Date.now();
    const fetchedAt = nowIso();

    if (!this.canHandle(source)) {
      return {
        articles: [],
        errors: [unsupportedSourceError(source)],
        metadata: {
          fetchedAt,
          duration: Date.now() - start,
          source: source.id,
        },
      };
    }

    const timeoutMs = source.fetch.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await this.fetchImpl(source.url, {
        headers: source.fetch.headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const articles = parseWebpageArticles(html, source, fetchedAt);

      return {
        articles,
        errors: [],
        metadata: {
          fetchedAt,
          duration: Date.now() - start,
          source: source.id,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        articles: [],
        errors: [
          {
            code: 'WEBPAGE_FETCH_FAILED',
            message,
            sourceId: source.id,
          },
        ],
        metadata: {
          fetchedAt,
          duration: Date.now() - start,
          source: source.id,
        },
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
