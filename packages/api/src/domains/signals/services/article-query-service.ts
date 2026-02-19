import type { SignalArticle, SignalArticleStatus, SignalTier } from '@cat-cafe/shared';
import { SignalArticleSchema } from '@cat-cafe/shared';
import type { SignalPaths } from '../config/signal-paths.js';
import { resolveSignalPaths } from '../config/signal-paths.js';
import {
  readArticleDocument,
  toUpdatedFrontmatter,
  type SignalArticleDetail,
  writeArticleDocument,
} from './article-document.js';
import { computeSignalArticleStats, type SignalArticleStats } from './article-stats.js';
import { readInboxRecords } from './inbox-records.js';

export type { SignalArticleDetail } from './article-document.js';

export interface ListInboxOptions {
  readonly date?: string | undefined;
  readonly limit?: number | undefined;
  readonly source?: string | undefined;
  readonly tier?: SignalTier | undefined;
}

export interface SearchSignalArticlesOptions {
  readonly query: string;
  readonly limit?: number | undefined;
  readonly source?: string | undefined;
  readonly tier?: SignalTier | undefined;
  readonly dateFrom?: string | undefined;
  readonly dateTo?: string | undefined;
}

export interface UpdateSignalArticleInput {
  readonly status?: SignalArticleStatus | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly summary?: string | undefined;
}

function withinDateRange(targetIso: string, from: string | undefined, to: string | undefined): boolean {
  const target = Date.parse(targetIso);
  if (Number.isNaN(target)) {
    return false;
  }

  const fromValue = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
  const toValue = to ? Date.parse(to) : Number.POSITIVE_INFINITY;

  return target >= fromValue && target <= toValue;
}

export class SignalArticleQueryService {
  private readonly paths: SignalPaths;

  constructor(options?: { paths?: SignalPaths | undefined }) {
    this.paths = options?.paths ?? resolveSignalPaths();
  }

  async listInbox(options: ListInboxOptions = {}): Promise<readonly SignalArticle[]> {
    const date = options.date?.trim() || new Date().toISOString().slice(0, 10);
    const records = await readInboxRecords(this.paths, date);
    const details = await Promise.all(records.map((record) => readArticleDocument(record)));

    const filtered = details
      .map((detail) => detail.article)
      .filter((article) => article.status === 'inbox')
      .filter((article) => (options.source ? article.source === options.source : true))
      .filter((article) => (options.tier ? article.tier === options.tier : true))
      .sort((left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt));

    return filtered.slice(0, options.limit ?? 20);
  }

  async getArticleById(id: string): Promise<SignalArticleDetail | null> {
    const records = await readInboxRecords(this.paths, undefined);
    const matched = records.find((record) => record.id === id);
    if (!matched) {
      return null;
    }

    const detail = await readArticleDocument(matched);
    return {
      ...detail.article,
      content: detail.content,
    };
  }

  async getArticleByUrl(url: string): Promise<SignalArticleDetail | null> {
    const normalized = url.trim();
    if (normalized.length === 0) {
      return null;
    }

    const records = await readInboxRecords(this.paths, undefined);
    const matched = records.find((record) => record.url === normalized);
    if (!matched) {
      return null;
    }

    const detail = await readArticleDocument(matched);
    return {
      ...detail.article,
      content: detail.content,
    };
  }

  async search(options: SearchSignalArticlesOptions): Promise<{ readonly total: number; readonly items: readonly SignalArticle[] }> {
    const query = options.query.trim().toLowerCase();
    if (query.length === 0) {
      return {
        total: 0,
        items: [],
      };
    }

    const records = await readInboxRecords(this.paths, undefined);
    const details = await Promise.all(records.map((record) => readArticleDocument(record)));

    const matched = details
      .filter((detail) => (options.source ? detail.article.source === options.source : true))
      .filter((detail) => (options.tier ? detail.article.tier === options.tier : true))
      .filter((detail) => withinDateRange(detail.article.fetchedAt, options.dateFrom, options.dateTo))
      .filter((detail) => {
        const haystacks = [
          detail.article.title,
          detail.article.url,
          detail.article.source,
          detail.article.summary ?? '',
          detail.content,
        ].map((value) => value.toLowerCase());
        return haystacks.some((value) => value.includes(query));
      })
      .map((detail) => detail.article)
      .sort((left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt));

    const limit = options.limit ?? 20;
    return {
      total: matched.length,
      items: matched.slice(0, limit),
    };
  }

  async updateArticle(id: string, input: UpdateSignalArticleInput): Promise<SignalArticleDetail | null> {
    const records = await readInboxRecords(this.paths, undefined);
    const matched = records.find((record) => record.id === id);
    if (!matched) {
      return null;
    }

    const detail = await readArticleDocument(matched);
    const { summary: _previousSummary, ...articleWithoutSummary } = detail.article;
    const nextSummary =
      input.summary === undefined
        ? detail.article.summary
        : input.summary.trim();
    const nextArticle: SignalArticle = SignalArticleSchema.parse({
      ...articleWithoutSummary,
      ...(input.status ? { status: input.status } : {}),
      ...(input.tags ? { tags: Array.from(input.tags) } : {}),
      ...(nextSummary ? { summary: nextSummary } : {}),
    }) as SignalArticle;

    await writeArticleDocument({
      filePath: detail.article.filePath,
      frontmatter: toUpdatedFrontmatter(detail.frontmatter, nextArticle),
      content: detail.content,
    });

    return {
      ...nextArticle,
      content: detail.content,
    };
  }

  async getStats(now: Date = new Date()): Promise<SignalArticleStats> {
    const records = await readInboxRecords(this.paths, undefined);
    const details = await Promise.all(records.map((record) => readArticleDocument(record)));
    return computeSignalArticleStats(
      details.map((detail) => detail.article),
      now,
    );
  }
}
