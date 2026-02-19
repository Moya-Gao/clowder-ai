import type { SignalArticle, SignalSource, SignalTier, SignalArticleStatus } from '@cat-cafe/shared';
import { apiFetch } from '@/utils/api-client';

export interface SignalArticleDetail extends SignalArticle {
  readonly content: string;
}

export interface SignalArticleStats {
  readonly todayCount: number;
  readonly weekCount: number;
  readonly unreadCount: number;
  readonly byTier: Record<string, number>;
  readonly bySource: Record<string, number>;
}

export interface SignalsSearchOptions {
  readonly limit?: number | undefined;
  readonly source?: string | undefined;
  readonly tier?: SignalTier | undefined;
  readonly dateFrom?: string | undefined;
  readonly dateTo?: string | undefined;
}

export interface SignalsInboxOptions {
  readonly date?: string | undefined;
  readonly limit?: number | undefined;
  readonly source?: string | undefined;
  readonly tier?: SignalTier | undefined;
}

export interface SignalArticleUpdateInput {
  readonly status?: SignalArticleStatus | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly summary?: string | undefined;
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | number | undefined): void {
  if (value === undefined || value === '') {
    return;
  }
  params.set(key, String(value));
}

function withQuery(path: string, values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    appendIfPresent(params, key, value);
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
    if (typeof payload.detail === 'string' && payload.detail.trim().length > 0) {
      return payload.detail;
    }
  } catch {
    // Ignore JSON parse errors and fallback to generic message.
  }
  return `Server error: ${response.status}`;
}

async function requireOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  throw new Error(await readApiError(response));
}

export async function fetchSignalsInbox(options: SignalsInboxOptions = {}): Promise<readonly SignalArticle[]> {
  const response = await apiFetch(
    withQuery('/api/signals/inbox', {
      date: options.date,
      limit: options.limit ?? 20,
      source: options.source,
      tier: options.tier,
    }),
  );
  await requireOk(response);
  const data = (await response.json()) as { items: readonly SignalArticle[] };
  return data.items;
}

export async function searchSignals(
  query: string,
  options: SignalsSearchOptions = {},
): Promise<{ readonly total: number; readonly items: readonly SignalArticle[] }> {
  const response = await apiFetch(
    withQuery('/api/signals/search', {
      q: query,
      limit: options.limit ?? 20,
      source: options.source,
      tier: options.tier,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    }),
  );
  await requireOk(response);
  return (await response.json()) as { readonly total: number; readonly items: readonly SignalArticle[] };
}

export async function fetchSignalArticle(articleId: string): Promise<SignalArticleDetail> {
  const response = await apiFetch(`/api/signals/articles/${encodeURIComponent(articleId)}`);
  await requireOk(response);
  const data = (await response.json()) as { article: SignalArticleDetail };
  return data.article;
}

export async function updateSignalArticle(articleId: string, input: SignalArticleUpdateInput): Promise<SignalArticleDetail> {
  const response = await apiFetch(`/api/signals/articles/${encodeURIComponent(articleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await requireOk(response);
  const data = (await response.json()) as { article: SignalArticleDetail };
  return data.article;
}

export async function fetchSignalSources(): Promise<readonly SignalSource[]> {
  const response = await apiFetch('/api/signals/sources');
  await requireOk(response);
  const data = (await response.json()) as { sources: readonly SignalSource[] };
  return data.sources;
}

export async function updateSignalSource(sourceId: string, enabled: boolean): Promise<SignalSource> {
  const response = await apiFetch(`/api/signals/sources/${encodeURIComponent(sourceId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  await requireOk(response);
  const data = (await response.json()) as { source: SignalSource };
  return data.source;
}

export async function fetchSignalStats(): Promise<SignalArticleStats> {
  const response = await apiFetch('/api/signals/stats');
  await requireOk(response);
  return (await response.json()) as SignalArticleStats;
}
