import { resolveSignalPaths } from '../config/sources-loader.js';
import { readInboxRecords } from './inbox-records.js';
import { readArticleDocument } from './article-document.js';
import { StudyMetaService } from './study-meta-service.js';

export interface ActiveSignalArticle {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly tier: number;
  readonly contentSnippet: string;
  readonly note?: string | undefined;
}

const MAX_ACTIVE_SIGNALS = 3;
const CONTENT_SNIPPET_LENGTH = 1500;

/**
 * F091: Creates a lookup function that finds signal articles linked to a thread.
 * Used by route-serial/parallel to inject activeSignals into InvocationContext.
 *
 * Reads ALL article records from disk (not filtered by status) and checks
 * sidecar meta for thread links. Returns enriched data with content snippet.
 */
export function createSignalArticleLookup(): (threadId: string) => Promise<readonly ActiveSignalArticle[]> {
  const paths = resolveSignalPaths();
  const studyMeta = new StudyMetaService();

  return async (threadId: string): Promise<readonly ActiveSignalArticle[]> => {
    // Read ALL records from disk — no status filter, no query filter
    const allRecords = await readInboxRecords(paths, undefined);
    const matched: ActiveSignalArticle[] = [];

    for (const record of allRecords) {
      if (matched.length >= MAX_ACTIVE_SIGNALS) break;
      const meta = await studyMeta.readMeta(record.id, record.filePath);
      const hasThread = meta.threads.some((t) => t.threadId === threadId && !t.stale);
      if (!hasThread) continue;

      try {
        const detail = await readArticleDocument(record);
        if (!detail) continue;
        const article = detail.article;
        if (article.deletedAt) continue;

        matched.push({
          id: article.id,
          title: article.title,
          source: article.source,
          tier: article.tier,
          contentSnippet: detail.content.slice(0, CONTENT_SNIPPET_LENGTH),
          note: article.note,
        });
      } catch {
        // Skip unreadable articles
      }
    }

    return matched;
  };
}
