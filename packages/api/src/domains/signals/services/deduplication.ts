import { createHash } from 'node:crypto';

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
]);

const SIGNAL_ID_PREFIX = 'signal_';
const SIGNAL_ID_HEX_LENGTH = 24;

function normalizeTrailingSlash(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function normalizeArticleUrl(inputUrl: string): string {
  try {
    const url = new URL(inputUrl.trim());
    url.hash = '';
    url.pathname = normalizeTrailingSlash(url.pathname);

    const keptEntries = Array.from(url.searchParams.entries())
      .filter(([key]) => !TRACKING_QUERY_PARAMS.has(key))
      .sort(([aKey, aValue], [bKey, bValue]) => {
        if (aKey === bKey) return aValue.localeCompare(bValue);
        return aKey.localeCompare(bKey);
      });

    url.search = '';
    for (const [key, value] of keptEntries) {
      url.searchParams.append(key, value);
    }

    return url.toString();
  } catch {
    // Keep a deterministic fallback for malformed URLs.
    return inputUrl.trim();
  }
}

export function createSignalArticleId(inputUrl: string): string {
  const normalizedUrl = normalizeArticleUrl(inputUrl);
  return createSignalArticleIdFromNormalized(normalizedUrl);
}

export function createSignalArticleIdFromNormalized(normalizedUrl: string): string {
  const digest = createHash('sha256').update(normalizedUrl).digest('hex').slice(0, SIGNAL_ID_HEX_LENGTH);
  return `${SIGNAL_ID_PREFIX}${digest}`;
}

export interface DeduplicationResult {
  readonly articleId: string;
  readonly normalizedUrl: string;
  readonly isNew: boolean;
}

export class DeduplicationService {
  private readonly seenNormalizedUrls = new Set<string>();

  constructor(initialUrls: readonly string[] = []) {
    for (const url of initialUrls) {
      this.seenNormalizedUrls.add(normalizeArticleUrl(url));
    }
  }

  has(url: string): boolean {
    return this.seenNormalizedUrls.has(normalizeArticleUrl(url));
  }

  checkAndMark(url: string): DeduplicationResult {
    const normalizedUrl = normalizeArticleUrl(url);
    const isNew = !this.seenNormalizedUrls.has(normalizedUrl);
    if (isNew) {
      this.seenNormalizedUrls.add(normalizedUrl);
    }

    return {
      articleId: createSignalArticleIdFromNormalized(normalizedUrl),
      normalizedUrl,
      isNew,
    };
  }

  unmark(url: string): void {
    this.seenNormalizedUrls.delete(normalizeArticleUrl(url));
  }
}
